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
  sequelize,
} = require("../models");
const { fetchMahasiswaMasterData } = require("../services/mahasiswaMasterService");
const { evaluatePeriodeWindow, parseInputDateForJakarta } = require("../services/periodePenjaluranService");
const {
  buildTopikListFromSubmission,
  evaluateTopikParallelState,
  isTopikParallelSubmission,
} = require("../services/topikParallelReviewService");

const RESEARCH_CLUSTER_CODES = ["ITSC", "SIRKEL", "SIBER", "MVK"];
const RESEARCH_CLUSTER_LABELS = {
  ITSC: "Informatika Teori & Sistem Cerdas",
  SIRKEL: "Sistem Informasi & Rekayasa Perangkat Lunak",
  SIBER: "Sistem Siber",
  MVK: "Multimedia & Visi Komputer",
};
const ACTIVE_PENGAJUAN_STATUSES_FOR_ASSIGNMENT = ["pending", "menunggu_set_ketua_cluster"];
const ACTIVE_PENDAFTARAN_STATUSES_FOR_ASSIGNMENT = ["submitted", "processed"];
const ACTIVE_FORM_LANJUTAN_STATUSES_FOR_ASSIGNMENT = [
  "submitted",
  "review_dosen_magang",
  "review_sekprodi",
];
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
  },
  {
    field: "pengawas_perintisan_bisnis_dosen_id",
    label: "Dosen pengampu jalur perintisan bisnis",
    association: "pengawasPerintisanBisnisDosen",
  },
];

const MASTER_PENANGGUNG_JAWAB_INCLUDE = PERIODE_ROLE_FIELD_DEFINITIONS.map((item) => ({
  model: Dosen,
  as: item.association,
  attributes: ["id", "kode_dosen", "nik", "nama", "email"],
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

function buildDuplicateRoleFieldErrors(rolePayload = {}) {
  const duplicateErrors = {};
  const assignmentByDosenId = new Map();

  for (const item of PERIODE_ROLE_FIELD_DEFINITIONS) {
    const dosenId = parsePositiveId(rolePayload[item.field]);
    if (!dosenId) continue;
    if (!assignmentByDosenId.has(dosenId)) {
      assignmentByDosenId.set(dosenId, []);
    }
    assignmentByDosenId.get(dosenId).push(item.field);
  }

  for (const fieldKeys of assignmentByDosenId.values()) {
    if (!Array.isArray(fieldKeys) || fieldKeys.length < 2) continue;
    for (const fieldKey of fieldKeys) {
      duplicateErrors[fieldKey] = "Dosen yang sama tidak boleh dipilih untuk lebih dari satu peran.";
    }
  }

  return duplicateErrors;
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
    pengawas_pengabdian_dosen_id: row.pengawas_pengabdian_dosen_id || null,
    pengawas_perintisan_bisnis_dosen_id: row.pengawas_perintisan_bisnis_dosen_id || null,
    ketua_itsc_dosen: formatDosenMini(row.ketuaItscDosen),
    ketua_sirkel_dosen: formatDosenMini(row.ketuaSirkelDosen),
    ketua_siber_dosen: formatDosenMini(row.ketuaSiberDosen),
    ketua_mvk_dosen: formatDosenMini(row.ketuaMvkDosen),
    pengawas_magang_dosen: formatDosenMini(row.pengawasMagangDosen),
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
  return PeriodePenjaluran.update(
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

  if (query.jalur) {
    pendaftaranWhere.jalur = query.jalur;
  }

  if (query.status) {
    pendaftaranWhere.status = query.status;
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
    semester_mahasiswa: item.semester_mahasiswa,
    nomor_whatsapp: item.nomor_whatsapp,
    status: item.status,
    reviewed_at: item.reviewed_at,
    approval_note: item.approval_note,
    jenis_jalur_diambil: item.jenis_jalur_diambil,
    penjaluran_sebelumnya: item.penjaluran_sebelumnya,
    penjaluran_baru: item.penjaluran_baru,
    createdAt: item.createdAt,
    dosen_pembimbing_akademik: item.dosenPembimbingAkademik
      ? {
          id: item.dosenPembimbingAkademik.id,
          nik: item.dosenPembimbingAkademik.nik,
          nama: item.dosenPembimbingAkademik.nama,
        }
      : null,
    dosen_pembimbing_ta: item.dosenPembimbingTA
      ? {
          id: item.dosenPembimbingTA.id,
          nik: item.dosenPembimbingTA.nik,
          nama: item.dosenPembimbingTA.nama,
        }
      : null,
    dosen_pembimbing_ta_sebelumnya: item.dosenPembimbingTASebelumnya
      ? {
          id: item.dosenPembimbingTASebelumnya.id,
          nik: item.dosenPembimbingTASebelumnya.nik,
          nama: item.dosenPembimbingTASebelumnya.nama,
        }
      : null,
    dosen_pembimbing_ta_baru: item.dosenPembimbingTABaru
      ? {
          id: item.dosenPembimbingTABaru.id,
          nik: item.dosenPembimbingTABaru.nik,
          nama: item.dosenPembimbingTABaru.nama,
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
          status_jalur_saat_ini: mahasiswa.status_jalur_saat_ini,
          dosen_pembimbing_akademik: mahasiswa.dosenPembimbingAkademik?.nama || "-",
          dosen_pembimbing_skripsi: mahasiswa.dosenPembimbingSkripsi?.nama || "-",
          semester_penjaluran_ke: 0,
          semester_penjaluran_aktif: mahasiswa.semester_penjaluran_aktif || 0,
          tahun_akademik: null,
          semester_akademik: null,
          periode_label: null,
          jalur: null,
          nama_penjaluran: null,
          pembimbing_ta: null,
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
      status_jalur_saat_ini: mahasiswa.status_jalur_saat_ini,
      dosen_pembimbing_akademik: mahasiswa.dosenPembimbingAkademik?.nama || "-",
      dosen_pembimbing_skripsi: mahasiswa.dosenPembimbingSkripsi?.nama || "-",
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
      pembimbing_ta: item.pembimbing_ta?.nama || null,
      pendaftaran_status: item.status || null,
      tanggal_penjaluran: item.createdAt || null,
      updatedAt: item.updatedAt || mahasiswa.updatedAt,
    }));
  });
}

function filterMahasiswaMasterRows(rows = [], query = {}) {
  const selectedAngkatan = String(query?.angkatan || "").trim();
  const selectedSemesterPenjaluran = String(query?.semester_penjaluran || "").trim();
  const selectedPeriode = String(query?.periode || "").trim();
  const selectedPenjaluran = String(query?.penjaluran || "").trim().toLowerCase();
  const selectedTipePendaftaran = String(query?.tipe_pendaftaran || "").trim().toLowerCase();
  const keyword = String(query?.search || "").trim().toLowerCase();

  return (Array.isArray(rows) ? rows : []).filter((row) => {
    if (selectedAngkatan && String(row?.angkatan || "").trim() !== selectedAngkatan) {
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
      row.status_jalur_saat_ini,
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
      row.pembimbing_ta,
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
      "Semester Penjaluran":
        row.semester_penjaluran_aktif || row.semester_penjaluran_ke
          ? `Semester ${row.semester_penjaluran_aktif || row.semester_penjaluran_ke}`
          : "-",
      "Periode Penjaluran": row.periode_label || "-",
      "Tahun Akademik": row.tahun_akademik || "-",
      "Semester Akademik": row.semester_akademik ? formatEnumLabel(row.semester_akademik) : "-",
      Jalur: row.jalur ? formatEnumLabel(row.jalur) : "-",
      "Nama Penjaluran": row.nama_penjaluran ? formatEnumLabel(row.nama_penjaluran) : "-",
      "Pembimbing TA": row.pembimbing_ta || "-",
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
      { wch: 20 },
      { wch: 24 },
      { wch: 16 },
      { wch: 18 },
      { wch: 12 },
      { wch: 24 },
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
          attributes: ["id", "nik", "nama"],
          required: false,
        },
        {
          model: Dosen,
          as: "dosenPembimbingTA",
          attributes: ["id", "nik", "nama"],
          required: false,
        },
        {
          model: Dosen,
          as: "dosenPembimbingTASebelumnya",
          attributes: ["id", "nik", "nama"],
          required: false,
        },
        {
          model: Dosen,
          as: "dosenPembimbingTABaru",
          attributes: ["id", "nik", "nama"],
          required: false,
        },
        {
          model: SekretarisProdi,
          as: "reviewedBySekretaris",
          attributes: ["id", "nik", "nama"],
          required: false,
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    res.json({
      success: true,
      data: list.map(toCompactRow),
      total: list.length,
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
          attributes: ["nama", "nik"],
          required: false,
        },
        {
          model: Dosen,
          as: "dosenPembimbingTA",
          attributes: ["nama", "nik"],
          required: false,
        },
        {
          model: Dosen,
          as: "dosenPembimbingTASebelumnya",
          attributes: ["nama", "nik"],
          required: false,
        },
        {
          model: Dosen,
          as: "dosenPembimbingTABaru",
          attributes: ["nama", "nik"],
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

    const rows = list.map((item) => ({
      "Tanggal Daftar": item.createdAt,
      "Periode Penjaluran": item.periode?.label_periode || "-",
      "Tahun Akademik": item.periode?.tahun_akademik || "-",
      "Semester Akademik": item.periode?.semester || "-",
      Jalur: item.jalur,
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
    }));

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

async function fetchPendaftaranDetail(id) {
  return PendaftaranPenjaluran.findByPk(id, {
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
        attributes: ["id", "nik", "nama", "email"],
      },
      {
        model: Dosen,
        as: "dosenPembimbingTA",
        attributes: ["id", "nik", "nama", "email"],
      },
      {
        model: Dosen,
        as: "dosenPembimbingTASebelumnya",
        attributes: ["id", "nik", "nama", "email"],
      },
      {
        model: Dosen,
        as: "dosenPembimbingTABaru",
        attributes: ["id", "nik", "nama", "email"],
      },
      {
        model: SekretarisProdi,
        as: "reviewedBySekretaris",
        attributes: ["id", "nik", "nama", "email"],
      },
    ],
  });
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

    const pendaftaran = await fetchPendaftaranDetail(id);
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
    const reviewerId = req.user.id;
    const note = typeof req.body?.note === "string" ? req.body.note.trim() : "";

    if (!pendaftaranId) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "ID pendaftaran tidak valid.",
      });
    }

    const pendaftaran = await PendaftaranPenjaluran.findByPk(pendaftaranId, { transaction: t });
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

    pendaftaran.status = "approved";
    pendaftaran.reviewed_by_sekretaris_id = reviewerId;
    pendaftaran.reviewed_at = new Date();
    pendaftaran.approval_note = note || "Disetujui oleh sekretaris prodi";
    await pendaftaran.save({ transaction: t });

    await Mahasiswa.update(
      {
        status_jalur_saat_ini: "sedang_mengajukan",
      },
      {
        where: { id: pendaftaran.mahasiswa_id },
        transaction: t,
      }
    );

    await t.commit();

    const detail = await fetchPendaftaranDetail(pendaftaranId);
    res.json({
      success: true,
      message: "Pendaftaran berhasil di-approve. Mahasiswa sekarang bisa login.",
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
    const reviewerId = req.user.id;
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

    const pendaftaran = await PendaftaranPenjaluran.findByPk(pendaftaranId, { transaction: t });
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

    pendaftaran.status = "rejected";
    pendaftaran.reviewed_by_sekretaris_id = reviewerId;
    pendaftaran.reviewed_at = new Date();
    pendaftaran.approval_note = note;
    await pendaftaran.save({ transaction: t });

    await Mahasiswa.update(
      {
        status_jalur_saat_ini: "belum_mengajukan",
      },
      {
        where: { id: pendaftaran.mahasiswa_id },
        transaction: t,
      }
    );

    await t.commit();

    const detail = await fetchPendaftaranDetail(pendaftaranId);
    res.json({
      success: true,
      message: "Pendaftaran ditolak. Mahasiswa belum dapat login.",
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
            attributes: ["id", "kode_dosen", "nik", "nama", "email"],
            required: false,
          },
          {
            model: Dosen,
            as: "pengawasMagangDosen",
            attributes: ["id", "kode_dosen", "nik", "nama", "email"],
            required: false,
          },
          {
            model: Dosen,
            as: "pengawasPengabdianDosen",
            attributes: ["id", "kode_dosen", "nik", "nama", "email"],
            required: false,
          },
          {
            model: Dosen,
            as: "pengawasPerintisanBisnisDosen",
            attributes: ["id", "kode_dosen", "nik", "nama", "email"],
            required: false,
          },
        ],
        order: [["updatedAt", "DESC"]],
      }),
      Dosen.findAll({
        attributes: ["id", "kode_dosen", "nik", "nama", "email", "jabatan_struktural"],
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
            attributes: ["id", "kode_dosen", "nik", "nama", "email"],
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

    res.json({
      success: true,
      data: {
        active_periode: activePeriode,
        draft_periode: draftPeriode,
        periodes: mappedPeriodes,
        dosen_options: dosenOptions,
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

    for (const item of PERIODE_ROLE_FIELD_DEFINITIONS) {
      if (!parsePositiveId(rolePayload[item.field])) {
        fieldErrors[item.field] = `${item.label} wajib dipilih.`;
      }
    }
    Object.assign(fieldErrors, buildDuplicateRoleFieldErrors(rolePayload));

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
      attributes: ["id", "kode_dosen", "nik", "nama", "email"],
      transaction: t,
    });
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
      latestMaster.updated_by_sekretaris_id = req.user?.id || null;
      await latestMaster.save({ transaction: t });
    } else {
      const createPayload = {};
      for (const item of PERIODE_ROLE_FIELD_DEFINITIONS) {
        createPayload[item.field] = parsePositiveId(rolePayload[item.field]);
      }
      createPayload.updated_by_sekretaris_id = req.user?.id || null;
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
      attributes: ["id", "kode_dosen", "nik", "nama", "email", "jabatan_struktural", "kuota_bimbingan"],
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
    const rawKuota = Number(req.body?.kuota_bimbingan);
    const mode = String(req.body?.mode || "all").toLowerCase();
    const selectedIdsRaw = Array.isArray(req.body?.dosen_ids) ? req.body.dosen_ids : [];

    if (!Number.isInteger(rawKuota) || rawKuota < 1) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "kuota_bimbingan harus berupa angka bulat dan minimal 1.",
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
      const kuotaInfoSaatIni = await dosen.getKuotaInfo();
      const sisaSaatIni = Number(kuotaInfoSaatIni?.sisa || 0);
      const terpakaiSaatIni = Number(kuotaInfoSaatIni?.terpakai || 0);
      const minimalKuota = Math.max(1, sisaSaatIni, terpakaiSaatIni);
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
        message: `Kuota ${rawKuota} tidak valid. Contoh: ${labelContoh} minimal ${contoh.minimal_kuota} (sisa ${contoh.sisa_saat_ini}, terpakai ${contoh.terpakai_saat_ini}).`,
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

      const kuotaInfo = await dosen.getKuotaInfo();
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
            attributes: ["id", "kode_dosen", "nik", "nama", "email", "jabatan_struktural"],
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

    const ketuaRows = await KlasterKetuaPeriode.findAll({
      where: { periode_penjaluran_id: periodeDipakai.id },
      include: [
        {
          model: Dosen,
          as: "ketuaDosen",
          attributes: ["id", "kode_dosen", "nik", "nama", "email", "jabatan_struktural"],
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

// POST /api/sekretaris/ketua-klaster/assign
exports.assignKetuaKlaster = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const periodePenjaluranId = Number(req.body?.periode_penjaluran_id);
    const klasterId = Number(req.body?.klaster_id);
    const dosenId = Number(req.body?.dosen_id);
    const sekretarisId = req.user?.id || null;

    if (!Number.isInteger(periodePenjaluranId) || periodePenjaluranId <= 0) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "periode_penjaluran_id wajib diisi dan harus valid.",
      });
    }

    if (!Number.isInteger(klasterId) || klasterId <= 0) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "klaster_id wajib diisi dan harus valid.",
      });
    }

    if (!Number.isInteger(dosenId) || dosenId <= 0) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "dosen_id wajib diisi dan harus valid.",
      });
    }

    const [periode, klaster, dosen] = await Promise.all([
      PeriodePenjaluran.findByPk(periodePenjaluranId, { transaction: t }),
      Klaster.findByPk(klasterId, { transaction: t }),
      Dosen.findByPk(dosenId, { transaction: t }),
    ]);

    if (!periode) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Periode tidak ditemukan.",
      });
    }

    const statusPeriode = getPeriodeStatusLabel(periode);
    if (statusPeriode !== "draft") {
      await t.rollback();
      return res.status(409).json({
        success: false,
        message: "Ketua klaster hanya bisa diubah pada periode draft. Periode aktif atau selesai tidak boleh diubah.",
      });
    }

    const assignmentLock = await getPenanggungJawabAssignmentLock({ transaction: t });
    if (assignmentLock.locked) {
      await t.rollback();
      return res.status(409).json({
        success: false,
        message: assignmentLock.message,
        detail: {
          penanggung_jawab_lock: assignmentLock,
        },
      });
    }

    if (!klaster) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Klaster tidak ditemukan.",
      });
    }

    if (!dosen) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Dosen tidak ditemukan.",
      });
    }

    const dosenTerdaftarDiKlaster = await DosenKlaster.findOne({
      where: {
        klaster_id: klasterId,
        dosen_id: dosenId,
      },
      transaction: t,
    });

    if (!dosenTerdaftarDiKlaster) {
      await t.rollback();
      return res.status(409).json({
        success: false,
        message: `Dosen ${dosen.nama} tidak terdaftar pada klaster ${klaster.kode}.`,
      });
    }

    const duplicateKetua = await KlasterKetuaPeriode.findOne({
      where: {
        periode_penjaluran_id: periodePenjaluranId,
        dosen_id: dosenId,
        klaster_id: {
          [Op.ne]: klasterId,
        },
      },
      include: [
        {
          model: Klaster,
          as: "klaster",
          attributes: ["id", "kode", "nama"],
          required: false,
        },
      ],
      transaction: t,
    });
    if (duplicateKetua) {
      await t.rollback();
      return res.status(409).json({
        success: false,
        message: `Dosen ${dosen.nama} sudah ditugaskan sebagai ketua klaster ${duplicateKetua.klaster?.kode || "-"}. Satu dosen hanya boleh memiliki satu tanggung jawab penjaluran.`,
      });
    }

    const jalurConflicts = [
      {
        field: "pengawas_magang_dosen_id",
        label: "dosen pengawas magang",
      },
      {
        field: "pengawas_pengabdian_dosen_id",
        label: "dosen pengampu pengabdian masyarakat",
      },
      {
        field: "pengawas_perintisan_bisnis_dosen_id",
        label: "dosen pengampu perintisan bisnis",
      },
    ];
    const conflictingJalurRole = jalurConflicts.find((item) => Number(periode?.[item.field]) === dosenId);
    if (conflictingJalurRole) {
      await t.rollback();
      return res.status(409).json({
        success: false,
        message: `Dosen ${dosen.nama} sudah ditugaskan sebagai ${conflictingJalurRole.label}. Satu dosen hanya boleh memiliki satu tanggung jawab penjaluran.`,
      });
    }

    const existingRow = await KlasterKetuaPeriode.findOne({
      where: {
        periode_penjaluran_id: periodePenjaluranId,
        klaster_id: klasterId,
      },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (existingRow) {
      existingRow.dosen_id = dosenId;
      existingRow.assigned_by_sekretaris_id = sekretarisId;
      await existingRow.save({ transaction: t });
    } else {
      await KlasterKetuaPeriode.create(
        {
          periode_penjaluran_id: periodePenjaluranId,
          klaster_id: klasterId,
          dosen_id: dosenId,
          assigned_by_sekretaris_id: sekretarisId,
        },
        { transaction: t }
      );
    }

    const saved = await KlasterKetuaPeriode.findOne({
      where: {
        periode_penjaluran_id: periodePenjaluranId,
        klaster_id: klasterId,
      },
      include: [
        {
          model: Klaster,
          as: "klaster",
          attributes: ["id", "kode", "nama"],
        },
        {
          model: Dosen,
          as: "ketuaDosen",
          attributes: ["id", "kode_dosen", "nik", "nama", "email", "jabatan_struktural"],
        },
        {
          model: SekretarisProdi,
          as: "assignedBySekretaris",
          attributes: ["id", "nik", "nama", "jabatan"],
        },
        {
          model: PeriodePenjaluran,
          as: "periode",
          attributes: ["id", "label_periode", "tahun_akademik", "semester", "is_active"],
        },
      ],
      transaction: t,
    });

    let totalRouted = 0;
    if (statusPeriode === "active") {
      totalRouted = await routeWaitingSubmissionsToKetuaCluster({
        klaster,
        ketuaDosenId: dosenId,
        transaction: t,
      });
    }

    await t.commit();

    return res.json({
      success: true,
      message:
        totalRouted > 0
          ? `Ketua klaster ${klaster.kode} untuk periode ${periode.label_periode} berhasil disimpan. ${totalRouted} pengajuan penelitian otomatis diteruskan ke ketua klaster.`
          : `Ketua klaster ${klaster.kode} untuk periode ${periode.label_periode} berhasil disimpan.`,
      data: {
        mapping: saved,
        pengajuan_diteruskan: totalRouted,
      },
    });
  } catch (error) {
    if (!t.finished) await t.rollback();
    console.error("Error di assignKetuaKlaster:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// POST /api/sekretaris/periode/open
exports.openPeriodePendaftaran = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const tahunAkademik = normalizeText(req.body?.tahun_akademik);
    const semester = normalizeText(req.body?.semester).toLowerCase();
    const tanggalMulaiRaw = normalizeText(req.body?.tanggal_mulai);
    const tanggalSelesaiRaw = normalizeText(req.body?.tanggal_selesai);
    const ketuaFieldMap = PERIODE_ROLE_FIELD_DEFINITIONS.filter((item) => item.kode);
    const rolePayloadFromRequest = buildRolePayloadFromRequest(req.body || {});
    const ketuaFallbackDosenId = parsePositiveId(req.body?.ketua_penelitian_dosen_id);
    const allKetuaEmpty = ketuaFieldMap.every((item) => !parsePositiveId(rolePayloadFromRequest[item.field]));
    if (allKetuaEmpty && ketuaFallbackDosenId) {
      for (const item of ketuaFieldMap) {
        rolePayloadFromRequest[item.field] = ketuaFallbackDosenId;
      }
    }

    const masterPenanggungJawab = await fetchLatestMasterPenanggungJawab({ transaction: t });
    const rolePayload = mergeRolePayloadWithMaster(rolePayloadFromRequest, masterPenanggungJawab);

    const pengawasMagangDosenId = parsePositiveId(rolePayload.pengawas_magang_dosen_id);
    const pengawasPengabdianDosenId = parsePositiveId(rolePayload.pengawas_pengabdian_dosen_id);
    const pengawasPerintisanBisnisDosenId = parsePositiveId(
      rolePayload.pengawas_perintisan_bisnis_dosen_id
    );

    const fieldErrors = {};
    Object.assign(fieldErrors, buildDuplicateRoleFieldErrors(rolePayload));

    for (const item of ketuaFieldMap) {
      if (!parsePositiveId(rolePayload[item.field])) {
        fieldErrors[item.field] = `${item.label} wajib dipilih di Master Data penanggung jawab.`;
      }
    }
    if (!pengawasMagangDosenId) {
      fieldErrors.pengawas_magang_dosen_id = "Dosen pengawas magang wajib dipilih di Master Data penanggung jawab.";
    }
    if (!pengawasPengabdianDosenId) {
      fieldErrors.pengawas_pengabdian_dosen_id =
        "Dosen pengampu jalur pengabdian masyarakat wajib dipilih di Master Data penanggung jawab.";
    }
    if (!pengawasPerintisanBisnisDosenId) {
      fieldErrors.pengawas_perintisan_bisnis_dosen_id =
        "Dosen pengampu jalur perintisan bisnis wajib dipilih di Master Data penanggung jawab.";
    }

    if (!validateTahunAkademik(tahunAkademik)) {
      fieldErrors.tahun_akademik =
        "Format tahun akademik tidak valid. Gunakan YYYY/YYYY (contoh: 2026/2027).";
    }

    if (!["ganjil", "genap"].includes(semester)) {
      fieldErrors.semester = "Semester wajib dipilih (ganjil/genap).";
    }

    if (!tanggalMulaiRaw) {
      fieldErrors.tanggal_mulai = "Tanggal mulai wajib diisi.";
    }
    if (!tanggalSelesaiRaw) {
      fieldErrors.tanggal_selesai = "Tanggal selesai wajib diisi.";
    }

    const tanggalMulai = parseInputDateForJakarta(tanggalMulaiRaw, "start");
    const tanggalSelesai = parseInputDateForJakarta(tanggalSelesaiRaw, "end");
    if (tanggalMulaiRaw && Number.isNaN(tanggalMulai?.getTime())) {
      fieldErrors.tanggal_mulai = "Format tanggal mulai tidak valid.";
    }
    if (tanggalSelesaiRaw && Number.isNaN(tanggalSelesai?.getTime())) {
      fieldErrors.tanggal_selesai = "Format tanggal selesai tidak valid.";
    }
    if (tanggalMulai && tanggalSelesai && tanggalMulai.getTime() > tanggalSelesai.getTime()) {
      fieldErrors.tanggal_mulai = "Tanggal mulai tidak boleh lebih besar dari tanggal selesai.";
      fieldErrors.tanggal_selesai = "Tanggal selesai harus setelah tanggal mulai.";
    }

    if (Object.keys(fieldErrors).length > 0) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Validasi gagal. Periksa field yang ditandai.",
        detail: fieldErrors,
      });
    }

    const labelPeriode = normalizeText(req.body?.label_periode) || formatPeriodeLabel(semester, tahunAkademik);
    const periodeRankBaru = getPeriodeRank(tahunAkademik, semester);
    if (!periodeRankBaru) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Periode tidak valid.",
      });
    }

    const periodeSudahAda = await PeriodePenjaluran.findOne({
      where: {
        tahun_akademik: tahunAkademik,
        semester,
      },
      transaction: t,
    });
    if (periodeSudahAda) {
      await t.rollback();
      return res.status(409).json({
        success: false,
        message: `Periode ${formatPeriodeLabel(semester, tahunAkademik)} sudah ada. Gunakan periode lain.`,
      });
    }

    const semuaPeriode = await PeriodePenjaluran.findAll({
      attributes: ["id", "tahun_akademik", "semester"],
      transaction: t,
    });
    let periodeTerbesar = null;
    let rankTerbesar = null;
    for (const item of semuaPeriode) {
      const rank = getPeriodeRank(item.tahun_akademik, item.semester);
      if (rank === null) continue;
      if (rankTerbesar === null || rank > rankTerbesar) {
        rankTerbesar = rank;
        periodeTerbesar = item;
      }
    }

    if (rankTerbesar !== null && periodeRankBaru < rankTerbesar) {
      await t.rollback();
      return res.status(409).json({
        success: false,
        message: `Periode tidak boleh lebih kecil dari periode terbaru (${formatPeriodeLabel(periodeTerbesar.semester, periodeTerbesar.tahun_akademik)}).`,
      });
    }

    const duplicateLabel = await PeriodePenjaluran.findOne({
      where: {
        label_periode: labelPeriode,
      },
      transaction: t,
    });
    if (duplicateLabel) {
      await t.rollback();
      return res.status(409).json({
        success: false,
        message: `Label periode '${labelPeriode}' sudah digunakan. Gunakan label lain.`,
      });
    }

    await closeExpiredActivePeriodePenjaluran({ transaction: t });

    const activePeriode = await PeriodePenjaluran.findOne({
      where: {
        status: "active",
      },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (activePeriode) {
      await t.rollback();
      return res.status(409).json({
        success: false,
        message: `Masih ada periode aktif (${activePeriode.label_periode}). Tutup periode aktif terlebih dahulu.`,
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
          kode,
          klaster_ids: [],
          preferred_klaster_id: null,
        },
      ])
    );
    for (const row of klasterRows) {
      const mappedCode = resolveResearchClusterCode(row);
      if (!mappedCode || !klasterByCode.has(mappedCode)) continue;
      const target = klasterByCode.get(mappedCode);
      target.klaster_ids.push(row.id);
      const rawKode = String(row.kode || "").trim().toUpperCase();
      if (!target.preferred_klaster_id || rawKode === mappedCode) {
        target.preferred_klaster_id = row.id;
      }
    }
    const missingCodes = RESEARCH_CLUSTER_CODES.filter((kode) => (klasterByCode.get(kode)?.klaster_ids || []).length === 0);
    if (missingCodes.length > 0) {
      await t.rollback();
      return res.status(409).json({
        success: false,
        message:
          `Master klaster penelitian belum lengkap. Klaster yang belum terpetakan: ${missingCodes.join(", ")}.`,
      });
    }
    const ketuaMappings = ketuaFieldMap.map((item) => ({
      ...item,
      klasterIds: klasterByCode.get(item.kode)?.klaster_ids || [],
      preferredKlasterId: klasterByCode.get(item.kode)?.preferred_klaster_id || null,
      dosenId: parsePositiveId(rolePayload[item.field]),
    }));

    for (const item of ketuaMappings) {
      if (!Array.isArray(item.klasterIds) || item.klasterIds.length === 0) {
        fieldErrors[item.field] = `Klaster ${item.kode} belum tersedia di master klaster.`;
      }
    }

    const allDosenIds = [
        ...new Set([
          ...ketuaMappings.map((item) => item.dosenId),
          pengawasMagangDosenId,
          pengawasPengabdianDosenId,
          pengawasPerintisanBisnisDosenId,
        ]),
    ].filter((id) => parsePositiveId(id));

    const dosenRows = await Dosen.findAll({
      where: { id: { [Op.in]: allDosenIds } },
      attributes: ["id", "nama", "kode_dosen", "nik"],
      transaction: t,
    });
    const dosenById = new Map(dosenRows.map((item) => [item.id, item]));

    for (const item of ketuaMappings) {
      if (!dosenById.has(item.dosenId)) {
        fieldErrors[item.field] = `Dosen untuk klaster ${item.kode} tidak ditemukan.`;
      }
    }
    if (!dosenById.has(pengawasMagangDosenId)) {
      fieldErrors.pengawas_magang_dosen_id = "Dosen pengawas magang tidak ditemukan.";
    }
    if (!dosenById.has(pengawasPengabdianDosenId)) {
      fieldErrors.pengawas_pengabdian_dosen_id = "Dosen pengampu jalur pengabdian masyarakat tidak ditemukan.";
    }
    if (!dosenById.has(pengawasPerintisanBisnisDosenId)) {
      fieldErrors.pengawas_perintisan_bisnis_dosen_id = "Dosen pengampu jalur perintisan bisnis tidak ditemukan.";
    }

    const membershipRows = await DosenKlaster.findAll({
      where: {
        dosen_id: {
          [Op.in]: ketuaMappings
            .map((item) => item.dosenId)
            .filter((id) => Number.isInteger(id) && id > 0),
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
      if (!Array.isArray(item.klasterIds) || item.klasterIds.length === 0) continue;
      const isMember = item.klasterIds.some((klasterId) => membershipSet.has(`${klasterId}:${item.dosenId}`));
      if (!isMember) {
        fieldErrors[item.field] = `Dosen terpilih bukan anggota klaster ${item.kode}.`;
      }
    }

    if (Object.keys(fieldErrors).length > 0) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Validasi gagal. Periksa field yang ditandai.",
        detail: fieldErrors,
      });
    }

    const ketuaPenelitianDosenId = ketuaMappings.find((item) => item.kode === "ITSC")?.dosenId;

    const periode = await PeriodePenjaluran.create(
      {
        tahun_akademik: tahunAkademik,
        semester,
        label_periode: labelPeriode,
        tanggal_mulai: tanggalMulai,
        tanggal_selesai: tanggalSelesai,
        ketua_penelitian_dosen_id: ketuaPenelitianDosenId,
        pengawas_magang_dosen_id: pengawasMagangDosenId,
        pengawas_pengabdian_dosen_id: pengawasPengabdianDosenId,
        pengawas_perintisan_bisnis_dosen_id: pengawasPerintisanBisnisDosenId,
        is_active: true,
        status: "active",
      },
      { transaction: t }
    );

    await KlasterKetuaPeriode.bulkCreate(
      ketuaMappings.map((item) => ({
        klaster_id: item.preferredKlasterId || item.klasterIds[0],
        dosen_id: item.dosenId,
        periode_penjaluran_id: periode.id,
        assigned_by_sekretaris_id: req.user?.id || null,
      })),
      { transaction: t }
    );

    await t.commit();

    return res.json({
      success: true,
      message: `Periode ${periode.label_periode} berhasil dibuka.`,
      data: periode,
    });
  } catch (error) {
    if (!t.finished) await t.rollback();
    console.error("Error di openPeriodePendaftaran:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// POST /api/sekretaris/periode/:id/activate
exports.activatePeriodePendaftaran = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const periodeId = Number(req.params.id);
    if (!Number.isInteger(periodeId) || periodeId <= 0) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "ID periode tidak valid.",
      });
    }

    const periode = await PeriodePenjaluran.findByPk(periodeId, { transaction: t, lock: true });
    if (!periode) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Periode tidak ditemukan.",
      });
    }

    const statusPeriode = getPeriodeStatusLabel(periode);
    if (statusPeriode !== "draft") {
      await t.rollback();
      return res.status(409).json({
        success: false,
        message: "Hanya periode berstatus draft yang bisa diaktifkan.",
      });
    }

    await closeExpiredActivePeriodePenjaluran({ transaction: t });

    const activePeriode = await PeriodePenjaluran.findOne({
      where: { status: "active" },
      transaction: t,
      lock: true,
    });
    if (activePeriode) {
      await t.rollback();
      return res.status(409).json({
        success: false,
        message: `Masih ada periode aktif (${activePeriode.label_periode}). Tutup periode aktif terlebih dahulu.`,
      });
    }

    periode.is_active = true;
    periode.status = "active";
    await periode.save({ transaction: t });

    await t.commit();
    return res.json({
      success: true,
      message: `Periode ${periode.label_periode} berhasil diaktifkan.`,
      data: {
        activated_periode: {
          id: periode.id,
          label_periode: periode.label_periode,
          tahun_akademik: periode.tahun_akademik,
          semester: periode.semester,
          status: periode.status,
          is_active: periode.is_active,
        },
      },
    });
  } catch (error) {
    if (!t.finished) await t.rollback();
    console.error("Error di activatePeriodePendaftaran:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// POST /api/sekretaris/periode/close
exports.closePeriodePendaftaran = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const periodeAktif = await PeriodePenjaluran.findOne({
      where: { status: "active" },
      order: [["updatedAt", "DESC"]],
      transaction: t,
    });

    if (!periodeAktif) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Tidak ada periode aktif yang sedang dibuka.",
      });
    }

    await PeriodePenjaluran.update(
      { is_active: false, status: "closed" },
      {
        where: { status: "active" },
        transaction: t,
      }
    );

    await t.commit();

    return res.json({
      success: true,
      message: "Periode pendaftaran berhasil ditutup.",
      data: {
        closed_periode: {
          id: periodeAktif.id,
          label_periode: periodeAktif.label_periode,
          tahun_akademik: periodeAktif.tahun_akademik,
          semester: periodeAktif.semester,
        },
      },
    });
  } catch (error) {
    if (!t.finished) await t.rollback();
    console.error("Error di closePeriodePendaftaran:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
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

