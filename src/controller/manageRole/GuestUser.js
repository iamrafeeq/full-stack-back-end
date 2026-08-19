import User from "../../models/userAuthModel.js";

export const GuestUser = async (req, res) => {
  try {
    const allUsers = await User.find().select("-password");
    res.status(200).json({ message: "All users fetched successfully", users: allUsers });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

export const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const user = await User.findByIdAndUpdate(id, { isActive }, { new: true }).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json({ message: `User ${isActive ? "activated" : "deactivated"}`, user });
  } catch (error) {
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

export const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const validRoles = ["admin", "manager", "receptionist", "housekeeping", "user"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const user = await User.findByIdAndUpdate(id, { role }, { new: true }).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json({ message: "Role updated", user });
  } catch (error) {
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};
