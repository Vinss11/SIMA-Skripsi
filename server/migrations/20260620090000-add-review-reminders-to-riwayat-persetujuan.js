"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("RiwayatPersetujuans", "reminder_count", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
    await queryInterface.addColumn("RiwayatPersetujuans", "last_reminded_at", {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("RiwayatPersetujuans", "last_reminded_at");
    await queryInterface.removeColumn("RiwayatPersetujuans", "reminder_count");
  },
};
