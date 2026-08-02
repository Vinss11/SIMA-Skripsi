"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.addColumn("BimbinganSkripsis", "reviewer_resolution_reason_code", {
        type: Sequelize.STRING(100), allowNull: true,
      }, { transaction });
      await queryInterface.addIndex("BimbinganSkripsis", ["reviewer_resolution_status", "reviewer_resolution_reason_code"], {
        name: "idx_guidance_reviewer_resolution_queue", transaction,
      });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeIndex("BimbinganSkripsis", "idx_guidance_reviewer_resolution_queue", { transaction });
      await queryInterface.removeColumn("BimbinganSkripsis", "reviewer_resolution_reason_code", { transaction });
    });
  },
};
