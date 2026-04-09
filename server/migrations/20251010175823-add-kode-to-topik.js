"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Topiks", "kode", {
      type: Sequelize.STRING(20),
      allowNull: false,
      unique: true,
      after: "id",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("Topiks", "kode");
  },
};
