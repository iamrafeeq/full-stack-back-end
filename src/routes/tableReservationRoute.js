import express from "express";
import {
  createReservation,
  getReservations,
  getReservationById,
  seatReservation,
  completeReservation,
  cancelReservation,
} from "../controller/table/tableReservationController.js";
import protect          from "../middleware/auth/Authmiddleware.js";
import authenticateRole from "../middleware/roles/roleBase.js";

const TableReservationRoute = express.Router();

TableReservationRoute.use(protect);

// All authenticated users
TableReservationRoute.post("/",    createReservation);
TableReservationRoute.get("/",     getReservations);
TableReservationRoute.get("/:id",  getReservationById);

// Guest can cancel own; staff can cancel any (ownership check inside controller)
TableReservationRoute.delete("/:id", cancelReservation);

// Staff only — lifecycle transitions
TableReservationRoute.put("/:id/seat",     authenticateRole("admin", "manager", "receptionist"), seatReservation);
TableReservationRoute.put("/:id/complete", authenticateRole("admin", "manager", "receptionist"), completeReservation);

export default TableReservationRoute;
