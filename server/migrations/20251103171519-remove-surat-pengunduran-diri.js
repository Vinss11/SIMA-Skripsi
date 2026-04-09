"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.removeColumn("PamitUlangs", "surat_pengunduran_diri");
  },

  async down(queryInterface, Sequelize) {
    // Tambahkan kembali kolom dengan allowNull: true untuk menghindari error
    await queryInterface.addColumn("PamitUlangs", "surat_pengunduran_diri", {
      type: Sequelize.TEXT,
      allowNull: true, // Ubah menjadi true karena data existing tidak punya nilai ini
      defaultValue: null, // Set default value
    });
  },
};
