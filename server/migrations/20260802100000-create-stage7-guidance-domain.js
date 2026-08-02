"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const add = (name, definition) => queryInterface.addColumn("BimbinganSkripsis", name, definition, { transaction });
      await add("target_assignment_id", { type: Sequelize.INTEGER, references: { model: "PenetapanPembimbings", key: "id" }, onDelete: "RESTRICT" });
      await add("target_assignment_member_id", { type: Sequelize.INTEGER, references: { model: "PenetapanPembimbingDosens", key: "id" }, onDelete: "RESTRICT" });
      await add("target_urutan_snapshot", { type: Sequelize.INTEGER });
      await add("effective_reviewer_assignment_id", { type: Sequelize.INTEGER, references: { model: "PenetapanPembimbings", key: "id" }, onDelete: "RESTRICT" });
      await add("effective_reviewer_assignment_member_id", { type: Sequelize.INTEGER, references: { model: "PenetapanPembimbingDosens", key: "id" }, onDelete: "RESTRICT" });
      await add("periode_akademik_id", { type: Sequelize.INTEGER, references: { model: "PeriodeAkademiks", key: "id" }, onDelete: "RESTRICT" });
      await add("semester_penjaluran_ke_snapshot", { type: Sequelize.INTEGER });
      await add("jalur_snapshot", { type: Sequelize.STRING(40) });
      await add("cycle_type_snapshot", { type: Sequelize.STRING(20) });
      await add("request_status", { type: Sequelize.STRING(40) });
      await add("request_decided_at", { type: Sequelize.DATE });
      await add("scheduled_at", { type: Sequelize.DATE });
      await add("occurred_at", { type: Sequelize.DATE });
      await add("occurrence_source", { type: Sequelize.STRING(40) });
      await add("cancelled_at", { type: Sequelize.DATE });
      await add("cancellation_reason_code", { type: Sequelize.STRING(100) });
      await add("current_resume_version_id", { type: Sequelize.BIGINT });
      await add("progress_policy_id", { type: Sequelize.INTEGER });
      await add("legacy_context_status", { type: Sequelize.STRING(20), allowNull: false, defaultValue: "ambiguous" });
      await add("reviewer_resolution_status", { type: Sequelize.STRING(30), allowNull: false, defaultValue: "resolved" });
      await add("row_version", { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 });
      await add("correlation_id", { type: Sequelize.UUID });

      const timestamps = { createdAt: { type: Sequelize.DATE, allowNull: false }, updatedAt: { type: Sequelize.DATE, allowNull: false } };
      const guidanceRef = { type: Sequelize.INTEGER, allowNull: false, references: { model: "BimbinganSkripsis", key: "id" }, onDelete: "RESTRICT" };
      await queryInterface.createTable("GuidanceEvents", {
        id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true }, guidance_id: { ...guidanceRef, allowNull: true },
        event_type: { type: Sequelize.STRING(60), allowNull: false }, actor_type: Sequelize.STRING(30), actor_id: Sequelize.INTEGER,
        actor_role: Sequelize.STRING(40), from_state: Sequelize.STRING(40), to_state: Sequelize.STRING(40), assignment_id: Sequelize.INTEGER,
        assignment_member_id: Sequelize.INTEGER, occurred_at: { type: Sequelize.DATE, allowNull: false }, correlation_id: Sequelize.UUID,
        idempotency_key: Sequelize.STRING(160), reason_code: Sequelize.STRING(100), metadata: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
        createdAt: timestamps.createdAt,
      }, { transaction });
      await queryInterface.createTable("GuidanceReviewerTransfers", {
        id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true }, guidance_id: guidanceRef,
        from_assignment_id: Sequelize.INTEGER, from_assignment_member_id: Sequelize.INTEGER,
        to_assignment_id: { type: Sequelize.INTEGER, allowNull: false }, to_assignment_member_id: { type: Sequelize.INTEGER, allowNull: false },
        transition_type: { type: Sequelize.STRING(40), allowNull: false }, reason_code: Sequelize.STRING(80), effective_at: { type: Sequelize.DATE, allowNull: false },
        transferred_by_actor_type: Sequelize.STRING(30), transferred_by_actor_id: Sequelize.INTEGER,
        event_id: { type: Sequelize.BIGINT, references: { model: "GuidanceEvents", key: "id" } }, correlation_id: Sequelize.UUID,
        row_version_before: Sequelize.INTEGER, row_version_after: Sequelize.INTEGER, createdAt: timestamps.createdAt,
      }, { transaction });
      await queryInterface.createTable("GuidanceResumeVersions", {
        id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true }, guidance_id: guidanceRef,
        version_number: { type: Sequelize.INTEGER, allowNull: false }, resume_text: { type: Sequelize.TEXT, allowNull: false },
        submitted_by_mahasiswa_id: { type: Sequelize.INTEGER, allowNull: false }, submitted_at: { type: Sequelize.DATE, allowNull: false },
        status: { type: Sequelize.STRING(30), allowNull: false }, reviewed_by_assignment_member_id: Sequelize.INTEGER,
        reviewed_by_dosen_id: Sequelize.INTEGER, reviewed_at: Sequelize.DATE, review_note: Sequelize.TEXT,
        invalidated_at: Sequelize.DATE, invalidated_by_type: Sequelize.STRING(30), invalidated_by_id: Sequelize.INTEGER,
        invalidation_reason: Sequelize.STRING(120), previous_version_id: Sequelize.BIGINT, content_hash: { type: Sequelize.STRING(64), allowNull: false },
        idempotency_key: Sequelize.STRING(160), request_fingerprint: Sequelize.STRING(64), ...timestamps,
      }, { transaction });
      await queryInterface.createTable("GuidanceRequirementPolicies", {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true }, kode_program_studi: Sequelize.STRING(40),
        program_kuliah: Sequelize.STRING(30), jalur: Sequelize.STRING(40), periode_akademik_id: Sequelize.INTEGER,
        version: { type: Sequelize.INTEGER, allowNull: false }, status: { type: Sequelize.STRING(20), allowNull: false },
        minimum_validated_sessions: { type: Sequelize.INTEGER, allowNull: false }, count_scope: { type: Sequelize.STRING(20), allowNull: false },
        occurrence_proof_mode: { type: Sequelize.STRING(40), allowNull: false }, supervisor_approval_scope: { type: Sequelize.STRING(40), allowNull: false },
        require_p2_if_available: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false }, effective_at: { type: Sequelize.DATE, allowNull: false },
        retired_at: Sequelize.DATE, created_by_type: Sequelize.STRING(30), created_by_id: Sequelize.INTEGER,
        approved_by_type: Sequelize.STRING(30), approved_by_id: Sequelize.INTEGER, decision_reference: Sequelize.STRING(160), source: Sequelize.STRING(50), ...timestamps,
      }, { transaction });
      await queryInterface.createTable("GuidanceProgressEvaluations", {
        id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true }, guidance_id: guidanceRef, resume_version_id: Sequelize.BIGINT,
        policy_id: { type: Sequelize.INTEGER, allowNull: false }, policy_version_snapshot: { type: Sequelize.INTEGER, allowNull: false },
        cycle_registration_id: { type: Sequelize.INTEGER, allowNull: false }, periode_akademik_id: Sequelize.INTEGER,
        counted: { type: Sequelize.BOOLEAN, allowNull: false }, reason_codes: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
        evaluated_at: { type: Sequelize.DATE, allowNull: false }, evaluator_version: { type: Sequelize.STRING(30), allowNull: false },
        superseded_at: Sequelize.DATE, ...timestamps,
      }, { transaction });
      await queryInterface.createTable("GuidanceProgressSnapshots", {
        id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true }, mahasiswa_id: { type: Sequelize.INTEGER, allowNull: false },
        cycle_registration_id: { type: Sequelize.INTEGER, allowNull: false }, assignment_id: Sequelize.INTEGER,
        policy_id: { type: Sequelize.INTEGER, allowNull: false }, policy_version_snapshot: Sequelize.INTEGER,
        counted_total: Sequelize.INTEGER, required_total: Sequelize.INTEGER, remaining_total: Sequelize.INTEGER, status: Sequelize.STRING(20),
        reason_summary: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] }, source_watermark: Sequelize.STRING(64), calculated_at: Sequelize.DATE, ...timestamps,
      }, { transaction });
      await queryInterface.createTable("GuidanceReadinessRequests", {
        id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true }, mahasiswa_id: { type: Sequelize.INTEGER, allowNull: false },
        pendaftaran_penjaluran_id: { type: Sequelize.INTEGER, allowNull: false }, active_assignment_id: { type: Sequelize.INTEGER, allowNull: false },
        policy_id: { type: Sequelize.INTEGER, allowNull: false }, policy_version_snapshot: Sequelize.INTEGER,
        policy_snapshot: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} }, counted_snapshot: Sequelize.INTEGER,
        status: { type: Sequelize.STRING(40), allowNull: false }, requested_at: Sequelize.DATE, forwarded_at: Sequelize.DATE,
        invalidation_reason: Sequelize.STRING(120), idempotency_key: Sequelize.STRING(160), request_fingerprint: Sequelize.STRING(64),
        row_version: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 }, ...timestamps,
      }, { transaction });
      await queryInterface.createTable("GuidanceReadinessApprovals", {
        id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true }, readiness_request_id: { type: Sequelize.BIGINT, allowNull: false },
        assignment_member_id: { type: Sequelize.INTEGER, allowNull: false }, urutan_snapshot: Sequelize.INTEGER,
        requirement_status: Sequelize.STRING(20), decision: Sequelize.STRING(20), note: Sequelize.TEXT, decided_at: Sequelize.DATE,
        assignment_status_snapshot: Sequelize.STRING(30), idempotency_key: Sequelize.STRING(160), ...timestamps,
      }, { transaction });
      await queryInterface.createTable("GuidanceReadinessFacts", {
        id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true }, readiness_request_id: { type: Sequelize.BIGINT, allowNull: false },
        mahasiswa_id: Sequelize.INTEGER, pendaftaran_penjaluran_id: Sequelize.INTEGER, policy_id: Sequelize.INTEGER,
        policy_version_snapshot: Sequelize.INTEGER, counted_snapshot: Sequelize.INTEGER, required_snapshot: Sequelize.INTEGER,
        approval_snapshot: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] }, status: Sequelize.STRING(20), fact_version: Sequelize.INTEGER,
        issued_at: Sequelize.DATE, invalidated_at: Sequelize.DATE, invalidation_reason: Sequelize.STRING(120), checksum: Sequelize.STRING(64), createdAt: timestamps.createdAt,
      }, { transaction });
      await queryInterface.createTable("GuidanceCommandReceipts", {
        id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true }, actor_type: { type: Sequelize.STRING(30), allowNull: false },
        actor_id: { type: Sequelize.INTEGER, allowNull: false }, operation: { type: Sequelize.STRING(60), allowNull: false },
        idempotency_key: { type: Sequelize.STRING(160), allowNull: false }, request_fingerprint: { type: Sequelize.STRING(64), allowNull: false },
        status: { type: Sequelize.STRING(30), allowNull: false }, aggregate_type: Sequelize.STRING(50), aggregate_id: Sequelize.STRING(80),
        response_status: Sequelize.INTEGER, response_payload_minimal: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
        completed_at: Sequelize.DATE, expires_at: Sequelize.DATE, ...timestamps,
      }, { transaction });

      await queryInterface.addIndex("BimbinganSkripsis", ["effective_reviewer_assignment_member_id", "request_status"], { name: "idx_guidance_effective_reviewer_tasks", transaction });
      await queryInterface.addIndex("BimbinganSkripsis", ["pendaftaran_penjaluran_id", "semester_penjaluran_ke_snapshot"], { name: "idx_guidance_cycle_semester", transaction });
      await queryInterface.addIndex("GuidanceResumeVersions", ["guidance_id", "version_number"], { unique: true, name: "uq_guidance_resume_version", transaction });
      await queryInterface.addIndex("GuidanceReviewerTransfers", ["guidance_id", "effective_at", "id"], { name: "idx_guidance_transfer_chain", transaction });
      await queryInterface.addIndex("GuidanceCommandReceipts", ["actor_type", "actor_id", "operation", "idempotency_key"], { unique: true, name: "uq_guidance_command_receipt", transaction });
      await queryInterface.addIndex("GuidanceProgressEvaluations", ["guidance_id", "resume_version_id", "policy_id", "cycle_registration_id"], { unique: true, where: { superseded_at: null }, name: "uq_guidance_active_evaluation", transaction });
      await queryInterface.addIndex("GuidanceReadinessApprovals", ["readiness_request_id", "assignment_member_id"], { unique: true, name: "uq_guidance_readiness_member", transaction });
      await queryInterface.addIndex("GuidanceReadinessFacts", ["readiness_request_id", "fact_version"], { unique: true, name: "uq_guidance_readiness_fact_version", transaction });

      await queryInterface.sequelize.query(`INSERT INTO "GuidanceRequirementPolicies" (kode_program_studi, program_kuliah, jalur, version, status, minimum_validated_sessions, count_scope, occurrence_proof_mode, supervisor_approval_scope, require_p2_if_available, effective_at, source, "createdAt", "updatedAt") VALUES (NULL, NULL, NULL, 1, 'active', 8, 'cycle', 'approved_resume', 'p1', false, NOW(), 'legacy_stage7_migration', NOW(), NOW())`, { transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const table of ["GuidanceCommandReceipts", "GuidanceReadinessFacts", "GuidanceReadinessApprovals", "GuidanceReadinessRequests", "GuidanceProgressSnapshots", "GuidanceProgressEvaluations", "GuidanceRequirementPolicies", "GuidanceResumeVersions", "GuidanceReviewerTransfers", "GuidanceEvents"]) await queryInterface.dropTable(table, { transaction });
      for (const column of ["correlation_id", "row_version", "reviewer_resolution_status", "legacy_context_status", "progress_policy_id", "current_resume_version_id", "cancellation_reason_code", "cancelled_at", "occurrence_source", "occurred_at", "scheduled_at", "request_decided_at", "request_status", "cycle_type_snapshot", "jalur_snapshot", "semester_penjaluran_ke_snapshot", "periode_akademik_id", "effective_reviewer_assignment_member_id", "effective_reviewer_assignment_id", "target_urutan_snapshot", "target_assignment_member_id", "target_assignment_id"]) await queryInterface.removeColumn("BimbinganSkripsis", column, { transaction });
    });
  },
};
