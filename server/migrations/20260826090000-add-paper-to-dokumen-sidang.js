"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("DokumenSidangs", "paper_file_path", {
      type: Sequelize.STRING(500),
      allowNull: true,
    });
    await queryInterface.addColumn("DokumenSidangs", "paper_file_name", {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
    await queryInterface.addColumn("DokumenSidangs", "paper_status", {
      type: Sequelize.ENUM("belum_upload", "submitted", "revisi", "approved"),
      allowNull: false,
      defaultValue: "belum_upload",
    });
    await queryInterface.addColumn("DokumenSidangs", "paper_uploaded_at", {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn("DokumenSidangs", "paper_review_note", {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn("DokumenSidangs", "paper_reviewed_at", {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("DokumenSidangs", "paper_reviewed_at");
    await queryInterface.removeColumn("DokumenSidangs", "paper_review_note");
    await queryInterface.removeColumn("DokumenSidangs", "paper_uploaded_at");
    await queryInterface.removeColumn("DokumenSidangs", "paper_status");
    await queryInterface.removeColumn("DokumenSidangs", "paper_file_name");
    await queryInterface.removeColumn("DokumenSidangs", "paper_file_path");

    if (queryInterface.sequelize.getDialect() === "postgres") {
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_DokumenSidangs_paper_status";');
    }
  },
};
