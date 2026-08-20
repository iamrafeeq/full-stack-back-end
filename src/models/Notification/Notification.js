import mongoose, { Schema } from "mongoose";

const notificationSchema = new Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  type: {
    type: String,
    enum: ["new-booking", "maintenance-request", "maintenance-assigned", "checkin-today", "checkout-today"],
    required: true,
  },
  message:   { type: String, required: true },
  relatedId: { type: mongoose.Schema.Types.ObjectId },
  isRead:    { type: Boolean, default: false },
}, { timestamps: true });

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
