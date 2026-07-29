"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class RiwayatWorkflowPenjaluran extends Model {
    static associate(models) {
      RiwayatWorkflowPenjaluran.belongsTo(models.PendaftaranPenjaluran, {
        foreignKey: "pendaftaran_penjaluran_id",
        as: "pendaftaran",
      });
    }
  }

  RiwayatWorkflowPenjaluran.init({
    pendaftaran_penjaluran_id: { type: DataTypes.INTEGER, allowNull: false },
    jalur: { type: DataTypes.STRING(40), allowNull: false },
    raw_status: { type: DataTypes.STRING(80), allowNull: false },
    workflow_stage: { type: DataTypes.STRING(80), allowNull: false },
    event_type: { type: DataTypes.STRING(80), allowNull: false },
    actor_type: { type: DataTypes.STRING(40), allowNull: false },
    actor_id: { type: DataTypes.INTEGER, allowNull: true },
    note: { type: DataTypes.TEXT, allowNull: true },
    metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    occurred_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    deduplication_key: { type: DataTypes.STRING(255), allowNull: false, unique: true },
  }, {
    sequelize,
    modelName: "RiwayatWorkflowPenjaluran",
    tableName: "RiwayatWorkflowPenjalurans",
    timestamps: true,
  });
  return RiwayatWorkflowPenjaluran;
};
