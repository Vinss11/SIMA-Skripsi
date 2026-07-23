"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class RiwayatKetersediaanMembimbing extends Model {
    static associate(models) {
      RiwayatKetersediaanMembimbing.belongsTo(models.Dosen, {
        foreignKey: "dosen_id",
        as: "dosen",
      });
      RiwayatKetersediaanMembimbing.belongsTo(models.PeriodePenjaluran, {
        foreignKey: "periode_penjaluran_id",
        as: "periode",
      });
      RiwayatKetersediaanMembimbing.belongsTo(models.SekretarisProdi, {
        foreignKey: "changed_by_sekretaris_id",
        as: "changedBySekretaris",
      });
    }
  }

  RiwayatKetersediaanMembimbing.init({
    dosen_id: { type: DataTypes.INTEGER, allowNull: false },
    periode_penjaluran_id: { type: DataTypes.INTEGER, allowNull: false },
    tersedia_sebelumnya: { type: DataTypes.BOOLEAN, allowNull: true },
    tersedia_baru: { type: DataTypes.BOOLEAN, allowNull: false },
    changed_by_sekretaris_id: { type: DataTypes.INTEGER, allowNull: true },
    sumber_perubahan: {
      type: DataTypes.ENUM("period_opening", "manual_update", "master_status_change", "new_dosen"),
      allowNull: false,
    },
  }, {
    sequelize,
    modelName: "RiwayatKetersediaanMembimbing",
    tableName: "RiwayatKetersediaanMembimbings",
    timestamps: true,
  });

  return RiwayatKetersediaanMembimbing;
};
