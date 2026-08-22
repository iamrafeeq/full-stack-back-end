import express from "express";
import {
  submitContactForm,
  getAllMessages,
  deleteMessage,
} from "../controller/contactUs/contactUsController.js";
import protect          from "../middleware/auth/Authmiddleware.js";
import authenticateRole from "../middleware/roles/roleBase.js";

const ContactRoute = express.Router();

// Public — anyone can submit the contact form
ContactRoute.post("/", submitContactForm);

// Protected — staff only
ContactRoute.get("/",    protect, authenticateRole("admin", "manager", "receptionist"), getAllMessages);
ContactRoute.delete("/:id", protect, authenticateRole("admin"),         deleteMessage);

export default ContactRoute;
