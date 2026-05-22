"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("PeriodePenjalurans");

    if (!table.pengawas_jalur_lain_dosen_id) {
      await queryInterface.addColumn("PeriodePenjalurans", "pengawas_jalur_lain_dosen_id", {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "Dosens",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      });
    }

    await queryInterface.addIndex("PeriodePenjalurans", ["pengawas_jalur_lain_dosen_id"], {
      name: "idx_periode_pengawas_jalur_lain_dosen_id",
    });
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable("PeriodePenjalurans");

    try {
      await queryInterface.removeIndex("PeriodePenjalurans", "idx_periode_pengawas_jalur_lain_dosen_id");
    } catch (error) {
      // ignore when index does not exist
    }

    if (table.pengawas_jalur_lain_dosen_id) {
      await queryInterface.removeColumn("PeriodePenjalurans", "pengawas_jalur_lain_dosen_id");
    }
  },
};

