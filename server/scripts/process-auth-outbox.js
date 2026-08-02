"use strict";

require("dotenv").config();
const { Op } = require("sequelize");
const db = require("../models");
const { decrypt } = require("../services/passwordRecoveryService");
const { getDeliveryConfig } = require("../config/authSecurity");
const { recordSecurityEvent } = require("../services/authSessionService");

const MAX_ATTEMPTS = Math.max(1, Number(process.env.AUTH_DELIVERY_MAX_ATTEMPTS || 5));
const LEASE_MS = Math.max(30000, Number(process.env.AUTH_DELIVERY_LEASE_MS || 5 * 60000));
const WEBHOOK_TIMEOUT_MS = Math.max(1000, Number(process.env.AUTH_DELIVERY_WEBHOOK_TIMEOUT_MS || 10000));

async function deliver(job, rawToken, provider = null) {
  const resetUrl = `${getDeliveryConfig().frontendOrigin}/#reset-password&token=${encodeURIComponent(rawToken)}`;
  if (provider) return provider({ recipient: job.recipient_reference, templateId: job.template_id, resetUrl, correlationId: job.correlation_id });
  const mode = process.env.AUTH_DELIVERY_MODE || "disabled";
  if (mode === "development_sink" && process.env.NODE_ENV !== "production") return { providerReference: "development-sink" };
  if (mode !== "webhook" || !process.env.AUTH_DELIVERY_WEBHOOK_URL) throw Object.assign(new Error("Delivery provider belum dikonfigurasi."), { code: "DELIVERY_PROVIDER_UNAVAILABLE" });
  const response = await fetch(process.env.AUTH_DELIVERY_WEBHOOK_URL, { method: "POST", signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS), headers: { "content-type": "application/json",
    ...(process.env.AUTH_DELIVERY_WEBHOOK_BEARER ? { authorization: `Bearer ${process.env.AUTH_DELIVERY_WEBHOOK_BEARER}` } : {}) },
    body: JSON.stringify({ to: job.recipient_reference, template_id: job.template_id, reset_url: resetUrl, correlation_id: job.correlation_id }) });
  if (!response.ok) throw Object.assign(new Error("Delivery provider menolak request."), { code: `DELIVERY_PROVIDER_${response.status}` });
  return { providerReference: response.headers.get("x-message-id") || null };
}

async function claimOne() {
  return db.sequelize.transaction(async (transaction) => {
    const now = new Date();
    const row = await db.AuthOutbox.findOne({ where: {
      [Op.or]: [
        { status: { [Op.in]: ["pending", "retry"] }, available_at: { [Op.lte]: now } },
        { status: "processing", claimed_at: { [Op.lt]: new Date(now.getTime() - LEASE_MS) } },
      ],
    },
      order: [["available_at", "ASC"]], transaction, lock: transaction.LOCK.UPDATE, skipLocked: true });
    if (!row) return null;
    await row.update({ status: "processing", claimed_at: now, attempt_count: Number(row.attempt_count || 0) + 1 }, { transaction });
    return row.toJSON();
  });
}

async function processOne(provider = null) {
  const job = await claimOne(); if (!job) return false;
  try {
    const reset = await db.PasswordResetToken.findByPk(job.reset_token_id);
    if (!reset || reset.used_at || reset.revoked_at || new Date(reset.expires_at) <= new Date()) {
      await db.AuthOutbox.update({ status: "cancelled", ciphertext: null, encryption_iv: null, encryption_tag: null,
        last_error_code: "RESET_TOKEN_NOT_DELIVERABLE" }, { where: { id: job.id, status: "processing" } });
      return true;
    }
    const raw = decrypt(job);
    const delivered = await deliver(job, raw, provider);
    await db.AuthOutbox.update({ status: "sent", sent_at: new Date(), ciphertext: null, encryption_iv: null, encryption_tag: null,
      last_error_code: null, metadata: { ...(job.metadata || {}), provider_reference: delivered?.providerReference || null } }, { where: { id: job.id, status: "processing" } });
    await recordSecurityEvent({ event_type: "password.reset.delivered", target_type: reset.account_type, target_id: reset.account_id,
      correlation_id: job.correlation_id, outcome: "success", reason_code: job.template_id });
    return true;
  } catch (error) {
    const terminal = Number(job.attempt_count || 0) >= MAX_ATTEMPTS;
    const retryMs = Math.min(60, 2 ** Math.max(0, Number(job.attempt_count || 1) - 1)) * 60000;
    await db.AuthOutbox.update({ status: terminal ? "dead_letter" : "retry", available_at: new Date(Date.now() + retryMs),
      last_error_code: String(error.code || "DELIVERY_FAILED").slice(0, 80), ...(terminal ? { ciphertext: null, encryption_iv: null, encryption_tag: null } : {}) },
    { where: { id: job.id, status: "processing" } });
    const reset = await db.PasswordResetToken.findByPk(job.reset_token_id);
    await recordSecurityEvent({ event_type: "password.reset.delivery_failed", target_type: reset?.account_type || null, target_id: reset?.account_id || null,
      correlation_id: job.correlation_id, outcome: terminal ? "dead_letter" : "retry", reason_code: String(error.code || "DELIVERY_FAILED").slice(0, 80) });
    return true;
  }
}

async function run({ once = process.argv.includes("--once"), provider = null } = {}) {
  do {
    const processed = await processOne(provider);
    if (once || !processed) return;
  } while (true);
}

if (require.main === module) run().then(() => db.sequelize.close()).catch(async (error) => { console.error("Auth outbox worker gagal:", error.message); await db.sequelize.close(); process.exitCode = 1; });
module.exports = { run, processOne, deliver, claimOne };
