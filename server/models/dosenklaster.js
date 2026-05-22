"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class DosenKlaster extends Model {
    static associate(models) {
      DosenKlaster.belongsTo(models.Dosen, {
        foreignKey: "dosen_id",
        as: "dosen",
      });

      DosenKlaster.belongsTo(models.Klaster, {
        foreignKey: "klaster_id",
        as: "klaster",
      });
    }
  }

  DosenKlaster.init(
    {
      dosen_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      klaster_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "DosenKlaster",
      tableName: "DosenKlasters",
      timestamps: true,
    }
  );

  return DosenKlaster;
};
