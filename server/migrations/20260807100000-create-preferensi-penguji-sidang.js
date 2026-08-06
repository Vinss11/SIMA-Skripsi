"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("PreferensiPengujiSidangs", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      periode_sidang_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "PeriodeSidangs", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      dosen_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "Dosens", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      mobilitas_ruangan: {
        type: Sequelize.ENUM("dapat_berpindah", "satu_ruangan"),
        allowNull: false,
        defaultValue: "dapat_berpindah",
      },
      maksimal_sesi_per_hari: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 5,
      },
      membutuhkan_jeda: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      submitted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });
    await queryInterface.addConstraint("PreferensiPengujiSidangs", {
      fields: ["maksimal_sesi_per_hari"],
      type: "check",
      name: "chk_preferensi_penguji_maksimal_sesi",
      where: { maksimal_sesi_per_hari: { [Sequelize.Op.between]: [1, 5] } },
    });
    await queryInterface.addIndex("PreferensiPengujiSidangs", ["periode_sidang_id", "dosen_id"], {
      name: "uniq_preferensi_penguji_periode_dosen",
      unique: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("PreferensiPengujiSidangs", "uniq_preferensi_penguji_periode_dosen");
    await queryInterface.removeConstraint("PreferensiPengujiSidangs", "chk_preferensi_penguji_maksimal_sesi");
    await queryInterface.dropTable("PreferensiPengujiSidangs");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_PreferensiPengujiSidangs_mobilitas_ruangan";');
  },
};
