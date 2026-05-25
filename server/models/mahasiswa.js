"use strict";
const bcrypt = require("bcrypt");
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Mahasiswa extends Model {
    static associate(models) {
      // Relasi dengan Pengajuan (one to many)
      Mahasiswa.hasMany(models.Pengajuan, {
        foreignKey: "mahasiswa_id",
        as: "pengajuans",
      });

      // Relasi dengan Pengajuan Aktif (one to one)
      Mahasiswa.belongsTo(models.Pengajuan, {
        foreignKey: "pengajuan_aktif_id",
        as: "pengajuanAktif",
      });

      // Relasi dengan Dosen Pembimbing Akademik
      Mahasiswa.belongsTo(models.Dosen, {
        foreignKey: "dosen_pembimbing_akademik_id",
        as: "dosenPembimbingAkademik",
      });

      // Relasi dengan Dosen Pembimbing Skripsi
      Mahasiswa.belongsTo(models.Dosen, {
        foreignKey: "dosen_pembimbing_skripsi_id",
        as: "dosenPembimbingSkripsi",
      });

      // Relasi dengan form pendaftaran penjaluran
      Mahasiswa.hasMany(models.PendaftaranPenjaluran, {
        foreignKey: "mahasiswa_id",
        as: "pendaftaranPenjalurans",
      });

      // Relasi permohonan extend semester ke-3
      Mahasiswa.hasMany(models.IzinLanjutSkripsi, {
        foreignKey: "mahasiswa_id",
        as: "izinLanjutSkripsis",
      });

      // Relasi sesi bimbingan skripsi
      Mahasiswa.hasMany(models.BimbinganSkripsi, {
        foreignKey: "mahasiswa_id",
        as: "bimbinganSkripsis",
      });

      // Relasi dokumen kesiapan sidang (one to one)
      Mahasiswa.hasOne(models.DokumenSidang, {
        foreignKey: "mahasiswa_id",
        as: "dokumenSidang",
      });
    }

    // Method untuk compare password
    async comparePassword(candidatePassword) {
      return await bcrypt.compare(candidatePassword, this.password);
    }
  }

  Mahasiswa.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      nim: {
        type: DataTypes.STRING(20),
        allowNull: false,
        unique: true,
      },
      nama: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
      },
      password: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      is_default_password: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      angkatan: {
        type: DataTypes.STRING(10),
        allowNull: true,
      },
      dosen_pembimbing_akademik_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "Dosens",
          key: "id",
        },
      },
      dosen_pembimbing_skripsi_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "Dosens",
          key: "id",
        },
      },
      status_jalur_saat_ini: {
        type: DataTypes.ENUM("belum_mengajukan", "sedang_mengajukan", "baru", "ulang", "ekstensi", "selesai"),
        allowNull: false,
        defaultValue: "belum_mengajukan",
      },
      pengajuan_aktif_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "Pengajuans",
          key: "id",
        },
      },
    },
    {
      sequelize,
      modelName: "Mahasiswa",
      tableName: "Mahasiswas",
      timestamps: true,
      hooks: {
        beforeCreate: async (mahasiswa) => {
          if (mahasiswa.password) {
            const salt = await bcrypt.genSalt(10);
            mahasiswa.password = await bcrypt.hash(mahasiswa.password, salt);
          }
        },
        beforeUpdate: async (mahasiswa) => {
          if (mahasiswa.changed("password")) {
            const salt = await bcrypt.genSalt(10);
            mahasiswa.password = await bcrypt.hash(mahasiswa.password, salt);
          }
        },
      },
    }
  );

  return Mahasiswa;
};
