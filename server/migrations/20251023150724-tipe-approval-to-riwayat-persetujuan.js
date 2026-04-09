"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("RiwayatPersetujuans", "tipe_approval", {
      type: Sequelize.ENUM("dospem_akademik", "calon_pembimbing", "koordinator"),
      allowNull: false,
      defaultValue: "calon_pembimbing",
      after: "dosen_id",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("RiwayatPersetujuans", "tipe_approval");
  },
};
