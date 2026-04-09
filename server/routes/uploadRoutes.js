const express = require("express");
const router = express.Router();
const uploadController = require("../controllers/uploadController");
const upload = require("../middlewares/uploadMiddleware");
const { authenticateToken, authorizeRole } = require("../middlewares/authMiddleware");

// ========== DOSEN ROUTES (ADMIN ONLY) ==========

// Download template Excel Dosen
router.get("/dosen-template", uploadController.downloadDosenTemplate);

// Upload Excel dosen (Admin only)
router.post(
  "/dosen",
  authenticateToken,
  authorizeRole("admin"),
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err) {
        console.error("❌ Multer Error:", err.message);
        return res.status(400).json({
          success: false,
          message: "Error pada file upload",
          error: err.message,
        });
      }
      next();
    });
  },
  uploadController.uploadDosen
);

// ========== TOPIK ROUTES ==========

// Download template Excel Topik
router.get("/template", uploadController.downloadTemplate);

// Upload Excel topik (Admin only)
router.post(
  "/topics",
  authenticateToken,
  authorizeRole("admin"),
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err) {
        console.error("❌ Multer Error:", err.message);
        return res.status(400).json({
          success: false,
          message: "Error pada file upload",
          error: err.message,
        });
      }
      next();
    });
  },
  uploadController.uploadTopics
);

// ========== MAHASISWA ROUTES (ADMIN ONLY) ==========

// Download template Excel Mahasiswa
router.get("/mahasiswa-template", uploadController.downloadMahasiswaTemplate);

// Upload Excel mahasiswa (Admin only)
router.post(
  "/mahasiswa",
  authenticateToken,
  authorizeRole("admin"),
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err) {
        console.error("❌ Multer Error:", err.message);
        return res.status(400).json({
          success: false,
          message: "Error pada file upload",
          error: err.message,
        });
      }
      next();
    });
  },
  uploadController.uploadMahasiswa
);

module.exports = router;
