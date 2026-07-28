"use strict";

require("dotenv").config();
const { Op } = require("sequelize");
const {
  sequelize,
  Mahasiswa,
  PenetapanPembimbing,
  PenetapanPembimbingDosen,
} = require("../models");
const { resolveSemesterPenjaluranKe } = require("../services/penetapanPembimbingService");

const execute = process.argv.includes("--execute");

function memberIds(row) {
  return [...(row.pembimbings || [])]
    .sort((left, right) => Number(left.urutan) - Number(right.urutan))
    .map((item) => Number(item.dosen_id));
}

function sameComposition(left, right) {
  const leftIds = memberIds(left);
  const rightIds = memberIds(right);
  return leftIds.length === rightIds.length && leftIds.every((id, index) => id === rightIds[index]);
}

async function reconcile(transaction = null) {
  const rows = await PenetapanPembimbing.findAll({
    where: { status: { [Op.in]: ["active", "ended"] } },
    include: [{
      model: PenetapanPembimbingDosen,
      as: "pembimbings",
      attributes: ["id", "dosen_id", "urutan", "status", "tanggal_mulai", "tanggal_selesai"],
    }],
    order: [["mahasiswa_id", "ASC"], ["createdAt", "ASC"], ["id", "ASC"]],
    transaction,
    lock: transaction
      ? { level: transaction.LOCK.UPDATE, of: PenetapanPembimbing }
      : undefined,
  });

  const summary = {
    mode: execute ? "execute" : "dry-run",
    total_assignments: rows.length,
    semester_updated: 0,
    source_updated: 0,
    extension_reason_updated: 0,
    active_conflicts: 0,
    missing_primary: 0,
    cache_mismatches: 0,
    cache_updated: 0,
    member_metadata_updated: 0,
  };
  const previousByMahasiswa = new Map();
  const activeByMahasiswa = new Map();

  for (const row of rows) {
    const previous = previousByMahasiswa.get(Number(row.mahasiswa_id)) || null;
    const updates = {};
    const members = [...(row.pembimbings || [])].sort((left, right) => Number(left.urutan) - Number(right.urutan));
    const primary = members.find((item) => Number(item.urutan) === 1) || null;
    if (!primary) summary.missing_primary += 1;
    if (row.status === "active") {
      const existing = activeByMahasiswa.get(Number(row.mahasiswa_id));
      if (existing) summary.active_conflicts += 1;
      else activeByMahasiswa.set(Number(row.mahasiswa_id), { row, primary });
    }
    for (const member of members) {
      const expectedStatus = row.status;
      const startMismatch = String(member.tanggal_mulai || "") !== String(row.tanggal_mulai || "");
      const endMismatch = String(member.tanggal_selesai || "") !== String(row.tanggal_selesai || "");
      if (member.status !== expectedStatus || startMismatch || endMismatch) {
        summary.member_metadata_updated += 1;
        if (execute) {
          await member.update({
            status: expectedStatus,
            tanggal_mulai: row.tanggal_mulai || null,
            tanggal_selesai: row.tanggal_selesai || null,
          }, { transaction });
        }
      }
    }
    if (row.periode_mulai_id) {
      const semester = await resolveSemesterPenjaluranKe(
        row.mahasiswa_id,
        row.pendaftaran_penjaluran_id,
        row.periode_mulai_id,
        transaction
      );
      if (semester && Number(row.semester_penjaluran_ke) !== semester) {
        updates.semester_penjaluran_ke = semester;
        summary.semester_updated += 1;
      }
    }

    if (row.sumber_data !== "legacy_backfill") {
      const expectedSource = !previous
        ? "penjaluran"
        : sameComposition(previous, row)
        ? "perpanjangan"
        : "pergantian";
      if (row.sumber_data !== expectedSource) {
        updates.sumber_data = expectedSource;
        summary.source_updated += 1;
      }
      if (
        previous
        && expectedSource === "perpanjangan"
        && previous.status === "ended"
        && previous.alasan_berakhir !== "Diperbarui untuk periode penjaluran berikutnya."
      ) {
        summary.extension_reason_updated += 1;
        if (execute) {
          await previous.update({
            alasan_berakhir: "Diperbarui untuk periode penjaluran berikutnya.",
          }, { transaction });
        }
      }
    }

    if (execute && Object.keys(updates).length > 0) {
      await row.update(updates, { transaction });
    }
    previousByMahasiswa.set(Number(row.mahasiswa_id), row);
  }

  for (const [mahasiswaId, activeEntry] of activeByMahasiswa.entries()) {
    if (!activeEntry.primary) continue;
    const mahasiswa = await Mahasiswa.findByPk(mahasiswaId, {
      attributes: ["id", "dosen_pembimbing_skripsi_id"],
      transaction,
      lock: transaction ? transaction.LOCK.UPDATE : undefined,
    });
    if (!mahasiswa) continue;
    if (Number(mahasiswa.dosen_pembimbing_skripsi_id || 0) !== Number(activeEntry.primary.dosen_id)) {
      summary.cache_mismatches += 1;
      if (execute) {
        await mahasiswa.update({
          dosen_pembimbing_skripsi_id: activeEntry.primary.dosen_id,
        }, { transaction });
        summary.cache_updated += 1;
      }
    }
  }

  return summary;
}

async function run() {
  const summary = execute
    ? await sequelize.transaction((transaction) => reconcile(transaction))
    : await reconcile();
  console.log(JSON.stringify(summary, null, 2));
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
