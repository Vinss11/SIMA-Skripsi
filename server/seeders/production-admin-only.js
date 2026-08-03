"use strict";

const bcrypt = require("bcrypt");
const { resolveInitialPassword } = require("../services/initialCredentialService");

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

    const hashedPassword = await bcrypt.hash(resolveInitialPassword("admin"), 10);

    await queryInterface.bulkInsert(
      "Admins",
      [
        {
          nip: ADMIN_NIP,
          nama: "Admin Utama",
          email: "admin@sima.local",
          password: hashedPassword,
          is_default_password: true,
          credential_state: "default",
          credential_version: 1,
          password_origin: "institutional_default",
          password_changed_at: null,
          force_change_reason: "initial_institutional_password",
          security_updated_at: new Date(),
          security_updated_by_type: "system",
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
