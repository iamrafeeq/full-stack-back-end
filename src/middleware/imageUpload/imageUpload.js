import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// Absolute path: back-end/uploads/rooms/
const UPLOAD_DIR = join(__dirname, "../../../uploads/rooms");

// Create the folder if it does not exist yet (runs once on server start)
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ── Allowed image MIME types — no video, no PDF, no binary files ────────────
const ALLOWED_MIME = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
];

// ── Disk storage — files saved to back-end/uploads/rooms/ ──────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),

  // Unique filename: timestamp + 6-digit random number + original extension
  filename: (_req, file, cb) => {
    const ext      = path.extname(file.originalname).toLowerCase();
    const unique   = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
    cb(null, `${unique}${ext}`);
  },  
});

// ── File type guard 
const fileFilter = (_req, file, cb) => {
  if (ALLOWED_MIME.includes(file.mimetype)) {
    cb(null, true); // accept
  } else {
    // Reject with a clear message — multer will surface this as an error
    cb(
      new Error(
        `"${file.originalname}" is not allowed. Only images are accepted (jpg, jpeg, png, webp, gif).`
      ),
      false
    );
  }
};

// ── Multer instance ─────────────────────────────────────────────────────────
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB max per image
    files:    5,                // max 5 images per request
  },
});

// ── Error-handling wrapper ──────────────────────────────────────────────────
// Use this in routes instead of upload.array() directly so that multer errors
// (wrong file type, file too large, too many files) are returned as JSON
// instead of crashing the request.
export const uploadRoomImages = (req, res, next) => {
  upload.array("images", 5)(req, res, (err) => {
    if (!err) return next(); // no error — proceed to the controller

    if (err instanceof multer.MulterError) {
      // Built-in multer errors (size / count limits)
      const messages = {
        LIMIT_FILE_SIZE:  "Each image must be 5 MB or smaller.",
        LIMIT_FILE_COUNT: "You can upload a maximum of 5 images.",
        LIMIT_UNEXPECTED_FILE: "Unexpected field name. Use the field name 'images'.",
      };
      return res
        .status(400)
        .json({ success: false, message: messages[err.code] || err.message });
    }

    // Custom error from fileFilter (wrong file type)
    return res.status(400).json({ success: false, message: err.message });
  });
};

export default upload;
