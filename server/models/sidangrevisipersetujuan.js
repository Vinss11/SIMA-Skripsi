"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class SidangRevisiPersetujuan extends Model {
    static associate(models) {
      SidangRevisiPersetujuan.belongsTo(models.SidangRevisi, { foreignKey: "sidang_revisi_id", as: "sidangRevisi" });
      SidangRevisiPersetujuan.belongsTo(models.Dosen, { foreignKey: "dosen_id", as: "dosen" });
    }
  }
  SidangRevisiPersetujuan.init({
    sidang_revisi_id: { type: DataTypes.INTEGER, allowNull: false },
    dosen_id: { type: DataTypes.INTEGER, allowNull: false },
    status: { type: DataTypes.ENUM("pending", "approved", "revision_required"), allowNull: false, defaultValue: "pending" },
    catatan: { type: DataTypes.TEXT, allowNull: true },
    reviewed_at: { type: DataTypes.DATE, allowNull: true },
  }, { sequelize, modelName: "SidangRevisiPersetujuan", tableName: "SidangRevisiPersetujuans", timestamps: true });
  return SidangRevisiPersetujuan;
};
