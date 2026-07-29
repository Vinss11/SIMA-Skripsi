"use strict";

const STAGE_BY_STATUS = {
  draft: "draft",
  pending: "under_path_review",
  submitted: "under_path_review",
  review_dosen_magang: "under_path_review",
  review_sekprodi: "waiting_final_decision",
  menunggu_set_ketua_cluster: "under_path_review",
  menunggu_approval_sekprodi: "waiting_final_decision",
  approved: "approved",
  rejected: "rejected",
  completed: "completed",
  cancelled: "cancelled",
};

function normalizeWorkflow({ status, timeline = [], actor = null, allowedActions = [], blockingReasons = [] }) {
  const rawStatus = String(status || "").trim().toLowerCase() || null;
  return {
    workflow_stage: rawStatus ? (STAGE_BY_STATUS[rawStatus] || "unknown") : "unknown",
    raw_workflow_status: rawStatus,
    current_actor: actor,
    allowed_actions: Array.isArray(allowedActions) ? allowedActions : [],
    blocking_reasons: Array.isArray(blockingReasons) ? blockingReasons : [],
    workflow_timeline: Array.isArray(timeline) ? timeline : [],
  };
}

async function recordWorkflowTransition({
  registrationId,
  track,
  status,
  eventType,
  actorType,
  actorId = null,
  note = null,
  metadata = {},
  occurredAt = new Date(),
  deduplicationKey,
  transaction,
}) {
  const { RiwayatWorkflowPenjaluran } = require("../models");
  const normalized = normalizeWorkflow({ status });
  if (!Number.isInteger(Number(registrationId)) || Number(registrationId) <= 0 || !deduplicationKey) {
    throw new Error("Pendaftaran dan kunci deduplikasi histori workflow wajib valid.");
  }
  const [history] = await RiwayatWorkflowPenjaluran.findOrCreate({
    where: { deduplication_key: deduplicationKey },
    defaults: {
      pendaftaran_penjaluran_id: Number(registrationId),
      jalur: String(track || "").trim().toLowerCase(),
      raw_status: normalized.raw_workflow_status,
      workflow_stage: normalized.workflow_stage,
      event_type: eventType,
      actor_type: actorType,
      actor_id: Number(actorId) || null,
      note: String(note || "").trim() || null,
      metadata: metadata && typeof metadata === "object" ? metadata : {},
      occurred_at: occurredAt,
    },
    transaction,
  });
  return history;
}

function serializeWorkflowHistory(rows = []) {
  return (Array.isArray(rows) ? rows : []).map((row) => {
    const item = typeof row?.toJSON === "function" ? row.toJSON() : row;
    return {
      id: item.id,
      status: item.raw_status,
      workflow_stage: item.workflow_stage,
      event_type: item.event_type,
      actor: item.actor_type,
      actor_id: item.actor_id,
      note: item.note,
      metadata: item.metadata || {},
      at: item.occurred_at,
    };
  });
}

module.exports = { STAGE_BY_STATUS, normalizeWorkflow, recordWorkflowTransition, serializeWorkflowHistory };
