"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("MitraMagangs", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      nama: {
        type: Sequelize.STRING(180),
        allowNull: false,
        unique: true,
      },
      bidang_jenis: {
        type: Sequelize.STRING(180),
        allowNull: true,
      },
      lokasi: {
        type: Sequelize.STRING(180),
        allowNull: true,
      },
      email_kontak: {
        type: Sequelize.STRING(180),
        allowNull: true,
      },
      website: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM("active", "inactive"),
        allowNull: false,
        defaultValue: "active",
      },
      catatan: {
        type: Sequelize.TEXT,
        allowNull: true,
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

  async down(queryInterface) {
    await queryInterface.dropTable("MitraMagangs");
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_MitraMagangs_status";'
    );
  },
};

