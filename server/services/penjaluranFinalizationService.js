"use strict";

const { Op } = require("sequelize");
const {
  PendaftaranPenjaluran,
  KelompokPerintisanBisnis,
  AnggotaKelompokPerintisan,
  Mahasiswa,
} = require("../models");
const { validateDosenForNewAssignment } = require("./dosenStatusService");
const {
  getActiveSupervisorAssignment,
  replaceSupervisorAssignment,
} = require("./penetapanPembimbingService");

class PenjaluranFinalizationError extends Error {
  constructor(message, statusCode = 409, code = "PENJALURAN_FINALIZATION_FAILED", detail = null) {
    super(message);
    this.name = "PenjaluranFinalizationError";
    this.statusCode = statusCode;
    this.code = code;
    this.detail = detail;
  }
}

function resolveRegistrationTrack(registration) {
  if (!registration) return null;
  if (registration.jalur === "alih") return registration.penjaluran_baru || null;
  return registration.jenis_jalur_diambil || null;
}

function normalizeSupervisorIds(values) {
  return (Array.isArray(values) ? values : [])
    .map(Number)
    .filter((value) => Number.isInteger(value) && value > 0);
}

function sameIds(left, right) {
  return left.length === right.length && left.every((value, index) => Number(value) === Number(right[index]));
}

async function resolveAuthoritativeAssignmentTargets({ registration, track, transaction }) {
  if (!registration?.id || !transaction) {
    throw new PenjaluranFinalizationError("Pendaftaran dan transaksi finalisasi wajib tersedia.", 500);
  }

  const lockedSource = await PendaftaranPenjaluran.findByPk(registration.id, {
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  if (!lockedSource) {
    throw new PenjaluranFinalizationError("Pendaftaran penjaluran tidak ditemukan.", 404, "REGISTRATION_NOT_FOUND");
  }

  if (track !== "perintisan_bisnis") return [lockedSource];

  const membership = await AnggotaKelompokPerintisan.findOne({
    where: { pendaftaran_penjaluran_id: lockedSource.id },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  if (!membership) {
    throw new PenjaluranFinalizationError(
      "Keanggotaan kelompok Perintisan Bisnis tidak ditemukan.",
      409,
      "AUTHORITATIVE_GROUP_MISSING"
    );
  }

  const group = await KelompokPerintisanBisnis.findByPk(membership.kelompok_id, {
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  if (!group) {
    throw new PenjaluranFinalizationError("Kelompok Perintisan Bisnis tidak ditemukan.", 409, "AUTHORITATIVE_GROUP_MISSING");
  }

  const memberships = await AnggotaKelompokPerintisan.findAll({
    where: { kelompok_id: group.id },
    order: [["id", "ASC"]],
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  if (memberships.length === 0) {
    throw new PenjaluranFinalizationError("Kelompok Perintisan Bisnis tidak memiliki anggota.", 409, "EMPTY_GROUP");
  }

  const registrationIds = memberships.map((item) => Number(item.pendaftaran_penjaluran_id));
  const registrations = await PendaftaranPenjaluran.findAll({
    where: { id: { [Op.in]: registrationIds } },
    order: [["id", "ASC"]],
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  if (registrations.length !== registrationIds.length) {
    throw new PenjaluranFinalizationError(
      "Sebagian pendaftaran anggota kelompok tidak ditemukan.",
      409,
      "INCOMPLETE_GROUP_REGISTRATIONS"
    );
  }

  const membershipByRegistration = new Map(
    memberships.map((item) => [Number(item.pendaftaran_penjaluran_id), Number(item.mahasiswa_id)])
  );
  for (const item of registrations) {
    if (Number(item.periode_penjaluran_id) !== Number(group.periode_penjaluran_id)
      || Number(item.periode_penjaluran_id) !== Number(lockedSource.periode_penjaluran_id)) {
      throw new PenjaluranFinalizationError(
        "Seluruh anggota Perintisan Bisnis wajib berada pada periode yang sama.",
        409,
        "GROUP_PERIOD_MISMATCH"
      );
    }
    if (resolveRegistrationTrack(item) !== "perintisan_bisnis") {
      throw new PenjaluranFinalizationError(
        "Seluruh pendaftaran anggota wajib memilih jalur Perintisan Bisnis.",
        409,
        "GROUP_TRACK_MISMATCH"
      );
    }
    if (membershipByRegistration.get(Number(item.id)) !== Number(item.mahasiswa_id)) {
      throw new PenjaluranFinalizationError(
        "Data mahasiswa pada keanggotaan dan pendaftaran tidak konsisten.",
        409,
        "GROUP_MEMBER_MISMATCH"
      );
    }
  }
  return registrations;
}

async function isIdenticalReplay(targets, supervisorIds, transaction) {
  for (const target of targets) {
    const active = await getActiveSupervisorAssignment(target.mahasiswa_id, transaction);
    const activeIds = (active.penetapan?.pembimbings || [])
      .slice()
      .sort((a, b) => Number(a.urutan) - Number(b.urutan))
      .map((item) => Number(item.dosen_id));
    if (!sameIds(activeIds, supervisorIds)
      || Number(active.penetapan?.pendaftaran_penjaluran_id || 0) !== Number(target.id)) {
      return false;
    }
  }
  return targets.length > 0;
}

async function finalizePenjaluranDecision({
  registration,
  track,
  supervisorIds,
  currentDecisionStatus,
  createdBySekretarisId = null,
  transaction,
}) {
  const normalizedTrack = String(track || "").trim().toLowerCase();
  const normalizedSupervisorIds = normalizeSupervisorIds(supervisorIds);
  if (!["penelitian", "magang", "perintisan_bisnis"].includes(normalizedTrack)) {
    throw new PenjaluranFinalizationError("Jalur tidak aktif untuk finalisasi Tahap 2.", 409, "TRACK_NOT_ACTIVE");
  }
  if (normalizedSupervisorIds.length < 1 || normalizedSupervisorIds.length > 2
    || new Set(normalizedSupervisorIds).size !== normalizedSupervisorIds.length) {
    throw new PenjaluranFinalizationError(
      "Finalisasi wajib memiliki Pembimbing 1 dan maksimal satu Pembimbing 2 yang berbeda.",
      400,
      "INVALID_SUPERVISOR_COMPOSITION"
    );
  }

  const targets = await resolveAuthoritativeAssignmentTargets({
    registration,
    track: normalizedTrack,
    transaction,
  });
  const status = String(currentDecisionStatus || "").trim().toLowerCase();
  if (status === "approved") {
    if (await isIdenticalReplay(targets, normalizedSupervisorIds, transaction)) {
      return { replayed: true, targets, supervisorIds: normalizedSupervisorIds };
    }
    throw new PenjaluranFinalizationError(
      "Keputusan sudah difinalisasi dengan komposisi pembimbing yang berbeda.",
      409,
      "IDEMPOTENCY_CONFLICT"
    );
  }
  if (status === "rejected") {
    throw new PenjaluranFinalizationError(
      "Keputusan yang sudah ditolak tidak dapat difinalisasi ulang sebagai persetujuan.",
      409,
      "IDEMPOTENCY_CONFLICT"
    );
  }

  for (const dosenId of normalizedSupervisorIds) {
    const validation = await validateDosenForNewAssignment(dosenId, registration.periode_penjaluran_id, {
      transaction,
      availabilityField: "tersedia_membimbing",
      activityLabel: "menjadi pembimbing final",
      requiredSlots: targets.length,
    });
    if (!validation.allowed) {
      throw new PenjaluranFinalizationError(validation.message, 409, "SUPERVISOR_NOT_ELIGIBLE", {
        dosen_id: dosenId,
        capacity: validation.capacity || null,
      });
    }
  }

  for (const target of targets) {
    await replaceSupervisorAssignment({
      mahasiswaId: target.mahasiswa_id,
      pendaftaranPenjaluranId: target.id,
      periodeMulaiId: target.periode_penjaluran_id,
      dosenPembimbingIds: normalizedSupervisorIds,
      sumberData: target.jalur === "baru" ? "penjaluran" : "pergantian",
      createdBySekretarisId,
      tanggalMulai: new Date(),
      transaction,
    });
  }

  const targetIds = targets.map((item) => Number(item.id));
  const mahasiswaIds = targets.map((item) => Number(item.mahasiswa_id));
  await PendaftaranPenjaluran.update({
    dosen_pembimbing_ta_id: normalizedSupervisorIds[0],
    dosen_pembimbing_ta_baru_id: normalizedSupervisorIds[0],
  }, { where: { id: { [Op.in]: targetIds } }, transaction });
  await Mahasiswa.update({
    status_jalur_saat_ini: normalizedTrack,
    pengajuan_aktif_id: null,
  }, { where: { id: { [Op.in]: mahasiswaIds } }, transaction });

  return { replayed: false, targets, supervisorIds: normalizedSupervisorIds };
}

module.exports = {
  PenjaluranFinalizationError,
  resolveRegistrationTrack,
  resolveAuthoritativeAssignmentTargets,
  finalizePenjaluranDecision,
};
