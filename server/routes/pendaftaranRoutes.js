const express = require("express");
const router = express.Router();
const pendaftaranController = require("../controllers/pendaftaranController");
const { authenticateToken, authorizeRole } = require("../middlewares/authMiddleware");

// Public endpoint untuk mahasiswa yang belum memiliki akun
router.get("/periode-aktif", pendaftaranController.getPeriodeAktif);
router.get("/dosen", pendaftaranController.getDosenDropdown);
router.post("/jalur-baru", pendaftaranController.submitPendaftaranJalurBaru);
router.post("/submit", pendaftaranController.submitPendaftaranJalurBaru);
router.post(
  "/ulang-alih",
  authenticateToken,
  authorizeRole("mahasiswa"),
  pendaftaranController.submitPendaftaranUlangAlih
);

module.exports = router;
