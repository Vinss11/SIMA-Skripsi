"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("PendaftaranPenjalurans", {
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
      periode_penjaluran_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "PeriodePenjalurans",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      jalur: {
        type: Sequelize.ENUM("baru", "ulang", "alih"),
        allowNull: false,
        defaultValue: "baru",
      },
      semester_mahasiswa: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      nomor_whatsapp: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      catatan: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM("submitted", "processed"),
        allowNull: false,
        defaultValue: "submitted",
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
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("PendaftaranPenjalurans");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_PendaftaranPenjalurans_jalur";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_PendaftaranPenjalurans_status";');
  },
};

