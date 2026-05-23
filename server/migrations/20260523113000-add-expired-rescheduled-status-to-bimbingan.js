"use strict";

/** @type {import("sequelize-cli").Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const dialect = queryInterface.sequelize.getDialect();

    if (dialect === "postgres") {
      await queryInterface.sequelize.query(
        'ALTER TYPE "enum_BimbinganSkripsis_status_permohonan" ADD VALUE IF NOT EXISTS \'rescheduled\';'
      );
      await queryInterface.sequelize.query(
        'ALTER TYPE "enum_BimbinganSkripsis_status_permohonan" ADD VALUE IF NOT EXISTS \'expired\';'
      );
      return;
    }

    await queryInterface.changeColumn("BimbinganSkripsis", "status_permohonan", {
      type: Sequelize.ENUM("pending", "approved", "rescheduled", "rejected", "expired"),
      allowNull: false,
      defaultValue: "pending",
    });
  },

  async down(queryInterface, Sequelize) {
    const dialect = queryInterface.sequelize.getDialect();

    if (dialect === "postgres") {
      await queryInterface.sequelize.transaction(async (transaction) => {
        await queryInterface.sequelize.query(
          'UPDATE "BimbinganSkripsis" SET "status_permohonan" = \'approved\' WHERE "status_permohonan" = \'rescheduled\';',
          { transaction }
        );
        await queryInterface.sequelize.query(
          'UPDATE "BimbinganSkripsis" SET "status_permohonan" = \'rejected\' WHERE "status_permohonan" = \'expired\';',
          { transaction }
        );
        await queryInterface.sequelize.query(
          'ALTER TABLE "BimbinganSkripsis" ALTER COLUMN "status_permohonan" DROP DEFAULT;',
          { transaction }
        );
        await queryInterface.sequelize.query(
          'ALTER TYPE "enum_BimbinganSkripsis_status_permohonan" RENAME TO "enum_BimbinganSkripsis_status_permohonan_old";',
          { transaction }
        );
        await queryInterface.sequelize.query(
          'CREATE TYPE "enum_BimbinganSkripsis_status_permohonan" AS ENUM (\'pending\', \'approved\', \'rejected\');',
          { transaction }
        );
        await queryInterface.sequelize.query(
          'ALTER TABLE "BimbinganSkripsis" ALTER COLUMN "status_permohonan" TYPE "enum_BimbinganSkripsis_status_permohonan" USING "status_permohonan"::text::"enum_BimbinganSkripsis_status_permohonan";',
          { transaction }
        );
        await queryInterface.sequelize.query(
          'ALTER TABLE "BimbinganSkripsis" ALTER COLUMN "status_permohonan" SET DEFAULT \'pending\';',
          { transaction }
        );
        await queryInterface.sequelize.query('DROP TYPE "enum_BimbinganSkripsis_status_permohonan_old";', { transaction });
      });
      return;
    }

    await queryInterface.sequelize.query(
      "UPDATE `BimbinganSkripsis` SET `status_permohonan` = 'approved' WHERE `status_permohonan` = 'rescheduled';"
    );
    await queryInterface.sequelize.query(
      "UPDATE `BimbinganSkripsis` SET `status_permohonan` = 'rejected' WHERE `status_permohonan` = 'expired';"
    );
    await queryInterface.changeColumn("BimbinganSkripsis", "status_permohonan", {
      type: Sequelize.ENUM("pending", "approved", "rejected"),
      allowNull: false,
      defaultValue: "pending",
    });
  },
};

