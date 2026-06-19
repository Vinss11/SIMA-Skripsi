"use strict";

function normalizeOrigin(value) {
  const text = String(value || "").trim();
  if (!text) return "";

  try {
    const url = new URL(text);
    return `${url.protocol}//${url.host}`.toLowerCase();
  } catch (error) {
    return text.replace(/\/+$/, "").toLowerCase();
  }
}

function parseAllowedOrigins(value) {
  return new Set(
    String(value || "")
      .split(",")
      .map(normalizeOrigin)
      .filter(Boolean)
  );
}

function isLocalDevelopmentOrigin(origin) {
  try {
    const url = new URL(origin);
    return (
      ["http:", "https:"].includes(url.protocol) &&
      ["localhost", "127.0.0.1", "::1"].includes(url.hostname.toLowerCase())
    );
  } catch (error) {
    return false;
  }
}

function isAllowedVercelPreview(origin) {
  try {
    const url = new URL(origin);
    const hostname = url.hostname.toLowerCase();
    return (
      url.protocol === "https:" &&
      (hostname === "sima-skripsi.vercel.app" ||
        hostname === "sima-skripsi-git-main-vinss11s-projects.vercel.app" ||
        (hostname.startsWith("sima-skripsi-") &&
          hostname.endsWith("-vinss11s-projects.vercel.app")))
    );
  } catch (error) {
    return false;
  }
}

function createCorsOriginValidator(options = {}) {
  const nodeEnv = String(options.nodeEnv || process.env.NODE_ENV || "development").toLowerCase();
  const configuredOrigins = parseAllowedOrigins(
    options.allowedOrigins ?? process.env.CORS_ORIGINS ?? process.env.CORS_ORIGIN
  );

  return function validateCorsOrigin(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }

    const normalizedOrigin = normalizeOrigin(origin);
    const isAllowed =
      configuredOrigins.has(normalizedOrigin) ||
      (nodeEnv !== "production" && isLocalDevelopmentOrigin(origin)) ||
      isAllowedVercelPreview(origin);

    if (isAllowed) {
      return callback(null, true);
    }

    const error = new Error(`Origin ${origin} tidak diizinkan oleh CORS.`);
    error.status = 403;
    error.code = "CORS_ORIGIN_NOT_ALLOWED";
    return callback(error);
  };
}

module.exports = {
  createCorsOriginValidator,
  isAllowedVercelPreview,
  isLocalDevelopmentOrigin,
  normalizeOrigin,
  parseAllowedOrigins,
};
