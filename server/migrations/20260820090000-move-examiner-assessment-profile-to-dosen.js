"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.addColumn(
        "Dosens",
        "profil_penilaian_penguji",
        {
          type: Sequelize.ENUM("intensitas_tinggi", "suportif"),
          allowNull: true,
        },
        { transaction }
      );

      await queryInterface.sequelize.query(
        `UPDATE "Dosens" AS dosen
         SET "profil_penilaian_penguji" = CASE
           WHEN EXISTS (
             SELECT 1 FROM "KetersediaanPengujiSidangs" AS availability
             WHERE availability.dosen_id = dosen.id
               AND availability.tipe_penilaian::text = 'ketat'
           ) THEN 'intensitas_tinggi'::"enum_Dosens_profil_penilaian_penguji"
           WHEN EXISTS (
             SELECT 1 FROM "KetersediaanPengujiSidangs" AS availability
             WHERE availability.dosen_id = dosen.id
           ) THEN 'suportif'::"enum_Dosens_profil_penilaian_penguji"
           ELSE NULL
         END`,
        { transaction }
      );

      await queryInterface.removeColumn("KetersediaanPengujiSidangs", "tipe_penilaian", { transaction });
    });

    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_KetersediaanPengujiSidangs_tipe_penilaian";'
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.addColumn(
        "KetersediaanPengujiSidangs",
        "tipe_penilaian",
        {
          type: Sequelize.ENUM("ketat", "santai"),
          allowNull: false,
          defaultValue: "santai",
        },
        { transaction }
      );

      await queryInterface.sequelize.query(
        `UPDATE "KetersediaanPengujiSidangs" AS availability
         SET tipe_penilaian = CASE
           WHEN dosen.profil_penilaian_penguji::text = 'intensitas_tinggi'
             THEN 'ketat'::"enum_KetersediaanPengujiSidangs_tipe_penilaian"
           ELSE 'santai'::"enum_KetersediaanPengujiSidangs_tipe_penilaian"
         END
         FROM "Dosens" AS dosen
         WHERE dosen.id = availability.dosen_id`,
        { transaction }
      );

      await queryInterface.removeColumn("Dosens", "profil_penilaian_penguji", { transaction });
    });

    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_Dosens_profil_penilaian_penguji";'
    );
  },
};
