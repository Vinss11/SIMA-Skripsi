"use strict";

const fs = require("fs");
const path = require("path");
const { Op } = require("sequelize");
const {
  sequelize,
  Dosen,
  Mahasiswa,
  PeriodeSidang,
  JadwalSidangPenguji,
  SidangPenilaian,
  SidangKeputusan,
  SidangRevisi,
  SidangRevisiPersetujuan,
} = require("../models");
const { createSystemNotification } = require("../services/notificationService");
const { NOTIFICATION_TYPES } = require("../constants/notificationTypes");

const SERVER_ROOT_DIR = path.resolve(__dirname, "..");
const UPLOAD_ROOT = process.env.VERCEL
  ? path.join("/tmp", "sima-uploads", "sidang-dokumen")
  : path.resolve(SERVER_ROOT_DIR, "uploads", "sidang-dokumen");
const VALID_DECISIONS = new Set(["lulus", "lulus_dengan_revisi", "tidak_lulus"]);
const VALID_GRADE_LETTERS = new Set([
  "A", "A-", "A/B", "B+", "B", "B-", "B/C", "C+", "C", "C-",
  "C/D", "D+", "D", "D-", "D/E", "E+", "E", "E-", "E/F", "F",
]);
const INVALID_ASSESSMENT_TEXT_CHARACTERS = new Set([
  "+", "=", "_", "{", "}", "[", "]", "<", ">", "?", "/", "\\", "|", ":", ";", "'", '"',
]);

function getAssessmentTextError(value, label) {
  const text = String(value || "").trim();
  const hasInvalidCharacter = Array.from(text).some((character) => {
    const code = character.charCodeAt(0);
    return INVALID_ASSESSMENT_TEXT_CHARACTERS.has(character) || code < 32 || code === 127;
  });
  if (!text || (!hasInvalidCharacter && !text.includes("--"))) return "";
  return `${label} tidak boleh mengandung karakter { } [ ] < > ? + = _ / \\ | : ; ' ", atau pola -- (komentar SQL).`;
}

function safeRelativePathFromAbsolute(absolutePath) {
  return path.relative(SERVER_ROOT_DIR, absolutePath || "").split(path.sep).join("/");
}

function resolveAbsoluteFilePath(storedPath) {
  if (!storedPath) return null;
  const absolute = path.resolve(SERVER_ROOT_DIR, storedPath);
  return absolute.startsWith(UPLOAD_ROOT) ? absolute : null;
}

function cleanupRequestFile(req) {
  try {
    if (req?.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
  } catch (_) {
    // best effort
  }
}

function sessionStartDate(schedule) {
  const dateOnly = String(schedule?.tanggal_sidang || "").slice(0, 10);
  const time = String(schedule?.sesi_mulai || "").slice(0, 5);
  const value = new Date(`${dateOnly}T${time}:00+07:00`);
  return Number.isNaN(value.getTime()) ? null : value;
}

function hasSessionStarted(schedule) {
  const start = sessionStartDate(schedule);
  return Boolean(start) && Date.now() >= start.getTime();
}

function examinerRole(schedule, dosenId) {
  if (Number(schedule?.penguji1_dosen_id) === Number(dosenId)) return "penguji1";
  if (Number(schedule?.penguji2_dosen_id) === Number(dosenId)) return "penguji2";
  return null;
}

function decisionLabel(value) {
  if (value === "lulus") return "Lulus";
  if (value === "lulus_dengan_revisi") return "Lulus dengan Revisi";
  if (value === "tidak_lulus") return "Tidak Lulus";
  return "Belum Diputuskan";
}

function serializeAssessment(item, currentDosenId = null) {
  const row = item?.toJSON ? item.toJSON() : item || {};
  const currentAssessment = (row.penilaians || []).find((assessment) => Number(assessment.dosen_id) === Number(currentDosenId));
  const latestRevision = [...(row.keputusanSidang?.revisis || [])]
    .sort((left, right) => Number(right.versi) - Number(left.versi))[0] || null;
  const currentApproval = latestRevision?.persetujuans?.find((approval) => Number(approval.dosen_id) === Number(currentDosenId)) || null;
  const start = sessionStartDate(row);
  return {
    id: row.id,
    tanggal_sidang: row.tanggal_sidang,
    sesi_ke: row.sesi_ke,
    sesi_mulai: row.sesi_mulai,
    sesi_selesai: row.sesi_selesai,
    ruangan: row.ruangan,
    assignment_status: row.assignment_status,
    session_start_at: start?.toISOString() || null,
    session_started: hasSessionStarted(row),
    peran_saya: examinerRole(row, currentDosenId),
    mahasiswa: row.mahasiswa || null,
    periode_sidang: row.periodeSidang || null,
    penguji1: row.penguji1 || null,
    penguji2: row.penguji2 || null,
    penilaians: row.penilaians || [],
    penilaian_saya: currentAssessment || null,
    keputusan: row.keputusanSidang || null,
    revisi_terakhir: latestRevision || null,
    persetujuan_revisi_saya: currentApproval,
    can_submit_assessment: hasSessionStarted(row) && !row.keputusanSidang,
    can_review_revision: Boolean(currentApproval) && currentApproval.status === "pending" && latestRevision?.status === "submitted",
  };
}

const assessmentInclude = [
  { model: Mahasiswa, as: "mahasiswa", attributes: ["id", "nim", "nama", "email"] },
  { model: PeriodeSidang, as: "periodeSidang", attributes: ["id", "label_periode", "tahun_akademik", "semester"] },
  { model: Dosen, as: "penguji1", attributes: ["id", "nik", "nama", "gelar"] },
  { model: Dosen, as: "penguji2", attributes: ["id", "nik", "nama", "gelar"] },
  { model: SidangPenilaian, as: "penilaians", include: [{ model: Dosen, as: "dosen", attributes: ["id", "nama", "gelar"] }] },
  {
    model: SidangKeputusan,
    as: "keputusanSidang",
    required: false,
    include: [{
      model: SidangRevisi,
      as: "revisis",
      required: false,
      include: [{ model: SidangRevisiPersetujuan, as: "persetujuans", include: [{ model: Dosen, as: "dosen", attributes: ["id", "nama", "gelar"] }] }],
    }],
  },
];

exports.getDosenAssessmentList = async (req, res) => {
  try {
    const dosenId = Number(req.user?.id || 0);
    const rows = await JadwalSidangPenguji.findAll({
      where: {
        assignment_status: { [Op.in]: ["assigned", "finalized"] },
        [Op.or]: [{ penguji1_dosen_id: dosenId }, { penguji2_dosen_id: dosenId }],
      },
      include: assessmentInclude,
      order: [["tanggal_sidang", "DESC"], ["sesi_ke", "ASC"]],
    });
    return res.json({ success: true, data: { rows: rows.map((item) => serializeAssessment(item, dosenId)) } });
  } catch (error) {
    console.error("Error di getDosenAssessmentList:", error);
    return res.status(500).json({ success: false, message: "Terjadi kesalahan saat memuat penilaian sidang.", error: error.message });
  }
};

exports.getDosenAssessmentDetail = async (req, res) => {
  try {
    const dosenId = Number(req.user?.id || 0);
    const row = await JadwalSidangPenguji.findByPk(Number(req.params.id), { include: assessmentInclude });
    if (!row || !examinerRole(row, dosenId)) return res.status(404).json({ success: false, message: "Jadwal sidang tidak ditemukan." });
    return res.json({ success: true, data: serializeAssessment(row, dosenId) });
  } catch (error) {
    console.error("Error di getDosenAssessmentDetail:", error);
    return res.status(500).json({ success: false, message: "Terjadi kesalahan saat memuat detail penilaian sidang.", error: error.message });
  }
};

exports.submitDosenAssessment = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const dosenId = Number(req.user?.id || 0);
    const schedule = await JadwalSidangPenguji.findByPk(Number(req.params.id), { transaction, lock: transaction.LOCK.UPDATE });
    const role = examinerRole(schedule, dosenId);
    if (!schedule || !role) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: "Jadwal sidang tidak ditemukan." });
    }
    if (!hasSessionStarted(schedule)) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: `Penilaian belum dapat diberikan. Sesi sidang dimulai pada ${schedule.tanggal_sidang} pukul ${schedule.sesi_mulai} WIB.`,
        detail: { code: "DEFENSE_SESSION_NOT_STARTED", tanggal_sidang: schedule.tanggal_sidang, sesi_mulai: schedule.sesi_mulai },
      });
    }
    const existingDecision = await SidangKeputusan.findOne({ where: { jadwal_sidang_id: schedule.id }, transaction, lock: transaction.LOCK.UPDATE });
    if (existingDecision) {
      await transaction.rollback();
      return res.status(409).json({ success: false, message: "Keputusan sidang sudah difinalisasi dan penilaian tidak dapat diubah." });
    }
    const existingAssessment = await SidangPenilaian.findOne({
      where: { jadwal_sidang_id: schedule.id, dosen_id: dosenId },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (existingAssessment) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: "Penilaian sudah dikirim dan tidak dapat diubah.",
      });
    }
    const nilai = Number(req.body?.nilai_akhir);
    const hurufNilai = String(req.body?.huruf_nilai || "").trim().toUpperCase();
    const keputusan = String(req.body?.keputusan || "").trim().toLowerCase();
    const catatan = String(req.body?.catatan || "").trim();
    const catatanRevisi = String(req.body?.catatan_revisi || "").trim();
    if (!Number.isFinite(nilai) || nilai < 0 || nilai > 100) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: "Nilai akhir wajib berada pada rentang 0 sampai 100." });
    }
    if (!VALID_GRADE_LETTERS.has(hurufNilai)) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: "Huruf nilai wajib dipilih dari pilihan yang tersedia." });
    }
    if (!VALID_DECISIONS.has(keputusan)) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: "Keputusan sidang tidak valid." });
    }
    const catatanError = getAssessmentTextError(catatan, "Catatan penilaian");
    if (catatanError) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: catatanError });
    }
    const catatanRevisiError = keputusan === "lulus_dengan_revisi"
      ? getAssessmentTextError(catatanRevisi, "Catatan revisi")
      : "";
    if (catatanRevisiError) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: catatanRevisiError });
    }
    if (keputusan === "lulus_dengan_revisi" && catatanRevisi.length < 5) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: "Catatan revisi wajib diisi minimal 5 karakter." });
    }
    if (keputusan === "tidak_lulus" && catatan.length < 5) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: "Alasan tidak lulus wajib diisi minimal 5 karakter pada catatan penilaian." });
    }

    const [assessment] = await SidangPenilaian.upsert({
      jadwal_sidang_id: schedule.id,
      dosen_id: dosenId,
      peran: role,
      nilai_akhir: nilai,
      huruf_nilai: hurufNilai,
      keputusan,
      catatan: catatan || null,
      catatan_revisi: keputusan === "lulus_dengan_revisi" ? catatanRevisi : null,
      submitted_at: new Date(),
    }, { transaction, returning: true });

    const assessments = await SidangPenilaian.findAll({ where: { jadwal_sidang_id: schedule.id }, transaction, lock: transaction.LOCK.UPDATE });
    let finalDecision = null;
    if (assessments.length >= 2) {
      const decisions = assessments.map((item) => item.keputusan);
      const finalValue = decisions.includes("tidak_lulus")
        ? "tidak_lulus"
        : decisions.includes("lulus_dengan_revisi") ? "lulus_dengan_revisi" : "lulus";
      const average = assessments.reduce((total, item) => total + Number(item.nilai_akhir || 0), 0) / assessments.length;
      finalDecision = await SidangKeputusan.create({
        jadwal_sidang_id: schedule.id,
        keputusan: finalValue,
        status_kelulusan: finalValue === "lulus" ? "lulus" : finalValue === "tidak_lulus" ? "tidak_lulus" : "lulus_bersyarat",
        nilai_akhir: Math.round(average * 100) / 100,
        catatan_final: assessments.map((item) => [item.peran === "penguji1" ? "Penguji 1" : "Penguji 2", item.catatan].filter(Boolean).join(": ")).filter(Boolean).join("\n") || null,
        decided_at: new Date(),
      }, { transaction });
      await createSystemNotification({
        recipientType: "mahasiswa",
        recipientId: Number(schedule.mahasiswa_id),
        type: NOTIFICATION_TYPES.DEFENSE_DECIDED_STUDENT,
        message: `Keputusan sidang Anda: ${decisionLabel(finalValue)}.`,
        referenceType: "sidang_keputusan",
        referenceId: finalDecision.id,
        actionKey: "defense_result",
        deduplicationKey: `sidang-keputusan:${finalDecision.id}`,
        transaction,
      });
    }
    await transaction.commit();
    return res.json({ success: true, message: finalDecision ? `Penilaian tersimpan. Keputusan akhir: ${decisionLabel(finalDecision.keputusan)}.` : "Penilaian tersimpan dan menunggu penilaian penguji lainnya.", data: { assessment, keputusan: finalDecision } });
  } catch (error) {
    try { await transaction.rollback(); } catch (_) {}
    console.error("Error di submitDosenAssessment:", error);
    return res.status(500).json({ success: false, message: "Terjadi kesalahan saat menyimpan penilaian sidang.", error: error.message });
  }
};

exports.getMahasiswaDefenseResult = async (req, res) => {
  try {
    const mahasiswaId = Number(req.user?.id || 0);
    const row = await JadwalSidangPenguji.findOne({
      where: { mahasiswa_id: mahasiswaId, assignment_status: { [Op.in]: ["assigned", "finalized"] } },
      include: assessmentInclude,
      order: [["tanggal_sidang", "DESC"], ["id", "DESC"]],
    });
    return res.json({ success: true, data: row ? serializeAssessment(row) : null });
  } catch (error) {
    console.error("Error di getMahasiswaDefenseResult:", error);
    return res.status(500).json({ success: false, message: "Terjadi kesalahan saat memuat hasil sidang.", error: error.message });
  }
};

exports.uploadMahasiswaDefenseRevision = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const mahasiswaId = Number(req.user?.id || 0);
    if (!req.file) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: "File skripsi hasil revisi wajib diunggah." });
    }
    const tanggapan = String(req.body?.tanggapan_revisi || "").trim();
    if (tanggapan.length < 10) {
      cleanupRequestFile(req);
      await transaction.rollback();
      return res.status(400).json({ success: false, message: "Tanggapan revisi wajib diisi minimal 10 karakter." });
    }
    const decision = await SidangKeputusan.findOne({
      include: [{ model: JadwalSidangPenguji, as: "jadwalSidang", required: true, where: { mahasiswa_id: mahasiswaId } }],
      order: [["decided_at", "DESC"]], transaction, lock: transaction.LOCK.UPDATE,
    });
    if (!decision || decision.status_kelulusan !== "lulus_bersyarat") {
      cleanupRequestFile(req);
      await transaction.rollback();
      return res.status(409).json({ success: false, message: "Tidak ada revisi sidang yang sedang menunggu unggahan." });
    }
    const latestRevision = await SidangRevisi.findOne({ where: { keputusan_sidang_id: decision.id }, order: [["versi", "DESC"]], transaction, lock: transaction.LOCK.UPDATE });
    if (latestRevision?.status === "submitted") {
      cleanupRequestFile(req);
      await transaction.rollback();
      return res.status(409).json({ success: false, message: "Revisi terakhir masih menunggu review dosen." });
    }
    const revision = await SidangRevisi.create({
      keputusan_sidang_id: decision.id,
      versi: Number(latestRevision?.versi || 0) + 1,
      file_path: safeRelativePathFromAbsolute(req.file.path),
      file_name: String(req.file.originalname || req.file.filename || "revisi-skripsi").slice(0, 255),
      tanggapan_revisi: tanggapan,
      status: "submitted",
      uploaded_at: new Date(),
    }, { transaction });
    const revisionAssessments = await SidangPenilaian.findAll({ where: { jadwal_sidang_id: decision.jadwal_sidang_id, keputusan: "lulus_dengan_revisi" }, transaction });
    const requiredDosenIds = [...new Set(revisionAssessments.map((item) => Number(item.dosen_id)).filter(Boolean))];
    for (const dosenId of requiredDosenIds) {
      await SidangRevisiPersetujuan.create({ sidang_revisi_id: revision.id, dosen_id: dosenId, status: "pending" }, { transaction });
      await createSystemNotification({
        recipientType: "dosen", recipientId: dosenId, type: NOTIFICATION_TYPES.DEFENSE_REVISION_SUBMITTED_LECTURER,
        message: `Mahasiswa mengunggah revisi skripsi versi ${revision.versi} untuk diperiksa.`, referenceType: "sidang_revisi", referenceId: revision.id,
        actionKey: "defense_revision_review", deduplicationKey: `sidang-revisi:${revision.id}:dosen:${dosenId}`, transaction,
      });
    }
    await transaction.commit();
    return res.json({ success: true, message: `Revisi skripsi versi ${revision.versi} berhasil diunggah.`, data: { revisi: revision } });
  } catch (error) {
    cleanupRequestFile(req);
    try { await transaction.rollback(); } catch (_) {}
    console.error("Error di uploadMahasiswaDefenseRevision:", error);
    return res.status(500).json({ success: false, message: "Terjadi kesalahan saat mengunggah revisi sidang.", error: error.message });
  }
};

exports.reviewDosenDefenseRevision = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const dosenId = Number(req.user?.id || 0);
    const revision = await SidangRevisi.findByPk(Number(req.params.id), { transaction, lock: transaction.LOCK.UPDATE });
    const approval = revision ? await SidangRevisiPersetujuan.findOne({ where: { sidang_revisi_id: revision.id, dosen_id: dosenId }, transaction, lock: transaction.LOCK.UPDATE }) : null;
    if (!revision || !approval) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: "Revisi sidang tidak ditemukan." });
    }
    if (revision.status !== "submitted" || approval.status !== "pending") {
      await transaction.rollback();
      return res.status(409).json({ success: false, message: "Revisi ini sudah selesai direview." });
    }
    const status = String(req.body?.status || "").toLowerCase();
    const catatan = String(req.body?.catatan || "").trim();
    if (!new Set(["approved", "revision_required"]).has(status)) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: "Keputusan review revisi tidak valid." });
    }
    if (status === "revision_required" && catatan.length < 5) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: "Catatan revisi lanjutan wajib diisi minimal 5 karakter." });
    }
    approval.status = status;
    approval.catatan = catatan || null;
    approval.reviewed_at = new Date();
    await approval.save({ transaction });
    const approvals = await SidangRevisiPersetujuan.findAll({ where: { sidang_revisi_id: revision.id }, transaction });
    const decision = await SidangKeputusan.findByPk(revision.keputusan_sidang_id, { transaction, lock: transaction.LOCK.UPDATE });
    if (approvals.some((item) => item.status === "revision_required")) {
      revision.status = "revision_required";
    } else if (approvals.length > 0 && approvals.every((item) => item.status === "approved")) {
      revision.status = "approved";
      decision.status_kelulusan = "lulus";
      await decision.save({ transaction });
    }
    await revision.save({ transaction });
    const schedule = await JadwalSidangPenguji.findByPk(decision.jadwal_sidang_id, { transaction });
    await createSystemNotification({
      recipientType: "mahasiswa", recipientId: Number(schedule.mahasiswa_id), type: NOTIFICATION_TYPES.DEFENSE_REVISION_DECIDED_STUDENT,
      message: revision.status === "approved" ? "Seluruh revisi sidang telah disetujui. Anda dinyatakan lulus sepenuhnya." : status === "revision_required" ? "Revisi sidang perlu diperbaiki kembali. Periksa catatan dosen." : "Sebagian persetujuan revisi telah diberikan.",
      referenceType: "sidang_revisi", referenceId: revision.id, actionKey: "defense_result",
      deduplicationKey: `sidang-revisi:${revision.id}:review:${approval.id}:${status}`, transaction,
    });
    await transaction.commit();
    return res.json({ success: true, message: status === "approved" ? "Revisi berhasil disetujui." : "Revisi dikembalikan kepada mahasiswa.", data: { status_revisi: revision.status, status_kelulusan: decision.status_kelulusan } });
  } catch (error) {
    try { await transaction.rollback(); } catch (_) {}
    console.error("Error di reviewDosenDefenseRevision:", error);
    return res.status(500).json({ success: false, message: "Terjadi kesalahan saat mereview revisi sidang.", error: error.message });
  }
};

async function downloadRevision(req, res, actor) {
  try {
    const revision = await SidangRevisi.findByPk(Number(req.params.id), {
      include: [{ model: SidangKeputusan, as: "keputusanSidang", include: [{ model: JadwalSidangPenguji, as: "jadwalSidang" }] }],
    });
    const schedule = revision?.keputusanSidang?.jadwalSidang;
    const actorId = Number(req.user?.id || 0);
    const allowed = actor === "mahasiswa"
      ? Number(schedule?.mahasiswa_id) === actorId
      : [Number(schedule?.penguji1_dosen_id), Number(schedule?.penguji2_dosen_id)].includes(actorId);
    if (!revision || !allowed) return res.status(404).json({ success: false, message: "Dokumen revisi tidak ditemukan." });
    const absolute = resolveAbsoluteFilePath(revision.file_path);
    if (!absolute || !fs.existsSync(absolute)) return res.status(404).json({ success: false, message: "File revisi tidak ditemukan." });
    return res.download(absolute, revision.file_name || path.basename(absolute));
  } catch (error) {
    return res.status(500).json({ success: false, message: "Terjadi kesalahan saat mengunduh revisi.", error: error.message });
  }
}

exports.downloadMahasiswaDefenseRevision = (req, res) => downloadRevision(req, res, "mahasiswa");
exports.downloadDosenDefenseRevision = (req, res) => downloadRevision(req, res, "dosen");
