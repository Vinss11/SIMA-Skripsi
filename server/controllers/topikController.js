const {
  Topik,
  Dosen,
  Mahasiswa,
  SekretarisProdi,
  DosenKlaster,
  Klaster,
  PeriodePenjaluran,
  DosenKetersediaanPeriode,
  BidangPenelitian,
  DosenBidangPenelitian,
  TopikBidangPenelitian,
  sequelize,
} = require("../models");
const { Op } = require("sequelize");
const {
  assertDosenCanReceiveNewAssignment,
  isDosenAcademicallyActive,
  validateDosenForNewAssignment,
} = require("../services/dosenStatusService");
const { createTopicWithGeneratedCode } = require("../services/topikCodeService");
const { getTopikTitleValidationError } = require("../services/topikTitleValidationService");

const TOPIC_RESEARCH_FIELD_INCLUDE = {
  model: BidangPenelitian,
  as: "bidangPenelitians",
  attributes: ["id", "nama", "deskripsi"],
  through: { attributes: [] },
  required: false,
};

function normalizeResearchFieldIds(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(Number).filter((id) => Number.isInteger(id) && id > 0))];
}

async function validateTopicResearchFieldsForDosen(dosenId, rawIds, transaction = null) {
  const ids = normalizeResearchFieldIds(rawIds);
  if (ids.length === 0) {
    return { ok: false, ids, message: "Pilih minimal satu bidang penelitian." };
  }
  if (ids.length > 10) {
    return { ok: false, ids, message: "Maksimal 10 bidang penelitian dapat dipilih." };
  }

  const assignments = await DosenBidangPenelitian.findAll({
    where: {
      dosen_id: Number(dosenId),
      bidang_penelitian_id: { [Op.in]: ids },
    },
    attributes: ["bidang_penelitian_id"],
    transaction: transaction || undefined,
  });
  const assignedIds = new Set(assignments.map((item) => Number(item.bidang_penelitian_id)));
  const invalidIds = ids.filter((id) => !assignedIds.has(id));
  if (invalidIds.length > 0) {
    return {
      ok: false,
      ids,
      message: "Bidang penelitian topik harus berasal dari bidang penelitian dosen yang ditetapkan admin.",
    };
  }
  return { ok: true, ids };
}

const CLUSTER_NORMALIZATION_MAP = {
  sirkel: "Sirkel",
  siber: "Siber",
  itsc: "ITSC",
  mvk: "MVK",
};

function normalizeClusterInput(value) {
  const key = String(value || "").trim().toLowerCase();
  return CLUSTER_NORMALIZATION_MAP[key] || null;
}

const CLUSTER_LABEL_BY_CODE = {
  SIRKEL: "Sirkel",
  SIBER: "Siber",
  ITSC: "ITSC",
  MVK: "MVK",
};

function normalizeClusterCode(value) {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw) return null;
  if (raw === "SIRKER") return "SIRKEL";
  if (raw.includes("SISTEM INFORMASI") || raw.includes("REKAYASA PERANGKAT LUNAK") || raw.includes("SIRKEL")) {
    return "SIRKEL";
  }
  if (raw.includes("SIBER")) return "SIBER";
  if (raw.includes("MULTIMEDIA") || raw.includes("VISI KOMPUTER") || raw.includes("MVK")) return "MVK";
  if (raw.includes("INFORMATIKA TEORI") || raw.includes("SISTEM CERDAS") || raw.includes("ITSC")) return "ITSC";
  if (raw.includes("MEDIS") || raw.includes("SAINS DATA") || raw.includes("SDATA")) return "ITSC";
  if (CLUSTER_LABEL_BY_CODE[raw]) return raw;
  return null;
}

function resolveClusterFromTopikKode(kode) {
  const normalizedKode = String(kode || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9]/g, "");
  if (!normalizedKode) return null;
  const prefix = normalizedKode.replace(/[0-9].*$/, "");
  const clusterCode = normalizeClusterCode(prefix);
  if (!clusterCode) return null;
  return {
    code: clusterCode,
    label: CLUSTER_LABEL_BY_CODE[clusterCode] || null,
  };
}

function buildClusterKodeMismatchMessage(kode, clusterLabel) {
  const selectedCode = normalizeClusterCode(clusterLabel);
  if (!selectedCode) {
    return "Cluster topik tidak valid.";
  }
  return `Kode topik ${kode} tidak sesuai dengan cluster ${clusterLabel}. Prefix kode harus ${selectedCode}.`;
}

async function getAllowedClusterLabelsForDosen(dosenId) {
  if (!Number.isInteger(Number(dosenId)) || Number(dosenId) <= 0) {
    return [];
  }

  const memberships = await DosenKlaster.findAll({
    where: { dosen_id: Number(dosenId) },
    include: [
      {
        model: Klaster,
        as: "klaster",
        attributes: ["kode", "nama"],
      },
    ],
    attributes: ["id"],
  });

  const labels = new Set();
  for (const row of memberships) {
    const fromCode = normalizeClusterCode(row?.klaster?.kode);
    if (fromCode && CLUSTER_LABEL_BY_CODE[fromCode]) {
      labels.add(CLUSTER_LABEL_BY_CODE[fromCode]);
      continue;
    }
    const fromName = normalizeClusterCode(row?.klaster?.nama);
    if (fromName && CLUSTER_LABEL_BY_CODE[fromName]) {
      labels.add(CLUSTER_LABEL_BY_CODE[fromName]);
    }
  }

  return [...labels];
}

async function resolveActorDosenId(req) {
  if (req.user?.role === "dosen") {
    return req.user.id;
  }

  if (req.user?.role === "sekretaris_prodi") {
    const sekretaris = await SekretarisProdi.findByPk(req.user.id, {
      attributes: ["nik", "email", "jabatan"],
    });
    if (!sekretaris) return null;

    const where = [];
    if (sekretaris.nik) where.push({ nik: String(sekretaris.nik).trim() });
    if (sekretaris.email) where.push({ email: String(sekretaris.email).trim().toLowerCase() });
    const username = String(req.user?.username || "").trim();
    if (username) {
      where.push({ nik: username });
      where.push({ email: username.toLowerCase() });
    }

    if (where.length === 0) return null;
    let dosen = await Dosen.findOne({
      where: { [Op.or]: where },
      attributes: ["id"],
    });

    if (!dosen && sekretaris.jabatan) {
      dosen = await Dosen.findOne({
        where: { jabatan_struktural: sekretaris.jabatan },
        attributes: ["id"],
      });
    }

    return dosen?.id || null;
  }

  return null;
}

// GET /api/topics/my-research-fields - Bidang penelitian dosen yang ditetapkan admin
exports.getMyResearchFields = async (req, res) => {
  try {
    const dosenId = await resolveActorDosenId(req);
    if (!dosenId) {
      return res.status(403).json({
        success: false,
        message: "Akun ini tidak terhubung ke data dosen.",
      });
    }

    const fields = await BidangPenelitian.findAll({
      include: [{
        model: Dosen,
        as: "dosens",
        attributes: [],
        through: { attributes: [] },
        where: { id: dosenId },
        required: true,
      }],
      attributes: ["id", "nama", "deskripsi"],
      order: [["nama", "ASC"]],
    });

    return res.json({
      success: true,
      data: fields,
      total: fields.length,
    });
  } catch (error) {
    console.error("Error di getMyResearchFields:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// GET /api/topics - Daftar topik dengan filter dan info kuota dosen
exports.getTopics = async (req, res) => {
  try {
    const { cluster, status, dosen_id, q, search } = req.query;

    // Build filter
    const where = {};
    if (cluster) {
      where.cluster = cluster;
    }
    if (status) {
      where.status = status;
    }
    if (dosen_id) {
      where.dosen_id = dosen_id;
    }

    const keyword = (q || search || "").trim();
    if (keyword) {
      where[Op.or] = [
        { kode: { [Op.iLike]: `%${keyword}%` } },
        { judul: { [Op.iLike]: `%${keyword}%` } },
        { "$bidangPenelitians.nama$": { [Op.iLike]: `%${keyword}%` } },
        { "$dosen.nama$": { [Op.iLike]: `%${keyword}%` } },
      ];
    }

    const activePeriode = await PeriodePenjaluran.findOne({ where: { status: "active", is_active: true }, order: [["updatedAt", "DESC"]] });
    const availabilityRows = activePeriode
      ? await DosenKetersediaanPeriode.findAll({ where: { periode_penjaluran_id: activePeriode.id } })
      : [];
    const availabilityByDosen = new Map(availabilityRows.map((item) => [Number(item.dosen_id), item]));

    const topics = await Topik.findAll({
      where,
      include: [
        {
          model: Dosen,
          as: "dosen",
          attributes: ["id", "nik", "nama", "gelar", "email", "jabatan_struktural", "kuota_bimbingan", "status_keaktifan"],
        },
        TOPIC_RESEARCH_FIELD_INCLUDE,
      ],
      order: [["createdAt", "DESC"]],
      subQuery: false,
    });

    // Tambahkan info kuota dosen ke setiap topik
    const topicsWithKuota = await Promise.all(
      topics.map(async (topic) => {
        const topicData = topic.toJSON();

        // Dapatkan info kuota dosen
        const kuotaInfo = await topic.dosen.getKuotaInfo();

        // Tentukan apakah topik available berdasarkan:
        // 1. Status topik itu sendiri (available/taken/unavailable)
        // 2. Kuota dosen masih tersedia
        const periodAvailability = availabilityByDosen.get(Number(topic.dosen_id));
        const isAvailable = topic.status === "available" && !kuotaInfo.is_penuh
          && isDosenAcademicallyActive(topic.dosen)
          && Boolean(activePeriode)
          && periodAvailability?.configuration_status === "ready"
          && periodAvailability?.tersedia_membimbing === true;

        return {
          ...topicData,
          kuota_dosen: kuotaInfo,
          is_available: isAvailable,
          ketersediaan_periode: periodAvailability || null,
        };
      })
    );

    res.json({
      success: true,
      data: topicsWithKuota,
      total: topicsWithKuota.length,
    });
  } catch (error) {
    console.error("Error di getTopics:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// GET /api/topics/:id - Detail topik dengan info kuota
exports.getTopicById = async (req, res) => {
  try {
    const { id } = req.params;

    const topic = await Topik.findByPk(id, {
      include: [
        {
          model: Dosen,
          as: "dosen",
          attributes: ["id", "nik", "nama", "gelar", "email", "jabatan_struktural", "kuota_bimbingan", "status_keaktifan"],
        },
        TOPIC_RESEARCH_FIELD_INCLUDE,
      ],
    });

    if (!topic) {
      return res.status(404).json({
        success: false,
        message: "Topik tidak ditemukan",
      });
    }

    const topicData = topic.toJSON();
    const kuotaInfo = await topic.dosen.getKuotaInfo();
    const activePeriode = await PeriodePenjaluran.findOne({
      where: { status: "active", is_active: true },
      attributes: ["id"],
      order: [["updatedAt", "DESC"]],
    });
    const availability = activePeriode
      ? await DosenKetersediaanPeriode.findOne({
          where: { dosen_id: topic.dosen_id, periode_penjaluran_id: activePeriode.id },
        })
      : null;
    const isAvailable = topic.status === "available"
      && !kuotaInfo.is_penuh
      && isDosenAcademicallyActive(topic.dosen)
      && Boolean(activePeriode)
      && availability?.configuration_status === "ready"
      && availability?.tersedia_membimbing === true;

    res.json({
      success: true,
      data: {
        ...topicData,
        kuota_dosen: kuotaInfo,
        is_available: isAvailable,
      },
    });
  } catch (error) {
    console.error("Error di getTopicById:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// POST /api/topics - Buat topik baru (Admin/Dosen/Sekretaris Prodi)
exports.createTopic = async (req, res) => {
  try {
    const { judul, deskripsi, cluster, dosen_id: dosenIdInput, bidang_penelitian_ids } = req.body;
    const normalizedJudul = String(judul || "").trim();
    const normalizedCluster = normalizeClusterInput(cluster);
    let dosen_id = null;

    // Validasi
    if (!normalizedJudul || !normalizedCluster) {
      return res.status(400).json({
        success: false,
        message: "Judul dan cluster harus diisi",
      });
    }

    const judulValidationError = getTopikTitleValidationError(normalizedJudul);
    if (judulValidationError) {
      return res.status(400).json({ success: false, message: judulValidationError });
    }

    if (req.user.role === "admin") {
      dosen_id = Number(dosenIdInput);
      if (!Number.isInteger(dosen_id) || dosen_id <= 0) {
        return res.status(400).json({
          success: false,
          message: "Admin wajib mengirim dosen_id yang valid saat membuat topik.",
        });
      }
    } else {
      dosen_id = await resolveActorDosenId(req);
      if (!dosen_id) {
        return res.status(403).json({
          success: false,
          message: "Akun ini tidak terhubung ke data dosen.",
        });
      }
    }

    const fieldValidation = await validateTopicResearchFieldsForDosen(
      dosen_id,
      bidang_penelitian_ids
    );
    if (!fieldValidation.ok) {
      return res.status(400).json({ success: false, message: fieldValidation.message });
    }

    const allowedClusterLabels = await getAllowedClusterLabelsForDosen(dosen_id);
    if (allowedClusterLabels.length > 0 && !allowedClusterLabels.includes(normalizedCluster)) {
      return res.status(403).json({
        success: false,
        message: `Anda hanya boleh membuat topik pada cluster: ${allowedClusterLabels.join(", ")}.`,
      });
    }

    // Cek kuota dosen
    const dosen = await Dosen.findByPk(dosen_id);
    if (!dosen) {
      return res.status(404).json({
        success: false,
        message: "Data dosen tidak ditemukan.",
      });
    }
    const kuotaInfo = await dosen.getKuotaInfo();
    const eligibility = assertDosenCanReceiveNewAssignment(dosen, "topik baru");
    if (!eligibility.allowed) {
      return res.status(409).json({ success: false, message: eligibility.message });
    }
    const activePeriode = await PeriodePenjaluran.findOne({ where: { status: "active", is_active: true }, order: [["updatedAt", "DESC"]] });
    if (activePeriode) {
      const periodEligibility = await validateDosenForNewAssignment(dosen.id, activePeriode.id, {
        availabilityField: "tersedia_membimbing",
        activityLabel: "menerima mahasiswa/topik baru",
        checkQuota: false,
      });
      if (!periodEligibility.allowed) {
        return res.status(409).json({ success: false, message: periodEligibility.message });
      }
    }

    const clusterCode = normalizeClusterCode(normalizedCluster);
    const transaction = await sequelize.transaction();
    let topic;
    try {
      topic = await createTopicWithGeneratedCode({
        Topik,
        clusterCode,
        values: {
          judul: normalizedJudul,
          deskripsi: String(deskripsi || "").trim() || null,
          keyword: null,
          cluster: normalizedCluster,
          dosen_id,
          status: "available",
        },
        transaction,
      });
      await TopikBidangPenelitian.bulkCreate(
        fieldValidation.ids.map((bidangId) => ({
          topik_id: topic.id,
          bidang_penelitian_id: bidangId,
        })),
        { transaction }
      );
      await transaction.commit();
    } catch (creationError) {
      if (!transaction.finished) await transaction.rollback();
      throw creationError;
    }

    // Load relasi dosen
    const topicWithDosen = await Topik.findByPk(topic.id, {
      include: [
        {
          model: Dosen,
          as: "dosen",
          attributes: ["id", "nik", "nama", "email", "jabatan_struktural", "kuota_bimbingan", "status_keaktifan"],
        },
        TOPIC_RESEARCH_FIELD_INCLUDE,
      ],
    });

    const isAvailable = !kuotaInfo.is_penuh;

    res.status(201).json({
      success: true,
      message: "Topik berhasil dibuat",
      data: {
        ...topicWithDosen.toJSON(),
        kuota_dosen: kuotaInfo,
        is_available: isAvailable,
      },
    });
  } catch (error) {
    console.error("Error di createTopic:", error);
    res.status(error?.statusCode || 500).json({
      success: false,
      message: error?.statusCode ? error.message : "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// PUT /api/topics/:id - Update topik (Admin/Dosen/Sekretaris Prodi)
exports.updateTopic = async (req, res) => {
  let transaction = null;
  try {
    const { id } = req.params;
    const { kode, judul, deskripsi, cluster, status, bidang_penelitian_ids } = req.body;
    const isAdmin = req.user.role === "admin";
    const dosen_id = isAdmin ? null : await resolveActorDosenId(req);

    if (!isAdmin && !dosen_id) {
      return res.status(403).json({
        success: false,
        message: "Akun ini tidak terhubung ke data dosen.",
      });
    }

    const topic = await Topik.findByPk(id);

    if (!topic) {
      return res.status(404).json({
        success: false,
        message: "Topik tidak ditemukan",
      });
    }

    // Cek apakah dosen ini pemilik topik
    if (!isAdmin && topic.dosen_id !== dosen_id) {
      return res.status(403).json({
        success: false,
        message: "Anda tidak memiliki akses untuk mengubah topik ini",
      });
    }

    const fieldValidation = bidang_penelitian_ids !== undefined
      ? await validateTopicResearchFieldsForDosen(topic.dosen_id, bidang_penelitian_ids)
      : null;
    if (fieldValidation && !fieldValidation.ok) {
      return res.status(400).json({ success: false, message: fieldValidation.message });
    }

    // Update
    if (kode) {
      const normalizedKode = String(kode).trim().toUpperCase();
      if (!normalizedKode) {
        return res.status(400).json({
          success: false,
          message: "Kode topik tidak valid.",
        });
      }
      const existingKode = await Topik.findOne({
        where: {
          kode: normalizedKode,
          id: { [Op.ne]: topic.id },
        },
      });
      if (existingKode) {
        return res.status(409).json({
          success: false,
          message: `Kode topik ${normalizedKode} sudah digunakan.`,
        });
      }
      topic.kode = normalizedKode;
    }
    if (judul !== undefined) {
      const normalizedJudul = String(judul || "").trim();
      if (!normalizedJudul) {
        return res.status(400).json({ success: false, message: "Judul topik wajib diisi." });
      }
      const judulValidationError = getTopikTitleValidationError(normalizedJudul);
      if (judulValidationError) {
        return res.status(400).json({ success: false, message: judulValidationError });
      }
      topic.judul = normalizedJudul;
    }
    if (deskripsi !== undefined) topic.deskripsi = String(deskripsi || "").trim() || null;
    topic.keyword = null;
    if (cluster) {
      const normalizedCluster = normalizeClusterInput(cluster);
      if (!normalizedCluster) {
        return res.status(400).json({
          success: false,
          message: "Cluster harus salah satu dari: Sirkel, Siber, ITSC, MVK",
        });
      }
      topic.cluster = normalizedCluster;
    }

    const nextKode = String(topic.kode || "").trim().toUpperCase();
    const nextCluster = normalizeClusterInput(topic.cluster);
    const kodeCluster = resolveClusterFromTopikKode(nextKode);
    if (!kodeCluster || !kodeCluster.label) {
      return res.status(400).json({
        success: false,
        message: "Format kode topik tidak valid. Gunakan prefix cluster: SIRKEL, SIBER, ITSC, atau MVK.",
      });
    }
    if (!nextCluster || kodeCluster.label !== nextCluster) {
      return res.status(400).json({
        success: false,
        message: buildClusterKodeMismatchMessage(nextKode, nextCluster || topic.cluster),
      });
    }

    const allowedClusterLabels = await getAllowedClusterLabelsForDosen(topic.dosen_id);
    if (allowedClusterLabels.length > 0 && !allowedClusterLabels.includes(nextCluster)) {
      return res.status(403).json({
        success: false,
        message: `Topik ini hanya boleh berada di cluster: ${allowedClusterLabels.join(", ")}.`,
      });
    }

    const activePeriode = await PeriodePenjaluran.findOne({
      where: { status: "active", is_active: true },
      attributes: ["id"],
      order: [["updatedAt", "DESC"]],
    });
    if (status === "available") {
      const eligibility = await validateDosenForNewAssignment(topic.dosen_id, activePeriode?.id || null, {
        availabilityField: "tersedia_membimbing",
        activityLabel: "menawarkan topik aktif baru",
        checkQuota: false,
      });
      if (!activePeriode || !eligibility.allowed) {
        return res.status(409).json({
          success: false,
          message: !activePeriode ? "Belum ada periode penjaluran aktif." : eligibility.message,
        });
      }
    }
    if (status) topic.status = status;

    transaction = await sequelize.transaction();
    await topic.save({ transaction });
    if (fieldValidation) {
      await TopikBidangPenelitian.destroy({
        where: { topik_id: topic.id },
        transaction,
      });
      await TopikBidangPenelitian.bulkCreate(
        fieldValidation.ids.map((bidangId) => ({
          topik_id: topic.id,
          bidang_penelitian_id: bidangId,
        })),
        { transaction }
      );
    }
    await transaction.commit();

    // Load relasi
    const updatedTopic = await Topik.findByPk(id, {
      include: [
        {
          model: Dosen,
          as: "dosen",
          attributes: ["id", "nik", "nama", "email", "jabatan_struktural", "kuota_bimbingan", "status_keaktifan"],
        },
        TOPIC_RESEARCH_FIELD_INCLUDE,
      ],
    });

    const kuotaInfo = await updatedTopic.dosen.getKuotaInfo();
    const availability = activePeriode
      ? await DosenKetersediaanPeriode.findOne({
          where: { dosen_id: updatedTopic.dosen_id, periode_penjaluran_id: activePeriode.id },
        })
      : null;
    const isAvailable = updatedTopic.status === "available"
      && !kuotaInfo.is_penuh
      && isDosenAcademicallyActive(updatedTopic.dosen)
      && availability?.configuration_status === "ready"
      && availability?.tersedia_membimbing === true;

    res.json({
      success: true,
      message: "Topik berhasil diupdate",
      data: {
        ...updatedTopic.toJSON(),
        kuota_dosen: kuotaInfo,
        is_available: isAvailable,
      },
    });
  } catch (error) {
    if (transaction && !transaction.finished) await transaction.rollback();
    console.error("Error di updateTopic:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// DELETE /api/topics/:id - Hapus topik (Admin/Dosen/Sekretaris Prodi)
exports.deleteTopic = async (req, res) => {
  try {
    const { id } = req.params;
    const isAdmin = req.user.role === "admin";
    const dosen_id = isAdmin ? null : await resolveActorDosenId(req);

    if (!isAdmin && !dosen_id) {
      return res.status(403).json({
        success: false,
        message: "Akun ini tidak terhubung ke data dosen.",
      });
    }

    const topic = await Topik.findByPk(id);

    if (!topic) {
      return res.status(404).json({
        success: false,
        message: "Topik tidak ditemukan",
      });
    }

    // Cek apakah dosen ini pemilik topik
    if (!isAdmin && topic.dosen_id !== dosen_id) {
      return res.status(403).json({
        success: false,
        message: "Anda tidak memiliki akses untuk menghapus topik ini",
      });
    }

    await topic.destroy();

    res.json({
      success: true,
      message: "Topik berhasil dihapus",
    });
  } catch (error) {
    console.error("Error di deleteTopic:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

