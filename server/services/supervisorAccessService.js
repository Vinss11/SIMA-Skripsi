"use strict";

const { Op } = require("sequelize");
const {
  Mahasiswa,
  PendaftaranPenjaluran,
  PenetapanPembimbing,
  PenetapanPembimbingDosen,
} = require("../models");

const EMPTY_TRACK_COUNTS = Object.freeze({
  penelitian: 0,
  magang: 0,
  perintisan_bisnis: 0,
  pengabdian_masyarakat: 0,
  lainnya: 0,
});

function normalizeSupervisionTrack(value) {
  const normalized = String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (["penelitian", "skripsi", "tugas_akhir"].includes(normalized)) return "penelitian";
  if (["magang", "internship"].includes(normalized)) return "magang";
  if (["perintisan_bisnis", "perintisan", "bisnis"].includes(normalized)) return "perintisan_bisnis";
  if (["pengabdian", "pengabdian_masyarakat"].includes(normalized)) return "pengabdian_masyarakat";
  return "lainnya";
}

function resolveTrackFromRegistration(pendaftaran) {
  if (!pendaftaran) return null;
  const raw = pendaftaran.jalur === "alih"
    ? pendaftaran.penjaluran_baru
    : pendaftaran.jenis_jalur_diambil || pendaftaran.penjaluran_baru;
  return raw ? normalizeSupervisionTrack(raw) : null;
}

async function getActiveSupervisedMahasiswaIds(dosenId, transaction = null) {
  const memberships = await PenetapanPembimbingDosen.findAll({
    where: { dosen_id: Number(dosenId) },
    attributes: [],
    include: [{
      model: PenetapanPembimbing,
      as: "penetapan",
      where: { status: "active" },
      attributes: ["mahasiswa_id"],
      required: true,
    }],
    transaction,
  });
  return [...new Set(memberships.map((item) => Number(item.penetapan?.mahasiswa_id)).filter(Boolean))];
}

async function getSupervisedMahasiswaIdsWithLegacyFallback(dosenId, transaction = null) {
  const historyIds = await getActiveSupervisedMahasiswaIds(dosenId, transaction);
  const activeHistoryRows = await PenetapanPembimbing.findAll({
    where: { status: "active" },
    attributes: ["mahasiswa_id"],
    raw: true,
    transaction,
  });
  const allHistoryIds = activeHistoryRows.map((item) => Number(item.mahasiswa_id)).filter(Boolean);
  const legacyWhere = { dosen_pembimbing_skripsi_id: Number(dosenId) };
  if (allHistoryIds.length > 0) legacyWhere.id = { [Op.notIn]: allHistoryIds };
  const legacyRows = await Mahasiswa.findAll({ attributes: ["id"], where: legacyWhere, raw: true, transaction });
  return [...new Set([...historyIds, ...legacyRows.map((item) => Number(item.id)).filter(Boolean)])];
}

async function isActiveSupervisor(dosenId, mahasiswaId, transaction = null) {
  const ids = await getSupervisedMahasiswaIdsWithLegacyFallback(dosenId, transaction);
  return ids.includes(Number(mahasiswaId));
}

async function countActiveSupervisions(dosenId, transaction = null, excludeMahasiswaId = null) {
  const load = await getActiveSupervisionLoad(dosenId, transaction, excludeMahasiswaId);
  return load.total;
}

async function getActiveSupervisionLoad(dosenId, transaction = null, excludeMahasiswaId = null) {
  const normalizedDosenId = Number(dosenId);
  const memberships = await PenetapanPembimbingDosen.findAll({
    where: { dosen_id: normalizedDosenId },
    attributes: [],
    include: [{
      model: PenetapanPembimbing,
      as: "penetapan",
      where: {
        [Op.or]: [
          { status: "active" },
          { status: "draft", sumber_data: "pergantian" },
        ],
      },
      attributes: ["mahasiswa_id", "pendaftaran_penjaluran_id", "status", "sumber_data"],
      required: true,
      include: [{
        model: PendaftaranPenjaluran,
        as: "pendaftaran",
        attributes: ["jalur", "jenis_jalur_diambil", "penjaluran_baru"],
        required: false,
      }],
    }],
    transaction,
  });

  const trackByMahasiswaId = new Map();
  const replacementReservationIds = new Set();
  for (const membership of memberships) {
    const mahasiswaId = Number(membership.penetapan?.mahasiswa_id);
    if (!mahasiswaId) continue;
    if (membership.penetapan?.status === "draft" && membership.penetapan?.sumber_data === "pergantian") {
      replacementReservationIds.add(mahasiswaId);
    }
    trackByMahasiswaId.set(
      mahasiswaId,
      resolveTrackFromRegistration(membership.penetapan?.pendaftaran) || "lainnya"
    );
  }

  const activeHistoryRows = await PenetapanPembimbing.findAll({
    where: { status: "active" },
    attributes: ["mahasiswa_id"],
    raw: true,
    transaction,
  });
  const allHistoryIds = activeHistoryRows.map((item) => Number(item.mahasiswa_id)).filter(Boolean);
  const legacyWhere = { dosen_pembimbing_skripsi_id: normalizedDosenId };
  if (allHistoryIds.length > 0) legacyWhere.id = { [Op.notIn]: allHistoryIds };
  const legacyRows = await Mahasiswa.findAll({
    attributes: ["id", "status_jalur_saat_ini"],
    where: legacyWhere,
    raw: true,
    transaction,
  });
  for (const mahasiswa of legacyRows) {
    trackByMahasiswaId.set(Number(mahasiswa.id), normalizeSupervisionTrack(mahasiswa.status_jalur_saat_ini));
  }

  let mahasiswaIds = [...trackByMahasiswaId.keys()];
  if (excludeMahasiswaId) {
    mahasiswaIds = mahasiswaIds.filter((id) => id !== Number(excludeMahasiswaId));
  }
  if (mahasiswaIds.length === 0) {
    return {
      total: 0,
      rincian_jalur: { ...EMPTY_TRACK_COUNTS },
      mahasiswa_ids: [],
      reservasi_penggantian: 0,
    };
  }
  const activeStudents = await Mahasiswa.findAll({
    attributes: ["id", "status_jalur_saat_ini"],
    where: {
      id: { [Op.in]: mahasiswaIds },
      [Op.or]: [
        { status_jalur_saat_ini: { [Op.ne]: "selesai" } },
        { status_jalur_saat_ini: null },
      ],
    },
    raw: true,
    transaction,
  });
  const rincianJalur = { ...EMPTY_TRACK_COUNTS };
  for (const mahasiswa of activeStudents) {
    let track = trackByMahasiswaId.get(Number(mahasiswa.id)) || "lainnya";
    if (track === "lainnya") track = normalizeSupervisionTrack(mahasiswa.status_jalur_saat_ini);
    rincianJalur[track] = Number(rincianJalur[track] || 0) + 1;
  }
  return {
    total: activeStudents.length,
    rincian_jalur: rincianJalur,
    mahasiswa_ids: activeStudents.map((item) => Number(item.id)),
    reservasi_penggantian: activeStudents.filter((item) => replacementReservationIds.has(Number(item.id))).length,
  };
}

module.exports = {
  getActiveSupervisedMahasiswaIds,
  getSupervisedMahasiswaIdsWithLegacyFallback,
  isActiveSupervisor,
  countActiveSupervisions,
  getActiveSupervisionLoad,
  normalizeSupervisionTrack,
};
