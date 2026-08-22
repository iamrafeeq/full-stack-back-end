import mongoose, { Schema } from "mongoose";

const contactUsSchema = new Schema({
  name:    { type: String, required: true, trim: true },
  email:   { type: String, required: true, trim: true, lowercase: true },
  phone:   { type: String, trim: true },
  subject: { type: String, required: true, trim: true },
  message: { type: String, required: true, trim: true },
}, { timestamps: true });

const ContactUs = mongoose.model("ContactUs", contactUsSchema);

export default ContactUs;
