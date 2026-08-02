"use strict";
const bcrypt = require("bcrypt");
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class SekretarisProdi extends Model {
    static associate(models) {
      SekretarisProdi.hasMany(models.PendaftaranPenjaluran, {
        foreignKey: "reviewed_by_sekretaris_id",
        as: "pendaftaranReviewed",
      });

      SekretarisProdi.hasMany(models.KlasterKetuaPeriode, {
        foreignKey: "assigned_by_sekretaris_id",
        as: "ketuaKlasterAssignments",
      });

      SekretarisProdi.hasMany(models.PeriodeSidang, {
        foreignKey: "created_by_sekretaris_id",
        as: "periodeSidangCreated",
      });

      SekretarisProdi.hasMany(models.MasterPenanggungJawabPenjaluran, {
        foreignKey: "updated_by_sekretaris_id",
        as: "masterPenanggungJawabUpdated",
      });

      SekretarisProdi.hasMany(models.RiwayatPersetujuan, {
        foreignKey: "sekretaris_prodi_id",
        as: "riwayatPersetujuanTopik",
      });

      SekretarisProdi.hasMany(models.DosenKetersediaanPeriode, { foreignKey: "updated_by_sekretaris_id", as: "ketersediaanDosenUpdated" });
      SekretarisProdi.hasMany(models.RiwayatKetersediaanMembimbing, { foreignKey: "changed_by_sekretaris_id", as: "riwayatKetersediaanMembimbingChanged" });
      SekretarisProdi.hasMany(models.TindakLanjutStatusDosen, { foreignKey: "resolved_by_sekretaris_id", as: "tindakLanjutStatusResolved" });
    }

    async comparePassword(candidatePassword) {
      return bcrypt.compare(candidatePassword, this.password);
    }
  }

  SekretarisProdi.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      nik: {
        type: DataTypes.STRING(9),
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
        allowNull: false,
        defaultValue: true,
      },
      credential_state: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "default" },
      credential_version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      password_changed_at: { type: DataTypes.DATE, allowNull: true }, password_origin: { type: DataTypes.STRING(30), allowNull: true },
      force_change_reason: { type: DataTypes.STRING(120), allowNull: true }, security_updated_at: { type: DataTypes.DATE, allowNull: true },
      security_updated_by_type: { type: DataTypes.STRING(30), allowNull: true }, security_updated_by_id: { type: DataTypes.INTEGER, allowNull: true },
      recovery_email_verified_at: { type: DataTypes.DATE, allowNull: true },
      recovery_email_verification_source: { type: DataTypes.STRING(80), allowNull: true },
      jabatan: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "SekretarisProdi",
      tableName: "SekretarisProdis",
      timestamps: true,
      hooks: {
        beforeCreate: async (sekretaris) => {
          if (sekretaris.password) {
            const salt = await bcrypt.genSalt(10);
            sekretaris.password = await bcrypt.hash(sekretaris.password, salt);
          }
        },
        beforeUpdate: async (sekretaris) => {
          if (sekretaris.changed("password")) {
            const salt = await bcrypt.genSalt(10);
            sekretaris.password = await bcrypt.hash(sekretaris.password, salt);
          }
        },
      },
    }
  );

  return SekretarisProdi;
};

