"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("PendaftaranPenjalurans", "form_lanjutan_status", {
      type: Sequelize.ENUM("pending", "submitted"),
      allowNull: false,
      defaultValue: "pending",
    });

    await queryInterface.addColumn("PendaftaranPenjalurans", "form_lanjutan_submitted_at", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn("PendaftaranPenjalurans", "form_lanjutan_payload", {
      type: Sequelize.JSONB,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("PendaftaranPenjalurans", "form_lanjutan_payload");
    await queryInterface.removeColumn("PendaftaranPenjalurans", "form_lanjutan_submitted_at");
    await queryInterface.removeColumn("PendaftaranPenjalurans", "form_lanjutan_status");
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_PendaftaranPenjalurans_form_lanjutan_status";'
    );
  },
};

