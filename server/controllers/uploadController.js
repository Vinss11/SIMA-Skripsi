const XLSX = require("xlsx");
const fs = require("fs");
const { Op } = require("sequelize");
const { Topik, Dosen, DosenKlaster, Mahasiswa, Klaster, SekretarisProdi, sequelize } = require("../models");
const {
  STRUKTURAL_POSITIONS,
  normalizeJabatanStrukturalInput,
  isValidJabatanStruktural,
} = require("../constants/jabatanStruktural");

const TEMPLATE_HEADERS = {
  topik: [
    { key: "kode topik", label: "Kode Topik" },
    { key: "judul", label: "Judul" },
    { key: "deskripsi", label: "Deskripsi" },
    { key: "keyword", label: "Keyword" },
    { key: "cluster", label: "Cluster" },
  ],
  dosen: [
    { key: "nik", label: "NIK" },
    { key: "nama", label: "Nama" },
    { key: "gelar", label: "Gelar" },
    { key: "email", label: "Email" },
    { key: "jabatan struktural", label: "Jabatan Struktural" },
    { key: "klaster", label: "Klaster" },
    { key: "kuota bimbingan", label: "Kuota Bimbingan" },
  ],
  mahasiswa: [
    { key: "nim", label: "NIM" },
    { key: "nama", label: "Nama" },
    { key: "email", label: "Email" },
    { key: "angkatan", label: "Angkatan" },
    { key: "nik dpa", label: "NIK DPA" },
  ],
};

function normalizeHeader(header) {
  return String(header || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function getSheetHeaders(sheet) {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: "" });
  if (!rows.length || !Array.isArray(rows[0])) {
    return [];
  }

  return rows[0].map((header) => normalizeHeader(header)).filter(Boolean);
}

function validateTemplateHeaders(sheetHeaders, templateType) {
  const requiredHeaders = TEMPLATE_HEADERS[templateType] || [];
  const missing = requiredHeaders.filter((item) => !sheetHeaders.includes(item.key));

  return {
    isValid: missing.length === 0,
    missingLabels: missing.map((item) => item.label),
    expectedLabels: requiredHeaders.map((item) => item.label),
  };
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

function normalizeNameKey(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

const KLASTER_INPUT_ALIAS = {
  "sistem informasi": "SIRKEL",
  "rekayasa perangkat lunak": "SIRKEL",
  sdata: "ITSC",
  medis: "ITSC",
  "sains data": "ITSC",
  "informatika medis": "ITSC",
  "informatika teori & sistem cerdas": "ITSC",
  "informatika teori dan sistem cerdas": "ITSC",
  "multimedia & visi komputer": "MVK",
  "multimedia dan visi komputer": "MVK",
  "sistem siber": "SIBER",
};

const TOPIK_CLUSTER_LABEL_BY_CODE = {
  SIRKEL: "Sirkel",
  SIBER: "Siber",
  ITSC: "ITSC",
  MVK: "MVK",
};

function normalizeTopikClusterCode(value) {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw) return null;
  if (raw === "SIRKER") return "SIRKEL";
  if (raw.includes("SISTEM INFORMASI") || raw.includes("REKAYASA PERANGKAT LUNAK") || raw.includes("SIRKEL")) {
    return "SIRKEL";
  }
  if (raw.includes("SIBER")) return "SIBER";
  if (raw.includes("MULTIMEDIA") || raw.includes("VISI KOMPUTER") || raw.includes("MVK")) return "MVK";
  if (raw.includes("INFORMATIKA TEORI") || raw.includes("SISTEM CERDAS") || raw.includes("ITSC")) return "ITSC";
  if (TOPIK_CLUSTER_LABEL_BY_CODE[raw]) return raw;
  return null;
}

function normalizeTopikClusterLabel(value) {
  const code = normalizeTopikClusterCode(value);
  if (!code) return null;
  return TOPIK_CLUSTER_LABEL_BY_CODE[code] || null;
}

function resolveTopikClusterFromKode(kode) {
  const normalizedKode = String(kode || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9]/g, "");
  if (!normalizedKode) return null;
  const prefix = normalizedKode.replace(/[0-9].*$/, "");
  const code = normalizeTopikClusterCode(prefix);
  if (!code) return null;
  return {
    code,
    label: TOPIK_CLUSTER_LABEL_BY_CODE[code] || null,
  };
}

async function getAllowedTopikClustersForDosen(dosenId, transaction, cache) {
  const numericDosenId = Number(dosenId);
  if (!Number.isInteger(numericDosenId) || numericDosenId <= 0) {
    return [];
  }

  if (cache.has(numericDosenId)) {
    return cache.get(numericDosenId);
  }

  const memberships = await DosenKlaster.findAll({
    where: { dosen_id: numericDosenId },
    include: [
      {
        model: Klaster,
        as: "klaster",
        attributes: ["kode", "nama"],
      },
    ],
    attributes: ["id"],
    transaction,
  });

  const labels = new Set();
  for (const row of memberships) {
    const codeFromKode = normalizeTopikClusterCode(row?.klaster?.kode);
    if (codeFromKode && TOPIK_CLUSTER_LABEL_BY_CODE[codeFromKode]) {
      labels.add(TOPIK_CLUSTER_LABEL_BY_CODE[codeFromKode]);
      continue;
    }

    const codeFromNama = normalizeTopikClusterCode(row?.klaster?.nama);
    if (codeFromNama && TOPIK_CLUSTER_LABEL_BY_CODE[codeFromNama]) {
      labels.add(TOPIK_CLUSTER_LABEL_BY_CODE[codeFromNama]);
    }
  }

  const finalLabels = [...labels];
  cache.set(numericDosenId, finalLabels);
  return finalLabels;
}

async function resolveActorDosenForTopikUpload(req, transaction = null) {
  if (req.user?.role === "dosen") {
    return Dosen.findByPk(req.user.id, {
      attributes: ["id", "nik", "kode_dosen", "email", "nama", "jabatan_struktural"],
      transaction: transaction || undefined,
    });
  }

  if (req.user?.role !== "sekretaris_prodi") return null;

  const username = String(req.user?.username || "").trim();
  const where = [];
  if (username) {
    where.push({ nik: username });
    where.push({ email: username.toLowerCase() });
    where.push({ kode_dosen: username.toUpperCase() });
  }
  if (where.length > 0) {
    const dosenByUsername = await Dosen.findOne({
      where: { [Op.or]: where },
      attributes: ["id", "nik", "kode_dosen", "email", "nama", "jabatan_struktural"],
      transaction: transaction || undefined,
    });
    if (dosenByUsername) return dosenByUsername;
  }

  const sekretaris = await SekretarisProdi.findByPk(req.user.id, {
    attributes: ["nik", "email", "jabatan"],
    transaction: transaction || undefined,
  });
  if (!sekretaris) return null;

  const fallbackWhere = [];
  if (sekretaris.nik) fallbackWhere.push({ nik: String(sekretaris.nik).trim() });
  if (sekretaris.email) fallbackWhere.push({ email: String(sekretaris.email).trim().toLowerCase() });
  if (fallbackWhere.length > 0) {
    const dosenByIdentity = await Dosen.findOne({
      where: { [Op.or]: fallbackWhere },
      attributes: ["id", "nik", "kode_dosen", "email", "nama", "jabatan_struktural"],
      transaction: transaction || undefined,
    });
    if (dosenByIdentity) return dosenByIdentity;
  }

  if (sekretaris.jabatan) {
    const dosenByJabatan = await Dosen.findOne({
      where: { jabatan_struktural: sekretaris.jabatan },
      attributes: ["id", "nik", "kode_dosen", "email", "nama", "jabatan_struktural"],
      transaction: transaction || undefined,
    });
    if (dosenByJabatan) return dosenByJabatan;
  }

  return null;
}

function extractTopikUploadValues(rawRow = {}) {
  return {
    kode: rawRow["Kode Topik"] || rawRow.kode || rawRow.KODE || "",
    judul: rawRow.Judul || rawRow.judul || rawRow.JUDUL || "",
    deskripsi: rawRow.Deskripsi || rawRow.deskripsi || rawRow.DESKRIPSI || "",
    keyword: rawRow.Keyword || rawRow.keyword || rawRow.KEYWORD || rawRow["Kata Kunci"] || rawRow.kata_kunci || "",
    cluster: rawRow.Cluster || rawRow.cluster || rawRow.CLUSTER || "",
    dosenIdentifier:
      rawRow["NIK Dosen"] ||
      rawRow.nik ||
      rawRow.NIK ||
      rawRow["Kode Dosen"] ||
      rawRow.kode_dosen ||
      rawRow["Email Dosen"] ||
      rawRow.email_dosen ||
      rawRow.dosen_identifier ||
      "",
  };
}

function parseKlasterListInput(rawKlasterValue, klasterMap) {
  if (rawKlasterValue === null || rawKlasterValue === undefined || rawKlasterValue === "") {
    return {
      klasterIds: [],
      invalidTokens: [],
    };
  }

  const tokens = String(rawKlasterValue)
    .split(/[;,|]/g)
    .map((item) => item.trim())
    .filter(Boolean);

  const uniqueIds = new Set();
  const invalidTokens = [];

  for (const token of tokens) {
    const normalizedToken = token.toLowerCase().replace(/\s+/g, " ").trim();
    const byAlias = KLASTER_INPUT_ALIAS[normalizedToken];
    const byCode = token.toUpperCase().replace(/\s+/g, "");
    const targetKey = byAlias || byCode || normalizedToken;
    const klaster = klasterMap.get(targetKey) || klasterMap.get(normalizedToken);

    if (!klaster) {
      invalidTokens.push(token);
      continue;
    }

    uniqueIds.add(klaster.id);
  }

  return {
    klasterIds: [...uniqueIds],
    invalidTokens,
  };
}

function extractDosenUploadValues(row = {}) {
  return {
    nik: row["NIK"] || row["Nik"] || row["nik"] || row["Nip"],
    nama: row["Nama"] || row["nama"] || row["NAMA"],
    gelar: row["Gelar"] || row["gelar"] || row["GELAR"],
    email: row["Email"] || row["email"] || row["EMAIL"],
    rawJabatanStruktural:
      row["Jabatan Struktural"] ||
      row["jabatan_struktural"] ||
      row["jabatan struktural"] ||
      row["JABATAN_STRUKTURAL"] ||
      row["Jabatan"] ||
      row["jabatan"] ||
      row["JABATAN"],
    klasterRaw:
      row["Klaster"] ||
      row["klaster"] ||
      row["KLASTER"] ||
      row["Cluster"] ||
      row["cluster"] ||
      row["CLUSTER"],
    rawKuotaBimbingan: row["Kuota Bimbingan"] ?? row["kuota_bimbingan"] ?? row["KUOTA_BIMBINGAN"],
  };
}

function isBlankUploadValue(value) {
  return value === undefined || value === null || String(value).trim() === "";
}

function isEmptyDosenUploadRow(values) {
  return [
    values.nik,
    values.nama,
    values.gelar,
    values.email,
    values.rawJabatanStruktural,
    values.klasterRaw,
    values.rawKuotaBimbingan,
  ].every(isBlankUploadValue);
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

// ========== TOPIK UPLOAD ==========

// POST /api/admin/upload/topics - Upload Excel Topik
exports.uploadTopics = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    let actorDosen = null;
    if (req.user?.role === "dosen") {
      actorDosen = await Dosen.findByPk(req.user.id, {
        attributes: ["id", "nik", "kode_dosen", "email", "nama"],
        transaction: t,
      });
    } else if (req.user?.role === "sekretaris_prodi") {
      const username = String(req.user?.username || "").trim();
      const where = [];
      if (username) {
        where.push({ nik: username });
        where.push({ email: username.toLowerCase() });
        where.push({ kode_dosen: username.toUpperCase() });
      }
      if (where.length > 0) {
        actorDosen = await Dosen.findOne({
          where: { [Op.or]: where },
          attributes: ["id", "nik", "kode_dosen", "email", "nama", "jabatan_struktural"],
          transaction: t,
        });
      }

      if (!actorDosen) {
        const sekretaris = await SekretarisProdi.findByPk(req.user.id, {
          attributes: ["nik", "email", "jabatan"],
          transaction: t,
        });

        if (sekretaris) {
          const fallbackWhere = [];
          if (sekretaris.nik) fallbackWhere.push({ nik: String(sekretaris.nik).trim() });
          if (sekretaris.email) fallbackWhere.push({ email: String(sekretaris.email).trim().toLowerCase() });

          if (fallbackWhere.length > 0) {
            actorDosen = await Dosen.findOne({
              where: { [Op.or]: fallbackWhere },
              attributes: ["id", "nik", "kode_dosen", "email", "nama", "jabatan_struktural"],
              transaction: t,
            });
          }

          if (!actorDosen && sekretaris.jabatan) {
            actorDosen = await Dosen.findOne({
              where: { jabatan_struktural: sekretaris.jabatan },
              attributes: ["id", "nik", "kode_dosen", "email", "nama", "jabatan_struktural"],
              transaction: t,
            });
          }
        }
      }
    }

    if ((req.user?.role === "dosen" || req.user?.role === "sekretaris_prodi") && !actorDosen) {
      await t.rollback();
      return res.status(403).json({
        success: false,
        message: "Akun ini tidak terhubung ke data dosen sehingga tidak bisa upload topik.",
      });
    }

    // Cek apakah file di-upload
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "File Excel harus di-upload",
      });
    }

    const filePath = req.file.path;

    // Baca file Excel
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const headers = getSheetHeaders(sheet);
    const templateValidation = validateTemplateHeaders(headers, "topik");
    if (!templateValidation.isValid) {
      fs.unlinkSync(filePath);
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "File yang diupload bukan template topik yang valid.",
        detail: {
          missing_columns: templateValidation.missingLabels,
          expected_columns: templateValidation.expectedLabels,
        },
      });
    }
    const data = XLSX.utils.sheet_to_json(sheet);

    console.log(`Memproses ${data.length} baris data dari Excel...`);

    // Validasi data kosong
    if (data.length === 0) {
      fs.unlinkSync(filePath);
      return res.status(400).json({
        success: false,
        message: "File Excel kosong atau format tidak sesuai",
      });
    }

    const results = {
      success: [],
      failed: [],
      total: data.length,
    };
    const allowedClusterCache = new Map();

    // Proses setiap baris
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNumber = i + 2; // +2 karena row 1 adalah header

      try {
        // Ekstrak data
        const kode = row["Kode Topik"] || row["kode"] || row["KODE"];
        const judul = row["Judul"] || row["judul"] || row["JUDUL"];
        const deskripsi = row["Deskripsi"] || row["deskripsi"] || row["DESKRIPSI"];
        const keyword = row["Keyword"] || row["keyword"] || row["KEYWORD"] || row["Kata Kunci"] || row["kata_kunci"];
        const cluster = row["Cluster"] || row["cluster"] || row["CLUSTER"];
        const dosenIdentifier = actorDosen
          ? actorDosen.nik || actorDosen.kode_dosen || actorDosen.email
          : row["NIK Dosen"] ||
            row["nik"] ||
            row["NIK"] ||
            row["Kode Dosen"] ||
            row["kode_dosen"] ||
            row["Email Dosen"] ||
            row["email_dosen"];

        // Validasi field wajib
        if (!kode || !judul || !keyword || !cluster || !dosenIdentifier) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: "Field wajib tidak lengkap (Kode Topik, Judul, Keyword, Cluster, dan identifier dosen harus diisi)",
          });
          continue;
        }

        const normalizedKode = String(kode || "").trim().toUpperCase();
        const normalizedJudul = String(judul || "").trim();
        const normalizedKeyword = String(keyword || "").trim();
        const normalizedCluster = normalizeTopikClusterLabel(cluster);

        if (!normalizedCluster) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: "Cluster tidak valid. Harus salah satu dari: Sirkel, Siber, ITSC, MVK.",
          });
          continue;
        }

        const kodeCluster = resolveTopikClusterFromKode(normalizedKode);
        if (!kodeCluster || !kodeCluster.label) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: "Format kode topik tidak valid. Gunakan prefix cluster: SIRKEL, SIBER, ITSC, atau MVK.",
          });
          continue;
        }
        if (kodeCluster.label !== normalizedCluster) {
          const expectedPrefix =
            TOPIK_CLUSTER_CODE_BY_LABEL[normalizeTopikClusterCode(normalizedCluster)] || normalizedCluster;
          results.failed.push({
            row: rowNumber,
            data: row,
            error: `Kode topik ${normalizedKode} tidak sesuai dengan cluster ${normalizedCluster}. Prefix kode harus ${expectedPrefix}.`,
          });
          continue;
        }

        const normalizedDosenIdentifier = String(dosenIdentifier || "").trim();
        let dosen = actorDosen;
        if (!dosen) {
          // Cari dosen berdasarkan identifier (NIK/kode_dosen/email)
          dosen = await Dosen.findOne({
            where: {
              [Op.or]: [
                { nik: normalizedDosenIdentifier },
                { kode_dosen: normalizedDosenIdentifier.toUpperCase() },
                { email: normalizedDosenIdentifier.toLowerCase() },
              ],
            },
            transaction: t,
          });
        }

        if (!dosen) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: `Dosen dengan identifier "${normalizedDosenIdentifier}" tidak ditemukan di database`,
          });
          continue;
        }

        const allowedClusters = await getAllowedTopikClustersForDosen(dosen.id, t, allowedClusterCache);
        if (allowedClusters.length > 0 && !allowedClusters.includes(normalizedCluster)) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: `Cluster ${normalizedCluster} tidak terdaftar untuk dosen ${dosen.nama}. Cluster yang diizinkan: ${allowedClusters.join(", ")}.`,
          });
          continue;
        }

        // Cek apakah kode topik sudah ada
        const existingTopik = await Topik.findOne({
          where: { kode: normalizedKode },
          transaction: t,
        });

        if (existingTopik) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: `Kode topik ${normalizedKode} sudah ada di database`,
          });
          continue;
        }

        // Insert topik ke database
        const newTopik = await Topik.create(
          {
            kode: normalizedKode,
            judul: normalizedJudul,
            deskripsi: deskripsi ? deskripsi.trim() : null,
            keyword: normalizedKeyword,
            cluster: normalizedCluster,
            dosen_id: dosen.id,
            status: "available",
          },
          { transaction: t }
        );

        results.success.push({
          row: rowNumber,
          kode: newTopik.kode,
          judul: newTopik.judul,
          keyword: newTopik.keyword,
          cluster: newTopik.cluster,
          dosen: dosen.nama,
        });
      } catch (error) {
        results.failed.push({
          row: rowNumber,
          data: row,
          error: error.message,
        });
      }
    }

    // Commit transaction jika ada yang berhasil
    if (results.success.length > 0) {
      await t.commit();
    } else {
      await t.rollback();
    }

    // Hapus file setelah diproses
    fs.unlinkSync(filePath);

    // Response
    const statusCode = results.success.length > 0 ? 201 : 400;

    res.status(statusCode).json({
      success: results.success.length > 0,
      message: `Upload selesai. Berhasil: ${results.success.length}, Gagal: ${results.failed.length}`,
      data: {
        total: results.total,
        berhasil: results.success.length,
        gagal: results.failed.length,
        detail_berhasil: results.success,
        detail_gagal: results.failed,
      },
    });
  } catch (error) {
    if (!t.finished) {
      await t.rollback();
    }

    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    console.error("Error di uploadTopics:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// POST /api/admin/upload/topics/preview - Preview Excel topik tanpa menyimpan ke DB
exports.previewUploadTopics = async (req, res) => {
  try {
    const actorDosen = await resolveActorDosenForTopikUpload(req);
    if ((req.user?.role === "dosen" || req.user?.role === "sekretaris_prodi") && !actorDosen) {
      return res.status(403).json({
        success: false,
        message: "Akun ini tidak terhubung ke data dosen sehingga tidak bisa upload topik.",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "File Excel harus di-upload",
      });
    }

    const filePath = req.file.path;
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const headers = getSheetHeaders(sheet);
    const templateValidation = validateTemplateHeaders(headers, "topik");
    if (!templateValidation.isValid) {
      fs.unlinkSync(filePath);
      return res.status(400).json({
        success: false,
        message: "File yang diupload bukan template topik yang valid.",
        detail: {
          missing_columns: templateValidation.missingLabels,
          expected_columns: templateValidation.expectedLabels,
        },
      });
    }

    const data = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    fs.unlinkSync(filePath);

    if (data.length === 0) {
      return res.status(400).json({
        success: false,
        message: "File Excel kosong atau format tidak sesuai",
      });
    }

    const validRows = [];
    const failedRows = [];
    const allowedClusterCache = new Map();
    const kodeInFileSet = new Set();

    for (let index = 0; index < data.length; index++) {
      const row = data[index];
      const rowNumber = index + 2;
      try {
        const rowValues = extractTopikUploadValues(row);
        const kode = rowValues.kode;
        const judul = rowValues.judul;
        const keyword = rowValues.keyword;
        const cluster = rowValues.cluster;
        const dosenIdentifier = actorDosen
          ? actorDosen.nik || actorDosen.kode_dosen || actorDosen.email
          : rowValues.dosenIdentifier;

        if (!kode || !judul || !keyword || !cluster || (!actorDosen && !dosenIdentifier)) {
          failedRows.push({
            row: rowNumber,
            data: row,
            error: actorDosen
              ? "Field wajib tidak lengkap (Kode Topik, Judul, Keyword, dan Cluster harus diisi)"
              : "Field wajib tidak lengkap (Kode Topik, Judul, Keyword, Cluster, dan identifier dosen harus diisi)",
          });
          continue;
        }

        const normalizedKode = String(kode || "").trim().toUpperCase();
        const normalizedJudul = String(judul || "").trim();
        const normalizedKeyword = String(keyword || "").trim();
        const normalizedCluster = normalizeTopikClusterLabel(cluster);
        const normalizedDeskripsi = rowValues.deskripsi ? String(rowValues.deskripsi).trim() : null;

        if (!normalizedCluster) {
          failedRows.push({
            row: rowNumber,
            data: row,
            error: "Cluster tidak valid. Harus salah satu dari: Sirkel, Siber, ITSC, MVK.",
          });
          continue;
        }

        const kodeCluster = resolveTopikClusterFromKode(normalizedKode);
        if (!kodeCluster || !kodeCluster.label) {
          failedRows.push({
            row: rowNumber,
            data: row,
            error: "Format kode topik tidak valid. Gunakan prefix cluster: SIRKEL, SIBER, ITSC, atau MVK.",
          });
          continue;
        }
        if (kodeCluster.label !== normalizedCluster) {
          const expectedPrefix =
            TOPIK_CLUSTER_CODE_BY_LABEL[normalizeTopikClusterCode(normalizedCluster)] || normalizedCluster;
          failedRows.push({
            row: rowNumber,
            data: row,
            error: `Kode topik ${normalizedKode} tidak sesuai dengan cluster ${normalizedCluster}. Prefix kode harus ${expectedPrefix}.`,
          });
          continue;
        }

        if (kodeInFileSet.has(normalizedKode)) {
          failedRows.push({
            row: rowNumber,
            data: row,
            error: `Kode topik ${normalizedKode} duplikat di file upload.`,
          });
          continue;
        }

        const normalizedIdentifier = String(dosenIdentifier || "").trim();
        let dosen = actorDosen;
        if (!dosen) {
          dosen = await Dosen.findOne({
            where: {
              [Op.or]: [
                { nik: normalizedIdentifier },
                { kode_dosen: normalizedIdentifier.toUpperCase() },
                { email: normalizedIdentifier.toLowerCase() },
              ],
            },
          });
        }
        if (!dosen) {
          failedRows.push({
            row: rowNumber,
            data: row,
            error: `Dosen dengan identifier "${normalizedIdentifier}" tidak ditemukan di database`,
          });
          continue;
        }

        const allowedClusters = await getAllowedTopikClustersForDosen(dosen.id, null, allowedClusterCache);
        if (allowedClusters.length > 0 && !allowedClusters.includes(normalizedCluster)) {
          failedRows.push({
            row: rowNumber,
            data: row,
            error: `Cluster ${normalizedCluster} tidak terdaftar untuk dosen ${dosen.nama}. Cluster yang diizinkan: ${allowedClusters.join(", ")}.`,
          });
          continue;
        }

        const existingTopik = await Topik.findOne({ where: { kode: normalizedKode }, attributes: ["id"] });
        if (existingTopik) {
          failedRows.push({
            row: rowNumber,
            data: row,
            error: `Kode topik ${normalizedKode} sudah ada di database`,
          });
          continue;
        }

        kodeInFileSet.add(normalizedKode);
        validRows.push({
          row: rowNumber,
          kode: normalizedKode,
          judul: normalizedJudul,
          deskripsi: normalizedDeskripsi,
          keyword: normalizedKeyword,
          cluster: normalizedCluster,
        });
      } catch (error) {
        failedRows.push({
          row: rowNumber,
          data: row,
          error: error.message,
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: `Preview selesai. Valid: ${validRows.length}, Tidak valid: ${failedRows.length}.`,
      data: {
        total: data.length,
        valid: validRows.length,
        invalid: failedRows.length,
        detail_valid: validRows,
        detail_invalid: failedRows,
        detail_berhasil: validRows,
        detail_gagal: failedRows,
      },
    });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error("Error di previewUploadTopics:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// POST /api/admin/upload/topics/commit - Simpan data preview topik ke database
exports.commitUploadTopics = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const actorDosen = await resolveActorDosenForTopikUpload(req, t);
    if ((req.user?.role === "dosen" || req.user?.role === "sekretaris_prodi") && !actorDosen) {
      await t.rollback();
      return res.status(403).json({
        success: false,
        message: "Akun ini tidak terhubung ke data dosen sehingga tidak bisa menyimpan topik.",
      });
    }

    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    if (rows.length === 0) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Tidak ada data valid untuk disimpan.",
      });
    }

    const results = {
      success: [],
      failed: [],
      total: rows.length,
    };
    const allowedClusterCache = new Map();
    const kodeInFileSet = new Set();

    for (let index = 0; index < rows.length; index++) {
      const payloadRow = rows[index];
      const rowNumber = Number(payloadRow?.row) || index + 1;
      try {
        const rowValues = extractTopikUploadValues(payloadRow);
        const kode = rowValues.kode;
        const judul = rowValues.judul;
        const keyword = rowValues.keyword;
        const cluster = rowValues.cluster;
        const dosenIdentifier = actorDosen
          ? actorDosen.nik || actorDosen.kode_dosen || actorDosen.email
          : rowValues.dosenIdentifier;

        if (!kode || !judul || !keyword || !cluster || (!actorDosen && !dosenIdentifier)) {
          results.failed.push({
            row: rowNumber,
            data: payloadRow,
            error: actorDosen
              ? "Field wajib tidak lengkap (Kode Topik, Judul, Keyword, dan Cluster harus diisi)"
              : "Field wajib tidak lengkap (Kode Topik, Judul, Keyword, Cluster, dan identifier dosen harus diisi)",
          });
          continue;
        }

        const normalizedKode = String(kode || "").trim().toUpperCase();
        const normalizedJudul = String(judul || "").trim();
        const normalizedKeyword = String(keyword || "").trim();
        const normalizedCluster = normalizeTopikClusterLabel(cluster);
        const normalizedDeskripsi = rowValues.deskripsi ? String(rowValues.deskripsi).trim() : null;

        if (!normalizedCluster) {
          results.failed.push({
            row: rowNumber,
            data: payloadRow,
            error: "Cluster tidak valid. Harus salah satu dari: Sirkel, Siber, ITSC, MVK.",
          });
          continue;
        }

        const kodeCluster = resolveTopikClusterFromKode(normalizedKode);
        if (!kodeCluster || !kodeCluster.label) {
          results.failed.push({
            row: rowNumber,
            data: payloadRow,
            error: "Format kode topik tidak valid. Gunakan prefix cluster: SIRKEL, SIBER, ITSC, atau MVK.",
          });
          continue;
        }
        if (kodeCluster.label !== normalizedCluster) {
          const expectedPrefix =
            TOPIK_CLUSTER_CODE_BY_LABEL[normalizeTopikClusterCode(normalizedCluster)] || normalizedCluster;
          results.failed.push({
            row: rowNumber,
            data: payloadRow,
            error: `Kode topik ${normalizedKode} tidak sesuai dengan cluster ${normalizedCluster}. Prefix kode harus ${expectedPrefix}.`,
          });
          continue;
        }

        if (kodeInFileSet.has(normalizedKode)) {
          results.failed.push({
            row: rowNumber,
            data: payloadRow,
            error: `Kode topik ${normalizedKode} duplikat di request simpan.`,
          });
          continue;
        }

        const normalizedIdentifier = String(dosenIdentifier || "").trim();
        let dosen = actorDosen;
        if (!dosen) {
          dosen = await Dosen.findOne({
            where: {
              [Op.or]: [
                { nik: normalizedIdentifier },
                { kode_dosen: normalizedIdentifier.toUpperCase() },
                { email: normalizedIdentifier.toLowerCase() },
              ],
            },
            transaction: t,
          });
        }
        if (!dosen) {
          results.failed.push({
            row: rowNumber,
            data: payloadRow,
            error: `Dosen dengan identifier "${normalizedIdentifier}" tidak ditemukan di database`,
          });
          continue;
        }

        const allowedClusters = await getAllowedTopikClustersForDosen(dosen.id, t, allowedClusterCache);
        if (allowedClusters.length > 0 && !allowedClusters.includes(normalizedCluster)) {
          results.failed.push({
            row: rowNumber,
            data: payloadRow,
            error: `Cluster ${normalizedCluster} tidak terdaftar untuk dosen ${dosen.nama}. Cluster yang diizinkan: ${allowedClusters.join(", ")}.`,
          });
          continue;
        }

        const existingTopik = await Topik.findOne({
          where: { kode: normalizedKode },
          attributes: ["id"],
          transaction: t,
        });
        if (existingTopik) {
          results.failed.push({
            row: rowNumber,
            data: payloadRow,
            error: `Kode topik ${normalizedKode} sudah ada di database`,
          });
          continue;
        }

        const topik = await Topik.create(
          {
            kode: normalizedKode,
            judul: normalizedJudul,
            deskripsi: normalizedDeskripsi,
            keyword: normalizedKeyword,
            cluster: normalizedCluster,
            dosen_id: dosen.id,
            status: "available",
          },
          { transaction: t }
        );

        kodeInFileSet.add(normalizedKode);
        results.success.push({
          row: rowNumber,
          kode: topik.kode,
          judul: topik.judul,
          keyword: topik.keyword,
          cluster: topik.cluster,
          dosen: dosen.nama,
        });
      } catch (error) {
        results.failed.push({
          row: rowNumber,
          data: payloadRow,
          error: error.message,
        });
      }
    }

    if (results.success.length > 0) {
      await t.commit();
    } else {
      await t.rollback();
    }

    return res.status(200).json({
      success: results.success.length > 0,
      message: `Simpan topik selesai. Berhasil: ${results.success.length}, Gagal: ${results.failed.length}`,
      data: {
        total: results.total,
        berhasil: results.success.length,
        gagal: results.failed.length,
        detail_berhasil: results.success,
        detail_gagal: results.failed,
      },
    });
  } catch (error) {
    if (!t.finished) {
      await t.rollback();
    }
    console.error("Error di commitUploadTopics:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// GET /api/upload/template - Download template Excel Topik
exports.downloadTemplate = (req, res) => {
  try {
    const templateData = [
      {
        "Kode Topik": "SIRKEL03",
        Judul: "Contoh Judul Topik Penelitian",
        Deskripsi: "Deskripsi singkat tentang topik penelitian ini",
        Keyword: "sistem informasi, rekomendasi, skripsi",
        Cluster: "Sirkel",
      },
      {
        "Kode Topik": "SIBER03",
        Judul: "Implementasi Blockchain untuk Keamanan Data",
        Deskripsi: "Penelitian implementasi blockchain dalam sistem keamanan data",
        Keyword: "blockchain, keamanan data, kriptografi",
        Cluster: "Siber",
      },
      {
        "Kode Topik": "ITSC05",
        Judul: "Sistem Informasi Manajemen Perpustakaan",
        Deskripsi: "Pengembangan sistem informasi untuk manajemen perpustakaan digital",
        Keyword: "sistem informasi, perpustakaan digital, manajemen",
        Cluster: "ITSC",
      },
      {
        "Kode Topik": "MVK02",
        Judul: "Analisis Sentimen Media Sosial Menggunakan Deep Learning",
        Deskripsi: "Penelitian analisis sentimen pada data Twitter menggunakan LSTM",
        Keyword: "analisis sentimen, deep learning, media sosial",
        Cluster: "MVK",
      },
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(templateData);

    // Set lebar kolom (TANPA kolom Kuota)
    ws["!cols"] = [
      { wch: 15 }, // Kode Topik
      { wch: 50 }, // Judul
      { wch: 60 }, // Deskripsi
      { wch: 45 }, // Keyword
      { wch: 10 }, // Cluster
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Template Topik");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Disposition", "attachment; filename=template_topik.xlsx");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    res.send(buffer);
  } catch (error) {
    console.error("Error di downloadTemplate:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// ========== MAHASISWA UPLOAD ==========

// POST /api/admin/upload/mahasiswa - Upload Excel Mahasiswa
exports.uploadMahasiswa = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "File Excel harus di-upload",
      });
    }

    const filePath = req.file.path;

    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const headers = getSheetHeaders(sheet);
    const templateValidation = validateTemplateHeaders(headers, "mahasiswa");
    if (!templateValidation.isValid) {
      fs.unlinkSync(filePath);
      return res.status(400).json({
        success: false,
        message: "File yang diupload bukan template mahasiswa yang valid.",
        detail: {
          missing_columns: templateValidation.missingLabels,
          expected_columns: templateValidation.expectedLabels,
        },
      });
    }

    const data = XLSX.utils.sheet_to_json(sheet);

    console.log(`📄 Memproses ${data.length} baris data mahasiswa dari Excel...`);

    if (data.length === 0) {
      fs.unlinkSync(filePath);
      return res.status(400).json({
        success: false,
        message: "File Excel kosong atau format tidak sesuai",
      });
    }

    const results = {
      success: [],
      failed: [],
      total: data.length,
    };

    const DEFAULT_PASSWORD = "12345678";
    const seenNimInFile = new Set();
    const seenNamaInFile = new Set();
    const seenEmailInFile = new Set();

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNumber = i + 2;

      try {
        const nim = row["NIM"] || row["nim"];
        const nama = row["Nama"] || row["nama"] || row["NAMA"];
        const email = row["Email"] || row["email"] || row["EMAIL"];
        const angkatan = row["Angkatan"] || row["angkatan"] || row["ANGKATAN"];
        const dpaIdentifierRaw =
          row["NIK DPA"] ||
          row["nik_dpa"] ||
          row["NIK_DPA"] ||
          row["nip_dpa"] ||
          row["NIP_DPA"] ||
          row["Kode Dosen DPA"] ||
          row["kode_dosen_dpa"] ||
          row["Email DPA"] ||
          row["email_dpa"];

        if (!nim || !nama || !email || !angkatan || !dpaIdentifierRaw) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: "Field wajib tidak lengkap (NIM, Nama, Email, Angkatan, dan identifier DPA harus diisi)",
          });
          continue;
        }

        const nameValidation = validateHumanName(nama, "Nama mahasiswa");
        if (!nameValidation.isValid) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: nameValidation.message,
          });
          continue;
        }

        const normalizedNim = nim.toString().trim();
        const normalizedNamaKey = normalizeNameKey(nameValidation.normalized);
        const normalizedEmail = email.toString().trim().toLowerCase();

        if (!/^\d{8}$/.test(normalizedNim)) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: "Format NIM tidak valid. NIM harus 8 digit angka",
          });
          continue;
        }

        if (seenNimInFile.has(normalizedNim)) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: `NIM ${normalizedNim} duplikat di file upload`,
          });
          continue;
        }

        if (seenNamaInFile.has(normalizedNamaKey)) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: `Nama mahasiswa "${nameValidation.normalized}" duplikat di file upload`,
          });
          continue;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(normalizedEmail)) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: "Format email tidak valid",
          });
          continue;
        }

        if (seenEmailInFile.has(normalizedEmail)) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: `Email ${normalizedEmail} duplikat di file upload`,
          });
          continue;
        }

        if (!/^\d{4}$/.test(angkatan.toString())) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: "Format angkatan tidak valid. Harus 4 digit tahun (contoh: 2022)",
          });
          continue;
        }

        const existingMahasiswaNIM = await Mahasiswa.findOne({
          where: { nim: normalizedNim },
          transaction: t,
        });

        if (existingMahasiswaNIM) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: `NIM ${nim} sudah terdaftar di database`,
          });
          continue;
        }

        const existingMahasiswaEmail = await Mahasiswa.findOne({
          where: { email: normalizedEmail },
          transaction: t,
        });

        if (existingMahasiswaEmail) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: `Email ${email} sudah terdaftar di database`,
          });
          continue;
        }

        const dpaIdentifier = dpaIdentifierRaw.toString().trim();
        const dpa = await Dosen.findOne({
          where: {
            [Op.or]: [
              { nik: dpaIdentifier },
              { kode_dosen: dpaIdentifier.toUpperCase() },
              { email: dpaIdentifier.toLowerCase() },
            ],
          },
          transaction: t,
        });

        if (!dpa) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: `Dosen pembimbing akademik dengan identifier "${dpaIdentifier}" tidak ada di daftar dosen`,
          });
          continue;
        }

        const existingMahasiswaNama = await Mahasiswa.findOne({
          where: sequelize.where(sequelize.fn("LOWER", sequelize.fn("TRIM", sequelize.col("nama"))), normalizedNamaKey),
          transaction: t,
        });

        if (existingMahasiswaNama) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: `Nama mahasiswa "${nameValidation.normalized}" sudah terdaftar di database`,
          });
          continue;
        }

        const newMahasiswa = await Mahasiswa.create(
          {
            nim: normalizedNim,
            nama: nameValidation.normalized,
            email: normalizedEmail,
            // Password akan di-hash oleh hook model (beforeCreate)
            password: DEFAULT_PASSWORD,
            is_default_password: true,
            angkatan: angkatan.toString().trim(),
            dosen_pembimbing_akademik_id: dpa.id,
            status_jalur_saat_ini: "belum_mengajukan",
          },
          { transaction: t }
        );

        results.success.push({
          row: rowNumber,
          nim: newMahasiswa.nim,
          nama: newMahasiswa.nama,
          email: newMahasiswa.email,
          angkatan: newMahasiswa.angkatan,
          dpa: dpa.nama,
        });

        seenNimInFile.add(normalizedNim);
        seenNamaInFile.add(normalizedNamaKey);
        seenEmailInFile.add(normalizedEmail);
      } catch (error) {
        let uploadErrorMessage = error.message;
        if (
          error?.name === "SequelizeUniqueConstraintError" &&
          JSON.stringify(error?.errors || []).includes("uq_dosen_jabatan_struktural_single_holder")
        ) {
          uploadErrorMessage = "Jabatan struktural sudah digunakan oleh dosen lain.";
        }
        results.failed.push({
          row: rowNumber,
          data: row,
          error: uploadErrorMessage,
        });
      }
    }

    if (results.success.length > 0) {
      await t.commit();
    } else {
      await t.rollback();
    }

    fs.unlinkSync(filePath);

    const statusCode = results.success.length > 0 ? 201 : 400;

    res.status(statusCode).json({
      success: results.success.length > 0,
      message: `Upload selesai. Berhasil: ${results.success.length}, Gagal: ${results.failed.length}`,
      data: {
        total: results.total,
        berhasil: results.success.length,
        gagal: results.failed.length,
        password_default: DEFAULT_PASSWORD,
        detail_berhasil: results.success,
        detail_gagal: results.failed,
      },
    });
  } catch (error) {
    if (!t.finished) {
      await t.rollback();
    }

    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    console.error("Error di uploadMahasiswa:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// GET /api/upload/mahasiswa-template - Download template Excel Mahasiswa
exports.downloadMahasiswaTemplate = (req, res) => {
  try {
    const templateData = [
      {
        NIM: "22523001",
        Nama: "John Doe",
        Email: "john.doe@student.university.ac.id",
        Angkatan: "2022",
        "NIK DPA": "900000003",
      },
      {
        NIM: "22523002",
        Nama: "Jane Smith",
        Email: "jane.smith@student.university.ac.id",
        Angkatan: "2022",
        "NIK DPA": "900000003",
      },
      {
        NIM: "23523001",
        Nama: "Alice Johnson",
        Email: "alice.johnson@student.university.ac.id",
        Angkatan: "2023",
        "NIK DPA": "900000002",
      },
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(templateData);

    ws["!cols"] = [{ wch: 12 }, { wch: 25 }, { wch: 40 }, { wch: 10 }, { wch: 20 }];

    XLSX.utils.book_append_sheet(wb, ws, "Template Mahasiswa");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Disposition", "attachment; filename=template_mahasiswa.xlsx");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    res.send(buffer);
  } catch (error) {
    console.error("Error di downloadMahasiswaTemplate:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// ========== DOSEN UPLOAD ==========

// POST /api/upload/dosen - Upload Excel Dosen
exports.uploadDosen = async (req, res) => {
  let t = null;

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "File Excel harus di-upload",
      });
    }

    const filePath = req.file.path;

    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const headers = getSheetHeaders(sheet);
    const templateValidation = validateTemplateHeaders(headers, "dosen");
    if (!templateValidation.isValid) {
      fs.unlinkSync(filePath);
      return res.status(400).json({
        success: false,
        message: "File yang diupload bukan template dosen yang valid.",
        detail: {
          missing_columns: templateValidation.missingLabels,
          expected_columns: templateValidation.expectedLabels,
        },
      });
    }

    const data = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    const uploadRows = data
      .map((row, index) => ({
        row,
        rowNumber: index + 2,
        values: extractDosenUploadValues(row),
      }))
      .filter((item) => !isEmptyDosenUploadRow(item.values));

    console.log(`📄 Memproses ${uploadRows.length} baris data dosen dari Excel...`);

    if (uploadRows.length === 0) {
      fs.unlinkSync(filePath);
      return res.status(400).json({
        success: false,
        message: "File Excel kosong atau belum memiliki baris data dosen.",
      });
    }

    t = await sequelize.transaction();

    const results = {
      success: [],
      failed: [],
      total: uploadRows.length,
    };

    const DEFAULT_PASSWORD_DOSEN = process.env.DEFAULT_PASSWORD_DOSEN || "12345678"; // Password default untuk dosen
    let nextKodeSequence = await getNextDosenSequence(t);
    const seenNikInFile = new Set();
    const seenNamaInFile = new Set();
    const seenEmailInFile = new Set();
    const seenJabatanInFile = new Set();
    const allKlasters = await Klaster.findAll({
      attributes: ["id", "kode", "nama"],
      transaction: t,
    });
    const klasterMap = new Map();
    for (const klaster of allKlasters) {
      const kode = String(klaster.kode || "").toUpperCase().replace(/\s+/g, "");
      const nama = String(klaster.nama || "").toLowerCase().replace(/\s+/g, " ").trim();
      if (kode) klasterMap.set(kode, klaster);
      if (nama) klasterMap.set(nama, klaster);
    }
    Object.entries(KLASTER_INPUT_ALIAS).forEach(([alias, kode]) => {
      const found = klasterMap.get(kode);
      if (found) {
        klasterMap.set(alias, found);
      }
    });

    for (const uploadRow of uploadRows) {
      const { row, rowNumber, values } = uploadRow;

      try {
        const { nik, nama, gelar, email, rawJabatanStruktural, klasterRaw, rawKuotaBimbingan } = values;
        const jabatanStruktural = normalizeJabatanStrukturalInput(rawJabatanStruktural);
        const kuotaBimbingan =
          rawKuotaBimbingan === undefined ||
          rawKuotaBimbingan === null ||
          String(rawKuotaBimbingan).trim() === ""
            ? 5
            : rawKuotaBimbingan;

        // Validasi field wajib
        if (!nama || !email) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: "Field wajib tidak lengkap (Nama dan Email harus diisi)",
          });
          continue;
        }

        const nameValidation = validateHumanName(nama, "Nama dosen");
        if (!nameValidation.isValid) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: nameValidation.message,
          });
          continue;
        }

        const normalizedNik = nik ? nik.toString().trim() : null;
        const normalizedNamaKey = normalizeNameKey(nameValidation.normalized);
        const normalizedEmail = email.toString().trim().toLowerCase();

        if (normalizedNik) {
          // Validasi format NIK (maksimal 9 digit angka)
          if (!/^\d{1,9}$/.test(normalizedNik)) {
            results.failed.push({
              row: rowNumber,
              data: row,
              error: "Format NIK tidak valid. NIK harus angka dengan panjang maksimal 9 digit",
            });
            continue;
          }
        }

        if (normalizedNik) {
          if (seenNikInFile.has(normalizedNik)) {
            results.failed.push({
              row: rowNumber,
              data: row,
              error: `NIK ${normalizedNik} duplikat di file upload`,
            });
            continue;
          }
        }

        if (seenNamaInFile.has(normalizedNamaKey)) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: `Nama dosen "${nameValidation.normalized}" duplikat di file upload`,
          });
          continue;
        }

        // Validasi format email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(normalizedEmail)) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: "Format email tidak valid",
          });
          continue;
        }

        if (seenEmailInFile.has(normalizedEmail)) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: `Email ${normalizedEmail} duplikat di file upload`,
          });
          continue;
        }

        if (jabatanStruktural && !isValidJabatanStruktural(jabatanStruktural)) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: `Jabatan struktural '${jabatanStruktural}' tidak valid. Pilihan resmi: ${STRUKTURAL_POSITIONS.join(" | ")}`,
          });
          continue;
        }

        if (jabatanStruktural && seenJabatanInFile.has(jabatanStruktural)) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: `Jabatan struktural '${jabatanStruktural}' duplikat di file upload.`,
          });
          continue;
        }

        // Validasi kuota bimbingan (kosong akan memakai default 5, selain itu harus bilangan bulat positif).
        const kuota = Number(kuotaBimbingan);
        if (!Number.isInteger(kuota) || kuota < 1) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: "Kuota bimbingan harus berupa angka bulat minimal 1",
          });
          continue;
        }

        if (normalizedNik) {
          // Cek apakah NIK sudah ada
          const existingDosenNik = await Dosen.findOne({
            where: { nik: normalizedNik },
            transaction: t,
          });

          if (existingDosenNik) {
            results.failed.push({
              row: rowNumber,
              data: row,
              error: `NIK ${nik} sudah terdaftar di database`,
            });
            continue;
          }
        }

        const existingDosenNama = await Dosen.findOne({
          where: sequelize.where(sequelize.fn("LOWER", sequelize.fn("TRIM", sequelize.col("nama"))), normalizedNamaKey),
          transaction: t,
        });

        if (existingDosenNama) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: `Nama dosen "${nameValidation.normalized}" sudah terdaftar di database`,
          });
          continue;
        }

        const parsedKlaster = parseKlasterListInput(klasterRaw, klasterMap);
        if (parsedKlaster.invalidTokens.length > 0) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: `Klaster tidak valid: ${parsedKlaster.invalidTokens.join(", ")}`,
          });
          continue;
        }

        // Cek apakah email sudah ada
        const existingDosenEmail = await Dosen.findOne({
          where: { email: normalizedEmail },
          transaction: t,
        });

        if (existingDosenEmail) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: `Email ${email} sudah terdaftar di database`,
          });
          continue;
        }

        if (jabatanStruktural) {
          const existingDosenJabatan = await Dosen.findOne({
            where: { jabatan_struktural: jabatanStruktural },
            transaction: t,
          });

          if (existingDosenJabatan) {
            results.failed.push({
              row: rowNumber,
              data: row,
              error: `Jabatan struktural '${jabatanStruktural}' sudah diisi oleh dosen ${existingDosenJabatan.nama}.`,
            });
            continue;
          }
        }

        const generatedKodeDosen = `DSN${String(nextKodeSequence).padStart(4, "0")}`;
        const generatedNik = String(nextKodeSequence).padStart(9, "0");
        nextKodeSequence += 1;

        // Insert dosen ke database
        const newDosen = await Dosen.create(
          {
            kode_dosen: generatedKodeDosen,
            nik: normalizedNik || generatedNik,
            nama: nameValidation.normalized,
            gelar: gelar ? String(gelar).trim() || null : null,
            email: normalizedEmail,
            // Password akan di-hash oleh hook model (beforeCreate)
            password: DEFAULT_PASSWORD_DOSEN,
            is_default_password: true,
            jabatan_struktural: jabatanStruktural,
            kuota_bimbingan: kuota,
          },
          { transaction: t }
        );

        if (parsedKlaster.klasterIds.length > 0) {
          const selectedKlasters = allKlasters.filter((item) => parsedKlaster.klasterIds.includes(item.id));
          await newDosen.setKlasters(selectedKlasters, { transaction: t });
        }

        results.success.push({
          row: rowNumber,
          kode_dosen: newDosen.kode_dosen,
          nik: newDosen.nik,
          nama: newDosen.nama,
          gelar: newDosen.gelar,
          email: newDosen.email,
          jabatan_struktural: newDosen.jabatan_struktural,
          klaster: parsedKlaster.klasterIds.length > 0
            ? allKlasters
                .filter((item) => parsedKlaster.klasterIds.includes(item.id))
                .map((item) => item.kode)
                .join(", ")
            : null,
          kuota_bimbingan: newDosen.kuota_bimbingan,
        });

        if (normalizedNik) {
          seenNikInFile.add(normalizedNik);
        }
        seenNamaInFile.add(normalizedNamaKey);
        seenEmailInFile.add(normalizedEmail);
        if (jabatanStruktural) {
          seenJabatanInFile.add(jabatanStruktural);
        }
      } catch (error) {
        results.failed.push({
          row: rowNumber,
          data: row,
          error: error.message,
        });
      }
    }

    if (results.success.length > 0) {
      await t.commit();
    } else {
      await t.rollback();
    }

    fs.unlinkSync(filePath);

    const statusCode = results.success.length > 0 ? 201 : 400;

    res.status(statusCode).json({
      success: results.success.length > 0,
      message: `Upload selesai. Berhasil: ${results.success.length}, Gagal: ${results.failed.length}`,
      data: {
        total: results.total,
        berhasil: results.success.length,
        gagal: results.failed.length,
        password_default: DEFAULT_PASSWORD_DOSEN,
        detail_berhasil: results.success,
        detail_gagal: results.failed,
      },
    });
  } catch (error) {
    if (t && !t.finished) {
      await t.rollback();
    }

    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    console.error("Error di uploadDosen:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// GET /api/upload/dosen-template - Download template Excel Dosen
exports.downloadDosenTemplate = (req, res) => {
  try {
    const templateHeaders = ["NIK", "Nama", "Gelar", "Email", "Jabatan Struktural", "Klaster", "Kuota Bimbingan"];
    const exampleRows = [
      {
        NIK: "900000001",
        Nama: "Dr. Ahmad Fauzi",
        Gelar: "S.T., M.Cs., Ph.D.",
        Email: "ahmad.fauzi@university.ac.id",
        "Jabatan Struktural": "Ketua Jurusan Informatika",
        Klaster: "ITSC, SIRKEL",
        "Kuota Bimbingan": 10,
      },
      {
        NIK: "900000002",
        Nama: "Dr. Budi Santoso",
        Gelar: "",
        Email: "budi.santoso@university.ac.id",
        "Jabatan Struktural": "",
        Klaster: "SIBER",
        "Kuota Bimbingan": 8,
      },
      {
        NIK: "900000003",
        Nama: "Dr. Citra Dewi",
        Gelar: "",
        Email: "citra.dewi@university.ac.id",
        "Jabatan Struktural": "",
        Klaster: "ITSC, MVK",
        "Kuota Bimbingan": 5,
      },
      {
        NIK: "900000004",
        Nama: "Prof. Dr. Dodi Prasetyo",
        Gelar: "",
        Email: "dodi.prasetyo@university.ac.id",
        "Jabatan Struktural": "Sekretaris Program Studi Informatika - Program Sarjana Reguler",
        Klaster: "ITSC",
        "Kuota Bimbingan": 12,
      },
    ];
    const referenceRows = [
      ...STRUKTURAL_POSITIONS.map((jabatan) => ({
        "Tipe Referensi": "Jabatan Struktural",
        "Nilai yang Diizinkan": jabatan,
        Keterangan: "Opsional. Kosongkan jika dosen tidak memegang jabatan struktural.",
      })),
      { "Tipe Referensi": "", "Nilai yang Diizinkan": "", Keterangan: "" },
      {
        "Tipe Referensi": "Klaster",
        "Nilai yang Diizinkan": "ITSC",
        Keterangan: "Termasuk input alias: Sains Data, SDATA, Informatika Medis, MEDIS.",
      },
      {
        "Tipe Referensi": "Klaster",
        "Nilai yang Diizinkan": "SIRKEL",
        Keterangan: "Termasuk Sistem Informasi dan Rekayasa Perangkat Lunak.",
      },
      { "Tipe Referensi": "Klaster", "Nilai yang Diizinkan": "SIBER", Keterangan: "Sistem Siber." },
      { "Tipe Referensi": "Klaster", "Nilai yang Diizinkan": "MVK", Keterangan: "Multimedia & Visi Komputer." },
      {
        "Tipe Referensi": "Kuota Bimbingan",
        "Nilai yang Diizinkan": "Bilangan bulat minimal 1",
        Keterangan: "Jika dikosongkan saat upload, sistem memakai default 5.",
      },
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([templateHeaders]);
    const exampleSheet = XLSX.utils.json_to_sheet(exampleRows);
    const referenceSheet = XLSX.utils.json_to_sheet(referenceRows);

    // Set lebar kolom
    ws["!cols"] = [
      { wch: 20 }, // NIK
      { wch: 30 }, // Nama
      { wch: 28 }, // Gelar
      { wch: 35 }, // Email
      { wch: 36 }, // Jabatan Struktural
      { wch: 28 }, // Klaster
      { wch: 18 }, // Kuota Bimbingan
    ];
    exampleSheet["!cols"] = ws["!cols"];

    XLSX.utils.book_append_sheet(wb, ws, "Template Dosen");
    XLSX.utils.book_append_sheet(wb, exampleSheet, "Contoh Pengisian");
    XLSX.utils.book_append_sheet(wb, referenceSheet, "Referensi");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Disposition", "attachment; filename=template_dosen.xlsx");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    res.send(buffer);
  } catch (error) {
    console.error("Error di downloadDosenTemplate:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

