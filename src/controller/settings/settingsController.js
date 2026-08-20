import Settings from "../../models/Settings/Settings.js";

// GET /api/settings  — any authenticated user
export const getSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({});
    }
    return res.status(200).json({ success: true, settings });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/settings  — admin only
export const updateSettings = async (req, res) => {
  try {
    const { taxPercentage, cancellationPolicy, checkInTime, checkOutTime } = req.body;
    const updates = {};
    if (taxPercentage      != null) updates.taxPercentage      = taxPercentage;
    if (cancellationPolicy != null) updates.cancellationPolicy = cancellationPolicy;
    if (checkInTime        != null) updates.checkInTime        = checkInTime;
    if (checkOutTime       != null) updates.checkOutTime       = checkOutTime;

    const settings = await Settings.findOneAndUpdate(
      {},
      { $set: updates },
      { new: true, upsert: true, runValidators: true },
    );
    return res.status(200).json({ success: true, message: "Settings updated", settings });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
