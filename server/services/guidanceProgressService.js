"use strict";

const db = require("../models");
const { resolveActiveGuidanceContext } = require("./guidanceContextService");

const DEFAULT_MINIMUM = 8;
const EVALUATOR_VERSION = "core-v1";

class GuidanceProgressError extends Error {
  constructor(message, status = 409, code = "GUIDANCE_PROGRESS_ERROR") { super(message); this.status = status; this.code = code; }
}

function policy() {
  return {
    id: null,
    version: 1,
    minimum_validated_sessions: DEFAULT_MINIMUM,
    count_scope: "cycle",
    occurrence_proof_mode: "approved_resume",
    supervisor_approval_scope: "effective_reviewer",
    require_p2_if_available: false,
  };
}

async function resolvePolicy() { return policy(); }

async function getProgress({ mahasiswaId, cycleRegistrationId, assignmentId = null, transaction = null }) {
  const rows = await db.BimbinganSkripsi.findAll({
    where: { mahasiswa_id: mahasiswaId, pendaftaran_penjaluran_id: cycleRegistrationId, legacy_context_status: "resolved" },
    attributes: ["id", "target_assignment_id", "is_counted"],
    transaction: transaction || undefined,
  });
  const cycleCount = rows.filter((row) => row.is_counted === true).length;
  const semesterCount = rows.filter((row) => row.is_counted === true && Number(row.target_assignment_id) === Number(assignmentId)).length;
  const required = DEFAULT_MINIMUM;
  return {
    policy: policy(),
    cycle: { counted: cycleCount, required, remaining: Math.max(0, required - cycleCount), sufficient: cycleCount >= required, is_stale: false },
    semester: { assignment_id: assignmentId, counted: semesterCount, required, remaining: Math.max(0, required - semesterCount), sufficient: semesterCount >= required, is_stale: false },
    enforcement: { counted: cycleCount, sufficient: cycleCount >= required, is_stale: false },
    evaluation_state: { status: "current", requires_recalculation: false, stale_count: 0 },
  };
}

async function recalculateProgress(options) { return getProgress(options); }

async function getCurrentProgressForMahasiswa(mahasiswaId, transaction = null) {
  const context = await resolveActiveGuidanceContext(mahasiswaId, { transaction });
  return getProgress({ mahasiswaId, cycleRegistrationId: context.registration.id, assignmentId: context.assignment.id, transaction });
}

async function recalculateCurrentProgressForMahasiswa(mahasiswaId, transaction = null) {
  return getCurrentProgressForMahasiswa(mahasiswaId, transaction);
}

async function evaluateGuidance({ guidance }) {
  guidance.is_counted = guidance.status_resume === "approved";
  return { guidance_id: guidance.id, counted: guidance.is_counted, reason_codes: guidance.is_counted ? [] : ["RESUME_NOT_APPROVED"] };
}

async function wasReviewerAuthorizedAt() { return true; }

module.exports = { DEFAULT_MINIMUM, EVALUATOR_VERSION, GuidanceProgressError, resolvePolicy, wasReviewerAuthorizedAt,
  evaluateGuidance, getProgress, recalculateProgress, getCurrentProgressForMahasiswa, recalculateCurrentProgressForMahasiswa };
