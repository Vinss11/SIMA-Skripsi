"use strict";

const { Op } = require("sequelize");
const db = require("../models");
const { resolveTrack, resolveProgramStudiCode, resolveActiveGuidanceContext } = require("./guidanceContextService");
const { recalculateCurrentProgressForMahasiswa } = require("./guidanceProgressService");

const MAX_ATTEMPTS = 5;

function policyMatchesAssignment(policy, assignment) {
  const registration = assignment.pendaftaran;
  const academicPeriodId = registration?.periode?.periode_akademik_id || null;
  if (policy.kode_program_studi && String(policy.kode_program_studi).toUpperCase() !== resolveProgramStudiCode(registration)) return false;
  if (policy.program_kuliah && policy.program_kuliah !== registration?.program_kuliah) return false;
  if (policy.jalur && policy.jalur !== resolveTrack(registration)) return false;
  if (policy.periode_akademik_id && Number(policy.periode_akademik_id) !== Number(academicPeriodId)) return false;
  return true;
}

async function enqueueProgressRecalculationJobsForPolicy(policy, transaction) {
  const assignments = await db.PenetapanPembimbing.findAll({
    where: { status: "active", [Op.or]: [{ effective_at: null }, { effective_at: { [Op.lte]: new Date() } }] },
    include: [{ model: db.PendaftaranPenjaluran, as: "pendaftaran", required: true,
      include: [{ model: db.PeriodePenjaluran, as: "periode", required: true }] }], transaction,
  });
  let queued = 0;
  for (const assignment of assignments.filter((item) => policyMatchesAssignment(policy, item))) {
    const hasGuidance = await db.BimbinganSkripsi.count({ where: { mahasiswa_id: assignment.mahasiswa_id,
      pendaftaran_penjaluran_id: assignment.pendaftaran_penjaluran_id, legacy_context_status: "resolved" }, transaction });
    if (!hasGuidance) continue;
    const [, created] = await db.GuidanceProgressRecalculationJob.findOrCreate({
      where: { policy_id: policy.id, mahasiswa_id: assignment.mahasiswa_id,
        cycle_registration_id: assignment.pendaftaran_penjaluran_id, assignment_id: assignment.id },
      defaults: { policy_id: policy.id, mahasiswa_id: assignment.mahasiswa_id,
        cycle_registration_id: assignment.pendaftaran_penjaluran_id, assignment_id: assignment.id,
        status: "pending", attempt_count: 0, available_at: new Date(), result: {} }, transaction,
    });
    if (created) queued += 1;
  }
  return queued;
}

async function processProgressRecalculationJobOnce({ now = new Date() } = {}) {
  let selectedId = null;
  try {
    return await db.sequelize.transaction(async (transaction) => {
      const job = await db.GuidanceProgressRecalculationJob.findOne({ where: { status: "pending", available_at: { [Op.lte]: now } },
        order: [["available_at", "ASC"], ["id", "ASC"]], transaction, lock: transaction.LOCK.UPDATE, skipLocked: true });
      if (!job) return null;
      selectedId = job.id;
      await job.update({ status: "processing", attempt_count: Number(job.attempt_count || 0) + 1, started_at: now,
        last_error_code: null, last_error_message: null }, { transaction });
      const context = await resolveActiveGuidanceContext(job.mahasiswa_id, { transaction, lock: true });
      if (Number(context.registration.id) !== Number(job.cycle_registration_id) || Number(context.assignment.id) !== Number(job.assignment_id)) {
        await job.update({ status: "completed", completed_at: now, result: { skipped: true, reason: "ACTIVE_CONTEXT_CHANGED" } }, { transaction });
        return { job_id: job.id, skipped: true };
      }
      const progress = await recalculateCurrentProgressForMahasiswa(job.mahasiswa_id, transaction);
      await job.update({ status: "completed", completed_at: now, result: { policy_id: progress.policy.id,
        counted: progress.enforcement.counted, required: progress.policy.minimum_validated_sessions } }, { transaction });
      return { job_id: job.id, policy_id: progress.policy.id, counted: progress.enforcement.counted };
    });
  } catch (error) {
    if (selectedId) await db.sequelize.transaction(async (transaction) => {
      const job = await db.GuidanceProgressRecalculationJob.findByPk(selectedId, { transaction, lock: transaction.LOCK.UPDATE });
      if (!job) return;
      const attempts = Number(job.attempt_count || 0) + 1;
      const terminal = attempts >= MAX_ATTEMPTS;
      await job.update({ status: terminal ? "failed" : "pending", attempt_count: attempts,
        available_at: terminal ? job.available_at : new Date(now.getTime() + Math.min(3600, 30 * (2 ** Math.max(attempts - 1, 0))) * 1000),
        last_error_code: error.code || "GUIDANCE_RECALCULATION_FAILED", last_error_message: String(error.message).slice(0, 1000) }, { transaction });
    });
    throw error;
  }
}

module.exports = { MAX_ATTEMPTS, policyMatchesAssignment, enqueueProgressRecalculationJobsForPolicy, processProgressRecalculationJobOnce };
