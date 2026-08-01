"use strict";

const ALLOWED_METHODOLOGY_STATUS = new Set(["belum_mengambil", "sedang_mengambil", "lulus", "tidak_lulus", "mengulang"]);
const ALLOWED_REGISTRATION_STATUS = new Set(["planned", "enrolled", "completed", "withdrawn", "cancelled"]);
const ALLOWED_PASS_STATUS = new Set(["passed", "failed", "unknown"]);
const ALLOWED_CREDIT_ORIGIN = new Set(["regular", "transfer", "conversion", "mbkm", "waived", "exempted"]);
const ALLOWED_RECOGNITION = new Set(["not_required", "pending", "recognized", "rejected"]);

function normalizeCode(value) {
  return String(value ?? "").trim().toUpperCase().replace(/\s+/g, "");
}

function normalizeNim(value) {
  return String(value ?? "").trim().replace(/\s+/g, "");
}

function parseNullableNumber(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : NaN;
}

function parseAcademicPeriodCode(value) {
  const code = normalizeCode(value).replace(/\//g, "-");
  const match = code.match(/^(\d{4})-(\d{4})-(GANJIL|GENAP)$/);
  if (!match) return null;
  const tahunMulai = Number(match[1]);
  const tahunSelesai = Number(match[2]);
  if (tahunSelesai !== tahunMulai + 1) return null;
  return { kode: code, tahun_mulai: tahunMulai, tahun_selesai: tahunSelesai, semester: match[3].toLowerCase() };
}

function isCreditRecognized(origin, recognitionStatus) {
  return origin === "regular" || recognitionStatus === "recognized" || recognitionStatus === "not_required";
}

function validateAttempt(input) {
  const errors = [];
  const statusRegistrasi = String(input.status_registrasi || "").trim().toLowerCase();
  const statusKelulusan = String(input.status_kelulusan || "unknown").trim().toLowerCase();
  const creditOrigin = String(input.credit_origin || "regular").trim().toLowerCase();
  const recognitionStatus = String(input.recognition_status || (creditOrigin === "regular" ? "not_required" : "pending")).trim().toLowerCase();
  const sks = parseNullableNumber(input.sks);
  const nilaiAngka = parseNullableNumber(input.nilai_angka);
  if (!ALLOWED_REGISTRATION_STATUS.has(statusRegistrasi)) errors.push("ACADEMIC_REGISTRATION_STATUS_INVALID");
  if (!ALLOWED_PASS_STATUS.has(statusKelulusan)) errors.push("ACADEMIC_PASS_STATUS_INVALID");
  if (!ALLOWED_CREDIT_ORIGIN.has(creditOrigin)) errors.push("ACADEMIC_CREDIT_ORIGIN_INVALID");
  if (!ALLOWED_RECOGNITION.has(recognitionStatus)) errors.push("ACADEMIC_RECOGNITION_STATUS_INVALID");
  if (!Number.isFinite(sks) || sks <= 0) errors.push("ACADEMIC_CREDITS_INVALID");
  if (Number.isNaN(nilaiAngka)) errors.push("ACADEMIC_NUMERIC_GRADE_INVALID");
  if (nilaiAngka !== null && Number.isFinite(nilaiAngka) && (nilaiAngka < 0 || nilaiAngka > 100)) errors.push("ACADEMIC_NUMERIC_GRADE_OUT_OF_RANGE");
  if (input.attempt_ke !== null && input.attempt_ke !== undefined && String(input.attempt_ke).trim() !== ""
    && (!Number.isInteger(Number(input.attempt_ke)) || Number(input.attempt_ke) <= 0)) errors.push("ACADEMIC_ATTEMPT_NUMBER_INVALID");
  if (["planned", "enrolled"].includes(statusRegistrasi) && statusKelulusan !== "unknown") errors.push("ACADEMIC_RESULT_NOT_FINAL");
  if (["withdrawn", "cancelled"].includes(statusRegistrasi) && statusKelulusan === "passed") errors.push("ACADEMIC_WITHDRAWN_CANNOT_PASS");
  return { errors, normalized: { status_registrasi: statusRegistrasi, status_kelulusan: statusKelulusan,
    credit_origin: creditOrigin, recognition_status: recognitionStatus, sks, nilai_angka: nilaiAngka } };
}

function validateMethodologyStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return { normalized, valid: ALLOWED_METHODOLOGY_STATUS.has(normalized) };
}

function mapEffectiveDecision(mode, evaluatedResult, undeterminedPolicy = "warn") {
  if (mode === "informational") return evaluatedResult === "eligible" ? "allow" : "warn";
  if (mode === "shadow") return evaluatedResult === "eligible" ? "allow" : "warn";
  if (evaluatedResult === "eligible") return "allow";
  if (evaluatedResult === "blocked") return "block";
  return undeterminedPolicy === "block" ? "block" : undeterminedPolicy === "allow" ? "allow" : "warn";
}

function sanitizeSpreadsheetString(value) {
  if (typeof value !== "string") return value;
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

module.exports = { normalizeCode, normalizeNim, parseNullableNumber, parseAcademicPeriodCode,
  isCreditRecognized, validateAttempt, validateMethodologyStatus, mapEffectiveDecision,
  sanitizeSpreadsheetString, ALLOWED_METHODOLOGY_STATUS };
