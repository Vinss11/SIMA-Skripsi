"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Tambah kolom dosen pembimbing akademik
    await queryInterface.addColumn("Mahasiswas", "dosen_pembimbing_akademik_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "Dosens",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
      after: "angkatan",
    });

    // Tambah kolom dosen pembimbing skripsi (setelah approved)
    await queryInterface.addColumn("Mahasiswas", "dosen_pembimbing_skripsi_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "Dosens",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
      after: "dosen_pembimbing_akademik_id",
    });

    // Tambah kolom status jalur saat ini
    await queryInterface.addColumn("Mahasiswas", "status_jalur_saat_ini", {
      type: Sequelize.ENUM("belum_mengajukan", "sedang_mengajukan", "baru", "ulang", "ekstensi", "selesai"),
      allowNull: false,
      defaultValue: "belum_mengajukan",
      after: "dosen_pembimbing_skripsi_id",
    });

    // Tambah kolom referensi pengajuan aktif
    await queryInterface.addColumn("Mahasiswas", "pengajuan_aktif_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "Pengajuans",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
      after: "status_jalur_saat_ini",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("Mahasiswas", "pengajuan_aktif_id");
    await queryInterface.removeColumn("Mahasiswas", "status_jalur_saat_ini");
    await queryInterface.removeColumn("Mahasiswas", "dosen_pembimbing_skripsi_id");
    await queryInterface.removeColumn("Mahasiswas", "dosen_pembimbing_akademik_id");
  },
};
