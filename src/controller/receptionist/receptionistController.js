import User    from "../../models/userAuthModel.js";
import Booking from "../../models/Booking/Booking.js";

// GET /api/receptionist/guests?search=<query>
// Returns id, name, email, phone for users with role "user" matching the search term.
export const searchGuests = async (req, res) => {
  try {
    const { search } = req.query;

    const filter = { role: "user" };
    if (search) {
      filter.$or = [
        { name:  { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const guests = await User.find(filter)
      .select("name email phone")
      .limit(50)
      .sort({ name: 1 });

    return res.status(200).json({ success: true, guests });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/receptionist/today
// Arrivals: bookings with checkInDate = today and status 'booked'
// Departures: bookings with checkOutDate = today and status 'checked-in'
export const getTodayActivity = async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const populate = [
      { path: "guest", select: "name email phone" },
      { path: "room",  select: "roomNumber type" },
    ];

    const [arrivals, departures] = await Promise.all([
      Booking.find({
        checkInDate: { $gte: startOfDay, $lte: endOfDay },
        status: "booked",
      }).populate(populate),
      Booking.find({
        checkOutDate: { $gte: startOfDay, $lte: endOfDay },
        status: "checked-in",
      }).populate(populate),
    ]);

    return res.status(200).json({ success: true, arrivals, departures });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
