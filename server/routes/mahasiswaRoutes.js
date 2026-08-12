const express = require("express");
const router = express.Router();
const mahasiswaController = require("../controllers/mahasiswaController");
const bimbinganController = require("../controllers/bimbinganController");
const dokumenSidangController = require("../controllers/dokumenSidangController");
const sidangAkhirController = require("../controllers/sidangAkhirController");
const academicController = require("../controllers/academicController");
const penetapanPembimbingController = require("../controllers/penetapanPembimbingController");
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
router.get("/penetapan-pembimbing", authenticateToken, authorizeRole("mahasiswa"), penetapanPembimbingController.getMySupervisorAssignmentHistory);

// ========== BIMBINGAN SKRIPSI ==========
router.get("/bimbingan/context", authenticateToken, authorizeRole("mahasiswa"), bimbinganController.getMahasiswaGuidanceContext);
router.get("/bimbingan/progress", authenticateToken, authorizeRole("mahasiswa"), bimbinganController.getMahasiswaGuidanceProgress);
router.get("/bimbingan", authenticateToken, authorizeRole("mahasiswa"), bimbinganController.getMahasiswaBimbingan);
router.post("/bimbingan", authenticateToken, authorizeRole("mahasiswa"), bimbinganController.createMahasiswaBimbingan);
router.post("/bimbingan/:id/expire", authenticateToken, authorizeRole("mahasiswa"), bimbinganController.expireMahasiswaBimbingan);
router.post("/bimbingan/:id/resume", authenticateToken, authorizeRole("mahasiswa"), bimbinganController.submitResumeMahasiswaBimbingan);
router.post("/bimbingan/:id/resume-versions", authenticateToken, authorizeRole("mahasiswa"), bimbinganController.submitResumeMahasiswaBimbingan);

// ========== DOKUMEN SIDANG ==========
router.get("/dokumen/persyaratan-sidang", authenticateToken, authorizeRole("mahasiswa"), academicController.getMyPenjaluranSidangRequirement);
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

// ========== PENDAFTARAN SIDANG AKHIR ==========
router.get(
  "/sidang/periode",
  authenticateToken,
  authorizeRole("mahasiswa"),
  sidangAkhirController.getMahasiswaSidangPeriods
);
router.get(
  "/sidang/periode/:id",
  authenticateToken,
  authorizeRole("mahasiswa"),
  sidangAkhirController.getMahasiswaSidangPeriodDetail
);
router.get(
  "/sidang/status",
  authenticateToken,
  authorizeRole("mahasiswa"),
  sidangAkhirController.getMahasiswaSidangStatus
);
router.post(
  "/sidang/daftar",
  authenticateToken,
  authorizeRole("mahasiswa"),
  sidangAkhirController.registerMahasiswaSidang
);
module.exports = router;
