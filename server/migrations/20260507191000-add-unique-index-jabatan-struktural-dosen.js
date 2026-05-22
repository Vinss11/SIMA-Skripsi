"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_dosen_jabatan_struktural_single_holder"
      ON "Dosens" ("jabatan_struktural")
      WHERE "jabatan_struktural" IS NOT NULL
        AND BTRIM("jabatan_struktural") <> ''
        AND BTRIM("jabatan_struktural") <> '-';
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS "uq_dosen_jabatan_struktural_single_holder";
    `);
  },
};

