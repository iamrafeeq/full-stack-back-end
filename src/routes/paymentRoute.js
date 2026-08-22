import express from "express";
import {
  createPaymentIntent,
  confirmPayment,
  getPaymentByBooking,
  getAllPayments,
} from "../controller/payment/paymentController.js";
import protect          from "../middleware/auth/Authmiddleware.js";
import authenticateRole from "../middleware/roles/roleBase.js";

const PaymentRoute = express.Router();

// /api/payments/webhook is registered directly in index.js with express.raw() before express.json()
// so it is intentionally absent from this router.

// Stripe online payment flow
PaymentRoute.post("/create-payment-intent", protect, createPaymentIntent);
PaymentRoute.post("/confirm",               protect, confirmPayment);

// Payment visibility
PaymentRoute.get("/booking/:bookingId", protect, getPaymentByBooking);
PaymentRoute.get("/",                   protect, authenticateRole("admin", "manager"), getAllPayments);

export default PaymentRoute;
