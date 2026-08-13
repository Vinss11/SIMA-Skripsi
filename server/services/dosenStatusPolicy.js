"use strict";

const DOSEN_STATUSES = ["active", "study_permission", "inactive", "study_leave", "retired"];
const DPA_ELIGIBLE_STATUSES = ["active", "study_permission"];

function normalizeDosenStatus(value, fallback = "active") {
  const normalized = String(value || "").trim().toLowerCase();
  return DOSEN_STATUSES.includes(normalized) ? normalized : fallback;
}

function normalizeContinueExistingSupervision(status, requestedValue) {
  const normalizedStatus = normalizeDosenStatus(status);
  if (["active", "study_permission"].includes(normalizedStatus)) return true;
  if (normalizedStatus === "retired") return false;
  return requestedValue === true;
}

function getDosenStatusDecision({
  statusKeaktifan = "active",
  accountIsActive = true,
  continueExistingSupervision = true,
} = {}) {
  const status = normalizeDosenStatus(statusKeaktifan);
  const canContinue = normalizeContinueExistingSupervision(status, continueExistingSupervision);
  const masterActive = status === "active";

  return {
    status,
    can_login: status !== "retired" && accountIsActive !== false,
    can_be_dpa: DPA_ELIGIBLE_STATUSES.includes(status),
    can_receive_new_assignment: masterActive,
    can_continue_existing_supervision: canContinue,
    requires_supervisor_replacement: !canContinue,
  };
}

function evaluateNewAssignmentEligibility({
  statusKeaktifan = "active",
  configurationStatus,
  menerimaBimbinganBaru,
  remainingQuota,
  requiredSlots = 1,
} = {}) {
  const decision = getDosenStatusDecision({ statusKeaktifan });
  if (!decision.can_receive_new_assignment) {
    return { allowed: false, reason: "master_status" };
  }
  if (configurationStatus !== undefined && configurationStatus !== "ready") {
    return { allowed: false, reason: "configuration_not_ready" };
  }
  if (menerimaBimbinganBaru !== undefined && menerimaBimbinganBaru !== true) {
    return { allowed: false, reason: "not_accepting_new_supervision" };
  }
  if (remainingQuota !== undefined) {
    const normalizedRequiredSlots = Math.max(1, Number(requiredSlots || 1));
    if (Number(remainingQuota) < normalizedRequiredSlots) {
      return {
        allowed: false,
        reason: "insufficient_quota",
        required_slots: normalizedRequiredSlots,
        remaining_quota: Number(remainingQuota),
      };
    }
  }
  return { allowed: true, reason: null };
}

function canReceiveNewAssignment(input = {}) {
  return evaluateNewAssignmentEligibility(input).allowed;
}

function evaluateDosenStatusFollowUp({
  statusBaru,
  statusLama,
  continueExisting,
  impact = {},
} = {}) {
  const nextStatus = normalizeDosenStatus(statusBaru);
  const previousStatus = normalizeDosenStatus(statusLama, nextStatus);
  const becomesUnavailable = nextStatus !== "active";
  const isReactivation = nextStatus === "active" && previousStatus !== "active";
  const canContinue = normalizeContinueExistingSupervision(nextStatus, continueExisting);

  const replacementRequired = becomesUnavailable
    && !canContinue
    && Number(impact.mahasiswa_bimbingan_aktif || 0) > 0;
  const roleAdjustmentRequired = becomesUnavailable && [
    impact.tugas_ketua_cluster_aktif,
    impact.tugas_periode_aktif,
    impact.tugas_master_penanggung_jawab,
  ].some((value) => Number(value || 0) > 0);
  const defenseAdjustmentRequired = becomesUnavailable
    && Number(impact.jadwal_sidang_mendatang || 0) > 0;
  const reviewTransferRequired = becomesUnavailable && [
    impact.review_pending,
    impact.pengajuan_penjaluran_pending,
    impact.review_paralel_pending,
    impact.calon_pembimbing_mandiri_pending,
  ].some((value) => Number(value || 0) > 0);

  const reasons = [];
  if (replacementRequired) reasons.push("supervisor_replacement");
  if (roleAdjustmentRequired) reasons.push("role_adjustment");
  if (defenseAdjustmentRequired) reasons.push("defense_adjustment");
  if (reviewTransferRequired) reasons.push("review_transfer");

  return {
    required: reasons.length > 0,
    reasons,
    replacement_required: replacementRequired,
    role_adjustment_required: roleAdjustmentRequired,
    defense_adjustment_required: defenseAdjustmentRequired,
    review_transfer_required: reviewTransferRequired,
    reactivation_required: isReactivation,
  };
}

module.exports = {
  DOSEN_STATUSES,
  DPA_ELIGIBLE_STATUSES,
  normalizeDosenStatus,
  normalizeContinueExistingSupervision,
  getDosenStatusDecision,
  evaluateNewAssignmentEligibility,
  canReceiveNewAssignment,
  evaluateDosenStatusFollowUp,
};
