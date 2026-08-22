import mongoose, { Schema } from "mongoose";

const paymentSchema = new Schema(
  {
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true },
    amount:  { type: Number, required: true },
    method: {
      type: String,
      enum: ["credit_card", "debit_card", "easypaisa", "jazzcash", "bank_transfer", "cash"],
      required: true,
    },
    transactionId:          { type: String },
    stripePaymentIntentId:  { type: String },
    currency:               { type: String, default: "usd" },
    paidAt:                 { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const Payment = mongoose.model("Payment", paymentSchema);
export default Payment;
