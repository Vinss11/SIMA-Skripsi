"use strict";

const { Op } = require("sequelize");
const db = require("../models");
const { claimReceipt, completeCommandReceipt } = require("../services/guidanceWorkflowService");
const { getExistingSupervisionPermission } = require("../services/dosenStatusService");
const { enqueueProgressRecalculationJobsForPolicy } = require("../services/guidanceProgressRecalculationService");
const { createSystemNotification } = require("../services/notificationService");
const { NOTIFICATION_TYPES } = require("../constants/notificationTypes");

function fail(res, error) { return res.status(error.status || 500).json({ success: false, code: error.code || "GUIDANCE_GOVERNANCE_ERROR", message: error.message }); }

function governanceError(message, status, code) { const error = new Error(message); error.status = status; error.code = code; return error; }
function isEffective(row, at = new Date()) {
  const timestamp = at.getTime();
  return (!row.effective_at || new Date(row.effective_at).getTime() <= timestamp)
    && (!row.tanggal_mulai || new Date(row.tanggal_mulai).getTime() <= timestamp)
    && (!row.tanggal_selesai || new Date(row.tanggal_selesai).getTime() > timestamp);
}

async function changePolicyStatus({ policyId, action, actorId, expectedVersion, key }) {
  return db.sequelize.transaction(async (transaction) => {
    const payload = { policy_id: Number(policyId), action, expected_version: Number(expectedVersion) };
    const operation = `${action}_guidance_policy`;
    const command = await claimReceipt({ actorType: "sekretaris_prodi", actorId, operation, idempotencyKey: key, payload, transaction });
    if (command.replay) return { row: await db.GuidanceRequirementPolicy.findByPk(command.receipt.aggregate_id, { transaction }), replayed: true, jobsQueued: 0 };
    const row = await db.GuidanceRequirementPolicy.findByPk(policyId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!row) throw governanceError("Policy bimbingan tidak ditemukan.", 404, "GUIDANCE_POLICY_NOT_FOUND");
    if (!Number.isInteger(Number(expectedVersion))) throw governanceError("expected_version wajib dikirim.", 428, "GUIDANCE_PRECONDITION_REQUIRED");
    if (Number(row.row_version) !== Number(expectedVersion)) throw governanceError("Policy telah berubah. Muat ulang sebelum melanjutkan.", 409, "GUIDANCE_VERSION_CONFLICT");
    let jobsQueued = 0;
    if (action === "activate") {
      if (row.status !== "draft") throw governanceError("Hanya policy draft yang dapat diaktifkan.", 409, "GUIDANCE_POLICY_STATE_CONFLICT");
      const sameScope = { kode_program_studi: row.kode_program_studi, program_kuliah: row.program_kuliah, jalur: row.jalur, periode_akademik_id: row.periode_akademik_id };
      const active = await db.GuidanceRequirementPolicy.findOne({ where: { ...sameScope, status: "active", id: { [Op.ne]: row.id } }, transaction, lock: transaction.LOCK.UPDATE });
      if (active) throw governanceError("Masih ada policy aktif pada scope yang sama. Retire policy tersebut terlebih dahulu.", 409, "GUIDANCE_POLICY_ACTIVE_SCOPE_CONFLICT");
      await row.update({ status: "active", effective_at: new Date(), retired_at: null, approved_by_type: "sekretaris_prodi", approved_by_id: actorId, row_version: row.row_version + 1 }, { transaction });
      jobsQueued = await enqueueProgressRecalculationJobsForPolicy(row, transaction);
    } else {
      if (row.status !== "active") throw governanceError("Hanya policy aktif yang dapat di-retire.", 409, "GUIDANCE_POLICY_STATE_CONFLICT");
      await row.update({ status: "retired", retired_at: new Date(), row_version: row.row_version + 1 }, { transaction });
    }
    await completeCommandReceipt({ receipt: command.receipt, aggregateType: "GuidanceRequirementPolicy", aggregateId: row.id, responseStatus: 200,
      responsePayload: { id: row.id, status: row.status, row_version: row.row_version }, transaction });
    return { row, replayed: false, jobsQueued };
  });
}

async function policyStatusHandler(req, res, action) {
  try {
    const key = String(req.get("Idempotency-Key") || "").trim();
    if (!key) throw governanceError("Idempotency-Key wajib dikirim.", 400, "IDEMPOTENCY_KEY_REQUIRED");
    const result = await changePolicyStatus({ policyId: req.params.id, action, actorId: req.user.sekretaris_prodi_id || req.user.id,
      expectedVersion: req.body?.expected_version, key });
    return res.json({ success: true, replayed: result.replayed, data: result.row, recalculation_jobs_queued: result.jobsQueued });
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") return fail(res, governanceError("Masih ada policy aktif pada scope yang sama.", 409, "GUIDANCE_POLICY_ACTIVE_SCOPE_CONFLICT"));
    return fail(res, error);
  }
}

exports.getPolicies = async (req, res) => {
  try { const rows = await db.GuidanceRequirementPolicy.findAll({ order: [["status", "ASC"], ["version", "DESC"]] }); return res.json({ success: true, data: { rows } }); }
  catch (error) { return fail(res, error); }
};

exports.createPolicy = async (req, res) => {
  try {
    const key = String(req.get("Idempotency-Key") || "").trim(); if (!key) return res.status(400).json({ success: false, code: "IDEMPOTENCY_KEY_REQUIRED", message: "Idempotency-Key wajib dikirim." });
    const body = { kode_program_studi: req.body?.kode_program_studi || null, program_kuliah: req.body?.program_kuliah || null,
      jalur: req.body?.jalur || null, periode_akademik_id: req.body?.periode_akademik_id || null,
      minimum_validated_sessions: Number(req.body?.minimum_validated_sessions), count_scope: req.body?.count_scope,
      occurrence_proof_mode: req.body?.occurrence_proof_mode || "approved_resume", supervisor_approval_scope: req.body?.supervisor_approval_scope };
    if (!Number.isInteger(body.minimum_validated_sessions) || body.minimum_validated_sessions < 1) return res.status(400).json({ success: false, code: "GUIDANCE_POLICY_INVALID", message: "Minimum sesi wajib bilangan positif." });
    if (!["cycle", "semester"].includes(body.count_scope) || !["p1", "all_active_supervisors"].includes(body.supervisor_approval_scope)) return res.status(400).json({ success: false, code: "GUIDANCE_POLICY_INVALID", message: "Scope policy tidak valid." });
    const result = await db.sequelize.transaction(async (transaction) => {
      const actorId = req.user.sekretaris_prodi_id || req.user.id;
      const command = await claimReceipt({ actorType: "sekretaris_prodi", actorId, operation: "create_guidance_policy",
        idempotencyKey: key, payload: body, transaction });
      if (command.replay) return { row: await db.GuidanceRequirementPolicy.findByPk(command.receipt.aggregate_id, { transaction }), replayed: true };
      const sameScope = { kode_program_studi: body.kode_program_studi, program_kuliah: body.program_kuliah, jalur: body.jalur, periode_akademik_id: body.periode_akademik_id };
      const active = await db.GuidanceRequirementPolicy.findOne({ where: { ...sameScope, status: "active" }, transaction, lock: transaction.LOCK.UPDATE });
      const version = Number(await db.GuidanceRequirementPolicy.max("version", { where: sameScope, transaction }) || 0) + 1;
      const row = await db.GuidanceRequirementPolicy.create({ ...body, version, status: "draft", effective_at: new Date(), require_p2_if_available: false,
        created_by_type: "sekretaris_prodi", created_by_id: actorId, source: "manual", decision_reference: active ? `supersedes:${active.id}` : null }, { transaction });
      await completeCommandReceipt({ receipt: command.receipt, aggregateType: "GuidanceRequirementPolicy", aggregateId: row.id, responseStatus: 201,
        responsePayload: { id: row.id, version: row.version, status: row.status }, transaction });
      return { row, replayed: false };
    });
    return res.status(result.replayed ? 200 : 201).json({ success: true, replayed: result.replayed, data: result.row });
  } catch (error) { return fail(res, error); }
};

exports.activatePolicy = (req, res) => policyStatusHandler(req, res, "activate");
exports.retirePolicy = (req, res) => policyStatusHandler(req, res, "retire");

exports.getReviewerCandidates = async (req, res) => {
  try {
    const guidance = await db.BimbinganSkripsi.findByPk(req.params.id);
    if (!guidance) throw governanceError("Bimbingan tidak ditemukan.", 404, "GUIDANCE_NOT_FOUND");
    if (guidance.reviewer_resolution_status !== "needs_reviewer_resolution") throw governanceError("Bimbingan tidak sedang menunggu resolusi reviewer.", 409, "GUIDANCE_REVIEWER_RESOLUTION_NOT_REQUIRED");
    const now = new Date();
    const assignments = await db.PenetapanPembimbing.findAll({ where: { mahasiswa_id: guidance.mahasiswa_id,
      pendaftaran_penjaluran_id: guidance.pendaftaran_penjaluran_id, status: "active",
      [Op.and]: [{ [Op.or]: [{ effective_at: null }, { effective_at: { [Op.lte]: now } }] },
        { [Op.or]: [{ tanggal_mulai: null }, { tanggal_mulai: { [Op.lte]: now } }] },
        { [Op.or]: [{ tanggal_selesai: null }, { tanggal_selesai: { [Op.gt]: now } }] }] },
      include: [{ model: db.PenetapanPembimbingDosen, as: "pembimbings", where: { status: "active" },
        include: [{ model: db.Dosen, as: "dosen", attributes: ["id", "nama", "status_keaktifan", "continue_existing_supervision"] }] }] });
    const candidates = assignments.flatMap((assignment) => assignment.pembimbings
      .filter((member) => isEffective(member, now)).map((member) => ({ assignment, member })));
    const eligibility = await Promise.all(candidates.map(async ({ assignment, member }) => ({ assignment, member,
      permission: await getExistingSupervisionPermission(member.dosen_id) })));
    const rows = eligibility.filter(({ permission }) => permission.allowed).map(({ assignment, member }) => ({ id: member.id, assignment_id: assignment.id,
      dosen_id: member.dosen_id, urutan: member.urutan, nama: member.dosen?.nama, master_status: member.dosen?.status_keaktifan }));
    return res.json({ success: true, data: { rows } });
  } catch (error) { return fail(res, error); }
};

exports.getMonitoring = async (req, res) => {
  try {
    const where = {};
    if (req.query.jalur) where.jalur_snapshot = req.query.jalur;
    if (req.query.periode_akademik_id) where.periode_akademik_id = Number(req.query.periode_akademik_id);
    if (req.query.semester_penjaluran_ke) where.semester_penjaluran_ke_snapshot = Number(req.query.semester_penjaluran_ke);
    if (req.query.legacy_context_status) where.legacy_context_status = req.query.legacy_context_status;
    const rows = await db.BimbinganSkripsi.findAll({ where, include: [{ model: db.Mahasiswa, as: "mahasiswa", attributes: ["id", "nim", "nama"] },
      { model: db.Dosen, as: "dosen", attributes: ["id", "nama"] }, { model: db.GuidanceResumeVersion, as: "resumeVersions", attributes: ["id", "version_number", "status", "submitted_at", "reviewed_at"] }],
      order: [["createdAt", "DESC"]], limit: Math.min(200, Number(req.query.limit || 100)) });
    return res.json({ success: true, data: { rows, read_only: true } });
  } catch (error) { return fail(res, error); }
};

exports.resolveReviewer = async (req, res) => {
  try {
    const key = String(req.get("Idempotency-Key") || "").trim(); const expectedVersion = Number(req.body?.expected_version);
    if (!key) return res.status(400).json({ success: false, code: "IDEMPOTENCY_KEY_REQUIRED", message: "Idempotency-Key wajib dikirim." });
    const actorId = req.user.sekretaris_prodi_id || req.user.id; const targetMemberId = Number(req.body?.target_assignment_member_id);
    const result = await db.sequelize.transaction(async (transaction) => {
      const payload = { guidance_id: Number(req.params.id), target_member_id: targetMemberId, expected_version: expectedVersion };
      const command = await claimReceipt({ actorType: "sekretaris_prodi", actorId, operation: "resolve_guidance_reviewer",
        idempotencyKey: key, payload, transaction });
      if (command.replay) return { guidance: await db.BimbinganSkripsi.findByPk(command.receipt.aggregate_id, { transaction }), replayed: true };
      const guidance = await db.BimbinganSkripsi.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!guidance) { const error = new Error("Bimbingan tidak ditemukan."); error.status = 404; error.code = "GUIDANCE_NOT_FOUND"; throw error; }
      if (guidance.reviewer_resolution_status !== "needs_reviewer_resolution") throw governanceError("Bimbingan tidak sedang menunggu resolusi reviewer.", 409, "GUIDANCE_REVIEWER_RESOLUTION_NOT_REQUIRED");
      if (!Number.isInteger(expectedVersion) || expectedVersion !== Number(guidance.row_version)) { const error = new Error("Versi bimbingan tidak sesuai."); error.status = 409; error.code = "GUIDANCE_VERSION_CONFLICT"; throw error; }
      const previousMember = await db.PenetapanPembimbingDosen.findByPk(guidance.effective_reviewer_assignment_member_id, { transaction });
      if (!previousMember) throw governanceError("Konteks reviewer efektif sebelumnya tidak ditemukan.", 409, "GUIDANCE_EFFECTIVE_REVIEWER_CONTEXT_MISSING");
      const member = await db.PenetapanPembimbingDosen.findByPk(targetMemberId, { include: [{ model: db.PenetapanPembimbing, as: "penetapan", required: true }], transaction });
      if (!member || member.status !== "active" || Number(member.penetapan.mahasiswa_id) !== Number(guidance.mahasiswa_id)
        || member.penetapan.status !== "active" || !isEffective(member) || !isEffective(member.penetapan)
        || Number(member.penetapan.pendaftaran_penjaluran_id) !== Number(guidance.pendaftaran_penjaluran_id)) {
        const error = new Error("Reviewer tujuan tidak berada pada assignment aktif di siklus yang sama."); error.status = 409; error.code = "GUIDANCE_TARGET_MISMATCH"; throw error;
      }
      const permission = await getExistingSupervisionPermission(member.dosen_id, transaction);
      if (!permission.allowed) throw governanceError(permission.message || "Status dosen tujuan tidak mengizinkan kelanjutan bimbingan.", 409, "GUIDANCE_REVIEWER_UNAVAILABLE");
      const reasonCode = Number(member.urutan) === Number(previousMember.urutan)
        ? "SAME_ROLE_MANUAL_RESOLUTION"
        : "CROSS_ROLE_FALLBACK_APPROVED_BY_SEKPRODI";
      const before = guidance.row_version; const event = await db.GuidanceEvent.create({ guidance_id: guidance.id, event_type: "reviewer_transferred",
        actor_type: "sekretaris_prodi", actor_id: actorId, actor_role: "sekretaris_prodi", from_state: String(guidance.effective_reviewer_assignment_member_id || ""),
        to_state: String(member.id), assignment_id: member.penetapan_pembimbing_id, assignment_member_id: member.id, occurred_at: new Date(),
        idempotency_key: key, reason_code: reasonCode, metadata: { manual_resolution: true,
          from_urutan: previousMember.urutan, to_urutan: member.urutan } }, { transaction });
      await db.GuidanceReviewerTransfer.create({ guidance_id: guidance.id, from_assignment_id: guidance.effective_reviewer_assignment_id,
        from_assignment_member_id: guidance.effective_reviewer_assignment_member_id, to_assignment_id: member.penetapan_pembimbing_id,
        to_assignment_member_id: member.id, transition_type: "manual_resolution", reason_code: reasonCode,
        effective_at: new Date(), transferred_by_actor_type: "sekretaris_prodi", transferred_by_actor_id: actorId, event_id: event.id,
        row_version_before: before, row_version_after: before + 1 }, { transaction });
      await guidance.update({ effective_reviewer_assignment_id: member.penetapan_pembimbing_id, effective_reviewer_assignment_member_id: member.id,
        reviewer_dosen_id: member.dosen_id, reviewer_resolution_status: "resolved", reviewer_resolution_reason_code: null,
        reassigned_reviewer_at: new Date(), reassigned_by_sekretaris_id: actorId,
        row_version: before + 1 }, { transaction });
      await createSystemNotification({ recipientType: "dosen", recipientId: member.dosen_id, type: NOTIFICATION_TYPES.GUIDANCE_REVIEWER_TRANSFERRED,
        message: "Anda ditetapkan sebagai reviewer efektif untuk menyelesaikan resume bimbingan.", referenceType: "bimbingan", referenceId: guidance.id,
        actionKey: "guidance_resume_task", metadata: { guidance_id: guidance.id }, deduplicationKey: `guidance:${guidance.id}:manual-reviewer:${member.id}`, transaction });
      await createSystemNotification({ recipientType: "mahasiswa", recipientId: guidance.mahasiswa_id, type: NOTIFICATION_TYPES.GUIDANCE_REVIEWER_TRANSFERRED,
        message: "Reviewer resume bimbingan Anda telah ditetapkan dan proses review dapat dilanjutkan.", referenceType: "bimbingan", referenceId: guidance.id,
        actionKey: "guidance_detail", metadata: { guidance_id: guidance.id, reviewer_assignment_member_id: member.id },
        deduplicationKey: `guidance:${guidance.id}:manual-reviewer:mahasiswa:${guidance.mahasiswa_id}:${member.id}`, transaction });
      await completeCommandReceipt({ receipt: command.receipt, aggregateType: "BimbinganSkripsi", aggregateId: guidance.id, responseStatus: 200,
        responsePayload: { id: guidance.id, row_version: guidance.row_version }, transaction });
      return { guidance, replayed: false };
    });
    return res.json({ success: true, replayed: result.replayed, data: result.guidance });
  } catch (error) { return fail(res, error); }
};

exports.invalidateResumeApproval = async (req, res) => {
  try {
    const result = await require("../services/guidanceWorkflowService").invalidateResumeApproval({ guidanceId: req.params.id,
      actorId: req.user.sekretaris_prodi_id || req.user.id, reason: req.body?.reason, expectedVersion: req.body?.expected_version,
      idempotencyKey: req.get("Idempotency-Key") });
    return res.status(result.status).json({ success: true, replayed: result.replayed, data: result.data });
  } catch (error) { return fail(res, error); }
};
