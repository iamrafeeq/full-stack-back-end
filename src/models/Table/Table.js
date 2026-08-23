import mongoose, { Schema } from "mongoose";

const tableSchema = new Schema({
  tableNumber: { type: String, required: true, unique: true },
  capacity:    { type: Number, required: true },
  location: {
    type:    String,
    enum:    ["indoor", "outdoor", "private-room"],
    default: "indoor",
  },
  status: {
    type:    String,
    enum:    ["available", "reserved", "occupied", "cleaning"],
    default: "available",
  },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

const Table = mongoose.model("Table", tableSchema);

export default Table;
