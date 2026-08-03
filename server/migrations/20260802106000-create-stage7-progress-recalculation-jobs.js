"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable("GuidanceProgressRecalculationJobs", {
        id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },
        policy_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: "GuidanceRequirementPolicies", key: "id" }, onDelete: "RESTRICT" },
        mahasiswa_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: "Mahasiswas", key: "id" }, onDelete: "RESTRICT" },
        cycle_registration_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: "PendaftaranPenjalurans", key: "id" }, onDelete: "RESTRICT" },
        assignment_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: "PenetapanPembimbings", key: "id" }, onDelete: "RESTRICT" },
        status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: "pending" },
        attempt_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        available_at: { type: Sequelize.DATE, allowNull: false }, started_at: Sequelize.DATE, completed_at: Sequelize.DATE,
        last_error_code: Sequelize.STRING(80), last_error_message: Sequelize.TEXT,
        result: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
        createdAt: { type: Sequelize.DATE, allowNull: false }, updatedAt: { type: Sequelize.DATE, allowNull: false },
      }, { transaction });
      await queryInterface.addIndex("GuidanceProgressRecalculationJobs", ["policy_id", "mahasiswa_id", "cycle_registration_id", "assignment_id"], {
        unique: true, name: "uq_guidance_recalculation_policy_student_cycle", transaction,
      });
      await queryInterface.addIndex("GuidanceProgressRecalculationJobs", ["status", "available_at", "id"], {
        name: "idx_guidance_recalculation_queue", transaction,
      });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction((transaction) => queryInterface.dropTable("GuidanceProgressRecalculationJobs", { transaction }));
  },
};
