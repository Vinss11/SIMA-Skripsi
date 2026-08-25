"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class PengajuanBidangPenelitian extends Model {
    static associate(models) {
      PengajuanBidangPenelitian.belongsTo(models.Pengajuan, {
        foreignKey: "pengajuan_id",
        as: "pengajuan",
      });
      PengajuanBidangPenelitian.belongsTo(models.BidangPenelitian, {
        foreignKey: "bidang_penelitian_id",
        as: "bidangPenelitian",
      });
    }
  }

  PengajuanBidangPenelitian.init(
    {
      pengajuan_id: {
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
      modelName: "PengajuanBidangPenelitian",
      tableName: "PengajuanBidangPenelitians",
      timestamps: true,
    }
  );

  return PengajuanBidangPenelitian;
};
