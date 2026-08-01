"use strict";

process.env.NODE_ENV = process.env.NODE_ENV || "development";
require("dotenv").config();

const { sequelize } = require("../models");

const execute = process.argv.includes("--execute");
const checks = {
  duplicate_academic_period: `SELECT tahun_mulai, tahun_selesai, semester, COUNT(*)::int AS count FROM "PeriodeAkademiks" WHERE tahun_mulai IS NOT NULL GROUP BY 1,2,3 HAVING COUNT(*) > 1`,
  unmapped_registration_window: `SELECT id, tahun_akademik, semester FROM "PeriodePenjalurans" WHERE periode_akademik_id IS NULL`,
  academic_period_without_official_dates: `SELECT id, kode FROM "PeriodeAkademiks" WHERE tanggal_mulai IS NULL OR tanggal_selesai IS NULL`,
  multiple_active_curriculum: `SELECT mahasiswa_id, COUNT(*)::int AS count FROM "MahasiswaKurikulums" WHERE is_active = true GROUP BY mahasiswa_id HAVING COUNT(*) > 1`,
  multiple_active_external_attempt: `SELECT source_id, external_record_id, COUNT(*)::int AS count FROM "PercobaanMataKuliahMahasiswas" WHERE is_active = true AND external_record_id IS NOT NULL GROUP BY 1,2 HAVING COUNT(*) > 1`,
  multiple_active_fallback_attempt: `SELECT source_id, mahasiswa_id, mata_kuliah_id, periode_akademik_id, kelas_normalized, attempt_ke, COUNT(*)::int AS count FROM "PercobaanMataKuliahMahasiswas" WHERE is_active = true AND external_record_id IS NULL GROUP BY 1,2,3,4,5,6 HAVING COUNT(*) > 1`,
  invalid_attempt_result: `SELECT id FROM "PercobaanMataKuliahMahasiswas" WHERE (status_registrasi IN ('planned','enrolled') AND status_kelulusan <> 'unknown') OR (status_registrasi IN ('withdrawn','cancelled') AND status_kelulusan = 'passed')`,
  methodology_without_evidence: `SELECT id, mahasiswa_id FROM "RiwayatMetodologiPenelitians" WHERE status = 'lulus' AND attempt_id IS NULL AND evidence_type NOT IN ('source_status','admin_correction')`,
  multiple_active_methodology_history: `SELECT mahasiswa_id, COUNT(*)::int AS count FROM "RiwayatMetodologiPenelitians" WHERE is_active = true GROUP BY mahasiswa_id HAVING COUNT(*) > 1`,
  absent_methodology_without_complete_scope: `SELECT r.id, r.mahasiswa_id FROM "RiwayatMetodologiPenelitians" r WHERE r.status = 'belum_mengambil' AND r.evidence_type = 'dataset_absence' AND NOT EXISTS (SELECT 1 FROM "CakupanDatasetAkademiks" c WHERE c.is_active = true AND c.is_complete = true AND c.periode_akademik_id = r.periode_akademik_id AND (c.mahasiswa_id = r.mahasiswa_id OR c.mahasiswa_id IS NULL))`,
  overlapping_completeness_scope: `SELECT dataset_type, periode_akademik_id, scope_type, COALESCE(mahasiswa_id,0) mahasiswa_id, COUNT(*)::int AS count FROM "CakupanDatasetAkademiks" WHERE is_active = true GROUP BY 1,2,3,4 HAVING COUNT(*) > 1`,
  multiple_active_rule_context: `SELECT context, COUNT(*)::int AS count FROM "RuleSetAkademiks" WHERE status = 'active' GROUP BY context HAVING COUNT(*) > 1`,
  duplicate_import_idempotency: `SELECT idempotency_key, COUNT(*)::int AS count FROM "ImportAkademikBatches" WHERE idempotency_key IS NOT NULL GROUP BY idempotency_key HAVING COUNT(*) > 1`,
  duplicate_equivalence_membership: `SELECT kelompok_id, mata_kuliah_id, COALESCE(kurikulum_id,0) kurikulum_id, COUNT(*)::int AS count FROM "EkuivalensiMataKuliahs" GROUP BY 1,2,3 HAVING COUNT(*) > 1`,
  multiple_current_snapshot: `SELECT mahasiswa_id, COUNT(*)::int AS count FROM "SnapshotAkademikMahasiswas" WHERE is_current = true GROUP BY mahasiswa_id HAVING COUNT(*) > 1`,
  stale_snapshot_without_job: `SELECT s.id, s.mahasiswa_id FROM "SnapshotAkademikMahasiswas" s WHERE s.is_current = true AND s.calculation_status IN ('stale','failed') AND NOT EXISTS (SELECT 1 FROM "PekerjaanSnapshotAkademiks" j WHERE j.mahasiswa_id = s.mahasiswa_id AND j.status IN ('queued','processing'))`,
  open_conflict_not_reflected: `SELECT c.id FROM "KonflikDataAkademiks" c LEFT JOIN "PercobaanMataKuliahMahasiswas" a ON c.entity_type = 'course_attempt' AND a.id = c.left_record_id WHERE c.status = 'open' AND c.entity_type IN ('student','course_attempt') AND NOT EXISTS (SELECT 1 FROM "SnapshotAkademikMahasiswas" s WHERE s.mahasiswa_id = CASE WHEN c.entity_type = 'student' THEN c.left_record_id ELSE a.mahasiswa_id END AND s.is_current = true AND s.data_state = 'conflicted')`,
  committed_batch_without_results: `SELECT b.id FROM "ImportAkademikBatches" b WHERE b.status = 'committed' AND NOT EXISTS (SELECT 1 FROM "ImportAkademikRows" r WHERE r.batch_id = b.id AND r.result_entity_id IS NOT NULL)`,
  orphan_evaluation: `SELECT e.id FROM "EvaluasiEligibilityAkademiks" e LEFT JOIN "SnapshotAkademikMahasiswas" s ON s.id = e.snapshot_id LEFT JOIN "RuleSetAkademiks" r ON r.id = e.rule_set_id WHERE (e.snapshot_id IS NOT NULL AND s.id IS NULL) OR (e.rule_set_id IS NOT NULL AND r.id IS NULL)`,
  failed_snapshot_job: `SELECT id, mahasiswa_id, attempt_count, last_error_code FROM "PekerjaanSnapshotAkademiks" WHERE status = 'failed'`,
  failed_or_stale_outbox: `SELECT id, event_type, status, attempt_count FROM "OutboxAkademiks" WHERE status = 'failed' OR (status = 'pending' AND available_at < NOW() - INTERVAL '1 day')`,
};

async function run() {
  const findings = {};
  for (const [code, sql] of Object.entries(checks)) {
    const [rows] = await sequelize.query(sql);
    findings[code] = { count: rows.length, rows };
  }
  // Execute is deliberately conservative: ambiguous academic facts are never
  // rewritten. It only refreshes retry timestamps for already-failed jobs.
  let jobsQueued = 0;
  if (execute) {
    const [, metadata] = await sequelize.query(`UPDATE "PekerjaanSnapshotAkademiks" SET status='queued', next_retry_at=NOW(), "updatedAt"=NOW() WHERE status='failed'`);
    jobsQueued = Number(metadata?.rowCount || 0);
  }
  const total = Object.values(findings).reduce((sum, item) => sum + item.count, 0);
  console.log(JSON.stringify({ mode: execute ? "execute" : "dry-run", jobs_queued: jobsQueued, total_findings: total, findings }, null, 2));
  await sequelize.close();
  // Temuan dry-run adalah keluaran operasional yang perlu ditindaklanjuti, bukan
  // kegagalan eksekusi script. Exit non-zero hanya digunakan untuk error teknis.
}

run().catch(async (error) => { console.error(error); await sequelize.close().catch(() => {}); process.exitCode = 1; });
