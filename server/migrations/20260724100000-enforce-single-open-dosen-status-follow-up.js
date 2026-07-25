"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(`
        WITH ranked_open AS (
          SELECT
            id,
            ROW_NUMBER() OVER (
              PARTITION BY dosen_id
              ORDER BY "updatedAt" DESC, id DESC
            ) AS row_number
          FROM "TindakLanjutStatusDosens"
          WHERE status = 'open'
        )
        UPDATE "TindakLanjutStatusDosens" AS follow_up
        SET
          status = 'resolved',
          catatan_penyelesaian = 'Ditutup otomatis karena terdapat lebih dari satu tindak lanjut aktif untuk dosen yang sama.',
          resolution_type = 'resolved',
          resolution_decisions = '{"auto_resolved":true,"reason":"duplicate_open_follow_up"}'::jsonb,
          resolved_at = NOW(),
          "updatedAt" = NOW()
        FROM ranked_open
        WHERE follow_up.id = ranked_open.id
          AND ranked_open.row_number > 1
      `, { transaction });

      await queryInterface.addIndex("TindakLanjutStatusDosens", ["dosen_id"], {
        name: "uq_tindak_lanjut_status_dosen_one_open",
        unique: true,
        where: { status: "open" },
        transaction,
      });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeIndex(
        "TindakLanjutStatusDosens",
        "uq_tindak_lanjut_status_dosen_one_open",
        { transaction }
      );
    });
  },
};
