import express from "express";
import {
  createHall,
  getHalls,
  getHallById,
  updateHall,
  deactivateHall,
  activateHall,
  deleteHall,
} from "../controller/eventHall/eventHallController.js";
import protect          from "../middleware/auth/Authmiddleware.js";
import authenticateRole from "../middleware/roles/roleBase.js";

const EventHallRoute = express.Router();

EventHallRoute.use(protect);

// Any authenticated user — browse halls
EventHallRoute.get("/",    getHalls);
EventHallRoute.get("/:id", getHallById);

// Admin + Manager — CRUD
EventHallRoute.post("/",               authenticateRole("admin", "manager"), createHall);
EventHallRoute.put("/:id",             authenticateRole("admin", "manager"), updateHall);
EventHallRoute.put("/:id/deactivate",  authenticateRole("admin", "manager"), deactivateHall);
EventHallRoute.put("/:id/activate",    authenticateRole("admin", "manager"), activateHall);
EventHallRoute.delete("/:id",          authenticateRole("admin", "manager"), deleteHall);

export default EventHallRoute;
