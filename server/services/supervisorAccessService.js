"use strict";

const { Op } = require("sequelize");
const {
  Mahasiswa,
  PenetapanPembimbing,
  PenetapanPembimbingDosen,
} = require("../models");

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
  const ids = await getSupervisedMahasiswaIdsWithLegacyFallback(dosenId, transaction);
  const countedIds = excludeMahasiswaId
    ? ids.filter((id) => Number(id) !== Number(excludeMahasiswaId))
    : ids;
  if (countedIds.length === 0) return 0;
  return Mahasiswa.count({
    where: {
      id: { [Op.in]: countedIds },
      [Op.or]: [
        { status_jalur_saat_ini: { [Op.ne]: "selesai" } },
        { status_jalur_saat_ini: null },
      ],
    },
    transaction,
  });
}

module.exports = {
  getActiveSupervisedMahasiswaIds,
  getSupervisedMahasiswaIdsWithLegacyFallback,
  isActiveSupervisor,
  countActiveSupervisions,
};
