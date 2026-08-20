import express from "express";
import {
  getMyNotifications,
  getUnreadCount,
  markAllAsRead,
  markAsRead,
} from "../controller/notification/notificationController.js";
import protect from "../middleware/auth/Authmiddleware.js";

const NotificationRoute = express.Router();

// All routes are scoped to the logged-in user — no role restriction needed
NotificationRoute.use(protect);

// Static paths MUST come before /:id to avoid param capture
NotificationRoute.get("/unread-count",   getUnreadCount);
NotificationRoute.put("/mark-all-read",  markAllAsRead);
NotificationRoute.get("/",               getMyNotifications);
NotificationRoute.put("/:id/read",       markAsRead);

export default NotificationRoute;
