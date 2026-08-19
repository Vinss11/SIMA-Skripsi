"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("Mahasiswas");
    if (!table.pending_registration_type) {
      await queryInterface.addColumn("Mahasiswas", "pending_registration_type", {
        type: Sequelize.STRING(10),
        allowNull: true,
      });
    }
    if (!table.pending_program_kuliah) {
      await queryInterface.addColumn("Mahasiswas", "pending_program_kuliah", {
        type: Sequelize.STRING(20),
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable("Mahasiswas");
    if (table.pending_program_kuliah) {
      await queryInterface.removeColumn("Mahasiswas", "pending_program_kuliah");
    }
    if (table.pending_registration_type) {
      await queryInterface.removeColumn("Mahasiswas", "pending_registration_type");
    }
  },
};
