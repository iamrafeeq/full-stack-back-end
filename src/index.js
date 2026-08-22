import dotenv from "dotenv";
dotenv.config();

import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import AuthRoute          from "./routes/userRoute.js";
import RoomRoute          from "./routes/roomRoute.js";
import BookingRoute       from "./routes/bookingRoute.js";
import InvoiceRoute       from "./routes/invoiceRoute.js";
import HousekeepingRoute  from "./routes/housekeepingRoute.js";
import ReceptionistRoute  from "./routes/receptionistRoute.js";
import ReportRoute        from "./routes/reportRoute.js";
import FeedbackRoute      from "./routes/feedbackRoute.js";
import SettingsRoute      from "./routes/settingsRoute.js";
import NotificationRoute  from "./routes/notificationRoute.js";
import ContactRoute       from "./routes/contactusRoute.js";
import PaymentRoute       from "./routes/paymentRoute.js";
import { stripeWebhook }  from "./controller/payment/paymentController.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ── MongoDB — cached connection (serverless-safe) ───────────────────────────
let dbConnected = false;
const connectDB = async () => {
  if (dbConnected || mongoose.connection.readyState === 1) return;
  await mongoose.connect(process.env.MONGO_URI);
  dbConnected = true;
  console.log("Connected to MongoDB");
};

const root = express();

// ── CORS ─────────────────────────────────────────────────────────────────────
// Set CLIENT_URL in Vercel env vars to your production frontend URL
root.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  }),
);

// ── DB connection middleware (runs before every request) ─────────────────────
root.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    return res.status(500).json({ success: false, message: "Database unavailable" });
  }
});

// ── Stripe webhook — raw body BEFORE express.json() ─────────────────────────
root.post(
  "/api/payments/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhook,
);

root.use(express.json());

// ── Static uploads (local dev only — use cloud storage in production) ────────
root.use("/uploads", express.static(path.join(__dirname, "../uploads")));

root.get("/", (req, res) => {
  res.send("Hotel HMS API is running");
});

// ── Routes ───────────────────────────────────────────────────────────────────
root.use("/api",              AuthRoute);
root.use("/api",              RoomRoute);
root.use("/api/bookings",     BookingRoute);
root.use("/api/invoices",     InvoiceRoute);
root.use("/api/housekeeping", HousekeepingRoute);
root.use("/api/receptionist", ReceptionistRoute);
root.use("/api/reports",      ReportRoute);
root.use("/api/feedback",     FeedbackRoute);
root.use("/api/settings",     SettingsRoute);
root.use("/api/notifications",NotificationRoute);
root.use("/api/contact",      ContactRoute);
root.use("/api/payments",     PaymentRoute);

// ── Local development server (Vercel sets VERCEL=1, so this is skipped there)
if (process.env.VERCEL !== "1") {
  const port = process.env.PORT || 5000;
  root.listen(port, () => {
    console.log(`http://localhost:${port}`);
  });
}

export default root;
