"use strict";

require("dotenv").config();
const { sequelize } = require("../models");

async function main() {
  const execute = process.argv.includes("--execute");
  const [missingRoots] = await sequelize.query(`
    SELECT current.id, current.mahasiswa_id, current.periode_penjaluran_id,
      ARRAY(
        SELECT previous.id FROM "PendaftaranPenjalurans" previous
        JOIN "PeriodePenjalurans" pp ON pp.id = previous.periode_penjaluran_id
        JOIN "PeriodePenjalurans" cp ON cp.id = current.periode_penjaluran_id
        WHERE previous.mahasiswa_id = current.mahasiswa_id
          AND previous.status = 'approved' AND previous.id <> current.id
          AND COALESCE(pp.tanggal_mulai, previous."createdAt") < COALESCE(cp.tanggal_mulai, current."createdAt")
        ORDER BY COALESCE(pp.tanggal_mulai, previous."createdAt") DESC,
          COALESCE(previous.reviewed_at, previous."updatedAt") DESC, previous.id DESC
        LIMIT 2
      ) AS candidates
    FROM "PendaftaranPenjalurans" current
    WHERE current.jalur IN ('ulang', 'alih') AND current.pendaftaran_asal_id IS NULL
    ORDER BY current.id
  `);
  const [guidanceWithoutCycle] = await sequelize.query(`
    SELECT b.id, b.mahasiswa_id, b.pengajuan_id, p.pendaftaran_penjaluran_id AS candidate
    FROM "BimbinganSkripsis" b
    LEFT JOIN "Pengajuans" p ON p.id = b.pengajuan_id
    WHERE b.pendaftaran_penjaluran_id IS NULL
    ORDER BY b.id
  `);
  const [openPamitsWithoutContext] = await sequelize.query(`
    SELECT id, mahasiswa_id, status, periode_tujuan_id, pendaftaran_lama_id,
      penetapan_lama_id, reviewer_p1_id
    FROM "PamitUlangs"
    WHERE status IN ('pending', 'approved') AND (
      periode_tujuan_id IS NULL OR pendaftaran_lama_id IS NULL
      OR penetapan_lama_id IS NULL OR reviewer_p1_id IS NULL
    ) ORDER BY id
  `);
  const safeRoots = missingRoots.filter((row) => Array.isArray(row.candidates) && row.candidates.length === 1);
  const ambiguousRoots = missingRoots.filter((row) => !Array.isArray(row.candidates) || row.candidates.length !== 1);
  const safeGuidance = guidanceWithoutCycle.filter((row) => row.candidate);
  const manualGuidance = guidanceWithoutCycle.filter((row) => !row.candidate);
  const report = {
    mode: execute ? "execute" : "dry-run",
    missing_cycle_roots: missingRoots.length,
    safe_cycle_root_backfills: safeRoots.length,
    ambiguous_cycle_roots: ambiguousRoots,
    guidance_without_cycle: guidanceWithoutCycle.length,
    safe_guidance_backfills: safeGuidance.length,
    guidance_needs_manual_review: manualGuidance,
    open_pamits_needing_manual_review: openPamitsWithoutContext,
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!execute) return;
  await sequelize.transaction(async (transaction) => {
    for (const row of safeRoots) {
      await sequelize.query(
        'UPDATE "PendaftaranPenjalurans" SET pendaftaran_asal_id = :source, "updatedAt" = NOW() WHERE id = :id AND pendaftaran_asal_id IS NULL',
        { replacements: { source: row.candidates[0], id: row.id }, transaction }
      );
    }
    for (const row of safeGuidance) {
      await sequelize.query(
        'UPDATE "BimbinganSkripsis" SET pendaftaran_penjaluran_id = :cycle, "updatedAt" = NOW() WHERE id = :id AND pendaftaran_penjaluran_id IS NULL',
        { replacements: { cycle: row.candidate, id: row.id }, transaction }
      );
    }
  });
  process.stdout.write("Backfill deterministik selesai. Baris ambigu tidak diubah dan tetap tercantum untuk review manual.\n");
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => sequelize.close());
