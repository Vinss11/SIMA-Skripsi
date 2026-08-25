"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.addColumn("KelompokPerintisanBisnis", "nama_kelompok", {
        type: Sequelize.STRING(150),
        allowNull: true,
      }, { transaction });
      await queryInterface.addColumn("KelompokPerintisanBisnis", "jenis_bisnis", {
        type: Sequelize.STRING(150),
        allowNull: true,
      }, { transaction });
      await queryInterface.sequelize.query(
        `UPDATE "KelompokPerintisanBisnis"
         SET "nama_kelompok" = CONCAT('Kelompok Perintisan #', "id")
         WHERE "nama_kelompok" IS NULL`,
        { transaction }
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeColumn("KelompokPerintisanBisnis", "jenis_bisnis", { transaction });
      await queryInterface.removeColumn("KelompokPerintisanBisnis", "nama_kelompok", { transaction });
    });
  },
};
