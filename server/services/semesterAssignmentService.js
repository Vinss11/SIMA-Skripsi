"use strict";

const crypto = require("crypto");
const { Op } = require("sequelize");
const {
  sequelize,
  Mahasiswa,
  Dosen,
  PendaftaranPenjaluran,
  PeriodePenjaluran,
  PeriodeAkademik,
  PenetapanPembimbing,
  PenetapanPembimbingDosen,
  IzinLanjutSkripsi,
  AssignmentActivationAttempt,
  KelompokPerintisanBisnis,
  AnggotaKelompokPerintisan,
  SekretarisProdi,
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
  const periods = await PeriodePenjaluran.findAll({
    include: [{ model: PeriodeAkademik, as: "periodeAkademik", required: false }],
    transaction,
  });
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

function assertValidTransitionEffectiveDate({ effective, source, targetPeriod }) {
  const officialStartValue = targetPeriod?.periodeAkademik?.tanggal_mulai;
  if (!officialStartValue) {
    throw new SemesterAssignmentError("Tanggal mulai periode akademik tujuan wajib tersedia.", 409, "ACADEMIC_PERIOD_START_DATE_REQUIRED", {
      target_registration_period_id: targetPeriod?.id || null,
      periode_akademik_id: targetPeriod?.periode_akademik_id || null,
    });
  }
  const officialStart = new Date(officialStartValue);
  const sourceStart = source?.tanggal_mulai ? new Date(source.tanggal_mulai) : null;
  if (Number.isNaN(officialStart.getTime())
    || effective.getTime() !== officialStart.getTime()
    || (sourceStart && effective.getTime() < sourceStart.getTime())) {
    throw new SemesterAssignmentError(
      "Tanggal efektif transisi harus sama dengan tanggal mulai periode akademik tujuan dan tidak boleh mendahului assignment sumber.",
      409,
      "ASSIGNMENT_EFFECTIVE_DATE_INVALID",
      {
        effective_at: effective.toISOString(),
        official_period_start: Number.isNaN(officialStart.getTime()) ? null : officialStart.toISOString(),
        source_assignment_start: sourceStart && !Number.isNaN(sourceStart.getTime()) ? sourceStart.toISOString() : null,
      }
    );
  }
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
      { model: PeriodePenjaluran, as: "periodeMulai", include: [{ model: PeriodeAkademik, as: "periodeAkademik", required: false }] },
      { model: Mahasiswa, as: "mahasiswa", attributes: ["id", "nim", "nama", "dosen_pembimbing_skripsi_id"] },
    ],
    transaction,
  });
}

function trackOfAssignment(assignment) {
  return String(assignment?.pendaftaran?.penjaluran_baru || assignment?.pendaftaran?.jenis_jalur_diambil || "").toLowerCase();
}

async function loadPerintisanGroupAssignments(assignment, transaction, statuses = ["active"]) {
  const membership = await AnggotaKelompokPerintisan.findOne({
    where: { pendaftaran_penjaluran_id: assignment.pendaftaran_penjaluran_id }, transaction,
  });
  if (!membership) throw new SemesterAssignmentError("Keanggotaan Perintisan tidak ditemukan.", 409, "PERINTISAN_GROUP_INVALID");
  const group = await KelompokPerintisanBisnis.findByPk(membership.kelompok_id, { transaction, lock: transaction.LOCK.UPDATE });
  const members = await AnggotaKelompokPerintisan.findAll({
    where: { kelompok_id: membership.kelompok_id }, order: [["id", "ASC"]], transaction, lock: transaction.LOCK.UPDATE,
  });
  if (!group || members.length !== 3 || new Set(members.map((item) => Number(item.mahasiswa_id))).size !== 3
    || new Set(members.map((item) => Number(item.pendaftaran_penjaluran_id))).size !== 3) {
    throw new SemesterAssignmentError("Kelompok Perintisan harus memiliki tepat tiga anggota unik.", 409, "PERINTISAN_GROUP_INVALID", { group_id: membership.kelompok_id });
  }
  const assignments = [];
  for (const member of members) {
    const row = await PenetapanPembimbing.findOne({
      where: {
        mahasiswa_id: member.mahasiswa_id,
        pendaftaran_penjaluran_id: member.pendaftaran_penjaluran_id,
        semester_penjaluran_ke: assignment.semester_penjaluran_ke,
        status: { [Op.in]: statuses },
      }, transaction, lock: transaction.LOCK.UPDATE,
    });
    if (!row) throw new SemesterAssignmentError("Assignment salah satu anggota kelompok tidak tersedia.", 409, "PERINTISAN_GROUP_ASSIGNMENT_INVALID", { group_id: group.id, mahasiswa_id: member.mahasiswa_id });
    assignments.push(await loadAssignment(row.id, transaction));
  }
  await Mahasiswa.findAll({
    where: { id: { [Op.in]: members.map((item) => Number(item.mahasiswa_id)) } },
    transaction, lock: transaction.LOCK.UPDATE,
  });
  const lecturerIds = [...new Set(assignments.flatMap((item) => item.pembimbings.map((member) => Number(member.dosen_id))))];
  const lockedLecturers = await Dosen.findAll({
    where: { id: { [Op.in]: lecturerIds } }, transaction, lock: transaction.LOCK.UPDATE,
  });
  const lecturerById = new Map(lockedLecturers.map((item) => [Number(item.id), item]));
  for (const item of assignments) {
    for (const member of item.pembimbings) member.dosen = lecturerById.get(Number(member.dosen_id)) || member.dosen;
  }
  return { group, members, assignments };
}

function validatePerintisanGroupAssignments(assignments) {
  const signatures = assignments.map((item) => {
    const members = assertMemberIntegrity(item);
    assertCanContinue(members);
    return members.map((member) => `${Number(member.urutan)}:${Number(member.dosen_id)}`).join("|");
  });
  if (new Set(signatures).size !== 1) {
    throw new SemesterAssignmentError("Komposisi P1/P2 kelompok Perintisan tidak konsisten.", 409, "PERINTISAN_SUPERVISOR_MISMATCH");
  }
}

async function notifyPerintisanGroupReview({ group, code, message, detail, transaction }) {
  const recipients = await SekretarisProdi.findAll({ attributes: ["id"], transaction });
  for (const recipient of recipients) {
    await createSystemNotification({
      recipientType: "sekretaris_prodi",
      recipientId: recipient.id,
      type: NOTIFICATION_TYPES.PERINTISAN_GROUP_REVIEW_REQUIRED,
      message: `Kelompok Perintisan #${group.id} memerlukan tindak lanjut: ${message}`,
      referenceType: "kelompok_perintisan_bisnis",
      referenceId: group.id,
      actionKey: "semester_transition_followup",
      metadata: { reason_code: code, detail },
      deduplicationKey: `perintisan-group:${group.id}:review:${code}:sekretaris:${recipient.id}`,
      transaction,
    });
  }
}

async function markPerintisanGroupNeedsReview({ group, error, transaction }) {
  if (!group) return;
  const code = error?.code || "PERINTISAN_GROUP_REVIEW_REQUIRED";
  const detail = error?.detail || {};
  await group.update({
    status: "needs_review",
    review_reason_code: code,
    review_detail: detail,
    review_requested_at: new Date(),
  }, { transaction });
  await notifyPerintisanGroupReview({ group, code, message: error?.message || "Validasi kelompok gagal.", detail, transaction });
}

async function resolvePerintisanExtensionMap(groupData, targetPeriodId, transaction) {
  const sourceIds = groupData.assignments.map((item) => Number(item.id));
  const permissions = await IzinLanjutSkripsi.findAll({
    where: { penetapan_asal_id: { [Op.in]: sourceIds }, semester_penjaluran_ke: 3 },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  const bySource = new Map();
  for (const izin of permissions) {
    if (bySource.has(Number(izin.penetapan_asal_id))) {
      throw new SemesterAssignmentError("Satu assignment kelompok memiliki lebih dari satu izin semester ketiga.", 409, "PERINTISAN_EXTENSION_DUPLICATE", { penetapan_asal_id: izin.penetapan_asal_id });
    }
    bySource.set(Number(izin.penetapan_asal_id), izin);
  }
  const incomplete = [];
  for (const source of groupData.assignments) {
    const izin = bySource.get(Number(source.id));
    if (!izin || izin.status !== "approved") {
      incomplete.push({
        mahasiswa_id: Number(source.mahasiswa_id),
        pendaftaran_penjaluran_id: Number(source.pendaftaran_penjaluran_id),
        penetapan_asal_id: Number(source.id),
        izin_id: izin?.id || null,
        status: izin?.status || "not_submitted",
      });
      continue;
    }
    if (Number(izin.mahasiswa_id) !== Number(source.mahasiswa_id)
      || Number(izin.pendaftaran_penjaluran_id) !== Number(source.pendaftaran_penjaluran_id)
      || Number(izin.penetapan_asal_id) !== Number(source.id)
      || Number(izin.periode_penjaluran_id) !== Number(targetPeriodId)) {
      throw new SemesterAssignmentError("Identitas izin anggota Perintisan tidak sesuai assignment sumber.", 409, "PERINTISAN_EXTENSION_IDENTITY_MISMATCH", {
        izin_id: izin.id, penetapan_asal_id: source.id, mahasiswa_id: source.mahasiswa_id,
      });
    }
  }
  return { bySource, incomplete };
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

async function assertExtensionAssignmentIdentity({ target, source, transaction }) {
  if (Number(target.semester_penjaluran_ke) !== 3) return null;
  const izin = await IzinLanjutSkripsi.findByPk(target.izin_lanjut_id, { transaction, lock: transaction.LOCK.UPDATE });
  if (!izin || izin.status !== "approved"
    || Number(izin.mahasiswa_id) !== Number(target.mahasiswa_id)
    || Number(izin.pendaftaran_penjaluran_id) !== Number(target.pendaftaran_penjaluran_id)
    || Number(izin.penetapan_asal_id) !== Number(source?.id)
    || Number(izin.penetapan_hasil_id) !== Number(target.id)) {
    throw new SemesterAssignmentError("Identitas izin semester ketiga tidak konsisten dengan assignment.", 409, "EXTENSION_ASSIGNMENT_IDENTITY_MISMATCH", {
      assignment_id: target.id, izin_id: target.izin_lanjut_id,
    });
  }
  return izin;
}

async function activateScheduledAssignment({ assignmentId, now = new Date(), actorType = "system", actorId = null, transaction = null, groupAtomic = false }) {
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
    if (trackOfAssignment(target) === "perintisan_bisnis" && !groupAtomic) {
      const groupData = await loadPerintisanGroupAssignments(target, t, ["scheduled", "draft"]);
      validatePerintisanGroupAssignments(groupData.assignments);
      const results = [];
      for (const groupTarget of groupData.assignments) {
        results.push(await activateScheduledAssignment({
          assignmentId: groupTarget.id, now, actorType, actorId, transaction: t, groupAtomic: true,
        }));
      }
      await groupData.group.update({
        status: "approved", review_reason_code: null, review_detail: null, review_requested_at: null,
      }, { transaction: t });
      return { assignment: results.find((item) => Number(item.assignment.id) === Number(assignmentId))?.assignment, assignments: results.map((item) => item.assignment), group_id: groupData.group.id, replayed: false };
    }
    const source = await loadAssignment(target.previous_assignment_id, t, true);
    if (!source || source.status !== "active" || Number(source.mahasiswa_id) !== Number(target.mahasiswa_id)) {
      throw new SemesterAssignmentError("Assignment sumber sudah berubah.", 409, "ASSIGNMENT_CHANGED");
    }
    assertValidTransitionEffectiveDate({ effective: effectiveAt, source, targetPeriod: target.periodeMulai });
    await assertExtensionAssignmentIdentity({ target, source, transaction: t });
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
  groupAtomic = false,
}) {
  if (!idempotencyKey) throw new SemesterAssignmentError("Idempotency-Key wajib dikirim.", 400, "IDEMPOTENCY_KEY_REQUIRED");
  const requestPrint = fingerprint({
    expectedAssignmentId: Number(expectedAssignmentId), targetPeriodId: Number(targetPeriodId) || null,
    effectiveAt: effectiveAt || null, izinLanjutId: Number(izinLanjutId) || null,
    targetSemester: Number(targetSemester) || null,
  });
  const run = async (t) => {
    const replay = await PenetapanPembimbing.findOne({ where: { idempotency_key: idempotencyKey }, transaction: t, lock: t.LOCK.UPDATE });
    if (replay) {
      if (replay.request_fingerprint !== requestPrint) throw new SemesterAssignmentError("Idempotency-Key digunakan untuk payload berbeda.", 409, "ASSIGNMENT_TRANSITION_CONFLICT");
      const loadedReplay = await loadAssignment(replay.id, t);
      if (trackOfAssignment(loadedReplay) === "perintisan_bisnis") {
        const groupData = await loadPerintisanGroupAssignments(loadedReplay, t, ["scheduled", "draft", "active"]);
        return { assignment: loadedReplay, assignments: groupData.assignments, group_id: groupData.group.id, replayed: true, scheduled: loadedReplay.status === "scheduled" };
      }
      return { assignment: loadedReplay, replayed: true };
    }
    const source = await loadAssignment(expectedAssignmentId, t, true);
    if (!source || source.status !== "active") throw new SemesterAssignmentError("Assignment sumber tidak lagi aktif.", 409, "ASSIGNMENT_CHANGED");
    await Mahasiswa.findByPk(source.mahasiswa_id, { transaction: t, lock: t.LOCK.UPDATE });
    await PendaftaranPenjaluran.findByPk(source.pendaftaran_penjaluran_id, { transaction: t, lock: t.LOCK.UPDATE });
    const selectedTrack = trackOfAssignment(source);
    if (selectedTrack === "perintisan_bisnis" && !groupAtomic) {
      let groupData;
      try {
        groupData = await loadPerintisanGroupAssignments(source, t, ["active"]);
        validatePerintisanGroupAssignments(groupData.assignments);
      } catch (error) {
        const groupId = groupData?.group?.id || error.detail?.group_id;
        const group = groupData?.group || (groupId ? await KelompokPerintisanBisnis.findByPk(groupId, { transaction: t, lock: t.LOCK.UPDATE }) : null);
        await markPerintisanGroupNeedsReview({ group, error, transaction: t });
        return {
          assignment: null,
          assignments: [],
          group_id: groupId || null,
          group_needs_review: true,
          replayed: false,
          scheduled: false,
          code: error.code || "PERINTISAN_GROUP_REVIEW_REQUIRED",
          message: error.message,
        };
      }
      const groupNextSemester = Number(targetSemester || Number(source.semester_penjaluran_ke) + 1);
      let extensionMap = null;
      if (groupNextSemester === 3) {
        const targetPeriod = await resolveNextAcademicPeriod(source.periode_mulai_id, targetPeriodId, t);
        try {
          extensionMap = await resolvePerintisanExtensionMap(groupData, targetPeriod.id, t);
        } catch (error) {
          await markPerintisanGroupNeedsReview({ group: groupData.group, error, transaction: t });
          return {
            assignment: null, assignments: [], group_id: groupData.group.id, group_needs_review: true,
            replayed: false, scheduled: false, code: error.code, message: error.message, detail: error.detail || null,
          };
        }
        if (extensionMap.incomplete.length) {
          return {
            assignment: null,
            assignments: [],
            group_id: groupData.group.id,
            group_waiting_extensions: true,
            replayed: false,
            scheduled: false,
            code: "PERINTISAN_GROUP_EXTENSIONS_PENDING",
            message: "Transisi semester ketiga menunggu izin approved seluruh anggota kelompok.",
            pending_members: extensionMap.incomplete,
          };
        }
      }
      const results = [];
      try {
        await sequelize.transaction({ transaction: t }, async (savepoint) => {
          for (const groupSource of groupData.assignments) {
            const memberKey = Number(groupSource.id) === Number(expectedAssignmentId)
              ? idempotencyKey
              : `${idempotencyKey}:group:${groupData.group.id}:assignment:${groupSource.id}`;
            results.push(await carryForwardSemesterAssignment({
              expectedAssignmentId: groupSource.id, targetPeriodId, effectiveAt, idempotencyKey: memberKey,
              actorType, actorId,
              izinLanjutId: extensionMap ? extensionMap.bySource.get(Number(groupSource.id)).id : izinLanjutId,
              targetSemester, transaction: savepoint, groupAtomic: true,
            }));
          }
        });
      } catch (error) {
        await markPerintisanGroupNeedsReview({ group: groupData.group, error, transaction: t });
        return {
          assignment: null, assignments: [], group_id: groupData.group.id, group_needs_review: true,
          replayed: false, scheduled: false, code: error.code || "PERINTISAN_GROUP_REVIEW_REQUIRED", message: error.message,
        };
      }
      if (extensionMap) {
        for (const result of results) {
          const resultSourceId = Number(result.assignment.previous_assignment_id);
          await extensionMap.bySource.get(resultSourceId).update({ penetapan_hasil_id: result.assignment.id }, { transaction: t });
        }
      }
      await groupData.group.update({
        status: "approved", review_reason_code: null, review_detail: null, review_requested_at: null,
      }, { transaction: t });
      return {
        assignment: results.find((item) => Number(item.assignment.previous_assignment_id) === Number(expectedAssignmentId))?.assignment || results[0]?.assignment || null,
        assignments: results.map((item) => item.assignment),
        group_id: groupData.group.id,
        replayed: results.every((item) => item.replayed),
        scheduled: results.every((item) => item.scheduled === true),
      };
    }
    const members = assertMemberIntegrity(source);
    assertCanContinue(members);
    const nextSemester = Number(targetSemester || Number(source.semester_penjaluran_ke) + 1);
    if (nextSemester !== Number(source.semester_penjaluran_ke) + 1 || nextSemester > 3) {
      throw new SemesterAssignmentError("Nomor semester tujuan tidak berurutan atau melebihi batas.", 409, "SEMESTER_SEQUENCE_INVALID");
    }
    if (nextSemester === 3 && !izinLanjutId) throw new SemesterAssignmentError("Semester ketiga wajib berasal dari izin lanjut.", 409, "EXTENSION_REQUIRED");
    if (nextSemester === 3) {
      const izin = await IzinLanjutSkripsi.findByPk(izinLanjutId, { transaction: t, lock: t.LOCK.UPDATE });
      if (!izin || izin.status !== "approved"
        || Number(izin.mahasiswa_id) !== Number(source.mahasiswa_id)
        || Number(izin.pendaftaran_penjaluran_id) !== Number(source.pendaftaran_penjaluran_id)
        || Number(izin.penetapan_asal_id) !== Number(source.id)) {
        throw new SemesterAssignmentError("Izin semester ketiga tidak sesuai pemilik dan assignment sumber.", 409, "EXTENSION_ASSIGNMENT_IDENTITY_MISMATCH", {
          izin_id: Number(izinLanjutId), penetapan_asal_id: source.id, mahasiswa_id: source.mahasiswa_id,
        });
      }
    }
    const targetPeriod = await resolveNextAcademicPeriod(source.periode_mulai_id, targetPeriodId, t);
    const existing = await PenetapanPembimbing.findOne({
      where: { pendaftaran_penjaluran_id: source.pendaftaran_penjaluran_id, semester_penjaluran_ke: nextSemester }, transaction: t,
    });
    if (existing) throw new SemesterAssignmentError("Semester tujuan sudah mempunyai assignment.", 409, "SEMESTER_ALREADY_PROCESSED");
    const defaultEffectiveAt = targetPeriod.periodeAkademik?.tanggal_mulai;
    const effective = new Date(effectiveAt || defaultEffectiveAt || new Date());
    if (Number.isNaN(effective.getTime())) throw new SemesterAssignmentError("Waktu efektif tidak valid.", 400, "EFFECTIVE_AT_INVALID");
    assertValidTransitionEffectiveDate({ effective, source, targetPeriod });
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
    if (nextSemester === 3) {
      await IzinLanjutSkripsi.update({ penetapan_hasil_id: target.id }, { where: { id: izinLanjutId }, transaction: t });
    }
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
      const membership = await AnggotaKelompokPerintisan.findOne({ where: { pendaftaran_penjaluran_id: row.pendaftaran_penjaluran_id } });
      if (membership) {
        await sequelize.transaction(async (transaction) => {
          const group = await KelompokPerintisanBisnis.findByPk(membership.kelompok_id, { transaction, lock: transaction.LOCK.UPDATE });
          await markPerintisanGroupNeedsReview({ group, error, transaction });
        });
      }
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
    where: { periode_mulai_id: sourcePeriodId, semester_penjaluran_ke: { [Op.lt]: 3 }, status: { [Op.in]: ["active", "ended"] } },
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
    let group_review = null;
    const nextSemester = Number(source.semester_penjaluran_ke) + 1;
    const already = await PenetapanPembimbing.findOne({ where: { pendaftaran_penjaluran_id: source.pendaftaran_penjaluran_id, semester_penjaluran_ke: nextSemester } });
    if (already) { classification = "already_processed"; reason_code = "SEMESTER_ALREADY_PROCESSED"; }
    else if (source.status !== "active") { classification = "completed_or_ended"; reason_code = source.end_reason_code || "ASSIGNMENT_ENDED"; }
    else if (nextSemester === 3 && String(source.pendaftaran?.jenis_jalur_diambil || source.pendaftaran?.penjaluran_baru || "").toLowerCase() !== "perintisan_bisnis") {
      classification = "managed_by_extension";
      reason_code = "EXTENSION_DECISION_REQUIRED";
    } else {
      const selectedTrack = String(source.pendaftaran?.jenis_jalur_diambil || source.pendaftaran?.penjaluran_baru || "").toLowerCase();
      if (selectedTrack === "perintisan_bisnis") {
        const membership = await AnggotaKelompokPerintisan.findOne({ where: { pendaftaran_penjaluran_id: source.pendaftaran_penjaluran_id } });
        if (!membership) {
          classification = "data_issue";
          reason_code = "PERINTISAN_GROUP_INVALID";
        } else if (membership.posisi !== "ketua") {
          classification = "group_member";
          reason_code = "PROCESSED_WITH_GROUP_LEADER";
        } else {
          const group = await KelompokPerintisanBisnis.findByPk(membership.kelompok_id);
          try {
            const groupData = await sequelize.transaction((transaction) => loadPerintisanGroupAssignments(source, transaction, ["active"]));
            validatePerintisanGroupAssignments(groupData.assignments);
            const groupStudents = await Mahasiswa.findAll({
              where: { id: { [Op.in]: groupData.members.map((item) => item.mahasiswa_id) } },
              attributes: ["id", "nim", "nama"],
            });
            const studentById = new Map(groupStudents.map((item) => [Number(item.id), item]));
            group_review = {
              group_id: groupData.group.id,
              group_name: `Kelompok Perintisan #${groupData.group.id}`,
              status: group?.status || groupData.group.status,
              reason_code: group?.review_reason_code || null,
              reason_detail: group?.review_detail || null,
              retry_available: true,
              members: groupData.members.map((item) => ({
                mahasiswa_id: item.mahasiswa_id,
                pendaftaran_penjaluran_id: item.pendaftaran_penjaluran_id,
                posisi: item.posisi,
                peran_tim: item.peran_tim,
                nim: studentById.get(Number(item.mahasiswa_id))?.nim || null,
                nama: studentById.get(Number(item.mahasiswa_id))?.nama || null,
              })),
            };
            if (nextSemester === 3) {
              const sourceIds = groupData.assignments.map((item) => Number(item.id));
              const permissions = await IzinLanjutSkripsi.findAll({
                where: { penetapan_asal_id: { [Op.in]: sourceIds }, semester_penjaluran_ke: 3 },
              });
              const permissionBySource = new Map(permissions.map((item) => [Number(item.penetapan_asal_id), item]));
              const pendingMembers = groupData.assignments
                .map((item) => ({
                  mahasiswa_id: item.mahasiswa_id,
                  penetapan_asal_id: item.id,
                  izin_id: permissionBySource.get(Number(item.id))?.id || null,
                  status: permissionBySource.get(Number(item.id))?.status || "not_submitted",
                }))
                .filter((item) => item.status !== "approved");
              if (pendingMembers.length) {
                const hasRejected = pendingMembers.some((item) => item.status === "rejected");
                classification = hasRejected || group?.status === "needs_review" ? "needs_review" : "waiting_extensions";
                reason_code = hasRejected ? "PERINTISAN_EXTENSION_REJECTED" : "PERINTISAN_GROUP_EXTENSIONS_PENDING";
                group_review.reason_code = reason_code;
                group_review.reason_detail = { pending_members: pendingMembers };
                group_review.retry_available = hasRejected;
              }
            }
          } catch (error) {
            classification = "needs_review";
            reason_code = error.code;
            group_review = {
              group_id: membership.kelompok_id,
              group_name: `Kelompok Perintisan #${membership.kelompok_id}`,
              status: group?.status || "needs_review",
              reason_code: error.code,
              reason_detail: error.detail || null,
              retry_available: true,
              members: [],
            };
          }
        }
      } else try { assertCanContinue(assertMemberIntegrity(source)); }
      catch (error) { classification = error.code === "SUPERVISOR_FOLLOWUP_REQUIRED" ? "requires_supervisor_followup" : "data_issue"; reason_code = error.code; }
    }
    rows.push({
      classification,
      reason_code,
      expected_assignment_id: source.id,
      target_period_id: target.id,
      target_semester: nextSemester,
      mahasiswa: source.mahasiswa,
      pendaftaran: source.pendaftaran,
      pembimbings: source.pembimbings,
      group_review,
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
  markPerintisanGroupNeedsReview,
};
