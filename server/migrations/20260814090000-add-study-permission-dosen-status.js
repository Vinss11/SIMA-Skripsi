"use strict";

const ENUM_TYPES = [
  "enum_Dosens_status_keaktifan",
  "enum_RiwayatStatusDosens_status_sebelumnya",
  "enum_RiwayatStatusDosens_status_baru",
];

module.exports = {
  async up(queryInterface) {
    for (const enumType of ENUM_TYPES) {
      await queryInterface.sequelize.query(
        `ALTER TYPE "${enumType}" ADD VALUE IF NOT EXISTS 'study_permission' AFTER 'active';`
      );
    }
  },

  async down() {
    throw new Error("Nilai enum study_permission tidak dapat dihapus secara aman secara otomatis.");
  },
};
