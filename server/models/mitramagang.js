"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class MitraMagang extends Model {
    static associate() {}
  }

  MitraMagang.init(
    {
      nama: {
        type: DataTypes.STRING(180),
        allowNull: false,
        unique: true,
      },
      bidang_jenis: {
        type: DataTypes.STRING(180),
        allowNull: true,
      },
      lokasi: {
        type: DataTypes.STRING(180),
        allowNull: true,
      },
      email_kontak: {
        type: DataTypes.STRING(180),
        allowNull: true,
      },
      website: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      quota_magang: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      kriteria: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      prosedur_perusahaan: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM("active", "inactive"),
        allowNull: false,
        defaultValue: "active",
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      catatan: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "MitraMagang",
      tableName: "MitraMagangs",
      timestamps: true,
    }
  );

  return MitraMagang;
};
