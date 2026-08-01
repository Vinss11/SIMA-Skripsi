"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const tables = await queryInterface.showAllTables({ transaction });
      const tableNames = new Set(tables.map((item) => typeof item === "string" ? item : item.tableName));
      if (!tableNames.has("PeriodeAkademiks")) {
        await queryInterface.createTable("PeriodeAkademiks", {
          id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
          kode: { type: Sequelize.STRING(40), allowNull: false, unique: true },
          external_id: { type: Sequelize.STRING(120), allowNull: true },
          tahun_akademik: { type: Sequelize.STRING(20), allowNull: false },
          semester: { type: Sequelize.ENUM("ganjil", "genap"), allowNull: false },
          tanggal_mulai: { type: Sequelize.DATE, allowNull: true },
          tanggal_selesai: { type: Sequelize.DATE, allowNull: true },
          status: { type: Sequelize.ENUM("draft", "active", "closed"), allowNull: false, defaultValue: "draft" },
          sumber: { type: Sequelize.STRING(80), allowNull: false, defaultValue: "manual" },
          metadata: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
          createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
          updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
        }, { transaction });
      }
      const registrationColumns = await queryInterface.describeTable("PeriodePenjalurans");
      if (!registrationColumns.periode_akademik_id) {
        await queryInterface.addColumn("PeriodePenjalurans", "periode_akademik_id", {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: "PeriodeAkademiks", key: "id" },
          onDelete: "RESTRICT",
          onUpdate: "CASCADE",
        }, { transaction });
      }
      const existingIndexes = new Set((await queryInterface.showIndex("PeriodeAkademiks", { transaction })).map((item) => item.name));
      if (!existingIndexes.has("uq_periode_akademik_tahun_semester")) {
        await queryInterface.addIndex("PeriodeAkademiks", ["tahun_akademik", "semester"], {
          name: "uq_periode_akademik_tahun_semester", unique: true, transaction,
        });
      }
      const registrationIndexes = new Set((await queryInterface.showIndex("PeriodePenjalurans", { transaction })).map((item) => item.name));
      if (!registrationIndexes.has("idx_periode_penjaluran_akademik")) {
        await queryInterface.addIndex("PeriodePenjalurans", ["periode_akademik_id"], {
          name: "idx_periode_penjaluran_akademik", transaction,
        });
      }

      // Backfill hanya identitas semester. Tanggal jendela penjaluran tidak disalin sebagai tanggal akademik.
      await queryInterface.sequelize.query(`
        INSERT INTO "PeriodeAkademiks"
          (kode, tahun_akademik, semester, status, sumber, metadata, "createdAt", "updatedAt")
        SELECT DISTINCT
          UPPER(REGEXP_REPLACE(TRIM(p.tahun_akademik), '[^0-9A-Za-z]+', '-', 'g')) || '-' || UPPER(p.semester::text),
          TRIM(p.tahun_akademik), p.semester::text::"enum_PeriodeAkademiks_semester",
          'draft'::"enum_PeriodeAkademiks_status", 'backfill_periode_penjaluran',
          '{"dates_require_review":true}'::jsonb, NOW(), NOW()
        FROM "PeriodePenjalurans" p
        WHERE NULLIF(TRIM(p.tahun_akademik), '') IS NOT NULL
        ON CONFLICT (tahun_akademik, semester) DO NOTHING
      `, { transaction });
      await queryInterface.sequelize.query(`
        UPDATE "PeriodePenjalurans" p
           SET periode_akademik_id = akademik.id
          FROM "PeriodeAkademiks" akademik
         WHERE p.periode_akademik_id IS NULL
           AND TRIM(p.tahun_akademik) = akademik.tahun_akademik
           AND p.semester::text = akademik.semester::text
      `, { transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const registrationColumns = await queryInterface.describeTable("PeriodePenjalurans");
      if (registrationColumns.periode_akademik_id) {
        await queryInterface.removeColumn("PeriodePenjalurans", "periode_akademik_id", { transaction });
      }
      await queryInterface.dropTable("PeriodeAkademiks", { transaction });
    });
  },
};
