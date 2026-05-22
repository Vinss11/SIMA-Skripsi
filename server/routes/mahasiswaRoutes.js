const express = require("express");
const router = express.Router();
const mahasiswaController = require("../controllers/mahasiswaController");
const bimbinganController = require("../controllers/bimbinganController");
const { authenticateToken, authorizeRole } = require("../middlewares/authMiddleware");

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
router.post("/bimbingan/:id/resume", authenticateToken, authorizeRole("mahasiswa"), bimbinganController.submitResumeMahasiswaBimbingan);
module.exports = router;
