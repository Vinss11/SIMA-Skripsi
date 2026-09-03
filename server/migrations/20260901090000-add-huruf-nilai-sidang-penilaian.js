"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("SidangPenilaians", "huruf_nilai", {
      type: Sequelize.STRING(5),
      allowNull: true,
      after: "nilai_akhir",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("SidangPenilaians", "huruf_nilai");
  },
};
