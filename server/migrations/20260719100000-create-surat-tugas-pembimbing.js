"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable("SuratTugasPembimbings", {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
        periode_penjaluran_id: {
          type: Sequelize.INTEGER, allowNull: true,
          references: { model: "PeriodePenjalurans", key: "id" },
          onUpdate: "CASCADE", onDelete: "SET NULL",
        },
        nomor_surat: { type: Sequelize.STRING(150), allowNull: true, unique: true },
        tanggal_surat: { type: Sequelize.DATEONLY, allowNull: true },
        tanggal_berlaku_mulai: { type: Sequelize.DATEONLY, allowNull: true },
        tanggal_berlaku_selesai: { type: Sequelize.DATEONLY, allowNull: true },
        file_path: { type: Sequelize.STRING(500), allowNull: true },
        status: { type: Sequelize.ENUM("draft", "issued", "cancelled"), allowNull: false, defaultValue: "draft" },
        issued_by_sekretaris_id: {
          type: Sequelize.INTEGER, allowNull: true,
          references: { model: "SekretarisProdis", key: "id" },
          onUpdate: "CASCADE", onDelete: "SET NULL",
        },
        catatan: { type: Sequelize.TEXT, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
      }, { transaction });
      await queryInterface.sequelize.query(
        `ALTER TABLE "SuratTugasPembimbings" ADD CONSTRAINT "ck_surat_tugas_masa_berlaku"
         CHECK ("tanggal_berlaku_mulai" IS NULL OR "tanggal_berlaku_selesai" IS NULL OR "tanggal_berlaku_selesai" >= "tanggal_berlaku_mulai")`,
        { transaction }
      );
      await queryInterface.addConstraint("PenetapanPembimbings", {
        fields: ["surat_tugas_id"], type: "foreign key",
        name: "fk_penetapan_pembimbing_surat_tugas",
        references: { table: "SuratTugasPembimbings", field: "id" },
        onUpdate: "CASCADE", onDelete: "SET NULL", transaction,
      });
      await queryInterface.addIndex("SuratTugasPembimbings", ["periode_penjaluran_id", "status"], {
        name: "idx_surat_tugas_pembimbing_periode_status", transaction,
      });
    });
  },
  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeConstraint("PenetapanPembimbings", "fk_penetapan_pembimbing_surat_tugas", { transaction });
      await queryInterface.dropTable("SuratTugasPembimbings", { transaction });
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_SuratTugasPembimbings_status";', { transaction });
    });
  },
};
