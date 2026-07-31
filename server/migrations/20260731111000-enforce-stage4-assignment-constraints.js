"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addConstraint("PenetapanPembimbings", {
      fields: ["semester_penjaluran_ke"],
      type: "check",
      name: "ck_assignment_semester_range",
      where: { semester_penjaluran_ke: { [Sequelize.Op.between]: [1, 3] } },
    }).catch((error) => {
      if (!/already exists/i.test(String(error?.message || ""))) throw error;
    });
    await queryInterface.addConstraint("PenetapanPembimbings", {
      fields: ["status", "end_reason_code"],
      type: "check",
      name: "ck_ended_assignment_has_reason",
      where: {
        [Sequelize.Op.or]: [
          { status: { [Sequelize.Op.ne]: "ended" } },
          { end_reason_code: { [Sequelize.Op.ne]: null } },
        ],
      },
    }).catch((error) => {
      if (!/already exists/i.test(String(error?.message || ""))) throw error;
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint("PenetapanPembimbings", "ck_ended_assignment_has_reason").catch(() => {});
    await queryInterface.removeConstraint("PenetapanPembimbings", "ck_assignment_semester_range").catch(() => {});
  },
};
