"use strict";

const { SuratTugasPembimbing, PenetapanPembimbing, PeriodePenjaluran } = require("../models");
const { createSuratTugasDraft, issueSuratTugas, cancelSuratTugas } = require("../services/suratTugasPembimbingService");

const include = [
  { model: PeriodePenjaluran, as: "periode", attributes: ["id", "label_periode", "status"] },
  { model: PenetapanPembimbing, as: "penetapans", attributes: ["id", "mahasiswa_id", "status"] },
];

function sendError(res, error, fallback) {
  return res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : fallback, error: error.message, detail: error.detail || null });
}

exports.list = async (req, res) => {
  try {
    const where = req.query.periode_id ? { periode_penjaluran_id: Number(req.query.periode_id) } : {};
    const data = await SuratTugasPembimbing.findAll({ where, include, order: [["createdAt", "DESC"]] });
    return res.json({ success: true, data, total: data.length });
  } catch (error) { return sendError(res, error, "Gagal memuat surat tugas pembimbing."); }
};

exports.create = async (req, res) => {
  try {
    const surat = await createSuratTugasDraft({
      periodePenjaluranId: req.body.periode_penjaluran_id,
      nomorSurat: req.body.nomor_surat,
      tanggalSurat: req.body.tanggal_surat,
      tanggalBerlakuMulai: req.body.tanggal_berlaku_mulai,
      tanggalBerlakuSelesai: req.body.tanggal_berlaku_selesai,
      filePath: req.body.file_path,
      catatan: req.body.catatan,
      penetapanIds: req.body.penetapan_ids,
    });
    return res.status(201).json({ success: true, message: "Draft surat tugas berhasil dibuat.", data: surat });
  } catch (error) { return sendError(res, error, "Gagal membuat surat tugas pembimbing."); }
};

exports.issue = async (req, res) => {
  try {
    const data = await issueSuratTugas({ suratTugasId: Number(req.params.id), issuedBySekretarisId: req.user?.sekretaris_prodi_id || req.user?.id });
    return res.json({ success: true, message: "Surat tugas berhasil diterbitkan.", data });
  } catch (error) { return sendError(res, error, "Gagal menerbitkan surat tugas pembimbing."); }
};

exports.cancel = async (req, res) => {
  try {
    const data = await cancelSuratTugas({ suratTugasId: Number(req.params.id), catatan: req.body.catatan });
    return res.json({ success: true, message: "Surat tugas berhasil dibatalkan.", data });
  } catch (error) { return sendError(res, error, "Gagal membatalkan surat tugas pembimbing."); }
};
