"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable("PenetapanPembimbings", {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
        mahasiswa_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: "Mahasiswas", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "RESTRICT",
        },
        pendaftaran_penjaluran_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: "PendaftaranPenjalurans", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "SET NULL",
        },
        periode_mulai_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: "PeriodePenjalurans", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "SET NULL",
        },
        semester_penjaluran_ke: { type: Sequelize.INTEGER, allowNull: true },
        tanggal_mulai: { type: Sequelize.DATE, allowNull: true },
        tanggal_selesai: { type: Sequelize.DATE, allowNull: true },
        status: {
          type: Sequelize.ENUM("draft", "active", "ended", "cancelled"),
          allowNull: false,
          defaultValue: "draft",
        },
        alasan_berakhir: { type: Sequelize.TEXT, allowNull: true },
        sumber_data: {
          type: Sequelize.ENUM("penjaluran", "perpanjangan", "pergantian", "legacy_backfill"),
          allowNull: false,
          defaultValue: "penjaluran",
        },
        surat_tugas_id: { type: Sequelize.INTEGER, allowNull: true },
        created_by_sekretaris_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: "SekretarisProdis", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "SET NULL",
        },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
      }, { transaction });

      await queryInterface.createTable("PenetapanPembimbingDosens", {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
        penetapan_pembimbing_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: "PenetapanPembimbings", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },
        dosen_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: "Dosens", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "RESTRICT",
        },
        urutan: { type: Sequelize.INTEGER, allowNull: false },
        peran: {
          type: Sequelize.ENUM("utama", "pendamping"),
          allowNull: false,
        },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
      }, { transaction });

      await queryInterface.sequelize.query(
        `ALTER TABLE "PenetapanPembimbings"
         ADD CONSTRAINT "ck_penetapan_pembimbing_tanggal"
         CHECK ("tanggal_mulai" IS NULL OR "tanggal_selesai" IS NULL OR "tanggal_selesai" >= "tanggal_mulai")`,
        { transaction }
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE "PenetapanPembimbingDosens"
         ADD CONSTRAINT "ck_penetapan_pembimbing_urutan_peran"
         CHECK (("urutan" = 1 AND "peran" = 'utama') OR ("urutan" = 2 AND "peran" = 'pendamping'))`,
        { transaction }
      );
      await queryInterface.addConstraint("PenetapanPembimbingDosens", {
        fields: ["penetapan_pembimbing_id", "urutan"],
        type: "unique",
        name: "uq_penetapan_pembimbing_urutan",
        transaction,
      });
      await queryInterface.addConstraint("PenetapanPembimbingDosens", {
        fields: ["penetapan_pembimbing_id", "dosen_id"],
        type: "unique",
        name: "uq_penetapan_pembimbing_dosen",
        transaction,
      });
      await queryInterface.sequelize.query(
        `CREATE UNIQUE INDEX "uq_active_penetapan_per_mahasiswa"
         ON "PenetapanPembimbings" ("mahasiswa_id")
         WHERE "status" = 'active'`,
        { transaction }
      );
      await queryInterface.addIndex("PenetapanPembimbings", ["mahasiswa_id", "createdAt"], {
        name: "idx_penetapan_pembimbing_history",
        transaction,
      });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.dropTable("PenetapanPembimbingDosens", { transaction });
      await queryInterface.dropTable("PenetapanPembimbings", { transaction });
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_PenetapanPembimbingDosens_peran";',
        { transaction }
      );
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_PenetapanPembimbings_sumber_data";',
        { transaction }
      );
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_PenetapanPembimbings_status";',
        { transaction }
      );
    });
  },
};
