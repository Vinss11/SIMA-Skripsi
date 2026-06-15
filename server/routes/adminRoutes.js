const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const mitraMagangController = require("../controllers/mitraMagangController");
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

// ========== MAHASISWA MANAGEMENT ==========

router.get("/mahasiswa", authenticateToken, authorizeRole("admin"), adminController.getAllMahasiswa);
router.put("/mahasiswa/:id/assign-dospem-akademik", authenticateToken, authorizeRole("admin"), adminController.assignDosenPembimbingAkademik);
router.put("/mahasiswa/:id/update-status", authenticateToken, authorizeRole("admin"), adminController.updateStatusJalur);

// ========== UPLOAD MAHASISWA (EXCEL) ==========

router.get("/upload/mahasiswa-template", uploadController.downloadMahasiswaTemplate);

router.get("/upload/dosen-template", uploadController.downloadDosenTemplate);

router.post(
  "/upload/dosen",
  authenticateToken,
  authorizeRole("admin"),
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err) {
        console.error("Multer Error:", err.message);
        return handleUploadMulterError(err, res);
      }
      next();
    });
  },
  uploadController.uploadDosen
);

router.post(
  "/upload/dosen/commit",
  authenticateToken,
  authorizeRole("admin"),
  uploadController.commitUploadDosen
);

router.post(
  "/upload/mahasiswa",
  authenticateToken,
  authorizeRole("admin"),
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err) {
        console.error("Multer Error:", err.message);
        return handleUploadMulterError(err, res);
      }
      next();
    });
  },
  uploadController.uploadMahasiswa
);

// ========== PENGAJUAN MANAGEMENT ==========

router.get("/pengajuan", authenticateToken, authorizeRole("admin"), adminController.getAllPengajuan);

// ========== DASHBOARD STATISTICS ==========

router.get("/statistics", authenticateToken, authorizeRole("admin"), adminController.getStatistics);

// ========== KUOTA DOSEN MANAGEMENT ==========

router.get("/klasters", authenticateToken, authorizeRole("admin"), adminController.getAllKlasters);
router.get("/dosen", authenticateToken, authorizeRole("admin"), adminController.getAllDosens);
router.get("/dosen/export", authenticateToken, authorizeRole("admin"), adminController.exportDosensExcel);
router.post("/dosen", authenticateToken, authorizeRole("admin"), adminController.createDosen);
router.put("/dosen/jabatan-struktural", authenticateToken, authorizeRole("admin"), adminController.updateJabatanStrukturalAssignments);
router.put("/dosen/:id/profil", authenticateToken, authorizeRole("admin"), adminController.updateDosenProfil);
router.get("/dosen/kuota-overview", authenticateToken, authorizeRole("admin"), adminController.getKuotaOverview);
router.get("/dosen/:id/kuota", authenticateToken, authorizeRole("admin"), adminController.getKuotaDosenDetail);
router.put("/dosen/:id/kuota", authenticateToken, authorizeRole("admin"), adminController.setKuotaDosen);
router.get("/mitra-magang", authenticateToken, authorizeRole("admin"), mitraMagangController.getMitraMagangList);
router.post("/mitra-magang", authenticateToken, authorizeRole("admin"), mitraMagangController.createMitraMagang);
router.put("/mitra-magang/:id", authenticateToken, authorizeRole("admin"), mitraMagangController.updateMitraMagang);
router.delete("/mitra-magang/:id", authenticateToken, authorizeRole("admin"), mitraMagangController.deleteMitraMagang);

module.exports = router;
