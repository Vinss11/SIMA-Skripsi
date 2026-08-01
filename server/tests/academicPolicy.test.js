"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const policy = require("../services/academicPolicy");

test("Tahap 5 policy: periode, nilai nol, missing, mode rule, dan formula sanitizer", () => {
  assert.deepEqual(policy.parseAcademicPeriodCode("2026-2027-ganjil"), { kode: "2026-2027-GANJIL", tahun_mulai: 2026, tahun_selesai: 2027, semester: "ganjil" });
  assert.equal(policy.parseAcademicPeriodCode("2026-2028-GANJIL"), null);
  assert.equal(policy.parseNullableNumber(0), 0);
  assert.equal(policy.parseNullableNumber("0"), 0);
  assert.equal(policy.parseNullableNumber(""), null);
  assert.equal(policy.mapEffectiveDecision("shadow", "blocked"), "warn");
  assert.equal(policy.mapEffectiveDecision("informational", "undetermined"), "warn");
  assert.equal(policy.mapEffectiveDecision("enforced", "blocked"), "block");
  assert.equal(policy.sanitizeSpreadsheetString("=2+2"), "'=2+2");
  assert.equal(policy.sanitizeSpreadsheetString(-10), -10);
});

test("Tahap 5 policy: validasi attempt membedakan nilai kosong dan kombinasi status", () => {
  const valid = policy.validateAttempt({ sks: 3, nilai_angka: 0, status_registrasi: "completed", status_kelulusan: "failed" });
  assert.deepEqual(valid.errors, []);
  assert.equal(valid.normalized.nilai_angka, 0);
  const invalid = policy.validateAttempt({ sks: 3, status_registrasi: "withdrawn", status_kelulusan: "passed" });
  assert.ok(invalid.errors.includes("ACADEMIC_WITHDRAWN_CANNOT_PASS"));
});
