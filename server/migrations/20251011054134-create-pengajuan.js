"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("Pengajuans", {
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
      // Topik 1
      topik_1_kode: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      topik_1_judul: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      // Topik 2
      topik_2_kode: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      topik_2_judul: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      // Topik 3
      topik_3_kode: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      topik_3_judul: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      // Dosen 1
      dosen_pilihan_1: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "Dosens",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      dosen_1_nama: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      // Dosen 2
      dosen_pilihan_2: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "Dosens",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      dosen_2_nama: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      // Dosen 3
      dosen_pilihan_3: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "Dosens",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      dosen_3_nama: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      // Dosen yang sedang mereview
      dosen_saat_ini: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "Dosens",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      status: {
        type: Sequelize.ENUM("pending", "approved", "rejected", "completed"),
        defaultValue: "pending",
        allowNull: false,
      },
      alasan_penolakan: {
        type: Sequelize.TEXT,
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
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("Pengajuans");
  },
};
