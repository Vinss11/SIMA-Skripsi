const express = require("express");
const router = express.Router();
const topikController = require("../controllers/topikController");
const { authenticateToken, authorizeRole } = require("../middlewares/authMiddleware");

// Public routes (bisa diakses mahasiswa dan dosen)
router.get("/", authenticateToken, topikController.getTopics);
router.get("/:id", authenticateToken, topikController.getTopicById);

// Admin, dosen, dan sekretaris prodi routes
router.post("/", authenticateToken, authorizeRole("admin", "dosen", "sekretaris_prodi"), topikController.createTopic);
router.put("/:id", authenticateToken, authorizeRole("admin", "dosen", "sekretaris_prodi"), topikController.updateTopic);
router.delete("/:id", authenticateToken, authorizeRole("admin", "dosen", "sekretaris_prodi"), topikController.deleteTopic);

module.exports = router;
