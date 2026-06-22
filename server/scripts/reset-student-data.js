"use strict";

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

const { sequelize } = require("../models");

const CONFIRMATION = "RESET_STUDENT_DATA";
const args = new Set(process.argv.slice(2));
const environment = process.env.NODE_ENV || "development";

if (!args.has(`--confirm=${CONFIRMATION}`)) {
  console.error(
    `Reset dibatalkan. Jalankan kembali dengan --confirm=${CONFIRMATION}.`
  );
  process.exit(1);
}

if (environment === "production" && !args.has("--allow-production")) {
  console.error(
    "Reset database production diblokir. Tambahkan --allow-production jika benar-benar diperlukan."
  );
  process.exit(1);
}

const resetTables = [
  "AnggotaKelompokPerintisans",
  "KelompokPerintisanBisnis",
  "JadwalSidangPengujis",
  "KetersediaanPengujiSidangs",
  "PendaftaranSidangs",
  "PeriodeSidangHaris",
  "PeriodeSidangRuangans",
  "PeriodeSidangs",
  "DokumenSidangs",
  "BimbinganSkripsis",
  "IzinLanjutSkripsis",
  "RiwayatPersetujuans",
  "PamitUlangs",
  "Pengajuans",
  "PendaftaranPenjalurans",
  "KlasterKetuaPeriodes",
  "Mahasiswas",
  "PeriodePenjalurans",
];

async function run() {
  const transaction = await sequelize.transaction();
  try {
    const quotedTables = resetTables.map((table) => `"${table}"`).join(", ");
    await sequelize.query(
      `TRUNCATE TABLE ${quotedTables} RESTART IDENTITY CASCADE;`,
      { transaction }
    );

    await sequelize.query(
      `UPDATE "Topiks"
       SET "status" = 'available',
           "updatedAt" = CURRENT_TIMESTAMP
       WHERE "status" <> 'available';`,
      { transaction }
    );

    await transaction.commit();
    console.log("Reset data mahasiswa, pengajuan, dan periode berhasil.");
    console.log("Data master dosen, admin, cluster, topik, dan mitra tetap dipertahankan.");
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    console.error("Reset gagal:", error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

run();
