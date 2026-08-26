
import crypto from "crypto";
import bcrypt from "bcryptjs";
import User from "../models/userAuthModel.js";
import getTokenFromHeader from "../middleware/imageUpload/Authjwt/jwt.js";
import { sendPasswordResetEmail } from "../utils/mailer.js";

 export const createUser = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      phone,
      Date_OF_Birth,
      Nationality,
      Address,
      CNIC_Passport_Number,
    } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and password are required",
      });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User already exists with this email",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      phone,
      Date_OF_Birth,
      Nationality,
      Address,
      CNIC_Passport_Number,
    });

    const userData = user.toObject();
    delete userData.password;

    return res.status(201).json({
      success: true,
      message: "User created successfully",
      user: userData,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to create user",
      error: error.message,
    });
  }
};



 export const loginUser  = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "Invalid email or password" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: "Your account has been deactivated. Please contact support." });
    }

    const token = getTokenFromHeader(user._id);

    const userData = user.toObject();
    delete userData.password;

    res.status(200).json({ message: "Login successful", user: userData, token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error logging in", error: error.message });
  }


}

export const editUserProfile = async (req, res) => {
  try {
    const userId = req.params.id;

    // only the user themselves or an admin can update a profile
    if (req.user._id.toString() !== userId && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access forbidden." });
    }

    const allowedFields = ["name", "phone", "Date_OF_Birth", "Nationality", "Address", "CNIC_Passport_Number"];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    // only admin can change role
    if (req.user.role === "admin" && req.body.role) {
      updates.role = req.body.role;
    }

    const updated = await User.findByIdAndUpdate(userId, updates, { new: true, runValidators: true }).select("-password");

    if (!updated) {
      return res.status(404).json({ message: "User not found." });
    }

    return res.status(200).json({ message: "Profile updated successfully.", user: updated });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update profile.", error: error.message });
  }
};

// POST /api/forgot-password
// Always returns the same message regardless of whether the email exists — no enumeration.
export const forgotPassword = async (req, res) => {
  const GENERIC_MESSAGE = "If that email is registered, a password reset link has been sent.";
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      return res.status(200).json({ success: true, message: GENERIC_MESSAGE });
    }

    // Rate-limit: block a new request if an unexpired token was issued within the last 60 seconds
    if (user.resetPasswordExpires && user.resetPasswordExpires > Date.now()) {
      const issuedAt = user.resetPasswordExpires.getTime() - 15 * 60 * 1000;
      if (Date.now() - issuedAt < 60 * 1000) {
        return res.status(200).json({ success: true, message: GENERIC_MESSAGE });
      }
    }

    // Generate a random token — store only the sha256 hash, send the raw token in the link
    const rawToken    = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

    user.resetPasswordToken   = hashedToken;
    user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    const resetUrl = `${process.env.CLIENT_URL}/reset-password/${rawToken}`;

    try {
      await sendPasswordResetEmail(user.email, resetUrl);
    } catch (mailError) {
      // Token is already saved — log the failure but don't expose it as a 500.
      // The user can request again once SMTP is configured.
      console.error("Password reset email failed:", mailError.message);
    }

    return res.status(200).json({ success: true, message: GENERIC_MESSAGE });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to process request", error: error.message });
  }
};

// POST /api/reset-password
export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ success: false, message: "Token and newPassword are required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      resetPasswordToken:   hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ success: false, message: "Reset link is invalid or has expired." });
    }

    user.password             = await bcrypt.hash(newPassword, 10);
    user.resetPasswordToken   = null;
    user.resetPasswordExpires = null;
    await user.save();

    return res.status(200).json({ success: true, message: "Password reset successfully. You can now log in." });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to reset password", error: error.message });
  }
};

// get single user data

export const getUserProfile = async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.findById(userId).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching user profile", error: error.message });
  }
}




