"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const dialect = queryInterface.sequelize.getDialect();
    await queryInterface.sequelize.transaction(async (transaction) => {
      const groups = await queryInterface.describeTable("KelompokPerintisanBisnis");
      for (const [name, definition] of Object.entries({
        review_reason_code: { type: Sequelize.STRING(80), allowNull: true },
        review_detail: { type: dialect === "postgres" ? Sequelize.JSONB : Sequelize.JSON, allowNull: true },
        review_requested_at: { type: Sequelize.DATE, allowNull: true },
      })) {
        if (!groups[name]) await queryInterface.addColumn("KelompokPerintisanBisnis", name, definition, { transaction });
      }

      const existingConstraints = new Set();
      const existingIndexes = new Set();
      if (dialect === "postgres") {
        const [constraints] = await queryInterface.sequelize.query(
          `SELECT conname AS name FROM pg_constraint WHERE conname IN
           ('ck_assignment_semester_range', 'ck_ended_assignment_has_reason', 'fk_assignment_extension')`,
          { transaction }
        );
        constraints.forEach((row) => existingConstraints.add(row.name));
        const [indexes] = await queryInterface.sequelize.query(
          `SELECT indexname AS name FROM pg_indexes WHERE indexname IN
           ('idx_assignment_previous', 'idx_assignment_cycle_semester', 'idx_assignment_scheduled_due',
            'uq_assignment_idempotency_key', 'uq_assignment_scheduled_transition',
            'uq_extension_cycle_target_semester', 'uq_extension_idempotency_key',
            'uq_extension_decision_idempotency_key', 'idx_guidance_assignment')`,
          { transaction }
        );
        indexes.forEach((row) => existingIndexes.add(row.name));
      } else {
        for (const table of ["PenetapanPembimbings", "IzinLanjutSkripsis", "BimbinganSkripsis"]) {
          const indexes = await queryInterface.showIndex(table, { transaction });
          indexes.forEach((row) => existingIndexes.add(row.name));
        }
      }

      if (!existingConstraints.has("ck_assignment_semester_range")) {
        await queryInterface.addConstraint("PenetapanPembimbings", {
          fields: ["semester_penjaluran_ke"], type: "check", name: "ck_assignment_semester_range",
          where: { semester_penjaluran_ke: { [Sequelize.Op.between]: [1, 3] } }, transaction,
        });
      }
      if (!existingConstraints.has("ck_ended_assignment_has_reason")) {
        await queryInterface.addConstraint("PenetapanPembimbings", {
          fields: ["status", "end_reason_code"], type: "check", name: "ck_ended_assignment_has_reason",
          where: { [Sequelize.Op.or]: [{ status: { [Sequelize.Op.ne]: "ended" } }, { end_reason_code: { [Sequelize.Op.ne]: null } }] },
          transaction,
        });
      }
      if (!existingConstraints.has("fk_assignment_extension")) {
        await queryInterface.addConstraint("PenetapanPembimbings", {
          fields: ["izin_lanjut_id"], type: "foreign key", name: "fk_assignment_extension",
          references: { table: "IzinLanjutSkripsis", field: "id" }, onDelete: "RESTRICT", onUpdate: "CASCADE", transaction,
        });
      }

      const indexes = [
        ["PenetapanPembimbings", ["previous_assignment_id"], "idx_assignment_previous", {}],
        ["PenetapanPembimbings", ["pendaftaran_penjaluran_id", "semester_penjaluran_ke"], "idx_assignment_cycle_semester", {}],
        ["PenetapanPembimbings", ["effective_at", "status"], "idx_assignment_scheduled_due", {}],
        ["PenetapanPembimbings", ["idempotency_key"], "uq_assignment_idempotency_key", { unique: true, where: { idempotency_key: { [Sequelize.Op.ne]: null } } }],
        ["PenetapanPembimbings", ["mahasiswa_id", "periode_mulai_id", "semester_penjaluran_ke"], "uq_assignment_scheduled_transition", { unique: true, where: { status: "scheduled" } }],
        ["IzinLanjutSkripsis", ["mahasiswa_id", "pendaftaran_penjaluran_id", "semester_penjaluran_ke"], "uq_extension_cycle_target_semester", { unique: true, where: { pendaftaran_penjaluran_id: { [Sequelize.Op.ne]: null } } }],
        ["IzinLanjutSkripsis", ["idempotency_key"], "uq_extension_idempotency_key", { unique: true, where: { idempotency_key: { [Sequelize.Op.ne]: null } } }],
        ["IzinLanjutSkripsis", ["decision_idempotency_key"], "uq_extension_decision_idempotency_key", { unique: true, where: { decision_idempotency_key: { [Sequelize.Op.ne]: null } } }],
        ["BimbinganSkripsis", ["penetapan_pembimbing_id"], "idx_guidance_assignment", {}],
      ];
      for (const [table, fields, name, options] of indexes) {
        if (!existingIndexes.has(name)) await queryInterface.addIndex(table, fields, { ...options, name, transaction });
      }

      if (dialect === "postgres") {
        const required = [
          "ck_assignment_semester_range", "ck_ended_assignment_has_reason", "fk_assignment_extension",
          ...indexes.map((item) => item[2]),
        ];
        const [objects] = await queryInterface.sequelize.query(`
          SELECT conname AS name FROM pg_constraint WHERE conname IN (:required)
          UNION
          SELECT indexname AS name FROM pg_indexes WHERE indexname IN (:required)
        `, { replacements: { required }, transaction });
        const found = new Set(objects.map((row) => row.name));
        const missing = required.filter((name) => !found.has(name));
        if (missing.length) throw new Error(`Objek integritas Tahap 4 belum lengkap: ${missing.join(", ")}`);
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const groups = await queryInterface.describeTable("KelompokPerintisanBisnis");
      for (const column of ["review_requested_at", "review_detail", "review_reason_code"]) {
        if (groups[column]) await queryInterface.removeColumn("KelompokPerintisanBisnis", column, { transaction });
      }
    });
    // Constraint/index yang diperbaiki dapat berasal dari migrasi lama dan sengaja tidak dihapus.
  },
};
