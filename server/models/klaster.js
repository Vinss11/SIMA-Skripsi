"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Klaster extends Model {
    static associate(models) {
      Klaster.belongsToMany(models.Dosen, {
        through: models.DosenKlaster,
        foreignKey: "klaster_id",
        otherKey: "dosen_id",
        as: "dosens",
      });

      Klaster.hasMany(models.DosenKlaster, {
        foreignKey: "klaster_id",
        as: "dosenKlasters",
      });

      Klaster.hasMany(models.KlasterKetuaPeriode, {
        foreignKey: "klaster_id",
        as: "ketuaPeriodes",
      });
    }
  }

  Klaster.init(
    {
      kode: {
        type: DataTypes.STRING(20),
        allowNull: false,
        unique: true,
      },
      nama: {
        type: DataTypes.STRING(120),
        allowNull: false,
        unique: true,
      },
    },
    {
      sequelize,
      modelName: "Klaster",
      tableName: "Klasters",
      timestamps: true,
    }
  );

  return Klaster;
};
