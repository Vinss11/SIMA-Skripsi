"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.removeColumn("Topiks", "kuota");
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn("Topiks", "kuota", {
      type: Sequelize.INTEGER,
      defaultValue: 1,
      allowNull: false,
    });
  },
};
