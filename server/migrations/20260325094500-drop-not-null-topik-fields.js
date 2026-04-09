"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const dialect = queryInterface.sequelize.getDialect();
    if (dialect !== "postgres") {
      return;
    }

    await queryInterface.sequelize.transaction(async (transaction) => {
      const columns = ["topik_1_kode", "topik_1_judul", "dosen_pilihan_1", "dosen_1_nama"];
      for (const column of columns) {
        await queryInterface.sequelize.query(
          `ALTER TABLE "Pengajuans" ALTER COLUMN "${column}" DROP NOT NULL;`,
          { transaction }
        );
      }
    });
  },

  async down(queryInterface) {
    const dialect = queryInterface.sequelize.getDialect();
    if (dialect !== "postgres") {
      return;
    }

    await queryInterface.sequelize.transaction(async (transaction) => {
      const columns = ["topik_1_kode", "topik_1_judul", "dosen_pilihan_1", "dosen_1_nama"];
      for (const column of columns) {
        await queryInterface.sequelize.query(
          `ALTER TABLE "Pengajuans" ALTER COLUMN "${column}" SET NOT NULL;`,
          { transaction }
        );
      }
    });
  },
};
