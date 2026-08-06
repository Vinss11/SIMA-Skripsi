"use strict";

const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middlewares/authMiddleware");
const notificationController = require("../controllers/notificationController");

router.get("/", authenticateToken, notificationController.list);
router.get("/unread-count", authenticateToken, notificationController.unreadCount);
router.patch("/read-all", authenticateToken, notificationController.markAllRead);
router.delete("/read", authenticateToken, notificationController.deleteAllRead);
router.delete("/selected", authenticateToken, notificationController.deleteSelectedRead);
router.get("/:id", authenticateToken, notificationController.detail);
router.patch("/:id/read", authenticateToken, notificationController.markRead);

module.exports = router;
