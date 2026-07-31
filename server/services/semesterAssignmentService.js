"use strict";

const crypto = require("crypto");
const { Op } = require("sequelize");
const {
  sequelize,
  Mahasiswa,
  Dosen,
  PendaftaranPenjaluran,
  PeriodePenjaluran,
  PenetapanPembimbing,
  PenetapanPembimbingDosen,
  IzinLanjutSkripsi,
  AssignmentActivationAttempt,
} = require("../models");
const { getDosenStatusDecision } = require("./dosenStatusPolicy");
const { createSupervisorAssignmentNotifications, createSystemNotification } = require("./notificationService");
const { NOTIFICATION_TYPES } = require("../constants/notificationTypes");

const END_REASON_LABELS = Object.freeze({
  semester_carried_forward: "Dilanjutkan ke semester penjaluran berikutnya.",
  supervisor_replaced: "Pembimbing diganti dalam semester yang sama.",
  pamit_approved: "Pamit untuk ulang/alih jalur disetujui.",
  assignment_term_expired: "Masa penetapan semester berakhir.",
  extension_rejected: "Izin melanjutkan ke semester ketiga ditolak.",
  student_completed: "Mahasiswa menyelesaikan proses.",
  workflow_cancelled: "Workflow penetapan dibatalkan.",
  legacy_reconciled: "Histori lama direkonsiliasi.",
});

class SemesterAssignmentError extends Error {
  constructor(message, statusCode = 409, code = "ASSIGNMENT_TRANSITION_CONFLICT", detail = null) {
    super(message);
    this.name = "SemesterAssignmentError";
    this.statusCode = statusCode;
    this.code = code;
    this.detail = detail;
  }
}

function fingerprint(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function periodRank(period) {
  const match = String(period?.tahun_akademik || "").match(/(\d{4})/);
  const semester = String(period?.semester || "").toLowerCase();
  if (!match || !["ganjil", "genap"].includes(semester)) return null;
  return Number(match[1]) * 2 + (semester === "genap" ? 1 : 0);
}

async function resolveNextAcademicPeriod(sourcePeriodId, requestedTargetId = null, transaction = null) {
  const source = await PeriodePenjaluran.findByPk(sourcePeriodId, { transaction });
  if (!source || periodRank(source) == null) {
    throw new SemesterAssignmentError("Periode sumber tidak memiliki metadata akademik yang valid.", 409, "SOURCE_PERIOD_INVALID");
  }
  const targetRank = periodRank(source) + 1;
  const periods = await PeriodePenjaluran.findAll({ transaction });
  const matches = periods.filter((item) => periodRank(item) === targetRank);
  if (matches.length !== 1) {
    throw new SemesterAssignmentError(
      matches.length === 0 ? "Periode akademik berikutnya belum tersedia." : "Periode akademik berikutnya ambigu.",
      409,
      matches.length === 0 ? "TARGET_PERIOD_MISSING" : "TARGET_PERIOD_AMBIGUOUS"
    );
  }
  if (requestedTargetId && Number(matches[0].id) !== Number(requestedTargetId)) {
    throw new SemesterAssignmentError("Periode tujuan bukan periode tepat setelah assignment sumber.", 409, "TARGET_PERIOD_NOT_SEQUENTIAL");
  }
  return matches[0];
}

async function loadAssignment(id, transaction, lock = false) {
  if (lock && transaction) {
    const locked = await PenetapanPembimbing.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!locked) return null;
  }
  return PenetapanPembimbing.findByPk(id, {
    include: [
      { model: PenetapanPembimbingDosen, as: "pembimbings", include: [{ model: Dosen, as: "dosen" }] },
      { model: PendaftaranPenjaluran, as: "pendaftaran" },
      { model: PeriodePenjaluran, as: "periodeMulai" },
      { model: Mahasiswa, as: "mahasiswa", attributes: ["id", "nim", "nama", "dosen_pembimbing_skripsi_id"] },
    ],
    transaction,
  });
}

function assertMemberIntegrity(assignment) {
  const members = [...(assignment?.pembimbings || [])].sort((a, b) => Number(a.urutan) - Number(b.urutan));
  if (members.length < 1 || members.length > 2 || Number(members[0]?.urutan) !== 1) {
    throw new SemesterAssignmentError("Komposisi anggota assignment tidak konsisten.", 409, "ASSIGNMENT_MEMBER_INVALID");
  }
  if (new Set(members.map((item) => Number(item.dosen_id))).size !== members.length) {
    throw new SemesterAssignmentError("Dosen assignment terduplikasi.", 409, "ASSIGNMENT_MEMBER_INVALID");
  }
  return members;
}

function assertCanContinue(members) {
  const blocked = members.filter((member) => !getDosenStatusDecision({
    statusKeaktifan: member.dosen?.status_keaktifan,
    accountIsActive: member.dosen?.account_is_active,
    continueExistingSupervision: member.dosen?.continue_existing_supervision,
  }).can_continue_existing_supervision);
  if (blocked.length) {
    throw new SemesterAssignmentError("Ada pembimbing yang tidak boleh melanjutkan bimbingan lama.", 409, "SUPERVISOR_FOLLOWUP_REQUIRED", {
      dosen_ids: blocked.map((item) => Number(item.dosen_id)),
    });
  }
}

async function activateScheduledAssignment({ assignmentId, now = new Date(), actorType = "system", actorId = null, transaction = null }) {
  const run = async (t) => {
    const target = await loadAssignment(assignmentId, t, true);
    if (!target) throw new SemesterAssignmentError("Assignment terjadwal tidak ditemukan.", 404, "ASSIGNMENT_NOT_FOUND");
    if (target.status === "active") return { assignment: target, replayed: true };
    if (!['scheduled', 'draft'].includes(target.status)) {
      throw new SemesterAssignmentError("Assignment tidak dapat diaktifkan dari status saat ini.", 409);
    }
    const effectiveAt = new Date(target.effective_at || now);
    if (effectiveAt > new Date(now)) {
      throw new SemesterAssignmentError("Assignment belum mencapai waktu efektif.", 409, "ASSIGNMENT_NOT_DUE");
    }
    const source = await loadAssignment(target.previous_assignment_id, t, true);
    if (!source || source.status !== "active" || Number(source.mahasiswa_id) !== Number(target.mahasiswa_id)) {
      throw new SemesterAssignmentError("Assignment sumber sudah berubah.", 409, "ASSIGNMENT_CHANGED");
    }
    const targetMembers = assertMemberIntegrity(target);
    assertCanContinue(targetMembers);
    const activeElsewhere = await PenetapanPembimbing.findOne({
      where: { mahasiswa_id: target.mahasiswa_id, status: "active", id: { [Op.ne]: source.id } },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (activeElsewhere) throw new SemesterAssignmentError("Mahasiswa memiliki assignment aktif lain.", 409, "MULTIPLE_ACTIVE_ASSIGNMENTS");

    const outcome = Number(target.semester_penjaluran_ke) === 3 ? "extension_approved" : "continued";
    await source.update({
      status: "ended",
      tanggal_selesai: effectiveAt,
      end_reason_code: "semester_carried_forward",
      assignment_transition_code: "semester_carried_forward",
      semester_outcome_code: outcome,
      alasan_berakhir: END_REASON_LABELS.semester_carried_forward,
      ended_by_actor_type: actorType,
      ended_by_actor_id: actorId,
    }, { transaction: t });
    await PenetapanPembimbingDosen.update({ status: "ended", tanggal_selesai: effectiveAt }, {
      where: { penetapan_pembimbing_id: source.id }, transaction: t,
    });
    await target.update({
      status: "active",
      tanggal_mulai: effectiveAt,
      activated_at: new Date(now),
      semester_outcome_code: "in_progress",
    }, { transaction: t });
    await PenetapanPembimbingDosen.update({ status: "active", tanggal_mulai: effectiveAt, tanggal_selesai: null }, {
      where: { penetapan_pembimbing_id: target.id }, transaction: t,
    });
    const p1 = targetMembers.find((item) => Number(item.urutan) === 1);
    await Mahasiswa.update({ dosen_pembimbing_skripsi_id: p1.dosen_id }, { where: { id: target.mahasiswa_id }, transaction: t });
    await createSupervisorAssignmentNotifications({
      assignmentId: target.id,
      mahasiswa: target.mahasiswa,
      previousMembers: source.pembimbings,
      newMembers: targetMembers,
      effectiveDate: effectiveAt,
      assignmentSource: "perpanjangan",
      transaction: t,
    });
    return { assignment: await loadAssignment(target.id, t), replayed: false };
  };
  return transaction ? run(transaction) : sequelize.transaction(run);
}

async function carryForwardSemesterAssignment({
  expectedAssignmentId,
  targetPeriodId = null,
  effectiveAt = null,
  idempotencyKey,
  actorType = "sekretaris_prodi",
  actorId = null,
  izinLanjutId = null,
  targetSemester = null,
  transaction = null,
}) {
  if (!idempotencyKey) throw new SemesterAssignmentError("Idempotency-Key wajib dikirim.", 400, "IDEMPOTENCY_KEY_REQUIRED");
  const requestPrint = fingerprint({ expectedAssignmentId: Number(expectedAssignmentId), targetPeriodId: Number(targetPeriodId) || null, effectiveAt: effectiveAt || null, izinLanjutId: Number(izinLanjutId) || null });
  const run = async (t) => {
    const replay = await PenetapanPembimbing.findOne({ where: { idempotency_key: idempotencyKey }, transaction: t, lock: t.LOCK.UPDATE });
    if (replay) {
      if (replay.request_fingerprint !== requestPrint) throw new SemesterAssignmentError("Idempotency-Key digunakan untuk payload berbeda.", 409, "ASSIGNMENT_TRANSITION_CONFLICT");
      return { assignment: await loadAssignment(replay.id, t), replayed: true };
    }
    const source = await loadAssignment(expectedAssignmentId, t, true);
    if (!source || source.status !== "active") throw new SemesterAssignmentError("Assignment sumber tidak lagi aktif.", 409, "ASSIGNMENT_CHANGED");
    await Mahasiswa.findByPk(source.mahasiswa_id, { transaction: t, lock: t.LOCK.UPDATE });
    await PendaftaranPenjaluran.findByPk(source.pendaftaran_penjaluran_id, { transaction: t, lock: t.LOCK.UPDATE });
    const selectedTrack = String(source.pendaftaran?.jenis_jalur_diambil || source.pendaftaran?.penjaluran_baru || "").toLowerCase();
    if (selectedTrack === "perintisan_bisnis") {
      throw new SemesterAssignmentError(
        "Carry-forward Perintisan Bisnis menunggu kontrak atomicity kelompok dan tidak boleh diproses per anggota.",
        409,
        "PERINTISAN_GROUP_ATOMICITY_REQUIRED"
      );
    }
    const members = assertMemberIntegrity(source);
    assertCanContinue(members);
    const nextSemester = Number(targetSemester || Number(source.semester_penjaluran_ke) + 1);
    if (nextSemester !== Number(source.semester_penjaluran_ke) + 1 || nextSemester > 3) {
      throw new SemesterAssignmentError("Nomor semester tujuan tidak berurutan atau melebihi batas.", 409, "SEMESTER_SEQUENCE_INVALID");
    }
    if (nextSemester === 3 && !izinLanjutId) throw new SemesterAssignmentError("Semester ketiga wajib berasal dari izin lanjut.", 409, "EXTENSION_REQUIRED");
    const targetPeriod = await resolveNextAcademicPeriod(source.periode_mulai_id, targetPeriodId, t);
    const existing = await PenetapanPembimbing.findOne({
      where: { pendaftaran_penjaluran_id: source.pendaftaran_penjaluran_id, semester_penjaluran_ke: nextSemester }, transaction: t,
    });
    if (existing) throw new SemesterAssignmentError("Semester tujuan sudah mempunyai assignment.", 409, "SEMESTER_ALREADY_PROCESSED");
    const effective = new Date(effectiveAt || targetPeriod.tanggal_mulai || new Date());
    if (Number.isNaN(effective.getTime())) throw new SemesterAssignmentError("Waktu efektif tidak valid.", 400, "EFFECTIVE_AT_INVALID");
    const scheduled = effective > new Date();
    const target = await PenetapanPembimbing.create({
      mahasiswa_id: source.mahasiswa_id,
      pendaftaran_penjaluran_id: source.pendaftaran_penjaluran_id,
      periode_mulai_id: targetPeriod.id,
      semester_penjaluran_ke: nextSemester,
      status: scheduled ? "scheduled" : "draft",
      sumber_data: "perpanjangan",
      previous_assignment_id: source.id,
      assignment_transition_code: nextSemester === 3 ? "extension_assignment_created" : "semester_carried_forward",
      semester_outcome_code: scheduled ? null : "in_progress",
      izin_lanjut_id: izinLanjutId,
      effective_at: effective,
      decision_at: new Date(),
      idempotency_key: idempotencyKey,
      request_fingerprint: requestPrint,
      created_by_sekretaris_id: actorType === "sekretaris_prodi" ? actorId : null,
    }, { transaction: t });
    await PenetapanPembimbingDosen.bulkCreate(members.map((member) => ({
      penetapan_pembimbing_id: target.id,
      dosen_id: member.dosen_id,
      urutan: member.urutan,
      peran: member.peran,
      status: scheduled ? "scheduled" : "draft",
    })), { transaction: t });
    if (scheduled) {
      await createSystemNotification({
        recipientType: "mahasiswa",
        recipientId: source.mahasiswa_id,
        type: NOTIFICATION_TYPES.SEMESTER_TRANSITION_SCHEDULED_STUDENT,
        message: `Kelanjutan ke semester penjaluran ${nextSemester} telah dijadwalkan.`,
        referenceType: "penetapan_pembimbing",
        referenceId: target.id,
        actionKey: "student_supervisor_history",
        metadata: { effective_at: effective, semester_penjaluran_ke: nextSemester },
        deduplicationKey: `semester-transition:${target.id}:scheduled:mahasiswa:${source.mahasiswa_id}`,
        transaction: t,
      });
      for (const member of members) {
        await createSystemNotification({
          recipientType: "dosen",
          recipientId: member.dosen_id,
          type: NOTIFICATION_TYPES.SEMESTER_TRANSITION_SCHEDULED_LECTURER,
          message: `Kelanjutan bimbingan ${source.mahasiswa?.nama || "mahasiswa"} ke semester ${nextSemester} telah dijadwalkan.`,
          referenceType: "penetapan_pembimbing",
          referenceId: target.id,
          actionKey: "lecturer_supervised_student",
          metadata: { effective_at: effective, semester_penjaluran_ke: nextSemester },
          deduplicationKey: `semester-transition:${target.id}:scheduled:dosen:${member.dosen_id}`,
          transaction: t,
        });
      }
      return { assignment: await loadAssignment(target.id, t), replayed: false, scheduled: true };
    }
    return activateScheduledAssignment({ assignmentId: target.id, now: new Date(), actorType, actorId, transaction: t });
  };
  return transaction ? run(transaction) : sequelize.transaction(run);
}

async function activateScheduledAssignments({ now = new Date(), limit = 50 } = {}) {
  const due = await PenetapanPembimbing.findAll({
    where: { status: "scheduled", effective_at: { [Op.lte]: now } },
    order: [["effective_at", "ASC"], ["id", "ASC"]],
    limit: Math.min(Math.max(Number(limit) || 50, 1), 200),
  });
  const result = { activated: [], failed: [] };
  for (const row of due) {
    try {
      await activateScheduledAssignment({ assignmentId: row.id, now });
      const [attempt, created] = await AssignmentActivationAttempt.findOrCreate({
        where: { penetapan_pembimbing_id: row.id },
        defaults: { status: "activated", attempt_count: 1, last_attempt_at: now, activated_at: now },
      });
      if (!created) await attempt.update({
        status: "activated", attempt_count: Number(attempt.attempt_count || 0) + 1,
        last_attempt_at: now, activated_at: now, error_code: null, error_message: null,
      });
      result.activated.push(row.id);
    } catch (error) {
      const [attempt, created] = await AssignmentActivationAttempt.findOrCreate({
        where: { penetapan_pembimbing_id: row.id },
        defaults: { status: "activation_failed", attempt_count: 1, last_attempt_at: now, error_code: error.code || "ACTIVATION_FAILED", error_message: error.message },
      });
      if (!created) await attempt.update({
        status: "activation_failed", attempt_count: Number(attempt.attempt_count || 0) + 1,
        last_attempt_at: now, error_code: error.code || "ACTIVATION_FAILED", error_message: error.message,
      });
      result.failed.push({ id: row.id, code: error.code || "ACTIVATION_FAILED", message: error.message });
    }
  }
  return result;
}

async function previewSemesterTransitions({ sourcePeriodId, targetPeriodId = null }) {
  const sourceRows = await PenetapanPembimbing.findAll({
    where: { periode_mulai_id: sourcePeriodId, semester_penjaluran_ke: 1, status: { [Op.in]: ["active", "ended"] } },
    include: [
      { model: Mahasiswa, as: "mahasiswa", attributes: ["id", "nim", "nama"] },
      { model: PendaftaranPenjaluran, as: "pendaftaran" },
      { model: PenetapanPembimbingDosen, as: "pembimbings", include: [{ model: Dosen, as: "dosen" }] },
    ],
    order: [["id", "ASC"]],
  });
  const target = await resolveNextAcademicPeriod(sourcePeriodId, targetPeriodId);
  const rows = [];
  for (const source of sourceRows) {
    let classification = "ready";
    let reason_code = null;
    const already = await PenetapanPembimbing.findOne({ where: { pendaftaran_penjaluran_id: source.pendaftaran_penjaluran_id, semester_penjaluran_ke: 2 } });
    if (already) { classification = "already_processed"; reason_code = "SEMESTER_ALREADY_PROCESSED"; }
    else if (source.status !== "active") { classification = "completed_or_ended"; reason_code = source.end_reason_code || "ASSIGNMENT_ENDED"; }
    else {
      const selectedTrack = String(source.pendaftaran?.jenis_jalur_diambil || source.pendaftaran?.penjaluran_baru || "").toLowerCase();
      if (selectedTrack === "perintisan_bisnis") {
        classification = "data_issue";
        reason_code = "PERINTISAN_GROUP_ATOMICITY_REQUIRED";
      } else try { assertCanContinue(assertMemberIntegrity(source)); }
      catch (error) { classification = error.code === "SUPERVISOR_FOLLOWUP_REQUIRED" ? "requires_supervisor_followup" : "data_issue"; reason_code = error.code; }
    }
    rows.push({
      classification,
      reason_code,
      expected_assignment_id: source.id,
      target_period_id: target.id,
      target_semester: 2,
      mahasiswa: source.mahasiswa,
      pendaftaran: source.pendaftaran,
      pembimbings: source.pembimbings,
    });
  }
  return {
    source_period_id: Number(sourcePeriodId), target_period: target,
    summary: rows.reduce((acc, row) => ({ ...acc, [row.classification]: (acc[row.classification] || 0) + 1 }), {}),
    rows,
  };
}

module.exports = {
  SemesterAssignmentError,
  END_REASON_LABELS,
  periodRank,
  resolveNextAcademicPeriod,
  previewSemesterTransitions,
  carryForwardSemesterAssignment,
  activateScheduledAssignment,
  activateScheduledAssignments,
};
