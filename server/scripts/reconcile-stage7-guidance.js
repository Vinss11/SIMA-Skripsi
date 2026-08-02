"use strict";

require("dotenv").config();
const db = require("../models");

async function scalar(sql) { const [rows] = await db.sequelize.query(sql); return Number(rows[0]?.count || 0); }
async function run() {
  const checks = [
    ["missing_context", `SELECT COUNT(*)::int AS count FROM "BimbinganSkripsis" WHERE legacy_context_status = 'resolved' AND (pendaftaran_penjaluran_id IS NULL OR target_assignment_id IS NULL OR target_assignment_member_id IS NULL OR effective_reviewer_assignment_id IS NULL OR effective_reviewer_assignment_member_id IS NULL OR periode_akademik_id IS NULL)`],
    ["effective_reviewer_pair_mismatch", `SELECT COUNT(*)::int AS count FROM "BimbinganSkripsis" b JOIN "PenetapanPembimbingDosens" m ON m.id=b.effective_reviewer_assignment_member_id WHERE m.penetapan_pembimbing_id <> b.effective_reviewer_assignment_id`],
    ["target_pair_mismatch", `SELECT COUNT(*)::int AS count FROM "BimbinganSkripsis" b JOIN "PenetapanPembimbingDosens" m ON m.id=b.target_assignment_member_id WHERE m.penetapan_pembimbing_id <> b.target_assignment_id OR m.dosen_id <> b.dosen_id`],
    ["counted_without_approved_version", `SELECT COUNT(*)::int AS count FROM "BimbinganSkripsis" b LEFT JOIN "GuidanceResumeVersions" v ON v.id=b.current_resume_version_id WHERE b.is_counted=true AND (v.id IS NULL OR v.status <> 'approved' OR v.invalidated_at IS NOT NULL)`],
    ["counted_without_active_evaluation", `SELECT COUNT(*)::int AS count FROM "BimbinganSkripsis" b WHERE b.is_counted=true AND NOT EXISTS (SELECT 1 FROM "GuidanceProgressEvaluations" e WHERE e.guidance_id=b.id AND e.counted=true AND e.superseded_at IS NULL)`],
    ["multiple_active_evaluation", `SELECT COUNT(*)::int AS count FROM (SELECT guidance_id FROM "GuidanceProgressEvaluations" WHERE superseded_at IS NULL GROUP BY guidance_id HAVING COUNT(*) > 1) duplicate`],
    ["transfer_without_event", `SELECT COUNT(*)::int AS count FROM "GuidanceReviewerTransfers" t LEFT JOIN "GuidanceEvents" e ON e.id=t.event_id WHERE e.id IS NULL`],
    ["reviewer_resolution_reason_inconsistent", `SELECT COUNT(*)::int AS count FROM "BimbinganSkripsis" WHERE (reviewer_resolution_status = 'needs_reviewer_resolution' AND reviewer_resolution_reason_code IS NULL) OR (reviewer_resolution_status = 'resolved' AND reviewer_resolution_reason_code IS NOT NULL)`],
    ["duplicate_backfill_event", `SELECT COUNT(*)::int AS count FROM (SELECT guidance_id, event_type, idempotency_key FROM "GuidanceEvents" WHERE event_type='legacy_backfill_classified' AND idempotency_key IS NOT NULL GROUP BY guidance_id, event_type, idempotency_key HAVING COUNT(*) > 1) duplicate`],
    ["null_row_version", `SELECT COUNT(*)::int AS count FROM "BimbinganSkripsis" WHERE row_version IS NULL OR row_version < 1`],
    ["ambiguous_counted", `SELECT COUNT(*)::int AS count FROM "BimbinganSkripsis" WHERE legacy_context_status <> 'resolved' AND is_counted=true`],
  ];
  const findings = [];
  for (const [type, sql] of checks) { const count = await scalar(sql); if (count) findings.push({ type, count }); }
  console.log(JSON.stringify({ total_findings: findings.reduce((sum, item) => sum + item.count, 0), findings }, null, 2));
}
run().then(() => db.sequelize.close()).catch(async (error) => { console.error(error); await db.sequelize.close(); process.exitCode = 1; });
