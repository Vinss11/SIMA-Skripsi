"use strict";

const { Op } = require("sequelize");
const db = require("../models");
const { getDosenStatusDecision } = require("./dosenStatusPolicy");
const { isAllowedSekretarisJabatan, resolveProgramKuliahFromJabatan } = require("../constants/sekretarisAkses");

const TYPES = {
  mahasiswa: { model: () => db.Mahasiswa, identifiers: ["nim", "email"] },
  dosen: { model: () => db.Dosen, identifiers: ["kode_dosen", "nik", "email"] },
  admin: { model: () => db.Admin, identifiers: ["nip", "email"] },
  sekretaris_prodi: { model: () => db.SekretarisProdi, identifiers: ["nik", "email"] },
};

class AccountSecurityError extends Error { constructor(message, status = 400, code = "AUTH_ERROR", detail = null) { super(message); this.status = status; this.code = code; this.detail = detail; } }

function spec(accountType) { const value = TYPES[accountType]; if (!value) throw new AccountSecurityError("Tipe akun tidak dikenal.", 400, "ACCOUNT_TYPE_INVALID"); return value; }
async function resolveAccount({ accountType, accountId, transaction = null, lock = null }) { return spec(accountType).model().findByPk(accountId, { transaction, ...(lock ? { lock } : {}) }); }

function normalizedIdentityValue(value) { return String(value || "").normalize("NFKC").trim().toLowerCase(); }
function classifyIdentityCandidates(candidates) {
  if (candidates.length === 1) return { classification: "single", resolved: candidates[0] };
  const byType = new Map(candidates.map((candidate) => [candidate.accountType, candidate]));
  if (candidates.length === 2 && byType.size === 2 && byType.has("dosen") && byType.has("sekretaris_prodi")) {
    const dosen = byType.get("dosen"); const sekretaris = byType.get("sekretaris_prodi");
    const nikMatches = normalizedIdentityValue(dosen.account.nik) && normalizedIdentityValue(dosen.account.nik) === normalizedIdentityValue(sekretaris.account.nik);
    const emailMatches = normalizedIdentityValue(dosen.account.email) && normalizedIdentityValue(dosen.account.email) === normalizedIdentityValue(sekretaris.account.email);
    const dosenProgram = resolveProgramKuliahFromJabatan(dosen.account.jabatan_struktural);
    const sekretarisProgram = resolveProgramKuliahFromJabatan(sekretaris.account.jabatan);
    const rolesMatch = isAllowedSekretarisJabatan(dosen.account.jabatan_struktural)
      && isAllowedSekretarisJabatan(sekretaris.account.jabatan)
      && dosenProgram && dosenProgram === sekretarisProgram;
    if (nikMatches && emailMatches && rolesMatch) {
      return { classification: "valid_identity_alias", resolved: { ...dosen, identityAlias: {
        classification: "valid_identity_alias", accountTypes: ["dosen", "sekretaris_prodi"], sekretarisProdiId: sekretaris.account.id,
      } } };
    }
  }
  return { classification: "login_identifier_collision", accountTypes: [...new Set(candidates.map((item) => item.accountType))].sort() };
}

async function resolveAccountByLoginIdentifier(identifier) {
  const value = String(identifier || "").trim(); const lower = value.toLowerCase(); const upper = value.toUpperCase();
  const searches = [
    ["mahasiswa", { [Op.or]: [{ nim: value }, { email: lower }] }],
    ["sekretaris_prodi", { [Op.or]: [{ nik: value }, { email: lower }] }],
    ["dosen", { [Op.or]: [{ kode_dosen: upper }, { nik: value }, { email: lower }] }],
    ["admin", { [Op.or]: [{ nip: value }, { email: lower }] }],
  ];
  const candidates = (await Promise.all(searches.map(async ([accountType, where]) => {
    const accounts = await spec(accountType).model().findAll({ where });
    return accounts.map((account) => ({ accountType, account }));
  }))).flat();
  if (candidates.length === 0) return null;
  const classified = classifyIdentityCandidates(candidates);
  if (classified.resolved) return classified.resolved;
  throw new AccountSecurityError("Identifier login ambigu.", 409, "IDENTIFIER_AMBIGUOUS", {
    account_types: classified.accountTypes,
  });
}

async function resolveRecoveryAccounts(normalizedEmail, transaction = null) {
  const email = String(normalizedEmail || "").trim().toLowerCase(); if (!email) return [];
  const found = [];
  for (const accountType of Object.keys(TYPES)) { const account = await spec(accountType).model().findOne({ where: { email }, transaction }); if (account) found.push({ accountType, account }); }
  return found;
}

function credentialState(account) { return account.credential_state || (account.is_default_password ? "default" : "active"); }
function isAccountLoginAllowed(accountType, account) {
  if (!account) return false;
  if (accountType !== "dosen") return true;
  return getDosenStatusDecision({ statusKeaktifan: account.status_keaktifan, accountIsActive: account.account_is_active,
    continueExistingSupervision: account.continue_existing_supervision }).can_login;
}
function identifiers(accountType, account) { return spec(accountType).identifiers.map((field) => account[field]).filter(Boolean).map(String); }

module.exports = { TYPES, AccountSecurityError, resolveAccount, resolveAccountByLoginIdentifier, resolveRecoveryAccounts,
  classifyIdentityCandidates, normalizedIdentityValue, credentialState, isAccountLoginAllowed, identifiers };
