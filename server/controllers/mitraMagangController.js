const { Op, fn, col, cast, where, QueryTypes } = require("sequelize");
const { MitraMagang, sequelize } = require("../models");

const NON_PARTNER_LABEL = "Other (Non partner Company)";

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeNullableText(value) {
  const parsed = normalizeText(value);
  return parsed || null;
}

function normalizeStatus(value) {
  const status = normalizeText(value).toLowerCase();
  if (status === "inactive") return "inactive";
  return "active";
}

function normalizeOptionalQuota(value) {
  if (value === null || value === undefined || value === "") return null;
  const digitsOnly = String(value).replace(/\D/g, "").slice(0, 2);
  if (!digitsOnly) return null;
  const parsed = Number(digitsOnly);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 99) return null;
  return parsed;
}

function normalizeRequiredQuota(value) {
  const parsed = normalizeOptionalQuota(value);
  return parsed === null ? null : parsed;
}

function buildMitraPayload(item) {
  return {
    id: item.id,
    nama: item.nama,
    bidang_jenis: item.bidang_jenis || null,
    lokasi: item.lokasi || null,
    email_kontak: item.email_kontak || null,
    website: item.website || null,
    posisi_magang: item.posisi_magang || null,
    quota_magang: item.quota_magang ?? null,
    kriteria: item.kriteria || null,
    prosedur_perusahaan: item.prosedur_perusahaan || null,
    status: item.status,
    is_active: item.is_active !== false,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

async function isMitraUsedInPengajuan({ nama, id, transaction }) {
  const mitraIdText = String(id || "").trim();
  const results = await sequelize.query(
    `
      SELECT 1
      FROM "PendaftaranPenjalurans"
      WHERE
        "form_lanjutan_payload" IS NOT NULL
        AND (
          ("form_lanjutan_payload"->>'jalur') = 'magang'
          OR ("form_lanjutan_payload"->>'selected_jalur') = 'magang'
        )
        AND (
          ("form_lanjutan_payload"->>'mitra_id') = :mitraIdText
          OR LOWER(COALESCE("form_lanjutan_payload"->>'chosen_institution', '')) = LOWER(:nama)
          OR LOWER(COALESCE("form_lanjutan_payload"->'mitra_snapshot'->>'nama', '')) = LOWER(:nama)
        )
      LIMIT 1
    `,
    {
      replacements: {
        nama: normalizeText(nama),
        mitraIdText,
      },
      type: QueryTypes.SELECT,
      transaction,
    }
  );

  return Array.isArray(results) && results.length > 0;
}

async function findDuplicateNama(nama, excludeId = null) {
  const loweredNama = normalizeText(nama).toLowerCase();
  if (!loweredNama) return null;

  const duplicateWhere = [where(fn("LOWER", col("nama")), loweredNama)];
  if (excludeId) {
    duplicateWhere.push({ id: { [Op.ne]: excludeId } });
  }

  return MitraMagang.findOne({
    where: {
      [Op.and]: duplicateWhere,
    },
    attributes: ["id", "nama"],
  });
}

exports.getMitraMagangOptions = async (_req, res) => {
  try {
    const rows = await MitraMagang.findAll({
      where: { is_active: true },
      attributes: [
        "id",
        "nama",
        "bidang_jenis",
        "lokasi",
        "website",
        "posisi_magang",
        "quota_magang",
        "kriteria",
        "prosedur_perusahaan",
      ],
      order: [["nama", "ASC"]],
    });

    return res.status(200).json({
      success: true,
      data: {
        options: rows.map((item) => ({
          id: item.id,
          nama: item.nama,
          bidang_jenis: item.bidang_jenis || null,
          lokasi: item.lokasi || null,
          website: item.website || null,
          posisi_magang: item.posisi_magang || null,
          quota_magang: item.quota_magang ?? null,
          kriteria: item.kriteria || null,
          prosedur_perusahaan: item.prosedur_perusahaan || null,
        })),
        non_partner_option_label: NON_PARTNER_LABEL,
      },
    });
  } catch (error) {
    console.error("Error di getMitraMagangOptions:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

exports.getMitraMagangList = async (req, res) => {
  try {
    const keyword = normalizeText(req.query.q).toLowerCase();
    const statusFilter = normalizeText(req.query.status).toLowerCase();

    const whereClause = {};

    if (statusFilter === "active" || statusFilter === "inactive") {
      whereClause.status = statusFilter;
    }
    if (statusFilter === "all") {
      delete whereClause.status;
    }

    if (keyword) {
      whereClause[Op.or] = [
        { nama: { [Op.iLike]: `%${keyword}%` } },
        { bidang_jenis: { [Op.iLike]: `%${keyword}%` } },
        { lokasi: { [Op.iLike]: `%${keyword}%` } },
        { email_kontak: { [Op.iLike]: `%${keyword}%` } },
        { website: { [Op.iLike]: `%${keyword}%` } },
        { posisi_magang: { [Op.iLike]: `%${keyword}%` } },
        where(cast(col("quota_magang"), "TEXT"), { [Op.iLike]: `%${keyword}%` }),
        { kriteria: { [Op.iLike]: `%${keyword}%` } },
        { prosedur_perusahaan: { [Op.iLike]: `%${keyword}%` } },
      ];
    }

    const rows = await MitraMagang.findAll({
      where: whereClause,
      order: [
        ["status", "ASC"],
        ["nama", "ASC"],
      ],
    });

    return res.status(200).json({
      success: true,
      data: rows.map(buildMitraPayload),
      total: rows.length,
    });
  } catch (error) {
    console.error("Error di getMitraMagangList:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

exports.createMitraMagang = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const nama = normalizeText(req.body?.nama);
    const quotaMagang = normalizeRequiredQuota(req.body?.quota_magang);
    if (!nama) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Nama mitra magang wajib diisi.",
      });
    }
    if (quotaMagang === null) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Quota magang wajib diisi.",
      });
    }

    const duplicate = await findDuplicateNama(nama);
    if (duplicate) {
      await t.rollback();
      return res.status(409).json({
        success: false,
        message: `Mitra magang '${duplicate.nama}' sudah terdaftar.`,
      });
    }

    const created = await MitraMagang.create(
      {
        nama,
        bidang_jenis: normalizeNullableText(req.body?.bidang_jenis),
        lokasi: normalizeNullableText(req.body?.lokasi),
        email_kontak: normalizeNullableText(req.body?.email_kontak),
        website: normalizeNullableText(req.body?.website),
        posisi_magang: normalizeNullableText(req.body?.posisi_magang),
        quota_magang: quotaMagang,
        kriteria: normalizeNullableText(req.body?.kriteria),
        prosedur_perusahaan: normalizeNullableText(req.body?.prosedur_perusahaan),
        status: normalizeStatus(req.body?.status),
        is_active: normalizeStatus(req.body?.status) === "active",
      },
      { transaction: t }
    );

    await t.commit();
    return res.status(201).json({
      success: true,
      message: "Mitra magang berhasil ditambahkan.",
      data: buildMitraPayload(created),
    });
  } catch (error) {
    if (!t.finished) await t.rollback();
    console.error("Error di createMitraMagang:", error);
    if (error?.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        success: false,
        message: "Nama mitra magang sudah terdaftar. Gunakan nama lain.",
      });
    }
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

exports.updateMitraMagang = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "ID mitra magang tidak valid.",
      });
    }

    const mitra = await MitraMagang.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!mitra) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Data mitra magang tidak ditemukan.",
      });
    }

    if (mitra.is_active === false || mitra.status === "inactive") {
      await t.rollback();
      return res.status(409).json({
        success: false,
        message: "Mitra magang sudah nonaktif.",
      });
    }

    const nama = normalizeText(req.body?.nama || mitra.nama);
    const quotaMagang = normalizeRequiredQuota(req.body?.quota_magang);
    if (!nama) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Nama mitra magang wajib diisi.",
      });
    }
    if (quotaMagang === null) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Quota magang wajib diisi.",
      });
    }

    const duplicate = await findDuplicateNama(nama, id);
    if (duplicate) {
      await t.rollback();
      return res.status(409).json({
        success: false,
        message: `Mitra magang '${duplicate.nama}' sudah terdaftar.`,
      });
    }

    mitra.nama = nama;
    mitra.bidang_jenis = normalizeNullableText(req.body?.bidang_jenis);
    mitra.lokasi = normalizeNullableText(req.body?.lokasi);
    mitra.email_kontak = normalizeNullableText(req.body?.email_kontak);
    mitra.website = normalizeNullableText(req.body?.website);
    mitra.posisi_magang = normalizeNullableText(req.body?.posisi_magang);
    mitra.quota_magang = quotaMagang;
    mitra.kriteria = normalizeNullableText(req.body?.kriteria);
    mitra.prosedur_perusahaan = normalizeNullableText(req.body?.prosedur_perusahaan);
    mitra.status = normalizeStatus(req.body?.status || mitra.status);
    mitra.is_active = mitra.status === "active";
    await mitra.save({ transaction: t });

    await t.commit();
    return res.status(200).json({
      success: true,
      message: "Mitra magang berhasil diperbarui.",
      data: buildMitraPayload(mitra),
    });
  } catch (error) {
    if (!t.finished) await t.rollback();
    console.error("Error di updateMitraMagang:", error);
    if (error?.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        success: false,
        message: "Nama mitra magang sudah terdaftar. Gunakan nama lain.",
      });
    }
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

exports.deleteMitraMagang = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "ID mitra magang tidak valid.",
      });
    }

    const mitra = await MitraMagang.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!mitra) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Data mitra magang tidak ditemukan.",
      });
    }

    const usedByPengajuan = await isMitraUsedInPengajuan({
      nama: mitra.nama,
      id: mitra.id,
      transaction: t,
    });

    mitra.status = "inactive";
    mitra.is_active = false;
    await mitra.save({ transaction: t });
    await t.commit();

    return res.status(200).json({
      success: true,
      message: usedByPengajuan
        ? "Mitra magang sudah pernah dipakai dalam pengajuan. Data dinonaktifkan (soft delete)."
        : "Mitra magang berhasil dinonaktifkan.",
      data: { id, soft_deleted: true, used_by_pengajuan: usedByPengajuan },
    });
  } catch (error) {
    if (!t.finished) await t.rollback();
    console.error("Error di deleteMitraMagang:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

exports.NON_PARTNER_LABEL = NON_PARTNER_LABEL;
