"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class AnggotaKelompokPerintisan extends Model {
    static associate(models) {
      AnggotaKelompokPerintisan.belongsTo(models.KelompokPerintisanBisnis, {
        foreignKey: "kelompok_id",
        as: "kelompok",
      });

      AnggotaKelompokPerintisan.belongsTo(models.Mahasiswa, {
        foreignKey: "mahasiswa_id",
        as: "mahasiswa",
      });

      AnggotaKelompokPerintisan.belongsTo(models.PendaftaranPenjaluran, {
        foreignKey: "pendaftaran_penjaluran_id",
        as: "pendaftaran",
      });
    }
  }

  AnggotaKelompokPerintisan.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      kelompok_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      mahasiswa_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      pendaftaran_penjaluran_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      posisi: {
        type: DataTypes.ENUM("ketua", "anggota"),
        allowNull: false,
      },
      peran_tim: {
        type: DataTypes.ENUM("hustler", "hipster", "hacker"),
        allowNull: false,
      },
      jenis_pendaftaran: {
        type: DataTypes.ENUM("baru", "ulang", "alih"),
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "AnggotaKelompokPerintisan",
      tableName: "AnggotaKelompokPerintisans",
      timestamps: true,
    }
  );

  return AnggotaKelompokPerintisan;
};
