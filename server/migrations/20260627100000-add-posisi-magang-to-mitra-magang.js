"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("MitraMagangs");

    if (!table.posisi_magang) {
      await queryInterface.addColumn("MitraMagangs", "posisi_magang", {
        type: Sequelize.STRING(180),
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable("MitraMagangs");

    if (table.posisi_magang) {
      await queryInterface.removeColumn("MitraMagangs", "posisi_magang");
    }
  },
};
