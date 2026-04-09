const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const uploadController = require("../controllers/uploadController");
const upload = require("../middlewares/uploadMiddleware");
const { authenticateToken, authorizeRole } = require("../middlewares/authMiddleware");

// ========== MAHASISWA MANAGEMENT ==========

// Get all mahasiswa
router.get("/mahasiswa", authenticateToken, authorizeRole("admin"), adminController.getAllMahasiswa);

// Assign DPA
router.put("/mahasiswa/:id/assign-dospem-akademik", authenticateToken, authorizeRole("admin"), adminController.assignDosenPembimbingAkademik);

// Update status jalur
router.put("/mahasiswa/:id/update-status", authenticateToken, authorizeRole("admin"), adminController.updateStatusJalur);

// ========== UPLOAD MAHASISWA (EXCEL) ==========

// Download template Excel Mahasiswa
router.get("/upload/mahasiswa-template", uploadController.downloadMahasiswaTemplate);

// Upload Excel mahasiswa (Admin only)
router.post(
  "/upload/mahasiswa",
  authenticateToken,
  authorizeRole("admin"),
  (req, res, next) => {
    // Wrapper untuk handle multer errors
    upload.single("file")(req, res, (err) => {
      if (err) {
        console.error("❌ Multer Error:", err.message);
        return res.status(400).json({
          success: false,
          message: "Error pada file upload",
          error: err.message,
        });
      }
      // Jika tidak ada error, lanjut ke controller
      next();
    });
  },
  uploadController.uploadMahasiswa
);

// ========== PENGAJUAN MANAGEMENT ==========

// Get all pengajuan
router.get("/pengajuan", authenticateToken, authorizeRole("admin"), adminController.getAllPengajuan);

// ========== DASHBOARD STATISTICS ==========

// Get statistics
router.get("/statistics", authenticateToken, authorizeRole("admin"), adminController.getStatistics);

// ========== KUOTA DOSEN MANAGEMENT ==========

// Monitor semua kuota dosen
router.get("/dosen/kuota-overview", authenticateToken, authorizeRole("admin"), adminController.getKuotaOverview);

// Get detail kuota dosen
router.get("/dosen/:id/kuota", authenticateToken, authorizeRole("admin"), adminController.getKuotaDosenDetail);

// Set kuota dosen (override)
router.put("/dosen/:id/kuota", authenticateToken, authorizeRole("admin"), adminController.setKuotaDosen);

module.exports = router;
