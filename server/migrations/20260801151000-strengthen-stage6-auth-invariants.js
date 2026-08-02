"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const statements = [
      `ALTER TABLE "AuthSessions" ADD CONSTRAINT ck_auth_session_account_type CHECK (account_type IN ('mahasiswa','dosen','admin','sekretaris_prodi'))`,
      `ALTER TABLE "AuthSessions" ADD CONSTRAINT ck_auth_session_expiry CHECK (absolute_expires_at > "createdAt" AND idle_expires_at > "createdAt")`,
      `ALTER TABLE "PasswordResetTokens" ADD CONSTRAINT ck_password_reset_account_type CHECK (account_type IN ('mahasiswa','dosen','admin','sekretaris_prodi'))`,
      `ALTER TABLE "PasswordResetTokens" ADD CONSTRAINT ck_password_reset_purpose CHECK (purpose IN ('self_reset','admin_activation'))`,
      `ALTER TABLE "PasswordResetTokens" ADD CONSTRAINT ck_password_reset_terminal CHECK (NOT (used_at IS NOT NULL AND revoked_at IS NOT NULL))`,
      `ALTER TABLE "AuthOutboxes" ADD CONSTRAINT ck_auth_outbox_status CHECK (status IN ('pending','processing','retry','sent','dead_letter','cancelled'))`,
      `CREATE UNIQUE INDEX uq_password_reset_active_account_purpose ON "PasswordResetTokens" (account_type, account_id, purpose) WHERE used_at IS NULL AND revoked_at IS NULL`,
      `CREATE UNIQUE INDEX uq_auth_outbox_reset_token ON "AuthOutboxes" (reset_token_id)`,
      `CREATE INDEX idx_auth_session_expiry ON "AuthSessions" (absolute_expires_at, idle_expires_at) WHERE revoked_at IS NULL`,
    ];
      for (const sql of statements) await queryInterface.sequelize.query(sql, { transaction });
    });
  },
  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeIndex("AuthSessions", "idx_auth_session_expiry", { transaction });
      await queryInterface.removeIndex("AuthOutboxes", "uq_auth_outbox_reset_token", { transaction });
      await queryInterface.removeIndex("PasswordResetTokens", "uq_password_reset_active_account_purpose", { transaction });
      for (const [table, constraint] of [["AuthOutboxes","ck_auth_outbox_status"],["PasswordResetTokens","ck_password_reset_terminal"],["PasswordResetTokens","ck_password_reset_purpose"],
        ["PasswordResetTokens","ck_password_reset_account_type"],["AuthSessions","ck_auth_session_expiry"],["AuthSessions","ck_auth_session_account_type"]]) await queryInterface.removeConstraint(table, constraint, { transaction });
    });
  },
};
