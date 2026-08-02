"use strict";
const bcrypt = require("bcrypt");
const crypto = require("crypto");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const hashed = await bcrypt.hash(crypto.randomBytes(48).toString("base64url"), 10);
    await queryInterface.bulkUpdate(
      "Dosens",
      {
        password: hashed,
        is_default_password: true,
        updatedAt: new Date(),
      },
      {}
    );
  },

  async down() {
    // No automatic rollback for password reset
  },
};
