"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class BimbinganSkripsi extends Model {
    static associate(models) {
      BimbinganSkripsi.belongsTo(models.Mahasiswa, {
        foreignKey: "mahasiswa_id",
        as: "mahasiswa",
      });

      BimbinganSkripsi.belongsTo(models.Dosen, {
        foreignKey: "dosen_id",
        as: "dosen",
      });

      BimbinganSkripsi.belongsTo(models.Dosen, {
        foreignKey: "reviewer_dosen_id",
        as: "reviewerDosen",
      });

      BimbinganSkripsi.belongsTo(models.Pengajuan, {
        foreignKey: "pengajuan_id",
        as: "pengajuan",
      });
      BimbinganSkripsi.belongsTo(models.PendaftaranPenjaluran, {
        foreignKey: "pendaftaran_penjaluran_id",
        as: "siklusPenjaluran",
      });
      BimbinganSkripsi.belongsTo(models.PenetapanPembimbing, {
        foreignKey: "penetapan_pembimbing_id",
        as: "penetapanPembimbing",
      });
      BimbinganSkripsi.belongsTo(models.PenetapanPembimbing, { foreignKey: "target_assignment_id", as: "targetAssignment" });
      BimbinganSkripsi.belongsTo(models.PenetapanPembimbingDosen, { foreignKey: "target_assignment_member_id", as: "targetAssignmentMember" });
      BimbinganSkripsi.belongsTo(models.PenetapanPembimbing, { foreignKey: "effective_reviewer_assignment_id", as: "effectiveReviewerAssignment" });
      BimbinganSkripsi.belongsTo(models.PenetapanPembimbingDosen, { foreignKey: "effective_reviewer_assignment_member_id", as: "effectiveReviewerMember" });
      BimbinganSkripsi.belongsTo(models.PeriodeAkademik, { foreignKey: "periode_akademik_id", as: "periodeAkademik" });
    }
  }

  BimbinganSkripsi.init(
    {
      mahasiswa_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      dosen_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      pengajuan_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      pendaftaran_penjaluran_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      penetapan_pembimbing_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      target_assignment_id: DataTypes.INTEGER,
      target_assignment_member_id: DataTypes.INTEGER,
      target_urutan_snapshot: DataTypes.INTEGER,
      effective_reviewer_assignment_id: DataTypes.INTEGER,
      effective_reviewer_assignment_member_id: DataTypes.INTEGER,
      periode_akademik_id: DataTypes.INTEGER,
      semester_penjaluran_ke_snapshot: DataTypes.INTEGER,
      jalur_snapshot: DataTypes.STRING(40),
      cycle_type_snapshot: DataTypes.STRING(20),
      request_status: DataTypes.STRING(40),
      request_decided_at: DataTypes.DATE,
      scheduled_at: DataTypes.DATE,
      occurred_at: DataTypes.DATE,
      occurrence_source: DataTypes.STRING(40),
      cancelled_at: DataTypes.DATE,
      cancellation_reason_code: DataTypes.STRING(100),
      legacy_context_status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "ambiguous" },
      reviewer_resolution_status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: "resolved" },
      reviewer_resolution_reason_code: DataTypes.STRING(100),
      row_version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      permintaan_pesan: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      permintaan_tanggal: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      permintaan_jam: {
        type: DataTypes.STRING(5),
        allowNull: false,
      },
      status_permohonan: {
        type: DataTypes.ENUM("pending", "approved", "rescheduled", "rejected", "expired", "cancelled_supervisor_change"),
        allowNull: false,
        defaultValue: "pending",
      },
      catatan_dosen: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      lokasi_bimbingan: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      tanggal_keputusan: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      status_resume: {
        type: DataTypes.ENUM("belum_diisi", "submitted", "approved", "revisi", "rejected"),
        allowNull: false,
        defaultValue: "belum_diisi",
      },
      resume_mahasiswa: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      resume_history: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      catatan_review_resume: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      tanggal_review_resume: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      reviewer_dosen_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      reassigned_reviewer_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      reassigned_by_sekretaris_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      is_counted: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      sequelize,
      modelName: "BimbinganSkripsi",
      tableName: "BimbinganSkripsis",
      timestamps: true,
    }
  );

  return BimbinganSkripsi;
};
