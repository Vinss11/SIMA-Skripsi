"use strict";

const COLUMNS = {
  BimbinganSkripsis: ["correlation_id"],
  ImportNilaiPenjaluranRows: ["expected_payload", "result_attempt_id"],
  ImportNilaiPenjalurans: ["original_filename"],
  MappingMataKuliahPenjalurans: ["metadata"],
  MataKuliahs: ["sks_default", "kode_program_studi", "role_akademik", "status", "metadata"],
  Pengajuans: ["surat_pengunduran_diri"],
  PercobaanMataKuliahMahasiswas: [
    "external_record_id",
    "kelas_normalized",
    "attempt_number_source",
    "sks_diambil",
    "sks_lulus",
    "nilai_angka",
    "credit_origin",
    "recognition_status",
    "effective_at",
    "academic_effective_at",
    "recorded_at",
    "superseded_at",
    "metadata",
  ],
  PeriodeAkademiks: ["external_id", "tahun_mulai", "tahun_selesai", "sumber", "metadata"],
  PeriodePenjalurans: ["pengawas_jalur_lain_dosen_id"],
};

const quote = identifier => `"${String(identifier).replaceAll('"', '""')}"`;

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async transaction => {
      for (const [table, columns] of Object.entries(COLUMNS)) {
        const clauses = columns.map(column => `DROP COLUMN IF EXISTS ${quote(column)} CASCADE`).join(",\n          ");
        await queryInterface.sequelize.query(
          `ALTER TABLE ${quote(table)}\n          ${clauses}`,
          { transaction }
        );
      }

      await queryInterface.addIndex("MataKuliahs", ["kode", "program_kuliah"], {
        name: "mata_kuliahs_kode_program_unique",
        unique: true,
        transaction,
      });
    });
  },

  async down() {
    throw new Error("Migration penghapusan kolom tidak terpakai bersifat irreversible.");
  },
};
