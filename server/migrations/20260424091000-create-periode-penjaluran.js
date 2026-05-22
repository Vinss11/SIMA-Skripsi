"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("PeriodePenjalurans", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      tahun_akademik: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      semester: {
        type: Sequelize.ENUM("ganjil", "genap"),
        allowNull: false,
      },
      label_periode: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true,
      },
      tanggal_mulai: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      tanggal_selesai: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("PeriodePenjalurans");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_PeriodePenjalurans_semester";');
  },
};

