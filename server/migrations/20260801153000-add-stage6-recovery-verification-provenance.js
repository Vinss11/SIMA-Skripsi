"use strict";

const TABLES = ["Mahasiswas", "Dosens", "Admins", "SekretarisProdis"];
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const table of TABLES) {
      await queryInterface.addColumn(table, "recovery_email_verification_source", { type: Sequelize.STRING(80), allowNull: true }, { transaction });
      // A timestamp without provenance predates this invariant and is not
      // silently trusted; reconciliation must resolve it explicitly.
      await queryInterface.sequelize.query(`UPDATE "${table}" SET recovery_email_verified_at=NULL WHERE recovery_email_verified_at IS NOT NULL AND recovery_email_verification_source IS NULL`, { transaction });
      await queryInterface.sequelize.query(`ALTER TABLE "${table}" ADD CONSTRAINT ck_${table.toLowerCase()}_recovery_verification_pair CHECK ((recovery_email_verified_at IS NULL) = (recovery_email_verification_source IS NULL))`, { transaction });
      }
    });
  },
  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const table of TABLES) {
        await queryInterface.removeConstraint(table, `ck_${table.toLowerCase()}_recovery_verification_pair`, { transaction });
        await queryInterface.removeColumn(table, "recovery_email_verification_source", { transaction });
      }
    });
  },
};
