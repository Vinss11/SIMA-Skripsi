const { Mahasiswa, Dosen, Pengajuan, Topik, sequelize } = require("../models");
const { Op } = require("sequelize");

// GET /api/admin/mahasiswa - Lihat semua mahasiswa
exports.getAllMahasiswa = async (req, res) => {
  try {
    const { status_jalur, angkatan } = req.query;

    const where = {};
    if (status_jalur) {
      where.status_jalur_saat_ini = status_jalur;
    }
    if (angkatan) {
      where.angkatan = angkatan;
    }

    const mahasiswas = await Mahasiswa.findAll({
      where,
      attributes: { exclude: ["password"] },
      include: [
        {
          model: Dosen,
          as: "dosenPembimbingAkademik",
          attributes: ["id", "nip", "nama"],
        },
        {
          model: Dosen,
          as: "dosenPembimbingSkripsi",
          attributes: ["id", "nip", "nama"],
        },
        {
          model: Pengajuan,
          as: "pengajuanAktif",
          attributes: ["id", "jenis_jalur", "tipe_pengajuan", "status"],
        },
      ],
      order: [["nim", "ASC"]],
    });

    res.json({
      success: true,
      data: mahasiswas,
      total: mahasiswas.length,
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
          attributes: ["id", "nip", "nama", "email"],
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
          attributes: ["id", "nip", "nama"],
        },
        {
          model: Dosen,
          as: "dosenPembimbingSkripsi",
          attributes: ["id", "nip", "nama"],
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
          attributes: ["id", "nip", "nama"],
        },
        {
          model: Dosen,
          as: "dosen2",
          attributes: ["id", "nip", "nama"],
        },
        {
          model: Dosen,
          as: "dosen3",
          attributes: ["id", "nip", "nama"],
        },
        {
          model: Dosen,
          as: "dosenCurrent",
          attributes: ["id", "nip", "nama"],
        },
        {
          model: Dosen,
          as: "prospectiveSupervisor",
          attributes: ["id", "nip", "nama"],
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

// ========== ADMIN - KUOTA MANAGEMENT ==========
// Tambahkan di bagian bawah adminController.js

// GET /api/admin/dosen/kuota-overview - Monitor semua kuota dosen
exports.getKuotaOverview = async (req, res) => {
  try {
    const dosens = await Dosen.findAll({
      attributes: ["id", "nip", "nama", "email", "jabatan", "kuota_bimbingan"],
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
          nip: dosen.nip,
          nama: dosen.nama,
          email: dosen.email,
          jabatan: dosen.jabatan,
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
          nip: dosen.nip,
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
      attributes: ["id", "nip", "nama", "email", "jabatan", "kuota_bimbingan"],
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
          nip: dosen.nip,
          nama: dosen.nama,
          email: dosen.email,
          jabatan: dosen.jabatan,
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
