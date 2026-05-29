"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("MasterPenanggungJawabPenjalurans", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      ketua_itsc_dosen_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "Dosens",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      ketua_sirkel_dosen_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "Dosens",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      ketua_siber_dosen_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "Dosens",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      ketua_mvk_dosen_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "Dosens",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      pengawas_magang_dosen_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "Dosens",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      pengawas_pengabdian_dosen_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "Dosens",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      pengawas_perintisan_bisnis_dosen_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "Dosens",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      updated_by_sekretaris_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "SekretarisProdis",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    await queryInterface.addIndex("MasterPenanggungJawabPenjalurans", ["updatedAt"], {
      name: "master_penanggung_penjaluran_updated_at_idx",
    });
  },

  async down(queryInterface) {
    try {
      await queryInterface.removeIndex(
        "MasterPenanggungJawabPenjalurans",
        "master_penanggung_penjaluran_updated_at_idx"
      );
    } catch (error) {
      // ignore when index does not exist
    }
    await queryInterface.dropTable("MasterPenanggungJawabPenjalurans");
  },
};

