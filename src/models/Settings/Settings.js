import mongoose, { Schema } from "mongoose";

const settingsSchema = new Schema({
  taxPercentage:      { type: Number, default: 0 },
  cancellationPolicy: {
    type:    String,
    default: "Free cancellation up to 48 hours before check-in. No refund for late cancellations.",
  },
  checkInTime:  { type: String, default: "14:00" },
  checkOutTime: { type: String, default: "12:00" },
}, { timestamps: true });

const Settings = mongoose.model("Settings", settingsSchema);

export default Settings;
