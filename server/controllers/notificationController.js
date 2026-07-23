"use strict";

const { Notifikasi } = require("../models");

function getRecipient(req) {
  return {
    recipient_type: String(req.user?.role || "").trim().toLowerCase(),
    recipient_id: Number(req.user?.id),
  };
}

function serializeNotification(row) {
  const plain = typeof row?.toJSON === "function" ? row.toJSON() : row;
  if (!plain) return null;
  const { deduplication_key: ignored, ...safe } = plain;
  return safe;
}

exports.list = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(50, Math.max(1, Number(req.query.limit || 20)));
    const recipient = getRecipient(req);
    const where = { ...recipient };
    if (req.query.status === "unread") where.read_at = null;

    const [{ rows, count }, unreadCount] = await Promise.all([
      Notifikasi.findAndCountAll({
        where,
        order: [["createdAt", "DESC"]],
        limit,
        offset: (page - 1) * limit,
      }),
      Notifikasi.count({ where: { ...recipient, read_at: null } }),
    ]);
    return res.json({
      success: true,
      data: {
        notifications: rows.map(serializeNotification),
        unread_count: unreadCount,
        total: count,
        page,
        total_pages: Math.max(1, Math.ceil(count / limit)),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Gagal memuat pemberitahuan.", error: error.message });
  }
};

exports.unreadCount = async (req, res) => {
  try {
    const count = await Notifikasi.count({ where: { ...getRecipient(req), read_at: null } });
    return res.json({ success: true, data: { unread_count: count } });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Gagal memuat jumlah pemberitahuan.", error: error.message });
  }
};

exports.detail = async (req, res) => {
  try {
    const notification = await Notifikasi.findOne({
      where: { id: Number(req.params.id), ...getRecipient(req) },
    });
    if (!notification) return res.status(404).json({ success: false, message: "Pemberitahuan tidak ditemukan." });
    return res.json({ success: true, data: serializeNotification(notification) });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Gagal memuat detail pemberitahuan.", error: error.message });
  }
};

exports.markRead = async (req, res) => {
  try {
    const notification = await Notifikasi.findOne({
      where: { id: Number(req.params.id), ...getRecipient(req) },
    });
    if (!notification) return res.status(404).json({ success: false, message: "Pemberitahuan tidak ditemukan." });
    if (!notification.read_at) await notification.update({ read_at: new Date() });
    return res.json({ success: true, data: serializeNotification(notification) });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Gagal menandai pemberitahuan.", error: error.message });
  }
};

exports.markAllRead = async (req, res) => {
  try {
    const [updated] = await Notifikasi.update({ read_at: new Date() }, {
      where: { ...getRecipient(req), read_at: null },
    });
    return res.json({ success: true, data: { updated } });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Gagal menandai semua pemberitahuan.", error: error.message });
  }
};
