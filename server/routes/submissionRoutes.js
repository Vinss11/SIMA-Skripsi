const express = require("express");
const router = express.Router();
const submissionController = require("../controllers/submissionController");
const { authenticateToken, authorizeRole } = require("../middlewares/authMiddleware");

// Mahasiswa - Lihat list & detail pengajuan
router.get("/", authenticateToken, authorizeRole("mahasiswa"), submissionController.getMySubmissions);

// Bisa diakses mahasiswa dan dosen (dengan authorization check di controller)
router.get("/:id", authenticateToken, authorizeRole("mahasiswa", "dosen"), submissionController.getSubmissionById);

module.exports = router;
