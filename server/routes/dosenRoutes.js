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

// ========== PAMIT MAHASISWA (DOSEN PEMBIMBING SKRIPSI) ==========
// Dosen pembimbing skripsi mereview pamit mahasiswa bimbingannya (approve/reject tahap 1)
router.get("/pamit-mahasiswa", authenticateToken, authorizeRole("dosen"), dosenController.getPamitMahasiswa);
router.get("/pamit-mahasiswa/:id", authenticateToken, authorizeRole("dosen"), dosenController.getPamitMahasiswaDetail);
router.post("/pamit-mahasiswa/:id/approve", authenticateToken, authorizeRole("dosen"), dosenController.approvePamitMahasiswa);
router.post("/pamit-mahasiswa/:id/reject", authenticateToken, authorizeRole("dosen"), dosenController.rejectPamitMahasiswa);

// ========== PAMIT ULANG ==========
// Approval pamit hanya oleh dosen pembimbing skripsi (endpoint DPA dinonaktifkan).

// ========== DOSEN KUOTA ==========
router.get("/kuota", authenticateToken, authorizeRole("dosen"), dosenController.getKuotaSendiri);

module.exports = router;
