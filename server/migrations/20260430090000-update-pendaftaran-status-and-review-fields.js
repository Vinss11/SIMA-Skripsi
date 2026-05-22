"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type t
          JOIN pg_enum e ON t.oid = e.enumtypid
          WHERE t.typname = 'enum_PendaftaranPenjalurans_status'
            AND e.enumlabel = 'approved'
        ) THEN
          ALTER TYPE "enum_PendaftaranPenjalurans_status" ADD VALUE 'approved';
        END IF;
      END
      $$;
    `);

    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type t
          JOIN pg_enum e ON t.oid = e.enumtypid
          WHERE t.typname = 'enum_PendaftaranPenjalurans_status'
            AND e.enumlabel = 'rejected'
        ) THEN
          ALTER TYPE "enum_PendaftaranPenjalurans_status" ADD VALUE 'rejected';
        END IF;
      END
      $$;
    `);

    await queryInterface.sequelize.query(`
      UPDATE "PendaftaranPenjalurans"
      SET "status" = 'approved'
      WHERE "status" = 'processed';
    `);

    await queryInterface.addColumn("PendaftaranPenjalurans", "reviewed_by_sekretaris_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "SekretarisProdis",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    await queryInterface.addColumn("PendaftaranPenjalurans", "reviewed_at", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn("PendaftaranPenjalurans", "approval_note", {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.addIndex("PendaftaranPenjalurans", ["reviewed_by_sekretaris_id"], {
      name: "idx_pendaftaran_reviewed_by_sekretaris",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("PendaftaranPenjalurans", "idx_pendaftaran_reviewed_by_sekretaris");
    await queryInterface.removeColumn("PendaftaranPenjalurans", "approval_note");
    await queryInterface.removeColumn("PendaftaranPenjalurans", "reviewed_at");
    await queryInterface.removeColumn("PendaftaranPenjalurans", "reviewed_by_sekretaris_id");
  },
};
