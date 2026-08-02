"use strict";
const bcrypt = require("bcrypt");
const crypto = require("crypto");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Demo accounts still require activation; no shared credential is emitted.
    const defaultPassword = crypto.randomBytes(48).toString("base64url");
    const hashedPassword1 = await bcrypt.hash(defaultPassword, 10);
    const hashedPassword2 = await bcrypt.hash(defaultPassword, 10);
    const hashedPassword3 = await bcrypt.hash(defaultPassword, 10);

    await queryInterface.bulkInsert(
      "Dosens",
      [
        {
          kode_dosen: "DSN0001",
          nik: "900000001",
          nama: "Dr. Ahmad Fauzi",
          email: "ahmad.fauzi@university.ac.id",
          password: hashedPassword1,
          is_default_password: true,
          jabatan_struktural: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          kode_dosen: "DSN0002",
          nik: "900000002",
          nama: "Dr. Budi Santoso",
          email: "budi.santoso@university.ac.id",
          password: hashedPassword2,
          is_default_password: true,
          jabatan_struktural: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          kode_dosen: "DSN0003",
          nik: "900000003",
          nama: "Dr. Citra Dewi",
          email: "citra.dewi@university.ac.id",
          password: hashedPassword3,
          is_default_password: true,
          jabatan_struktural: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          kode_dosen: "DSN0004",
          nik: "900000004",
          nama: "Dr. Dodi Prasetyo",
          email: "dodi.prasetyo@university.ac.id",
          password: await bcrypt.hash(defaultPassword, 10),
          is_default_password: true,
          jabatan_struktural: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          kode_dosen: "DSN0005",
          nik: "900000005",
          nama: "Eka Wijaya, M.Kom",
          email: "eka.wijaya@university.ac.id",
          password: await bcrypt.hash(defaultPassword, 10),
          is_default_password: true,
          jabatan_struktural: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      {}
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("Dosens", null, {});
  },
};


