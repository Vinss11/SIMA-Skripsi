"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
    const dosenTable = await queryInterface.describeTable("Dosens", { transaction });

    if (!dosenTable.status_keaktifan) {
      await queryInterface.addColumn("Dosens", "status_keaktifan", {
        type: Sequelize.ENUM("active", "inactive", "study_leave", "retired"),
        allowNull: false,
        defaultValue: "active",
      }, { transaction });
    }
    if (!dosenTable.account_is_active) {
      await queryInterface.addColumn("Dosens", "account_is_active", {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      }, { transaction });
    }
    if (!dosenTable.continue_existing_supervision) {
      await queryInterface.addColumn("Dosens", "continue_existing_supervision", {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      }, { transaction });
    }
    if (!dosenTable.status_effective_at) {
      await queryInterface.addColumn("Dosens", "status_effective_at", {
        type: Sequelize.DATEONLY,
        allowNull: true,
      }, { transaction });
    }
    if (!dosenTable.status_reason) {
      await queryInterface.addColumn("Dosens", "status_reason", {
        type: Sequelize.TEXT,
        allowNull: true,
      }, { transaction });
    }
    if (!dosenTable.status_updated_by) {
      await queryInterface.addColumn("Dosens", "status_updated_by", {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "Admins", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      }, { transaction });
    }
    if (!dosenTable.status_updated_at) {
      await queryInterface.addColumn("Dosens", "status_updated_at", {
        type: Sequelize.DATE,
        allowNull: true,
      }, { transaction });
    }

    await queryInterface.createTable("RiwayatStatusDosens", {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      dosen_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "Dosens", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      status_sebelumnya: {
        type: Sequelize.ENUM("active", "inactive", "study_leave", "retired"),
        allowNull: false,
      },
      status_baru: {
        type: Sequelize.ENUM("active", "inactive", "study_leave", "retired"),
        allowNull: false,
      },
      account_is_active_sebelumnya: { type: Sequelize.BOOLEAN, allowNull: false },
      account_is_active_baru: { type: Sequelize.BOOLEAN, allowNull: false },
      continue_existing_supervision: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      effective_at: { type: Sequelize.DATEONLY, allowNull: false },
      reason: { type: Sequelize.TEXT, allowNull: false },
      changed_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "Admins", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      impact_snapshot: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    }, { transaction });

    await queryInterface.createTable("DosenKetersediaanPeriodes", {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      dosen_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "Dosens", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      periode_penjaluran_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "PeriodePenjalurans", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      tersedia_membimbing: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      tersedia_menguji: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      tersedia_ketua_cluster: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      tersedia_pengampu: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      tersedia_pengawas_jalur: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      tersedia_sidang: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      kuota_bimbingan_periode: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 5 },
      alasan_tidak_tersedia: { type: Sequelize.TEXT, allowNull: true },
      updated_by_sekretaris_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "SekretarisProdis", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    }, { transaction });

    await queryInterface.createTable("TindakLanjutStatusDosens", {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      dosen_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "Dosens", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      riwayat_status_dosen_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "RiwayatStatusDosens", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      status: { type: Sequelize.ENUM("open", "resolved"), allowNull: false, defaultValue: "open" },
      impact_snapshot: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      catatan_penyelesaian: { type: Sequelize.TEXT, allowNull: true },
      resolved_by_sekretaris_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "SekretarisProdis", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      resolved_at: { type: Sequelize.DATE, allowNull: true },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    }, { transaction });

    await queryInterface.addIndex("Dosens", ["status_keaktifan"], { name: "idx_dosen_status_keaktifan", transaction });
    await queryInterface.addIndex("RiwayatStatusDosens", ["dosen_id", "effective_at"], { name: "idx_riwayat_status_dosen_effective", transaction });
    await queryInterface.addIndex("DosenKetersediaanPeriodes", ["dosen_id", "periode_penjaluran_id"], {
      name: "uq_dosen_ketersediaan_periode",
      unique: true,
      transaction,
    });
    await queryInterface.addIndex("TindakLanjutStatusDosens", ["status", "dosen_id"], { name: "idx_tindak_lanjut_status_dosen", transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.dropTable("TindakLanjutStatusDosens", { transaction });
    await queryInterface.dropTable("DosenKetersediaanPeriodes", { transaction });
    await queryInterface.dropTable("RiwayatStatusDosens", { transaction });
    for (const column of [
      "status_updated_at", "status_updated_by", "status_reason", "status_effective_at",
      "continue_existing_supervision", "account_is_active", "status_keaktifan",
    ]) {
      await queryInterface.removeColumn("Dosens", column, { transaction });
    }
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_TindakLanjutStatusDosens_status";', { transaction });
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_RiwayatStatusDosens_status_sebelumnya";', { transaction });
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_RiwayatStatusDosens_status_baru";', { transaction });
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Dosens_status_keaktifan";', { transaction });
    });
  },
};
