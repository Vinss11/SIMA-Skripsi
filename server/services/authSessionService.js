"use strict";

const crypto = require("crypto"); const jwt = require("jsonwebtoken"); const { Op } = require("sequelize");
const db = require("../models"); const { getJwtConfig, getRefreshJwtConfig } = require("../config/authSecurity");
const repository = require("./accountSecurityRepository");

const fingerprint = (value) => value ? crypto.createHash("sha256").update(String(value)).digest("hex") : null;
const absoluteHours = Math.max(1, Number(process.env.AUTH_SESSION_HOURS || 12));
const idleMinutes = Math.max(15, Number(process.env.AUTH_SESSION_IDLE_MINUTES || 720));

function signAccessToken({ accountType, accountId, session, role, capabilities = [] }) {
  const config = getJwtConfig();
  return jwt.sign({ role, sid: session.id, cv: Number(session.credential_version), jti: crypto.randomUUID(), capabilities }, config.secret,
    { algorithm: config.algorithm, issuer: config.issuer, audience: config.audience, subject: `${accountType}:${accountId}`, expiresIn: config.expiresIn });
}

function signRefreshToken({ accountType, accountId, session }) {
  const config = getRefreshJwtConfig();
  return jwt.sign({ sid: session.id, cv: Number(session.credential_version), jti: crypto.randomUUID(), token_use: "refresh" }, config.secret,
    { algorithm: config.algorithm, issuer: config.issuer, audience: config.audience, subject: `${accountType}:${accountId}`, expiresIn: config.expiresIn });
}

async function recordSecurityEvent(values, transaction = null) {
  return db.AuthSecurityEvent.create({ id: crypto.randomUUID(), correlation_id: values.correlation_id || crypto.randomUUID(), outcome: values.outcome || "success", metadata: {}, ...values }, { transaction });
}

async function issueSession({ accountType, account, role, capabilities = [], identityContext = {}, rememberMe = false, request = null, transaction = null }) {
  const now = new Date(); const sid = crypto.randomUUID();
  const session = await db.AuthSession.create({ id: sid, account_type: accountType, account_id: account.id,
    role_snapshot: { role, capabilities, ...identityContext }, credential_version: Number(account.credential_version || 1), last_used_at: now,
    absolute_expires_at: new Date(now.getTime() + absoluteHours * 3600000), idle_expires_at: new Date(now.getTime() + idleMinutes * 60000),
    ip_fingerprint: fingerprint(request?.ip || request?.socket?.remoteAddress), user_agent_fingerprint: fingerprint(request?.headers?.["user-agent"]), remember_me: rememberMe,
  }, { transaction });
  const token = signAccessToken({ accountType, accountId: account.id, session, role, capabilities });
  const refreshToken = signRefreshToken({ accountType, accountId: account.id, session });
  return { session, token, refreshToken };
}

async function resumeSession(refreshToken, request = null) {
  const config = getRefreshJwtConfig();
  let claims;
  try {
    claims = jwt.verify(String(refreshToken || ""), config.secret, { algorithms: [config.algorithm], issuer: config.issuer, audience: config.audience });
  } catch (_) {
    return null;
  }
  const subject = String(claims.sub || "").match(/^(mahasiswa|dosen|admin|sekretaris_prodi):(\d+)$/);
  if (!subject || claims.token_use !== "refresh" || !claims.sid || !Number.isInteger(claims.cv) || !claims.jti) return null;
  const accountType = subject[1]; const accountId = Number(subject[2]); const now = new Date();
  const [account, session] = await Promise.all([
    repository.resolveAccount({ accountType, accountId }),
    db.AuthSession.findOne({ where: { id: claims.sid, account_type: accountType, account_id: accountId } }),
  ]);
  if (!account || !repository.isAccountLoginAllowed(accountType, account) || !session || session.revoked_at
    || new Date(session.absolute_expires_at) <= now || new Date(session.idle_expires_at) <= now) return null;
  const version = Number(account.credential_version || 1);
  if (version !== Number(claims.cv) || version !== Number(session.credential_version)) return null;
  const role = session.role_snapshot?.role;
  if (!role) return null;
  const capabilities = Array.isArray(session.role_snapshot?.capabilities) ? session.role_snapshot.capabilities : [];
  const nextIdleExpiry = new Date(Math.min(
    new Date(session.absolute_expires_at).getTime(),
    now.getTime() + idleMinutes * 60000
  ));
  await session.update({ last_used_at: now, idle_expires_at: nextIdleExpiry,
    ip_fingerprint: fingerprint(request?.ip || request?.socket?.remoteAddress),
    user_agent_fingerprint: fingerprint(request?.headers?.["user-agent"]) });
  return {
    accountType,
    account,
    session,
    token: signAccessToken({ accountType, accountId, session, role, capabilities }),
    refreshToken: signRefreshToken({ accountType, accountId, session }),
  };
}

async function revokeSessions(accountType, accountId, { reason = "security_change", actorType = null, actorId = null, exceptSessionId = null, transaction = null } = {}) {
  const where = { account_type: accountType, account_id: accountId, revoked_at: null };
  if (exceptSessionId) where.id = { [Op.ne]: exceptSessionId };
  return db.AuthSession.update({ revoked_at: new Date(), revoked_reason: reason, revoked_by_type: actorType, revoked_by_id: actorId }, { where, transaction });
}

async function revokeCurrent(sessionId, actor, transaction = null) {
  if (!sessionId) return 0;
  const [count] = await db.AuthSession.update({ revoked_at: new Date(), revoked_reason: "logout", revoked_by_type: actor?.role, revoked_by_id: actor?.id }, { where: { id: sessionId, revoked_at: null }, transaction });
  return count;
}

module.exports = { issueSession, resumeSession, revokeSessions, revokeCurrent, recordSecurityEvent, fingerprint };
