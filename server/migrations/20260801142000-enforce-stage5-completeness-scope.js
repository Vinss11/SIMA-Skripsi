"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [invalid] = await queryInterface.sequelize.query(`
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
      if (invalid.length) {
        throw new Error(`Cannot enforce completeness scope constraints; repair invalid coverage rows first: ${JSON.stringify(invalid)}`);
      }

      for (const constraint of ["ck_coverage_cohort_attribute", "ck_coverage_student_scope", "ck_coverage_scope_type"]) {
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
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const constraint of ["ck_coverage_cohort_attribute", "ck_coverage_student_scope", "ck_coverage_scope_type"]) {
        await queryInterface.sequelize.query(
          `ALTER TABLE "CakupanDatasetAkademiks" DROP CONSTRAINT IF EXISTS "${constraint}"`,
          { transaction },
        );
      }
    });
  },
};
