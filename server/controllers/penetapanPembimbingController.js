"use strict";

const { Op } = require("sequelize");
const {
  Mahasiswa,
  Dosen,
  PeriodePenjaluran,
  PenetapanPembimbingDosen,
  PenetapanPembimbing,
  PendaftaranPenjaluran,
  SekretarisProdi,
} = require("../models");
const {
  getSupervisorAssignmentHistory,
  toAssignmentResponse,
} = require("../services/penetapanPembimbingService");

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

exports.getSupervisorAssignmentMonitoring = async (req, res) => {
  try {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 100);
    const where = {};
    const query = String(req.query.q || "").trim();
    const periodeId = Number(req.query.periode_id || 0);
    const dosenId = Number(req.query.dosen_id || 0);
    const status = String(req.query.status || "").trim();
    const sumberData = String(req.query.sumber_data || "").trim();

    if (periodeId > 0) where.periode_mulai_id = periodeId;
    if (["draft", "active", "ended", "cancelled"].includes(status)) where.status = status;
    if (["penjaluran", "perpanjangan", "pergantian", "legacy_backfill"].includes(sumberData)) {
      where.sumber_data = sumberData;
    }
    if (dosenId > 0) {
      const membershipRows = await PenetapanPembimbingDosen.findAll({
        where: { dosen_id: dosenId },
        attributes: ["penetapan_pembimbing_id"],
        raw: true,
      });
      where.id = {
        [Op.in]: membershipRows.map((item) => Number(item.penetapan_pembimbing_id)),
      };
    }

    const mahasiswaWhere = query
      ? {
          [Op.or]: [
            { nama: { [Op.iLike]: `%${query}%` } },
            { nim: { [Op.iLike]: `%${query}%` } },
          ],
        }
      : undefined;
    const include = [
      {
        model: Mahasiswa,
        as: "mahasiswa",
        attributes: ["id", "nim", "nama", "dosen_pembimbing_skripsi_id"],
        where: mahasiswaWhere,
        required: Boolean(mahasiswaWhere),
      },
      {
        model: PenetapanPembimbingDosen,
        as: "pembimbings",
        include: [{
          model: Dosen,
          as: "dosen",
          attributes: ["id", "kode_dosen", "nik", "nama", "gelar", "email"],
        }],
      },
      {
        model: PeriodePenjaluran,
        as: "periodeMulai",
        attributes: ["id", "label_periode", "tahun_akademik", "semester", "status"],
      },
      {
        model: PendaftaranPenjaluran,
        as: "pendaftaran",
        attributes: ["id", "periode_penjaluran_id", "jenis_jalur_diambil", "penjaluran_baru", "status"],
      },
      {
        model: SekretarisProdi,
        as: "createdBySekretaris",
        attributes: ["id", "nik", "nama", "email"],
      },
    ];

    const result = await PenetapanPembimbing.findAndCountAll({
      where,
      include,
      distinct: true,
      order: [["createdAt", "DESC"], ["id", "DESC"]],
      limit,
      offset: (page - 1) * limit,
    });
    const [periodes, dosens] = await Promise.all([
      PeriodePenjaluran.findAll({
        attributes: ["id", "label_periode"],
        order: [["tanggal_mulai", "DESC NULLS LAST"], ["id", "DESC"]],
      }),
      Dosen.findAll({
        attributes: ["id", "kode_dosen", "nik", "nama", "gelar"],
        order: [["nama", "ASC"]],
      }),
    ]);

    return res.json({
      success: true,
      data: {
        rows: result.rows.map(toAssignmentResponse),
        pagination: {
          page,
          limit,
          total: Number(result.count || 0),
          total_pages: Math.max(1, Math.ceil(Number(result.count || 0) / limit)),
        },
        filter_options: { periodes, dosens },
      },
    });
  } catch (error) {
    console.error("Error di getSupervisorAssignmentMonitoring:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal memuat monitoring riwayat penetapan pembimbing.",
      error: error.message,
    });
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
