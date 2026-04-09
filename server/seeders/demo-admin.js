"use strict";
const bcrypt = require("bcrypt");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const hashedPassword = await bcrypt.hash("12345678", 10);

    await queryInterface.bulkInsert(
      "Admins",
      [
        {
          nip: "199501012020121001",
          nama: "Admin Koordinator",
          email: "admin.koordinator@university.ac.id",
          password: hashedPassword,
          is_default_password: true,
          role: "koordinator",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          nip: "199601012021121002",
          nama: "Admin Staff",
          email: "admin.staff@university.ac.id",
          password: hashedPassword,
          is_default_password: true,
          role: "staff",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      {}
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("Admins", null, {});
  },
};
