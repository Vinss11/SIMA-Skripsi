"use strict";

const { Op } = require("sequelize");
const {
  Notifikasi,
  PenetapanPembimbing,
  PenetapanPembimbingDosen,
  Dosen,
} = require("../models");
const { NOTIFICATION_TYPES } = require("../constants/notificationTypes");
const { formatDosenFullName } = require("../utils/dosenIdentity");

function getRecipient(req) {
  return {
    recipient_type: String(req.user?.role || "").trim().toLowerCase(),
    recipient_id: Number(req.user?.id),
  };
}

function serializeNotification(row, assignmentsById = new Map()) {
  const plain = typeof row?.toJSON === "function" ? row.toJSON() : row;
  if (!plain) return null;
  const { deduplication_key: ignored, ...safe } = plain;
  const assignment = safe.reference_type === "penetapan_pembimbing"
    ? assignmentsById.get(Number(safe.reference_id))
    : null;
  if (assignment) {
    safe.metadata = {
      ...(safe.metadata || {}),
      appointed_supervisors: [...(assignment.pembimbings || [])]
        .sort((left, right) => Number(left.urutan) - Number(right.urutan))
        .map((member) => ({
          dosen_id: Number(member.dosen_id),
          urutan: Number(member.urutan),
          nama: formatDosenFullName(member.dosen?.nama, member.dosen?.gelar) || `Dosen #${member.dosen_id}`,
          nik: member.dosen?.nik || null,
        })),
    };
    if (safe.type === NOTIFICATION_TYPES.SUPERVISOR_ASSIGNED_STUDENT) {
      safe.message = "Pembimbing skripsi Anda telah ditetapkan oleh Sekretaris Prodi.";
    }
  }
  return safe;
}

async function loadReferencedAssignments(notifications) {
  const assignmentIds = [...new Set((notifications || [])
    .filter((item) => item?.reference_type === "penetapan_pembimbing")
    .map((item) => Number(item.reference_id))
    .filter((id) => Number.isInteger(id) && id > 0))];
  if (assignmentIds.length === 0) return new Map();

  const assignments = await PenetapanPembimbing.findAll({
    where: { id: assignmentIds },
    attributes: ["id"],
    include: [{
      model: PenetapanPembimbingDosen,
      as: "pembimbings",
      attributes: ["dosen_id", "urutan"],
      include: [{ model: Dosen, as: "dosen", attributes: ["nama", "gelar", "nik"] }],
    }],
  });
  return new Map(assignments.map((item) => [Number(item.id), item]));
}

exports.list = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(50, Math.max(1, Number(req.query.limit || 20)));
    const recipient = getRecipient(req);
    const where = { ...recipient };
    if (req.query.status === "unread") where.read_at = null;

    const [{ rows, count }, unreadCount, readCount] = await Promise.all([
      Notifikasi.findAndCountAll({
        where,
        order: [["createdAt", "DESC"]],
        limit,
        offset: (page - 1) * limit,
      }),
      Notifikasi.count({ where: { ...recipient, read_at: null } }),
      Notifikasi.count({ where: { ...recipient, read_at: { [Op.ne]: null } } }),
    ]);
    const assignmentsById = await loadReferencedAssignments(rows);
    return res.json({
      success: true,
      data: {
        notifications: rows.map((item) => serializeNotification(item, assignmentsById)),
        unread_count: unreadCount,
        read_count: readCount,
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
    const assignmentsById = await loadReferencedAssignments([notification]);
    return res.json({ success: true, data: serializeNotification(notification, assignmentsById) });
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
    const assignmentsById = await loadReferencedAssignments([notification]);
    return res.json({ success: true, data: serializeNotification(notification, assignmentsById) });
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

exports.deleteAllRead = async (req, res) => {
  try {
    const deleted = await Notifikasi.destroy({
      where: { ...getRecipient(req), read_at: { [Op.ne]: null } },
    });
    return res.json({ success: true, data: { deleted } });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Gagal menghapus pemberitahuan yang sudah dibaca.", error: error.message });
  }
};

exports.deleteSelectedRead = async (req, res) => {
  const ids = [...new Set((Array.isArray(req.body?.ids) ? req.body.ids : [])
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0))];
  if (ids.length === 0) {
    return res.status(400).json({ success: false, message: "Pilih minimal satu pemberitahuan yang akan dihapus." });
  }
  if (ids.length > 100) {
    return res.status(400).json({ success: false, message: "Maksimal 100 pemberitahuan dapat dihapus sekaligus." });
  }

  const transaction = await Notifikasi.sequelize.transaction();
  try {
    const rows = await Notifikasi.findAll({
      where: { ...getRecipient(req), id: { [Op.in]: ids } },
      attributes: ["id", "read_at"],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (rows.length !== ids.length) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: "Sebagian pemberitahuan tidak ditemukan." });
    }
    if (rows.some((item) => !item.read_at)) {
      await transaction.rollback();
      return res.status(409).json({ success: false, message: "Pemberitahuan belum dibaca tidak dapat dihapus." });
    }

    const deleted = await Notifikasi.destroy({
      where: { ...getRecipient(req), id: { [Op.in]: ids }, read_at: { [Op.ne]: null } },
      transaction,
    });
    await transaction.commit();
    return res.json({ success: true, data: { deleted, ids } });
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    return res.status(500).json({ success: false, message: "Gagal menghapus pemberitahuan terpilih.", error: error.message });
  }
};
