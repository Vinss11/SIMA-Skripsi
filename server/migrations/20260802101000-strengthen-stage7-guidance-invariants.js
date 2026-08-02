"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.addConstraint("BimbinganSkripsis", { fields: ["target_urutan_snapshot"], type: "check",
        where: { [Sequelize.Op.or]: [{ target_urutan_snapshot: null }, { target_urutan_snapshot: { [Sequelize.Op.in]: [1, 2] } }] }, name: "ck_guidance_target_order", transaction });
      await queryInterface.addConstraint("BimbinganSkripsis", { fields: ["semester_penjaluran_ke_snapshot"], type: "check",
        where: { [Sequelize.Op.or]: [{ semester_penjaluran_ke_snapshot: null }, { semester_penjaluran_ke_snapshot: { [Sequelize.Op.gte]: 1 } }] }, name: "ck_guidance_semester_positive", transaction });
      await queryInterface.addConstraint("BimbinganSkripsis", { fields: ["row_version"], type: "check", where: { row_version: { [Sequelize.Op.gte]: 1 } }, name: "ck_guidance_row_version_positive", transaction });
      await queryInterface.addIndex("GuidanceReadinessRequests", ["mahasiswa_id", "pendaftaran_penjaluran_id", "idempotency_key"], { unique: true,
        where: { idempotency_key: { [Sequelize.Op.ne]: null } }, name: "uq_guidance_readiness_request_key", transaction });
      await queryInterface.addIndex("GuidanceRequirementPolicies", ["kode_program_studi", "program_kuliah", "jalur", "periode_akademik_id", "version"], {
        unique: true, name: "uq_guidance_policy_scope_version", transaction });
    });
  },
  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeIndex("GuidanceRequirementPolicies", "uq_guidance_policy_scope_version", { transaction });
      await queryInterface.removeIndex("GuidanceReadinessRequests", "uq_guidance_readiness_request_key", { transaction });
      await queryInterface.removeConstraint("BimbinganSkripsis", "ck_guidance_row_version_positive", { transaction });
      await queryInterface.removeConstraint("BimbinganSkripsis", "ck_guidance_semester_positive", { transaction });
      await queryInterface.removeConstraint("BimbinganSkripsis", "ck_guidance_target_order", { transaction });
    });
  },
};
