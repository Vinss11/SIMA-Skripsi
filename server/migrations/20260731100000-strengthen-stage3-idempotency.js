"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.addColumn("PendaftaranPenjalurans", "change_idempotency_key", {
        type: Sequelize.STRING(255), allowNull: true,
      }, { transaction });
      await queryInterface.addColumn("PendaftaranPenjalurans", "change_fingerprint", {
        type: Sequelize.STRING(64), allowNull: true,
      }, { transaction });
      await queryInterface.addIndex("PendaftaranPenjalurans", ["mahasiswa_id", "change_idempotency_key"], {
        name: "change_registration_idempotency_unique",
        unique: true,
        where: { change_idempotency_key: { [Sequelize.Op.ne]: null } },
        transaction,
      });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("PendaftaranPenjalurans", "change_registration_idempotency_unique");
    await queryInterface.removeColumn("PendaftaranPenjalurans", "change_fingerprint");
    await queryInterface.removeColumn("PendaftaranPenjalurans", "change_idempotency_key");
  },
};
