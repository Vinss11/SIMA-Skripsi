"use strict";
const bcrypt = require("bcrypt");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Hash password default untuk semua dosen
    const defaultPassword = "12345678";
    const hashedPassword1 = await bcrypt.hash(defaultPassword, 10);
    const hashedPassword2 = await bcrypt.hash(defaultPassword, 10);
    const hashedPassword3 = await bcrypt.hash(defaultPassword, 10);

    await queryInterface.bulkInsert(
      "Dosens",
      [
        {
          nip: "198501012010121001",
          nama: "Dr. Ahmad Fauzi",
          email: "ahmad.fauzi@university.ac.id",
          password: hashedPassword1,
          is_default_password: true,
          jabatan: "Lektor Kepala",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          nip: "198601012011121002",
          nama: "Dr. Budi Santoso",
          email: "budi.santoso@university.ac.id",
          password: hashedPassword2,
          is_default_password: true,
          jabatan: "Lektor",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          nip: "199001012015121003",
          nama: "Dr. Citra Dewi",
          email: "citra.dewi@university.ac.id",
          password: hashedPassword3,
          is_default_password: true,
          jabatan: "Asisten Ahli",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          nip: "199201012016121004",
          nama: "Dr. Dodi Prasetyo",
          email: "dodi.prasetyo@university.ac.id",
          password: await bcrypt.hash(defaultPassword, 10),
          is_default_password: true,
          jabatan: "Lektor",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          nip: "199501012018121005",
          nama: "Eka Wijaya, M.Kom",
          email: "eka.wijaya@university.ac.id",
          password: await bcrypt.hash(defaultPassword, 10),
          is_default_password: true,
          jabatan: "Asisten Ahli",
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
