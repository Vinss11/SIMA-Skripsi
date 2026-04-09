"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn("Pengajuans", "topik_1_kode", {
      type: Sequelize.STRING(20),
      allowNull: true,
    });

    await queryInterface.changeColumn("Pengajuans", "topik_1_judul", {
      type: Sequelize.STRING(255),
      allowNull: true,
    });

    await queryInterface.changeColumn("Pengajuans", "dosen_pilihan_1", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "Dosens",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });

    await queryInterface.changeColumn("Pengajuans", "dosen_1_nama", {
      type: Sequelize.STRING(100),
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn("Pengajuans", "dosen_1_nama", {
      type: Sequelize.STRING(100),
      allowNull: false,
    });

    await queryInterface.changeColumn("Pengajuans", "dosen_pilihan_1", {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: "Dosens",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });

    await queryInterface.changeColumn("Pengajuans", "topik_1_judul", {
      type: Sequelize.STRING(255),
      allowNull: false,
    });

    await queryInterface.changeColumn("Pengajuans", "topik_1_kode", {
      type: Sequelize.STRING(20),
      allowNull: false,
    });
  },
};
