"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class SidangRevisi extends Model {
    static associate(models) {
      SidangRevisi.belongsTo(models.SidangKeputusan, { foreignKey: "keputusan_sidang_id", as: "keputusanSidang" });
      SidangRevisi.hasMany(models.SidangRevisiPersetujuan, { foreignKey: "sidang_revisi_id", as: "persetujuans" });
    }
  }
  SidangRevisi.init({
    keputusan_sidang_id: { type: DataTypes.INTEGER, allowNull: false },
    versi: { type: DataTypes.INTEGER, allowNull: false },
    file_path: { type: DataTypes.STRING(500), allowNull: false },
    file_name: { type: DataTypes.STRING(255), allowNull: false },
    tanggapan_revisi: { type: DataTypes.TEXT, allowNull: false },
    status: { type: DataTypes.ENUM("submitted", "revision_required", "approved"), allowNull: false, defaultValue: "submitted" },
    uploaded_at: { type: DataTypes.DATE, allowNull: false },
  }, { sequelize, modelName: "SidangRevisi", tableName: "SidangRevisis", timestamps: true });
  return SidangRevisi;
};
