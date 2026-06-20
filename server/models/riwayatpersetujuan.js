"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class RiwayatPersetujuan extends Model {
    static associate(models) {
      // Relasi dengan Pengajuan
      RiwayatPersetujuan.belongsTo(models.Pengajuan, {
        foreignKey: "pengajuan_id",
        as: "pengajuan",
      });

      // Relasi dengan Dosen
      RiwayatPersetujuan.belongsTo(models.Dosen, {
        foreignKey: "dosen_id",
        as: "dosen",
      });
    }
  }

  RiwayatPersetujuan.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      pengajuan_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Pengajuans",
          key: "id",
        },
      },
      dosen_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Dosens",
          key: "id",
        },
      },
      tipe_approval: {
        type: DataTypes.ENUM("dospem_akademik", "calon_pembimbing", "koordinator"),
        allowNull: false,
        defaultValue: "calon_pembimbing",
      },
      status: {
        type: DataTypes.ENUM("approved", "rejected", "pending"),
        allowNull: false,
      },
      keterangan: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      topik_slot: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      topik_kode: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      tanggal_keputusan: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: false,
      },
      reminder_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      last_reminded_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "RiwayatPersetujuan",
      tableName: "RiwayatPersetujuans",
      timestamps: true,
    }
  );

  return RiwayatPersetujuan;
};
