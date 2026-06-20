"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class KelompokPerintisanBisnis extends Model {
    static associate(models) {
      KelompokPerintisanBisnis.belongsTo(models.PeriodePenjaluran, {
        foreignKey: "periode_penjaluran_id",
        as: "periode",
      });

      KelompokPerintisanBisnis.belongsTo(models.Mahasiswa, {
        foreignKey: "ketua_mahasiswa_id",
        as: "ketua",
      });

      KelompokPerintisanBisnis.hasMany(models.AnggotaKelompokPerintisan, {
        foreignKey: "kelompok_id",
        as: "anggota",
      });
    }
  }

  KelompokPerintisanBisnis.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      periode_penjaluran_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      ketua_mahasiswa_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM("draft", "submitted", "approved", "rejected"),
        allowNull: false,
        defaultValue: "draft",
      },
    },
    {
      sequelize,
      modelName: "KelompokPerintisanBisnis",
      tableName: "KelompokPerintisanBisnis",
      timestamps: true,
    }
  );

  return KelompokPerintisanBisnis;
};
