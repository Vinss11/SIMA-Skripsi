"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class KetersediaanPengujiSidang extends Model {
    static associate(models) {
      KetersediaanPengujiSidang.belongsTo(models.PeriodeSidang, {
        foreignKey: "periode_sidang_id",
        as: "periodeSidang",
      });

      KetersediaanPengujiSidang.belongsTo(models.Dosen, {
        foreignKey: "dosen_id",
        as: "dosen",
      });
    }
  }

  KetersediaanPengujiSidang.init(
    {
      periode_sidang_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      dosen_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      tanggal_sidang: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      sesi_ke: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      tipe_penilaian: {
        type: DataTypes.ENUM("ketat", "santai"),
        allowNull: false,
        defaultValue: "santai",
      },
      kondisi_fisik: {
        type: DataTypes.ENUM("fit", "tidak_fit"),
        allowNull: false,
        defaultValue: "fit",
      },
    },
    {
      sequelize,
      modelName: "KetersediaanPengujiSidang",
      tableName: "KetersediaanPengujiSidangs",
      timestamps: true,
    }
  );

  return KetersediaanPengujiSidang;
};
