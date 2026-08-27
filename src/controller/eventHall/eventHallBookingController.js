import EventHallBooking from "../../models/EventHallBooking/EventHallBooking.js";
import EventHall        from "../../models/EventHall/EventHall.js";
import User             from "../../models/userAuthModel.js";
import createNotification from "../../utils/createNotification.js";
import { sendBookingConfirmationEmail } from "../../utils/mailer.js";

// ── Time-slot overlap helper — mirrors isTableAvailable ──────────────────────
// Returns true if the requested time block is free on that hall+date.
const toMinutes = (timeStr) => {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
};

const isHallAvailable = async (hallId, eventDate, startTime, endTime, excludeId = null) => {
  const dayStart = new Date(eventDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(eventDate);
  dayEnd.setHours(23, 59, 59, 999);

  const newStart = toMinutes(startTime);
  const newEnd   = toMinutes(endTime);

  const query = {
    hall:      hallId,
    eventDate: { $gte: dayStart, $lte: dayEnd },
    status:    { $in: ["booked", "confirmed", "in-progress"] },
  };
  if (excludeId) query._id = { $ne: excludeId };

  const existing = await EventHallBooking.find(query).select("startTime endTime");

  for (const b of existing) {
    const existStart = toMinutes(b.startTime);
    const existEnd   = toMinutes(b.endTime);
    if (newStart < existEnd && existStart < newEnd) return false;
  }
  return true;
};

// POST /api/event-hall-bookings
export const createHallBooking = async (req, res) => {
  try {
    const { hall, eventDate, startTime, endTime, eventType, guestCount, specialRequests, guestId } = req.body;

    if (!hall || !eventDate || !startTime || !endTime || !eventType || !guestCount) {
      return res.status(400).json({
        success: false,
        message: "hall, eventDate, startTime, endTime, eventType, and guestCount are required",
      });
    }

    if (toMinutes(startTime) >= toMinutes(endTime)) {
      return res.status(400).json({ success: false, message: "startTime must be before endTime" });
    }

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

    const hallData = await EventHall.findById(hall);
    if (!hallData) return res.status(404).json({ success: false, message: "Event hall not found" });

    if (!hallData.isActive) {
      return res.status(400).json({ success: false, message: "This event hall is not currently available for booking" });
    }

    if (Number(guestCount) > hallData.capacity) {
      return res.status(400).json({
        success: false,
        message: `Guest count (${guestCount}) exceeds this hall's capacity (${hallData.capacity})`,
      });
    }

    const available = await isHallAvailable(hall, eventDate, startTime, endTime);
    if (!available) {
      return res.status(400).json({
        success: false,
        message: "This hall is already booked for the selected date and time block",
      });
    }

    // Calculate totalAmount: duration in hours × hourlyRate
    const durationHours = (toMinutes(endTime) - toMinutes(startTime)) / 60;
    const totalAmount   = durationHours * hallData.hourlyRate;

    const booking = await EventHallBooking.create({
      guest:        guestUserId,
      hall,
      eventDate,
      startTime,
      endTime,
      eventType,
      guestCount:   Number(guestCount),
      totalAmount,
      specialRequests,
      status:        "booked",
      paymentStatus: "pending",
    });

    // Notify admin and receptionist — fire-and-forget, non-critical
    User.find({ role: { $in: ["admin", "receptionist"] } }).select("_id").then((staff) => {
      const msg = `New event hall booking for "${hallData.hallName}" on ${new Date(eventDate).toDateString()}`;
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
          type:        "event hall booking",
          detailsHtml: `
            <p style="margin:4px 0;"><strong>Hall:</strong> ${hallData.hallName}</p>
            <p style="margin:4px 0;"><strong>Date:</strong> ${fmt(eventDate)}</p>
            <p style="margin:4px 0;"><strong>Time:</strong> ${startTime} – ${endTime}</p>
            <p style="margin:4px 0;"><strong>Event Type:</strong> ${eventType.charAt(0).toUpperCase() + eventType.slice(1)}</p>
            <p style="margin:4px 0;"><strong>Guests:</strong> ${guestCount}</p>
            <p style="margin:4px 0;"><strong>Total Amount:</strong> $${totalAmount.toLocaleString()}</p>
          `,
        });
      } catch (err) {
        console.error(`Confirmation email failed for hall booking ${booking._id}:`, err.message);
      }
    }).catch(() => {});

    return res.status(201).json({ success: true, message: "Event hall booking created successfully", booking });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/event-hall-bookings  ?status=booked  ?date=2025-08-01
export const getHallBookings = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 100);
    const skip  = (page - 1) * limit;

    const filter = req.user.role === "user" ? { guest: req.user._id } : {};

    const validStatuses = ["booked", "confirmed", "in-progress", "completed", "cancelled"];
    if (req.query.status && validStatuses.includes(req.query.status)) {
      filter.status = req.query.status;
    }

    if (req.query.date) {
      const dayStart = new Date(req.query.date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(req.query.date);
      dayEnd.setHours(23, 59, 59, 999);
      filter.eventDate = { $gte: dayStart, $lte: dayEnd };
    }

    const [bookings, total] = await Promise.all([
      EventHallBooking.find(filter)
        .populate("hall",  "hallName capacity hourlyRate")
        .populate("guest", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      EventHallBooking.countDocuments(filter),
    ]);

    return res.status(200).json({ success: true, total, page, pages: Math.ceil(total / limit), bookings });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/event-hall-bookings/:id
export const getHallBookingById = async (req, res) => {
  try {
    const booking = await EventHallBooking.findById(req.params.id)
      .populate("hall",  "hallName capacity hourlyRate amenities")
      .populate("guest", "name email");

    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });

    if (req.user.role === "user" && booking.guest._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized to view this booking" });
    }

    return res.status(200).json({ success: true, booking });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/event-hall-bookings/:id/confirm  (admin / manager / receptionist)
// Marks details as finalized — 'booked' → 'confirmed'
// Payment is NOT yet required here; this step represents details/contract finalization.
// Payment is required before startHallEvent, giving time for the guest to settle the bill.
export const confirmHallBooking = async (req, res) => {
  try {
    const booking = await EventHallBooking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });

    if (booking.status !== "booked") {
      return res.status(400).json({
        success: false,
        message: `Cannot confirm a booking with status '${booking.status}'`,
      });
    }

    booking.status = "confirmed";
    await booking.save();

    return res.status(200).json({ success: true, message: "Booking confirmed", booking });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/event-hall-bookings/:id/start  (admin / manager / receptionist)
// Requires booking to be 'confirmed' AND paymentStatus to be 'paid'.
// Sets booking → 'in-progress', hall → 'booked'.
// Payment gate is here (not at confirm) because high-value halls must be paid before the event begins,
// while staff still need the confirm step to finalize contract/headcount details beforehand.
export const startHallEvent = async (req, res) => {
  try {
    const booking = await EventHallBooking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });

    if (booking.status !== "confirmed") {
      return res.status(400).json({
        success: false,
        message: `Cannot start an event with booking status '${booking.status}'. Confirm the booking first.`,
      });
    }

    if (booking.paymentStatus !== "paid") {
      return res.status(400).json({
        success: false,
        message: "Payment must be completed before the event can start",
      });
    }

    booking.status = "in-progress";
    await booking.save();
    await EventHall.findByIdAndUpdate(booking.hall, { status: "booked" });

    return res.status(200).json({ success: true, message: "Event started", booking });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/event-hall-bookings/:id/complete  (admin / manager / receptionist)
// Sets booking → 'completed', hall → 'available'.
// Goes directly to 'available' rather than 'cleaning' because halls don't have a recurring
// short-turnaround cleaning workflow — if maintenance is needed, staff can set it manually.
export const completeHallEvent = async (req, res) => {
  try {
    const booking = await EventHallBooking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });

    if (booking.status !== "in-progress") {
      return res.status(400).json({
        success: false,
        message: `Cannot complete an event with booking status '${booking.status}'`,
      });
    }

    booking.status = "completed";
    await booking.save();
    await EventHall.findByIdAndUpdate(booking.hall, { status: "available" });

    return res.status(200).json({ success: true, message: "Event completed", booking });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/event-hall-bookings/:id
// Guest can cancel own booking while status is 'booked' or 'confirmed'.
// Staff can cancel any booking not yet 'in-progress', 'completed', or 'cancelled'.
// If staff cancels a 'confirmed' booking, the hall status is left unchanged (it wasn't set to 'booked' yet).
export const cancelHallBooking = async (req, res) => {
  try {
    const booking = await EventHallBooking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });

    const isStaff = ["admin", "manager", "receptionist"].includes(req.user.role);

    if (booking.status === "completed") {
      return res.status(400).json({ success: false, message: "Cannot cancel a booking that has already been completed" });
    }
    if (booking.status === "cancelled") {
      return res.status(400).json({ success: false, message: "Booking is already cancelled" });
    }
    if (booking.status === "in-progress") {
      return res.status(400).json({ success: false, message: "Cannot cancel a booking while the event is in progress" });
    }

    if (!isStaff) {
      if (booking.guest.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, message: "Not authorized to cancel this booking" });
      }
      if (!["booked", "confirmed"].includes(booking.status)) {
        return res.status(400).json({ success: false, message: "You can only cancel a booking before the event starts" });
      }
    }

    booking.status = "cancelled";
    await booking.save();

    return res.status(200).json({ success: true, message: "Booking cancelled", booking });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
