"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE "MataKuliahs"
         SET kode = 'METOPEN',
             "updatedAt" = NOW()
       WHERE kode = 'METPEN'
         AND role_akademik = 'methodology'
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE "MataKuliahs"
         SET kode = 'METPEN',
             "updatedAt" = NOW()
       WHERE kode = 'METOPEN'
         AND role_akademik = 'methodology'
    `);
  },
};
