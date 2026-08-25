"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class TopikBidangPenelitian extends Model {
    static associate(models) {
      TopikBidangPenelitian.belongsTo(models.Topik, {
        foreignKey: "topik_id",
        as: "topik",
      });
      TopikBidangPenelitian.belongsTo(models.BidangPenelitian, {
        foreignKey: "bidang_penelitian_id",
        as: "bidangPenelitian",
      });
    }
  }

  TopikBidangPenelitian.init(
    {
      topik_id: {
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
      modelName: "TopikBidangPenelitian",
      tableName: "TopikBidangPenelitians",
      timestamps: true,
    }
  );

  return TopikBidangPenelitian;
};
