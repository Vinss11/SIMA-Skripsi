"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class DosenBidangPenelitian extends Model {
    static associate(models) {
      DosenBidangPenelitian.belongsTo(models.Dosen, {
        foreignKey: "dosen_id",
        as: "dosen",
      });
      DosenBidangPenelitian.belongsTo(models.BidangPenelitian, {
        foreignKey: "bidang_penelitian_id",
        as: "bidangPenelitian",
      });
    }
  }

  DosenBidangPenelitian.init(
    {
      dosen_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      bidang_penelitian_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "DosenBidangPenelitian",
      tableName: "DosenBidangPenelitians",
      timestamps: true,
    }
  );

  return DosenBidangPenelitian;
};
