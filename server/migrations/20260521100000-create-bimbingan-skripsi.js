"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("BimbinganSkripsis", {
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
      dosen_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "Dosens",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      pengajuan_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "Pengajuans",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      permintaan_pesan: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      permintaan_tanggal: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      permintaan_jam: {
        type: Sequelize.STRING(5),
        allowNull: false,
      },
      status_permohonan: {
        type: Sequelize.ENUM("pending", "approved", "rejected"),
        allowNull: false,
        defaultValue: "pending",
      },
      catatan_dosen: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      lokasi_bimbingan: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      tanggal_keputusan: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      status_resume: {
        type: Sequelize.ENUM("belum_diisi", "submitted", "approved", "revisi", "rejected"),
        allowNull: false,
        defaultValue: "belum_diisi",
      },
      resume_mahasiswa: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      catatan_review_resume: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      tanggal_review_resume: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      is_counted: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
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

    await queryInterface.addIndex("BimbinganSkripsis", ["mahasiswa_id", "createdAt"], {
      name: "idx_bimbingan_mahasiswa_createdAt",
    });
    await queryInterface.addIndex("BimbinganSkripsis", ["dosen_id", "status_permohonan"], {
      name: "idx_bimbingan_dosen_status_permohonan",
    });
    await queryInterface.addIndex("BimbinganSkripsis", ["mahasiswa_id", "status_resume", "is_counted"], {
      name: "idx_bimbingan_mahasiswa_resume_counted",
    });
    await queryInterface.addIndex("BimbinganSkripsis", ["pengajuan_id"], {
      name: "idx_bimbingan_pengajuan_id",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("BimbinganSkripsis", "idx_bimbingan_pengajuan_id");
    await queryInterface.removeIndex("BimbinganSkripsis", "idx_bimbingan_mahasiswa_resume_counted");
    await queryInterface.removeIndex("BimbinganSkripsis", "idx_bimbingan_dosen_status_permohonan");
    await queryInterface.removeIndex("BimbinganSkripsis", "idx_bimbingan_mahasiswa_createdAt");
    await queryInterface.dropTable("BimbinganSkripsis");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_BimbinganSkripsis_status_permohonan";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_BimbinganSkripsis_status_resume";');
  },
};

