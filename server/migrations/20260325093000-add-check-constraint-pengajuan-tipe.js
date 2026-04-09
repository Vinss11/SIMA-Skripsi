"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const dialect = queryInterface.sequelize.getDialect();
    if (dialect !== "postgres") {
      return;
    }

    await queryInterface.sequelize.query(
      `ALTER TABLE "Pengajuans"
       ADD CONSTRAINT "chk_pengajuan_tipe_pengajuan_fields"
       CHECK (
         (tipe_pengajuan = 'topik_dosen'
           AND topik_1_kode IS NOT NULL
           AND topik_1_judul IS NOT NULL
           AND dosen_pilihan_1 IS NOT NULL
           AND dosen_1_nama IS NOT NULL)
         OR
         (tipe_pengajuan = 'judul_mandiri'
           AND judul_mandiri IS NOT NULL
           AND deskripsi_mandiri IS NOT NULL
           AND keyword_mandiri IS NOT NULL
           AND prospective_supervisor_id IS NOT NULL)
       );`
    );
  },

  async down(queryInterface) {
    const dialect = queryInterface.sequelize.getDialect();
    if (dialect !== "postgres") {
      return;
    }

    await queryInterface.sequelize.query(
      'ALTER TABLE "Pengajuans" DROP CONSTRAINT IF EXISTS "chk_pengajuan_tipe_pengajuan_fields";'
    );
  },
};
