"use strict";

const crypto = require("crypto"); const jwt = require("jsonwebtoken"); const { Op } = require("sequelize");
const db = require("../models"); const { getJwtConfig } = require("../config/authSecurity");

const fingerprint = (value) => value ? crypto.createHash("sha256").update(String(value)).digest("hex") : null;
const accessMinutes = Math.max(5, Number(process.env.JWT_ACCESS_MINUTES || 15));
const absoluteHours = Math.max(1, Number(process.env.AUTH_SESSION_HOURS || 12));
const idleMinutes = Math.max(accessMinutes, Number(process.env.AUTH_SESSION_IDLE_MINUTES || 60));

async function recordSecurityEvent(values, transaction = null) {
  return db.AuthSecurityEvent.create({ id: crypto.randomUUID(), correlation_id: values.correlation_id || crypto.randomUUID(), outcome: values.outcome || "success", metadata: {}, ...values }, { transaction });
}

async function issueSession({ accountType, account, role, capabilities = [], identityContext = {}, rememberMe = false, request = null, transaction = null }) {
  const now = new Date(); const sid = crypto.randomUUID(); const jti = crypto.randomUUID();
  const session = await db.AuthSession.create({ id: sid, account_type: accountType, account_id: account.id,
    role_snapshot: { role, capabilities, ...identityContext }, credential_version: Number(account.credential_version || 1), last_used_at: now,
    absolute_expires_at: new Date(now.getTime() + absoluteHours * 3600000), idle_expires_at: new Date(now.getTime() + idleMinutes * 60000),
    ip_fingerprint: fingerprint(request?.ip || request?.socket?.remoteAddress), user_agent_fingerprint: fingerprint(request?.headers?.["user-agent"]), remember_me: rememberMe,
  }, { transaction });
  const config = getJwtConfig();
  const token = jwt.sign({ role, sid, cv: Number(account.credential_version || 1), jti, capabilities }, config.secret,
    { algorithm: config.algorithm, issuer: config.issuer, audience: config.audience, subject: `${accountType}:${account.id}`, expiresIn: config.expiresIn });
  return { session, token };
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

module.exports = { issueSession, revokeSessions, revokeCurrent, recordSecurityEvent, fingerprint };
