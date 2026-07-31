"use strict";

const crypto = require("crypto");
const { Op } = require("sequelize");
const {
  sequelize,
  Mahasiswa,
  Dosen,
  IzinLanjutSkripsi,
  PenetapanPembimbing,
  PenetapanPembimbingDosen,
  BimbinganSkripsi,
} = require("../models");
const {
  SemesterAssignmentError,
  resolveNextAcademicPeriod,
  carryForwardSemesterAssignment,
  END_REASON_LABELS,
} = require("./semesterAssignmentService");

function print(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
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
    }],
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
    const existing = await IzinLanjutSkripsi.findOne({
      where: { mahasiswa_id: mahasiswaId, pendaftaran_penjaluran_id: source.pendaftaran_penjaluran_id, semester_penjaluran_ke: 3 },
      transaction: t,
    });
    if (existing) throw new SemesterAssignmentError("Izin semester ketiga pada siklus ini sudah ada.", 409, "EXTENSION_ALREADY_EXISTS");
    const izin = await IzinLanjutSkripsi.create({
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
    }, { transaction: t });
    return { izin, replayed: false };
  };
  return transaction ? run(transaction) : sequelize.transaction(run);
}

async function decideExtensionAndTransitionSemester({ izinId, reviewerDosenId, decision, note, idempotencyKey, transaction = null }) {
  const normalizedDecision = String(decision || "").toLowerCase();
  if (!['approved', 'rejected'].includes(normalizedDecision)) throw new SemesterAssignmentError("Keputusan izin tidak valid.", 400, "EXTENSION_DECISION_INVALID");
  if (normalizedDecision === "rejected" && !String(note || "").trim()) throw new SemesterAssignmentError("Alasan penolakan wajib diisi.", 400, "EXTENSION_REJECTION_REASON_REQUIRED");
  if (!idempotencyKey) throw new SemesterAssignmentError("Idempotency-Key wajib dikirim.", 400, "IDEMPOTENCY_KEY_REQUIRED");
  const run = async (t) => {
    const izin = await IzinLanjutSkripsi.findByPk(izinId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!izin) throw new SemesterAssignmentError("Izin lanjut tidak ditemukan.", 404, "EXTENSION_NOT_FOUND");
    if (izin.status === normalizedDecision) return { izin, assignment: izin.penetapan_hasil_id ? await PenetapanPembimbing.findByPk(izin.penetapan_hasil_id, { transaction: t }) : null, replayed: true };
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
      await izin.update({
        status: "approved",
        keterangan_dosen: String(note || "Disetujui Pembimbing 1.").trim(),
        tanggal_keputusan: decidedAt,
        penetapan_hasil_id: transition.assignment.id,
        decided_by_actor_type: "dosen",
        decided_by_actor_id: reviewerDosenId,
      }, { transaction: t });
      return { izin, assignment: transition.assignment, replayed: false, scheduled: transition.scheduled === true };
    }

    await izin.update({
      status: "rejected",
      keterangan_dosen: String(note).trim(),
      tanggal_keputusan: decidedAt,
      decided_by_actor_type: "dosen",
      decided_by_actor_id: reviewerDosenId,
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
      where: { mahasiswa_id: izin.mahasiswa_id, status_permohonan: "pending", permintaan_tanggal: { [Op.gte]: decidedAt } }, transaction: t,
    });
    return { izin, assignment: null, replayed: false };
  };
  return transaction ? run(transaction) : sequelize.transaction(run);
}

module.exports = { submitExtensionRequest, decideExtensionAndTransitionSemester };
