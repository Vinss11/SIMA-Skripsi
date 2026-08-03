"use strict";

const bcrypt = require("bcrypt");
const crypto = require("crypto");
const { QueryTypes } = require("sequelize");
const { resolveInitialPassword } = require("../services/initialCredentialService");

const ACCOUNT_TABLES = [
  { accountType: "mahasiswa", table: "Mahasiswas", attributes: "id, nim, password" },
  { accountType: "dosen", table: "Dosens", attributes: "id, password" },
  { accountType: "admin", table: "Admins", attributes: "id, password" },
];

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const definition of ACCOUNT_TABLES) {
        const accounts = await queryInterface.sequelize.query(
          `SELECT ${definition.attributes} FROM "${definition.table}" WHERE credential_state = 'default' FOR UPDATE`,
          { type: QueryTypes.SELECT, transaction }
        );

        for (const account of accounts) {
          const expected = resolveInitialPassword(definition.accountType, account);
          if (await bcrypt.compare(expected, account.password)) continue;
          const passwordHash = await bcrypt.hash(expected, 10);
          const now = new Date();

          await queryInterface.sequelize.query(
            `UPDATE "${definition.table}"
             SET password = :passwordHash,
                 credential_version = credential_version + 1,
                 is_default_password = true,
                 password_changed_at = NULL,
                 password_origin = 'institutional_default',
                 force_change_reason = 'initial_institutional_password',
                 security_updated_at = :now,
                 security_updated_by_type = 'system',
                 security_updated_by_id = NULL,
                 "updatedAt" = :now
             WHERE id = :accountId AND credential_state = 'default'`,
            { replacements: { passwordHash, now, accountId: account.id }, transaction }
          );
          await queryInterface.sequelize.query(
            `UPDATE "AuthSessions"
             SET revoked_at = :now, revoked_reason = 'initial_credential_reconciled',
                 revoked_by_type = 'system', revoked_by_id = NULL, "updatedAt" = :now
             WHERE account_type = :accountType AND account_id = :accountId AND revoked_at IS NULL`,
            { replacements: { now, accountType: definition.accountType, accountId: account.id }, transaction }
          );
          await queryInterface.sequelize.query(
            `UPDATE "PasswordResetTokens"
             SET revoked_at = :now, revoked_reason = 'initial_credential_reconciled', "updatedAt" = :now
             WHERE account_type = :accountType AND account_id = :accountId AND used_at IS NULL AND revoked_at IS NULL`,
            { replacements: { now, accountType: definition.accountType, accountId: account.id }, transaction }
          );
          await queryInterface.bulkInsert("AuthSecurityEvents", [{
            id: crypto.randomUUID(),
            event_type: "credential.initial.reconciled",
            actor_type: "system",
            actor_id: null,
            target_type: definition.accountType,
            target_id: account.id,
            correlation_id: crypto.randomUUID(),
            outcome: "success",
            reason_code: "INSTITUTIONAL_DEFAULT_RESTORED",
            metadata: JSON.stringify({ source: "migration" }),
            createdAt: now,
            updatedAt: now,
          }], { transaction });
        }
      }
    });
  },

  async down() {
    // Irreversible by design: previous random/unusable password hashes cannot be reconstructed safely.
  },
};
