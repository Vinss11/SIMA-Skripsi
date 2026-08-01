"use strict";

require("dotenv").config();
const { QueryTypes } = require("sequelize");
const { sequelize } = require("../models");

const execute = process.argv.includes("--execute");

const checks = [
  ["multiple_active_assignments", `SELECT mahasiswa_id, COUNT(*)::int AS count FROM "PenetapanPembimbings" WHERE status = 'active' GROUP BY mahasiswa_id HAVING COUNT(*) > 1`],
  ["multiple_scheduled_transitions", `SELECT mahasiswa_id, periode_mulai_id, semester_penjaluran_ke, COUNT(*)::int AS count FROM "PenetapanPembimbings" WHERE status = 'scheduled' GROUP BY mahasiswa_id, periode_mulai_id, semester_penjaluran_ke HAVING COUNT(*) > 1`],
  ["ended_without_reason_code", `SELECT id, mahasiswa_id FROM "PenetapanPembimbings" WHERE status = 'ended' AND end_reason_code IS NULL`],
  ["semester_out_of_range", `SELECT id, mahasiswa_id, semester_penjaluran_ke FROM "PenetapanPembimbings" WHERE semester_penjaluran_ke IS NULL OR semester_penjaluran_ke NOT BETWEEN 1 AND 3`],
  ["broken_previous_assignment", `SELECT child.id, child.previous_assignment_id FROM "PenetapanPembimbings" child LEFT JOIN "PenetapanPembimbings" parent ON parent.id = child.previous_assignment_id WHERE child.previous_assignment_id IS NOT NULL AND (parent.id IS NULL OR parent.mahasiswa_id <> child.mahasiswa_id OR parent.pendaftaran_penjaluran_id IS DISTINCT FROM child.pendaftaran_penjaluran_id)`],
  ["semester_three_without_approved_extension", `SELECT a.id, a.izin_lanjut_id FROM "PenetapanPembimbings" a LEFT JOIN "IzinLanjutSkripsis" i ON i.id = a.izin_lanjut_id WHERE a.semester_penjaluran_ke = 3 AND a.status <> 'cancelled' AND (i.id IS NULL OR i.status <> 'approved')`],
  ["semester_three_extension_identity_mismatch", `SELECT a.id AS assignment_id, i.id AS izin_id, a.mahasiswa_id AS assignment_mahasiswa_id, i.mahasiswa_id AS izin_mahasiswa_id, a.pendaftaran_penjaluran_id AS assignment_pendaftaran_id, i.pendaftaran_penjaluran_id AS izin_pendaftaran_id, a.previous_assignment_id, i.penetapan_asal_id FROM "PenetapanPembimbings" a JOIN "IzinLanjutSkripsis" i ON i.id = a.izin_lanjut_id WHERE a.semester_penjaluran_ke = 3 AND a.status <> 'cancelled' AND (i.mahasiswa_id <> a.mahasiswa_id OR i.pendaftaran_penjaluran_id IS DISTINCT FROM a.pendaftaran_penjaluran_id OR i.penetapan_asal_id IS DISTINCT FROM a.previous_assignment_id OR i.penetapan_hasil_id IS DISTINCT FROM a.id)`],
  ["approved_extension_without_assignment", `SELECT i.id, i.mahasiswa_id FROM "IzinLanjutSkripsis" i LEFT JOIN "PenetapanPembimbings" a ON a.id = i.penetapan_hasil_id WHERE i.status = 'approved' AND a.id IS NULL AND NOT EXISTS (SELECT 1 FROM "AnggotaKelompokPerintisans" member JOIN "KelompokPerintisanBisnis" kelompok ON kelompok.id = member.kelompok_id WHERE member.pendaftaran_penjaluran_id = i.pendaftaran_penjaluran_id AND kelompok.status = 'approved')`],
  ["approved_extension_result_mismatch", `SELECT i.id AS izin_id, i.penetapan_hasil_id AS assignment_id FROM "IzinLanjutSkripsis" i JOIN "PenetapanPembimbings" a ON a.id = i.penetapan_hasil_id WHERE i.status = 'approved' AND (a.izin_lanjut_id IS DISTINCT FROM i.id OR a.mahasiswa_id <> i.mahasiswa_id OR a.pendaftaran_penjaluran_id IS DISTINCT FROM i.pendaftaran_penjaluran_id OR a.previous_assignment_id IS DISTINCT FROM i.penetapan_asal_id)`],
  ["perintisan_incomplete_semester_three_transition", `SELECT kelompok.id AS kelompok_id, COUNT(DISTINCT anggota.id)::int AS member_count, COUNT(DISTINCT target.id)::int AS target_count, COUNT(DISTINCT izin.id)::int AS linked_extension_count FROM "KelompokPerintisanBisnis" kelompok JOIN "AnggotaKelompokPerintisans" anggota ON anggota.kelompok_id = kelompok.id LEFT JOIN "PenetapanPembimbings" source ON source.pendaftaran_penjaluran_id = anggota.pendaftaran_penjaluran_id AND source.semester_penjaluran_ke = 2 LEFT JOIN "PenetapanPembimbings" target ON target.previous_assignment_id = source.id AND target.semester_penjaluran_ke = 3 AND target.status <> 'cancelled' LEFT JOIN "IzinLanjutSkripsis" izin ON izin.id = target.izin_lanjut_id GROUP BY kelompok.id HAVING COUNT(DISTINCT target.id) > 0 AND (COUNT(DISTINCT anggota.id) <> 3 OR COUNT(DISTINCT target.id) <> 3 OR COUNT(DISTINCT izin.id) <> 3)`],
  ["perintisan_approved_extensions_not_transitioned", `SELECT kelompok.id AS kelompok_id, COUNT(DISTINCT izin.id)::int AS approved_extension_count, COUNT(DISTINCT target.id)::int AS target_count FROM "KelompokPerintisanBisnis" kelompok JOIN "AnggotaKelompokPerintisans" anggota ON anggota.kelompok_id = kelompok.id JOIN "PenetapanPembimbings" source ON source.pendaftaran_penjaluran_id = anggota.pendaftaran_penjaluran_id AND source.semester_penjaluran_ke = 2 JOIN "IzinLanjutSkripsis" izin ON izin.penetapan_asal_id = source.id AND izin.status = 'approved' LEFT JOIN "PenetapanPembimbings" target ON target.previous_assignment_id = source.id AND target.semester_penjaluran_ke = 3 AND target.status <> 'cancelled' GROUP BY kelompok.id HAVING COUNT(DISTINCT izin.id) = 3 AND COUNT(DISTINCT target.id) <> 3`],
  ["perintisan_supervisor_composition_mismatch", `WITH signatures AS (SELECT anggota.kelompok_id, assignment.semester_penjaluran_ke, assignment.id AS assignment_id, STRING_AGG(member.urutan::text || ':' || member.dosen_id::text, '|' ORDER BY member.urutan) AS signature FROM "AnggotaKelompokPerintisans" anggota JOIN "PenetapanPembimbings" assignment ON assignment.pendaftaran_penjaluran_id = anggota.pendaftaran_penjaluran_id AND assignment.status IN ('active', 'scheduled', 'draft') JOIN "PenetapanPembimbingDosens" member ON member.penetapan_pembimbing_id = assignment.id GROUP BY anggota.kelompok_id, assignment.semester_penjaluran_ke, assignment.id) SELECT kelompok_id, semester_penjaluran_ke, COUNT(DISTINCT signature)::int AS signature_count FROM signatures GROUP BY kelompok_id, semester_penjaluran_ke HAVING COUNT(DISTINCT signature) > 1`],
  ["perintisan_needs_review_without_followup", `SELECT kelompok.id, kelompok.review_reason_code, kelompok.review_detail FROM "KelompokPerintisanBisnis" kelompok WHERE kelompok.status = 'needs_review' AND (kelompok.review_reason_code IS NULL OR kelompok.review_detail IS NULL OR NOT EXISTS (SELECT 1 FROM "Notifikasis" n WHERE n.reference_type = 'kelompok_perintisan_bisnis' AND n.reference_id = kelompok.id AND n.type = 'perintisan_group_review_required'))`],
  ["guidance_without_assignment", `SELECT id, mahasiswa_id, pendaftaran_penjaluran_id, dosen_id, "createdAt" FROM "BimbinganSkripsis" WHERE penetapan_pembimbing_id IS NULL`],
  ["guidance_assignment_mismatch", `SELECT b.id, b.penetapan_pembimbing_id FROM "BimbinganSkripsis" b JOIN "PenetapanPembimbings" a ON a.id = b.penetapan_pembimbing_id WHERE a.mahasiswa_id <> b.mahasiswa_id OR a.pendaftaran_penjaluran_id IS DISTINCT FROM b.pendaftaran_penjaluran_id OR NOT EXISTS (SELECT 1 FROM "PenetapanPembimbingDosens" m WHERE m.penetapan_pembimbing_id = a.id AND m.dosen_id = b.dosen_id)`],
  ["scheduled_overdue", `SELECT id, mahasiswa_id, effective_at FROM "PenetapanPembimbings" WHERE status = 'scheduled' AND effective_at <= NOW()`],
  ["activation_failed", `SELECT a.id, a.mahasiswa_id, job.attempt_count, job.error_code, job.error_message FROM "AssignmentActivationAttempts" job JOIN "PenetapanPembimbings" a ON a.id = job.penetapan_pembimbing_id WHERE job.status = 'activation_failed'`],
  ["cache_primary_mismatch", `SELECT m.id AS mahasiswa_id, m.dosen_pembimbing_skripsi_id AS cache_p1, member.dosen_id AS assignment_p1 FROM "Mahasiswas" m JOIN "PenetapanPembimbings" a ON a.mahasiswa_id = m.id AND a.status = 'active' JOIN "PenetapanPembimbingDosens" member ON member.penetapan_pembimbing_id = a.id AND member.urutan = 1 WHERE m.dosen_pembimbing_skripsi_id IS DISTINCT FROM member.dosen_id`],
];

async function backfillGuidance(transaction) {
  const [result] = await sequelize.query(`
    WITH candidates AS (
      SELECT b.id AS guidance_id, MIN(a.id) AS assignment_id, COUNT(DISTINCT a.id)::int AS matches
      FROM "BimbinganSkripsis" b
      JOIN "PenetapanPembimbings" a
        ON a.mahasiswa_id = b.mahasiswa_id
       AND a.pendaftaran_penjaluran_id = b.pendaftaran_penjaluran_id
       AND a.status IN ('active', 'ended')
       AND COALESCE(a.effective_at, a.tanggal_mulai, a."createdAt") <= b."createdAt"
       AND (a.tanggal_selesai IS NULL OR b."createdAt" < a.tanggal_selesai)
      JOIN "PenetapanPembimbingDosens" member
        ON member.penetapan_pembimbing_id = a.id AND member.dosen_id = b.dosen_id
      WHERE b.penetapan_pembimbing_id IS NULL
      GROUP BY b.id
    )
    UPDATE "BimbinganSkripsis" b
       SET penetapan_pembimbing_id = candidates.assignment_id,
           "updatedAt" = NOW()
      FROM candidates
     WHERE b.id = candidates.guidance_id AND candidates.matches = 1
  `, { transaction });
  return Number(result?.rowCount || 0);
}

async function main() {
  let guidanceBackfilled = 0;
  if (execute) guidanceBackfilled = await sequelize.transaction(backfillGuidance);
  const findings = {};
  let total = 0;
  for (const [name, sql] of checks) {
    const rows = await sequelize.query(sql, { type: QueryTypes.SELECT });
    findings[name] = { count: rows.length, rows: rows.slice(0, 100) };
    total += rows.length;
  }
  console.log(JSON.stringify({ mode: execute ? "execute" : "dry-run", guidance_backfilled: guidanceBackfilled, total_findings: total, findings }, null, 2));
  if (total) process.exitCode = 2;
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => sequelize.close());
