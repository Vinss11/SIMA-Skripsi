"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class PeriodeSidangRuangan extends Model {
    static associate(models) {
      PeriodeSidangRuangan.belongsTo(models.PeriodeSidang, {
        foreignKey: "periode_sidang_id",
        as: "periodeSidang",
      });
    }
  }

  PeriodeSidangRuangan.init(
    {
      periode_sidang_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      nama_ruangan: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "PeriodeSidangRuangan",
      tableName: "PeriodeSidangRuangans",
      timestamps: true,
    }
  );

  return PeriodeSidangRuangan;
};
