"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("AssignmentActivationAttempts", {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      penetapan_pembimbing_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
        references: { model: "PenetapanPembimbings", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      status: { type: Sequelize.ENUM("pending", "activation_failed", "activated"), allowNull: false, defaultValue: "pending" },
      attempt_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      last_attempt_at: { type: Sequelize.DATE, allowNull: true },
      activated_at: { type: Sequelize.DATE, allowNull: true },
      error_code: { type: Sequelize.STRING(80), allowNull: true },
      error_message: { type: Sequelize.TEXT, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex("AssignmentActivationAttempts", ["status", "last_attempt_at"], { name: "idx_assignment_activation_status" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("AssignmentActivationAttempts");
    if (queryInterface.sequelize.getDialect() === "postgres") {
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_AssignmentActivationAttempts_status";');
    }
  },
};
