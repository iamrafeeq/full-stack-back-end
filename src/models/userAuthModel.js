import mongoose, { Schema } from "mongoose";



const userSchema = new Schema (
  {
    name: { type: String, required: true, trim: true },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: { type: String, required: true },

    phone: { type: String, trim: true },
    Date_OF_Birth:{
        type: Date,
    },
    Nationality:{
        type: String,
    },
    Address:{
        type: String,
    },
    CNIC_Passport_Number:{
        type: String,
    },
    role: {
      type: String,
      enum: ["admin", "manager", "receptionist", "housekeeping", "user"],
      default: "user", // public registration always lands here — a guest
    },
    isActive: { type: Boolean, default: true },

    resetPasswordToken:   { type: String,  default: null },
    resetPasswordExpires: { type: Date,    default: null },
  },
  { timestamps: true },
);

export default mongoose.models.User || mongoose.model("User", userSchema);
