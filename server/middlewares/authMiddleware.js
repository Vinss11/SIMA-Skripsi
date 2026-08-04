"use strict";

const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");
const db = require("../models");
const { getJwtConfig } = require("../config/authSecurity");
const repository = require("../services/accountSecurityRepository");
const { isAllowedSekretarisJabatan, resolveProgramKuliahFromJabatan } = require("../constants/sekretarisAkses");

function deny(res, status, message, code) { return res.status(status).json({ success: false, message, code }); }

function middleware({ allowDuringRestriction = false } = {}) {
  return async (req, res, next) => {
    try {
      const header = req.headers.authorization;
      const match = typeof header === "string" && header.match(/^Bearer\s+([^\s]+)$/i);
      if (!match) return deny(res, 401, "Token tidak ditemukan, silakan login terlebih dahulu", "AUTH_TOKEN_REQUIRED");
      const config = getJwtConfig();
      let claims;
      try {
        claims = jwt.verify(match[1], config.secret, { algorithms: [config.algorithm], issuer: config.issuer, audience: config.audience });
      } catch (_) { return deny(res, 401, "Token tidak valid atau sudah kedaluwarsa", "AUTH_TOKEN_INVALID"); }
      const subject = String(claims.sub || "").match(/^(mahasiswa|dosen|admin|sekretaris_prodi):(\d+)$/);
      if (!subject || !claims.sid || !Number.isInteger(claims.cv) || !claims.jti || !claims.role) {
        return deny(res, 401, "Token tidak memiliki konteks sesi yang valid", "AUTH_TOKEN_INVALID");
      }
      const accountType = subject[1]; const accountId = Number(subject[2]); const now = new Date();
      const [account, session] = await Promise.all([
        repository.resolveAccount({ accountType, accountId }),
        db.AuthSession.findOne({ where: { id: claims.sid, account_type: accountType, account_id: accountId } }),
      ]);
      if (!account || !repository.isAccountLoginAllowed(accountType, account)) return deny(res, 401, "Akun tidak tersedia atau dinonaktifkan", "ACCOUNT_DISABLED");
      if (!session || session.revoked_at || new Date(session.absolute_expires_at) <= now || new Date(session.idle_expires_at) <= now) {
        return deny(res, 401, "Sesi telah berakhir atau dicabut", "SESSION_REVOKED");
      }
      const version = Number(account.credential_version || 1);
      if (version !== Number(claims.cv) || version !== Number(session.credential_version) || session.role_snapshot?.role !== claims.role) {
        return deny(res, 401, "Sesi telah berakhir atau dicabut", "SESSION_REVOKED");
      }
      const capabilities = Array.isArray(session.role_snapshot?.capabilities) ? session.role_snapshot.capabilities : [];
      req.user = { id: accountId, role: claims.role, account_type: accountType, username: claims.username,
        capabilities, session_id: session.id, credential_version: version, credential_state: repository.credentialState(account),
        sekretaris_prodi_id: session.role_snapshot?.sekretaris_prodi_id || null };
      if (!allowDuringRestriction && ["default", "temporary"].includes(req.user.credential_state)) {
        return deny(res, 403, "Password wajib diubah sebelum mengakses fitur lain", "PASSWORD_CHANGE_REQUIRED");
      }
      // Avoid a write for every API call while retaining a reliable idle window.
      if (!session.last_used_at || now - new Date(session.last_used_at) >= 60 * 1000) {
        await session.update({ last_used_at: now, idle_expires_at: new Date(Math.min(
          new Date(session.absolute_expires_at).getTime(),
          now.getTime() + Math.max(15, Number(process.env.AUTH_SESSION_IDLE_MINUTES || 720)) * 60000
        )) });
      }
      next();
    } catch (error) {
      console.error("Error di authenticateToken:", error);
      return deny(res, 500, "Terjadi kesalahan saat memvalidasi sesi", "AUTH_VALIDATION_ERROR");
    }
  };
}

exports.authenticateToken = middleware();
exports.authenticateRestrictedAllowed = middleware({ allowDuringRestriction: true });

exports.authorizeRole = (...roles) => (req, res, next) => {
  if (!req.user?.role) return deny(res, 403, "Role tidak ditemukan dalam sesi", "ROLE_REQUIRED");
  const effective = new Set([req.user.role, ...(req.user.capabilities || [])]);
  if (!roles.some((role) => effective.has(role))) return deny(res, 403, `Akses ditolak. Hanya ${roles.join(", ")} yang diizinkan`, "ROLE_FORBIDDEN");
  next();
};

exports.authorizeSekretarisAccess = async (req, res, next) => {
  try {
    if (!req.user || !["sekretaris_prodi", "dosen"].includes(req.user.role)) return deny(res, 403, "Akses ditolak. Hanya sekretaris prodi yang diizinkan.", "ROLE_FORBIDDEN");
    if (req.user.role === "dosen") {
      const dosen = await db.Dosen.findByPk(req.user.id, { attributes: ["id", "nik", "email", "jabatan_struktural"] });
      if (!dosen || !isAllowedSekretarisJabatan(dosen.jabatan_struktural)) return deny(res, 403, "Dosen tidak sedang menjabat sebagai sekretaris prodi.", "SEKRETARIS_ACCESS_DENIED");
      const linked = await db.SekretarisProdi.findOne({ where: { [Op.or]: [{ nik: dosen.nik || "__none__" }, { email: String(dosen.email || "").toLowerCase() }] }, attributes: ["id"] });
      req.user.sekretaris_prodi_id = linked?.id || null;
      req.user.sekretaris_jabatan = dosen.jabatan_struktural;
      req.user.program_kuliah = resolveProgramKuliahFromJabatan(dosen.jabatan_struktural);
    } else {
      const sekretaris = await db.SekretarisProdi.findByPk(req.user.id, { attributes: ["id", "jabatan"] });
      if (!sekretaris || !isAllowedSekretarisJabatan(sekretaris.jabatan)) return deny(res, 403, "Akun bukan sekretaris prodi resmi.", "SEKRETARIS_ACCESS_DENIED");
      req.user.sekretaris_prodi_id = sekretaris.id;
      req.user.sekretaris_jabatan = sekretaris.jabatan;
      req.user.program_kuliah = resolveProgramKuliahFromJabatan(sekretaris.jabatan);
    }
    if (!req.user.program_kuliah) return deny(res, 403, "Program Sekretaris Prodi tidak dapat ditentukan.", "SEKRETARIS_PROGRAM_UNRESOLVED");
    next();
  } catch (error) {
    console.error("Error di authorizeSekretarisAccess:", error);
    return deny(res, 500, "Terjadi kesalahan pada server", "INTERNAL_ERROR");
  }
};
