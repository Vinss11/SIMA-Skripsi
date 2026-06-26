"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("MitraMagangs");

    if (!table.quota_magang) {
      await queryInterface.addColumn("MitraMagangs", "quota_magang", {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
    }

    if (!table.kriteria) {
      await queryInterface.addColumn("MitraMagangs", "kriteria", {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }

    if (!table.prosedur_perusahaan) {
      await queryInterface.addColumn("MitraMagangs", "prosedur_perusahaan", {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable("MitraMagangs");

    if (table.prosedur_perusahaan) {
      await queryInterface.removeColumn("MitraMagangs", "prosedur_perusahaan");
    }
    if (table.kriteria) {
      await queryInterface.removeColumn("MitraMagangs", "kriteria");
    }
    if (table.quota_magang) {
      await queryInterface.removeColumn("MitraMagangs", "quota_magang");
    }
  },
};
