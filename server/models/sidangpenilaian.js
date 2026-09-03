"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class SidangPenilaian extends Model {
    static associate(models) {
      SidangPenilaian.belongsTo(models.JadwalSidangPenguji, { foreignKey: "jadwal_sidang_id", as: "jadwalSidang" });
      SidangPenilaian.belongsTo(models.Dosen, { foreignKey: "dosen_id", as: "dosen" });
    }
  }
  SidangPenilaian.init({
    jadwal_sidang_id: { type: DataTypes.INTEGER, allowNull: false },
    dosen_id: { type: DataTypes.INTEGER, allowNull: false },
    peran: { type: DataTypes.ENUM("penguji1", "penguji2"), allowNull: false },
    nilai_akhir: { type: DataTypes.DECIMAL(5, 2), allowNull: false },
    huruf_nilai: { type: DataTypes.STRING(5), allowNull: true },
    keputusan: { type: DataTypes.ENUM("lulus", "lulus_dengan_revisi", "tidak_lulus"), allowNull: false },
    catatan: { type: DataTypes.TEXT, allowNull: true },
    catatan_revisi: { type: DataTypes.TEXT, allowNull: true },
    submitted_at: { type: DataTypes.DATE, allowNull: false },
  }, { sequelize, modelName: "SidangPenilaian", tableName: "SidangPenilaians", timestamps: true });
  return SidangPenilaian;
};
