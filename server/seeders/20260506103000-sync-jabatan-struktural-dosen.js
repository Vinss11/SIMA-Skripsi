"use strict";

function normalizeName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function resolveJabatanStruktural(namaDosen) {
  const normalized = normalizeName(namaDosen);
  if (!normalized) return null;

  if (normalized.includes("radenteduhdirgahayu")) return "Ketua Jurusan Informatika";
  if (normalized.includes("sheilanurulhuda")) return "Sekretaris Jurusan Informatika";
  if (normalized.includes("dhomashattafudholi")) return "Ketua Program Studi Informatika - Program Sarjana";
  if (normalized.includes("chanifahindahratnasari")) return "Sekretaris Program Studi Informatika - Program Sarjana Reguler";
  if (normalized.includes("harisetiaji")) return "Sekretaris Program Studi Informatika - Program Sarjana International Program";
  if (normalized.includes("nurwijayaningrahayu")) return "Ketua Program Studi Informatika - Program Sarjana Pendidikan Jarak Jauh";
  if (normalized.includes("irvingvitrapaputungan")) return "Ketua Program Studi Informatika - Program Magister";

  return null;
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
            SET "jabatan_struktural" = :jabatan
            WHERE "id" = :id
          `,
          {
            transaction,
            replacements: {
              id: dosen.id,
              jabatan: resolveJabatanStruktural(dosen.nama),
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
        `UPDATE "Dosens" SET "jabatan_struktural" = NULL`,
        { transaction }
      );
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
