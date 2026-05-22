const express = require("express");
const router = express.Router();
const jalurController = require("../controllers/jalurController");
const mitraMagangController = require("../controllers/mitraMagangController");
const { authenticateToken, authorizeRole } = require("../middlewares/authMiddleware");

// Mahasiswa only - semua endpoint ini hanya untuk mahasiswa

router.get("/status", authenticateToken, authorizeRole("mahasiswa"), jalurController.checkStatusJalur);
router.get("/eligibility", authenticateToken, authorizeRole("mahasiswa"), jalurController.getJalurEligibility);
router.get("/izin-lanjut/status", authenticateToken, authorizeRole("mahasiswa"), jalurController.getIzinLanjutStatus);
router.post("/izin-lanjut", authenticateToken, authorizeRole("mahasiswa"), jalurController.submitIzinLanjutSemester);
router.get(
  "/non-penelitian/magang/mitra",
  authenticateToken,
  authorizeRole("mahasiswa"),
  mitraMagangController.getMitraMagangOptions
);
router.post("/non-penelitian/submit", authenticateToken, authorizeRole("mahasiswa"), jalurController.submitFormNonPenelitian);

// ========== JALUR ULANG - PAMIT ==========
router.post("/ulang/pamit", authenticateToken, authorizeRole("mahasiswa"), jalurController.submitPamit);
router.get("/ulang/status-pamit", authenticateToken, authorizeRole("mahasiswa"), jalurController.getStatusPamit);
router.get("/ulang/history-pamit", authenticateToken, authorizeRole("mahasiswa"), jalurController.getHistoryPamit);

// ========== JALUR BARU ==========
router.post("/baru/topik-dosen", authenticateToken, authorizeRole("mahasiswa"), jalurController.submitBaruTopikDosen);
router.post("/baru/judul-mandiri", authenticateToken, authorizeRole("mahasiswa"), jalurController.submitBaruJudulMandiri);

// ========== JALUR ULANG ==========
router.post("/ulang/topik-dosen", authenticateToken, authorizeRole("mahasiswa"), jalurController.submitUlangTopikDosen);
router.post("/ulang/judul-mandiri", authenticateToken, authorizeRole("mahasiswa"), jalurController.submitUlangJudulMandiri);

// ========== JALUR EKSTENSI ==========
// DIPERBAIKI: Ekstensi menggunakan fungsi pengajuanEkstensi yang sudah ada
// Tidak ada submitEkstensiTopikDosen dan submitEkstensiJudulMandiri
router.post("/ekstensi", authenticateToken, authorizeRole("mahasiswa"), jalurController.pengajuanEkstensi);

module.exports = router;
