"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("Topiks", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      judul: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      deskripsi: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      cluster: {
        type: Sequelize.ENUM("Sirkel", "Siber", "ITSC", "MVK"),
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM("available", "taken", "unavailable"),
        defaultValue: "available",
        allowNull: false,
      },
      dosen_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "Dosens",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      kuota: {
        type: Sequelize.INTEGER,
        defaultValue: 1,
        allowNull: false,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("Topiks");
  },
};
