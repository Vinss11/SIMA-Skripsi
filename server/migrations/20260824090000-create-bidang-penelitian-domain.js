"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable("BidangPenelitians", {
        id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
        kode: { type: Sequelize.STRING(20), allowNull: false, unique: true },
        nama: { type: Sequelize.STRING(150), allowNull: false, unique: true },
        deskripsi: { type: Sequelize.TEXT, allowNull: false },
        contoh_kata_kunci: { type: Sequelize.TEXT, allowNull: true },
        createdAt: { allowNull: false, type: Sequelize.DATE },
        updatedAt: { allowNull: false, type: Sequelize.DATE },
      }, { transaction });

      const relationDefinitions = [
        {
          table: "DosenBidangPenelitians",
          parentColumn: "dosen_id",
          parentTable: "Dosens",
          uniqueName: "uq_dosen_bidang_penelitian",
          primaryName: "uq_dosen_satu_bidang_penelitian_utama",
        },
        {
          table: "PengajuanBidangPenelitians",
          parentColumn: "pengajuan_id",
          parentTable: "Pengajuans",
          uniqueName: "uq_pengajuan_bidang_penelitian",
          primaryName: "uq_pengajuan_satu_bidang_penelitian_utama",
        },
        {
          table: "TopikBidangPenelitians",
          parentColumn: "topik_id",
          parentTable: "Topiks",
          uniqueName: "uq_topik_bidang_penelitian",
          primaryName: "uq_topik_satu_bidang_penelitian_utama",
        },
      ];

      for (const definition of relationDefinitions) {
        await queryInterface.createTable(definition.table, {
          id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
          [definition.parentColumn]: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: definition.parentTable, key: "id" },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
          },
          bidang_penelitian_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: "BidangPenelitians", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "RESTRICT",
          },
          peran: {
            type: Sequelize.ENUM("utama", "pendukung"),
            allowNull: false,
          },
          createdAt: { allowNull: false, type: Sequelize.DATE },
          updatedAt: { allowNull: false, type: Sequelize.DATE },
        }, { transaction });

        await queryInterface.addIndex(
          definition.table,
          [definition.parentColumn, "bidang_penelitian_id"],
          { name: definition.uniqueName, unique: true, transaction }
        );
        await queryInterface.sequelize.query(
          `CREATE UNIQUE INDEX "${definition.primaryName}"
           ON "${definition.table}" ("${definition.parentColumn}")
           WHERE "peran" = 'utama'`,
          { transaction }
        );
        await queryInterface.addIndex(
          definition.table,
          ["bidang_penelitian_id", definition.parentColumn],
          { name: `idx_${definition.table.toLowerCase()}_bidang`, transaction }
        );
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.dropTable("TopikBidangPenelitians", { transaction });
      await queryInterface.dropTable("PengajuanBidangPenelitians", { transaction });
      await queryInterface.dropTable("DosenBidangPenelitians", { transaction });
      await queryInterface.dropTable("BidangPenelitians", { transaction });
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_TopikBidangPenelitians_peran";', { transaction });
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_PengajuanBidangPenelitians_peran";', { transaction });
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_DosenBidangPenelitians_peran";', { transaction });
    });
  },
};
