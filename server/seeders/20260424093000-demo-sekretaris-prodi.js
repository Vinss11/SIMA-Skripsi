"use strict";
const bcrypt = require("bcrypt");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const hashedPassword = await bcrypt.hash("12345678", 10);

    await queryInterface.bulkInsert(
      "SekretarisProdis",
      [
        {
          nik: "DSN0005",
          nama: "Sekretaris Prodi Informatika Reguler",
          email: "dsn0005@dosen.uii.ac.id",
          password: hashedPassword,
          is_default_password: true,
          jabatan: "Sekretaris Program Studi Informatika - Program Sarjana Reguler",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          nik: "DSN0024",
          nama: "Sekretaris Prodi Informatika International Program",
          email: "dsn0024@dosen.uii.ac.id",
          password: hashedPassword,
          is_default_password: true,
          jabatan: "Sekretaris Program Studi Informatika - Program Sarjana International Program",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      {}
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("SekretarisProdis", null, {});
  },
};

