"use strict";

const NOTIFICATION_TYPE = "research_submission_review_lecturer";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    if (queryInterface.sequelize.getDialect() !== "postgres") return;

    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `WITH reviewers AS (
           SELECT submission."id" AS submission_id, submission."mahasiswa_id",
                  submission."jenis_jalur", submission."status",
                  submission."dosen_pilihan_1" AS dosen_id,
                  submission."topik_1_kode" AS topik_kode
           FROM "Pengajuans" AS submission
           WHERE submission."tipe_pengajuan" = 'topik_dosen'
             AND submission."dosen_pilihan_1" IS NOT NULL
             AND submission."topik_1_kode" IS NOT NULL
           UNION ALL
           SELECT submission."id", submission."mahasiswa_id", submission."jenis_jalur", submission."status",
                  submission."dosen_pilihan_2", submission."topik_2_kode"
           FROM "Pengajuans" AS submission
           WHERE submission."tipe_pengajuan" = 'topik_dosen'
             AND submission."dosen_pilihan_2" IS NOT NULL
             AND submission."topik_2_kode" IS NOT NULL
           UNION ALL
           SELECT submission."id", submission."mahasiswa_id", submission."jenis_jalur", submission."status",
                  submission."dosen_pilihan_3", submission."topik_3_kode"
           FROM "Pengajuans" AS submission
           WHERE submission."tipe_pengajuan" = 'topik_dosen'
             AND submission."dosen_pilihan_3" IS NOT NULL
             AND submission."topik_3_kode" IS NOT NULL
         ), pending_reviewers AS (
           SELECT reviewer."submission_id", reviewer."mahasiswa_id", reviewer."jenis_jalur",
                  reviewer."dosen_id",
                  array_agg(DISTINCT reviewer."topik_kode") AS topik_kodes,
                  string_agg(DISTINCT reviewer."topik_kode", ', ') AS topik_label
           FROM reviewers AS reviewer
           WHERE reviewer."status" = 'pending'
             AND (
               EXISTS (
                 SELECT 1 FROM "RiwayatPersetujuans" AS decision
                 WHERE decision."pengajuan_id" = reviewer."submission_id"
                   AND decision."dosen_id" = reviewer."dosen_id"
                   AND decision."tipe_approval" = 'calon_pembimbing'
                   AND decision."status" = 'pending'
               )
               OR NOT EXISTS (
                 SELECT 1 FROM "RiwayatPersetujuans" AS decision
                 WHERE decision."pengajuan_id" = reviewer."submission_id"
                   AND decision."dosen_id" = reviewer."dosen_id"
                   AND decision."tipe_approval" = 'calon_pembimbing'
               )
             )
           GROUP BY reviewer."submission_id", reviewer."mahasiswa_id", reviewer."jenis_jalur", reviewer."dosen_id"
         )
         INSERT INTO "Notifikasis" (
           "recipient_type", "recipient_id", "type", "title", "message",
           "reference_type", "reference_id", "action_key", "metadata",
           "read_at", "deduplication_key", "createdAt", "updatedAt"
         )
         SELECT
           'dosen', pending."dosen_id", '${NOTIFICATION_TYPE}', 'Pengajuan Penelitian Baru',
           'Pengajuan topik penelitian ' || pending."topik_label" || ' dari ' || student."nama" ||
             ' (' || student."nim" || ') menunggu review Anda.',
           'pengajuan', pending."submission_id", 'lecturer_submission_review',
           jsonb_build_object(
             'mahasiswa_id', student."id",
             'mahasiswa_nama', student."nama",
             'mahasiswa_nim', student."nim",
             'jenis_jalur', pending."jenis_jalur",
             'tipe_pengajuan', 'topik_dosen',
             'topik_kodes', to_jsonb(pending."topik_kodes"),
             'source', 'migration_backfill_topik_dosen'
           ),
           NULL,
           'research-submission:' || pending."submission_id" || ':reviewer:' || pending."dosen_id",
           NOW(), NOW()
         FROM pending_reviewers AS pending
         INNER JOIN "Mahasiswas" AS student ON student."id" = pending."mahasiswa_id"
         ON CONFLICT ("deduplication_key") DO NOTHING;`,
        { transaction }
      );
    });
  },

  async down(queryInterface) {
    if (queryInterface.sequelize.getDialect() !== "postgres") return;

    await queryInterface.sequelize.query(
      `DELETE FROM "Notifikasis"
       WHERE "type" = '${NOTIFICATION_TYPE}'
         AND "metadata"->>'source' = 'migration_backfill_topik_dosen';`
    );
  },
};
