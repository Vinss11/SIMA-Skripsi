"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class PeriodePenjaluran extends Model {
    static associate(models) {
      PeriodePenjaluran.hasMany(models.PendaftaranPenjaluran, {
        foreignKey: "periode_penjaluran_id",
        as: "pendaftarans",
      });

      PeriodePenjaluran.hasMany(models.IzinLanjutSkripsi, {
        foreignKey: "periode_penjaluran_id",
        as: "izinLanjutSkripsis",
      });

      PeriodePenjaluran.hasMany(models.KlasterKetuaPeriode, {
        foreignKey: "periode_penjaluran_id",
        as: "ketuaKlasters",
      });

      PeriodePenjaluran.belongsTo(models.Dosen, {
        foreignKey: "ketua_penelitian_dosen_id",
        as: "ketuaPenelitianDosen",
      });

      PeriodePenjaluran.belongsTo(models.Dosen, {
        foreignKey: "pengawas_magang_dosen_id",
        as: "pengawasMagangDosen",
      });

      PeriodePenjaluran.belongsTo(models.Dosen, {
        foreignKey: "pengawas_pengabdian_dosen_id",
        as: "pengawasPengabdianDosen",
      });

      PeriodePenjaluran.belongsTo(models.Dosen, {
        foreignKey: "pengawas_perintisan_bisnis_dosen_id",
        as: "pengawasPerintisanBisnisDosen",
      });
    }
  }

  PeriodePenjaluran.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      tahun_akademik: {
        type: DataTypes.STRING(20),
        allowNull: false,
      },
      semester: {
        type: DataTypes.ENUM("ganjil", "genap"),
        allowNull: false,
      },
      label_periode: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
      },
      tanggal_mulai: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      tanggal_selesai: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      status: {
        type: DataTypes.ENUM("draft", "active", "closed"),
        allowNull: false,
        defaultValue: "active",
      },
      ketua_penelitian_dosen_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      pengawas_magang_dosen_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      pengawas_pengabdian_dosen_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      pengawas_perintisan_bisnis_dosen_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "PeriodePenjaluran",
      tableName: "PeriodePenjalurans",
      timestamps: true,
    }
  );

  return PeriodePenjaluran;
};
