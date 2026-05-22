"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class KlasterKetuaPeriode extends Model {
    static associate(models) {
      KlasterKetuaPeriode.belongsTo(models.Klaster, {
        foreignKey: "klaster_id",
        as: "klaster",
      });

      KlasterKetuaPeriode.belongsTo(models.Dosen, {
        foreignKey: "dosen_id",
        as: "ketuaDosen",
      });

      KlasterKetuaPeriode.belongsTo(models.PeriodePenjaluran, {
        foreignKey: "periode_penjaluran_id",
        as: "periode",
      });

      KlasterKetuaPeriode.belongsTo(models.SekretarisProdi, {
        foreignKey: "assigned_by_sekretaris_id",
        as: "assignedBySekretaris",
      });
    }
  }

  KlasterKetuaPeriode.init(
    {
      klaster_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      dosen_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      periode_penjaluran_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      assigned_by_sekretaris_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "KlasterKetuaPeriode",
      tableName: "KlasterKetuaPeriodes",
      timestamps: true,
    }
  );

  return KlasterKetuaPeriode;
};

