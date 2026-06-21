"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE "PendaftaranPenjalurans" p
      SET "status" = 'approved',
          "reviewed_at" = COALESCE("reviewed_at", NOW()),
          "approval_note" = COALESCE(
            "approval_note",
            'Kelompok dapat mengisi proposal sebelum review dosen pengampu.'
          ),
          "updatedAt" = NOW()
      FROM "AnggotaKelompokPerintisans" a
      WHERE a."pendaftaran_penjaluran_id" = p."id"
        AND p."status" = 'submitted'
    `);
  },

  async down() {
    // Status lama tidak dikembalikan karena proposal mungkin sudah diproses setelah migrasi.
  },
};
