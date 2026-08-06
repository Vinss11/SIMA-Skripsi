"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class PreferensiPengujiSidang extends Model {
    static associate(models) {
      PreferensiPengujiSidang.belongsTo(models.PeriodeSidang, {
        foreignKey: "periode_sidang_id",
        as: "periodeSidang",
      });
      PreferensiPengujiSidang.belongsTo(models.Dosen, {
        foreignKey: "dosen_id",
        as: "dosen",
      });
    }
  }

  PreferensiPengujiSidang.init(
    {
      periode_sidang_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      dosen_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      mobilitas_ruangan: {
        type: DataTypes.ENUM("dapat_berpindah", "satu_ruangan"),
        allowNull: false,
        defaultValue: "dapat_berpindah",
      },
      maksimal_sesi_per_hari: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 5,
        validate: { min: 1, max: 5 },
      },
      membutuhkan_jeda: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      submitted_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "PreferensiPengujiSidang",
      tableName: "PreferensiPengujiSidangs",
      timestamps: true,
      indexes: [
        {
          name: "uniq_preferensi_penguji_periode_dosen",
          unique: true,
          fields: ["periode_sidang_id", "dosen_id"],
        },
      ],
    }
  );

  return PreferensiPengujiSidang;
};
