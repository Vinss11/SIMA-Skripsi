"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("PamitUlangs", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      mahasiswa_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "Mahasiswas",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      pengajuan_sebelumnya_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "Pengajuans",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      alasan_ulang: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      surat_pengunduran_diri: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      catatan_tambahan: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      status_dpa: {
        type: Sequelize.ENUM("pending", "approved", "rejected"),
        defaultValue: "pending",
        allowNull: false,
      },
      keterangan_dpa: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      tanggal_approval_dpa: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    // Tambah index untuk performa
    await queryInterface.addIndex("PamitUlangs", ["mahasiswa_id"]);
    await queryInterface.addIndex("PamitUlangs", ["status_dpa"]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("PamitUlangs");
  },
};
