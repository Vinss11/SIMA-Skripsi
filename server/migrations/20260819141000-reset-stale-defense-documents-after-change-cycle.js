"use strict";

const fs = require("node:fs");
const path = require("node:path");

const DOCUMENT_PREFIXES = ["transkrip", "cept", "draft_skripsi"];
const SERVER_ROOT_DIR = path.resolve(__dirname, "..");
const SIDANG_UPLOAD_ROOT = process.env.VERCEL
  ? path.join("/tmp", "uploads", "sidang-dokumen")
  : path.join(SERVER_ROOT_DIR, "uploads", "sidang-dokumen");

function cleanupStoredFiles(storedPaths) {
  const uploadRoot = path.resolve(SIDANG_UPLOAD_ROOT);
  for (const storedPath of new Set(storedPaths.filter(Boolean))) {
    const absolutePath = path.resolve(SERVER_ROOT_DIR, String(storedPath));
    if (absolutePath !== uploadRoot && !absolutePath.startsWith(`${uploadRoot}${path.sep}`)) continue;
    try {
      if (fs.existsSync(absolutePath)) fs.unlinkSync(absolutePath);
    } catch (error) {
      console.error(`Gagal membersihkan dokumen sidang lama ${storedPath}:`, error.message);
    }
  }
}

const ACTIVE_CHANGE_CTE = `
  WITH active_change AS (
    SELECT DISTINCT ON (assignment.mahasiswa_id)
      assignment.mahasiswa_id,
      COALESCE(
        assignment.activated_at,
        assignment.effective_at,
        assignment.tanggal_mulai,
        assignment."createdAt"
      ) AS cycle_started_at
    FROM "PenetapanPembimbings" assignment
    INNER JOIN "PendaftaranPenjalurans" registration
      ON registration.id = assignment.pendaftaran_penjaluran_id
    WHERE assignment.status::text = 'active'
      AND registration.jalur::text IN ('ulang', 'alih')
    ORDER BY assignment.mahasiswa_id,
      COALESCE(
        assignment.activated_at,
        assignment.effective_at,
        assignment.tanggal_mulai,
        assignment."createdAt"
      ) DESC,
      assignment.id DESC
  )
`;

function isStale(uploadedAt, cycleStartedAt) {
  return !uploadedAt || new Date(uploadedAt).getTime() < new Date(cycleStartedAt).getTime();
}

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [rows] = await queryInterface.sequelize.query(`${ACTIVE_CHANGE_CTE}
        SELECT documents.*, active_change.cycle_started_at
        FROM "DokumenSidangs" documents
        INNER JOIN active_change ON active_change.mahasiswa_id = documents.mahasiswa_id
      `, { transaction });

      const staleStoredPaths = [];
      for (const row of rows) {
        for (const prefix of DOCUMENT_PREFIXES) {
          if (isStale(row[`${prefix}_uploaded_at`], row.cycle_started_at)) {
            staleStoredPaths.push(row[`${prefix}_file_path`]);
          }
        }
      }

      const assignments = DOCUMENT_PREFIXES.flatMap((prefix) => {
        const stale = `(documents.${prefix}_uploaded_at IS NULL OR documents.${prefix}_uploaded_at < active_change.cycle_started_at)`;
        return [
          `${prefix}_file_path = CASE WHEN ${stale} THEN NULL ELSE documents.${prefix}_file_path END`,
          `${prefix}_file_name = CASE WHEN ${stale} THEN NULL ELSE documents.${prefix}_file_name END`,
          `${prefix}_status = CASE WHEN ${stale} THEN 'belum_upload' ELSE documents.${prefix}_status END`,
          `${prefix}_uploaded_at = CASE WHEN ${stale} THEN NULL ELSE documents.${prefix}_uploaded_at END`,
          `${prefix}_review_note = CASE WHEN ${stale} THEN NULL ELSE documents.${prefix}_review_note END`,
          `${prefix}_reviewed_at = CASE WHEN ${stale} THEN NULL ELSE documents.${prefix}_reviewed_at END`,
        ];
      });

      await queryInterface.sequelize.query(`${ACTIVE_CHANGE_CTE}
        UPDATE "DokumenSidangs" documents
        SET ${assignments.join(",\n            ")},
            "updatedAt" = NOW()
        FROM active_change
        WHERE active_change.mahasiswa_id = documents.mahasiswa_id
      `, { transaction });

      if (staleStoredPaths.some(Boolean)) {
        transaction.afterCommit(() => cleanupStoredFiles(staleStoredPaths));
      }
    });
  },

  async down() {
    // Dokumen dan hasil review lama sengaja tidak dipulihkan ke siklus baru.
  },
};
