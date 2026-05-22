"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.renameColumn("Dosens", "jabatan", "jabatan_struktural");

    await queryInterface.changeColumn("Dosens", "jabatan_struktural", {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.renameColumn("Dosens", "jabatan_struktural", "jabatan");

    await queryInterface.changeColumn("Dosens", "jabatan", {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
  },
};
