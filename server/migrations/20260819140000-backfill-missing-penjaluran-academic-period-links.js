"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(`
        INSERT INTO "PeriodeAkademiks"
          (kode, tahun_akademik, semester, status, "createdAt", "updatedAt")
        SELECT DISTINCT
          UPPER(REGEXP_REPLACE(TRIM(p.tahun_akademik), '[^0-9A-Za-z]+', '-', 'g')) || '-' || UPPER(p.semester::text),
          TRIM(p.tahun_akademik),
          p.semester::text::"enum_PeriodeAkademiks_semester",
          'draft'::"enum_PeriodeAkademiks_status",
          NOW(),
          NOW()
        FROM "PeriodePenjalurans" p
        WHERE p.periode_akademik_id IS NULL
          AND NULLIF(TRIM(p.tahun_akademik), '') IS NOT NULL
        ON CONFLICT (tahun_akademik, semester) DO NOTHING
      `, { transaction });

      await queryInterface.sequelize.query(`
        UPDATE "PeriodePenjalurans" penjaluran
           SET periode_akademik_id = akademik.id,
               "updatedAt" = NOW()
          FROM "PeriodeAkademiks" akademik
         WHERE penjaluran.periode_akademik_id IS NULL
           AND TRIM(penjaluran.tahun_akademik) = akademik.tahun_akademik
           AND penjaluran.semester::text = akademik.semester::text
      `, { transaction });
    });
  },

  async down() {
    // Relasi yang telah ditemukan benar dan tidak dikosongkan kembali.
  },
};
