"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class BimbinganSkripsi extends Model {
    static associate(models) {
      BimbinganSkripsi.belongsTo(models.Mahasiswa, {
        foreignKey: "mahasiswa_id",
        as: "mahasiswa",
      });

      BimbinganSkripsi.belongsTo(models.Dosen, {
        foreignKey: "dosen_id",
        as: "dosen",
      });

      BimbinganSkripsi.belongsTo(models.Pengajuan, {
        foreignKey: "pengajuan_id",
        as: "pengajuan",
      });
    }
  }

  BimbinganSkripsi.init(
    {
      mahasiswa_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      dosen_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      pengajuan_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      permintaan_pesan: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      permintaan_tanggal: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      permintaan_jam: {
        type: DataTypes.STRING(5),
        allowNull: false,
      },
      status_permohonan: {
        type: DataTypes.ENUM("pending", "approved", "rescheduled", "rejected", "expired"),
        allowNull: false,
        defaultValue: "pending",
      },
      catatan_dosen: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      lokasi_bimbingan: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      tanggal_keputusan: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      status_resume: {
        type: DataTypes.ENUM("belum_diisi", "submitted", "approved", "revisi", "rejected"),
        allowNull: false,
        defaultValue: "belum_diisi",
      },
      resume_mahasiswa: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      catatan_review_resume: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      tanggal_review_resume: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      is_counted: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      sequelize,
      modelName: "BimbinganSkripsi",
      tableName: "BimbinganSkripsis",
      timestamps: true,
    }
  );

  return BimbinganSkripsi;
};
