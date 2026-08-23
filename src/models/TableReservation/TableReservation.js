import mongoose, { Schema } from "mongoose";

const tableReservationSchema = new Schema({
  guest:           { type: mongoose.Schema.Types.ObjectId, ref: "User",  required: true },
  table:           { type: mongoose.Schema.Types.ObjectId, ref: "Table", required: true },
  reservationDate: { type: Date,   required: true },
  reservationTime: { type: String, required: true },
  durationMinutes: { type: Number, default: 90 },
  partySize:       { type: Number, required: true },
  status: {
    type:    String,
    enum:    ["reserved", "seated", "completed", "cancelled"],
    default: "reserved",
  },
  specialRequests: { type: String },
}, { timestamps: true });

const TableReservation = mongoose.model("TableReservation", tableReservationSchema);

export default TableReservation;
