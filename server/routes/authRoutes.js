const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { authenticateToken, authenticateRestrictedAllowed } = require("../middlewares/authMiddleware");

// Public routes
router.post("/login", authController.login);
router.post("/refresh", authController.refreshSession);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password/validate", authController.validateResetToken);
router.post("/reset-password/confirm", authController.confirmResetPassword);

// A restricted account may only change its password or end its session.
router.post("/change-password", authenticateRestrictedAllowed, authController.changePassword);
router.post("/logout", authenticateRestrictedAllowed, authController.logout);
router.post("/logout-all", authenticateRestrictedAllowed, authController.logoutAll);
router.get("/sessions", authenticateToken, authController.listSessions);
router.delete("/sessions/:sessionId", authenticateToken, authController.revokeSession);
router.get("/profile", authenticateToken, authController.getProfile);

module.exports = router;
