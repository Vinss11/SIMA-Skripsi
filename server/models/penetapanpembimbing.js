"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class PenetapanPembimbing extends Model {
    static associate(models) {
      PenetapanPembimbing.belongsTo(models.Mahasiswa, { foreignKey: "mahasiswa_id", as: "mahasiswa" });
      PenetapanPembimbing.belongsTo(models.PendaftaranPenjaluran, { foreignKey: "pendaftaran_penjaluran_id", as: "pendaftaran" });
      PenetapanPembimbing.belongsTo(models.PeriodePenjaluran, { foreignKey: "periode_mulai_id", as: "periodeMulai" });
      PenetapanPembimbing.belongsTo(models.SekretarisProdi, { foreignKey: "created_by_sekretaris_id", as: "createdBySekretaris" });
      PenetapanPembimbing.belongsTo(models.SuratTugasPembimbing, { foreignKey: "surat_tugas_id", as: "suratTugas" });
      PenetapanPembimbing.hasMany(models.PenetapanPembimbingDosen, { foreignKey: "penetapan_pembimbing_id", as: "pembimbings" });
    }
  }

  PenetapanPembimbing.init({
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    mahasiswa_id: { type: DataTypes.INTEGER, allowNull: false },
    pendaftaran_penjaluran_id: DataTypes.INTEGER,
    periode_mulai_id: DataTypes.INTEGER,
    semester_penjaluran_ke: DataTypes.INTEGER,
    tanggal_mulai: DataTypes.DATE,
    tanggal_selesai: DataTypes.DATE,
    status: { type: DataTypes.ENUM("draft", "active", "ended", "cancelled"), allowNull: false, defaultValue: "draft" },
    alasan_berakhir: DataTypes.TEXT,
    sumber_data: {
      type: DataTypes.ENUM("penjaluran", "perpanjangan", "pergantian", "legacy_backfill"),
      allowNull: false,
      defaultValue: "penjaluran",
    },
    surat_tugas_id: DataTypes.INTEGER,
    created_by_sekretaris_id: DataTypes.INTEGER,
  }, {
    sequelize,
    modelName: "PenetapanPembimbing",
    tableName: "PenetapanPembimbings",
    timestamps: true,
    validate: {
      validDateRange() {
        if (this.tanggal_mulai && this.tanggal_selesai && new Date(this.tanggal_selesai) < new Date(this.tanggal_mulai)) {
          throw new Error("Tanggal selesai tidak boleh sebelum tanggal mulai.");
        }
      },
    },
  });
  return PenetapanPembimbing;
};
