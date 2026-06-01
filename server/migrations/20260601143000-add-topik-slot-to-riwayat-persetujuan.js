'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableName = "RiwayatPersetujuans";
    const tableDefinition = await queryInterface.describeTable(tableName);

    if (!tableDefinition.topik_slot) {
      await queryInterface.addColumn(tableName, "topik_slot", {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
    }

    if (!tableDefinition.topik_kode) {
      await queryInterface.addColumn(tableName, "topik_kode", {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }

    const existingIndexes = await queryInterface.showIndex(tableName);
    const hasTargetIndex = existingIndexes.some(
      (item) => String(item?.name || "") === "idx_riwayat_pengajuan_dosen_tipe_slot"
    );
    if (!hasTargetIndex) {
      await queryInterface.addIndex(tableName, ["pengajuan_id", "dosen_id", "tipe_approval", "topik_slot"], {
        name: "idx_riwayat_pengajuan_dosen_tipe_slot",
      });
    }
  },

  async down(queryInterface) {
    const tableName = "RiwayatPersetujuans";
    const tableDefinition = await queryInterface.describeTable(tableName);
    const existingIndexes = await queryInterface.showIndex(tableName);
    const hasTargetIndex = existingIndexes.some(
      (item) => String(item?.name || "") === "idx_riwayat_pengajuan_dosen_tipe_slot"
    );
    if (hasTargetIndex) {
      await queryInterface.removeIndex(tableName, "idx_riwayat_pengajuan_dosen_tipe_slot");
    }

    if (tableDefinition.topik_kode) {
      await queryInterface.removeColumn(tableName, "topik_kode");
    }

    if (tableDefinition.topik_slot) {
      await queryInterface.removeColumn(tableName, "topik_slot");
    }
  },
};
