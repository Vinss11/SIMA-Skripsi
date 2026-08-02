"use strict";

const bcrypt = require("bcrypt"); const crypto = require("crypto"); const db = require("../models");
const repository = require("./accountSecurityRepository"); const policy = require("./passwordPolicy");
const sessions = require("./authSessionService");

class CredentialError extends Error { constructor(message, status, code, detail = null) { super(message); this.status = status; this.code = code; this.detail = detail; } }
const rounds = Math.min(14, Math.max(10, Number(process.env.AUTH_BCRYPT_ROUNDS || 10)));
const unusableInitialPassword = () => crypto.randomBytes(48).toString("base64url");

async function changePassword({ accountType, accountId, currentPassword, newPassword, expectedCredentialVersion, role, capabilities = [], identityContext = {}, request = null }) {
  return db.sequelize.transaction(async (transaction) => {
    const account = await repository.resolveAccount({ accountType, accountId, transaction, lock: transaction.LOCK.UPDATE });
    if (!account) throw new CredentialError("Akun tidak ditemukan.", 404, "ACCOUNT_NOT_FOUND");
    if (Number(account.credential_version || 1) !== Number(expectedCredentialVersion)) throw new CredentialError("Sesi telah dicabut.", 401, "SESSION_REVOKED");
    if (!await bcrypt.compare(currentPassword, account.password)) throw new CredentialError("Password lama tidak sesuai.", 401, "INVALID_CURRENT_PASSWORD");
    const currentMatches = await bcrypt.compare(newPassword, account.password);
    const validation = policy.validateNewPassword(newPassword, { identifiers: repository.identifiers(accountType, account), currentMatches });
    if (!validation.valid) throw new CredentialError("Password baru tidak memenuhi kebijakan keamanan.", 400, "PASSWORD_POLICY_VIOLATION", { reasons: validation.reasons });
    const now = new Date(); const nextVersion = Number(account.credential_version || 1) + 1;
    const hashed = await bcrypt.hash(newPassword, rounds);
    await account.update({ password: hashed, credential_state: "active", credential_version: nextVersion, is_default_password: false,
      password_changed_at: now, password_origin: "self_change", force_change_reason: null, security_updated_at: now,
      security_updated_by_type: accountType, security_updated_by_id: account.id }, { transaction, hooks: false });
    await sessions.revokeSessions(accountType, account.id, { reason: "password_changed", actorType: accountType, actorId: account.id, transaction });
    if (db.PasswordResetToken) await db.PasswordResetToken.update({ revoked_at: now, revoked_reason: "password_changed" }, { where: { account_type: accountType, account_id: account.id, used_at: null, revoked_at: null }, transaction });
    await sessions.recordSecurityEvent({ event_type: "password.changed", actor_type: accountType, actor_id: account.id,
      target_type: accountType, target_id: account.id, outcome: "success", reason_code: "SELF_CHANGE" }, transaction);
    const issued = await sessions.issueSession({ accountType, account, role, capabilities, identityContext, request, transaction });
    return { account, token: issued.token, session: issued.session };
  });
}

async function setPasswordFromReset({ resetRecord, newPassword, request = null, transaction }) {
  const account = await repository.resolveAccount({ accountType: resetRecord.account_type, accountId: resetRecord.account_id, transaction, lock: transaction.LOCK.UPDATE });
  if (!account || !repository.isAccountLoginAllowed(resetRecord.account_type, account)) throw new CredentialError("Token reset tidak valid.", 400, "RESET_TOKEN_INVALID");
  const validation = policy.validateNewPassword(newPassword, { identifiers: repository.identifiers(resetRecord.account_type, account), currentMatches: await bcrypt.compare(newPassword, account.password) });
  if (!validation.valid) throw new CredentialError("Password baru tidak memenuhi kebijakan keamanan.", 400, "PASSWORD_POLICY_VIOLATION", { reasons: validation.reasons });
  const now = new Date(); const hashed = await bcrypt.hash(newPassword, rounds);
  await account.update({ password: hashed, credential_state: "active", credential_version: Number(account.credential_version || 1) + 1,
    is_default_password: false, password_changed_at: now, password_origin: "self_reset", force_change_reason: null,
    security_updated_at: now, security_updated_by_type: "self_reset", security_updated_by_id: account.id }, { transaction, hooks: false });
  await sessions.revokeSessions(resetRecord.account_type, account.id, { reason: "password_reset", actorType: resetRecord.account_type, actorId: account.id, transaction });
  return account;
}

module.exports = { CredentialError, changePassword, setPasswordFromReset, unusableInitialPassword };
