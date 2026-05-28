const express = require("express");
const router = express.Router();
const uploadController = require("../controllers/uploadController");
const upload = require("../middlewares/uploadMiddleware");
const { authenticateToken, authorizeRole } = require("../middlewares/authMiddleware");

function handleUploadMulterError(err, res) {
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      success: false,
      message: "Ukuran file terlalu besar. Maksimal 5MB.",
      error: err.message,
    });
  }

  if (err.message && err.message.toLowerCase().includes("format excel")) {
    return res.status(400).json({
      success: false,
      message: "File tidak valid. Hanya file Excel (.xls, .xlsx, .ods) yang diperbolehkan.",
      error: err.message,
    });
  }

  return res.status(400).json({
    success: false,
    message: "Error pada file upload",
    error: err.message,
  });
}

// ========== DOSEN ROUTES (ADMIN ONLY) ==========

router.get("/dosen-template", uploadController.downloadDosenTemplate);

router.post(
  "/dosen",
  authenticateToken,
  authorizeRole("admin"),
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err) {
        console.error("Multer Error:", err.message);
        return handleUploadMulterError(err, res);
      }
      next();
    });
  },
  uploadController.uploadDosen
);

// ========== TOPIK ROUTES ==========

router.get("/template", uploadController.downloadTemplate);

router.post(
  "/topics",
  authenticateToken,
  authorizeRole("admin", "dosen", "sekretaris_prodi"),
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err) {
        console.error("Multer Error:", err.message);
        return handleUploadMulterError(err, res);
      }
      next();
    });
  },
  uploadController.uploadTopics
);

router.post(
  "/topics/preview",
  authenticateToken,
  authorizeRole("admin", "dosen", "sekretaris_prodi"),
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err) {
        console.error("Multer Error:", err.message);
        return handleUploadMulterError(err, res);
      }
      next();
    });
  },
  uploadController.previewUploadTopics
);

router.post(
  "/topics/commit",
  authenticateToken,
  authorizeRole("admin", "dosen", "sekretaris_prodi"),
  uploadController.commitUploadTopics
);

// ========== MAHASISWA ROUTES (ADMIN ONLY) ==========

router.get("/mahasiswa-template", uploadController.downloadMahasiswaTemplate);

router.post(
  "/mahasiswa",
  authenticateToken,
  authorizeRole("admin"),
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err) {
        console.error("Multer Error:", err.message);
        return handleUploadMulterError(err, res);
      }
      next();
    });
  },
  uploadController.uploadMahasiswa
);

module.exports = router;
