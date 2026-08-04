"use strict";

const crypto = require("crypto"); const bcrypt = require("bcrypt"); const { Op } = require("sequelize"); const db = require("../models");
const { recoveryEnabled, getDeliveryConfig } = require("../config/authSecurity");
const repository = require("./accountSecurityRepository"); const credentials = require("./credentialService"); const sessions = require("./authSessionService");

class RecoveryError extends Error { constructor(message, status, code, detail = null) { super(message); this.status = status; this.code = code; this.detail = detail; } }
const tokenHash = (raw) => crypto.createHash("sha256").update(raw).digest("hex");
const VERIFICATION_SOURCES = new Set(["official_academic_system", "institutional_directory", "manual_document_verification"]);
function assertEnabled() { if (!recoveryEnabled()) throw new RecoveryError("Pemulihan password belum diaktifkan.", 503, "AUTH_RECOVERY_DISABLED"); }
function encrypt(raw) { const config = getDeliveryConfig(); const iv = crypto.randomBytes(12); const cipher = crypto.createCipheriv("aes-256-gcm", config.key, iv); const encrypted = Buffer.concat([cipher.update(raw, "utf8"), cipher.final()]); return { ciphertext: encrypted.toString("base64"), encryption_iv: iv.toString("base64"), encryption_tag: cipher.getAuthTag().toString("base64"), key_version: config.keyVersion }; }
function decrypt(values) { const config = getDeliveryConfig(); if (values.key_version !== config.keyVersion) throw new RecoveryError("Versi key delivery tidak tersedia.", 500, "AUTH_DELIVERY_KEY_UNAVAILABLE"); const decipher = crypto.createDecipheriv("aes-256-gcm", config.key, Buffer.from(values.encryption_iv, "base64")); decipher.setAuthTag(Buffer.from(values.encryption_tag, "base64")); return Buffer.concat([decipher.update(Buffer.from(values.ciphertext, "base64")), decipher.final()]).toString("utf8"); }

async function createResetForAccount({ accountType, account, purpose, actor = null, reason = null, correlationId = crypto.randomUUID(), transaction }) {
  const now = new Date();
  await db.sequelize.query("SELECT pg_advisory_xact_lock(hashtext(:resetKey))", { replacements: { resetKey: `password-reset:${accountType}:${account.id}:${purpose}` }, transaction });
  const recent = await db.PasswordResetToken.findOne({ where: { account_type: accountType, account_id: account.id, purpose,
    used_at: null, revoked_at: null, expires_at: { [Op.gt]: now }, requested_at: { [Op.gt]: new Date(now.getTime() - 5 * 60000) } }, transaction, lock: transaction.LOCK.UPDATE });
  if (recent) return { tokenRecord: recent, replayed: true };
  await db.PasswordResetToken.update({ revoked_at: now, revoked_reason: "superseded" }, { where: { account_type: accountType, account_id: account.id, purpose, used_at: null, revoked_at: null }, transaction });
  const selector = crypto.randomBytes(12).toString("hex"); const secret = crypto.randomBytes(32).toString("base64url"); const raw = `${selector}.${secret}`;
  const tokenRecord = await db.PasswordResetToken.create({ id: crypto.randomUUID(), account_type: accountType, account_id: account.id, purpose,
    selector, token_hash: tokenHash(raw), requested_at: now, expires_at: new Date(now.getTime() + Math.max(10, Number(process.env.AUTH_RESET_EXPIRY_MINUTES || 30)) * 60000),
    correlation_id: correlationId, metadata: { actor_type: actor?.role || null, reason: reason || null } }, { transaction });
  const encrypted = encrypt(raw);
  await db.AuthOutbox.create({ id: crypto.randomUUID(), reset_token_id: tokenRecord.id, event_type: "password.reset.delivery",
    template_id: "password-reset", recipient_reference: String(account.email).toLowerCase(),
    correlation_id: correlationId, ...encrypted, status: "pending", available_at: now, metadata: { purpose } }, { transaction });
  await sessions.recordSecurityEvent({ event_type: actor ? "admin.reset_link.issued" : "password.reset.requested",
    actor_type: actor?.role || accountType, actor_id: actor?.id || account.id, target_type: accountType, target_id: account.id,
    correlation_id: correlationId, outcome: "success", reason_code: purpose }, transaction);
  return { tokenRecord, replayed: false };
}

async function requestForgot(email) {
  assertEnabled(); const normalized = String(email || "").trim().toLowerCase();
  return db.sequelize.transaction(async (transaction) => {
    const accounts = await repository.resolveRecoveryAccounts(normalized, transaction);
    const eligible = accounts.filter(({ accountType, account }) => account.recovery_email_verified_at && repository.isAccountLoginAllowed(accountType, account));
    if (eligible.length === 1) await createResetForAccount({ ...eligible[0], purpose: "self_reset", transaction });
    else await sessions.recordSecurityEvent({ event_type: "password.reset.requested", correlation_id: crypto.randomUUID(), outcome: "ignored",
      reason_code: eligible.length > 1 ? "RECOVERY_COLLISION" : "RECOVERY_UNAVAILABLE" }, transaction);
    return { accepted: true };
  });
}

async function issueAdminReset({ targetType, targetId, actor, reason }) {
  assertEnabled(); if (!new Set(["mahasiswa", "dosen"]).has(targetType)) throw new RecoveryError("Reset akun privileged tidak tersedia.", 403, "PRIVILEGED_ACCOUNT_RESET_UNAVAILABLE");
  if (!String(reason || "").trim()) throw new RecoveryError("Alasan reset wajib diisi.", 400, "ADMIN_RESET_REASON_REQUIRED");
  return db.sequelize.transaction(async (transaction) => {
    const account = await repository.resolveAccount({ accountType: targetType, accountId: targetId, transaction, lock: transaction.LOCK.UPDATE });
    if (!account) throw new RecoveryError("Target akun tidak ditemukan.", 404, "ACCOUNT_NOT_FOUND");
    if (!account.recovery_email_verified_at) throw new RecoveryError("Kanal pemulihan target belum diverifikasi.", 409, "ACCOUNT_RECOVERY_UNAVAILABLE");
    await sessions.revokeSessions(targetType, account.id, { reason: "admin_reset_link", actorType: actor.role, actorId: actor.id, transaction });
    const unusableHash = await bcrypt.hash(credentials.unusableInitialPassword(), Math.min(14, Math.max(10, Number(process.env.AUTH_BCRYPT_ROUNDS || 10))));
    await account.update({ password: unusableHash, credential_version: Number(account.credential_version || 1) + 1, credential_state: "default", is_default_password: true,
      password_origin: "admin_reset", force_change_reason: "admin_reset_link", security_updated_at: new Date(), security_updated_by_type: actor.role, security_updated_by_id: actor.id }, { transaction, hooks: false });
    return createResetForAccount({ accountType: targetType, account, purpose: "self_reset", actor, reason: String(reason).trim(), transaction });
  });
}

async function verifyRecoveryChannel({ targetType, targetId, actor, source, reason }) {
  if (!new Set(["mahasiswa", "dosen"]).has(targetType)) throw new RecoveryError("Verifikasi kanal akun privileged tidak tersedia.", 403, "PRIVILEGED_RECOVERY_VERIFICATION_UNAVAILABLE");
  if (!VERIFICATION_SOURCES.has(source)) throw new RecoveryError("Sumber verifikasi tidak valid.", 400, "RECOVERY_VERIFICATION_SOURCE_INVALID");
  if (String(reason || "").trim().length < 10) throw new RecoveryError("Catatan verifikasi minimal 10 karakter.", 400, "RECOVERY_VERIFICATION_REASON_REQUIRED");
  return db.sequelize.transaction(async transaction => {
    const account = await repository.resolveAccount({ accountType: targetType, accountId: targetId, transaction, lock: transaction.LOCK.UPDATE });
    if (!account?.email) throw new RecoveryError("Target tidak memiliki email pemulihan.", 409, "ACCOUNT_RECOVERY_UNAVAILABLE");
    const now = new Date();
    await account.update({ recovery_email_verified_at: now, recovery_email_verification_source: source, security_updated_at: now,
      security_updated_by_type: actor.role, security_updated_by_id: actor.id }, { transaction, hooks: false });
    await sessions.recordSecurityEvent({ event_type: "recovery.channel_verified", actor_type: actor.role, actor_id: actor.id,
      target_type: targetType, target_id: account.id, outcome: "success", reason_code: source, metadata: { reason: String(reason).trim() } }, transaction);
    return { verified_at: now, source };
  });
}

async function inspectToken(raw, { purpose = null, transaction = null, lock = null } = {}) {
  const [selector] = String(raw || "").split("."); if (!/^[a-f0-9]{24}$/.test(selector || "")) throw new RecoveryError("Token reset tidak valid.", 400, "RESET_TOKEN_INVALID");
  const record = await db.PasswordResetToken.findOne({ where: { selector }, transaction, ...(lock ? { lock } : {}) });
  if (!record || !crypto.timingSafeEqual(Buffer.from(record.token_hash, "hex"), Buffer.from(tokenHash(String(raw)), "hex"))) throw new RecoveryError("Token reset tidak valid.", 400, "RESET_TOKEN_INVALID");
  if (record.used_at) throw new RecoveryError("Token reset sudah digunakan.", 409, "RESET_TOKEN_USED");
  if (record.revoked_at) throw new RecoveryError("Token reset tidak valid.", 400, "RESET_TOKEN_INVALID");
  if (new Date(record.expires_at) <= new Date()) throw new RecoveryError("Token reset kedaluwarsa.", 410, "RESET_TOKEN_EXPIRED");
  if (purpose && record.purpose !== purpose) throw new RecoveryError("Token reset tidak valid.", 400, "RESET_TOKEN_INVALID");
  return record;
}

async function confirmReset(raw, newPassword) {
  assertEnabled(); return db.sequelize.transaction(async (transaction) => {
    const record = await inspectToken(raw, { transaction, lock: transaction.LOCK.UPDATE });
    await record.update({ attempt_count: Number(record.attempt_count || 0) + 1, last_attempted_at: new Date() }, { transaction });
    const account = await credentials.setPasswordFromReset({ resetRecord: record, newPassword, transaction }); const now = new Date();
    await record.update({ used_at: now }, { transaction });
    await db.PasswordResetToken.update({ revoked_at: now, revoked_reason: "reset_completed" }, { where: { account_type: record.account_type, account_id: record.account_id, id: { [Op.ne]: record.id }, used_at: null, revoked_at: null }, transaction });
    await sessions.recordSecurityEvent({ event_type: "password.reset.consumed", actor_type: record.account_type, actor_id: account.id,
      target_type: record.account_type, target_id: account.id, correlation_id: record.correlation_id, outcome: "success" }, transaction);
    return { success: true };
  });
}

module.exports = { RecoveryError, requestForgot, issueAdminReset,
  verifyRecoveryChannel, inspectToken, confirmReset, encrypt, decrypt, tokenHash, assertEnabled };
