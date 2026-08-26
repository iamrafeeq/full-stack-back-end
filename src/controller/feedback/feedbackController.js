import Feedback from "../../models/Feedback/Feedback.js";
import Booking  from "../../models/Booking/Booking.js";

// POST /api/feedback
export const submitFeedback = async (req, res) => {
  try {
    const { booking: bookingId, rating, comment } = req.body;

    if (!bookingId || rating == null) {
      return res.status(400).json({ success: false, message: "booking and rating are required" });
    }

    const ratingNum = Number(rating);
    if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ success: false, message: "rating must be an integer between 1 and 5" });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    if (booking.guest.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized to submit feedback for this booking" });
    }

    if (booking.status !== "checked-out") {
      return res.status(400).json({ success: false, message: "Feedback can only be submitted after checkout" });
    }

    const existing = await Feedback.findOne({ booking: bookingId });
    if (existing) {
      return res.status(400).json({ success: false, message: "Feedback already submitted for this booking" });
    }

    const feedback = await Feedback.create({
      guest:   req.user._id,
      booking: bookingId,
      rating:  ratingNum,
      comment,
    });

    return res.status(201).json({ success: true, message: "Feedback submitted", feedback });
  } catch (error) {
    // Unique index race: a concurrent insert can still slip past the findOne check
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: "Feedback already submitted for this booking" });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/feedback/stats  (admin / manager)
export const getFeedbackStats = async (req, res) => {
  try {
    const result = await Feedback.aggregate([
      { $group: { _id: null, averageRating: { $avg: "$rating" }, totalFeedbackCount: { $sum: 1 } } },
    ]);

    if (!result.length) {
      return res.status(200).json({ success: true, averageRating: 0, totalFeedbackCount: 0 });
    }

    const { averageRating, totalFeedbackCount } = result[0];
    return res.status(200).json({
      success: true,
      averageRating: parseFloat(averageRating.toFixed(1)),
      totalFeedbackCount,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/feedback/:bookingId
// Guest: own booking only. Admin/manager: any booking.
export const getFeedbackForBooking = async (req, res) => {
  try {
    // Ownership check for guest role — fetch the booking first
    if (req.user.role === "user") {
      const booking = await Booking.findById(req.params.bookingId).select("guest");
      if (!booking) {
        return res.status(404).json({ success: false, message: "Booking not found" });
      }
      if (booking.guest.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, message: "Not authorized to view feedback for this booking" });
      }
    }

    const feedback = await Feedback.findOne({ booking: req.params.bookingId })
      .populate("guest",   "name email")
      .populate("booking", "checkInDate checkOutDate status");

    if (!feedback) {
      return res.status(404).json({ success: false, message: "No feedback found for this booking" });
    }

    return res.status(200).json({ success: true, feedback });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/feedback/room/:roomId  (public — no auth required)
export const getRoomFeedback = async (req, res) => {
  try {
    const bookings = await Booking.find({ room: req.params.roomId }).select("_id");
    const bookingIds = bookings.map((b) => b._id);

    const feedbacks = await Feedback.find({ booking: { $in: bookingIds } })
      .populate("guest", "name")
      .sort({ createdAt: -1 });

    const totalCount = feedbacks.length;
    const averageRating = totalCount
      ? parseFloat((feedbacks.reduce((sum, f) => sum + f.rating, 0) / totalCount).toFixed(1))
      : 0;

    const reviews = feedbacks.map((f) => ({
      rating:    f.rating,
      comment:   f.comment || "",
      guestName: f.guest?.name ? f.guest.name.split(" ")[0] : "Guest",
      createdAt: f.createdAt,
    }));

    return res.status(200).json({ success: true, averageRating, totalCount, reviews });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/feedback  (admin / manager)
export const getAllFeedback = async (req, res) => {
  try {
    const filter = {};
    if (req.query.minRating) {
      const min = Number(req.query.minRating);
      if (!isNaN(min)) filter.rating = { $gte: min };
    }

    const sortOrder = req.query.sort === "oldest" ? { createdAt: 1 } : { createdAt: -1 };

    const feedbacks = await Feedback.find(filter)
      .populate("guest", "name email")
      .populate({
        path:     "booking",
        select:   "checkInDate checkOutDate room",
        populate: { path: "room", select: "roomNumber type" },
      })
      .sort(sortOrder);

    return res.status(200).json({ success: true, feedbacks });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
