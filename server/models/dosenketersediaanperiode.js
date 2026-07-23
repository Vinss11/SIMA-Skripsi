"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class DosenKetersediaanPeriode extends Model {
    static associate(models) {
      DosenKetersediaanPeriode.belongsTo(models.Dosen, { foreignKey: "dosen_id", as: "dosen" });
      DosenKetersediaanPeriode.belongsTo(models.PeriodePenjaluran, { foreignKey: "periode_penjaluran_id", as: "periode" });
      DosenKetersediaanPeriode.belongsTo(models.SekretarisProdi, { foreignKey: "updated_by_sekretaris_id", as: "updatedBySekretaris" });
      DosenKetersediaanPeriode.belongsTo(models.SekretarisProdi, { foreignKey: "reviewed_by_sekretaris_id", as: "reviewedBySekretaris" });
    }
  }
  DosenKetersediaanPeriode.init({
    dosen_id: DataTypes.INTEGER,
    periode_penjaluran_id: DataTypes.INTEGER,
    tersedia_membimbing: DataTypes.BOOLEAN,
    updated_by_sekretaris_id: DataTypes.INTEGER,
    configuration_status: DataTypes.ENUM("ready", "needs_review", "locked_by_master_status"),
    reviewed_at: DataTypes.DATE,
    reviewed_by_sekretaris_id: DataTypes.INTEGER,
    review_note: DataTypes.TEXT,
  }, { sequelize, modelName: "DosenKetersediaanPeriode", tableName: "DosenKetersediaanPeriodes", timestamps: true });
  return DosenKetersediaanPeriode;
};
