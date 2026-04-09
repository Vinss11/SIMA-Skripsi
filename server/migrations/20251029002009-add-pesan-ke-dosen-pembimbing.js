"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("PamitUlangs", "pesan_ke_dosen_pembimbing", {
      type: Sequelize.TEXT,
      allowNull: false,
      // Hapus baris "after" karena PostgreSQL tidak mendukung
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("PamitUlangs", "pesan_ke_dosen_pembimbing");
  },
};
