const { Op } = require("sequelize");
const {
  Dosen,
  Mahasiswa,
  Topik,
  Pengajuan,
  BimbinganSkripsi,
  KlasterKetuaPeriode,
  PeriodePenjaluran,
  JadwalSidangPenguji,
  DosenKetersediaanPeriode,
  RiwayatPersetujuan,
  IzinLanjutSkripsi,
  DokumenSidang,
  MasterPenanggungJawabPenjaluran,
} = require("../models");

const DOSEN_STATUSES = ["active", "inactive", "study_leave", "retired"];
const ACTIVE_DOSEN_WHERE = { status_keaktifan: "active" };

function isDosenAcademicallyActive(dosen) {
  return String(dosen?.status_keaktifan || "active") === "active";
}

function assertDosenCanReceiveNewAssignment(dosen, activityLabel = "penugasan baru") {
  if (!dosen) return { allowed: false, message: "Data dosen tidak ditemukan." };
  if (!isDosenAcademicallyActive(dosen)) {
    return {
      allowed: false,
      message: `${dosen.nama || "Dosen"} berstatus ${dosen.status_keaktifan} dan tidak dapat menerima ${activityLabel}.`,
    };
  }
  return { allowed: true };
}

function canContinueExistingSupervision(dosen) {
  if (!dosen) return false;
  const status = String(dosen.status_keaktifan || "active");
  if (status === "active") return true;
  if (status === "retired") return false;
  if (["inactive", "study_leave"].includes(status)) {
    return dosen.continue_existing_supervision === true;
  }
  return false;
}

function assertDosenCanContinueExistingSupervision(dosen, activityLabel = "memproses bimbingan lama") {
  if (canContinueExistingSupervision(dosen)) return { allowed: true };
  return {
    allowed: false,
    message: `${dosen?.nama || "Dosen"} tidak diizinkan ${activityLabel} pada status ${dosen?.status_keaktifan || "tidak diketahui"}. Tindak lanjut harus diselesaikan oleh Sekprodi.`,
  };
}

async function getExistingSupervisionPermission(dosenId, transaction = null) {
  const dosen = await Dosen.findByPk(dosenId, {
    attributes: ["id", "nama", "status_keaktifan", "continue_existing_supervision"],
    transaction,
  });
  return { dosen, ...assertDosenCanContinueExistingSupervision(dosen) };
}

async function validateDosenForNewAssignment(dosenId, periodeId, options = {}) {
  const transaction = options.transaction || null;
  const availabilityField = options.availabilityField || "tersedia_membimbing";
  const activityLabel = options.activityLabel || "penugasan baru";
  const checkQuota = options.checkQuota !== false;
  const dosen = await Dosen.findByPk(dosenId, { transaction });
  const eligibility = assertDosenCanReceiveNewAssignment(dosen, activityLabel);
  if (!eligibility.allowed) return { ...eligibility, dosen };

  const availability = periodeId ? await getAvailability(dosenId, periodeId, transaction) : null;
  if (availability && availability[availabilityField] === false) {
    return {
      allowed: false,
      dosen,
      availability,
      message: `${dosen.nama} tidak tersedia untuk ${activityLabel} pada periode yang dipilih.`,
    };
  }

  let capacity = null;
  if (checkQuota) {
    const requiredSlots = Math.max(1, Number(options.requiredSlots || 1));
    const activeSupervisionCount = await Mahasiswa.count({
      where: {
        dosen_pembimbing_skripsi_id: dosenId,
        [Op.or]: [
          { status_jalur_saat_ini: { [Op.ne]: "selesai" } },
          { status_jalur_saat_ini: null },
        ],
      },
      transaction,
    });
    const total = Number(availability?.kuota_bimbingan_periode ?? dosen.kuota_bimbingan ?? 0);
    capacity = {
      total,
      terpakai: Number(activeSupervisionCount || 0),
      sisa: Math.max(total - Number(activeSupervisionCount || 0), 0),
      is_penuh: total <= Number(activeSupervisionCount || 0),
    };
    if (capacity.is_penuh || capacity.sisa < requiredSlots) {
      return {
        allowed: false,
        dosen,
        availability,
        capacity,
        message: capacity.sisa < requiredSlots
          ? `Kapasitas ${dosen.nama} tersisa ${capacity.sisa}, sedangkan penugasan membutuhkan ${requiredSlots} slot.`
          : `Kapasitas bimbingan aktif ${dosen.nama} sudah penuh (${capacity.terpakai}/${capacity.total}).`,
      };
    }
  }

  return { allowed: true, dosen, availability, capacity };
}

async function getAvailability(dosenId, periodeId, transaction = null) {
  if (!periodeId) return null;
  return DosenKetersediaanPeriode.findOne({
    where: { dosen_id: dosenId, periode_penjaluran_id: periodeId },
    transaction,
  });
}

async function analyzeDosenStatusImpact(dosenId, transaction = null) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const activeStudentWhere = {
    dosen_pembimbing_skripsi_id: dosenId,
    [Op.or]: [
      { status_jalur_saat_ini: { [Op.ne]: "selesai" } },
      { status_jalur_saat_ini: null },
    ],
  };

  const [
    students, topics, pendingSubmissions, pendingGuidance, clusterDuties, futureSchedules,
    parallelReviews, prospectiveReviews, extendRequests, pendingDocuments,
    periodRoles, masterRoles,
  ] = await Promise.all([
    Mahasiswa.findAll({
      where: activeStudentWhere,
      attributes: ["id", "nim", "nama", "status_jalur_saat_ini"],
      transaction,
      order: [["nama", "ASC"]],
    }),
    Topik.findAll({
      where: { dosen_id: dosenId, status: { [Op.in]: ["available", "reserved", "unavailable"] } },
      attributes: ["id", "kode", "judul", "status"],
      transaction,
      order: [["kode", "ASC"]],
    }),
    Pengajuan.count({
      where: { dosen_saat_ini: dosenId, status: "pending" },
      transaction,
    }),
    BimbinganSkripsi.count({
      where: {
        dosen_id: dosenId,
        [Op.or]: [
          { status_permohonan: "pending" },
          { status_resume: { [Op.in]: ["submitted", "revisi"] } },
        ],
      },
      transaction,
    }),
    KlasterKetuaPeriode.count({
      where: { dosen_id: dosenId },
      include: [{
        model: PeriodePenjaluran,
        as: "periode",
        where: { status: { [Op.in]: ["draft", "active"] } },
        required: true,
        attributes: [],
      }],
      transaction,
    }),
    JadwalSidangPenguji.count({
      where: {
        tanggal_sidang: { [Op.gte]: today },
        assignment_status: { [Op.in]: ["assigned", "finalized"] },
        [Op.or]: [
          { dosen_pembimbing_id: dosenId },
          { penguji1_dosen_id: dosenId },
          { penguji2_dosen_id: dosenId },
        ],
      },
      transaction,
    }),
    RiwayatPersetujuan.count({
      where: { dosen_id: dosenId, status: "pending" },
      transaction,
    }),
    Pengajuan.count({
      where: {
        prospective_supervisor_id: dosenId,
        status: { [Op.in]: ["pending", "menunggu_approval_sekprodi"] },
      },
      transaction,
    }),
    IzinLanjutSkripsi.count({
      where: { dosen_pembimbing_skripsi_id: dosenId, status: "pending" },
      transaction,
    }),
    DokumenSidang.count({
      where: {
        [Op.or]: [
          { transkrip_status: "submitted" },
          { cept_status: "submitted" },
          { draft_skripsi_status: "submitted" },
        ],
      },
      include: [{
        model: Mahasiswa,
        as: "mahasiswa",
        where: { dosen_pembimbing_skripsi_id: dosenId },
        attributes: [],
        required: true,
      }],
      transaction,
    }),
    PeriodePenjaluran.count({
      where: {
        status: { [Op.in]: ["draft", "active"] },
        [Op.or]: [
          { ketua_penelitian_dosen_id: dosenId },
          { pengawas_magang_dosen_id: dosenId },
          { pengawas_pengabdian_dosen_id: dosenId },
          { pengawas_perintisan_bisnis_dosen_id: dosenId },
        ],
      },
      transaction,
    }),
    MasterPenanggungJawabPenjaluran.count({
      where: {
        [Op.or]: [
          { ketua_itsc_dosen_id: dosenId },
          { ketua_sirkel_dosen_id: dosenId },
          { ketua_siber_dosen_id: dosenId },
          { ketua_mvk_dosen_id: dosenId },
          { pengawas_magang_dosen_id: dosenId },
          { pengawas_pengabdian_dosen_id: dosenId },
          { pengawas_perintisan_bisnis_dosen_id: dosenId },
        ],
      },
      transaction,
    }),
  ]);

  return {
    mahasiswa_bimbingan_aktif: students.length,
    mahasiswa: students.map((item) => item.toJSON()),
    topik_tersedia: topics.filter((item) => item.status === "available").length,
    topik_reserved: topics.filter((item) => item.status === "reserved").length,
    topik_unavailable: topics.filter((item) => item.status === "unavailable").length,
    topik: topics.map((item) => item.toJSON()),
    review_pending: Number(pendingSubmissions || 0) + Number(pendingGuidance || 0)
      + Number(parallelReviews || 0) + Number(prospectiveReviews || 0)
      + Number(extendRequests || 0) + Number(pendingDocuments || 0),
    review_paralel_pending: Number(parallelReviews || 0),
    calon_pembimbing_mandiri_pending: Number(prospectiveReviews || 0),
    permohonan_extend_pending: Number(extendRequests || 0),
    dokumen_sidang_pending: Number(pendingDocuments || 0),
    tugas_ketua_cluster_aktif: Number(clusterDuties || 0),
    tugas_periode_aktif: Number(periodRoles || 0),
    tugas_master_penanggung_jawab: Number(masterRoles || 0),
    jadwal_sidang_mendatang: Number(futureSchedules || 0),
  };
}

module.exports = {
  DOSEN_STATUSES,
  ACTIVE_DOSEN_WHERE,
  isDosenAcademicallyActive,
  assertDosenCanReceiveNewAssignment,
  canContinueExistingSupervision,
  assertDosenCanContinueExistingSupervision,
  getExistingSupervisionPermission,
  validateDosenForNewAssignment,
  getAvailability,
  analyzeDosenStatusImpact,
};
