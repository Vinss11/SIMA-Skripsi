"use strict";

// Generates the reviewable DBML artifact from the current Sequelize models.
// Run from the repository root: node docs/database/generate-physical-relational-dbml.js

const fs = require("fs");
const path = require("path");

process.env.DATABASE_URL_DEV ||= "postgres://schema:schema@127.0.0.1:5432/schema";
const db = require(path.resolve(__dirname, "../../server/models"));

const phaseOrder = [
  "AKTOR DAN AKUN",
  "PERIODE DAN TATA KELOLA",
  "PENJALURAN DAN PENGAJUAN",
  "PENETAPAN PEMBIMBING",
  "NILAI MATA KULIAH PENJALURAN",
  "BIMBINGAN DAN KELAYAKAN SIDANG",
  "PERIODE DAN PENJADWALAN SIDANG",
  "NOTIFIKASI DAN KEAMANAN",
];

const phaseTables = {
  "AKTOR DAN AKUN": ["Admins", "Dosens", "SekretarisProdis", "Mahasiswas"],
  "PERIODE DAN TATA KELOLA": [
    "PeriodeAkademiks", "PeriodePenjalurans", "Klasters", "DosenKlasters",
    "KlasterKetuaPeriodes", "MasterPenanggungJawabPenjalurans",
    "DosenKetersediaanPeriodes", "RiwayatKetersediaanMembimbings",
    "RiwayatStatusDosens", "TindakLanjutStatusDosens",
  ],
  "PENJALURAN DAN PENGAJUAN": [
    "Topiks", "MitraMagangs", "KelompokPerintisanBisnis",
    "AnggotaKelompokPerintisans", "PendaftaranPenjalurans", "Pengajuans",
    "RiwayatPersetujuans", "RiwayatWorkflowPenjalurans", "PamitUlangs",
    "RiwayatPamitPenjalurans", "IzinLanjutSkripsis",
  ],
  "PENETAPAN PEMBIMBING": [
    "SuratTugasPembimbings", "PenetapanPembimbings",
    "PenetapanPembimbingDosens", "AssignmentActivationAttempts",
  ],
  "NILAI MATA KULIAH PENJALURAN": [
    "MataKuliahs", "MappingMataKuliahPenjalurans", "ImportNilaiPenjalurans",
    "ImportNilaiPenjaluranRows", "PercobaanMataKuliahMahasiswas",
  ],
  "BIMBINGAN DAN KELAYAKAN SIDANG": ["BimbinganSkripsis", "DokumenSidangs"],
  "PERIODE DAN PENJADWALAN SIDANG": [
    "PeriodeSidangs", "PeriodeSidangHaris", "PeriodeSidangRuangans",
    "PreferensiPengujiSidangs", "KetersediaanPengujiSidangs",
    "PendaftaranSidangs", "JadwalSidangPengujis",
  ],
  "NOTIFIKASI DAN KEAMANAN": [
    "Notifikasis", "AuthSessions", "PasswordResetTokens", "AuthOutboxes",
    "AuthSecurityEvents", "AuthRateLimitBuckets",
  ],
};

// References present in the migrations but intentionally absent from a few
// lightweight Sequelize model declarations.
const inferredRefs = {
  "BimbinganSkripsis.reassigned_by_sekretaris_id": "SekretarisProdis.id",
  "AuthOutboxes.reset_token_id": "PasswordResetTokens.id",
  "AuthSecurityEvents.session_id": "AuthSessions.id",
  "MappingMataKuliahPenjalurans.mata_kuliah_id": "MataKuliahs.id",
  "MappingMataKuliahPenjalurans.periode_berlaku_id": "PeriodeAkademiks.id",
  "ImportNilaiPenjalurans.periode_penjaluran_id": "PeriodePenjalurans.id",
  "ImportNilaiPenjaluranRows.import_id": "ImportNilaiPenjalurans.id",
  "ImportNilaiPenjaluranRows.pendaftaran_penjaluran_id": "PendaftaranPenjalurans.id",
  "ImportNilaiPenjaluranRows.mata_kuliah_id": "MataKuliahs.id",
  "ImportNilaiPenjaluranRows.result_attempt_id": "PercobaanMataKuliahMahasiswas.id",
  "PercobaanMataKuliahMahasiswas.mahasiswa_id": "Mahasiswas.id",
  "PercobaanMataKuliahMahasiswas.pendaftaran_penjaluran_id": "PendaftaranPenjalurans.id",
  "PercobaanMataKuliahMahasiswas.mata_kuliah_id": "MataKuliahs.id",
  "PercobaanMataKuliahMahasiswas.periode_akademik_id": "PeriodeAkademiks.id",
  "PercobaanMataKuliahMahasiswas.nilai_penjaluran_import_row_id": "ImportNilaiPenjaluranRows.id",
  "PercobaanMataKuliahMahasiswas.previous_version_id": "PercobaanMataKuliahMahasiswas.id",
};

const enumNames = new Map();
const enumDefinitions = [];
const enumKey = (table, field) => `${table}_${field}_enum`.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();

function dbmlType(table, field, attribute) {
  if (attribute.type?.values) {
    const name = enumKey(table, field);
    if (!enumNames.has(name)) {
      enumNames.set(name, true);
      enumDefinitions.push(`Enum ${name} {\n${attribute.type.values.map((v) => `  ${v}`).join("\n")}\n}`);
    }
    return name;
  }
  const raw = attribute.type?.toString?.() || String(attribute.type);
  if (raw === "TIMESTAMP WITH TIME ZONE") return "timestamptz";
  if (raw === "DOUBLE PRECISION") return "double";
  return raw.toLowerCase();
}

function referenceTarget(table, field, attribute) {
  const model = attribute.references?.model;
  const referencedTable = typeof model === "string" ? model : model?.tableName;
  if (referencedTable) return `${referencedTable}.${attribute.references.key || "id"}`;
  return inferredRefs[`${table}.${field}`];
}

function defaultOption(attribute) {
  if (attribute.defaultValue === undefined) return null;
  const value = attribute.defaultValue;
  if (typeof value === "boolean" || typeof value === "number") return `default: ${value}`;
  if (value?.key === "NOW" || String(value) === "NOW") return "default: `now()`";
  if (typeof value === "string") return `default: '${value.replaceAll("'", "\\'")}'`;
  return null;
}

function renderTable(model) {
  const table = model.tableName;
  const lines = [`Table ${table} {`];
  for (const [field, attribute] of Object.entries(model.rawAttributes)) {
    const options = [];
    if (attribute.primaryKey) options.push("pk");
    if (attribute.autoIncrement) options.push("increment");
    if (attribute.allowNull === false) options.push("not null");
    if (attribute.unique === true) options.push("unique");
    const target = referenceTarget(table, field, attribute);
    if (target) options.push(`ref: > ${target}`);
    const defaultValue = defaultOption(attribute);
    if (defaultValue) options.push(defaultValue);
    lines.push(`  ${field} ${dbmlType(table, field, attribute)}${options.length ? ` [${options.join(", ")}]` : ""}`);
  }
  lines.push("  Note: 'CURRENT — tabel fisik yang didefinisikan backend Sequelize/migration'", "}");
  return lines.join("\n");
}

const modelsByTable = new Map(Object.values(db.sequelize.models).map((model) => [model.tableName, model]));
const generatedTables = [];
for (const phase of phaseOrder) {
  generatedTables.push(`// ============================================================================\n// ${phase}\n// ============================================================================`);
  for (const table of phaseTables[phase]) {
    const model = modelsByTable.get(table);
    if (!model) throw new Error(`Model untuk tabel ${table} tidak ditemukan`);
    generatedTables.push(renderTable(model));
  }
}

const proposed = `
// ============================================================================
// USULAN PENAMBAHAN — MELENGKAPI FLOW BPMN V1.2
// Belum ada di migration/backend saat file ini dihasilkan.
// ============================================================================

Enum jenis_dokumen_sidang_enum {
  transkrip
  cept
  draft_skripsi
  revisi_skripsi
  lembar_pengesahan
}

Enum status_review_dokumen_enum {
  submitted
  revision_required
  approved
  rejected
}

Enum peran_penilai_sidang_enum {
  pembimbing
  penguji_1
  penguji_2
}

Enum status_penilaian_sidang_enum {
  draft
  submitted
  locked
}

Enum status_hasil_sidang_enum {
  pending
  lulus_tanpa_revisi
  lulus_dengan_revisi
  tidak_lulus
}

Enum status_revisi_skripsi_enum {
  required
  submitted
  revision_required
  approved
}

Enum status_yudisium_enum {
  pending
  verified
  formalized
  cancelled
}

Table PendaftaranMagangs {
  id bigint [pk, increment]
  pendaftaran_penjaluran_id integer [not null, unique, ref: - PendaftaranPenjalurans.id]
  mitra_magang_id integer [not null, ref: > MitraMagangs.id]
  posisi_dilamar varchar(180)
  surat_penerimaan_file_path varchar(500)
  tanggal_mulai date
  tanggal_selesai date
  createdAt timestamptz [not null, default: \`now()\`]
  updatedAt timestamptz [not null, default: \`now()\`]
  Note: 'PROPOSED — mengganti penyimpanan detail mitra magang yang sekarang berada di form_lanjutan_payload JSONB'
}

Table PendaftaranPengabdians {
  id bigint [pk, increment]
  pendaftaran_penjaluran_id integer [not null, unique, ref: - PendaftaranPenjalurans.id]
  nama_mitra_masyarakat varchar(180) [not null]
  lokasi varchar(255) [not null]
  kontak_mitra varchar(180)
  skema_pengabdian varchar(120)
  proposal_file_path varchar(500)
  createdAt timestamptz [not null, default: \`now()\`]
  updatedAt timestamptz [not null, default: \`now()\`]
  Note: 'PROPOSED — detail relasional jalur pengabdian; tabel ini belum ada pada backend saat ini'
}

Table DokumenSidangVersions {
  id bigint [pk, increment]
  pendaftaran_penjaluran_id integer [not null, ref: > PendaftaranPenjalurans.id]
  pendaftaran_sidang_id integer [ref: > PendaftaranSidangs.id]
  mahasiswa_id integer [not null, ref: > Mahasiswas.id]
  jenis_dokumen jenis_dokumen_sidang_enum [not null]
  version_number integer [not null]
  file_path varchar(500) [not null]
  file_name varchar(255) [not null]
  file_sha256 varchar(64) [not null]
  status status_review_dokumen_enum [not null, default: 'submitted']
  uploaded_at timestamptz [not null, default: \`now()\`]
  superseded_at timestamptz
  createdAt timestamptz [not null, default: \`now()\`]
  updatedAt timestamptz [not null, default: \`now()\`]

  Indexes {
    (pendaftaran_penjaluran_id, jenis_dokumen, version_number) [unique]
    (pendaftaran_penjaluran_id, jenis_dokumen, status)
  }
  Note: 'PROPOSED — menormalkan upload/re-upload dokumen yang pada tabel lama masih berupa kolom tetap'
}

Table ReviewDokumenSidangs {
  id bigint [pk, increment]
  dokumen_version_id bigint [not null, ref: > DokumenSidangVersions.id]
  reviewer_dosen_id integer [not null, ref: > Dosens.id]
  penetapan_pembimbing_dosen_id integer [ref: > PenetapanPembimbingDosens.id]
  keputusan status_review_dokumen_enum [not null]
  catatan text
  decided_at timestamptz [not null, default: \`now()\`]
  createdAt timestamptz [not null, default: \`now()\`]
  updatedAt timestamptz [not null, default: \`now()\`]

  Indexes {
    (dokumen_version_id, reviewer_dosen_id) [unique]
  }
  Note: 'PROPOSED — keputusan pembimbing atas setiap versi dokumen sidang'
}

Table RubrikPenilaianSidangs {
  id integer [pk, increment]
  kode varchar(40) [not null, unique]
  nama varchar(160) [not null]
  bobot decimal(5,2) [not null]
  nilai_maksimum decimal(5,2) [not null, default: 100]
  is_active boolean [not null, default: true]
  createdAt timestamptz [not null, default: \`now()\`]
  updatedAt timestamptz [not null, default: \`now()\`]
  Note: 'PROPOSED — master komponen/rubrik agar rumus nilai tidak ditanam sebagai kolom tetap'
}

Table PenilaianSidangs {
  id bigint [pk, increment]
  jadwal_sidang_penguji_id integer [not null, ref: > JadwalSidangPengujis.id]
  dosen_id integer [not null, ref: > Dosens.id]
  peran_penilai peran_penilai_sidang_enum [not null]
  status status_penilaian_sidang_enum [not null, default: 'draft']
  nilai_total decimal(5,2)
  catatan text
  submitted_at timestamptz
  locked_at timestamptz
  createdAt timestamptz [not null, default: \`now()\`]
  updatedAt timestamptz [not null, default: \`now()\`]

  Indexes {
    (jadwal_sidang_penguji_id, dosen_id, peran_penilai) [unique]
  }
  Note: 'PROPOSED — satu lembar nilai per penilai pada satu jadwal sidang'
}

Table DetailNilaiSidangs {
  id bigint [pk, increment]
  penilaian_sidang_id bigint [not null, ref: > PenilaianSidangs.id]
  rubrik_penilaian_sidang_id integer [not null, ref: > RubrikPenilaianSidangs.id]
  nilai decimal(5,2) [not null]
  createdAt timestamptz [not null, default: \`now()\`]
  updatedAt timestamptz [not null, default: \`now()\`]

  Indexes {
    (penilaian_sidang_id, rubrik_penilaian_sidang_id) [unique]
  }
  Note: 'PROPOSED — detail nilai ternormalisasi per komponen rubrik'
}

Table HasilSidangs {
  id bigint [pk, increment]
  jadwal_sidang_penguji_id integer [not null, unique, ref: - JadwalSidangPengujis.id]
  nilai_akhir decimal(5,2)
  status_hasil status_hasil_sidang_enum [not null, default: 'pending']
  batas_revisi_at timestamptz
  berita_acara_file_path varchar(500)
  finalized_by_sekretaris_id integer [ref: > SekretarisProdis.id]
  finalized_at timestamptz
  createdAt timestamptz [not null, default: \`now()\`]
  updatedAt timestamptz [not null, default: \`now()\`]
  Note: 'PROPOSED — hasil agregat dan keputusan kelulusan sidang'
}

Table RevisiSkripsis {
  id bigint [pk, increment]
  hasil_sidang_id bigint [not null, ref: > HasilSidangs.id]
  mahasiswa_id integer [not null, ref: > Mahasiswas.id]
  version_number integer [not null]
  ringkasan_perubahan text [not null]
  file_path varchar(500) [not null]
  file_sha256 varchar(64) [not null]
  status status_revisi_skripsi_enum [not null, default: 'submitted']
  submitted_at timestamptz [not null, default: \`now()\`]
  approved_at timestamptz
  createdAt timestamptz [not null, default: \`now()\`]
  updatedAt timestamptz [not null, default: \`now()\`]

  Indexes {
    (hasil_sidang_id, version_number) [unique]
  }
  Note: 'PROPOSED — versi unggahan revisi pasca-sidang'
}

Table PersetujuanRevisiSidangs {
  id bigint [pk, increment]
  revisi_skripsi_id bigint [not null, ref: > RevisiSkripsis.id]
  dosen_id integer [not null, ref: > Dosens.id]
  peran_penilai peran_penilai_sidang_enum [not null]
  keputusan status_review_dokumen_enum [not null]
  catatan text
  decided_at timestamptz [not null, default: \`now()\`]
  createdAt timestamptz [not null, default: \`now()\`]
  updatedAt timestamptz [not null, default: \`now()\`]

  Indexes {
    (revisi_skripsi_id, dosen_id, peran_penilai) [unique]
  }
  Note: 'PROPOSED — approval revisi per pembimbing/penguji'
}

Table Yudisiums {
  id bigint [pk, increment]
  hasil_sidang_id bigint [not null, unique, ref: - HasilSidangs.id]
  mahasiswa_id integer [not null, ref: > Mahasiswas.id]
  periode_akademik_id integer [not null, ref: > PeriodeAkademiks.id]
  status status_yudisium_enum [not null, default: 'pending']
  nomor_keputusan varchar(120)
  tanggal_yudisium date
  verified_by_sekretaris_id integer [ref: > SekretarisProdis.id]
  verified_at timestamptz
  formalized_at timestamptz
  catatan text
  createdAt timestamptz [not null, default: \`now()\`]
  updatedAt timestamptz [not null, default: \`now()\`]
  Note: 'PROPOSED — verifikasi akademik final dan formalisasi yudisium'
}
`;

const header = `// SIMPS / SIMA-Skripsi — Physical Relational Database Schema
// Format: DBML for dbdiagram.io
// Generated from backend models on 2026-08-11 and completed against SIMPS BPMN V1.2.
// IMPORTANT: CURRENT = implemented physical table; PROPOSED = recommendation, not migrated yet.
// REFERENCE ONLY: untuk diagram yang terbaca, gunakan file 01-07 di folder bpmn-flow.

Project SIMPS_SIMA_Skripsi {
  database_type: 'PostgreSQL'
  Note: 'Physical relational schema. Actor tables remain separate; polymorphic security/notification actor IDs intentionally have no FK.'
}`;

// renderTable populates enumDefinitions while rendering generatedTables.
const output = [header, "// ENUMS USED BY CURRENT PHYSICAL TABLES", enumDefinitions.join("\n\n"), generatedTables.join("\n\n"), proposed.trim(), ""].join("\n\n");
const outputPath = path.resolve(__dirname, "simps-physical-relational-schema.dbml");
fs.writeFileSync(outputPath, output, "utf8");
console.log(`Generated ${modelsByTable.size} current tables plus 11 proposed tables: ${outputPath}`);
db.sequelize.close();
