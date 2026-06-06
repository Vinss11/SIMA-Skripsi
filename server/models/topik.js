"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Topik extends Model {
    static associate(models) {
      // Relasi dengan Dosen
      Topik.belongsTo(models.Dosen, {
        foreignKey: "dosen_id",
        as: "dosen",
      });
    }
  }

  Topik.init(
    {
      kode: {
        type: DataTypes.STRING(20),
        allowNull: false,
        unique: true,
      },
      judul: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      deskripsi: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      keyword: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      cluster: {
        type: DataTypes.ENUM("Sirkel", "Siber", "ITSC", "MVK"),
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM("available", "reserved", "taken", "unavailable"),
        defaultValue: "available",
        allowNull: false,
      },
      dosen_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Dosens",
          key: "id",
        },
      },
    },
    {
      sequelize,
      modelName: "Topik",
      tableName: "Topiks",
    }
  );

  return Topik;
};
