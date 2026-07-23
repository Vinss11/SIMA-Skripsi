"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [draftRows] = await queryInterface.sequelize.query(
        'SELECT "id" FROM "PeriodePenjalurans" WHERE "status" = \'draft\' LIMIT 1;',
        { transaction }
      );
      if (draftRows.length > 0) {
        throw new Error("Masih ada periode draft. Selesaikan atau tutup draft sebelum menghapus status draft.");
      }

      await queryInterface.sequelize.query(
        'ALTER TABLE "PeriodePenjalurans" ALTER COLUMN "status" DROP DEFAULT;',
        { transaction }
      );
      await queryInterface.sequelize.query(
        'CREATE TYPE "enum_PeriodePenjalurans_status_new" AS ENUM (\'active\', \'closed\');',
        { transaction }
      );
      await queryInterface.sequelize.query(
        'ALTER TABLE "PeriodePenjalurans" ALTER COLUMN "status" TYPE "enum_PeriodePenjalurans_status_new" USING ("status"::text::"enum_PeriodePenjalurans_status_new");',
        { transaction }
      );
      await queryInterface.sequelize.query(
        'DROP TYPE "enum_PeriodePenjalurans_status";',
        { transaction }
      );
      await queryInterface.sequelize.query(
        'ALTER TYPE "enum_PeriodePenjalurans_status_new" RENAME TO "enum_PeriodePenjalurans_status";',
        { transaction }
      );
      await queryInterface.sequelize.query(
        'ALTER TABLE "PeriodePenjalurans" ALTER COLUMN "status" SET DEFAULT \'active\'::"enum_PeriodePenjalurans_status";',
        { transaction }
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        'ALTER TABLE "PeriodePenjalurans" ALTER COLUMN "status" DROP DEFAULT;',
        { transaction }
      );
      await queryInterface.sequelize.query(
        'CREATE TYPE "enum_PeriodePenjalurans_status_old" AS ENUM (\'draft\', \'active\', \'closed\');',
        { transaction }
      );
      await queryInterface.sequelize.query(
        'ALTER TABLE "PeriodePenjalurans" ALTER COLUMN "status" TYPE "enum_PeriodePenjalurans_status_old" USING ("status"::text::"enum_PeriodePenjalurans_status_old");',
        { transaction }
      );
      await queryInterface.sequelize.query(
        'DROP TYPE "enum_PeriodePenjalurans_status";',
        { transaction }
      );
      await queryInterface.sequelize.query(
        'ALTER TYPE "enum_PeriodePenjalurans_status_old" RENAME TO "enum_PeriodePenjalurans_status";',
        { transaction }
      );
      await queryInterface.sequelize.query(
        'ALTER TABLE "PeriodePenjalurans" ALTER COLUMN "status" SET DEFAULT \'active\'::"enum_PeriodePenjalurans_status";',
        { transaction }
      );
    });
  },
};
