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
  PendaftaranPenjaluran,
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

function getJakartaDateOnly() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function buildInitialAvailabilityValues(dosen, periodeId) {
  return {
    dosen_id: dosen.id,
    periode_penjaluran_id: periodeId,
    tersedia_membimbing: false,
    tersedia_menguji: false,
    tersedia_ketua_cluster: false,
    tersedia_pengampu: false,
    tersedia_pengawas_jalur: false,
    tersedia_sidang: false,
    kuota_bimbingan_periode: Number(dosen.kuota_bimbingan || 0),
    alasan_tidak_tersedia: dosen.status_keaktifan === "active" ? null : "Dikunci oleh status master dosen",
    configuration_status: dosen.status_keaktifan === "active" ? "needs_review" : "locked_by_master_status",
    reviewed_at: null,
    reviewed_by_sekretaris_id: null,
    review_note: null,
  };
}

async function initializeAvailabilityForDosen(dosen, transaction = null) {
  const periods = await PeriodePenjaluran.findAll({
    where: { status: { [Op.in]: ["draft", "active"] } },
    attributes: ["id"],
    transaction,
  });
  if (periods.length === 0) return [];
  const existing = await DosenKetersediaanPeriode.findAll({
    where: { dosen_id: dosen.id, periode_penjaluran_id: { [Op.in]: periods.map((item) => item.id) } },
    attributes: ["periode_penjaluran_id"],
    transaction,
  });
  const existingIds = new Set(existing.map((item) => Number(item.periode_penjaluran_id)));
  const values = periods
    .filter((item) => !existingIds.has(Number(item.id)))
    .map((item) => buildInitialAvailabilityValues(dosen, item.id));
  return values.length > 0
    ? DosenKetersediaanPeriode.bulkCreate(values, { transaction, returning: true })
    : [];
}

async function initializeAvailabilityForPeriod(periodeId, transaction = null) {
  const [period, dosens] = await Promise.all([
    PeriodePenjaluran.findByPk(periodeId, { attributes: ["id", "status"], transaction }),
    Dosen.findAll({
      attributes: ["id", "status_keaktifan", "kuota_bimbingan", "createdAt", "status_updated_at"],
      transaction,
    }),
  ]);
  if (!period || period.status === "closed") return [];
  const existing = await DosenKetersediaanPeriode.findAll({
    where: { periode_penjaluran_id: periodeId },
    attributes: ["dosen_id"],
    transaction,
  });
  const existingIds = new Set(existing.map((item) => Number(item.dosen_id)));
  const values = dosens
    .filter((dosen) => !existingIds.has(Number(dosen.id)))
    .map((dosen) => buildInitialAvailabilityValues(dosen, periodeId));
  return values.length > 0
    ? DosenKetersediaanPeriode.bulkCreate(values, { transaction, returning: true })
    : [];
}

async function syncAvailabilityForMasterStatusChange(dosen, transaction = null) {
  const rows = await DosenKetersediaanPeriode.findAll({
    where: { dosen_id: dosen.id },
    include: [{
      model: PeriodePenjaluran,
      as: "periode",
      where: { status: { [Op.in]: ["draft", "active"] } },
      attributes: [],
      required: true,
    }],
    transaction,
  });
  const configurationStatus = dosen.status_keaktifan === "active" ? "needs_review" : "locked_by_master_status";
  for (const row of rows) {
    await row.update({
      configuration_status: configurationStatus,
      reviewed_at: null,
      reviewed_by_sekretaris_id: null,
      review_note: dosen.status_keaktifan === "active"
        ? "Status master kembali aktif dan perlu ditinjau ulang"
        : "Dikunci oleh perubahan status master dosen",
    }, { transaction });
  }
  return rows.length;
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
  if (periodeId && (!availability || availability.configuration_status !== "ready")) {
    return {
      allowed: false,
      dosen,
      availability,
      message: "Ketersediaan dosen belum dikonfirmasi oleh Sekretaris Prodi untuk periode ini.",
    };
  }
  if (periodeId && availability?.[availabilityField] !== true) {
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
    const { countActiveSupervisions } = require("./supervisorAccessService");
    const activeSupervisionCount = await countActiveSupervisions(
      dosenId,
      transaction,
      options.excludeMahasiswaId || null
    );
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

function toEffectiveAvailability(dosen, saved, periodeStatus) {
  const isClosed = periodeStatus === "closed";
  const masterActive = dosen.status_keaktifan === "active";
  const configurationReady = saved?.configuration_status === "ready";
  const effectiveAllowed = masterActive && configurationReady;
  const effective = {};
  for (const field of [
    "tersedia_membimbing", "tersedia_menguji", "tersedia_ketua_cluster",
    "tersedia_pengampu", "tersedia_pengawas_jalur", "tersedia_sidang",
  ]) {
    effective[`efektif_${field.replace("tersedia_", "")}`] = isClosed
      ? Boolean(saved?.[field])
      : Boolean(effectiveAllowed && saved?.[field]);
  }
  return effective;
}

async function copyAvailabilityFromPreviousPeriod(periodeId, sekretarisId, transaction = null) {
  const current = await PeriodePenjaluran.findByPk(periodeId, { transaction });
  if (!current || current.status === "closed") {
    return { copied: 0, needs_review: 0, locked: 0, previous_period: null };
  }
  await initializeAvailabilityForPeriod(periodeId, transaction);
  const previous = await PeriodePenjaluran.findOne({
    where: { id: { [Op.ne]: current.id }, createdAt: { [Op.lt]: current.createdAt } },
    order: [["createdAt", "DESC"]],
    transaction,
  });
  if (!previous) return { copied: 0, needs_review: 0, locked: 0, previous_period: null };

  const [dosens, currentRows, previousRows] = await Promise.all([
    Dosen.findAll({ transaction }),
    DosenKetersediaanPeriode.findAll({ where: { periode_penjaluran_id: current.id }, transaction }),
    DosenKetersediaanPeriode.findAll({ where: { periode_penjaluran_id: previous.id }, transaction }),
  ]);
  const currentByDosen = new Map(currentRows.map((row) => [Number(row.dosen_id), row]));
  const previousByDosen = new Map(previousRows.map((row) => [Number(row.dosen_id), row]));
  const summary = { copied: 0, needs_review: 0, locked: 0, previous_period: previous };
  const now = new Date();
  for (const dosen of dosens) {
    const target = currentByDosen.get(Number(dosen.id));
    if (!target) continue;
    if (dosen.status_keaktifan !== "active") {
      await target.update({
        configuration_status: "locked_by_master_status",
        reviewed_at: null,
        reviewed_by_sekretaris_id: null,
        review_note: "Dikunci oleh status master dosen",
      }, { transaction });
      summary.locked += 1;
      continue;
    }
    const source = previousByDosen.get(Number(dosen.id));
    const comparisonDate = source?.reviewed_at || source?.updatedAt || null;
    const statusChangedAfterReview = Boolean(
      dosen.status_updated_at && comparisonDate
      && new Date(dosen.status_updated_at).getTime() > new Date(comparisonDate).getTime()
    );
    if (!source || source.configuration_status !== "ready" || statusChangedAfterReview) {
      await target.update({ configuration_status: "needs_review", reviewed_at: null, reviewed_by_sekretaris_id: null }, { transaction });
      summary.needs_review += 1;
      continue;
    }
    await target.update({
      tersedia_membimbing: source.tersedia_membimbing,
      tersedia_menguji: source.tersedia_menguji,
      tersedia_ketua_cluster: source.tersedia_ketua_cluster,
      tersedia_pengampu: source.tersedia_pengampu,
      tersedia_pengawas_jalur: source.tersedia_pengawas_jalur,
      tersedia_sidang: source.tersedia_sidang,
      kuota_bimbingan_periode: source.kuota_bimbingan_periode,
      alasan_tidak_tersedia: source.alasan_tidak_tersedia,
      configuration_status: "ready",
      reviewed_at: now,
      reviewed_by_sekretaris_id: sekretarisId || null,
      review_note: `Disalin dari periode ${previous.label_periode}`,
    }, { transaction });
    summary.copied += 1;
  }
  return summary;
}

function getRegistrationSelectedTrack(registration) {
  const raw = registration?.jalur === "alih"
    ? registration?.penjaluran_baru
    : registration?.jenis_jalur_diambil || registration?.penjaluran_baru || registration?.penjaluran_sebelumnya;
  return String(raw || "").trim().toLowerCase().replace(/\s+/g, "_");
}

async function resolveResearchSubmissionRegistration(submission, transaction = null) {
  if (submission?.pendaftaran_penjaluran_id) {
    const linkedPendaftaran = await PendaftaranPenjaluran.findByPk(
      submission.pendaftaran_penjaluran_id,
      {
        attributes: [
          "id", "periode_penjaluran_id", "jalur", "jenis_jalur_diambil",
          "penjaluran_baru", "penjaluran_sebelumnya", "createdAt",
        ],
        transaction,
      }
    );
    if (linkedPendaftaran?.periode_penjaluran_id) return linkedPendaftaran;
  }

  if (!submission?.mahasiswa_id || !submission?.createdAt) return null;
  const historicalRows = await PendaftaranPenjaluran.findAll({
    where: {
      mahasiswa_id: submission.mahasiswa_id,
      createdAt: { [Op.lte]: submission.createdAt },
      status: { [Op.in]: ["approved", "processed", "submitted"] },
    },
    attributes: [
      "id", "periode_penjaluran_id", "jalur", "jenis_jalur_diambil",
      "penjaluran_baru", "penjaluran_sebelumnya", "createdAt",
    ],
    order: [["createdAt", "DESC"]],
    transaction,
  });
  return historicalRows.find((row) => getRegistrationSelectedTrack(row) === "penelitian") || null;
}

async function resolveResearchSubmissionPeriodId(submission, transaction = null) {
  const registration = await resolveResearchSubmissionRegistration(submission, transaction);
  return registration?.periode_penjaluran_id || null;
}

async function validateResearchSubmissionReviewer(submission, dosenId, role, transaction = null) {
  const periodeId = await resolveResearchSubmissionPeriodId(submission, transaction);
  const validation = await validateDosenForNewAssignment(dosenId, periodeId, {
    transaction,
    availabilityField: role === "ketua_cluster" ? "tersedia_ketua_cluster" : "tersedia_membimbing",
    activityLabel: role === "ketua_cluster"
      ? "memproses pengajuan sebagai Ketua Cluster"
      : "memproses pengajuan sebagai calon pembimbing",
    checkQuota: false,
  });
  return { ...validation, periode_id: periodeId, legacy_period_unresolved: !periodeId };
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
  const { getSupervisedMahasiswaIdsWithLegacyFallback } = require("./supervisorAccessService");
  const supervisedMahasiswaIds = await getSupervisedMahasiswaIdsWithLegacyFallback(dosenId, transaction);
  const activeStudentWhere = {
    id: { [Op.in]: supervisedMahasiswaIds },
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
  initializeAvailabilityForDosen,
  initializeAvailabilityForPeriod,
  syncAvailabilityForMasterStatusChange,
  toEffectiveAvailability,
  copyAvailabilityFromPreviousPeriod,
  getJakartaDateOnly,
  resolveResearchSubmissionRegistration,
  resolveResearchSubmissionPeriodId,
  validateResearchSubmissionReviewer,
  getAvailability,
  analyzeDosenStatusImpact,
};
