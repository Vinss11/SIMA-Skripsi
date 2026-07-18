"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("DosenKetersediaanPeriodes");
    await queryInterface.sequelize.transaction(async (transaction) => {
      if (!table.configuration_status) {
        await queryInterface.addColumn("DosenKetersediaanPeriodes", "configuration_status", {
          type: Sequelize.ENUM("ready", "needs_review", "locked_by_master_status"),
          allowNull: false,
          defaultValue: "ready",
        }, { transaction });
        await queryInterface.changeColumn("DosenKetersediaanPeriodes", "configuration_status", {
          type: Sequelize.ENUM("ready", "needs_review", "locked_by_master_status"),
          allowNull: false,
          defaultValue: "needs_review",
        }, { transaction });
      }
      if (!table.reviewed_at) {
        await queryInterface.addColumn("DosenKetersediaanPeriodes", "reviewed_at", {
          type: Sequelize.DATE,
          allowNull: true,
        }, { transaction });
      }
      if (!table.reviewed_by_sekretaris_id) {
        await queryInterface.addColumn("DosenKetersediaanPeriodes", "reviewed_by_sekretaris_id", {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: "SekretarisProdis", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "SET NULL",
        }, { transaction });
      }
      if (!table.review_note) {
        await queryInterface.addColumn("DosenKetersediaanPeriodes", "review_note", {
          type: Sequelize.TEXT,
          allowNull: true,
        }, { transaction });
      }
      await queryInterface.addIndex(
        "DosenKetersediaanPeriodes",
        ["periode_penjaluran_id", "configuration_status"],
        { name: "idx_dosen_availability_configuration_status", transaction }
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeIndex("DosenKetersediaanPeriodes", "idx_dosen_availability_configuration_status", { transaction });
      await queryInterface.removeColumn("DosenKetersediaanPeriodes", "review_note", { transaction });
      await queryInterface.removeColumn("DosenKetersediaanPeriodes", "reviewed_by_sekretaris_id", { transaction });
      await queryInterface.removeColumn("DosenKetersediaanPeriodes", "reviewed_at", { transaction });
      await queryInterface.removeColumn("DosenKetersediaanPeriodes", "configuration_status", { transaction });
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_DosenKetersediaanPeriodes_configuration_status";',
        { transaction }
      );
    });
  },
};
