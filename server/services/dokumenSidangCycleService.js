"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { Op } = require("sequelize");
const { DokumenSidang } = require("../models");

const SERVER_ROOT_DIR = path.resolve(__dirname, "..");
const SIDANG_UPLOAD_ROOT = process.env.VERCEL
  ? path.join("/tmp", "uploads", "sidang-dokumen")
  : path.join(SERVER_ROOT_DIR, "uploads", "sidang-dokumen");

const DOCUMENT_PREFIXES = ["transkrip", "cept", "draft_skripsi", "paper"];

function isUlangOrAlih(registration) {
  return ["ulang", "alih"].includes(String(registration?.jalur || "").trim().toLowerCase());
}

function resetValues() {
  return DOCUMENT_PREFIXES.reduce((values, prefix) => ({
    ...values,
    [`${prefix}_file_path`]: null,
    [`${prefix}_file_name`]: null,
    [`${prefix}_status`]: "belum_upload",
    [`${prefix}_uploaded_at`]: null,
    [`${prefix}_review_note`]: null,
    [`${prefix}_reviewed_at`]: null,
  }), {});
}

function resolveStoredFilePath(storedPath) {
  if (!storedPath) return null;
  const absolutePath = path.resolve(SERVER_ROOT_DIR, String(storedPath));
  const uploadRoot = path.resolve(SIDANG_UPLOAD_ROOT);
  if (absolutePath !== uploadRoot && !absolutePath.startsWith(`${uploadRoot}${path.sep}`)) return null;
  return absolutePath;
}

function cleanupStoredFiles(storedPaths) {
  for (const storedPath of new Set(storedPaths.filter(Boolean))) {
    const absolutePath = resolveStoredFilePath(storedPath);
    if (!absolutePath) continue;
    try {
      if (fs.existsSync(absolutePath)) fs.unlinkSync(absolutePath);
    } catch (error) {
      console.error(`Gagal membersihkan dokumen sidang lama ${storedPath}:`, error.message);
    }
  }
}

async function resetDokumenSidangForNewCycle({ mahasiswaIds, transaction }) {
  const normalizedIds = [...new Set((mahasiswaIds || []).map(Number).filter(Number.isInteger))];
  if (!normalizedIds.length) return { resetCount: 0, storedPaths: [] };

  const rows = await DokumenSidang.findAll({
    where: { mahasiswa_id: { [Op.in]: normalizedIds } },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  const storedPaths = rows.flatMap((row) => DOCUMENT_PREFIXES.map((prefix) => row[`${prefix}_file_path`]));

  if (rows.length) {
    await DokumenSidang.update(resetValues(), {
      where: { id: { [Op.in]: rows.map((row) => row.id) } },
      transaction,
    });
  }

  if (storedPaths.some(Boolean)) {
    transaction.afterCommit(() => cleanupStoredFiles(storedPaths));
  }
  return { resetCount: rows.length, storedPaths: storedPaths.filter(Boolean) };
}

module.exports = {
  DOCUMENT_PREFIXES,
  isUlangOrAlih,
  resetDokumenSidangForNewCycle,
};
