"use strict";

const COMMON = new Set(["password", "password123", "1234567890", "qwerty12345", "admin12345"]);
const MIN_LENGTH = Math.max(10, Number(process.env.AUTH_PASSWORD_MIN_LENGTH || 10));

function validateNewPassword(password, { identifiers = [], currentMatches = false } = {}) {
  const reasons = [];
  if (typeof password !== "string" || password.length < MIN_LENGTH) reasons.push("PASSWORD_TOO_SHORT");
  if (typeof password === "string" && Buffer.byteLength(password, "utf8") > 72) reasons.push("PASSWORD_TOO_LONG");
  if (currentMatches) reasons.push("PASSWORD_SAME_AS_CURRENT");
  const lower = typeof password === "string" ? password.toLowerCase() : "";
  if (COMMON.has(lower)) reasons.push("PASSWORD_TOO_COMMON");
  if (identifiers.some((value) => { const normalized = String(value).toLowerCase(); return normalized && lower === normalized; })) reasons.push("PASSWORD_CONTAINS_IDENTIFIER");
  return { valid: reasons.length === 0, reasons: [...new Set(reasons)], minimumLength: MIN_LENGTH, maximumBytes: 72 };
}

module.exports = { validateNewPassword, MIN_LENGTH };
