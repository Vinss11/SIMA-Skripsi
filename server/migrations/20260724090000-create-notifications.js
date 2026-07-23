"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable("Notifikasis", {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
        recipient_type: { type: Sequelize.STRING(30), allowNull: false },
        recipient_id: { type: Sequelize.INTEGER, allowNull: false },
        type: { type: Sequelize.STRING(80), allowNull: false },
        title: { type: Sequelize.STRING(180), allowNull: false },
        message: { type: Sequelize.TEXT, allowNull: false },
        reference_type: { type: Sequelize.STRING(80), allowNull: true },
        reference_id: { type: Sequelize.INTEGER, allowNull: true },
        action_key: { type: Sequelize.STRING(100), allowNull: true },
        metadata: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
        read_at: { type: Sequelize.DATE, allowNull: true },
        deduplication_key: { type: Sequelize.STRING(255), allowNull: false, unique: true },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
      }, { transaction });

      await queryInterface.addIndex("Notifikasis", ["recipient_type", "recipient_id", "read_at"], {
        name: "idx_notifikasi_recipient_unread",
        transaction,
      });
      await queryInterface.addIndex("Notifikasis", ["recipient_type", "recipient_id", "createdAt"], {
        name: "idx_notifikasi_recipient_created",
        transaction,
      });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.dropTable("Notifikasis", { transaction });
    });
  },
};
