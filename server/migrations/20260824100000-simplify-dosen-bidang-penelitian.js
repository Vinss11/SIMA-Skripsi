"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeIndex(
        "DosenBidangPenelitians",
        "uq_dosen_satu_bidang_penelitian_utama",
        { transaction }
      );
      await queryInterface.removeColumn("DosenBidangPenelitians", "peran", { transaction });
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_DosenBidangPenelitians_peran";',
        { transaction }
      );
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.addColumn(
        "DosenBidangPenelitians",
        "peran",
        {
          type: Sequelize.ENUM("utama", "pendukung"),
          allowNull: false,
          defaultValue: "pendukung",
        },
        { transaction }
      );

      await queryInterface.sequelize.query(
        `UPDATE "DosenBidangPenelitians" AS rel
         SET "peran" = 'utama'
         WHERE rel.id IN (
           SELECT MIN(candidate.id)
           FROM "DosenBidangPenelitians" AS candidate
           GROUP BY candidate.dosen_id
         )`,
        { transaction }
      );
      await queryInterface.changeColumn(
        "DosenBidangPenelitians",
        "peran",
        {
          type: Sequelize.ENUM("utama", "pendukung"),
          allowNull: false,
        },
        { transaction }
      );
      await queryInterface.sequelize.query(
        `CREATE UNIQUE INDEX "uq_dosen_satu_bidang_penelitian_utama"
         ON "DosenBidangPenelitians" ("dosen_id")
         WHERE "peran" = 'utama'`,
        { transaction }
      );
    });
  },
};
