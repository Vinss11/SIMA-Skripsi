"use strict";

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

function normalizeChangeType(body = {}, query = {}) {
  return body.pendaftaran || body.change_type || body.jenis_perubahan
    || query.pendaftaran || query.change_type || query.jenis_perubahan || null;
}

exports.getEligibility = async (req, res) => {
  try {
    const data = await changeService.getEligibility(req.user.id, {
      targetTrack: normalizeTarget({}, req.query),
      changeType: normalizeChangeType({}, req.query),
    });
    return res.json({ success: true, data });
  } catch (error) { return respondError(res, error); }
};

exports.submitPamit = async (req, res) => {
  try {
    const data = await changeService.submitPamit({
      mahasiswaId: req.user.id,
      targetTrack: normalizeTarget(req.body),
      changeType: normalizeChangeType(req.body),
      message: req.body?.message || req.body?.pesan_ke_dosen_pembimbing,
      reason: req.body?.reason || req.body?.alasan_pengajuan || req.body?.alasan_ulang,
      note: req.body?.note || req.body?.catatan_tambahan,
      idempotencyKey: req.get("Idempotency-Key") || req.body?.idempotency_key || null,
    });
    return res.status(data.replayed ? 200 : 201).json({
      success: true,
      message: data.replayed ? "Pemberitahuan pamit identik tidak dibuat ulang." : "Pamit berhasil dikirim kepada dosen pembimbing sebelumnya.",
      data,
    });
  } catch (error) { return respondError(res, error); }
};

exports.getPamit = async (req, res) => {
  try {
    const data = await changeService.getPamitDetail(req.user.id, req.params.id);
    return res.json({ success: true, data });
  } catch (error) { return respondError(res, error); }
};

exports.createRegistration = async (req, res) => {
  try {
    const data = await changeService.createChangeRegistration({
      mahasiswaId: req.user.id,
      targetTrack: normalizeTarget(req.body),
      changeType: normalizeChangeType(req.body),
      reason: req.body?.reason || req.body?.alasan_pengajuan || req.body?.alasan_ulang,
      pamitId: req.body?.pamit_id || null,
      idempotencyKey: req.get("Idempotency-Key") || req.body?.idempotency_key || null,
    });
    return res.status(data.replayed ? 200 : 201).json({
      success: true,
      message: data.replayed
        ? "Request pendaftaran identik diputar ulang tanpa membuat siklus baru."
        : "Pendaftaran ulang/alih berhasil dibuat.",
      data,
    });
  } catch (error) { return respondError(res, error); }
};

exports.getHistory = async (req, res) => {
  try {
    const data = await changeService.getChangeHistory(req.user.id);
    return res.json({ success: true, data });
  } catch (error) { return respondError(res, error); }
};

exports.getLegacyPamitStatus = async (req, res) => {
  try {
    const data = await changeService.getLatestPamitStatus(req.user.id);
    return res.json({ success: true, data });
  } catch (error) { return respondError(res, error); }
};

exports.getLegacyPamitHistory = async (req, res) => {
  try {
    const data = await changeService.getPamitHistory(req.user.id);
    return res.json({ success: true, data, total: data.length });
  } catch (error) { return respondError(res, error); }
};
