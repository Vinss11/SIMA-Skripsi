"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE "PeriodePenjalurans" penjaluran
         SET periode_akademik_id = akademik.id,
             "updatedAt" = NOW()
        FROM "PeriodeAkademiks" akademik
       WHERE penjaluran.periode_akademik_id IS NULL
         AND penjaluran.tahun_akademik = akademik.tahun_akademik
         AND penjaluran.semester::text = akademik.semester::text
    `);
  },

  async down() {
    // Relasi yang sudah ditemukan benar tidak dikosongkan kembali.
  },
};
