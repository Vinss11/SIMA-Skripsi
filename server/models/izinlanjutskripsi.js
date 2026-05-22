"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class IzinLanjutSkripsi extends Model {
    static associate(models) {
      IzinLanjutSkripsi.belongsTo(models.Mahasiswa, {
        foreignKey: "mahasiswa_id",
        as: "mahasiswa",
      });

      IzinLanjutSkripsi.belongsTo(models.Dosen, {
        foreignKey: "dosen_pembimbing_skripsi_id",
        as: "dosenPembimbingSkripsi",
      });

      IzinLanjutSkripsi.belongsTo(models.PeriodePenjaluran, {
        foreignKey: "periode_penjaluran_id",
        as: "periode",
      });
    }
  }

  IzinLanjutSkripsi.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      mahasiswa_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      dosen_pembimbing_skripsi_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      periode_penjaluran_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      semester_penjaluran_ke: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM("pending", "approved", "rejected"),
        allowNull: false,
        defaultValue: "pending",
      },
      alasan_pengajuan: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      keterangan_dosen: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      tanggal_pengajuan: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      tanggal_keputusan: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "IzinLanjutSkripsi",
      tableName: "IzinLanjutSkripsis",
      timestamps: true,
    }
  );

  return IzinLanjutSkripsi;
};

