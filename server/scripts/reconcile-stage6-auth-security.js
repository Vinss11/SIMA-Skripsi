"use strict";

require("dotenv").config();
const fs = require("fs"); const path = require("path"); const db = require("../models");
const bcrypt = require("bcrypt");
const repository = require("../services/accountSecurityRepository");
const initialCredentials = require("../services/initialCredentialService");

async function scalar(sql, replacements = {}) { const [rows] = await db.sequelize.query(sql, { replacements }); return Number(rows[0]?.count || 0); }
async function findLoginIdentifierCollisions() {
  const identifiers = new Map();
  for (const [accountType, definition] of Object.entries(repository.TYPES)) {
    const attributes = [...new Set(["id", ...definition.identifiers,
      ...(accountType === "dosen" ? ["jabatan_struktural"] : []),
      ...(accountType === "sekretaris_prodi" ? ["jabatan"] : [])])];
    const accounts = await definition.model().findAll({ attributes });
    for (const account of accounts) {
      for (const value of repository.identifiers(accountType, account)) {
        const key = repository.normalizedIdentityValue(value);
        if (!key) continue;
        if (!identifiers.has(key)) identifiers.set(key, new Map());
        identifiers.get(key).set(`${accountType}:${account.id}`, { accountType, account });
      }
    }
  }
  const uniqueCollisions = new Map();
  for (const candidatesByAccount of identifiers.values()) {
    const candidates = [...candidatesByAccount.values()];
    if (candidates.length < 2) continue;
    const signature = candidates.map((candidate) => `${candidate.accountType}:${candidate.account.id}`).sort().join("|");
    if (!uniqueCollisions.has(signature)) uniqueCollisions.set(signature, repository.classifyIdentityCandidates(candidates));
  }
  const grouped = new Map();
  for (const collision of uniqueCollisions.values()) {
    const classification = collision.classification === "valid_identity_alias" ? "valid_identity_alias" : "actual_collision";
    const accountTypes = collision.resolved?.identityAlias?.accountTypes || collision.accountTypes || [];
    const key = `${classification}:${accountTypes.join("|")}`;
    const current = grouped.get(key) || { type: "login_identifier_collision", classification, account_types: accountTypes, count: 0 };
    current.count += 1; grouped.set(key, current);
  }
  return [...grouped.values()];
}
function scanRuntimeSources() {
  const serverRoot = path.join(__dirname, "..");
  const roots = ["controllers", "middlewares", "services", "routes", "seeders", "migrations", "config", "scripts"];
  const clientRoot = path.join(__dirname, "..", "..", "client", "src");
  const rules = [
    ["jwt_secret_fallback", /JWT_SECRET\s*\|\|/],
    ["passwordless_email_login", /login-mahasiswa-email|loginMahasiswaByEmail/],
    ["exposed_default_password", /(?<!is_)password_default\s*:|(?<!is_)default_password\s*:/],
    ["literal_known_default", /["']12345678["']/],
  ]; const findings = [];
  const visit = (directory, relativeBase) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute, relativeBase);
      else if (/\.(js|jsx|ts|tsx)$/.test(entry.name)) {
        if (absolute === __filename || absolute.endsWith("initialCredentialService.js")) continue;
        const relative = path.relative(relativeBase, absolute).replaceAll("\\", "/");
        const text = fs.readFileSync(absolute, "utf8");
        for (const [type, pattern] of rules) if (pattern.test(text)) findings.push({ type, file: relative });
      }
    }
  };
  for (const root of roots) visit(path.join(serverRoot, root), path.join(serverRoot, ".."));
  visit(clientRoot, path.join(serverRoot, ".."));
  return findings;
}

async function run() {
  const accountTables = ["Mahasiswas", "Dosens", "Admins", "SekretarisProdis"];
  const findings = [];
  for (const table of accountTables) {
    const invalidState = await scalar(`SELECT COUNT(*) AS count FROM "${table}" WHERE credential_state NOT IN ('default','temporary','active') OR credential_version < 1`);
    const mismatch = await scalar(`SELECT COUNT(*) AS count FROM "${table}" WHERE (credential_state = 'active' AND is_default_password = true) OR (credential_state IN ('default','temporary') AND is_default_password = false)`);
    const invalidHash = await scalar(`SELECT COUNT(*) AS count FROM "${table}" WHERE password IS NULL OR password !~ '^\\$2[aby]\\$'`);
    const accountType = ["mahasiswa", "dosen", "admin", "sekretaris_prodi"][accountTables.indexOf(table)];
    const unavailableActivation = accountType === "sekretaris_prodi" ? await scalar(`SELECT COUNT(*) AS count FROM "${table}" a WHERE credential_state IN ('default','temporary')
      AND recovery_email_verified_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM "PasswordResetTokens" t WHERE t.account_type=:accountType AND t.account_id=a.id
        AND t.purpose='admin_activation' AND t.used_at IS NULL AND t.revoked_at IS NULL AND t.expires_at>NOW())`, { accountType }) : 0;
    const invalidRecoveryProvenance = await scalar(`SELECT COUNT(*) AS count FROM "${table}" WHERE (recovery_email_verified_at IS NULL) <> (recovery_email_verification_source IS NULL)`);
    if (invalidState) findings.push({ type: "invalid_credential_state_or_version", table, count: invalidState });
    if (mismatch) findings.push({ type: "credential_legacy_flag_mismatch", table, count: mismatch });
    if (invalidHash) findings.push({ type: "invalid_password_hash", table, count: invalidHash });
    if (unavailableActivation) findings.push({ type: "activation_channel_unverified", table, count: unavailableActivation,
      action: "Akun Sekretaris Prodi wajib dipulihkan satu per satu melalui runbook recovery offline dengan persetujuan tercatat." });
    if (invalidRecoveryProvenance) findings.push({ type: "invalid_recovery_verification_provenance", table, count: invalidRecoveryProvenance });
  }
  for (const accountType of initialCredentials.SUPPORTED_ACCOUNT_TYPES) {
    const definition = repository.TYPES[accountType];
    const attributes = accountType === "mahasiswa"
      ? ["id", "nim", "password", "credential_state"]
      : ["id", "password", "credential_state"];
    const accounts = await definition.model().findAll({ where: { credential_state: "default" }, attributes });
    let invalidCount = 0;
    for (const account of accounts) {
      const expected = initialCredentials.resolveInitialPassword(accountType, account);
      if (!(await bcrypt.compare(expected, account.password))) invalidCount += 1;
    }
    if (invalidCount) findings.push({
      type: "institutional_default_credential_mismatch",
      account_type: accountType,
      count: invalidCount,
      action: "Jalankan reconcile:stage6-initial-credentials -- --execute; akun active tidak akan diubah.",
    });
  }
  const sessionUnion = accountTables.map((table, index) => {
    const type = ["mahasiswa", "dosen", "admin", "sekretaris_prodi"][index];
    return `SELECT '${type}' account_type, id, credential_version FROM "${table}"`;
  }).join(" UNION ALL ");
  const staleSessions = await scalar(`SELECT COUNT(*) AS count FROM "AuthSessions" s LEFT JOIN (${sessionUnion}) a ON a.account_type=s.account_type AND a.id=s.account_id WHERE s.revoked_at IS NULL AND (a.id IS NULL OR a.credential_version<>s.credential_version OR s.absolute_expires_at<=NOW() OR s.idle_expires_at<=NOW())`);
  if (staleSessions) findings.push({ type: "stale_active_session", count: staleSessions });
  const invalidReset = await scalar(`SELECT COUNT(*) AS count FROM "PasswordResetTokens" WHERE token_hash !~ '^[a-f0-9]{64}$' OR selector !~ '^[a-f0-9]{24}$' OR (used_at IS NOT NULL AND revoked_at IS NOT NULL)`);
  if (invalidReset) findings.push({ type: "invalid_reset_token_record", count: invalidReset });
  const unsafeOutbox = await scalar(`SELECT COUNT(*) AS count FROM "AuthOutboxes" WHERE (status IN ('sent','dead_letter','cancelled') AND ciphertext IS NOT NULL) OR (status IN ('pending','retry','processing') AND ciphertext IS NULL)`);
  if (unsafeOutbox) findings.push({ type: "unsafe_auth_outbox_payload", count: unsafeOutbox });
  const staleProcessingOutbox = await scalar(`SELECT COUNT(*) AS count FROM "AuthOutboxes" WHERE status='processing' AND claimed_at < NOW() - INTERVAL '5 minutes'`);
  if (staleProcessingOutbox) findings.push({ type: "stale_processing_auth_outbox", count: staleProcessingOutbox,
    action: "Worker akan mengambil ulang job setelah lease berakhir." });
  const identifierCollisions = await findLoginIdentifierCollisions();
  findings.push(...identifierCollisions.filter((item) => item.classification !== "valid_identity_alias"));
  const informational = identifierCollisions
    .filter((item) => item.classification === "valid_identity_alias")
    .map((item) => ({ type: "valid_identity_alias", account_types: item.account_types, count: item.count }));
  findings.push(...scanRuntimeSources());
  const result = { stage: 6, mode: "dry-run", total_findings: findings.reduce((sum, item) => sum + Number(item.count || 1), 0), findings, informational };
  console.log(JSON.stringify(result, null, 2)); return result;
}

if (require.main === module) run().then(() => db.sequelize.close()).catch(async error => { console.error(error); await db.sequelize.close(); process.exitCode = 1; });
module.exports = { run, scanRuntimeSources, findLoginIdentifierCollisions };
