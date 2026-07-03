const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadDir = process.env.VERCEL
  ? path.join("/tmp", "sima-uploads", "non-penelitian")
  : path.resolve(__dirname, "..", "uploads", "non-penelitian");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, uploadDir);
  },
  filename(req, file, cb) {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname || "");
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

const allowedExtensions = [".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png", ".zip", ".rar"];
const allowedMimePrefixes = ["application/", "image/"];

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || "").toLowerCase();
  const mimetype = String(file.mimetype || "").toLowerCase();

  if (allowedExtensions.includes(ext) && allowedMimePrefixes.some((prefix) => mimetype.startsWith(prefix))) {
    cb(null, true);
    return;
  }

  cb(new Error("File dokumen harus berformat PDF, DOC, DOCX, JPG, PNG, ZIP, atau RAR."), false);
};

const nonPenelitianUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

module.exports = nonPenelitianUpload;
