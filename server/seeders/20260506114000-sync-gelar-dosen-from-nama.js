"use strict";

function extractGelarFromNama(namaDosen) {
  const raw = String(namaDosen || "").trim();
  const firstCommaIndex = raw.indexOf(",");
  if (firstCommaIndex === -1) return null;

  const gelar = raw.slice(firstCommaIndex + 1).trim();
  return gelar || null;
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      const [dosens] = await queryInterface.sequelize.query(
        `SELECT "id", "nama" FROM "Dosens"`,
        { transaction }
      );

      for (const dosen of dosens) {
        await queryInterface.sequelize.query(
          `
            UPDATE "Dosens"
            SET "gelar" = :gelar
            WHERE "id" = :id
          `,
          {
            transaction,
            replacements: {
              id: dosen.id,
              gelar: extractGelarFromNama(dosen.nama),
            },
          }
        );
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `UPDATE "Dosens" SET "gelar" = NULL`,
        { transaction }
      );
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
