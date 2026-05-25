const express = require("express");
const router = express.Router();
const mahasiswaController = require("../controllers/mahasiswaController");
const bimbinganController = require("../controllers/bimbinganController");
const dokumenSidangController = require("../controllers/dokumenSidangController");
const sidangDokumenUpload = require("../middlewares/sidangDokumenUploadMiddleware");
const { authenticateToken, authorizeRole } = require("../middlewares/authMiddleware");

function handleSidangMulterError(err, res) {
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      success: false,
      message: "Ukuran file terlalu besar. Maksimal 10MB.",
    });
  }
  if (err.message && err.message.includes("Hanya PDF, DOC, atau DOCX")) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
  return res.status(400).json({
    success: false,
    message: "Error upload dokumen sidang",
    error: err.message,
  });
}

// ========== ENDPOINT DENGAN AUTHENTICATION ==========

// Get profile lengkap mahasiswa
router.get("/profile", authenticateToken, authorizeRole("mahasiswa"), mahasiswaController.getProfile);

// Update profile mahasiswa
router.put("/update-profile", authenticateToken, authorizeRole("mahasiswa"), mahasiswaController.updateProfile);

// Get current Dosen Pembimbing Akademik
router.get("/dpa/current", authenticateToken, authorizeRole("mahasiswa"), mahasiswaController.getCurrentDPA);

// Change password mahasiswa
router.put("/change-password", authenticateToken, authorizeRole("mahasiswa"), mahasiswaController.changePassword);

// ========== BIMBINGAN SKRIPSI ==========
router.get("/bimbingan", authenticateToken, authorizeRole("mahasiswa"), bimbinganController.getMahasiswaBimbingan);
router.post("/bimbingan", authenticateToken, authorizeRole("mahasiswa"), bimbinganController.createMahasiswaBimbingan);
router.post("/bimbingan/:id/expire", authenticateToken, authorizeRole("mahasiswa"), bimbinganController.expireMahasiswaBimbingan);
router.post("/bimbingan/:id/resume", authenticateToken, authorizeRole("mahasiswa"), bimbinganController.submitResumeMahasiswaBimbingan);

// ========== DOKUMEN SIDANG ==========
router.get(
  "/dokumen-sidang",
  authenticateToken,
  authorizeRole("mahasiswa"),
  dokumenSidangController.getMahasiswaDokumenSidang
);
router.post(
  "/dokumen-sidang/:jenis/upload",
  authenticateToken,
  authorizeRole("mahasiswa"),
  (req, res, next) => {
    sidangDokumenUpload.single("file")(req, res, (err) => {
      if (err) return handleSidangMulterError(err, res);
      return next();
    });
  },
  dokumenSidangController.uploadMahasiswaDokumenSidang
);
router.get(
  "/dokumen-sidang/:jenis/download",
  authenticateToken,
  authorizeRole("mahasiswa"),
  dokumenSidangController.downloadMahasiswaDokumenSidang
);
module.exports = router;
