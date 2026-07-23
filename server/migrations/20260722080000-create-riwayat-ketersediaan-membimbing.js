"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable("RiwayatKetersediaanMembimbings", {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      dosen_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "Dosens", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      periode_penjaluran_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "PeriodePenjalurans", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      tersedia_sebelumnya: { type: Sequelize.BOOLEAN, allowNull: true },
      tersedia_baru: { type: Sequelize.BOOLEAN, allowNull: false },
      changed_by_sekretaris_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "SekretarisProdis", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      sumber_perubahan: {
        type: Sequelize.ENUM("period_opening", "manual_update", "master_status_change", "new_dosen"),
        allowNull: false,
      },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
      }, { transaction });
      await queryInterface.addIndex(
        "RiwayatKetersediaanMembimbings",
        ["dosen_id", "periode_penjaluran_id", "createdAt"],
        { name: "idx_riwayat_ketersediaan_dosen_periode", transaction }
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.dropTable("RiwayatKetersediaanMembimbings", { transaction });
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_RiwayatKetersediaanMembimbings_sumber_perubahan";',
        { transaction }
      );
    });
  },
};
