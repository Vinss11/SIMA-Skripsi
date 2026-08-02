"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const fk = (table, fields, referencedTable, name, onDelete = "RESTRICT") => queryInterface.addConstraint(table, {
        fields, type: "foreign key", references: { table: referencedTable, field: "id" }, onDelete, onUpdate: "CASCADE", name, transaction,
      });
      await fk("BimbinganSkripsis", ["current_resume_version_id"], "GuidanceResumeVersions", "fk_guidance_current_resume_version", "SET NULL");
      await fk("BimbinganSkripsis", ["progress_policy_id"], "GuidanceRequirementPolicies", "fk_guidance_progress_policy", "SET NULL");
      for (const [field, table, name, deletion] of [
        ["from_assignment_id", "PenetapanPembimbings", "fk_guidance_transfer_from_assignment", "SET NULL"],
        ["from_assignment_member_id", "PenetapanPembimbingDosens", "fk_guidance_transfer_from_member", "SET NULL"],
        ["to_assignment_id", "PenetapanPembimbings", "fk_guidance_transfer_to_assignment", "RESTRICT"],
        ["to_assignment_member_id", "PenetapanPembimbingDosens", "fk_guidance_transfer_to_member", "RESTRICT"],
      ]) await fk("GuidanceReviewerTransfers", [field], table, name, deletion);
      await fk("GuidanceResumeVersions", ["submitted_by_mahasiswa_id"], "Mahasiswas", "fk_guidance_resume_student", "RESTRICT");
      await fk("GuidanceResumeVersions", ["reviewed_by_assignment_member_id"], "PenetapanPembimbingDosens", "fk_guidance_resume_reviewer_member", "SET NULL");
      await fk("GuidanceResumeVersions", ["reviewed_by_dosen_id"], "Dosens", "fk_guidance_resume_reviewer_dosen", "SET NULL");
      await fk("GuidanceResumeVersions", ["previous_version_id"], "GuidanceResumeVersions", "fk_guidance_resume_previous", "SET NULL");
      await fk("GuidanceRequirementPolicies", ["periode_akademik_id"], "PeriodeAkademiks", "fk_guidance_policy_academic_period", "RESTRICT");
      await fk("GuidanceProgressEvaluations", ["resume_version_id"], "GuidanceResumeVersions", "fk_guidance_evaluation_resume", "SET NULL");
      await fk("GuidanceProgressEvaluations", ["policy_id"], "GuidanceRequirementPolicies", "fk_guidance_evaluation_policy", "RESTRICT");
      await fk("GuidanceProgressEvaluations", ["cycle_registration_id"], "PendaftaranPenjalurans", "fk_guidance_evaluation_cycle", "RESTRICT");
      await fk("GuidanceProgressEvaluations", ["periode_akademik_id"], "PeriodeAkademiks", "fk_guidance_evaluation_period", "RESTRICT");
      await fk("GuidanceProgressSnapshots", ["mahasiswa_id"], "Mahasiswas", "fk_guidance_snapshot_student", "RESTRICT");
      await fk("GuidanceProgressSnapshots", ["cycle_registration_id"], "PendaftaranPenjalurans", "fk_guidance_snapshot_cycle", "RESTRICT");
      await fk("GuidanceProgressSnapshots", ["assignment_id"], "PenetapanPembimbings", "fk_guidance_snapshot_assignment", "RESTRICT");
      await fk("GuidanceProgressSnapshots", ["policy_id"], "GuidanceRequirementPolicies", "fk_guidance_snapshot_policy", "RESTRICT");
      await fk("GuidanceReadinessRequests", ["mahasiswa_id"], "Mahasiswas", "fk_guidance_readiness_student", "RESTRICT");
      await fk("GuidanceReadinessRequests", ["pendaftaran_penjaluran_id"], "PendaftaranPenjalurans", "fk_guidance_readiness_cycle", "RESTRICT");
      await fk("GuidanceReadinessRequests", ["active_assignment_id"], "PenetapanPembimbings", "fk_guidance_readiness_assignment", "RESTRICT");
      await fk("GuidanceReadinessRequests", ["policy_id"], "GuidanceRequirementPolicies", "fk_guidance_readiness_policy", "RESTRICT");
      await fk("GuidanceReadinessApprovals", ["readiness_request_id"], "GuidanceReadinessRequests", "fk_guidance_readiness_approval_request", "RESTRICT");
      await fk("GuidanceReadinessApprovals", ["assignment_member_id"], "PenetapanPembimbingDosens", "fk_guidance_readiness_approval_member", "RESTRICT");
      await fk("GuidanceReadinessFacts", ["readiness_request_id"], "GuidanceReadinessRequests", "fk_guidance_fact_request", "RESTRICT");
      await fk("GuidanceReadinessFacts", ["policy_id"], "GuidanceRequirementPolicies", "fk_guidance_fact_policy", "RESTRICT");
    });
  },
  async down(queryInterface) {
    const constraints = {
      BimbinganSkripsis: ["fk_guidance_current_resume_version", "fk_guidance_progress_policy"],
      GuidanceReviewerTransfers: ["fk_guidance_transfer_from_assignment", "fk_guidance_transfer_from_member", "fk_guidance_transfer_to_assignment", "fk_guidance_transfer_to_member"],
      GuidanceResumeVersions: ["fk_guidance_resume_student", "fk_guidance_resume_reviewer_member", "fk_guidance_resume_reviewer_dosen", "fk_guidance_resume_previous"],
      GuidanceRequirementPolicies: ["fk_guidance_policy_academic_period"],
      GuidanceProgressEvaluations: ["fk_guidance_evaluation_resume", "fk_guidance_evaluation_policy", "fk_guidance_evaluation_cycle", "fk_guidance_evaluation_period"],
      GuidanceProgressSnapshots: ["fk_guidance_snapshot_student", "fk_guidance_snapshot_cycle", "fk_guidance_snapshot_assignment", "fk_guidance_snapshot_policy"],
      GuidanceReadinessRequests: ["fk_guidance_readiness_student", "fk_guidance_readiness_cycle", "fk_guidance_readiness_assignment", "fk_guidance_readiness_policy"],
      GuidanceReadinessApprovals: ["fk_guidance_readiness_approval_request", "fk_guidance_readiness_approval_member"],
      GuidanceReadinessFacts: ["fk_guidance_fact_request", "fk_guidance_fact_policy"],
    };
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const [table, names] of Object.entries(constraints)) for (const name of names) await queryInterface.removeConstraint(table, name, { transaction });
    });
  },
};
