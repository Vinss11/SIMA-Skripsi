"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("IzinLanjutSkripsis", {
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
      dosen_pembimbing_skripsi_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "Dosens",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      periode_penjaluran_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "PeriodePenjalurans",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      semester_penjaluran_ke: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM("pending", "approved", "rejected"),
        allowNull: false,
        defaultValue: "pending",
      },
      alasan_pengajuan: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      keterangan_dosen: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      tanggal_pengajuan: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },
      tanggal_keputusan: {
        type: Sequelize.DATE,
        allowNull: true,
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

    await queryInterface.addIndex("IzinLanjutSkripsis", ["mahasiswa_id", "status"], {
      name: "idx_izin_lanjut_mahasiswa_status",
    });
    await queryInterface.addIndex("IzinLanjutSkripsis", ["dosen_pembimbing_skripsi_id", "status"], {
      name: "idx_izin_lanjut_dosen_status",
    });
    await queryInterface.addIndex(
      "IzinLanjutSkripsis",
      ["mahasiswa_id", "semester_penjaluran_ke"],
      {
        name: "uq_izin_lanjut_mahasiswa_semester",
        unique: true,
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("IzinLanjutSkripsis", "uq_izin_lanjut_mahasiswa_semester");
    await queryInterface.removeIndex("IzinLanjutSkripsis", "idx_izin_lanjut_dosen_status");
    await queryInterface.removeIndex("IzinLanjutSkripsis", "idx_izin_lanjut_mahasiswa_status");
    await queryInterface.dropTable("IzinLanjutSkripsis");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_IzinLanjutSkripsis_status";');
  },
};

