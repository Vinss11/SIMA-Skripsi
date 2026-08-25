"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const relations = [
      {
        table: "PengajuanBidangPenelitians",
        enumName: "enum_PengajuanBidangPenelitians_peran",
        primaryIndex: "uq_pengajuan_satu_bidang_penelitian_utama",
      },
      {
        table: "TopikBidangPenelitians",
        enumName: "enum_TopikBidangPenelitians_peran",
        primaryIndex: "uq_topik_satu_bidang_penelitian_utama",
      },
    ];

    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const relation of relations) {
        await queryInterface.removeIndex(relation.table, relation.primaryIndex, { transaction });
        await queryInterface.removeColumn(relation.table, "peran", { transaction });
        await queryInterface.sequelize.query(
          `DROP TYPE IF EXISTS "${relation.enumName}";`,
          { transaction }
        );
      }
    });
  },

  async down(queryInterface, Sequelize) {
    const relations = [
      {
        table: "PengajuanBidangPenelitians",
        parentColumn: "pengajuan_id",
        primaryIndex: "uq_pengajuan_satu_bidang_penelitian_utama",
      },
      {
        table: "TopikBidangPenelitians",
        parentColumn: "topik_id",
        primaryIndex: "uq_topik_satu_bidang_penelitian_utama",
      },
    ];

    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const relation of relations) {
        await queryInterface.addColumn(
          relation.table,
          "peran",
          {
            type: Sequelize.ENUM("utama", "pendukung"),
            allowNull: false,
            defaultValue: "pendukung",
          },
          { transaction }
        );

        await queryInterface.sequelize.query(
          `UPDATE "${relation.table}" AS rel
           SET "peran" = 'utama'
           WHERE rel.id IN (
             SELECT MIN(candidate.id)
             FROM "${relation.table}" AS candidate
             GROUP BY candidate."${relation.parentColumn}"
           )`,
          { transaction }
        );
        await queryInterface.changeColumn(
          relation.table,
          "peran",
          {
            type: Sequelize.ENUM("utama", "pendukung"),
            allowNull: false,
          },
          { transaction }
        );
        await queryInterface.sequelize.query(
          `CREATE UNIQUE INDEX "${relation.primaryIndex}"
           ON "${relation.table}" ("${relation.parentColumn}")
           WHERE "peran" = 'utama'`,
          { transaction }
        );
      }
    });
  },
};
