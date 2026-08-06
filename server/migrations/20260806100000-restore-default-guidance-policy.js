"use strict";

const RECOVERY_SOURCE = "system_default_recovery_20260806";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(`
        INSERT INTO "GuidanceRequirementPolicies" (
          kode_program_studi, program_kuliah, jalur, periode_akademik_id,
          version, status, minimum_validated_sessions, count_scope,
          occurrence_proof_mode, supervisor_approval_scope,
          require_p2_if_available, effective_at, retired_at,
          source, row_version, "createdAt", "updatedAt"
        )
        SELECT
          NULL, NULL, NULL, NULL,
          COALESCE(MAX(version), 0) + 1, 'active', 8, 'cycle',
          'approved_resume', 'p1', false, NOW(), NULL,
          '${RECOVERY_SOURCE}', 1, NOW(), NOW()
        FROM "GuidanceRequirementPolicies"
        WHERE kode_program_studi IS NULL
          AND program_kuliah IS NULL
          AND jalur IS NULL
          AND periode_akademik_id IS NULL
        HAVING NOT EXISTS (
          SELECT 1
          FROM "GuidanceRequirementPolicies"
          WHERE status = 'active'
            AND kode_program_studi IS NULL
            AND program_kuliah IS NULL
            AND jalur IS NULL
            AND periode_akademik_id IS NULL
        )
      `, { transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE "GuidanceRequirementPolicies"
      SET status = 'retired', retired_at = NOW(), "updatedAt" = NOW()
      WHERE source = '${RECOVERY_SOURCE}' AND status = 'active'
    `);
  },
};
