"use strict";

const { Op } = require("sequelize");
const {
  PendaftaranPenjaluran,
  KelompokPerintisanBisnis,
  AnggotaKelompokPerintisan,
  Mahasiswa,
  Pengajuan,
  RiwayatPersetujuan,
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

function assertRegistrationReadyForFinalization(registration, track) {
  if (resolveRegistrationTrack(registration) !== track) {
    throw new PenjaluranFinalizationError(
      `Jalur pendaftaran tidak sesuai dengan finalisasi ${track}.`,
      409,
      "REGISTRATION_TRACK_MISMATCH"
    );
  }
  if (String(registration.status || "").toLowerCase() !== "approved") {
    throw new PenjaluranFinalizationError(
      "Pendaftaran harus disetujui sebelum keputusan final Sekretaris Prodi.",
      409,
      "REGISTRATION_NOT_APPROVED"
    );
  }
}

async function lockAndValidateDecisionSource({
  registration,
  track,
  decisionSource,
  decisionTopikSlot,
  currentDecisionStatus,
  transaction,
}) {
  const expectedStatus = String(currentDecisionStatus || "").trim().toLowerCase();
  if (track === "penelitian") {
    const sourceId = Number(decisionSource?.id || 0);
    if (!sourceId) {
      throw new PenjaluranFinalizationError(
        "Sumber keputusan Penelitian wajib tersedia.",
        409,
        "DECISION_SOURCE_MISSING"
      );
    }
    const source = await Pengajuan.findByPk(sourceId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!source || Number(source.pendaftaran_penjaluran_id) !== Number(registration.id)) {
      throw new PenjaluranFinalizationError(
        "Sumber keputusan Penelitian tidak sesuai dengan pendaftaran.",
        409,
        "DECISION_SOURCE_MISMATCH"
      );
    }
    const rawStatus = String(source.status || "").trim().toLowerCase();
    if (rawStatus !== expectedStatus) {
      throw new PenjaluranFinalizationError(
        "Status sumber keputusan Penelitian berubah. Muat ulang data sebelum memutuskan.",
        409,
        "DECISION_SOURCE_STALE"
      );
    }
    const targetSlot = Number(decisionTopikSlot || 0);
    let hasProgressiveFinalDecision = false;
    if (rawStatus === "pending" && Number.isInteger(targetSlot) && targetSlot > 0) {
      const [approvedSekprodiCount, approvedClusterCount] = await Promise.all([
        RiwayatPersetujuan.count({
          where: {
            pengajuan_id: source.id,
            tipe_approval: "sekprodi",
            topik_slot: targetSlot,
            status: "approved",
          },
          transaction,
        }),
        RiwayatPersetujuan.count({
          where: {
            pengajuan_id: source.id,
            tipe_approval: "koordinator",
            topik_slot: targetSlot,
            status: "approved",
          },
          transaction,
        }),
      ]);
      hasProgressiveFinalDecision = approvedSekprodiCount > 0 && approvedClusterCount > 0;
    }
    const isReadyForFinalDecision =
      rawStatus === "menunggu_approval_sekprodi" || hasProgressiveFinalDecision;
    if (!["approved", "rejected"].includes(rawStatus) && !isReadyForFinalDecision) {
      throw new PenjaluranFinalizationError(
        "Workflow Penelitian belum menunggu keputusan final Sekretaris Prodi.",
        409,
        "INVALID_WORKFLOW_STAGE"
      );
    }
    return source;
  }

  const rawStatus = String(registration.form_lanjutan_status || "").trim().toLowerCase();
  if (rawStatus !== expectedStatus) {
    throw new PenjaluranFinalizationError(
      "Status sumber keputusan berubah. Muat ulang data sebelum memutuskan.",
      409,
      "DECISION_SOURCE_STALE"
    );
  }
  if (!["review_sekprodi", "approved", "rejected"].includes(rawStatus)) {
    throw new PenjaluranFinalizationError(
      "Workflow belum menunggu keputusan final Sekretaris Prodi.",
      409,
      "INVALID_WORKFLOW_STAGE"
    );
  }
  return registration;
}

function resolveFinalAssignmentMetadata(registration) {
  const registrationType = String(registration?.jalur || "").trim().toLowerCase();
  const startsNewCycle = ["baru", "ulang", "alih"].includes(registrationType);
  return {
    sumberData: startsNewCycle ? "penjaluran" : "pergantian",
    semesterPenjaluranKe: startsNewCycle ? 1 : null,
  };
}

async function resolveAuthoritativeAssignmentTargets({
  registration,
  track,
  transaction,
  validateFinalReadiness = true,
}) {
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

  assertRegistrationReadyForFinalization(lockedSource, track);

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
  if (!["submitted", "approved"].includes(String(group.status || "").toLowerCase())) {
    throw new PenjaluranFinalizationError(
      "Kelompok Perintisan Bisnis belum siap untuk keputusan final.",
      409,
      "GROUP_NOT_READY"
    );
  }
  if (memberships.length !== 3) {
    throw new PenjaluranFinalizationError(
      "Kelompok Perintisan Bisnis wajib terdiri dari tepat tiga anggota.",
      409,
      "INVALID_GROUP_SIZE"
    );
  }
  const mahasiswaIds = memberships.map((item) => Number(item.mahasiswa_id));
  const registrationIds = memberships.map((item) => Number(item.pendaftaran_penjaluran_id));
  if (new Set(mahasiswaIds).size !== memberships.length
    || new Set(registrationIds).size !== memberships.length) {
    throw new PenjaluranFinalizationError(
      "Kelompok memuat mahasiswa atau pendaftaran ganda.",
      409,
      "DUPLICATE_GROUP_MEMBER"
    );
  }
  const leaders = memberships.filter((item) => item.posisi === "ketua");
  const members = memberships.filter((item) => item.posisi === "anggota");
  if (leaders.length !== 1 || members.length !== 2
    || Number(leaders[0]?.mahasiswa_id) !== Number(group.ketua_mahasiswa_id)) {
    throw new PenjaluranFinalizationError(
      "Kelompok wajib memiliki satu ketua dan dua anggota yang konsisten.",
      409,
      "INVALID_GROUP_COMPOSITION"
    );
  }
  const teamRoles = memberships.map((item) => String(item.peran_tim || "").toLowerCase());
  if (new Set(teamRoles).size !== 3
    || !["hustler", "hipster", "hacker"].every((role) => teamRoles.includes(role))) {
    throw new PenjaluranFinalizationError(
      "Kelompok wajib memiliki tepat satu Hustler, Hipster, dan Hacker.",
      409,
      "INVALID_GROUP_ROLES"
    );
  }

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
    assertRegistrationReadyForFinalization(item, track);
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
    const membershipRow = memberships.find((member) => Number(member.pendaftaran_penjaluran_id) === Number(item.id));
    if (String(membershipRow?.jenis_pendaftaran || "") !== String(item.jalur || "")) {
      throw new PenjaluranFinalizationError(
        "Jenis pendaftaran anggota kelompok tidak konsisten.",
        409,
        "GROUP_REGISTRATION_TYPE_MISMATCH"
      );
    }
  }
  const workflowStatuses = new Set(registrations.map((item) => String(item.form_lanjutan_status || "").toLowerCase()));
  if (workflowStatuses.size !== 1 || (validateFinalReadiness
    && !["review_sekprodi", "approved"].includes([...workflowStatuses][0]))) {
    throw new PenjaluranFinalizationError(
      "Workflow seluruh anggota kelompok harus konsisten dan siap difinalisasi.",
      409,
      "GROUP_WORKFLOW_MISMATCH"
    );
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
  decisionSource = null,
  decisionTopikSlot = null,
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
  await lockAndValidateDecisionSource({
    registration: targets.find((item) => Number(item.id) === Number(registration.id)) || targets[0],
    track: normalizedTrack,
    decisionSource,
    decisionTopikSlot,
    currentDecisionStatus,
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
    const assignmentMetadata = resolveFinalAssignmentMetadata(target);
    await replaceSupervisorAssignment({
      mahasiswaId: target.mahasiswa_id,
      pendaftaranPenjaluranId: target.id,
      periodeMulaiId: target.periode_penjaluran_id,
      dosenPembimbingIds: normalizedSupervisorIds,
      sumberData: assignmentMetadata.sumberData,
      semesterPenjaluranKe: assignmentMetadata.semesterPenjaluranKe,
      preserveRequestedSource: true,
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
  resolveFinalAssignmentMetadata,
  resolveAuthoritativeAssignmentTargets,
  finalizePenjaluranDecision,
};
