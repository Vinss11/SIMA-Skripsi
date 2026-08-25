"use strict";

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
           'mahasiswa', student."id", 'research_submission_rejected_student',
           'Pengajuan Penelitian Ditolak',
           'Pengajuan penelitian Anda ditolak. Alasan: ' || COALESCE(submission."alasan_penolakan", '-') || '. Anda dapat memperbaiki dan mengajukan kembali.',
           'pengajuan', submission."id", 'student_submission_status',
           jsonb_build_object(
             'tipe_pengajuan', submission."tipe_pengajuan",
             'alasan_penolakan', submission."alasan_penolakan",
             'can_resubmit', TRUE,
             'source', 'migration_research_rejection_recovery'
           ),
           NULL,
           'research-submission-rejected:' || submission."id" || ':student:' || student."id",
           NOW(), NOW()
         FROM "Pengajuans" AS submission
         INNER JOIN "Mahasiswas" AS student ON student."id" = submission."mahasiswa_id"
         LEFT JOIN "PamitUlangs" AS change_request
           ON change_request."id" = submission."pamit_ulang_id"
          AND change_request."pengajuan_baru_id" = submission."id"
         WHERE submission."status" = 'rejected'
           AND submission."tipe_pengajuan" IN ('judul_mandiri', 'topik_dosen')
           AND (
             student."pengajuan_aktif_id" = submission."id"
             OR change_request."id" IS NOT NULL
           )
         ON CONFLICT ("deduplication_key") DO NOTHING;`,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `UPDATE "PendaftaranPenjalurans" AS registration
         SET "form_lanjutan_status" = 'draft',
             "form_lanjutan_submitted_at" = NULL,
             "updatedAt" = NOW()
         FROM "Pengajuans" AS submission
         INNER JOIN "Mahasiswas" AS student ON student."id" = submission."mahasiswa_id"
         LEFT JOIN "PamitUlangs" AS change_request
           ON change_request."id" = submission."pamit_ulang_id"
          AND change_request."pengajuan_baru_id" = submission."id"
         WHERE registration."id" = submission."pendaftaran_penjaluran_id"
           AND submission."status" = 'rejected'
           AND submission."tipe_pengajuan" IN ('judul_mandiri', 'topik_dosen')
           AND (
             student."pengajuan_aktif_id" = submission."id"
             OR change_request."id" IS NOT NULL
           );`,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `UPDATE "PamitUlangs" AS change_request
         SET "pengajuan_baru_id" = NULL,
             "updatedAt" = NOW()
         FROM "Pengajuans" AS submission
         WHERE change_request."id" = submission."pamit_ulang_id"
           AND change_request."pengajuan_baru_id" = submission."id"
           AND submission."status" = 'rejected'
           AND submission."tipe_pengajuan" IN ('judul_mandiri', 'topik_dosen');`,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `UPDATE "Mahasiswas" AS student
         SET "pengajuan_aktif_id" = NULL,
             "status_jalur_saat_ini" = (CASE
               WHEN submission."jenis_jalur" = 'ulang' THEN 'ulang'
               WHEN submission."jenis_jalur" = 'ekstensi' THEN 'ekstensi'
               ELSE 'belum_mengajukan'
             END)::"enum_Mahasiswas_status_jalur_saat_ini",
             "updatedAt" = NOW()
         FROM "Pengajuans" AS submission
         WHERE student."id" = submission."mahasiswa_id"
           AND student."pengajuan_aktif_id" = submission."id"
           AND submission."status" = 'rejected'
           AND submission."tipe_pengajuan" IN ('judul_mandiri', 'topik_dosen');`,
        { transaction }
      );
    });
  },

  async down(queryInterface) {
    if (queryInterface.sequelize.getDialect() !== "postgres") return;
    await queryInterface.sequelize.query(
      `DELETE FROM "Notifikasis"
       WHERE "metadata"->>'source' = 'migration_research_rejection_recovery';`
    );
  },
};
