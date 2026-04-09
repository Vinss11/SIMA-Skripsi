const { Topik, Dosen, Mahasiswa } = require("../models");
const { Op } = require("sequelize");

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
          attributes: ["id", "nip", "nama", "email", "jabatan", "kuota_bimbingan"],
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
          attributes: ["id", "nip", "nama", "email", "jabatan", "kuota_bimbingan"],
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

// POST /api/topics - Buat topik baru (Dosen only)
exports.createTopic = async (req, res) => {
  try {
    const { judul, deskripsi, cluster } = req.body;
    const dosen_id = req.user.id;

    // Validasi
    if (!judul || !cluster) {
      return res.status(400).json({
        success: false,
        message: "Judul dan cluster harus diisi",
      });
    }

    // Validasi cluster
    const validClusters = ["Sirkel", "Siber", "ITSC", "MVK"];
    if (!validClusters.includes(cluster)) {
      return res.status(400).json({
        success: false,
        message: `Cluster harus salah satu dari: ${validClusters.join(", ")}`,
      });
    }

    // Cek kuota dosen
    const dosen = await Dosen.findByPk(dosen_id);
    const kuotaInfo = await dosen.getKuotaInfo();

    const topic = await Topik.create({
      judul,
      deskripsi,
      cluster,
      dosen_id,
      status: "available",
    });

    // Load relasi dosen
    const topicWithDosen = await Topik.findByPk(topic.id, {
      include: [
        {
          model: Dosen,
          as: "dosen",
          attributes: ["id", "nip", "nama", "email", "jabatan", "kuota_bimbingan"],
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

// PUT /api/topics/:id - Update topik (Dosen only)
exports.updateTopic = async (req, res) => {
  try {
    const { id } = req.params;
    const { judul, deskripsi, cluster, status } = req.body;
    const dosen_id = req.user.id;

    const topic = await Topik.findByPk(id);

    if (!topic) {
      return res.status(404).json({
        success: false,
        message: "Topik tidak ditemukan",
      });
    }

    // Cek apakah dosen ini pemilik topik
    if (topic.dosen_id !== dosen_id) {
      return res.status(403).json({
        success: false,
        message: "Anda tidak memiliki akses untuk mengubah topik ini",
      });
    }

    // Update
    if (judul) topic.judul = judul;
    if (deskripsi) topic.deskripsi = deskripsi;
    if (cluster) topic.cluster = cluster;
    if (status) topic.status = status;

    await topic.save();

    // Load relasi
    const updatedTopic = await Topik.findByPk(id, {
      include: [
        {
          model: Dosen,
          as: "dosen",
          attributes: ["id", "nip", "nama", "email", "jabatan", "kuota_bimbingan"],
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

// DELETE /api/topics/:id - Hapus topik (Dosen only)
exports.deleteTopic = async (req, res) => {
  try {
    const { id } = req.params;
    const dosen_id = req.user.id;

    const topic = await Topik.findByPk(id);

    if (!topic) {
      return res.status(404).json({
        success: false,
        message: "Topik tidak ditemukan",
      });
    }

    // Cek apakah dosen ini pemilik topik
    if (topic.dosen_id !== dosen_id) {
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
