const jwt = require("jsonwebtoken");
const { Mahasiswa, Dosen, Admin } = require("../models");

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "24h";

// POST /api/auth/login - Login untuk Mahasiswa, Dosen, dan Admin
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validasi input
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Username dan password harus diisi",
      });
    }

    let user = null;
    let role = null;

    // 1. Cek apakah user adalah mahasiswa (NIM)
    user = await Mahasiswa.findOne({ where: { nim: username } });
    if (user) {
      role = "mahasiswa";
    }

    // 2. Jika bukan mahasiswa, cek apakah dosen (NIP)
    if (!user) {
      user = await Dosen.findOne({ where: { nip: username } });
      if (user) {
        role = "dosen";
      }
    }

    // 3. Jika bukan dosen, cek apakah admin (NIP)
    if (!user) {
      user = await Admin.findOne({ where: { nip: username } });
      if (user) {
        role = "admin";
      }
    }

    // Jika user tidak ditemukan
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Username atau password salah",
      });
    }

    // Verifikasi password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Username atau password salah",
      });
    }

    // Generate JWT token
    const tokenPayload = {
      id: user.id,
      role: role,
    };

    // Tambahkan username ke payload
    if (role === "mahasiswa") {
      tokenPayload.username = user.nim;
    } else if (role === "dosen" || role === "admin") {
      tokenPayload.username = user.nip;
    }

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    // Response dengan informasi user
    const responseData = {
      token,
      user: {
        id: user.id,
        username: role === "mahasiswa" ? user.nim : user.nip,
        nama: user.nama,
        email: user.email,
        role: role,
      },
      prompt_change_password: user.is_default_password,
    };

    // Tambahkan info role admin jika user adalah admin
    if (role === "admin") {
      responseData.user.admin_role = user.role; // koordinator atau staff
    }

    res.json({
      success: true,
      message: "Login berhasil",
      data: responseData,
    });
  } catch (error) {
    console.error("Error di login:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// POST /api/auth/change-password - Ganti password untuk semua role
exports.changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Validasi input
    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Password lama dan password baru harus diisi",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password baru minimal 6 karakter",
      });
    }

    // Cari user berdasarkan role
    let user = null;
    if (userRole === "mahasiswa") {
      user = await Mahasiswa.findByPk(userId);
    } else if (userRole === "dosen") {
      user = await Dosen.findByPk(userId);
    } else if (userRole === "admin") {
      user = await Admin.findByPk(userId);
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User tidak ditemukan",
      });
    }

    // Verifikasi password lama
    const isOldPasswordValid = await user.comparePassword(oldPassword);
    if (!isOldPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Password lama tidak sesuai",
      });
    }

    // Update password dan set is_default_password menjadi false
    user.password = newPassword;
    user.is_default_password = false;
    await user.save();

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

// GET /api/auth/profile - Get profile untuk semua role
exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    let user = null;
    if (userRole === "mahasiswa") {
      user = await Mahasiswa.findByPk(userId, {
        attributes: { exclude: ["password"] },
      });
    } else if (userRole === "dosen") {
      user = await Dosen.findByPk(userId, {
        attributes: { exclude: ["password"] },
      });
    } else if (userRole === "admin") {
      user = await Admin.findByPk(userId, {
        attributes: { exclude: ["password"] },
      });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User tidak ditemukan",
      });
    }

    res.json({
      success: true,
      data: {
        user: {
          ...user.toJSON(),
          role: userRole,
        },
      },
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
