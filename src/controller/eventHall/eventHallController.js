import EventHall        from "../../models/EventHall/EventHall.js";
import EventHallBooking from "../../models/EventHallBooking/EventHallBooking.js";

// POST /api/event-halls  (admin / manager)
export const createHall = async (req, res) => {
  try {
    const { hallName, capacity, hourlyRate, amenities } = req.body;

    if (!hallName || !capacity || !hourlyRate) {
      return res.status(400).json({ success: false, message: "hallName, capacity, and hourlyRate are required" });
    }

    const existing = await EventHall.findOne({ hallName });
    if (existing) {
      return res.status(409).json({ success: false, message: `Hall "${hallName}" already exists` });
    }

    const hall = await EventHall.create({
      hallName,
      capacity:   Number(capacity),
      hourlyRate: Number(hourlyRate),
      amenities:  amenities || [],
    });

    return res.status(201).json({ success: true, message: "Event hall created successfully", hall });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/event-halls  (any authenticated user)
// ?includeInactive=true  ?capacity=50
export const getHalls = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(500, parseInt(req.query.limit) || 10);
    const skip  = (page - 1) * limit;

    const filter = req.query.includeInactive === "true" ? {} : { isActive: true };

    if (req.query.capacity) filter.capacity = { $gte: Number(req.query.capacity) };

    const [halls, total] = await Promise.all([
      EventHall.find(filter).skip(skip).limit(limit),
      EventHall.countDocuments(filter),
    ]);

    return res.status(200).json({ success: true, total, page, pages: Math.ceil(total / limit), halls });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to fetch halls", error: error.message });
  }
};

// GET /api/event-halls/:id  (any authenticated user)
export const getHallById = async (req, res) => {
  try {
    const hall = await EventHall.findById(req.params.id);
    if (!hall) return res.status(404).json({ success: false, message: "Event hall not found" });
    return res.status(200).json({ success: true, hall });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to fetch hall", error: error.message });
  }
};

// PUT /api/event-halls/:id  (admin / manager)
export const updateHall = async (req, res) => {
  try {
    const hall = await EventHall.findById(req.params.id);
    if (!hall) return res.status(404).json({ success: false, message: "Event hall not found" });

    const updated = await EventHall.findByIdAndUpdate(req.params.id, { ...req.body }, {
      new:           true,
      runValidators: true,
    });

    return res.status(200).json({ success: true, message: "Event hall updated successfully", hall: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to update hall", error: error.message });
  }
};

// PUT /api/event-halls/:id/deactivate  (admin / manager)
// Blocked if any booking is currently active (booked / confirmed / in-progress)
export const deactivateHall = async (req, res) => {
  try {
    const hall = await EventHall.findById(req.params.id);
    if (!hall) return res.status(404).json({ success: false, message: "Event hall not found" });

    const activeBooking = await EventHallBooking.findOne({
      hall:   req.params.id,
      status: { $in: ["booked", "confirmed", "in-progress"] },
    });

    if (activeBooking) {
      return res.status(400).json({
        success: false,
        message: "Cannot deactivate a hall with an active booking. Complete or cancel the booking first.",
      });
    }

    hall.isActive = false;
    await hall.save();

    return res.status(200).json({ success: true, message: "Event hall deactivated", hall });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to deactivate hall", error: error.message });
  }
};

// PUT /api/event-halls/:id/activate  (admin / manager)
export const activateHall = async (req, res) => {
  try {
    const hall = await EventHall.findById(req.params.id);
    if (!hall) return res.status(404).json({ success: false, message: "Event hall not found" });

    hall.isActive = true;
    await hall.save();

    return res.status(200).json({ success: true, message: "Event hall activated", hall });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to activate hall", error: error.message });
  }
};

// DELETE /api/event-halls/:id  (admin / manager)
// Blocked if any booking history exists — deactivate instead
export const deleteHall = async (req, res) => {
  try {
    const hall = await EventHall.findById(req.params.id);
    if (!hall) return res.status(404).json({ success: false, message: "Event hall not found" });

    const anyBooking = await EventHallBooking.findOne({ hall: req.params.id });
    if (anyBooking) {
      return res.status(400).json({
        success: false,
        message: "This hall has booking history and cannot be permanently deleted. Deactivate it instead.",
      });
    }

    await EventHall.findByIdAndDelete(req.params.id);
    return res.status(200).json({ success: true, message: "Event hall deleted successfully" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to delete hall", error: error.message });
  }
};
