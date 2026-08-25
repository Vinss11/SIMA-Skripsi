const test = require("node:test");
const assert = require("node:assert/strict");

const { getTopikTitleValidationError } = require("../services/topikTitleValidationService");

test("judul topik menerima karakter umum yang valid", () => {
  const title = "Deteksi Dini Kanker Kulit (Melanoma) Menggunakan CNN, Versi 2.0 - Mobile";
  assert.equal(getTopikTitleValidationError(title), "");
});

test("judul topik menolak karakter khusus seperti judul penelitian", () => {
  for (const character of ["{", "}", "[", "]", "<", ">", "?", "+", "=", "_", "/", "\\", "|", ":", ";", "'", '"']) {
    assert.match(getTopikTitleValidationError(`Judul ${character} invalid`), /tidak boleh mengandung karakter/);
  }
});

test("judul topik menolak pola komentar SQL", () => {
  assert.match(getTopikTitleValidationError("Judul -- komentar"), /komentar SQL/);
});
