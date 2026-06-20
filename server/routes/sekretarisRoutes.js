const express = require("express");
const router = express.Router();
const sekretarisController = require("../controllers/sekretarisController");
const mitraMagangController = require("../controllers/mitraMagangController");
const jalurController = require("../controllers/jalurController");
const sidangAkhirController = require("../controllers/sidangAkhirController");
const penelitianReviewController = require("../controllers/penelitianReviewController");
const { authenticateToken, authorizeRole, authorizeSekretarisAccess } = require("../middlewares/authMiddleware");

router.get("/pendaftaran", authenticateToken, authorizeRole("sekretaris_prodi"), authorizeSekretarisAccess, sekretarisController.getPendaftaranList);
router.get("/pendaftaran/export", authenticateToken, authorizeRole("sekretaris_prodi"), authorizeSekretarisAccess, sekretarisController.exportPendaftaran);
router.get("/pendaftaran/:id", authenticateToken, authorizeRole("sekretaris_prodi"), authorizeSekretarisAccess, sekretarisController.getPendaftaranDetail);
router.post("/pendaftaran/:id/approve", authenticateToken, authorizeRole("sekretaris_prodi"), authorizeSekretarisAccess, sekretarisController.approvePendaftaran);
router.post("/pendaftaran/:id/reject", authenticateToken, authorizeRole("sekretaris_prodi"), authorizeSekretarisAccess, sekretarisController.rejectPendaftaran);
router.get("/mahasiswa/master", authenticateToken, authorizeRole("sekretaris_prodi"), authorizeSekretarisAccess, sekretarisController.getMahasiswaMasterData);
router.get("/mahasiswa/master/export", authenticateToken, authorizeRole("sekretaris_prodi"), authorizeSekretarisAccess, sekretarisController.exportMahasiswaMasterData);
router.get("/periode", authenticateToken, authorizeRole("sekretaris_prodi"), authorizeSekretarisAccess, sekretarisController.getPeriodeOverview);
router.post("/periode/master-penanggung-jawab", authenticateToken, authorizeRole("sekretaris_prodi"), authorizeSekretarisAccess, sekretarisController.saveMasterPenanggungJawabPeriode);
router.post("/periode/open", authenticateToken, authorizeRole("sekretaris_prodi"), authorizeSekretarisAccess, sekretarisController.openPeriodePendaftaran);
router.get("/master-dosen/kuota-overview", authenticateToken, authorizeRole("sekretaris_prodi"), authorizeSekretarisAccess, sekretarisController.getMasterDosenKuotaOverview);
router.put("/master-dosen/kuota", authenticateToken, authorizeRole("sekretaris_prodi"), authorizeSekretarisAccess, sekretarisController.setMasterDosenKuota);
router.post("/periode/:id/activate", authenticateToken, authorizeRole("sekretaris_prodi"), authorizeSekretarisAccess, sekretarisController.activatePeriodePendaftaran);
router.post("/periode/close", authenticateToken, authorizeRole("sekretaris_prodi"), authorizeSekretarisAccess, sekretarisController.closePeriodePendaftaran);
router.patch("/periode/:id/tanggal", authenticateToken, authorizeRole("sekretaris_prodi"), authorizeSekretarisAccess, sekretarisController.updatePeriodeTanggal);
router.post("/periode/:id/close", authenticateToken, authorizeRole("sekretaris_prodi"), authorizeSekretarisAccess, sekretarisController.closePeriodeById);
router.get("/ketua-klaster", authenticateToken, authorizeRole("sekretaris_prodi"), authorizeSekretarisAccess, sekretarisController.getKetuaKlasterOverview);
router.post("/ketua-klaster/assign", authenticateToken, authorizeRole("sekretaris_prodi"), authorizeSekretarisAccess, sekretarisController.assignKetuaKlaster);
router.get(
  "/penelitian/review-tertunda",
  authenticateToken,
  authorizeRole("sekretaris_prodi"),
  authorizeSekretarisAccess,
  penelitianReviewController.getPendingResearchReviews
);
router.post(
  "/penelitian/review-tertunda/:id/slots/:slot/remind",
  authenticateToken,
  authorizeRole("sekretaris_prodi"),
  authorizeSekretarisAccess,
  penelitianReviewController.remindPendingResearchReviewer
);
router.put(
  "/penelitian/review-tertunda/:id/slots/:slot/replace",
  authenticateToken,
  authorizeRole("sekretaris_prodi"),
  authorizeSekretarisAccess,
  penelitianReviewController.replacePendingResearchReviewer
);
router.delete(
  "/penelitian/review-tertunda/:id/slots/:slot",
  authenticateToken,
  authorizeRole("sekretaris_prodi"),
  authorizeSekretarisAccess,
  penelitianReviewController.cancelPendingResearchTopic
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
