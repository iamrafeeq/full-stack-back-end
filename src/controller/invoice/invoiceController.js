import PDFDocument from "pdfkit";
import Invoice from "../../models/invoice/invoice.js";
import Payment from "../../models/Payment/Payment.js";

// GET /api/invoices/  — admin/manager/receptionist see all; "user" sees own only
export const getInvoices = async (req, res) => {
  try {
    const filter = req.user.role === "user" ? { guest: req.user._id } : {};

    const invoices = await Invoice.find(filter)
      .populate("guest", "name email")
      .populate({
        path: "booking",
        select: "checkInDate checkOutDate nights totalAmount paymentStatus",
        populate: { path: "room", select: "roomNumber type" },
      })
      .sort({ createdAt: -1 });

    // Batch-fetch payments for all booking IDs in one query, then attach per invoice
    const bookingIds = invoices.map((inv) => inv.booking?._id).filter(Boolean);
    const payments = await Payment.find({ booking: { $in: bookingIds } }).select("booking method paidAt");
    const paymentMap = {};
    payments.forEach((p) => { paymentMap[p.booking.toString()] = { method: p.method, paidAt: p.paidAt }; });

    const result = invoices.map((inv) => ({
      ...inv.toObject(),
      paymentDetails: paymentMap[inv.booking?._id?.toString()] ?? null,
    }));

    return res.status(200).json({ success: true, invoices: result });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/invoices/:id
export const getInvoiceById = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate("guest", "name email")
      .populate({
        path: "booking",
        select: "checkInDate checkOutDate nights totalAmount paymentStatus",
        populate: { path: "room", select: "roomNumber type" },
      });

    if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });

    if (req.user.role === "user" && invoice.guest._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized to view this invoice" });
    }

    const payment = await Payment.findOne({ booking: invoice.booking._id }).select("method paidAt");
    const paymentDetails = payment ? { method: payment.method, paidAt: payment.paidAt } : null;

    return res.status(200).json({ success: true, invoice, paymentDetails });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/invoices/:id/download  — streams a one-page PDF
export const downloadInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate("guest", "name email")
      .populate({
        path: "booking",
        select: "checkInDate checkOutDate nights totalAmount paymentStatus",
        populate: { path: "room", select: "roomNumber type" },
      });

    if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });

    if (req.user.role === "user" && invoice.guest._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized to download this invoice" });
    }

    const b = invoice.booking;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="invoice-${invoice._id}.pdf"`);

    const doc = new PDFDocument({ margin: 50, size: "A4" });
    doc.pipe(res);

    // ── Header ─────────────────────────────────────────────────────────────────
    doc.fontSize(22).font("Helvetica-Bold").text("LuxuryStay Hospitality", { align: "center" });
    doc.fontSize(11).font("Helvetica").text("Invoice", { align: "center" });
    doc.moveDown(0.4);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#cccccc").stroke();
    doc.moveDown(0.8);

    // ── Invoice meta ───────────────────────────────────────────────────────────
    doc.fontSize(9).fillColor("#555555");
    doc.text(`Invoice ID : ${invoice._id}`);
    doc.text(`Issued     : ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}`);
    doc.moveDown(0.8);

    // ── Guest ──────────────────────────────────────────────────────────────────
    doc.fontSize(11).font("Helvetica-Bold").fillColor("#000000").text("Guest");
    doc.fontSize(10).font("Helvetica");
    doc.text(`Name  : ${invoice.guest.name}`);
    doc.text(`Email : ${invoice.guest.email}`);
    doc.moveDown(0.8);

    // ── Booking details ────────────────────────────────────────────────────────
    doc.fontSize(11).font("Helvetica-Bold").text("Booking Details");
    doc.fontSize(10).font("Helvetica");
    if (b?.room) {
      doc.text(`Room       : ${b.room.roomNumber}  (${b.room.type})`);
    }
    doc.text(`Check-in   : ${b?.checkInDate  ? new Date(b.checkInDate).toLocaleDateString("en-GB")  : "—"}`);
    doc.text(`Check-out  : ${b?.checkOutDate ? new Date(b.checkOutDate).toLocaleDateString("en-GB") : "—"}`);
    doc.text(`Nights     : ${b?.nights ?? "—"}`);
    doc.moveDown(0.8);

    // ── Charges ────────────────────────────────────────────────────────────────
    doc.fontSize(11).font("Helvetica-Bold").text("Charges");
    doc.fontSize(10).font("Helvetica");
    doc.text(`Room charge   : PKR ${invoice.roomCharge.toFixed(2)}`);

    if (invoice.extraCharges?.length > 0) {
      doc.moveDown(0.3);
      doc.font("Helvetica-Bold").text("Extra charges:");
      doc.font("Helvetica");
      invoice.extraCharges.forEach((c) => {
        doc.text(`  ${c.description} : PKR ${Number(c.amount).toFixed(2)}`);
      });
    }

    doc.moveDown(0.4);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#cccccc").stroke();
    doc.moveDown(0.4);

    doc.fontSize(13).font("Helvetica-Bold")
      .text(`Total Amount : PKR ${invoice.totalAmount.toFixed(2)}`);
    doc.moveDown(0.3);
    doc.fontSize(10).font("Helvetica")
      .text(`Payment Status : ${invoice.paymentStatus.toUpperCase()}`);

    doc.end();
  } catch (error) {
    if (!res.headersSent) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
};
