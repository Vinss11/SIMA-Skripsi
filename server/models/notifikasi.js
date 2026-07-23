"use strict";

const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Notifikasi extends Model {}

  Notifikasi.init({
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    recipient_type: { type: DataTypes.STRING(30), allowNull: false },
    recipient_id: { type: DataTypes.INTEGER, allowNull: false },
    type: { type: DataTypes.STRING(80), allowNull: false },
    title: { type: DataTypes.STRING(180), allowNull: false },
    message: { type: DataTypes.TEXT, allowNull: false },
    reference_type: DataTypes.STRING(80),
    reference_id: DataTypes.INTEGER,
    action_key: DataTypes.STRING(100),
    metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    read_at: DataTypes.DATE,
    deduplication_key: { type: DataTypes.STRING(255), allowNull: false, unique: true },
  }, {
    sequelize,
    modelName: "Notifikasi",
    tableName: "Notifikasis",
    timestamps: true,
  });

  return Notifikasi;
};
