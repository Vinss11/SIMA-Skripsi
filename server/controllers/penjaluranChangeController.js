"use strict";

const { Dosen, SekretarisProdi } = require("../models");
const changeService = require("../services/penjaluranChangeService");

function respondError(res, error) {
  console.error("Penjaluran change error:", error);
  return res.status(error.statusCode || 500).json({
    success: false,
    code: error.code || "INTERNAL_ERROR",
    message: error.statusCode ? error.message : "Terjadi kesalahan pada server.",
    detail: error.detail || null,
  });
}

function normalizeTarget(body = {}, query = {}) {
  return body.target_track || body.jalur_tujuan || body.penjaluran_baru
    || body.jenis_jalur_ulang || query.target_track || query.jalur_tujuan || null;
}

async function resolveDosenId(req) {
  if (req.user?.role === "dosen") return Number(req.user.id) || null;
  if (req.user?.role !== "sekretaris_prodi") return null;
  const sekretaris = await SekretarisProdi.findByPk(req.user.id, { attributes: ["nik", "email"] });
  if (!sekretaris) return null;
  const where = [];
  if (sekretaris.nik) where.push({ nik: sekretaris.nik });
  if (sekretaris.email) where.push({ email: sekretaris.email });
  if (!where.length) return null;
  const { Op } = require("sequelize");
  const dosen = await Dosen.findOne({ where: { [Op.or]: where }, attributes: ["id"] });
  return dosen?.id || null;
}

exports.getEligibility = async (req, res) => {
  try {
    const data = await changeService.getEligibility(req.user.id, { targetTrack: normalizeTarget({}, req.query) });
    return res.json({ success: true, data });
  } catch (error) { return respondError(res, error); }
};

exports.submitPamit = async (req, res) => {
  try {
    const data = await changeService.submitPamit({
      mahasiswaId: req.user.id,
      targetTrack: normalizeTarget(req.body),
      message: req.body?.message || req.body?.pesan_ke_dosen_pembimbing,
      reason: req.body?.reason || req.body?.alasan_pengajuan || req.body?.alasan_ulang,
      note: req.body?.note || req.body?.catatan_tambahan,
      idempotencyKey: req.get("Idempotency-Key") || req.body?.idempotency_key || null,
    });
    return res.status(201).json({ success: true, message: "Pamit berhasil diajukan kepada Pembimbing 1.", data });
  } catch (error) { return respondError(res, error); }
};

exports.getPamit = async (req, res) => {
  try {
    const data = await changeService.getPamitDetail(req.user.id, req.params.id);
    return res.json({ success: true, data });
  } catch (error) { return respondError(res, error); }
};

exports.decidePamit = async (req, res) => {
  try {
    const dosenId = await resolveDosenId(req);
    if (!dosenId) return res.status(403).json({ success: false, message: "Akun tidak terhubung ke data dosen." });
    const rawDecision = String(req.body?.decision || req.body?.status || "").toLowerCase();
    const decision = rawDecision === "approve" ? "approved" : rawDecision === "reject" ? "rejected" : rawDecision;
    const data = await changeService.decidePamit({
      pamitId: req.params.id, dosenId, decision,
      note: req.body?.note || req.body?.keterangan_dospem,
    });
    if (data.status === "cancelled") {
      return res.status(409).json({ success: false, code: "PAMIT_PERIOD_EXPIRED", message: data.cancellation_reason, data });
    }
    return res.json({ success: true, message: `Pamit berhasil ${decision === "approved" ? "disetujui" : "ditolak"}.`, data });
  } catch (error) { return respondError(res, error); }
};

exports.approvePamit = (req, res) => {
  req.body = { ...(req.body || {}), decision: "approved" };
  return exports.decidePamit(req, res);
};

exports.rejectPamit = (req, res) => {
  req.body = { ...(req.body || {}), decision: "rejected" };
  return exports.decidePamit(req, res);
};

exports.createRegistration = async (req, res) => {
  try {
    const data = await changeService.createChangeRegistration({
      mahasiswaId: req.user.id,
      targetTrack: normalizeTarget(req.body),
      reason: req.body?.reason || req.body?.alasan_pengajuan || req.body?.alasan_ulang,
      pamitId: req.body?.pamit_id || null,
    });
    return res.status(201).json({ success: true, message: "Pendaftaran ulang/alih berhasil dibuat.", data });
  } catch (error) { return respondError(res, error); }
};

exports.getHistory = async (req, res) => {
  try {
    const data = await changeService.getChangeHistory(req.user.id);
    return res.json({ success: true, data });
  } catch (error) { return respondError(res, error); }
};
