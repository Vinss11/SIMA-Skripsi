"use strict";

require("dotenv").config();
const {
  sequelize,
  Dosen,
  RiwayatStatusDosen,
  TindakLanjutStatusDosen,
} = require("../models");
const {
  analyzeDosenStatusImpact,
  evaluateDosenStatusFollowUp,
} = require("../services/dosenStatusService");

const execute = process.argv.includes("--execute");

function evaluateRow(row, impact) {
  const currentStatus = row.dosen?.status_keaktifan || row.riwayatStatus?.status_baru || "active";
  const previousStatus = row.riwayatStatus?.status_sebelumnya
    || (row.impact_snapshot?.reactivation_required ? "inactive" : currentStatus);
  return evaluateDosenStatusFollowUp({
    statusBaru: currentStatus,
    statusLama: previousStatus,
    continueExisting: row.dosen?.continue_existing_supervision === true,
    impact,
  });
}

async function reconcile(transaction = null) {
  const rows = await TindakLanjutStatusDosen.findAll({
    where: { status: "open" },
    include: [
      {
        model: Dosen,
        as: "dosen",
        attributes: ["id", "status_keaktifan", "continue_existing_supervision"],
        required: true,
      },
      {
        model: RiwayatStatusDosen,
        as: "riwayatStatus",
        attributes: ["status_sebelumnya", "status_baru"],
        required: false,
      },
    ],
    order: [["dosen_id", "ASC"], ["updatedAt", "DESC"], ["id", "DESC"]],
    transaction,
    lock: transaction
      ? { level: transaction.LOCK.UPDATE, of: TindakLanjutStatusDosen }
      : undefined,
  });

  const grouped = new Map();
  for (const row of rows) {
    const dosenId = Number(row.dosen_id);
    if (!grouped.has(dosenId)) grouped.set(dosenId, []);
    grouped.get(dosenId).push(row);
  }

  const summary = {
    mode: execute ? "execute" : "dry-run",
    open_records: rows.length,
    dosen_with_open_follow_up: grouped.size,
    irrelevant_resolved: 0,
    duplicate_resolved: 0,
    remaining_open: 0,
  };

  for (const dosenRows of grouped.values()) {
    const primary = dosenRows[0];
    const impact = await analyzeDosenStatusImpact(primary.dosen_id, transaction);
    const evaluation = evaluateRow(primary, impact);

    if (!evaluation.required) {
      summary.irrelevant_resolved += dosenRows.length;
      if (execute) {
        for (const row of dosenRows) {
          await row.update({
            status: "resolved",
            catatan_penyelesaian: "Ditutup oleh rekonsiliasi karena tidak terdapat dampak yang memerlukan tindak lanjut.",
            resolution_type: "resolved",
            resolution_decisions: { auto_resolved: true, reason: "no_remaining_follow_up_impact" },
            remaining_impact_snapshot: impact,
            resolved_by_sekretaris_id: null,
            resolved_at: new Date(),
          }, { transaction });
        }
      }
      continue;
    }

    summary.remaining_open += 1;
    const duplicates = dosenRows.slice(1);
    summary.duplicate_resolved += duplicates.length;
    if (execute) {
      for (const duplicate of duplicates) {
        await duplicate.update({
          status: "resolved",
          catatan_penyelesaian: "Ditutup oleh rekonsiliasi karena tindak lanjut aktif dosen dikonsolidasikan ke record terbaru.",
          resolution_type: "resolved",
          resolution_decisions: { auto_resolved: true, reason: "duplicate_open_follow_up" },
          remaining_impact_snapshot: impact,
          resolved_by_sekretaris_id: null,
          resolved_at: new Date(),
        }, { transaction });
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
