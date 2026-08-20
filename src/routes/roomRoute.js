import express from "express";
import {
  createRoom,
  getAllRooms,
  getAvailableRooms,
  getSingleRoom,
  updateRoom,
  updateRoomStatus,
  deleteRoom,
} from "../controller/rooms/roomController.js";
import protect from "../middleware/auth/Authmiddleware.js";
import authenticateRole from "../middleware/roles/roleBase.js";
import { uploadRoomImages } from "../middleware/imageUpload/imageUpload.js";

const RoomRoute = express.Router();

// ── Public — no token required ──────────────────────────────────────────────
RoomRoute.get("/getallrooms", getAllRooms);
RoomRoute.get("/available",   getAvailableRooms);   // ?checkIn=&checkOut=&guests=
RoomRoute.get("/getroom/:id", getSingleRoom);

// ── Protected — protect applied per-route, not as a catch-all ───────────────
RoomRoute.post(
  "/createroom",
  protect,
  authenticateRole("admin", "manager"),
  uploadRoomImages,
  createRoom,
);

RoomRoute.put(
  "/updateroom/:id",
  protect,
  authenticateRole("admin", "manager"),
  uploadRoomImages,
  updateRoom,
);

RoomRoute.patch("/updatestatus/:id", protect, authenticateRole("admin", "manager"), updateRoomStatus);
RoomRoute.delete("/deleteroom/:id",  protect, authenticateRole("admin"),            deleteRoom);

export default RoomRoute;
