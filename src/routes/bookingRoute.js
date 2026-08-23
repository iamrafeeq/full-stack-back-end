import express from "express";
import {
  createBooking,
  getBookings,
  getBookingById,
  checkInBooking,
  checkOutBooking,
  cancelBooking,
  payBooking,
} from "../controller/booking/bookingController.js";
import deleteBooking from "../controller/booking/completeBooking/deleteBooking.js";
import protect           from "../middleware/auth/Authmiddleware.js";
import authenticateRole  from "../middleware/roles/roleBase.js";

const BookingRoute = express.Router();

BookingRoute.use(protect);

// All authenticated users
BookingRoute.post("/createbooking",          createBooking);
BookingRoute.get("/getbookings",             getBookings);
BookingRoute.get("/getbooking/:id",          getBookingById);

// Guest can pay their own; staff can collect on behalf of guest
BookingRoute.post("/:bookingId/pay",         payBooking);

// Staff only
BookingRoute.put("/checkin/:id",   authenticateRole("admin", "manager", "receptionist"), checkInBooking);
BookingRoute.put("/checkout/:id",  authenticateRole("admin", "manager", "receptionist"), checkOutBooking);

// Guest can cancel own booking; staff can cancel any (ownership check inside controller)
BookingRoute.delete("/cancelbooking/:id",    cancelBooking);

// Admin / manager hard-delete (cascades invoice + payment)
BookingRoute.delete("/deletebooking/:id", authenticateRole("admin", "manager"), deleteBooking);

export default BookingRoute;
