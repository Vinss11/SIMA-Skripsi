"use strict";

const crypto = require("crypto"); const bcrypt = require("bcrypt");
const TABLES = ["Mahasiswas", "Dosens", "Admins", "SekretarisProdis"];

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      for (const table of TABLES) {
        const rows = await queryInterface.sequelize.query(`SELECT id FROM "${table}" WHERE credential_state IN ('default','temporary') FOR UPDATE`,
          { type: Sequelize.QueryTypes.SELECT, transaction });
        for (const row of rows) {
          const unusableHash = await bcrypt.hash(crypto.randomBytes(48).toString("base64url"), 10);
          await queryInterface.sequelize.query(`UPDATE "${table}" SET password=:password, credential_version=credential_version+1,
            password_origin='migration', force_change_reason='activation_required_after_security_cutover', security_updated_at=NOW(), "updatedAt"=NOW() WHERE id=:id`,
          { replacements: { password: unusableHash, id: row.id }, transaction });
        }
      }
      await queryInterface.sequelize.query(`UPDATE "AuthSessions" SET revoked_at=NOW(), revoked_reason='stage6_security_cutover', "updatedAt"=NOW() WHERE revoked_at IS NULL`, { transaction });
      await queryInterface.sequelize.query(`UPDATE "PasswordResetTokens" SET revoked_at=NOW(), revoked_reason='stage6_security_cutover', "updatedAt"=NOW() WHERE used_at IS NULL AND revoked_at IS NULL`, { transaction });
      await transaction.commit();
    } catch (error) { await transaction.rollback(); throw error; }
  },
  async down() {
    // Intentionally irreversible: known/shared credentials must never be restored.
  },
};
