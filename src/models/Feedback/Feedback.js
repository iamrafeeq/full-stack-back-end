import mongoose, { Schema } from "mongoose";

const feedbackSchema = new Schema({
  guest:   { type: mongoose.Schema.Types.ObjectId, ref: "User",    required: true },
  booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true, unique: true },
  rating:  { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String },
}, { timestamps: true });

const Feedback = mongoose.model("Feedback", feedbackSchema);

export default Feedback;
