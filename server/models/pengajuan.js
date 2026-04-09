"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Pengajuan extends Model {
    static associate(models) {
      // Relasi dengan Mahasiswa
      Pengajuan.belongsTo(models.Mahasiswa, {
        foreignKey: "mahasiswa_id",
        as: "mahasiswa",
      });

      // Relasi dengan Dosen pilihan 1, 2, 3
      Pengajuan.belongsTo(models.Dosen, {
        foreignKey: "dosen_pilihan_1",
        as: "dosen1",
      });

      Pengajuan.belongsTo(models.Dosen, {
        foreignKey: "dosen_pilihan_2",
        as: "dosen2",
      });

      Pengajuan.belongsTo(models.Dosen, {
        foreignKey: "dosen_pilihan_3",
        as: "dosen3",
      });

      // Relasi dengan Dosen saat ini (yang sedang mereview)
      Pengajuan.belongsTo(models.Dosen, {
        foreignKey: "dosen_saat_ini",
        as: "dosenCurrent",
      });

      // Relasi dengan Prospective Supervisor (untuk judul mandiri)
      Pengajuan.belongsTo(models.Dosen, {
        foreignKey: "prospective_supervisor_id",
        as: "prospectiveSupervisor",
      });

      // Relasi dengan Pengajuan Sebelumnya (untuk jalur ulang)
      Pengajuan.belongsTo(models.Pengajuan, {
        foreignKey: "pengajuan_sebelumnya_id",
        as: "pengajuanSebelumnya",
      });

      // Relasi dengan PamitUlang (untuk jalur ulang)
      Pengajuan.belongsTo(models.PamitUlang, {
        foreignKey: "pamit_ulang_id",
        as: "pamitUlang",
      });

      // Relasi dengan Riwayat Persetujuan
      Pengajuan.hasMany(models.RiwayatPersetujuan, {
        foreignKey: "pengajuan_id",
        as: "riwayat",
      });
    }
  }

  Pengajuan.init(
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
      // Status jalur mahasiswa
      jenis_jalur: {
        type: DataTypes.ENUM("baru", "ulang", "ekstensi"),
        allowNull: false,
        defaultValue: "baru",
      },
      // Tipe pengajuan
      tipe_pengajuan: {
        type: DataTypes.ENUM("topik_dosen", "judul_mandiri"),
        allowNull: false,
        defaultValue: "topik_dosen",
      },
      // ===== TOPIK DARI DOSEN (untuk tipe_pengajuan = 'topik_dosen') =====
      topik_1_kode: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      topik_1_judul: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      topik_2_kode: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      topik_2_judul: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      topik_3_kode: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      topik_3_judul: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      // ===== JUDUL MANDIRI (untuk tipe_pengajuan = 'judul_mandiri') =====
      judul_mandiri: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      deskripsi_mandiri: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      keyword_mandiri: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      prospective_supervisor_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "Dosens",
          key: "id",
        },
      },
      is_approved_by_supervisor: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: false,
      },
      // ===== DOSEN PILIHAN =====
      dosen_pilihan_1: {
        type: DataTypes.INTEGER,
        allowNull: true, // nullable untuk judul mandiri
        references: {
          model: "Dosens",
          key: "id",
        },
      },
      dosen_1_nama: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      dosen_pilihan_2: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "Dosens",
          key: "id",
        },
      },
      dosen_2_nama: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      dosen_pilihan_3: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "Dosens",
          key: "id",
        },
      },
      dosen_3_nama: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      dosen_saat_ini: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "Dosens",
          key: "id",
        },
      },
      // ===== UNTUK JALUR ULANG =====
      pengajuan_sebelumnya_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "Pengajuans",
          key: "id",
        },
      },
      alasan_ulang: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      surat_pengunduran_diri: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      // ===== STATUS & TRACKING =====
      status: {
        type: DataTypes.ENUM("pending", "approved", "rejected", "completed"),
        defaultValue: "pending",
        allowNull: false,
      },
      alasan_penolakan: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      alasan_persetujuan: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "Pengajuan",
      tableName: "Pengajuans",
      timestamps: true,
    }
  );

  return Pengajuan;
};
