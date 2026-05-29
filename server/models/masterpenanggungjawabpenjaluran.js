"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class MasterPenanggungJawabPenjaluran extends Model {
    static associate(models) {
      MasterPenanggungJawabPenjaluran.belongsTo(models.Dosen, {
        foreignKey: "ketua_itsc_dosen_id",
        as: "ketuaItscDosen",
      });

      MasterPenanggungJawabPenjaluran.belongsTo(models.Dosen, {
        foreignKey: "ketua_sirkel_dosen_id",
        as: "ketuaSirkelDosen",
      });

      MasterPenanggungJawabPenjaluran.belongsTo(models.Dosen, {
        foreignKey: "ketua_siber_dosen_id",
        as: "ketuaSiberDosen",
      });

      MasterPenanggungJawabPenjaluran.belongsTo(models.Dosen, {
        foreignKey: "ketua_mvk_dosen_id",
        as: "ketuaMvkDosen",
      });

      MasterPenanggungJawabPenjaluran.belongsTo(models.Dosen, {
        foreignKey: "pengawas_magang_dosen_id",
        as: "pengawasMagangDosen",
      });

      MasterPenanggungJawabPenjaluran.belongsTo(models.Dosen, {
        foreignKey: "pengawas_pengabdian_dosen_id",
        as: "pengawasPengabdianDosen",
      });

      MasterPenanggungJawabPenjaluran.belongsTo(models.Dosen, {
        foreignKey: "pengawas_perintisan_bisnis_dosen_id",
        as: "pengawasPerintisanBisnisDosen",
      });

      MasterPenanggungJawabPenjaluran.belongsTo(models.SekretarisProdi, {
        foreignKey: "updated_by_sekretaris_id",
        as: "updatedBySekretaris",
      });
    }
  }

  MasterPenanggungJawabPenjaluran.init(
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      ketua_itsc_dosen_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      ketua_sirkel_dosen_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      ketua_siber_dosen_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      ketua_mvk_dosen_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      pengawas_magang_dosen_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      pengawas_pengabdian_dosen_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      pengawas_perintisan_bisnis_dosen_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      updated_by_sekretaris_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "MasterPenanggungJawabPenjaluran",
      tableName: "MasterPenanggungJawabPenjalurans",
      timestamps: true,
    }
  );

  return MasterPenanggungJawabPenjaluran;
};

