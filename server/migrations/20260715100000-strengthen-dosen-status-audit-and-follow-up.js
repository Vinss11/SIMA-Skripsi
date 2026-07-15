"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Introspect before opening the DDL transaction. `describeTable` may use a
    // separate pooled connection, which would otherwise wait on our own locks.
    const history = await queryInterface.describeTable("RiwayatStatusDosens");
    const followUp = await queryInterface.describeTable("TindakLanjutStatusDosens");

    await queryInterface.sequelize.transaction(async (transaction) => {
      if (history.continue_existing_supervision && !history.continue_existing_supervision_baru) {
        await queryInterface.renameColumn(
          "RiwayatStatusDosens",
          "continue_existing_supervision",
          "continue_existing_supervision_baru",
          { transaction }
        );
      }
      if (!history.continue_existing_supervision_sebelumnya) {
        await queryInterface.addColumn("RiwayatStatusDosens", "continue_existing_supervision_sebelumnya", {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        }, { transaction });
      }
      if (!history.changed_fields) {
        await queryInterface.addColumn("RiwayatStatusDosens", "changed_fields", {
          type: Sequelize.JSONB,
          allowNull: false,
          defaultValue: [],
        }, { transaction });
      }

      if (!followUp.resolution_type) {
        await queryInterface.addColumn("TindakLanjutStatusDosens", "resolution_type", {
          type: Sequelize.ENUM("resolved", "resolved_with_exception"),
          allowNull: true,
        }, { transaction });
      }
      if (!followUp.resolution_decisions) {
        await queryInterface.addColumn("TindakLanjutStatusDosens", "resolution_decisions", {
          type: Sequelize.JSONB,
          allowNull: false,
          defaultValue: {},
        }, { transaction });
      }
      if (!followUp.remaining_impact_snapshot) {
        await queryInterface.addColumn("TindakLanjutStatusDosens", "remaining_impact_snapshot", {
          type: Sequelize.JSONB,
          allowNull: true,
        }, { transaction });
      }
    });
  },

  async down(queryInterface) {
    const followUp = await queryInterface.describeTable("TindakLanjutStatusDosens");
    const history = await queryInterface.describeTable("RiwayatStatusDosens");

    await queryInterface.sequelize.transaction(async (transaction) => {
      if (followUp.remaining_impact_snapshot) await queryInterface.removeColumn("TindakLanjutStatusDosens", "remaining_impact_snapshot", { transaction });
      if (followUp.resolution_decisions) await queryInterface.removeColumn("TindakLanjutStatusDosens", "resolution_decisions", { transaction });
      if (followUp.resolution_type) await queryInterface.removeColumn("TindakLanjutStatusDosens", "resolution_type", { transaction });

      if (history.changed_fields) await queryInterface.removeColumn("RiwayatStatusDosens", "changed_fields", { transaction });
      if (history.continue_existing_supervision_sebelumnya) {
        await queryInterface.removeColumn("RiwayatStatusDosens", "continue_existing_supervision_sebelumnya", { transaction });
      }
      if (history.continue_existing_supervision_baru && !history.continue_existing_supervision) {
        await queryInterface.renameColumn(
          "RiwayatStatusDosens",
          "continue_existing_supervision_baru",
          "continue_existing_supervision",
          { transaction }
        );
      }
    });
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_TindakLanjutStatusDosens_resolution_type";');
  },
};
