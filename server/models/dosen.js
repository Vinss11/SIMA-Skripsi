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

      // Relasi many-to-many dengan Klaster Riset
      Dosen.belongsToMany(models.Klaster, {
        through: models.DosenKlaster,
        foreignKey: "dosen_id",
        otherKey: "klaster_id",
        as: "klasters",
      });

      Dosen.hasMany(models.DosenKlaster, {
        foreignKey: "dosen_id",
        as: "dosenKlasters",
      });

      Dosen.hasMany(models.IzinLanjutSkripsi, {
        foreignKey: "dosen_pembimbing_skripsi_id",
        as: "izinLanjutMahasiswa",
      });

      Dosen.hasMany(models.KlasterKetuaPeriode, {
        foreignKey: "dosen_id",
        as: "ketuaKlasterPeriodes",
      });

      Dosen.hasMany(models.MasterPenanggungJawabPenjaluran, {
        foreignKey: "ketua_itsc_dosen_id",
        as: "masterKetuaItscPeriodes",
      });

      Dosen.hasMany(models.MasterPenanggungJawabPenjaluran, {
        foreignKey: "ketua_sirkel_dosen_id",
        as: "masterKetuaSirkelPeriodes",
      });

      Dosen.hasMany(models.MasterPenanggungJawabPenjaluran, {
        foreignKey: "ketua_siber_dosen_id",
        as: "masterKetuaSiberPeriodes",
      });

      Dosen.hasMany(models.MasterPenanggungJawabPenjaluran, {
        foreignKey: "ketua_mvk_dosen_id",
        as: "masterKetuaMvkPeriodes",
      });

      Dosen.hasMany(models.MasterPenanggungJawabPenjaluran, {
        foreignKey: "pengawas_magang_dosen_id",
        as: "masterPengawasMagangPeriodes",
      });

      Dosen.hasMany(models.MasterPenanggungJawabPenjaluran, {
        foreignKey: "pengawas_pengabdian_dosen_id",
        as: "masterPengawasPengabdianPeriodes",
      });

      Dosen.hasMany(models.MasterPenanggungJawabPenjaluran, {
        foreignKey: "pengawas_perintisan_bisnis_dosen_id",
        as: "masterPengawasPerintisanBisnisPeriodes",
      });

      Dosen.hasMany(models.PeriodePenjaluran, {
        foreignKey: "ketua_penelitian_dosen_id",
        as: "periodeKetuaPenelitian",
      });

      Dosen.hasMany(models.PeriodePenjaluran, {
        foreignKey: "pengawas_magang_dosen_id",
        as: "periodePengawasMagang",
      });

      Dosen.hasMany(models.PeriodePenjaluran, {
        foreignKey: "pengawas_pengabdian_dosen_id",
        as: "periodePengawasPengabdian",
      });

      Dosen.hasMany(models.PeriodePenjaluran, {
        foreignKey: "pengawas_perintisan_bisnis_dosen_id",
        as: "periodePengawasPerintisanBisnis",
      });

      Dosen.hasMany(models.BimbinganSkripsi, {
        foreignKey: "dosen_id",
        as: "bimbinganSkripsis",
      });

      Dosen.hasMany(models.PendaftaranSidang, {
        foreignKey: "dosen_pembimbing_id",
        as: "pendaftaranSidangBimbingan",
      });

      Dosen.hasMany(models.KetersediaanPengujiSidang, {
        foreignKey: "dosen_id",
        as: "ketersediaanPengujiSidang",
      });

      Dosen.hasMany(models.JadwalSidangPenguji, {
        foreignKey: "dosen_pembimbing_id",
        as: "jadwalSidangSebagaiPembimbing",
      });

      Dosen.hasMany(models.JadwalSidangPenguji, {
        foreignKey: "penguji1_dosen_id",
        as: "jadwalSidangSebagaiPenguji1",
      });

      Dosen.hasMany(models.JadwalSidangPenguji, {
        foreignKey: "penguji2_dosen_id",
        as: "jadwalSidangSebagaiPenguji2",
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
      kode_dosen: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      nik: {
        type: DataTypes.STRING(9),
        allowNull: true,
        unique: true,
      },
      nama: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      gelar: {
        type: DataTypes.STRING,
        allowNull: true,
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
      jabatan_struktural: {
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

