"use strict";

require("dotenv").config();
const { Op } = require("sequelize");
const db = require("../models");
const repository = require("../services/accountSecurityRepository");
const { issueInitialActivation } = require("../services/passwordRecoveryService");

const execute = process.argv.includes("--execute");

async function candidatesFor(accountType) {
  const model = repository.TYPES[accountType].model();
  const rows = await model.findAll({ where: { credential_state: { [Op.in]: ["default", "temporary"] } }, attributes: ["id", "email"] });
  const candidates = [];
  for (const account of rows) {
    const activeToken = await db.PasswordResetToken.findOne({ where: { account_type: accountType, account_id: account.id,
      purpose: "admin_activation", used_at: null, revoked_at: null, expires_at: { [Op.gt]: new Date() } }, attributes: ["id"] });
    if (!activeToken) candidates.push(account);
  }
  return candidates;
}

async function run() {
  const summary = { mode: execute ? "execute" : "dry-run", eligible: 0, provisioned: 0, missing_email: [], failed: [],
    privileged_requires_offline_recovery: {} };
  for (const accountType of ["admin", "sekretaris_prodi"]) {
    summary.privileged_requires_offline_recovery[accountType] = (await candidatesFor(accountType)).length;
  }
  for (const accountType of ["mahasiswa", "dosen"]) {
    for (const account of await candidatesFor(accountType)) {
      summary.eligible += 1;
      if (!account.email) { summary.missing_email.push({ account_type: accountType, account_id: account.id }); continue; }
      if (!execute) continue;
      try {
        await issueInitialActivation({ accountType, account, actor: { id: null, role: "system" } });
        summary.provisioned += 1;
      } catch (error) {
        summary.failed.push({ account_type: accountType, account_id: account.id, code: error.code || "ACTIVATION_PROVISION_FAILED" });
      }
    }
  }
  console.log(JSON.stringify(summary, null, 2));
  return summary;
}

if (require.main === module) run().then(() => db.sequelize.close()).catch(async (error) => {
  console.error(error); await db.sequelize.close().catch(() => {}); process.exitCode = 1;
});

module.exports = { run, candidatesFor };
