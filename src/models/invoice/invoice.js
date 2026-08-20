// models/Invoice.js

import mongoose, { Schema } from "mongoose";


const invoiceSchema = new  Schema({
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  guest: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  roomCharge: { type: Number, required: true },
  extraCharges: [{
    description: String,
    amount: Number
  }],
  taxPercentage: { type: Number, default: 0 },
  taxAmount:     { type: Number, default: 0 },
  totalAmount: { type: Number, required: true },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid'],
    default: 'pending',
  }
}, { timestamps: true });

const invoiceModel = mongoose.model("invoice", invoiceSchema);

export default invoiceModel;