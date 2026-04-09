"use strict";
const bcrypt = require("bcrypt");

module.exports = {
  async up(queryInterface, Sequelize) {
    const hashedPassword = await bcrypt.hash("12345678", 10);

    await queryInterface.bulkInsert(
      "Mahasiswas",
      [
        {
          nim: "22523001",
          nama: "Wayne Rooney",
          email: "wayne@email.com",
          password: hashedPassword,
          is_default_password: true,
          angkatan: "2022",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          nim: "22523002",
          nama: "Sewwy Smith",
          email: "sewwy@email.com",
          password: hashedPassword,
          is_default_password: true,
          angkatan: "2022",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      {}
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("Mahasiswas", null, {});
  },
};
