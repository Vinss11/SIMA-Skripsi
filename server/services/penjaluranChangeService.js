"use strict";

const { Op } = require("sequelize");
const {
  sequelize,
  Mahasiswa,
  PendaftaranPenjaluran,
  PeriodePenjaluran,
  PamitUlang,
  RiwayatPamitPenjaluran,
  BimbinganSkripsi,
} = require("../models");
const { evaluatePeriodeWindow } = require("./periodePenjaluranService");
const { getActiveSupervisorAssignment, endActiveSupervisorAssignment } = require("./penetapanPembimbingService");
const { createSystemNotification } = require("./notificationService");
const { NOTIFICATION_TYPES } = require("../constants/notificationTypes");

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

async function getEligibility(mahasiswaId, { targetTrack = null, transaction = null } = {}) {
  const period = await activePeriod(transaction);
  await expireStalePamits(mahasiswaId, period.id, transaction);
  const mahasiswa = await Mahasiswa.findByPk(mahasiswaId, { transaction });
  if (!mahasiswa) throw new PenjaluranChangeError("Mahasiswa tidak ditemukan.", 404, "STUDENT_NOT_FOUND");
  const source = await resolveLatestApprovedRegistration(mahasiswaId, transaction);
  const normalizedTarget = String(targetTrack || source.track).trim().toLowerCase().replace(/\s+/g, "_");
  if (!ACTIVE_TRACKS.includes(normalizedTarget)) {
    throw new PenjaluranChangeError("Jalur tujuan tidak aktif.", 400, "INVALID_TARGET_TRACK");
  }
  const existing = await PendaftaranPenjaluran.findOne({
    where: { mahasiswa_id: mahasiswaId, periode_penjaluran_id: period.id }, transaction,
  });
  const assignment = await getActiveSupervisorAssignment(mahasiswaId, transaction);
  const openPamit = await PamitUlang.findOne({
    where: { mahasiswa_id: mahasiswaId, periode_tujuan_id: period.id, status: { [Op.in]: ["pending", "approved"] } },
    order: [["createdAt", "DESC"]], transaction,
  });
  const changeType = normalizedTarget === source.track ? "ulang" : "alih";
  // Pamit approved tetap menjadi tiket wajib walaupun approval sudah mengakhiri
  // penetapan aktif. Tanpa ini tiket tidak akan pernah dikonsumsi saat commit.
  const requiresPamit = Boolean(assignment.penetapan || openPamit);
  const blockers = [];
  if (existing) blockers.push("Mahasiswa sudah mempunyai pendaftaran pada periode aktif.");
  if (mahasiswa.pengajuan_aktif_id) blockers.push("Masih ada pengajuan aktif yang harus diselesaikan.");
  if (requiresPamit && !openPamit) blockers.push("Pamit kepada Pembimbing 1 belum diajukan.");
  if (requiresPamit && openPamit?.status === "pending") blockers.push("Pamit masih menunggu keputusan Pembimbing 1.");
  return {
    eligible: blockers.length === 0,
    blockers,
    periode: plain(period), source_registration: plain(source.registration), source_track: source.track,
    target_track: normalizedTarget, change_type: changeType, requires_pamit: requiresPamit,
    active_assignment: plain(assignment.penetapan),
    reviewer_p1: plain(assignment.pembimbing_1) || (openPamit?.reviewer_p1_id ? { id: openPamit.reviewer_p1_id } : null),
    reviewer_p2: plain(assignment.pembimbing_2), pamit: plain(openPamit),
  };
}

async function submitPamit({ mahasiswaId, targetTrack, message, reason, note, idempotencyKey = null }) {
  try {
    return await sequelize.transaction(async (transaction) => {
    if (String(message || "").trim().length < 10 || String(reason || "").trim().length < 10) {
      throw new PenjaluranChangeError("Pesan pamit dan alasan minimal 10 karakter wajib diisi.", 400, "INVALID_PAMIT_PAYLOAD");
    }
    const eligibility = await getEligibility(mahasiswaId, { targetTrack, transaction });
    if (!eligibility.requires_pamit) {
      throw new PenjaluranChangeError("Pamit tidak diperlukan karena tidak ada penetapan pembimbing aktif.", 409, "PAMIT_NOT_REQUIRED");
    }
    if (eligibility.pamit) return eligibility.pamit;
    const source = eligibility.source_registration;
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
      status: "pending", status_dospem: "pending", status_dpa: "pending",
      submitted_at: new Date(), idempotency_key: idempotencyKey || null,
      metadata: { reviewer_p2_id: eligibility.reviewer_p2?.id || null },
    }, { transaction });
    await appendHistory(pamit, null, "pending", "submitted", "mahasiswa", mahasiswaId, reason, transaction);
    await createSystemNotification({
      recipientType: "dosen", recipientId: eligibility.reviewer_p1.id,
      type: NOTIFICATION_TYPES.CHANGE_PAMIT_REQUESTED_LECTURER,
      message: `Mahasiswa mengajukan pamit untuk ${eligibility.change_type} dari ${eligibility.source_track} ke ${eligibility.target_track}.`,
      referenceType: "pamit_penjaluran", referenceId: pamit.id, actionKey: "review_change_pamit",
      metadata: { mahasiswa_id: mahasiswaId }, deduplicationKey: `change-pamit:${pamit.id}:reviewer`, transaction,
    });
      return plain(pamit);
    });
  } catch (error) {
    if (error?.name !== "SequelizeUniqueConstraintError") throw error;
    const repeated = await PamitUlang.findOne({
      where: idempotencyKey
        ? { mahasiswa_id: mahasiswaId, idempotency_key: idempotencyKey }
        : { mahasiswa_id: mahasiswaId, status: { [Op.in]: ["pending", "approved"] } },
      order: [["createdAt", "DESC"]],
    });
    if (repeated) return plain(repeated);
    throw error;
  }
}

async function decidePamit({ pamitId, dosenId, decision, note }) {
  return sequelize.transaction(async (transaction) => {
    const pamit = await PamitUlang.findByPk(pamitId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!pamit) throw new PenjaluranChangeError("Pamit tidak ditemukan.", 404, "PAMIT_NOT_FOUND");
    if (Number(pamit.reviewer_p1_id) !== Number(dosenId)) {
      throw new PenjaluranChangeError("Keputusan hanya dapat diberikan oleh Pembimbing 1 yang terkunci saat pamit dibuat.", 403, "NOT_LOCKED_REVIEWER");
    }
    const targetPeriod = pamit.periode_tujuan_id
      ? await PeriodePenjaluran.findByPk(pamit.periode_tujuan_id, { transaction })
      : null;
    if (!targetPeriod || !evaluatePeriodeWindow(targetPeriod).is_open) {
      const from = pamit.status;
      if (["pending", "approved"].includes(from)) {
        await pamit.update({ status: "cancelled", cancellation_reason: "Periode tujuan sudah ditutup." }, { transaction });
        await appendHistory(pamit, from, "cancelled", "period_expired", "system", null, "Periode tujuan sudah ditutup.", transaction);
      }
      return plain(pamit);
    }
    if (!["approved", "rejected"].includes(decision)) {
      throw new PenjaluranChangeError("Keputusan harus approved atau rejected.", 400, "INVALID_DECISION");
    }
    if (pamit.status !== "pending") {
      if (pamit.status === decision) return plain(pamit);
      throw new PenjaluranChangeError(`Pamit sudah berstatus ${pamit.status}.`, 409, "PAMIT_ALREADY_DECIDED");
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
          [Op.or]: [
            { status_permohonan: "pending" },
            { status_permohonan: { [Op.in]: ["approved", "rescheduled"] }, permintaan_tanggal: { [Op.gte]: now } },
          ],
        }, transaction,
      });
      await endActiveSupervisorAssignment({
        mahasiswaId: pamit.mahasiswa_id, tanggalSelesai: now,
        alasanBerakhir: `Pamit ${pamit.jenis_perubahan} jalur disetujui.`, transaction,
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
    return plain(pamit);
  });
}

async function createChangeRegistration({ mahasiswaId, targetTrack, reason, pamitId = null }) {
  return sequelize.transaction(async (transaction) => {
    const mahasiswa = await Mahasiswa.findByPk(mahasiswaId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!mahasiswa) throw new PenjaluranChangeError("Mahasiswa tidak ditemukan.", 404, "STUDENT_NOT_FOUND");
    const eligibility = await getEligibility(mahasiswaId, { targetTrack, transaction });
    if (!eligibility.eligible) throw new PenjaluranChangeError(eligibility.blockers.join(" "), 409, "CHANGE_NOT_ELIGIBLE", eligibility);
    let pamit = null;
    if (eligibility.requires_pamit) {
      pamit = await PamitUlang.findByPk(pamitId || eligibility.pamit?.id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!pamit || pamit.status !== "approved" || Number(pamit.periode_tujuan_id) !== Number(eligibility.periode.id)
        || Number(pamit.pendaftaran_lama_id) !== Number(eligibility.source_registration.id)
        || pamit.jalur_tujuan !== eligibility.target_track) {
        throw new PenjaluranChangeError("Pamit approved tidak cocok dengan sumber, tujuan, dan periode pendaftaran.", 409, "PAMIT_MISMATCH");
      }
    }
    const source = eligibility.source_registration;
    const registration = await PendaftaranPenjaluran.create({
      mahasiswa_id: mahasiswaId, periode_penjaluran_id: eligibility.periode.id,
      pendaftaran_asal_id: source.id, jalur: eligibility.change_type,
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
    return { registration: plain(registration), pamit: plain(pamit), eligibility };
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

module.exports = {
  ACTIVE_TRACKS, PenjaluranChangeError, resolveLatestApprovedRegistration, getEligibility,
  submitPamit, decidePamit, createChangeRegistration, getPamitDetail, getChangeHistory,
};
