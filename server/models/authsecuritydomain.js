"use strict";

const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  const common = { timestamps: true };
  class AuthSession extends Model {}
  AuthSession.init({ id: { type: DataTypes.UUID, primaryKey: true }, account_type: DataTypes.STRING, account_id: DataTypes.INTEGER,
    role_snapshot: { type: DataTypes.JSONB, defaultValue: {} }, credential_version: DataTypes.INTEGER,
    last_used_at: DataTypes.DATE, absolute_expires_at: DataTypes.DATE, idle_expires_at: DataTypes.DATE,
    revoked_at: DataTypes.DATE, revoked_by_type: DataTypes.STRING, revoked_by_id: DataTypes.INTEGER, revoked_reason: DataTypes.STRING,
    ip_fingerprint: DataTypes.STRING, user_agent_fingerprint: DataTypes.STRING, remember_me: { type: DataTypes.BOOLEAN, defaultValue: false }, metadata: { type: DataTypes.JSONB, defaultValue: {} },
  }, { sequelize, modelName: "AuthSession", tableName: "AuthSessions", ...common });

  class PasswordResetToken extends Model {}
  PasswordResetToken.init({ id: { type: DataTypes.UUID, primaryKey: true }, account_type: DataTypes.STRING, account_id: DataTypes.INTEGER,
    purpose: DataTypes.STRING, selector: DataTypes.STRING, token_hash: DataTypes.STRING, requested_at: DataTypes.DATE, expires_at: DataTypes.DATE,
    used_at: DataTypes.DATE, revoked_at: DataTypes.DATE, revoked_reason: DataTypes.STRING, correlation_id: DataTypes.UUID,
    attempt_count: { type: DataTypes.INTEGER, defaultValue: 0 }, last_attempted_at: DataTypes.DATE, metadata: { type: DataTypes.JSONB, defaultValue: {} },
  }, { sequelize, modelName: "PasswordResetToken", tableName: "PasswordResetTokens", ...common });

  class AuthOutbox extends Model {}
  AuthOutbox.init({ id: { type: DataTypes.UUID, primaryKey: true }, reset_token_id: DataTypes.UUID, event_type: DataTypes.STRING,
    template_id: DataTypes.STRING, recipient_reference: DataTypes.STRING, correlation_id: DataTypes.UUID, ciphertext: DataTypes.TEXT,
    encryption_iv: DataTypes.STRING, encryption_tag: DataTypes.STRING, key_version: DataTypes.STRING, status: { type: DataTypes.STRING, defaultValue: "pending" },
    attempt_count: { type: DataTypes.INTEGER, defaultValue: 0 }, available_at: DataTypes.DATE, claimed_at: DataTypes.DATE, sent_at: DataTypes.DATE,
    last_error_code: DataTypes.STRING, metadata: { type: DataTypes.JSONB, defaultValue: {} },
  }, { sequelize, modelName: "AuthOutbox", tableName: "AuthOutboxes", ...common });

  class AuthSecurityEvent extends Model {}
  AuthSecurityEvent.init({ id: { type: DataTypes.UUID, primaryKey: true }, event_type: DataTypes.STRING, actor_type: DataTypes.STRING,
    actor_id: DataTypes.INTEGER, target_type: DataTypes.STRING, target_id: DataTypes.INTEGER, session_id: DataTypes.UUID,
    correlation_id: DataTypes.UUID, outcome: DataTypes.STRING, reason_code: DataTypes.STRING, metadata: { type: DataTypes.JSONB, defaultValue: {} },
  }, { sequelize, modelName: "AuthSecurityEvent", tableName: "AuthSecurityEvents", ...common });

  class AuthRateLimitBucket extends Model {}
  AuthRateLimitBucket.init({ id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true }, scope: DataTypes.STRING,
    key_hash: DataTypes.STRING, window_started_at: DataTypes.DATE, attempt_count: { type: DataTypes.INTEGER, defaultValue: 0 }, blocked_until: DataTypes.DATE,
  }, { sequelize, modelName: "AuthRateLimitBucket", tableName: "AuthRateLimitBuckets", ...common });
  return AuthSession;
};
