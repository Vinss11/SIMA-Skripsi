"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class DosenKetersediaanPeriode extends Model {
    static associate(models) {
      DosenKetersediaanPeriode.belongsTo(models.Dosen, { foreignKey: "dosen_id", as: "dosen" });
      DosenKetersediaanPeriode.belongsTo(models.PeriodePenjaluran, { foreignKey: "periode_penjaluran_id", as: "periode" });
      DosenKetersediaanPeriode.belongsTo(models.SekretarisProdi, { foreignKey: "updated_by_sekretaris_id", as: "updatedBySekretaris" });
    }
  }
  DosenKetersediaanPeriode.init({
    dosen_id: DataTypes.INTEGER,
    periode_penjaluran_id: DataTypes.INTEGER,
    tersedia_membimbing: DataTypes.BOOLEAN,
    tersedia_menguji: DataTypes.BOOLEAN,
    tersedia_ketua_cluster: DataTypes.BOOLEAN,
    tersedia_pengampu: DataTypes.BOOLEAN,
    tersedia_pengawas_jalur: DataTypes.BOOLEAN,
    tersedia_sidang: DataTypes.BOOLEAN,
    kuota_bimbingan_periode: DataTypes.INTEGER,
    alasan_tidak_tersedia: DataTypes.TEXT,
    updated_by_sekretaris_id: DataTypes.INTEGER,
  }, { sequelize, modelName: "DosenKetersediaanPeriode", tableName: "DosenKetersediaanPeriodes", timestamps: true });
  return DosenKetersediaanPeriode;
};
