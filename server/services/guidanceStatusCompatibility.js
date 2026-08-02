"use strict";

const REQUEST_STATUS_MAP = Object.freeze({ approved: "accepted", expired: "withdrawn", pending: "pending", rescheduled: "rescheduled", rejected: "rejected", cancelled_supervisor_change: "cancelled_supervisor_change" });
const RESUME_STATUS_MAP = Object.freeze({ belum_diisi: "not_submitted", submitted: "submitted", approved: "approved", revisi: "revision_required", rejected: "revision_required" });

function canonicalRequestStatus(value) { return REQUEST_STATUS_MAP[String(value || "").toLowerCase()] || null; }
function canonicalResumeStatus(value) { return RESUME_STATUS_MAP[String(value || "").toLowerCase()] || null; }
function legacyRequestStatus(value) { return value === "accepted" ? "approved" : value === "withdrawn" ? "expired" : value; }

module.exports = { REQUEST_STATUS_MAP, RESUME_STATUS_MAP, canonicalRequestStatus, canonicalResumeStatus, legacyRequestStatus };
