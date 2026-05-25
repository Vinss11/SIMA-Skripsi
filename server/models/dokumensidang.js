"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class DokumenSidang extends Model {
    static associate(models) {
      DokumenSidang.belongsTo(models.Mahasiswa, {
        foreignKey: "mahasiswa_id",
        as: "mahasiswa",
      });
    }
  }

  DokumenSidang.init(
    {
      mahasiswa_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      transkrip_file_path: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      transkrip_file_name: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      transkrip_status: {
        type: DataTypes.ENUM("belum_upload", "submitted", "revisi", "approved"),
        allowNull: false,
        defaultValue: "belum_upload",
      },
      transkrip_uploaded_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      transkrip_review_note: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      transkrip_reviewed_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      cept_file_path: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      cept_file_name: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      cept_status: {
        type: DataTypes.ENUM("belum_upload", "submitted", "revisi", "approved"),
        allowNull: false,
        defaultValue: "belum_upload",
      },
      cept_uploaded_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      cept_review_note: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      cept_reviewed_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      draft_skripsi_file_path: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      draft_skripsi_file_name: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      draft_skripsi_status: {
        type: DataTypes.ENUM("belum_upload", "submitted", "revisi", "approved"),
        allowNull: false,
        defaultValue: "belum_upload",
      },
      draft_skripsi_uploaded_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      draft_skripsi_review_note: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      draft_skripsi_reviewed_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "DokumenSidang",
      tableName: "DokumenSidangs",
      timestamps: true,
    }
  );

  return DokumenSidang;
};

