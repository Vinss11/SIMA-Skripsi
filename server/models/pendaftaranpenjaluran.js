"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class PendaftaranPenjaluran extends Model {
    static associate(models) {
      PendaftaranPenjaluran.belongsTo(models.Mahasiswa, {
        foreignKey: "mahasiswa_id",
        as: "mahasiswa",
      });

      PendaftaranPenjaluran.belongsTo(models.PeriodePenjaluran, {
        foreignKey: "periode_penjaluran_id",
        as: "periode",
      });

      PendaftaranPenjaluran.belongsTo(models.Dosen, {
        foreignKey: "dosen_pembimbing_akademik_id",
        as: "dosenPembimbingAkademik",
      });

      PendaftaranPenjaluran.belongsTo(models.Dosen, {
        foreignKey: "dosen_pembimbing_ta_id",
        as: "dosenPembimbingTA",
      });

      PendaftaranPenjaluran.belongsTo(models.Dosen, {
        foreignKey: "dosen_pembimbing_ta_sebelumnya_id",
        as: "dosenPembimbingTASebelumnya",
      });

      PendaftaranPenjaluran.belongsTo(models.Dosen, {
        foreignKey: "dosen_pembimbing_ta_baru_id",
        as: "dosenPembimbingTABaru",
      });

      PendaftaranPenjaluran.belongsTo(models.SekretarisProdi, {
        foreignKey: "reviewed_by_sekretaris_id",
        as: "reviewedBySekretaris",
      });

      PendaftaranPenjaluran.hasOne(models.Pengajuan, {
        foreignKey: "pendaftaran_penjaluran_id",
        as: "pengajuan",
      });
    }
  }

  PendaftaranPenjaluran.init(
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
      periode_penjaluran_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      jalur: {
        type: DataTypes.ENUM("baru", "ulang", "alih"),
        allowNull: false,
        defaultValue: "baru",
      },
      semester_mahasiswa: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      nomor_whatsapp: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      catatan: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM("submitted", "processed", "approved", "rejected"),
        allowNull: false,
        defaultValue: "submitted",
      },
      dosen_pembimbing_akademik_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      jenis_jalur_diambil: {
        type: DataTypes.ENUM("penelitian", "pengabdian", "perintisan_bisnis", "magang"),
        allowNull: true,
      },
      dosen_pembimbing_ta_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      penjaluran_sebelumnya: {
        type: DataTypes.ENUM("penelitian", "pengabdian", "perintisan_bisnis", "magang"),
        allowNull: true,
      },
      penjaluran_baru: {
        type: DataTypes.ENUM("penelitian", "pengabdian", "perintisan_bisnis", "magang"),
        allowNull: true,
      },
      dosen_pembimbing_ta_sebelumnya_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      dosen_pembimbing_ta_baru_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      reviewed_by_sekretaris_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      reviewed_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      approval_note: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      form_lanjutan_status: {
        type: DataTypes.ENUM(
          "pending",
          "draft",
          "submitted",
          "review_dosen_magang",
          "review_sekprodi",
          "approved",
          "rejected"
        ),
        allowNull: false,
        defaultValue: "draft",
      },
      form_lanjutan_submitted_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      form_lanjutan_payload: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "PendaftaranPenjaluran",
      tableName: "PendaftaranPenjalurans",
      timestamps: true,
    }
  );

  return PendaftaranPenjaluran;
};
