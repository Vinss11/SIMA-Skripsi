"use strict";

const { Op } = require("sequelize");
const {
  Dosen,
  Mahasiswa,
  PendaftaranPenjaluran,
  KelompokPerintisanBisnis,
  AnggotaKelompokPerintisan,
  sequelize,
} = require("../models");

const TEAM_ROLES = ["hustler", "hipster", "hacker"];
const INVALID_REGISTRATION_STATUSES = new Set(["rejected", "cancelled"]);

class PerintisanGroupError extends Error {
  constructor(message, status = 400, code = "PERINTISAN_GROUP_INVALID") {
    super(message);
    this.name = "PerintisanGroupError";
    this.status = status;
    this.code = code;
  }
}

function selectedTrack(registration) {
  if (!registration) return null;
  if (registration.jalur === "alih") return registration.penjaluran_baru || null;
  return registration.jenis_jalur_diambil || registration.jenis_jalur_ulang || null;
}

function isEligibleRegistration(registration, reference) {
  return (
    registration &&
    Number(registration.periode_penjaluran_id) === Number(reference.periode_penjaluran_id) &&
    registration.program_kuliah === reference.program_kuliah &&
    selectedTrack(registration) === "perintisan_bisnis" &&
    Number(registration.dosen_pembimbing_akademik_id) > 0 &&
    !INVALID_REGISTRATION_STATUSES.has(String(registration.status || "").toLowerCase()) &&
    String(registration.status || "").toLowerCase() === "approved" &&
    ["draft", "pending"].includes(String(registration.form_lanjutan_status || "").toLowerCase())
  );
}

async function getCurrentRegistration(mahasiswaId, periodeId, transaction, lock = false) {
  return PendaftaranPenjaluran.findOne({
    where: { mahasiswa_id: mahasiswaId, periode_penjaluran_id: periodeId },
    order: [["createdAt", "DESC"], ["id", "DESC"]],
    transaction,
    lock: lock ? transaction?.LOCK?.UPDATE : undefined,
  });
}

async function getEligibleCandidates({ mahasiswaId, periodeId }) {
  const current = await getCurrentRegistration(mahasiswaId, periodeId);
  if (!current || selectedTrack(current) !== "perintisan_bisnis") {
    throw new PerintisanGroupError(
      "Pendaftaran Perintisan Bisnis pada periode aktif tidak ditemukan.",
      409,
      "PERINTISAN_REGISTRATION_REQUIRED"
    );
  }

  const ownMembership = await AnggotaKelompokPerintisan.findOne({
    where: { pendaftaran_penjaluran_id: current.id },
  });
  if (ownMembership) return { registration: current, candidates: [], alreadyGrouped: true };

  const rows = await PendaftaranPenjaluran.findAll({
    where: { periode_penjaluran_id: periodeId },
    include: [{
      model: Mahasiswa,
      as: "mahasiswa",
      required: true,
      attributes: ["id", "nim", "nama", "email"],
    }],
    order: [[{ model: Mahasiswa, as: "mahasiswa" }, "nama", "ASC"]],
  });
  const eligibleRows = rows.filter((row) =>
    Number(row.mahasiswa_id) !== Number(mahasiswaId) && isEligibleRegistration(row, current)
  );
  const dpaIds = [...new Set(rows.map((row) => Number(row.dosen_pembimbing_akademik_id)).filter(Boolean))];
  const dpaRows = dpaIds.length
    ? await Dosen.findAll({
        where: { id: { [Op.in]: dpaIds } },
        attributes: ["id", "nik", "kode_dosen", "nama", "gelar"],
      })
    : [];
  const dpaById = new Map(dpaRows.map((dosen) => [Number(dosen.id), dosen]));
  const currentRow = rows.find((row) => Number(row.id) === Number(current.id));
  const formatDpa = (dpaId) => {
    const dpa = dpaById.get(Number(dpaId));
    return dpa ? {
      id: dpa.id,
      nik: dpa.nik,
      kode_dosen: dpa.kode_dosen,
      nama: dpa.nama,
      gelar: dpa.gelar,
    } : null;
  };
  const registrationCountByStudent = rows.reduce((counts, row) => {
    const studentId = Number(row.mahasiswa_id);
    counts.set(studentId, (counts.get(studentId) || 0) + 1);
    return counts;
  }, new Map());
  const memberships = eligibleRows.length
    ? await AnggotaKelompokPerintisan.findAll({
        where: { pendaftaran_penjaluran_id: { [Op.in]: eligibleRows.map((row) => row.id) } },
        attributes: ["pendaftaran_penjaluran_id"],
      })
    : [];
  const groupedIds = new Set(memberships.map((item) => Number(item.pendaftaran_penjaluran_id)));

  return {
    registration: current,
    alreadyGrouped: false,
    leader: {
      pendaftaran_id: current.id,
      mahasiswa_id: current.mahasiswa_id,
      nim: currentRow?.mahasiswa?.nim || "",
      nama: currentRow?.mahasiswa?.nama || "",
      jenis_pendaftaran: current.jalur,
      dpa: formatDpa(current.dosen_pembimbing_akademik_id),
    },
    candidates: eligibleRows
      .filter((row) =>
        registrationCountByStudent.get(Number(row.mahasiswa_id)) === 1 &&
        !groupedIds.has(Number(row.id))
      )
      .map((row) => ({
        pendaftaran_id: row.id,
        mahasiswa_id: row.mahasiswa_id,
        nim: row.mahasiswa?.nim || "",
        nama: row.mahasiswa?.nama || "",
        email: row.mahasiswa?.email || "",
        jenis_pendaftaran: row.jalur,
        program_kuliah: row.program_kuliah,
        dpa: formatDpa(row.dosen_pembimbing_akademik_id),
      })),
  };
}

async function createGroup({ mahasiswaId, periodeId, selfRole, members }) {
  if (!Array.isArray(members) || members.length !== 2) {
    throw new PerintisanGroupError("Ketua wajib memilih tepat dua anggota kelompok.");
  }

  const normalized = members.map((item) => ({
    pendaftaran_id: Number(item?.pendaftaran_id),
    peran_tim: String(item?.peran_tim || "").trim().toLowerCase(),
  }));
  const roles = [String(selfRole || "").trim().toLowerCase(), ...normalized.map((item) => item.peran_tim)];
  if (new Set(roles).size !== 3 || !TEAM_ROLES.every((role) => roles.includes(role))) {
    throw new PerintisanGroupError("Kelompok wajib memiliki tepat satu Hustler, satu Hipster, dan satu Hacker.");
  }
  const requestedIds = normalized.map((item) => item.pendaftaran_id);
  if (requestedIds.some((id) => !Number.isInteger(id) || id <= 0) || new Set(requestedIds).size !== 2) {
    throw new PerintisanGroupError("Dua anggota kelompok harus berbeda dan dipilih dari kandidat yang tersedia.");
  }

  return sequelize.transaction(async (transaction) => {
    const current = await getCurrentRegistration(mahasiswaId, periodeId, transaction, true);
    if (!current || !isEligibleRegistration(current, current)) {
      throw new PerintisanGroupError(
        "Pendaftaran Perintisan Bisnis Anda tidak aktif atau belum dapat membentuk kelompok.",
        409,
        "PERINTISAN_REGISTRATION_NOT_ELIGIBLE"
      );
    }

    const registrations = await PendaftaranPenjaluran.findAll({
      where: { id: { [Op.in]: [current.id, ...requestedIds] } },
      include: [{ model: Mahasiswa, as: "mahasiswa", required: true, attributes: ["id", "nim", "nama", "email"] }],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (registrations.length !== 3) {
      throw new PerintisanGroupError("Salah satu pendaftaran anggota tidak ditemukan.", 409, "GROUP_MEMBER_NOT_FOUND");
    }
    const byId = new Map(registrations.map((row) => [Number(row.id), row]));
    const ordered = [current, ...requestedIds.map((id) => byId.get(id))];
    if (ordered.some((row) => !isEligibleRegistration(row, current))) {
      throw new PerintisanGroupError(
        "Semua anggota harus memiliki pendaftaran Perintisan Bisnis yang aktif pada periode dan program studi yang sama.",
        409,
        "GROUP_MEMBER_NOT_ELIGIBLE"
      );
    }
    if (new Set(ordered.map((row) => Number(row.mahasiswa_id))).size !== 3) {
      throw new PerintisanGroupError("Kelompok harus terdiri dari tiga mahasiswa yang berbeda.");
    }

    const registrationCounts = await PendaftaranPenjaluran.findAll({
      where: {
        mahasiswa_id: { [Op.in]: ordered.map((row) => row.mahasiswa_id) },
        periode_penjaluran_id: periodeId,
      },
      attributes: ["mahasiswa_id"],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    const counts = new Map();
    registrationCounts.forEach((row) => counts.set(Number(row.mahasiswa_id), (counts.get(Number(row.mahasiswa_id)) || 0) + 1));
    if (ordered.some((row) => counts.get(Number(row.mahasiswa_id)) !== 1)) {
      throw new PerintisanGroupError(
        "Salah satu anggota mempunyai lebih dari satu pendaftaran pada periode yang sama.",
        409,
        "DUPLICATE_PERIOD_REGISTRATION"
      );
    }

    const existingMemberships = await AnggotaKelompokPerintisan.findAll({
      where: { pendaftaran_penjaluran_id: { [Op.in]: ordered.map((row) => row.id) } },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (existingMemberships.length) {
      throw new PerintisanGroupError(
        "Salah satu mahasiswa sudah menjadi anggota kelompok lain pada periode ini.",
        409,
        "GROUP_MEMBER_ALREADY_ASSIGNED"
      );
    }

    const group = await KelompokPerintisanBisnis.create({
      periode_penjaluran_id: periodeId,
      ketua_mahasiswa_id: mahasiswaId,
      status: "draft",
    }, { transaction });

    const memberRoles = new Map(normalized.map((item) => [item.pendaftaran_id, item.peran_tim]));
    await AnggotaKelompokPerintisan.bulkCreate(ordered.map((row, index) => ({
      kelompok_id: group.id,
      mahasiswa_id: row.mahasiswa_id,
      pendaftaran_penjaluran_id: row.id,
      posisi: index === 0 ? "ketua" : "anggota",
      peran_tim: index === 0 ? roles[0] : memberRoles.get(Number(row.id)),
      jenis_pendaftaran: row.jalur,
    })), { transaction });

    return { groupId: group.id, registrationId: current.id };
  });
}

async function validateGroupForSubmission({ registrationId, mahasiswaId, transaction }) {
  const membership = await AnggotaKelompokPerintisan.findOne({
    where: { pendaftaran_penjaluran_id: registrationId },
    transaction,
    lock: transaction?.LOCK?.UPDATE,
  });
  if (!membership) throw new PerintisanGroupError("Kelompok Perintisan Bisnis belum dibentuk.", 409, "GROUP_REQUIRED");
  if (membership.posisi !== "ketua" || Number(membership.mahasiswa_id) !== Number(mahasiswaId)) {
    throw new PerintisanGroupError("Form Perintisan Bisnis hanya dapat dikirim oleh ketua kelompok.", 403, "GROUP_LEADER_REQUIRED");
  }
  const group = await KelompokPerintisanBisnis.findByPk(membership.kelompok_id, {
    include: [{
      model: AnggotaKelompokPerintisan,
      as: "anggota",
      required: true,
      include: [{ model: PendaftaranPenjaluran, as: "pendaftaran", required: true }],
    }],
    transaction,
    lock: transaction?.LOCK?.UPDATE,
    subQuery: false,
  });
  const members = group?.anggota || [];
  const roles = members.map((item) => item.peran_tim);
  const leaders = members.filter(
    (item) => String(item.posisi || "").toLowerCase() === "ketua"
  );
  if (members.length !== 3 || new Set(members.map((item) => Number(item.mahasiswa_id))).size !== 3 ||
      new Set(members.map((item) => Number(item.pendaftaran_penjaluran_id))).size !== 3 ||
      leaders.length !== 1 ||
      Number(leaders[0]?.mahasiswa_id) !== Number(group.ketua_mahasiswa_id) ||
      Number(leaders[0]?.pendaftaran_penjaluran_id) !== Number(registrationId) ||
      new Set(roles).size !== 3 || !TEAM_ROLES.every((role) => roles.includes(role))) {
    throw new PerintisanGroupError("Kelompok Perintisan Bisnis belum lengkap atau susunan perannya tidak valid.", 409, "GROUP_INCOMPLETE");
  }
  if (members.some((item) => !isEligibleRegistration(item.pendaftaran, members[0].pendaftaran))) {
    throw new PerintisanGroupError("Salah satu pendaftaran anggota kelompok sudah tidak valid.", 409, "GROUP_MEMBER_NOT_ELIGIBLE");
  }
  return group;
}

module.exports = {
  TEAM_ROLES,
  PerintisanGroupError,
  getEligibleCandidates,
  createGroup,
  validateGroupForSubmission,
};
