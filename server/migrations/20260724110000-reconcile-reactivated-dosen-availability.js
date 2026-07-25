"use strict";

module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(`
        UPDATE "DosenKetersediaanPeriodes" AS availability
        SET
          "configuration_status" = 'ready',
          "reviewed_at" = COALESCE(follow_up."resolved_at", NOW()),
          "reviewed_by_sekretaris_id" = follow_up."resolved_by_sekretaris_id",
          "updated_by_sekretaris_id" = follow_up."resolved_by_sekretaris_id",
          "review_note" = 'Tindak lanjut reaktivasi telah diselesaikan; nilai ketersediaan tetap dipertahankan.',
          "updatedAt" = NOW()
        FROM "PeriodePenjalurans" AS periode,
             "Dosens" AS dosen,
             "TindakLanjutStatusDosens" AS follow_up,
             "RiwayatStatusDosens" AS history
        WHERE availability."periode_penjaluran_id" = periode."id"
          AND availability."dosen_id" = dosen."id"
          AND follow_up."dosen_id" = dosen."id"
          AND follow_up."riwayat_status_dosen_id" = history."id"
          AND periode."status" = 'active'
          AND dosen."status_keaktifan" = 'active'
          AND availability."configuration_status" = 'needs_review'
          AND follow_up."status" = 'resolved'
          AND history."status_baru" = 'active'
          AND history."status_sebelumnya" <> 'active'
      `, { transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down() {
    // Rekonsiliasi data tidak dibalik agar konfigurasi yang sudah siap tidak kembali tertahan.
  },
};
