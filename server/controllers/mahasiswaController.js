const { Mahasiswa, Dosen, Pengajuan } = require("../models");
const bcrypt = require("bcrypt");

// ========== PROFILE ==========

// GET /api/mahasiswa/profile
exports.getProfile = async (req, res) => {
  try {
    const mahasiswa_id = req.user.id;

    const mahasiswa = await Mahasiswa.findByPk(mahasiswa_id, {
      attributes: { exclude: ["password"] },
      include: [
        {
          model: Dosen,
          as: "dosenPembimbingAkademik",
          attributes: ["id", "nip", "nama", "email"],
        },
        {
          model: Dosen,
          as: "dosenPembimbingSkripsi",
          attributes: ["id", "nip", "nama", "email"],
        },
        {
          model: Pengajuan,
          as: "pengajuanAktif",
          attributes: ["id", "jenis_jalur", "tipe_pengajuan", "status"],
        },
      ],
    });

    if (!mahasiswa) {
      return res.status(404).json({
        success: false,
        message: "Data mahasiswa tidak ditemukan",
      });
    }

    res.json({
      success: true,
      data: mahasiswa,
    });
  } catch (error) {
    console.error("Error di getProfile:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// PUT /api/mahasiswa/update-profile
exports.updateProfile = async (req, res) => {
  try {
    const mahasiswa_id = req.user.id;
    const { nama, email } = req.body;

    const mahasiswa = await Mahasiswa.findByPk(mahasiswa_id);

    if (!mahasiswa) {
      return res.status(404).json({
        success: false,
        message: "Data mahasiswa tidak ditemukan",
      });
    }

    // Update data
    if (nama) mahasiswa.nama = nama;
    if (email) mahasiswa.email = email;

    await mahasiswa.save();

    // Return tanpa password
    const updatedMahasiswa = await Mahasiswa.findByPk(mahasiswa_id, {
      attributes: { exclude: ["password"] },
      include: [
        {
          model: Dosen,
          as: "dosenPembimbingAkademik",
          attributes: ["id", "nip", "nama", "email"],
        },
        {
          model: Dosen,
          as: "dosenPembimbingSkripsi",
          attributes: ["id", "nip", "nama", "email"],
        },
      ],
    });

    res.json({
      success: true,
      message: "Profile berhasil diupdate",
      data: updatedMahasiswa,
    });
  } catch (error) {
    console.error("Error di updateProfile:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// PUT /api/mahasiswa/change-password
exports.changePassword = async (req, res) => {
  try {
    const mahasiswa_id = req.user.id;
    const { old_password, new_password } = req.body;

    if (!old_password || !new_password) {
      return res.status(400).json({
        success: false,
        message: "Password lama dan password baru harus diisi",
      });
    }

    const mahasiswa = await Mahasiswa.findByPk(mahasiswa_id);

    if (!mahasiswa) {
      return res.status(404).json({
        success: false,
        message: "Data mahasiswa tidak ditemukan",
      });
    }

    // Verifikasi password lama
    const isMatch = await mahasiswa.comparePassword(old_password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Password lama tidak sesuai",
      });
    }

    // Validasi password baru
    if (new_password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password baru minimal 6 karakter",
      });
    }

    // Update password baru
    mahasiswa.password = new_password;
    mahasiswa.is_default_password = false;
    await mahasiswa.save();

    res.json({
      success: true,
      message: "Password berhasil diubah",
    });
  } catch (error) {
    console.error("Error di changePassword:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// ========== DOSEN PEMBIMBING AKADEMIK ==========
// GET /api/mahasiswa/dpa/current - Get DPA saat ini
exports.getCurrentDPA = async (req, res) => {
  try {
    const mahasiswa_id = req.user.id;

    const mahasiswa = await Mahasiswa.findByPk(mahasiswa_id, {
      attributes: ["id", "nim", "nama", "dosen_pembimbing_akademik_id"],
      include: [
        {
          model: Dosen,
          as: "dosenPembimbingAkademik",
          attributes: ["id", "nip", "nama", "email"],
        },
      ],
    });

    if (!mahasiswa) {
      return res.status(404).json({
        success: false,
        message: "Data mahasiswa tidak ditemukan",
      });
    }

    if (!mahasiswa.dosen_pembimbing_akademik_id) {
      return res.json({
        success: true,
        has_dpa: false,
        data: null,
        message: "Anda belum memiliki dosen pembimbing akademik",
      });
    }

    res.json({
      success: true,
      has_dpa: true,
      data: mahasiswa.dosenPembimbingAkademik,
    });
  } catch (error) {
    console.error("Error di getCurrentDPA:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};
