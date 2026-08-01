"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    if (queryInterface.sequelize.getDialect() === "postgres") {
      await queryInterface.sequelize.query(
        'ALTER TYPE "enum_KelompokPerintisanBisnis_status" ADD VALUE IF NOT EXISTS \'needs_review\';'
      );
    }

    await queryInterface.sequelize.transaction(async (transaction) => {
      const columns = await queryInterface.describeTable("IzinLanjutSkripsis");
      if (!columns.decision_idempotency_key) {
        await queryInterface.addColumn("IzinLanjutSkripsis", "decision_idempotency_key", {
          type: Sequelize.STRING(160), allowNull: true,
        }, { transaction });
      }
      if (!columns.decision_request_fingerprint) {
        await queryInterface.addColumn("IzinLanjutSkripsis", "decision_request_fingerprint", {
          type: Sequelize.STRING(64), allowNull: true,
        }, { transaction });
      }
      await queryInterface.addIndex("IzinLanjutSkripsis", ["decision_idempotency_key"], {
        name: "uq_extension_decision_idempotency_key",
        unique: true,
        where: { decision_idempotency_key: { [Sequelize.Op.ne]: null } },
        transaction,
      });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeIndex("IzinLanjutSkripsis", "uq_extension_decision_idempotency_key", { transaction });
      await queryInterface.removeColumn("IzinLanjutSkripsis", "decision_request_fingerprint", { transaction });
      await queryInterface.removeColumn("IzinLanjutSkripsis", "decision_idempotency_key", { transaction });
    });
    // Nilai enum needs_review dipertahankan karena penghapusan nilai enum PostgreSQL bersifat destruktif.
  },
};
