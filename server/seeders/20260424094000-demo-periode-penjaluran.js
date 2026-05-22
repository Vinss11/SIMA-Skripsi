"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    let semester = "genap";
    let tahunAkademik = `${year - 1}/${year}`;

    if (month >= 8) {
      semester = "ganjil";
      tahunAkademik = `${year}/${year + 1}`;
    } else if (month === 1) {
      semester = "ganjil";
      tahunAkademik = `${year - 1}/${year}`;
    }

    const label = `${semester === "ganjil" ? "Ganjil" : "Genap"} ${tahunAkademik}`;

    await queryInterface.bulkInsert(
      "PeriodePenjalurans",
      [
        {
          tahun_akademik: tahunAkademik,
          semester,
          label_periode: label,
          tanggal_mulai: null,
          tanggal_selesai: null,
          is_active: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      {}
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("PeriodePenjalurans", null, {});
  },
};

