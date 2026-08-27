import express from "express";
import {
  createUser,
  editUserProfile,
  getUserProfile,
  loginUser,
  forgotPassword,
  resetPassword,
  changePassword,
} from "../controller/userAuthController.js";
import protect from "../middleware/auth/Authmiddleware.js";
import authenticateRole from "../middleware/roles/roleBase.js";
import { GuestUser, updateUserStatus, updateUserRole } from "../controller/manageRole/GuestUser.js";

const AuthRoute = express.Router();

// ─── Public routes ────────────────────────────────────────────────────────────
AuthRoute.post("/register",       createUser);
AuthRoute.post("/login",          loginUser);
AuthRoute.post("/forgot-password", forgotPassword);
AuthRoute.post("/reset-password",  resetPassword);

// ─── Protected routes — protect applied per-route, not as a catch-all ─────────
AuthRoute.get("/profile", protect, (req, res) => {
  res.status(200).json({ user: req.user });
});

AuthRoute.get(
  "/singleuser/:id",
  protect,
  authenticateRole("manager", "receptionist", "housekeeping", "user"),
  getUserProfile,
);

AuthRoute.put("/updateuser/:id",    protect, editUserProfile);
AuthRoute.put("/change-password",  protect, changePassword);

AuthRoute.get("/admin",        protect, authenticateRole("admin"),        (req, res) => res.status(200).json({ message: "Welcome, admin!" }));
AuthRoute.get("/manager",      protect, authenticateRole("manager"),      (req, res) => res.status(200).json({ message: "Welcome, manager!" }));
AuthRoute.get("/receptionist", protect, authenticateRole("receptionist"), (req, res) => res.status(200).json({ message: "Welcome, receptionist!" }));
AuthRoute.get("/housekeeping", protect, authenticateRole("housekeeping"), (req, res) => res.status(200).json({ message: "Welcome, housekeeping!" }));

AuthRoute.get("/guestuser",           protect, authenticateRole("admin"), GuestUser);
AuthRoute.put("/updateuserstatus/:id", protect, authenticateRole("admin"), updateUserStatus);
AuthRoute.put("/updateuserrole/:id",   protect, authenticateRole("admin"), updateUserRole);

export default AuthRoute;
