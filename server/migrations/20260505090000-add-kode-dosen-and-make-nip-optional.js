"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Dosens", "kode_dosen", {
      type: Sequelize.STRING(30),
      allowNull: true,
      unique: true,
    });

    await queryInterface.sequelize.query(`
      UPDATE "Dosens"
      SET "kode_dosen" = CONCAT('DSN', LPAD(CAST("id" AS TEXT), 4, '0'))
      WHERE "kode_dosen" IS NULL
    `);

    await queryInterface.changeColumn("Dosens", "kode_dosen", {
      type: Sequelize.STRING(30),
      allowNull: false,
      unique: true,
    });

    await queryInterface.changeColumn("Dosens", "nip", {
      type: Sequelize.STRING(20),
      allowNull: true,
      unique: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      UPDATE "Dosens"
      SET "nip" = CONCAT('9', LPAD(CAST("id" AS TEXT), 19, '0'))
      WHERE "nip" IS NULL
    `);

    await queryInterface.changeColumn("Dosens", "nip", {
      type: Sequelize.STRING(20),
      allowNull: false,
      unique: true,
    });

    await queryInterface.removeColumn("Dosens", "kode_dosen");
  },
};

