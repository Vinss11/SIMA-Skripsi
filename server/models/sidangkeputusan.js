"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class SidangKeputusan extends Model {
    static associate(models) {
      SidangKeputusan.belongsTo(models.JadwalSidangPenguji, { foreignKey: "jadwal_sidang_id", as: "jadwalSidang" });
      SidangKeputusan.hasMany(models.SidangRevisi, { foreignKey: "keputusan_sidang_id", as: "revisis" });
    }
  }
  SidangKeputusan.init({
    jadwal_sidang_id: { type: DataTypes.INTEGER, allowNull: false },
    keputusan: { type: DataTypes.ENUM("lulus", "lulus_dengan_revisi", "tidak_lulus"), allowNull: false },
    status_kelulusan: { type: DataTypes.ENUM("lulus", "lulus_bersyarat", "tidak_lulus"), allowNull: false },
    nilai_akhir: { type: DataTypes.DECIMAL(5, 2), allowNull: false },
    catatan_final: { type: DataTypes.TEXT, allowNull: true },
    decided_at: { type: DataTypes.DATE, allowNull: false },
  }, { sequelize, modelName: "SidangKeputusan", tableName: "SidangKeputusans", timestamps: true });
  return SidangKeputusan;
};
