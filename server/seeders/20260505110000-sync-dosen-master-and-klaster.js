"use strict";
const bcrypt = require("bcrypt");

const KLASTER_MASTER = [
  { kode: "MEDIS", nama: "Informatika Medis" },
  { kode: "ITSC", nama: "Informatika Teori & Sistem Cerdas" },
  { kode: "MVK", nama: "Multimedia & Visi Komputer" },
  { kode: "SDATA", nama: "Sains Data" },
  { kode: "SIRKEL", nama: "Sistem Informasi & Rekayasa Perangkat Lunak" },
  { kode: "SIBER", nama: "Sistem Siber" },
];

const DOSEN_KLASTER_MASTER = [
  { nama: "Prof. Dr. Sri Kusumadewi, S.Si., M.T.", klaster: ["Informatika Medis", "Informatika Teori & Sistem Cerdas"] },
  { nama: "Ir. Dhomas Hatta Fudholi, S.T., M.Eng., Ph.D., IPM., ASEAN Eng.", klaster: ["Informatika Medis", "Informatika Teori & Sistem Cerdas", "Sains Data"] },
  { nama: "Ir. Izzati Muhimmah, S.T., M.Sc., Ph.D.", klaster: ["Informatika Medis", "Multimedia & Visi Komputer"] },
  { nama: "Arrie Kurniawardhani, S.Si., M.Kom.", klaster: ["Informatika Medis", "Multimedia & Visi Komputer", "Sains Data"] },
  { nama: "Chanifah Indah Ratnasari, S.Kom., M.Kom.", klaster: ["Informatika Medis", "Informatika Teori & Sistem Cerdas", "Sistem Informasi"] },
  { nama: "Aridhanyati Arifin, S.T., M.Cs.", klaster: ["Informatika Medis", "Informatika Teori & Sistem Cerdas"] },
  { nama: "Elyza Gustri Wahyuni, S.T., M.Cs.", klaster: ["Informatika Medis", "Informatika Teori & Sistem Cerdas"] },
  { nama: "Rahadian Kurniawan, S.Kom., M.Kom.", klaster: ["Informatika Medis", "Multimedia & Visi Komputer"] },
  { nama: "Sri Mulyati, S.Kom., M.Kom.", klaster: ["Informatika Medis", "Informatika Teori & Sistem Cerdas"] },
  { nama: "Ir. Irving Vitra Paputungan, S.T., M.Sc., Ph.D.", klaster: ["Informatika Teori & Sistem Cerdas"] },
  { nama: "Dr. Novi Setiani, S.T., M.T.", klaster: ["Informatika Teori & Sistem Cerdas", "Rekayasa Perangkat Lunak"] },
  { nama: "Ahmad Fathan Hidayatullah, S.T., M.Cs., Ph.D.", klaster: ["Informatika Teori & Sistem Cerdas", "Sains Data", "Sistem Informasi"] },
  { nama: "Taufiq Hidayat, S.T., M.Sc., Ph.D.", klaster: ["Informatika Teori & Sistem Cerdas", "Sains Data"] },
  { nama: "Sheila Nurul Huda, S.Kom., M.Cs.", klaster: ["Informatika Teori & Sistem Cerdas", "Multimedia & Visi Komputer"] },
  { nama: "Zainudin Zukhri, S.T., MIT.", klaster: ["Informatika Teori & Sistem Cerdas", "Sains Data"] },
  { nama: "Lizda Iswari, S.T., M.Sc.", klaster: ["Informatika Teori & Sistem Cerdas", "Sains Data", "Sistem Informasi"] },
  { nama: "Septia Rani, S.T., M.Cs.", klaster: ["Informatika Teori & Sistem Cerdas", "Multimedia & Visi Komputer", "Sains Data"] },
  { nama: "Ir. Chandra Kusuma Dewa, S.Kom., M.Kom., Ph.D.", klaster: ["Multimedia & Visi Komputer"] },
  { nama: "Galang Prihadi Mahardhika, S.Kom., M.Kom.", klaster: ["Multimedia & Visi Komputer", "Sains Data"] },
  { nama: "Dr. Ir. Raden Teduh Dirgahayu, S.T., M.Sc.", klaster: ["Rekayasa Perangkat Lunak"] },
  { nama: "Dr. Feri Wijayanto, S.T., M.T.", klaster: ["Rekayasa Perangkat Lunak"] },
  { nama: "Andhik Budi Cahyono, S.T., M.T.", klaster: ["Rekayasa Perangkat Lunak"] },
  { nama: "Ari Sujarwo, S.Kom., MIT. (Hons)", klaster: ["Rekayasa Perangkat Lunak", "Sistem Informasi", "Sistem Siber"] },
  { nama: "Hari Setiaji, S.Kom., M.Eng.", klaster: ["Rekayasa Perangkat Lunak", "Sistem Informasi"] },
  { nama: "Hendrik, S.T., M.Eng.", klaster: ["Rekayasa Perangkat Lunak", "Sistem Informasi"] },
  { nama: "Beni Suranto, S.T., M.SoftEng.", klaster: ["Rekayasa Perangkat Lunak"] },
  { nama: "Hanson Prihantoro Putro, S.T., M.T.", klaster: ["Rekayasa Perangkat Lunak"] },
  { nama: "Rian Adam Rajagede, S.Kom., M.Cs.", klaster: ["Sains Data"] },
  { nama: "Prof. Fathul Wahid, S.T., M.Sc., Ph.D.", klaster: ["Sains Data"] },
  { nama: "Mukhammad Andri Setiawan, S.T., M.Sc., Ph.D.", klaster: ["Sains Data", "Sistem Siber"] },
  { nama: "Dr. Nur Wijayaning Rahayu, S.Kom., M.Cs.", klaster: ["Sistem Informasi"] },
  { nama: "Kholid Haryono, S.T., M.Kom.", klaster: ["Sistem Informasi"] },
  { nama: "Almed Hamzah, S.T., M.Eng.", klaster: ["Sistem Informasi"] },
  { nama: "Dr. Yudi Prayudi, S.Si., M.Kom.", klaster: ["Sistem Siber"] },
  { nama: "Dr. Ahmad Luthfi, S.Kom., M.Kom.", klaster: ["Sistem Siber"] },
  { nama: "Dr. Syarif Hidayat, S.Kom., M.I.T.", klaster: ["Sistem Siber"] },
  { nama: "Ir. Kurniawan Dwi Irianto, S.T., M.Sc.", klaster: ["Sistem Siber"] },
  { nama: "Moh. Idris, S.Kom., M.Kom.", klaster: ["Sistem Siber"] },
  { nama: "Erika Ramadhani, S.T., M.Eng.", klaster: ["Sistem Siber"] },
  { nama: "Fayruz Rahma, S.T., M.Eng.", klaster: ["Sistem Siber"] },
  { nama: "Fietyata Yudha, S.Kom., M.Kom.", klaster: ["Sistem Siber"] },
];

function normalizeName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function resolveKlasterCode(label) {
  const text = String(label || "").trim().toLowerCase();
  if (!text) return null;
  if (text === "informatika medis") return "MEDIS";
  if (text === "informatika teori & sistem cerdas") return "ITSC";
  if (text === "multimedia & visi komputer") return "MVK";
  if (text === "sains data") return "SDATA";
  if (text === "sistem siber") return "SIBER";
  if (text === "sistem informasi") return "SIRKEL";
  if (text === "rekayasa perangkat lunak") return "SIRKEL";
  return null;
}

function extractGelarFromNama(namaDosen) {
  const raw = String(namaDosen || "").trim();
  const firstCommaIndex = raw.indexOf(",");
  if (firstCommaIndex === -1) return null;

  const gelar = raw.slice(firstCommaIndex + 1).trim();
  return gelar || null;
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
      const now = new Date();
      const defaultPasswordHash = await bcrypt.hash("12345678", 10);

      const [existingDosenRows] = await queryInterface.sequelize.query(
        `SELECT "id", "nama", "kode_dosen" FROM "Dosens"`,
        { transaction }
      );

      const dosenByNormalizedName = new Map(
        existingDosenRows.map((row) => [normalizeName(row.nama), row])
      );

      const [maxSeqRows] = await queryInterface.sequelize.query(
        `
        SELECT COALESCE(MAX(CAST(SUBSTRING("kode_dosen" FROM 4) AS INTEGER)), 0) AS max_seq
        FROM "Dosens"
        WHERE "kode_dosen" ~ '^DSN[0-9]+$'
      `,
        { transaction }
      );
      let nextKodeSeq = Number(maxSeqRows?.[0]?.max_seq || 0);

      const insertDosens = [];
      for (const item of DOSEN_KLASTER_MASTER) {
        const normalized = normalizeName(item.nama);
        if (dosenByNormalizedName.has(normalized)) continue;

        nextKodeSeq += 1;
        const kodeDosen = `DSN${String(nextKodeSeq).padStart(4, "0")}`;
        insertDosens.push({
          kode_dosen: kodeDosen,
          nik: String(nextKodeSeq).padStart(9, "0"),
          nama: item.nama,
          gelar: extractGelarFromNama(item.nama),
          email: `${kodeDosen.toLowerCase()}@dosen.uii.ac.id`,
          password: defaultPasswordHash,
          is_default_password: true,
          jabatan_struktural: resolveJabatanStruktural(item.nama),
          kuota_bimbingan: 8,
          createdAt: now,
          updatedAt: now,
        });
      }

      if (insertDosens.length > 0) {
        await queryInterface.bulkInsert("Dosens", insertDosens, { transaction });
      }

      const [freshDosenRows] = await queryInterface.sequelize.query(
        `SELECT "id", "nama" FROM "Dosens"`,
        { transaction }
      );
      const freshDosenByNormalizedName = new Map(
        freshDosenRows.map((row) => [normalizeName(row.nama), row])
      );

      // Sinkronisasi jabatan struktural:
      // hanya dosen tertentu yang terisi, selain itu NULL.
      for (const dosen of freshDosenRows) {
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

      const [existingKlasterRows] = await queryInterface.sequelize.query(
        `SELECT "id", "kode" FROM "Klasters"`,
        { transaction }
      );
      const klasterByCode = new Map(
        existingKlasterRows.map((row) => [String(row.kode).toUpperCase(), row])
      );

      const insertKlasters = KLASTER_MASTER.filter(
        (item) => !klasterByCode.has(item.kode)
      ).map((item) => ({
        kode: item.kode,
        nama: item.nama,
        createdAt: now,
        updatedAt: now,
      }));

      if (insertKlasters.length > 0) {
        await queryInterface.bulkInsert("Klasters", insertKlasters, { transaction });
      }

      const [freshKlasterRows] = await queryInterface.sequelize.query(
        `SELECT "id", "kode" FROM "Klasters"`,
        { transaction }
      );
      const freshKlasterByCode = new Map(
        freshKlasterRows.map((row) => [String(row.kode).toUpperCase(), row])
      );

      await queryInterface.bulkDelete("DosenKlasters", null, { transaction });

      const pairGuard = new Set();
      const insertDosenKlasters = [];

      for (const item of DOSEN_KLASTER_MASTER) {
        const dosen = freshDosenByNormalizedName.get(normalizeName(item.nama));
        if (!dosen) continue;

        for (const label of item.klaster) {
          const klasterCode = resolveKlasterCode(label);
          if (!klasterCode) continue;
          const klaster = freshKlasterByCode.get(klasterCode);
          if (!klaster) continue;

          const pairKey = `${dosen.id}-${klaster.id}`;
          if (pairGuard.has(pairKey)) continue;
          pairGuard.add(pairKey);

          insertDosenKlasters.push({
            dosen_id: dosen.id,
            klaster_id: klaster.id,
            createdAt: now,
            updatedAt: now,
          });
        }
      }

      if (insertDosenKlasters.length > 0) {
        await queryInterface.bulkInsert("DosenKlasters", insertDosenKlasters, {
          transaction,
        });
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
      await queryInterface.bulkDelete("DosenKlasters", null, { transaction });
      await queryInterface.bulkDelete(
        "Klasters",
        {
          kode: KLASTER_MASTER.map((item) => item.kode),
        },
        { transaction }
      );
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};

