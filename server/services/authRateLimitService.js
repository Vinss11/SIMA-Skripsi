"use strict";

const crypto = require("crypto"); const db = require("../models");
class AuthRateLimitError extends Error { constructor() { super("Terlalu banyak percobaan. Silakan coba kembali nanti."); this.status = 429; this.code = "AUTH_RATE_LIMITED"; } }
const hash = (value) => crypto.createHash("sha256").update(String(value || "unknown").toLowerCase()).digest("hex");

async function consume(scope, key, { limit = 10, windowMs = 15 * 60 * 1000, blockMs = 15 * 60 * 1000 } = {}) {
  const result = await db.sequelize.transaction(async (transaction) => {
    const keyHash = hash(key); const now = new Date();
    // The bucket may not exist yet. A transaction advisory lock closes the
    // find-then-create race without relying on a failed unique insert.
    await db.sequelize.query("SELECT pg_advisory_xact_lock(hashtext(:bucketKey))", { replacements: { bucketKey: `${scope}:${keyHash}` }, transaction });
    let row = await db.AuthRateLimitBucket.findOne({ where: { scope, key_hash: keyHash }, transaction, lock: transaction.LOCK.UPDATE });
    if (!row) row = await db.AuthRateLimitBucket.create({ scope, key_hash: keyHash, window_started_at: now, attempt_count: 0 }, { transaction });
    if (row.blocked_until && new Date(row.blocked_until) > now) return { blocked: true };
    const expired = now - new Date(row.window_started_at) >= windowMs;
    const attempts = expired ? 1 : Number(row.attempt_count || 0) + 1;
    const blockedUntil = attempts > limit ? new Date(now.getTime() + blockMs) : null;
    await row.update({ window_started_at: expired ? now : row.window_started_at, attempt_count: attempts, blocked_until: blockedUntil }, { transaction });
    return { blocked: Boolean(blockedUntil), remaining: Math.max(limit - attempts, 0) };
  });
  // Throw only after the transaction has committed. Throwing inside the
  // transaction would roll back blocked_until and make the limiter ineffective.
  if (result.blocked) throw new AuthRateLimitError();
  return result;
}

module.exports = { consume, hash, AuthRateLimitError };
