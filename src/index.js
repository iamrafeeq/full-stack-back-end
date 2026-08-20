
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import AuthRoute from "./routes/userRoute.js";
import RoomRoute from "./routes/roomRoute.js";
import BookingRoute from "./routes/bookingRoute.js";
import InvoiceRoute      from "./routes/invoiceRoute.js";
import HousekeepingRoute  from "./routes/housekeepingRoute.js";
import ReceptionistRoute  from "./routes/receptionistRoute.js";
import ReportRoute        from "./routes/reportRoute.js";
import FeedbackRoute      from "./routes/feedbackRoute.js";
import SettingsRoute      from "./routes/settingsRoute.js";
import NotificationRoute  from "./routes/notificationRoute.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const root = express();

root.use(cors({
  origin: "http://localhost:5173",
  credentials: true,
}));
root.use(express.json());


root.use("/uploads", express.static(path.join(__dirname, "../uploads")));

root.get("/", (req, res) => {
    res.send("Hello World");
});

root.use("/api", AuthRoute);
root.use("/api", RoomRoute);
root.use("/api/bookings", BookingRoute);
root.use("/api/invoices",      InvoiceRoute);
root.use("/api/housekeeping",  HousekeepingRoute);
root.use("/api/receptionist", ReceptionistRoute);
root.use("/api/reports",      ReportRoute);
root.use("/api/feedback",       FeedbackRoute);
root.use("/api/settings",       SettingsRoute);
root.use("/api/notifications",  NotificationRoute);


mongoose.connect(process.env.MONGO_URI).then(() => {
    console.log("Connected to MongoDB");
}).catch((err) => {
    console.log(err);
});


const port = process.env.PORT || 5000;


 root.listen(port, () =>  {
 console.log(`http://localhost:${port}`)
 })
