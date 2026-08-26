import express from "express";
import {
  submitFeedback,
  getFeedbackStats,
  getFeedbackForBooking,
  getAllFeedback,
  getRoomFeedback,
} from "../controller/feedback/feedbackController.js";
import protect          from "../middleware/auth/Authmiddleware.js";
import authenticateRole from "../middleware/roles/roleBase.js";

const FeedbackRoute = express.Router();

// Any authenticated user can submit feedback (ownership checked inside controller)
FeedbackRoute.post("/",            protect, submitFeedback);

// /stats and /room/:roomId MUST be registered before /:bookingId to avoid param collision
FeedbackRoute.get("/stats",            protect, authenticateRole("admin", "manager"), getFeedbackStats);
FeedbackRoute.get("/room/:roomId",     getRoomFeedback);
FeedbackRoute.get("/:bookingId",       protect, getFeedbackForBooking);
FeedbackRoute.get("/",             protect, authenticateRole("admin", "manager"), getAllFeedback);

export default FeedbackRoute;
