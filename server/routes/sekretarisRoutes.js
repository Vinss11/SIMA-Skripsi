const express = require("express");
const router = express.Router();
const sekretarisController = require("../controllers/sekretarisController");
const mitraMagangController = require("../controllers/mitraMagangController");
const jalurController = require("../controllers/jalurController");
const sidangAkhirController = require("../controllers/sidangAkhirController");
const { authenticateToken, authorizeRole, authorizeSekretarisAccess } = require("../middlewares/authMiddleware");

router.get("/pendaftaran", authenticateToken, authorizeRole("sekretaris_prodi"), authorizeSekretarisAccess, sekretarisController.getPendaftaranList);
router.get("/pendaftaran/export", authenticateToken, authorizeRole("sekretaris_prodi"), authorizeSekretarisAccess, sekretarisController.exportPendaftaran);
router.get("/pendaftaran/:id", authenticateToken, authorizeRole("sekretaris_prodi"), authorizeSekretarisAccess, sekretarisController.getPendaftaranDetail);
router.post("/pendaftaran/:id/approve", authenticateToken, authorizeRole("sekretaris_prodi"), authorizeSekretarisAccess, sekretarisController.approvePendaftaran);
router.post("/pendaftaran/:id/reject", authenticateToken, authorizeRole("sekretaris_prodi"), authorizeSekretarisAccess, sekretarisController.rejectPendaftaran);
router.get("/mahasiswa/master", authenticateToken, authorizeRole("sekretaris_prodi"), authorizeSekretarisAccess, sekretarisController.getMahasiswaMasterData);
router.get("/periode", authenticateToken, authorizeRole("sekretaris_prodi"), authorizeSekretarisAccess, sekretarisController.getPeriodeOverview);
router.post("/periode/open", authenticateToken, authorizeRole("sekretaris_prodi"), authorizeSekretarisAccess, sekretarisController.openPeriodePendaftaran);
router.post("/periode/:id/activate", authenticateToken, authorizeRole("sekretaris_prodi"), authorizeSekretarisAccess, sekretarisController.activatePeriodePendaftaran);
router.post("/periode/close", authenticateToken, authorizeRole("sekretaris_prodi"), authorizeSekretarisAccess, sekretarisController.closePeriodePendaftaran);
router.patch("/periode/:id/tanggal", authenticateToken, authorizeRole("sekretaris_prodi"), authorizeSekretarisAccess, sekretarisController.updatePeriodeTanggal);
router.post("/periode/:id/close", authenticateToken, authorizeRole("sekretaris_prodi"), authorizeSekretarisAccess, sekretarisController.closePeriodeById);
router.get("/ketua-klaster", authenticateToken, authorizeRole("sekretaris_prodi"), authorizeSekretarisAccess, sekretarisController.getKetuaKlasterOverview);
router.post("/ketua-klaster/assign", authenticateToken, authorizeRole("sekretaris_prodi"), authorizeSekretarisAccess, sekretarisController.assignKetuaKlaster);
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
router.post(
  "/sidang/assign",
  authenticateToken,
  authorizeRole("sekretaris_prodi"),
  authorizeSekretarisAccess,
  sidangAkhirController.autoAssignSidangPenguji
);

module.exports = router;
