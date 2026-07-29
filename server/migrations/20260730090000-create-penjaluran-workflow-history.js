"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("RiwayatWorkflowPenjalurans", {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      pendaftaran_penjaluran_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "PendaftaranPenjalurans", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      jalur: { type: Sequelize.STRING(40), allowNull: false },
      raw_status: { type: Sequelize.STRING(80), allowNull: false },
      workflow_stage: { type: Sequelize.STRING(80), allowNull: false },
      event_type: { type: Sequelize.STRING(80), allowNull: false },
      actor_type: { type: Sequelize.STRING(40), allowNull: false },
      actor_id: { type: Sequelize.INTEGER, allowNull: true },
      note: { type: Sequelize.TEXT, allowNull: true },
      metadata: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      occurred_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
      deduplication_key: { type: Sequelize.STRING(255), allowNull: false, unique: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex("RiwayatWorkflowPenjalurans", ["pendaftaran_penjaluran_id", "occurred_at"], {
      name: "riwayat_workflow_penjaluran_registration_time_idx",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("RiwayatWorkflowPenjalurans");
  },
};
