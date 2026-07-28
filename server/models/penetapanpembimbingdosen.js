"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class PenetapanPembimbingDosen extends Model {
    static associate(models) {
      PenetapanPembimbingDosen.belongsTo(models.PenetapanPembimbing, { foreignKey: "penetapan_pembimbing_id", as: "penetapan" });
      PenetapanPembimbingDosen.belongsTo(models.Dosen, { foreignKey: "dosen_id", as: "dosen" });
    }
  }
  PenetapanPembimbingDosen.init({
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    penetapan_pembimbing_id: { type: DataTypes.INTEGER, allowNull: false },
    dosen_id: { type: DataTypes.INTEGER, allowNull: false },
    urutan: { type: DataTypes.INTEGER, allowNull: false, validate: { isIn: [[1, 2]] } },
    peran: { type: DataTypes.ENUM("utama", "pendamping"), allowNull: false },
    status: {
      type: DataTypes.ENUM("draft", "active", "ended", "cancelled"),
      allowNull: false,
      defaultValue: "draft",
    },
    tanggal_mulai: DataTypes.DATE,
    tanggal_selesai: DataTypes.DATE,
  }, {
    sequelize,
    modelName: "PenetapanPembimbingDosen",
    tableName: "PenetapanPembimbingDosens",
    timestamps: true,
  });
  return PenetapanPembimbingDosen;
};
