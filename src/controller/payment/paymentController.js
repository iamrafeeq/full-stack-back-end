import Stripe from "stripe";
import Booking from "../../models/Booking/Booking.js";
import Payment from "../../models/Payment/Payment.js";

// Lazy singleton — defers instantiation until first use so that dotenv.config()
// has already run by the time this module's top-level code is evaluated.
let _stripe;
const getStripe = () => {
  if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  return _stripe;
};

// POST /api/payments/create-payment-intent
// Guest initiates online payment; receptionist/admin can act on behalf of a guest
export const createPaymentIntent = async (req, res) => {
  try {
    const { bookingId } = req.body;
    if (!bookingId) {
      return res.status(400).json({ success: false, message: "bookingId is required" });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });

    const isStaff = ["admin", "manager", "receptionist"].includes(req.user.role);
    if (!isStaff && booking.guest.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized to pay this booking" });
    }

    if (booking.paymentStatus === "paid") {
      return res.status(400).json({ success: false, message: "This booking is already paid" });
    }

    // Stripe amounts are in the smallest currency unit (cents for USD).
    // Note: PKR is not supported by Stripe, so USD is used as the currency for
    // demo/test purposes. In production, amounts should be in the actual billing
    // currency agreed with the hotel's Stripe account.
    const amountInCents = Math.round(booking.totalAmount * 100);

    const paymentIntent = await getStripe().paymentIntents.create({
      amount:   amountInCents,
      currency: "usd",
      automatic_payment_methods: { enabled: true },
      metadata: { bookingId: booking._id.toString() },
    });

    return res.status(200).json({ success: true, clientSecret: paymentIntent.client_secret });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/payments/confirm
// Called by the frontend after Stripe.js confirms the card on the client side.
// Server retrieves the intent from Stripe to verify status — never trusts the frontend claim alone.
export const confirmPayment = async (req, res) => {
  try {
    const { bookingId, paymentIntentId, paymentMethod } = req.body;
    if (!bookingId || !paymentIntentId || !paymentMethod) {
      return res.status(400).json({ success: false, message: "bookingId, paymentIntentId, and paymentMethod are required" });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });

    const isStaff = ["admin", "manager", "receptionist"].includes(req.user.role);
    if (!isStaff && booking.guest.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized to confirm payment for this booking" });
    }

    // If the webhook already processed this payment, return the existing record rather than an error
    if (booking.paymentStatus === "paid") {
      const existing = await Payment.findOne({ booking: booking._id });
      return res.status(200).json({ success: true, message: "Payment already recorded", payment: existing });
    }

    // Retrieve the intent from Stripe — server-side source of truth
    const paymentIntent = await getStripe().paymentIntents.retrieve(paymentIntentId);
    if (paymentIntent.status !== "succeeded") {
      return res.status(400).json({ success: false, message: "Payment not completed", stripeStatus: paymentIntent.status });
    }

    // Idempotent create — webhook may have inserted this record between the check above and now
    let payment = await Payment.findOne({ stripePaymentIntentId: paymentIntentId });
    if (!payment) {
      payment = await Payment.create({
        booking:               booking._id,
        amount:                paymentIntent.amount / 100,
        method:                paymentMethod,
        transactionId:         paymentIntent.id,
        stripePaymentIntentId: paymentIntent.id,
        currency:              paymentIntent.currency,
        paidAt:                new Date(),
      });
    }

    booking.paymentStatus = "paid";
    await booking.save();

    return res.status(200).json({ success: true, message: "Payment confirmed", payment });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/payments/booking/:bookingId
export const getPaymentByBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId).select("guest");
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });

    const isStaff = ["admin", "manager", "receptionist"].includes(req.user.role);
    if (!isStaff && booking.guest.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized to view this booking's payment" });
    }

    const payment = await Payment.findOne({ booking: req.params.bookingId });
    if (!payment) return res.status(404).json({ success: false, message: "No payment record found for this booking" });

    return res.status(200).json({ success: true, payment });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/payments  — admin/manager only
export const getAllPayments = async (req, res) => {
  try {
    const filter = {};
    if (req.query.method) filter.method = req.query.method;
    if (req.query.startDate || req.query.endDate) {
      filter.paidAt = {};
      if (req.query.startDate) filter.paidAt.$gte = new Date(req.query.startDate);
      if (req.query.endDate)   filter.paidAt.$lte = new Date(req.query.endDate);
    }

    const payments = await Payment.find(filter)
      .populate({
        path: "booking",
        select: "checkInDate checkOutDate nights totalAmount paymentStatus",
        populate: [
          { path: "room",  select: "roomNumber type" },
          { path: "guest", select: "name email" },
        ],
      })
      .sort({ paidAt: -1 });

    return res.status(200).json({ success: true, count: payments.length, payments });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/payments/webhook  (raw body — set up in index.js before express.json())
// Safety net: Stripe calls this endpoint directly when a payment_intent.succeeded event fires.
// Handles the case where the frontend tab closed or network dropped after Stripe charged the card
// but before the frontend called /confirm.
export const stripeWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    event = getStripe().webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    return res.status(400).json({ message: `Webhook signature verification failed: ${err.message}` });
  }

  if (event.type === "payment_intent.succeeded") {
    const paymentIntent = event.data.object;
    const bookingId = paymentIntent.metadata?.bookingId;
    if (!bookingId) return res.status(200).json({ received: true });

    const booking = await Booking.findById(bookingId);
    if (!booking || booking.paymentStatus === "paid") return res.status(200).json({ received: true });

    const existing = await Payment.findOne({ stripePaymentIntentId: paymentIntent.id });
    if (!existing) {
      await Payment.create({
        booking:               booking._id,
        amount:                paymentIntent.amount / 100,
        method:                "credit_card",
        transactionId:         paymentIntent.id,
        stripePaymentIntentId: paymentIntent.id,
        currency:              paymentIntent.currency,
        paidAt:                new Date(),
      });
    }

    booking.paymentStatus = "paid";
    await booking.save();
  }

  return res.status(200).json({ received: true });
};
