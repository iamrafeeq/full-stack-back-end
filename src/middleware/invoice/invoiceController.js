// controllers/invoiceController.js
const Invoice = require('../models/Invoice');
const Booking = require('../models/Booking');

// Called internally from checkOutBooking, or as its own endpoint
const generateInvoice = async (req, res) => {
  try {
    const { bookingId, extraCharges = [] } = req.body;

    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    const existing = await Invoice.findOne({ booking: bookingId });
    if (existing) return res.status(400).json({ message: "Invoice already exists for this booking" });

    const extraTotal = extraCharges.reduce((sum, c) => sum + c.amount, 0);
    const totalAmount = booking.totalAmount + extraTotal;

    const invoice = await Invoice.create({
      booking: bookingId,
      guest: booking.guest,
      roomCharge: booking.totalAmount,
      extraCharges,
      totalAmount
    });

    res.status(201).json(invoice);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getInvoices = async (req, res) => {
  try {
    const filter = req.user.role === 'guest' ? { guest: req.user.id } : {};
    const invoices = await Invoice.find(filter)
      .populate('guest', 'name email')
      .populate('booking', 'checkInDate checkOutDate nights')
      .sort({ createdAt: -1 });

    res.status(200).json(invoices);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getInvoiceById = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('guest', 'name email')
      .populate('booking', 'checkInDate checkOutDate nights');

    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    if (req.user.role === 'guest' && invoice.guest._id.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized to view this invoice" });
    }

    res.status(200).json(invoice);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const markInvoicePaid = async (req, res) => {
  try {
    const invoice = await Invoice.findByIdAndUpdate(
      req.params.id,
      { paymentStatus: 'paid' },
      { new: true }
    );
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    res.status(200).json({ message: "Invoice marked as paid", invoice });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
  
};

module.exports = { generateInvoice, getInvoices, getInvoiceById, markInvoicePaid };