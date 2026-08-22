import ContactUs from "../../models/contactUs/contactUs.js";

// POST /api/contact  — public, no auth required
export const submitContactForm = async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
      return res.status(400).json({ success: false, message: "name, email, subject, and message are required" });
    }

    const contact = await ContactUs.create({ name, email, phone, subject, message });

    return res.status(201).json({ success: true, message: "Your message has been received. We will get back to you shortly.", contact });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/contact  — admin / manager only
export const getAllMessages = async (req, res) => {
  try {
    const messages = await ContactUs.find().sort({ createdAt: -1 });
    return res.status(200).json({ success: true, count: messages.length, messages });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/contact/:id  — admin only
export const deleteMessage = async (req, res) => {
  try {
    const message = await ContactUs.findByIdAndDelete(req.params.id);
    if (!message) return res.status(404).json({ success: false, message: "Message not found" });
    return res.status(200).json({ success: true, message: "Message deleted" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
