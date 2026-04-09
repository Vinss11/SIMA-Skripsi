const { PamitUlang, Pengajuan, Mahasiswa, Dosen, sequelize } = require("../models");

// ========== DPA APPROVAL UNTUK PAMIT ==========

// GET /api/dpa/pamit - Dosen melihat pamit yang perlu di-approve (sebagai DPA)
exports.getPamitList = async (req, res) => {
  try {
    const dosen_id = req.user.id;
    const { status } = req.query;

    // Cari mahasiswa yang DPA-nya adalah dosen ini
    const mahasiswas = await Mahasiswa.findAll({
      where: {
        dosen_pembimbing_akademik_id: dosen_id,
      },
      attributes: ["id"],
    });

    const mahasiswaIds = mahasiswas.map((m) => m.id);

    const where = {
      mahasiswa_id: mahasiswaIds,
    };

    if (status) {
      where.status_dpa = status;
    }

    const pamits = await PamitUlang.findAll({
      where,
      include: [
        {
          model: Mahasiswa,
          as: "mahasiswa",
          attributes: ["id", "nim", "nama", "email", "angkatan"],
        },
        {
          model: Pengajuan,
          as: "pengajuanSebelumnya",
          attributes: ["id", "topik_1_judul", "judul_mandiri", "tipe_pengajuan", "status"],
          include: [
            {
              model: Dosen,
              as: "dosenCurrent",
              attributes: ["id", "nip", "nama"],
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

    res.json({
      success: true,
      data: pamits,
      total: pamits.length,
    });
  } catch (error) {
    console.error("Error di getPamitList:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// GET /api/dpa/pamit/:id - Detail pamit
exports.getPamitDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const dosen_id = req.user.id;

    const pamit = await PamitUlang.findByPk(id, {
      include: [
        {
          model: Mahasiswa,
          as: "mahasiswa",
          attributes: ["id", "nim", "nama", "email", "angkatan"],
          include: [
            {
              model: Dosen,
              as: "dosenPembimbingAkademik",
              attributes: ["id", "nip", "nama"],
            },
          ],
        },
        {
          model: Pengajuan,
          as: "pengajuanSebelumnya",
          attributes: ["id", "topik_1_judul", "judul_mandiri", "tipe_pengajuan", "status", "createdAt"],
          include: [
            {
              model: Dosen,
              as: "dosenCurrent",
              attributes: ["id", "nip", "nama", "email"],
            },
          ],
        },
        {
          model: Pengajuan,
          as: "pengajuanBaru",
          attributes: ["id", "jenis_jalur", "tipe_pengajuan", "status", "createdAt"],
        },
      ],
    });

    if (!pamit) {
      return res.status(404).json({
        success: false,
        message: "Data pamit tidak ditemukan",
      });
    }

    // Validasi: Pastikan dosen ini adalah DPA mahasiswa tersebut
    if (pamit.mahasiswa.dosen_pembimbing_akademik_id !== dosen_id) {
      return res.status(403).json({
        success: false,
        message: "Anda tidak memiliki akses untuk melihat pamit ini",
      });
    }

    res.json({
      success: true,
      data: pamit,
    });
  } catch (error) {
    console.error("Error di getPamitDetail:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// POST /api/dpa/pamit/:id/approve - DPA menyetujui pamit
exports.approvePamit = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { id } = req.params;
    const dosen_id = req.user.id;
    const { keterangan_dpa } = req.body;

    const pamit = await PamitUlang.findByPk(id, {
      include: [
        {
          model: Mahasiswa,
          as: "mahasiswa",
          attributes: ["id", "nim", "nama", "dosen_pembimbing_akademik_id"],
        },
      ],
      transaction: t,
    });

    if (!pamit) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Data pamit tidak ditemukan",
      });
    }

    // Validasi: Pastikan dosen ini adalah DPA mahasiswa tersebut
    if (pamit.mahasiswa.dosen_pembimbing_akademik_id !== dosen_id) {
      await t.rollback();
      return res.status(403).json({
        success: false,
        message: "Anda tidak memiliki akses untuk menyetujui pamit ini",
      });
    }

    // Validasi: Pamit harus dalam status pending
    if (pamit.status_dpa !== "pending") {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: `Pamit ini sudah diproses dengan status: ${pamit.status_dpa}`,
      });
    }

    // Update pamit
    await pamit.update(
      {
        status_dpa: "approved",
        keterangan_dpa: keterangan_dpa || "Disetujui oleh DPA",
        tanggal_approval_dpa: new Date(),
      },
      { transaction: t }
    );

    await t.commit();

    // Load data lengkap
    const updatedPamit = await PamitUlang.findByPk(id, {
      include: [
        {
          model: Mahasiswa,
          as: "mahasiswa",
          attributes: ["id", "nim", "nama", "email"],
        },
        {
          model: Pengajuan,
          as: "pengajuanSebelumnya",
          attributes: ["id", "topik_1_judul", "judul_mandiri"],
        },
      ],
    });

    res.json({
      success: true,
      message: "Pamit berhasil disetujui. Mahasiswa dapat melanjutkan dengan memilih topik baru.",
      data: updatedPamit,
    });
  } catch (error) {
    if (!t.finished) await t.rollback();
    console.error("Error di approvePamit:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// POST /api/dpa/pamit/:id/reject - DPA menolak pamit
exports.rejectPamit = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { id } = req.params;
    const dosen_id = req.user.id;
    const { keterangan_dpa } = req.body;

    if (!keterangan_dpa) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Keterangan penolakan harus diisi",
      });
    }

    const pamit = await PamitUlang.findByPk(id, {
      include: [
        {
          model: Mahasiswa,
          as: "mahasiswa",
          attributes: ["id", "nim", "nama", "dosen_pembimbing_akademik_id"],
        },
      ],
      transaction: t,
    });

    if (!pamit) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Data pamit tidak ditemukan",
      });
    }

    // Validasi: Pastikan dosen ini adalah DPA mahasiswa tersebut
    if (pamit.mahasiswa.dosen_pembimbing_akademik_id !== dosen_id) {
      await t.rollback();
      return res.status(403).json({
        success: false,
        message: "Anda tidak memiliki akses untuk menolak pamit ini",
      });
    }

    // Validasi: Pamit harus dalam status pending
    if (pamit.status_dpa !== "pending") {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: `Pamit ini sudah diproses dengan status: ${pamit.status_dpa}`,
      });
    }

    // Update pamit
    await pamit.update(
      {
        status_dpa: "rejected",
        keterangan_dpa,
        tanggal_approval_dpa: new Date(),
      },
      { transaction: t }
    );

    await t.commit();

    // Load data lengkap
    const updatedPamit = await PamitUlang.findByPk(id, {
      include: [
        {
          model: Mahasiswa,
          as: "mahasiswa",
          attributes: ["id", "nim", "nama", "email"],
        },
        {
          model: Pengajuan,
          as: "pengajuanSebelumnya",
          attributes: ["id", "topik_1_judul", "judul_mandiri"],
        },
      ],
    });

    res.json({
      success: true,
      message: "Pamit ditolak",
      data: updatedPamit,
    });
  } catch (error) {
    if (!t.finished) await t.rollback();
    console.error("Error di rejectPamit:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};
