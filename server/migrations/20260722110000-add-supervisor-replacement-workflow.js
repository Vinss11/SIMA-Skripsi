"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const assignmentTable = await queryInterface.describeTable("PenetapanPembimbings");
      if (!assignmentTable.catatan_pergantian) {
        await queryInterface.addColumn("PenetapanPembimbings", "catatan_pergantian", {
          type: Sequelize.TEXT,
          allowNull: true,
        }, { transaction });
      }

      await queryInterface.sequelize.query(
        'ALTER TYPE "enum_BimbinganSkripsis_status_permohonan" ADD VALUE IF NOT EXISTS \'cancelled_supervisor_change\';',
        { transaction }
      );
      const guidanceTable = await queryInterface.describeTable("BimbinganSkripsis");
      if (!guidanceTable.reviewer_dosen_id) {
        await queryInterface.addColumn("BimbinganSkripsis", "reviewer_dosen_id", {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: "Dosens", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "SET NULL",
        }, { transaction });
      }
      if (!guidanceTable.reassigned_reviewer_at) {
        await queryInterface.addColumn("BimbinganSkripsis", "reassigned_reviewer_at", {
          type: Sequelize.DATE,
          allowNull: true,
        }, { transaction });
      }
      if (!guidanceTable.reassigned_by_sekretaris_id) {
        await queryInterface.addColumn("BimbinganSkripsis", "reassigned_by_sekretaris_id", {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: "SekretarisProdis", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "SET NULL",
        }, { transaction });
      }
      await queryInterface.addIndex("BimbinganSkripsis", ["reviewer_dosen_id", "status_resume"], {
        name: "idx_bimbingan_reviewer_resume",
        transaction,
      }).catch((error) => {
        if (!String(error.message || "").toLowerCase().includes("already exists")) throw error;
      });
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeIndex("BimbinganSkripsis", "idx_bimbingan_reviewer_resume", { transaction }).catch(() => {});
      const guidanceTable = await queryInterface.describeTable("BimbinganSkripsis");
      if (guidanceTable.reassigned_by_sekretaris_id) await queryInterface.removeColumn("BimbinganSkripsis", "reassigned_by_sekretaris_id", { transaction });
      if (guidanceTable.reassigned_reviewer_at) await queryInterface.removeColumn("BimbinganSkripsis", "reassigned_reviewer_at", { transaction });
      if (guidanceTable.reviewer_dosen_id) await queryInterface.removeColumn("BimbinganSkripsis", "reviewer_dosen_id", { transaction });
      await queryInterface.sequelize.query(
        `UPDATE "BimbinganSkripsis" SET "status_permohonan" = 'expired' WHERE "status_permohonan" = 'cancelled_supervisor_change';`,
        { transaction }
      );
      await queryInterface.sequelize.query('ALTER TABLE "BimbinganSkripsis" ALTER COLUMN "status_permohonan" DROP DEFAULT;', { transaction });
      await queryInterface.sequelize.query('CREATE TYPE "enum_BimbinganSkripsis_status_permohonan_old" AS ENUM (\'pending\', \'approved\', \'rescheduled\', \'rejected\', \'expired\');', { transaction });
      await queryInterface.sequelize.query('ALTER TABLE "BimbinganSkripsis" ALTER COLUMN "status_permohonan" TYPE "enum_BimbinganSkripsis_status_permohonan_old" USING ("status_permohonan"::text::"enum_BimbinganSkripsis_status_permohonan_old");', { transaction });
      await queryInterface.sequelize.query('DROP TYPE "enum_BimbinganSkripsis_status_permohonan";', { transaction });
      await queryInterface.sequelize.query('ALTER TYPE "enum_BimbinganSkripsis_status_permohonan_old" RENAME TO "enum_BimbinganSkripsis_status_permohonan";', { transaction });
      await queryInterface.sequelize.query('ALTER TABLE "BimbinganSkripsis" ALTER COLUMN "status_permohonan" SET DEFAULT \'pending\';', { transaction });
      const assignmentTable = await queryInterface.describeTable("PenetapanPembimbings");
      if (assignmentTable.catatan_pergantian) await queryInterface.removeColumn("PenetapanPembimbings", "catatan_pergantian", { transaction });
    });
  },
};
