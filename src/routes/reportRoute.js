import express from "express";
import { getDashboardStats } from "../controller/reports/reportController.js";
import protect          from "../middleware/auth/Authmiddleware.js";
import authenticateRole from "../middleware/roles/roleBase.js";

const ReportRoute = express.Router();

ReportRoute.get("/dashboard", protect, authenticateRole("admin", "manager"), getDashboardStats);

export default ReportRoute;
