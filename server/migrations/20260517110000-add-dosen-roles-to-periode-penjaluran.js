"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("PeriodePenjalurans");

    if (!table.ketua_penelitian_dosen_id) {
      await queryInterface.addColumn("PeriodePenjalurans", "ketua_penelitian_dosen_id", {
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

    if (!table.pengawas_magang_dosen_id) {
      await queryInterface.addColumn("PeriodePenjalurans", "pengawas_magang_dosen_id", {
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

    await queryInterface.addIndex("PeriodePenjalurans", ["ketua_penelitian_dosen_id"], {
      name: "idx_periode_ketua_penelitian_dosen_id",
    });
    await queryInterface.addIndex("PeriodePenjalurans", ["pengawas_magang_dosen_id"], {
      name: "idx_periode_pengawas_magang_dosen_id",
    });
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable("PeriodePenjalurans");

    try {
      await queryInterface.removeIndex("PeriodePenjalurans", "idx_periode_ketua_penelitian_dosen_id");
    } catch (error) {
      // ignore if index is not found
    }
    try {
      await queryInterface.removeIndex("PeriodePenjalurans", "idx_periode_pengawas_magang_dosen_id");
    } catch (error) {
      // ignore if index is not found
    }

    if (table.pengawas_magang_dosen_id) {
      await queryInterface.removeColumn("PeriodePenjalurans", "pengawas_magang_dosen_id");
    }

    if (table.ketua_penelitian_dosen_id) {
      await queryInterface.removeColumn("PeriodePenjalurans", "ketua_penelitian_dosen_id");
    }
  },
};

