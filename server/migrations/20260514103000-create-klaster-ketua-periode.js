"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("KlasterKetuaPeriodes", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      klaster_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "Klasters",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      dosen_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "Dosens",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      periode_penjaluran_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "PeriodePenjalurans",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      assigned_by_sekretaris_id: {
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

    await queryInterface.addIndex("KlasterKetuaPeriodes", ["periode_penjaluran_id", "klaster_id"], {
      unique: true,
      name: "klaster_ketua_periode_unique_pair",
    });

    await queryInterface.addIndex("KlasterKetuaPeriodes", ["dosen_id"], {
      name: "klaster_ketua_periode_dosen_idx",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("KlasterKetuaPeriodes", "klaster_ketua_periode_dosen_idx");
    await queryInterface.removeIndex("KlasterKetuaPeriodes", "klaster_ketua_periode_unique_pair");
    await queryInterface.dropTable("KlasterKetuaPeriodes");
  },
};

