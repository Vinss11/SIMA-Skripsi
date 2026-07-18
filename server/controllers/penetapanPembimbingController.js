"use strict";

const { Mahasiswa, PenetapanPembimbingDosen, PenetapanPembimbing } = require("../models");
const { getSupervisorAssignmentHistory } = require("../services/penetapanPembimbingService");

async function respondHistory(res, mahasiswaId) {
  const mahasiswa = await Mahasiswa.findByPk(mahasiswaId, { attributes: ["id", "nim", "nama"] });
  if (!mahasiswa) return res.status(404).json({ success: false, message: "Mahasiswa tidak ditemukan." });
  const history = await getSupervisorAssignmentHistory(mahasiswa.id);
  return res.json({ success: true, data: { mahasiswa, ...history } });
}

exports.getMySupervisorAssignmentHistory = async (req, res) => {
  try {
    return await respondHistory(res, Number(req.user?.id));
  } catch (error) {
    console.error("Error di getMySupervisorAssignmentHistory:", error);
    return res.status(500).json({ success: false, message: "Gagal memuat histori pembimbing.", error: error.message });
  }
};

exports.getSupervisorAssignmentHistoryForSekretaris = async (req, res) => {
  try {
    return await respondHistory(res, Number(req.params.id));
  } catch (error) {
    console.error("Error di getSupervisorAssignmentHistoryForSekretaris:", error);
    return res.status(500).json({ success: false, message: "Gagal memuat histori pembimbing.", error: error.message });
  }
};

exports.getSupervisorAssignmentHistoryForDosen = async (req, res) => {
  try {
    const mahasiswaId = Number(req.params.id);
    const dosenId = Number(req.user?.id);
    const mahasiswa = await Mahasiswa.findByPk(mahasiswaId, {
      attributes: ["id", "dosen_pembimbing_akademik_id", "dosen_pembimbing_skripsi_id"],
    });
    if (!mahasiswa) return res.status(404).json({ success: false, message: "Mahasiswa tidak ditemukan." });
    const isLegacyRelated = [mahasiswa.dosen_pembimbing_akademik_id, mahasiswa.dosen_pembimbing_skripsi_id]
      .some((id) => Number(id) === dosenId);
    const isHistoryMember = isLegacyRelated ? true : Boolean(await PenetapanPembimbingDosen.findOne({
      where: { dosen_id: dosenId },
      include: [{
        model: PenetapanPembimbing,
        as: "penetapan",
        where: { mahasiswa_id: mahasiswaId },
        attributes: [],
        required: true,
      }],
      attributes: ["id"],
    }));
    if (!isHistoryMember) {
      return res.status(403).json({ success: false, message: "Anda tidak memiliki akses ke histori pembimbing mahasiswa ini." });
    }
    return await respondHistory(res, mahasiswaId);
  } catch (error) {
    console.error("Error di getSupervisorAssignmentHistoryForDosen:", error);
    return res.status(500).json({ success: false, message: "Gagal memuat histori pembimbing.", error: error.message });
  }
};
