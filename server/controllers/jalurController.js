const {
  Pengajuan,
  Topik,
  Mahasiswa,
  Dosen,
  DosenKlaster,
  Klaster,
  RiwayatPersetujuan,
  PamitUlang,
  IzinLanjutSkripsi,
  PendaftaranPenjaluran,
  PeriodePenjaluran,
  MitraMagang,
  KelompokPerintisanBisnis,
  AnggotaKelompokPerintisan,
  sequelize,
} = require("../models");
const { Op } = require("sequelize");
const {
  buildSemesterLanjutanGate,
  getReferencePeriode,
  toIzinResponse,
} = require("../services/semesterLanjutanService");
const {
  evaluatePeriodeWindow,
  getPeriodeWindowErrorCode,
  getPeriodeWindowMessage,
} = require("../services/periodePenjaluranService");
const { ensureParallelReviewerRows } = require("../services/topikParallelReviewService");

const MAGANG_PROPOSED_POSITION_OPTIONS = [
  "analyst",
  "designer",
  "programmer",
  "tester",
  "network engineer",
  "data scientist",
  "other",
];

const MAGANG_COMPANY_SECTOR_OPTIONS = [
  "it industry",
  "goverment",
  "education/school",
  "economy/financial",
  "other",
];

const MAGANG_COMPANY_TYPE_OPTIONS = ["partner_company", "non_partner_company"];
const MAGANG_NON_PARTNER_INSTITUTION_LABEL = "Other (Non partner Company)";

const MAGANG_APPLICATION_METHOD_OPTIONS = [
  "via Internship Vacancy",
  "Independent (no vacancy/via Direct Contact)",
  "other",
];
const NON_PENELITIAN_JALUR_SET = new Set(["magang", "pengabdian", "perintisan_bisnis"]);
const NON_PENELITIAN_WORKFLOW_STATUS = new Set([
  "draft",
  "submitted",
  "review_dosen_magang",
  "review_sekprodi",
  "approved",
  "rejected",
]);
const PENELITIAN_CLUSTER_LABEL_BY_CODE = {
  SIRKEL: "Sirkel",
  SIBER: "Siber",
  ITSC: "ITSC",
  MVK: "MVK",
};

// ========== HELPER FUNCTION - VALIDASI KUOTA DOSEN ==========

/**
 * Validasi kuota dosen sebelum mahasiswa submit pengajuan
 * @param {number} dosen_id - ID dosen yang akan dicek
 * @param {Object} transaction - Sequelize transaction object
 * @returns {Object} { isAvailable: boolean, kuotaInfo: object, message: string, dosen: object }
 */
async function validateDosenKuota(dosen_id, transaction) {
  const dosen = await Dosen.findByPk(dosen_id, { transaction });

  if (!dosen) {
    return {
      isAvailable: false,
      message: "Dosen tidak ditemukan",
    };
  }

  const kuotaInfo = await dosen.getKuotaInfo();

  if (kuotaInfo.is_penuh) {
    return {
      isAvailable: false,
      kuotaInfo,
      message: `Kuota dosen ${dosen.nama} sudah penuh (${kuotaInfo.terpakai}/${kuotaInfo.total}). Silakan pilih dosen lain.`,
    };
  }

  return {
    isAvailable: true,
    kuotaInfo,
    dosen,
  };
}

function normalizePenelitianClusterCode(value) {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw) return null;
  if (raw === "SIRKER") return "SIRKEL";
  if (raw.includes("SISTEM INFORMASI") || raw.includes("REKAYASA PERANGKAT LUNAK") || raw.includes("SIRKEL")) {
    return "SIRKEL";
  }
  if (raw.includes("SIBER")) return "SIBER";
  if (raw.includes("MULTIMEDIA") || raw.includes("VISI KOMPUTER") || raw.includes("MVK")) return "MVK";
  if (raw.includes("INFORMATIKA TEORI") || raw.includes("SISTEM CERDAS") || raw.includes("ITSC")) return "ITSC";
  if (PENELITIAN_CLUSTER_LABEL_BY_CODE[raw]) return raw;
  return null;
}

function normalizePenelitianClusterLabel(value) {
  const code = normalizePenelitianClusterCode(value);
  if (!code) return null;
  return PENELITIAN_CLUSTER_LABEL_BY_CODE[code] || null;
}

async function validateDosenPenelitianCluster(dosenId, clusterInput, transaction) {
  const clusterCode = normalizePenelitianClusterCode(clusterInput);
  const clusterLabel = normalizePenelitianClusterLabel(clusterInput);
  if (!clusterCode || !clusterLabel) {
    return {
      ok: false,
      statusCode: 400,
      message: "Cluster penelitian tidak valid. Pilih salah satu: Sirkel, Siber, ITSC, atau MVK.",
    };
  }

  const klaster = await Klaster.findOne({
    where: { kode: clusterCode },
    attributes: ["id", "kode", "nama"],
    transaction,
  });
  if (!klaster) {
    return {
      ok: false,
      statusCode: 409,
      message: `Master cluster ${clusterCode} belum tersedia. Hubungi sekretaris prodi.`,
    };
  }

  const membership = await DosenKlaster.findOne({
    where: {
      dosen_id: Number(dosenId),
      klaster_id: klaster.id,
    },
    attributes: ["id"],
    transaction,
  });
  if (!membership) {
    return {
      ok: false,
      statusCode: 400,
      message: `Dosen pembimbing yang dipilih tidak terdaftar pada cluster ${clusterLabel}. Silakan pilih dosen sesuai cluster.`,
    };
  }

  return {
    ok: true,
    cluster_code: clusterCode,
    cluster_label: clusterLabel,
    klaster,
  };
}

function normalizeText(value) {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function parseBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "ya"].includes(normalized)) return true;
    if (["false", "0", "no", "tidak"].includes(normalized)) return false;
  }
  return null;
}

function getTopikStatusMessage(status) {
  switch (status) {
    case "reserved":
      return "sedang direservasi oleh mahasiswa lain";
    case "taken":
      return "sudah diambil";
    case "unavailable":
      return "sedang tidak tersedia";
    default:
      return "tidak tersedia";
  }
}

function resolveSelectedJalurFromPendaftaran(pendaftaran) {
  if (!pendaftaran) return null;

  if (pendaftaran.jalur === "baru") {
    return pendaftaran.jenis_jalur_diambil || null;
  }
  if (pendaftaran.jalur === "ulang") {
    return pendaftaran.jenis_jalur_diambil || pendaftaran.jenis_jalur_ulang || null;
  }
  if (pendaftaran.jalur === "alih") {
    return pendaftaran.penjaluran_baru || null;
  }

  return null;
}

function resolveTargetFormFromJalur(jalur) {
  switch (jalur) {
    case "penelitian":
      return "pengajuan_penelitian";
    case "magang":
      return "surat_rekomendasi_magang";
    case "pengabdian":
      return "pengajuan_pengabdian";
    case "perintisan_bisnis":
      return "pengajuan_perintisan_bisnis";
    default:
      return "pengajuan_penelitian";
  }
}

function formatJalurLabel(jalur) {
  if (!jalur) return "-";
  return String(jalur)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

async function getConfiguredActivePeriodePenjaluran(transaction) {
  return PeriodePenjaluran.findOne({
    where: { is_active: true },
    order: [["updatedAt", "DESC"]],
    transaction,
  });
}

async function getActivePeriodePenjaluran(transaction) {
  const periodeAktif = await getConfiguredActivePeriodePenjaluran(transaction);
  if (!periodeAktif) return null;

  const periodeWindow = evaluatePeriodeWindow(periodeAktif);
  if (!periodeWindow.is_open) return null;

  return periodeAktif;
}

function buildPeriodeNotAllowedResult(windowCheck) {
  return {
    allowed: false,
    statusCode: 409,
    message: getPeriodeWindowMessage(windowCheck),
    code: getPeriodeWindowErrorCode(windowCheck),
    detail: {
      reason: windowCheck.reason,
      tanggal_mulai: windowCheck.start || null,
      tanggal_selesai: windowCheck.end || null,
      now: windowCheck.now || null,
    },
  };
}

async function getLatestPendaftaranForPeriode(mahasiswaId, periodeId, transaction) {
  const wherePeriode = { mahasiswa_id: mahasiswaId };
  if (periodeId) {
    wherePeriode.periode_penjaluran_id = periodeId;
  }

  const pendaftaranDalamPeriode = await PendaftaranPenjaluran.findOne({
    where: wherePeriode,
    order: [["createdAt", "DESC"]],
    transaction,
  });

  if (pendaftaranDalamPeriode) return pendaftaranDalamPeriode;

  return PendaftaranPenjaluran.findOne({
    where: { mahasiswa_id: mahasiswaId },
    order: [["createdAt", "DESC"]],
    transaction,
  });
}

async function hasPenelitianSubmissionForPendaftaran(mahasiswaId, pendaftaran, transaction) {
  if (pendaftaran?.id) {
    const linkedSubmission = await Pengajuan.findOne({
      where: {
        mahasiswa_id: mahasiswaId,
        pendaftaran_penjaluran_id: pendaftaran.id,
      },
      attributes: ["id"],
      transaction,
    });
    if (linkedSubmission) return true;
  }

  const where = {
    mahasiswa_id: mahasiswaId,
    tipe_pengajuan: { [Op.in]: ["topik_dosen", "judul_mandiri"] },
  };

  if (pendaftaran?.createdAt) {
    where.createdAt = { [Op.gte]: pendaftaran.createdAt };
  }

  const existing = await Pengajuan.findOne({
    where,
    attributes: ["id"],
    order: [["createdAt", "DESC"]],
    transaction,
  });

  return Boolean(existing);
}

async function getUlangPenelitianPendaftaran(mahasiswaId, transaction) {
  const periodeAktif = await getActivePeriodePenjaluran(transaction);
  if (!periodeAktif) return null;

  return PendaftaranPenjaluran.findOne({
    where: {
      mahasiswa_id: mahasiswaId,
      periode_penjaluran_id: periodeAktif.id,
      jalur: "ulang",
      jenis_jalur_diambil: "penelitian",
      status: "approved",
    },
    order: [["createdAt", "DESC"]],
    transaction,
    lock: transaction?.LOCK?.UPDATE,
  });
}

async function validateSubmissionTargetJalur({
  mahasiswa,
  transaction,
  targetJalur,
  requireNonPenelitianNotSubmitted = false,
}) {
  const periodeAktif = await getConfiguredActivePeriodePenjaluran(transaction);

  if (!periodeAktif) {
    return {
      allowed: false,
      statusCode: 409,
      message: "Periode pendaftaran belum aktif. Hubungi sekretaris prodi.",
      code: "PERIODE_NOT_ACTIVE",
    };
  }

  const periodeWindow = evaluatePeriodeWindow(periodeAktif);
  if (!periodeWindow.is_open) {
    return buildPeriodeNotAllowedResult(periodeWindow);
  }

  const pendaftaranAktif = await getLatestPendaftaranForPeriode(mahasiswa.id, periodeAktif.id, transaction);

  // Backward compatibility untuk akun lama yang belum melalui alur pendaftaran baru.
  if (!pendaftaranAktif) {
    if (targetJalur === "penelitian") {
      return {
        allowed: true,
        periodeAktif,
        pendaftaranAktif: null,
        selectedJalur: null,
      };
    }

    return {
      allowed: false,
      statusCode: 409,
      message: "Data pendaftaran jalur untuk periode aktif belum ditemukan.",
      code: "PENDAFTARAN_NOT_FOUND",
    };
  }

  const selectedJalur = resolveSelectedJalurFromPendaftaran(pendaftaranAktif);

  if (!selectedJalur) {
    return {
      allowed: false,
      statusCode: 409,
      message: "Jenis jalur pada data pendaftaran belum valid. Hubungi sekretaris prodi.",
      code: "JALUR_NOT_SET",
    };
  }

  if (String(pendaftaranAktif.status || "") !== "approved") {
    return {
      allowed: false,
      statusCode: 409,
      message:
        pendaftaranAktif.status === "rejected"
          ? "Pendaftaran penjaluran ditolak oleh sekretaris prodi."
          : "Pendaftaran penjaluran masih menunggu verifikasi sekretaris prodi.",
      code:
        pendaftaranAktif.status === "rejected"
          ? "PENDAFTARAN_REJECTED"
          : "PENDAFTARAN_PENDING_REVIEW",
    };
  }

  if (selectedJalur !== targetJalur) {
    return {
      allowed: false,
      statusCode: 409,
      message: `Anda terdaftar pada jalur ${formatJalurLabel(selectedJalur)} untuk periode ini. Jalur ${formatJalurLabel(
        targetJalur
      )} tidak dapat diajukan.`,
      code: "JALUR_MISMATCH",
      detail: {
        selected_jalur: selectedJalur,
        requested_jalur: targetJalur,
      },
    };
  }

  if (targetJalur !== "penelitian" && requireNonPenelitianNotSubmitted) {
    if (!["pending", "draft"].includes(String(pendaftaranAktif.form_lanjutan_status || ""))) {
      return {
        allowed: false,
        statusCode: 409,
        message: "Form jalur ini sudah pernah disubmit pada periode aktif.",
        code: "FORM_ALREADY_SUBMITTED",
      };
    }
  }

  return {
    allowed: true,
    periodeAktif,
    pendaftaranAktif,
    selectedJalur,
  };
}

function isHttpUrl(value) {
  if (!value) return false;
  try {
    const parsed = new URL(String(value));
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (error) {
    return false;
  }
}

async function getActiveMitraMagangNameSet(transaction) {
  const rows = await MitraMagang.findAll({
    where: { is_active: true },
    attributes: ["nama"],
    order: [["nama", "ASC"]],
    transaction,
  });

  const names = new Set();
  for (const row of rows) {
    const nama = String(row?.nama || "").trim();
    if (nama) names.add(nama);
  }

  return names;
}

async function findActiveMitraMagangByNama(nama, transaction) {
  if (!nama) return null;

  return MitraMagang.findOne({
    where: {
      is_active: true,
      [Op.and]: [
        sequelize.where(sequelize.fn("LOWER", sequelize.col("nama")), String(nama).trim().toLowerCase()),
      ],
    },
    attributes: ["id", "nama", "bidang_jenis", "lokasi", "email_kontak", "website", "status", "is_active"],
    transaction,
  });
}

function normalizeMagangSubmissionPayload(rawPayload) {
  const payload = rawPayload || {};
  const companyType = String(payload.company_type || "").trim();

  const normalizeOptionalText = (value) => {
    const text = String(value || "").trim();
    return text || null;
  };

  const normalizeArray = (value) => {
    if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
    if (typeof value === "string") {
      return value
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean);
    }
    return [];
  };

  return {
    phone_number: String(payload.phone_number || "").trim(),
    proposed_position: String(payload.proposed_position || "").trim(),
    proposed_position_other: normalizeOptionalText(payload.proposed_position_other),
    company_sector: String(payload.company_sector || "").trim(),
    company_sector_other: normalizeOptionalText(payload.company_sector_other),
    chosen_institution:
      String(payload.chosen_institution || "").trim() ||
      (companyType === "non_partner_company" ? MAGANG_NON_PARTNER_INSTITUTION_LABEL : ""),
    complete_address_of_institution: String(payload.complete_address_of_institution || "").trim(),
    company_type: companyType,
    sudah_apply_ke_mitra: parseBoolean(payload.sudah_apply_ke_mitra),
    tanggal_apply: String(payload.tanggal_apply || "").trim(),
    metode_apply: String(payload.metode_apply || "").trim(),
    bukti_apply: String(payload.bukti_apply || "").trim(),
    internship_company_website_url: String(payload.internship_company_website_url || "").trim(),
    internship_vacancy_url: normalizeOptionalText(payload.internship_vacancy_url),
    supporting_documents_note: normalizeOptionalText(payload.supporting_documents_note),
    cv_file_name: String(payload.cv_file_name || "").trim(),
    portfolio_file_name: String(payload.portfolio_file_name || "").trim(),
    transcript_file_name: String(payload.transcript_file_name || "").trim(),
    other_supporting_documents_file_name: String(payload.other_supporting_documents_file_name || "").trim(),
    company_name: normalizeOptionalText(payload.company_name),
    year_of_establishment: normalizeOptionalText(payload.year_of_establishment),
    number_of_employees: normalizeOptionalText(payload.number_of_employees),
    internship_application_method: normalizeOptionalText(payload.internship_application_method),
    internship_application_method_other: normalizeOptionalText(payload.internship_application_method_other),
    selection_processes: normalizeArray(payload.selection_processes),
  };
}

function validateMagangSubmissionPayload(payload, mitraNameSet) {
  if (payload.sudah_apply_ke_mitra !== true) {
    return {
      statusCode: 409,
      message: "Pengajuan magang hanya bisa dikirim setelah Anda apply ke mitra magang.",
    };
  }
  if (!payload.tanggal_apply) {
    return { statusCode: 400, message: "Tanggal apply wajib diisi." };
  }
  if (Number.isNaN(new Date(payload.tanggal_apply).getTime())) {
    return { statusCode: 400, message: "Format tanggal apply tidak valid." };
  }
  if (!payload.metode_apply) {
    return { statusCode: 400, message: "Metode apply wajib diisi." };
  }
  if (!payload.bukti_apply) {
    return { statusCode: 400, message: "Bukti apply wajib diisi (nama file/url/catatan)." };
  }

  if (!payload.phone_number) return { statusCode: 400, message: "Phone number wajib diisi." };
  if (!payload.proposed_position) return { statusCode: 400, message: "Proposed / Expected Position wajib dipilih." };
  if (!MAGANG_PROPOSED_POSITION_OPTIONS.includes(payload.proposed_position)) {
    return { statusCode: 400, message: "Pilihan Proposed / Expected Position tidak valid." };
  }
  if (payload.proposed_position === "other" && !payload.proposed_position_other) {
    return { statusCode: 400, message: "Isi detail posisi untuk opsi Other pada Proposed / Expected Position." };
  }

  if (!payload.company_sector) return { statusCode: 400, message: "Company Sector wajib dipilih." };
  if (!MAGANG_COMPANY_SECTOR_OPTIONS.includes(payload.company_sector)) {
    return { statusCode: 400, message: "Pilihan Company Sector tidak valid." };
  }
  if (payload.company_sector === "other" && !payload.company_sector_other) {
    return { statusCode: 400, message: "Isi detail sektor untuk opsi Other pada Company Sector." };
  }

  if (!payload.chosen_institution) return { statusCode: 400, message: "Chosen Institution wajib dipilih." };

  if (!payload.complete_address_of_institution) {
    return { statusCode: 400, message: "Complete Address of the Institution wajib diisi." };
  }

  if (!payload.company_type) return { statusCode: 400, message: "Type of Company wajib dipilih." };
  if (!MAGANG_COMPANY_TYPE_OPTIONS.includes(payload.company_type)) {
    return { statusCode: 400, message: "Pilihan Type of Company tidak valid." };
  }
  if (payload.company_type === "partner_company") {
    if (!(mitraNameSet instanceof Set) || mitraNameSet.size === 0) {
      return { statusCode: 409, message: "Daftar mitra magang belum tersedia. Hubungi sekretaris prodi." };
    }
    if (!mitraNameSet.has(payload.chosen_institution)) {
      return {
        statusCode: 409,
        message: "Institusi magang tidak valid atau sudah tidak aktif pada daftar mitra.",
      };
    }
  }

  if (!payload.cv_file_name) return { statusCode: 400, message: "Upload CV wajib diisi." };
  if (!payload.portfolio_file_name) return { statusCode: 400, message: "Upload portfolios of Past Work wajib diisi." };
  if (!payload.transcript_file_name) return { statusCode: 400, message: "Upload Academic Transcript wajib diisi." };
  if (!payload.other_supporting_documents_file_name) {
    return { statusCode: 400, message: "Upload other supporting Documents wajib diisi." };
  }

  if (!payload.internship_company_website_url || !isHttpUrl(payload.internship_company_website_url)) {
    return { statusCode: 400, message: "Internship Company website URL wajib diisi dengan URL valid." };
  }

  if (payload.internship_vacancy_url && !isHttpUrl(payload.internship_vacancy_url)) {
    return { statusCode: 400, message: "Internship vacancy URL harus berupa URL valid." };
  }

  if (!payload.internship_vacancy_url && !payload.supporting_documents_note) {
    return {
      statusCode: 400,
      message: "Jika Internship vacancy URL tidak tersedia, isi keterangan dokumen pendukung.",
    };
  }

  if (payload.company_type === "non_partner_company") {
    if (!payload.chosen_institution) {
      return { statusCode: 400, message: "Chosen Institution wajib diisi untuk Non partner Company." };
    }
    if (!payload.company_name) return { statusCode: 400, message: "Company name wajib diisi untuk Non partner Company." };
    if (!payload.year_of_establishment) {
      return { statusCode: 400, message: "Year of establishment wajib diisi untuk Non partner Company." };
    }
    if (!payload.number_of_employees) {
      return { statusCode: 400, message: "Number of employees wajib diisi untuk Non partner Company." };
    }
    if (!payload.internship_application_method) {
      return {
        statusCode: 400,
        message: "Internship Application method wajib dipilih untuk Non partner Company.",
      };
    }
    if (!MAGANG_APPLICATION_METHOD_OPTIONS.includes(payload.internship_application_method)) {
      return { statusCode: 400, message: "Pilihan Internship Application method tidak valid." };
    }
    if (
      payload.internship_application_method === "other" &&
      !payload.internship_application_method_other
    ) {
      return { statusCode: 400, message: "Isi detail metode pendaftaran untuk opsi Other." };
    }
    if (!Array.isArray(payload.selection_processes) || payload.selection_processes.length === 0) {
      return {
        statusCode: 400,
        message: "Selection Processes wajib diisi minimal 1 langkah untuk Non partner Company.",
      };
    }
  }

  return { statusCode: 200, message: "" };
}

function normalizeOptionalSubmissionText(value) {
  const text = String(value || "").trim();
  return text || null;
}

async function getKelompokPerintisanByPendaftaranId(pendaftaranId, transaction, lock = false) {
  const membership = await AnggotaKelompokPerintisan.findOne({
    where: { pendaftaran_penjaluran_id: pendaftaranId },
    transaction,
    lock: lock ? transaction?.LOCK?.UPDATE : undefined,
  });
  if (!membership) return null;

  const kelompok = await KelompokPerintisanBisnis.findByPk(membership.kelompok_id, {
    include: [
      {
        model: AnggotaKelompokPerintisan,
        as: "anggota",
        required: true,
        include: [
          {
            model: Mahasiswa,
            as: "mahasiswa",
            attributes: ["id", "nim", "nama", "email", "angkatan"],
            required: true,
          },
          {
            model: PendaftaranPenjaluran,
            as: "pendaftaran",
            attributes: ["id", "jalur", "form_lanjutan_status"],
            required: true,
          },
        ],
      },
    ],
    transaction,
    lock: lock ? transaction?.LOCK?.UPDATE : undefined,
    subQuery: false,
  });
  if (!kelompok) return null;

  membership.setDataValue("kelompok", kelompok);
  return membership;
}

function formatKelompokPerintisan(membership) {
  const kelompok =
    membership?.kelompok ||
    (typeof membership?.getDataValue === "function"
      ? membership.getDataValue("kelompok")
      : null);
  if (!kelompok) return null;
  const anggota = Array.isArray(kelompok.anggota)
    ? [...kelompok.anggota]
        .sort((a, b) => {
          if (a.posisi !== b.posisi) return a.posisi === "ketua" ? -1 : 1;
          return Number(a.id) - Number(b.id);
        })
        .map((item) => ({
          membership_id: item.id,
          mahasiswa_id: item.mahasiswa_id,
          pendaftaran_id: item.pendaftaran_penjaluran_id,
          posisi: item.posisi,
          peran_tim: item.peran_tim,
          jenis_pendaftaran: item.jenis_pendaftaran,
          nim: item.mahasiswa?.nim || null,
          nama: item.mahasiswa?.nama || null,
          email: item.mahasiswa?.email || null,
          angkatan: item.mahasiswa?.angkatan || null,
        }))
    : [];
  return {
    id: kelompok.id,
    status: kelompok.status,
    is_ketua: membership.posisi === "ketua",
    current_peran_tim: membership.peran_tim,
    anggota,
  };
}

async function normalizeKelompokNonPenelitianPayload({
  rawPayload,
  jalur,
  ketua,
  pendaftaran,
  transaction,
}) {
  let basePayload;

  if (jalur === "perintisan_bisnis") {
    const membership = await getKelompokPerintisanByPendaftaranId(pendaftaran?.id, transaction, true);
    const kelompok = formatKelompokPerintisan(membership);
    if (!kelompok || kelompok.anggota.length !== 3) {
      return { error: "Data kelompok Perintisan Bisnis belum lengkap pada pendaftaran awal." };
    }
    if (!kelompok.is_ketua) {
      return { error: "Form Perintisan Bisnis hanya dapat dikirim oleh ketua kelompok." };
    }
    const roles = kelompok.anggota.map((item) => item.peran_tim);
    if (new Set(roles).size !== 3 || !["hustler", "hipster", "hacker"].every((role) => roles.includes(role))) {
      return { error: "Kelompok wajib memiliki tepat satu Hustler, Hipster, dan Hacker." };
    }
    basePayload = {
      nama_kelompok: `Kelompok Perintisan #${kelompok.id}`,
      kelompok,
      ketua: kelompok.anggota.find((item) => item.posisi === "ketua") || null,
      anggota: kelompok.anggota.filter((item) => item.posisi === "anggota"),
      persetujuan_anggota: true,
      catatan: normalizeOptionalSubmissionText(rawPayload.catatan),
      dokumen_pendukung: normalizeOptionalSubmissionText(rawPayload.dokumen_pendukung),
    };
  } else {
    const groupName = String(rawPayload.nama_kelompok || "").trim();
    const memberNims = [
      String(rawPayload.anggota_1_nim || "").trim(),
      String(rawPayload.anggota_2_nim || "").trim(),
    ].filter(Boolean);

    if (!groupName) {
      return { error: "Nama kelompok wajib diisi." };
    }
    if (memberNims.length === 0) {
      return { error: "Minimal Anggota 1 wajib diisi." };
    }
    if (memberNims.some((nim) => !/^\d{8}$/.test(nim))) {
      return { error: "NIM anggota wajib terdiri dari tepat 8 digit angka." };
    }
    if (new Set(memberNims).size !== memberNims.length) {
      return { error: "Anggota 1 dan Anggota 2 tidak boleh mahasiswa yang sama." };
    }
    if (memberNims.includes(String(ketua.nim || ""))) {
      return { error: "Ketua kelompok tidak boleh dimasukkan kembali sebagai anggota." };
    }
    if (rawPayload.persetujuan_anggota !== true) {
      return { error: "Ketua wajib memastikan seluruh anggota telah menyetujui keikutsertaan." };
    }

    const memberRows = await Mahasiswa.findAll({
      where: { nim: { [Op.in]: memberNims } },
      attributes: ["id", "nim", "nama", "email", "angkatan"],
      transaction,
    });
    const memberByNim = new Map(memberRows.map((item) => [String(item.nim), item]));
    const missingNims = memberNims.filter((nim) => !memberByNim.has(nim));
    if (missingNims.length > 0) {
      return { error: `Mahasiswa dengan NIM ${missingNims.join(", ")} tidak ditemukan.` };
    }

    basePayload = {
      nama_kelompok: groupName,
      ketua: {
        role: "ketua",
        mahasiswa_id: ketua.id,
        nim: ketua.nim,
        nama: ketua.nama,
        email: ketua.email,
        angkatan: ketua.angkatan,
      },
      anggota: memberNims.map((nim, index) => {
        const member = memberByNim.get(nim);
        return {
          role: `anggota_${index + 1}`,
          mahasiswa_id: member.id,
          nim: member.nim,
          nama: member.nama,
          email: member.email,
          angkatan: member.angkatan,
        };
      }),
      persetujuan_anggota: true,
      catatan: normalizeOptionalSubmissionText(rawPayload.catatan),
      dokumen_pendukung: normalizeOptionalSubmissionText(rawPayload.dokumen_pendukung),
    };
  }

  if (jalur === "perintisan_bisnis") {
    const requiredFields = [
      ["nama_bisnis", "Nama bisnis"],
      ["jenis_bisnis", "Jenis bisnis"],
      ["lokasi_bisnis", "Lokasi bisnis"],
      ["deskripsi_bisnis", "Deskripsi bisnis"],
      ["masalah_yang_diselesaikan", "Permasalahan yang ingin diselesaikan"],
      ["produk_layanan", "Produk atau layanan"],
      ["target_konsumen", "Target pengguna atau konsumen"],
      ["model_bisnis", "Model bisnis"],
      ["tahap_perkembangan", "Tahap perkembangan bisnis"],
      ["rencana_kegiatan", "Rencana kegiatan"],
      ["target_luaran", "Target atau luaran"],
    ];
    for (const [field, label] of requiredFields) {
      if (!String(rawPayload[field] || "").trim()) {
        return { error: `${label} wajib diisi.` };
      }
    }

    return {
      payload: {
        ...basePayload,
        nama_bisnis: String(rawPayload.nama_bisnis).trim(),
        jenis_bisnis: String(rawPayload.jenis_bisnis).trim(),
        lokasi_bisnis: String(rawPayload.lokasi_bisnis).trim(),
        deskripsi_bisnis: String(rawPayload.deskripsi_bisnis).trim(),
        masalah_yang_diselesaikan: String(rawPayload.masalah_yang_diselesaikan).trim(),
        produk_layanan: String(rawPayload.produk_layanan).trim(),
        target_konsumen: String(rawPayload.target_konsumen).trim(),
        model_bisnis: String(rawPayload.model_bisnis).trim(),
        tahap_perkembangan: String(rawPayload.tahap_perkembangan).trim(),
        rencana_kegiatan: String(rawPayload.rencana_kegiatan).trim(),
        target_luaran: String(rawPayload.target_luaran).trim(),
        tautan_bisnis: normalizeOptionalSubmissionText(rawPayload.tautan_bisnis),
        ringkasan: `${rawPayload.nama_bisnis} - ${rawPayload.deskripsi_bisnis}`.trim(),
      },
    };
  }

  const requiredFields = [
    ["nama_program", "Nama program atau kegiatan"],
    ["nama_mitra", "Nama mitra atau komunitas"],
    ["jenis_mitra", "Jenis mitra"],
    ["lokasi_pengabdian", "Lokasi pengabdian"],
    ["permasalahan_mitra", "Permasalahan mitra"],
    ["solusi_ditawarkan", "Solusi yang ditawarkan"],
    ["deskripsi_kegiatan", "Deskripsi kegiatan"],
    ["penerima_manfaat", "Sasaran atau penerima manfaat"],
    ["rencana_pelaksanaan", "Rencana pelaksanaan"],
    ["periode_mulai", "Tanggal mulai kegiatan"],
    ["periode_selesai", "Tanggal selesai kegiatan"],
    ["target_luaran", "Target atau luaran"],
    ["indikator_keberhasilan", "Indikator keberhasilan"],
  ];
  for (const [field, label] of requiredFields) {
    if (!String(rawPayload[field] || "").trim()) {
      return { error: `${label} wajib diisi.` };
    }
  }
  if (new Date(rawPayload.periode_mulai).getTime() > new Date(rawPayload.periode_selesai).getTime()) {
    return { error: "Tanggal selesai kegiatan tidak boleh sebelum tanggal mulai." };
  }

  return {
    payload: {
      ...basePayload,
      nama_program: String(rawPayload.nama_program).trim(),
      nama_mitra: String(rawPayload.nama_mitra).trim(),
      jenis_mitra: String(rawPayload.jenis_mitra).trim(),
      lokasi_pengabdian: String(rawPayload.lokasi_pengabdian).trim(),
      kontak_mitra: normalizeOptionalSubmissionText(rawPayload.kontak_mitra),
      permasalahan_mitra: String(rawPayload.permasalahan_mitra).trim(),
      solusi_ditawarkan: String(rawPayload.solusi_ditawarkan).trim(),
      deskripsi_kegiatan: String(rawPayload.deskripsi_kegiatan).trim(),
      penerima_manfaat: String(rawPayload.penerima_manfaat).trim(),
      rencana_pelaksanaan: String(rawPayload.rencana_pelaksanaan).trim(),
      periode_mulai: String(rawPayload.periode_mulai).trim(),
      periode_selesai: String(rawPayload.periode_selesai).trim(),
      target_luaran: String(rawPayload.target_luaran).trim(),
      indikator_keberhasilan: String(rawPayload.indikator_keberhasilan).trim(),
      ringkasan: `${rawPayload.nama_program} - ${rawPayload.deskripsi_kegiatan}`.trim(),
    },
  };
}

function normalizeWorkflowStatusLabel(status) {
  const normalized = String(status || "").trim().toLowerCase();
  if (!normalized) return "-";
  if (normalized === "review_dosen_magang") return "Menunggu Review Dosen Pengawas Magang";
  if (normalized === "review_sekprodi") return "Menunggu Keputusan Final Sekprodi";
  return normalized
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function toObjectPayload(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value;
}

function appendWorkflowTimeline(payload, entry) {
  const basePayload = toObjectPayload(payload);
  const timeline = Array.isArray(basePayload.workflow_timeline)
    ? [...basePayload.workflow_timeline]
    : [];
  timeline.push(entry);

  return {
    ...basePayload,
    workflow_timeline: timeline,
  };
}

function isPrimaryPerintisanSubmission(item) {
  const payload = toObjectPayload(item?.form_lanjutan_payload);
  return payload?.jalur !== "perintisan_bisnis" || payload?.kelompok?.is_ketua !== false;
}

async function updatePerintisanGroupWorkflow({
  sourceRow,
  nextStatus,
  nextPayload,
  transaction,
}) {
  const sourcePayload = toObjectPayload(sourceRow?.form_lanjutan_payload);
  const kelompok = sourcePayload?.kelompok;
  const teamMembers = Array.isArray(kelompok?.anggota) ? kelompok.anggota : [];
  if (sourcePayload?.jalur !== "perintisan_bisnis" || !kelompok?.id || teamMembers.length === 0) {
    await sourceRow.update(
      {
        form_lanjutan_status: nextStatus,
        form_lanjutan_payload: nextPayload,
      },
      { transaction }
    );
    return false;
  }

  const rows = await PendaftaranPenjaluran.findAll({
    where: {
      id: { [Op.in]: teamMembers.map((item) => item.pendaftaran_id) },
    },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  for (const row of rows) {
    const currentPayload = toObjectPayload(row.form_lanjutan_payload);
    await row.update(
      {
        form_lanjutan_status: nextStatus,
        form_lanjutan_payload: {
          ...nextPayload,
          kelompok: {
            ...nextPayload.kelompok,
            is_ketua: currentPayload?.kelompok?.is_ketua === true,
            current_peran_tim:
              currentPayload?.kelompok?.current_peran_tim ||
              nextPayload?.kelompok?.current_peran_tim ||
              null,
          },
        },
      },
      { transaction }
    );
  }
  await KelompokPerintisanBisnis.update(
    {
      status: ["approved", "rejected"].includes(nextStatus)
        ? nextStatus
        : "submitted",
    },
    { where: { id: kelompok.id }, transaction }
  );
  return true;
}

function resolveNonPenelitianPengampuByJalur(periode, jalur) {
  const normalizedJalur = String(jalur || "").trim().toLowerCase();
  if (!periode || !normalizedJalur) {
    return { dosen_id: null, role: null };
  }

  if (normalizedJalur === "magang") {
    return { dosen_id: Number(periode.pengawas_magang_dosen_id || 0) || null, role: "pengawas_magang" };
  }
  if (normalizedJalur === "pengabdian") {
    return {
      dosen_id: Number(periode.pengawas_pengabdian_dosen_id || 0) || null,
      role: "pengampu_pengabdian",
    };
  }
  if (normalizedJalur === "perintisan_bisnis") {
    return {
      dosen_id: Number(periode.pengawas_perintisan_bisnis_dosen_id || 0) || null,
      role: "pengampu_perintisan_bisnis",
    };
  }

  return { dosen_id: null, role: null };
}

function isNonPenelitianJalur(jalur) {
  return NON_PENELITIAN_JALUR_SET.has(String(jalur || "").trim().toLowerCase());
}

function toNonPenelitianReviewResponse(item) {
  const payload = toObjectPayload(item.form_lanjutan_payload);
  const jalur = resolveSelectedJalurFromPendaftaran(item);
  const assignedPengampu = resolveNonPenelitianPengampuByJalur(item.periode, jalur);

  return {
    id: item.id,
    program_kuliah: item.program_kuliah,
    jalur,
    form_lanjutan_status: item.form_lanjutan_status,
    workflow_status: payload.workflow_status || item.form_lanjutan_status,
    workflow_status_label: normalizeWorkflowStatusLabel(payload.workflow_status || item.form_lanjutan_status),
    submitted_at: item.form_lanjutan_submitted_at,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
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
          status: item.periode.status,
          is_active: item.periode.is_active,
        }
      : null,
    reviewer_target: {
      dosen_id: assignedPengampu.dosen_id,
      role: assignedPengampu.role,
    },
    payload,
  };
}

const DOSEN_NON_PENELITIAN_REVIEW_CONFIG = {
  magang: {
    label: "magang",
    reviewStatus: "review_dosen_magang",
    periodeField: "pengawas_magang_dosen_id",
    actor: "dosen_pengawas_magang",
    assignedError: "Akses ditolak. Anda bukan dosen pengawas magang untuk periode ini.",
    statusError: (status) => `Form magang sudah diproses. Status saat ini: ${status}`,
    approvedMessage: "Form magang disetujui dosen pengawas dan diteruskan ke sekretaris prodi.",
    rejectedMessage: "Form magang ditolak oleh dosen pengawas.",
    defaultApproveNote: "Disetujui dosen pengawas magang dan diteruskan ke sekretaris prodi.",
    defaultRejectNote: "Ditolak dosen pengawas magang.",
  },
  pengabdian: {
    label: "pengabdian masyarakat",
    reviewStatus: "submitted",
    periodeField: "pengawas_pengabdian_dosen_id",
    actor: "dosen_pengampu_pengabdian",
    assignedError: "Akses ditolak. Anda bukan dosen pengampu pengabdian masyarakat untuk periode ini.",
    statusError: (status) => `Form pengabdian masyarakat sudah diproses. Status saat ini: ${status}`,
    approvedMessage: "Form pengabdian masyarakat berhasil disetujui dosen pengampu.",
    rejectedMessage: "Form pengabdian masyarakat ditolak oleh dosen pengampu.",
    defaultApproveNote: "Disetujui dosen pengampu pengabdian masyarakat.",
    defaultRejectNote: "Ditolak dosen pengampu pengabdian masyarakat.",
  },
  perintisan_bisnis: {
    label: "perintisan bisnis",
    reviewStatus: "submitted",
    periodeField: "pengawas_perintisan_bisnis_dosen_id",
    actor: "dosen_pengampu_perintisan_bisnis",
    assignedError: "Akses ditolak. Anda bukan dosen pengampu perintisan bisnis untuk periode ini.",
    statusError: (status) => `Form perintisan bisnis sudah diproses. Status saat ini: ${status}`,
    approvedMessage: "Form perintisan bisnis disetujui dosen pengampu dan diteruskan ke sekretaris prodi.",
    rejectedMessage: "Form perintisan bisnis ditolak oleh dosen pengampu.",
    defaultApproveNote: "Disetujui dosen pengampu perintisan bisnis dan diteruskan ke sekretaris prodi.",
    defaultRejectNote: "Ditolak dosen pengampu perintisan bisnis.",
  },
};

function getDosenNonPenelitianReviewConfig(jalur) {
  return DOSEN_NON_PENELITIAN_REVIEW_CONFIG[String(jalur || "").trim().toLowerCase()] || null;
}

async function getNonPenelitianSubmissionForReview(id, transaction, lock = false) {
  return PendaftaranPenjaluran.findByPk(id, {
    transaction,
    lock: lock ? transaction.LOCK.UPDATE : undefined,
    include: [
      {
        model: Mahasiswa,
        as: "mahasiswa",
        attributes: ["id", "nim", "nama", "email", "angkatan", "status_jalur_saat_ini"],
        required: true,
      },
      {
        model: PeriodePenjaluran,
        as: "periode",
        attributes: [
          "id",
          "label_periode",
          "tahun_akademik",
          "semester",
          "status",
          "is_active",
          "pengawas_magang_dosen_id",
          "pengawas_pengabdian_dosen_id",
          "pengawas_perintisan_bisnis_dosen_id",
        ],
        required: true,
      },
    ],
  });
}

function ensureReviewableNonPenelitian(pendaftaran) {
  const selectedJalur = resolveSelectedJalurFromPendaftaran(pendaftaran);
  if (!isNonPenelitianJalur(selectedJalur)) {
    return {
      ok: false,
      statusCode: 409,
      message: "Pendaftaran ini bukan jalur non-penelitian.",
    };
  }

  if (!NON_PENELITIAN_WORKFLOW_STATUS.has(String(pendaftaran.form_lanjutan_status || "").trim().toLowerCase())) {
    return {
      ok: false,
      statusCode: 409,
      message: "Status form lanjutan tidak valid untuk jalur non-penelitian.",
    };
  }

  return { ok: true, selectedJalur };
}

function buildTopikValidationError({ slot, kode, inputJudul, inputDosen, topikDb }) {
  if (!topikDb) {
    return {
      isValid: false,
      message: `Topik pilihan ${slot} dengan kode ${kode} tidak ditemukan`,
      detail: {
        slot,
        field: "kode",
        kode,
      },
    };
  }

  if (!topikDb.dosen) {
    return {
      isValid: false,
      message: `Topik pilihan ${slot} (${kode}) tidak memiliki data dosen pembimbing`,
      detail: {
        slot,
        field: "dosen",
        kode,
      },
    };
  }

  if (topikDb.status !== "available") {
    return {
      isValid: false,
      message: `Topik pilihan ${slot} (${kode}) ${getTopikStatusMessage(topikDb.status)}`,
      detail: {
        slot,
        field: "status",
        kode,
        status: topikDb.status,
      },
    };
  }

  if (inputJudul && normalizeText(inputJudul) !== normalizeText(topikDb.judul)) {
    return {
      isValid: false,
      message: `Data topik pilihan ${slot} tidak sesuai dengan database`,
      detail: {
        slot,
        field: "judul",
        kode,
        input: inputJudul,
        expected: topikDb.judul,
      },
    };
  }

  if (inputDosen && normalizeText(inputDosen) !== normalizeText(topikDb.dosen.nama)) {
    return {
      isValid: false,
      message: `Data topik pilihan ${slot} tidak sesuai dengan database`,
      detail: {
        slot,
        field: "dosen",
        kode,
        input: inputDosen,
        expected: topikDb.dosen.nama,
      },
    };
  }

  return { isValid: true };
}

async function reserveTopikKodes(topikKodes, transaction) {
  if (!topikKodes || topikKodes.length === 0) {
    return { ok: true };
  }

  const [affected] = await Topik.update(
    { status: "reserved" },
    {
      where: {
        kode: { [Op.in]: topikKodes },
        status: "available",
      },
      transaction,
    }
  );

  if (affected !== topikKodes.length) {
    return { ok: false };
  }

  return { ok: true };
}

async function validateSemesterLanjutanGate(mahasiswa, transaction, { allowUlangFlow = false } = {}) {
  const gate = await buildSemesterLanjutanGate(mahasiswa, transaction);

  if (!gate?.is_locked) {
    return { allowed: true, gate };
  }

  if (allowUlangFlow && gate.must_ulang_jalur) {
    return { allowed: true, gate };
  }

  return {
    allowed: false,
    gate,
    message: gate.message || "Akses pengajuan dikunci sampai izin melanjutkan skripsi disetujui.",
  };
}

// ========== CEK STATUS & ELIGIBILITY ==========

// GET /api/jalur/status - Cek status jalur mahasiswa
exports.checkStatusJalur = async (req, res) => {
  try {
    const mahasiswa_id = req.user.id;

    // Ambil data mahasiswa lengkap
    const mahasiswa = await Mahasiswa.findByPk(mahasiswa_id, {
      attributes: ["id", "nim", "nama", "status_jalur_saat_ini", "dosen_pembimbing_akademik_id", "dosen_pembimbing_skripsi_id", "pengajuan_aktif_id"],
      include: [
        {
          model: Pengajuan,
          as: "pengajuanAktif",
          attributes: ["id", "jenis_jalur", "tipe_pengajuan", "status"],
        },
      ],
    });

    if (!mahasiswa) {
      return res.status(404).json({
        success: false,
        message: "Data mahasiswa tidak ditemukan",
      });
    }

    // Cek pengajuan terakhir
    const lastSubmission = await Pengajuan.findOne({
      where: { mahasiswa_id },
      order: [["createdAt", "DESC"]],
      include: [
        {
          model: Dosen,
          as: "dosenCurrent",
          attributes: ["id", "nama", "nik"],
        },
      ],
    });

    // Cek apakah ada pengajuan aktif
    const hasActiveSubmission = mahasiswa.pengajuan_aktif_id !== null;

    // Cek status pamit ulang (jika ada)
    const activePamit = await PamitUlang.findOne({
      where: {
        mahasiswa_id,
        pengajuan_baru_id: null,
      },
      order: [["createdAt", "DESC"]],
    });
    const periodeAktif = await getActivePeriodePenjaluran();
    const pendaftaranAktif = await getLatestPendaftaranForPeriode(
      mahasiswa_id,
      periodeAktif?.id || null
    );
    const selectedJalur = resolveSelectedJalurFromPendaftaran(pendaftaranAktif);
    const kelompokPerintisan =
      selectedJalur === "perintisan_bisnis" && pendaftaranAktif
        ? formatKelompokPerintisan(
            await getKelompokPerintisanByPendaftaranId(pendaftaranAktif.id)
          )
        : null;
    const nonPenelitianPayload = toObjectPayload(pendaftaranAktif?.form_lanjutan_payload);
    const nonPenelitianWorkflowStatus =
      nonPenelitianPayload.workflow_status || pendaftaranAktif?.form_lanjutan_status || null;

    const semesterLanjutanGate = await buildSemesterLanjutanGate(mahasiswa);

    // Eligibility rules
    const availableOptions = {
      baru: !hasActiveSubmission && mahasiswa.status_jalur_saat_ini === "belum_mengajukan",

      ulang: !hasActiveSubmission && lastSubmission !== null && lastSubmission.status === "approved" && mahasiswa.dosen_pembimbing_skripsi_id !== null,

      ekstensi: !hasActiveSubmission && lastSubmission !== null && lastSubmission.status === "approved" && mahasiswa.status_jalur_saat_ini === "ekstensi",
    };

    res.json({
      success: true,
      data: {
        current_status: mahasiswa.status_jalur_saat_ini,
        has_active_submission: hasActiveSubmission,
        has_dospem_akademik: mahasiswa.dosen_pembimbing_akademik_id !== null,
        has_dospem_skripsi: mahasiswa.dosen_pembimbing_skripsi_id !== null,
        active_pamit: activePamit
          ? {
              id: activePamit.id,
              status_dospem: activePamit.status_dospem,
              keterangan_dospem: activePamit.keterangan_dospem,
              alasan_ulang: activePamit.alasan_ulang,
              pesan_ke_dosen_pembimbing: activePamit.pesan_ke_dosen_pembimbing,
              tanggal: activePamit.createdAt,
            }
          : null,
        pendaftaran_aktif: pendaftaranAktif
          ? {
              id: pendaftaranAktif.id,
              jalur_daftar: pendaftaranAktif.jalur,
              jalur_form_lanjutan: selectedJalur,
              status: pendaftaranAktif.status,
              form_lanjutan_status: pendaftaranAktif.form_lanjutan_status,
              form_lanjutan_submitted_at: pendaftaranAktif.form_lanjutan_submitted_at,
              kelompok_perintisan: kelompokPerintisan,
              periode:
                periodeAktif
                  ? {
                      id: periodeAktif.id,
                      label_periode: periodeAktif.label_periode,
                      tahun_akademik: periodeAktif.tahun_akademik,
                      semester: periodeAktif.semester,
                    }
                  : null,
            }
          : null,
        non_penelitian_form:
          pendaftaranAktif && isNonPenelitianJalur(selectedJalur)
            ? {
                jalur: selectedJalur,
                status: pendaftaranAktif.form_lanjutan_status,
                workflow_status: nonPenelitianWorkflowStatus,
                workflow_status_label: normalizeWorkflowStatusLabel(nonPenelitianWorkflowStatus),
                submitted_at: pendaftaranAktif.form_lanjutan_submitted_at,
                payload: nonPenelitianPayload,
                timeline: Array.isArray(nonPenelitianPayload.workflow_timeline)
                  ? nonPenelitianPayload.workflow_timeline
                  : [],
              }
            : null,
        last_submission: lastSubmission
          ? {
              id: lastSubmission.id,
              status: lastSubmission.status,
              jenis_jalur: lastSubmission.jenis_jalur,
              tipe_pengajuan: lastSubmission.tipe_pengajuan,
              tanggal: lastSubmission.createdAt,
              dosen_pembimbing: lastSubmission.dosenCurrent,
            }
          : null,
        available_options: availableOptions,
        semester_lanjutan_gate: semesterLanjutanGate,
      },
    });
  } catch (error) {
    console.error("Error di checkStatusJalur:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// GET /api/jalur/eligibility - Eligibility jalur/form lanjutan per mahasiswa
exports.getJalurEligibility = async (req, res) => {
  try {
    const mahasiswa_id = req.user.id;

    const mahasiswa = await Mahasiswa.findByPk(mahasiswa_id, {
      attributes: [
        "id",
        "nim",
        "nama",
        "status_jalur_saat_ini",
        "pengajuan_aktif_id",
      ],
    });

    if (!mahasiswa) {
      return res.status(404).json({
        success: false,
        message: "Data mahasiswa tidak ditemukan",
      });
    }

    const periodeAktif = await getActivePeriodePenjaluran();
    const pendaftaranAktif = await getLatestPendaftaranForPeriode(
      mahasiswa_id,
      periodeAktif?.id || null
    );
    const selectedJalur = resolveSelectedJalurFromPendaftaran(pendaftaranAktif);
    const kelompokPerintisan =
      selectedJalur === "perintisan_bisnis" && pendaftaranAktif
        ? formatKelompokPerintisan(
            await getKelompokPerintisanByPendaftaranId(pendaftaranAktif.id)
          )
        : null;
    const hasActivePengajuan = Boolean(mahasiswa.pengajuan_aktif_id);
    const hasPenelitianSubmission = selectedJalur === "penelitian"
      ? await hasPenelitianSubmissionForPendaftaran(mahasiswa_id, pendaftaranAktif)
      : false;

    const jalurList = ["penelitian", "magang", "pengabdian", "perintisan_bisnis"];
    const jalurEligibility = {};
    jalurList.forEach((jalur) => {
      jalurEligibility[jalur] = {
        enabled: false,
        reason: "Belum dapat dipilih.",
      };
    });

    let onboardingLocked = false;
    let onboardingReason = "";
    let onboardingTargetForm = selectedJalur ? resolveTargetFormFromJalur(selectedJalur) : null;

    if (!periodeAktif) {
      jalurList.forEach((jalur) => {
        jalurEligibility[jalur] = {
          enabled: false,
          reason: "Periode pendaftaran belum aktif.",
        };
      });
      onboardingLocked = false;
    } else if (!selectedJalur) {
      // Backward compatibility untuk akun lama yang belum punya data pendaftaran periode aktif.
      jalurEligibility.penelitian = {
        enabled: mahasiswa.status_jalur_saat_ini === "belum_mengajukan" && !hasActivePengajuan,
        reason:
          mahasiswa.status_jalur_saat_ini === "belum_mengajukan" && !hasActivePengajuan
            ? ""
            : "Mahasiswa sudah memiliki pengajuan aktif.",
      };

      if (!jalurEligibility.penelitian.enabled) {
        jalurList
          .filter((jalur) => jalur !== "penelitian")
          .forEach((jalur) => {
            jalurEligibility[jalur] = {
              enabled: false,
              reason: "Akun lama tanpa data pendaftaran jalur periode aktif.",
            };
          });
      }

      onboardingLocked = false;
    } else {
      const alreadySubmittedNonPenelitian = !["pending", "draft"].includes(
        String(pendaftaranAktif?.form_lanjutan_status || "")
      );
      const alreadySubmittedPenelitian = hasPenelitianSubmission || hasActivePengajuan;
      const targetSubmitted =
        selectedJalur === "penelitian" ? alreadySubmittedPenelitian : alreadySubmittedNonPenelitian;
      const registrationApproved = String(pendaftaranAktif?.status || "") === "approved";
      const isPerintisanMember =
        selectedJalur === "perintisan_bisnis" && kelompokPerintisan && !kelompokPerintisan.is_ketua;

      jalurList.forEach((jalur) => {
        if (jalur === selectedJalur) {
          jalurEligibility[jalur] = {
            enabled: registrationApproved && !targetSubmitted && !isPerintisanMember,
            reason: !registrationApproved
              ? pendaftaranAktif?.status === "rejected"
                ? "Pendaftaran kelompok ditolak oleh sekretaris prodi."
                : "Menunggu verifikasi kelompok oleh sekretaris prodi."
              : targetSubmitted
              ? "Form jalur ini sudah pernah disubmit pada periode aktif."
              : isPerintisanMember
                ? "Form Perintisan Bisnis diisi dan dikirim oleh ketua kelompok."
                : "",
          };
          return;
        }

        jalurEligibility[jalur] = {
          enabled: false,
          reason: `Mahasiswa sudah terdaftar pada jalur ${formatJalurLabel(selectedJalur)} di periode aktif.`,
        };
      });

      onboardingLocked = !registrationApproved || !targetSubmitted;
      onboardingReason = onboardingLocked
        ? !registrationApproved
          ? pendaftaranAktif?.status === "rejected"
            ? "Pendaftaran kelompok ditolak oleh sekretaris prodi."
            : "Menunggu verifikasi kelompok oleh sekretaris prodi."
          : isPerintisanMember
          ? "Menunggu ketua kelompok menyelesaikan form Perintisan Bisnis."
          : `Selesaikan form ${formatJalurLabel(selectedJalur)} terlebih dahulu sebelum membuka menu lain.`
        : "";
    }

    return res.json({
      success: true,
      data: {
        periode_aktif: periodeAktif
          ? {
              id: periodeAktif.id,
              label_periode: periodeAktif.label_periode,
              tahun_akademik: periodeAktif.tahun_akademik,
              semester: periodeAktif.semester,
              status: periodeAktif.status,
              is_active: periodeAktif.is_active,
            }
          : null,
        pendaftaran_aktif: pendaftaranAktif
          ? {
              id: pendaftaranAktif.id,
              jalur: pendaftaranAktif.jalur,
              selected_jalur: selectedJalur,
              status: pendaftaranAktif.status,
              form_lanjutan_status: pendaftaranAktif.form_lanjutan_status || "draft",
              submitted_at: pendaftaranAktif.form_lanjutan_submitted_at,
              created_at: pendaftaranAktif.createdAt,
              kelompok_perintisan: kelompokPerintisan,
            }
          : null,
        onboarding: {
          is_locked: onboardingLocked,
          target_jalur: selectedJalur,
          target_form: onboardingTargetForm,
          reason: onboardingReason,
        },
        jalur_eligibility: jalurEligibility,
        flags: {
          has_active_pengajuan: hasActivePengajuan,
          has_penelitian_submission: hasPenelitianSubmission,
        },
      },
    });
  } catch (error) {
    console.error("Error di getJalurEligibility:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// GET /api/jalur/izin-lanjut/status - Status Permohonan Extend semester ke-3
exports.getIzinLanjutStatus = async (req, res) => {
  try {
    const mahasiswa_id = req.user.id;

    const mahasiswa = await Mahasiswa.findByPk(mahasiswa_id, {
      attributes: ["id", "nim", "nama", "status_jalur_saat_ini", "dosen_pembimbing_skripsi_id"],
      include: [
        {
          model: Dosen,
          as: "dosenPembimbingSkripsi",
          attributes: ["id", "nik", "nama", "email"],
          required: false,
        },
      ],
    });

    if (!mahasiswa) {
      return res.status(404).json({
        success: false,
        message: "Data mahasiswa tidak ditemukan",
      });
    }

    const gate = await buildSemesterLanjutanGate(mahasiswa);
    const riwayat = await IzinLanjutSkripsi.findAll({
      where: { mahasiswa_id },
      include: [
        {
          model: Dosen,
          as: "dosenPembimbingSkripsi",
          attributes: ["id", "nik", "nama", "email"],
          required: false,
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    return res.json({
      success: true,
      data: {
        mahasiswa: {
          id: mahasiswa.id,
          nim: mahasiswa.nim,
          nama: mahasiswa.nama,
          status_jalur_saat_ini: mahasiswa.status_jalur_saat_ini,
          dosen_pembimbing_skripsi: mahasiswa.dosenPembimbingSkripsi
            ? {
                id: mahasiswa.dosenPembimbingSkripsi.id,
                nik: mahasiswa.dosenPembimbingSkripsi.nik,
                nama: mahasiswa.dosenPembimbingSkripsi.nama,
                email: mahasiswa.dosenPembimbingSkripsi.email,
              }
            : null,
        },
        gate,
        riwayat: riwayat.map((item) => toIzinResponse(item)),
      },
    });
  } catch (error) {
    console.error("Error di getIzinLanjutStatus:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// POST /api/jalur/izin-lanjut - Mahasiswa mengajukan permohonan extend semester ke-3
exports.submitIzinLanjutSemester = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const mahasiswa_id = req.user.id;
    const alasan_pengajuan = String(req.body?.alasan_pengajuan || "").trim();

    if (!alasan_pengajuan || alasan_pengajuan.length < 10) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Alasan pengajuan wajib diisi minimal 10 karakter.",
      });
    }

    const mahasiswa = await Mahasiswa.findByPk(mahasiswa_id, {
      attributes: ["id", "nim", "nama", "status_jalur_saat_ini", "dosen_pembimbing_skripsi_id"],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!mahasiswa) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Data mahasiswa tidak ditemukan",
      });
    }

    const gate = await buildSemesterLanjutanGate(mahasiswa, t);

    if (!gate.is_semester_tiga_plus) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Belum memasuki semester penjaluran ke-3, permohonan extend belum diperlukan.",
        detail: gate,
      });
    }

    if (!gate.can_submit_izin) {
      await t.rollback();
      return res.status(409).json({
        success: false,
        message: gate.message,
        detail: gate,
      });
    }

    if (!mahasiswa.dosen_pembimbing_skripsi_id) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Dosen pembimbing skripsi belum ditetapkan. Permohonan extend belum bisa diajukan.",
      });
    }

    const periodeReferensi = gate.reference_periode || (await getReferencePeriode(t));

    const izin = await IzinLanjutSkripsi.create(
      {
        mahasiswa_id,
        dosen_pembimbing_skripsi_id: mahasiswa.dosen_pembimbing_skripsi_id,
        periode_penjaluran_id: periodeReferensi?.id || null,
        semester_penjaluran_ke: gate.semester_penjaluran_aktif,
        status: "pending",
        alasan_pengajuan,
        tanggal_pengajuan: new Date(),
      },
      { transaction: t }
    );

    await t.commit();

    const withDetail = await IzinLanjutSkripsi.findByPk(izin.id, {
      include: [
        {
          model: Dosen,
          as: "dosenPembimbingSkripsi",
          attributes: ["id", "nik", "nama", "email"],
          required: false,
        },
      ],
    });

    return res.status(201).json({
      success: true,
      message: "Permintaan izin melanjutkan skripsi berhasil dikirim. Menunggu keputusan dosen pembimbing skripsi.",
      data: toIzinResponse(withDetail),
    });
  } catch (error) {
    if (!t.finished) await t.rollback();
    console.error("Error di submitIzinLanjutSemester:", error);

    if (error?.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        success: false,
        message: "Permintaan izin untuk semester penjaluran ini sudah pernah diajukan.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// POST /api/jalur/non-penelitian/submit - Submit form jalur non-penelitian (magang/pengabdian/perintisan bisnis)
exports.submitFormNonPenelitian = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const mahasiswa_id = req.user.id;
    const mahasiswa = await Mahasiswa.findByPk(mahasiswa_id, { transaction: t, lock: t.LOCK.UPDATE });

    if (!mahasiswa) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Data mahasiswa tidak ditemukan",
      });
    }

    const semesterGateCheck = await validateSemesterLanjutanGate(mahasiswa, t, {
      allowUlangFlow: true,
    });
    if (!semesterGateCheck.allowed) {
      await t.rollback();
      return res.status(403).json({
        success: false,
        message: semesterGateCheck.message,
        detail: semesterGateCheck.gate,
      });
    }

    const requestedJalur = String(req.body?.jalur || "").trim().toLowerCase().replace(/\s+/g, "_");
    if (!requestedJalur || requestedJalur === "penelitian") {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Endpoint ini hanya untuk jalur non-penelitian.",
      });
    }

    if (!["magang", "pengabdian", "perintisan_bisnis"].includes(requestedJalur)) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Pilihan jalur non-penelitian tidak valid.",
      });
    }

    const gate = await validateSubmissionTargetJalur({
      mahasiswa,
      transaction: t,
      targetJalur: requestedJalur,
      requireNonPenelitianNotSubmitted: true,
    });

    if (!gate.allowed) {
      await t.rollback();
      return res.status(gate.statusCode || 409).json({
        success: false,
        message: gate.message,
        code: gate.code,
        detail: gate.detail || null,
      });
    }

    if (mahasiswa.pengajuan_aktif_id) {
      await t.rollback();
      return res.status(409).json({
        success: false,
        message: "Anda sudah memiliki pengajuan aktif. Jalur lain tidak dapat diajukan.",
      });
    }

    let payloadToSave = {};
    if (requestedJalur === "magang") {
      payloadToSave = normalizeMagangSubmissionPayload(req.body?.payload || {});
      const activeMitraNameSet = await getActiveMitraMagangNameSet(t);
      const validationResult = validateMagangSubmissionPayload(payloadToSave, activeMitraNameSet);
      if (validationResult.message) {
        await t.rollback();
        return res.status(validationResult.statusCode || 400).json({
          success: false,
          message: validationResult.message,
        });
      }

      const isNonPartner = payloadToSave.company_type === "non_partner_company";
      const selectedMitra = !isNonPartner
        ? await findActiveMitraMagangByNama(payloadToSave.chosen_institution, t)
        : null;
      payloadToSave.mitra_id = selectedMitra ? selectedMitra.id : null;
      payloadToSave.mitra_snapshot = selectedMitra
        ? {
            id: selectedMitra.id,
            nama: selectedMitra.nama,
            bidang_jenis: selectedMitra.bidang_jenis || null,
            lokasi: selectedMitra.lokasi || null,
            email_kontak: selectedMitra.email_kontak || null,
            website: selectedMitra.website || null,
            posisi_magang: selectedMitra.posisi_magang || null,
            quota_magang: selectedMitra.quota_magang || null,
            kriteria: selectedMitra.kriteria || null,
            prosedur_perusahaan: selectedMitra.prosedur_perusahaan || null,
            is_active: selectedMitra.is_active !== false,
          }
        : null;
    } else {
      const rawPayload = req.body?.payload || {};
      if (!rawPayload || typeof rawPayload !== "object" || Array.isArray(rawPayload)) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: "Payload form jalur non-penelitian tidak valid.",
        });
      }
      const normalizedKelompok = await normalizeKelompokNonPenelitianPayload({
        rawPayload,
        jalur: requestedJalur,
        ketua: mahasiswa,
        pendaftaran: gate.pendaftaranAktif,
        transaction: t,
      });
      if (normalizedKelompok.error) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: normalizedKelompok.error,
        });
      }
      payloadToSave = normalizedKelompok.payload;
    }

    const now = new Date();
    const workflowStatus =
      requestedJalur === "magang"
        ? payloadToSave.company_type === "non_partner_company"
          ? "review_sekprodi"
          : "review_dosen_magang"
        : "submitted";
    const workflowTimeline =
      requestedJalur === "magang"
        ? [
            {
              status: "submitted",
              actor: "mahasiswa",
              note: "Form magang dikirim oleh mahasiswa.",
              at: now,
            },
            {
              status: workflowStatus,
              actor: "system",
              note:
                workflowStatus === "review_sekprodi"
                  ? "Menunggu review sekretaris prodi (non-mitra)."
                  : "Menunggu review dosen pengawas magang.",
              at: now,
            },
          ]
        : [
            {
              status: "submitted",
              actor: "mahasiswa",
              note: "Form non-penelitian dikirim oleh mahasiswa.",
              at: now,
            },
          ];
    const commonPayload = {
      submitted_at: now,
      workflow_status: workflowStatus,
      workflow_timeline: workflowTimeline,
      jalur: requestedJalur,
      ...payloadToSave,
    };

    if (requestedJalur === "perintisan_bisnis" && payloadToSave.kelompok?.id) {
      const teamMembers = payloadToSave.kelompok.anggota || [];
      for (const member of teamMembers) {
        await PendaftaranPenjaluran.update(
          {
            form_lanjutan_status: workflowStatus,
            form_lanjutan_submitted_at: now,
            form_lanjutan_payload: {
              ...commonPayload,
              kelompok: {
                ...payloadToSave.kelompok,
                is_ketua: member.posisi === "ketua",
                current_peran_tim: member.peran_tim,
              },
            },
          },
          {
            where: { id: member.pendaftaran_id },
            transaction: t,
          }
        );
      }
      await Mahasiswa.update(
        { status_jalur_saat_ini: "sedang_mengajukan" },
        {
          where: { id: { [Op.in]: teamMembers.map((item) => item.mahasiswa_id) } },
          transaction: t,
        }
      );
      await KelompokPerintisanBisnis.update(
        { status: "submitted" },
        { where: { id: payloadToSave.kelompok.id }, transaction: t }
      );
    } else {
      await gate.pendaftaranAktif.update(
        {
          form_lanjutan_status: workflowStatus,
          form_lanjutan_submitted_at: now,
          form_lanjutan_payload: commonPayload,
        },
        { transaction: t }
      );

      await mahasiswa.update(
        {
          status_jalur_saat_ini: "sedang_mengajukan",
        },
        { transaction: t }
      );
    }

    await t.commit();

    return res.status(201).json({
      success: true,
      message:
        requestedJalur === "magang"
          ? workflowStatus === "review_sekprodi"
            ? "Permintaan surat rekomendasi magang berhasil dikirim. Status: menunggu review sekretaris prodi."
            : "Permintaan surat rekomendasi magang berhasil dikirim. Status: menunggu review dosen pengawas magang."
          : "Form jalur non-penelitian berhasil dikirim.",
      data: {
        pendaftaran_id: gate.pendaftaranAktif.id,
        jalur: requestedJalur,
        form_lanjutan_status: workflowStatus,
        submitted_at: now,
      },
    });
  } catch (error) {
    if (!t.finished) await t.rollback();
    console.error("Error di submitFormNonPenelitian:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

async function getNonPenelitianReviewQueueForDosenByJalur(req, res, targetJalur) {
  try {
    const config = getDosenNonPenelitianReviewConfig(targetJalur);
    const dosenId = Number(req.user?.id || 0);
    if (!config || !dosenId) {
      return res.status(401).json({
        success: false,
        message: !config ? "Jalur review dosen tidak valid." : "Autentikasi dosen tidak valid.",
      });
    }

    const rows = await PendaftaranPenjaluran.findAll({
      where: { form_lanjutan_status: config.reviewStatus },
      include: [
        {
          model: Mahasiswa,
          as: "mahasiswa",
          attributes: ["id", "nim", "nama", "email", "angkatan"],
          required: true,
        },
        {
          model: PeriodePenjaluran,
          as: "periode",
          attributes: [
            "id",
            "label_periode",
            "tahun_akademik",
            "semester",
            "status",
            "is_active",
            "pengawas_magang_dosen_id",
            "pengawas_pengabdian_dosen_id",
            "pengawas_perintisan_bisnis_dosen_id",
          ],
          where: { [config.periodeField]: dosenId },
          required: true,
        },
      ],
      order: [["form_lanjutan_submitted_at", "DESC"], ["createdAt", "DESC"]],
    });

    const filtered = rows
      .filter(
        (item) =>
          resolveSelectedJalurFromPendaftaran(item) === targetJalur &&
          isPrimaryPerintisanSubmission(item)
      )
      .map((item) => toNonPenelitianReviewResponse(item));

    return res.json({
      success: true,
      data: filtered,
      total: filtered.length,
    });
  } catch (error) {
    console.error("Error di getNonPenelitianReviewQueueForDosenByJalur:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
}

async function getNonPenelitianReviewDetailForDosenByJalur(req, res, targetJalur) {
  try {
    const config = getDosenNonPenelitianReviewConfig(targetJalur);
    const dosenId = Number(req.user?.id || 0);
    const id = Number(req.params?.id || 0);

    if (!config || !dosenId || !id) {
      return res.status(400).json({
        success: false,
        message: !config ? "Jalur review dosen tidak valid." : "Parameter request tidak valid.",
      });
    }

    const row = await getNonPenelitianSubmissionForReview(id, null, false);
    if (!row) {
      return res.status(404).json({
        success: false,
        message: "Data form non-penelitian tidak ditemukan.",
      });
    }

    const reviewable = ensureReviewableNonPenelitian(row);
    if (!reviewable.ok || reviewable.selectedJalur !== targetJalur) {
      return res.status(reviewable.statusCode || 409).json({
        success: false,
        message: reviewable.message || `Data bukan pengajuan ${config.label}.`,
      });
    }

    const assigned = resolveNonPenelitianPengampuByJalur(row.periode, reviewable.selectedJalur);
    if (!assigned.dosen_id || assigned.dosen_id !== dosenId) {
      return res.status(403).json({
        success: false,
        message: config.assignedError,
      });
    }

    return res.json({
      success: true,
      data: toNonPenelitianReviewResponse(row),
    });
  } catch (error) {
    console.error("Error di getNonPenelitianReviewDetailForDosenByJalur:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
}

async function decideNonPenelitianReviewByDosen(req, res, decision, targetJalur) {
  const t = await sequelize.transaction();
  try {
    const config = getDosenNonPenelitianReviewConfig(targetJalur);
    const dosenId = Number(req.user?.id || 0);
    const id = Number(req.params?.id || 0);
    const note = String(req.body?.keterangan || req.body?.alasan || "").trim();

    if (!config || !dosenId || !id) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: !config ? "Jalur review dosen tidak valid." : "Parameter request tidak valid.",
      });
    }

    if (decision === "rejected" && !note) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Alasan penolakan wajib diisi.",
      });
    }

    const row = await getNonPenelitianSubmissionForReview(id, t, true);
    if (!row) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Data form non-penelitian tidak ditemukan.",
      });
    }

    const reviewable = ensureReviewableNonPenelitian(row);
    if (!reviewable.ok || reviewable.selectedJalur !== targetJalur) {
      await t.rollback();
      return res.status(reviewable.statusCode || 409).json({
        success: false,
        message: reviewable.message || `Data bukan pengajuan ${config.label}.`,
      });
    }

    if (String(row.form_lanjutan_status || "") !== config.reviewStatus) {
      await t.rollback();
      return res.status(409).json({
        success: false,
        message: config.statusError(row.form_lanjutan_status),
      });
    }

    const assigned = resolveNonPenelitianPengampuByJalur(row.periode, reviewable.selectedJalur);
    if (!assigned.dosen_id || assigned.dosen_id !== dosenId) {
      await t.rollback();
      return res.status(403).json({
        success: false,
        message: config.assignedError,
      });
    }

    const now = new Date();
    const payloadWithTimeline = appendWorkflowTimeline(row.form_lanjutan_payload, {
      status: decision,
      actor: config.actor,
      actor_id: dosenId,
      note: note || (decision === "approved" ? config.defaultApproveNote : config.defaultRejectNote),
      at: now,
    });

    const requiresSekprodiFinal = ["magang", "perintisan_bisnis"].includes(targetJalur);
    const nextStatus =
      requiresSekprodiFinal && decision === "approved"
        ? "review_sekprodi"
        : decision;
    const nextPayload = {
      ...payloadWithTimeline,
      workflow_status: nextStatus,
      review_dosen_pengampu: {
        status: decision,
        decided_at: now,
        decided_by: {
          role: "dosen",
          dosen_id: dosenId,
        },
        note: note || null,
      },
    };
    if (nextStatus === "review_sekprodi") {
      nextPayload.workflow_timeline = [
        ...(Array.isArray(nextPayload.workflow_timeline) ? nextPayload.workflow_timeline : []),
        {
          status: "review_sekprodi",
          actor: "system",
          note:
            targetJalur === "perintisan_bisnis"
              ? "Menunggu keputusan final sekretaris prodi dan penetapan dosen pembimbing kelompok."
              : "Menunggu keputusan final sekretaris prodi.",
          at: now,
        },
      ];
    }

    await updatePerintisanGroupWorkflow({
      sourceRow: row,
      nextStatus,
      nextPayload,
      transaction: t,
    });
    await row.reload({ transaction: t });

    await t.commit();
    return res.json({
      success: true,
      message: decision === "approved" ? config.approvedMessage : config.rejectedMessage,
      data: toNonPenelitianReviewResponse(row),
    });
  } catch (error) {
    if (!t.finished) await t.rollback();
    console.error("Error di decideNonPenelitianReviewByDosen:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
}

// GET /api/dosen/non-penelitian/magang/reviews - Antrian review magang (partner) untuk dosen pengawas magang
exports.getMagangReviewQueueForDosen = async (req, res) =>
  getNonPenelitianReviewQueueForDosenByJalur(req, res, "magang");

// GET /api/dosen/non-penelitian/magang/reviews/:id
exports.getMagangReviewDetailForDosen = async (req, res) =>
  getNonPenelitianReviewDetailForDosenByJalur(req, res, "magang");

// POST /api/dosen/non-penelitian/magang/reviews/:id/approve
exports.approveMagangReviewByDosen = async (req, res) =>
  decideNonPenelitianReviewByDosen(req, res, "approved", "magang");

// POST /api/dosen/non-penelitian/magang/reviews/:id/reject
exports.rejectMagangReviewByDosen = async (req, res) =>
  decideNonPenelitianReviewByDosen(req, res, "rejected", "magang");

// GET /api/dosen/non-penelitian/pengabdian/reviews
exports.getPengabdianReviewQueueForDosen = async (req, res) =>
  getNonPenelitianReviewQueueForDosenByJalur(req, res, "pengabdian");

// GET /api/dosen/non-penelitian/pengabdian/reviews/:id
exports.getPengabdianReviewDetailForDosen = async (req, res) =>
  getNonPenelitianReviewDetailForDosenByJalur(req, res, "pengabdian");

// POST /api/dosen/non-penelitian/pengabdian/reviews/:id/approve
exports.approvePengabdianReviewByDosen = async (req, res) =>
  decideNonPenelitianReviewByDosen(req, res, "approved", "pengabdian");

// POST /api/dosen/non-penelitian/pengabdian/reviews/:id/reject
exports.rejectPengabdianReviewByDosen = async (req, res) =>
  decideNonPenelitianReviewByDosen(req, res, "rejected", "pengabdian");

// GET /api/dosen/non-penelitian/perintisan-bisnis/reviews
exports.getPerintisanBisnisReviewQueueForDosen = async (req, res) =>
  getNonPenelitianReviewQueueForDosenByJalur(req, res, "perintisan_bisnis");

// GET /api/dosen/non-penelitian/perintisan-bisnis/reviews/:id
exports.getPerintisanBisnisReviewDetailForDosen = async (req, res) =>
  getNonPenelitianReviewDetailForDosenByJalur(req, res, "perintisan_bisnis");

// POST /api/dosen/non-penelitian/perintisan-bisnis/reviews/:id/approve
exports.approvePerintisanBisnisReviewByDosen = async (req, res) =>
  decideNonPenelitianReviewByDosen(req, res, "approved", "perintisan_bisnis");

// POST /api/dosen/non-penelitian/perintisan-bisnis/reviews/:id/reject
exports.rejectPerintisanBisnisReviewByDosen = async (req, res) =>
  decideNonPenelitianReviewByDosen(req, res, "rejected", "perintisan_bisnis");

// GET /api/sekretaris/non-penelitian/reviews - Antrian review non-penelitian untuk sekretaris prodi
exports.getNonPenelitianReviewQueueForSekretaris = async (req, res) => {
  try {
    const programKuliah = String(req.user?.program_kuliah || "").trim().toLowerCase();
    const rows = await PendaftaranPenjaluran.findAll({
      where: {
        form_lanjutan_status: "review_sekprodi",
        program_kuliah: programKuliah,
      },
      include: [
        {
          model: Mahasiswa,
          as: "mahasiswa",
          attributes: ["id", "nim", "nama", "email", "angkatan"],
          required: true,
        },
        {
          model: PeriodePenjaluran,
          as: "periode",
          attributes: [
            "id",
            "label_periode",
            "tahun_akademik",
            "semester",
            "status",
            "is_active",
            "pengawas_magang_dosen_id",
            "pengawas_pengabdian_dosen_id",
            "pengawas_perintisan_bisnis_dosen_id",
          ],
          required: true,
        },
      ],
      order: [["form_lanjutan_submitted_at", "DESC"], ["createdAt", "DESC"]],
    });

    const filtered = rows
      .filter(
        (item) =>
          isNonPenelitianJalur(resolveSelectedJalurFromPendaftaran(item)) &&
          isPrimaryPerintisanSubmission(item)
      )
      .map((item) => toNonPenelitianReviewResponse(item));

    return res.json({
      success: true,
      data: filtered,
      total: filtered.length,
    });
  } catch (error) {
    console.error("Error di getNonPenelitianReviewQueueForSekretaris:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// GET /api/sekretaris/non-penelitian/reviews/:id
exports.getNonPenelitianReviewDetailForSekretaris = async (req, res) => {
  try {
    const id = Number(req.params?.id || 0);
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "ID tidak valid.",
      });
    }

    const row = await getNonPenelitianSubmissionForReview(id, null, false);
    if (!row) {
      return res.status(404).json({
        success: false,
        message: "Data form non-penelitian tidak ditemukan.",
      });
    }
    if (row.program_kuliah !== req.user?.program_kuliah) {
      return res.status(404).json({
        success: false,
        message: "Data form non-penelitian tidak ditemukan.",
      });
    }

    const reviewable = ensureReviewableNonPenelitian(row);
    if (!reviewable.ok) {
      return res.status(reviewable.statusCode || 409).json({
        success: false,
        message: reviewable.message,
      });
    }

    return res.json({
      success: true,
      data: toNonPenelitianReviewResponse(row),
    });
  } catch (error) {
    console.error("Error di getNonPenelitianReviewDetailForSekretaris:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

async function decideNonPenelitianReviewBySekretaris(req, res, decision) {
  const t = await sequelize.transaction();
  try {
    const sekretarisId = Number(req.user?.id || 0);
    const id = Number(req.params?.id || 0);
    const note = String(req.body?.keterangan || req.body?.alasan || "").trim();
    const dosenPembimbingId = Number(req.body?.dosen_pembimbing_id || 0);

    if (!sekretarisId || !id) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Parameter request tidak valid.",
      });
    }

    if (decision === "rejected" && !note) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Alasan penolakan wajib diisi.",
      });
    }

    const row = await getNonPenelitianSubmissionForReview(id, t, true);
    if (!row) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Data form non-penelitian tidak ditemukan.",
      });
    }
    if (row.program_kuliah !== req.user?.program_kuliah) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Data form non-penelitian tidak ditemukan.",
      });
    }

    const reviewable = ensureReviewableNonPenelitian(row);
    if (!reviewable.ok) {
      await t.rollback();
      return res.status(reviewable.statusCode || 409).json({
        success: false,
        message: reviewable.message,
      });
    }

    if (String(row.form_lanjutan_status || "") !== "review_sekprodi") {
      await t.rollback();
      return res.status(409).json({
        success: false,
        message: `Form non-penelitian ini tidak berada pada tahap review sekretaris. Status saat ini: ${row.form_lanjutan_status}`,
      });
    }

    if (
      decision === "approved" &&
      reviewable.selectedJalur === "perintisan_bisnis" &&
      !dosenPembimbingId
    ) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Dosen pembimbing kelompok wajib dipilih.",
      });
    }

    const dosenPembimbing =
      dosenPembimbingId > 0
        ? await Dosen.findByPk(dosenPembimbingId, {
            attributes: ["id", "nik", "nama", "email"],
            transaction: t,
          })
        : null;
    if (dosenPembimbingId > 0 && !dosenPembimbing) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Dosen pembimbing yang dipilih tidak ditemukan.",
      });
    }

    const now = new Date();
    const payloadWithTimeline = appendWorkflowTimeline(row.form_lanjutan_payload, {
      status: decision,
      actor: "sekretaris_prodi",
      actor_id: sekretarisId,
      note:
        note ||
        (decision === "approved"
          ? "Disetujui sekretaris prodi."
          : "Ditolak sekretaris prodi."),
      at: now,
    });

    const nextPayload = {
      ...payloadWithTimeline,
      workflow_status: decision,
      review_result: {
        status: decision,
        decided_at: now,
        decided_by: {
          role: "sekretaris_prodi",
          sekretaris_id: sekretarisId,
        },
        note: note || null,
      },
      dosen_pembimbing: dosenPembimbing
        ? {
            id: dosenPembimbing.id,
            nik: dosenPembimbing.nik,
            nama: dosenPembimbing.nama,
            email: dosenPembimbing.email,
            ditetapkan_at: now,
            ditetapkan_oleh_sekretaris_id: sekretarisId,
          }
        : null,
    };

    await updatePerintisanGroupWorkflow({
      sourceRow: row,
      nextStatus: decision,
      nextPayload,
      transaction: t,
    });
    await row.reload({ transaction: t });

    if (
      decision === "approved" &&
      reviewable.selectedJalur === "perintisan_bisnis" &&
      dosenPembimbing
    ) {
      const payload = toObjectPayload(row.form_lanjutan_payload);
      const teamMembers = Array.isArray(payload?.kelompok?.anggota)
        ? payload.kelompok.anggota
        : [];
      const mahasiswaIds = teamMembers.map((item) => Number(item.mahasiswa_id)).filter(Boolean);
      const pendaftaranIds = teamMembers.map((item) => Number(item.pendaftaran_id)).filter(Boolean);
      if (mahasiswaIds.length > 0) {
        await Mahasiswa.update(
          { dosen_pembimbing_skripsi_id: dosenPembimbing.id },
          { where: { id: { [Op.in]: mahasiswaIds } }, transaction: t }
        );
      }
      if (pendaftaranIds.length > 0) {
        await PendaftaranPenjaluran.update(
          {
            dosen_pembimbing_ta_id: dosenPembimbing.id,
            dosen_pembimbing_ta_baru_id: dosenPembimbing.id,
          },
          { where: { id: { [Op.in]: pendaftaranIds } }, transaction: t }
        );
      }
    }

    await t.commit();
    return res.json({
      success: true,
      message:
        decision === "approved"
          ? "Form non-penelitian berhasil disetujui sekretaris prodi."
          : "Form non-penelitian ditolak oleh sekretaris prodi.",
      data: toNonPenelitianReviewResponse(row),
    });
  } catch (error) {
    if (!t.finished) await t.rollback();
    console.error("Error di decideNonPenelitianReviewBySekretaris:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
}

// POST /api/sekretaris/non-penelitian/reviews/:id/approve
exports.approveNonPenelitianReviewBySekretaris = async (req, res) =>
  decideNonPenelitianReviewBySekretaris(req, res, "approved");

// POST /api/sekretaris/non-penelitian/reviews/:id/reject
exports.rejectNonPenelitianReviewBySekretaris = async (req, res) =>
  decideNonPenelitianReviewBySekretaris(req, res, "rejected");

// ========== JALUR BARU ==========

// POST /api/jalur/baru/topik-dosen
exports.submitBaruTopikDosen = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const mahasiswa_id = req.user.id;
    const { topik_1_kode, topik_1_judul, dosen_1_nama, topik_2_kode, topik_2_judul, dosen_2_nama, topik_3_kode, topik_3_judul, dosen_3_nama } = req.body;

    // Validasi: minimal kode topik 1 wajib
    if (!topik_1_kode) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Topik 1 (kode topik) harus diisi",
      });
    }

    const mahasiswa = await Mahasiswa.findByPk(mahasiswa_id, { transaction: t });

    const semesterGateCheck = await validateSemesterLanjutanGate(mahasiswa, t);
    if (!semesterGateCheck.allowed) {
      await t.rollback();
      return res.status(403).json({
        success: false,
        message: semesterGateCheck.message,
        detail: semesterGateCheck.gate,
      });
    }

    const jalurGate = await validateSubmissionTargetJalur({
      mahasiswa,
      transaction: t,
      targetJalur: "penelitian",
    });

    if (!jalurGate.allowed) {
      await t.rollback();
      return res.status(jalurGate.statusCode || 409).json({
        success: false,
        message: jalurGate.message,
        code: jalurGate.code,
        detail: jalurGate.detail || null,
      });
    }

    // Validasi eligibility
    if (mahasiswa.status_jalur_saat_ini !== "belum_mengajukan") {
      await t.rollback();
      return res.status(409).json({
        success: false,
        message: `Anda tidak eligible untuk jalur baru. Status: ${mahasiswa.status_jalur_saat_ini}`,
      });
    }

    if (mahasiswa.pengajuan_aktif_id) {
      await t.rollback();
      return res.status(409).json({
        success: false,
        message: "Anda sudah memiliki pengajuan yang aktif",
      });
    }

    // Validasi: kode topik tidak boleh duplikat antar pilihan
    const topikKodes = [topik_1_kode, topik_2_kode, topik_3_kode].filter(Boolean);
    if (new Set(topikKodes).size !== topikKodes.length) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Kode topik tidak boleh sama antar pilihan",
      });
    }

    // Validasi topik exist
    const topiks = await Topik.findAll({
      where: { kode: { [Op.in]: topikKodes } },
      include: [{ model: Dosen, as: "dosen", attributes: ["id", "nik", "nama"] }],
      transaction: t,
    });

    const topikMap = {};
    topiks.forEach((topik) => {
      topikMap[topik.kode] = topik;
    });

    // Validasi keberadaan topik
    if (!topikMap[topik_1_kode]) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: `Topik dengan kode ${topik_1_kode} tidak ditemukan`,
      });
    }

    if (topik_2_kode && !topikMap[topik_2_kode]) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: `Topik dengan kode ${topik_2_kode} tidak ditemukan`,
      });
    }

    if (topik_3_kode && !topikMap[topik_3_kode]) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: `Topik dengan kode ${topik_3_kode} tidak ditemukan`,
      });
    }

    // Validasi konsistensi data input (jika judul/nama dosen dikirim dari client)
    const pilihanTopik = [
      { slot: 1, kode: topik_1_kode, inputJudul: topik_1_judul, inputDosen: dosen_1_nama },
      { slot: 2, kode: topik_2_kode, inputJudul: topik_2_judul, inputDosen: dosen_2_nama },
      { slot: 3, kode: topik_3_kode, inputJudul: topik_3_judul, inputDosen: dosen_3_nama },
    ].filter((item) => item.kode);

    const validationErrors = [];
    for (const item of pilihanTopik) {
      const validation = buildTopikValidationError({
        slot: item.slot,
        kode: item.kode,
        inputJudul: item.inputJudul,
        inputDosen: item.inputDosen,
        topikDb: topikMap[item.kode],
      });

      if (!validation.isValid) {
        validationErrors.push({
          message: validation.message,
          ...(validation.detail ? { detail: validation.detail } : {}),
        });
      }
    }

    if (validationErrors.length > 0) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: validationErrors.length === 1 ? validationErrors[0].message : "Beberapa topik tidak dapat dipilih. Silakan cek detail.",
        detail: validationErrors,
      });
    }

    const reserveResult = await reserveTopikKodes(topikKodes, t);
    if (!reserveResult.ok) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Topik yang dipilih sudah tidak tersedia. Silakan pilih topik lain.",
      });
    }

    // Kunci data judul dan dosen dari database (client tidak boleh override)
    const topik_1_judul_final = topikMap[topik_1_kode].judul;
    const topik_2_judul_final = topik_2_kode ? topikMap[topik_2_kode].judul : null;
    const topik_3_judul_final = topik_3_kode ? topikMap[topik_3_kode].judul : null;
    const dosen_1_nama_final = topikMap[topik_1_kode].dosen.nama;
    const dosen_2_nama_final = topik_2_kode ? topikMap[topik_2_kode].dosen.nama : null;
    const dosen_3_nama_final = topik_3_kode ? topikMap[topik_3_kode].dosen.nama : null;

    // Ambil dosen ID
    const dosen_pilihan_1 = topikMap[topik_1_kode].dosen_id;
    const dosen_pilihan_2 = topik_2_kode ? topikMap[topik_2_kode].dosen_id : null;
    const dosen_pilihan_3 = topik_3_kode ? topikMap[topik_3_kode].dosen_id : null;

    // VALIDASI KUOTA DOSEN PILIHAN 1
    const kuotaValidation = await validateDosenKuota(dosen_pilihan_1, t);
    if (!kuotaValidation.isAvailable) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: kuotaValidation.message,
        kuota_info: kuotaValidation.kuotaInfo,
      });
    }

    // Buat pengajuan
    const pengajuan = await Pengajuan.create(
      {
        mahasiswa_id,
        jenis_jalur: "baru",
        tipe_pengajuan: "topik_dosen",
        pendaftaran_penjaluran_id: jalurGate.pendaftaranAktif?.id || null,
        topik_1_kode,
        topik_1_judul: topik_1_judul_final,
        topik_2_kode,
        topik_2_judul: topik_2_judul_final,
        topik_3_kode,
        topik_3_judul: topik_3_judul_final,
        dosen_pilihan_1,
        dosen_1_nama: dosen_1_nama_final,
        dosen_pilihan_2,
        dosen_2_nama: dosen_2_nama_final,
        dosen_pilihan_3,
        dosen_3_nama: dosen_3_nama_final,
        dosen_saat_ini: null,
        status: "pending",
      },
      { transaction: t }
    );

    await ensureParallelReviewerRows(pengajuan, t);

    if (jalurGate.pendaftaranAktif) {
      await jalurGate.pendaftaranAktif.update(
        {
          form_lanjutan_status: "submitted",
          form_lanjutan_submitted_at: new Date(),
        },
        { transaction: t }
      );
    }

    // Update mahasiswa
    await mahasiswa.update(
      {
        status_jalur_saat_ini: "sedang_mengajukan",
        pengajuan_aktif_id: pengajuan.id,
      },
      { transaction: t }
    );

    await t.commit();

    // Load data lengkap
    const pengajuanLengkap = await Pengajuan.findByPk(pengajuan.id, {
      include: [
        { model: Dosen, as: "dosen1", attributes: ["id", "nik", "nama"] },
        { model: Dosen, as: "dosen2", attributes: ["id", "nik", "nama"] },
        { model: Dosen, as: "dosen3", attributes: ["id", "nik", "nama"] },
        { model: Dosen, as: "dosenCurrent", attributes: ["id", "nik", "nama"] },
      ],
    });

    res.status(201).json({
      success: true,
      message: "Pengajuan jalur baru (topik dosen) berhasil dibuat",
      data: pengajuanLengkap,
    });
  } catch (error) {
    if (!t.finished) await t.rollback();
    console.error("Error di submitBaruTopikDosen:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// POST /api/jalur/ulang/judul-mandiri
exports.submitUlangJudulMandiri = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const mahasiswa_id = req.user.id;
    const { pamit_id, judul_mandiri, deskripsi_mandiri, keyword_mandiri, cluster_mandiri, prospective_supervisor_id } = req.body;

    // Validasi
    if (!pamit_id) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "pamit_id harus diisi. Silakan submit pamit terlebih dahulu.",
      });
    }

    if (!judul_mandiri || !deskripsi_mandiri || !keyword_mandiri || !cluster_mandiri || !prospective_supervisor_id) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Semua field wajib diisi: judul, deskripsi, keyword, cluster, dan calon dosen pembimbing",
      });
    }

    const mahasiswa = await Mahasiswa.findByPk(mahasiswa_id, { transaction: t });

    const semesterGateCheck = await validateSemesterLanjutanGate(mahasiswa, t, {
      allowUlangFlow: true,
    });
    if (!semesterGateCheck.allowed) {
      await t.rollback();
      return res.status(403).json({
        success: false,
        message: semesterGateCheck.message,
        detail: semesterGateCheck.gate,
      });
    }

    if (mahasiswa.pengajuan_aktif_id) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Anda sudah memiliki pengajuan yang aktif",
      });
    }

    // Validasi pamit
    const pamit = await PamitUlang.findByPk(pamit_id, { transaction: t });
    if (!pamit || pamit.mahasiswa_id !== mahasiswa_id) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Data pamit tidak ditemukan atau bukan milik Anda",
      });
    }

    // Validasi: Pamit harus disetujui dosen pembimbing skripsi terlebih dahulu
    if (pamit.status_dospem !== "approved") {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: `Pamit belum disetujui oleh dosen pembimbing skripsi. Status: ${pamit.status_dospem}`,
      });
    }

    // Validasi: Pamit belum digunakan
    if (pamit.pengajuan_baru_id) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Pamit ini sudah digunakan untuk pengajuan lain",
      });
    }

    // Validasi dosen
    const dosen = await Dosen.findByPk(prospective_supervisor_id, { transaction: t });
    if (!dosen) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Dosen pembimbing tidak ditemukan",
      });
    }

    const pendaftaranUlang = await getUlangPenelitianPendaftaran(mahasiswa_id, t);
    if (!pendaftaranUlang) {
      await t.rollback();
      return res.status(409).json({
        success: false,
        message: "Pendaftaran Ulang Jalur Penelitian belum tersedia. Selesaikan pendaftaran ulang terlebih dahulu.",
      });
    }

    const clusterValidation = await validateDosenPenelitianCluster(prospective_supervisor_id, cluster_mandiri, t);
    if (!clusterValidation.ok) {
      await t.rollback();
      return res.status(clusterValidation.statusCode || 400).json({
        success: false,
        message: clusterValidation.message,
      });
    }

    // ⭐ VALIDASI KUOTA DOSEN ⭐
    const kuotaValidation = await validateDosenKuota(prospective_supervisor_id, t);
    if (!kuotaValidation.isAvailable) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: kuotaValidation.message,
        kuota_info: kuotaValidation.kuotaInfo,
      });
    }

    const previousSubmission = await Pengajuan.findByPk(pamit.pengajuan_sebelumnya_id, { transaction: t });

    // Buat pengajuan ulang
    const pengajuan = await Pengajuan.create(
      {
        mahasiswa_id,
        jenis_jalur: "ulang",
        tipe_pengajuan: "judul_mandiri",
        pendaftaran_penjaluran_id: pendaftaranUlang.id,
        pamit_ulang_id: pamit_id,
        pengajuan_sebelumnya_id: pamit.pengajuan_sebelumnya_id,
        judul_mandiri,
        deskripsi_mandiri,
        keyword_mandiri,
        cluster_mandiri: clusterValidation.cluster_label,
        prospective_supervisor_id,
        is_approved_by_supervisor: false,
        dosen_saat_ini: prospective_supervisor_id,
        status: "pending",
      },
      { transaction: t }
    );

    // Update pamit dengan pengajuan_baru_id
    await pamit.update({ pengajuan_baru_id: pengajuan.id }, { transaction: t });
    await pendaftaranUlang.update(
      {
        form_lanjutan_status: "submitted",
        form_lanjutan_submitted_at: new Date(),
      },
      { transaction: t }
    );

    // Update mahasiswa
    await mahasiswa.update(
      {
        status_jalur_saat_ini: "sedang_mengajukan",
        pengajuan_aktif_id: pengajuan.id,
      },
      { transaction: t }
    );

    await t.commit();

    // Load data lengkap
    const pengajuanLengkap = await Pengajuan.findByPk(pengajuan.id, {
      include: [
        { model: Dosen, as: "prospectiveSupervisor", attributes: ["id", "nik", "nama", "email"] },
        { model: Dosen, as: "dosenCurrent", attributes: ["id", "nik", "nama"] },
        { model: PamitUlang, as: "pamitUlang" },
      ],
    });

    res.status(201).json({
      success: true,
      message: "Pengajuan jalur ulang (judul mandiri) berhasil dibuat. Menunggu approval dari calon dosen pembimbing.",
      data: {
        pengajuan: pengajuanLengkap,
        pengajuan_sebelumnya: {
          id: previousSubmission.id,
          status: previousSubmission.status,
        },
      },
    });
  } catch (error) {
    if (!t.finished) await t.rollback();
    console.error("Error di submitUlangJudulMandiri:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// ========== JALUR EKSTENSI ==========

// POST /api/jalur/ekstensi
exports.pengajuanEkstensi = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const mahasiswa_id = req.user.id;

    const mahasiswa = await Mahasiswa.findByPk(mahasiswa_id, { transaction: t });

    const semesterGateCheck = await validateSemesterLanjutanGate(mahasiswa, t);
    if (!semesterGateCheck.allowed) {
      await t.rollback();
      return res.status(403).json({
        success: false,
        message: semesterGateCheck.message,
        detail: semesterGateCheck.gate,
      });
    }

    // Cek pengajuan yang approved sebelumnya
    const previousSubmission = await Pengajuan.findOne({
      where: {
        mahasiswa_id,
        status: "approved",
      },
      order: [["createdAt", "DESC"]],
      include: [
        {
          model: Dosen,
          as: "dosenCurrent",
          attributes: ["id", "nama", "nik", "email"],
        },
      ],
      transaction: t,
    });

    if (!previousSubmission) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Tidak ada pengajuan yang disetujui sebelumnya untuk di-ekstensi",
      });
    }

    if (mahasiswa.pengajuan_aktif_id) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Anda sudah memiliki pengajuan yang aktif",
      });
    }

    // TODO: Tambahkan validasi syarat ekstensi (misal: sudah 1 semester, dll)
    // Untuk sekarang, kita asumsikan syarat terpenuhi

    // Buat record ekstensi (melanjutkan yang lama)
    const pengajuanEkstensi = await Pengajuan.create(
      {
        mahasiswa_id,
        jenis_jalur: "ekstensi",
        tipe_pengajuan: previousSubmission.tipe_pengajuan,

        // Copy data dari pengajuan sebelumnya
        topik_1_kode: previousSubmission.topik_1_kode,
        topik_1_judul: previousSubmission.topik_1_judul,
        topik_2_kode: previousSubmission.topik_2_kode,
        topik_2_judul: previousSubmission.topik_2_judul,
        topik_3_kode: previousSubmission.topik_3_kode,
        topik_3_judul: previousSubmission.topik_3_judul,
        judul_mandiri: previousSubmission.judul_mandiri,
        deskripsi_mandiri: previousSubmission.deskripsi_mandiri,
        keyword_mandiri: previousSubmission.keyword_mandiri,
        cluster_mandiri: previousSubmission.cluster_mandiri,

        dosen_pilihan_1: previousSubmission.dosen_pilihan_1,
        dosen_1_nama: previousSubmission.dosen_1_nama,
        dosen_pilihan_2: previousSubmission.dosen_pilihan_2,
        dosen_2_nama: previousSubmission.dosen_2_nama,
        dosen_pilihan_3: previousSubmission.dosen_pilihan_3,
        dosen_3_nama: previousSubmission.dosen_3_nama,
        dosen_saat_ini: previousSubmission.dosen_saat_ini,
        prospective_supervisor_id: previousSubmission.prospective_supervisor_id,

        pengajuan_sebelumnya_id: previousSubmission.id,
        status: "approved", // Langsung approved karena melanjutkan yang lama
      },
      { transaction: t }
    );

    // Update mahasiswa
    await mahasiswa.update(
      {
        status_jalur_saat_ini: "ekstensi",
        pengajuan_aktif_id: pengajuanEkstensi.id,
      },
      { transaction: t }
    );

    await t.commit();

    // Load data lengkap
    const pengajuanLengkap = await Pengajuan.findByPk(pengajuanEkstensi.id, {
      include: [{ model: Dosen, as: "dosenCurrent", attributes: ["id", "nik", "nama", "email"] }],
    });

    res.status(201).json({
      success: true,
      message: "Pengajuan ekstensi berhasil. Anda melanjutkan penelitian semester sebelumnya",
      data: {
        pengajuan: pengajuanLengkap,
        topik: previousSubmission.tipe_pengajuan === "judul_mandiri" ? previousSubmission.judul_mandiri : previousSubmission.topik_1_judul,
      },
    });
  } catch (error) {
    if (!t.finished) await t.rollback();
    console.error("Error di pengajuanEkstensi:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// POST /api/jalur/baru/judul-mandiri
exports.submitBaruJudulMandiri = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const mahasiswa_id = req.user.id;
    const { judul_mandiri, deskripsi_mandiri, keyword_mandiri, cluster_mandiri, prospective_supervisor_id } = req.body;

    // Validasi input
    if (!judul_mandiri || !deskripsi_mandiri || !keyword_mandiri || !cluster_mandiri || !prospective_supervisor_id) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Semua field wajib diisi: judul, deskripsi, keyword, cluster, dan calon dosen pembimbing",
      });
    }

    const mahasiswa = await Mahasiswa.findByPk(mahasiswa_id, { transaction: t });

    const semesterGateCheck = await validateSemesterLanjutanGate(mahasiswa, t);
    if (!semesterGateCheck.allowed) {
      await t.rollback();
      return res.status(403).json({
        success: false,
        message: semesterGateCheck.message,
        detail: semesterGateCheck.gate,
      });
    }

    const jalurGate = await validateSubmissionTargetJalur({
      mahasiswa,
      transaction: t,
      targetJalur: "penelitian",
    });

    if (!jalurGate.allowed) {
      await t.rollback();
      return res.status(jalurGate.statusCode || 409).json({
        success: false,
        message: jalurGate.message,
        code: jalurGate.code,
        detail: jalurGate.detail || null,
      });
    }

    // Validasi eligibility
    if (mahasiswa.status_jalur_saat_ini !== "belum_mengajukan") {
      await t.rollback();
      return res.status(409).json({
        success: false,
        message: "Anda tidak eligible untuk jalur baru",
      });
    }

    if (mahasiswa.pengajuan_aktif_id) {
      await t.rollback();
      return res.status(409).json({
        success: false,
        message: "Anda sudah memiliki pengajuan yang aktif",
      });
    }

    // Validasi dosen exist
    const dosen = await Dosen.findByPk(prospective_supervisor_id, { transaction: t });
    if (!dosen) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Dosen pembimbing yang dipilih tidak ditemukan",
      });
    }

    const clusterValidation = await validateDosenPenelitianCluster(prospective_supervisor_id, cluster_mandiri, t);
    if (!clusterValidation.ok) {
      await t.rollback();
      return res.status(clusterValidation.statusCode || 400).json({
        success: false,
        message: clusterValidation.message,
      });
    }

    // ⭐ VALIDASI KUOTA DOSEN ⭐
    const kuotaValidation = await validateDosenKuota(prospective_supervisor_id, t);
    if (!kuotaValidation.isAvailable) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: kuotaValidation.message,
        kuota_info: kuotaValidation.kuotaInfo,
      });
    }

    // Buat pengajuan
    const pengajuan = await Pengajuan.create(
      {
        mahasiswa_id,
        jenis_jalur: "baru",
        tipe_pengajuan: "judul_mandiri",
        pendaftaran_penjaluran_id: jalurGate.pendaftaranAktif?.id || null,
        judul_mandiri,
        deskripsi_mandiri,
        keyword_mandiri,
        cluster_mandiri: clusterValidation.cluster_label,
        prospective_supervisor_id,
        is_approved_by_supervisor: false,
        dosen_saat_ini: prospective_supervisor_id,
        status: "pending",
      },
      { transaction: t }
    );

    // Update mahasiswa
    await mahasiswa.update(
      {
        status_jalur_saat_ini: "sedang_mengajukan",
        pengajuan_aktif_id: pengajuan.id,
      },
      { transaction: t }
    );

    await t.commit();

    // Load data lengkap
    const pengajuanLengkap = await Pengajuan.findByPk(pengajuan.id, {
      include: [
        { model: Dosen, as: "prospectiveSupervisor", attributes: ["id", "nik", "nama", "email"] },
        { model: Dosen, as: "dosenCurrent", attributes: ["id", "nik", "nama"] },
      ],
    });

    res.status(201).json({
      success: true,
      message: "Pengajuan jalur baru (judul mandiri) berhasil dibuat. Menunggu approval dari calon dosen pembimbing.",
      data: pengajuanLengkap,
    });
  } catch (error) {
    if (!t.finished) await t.rollback();
    console.error("Error di submitBaruJudulMandiri:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// ========== JALUR ULANG - DENGAN PAMIT ==========

// POST /api/jalur/ulang/pamit - Submit pamit (LANGKAH 1)
exports.submitPamit = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const mahasiswa_id = req.user.id;
    const { pesan_ke_dosen_pembimbing, alasan_ulang, catatan_tambahan } = req.body;

    // Validasi input - SEMUA WAJIB kecuali catatan_tambahan
    if (!pesan_ke_dosen_pembimbing || !alasan_ulang) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Pesan ke dosen pembimbing dan alasan ulang harus diisi",
      });
    }

    const mahasiswa = await Mahasiswa.findByPk(mahasiswa_id, { transaction: t });

    const semesterGateCheck = await validateSemesterLanjutanGate(mahasiswa, t, {
      allowUlangFlow: true,
    });
    if (!semesterGateCheck.allowed) {
      await t.rollback();
      return res.status(403).json({
        success: false,
        message: semesterGateCheck.message,
        detail: semesterGateCheck.gate,
      });
    }

    // Validasi: Mahasiswa harus punya Dosen Pembimbing Skripsi
    if (!mahasiswa.dosen_pembimbing_skripsi_id) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Anda belum memiliki dosen pembimbing skripsi. Tidak bisa mengajukan pamit ulang.",
      });
    }

    // Cek pengajuan yang approved sebelumnya
    const previousSubmission = await Pengajuan.findOne({
      where: {
        mahasiswa_id,
        status: { [Op.in]: ["approved", "completed"] },
      },
      order: [["createdAt", "DESC"]],
      transaction: t,
    });

    if (!previousSubmission) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Tidak ada pengajuan yang disetujui sebelumnya",
      });
    }

    // Cek apakah sudah ada pamit aktif yang belum selesai dipakai
    const existingPamit = await PamitUlang.findOne({
      where: {
        mahasiswa_id,
        pengajuan_baru_id: null,
        status_dospem: { [Op.in]: ["pending", "approved"] },
      },
      transaction: t,
    });

    if (existingPamit) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Anda sudah memiliki pamit aktif yang belum selesai diproses",
      });
    }

    // Buat pamit baru dengan pesan ke dosen pembimbing
    const pamit = await PamitUlang.create(
      {
        mahasiswa_id,
        pengajuan_sebelumnya_id: previousSubmission.id,
        pesan_ke_dosen_pembimbing,
        alasan_ulang,
        catatan_tambahan: catatan_tambahan || null,
        status_dospem: "pending",
        status_dpa: "pending",
      },
      { transaction: t }
    );

    await t.commit();

    // Load data lengkap
    const pamitWithDetails = await PamitUlang.findByPk(pamit.id, {
      include: [
        {
          model: Pengajuan,
          as: "pengajuanSebelumnya",
          attributes: ["id", "topik_1_judul", "judul_mandiri", "status", "tipe_pengajuan"],
          include: [
            {
              model: Dosen,
              as: "dosenCurrent",
              attributes: ["id", "nik", "nama"],
            },
          ],
        },
      ],
    });

    res.status(201).json({
      success: true,
      message: "Pamit ulang berhasil disubmit. Menunggu approval dari dosen pembimbing skripsi.",
      data: {
        pamit: pamitWithDetails,
        status: "pending",
        next_step: "Tunggu approval dosen pembimbing skripsi -> lalu pilih Topik Dosen atau Judul Mandiri",
      },
    });
  } catch (error) {
    if (!t.finished) await t.rollback();
    console.error("Error di submitPamit:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// GET /api/jalur/ulang/status-pamit - Cek status pamit
exports.getStatusPamit = async (req, res) => {
  try {
    const mahasiswa_id = req.user.id;

    const pamit = await PamitUlang.findOne({
      where: {
        mahasiswa_id,
      },
      include: [
        {
          model: Pengajuan,
          as: "pengajuanSebelumnya",
          attributes: ["id", "topik_1_judul", "judul_mandiri", "tipe_pengajuan"],
          include: [
            {
              model: Dosen,
              as: "dosenCurrent",
              attributes: ["id", "nik", "nama"],
            },
          ],
        },
        {
          model: Pengajuan,
          as: "pengajuanBaru",
          attributes: ["id", "jenis_jalur", "tipe_pengajuan", "status"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    if (!pamit) {
      return res.json({
        success: true,
        data: {
          has_pamit: false,
          can_continue: false,
          message: "Belum ada pamit yang disubmit",
        },
      });
    }

    const canContinue = pamit.status_dospem === "approved" && !pamit.pengajuan_baru_id;

    res.json({
      success: true,
      data: {
        has_pamit: true,
        pamit_id: pamit.id,
        status_dospem: pamit.status_dospem,
        can_continue: canContinue,
        pamit,
        message: canContinue
          ? "Pamit sudah disetujui. Silakan lanjutkan dengan memilih topik baru."
          : pamit.status_dospem === "pending"
          ? "Menunggu approval dari dosen pembimbing skripsi"
          : pamit.status_dospem === "rejected"
          ? "Pamit ditolak oleh dosen pembimbing skripsi"
          : "Pamit sudah digunakan untuk pengajuan",
      },
    });
  } catch (error) {
    console.error("Error di getStatusPamit:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// GET /api/jalur/ulang/history-pamit - History semua pamit mahasiswa
exports.getHistoryPamit = async (req, res) => {
  try {
    const mahasiswa_id = req.user.id;

    const pamits = await PamitUlang.findAll({
      where: { mahasiswa_id },
      include: [
        {
          model: Pengajuan,
          as: "pengajuanSebelumnya",
          attributes: ["id", "topik_1_judul", "judul_mandiri", "status", "tipe_pengajuan"],
        },
        {
          model: Pengajuan,
          as: "pengajuanBaru",
          attributes: ["id", "jenis_jalur", "tipe_pengajuan", "status"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    res.json({
      success: true,
      data: pamits,
      total: pamits.length,
    });
  } catch (error) {
    console.error("Error di getHistoryPamit:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// POST /api/jalur/ulang/topik-dosen - Submit pengajuan ulang (LANGKAH 2)
exports.submitUlangTopikDosen = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const mahasiswa_id = req.user.id;
    const { pamit_id, topik_1_kode, topik_1_judul, dosen_1_nama, topik_2_kode, topik_2_judul, dosen_2_nama, topik_3_kode, topik_3_judul, dosen_3_nama } = req.body;

    // Validasi: pamit_id wajib
    if (!pamit_id) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "pamit_id harus diisi. Silakan submit pamit terlebih dahulu.",
      });
    }

    // Validasi: minimal kode topik 1 wajib
    if (!topik_1_kode) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Topik 1 (kode topik) harus diisi",
      });
    }

    const mahasiswa = await Mahasiswa.findByPk(mahasiswa_id, { transaction: t });

    const semesterGateCheck = await validateSemesterLanjutanGate(mahasiswa, t, {
      allowUlangFlow: true,
    });
    if (!semesterGateCheck.allowed) {
      await t.rollback();
      return res.status(403).json({
        success: false,
        message: semesterGateCheck.message,
        detail: semesterGateCheck.gate,
      });
    }

    if (mahasiswa.pengajuan_aktif_id) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Anda sudah memiliki pengajuan yang aktif",
      });
    }

    // Validasi: Pamit harus exist dan milik mahasiswa ini
    const pamit = await PamitUlang.findByPk(pamit_id, { transaction: t });
    if (!pamit || pamit.mahasiswa_id !== mahasiswa_id) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Data pamit tidak ditemukan atau bukan milik Anda",
      });
    }

    // Validasi: Pamit harus disetujui dosen pembimbing skripsi terlebih dahulu
    if (pamit.status_dospem !== "approved") {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: `Pamit belum disetujui oleh dosen pembimbing skripsi. Status: ${pamit.status_dospem}`,
      });
    }

    // Validasi: Pamit belum digunakan untuk pengajuan lain
    if (pamit.pengajuan_baru_id) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Pamit ini sudah digunakan untuk pengajuan lain",
      });
    }

    const pendaftaranUlang = await getUlangPenelitianPendaftaran(mahasiswa_id, t);
    if (!pendaftaranUlang) {
      await t.rollback();
      return res.status(409).json({
        success: false,
        message: "Pendaftaran Ulang Jalur Penelitian belum tersedia. Selesaikan pendaftaran ulang terlebih dahulu.",
      });
    }

    // Validasi: kode topik tidak boleh duplikat antar pilihan
    const topikKodes = [topik_1_kode, topik_2_kode, topik_3_kode].filter(Boolean);
    if (new Set(topikKodes).size !== topikKodes.length) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Kode topik tidak boleh sama antar pilihan",
      });
    }

    // Validasi topik exist
    const topiks = await Topik.findAll({
      where: { kode: { [Op.in]: topikKodes } },
      include: [{ model: Dosen, as: "dosen", attributes: ["id", "nik", "nama"] }],
      transaction: t,
    });

    const topikMap = {};
    topiks.forEach((topik) => {
      topikMap[topik.kode] = topik;
    });

    if (!topikMap[topik_1_kode]) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: `Topik dengan kode ${topik_1_kode} tidak ditemukan`,
      });
    }

    if (topik_2_kode && !topikMap[topik_2_kode]) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: `Topik dengan kode ${topik_2_kode} tidak ditemukan`,
      });
    }

    if (topik_3_kode && !topikMap[topik_3_kode]) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: `Topik dengan kode ${topik_3_kode} tidak ditemukan`,
      });
    }

    // Validasi konsistensi data input (jika judul/nama dosen dikirim dari client)
    const pilihanTopik = [
      { slot: 1, kode: topik_1_kode, inputJudul: topik_1_judul, inputDosen: dosen_1_nama },
      { slot: 2, kode: topik_2_kode, inputJudul: topik_2_judul, inputDosen: dosen_2_nama },
      { slot: 3, kode: topik_3_kode, inputJudul: topik_3_judul, inputDosen: dosen_3_nama },
    ].filter((item) => item.kode);

    const validationErrors = [];
    for (const item of pilihanTopik) {
      const validation = buildTopikValidationError({
        slot: item.slot,
        kode: item.kode,
        inputJudul: item.inputJudul,
        inputDosen: item.inputDosen,
        topikDb: topikMap[item.kode],
      });

      if (!validation.isValid) {
        validationErrors.push({
          message: validation.message,
          ...(validation.detail ? { detail: validation.detail } : {}),
        });
      }
    }

    if (validationErrors.length > 0) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: validationErrors.length === 1 ? validationErrors[0].message : "Beberapa topik tidak dapat dipilih. Silakan cek detail.",
        detail: validationErrors,
      });
    }

    const reserveResult = await reserveTopikKodes(topikKodes, t);
    if (!reserveResult.ok) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Topik yang dipilih sudah tidak tersedia. Silakan pilih topik lain.",
      });
    }

    // Kunci data judul dan dosen dari database (client tidak boleh override)
    const topik_1_judul_final = topikMap[topik_1_kode].judul;
    const topik_2_judul_final = topik_2_kode ? topikMap[topik_2_kode].judul : null;
    const topik_3_judul_final = topik_3_kode ? topikMap[topik_3_kode].judul : null;
    const dosen_1_nama_final = topikMap[topik_1_kode].dosen.nama;
    const dosen_2_nama_final = topik_2_kode ? topikMap[topik_2_kode].dosen.nama : null;
    const dosen_3_nama_final = topik_3_kode ? topikMap[topik_3_kode].dosen.nama : null;

    // Ambil dosen ID
    const dosen_pilihan_1 = topikMap[topik_1_kode].dosen_id;
    const dosen_pilihan_2 = topik_2_kode ? topikMap[topik_2_kode].dosen_id : null;
    const dosen_pilihan_3 = topik_3_kode ? topikMap[topik_3_kode].dosen_id : null;

    // ⭐ VALIDASI KUOTA DOSEN PILIHAN 1 ⭐
    const kuotaValidation = await validateDosenKuota(dosen_pilihan_1, t);
    if (!kuotaValidation.isAvailable) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: kuotaValidation.message,
        kuota_info: kuotaValidation.kuotaInfo,
      });
    }

    const previousSubmission = await Pengajuan.findByPk(pamit.pengajuan_sebelumnya_id, { transaction: t });

    // Buat pengajuan ulang
    const pengajuan = await Pengajuan.create(
      {
        mahasiswa_id,
        jenis_jalur: "ulang",
        tipe_pengajuan: "topik_dosen",
        pendaftaran_penjaluran_id: pendaftaranUlang.id,
        pamit_ulang_id: pamit_id,
        pengajuan_sebelumnya_id: pamit.pengajuan_sebelumnya_id,
        topik_1_kode,
        topik_1_judul: topik_1_judul_final,
        topik_2_kode,
        topik_2_judul: topik_2_judul_final,
        topik_3_kode,
        topik_3_judul: topik_3_judul_final,
        dosen_pilihan_1,
        dosen_1_nama: dosen_1_nama_final,
        dosen_pilihan_2,
        dosen_2_nama: dosen_2_nama_final,
        dosen_pilihan_3,
        dosen_3_nama: dosen_3_nama_final,
        dosen_saat_ini: null,
        status: "pending",
      },
      { transaction: t }
    );

    if (jalurGate.pendaftaranAktif) {
      await jalurGate.pendaftaranAktif.update(
        {
          form_lanjutan_status: "submitted",
          form_lanjutan_submitted_at: new Date(),
        },
        { transaction: t }
      );
    }

    await ensureParallelReviewerRows(pengajuan, t);

    // Update pamit dengan pengajuan_baru_id
    await pamit.update({ pengajuan_baru_id: pengajuan.id }, { transaction: t });
    await pendaftaranUlang.update(
      {
        form_lanjutan_status: "submitted",
        form_lanjutan_submitted_at: new Date(),
      },
      { transaction: t }
    );

    // Update mahasiswa
    await mahasiswa.update(
      {
        status_jalur_saat_ini: "sedang_mengajukan",
        pengajuan_aktif_id: pengajuan.id,
      },
      { transaction: t }
    );

    await t.commit();

    // Load data lengkap
    const pengajuanLengkap = await Pengajuan.findByPk(pengajuan.id, {
      include: [
        { model: Dosen, as: "dosen1", attributes: ["id", "nik", "nama"] },
        { model: Dosen, as: "dosen2", attributes: ["id", "nik", "nama"] },
        { model: Dosen, as: "dosen3", attributes: ["id", "nik", "nama"] },
        { model: Dosen, as: "dosenCurrent", attributes: ["id", "nik", "nama"] },
        { model: PamitUlang, as: "pamitUlang" },
      ],
    });

    res.status(201).json({
      success: true,
      message: "Pengajuan jalur ulang (topik dosen) berhasil dibuat",
      data: {
        pengajuan: pengajuanLengkap,
        pengajuan_sebelumnya: {
          id: previousSubmission.id,
          status: previousSubmission.status,
        },
      },
    });
  } catch (error) {
    if (!t.finished) await t.rollback();
    console.error("Error di submitUlangTopikDosen:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

