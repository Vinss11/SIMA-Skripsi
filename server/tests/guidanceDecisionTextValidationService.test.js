"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  getGuidanceDecisionTextValidationError,
  validateGuidanceDecisionFields,
} = require("../services/guidanceDecisionTextValidationService");

test("approve mewajibkan catatan persetujuan dan ruangan bimbingan", () => {
  const missingNote = validateGuidanceDecisionFields({ action: "approve", catatan: "", lokasi: "" });
  assert.equal(missingNote.error?.message, "Catatan/pesan persetujuan wajib diisi.");
  assert.equal(missingNote.error?.field, "catatan_dosen");

  const missingLocation = validateGuidanceDecisionFields({
    action: "approve",
    catatan: "Silakan hadir tepat waktu.",
    lokasi: "",
  });
  assert.equal(missingLocation.error?.message, "Ruangan bimbingan wajib diisi.");
  assert.equal(missingLocation.error?.field, "lokasi_bimbingan");
});

test("catatan dan ruangan menerima karakter umum", () => {
  assert.equal(getGuidanceDecisionTextValidationError("Silakan hadir tepat waktu.", "Catatan"), "");
  assert.equal(getGuidanceDecisionTextValidationError("Ruang Dosen 2.14 atau Zoom", "Ruangan"), "");
});

test("catatan dan ruangan menolak karakter khusus", () => {
  for (const character of ["{", "}", "[", "]", "<", ">", "?", "+", "=", "_", "/", "\\", "|", ":", ";", "'", '"']) {
    assert.match(
      getGuidanceDecisionTextValidationError(`Isi ${character} tidak valid`, "Catatan/pesan persetujuan"),
      /tidak boleh mengandung karakter/
    );
  }
});

test("catatan dan ruangan menolak pola komentar SQL", () => {
  assert.match(getGuidanceDecisionTextValidationError("Ruang -- komentar", "Ruangan bimbingan"), /komentar SQL/);
});
