"use strict";

const bcrypt = require("bcrypt");

const ADMIN_NIP = "199501012020121001";

module.exports = {
  async up(queryInterface, Sequelize) {
    const existingAdmins = await queryInterface.sequelize.query(
      'SELECT id FROM "Admins" WHERE nip = :nip LIMIT 1',
      {
        replacements: { nip: ADMIN_NIP },
        type: Sequelize.QueryTypes.SELECT,
      }
    );

    if (existingAdmins.length > 0) {
      return;
    }

    const hashedPassword = await bcrypt.hash("12345678", 10);

    await queryInterface.bulkInsert(
      "Admins",
      [
        {
          nip: ADMIN_NIP,
          nama: "Admin Utama",
          email: "admin@sima.local",
          password: hashedPassword,
          is_default_password: true,
          role: "koordinator",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      {}
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("Admins", { nip: ADMIN_NIP }, {});
  },
};
