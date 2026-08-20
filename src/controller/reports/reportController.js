import Room    from "../../models/rooms/rooms.js";
import Booking from "../../models/Booking/Booking.js";
import Invoice from "../../models/invoice/invoice.js";

// GET /api/reports/dashboard?startDate=&endDate=
export const getDashboardStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // ── Room stats ──────────────────────────────────────────────────────────
    const [totalRooms, occupiedRooms] = await Promise.all([
      Room.countDocuments(),
      Room.countDocuments({ status: "occupied" }),
    ]);

    const occupancyRate =
      totalRooms === 0
        ? 0
        : parseFloat(((occupiedRooms / totalRooms) * 100).toFixed(1));

    // ── Booking counts grouped by status ────────────────────────────────────
    const bookingCounts = await Booking.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $sort:  { _id: 1 } },
    ]);

    // ── Revenue from paid invoices (optional date range on booking.checkOutDate) ──
    // Start with match on paymentStatus so the pipeline discards unpaid docs early.
    const revenuePipeline = [
      { $match: { paymentStatus: "paid" } },
    ];

    if (startDate || endDate) {
      const checkOutFilter = {};
      if (startDate) checkOutFilter.$gte = new Date(startDate);
      if (endDate)   checkOutFilter.$lte = new Date(endDate);

      revenuePipeline.push(
        // Join with the bookings collection to access checkOutDate
        {
          $lookup: {
            from:         "bookings",   // MongoDB collection name (Mongoose lowercases "Booking")
            localField:   "booking",
            foreignField: "_id",
            as:           "bookingData",
          },
        },
        { $unwind: "$bookingData" },
        { $match: { "bookingData.checkOutDate": checkOutFilter } },
      );
    }

    revenuePipeline.push(
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    );

    const revenueResult = await Invoice.aggregate(revenuePipeline);
    const totalRevenue  = revenueResult[0]?.total ?? 0;

    return res.status(200).json({
      success: true,
      totalRooms,
      occupiedRooms,
      occupancyRate,
      bookingCounts,
      totalRevenue,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
