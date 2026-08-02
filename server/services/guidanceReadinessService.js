"use strict";

const crypto = require("crypto");
const db = require("../models");
const { resolveActiveGuidanceContext } = require("./guidanceContextService");
const { recalculateProgress } = require("./guidanceProgressService");
const { fingerprint, GuidanceWorkflowError } = require("./guidanceWorkflowService");
const { createSystemNotification } = require("./notificationService");
const { NOTIFICATION_TYPES } = require("../constants/notificationTypes");

// Tahap 7 hanya mengumpulkan snapshot readiness. Enforcement baru boleh dibuka
// setelah kontrak approval, invalidasi, fact version, dan sinkronisasi Tahap 8 selesai.
function mode() { return "shadow"; }
function checksum(payload) { return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex"); }

async function requestReadiness({ mahasiswaId, idempotencyKey }) {
  if (!idempotencyKey) throw new GuidanceWorkflowError("Idempotency-Key wajib dikirim.", 400, "IDEMPOTENCY_KEY_REQUIRED");
  return db.sequelize.transaction(async (transaction) => {
    const context = await resolveActiveGuidanceContext(mahasiswaId, { transaction, lock: true });
    const progress = await recalculateProgress({ mahasiswaId, cycleRegistrationId: context.registration.id, assignmentId: context.assignment.id,
      context: { kodeProgramStudi: context.program.kode_program_studi, programKuliah: context.program.program_kuliah,
        jalur: context.snapshot.jalur_snapshot, periodeAkademikId: context.snapshot.periode_akademik_id }, transaction, persistSnapshot: true });
    if (!progress.enforcement.sufficient) throw new GuidanceWorkflowError("Minimum bimbingan belum terpenuhi.", 409, "GUIDANCE_MINIMUM_NOT_MET", progress);
    const requestFingerprint = fingerprint({ mahasiswaId, registrationId: context.registration.id, assignmentId: context.assignment.id, policy: progress.policy });
    const existing = await db.GuidanceReadinessRequest.findOne({ where: { mahasiswa_id: mahasiswaId, pendaftaran_penjaluran_id: context.registration.id, idempotency_key: idempotencyKey }, transaction, lock: transaction.LOCK.UPDATE });
    if (existing) {
      if (existing.request_fingerprint !== requestFingerprint) throw new GuidanceWorkflowError("Idempotency-Key digunakan untuk context readiness berbeda.", 409, "IDEMPOTENCY_CONFLICT");
      return { request: existing, replayed: true, mode: mode(), progress };
    }
    const policySnapshot = { ...progress.policy };
    const request = await db.GuidanceReadinessRequest.create({ mahasiswa_id: mahasiswaId, pendaftaran_penjaluran_id: context.registration.id,
      active_assignment_id: context.assignment.id, policy_id: progress.policy.id, policy_version_snapshot: progress.policy.version,
      policy_snapshot: policySnapshot, counted_snapshot: progress.enforcement.counted, status: "draft",
      requested_at: new Date(), idempotency_key: idempotencyKey, request_fingerprint: requestFingerprint, row_version: 1 }, { transaction });
    const requiredMembers = progress.policy.supervisor_approval_scope === "all_active_supervisors" || progress.policy.require_p2_if_available
      ? context.members
      : context.members.filter((member) => Number(member.urutan) === 1);
    await db.GuidanceReadinessApproval.bulkCreate(requiredMembers.map((member) => ({ readiness_request_id: request.id,
      assignment_member_id: member.id, urutan_snapshot: member.urutan, requirement_status: "required", decision: "pending",
      assignment_status_snapshot: member.status })), { transaction });
    return { request, replayed: false, mode: mode(), progress };
  });
}

async function decideReadiness({ readinessId, dosenId, decision, note, expectedVersion, idempotencyKey }) {
  if (!["approved", "rejected"].includes(decision)) throw new GuidanceWorkflowError("Keputusan readiness tidak valid.", 400, "GUIDANCE_READINESS_DECISION_INVALID");
  if (mode() !== "enabled") throw new GuidanceWorkflowError("Approval readiness masih dalam mode shadow sampai aturan bisnis disahkan.", 409, "GUIDANCE_READINESS_POLICY_PENDING");
  return db.sequelize.transaction(async (transaction) => {
    const request = await db.GuidanceReadinessRequest.findByPk(readinessId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!request) throw new GuidanceWorkflowError("Readiness tidak ditemukan.", 404, "GUIDANCE_READINESS_NOT_FOUND");
    if (Number(request.row_version) !== Number(expectedVersion)) throw new GuidanceWorkflowError("Readiness telah berubah.", 409, "GUIDANCE_VERSION_CONFLICT");
    const member = await db.PenetapanPembimbingDosen.findOne({ where: { penetapan_pembimbing_id: request.active_assignment_id, dosen_id: dosenId }, transaction });
    const approval = member ? await db.GuidanceReadinessApproval.findOne({ where: { readiness_request_id: request.id, assignment_member_id: member.id }, transaction, lock: transaction.LOCK.UPDATE }) : null;
    if (!approval) throw new GuidanceWorkflowError("Dosen bukan approver readiness yang diwajibkan.", 403, "GUIDANCE_REVIEWER_NOT_AUTHORIZED");
    if (approval.decision !== "pending") {
      if (approval.decision === decision && approval.idempotency_key === idempotencyKey) return { request, replayed: true };
      throw new GuidanceWorkflowError("Keputusan readiness sudah terminal.", 409, "GUIDANCE_STATE_CONFLICT");
    }
    approval.decision = decision; approval.note = String(note || "").trim() || null; approval.decided_at = new Date(); approval.idempotency_key = idempotencyKey; await approval.save({ transaction });
    request.status = decision === "rejected" ? "supervisor_rejected" : "supervisor_approved"; request.row_version += 1; await request.save({ transaction });
    if (decision === "approved") {
      const payload = { readiness_request_id: request.id, mahasiswa_id: request.mahasiswa_id, pendaftaran_penjaluran_id: request.pendaftaran_penjaluran_id,
        policy_id: request.policy_id, policy_version: request.policy_version_snapshot, counted: request.counted_snapshot, required: request.policy_snapshot.minimum_validated_sessions,
        approvals: [{ member_id: member.id, urutan: member.urutan, decision }] };
      await db.GuidanceReadinessFact.create({ readiness_request_id: request.id, mahasiswa_id: request.mahasiswa_id, pendaftaran_penjaluran_id: request.pendaftaran_penjaluran_id,
        policy_id: request.policy_id, policy_version_snapshot: request.policy_version_snapshot, counted_snapshot: request.counted_snapshot,
        required_snapshot: request.policy_snapshot.minimum_validated_sessions, approval_snapshot: payload.approvals, status: "valid", fact_version: 1, issued_at: new Date(), checksum: checksum(payload) }, { transaction });
    }
    await createSystemNotification({ recipientType: "mahasiswa", recipientId: request.mahasiswa_id, type: NOTIFICATION_TYPES.GUIDANCE_READINESS_DECIDED,
      message: decision === "approved" ? "Kesiapan bimbingan Anda disetujui pembimbing." : "Kesiapan bimbingan Anda belum disetujui pembimbing.",
      referenceType: "guidance_readiness", referenceId: request.id, actionKey: "guidance_readiness", metadata: { decision },
      deduplicationKey: `guidance-readiness:${request.id}:${decision}:mahasiswa:${request.mahasiswa_id}`, transaction });
    return { request, replayed: false };
  });
}

module.exports = { requestReadiness, decideReadiness, mode };
