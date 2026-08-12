"use strict";

const crypto = require("crypto");
const {
  sequelize,
  Mahasiswa,
  Dosen,
  IzinLanjutSkripsi,
  PenetapanPembimbing,
  PenetapanPembimbingDosen,
  BimbinganSkripsi,
  KelompokPerintisanBisnis,
  AnggotaKelompokPerintisan,
} = require("../models");
const {
  SemesterAssignmentError,
  resolveNextAcademicPeriod,
  carryForwardSemesterAssignment,
  markPerintisanGroupNeedsReview,
  END_REASON_LABELS,
} = require("./semesterAssignmentService");
const { createSystemNotification } = require("./notificationService");
const { NOTIFICATION_TYPES } = require("../constants/notificationTypes");

const EXTENSION_WINDOW_DAYS = 30;

function extensionWindowOpensAt(targetPeriod) {
  const targetStart = new Date(targetPeriod?.periodeAkademik?.tanggal_mulai);
  if (Number.isNaN(targetStart.getTime())) {
    throw new SemesterAssignmentError("Periode akademik tujuan belum memiliki tanggal mulai resmi.", 409, "ACADEMIC_PERIOD_START_DATE_REQUIRED", {
      target_registration_period_id: targetPeriod?.id || null,
      periode_akademik_id: targetPeriod?.periode_akademik_id || null,
    });
  }
  return new Date(targetStart.getTime() - EXTENSION_WINDOW_DAYS * 86400000);
}

function print(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function notifyExtensionMembers({ izin, source, phase, decision = null, transaction }) {
  const members = [...(source.pembimbings || [])];
  if (phase === "submitted") {
    for (const member of members) {
      const isP1 = Number(member.urutan) === 1;
      await createSystemNotification({
        recipientType: "dosen", recipientId: member.dosen_id,
        type: isP1 ? NOTIFICATION_TYPES.EXTENSION_REQUESTED_LECTURER : NOTIFICATION_TYPES.EXTENSION_INFO_LECTURER,
        message: isP1
          ? `Mahasiswa ${source.mahasiswa?.nama || izin.mahasiswa_id} mengajukan izin melanjutkan ke semester ketiga.`
          : `Mahasiswa ${source.mahasiswa?.nama || izin.mahasiswa_id} mengajukan izin semester ketiga kepada Pembimbing 1.`,
        referenceType: "izin_lanjut_skripsi", referenceId: izin.id,
        actionKey: isP1 ? "lecturer_extension_decision" : "lecturer_supervised_student",
        metadata: { phase, assignment_id: source.id, supervisor_order: member.urutan },
        deduplicationKey: `extension:${izin.id}:submitted:dosen:${member.dosen_id}`,
        transaction,
      });
    }
    return;
  }

  await createSystemNotification({
    recipientType: "mahasiswa", recipientId: izin.mahasiswa_id,
    type: NOTIFICATION_TYPES.EXTENSION_DECIDED_STUDENT,
    message: decision === "approved"
      ? "Izin melanjutkan ke semester ketiga disetujui. Penetapan semester berikutnya telah disiapkan."
      : "Izin melanjutkan ke semester ketiga ditolak. Silakan melanjutkan melalui proses ulang atau alih jalur.",
    referenceType: "izin_lanjut_skripsi", referenceId: izin.id,
    actionKey: decision === "approved" ? "student_supervisor_history" : "student_change_eligibility",
    metadata: { phase, decision, assignment_id: source.id },
    deduplicationKey: `extension:${izin.id}:${decision}:mahasiswa:${izin.mahasiswa_id}`,
    transaction,
  });
  for (const member of members) {
    await createSystemNotification({
      recipientType: "dosen", recipientId: member.dosen_id,
      type: NOTIFICATION_TYPES.EXTENSION_DECIDED_LECTURER,
      message: decision === "approved"
        ? `Izin semester ketiga ${source.mahasiswa?.nama || izin.mahasiswa_id} telah disetujui.`
        : `Izin semester ketiga ${source.mahasiswa?.nama || izin.mahasiswa_id} ditolak dan penetapan semester kedua diakhiri.`,
      referenceType: "izin_lanjut_skripsi", referenceId: izin.id,
      actionKey: "lecturer_supervision_history",
      metadata: { phase, decision, assignment_id: source.id, supervisor_order: member.urutan },
      deduplicationKey: `extension:${izin.id}:${decision}:dosen:${member.dosen_id}`,
      transaction,
    });
  }
}

async function loadActiveSource(mahasiswaId, transaction, lock = false) {
  if (lock && transaction) {
    const base = await PenetapanPembimbing.findOne({
      where: { mahasiswa_id: mahasiswaId, status: "active" },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!base) return null;
  }
  return PenetapanPembimbing.findOne({
    where: { mahasiswa_id: mahasiswaId, status: "active" },
    include: [{
      model: PenetapanPembimbingDosen,
      as: "pembimbings",
      include: [{ model: Dosen, as: "dosen" }],
    }, { model: Mahasiswa, as: "mahasiswa", attributes: ["id", "nim", "nama"] }],
    transaction,
  });
}

async function submitExtensionRequest({ mahasiswaId, alasanPengajuan, idempotencyKey, transaction = null }) {
  const reason = String(alasanPengajuan || "").trim();
  if (reason.length < 10) throw new SemesterAssignmentError("Alasan pengajuan wajib diisi minimal 10 karakter.", 400, "EXTENSION_REASON_REQUIRED");
  if (!idempotencyKey) throw new SemesterAssignmentError("Idempotency-Key wajib dikirim.", 400, "IDEMPOTENCY_KEY_REQUIRED");
  const requestPrint = print({ mahasiswaId: Number(mahasiswaId), reason });
  const run = async (t) => {
    const replay = await IzinLanjutSkripsi.findOne({ where: { idempotency_key: idempotencyKey }, transaction: t, lock: t.LOCK.UPDATE });
    if (replay) {
      if (replay.request_fingerprint !== requestPrint) throw new SemesterAssignmentError("Idempotency-Key digunakan untuk payload izin berbeda.", 409, "EXTENSION_IDEMPOTENCY_CONFLICT");
      return { izin: replay, replayed: true };
    }
    const mahasiswa = await Mahasiswa.findByPk(mahasiswaId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!mahasiswa) throw new SemesterAssignmentError("Mahasiswa tidak ditemukan.", 404, "STUDENT_NOT_FOUND");
    const source = await loadActiveSource(mahasiswaId, t, true);
    if (!source || Number(source.semester_penjaluran_ke) !== 2 || !source.pendaftaran_penjaluran_id) {
      throw new SemesterAssignmentError("Izin lanjut hanya dapat diajukan dari assignment aktif semester kedua.", 409, "EXTENSION_SOURCE_INVALID");
    }
    const p1 = source.pembimbings.find((item) => Number(item.urutan) === 1);
    if (!p1) throw new SemesterAssignmentError("Pembimbing 1 assignment tidak ditemukan.", 409, "ASSIGNMENT_MEMBER_INVALID");
    const target = await resolveNextAcademicPeriod(source.periode_mulai_id, null, t);
    const windowOpensAt = extensionWindowOpensAt(target);
    if (new Date() < windowOpensAt) {
      throw new SemesterAssignmentError("Jendela izin semester ketiga belum dibuka.", 409, "EXTENSION_WINDOW_NOT_OPEN", {
        opens_at: windowOpensAt,
        target_period_id: target.id,
        window_days: EXTENSION_WINDOW_DAYS,
      });
    }
    const existing = await IzinLanjutSkripsi.findOne({
      where: { mahasiswa_id: mahasiswaId, pendaftaran_penjaluran_id: source.pendaftaran_penjaluran_id, semester_penjaluran_ke: 3 },
      transaction: t,
    });
    if (existing) {
      if (existing.idempotency_key === idempotencyKey && existing.request_fingerprint === requestPrint) {
        return { izin: existing, replayed: true };
      }
      throw new SemesterAssignmentError("Izin semester ketiga pada siklus ini sudah ada.", 409, "EXTENSION_ALREADY_EXISTS");
    }
    let izin;
    try {
      await sequelize.transaction({ transaction: t }, async (savepoint) => {
        izin = await IzinLanjutSkripsi.create({
          mahasiswa_id: mahasiswaId,
          dosen_pembimbing_skripsi_id: p1.dosen_id,
          reviewer_p1_id: p1.dosen_id,
          periode_penjaluran_id: target.id,
          pendaftaran_penjaluran_id: source.pendaftaran_penjaluran_id,
          penetapan_asal_id: source.id,
          semester_penjaluran_ke: 3,
          status: "pending",
          alasan_pengajuan: reason,
          tanggal_pengajuan: new Date(),
          idempotency_key: idempotencyKey,
          request_fingerprint: requestPrint,
        }, { transaction: savepoint });
      });
    } catch (error) {
      if (error.name !== "SequelizeUniqueConstraintError") throw error;
      const raced = await IzinLanjutSkripsi.findOne({ where: { idempotency_key: idempotencyKey }, transaction: t });
      if (!raced || raced.request_fingerprint !== requestPrint) {
        throw new SemesterAssignmentError("Idempotency-Key digunakan untuk payload izin berbeda.", 409, "EXTENSION_IDEMPOTENCY_CONFLICT");
      }
      return { izin: raced, replayed: true };
    }
    await notifyExtensionMembers({ izin, source, phase: "submitted", transaction: t });
    return { izin, replayed: false };
  };
  return transaction ? run(transaction) : sequelize.transaction(run);
}

async function decideExtensionAndTransitionSemester({ izinId, reviewerDosenId, decision, note, idempotencyKey, transaction = null }) {
  const normalizedDecision = String(decision || "").toLowerCase();
  if (!['approved', 'rejected'].includes(normalizedDecision)) throw new SemesterAssignmentError("Keputusan izin tidak valid.", 400, "EXTENSION_DECISION_INVALID");
  if (normalizedDecision === "rejected" && !String(note || "").trim()) throw new SemesterAssignmentError("Alasan penolakan wajib diisi.", 400, "EXTENSION_REJECTION_REASON_REQUIRED");
  if (!idempotencyKey) throw new SemesterAssignmentError("Idempotency-Key wajib dikirim.", 400, "IDEMPOTENCY_KEY_REQUIRED");
  const normalizedNote = String(note || "").trim();
  const decisionPrint = print({ izinId: Number(izinId), reviewerDosenId: Number(reviewerDosenId), decision: normalizedDecision, note: normalizedNote });
  const run = async (t) => {
    const izin = await IzinLanjutSkripsi.findByPk(izinId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!izin) throw new SemesterAssignmentError("Izin lanjut tidak ditemukan.", 404, "EXTENSION_NOT_FOUND");
    if (izin.status === normalizedDecision) {
      if (izin.decision_idempotency_key !== idempotencyKey || izin.decision_request_fingerprint !== decisionPrint) {
        throw new SemesterAssignmentError("Keputusan identik hanya dapat diputar ulang dengan key dan payload yang sama.", 409, "EXTENSION_DECISION_IDEMPOTENCY_CONFLICT");
      }
      return { izin, assignment: izin.penetapan_hasil_id ? await PenetapanPembimbing.findByPk(izin.penetapan_hasil_id, { transaction: t }) : null, replayed: true };
    }
    if (izin.status !== "pending") throw new SemesterAssignmentError("Keputusan izin bertentangan dengan keputusan sebelumnya.", 409, "EXTENSION_DECISION_CONFLICT");
    if (Number(izin.reviewer_p1_id || izin.dosen_pembimbing_skripsi_id) !== Number(reviewerDosenId)) {
      throw new SemesterAssignmentError("Izin hanya dapat diputuskan oleh Pembimbing 1 yang direkam saat pengajuan.", 403, "EXTENSION_REVIEWER_FORBIDDEN");
    }
    const source = await loadActiveSource(izin.mahasiswa_id, t, true);
    if (!source || Number(source.id) !== Number(izin.penetapan_asal_id) || Number(source.semester_penjaluran_ke) !== 2) {
      throw new SemesterAssignmentError("Assignment sumber izin sudah berubah.", 409, "ASSIGNMENT_CHANGED");
    }
    const decidedAt = new Date();
    if (normalizedDecision === "approved") {
      await izin.update({
        status: "approved",
        keterangan_dosen: normalizedNote || "Disetujui Pembimbing 1.",
        tanggal_keputusan: decidedAt,
        decided_by_actor_type: "dosen",
        decided_by_actor_id: reviewerDosenId,
        decision_idempotency_key: idempotencyKey,
        decision_request_fingerprint: decisionPrint,
      }, { transaction: t });
      const transition = await carryForwardSemesterAssignment({
        expectedAssignmentId: source.id,
        targetPeriodId: izin.periode_penjaluran_id,
        effectiveAt: null,
        idempotencyKey: `extension:${izin.id}:${idempotencyKey}`,
        actorType: "dosen",
        actorId: reviewerDosenId,
        izinLanjutId: izin.id,
        targetSemester: 3,
        transaction: t,
      });
      if (transition.assignment && !(transition.assignments || []).length) {
        await izin.update({ penetapan_hasil_id: transition.assignment.id }, { transaction: t });
      }
      await notifyExtensionMembers({ izin, source, phase: "decided", decision: "approved", transaction: t });
      await izin.reload({ transaction: t });
      return {
        izin,
        assignment: transition.assignment || null,
        assignments: transition.assignments || [],
        group_id: transition.group_id || null,
        group_waiting_extensions: transition.group_waiting_extensions === true,
        group_needs_review: transition.group_needs_review === true,
        pending_members: transition.pending_members || [],
        code: transition.code || null,
        replayed: false,
        scheduled: transition.scheduled === true,
      };
    }

    await izin.update({
      status: "rejected",
      keterangan_dosen: String(note).trim(),
      tanggal_keputusan: decidedAt,
      decided_by_actor_type: "dosen",
      decided_by_actor_id: reviewerDosenId,
      decision_idempotency_key: idempotencyKey,
      decision_request_fingerprint: decisionPrint,
    }, { transaction: t });
    await source.update({
      status: "ended",
      tanggal_selesai: decidedAt,
      end_reason_code: "extension_rejected",
      semester_outcome_code: "extension_rejected",
      alasan_berakhir: END_REASON_LABELS.extension_rejected,
      ended_by_actor_type: "dosen",
      ended_by_actor_id: reviewerDosenId,
    }, { transaction: t });
    await PenetapanPembimbingDosen.update({ status: "ended", tanggal_selesai: decidedAt }, { where: { penetapan_pembimbing_id: source.id }, transaction: t });
    await Mahasiswa.update({ dosen_pembimbing_skripsi_id: null, status_jalur_saat_ini: "ulang", pengajuan_aktif_id: null }, { where: { id: izin.mahasiswa_id }, transaction: t });
    await BimbinganSkripsi.update({
      status_permohonan: "expired",
      catatan_dosen: "Dibatalkan otomatis karena izin semester ketiga ditolak.",
      tanggal_keputusan: decidedAt,
    }, {
      where: {
        mahasiswa_id: izin.mahasiswa_id,
        penetapan_pembimbing_id: source.id,
        pendaftaran_penjaluran_id: source.pendaftaran_penjaluran_id,
        status_permohonan: "pending",
      }, transaction: t,
    });
    await notifyExtensionMembers({ izin, source, phase: "decided", decision: "rejected", transaction: t });
    const membership = await AnggotaKelompokPerintisan.findOne({
      where: { pendaftaran_penjaluran_id: izin.pendaftaran_penjaluran_id }, transaction: t,
    });
    if (membership) {
      const group = await KelompokPerintisanBisnis.findByPk(membership.kelompok_id, { transaction: t, lock: t.LOCK.UPDATE });
      await markPerintisanGroupNeedsReview({
        group,
        error: new SemesterAssignmentError("Salah satu anggota kelompok ditolak melanjutkan ke semester ketiga.", 409, "PERINTISAN_EXTENSION_REJECTED", {
          izin_id: izin.id, mahasiswa_id: izin.mahasiswa_id, penetapan_asal_id: izin.penetapan_asal_id,
        }),
        transaction: t,
      });
    }
    return { izin, assignment: null, replayed: false };
  };
  return transaction ? run(transaction) : sequelize.transaction(run);
}

module.exports = { EXTENSION_WINDOW_DAYS, extensionWindowOpensAt, submitExtensionRequest, decideExtensionAndTransitionSemester };
