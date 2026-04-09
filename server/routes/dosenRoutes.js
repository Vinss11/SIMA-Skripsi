const express = require("express");
const router = express.Router();
const dosenController = require("../controllers/dosenController");
const submissionController = require("../controllers/submissionController");
const { authenticateToken, authorizeRole } = require("../middlewares/authMiddleware");

// ========== PENGAJUAN SUBMISSIONS ==========
// Dosen mereview pengajuan yang ditujukan kepadanya
router.get("/submissions", authenticateToken, authorizeRole("dosen"), dosenController.getDosenSubmissions);
router.get("/submissions/:id", authenticateToken, authorizeRole("dosen"), submissionController.getSubmissionById);
router.post("/submissions/:id/approve", authenticateToken, authorizeRole("dosen"), dosenController.approveSubmission);
router.post("/submissions/:id/reject", authenticateToken, authorizeRole("dosen"), dosenController.rejectSubmission);

// ========== PAMIT MAHASISWA (DOSEN PEMBIMBING - READ ONLY) ==========
// Dosen pembimbing skripsi melihat pamit mahasiswa bimbingannya (hanya lihat, tidak bisa approve/reject)
router.get("/pamit-mahasiswa", authenticateToken, authorizeRole("dosen"), dosenController.getPamitMahasiswa);
router.get("/pamit-mahasiswa/:id", authenticateToken, authorizeRole("dosen"), dosenController.getPamitMahasiswaDetail);

// ========== PAMIT ULANG (DPA - CAN APPROVE/REJECT) ==========
// Dosen (sebagai DPA) mereview pamit mahasiswa bimbingan akademiknya
router.get("/pamit-dpa", authenticateToken, authorizeRole("dosen"), dosenController.getPamitDPA);
router.get("/pamit-dpa/:id", authenticateToken, authorizeRole("dosen"), dosenController.getPamitDPADetail);
router.post("/pamit-dpa/:id/approve", authenticateToken, authorizeRole("dosen"), dosenController.approvePamitDPA);
router.post("/pamit-dpa/:id/reject", authenticateToken, authorizeRole("dosen"), dosenController.rejectPamitDPA);

// ========== DOSEN KUOTA ==========
router.get("/kuota", authenticateToken, authorizeRole("dosen"), dosenController.getKuotaSendiri);

module.exports = router;
