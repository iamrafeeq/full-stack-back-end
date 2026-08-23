import express from "express";
import {
  getCleaningRooms,
  markRoomClean,
  reportIssue,
  getRequests,
  updateRequestStatus,
  getHousekeepingStaff,
  assignRequest,
  getMyTasks,
  deleteMaintenanceRequest,
  getCleaningTables,
  markTableClean,
} from "../controller/housekeeping/housekeepingController.js";
import protect          from "../middleware/auth/Authmiddleware.js";
import authenticateRole from "../middleware/roles/roleBase.js";

const HousekeepingRoute = express.Router();

// All housekeeping routes require authentication
HousekeepingRoute.use(protect);

// ── Housekeeping ─────────────────────────────────────────────────────────────
HousekeepingRoute.get("/cleaning-rooms",         authenticateRole("manager", "housekeeping"), getCleaningRooms);
HousekeepingRoute.patch("/rooms/:id/mark-clean", authenticateRole("manager", "housekeeping"), markRoomClean);

// ── Maintenance — static paths MUST come before /:id wildcards ────────────────

// Staff list for "assign to" dropdown
HousekeepingRoute.get("/maintenance/housekeeping-staff", authenticateRole("admin", "manager", "receptionist"), getHousekeepingStaff);

// Housekeeping staff: view own assigned tasks
HousekeepingRoute.get("/maintenance/my-tasks", authenticateRole("housekeeping"), getMyTasks);

// All staff with visibility: full list
HousekeepingRoute.get("/maintenance",  authenticateRole("manager", "receptionist", "housekeeping"), getRequests);

// Any staff member can file a report
HousekeepingRoute.post("/maintenance", authenticateRole("manager", "receptionist", "housekeeping"), reportIssue);

// Assign a request to a housekeeping staff member (auto-flips status open → in-progress)
HousekeepingRoute.put("/maintenance/:id/assign", authenticateRole("admin", "manager", "receptionist"), assignRequest);

// Update status (manager / receptionist / housekeeping)
HousekeepingRoute.patch("/maintenance/:id", authenticateRole("manager", "receptionist", "housekeeping"), updateRequestStatus);

// Hard-delete: removes request, its notifications, restores room if no other active requests remain
HousekeepingRoute.delete("/maintenance/:id", authenticateRole("admin", "manager"), deleteMaintenanceRequest);

// ── Table cleaning — mirrors room cleaning endpoints ─────────────────────────
HousekeepingRoute.get("/tables",           authenticateRole("manager", "housekeeping"), getCleaningTables);
HousekeepingRoute.put("/tables/:id/done",  authenticateRole("manager", "housekeeping"), markTableClean);

export default HousekeepingRoute;
