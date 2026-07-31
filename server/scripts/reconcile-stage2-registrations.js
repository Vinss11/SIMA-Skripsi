"use strict";

require("dotenv").config();
const { sequelize } = require("../models");

sequelize.options.logging = false;

// Batas fitur mengikuti migration create-notifications (20260724090000).
// Record sebelum batas ini dilaporkan sebagai utang legacy dan tidak diperbaiki otomatis.
const NOTIFICATION_FEATURE_CUTOFF = "2026-07-24T09:00:00.000Z";

const FINAL_APPROVED_PREDICATE = `
  registration.status = 'approved'
  AND (
    (
      CASE
        WHEN registration.jalur = 'alih' THEN registration.penjaluran_baru::text
        ELSE registration.jenis_jalur_diambil::text
      END
    ) = 'penelitian'
    AND EXISTS (
        SELECT 1
        FROM "Pengajuans" submission
        WHERE submission.pendaftaran_penjaluran_id = registration.id
          AND submission.status = 'approved'
      )
    OR (
      CASE
        WHEN registration.jalur = 'alih' THEN registration.penjaluran_baru::text
        ELSE registration.jenis_jalur_diambil::text
      END
    ) <> 'penelitian'
    AND registration.form_lanjutan_status = 'approved'
    )
`;

async function queryRows(sql) {
  const [rows] = await sequelize.query(sql);
  return rows;
}

async function collectStage2Reconciliation() {
  const [
    duplicates,
    invalidTracks,
    approvedWithoutAssignments,
    assignmentsWithoutRegistrations,
    supervisorCacheMismatches,
    missingWorkflowHistory,
    inconsistentPerintisanGroups,
    finalizationsWithoutNotifications,
    multipleActiveAssignments,
  ] = await Promise.all([
    queryRows(`
      SELECT
        mahasiswa_id,
        periode_penjaluran_id,
        COUNT(*)::int AS total,
        ARRAY_AGG(id ORDER BY id) AS registration_ids
      FROM "PendaftaranPenjalurans"
      GROUP BY mahasiswa_id, periode_penjaluran_id
      HAVING COUNT(*) > 1
      ORDER BY mahasiswa_id, periode_penjaluran_id
    `),
    queryRows(`
      SELECT
        id,
        mahasiswa_id,
        periode_penjaluran_id,
        jalur,
        jenis_jalur_diambil,
        penjaluran_baru
      FROM "PendaftaranPenjalurans"
      WHERE CASE
        WHEN jalur = 'alih' THEN penjaluran_baru::text
        ELSE jenis_jalur_diambil::text
      END IS NULL
      OR CASE
        WHEN jalur = 'alih' THEN penjaluran_baru::text
        ELSE jenis_jalur_diambil::text
      END NOT IN ('penelitian', 'magang', 'perintisan_bisnis', 'pengabdian')
      ORDER BY id
    `),
    queryRows(`
      SELECT
        registration.id AS registration_id,
        registration.mahasiswa_id,
        registration.periode_penjaluran_id,
        registration.jalur,
        CASE
          WHEN registration.jalur = 'alih' THEN registration.penjaluran_baru::text
          ELSE registration.jenis_jalur_diambil::text
        END AS selected_track
      FROM "PendaftaranPenjalurans" registration
      WHERE ${FINAL_APPROVED_PREDICATE}
        AND NOT EXISTS (
          SELECT 1
          FROM "PenetapanPembimbings" assignment
          WHERE assignment.pendaftaran_penjaluran_id = registration.id
        )
      ORDER BY registration.id
    `),
    queryRows(`
      SELECT
        assignment.id AS assignment_id,
        assignment.mahasiswa_id,
        assignment.pendaftaran_penjaluran_id AS registration_id,
        assignment.status,
        assignment.sumber_data
      FROM "PenetapanPembimbings" assignment
      LEFT JOIN "PendaftaranPenjalurans" registration
        ON registration.id = assignment.pendaftaran_penjaluran_id
      WHERE registration.id IS NULL
      ORDER BY assignment.id
    `),
    queryRows(`
      SELECT
        assignment.id AS assignment_id,
        assignment.mahasiswa_id,
        student.dosen_pembimbing_skripsi_id AS cached_p1_dosen_id,
        member.dosen_id AS active_p1_dosen_id
      FROM "PenetapanPembimbings" assignment
      LEFT JOIN "PenetapanPembimbingDosens" member
        ON member.penetapan_pembimbing_id = assignment.id
       AND member.urutan = 1
       AND member.status = 'active'
      JOIN "Mahasiswas" student ON student.id = assignment.mahasiswa_id
      WHERE assignment.status = 'active'
        AND (
          member.id IS NULL
          OR student.dosen_pembimbing_skripsi_id IS DISTINCT FROM member.dosen_id
        )
      ORDER BY assignment.mahasiswa_id, assignment.id
    `),
    queryRows(`
      WITH registration_workflow AS (
        SELECT
          registration.*,
          CASE
            WHEN registration.jalur = 'alih' THEN registration.penjaluran_baru::text
            ELSE registration.jenis_jalur_diambil::text
          END AS selected_track
        FROM "PendaftaranPenjalurans" registration
      )
      SELECT
        registration.id AS registration_id,
        registration.mahasiswa_id,
        registration.form_lanjutan_status,
        registration.selected_track,
        CASE
          WHEN registration.selected_track = 'penelitian' THEN 'Pengajuans'
          ELSE 'PendaftaranPenjalurans.form_lanjutan_status'
        END AS workflow_source,
        CASE
          WHEN registration.selected_track = 'penelitian' THEN ARRAY(
            SELECT submission.status::text
            FROM "Pengajuans" submission
            WHERE submission.pendaftaran_penjaluran_id = registration.id
              AND submission.status IN (
                'pending', 'menunggu_set_ketua_cluster', 'menunggu_approval_sekprodi',
                'approved', 'rejected', 'completed'
              )
            ORDER BY submission.id
          )
          ELSE ARRAY[registration.form_lanjutan_status::text]
        END AS authoritative_workflow_statuses
      FROM registration_workflow registration
      WHERE (
          registration.selected_track = 'penelitian'
          AND EXISTS (
            SELECT 1
            FROM "Pengajuans" submission
            WHERE submission.pendaftaran_penjaluran_id = registration.id
              AND submission.status IN (
                'pending', 'menunggu_set_ketua_cluster', 'menunggu_approval_sekprodi',
                'approved', 'rejected', 'completed'
              )
          )
        OR
          registration.selected_track IN ('magang', 'perintisan_bisnis')
          AND registration.form_lanjutan_status IN (
            'submitted', 'review_dosen_magang', 'review_sekprodi', 'approved', 'rejected'
          )
        )
        AND NOT EXISTS (
          SELECT 1
          FROM "RiwayatWorkflowPenjalurans" history
          WHERE history.pendaftaran_penjaluran_id = registration.id
        )
      ORDER BY registration.id
    `),
    queryRows(`
      WITH group_audit AS (
        SELECT
          business_group.id AS group_id,
          business_group.periode_penjaluran_id,
          business_group.ketua_mahasiswa_id,
          business_group.status AS group_status,
          COUNT(member.id)::int AS member_count,
          COUNT(*) FILTER (WHERE member.posisi = 'ketua')::int AS leader_count,
          COUNT(*) FILTER (WHERE member.posisi = 'anggota')::int AS ordinary_member_count,
          COUNT(DISTINCT member.mahasiswa_id)::int AS distinct_student_count,
          COUNT(DISTINCT member.pendaftaran_penjaluran_id)::int AS distinct_registration_count,
          COUNT(DISTINCT member.peran_tim)::int AS distinct_team_role_count,
          ARRAY_REMOVE(ARRAY[
            CASE WHEN COUNT(member.id) <> 3 THEN 'member_count_must_be_three' END,
            CASE WHEN COUNT(*) FILTER (WHERE member.posisi = 'ketua') <> 1 THEN 'leader_count_must_be_one' END,
            CASE WHEN COUNT(*) FILTER (WHERE member.posisi = 'anggota') <> 2 THEN 'ordinary_member_count_must_be_two' END,
            CASE WHEN COUNT(DISTINCT member.mahasiswa_id) <> 3 THEN 'duplicate_student' END,
            CASE WHEN COUNT(DISTINCT member.pendaftaran_penjaluran_id) <> 3 THEN 'duplicate_registration' END,
            CASE WHEN COUNT(DISTINCT member.peran_tim) <> 3
              OR COUNT(*) FILTER (WHERE member.peran_tim = 'hustler') <> 1
              OR COUNT(*) FILTER (WHERE member.peran_tim = 'hipster') <> 1
              OR COUNT(*) FILTER (WHERE member.peran_tim = 'hacker') <> 1
              THEN 'team_roles_must_be_hustler_hipster_hacker' END,
            CASE WHEN COUNT(*) FILTER (
              WHERE member.posisi = 'ketua'
                AND member.mahasiswa_id = business_group.ketua_mahasiswa_id
            ) <> 1 THEN 'leader_reference_mismatch' END,
            CASE WHEN COUNT(*) FILTER (
              WHERE registration.id IS NULL
                 OR registration.mahasiswa_id <> member.mahasiswa_id
                 OR registration.periode_penjaluran_id <> business_group.periode_penjaluran_id
                 OR CASE
                      WHEN registration.jalur = 'alih' THEN registration.penjaluran_baru::text
                      ELSE registration.jenis_jalur_diambil::text
                    END <> 'perintisan_bisnis'
            ) > 0 THEN 'membership_registration_mismatch' END,
            CASE WHEN COUNT(DISTINCT registration.form_lanjutan_status) > 1
              THEN 'member_workflow_mismatch' END,
            CASE WHEN business_group.status = 'approved'
              AND NOT COALESCE(BOOL_AND(registration.form_lanjutan_status = 'approved'), false)
              THEN 'approved_group_has_unapproved_member' END,
            CASE WHEN business_group.status = 'rejected'
              AND NOT COALESCE(BOOL_AND(registration.form_lanjutan_status = 'rejected'), false)
              THEN 'rejected_group_has_nonrejected_member' END
          ], NULL) AS issues
        FROM "KelompokPerintisanBisnis" business_group
        LEFT JOIN "AnggotaKelompokPerintisans" member
          ON member.kelompok_id = business_group.id
        LEFT JOIN "PendaftaranPenjalurans" registration
          ON registration.id = member.pendaftaran_penjaluran_id
        GROUP BY business_group.id
      )
      SELECT *
      FROM group_audit
      WHERE CARDINALITY(issues) > 0
      ORDER BY group_id
    `),
    queryRows(`
      SELECT
        registration.id AS registration_id,
        registration.mahasiswa_id,
        assignment.id AS assignment_id,
        assignment."createdAt" AS assignment_created_at,
        CASE
          WHEN registration.jalur = 'alih' THEN registration.penjaluran_baru::text
          ELSE registration.jenis_jalur_diambil::text
        END AS selected_track,
        CASE
          WHEN assignment."createdAt" < TIMESTAMPTZ '${NOTIFICATION_FEATURE_CUTOFF}'
            THEN 'legacy_before_notification_feature'
          ELSE 'missing_notification_current_flow'
        END AS classification
      FROM "PendaftaranPenjalurans" registration
      JOIN "PenetapanPembimbings" assignment
        ON assignment.pendaftaran_penjaluran_id = registration.id
       AND assignment.status = 'active'
      WHERE ${FINAL_APPROVED_PREDICATE}
        AND NOT EXISTS (
          SELECT 1
          FROM "Notifikasis" notification
          WHERE notification.recipient_type = 'mahasiswa'
            AND notification.recipient_id = registration.mahasiswa_id
            AND notification.reference_type = 'penetapan_pembimbing'
            AND notification.reference_id = assignment.id
        )
      ORDER BY registration.id, assignment.id
    `),
    queryRows(`
      SELECT
        mahasiswa_id,
        COUNT(*)::int AS active_assignment_count,
        ARRAY_AGG(id ORDER BY id) AS assignment_ids
      FROM "PenetapanPembimbings"
      WHERE status = 'active'
      GROUP BY mahasiswa_id
      HAVING COUNT(*) > 1
      ORDER BY mahasiswa_id
    `),
  ]);

  const legacyNotificationFindings = finalizationsWithoutNotifications.filter(
    (item) => item.classification === "legacy_before_notification_feature"
  );
  const currentNotificationFindings = finalizationsWithoutNotifications.filter(
    (item) => item.classification === "missing_notification_current_flow"
  );

  const findings = {
    duplicate_student_period: duplicates,
    invalid_track: invalidTracks,
    final_approved_without_assignment: approvedWithoutAssignments,
    assignment_without_registration: assignmentsWithoutRegistrations,
    supervisor_cache_mismatch: supervisorCacheMismatches,
    missing_workflow_history: missingWorkflowHistory,
    inconsistent_perintisan_group: inconsistentPerintisanGroups,
    legacy_before_notification_feature: legacyNotificationFindings,
    missing_notification_current_flow: currentNotificationFindings,
    multiple_active_assignments: multipleActiveAssignments,
  };
  const counts = Object.fromEntries(
    Object.entries(findings).map(([name, rows]) => [name, rows.length])
  );

  return {
    notification_feature_cutoff: NOTIFICATION_FEATURE_CUTOFF,
    counts,
    findings,
    total_findings: Object.values(counts).reduce((total, count) => total + count, 0),
  };
}

async function main() {
  const execute = process.argv.includes("--execute");
  const reconciliation = await collectStage2Reconciliation();
  const report = {
    mode: execute ? "execute" : "dry-run",
    ...reconciliation,
  };

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (execute && reconciliation.total_findings > 0) {
    throw new Error(
      "Rekonsiliasi Tahap 2 menemukan anomali. Tidak ada perbaikan otomatis karena keputusan pasangan data, kelompok, dan penetapan harus diverifikasi manual."
    );
  }
  if (execute) {
    process.stdout.write("Data Tahap 2 terverifikasi; seluruh pemeriksaan operasional bersih.\n");
  }
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      await sequelize.close();
    });
}

module.exports = {
  collectStage2Reconciliation,
};
