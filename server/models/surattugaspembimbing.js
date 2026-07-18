"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class SuratTugasPembimbing extends Model {
    static associate(models) {
      SuratTugasPembimbing.belongsTo(models.PeriodePenjaluran, { foreignKey: "periode_penjaluran_id", as: "periode" });
      SuratTugasPembimbing.belongsTo(models.SekretarisProdi, { foreignKey: "issued_by_sekretaris_id", as: "issuedBySekretaris" });
      SuratTugasPembimbing.hasMany(models.PenetapanPembimbing, { foreignKey: "surat_tugas_id", as: "penetapans" });
    }
  }
  SuratTugasPembimbing.init({
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    periode_penjaluran_id: DataTypes.INTEGER,
    nomor_surat: { type: DataTypes.STRING(150), unique: true },
    tanggal_surat: DataTypes.DATEONLY,
    tanggal_berlaku_mulai: DataTypes.DATEONLY,
    tanggal_berlaku_selesai: DataTypes.DATEONLY,
    file_path: DataTypes.STRING(500),
    status: { type: DataTypes.ENUM("draft", "issued", "cancelled"), allowNull: false, defaultValue: "draft" },
    issued_by_sekretaris_id: DataTypes.INTEGER,
    catatan: DataTypes.TEXT,
  }, { sequelize, modelName: "SuratTugasPembimbing", tableName: "SuratTugasPembimbings", timestamps: true });
  return SuratTugasPembimbing;
};
