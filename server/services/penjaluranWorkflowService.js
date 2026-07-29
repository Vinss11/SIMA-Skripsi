"use strict";

const STAGE_BY_STATUS = {
  draft: "form_draft",
  pending: "registration_review",
  submitted: "review_dosen",
  review_dosen_magang: "review_dosen",
  review_sekprodi: "final_review_sekprodi",
  menunggu_set_ketua_cluster: "review_ketua_cluster",
  menunggu_approval_sekprodi: "final_review_sekprodi",
  approved: "completed",
  rejected: "rejected",
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

module.exports = { STAGE_BY_STATUS, normalizeWorkflow };
