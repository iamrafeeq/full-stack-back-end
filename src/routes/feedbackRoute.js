import express from "express";
import {
  submitFeedback,
  getFeedbackStats,
  getFeedbackForBooking,
  getAllFeedback,
} from "../controller/feedback/feedbackController.js";
import protect          from "../middleware/auth/Authmiddleware.js";
import authenticateRole from "../middleware/roles/roleBase.js";

const FeedbackRoute = express.Router();

// Any authenticated user can submit feedback (ownership checked inside controller)
FeedbackRoute.post("/",            protect, submitFeedback);

// /stats MUST be registered before /:bookingId — otherwise Express matches "stats" as a param
FeedbackRoute.get("/stats",        protect, authenticateRole("admin", "manager"), getFeedbackStats);
FeedbackRoute.get("/:bookingId",   protect, getFeedbackForBooking);
FeedbackRoute.get("/",             protect, authenticateRole("admin", "manager"), getAllFeedback);

export default FeedbackRoute;
