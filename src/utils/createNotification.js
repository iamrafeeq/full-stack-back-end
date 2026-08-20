import Notification from "../models/Notification/Notification.js";

// Non-throwing helper — notifications are non-critical and must never break the calling response.
const createNotification = async (recipientId, type, message, relatedId = null) => {
  try {
    await Notification.create({
      recipient: recipientId,
      type,
      message,
      ...(relatedId ? { relatedId } : {}),
    });
  } catch {
    // Swallow silently — a notification failure must not surface to the caller
  }
};

export default createNotification;
