"use strict";

const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  const common = { sequelize, timestamps: true };
  const json = (defaultValue = {}) => ({ type: DataTypes.JSONB, allowNull: false, defaultValue });

  class GuidanceReviewerTransfer extends Model {}
  GuidanceReviewerTransfer.init({
    guidance_id: { type: DataTypes.INTEGER, allowNull: false },
    from_assignment_id: DataTypes.INTEGER, from_assignment_member_id: DataTypes.INTEGER,
    to_assignment_id: { type: DataTypes.INTEGER, allowNull: false },
    to_assignment_member_id: { type: DataTypes.INTEGER, allowNull: false },
    transition_type: { type: DataTypes.STRING(40), allowNull: false }, reason_code: DataTypes.STRING(80),
    effective_at: { type: DataTypes.DATE, allowNull: false }, transferred_by_actor_type: DataTypes.STRING(30),
    transferred_by_actor_id: DataTypes.INTEGER, event_id: DataTypes.BIGINT, correlation_id: DataTypes.UUID,
    row_version_before: DataTypes.INTEGER, row_version_after: DataTypes.INTEGER,
  }, { ...common, modelName: "GuidanceReviewerTransfer", tableName: "GuidanceReviewerTransfers", updatedAt: false });

  class GuidanceResumeVersion extends Model {}
  GuidanceResumeVersion.init({
    guidance_id: { type: DataTypes.INTEGER, allowNull: false }, version_number: { type: DataTypes.INTEGER, allowNull: false },
    resume_text: { type: DataTypes.TEXT, allowNull: false }, submitted_by_mahasiswa_id: { type: DataTypes.INTEGER, allowNull: false },
    submitted_at: { type: DataTypes.DATE, allowNull: false }, status: { type: DataTypes.STRING(30), allowNull: false },
    reviewed_by_assignment_member_id: DataTypes.INTEGER, reviewed_by_dosen_id: DataTypes.INTEGER,
    reviewed_at: DataTypes.DATE, review_note: DataTypes.TEXT, invalidated_at: DataTypes.DATE,
    invalidated_by_type: DataTypes.STRING(30), invalidated_by_id: DataTypes.INTEGER, invalidation_reason: DataTypes.STRING(120),
    previous_version_id: DataTypes.BIGINT, content_hash: { type: DataTypes.STRING(64), allowNull: false },
    idempotency_key: DataTypes.STRING(160), request_fingerprint: DataTypes.STRING(64),
  }, { ...common, modelName: "GuidanceResumeVersion", tableName: "GuidanceResumeVersions" });

  class GuidanceEvent extends Model {}
  GuidanceEvent.init({
    guidance_id: DataTypes.INTEGER, event_type: { type: DataTypes.STRING(60), allowNull: false },
    actor_type: DataTypes.STRING(30), actor_id: DataTypes.INTEGER, actor_role: DataTypes.STRING(40),
    from_state: DataTypes.STRING(40), to_state: DataTypes.STRING(40), assignment_id: DataTypes.INTEGER,
    assignment_member_id: DataTypes.INTEGER, occurred_at: { type: DataTypes.DATE, allowNull: false },
    correlation_id: DataTypes.UUID, idempotency_key: DataTypes.STRING(160), reason_code: DataTypes.STRING(100),
    metadata: json(),
  }, { ...common, modelName: "GuidanceEvent", tableName: "GuidanceEvents", updatedAt: false });

  class GuidanceRequirementPolicy extends Model {}
  GuidanceRequirementPolicy.init({
    kode_program_studi: DataTypes.STRING(40), program_kuliah: DataTypes.STRING(30), jalur: DataTypes.STRING(40),
    periode_akademik_id: DataTypes.INTEGER, version: { type: DataTypes.INTEGER, allowNull: false },
    status: { type: DataTypes.STRING(20), allowNull: false }, minimum_validated_sessions: { type: DataTypes.INTEGER, allowNull: false },
    count_scope: { type: DataTypes.STRING(20), allowNull: false }, occurrence_proof_mode: { type: DataTypes.STRING(40), allowNull: false },
    supervisor_approval_scope: { type: DataTypes.STRING(40), allowNull: false }, require_p2_if_available: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    effective_at: { type: DataTypes.DATE, allowNull: false }, retired_at: DataTypes.DATE,
    created_by_type: DataTypes.STRING(30), created_by_id: DataTypes.INTEGER, approved_by_type: DataTypes.STRING(30),
    approved_by_id: DataTypes.INTEGER, decision_reference: DataTypes.STRING(160), source: DataTypes.STRING(50),
    row_version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  }, { ...common, modelName: "GuidanceRequirementPolicy", tableName: "GuidanceRequirementPolicies" });

  class GuidanceProgressEvaluation extends Model {}
  GuidanceProgressEvaluation.init({
    guidance_id: { type: DataTypes.INTEGER, allowNull: false }, resume_version_id: DataTypes.BIGINT,
    policy_id: { type: DataTypes.INTEGER, allowNull: false }, policy_version_snapshot: { type: DataTypes.INTEGER, allowNull: false },
    cycle_registration_id: { type: DataTypes.INTEGER, allowNull: false }, periode_akademik_id: DataTypes.INTEGER,
    counted: { type: DataTypes.BOOLEAN, allowNull: false }, reason_codes: json([]), evaluated_at: { type: DataTypes.DATE, allowNull: false },
    evaluator_version: { type: DataTypes.STRING(30), allowNull: false }, superseded_at: DataTypes.DATE,
  }, { ...common, modelName: "GuidanceProgressEvaluation", tableName: "GuidanceProgressEvaluations" });

  class GuidanceProgressSnapshot extends Model {}
  GuidanceProgressSnapshot.init({
    mahasiswa_id: { type: DataTypes.INTEGER, allowNull: false }, cycle_registration_id: { type: DataTypes.INTEGER, allowNull: false },
    assignment_id: DataTypes.INTEGER, policy_id: { type: DataTypes.INTEGER, allowNull: false }, policy_version_snapshot: DataTypes.INTEGER,
    counted_total: DataTypes.INTEGER, required_total: DataTypes.INTEGER, remaining_total: DataTypes.INTEGER,
    status: DataTypes.STRING(20), reason_summary: json([]), source_watermark: DataTypes.STRING(64), calculated_at: DataTypes.DATE,
  }, { ...common, modelName: "GuidanceProgressSnapshot", tableName: "GuidanceProgressSnapshots" });

  class GuidanceReadinessRequest extends Model {}
  GuidanceReadinessRequest.init({
    mahasiswa_id: { type: DataTypes.INTEGER, allowNull: false }, pendaftaran_penjaluran_id: { type: DataTypes.INTEGER, allowNull: false },
    active_assignment_id: { type: DataTypes.INTEGER, allowNull: false }, policy_id: { type: DataTypes.INTEGER, allowNull: false },
    policy_version_snapshot: DataTypes.INTEGER, policy_snapshot: json(), counted_snapshot: DataTypes.INTEGER,
    status: { type: DataTypes.STRING(40), allowNull: false }, requested_at: DataTypes.DATE, forwarded_at: DataTypes.DATE,
    invalidation_reason: DataTypes.STRING(120), idempotency_key: DataTypes.STRING(160), request_fingerprint: DataTypes.STRING(64), row_version: { type: DataTypes.INTEGER, defaultValue: 1 },
  }, { ...common, modelName: "GuidanceReadinessRequest", tableName: "GuidanceReadinessRequests" });

  class GuidanceReadinessApproval extends Model {}
  GuidanceReadinessApproval.init({
    readiness_request_id: { type: DataTypes.BIGINT, allowNull: false }, assignment_member_id: { type: DataTypes.INTEGER, allowNull: false },
    urutan_snapshot: DataTypes.INTEGER, requirement_status: DataTypes.STRING(20), decision: DataTypes.STRING(20),
    note: DataTypes.TEXT, decided_at: DataTypes.DATE, assignment_status_snapshot: DataTypes.STRING(30), idempotency_key: DataTypes.STRING(160),
  }, { ...common, modelName: "GuidanceReadinessApproval", tableName: "GuidanceReadinessApprovals" });

  class GuidanceReadinessFact extends Model {}
  GuidanceReadinessFact.init({
    readiness_request_id: { type: DataTypes.BIGINT, allowNull: false }, mahasiswa_id: DataTypes.INTEGER,
    pendaftaran_penjaluran_id: DataTypes.INTEGER, policy_id: DataTypes.INTEGER, policy_version_snapshot: DataTypes.INTEGER,
    counted_snapshot: DataTypes.INTEGER, required_snapshot: DataTypes.INTEGER, approval_snapshot: json([]),
    status: DataTypes.STRING(20), fact_version: DataTypes.INTEGER, issued_at: DataTypes.DATE, invalidated_at: DataTypes.DATE,
    invalidation_reason: DataTypes.STRING(120), checksum: DataTypes.STRING(64),
  }, { ...common, modelName: "GuidanceReadinessFact", tableName: "GuidanceReadinessFacts", updatedAt: false });

  class GuidanceCommandReceipt extends Model {}
  GuidanceCommandReceipt.init({
    actor_type: { type: DataTypes.STRING(30), allowNull: false }, actor_id: { type: DataTypes.INTEGER, allowNull: false },
    operation: { type: DataTypes.STRING(60), allowNull: false }, idempotency_key: { type: DataTypes.STRING(160), allowNull: false },
    request_fingerprint: { type: DataTypes.STRING(64), allowNull: false }, status: { type: DataTypes.STRING(30), allowNull: false },
    aggregate_type: DataTypes.STRING(50), aggregate_id: DataTypes.STRING(80), response_status: DataTypes.INTEGER,
    response_payload_minimal: json(), completed_at: DataTypes.DATE, expires_at: DataTypes.DATE,
  }, { ...common, modelName: "GuidanceCommandReceipt", tableName: "GuidanceCommandReceipts" });

  GuidanceReviewerTransfer.associate = (models) => {
    models.GuidanceReadinessRequest.hasMany(models.GuidanceReadinessApproval, { foreignKey: "readiness_request_id", as: "approvals" });
    models.GuidanceReadinessApproval.belongsTo(models.GuidanceReadinessRequest, { foreignKey: "readiness_request_id", as: "request" });
    models.GuidanceReadinessRequest.hasMany(models.GuidanceReadinessFact, { foreignKey: "readiness_request_id", as: "facts" });
    models.GuidanceReadinessFact.belongsTo(models.GuidanceReadinessRequest, { foreignKey: "readiness_request_id", as: "request" });
  };

  return GuidanceReviewerTransfer;
};
