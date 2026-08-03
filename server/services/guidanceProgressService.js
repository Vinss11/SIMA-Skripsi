"use strict";

const crypto = require("crypto");
const { Op } = require("sequelize");
const {
  sequelize,
  GuidanceRequirementPolicy, GuidanceProgressEvaluation, GuidanceProgressSnapshot,
  GuidanceResumeVersion, GuidanceReviewerTransfer, BimbinganSkripsi,
  PenetapanPembimbing, PenetapanPembimbingDosen,
} = require("../models");

const EVALUATOR_VERSION = "stage7-v1";
const DEFAULT_MINIMUM = 8;
const { resolveActiveGuidanceContext } = require("./guidanceContextService");

class GuidanceProgressError extends Error {
  constructor(message, status = 409, code = "GUIDANCE_PROGRESS_ERROR", detail = null) { super(message); this.status = status; this.code = code; this.detail = detail; }
}

async function resolvePolicy({ kodeProgramStudi = null, programKuliah = null, jalur = null, periodeAkademikId = null, at = new Date(), transaction = null } = {}) {
  const candidates = await GuidanceRequirementPolicy.findAll({
    where: { status: "active", effective_at: { [Op.lte]: at }, [Op.or]: [{ retired_at: null }, { retired_at: { [Op.gt]: at } }] },
    transaction,
  });
  const normalizedProgram = String(kodeProgramStudi || "").trim().toUpperCase();
  const ranked = candidates.map((policy) => {
    const isGlobal = !policy.kode_program_studi && !policy.program_kuliah && !policy.jalur && !policy.periode_akademik_id;
    const exactBase = String(policy.kode_program_studi || "").trim().toUpperCase() === normalizedProgram
      && policy.program_kuliah === programKuliah && policy.jalur === jalur;
    if (exactBase && Number(policy.periode_akademik_id) === Number(periodeAkademikId)) return { policy, score: 3 };
    if (exactBase && !policy.periode_akademik_id) return { policy, score: 2 };
    if (isGlobal) return { policy, score: 1 };
    return null;
  }).filter(Boolean).sort((a, b) => b.score - a.score || Number(b.policy.version) - Number(a.policy.version));
  if (!ranked.length) throw new GuidanceProgressError("Kebijakan minimum bimbingan belum tersedia.", 409, "GUIDANCE_POLICY_NOT_FOUND");
  if (ranked[1] && ranked[1].score === ranked[0].score && Number(ranked[1].policy.version) === Number(ranked[0].policy.version)) {
    throw new GuidanceProgressError("Lebih dari satu kebijakan bimbingan aktif memiliki prioritas yang sama.", 409, "GUIDANCE_POLICY_AMBIGUOUS");
  }
  return ranked[0].policy;
}

function validAt(row, at) {
  const instant = new Date(at).getTime();
  if (!Number.isFinite(instant)) return false;
  if (row.tanggal_mulai && new Date(row.tanggal_mulai).getTime() > instant) return false;
  if (row.tanggal_selesai && new Date(row.tanggal_selesai).getTime() < instant) return false;
  return true;
}

async function wasReviewerAuthorizedAt(guidance, resumeVersion, transaction) {
  if (!resumeVersion?.reviewed_by_assignment_member_id) return false;
  const reviewedAt = resumeVersion.reviewed_at || guidance.tanggal_review_resume || resumeVersion.updatedAt;
  if (!reviewedAt) return false;
  const transfers = await GuidanceReviewerTransfer.findAll({
    where: { guidance_id: guidance.id, effective_at: { [Op.lte]: reviewedAt } },
    order: [["effective_at", "ASC"], ["id", "ASC"]], transaction,
  });
  let authorizedMemberId = guidance.target_assignment_member_id;
  for (const transfer of transfers) authorizedMemberId = transfer.to_assignment_member_id;
  if (Number(authorizedMemberId) !== Number(resumeVersion.reviewed_by_assignment_member_id)) return false;
  const member = await PenetapanPembimbingDosen.findByPk(authorizedMemberId, { transaction });
  if (!member || Number(member.dosen_id) !== Number(resumeVersion.reviewed_by_dosen_id) || !validAt(member, reviewedAt)) return false;
  const assignment = await PenetapanPembimbing.findByPk(member.penetapan_pembimbing_id, { transaction });
  return Boolean(assignment && validAt(assignment, reviewedAt));
}

async function evaluationReasonCodes(guidance, resumeVersion, cycleId, transaction) {
  const reasons = [];
  if (Number(guidance.pendaftaran_penjaluran_id) !== Number(cycleId)) reasons.push("WRONG_CYCLE");
  if (!["accepted", "rescheduled"].includes(guidance.request_status || (guidance.status_permohonan === "approved" ? "accepted" : guidance.status_permohonan))) reasons.push("REQUEST_NOT_ACCEPTED");
  if (!guidance.occurred_at) reasons.push("SESSION_NOT_OCCURRED");
  if (!resumeVersion) reasons.push("RESUME_NOT_SUBMITTED");
  else if (resumeVersion.status !== "approved") reasons.push("RESUME_NOT_APPROVED");
  if (guidance.legacy_context_status !== "resolved") reasons.push("LEGACY_CONTEXT_AMBIGUOUS");
  if (resumeVersion?.invalidated_at) reasons.push("INVALIDATED");
  if (resumeVersion?.status === "approved" && !(await wasReviewerAuthorizedAt(guidance, resumeVersion, transaction))) reasons.push("REVIEWER_NOT_AUTHORIZED_AT_DECISION");
  return [...new Set(reasons)];
}

async function evaluateGuidance({ guidance, resumeVersion = null, policy, transaction }) {
  const version = resumeVersion || (guidance.current_resume_version_id ? await GuidanceResumeVersion.findByPk(guidance.current_resume_version_id, { transaction }) : null);
  const reasons = await evaluationReasonCodes(guidance, version, guidance.pendaftaran_penjaluran_id, transaction);
  await GuidanceProgressEvaluation.update({ superseded_at: new Date() }, {
    where: { guidance_id: guidance.id, cycle_registration_id: guidance.pendaftaran_penjaluran_id, superseded_at: null }, transaction,
  });
  const evaluation = await GuidanceProgressEvaluation.create({
    guidance_id: guidance.id, resume_version_id: version?.id || null, policy_id: policy.id,
    policy_version_snapshot: policy.version, cycle_registration_id: guidance.pendaftaran_penjaluran_id,
    periode_akademik_id: guidance.periode_akademik_id, counted: reasons.length === 0, reason_codes: reasons,
    evaluated_at: new Date(), evaluator_version: EVALUATOR_VERSION,
  }, { transaction });
  guidance.is_counted = evaluation.counted;
  guidance.progress_policy_id = policy.id;
  return evaluation;
}

async function resolveProgress({ mahasiswaId, cycleRegistrationId, assignmentId = null, context = {}, transaction = null,
  recalculate = false, persistSnapshot = false }) {
  const policy = await resolvePolicy({ ...context, transaction });
  const rows = await BimbinganSkripsi.findAll({
    where: { mahasiswa_id: mahasiswaId, pendaftaran_penjaluran_id: cycleRegistrationId, legacy_context_status: "resolved" }, transaction,
    lock: recalculate && transaction ? transaction.LOCK.UPDATE : undefined,
  });
  const guidanceIds = rows.map((row) => row.id);
  const resumeIds = rows.map((row) => row.current_resume_version_id).filter(Boolean);
  const [versions, activeEvaluations] = await Promise.all([
    resumeIds.length ? GuidanceResumeVersion.findAll({ where: { id: { [Op.in]: resumeIds } }, transaction }) : [],
    guidanceIds.length ? GuidanceProgressEvaluation.findAll({ where: { guidance_id: { [Op.in]: guidanceIds }, superseded_at: null }, transaction }) : [],
  ]);
  const versionById = new Map(versions.map((version) => [Number(version.id), version]));
  const activeByGuidance = new Map();
  const staleGuidanceIds = [];
  for (const row of rows) {
    let evaluation = activeEvaluations.find((item) => Number(item.guidance_id) === Number(row.id));
    const currentResumeId = row.current_resume_version_id ? Number(row.current_resume_version_id) : null;
    const stale = !evaluation || Number(evaluation.policy_id) !== Number(policy.id)
      || Number(evaluation.policy_version_snapshot) !== Number(policy.version)
      || Number(evaluation.resume_version_id || 0) !== Number(currentResumeId || 0)
      || evaluation.evaluator_version !== EVALUATOR_VERSION;
    if (stale) {
      staleGuidanceIds.push(Number(row.id));
      if (recalculate) {
        evaluation = await evaluateGuidance({ guidance: row, resumeVersion: versionById.get(currentResumeId) || null, policy, transaction });
        await row.save({ transaction, fields: ["is_counted", "progress_policy_id"] });
      }
    }
    if (evaluation) activeByGuidance.set(Number(row.id), evaluation);
  }
  const semesterRows = assignmentId ? rows.filter((row) => Number(row.target_assignment_id) === Number(assignmentId)) : [];
  const count = (items) => items.filter((row) => activeByGuidance.get(Number(row.id))?.counted === true).length;
  const required = Number(policy.minimum_validated_sessions || DEFAULT_MINIMUM);
  const cycleCount = count(rows); const semesterCount = count(semesterRows);
  const selectedCount = policy.count_scope === "semester" ? semesterCount : cycleCount;
  const result = {
    policy: { id: policy.id, version: policy.version, minimum_validated_sessions: required, count_scope: policy.count_scope,
      occurrence_proof_mode: policy.occurrence_proof_mode, supervisor_approval_scope: policy.supervisor_approval_scope,
      require_p2_if_available: Boolean(policy.require_p2_if_available) },
    cycle: { counted: cycleCount, required, remaining: Math.max(0, required - cycleCount), sufficient: cycleCount >= required,
      is_stale: staleGuidanceIds.length > 0 },
    semester: { assignment_id: assignmentId, counted: semesterCount, required, remaining: Math.max(0, required - semesterCount), sufficient: semesterCount >= required,
      is_stale: staleGuidanceIds.length > 0 },
    enforcement: { counted: selectedCount, sufficient: selectedCount >= required, is_stale: staleGuidanceIds.length > 0 },
    evaluation_state: { status: staleGuidanceIds.length > 0 ? "recalculation_required" : "current",
      requires_recalculation: staleGuidanceIds.length > 0, stale_count: staleGuidanceIds.length },
  };
  if (persistSnapshot) {
    const watermark = crypto.createHash("sha256").update(rows.map((row) => {
      const evaluation = activeByGuidance.get(Number(row.id));
      return `${row.id}:${evaluation?.id || 0}:${evaluation?.policy_version_snapshot || 0}:${evaluation?.resume_version_id || 0}:${evaluation?.counted === true}`;
    }).join("|")).digest("hex");
    await GuidanceProgressSnapshot.create({ mahasiswa_id: mahasiswaId, cycle_registration_id: cycleRegistrationId, assignment_id: policy.count_scope === "semester" ? assignmentId : null,
      policy_id: policy.id, policy_version_snapshot: policy.version, counted_total: selectedCount, required_total: required,
      remaining_total: Math.max(0, required - selectedCount), status: selectedCount >= required ? "sufficient" : "insufficient", reason_summary: [], source_watermark: watermark, calculated_at: new Date() }, { transaction });
  }
  return result;
}

async function getProgress(options) {
  return resolveProgress({ ...options, recalculate: false, persistSnapshot: false });
}

async function recalculateProgress(options) {
  if (options.transaction) return resolveProgress({ ...options, recalculate: true });
  return sequelize.transaction((transaction) => resolveProgress({ ...options, transaction, recalculate: true }));
}

async function getCurrentProgressForMahasiswa(mahasiswaId, transaction = null) {
  const context = await resolveActiveGuidanceContext(mahasiswaId, { transaction });
  return getProgress({ mahasiswaId, cycleRegistrationId: context.registration.id, assignmentId: context.assignment.id,
    context: { kodeProgramStudi: context.program.kode_program_studi, programKuliah: context.program.program_kuliah,
      jalur: context.snapshot.jalur_snapshot, periodeAkademikId: context.snapshot.periode_akademik_id }, transaction });
}

async function recalculateCurrentProgressForMahasiswa(mahasiswaId, transaction = null, persistSnapshot = false) {
  const execute = async (activeTransaction) => {
    const context = await resolveActiveGuidanceContext(mahasiswaId, { transaction: activeTransaction, lock: true });
    return recalculateProgress({ mahasiswaId, cycleRegistrationId: context.registration.id, assignmentId: context.assignment.id,
      context: { kodeProgramStudi: context.program.kode_program_studi, programKuliah: context.program.program_kuliah,
        jalur: context.snapshot.jalur_snapshot, periodeAkademikId: context.snapshot.periode_akademik_id },
      transaction: activeTransaction, persistSnapshot });
  };
  if (transaction) return execute(transaction);
  return sequelize.transaction(execute);
}

module.exports = { DEFAULT_MINIMUM, EVALUATOR_VERSION, GuidanceProgressError, resolvePolicy, wasReviewerAuthorizedAt,
  evaluateGuidance, getProgress, recalculateProgress, getCurrentProgressForMahasiswa, recalculateCurrentProgressForMahasiswa };
