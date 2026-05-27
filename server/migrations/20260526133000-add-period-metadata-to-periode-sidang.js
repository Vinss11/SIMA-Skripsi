"use strict";

/** @type {import("sequelize-cli").Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("PeriodeSidangs", "periode", {
      type: Sequelize.ENUM("uts", "uas"),
      allowNull: false,
      defaultValue: "uts",
    });

    await queryInterface.addColumn("PeriodeSidangs", "tahun_akademik", {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: "-",
    });

    await queryInterface.addColumn("PeriodeSidangs", "semester", {
      type: Sequelize.ENUM("ganjil", "genap"),
      allowNull: false,
      defaultValue: "ganjil",
    });

    await queryInterface.addIndex("PeriodeSidangs", ["periode", "tahun_akademik", "semester"], {
      name: "idx_periode_sidang_meta",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("PeriodeSidangs", "idx_periode_sidang_meta");
    await queryInterface.removeColumn("PeriodeSidangs", "semester");
    await queryInterface.removeColumn("PeriodeSidangs", "tahun_akademik");
    await queryInterface.removeColumn("PeriodeSidangs", "periode");

    if (queryInterface.sequelize.getDialect() === "postgres") {
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_PeriodeSidangs_periode";');
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_PeriodeSidangs_semester";');
    }
  },
};
