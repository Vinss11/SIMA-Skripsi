"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.addColumn("GuidanceRequirementPolicies", "row_version", {
        type: Sequelize.INTEGER, allowNull: false, defaultValue: 1,
      }, { transaction });

      await queryInterface.sequelize.query(`
        UPDATE "BimbinganSkripsis"
        SET legacy_context_status = 'ambiguous'
        WHERE legacy_context_status = 'resolved'
          AND (pendaftaran_penjaluran_id IS NULL OR target_assignment_id IS NULL
            OR target_assignment_member_id IS NULL OR target_urutan_snapshot IS NULL
            OR effective_reviewer_assignment_id IS NULL OR effective_reviewer_assignment_member_id IS NULL
            OR periode_akademik_id IS NULL OR semester_penjaluran_ke_snapshot IS NULL
            OR jalur_snapshot IS NULL OR cycle_type_snapshot IS NULL)
      `, { transaction });
      await queryInterface.sequelize.query(`
        ALTER TABLE "BimbinganSkripsis"
        ADD CONSTRAINT ck_guidance_resolved_context_complete CHECK (
          legacy_context_status <> 'resolved' OR (
            pendaftaran_penjaluran_id IS NOT NULL AND target_assignment_id IS NOT NULL
            AND target_assignment_member_id IS NOT NULL AND target_urutan_snapshot IS NOT NULL
            AND effective_reviewer_assignment_id IS NOT NULL AND effective_reviewer_assignment_member_id IS NOT NULL
            AND periode_akademik_id IS NOT NULL AND semester_penjaluran_ke_snapshot IS NOT NULL
            AND jalur_snapshot IS NOT NULL AND cycle_type_snapshot IS NOT NULL
          )
        )
      `, { transaction });
      await queryInterface.sequelize.query(`
        CREATE UNIQUE INDEX uq_guidance_policy_active_scope
        ON "GuidanceRequirementPolicies" (
          COALESCE(kode_program_studi, ''), COALESCE(program_kuliah, ''), COALESCE(jalur, ''), COALESCE(periode_akademik_id, 0)
        ) WHERE status = 'active'
      `, { transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS uq_guidance_policy_active_scope', { transaction });
      await queryInterface.sequelize.query('ALTER TABLE "BimbinganSkripsis" DROP CONSTRAINT IF EXISTS ck_guidance_resolved_context_complete', { transaction });
      await queryInterface.removeColumn("GuidanceRequirementPolicies", "row_version", { transaction });
    });
  },
};
