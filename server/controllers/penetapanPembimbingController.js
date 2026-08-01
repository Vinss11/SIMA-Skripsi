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
  AssignmentActivationAttempt,
} = require("../models");
const {
  getSupervisorAssignmentHistory,
  toAssignmentResponse,
} = require("../services/penetapanPembimbingService");
const {
  SemesterAssignmentError,
  previewSemesterTransitions,
  carryForwardSemesterAssignment,
  activateScheduledAssignments,
} = require("../services/semesterAssignmentService");

function transitionError(res, error) {
  if (error instanceof SemesterAssignmentError) {
    return res.status(error.statusCode).json({ success: false, message: error.message, code: error.code, detail: error.detail || null });
  }
  console.error("Semester assignment transition error:", error);
  return res.status(500).json({ success: false, message: "Transisi semester gagal.", code: "INTERNAL_ERROR" });
}

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
    const semester = Number(req.query.semester_penjaluran_ke || 0);
    const endReasonCode = String(req.query.end_reason_code || "").trim();
    const semesterOutcomeCode = String(req.query.semester_outcome_code || "").trim();

    if (periodeId > 0) where.periode_mulai_id = periodeId;
    if (["draft", "scheduled", "active", "ended", "cancelled"].includes(status)) where.status = status;
    if ([1, 2, 3].includes(semester)) where.semester_penjaluran_ke = semester;
    if (endReasonCode) where.end_reason_code = endReasonCode;
    if (semesterOutcomeCode) where.semester_outcome_code = semesterOutcomeCode;
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
      { model: AssignmentActivationAttempt, as: "activationAttempt", required: false },
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

exports.previewSemesterTransitions = async (req, res) => {
  try {
    const sourcePeriodId = Number(req.query.source_period_id || req.query.periode_sumber_id);
    const targetPeriodId = Number(req.query.target_period_id || req.query.periode_tujuan_id) || null;
    if (!sourcePeriodId) return res.status(400).json({ success: false, message: "Periode sumber wajib dipilih." });
    return res.json({ success: true, data: await previewSemesterTransitions({ sourcePeriodId, targetPeriodId }) });
  } catch (error) {
    return transitionError(res, error);
  }
};

exports.confirmSemesterTransition = async (req, res) => {
  try {
    const idempotencyKey = String(req.get("Idempotency-Key") || req.body?.idempotency_key || "").trim();
    const result = await carryForwardSemesterAssignment({
      expectedAssignmentId: Number(req.body?.expected_assignment_id),
      targetPeriodId: Number(req.body?.target_period_id || req.body?.periode_tujuan_id) || null,
      effectiveAt: req.body?.effective_at || null,
      idempotencyKey,
      actorType: "sekretaris_prodi",
      actorId: Number(req.user?.id) || null,
    });
    if (result.group_needs_review === true) {
      return res.status(409).json({
        success: false,
        message: result.message || "Kelompok Perintisan memerlukan tindak lanjut sebelum dapat diproses.",
        code: "PERINTISAN_GROUP_REVIEW_REQUIRED",
        data: result,
      });
    }
    if (result.group_waiting_extensions === true) {
      return res.status(409).json({
        success: false,
        message: result.message,
        code: result.code || "PERINTISAN_GROUP_EXTENSIONS_PENDING",
        data: result,
      });
    }
    return res.status(result.replayed ? 200 : 201).json({ success: true, data: result });
  } catch (error) {
    return transitionError(res, error);
  }
};

exports.confirmSemesterTransitionsBulk = async (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  if (!items.length) return res.status(400).json({ success: false, message: "Daftar assignment wajib tersedia." });
  const batchKey = String(req.get("Idempotency-Key") || req.body?.idempotency_key || "").trim();
  if (!batchKey) return res.status(400).json({ success: false, message: "Idempotency-Key wajib dikirim.", code: "IDEMPOTENCY_KEY_REQUIRED" });
  const results = [];
  for (const item of items) {
    try {
      const value = await carryForwardSemesterAssignment({
        expectedAssignmentId: Number(item.expected_assignment_id),
        targetPeriodId: Number(item.target_period_id || req.body?.target_period_id) || null,
        effectiveAt: item.effective_at || req.body?.effective_at || null,
        idempotencyKey: `${batchKey}:${Number(item.expected_assignment_id)}`,
        actorType: "sekretaris_prodi",
        actorId: Number(req.user?.id) || null,
      });
      results.push({
        expected_assignment_id: Number(item.expected_assignment_id),
        success: value.group_needs_review !== true && value.group_waiting_extensions !== true,
        ...value,
      });
    } catch (error) {
      results.push({ expected_assignment_id: Number(item.expected_assignment_id), success: false, code: error.code || "INTERNAL_ERROR", message: error.message });
    }
  }
  return res.status(207).json({ success: true, data: { results } });
};

exports.activateDueSemesterTransitions = async (req, res) => {
  try {
    return res.json({ success: true, data: await activateScheduledAssignments({ limit: req.body?.limit }) });
  } catch (error) {
    return transitionError(res, error);
  }
};
