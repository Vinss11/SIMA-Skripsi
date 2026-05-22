"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDefinition = await queryInterface.describeTable("PeriodePenjalurans");
    if (!tableDefinition.status) {
      await queryInterface.addColumn("PeriodePenjalurans", "status", {
        type: Sequelize.ENUM("draft", "active", "closed"),
        allowNull: false,
        defaultValue: "active",
      });
    }

    await queryInterface.sequelize.query(`
      UPDATE "PeriodePenjalurans"
      SET "status" = CASE
        WHEN "is_active" = true THEN 'active'::"enum_PeriodePenjalurans_status"
        ELSE 'closed'::"enum_PeriodePenjalurans_status"
      END
    `);

    await queryInterface.addIndex("PeriodePenjalurans", ["status"], {
      name: "idx_periode_penjaluran_status",
    });
  },

  async down(queryInterface) {
    const tableDefinition = await queryInterface.describeTable("PeriodePenjalurans");
    if (tableDefinition.status) {
      await queryInterface.removeIndex("PeriodePenjalurans", "idx_periode_penjaluran_status");
      await queryInterface.removeColumn("PeriodePenjalurans", "status");
    }
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_PeriodePenjalurans_status";');
  },
};
