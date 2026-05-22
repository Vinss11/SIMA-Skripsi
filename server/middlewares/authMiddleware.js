const jwt = require("jsonwebtoken");
const { SekretarisProdi } = require("../models");
const { isAllowedSekretarisJabatan } = require("../constants/sekretarisAkses");

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

exports.authenticateToken = (req, res, next) => {
  try {
    // Ambil token dari header Authorization
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1]; // Format: Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Token tidak ditemukan, silakan login terlebih dahulu",
      });
    }

    // Verifikasi token
    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        return res.status(403).json({
          success: false,
          message: "Token tidak valid atau sudah kadaluarsa",
        });
      }

      // Simpan data user ke request
      req.user = user;
      next();
    });
  } catch (error) {
    console.error("Error di authenticateToken:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
    });
  }
};

// Middleware untuk memeriksa role tertentu
// Mendukung: 'mahasiswa', 'dosen', 'admin', 'sekretaris_prodi'
exports.authorizeRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({
        success: false,
        message: "Role tidak ditemukan dalam token",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Akses ditolak. Hanya ${roles.join(", ")} yang diizinkan`,
      });
    }

    next();
  };
};

// Middleware khusus untuk membatasi akses sekretaris prodi ke 2 akun resmi saja
exports.authorizeSekretarisAccess = async (req, res, next) => {
  try {
    if (!req.user || req.user.role !== "sekretaris_prodi") {
      return res.status(403).json({
        success: false,
        message: "Akses ditolak. Hanya sekretaris prodi yang diizinkan.",
      });
    }

    const sekretaris = await SekretarisProdi.findByPk(req.user.id, {
      attributes: ["id", "jabatan"],
    });

    if (!sekretaris || !isAllowedSekretarisJabatan(sekretaris.jabatan)) {
      return res.status(403).json({
        success: false,
        message: "Akses sekretaris prodi ditolak. Akun ini tidak termasuk 2 akun resmi.",
      });
    }

    next();
  } catch (error) {
    console.error("Error di authorizeSekretarisAccess:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
    });
  }
};
