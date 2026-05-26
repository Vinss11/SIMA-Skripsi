"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class JadwalSidangPenguji extends Model {
    static associate(models) {
      JadwalSidangPenguji.belongsTo(models.PeriodeSidang, {
        foreignKey: "periode_sidang_id",
        as: "periodeSidang",
      });

      JadwalSidangPenguji.belongsTo(models.PendaftaranSidang, {
        foreignKey: "pendaftaran_sidang_id",
        as: "pendaftaranSidang",
      });

      JadwalSidangPenguji.belongsTo(models.Mahasiswa, {
        foreignKey: "mahasiswa_id",
        as: "mahasiswa",
      });

      JadwalSidangPenguji.belongsTo(models.Dosen, {
        foreignKey: "dosen_pembimbing_id",
        as: "dosenPembimbing",
      });

      JadwalSidangPenguji.belongsTo(models.Dosen, {
        foreignKey: "penguji1_dosen_id",
        as: "penguji1",
      });

      JadwalSidangPenguji.belongsTo(models.Dosen, {
        foreignKey: "penguji2_dosen_id",
        as: "penguji2",
      });
    }
  }

  JadwalSidangPenguji.init(
    {
      periode_sidang_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      pendaftaran_sidang_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      mahasiswa_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      dosen_pembimbing_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      tanggal_sidang: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      sesi_ke: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      sesi_mulai: {
        type: DataTypes.STRING(5),
        allowNull: false,
      },
      sesi_selesai: {
        type: DataTypes.STRING(5),
        allowNull: false,
      },
      ruangan: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },
      penguji1_dosen_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      penguji2_dosen_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      assignment_status: {
        type: DataTypes.ENUM("assigned", "finalized", "cancelled"),
        allowNull: false,
        defaultValue: "assigned",
      },
      generated_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "JadwalSidangPenguji",
      tableName: "JadwalSidangPengujis",
      timestamps: true,
    }
  );

  return JadwalSidangPenguji;
};
