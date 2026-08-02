"use strict";

require("dotenv").config();
const bcrypt = require("bcrypt"); const crypto = require("crypto"); const db = require("../models");
const repository = require("../services/accountSecurityRepository"); const sessions = require("../services/authSessionService");

function argument(name) { const prefix = `--${name}=`; const found = process.argv.find(item => item.startsWith(prefix)); return found ? found.slice(prefix.length) : null; }
async function run() {
  const accountType = argument("account-type"); const accountId = Number(argument("account-id")); const execute = process.argv.includes("--execute");
  if (!["admin", "sekretaris_prodi"].includes(accountType) || !Number.isInteger(accountId) || accountId < 1) throw new Error("Target eksplisit --account-type=admin|sekretaris_prodi dan --account-id=<id> wajib diisi.");
  const account = await repository.resolveAccount({ accountType, accountId }); if (!account) throw new Error("Target akun privileged tidak ditemukan.");
  if (!execute) { console.log(JSON.stringify({ mode: "dry-run", target: { account_type: accountType, account_id: accountId }, would_revoke_sessions: true,
    required_execute_env: ["PRIVILEGED_RECOVERY_PASSWORD_HASH", "PRIVILEGED_RECOVERY_REASON"] }, null, 2)); return; }
  const passwordHash = process.env.PRIVILEGED_RECOVERY_PASSWORD_HASH; const reason = String(process.env.PRIVILEGED_RECOVERY_REASON || "").trim();
  if (!/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(String(passwordHash || "")) || !await bcrypt.compare("stage6-hash-validation-probe", passwordHash).then(() => true).catch(() => false)) {
    throw new Error("PRIVILEGED_RECOVERY_PASSWORD_HASH wajib berupa bcrypt hash valid; plaintext dilarang.");
  }
  if (reason.length < 20) throw new Error("PRIVILEGED_RECOVERY_REASON minimal 20 karakter untuk audit.");
  await db.sequelize.transaction(async transaction => {
    const locked = await repository.resolveAccount({ accountType, accountId, transaction, lock: transaction.LOCK.UPDATE }); const now = new Date();
    await locked.update({ password: passwordHash, credential_state: "temporary", credential_version: Number(locked.credential_version || 1) + 1,
      is_default_password: true, password_changed_at: now, password_origin: "admin_reset", force_change_reason: "offline_privileged_recovery",
      security_updated_at: now, security_updated_by_type: "offline_security_operator", security_updated_by_id: null }, { transaction, hooks: false });
    await sessions.revokeSessions(accountType, accountId, { reason: "offline_privileged_recovery", actorType: "offline_security_operator", transaction });
    await sessions.recordSecurityEvent({ event_type: "privileged.offline_recovery", actor_type: "offline_security_operator", target_type: accountType,
      target_id: accountId, correlation_id: crypto.randomUUID(), outcome: "success", reason_code: "APPROVED_OFFLINE_RECOVERY", metadata: { reason } }, transaction);
  });
  console.log(JSON.stringify({ mode: "execute", success: true, target: { account_type: accountType, account_id: accountId } }, null, 2));
}

if (require.main === module) run().then(() => db.sequelize.close()).catch(async error => { console.error(error.message); await db.sequelize.close(); process.exitCode = 1; });
module.exports = { run };
