"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      const table = await queryInterface.describeTable("PenetapanPembimbingDosens");
      if (!table.status) {
        await queryInterface.addColumn("PenetapanPembimbingDosens", "status", {
          type: Sequelize.ENUM("draft", "active", "ended", "cancelled"),
          allowNull: false,
          defaultValue: "draft",
        }, { transaction });
      }
      if (!table.tanggal_mulai) {
        await queryInterface.addColumn("PenetapanPembimbingDosens", "tanggal_mulai", {
          type: Sequelize.DATE,
          allowNull: true,
        }, { transaction });
      }
      if (!table.tanggal_selesai) {
        await queryInterface.addColumn("PenetapanPembimbingDosens", "tanggal_selesai", {
          type: Sequelize.DATE,
          allowNull: true,
        }, { transaction });
      }

      await queryInterface.sequelize.query(`
        UPDATE "PenetapanPembimbingDosens" AS member
        SET
          "status" = assignment."status"::text::"enum_PenetapanPembimbingDosens_status",
          "tanggal_mulai" = assignment."tanggal_mulai",
          "tanggal_selesai" = assignment."tanggal_selesai",
          "updatedAt" = NOW()
        FROM "PenetapanPembimbings" AS assignment
        WHERE member."penetapan_pembimbing_id" = assignment."id"
      `, { transaction });

      await queryInterface.sequelize.query(`
        ALTER TABLE "PenetapanPembimbingDosens"
        DROP CONSTRAINT IF EXISTS "ck_penetapan_pembimbing_dosen_tanggal"
      `, { transaction });
      await queryInterface.sequelize.query(`
        ALTER TABLE "PenetapanPembimbingDosens"
        ADD CONSTRAINT "ck_penetapan_pembimbing_dosen_tanggal"
        CHECK (
          "tanggal_mulai" IS NULL
          OR "tanggal_selesai" IS NULL
          OR "tanggal_selesai" >= "tanggal_mulai"
        )
      `, { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(`
        ALTER TABLE "PenetapanPembimbingDosens"
        DROP CONSTRAINT IF EXISTS "ck_penetapan_pembimbing_dosen_tanggal"
      `, { transaction });
      const table = await queryInterface.describeTable("PenetapanPembimbingDosens");
      if (table.tanggal_selesai) await queryInterface.removeColumn("PenetapanPembimbingDosens", "tanggal_selesai", { transaction });
      if (table.tanggal_mulai) await queryInterface.removeColumn("PenetapanPembimbingDosens", "tanggal_mulai", { transaction });
      if (table.status) await queryInterface.removeColumn("PenetapanPembimbingDosens", "status", { transaction });
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_PenetapanPembimbingDosens_status";',
        { transaction }
      );
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
