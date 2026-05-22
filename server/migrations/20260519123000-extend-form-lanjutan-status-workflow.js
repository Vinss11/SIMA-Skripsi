"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type t
          JOIN pg_enum e ON t.oid = e.enumtypid
          WHERE t.typname = 'enum_PendaftaranPenjalurans_form_lanjutan_status'
            AND e.enumlabel = 'draft'
        ) THEN
          ALTER TYPE "enum_PendaftaranPenjalurans_form_lanjutan_status" ADD VALUE 'draft';
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
          WHERE t.typname = 'enum_PendaftaranPenjalurans_form_lanjutan_status'
            AND e.enumlabel = 'review_dosen_magang'
        ) THEN
          ALTER TYPE "enum_PendaftaranPenjalurans_form_lanjutan_status" ADD VALUE 'review_dosen_magang';
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
          WHERE t.typname = 'enum_PendaftaranPenjalurans_form_lanjutan_status'
            AND e.enumlabel = 'review_sekprodi'
        ) THEN
          ALTER TYPE "enum_PendaftaranPenjalurans_form_lanjutan_status" ADD VALUE 'review_sekprodi';
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
          WHERE t.typname = 'enum_PendaftaranPenjalurans_form_lanjutan_status'
            AND e.enumlabel = 'approved'
        ) THEN
          ALTER TYPE "enum_PendaftaranPenjalurans_form_lanjutan_status" ADD VALUE 'approved';
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
          WHERE t.typname = 'enum_PendaftaranPenjalurans_form_lanjutan_status'
            AND e.enumlabel = 'rejected'
        ) THEN
          ALTER TYPE "enum_PendaftaranPenjalurans_form_lanjutan_status" ADD VALUE 'rejected';
        END IF;
      END
      $$;
    `);

    await queryInterface.sequelize.query(`
      UPDATE "PendaftaranPenjalurans"
      SET "form_lanjutan_status" = 'draft'
      WHERE "form_lanjutan_status" = 'pending';
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE "PendaftaranPenjalurans"
      ALTER COLUMN "form_lanjutan_status"
      SET DEFAULT 'draft';
    `);
  },

  async down() {
    // Enum value tidak dihapus untuk menjaga kompatibilitas data existing.
  },
};

