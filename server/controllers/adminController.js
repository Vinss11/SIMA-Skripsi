const { Mahasiswa, Dosen, Klaster, Pengajuan, Topik, sequelize } = require("../models");
const { Op } = require("sequelize");
const XLSX = require("xlsx");
const { fetchMahasiswaMasterData } = require("../services/mahasiswaMasterService");
const {
  STRUKTURAL_POSITIONS,
  normalizeJabatanStrukturalInput,
  isValidJabatanStruktural,
} = require("../constants/jabatanStruktural");

function normalizeNameKey(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function validateHumanName(name, label) {
  const normalizedName = String(name || "")
    .trim()
    .replace(/\s+/g, " ");

  if (!normalizedName) {
    return {
      isValid: false,
      message: `${label} harus diisi`,
    };
  }

  if (/\d/.test(normalizedName)) {
    return {
      isValid: false,
      message: `${label} tidak boleh mengandung angka`,
    };
  }

  const allowedPattern = /^[A-Za-z'.,\s-]+$/;
  if (!allowedPattern.test(normalizedName)) {
    return {
      isValid: false,
      message: `${label} mengandung karakter tidak valid. Gunakan huruf, spasi, titik, koma, apostrof, atau tanda hubung.`,
    };
  }

  return {
    isValid: true,
    normalized: normalizedName,
  };
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
    const klasters = await Klaster.findAll({
      attributes: ["id", "kode", "nama"],
      order: [["nama", "ASC"]],
    });

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
    const {
      nik,
      nama,
      gelar,
      email,
      jabatan_struktural,
      kuota_bimbingan,
      klaster_ids,
    } = req.body || {};

    const normalizedNik = nik ? String(nik).trim() : null;
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const normalizedGelar = gelar ? String(gelar).trim() : null;
    const normalizedJabatanStruktural = normalizeJabatanStrukturalInput(jabatan_struktural);
    const parsedKuota = kuota_bimbingan === undefined || kuota_bimbingan === null || kuota_bimbingan === ""
      ? 5
      : Number(kuota_bimbingan);

    const nameValidation = validateHumanName(nama, "Nama dosen");
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

    if (!Number.isFinite(parsedKuota) || parsedKuota < 1 || !Number.isInteger(parsedKuota)) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Kuota bimbingan harus angka bulat minimal 1.",
      });
    }

    if (normalizedGelar && normalizedGelar.length > 120) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Gelar maksimal 120 karakter.",
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
    const generatedNik = String(nextSeq).padStart(9, "0");
    const defaultPassword = process.env.DEFAULT_PASSWORD_DOSEN || "12345678";

    const newDosen = await Dosen.create(
      {
        kode_dosen: generatedKodeDosen,
        nik: normalizedNik || generatedNik,
        nama: nameValidation.normalized,
        gelar: normalizedGelar || null,
        email: normalizedEmail,
        password: defaultPassword,
        is_default_password: true,
        jabatan_struktural: normalizedJabatanStruktural || null,
        kuota_bimbingan: parsedKuota,
      },
      { transaction: t }
    );

    if (klasters.length > 0) {
      await newDosen.setKlasters(klasters, { transaction: t });
    }

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

    const gelar = rawGelar === undefined ? dosen.gelar : String(rawGelar || "").trim() || null;
    const jabatanStruktural = rawJabatanStruktural === undefined
      ? normalizeJabatanStrukturalInput(dosen.jabatan_struktural)
      : normalizeJabatanStrukturalInput(rawJabatanStruktural);

    if (gelar && gelar.length > 120) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Gelar maksimal 120 karakter.",
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
        const mahasiswas = await Mahasiswa.findAll({
          where: { dosen_pembimbing_skripsi_id: dosen.id },
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

    if (!kuota_bimbingan || kuota_bimbingan < 1) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "kuota_bimbingan harus diisi dan minimal 1",
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
    await dosen.update({ kuota_bimbingan }, { transaction: t });

    // Cek apakah perlu re-enable/disable topik
    const kuotaInfo = await dosen.getKuotaInfo();

    if (kuota_bimbingan > oldKuota && !kuotaInfo.is_penuh) {
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
      message: `Kuota dosen berhasil diupdate dari ${oldKuota} menjadi ${kuota_bimbingan}`,
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
    const mahasiswas = await Mahasiswa.findAll({
      where: { dosen_pembimbing_skripsi_id: id },
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

