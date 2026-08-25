const test = require("node:test");
const assert = require("node:assert/strict");
const XLSX = require("xlsx");

const { buildTopikImportTemplateBuffer } = require("../services/topikImportTemplateService");

test("template import topik tidak lagi menyediakan kolom kode topik", () => {
  const buffer = buildTopikImportTemplateBuffer();

  assert.ok(Buffer.isBuffer(buffer));
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  assert.deepEqual(rows[0], ["Judul", "Deskripsi", "Bidang Penelitian", "Cluster"]);
});
