const express = require("express");
const router = express.Router();
const topikController = require("../controllers/topikController");
const { authenticateToken, authorizeRole } = require("../middlewares/authMiddleware");

// Public routes (bisa diakses mahasiswa dan dosen)
router.get("/", authenticateToken, topikController.getTopics);
router.get("/:id", authenticateToken, topikController.getTopicById);

// Admin only routes
router.post("/", authenticateToken, authorizeRole("admin"), topikController.createTopic);
router.put("/:id", authenticateToken, authorizeRole("admin"), topikController.updateTopic);
router.delete("/:id", authenticateToken, authorizeRole("admin"), topikController.deleteTopic);

module.exports = router;
