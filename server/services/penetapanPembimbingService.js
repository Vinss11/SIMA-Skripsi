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
  SuratTugasPembimbing,
} = require("../models");
const { validateDosenForNewAssignment } = require("./dosenStatusService");

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
  { model: SuratTugasPembimbing, as: "suratTugas", attributes: ["id", "nomor_surat", "tanggal_surat", "status", "file_path"] },
];

function sortAssignmentMembers(penetapan) {
  if (penetapan?.pembimbings) {
    penetapan.pembimbings.sort((left, right) => Number(left.urutan) - Number(right.urutan));
  }
  return penetapan;
}

async function getActiveSupervisorAssignment(mahasiswaId, transaction = null) {
  const penetapan = await PenetapanPembimbing.findOne({
    where: { mahasiswa_id: mahasiswaId, status: "active" },
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

async function resolveSemesterPenjaluranKe(mahasiswaId, pendaftaranId, transaction) {
  if (!pendaftaranId) return null;
  const pendaftaran = await PendaftaranPenjaluran.findByPk(pendaftaranId, {
    attributes: ["id", "mahasiswa_id", "createdAt"],
    transaction,
  });
  if (!pendaftaran || Number(pendaftaran.mahasiswa_id) !== Number(mahasiswaId)) {
    throw new SupervisorAssignmentError("Pendaftaran penjaluran tidak sesuai dengan mahasiswa.", 400);
  }
  return PendaftaranPenjaluran.count({
    where: {
      mahasiswa_id: mahasiswaId,
      createdAt: { [Op.lte]: pendaftaran.createdAt },
    },
    transaction,
  });
}

async function createDraftSupervisorAssignment({
  mahasiswaId,
  pendaftaranPenjaluranId = null,
  periodeMulaiId = null,
  semesterPenjaluranKe = null,
  dosenPembimbingIds,
  sumberData = "penjaluran",
  createdBySekretarisId = null,
  transaction = null,
  skipEligibilityValidation = false,
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
      ? await resolveSemesterPenjaluranKe(normalizedMahasiswaId, pendaftaranPenjaluranId, t)
      : Number(semesterPenjaluranKe);
    const penetapan = await PenetapanPembimbing.create({
      mahasiswa_id: normalizedMahasiswaId,
      pendaftaran_penjaluran_id: pendaftaranPenjaluranId || null,
      periode_mulai_id: periodeMulaiId || null,
      semester_penjaluran_ke: Number.isInteger(resolvedSemester) && resolvedSemester > 0 ? resolvedSemester : null,
      status: "draft",
      sumber_data: sumberData,
      created_by_sekretaris_id: createdBySekretarisId || null,
    }, { transaction: t });
    await PenetapanPembimbingDosen.bulkCreate(dosenIds.map((dosenId, index) => ({
      penetapan_pembimbing_id: penetapan.id,
      dosen_id: dosenId,
      urutan: index + 1,
      peran: index === 0 ? "utama" : "pendamping",
    })), { transaction: t });
    return PenetapanPembimbing.findByPk(penetapan.id, { include: assignmentInclude, transaction: t });
  });
}

async function activateSupervisorAssignment({
  penetapanId,
  tanggalMulai = new Date(),
  suratTugasId = null,
  preserveNullStartDate = false,
  transaction = null,
}) {
  return withTransaction(transaction, async (t) => {
    const penetapan = await PenetapanPembimbing.findByPk(penetapanId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!penetapan) throw new SupervisorAssignmentError("Penetapan pembimbing tidak ditemukan.", 404);
    if (penetapan.status === "active") return getActiveSupervisorAssignment(penetapan.mahasiswa_id, t);
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
    if (oldActive) {
      const replacementDate = startedAt || new Date();
      await oldActive.update({
        status: "ended",
        tanggal_selesai: replacementDate,
        alasan_berakhir: `Digantikan oleh penetapan #${penetapan.id}`,
      }, { transaction: t });
    }
    await penetapan.update({
      status: "active",
      tanggal_mulai: startedAt,
      tanggal_selesai: null,
      alasan_berakhir: null,
      surat_tugas_id: suratTugasId || null,
    }, { transaction: t });
    await mahasiswa.update({ dosen_pembimbing_skripsi_id: primary.dosen_id }, { transaction: t });
    return getActiveSupervisorAssignment(penetapan.mahasiswa_id, t);
  });
}

async function endActiveSupervisorAssignment({
  mahasiswaId,
  tanggalSelesai = new Date(),
  alasanBerakhir,
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
      }, { transaction: t });
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
  suratTugasId = null,
  transaction = null,
}) {
  return withTransaction(transaction, async (t) => {
    const dosenIds = normalizePositiveIds(dosenPembimbingIds);
    assertSupervisorComposition(dosenIds);
    const current = await getActiveSupervisorAssignment(mahasiswaId, t);
    const currentIds = (current.penetapan?.pembimbings || []).map((item) => Number(item.dosen_id));
    const sameComposition = currentIds.length === dosenIds.length
      && currentIds.every((id, index) => id === dosenIds[index]);
    const sameRegistration = Number(current.penetapan?.pendaftaran_penjaluran_id || 0)
      === Number(pendaftaranPenjaluranId || 0);
    if (current.penetapan && sameComposition && sameRegistration) return current;

    const draft = await createDraftSupervisorAssignment({
      mahasiswaId,
      pendaftaranPenjaluranId,
      periodeMulaiId,
      semesterPenjaluranKe,
      dosenPembimbingIds: dosenIds,
      sumberData,
      createdBySekretarisId,
      transaction: t,
    });
    return activateSupervisorAssignment({
      penetapanId: draft.id,
      tanggalMulai,
      suratTugasId,
      transaction: t,
    });
  });
}

function toAssignmentResponse(penetapan) {
  if (!penetapan) return null;
  const plain = typeof penetapan.toJSON === "function" ? penetapan.toJSON() : penetapan;
  const pembimbings = [...(plain.pembimbings || [])].sort((a, b) => Number(a.urutan) - Number(b.urutan));
  return {
    id: plain.id,
    status: plain.status,
    periode: plain.periodeMulai?.label_periode || null,
    periode_mulai: plain.periodeMulai || null,
    semester_penjaluran_ke: plain.semester_penjaluran_ke,
    tanggal_mulai: plain.tanggal_mulai,
    tanggal_selesai: plain.tanggal_selesai,
    alasan_berakhir: plain.alasan_berakhir,
    sumber_data: plain.sumber_data,
    surat_tugas_id: plain.surat_tugas_id,
    surat_tugas: plain.suratTugas || null,
    pendaftaran: plain.pendaftaran || null,
    pembimbings,
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
    history: formatted.filter((item) => item.status !== "active"),
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
};
