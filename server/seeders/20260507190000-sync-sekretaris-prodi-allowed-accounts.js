"use strict";
const bcrypt = require("bcrypt");
const { ALLOWED_SEKRETARIS_JABATAN } = require("../constants/sekretarisAkses");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      const [dosenRows] = await queryInterface.sequelize.query(
        `
          SELECT "nama", "nik", "kode_dosen", "email", "jabatan_struktural"
          FROM "Dosens"
          WHERE "jabatan_struktural" IN (:jabatanList)
        `,
        {
          replacements: { jabatanList: ALLOWED_SEKRETARIS_JABATAN },
          transaction,
        }
      );

      const dosenByJabatan = new Map(
        dosenRows.map((row) => [row.jabatan_struktural, row])
      );

      const missingJabatan = ALLOWED_SEKRETARIS_JABATAN.filter(
        (jabatan) => !dosenByJabatan.has(jabatan)
      );
      if (missingJabatan.length > 0) {
        throw new Error(
          `Sinkronisasi sekretaris gagal. Dosen jabatan berikut belum ada: ${missingJabatan.join(", ")}`
        );
      }

      const hashedPassword = await bcrypt.hash("12345678", 10);
      const now = new Date();

      const records = ALLOWED_SEKRETARIS_JABATAN.map((jabatan) => {
        const dosen = dosenByJabatan.get(jabatan);
        const nikAkun = String(dosen.nik || dosen.kode_dosen || "").trim().slice(0, 9);
        if (!nikAkun) {
          throw new Error(`Dosen jabatan '${jabatan}' tidak memiliki NIK/kode_dosen sebagai username akun sekretaris.`);
        }

        return {
          nik: nikAkun,
          nama: dosen.nama,
          email: dosen.email,
          password: hashedPassword,
          is_default_password: true,
          jabatan,
          createdAt: now,
          updatedAt: now,
        };
      });

      await queryInterface.bulkDelete("SekretarisProdis", null, { transaction });
      await queryInterface.bulkInsert("SekretarisProdis", records, { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete(
      "SekretarisProdis",
      {
        jabatan: ALLOWED_SEKRETARIS_JABATAN,
      },
      {}
    );
  },
};


