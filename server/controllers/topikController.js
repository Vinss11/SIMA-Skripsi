const { Topik, Dosen, Mahasiswa, SekretarisProdi } = require("../models");
const { Op } = require("sequelize");

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
      where[Op.or] = [{ kode: { [Op.iLike]: `%${keyword}%` } }, { judul: { [Op.iLike]: `%${keyword}%` } }, { "$dosen.nama$": { [Op.iLike]: `%${keyword}%` } }];
    }

    const topics = await Topik.findAll({
      where,
      include: [
        {
          model: Dosen,
          as: "dosen",
          attributes: ["id", "nik", "nama", "email", "jabatan_struktural", "kuota_bimbingan"],
        },
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
        const isAvailable = topic.status === "available" && !kuotaInfo.is_penuh;

        return {
          ...topicData,
          kuota_dosen: kuotaInfo,
          is_available: isAvailable,
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
          attributes: ["id", "nik", "nama", "email", "jabatan_struktural", "kuota_bimbingan"],
        },
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
    const isAvailable = topic.status === "available" && !kuotaInfo.is_penuh;

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
    const { kode, judul, deskripsi, cluster, dosen_id: dosenIdInput } = req.body;
    const normalizedKode = String(kode || "").trim().toUpperCase();
    const normalizedCluster = normalizeClusterInput(cluster);
    let dosen_id = null;

    // Validasi
    if (!normalizedKode || !judul || !normalizedCluster) {
      return res.status(400).json({
        success: false,
        message: "Kode topik, judul, dan cluster harus diisi",
      });
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

    const existingKode = await Topik.findOne({ where: { kode: normalizedKode } });
    if (existingKode) {
      return res.status(409).json({
        success: false,
        message: `Kode topik ${normalizedKode} sudah digunakan.`,
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

    const topic = await Topik.create({
      kode: normalizedKode,
      judul,
      deskripsi,
      cluster: normalizedCluster,
      dosen_id,
      status: "available",
    });

    // Load relasi dosen
    const topicWithDosen = await Topik.findByPk(topic.id, {
      include: [
        {
          model: Dosen,
          as: "dosen",
          attributes: ["id", "nik", "nama", "email", "jabatan_struktural", "kuota_bimbingan"],
        },
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
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// PUT /api/topics/:id - Update topik (Admin/Dosen/Sekretaris Prodi)
exports.updateTopic = async (req, res) => {
  try {
    const { id } = req.params;
    const { kode, judul, deskripsi, cluster, status } = req.body;
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
    if (judul) topic.judul = judul;
    if (deskripsi) topic.deskripsi = deskripsi;
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
    if (status) topic.status = status;

    await topic.save();

    // Load relasi
    const updatedTopic = await Topik.findByPk(id, {
      include: [
        {
          model: Dosen,
          as: "dosen",
          attributes: ["id", "nik", "nama", "email", "jabatan_struktural", "kuota_bimbingan"],
        },
      ],
    });

    const kuotaInfo = await updatedTopic.dosen.getKuotaInfo();
    const isAvailable = updatedTopic.status === "available" && !kuotaInfo.is_penuh;

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

