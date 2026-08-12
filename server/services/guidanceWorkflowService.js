"use strict";

const crypto = require("crypto");
const { Op } = require("sequelize");
const db = require("../models");
const { resolveActiveGuidanceContext } = require("./guidanceContextService");
const { getExistingSupervisionPermission } = require("./dosenStatusService");
const { createSystemNotification } = require("./notificationService");
const { NOTIFICATION_TYPES } = require("../constants/notificationTypes");

class GuidanceWorkflowError extends Error {
  constructor(message, status = 409, code = "GUIDANCE_WORKFLOW_ERROR", detail = null) {
    super(message); this.status = status; this.code = code; this.detail = detail;
  }
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value === undefined ? null : value;
}
function fingerprint(payload) { return crypto.createHash("sha256").update(JSON.stringify(canonical(payload))).digest("hex"); }
function requireKey(value) {
  const key = String(value || "").trim();
  if (!key) throw new GuidanceWorkflowError("Idempotency-Key wajib dikirim.", 400, "IDEMPOTENCY_KEY_REQUIRED");
  if (key.length > 160) throw new GuidanceWorkflowError("Idempotency-Key terlalu panjang.", 400, "IDEMPOTENCY_KEY_INVALID");
  return key;
}
function scheduledAt(date, time) {
  const result = new Date(`${date}T${time}:00+07:00`);
  return Number.isNaN(result.getTime()) ? null : result;
}
function publicGuidance(row) {
  const value = row?.toJSON ? row.toJSON() : row;
  return { ...value, status_permohonan: value.request_status === "accepted" ? "approved" : value.request_status === "withdrawn" ? "expired" : (value.request_status || value.status_permohonan) };
}
function assertVersion(row, expectedVersion) {
  if (expectedVersion == null || !Number.isInteger(Number(expectedVersion))) throw new GuidanceWorkflowError("expected_version wajib dikirim.", 428, "GUIDANCE_PRECONDITION_REQUIRED");
  if (Number(row.row_version) !== Number(expectedVersion)) throw new GuidanceWorkflowError("Data bimbingan telah berubah. Muat ulang sebelum melanjutkan.", 409, "GUIDANCE_VERSION_CONFLICT", { current_version: row.row_version });
}
function isEffectiveAt(assignment, member, at = new Date()) {
  const timestamp = at.getTime();
  const starts = [assignment.effective_at, assignment.tanggal_mulai, member.tanggal_mulai].filter(Boolean).every((value) => new Date(value).getTime() <= timestamp);
  const ends = [assignment.tanggal_selesai, member.tanggal_selesai].filter(Boolean).every((value) => new Date(value).getTime() > timestamp);
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
  if (!permission.allowed) throw new GuidanceWorkflowError(permission.message || "Status dosen tidak mengizinkan kelanjutan bimbingan.", 403, "GUIDANCE_REVIEWER_CAPABILITY_DENIED");
  return member;
}
const assertReviewer = assertEffectiveReviewerCapability;

async function createRequest({ mahasiswaId, targetMemberId = null, targetDosenId = null, pesan, tanggal, jam, idempotencyKey }) {
  requireKey(idempotencyKey);
  return db.sequelize.transaction(async (transaction) => {
    const context = await resolveActiveGuidanceContext(mahasiswaId, { targetMemberId, targetDosenId, transaction, lock: true });
    if (!context.member) throw new GuidanceWorkflowError("Pembimbing tujuan wajib dipilih.", 400, "GUIDANCE_TARGET_REQUIRED");
    const permission = await getExistingSupervisionPermission(context.member.dosen_id, transaction);
    if (!permission.allowed) throw new GuidanceWorkflowError(permission.message || "Dosen tujuan tidak dapat melanjutkan bimbingan.", 409, "GUIDANCE_REVIEWER_UNAVAILABLE");
    const at = scheduledAt(tanggal, jam);
    if (!at || at <= new Date()) throw new GuidanceWorkflowError("Jadwal bimbingan harus berada di masa depan.", 400, "GUIDANCE_SCHEDULE_INVALID");
    const duplicate = await db.BimbinganSkripsi.findOne({ where: { mahasiswa_id: mahasiswaId, pendaftaran_penjaluran_id: context.registration.id,
      scheduled_at: at, request_status: { [Op.in]: ["pending", "accepted", "rescheduled"] } }, transaction, lock: transaction.LOCK.UPDATE });
    if (duplicate) return { status: 200, data: publicGuidance(duplicate), replayed: true };
    const row = await db.BimbinganSkripsi.create({ mahasiswa_id: mahasiswaId, dosen_id: context.member.dosen_id,
      penetapan_pembimbing_id: context.assignment.id, ...context.snapshot, permintaan_pesan: String(pesan).trim(),
      permintaan_tanggal: tanggal, permintaan_jam: jam, scheduled_at: at, status_permohonan: "pending", request_status: "pending",
      status_resume: "belum_diisi", legacy_context_status: "resolved", row_version: 1 }, { transaction });
    await createSystemNotification({ recipientType: "dosen", recipientId: context.member.dosen_id, type: NOTIFICATION_TYPES.GUIDANCE_REQUESTED_LECTURER,
      message: "Ada permohonan bimbingan baru yang perlu Anda tinjau.", referenceType: "bimbingan", referenceId: row.id,
      actionKey: "guidance_task", metadata: { guidance_id: row.id }, deduplicationKey: `guidance:${row.id}:request-created:dosen:${context.member.dosen_id}`, transaction });
    return { status: 201, data: publicGuidance(row), replayed: false };
  });
}

async function decideRequest({ guidanceId, dosenId, action, catatan, tanggal, jam, lokasi, expectedVersion, idempotencyKey }) {
  requireKey(idempotencyKey);
  return db.sequelize.transaction(async (transaction) => {
    const row = await db.BimbinganSkripsi.findByPk(guidanceId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!row) throw new GuidanceWorkflowError("Data bimbingan tidak ditemukan.", 404, "GUIDANCE_NOT_FOUND");
    assertVersion(row, expectedVersion); await assertReviewer(row, dosenId, transaction);
    if (row.request_status !== "pending") throw new GuidanceWorkflowError("Permohonan sudah diproses.", 409, "GUIDANCE_STATE_CONFLICT");
    let next;
    if (action === "reject") {
      if (String(catatan || "").trim().length < 5) throw new GuidanceWorkflowError("Alasan penolakan minimal 5 karakter.", 400, "GUIDANCE_REJECTION_REASON_REQUIRED");
      next = "rejected"; row.status_permohonan = "rejected";
    } else {
      const at = scheduledAt(tanggal, jam);
      if (!at || at < new Date()) throw new GuidanceWorkflowError("Jadwal keputusan tidak valid.", 400, "GUIDANCE_SCHEDULE_INVALID");
      next = row.scheduled_at && new Date(row.scheduled_at).getTime() !== at.getTime() ? "rescheduled" : "accepted";
      row.status_permohonan = next === "accepted" ? "approved" : "rescheduled";
      row.permintaan_tanggal = tanggal; row.permintaan_jam = jam; row.scheduled_at = at; row.lokasi_bimbingan = String(lokasi || "").trim() || null;
    }
    row.request_status = next; row.catatan_dosen = String(catatan || "").trim() || null; row.request_decided_at = new Date();
    row.tanggal_keputusan = row.request_decided_at; row.row_version += 1; await row.save({ transaction });
    await createSystemNotification({ recipientType: "mahasiswa", recipientId: row.mahasiswa_id, type: NOTIFICATION_TYPES.GUIDANCE_REQUEST_DECIDED_STUDENT,
      message: next === "rejected" ? "Permohonan bimbingan Anda ditolak. Lihat detail untuk alasannya." : "Jadwal bimbingan Anda telah dikonfirmasi.",
      referenceType: "bimbingan", referenceId: row.id, actionKey: "guidance_detail", metadata: { guidance_id: row.id, decision: next },
      deduplicationKey: `guidance:${row.id}:request-${next}:mahasiswa:${row.mahasiswa_id}`, transaction });
    return { status: 200, data: publicGuidance(row), replayed: false };
  });
}

async function submitResumeVersion({ guidanceId, mahasiswaId, resume, expectedVersion, idempotencyKey }) {
  requireKey(idempotencyKey);
  const text = String(resume || "").trim();
  if (!text) throw new GuidanceWorkflowError("Resume bimbingan wajib diisi.", 400, "GUIDANCE_RESUME_REQUIRED");
  return db.sequelize.transaction(async (transaction) => {
    const row = await db.BimbinganSkripsi.findOne({ where: { id: guidanceId, mahasiswa_id: mahasiswaId }, transaction, lock: transaction.LOCK.UPDATE });
    if (!row) throw new GuidanceWorkflowError("Data bimbingan tidak ditemukan.", 404, "GUIDANCE_NOT_FOUND");
    assertVersion(row, expectedVersion);
    if (!["accepted", "rescheduled"].includes(row.request_status)) throw new GuidanceWorkflowError("Resume hanya dapat dikirim untuk sesi yang disetujui.", 409, "GUIDANCE_STATE_CONFLICT");
    if (!row.scheduled_at || new Date(row.scheduled_at) > new Date()) throw new GuidanceWorkflowError("Resume belum dapat dikirim sebelum sesi dimulai.", 409, "WAITING_SESSION_START");
    if (!["belum_diisi", "revisi", "rejected"].includes(row.status_resume)) throw new GuidanceWorkflowError("Resume saat ini tidak dapat direvisi.", 409, "GUIDANCE_STATE_CONFLICT");
    row.resume_mahasiswa = text; row.status_resume = "submitted"; row.catatan_review_resume = null; row.tanggal_review_resume = null;
    row.is_counted = false; row.row_version += 1; await row.save({ transaction });
    const member = await db.PenetapanPembimbingDosen.findByPk(row.effective_reviewer_assignment_member_id, { transaction });
    const reviewerId = member?.dosen_id || row.reviewer_dosen_id || row.dosen_id;
    await createSystemNotification({ recipientType: "dosen", recipientId: reviewerId, type: NOTIFICATION_TYPES.GUIDANCE_RESUME_SUBMITTED_LECTURER,
      message: "Resume bimbingan baru perlu Anda review.", referenceType: "bimbingan", referenceId: row.id, actionKey: "guidance_resume_task",
      metadata: { guidance_id: row.id }, deduplicationKey: `guidance:${row.id}:resume:${row.row_version}:submitted:dosen:${reviewerId}`, transaction });
    return { status: 200, data: publicGuidance(row), replayed: false };
  });
}

async function reviewResumeVersion({ guidanceId, dosenId, action, catatan, expectedVersion, idempotencyKey }) {
  requireKey(idempotencyKey);
  const requested = String(action || "").trim().toLowerCase();
  const approve = ["approve", "approved"].includes(requested);
  const revision = ["revision", "revisi", "reject", "rejected", "revision_required"].includes(requested);
  if (!approve && !revision) throw new GuidanceWorkflowError("Keputusan review tidak valid.", 400, "GUIDANCE_REVIEW_ACTION_INVALID");
  if (revision && String(catatan || "").trim().length < 5) throw new GuidanceWorkflowError("Catatan revisi minimal 5 karakter.", 400, "GUIDANCE_REVIEW_NOTE_REQUIRED");
  return db.sequelize.transaction(async (transaction) => {
    const row = await db.BimbinganSkripsi.findByPk(guidanceId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!row) throw new GuidanceWorkflowError("Data bimbingan tidak ditemukan.", 404, "GUIDANCE_NOT_FOUND");
    assertVersion(row, expectedVersion); await assertReviewer(row, dosenId, transaction);
    if (row.status_resume !== "submitted" || !row.resume_mahasiswa) throw new GuidanceWorkflowError("Resume tidak sedang menunggu review.", 409, "GUIDANCE_STATE_CONFLICT");
    row.status_resume = approve ? "approved" : "revisi"; row.catatan_review_resume = String(catatan || "").trim() || null;
    row.tanggal_review_resume = new Date(); row.is_counted = approve;
    if (approve) { row.occurred_at = row.occurred_at || row.scheduled_at || new Date(); row.occurrence_source = "approved_resume"; }
    row.row_version += 1; await row.save({ transaction });
    const decision = approve ? "approved" : "revision_required";
    await createSystemNotification({ recipientType: "mahasiswa", recipientId: row.mahasiswa_id, type: NOTIFICATION_TYPES.GUIDANCE_RESUME_DECIDED_STUDENT,
      message: approve ? "Resume bimbingan Anda telah disetujui." : "Resume bimbingan Anda perlu direvisi.", referenceType: "bimbingan", referenceId: row.id,
      actionKey: "guidance_detail", metadata: { guidance_id: row.id, decision },
      deduplicationKey: `guidance:${row.id}:resume:${row.row_version}:${decision}:mahasiswa:${row.mahasiswa_id}`, transaction });
    return { status: 200, data: publicGuidance(row), replayed: false };
  });
}

async function withdrawRequest({ guidanceId, mahasiswaId, reason, expectedVersion, idempotencyKey }) {
  requireKey(idempotencyKey);
  return db.sequelize.transaction(async (transaction) => {
    const row = await db.BimbinganSkripsi.findOne({ where: { id: guidanceId, mahasiswa_id: mahasiswaId }, transaction, lock: transaction.LOCK.UPDATE });
    if (!row) throw new GuidanceWorkflowError("Data bimbingan tidak ditemukan.", 404, "GUIDANCE_NOT_FOUND");
    assertVersion(row, expectedVersion);
    if (row.request_status !== "pending") throw new GuidanceWorkflowError("Permohonan tidak dapat ditarik.", 409, "GUIDANCE_STATE_CONFLICT");
    row.request_status = "withdrawn"; row.status_permohonan = "expired"; row.cancelled_at = new Date(); row.cancellation_reason_code = "withdrawn_by_student";
    row.catatan_dosen = String(reason || "").trim() || "Permohonan ditarik mahasiswa."; row.row_version += 1; await row.save({ transaction });
    return { status: 200, data: publicGuidance(row), replayed: false };
  });
}

async function invalidateResumeApproval({ guidanceId, actorId, reason, expectedVersion, idempotencyKey }) {
  requireKey(idempotencyKey);
  const note = String(reason || "").trim();
  if (note.length < 5) throw new GuidanceWorkflowError("Alasan invalidasi minimal 5 karakter.", 400, "GUIDANCE_INVALIDATION_REASON_REQUIRED");
  return db.sequelize.transaction(async (transaction) => {
    const row = await db.BimbinganSkripsi.findByPk(guidanceId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!row) throw new GuidanceWorkflowError("Data bimbingan tidak ditemukan.", 404, "GUIDANCE_NOT_FOUND");
    assertVersion(row, expectedVersion);
    if (row.status_resume !== "approved") throw new GuidanceWorkflowError("Approval resume tidak aktif.", 409, "GUIDANCE_STATE_CONFLICT");
    row.status_resume = "revisi"; row.is_counted = false; row.catatan_review_resume = note; row.tanggal_review_resume = new Date(); row.row_version += 1;
    await row.save({ transaction });
    return { status: 200, data: publicGuidance(row), replayed: false, actor_id: actorId };
  });
}

module.exports = { GuidanceWorkflowError, fingerprint, publicGuidance, createRequest, decideRequest, submitResumeVersion,
  reviewResumeVersion, invalidateResumeApproval, withdrawRequest, assertReviewer, assertEffectiveReviewerCapability };
