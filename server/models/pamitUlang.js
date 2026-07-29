"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class PamitUlang extends Model {
    static associate(models) {
      // Relasi dengan Mahasiswa
      PamitUlang.belongsTo(models.Mahasiswa, {
        foreignKey: "mahasiswa_id",
        as: "mahasiswa",
      });

      // Relasi dengan Pengajuan Sebelumnya
      PamitUlang.belongsTo(models.Pengajuan, {
        foreignKey: "pengajuan_sebelumnya_id",
        as: "pengajuanSebelumnya",
      });

      // Relasi dengan Pengajuan Baru (one to one)
      PamitUlang.hasOne(models.Pengajuan, {
        foreignKey: "pamit_ulang_id",
        as: "pengajuanBaru",
      });
      PamitUlang.belongsTo(models.PeriodePenjaluran, { foreignKey: "periode_tujuan_id", as: "periodeTujuan" });
      PamitUlang.belongsTo(models.PendaftaranPenjaluran, { foreignKey: "pendaftaran_lama_id", as: "pendaftaranLama" });
      PamitUlang.belongsTo(models.PendaftaranPenjaluran, { foreignKey: "pendaftaran_baru_id", as: "pendaftaranBaru" });
      PamitUlang.belongsTo(models.PenetapanPembimbing, { foreignKey: "penetapan_lama_id", as: "penetapanLama" });
      PamitUlang.belongsTo(models.Dosen, { foreignKey: "reviewer_p1_id", as: "reviewerP1" });
      PamitUlang.hasMany(models.RiwayatPamitPenjaluran, { foreignKey: "pamit_ulang_id", as: "riwayatStatus" });
    }
  }

  PamitUlang.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      mahasiswa_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Mahasiswas",
          key: "id",
        },
      },
      pengajuan_sebelumnya_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "Pengajuans",
          key: "id",
        },
      },
      periode_tujuan_id: DataTypes.INTEGER,
      pendaftaran_lama_id: DataTypes.INTEGER,
      pendaftaran_baru_id: DataTypes.INTEGER,
      penetapan_lama_id: DataTypes.INTEGER,
      reviewer_p1_id: DataTypes.INTEGER,
      jenis_perubahan: DataTypes.STRING(16),
      jalur_asal: DataTypes.STRING(40),
      jalur_tujuan: DataTypes.STRING(40),
      status: {
        type: DataTypes.ENUM("pending", "approved", "rejected", "consumed", "cancelled"),
        allowNull: false,
        defaultValue: "pending",
      },
      submitted_at: DataTypes.DATE,
      decided_at: DataTypes.DATE,
      consumed_at: DataTypes.DATE,
      cancellation_reason: DataTypes.TEXT,
      idempotency_key: DataTypes.STRING(255),
      metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      pengajuan_baru_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "Pengajuans",
          key: "id",
        },
      },
      pesan_ke_dosen_pembimbing: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      alasan_ulang: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      catatan_tambahan: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      status_dpa: {
        type: DataTypes.ENUM("pending", "approved", "rejected"),
        defaultValue: "pending",
        allowNull: false,
      },
      status_dospem: {
        type: DataTypes.ENUM("pending", "approved", "rejected"),
        defaultValue: "pending",
        allowNull: false,
      },
      keterangan_dpa: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      keterangan_dospem: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      tanggal_approval_dpa: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      tanggal_approval_dospem: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "PamitUlang",
      tableName: "PamitUlangs",
      timestamps: true,
    }
  );

  return PamitUlang;
};
