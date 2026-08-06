const XLSX = require("xlsx");
const { Op } = require("sequelize");
const {
  PendaftaranPenjaluran,
  Mahasiswa,
  PeriodePenjaluran,
  Dosen,
  DosenKlaster,
  Klaster,
  Pengajuan,
  Topik,
  RiwayatPersetujuan,
  KlasterKetuaPeriode,
  MasterPenanggungJawabPenjaluran,
  SekretarisProdi,
  KelompokPerintisanBisnis,
  AnggotaKelompokPerintisan,
  DosenKetersediaanPeriode,
  PenetapanPembimbing,
  RiwayatKetersediaanMembimbing,
  RiwayatStatusDosen,
  TindakLanjutStatusDosen,
  sequelize,
} = require("../models");
const { fetchMahasiswaMasterData } = require("../services/mahasiswaMasterService");
const { evaluatePeriodeWindow, parseInputDateForJakarta } = require("../services/periodePenjaluranService");
const {
  getActiveSupervisorAssignment,
  createDraftSupervisorAssignment,
  activateSupervisorAssignment,
  replaceSupervisorAssignment,
  toAssignmentResponse,
} = require("../services/penetapanPembimbingService");
const { createSupervisorReplacementNotifications, createSystemNotification } = require("../services/notificationService");
const { NOTIFICATION_TYPES } = require("../constants/notificationTypes");
const { finalizePenjaluranDecision } = require("../services/penjaluranFinalizationService");
const { normalizeWorkflow } = require("../services/penjaluranWorkflowService");
const { cancelPamitsForClosedPeriod } = require("../services/penjaluranChangeService");
const {
  ACTIVE_DOSEN_WHERE,
  canContinueExistingSupervision,
  assertDosenCanReceiveNewAssignment,
  validateDosenForNewAssignment,
  analyzeDosenStatusImpact,
  evaluateDosenStatusFollowUp,
  resolveResearchSubmissionRegistration,
  initializeAvailabilityForPeriod,
  copyAvailabilityFromPreviousPeriod,
  getJakartaDateOnly,
  toEffectiveAvailability,
} = require("../services/dosenStatusService");
const {
  getActiveSupervisionLoad,
  getSupervisedMahasiswaIdsWithLegacyFallback,
  isActiveSupervisor,
} = require("../services/supervisorAccessService");
const { getMahasiswaSupervisionAccess } = require("../services/mahasiswaSupervisionAccessService");
const {
  buildTopikListFromSubmission,
  evaluateTopikParallelState,
  evaluateTopikClusterReviewState,
  evaluateTopikSekprodiReviewState,
  reconcilePendingTopikClusterReviews,
  isTopikParallelSubmission,
} = require("../services/topikParallelReviewService");

const RESEARCH_CLUSTER_CODES = ["ITSC", "SIRKEL", "SIBER", "MVK"];
const RESEARCH_CLUSTER_LABELS = {
  ITSC: "Informatika Teori & Sistem Cerdas",
  SIRKEL: "Sistem Informasi & Rekayasa Perangkat Lunak",
  SIBER: "Sistem Siber",
  MVK: "Multimedia & Visi Komputer",
};
const ACTIVE_PENGAJUAN_STATUSES_FOR_ASSIGNMENT = [
  "pending",
  "menunggu_set_ketua_cluster",
  "menunggu_approval_sekprodi",
];
const ACTIVE_PENDAFTARAN_STATUSES_FOR_ASSIGNMENT = ["submitted", "processed"];
const ACTIVE_FORM_LANJUTAN_STATUSES_FOR_ASSIGNMENT = [
  "submitted",
  "review_dosen_magang",
  "review_sekprodi",
];

function getSekretarisProgramKuliah(req) {
  const program = String(req.user?.program_kuliah || "").trim().toLowerCase();
  return ["reguler", "internasional"].includes(program) ? program : null;
}
const PERIODE_ROLE_FIELD_DEFINITIONS = [
  {
    kode: "ITSC",
    field: "ketua_itsc_dosen_id",
    label: "Ketua cluster ITSC (Informatika Teori & Sistem Cerdas)",
    association: "ketuaItscDosen",
  },
  {
    kode: "SIRKEL",
    field: "ketua_sirkel_dosen_id",
    label: "Ketua cluster SIRKEL (Sistem Informasi & Rekayasa Perangkat Lunak)",
    association: "ketuaSirkelDosen",
  },
  {
    kode: "SIBER",
    field: "ketua_siber_dosen_id",
    label: "Ketua cluster SIBER (Sistem Siber)",
    association: "ketuaSiberDosen",
  },
  {
    kode: "MVK",
    field: "ketua_mvk_dosen_id",
    label: "Ketua cluster MVK (Multimedia & Visi Komputer)",
    association: "ketuaMvkDosen",
  },
  {
    field: "pengawas_magang_dosen_id",
    label: "Dosen pengawas magang",
    association: "pengawasMagangDosen",
  },
  {
    field: "pengawas_pengabdian_dosen_id",
    label: "Dosen pengampu jalur pengabdian masyarakat",
    association: "pengawasPengabdianDosen",
    requiredForRelease: false,
  },
  {
    field: "pengawas_perintisan_bisnis_dosen_id",
    label: "Dosen pengampu jalur perintisan bisnis",
    association: "pengawasPerintisanBisnisDosen",
  },
];
const PERIODE_REQUIRED_ROLE_FIELD_DEFINITIONS = PERIODE_ROLE_FIELD_DEFINITIONS.filter(
  (item) => item.requiredForRelease !== false
);

const MASTER_PENANGGUNG_JAWAB_INCLUDE = PERIODE_ROLE_FIELD_DEFINITIONS.map((item) => ({
  model: Dosen,
  as: item.association,
  attributes: ["id", "kode_dosen", "nik", "nama", "gelar", "email"],
  required: false,
}));

MASTER_PENANGGUNG_JAWAB_INCLUDE.push({
  model: SekretarisProdi,
  as: "updatedBySekretaris",
  attributes: ["id", "nik", "nama", "jabatan"],
  required: false,
});

function parsePositiveId(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function validateKuotaBimbinganValue(value) {
  const rawValue = String(value ?? "").trim();
  if (!/^\d{1,2}$/.test(rawValue)) {
    return {
      isValid: false,
      message: "kuota_bimbingan harus berupa angka bulat 1-99.",
    };
  }

  const kuota = Number(rawValue);
  if (!Number.isInteger(kuota) || kuota < 1 || kuota > 99) {
    return {
      isValid: false,
      message: "kuota_bimbingan harus berupa angka bulat 1-99.",
    };
  }

  return { isValid: true, value: kuota };
}

function buildRolePayloadFromRequest(body = {}) {
  const payload = {};
  for (const item of PERIODE_ROLE_FIELD_DEFINITIONS) {
    payload[item.field] = parsePositiveId(body?.[item.field]);
  }
  return payload;
}

function mergeRolePayloadWithMaster(payload, masterRow) {
  const merged = { ...payload };
  for (const item of PERIODE_ROLE_FIELD_DEFINITIONS) {
    if (!parsePositiveId(merged[item.field])) {
      merged[item.field] = parsePositiveId(masterRow?.[item.field]);
    }
  }
  return merged;
}

function isRolePayloadDifferent(masterRow, rolePayload = {}) {
  if (!masterRow) return true;
  return PERIODE_ROLE_FIELD_DEFINITIONS.some(
    (item) => parsePositiveId(masterRow?.[item.field]) !== parsePositiveId(rolePayload?.[item.field])
  );
}

function summarizePenanggungJawabAssignmentLock({
  activePeriode = null,
  pendingPengajuanCount = 0,
  pendingPendaftaranCount = 0,
} = {}) {
  const reasons = [];
  if (activePeriode) {
    reasons.push(`periode aktif ${activePeriode.label_periode || activePeriode.tahun_akademik || ""}`.trim());
  }
  if (pendingPengajuanCount > 0) {
    reasons.push(`${pendingPengajuanCount} pengajuan topik/judul aktif`);
  }
  if (pendingPendaftaranCount > 0) {
    reasons.push(`${pendingPendaftaranCount} pendaftaran/form penjaluran aktif`);
  }

  return reasons.length > 0
    ? `Penanggung jawab penjaluran belum dapat diubah karena masih ada ${reasons.join(", ")}. Selesaikan atau tutup proses aktif terlebih dahulu.`
    : "Penanggung jawab penjaluran dapat diubah.";
}

async function getPenanggungJawabAssignmentLock(options = {}) {
  const transaction = options.transaction;
  const lock = options.lock;

  await closeExpiredActivePeriodePenjaluran({ transaction });

  const activePeriode = await PeriodePenjaluran.findOne({
    where: {
      [Op.or]: [{ status: "active" }, { is_active: true }],
    },
    attributes: [
      "id",
      "label_periode",
      "tahun_akademik",
      "semester",
      "tanggal_mulai",
      "tanggal_selesai",
      "status",
      "is_active",
    ],
    order: [["updatedAt", "DESC"]],
    transaction,
    ...(lock ? { lock } : {}),
  });

  const [pendingPengajuanCount, pendingPendaftaranCount] = await Promise.all([
    Pengajuan.count({
      where: {
        status: {
          [Op.in]: ACTIVE_PENGAJUAN_STATUSES_FOR_ASSIGNMENT,
        },
      },
      transaction,
    }),
    PendaftaranPenjaluran.count({
      where: {
        [Op.or]: [
          {
            status: {
              [Op.in]: ACTIVE_PENDAFTARAN_STATUSES_FOR_ASSIGNMENT,
            },
          },
          {
            form_lanjutan_status: {
              [Op.in]: ACTIVE_FORM_LANJUTAN_STATUSES_FOR_ASSIGNMENT,
            },
          },
        ],
      },
      transaction,
    }),
  ]);

  const activePeriodeStatus = activePeriode ? getPeriodeStatusLabel(activePeriode) : null;
  const activePeriodePayload = activePeriode && activePeriodeStatus === "active"
    ? {
        id: activePeriode.id,
        label_periode: activePeriode.label_periode || null,
        tahun_akademik: activePeriode.tahun_akademik || null,
        semester: activePeriode.semester || null,
        tanggal_mulai: activePeriode.tanggal_mulai || null,
        tanggal_selesai: activePeriode.tanggal_selesai || null,
        status: activePeriodeStatus,
        is_active: true,
      }
    : null;
  const locked = Boolean(activePeriodePayload) || pendingPengajuanCount > 0 || pendingPendaftaranCount > 0;

  return {
    locked,
    can_edit: !locked,
    active_periode: activePeriodePayload,
    pending_pengajuan_count: pendingPengajuanCount,
    pending_pendaftaran_count: pendingPendaftaranCount,
    message: summarizePenanggungJawabAssignmentLock({
      activePeriode: activePeriodePayload,
      pendingPengajuanCount,
      pendingPendaftaranCount,
    }),
  };
}

function formatDosenMini(dosen) {
  if (!dosen) return null;
  return {
    id: dosen.id,
    kode_dosen: dosen.kode_dosen || null,
    nik: dosen.nik || null,
    nama: dosen.nama || null,
    gelar: dosen.gelar || null,
    email: dosen.email || null,
  };
}

function serializeMasterPenanggungJawab(row) {
  if (!row) return null;
  return {
    id: row.id,
    ketua_itsc_dosen_id: row.ketua_itsc_dosen_id || null,
    ketua_sirkel_dosen_id: row.ketua_sirkel_dosen_id || null,
    ketua_siber_dosen_id: row.ketua_siber_dosen_id || null,
    ketua_mvk_dosen_id: row.ketua_mvk_dosen_id || null,
    pengawas_magang_dosen_id: row.pengawas_magang_dosen_id || null,
    pengampu_pengabdian_dosen_id: row.pengawas_pengabdian_dosen_id || null,
    pengampu_perintisan_bisnis_dosen_id: row.pengawas_perintisan_bisnis_dosen_id || null,
    // Alias lama dipertahankan sementara untuk kompatibilitas klien lama.
    pengawas_pengabdian_dosen_id: row.pengawas_pengabdian_dosen_id || null,
    pengawas_perintisan_bisnis_dosen_id: row.pengawas_perintisan_bisnis_dosen_id || null,
    ketua_itsc_dosen: formatDosenMini(row.ketuaItscDosen),
    ketua_sirkel_dosen: formatDosenMini(row.ketuaSirkelDosen),
    ketua_siber_dosen: formatDosenMini(row.ketuaSiberDosen),
    ketua_mvk_dosen: formatDosenMini(row.ketuaMvkDosen),
    pengawas_magang_dosen: formatDosenMini(row.pengawasMagangDosen),
    pengampu_pengabdian_dosen: formatDosenMini(row.pengawasPengabdianDosen),
    pengampu_perintisan_bisnis_dosen: formatDosenMini(row.pengawasPerintisanBisnisDosen),
    pengawas_pengabdian_dosen: formatDosenMini(row.pengawasPengabdianDosen),
    pengawas_perintisan_bisnis_dosen: formatDosenMini(row.pengawasPerintisanBisnisDosen),
    updated_by: row.updatedBySekretaris
      ? {
          id: row.updatedBySekretaris.id,
          nik: row.updatedBySekretaris.nik || null,
          nama: row.updatedBySekretaris.nama || null,
          jabatan: row.updatedBySekretaris.jabatan || null,
        }
      : null,
    updatedAt: row.updatedAt,
    createdAt: row.createdAt,
  };
}

async function fetchLatestMasterPenanggungJawab(options = {}) {
  return MasterPenanggungJawabPenjaluran.findOne({
    include: MASTER_PENANGGUNG_JAWAB_INCLUDE,
    order: [["updatedAt", "DESC"]],
    ...options,
  });
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function validateTahunAkademik(value) {
  if (!/^\d{4}\/\d{4}$/.test(value)) return false;
  const [tahunAwal, tahunAkhir] = value.split("/").map((item) => Number(item));
  return Number.isFinite(tahunAwal) && Number.isFinite(tahunAkhir) && tahunAkhir === tahunAwal + 1;
}

function getTahunAkademikValidationMessage(value) {
  const text = normalizeText(value);
  const match = text.match(/^(\d{4})\/(\d{4})$/);
  if (!match) return "Format tahun akademik tidak valid. Gunakan YYYY/YYYY (contoh: 2026/2027).";

  const tahunAwal = Number(match[1]);
  const tahunAkhir = Number(match[2]);
  if (!Number.isFinite(tahunAwal) || !Number.isFinite(tahunAkhir) || tahunAkhir !== tahunAwal + 1) {
    return "Tahun kedua harus satu tahun setelah tahun pertama (contoh: 2026/2027).";
  }

  return "";
}

function formatPeriodeLabel(semester, tahunAkademik) {
  const semesterLabel = semester === "ganjil" ? "Ganjil" : "Genap";
  return `${semesterLabel} ${tahunAkademik}`;
}

function getPeriodeRank(tahunAkademik, semester) {
  if (!validateTahunAkademik(tahunAkademik)) return null;
  const [tahunAwal] = tahunAkademik.split("/").map((item) => Number(item));
  const semesterRank = semester === "ganjil" ? 1 : semester === "genap" ? 2 : null;
  if (!Number.isFinite(tahunAwal) || !semesterRank) return null;
  return tahunAwal * 10 + semesterRank;
}

function getSuggestedNextPeriod(previousPeriod = null) {
  if (previousPeriod && validateTahunAkademik(previousPeriod.tahun_akademik)) {
    if (String(previousPeriod.semester).toLowerCase() === "ganjil") {
      return {
        tahun_akademik: previousPeriod.tahun_akademik,
        semester: "genap",
        label_periode: formatPeriodeLabel("genap", previousPeriod.tahun_akademik),
      };
    }
    const [startYear, endYear] = previousPeriod.tahun_akademik.split("/").map(Number);
    const tahunAkademik = `${startYear + 1}/${endYear + 1}`;
    return { tahun_akademik: tahunAkademik, semester: "ganjil", label_periode: formatPeriodeLabel("ganjil", tahunAkademik) };
  }
  const jakartaParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta", year: "numeric", month: "numeric",
  }).formatToParts(new Date());
  const year = Number(jakartaParts.find((part) => part.type === "year")?.value);
  const month = Number(jakartaParts.find((part) => part.type === "month")?.value);
  const semester = month >= 7 ? "ganjil" : "genap";
  const startYear = month >= 7 ? year : year - 1;
  const tahunAkademik = `${startYear}/${startYear + 1}`;
  return { tahun_akademik: tahunAkademik, semester, label_periode: formatPeriodeLabel(semester, tahunAkademik) };
}

function isPeriodeActive(periode) {
  if (!periode) return false;
  return getPeriodeStatusLabel(periode) === "active";
}

function getPeriodeStatusLabel(periode) {
  if (!periode) return "closed";
  const rawStatus = String(periode.status || "").trim().toLowerCase();
  if (rawStatus === "draft") return "draft";

  const isConfiguredActive = rawStatus === "active" || periode.is_active === true;
  if (!isConfiguredActive) return rawStatus || "closed";

  const windowCheck = evaluatePeriodeWindow(periode);
  return windowCheck.is_open ? "active" : "closed";
}

async function closeExpiredActivePeriodePenjaluran(options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const expiredPeriods = await PeriodePenjaluran.findAll({
    where: {
      tanggal_selesai: { [Op.lt]: now },
      [Op.or]: [{ status: "active" }, { is_active: true }],
    },
    attributes: ["id"],
    transaction: options.transaction,
  });
  const result = await PeriodePenjaluran.update(
    {
      status: "closed",
      is_active: false,
    },
    {
      where: {
        tanggal_selesai: {
          [Op.lt]: now,
        },
        [Op.or]: [{ status: "active" }, { is_active: true }],
      },
      transaction: options.transaction,
    }
  );
  for (const period of expiredPeriods) {
    await cancelPamitsForClosedPeriod(period.id, options.transaction);
  }
  return result;
}

function getRiwayatApprovalType(item) {
  return String(item?.tipe_approval || "calon_pembimbing").toLowerCase();
}

function getTopikWaitingKetuaKlaster(submission) {
  const topikList = buildTopikListFromSubmission(submission).map((item) => ({
    slot: item.slot,
    kode: item.kode,
  }));
  if (topikList.length === 0) return null;

  if (isTopikParallelSubmission(submission)) {
    const parallelState = evaluateTopikParallelState(submission);
    const clusterState = evaluateTopikClusterReviewState(submission);
    if (clusterState.final_winner?.slot && ["menunggu_approval_sekprodi", "approved"].includes(submission.status)) {
      return topikList.find((item) => item.slot === clusterState.final_winner.slot) || null;
    }
    if (parallelState.approved_topik?.slot) {
      return topikList.find((item) => item.slot === parallelState.approved_topik.slot) || null;
    }
  }

  const rejectedCalonCount = (submission.riwayat || []).filter(
    (item) => item.status === "rejected" && getRiwayatApprovalType(item) === "calon_pembimbing"
  ).length;
  const approvedSlot = Math.min(rejectedCalonCount + 1, topikList.length);
  return topikList.find((item) => item.slot === approvedSlot) || null;
}

function normalizeTopikClusterCode(clusterValue) {
  const value = String(clusterValue || "").trim().toUpperCase();
  if (!value) return null;

  if (value === "SIRKEL") return "SIRKEL";
  if (value === "SIBER") return "SIBER";
  if (value === "ITSC") return "ITSC";
  if (value === "MVK") return "MVK";

  if (value.includes("SISTEM INFORMASI") || value.includes("REKAYASA PERANGKAT LUNAK")) return "SIRKEL";
  if (value.includes("SIBER")) return "SIBER";
  if (
    value.includes("INTELLIGENT") ||
    value.includes("CERDAS") ||
    value.includes("INFORMATIKA TEORI") ||
    value.includes("ITSC")
  ) {
    return "ITSC";
  }
  if (value.includes("MULTIMEDIA") || value.includes("VISI KOMPUTER") || value.includes("MVK")) return "MVK";

  // MEDIS + SAINS DATA sementara disatukan ke ITSC untuk kebutuhan approval ketua klaster penelitian.
  if (value.includes("MEDIS") || value.includes("SAINS DATA") || value.includes("SDATA")) return "ITSC";

  return value;
}

function resolveResearchClusterCode(klasterRow) {
  if (!klasterRow) return null;
  const fromKode = normalizeTopikClusterCode(klasterRow.kode);
  if (fromKode && RESEARCH_CLUSTER_CODES.includes(fromKode)) return fromKode;

  const fromNama = normalizeTopikClusterCode(klasterRow.nama);
  if (fromNama && RESEARCH_CLUSTER_CODES.includes(fromNama)) return fromNama;

  return null;
}

async function resolveSubmissionClusterCode(submission, transaction) {
  if (!submission) return null;

  if (submission.tipe_pengajuan === "topik_dosen") {
    const topikWaiting = getTopikWaitingKetuaKlaster(submission);
    if (!topikWaiting?.kode) return null;
    const topik = await Topik.findOne({
      where: { kode: topikWaiting.kode },
      attributes: ["kode", "cluster"],
      transaction,
    });
    if (!topik) return null;
    const fromCluster = normalizeTopikClusterCode(topik.cluster);
    const fromKode = normalizeTopikClusterCode(String(topik.kode || "").replace(/[0-9].*$/, ""));
    return fromCluster || fromKode || null;
  }

  if (submission.tipe_pengajuan === "judul_mandiri") {
    const explicitCluster = normalizeTopikClusterCode(submission.cluster_mandiri);
    if (explicitCluster && RESEARCH_CLUSTER_CODES.includes(explicitCluster)) return explicitCluster;

    const calonApproved = (submission.riwayat || []).find(
      (item) => item.status === "approved" && getRiwayatApprovalType(item) === "calon_pembimbing"
    );
    const dosenId = Number(submission.prospective_supervisor_id || calonApproved?.dosen_id || 0);
    if (!dosenId) return null;

    const dosenKlaster = await DosenKlaster.findOne({
      where: { dosen_id: dosenId },
      attributes: ["dosen_id", "klaster_id"],
      include: [
        {
          model: Klaster,
          as: "klaster",
          attributes: ["kode"],
          required: true,
        },
      ],
      order: [[{ model: Klaster, as: "klaster" }, "kode", "ASC"]],
      transaction,
    });
    return dosenKlaster?.klaster?.kode || null;
  }

  return null;
}

async function resolveMahasiswaReplacementCluster(mahasiswaId, transaction = null) {
  const submission = await Pengajuan.findOne({
    where: { mahasiswa_id: mahasiswaId },
    include: [{
      model: RiwayatPersetujuan,
      as: "riwayat",
      required: false,
    }],
    order: [["updatedAt", "DESC"], ["id", "DESC"]],
    transaction,
  });
  const code = await resolveSubmissionClusterCode(submission, transaction);
  if (!code || !RESEARCH_CLUSTER_CODES.includes(code)) return null;
  return {
    code,
    label: RESEARCH_CLUSTER_LABELS[code] || code,
  };
}

async function routeWaitingSubmissionsToKetuaCluster({
  klaster,
  ketuaDosenId,
  transaction,
}) {
  const waitingSubmissions = await Pengajuan.findAll({
    where: {
      status: "menunggu_set_ketua_cluster",
      tipe_pengajuan: { [Op.in]: ["topik_dosen", "judul_mandiri"] },
    },
    include: [
      {
        model: RiwayatPersetujuan,
        as: "riwayat",
        attributes: [
          "id",
          "status",
          "tipe_approval",
          "dosen_id",
          "topik_slot",
          "topik_kode",
          "keterangan",
          "tanggal_keputusan",
          "createdAt",
          "updatedAt",
        ],
        required: false,
      },
    ],
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  let routed = 0;
  for (const submission of waitingSubmissions) {
    const clusterCode = await resolveSubmissionClusterCode(submission, transaction);
    if (!clusterCode || clusterCode !== klaster.kode) continue;

    await submission.update(
      {
        dosen_saat_ini: ketuaDosenId,
        status: "pending",
      },
      { transaction }
    );
    routed += 1;
  }

  return routed;
}

function buildFilters(query) {
  const pendaftaranWhere = {};
  const periodeWhere = {};
  const mahasiswaWhere = {};

  if (query.angkatan) {
    mahasiswaWhere.angkatan = String(query.angkatan).trim();
  }

  const tipePendaftaran = String(query.tipe_pendaftaran || query.jalur || "").trim();
  if (tipePendaftaran) {
    pendaftaranWhere.jalur = tipePendaftaran;
  }

  const penjaluran = String(query.penjaluran || "").trim();
  if (penjaluran) {
    pendaftaranWhere[Op.or] = [
      { jenis_jalur_diambil: penjaluran },
      { penjaluran_baru: penjaluran },
      { penjaluran_sebelumnya: penjaluran },
    ];
  }

  if (query.status) {
    pendaftaranWhere.status = query.status;
  }

  if (query.semester_penjaluran) {
    const parsedSemesterPenjaluran = Number(query.semester_penjaluran);
    if (Number.isInteger(parsedSemesterPenjaluran) && parsedSemesterPenjaluran > 0) {
      pendaftaranWhere.semester_mahasiswa = parsedSemesterPenjaluran;
    }
  }

  if (query.periode) {
    periodeWhere.label_periode = String(query.periode).trim();
  }

  if (query.tahun_akademik) {
    periodeWhere.tahun_akademik = query.tahun_akademik;
  }

  if (query.semester) {
    periodeWhere.semester = query.semester;
  }

  const search = (query.search || "").trim();
  if (search) {
    mahasiswaWhere[Op.or] = [{ nim: { [Op.iLike]: `%${search}%` } }, { nama: { [Op.iLike]: `%${search}%` } }, { email: { [Op.iLike]: `%${search}%` } }];
  }

  return { pendaftaranWhere, periodeWhere, mahasiswaWhere };
}

function toCompactRow(item) {
  return {
    id: item.id,
    jalur: item.jalur,
    program_kuliah: item.program_kuliah,
    semester_mahasiswa: item.semester_mahasiswa,
    nomor_whatsapp: item.nomor_whatsapp,
    status: item.status,
    reviewed_at: item.reviewed_at,
    approval_note: item.approval_note,
    jenis_jalur_diambil: item.jenis_jalur_diambil,
    penjaluran_sebelumnya: item.penjaluran_sebelumnya,
    penjaluran_baru: item.penjaluran_baru,
    kelompok_perintisan: item.keanggotaanPerintisanBisnis
      ? {
          kelompok_id: item.keanggotaanPerintisanBisnis.kelompok_id,
          posisi: item.keanggotaanPerintisanBisnis.posisi,
          peran_tim: item.keanggotaanPerintisanBisnis.peran_tim,
          anggota: Array.isArray(item.keanggotaanPerintisanBisnis.kelompok?.anggota)
            ? item.keanggotaanPerintisanBisnis.kelompok.anggota.map((anggota) => ({
                mahasiswa_id: anggota.mahasiswa_id,
                posisi: anggota.posisi,
                peran_tim: anggota.peran_tim,
                jenis_pendaftaran: anggota.jenis_pendaftaran,
                nim: anggota.mahasiswa?.nim || null,
                nama: anggota.mahasiswa?.nama || null,
                dpa: anggota.mahasiswa?.dosenPembimbingAkademik?.nama || null,
                dpa_gelar: anggota.mahasiswa?.dosenPembimbingAkademik?.gelar || null,
              }))
            : [],
        }
      : null,
    createdAt: item.createdAt,
    dosen_pembimbing_akademik: item.dosenPembimbingAkademik
      ? {
          id: item.dosenPembimbingAkademik.id,
          nik: item.dosenPembimbingAkademik.nik,
          nama: item.dosenPembimbingAkademik.nama,
          gelar: item.dosenPembimbingAkademik.gelar || null,
        }
      : null,
    dosen_pembimbing_ta: item.dosenPembimbingTA
      ? {
          id: item.dosenPembimbingTA.id,
          nik: item.dosenPembimbingTA.nik,
          nama: item.dosenPembimbingTA.nama,
          gelar: item.dosenPembimbingTA.gelar || null,
        }
      : null,
    calon_dosen_pembimbing: item.calonDosenPembimbing
      ? {
          id: item.calonDosenPembimbing.id,
          nik: item.calonDosenPembimbing.nik,
          nama: item.calonDosenPembimbing.nama,
          gelar: item.calonDosenPembimbing.gelar || null,
        }
      : null,
    dosen_pembimbing_ta_sebelumnya: item.dosenPembimbingTASebelumnya
      ? {
          id: item.dosenPembimbingTASebelumnya.id,
          nik: item.dosenPembimbingTASebelumnya.nik,
          nama: item.dosenPembimbingTASebelumnya.nama,
          gelar: item.dosenPembimbingTASebelumnya.gelar || null,
        }
      : null,
    dosen_pembimbing_ta_baru: item.dosenPembimbingTABaru
      ? {
          id: item.dosenPembimbingTABaru.id,
          nik: item.dosenPembimbingTABaru.nik,
          nama: item.dosenPembimbingTABaru.nama,
          gelar: item.dosenPembimbingTABaru.gelar || null,
        }
      : null,
    reviewed_by: item.reviewedBySekretaris
      ? {
          id: item.reviewedBySekretaris.id,
          nik: item.reviewedBySekretaris.nik,
          nama: item.reviewedBySekretaris.nama,
        }
      : null,
    mahasiswa: item.mahasiswa
      ? {
          id: item.mahasiswa.id,
          nim: item.mahasiswa.nim,
          nama: item.mahasiswa.nama,
          email: item.mahasiswa.email,
          angkatan: item.mahasiswa.angkatan,
        }
      : null,
    periode: item.periode
      ? {
          id: item.periode.id,
          label_periode: item.periode.label_periode,
          tahun_akademik: item.periode.tahun_akademik,
          semester: item.periode.semester,
        }
      : null,
  };
}

function formatEnumLabel(value) {
  if (!value) return "-";
  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDateTimeForExport(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function buildMahasiswaMasterPeriodeFilterValue(row) {
  const periodeLabel = String(row?.periode_label || "").trim();
  if (periodeLabel) return periodeLabel;

  const tahunAkademik = String(row?.tahun_akademik || "").trim();
  const semesterAkademik = String(row?.semester_akademik || "").trim();
  if (tahunAkademik && semesterAkademik) {
    return `${tahunAkademik} - ${formatEnumLabel(semesterAkademik)}`;
  }
  if (tahunAkademik) return tahunAkademik;
  if (semesterAkademik) return formatEnumLabel(semesterAkademik);
  return "";
}

function flattenMahasiswaMasterRows(mahasiswaRows = []) {
  return (Array.isArray(mahasiswaRows) ? mahasiswaRows : []).flatMap((mahasiswa) => {
    const history = Array.isArray(mahasiswa?.riwayat_penjaluran) ? mahasiswa.riwayat_penjaluran : [];

    if (history.length === 0) {
      return [
        {
          mahasiswa_id: mahasiswa.id,
          pendaftaran_id: null,
          nim: mahasiswa.nim,
          nama: mahasiswa.nama,
          email: mahasiswa.email,
          angkatan: mahasiswa.angkatan,
          program_kuliah: mahasiswa.program_kuliah || null,
          status_jalur_saat_ini: mahasiswa.status_jalur_saat_ini,
          dosen_pembimbing_akademik: mahasiswa.dosenPembimbingAkademik?.nama || "-",
          dosen_pembimbing_skripsi: mahasiswa.dosenPembimbingSkripsi?.nama || "-",
          semester_mahasiswa: null,
          semester_penjaluran_ke: 0,
          semester_penjaluran_aktif: mahasiswa.semester_penjaluran_aktif || 0,
          tahun_akademik: null,
          semester_akademik: null,
          periode_label: null,
          jalur: null,
          nama_penjaluran: null,
          penjaluran_sebelumnya: null,
          penjaluran_baru: null,
          pembimbing_ta: null,
          pembimbing_ta_sebelumnya: null,
          pembimbing_ta_baru: null,
          pendaftaran_status: null,
          tanggal_penjaluran: null,
          updatedAt: mahasiswa.updatedAt,
        },
      ];
    }

    return history.map((item) => ({
      mahasiswa_id: mahasiswa.id,
      pendaftaran_id: item.id,
      nim: mahasiswa.nim,
      nama: mahasiswa.nama,
      email: mahasiswa.email,
      angkatan: mahasiswa.angkatan,
      program_kuliah: item.program_kuliah || mahasiswa.program_kuliah || null,
      status_jalur_saat_ini: mahasiswa.status_jalur_saat_ini,
      dosen_pembimbing_akademik: mahasiswa.dosenPembimbingAkademik?.nama || "-",
      dosen_pembimbing_skripsi: mahasiswa.dosenPembimbingSkripsi?.nama || "-",
      semester_mahasiswa: item.semester_mahasiswa || null,
      semester_penjaluran_ke: item.semester_penjaluran_ke || 0,
      semester_penjaluran_aktif:
        item.semester_penjaluran_aktif ??
        mahasiswa.semester_penjaluran_aktif ??
        item.semester_penjaluran_ke ??
        0,
      tahun_akademik: item.periode_penjaluran?.tahun_akademik || null,
      semester_akademik: item.periode_penjaluran?.semester || null,
      periode_label: item.periode_penjaluran?.label_periode || null,
      jalur: item.jalur || null,
      nama_penjaluran: item.nama_penjaluran || null,
      penjaluran_sebelumnya: item.penjaluran_sebelumnya || null,
      penjaluran_baru: item.penjaluran_baru || null,
      pembimbing_ta: item.pembimbing_ta?.nama || null,
      pembimbing_ta_sebelumnya: item.dosen_pembimbing_ta_sebelumnya?.nama || null,
      pembimbing_ta_baru: item.dosen_pembimbing_ta_baru?.nama || null,
      pendaftaran_status: item.status || null,
      tanggal_penjaluran: item.createdAt || null,
      updatedAt: item.updatedAt || mahasiswa.updatedAt,
    }));
  });
}

function filterMahasiswaMasterRows(rows = [], query = {}) {
  const selectedAngkatan = String(query?.angkatan || "").trim();
  const selectedProgramKuliah = String(query?.program_kuliah || "").trim().toLowerCase();
  const selectedSemesterPenjaluran = String(query?.semester_penjaluran || "").trim();
  const selectedPeriode = String(query?.periode || "").trim();
  const selectedPenjaluran = String(query?.penjaluran || "").trim().toLowerCase();
  const selectedTipePendaftaran = String(query?.tipe_pendaftaran || "").trim().toLowerCase();
  const keyword = String(query?.search || "").trim().toLowerCase();

  return (Array.isArray(rows) ? rows : []).filter((row) => {
    if (selectedAngkatan && String(row?.angkatan || "").trim() !== selectedAngkatan) {
      return false;
    }

    if (selectedProgramKuliah && String(row?.program_kuliah || "").trim().toLowerCase() !== selectedProgramKuliah) {
      return false;
    }

    const semesterPenjaluran = String(
      Number(row?.semester_penjaluran_aktif || row?.semester_penjaluran_ke || 0) || ""
    );
    if (selectedSemesterPenjaluran && semesterPenjaluran !== selectedSemesterPenjaluran) {
      return false;
    }

    const periodeValue = buildMahasiswaMasterPeriodeFilterValue(row);
    if (selectedPeriode && periodeValue !== selectedPeriode) {
      return false;
    }

    if (selectedPenjaluran && String(row?.nama_penjaluran || "").trim().toLowerCase() !== selectedPenjaluran) {
      return false;
    }

    if (selectedTipePendaftaran && String(row?.jalur || "").trim().toLowerCase() !== selectedTipePendaftaran) {
      return false;
    }

    if (!keyword) return true;

    const haystack = [
      row.nim,
      row.nama,
      row.email,
      row.angkatan,
      row.program_kuliah,
      row.program_kuliah ? formatEnumLabel(row.program_kuliah) : null,
      row.status_jalur_saat_ini,
      row.semester_mahasiswa ? `semester mahasiswa ${row.semester_mahasiswa}` : null,
      row.dosen_pembimbing_akademik,
      row.dosen_pembimbing_skripsi,
      row.semester_penjaluran_aktif || row.semester_penjaluran_ke
        ? `semester ${row.semester_penjaluran_aktif || row.semester_penjaluran_ke}`
        : null,
      row.tahun_akademik,
      row.semester_akademik,
      row.periode_label,
      row.jalur,
      row.nama_penjaluran,
      row.penjaluran_sebelumnya,
      row.penjaluran_baru,
      row.pembimbing_ta,
      row.pembimbing_ta_sebelumnya,
      row.pembimbing_ta_baru,
      row.pendaftaran_status,
      `tipe ${formatEnumLabel(row.jalur)}`,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(keyword);
  });
}

// GET /api/sekretaris/mahasiswa/master
exports.getMahasiswaMasterData = async (req, res) => {
  try {
    const data = await fetchMahasiswaMasterData({
      status_jalur: req.query.status_jalur,
      angkatan: req.query.angkatan,
      program_kuliah: getSekretarisProgramKuliah(req),
    });

    return res.json({
      success: true,
      data,
      total: data.length,
      role_owner: "sekretaris_prodi",
      can_edit: true,
    });
  } catch (error) {
    console.error("Error di getMahasiswaMasterData (sekretaris):", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// GET /api/sekretaris/mahasiswa/master/export
exports.exportMahasiswaMasterData = async (req, res) => {
  try {
    const mahasiswaRows = await fetchMahasiswaMasterData({
      status_jalur: req.query.status_jalur,
      angkatan: req.query.angkatan,
      program_kuliah: getSekretarisProgramKuliah(req),
    });

    const flattenedRows = flattenMahasiswaMasterRows(mahasiswaRows);
    const filteredRows = filterMahasiswaMasterRows(flattenedRows, req.query);

    const rows = filteredRows.map((row, index) => ({
      No: index + 1,
      NIM: row.nim || "-",
      Nama: row.nama || "-",
      Email: row.email || "-",
      Angkatan: row.angkatan || "-",
      "Status Jalur Saat Ini": row.status_jalur_saat_ini || "-",
      "Program Kuliah": formatEnumLabel(row.program_kuliah),
      "Semester Mahasiswa": row.semester_mahasiswa || "-",
      "Semester Penjaluran":
        row.semester_penjaluran_aktif || row.semester_penjaluran_ke
          ? `Semester ${row.semester_penjaluran_aktif || row.semester_penjaluran_ke}`
          : "-",
      "Periode Penjaluran": row.periode_label || "-",
      "Tahun Akademik": row.tahun_akademik || "-",
      "Semester Akademik": row.semester_akademik ? formatEnumLabel(row.semester_akademik) : "-",
      Jalur: row.jalur ? formatEnumLabel(row.jalur) : "-",
      "Nama Penjaluran": row.nama_penjaluran ? formatEnumLabel(row.nama_penjaluran) : "-",
      "Penjaluran Sebelumnya": row.penjaluran_sebelumnya ? formatEnumLabel(row.penjaluran_sebelumnya) : "-",
      "Penjaluran Baru": row.penjaluran_baru ? formatEnumLabel(row.penjaluran_baru) : "-",
      "Pembimbing TA": row.pembimbing_ta || "-",
      "Pembimbing TA Sebelumnya": row.pembimbing_ta_sebelumnya || "-",
      "Pembimbing TA Baru": row.pembimbing_ta_baru || "-",
      DPA: row.dosen_pembimbing_akademik || "-",
      "Dospem Skripsi": row.dosen_pembimbing_skripsi || "-",
      "Status Pendaftaran": row.pendaftaran_status ? formatEnumLabel(row.pendaftaran_status) : "-",
      "Tanggal Penjaluran": formatDateTimeForExport(row.tanggal_penjaluran),
      Updated: formatDateTimeForExport(row.updatedAt),
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet["!cols"] = [
      { wch: 6 },
      { wch: 12 },
      { wch: 34 },
      { wch: 34 },
      { wch: 10 },
      { wch: 20 },
      { wch: 18 },
      { wch: 20 },
      { wch: 24 },
      { wch: 16 },
      { wch: 18 },
      { wch: 12 },
      { wch: 24 },
      { wch: 24 },
      { wch: 24 },
      { wch: 28 },
      { wch: 28 },
      { wch: 28 },
      { wch: 28 },
      { wch: 28 },
      { wch: 20 },
      { wch: 22 },
      { wch: 22 },
    ];
    XLSX.utils.book_append_sheet(workbook, worksheet, "Master Data Mahasiswa");

    const buffer = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    });

    const dateStamp = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=export_master_mahasiswa_${dateStamp}.xlsx`);
    return res.send(buffer);
  } catch (error) {
    console.error("Error di exportMahasiswaMasterData:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// GET /api/sekretaris/pendaftaran
exports.getPendaftaranList = async (req, res) => {
  try {
    const { pendaftaranWhere, periodeWhere, mahasiswaWhere } = buildFilters(req.query);
    pendaftaranWhere.program_kuliah = getSekretarisProgramKuliah(req);

    const list = await PendaftaranPenjaluran.findAll({
      where: pendaftaranWhere,
      include: [
        {
          model: Mahasiswa,
          as: "mahasiswa",
          attributes: ["id", "nim", "nama", "email", "angkatan"],
          where: mahasiswaWhere,
          required: true,
        },
        {
          model: PeriodePenjaluran,
          as: "periode",
          attributes: ["id", "tahun_akademik", "semester", "label_periode", "is_active"],
          where: periodeWhere,
          required: true,
        },
        {
          model: Dosen,
          as: "dosenPembimbingAkademik",
          attributes: ["id", "nik", "nama", "gelar"],
          required: false,
        },
        {
          model: Dosen,
          as: "dosenPembimbingTA",
          attributes: ["id", "nik", "nama", "gelar"],
          required: false,
        },
        {
          model: Dosen,
          as: "calonDosenPembimbing",
          attributes: ["id", "nik", "nama", "gelar"],
          required: false,
        },
        {
          model: Dosen,
          as: "dosenPembimbingTASebelumnya",
          attributes: ["id", "nik", "nama", "gelar"],
          required: false,
        },
        {
          model: Dosen,
          as: "dosenPembimbingTABaru",
          attributes: ["id", "nik", "nama", "gelar"],
          required: false,
        },
        {
          model: SekretarisProdi,
          as: "reviewedBySekretaris",
          attributes: ["id", "nik", "nama"],
          required: false,
        },
        {
          model: AnggotaKelompokPerintisan,
          as: "keanggotaanPerintisanBisnis",
          attributes: ["id", "kelompok_id", "posisi", "peran_tim"],
          required: false,
          include: [
            {
              model: KelompokPerintisanBisnis,
              as: "kelompok",
              attributes: ["id", "status"],
              required: false,
              include: [
                {
                  model: AnggotaKelompokPerintisan,
                  as: "anggota",
                  attributes: ["id", "mahasiswa_id", "posisi", "peran_tim", "jenis_pendaftaran"],
                  required: false,
                  include: [
                    {
                      model: Mahasiswa,
                      as: "mahasiswa",
                      attributes: ["id", "nim", "nama"],
                      required: false,
                      include: [
                        {
                          model: Dosen,
                          as: "dosenPembimbingAkademik",
                          attributes: ["id", "nik", "nama"],
                          required: false,
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    const visibleList = list.filter(
      (item) =>
        !item.keanggotaanPerintisanBisnis ||
        item.keanggotaanPerintisanBisnis.posisi === "ketua"
    );

    res.json({
      success: true,
      data: visibleList.map(toCompactRow),
      total: visibleList.length,
    });
  } catch (error) {
    console.error("Error di getPendaftaranList:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// GET /api/sekretaris/pendaftaran/export
exports.exportPendaftaran = async (req, res) => {
  try {
    const { pendaftaranWhere, periodeWhere, mahasiswaWhere } = buildFilters(req.query);
    pendaftaranWhere.program_kuliah = getSekretarisProgramKuliah(req);

    const list = await PendaftaranPenjaluran.findAll({
      where: pendaftaranWhere,
      include: [
        {
          model: Mahasiswa,
          as: "mahasiswa",
          attributes: ["nim", "nama", "email", "angkatan"],
          where: mahasiswaWhere,
          required: true,
        },
        {
          model: PeriodePenjaluran,
          as: "periode",
          attributes: ["label_periode", "tahun_akademik", "semester"],
          where: periodeWhere,
          required: true,
        },
        {
          model: Dosen,
          as: "dosenPembimbingAkademik",
          attributes: ["nama", "gelar", "nik"],
          required: false,
        },
        {
          model: Dosen,
          as: "dosenPembimbingTA",
          attributes: ["nama", "gelar", "nik"],
          required: false,
        },
        {
          model: Dosen,
          as: "calonDosenPembimbing",
          attributes: ["nama", "gelar", "nik"],
          required: false,
        },
        {
          model: Dosen,
          as: "dosenPembimbingTASebelumnya",
          attributes: ["nama", "gelar", "nik"],
          required: false,
        },
        {
          model: Dosen,
          as: "dosenPembimbingTABaru",
          attributes: ["nama", "gelar", "nik"],
          required: false,
        },
        {
          model: SekretarisProdi,
          as: "reviewedBySekretaris",
          attributes: ["nama", "nik"],
          required: false,
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    const rows = list.map((item) => {
      const penjaluran = item.jenis_jalur_diambil || item.penjaluran_baru || item.penjaluran_sebelumnya || "-";

      return {
        "Tanggal Daftar": item.createdAt,
        "Periode Penjaluran": item.periode?.label_periode || "-",
        "Tahun Akademik": item.periode?.tahun_akademik || "-",
        "Semester Akademik": item.periode?.semester || "-",
        Jalur: item.jalur,
        "Program Kuliah": formatEnumLabel(item.program_kuliah),
        Penjaluran: penjaluran,
        "Semester Mahasiswa": item.semester_mahasiswa,
        NIM: item.mahasiswa?.nim || "-",
        Nama: item.mahasiswa?.nama || "-",
        Email: item.mahasiswa?.email || "-",
        Angkatan: item.mahasiswa?.angkatan || "-",
        "Nomor WhatsApp": item.nomor_whatsapp || "-",
        Status: item.status,
        "Jenis Jalur Diambil": item.jenis_jalur_diambil || "-",
        "Penjaluran Sebelumnya": item.penjaluran_sebelumnya || "-",
        "Penjaluran Baru": item.penjaluran_baru || "-",
        "Dosen Pembimbing Akademik": item.dosenPembimbingAkademik?.nama || "-",
        "NIK Dosen Pembimbing Akademik": item.dosenPembimbingAkademik?.nik || "-",
        "Calon Dosen Pembimbing Sementara": item.calonDosenPembimbing?.nama || "-",
        "NIK Calon Dosen Pembimbing Sementara": item.calonDosenPembimbing?.nik || "-",
        "Dosen Pembimbing TA": item.dosenPembimbingTA?.nama || "-",
        "NIK Dosen Pembimbing TA": item.dosenPembimbingTA?.nik || "-",
        "Dosen Pembimbing TA Sebelumnya": item.dosenPembimbingTASebelumnya?.nama || "-",
        "NIK Dosen Pembimbing TA Sebelumnya": item.dosenPembimbingTASebelumnya?.nik || "-",
        "Dosen Pembimbing TA Baru": item.dosenPembimbingTABaru?.nama || "-",
        "NIK Dosen Pembimbing TA Baru": item.dosenPembimbingTABaru?.nik || "-",
        "Direview Oleh": item.reviewedBySekretaris?.nama || "-",
        "NIK Reviewer": item.reviewedBySekretaris?.nik || "-",
        "Tanggal Review": item.reviewed_at || "-",
        "Catatan Approval": item.approval_note || "-",
        Catatan: item.catatan || "-",
      };
    });

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Pendaftaran Penjaluran");

    const buffer = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    });

    const dateStamp = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=export_pendaftaran_penjaluran_${dateStamp}.xlsx`);
    return res.send(buffer);
  } catch (error) {
    console.error("Error di exportPendaftaran:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

async function fetchPendaftaranDetail(id, programKuliah = null) {
  return PendaftaranPenjaluran.findOne({
    where: {
      id,
      ...(programKuliah ? { program_kuliah: programKuliah } : {}),
    },
    include: [
      {
        model: Mahasiswa,
        as: "mahasiswa",
        attributes: ["id", "nim", "nama", "email", "angkatan"],
      },
      {
        model: PeriodePenjaluran,
        as: "periode",
        attributes: ["id", "tahun_akademik", "semester", "label_periode", "is_active"],
      },
      {
        model: Dosen,
        as: "dosenPembimbingAkademik",
        attributes: ["id", "nik", "nama", "gelar", "email"],
      },
      {
        model: Dosen,
        as: "dosenPembimbingTA",
        attributes: ["id", "nik", "nama", "gelar", "email"],
      },
      {
        model: Dosen,
        as: "dosenPembimbingTASebelumnya",
        attributes: ["id", "nik", "nama", "gelar", "email"],
      },
      {
        model: Dosen,
        as: "dosenPembimbingTABaru",
        attributes: ["id", "nik", "nama", "gelar", "email"],
      },
      {
        model: SekretarisProdi,
        as: "reviewedBySekretaris",
        attributes: ["id", "nik", "nama", "email"],
      },
      {
        model: AnggotaKelompokPerintisan,
        as: "keanggotaanPerintisanBisnis",
        attributes: ["id", "kelompok_id", "posisi", "peran_tim"],
        required: false,
        include: [
          {
            model: KelompokPerintisanBisnis,
            as: "kelompok",
            attributes: ["id", "status"],
            required: false,
            include: [
              {
                model: AnggotaKelompokPerintisan,
                as: "anggota",
                attributes: ["id", "mahasiswa_id", "posisi", "peran_tim", "jenis_pendaftaran"],
                required: false,
                include: [
                  {
                    model: Mahasiswa,
                    as: "mahasiswa",
                    attributes: ["id", "nim", "nama"],
                    required: false,
                    include: [
                      {
                        model: Dosen,
                        as: "dosenPembimbingAkademik",
                        attributes: ["id", "nik", "nama"],
                        required: false,
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  });
}

async function getPerintisanRegistrationGroup(pendaftaranId, transaction) {
  return AnggotaKelompokPerintisan.findOne({
    where: { pendaftaran_penjaluran_id: pendaftaranId },
    include: [
      {
        model: KelompokPerintisanBisnis,
        as: "kelompok",
        required: true,
        include: [
          {
            model: AnggotaKelompokPerintisan,
            as: "anggota",
            attributes: ["mahasiswa_id", "pendaftaran_penjaluran_id"],
            required: true,
          },
        ],
      },
    ],
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
}

async function updateRegistrationDecision({
  pendaftaran,
  status,
  reviewerId,
  note,
  transaction,
}) {
  const membership = await getPerintisanRegistrationGroup(pendaftaran.id, transaction);
  const pendaftaranIds = membership?.kelompok?.anggota?.length
    ? membership.kelompok.anggota.map((item) => item.pendaftaran_penjaluran_id)
    : [pendaftaran.id];
  const mahasiswaIds = membership?.kelompok?.anggota?.length
    ? membership.kelompok.anggota.map((item) => item.mahasiswa_id)
    : [pendaftaran.mahasiswa_id];
  const reviewedAt = new Date();

  await PendaftaranPenjaluran.update(
    {
      status,
      reviewed_by_sekretaris_id: reviewerId,
      reviewed_at: reviewedAt,
      approval_note: note,
    },
    {
      where: { id: { [Op.in]: pendaftaranIds } },
      transaction,
    }
  );
  await Mahasiswa.update(
    {
      status_jalur_saat_ini: "belum_mengajukan",
    },
    {
      where: { id: { [Op.in]: mahasiswaIds } },
      transaction,
    }
  );
}

// GET /api/sekretaris/pendaftaran/:id
exports.getPendaftaranDetail = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "ID pendaftaran tidak valid.",
      });
    }

    const pendaftaran = await fetchPendaftaranDetail(id, getSekretarisProgramKuliah(req));
    if (!pendaftaran) {
      return res.status(404).json({
        success: false,
        message: "Data pendaftaran tidak ditemukan.",
      });
    }

    res.json({
      success: true,
      data: toCompactRow(pendaftaran),
    });
  } catch (error) {
    console.error("Error di getPendaftaranDetail:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// POST /api/sekretaris/pendaftaran/:id/approve
exports.approvePendaftaran = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const pendaftaranId = Number(req.params.id);
    const reviewerId = req.user?.sekretaris_prodi_id || null;
    const note = typeof req.body?.note === "string" ? req.body.note.trim() : "";

    if (!pendaftaranId) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "ID pendaftaran tidak valid.",
      });
    }

    const pendaftaran = await PendaftaranPenjaluran.findOne({
      where: {
        id: pendaftaranId,
        program_kuliah: getSekretarisProgramKuliah(req),
      },
      transaction: t,
    });
    if (!pendaftaran) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Data pendaftaran tidak ditemukan.",
      });
    }

    if (pendaftaran.status !== "submitted") {
      await t.rollback();
      return res.status(409).json({
        success: false,
        message: `Pendaftaran tidak bisa di-approve. Status saat ini: ${pendaftaran.status}`,
      });
    }

    await updateRegistrationDecision({
      pendaftaran,
      status: "approved",
      reviewerId,
      note: note || "Disetujui oleh sekretaris prodi",
      transaction: t,
    });

    await t.commit();

    const detail = await fetchPendaftaranDetail(pendaftaranId, getSekretarisProgramKuliah(req));
    res.json({
      success: true,
      message: "Pendaftaran berhasil di-approve. Kelompok dapat melanjutkan form Perintisan Bisnis.",
      data: toCompactRow(detail),
    });
  } catch (error) {
    if (!t.finished) await t.rollback();
    console.error("Error di approvePendaftaran:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// POST /api/sekretaris/pendaftaran/:id/reject
exports.rejectPendaftaran = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const pendaftaranId = Number(req.params.id);
    const reviewerId = req.user?.sekretaris_prodi_id || null;
    const note = typeof req.body?.note === "string" ? req.body.note.trim() : "";

    if (!pendaftaranId) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "ID pendaftaran tidak valid.",
      });
    }

    if (!note) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Alasan penolakan wajib diisi pada field note.",
      });
    }

    const pendaftaran = await PendaftaranPenjaluran.findOne({
      where: {
        id: pendaftaranId,
        program_kuliah: getSekretarisProgramKuliah(req),
      },
      transaction: t,
    });
    if (!pendaftaran) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Data pendaftaran tidak ditemukan.",
      });
    }

    if (pendaftaran.status !== "submitted") {
      await t.rollback();
      return res.status(409).json({
        success: false,
        message: `Pendaftaran tidak bisa ditolak. Status saat ini: ${pendaftaran.status}`,
      });
    }

    await updateRegistrationDecision({
      pendaftaran,
      status: "rejected",
      reviewerId,
      note,
      transaction: t,
    });

    await t.commit();

    const detail = await fetchPendaftaranDetail(pendaftaranId, getSekretarisProgramKuliah(req));
    res.json({
      success: true,
      message: "Pendaftaran ditolak. Kelompok belum dapat melanjutkan form Perintisan Bisnis.",
      data: toCompactRow(detail),
    });
  } catch (error) {
    if (!t.finished) await t.rollback();
    console.error("Error di rejectPendaftaran:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// GET /api/sekretaris/periode
exports.getPeriodeOverview = async (req, res) => {
  try {
    await closeExpiredActivePeriodePenjaluran();

    const [
      periodes,
      dosenOptions,
      klasterRows,
      dosenKlasterRows,
      masterPenanggungJawab,
      penanggungJawabLock,
    ] = await Promise.all([
      PeriodePenjaluran.findAll({
        include: [
          {
            model: Dosen,
            as: "ketuaPenelitianDosen",
            attributes: ["id", "kode_dosen", "nik", "nama", "gelar", "email"],
            required: false,
          },
          {
            model: Dosen,
            as: "pengawasMagangDosen",
            attributes: ["id", "kode_dosen", "nik", "nama", "gelar", "email"],
            required: false,
          },
          {
            model: Dosen,
            as: "pengawasPengabdianDosen",
            attributes: ["id", "kode_dosen", "nik", "nama", "gelar", "email"],
            required: false,
          },
          {
            model: Dosen,
            as: "pengawasPerintisanBisnisDosen",
            attributes: ["id", "kode_dosen", "nik", "nama", "gelar", "email"],
            required: false,
          },
        ],
        order: [["updatedAt", "DESC"]],
      }),
      Dosen.findAll({
        where: ACTIVE_DOSEN_WHERE,
        attributes: [
          "id",
          "kode_dosen",
          "nik",
          "nama",
          "gelar",
          "email",
          "jabatan_struktural",
          "kuota_bimbingan",
        ],
        order: [["nama", "ASC"]],
      }),
      Klaster.findAll({
        attributes: ["id", "kode", "nama"],
        order: [["nama", "ASC"]],
      }),
      DosenKlaster.findAll({
        include: [
          {
            model: Klaster,
            as: "klaster",
            attributes: ["id", "kode", "nama"],
            required: true,
          },
          {
            model: Dosen,
            as: "dosen",
            attributes: ["id", "kode_dosen", "nik", "nama", "gelar", "email"],
            where: ACTIVE_DOSEN_WHERE,
            required: true,
          },
        ],
        order: [
          [{ model: Klaster, as: "klaster" }, "nama", "ASC"],
          [{ model: Dosen, as: "dosen" }, "nama", "ASC"],
        ],
      }),
      fetchLatestMasterPenanggungJawab(),
      getPenanggungJawabAssignmentLock(),
    ]);

    const klasterByCode = new Map(
      RESEARCH_CLUSTER_CODES.map((kode) => [
        kode,
        {
          id: null,
          kode,
          nama: RESEARCH_CLUSTER_LABELS[kode] || kode,
          klaster_ids: [],
          kandidat_dosen: [],
        },
      ])
    );

    for (const klaster of klasterRows) {
      const mappedCode = resolveResearchClusterCode(klaster);
      if (!mappedCode || !klasterByCode.has(mappedCode)) continue;
      const target = klasterByCode.get(mappedCode);
      if (!target.klaster_ids.includes(klaster.id)) {
        target.klaster_ids.push(klaster.id);
      }
      if (!target.id) {
        target.id = klaster.id;
      }
    }

    for (const row of dosenKlasterRows) {
      const mappedCode = resolveResearchClusterCode(row.klaster);
      if (!mappedCode || !klasterByCode.has(mappedCode) || !row.dosen) continue;
      const target = klasterByCode.get(mappedCode);
      const exists = target.kandidat_dosen.some((item) => item.id === row.dosen.id);
      if (exists) continue;
      target.kandidat_dosen.push({
        id: row.dosen.id,
        kode_dosen: row.dosen.kode_dosen,
        nik: row.dosen.nik,
        nama: row.dosen.nama,
        gelar: row.dosen.gelar,
        email: row.dosen.email,
      });
    }

    const ketuaKlasterOptions = RESEARCH_CLUSTER_CODES.map((kode) => {
      const row = klasterByCode.get(kode);
      return {
        ...row,
        kandidat_dosen: (row?.kandidat_dosen || []).sort((a, b) => a.nama.localeCompare(b.nama)),
      };
    });

    const mappedPeriodes = periodes
      .map((item) => {
        const payload = item.toJSON();
        const status = getPeriodeStatusLabel(item);
        return {
          ...payload,
          status,
          is_active: status === "active",
        };
      })
      .sort((a, b) => {
        const rank = { active: 0, draft: 1, closed: 2 };
        const left = rank[a.status] ?? 3;
        const right = rank[b.status] ?? 3;
        if (left !== right) return left - right;
        return new Date(b.updatedAt) - new Date(a.updatedAt);
      });

    const activePeriode = mappedPeriodes.find((item) => item.status === "active") || null;
    const draftPeriode = mappedPeriodes.find((item) => item.status === "draft") || null;
    const researchClusterCodesByDosen = new Map();
    for (const row of dosenKlasterRows) {
      const clusterCode = resolveResearchClusterCode(row.klaster);
      const dosenId = Number(row.dosen_id || row.dosen?.id);
      if (!clusterCode || !dosenId) continue;
      const currentCodes = researchClusterCodesByDosen.get(dosenId) || [];
      if (!currentCodes.includes(clusterCode)) currentCodes.push(clusterCode);
      researchClusterCodesByDosen.set(dosenId, currentCodes);
    }
    const dosenOptionsWithCapacity = await Promise.all(dosenOptions.map(async (dosen) => ({
      ...dosen.toJSON(),
      cluster_codes: researchClusterCodesByDosen.get(Number(dosen.id)) || [],
      kuota: await dosen.getKuotaInfo(),
    })));
    const availableSupervisorRows = activePeriode
      ? await DosenKetersediaanPeriode.findAll({
          where: {
            periode_penjaluran_id: activePeriode.id,
            configuration_status: "ready",
            tersedia_membimbing: true,
          },
          attributes: ["dosen_id"],
          raw: true,
        })
      : [];
    const availableSupervisorIds = new Set(
      availableSupervisorRows.map((row) => Number(row.dosen_id))
    );
    const dosenPembimbingOptions = dosenOptionsWithCapacity.filter((dosen) =>
      availableSupervisorIds.has(Number(dosen.id))
    );

    res.json({
      success: true,
      data: {
        active_periode: activePeriode,
        draft_periode: draftPeriode,
        periodes: mappedPeriodes,
        dosen_options: dosenOptionsWithCapacity,
        dosen_pembimbing_options: dosenPembimbingOptions,
        ketua_klaster_options: ketuaKlasterOptions,
        master_penanggung_jawab: serializeMasterPenanggungJawab(masterPenanggungJawab),
        penanggung_jawab_lock: penanggungJawabLock,
      },
    });
  } catch (error) {
    console.error("Error di getPeriodeOverview:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// POST /api/sekretaris/periode/master-penanggung-jawab
exports.saveMasterPenanggungJawabPeriode = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const rolePayload = buildRolePayloadFromRequest(req.body || {});
    const fieldErrors = {};

    for (const item of PERIODE_REQUIRED_ROLE_FIELD_DEFINITIONS) {
      if (!parsePositiveId(rolePayload[item.field])) {
        fieldErrors[item.field] = `${item.label} wajib dipilih.`;
      }
    }

    const latestMaster = await MasterPenanggungJawabPenjaluran.findOne({
      order: [["updatedAt", "DESC"]],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    const assignmentLock = await getPenanggungJawabAssignmentLock({
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (isRolePayloadDifferent(latestMaster, rolePayload) && assignmentLock.locked) {
      await t.rollback();
      return res.status(409).json({
        success: false,
        message: assignmentLock.message,
        detail: {
          penanggung_jawab_lock: assignmentLock,
        },
      });
    }

    const klasterRows = await Klaster.findAll({
      attributes: ["id", "kode", "nama"],
      transaction: t,
    });
    const klasterByCode = new Map(
      RESEARCH_CLUSTER_CODES.map((kode) => [
        kode,
        {
          klaster_ids: [],
        },
      ])
    );
    for (const row of klasterRows) {
      const mappedCode = resolveResearchClusterCode(row);
      if (!mappedCode || !klasterByCode.has(mappedCode)) continue;
      const target = klasterByCode.get(mappedCode);
      target.klaster_ids.push(row.id);
    }

    const ketuaMappings = PERIODE_ROLE_FIELD_DEFINITIONS.filter((item) => item.kode).map((item) => ({
      ...item,
      klasterIds: klasterByCode.get(item.kode)?.klaster_ids || [],
      dosenId: parsePositiveId(rolePayload[item.field]),
    }));

    for (const item of ketuaMappings) {
      if (!Array.isArray(item.klasterIds) || item.klasterIds.length === 0) {
        fieldErrors[item.field] = `Klaster ${item.kode} belum tersedia di master klaster.`;
      }
    }

    const allDosenIds = [
      ...new Set(
        PERIODE_ROLE_FIELD_DEFINITIONS.map((item) => parsePositiveId(rolePayload[item.field])).filter(Boolean)
      ),
    ];
    const dosenRows = await Dosen.findAll({
      where: {
        id: {
          [Op.in]: allDosenIds,
        },
      },
      attributes: ["id", "kode_dosen", "nik", "nama", "gelar", "email", "status_keaktifan"],
      transaction: t,
    });
    const inactiveAssignment = dosenRows.find((item) => !assertDosenCanReceiveNewAssignment(item).allowed);
    if (inactiveAssignment) {
      await t.rollback();
      return res.status(409).json({
        success: false,
        message: `${inactiveAssignment.nama} tidak dapat ditugaskan karena statusnya ${inactiveAssignment.status_keaktifan}.`,
      });
    }
    const dosenById = new Map(dosenRows.map((item) => [item.id, item]));

    for (const item of PERIODE_ROLE_FIELD_DEFINITIONS) {
      const dosenId = parsePositiveId(rolePayload[item.field]);
      if (dosenId && !dosenById.has(dosenId)) {
        fieldErrors[item.field] = `${item.label} tidak ditemukan.`;
      }
    }

    const membershipRows = await DosenKlaster.findAll({
      where: {
        dosen_id: {
          [Op.in]: ketuaMappings.map((item) => item.dosenId).filter(Boolean),
        },
        klaster_id: {
          [Op.in]: [...new Set(ketuaMappings.flatMap((item) => item.klasterIds || []))],
        },
      },
      attributes: ["klaster_id", "dosen_id"],
      transaction: t,
    });
    const membershipSet = new Set(membershipRows.map((item) => `${item.klaster_id}:${item.dosen_id}`));
    for (const item of ketuaMappings) {
      if (!item.dosenId || !Array.isArray(item.klasterIds) || item.klasterIds.length === 0) continue;
      const isMember = item.klasterIds.some((klasterId) => membershipSet.has(`${klasterId}:${item.dosenId}`));
      if (!isMember) {
        fieldErrors[item.field] = `Dosen terpilih bukan anggota klaster ${item.kode}.`;
      }
    }

    if (Object.keys(fieldErrors).length > 0) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Validasi master data gagal. Periksa field yang ditandai.",
        detail: fieldErrors,
      });
    }

    if (latestMaster) {
      for (const item of PERIODE_ROLE_FIELD_DEFINITIONS) {
        latestMaster[item.field] = parsePositiveId(rolePayload[item.field]);
      }
      latestMaster.updated_by_sekretaris_id = req.user?.sekretaris_prodi_id || null;
      await latestMaster.save({ transaction: t });
    } else {
      const createPayload = {};
      for (const item of PERIODE_ROLE_FIELD_DEFINITIONS) {
        createPayload[item.field] = parsePositiveId(rolePayload[item.field]);
      }
      createPayload.updated_by_sekretaris_id = req.user?.sekretaris_prodi_id || null;
      await MasterPenanggungJawabPenjaluran.create(createPayload, { transaction: t });
    }

    const savedMaster = await fetchLatestMasterPenanggungJawab({ transaction: t });
    await t.commit();

    return res.json({
      success: true,
      message: "Master data penanggung jawab penjaluran berhasil disimpan.",
      data: serializeMasterPenanggungJawab(savedMaster),
    });
  } catch (error) {
    if (!t.finished) await t.rollback();
    console.error("Error di saveMasterPenanggungJawabPeriode:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// GET /api/sekretaris/master-dosen/kuota-overview
exports.getMasterDosenKuotaOverview = async (req, res) => {
  try {
    const dosens = await Dosen.findAll({
      attributes: ["id", "kode_dosen", "nik", "nama", "gelar", "email", "jabatan_struktural", "kuota_bimbingan"],
      order: [["nama", "ASC"]],
    });

    const dosensWithKuota = await Promise.all(
      dosens.map(async (dosen) => {
        const kuotaInfo = await dosen.getKuotaInfo();
        return {
          id: dosen.id,
          kode_dosen: dosen.kode_dosen || null,
          nik: dosen.nik || null,
          nama: dosen.nama || null,
          gelar: dosen.gelar || null,
          email: dosen.email || null,
          jabatan_struktural: dosen.jabatan_struktural || null,
          kuota: kuotaInfo,
        };
      })
    );

    const summary = {
      total_dosen: dosensWithKuota.length,
      total_kuota: dosensWithKuota.reduce((sum, row) => sum + Number(row.kuota?.total || 0), 0),
      total_terpakai: dosensWithKuota.reduce((sum, row) => sum + Number(row.kuota?.terpakai || 0), 0),
      total_sisa: dosensWithKuota.reduce((sum, row) => sum + Number(row.kuota?.sisa || 0), 0),
      dosen_penuh: dosensWithKuota.filter((row) => Boolean(row.kuota?.is_penuh)).length,
    };

    return res.json({
      success: true,
      data: {
        summary,
        dosens: dosensWithKuota,
      },
    });
  } catch (error) {
    console.error("Error di getMasterDosenKuotaOverview:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// PUT /api/sekretaris/master-dosen/kuota
exports.setMasterDosenKuota = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const kuotaValidation = validateKuotaBimbinganValue(req.body?.kuota_bimbingan);
    const rawKuota = kuotaValidation.value;
    const mode = String(req.body?.mode || "all").toLowerCase();
    const selectedIdsRaw = Array.isArray(req.body?.dosen_ids) ? req.body.dosen_ids : [];

    if (!kuotaValidation.isValid) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: kuotaValidation.message,
      });
    }

    const selectedIds = [...new Set(selectedIdsRaw.map((item) => Number(item)).filter((id) => Number.isInteger(id) && id > 0))];
    let targetDosens = [];

    if (mode === "selected") {
      if (selectedIds.length === 0) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: "Pilih minimal satu dosen untuk mode selected.",
        });
      }
      targetDosens = await Dosen.findAll({
        where: { id: { [Op.in]: selectedIds } },
        attributes: ["id", "nama", "nik", "kode_dosen", "kuota_bimbingan"],
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (targetDosens.length !== selectedIds.length) {
        await t.rollback();
        return res.status(404).json({
          success: false,
          message: "Sebagian dosen yang dipilih tidak ditemukan.",
        });
      }
    } else if (mode === "all") {
      targetDosens = await Dosen.findAll({
        attributes: ["id", "nama", "nik", "kode_dosen", "kuota_bimbingan"],
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (targetDosens.length === 0) {
        await t.rollback();
        return res.status(404).json({
          success: false,
          message: "Belum ada data dosen.",
        });
      }
    } else {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "mode tidak valid. Gunakan 'all' atau 'selected'.",
      });
    }

    const invalidKuotaRows = [];
    for (const dosen of targetDosens) {
      const kuotaInfoSaatIni = await dosen.getKuotaInfo(t);
      const sisaSaatIni = Number(kuotaInfoSaatIni?.sisa || 0);
      const terpakaiSaatIni = Number(kuotaInfoSaatIni?.terpakai || 0);
      const minimalKuota = Math.max(1, terpakaiSaatIni);
      if (rawKuota < minimalKuota) {
        invalidKuotaRows.push({
          id: dosen.id,
          nama: dosen.nama || null,
          nik: dosen.nik || null,
          kode_dosen: dosen.kode_dosen || null,
          sisa_saat_ini: sisaSaatIni,
          terpakai_saat_ini: terpakaiSaatIni,
          minimal_kuota: minimalKuota,
        });
      }
    }

    if (invalidKuotaRows.length > 0) {
      await t.rollback();
      const contoh = invalidKuotaRows[0];
      const labelContoh = contoh.nama || contoh.kode_dosen || contoh.nik || `ID ${contoh.id}`;
      return res.status(400).json({
        success: false,
        message: `Kuota ${rawKuota} tidak valid. Contoh: ${labelContoh} minimal ${contoh.minimal_kuota} karena sudah terpakai ${contoh.terpakai_saat_ini}.`,
        detail: {
          invalid_rows: invalidKuotaRows,
        },
      });
    }

    const updatedRows = [];
    let changedCount = 0;
    for (const dosen of targetDosens) {
      const oldKuota = Number(dosen.kuota_bimbingan || 0);
      if (oldKuota !== rawKuota) {
        dosen.kuota_bimbingan = rawKuota;
        await dosen.save({ transaction: t });
        changedCount += 1;
      }

      const kuotaInfo = await dosen.getKuotaInfo(t);
      if (rawKuota > oldKuota && !kuotaInfo.is_penuh) {
        await Topik.update(
          { status: "available" },
          {
            where: {
              dosen_id: dosen.id,
              status: "unavailable",
            },
            transaction: t,
          }
        );
      } else if (kuotaInfo.is_penuh) {
        await Topik.update(
          { status: "unavailable" },
          {
            where: {
              dosen_id: dosen.id,
              status: "available",
            },
            transaction: t,
          }
        );
      }

      updatedRows.push({
        id: dosen.id,
        nama: dosen.nama || null,
        nik: dosen.nik || null,
        kode_dosen: dosen.kode_dosen || null,
        kuota_lama: oldKuota,
        kuota_baru: rawKuota,
        kuota: kuotaInfo,
      });
    }

    await t.commit();
    return res.json({
      success: true,
      message:
        mode === "all"
          ? `Kuota berhasil diatur menjadi ${rawKuota} untuk semua dosen (${targetDosens.length} dosen).`
          : `Kuota berhasil diatur menjadi ${rawKuota} untuk ${targetDosens.length} dosen terpilih.`,
      data: {
        mode,
        total_target: targetDosens.length,
        total_berubah: changedCount,
        rows: updatedRows,
      },
    });
  } catch (error) {
    if (!t.finished) await t.rollback();
    console.error("Error di setMasterDosenKuota:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

function resolveKetuaKlasterTargetPeriode(periodes, periodeId) {
  if (Number.isInteger(periodeId) && periodeId > 0) {
    return periodes.find((item) => Number(item.id) === Number(periodeId)) || null;
  }

  const draft = periodes.find((item) => getPeriodeStatusLabel(item) === "draft");
  if (draft) return draft;

  const active = periodes.find((item) => getPeriodeStatusLabel(item) === "active");
  if (active) return active;

  return null;
}

// GET /api/sekretaris/ketua-klaster
exports.getKetuaKlasterOverview = async (req, res) => {
  try {
    const periodeId = Number(req.query.periode_penjaluran_id);
    const [periodes, klasters, dosenKlasterRows] = await Promise.all([
      PeriodePenjaluran.findAll({
        attributes: ["id", "tahun_akademik", "semester", "label_periode", "is_active", "status", "updatedAt"],
        order: [["updatedAt", "DESC"]],
      }),
      Klaster.findAll({
        attributes: ["id", "kode", "nama"],
        order: [["kode", "ASC"]],
      }),
      DosenKlaster.findAll({
        attributes: ["klaster_id", "dosen_id"],
        include: [
          {
            model: Dosen,
            as: "dosen",
            attributes: ["id", "kode_dosen", "nik", "nama", "gelar", "email", "jabatan_struktural"],
            where: ACTIVE_DOSEN_WHERE,
            required: true,
          },
        ],
        order: [[{ model: Dosen, as: "dosen" }, "nama", "ASC"]],
      }),
    ]);

    const periodeDipakai = resolveKetuaKlasterTargetPeriode(periodes, periodeId);
    if (Number.isInteger(periodeId) && periodeId > 0 && !periodeDipakai) {
      return res.status(404).json({
        success: false,
        message: "Periode yang dipilih tidak ditemukan.",
      });
    }

    const activePeriode = periodes.find((item) => getPeriodeStatusLabel(item) === "active") || null;
    const mappedPeriodes = periodes
      .map((item) => ({
        ...item.toJSON(),
        status: getPeriodeStatusLabel(item),
        is_active: isPeriodeActive(item),
      }))
      .sort((a, b) => {
        const rank = { active: 0, draft: 1, closed: 2 };
        const left = rank[a.status] ?? 3;
        const right = rank[b.status] ?? 3;
        if (left !== right) return left - right;
        return new Date(b.updatedAt) - new Date(a.updatedAt);
      });

    if (!periodeDipakai) {
      return res.json({
        success: true,
        data: {
          active_periode: activePeriode ? { ...activePeriode.toJSON(), status: getPeriodeStatusLabel(activePeriode), is_active: isPeriodeActive(activePeriode) } : null,
          periode_terpilih: null,
          periodes: mappedPeriodes,
          rows: klasters.map((klaster) => ({
            id: klaster.id,
            kode: klaster.kode,
            nama: klaster.nama,
            ketua: null,
            kandidat_dosen: [],
            total_kandidat: 0,
          })),
          message: "Belum ada periode. Buat draft periode terlebih dahulu.",
        },
      });
    }

    if (getPeriodeStatusLabel(periodeDipakai) !== "closed") {
      await initializeAvailabilityForPeriod(periodeDipakai.id);
    }

    const ketuaRows = await KlasterKetuaPeriode.findAll({
      where: { periode_penjaluran_id: periodeDipakai.id },
      include: [
        {
          model: Dosen,
          as: "ketuaDosen",
          attributes: ["id", "kode_dosen", "nik", "nama", "gelar", "email", "jabatan_struktural"],
          required: true,
        },
        {
          model: SekretarisProdi,
          as: "assignedBySekretaris",
          attributes: ["id", "nik", "nama", "jabatan"],
          required: false,
        },
      ],
      order: [["updatedAt", "DESC"]],
    });

    const dosenPerKlasterMap = new Map();
    for (const row of dosenKlasterRows) {
      const key = row.klaster_id;
      const current = dosenPerKlasterMap.get(key) || [];
      current.push({
        id: row.dosen.id,
        kode_dosen: row.dosen.kode_dosen,
        nik: row.dosen.nik,
        nama: row.dosen.nama,
        gelar: row.dosen.gelar,
        email: row.dosen.email,
        jabatan_struktural: row.dosen.jabatan_struktural || null,
      });
      dosenPerKlasterMap.set(key, current);
    }

    const ketuaPerKlasterMap = new Map();
    for (const row of ketuaRows) {
      ketuaPerKlasterMap.set(row.klaster_id, {
        id: row.id,
        updatedAt: row.updatedAt,
        ketua_dosen: row.ketuaDosen
          ? {
              id: row.ketuaDosen.id,
              kode_dosen: row.ketuaDosen.kode_dosen,
              nik: row.ketuaDosen.nik,
              nama: row.ketuaDosen.nama,
              gelar: row.ketuaDosen.gelar,
              email: row.ketuaDosen.email,
              jabatan_struktural: row.ketuaDosen.jabatan_struktural || null,
            }
          : null,
        assigned_by: row.assignedBySekretaris
          ? {
              id: row.assignedBySekretaris.id,
              nik: row.assignedBySekretaris.nik,
              nama: row.assignedBySekretaris.nama,
              jabatan: row.assignedBySekretaris.jabatan || null,
            }
          : null,
      });
    }

    const rows = klasters.map((klaster) => ({
      id: klaster.id,
      kode: klaster.kode,
      nama: klaster.nama,
      ketua: ketuaPerKlasterMap.get(klaster.id) || null,
      kandidat_dosen: dosenPerKlasterMap.get(klaster.id) || [],
      total_kandidat: (dosenPerKlasterMap.get(klaster.id) || []).length,
    }));

    return res.json({
      success: true,
      data: {
        active_periode: activePeriode ? { ...activePeriode.toJSON(), status: getPeriodeStatusLabel(activePeriode), is_active: isPeriodeActive(activePeriode) } : null,
        periode_terpilih: {
          ...periodeDipakai.toJSON(),
          status: getPeriodeStatusLabel(periodeDipakai),
          is_active: isPeriodeActive(periodeDipakai),
        },
        periodes: mappedPeriodes,
        rows,
      },
    });
  } catch (error) {
    console.error("Error di getKetuaKlasterOverview:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

function getSekretarisActorId(req) {
  return req.user?.sekretaris_prodi_id || null;
}

function normalizePeriodeSetupPayload(body = {}) {
  const periode = body.periode && typeof body.periode === "object" ? body.periode : body;
  const responsibility = body.penanggung_jawab && typeof body.penanggung_jawab === "object"
    ? body.penanggung_jawab
    : body;
  const rolePayload = buildRolePayloadFromRequest({ ...body, ...responsibility });
  rolePayload.pengawas_pengabdian_dosen_id = parsePositiveId(
    responsibility.pengampu_pengabdian_dosen_id
      ?? responsibility.pengawas_pengabdian_dosen_id
      ?? body.pengampu_pengabdian_dosen_id
      ?? body.pengawas_pengabdian_dosen_id
  );
  rolePayload.pengawas_perintisan_bisnis_dosen_id = parsePositiveId(
    responsibility.pengampu_perintisan_bisnis_dosen_id
      ?? responsibility.pengawas_perintisan_bisnis_dosen_id
      ?? body.pengampu_perintisan_bisnis_dosen_id
      ?? body.pengawas_perintisan_bisnis_dosen_id
  );

  const ketuaCluster = responsibility.ketua_cluster;
  if (Array.isArray(ketuaCluster)) {
    for (const item of ketuaCluster) {
      const code = String(item?.kode || item?.cluster || "").trim().toUpperCase();
      const definition = PERIODE_ROLE_FIELD_DEFINITIONS.find((row) => row.kode === code);
      if (definition) rolePayload[definition.field] = parsePositiveId(item?.dosen_id);
    }
  } else if (ketuaCluster && typeof ketuaCluster === "object") {
    for (const definition of PERIODE_ROLE_FIELD_DEFINITIONS.filter((row) => row.kode)) {
      rolePayload[definition.field] = parsePositiveId(
        ketuaCluster[definition.kode]
          ?? ketuaCluster[definition.kode.toLowerCase()]
          ?? ketuaCluster[definition.field]
          ?? rolePayload[definition.field]
      );
    }
  }

  return {
    periode: {
      tahun_akademik: normalizeText(periode.tahun_akademik),
      semester: normalizeText(periode.semester).toLowerCase(),
      label_periode: normalizeText(periode.label_periode),
      tanggal_mulai: normalizeText(periode.tanggal_mulai),
      tanggal_selesai: normalizeText(periode.tanggal_selesai),
    },
    rolePayload,
    availabilityRows: Array.isArray(body.ketersediaan_dosen)
      ? body.ketersediaan_dosen
      : Array.isArray(body.dosens) ? body.dosens : [],
  };
}

async function validatePeriodeSetupPayload(body, options = {}) {
  const transaction = options.transaction || null;
  const lock = options.lock || undefined;
  const normalized = normalizePeriodeSetupPayload(body);
  const { periode, rolePayload, availabilityRows } = normalized;
  const fieldErrors = {};

  const tahunError = getTahunAkademikValidationMessage(periode.tahun_akademik);
  if (tahunError) fieldErrors.tahun_akademik = tahunError;
  if (!["ganjil", "genap"].includes(periode.semester)) fieldErrors.semester = "Semester wajib dipilih.";
  const tanggalMulai = parseInputDateForJakarta(periode.tanggal_mulai, "start");
  const tanggalSelesai = parseInputDateForJakarta(periode.tanggal_selesai, "end");
  if (!periode.tanggal_mulai || Number.isNaN(tanggalMulai?.getTime())) fieldErrors.tanggal_mulai = "Tanggal mulai wajib valid.";
  if (!periode.tanggal_selesai || Number.isNaN(tanggalSelesai?.getTime())) fieldErrors.tanggal_selesai = "Tanggal selesai wajib valid.";
  if (tanggalMulai && tanggalSelesai && tanggalMulai > tanggalSelesai) {
    fieldErrors.tanggal_selesai = "Tanggal selesai harus setelah tanggal mulai.";
  }
  if (!periode.label_periode) fieldErrors.label_periode = "Label periode wajib diisi.";
  const labelPeriode = periode.label_periode;

  for (const definition of PERIODE_REQUIRED_ROLE_FIELD_DEFINITIONS) {
    if (!parsePositiveId(rolePayload[definition.field])) fieldErrors[definition.field] = `${definition.label} wajib dipilih.`;
  }

  const [duplicatePeriod, duplicateLabel, activePeriod, klasters, allDosens] = await Promise.all([
    PeriodePenjaluran.findOne({
      where: { tahun_akademik: periode.tahun_akademik, semester: periode.semester },
      transaction,
      lock,
    }),
    labelPeriode ? PeriodePenjaluran.findOne({ where: { label_periode: labelPeriode }, transaction, lock }) : null,
    PeriodePenjaluran.findOne({ where: { [Op.or]: [{ status: "active" }, { is_active: true }] }, transaction, lock }),
    Klaster.findAll({ attributes: ["id", "kode", "nama"], transaction }),
    Dosen.findAll({
      attributes: ["id", "kode_dosen", "nik", "nama", "gelar", "status_keaktifan", "kuota_bimbingan"],
      transaction,
      lock,
    }),
  ]);
  if (duplicatePeriod) {
    fieldErrors.periode = `Periode ${formatPeriodeLabel(periode.semester, periode.tahun_akademik)} sudah ada.`;
  }
  if (duplicateLabel) {
    fieldErrors.label_periode = "Label periode sudah digunakan.";
  }
  if (activePeriod) fieldErrors.active_periode = `Masih ada periode aktif (${activePeriod.label_periode}).`;

  const dosenById = new Map(allDosens.map((item) => [Number(item.id), item]));
  for (const definition of PERIODE_ROLE_FIELD_DEFINITIONS) {
    const dosenId = parsePositiveId(rolePayload[definition.field]);
    const dosen = dosenById.get(dosenId);
    if (dosenId && !dosen) fieldErrors[definition.field] = `${definition.label} tidak ditemukan.`;
    else if (dosen && dosen.status_keaktifan !== "active") fieldErrors[definition.field] = `${definition.label} harus menggunakan dosen aktif.`;
  }

  const klasterByCode = new Map();
  for (const klaster of klasters) {
    const code = resolveResearchClusterCode(klaster);
    if (!code) continue;
    const isExactCode = String(klaster.kode || "").trim().toUpperCase() === code;
    if (!klasterByCode.has(code) || isExactCode) klasterByCode.set(code, klaster);
  }
  const ketuaMappings = [];
  for (const definition of PERIODE_ROLE_FIELD_DEFINITIONS.filter((row) => row.kode)) {
    const klaster = klasterByCode.get(definition.kode);
    if (!klaster) fieldErrors[definition.field] = `Master klaster ${definition.kode} belum tersedia.`;
    else ketuaMappings.push({ definition, klaster, dosenId: parsePositiveId(rolePayload[definition.field]) });
  }
  if (ketuaMappings.length > 0) {
    const membershipRows = await DosenKlaster.findAll({
      where: {
        [Op.or]: ketuaMappings.map((item) => ({ klaster_id: item.klaster.id, dosen_id: item.dosenId })),
      },
      attributes: ["klaster_id", "dosen_id"],
      transaction,
    });
    const membershipSet = new Set(membershipRows.map((row) => `${row.klaster_id}:${row.dosen_id}`));
    for (const item of ketuaMappings) {
      if (item.dosenId && !membershipSet.has(`${item.klaster.id}:${item.dosenId}`)) {
        fieldErrors[item.definition.field] = `Dosen terpilih bukan anggota klaster ${item.definition.kode}.`;
      }
    }
  }

  const seenDosenIds = new Set();
  const normalizedAvailability = [];
  for (const input of availabilityRows) {
    const dosenId = parsePositiveId(input?.dosen_id ?? input?.id);
    if (!dosenId || !dosenById.has(dosenId)) {
      fieldErrors.ketersediaan_dosen = "Daftar ketersediaan mengandung dosen yang tidak valid.";
      continue;
    }
    if (seenDosenIds.has(dosenId)) {
      fieldErrors.ketersediaan_dosen = `Dosen ID ${dosenId} muncul lebih dari satu kali.`;
      continue;
    }
    seenDosenIds.add(dosenId);
    const dosen = dosenById.get(dosenId);
    const available = input?.tersedia_membimbing === true;
    const configurationStatus = String(input?.configuration_status || "").toLowerCase();
    if (dosen.status_keaktifan === "active" && !["ready", "copied"].includes(configurationStatus)) {
      fieldErrors[`dosen_${dosenId}`] = `${dosen.nama} masih perlu ditinjau.`;
    }
    if (dosen.status_keaktifan !== "active" && available) {
      fieldErrors[`dosen_${dosenId}`] = `${dosen.nama} tidak aktif dan tidak dapat menerima bimbingan baru.`;
    }
    normalizedAvailability.push({
      dosen,
      dosen_id: dosenId,
      tersedia_membimbing: dosen.status_keaktifan === "active" && available,
      configuration_status: dosen.status_keaktifan === "active" ? "ready" : "locked_by_master_status",
    });
  }
  if (availabilityRows.length === 0) fieldErrors.ketersediaan_dosen = "Konfigurasi ketersediaan dosen wajib diisi.";
  if (seenDosenIds.size !== allDosens.length) {
    fieldErrors.ketersediaan_dosen = "Seluruh dosen pada template harus dikonfigurasi sebelum periode dibuka.";
  }

  const capacities = await Promise.all(normalizedAvailability.map(async (item) => {
    const info = await item.dosen.getKuotaInfo(transaction);
    return { dosen_id: item.dosen_id, ...info };
  }));
  const capacityByDosen = new Map(capacities.map((item) => [Number(item.dosen_id), item]));
  const summary = {
    menerima: normalizedAvailability.filter((row) => row.tersedia_membimbing).length,
    tidak_menerima: normalizedAvailability.filter((row) => row.dosen.status_keaktifan === "active" && !row.tersedia_membimbing).length,
    locked: normalizedAvailability.filter((row) => row.configuration_status === "locked_by_master_status").length,
    needs_review: Object.keys(fieldErrors).filter((key) => key.startsWith("dosen_")).length,
    total_kuota: capacities.reduce((sum, row) => sum + Number(row.total || 0), 0),
    terpakai: capacities.reduce((sum, row) => sum + Number(row.terpakai || 0), 0),
    sisa: capacities.reduce((sum, row) => sum + Number(row.sisa || 0), 0),
  };

  return {
    valid: Object.keys(fieldErrors).length === 0,
    errors: fieldErrors,
    periode: { ...periode, label_periode: labelPeriode, tanggalMulai, tanggalSelesai },
    rolePayload,
    ketuaMappings,
    availability: normalizedAvailability.map((row) => ({ ...row, capacity: capacityByDosen.get(row.dosen_id) })),
    summary,
  };
}

exports.getPeriodeSetupTemplate = async (req, res) => {
  try {
    const previousPeriod = await PeriodePenjaluran.findOne({
      where: { status: { [Op.in]: ["active", "closed"] } },
      order: [["tanggal_mulai", "DESC"], ["id", "DESC"]],
      attributes: ["id", "label_periode", "tahun_akademik", "semester"],
    });
    const [dosens, previousRows, masterPenanggungJawab] = await Promise.all([
      Dosen.findAll({
        attributes: ["id", "kode_dosen", "nik", "nama", "gelar", "email", "status_keaktifan", "status_updated_at", "kuota_bimbingan"],
        order: [["nama", "ASC"]],
      }),
      previousPeriod
        ? DosenKetersediaanPeriode.findAll({ where: { periode_penjaluran_id: previousPeriod.id } })
        : [],
      fetchLatestMasterPenanggungJawab(),
    ]);
    const previousByDosen = new Map(previousRows.map((row) => [Number(row.dosen_id), row]));
    const rows = await Promise.all(dosens.map(async (dosen) => {
      const previous = previousByDosen.get(Number(dosen.id));
      const capacity = await dosen.getKuotaInfo();
      const isActive = dosen.status_keaktifan === "active";
      const comparisonDate = previous?.reviewed_at || previous?.updatedAt || null;
      const statusChangedAfterReview = Boolean(
        dosen.status_updated_at && comparisonDate
        && new Date(dosen.status_updated_at).getTime() > new Date(comparisonDate).getTime()
      );
      const copied = isActive && previous?.configuration_status === "ready" && !statusChangedAfterReview;
      return {
        id: dosen.id,
        kode_dosen: dosen.kode_dosen,
        nik: dosen.nik,
        nama: dosen.nama,
        gelar: dosen.gelar,
        email: dosen.email,
        status_keaktifan: dosen.status_keaktifan,
        configuration_status: !isActive ? "locked_by_master_status" : copied ? "copied" : "needs_review",
        tersedia_membimbing: copied ? Boolean(previous.tersedia_membimbing) : false,
        kuota: Number(capacity.total || dosen.kuota_bimbingan || 0),
        terpakai: Number(capacity.terpakai || 0),
        sisa: Number(capacity.sisa || 0),
        can_edit: isActive,
      };
    }));
    return res.json({
      success: true,
      data: {
        previous_period: previousPeriod ? previousPeriod.toJSON() : null,
        suggested_period: getSuggestedNextPeriod(previousPeriod),
        penanggung_jawab: serializeMasterPenanggungJawab(masterPenanggungJawab),
        dosens: rows,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Gagal memuat template persiapan periode.", error: error.message });
  }
};

exports.previewPeriodePendaftaran = async (req, res) => {
  try {
    const result = await validatePeriodeSetupPayload(req.body || {});
    if (!result.valid) {
      const firstError = Object.values(result.errors || {}).find(Boolean);
      return res.status(400).json({
        success: false,
        message: firstError ? `Persiapan periode belum valid: ${firstError}` : "Persiapan periode belum valid.",
        detail: result.errors,
      });
    }
    return res.json({
      success: true,
      data: {
        periode: {
          tahun_akademik: result.periode.tahun_akademik,
          semester: result.periode.semester,
          label_periode: result.periode.label_periode,
          tanggal_mulai: result.periode.tanggal_mulai,
          tanggal_selesai: result.periode.tanggal_selesai,
        },
        penanggung_jawab: PERIODE_ROLE_FIELD_DEFINITIONS.map((definition) => {
          const dosenId = result.rolePayload[definition.field];
          const dosen = result.availability.find((row) => row.dosen_id === dosenId)?.dosen;
          return { key: definition.field, label: definition.label, dosen: formatDosenMini(dosen) };
        }),
        ketersediaan: result.summary,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Gagal membuat preview periode.", error: error.message });
  }
};

async function buildPeriodeAvailabilityReadiness(periodeId, transaction = null) {
  const periode = await PeriodePenjaluran.findByPk(periodeId, { transaction });
  if (!periode) return null;
  if (periode.status !== "closed") await initializeAvailabilityForPeriod(periode.id, transaction);

  const [availabilityRows, ketuaRows] = await Promise.all([
    DosenKetersediaanPeriode.findAll({
      where: { periode_penjaluran_id: periode.id },
      include: [{
        model: Dosen,
        as: "dosen",
        attributes: ["id", "nama", "gelar", "kode_dosen", "status_keaktifan"],
        required: true,
      }],
      transaction,
    }),
    KlasterKetuaPeriode.findAll({
      where: { periode_penjaluran_id: periode.id },
      include: [{ model: Klaster, as: "klaster", attributes: ["id", "kode", "nama"], required: true }],
      transaction,
    }),
  ]);

  const availabilityByDosen = new Map(availabilityRows.map((row) => [Number(row.dosen_id), row]));
  const counts = { total: availabilityRows.length, ready: 0, needs_review: 0, locked_by_master_status: 0 };
  const needsReviewDosens = [];
  for (const row of availabilityRows) {
    const masterActive = row.dosen?.status_keaktifan === "active";
    const status = masterActive
      ? row.configuration_status || "needs_review"
      : "locked_by_master_status";
    if (Object.prototype.hasOwnProperty.call(counts, status)) counts[status] += 1;
    if (status === "needs_review") {
      needsReviewDosens.push({
        id: row.dosen_id,
        nama: row.dosen?.nama || null,
        kode_dosen: row.dosen?.kode_dosen || null,
      });
    }
  }

  const errors = [];
  if (needsReviewDosens.length > 0) {
    errors.push({
      code: "availability_needs_review",
      message: `${needsReviewDosens.length} dosen masih berstatus Perlu Ditinjau.`,
      dosens: needsReviewDosens,
    });
  }

  const startDate = periode.tanggal_mulai ? new Date(periode.tanggal_mulai) : null;
  const endDate = periode.tanggal_selesai ? new Date(periode.tanggal_selesai) : null;
  if (!startDate || Number.isNaN(startDate.getTime())) {
    errors.push({ code: "invalid_start_date", message: "Tanggal mulai periode belum valid." });
  }
  if (!endDate || Number.isNaN(endDate.getTime())) {
    errors.push({ code: "invalid_end_date", message: "Tanggal selesai periode belum valid." });
  }
  if (startDate && endDate && startDate.getTime() > endDate.getTime()) {
    errors.push({ code: "invalid_date_range", message: "Tanggal selesai harus setelah tanggal mulai." });
  }

  const assertRoleReady = (dosenId, label) => {
    const normalizedId = Number(dosenId || 0);
    if (!normalizedId) {
      errors.push({ code: "missing_required_role", message: `${label} belum ditetapkan.` });
      return;
    }
    const availability = availabilityByDosen.get(normalizedId);
    if (!availability || availability.dosen?.status_keaktifan !== "active") {
      errors.push({ code: "inactive_role_holder", dosen_id: normalizedId, message: `${label} harus menggunakan dosen berstatus aktif.` });
      return;
    }
  };

  const ketuaByCode = new Map();
  for (const row of ketuaRows) {
    const code = resolveResearchClusterCode(row.klaster);
    if (code && !ketuaByCode.has(code)) ketuaByCode.set(code, row);
  }
  for (const code of RESEARCH_CLUSTER_CODES) {
    const mapping = ketuaByCode.get(code);
    assertRoleReady(mapping?.dosen_id, `Ketua Cluster ${code}`);
  }
  assertRoleReady(periode.pengawas_magang_dosen_id, "Dosen pengawas magang");
  assertRoleReady(periode.pengawas_perintisan_bisnis_dosen_id, "Dosen pengampu perintisan bisnis");

  return {
    ready: errors.length === 0,
    periode_id: periode.id,
    periode_status: periode.status,
    counts,
    needs_review_dosens: needsReviewDosens,
    errors,
  };
}

// GET /api/sekretaris/master-dosen/ketersediaan
exports.getDosenKetersediaanPeriode = async (req, res) => {
  try {
    const periodes = await PeriodePenjaluran.findAll({
      attributes: ["id", "label_periode", "tahun_akademik", "semester", "status", "is_active"],
      where: { status: { [Op.in]: ["active", "closed"] } },
      order: [["updatedAt", "DESC"]],
    });
    const requestedId = Number(req.query.periode_penjaluran_id || 0);
    const periode = (requestedId ? periodes.find((item) => item.id === requestedId) : null)
      || periodes.find((item) => item.status === "active")
      || periodes[0]
      || null;

    if (!periode) {
      return res.json({ success: true, data: { periodes: [], periode: null, dosens: [] } });
    }

    if (periode.status !== "closed") await initializeAvailabilityForPeriod(periode.id);

    const dosens = await Dosen.findAll({
      attributes: [
        "id", "kode_dosen", "nik", "nama", "gelar", "email", "status_keaktifan",
        "continue_existing_supervision", "kuota_bimbingan",
      ],
      include: [{
        model: DosenKetersediaanPeriode,
        as: "ketersediaanPeriodes",
        where: { periode_penjaluran_id: periode.id },
        required: periode.status === "closed",
      }],
      order: [["nama", "ASC"]],
    });

    const mapped = await Promise.all(dosens.map(async (dosen) => {
      const saved = dosen.ketersediaanPeriodes?.[0] || null;
      const masterActive = dosen.status_keaktifan === "active";
      const configurationStatus = !masterActive
        ? "locked_by_master_status"
        : saved?.configuration_status || "needs_review";
      const tersediaMembimbing = masterActive && Boolean(saved?.tersedia_membimbing);
      const storedAvailability = {
        tersedia_membimbing: Boolean(saved?.tersedia_membimbing),
      };
      const effectiveAvailability = toEffectiveAvailability(dosen, saved, periode.status);
      const capacity = await dosen.getKuotaInfo();
      return {
        id: dosen.id,
        kode_dosen: dosen.kode_dosen,
        nik: dosen.nik,
        nama: dosen.nama,
        gelar: dosen.gelar,
        email: dosen.email,
        status_keaktifan: dosen.status_keaktifan,
        continue_existing_supervision: dosen.continue_existing_supervision,
        tersedia_membimbing: tersediaMembimbing,
        kuota: Number(capacity.total || dosen.kuota_bimbingan || 0),
        terpakai: Number(capacity.terpakai || 0),
        sisa: Number(capacity.sisa || 0),
        kapasitas_penuh: Boolean(capacity.is_penuh),
        configured: Boolean(saved),
        configuration_status: configurationStatus,
        reviewed_at: saved?.reviewed_at || null,
        reviewed_by_sekretaris_id: saved?.reviewed_by_sekretaris_id || null,
        review_note: !masterActive
          ? "Dikunci oleh status master dosen"
          : saved?.review_note || "",
        stored_availability: storedAvailability,
        effective_availability: effectiveAvailability,
        can_edit: periode.status === "active"
          && periode.is_active === true
          && masterActive
          && configurationStatus !== "locked_by_master_status",
        updatedAt: saved?.updatedAt || null,
      };
    }));

    const readiness = await buildPeriodeAvailabilityReadiness(periode.id);
    return res.json({
      success: true,
      data: { periodes, periode, dosens: mapped, readiness, is_readonly: periode.status === "closed" },
    });
  } catch (error) {
    console.error("Error di getDosenKetersediaanPeriode:", error);
    return res.status(500).json({ success: false, message: "Gagal memuat ketersediaan dosen.", error: error.message });
  }
};

// PUT /api/sekretaris/master-dosen/ketersediaan
exports.saveDosenKetersediaanPeriode = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const periodeId = Number(req.body?.periode_penjaluran_id);
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [req.body];
    const periode = await PeriodePenjaluran.findByPk(periodeId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!periode) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: "Periode tidak ditemukan." });
    }
    if (periode.status !== "active" || periode.is_active !== true) {
      await transaction.rollback();
      return res.status(409).json({ success: false, message: "Ketersediaan hanya dapat diubah pada periode aktif." });
    }

    const savedRows = [];
    for (const input of rows) {
      const dosenId = Number(input?.dosen_id);
      if (!Number.isInteger(dosenId) || dosenId <= 0 || typeof input?.tersedia_membimbing !== "boolean") {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: "Dosen dan nilai menerima bimbingan baru wajib valid." });
      }
      const dosen = await Dosen.findByPk(dosenId, { transaction, attributes: ["id", "nama", "status_keaktifan"] });
      if (!dosen) {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: `Dosen ID ${dosenId} tidak ditemukan.` });
      }

      if (dosen.status_keaktifan !== "active" && input.tersedia_membimbing === true) {
        await transaction.rollback();
        return res.status(409).json({
          success: false,
          message: `${dosen.nama} dikunci oleh status master ${dosen.status_keaktifan} dan tidak dapat dikonfigurasi.`,
        });
      }

      const reviewerId = getSekretarisActorId(req);
      const values = {
        tersedia_membimbing: dosen.status_keaktifan === "active" && input.tersedia_membimbing === true,
        updated_by_sekretaris_id: reviewerId,
        configuration_status: dosen.status_keaktifan === "active" ? "ready" : "locked_by_master_status",
        reviewed_at: new Date(),
        reviewed_by_sekretaris_id: reviewerId,
        review_note: "Diperbarui pada periode aktif",
      };

      let record = await DosenKetersediaanPeriode.findOne({
        where: { dosen_id: dosenId, periode_penjaluran_id: periodeId },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      const previousValue = record ? Boolean(record.tersedia_membimbing) : null;
      if (record) {
        await record.update(values, { transaction });
      } else {
        record = await DosenKetersediaanPeriode.create({
          dosen_id: dosenId,
          periode_penjaluran_id: periodeId,
          ...values,
        }, { transaction });
      }
      if (previousValue !== values.tersedia_membimbing) {
        await RiwayatKetersediaanMembimbing.create({
          dosen_id: dosenId,
          periode_penjaluran_id: periodeId,
          tersedia_sebelumnya: previousValue,
          tersedia_baru: values.tersedia_membimbing,
          changed_by_sekretaris_id: reviewerId,
          sumber_perubahan: "manual_update",
        }, { transaction });
      }
      savedRows.push(record);
    }
    await transaction.commit();
    return res.json({ success: true, message: `Ketersediaan ${savedRows.length} dosen berhasil disimpan.`, data: savedRows });
  } catch (error) {
    await transaction.rollback();
    console.error("Error di saveDosenKetersediaanPeriode:", error);
    return res.status(500).json({ success: false, message: "Gagal menyimpan ketersediaan dosen.", error: error.message });
  }
};

exports.getTindakLanjutStatusDosen = async (req, res) => {
  try {
    const showResolved = req.query.status === "resolved";
    const rows = await TindakLanjutStatusDosen.findAll({
      where: showResolved ? { status: "resolved" } : { status: "open" },
      include: [
        { model: Dosen, as: "dosen", attributes: ["id", "kode_dosen", "nik", "nama", "gelar", "status_keaktifan", "continue_existing_supervision"], required: true },
        { model: RiwayatStatusDosen, as: "riwayatStatus", attributes: ["status_sebelumnya", "status_baru"], required: false },
      ],
      order: [["createdAt", "DESC"]],
    });
    return res.json({ success: true, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Gagal memuat tindak lanjut status dosen.", error: error.message });
  }
};

function evaluateFollowUpRow(row, remainingImpact) {
  const currentStatus = row?.dosen?.status_keaktifan || row?.riwayatStatus?.status_baru || "active";
  const previousStatus = row?.riwayatStatus?.status_sebelumnya
    || (row?.impact_snapshot?.reactivation_required ? "inactive" : currentStatus);
  return evaluateDosenStatusFollowUp({
    statusBaru: currentStatus,
    statusLama: previousStatus,
    continueExisting: row?.dosen?.continue_existing_supervision === true,
    impact: remainingImpact,
  });
}

function buildFollowUpResolutionContext(row, remainingImpact) {
  const evaluation = evaluateFollowUpRow(row, remainingImpact);
  const requiredCategories = [];
  if (evaluation.replacement_required) requiredCategories.push("mahasiswa_bimbingan");
  if (evaluation.review_transfer_required) requiredCategories.push("review_pending");
  if (evaluation.role_adjustment_required) requiredCategories.push("penugasan_periode");
  if (evaluation.defense_adjustment_required) requiredCategories.push("jadwal_sidang");
  return { remainingImpact, requiredCategories, evaluation };
}

exports.getTindakLanjutStatusDosenCurrentImpact = async (req, res) => {
  try {
    const row = await TindakLanjutStatusDosen.findByPk(req.params.id, {
      include: [
        { model: Dosen, as: "dosen", attributes: ["id", "kode_dosen", "nik", "nama", "gelar", "status_keaktifan", "continue_existing_supervision"] },
        { model: RiwayatStatusDosen, as: "riwayatStatus", attributes: ["status_sebelumnya", "status_baru"], required: false },
      ],
    });
    if (!row) return res.status(404).json({ success: false, message: "Tindak lanjut tidak ditemukan." });
    if (row.status !== "open") return res.status(409).json({ success: false, message: "Tindak lanjut ini sudah diselesaikan." });

    const remainingImpact = await analyzeDosenStatusImpact(row.dosen_id);
    const context = buildFollowUpResolutionContext(row, remainingImpact);
    const supervisedMahasiswaIds = await getSupervisedMahasiswaIdsWithLegacyFallback(row.dosen_id);
    const affectedMahasiswa = await Mahasiswa.findAll({
      where: {
        id: { [Op.in]: supervisedMahasiswaIds },
        [Op.or]: [
          { status_jalur_saat_ini: { [Op.ne]: "selesai" } },
          { status_jalur_saat_ini: null },
        ],
      },
      attributes: ["id", "nim", "nama", "email", "status_jalur_saat_ini"],
      order: [["nama", "ASC"]],
    });
    const replacementRequired = !canContinueExistingSupervision(row.dosen);
    const activePeriod = await PeriodePenjaluran.findOne({
      where: { status: "active", is_active: true },
      attributes: ["id", "label_periode", "tahun_akademik", "semester"],
      order: [["createdAt", "DESC"]],
    });
    const availabilityRows = replacementRequired && activePeriod
      ? await DosenKetersediaanPeriode.findAll({
          where: {
            periode_penjaluran_id: activePeriod.id,
            tersedia_membimbing: true,
            configuration_status: "ready",
          },
           include: [{
             model: Dosen,
             as: "dosen",
             required: true,
             where: { status_keaktifan: "active" },
             attributes: ["id", "kode_dosen", "nik", "nama", "gelar", "email", "kuota_bimbingan"],
             include: [{
               model: Klaster,
               as: "klasters",
               attributes: ["id", "kode", "nama"],
               through: { attributes: [] },
               required: false,
             }],
           }],
          order: [[{ model: Dosen, as: "dosen" }, "nama", "ASC"]],
        })
      : [];
    const replacementCandidates = await Promise.all(availabilityRows
      .filter((availability) => Number(availability.dosen_id) !== Number(row.dosen_id))
      .map(async (availability) => {
        const load = await getActiveSupervisionLoad(availability.dosen_id);
        const kuota = Number(availability.dosen?.kuota_bimbingan || 0);
        return {
          id: availability.dosen.id,
          kode_dosen: availability.dosen.kode_dosen,
          nik: availability.dosen.nik,
          nama: availability.dosen.nama,
          gelar: availability.dosen.gelar,
          email: availability.dosen.email,
           kuota,
           terpakai: Number(load.total || 0),
           sisa: Math.max(kuota - Number(load.total || 0), 0),
           reservasi_penggantian: Number(load.reservasi_penggantian || 0),
           cluster_codes: [...new Set((availability.dosen.klasters || [])
             .map((klaster) => resolveResearchClusterCode(klaster))
             .filter(Boolean))],
         };
       }));
    const affectedWithAccess = await Promise.all(affectedMahasiswa.map(async (mahasiswa) => {
      const [supervisionAccess, cluster] = await Promise.all([
        getMahasiswaSupervisionAccess(mahasiswa.id),
        resolveMahasiswaReplacementCluster(mahasiswa.id),
      ]);
      const candidates = cluster
        ? replacementCandidates.filter((candidate) => candidate.sisa > 0 && candidate.cluster_codes.includes(cluster.code))
        : [];
      return {
        ...mahasiswa.toJSON(),
        supervision_status: replacementRequired ? supervisionAccess.status : "active",
        replacement: replacementRequired ? supervisionAccess.replacement : null,
        replacement_cluster: cluster,
        replacement_candidates: candidates.map(({ cluster_codes, ...candidate }) => candidate),
      };
    }));
    const blockingReplacementCount = replacementRequired
      ? affectedWithAccess.filter((mahasiswa) => mahasiswa.supervision_status !== "active").length
      : 0;
    const hasOtherImpacts = context.requiredCategories.some((category) => category !== "mahasiswa_bimbingan");
    const canResolve = context.requiredCategories.length === 0 && blockingReplacementCount === 0;
    const blockingLabels = {
      mahasiswa_bimbingan: "penggantian pembimbing mahasiswa",
      review_pending: "pengalihan review/pengajuan",
      penugasan_periode: "penggantian penanggung jawab periode",
      jadwal_sidang: "penyesuaian jadwal sidang",
    };
    return res.json({
      success: true,
      data: {
        id: row.id,
        dosen: row.dosen || null,
        current_impact: context.remainingImpact,
        required_categories: context.requiredCategories,
        reactivation_required: Boolean(row.impact_snapshot?.reactivation_required),
        affected_mahasiswa: affectedWithAccess,
        replacement_context: {
          required: replacementRequired,
          active_period: activePeriod || null,
          candidates: [],
        },
        resolution_status: {
          can_resolve: canResolve,
          blocking_count: blockingReplacementCount,
          has_other_impacts: hasOtherImpacts,
          blocking_categories: context.requiredCategories,
          blocking_message: canResolve
            ? null
            : `Masih ada dampak yang harus diselesaikan: ${context.requiredCategories.map((category) => blockingLabels[category] || category).join(", ")}.`,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Gagal menganalisis dampak terbaru.", error: error.message });
  }
};

exports.activateDosenStatusReplacement = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const followUpId = Number(req.params.followUpId);
    const mahasiswaId = Number(req.params.mahasiswaId);
    const periodeId = Number(req.body?.periode_penjaluran_id);
    const dosenIds = [...new Set((Array.isArray(req.body?.dosen_pembimbing_ids)
      ? req.body.dosen_pembimbing_ids
      : []).map(Number).filter((id) => Number.isInteger(id) && id > 0))];
    const tanggalMulai = String(req.body?.tanggal_mulai || "").trim();
    const catatan = String(req.body?.catatan || "").trim() || null;

    if (!followUpId || !mahasiswaId || !periodeId || dosenIds.length < 1 || dosenIds.length > 2) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Tindak lanjut, mahasiswa, periode, dan satu atau dua pembimbing pengganti wajib valid.",
      });
    }
    if (!tanggalMulai) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: "Tanggal efektif wajib diisi." });
    }
    if (tanggalMulai > getJakartaDateOnly()) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Tanggal efektif tidak boleh menggunakan tanggal mendatang.",
      });
    }

    const followUp = await TindakLanjutStatusDosen.findByPk(followUpId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!followUp || followUp.status !== "open") {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: "Tindak lanjut aktif tidak ditemukan." });
    }
    const followUpDosen = await Dosen.findByPk(followUp.dosen_id, {
      attributes: ["id", "nama", "status_keaktifan", "continue_existing_supervision"],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!followUpDosen) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: "Dosen pada tindak lanjut tidak ditemukan." });
    }
    if (canContinueExistingSupervision(followUpDosen)) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: "Dosen saat ini masih diizinkan melanjutkan bimbingan sehingga penggantian wajib tidak diperlukan.",
      });
    }
    if (dosenIds.includes(Number(followUp.dosen_id))) {
      await transaction.rollback();
      return res.status(409).json({ success: false, message: "Dosen lama tidak boleh dipilih sebagai pembimbing pengganti." });
    }

    const mahasiswa = await Mahasiswa.findOne({
      where: {
        id: mahasiswaId,
        [Op.or]: [
          { status_jalur_saat_ini: { [Op.ne]: "selesai" } },
          { status_jalur_saat_ini: null },
        ],
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!mahasiswa) {
      await transaction.rollback();
      return res.status(409).json({ success: false, message: "Mahasiswa tidak lagi tercatat sebagai mahasiswa terdampak dosen ini." });
    }
    if (!(await isActiveSupervisor(followUp.dosen_id, mahasiswa.id, transaction))) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: "Mahasiswa tidak lagi memiliki penetapan aktif dengan dosen terdampak ini.",
      });
    }

    const replacementCluster = await resolveMahasiswaReplacementCluster(mahasiswa.id, transaction);
    if (!replacementCluster) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: "Klaster atau bidang mahasiswa belum dapat ditentukan dari pengajuan terakhir. Lengkapi data klaster sebelum memilih pembimbing pengganti.",
      });
    }
    const selectedReplacementDosens = await Dosen.findAll({
      where: { id: { [Op.in]: dosenIds } },
      attributes: ["id", "nama"],
      include: [{
        model: Klaster,
        as: "klasters",
        attributes: ["id", "kode", "nama"],
        through: { attributes: [] },
        required: false,
      }],
      transaction,
    });
    const invalidClusterDosens = selectedReplacementDosens.filter((dosen) => !(dosen.klasters || [])
      .some((klaster) => resolveResearchClusterCode(klaster) === replacementCluster.code));
    if (selectedReplacementDosens.length !== dosenIds.length || invalidClusterDosens.length > 0) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: `Pembimbing pengganti wajib berasal dari klaster ${replacementCluster.code} (${replacementCluster.label}).`,
        detail: {
          cluster: replacementCluster,
          invalid_dosen_ids: invalidClusterDosens.map((dosen) => dosen.id),
        },
      });
    }

    const periode = await PeriodePenjaluran.findOne({
      where: { id: periodeId, status: "active", is_active: true },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!periode) {
      await transaction.rollback();
      return res.status(409).json({ success: false, message: "Periode aktif untuk penggantian pembimbing tidak ditemukan." });
    }

    const previousAssignment = await getActiveSupervisorAssignment(mahasiswa.id, transaction);
    const previousMembers = previousAssignment?.penetapan?.pembimbings || [];

    const existingDraft = await PenetapanPembimbing.findOne({
      where: { mahasiswa_id: mahasiswaId, status: "draft", sumber_data: "pergantian" },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (existingDraft) {
      await existingDraft.update({
        status: "cancelled",
        alasan_berakhir: "Digantikan oleh aktivasi pembimbing pengganti langsung.",
      }, { transaction });
    }

    const pendaftaran = await PendaftaranPenjaluran.findOne({
      where: { mahasiswa_id: mahasiswaId },
      order: [["createdAt", "DESC"]],
      transaction,
    });
    const actorId = getSekretarisActorId(req);
    const draft = await createDraftSupervisorAssignment({
      mahasiswaId,
      pendaftaranPenjaluranId: pendaftaran?.id || null,
      periodeMulaiId: periode.id,
      dosenPembimbingIds: dosenIds,
      sumberData: "pergantian",
      catatanPergantian: catatan,
      tanggalMulai,
      createdBySekretarisId: actorId,
      transaction,
    });
    const activeAssignment = await activateSupervisorAssignment({
      penetapanId: draft.id,
      tanggalMulai,
      transaction,
    });
    const notificationResult = await createSupervisorReplacementNotifications({
      assignmentId: draft.id,
      mahasiswa,
      previousMembers,
      newMembers: activeAssignment?.penetapan?.pembimbings || [],
      effectiveDate: tanggalMulai,
      assignmentSource: "pergantian",
      transaction,
    });

    const remainingImpact = await analyzeDosenStatusImpact(followUp.dosen_id, transaction);
    const remainingEvaluation = evaluateFollowUpRow({
      dosen: followUpDosen,
      impact_snapshot: followUp.impact_snapshot,
    }, remainingImpact);
    const hasRemainingStudent = remainingEvaluation.replacement_required;
    const hasOtherImpact = remainingEvaluation.reasons
      .some((reason) => reason !== "supervisor_replacement");
    const followUpResolved = !hasRemainingStudent && !hasOtherImpact;

    if (followUpResolved) {
      await followUp.update({
        status: "resolved",
        catatan_penyelesaian: null,
        resolution_type: "resolved",
        resolution_decisions: {},
        remaining_impact_snapshot: remainingImpact,
        resolved_by_sekretaris_id: actorId,
        resolved_at: new Date(),
      }, { transaction });
    } else {
      await followUp.update({ remaining_impact_snapshot: remainingImpact }, { transaction });
    }

    await transaction.commit();
    return res.status(201).json({
      success: true,
      message: followUpResolved
        ? "Pembimbing pengganti aktif dan tindak lanjut selesai."
        : "Pembimbing pengganti berhasil diaktifkan.",
      data: {
        assignment: toAssignmentResponse(activeAssignment?.penetapan),
        follow_up_resolved: followUpResolved,
        remaining_impact: remainingImpact,
        notifications: {
          student: notificationResult.student,
          assigned_lecturers: notificationResult.assigned,
          ended_lecturers: notificationResult.ended,
          updated_lecturers: notificationResult.updated,
        },
      },
    });
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : "Gagal mengaktifkan pembimbing pengganti.",
      error: error.message,
      detail: error.detail || null,
    });
  }
};

exports.createDosenStatusReplacementDraft = exports.activateDosenStatusReplacement;
exports.resolveTindakLanjutStatusDosen = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const note = String(req.body?.catatan_tindak_lanjut || "").trim();
    if (note.length > 1000) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Catatan tindak lanjut maksimal 1000 karakter.",
      });
    }
    const row = await TindakLanjutStatusDosen.findByPk(req.params.id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!row) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: "Tindak lanjut tidak ditemukan." });
    }
    if (row.status !== "open") {
      await transaction.rollback();
      return res.status(409).json({ success: false, message: "Tindak lanjut ini sudah diselesaikan." });
    }
    const dosen = await Dosen.findByPk(row.dosen_id, {
      attributes: ["id", "status_keaktifan", "continue_existing_supervision"],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!dosen) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: "Dosen pada tindak lanjut tidak ditemukan." });
    }

    const remainingImpact = await analyzeDosenStatusImpact(row.dosen_id, transaction);
    const resolutionContext = buildFollowUpResolutionContext({
      ...row.toJSON(),
      dosen: dosen.toJSON(),
    }, remainingImpact);
    if (resolutionContext.evaluation.required) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        code: "FOLLOW_UP_IMPACT_REMAINS",
        message: "Tindak lanjut belum dapat diselesaikan karena masih ada dampak operasional yang belum selesai.",
        detail: {
          remaining_impact: remainingImpact,
          required_categories: resolutionContext.requiredCategories,
        },
      });
    }
    const actorId = req.user.sekretaris_prodi_id
      || (req.user.role === "sekretaris_prodi" ? req.user.id : null);
    await row.update({
      status: "resolved",
      catatan_penyelesaian: note || null,
      resolution_type: "resolved",
      resolution_decisions: {},
      remaining_impact_snapshot: remainingImpact,
      resolved_by_sekretaris_id: actorId,
      resolved_at: new Date(),
    }, { transaction });
    await transaction.commit();
    return res.json({
      success: true,
      message: "Tindak lanjut ditandai selesai.",
      data: row,
    });
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    return res.status(500).json({ success: false, message: "Gagal menyelesaikan tindak lanjut.", error: error.message });
  }
};

// POST /api/sekretaris/periode/open - membuat periode langsung aktif secara atomik.
exports.openPeriodePendaftaran = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const validation = await validatePeriodeSetupPayload(req.body || {}, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!validation.valid) {
      await transaction.rollback();
      const firstError = Object.values(validation.errors || {}).find(Boolean);
      return res.status(400).json({
        success: false,
        message: firstError
          ? `Persiapan periode belum valid: ${firstError}`
          : "Persiapan periode belum valid. Tidak ada data yang disimpan.",
        detail: validation.errors,
      });
    }

    const actorId = getSekretarisActorId(req);
    const ketuaPenelitianDosenId = validation.rolePayload.ketua_itsc_dosen_id;
    const periodValues = {
      tahun_akademik: validation.periode.tahun_akademik,
      semester: validation.periode.semester,
      label_periode: validation.periode.label_periode,
      tanggal_mulai: validation.periode.tanggalMulai,
      tanggal_selesai: validation.periode.tanggalSelesai,
      ketua_penelitian_dosen_id: ketuaPenelitianDosenId,
      pengawas_magang_dosen_id: validation.rolePayload.pengawas_magang_dosen_id,
      pengawas_pengabdian_dosen_id: validation.rolePayload.pengawas_pengabdian_dosen_id,
      pengawas_perintisan_bisnis_dosen_id: validation.rolePayload.pengawas_perintisan_bisnis_dosen_id,
      status: "active",
      is_active: true,
    };
    const periode = await PeriodePenjaluran.create(periodValues, { transaction });

    await KlasterKetuaPeriode.bulkCreate(validation.ketuaMappings.map((item) => ({
      klaster_id: item.klaster.id,
      dosen_id: item.dosenId,
      periode_penjaluran_id: periode.id,
      assigned_by_sekretaris_id: actorId,
    })), { transaction });

    const now = new Date();
    for (const item of validation.availability) {
      const availabilityValues = {
        tersedia_membimbing: item.tersedia_membimbing,
        configuration_status: item.configuration_status,
        reviewed_at: now,
        reviewed_by_sekretaris_id: actorId,
        updated_by_sekretaris_id: actorId,
        review_note: "Ditetapkan saat pembukaan periode",
      };
      const [availabilityRow, created] = await DosenKetersediaanPeriode.findOrCreate({
        where: {
          dosen_id: item.dosen_id,
          periode_penjaluran_id: periode.id,
        },
        defaults: availabilityValues,
        transaction,
      });
      if (!created) await availabilityRow.update(availabilityValues, { transaction });
    }

    await RiwayatKetersediaanMembimbing.bulkCreate(validation.availability.map((item) => ({
      dosen_id: item.dosen_id,
      periode_penjaluran_id: periode.id,
      tersedia_sebelumnya: null,
      tersedia_baru: item.tersedia_membimbing,
      changed_by_sekretaris_id: actorId,
      sumber_perubahan: "period_opening",
    })), { transaction });

    await transaction.commit();
    return res.status(201).json({
      success: true,
      message: `Pendaftaran periode ${periode.label_periode} berhasil dibuka.`,
      data: { periode, summary: validation.summary },
    });
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    console.error("Error di openPeriodePendaftaran:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal membuka periode. Seluruh perubahan dibatalkan.",
      error: error.message,
    });
  }
};

// PATCH /api/sekretaris/periode/:id/tanggal
exports.updatePeriodeTanggal = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const periodeId = Number(req.params.id);
    if (!periodeId) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "ID periode tidak valid.",
      });
    }

    const periode = await PeriodePenjaluran.findByPk(periodeId, { transaction: t });
    if (!periode) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Periode tidak ditemukan.",
      });
    }

    if (getPeriodeStatusLabel(periode) === "closed") {
      await t.rollback();
      return res.status(409).json({
        success: false,
        message: "Tanggal periode yang sudah ditutup tidak dapat diubah.",
      });
    }

    const tanggalMulaiRaw = normalizeText(req.body?.tanggal_mulai);
    const tanggalSelesaiRaw = normalizeText(req.body?.tanggal_selesai);
    const tanggalMulai = parseInputDateForJakarta(tanggalMulaiRaw, "start");
    const tanggalSelesai = parseInputDateForJakarta(tanggalSelesaiRaw, "end");

    if ((tanggalMulaiRaw && Number.isNaN(tanggalMulai?.getTime())) || (tanggalSelesaiRaw && Number.isNaN(tanggalSelesai?.getTime()))) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Format tanggal_mulai/tanggal_selesai tidak valid.",
      });
    }
    if (tanggalMulai && tanggalSelesai && tanggalMulai.getTime() > tanggalSelesai.getTime()) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "tanggal_mulai tidak boleh lebih besar dari tanggal_selesai.",
      });
    }

    periode.tanggal_mulai = tanggalMulai;
    periode.tanggal_selesai = tanggalSelesai;
    await periode.save({ transaction: t });

    await t.commit();
    return res.json({
      success: true,
      message: "Tanggal periode berhasil diperbarui.",
      data: periode,
    });
  } catch (error) {
    if (!t.finished) await t.rollback();
    console.error("Error di updatePeriodeTanggal:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// POST /api/sekretaris/periode/:id/close
exports.closePeriodeById = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const periodeId = Number(req.params.id);
    if (!periodeId) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "ID periode tidak valid.",
      });
    }

    const periode = await PeriodePenjaluran.findByPk(periodeId, { transaction: t });
    if (!periode) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Periode tidak ditemukan.",
      });
    }

    if (getPeriodeStatusLabel(periode) !== "active") {
      await t.rollback();
      return res.status(409).json({
        success: false,
        message: "Periode ini sudah nonaktif.",
      });
    }

    periode.is_active = false;
    periode.status = "closed";
    await periode.save({ transaction: t });
    await cancelPamitsForClosedPeriod(periode.id, t);

    await t.commit();
    return res.json({
      success: true,
      message: `Periode ${periode.label_periode} berhasil ditutup.`,
      data: {
        closed_periode: {
          id: periode.id,
          label_periode: periode.label_periode,
          tahun_akademik: periode.tahun_akademik,
          semester: periode.semester,
        },
      },
    });
  } catch (error) {
    if (!t.finished) await t.rollback();
    console.error("Error di closePeriodeById:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

function getPenelitianFinalIncludes(programKuliah = null) {
  return [
    {
      model: Mahasiswa,
      as: "mahasiswa",
      attributes: ["id", "nim", "nama", "email", "angkatan"],
      required: true,
    },
    {
      model: Dosen,
      as: "prospectiveSupervisor",
      attributes: ["id", "nik", "nama", "gelar", "email"],
      required: false,
    },
    ...["dosen1", "dosen2", "dosen3"].map((association) => ({
      model: Dosen,
      as: association,
      attributes: ["id", "nik", "nama", "gelar", "email"],
      required: false,
    })),
    {
      model: PendaftaranPenjaluran,
      as: "pendaftaranPenjaluran",
      attributes: ["id", "program_kuliah", "jalur", "jenis_jalur_diambil", "penjaluran_baru"],
      where: programKuliah ? { program_kuliah: programKuliah } : undefined,
      required: Boolean(programKuliah),
    },
    {
      model: RiwayatPersetujuan,
      as: "riwayat",
      attributes: [
        "id",
        "dosen_id",
        "sekretaris_prodi_id",
        "tipe_approval",
        "topik_slot",
        "topik_kode",
        "status",
        "keterangan",
        "tanggal_keputusan",
        "createdAt",
      ],
      include: [
        {
          model: Dosen,
          as: "dosen",
          attributes: ["id", "nik", "nama", "gelar", "email"],
          required: false,
        },
        {
          model: SekretarisProdi,
          as: "sekretarisProdi",
          attributes: ["id", "nik", "nama", "email"],
          required: false,
        },
      ],
      required: false,
    },
  ];
}

async function linkOrphanResearchSubmissionsToRegistration(transaction = null) {
  const orphanRows = await Pengajuan.findAll({
    where: {
      pendaftaran_penjaluran_id: null,
      tipe_pengajuan: { [Op.in]: ["topik_dosen", "judul_mandiri"] },
      status: {
        [Op.in]: ["pending", "menunggu_set_ketua_cluster", "menunggu_approval_sekprodi"],
      },
    },
    attributes: ["id", "mahasiswa_id", "createdAt"],
    order: [["createdAt", "ASC"]],
    transaction: transaction || undefined,
  });

  let linkedCount = 0;
  for (const submission of orphanRows) {
    const pendaftaran = await resolveResearchSubmissionRegistration(submission, transaction);
    if (!pendaftaran) continue;

    await submission.update(
      { pendaftaran_penjaluran_id: pendaftaran.id },
      { transaction: transaction || undefined }
    );
    linkedCount += 1;
  }

  return linkedCount;
}

function getFinalResearchWinner(submission) {
  if (submission.tipe_pengajuan === "topik_dosen") {
    return evaluateTopikSekprodiReviewState(submission).sekprodi_pending_slots[0] || null;
  }

  if (submission.tipe_pengajuan === "judul_mandiri" && submission.prospective_supervisor_id) {
    return {
      slot: null,
      kode: null,
      judul: submission.judul_mandiri,
      dosen_id: Number(submission.prospective_supervisor_id),
      dosen_nama: submission.prospectiveSupervisor?.nama || null,
      dosen_gelar: submission.prospectiveSupervisor?.gelar || null,
    };
  }

  return null;
}

function formatPenelitianFinalRow(submission) {
  const riwayat = Array.isArray(submission.riwayat) ? submission.riwayat : [];
  const state =
    submission.tipe_pengajuan === "topik_dosen"
      ? evaluateTopikParallelState(submission)
      : null;
  const clusterState =
    submission.tipe_pengajuan === "topik_dosen"
      ? evaluateTopikClusterReviewState(submission)
      : null;
  const sekprodiState =
    submission.tipe_pengajuan === "topik_dosen"
      ? evaluateTopikSekprodiReviewState(submission)
      : null;
  const ketuaDecision = riwayat
    .filter(
      (item) =>
        String(item.tipe_approval || "").toLowerCase() === "koordinator" &&
        String(item.status || "").toLowerCase() === "approved"
    )
    .sort(
      (left, right) =>
        new Date(right.tanggal_keputusan || right.createdAt || 0).getTime() -
        new Date(left.tanggal_keputusan || left.createdAt || 0).getTime()
    )[0];
  const winner = getFinalResearchWinner(submission);
  const topik =
    submission.tipe_pengajuan === "topik_dosen"
      ? (state?.slot_decisions || []).map((item) => ({
          ...(clusterState?.cluster_decisions_by_slot.get(Number(item.slot))?.row
            ? {
                status_ketua_cluster: clusterState.cluster_decisions_by_slot.get(Number(item.slot)).status,
                catatan_ketua_cluster:
                  clusterState.cluster_decisions_by_slot.get(Number(item.slot)).row.keterangan || null,
                ketua_cluster:
                  clusterState.cluster_decisions_by_slot.get(Number(item.slot)).row.dosen || null,
                tanggal_keputusan_ketua:
                  clusterState.cluster_decisions_by_slot.get(Number(item.slot)).row.tanggal_keputusan ||
                  clusterState.cluster_decisions_by_slot.get(Number(item.slot)).row.createdAt ||
                  null,
              }
            : {
                status_ketua_cluster: "pending",
                catatan_ketua_cluster: null,
                ketua_cluster: null,
                tanggal_keputusan_ketua: null,
              }),
          slot: item.slot,
          kode: item.kode,
          judul: item.judul,
          dosen_id: item.dosen_id,
          dosen_nama: item.dosen_nama,
          dosen_gelar: submission[`dosen${Number(item.slot)}`]?.gelar || null,
          status: item.reviewer_status,
          catatan: item.reviewer_note || null,
          dipilih: Number(item.slot) === Number(winner?.slot),
          status_sekprodi: sekprodiState?.sekprodi_decisions_by_slot.get(Number(item.slot))?.status || null,
          catatan_sekprodi:
            sekprodiState?.sekprodi_decisions_by_slot.get(Number(item.slot))?.row?.keterangan || null,
        }))
      : [
          {
            slot: null,
            kode: null,
            judul: submission.judul_mandiri,
            dosen_id: Number(submission.prospective_supervisor_id || 0) || null,
            dosen_nama: submission.prospectiveSupervisor?.nama || null,
            dosen_gelar: submission.prospectiveSupervisor?.gelar || null,
            status: submission.is_approved_by_supervisor ? "approved" : "pending",
            catatan: null,
            dipilih: true,
          },
        ];

  const workflow = normalizeWorkflow({
    status: submission.status,
    timeline: riwayat.map((item) => ({
      status: item.status,
      actor: item.tipe_approval,
      actor_id: item.dosen_id || item.sekretaris_prodi_id || null,
      note: item.keterangan || null,
      at: item.tanggal_keputusan || item.createdAt,
    })),
    actor: submission.status === "menunggu_approval_sekprodi" ? "sekretaris_prodi" : "ketua_cluster",
    allowedActions: ["pending", "menunggu_approval_sekprodi"].includes(submission.status)
      ? ["approve", "reject"]
      : [],
    blockingReasons: submission.status === "rejected" ? [submission.alasan_penolakan || "Pengajuan ditolak."] : [],
  });
  return {
    id: submission.id,
    jenis_jalur: submission.jenis_jalur,
    tipe_pengajuan: submission.tipe_pengajuan,
    status: submission.status,
    program_kuliah: submission.pendaftaranPenjaluran?.program_kuliah || "reguler",
    cluster_penelitian: submission.cluster_mandiri || null,
    diajukan_pada: submission.createdAt,
    diperbarui_pada: submission.updatedAt,
    mahasiswa: submission.mahasiswa || null,
    topik,
    topik_lolos_cluster:
      submission.tipe_pengajuan === "topik_dosen"
        ? topik.filter((item) => item.status_ketua_cluster === "approved" && item.status_sekprodi === "pending")
        : topik,
    topik_terpilih: winner,
    ketua_cluster: ketuaDecision?.dosen || null,
    keputusan_ketua_cluster: ketuaDecision
      ? {
          catatan: ketuaDecision.keterangan || null,
          tanggal: ketuaDecision.tanggal_keputusan || ketuaDecision.createdAt,
        }
      : null,
    riwayat_persetujuan: riwayat.map((item) => ({
      status: item.status,
      tipe_approval: item.tipe_approval,
      topik_slot: item.topik_slot,
      topik_kode: item.topik_kode,
      keterangan: item.keterangan,
      tanggal_keputusan: item.tanggal_keputusan || item.createdAt,
      dosen: item.dosen || null,
      sekretaris_prodi: item.sekretarisProdi || null,
    })),
    ...workflow,
  };
}

async function loadPenelitianFinalSubmission(id, programKuliah, transaction = null, lock = false) {
  await linkOrphanResearchSubmissionsToRegistration(transaction);

  const where = {
    id,
    status: { [Op.in]: ["pending", "menunggu_approval_sekprodi", "approved", "rejected"] },
    tipe_pengajuan: { [Op.in]: ["topik_dosen", "judul_mandiri"] },
  };

  if (transaction && lock) {
    const locked = await Pengajuan.findOne({
      where,
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!locked) return null;
  }

  return Pengajuan.findOne({
    where,
    include: getPenelitianFinalIncludes(programKuliah),
    transaction: transaction || undefined,
  });
}

async function assertResearchSupervisorCluster(supervisorIds, clusterCode, transaction) {
  const normalizedCode = normalizeTopikClusterCode(clusterCode);
  if (!normalizedCode || !RESEARCH_CLUSTER_CODES.includes(normalizedCode)) {
    const error = new Error("Klaster penelitian final belum dapat ditentukan.");
    error.statusCode = 409;
    error.code = "RESEARCH_CLUSTER_NOT_RESOLVED";
    throw error;
  }
  const memberships = await DosenKlaster.findAll({
    where: { dosen_id: { [Op.in]: supervisorIds } },
    include: [{ model: Klaster, as: "klaster", attributes: ["kode", "nama"], required: true }],
    transaction,
  });
  const validDosenIds = new Set(
    memberships
      .filter((item) => resolveResearchClusterCode(item.klaster) === normalizedCode)
      .map((item) => Number(item.dosen_id))
  );
  const invalidIds = supervisorIds.filter((id) => !validDosenIds.has(Number(id)));
  if (invalidIds.length > 0) {
    const error = new Error(`Seluruh pembimbing wajib merupakan anggota klaster ${normalizedCode}.`);
    error.statusCode = 409;
    error.code = "SUPERVISOR_CLUSTER_MISMATCH";
    error.detail = { cluster: normalizedCode, dosen_ids: invalidIds };
    throw error;
  }
}

async function assertResearchSupervisorsAvailable(supervisorIds, registration, mahasiswaId, transaction) {
  const periodeId = Number(registration?.periode_penjaluran_id || 0);
  if (!periodeId) {
    const error = new Error("Periode pendaftaran penelitian tidak ditemukan.");
    error.statusCode = 409;
    error.code = "RESEARCH_REGISTRATION_PERIOD_NOT_RESOLVED";
    throw error;
  }

  for (const dosenId of supervisorIds) {
    const validation = await validateDosenForNewAssignment(dosenId, periodeId, {
      transaction,
      activityLabel: "bimbingan mahasiswa baru",
      excludeMahasiswaId: mahasiswaId,
    });
    if (validation.allowed) continue;

    const error = new Error(validation.message || "Dosen tidak dapat menerima bimbingan mahasiswa baru.");
    error.statusCode = 409;
    error.code = "RESEARCH_SUPERVISOR_NOT_AVAILABLE";
    error.detail = { dosen_id: Number(dosenId), reason: validation.reason || null };
    throw error;
  }
}

// GET /api/sekretaris/penelitian/final
exports.getPenelitianFinalQueue = async (req, res) => {
  try {
    await reconcilePendingTopikClusterReviews();
    await linkOrphanResearchSubmissionsToRegistration();
    const programKuliah = getSekretarisProgramKuliah(req);
    const rows = await Pengajuan.findAll({
      where: {
        status: { [Op.in]: ["pending", "menunggu_approval_sekprodi"] },
        tipe_pengajuan: { [Op.in]: ["topik_dosen", "judul_mandiri"] },
      },
      include: getPenelitianFinalIncludes(programKuliah),
      order: [["updatedAt", "ASC"]],
      distinct: true,
    });

    return res.json({
      success: true,
      data: rows
        .map(formatPenelitianFinalRow)
        .filter(
          (item) =>
            (item.tipe_pengajuan === "topik_dosen" && item.topik_lolos_cluster.length > 0) ||
            (item.tipe_pengajuan === "judul_mandiri" && item.status === "menunggu_approval_sekprodi")
        ),
    });
  } catch (error) {
    console.error("Error di getPenelitianFinalQueue:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal memuat pengajuan penelitian yang menunggu persetujuan final.",
      error: error.message,
    });
  }
};

// POST /api/sekretaris/penelitian/final/:id/approve
exports.approvePenelitianFinal = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const submission = await loadPenelitianFinalSubmission(
      Number(req.params.id),
      getSekretarisProgramKuliah(req),
      t,
      true
    );
    if (!submission) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Pengajuan tidak ditemukan atau sudah diproses.",
      });
    }
    if (submission.tipe_pengajuan === "judul_mandiri"
      && !["menunggu_approval_sekprodi", "approved", "rejected"].includes(submission.status)) {
      await t.rollback();
      return res.status(409).json({ success: false, message: "Pengajuan belum siap direview Sekprodi." });
    }

    const note = String(req.body?.keterangan || "").trim();
    if (!note) {
      await t.rollback();
      return res.status(400).json({ success: false, message: "Catatan keputusan wajib diisi." });
    }

    const primarySupervisorId = Number(req.body?.dosen_pembimbing_1_id || 0);
    const secondarySupervisorRaw = req.body?.dosen_pembimbing_2_id;
    const secondarySupervisorId = secondarySupervisorRaw ? Number(secondarySupervisorRaw) : null;
    if (!Number.isInteger(primarySupervisorId) || primarySupervisorId <= 0) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Pembimbing 1 wajib dipilih oleh sekretaris prodi.",
      });
    }
    if (secondarySupervisorRaw && (!Number.isInteger(secondarySupervisorId) || secondarySupervisorId <= 0)) {
      await t.rollback();
      return res.status(400).json({ success: false, message: "Pembimbing 2 tidak valid." });
    }
    const supervisorIds = [primarySupervisorId, secondarySupervisorId].filter(Boolean);
    if (new Set(supervisorIds).size !== supervisorIds.length) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Pembimbing 1 dan Pembimbing 2 harus merupakan dosen yang berbeda.",
      });
    }
    const assignmentRegistration = await resolveResearchSubmissionRegistration(submission, t);
    if (!assignmentRegistration) {
      await t.rollback();
      return res.status(409).json({ success: false, message: "Pendaftaran penelitian tidak ditemukan." });
    }
    if (["approved", "rejected"].includes(submission.status)) {
      if (submission.status === "rejected") {
        await t.rollback();
        return res.status(409).json({
          success: false,
          code: "IDEMPOTENCY_CONFLICT",
          message: "Pengajuan yang sudah ditolak tidak dapat disetujui melalui retry.",
        });
      }
      if (String(submission.alasan_persetujuan || "").trim() !== note) {
        await t.rollback();
        return res.status(409).json({
          success: false,
          code: "IDEMPOTENCY_CONFLICT",
          message: "Retry finalisasi memiliki catatan yang berbeda dari keputusan tersimpan.",
        });
      }
      if (submission.tipe_pengajuan === "topik_dosen") {
        const storedWinner = getFinalResearchWinner(submission);
        const requestedSlot = Number(req.body?.topik_slot || 0);
        if (!storedWinner?.slot || requestedSlot !== Number(storedWinner.slot)) {
          await t.rollback();
          return res.status(409).json({
            success: false,
            code: "IDEMPOTENCY_CONFLICT",
            message: "Retry finalisasi memilih topik yang berbeda dari keputusan tersimpan.",
          });
        }
      }
      const replay = await finalizePenjaluranDecision({
        registration: assignmentRegistration,
        track: "penelitian",
        decisionSource: submission,
        supervisorIds,
        currentDecisionStatus: submission.status,
        createdBySekretarisId: req.user?.sekretaris_prodi_id || null,
        transaction: t,
      });
      await t.commit();
      return res.json({
        success: true,
        replayed: replay.replayed,
        message: "Keputusan final yang sama sudah tersimpan sebelumnya.",
        data: { id: submission.id, status: submission.status },
      });
    }

    await assertResearchSupervisorsAvailable(
      supervisorIds,
      assignmentRegistration,
      submission.mahasiswa_id,
      t
    );

    let winner = getFinalResearchWinner(submission);
    let decisionTopikSlot = null;
    let sekprodiRow = null;
    if (submission.tipe_pengajuan === "topik_dosen") {
      const targetSlot = Number(req.body?.topik_slot);
      if (!Number.isInteger(targetSlot) || targetSlot <= 0) {
        await t.rollback();
        return res.status(400).json({ success: false, message: "Topik yang akan disetujui wajib dipilih." });
      }
      const state = evaluateTopikSekprodiReviewState(submission);
      winner = state.sekprodi_pending_slots.find((item) => Number(item.slot) === targetSlot) || null;
      sekprodiRow = (submission.riwayat || []).find(
        (item) =>
          String(item.tipe_approval || "").toLowerCase() === "sekprodi" &&
          Number(item.topik_slot) === targetSlot &&
          String(item.status || "").toLowerCase() === "pending"
      );
      if (!winner || !sekprodiRow) {
        await t.rollback();
        return res.status(409).json({
          success: false,
          message: "Topik ini belum siap direview Sekprodi atau sudah diproses.",
        });
      }
      decisionTopikSlot = targetSlot;
      await sekprodiRow.update(
        {
          status: "approved",
          keterangan: note,
          dosen_id: req.user?.role === "dosen" ? req.user.id : null,
          sekretaris_prodi_id: req.user?.sekretaris_prodi_id || null,
          tanggal_keputusan: new Date(),
        },
        { transaction: t }
      );
      await RiwayatPersetujuan.update(
        {
          status: "cancelled",
          keterangan: `Dibatalkan karena topik slot ${targetSlot} telah ditetapkan sebagai topik final.`,
          tanggal_keputusan: new Date(),
        },
        {
          where: {
            pengajuan_id: submission.id,
            status: "pending",
            [Op.or]: [{ topik_slot: { [Op.ne]: targetSlot } }, { topik_slot: null }],
          },
          transaction: t,
        }
      );
    }
    if (!winner) {
      await t.rollback();
      return res.status(409).json({
        success: false,
        message: "Topik penelitian final belum dapat ditentukan.",
      });
    }

    let clusterCode = await resolveSubmissionClusterCode(submission, t);
    if (winner.kode) {
      const winningTopic = await Topik.findOne({
        where: { kode: winner.kode },
        attributes: ["kode", "cluster"],
        transaction: t,
      });
      clusterCode = normalizeTopikClusterCode(winningTopic?.cluster)
        || normalizeTopikClusterCode(String(winner.kode).replace(/[0-9].*$/, ""))
        || clusterCode;
    }
    await assertResearchSupervisorCluster(supervisorIds, clusterCode, t);
    await finalizePenjaluranDecision({
      registration: assignmentRegistration,
      track: "penelitian",
      decisionSource: submission,
      decisionTopikSlot,
      supervisorIds,
      currentDecisionStatus: submission.status,
      createdBySekretarisId: req.user?.sekretaris_prodi_id || null,
      transaction: t,
    });

    await submission.update(
      {
        status: "approved",
        alasan_persetujuan: note || "Disetujui final oleh sekretaris prodi.",
        alasan_penolakan: null,
        dosen_saat_ini: primarySupervisorId,
      },
      { transaction: t }
    );

    if (submission.tipe_pengajuan === "topik_dosen" && winner.kode) {
      await Topik.update({ status: "taken" }, { where: { kode: winner.kode }, transaction: t });
      const releaseCodes = buildTopikListFromSubmission(submission)
        .map((item) => item.kode)
        .filter((kode) => kode && kode !== winner.kode);
      if (releaseCodes.length > 0) {
        await Topik.update(
          { status: "available" },
          {
            where: { kode: { [Op.in]: releaseCodes }, status: "reserved" },
            transaction: t,
          }
        );
      }
    }

    const dosenPembimbing = await Dosen.findByPk(primarySupervisorId, { transaction: t });
    const kuotaInfo =
      dosenPembimbing && typeof dosenPembimbing.getKuotaInfo === "function"
        ? await dosenPembimbing.getKuotaInfo(t)
        : null;
    if (kuotaInfo?.is_penuh) {
      await Topik.update(
        { status: "unavailable" },
        {
          where: { dosen_id: primarySupervisorId, status: "available" },
          transaction: t,
        }
      );
    }

    await t.commit();
    return res.json({
      success: true,
      replayed: false,
      message: "Pengajuan penelitian berhasil disetujui final.",
      data: { id: submission.id, status: "approved" },
    });
  } catch (error) {
    if (!t.finished) await t.rollback();
    console.error("Error di approvePenelitianFinal:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : "Gagal menyetujui pengajuan penelitian.",
      code: error.code || null,
      error: error.message,
      detail: error.detail || null,
    });
  }
};

// POST /api/sekretaris/penelitian/final/:id/reject
exports.rejectPenelitianFinal = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const reason = String(req.body?.keterangan || "").trim();
    if (!reason) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Alasan penolakan wajib diisi.",
      });
    }

    const submission = await loadPenelitianFinalSubmission(
      Number(req.params.id),
      getSekretarisProgramKuliah(req),
      t,
      true
    );
    if (!submission) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Pengajuan tidak ditemukan atau sudah diproses.",
      });
    }
    if (submission.tipe_pengajuan === "judul_mandiri" && submission.status !== "menunggu_approval_sekprodi") {
      await t.rollback();
      return res.status(409).json({ success: false, message: "Pengajuan belum siap direview Sekprodi." });
    }

    if (submission.tipe_pengajuan === "topik_dosen") {
      const targetSlot = Number(req.body?.topik_slot);
      if (!Number.isInteger(targetSlot) || targetSlot <= 0) {
        await t.rollback();
        return res.status(400).json({ success: false, message: "Topik yang akan ditolak wajib dipilih." });
      }
      const state = evaluateTopikSekprodiReviewState(submission);
      const rejectedTopik = state.sekprodi_pending_slots.find((item) => Number(item.slot) === targetSlot) || null;
      const sekprodiRow = (submission.riwayat || []).find(
        (item) =>
          String(item.tipe_approval || "").toLowerCase() === "sekprodi" &&
          Number(item.topik_slot) === targetSlot &&
          String(item.status || "").toLowerCase() === "pending"
      );
      if (!rejectedTopik || !sekprodiRow) {
        await t.rollback();
        return res.status(409).json({
          success: false,
          message: "Topik ini belum siap direview Sekprodi atau sudah diproses.",
        });
      }

      await sekprodiRow.update(
        {
          status: "rejected",
          keterangan: reason,
          dosen_id: req.user?.role === "dosen" ? req.user.id : null,
          sekretaris_prodi_id: req.user?.sekretaris_prodi_id || null,
          tanggal_keputusan: new Date(),
        },
        { transaction: t }
      );
      if (rejectedTopik.kode) {
        await Topik.update(
          { status: "available" },
          { where: { kode: rejectedTopik.kode, status: "reserved" }, transaction: t }
        );
      }

      const refreshedState = evaluateTopikSekprodiReviewState(submission);
      const pendingCluster = (submission.riwayat || []).filter(
        (item) =>
          String(item.tipe_approval || "").toLowerCase() === "koordinator" &&
          String(item.status || "").toLowerCase() === "pending"
      );
      const upstreamPending =
        refreshedState.pending_slots.length > 0 ||
        refreshedState.cluster_pending_slots.length > 0 ||
        pendingCluster.length > 0;
      const hasPendingSekprodi = refreshedState.sekprodi_pending_slots.length > 0;
      const allPipelinesFinished = refreshedState.can_finalize && !upstreamPending && !hasPendingSekprodi;

      if (allPipelinesFinished) {
        await submission.update(
          {
            status: "rejected",
            alasan_penolakan: "Seluruh topik telah ditolak pada rangkaian review.",
            alasan_persetujuan: null,
            dosen_saat_ini: null,
          },
          { transaction: t }
        );
        const mahasiswa = await Mahasiswa.findByPk(submission.mahasiswa_id, { transaction: t, lock: t.LOCK.UPDATE });
        if (mahasiswa) {
          const fallbackStatus =
            submission.jenis_jalur === "ulang"
              ? "ulang"
              : submission.jenis_jalur === "ekstensi"
              ? "ekstensi"
              : "belum_mengajukan";
          await mahasiswa.update(
            { status_jalur_saat_ini: fallbackStatus, pengajuan_aktif_id: null },
            { transaction: t }
          );
          await createSystemNotification({
            recipientType: "mahasiswa",
            recipientId: mahasiswa.id,
            type: NOTIFICATION_TYPES.PENJALURAN_FINAL_REJECTED_STUDENT,
            message: `Keputusan final Penelitian ditolak: ${reason}`,
            referenceType: "pengajuan_penelitian",
            referenceId: submission.id,
            actionKey: "student_path_status",
            metadata: { jalur: "penelitian", decision: "rejected" },
            deduplicationKey: `penjaluran:penelitian:${submission.id}:notification:final-rejected`,
            transaction: t,
          });
        }
      } else {
        await submission.update(
          {
            status: hasPendingSekprodi && !upstreamPending ? "menunggu_approval_sekprodi" : "pending",
            alasan_penolakan: reason,
            alasan_persetujuan: "Topik lain masih berada dalam proses review.",
          },
          { transaction: t }
        );
      }

      await t.commit();
      return res.json({
        success: true,
        message: allPipelinesFinished
          ? "Topik ditolak dan pengajuan selesai karena tidak ada topik lain yang dapat diproses."
          : "Topik ditolak. Proses topik lainnya tetap berjalan.",
        data: { id: submission.id, status: submission.status, topik_slot: targetSlot },
      });
    }

    await submission.update(
      {
        status: "rejected",
        alasan_penolakan: reason,
        alasan_persetujuan: null,
        dosen_saat_ini: null,
      },
      { transaction: t }
    );

    const topikCodes = buildTopikListFromSubmission(submission)
      .map((item) => item.kode)
      .filter(Boolean);
    if (topikCodes.length > 0) {
      await Topik.update(
        { status: "available" },
        {
          where: { kode: { [Op.in]: topikCodes }, status: "reserved" },
          transaction: t,
        }
      );
    }

    const mahasiswa = await Mahasiswa.findByPk(submission.mahasiswa_id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (mahasiswa) {
      const fallbackStatus =
        submission.jenis_jalur === "ulang"
          ? "ulang"
          : submission.jenis_jalur === "ekstensi"
          ? "ekstensi"
          : "belum_mengajukan";
      await mahasiswa.update(
        {
          status_jalur_saat_ini: fallbackStatus,
          pengajuan_aktif_id: null,
        },
        { transaction: t }
      );
      await createSystemNotification({
        recipientType: "mahasiswa",
        recipientId: mahasiswa.id,
        type: NOTIFICATION_TYPES.PENJALURAN_FINAL_REJECTED_STUDENT,
        message: `Keputusan final Penelitian ditolak: ${reason}`,
        referenceType: "pengajuan_penelitian",
        referenceId: submission.id,
        actionKey: "student_path_status",
        metadata: { jalur: "penelitian", decision: "rejected" },
        deduplicationKey: `penjaluran:penelitian:${submission.id}:notification:final-rejected`,
        transaction: t,
      });
    }

    await t.commit();
    return res.json({
      success: true,
      message: "Pengajuan penelitian berhasil ditolak.",
      data: { id: submission.id, status: "rejected" },
    });
  } catch (error) {
    if (!t.finished) await t.rollback();
    console.error("Error di rejectPenelitianFinal:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal menolak pengajuan penelitian.",
      error: error.message,
    });
  }
};

