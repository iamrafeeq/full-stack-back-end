import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import multer from "multer";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:          "hms/rooms",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    resource_type:   "image",
  },
});

const fileFilter = (_req, file, cb) => {
  const ALLOWED_MIME = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  if (ALLOWED_MIME.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(`"${file.originalname}" is not allowed. Only images are accepted (jpg, jpeg, png, webp).`),
      false,
    );
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files:    5,
  },
});

export const uploadRoomImages = (req, res, next) => {
  upload.array("images", 5)(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError) {
      const messages = {
        LIMIT_FILE_SIZE:       "Each image must be 5 MB or smaller.",
        LIMIT_FILE_COUNT:      "You can upload a maximum of 5 images.",
        LIMIT_UNEXPECTED_FILE: "Unexpected field name. Use the field name 'images'.",
      };
      return res.status(400).json({ success: false, message: messages[err.code] || err.message });
    }

    return res.status(400).json({ success: false, message: err.message });
  });
};

export default upload;
