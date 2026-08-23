import Booking from "../../../models/Booking/Booking.js";
import Invoice from "../../../models/invoice/invoice.js";
import Payment from "../../../models/Payment/Payment.js";

// DELETE /api/bookings/deletebooking/:id  (admin / manager only)
//
// Hard-deletes a booking and its associated invoice + payment records.
// Blocks deletion while the guest is currently checked in — that stay is live.
const deleteBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    if (booking.status === "checked-in") {
      return res.status(400).json({
        success: false,
        message: "Cannot delete an active booking while the guest is checked in.",
      });
    }

    // Cascade-delete related records so no orphans remain
    await Promise.all([
      Invoice.deleteMany({ booking: booking._id }),
      Payment.deleteMany({ booking: booking._id }),
    ]);

    await Booking.findByIdAndDelete(booking._id);

    return res.status(200).json({ success: true, message: "Booking deleted successfully" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export default deleteBooking;
