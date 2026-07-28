"use strict";

module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(`
        UPDATE "DosenKetersediaanPeriodes" AS availability
        SET
          "tersedia_membimbing" = false,
          "configuration_status" = 'needs_review',
          "reviewed_at" = NULL,
          "reviewed_by_sekretaris_id" = NULL,
          "updated_by_sekretaris_id" = NULL,
          "review_note" = 'Status master kembali aktif dan perlu ditinjau ulang',
          "updatedAt" = NOW()
        FROM "PeriodePenjalurans" AS periode,
             "Dosens" AS dosen
        WHERE availability."periode_penjaluran_id" = periode."id"
          AND availability."dosen_id" = dosen."id"
          AND (periode."status" = 'active' OR periode."is_active" = true)
          AND dosen."status_keaktifan" = 'active'
          AND availability."review_note" = 'Tindak lanjut reaktivasi telah diselesaikan; nilai ketersediaan tetap dipertahankan.'
      `, { transaction });

      await queryInterface.sequelize.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS "uq_periode_penjaluran_single_effective_active"
        ON "PeriodePenjalurans" ((1))
        WHERE ("status" = 'active' OR "is_active" = true)
      `, { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      'DROP INDEX IF EXISTS "uq_periode_penjaluran_single_effective_active"'
    );
  },
};
