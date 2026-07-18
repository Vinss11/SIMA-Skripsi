const {
  Mahasiswa, Dosen, Klaster, Pengajuan, Topik, RiwayatStatusDosen,
  TindakLanjutStatusDosen, Admin, sequelize,
} = require("../models");
const { Op } = require("sequelize");
const XLSX = require("xlsx");
const { fetchMahasiswaMasterData } = require("../services/mahasiswaMasterService");
const {
  STRUKTURAL_POSITIONS,
  normalizeJabatanStrukturalInput,
  isValidJabatanStruktural,
} = require("../constants/jabatanStruktural");
const {
  DOSEN_STATUSES,
  analyzeDosenStatusImpact,
  assertDosenCanReceiveNewAssignment,
  initializeAvailabilityForDosen,
} = require("../services/dosenStatusService");
const { validateDosenName, validateDosenTitle } = require("../utils/dosenIdentity");
const { getSupervisedMahasiswaIdsWithLegacyFallback } = require("../services/supervisorAccessService");

const DEFAULT_KLASTER_MASTER = [
  { kode: "MEDIS", nama: "Informatika Medis" },
  { kode: "SDATA", nama: "Sains Data" },
  { kode: "ITSC", nama: "Informatika Teori & Sistem Cerdas" },
  { kode: "MVK", nama: "Multimedia & Visi Komputer" },
  { kode: "SIRKEL", nama: "Sistem Informasi & Rekayasa Perangkat Lunak" },
  { kode: "SIBER", nama: "Sistem Siber" },
];

function getJakartaDateOnly() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function isValidDateOnly(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

function normalizeNameKey(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function validateKuotaBimbinganValue(value) {
  const rawValue = String(value ?? "").trim();
  if (!/^\d{1,2}$/.test(rawValue)) {
    return {
      isValid: false,
      message: "Kuota bimbingan harus angka bulat 1-99.",
    };
  }

  const kuota = Number(rawValue);
  if (!Number.isInteger(kuota) || kuota < 1 || kuota > 99) {
    return {
      isValid: false,
      message: "Kuota bimbingan harus angka bulat 1-99.",
    };
  }

  return { isValid: true, value: kuota };
}

async function getNextDosenSequence(transaction) {
  const [rows] = await sequelize.query(
    `
      SELECT COALESCE(MAX(CAST(SUBSTRING("kode_dosen" FROM 4) AS INTEGER)), 0) AS max_seq
      FROM "Dosens"
      WHERE "kode_dosen" ~ '^DSN[0-9]+$'
    `,
    { transaction }
  );

  const maxSequence = Number(rows?.[0]?.max_seq || 0);
  return maxSequence + 1;
}

async function ensureDefaultKlasters(transaction) {
  const existingRows = await Klaster.findAll({
    attributes: ["id", "kode", "nama"],
    transaction,
  });
  const existingByCode = new Map(
    existingRows.map((item) => [String(item.kode || "").trim().toUpperCase(), item])
  );
  const now = new Date();
  const missingRows = DEFAULT_KLASTER_MASTER.filter((item) => !existingByCode.has(item.kode)).map((item) => ({
    kode: item.kode,
    nama: item.nama,
    createdAt: now,
    updatedAt: now,
  }));

  if (missingRows.length > 0) {
    await Klaster.bulkCreate(missingRows, { transaction });
  }

  return Klaster.findAll({
    attributes: ["id", "kode", "nama"],
    order: [["nama", "ASC"]],
    transaction,
  });
}

function formatDateTimeForExport(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const twoDigits = (num) => String(num).padStart(2, "0");
  return `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())} ${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`;
}

async function validateAndEnsureJabatanStrukturalAvailability({
  jabatanStruktural,
  excludeDosenId = null,
  transaction,
}) {
  if (!jabatanStruktural) return { isValid: true };

  if (!isValidJabatanStruktural(jabatanStruktural)) {
    return {
      isValid: false,
      statusCode: 400,
      message: `Jabatan struktural tidak valid. Pilihan yang diizinkan: ${STRUKTURAL_POSITIONS.join(" | ")}`,
    };
  }

  const where = {
    jabatan_struktural: jabatanStruktural,
  };
  if (excludeDosenId) {
    where.id = { [Op.ne]: excludeDosenId };
  }

  const existing = await Dosen.findOne({
    where,
    attributes: ["id", "nama"],
    transaction,
  });

  if (existing) {
    return {
      isValid: false,
      statusCode: 409,
      message: `Jabatan struktural '${jabatanStruktural}' sudah diisi oleh dosen ${existing.nama}.`,
    };
  }

  return { isValid: true };
}

function normalizeJabatanAssignmentPayload(rawAssignments) {
  if (Array.isArray(rawAssignments)) {
    const assignmentMap = {};
    for (const item of rawAssignments) {
      const jabatan = normalizeJabatanStrukturalInput(item?.jabatan_struktural || item?.jabatan);
      if (!jabatan) continue;
      assignmentMap[jabatan] = item?.dosen_id ?? item?.dosenId ?? null;
    }
    return assignmentMap;
  }

  return rawAssignments && typeof rawAssignments === "object" ? rawAssignments : {};
}

async function getMappedDosens(keyword = "") {
  const where = {};
  if (keyword) {
    where[Op.or] = [
      { nama: { [Op.iLike]: `%${keyword}%` } },
      { nik: { [Op.iLike]: `%${keyword}%` } },
      { kode_dosen: { [Op.iLike]: `%${keyword}%` } },
      { email: { [Op.iLike]: `%${keyword}%` } },
    ];
  }

  const dosens = await Dosen.findAll({
    where,
    attributes: [
      "id",
      "kode_dosen",
      "nik",
      "nama",
      "gelar",
      "email",
      "jabatan_struktural",
      "kuota_bimbingan",
      "status_keaktifan",
      "account_is_active",
      "continue_existing_supervision",
      "status_effective_at",
      "status_reason",
      "status_updated_at",
      "createdAt",
      "updatedAt",
    ],
    include: [
      {
        model: Klaster,
        as: "klasters",
        attributes: ["id", "kode", "nama"],
        through: { attributes: [] },
        required: false,
      },
    ],
    order: [["nama", "ASC"]],
  });

  const mahasiswaCountRows = await Mahasiswa.findAll({
    attributes: [
      "dosen_pembimbing_skripsi_id",
      [sequelize.fn("COUNT", sequelize.col("id")), "count"],
    ],
    where: {
      dosen_pembimbing_skripsi_id: { [Op.ne]: null },
      [Op.or]: [
        { status_jalur_saat_ini: { [Op.ne]: "selesai" } },
        { status_jalur_saat_ini: null },
      ],
    },
    group: ["dosen_pembimbing_skripsi_id"],
    raw: true,
  });

  const bimbinganByDosenId = new Map(
    mahasiswaCountRows.map((row) => [
      Number(row.dosen_pembimbing_skripsi_id),
      Number(row.count || 0),
    ])
  );

  return dosens.map((dosen) => {
    const jumlahBimbingan = bimbinganByDosenId.get(dosen.id) || 0;
    const kuota = Number(dosen.kuota_bimbingan || 0);
    const sisaKuota = Math.max(kuota - jumlahBimbingan, 0);

    return {
      id: dosen.id,
      kode_dosen: dosen.kode_dosen,
      nik: dosen.nik,
      nama: dosen.nama,
      gelar: dosen.gelar,
      email: dosen.email,
      jabatan_struktural: dosen.jabatan_struktural,
      kuota_bimbingan: kuota,
      status_keaktifan: dosen.status_keaktifan,
      account_is_active: dosen.account_is_active,
      continue_existing_supervision: dosen.continue_existing_supervision,
      status_effective_at: dosen.status_effective_at,
      status_reason: dosen.status_reason,
      status_updated_at: dosen.status_updated_at,
      jumlah_bimbingan: jumlahBimbingan,
      sisa_kuota: sisaKuota,
      klasters: Array.isArray(dosen.klasters)
        ? dosen.klasters.map((item) => ({
            id: item.id,
            kode: item.kode,
            nama: item.nama,
          }))
        : [],
      createdAt: dosen.createdAt,
      updatedAt: dosen.updatedAt,
    };
  });
}

// GET /api/admin/mahasiswa - Lihat semua mahasiswa
exports.getAllMahasiswa = async (req, res) => {
  try {
    const mappedMahasiswas = await fetchMahasiswaMasterData({
      status_jalur: req.query.status_jalur,
      angkatan: req.query.angkatan,
    });

    res.json({
      success: true,
      data: mappedMahasiswas,
      total: mappedMahasiswas.length,
    });
  } catch (error) {
    console.error("Error di getAllMahasiswa:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// GET /api/admin/dosen/:id/status-impact?status=study_leave
exports.getDosenStatusImpact = async (req, res) => {
  try {
    const dosen = await Dosen.findByPk(req.params.id, {
      attributes: ["id", "kode_dosen", "nik", "nama", "status_keaktifan", "account_is_active", "continue_existing_supervision"],
    });
    if (!dosen) return res.status(404).json({ success: false, message: "Dosen tidak ditemukan." });

    const requestedStatus = String(req.query.status || dosen.status_keaktifan).trim().toLowerCase();
    if (!DOSEN_STATUSES.includes(requestedStatus)) {
      return res.status(400).json({ success: false, message: "Status keaktifan tidak valid." });
    }
    const impact = await analyzeDosenStatusImpact(dosen.id);
    return res.json({ success: true, data: { dosen, status_baru: requestedStatus, impact } });
  } catch (error) {
    console.error("Error di getDosenStatusImpact:", error);
    return res.status(500).json({ success: false, message: "Gagal menganalisis dampak status.", error: error.message });
  }
};

// GET /api/admin/dosen/:id/status-history
exports.getDosenStatusHistory = async (req, res) => {
  try {
    const rows = await RiwayatStatusDosen.findAll({
      where: { dosen_id: req.params.id },
      include: [{ model: require("../models").Admin, as: "changedByAdmin", attributes: ["id", "nama", "nip"], required: false }],
      order: [["createdAt", "DESC"]],
    });
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Error di getDosenStatusHistory:", error);
    return res.status(500).json({ success: false, message: "Gagal memuat histori status.", error: error.message });
  }
};

// PUT /api/admin/dosen/:id/status
exports.updateDosenStatus = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const statusBaru = String(req.body?.status_keaktifan || "").trim().toLowerCase();
    const reason = String(req.body?.status_reason || "").trim();
    const effectiveAt = String(req.body?.status_effective_at || "").trim();
    if (!DOSEN_STATUSES.includes(statusBaru)) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: "status_keaktifan tidak valid." });
    }
    if (!isValidDateOnly(effectiveAt)) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: "Tanggal efektif tidak valid." });
    }
    if (effectiveAt > getJakartaDateOnly()) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: "Tanggal efektif tidak boleh berada di masa depan. Status berlaku saat disimpan." });
    }
    if (reason.length < 5) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: "Alasan perubahan status minimal 5 karakter." });
    }

    const dosen = await Dosen.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!dosen) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: "Dosen tidak ditemukan." });
    }

    const oldStatus = dosen.status_keaktifan || "active";
    const oldAccount = dosen.account_is_active !== false;
    const oldContinueExisting = dosen.continue_existing_supervision !== false;
    const requestedAccount = req.body?.account_is_active;
    const newAccount = statusBaru === "retired" ? false : requestedAccount !== false;
    const continueExisting = statusBaru === "active"
      ? true
      : statusBaru === "retired"
      ? false
      : req.body?.continue_existing_supervision === true;

    if (oldStatus === "retired" && statusBaru !== "retired") {
      const actor = await Admin.findByPk(req.user.id, { attributes: ["id", "role"], transaction });
      if (actor?.role !== "koordinator" || req.body?.confirm_retired_correction !== true || reason.length < 20) {
        await transaction.rollback();
        return res.status(403).json({
          success: false,
          message: "Koreksi status pensiun hanya dapat dilakukan Admin Koordinator, harus dikonfirmasi khusus, dan memerlukan alasan minimal 20 karakter.",
        });
      }
    }

    const changedFields = [];
    if (oldStatus !== statusBaru) changedFields.push("status_keaktifan");
    if (oldAccount !== newAccount) changedFields.push("account_is_active");
    if (oldContinueExisting !== continueExisting) changedFields.push("continue_existing_supervision");
    if (changedFields.length === 0) {
      await transaction.rollback();
      return res.status(409).json({ success: false, message: "Tidak ada perubahan status, akun, atau izin melanjutkan bimbingan." });
    }
    const impact = await analyzeDosenStatusImpact(dosen.id, transaction);
    const now = new Date();

    await dosen.update({
      status_keaktifan: statusBaru,
      account_is_active: newAccount,
      continue_existing_supervision: continueExisting,
      status_effective_at: effectiveAt,
      status_reason: reason,
      status_updated_by: req.user.id,
      status_updated_at: now,
    }, { transaction });

    const history = await RiwayatStatusDosen.create({
      dosen_id: dosen.id,
      status_sebelumnya: oldStatus,
      status_baru: statusBaru,
      account_is_active_sebelumnya: oldAccount,
      account_is_active_baru: newAccount,
      continue_existing_supervision_sebelumnya: oldContinueExisting,
      continue_existing_supervision_baru: continueExisting,
      changed_fields: changedFields,
      effective_at: effectiveAt,
      reason,
      changed_by: req.user.id,
      impact_snapshot: impact,
    }, { transaction });

    let topicsDisabled = 0;
    if (statusBaru !== "active") {
      const [, affected] = await Topik.update(
        { status: "unavailable" },
        { where: { dosen_id: dosen.id, status: "available" }, transaction, returning: true }
      );
      topicsDisabled = Array.isArray(affected) ? affected.length : Number(affected || impact.topik_tersedia || 0);
    }

    const isReactivation = statusBaru === "active" && oldStatus !== "active";
    const needsFollowUp = isReactivation || (statusBaru !== "active" && [
      impact.mahasiswa_bimbingan_aktif,
      impact.review_pending,
      impact.tugas_ketua_cluster_aktif,
      impact.tugas_periode_aktif,
      impact.tugas_master_penanggung_jawab,
      impact.jadwal_sidang_mendatang,
    ].some((value) => Number(value) > 0));
    if (needsFollowUp) {
      const followUpImpact = {
        ...impact,
        reactivation_required: isReactivation,
        reactivation_note: isReactivation
          ? "Periksa topik lama, ketersediaan periode, kapasitas, dan penetapan kembali peran. Topik tidak diaktifkan otomatis."
          : null,
      };
      await TindakLanjutStatusDosen.create({
        dosen_id: dosen.id,
        riwayat_status_dosen_id: history.id,
        status: "open",
        impact_snapshot: followUpImpact,
      }, { transaction });
    }

    await transaction.commit();
    return res.json({
      success: true,
      message: `Status ${dosen.nama} berhasil diubah menjadi ${statusBaru}.`,
      data: { ...dosen.toJSON(), impact, topik_dinonaktifkan: topicsDisabled, tindak_lanjut_dibuat: needsFollowUp },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error di updateDosenStatus:", error);
    return res.status(500).json({ success: false, message: "Gagal memperbarui status dosen.", error: error.message });
  }
};

// PUT /api/admin/mahasiswa/:id/assign-dospem-akademik - Assign dosen pembimbing akademik
exports.assignDosenPembimbingAkademik = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { dosen_pembimbing_akademik_id } = req.body;

    if (!dosen_pembimbing_akademik_id) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "dosen_pembimbing_akademik_id harus diisi",
      });
    }

    // Cek mahasiswa exist
    const mahasiswa = await Mahasiswa.findByPk(id, { transaction: t });
    if (!mahasiswa) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Mahasiswa tidak ditemukan",
      });
    }

    // Cek dosen exist
    const dosen = await Dosen.findByPk(dosen_pembimbing_akademik_id, { transaction: t });
    if (!dosen) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Dosen tidak ditemukan",
      });
    }

    if (Number(mahasiswa.dosen_pembimbing_akademik_id) === Number(dosen.id)) {
      await t.rollback();
      return res.status(409).json({
        success: false,
        message: `${dosen.nama} sudah menjadi dosen pembimbing akademik mahasiswa ini. Tidak ada perubahan penugasan.`,
      });
    }

    const assignmentValidation = assertDosenCanReceiveNewAssignment(dosen, "penugasan baru sebagai DPA");
    if (!assignmentValidation.allowed || dosen.account_is_active === false) {
      await t.rollback();
      return res.status(409).json({
        success: false,
        message: !assignmentValidation.allowed
          ? assignmentValidation.message
          : `${dosen.nama} memiliki akun nonaktif dan tidak dapat menerima penugasan baru sebagai DPA.`,
      });
    }

    // Update mahasiswa
    await mahasiswa.update(
      {
        dosen_pembimbing_akademik_id,
      },
      { transaction: t }
    );

    await t.commit();

    // Load data lengkap
    const updatedMahasiswa = await Mahasiswa.findByPk(id, {
      attributes: { exclude: ["password"] },
      include: [
        {
          model: Dosen,
          as: "dosenPembimbingAkademik",
          attributes: ["id", "nik", "nama", "email"],
        },
      ],
    });

    res.json({
      success: true,
      message: "Dosen pembimbing akademik berhasil di-assign",
      data: updatedMahasiswa,
    });
  } catch (error) {
    if (!t.finished) await t.rollback();
    console.error("Error di assignDosenPembimbingAkademik:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// PUT /api/admin/mahasiswa/:id/update-status - Update status jalur mahasiswa
exports.updateStatusJalur = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { status_jalur_saat_ini } = req.body;

    const validStatus = ["belum_mengajukan", "sedang_mengajukan", "baru", "ulang", "ekstensi", "selesai"];

    if (!status_jalur_saat_ini || !validStatus.includes(status_jalur_saat_ini)) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: `status_jalur_saat_ini harus salah satu dari: ${validStatus.join(", ")}`,
      });
    }

    // Cek mahasiswa exist
    const mahasiswa = await Mahasiswa.findByPk(id, { transaction: t });
    if (!mahasiswa) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Mahasiswa tidak ditemukan",
      });
    }

    // Update mahasiswa
    await mahasiswa.update(
      {
        status_jalur_saat_ini,
      },
      { transaction: t }
    );

    await t.commit();

    // Load data lengkap
    const updatedMahasiswa = await Mahasiswa.findByPk(id, {
      attributes: { exclude: ["password"] },
      include: [
        {
          model: Dosen,
          as: "dosenPembimbingAkademik",
          attributes: ["id", "nik", "nama"],
        },
        {
          model: Dosen,
          as: "dosenPembimbingSkripsi",
          attributes: ["id", "nik", "nama"],
        },
      ],
    });

    res.json({
      success: true,
      message: "Status jalur mahasiswa berhasil diupdate",
      data: updatedMahasiswa,
    });
  } catch (error) {
    if (!t.finished) await t.rollback();
    console.error("Error di updateStatusJalur:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// GET /api/admin/pengajuan - Lihat semua pengajuan
exports.getAllPengajuan = async (req, res) => {
  try {
    const { status, jenis_jalur, tipe_pengajuan } = req.query;

    const where = {};
    if (status) {
      where.status = status;
    }
    if (jenis_jalur) {
      where.jenis_jalur = jenis_jalur;
    }
    if (tipe_pengajuan) {
      where.tipe_pengajuan = tipe_pengajuan;
    }

    const pengajuans = await Pengajuan.findAll({
      where,
      include: [
        {
          model: Mahasiswa,
          as: "mahasiswa",
          attributes: ["id", "nim", "nama", "email", "angkatan"],
        },
        {
          model: Dosen,
          as: "dosen1",
          attributes: ["id", "nik", "nama"],
        },
        {
          model: Dosen,
          as: "dosen2",
          attributes: ["id", "nik", "nama"],
        },
        {
          model: Dosen,
          as: "dosen3",
          attributes: ["id", "nik", "nama"],
        },
        {
          model: Dosen,
          as: "dosenCurrent",
          attributes: ["id", "nik", "nama"],
        },
        {
          model: Dosen,
          as: "prospectiveSupervisor",
          attributes: ["id", "nik", "nama"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    res.json({
      success: true,
      data: pengajuans,
      total: pengajuans.length,
    });
  } catch (error) {
    console.error("Error di getAllPengajuan:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// GET /api/admin/statistics - Dashboard statistics
exports.getStatistics = async (req, res) => {
  try {
    // Total mahasiswa per status jalur
    const statusJalur = await Mahasiswa.findAll({
      attributes: ["status_jalur_saat_ini", [sequelize.fn("COUNT", sequelize.col("id")), "count"]],
      group: ["status_jalur_saat_ini"],
      raw: true,
    });

    // Total pengajuan per status
    const statusPengajuan = await Pengajuan.findAll({
      attributes: ["status", [sequelize.fn("COUNT", sequelize.col("id")), "count"]],
      group: ["status"],
      raw: true,
    });

    // Total pengajuan per jenis jalur
    const jenisJalur = await Pengajuan.findAll({
      attributes: ["jenis_jalur", [sequelize.fn("COUNT", sequelize.col("id")), "count"]],
      group: ["jenis_jalur"],
      raw: true,
    });

    // Total pengajuan per tipe
    const tipePengajuan = await Pengajuan.findAll({
      attributes: ["tipe_pengajuan", [sequelize.fn("COUNT", sequelize.col("id")), "count"]],
      group: ["tipe_pengajuan"],
      raw: true,
    });

    res.json({
      success: true,
      data: {
        mahasiswa_per_status: statusJalur,
        pengajuan_per_status: statusPengajuan,
        pengajuan_per_jenis_jalur: jenisJalur,
        pengajuan_per_tipe: tipePengajuan,
      },
    });
  } catch (error) {
    console.error("Error di getStatistics:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// GET /api/admin/dosen - Lihat daftar dosen lengkap untuk manajemen
exports.getAllDosens = async (req, res) => {
  try {
    const keyword = String(req.query.q || "").trim();
    const mapped = await getMappedDosens(keyword);

    res.json({
      success: true,
      data: mapped,
      total: mapped.length,
    });
  } catch (error) {
    console.error("Error di getAllDosens:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// GET /api/admin/dosen/export - Export data dosen ke file Excel
exports.exportDosensExcel = async (req, res) => {
  try {
    const keyword = String(req.query.q || "").trim();
    const mapped = await getMappedDosens(keyword);

    const exportRows = mapped.map((row, index) => ({
      No: index + 1,
      "Kode Dosen": row.kode_dosen || "",
      NIK: row.nik || "",
      Nama: row.nama || "",
      Gelar: row.gelar || "",
      Email: row.email || "",
      "Jabatan Struktural": row.jabatan_struktural || "",
      Klaster: Array.isArray(row.klasters) && row.klasters.length > 0 ? row.klasters.map((item) => item.kode).join(", ") : "",
      "Kuota Bimbingan": row.kuota_bimbingan ?? 0,
      "Jumlah Bimbingan": row.jumlah_bimbingan ?? 0,
      "Sisa Kuota": row.sisa_kuota ?? 0,
      "Status Dosen": row.status_keaktifan || "active",
      "Status Akun": row.account_is_active === false ? "nonaktif" : "aktif",
      "Melanjutkan Mahasiswa Lama": row.continue_existing_supervision === false ? "tidak" : "ya",
      "Tanggal Efektif Status": row.status_effective_at || "",
      "Alasan Status": row.status_reason || "",
      "Terakhir Diubah": formatDateTimeForExport(row.updatedAt),
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(exportRows);

    worksheet["!cols"] = [
      { wch: 6 },
      { wch: 14 },
      { wch: 22 },
      { wch: 34 },
      { wch: 24 },
      { wch: 36 },
      { wch: 30 },
      { wch: 24 },
      { wch: 16 },
      { wch: 18 },
      { wch: 12 },
      { wch: 22 },
      { wch: 16 },
      { wch: 28 },
      { wch: 22 },
      { wch: 42 },
      { wch: 20 },
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, "Data Dosen");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    const timestamp = new Date().toISOString().slice(0, 10);

    res.setHeader("Content-Disposition", `attachment; filename=data_dosen_${timestamp}.xlsx`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    return res.send(buffer);
  } catch (error) {
    console.error("Error di exportDosensExcel:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// GET /api/admin/klasters - daftar klaster untuk form admin
exports.getAllKlasters = async (req, res) => {
  try {
    const klasters = await ensureDefaultKlasters();

    res.json({
      success: true,
      data: klasters,
      total: klasters.length,
    });
  } catch (error) {
    console.error("Error di getAllKlasters:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// POST /api/admin/dosen - tambah dosen manual dari form admin
exports.createDosen = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    await ensureDefaultKlasters(t);

    const {
      nik,
      nama,
      gelar,
      email,
      jabatan_struktural,
      kuota_bimbingan,
      status_keaktifan,
      klaster_ids,
    } = req.body || {};

    const normalizedNik = nik ? String(nik).trim() : null;
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const gelarValidation = validateDosenTitle(gelar);
    const normalizedGelar = gelarValidation.normalized || null;
    const normalizedJabatanStruktural = normalizeJabatanStrukturalInput(jabatan_struktural);
    const normalizedStatus = String(status_keaktifan || "").trim().toLowerCase();
    const kuotaInput = kuota_bimbingan;
    const kuotaValidation = validateKuotaBimbinganValue(kuotaInput);
    const parsedKuota = kuotaValidation.value;

    if (!DOSEN_STATUSES.includes(normalizedStatus)) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Status dosen wajib diisi dengan nilai active, inactive, study_leave, atau retired.",
      });
    }

    if (!normalizedNik) {
      await t.rollback();
      return res.status(400).json({ success: false, message: "NIK wajib diisi." });
    }

    if (!gelarValidation.isValid) {
      await t.rollback();
      return res.status(400).json({ success: false, message: gelarValidation.message });
    }

    const nameValidation = validateDosenName(nama);
    if (!nameValidation.isValid) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: nameValidation.message,
      });
    }

    if (!normalizedEmail) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Email wajib diisi.",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Format email tidak valid.",
      });
    }

    if (normalizedNik && !/^\d{1,9}$/.test(normalizedNik)) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Format NIK tidak valid. NIK harus angka dengan panjang maksimal 9 digit.",
      });
    }

    if (!kuotaValidation.isValid) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: kuotaValidation.message,
      });
    }

    const jabatanValidation = await validateAndEnsureJabatanStrukturalAvailability({
      jabatanStruktural: normalizedJabatanStruktural,
      transaction: t,
    });
    if (!jabatanValidation.isValid) {
      await t.rollback();
      return res.status(jabatanValidation.statusCode || 400).json({
        success: false,
        message: jabatanValidation.message,
      });
    }

    if (normalizedNik) {
      const existingNik = await Dosen.findOne({
        where: { nik: normalizedNik },
        transaction: t,
      });

      if (existingNik) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: `NIK ${normalizedNik} sudah terdaftar.`,
        });
      }
    }

    const normalizedNamaKey = normalizeNameKey(nameValidation.normalized);
    const existingNama = await Dosen.findOne({
      where: sequelize.where(
        sequelize.fn("LOWER", sequelize.fn("TRIM", sequelize.col("nama"))),
        normalizedNamaKey
      ),
      transaction: t,
    });

    if (existingNama) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: `Nama dosen "${nameValidation.normalized}" sudah terdaftar.`,
      });
    }

    const existingEmail = await Dosen.findOne({
      where: { email: normalizedEmail },
      transaction: t,
    });

    if (existingEmail) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: `Email ${normalizedEmail} sudah terdaftar.`,
      });
    }

    const normalizedKlasterIds = Array.isArray(klaster_ids)
      ? [...new Set(klaster_ids.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0))]
      : [];

    if (normalizedKlasterIds.length === 0) {
      await t.rollback();
      return res.status(400).json({ success: false, message: "Pilih minimal satu Klaster Riset." });
    }

    let klasters = [];
    if (normalizedKlasterIds.length > 0) {
      klasters = await Klaster.findAll({
        where: { id: { [Op.in]: normalizedKlasterIds } },
        transaction: t,
      });

      if (klasters.length !== normalizedKlasterIds.length) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: "Ada klaster yang tidak valid.",
        });
      }
    }

    const nextSeq = await getNextDosenSequence(t);
    const generatedKodeDosen = `DSN${String(nextSeq).padStart(4, "0")}`;
    const defaultPassword = process.env.DEFAULT_PASSWORD_DOSEN || "12345678";

    const newDosen = await Dosen.create(
      {
        kode_dosen: generatedKodeDosen,
        nik: normalizedNik,
        nama: nameValidation.normalized,
        gelar: normalizedGelar || null,
        email: normalizedEmail,
        password: defaultPassword,
        is_default_password: true,
        jabatan_struktural: normalizedJabatanStruktural || null,
        kuota_bimbingan: parsedKuota,
        status_keaktifan: normalizedStatus,
        account_is_active: normalizedStatus !== "retired",
        continue_existing_supervision: normalizedStatus === "active",
        status_effective_at: getJakartaDateOnly(),
        status_reason: "Status awal saat dosen ditambahkan",
        status_updated_by: req.user.id,
        status_updated_at: new Date(),
      },
      { transaction: t }
    );

    if (klasters.length > 0) {
      await newDosen.setKlasters(klasters, { transaction: t });
    }

    await initializeAvailabilityForDosen(newDosen, t);

    await t.commit();

    const created = await Dosen.findByPk(newDosen.id, {
      attributes: [
        "id",
        "kode_dosen",
        "nik",
        "nama",
        "gelar",
        "email",
        "jabatan_struktural",
        "kuota_bimbingan",
        "status_keaktifan",
        "account_is_active",
        "continue_existing_supervision",
        "status_effective_at",
        "status_reason",
        "createdAt",
        "updatedAt",
      ],
      include: [
        {
          model: Klaster,
          as: "klasters",
          attributes: ["id", "kode", "nama"],
          through: { attributes: [] },
          required: false,
        },
      ],
    });

    res.status(201).json({
      success: true,
      message: "Dosen berhasil ditambahkan ke grid.",
      data: created,
    });
  } catch (error) {
    if (!t.finished) await t.rollback();
    console.error("Error di createDosen:", error);
    if (
      error?.name === "SequelizeUniqueConstraintError" &&
      JSON.stringify(error?.errors || []).includes("uq_dosen_jabatan_struktural_single_holder")
    ) {
      return res.status(409).json({
        success: false,
        message: "Jabatan struktural sudah digunakan oleh dosen lain.",
      });
    }
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// PUT /api/admin/dosen/:id/profil - Update gelar, jabatan struktural, dan klaster dosen
exports.updateDosenProfil = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    await ensureDefaultKlasters(t);

    const { id } = req.params;
    const dosen = await Dosen.findByPk(id, { transaction: t });

    if (!dosen) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Dosen tidak ditemukan",
      });
    }

    const rawGelar = req.body?.gelar;
    const rawJabatanStruktural = req.body?.jabatan_struktural;
    const rawKlasterIds = req.body?.klaster_ids;

    const gelarValidation = validateDosenTitle(rawGelar === undefined ? dosen.gelar : rawGelar);
    const gelar = gelarValidation.normalized || null;
    const jabatanStruktural = rawJabatanStruktural === undefined
      ? normalizeJabatanStrukturalInput(dosen.jabatan_struktural)
      : normalizeJabatanStrukturalInput(rawJabatanStruktural);

    if (!gelarValidation.isValid) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: gelarValidation.message,
      });
    }

    if (rawJabatanStruktural !== undefined || jabatanStruktural !== normalizeJabatanStrukturalInput(dosen.jabatan_struktural)) {
      const jabatanValidation = await validateAndEnsureJabatanStrukturalAvailability({
        jabatanStruktural,
        excludeDosenId: dosen.id,
        transaction: t,
      });
      if (!jabatanValidation.isValid) {
        await t.rollback();
        return res.status(jabatanValidation.statusCode || 400).json({
          success: false,
          message: jabatanValidation.message,
        });
      }
    }

    const normalizedKlasterIds =
      rawKlasterIds === undefined
        ? null
        : Array.isArray(rawKlasterIds)
          ? [...new Set(rawKlasterIds.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0))]
          : [];

    let klasters = null;
    if (normalizedKlasterIds !== null) {
      klasters = [];

      if (normalizedKlasterIds.length > 0) {
        klasters = await Klaster.findAll({
          where: { id: { [Op.in]: normalizedKlasterIds } },
          transaction: t,
        });

        if (klasters.length !== normalizedKlasterIds.length) {
          await t.rollback();
          return res.status(400).json({
            success: false,
            message: "Ada klaster yang tidak valid.",
          });
        }
      }
    }

    await dosen.update(
      {
        gelar,
        jabatan_struktural: jabatanStruktural,
      },
      { transaction: t }
    );

    if (klasters !== null) {
      await dosen.setKlasters(klasters, { transaction: t });
    }

    await t.commit();

    const refreshed = await Dosen.findByPk(id, {
      attributes: [
        "id",
        "kode_dosen",
        "nik",
        "nama",
        "gelar",
        "email",
        "jabatan_struktural",
        "kuota_bimbingan",
        "updatedAt",
      ],
      include: [
        {
          model: Klaster,
          as: "klasters",
          attributes: ["id", "kode", "nama"],
          through: { attributes: [] },
          required: false,
        },
      ],
    });

    res.json({
      success: true,
      message: "Profil dosen berhasil diperbarui.",
      data: refreshed,
    });
  } catch (error) {
    if (!t.finished) await t.rollback();
    console.error("Error di updateDosenProfil:", error);
    if (
      error?.name === "SequelizeUniqueConstraintError" &&
      JSON.stringify(error?.errors || []).includes("uq_dosen_jabatan_struktural_single_holder")
    ) {
      return res.status(409).json({
        success: false,
        message: "Jabatan struktural sudah digunakan oleh dosen lain.",
      });
    }
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// PUT /api/admin/dosen/jabatan-struktural - Atur jabatan struktural dosen secara terpusat
exports.updateJabatanStrukturalAssignments = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const assignmentInput = normalizeJabatanAssignmentPayload(req.body?.assignments);
    const normalizedAssignments = STRUKTURAL_POSITIONS.map((jabatan) => {
      const dosenIdRaw = assignmentInput[jabatan];
      const dosenId = dosenIdRaw === null || dosenIdRaw === undefined || dosenIdRaw === ""
        ? null
        : Number(dosenIdRaw);

      return {
        jabatan,
        dosenId: Number.isInteger(dosenId) && dosenId > 0 ? dosenId : null,
      };
    });

    const unknownAssignments = Object.keys(assignmentInput).filter(
      (jabatan) => !STRUKTURAL_POSITIONS.includes(jabatan)
    );
    if (unknownAssignments.length > 0) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: `Ada jabatan struktural tidak valid: ${unknownAssignments.join(", ")}.`,
      });
    }

    const usedDosenIds = new Map();
    for (const item of normalizedAssignments) {
      if (!item.dosenId) continue;
      if (usedDosenIds.has(item.dosenId)) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message:
            "Satu dosen tidak boleh memegang lebih dari satu jabatan struktural. Periksa kembali pilihan dosen.",
        });
      }
      usedDosenIds.set(item.dosenId, item.jabatan);
    }

    const targetDosenIds = [...usedDosenIds.keys()];
    if (targetDosenIds.length > 0) {
      const dosens = await Dosen.findAll({
        where: { id: { [Op.in]: targetDosenIds } },
        attributes: ["id"],
        transaction: t,
      });
      if (dosens.length !== targetDosenIds.length) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: "Ada dosen yang tidak valid atau sudah tidak tersedia.",
        });
      }
    }

    await Dosen.update(
      { jabatan_struktural: null },
      {
        where: {
          jabatan_struktural: { [Op.in]: STRUKTURAL_POSITIONS },
        },
        transaction: t,
      }
    );

    for (const item of normalizedAssignments) {
      if (!item.dosenId) continue;
      await Dosen.update(
        { jabatan_struktural: item.jabatan },
        {
          where: { id: item.dosenId },
          transaction: t,
        }
      );
    }

    await t.commit();

    const rows = await getMappedDosens();
    return res.json({
      success: true,
      message: "Jabatan struktural dosen berhasil diperbarui.",
      data: {
        assignments: normalizedAssignments,
        rows,
      },
    });
  } catch (error) {
    if (!t.finished) await t.rollback();
    console.error("Error di updateJabatanStrukturalAssignments:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// ========== ADMIN - KUOTA MANAGEMENT ==========
// Tambahkan di bagian bawah adminController.js

// GET /api/admin/dosen/kuota-overview - Monitor semua kuota dosen
exports.getKuotaOverview = async (req, res) => {
  try {
    const dosens = await Dosen.findAll({
      attributes: ["id", "nik", "nama", "email", "jabatan_struktural", "kuota_bimbingan"],
      order: [["nama", "ASC"]],
    });

    const dosensWithKuota = await Promise.all(
      dosens.map(async (dosen) => {
        const kuotaInfo = await dosen.getKuotaInfo();

        // Dapatkan list mahasiswa bimbingan
        const supervisedIds = await getSupervisedMahasiswaIdsWithLegacyFallback(dosen.id);
        const mahasiswas = await Mahasiswa.findAll({
          where: { id: { [Op.in]: supervisedIds } },
          attributes: ["id", "nim", "nama", "angkatan"],
        });

        return {
          id: dosen.id,
          nik: dosen.nik,
          nama: dosen.nama,
          email: dosen.email,
          jabatan_struktural: dosen.jabatan_struktural,
          kuota: kuotaInfo,
          mahasiswa_bimbingan: mahasiswas,
        };
      })
    );

    // Summary
    const summary = {
      total_dosen: dosensWithKuota.length,
      total_kuota: dosensWithKuota.reduce((sum, d) => sum + d.kuota.total, 0),
      total_terpakai: dosensWithKuota.reduce((sum, d) => sum + d.kuota.terpakai, 0),
      total_sisa: dosensWithKuota.reduce((sum, d) => sum + d.kuota.sisa, 0),
      dosen_penuh: dosensWithKuota.filter((d) => d.kuota.is_penuh).length,
    };

    res.json({
      success: true,
      data: {
        summary,
        dosens: dosensWithKuota,
      },
    });
  } catch (error) {
    console.error("Error di getKuotaOverview:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// PUT /api/admin/dosen/:id/kuota - Admin set kuota dosen
exports.setKuotaDosen = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { kuota_bimbingan } = req.body;
    const kuotaValidation = validateKuotaBimbinganValue(kuota_bimbingan);
    const parsedKuota = kuotaValidation.value;

    if (!kuotaValidation.isValid) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: kuotaValidation.message,
      });
    }

    const dosen = await Dosen.findByPk(id, { transaction: t });

    if (!dosen) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Dosen tidak ditemukan",
      });
    }

    const oldKuota = dosen.kuota_bimbingan;

    // Update kuota
    await dosen.update({ kuota_bimbingan: parsedKuota }, { transaction: t });

    // Cek apakah perlu re-enable/disable topik
    const kuotaInfo = await dosen.getKuotaInfo();

    if (parsedKuota > oldKuota && !kuotaInfo.is_penuh) {
      // Kuota ditambah dan tidak penuh → re-enable topik
      await Topik.update(
        { status: "available" },
        {
          where: {
            dosen_id: id,
            status: "unavailable",
          },
          transaction: t,
        }
      );
    } else if (kuotaInfo.is_penuh) {
      // Kuota penuh → disable topik
      await Topik.update(
        { status: "unavailable" },
        {
          where: {
            dosen_id: id,
            status: "available",
          },
          transaction: t,
        }
      );
    }

    await t.commit();

    const updatedKuotaInfo = await dosen.getKuotaInfo();

    res.json({
      success: true,
      message: `Kuota dosen berhasil diupdate dari ${oldKuota} menjadi ${parsedKuota}`,
      data: {
        dosen: {
          id: dosen.id,
          nama: dosen.nama,
          nik: dosen.nik,
        },
        kuota: updatedKuotaInfo,
      },
    });
  } catch (error) {
    if (!t.finished) await t.rollback();
    console.error("Error di setKuotaDosen:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// GET /api/admin/dosen/:id/kuota - Admin lihat detail kuota dosen
exports.getKuotaDosenDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const dosen = await Dosen.findByPk(id, {
      attributes: ["id", "nik", "nama", "email", "jabatan_struktural", "kuota_bimbingan"],
    });

    if (!dosen) {
      return res.status(404).json({
        success: false,
        message: "Dosen tidak ditemukan",
      });
    }

    const kuotaInfo = await dosen.getKuotaInfo();

    // Dapatkan mahasiswa bimbingan
    const supervisedIds = await getSupervisedMahasiswaIdsWithLegacyFallback(id);
    const mahasiswas = await Mahasiswa.findAll({
      where: { id: { [Op.in]: supervisedIds } },
      attributes: ["id", "nim", "nama", "email", "angkatan", "status_jalur_saat_ini"],
      include: [
        {
          model: Pengajuan,
          as: "pengajuanAktif",
          attributes: ["id", "jenis_jalur", "tipe_pengajuan", "status"],
        },
      ],
      order: [["nim", "ASC"]],
    });

    // Dapatkan topik dosen
    const topiks = await Topik.findAll({
      where: { dosen_id: id },
      attributes: ["id", "kode", "judul", "cluster", "status"],
      order: [["kode", "ASC"]],
    });

    res.json({
      success: true,
      data: {
        dosen: {
          id: dosen.id,
          nik: dosen.nik,
          nama: dosen.nama,
          email: dosen.email,
          jabatan_struktural: dosen.jabatan_struktural,
        },
        kuota: kuotaInfo,
        mahasiswa_bimbingan: mahasiswas,
        topiks: topiks,
      },
    });
  } catch (error) {
    console.error("Error di getKuotaDosenDetail:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

