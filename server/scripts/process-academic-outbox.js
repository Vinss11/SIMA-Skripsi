"use strict";

process.env.NODE_ENV = process.env.NODE_ENV || "development";
require("dotenv").config();

const { Op } = require("sequelize");
const db = require("../models");
const academic = require("../services/academicDataService");

const MAX_ATTEMPTS = 5;

async function processAcademicOutboxOnce({ now = new Date() } = {}) {
  let selectedId = null;
  try {
    return await db.sequelize.transaction(async (transaction) => {
      const outbox = await db.OutboxAkademik.findOne({
        where: { event_type: { [Op.in]: ["academic.snapshot.requested", "academic.import.committed", "academic.correction.created"] },
          status: "pending", available_at: { [Op.lte]: now } },
        order: [["available_at", "ASC"], ["id", "ASC"]], transaction, lock: transaction.LOCK.UPDATE, skipLocked: true,
      });
      if (!outbox) return null;
      selectedId = outbox.id;
      await outbox.update({ status: "processing", attempt_count: Number(outbox.attempt_count || 0) + 1 }, { transaction });
      if (["academic.import.committed", "academic.correction.created"].includes(outbox.event_type)) {
        await outbox.update({ status: "processed", processed_at: now, last_error: null }, { transaction });
        return { outbox_id: outbox.id, event_type: outbox.event_type, audit_only: true };
      }
      const job = await db.PekerjaanSnapshotAkademik.findByPk(outbox.payload?.job_id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!job) throw Object.assign(new Error("Snapshot job tidak ditemukan."), { code: "ACADEMIC_SNAPSHOT_JOB_NOT_FOUND" });
      if (job.status === "completed") {
        await outbox.update({ status: "processed", processed_at: now, last_error: null }, { transaction });
        return { outbox_id: outbox.id, job_id: job.id, replayed: true };
      }
      await job.update({ status: "processing", attempt_count: Number(job.attempt_count || 0) + 1,
        last_error_code: null, last_error_message: null, next_retry_at: null }, { transaction });
      const result = await academic.calculateSnapshot(job.mahasiswa_id, { transaction, periodId: outbox.payload?.period_id || null });
      await job.update({ status: "completed", completed_at: now }, { transaction });
      await outbox.update({ status: "processed", processed_at: now, last_error: null }, { transaction });
      return { outbox_id: outbox.id, job_id: job.id, snapshot_id: result.snapshot.id, replayed: result.noop === true };
    });
  } catch (error) {
    if (selectedId) await db.sequelize.transaction(async (transaction) => {
      const outbox = await db.OutboxAkademik.findByPk(selectedId, { transaction, lock: transaction.LOCK.UPDATE });
      if (!outbox) return;
      const attempts = Number(outbox.attempt_count || 0) + 1;
      const terminal = attempts >= MAX_ATTEMPTS;
      const nextRetry = terminal ? null : new Date(now.getTime() + Math.min(3600, 30 * (2 ** Math.max(attempts - 1, 0))) * 1000);
      await outbox.update({ status: terminal ? "failed" : "pending", attempt_count: attempts,
        available_at: nextRetry || outbox.available_at, last_error: String(error.message).slice(0, 500) }, { transaction });
      const job = outbox.payload?.job_id ? await db.PekerjaanSnapshotAkademik.findByPk(outbox.payload.job_id, { transaction, lock: transaction.LOCK.UPDATE }) : null;
      if (job) await job.update({ status: terminal ? "failed" : "queued", next_retry_at: nextRetry,
        last_error_code: error.code || "ACADEMIC_SNAPSHOT_FAILED", last_error_message: String(error.message).slice(0, 500) }, { transaction });
    });
    throw error;
  }
}

async function main() {
  const once = process.argv.includes("--once");
  do {
    let result;
    do { result = await processAcademicOutboxOnce(); } while (result);
    if (once) break;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  } while (true);
}

if (require.main === module) main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => db.sequelize.close());

module.exports = { MAX_ATTEMPTS, processAcademicOutboxOnce };
