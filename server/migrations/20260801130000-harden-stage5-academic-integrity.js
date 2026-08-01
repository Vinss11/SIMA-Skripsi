"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const batch = await queryInterface.describeTable("ImportAkademikBatches");
      if (!batch.commit_idempotency_key) await queryInterface.addColumn("ImportAkademikBatches", "commit_idempotency_key", { type: Sequelize.STRING(160), allowNull: true }, { transaction });
      if (!batch.commit_request_fingerprint) await queryInterface.addColumn("ImportAkademikBatches", "commit_request_fingerprint", { type: Sequelize.STRING(64), allowNull: true }, { transaction });

      const coverage = await queryInterface.describeTable("CakupanDatasetAkademiks");
      if (!coverage.version) await queryInterface.addColumn("CakupanDatasetAkademiks", "version", { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 }, { transaction });
      if (!coverage.previous_version_id) await queryInterface.addColumn("CakupanDatasetAkademiks", "previous_version_id", { type: Sequelize.INTEGER, allowNull: true, references: { model: "CakupanDatasetAkademiks", key: "id" }, onUpdate: "CASCADE", onDelete: "SET NULL" }, { transaction });
      if (!coverage.superseded_at) await queryInterface.addColumn("CakupanDatasetAkademiks", "superseded_at", { type: Sequelize.DATE, allowNull: true }, { transaction });

      const methodology = await queryInterface.describeTable("RiwayatMetodologiPenelitians");
      if (!methodology.superseded_at) await queryInterface.addColumn("RiwayatMetodologiPenelitians", "superseded_at", { type: Sequelize.DATE, allowNull: true }, { transaction });
      await queryInterface.sequelize.query(`
        UPDATE "RiwayatMetodologiPenelitians" previous
           SET superseded_at = successor.effective_at
          FROM "RiwayatMetodologiPenelitians" successor
         WHERE successor.previous_version_id = previous.id
           AND previous.superseded_at IS NULL
      `, { transaction });
      await queryInterface.sequelize.query(`UPDATE "RuleSetAkademiks" SET mode = 'shadow', "updatedAt" = NOW() WHERE mode = 'enforced'`, { transaction });

      const statements = [
        `CREATE UNIQUE INDEX IF NOT EXISTS uq_methodology_history_active ON "RiwayatMetodologiPenelitians" (mahasiswa_id) WHERE is_active = true`,
        `CREATE UNIQUE INDEX IF NOT EXISTS uq_coverage_active_scope ON "CakupanDatasetAkademiks" (source_id, dataset_type, periode_akademik_id, scope_type, COALESCE(mahasiswa_id, 0), COALESCE(kode_program_studi, ''), COALESCE(program_kuliah, '')) WHERE is_active = true`,
        `CREATE UNIQUE INDEX IF NOT EXISTS uq_rule_set_active_context ON "RuleSetAkademiks" (context) WHERE status = 'active'`,
        `CREATE UNIQUE INDEX IF NOT EXISTS uq_import_batch_idempotency ON "ImportAkademikBatches" (idempotency_key) WHERE idempotency_key IS NOT NULL`,
        `CREATE UNIQUE INDEX IF NOT EXISTS uq_import_commit_idempotency ON "ImportAkademikBatches" (commit_idempotency_key) WHERE commit_idempotency_key IS NOT NULL`,
        `CREATE UNIQUE INDEX IF NOT EXISTS uq_equivalence_membership ON "EkuivalensiMataKuliahs" (kelompok_id, mata_kuliah_id, COALESCE(kurikulum_id, 0))`,
        `ALTER TABLE "ImportAkademikBatches" ADD CONSTRAINT ck_import_batch_status CHECK (status IN ('uploaded','validated','invalid','expired','cancelled','committing','committed','failed'))`,
        `ALTER TABLE "ImportAkademikRows" ADD CONSTRAINT ck_import_row_action CHECK (action IN ('create','supersede','noop','conflict','invalid'))`,
        `ALTER TABLE "PercobaanMataKuliahMahasiswas" ADD CONSTRAINT ck_attempt_registration_status CHECK (status_registrasi IN ('planned','enrolled','completed','withdrawn','cancelled'))`,
        `ALTER TABLE "PercobaanMataKuliahMahasiswas" ADD CONSTRAINT ck_attempt_pass_status CHECK (status_kelulusan IN ('passed','failed','unknown'))`,
        `ALTER TABLE "RiwayatMetodologiPenelitians" ADD CONSTRAINT ck_methodology_status CHECK (status IN ('belum_mengambil','sedang_mengambil','lulus','tidak_lulus','mengulang'))`,
        `ALTER TABLE "SnapshotAkademikMahasiswas" ADD CONSTRAINT ck_snapshot_data_state CHECK (data_state IN ('available','unavailable','incomplete','conflicted'))`,
        `ALTER TABLE "SnapshotAkademikMahasiswas" ADD CONSTRAINT ck_snapshot_calculation_status CHECK (calculation_status IN ('ready','stale','failed','refreshing'))`,
        `ALTER TABLE "RuleSetAkademiks" ADD CONSTRAINT ck_rule_mode CHECK (mode IN ('informational','shadow','enforced'))`,
        `ALTER TABLE "RuleSetAkademiks" ADD CONSTRAINT ck_rule_status CHECK (status IN ('draft','active','retired'))`,
        `ALTER TABLE "KoreksiDataAkademiks" ADD CONSTRAINT ck_correction_status CHECK (status IN ('active','superseded','revoked'))`,
        `ALTER TABLE "KonflikDataAkademiks" ADD CONSTRAINT ck_conflict_status CHECK (status IN ('open','resolved','dismissed'))`,
        `ALTER TABLE "PekerjaanSnapshotAkademiks" ADD CONSTRAINT ck_snapshot_job_status CHECK (status IN ('queued','processing','completed','failed'))`,
        `ALTER TABLE "OutboxAkademiks" ADD CONSTRAINT ck_academic_outbox_status CHECK (status IN ('pending','processing','processed','failed'))`,
      ];
      for (const sql of statements) await queryInterface.sequelize.query(sql, { transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const constraints = [
        ["ImportAkademikBatches", "ck_import_batch_status"], ["ImportAkademikRows", "ck_import_row_action"],
        ["PercobaanMataKuliahMahasiswas", "ck_attempt_registration_status"], ["PercobaanMataKuliahMahasiswas", "ck_attempt_pass_status"],
        ["RiwayatMetodologiPenelitians", "ck_methodology_status"], ["SnapshotAkademikMahasiswas", "ck_snapshot_data_state"],
        ["SnapshotAkademikMahasiswas", "ck_snapshot_calculation_status"], ["RuleSetAkademiks", "ck_rule_mode"],
        ["RuleSetAkademiks", "ck_rule_status"], ["KoreksiDataAkademiks", "ck_correction_status"],
        ["KonflikDataAkademiks", "ck_conflict_status"], ["PekerjaanSnapshotAkademiks", "ck_snapshot_job_status"],
        ["OutboxAkademiks", "ck_academic_outbox_status"],
      ];
      for (const [table, name] of constraints) await queryInterface.sequelize.query(`ALTER TABLE "${table}" DROP CONSTRAINT IF EXISTS ${name}`, { transaction });
      for (const index of ["uq_methodology_history_active", "uq_coverage_active_scope", "uq_rule_set_active_context", "uq_import_batch_idempotency", "uq_import_commit_idempotency", "uq_equivalence_membership"]) {
        await queryInterface.sequelize.query(`DROP INDEX IF EXISTS ${index}`, { transaction });
      }
      await queryInterface.removeColumn("RiwayatMetodologiPenelitians", "superseded_at", { transaction });
      await queryInterface.removeColumn("CakupanDatasetAkademiks", "superseded_at", { transaction });
      await queryInterface.removeColumn("CakupanDatasetAkademiks", "previous_version_id", { transaction });
      await queryInterface.removeColumn("CakupanDatasetAkademiks", "version", { transaction });
      await queryInterface.removeColumn("ImportAkademikBatches", "commit_request_fingerprint", { transaction });
      await queryInterface.removeColumn("ImportAkademikBatches", "commit_idempotency_key", { transaction });
    });
  },
};
