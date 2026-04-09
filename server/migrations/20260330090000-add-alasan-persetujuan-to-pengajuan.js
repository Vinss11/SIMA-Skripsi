"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Pengajuans", "alasan_persetujuan", {
      type: Sequelize.TEXT,
      allowNull: true,
      after: "alasan_penolakan",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("Pengajuans", "alasan_persetujuan");
  },
};
