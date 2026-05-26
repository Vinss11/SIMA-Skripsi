"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class PeriodeSidang extends Model {
    static associate(models) {
      PeriodeSidang.belongsTo(models.SekretarisProdi, {
        foreignKey: "created_by_sekretaris_id",
        as: "createdBySekretaris",
      });

      PeriodeSidang.hasMany(models.PeriodeSidangHari, {
        foreignKey: "periode_sidang_id",
        as: "hariSidang",
      });

      PeriodeSidang.hasMany(models.PeriodeSidangRuangan, {
        foreignKey: "periode_sidang_id",
        as: "ruanganSidang",
      });

      PeriodeSidang.hasMany(models.PendaftaranSidang, {
        foreignKey: "periode_sidang_id",
        as: "pendaftaranSidang",
      });

      PeriodeSidang.hasMany(models.KetersediaanPengujiSidang, {
        foreignKey: "periode_sidang_id",
        as: "ketersediaanPenguji",
      });

      PeriodeSidang.hasMany(models.JadwalSidangPenguji, {
        foreignKey: "periode_sidang_id",
        as: "jadwalSidang",
      });
    }
  }

  PeriodeSidang.init(
    {
      label_periode: {
        type: DataTypes.STRING(120),
        allowNull: false,
        unique: true,
      },
      tanggal_mulai_pendaftaran: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      tanggal_selesai_pendaftaran: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM("draft", "open", "closed"),
        allowNull: false,
        defaultValue: "draft",
      },
      catatan: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      created_by_sekretaris_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      activated_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      closed_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "PeriodeSidang",
      tableName: "PeriodeSidangs",
      timestamps: true,
    }
  );

  return PeriodeSidang;
};
