"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Dosens", "kuota_bimbingan", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 5,
      comment: "Maksimal jumlah mahasiswa yang dapat dibimbing",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("Dosens", "kuota_bimbingan");
  },
};
