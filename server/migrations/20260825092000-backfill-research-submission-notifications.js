"use strict";

const NOTIFICATION_TYPE = "research_submission_review_lecturer";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    if (queryInterface.sequelize.getDialect() !== "postgres") return;

    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `INSERT INTO "Notifikasis" (
           "recipient_type", "recipient_id", "type", "title", "message",
           "reference_type", "reference_id", "action_key", "metadata",
           "read_at", "deduplication_key", "createdAt", "updatedAt"
         )
         SELECT
           'dosen',
           submission."prospective_supervisor_id",
           '${NOTIFICATION_TYPE}',
           'Pengajuan Judul Penelitian Baru',
           'Pengajuan judul penelitian mandiri dari ' || student."nama" || ' (' || student."nim" || ') menunggu review Anda.',
           'pengajuan',
           submission."id",
           'lecturer_submission_review',
           jsonb_build_object(
             'mahasiswa_id', student."id",
             'mahasiswa_nama', student."nama",
             'mahasiswa_nim', student."nim",
             'judul_penelitian', submission."judul_mandiri",
             'jenis_jalur', submission."jenis_jalur",
             'source', 'migration_backfill'
           ),
           NULL,
           'research-submission:' || submission."id" || ':reviewer:' || submission."prospective_supervisor_id",
           NOW(),
           NOW()
         FROM "Pengajuans" AS submission
         INNER JOIN "Mahasiswas" AS student ON student."id" = submission."mahasiswa_id"
         WHERE submission."tipe_pengajuan" = 'judul_mandiri'
           AND submission."status" = 'pending'
           AND submission."is_approved_by_supervisor" = FALSE
           AND submission."prospective_supervisor_id" IS NOT NULL
         ON CONFLICT ("deduplication_key") DO NOTHING;`,
        { transaction }
      );
    });
  },

  async down(queryInterface) {
    if (queryInterface.sequelize.getDialect() !== "postgres") return;

    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `DELETE FROM "Notifikasis"
         WHERE "type" = '${NOTIFICATION_TYPE}'
           AND "metadata"->>'source' = 'migration_backfill';`,
        { transaction }
      );
    });
  },
};
