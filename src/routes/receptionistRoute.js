import express from "express";
import { searchGuests, getTodayActivity } from "../controller/receptionist/receptionistController.js";
import protect          from "../middleware/auth/Authmiddleware.js";
import authenticateRole from "../middleware/roles/roleBase.js";

const ReceptionistRoute = express.Router();

ReceptionistRoute.use(protect);

// Look up guest accounts by name / email (for booking on their behalf)
ReceptionistRoute.get("/guests", authenticateRole("admin", "receptionist"), searchGuests);

// Today's expected arrivals and current check-ins due to depart
ReceptionistRoute.get("/today",  authenticateRole("admin", "manager", "receptionist"), getTodayActivity);

export default ReceptionistRoute;
