"use strict";

const REJECTED_NOTIFICATION_TYPE = "research_submission_rejected_student";

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
           'mahasiswa',
           student."id",
           '${REJECTED_NOTIFICATION_TYPE}',
           'Pengajuan Judul Penelitian Ditolak',
           'Pengajuan judul penelitian Anda ditolak. Alasan: ' || COALESCE(submission."alasan_penolakan", '-') || '. Anda dapat memperbaiki dan mengajukan kembali.',
           'pengajuan',
           submission."id",
           'student_submission_status',
           jsonb_build_object(
             'judul_penelitian', submission."judul_mandiri",
             'alasan_penolakan', submission."alasan_penolakan",
             'can_resubmit', TRUE,
             'source', 'migration_backfill'
           ),
           NULL,
           'research-submission-rejected:' || submission."id" || ':student:' || student."id",
           NOW(),
           NOW()
         FROM "Pengajuans" AS submission
         INNER JOIN "Mahasiswas" AS student
           ON student."id" = submission."mahasiswa_id"
          AND student."pengajuan_aktif_id" = submission."id"
         WHERE submission."tipe_pengajuan" = 'judul_mandiri'
           AND submission."status" = 'rejected'
         ON CONFLICT ("deduplication_key") DO NOTHING;`,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `UPDATE "PendaftaranPenjalurans" AS registration
         SET "form_lanjutan_status" = 'draft',
             "form_lanjutan_submitted_at" = NULL,
             "updatedAt" = NOW()
         FROM "Pengajuans" AS submission
         INNER JOIN "Mahasiswas" AS student
           ON student."id" = submission."mahasiswa_id"
          AND student."pengajuan_aktif_id" = submission."id"
         WHERE registration."id" = submission."pendaftaran_penjaluran_id"
           AND submission."tipe_pengajuan" = 'judul_mandiri'
           AND submission."status" = 'rejected';`,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `UPDATE "PamitUlangs" AS change_request
         SET "pengajuan_baru_id" = NULL,
             "updatedAt" = NOW()
         FROM "Pengajuans" AS submission
         INNER JOIN "Mahasiswas" AS student
           ON student."id" = submission."mahasiswa_id"
          AND student."pengajuan_aktif_id" = submission."id"
         WHERE change_request."id" = submission."pamit_ulang_id"
           AND change_request."pengajuan_baru_id" = submission."id"
           AND submission."tipe_pengajuan" = 'judul_mandiri'
           AND submission."status" = 'rejected';`,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `UPDATE "Mahasiswas" AS student
         SET "pengajuan_aktif_id" = NULL,
             "status_jalur_saat_ini" = 'belum_mengajukan',
             "updatedAt" = NOW()
         FROM "Pengajuans" AS submission
         WHERE student."id" = submission."mahasiswa_id"
           AND student."pengajuan_aktif_id" = submission."id"
           AND submission."tipe_pengajuan" = 'judul_mandiri'
           AND submission."status" = 'rejected';`,
        { transaction }
      );
    });
  },

  async down(queryInterface) {
    if (queryInterface.sequelize.getDialect() !== "postgres") return;

    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `DELETE FROM "Notifikasis"
         WHERE "type" = '${REJECTED_NOTIFICATION_TYPE}'
           AND "metadata"->>'source' = 'migration_backfill';`,
        { transaction }
      );
    });
  },
};
