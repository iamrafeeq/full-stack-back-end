// models/Room.js

import mongoose, { Schema } from "mongoose";




const roomSchema = new Schema({
  roomNumber: { type: String, required: true, unique: true },

  type: {
    type: String,
    enum: ['single', 'double', 'deluxe', 'suite'],
    required: true
  },

  floor: { type: Number, required: true },
  capacity: { type: Number, required: true },

  bedType: {
    type: String,
    enum: ['single', 'twin', 'queen', 'king'],
    required: true
  },

  price: { type: Number, required: true, min: 0 },
  discountPrice: { type: Number, min: 0 },

  amenities: [{ type: String }],

  smokingAllowed: { type: Boolean, default: false },

  description: { type: String },
  images: [{ type: String }],

  status: {
    type: String,
    enum: ['available', 'reserved', 'occupied', 'cleaning', 'maintenance'],
    default: 'available'
  },

  isActive: { type: Boolean, default: true }
}, { timestamps: true });

const Room = mongoose.model("Room", roomSchema);

export default Room;