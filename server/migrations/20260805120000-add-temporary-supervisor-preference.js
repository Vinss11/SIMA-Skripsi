"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("PendaftaranPenjalurans");
    if (!table.calon_dosen_pembimbing_id) {
      await queryInterface.addColumn("PendaftaranPenjalurans", "calon_dosen_pembimbing_id", {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "Dosens", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      });
      await queryInterface.addIndex("PendaftaranPenjalurans", ["calon_dosen_pembimbing_id"], {
        name: "idx_pendaftaran_calon_dosen_pembimbing_id",
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable("PendaftaranPenjalurans");
    if (table.calon_dosen_pembimbing_id) {
      await queryInterface.removeIndex("PendaftaranPenjalurans", "idx_pendaftaran_calon_dosen_pembimbing_id");
      await queryInterface.removeColumn("PendaftaranPenjalurans", "calon_dosen_pembimbing_id");
    }
  },
};
