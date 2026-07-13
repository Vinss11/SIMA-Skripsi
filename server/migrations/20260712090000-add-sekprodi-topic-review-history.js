"use strict";

/** @type {import("sequelize-cli").Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableName = "RiwayatPersetujuans";
    const dialect = queryInterface.sequelize.getDialect();
    const definition = await queryInterface.describeTable(tableName);

    if (dialect === "postgres") {
      await queryInterface.sequelize.query(
        'ALTER TYPE "enum_RiwayatPersetujuans_tipe_approval" ADD VALUE IF NOT EXISTS \'sekprodi\';'
      );
      await queryInterface.changeColumn(tableName, "dosen_id", {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "Dosens", key: "id" },
      });
    } else {
      await queryInterface.changeColumn(tableName, "tipe_approval", {
        type: Sequelize.ENUM("dospem_akademik", "calon_pembimbing", "koordinator", "sekprodi"),
        allowNull: false,
        defaultValue: "calon_pembimbing",
      });
      await queryInterface.changeColumn(tableName, "dosen_id", {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "Dosens", key: "id" },
      });
    }

    if (!definition.sekretaris_prodi_id) {
      await queryInterface.addColumn(tableName, "sekretaris_prodi_id", {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "SekretarisProdis", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      });
    }
  },

  async down(queryInterface, Sequelize) {
    const tableName = "RiwayatPersetujuans";
    const dialect = queryInterface.sequelize.getDialect();
    const definition = await queryInterface.describeTable(tableName);

    if (definition.sekretaris_prodi_id) {
      await queryInterface.removeColumn(tableName, "sekretaris_prodi_id");
    }

    await queryInterface.sequelize.query(
      `DELETE FROM ${dialect === "postgres" ? '"RiwayatPersetujuans"' : "`RiwayatPersetujuans`"} WHERE ${
        dialect === "postgres" ? '"tipe_approval"' : "`tipe_approval`"
      } = 'sekprodi';`
    );

    if (dialect !== "postgres") {
      await queryInterface.changeColumn(tableName, "tipe_approval", {
        type: Sequelize.ENUM("dospem_akademik", "calon_pembimbing", "koordinator"),
        allowNull: false,
        defaultValue: "calon_pembimbing",
      });
    }

    await queryInterface.changeColumn(tableName, "dosen_id", {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: { model: "Dosens", key: "id" },
    });
  },
};
