"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class IzinLanjutSkripsi extends Model {
    static associate(models) {
      IzinLanjutSkripsi.belongsTo(models.Mahasiswa, {
        foreignKey: "mahasiswa_id",
        as: "mahasiswa",
      });

      IzinLanjutSkripsi.belongsTo(models.Dosen, {
        foreignKey: "dosen_pembimbing_skripsi_id",
        as: "dosenPembimbingSkripsi",
      });

      IzinLanjutSkripsi.belongsTo(models.PeriodePenjaluran, {
        foreignKey: "periode_penjaluran_id",
        as: "periode",
      });
      IzinLanjutSkripsi.belongsTo(models.PendaftaranPenjaluran, { foreignKey: "pendaftaran_penjaluran_id", as: "pendaftaran" });
      IzinLanjutSkripsi.belongsTo(models.PenetapanPembimbing, { foreignKey: "penetapan_asal_id", as: "penetapanAsal" });
      IzinLanjutSkripsi.belongsTo(models.PenetapanPembimbing, { foreignKey: "penetapan_hasil_id", as: "penetapanHasil" });
      IzinLanjutSkripsi.belongsTo(models.Dosen, { foreignKey: "reviewer_p1_id", as: "reviewerP1" });
    }
  }

  IzinLanjutSkripsi.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      mahasiswa_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      dosen_pembimbing_skripsi_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      periode_penjaluran_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      semester_penjaluran_ke: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM("pending", "approved", "rejected"),
        allowNull: false,
        defaultValue: "pending",
      },
      alasan_pengajuan: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      keterangan_dosen: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      tanggal_pengajuan: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      tanggal_keputusan: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      pendaftaran_penjaluran_id: DataTypes.INTEGER,
      penetapan_asal_id: DataTypes.INTEGER,
      reviewer_p1_id: DataTypes.INTEGER,
      penetapan_hasil_id: DataTypes.INTEGER,
      idempotency_key: DataTypes.STRING(160),
      request_fingerprint: DataTypes.STRING(64),
      decided_by_actor_type: DataTypes.STRING(40),
      decided_by_actor_id: DataTypes.INTEGER,
    },
    {
      sequelize,
      modelName: "IzinLanjutSkripsi",
      tableName: "IzinLanjutSkripsis",
      timestamps: true,
    }
  );

  return IzinLanjutSkripsi;
};
