"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("PendaftaranPenjalurans", "dosen_pembimbing_akademik_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "Dosens",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    await queryInterface.addColumn("PendaftaranPenjalurans", "jenis_jalur_diambil", {
      type: Sequelize.ENUM("penelitian", "pengabdian", "perintisan_bisnis", "magang"),
      allowNull: true,
    });

    await queryInterface.addColumn("PendaftaranPenjalurans", "dosen_pembimbing_ta_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "Dosens",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    await queryInterface.addColumn("PendaftaranPenjalurans", "penjaluran_sebelumnya", {
      type: Sequelize.ENUM("penelitian", "pengabdian", "perintisan_bisnis", "magang"),
      allowNull: true,
    });

    await queryInterface.addColumn("PendaftaranPenjalurans", "penjaluran_baru", {
      type: Sequelize.ENUM("penelitian", "pengabdian", "perintisan_bisnis", "magang"),
      allowNull: true,
    });

    await queryInterface.addColumn("PendaftaranPenjalurans", "dosen_pembimbing_ta_sebelumnya_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "Dosens",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    await queryInterface.addColumn("PendaftaranPenjalurans", "dosen_pembimbing_ta_baru_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "Dosens",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    await queryInterface.addIndex("PendaftaranPenjalurans", ["dosen_pembimbing_akademik_id"], {
      name: "idx_pendaftaran_dpa_id",
    });
    await queryInterface.addIndex("PendaftaranPenjalurans", ["dosen_pembimbing_ta_id"], {
      name: "idx_pendaftaran_dosen_ta_id",
    });
    await queryInterface.addIndex("PendaftaranPenjalurans", ["dosen_pembimbing_ta_sebelumnya_id"], {
      name: "idx_pendaftaran_dosen_ta_sebelumnya_id",
    });
    await queryInterface.addIndex("PendaftaranPenjalurans", ["dosen_pembimbing_ta_baru_id"], {
      name: "idx_pendaftaran_dosen_ta_baru_id",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("PendaftaranPenjalurans", "idx_pendaftaran_dpa_id");
    await queryInterface.removeIndex("PendaftaranPenjalurans", "idx_pendaftaran_dosen_ta_id");
    await queryInterface.removeIndex("PendaftaranPenjalurans", "idx_pendaftaran_dosen_ta_sebelumnya_id");
    await queryInterface.removeIndex("PendaftaranPenjalurans", "idx_pendaftaran_dosen_ta_baru_id");

    await queryInterface.removeColumn("PendaftaranPenjalurans", "dosen_pembimbing_ta_baru_id");
    await queryInterface.removeColumn("PendaftaranPenjalurans", "dosen_pembimbing_ta_sebelumnya_id");
    await queryInterface.removeColumn("PendaftaranPenjalurans", "penjaluran_baru");
    await queryInterface.removeColumn("PendaftaranPenjalurans", "penjaluran_sebelumnya");
    await queryInterface.removeColumn("PendaftaranPenjalurans", "dosen_pembimbing_ta_id");
    await queryInterface.removeColumn("PendaftaranPenjalurans", "jenis_jalur_diambil");
    await queryInterface.removeColumn("PendaftaranPenjalurans", "dosen_pembimbing_akademik_id");

    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_PendaftaranPenjalurans_jenis_jalur_diambil";'
    );
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_PendaftaranPenjalurans_penjaluran_sebelumnya";'
    );
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_PendaftaranPenjalurans_penjaluran_baru";'
    );
  },
};
