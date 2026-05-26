"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class PeriodeSidangHari extends Model {
    static associate(models) {
      PeriodeSidangHari.belongsTo(models.PeriodeSidang, {
        foreignKey: "periode_sidang_id",
        as: "periodeSidang",
      });
    }
  }

  PeriodeSidangHari.init(
    {
      periode_sidang_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      tanggal_sidang: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "PeriodeSidangHari",
      tableName: "PeriodeSidangHaris",
      timestamps: true,
    }
  );

  return PeriodeSidangHari;
};
