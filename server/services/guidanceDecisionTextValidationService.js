"use strict";

const GUIDANCE_DECISION_FORBIDDEN_CHARACTERS = new Set([
  "+", "=", "_", "{", "}", "[", "]", "<", ">", "/", "?", "\\", "|", ":", ";", "'", '"',
]);

function getGuidanceDecisionTextValidationError(value, label) {
  const text = String(value || "");
  const containsForbiddenCharacter = text.includes("--")
    || Array.from(text).some((character) => GUIDANCE_DECISION_FORBIDDEN_CHARACTERS.has(character));

  return containsForbiddenCharacter
    ? `${label} tidak boleh mengandung karakter { } [ ] < > ? + = _ / \\ | : ; ' ", atau pola -- (komentar SQL).`
    : "";
}

function validateGuidanceDecisionFields({ action, catatan, lokasi }) {
  const isReject = action === "reject";
  const normalizedCatatan = String(catatan || "").trim();
  const normalizedLokasi = String(lokasi || "").trim();
  const catatanLabel = isReject ? "Alasan penolakan" : "Catatan/pesan persetujuan";

  if (!normalizedCatatan) {
    return {
      error: {
        message: `${catatanLabel} wajib diisi.`,
        code: isReject ? "GUIDANCE_REJECTION_REASON_REQUIRED" : "GUIDANCE_APPROVAL_NOTE_REQUIRED",
        field: "catatan_dosen",
      },
    };
  }

  const catatanValidationError = getGuidanceDecisionTextValidationError(normalizedCatatan, catatanLabel);
  if (catatanValidationError) {
    return { error: { message: catatanValidationError, code: "GUIDANCE_DECISION_TEXT_INVALID", field: "catatan_dosen" } };
  }
  if (normalizedCatatan.length < 5) {
    return {
      error: {
        message: `${catatanLabel} minimal 5 karakter.`,
        code: isReject ? "GUIDANCE_REJECTION_REASON_REQUIRED" : "GUIDANCE_APPROVAL_NOTE_INVALID",
        field: "catatan_dosen",
      },
    };
  }

  if (!isReject) {
    if (!normalizedLokasi) {
      return { error: { message: "Ruangan bimbingan wajib diisi.", code: "GUIDANCE_LOCATION_REQUIRED", field: "lokasi_bimbingan" } };
    }
    const lokasiValidationError = getGuidanceDecisionTextValidationError(normalizedLokasi, "Ruangan bimbingan");
    if (lokasiValidationError) {
      return { error: { message: lokasiValidationError, code: "GUIDANCE_DECISION_TEXT_INVALID", field: "lokasi_bimbingan" } };
    }
    if (normalizedLokasi.length < 3) {
      return { error: { message: "Ruangan bimbingan minimal 3 karakter.", code: "GUIDANCE_LOCATION_INVALID", field: "lokasi_bimbingan" } };
    }
  }

  return { normalizedCatatan, normalizedLokasi, error: null };
}

module.exports = { getGuidanceDecisionTextValidationError, validateGuidanceDecisionFields };
