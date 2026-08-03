"use strict";

const db = require("../models");
const repository = require("../services/accountSecurityRepository");
const sessions = require("../services/authSessionService");
const credentials = require("../services/credentialService");
const recovery = require("../services/passwordRecoveryService");
const rateLimit = require("../services/authRateLimitService");
const {
  isAllowedSekretarisJabatan,
  resolveProgramKuliahFromJabatan,
} = require("../constants/sekretarisAkses");
const { getDosenStatusDecision } = require("../services/dosenStatusPolicy");

function capabilitiesFor(accountType, account) {
  return accountType === "dosen" && isAllowedSekretarisJabatan(account?.jabatan_struktural)
    ? ["sekretaris_prodi"]
    : [];
}

function publicUser(accountType, account) {
  const user = {
    id: account.id,
    username: accountType === "mahasiswa" ? account.nim
      : accountType === "dosen" ? (account.nik || account.kode_dosen || account.email)
      : accountType === "sekretaris_prodi" ? (account.nik || account.email)
      : account.nip,
    nama: account.nama,
    email: account.email,
    role: accountType,
  };
  if (accountType === "admin") user.admin_role = account.role;
  if (accountType === "dosen") {
    user.jabatan_struktural = account.jabatan_struktural || null;
    user.capabilities = capabilitiesFor(accountType, account);
    if (user.capabilities.includes("sekretaris_prodi")) {
      user.jabatan = account.jabatan_struktural;
      user.program_kuliah = resolveProgramKuliahFromJabatan(account.jabatan_struktural);
    }
  }
  if (accountType === "sekretaris_prodi") {
    user.jabatan = account.jabatan || "Sekretaris Prodi";
    user.program_kuliah = resolveProgramKuliahFromJabatan(account.jabatan);
  }
  return user;
}

function loginData(accountType, account, issued, identityAlias = null) {
  const state = repository.credentialState(account);
  const user = publicUser(accountType, account);
  if (identityAlias?.sekretarisProdiId) user.sekretaris_prodi_id = identityAlias.sekretarisProdiId;
  return {
    token: issued.token,
    user,
    credential_state: state,
    credential_version: Number(account.credential_version || 1),
    next_action: ["default", "temporary"].includes(state) ? "change_password" : null,
    prompt_change_password: ["default", "temporary"].includes(state),
    session: { id: issued.session.id, expires_at: issued.session.absolute_expires_at },
  };
}

function sendError(res, error, context) {
  if (error?.status) {
    return res.status(error.status).json({ success: false, message: error.message, code: error.code, ...(error.detail ? { detail: error.detail } : {}) });
  }
  console.error(`Error di ${context}:`, error);
  return res.status(500).json({ success: false, message: "Terjadi kesalahan pada server", code: "INTERNAL_ERROR" });
}

exports.login = async (req, res) => {
  try {
    const username = String(req.body?.username || "").trim();
    const password = req.body?.password;
    if (!username || typeof password !== "string" || password.length === 0) {
      return res.status(400).json({ success: false, message: "Username dan password harus diisi", code: "LOGIN_INPUT_REQUIRED" });
    }
    await rateLimit.consume("login_ip", req.ip || req.socket?.remoteAddress, { limit: 30 });
    await rateLimit.consume("login_identifier", username, { limit: 10 });
    let resolved = null;
    try {
      resolved = await repository.resolveAccountByLoginIdentifier(username);
    } catch (error) {
      if (error?.code !== "IDENTIFIER_AMBIGUOUS") throw error;
      await sessions.recordSecurityEvent({ event_type: "auth.login", outcome: "failed", reason_code: "IDENTIFIER_AMBIGUOUS",
        metadata: { identifier_hash: rateLimit.hash(username), account_types: error.detail?.account_types || [] } });
      return res.status(401).json({ success: false, message: "Username atau password salah", code: "INVALID_CREDENTIALS" });
    }
    const valid = resolved && await resolved.account.comparePassword(password);
    if (!valid) {
      await sessions.recordSecurityEvent({ event_type: "auth.login", target_type: resolved?.accountType || null,
        target_id: resolved?.account?.id || null, outcome: "failed", reason_code: "INVALID_CREDENTIALS",
        metadata: { identifier_hash: rateLimit.hash(username) } });
      return res.status(401).json({ success: false, message: "Username atau password salah", code: "INVALID_CREDENTIALS" });
    }
    const { accountType, account } = resolved;
    if (accountType === "sekretaris_prodi" && !isAllowedSekretarisJabatan(account.jabatan)) {
      await sessions.recordSecurityEvent({ event_type: "auth.login", target_type: accountType, target_id: account.id, outcome: "denied", reason_code: "ACCOUNT_ACCESS_DENIED" });
      return res.status(403).json({ success: false, message: "Akses akun tidak diizinkan.", code: "ACCOUNT_ACCESS_DENIED" });
    }
    if (!repository.isAccountLoginAllowed(accountType, account)) {
      await sessions.recordSecurityEvent({ event_type: "auth.login", target_type: accountType, target_id: account.id, outcome: "denied", reason_code: "ACCOUNT_DISABLED" });
      return res.status(403).json({ success: false, message: "Akun dinonaktifkan. Hubungi Admin Prodi.", code: "ACCOUNT_DISABLED" });
    }
    if (accountType === "dosen") {
      const decision = getDosenStatusDecision({ statusKeaktifan: account.status_keaktifan, accountIsActive: account.account_is_active,
        continueExistingSupervision: account.continue_existing_supervision });
      if (!decision.can_login) return res.status(403).json({ success: false, message: "Akun dinonaktifkan. Hubungi Admin Prodi.", code: "ACCOUNT_DISABLED" });
    }
    const capabilities = capabilitiesFor(accountType, account);
    const identityContext = resolved.identityAlias?.sekretarisProdiId
      ? { sekretaris_prodi_id: resolved.identityAlias.sekretarisProdiId, identity_alias: resolved.identityAlias.classification }
      : {};
    const issued = await sessions.issueSession({ accountType, account, role: accountType, capabilities, identityContext,
      rememberMe: Boolean(req.body?.remember_me), request: req });
    if (resolved.identityAlias) {
      await sessions.recordSecurityEvent({ event_type: "auth.identity_resolution", actor_type: accountType, actor_id: account.id,
        target_type: accountType, target_id: account.id, session_id: issued.session.id, outcome: "success", reason_code: "IDENTITY_ALIAS_RESOLVED",
        metadata: { identifier_hash: rateLimit.hash(username), account_types: resolved.identityAlias.accountTypes,
          sekretaris_prodi_id: resolved.identityAlias.sekretarisProdiId } });
    }
    await sessions.recordSecurityEvent({ event_type: "auth.login", actor_type: accountType, actor_id: account.id,
      target_type: accountType, target_id: account.id, session_id: issued.session.id, outcome: "success" });
    return res.json({ success: true, message: "Login berhasil", data: loginData(accountType, account, issued, resolved.identityAlias) });
  } catch (error) { return sendError(res, error, "login"); }
};

exports.changePassword = async (req, res) => {
  try {
    const currentPassword = req.body?.current_password ?? req.body?.oldPassword;
    const newPassword = req.body?.new_password ?? req.body?.newPassword;
    if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
      return res.status(400).json({ success: false, message: "Password lama dan password baru harus diisi", code: "PASSWORD_INPUT_REQUIRED" });
    }
    await rateLimit.consume("change_password_account", `${req.user.account_type}:${req.user.id}`, { limit: 8 });
    const result = await credentials.changePassword({ accountType: req.user.account_type, accountId: req.user.id,
      currentPassword, newPassword, expectedCredentialVersion: req.user.credential_version, role: req.user.role,
      capabilities: req.user.capabilities, identityContext: req.user.sekretaris_prodi_id
        ? { sekretaris_prodi_id: req.user.sekretaris_prodi_id, identity_alias: "valid_identity_alias" }
        : {}, request: req });
    return res.json({ success: true, message: "Password berhasil diubah", data: loginData(req.user.account_type, result.account, { token: result.token, session: result.session }) });
  } catch (error) { return sendError(res, error, "changePassword"); }
};

exports.logout = async (req, res) => {
  try {
    await sessions.revokeCurrent(req.user.session_id, req.user);
    await sessions.recordSecurityEvent({ event_type: "auth.logout", actor_type: req.user.account_type, actor_id: req.user.id,
      target_type: req.user.account_type, target_id: req.user.id, session_id: req.user.session_id, outcome: "success" });
    return res.json({ success: true, message: "Logout berhasil" });
  } catch (error) { return sendError(res, error, "logout"); }
};

exports.logoutAll = async (req, res) => {
  try {
    await sessions.revokeSessions(req.user.account_type, req.user.id, { reason: "logout_all", actorType: req.user.account_type, actorId: req.user.id });
    await sessions.recordSecurityEvent({ event_type: "auth.logout_all", actor_type: req.user.account_type, actor_id: req.user.id,
      target_type: req.user.account_type, target_id: req.user.id, session_id: req.user.session_id, outcome: "success" });
    return res.json({ success: true, message: "Semua sesi berhasil dikeluarkan" });
  } catch (error) { return sendError(res, error, "logoutAll"); }
};

exports.listSessions = async (req, res) => {
  try {
    const rows = await db.AuthSession.findAll({ where: { account_type: req.user.account_type, account_id: req.user.id, revoked_at: null },
      attributes: ["id", "last_used_at", "absolute_expires_at", "idle_expires_at", "createdAt"], order: [["last_used_at", "DESC"]] });
    return res.json({ success: true, data: rows.map((row) => ({ ...row.toJSON(), current: row.id === req.user.session_id })) });
  } catch (error) { return sendError(res, error, "listSessions"); }
};

exports.revokeSession = async (req, res) => {
  try {
    const [count] = await db.AuthSession.update({ revoked_at: new Date(), revoked_reason: "user_revoked", revoked_by_type: req.user.account_type,
      revoked_by_id: req.user.id }, { where: { id: req.params.sessionId, account_type: req.user.account_type, account_id: req.user.id, revoked_at: null } });
    if (!count) return res.status(404).json({ success: false, message: "Sesi tidak ditemukan", code: "SESSION_NOT_FOUND" });
    return res.json({ success: true, message: "Sesi berhasil dicabut" });
  } catch (error) { return sendError(res, error, "revokeSession"); }
};

exports.forgotPassword = async (req, res) => {
  try {
    await rateLimit.consume("forgot_ip", req.ip || req.socket?.remoteAddress, { limit: 10, windowMs: 60 * 60 * 1000 });
    await rateLimit.consume("forgot_identifier", req.body?.email, { limit: 5, windowMs: 60 * 60 * 1000 });
    await recovery.requestForgot(req.body?.email);
    return res.status(202).json({ success: true, message: "Jika akun memenuhi syarat, instruksi pemulihan akan dikirim." });
  } catch (error) { return sendError(res, error, "forgotPassword"); }
};

exports.validateResetToken = async (req, res) => {
  try { await rateLimit.consume("reset_validate_ip", req.ip || req.socket?.remoteAddress, { limit: 20 }); await recovery.assertEnabled(); await recovery.inspectToken(req.body?.token); return res.json({ success: true, data: { valid: true } }); }
  catch (error) { return sendError(res, error, "validateResetToken"); }
};

exports.confirmResetPassword = async (req, res) => {
  try {
    await rateLimit.consume("reset_ip", req.ip || req.socket?.remoteAddress, { limit: 10 });
    await recovery.confirmReset(req.body?.token, req.body?.new_password);
    return res.json({ success: true, message: "Password berhasil diatur. Silakan login kembali." });
  } catch (error) { return sendError(res, error, "confirmResetPassword"); }
};

exports.issueAdminReset = async (req, res) => {
  try {
    await rateLimit.consume("admin_reset_actor", `${req.user.account_type}:${req.user.id}`, { limit: 20, windowMs: 60 * 60 * 1000 });
    const result = await recovery.issueAdminReset({ targetType: req.params.accountType, targetId: Number(req.params.accountId), actor: req.user, reason: req.body?.reason });
    return res.status(result.replayed ? 200 : 202).json({ success: true, message: "Tautan reset dijadwalkan untuk dikirim.", data: { replayed: result.replayed } });
  } catch (error) { return sendError(res, error, "issueAdminReset"); }
};

exports.issueAdminActivation = async (req, res) => {
  try {
    await rateLimit.consume("admin_reset_actor", `${req.user.account_type}:${req.user.id}`, { limit: 20, windowMs: 60 * 60 * 1000 });
    const result = await recovery.issueAdminActivation({ targetType: req.params.accountType, targetId: Number(req.params.accountId),
      actor: req.user, reason: req.body?.reason });
    return res.status(result.replayed ? 200 : 202).json({ success: true,
      message: "Tautan aktivasi dijadwalkan untuk dikirim.", data: { replayed: result.replayed } });
  } catch (error) { return sendError(res, error, "issueAdminActivation"); }
};

exports.verifyRecoveryChannel = async (req, res) => {
  try {
    const data = await recovery.verifyRecoveryChannel({ targetType: req.params.accountType, targetId: Number(req.params.accountId), actor: req.user,
      source: req.body?.source, reason: req.body?.reason });
    return res.json({ success: true, message: "Kanal pemulihan berhasil diverifikasi.", data });
  } catch (error) { return sendError(res, error, "verifyRecoveryChannel"); }
};

exports.getProfile = async (req, res) => {
  try {
    const account = await repository.resolveAccount({ accountType: req.user.account_type, accountId: req.user.id });
    if (!account) return res.status(404).json({ success: false, message: "User tidak ditemukan", code: "ACCOUNT_NOT_FOUND" });
    return res.json({ success: true, data: { user: publicUser(req.user.account_type, account), credential_state: repository.credentialState(account) } });
  } catch (error) { return sendError(res, error, "getProfile"); }
};

exports._private = { publicUser, loginData, capabilitiesFor };
