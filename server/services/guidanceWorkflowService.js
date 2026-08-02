"use strict";

const crypto = require("crypto");
const { Op } = require("sequelize");
const db = require("../models");
const { resolveActiveGuidanceContext, resolveProgramStudiCode } = require("./guidanceContextService");
const { resolvePolicy, evaluateGuidance } = require("./guidanceProgressService");
const { getExistingSupervisionPermission } = require("./dosenStatusService");
const { createSystemNotification } = require("./notificationService");
const { NOTIFICATION_TYPES } = require("../constants/notificationTypes");

class GuidanceWorkflowError extends Error {
  constructor(message, status = 409, code = "GUIDANCE_WORKFLOW_ERROR", detail = null) { super(message); this.status = status; this.code = code; this.detail = detail; }
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value === undefined ? null : value;
}
function fingerprint(payload) { return crypto.createHash("sha256").update(JSON.stringify(canonical(payload))).digest("hex"); }
function contentHash(value) { return crypto.createHash("sha256").update(String(value)).digest("hex"); }
function requireKey(value) {
  const key = String(value || "").trim();
  if (!key) throw new GuidanceWorkflowError("Idempotency-Key wajib dikirim.", 400, "IDEMPOTENCY_KEY_REQUIRED");
  if (key.length > 160) throw new GuidanceWorkflowError("Idempotency-Key terlalu panjang.", 400, "IDEMPOTENCY_KEY_INVALID");
  return key;
}
function scheduledAt(date, time) { const result = new Date(`${date}T${time}:00+07:00`); return Number.isNaN(result.getTime()) ? null : result; }
function publicGuidance(row) {
  const x = row?.toJSON ? row.toJSON() : row;
  return { ...x, status_permohonan: x.request_status === "accepted" ? "approved" : x.request_status === "withdrawn" ? "expired" : (x.request_status || x.status_permohonan) };
}

async function claimReceipt({ actorType, actorId, operation, idempotencyKey, payload, transaction }) {
  const key = requireKey(idempotencyKey); const requestFingerprint = fingerprint(payload);
  const where = { actor_type: actorType, actor_id: actorId, operation, idempotency_key: key };
  const [claimed, created] = await db.GuidanceCommandReceipt.findOrCreate({
    where,
    defaults: { ...where, request_fingerprint: requestFingerprint, status: "processing", response_payload_minimal: {} },
    transaction,
  });
  if (!created) {
    const existing = await db.GuidanceCommandReceipt.findOne({ where, transaction, lock: transaction.LOCK.UPDATE });
    if (existing.request_fingerprint !== requestFingerprint) throw new GuidanceWorkflowError("Idempotency-Key telah digunakan untuk payload berbeda.", 409, "IDEMPOTENCY_CONFLICT");
    if (existing.status === "completed") return { replay: true, status: existing.response_status, payload: existing.response_payload_minimal, receipt: existing };
    throw new GuidanceWorkflowError("Perintah identik masih diproses.", 409, "GUIDANCE_COMMAND_IN_PROGRESS");
  }
  return { replay: false, key, receipt: claimed };
}
async function completeReceipt(receipt, aggregateId, responseStatus, data, transaction) {
  const minimal = { id: Number(data.id || aggregateId), row_version: data.row_version || null, request_status: data.request_status || null,
    status_resume: data.status_resume || null, replayed: true };
  await receipt.update({ status: "completed", aggregate_type: "BimbinganSkripsi", aggregate_id: String(aggregateId), response_status: responseStatus,
    response_payload_minimal: minimal, completed_at: new Date() }, { transaction });
}
async function completeCommandReceipt({ receipt, aggregateType, aggregateId, responseStatus, responsePayload, transaction }) {
  await receipt.update({ status: "completed", aggregate_type: aggregateType, aggregate_id: String(aggregateId), response_status: responseStatus,
    response_payload_minimal: responsePayload || { id: Number(aggregateId) }, completed_at: new Date() }, { transaction });
}
async function event({ guidanceId, type, actorType, actorId, role, from, to, assignmentId, memberId, key, reason, metadata = {}, transaction }) {
  return db.GuidanceEvent.create({ guidance_id: guidanceId, event_type: type, actor_type: actorType, actor_id: actorId, actor_role: role,
    from_state: from, to_state: to, assignment_id: assignmentId, assignment_member_id: memberId, occurred_at: new Date(),
    idempotency_key: key, reason_code: reason, metadata }, { transaction });
}
function assertVersion(row, expectedVersion) {
  if (expectedVersion == null || !Number.isInteger(Number(expectedVersion))) throw new GuidanceWorkflowError("expected_version wajib dikirim.", 428, "GUIDANCE_PRECONDITION_REQUIRED");
  if (Number(row.row_version) !== Number(expectedVersion)) throw new GuidanceWorkflowError("Data bimbingan telah berubah. Muat ulang sebelum melanjutkan.", 409, "GUIDANCE_VERSION_CONFLICT", { current_version: row.row_version });
}
function isEffectiveAt(assignment, member, at = new Date()) {
  const timestamp = at.getTime();
  const starts = [assignment.effective_at, assignment.tanggal_mulai, member.tanggal_mulai].filter(Boolean)
    .every((value) => new Date(value).getTime() <= timestamp);
  const ends = [assignment.tanggal_selesai, member.tanggal_selesai].filter(Boolean)
    .every((value) => new Date(value).getTime() > timestamp);
  return starts && ends;
}

async function assertEffectiveReviewerCapability(row, dosenId, transaction) {
  const member = await db.PenetapanPembimbingDosen.findByPk(row.effective_reviewer_assignment_member_id, { transaction, lock: transaction.LOCK.UPDATE });
  if (!member || Number(member.dosen_id) !== Number(dosenId) || Number(member.penetapan_pembimbing_id) !== Number(row.effective_reviewer_assignment_id)) {
    throw new GuidanceWorkflowError("Hanya reviewer efektif yang dapat memproses bimbingan ini.", 403, "GUIDANCE_REVIEWER_NOT_AUTHORIZED");
  }
  const assignment = await db.PenetapanPembimbing.findByPk(row.effective_reviewer_assignment_id, { transaction, lock: transaction.LOCK.UPDATE });
  if (!assignment || assignment.status !== "active" || member.status !== "active" || !isEffectiveAt(assignment, member)) {
    throw new GuidanceWorkflowError("Assignment reviewer tidak aktif atau belum efektif.", 409, "GUIDANCE_REVIEWER_ASSIGNMENT_INACTIVE");
  }
  const permission = await getExistingSupervisionPermission(dosenId, transaction);
  if (!permission.allowed) {
    throw new GuidanceWorkflowError(permission.message || "Status dosen tidak mengizinkan kelanjutan bimbingan.", 403,
      "GUIDANCE_REVIEWER_CAPABILITY_DENIED", { dosen_id: Number(dosenId), status_keaktifan: permission.dosen?.status_keaktifan || null });
  }
  return member;
}

const assertReviewer = assertEffectiveReviewerCapability;

async function createRequest({ mahasiswaId, targetMemberId = null, targetDosenId = null, pesan, tanggal, jam, idempotencyKey }) {
  return db.sequelize.transaction(async (transaction) => {
    const payload = { targetMemberId, targetDosenId, pesan, tanggal, jam };
    const receiptState = await claimReceipt({ actorType: "mahasiswa", actorId: mahasiswaId, operation: "create_request", idempotencyKey, payload, transaction });
    if (receiptState.replay) return { status: receiptState.status, data: receiptState.payload, replayed: true };
    const context = await resolveActiveGuidanceContext(mahasiswaId, { targetMemberId, targetDosenId, transaction, lock: true });
    if (!context.member) throw new GuidanceWorkflowError("Pembimbing tujuan wajib dipilih.", 400, "GUIDANCE_TARGET_REQUIRED");
    const targetPermission = await getExistingSupervisionPermission(context.member.dosen_id, transaction);
    if (!targetPermission.allowed) throw new GuidanceWorkflowError(targetPermission.message || "Dosen tujuan tidak dapat melanjutkan bimbingan.", 409,
      "GUIDANCE_REVIEWER_UNAVAILABLE", { dosen_id: context.member.dosen_id, status_keaktifan: targetPermission.dosen?.status_keaktifan || null });
    const at = scheduledAt(tanggal, jam); if (!at || at <= new Date()) throw new GuidanceWorkflowError("Jadwal bimbingan harus berada di masa depan.", 400, "GUIDANCE_SCHEDULE_INVALID");
    const duplicate = await db.BimbinganSkripsi.findOne({ where: { mahasiswa_id: mahasiswaId, pendaftaran_penjaluran_id: context.registration.id,
      scheduled_at: at, request_status: { [Op.in]: ["pending", "accepted", "rescheduled"] } }, transaction, lock: transaction.LOCK.UPDATE });
    if (duplicate) throw new GuidanceWorkflowError("Slot bimbingan pada siklus ini sudah digunakan.", 409, "GUIDANCE_DUPLICATE_SLOT");
    const row = await db.BimbinganSkripsi.create({ mahasiswa_id: mahasiswaId, dosen_id: context.member.dosen_id,
      penetapan_pembimbing_id: context.assignment.id, ...context.snapshot, permintaan_pesan: String(pesan).trim(),
      permintaan_tanggal: tanggal, permintaan_jam: jam, scheduled_at: at, status_permohonan: "pending", request_status: "pending",
      status_resume: "belum_diisi", legacy_context_status: "resolved", row_version: 1 }, { transaction });
    await event({ guidanceId: row.id, type: "request_created", actorType: "mahasiswa", actorId: mahasiswaId, role: "mahasiswa", to: "pending",
      assignmentId: context.assignment.id, memberId: context.member.id, key: receiptState.key, transaction });
    await createSystemNotification({ recipientType: "dosen", recipientId: context.member.dosen_id, type: NOTIFICATION_TYPES.GUIDANCE_REQUESTED_LECTURER,
      message: "Ada permohonan bimbingan baru yang perlu Anda tinjau.", referenceType: "bimbingan", referenceId: row.id,
      actionKey: "guidance_task", metadata: { guidance_id: row.id }, deduplicationKey: `guidance:${row.id}:request-created:dosen:${context.member.dosen_id}`, transaction });
    await completeReceipt(receiptState.receipt, row.id, 201, row, transaction);
    return { status: 201, data: publicGuidance(row), replayed: false };
  });
}

async function decideRequest({ guidanceId, dosenId, action, catatan, tanggal, jam, lokasi, expectedVersion, idempotencyKey }) {
  return db.sequelize.transaction(async (transaction) => {
    const payload = { guidanceId, action, catatan, tanggal, jam, lokasi, expectedVersion };
    const state = await claimReceipt({ actorType: "dosen", actorId: dosenId, operation: `request_${action}`, idempotencyKey, payload, transaction });
    if (state.replay) return { status: state.status, data: state.payload, replayed: true };
    const row = await db.BimbinganSkripsi.findByPk(guidanceId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!row) throw new GuidanceWorkflowError("Data bimbingan tidak ditemukan.", 404, "GUIDANCE_NOT_FOUND");
    assertVersion(row, expectedVersion); await assertReviewer(row, dosenId, transaction);
    if (row.request_status !== "pending") throw new GuidanceWorkflowError("Permohonan sudah diproses.", 409, "GUIDANCE_STATE_CONFLICT");
    let next; const previous = row.request_status;
    if (action === "reject") { if (String(catatan || "").trim().length < 5) throw new GuidanceWorkflowError("Alasan penolakan minimal 5 karakter.", 400, "GUIDANCE_REJECTION_REASON_REQUIRED"); next = "rejected"; row.status_permohonan = "rejected"; }
    else {
      const at = scheduledAt(tanggal, jam); if (!at || at < new Date()) throw new GuidanceWorkflowError("Jadwal keputusan tidak valid.", 400, "GUIDANCE_SCHEDULE_INVALID");
      const changed = row.scheduled_at && new Date(row.scheduled_at).getTime() !== at.getTime(); next = changed ? "rescheduled" : "accepted";
      row.status_permohonan = next === "accepted" ? "approved" : "rescheduled"; row.permintaan_tanggal = tanggal; row.permintaan_jam = jam;
      row.scheduled_at = at; row.lokasi_bimbingan = String(lokasi || "").trim() || null;
    }
    row.request_status = next; row.catatan_dosen = String(catatan || "").trim() || null; row.request_decided_at = new Date(); row.tanggal_keputusan = row.request_decided_at; row.row_version += 1;
    await row.save({ transaction });
    await event({ guidanceId: row.id, type: next === "accepted" ? "request_accepted" : next === "rescheduled" ? "request_rescheduled" : "request_rejected",
      actorType: "dosen", actorId: dosenId, role: "dosen", from: previous, to: next, assignmentId: row.effective_reviewer_assignment_id,
      memberId: row.effective_reviewer_assignment_member_id, key: state.key, transaction });
    await createSystemNotification({ recipientType: "mahasiswa", recipientId: row.mahasiswa_id, type: NOTIFICATION_TYPES.GUIDANCE_REQUEST_DECIDED_STUDENT,
      message: next === "rejected" ? "Permohonan bimbingan Anda ditolak. Lihat detail untuk alasannya." : "Jadwal bimbingan Anda telah dikonfirmasi.",
      referenceType: "bimbingan", referenceId: row.id, actionKey: "guidance_detail", metadata: { guidance_id: row.id, decision: next },
      deduplicationKey: `guidance:${row.id}:request-${next}:mahasiswa:${row.mahasiswa_id}`, transaction });
    await completeReceipt(state.receipt, row.id, 200, row, transaction); return { status: 200, data: publicGuidance(row), replayed: false };
  });
}

async function submitResumeVersion({ guidanceId, mahasiswaId, resume, expectedVersion, idempotencyKey }) {
  return db.sequelize.transaction(async (transaction) => {
    const payload = { guidanceId, resume, expectedVersion }; const state = await claimReceipt({ actorType: "mahasiswa", actorId: mahasiswaId, operation: "submit_resume", idempotencyKey, payload, transaction });
    if (state.replay) return { status: state.status, data: state.payload, replayed: true };
    const row = await db.BimbinganSkripsi.findOne({ where: { id: guidanceId, mahasiswa_id: mahasiswaId }, transaction, lock: transaction.LOCK.UPDATE });
    if (!row) throw new GuidanceWorkflowError("Data bimbingan tidak ditemukan.", 404, "GUIDANCE_NOT_FOUND"); assertVersion(row, expectedVersion);
    if (!["accepted", "rescheduled"].includes(row.request_status)) throw new GuidanceWorkflowError("Resume hanya dapat dikirim untuk sesi yang disetujui.", 409, "GUIDANCE_STATE_CONFLICT");
    if (!row.scheduled_at || new Date(row.scheduled_at) > new Date()) throw new GuidanceWorkflowError("Resume belum dapat dikirim sebelum sesi dimulai.", 409, "WAITING_SESSION_START");
    if (!["belum_diisi", "revisi", "revision_required"].includes(row.status_resume)) throw new GuidanceWorkflowError("Resume saat ini tidak dapat direvisi.", 409, "GUIDANCE_STATE_CONFLICT");
    const previous = row.current_resume_version_id ? await db.GuidanceResumeVersion.findByPk(row.current_resume_version_id, { transaction }) : null;
    const versionNumber = Number(previous?.version_number || 0) + 1;
    const version = await db.GuidanceResumeVersion.create({ guidance_id: row.id, version_number: versionNumber, resume_text: String(resume).trim(),
      submitted_by_mahasiswa_id: mahasiswaId, submitted_at: new Date(), status: "submitted", previous_version_id: previous?.id || null,
      content_hash: contentHash(String(resume).trim()), idempotency_key: state.key, request_fingerprint: state.receipt.request_fingerprint }, { transaction });
    row.current_resume_version_id = version.id; row.resume_mahasiswa = version.resume_text; row.status_resume = "submitted"; row.is_counted = false; row.row_version += 1; await row.save({ transaction });
    await event({ guidanceId: row.id, type: "resume_submitted", actorType: "mahasiswa", actorId: mahasiswaId, role: "mahasiswa", from: previous?.status || "not_submitted", to: "submitted",
      assignmentId: row.effective_reviewer_assignment_id, memberId: row.effective_reviewer_assignment_member_id, key: state.key, metadata: { version_number: versionNumber }, transaction });
    const member = await db.PenetapanPembimbingDosen.findByPk(row.effective_reviewer_assignment_member_id, { transaction });
    await createSystemNotification({ recipientType: "dosen", recipientId: member.dosen_id, type: NOTIFICATION_TYPES.GUIDANCE_RESUME_SUBMITTED_LECTURER,
      message: "Resume bimbingan baru perlu Anda review.", referenceType: "bimbingan", referenceId: row.id, actionKey: "guidance_resume_task",
      metadata: { guidance_id: row.id, resume_version: versionNumber }, deduplicationKey: `guidance:${row.id}:resume:${versionNumber}:submitted:dosen:${member.dosen_id}`, transaction });
    await completeReceipt(state.receipt, row.id, 200, row, transaction); return { status: 200, data: publicGuidance(row), replayed: false };
  });
}

async function reviewResumeVersion({ guidanceId, dosenId, action, catatan, expectedVersion, idempotencyKey }) {
  if (!["approve", "revision"].includes(action)) throw new GuidanceWorkflowError("Keputusan review tidak valid.", 400, "GUIDANCE_REVIEW_ACTION_INVALID");
  return db.sequelize.transaction(async (transaction) => {
    const normalized = action === "approve" ? "approved" : "revision_required";
    const payload = { guidanceId, action: normalized, catatan, expectedVersion }; const state = await claimReceipt({ actorType: "dosen", actorId: dosenId, operation: "review_resume", idempotencyKey, payload, transaction });
    if (state.replay) return { status: state.status, data: state.payload, replayed: true };
    const row = await db.BimbinganSkripsi.findByPk(guidanceId, { transaction, lock: transaction.LOCK.UPDATE }); if (!row) throw new GuidanceWorkflowError("Data bimbingan tidak ditemukan.", 404, "GUIDANCE_NOT_FOUND");
    assertVersion(row, expectedVersion); const member = await assertReviewer(row, dosenId, transaction);
    const version = await db.GuidanceResumeVersion.findByPk(row.current_resume_version_id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!version || version.status !== "submitted") throw new GuidanceWorkflowError("Versi resume tidak sedang menunggu review.", 409, "GUIDANCE_STATE_CONFLICT");
    if (normalized === "revision_required" && String(catatan || "").trim().length < 5) throw new GuidanceWorkflowError("Catatan revisi minimal 5 karakter.", 400, "GUIDANCE_REVIEW_NOTE_REQUIRED");
    version.status = normalized; version.reviewed_by_assignment_member_id = member.id; version.reviewed_by_dosen_id = dosenId; version.reviewed_at = new Date(); version.review_note = String(catatan || "").trim() || null; await version.save({ transaction });
    row.status_resume = normalized === "approved" ? "approved" : "revisi"; row.catatan_review_resume = version.review_note; row.tanggal_review_resume = version.reviewed_at;
    if (normalized === "approved") { row.occurred_at = row.occurred_at || row.scheduled_at || new Date(); row.occurrence_source = "approved_resume"; }
    const registration = await db.PendaftaranPenjaluran.findByPk(row.pendaftaran_penjaluran_id, { transaction });
    const policy = await resolvePolicy({ kodeProgramStudi: resolveProgramStudiCode(registration), programKuliah: registration?.program_kuliah || null,
      jalur: row.jalur_snapshot, periodeAkademikId: row.periode_akademik_id, transaction });
    await evaluateGuidance({ guidance: row, resumeVersion: version, policy, transaction }); row.row_version += 1; await row.save({ transaction });
    await event({ guidanceId: row.id, type: normalized === "approved" ? "resume_approved" : "resume_revision_requested", actorType: "dosen", actorId: dosenId,
      role: "dosen", from: "submitted", to: normalized, assignmentId: row.effective_reviewer_assignment_id, memberId: member.id, key: state.key, metadata: { version_number: version.version_number }, transaction });
    await createSystemNotification({ recipientType: "mahasiswa", recipientId: row.mahasiswa_id, type: NOTIFICATION_TYPES.GUIDANCE_RESUME_DECIDED_STUDENT,
      message: normalized === "approved" ? "Resume bimbingan Anda telah disetujui." : "Resume bimbingan Anda perlu direvisi.", referenceType: "bimbingan", referenceId: row.id,
      actionKey: "guidance_detail", metadata: { guidance_id: row.id, decision: normalized }, deduplicationKey: `guidance:${row.id}:resume:${version.version_number}:${normalized}:mahasiswa:${row.mahasiswa_id}`, transaction });
    await completeReceipt(state.receipt, row.id, 200, row, transaction); return { status: 200, data: publicGuidance(row), replayed: false };
  });
}

async function withdrawRequest({ guidanceId, mahasiswaId, reason, expectedVersion, idempotencyKey }) {
  return db.sequelize.transaction(async (transaction) => {
    const payload = { guidanceId, reason, expectedVersion }; const state = await claimReceipt({ actorType: "mahasiswa", actorId: mahasiswaId, operation: "withdraw_request", idempotencyKey, payload, transaction });
    if (state.replay) return { status: state.status, data: state.payload, replayed: true };
    const row = await db.BimbinganSkripsi.findOne({ where: { id: guidanceId, mahasiswa_id: mahasiswaId }, transaction, lock: transaction.LOCK.UPDATE }); if (!row) throw new GuidanceWorkflowError("Data bimbingan tidak ditemukan.", 404, "GUIDANCE_NOT_FOUND");
    assertVersion(row, expectedVersion); if (row.request_status !== "pending" || new Date(row.scheduled_at) > new Date()) throw new GuidanceWorkflowError("Permohonan belum dapat ditarik.", 409, "GUIDANCE_STATE_CONFLICT");
    row.request_status = "withdrawn"; row.status_permohonan = "expired"; row.cancelled_at = new Date(); row.cancellation_reason_code = "schedule_passed"; row.catatan_dosen = String(reason || "").trim() || "Permohonan ditarik mahasiswa."; row.row_version += 1; await row.save({ transaction });
    await event({ guidanceId: row.id, type: "request_withdrawn", actorType: "mahasiswa", actorId: mahasiswaId, role: "mahasiswa", from: "pending", to: "withdrawn", assignmentId: row.effective_reviewer_assignment_id, memberId: row.effective_reviewer_assignment_member_id, key: state.key, reason: "schedule_passed", transaction });
    await completeReceipt(state.receipt, row.id, 200, row, transaction); return { status: 200, data: publicGuidance(row), replayed: false };
  });
}

async function invalidateResumeApproval({ guidanceId, actorId, reason, expectedVersion, idempotencyKey }) {
  const normalizedReason = String(reason || "").trim();
  if (normalizedReason.length < 5) throw new GuidanceWorkflowError("Alasan invalidasi minimal 5 karakter.", 400, "GUIDANCE_INVALIDATION_REASON_REQUIRED");
  return db.sequelize.transaction(async (transaction) => {
    const payload = { guidanceId: Number(guidanceId), reason: normalizedReason, expectedVersion: Number(expectedVersion) };
    const state = await claimReceipt({ actorType: "sekretaris_prodi", actorId, operation: "invalidate_resume_approval", idempotencyKey, payload, transaction });
    if (state.replay) return { status: state.status, data: state.payload, replayed: true };
    const row = await db.BimbinganSkripsi.findByPk(guidanceId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!row) throw new GuidanceWorkflowError("Data bimbingan tidak ditemukan.", 404, "GUIDANCE_NOT_FOUND");
    assertVersion(row, expectedVersion);
    const version = await db.GuidanceResumeVersion.findByPk(row.current_resume_version_id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!version || version.status !== "approved" || version.invalidated_at) throw new GuidanceWorkflowError("Approval resume tidak aktif atau sudah di-invalidasi.", 409, "GUIDANCE_STATE_CONFLICT");
    await version.update({ status: "invalidated", invalidated_at: new Date(), invalidated_by_type: "sekretaris_prodi", invalidated_by_id: actorId,
      invalidation_reason: normalizedReason }, { transaction });
    const registration = await db.PendaftaranPenjaluran.findByPk(row.pendaftaran_penjaluran_id, { transaction });
    const policy = await resolvePolicy({ kodeProgramStudi: resolveProgramStudiCode(registration), programKuliah: registration?.program_kuliah || null,
      jalur: row.jalur_snapshot, periodeAkademikId: row.periode_akademik_id, transaction });
    row.status_resume = "revisi"; row.is_counted = false; row.catatan_review_resume = normalizedReason;
    await evaluateGuidance({ guidance: row, resumeVersion: version, policy, transaction });
    row.row_version += 1; await row.save({ transaction });
    const readinessRows = await db.GuidanceReadinessRequest.findAll({ where: { mahasiswa_id: row.mahasiswa_id,
      pendaftaran_penjaluran_id: row.pendaftaran_penjaluran_id, status: { [Op.notIn]: ["invalidated", "supervisor_rejected"] } }, transaction, lock: transaction.LOCK.UPDATE });
    for (const readiness of readinessRows) {
      await readiness.update({ status: "invalidated", invalidation_reason: "RESUME_APPROVAL_INVALIDATED", row_version: readiness.row_version + 1 }, { transaction });
      const lastFact = await db.GuidanceReadinessFact.findOne({ where: { readiness_request_id: readiness.id }, order: [["fact_version", "DESC"]], transaction, lock: transaction.LOCK.UPDATE });
      if (lastFact && !lastFact.invalidated_at) await lastFact.update({ invalidated_at: new Date(), invalidation_reason: "RESUME_APPROVAL_INVALIDATED" }, { transaction });
      const factVersion = Number(lastFact?.fact_version || 0) + 1;
      const factPayload = { readiness_request_id: readiness.id, status: "invalidated", fact_version: factVersion, reason: "RESUME_APPROVAL_INVALIDATED" };
      await db.GuidanceReadinessFact.create({ readiness_request_id: readiness.id, mahasiswa_id: readiness.mahasiswa_id,
        pendaftaran_penjaluran_id: readiness.pendaftaran_penjaluran_id, policy_id: readiness.policy_id,
        policy_version_snapshot: readiness.policy_version_snapshot, counted_snapshot: readiness.counted_snapshot,
        required_snapshot: readiness.policy_snapshot?.minimum_validated_sessions, approval_snapshot: [], status: "invalidated",
        fact_version: factVersion, issued_at: new Date(), invalidated_at: new Date(), invalidation_reason: "RESUME_APPROVAL_INVALIDATED",
        checksum: fingerprint(factPayload) }, { transaction });
    }
    await event({ guidanceId: row.id, type: "resume_approval_invalidated", actorType: "sekretaris_prodi", actorId,
      role: "sekretaris_prodi", from: "approved", to: "invalidated", assignmentId: row.effective_reviewer_assignment_id,
      memberId: row.effective_reviewer_assignment_member_id, key: state.key, reason: "MANUAL_INVALIDATION", metadata: { reason: normalizedReason }, transaction });
    await completeReceipt(state.receipt, row.id, 200, row, transaction);
    return { status: 200, data: publicGuidance(row), replayed: false };
  });
}

module.exports = { GuidanceWorkflowError, fingerprint, publicGuidance, createRequest, decideRequest, submitResumeVersion, reviewResumeVersion,
  invalidateResumeApproval, withdrawRequest, assertReviewer, assertEffectiveReviewerCapability, claimReceipt, completeCommandReceipt };
