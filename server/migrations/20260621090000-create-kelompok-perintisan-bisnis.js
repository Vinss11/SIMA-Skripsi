"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("KelompokPerintisanBisnis", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      periode_penjaluran_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "PeriodePenjalurans",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      ketua_mahasiswa_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "Mahasiswas",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      status: {
        type: Sequelize.ENUM("draft", "submitted", "approved", "rejected"),
        allowNull: false,
        defaultValue: "draft",
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

    await queryInterface.createTable("AnggotaKelompokPerintisans", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      kelompok_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "KelompokPerintisanBisnis",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      mahasiswa_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "Mahasiswas",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      pendaftaran_penjaluran_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "PendaftaranPenjalurans",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      posisi: {
        type: Sequelize.ENUM("ketua", "anggota"),
        allowNull: false,
      },
      peran_tim: {
        type: Sequelize.ENUM("hustler", "hipster", "hacker"),
        allowNull: false,
      },
      jenis_pendaftaran: {
        type: Sequelize.ENUM("baru", "ulang", "alih"),
        allowNull: false,
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

    await queryInterface.addIndex("KelompokPerintisanBisnis", ["periode_penjaluran_id"], {
      name: "idx_kelompok_perintisan_periode",
    });
    await queryInterface.addIndex("AnggotaKelompokPerintisans", ["kelompok_id", "mahasiswa_id"], {
      unique: true,
      name: "uq_kelompok_perintisan_mahasiswa",
    });
    await queryInterface.addIndex("AnggotaKelompokPerintisans", ["kelompok_id", "peran_tim"], {
      unique: true,
      name: "uq_kelompok_perintisan_peran",
    });
    await queryInterface.addIndex("AnggotaKelompokPerintisans", ["pendaftaran_penjaluran_id"], {
      unique: true,
      name: "uq_anggota_perintisan_pendaftaran",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("AnggotaKelompokPerintisans");
    await queryInterface.dropTable("KelompokPerintisanBisnis");
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_AnggotaKelompokPerintisans_jenis_pendaftaran";'
    );
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_AnggotaKelompokPerintisans_peran_tim";'
    );
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_AnggotaKelompokPerintisans_posisi";'
    );
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_KelompokPerintisanBisnis_status";'
    );
  },
};
