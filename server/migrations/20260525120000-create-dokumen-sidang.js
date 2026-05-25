"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("DokumenSidangs", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      mahasiswa_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "Mahasiswas",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      transkrip_file_path: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      transkrip_file_name: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      transkrip_status: {
        type: Sequelize.ENUM("belum_upload", "submitted", "revisi", "approved"),
        allowNull: false,
        defaultValue: "belum_upload",
      },
      transkrip_uploaded_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      transkrip_review_note: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      transkrip_reviewed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      cept_file_path: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      cept_file_name: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      cept_status: {
        type: Sequelize.ENUM("belum_upload", "submitted", "revisi", "approved"),
        allowNull: false,
        defaultValue: "belum_upload",
      },
      cept_uploaded_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      cept_review_note: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      cept_reviewed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      draft_skripsi_file_path: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      draft_skripsi_file_name: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      draft_skripsi_status: {
        type: Sequelize.ENUM("belum_upload", "submitted", "revisi", "approved"),
        allowNull: false,
        defaultValue: "belum_upload",
      },
      draft_skripsi_uploaded_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      draft_skripsi_review_note: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      draft_skripsi_reviewed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    await queryInterface.addIndex("DokumenSidangs", ["mahasiswa_id"], {
      name: "idx_dokumen_sidang_mahasiswa_id",
      unique: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("DokumenSidangs", "idx_dokumen_sidang_mahasiswa_id");
    await queryInterface.dropTable("DokumenSidangs");

    const dialect = queryInterface.sequelize.getDialect();
    if (dialect === "postgres") {
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_DokumenSidangs_transkrip_status";');
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_DokumenSidangs_cept_status";');
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_DokumenSidangs_draft_skripsi_status";');
    }
  },
};

