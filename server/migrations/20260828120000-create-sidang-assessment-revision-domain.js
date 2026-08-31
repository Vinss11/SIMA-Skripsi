"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("SidangPenilaians", {
      id: { type: Sequelize.INTEGER, allowNull: false, autoIncrement: true, primaryKey: true },
      jadwal_sidang_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: "JadwalSidangPengujis", key: "id" }, onUpdate: "CASCADE", onDelete: "CASCADE" },
      dosen_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: "Dosens", key: "id" }, onUpdate: "CASCADE", onDelete: "RESTRICT" },
      peran: { type: Sequelize.ENUM("penguji1", "penguji2"), allowNull: false },
      nilai_akhir: { type: Sequelize.DECIMAL(5, 2), allowNull: false },
      keputusan: { type: Sequelize.ENUM("lulus", "lulus_dengan_revisi", "tidak_lulus"), allowNull: false },
      catatan: { type: Sequelize.TEXT, allowNull: true },
      catatan_revisi: { type: Sequelize.TEXT, allowNull: true },
      submitted_at: { type: Sequelize.DATE, allowNull: false },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });
    await queryInterface.addIndex("SidangPenilaians", ["jadwal_sidang_id", "dosen_id"], { unique: true, name: "uniq_sidang_penilaian_jadwal_dosen" });

    await queryInterface.createTable("SidangKeputusans", {
      id: { type: Sequelize.INTEGER, allowNull: false, autoIncrement: true, primaryKey: true },
      jadwal_sidang_id: { type: Sequelize.INTEGER, allowNull: false, unique: true, references: { model: "JadwalSidangPengujis", key: "id" }, onUpdate: "CASCADE", onDelete: "CASCADE" },
      keputusan: { type: Sequelize.ENUM("lulus", "lulus_dengan_revisi", "tidak_lulus"), allowNull: false },
      status_kelulusan: { type: Sequelize.ENUM("lulus", "lulus_bersyarat", "tidak_lulus"), allowNull: false },
      nilai_akhir: { type: Sequelize.DECIMAL(5, 2), allowNull: false },
      catatan_final: { type: Sequelize.TEXT, allowNull: true },
      decided_at: { type: Sequelize.DATE, allowNull: false },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });

    await queryInterface.createTable("SidangRevisis", {
      id: { type: Sequelize.INTEGER, allowNull: false, autoIncrement: true, primaryKey: true },
      keputusan_sidang_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: "SidangKeputusans", key: "id" }, onUpdate: "CASCADE", onDelete: "CASCADE" },
      versi: { type: Sequelize.INTEGER, allowNull: false },
      file_path: { type: Sequelize.STRING(500), allowNull: false },
      file_name: { type: Sequelize.STRING(255), allowNull: false },
      tanggapan_revisi: { type: Sequelize.TEXT, allowNull: false },
      status: { type: Sequelize.ENUM("submitted", "revision_required", "approved"), allowNull: false, defaultValue: "submitted" },
      uploaded_at: { type: Sequelize.DATE, allowNull: false },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });
    await queryInterface.addIndex("SidangRevisis", ["keputusan_sidang_id", "versi"], { unique: true, name: "uniq_sidang_revisi_keputusan_versi" });

    await queryInterface.createTable("SidangRevisiPersetujuans", {
      id: { type: Sequelize.INTEGER, allowNull: false, autoIncrement: true, primaryKey: true },
      sidang_revisi_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: "SidangRevisis", key: "id" }, onUpdate: "CASCADE", onDelete: "CASCADE" },
      dosen_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: "Dosens", key: "id" }, onUpdate: "CASCADE", onDelete: "RESTRICT" },
      status: { type: Sequelize.ENUM("pending", "approved", "revision_required"), allowNull: false, defaultValue: "pending" },
      catatan: { type: Sequelize.TEXT, allowNull: true },
      reviewed_at: { type: Sequelize.DATE, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });
    await queryInterface.addIndex("SidangRevisiPersetujuans", ["sidang_revisi_id", "dosen_id"], { unique: true, name: "uniq_sidang_revisi_persetujuan_dosen" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("SidangRevisiPersetujuans");
    await queryInterface.dropTable("SidangRevisis");
    await queryInterface.dropTable("SidangKeputusans");
    await queryInterface.dropTable("SidangPenilaians");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_SidangRevisiPersetujuans_status";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_SidangRevisis_status";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_SidangKeputusans_status_kelulusan";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_SidangKeputusans_keputusan";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_SidangPenilaians_keputusan";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_SidangPenilaians_peran";');
  },
};
