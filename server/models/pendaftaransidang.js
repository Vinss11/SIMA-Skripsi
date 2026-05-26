"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class PendaftaranSidang extends Model {
    static associate(models) {
      PendaftaranSidang.belongsTo(models.PeriodeSidang, {
        foreignKey: "periode_sidang_id",
        as: "periodeSidang",
      });

      PendaftaranSidang.belongsTo(models.Mahasiswa, {
        foreignKey: "mahasiswa_id",
        as: "mahasiswa",
      });

      PendaftaranSidang.belongsTo(models.Dosen, {
        foreignKey: "dosen_pembimbing_id",
        as: "dosenPembimbing",
      });

      PendaftaranSidang.hasOne(models.JadwalSidangPenguji, {
        foreignKey: "pendaftaran_sidang_id",
        as: "jadwalSidang",
      });
    }
  }

  PendaftaranSidang.init(
    {
      periode_sidang_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      mahasiswa_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      dosen_pembimbing_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM("submitted", "scheduled", "cancelled"),
        allowNull: false,
        defaultValue: "submitted",
      },
      registered_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      assigned_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      catatan: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "PendaftaranSidang",
      tableName: "PendaftaranSidangs",
      timestamps: true,
    }
  );

  return PendaftaranSidang;
};
