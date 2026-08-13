"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class RiwayatStatusDosen extends Model {
    static associate(models) {
      RiwayatStatusDosen.belongsTo(models.Dosen, { foreignKey: "dosen_id", as: "dosen" });
      RiwayatStatusDosen.belongsTo(models.Admin, { foreignKey: "changed_by", as: "changedByAdmin" });
      RiwayatStatusDosen.hasMany(models.TindakLanjutStatusDosen, { foreignKey: "riwayat_status_dosen_id", as: "tindakLanjuts" });
    }
  }
  RiwayatStatusDosen.init({
    dosen_id: DataTypes.INTEGER,
    status_sebelumnya: DataTypes.ENUM("active", "study_permission", "inactive", "study_leave", "retired"),
    status_baru: DataTypes.ENUM("active", "study_permission", "inactive", "study_leave", "retired"),
    account_is_active_sebelumnya: DataTypes.BOOLEAN,
    account_is_active_baru: DataTypes.BOOLEAN,
    continue_existing_supervision_sebelumnya: DataTypes.BOOLEAN,
    continue_existing_supervision_baru: DataTypes.BOOLEAN,
    changed_fields: DataTypes.JSONB,
    effective_at: DataTypes.DATEONLY,
    reason: DataTypes.TEXT,
    changed_by: DataTypes.INTEGER,
    impact_snapshot: DataTypes.JSONB,
  }, { sequelize, modelName: "RiwayatStatusDosen", tableName: "RiwayatStatusDosens", timestamps: true });
  return RiwayatStatusDosen;
};
