"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      const dosenColumns = await queryInterface.describeTable("Dosens", { transaction });
      if (dosenColumns.nip && !dosenColumns.nik) {
        await queryInterface.renameColumn("Dosens", "nip", "nik", { transaction });
      }

      await queryInterface.sequelize.query(
        `
          UPDATE "Dosens"
          SET "nik" = LPAD(CAST("id" AS TEXT), 9, '0');
        `,
        { transaction }
      );

      await queryInterface.changeColumn(
        "Dosens",
        "nik",
        {
          type: Sequelize.STRING(9),
          allowNull: true,
        },
        { transaction }
      );

      const sekretarisColumns = await queryInterface.describeTable("SekretarisProdis", { transaction });
      if (sekretarisColumns.nip && !sekretarisColumns.nik) {
        await queryInterface.renameColumn("SekretarisProdis", "nip", "nik", { transaction });
      }

      await queryInterface.sequelize.query(
        `
          UPDATE "SekretarisProdis"
          SET "nik" = CASE
            WHEN "nik" IS NULL OR BTRIM("nik") = '' THEN LPAD(CAST("id" AS TEXT), 9, '0')
            ELSE LEFT(BTRIM("nik"), 9)
          END;
        `,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `
          WITH ranked AS (
            SELECT
              "id",
              "nik",
              ROW_NUMBER() OVER (PARTITION BY "nik" ORDER BY "id") AS rn
            FROM "SekretarisProdis"
          )
          UPDATE "SekretarisProdis" s
          SET "nik" = LPAD(CAST(s."id" AS TEXT), 9, '0')
          FROM ranked
          WHERE s."id" = ranked."id"
            AND ranked.rn > 1;
        `,
        { transaction }
      );

      await queryInterface.changeColumn(
        "SekretarisProdis",
        "nik",
        {
          type: Sequelize.STRING(9),
          allowNull: false,
        },
        { transaction }
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      const dosenColumns = await queryInterface.describeTable("Dosens", { transaction });
      if (dosenColumns.nik && !dosenColumns.nip) {
        await queryInterface.renameColumn("Dosens", "nik", "nip", { transaction });
      }

      await queryInterface.changeColumn(
        "Dosens",
        "nip",
        {
          type: Sequelize.STRING(20),
          allowNull: true,
        },
        { transaction }
      );

      const sekretarisColumns = await queryInterface.describeTable("SekretarisProdis", { transaction });
      if (sekretarisColumns.nik && !sekretarisColumns.nip) {
        await queryInterface.renameColumn("SekretarisProdis", "nik", "nip", { transaction });
      }

      await queryInterface.changeColumn(
        "SekretarisProdis",
        "nip",
        {
          type: Sequelize.STRING(20),
          allowNull: false,
        },
        { transaction }
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
