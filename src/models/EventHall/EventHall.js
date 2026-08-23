import mongoose, { Schema } from "mongoose";

const eventHallSchema = new Schema({
  hallName:   { type: String, required: true, unique: true },
  capacity:   { type: Number, required: true },
  hourlyRate: { type: Number, required: true },
  amenities:  [{ type: String }],
  status: {
    type:    String,
    enum:    ["available", "booked", "maintenance"],
    default: "available",
  },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

const EventHall = mongoose.model("EventHall", eventHallSchema);

export default EventHall;
