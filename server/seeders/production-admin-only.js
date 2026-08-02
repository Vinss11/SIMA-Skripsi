"use strict";

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

    const hashedPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD_HASH;
    if (!/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(String(hashedPassword || ""))) {
      throw new Error("BOOTSTRAP_ADMIN_PASSWORD_HASH wajib berupa bcrypt hash yang valid untuk bootstrap Admin produksi.");
    }

    await queryInterface.bulkInsert(
      "Admins",
      [
        {
          nip: ADMIN_NIP,
          nama: "Admin Utama",
          email: "admin@sima.local",
          password: hashedPassword,
          is_default_password: false,
          credential_state: "active",
          credential_version: 1,
          password_origin: "initial",
          password_changed_at: new Date(),
          security_updated_at: new Date(),
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
