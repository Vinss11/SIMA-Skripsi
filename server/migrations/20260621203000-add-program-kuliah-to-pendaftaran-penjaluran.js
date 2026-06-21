"use strict";

/** @type {import("sequelize-cli").Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("PendaftaranPenjalurans", "program_kuliah", {
      type: Sequelize.ENUM("reguler", "internasional"),
      allowNull: false,
      defaultValue: "reguler",
      after: "jalur",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("PendaftaranPenjalurans", "program_kuliah");
    const dialect = queryInterface.sequelize.getDialect();
    if (dialect === "postgres") {
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_PendaftaranPenjalurans_program_kuliah";'
      );
    }
  },
};
