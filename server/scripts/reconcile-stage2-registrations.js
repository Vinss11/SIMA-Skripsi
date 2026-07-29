"use strict";

require("dotenv").config();
const { sequelize } = require("../models");

async function main() {
  const execute = process.argv.includes("--execute");
  const [duplicates] = await sequelize.query(`
    SELECT
      mahasiswa_id,
      periode_penjaluran_id,
      COUNT(*)::int AS total,
      ARRAY_AGG(id ORDER BY id) AS registration_ids
    FROM "PendaftaranPenjalurans"
    GROUP BY mahasiswa_id, periode_penjaluran_id
    HAVING COUNT(*) > 1
    ORDER BY mahasiswa_id, periode_penjaluran_id
  `);
  const [invalidTracks] = await sequelize.query(`
    SELECT id, mahasiswa_id, periode_penjaluran_id, jalur, jenis_jalur_diambil
    FROM "PendaftaranPenjalurans"
    WHERE jalur = 'baru'
      AND jenis_jalur_diambil NOT IN ('penelitian', 'magang', 'perintisan_bisnis', 'pengabdian')
  `);

  const report = {
    mode: execute ? "execute" : "dry-run",
    duplicate_student_period_groups: duplicates.length,
    invalid_track_rows: invalidTracks.length,
    duplicates,
    invalid_tracks: invalidTracks,
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (duplicates.length > 0) {
    throw new Error(
      "Rekonsiliasi otomatis dihentikan: duplikat dapat memiliki form/keputusan berbeda dan harus dipilih manual agar tidak kehilangan data."
    );
  }
  if (execute) process.stdout.write("Data lama terverifikasi; tidak ada mutasi destruktif yang diperlukan.\n");
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
