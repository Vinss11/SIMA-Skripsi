"use strict";

/** @type {import("sequelize-cli").Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("PeriodeSidangs", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      label_periode: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },
      tanggal_mulai_pendaftaran: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      tanggal_selesai_pendaftaran: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM("draft", "open", "closed"),
        allowNull: false,
        defaultValue: "draft",
      },
      catatan: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      created_by_sekretaris_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "SekretarisProdis",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      activated_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      closed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });
    await queryInterface.addIndex("PeriodeSidangs", ["status"], {
      name: "idx_periode_sidang_status",
    });
    await queryInterface.addIndex("PeriodeSidangs", ["label_periode"], {
      name: "uniq_periode_sidang_label",
      unique: true,
    });
    await queryInterface.addIndex("PeriodeSidangs", ["tanggal_mulai_pendaftaran", "tanggal_selesai_pendaftaran"], {
      name: "idx_periode_sidang_window",
    });

    await queryInterface.createTable("PeriodeSidangHaris", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      periode_sidang_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "PeriodeSidangs",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      tanggal_sidang: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });
    await queryInterface.addIndex("PeriodeSidangHaris", ["periode_sidang_id", "tanggal_sidang"], {
      name: "uniq_periode_sidang_hari",
      unique: true,
    });

    await queryInterface.createTable("PeriodeSidangRuangans", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      periode_sidang_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "PeriodeSidangs",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      nama_ruangan: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });
    await queryInterface.addIndex("PeriodeSidangRuangans", ["periode_sidang_id", "nama_ruangan"], {
      name: "uniq_periode_sidang_ruangan",
      unique: true,
    });

    await queryInterface.createTable("PendaftaranSidangs", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      periode_sidang_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "PeriodeSidangs",
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
        onDelete: "CASCADE",
      },
      dosen_pembimbing_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "Dosens",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      status: {
        type: Sequelize.ENUM("submitted", "scheduled", "cancelled"),
        allowNull: false,
        defaultValue: "submitted",
      },
      registered_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      assigned_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      catatan: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });
    await queryInterface.addIndex("PendaftaranSidangs", ["mahasiswa_id", "periode_sidang_id"], {
      name: "uniq_pendaftaran_sidang_mahasiswa_periode",
      unique: true,
    });
    await queryInterface.addIndex("PendaftaranSidangs", ["periode_sidang_id", "status"], {
      name: "idx_pendaftaran_sidang_periode_status",
    });

    await queryInterface.createTable("KetersediaanPengujiSidangs", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      periode_sidang_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "PeriodeSidangs",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      dosen_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "Dosens",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      tanggal_sidang: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      sesi_ke: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      tipe_penilaian: {
        type: Sequelize.ENUM("ketat", "santai"),
        allowNull: false,
        defaultValue: "santai",
      },
      kondisi_fisik: {
        type: Sequelize.ENUM("fit", "tidak_fit"),
        allowNull: false,
        defaultValue: "fit",
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });
    await queryInterface.addIndex(
      "KetersediaanPengujiSidangs",
      ["periode_sidang_id", "dosen_id", "tanggal_sidang", "sesi_ke"],
      {
        name: "uniq_ketersediaan_penguji_slot",
        unique: true,
      }
    );
    await queryInterface.addIndex("KetersediaanPengujiSidangs", ["periode_sidang_id", "tanggal_sidang", "sesi_ke"], {
      name: "idx_ketersediaan_sidang_slot",
    });

    await queryInterface.createTable("JadwalSidangPengujis", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      periode_sidang_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "PeriodeSidangs",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      pendaftaran_sidang_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
        references: {
          model: "PendaftaranSidangs",
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
        onDelete: "CASCADE",
      },
      dosen_pembimbing_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "Dosens",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      tanggal_sidang: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      sesi_ke: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      sesi_mulai: {
        type: Sequelize.STRING(5),
        allowNull: false,
      },
      sesi_selesai: {
        type: Sequelize.STRING(5),
        allowNull: false,
      },
      ruangan: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },
      penguji1_dosen_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "Dosens",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      penguji2_dosen_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "Dosens",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      assignment_status: {
        type: Sequelize.ENUM("assigned", "finalized", "cancelled"),
        allowNull: false,
        defaultValue: "assigned",
      },
      generated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });
    await queryInterface.addIndex("JadwalSidangPengujis", ["periode_sidang_id", "tanggal_sidang", "sesi_ke", "ruangan"], {
      name: "idx_jadwal_sidang_slot_ruangan",
    });
    await queryInterface.addIndex("JadwalSidangPengujis", ["periode_sidang_id", "penguji1_dosen_id"], {
      name: "idx_jadwal_sidang_penguji1",
    });
    await queryInterface.addIndex("JadwalSidangPengujis", ["periode_sidang_id", "penguji2_dosen_id"], {
      name: "idx_jadwal_sidang_penguji2",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("JadwalSidangPengujis", "idx_jadwal_sidang_penguji2");
    await queryInterface.removeIndex("JadwalSidangPengujis", "idx_jadwal_sidang_penguji1");
    await queryInterface.removeIndex("JadwalSidangPengujis", "idx_jadwal_sidang_slot_ruangan");
    await queryInterface.dropTable("JadwalSidangPengujis");

    await queryInterface.removeIndex("KetersediaanPengujiSidangs", "idx_ketersediaan_sidang_slot");
    await queryInterface.removeIndex("KetersediaanPengujiSidangs", "uniq_ketersediaan_penguji_slot");
    await queryInterface.dropTable("KetersediaanPengujiSidangs");

    await queryInterface.removeIndex("PendaftaranSidangs", "idx_pendaftaran_sidang_periode_status");
    await queryInterface.removeIndex("PendaftaranSidangs", "uniq_pendaftaran_sidang_mahasiswa_periode");
    await queryInterface.dropTable("PendaftaranSidangs");

    await queryInterface.removeIndex("PeriodeSidangRuangans", "uniq_periode_sidang_ruangan");
    await queryInterface.dropTable("PeriodeSidangRuangans");

    await queryInterface.removeIndex("PeriodeSidangHaris", "uniq_periode_sidang_hari");
    await queryInterface.dropTable("PeriodeSidangHaris");

    await queryInterface.removeIndex("PeriodeSidangs", "idx_periode_sidang_window");
    await queryInterface.removeIndex("PeriodeSidangs", "uniq_periode_sidang_label");
    await queryInterface.removeIndex("PeriodeSidangs", "idx_periode_sidang_status");
    await queryInterface.dropTable("PeriodeSidangs");

    if (queryInterface.sequelize.getDialect() === "postgres") {
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_JadwalSidangPengujis_assignment_status";');
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_KetersediaanPengujiSidangs_kondisi_fisik";');
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_KetersediaanPengujiSidangs_tipe_penilaian";');
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_PendaftaranSidangs_status";');
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_PeriodeSidangs_status";');
    }
  },
};
