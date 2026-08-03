"use strict";

require("dotenv").config();
const bcrypt = require("bcrypt");
const db = require("../models");
const repository = require("../services/accountSecurityRepository");
const initialCredentials = require("../services/initialCredentialService");

async function run({ execute = process.argv.includes("--execute") } = {}) {
  const result = { stage: 6, mode: execute ? "execute" : "dry-run", inspected: 0, reconciled: 0, by_account_type: {} };

  for (const accountType of initialCredentials.SUPPORTED_ACCOUNT_TYPES) {
    const model = repository.TYPES[accountType].model();
    const attributes = accountType === "mahasiswa"
      ? ["id", "nim", "password", "credential_state"]
      : ["id", "password", "credential_state"];
    const accounts = await model.findAll({ where: { credential_state: "default" }, attributes });
    let mismatches = 0;

    for (const account of accounts) {
      result.inspected += 1;
      const expected = initialCredentials.resolveInitialPassword(accountType, account);
      if (await bcrypt.compare(expected, account.password)) continue;
      mismatches += 1;
      if (!execute) continue;

      await db.sequelize.transaction(async (transaction) => {
        const locked = await model.findByPk(account.id, { transaction, lock: transaction.LOCK.UPDATE });
        if (!locked || locked.credential_state !== "default") return;
        const lockedExpected = initialCredentials.resolveInitialPassword(accountType, locked);
        if (await bcrypt.compare(lockedExpected, locked.password)) return;
        await initialCredentials.provisionExistingDefaultAccount({
          accountType,
          account: locked,
          actor: { type: "system", id: null },
          transaction,
        });
        result.reconciled += 1;
      });
    }
    result.by_account_type[accountType] = { inspected: accounts.length, mismatches };
  }

  console.log(JSON.stringify(result, null, 2));
  return result;
}

if (require.main === module) {
  run()
    .then(() => db.sequelize.close())
    .catch(async (error) => {
      console.error(error);
      await db.sequelize.close();
      process.exitCode = 1;
    });
}

module.exports = { run };
