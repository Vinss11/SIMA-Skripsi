"use strict";

const ACADEMIC_TABLES = [
  "OutboxAkademiks",
  "PekerjaanSnapshotAkademiks",
  "KonflikDataAkademiks",
  "KoreksiDataAkademiks",
  "EvaluasiEligibilityAkademiks",
  "RuleSetAkademiks",
  "SnapshotAkademikMahasiswas",
  "RiwayatMetodologiPenelitians",
  "KewajibanMataKuliahPenjalurans",
  "CakupanDatasetAkademiks",
  "ImportAkademikRows",
  "ImportAkademikBatches",
  "MahasiswaKurikulums",
  "KurikulumMataKuliahs",
  "EkuivalensiMataKuliahs",
  "KelompokEkuivalensiMataKuliahs",
  "MataKuliahAliases",
  "Kurikulums",
  "SumberDataAkademiks",
];

const GUIDANCE_TABLES = [
  "GuidanceProgressRecalculationJobs",
  "GuidanceCommandReceipts",
  "GuidanceReadinessFacts",
  "GuidanceReadinessApprovals",
  "GuidanceReadinessRequests",
  "GuidanceProgressSnapshots",
  "GuidanceProgressEvaluations",
  "GuidanceRequirementPolicies",
  "GuidanceReviewerTransfers",
  "GuidanceEvents",
  "GuidanceResumeVersions",
];

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // Resume versions were dual-written to BimbinganSkripsis. Copy the latest
      // version once more so legacy rows also retain their business data.
      await queryInterface.sequelize.query(`
        WITH latest_resume AS (
          SELECT DISTINCT ON (rv."guidance_id") rv.*
          FROM "GuidanceResumeVersions" rv
          ORDER BY rv."guidance_id", rv."version_number" DESC, rv."id" DESC
        )
        UPDATE "BimbinganSkripsis" AS b
        SET
          "resume_mahasiswa" = COALESCE(v."resume_text", b."resume_mahasiswa"),
          "status_resume" = CASE
            WHEN v."status" = 'approved' THEN 'approved'::"enum_BimbinganSkripsis_status_resume"
            WHEN v."status" IN ('revision_required', 'invalidated') THEN 'revisi'::"enum_BimbinganSkripsis_status_resume"
            WHEN v."status" = 'submitted' THEN 'submitted'::"enum_BimbinganSkripsis_status_resume"
            ELSE b."status_resume"
          END,
          "catatan_review_resume" = COALESCE(v."review_note", b."catatan_review_resume"),
          "tanggal_review_resume" = COALESCE(v."reviewed_at", b."tanggal_review_resume"),
          "is_counted" = CASE WHEN v."status" = 'approved' THEN TRUE ELSE b."is_counted" END
        FROM latest_resume AS v
        WHERE v."guidance_id" = b."id"
      `, { transaction });

      await queryInterface.sequelize.query(`
        ALTER TABLE "BimbinganSkripsis"
          DROP COLUMN IF EXISTS "current_resume_version_id" CASCADE,
          DROP COLUMN IF EXISTS "progress_policy_id" CASCADE
      `, { transaction });

      await queryInterface.sequelize.query(`
        ALTER TABLE "PercobaanMataKuliahMahasiswas"
          DROP COLUMN IF EXISTS "source_id" CASCADE,
          DROP COLUMN IF EXISTS "import_row_id" CASCADE,
          DROP COLUMN IF EXISTS "external_revision" CASCADE
      `, { transaction });
      await queryInterface.sequelize.query(`
        ALTER TABLE "MappingMataKuliahPenjalurans"
          DROP COLUMN IF EXISTS "kurikulum_id" CASCADE
      `, { transaction });
      await queryInterface.addIndex("MappingMataKuliahPenjalurans", ["jalur", "program_kuliah", "periode_berlaku_id"], {
        unique: true,
        name: "mapping_penjaluran_track_program_period_unique",
        transaction,
      });

      for (const table of GUIDANCE_TABLES) {
        await queryInterface.sequelize.query(`DROP TABLE IF EXISTS "${table}" CASCADE`, { transaction });
      }
      for (const table of ACADEMIC_TABLES) {
        await queryInterface.sequelize.query(`DROP TABLE IF EXISTS "${table}" CASCADE`, { transaction });
      }
    });
  },

  async down() {
    throw new Error("Migration penyederhanaan ini bersifat irreversible karena tabel yang dihapus telah dipensiunkan beserta data teknisnya.");
  },
};
