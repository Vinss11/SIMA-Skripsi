const { Pengajuan, Mahasiswa, Topik, Dosen, RiwayatPersetujuan, PamitUlang, sequelize } = require("../models");

// ========== PENGAJUAN SUBMISSIONS ==========

function buildTopikList(submission) {
  return [
    submission.topik_1_kode
      ? {
          slot: 1,
          kode: submission.topik_1_kode,
          judul: submission.topik_1_judul,
        }
      : null,
    submission.topik_2_kode
      ? {
          slot: 2,
          kode: submission.topik_2_kode,
          judul: submission.topik_2_judul,
        }
      : null,
    submission.topik_3_kode
      ? {
          slot: 3,
          kode: submission.topik_3_kode,
          judul: submission.topik_3_judul,
        }
      : null,
  ].filter(Boolean);
}

function getApprovedTopik(submission, topikList) {
  if (submission.status !== "approved" || topikList.length === 0) {
    return null;
  }

  const rejectedCount = (submission.riwayat || []).filter((item) => item.status === "rejected").length;
  const approvedSlot = Math.min(rejectedCount + 1, topikList.length);
  return topikList.find((item) => item.slot === approvedSlot) || null;
}

// GET /api/dosen/submissions - Dosen melihat pengajuan yang ditujukan kepadanya
exports.getDosenSubmissions = async (req, res) => {
  try {
    const dosen_id = req.user.id;
    const { tipe_pengajuan } = req.query;

    const where = {
      dosen_saat_ini: dosen_id,
    };

    if (tipe_pengajuan) {
      const allowedTipe = ["topik_dosen", "judul_mandiri"];
      if (!allowedTipe.includes(tipe_pengajuan)) {
        return res.status(400).json({
          success: false,
          message: "Parameter tipe_pengajuan tidak valid. Gunakan: topik_dosen atau judul_mandiri",
        });
      }
      where.tipe_pengajuan = tipe_pengajuan;
    }

    const submissions = await Pengajuan.findAll({
      where,
      include: [
        {
          model: Mahasiswa,
          as: "mahasiswa",
          attributes: ["id", "nim", "nama", "angkatan"],
        },
        {
          model: RiwayatPersetujuan,
          as: "riwayat",
          attributes: ["status"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    const compactData = submissions.map((submission) => {
      const base = {
        id: submission.id,
        mahasiswa: submission.mahasiswa
          ? {
              id: submission.mahasiswa.id,
              nim: submission.mahasiswa.nim,
              nama: submission.mahasiswa.nama,
              angkatan: submission.mahasiswa.angkatan,
            }
          : null,
        jenis_jalur: submission.jenis_jalur,
        tipe_pengajuan: submission.tipe_pengajuan,
        status: submission.status,
        diajukan_pada: submission.createdAt,
      };

      if (submission.tipe_pengajuan === "topik_dosen") {
        const topikList = buildTopikList(submission);
        const approvedTopik = getApprovedTopik(submission, topikList);

        base.topik_dipilih = topikList.map(({ kode }) => kode);
        base.topik_disetujui = approvedTopik
          ? {
              kode: approvedTopik.kode,
              judul: approvedTopik.judul,
            }
          : null;
      } else {
        base.judul_mandiri = submission.judul_mandiri;
      }

      return base;
    });

    res.json({
      success: true,
      data: compactData,
      total: compactData.length,
    });
  } catch (error) {
    console.error("Error di getDosenSubmissions:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// POST /api/dosen/submissions/:id/approve - Dosen menyetujui pengajuan
exports.approveSubmission = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { id } = req.params;
    const dosen_id = req.user.id;

    console.log("Approve - Request body:", req.body);
    console.log("Approve - User:", req.user);
    console.log("Approve - Params:", req.params);

    const { keterangan } = req.body || {};

    const submission = await Pengajuan.findByPk(id, {
      include: [
        {
          model: Mahasiswa,
          as: "mahasiswa",
          attributes: ["id", "nim", "nama", "email"],
        },
      ],
      transaction: t,
    });

    if (!submission) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Pengajuan tidak ditemukan",
      });
    }

    // Validasi: Cek apakah dosen ini yang berhak approve
    if (submission.dosen_saat_ini !== dosen_id) {
      await t.rollback();
      return res.status(403).json({
        success: false,
        message: "Anda tidak memiliki akses untuk menyetujui pengajuan ini",
      });
    }

    // Validasi: Pengajuan harus dalam status pending
    if (submission.status !== "pending") {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Pengajuan ini sudah diproses sebelumnya",
      });
    }

    // Update status pengajuan
    await submission.update(
      {
        status: "approved",
        alasan_persetujuan: keterangan || "Pengajuan disetujui",
        alasan_penolakan: null,
      },
      { transaction: t }
    );

    // Tentukan topik yang benar-benar di-approve (berdasarkan dosen_saat_ini)
    let approvedTopikKode = null;
    if (submission.dosen_saat_ini === submission.dosen_pilihan_1) {
      approvedTopikKode = submission.topik_1_kode;
    } else if (submission.dosen_saat_ini === submission.dosen_pilihan_2) {
      approvedTopikKode = submission.topik_2_kode;
    } else if (submission.dosen_saat_ini === submission.dosen_pilihan_3) {
      approvedTopikKode = submission.topik_3_kode;
    }

    if (approvedTopikKode) {
      await Topik.update(
        { status: "taken" },
        {
          where: { kode: approvedTopikKode },
          transaction: t,
        }
      );
    }

    const reservedReleaseKodes = [submission.topik_1_kode, submission.topik_2_kode, submission.topik_3_kode]
      .filter(Boolean)
      .filter((kode) => kode !== approvedTopikKode);
    if (reservedReleaseKodes.length > 0) {
      await Topik.update(
        { status: "available" },
        {
          where: {
            kode: reservedReleaseKodes,
            status: "reserved",
          },
          transaction: t,
        }
      );
    }

    // ⭐ UPDATE MAHASISWA & AUTO DISABLE TOPIK ⭐

    // 1. Update Data Mahasiswa
    const mahasiswa = await Mahasiswa.findByPk(submission.mahasiswa_id, { transaction: t });

    await mahasiswa.update(
      {
        dosen_pembimbing_skripsi_id: dosen_id,
        status_jalur_saat_ini: submission.jenis_jalur, // "baru" atau "ulang" atau "ekstensi"
        pengajuan_aktif_id: null, // Clear pengajuan aktif karena sudah approved
      },
      { transaction: t }
    );

    // 2. Cek Kuota Dosen & Auto-Disable Topik
    const dosen = await Dosen.findByPk(dosen_id, { transaction: t });
    const kuotaInfo = await dosen.getKuotaInfo();

    // Jika kuota dosen sudah penuh, disable semua topik dosen tersebut yang masih available
    if (kuotaInfo.is_penuh) {
      await Topik.update(
        { status: "unavailable" },
        {
          where: {
            dosen_id: dosen_id,
            status: "available", // Hanya update yang masih available
          },
          transaction: t,
        }
      );

      console.log(`⚠️ Kuota dosen ${dosen.nama} penuh (${kuotaInfo.terpakai}/${kuotaInfo.total}). Semua topik sisa di-disable.`);
    }

    // Simpan riwayat persetujuan
    await RiwayatPersetujuan.create(
      {
        pengajuan_id: id,
        dosen_id,
        status: "approved",
        keterangan: keterangan || "Pengajuan disetujui",
        tanggal_keputusan: new Date(),
      },
      { transaction: t }
    );

    await t.commit();

    // Load data lengkap untuk response (AFTER COMMIT)
    const updatedSubmission = await Pengajuan.findByPk(id, {
      include: [
        {
          model: Mahasiswa,
          as: "mahasiswa",
          attributes: ["id", "nim", "nama", "email"],
        },
        {
          model: RiwayatPersetujuan,
          as: "riwayat",
          include: [
            {
              model: Dosen,
              as: "dosen",
              attributes: ["id", "nip", "nama"],
            },
          ],
        },
      ],
    });

    res.json({
      success: true,
      message: "Pengajuan berhasil disetujui",
      data: updatedSubmission,
    });
  } catch (error) {
    if (!t.finished) {
      await t.rollback();
    }
    console.error("Error di approveSubmission:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// POST /api/dosen/submissions/:id/reject - Dosen menolak pengajuan
exports.rejectSubmission = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { id } = req.params;
    const dosen_id = req.user.id;

    console.log("Reject - Request body:", req.body);
    console.log("Reject - User:", req.user);
    console.log("Reject - Params:", req.params);

    if (!req.body || Object.keys(req.body).length === 0) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Request body tidak boleh kosong. Pastikan Content-Type: application/json",
      });
    }

    const { keterangan } = req.body;

    if (!keterangan) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Keterangan penolakan harus diisi",
      });
    }

    const submission = await Pengajuan.findByPk(id, {
      include: [
        {
          model: Mahasiswa,
          as: "mahasiswa",
          attributes: ["id", "nim", "nama", "email"],
        },
      ],
      transaction: t,
    });

    if (!submission) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Pengajuan tidak ditemukan",
      });
    }

    if (submission.dosen_saat_ini !== dosen_id) {
      await t.rollback();
      return res.status(403).json({
        success: false,
        message: "Anda tidak memiliki akses untuk menolak pengajuan ini",
      });
    }

    if (submission.status !== "pending") {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Pengajuan ini sudah diproses sebelumnya",
      });
    }

    // Simpan riwayat penolakan
    await RiwayatPersetujuan.create(
      {
        pengajuan_id: id,
        dosen_id,
        status: "rejected",
        keterangan,
        tanggal_keputusan: new Date(),
      },
      { transaction: t }
    );

    // LOGIKA OTOMATIS: Pindah ke dosen pilihan berikutnya
    let nextDosen = null;
    let finalStatus = "rejected";

    if (submission.dosen_saat_ini === submission.dosen_pilihan_1) {
      if (submission.dosen_pilihan_2) {
        nextDosen = submission.dosen_pilihan_2;
        finalStatus = "pending";
      }
    } else if (submission.dosen_saat_ini === submission.dosen_pilihan_2) {
      if (submission.dosen_pilihan_3) {
        nextDosen = submission.dosen_pilihan_3;
        finalStatus = "pending";
      }
    }

    let releasedKode = null;
    if (finalStatus === "pending") {
      if (submission.dosen_saat_ini === submission.dosen_pilihan_1) {
        releasedKode = submission.topik_1_kode;
      } else if (submission.dosen_saat_ini === submission.dosen_pilihan_2) {
        releasedKode = submission.topik_2_kode;
      } else if (submission.dosen_saat_ini === submission.dosen_pilihan_3) {
        releasedKode = submission.topik_3_kode;
      }
    }

    await submission.update(
      {
        dosen_saat_ini: nextDosen,
        status: finalStatus,
        alasan_penolakan: keterangan,
      },
      { transaction: t }
    );

    if (finalStatus === "pending" && releasedKode) {
      await Topik.update(
        { status: "available" },
        {
          where: {
            kode: releasedKode,
            status: "reserved",
          },
          transaction: t,
        }
      );
    }

    // Jika sudah tidak ada dosen pilihan lagi, kembalikan status topik ke available
    if (finalStatus === "rejected") {
      const reservedReleaseKodes = [submission.topik_1_kode, submission.topik_2_kode, submission.topik_3_kode].filter(Boolean);
      if (reservedReleaseKodes.length > 0) {
        await Topik.update(
          { status: "available" },
          {
            where: {
              kode: reservedReleaseKodes,
              status: "reserved",
            },
            transaction: t,
          }
        );
      }
    }

    await t.commit();

    const updatedSubmission = await Pengajuan.findByPk(id, {
      include: [
        {
          model: Mahasiswa,
          as: "mahasiswa",
          attributes: ["id", "nim", "nama", "email"],
        },
        {
          model: RiwayatPersetujuan,
          as: "riwayat",
          include: [
            {
              model: Dosen,
              as: "dosen",
              attributes: ["id", "nip", "nama"],
            },
          ],
          order: [["tanggal_keputusan", "DESC"]],
        },
      ],
    });

    const responseMessage = nextDosen ? "Pengajuan ditolak dan diteruskan ke dosen pilihan berikutnya" : "Pengajuan ditolak dan tidak ada dosen pilihan lagi";

    res.json({
      success: true,
      message: responseMessage,
      data: updatedSubmission,
    });
  } catch (error) {
    if (!t.finished) {
      await t.rollback();
    }
    console.error("Error di rejectSubmission:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// ========== PAMIT MAHASISWA (DOSEN PEMBIMBING - READ ONLY) ==========

// GET /api/dosen/pamit-mahasiswa - Dosen pembimbing melihat pamit mahasiswa yang dibimbingnya (READ ONLY)
exports.getPamitMahasiswa = async (req, res) => {
  try {
    const dosen_id = req.user.id;
    const { status } = req.query;

    // Cari mahasiswa yang dosen pembimbing skripsinya adalah dosen ini
    const mahasiswas = await Mahasiswa.findAll({
      where: {
        dosen_pembimbing_skripsi_id: dosen_id,
      },
      attributes: ["id"],
    });

    const mahasiswaIds = mahasiswas.map((m) => m.id);

    if (mahasiswaIds.length === 0) {
      return res.json({
        success: true,
        data: [],
        total: 0,
        message: "Anda belum memiliki mahasiswa bimbingan skripsi",
      });
    }

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
          attributes: ["id", "topik_1_judul", "judul_mandiri", "tipe_pengajuan", "status"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    res.json({
      success: true,
      data: pamits,
      total: pamits.length,
      message: "Ini adalah daftar pamit mahasiswa bimbingan Anda. Anda hanya dapat melihat, tidak dapat approve/reject.",
    });
  } catch (error) {
    console.error("Error di getPamitMahasiswa:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// GET /api/dosen/pamit-mahasiswa/:id - Dosen pembimbing melihat detail pamit (READ ONLY)
exports.getPamitMahasiswaDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const dosen_id = req.user.id;

    const pamit = await PamitUlang.findByPk(id, {
      include: [
        {
          model: Mahasiswa,
          as: "mahasiswa",
          attributes: ["id", "nim", "nama", "email", "angkatan", "dosen_pembimbing_skripsi_id", "dosen_pembimbing_akademik_id"],
          include: [
            {
              model: Dosen,
              as: "dosenPembimbingAkademik",
              attributes: ["id", "nip", "nama", "email"],
            },
          ],
        },
        {
          model: Pengajuan,
          as: "pengajuanSebelumnya",
          attributes: ["id", "topik_1_judul", "judul_mandiri", "tipe_pengajuan", "status", "createdAt"],
        },
      ],
    });

    if (!pamit) {
      return res.status(404).json({
        success: false,
        message: "Data pamit tidak ditemukan",
      });
    }

    // Validasi: Pastikan dosen ini adalah dosen pembimbing skripsi mahasiswa tersebut
    if (pamit.mahasiswa.dosen_pembimbing_skripsi_id !== dosen_id) {
      return res.status(403).json({
        success: false,
        message: "Anda tidak memiliki akses untuk melihat pamit ini",
      });
    }

    res.json({
      success: true,
      data: pamit,
      message: "Detail pamit mahasiswa. Anda hanya dapat melihat, tidak dapat approve/reject. Approval dilakukan oleh DPA.",
    });
  } catch (error) {
    console.error("Error di getPamitMahasiswaDetail:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// ========== PAMIT ULANG (DPA - CAN APPROVE/REJECT) ==========

// GET /api/dosen/pamit-dpa - Dosen (sebagai DPA) melihat pamit mahasiswa bimbingan akademiknya
exports.getPamitDPA = async (req, res) => {
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

    if (mahasiswaIds.length === 0) {
      return res.json({
        success: true,
        data: [],
        total: 0,
        message: "Anda belum memiliki mahasiswa bimbingan akademik",
      });
    }

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
          include: [
            {
              model: Dosen,
              as: "dosenPembimbingSkripsi",
              attributes: ["id", "nip", "nama"],
            },
          ],
        },
        {
          model: Pengajuan,
          as: "pengajuanSebelumnya",
          attributes: ["id", "topik_1_judul", "judul_mandiri", "tipe_pengajuan", "status"],
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
    console.error("Error di getPamitDPA:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// GET /api/dosen/pamit-dpa/:id - Dosen (sebagai DPA) melihat detail pamit
exports.getPamitDPADetail = async (req, res) => {
  try {
    const { id } = req.params;
    const dosen_id = req.user.id;

    const pamit = await PamitUlang.findByPk(id, {
      include: [
        {
          model: Mahasiswa,
          as: "mahasiswa",
          attributes: ["id", "nim", "nama", "email", "angkatan", "dosen_pembimbing_skripsi_id", "dosen_pembimbing_akademik_id"],
          include: [
            {
              model: Dosen,
              as: "dosenPembimbingSkripsi",
              attributes: ["id", "nip", "nama", "email"],
            },
          ],
        },
        {
          model: Pengajuan,
          as: "pengajuanSebelumnya",
          attributes: ["id", "topik_1_judul", "judul_mandiri", "tipe_pengajuan", "status", "createdAt"],
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
    console.error("Error di getPamitDPADetail:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// POST /api/dosen/pamit-dpa/:id/approve - Dosen (sebagai DPA) menyetujui pamit
exports.approvePamitDPA = async (req, res) => {
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

    // ⭐ UPDATE MAHASISWA - CLEAR DOSEN PEMBIMBING SKRIPSI ⭐
    const mahasiswa = await Mahasiswa.findByPk(pamit.mahasiswa_id, { transaction: t });

    // Simpan dosen_id sebelum di-clear untuk re-enable topiknya
    const previous_dosen_id = mahasiswa.dosen_pembimbing_skripsi_id;

    await mahasiswa.update(
      {
        dosen_pembimbing_skripsi_id: null, // Clear dosen pembimbing skripsi
        status_jalur_saat_ini: "sedang_mengajukan", // Siap mengajukan topik baru
        pengajuan_aktif_id: null, // Clear pengajuan aktif
      },
      { transaction: t }
    );

    // ⭐ RE-ENABLE TOPIK DOSEN (KUOTA BERKURANG) ⭐
    if (previous_dosen_id) {
      const previousDosen = await Dosen.findByPk(previous_dosen_id, { transaction: t });

      if (previousDosen) {
        const kuotaInfo = await previousDosen.getKuotaInfo();

        // Jika kuota tidak lagi penuh, re-enable topik yang unavailable
        if (!kuotaInfo.is_penuh) {
          await Topik.update(
            { status: "available" },
            {
              where: {
                dosen_id: previous_dosen_id,
                status: "unavailable", // Hanya update yang di-disable karena kuota
              },
              transaction: t,
            }
          );

          console.log(`✅ Kuota dosen ${previousDosen.nama} tersedia lagi (${kuotaInfo.terpakai}/${kuotaInfo.total}). Topik di-enable.`);
        }
      }
    }

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
    console.error("Error di approvePamitDPA:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// POST /api/dosen/pamit-dpa/:id/reject - Dosen (sebagai DPA) menolak pamit
exports.rejectPamitDPA = async (req, res) => {
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
    console.error("Error di rejectPamitDPA:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// ========== KUOTA MANAGEMENT ENDPOINTS ==========

// GET /api/dosen/kuota - Dosen cek kuota sendiri
exports.getKuotaSendiri = async (req, res) => {
  try {
    const dosen_id = req.user.id;

    const dosen = await Dosen.findByPk(dosen_id, {
      attributes: ["id", "nip", "nama", "email", "kuota_bimbingan"],
    });

    if (!dosen) {
      return res.status(404).json({
        success: false,
        message: "Data dosen tidak ditemukan",
      });
    }

    const kuotaInfo = await dosen.getKuotaInfo();

    // Dapatkan list mahasiswa bimbingan
    const mahasiswas = await Mahasiswa.findAll({
      where: { dosen_pembimbing_skripsi_id: dosen_id },
      attributes: ["id", "nim", "nama", "email", "angkatan", "status_jalur_saat_ini"],
      order: [["nim", "ASC"]],
    });

    res.json({
      success: true,
      data: {
        dosen: {
          id: dosen.id,
          nama: dosen.nama,
          nip: dosen.nip,
        },
        kuota: kuotaInfo,
        mahasiswa_bimbingan: mahasiswas,
      },
    });
  } catch (error) {
    console.error("Error di getKuotaSendiri:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};
