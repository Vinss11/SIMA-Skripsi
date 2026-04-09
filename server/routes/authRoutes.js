const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { authenticateToken } = require("../middlewares/authMiddleware");

// Public routes
router.post("/login", authController.login);

// Protected routes (memerlukan authentication)
router.post("/change-password", authenticateToken, authController.changePassword);
router.get("/profile", authenticateToken, authController.getProfile);

module.exports = router;
