"use strict";

const ACCOUNT_TABLES = ["Mahasiswas", "Dosens", "Admins", "SekretarisProdis"];

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
    for (const table of ACCOUNT_TABLES) {
      await queryInterface.addColumn(table, "credential_state", { type: Sequelize.STRING(20), allowNull: true }, { transaction });
      await queryInterface.addColumn(table, "credential_version", { type: Sequelize.INTEGER, allowNull: true }, { transaction });
      await queryInterface.addColumn(table, "password_changed_at", { type: Sequelize.DATE, allowNull: true }, { transaction });
      await queryInterface.addColumn(table, "password_origin", { type: Sequelize.STRING(30), allowNull: true }, { transaction });
      await queryInterface.addColumn(table, "force_change_reason", { type: Sequelize.STRING(120), allowNull: true }, { transaction });
      await queryInterface.addColumn(table, "security_updated_at", { type: Sequelize.DATE, allowNull: true }, { transaction });
      await queryInterface.addColumn(table, "security_updated_by_type", { type: Sequelize.STRING(30), allowNull: true }, { transaction });
      await queryInterface.addColumn(table, "security_updated_by_id", { type: Sequelize.INTEGER, allowNull: true }, { transaction });
      await queryInterface.addColumn(table, "recovery_email_verified_at", { type: Sequelize.DATE, allowNull: true }, { transaction });
      await queryInterface.sequelize.query(`UPDATE "${table}" SET credential_state = CASE WHEN is_default_password = true THEN 'default' ELSE 'active' END, credential_version = 1, password_origin = 'migration', security_updated_at = COALESCE("updatedAt", NOW()) WHERE credential_state IS NULL OR credential_version IS NULL`, { transaction });
      await queryInterface.changeColumn(table, "credential_state", { type: Sequelize.STRING(20), allowNull: false }, { transaction });
      await queryInterface.changeColumn(table, "credential_version", { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 }, { transaction });
      await queryInterface.addConstraint(table, { fields: ["credential_state"], type: "check", where: { credential_state: ["default", "temporary", "active"] }, name: `ck_${table.toLowerCase()}_credential_state`, transaction });
      await queryInterface.addConstraint(table, { fields: ["credential_version"], type: "check", where: { credential_version: { [Sequelize.Op.gte]: 1 } }, name: `ck_${table.toLowerCase()}_credential_version`, transaction });
    }

    await queryInterface.createTable("AuthSessions", {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      account_type: { type: Sequelize.STRING(30), allowNull: false }, account_id: { type: Sequelize.INTEGER, allowNull: false },
      role_snapshot: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} }, credential_version: { type: Sequelize.INTEGER, allowNull: false },
      last_used_at: { type: Sequelize.DATE, allowNull: false }, absolute_expires_at: { type: Sequelize.DATE, allowNull: false }, idle_expires_at: { type: Sequelize.DATE, allowNull: false },
      revoked_at: { type: Sequelize.DATE, allowNull: true }, revoked_by_type: { type: Sequelize.STRING(30), allowNull: true }, revoked_by_id: { type: Sequelize.INTEGER, allowNull: true }, revoked_reason: { type: Sequelize.STRING(80), allowNull: true },
      ip_fingerprint: { type: Sequelize.STRING(64), allowNull: true }, user_agent_fingerprint: { type: Sequelize.STRING(64), allowNull: true }, remember_me: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false }, metadata: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      createdAt: { type: Sequelize.DATE, allowNull: false }, updatedAt: { type: Sequelize.DATE, allowNull: false },
    }, { transaction });
    await queryInterface.addIndex("AuthSessions", ["account_type", "account_id", "revoked_at"], { name: "idx_auth_session_account_active", transaction });

    await queryInterface.createTable("PasswordResetTokens", {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false }, account_type: { type: Sequelize.STRING(30), allowNull: false }, account_id: { type: Sequelize.INTEGER, allowNull: false },
      purpose: { type: Sequelize.STRING(30), allowNull: false }, selector: { type: Sequelize.STRING(40), allowNull: false, unique: true }, token_hash: { type: Sequelize.STRING(64), allowNull: false },
      requested_at: { type: Sequelize.DATE, allowNull: false }, expires_at: { type: Sequelize.DATE, allowNull: false }, used_at: { type: Sequelize.DATE, allowNull: true }, revoked_at: { type: Sequelize.DATE, allowNull: true }, revoked_reason: { type: Sequelize.STRING(80), allowNull: true },
      correlation_id: { type: Sequelize.UUID, allowNull: false }, attempt_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 }, last_attempted_at: { type: Sequelize.DATE, allowNull: true }, metadata: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      createdAt: { type: Sequelize.DATE, allowNull: false }, updatedAt: { type: Sequelize.DATE, allowNull: false },
    }, { transaction });
    await queryInterface.addIndex("PasswordResetTokens", ["account_type", "account_id", "purpose"], { name: "idx_password_reset_account_purpose", transaction });

    await queryInterface.createTable("AuthOutboxes", {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false }, reset_token_id: { type: Sequelize.UUID, allowNull: false, references: { model: "PasswordResetTokens", key: "id" }, onDelete: "CASCADE" },
      event_type: { type: Sequelize.STRING(50), allowNull: false }, template_id: { type: Sequelize.STRING(80), allowNull: false }, recipient_reference: { type: Sequelize.STRING(180), allowNull: false }, correlation_id: { type: Sequelize.UUID, allowNull: false },
      ciphertext: { type: Sequelize.TEXT, allowNull: true }, encryption_iv: { type: Sequelize.STRING(40), allowNull: true }, encryption_tag: { type: Sequelize.STRING(40), allowNull: true }, key_version: { type: Sequelize.STRING(30), allowNull: false },
      status: { type: Sequelize.STRING(30), allowNull: false, defaultValue: "pending" }, attempt_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 }, available_at: { type: Sequelize.DATE, allowNull: false }, claimed_at: { type: Sequelize.DATE, allowNull: true }, sent_at: { type: Sequelize.DATE, allowNull: true }, last_error_code: { type: Sequelize.STRING(80), allowNull: true }, metadata: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      createdAt: { type: Sequelize.DATE, allowNull: false }, updatedAt: { type: Sequelize.DATE, allowNull: false },
    }, { transaction });
    await queryInterface.addIndex("AuthOutboxes", ["status", "available_at"], { name: "idx_auth_outbox_pending", transaction });

    await queryInterface.createTable("AuthSecurityEvents", {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false }, event_type: { type: Sequelize.STRING(60), allowNull: false },
      actor_type: { type: Sequelize.STRING(30), allowNull: true }, actor_id: { type: Sequelize.INTEGER, allowNull: true }, target_type: { type: Sequelize.STRING(30), allowNull: true }, target_id: { type: Sequelize.INTEGER, allowNull: true },
      session_id: { type: Sequelize.UUID, allowNull: true }, correlation_id: { type: Sequelize.UUID, allowNull: false }, outcome: { type: Sequelize.STRING(30), allowNull: false }, reason_code: { type: Sequelize.STRING(80), allowNull: true }, metadata: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      createdAt: { type: Sequelize.DATE, allowNull: false }, updatedAt: { type: Sequelize.DATE, allowNull: false },
    }, { transaction });
    await queryInterface.addIndex("AuthSecurityEvents", ["event_type", "createdAt"], { name: "idx_auth_security_event_type_time", transaction });

    await queryInterface.createTable("AuthRateLimitBuckets", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true }, scope: { type: Sequelize.STRING(40), allowNull: false }, key_hash: { type: Sequelize.STRING(64), allowNull: false },
      window_started_at: { type: Sequelize.DATE, allowNull: false }, attempt_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 }, blocked_until: { type: Sequelize.DATE, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false }, updatedAt: { type: Sequelize.DATE, allowNull: false },
    }, { transaction });
    await queryInterface.addIndex("AuthRateLimitBuckets", ["scope", "key_hash"], { unique: true, name: "uq_auth_rate_limit_scope_key", transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.dropTable("AuthRateLimitBuckets", { transaction }); await queryInterface.dropTable("AuthSecurityEvents", { transaction }); await queryInterface.dropTable("AuthOutboxes", { transaction }); await queryInterface.dropTable("PasswordResetTokens", { transaction }); await queryInterface.dropTable("AuthSessions", { transaction });
      for (const table of ACCOUNT_TABLES) {
        await queryInterface.removeConstraint(table, `ck_${table.toLowerCase()}_credential_version`, { transaction });
        await queryInterface.removeConstraint(table, `ck_${table.toLowerCase()}_credential_state`, { transaction });
        for (const column of ["recovery_email_verified_at", "security_updated_by_id", "security_updated_by_type", "security_updated_at", "force_change_reason", "password_origin", "password_changed_at", "credential_version", "credential_state"]) await queryInterface.removeColumn(table, column, { transaction });
      }
    });
  },
};
