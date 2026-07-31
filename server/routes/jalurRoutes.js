const express = require("express");
const router = express.Router();
const jalurController = require("../controllers/jalurController");
const changeController = require("../controllers/penjaluranChangeController");
const mitraMagangController = require("../controllers/mitraMagangController");
const { authenticateToken, authorizeRole } = require("../middlewares/authMiddleware");
const nonPenelitianUpload = require("../middlewares/nonPenelitianUploadMiddleware");

const nonPenelitianUploadFields = nonPenelitianUpload.fields([
  { name: "bukti_apply_file_name", maxCount: 1 },
  { name: "cv_file_name", maxCount: 1 },
  { name: "portfolio_file_name", maxCount: 1 },
  { name: "transcript_file_name", maxCount: 1 },
  { name: "other_supporting_documents_file_name", maxCount: 1 },
  { name: "supporting_documents_note", maxCount: 1 },
  { name: "dokumen_pendukung_file", maxCount: 1 },
]);

const handleNonPenelitianUpload = (req, res, next) => {
  nonPenelitianUploadFields(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    res.status(400).json({
      success: false,
      message: error.message || "Upload dokumen tidak valid.",
    });
  });
};

// Mahasiswa only - semua endpoint ini hanya untuk mahasiswa

router.get("/status", authenticateToken, authorizeRole("mahasiswa"), jalurController.checkStatusJalur);
router.get("/eligibility", authenticateToken, authorizeRole("mahasiswa"), jalurController.getJalurEligibility);
router.get("/change/eligibility", authenticateToken, authorizeRole("mahasiswa"), changeController.getEligibility);
router.post("/change/pamit", authenticateToken, authorizeRole("mahasiswa"), changeController.submitPamit);
router.get("/change/pamit/:id", authenticateToken, authorizeRole("mahasiswa"), changeController.getPamit);
router.get("/change/history", authenticateToken, authorizeRole("mahasiswa"), changeController.getHistory);
router.get("/izin-lanjut/status", authenticateToken, authorizeRole("mahasiswa"), jalurController.getIzinLanjutStatus);
router.post("/izin-lanjut", authenticateToken, authorizeRole("mahasiswa"), jalurController.submitIzinLanjutSemester);
router.get(
  "/non-penelitian/magang/mitra",
  authenticateToken,
  authorizeRole("mahasiswa"),
  mitraMagangController.getMitraMagangOptions
);
router.post(
  "/non-penelitian/submit",
  authenticateToken,
  authorizeRole("mahasiswa"),
  handleNonPenelitianUpload,
  jalurController.submitFormNonPenelitian
);

// ========== JALUR ULANG - PAMIT ==========
router.post("/ulang/pamit", authenticateToken, authorizeRole("mahasiswa"), changeController.submitPamit);
router.get("/ulang/status-pamit", authenticateToken, authorizeRole("mahasiswa"), changeController.getLegacyPamitStatus);
router.get("/ulang/history-pamit", authenticateToken, authorizeRole("mahasiswa"), changeController.getLegacyPamitHistory);

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
