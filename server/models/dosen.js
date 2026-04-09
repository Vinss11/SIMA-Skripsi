"use strict";
const bcrypt = require("bcrypt");
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Dosen extends Model {
    static associate(models) {
      // Relasi dengan Mahasiswa (sebagai dosen pembimbing skripsi)
      Dosen.hasMany(models.Mahasiswa, {
        foreignKey: "dosen_pembimbing_skripsi_id",
        as: "mahasiswaBimbinganSkripsi",
      });

      // Relasi dengan Mahasiswa (sebagai dosen pembimbing akademik)
      Dosen.hasMany(models.Mahasiswa, {
        foreignKey: "dosen_pembimbing_akademik_id",
        as: "mahasiswaBimbinganAkademik",
      });

      // Relasi dengan Topik
      Dosen.hasMany(models.Topik, {
        foreignKey: "dosen_id",
        as: "topiks",
      });
    }

    // Method untuk compare password
    async comparePassword(candidatePassword) {
      return await bcrypt.compare(candidatePassword, this.password);
    }

    // Method untuk cek apakah kuota masih tersedia
    async checkKuotaAvailable() {
      const Mahasiswa = sequelize.models.Mahasiswa;
      const count = await Mahasiswa.count({
        where: { dosen_pembimbing_skripsi_id: this.id },
      });
      return count < this.kuota_bimbingan;
    }

    // Method untuk mendapatkan sisa kuota
    async getSisaKuota() {
      const Mahasiswa = sequelize.models.Mahasiswa;
      const count = await Mahasiswa.count({
        where: { dosen_pembimbing_skripsi_id: this.id },
      });
      return this.kuota_bimbingan - count;
    }

    // Method untuk mendapatkan jumlah mahasiswa yang dibimbing
    async getJumlahMahasiswaDibimbing() {
      const Mahasiswa = sequelize.models.Mahasiswa;
      return await Mahasiswa.count({
        where: { dosen_pembimbing_skripsi_id: this.id },
      });
    }

    // Method untuk mendapatkan info kuota lengkap
    async getKuotaInfo() {
      const terpakai = await this.getJumlahMahasiswaDibimbing();
      const sisa = this.kuota_bimbingan - terpakai;
      const persentase = (terpakai / this.kuota_bimbingan) * 100;

      return {
        total: this.kuota_bimbingan,
        terpakai,
        sisa,
        persentase: Math.round(persentase),
        is_penuh: sisa <= 0,
      };
    }
  }

  Dosen.init(
    {
      nip: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      nama: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      is_default_password: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      jabatan: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      kuota_bimbingan: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 5,
      },
    },
    {
      sequelize,
      modelName: "Dosen",
      tableName: "Dosens",
      hooks: {
        beforeCreate: async (dosen) => {
          if (dosen.password) {
            const salt = await bcrypt.genSalt(10);
            dosen.password = await bcrypt.hash(dosen.password, salt);
          }
        },
        beforeUpdate: async (dosen) => {
          if (dosen.changed("password")) {
            const salt = await bcrypt.genSalt(10);
            dosen.password = await bcrypt.hash(dosen.password, salt);
          }
        },
      },
    }
  );

  return Dosen;
};
