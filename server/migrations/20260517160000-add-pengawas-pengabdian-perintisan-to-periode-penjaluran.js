"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("PeriodePenjalurans");

    if (!table.pengawas_pengabdian_dosen_id) {
      await queryInterface.addColumn("PeriodePenjalurans", "pengawas_pengabdian_dosen_id", {
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

    if (!table.pengawas_perintisan_bisnis_dosen_id) {
      await queryInterface.addColumn("PeriodePenjalurans", "pengawas_perintisan_bisnis_dosen_id", {
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

    await queryInterface.sequelize.query(`
      UPDATE "PeriodePenjalurans"
      SET
        "pengawas_pengabdian_dosen_id" = COALESCE("pengawas_pengabdian_dosen_id", "pengawas_jalur_lain_dosen_id"),
        "pengawas_perintisan_bisnis_dosen_id" = COALESCE("pengawas_perintisan_bisnis_dosen_id", "pengawas_jalur_lain_dosen_id")
      WHERE "pengawas_jalur_lain_dosen_id" IS NOT NULL
    `);

    await queryInterface.addIndex("PeriodePenjalurans", ["pengawas_pengabdian_dosen_id"], {
      name: "idx_periode_pengawas_pengabdian_dosen_id",
    });
    await queryInterface.addIndex("PeriodePenjalurans", ["pengawas_perintisan_bisnis_dosen_id"], {
      name: "idx_periode_pengawas_perintisan_bisnis_dosen_id",
    });
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable("PeriodePenjalurans");

    try {
      await queryInterface.removeIndex("PeriodePenjalurans", "idx_periode_pengawas_pengabdian_dosen_id");
    } catch (error) {
      // ignore when index does not exist
    }
    try {
      await queryInterface.removeIndex("PeriodePenjalurans", "idx_periode_pengawas_perintisan_bisnis_dosen_id");
    } catch (error) {
      // ignore when index does not exist
    }

    if (table.pengawas_perintisan_bisnis_dosen_id) {
      await queryInterface.removeColumn("PeriodePenjalurans", "pengawas_perintisan_bisnis_dosen_id");
    }
    if (table.pengawas_pengabdian_dosen_id) {
      await queryInterface.removeColumn("PeriodePenjalurans", "pengawas_pengabdian_dosen_id");
    }
  },
};

