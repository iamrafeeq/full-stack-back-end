import TableReservation from "../../models/TableReservation/TableReservation.js";
import Table            from "../../models/Table/Table.js";
import User             from "../../models/userAuthModel.js";
import createNotification from "../../utils/createNotification.js";

// ── Time-slot overlap helper — mirrors isRoomAvailable ───────────────────────
// Returns true if the requested slot is free on that table+date.
const toMinutes = (timeStr) => {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
};

const isTableAvailable = async (tableId, reservationDate, reservationTime, durationMinutes, excludeId = null) => {
  const dayStart = new Date(reservationDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(reservationDate);
  dayEnd.setHours(23, 59, 59, 999);

  const newStart = toMinutes(reservationTime);
  const newEnd   = newStart + durationMinutes;

  const query = {
    table:           tableId,
    reservationDate: { $gte: dayStart, $lte: dayEnd },
    status:          { $in: ["reserved", "seated"] },
  };
  if (excludeId) query._id = { $ne: excludeId };

  const existing = await TableReservation.find(query).select("reservationTime durationMinutes");

  for (const r of existing) {
    const existStart = toMinutes(r.reservationTime);
    const existEnd   = existStart + r.durationMinutes;
    if (newStart < existEnd && existStart < newEnd) return false;
  }
  return true;
};

// POST /api/table-reservations
export const createReservation = async (req, res) => {
  try {
    const { table, reservationDate, reservationTime, partySize, specialRequests, guestId } = req.body;

    if (!table || !reservationDate || !reservationTime || !partySize) {
      return res.status(400).json({
        success: false,
        message: "table, reservationDate, reservationTime, and partySize are required",
      });
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

    const tableData = await Table.findById(table);
    if (!tableData) return res.status(404).json({ success: false, message: "Table not found" });

    if (!tableData.isActive) {
      return res.status(400).json({ success: false, message: "This table is not currently available for reservation" });
    }

    if (Number(partySize) > tableData.capacity) {
      return res.status(400).json({
        success: false,
        message: `Party size (${partySize}) exceeds this table's capacity (${tableData.capacity})`,
      });
    }

    const duration = 90;
    const available = await isTableAvailable(table, reservationDate, reservationTime, duration);
    if (!available) {
      return res.status(400).json({
        success: false,
        message: "This table is already reserved for the selected time slot",
      });
    }

    const reservation = await TableReservation.create({
      guest: guestUserId,
      table,
      reservationDate,
      reservationTime,
      durationMinutes: duration,
      partySize:       Number(partySize),
      specialRequests,
      status: "reserved",
    });

    // Notify admin and receptionist — fire-and-forget, non-critical
    User.find({ role: { $in: ["admin", "receptionist"] } }).select("_id").then((staff) => {
      const msg = `New table reservation for table ${tableData.tableNumber ?? table}`;
      staff.forEach((u) => createNotification(u._id, "new-booking", msg, reservation._id));
    }).catch(() => {});

    return res.status(201).json({ success: true, message: "Reservation created successfully", reservation });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/table-reservations  ?status=reserved  ?date=2025-08-01
export const getReservations = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 100);
    const skip  = (page - 1) * limit;

    const filter = req.user.role === "user" ? { guest: req.user._id } : {};

    const validStatuses = ["reserved", "seated", "completed", "cancelled"];
    if (req.query.status && validStatuses.includes(req.query.status)) {
      filter.status = req.query.status;
    }

    if (req.query.date) {
      const dayStart = new Date(req.query.date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(req.query.date);
      dayEnd.setHours(23, 59, 59, 999);
      filter.reservationDate = { $gte: dayStart, $lte: dayEnd };
    }

    const [reservations, total] = await Promise.all([
      TableReservation.find(filter)
        .populate("table", "tableNumber capacity location")
        .populate("guest", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      TableReservation.countDocuments(filter),
    ]);

    return res.status(200).json({ success: true, total, page, pages: Math.ceil(total / limit), reservations });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/table-reservations/:id
export const getReservationById = async (req, res) => {
  try {
    const reservation = await TableReservation.findById(req.params.id)
      .populate("table", "tableNumber capacity location")
      .populate("guest", "name email");

    if (!reservation) return res.status(404).json({ success: false, message: "Reservation not found" });

    if (req.user.role === "user" && reservation.guest._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized to view this reservation" });
    }

    return res.status(200).json({ success: true, reservation });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/table-reservations/:id/seat  (admin / manager / receptionist)
// Mirrors checkInBooking — sets reservation to 'seated', table to 'occupied'
export const seatReservation = async (req, res) => {
  try {
    const reservation = await TableReservation.findById(req.params.id);
    if (!reservation) return res.status(404).json({ success: false, message: "Reservation not found" });

    if (reservation.status !== "reserved") {
      return res.status(400).json({
        success: false,
        message: `Cannot seat a reservation with status '${reservation.status}'`,
      });
    }

    reservation.status = "seated";
    await reservation.save();
    await Table.findByIdAndUpdate(reservation.table, { status: "occupied" });

    return res.status(200).json({ success: true, message: "Guests seated successfully", reservation });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/table-reservations/:id/complete  (admin / manager / receptionist)
// Mirrors checkOutBooking — sets reservation to 'completed', table to 'cleaning'
export const completeReservation = async (req, res) => {
  try {
    const reservation = await TableReservation.findById(req.params.id);
    if (!reservation) return res.status(404).json({ success: false, message: "Reservation not found" });

    if (reservation.status !== "seated") {
      return res.status(400).json({
        success: false,
        message: `Cannot complete a reservation with status '${reservation.status}'`,
      });
    }

    reservation.status = "completed";
    await reservation.save();
    await Table.findByIdAndUpdate(reservation.table, { status: "cleaning" });

    return res.status(200).json({ success: true, message: "Reservation completed", reservation });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/table-reservations/:id
// Mirrors cancelBooking — only cancellable while still 'reserved'; guest cancels own, staff cancels any
export const cancelReservation = async (req, res) => {
  try {
    const reservation = await TableReservation.findById(req.params.id);
    if (!reservation) return res.status(404).json({ success: false, message: "Reservation not found" });

    const isStaff = ["admin", "manager", "receptionist"].includes(req.user.role);

    if (reservation.status === "completed") {
      return res.status(400).json({ success: false, message: "Cannot cancel a reservation that has already been completed" });
    }
    if (reservation.status === "cancelled") {
      return res.status(400).json({ success: false, message: "Reservation is already cancelled" });
    }

    if (!isStaff) {
      if (reservation.guest.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, message: "Not authorized to cancel this reservation" });
      }
      if (reservation.status !== "reserved") {
        return res.status(400).json({ success: false, message: "You can only cancel a reservation before being seated" });
      }
    }

    // If the guests were already seated and staff is force-cancelling, free the table
    if (reservation.status === "seated") {
      await Table.findByIdAndUpdate(reservation.table, { status: "cleaning" });
    }

    reservation.status = "cancelled";
    await reservation.save();

    return res.status(200).json({ success: true, message: "Reservation cancelled", reservation });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
