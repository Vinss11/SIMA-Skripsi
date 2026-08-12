"use strict";

const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class PeriodeAkademik extends Model {
    static associate(models) {
      PeriodeAkademik.hasMany(models.PeriodePenjaluran, {
        foreignKey: "periode_akademik_id",
        as: "periodePenjalurans",
      });
    }
  }

  PeriodeAkademik.init({
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    kode: { type: DataTypes.STRING(40), allowNull: false, unique: true },
    tahun_akademik: { type: DataTypes.STRING(20), allowNull: false },
    semester: { type: DataTypes.ENUM("ganjil", "genap"), allowNull: false },
    tanggal_mulai: { type: DataTypes.DATE, allowNull: true },
    tanggal_selesai: { type: DataTypes.DATE, allowNull: true },
    status: { type: DataTypes.ENUM("draft", "active", "closed"), allowNull: false, defaultValue: "draft" },
  }, {
    sequelize,
    modelName: "PeriodeAkademik",
    tableName: "PeriodeAkademiks",
    timestamps: true,
    indexes: [
      { unique: true, fields: ["tahun_akademik", "semester"], name: "uq_periode_akademik_tahun_semester" },
      { unique: true, fields: ["status"], where: { status: "active" }, name: "uq_academic_period_single_active" },
    ],
  });

  return PeriodeAkademik;
};
