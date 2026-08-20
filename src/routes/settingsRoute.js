import express from "express";
import { getSettings, updateSettings } from "../controller/settings/settingsController.js";
import protect          from "../middleware/auth/Authmiddleware.js";
import authenticateRole from "../middleware/roles/roleBase.js";

const SettingsRoute = express.Router();

SettingsRoute.get("/", protect, getSettings);
SettingsRoute.put("/", protect, authenticateRole("admin"), updateSettings);

export default SettingsRoute;
