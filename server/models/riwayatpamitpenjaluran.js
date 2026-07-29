"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class RiwayatPamitPenjaluran extends Model {
    static associate(models) {
      RiwayatPamitPenjaluran.belongsTo(models.PamitUlang, {
        foreignKey: "pamit_ulang_id",
        as: "pamit",
      });
    }
  }
  RiwayatPamitPenjaluran.init({
    pamit_ulang_id: { type: DataTypes.INTEGER, allowNull: false },
    from_status: DataTypes.STRING(30),
    to_status: { type: DataTypes.STRING(30), allowNull: false },
    event_type: { type: DataTypes.STRING(60), allowNull: false },
    actor_type: { type: DataTypes.STRING(30), allowNull: false },
    actor_id: DataTypes.INTEGER,
    note: DataTypes.TEXT,
    metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    occurred_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    deduplication_key: { type: DataTypes.STRING(255), allowNull: false, unique: true },
  }, {
    sequelize,
    modelName: "RiwayatPamitPenjaluran",
    tableName: "RiwayatPamitPenjalurans",
    timestamps: true,
  });
  return RiwayatPamitPenjaluran;
};
