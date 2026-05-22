const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");
const { Mahasiswa, Dosen, Admin, SekretarisProdi, sequelize } = require("../models");
const { isAllowedSekretarisJabatan } = require("../constants/sekretarisAkses");

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "24h";
const tableColumnsCache = {};

async function getTableColumns(tableName) {
  if (tableColumnsCache[tableName]) {
    return tableColumnsCache[tableName];
  }

  const columns = await sequelize.getQueryInterface().describeTable(tableName);
  const keys = Object.keys(columns || {});
  tableColumnsCache[tableName] = keys;
  return keys;
}

function pickFirstExisting(columns, candidates) {
  return candidates.find((column) => columns.includes(column)) || null;
}

function pickExisting(columns, candidates) {
  return candidates.filter((column) => columns.includes(column));
}

function buildLoginResponse(user, role, token) {
  const dosenIdentifier = user.kode_dosen || user.nik || user.nip || user.email;
  const sekretarisIdentifier = user.nik || user.nip || user.email;
  const username =
    role === "mahasiswa"
      ? user.nim
      : role === "dosen"
      ? dosenIdentifier
      : role === "sekretaris_prodi"
      ? sekretarisIdentifier
      : user.nip;

  const responseData = {
    token,
    user: {
      id: user.id,
      username,
      nama: user.nama,
      email: user.email,
      role: role,
    },
    prompt_change_password: user.is_default_password,
  };

  if (role === "admin") {
    responseData.user.admin_role = user.role;
  }

  if (role === "sekretaris_prodi") {
    responseData.user.jabatan = user.jabatan || "Sekretaris Prodi";
  }

  return responseData;
}

// POST /api/auth/login - Login untuk Mahasiswa, Dosen, Admin, dan Sekretaris Prodi
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

    // 2. Jika bukan mahasiswa, cek apakah sekretaris prodi (NIK atau email)
    if (!user) {
      const normalizedUsername = String(username).trim();
      const sekretarisColumns = await getTableColumns("SekretarisProdis");
      const sekretarisIdentifierColumn = pickFirstExisting(sekretarisColumns, ["nik", "nip"]);
      const sekretarisAttributes = pickExisting(sekretarisColumns, [
        "id",
        "nik",
        "nip",
        "nama",
        "email",
        "password",
        "is_default_password",
        "jabatan",
      ]);
      const sekretarisWhere = [{ email: normalizedUsername.toLowerCase() }];
      if (sekretarisIdentifierColumn) {
        sekretarisWhere.push({ [sekretarisIdentifierColumn]: normalizedUsername });
      }

      user = await SekretarisProdi.findOne({
        where: {
          [Op.or]: sekretarisWhere,
        },
        ...(sekretarisAttributes.length ? { attributes: sekretarisAttributes } : {}),
      });
      if (user) {
        role = "sekretaris_prodi";
      }
    }

    // 3. Jika bukan sekretaris, cek apakah dosen (kode_dosen, NIK, atau email)
    if (!user) {
      const normalizedUsername = String(username).trim();
      const dosenColumns = await getTableColumns("Dosens");
      const dosenIdentifierColumn = pickFirstExisting(dosenColumns, ["nik", "nip"]);
      const dosenAttributes = pickExisting(dosenColumns, [
        "id",
        "kode_dosen",
        "nik",
        "nip",
        "nama",
        "email",
        "password",
        "is_default_password",
      ]);
      const dosenWhere = [
        { kode_dosen: normalizedUsername.toUpperCase() },
        { email: normalizedUsername.toLowerCase() },
      ];
      if (dosenIdentifierColumn) {
        dosenWhere.push({ [dosenIdentifierColumn]: normalizedUsername });
      }

      user = await Dosen.findOne({
        where: {
          [Op.or]: dosenWhere,
        },
        ...(dosenAttributes.length ? { attributes: dosenAttributes } : {}),
      });
      if (user) {
        role = "dosen";
      }
    }

    // 4. Jika bukan dosen, cek apakah admin (NIP)
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

    if (role === "sekretaris_prodi" && !isAllowedSekretarisJabatan(user.jabatan)) {
      return res.status(403).json({
        success: false,
        message:
          "Akses sekretaris prodi ditolak. Akun ini tidak termasuk 2 akun sekretaris yang diizinkan.",
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
    } else if (role === "dosen") {
      tokenPayload.username = user.kode_dosen || user.nik || user.nip || user.email;
    } else if (role === "admin") {
      tokenPayload.username = user.nip;
    } else if (role === "sekretaris_prodi") {
      tokenPayload.username = user.nik || user.nip || user.email;
    }

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    const responseData = buildLoginResponse(user, role, token);

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

// POST /api/auth/login-mahasiswa-email
exports.loginMahasiswaByEmail = async (req, res) => {
  try {
    const email = (req.body?.email || "").trim().toLowerCase();
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email wajib diisi.",
      });
    }

    const mahasiswa = await Mahasiswa.findOne({ where: { email } });
    if (!mahasiswa) {
      return res.status(404).json({
        success: false,
        message: "Email mahasiswa tidak ditemukan.",
      });
    }

    const isDefaultPassword = await mahasiswa.comparePassword("12345678");
    if (!isDefaultPassword) {
      return res.status(403).json({
        success: false,
        message: "Password akun sudah diubah. Gunakan login biasa dengan username dan password.",
      });
    }

    const token = jwt.sign(
      {
        id: mahasiswa.id,
        role: "mahasiswa",
        username: mahasiswa.nim,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    const responseData = buildLoginResponse(mahasiswa, "mahasiswa", token);

    res.json({
      success: true,
      message: "Login mahasiswa via email berhasil.",
      data: responseData,
    });
  } catch (error) {
    console.error("Error di loginMahasiswaByEmail:", error);
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
    } else if (userRole === "sekretaris_prodi") {
      user = await SekretarisProdi.findByPk(userId);
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User tidak ditemukan",
      });
    }

    if (userRole === "sekretaris_prodi" && !isAllowedSekretarisJabatan(user.jabatan)) {
      return res.status(403).json({
        success: false,
        message: "Akses sekretaris prodi ditolak untuk akun ini.",
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
    } else if (userRole === "sekretaris_prodi") {
      user = await SekretarisProdi.findByPk(userId, {
        attributes: { exclude: ["password"] },
      });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User tidak ditemukan",
      });
    }

    if (userRole === "sekretaris_prodi" && !isAllowedSekretarisJabatan(user.jabatan)) {
      return res.status(403).json({
        success: false,
        message: "Akses sekretaris prodi ditolak untuk akun ini.",
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
