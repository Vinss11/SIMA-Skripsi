"use strict";

function required(name) {
  const value = process.env[name];
  if (!value || /change-me|your-secret|default/i.test(value)) throw new Error(`${name} wajib dikonfigurasi dengan nilai non-default.`);
  return value;
}

function getJwtConfig() {
  return { secret: required("JWT_SECRET"), algorithm: "HS256", issuer: process.env.JWT_ISSUER || "sima",
    audience: process.env.JWT_AUDIENCE || "sima-api", expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m" };
}

function recoveryEnabled() { return String(process.env.AUTH_RECOVERY_ENABLED || "false").toLowerCase() === "true"; }

function getDeliveryConfig() {
  const raw = required("AUTH_DELIVERY_KEY");
  const key = /^[a-f0-9]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("AUTH_DELIVERY_KEY harus tepat 32 byte.");
  const origin = new URL(required("AUTH_FRONTEND_ORIGIN"));
  if (!/^https?:$/.test(origin.protocol)) throw new Error("AUTH_FRONTEND_ORIGIN tidak valid.");
  return { key, keyVersion: process.env.AUTH_DELIVERY_KEY_VERSION || "v1", frontendOrigin: origin.origin };
}

module.exports = { getJwtConfig, recoveryEnabled, getDeliveryConfig };
