"use strict";

require("dotenv").config();
const { Op } = require("sequelize");
const {
  sequelize,
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
      attributes: ["dosen_id", "urutan"],
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
  };
  const previousByMahasiswa = new Map();

  for (const row of rows) {
    const previous = previousByMahasiswa.get(Number(row.mahasiswa_id)) || null;
    const updates = {};
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
