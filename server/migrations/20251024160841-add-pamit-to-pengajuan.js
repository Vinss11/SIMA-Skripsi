"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Pengajuans", "pamit_ulang_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "PamitUlangs",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
      after: "pengajuan_sebelumnya_id",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("Pengajuans", "pamit_ulang_id");
  },
};
