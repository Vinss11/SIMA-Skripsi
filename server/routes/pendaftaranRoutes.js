const express = require("express");
const router = express.Router();
const pendaftaranController = require("../controllers/pendaftaranController");

// Public endpoint untuk mahasiswa yang belum memiliki akun
router.get("/periode-aktif", pendaftaranController.getPeriodeAktif);
router.get("/dosen", pendaftaranController.getDosenDropdown);
router.post("/jalur-baru", pendaftaranController.submitPendaftaranJalurBaru);
router.post("/submit", pendaftaranController.submitPendaftaranJalurBaru);

module.exports = router;
