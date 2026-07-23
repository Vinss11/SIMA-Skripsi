"use strict";

// Migration tahap akhir. Jalankan hanya setelah seluruh deployment tidak lagi
// membaca kolom availability lama.
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const table = await queryInterface.describeTable("DosenKetersediaanPeriodes", { transaction });
      for (const column of [
        "tersedia_menguji",
        "tersedia_ketua_cluster",
        "tersedia_pengampu",
        "tersedia_pengawas_jalur",
        "tersedia_sidang",
        "kuota_bimbingan_periode",
        "alasan_tidak_tersedia",
      ]) {
        if (table[column]) await queryInterface.removeColumn("DosenKetersediaanPeriodes", column, { transaction });
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const table = await queryInterface.describeTable("DosenKetersediaanPeriodes", { transaction });
      const columns = {
        tersedia_menguji: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        tersedia_ketua_cluster: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        tersedia_pengampu: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        tersedia_pengawas_jalur: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        tersedia_sidang: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        kuota_bimbingan_periode: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        alasan_tidak_tersedia: { type: Sequelize.TEXT, allowNull: true },
      };
      for (const [column, definition] of Object.entries(columns)) {
        if (!table[column]) await queryInterface.addColumn("DosenKetersediaanPeriodes", column, definition, { transaction });
      }
    });
  },
};
