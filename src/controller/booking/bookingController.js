import Booking  from "../../models/Booking/Booking.js";
import Room     from "../../models/rooms/rooms.js";
import Payment  from "../../models/Payment/Payment.js";
import Invoice  from "../../models/invoice/invoice.js";
import User     from "../../models/userAuthModel.js";
import Settings from "../../models/Settings/Settings.js";
import createNotification from "../../utils/createNotification.js";
import { sendBookingConfirmationEmail } from "../../utils/mailer.js";

const calculateNights = (checkIn, checkOut) => {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((new Date(checkOut) - new Date(checkIn)) / msPerDay);
};

const isRoomAvailable = async (roomId, checkIn, checkOut, excludeBookingId = null) => {
  const query = {
    room: roomId,
    status: { $in: ["booked", "checked-in"] },
    checkInDate:  { $lt: new Date(checkOut) },
    checkOutDate: { $gt: new Date(checkIn) },
  };
  if (excludeBookingId) query._id = { $ne: excludeBookingId };
  const overlap = await Booking.findOne(query);
  return !overlap;
};

// POST /api/bookings/createbooking
export const createBooking = async (req, res) => {
  try {
    const { room, checkInDate, checkOutDate, paymentTiming, paymentMethod, guestId } = req.body;

    if (!room || !checkInDate || !checkOutDate) {
      return res.status(400).json({ success: false, message: "Room, check-in date, and check-out date are required" });
    }

    if (!paymentTiming) {
      return res.status(400).json({ success: false, message: "Payment timing is required (now / checkin / checkout)" });
    }

    // paymentMethod no longer required at booking time — 'now' payments go through
    // POST /api/payments/create-payment-intent + /confirm after booking is created

    // Receptionist / admin can book on behalf of a guest by supplying guestId
    let guestUserId = req.user._id;
    const canBookOnBehalf = ["admin", "receptionist"].includes(req.user.role);
    if (guestId && canBookOnBehalf) {
      const guestUser = await User.findById(guestId).select("role isActive");
      if (!guestUser) {
        return res.status(400).json({ success: false, message: "Guest user not found" });
      }
      if (guestUser.role !== "user") {
        return res.status(400).json({ success: false, message: "The specified user is not a guest (role must be 'user')" });
      }
      guestUserId = guestUser._id;
    }

    const nights = calculateNights(checkInDate, checkOutDate);
    if (nights < 1) {
      return res.status(400).json({ success: false, message: "Check-out must be after check-in" });
    }

    const roomData = await Room.findById(room);
    if (!roomData) return res.status(404).json({ success: false, message: "Room not found" });

    if (!roomData.isActive) {
      return res.status(400).json({ success: false, message: "This room is not currently available for booking" });
    }

    if (roomData.status === "maintenance") {
      return res.status(400).json({ success: false, message: "This room is under maintenance and cannot be booked" });
    }

    const available = await isRoomAvailable(room, checkInDate, checkOutDate);
    if (!available) {
      return res.status(400).json({ success: false, message: "Room is already booked for the selected dates" });
    }

    const totalAmount = nights * (roomData.discountPrice || roomData.price);

    const booking = await Booking.create({
      guest:         guestUserId,
      room,
      checkInDate,
      checkOutDate,
      nights,
      totalAmount,
      paymentTiming,
      paymentStatus: "pending",
    });

    // Notify all receptionist and admin users — fire-and-forget, non-critical
    User.find({ role: { $in: ["admin", "receptionist"] } }).select("_id").then((staff) => {
      const msg = `New booking created for room ${roomData.roomNumber ?? room}`;
      staff.forEach((u) => createNotification(u._id, "new-booking", msg, booking._id));
    }).catch(() => {});

    // Confirmation email — fire-and-forget, never blocks the response
    User.findById(guestUserId).select("name email").then(async (guest) => {
      if (!guest?.email) return;
      const fmt = (d) => new Date(d).toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "long", day: "numeric" });
      try {
        await sendBookingConfirmationEmail({
          to:          guest.email,
          guestName:   guest.name,
          type:        "room reservation",
          detailsHtml: `
            <p style="margin:4px 0;"><strong>Room:</strong> ${roomData.roomNumber} (${roomData.type})</p>
            <p style="margin:4px 0;"><strong>Check-in:</strong> ${fmt(checkInDate)}</p>
            <p style="margin:4px 0;"><strong>Check-out:</strong> ${fmt(checkOutDate)}</p>
            <p style="margin:4px 0;"><strong>Nights:</strong> ${nights}</p>
            <p style="margin:4px 0;"><strong>Total Amount:</strong> $${totalAmount.toLocaleString()}</p>
          `,
        });
      } catch (err) {
        console.error(`Confirmation email failed for booking ${booking._id}:`, err.message);
      }
    }).catch(() => {});

    return res.status(201).json({ success: true, message: "Booking created successfully", booking });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/bookings/getbookings
export const getBookings = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 100);
    const skip  = (page - 1) * limit;

    const filter = req.user.role === "user" ? { guest: req.user._id } : {};

    const [bookings, total] = await Promise.all([
      Booking.find(filter)
        .populate("guest", "name email")
        .populate("room", "roomNumber type price")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Booking.countDocuments(filter),
    ]);

    return res.status(200).json({ success: true, total, page, pages: Math.ceil(total / limit), bookings });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/bookings/getbooking/:id
export const getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate("guest", "name email")
      .populate("room", "roomNumber type price");

    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });

    if (req.user.role === "user" && booking.guest._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized to view this booking" });
    }

    return res.status(200).json({ success: true, booking });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/bookings/checkin/:id
export const checkInBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });

    if (booking.status !== "booked") {
      return res.status(400).json({ success: false, message: `Cannot check in a booking with status '${booking.status}'` });
    }

    if (booking.paymentTiming === "checkin" && booking.paymentStatus !== "paid") {
      return res.status(400).json({ success: false, message: "Payment required before check-in" });
    }

    booking.status = "checked-in";
    await booking.save();
    await Room.findByIdAndUpdate(booking.room, { status: "occupied" });

    return res.status(200).json({ success: true, message: "Checked in successfully", booking });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/bookings/checkout/:id
export const checkOutBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });

    if (booking.status !== "checked-in") {
      return res.status(400).json({ success: false, message: `Cannot check out a booking with status '${booking.status}'` });
    }

    if (booking.paymentTiming === "checkout" && booking.paymentStatus !== "paid") {
      return res.status(400).json({ success: false, message: "Payment required before checkout" });
    }

    const extraCharges = Array.isArray(req.body.extraCharges) ? req.body.extraCharges : [];
    const extraTotal   = extraCharges.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

    const settings      = await Settings.findOne();
    const taxPercentage = settings?.taxPercentage ?? 0;
    const subtotal      = booking.totalAmount + extraTotal;
    const taxAmount     = parseFloat((subtotal * (taxPercentage / 100)).toFixed(2));
    const totalAmount   = parseFloat((subtotal + taxAmount).toFixed(2));

    booking.status = "checked-out";
    await booking.save();
    await Room.findByIdAndUpdate(booking.room, { status: "cleaning" });

    const invoice = await Invoice.create({
      booking:       booking._id,
      guest:         booking.guest,
      roomCharge:    booking.totalAmount,
      extraCharges,
      taxPercentage,
      taxAmount,
      totalAmount,
      paymentStatus: booking.paymentStatus,
    });

    return res.status(200).json({ success: true, message: "Checked out successfully", booking, invoice });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/bookings/cancelbooking/:id
export const cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });

    const isStaff = ["admin", "manager", "receptionist"].includes(req.user.role);

    if (booking.status === "checked-out") {
      return res.status(400).json({ success: false, message: "Cannot cancel a booking that has already checked out" });
    }
    if (booking.status === "cancelled") {
      return res.status(400).json({ success: false, message: "Booking is already cancelled" });
    }

    if (!isStaff) {
      if (booking.guest.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, message: "Not authorized to cancel this booking" });
      }
      if (booking.status !== "booked") {
        return res.status(400).json({ success: false, message: "You can only cancel a booking before check-in" });
      }
    }

    if (booking.status === "checked-in") {
      await Room.findByIdAndUpdate(booking.room, { status: "cleaning" });
    }

    booking.status = "cancelled";
    await booking.save();

    return res.status(200).json({ success: true, message: "Booking cancelled", booking });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/bookings/:bookingId/pay
export const payBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId);
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });

    const isStaff = ["admin", "manager", "receptionist"].includes(req.user.role);
    if (!isStaff && booking.guest.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized to pay this booking" });
    }

    if (booking.paymentStatus === "paid") {
      return res.status(400).json({ success: false, message: "This booking is already paid" });
    }

    const { paymentMethod } = req.body;
    if (!paymentMethod) {
      return res.status(400).json({ success: false, message: "Payment method is required" });
    }

    const payment = await Payment.create({
      booking:       booking._id,
      amount:        booking.totalAmount,
      method:        paymentMethod,
      transactionId: `TXN${Date.now()}`,
    });

    booking.paymentStatus = "paid";
    await booking.save();

    return res.status(200).json({ success: true, message: "Payment recorded successfully", booking, payment });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
