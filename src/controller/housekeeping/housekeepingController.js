import Room               from "../../models/rooms/rooms.js";
import MaintenanceRequest from "../../models/Housekeeping/MaintenanceRequest.js";
import Notification       from "../../models/Notification/Notification.js";
import User               from "../../models/userAuthModel.js";
import createNotification from "../../utils/createNotification.js";

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

    // Notify housekeeping and manager users — fire-and-forget, non-critical
    User.find({ role: { $in: ["housekeeping", "manager"] } }).select("_id").then((staff) => {
      const msg = `New maintenance request filed for room ${roomDoc.roomNumber ?? room}: ${issue}`;
      staff.forEach((u) => createNotification(u._id, "maintenance-request", msg, request._id));
    }).catch(() => {});

    return res.status(201).json({ success: true, message: "Maintenance request created", request });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/housekeeping/maintenance?status=open  (manager / receptionist / housekeeping)
export const getRequests = async (req, res) => {
  try {
    const validStatuses = ["open", "in-progress", "resolved"];
    const filter = req.query.status && validStatuses.includes(req.query.status)
      ? { status: req.query.status }
      : {};

    const requests = await MaintenanceRequest.find(filter)
      .populate("room",       "roomNumber type floor")
      .populate("reportedBy", "name role")
      .populate("assignedTo", "name role")
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, requests });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH /api/housekeeping/maintenance/:id  (manager / receptionist / housekeeping)
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

    // When resolved, free the room
    if (status === "resolved") {
      await Room.findByIdAndUpdate(request.room, { status: "available" });
    }

    await request.populate([
      { path: "reportedBy", select: "name role" },
      { path: "assignedTo", select: "name role" },
    ]);

    return res.status(200).json({ success: true, message: "Request status updated", request });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/housekeeping/maintenance/housekeeping-staff  (admin / manager / receptionist)
// Returns active housekeeping users for the "assign to" dropdown
export const getHousekeepingStaff = async (req, res) => {
  try {
    const staff = await User.find({ role: "housekeeping", isActive: true })
      .select("name email")
      .sort({ name: 1 });
    return res.status(200).json({ success: true, staff });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/housekeeping/maintenance/:id/assign  (admin / manager / receptionist)
export const assignRequest = async (req, res) => {
  try {
    const { assignedTo } = req.body;
    if (!assignedTo) {
      return res.status(400).json({ success: false, message: "assignedTo is required" });
    }

    const staff = await User.findById(assignedTo).select("role isActive");
    if (!staff || staff.role !== "housekeeping" || !staff.isActive) {
      return res.status(400).json({ success: false, message: "assignedTo must be an active housekeeping staff member" });
    }

    const request = await MaintenanceRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: "Maintenance request not found" });

    request.assignedTo = assignedTo;
    if (request.status === "open") request.status = "in-progress";
    await request.save();

    await request.populate([
      { path: "room",       select: "roomNumber type floor" },
      { path: "reportedBy", select: "name role" },
      { path: "assignedTo", select: "name role" },
    ]);

    // Notify the assigned housekeeping staff member — fire-and-forget, non-critical
    createNotification(
      assignedTo,
      "maintenance-assigned",
      `You have been assigned a maintenance task: "${request.issue}" — Room ${request.room?.roomNumber ?? "unknown"}`,
      request._id,
    ).catch(() => {});

    return res.status(200).json({ success: true, message: "Request assigned", request });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/housekeeping/maintenance/:id  (admin / manager)
// Removes the request, its notifications, and restores the room if no other requests remain.
export const deleteMaintenanceRequest = async (req, res) => {
  try {
    const request = await MaintenanceRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ success: false, message: "Maintenance request not found" });
    }

    const roomId = request.room;

    // Delete the request and its linked notifications in parallel
    await Promise.all([
      MaintenanceRequest.findByIdAndDelete(request._id),
      Notification.deleteMany({ relatedId: request._id }),
    ]);

    // Restore room to "available" only if no other open/in-progress requests remain
    const otherActive = await MaintenanceRequest.findOne({
      room:   roomId,
      status: { $in: ["open", "in-progress"] },
    });

    if (!otherActive) {
      await Room.findByIdAndUpdate(roomId, { status: "available" });
    }

    return res.status(200).json({ success: true, message: "Maintenance request deleted" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/housekeeping/maintenance/my-tasks?status=  (housekeeping)
// Housekeeping staff view their own assigned tasks
export const getMyTasks = async (req, res) => {
  try {
    const validStatuses = ["open", "in-progress", "resolved"];
    const filter = { assignedTo: req.user._id };
    if (req.query.status && validStatuses.includes(req.query.status)) {
      filter.status = req.query.status;
    }

    const tasks = await MaintenanceRequest.find(filter)
      .populate("room",       "roomNumber type floor")
      .populate("reportedBy", "name role")
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, tasks });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
