"use strict";

/** @type {import("sequelize-cli").Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const dialect = queryInterface.sequelize.getDialect();

    if (dialect === "postgres") {
      await queryInterface.sequelize.query(
        'ALTER TYPE "enum_Pengajuans_status" ADD VALUE IF NOT EXISTS \'menunggu_approval_sekprodi\';'
      );
      return;
    }

    await queryInterface.changeColumn("Pengajuans", "status", {
      type: Sequelize.ENUM(
        "pending",
        "menunggu_set_ketua_cluster",
        "menunggu_approval_sekprodi",
        "approved",
        "rejected",
        "completed"
      ),
      allowNull: false,
      defaultValue: "pending",
    });
  },

  async down(queryInterface, Sequelize) {
    const dialect = queryInterface.sequelize.getDialect();

    if (dialect === "postgres") {
      await queryInterface.sequelize.transaction(async (transaction) => {
        await queryInterface.sequelize.query(
          'UPDATE "Pengajuans" SET "status" = \'pending\' WHERE "status" = \'menunggu_approval_sekprodi\';',
          { transaction }
        );
        await queryInterface.sequelize.query('ALTER TABLE "Pengajuans" ALTER COLUMN "status" DROP DEFAULT;', {
          transaction,
        });
        await queryInterface.sequelize.query('ALTER TYPE "enum_Pengajuans_status" RENAME TO "enum_Pengajuans_status_old";', {
          transaction,
        });
        await queryInterface.sequelize.query(
          'CREATE TYPE "enum_Pengajuans_status" AS ENUM (\'pending\', \'menunggu_set_ketua_cluster\', \'approved\', \'rejected\', \'completed\');',
          { transaction }
        );
        await queryInterface.sequelize.query(
          'ALTER TABLE "Pengajuans" ALTER COLUMN "status" TYPE "enum_Pengajuans_status" USING "status"::text::"enum_Pengajuans_status";',
          { transaction }
        );
        await queryInterface.sequelize.query('ALTER TABLE "Pengajuans" ALTER COLUMN "status" SET DEFAULT \'pending\';', {
          transaction,
        });
        await queryInterface.sequelize.query('DROP TYPE "enum_Pengajuans_status_old";', { transaction });
      });
      return;
    }

    await queryInterface.sequelize.query(
      "UPDATE `Pengajuans` SET `status` = 'pending' WHERE `status` = 'menunggu_approval_sekprodi';"
    );
    await queryInterface.changeColumn("Pengajuans", "status", {
      type: Sequelize.ENUM("pending", "menunggu_set_ketua_cluster", "approved", "rejected", "completed"),
      allowNull: false,
      defaultValue: "pending",
    });
  },
};
