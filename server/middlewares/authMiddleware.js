const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");
const { Dosen, SekretarisProdi } = require("../models");
const {
  isAllowedSekretarisJabatan,
  resolveProgramKuliahFromJabatan,
} = require("../constants/sekretarisAkses");

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

    const capabilities = Array.isArray(req.user.capabilities) ? req.user.capabilities : [];
    const effectiveRoles = new Set([req.user.role, ...capabilities]);
    if (req.user.role === "dosen" && roles.includes("sekretaris_prodi")) {
      effectiveRoles.add("sekretaris_prodi");
    }

    const hasAllowedRole = roles.some((role) => effectiveRoles.has(role));
    if (!hasAllowedRole) {
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
    if (!req.user || !["sekretaris_prodi", "dosen"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Akses ditolak. Hanya sekretaris prodi yang diizinkan.",
      });
    }

    if (req.user.role === "dosen") {
      const dosen = await Dosen.findByPk(req.user.id, {
        attributes: ["id", "nik", "email", "jabatan_struktural"],
      });

      if (!dosen || !isAllowedSekretarisJabatan(dosen.jabatan_struktural)) {
        return res.status(403).json({
          success: false,
          message: "Akses sekretaris prodi ditolak. Dosen ini tidak sedang menjabat sebagai sekretaris prodi.",
        });
      }

      const sekretarisWhere = [];
      if (dosen.nik) sekretarisWhere.push({ nik: dosen.nik });
      if (dosen.email) sekretarisWhere.push({ email: String(dosen.email).toLowerCase() });
      const linkedSekretaris = sekretarisWhere.length > 0
        ? await SekretarisProdi.findOne({
            where: { [Op.or]: sekretarisWhere },
            attributes: ["id"],
          })
        : null;

      const programKuliah = resolveProgramKuliahFromJabatan(dosen.jabatan_struktural);
      if (!programKuliah) {
        return res.status(403).json({
          success: false,
          message: "Program Sekretaris Prodi tidak dapat ditentukan dari jabatan struktural.",
        });
      }

      req.user.sekretaris_prodi_id = linkedSekretaris?.id || null;
      req.user.sekretaris_jabatan = dosen.jabatan_struktural;
      req.user.program_kuliah = programKuliah;
      return next();
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

    const programKuliah = resolveProgramKuliahFromJabatan(sekretaris.jabatan);
    if (!programKuliah) {
      return res.status(403).json({
        success: false,
        message: "Program Sekretaris Prodi tidak dapat ditentukan dari jabatan.",
      });
    }

    req.user.sekretaris_prodi_id = sekretaris.id;
    req.user.sekretaris_jabatan = sekretaris.jabatan;
    req.user.program_kuliah = programKuliah;
    next();
  } catch (error) {
    console.error("Error di authorizeSekretarisAccess:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
    });
  }
};
