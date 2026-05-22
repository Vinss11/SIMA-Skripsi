"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("MitraMagangs", "is_active", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });

    await queryInterface.sequelize.query(`
      UPDATE "MitraMagangs"
      SET "is_active" = CASE WHEN "status" = 'active' THEN true ELSE false END;
    `);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("MitraMagangs", "is_active");
  },
};

