"use strict";

const crypto = require("node:crypto");
const { Op } = require("sequelize");
const {
  sequelize,
  Mahasiswa,
  PendaftaranPenjaluran,
  PeriodePenjaluran,
  PamitUlang,
  RiwayatPamitPenjaluran,
  BimbinganSkripsi,
  Pengajuan,
  PenetapanPembimbing,
  PenetapanPembimbingDosen,
  AnggotaKelompokPerintisan,
  KelompokPerintisanBisnis,
} = require("../models");
const { evaluatePeriodeWindow } = require("./periodePenjaluranService");
const { getActiveSupervisorAssignment, endActiveSupervisorAssignment } = require("./penetapanPembimbingService");
const { createSystemNotification } = require("./notificationService");
const { NOTIFICATION_TYPES } = require("../constants/notificationTypes");
const { buildSemesterLanjutanGate } = require("./semesterLanjutanService");

const ACTIVE_TRACKS = Object.freeze(["penelitian", "magang", "perintisan_bisnis"]);

class PenjaluranChangeError extends Error {
  constructor(message, statusCode = 409, code = "CHANGE_NOT_ALLOWED", detail = null) {
    super(message);
    this.name = "PenjaluranChangeError";
    this.statusCode = statusCode;
    this.code = code;
    this.detail = detail;
  }
}

const plain = (value) => value?.toJSON ? value.toJSON() : value;
const trackOf = (registration) => registration?.jalur === "alih"
  ? registration.penjaluran_baru
  : registration?.jenis_jalur_diambil;

function normalizeText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizeChangeType(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return null;
  if (!["ulang", "alih"].includes(normalized)) {
    throw new PenjaluranChangeError("Jenis pendaftaran harus ulang atau alih.", 400, "INVALID_CHANGE_TYPE");
  }
  return normalized;
}

function fingerprint(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function pamitFingerprint({ mahasiswaId, sourceId, periodId, assignmentId, changeType, sourceTrack, targetTrack, message, reason, note }) {
  return fingerprint({
    mahasiswa_id: Number(mahasiswaId), pendaftaran_lama_id: Number(sourceId), periode_tujuan_id: Number(periodId),
    penetapan_lama_id: Number(assignmentId), jenis_perubahan: changeType, jalur_asal: sourceTrack,
    jalur_tujuan: targetTrack, pesan: normalizeText(message), alasan: normalizeText(reason), catatan: normalizeText(note),
  });
}

function registrationFingerprint({ mahasiswaId, sourceId, periodId, targetTrack, changeType, pamitId, reason }) {
  return fingerprint({
    mahasiswa_id: Number(mahasiswaId), pendaftaran_lama_id: Number(sourceId), periode_tujuan_id: Number(periodId),
    jalur_tujuan: targetTrack, jenis_perubahan: changeType, pamit_id: Number(pamitId || 0) || null,
    alasan: normalizeText(reason),
  });
}

function withReplay(record, replayed) {
  return { ...plain(record), replayed: Boolean(replayed) };
}

function periodTime(period) {
  return new Date(period?.tanggal_mulai || period?.createdAt || 0).getTime() || 0;
}

async function activePeriod(transaction) {
  const period = await PeriodePenjaluran.findOne({
    where: { is_active: true, status: "active" },
    order: [["tanggal_mulai", "DESC NULLS LAST"], ["updatedAt", "DESC"], ["id", "DESC"]],
    transaction,
  });
  if (!period || !evaluatePeriodeWindow(period).is_open) {
    throw new PenjaluranChangeError("Periode pendaftaran ulang/alih belum dibuka.", 403, "PERIODE_NOT_OPEN");
  }
  return period;
}

async function resolveLatestApprovedRegistration(mahasiswaId, transaction) {
  const rows = await PendaftaranPenjaluran.findAll({
    where: { mahasiswa_id: mahasiswaId, status: "approved" },
    include: [{ model: PeriodePenjaluran, as: "periode", required: false }],
    transaction,
  });
  rows.sort((a, b) => {
    const periodDiff = periodTime(b.periode) - periodTime(a.periode);
    if (periodDiff) return periodDiff;
    const decisionDiff = new Date(b.reviewed_at || b.updatedAt || b.createdAt).getTime()
      - new Date(a.reviewed_at || a.updatedAt || a.createdAt).getTime();
    return decisionDiff || Number(b.id) - Number(a.id);
  });
  const registration = rows[0] || null;
  const track = trackOf(registration);
  if (!registration || !ACTIVE_TRACKS.includes(track)) {
    throw new PenjaluranChangeError(
      "Riwayat pendaftaran yang disetujui pada jalur aktif tidak ditemukan.", 409, "APPROVED_SOURCE_NOT_FOUND"
    );
  }
  return { registration, track };
}

async function expireStalePamits(mahasiswaId, currentPeriodId, transaction) {
  const stale = await PamitUlang.findAll({
    where: {
      mahasiswa_id: mahasiswaId,
      status: { [Op.in]: ["pending", "approved"] },
      periode_tujuan_id: { [Op.ne]: currentPeriodId },
    },
    transaction,
    lock: transaction?.LOCK?.UPDATE,
  });
  for (const pamit of stale) {
    const from = pamit.status;
    await pamit.update({ status: "cancelled", cancellation_reason: "Periode tujuan sudah ditutup." }, { transaction });
    await appendHistory(pamit, from, "cancelled", "period_expired", "system", null, "Periode tujuan sudah ditutup.", transaction);
  }
}

async function appendHistory(pamit, fromStatus, toStatus, eventType, actorType, actorId, note, transaction) {
  const key = `change-pamit:${pamit.id}:${eventType}:${toStatus}`;
  return RiwayatPamitPenjaluran.findOrCreate({
    where: { deduplication_key: key },
    defaults: {
      pamit_ulang_id: pamit.id, from_status: fromStatus || null, to_status: toStatus,
      event_type: eventType, actor_type: actorType, actor_id: actorId || null,
      note: note || null, metadata: {}, occurred_at: new Date(), deduplication_key: key,
    },
    transaction,
  });
}

function deriveSemester(angkatan, period) {
  const startYear = Number(String(period.tahun_akademik || "").slice(0, 4));
  const cohort = Number(angkatan);
  if (!startYear || !cohort || startYear < cohort) return 1;
  return Math.max(1, Math.min(14, ((startYear - cohort) * 2) + (period.semester === "ganjil" ? 1 : 2)));
}

function jakartaDateOnly() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

async function notifyP2({ pamit, type, message, suffix, transaction }) {
  const reviewerP2Id = Number(pamit.metadata?.reviewer_p2_id || 0) || null;
  if (!reviewerP2Id) return null;
  return createSystemNotification({
    recipientType: "dosen", recipientId: reviewerP2Id, type,
    message, referenceType: "pamit_penjaluran", referenceId: pamit.id,
    actionKey: "view_change_pamit", metadata: { mahasiswa_id: pamit.mahasiswa_id, view_only: true },
    deduplicationKey: `change-pamit:${pamit.id}:p2:${suffix}`, transaction,
  });
}

async function resolveActiveWorkflowBlockers(mahasiswa, sourceRegistration, transaction) {
  const blockers = [];
  const activeResearch = await Pengajuan.findOne({
    where: {
      mahasiswa_id: mahasiswa.id,
      status: { [Op.in]: ["pending", "menunggu_set_ketua_cluster", "menunggu_approval_sekprodi"] },
    },
    attributes: ["id", "status", "pendaftaran_penjaluran_id"],
    transaction,
  });
  if (activeResearch) blockers.push({
    code: "ACTIVE_RESEARCH_WORKFLOW",
    message: `Pengajuan Penelitian #${activeResearch.id} masih berstatus ${activeResearch.status}.`,
  });

  const activeNonResearch = await PendaftaranPenjaluran.findOne({
    where: {
      mahasiswa_id: mahasiswa.id,
      jenis_jalur_diambil: { [Op.in]: ["magang", "perintisan_bisnis"] },
      form_lanjutan_status: { [Op.in]: ["pending", "draft", "submitted", "review_dosen_magang", "review_sekprodi"] },
    },
    attributes: ["id", "jenis_jalur_diambil", "form_lanjutan_status"],
    transaction,
  });
  if (activeNonResearch) blockers.push({
    code: "ACTIVE_NON_RESEARCH_WORKFLOW",
    message: `Form ${activeNonResearch.jenis_jalur_diambil.replace(/_/g, " ")} #${activeNonResearch.id} masih berstatus ${activeNonResearch.form_lanjutan_status}.`,
  });

  const activeMembership = await AnggotaKelompokPerintisan.findOne({
    where: { mahasiswa_id: mahasiswa.id },
    include: [{
      model: KelompokPerintisanBisnis,
      as: "kelompok",
      required: true,
      where: { status: { [Op.in]: ["draft", "submitted"] } },
      attributes: ["id", "status"],
    }],
    transaction,
  });
  if (activeMembership) blockers.push({
    code: "ACTIVE_BUSINESS_GROUP",
    message: `Mahasiswa masih terikat kelompok Perintisan Bisnis #${activeMembership.kelompok_id} yang aktif.`,
  });

  const semesterGate = await buildSemesterLanjutanGate(mahasiswa, transaction);
  if (semesterGate?.is_locked && !semesterGate.must_ulang_jalur) blockers.push({
    code: "SEMESTER_CONTINUATION_GATE",
    message: semesterGate.message || "Gate izin semester lanjutan belum selesai.",
  });
  return { blockers, semesterGate };
}

async function getEligibility(mahasiswaId, { targetTrack = null, changeType = null, transaction = null } = {}) {
  const period = await activePeriod(transaction);
  await expireStalePamits(mahasiswaId, period.id, transaction);
  const mahasiswa = await Mahasiswa.findByPk(mahasiswaId, { transaction });
  if (!mahasiswa) throw new PenjaluranChangeError("Mahasiswa tidak ditemukan.", 404, "STUDENT_NOT_FOUND");
  const source = await resolveLatestApprovedRegistration(mahasiswaId, transaction);
  const requestedChangeType = normalizeChangeType(changeType);
  const requestedTarget = String(targetTrack || "").trim().toLowerCase().replace(/\s+/g, "_");
  const normalizedTarget = requestedChangeType === "ulang" ? source.track : (requestedTarget || source.track);
  if (!ACTIVE_TRACKS.includes(normalizedTarget)) {
    throw new PenjaluranChangeError("Jalur tujuan tidak aktif.", 400, "INVALID_TARGET_TRACK");
  }
  if (requestedChangeType === "ulang" && requestedTarget && requestedTarget !== source.track) {
    throw new PenjaluranChangeError(
      "Pendaftaran ulang wajib menggunakan jalur yang sama dengan periode sebelumnya.",
      409,
      "REPEAT_TRACK_MUST_MATCH_SOURCE"
    );
  }
  if (requestedChangeType === "alih" && !requestedTarget) {
    throw new PenjaluranChangeError("Jalur tujuan wajib dipilih untuk pendaftaran alih.", 400, "TRANSFER_TARGET_REQUIRED");
  }
  if (requestedChangeType === "alih" && normalizedTarget === source.track) {
    throw new PenjaluranChangeError(
      "Pendaftaran alih wajib memilih jalur yang berbeda dari periode sebelumnya.",
      409,
      "TRANSFER_TRACK_MUST_DIFFER"
    );
  }
  const existing = await PendaftaranPenjaluran.findOne({
    where: { mahasiswa_id: mahasiswaId, periode_penjaluran_id: period.id }, transaction,
  });
  const assignment = await getActiveSupervisorAssignment(mahasiswaId, transaction);
  const openPamit = await PamitUlang.findOne({
    where: { mahasiswa_id: mahasiswaId, periode_tujuan_id: period.id, status: { [Op.in]: ["pending", "approved"] } },
    order: [["createdAt", "DESC"]], transaction,
  });
  const resolvedChangeType = normalizedTarget === source.track ? "ulang" : "alih";
  // Pamit approved tetap menjadi tiket wajib walaupun approval sudah mengakhiri
  // penetapan aktif. Tanpa ini tiket tidak akan pernah dikonsumsi saat commit.
  const requiresPamit = Boolean(assignment.penetapan || openPamit);
  const workflow = await resolveActiveWorkflowBlockers(mahasiswa, source.registration, transaction);
  const blockerDetails = workflow.blockers.filter(
    (item) => !(openPamit?.status === "approved" && item.code === "SEMESTER_CONTINUATION_GATE")
  );
  if (existing) blockerDetails.push({ code: "EXISTING_PERIOD_REGISTRATION", message: "Mahasiswa sudah mempunyai pendaftaran pada periode aktif." });
  if (mahasiswa.pengajuan_aktif_id && !workflow.blockers.some((item) => item.code === "ACTIVE_RESEARCH_WORKFLOW")) {
    blockerDetails.push({ code: "ACTIVE_SUBMISSION_CACHE", message: "Masih ada pengajuan aktif yang harus diselesaikan." });
  }
  if (requiresPamit && !openPamit) blockerDetails.push({ code: "PAMIT_REQUIRED", message: "Pamit kepada Pembimbing 1 belum diajukan." });
  const blockers = blockerDetails.map((item) => item.message);
  return {
    eligible: blockers.length === 0,
    blockers,
    mahasiswa: { id: mahasiswa.id, nim: mahasiswa.nim, nama: mahasiswa.nama },
    periode: plain(period), source_registration: plain(source.registration), source_track: source.track,
    target_track: normalizedTarget, change_type: resolvedChangeType, requires_pamit: requiresPamit,
    active_assignment: plain(assignment.penetapan),
    reviewer_p1: plain(assignment.pembimbing_1) || (openPamit?.reviewer_p1_id ? { id: openPamit.reviewer_p1_id } : null),
    reviewer_p2: plain(assignment.pembimbing_2), pamit: plain(openPamit),
    blocker_details: blockerDetails,
    semester_gate: workflow.semesterGate,
  };
}

async function submitPamit({ mahasiswaId, targetTrack, changeType = null, message, reason, note, idempotencyKey = null }) {
  const normalizedKey = normalizeText(idempotencyKey);
  if (!normalizedKey) {
    throw new PenjaluranChangeError("Header Idempotency-Key wajib dikirim untuk pengajuan pamit.", 400, "IDEMPOTENCY_KEY_REQUIRED");
  }
  if (normalizedKey.length > 255) {
    throw new PenjaluranChangeError("Idempotency-Key maksimal 255 karakter.", 400, "INVALID_IDEMPOTENCY_KEY");
  }
  let requestedFingerprint = null;
  try {
    return await sequelize.transaction(async (transaction) => {
    if (String(message || "").trim().length < 10 || String(reason || "").trim().length < 10) {
      throw new PenjaluranChangeError("Pesan pamit dan alasan minimal 10 karakter wajib diisi.", 400, "INVALID_PAMIT_PAYLOAD");
    }
    const eligibility = await getEligibility(mahasiswaId, { targetTrack, changeType, transaction });
    const hardBlockers = (eligibility.blocker_details || []).filter(
      (item) => item.code !== "PAMIT_REQUIRED"
    );
    if (hardBlockers.length) {
      throw new PenjaluranChangeError(
        hardBlockers.map((item) => item.message).join(" "), 409, "ACTIVE_WORKFLOW_EXISTS", { blockers: hardBlockers }
      );
    }
    if (!eligibility.requires_pamit) {
      throw new PenjaluranChangeError("Pamit tidak diperlukan karena tidak ada penetapan pembimbing aktif.", 409, "PAMIT_NOT_REQUIRED");
    }
    const source = eligibility.source_registration;
    requestedFingerprint = pamitFingerprint({
      mahasiswaId, sourceId: source.id, periodId: eligibility.periode.id,
      assignmentId: eligibility.active_assignment?.id || eligibility.pamit?.penetapan_lama_id,
      changeType: eligibility.change_type, sourceTrack: eligibility.source_track, targetTrack: eligibility.target_track,
      message, reason, note,
    });
    if (eligibility.pamit) {
      const sameKey = eligibility.pamit.idempotency_key === normalizedKey;
      const sameFingerprint = eligibility.pamit.metadata?.request_fingerprint === requestedFingerprint;
      if (sameKey && sameFingerprint) return withReplay(eligibility.pamit, true);
      throw new PenjaluranChangeError(
        "Masih ada pamit aktif dengan payload atau Idempotency-Key yang berbeda.",
        409,
        "PAMIT_IDEMPOTENCY_CONFLICT",
        { active_pamit_id: eligibility.pamit.id }
      );
    }
    const now = new Date();
    const pamit = await PamitUlang.create({
      mahasiswa_id: mahasiswaId,
      pengajuan_sebelumnya_id: null,
      periode_tujuan_id: eligibility.periode.id,
      pendaftaran_lama_id: source.id,
      penetapan_lama_id: eligibility.active_assignment.id,
      reviewer_p1_id: eligibility.reviewer_p1.id,
      jenis_perubahan: eligibility.change_type,
      jalur_asal: eligibility.source_track,
      jalur_tujuan: eligibility.target_track,
      pesan_ke_dosen_pembimbing: String(message).trim(), alasan_ulang: String(reason).trim(),
      catatan_tambahan: String(note || "").trim() || null,
      status: "approved", status_dospem: "approved", status_dpa: "approved",
      submitted_at: now, decided_at: now,
      tanggal_approval_dospem: now, tanggal_approval_dpa: now,
      keterangan_dospem: "Pamit diterima sebagai pemberitahuan; tidak memerlukan keputusan dosen.",
      keterangan_dpa: "Tidak memerlukan keputusan DPA.",
      idempotency_key: normalizedKey,
      metadata: {
        reviewer_p2_id: eligibility.reviewer_p2?.id || null,
        request_fingerprint: requestedFingerprint,
        notification_only: true,
      },
    }, { transaction });
    await appendHistory(pamit, null, "approved", "notification_sent", "mahasiswa", mahasiswaId, reason, transaction);
    await BimbinganSkripsi.update({
      status_permohonan: "cancelled_supervisor_change",
      catatan_dosen: "Dibatalkan otomatis karena mahasiswa mengirim pamit ulang/alih jalur.",
      tanggal_keputusan: now,
    }, {
      where: {
        mahasiswa_id: mahasiswaId,
        pendaftaran_penjaluran_id: source.id,
        status_permohonan: "pending",
        permintaan_tanggal: { [Op.gte]: jakartaDateOnly() },
      },
      transaction,
    });
    if (eligibility.active_assignment?.id) {
      await endActiveSupervisorAssignment({
        mahasiswaId,
        tanggalSelesai: now,
        expectedAssignmentId: eligibility.active_assignment.id,
        alasanBerakhir: `Mahasiswa mengirim pamit ${eligibility.change_type} jalur.`,
        endReasonCode: "pamit_notified",
        semesterOutcomeCode: eligibility.change_type === "alih" ? "transferred" : "repeated",
        endedByActorType: "mahasiswa",
        endedByActorId: mahasiswaId,
        transaction,
      });
    }
    await createSystemNotification({
      recipientType: "dosen", recipientId: eligibility.reviewer_p1.id,
      type: NOTIFICATION_TYPES.CHANGE_PAMIT_REQUESTED_LECTURER,
      message: `${eligibility.mahasiswa.nama} (${eligibility.mahasiswa.nim}) menyampaikan pamit untuk ${eligibility.change_type} dari ${eligibility.source_track} ke ${eligibility.target_track}. Alasan: ${normalizeText(reason)} Pesan: ${normalizeText(message)}`,
      referenceType: "pamit_penjaluran", referenceId: pamit.id, actionKey: "view_change_pamit",
      metadata: { mahasiswa_id: mahasiswaId, notification_only: true }, deduplicationKey: `change-pamit:${pamit.id}:reviewer`, transaction,
    });
    await notifyP2({
      pamit,
      type: NOTIFICATION_TYPES.CHANGE_PAMIT_INFO_LECTURER,
      message: `${eligibility.mahasiswa.nama} (${eligibility.mahasiswa.nim}) menyampaikan pamit ${eligibility.change_type} jalur. Alasan: ${normalizeText(reason)} Pesan: ${normalizeText(message)}`,
      suffix: "submitted",
      transaction,
    });
      return withReplay(pamit, false);
    });
  } catch (error) {
    if (error?.name !== "SequelizeUniqueConstraintError") throw error;
    const repeated = await PamitUlang.findOne({
      where: { mahasiswa_id: mahasiswaId, status: { [Op.in]: ["pending", "approved"] } },
      order: [["createdAt", "DESC"]],
    });
    if (repeated?.idempotency_key === normalizedKey && repeated?.metadata?.request_fingerprint === requestedFingerprint) {
      return withReplay(repeated, true);
    }
    if (repeated) throw new PenjaluranChangeError(
      "Masih ada pamit aktif dengan payload atau Idempotency-Key yang berbeda.", 409, "PAMIT_IDEMPOTENCY_CONFLICT",
      { active_pamit_id: repeated.id }
    );
    throw error;
  }
}

async function decidePamit({ pamitId, dosenId, decision, note }) {
  if (!["approved", "rejected"].includes(decision)) {
    throw new PenjaluranChangeError("Keputusan harus approved atau rejected.", 400, "INVALID_DECISION");
  }
  return sequelize.transaction(async (transaction) => {
    const pamit = await PamitUlang.findByPk(pamitId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!pamit) throw new PenjaluranChangeError("Pamit tidak ditemukan.", 404, "PAMIT_NOT_FOUND");
    if (Number(pamit.reviewer_p1_id) !== Number(dosenId)) {
      throw new PenjaluranChangeError("Keputusan hanya dapat diberikan oleh Pembimbing 1 yang terkunci saat pamit dibuat.", 403, "NOT_LOCKED_REVIEWER");
    }
    if (pamit.status === decision) return withReplay(pamit, true);
    if (pamit.status !== "pending") {
      throw new PenjaluranChangeError(
        `Pamit sudah berstatus ${pamit.status} dan tidak dapat diubah menjadi ${decision}.`,
        409,
        "PAMIT_DECISION_CONFLICT"
      );
    }
    const snapshotAssignment = pamit.penetapan_lama_id
      ? await PenetapanPembimbing.findByPk(pamit.penetapan_lama_id, { transaction, lock: transaction.LOCK.UPDATE })
      : null;
    const currentAssignment = await PenetapanPembimbing.findOne({
      where: { mahasiswa_id: pamit.mahasiswa_id, status: "active" },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    const snapshotPrimary = snapshotAssignment
      ? await PenetapanPembimbingDosen.findOne({
          where: { penetapan_pembimbing_id: snapshotAssignment.id, urutan: 1 },
          transaction,
          lock: transaction.LOCK.UPDATE,
        })
      : null;
    const assignmentChanged = !snapshotAssignment
      || snapshotAssignment.status !== "active"
      || Number(currentAssignment?.id) !== Number(snapshotAssignment.id)
      || Number(snapshotPrimary?.dosen_id) !== Number(pamit.reviewer_p1_id);
    if (assignmentChanged) {
      const from = pamit.status;
      if (from === "pending") {
        await pamit.update({
          status: "cancelled",
          cancellation_reason: "assignment_changed",
          metadata: {
            ...(pamit.metadata || {}),
            cancellation_detail: {
              expected_assignment_id: pamit.penetapan_lama_id,
              active_assignment_id: currentAssignment?.id || null,
            },
          },
        }, { transaction });
        await appendHistory(
          pamit, from, "cancelled", "assignment_changed", "system", null,
          "Penetapan pembimbing berubah. Ajukan pamit baru kepada Pembimbing 1 aktif.", transaction
        );
        await createSystemNotification({
          recipientType: "mahasiswa", recipientId: pamit.mahasiswa_id,
          type: NOTIFICATION_TYPES.CHANGE_PAMIT_DECIDED_STUDENT,
          message: "Pamit dibatalkan karena penetapan pembimbing telah berubah. Ajukan pamit baru kepada Pembimbing 1 aktif.",
          referenceType: "pamit_penjaluran", referenceId: pamit.id, actionKey: "student_change_history",
          metadata: { reason: "assignment_changed" },
          deduplicationKey: `change-pamit:${pamit.id}:cancelled:assignment-changed`, transaction,
        });
        await notifyP2({
          pamit, type: NOTIFICATION_TYPES.CHANGE_PAMIT_INFO_LECTURER,
          message: "Pamit mahasiswa dibatalkan otomatis karena penetapan pembimbing telah berubah.",
          suffix: "assignment-changed", transaction,
        });
      }
      return plain(pamit);
    }
    const targetPeriod = pamit.periode_tujuan_id
      ? await PeriodePenjaluran.findByPk(pamit.periode_tujuan_id, { transaction })
      : null;
    if (!targetPeriod || !evaluatePeriodeWindow(targetPeriod).is_open) {
      const from = pamit.status;
      if (from === "pending") {
        await pamit.update({ status: "cancelled", cancellation_reason: "Periode tujuan sudah ditutup." }, { transaction });
        await appendHistory(pamit, from, "cancelled", "period_expired", "system", null, "Periode tujuan sudah ditutup.", transaction);
      }
      return plain(pamit);
    }
    if (decision === "rejected" && String(note || "").trim().length < 3) {
      throw new PenjaluranChangeError("Alasan penolakan wajib diisi.", 400, "REJECTION_NOTE_REQUIRED");
    }
    const now = new Date();
    await pamit.update({
      status: decision, status_dospem: decision, status_dpa: decision,
      keterangan_dospem: String(note || "").trim() || "Disetujui Pembimbing 1",
      keterangan_dpa: "Tidak diperlukan; mengikuti keputusan Pembimbing 1.",
      tanggal_approval_dospem: now, tanggal_approval_dpa: now, decided_at: now,
    }, { transaction });
    if (decision === "approved") {
      await BimbinganSkripsi.update({
        status_permohonan: "cancelled_supervisor_change",
        catatan_dosen: "Dibatalkan otomatis karena siklus penjaluran lama diakhiri.",
        tanggal_keputusan: now,
      }, {
        where: {
          mahasiswa_id: pamit.mahasiswa_id,
          pendaftaran_penjaluran_id: pamit.pendaftaran_lama_id,
          status_permohonan: "pending",
          permintaan_tanggal: { [Op.gte]: jakartaDateOnly() },
        }, transaction,
      });
      await endActiveSupervisorAssignment({
        mahasiswaId: pamit.mahasiswa_id, tanggalSelesai: now,
        expectedAssignmentId: pamit.penetapan_lama_id,
        alasanBerakhir: `Pamit ${pamit.jenis_perubahan} jalur disetujui.`,
        endReasonCode: "pamit_approved",
        semesterOutcomeCode: pamit.jenis_perubahan === "alih" ? "transferred" : "repeated",
        endedByActorType: "dosen",
        endedByActorId: dosenId,
        transaction,
      });
    }
    await appendHistory(pamit, "pending", decision, `decision_${decision}`, "dosen", dosenId, note, transaction);
    await createSystemNotification({
      recipientType: "mahasiswa", recipientId: pamit.mahasiswa_id,
      type: NOTIFICATION_TYPES.CHANGE_PAMIT_DECIDED_STUDENT,
      message: `Pamit ${pamit.jenis_perubahan} jalur ${decision === "approved" ? "disetujui" : "ditolak"} oleh Pembimbing 1.`,
      referenceType: "pamit_penjaluran", referenceId: pamit.id, actionKey: "student_change_history",
      metadata: { decision }, deduplicationKey: `change-pamit:${pamit.id}:decision:${decision}`, transaction,
    });
    await notifyP2({
      pamit,
      type: NOTIFICATION_TYPES.CHANGE_PAMIT_INFO_LECTURER,
      message: `Pamit ${pamit.jenis_perubahan} jalur mahasiswa ${decision === "approved" ? "disetujui; penetapan lama telah berakhir" : "ditolak"} oleh Pembimbing 1.`,
      suffix: `decision-${decision}`,
      transaction,
    });
    return withReplay(pamit, false);
  });
}

async function createChangeRegistration({ mahasiswaId, targetTrack, changeType = null, reason, pamitId = null, idempotencyKey = null }) {
  const normalizedKey = normalizeText(idempotencyKey);
  if (!normalizedKey) {
    throw new PenjaluranChangeError("Header Idempotency-Key wajib dikirim untuk pendaftaran ulang/alih.", 400, "IDEMPOTENCY_KEY_REQUIRED");
  }
  if (normalizedKey.length > 255) {
    throw new PenjaluranChangeError("Idempotency-Key maksimal 255 karakter.", 400, "INVALID_IDEMPOTENCY_KEY");
  }
  if (normalizeText(reason).length < 10) {
    throw new PenjaluranChangeError("Alasan pendaftaran minimal 10 karakter.", 400, "INVALID_CHANGE_REASON");
  }
  return sequelize.transaction(async (transaction) => {
    const mahasiswa = await Mahasiswa.findByPk(mahasiswaId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!mahasiswa) throw new PenjaluranChangeError("Mahasiswa tidak ditemukan.", 404, "STUDENT_NOT_FOUND");
    const replay = await PendaftaranPenjaluran.findOne({
      where: { mahasiswa_id: mahasiswaId, change_idempotency_key: normalizedKey },
      transaction,
    });
    if (replay) {
      const replayPamit = await PamitUlang.findOne({
        where: { pendaftaran_baru_id: replay.id },
        transaction,
      });
      const replayFingerprint = registrationFingerprint({
        mahasiswaId, sourceId: replay.pendaftaran_asal_id, periodId: replay.periode_penjaluran_id,
        targetTrack: trackOf(replay), changeType: replay.jalur, pamitId: replayPamit?.id || null, reason,
      });
      if (replay.change_fingerprint !== replayFingerprint) {
        throw new PenjaluranChangeError(
          "Idempotency-Key pendaftaran sudah digunakan untuk payload berbeda.", 409, "CHANGE_IDEMPOTENCY_CONFLICT",
          { registration_id: replay.id }
        );
      }
      return { registration: plain(replay), pamit: plain(replayPamit), eligibility: null, replayed: true };
    }
    const eligibility = await getEligibility(mahasiswaId, { targetTrack, changeType, transaction });
    if (!eligibility.eligible) throw new PenjaluranChangeError(eligibility.blockers.join(" "), 409, "CHANGE_NOT_ELIGIBLE", eligibility);
    let pamit = null;
    if (eligibility.requires_pamit) {
      pamit = await PamitUlang.findByPk(pamitId || eligibility.pamit?.id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!pamit || !["pending", "approved"].includes(pamit.status) || Number(pamit.periode_tujuan_id) !== Number(eligibility.periode.id)
        || Number(pamit.pendaftaran_lama_id) !== Number(eligibility.source_registration.id)
        || pamit.jalur_tujuan !== eligibility.target_track) {
        throw new PenjaluranChangeError("Pamit tidak cocok dengan sumber, tujuan, dan periode pendaftaran.", 409, "PAMIT_MISMATCH");
      }
      if (pamit.status === "pending") {
        await pamit.update({
          status: "approved",
          status_dospem: "approved",
          status_dpa: "approved",
          decided_at: new Date(),
          keterangan_dospem: "Pamit lama dikonversi menjadi pemberitahuan tanpa keputusan dosen.",
          keterangan_dpa: "Tidak memerlukan keputusan DPA.",
          metadata: { ...(pamit.metadata || {}), notification_only: true },
        }, { transaction });
      }
    }
    const source = eligibility.source_registration;
    const requestFingerprint = registrationFingerprint({
      mahasiswaId, sourceId: source.id, periodId: eligibility.periode.id,
      targetTrack: eligibility.target_track, changeType: eligibility.change_type, pamitId: pamit?.id || null, reason,
    });
    const registration = await PendaftaranPenjaluran.create({
      mahasiswa_id: mahasiswaId, periode_penjaluran_id: eligibility.periode.id,
      pendaftaran_asal_id: source.id, jalur: eligibility.change_type,
      change_idempotency_key: normalizedKey,
      change_fingerprint: requestFingerprint,
      program_kuliah: source.program_kuliah || "reguler",
      semester_mahasiswa: deriveSemester(mahasiswa.angkatan, eligibility.periode),
      status: "approved", form_lanjutan_status: "draft",
      dosen_pembimbing_akademik_id: mahasiswa.dosen_pembimbing_akademik_id || source.dosen_pembimbing_akademik_id,
      jenis_jalur_diambil: eligibility.target_track,
      penjaluran_sebelumnya: eligibility.source_track,
      penjaluran_baru: eligibility.change_type === "alih" ? eligibility.target_track : null,
      dosen_pembimbing_ta_sebelumnya_id: eligibility.reviewer_p1?.id || null,
      catatan: String(reason || "").trim() || null,
    }, { transaction });
    if (pamit) {
      await pamit.update({ status: "consumed", pendaftaran_baru_id: registration.id, consumed_at: new Date() }, { transaction });
      await appendHistory(pamit, "approved", "consumed", "registration_created", "mahasiswa", mahasiswaId, reason, transaction);
    }
    await mahasiswa.update({ status_jalur_saat_ini: "belum_mengajukan", pengajuan_aktif_id: null }, { transaction });
    await createSystemNotification({
      recipientType: "mahasiswa", recipientId: mahasiswaId,
      type: NOTIFICATION_TYPES.CHANGE_REGISTRATION_CREATED_STUDENT,
      message: `Pendaftaran ${eligibility.change_type} menuju jalur ${eligibility.target_track} berhasil dibuat.`,
      referenceType: "pendaftaran_penjaluran", referenceId: registration.id, actionKey: "student_path_form",
      metadata: { source_registration_id: source.id },
      deduplicationKey: `change-registration:${registration.id}:student`, transaction,
    });
    return { registration: plain(registration), pamit: plain(pamit), eligibility, replayed: false };
  });
}

async function getPamitDetail(mahasiswaId, pamitId) {
  const pamit = await PamitUlang.findOne({
    where: { id: pamitId, mahasiswa_id: mahasiswaId },
    include: [{ model: RiwayatPamitPenjaluran, as: "riwayatStatus", required: false }],
    order: [[{ model: RiwayatPamitPenjaluran, as: "riwayatStatus" }, "occurred_at", "ASC"]],
  });
  if (!pamit) throw new PenjaluranChangeError("Pamit tidak ditemukan.", 404, "PAMIT_NOT_FOUND");
  return plain(pamit);
}

async function getChangeHistory(mahasiswaId) {
  return PendaftaranPenjaluran.findAll({
    where: { mahasiswa_id: mahasiswaId, jalur: { [Op.in]: ["ulang", "alih"] } },
    include: [{ model: PendaftaranPenjaluran, as: "pendaftaranAsal", required: false }],
    order: [["createdAt", "DESC"], ["id", "DESC"]],
  });
}

async function getLatestPamitStatus(mahasiswaId) {
  const pamit = await PamitUlang.findOne({
    where: { mahasiswa_id: mahasiswaId },
    include: [{ model: RiwayatPamitPenjaluran, as: "riwayatStatus", required: false }],
    order: [["createdAt", "DESC"], [{ model: RiwayatPamitPenjaluran, as: "riwayatStatus" }, "occurred_at", "ASC"]],
  });
  if (!pamit) return { has_pamit: false, can_continue: false, lifecycle_status: null, pamit: null };
  return {
    has_pamit: true,
    pamit_id: pamit.id,
    lifecycle_status: pamit.status,
    status_dospem: pamit.status_dospem,
    can_continue: ["pending", "approved"].includes(pamit.status) && !pamit.pendaftaran_baru_id,
    consumed: pamit.status === "consumed",
    cancelled: pamit.status === "cancelled",
    pendaftaran_baru_id: pamit.pendaftaran_baru_id || null,
    pamit: plain(pamit),
  };
}

async function getPamitHistory(mahasiswaId) {
  return PamitUlang.findAll({
    where: { mahasiswa_id: mahasiswaId },
    include: [{ model: RiwayatPamitPenjaluran, as: "riwayatStatus", required: false }],
    order: [["createdAt", "DESC"], [{ model: RiwayatPamitPenjaluran, as: "riwayatStatus" }, "occurred_at", "ASC"]],
  });
}

async function cancelPamitsForClosedPeriod(periodId, transaction) {
  const pamits = await PamitUlang.findAll({
    where: { periode_tujuan_id: periodId, status: { [Op.in]: ["pending", "approved"] } },
    transaction,
    lock: transaction?.LOCK?.UPDATE,
  });
  for (const pamit of pamits) {
    const from = pamit.status;
    await pamit.update({ status: "cancelled", cancellation_reason: "period_closed" }, { transaction });
    await appendHistory(pamit, from, "cancelled", "period_expired", "system", null, "Periode tujuan ditutup.", transaction);
    await createSystemNotification({
      recipientType: "mahasiswa", recipientId: pamit.mahasiswa_id,
      type: NOTIFICATION_TYPES.CHANGE_PAMIT_DECIDED_STUDENT,
      message: "Pamit dibatalkan otomatis karena periode tujuan telah ditutup.",
      referenceType: "pamit_penjaluran", referenceId: pamit.id, actionKey: "student_change_history",
      metadata: { reason: "period_closed" }, deduplicationKey: `change-pamit:${pamit.id}:cancelled:period-closed`, transaction,
    });
    await notifyP2({
      pamit, type: NOTIFICATION_TYPES.CHANGE_PAMIT_INFO_LECTURER,
      message: "Pamit mahasiswa dibatalkan otomatis karena periode tujuan telah ditutup.",
      suffix: "period-closed", transaction,
    });
  }
  return pamits.length;
}

module.exports = {
  ACTIVE_TRACKS, PenjaluranChangeError, resolveLatestApprovedRegistration, getEligibility,
  submitPamit, decidePamit, createChangeRegistration, getPamitDetail, getChangeHistory,
  getLatestPamitStatus, getPamitHistory,
  cancelPamitsForClosedPeriod,
};
