"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uniq_mitra_magang_lower_nama"
      ON "MitraMagangs" (LOWER("nama"));
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS "uniq_mitra_magang_lower_nama";
    `);
  },
};

