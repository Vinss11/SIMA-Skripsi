"use strict";

const ALLOWED_SEKRETARIS_JABATAN = [
  "Sekretaris Program Studi Informatika - Program Sarjana International Program",
  "Sekretaris Program Studi Informatika - Program Sarjana Reguler",
];

function normalizeJabatanKey(value) {
  return String(value || "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/-/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function generateAliasKeys(value) {
  const base = normalizeJabatanKey(value);
  const aliasSet = new Set([base]);

  // Antisipasi variasi penulisan "international" vs "internasional".
  if (base.includes("international")) {
    aliasSet.add(base.replace(/\binternational\b/g, "internasional"));
  }
  if (base.includes("internasional")) {
    aliasSet.add(base.replace(/\binternasional\b/g, "international"));
  }

  return aliasSet;
}

const ALLOWED_SEKRETARIS_JABATAN_KEYS = new Set(
  ALLOWED_SEKRETARIS_JABATAN.flatMap((item) => Array.from(generateAliasKeys(item)))
);

function isAllowedSekretarisJabatan(jabatan) {
  if (!jabatan) return false;

  const keyCandidates = generateAliasKeys(jabatan);
  for (const key of keyCandidates) {
    if (ALLOWED_SEKRETARIS_JABATAN_KEYS.has(key)) {
      return true;
    }
  }

  return false;
}

function resolveProgramKuliahFromJabatan(jabatan) {
  const normalized = normalizeJabatanKey(jabatan);
  if (normalized.includes("international") || normalized.includes("internasional")) {
    return "internasional";
  }
  if (normalized.includes("reguler")) {
    return "reguler";
  }
  return null;
}

module.exports = {
  ALLOWED_SEKRETARIS_JABATAN,
  normalizeJabatanKey,
  isAllowedSekretarisJabatan,
  resolveProgramKuliahFromJabatan,
};
