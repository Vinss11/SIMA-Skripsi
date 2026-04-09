"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const dialect = queryInterface.sequelize.getDialect();

    if (dialect === "postgres") {
      await queryInterface.sequelize.query('ALTER TYPE "enum_Topiks_status" ADD VALUE IF NOT EXISTS \'reserved\';');
      return;
    }

    await queryInterface.changeColumn("Topiks", "status", {
      type: Sequelize.ENUM("available", "reserved", "taken", "unavailable"),
      allowNull: false,
      defaultValue: "available",
    });
  },

  async down(queryInterface, Sequelize) {
    const dialect = queryInterface.sequelize.getDialect();

    if (dialect === "postgres") {
      await queryInterface.sequelize.transaction(async (transaction) => {
        await queryInterface.sequelize.query('UPDATE "Topiks" SET "status" = \'available\' WHERE "status" = \'reserved\';', {
          transaction,
        });
        await queryInterface.sequelize.query('ALTER TABLE "Topiks" ALTER COLUMN "status" DROP DEFAULT;', { transaction });
        await queryInterface.sequelize.query('ALTER TYPE "enum_Topiks_status" RENAME TO "enum_Topiks_status_old";', {
          transaction,
        });
        await queryInterface.sequelize.query('CREATE TYPE "enum_Topiks_status" AS ENUM (\'available\', \'taken\', \'unavailable\');', {
          transaction,
        });
        await queryInterface.sequelize.query(
          'ALTER TABLE "Topiks" ALTER COLUMN "status" TYPE "enum_Topiks_status" USING "status"::text::"enum_Topiks_status";',
          { transaction }
        );
        await queryInterface.sequelize.query('ALTER TABLE "Topiks" ALTER COLUMN "status" SET DEFAULT \'available\';', {
          transaction,
        });
        await queryInterface.sequelize.query('DROP TYPE "enum_Topiks_status_old";', { transaction });
      });
      return;
    }

    await queryInterface.sequelize.query('UPDATE `Topiks` SET `status` = \'available\' WHERE `status` = \'reserved\';');
    await queryInterface.changeColumn("Topiks", "status", {
      type: Sequelize.ENUM("available", "taken", "unavailable"),
      allowNull: false,
      defaultValue: "available",
    });
  },
};
