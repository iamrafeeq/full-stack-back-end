import Room from "../../models/rooms/rooms.js";
import Booking from "../../models/Booking/Booking.js";

const filesToPaths = (files) =>
  (files || []).map((f) => `uploads/rooms/${f.filename}`);

// POST /api/createroom  (admin / manager)
export const createRoom = async (req, res) => {
  try {
    const {
      roomNumber, type, floor, capacity, bedType,
      price, discountPrice, amenities, smokingAllowed, description,
    } = req.body;

    if (!roomNumber || !type || !floor || !capacity || !bedType || !price) {
      return res.status(400).json({
        success: false,
        message: "roomNumber, type, floor, capacity, bedType, and price are required",
      });
    }

    const existingRoom = await Room.findOne({ roomNumber });
    if (existingRoom) {
      return res.status(409).json({ success: false, message: `Room ${roomNumber} already exists` });
    }

    const images = filesToPaths(req.files);

    const room = await Room.create({
      roomNumber, type,
      floor:         Number(floor),
      capacity:      Number(capacity),
      bedType,
      price:         Number(price),
      discountPrice: discountPrice ? Number(discountPrice) : undefined,
      amenities:     typeof amenities === "string" ? JSON.parse(amenities) : amenities,
      smokingAllowed: smokingAllowed === "true" || smokingAllowed === true,
      description,
      images,
    });

    return res.status(201).json({ success: true, message: "Room created successfully", room });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to create room", error: error.message });
  }
};

// GET /api/rooms/available  (public)  ?checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD&guests=N
export const getAvailableRooms = async (req, res) => {
  try {
    const { checkIn, checkOut, guests } = req.query;

    if (!checkIn || !checkOut) {
      return res.status(400).json({ success: false, message: "checkIn and checkOut are required" });
    }

    const checkInDate  = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    if (isNaN(checkInDate) || isNaN(checkOutDate) || checkOutDate <= checkInDate) {
      return res.status(400).json({ success: false, message: "Invalid date range" });
    }

    // Find room IDs that have an overlapping confirmed booking
    const overlappingBookings = await Booking.find({
      status:      { $in: ["booked", "checked-in"] },
      checkInDate: { $lt: checkOutDate },
      checkOutDate:{ $gt: checkInDate },
    }).select("room");

    const bookedRoomIds = overlappingBookings.map((b) => b.room);

    const filter = {
      _id:      { $nin: bookedRoomIds },
      status:   { $ne: "maintenance" },
      isActive: true,
    };

    if (guests && Number(guests) > 1) {
      filter.capacity = { $gte: Number(guests) };
    }

    const rooms = await Room.find(filter).sort({ price: 1 });

    return res.status(200).json({ success: true, count: rooms.length, rooms });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/getallrooms  (public)  ?page=1&limit=10&includeInactive=true
export const getAllRooms = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 10);
    const skip  = (page - 1) * limit;

    const filter = req.query.includeInactive === "true" ? {} : { isActive: true };

    const [rooms, total] = await Promise.all([
      Room.find(filter).skip(skip).limit(limit),
      Room.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      total,
      page,
      pages: Math.ceil(total / limit),
      rooms,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to fetch rooms", error: error.message });
  }
};

// GET /api/getroom/:id  (public)
export const getSingleRoom = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: "Room not found" });
    return res.status(200).json({ success: true, room });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to fetch room", error: error.message });
  }
};

// PUT /api/updateroom/:id  (admin / manager)
export const updateRoom = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: "Room not found" });

    const updates = { ...req.body };

    if (typeof updates.amenities === "string") {
      try { updates.amenities = JSON.parse(updates.amenities); } catch { /* leave as-is */ }
    }
    if (updates.smokingAllowed !== undefined) {
      updates.smokingAllowed = updates.smokingAllowed === "true" || updates.smokingAllowed === true;
    }

    if (req.files?.length > 0) {
      updates.images = filesToPaths(req.files);
    } else {
      delete updates.images;
    }

    const updated = await Room.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    return res.status(200).json({ success: true, message: "Room updated successfully", room: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to update room", error: error.message });
  }
};

// PATCH /api/updatestatus/:id  (admin / manager)
export const updateRoomStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ["available", "reserved", "occupied", "cleaning", "maintenance"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status value" });
    }
    const room = await Room.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!room) return res.status(404).json({ success: false, message: "Room not found" });
    return res.status(200).json({ success: true, message: `Room status updated to ${status}`, room });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to update room status", error: error.message });
  }
};

// DELETE /api/deleteroom/:id  (admin only)
export const deleteRoom = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: "Room not found" });

    // Block delete if ANY booking ever referenced this room — historical records must stay intact
    const anyBooking = await Booking.findOne({ room: req.params.id });
    if (anyBooking) {
      return res.status(400).json({
        success: false,
        message: "This room has booking history and cannot be permanently deleted. Deactivate it instead.",
      });
    }

    await Room.findByIdAndDelete(req.params.id);
    return res.status(200).json({ success: true, message: "Room deleted successfully" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to delete room", error: error.message });
  }
};

// PUT /api/deactivateroom/:id  (admin only)
export const deactivateRoom = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: "Room not found" });

    const activeBooking = await Booking.findOne({
      room:   req.params.id,
      status: { $in: ["booked", "checked-in"] },
    });

    if (activeBooking) {
      return res.status(400).json({
        success: false,
        message: "Cannot deactivate a room with an active or upcoming booking. Wait until the current booking is complete.",
      });
    }

    room.isActive = false;
    await room.save();

    return res.status(200).json({ success: true, message: "Room deactivated", room });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to deactivate room", error: error.message });
  }
};

// PUT /api/activateroom/:id  (admin only)
export const activateRoom = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: "Room not found" });

    room.isActive = true;
    await room.save();

    return res.status(200).json({ success: true, message: "Room activated", room });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to activate room", error: error.message });
  }
};
