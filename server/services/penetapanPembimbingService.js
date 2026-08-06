"use strict";

const { Op } = require("sequelize");
const {
  sequelize,
  Mahasiswa,
  Dosen,
  PendaftaranPenjaluran,
  PeriodePenjaluran,
  PenetapanPembimbing,
  PenetapanPembimbingDosen,
  SekretarisProdi,
  BimbinganSkripsi,
  GuidanceReviewerTransfer,
  GuidanceEvent,
  AssignmentActivationAttempt,
} = require("../models");
const { validateDosenForNewAssignment } = require("./dosenStatusService");
const { createSupervisorAssignmentNotifications, createSystemNotification } = require("./notificationService");
const { NOTIFICATION_TYPES } = require("../constants/notificationTypes");

const VALID_SOURCES = new Set(["penjaluran", "perpanjangan", "pergantian", "legacy_backfill"]);

class SupervisorAssignmentError extends Error {
  constructor(message, statusCode = 409, detail = null) {
    super(message);
    this.name = "SupervisorAssignmentError";
    this.statusCode = statusCode;
    this.detail = detail;
  }
}

function normalizePositiveIds(values) {
  return (Array.isArray(values) ? values : [])
    .map(Number)
    .filter((value) => Number.isInteger(value) && value > 0);
}

function assertSupervisorComposition(dosenIds) {
  if (dosenIds.length < 1 || dosenIds.length > 2) {
    throw new SupervisorAssignmentError("Penetapan harus memiliki satu atau dua dosen pembimbing.", 400);
  }
  if (new Set(dosenIds).size !== dosenIds.length) {
    throw new SupervisorAssignmentError("Pembimbing 1 dan Pembimbing 2 tidak boleh dosen yang sama.", 400);
  }
}

async function withTransaction(transaction, callback) {
  if (transaction) return callback(transaction);
  return sequelize.transaction(callback);
}

async function handleGuidanceAfterSupervisorReplacement({
  mahasiswaId,
  oldAssignmentId,
  newAssignmentId,
  oldMembers,
  newMembers,
  transitionType = "supervisor_replacement",
  effectiveTransitionAt = new Date(),
  reassignedBySekretarisId,
  transaction,
}) {
  const oldById = new Map((oldMembers || []).map((member) => [Number(member.id), member]));
  const oldByDosen = new Map((oldMembers || []).map((member) => [Number(member.dosen_id), member]));
  const newByOrder = new Map((newMembers || []).map((member) => [Number(member.urutan), member]));
  const rows = await BimbinganSkripsi.findAll({ where: { mahasiswa_id: mahasiswaId,
    [Op.or]: [{ effective_reviewer_assignment_id: oldAssignmentId }, { penetapan_pembimbing_id: oldAssignmentId }] }, transaction, lock: transaction.LOCK.UPDATE });
  let cancelled = 0; let reassignedReviews = 0; let unresolved = 0;
  for (const row of rows) {
    const effectiveAt = new Date(effectiveTransitionAt);
    const scheduled = row.scheduled_at ? new Date(row.scheduled_at) : new Date(`${row.permintaan_tanggal}T${row.permintaan_jam}:00+07:00`);
    const futureWithoutResume = Number.isFinite(scheduled.getTime()) && scheduled.getTime() >= effectiveAt.getTime()
      && ["pending", "accepted", "approved", "rescheduled"].includes(row.request_status || row.status_permohonan)
      && !["submitted", "revisi", "approved"].includes(row.status_resume);
    if (futureWithoutResume) {
      row.status_permohonan = "cancelled_supervisor_change"; row.request_status = "cancelled_supervisor_change";
      row.cancelled_at = new Date(); row.cancellation_reason_code = transitionType; row.tanggal_keputusan = row.cancelled_at;
      row.catatan_dosen = "Dibatalkan otomatis karena pergantian assignment. Silakan ajukan jadwal baru."; row.row_version = Number(row.row_version || 1) + 1;
      await row.save({ transaction });
      await GuidanceEvent.create({ guidance_id: row.id, event_type: "request_cancelled_supervisor_change", actor_type: "system", actor_role: "system",
        from_state: "pending", to_state: "cancelled_supervisor_change", assignment_id: newAssignmentId, occurred_at: new Date(),
        reason_code: transitionType, metadata: { old_assignment_id: oldAssignmentId, new_assignment_id: newAssignmentId } }, { transaction });
      await createSystemNotification({ recipientType: "mahasiswa", recipientId: mahasiswaId, type: NOTIFICATION_TYPES.GUIDANCE_REQUEST_DECIDED_STUDENT,
        message: "Permohonan bimbingan dibatalkan karena pergantian assignment. Silakan ajukan jadwal baru.", referenceType: "bimbingan", referenceId: row.id,
        actionKey: "guidance_detail", metadata: { decision: "cancelled_supervisor_change" },
        deduplicationKey: `guidance:${row.id}:cancelled:${transitionType}:mahasiswa:${mahasiswaId}`, transaction });
      cancelled += 1; continue;
    }
    if (!["submitted", "revisi"].includes(row.status_resume)) continue;
    const oldMember = oldById.get(Number(row.effective_reviewer_assignment_member_id)) || oldByDosen.get(Number(row.reviewer_dosen_id || row.dosen_id));
    const sameRoleReplacement = oldMember ? newByOrder.get(Number(oldMember.urutan)) : null;
    const replacement = sameRoleReplacement || newByOrder.get(1) || null;
    if (!replacement) {
      const reasonCode = "ACTIVE_REVIEWER_NOT_AVAILABLE";
      const candidateMetadata = { required_urutan: oldMember?.urutan || row.target_urutan_snapshot || null,
        available_candidates: [...newByOrder.values()].map((candidate) => ({ assignment_member_id: candidate.id, dosen_id: candidate.dosen_id, urutan: candidate.urutan })) };
      row.reviewer_resolution_status = "waiting_for_active_reviewer"; row.reviewer_resolution_reason_code = reasonCode;
      row.row_version = Number(row.row_version || 1) + 1; await row.save({ transaction });
      await GuidanceEvent.create({ guidance_id: row.id, event_type: "reviewer_resolution_required", actor_type: "system", actor_role: "system",
        from_state: "resolved", to_state: "waiting_for_active_reviewer", assignment_id: newAssignmentId, occurred_at: new Date(),
        reason_code: reasonCode, metadata: { old_assignment_id: oldAssignmentId, new_assignment_id: newAssignmentId,
          effective_transition_at: effectiveAt.toISOString(), ...candidateMetadata } }, { transaction });
      await createSystemNotification({ recipientType: "mahasiswa", recipientId: mahasiswaId, type: NOTIFICATION_TYPES.GUIDANCE_REVIEWER_RESOLUTION_REQUIRED,
        message: "Resume Anda menunggu pembimbing aktif setelah pergantian pembimbing.", referenceType: "bimbingan", referenceId: row.id,
        actionKey: "guidance_detail", metadata: { reason_code: reasonCode },
        deduplicationKey: `guidance:${row.id}:reviewer-resolution:mahasiswa:${mahasiswaId}:${newAssignmentId}`, transaction });
      if (reassignedBySekretarisId) await createSystemNotification({ recipientType: "sekretaris_prodi", recipientId: reassignedBySekretarisId,
        type: NOTIFICATION_TYPES.GUIDANCE_REVIEWER_RESOLUTION_REQUIRED,
        message: "Ada resume bimbingan yang menunggu assignment pembimbing aktif.", referenceType: "bimbingan", referenceId: row.id,
        actionKey: "lecturer_supervised_student", metadata: { reason_code: reasonCode, ...candidateMetadata },
        deduplicationKey: `guidance:${row.id}:reviewer-resolution:sekretaris:${reassignedBySekretarisId}:${newAssignmentId}`, transaction });
      unresolved += 1; continue;
    }
    const crossRoleFallback = !sameRoleReplacement && Number(replacement.urutan) === 1;
    const transferReasonCode = crossRoleFallback ? "CROSS_ROLE_SYSTEM_FALLBACK_TO_P1" : "SAME_ROLE_REVIEWER_TRANSFER";
    const before = Number(row.row_version || 1); const after = before + 1;
    const guidanceEvent = await GuidanceEvent.create({ guidance_id: row.id, event_type: "reviewer_transferred", actor_type: "sekretaris_prodi",
      actor_id: reassignedBySekretarisId || null, actor_role: "sekretaris_prodi", from_state: String(oldMember?.id || ""), to_state: String(replacement.id),
      assignment_id: newAssignmentId, assignment_member_id: replacement.id, occurred_at: new Date(), reason_code: transferReasonCode,
      metadata: { from_assignment_id: oldAssignmentId, to_assignment_id: newAssignmentId, from_urutan: oldMember?.urutan || null,
        to_urutan: replacement.urutan, cross_role_system_fallback: crossRoleFallback } }, { transaction });
    await GuidanceReviewerTransfer.create({ guidance_id: row.id, from_assignment_id: oldAssignmentId, from_assignment_member_id: oldMember?.id || null,
      to_assignment_id: newAssignmentId, to_assignment_member_id: replacement.id, transition_type: transitionType, reason_code: transferReasonCode,
      effective_at: effectiveAt, transferred_by_actor_type: "sekretaris_prodi", transferred_by_actor_id: reassignedBySekretarisId || null,
      event_id: guidanceEvent.id, row_version_before: before, row_version_after: after }, { transaction });
    row.effective_reviewer_assignment_id = newAssignmentId; row.effective_reviewer_assignment_member_id = replacement.id;
    row.reviewer_dosen_id = replacement.dosen_id; row.reassigned_reviewer_at = new Date(); row.reassigned_by_sekretaris_id = reassignedBySekretarisId || null;
    row.reviewer_resolution_status = "resolved"; row.reviewer_resolution_reason_code = null; row.row_version = after; await row.save({ transaction }); reassignedReviews += 1;
  }
  return { cancelled, reassigned_reviews: reassignedReviews, unresolved };
}

const assignmentInclude = [
  {
    model: PenetapanPembimbingDosen,
    as: "pembimbings",
    include: [{ model: Dosen, as: "dosen", attributes: ["id", "kode_dosen", "nik", "nama", "gelar", "email"] }],
  },
  { model: PeriodePenjaluran, as: "periodeMulai", attributes: ["id", "label_periode", "tahun_akademik", "semester", "status"] },
  {
    model: PendaftaranPenjaluran,
    as: "pendaftaran",
    attributes: ["id", "periode_penjaluran_id", "jalur", "jenis_jalur_diambil", "penjaluran_baru", "semester_mahasiswa", "status"],
  },
  { model: SekretarisProdi, as: "createdBySekretaris", attributes: ["id", "nik", "nama", "email"] },
  { model: AssignmentActivationAttempt, as: "activationAttempt", required: false },
];

function sortAssignmentMembers(penetapan) {
  if (penetapan?.pembimbings) {
    penetapan.pembimbings.sort((left, right) => Number(left.urutan) - Number(right.urutan));
  }
  return penetapan;
}

async function getActiveSupervisorAssignment(mahasiswaId, transaction = null) {
  const now = new Date();
  const penetapan = await PenetapanPembimbing.findOne({
    where: {
      mahasiswa_id: mahasiswaId,
      status: "active",
      [Op.and]: [
        { [Op.or]: [{ effective_at: null }, { effective_at: { [Op.lte]: now } }] },
        { [Op.or]: [{ tanggal_selesai: null }, { tanggal_selesai: { [Op.gt]: now } }] },
      ],
    },
    include: assignmentInclude,
    order: [[{ model: PenetapanPembimbingDosen, as: "pembimbings" }, "urutan", "ASC"]],
    transaction,
  });
  sortAssignmentMembers(penetapan);
  return {
    penetapan,
    pembimbing_1: penetapan?.pembimbings?.find((item) => Number(item.urutan) === 1)?.dosen || null,
    pembimbing_2: penetapan?.pembimbings?.find((item) => Number(item.urutan) === 2)?.dosen || null,
  };
}

async function resolveSemesterPenjaluranKe(mahasiswaId, pendaftaranId, periodeMulaiId, transaction) {
  let targetPeriodId = Number(periodeMulaiId) || null;
  if (pendaftaranId) {
    const pendaftaran = await PendaftaranPenjaluran.findByPk(pendaftaranId, {
      attributes: ["id", "mahasiswa_id", "periode_penjaluran_id"],
      transaction,
    });
    if (!pendaftaran || Number(pendaftaran.mahasiswa_id) !== Number(mahasiswaId)) {
      throw new SupervisorAssignmentError("Pendaftaran penjaluran tidak sesuai dengan mahasiswa.", 400);
    }
    if (!targetPeriodId) targetPeriodId = Number(pendaftaran.periode_penjaluran_id);
  }
  if (!targetPeriodId) return null;

  if (!pendaftaranId) return 1;
  const previous = await PenetapanPembimbing.max("semester_penjaluran_ke", {
    where: { mahasiswa_id: mahasiswaId, pendaftaran_penjaluran_id: pendaftaranId, status: { [Op.ne]: "cancelled" } },
    transaction,
  });
  return Number(previous || 0) + 1;
}

async function createDraftSupervisorAssignment({
  mahasiswaId,
  pendaftaranPenjaluranId = null,
  periodeMulaiId = null,
  semesterPenjaluranKe = null,
  dosenPembimbingIds,
  sumberData = "penjaluran",
  catatanPergantian = null,
  tanggalMulai = null,
  createdBySekretarisId = null,
  transaction = null,
  skipEligibilityValidation = false,
  previousAssignmentId = null,
  assignmentTransitionCode = null,
  effectiveAt = null,
  decisionAt = new Date(),
}) {
  return withTransaction(transaction, async (t) => {
    const normalizedMahasiswaId = Number(mahasiswaId);
    const dosenIds = normalizePositiveIds(dosenPembimbingIds);
    if (!Number.isInteger(normalizedMahasiswaId) || normalizedMahasiswaId <= 0) {
      throw new SupervisorAssignmentError("Mahasiswa tidak valid.", 400);
    }
    assertSupervisorComposition(dosenIds);
    if (!VALID_SOURCES.has(sumberData)) {
      throw new SupervisorAssignmentError("Sumber data penetapan tidak valid.", 400);
    }
    const mahasiswa = await Mahasiswa.findByPk(normalizedMahasiswaId, { transaction: t });
    if (!mahasiswa) throw new SupervisorAssignmentError("Mahasiswa tidak ditemukan.", 404);

    if (!skipEligibilityValidation) {
      if (!periodeMulaiId) {
        throw new SupervisorAssignmentError("Periode mulai wajib tersedia untuk memvalidasi ketersediaan pembimbing.", 400);
      }
      for (const dosenId of dosenIds) {
        const validation = await validateDosenForNewAssignment(dosenId, Number(periodeMulaiId), {
          transaction: t,
          availabilityField: "tersedia_membimbing",
          activityLabel: "menjadi dosen pembimbing baru",
          requiredSlots: 1,
          excludeMahasiswaId: normalizedMahasiswaId,
        });
        if (!validation.allowed) {
          throw new SupervisorAssignmentError(validation.message, 409, {
            dosen_id: dosenId,
            capacity: validation.capacity || null,
          });
        }
      }
    } else {
      const existingDosens = await Dosen.count({ where: { id: { [Op.in]: dosenIds } }, transaction: t });
      if (existingDosens !== dosenIds.length) throw new SupervisorAssignmentError("Dosen pembimbing tidak ditemukan.", 404);
    }

    const resolvedSemester = semesterPenjaluranKe == null
      ? await resolveSemesterPenjaluranKe(normalizedMahasiswaId, pendaftaranPenjaluranId, periodeMulaiId, t)
      : Number(semesterPenjaluranKe);
    const plannedStartDate = tanggalMulai ? new Date(tanggalMulai) : null;
    if (plannedStartDate && Number.isNaN(plannedStartDate.getTime())) {
      throw new SupervisorAssignmentError("Tanggal efektif penggantian tidak valid.", 400);
    }
    const penetapan = await PenetapanPembimbing.create({
      mahasiswa_id: normalizedMahasiswaId,
      pendaftaran_penjaluran_id: pendaftaranPenjaluranId || null,
      periode_mulai_id: periodeMulaiId || null,
      semester_penjaluran_ke: Number.isInteger(resolvedSemester) && resolvedSemester > 0 ? resolvedSemester : null,
      status: "draft",
      tanggal_mulai: plannedStartDate,
      sumber_data: sumberData,
      catatan_pergantian: String(catatanPergantian || "").trim() || null,
      created_by_sekretaris_id: createdBySekretarisId || null,
      previous_assignment_id: previousAssignmentId || null,
      assignment_transition_code: assignmentTransitionCode || null,
      effective_at: effectiveAt || null,
      decision_at: decisionAt || new Date(),
    }, { transaction: t });
    await PenetapanPembimbingDosen.bulkCreate(dosenIds.map((dosenId, index) => ({
      penetapan_pembimbing_id: penetapan.id,
      dosen_id: dosenId,
      urutan: index + 1,
      peran: index === 0 ? "utama" : "pendamping",
      status: "draft",
      tanggal_mulai: null,
      tanggal_selesai: null,
    })), { transaction: t });
    return PenetapanPembimbing.findByPk(penetapan.id, { include: assignmentInclude, transaction: t });
  });
}

async function activateSupervisorAssignment({
  penetapanId,
  tanggalMulai = new Date(),
  preserveNullStartDate = false,
  transaction = null,
}) {
  return withTransaction(transaction, async (t) => {
    const penetapan = await PenetapanPembimbing.findByPk(penetapanId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!penetapan) throw new SupervisorAssignmentError("Penetapan pembimbing tidak ditemukan.", 404);
    if (penetapan.status === "active") {
      const active = await getActiveSupervisorAssignment(penetapan.mahasiswa_id, t);
      const activePrimaryId = active.penetapan?.pembimbings?.find((item) => Number(item.urutan) === 1)?.dosen_id;
      if (activePrimaryId) {
        await Mahasiswa.update(
          { dosen_pembimbing_skripsi_id: activePrimaryId },
          { where: { id: penetapan.mahasiswa_id }, transaction: t }
        );
      }
      return active;
    }
    if (penetapan.status !== "draft") throw new SupervisorAssignmentError("Hanya penetapan draft yang dapat diaktifkan.", 409);

    const mahasiswa = await Mahasiswa.findByPk(penetapan.mahasiswa_id, { transaction: t, lock: t.LOCK.UPDATE });
    const members = await PenetapanPembimbingDosen.findAll({
      where: { penetapan_pembimbing_id: penetapan.id },
      order: [["urutan", "ASC"]],
      transaction: t,
    });
    assertSupervisorComposition(members.map((item) => Number(item.dosen_id)));
    const primary = members.find((item) => Number(item.urutan) === 1);
    if (!primary) throw new SupervisorAssignmentError("Pembimbing 1 belum tersedia.", 409);

    const startedAt = tanggalMulai == null && preserveNullStartDate ? null : new Date(tanggalMulai || new Date());
    if (startedAt && Number.isNaN(startedAt.getTime())) throw new SupervisorAssignmentError("Tanggal mulai penetapan tidak valid.", 400);
    const oldActive = await PenetapanPembimbing.findOne({
      where: { mahasiswa_id: penetapan.mahasiswa_id, status: "active", id: { [Op.ne]: penetapan.id } },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    const oldMembers = oldActive
      ? await PenetapanPembimbingDosen.findAll({
          where: { penetapan_pembimbing_id: oldActive.id },
          attributes: ["id", "dosen_id", "urutan"],
          order: [["urutan", "ASC"]],
          transaction: t,
        })
      : [];
    const oldMemberIds = oldMembers.map((item) => Number(item.dosen_id));
    const newMemberIds = members.map((item) => Number(item.dosen_id));
    const removedSupervisorIds = oldMemberIds.filter((id) => !newMemberIds.includes(id));
    const sameComposition = oldMemberIds.length === newMemberIds.length
      && oldMemberIds.every((id, index) => id === newMemberIds[index]);
    const replacementDate = startedAt || new Date();
    if (oldActive) {
      await oldActive.update({
        status: "ended",
        tanggal_selesai: replacementDate,
        alasan_berakhir: sameComposition
          ? "Diperbarui untuk periode penjaluran berikutnya."
          : `Komposisi pembimbing diperbarui melalui penetapan #${penetapan.id}.`,
        end_reason_code: sameComposition ? "semester_carried_forward" : "supervisor_replaced",
        assignment_transition_code: sameComposition ? "semester_carried_forward" : "supervisor_replaced",
        semester_outcome_code: sameComposition ? "continued" : null,
      }, { transaction: t });
      await PenetapanPembimbingDosen.update({
        status: "ended",
        tanggal_selesai: replacementDate,
      }, {
        where: { penetapan_pembimbing_id: oldActive.id },
        transaction: t,
      });
    }
    await penetapan.update({
      status: "active",
      tanggal_mulai: startedAt,
      tanggal_selesai: null,
      alasan_berakhir: null,
      activated_at: new Date(),
      semester_outcome_code: "in_progress",
    }, { transaction: t });
    await PenetapanPembimbingDosen.update({
      status: "active",
      tanggal_mulai: startedAt,
      tanggal_selesai: null,
    }, {
      where: { penetapan_pembimbing_id: penetapan.id },
      transaction: t,
    });
    await mahasiswa.update({ dosen_pembimbing_skripsi_id: primary.dosen_id }, { transaction: t });
    if (oldActive) {
      await handleGuidanceAfterSupervisorReplacement({
        mahasiswaId: mahasiswa.id,
        oldAssignmentId: oldActive.id,
        newAssignmentId: penetapan.id,
        oldMembers,
        newMembers: members,
        transitionType: sameComposition ? "semester_transition" : "supervisor_replacement",
        effectiveTransitionAt: replacementDate,
        reassignedBySekretarisId: penetapan.created_by_sekretaris_id,
        transaction: t,
      });
    }
    return getActiveSupervisorAssignment(penetapan.mahasiswa_id, t);
  });
}

async function endActiveSupervisorAssignment({
  mahasiswaId,
  expectedAssignmentId = null,
  tanggalSelesai = new Date(),
  alasanBerakhir,
  endReasonCode = "workflow_cancelled",
  semesterOutcomeCode = "cancelled",
  assignmentTransitionCode = null,
  endedByActorType = null,
  endedByActorId = null,
  clearLegacyCache = true,
  transaction = null,
}) {
  return withTransaction(transaction, async (t) => {
    const mahasiswa = await Mahasiswa.findByPk(mahasiswaId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!mahasiswa) throw new SupervisorAssignmentError("Mahasiswa tidak ditemukan.", 404);
    const active = await PenetapanPembimbing.findOne({
      where: { mahasiswa_id: mahasiswaId, status: "active" },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (expectedAssignmentId && Number(active?.id) !== Number(expectedAssignmentId)) {
      throw new SupervisorAssignmentError(
        "Penetapan pembimbing aktif sudah berubah.",
        409,
        { code: "ASSIGNMENT_CHANGED", expected_assignment_id: Number(expectedAssignmentId), active_assignment_id: active?.id || null }
      );
    }
    const endedAt = tanggalSelesai ? new Date(tanggalSelesai) : new Date();
    if (Number.isNaN(endedAt.getTime())) throw new SupervisorAssignmentError("Tanggal selesai tidak valid.", 400);
    if (active) {
      if (active.tanggal_mulai && endedAt < new Date(active.tanggal_mulai)) {
        throw new SupervisorAssignmentError("Tanggal selesai tidak boleh sebelum tanggal mulai.", 400);
      }
      await active.update({
        status: "ended",
        tanggal_selesai: endedAt,
        alasan_berakhir: String(alasanBerakhir || "Penetapan pembimbing diakhiri").trim(),
        end_reason_code: endReasonCode,
        semester_outcome_code: semesterOutcomeCode,
        assignment_transition_code: assignmentTransitionCode,
        ended_by_actor_type: endedByActorType,
        ended_by_actor_id: endedByActorId,
      }, { transaction: t });
      await PenetapanPembimbingDosen.update({
        status: "ended",
        tanggal_selesai: endedAt,
      }, {
        where: { penetapan_pembimbing_id: active.id },
        transaction: t,
      });
    }
    if (clearLegacyCache) await mahasiswa.update({ dosen_pembimbing_skripsi_id: null }, { transaction: t });
    return active;
  });
}

async function replaceSupervisorAssignment({
  mahasiswaId,
  pendaftaranPenjaluranId = null,
  periodeMulaiId = null,
  semesterPenjaluranKe = null,
  dosenPembimbingIds,
  sumberData = "pergantian",
  createdBySekretarisId = null,
  tanggalMulai = new Date(),
  transaction = null,
  notificationCreator = createSupervisorAssignmentNotifications,
  preserveRequestedSource = false,
}) {
  return withTransaction(transaction, async (t) => {
    const dosenIds = normalizePositiveIds(dosenPembimbingIds);
    assertSupervisorComposition(dosenIds);
    const current = await getActiveSupervisorAssignment(mahasiswaId, t);
    const currentIds = (current.penetapan?.pembimbings || []).map((item) => Number(item.dosen_id));
    const sameComposition = currentIds.length === dosenIds.length
      && currentIds.every((id, index) => id === dosenIds[index]);
    const currentRegistrationId = Number(current.penetapan?.pendaftaran_penjaluran_id || 0) || null;
    const newRegistrationId = Number(pendaftaranPenjaluranId || 0) || null;
    const currentPeriodId = Number(current.penetapan?.periode_mulai_id || 0) || null;
    const newPeriodId = Number(periodeMulaiId || 0) || null;
    const sameRegistration = Boolean(currentRegistrationId && newRegistrationId)
      && currentRegistrationId === newRegistrationId;
    const samePeriod = Boolean(currentPeriodId && newPeriodId)
      && currentPeriodId === newPeriodId;
    if (current.penetapan && sameComposition && (sameRegistration || samePeriod)) return current;

    const resolvedSource = preserveRequestedSource
      ? sumberData
      : sumberData === "legacy_backfill"
      ? "legacy_backfill"
      : !current.penetapan
      ? "penjaluran"
      : sameComposition
      ? "perpanjangan"
      : "pergantian";

    const resolvedSemester = semesterPenjaluranKe == null && current.penetapan
      ? Number(current.penetapan.semester_penjaluran_ke || 1)
      : semesterPenjaluranKe;

    const draft = await createDraftSupervisorAssignment({
      mahasiswaId,
      pendaftaranPenjaluranId,
      periodeMulaiId,
      semesterPenjaluranKe: resolvedSemester,
      dosenPembimbingIds: dosenIds,
      sumberData: resolvedSource,
      createdBySekretarisId,
      transaction: t,
      previousAssignmentId: current.penetapan?.id || null,
      assignmentTransitionCode: current.penetapan
        ? (resolvedSource === "pergantian" ? "supervisor_replaced" : "semester_carried_forward")
        : null,
    });
    const activated = await activateSupervisorAssignment({
      penetapanId: draft.id,
      tanggalMulai,
      transaction: t,
    });
    const mahasiswa = await Mahasiswa.findByPk(mahasiswaId, {
      attributes: ["id", "nim", "nama"],
      transaction: t,
    });
    await notificationCreator({
      assignmentId: draft.id,
      mahasiswa,
      previousMembers: current.penetapan?.pembimbings || [],
      newMembers: activated.penetapan?.pembimbings || [],
      effectiveDate: tanggalMulai,
      assignmentSource: resolvedSource,
      transaction: t,
    });
    return activated;
  });
}

function toAssignmentResponse(penetapan) {
  if (!penetapan) return null;
  const plain = typeof penetapan.toJSON === "function" ? penetapan.toJSON() : penetapan;
  const isLegacy = plain.sumber_data === "legacy_backfill";
  const pembimbings = [...(plain.pembimbings || [])].sort((a, b) => Number(a.urutan) - Number(b.urutan));
  return {
    id: plain.id,
    status: plain.status,
    periode: plain.periodeMulai?.label_periode || null,
    periode_mulai: plain.periodeMulai || null,
    semester_penjaluran_ke: plain.semester_penjaluran_ke,
    previous_assignment_id: plain.previous_assignment_id || null,
    end_reason_code: plain.end_reason_code || null,
    assignment_transition_code: plain.assignment_transition_code || null,
    semester_outcome_code: plain.semester_outcome_code || (plain.status === "active" ? "in_progress" : null),
    izin_lanjut_id: plain.izin_lanjut_id || null,
    effective_at: plain.effective_at || null,
    activated_at: plain.activated_at || null,
    decision_at: plain.decision_at || null,
    tanggal_mulai: plain.tanggal_mulai,
    tanggal_selesai: plain.tanggal_selesai,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
    alasan_berakhir: plain.alasan_berakhir,
    sumber_data: plain.sumber_data,
    catatan_pergantian: plain.catatan_pergantian || null,
    dasar_penetapan: isLegacy
      ? "Data historis sebelum penerapan sistem"
      : "Keputusan Final Sekretaris Prodi",
    ditetapkan_oleh: isLegacy ? null : plain.createdBySekretaris || null,
    tanggal_penetapan: isLegacy ? null : plain.createdAt || null,
    pendaftaran: plain.pendaftaran || null,
    pembimbings,
    mahasiswa: plain.mahasiswa || null,
    activation_attempt: plain.activationAttempt || null,
  };
}

async function getSupervisorAssignmentHistory(mahasiswaId, transaction = null) {
  const rows = await PenetapanPembimbing.findAll({
    where: { mahasiswa_id: mahasiswaId },
    include: assignmentInclude,
    order: [["tanggal_mulai", "DESC NULLS LAST"], ["createdAt", "DESC"]],
    transaction,
  });
  rows.forEach(sortAssignmentMembers);
  const formatted = rows.map(toAssignmentResponse);
  return {
    active: formatted.find((item) => item.status === "active") || null,
    scheduled: formatted.filter((item) => item.status === "scheduled"),
    history: formatted.filter((item) => !["active", "scheduled"].includes(item.status)),
  };
}

module.exports = {
  SupervisorAssignmentError,
  getActiveSupervisorAssignment,
  createDraftSupervisorAssignment,
  activateSupervisorAssignment,
  endActiveSupervisorAssignment,
  replaceSupervisorAssignment,
  getSupervisorAssignmentHistory,
  toAssignmentResponse,
  resolveSemesterPenjaluranKe,
};
