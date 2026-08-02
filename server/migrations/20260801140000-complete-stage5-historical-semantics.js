"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const alias = await queryInterface.describeTable("MataKuliahAliases");
      if (!alias.program_kuliah) await queryInterface.addColumn("MataKuliahAliases", "program_kuliah", {
        type: Sequelize.STRING(30), allowNull: false, defaultValue: "reguler",
      }, { transaction });
      await queryInterface.sequelize.query(`
        UPDATE "MataKuliahAliases" alias
           SET program_kuliah = course.program_kuliah
          FROM "MataKuliahs" course
         WHERE course.id = alias.mata_kuliah_id
      `, { transaction });

      const equivalence = await queryInterface.describeTable("EkuivalensiMataKuliahs");
      if (!equivalence.mata_kuliah_sumber_id) await queryInterface.addColumn("EkuivalensiMataKuliahs", "mata_kuliah_sumber_id", {
        type: Sequelize.INTEGER, allowNull: true, references: { model: "MataKuliahs", key: "id" }, onUpdate: "CASCADE", onDelete: "RESTRICT",
      }, { transaction });
      if (!equivalence.mata_kuliah_tujuan_id) await queryInterface.addColumn("EkuivalensiMataKuliahs", "mata_kuliah_tujuan_id", {
        type: Sequelize.INTEGER, allowNull: true, references: { model: "MataKuliahs", key: "id" }, onUpdate: "CASCADE", onDelete: "RESTRICT",
      }, { transaction });

      const attempt = await queryInterface.describeTable("PercobaanMataKuliahMahasiswas");
      if (!attempt.academic_effective_at) await queryInterface.addColumn("PercobaanMataKuliahMahasiswas", "academic_effective_at", { type: Sequelize.DATE, allowNull: true }, { transaction });
      if (!attempt.recorded_at) await queryInterface.addColumn("PercobaanMataKuliahMahasiswas", "recorded_at", { type: Sequelize.DATE, allowNull: true }, { transaction });
      await queryInterface.sequelize.query(`
        UPDATE "PercobaanMataKuliahMahasiswas" attempt
           SET academic_effective_at = COALESCE(period.tanggal_selesai, attempt.effective_at),
               recorded_at = COALESCE(attempt."createdAt", attempt.effective_at)
          FROM "PeriodeAkademiks" period
         WHERE period.id = attempt.periode_akademik_id
           AND (attempt.academic_effective_at IS NULL OR attempt.recorded_at IS NULL)
      `, { transaction });
      await queryInterface.changeColumn("PercobaanMataKuliahMahasiswas", "academic_effective_at", { type: Sequelize.DATE, allowNull: false }, { transaction });
      await queryInterface.changeColumn("PercobaanMataKuliahMahasiswas", "recorded_at", { type: Sequelize.DATE, allowNull: false }, { transaction });

      const methodology = await queryInterface.describeTable("RiwayatMetodologiPenelitians");
      if (!methodology.academic_effective_at) await queryInterface.addColumn("RiwayatMetodologiPenelitians", "academic_effective_at", { type: Sequelize.DATE, allowNull: true }, { transaction });
      if (!methodology.recorded_at) await queryInterface.addColumn("RiwayatMetodologiPenelitians", "recorded_at", { type: Sequelize.DATE, allowNull: true }, { transaction });
      await queryInterface.sequelize.query(`
        UPDATE "RiwayatMetodologiPenelitians" history
           SET academic_effective_at = COALESCE(period.tanggal_selesai, history.effective_at),
               recorded_at = COALESCE(history."createdAt", history.effective_at)
          FROM "PeriodeAkademiks" period
         WHERE period.id = history.periode_akademik_id
           AND (history.academic_effective_at IS NULL OR history.recorded_at IS NULL)
      `, { transaction });
      await queryInterface.changeColumn("RiwayatMetodologiPenelitians", "academic_effective_at", { type: Sequelize.DATE, allowNull: false }, { transaction });
      await queryInterface.changeColumn("RiwayatMetodologiPenelitians", "recorded_at", { type: Sequelize.DATE, allowNull: false }, { transaction });

      const snapshot = await queryInterface.describeTable("SnapshotAkademikMahasiswas");
      if (!snapshot.snapshot_scope) await queryInterface.addColumn("SnapshotAkademikMahasiswas", "snapshot_scope", {
        type: Sequelize.STRING(20), allowNull: false, defaultValue: "current",
      }, { transaction });

      await queryInterface.sequelize.query(`DROP INDEX IF EXISTS uq_snapshot_current`, { transaction });
      await queryInterface.sequelize.query(`CREATE UNIQUE INDEX uq_snapshot_current ON "SnapshotAkademikMahasiswas" (mahasiswa_id) WHERE snapshot_scope = 'current' AND is_current = true`, { transaction });
      await queryInterface.sequelize.query(`CREATE UNIQUE INDEX uq_snapshot_period_end ON "SnapshotAkademikMahasiswas" (mahasiswa_id, periode_akademik_id, calculation_version) WHERE snapshot_scope = 'period_end'`, { transaction });
      await queryInterface.sequelize.query(`CREATE UNIQUE INDEX uq_alias_program_scope ON "MataKuliahAliases" (COALESCE(source_id, 0), kode_alias, kode_program_studi, program_kuliah) WHERE is_active = true`, { transaction });
      await queryInterface.sequelize.query(`CREATE UNIQUE INDEX uq_equivalence_direction_pair ON "EkuivalensiMataKuliahs" (mata_kuliah_sumber_id, mata_kuliah_tujuan_id, COALESCE(kurikulum_id, 0)) WHERE mata_kuliah_sumber_id IS NOT NULL AND mata_kuliah_tujuan_id IS NOT NULL AND is_active = true`, { transaction });
      await queryInterface.sequelize.query(`ALTER TABLE "SnapshotAkademikMahasiswas" ADD CONSTRAINT ck_snapshot_scope CHECK (snapshot_scope IN ('current','period_end'))`, { transaction });
      await queryInterface.sequelize.query(`ALTER TABLE "EkuivalensiMataKuliahs" ADD CONSTRAINT ck_equivalence_direction CHECK (arah IN ('bidirectional','source_to_target'))`, { transaction });
      await queryInterface.sequelize.query(`ALTER TABLE "EkuivalensiMataKuliahs" ADD CONSTRAINT ck_equivalence_pair CHECK ((mata_kuliah_sumber_id IS NULL AND mata_kuliah_tujuan_id IS NULL) OR (mata_kuliah_sumber_id IS NOT NULL AND mata_kuliah_tujuan_id IS NOT NULL AND mata_kuliah_sumber_id <> mata_kuliah_tujuan_id))`, { transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const [table, constraint] of [["SnapshotAkademikMahasiswas", "ck_snapshot_scope"], ["EkuivalensiMataKuliahs", "ck_equivalence_direction"], ["EkuivalensiMataKuliahs", "ck_equivalence_pair"]]) {
        await queryInterface.sequelize.query(`ALTER TABLE "${table}" DROP CONSTRAINT IF EXISTS ${constraint}`, { transaction });
      }
      for (const index of ["uq_snapshot_current", "uq_snapshot_period_end", "uq_alias_program_scope", "uq_equivalence_direction_pair"]) await queryInterface.sequelize.query(`DROP INDEX IF EXISTS ${index}`, { transaction });
      await queryInterface.sequelize.query(`CREATE UNIQUE INDEX uq_snapshot_current ON "SnapshotAkademikMahasiswas" (mahasiswa_id) WHERE is_current = true`, { transaction });
      await queryInterface.removeColumn("SnapshotAkademikMahasiswas", "snapshot_scope", { transaction });
      await queryInterface.removeColumn("RiwayatMetodologiPenelitians", "recorded_at", { transaction });
      await queryInterface.removeColumn("RiwayatMetodologiPenelitians", "academic_effective_at", { transaction });
      await queryInterface.removeColumn("PercobaanMataKuliahMahasiswas", "recorded_at", { transaction });
      await queryInterface.removeColumn("PercobaanMataKuliahMahasiswas", "academic_effective_at", { transaction });
      await queryInterface.removeColumn("EkuivalensiMataKuliahs", "mata_kuliah_tujuan_id", { transaction });
      await queryInterface.removeColumn("EkuivalensiMataKuliahs", "mata_kuliah_sumber_id", { transaction });
      await queryInterface.removeColumn("MataKuliahAliases", "program_kuliah", { transaction });
    });
  },
};
