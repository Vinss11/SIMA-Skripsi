"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const fk = (model, allowNull = false, onDelete = "RESTRICT") => ({ type: Sequelize.INTEGER, allowNull, references: { model, key: "id" }, onUpdate: "CASCADE", onDelete });
    const timestamps = {
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
    };
    const id = { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false };
    const json = (value) => ({ type: Sequelize.JSONB, allowNull: false, defaultValue: value });

    await queryInterface.sequelize.transaction(async (transaction) => {
      const attempts = await queryInterface.describeTable("PercobaanMataKuliahMahasiswas");
      if (!attempts.pendaftaran_penjaluran_id) await queryInterface.addColumn("PercobaanMataKuliahMahasiswas", "pendaftaran_penjaluran_id", fk("PendaftaranPenjalurans", true, "SET NULL"), { transaction });
      if (!attempts.nilai_penjaluran_import_row_id) await queryInterface.addColumn("PercobaanMataKuliahMahasiswas", "nilai_penjaluran_import_row_id", { type: Sequelize.INTEGER, allowNull: true }, { transaction });

      const existing = new Set((await queryInterface.showAllTables({ transaction })).map((v) => typeof v === "string" ? v : v.tableName));
      if (!existing.has("MappingMataKuliahPenjalurans")) await queryInterface.createTable("MappingMataKuliahPenjalurans", {
        id, kurikulum_id: fk("Kurikulums", true, "CASCADE"), jalur: { type: Sequelize.STRING(40), allowNull: false },
        mata_kuliah_id: fk("MataKuliahs"), periode_berlaku_id: fk("PeriodeAkademiks", true, "SET NULL"),
        program_kuliah: { type: Sequelize.STRING(30), allowNull: false, defaultValue: "reguler" },
        is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true }, metadata: json({}), ...timestamps,
      }, { transaction });
      if (!existing.has("KewajibanMataKuliahPenjalurans")) await queryInterface.createTable("KewajibanMataKuliahPenjalurans", {
        id, mahasiswa_id: fk("Mahasiswas"), pendaftaran_penjaluran_id: fk("PendaftaranPenjalurans", false, "CASCADE"),
        mata_kuliah_id: fk("MataKuliahs"), status: { type: Sequelize.STRING(40), allowNull: false, defaultValue: "belum_tersedia" },
        fulfilled_attempt_id: fk("PercobaanMataKuliahMahasiswas", true, "SET NULL"), ...timestamps,
      }, { transaction });
      if (!existing.has("ImportNilaiPenjalurans")) await queryInterface.createTable("ImportNilaiPenjalurans", {
        id, periode_penjaluran_id: fk("PeriodePenjalurans"), original_filename: { type: Sequelize.STRING(255), allowNull: false },
        file_sha256: { type: Sequelize.STRING(64), allowNull: false }, status: { type: Sequelize.STRING(40), allowNull: false, defaultValue: "validated" },
        counts: json({}), uploaded_by: { type: Sequelize.INTEGER, allowNull: false }, committed_by: { type: Sequelize.INTEGER, allowNull: true },
        committed_at: { type: Sequelize.DATE, allowNull: true }, ...timestamps,
      }, { transaction });
      if (!existing.has("ImportNilaiPenjaluranRows")) await queryInterface.createTable("ImportNilaiPenjaluranRows", {
        id, import_id: fk("ImportNilaiPenjalurans", false, "CASCADE"), row_number: { type: Sequelize.INTEGER, allowNull: false },
        pendaftaran_penjaluran_id: fk("PendaftaranPenjalurans", true, "SET NULL"), mata_kuliah_id: fk("MataKuliahs", true, "SET NULL"),
        nilai_huruf: { type: Sequelize.STRING(10), allowNull: true }, is_valid: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        errors: json([]), raw_payload: json({}), expected_payload: json({}), old_grade: { type: Sequelize.STRING(10), allowNull: true },
        result_attempt_id: { type: Sequelize.INTEGER, allowNull: true }, ...timestamps,
      }, { transaction });

      await queryInterface.sequelize.query('CREATE UNIQUE INDEX IF NOT EXISTS uq_mapping_penjaluran_scope ON "MappingMataKuliahPenjalurans" (COALESCE(kurikulum_id, 0), jalur, program_kuliah, COALESCE(periode_berlaku_id, 0))', { transaction });
      await queryInterface.addIndex("KewajibanMataKuliahPenjalurans", ["pendaftaran_penjaluran_id", "mata_kuliah_id"], { name: "uq_kewajiban_penjaluran", unique: true, transaction });
      await queryInterface.addIndex("ImportNilaiPenjalurans", ["periode_penjaluran_id", "file_sha256"], { name: "uq_import_nilai_penjaluran_file", unique: true, transaction });
      await queryInterface.addIndex("ImportNilaiPenjaluranRows", ["import_id", "row_number"], { name: "uq_import_nilai_penjaluran_row", unique: true, transaction });
      await queryInterface.sequelize.query('CREATE UNIQUE INDEX IF NOT EXISTS uq_attempt_penjaluran_active ON "PercobaanMataKuliahMahasiswas" (pendaftaran_penjaluran_id, mata_kuliah_id) WHERE is_active = true AND pendaftaran_penjaluran_id IS NOT NULL', { transaction });

      await queryInterface.sequelize.query(`
        INSERT INTO "SumberDataAkademiks" (kode, nama, jenis, kode_program_studi, authority_level, is_active, metadata, "createdAt", "updatedAt")
        VALUES ('NILAI-PENJALURAN', 'Import Nilai Mata Kuliah Penjaluran', 'penjaluran_grade_import', 'INFORMATIKA', 100, true, '{}'::jsonb, NOW(), NOW())
        ON CONFLICT (kode) DO NOTHING
      `, { transaction });
      const courses = [
        ["METOPEN", "Metodologi Penelitian", "methodology"], ["MANDIRI", "Manajemen Diri", "self_management"],
        ["PERBIS", "Metodologi Perintisan Bisnis", "business_methodology"],
      ];
      for (const program of ["reguler", "internasional"]) for (const [kode, nama, role] of courses) {
        await queryInterface.sequelize.query(`
          INSERT INTO "MataKuliahs" (kode, nama, sks_default, kode_program_studi, program_kuliah, role_akademik, status, metadata, "createdAt", "updatedAt")
          VALUES (:kode, :nama, 3, 'INFORMATIKA', :program, :role, 'active', '{}'::jsonb, NOW(), NOW())
          ON CONFLICT (kode, kode_program_studi, program_kuliah) DO UPDATE SET nama = EXCLUDED.nama, role_akademik = EXCLUDED.role_akademik, "updatedAt" = NOW()
        `, { replacements: { kode, nama, program, role }, transaction });
      }
      for (const program of ["reguler", "internasional"]) for (const [jalur, kode] of [["penelitian", "METOPEN"], ["magang", "MANDIRI"], ["perintisan_bisnis", "PERBIS"]]) {
        await queryInterface.sequelize.query(`
          INSERT INTO "MappingMataKuliahPenjalurans" (kurikulum_id, jalur, mata_kuliah_id, periode_berlaku_id, program_kuliah, is_active, metadata, "createdAt", "updatedAt")
          SELECT NULL, :jalur, id, NULL, :program, true, '{}'::jsonb, NOW(), NOW() FROM "MataKuliahs"
          WHERE kode = :kode AND kode_program_studi = 'INFORMATIKA' AND program_kuliah = :program
          ON CONFLICT DO NOTHING
        `, { replacements: { jalur, kode, program }, transaction });
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeColumn("PercobaanMataKuliahMahasiswas", "nilai_penjaluran_import_row_id", { transaction });
      await queryInterface.removeColumn("PercobaanMataKuliahMahasiswas", "pendaftaran_penjaluran_id", { transaction });
      for (const table of ["ImportNilaiPenjaluranRows", "ImportNilaiPenjalurans", "KewajibanMataKuliahPenjalurans", "MappingMataKuliahPenjalurans"]) await queryInterface.dropTable(table, { transaction });
    });
  },
};
