import mongoose, { Schema } from "mongoose";

const eventHallBookingSchema = new Schema({
  guest:       { type: mongoose.Schema.Types.ObjectId, ref: "User",      required: true },
  hall:        { type: mongoose.Schema.Types.ObjectId, ref: "EventHall", required: true },
  eventDate:   { type: Date,   required: true },
  startTime:   { type: String, required: true },
  endTime:     { type: String, required: true },
  eventType: {
    type:     String,
    enum:     ["wedding", "conference", "birthday", "corporate", "other"],
    required: true,
  },
  guestCount:     { type: Number, required: true },
  totalAmount:    { type: Number, required: true },
  status: {
    type:    String,
    enum:    ["booked", "confirmed", "in-progress", "completed", "cancelled"],
    default: "booked",
  },
  paymentStatus: {
    type:    String,
    enum:    ["pending", "paid"],
    default: "pending",
  },
  specialRequests: { type: String },
}, { timestamps: true });

const EventHallBooking = mongoose.model("EventHallBooking", eventHallBookingSchema);

export default EventHallBooking;
