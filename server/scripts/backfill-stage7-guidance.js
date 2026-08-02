"use strict";

require("dotenv").config();
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { Op } = require("sequelize");
const db = require("../models");
const { canonicalRequestStatus, canonicalResumeStatus } = require("../services/guidanceStatusCompatibility");
const { resolvePolicy, evaluateGuidance } = require("../services/guidanceProgressService");
const { resolveProgramStudiCode } = require("../services/guidanceContextService");

const execute = process.argv.includes("--execute");
const argument = (name) => process.argv.find((item) => item.startsWith(`--${name}=`))?.split("=").slice(1).join("=") || null;
const batchSize = Math.min(1000, Math.max(1, Number(argument("batch-size") || 200)));
const afterId = Math.max(0, Number(argument("after-id") || 0));
const reportPath = argument("report");
const ACTIVE_TRACKS = new Set(["penelitian", "magang", "perintisan_bisnis"]);
const report = { mode: execute ? "execute" : "dry-run", batch_size: batchSize, after_id: afterId, resolved: 0,
  ambiguous: 0, excluded: 0, resume_versions_created: 0, evaluations_created: 0, failed: 0, failures: [], rows: [] };

function schedule(row) { const value = new Date(`${row.permintaan_tanggal}T${row.permintaan_jam}:00+07:00`); return Number.isNaN(value.getTime()) ? null : value; }
function hash(value) { return crypto.createHash("sha256").update(String(value)).digest("hex"); }
function normalizeTrack(registration) {
  const value = registration?.jalur === "alih" ? registration.penjaluran_baru
    : registration?.jenis_jalur_diambil || registration?.penjaluran_baru || registration?.penjaluran_sebelumnya;
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "_");
}
function classify({ track, resolvable }) {
  if (track === "pengabdian" || !ACTIVE_TRACKS.has(track)) return { classification: "excluded", reason: "TRACK_NOT_ENABLED" };
  if (resolvable) return { classification: "resolved", reason: null };
  return { classification: "ambiguous", reason: "ASSIGNMENT_CONTEXT_INCOMPLETE" };
}

async function run() {
  await db.sequelize.transaction(async (transaction) => {
    const rows = await db.BimbinganSkripsi.findAll({
      where: { id: { [Op.gt]: afterId }, legacy_context_status: "ambiguous" }, order: [["id", "ASC"]], limit: batchSize,
      transaction, lock: transaction.LOCK.UPDATE,
    });
    for (const row of rows) {
      const assignment = row.penetapan_pembimbing_id ? await db.PenetapanPembimbing.findOne({
        where: { id: row.penetapan_pembimbing_id, mahasiswa_id: row.mahasiswa_id }, transaction,
      }) : null;
      const registration = assignment?.pendaftaran_penjaluran_id ? await db.PendaftaranPenjaluran.findByPk(assignment.pendaftaran_penjaluran_id, {
        include: [{ model: db.PeriodePenjaluran, as: "periode" }], transaction,
      }) : null;
      const member = assignment ? await db.PenetapanPembimbingDosen.findOne({
        where: { penetapan_pembimbing_id: assignment.id, dosen_id: row.dosen_id }, transaction,
      }) : null;
      const track = normalizeTrack(registration);
      const resolvable = Boolean(assignment && registration && member && registration.periode?.periode_akademik_id && track);
      const result = classify({ track, resolvable });
      report[result.classification] += 1;
      report.rows.push({ guidance_id: row.id, classification: result.classification, reason: result.reason });
      if (!execute) continue;

      const changes = { request_status: canonicalRequestStatus(row.status_permohonan), scheduled_at: schedule(row), legacy_context_status: result.classification };
      if (result.classification === "resolved") Object.assign(changes, { pendaftaran_penjaluran_id: registration.id, target_assignment_id: assignment.id,
        target_assignment_member_id: member.id, target_urutan_snapshot: member.urutan, effective_reviewer_assignment_id: assignment.id,
        effective_reviewer_assignment_member_id: member.id, periode_akademik_id: registration.periode.periode_akademik_id,
        semester_penjaluran_ke_snapshot: assignment.semester_penjaluran_ke, jalur_snapshot: track, cycle_type_snapshot: registration.jalur,
        reviewer_dosen_id: member.dosen_id });
      await row.update(changes, { transaction });

      let version = row.current_resume_version_id ? await db.GuidanceResumeVersion.findByPk(row.current_resume_version_id, { transaction }) : null;
      if (row.resume_mahasiswa && !version) {
        version = await db.GuidanceResumeVersion.create({ guidance_id: row.id, version_number: 1, resume_text: row.resume_mahasiswa,
          submitted_by_mahasiswa_id: row.mahasiswa_id, submitted_at: row.updatedAt || row.createdAt, status: canonicalResumeStatus(row.status_resume),
          reviewed_by_assignment_member_id: row.status_resume === "approved" ? member?.id : null,
          reviewed_by_dosen_id: row.status_resume === "approved" ? (row.reviewer_dosen_id || row.dosen_id) : null,
          reviewed_at: row.tanggal_review_resume || row.updatedAt, review_note: row.catatan_review_resume,
          content_hash: hash(row.resume_mahasiswa) }, { transaction });
        await row.update({ current_resume_version_id: version.id, occurred_at: row.status_resume === "approved" ? (schedule(row) || row.tanggal_review_resume || row.updatedAt) : null,
          occurrence_source: row.status_resume === "approved" ? "legacy_approved_resume" : null }, { transaction });
        report.resume_versions_created += 1;
      }
      if (result.classification === "resolved" && version?.status === "approved") {
        const policy = await resolvePolicy({ kodeProgramStudi: resolveProgramStudiCode(registration), programKuliah: registration.program_kuliah || null,
          jalur: track, periodeAkademikId: registration.periode.periode_akademik_id, transaction });
        await evaluateGuidance({ guidance: row, resumeVersion: version, policy, transaction });
        await row.save({ transaction, fields: ["is_counted", "progress_policy_id"] });
        report.evaluations_created += 1;
      }
      const eventKey = `stage7-backfill:${row.id}:${result.classification}`;
      await db.GuidanceEvent.findOrCreate({ where: { guidance_id: row.id, event_type: "legacy_backfill_classified", idempotency_key: eventKey },
        defaults: { guidance_id: row.id, event_type: "legacy_backfill_classified", actor_type: "system", actor_role: "system",
          from_state: "ambiguous", to_state: result.classification, occurred_at: new Date(), reason_code: result.reason,
          idempotency_key: eventKey, metadata: { backfill: "stage7", track, assignment_id: assignment?.id || null } }, transaction });
    }
    report.next_after_id = rows.length ? Number(rows[rows.length - 1].id) : afterId;
    report.has_more = rows.length === batchSize;
  });
  report.total = report.resolved + report.ambiguous + report.excluded;
  report.checksum = hash(JSON.stringify(report.rows));
  const output = JSON.stringify(report, null, 2);
  if (reportPath) {
    const resolvedPath = path.resolve(reportPath);
    fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
    fs.writeFileSync(resolvedPath, `${output}\n`, "utf8");
  }
  console.log(output);
}

run().then(() => db.sequelize.close()).catch(async (error) => {
  report.failed += 1;
  report.failures.push({ type: "batch_failure", after_id: afterId, code: error.code || error.name || "BACKFILL_FAILED", message: error.message });
  report.checksum = hash(JSON.stringify(report.rows));
  const output = JSON.stringify(report, null, 2);
  if (reportPath) {
    const resolvedPath = path.resolve(reportPath); fs.mkdirSync(path.dirname(resolvedPath), { recursive: true }); fs.writeFileSync(resolvedPath, `${output}\n`, "utf8");
  }
  console.error(output); await db.sequelize.close(); process.exitCode = 1;
});
