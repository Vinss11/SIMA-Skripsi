"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `UPDATE "PasswordResetTokens"
         SET revoked_at = COALESCE(revoked_at, NOW()),
             revoked_reason = COALESCE(revoked_reason, 'account_activation_flow_retired'),
             "updatedAt" = NOW()
         WHERE purpose = 'admin_activation'
           AND used_at IS NULL`,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `UPDATE "AuthOutboxes" outbox
         SET status = 'cancelled',
             ciphertext = NULL,
             encryption_iv = NULL,
             encryption_tag = NULL,
             last_error_code = 'ACCOUNT_ACTIVATION_FLOW_RETIRED',
             "updatedAt" = NOW()
         FROM "PasswordResetTokens" token
         WHERE outbox.reset_token_id = token.id
           AND token.purpose = 'admin_activation'
           AND outbox.status IN ('pending', 'retry', 'processing')`,
        { transaction }
      );
    });
  },

  async down() {
    // Token aktivasi yang sudah dicabut tidak dihidupkan kembali demi keamanan.
  },
};
