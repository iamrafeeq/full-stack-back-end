import Room               from "../../models/rooms/rooms.js";
import MaintenanceRequest from "../../models/Housekeeping/MaintenanceRequest.js";

// ── Housekeeping ────────────────────────────────────────────────────────────

// GET /api/housekeeping/cleaning-rooms  (manager / housekeeping)
export const getCleaningRooms = async (req, res) => {
  try {
    const rooms = await Room.find({ status: "cleaning" }).select("roomNumber type floor status");
    return res.status(200).json({ success: true, rooms });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH /api/housekeeping/rooms/:id/mark-clean  (manager / housekeeping)
export const markRoomClean = async (req, res) => {
  try {
    const room = await Room.findByIdAndUpdate(
      req.params.id,
      { status: "available" },
      { new: true },
    );
    if (!room) return res.status(404).json({ success: false, message: "Room not found" });
    return res.status(200).json({ success: true, message: "Room marked as available", room });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── Maintenance ─────────────────────────────────────────────────────────────

// POST /api/housekeeping/maintenance  (any staff)
export const reportIssue = async (req, res) => {
  try {
    const { room, issue } = req.body;
    if (!room || !issue) {
      return res.status(400).json({ success: false, message: "Room ID and issue description are required" });
    }

    const roomDoc = await Room.findById(room);
    if (!roomDoc) return res.status(404).json({ success: false, message: "Room not found" });

    const request = await MaintenanceRequest.create({
      room,
      reportedBy: req.user._id,
      issue,
    });

    await Room.findByIdAndUpdate(room, { status: "maintenance" });

    return res.status(201).json({ success: true, message: "Maintenance request created", request });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/housekeeping/maintenance?status=open  (manager / housekeeping)
export const getRequests = async (req, res) => {
  try {
    const validStatuses = ["open", "in-progress", "resolved"];
    const filter = req.query.status && validStatuses.includes(req.query.status)
      ? { status: req.query.status }
      : {};

    const requests = await MaintenanceRequest.find(filter)
      .populate("room",       "roomNumber type floor")
      .populate("reportedBy", "name role")
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, requests });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH /api/housekeeping/maintenance/:id  (manager / admin)
export const updateRequestStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ["open", "in-progress", "resolved"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });
    }

    const request = await MaintenanceRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: "Maintenance request not found" });

    request.status = status;
    await request.save();

    // When resolved, free the room so housekeeping can clean or mark available
    if (status === "resolved") {
      await Room.findByIdAndUpdate(request.room, { status: "available" });
    }

    return res.status(200).json({ success: true, message: "Request status updated", request });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
