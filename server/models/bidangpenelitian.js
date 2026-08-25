"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class BidangPenelitian extends Model {
    static associate(models) {
      BidangPenelitian.belongsToMany(models.Dosen, {
        through: models.DosenBidangPenelitian,
        foreignKey: "bidang_penelitian_id",
        otherKey: "dosen_id",
        as: "dosens",
      });
      BidangPenelitian.belongsToMany(models.Pengajuan, {
        through: models.PengajuanBidangPenelitian,
        foreignKey: "bidang_penelitian_id",
        otherKey: "pengajuan_id",
        as: "pengajuans",
      });
      BidangPenelitian.belongsToMany(models.Topik, {
        through: models.TopikBidangPenelitian,
        foreignKey: "bidang_penelitian_id",
        otherKey: "topik_id",
        as: "topiks",
      });
      BidangPenelitian.hasMany(models.DosenBidangPenelitian, {
        foreignKey: "bidang_penelitian_id",
        as: "dosenAssignments",
      });
      BidangPenelitian.hasMany(models.PengajuanBidangPenelitian, {
        foreignKey: "bidang_penelitian_id",
        as: "pengajuanAssignments",
      });
      BidangPenelitian.hasMany(models.TopikBidangPenelitian, {
        foreignKey: "bidang_penelitian_id",
        as: "topikAssignments",
      });
    }
  }

  BidangPenelitian.init(
    {
      kode: {
        type: DataTypes.STRING(20),
        allowNull: false,
        unique: true,
      },
      nama: {
        type: DataTypes.STRING(150),
        allowNull: false,
        unique: true,
      },
      deskripsi: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      contoh_kata_kunci: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "BidangPenelitian",
      tableName: "BidangPenelitians",
      timestamps: true,
    }
  );

  return BidangPenelitian;
};
