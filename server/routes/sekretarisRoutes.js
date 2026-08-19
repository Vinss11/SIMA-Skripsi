const express = require("express");
const router = express.Router();
const sekretarisController = require("../controllers/sekretarisController");
const mitraMagangController = require("../controllers/mitraMagangController");
const jalurController = require("../controllers/jalurController");
const sidangAkhirController = require("../controllers/sidangAkhirController");
const penetapanPembimbingController = require("../controllers/penetapanPembimbingController");
const { authenticateToken, authorizeRole, authorizeSekretarisAccess } = require("../middlewares/authMiddleware");

router.get("/pendaftaran", authenticateToken, authorizeRole("sekretaris_prodi"), authorizeSekretarisAccess, sekretarisController.getPendaftaranList);
router.get("/pendaftaran/export", authenticateToken, authorizeRole("sekretaris_prodi"), authorizeSekretarisAccess, sekretarisController.exportPendaftaran);
router.get("/pendaftaran/:id", authenticateToken, authorizeRole("sekretaris_prodi"), authorizeSekretarisAccess, sekretarisController.getPendaftaranDetail);
router.post("/pendaftaran/:id/approve", authenticateToken, authorizeRole("sekretaris_prodi"), authorizeSekretarisAccess, sekretarisController.approvePendaftaran);
router.post("/pendaftaran/:id/reject", authenticateToken, authorizeRole("sekretaris_prodi"), authorizeSekretarisAccess, sekretarisController.rejectPendaftaran);
router.get("/mahasiswa/master", authenticateToken, authorizeRole("sekretaris_prodi"), authorizeSekretarisAccess, sekretarisController.getMahasiswaMasterData);
router.get("/mahasiswa/master/export", authenticateToken, authorizeRole("sekretaris_prodi"), authorizeSekretarisAccess, sekretarisController.exportMahasiswaMasterData);
router.get("/mahasiswa/:id/penetapan-pembimbing", authenticateToken, authorizeRole("sekretaris_prodi"), authorizeSekretarisAccess, penetapanPembimbingController.getSupervisorAssignmentHistoryForSekretaris);
router.get("/penetapan-pembimbing", authenticateToken, authorizeRole("sekretaris_prodi"), authorizeSekretarisAccess, penetapanPembimbingController.getSupervisorAssignmentMonitoring);
router.get("/semester-transition/preview", authenticateToken, authorizeRole("sekretaris_prodi"), authorizeSekretarisAccess, penetapanPembimbingController.previewSemesterTransitions);
router.post("/semester-transition/confirm", authenticateToken, authorizeRole("sekretaris_prodi"), authorizeSekretarisAccess, penetapanPembimbingController.confirmSemesterTransition);
router.post("/semester-transition/confirm-bulk", authenticateToken, authorizeRole("sekretaris_prodi"), authorizeSekretarisAccess, penetapanPembimbingController.confirmSemesterTransitionsBulk);
router.post("/semester-transition/activate-due", authenticateToken, authorizeRole("sekretaris_prodi"), authorizeSekretarisAccess, penetapanPembimbingController.activateDueSemesterTransitions);
router.get("/periode", authenticateToken, authorizeRole("sekretaris_prodi"), authorizeSekretarisAccess, sekretarisController.getPeriodeOverview);
router.post("/periode/master-penanggung-jawab", authenticateToken, authorizeRole("sekretaris_prodi"), authorizeSekretarisAccess, sekretarisController.saveMasterPenanggungJawabPeriode);
router.get("/periode/setup-template", authenticateToken, authorizeRole("sekretaris_prodi"), authorizeSekretarisAccess, sekretarisController.getPeriodeSetupTemplate);
router.post("/periode/validate", authenticateToken, authorizeRole("sekretaris_prodi"), authorizeSekretarisAccess, sekretarisController.validatePeriodePendaftaran);
router.post("/periode/preview", authenticateToken, authorizeRole("sekretaris_prodi"), authorizeSekretarisAccess, sekretarisController.previewPeriodePendaftaran);
router.post("/periode/open", authenticateToken, authorizeRole("sekretaris_prodi"), authorizeSekretarisAccess, sekretarisController.openPeriodePendaftaran);
router.get("/master-dosen/kuota-overview", authenticateToken, authorizeRole("sekretaris_prodi"), authorizeSekretarisAccess, sekretarisController.getMasterDosenKuotaOverview);
router.put("/master-dosen/kuota", authenticateToken, authorizeRole("sekretaris_prodi"), authorizeSekretarisAccess, sekretarisController.setMasterDosenKuota);
router.get("/master-dosen/profil-penguji", authenticateToken, authorizeRole("sekretaris_prodi"), authorizeSekretarisAccess, sekretarisController.getMasterDosenProfilPenguji);
router.put("/master-dosen/profil-penguji", authenticateToken, authorizeRole("sekretaris_prodi"), authorizeSekretarisAccess, sekretarisController.saveMasterDosenProfilPenguji);
router.get("/master-dosen/ketersediaan", authenticateToken, authorizeRole("sekretaris_prodi"), authorizeSekretarisAccess, sekretarisController.getDosenKetersediaanPeriode);
router.put("/master-dosen/ketersediaan", authenticateToken, authorizeRole("sekretaris_prodi"), authorizeSekretarisAccess, sekretarisController.saveDosenKetersediaanPeriode);
router.get("/master-dosen/tindak-lanjut-status", authenticateToken, authorizeRole("sekretaris_prodi"), authorizeSekretarisAccess, sekretarisController.getTindakLanjutStatusDosen);
router.get("/master-dosen/tindak-lanjut-status/:id/current-impact", authenticateToken, authorizeRole("sekretaris_prodi"), authorizeSekretarisAccess, sekretarisController.getTindakLanjutStatusDosenCurrentImpact);
router.post("/master-dosen/tindak-lanjut-status/:followUpId/mahasiswa/:mahasiswaId/replacement", authenticateToken, authorizeRole("sekretaris_prodi"), authorizeSekretarisAccess, sekretarisController.activateDosenStatusReplacement);
router.put("/master-dosen/tindak-lanjut-status/:id/resolve", authenticateToken, authorizeRole("sekretaris_prodi"), authorizeSekretarisAccess, sekretarisController.resolveTindakLanjutStatusDosen);
router.patch("/periode/:id/tanggal", authenticateToken, authorizeRole("sekretaris_prodi"), authorizeSekretarisAccess, sekretarisController.updatePeriodeTanggal);
router.post("/periode/:id/close", authenticateToken, authorizeRole("sekretaris_prodi"), authorizeSekretarisAccess, sekretarisController.closePeriodeById);
router.get("/ketua-klaster", authenticateToken, authorizeRole("sekretaris_prodi"), authorizeSekretarisAccess, sekretarisController.getKetuaKlasterOverview);
router.get(
  "/penelitian/final",
  authenticateToken,
  authorizeRole("sekretaris_prodi"),
  authorizeSekretarisAccess,
  sekretarisController.getPenelitianFinalQueue
);
router.post(
  "/penelitian/final/:id/approve",
  authenticateToken,
  authorizeRole("sekretaris_prodi"),
  authorizeSekretarisAccess,
  sekretarisController.approvePenelitianFinal
);
router.post(
  "/penelitian/final/:id/reject",
  authenticateToken,
  authorizeRole("sekretaris_prodi"),
  authorizeSekretarisAccess,
  sekretarisController.rejectPenelitianFinal
);
router.get(
  "/non-penelitian/reviews",
  authenticateToken,
  authorizeRole("sekretaris_prodi"),
  authorizeSekretarisAccess,
  jalurController.getNonPenelitianReviewQueueForSekretaris
);
router.get(
  "/non-penelitian/reviews/:id",
  authenticateToken,
  authorizeRole("sekretaris_prodi"),
  authorizeSekretarisAccess,
  jalurController.getNonPenelitianReviewDetailForSekretaris
);
router.get(
  "/non-penelitian/reviews/:id/documents/:documentKey",
  authenticateToken,
  authorizeRole("sekretaris_prodi"),
  authorizeSekretarisAccess,
  jalurController.downloadNonPenelitianReviewDocumentForSekretaris
);
router.post(
  "/non-penelitian/reviews/:id/approve",
  authenticateToken,
  authorizeRole("sekretaris_prodi"),
  authorizeSekretarisAccess,
  jalurController.approveNonPenelitianReviewBySekretaris
);
router.post(
  "/non-penelitian/reviews/:id/reject",
  authenticateToken,
  authorizeRole("sekretaris_prodi"),
  authorizeSekretarisAccess,
  jalurController.rejectNonPenelitianReviewBySekretaris
);
router.get("/mitra-magang", authenticateToken, authorizeRole("sekretaris_prodi"), authorizeSekretarisAccess, mitraMagangController.getMitraMagangList);
router.post("/mitra-magang", authenticateToken, authorizeRole("sekretaris_prodi"), authorizeSekretarisAccess, mitraMagangController.createMitraMagang);
router.put("/mitra-magang/:id", authenticateToken, authorizeRole("sekretaris_prodi"), authorizeSekretarisAccess, mitraMagangController.updateMitraMagang);
router.delete("/mitra-magang/:id", authenticateToken, authorizeRole("sekretaris_prodi"), authorizeSekretarisAccess, mitraMagangController.deleteMitraMagang);

// ========== SIDANG AKHIR ==========
router.get(
  "/sidang/periode",
  authenticateToken,
  authorizeRole("sekretaris_prodi"),
  authorizeSekretarisAccess,
  sidangAkhirController.getSekretarisSidangOverview
);
router.post(
  "/sidang/periode",
  authenticateToken,
  authorizeRole("sekretaris_prodi"),
  authorizeSekretarisAccess,
  sidangAkhirController.createSekretarisPeriodeSidang
);
router.patch(
  "/sidang/periode/:id",
  authenticateToken,
  authorizeRole("sekretaris_prodi"),
  authorizeSekretarisAccess,
  sidangAkhirController.updateSekretarisPeriodeSidang
);
router.post(
  "/sidang/periode/:id/open",
  authenticateToken,
  authorizeRole("sekretaris_prodi"),
  authorizeSekretarisAccess,
  sidangAkhirController.openSekretarisPeriodeSidang
);
router.post(
  "/sidang/periode/:id/close",
  authenticateToken,
  authorizeRole("sekretaris_prodi"),
  authorizeSekretarisAccess,
  sidangAkhirController.closeSekretarisPeriodeSidang
);
router.get(
  "/sidang/queue",
  authenticateToken,
  authorizeRole("sekretaris_prodi"),
  authorizeSekretarisAccess,
  sidangAkhirController.getSekretarisSidangQueue
);
router.get(
  "/sidang/queue/:id",
  authenticateToken,
  authorizeRole("sekretaris_prodi"),
  authorizeSekretarisAccess,
  sidangAkhirController.getSekretarisSidangRegistrantDetail
);
router.post(
  "/sidang/assign",
  authenticateToken,
  authorizeRole("sekretaris_prodi"),
  authorizeSekretarisAccess,
  sidangAkhirController.autoAssignSidangPenguji
);

module.exports = router;
