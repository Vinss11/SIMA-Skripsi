const express = require("express");
const router = express.Router();
const dosenController = require("../controllers/dosenController");
const bimbinganController = require("../controllers/bimbinganController");
const submissionController = require("../controllers/submissionController");
const jalurController = require("../controllers/jalurController");
const { authenticateToken, authorizeRole } = require("../middlewares/authMiddleware");

// ========== PENGAJUAN SUBMISSIONS ==========
// Dosen mereview pengajuan yang ditujukan kepadanya
router.get("/submissions", authenticateToken, authorizeRole("dosen", "sekretaris_prodi"), dosenController.getDosenSubmissions);
router.get("/submissions/:id", authenticateToken, authorizeRole("dosen", "sekretaris_prodi"), submissionController.getSubmissionById);
router.post("/submissions/:id/approve", authenticateToken, authorizeRole("dosen", "sekretaris_prodi"), dosenController.approveSubmission);
router.post("/submissions/:id/reject", authenticateToken, authorizeRole("dosen", "sekretaris_prodi"), dosenController.rejectSubmission);
router.get(
  "/non-penelitian/magang/reviews",
  authenticateToken,
  authorizeRole("dosen"),
  jalurController.getMagangReviewQueueForDosen
);
router.get(
  "/non-penelitian/magang/reviews/:id",
  authenticateToken,
  authorizeRole("dosen"),
  jalurController.getMagangReviewDetailForDosen
);
router.post(
  "/non-penelitian/magang/reviews/:id/approve",
  authenticateToken,
  authorizeRole("dosen"),
  jalurController.approveMagangReviewByDosen
);
router.post(
  "/non-penelitian/magang/reviews/:id/reject",
  authenticateToken,
  authorizeRole("dosen"),
  jalurController.rejectMagangReviewByDosen
);

// ==========  SEMESTER 3 ==========
router.get("/permohonan-extend", authenticateToken, authorizeRole("dosen", "sekretaris_prodi"), dosenController.getIzinLanjutSubmissions);
router.get("/permohonan-extend/:id", authenticateToken, authorizeRole("dosen", "sekretaris_prodi"), dosenController.getIzinLanjutDetail);
router.post("/permohonan-extend/:id/approve", authenticateToken, authorizeRole("dosen", "sekretaris_prodi"), dosenController.approveIzinLanjut);
router.post("/permohonan-extend/:id/reject", authenticateToken, authorizeRole("dosen", "sekretaris_prodi"), dosenController.rejectIzinLanjut);
// Backward-compatibility alias (nama endpoint lama)
router.get("/izin-lanjut", authenticateToken, authorizeRole("dosen", "sekretaris_prodi"), dosenController.getIzinLanjutSubmissions);
router.get("/izin-lanjut/:id", authenticateToken, authorizeRole("dosen", "sekretaris_prodi"), dosenController.getIzinLanjutDetail);
router.post("/izin-lanjut/:id/approve", authenticateToken, authorizeRole("dosen", "sekretaris_prodi"), dosenController.approveIzinLanjut);
router.post("/izin-lanjut/:id/reject", authenticateToken, authorizeRole("dosen", "sekretaris_prodi"), dosenController.rejectIzinLanjut);

// ========== PAMIT MAHASISWA (DOSEN PEMBIMBING SKRIPSI) ==========
// Dosen pembimbing skripsi mereview pamit mahasiswa bimbingannya (approve/reject tahap 1)
router.get("/pamit-mahasiswa", authenticateToken, authorizeRole("dosen", "sekretaris_prodi"), dosenController.getPamitMahasiswa);
router.get("/pamit-mahasiswa/:id", authenticateToken, authorizeRole("dosen", "sekretaris_prodi"), dosenController.getPamitMahasiswaDetail);
router.post("/pamit-mahasiswa/:id/approve", authenticateToken, authorizeRole("dosen", "sekretaris_prodi"), dosenController.approvePamitMahasiswa);
router.post("/pamit-mahasiswa/:id/reject", authenticateToken, authorizeRole("dosen", "sekretaris_prodi"), dosenController.rejectPamitMahasiswa);

// ========== PAMIT ULANG ==========
// Approval pamit hanya oleh dosen pembimbing skripsi (endpoint DPA dinonaktifkan).

// ========== DOSEN KUOTA ==========
router.get("/kuota", authenticateToken, authorizeRole("dosen", "sekretaris_prodi"), dosenController.getKuotaSendiri);
router.get("/mahasiswa-master", authenticateToken, authorizeRole("dosen"), dosenController.getMahasiswaMasterReadOnly);

// ========== BIMBINGAN SKRIPSI ==========
router.get("/bimbingan", authenticateToken, authorizeRole("dosen", "sekretaris_prodi"), bimbinganController.getDosenBimbingan);
router.get("/bimbingan/:id", authenticateToken, authorizeRole("dosen", "sekretaris_prodi"), bimbinganController.getDosenBimbinganDetail);
router.post("/bimbingan/:id/approve", authenticateToken, authorizeRole("dosen", "sekretaris_prodi"), bimbinganController.approveDosenBimbingan);
router.post("/bimbingan/:id/reject", authenticateToken, authorizeRole("dosen", "sekretaris_prodi"), bimbinganController.rejectDosenBimbingan);
router.post(
  "/bimbingan/:id/review-resume",
  authenticateToken,
  authorizeRole("dosen", "sekretaris_prodi"),
  bimbinganController.reviewResumeDosenBimbingan
);

module.exports = router;
