const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadDir = path.resolve(__dirname, "..", "uploads", "sidang-dokumen");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const docType = String(req.params?.jenis || "dokumen").toLowerCase();
    const mahasiswaId = String(req.user?.id || "unknown");
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${docType}-${mahasiswaId}-${unique}${ext}`);
  },
});

const allowedMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const allowedExtensions = new Set([".pdf", ".doc", ".docx"]);

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || "").toLowerCase();
  const mime = String(file.mimetype || "").toLowerCase();
  if (allowedExtensions.has(ext) || allowedMimeTypes.has(mime)) {
    cb(null, true);
    return;
  }

  cb(new Error("File tidak valid. Hanya PDF, DOC, atau DOCX yang diperbolehkan."), false);
};

const sidangDokumenUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
  },
});

module.exports = sidangDokumenUpload;

