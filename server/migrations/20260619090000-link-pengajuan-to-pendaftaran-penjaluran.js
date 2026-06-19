"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Pengajuans", "pendaftaran_penjaluran_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "PendaftaranPenjalurans",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    await queryInterface.addIndex("Pengajuans", ["pendaftaran_penjaluran_id"]);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("Pengajuans", ["pendaftaran_penjaluran_id"]);
    await queryInterface.removeColumn("Pengajuans", "pendaftaran_penjaluran_id");
  },
};
