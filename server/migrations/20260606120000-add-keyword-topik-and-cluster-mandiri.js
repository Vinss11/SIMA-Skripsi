"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const topikTable = await queryInterface.describeTable("Topiks");
    if (!topikTable.keyword) {
      await queryInterface.addColumn("Topiks", "keyword", {
        type: Sequelize.STRING(500),
        allowNull: true,
        after: "deskripsi",
      });
    }

    const pengajuanTable = await queryInterface.describeTable("Pengajuans");
    if (!pengajuanTable.cluster_mandiri) {
      await queryInterface.addColumn("Pengajuans", "cluster_mandiri", {
        type: Sequelize.STRING(20),
        allowNull: true,
        after: "keyword_mandiri",
      });
    }
  },

  async down(queryInterface) {
    const pengajuanTable = await queryInterface.describeTable("Pengajuans");
    if (pengajuanTable.cluster_mandiri) {
      await queryInterface.removeColumn("Pengajuans", "cluster_mandiri");
    }

    const topikTable = await queryInterface.describeTable("Topiks");
    if (topikTable.keyword) {
      await queryInterface.removeColumn("Topiks", "keyword");
    }
  },
};
