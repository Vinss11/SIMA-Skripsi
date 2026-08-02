"use strict";

const COVERAGE_CONSTRAINTS = [
  "ck_coverage_cohort_attribute",
  "ck_coverage_student_scope",
  "ck_coverage_scope_type",
];

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [invalidCoverage] = await queryInterface.sequelize.query(`
        SELECT id, scope_type
        FROM "CakupanDatasetAkademiks"
        WHERE scope_type NOT IN ('student', 'program', 'cohort')
           OR (scope_type = 'student' AND mahasiswa_id IS NULL)
           OR (
             scope_type = 'cohort'
             AND COALESCE(NULLIF(metadata->>'cohort', ''), NULLIF(metadata->>'angkatan', '')) IS NULL
           )
        LIMIT 20
      `, { transaction });
      if (invalidCoverage.length) {
        throw new Error(`Cannot remove global/invalid completeness scopes; repair rows first: ${JSON.stringify(invalidCoverage)}`);
      }

      const [activePeriods] = await queryInterface.sequelize.query(`
        SELECT id, kode
        FROM "PeriodeAkademiks"
        WHERE status = 'active'
        ORDER BY id
        FOR UPDATE
      `, { transaction });
      if (activePeriods.length > 1) {
        throw new Error(`Cannot enforce a single active academic period; close all but one first: ${JSON.stringify(activePeriods)}`);
      }

      for (const constraint of COVERAGE_CONSTRAINTS) {
        await queryInterface.sequelize.query(
          `ALTER TABLE "CakupanDatasetAkademiks" DROP CONSTRAINT IF EXISTS "${constraint}"`,
          { transaction },
        );
      }
      await queryInterface.sequelize.query(`
        ALTER TABLE "CakupanDatasetAkademiks"
        ADD CONSTRAINT ck_coverage_scope_type
        CHECK (scope_type IN ('student', 'program', 'cohort'))
      `, { transaction });
      await queryInterface.sequelize.query(`
        ALTER TABLE "CakupanDatasetAkademiks"
        ADD CONSTRAINT ck_coverage_student_scope
        CHECK (scope_type <> 'student' OR mahasiswa_id IS NOT NULL)
      `, { transaction });
      await queryInterface.sequelize.query(`
        ALTER TABLE "CakupanDatasetAkademiks"
        ADD CONSTRAINT ck_coverage_cohort_attribute
        CHECK (
          scope_type <> 'cohort'
          OR COALESCE(NULLIF(metadata->>'cohort', ''), NULLIF(metadata->>'angkatan', '')) IS NOT NULL
        )
      `, { transaction });

      await queryInterface.sequelize.query(`DROP INDEX IF EXISTS uq_coverage_active_scope`, { transaction });
      await queryInterface.sequelize.query(`
        CREATE UNIQUE INDEX uq_coverage_active_scope
        ON "CakupanDatasetAkademiks" (
          source_id,
          dataset_type,
          periode_akademik_id,
          scope_type,
          COALESCE(mahasiswa_id, 0),
          COALESCE(kode_program_studi, ''),
          COALESCE(program_kuliah, ''),
          COALESCE(NULLIF(metadata->>'cohort', ''), NULLIF(metadata->>'angkatan', ''), '')
        )
        WHERE is_active = true
      `, { transaction });
      await queryInterface.sequelize.query(`DROP INDEX IF EXISTS uq_academic_period_single_active`, { transaction });
      await queryInterface.sequelize.query(`
        CREATE UNIQUE INDEX uq_academic_period_single_active
        ON "PeriodeAkademiks" ((status))
        WHERE status = 'active'
      `, { transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(`DROP INDEX IF EXISTS uq_academic_period_single_active`, { transaction });
      await queryInterface.sequelize.query(`DROP INDEX IF EXISTS uq_coverage_active_scope`, { transaction });
      await queryInterface.sequelize.query(`
        CREATE UNIQUE INDEX uq_coverage_active_scope
        ON "CakupanDatasetAkademiks" (
          source_id, dataset_type, periode_akademik_id, scope_type,
          COALESCE(mahasiswa_id, 0), COALESCE(kode_program_studi, ''), COALESCE(program_kuliah, '')
        )
        WHERE is_active = true
      `, { transaction });
    });
  },
};
