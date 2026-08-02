"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(`
        WITH ranked AS (
          SELECT id, ROW_NUMBER() OVER (
            PARTITION BY guidance_id ORDER BY evaluated_at DESC, id DESC
          ) AS position
          FROM "GuidanceProgressEvaluations"
          WHERE superseded_at IS NULL
        )
        UPDATE "GuidanceProgressEvaluations" evaluation
        SET superseded_at = NOW(), "updatedAt" = NOW()
        FROM ranked
        WHERE evaluation.id = ranked.id AND ranked.position > 1
      `, { transaction });
      await queryInterface.removeIndex("GuidanceProgressEvaluations", "uq_guidance_active_evaluation", { transaction });
      await queryInterface.sequelize.query(`
        CREATE UNIQUE INDEX uq_guidance_single_active_evaluation
        ON "GuidanceProgressEvaluations" (guidance_id)
        WHERE superseded_at IS NULL
      `, { transaction });
      await queryInterface.sequelize.query(`
        CREATE UNIQUE INDEX uq_guidance_event_idempotency
        ON "GuidanceEvents" (guidance_id, event_type, idempotency_key)
        WHERE idempotency_key IS NOT NULL
      `, { transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeIndex("GuidanceEvents", "uq_guidance_event_idempotency", { transaction });
      await queryInterface.removeIndex("GuidanceProgressEvaluations", "uq_guidance_single_active_evaluation", { transaction });
      await queryInterface.sequelize.query(`
        CREATE UNIQUE INDEX uq_guidance_active_evaluation
        ON "GuidanceProgressEvaluations" (guidance_id, resume_version_id, policy_id, cycle_registration_id)
        WHERE superseded_at IS NULL
      `, { transaction });
    });
  },
};
