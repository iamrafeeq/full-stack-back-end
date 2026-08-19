import express from "express";
import {
  getCleaningRooms,
  markRoomClean,
  reportIssue,
  getRequests,
  updateRequestStatus,
} from "../controller/housekeeping/housekeepingController.js";
import protect          from "../middleware/auth/Authmiddleware.js";
import authenticateRole from "../middleware/roles/roleBase.js";

const HousekeepingRoute = express.Router();

// All housekeeping routes require authentication
HousekeepingRoute.use(protect);

// ── Housekeeping ─────────────────────────────────────────────────────────────
// Who can see which rooms need cleaning / mark a room clean
HousekeepingRoute.get("/cleaning-rooms",       authenticateRole("manager", "housekeeping"), getCleaningRooms);
HousekeepingRoute.patch("/rooms/:id/mark-clean", authenticateRole("manager", "housekeeping"), markRoomClean);

// ── Maintenance ───────────────────────────────────────────────────────────────
// Any staff member can file a report; manager+ can view and update
HousekeepingRoute.post("/maintenance",      authenticateRole("manager", "receptionist", "housekeeping"), reportIssue);
HousekeepingRoute.get("/maintenance",       authenticateRole("manager", "housekeeping"),                 getRequests);
HousekeepingRoute.patch("/maintenance/:id", authenticateRole("manager"),                                 updateRequestStatus);

export default HousekeepingRoute;
