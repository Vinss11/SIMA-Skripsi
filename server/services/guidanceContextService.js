"use strict";

const { Op } = require("sequelize");
const { PenetapanPembimbing, PenetapanPembimbingDosen, PendaftaranPenjaluran, PeriodePenjaluran, Dosen } = require("../models");
const { canContinueExistingSupervision } = require("./dosenStatusService");

const DEFAULT_PROGRAM_STUDI_CODE = String(process.env.KODE_PROGRAM_STUDI || "INFORMATIKA").trim().toUpperCase();

function resolveProgramStudiCode(registration = null) {
  return String(registration?.kode_program_studi || DEFAULT_PROGRAM_STUDI_CODE).trim().toUpperCase();
}

class GuidanceContextError extends Error {
  constructor(message, status = 409, code = "GUIDANCE_CONTEXT_INVALID", detail = null) {
    super(message); this.status = status; this.code = code; this.detail = detail;
  }
}

function resolveTrack(registration) {
  if (!registration) return null;
  if (registration.jalur === "alih") return registration.penjaluran_baru || null;
  return registration.jenis_jalur_diambil || null;
}

async function resolveActiveGuidanceContext(mahasiswaId, { targetMemberId = null, targetDosenId = null, transaction = null, lock = false } = {}) {
  const assignment = await PenetapanPembimbing.findOne({
    where: { mahasiswa_id: mahasiswaId, status: "active", [Op.or]: [{ effective_at: null }, { effective_at: { [Op.lte]: new Date() } }] },
    include: [
      { model: PenetapanPembimbingDosen, as: "pembimbings", where: { status: "active" }, required: true, include: [{ model: Dosen, as: "dosen" }] },
      { model: PendaftaranPenjaluran, as: "pendaftaran", required: true, include: [{ model: PeriodePenjaluran, as: "periode" }] },
    ],
    order: [[{ model: PenetapanPembimbingDosen, as: "pembimbings" }, "urutan", "ASC"]],
    transaction,
  });
  if (!assignment) {
    throw new GuidanceContextError(
      "Dosen pembimbing skripsi Anda belum ditetapkan. Silakan menunggu proses penetapan oleh Sekretaris Prodi.",
      409,
      "GUIDANCE_ASSIGNMENT_REQUIRED"
    );
  }
  if (lock && transaction) {
    await PenetapanPembimbing.findByPk(assignment.id, { transaction, lock: transaction.LOCK.UPDATE });
    await PenetapanPembimbingDosen.findAll({ where: { penetapan_pembimbing_id: assignment.id, status: "active" }, transaction, lock: transaction.LOCK.UPDATE });
  }
  const registration = assignment.pendaftaran;
  const track = resolveTrack(registration);
  if (!["penelitian", "magang", "perintisan_bisnis"].includes(track)) {
    throw new GuidanceContextError("Workflow bimbingan baru belum tersedia untuk jalur ini.", 409, "GUIDANCE_TRACK_NOT_ENABLED", { jalur: track });
  }
  let member = null;
  if (targetMemberId) member = assignment.pembimbings.find((item) => Number(item.id) === Number(targetMemberId));
  else if (targetDosenId) member = assignment.pembimbings.find((item) => Number(item.dosen_id) === Number(targetDosenId));
  if ((targetMemberId || targetDosenId) && !member) throw new GuidanceContextError("Pembimbing tujuan bukan anggota assignment aktif.", 409, "GUIDANCE_TARGET_MISMATCH");
  if (member && !canContinueExistingSupervision(member.dosen)) {
    throw new GuidanceContextError("Status dosen tujuan tidak mengizinkan kelanjutan bimbingan.", 409, "GUIDANCE_REVIEWER_UNAVAILABLE",
      { dosen_id: member.dosen_id, status_keaktifan: member.dosen?.status_keaktifan });
  }
  const academicPeriodId = registration.periode?.periode_akademik_id || null;
  if (!academicPeriodId) throw new GuidanceContextError("Periode akademik assignment belum dipetakan.", 409, "GUIDANCE_ACADEMIC_PERIOD_REQUIRED");
  return {
    assignment, registration, member, members: assignment.pembimbings,
    program: { kode_program_studi: resolveProgramStudiCode(registration), program_kuliah: registration.program_kuliah || null },
    snapshot: {
      pendaftaran_penjaluran_id: registration.id,
      target_assignment_id: assignment.id,
      target_assignment_member_id: member?.id || null,
      target_urutan_snapshot: member?.urutan || null,
      effective_reviewer_assignment_id: assignment.id,
      effective_reviewer_assignment_member_id: member?.id || null,
      periode_akademik_id: academicPeriodId,
      semester_penjaluran_ke_snapshot: assignment.semester_penjaluran_ke,
      jalur_snapshot: track,
      cycle_type_snapshot: registration.jalur,
    },
  };
}

module.exports = { DEFAULT_PROGRAM_STUDI_CODE, GuidanceContextError, resolveTrack, resolveProgramStudiCode, resolveActiveGuidanceContext };
