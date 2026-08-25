"use strict";

const CONSTRAINT_NAME = "chk_pengajuan_tipe_pengajuan_fields";

const TOPIC_OR_MANUAL_CHECK = `
  (tipe_pengajuan = 'topik_dosen'
    AND topik_1_kode IS NOT NULL
    AND topik_1_judul IS NOT NULL
    AND dosen_pilihan_1 IS NOT NULL
    AND dosen_1_nama IS NOT NULL)
  OR
  (tipe_pengajuan = 'judul_mandiri'
    AND judul_mandiri IS NOT NULL
    AND deskripsi_mandiri IS NOT NULL
    AND prospective_supervisor_id IS NOT NULL)
`;

const LEGACY_TOPIC_OR_MANUAL_CHECK = `
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
`;

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    if (queryInterface.sequelize.getDialect() !== "postgres") return;

    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `ALTER TABLE "Pengajuans" DROP CONSTRAINT IF EXISTS "${CONSTRAINT_NAME}";`,
        { transaction }
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE "Pengajuans"
         ADD CONSTRAINT "${CONSTRAINT_NAME}"
         CHECK (${TOPIC_OR_MANUAL_CHECK});`,
        { transaction }
      );
    });
  },

  async down(queryInterface) {
    if (queryInterface.sequelize.getDialect() !== "postgres") return;

    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `ALTER TABLE "Pengajuans" DROP CONSTRAINT IF EXISTS "${CONSTRAINT_NAME}";`,
        { transaction }
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE "Pengajuans"
         ADD CONSTRAINT "${CONSTRAINT_NAME}"
         CHECK (${LEGACY_TOPIC_OR_MANUAL_CHECK}) NOT VALID;`,
        { transaction }
      );
    });
  },
};
