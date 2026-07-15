"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class TindakLanjutStatusDosen extends Model {
    static associate(models) {
      TindakLanjutStatusDosen.belongsTo(models.Dosen, { foreignKey: "dosen_id", as: "dosen" });
      TindakLanjutStatusDosen.belongsTo(models.RiwayatStatusDosen, { foreignKey: "riwayat_status_dosen_id", as: "riwayatStatus" });
      TindakLanjutStatusDosen.belongsTo(models.SekretarisProdi, { foreignKey: "resolved_by_sekretaris_id", as: "resolvedBySekretaris" });
    }
  }
  TindakLanjutStatusDosen.init({
    dosen_id: DataTypes.INTEGER,
    riwayat_status_dosen_id: DataTypes.INTEGER,
    status: DataTypes.ENUM("open", "resolved"),
    impact_snapshot: DataTypes.JSONB,
    catatan_penyelesaian: DataTypes.TEXT,
    resolved_by_sekretaris_id: DataTypes.INTEGER,
    resolved_at: DataTypes.DATE,
    resolution_type: DataTypes.ENUM("resolved", "resolved_with_exception"),
    resolution_decisions: DataTypes.JSONB,
    remaining_impact_snapshot: DataTypes.JSONB,
  }, { sequelize, modelName: "TindakLanjutStatusDosen", tableName: "TindakLanjutStatusDosens", timestamps: true });
  return TindakLanjutStatusDosen;
};
