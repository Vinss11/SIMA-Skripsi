"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("PamitUlangs", "status_dospem", {
      type: Sequelize.ENUM("pending", "approved", "rejected"),
      allowNull: false,
      defaultValue: "pending",
    });

    await queryInterface.addColumn("PamitUlangs", "keterangan_dospem", {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.addColumn("PamitUlangs", "tanggal_approval_dospem", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    // Backfill data lama agar tidak memutus alur existing.
    await queryInterface.sequelize.query(`
      UPDATE "PamitUlangs"
      SET
        "status_dospem" = 'approved',
        "keterangan_dospem" = 'Disetujui otomatis (data lama sebelum fitur approval dospem)',
        "tanggal_approval_dospem" = COALESCE("tanggal_approval_dpa", "updatedAt")
      WHERE "status_dpa" IN ('approved', 'rejected');
    `);

    await queryInterface.addIndex("PamitUlangs", ["status_dospem"]);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("PamitUlangs", ["status_dospem"]);
    await queryInterface.removeColumn("PamitUlangs", "tanggal_approval_dospem");
    await queryInterface.removeColumn("PamitUlangs", "keterangan_dospem");
    await queryInterface.removeColumn("PamitUlangs", "status_dospem");

    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_PamitUlangs_status_dospem";');
  },
};
