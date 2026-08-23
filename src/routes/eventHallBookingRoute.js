import express from "express";
import {
  createHallBooking,
  getHallBookings,
  getHallBookingById,
  confirmHallBooking,
  startHallEvent,
  completeHallEvent,
  cancelHallBooking,
} from "../controller/eventHall/eventHallBookingController.js";
import protect          from "../middleware/auth/Authmiddleware.js";
import authenticateRole from "../middleware/roles/roleBase.js";

const EventHallBookingRoute = express.Router();

EventHallBookingRoute.use(protect);

// All authenticated users
EventHallBookingRoute.post("/",   createHallBooking);
EventHallBookingRoute.get("/",    getHallBookings);
EventHallBookingRoute.get("/:id", getHallBookingById);

// Guest can cancel own; staff can cancel any (ownership check inside controller)
EventHallBookingRoute.delete("/:id", cancelHallBooking);

// Staff only — lifecycle transitions
EventHallBookingRoute.put("/:id/confirm",  authenticateRole("admin", "manager", "receptionist"), confirmHallBooking);
EventHallBookingRoute.put("/:id/start",    authenticateRole("admin", "manager", "receptionist"), startHallEvent);
EventHallBookingRoute.put("/:id/complete", authenticateRole("admin", "manager", "receptionist"), completeHallEvent);

export default EventHallBookingRoute;
