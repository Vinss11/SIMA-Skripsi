"use strict";

const bcrypt = require("bcrypt");
const db = require("../models");
const sessions = require("./authSessionService");

const SHARED_INSTITUTIONAL_PASSWORD = "12345678";
const SUPPORTED_ACCOUNT_TYPES = new Set(["mahasiswa", "dosen", "admin"]);
const rounds = Math.min(14, Math.max(10, Number(process.env.AUTH_BCRYPT_ROUNDS || 10)));

class InitialCredentialError extends Error {
  constructor(message, code = "INITIAL_CREDENTIAL_INVALID") {
    super(message);
    this.code = code;
  }
}

function resolveInitialPassword(accountType, account = {}) {
  if (!SUPPORTED_ACCOUNT_TYPES.has(accountType)) {
    throw new InitialCredentialError(
      "Tipe akun tidak mendukung kredensial awal institusional.",
      "INITIAL_CREDENTIAL_ACCOUNT_TYPE_UNSUPPORTED"
    );
  }

  if (accountType === "mahasiswa") {
    const nim = String(account.nim || "").trim();
    if (!nim) {
      throw new InitialCredentialError(
        "NIM wajib tersedia untuk membuat kredensial awal mahasiswa.",
        "INITIAL_CREDENTIAL_NIM_REQUIRED"
      );
    }
    return nim;
  }

  return SHARED_INSTITUTIONAL_PASSWORD;
}

function buildInitialCredentialAttributes(accountType, account = {}, actor = {}) {
  return {
    password: resolveInitialPassword(accountType, account),
    is_default_password: true,
    credential_state: "default",
    credential_version: 1,
    password_changed_at: null,
    password_origin: "institutional_default",
    force_change_reason: "initial_institutional_password",
    security_updated_at: new Date(),
    security_updated_by_type: actor.type || actor.role || "system",
    security_updated_by_id: actor.id || null,
  };
}

async function provisionExistingDefaultAccount({ accountType, account, actor = {}, transaction }) {
  if (!transaction) {
    return db.sequelize.transaction((nestedTransaction) =>
      provisionExistingDefaultAccount({ accountType, account, actor, transaction: nestedTransaction })
    );
  }
  if (!account || account.credential_state !== "default") {
    throw new InitialCredentialError(
      "Hanya akun dengan credential state default yang dapat direkonsiliasi.",
      "INITIAL_CREDENTIAL_STATE_NOT_DEFAULT"
    );
  }

  const password = resolveInitialPassword(accountType, account);
  const passwordHash = await bcrypt.hash(password, rounds);
  const now = new Date();
  await account.update(
    {
      password: passwordHash,
      is_default_password: true,
      credential_state: "default",
      credential_version: Number(account.credential_version || 1) + 1,
      password_changed_at: null,
      password_origin: "institutional_default",
      force_change_reason: "initial_institutional_password",
      security_updated_at: now,
      security_updated_by_type: actor.type || actor.role || "system",
      security_updated_by_id: actor.id || null,
    },
    { transaction, hooks: false }
  );

  if (db.AuthSession) {
    await db.AuthSession.update(
      {
        revoked_at: now,
        revoked_reason: "initial_credential_reconciled",
        revoked_by_type: actor.type || actor.role || "system",
        revoked_by_id: actor.id || null,
      },
      { where: { account_type: accountType, account_id: account.id, revoked_at: null }, transaction }
    );
  }
  if (db.PasswordResetToken) {
    await db.PasswordResetToken.update(
      { revoked_at: now, revoked_reason: "initial_credential_reconciled" },
      { where: { account_type: accountType, account_id: account.id, used_at: null, revoked_at: null }, transaction }
    );
  }
  if (db.AuthSecurityEvent) await sessions.recordSecurityEvent({
    event_type: "credential.initial.reconciled",
    actor_type: actor.type || actor.role || "system",
    actor_id: actor.id || null,
    target_type: accountType,
    target_id: account.id,
    outcome: "success",
    reason_code: "INSTITUTIONAL_DEFAULT_RESTORED",
  }, transaction);
  return account;
}

module.exports = {
  InitialCredentialError,
  SUPPORTED_ACCOUNT_TYPES,
  buildInitialCredentialAttributes,
  provisionExistingDefaultAccount,
  resolveInitialPassword,
};
