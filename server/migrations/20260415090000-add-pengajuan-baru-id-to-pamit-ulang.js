"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("PamitUlangs", "pengajuan_baru_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "Pengajuans",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    // Backfill dari relasi yang sudah ada: Pengajuans.pamit_ulang_id -> PamitUlangs.id
    await queryInterface.sequelize.query(`
      UPDATE "PamitUlangs" p
      SET "pengajuan_baru_id" = q.id
      FROM "Pengajuans" q
      WHERE q."pamit_ulang_id" = p.id
        AND p."pengajuan_baru_id" IS NULL;
    `);

    await queryInterface.addIndex("PamitUlangs", ["pengajuan_baru_id"]);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("PamitUlangs", ["pengajuan_baru_id"]);
    await queryInterface.removeColumn("PamitUlangs", "pengajuan_baru_id");
  },
};

