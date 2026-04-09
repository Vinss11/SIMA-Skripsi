"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Tambah kolom untuk status jalur
    await queryInterface.addColumn("Pengajuans", "jenis_jalur", {
      type: Sequelize.ENUM("baru", "ulang", "ekstensi"),
      allowNull: false,
      defaultValue: "baru",
      after: "mahasiswa_id",
    });

    // Tambah kolom untuk tipe pengajuan
    await queryInterface.addColumn("Pengajuans", "tipe_pengajuan", {
      type: Sequelize.ENUM("topik_dosen", "judul_mandiri"),
      allowNull: false,
      defaultValue: "topik_dosen",
      after: "jenis_jalur",
    });

    // Kolom untuk pengajuan ulang
    await queryInterface.addColumn("Pengajuans", "alasan_ulang", {
      type: Sequelize.TEXT,
      allowNull: true,
      after: "alasan_penolakan",
    });

    await queryInterface.addColumn("Pengajuans", "surat_pengunduran_diri", {
      type: Sequelize.TEXT,
      allowNull: true,
      after: "alasan_ulang",
    });

    await queryInterface.addColumn("Pengajuans", "pengajuan_sebelumnya_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "Pengajuans",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
      after: "surat_pengunduran_diri",
    });

    // Kolom untuk judul mandiri
    await queryInterface.addColumn("Pengajuans", "judul_mandiri", {
      type: Sequelize.STRING(500),
      allowNull: true,
      after: "topik_3_judul",
    });

    await queryInterface.addColumn("Pengajuans", "deskripsi_mandiri", {
      type: Sequelize.TEXT,
      allowNull: true,
      after: "judul_mandiri",
    });

    await queryInterface.addColumn("Pengajuans", "keyword_mandiri", {
      type: Sequelize.STRING(500),
      allowNull: true,
      after: "deskripsi_mandiri",
    });

    await queryInterface.addColumn("Pengajuans", "prospective_supervisor_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "Dosens",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
      after: "keyword_mandiri",
    });

    await queryInterface.addColumn("Pengajuans", "is_approved_by_supervisor", {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      after: "prospective_supervisor_id",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("Pengajuans", "jenis_jalur");
    await queryInterface.removeColumn("Pengajuans", "tipe_pengajuan");
    await queryInterface.removeColumn("Pengajuans", "alasan_ulang");
    await queryInterface.removeColumn("Pengajuans", "surat_pengunduran_diri");
    await queryInterface.removeColumn("Pengajuans", "pengajuan_sebelumnya_id");
    await queryInterface.removeColumn("Pengajuans", "judul_mandiri");
    await queryInterface.removeColumn("Pengajuans", "deskripsi_mandiri");
    await queryInterface.removeColumn("Pengajuans", "keyword_mandiri");
    await queryInterface.removeColumn("Pengajuans", "prospective_supervisor_id");
    await queryInterface.removeColumn("Pengajuans", "is_approved_by_supervisor");
  },
};
