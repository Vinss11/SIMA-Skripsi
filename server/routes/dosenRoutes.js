const express = require("express");
const router = express.Router();
const dosenController = require("../controllers/dosenController");
const bimbinganController = require("../controllers/bimbinganController");
const dokumenSidangController = require("../controllers/dokumenSidangController");
const sidangAkhirController = require("../controllers/sidangAkhirController");
const submissionController = require("../controllers/submissionController");
const jalurController = require("../controllers/jalurController");
const uploadController = require("../controllers/uploadController");
const upload = require("../middlewares/uploadMiddleware");
const { authenticateToken, authorizeRole } = require("../middlewares/authMiddleware");

function handleUploadMulterError(err, res) {
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      success: false,
      message: "Ukuran file terlalu besar. Maksimal 5MB.",
      error: err.message,
    });
  }

  if (err.message && err.message.toLowerCase().includes("format excel")) {
    return res.status(400).json({
      success: false,
      message: "File tidak valid. Hanya file Excel (.xls, .xlsx, .ods) yang diperbolehkan.",
      error: err.message,
    });
  }

  return res.status(400).json({
    success: false,
    message: "Error pada file upload",
    error: err.message,
  });
}

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
router.get(
  "/non-penelitian/pengabdian/reviews",
  authenticateToken,
  authorizeRole("dosen"),
  jalurController.getPengabdianReviewQueueForDosen
);
router.get(
  "/non-penelitian/pengabdian/reviews/:id",
  authenticateToken,
  authorizeRole("dosen"),
  jalurController.getPengabdianReviewDetailForDosen
);
router.post(
  "/non-penelitian/pengabdian/reviews/:id/approve",
  authenticateToken,
  authorizeRole("dosen"),
  jalurController.approvePengabdianReviewByDosen
);
router.post(
  "/non-penelitian/pengabdian/reviews/:id/reject",
  authenticateToken,
  authorizeRole("dosen"),
  jalurController.rejectPengabdianReviewByDosen
);
router.get(
  "/non-penelitian/perintisan-bisnis/reviews",
  authenticateToken,
  authorizeRole("dosen"),
  jalurController.getPerintisanBisnisReviewQueueForDosen
);
router.get(
  "/non-penelitian/perintisan-bisnis/reviews/:id",
  authenticateToken,
  authorizeRole("dosen"),
  jalurController.getPerintisanBisnisReviewDetailForDosen
);
router.post(
  "/non-penelitian/perintisan-bisnis/reviews/:id/approve",
  authenticateToken,
  authorizeRole("dosen"),
  jalurController.approvePerintisanBisnisReviewByDosen
);
router.post(
  "/non-penelitian/perintisan-bisnis/reviews/:id/reject",
  authenticateToken,
  authorizeRole("dosen"),
  jalurController.rejectPerintisanBisnisReviewByDosen
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
router.get(
  "/monitoring-mahasiswa",
  authenticateToken,
  authorizeRole("dosen", "sekretaris_prodi"),
  dosenController.getMonitoringMahasiswa
);

// ========== UPLOAD TOPIK ==========
router.post(
  "/upload/topics/preview",
  authenticateToken,
  authorizeRole("dosen", "sekretaris_prodi"),
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err) {
        console.error("Multer Error:", err.message);
        return handleUploadMulterError(err, res);
      }
      next();
    });
  },
  uploadController.previewUploadTopics
);

router.post(
  "/upload/topics/commit",
  authenticateToken,
  authorizeRole("dosen", "sekretaris_prodi"),
  uploadController.commitUploadTopics
);

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

// ========== REVIEW DOKUMEN SIDANG ==========
router.get(
  "/dokumen-sidang",
  authenticateToken,
  authorizeRole("dosen"),
  dokumenSidangController.getDosenDokumenSidangList
);
router.get(
  "/dokumen-sidang/:mahasiswaId",
  authenticateToken,
  authorizeRole("dosen"),
  dokumenSidangController.getDosenDokumenSidangDetail
);
router.post(
  "/dokumen-sidang/:mahasiswaId/review",
  authenticateToken,
  authorizeRole("dosen"),
  dokumenSidangController.reviewDosenDokumenSidang
);
router.get(
  "/dokumen-sidang/:mahasiswaId/:jenis/download",
  authenticateToken,
  authorizeRole("dosen"),
  dokumenSidangController.downloadDosenDokumenSidang
);

// ========== KETERSEDIAAN PENGUJI SIDANG ==========
router.get(
  "/sidang/ketersediaan",
  authenticateToken,
  authorizeRole("dosen"),
  sidangAkhirController.getDosenKetersediaanSidang
);
router.post(
  "/sidang/ketersediaan",
  authenticateToken,
  authorizeRole("dosen"),
  sidangAkhirController.saveDosenKetersediaanSidang
);

module.exports = router;
