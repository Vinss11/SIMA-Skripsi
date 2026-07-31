"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const dialect = queryInterface.sequelize.getDialect();

    if (dialect === "postgres") {
      await queryInterface.sequelize.query(
        'ALTER TYPE "enum_PenetapanPembimbings_status" ADD VALUE IF NOT EXISTS \'scheduled\';'
      );
      await queryInterface.sequelize.query(
        'ALTER TYPE "enum_PenetapanPembimbingDosens_status" ADD VALUE IF NOT EXISTS \'scheduled\';'
      );
    }

    await queryInterface.sequelize.transaction(async (transaction) => {
      const assignment = await queryInterface.describeTable("PenetapanPembimbings");
      const addAssignmentColumn = async (name, definition) => {
        if (!assignment[name]) {
          await queryInterface.addColumn("PenetapanPembimbings", name, definition, { transaction });
        }
      };

      await addAssignmentColumn("previous_assignment_id", {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "PenetapanPembimbings", key: "id" },
        onDelete: "RESTRICT",
        onUpdate: "CASCADE",
      });
      await addAssignmentColumn("end_reason_code", { type: Sequelize.STRING(64), allowNull: true });
      await addAssignmentColumn("assignment_transition_code", { type: Sequelize.STRING(64), allowNull: true });
      await addAssignmentColumn("semester_outcome_code", { type: Sequelize.STRING(64), allowNull: true });
      await addAssignmentColumn("izin_lanjut_id", { type: Sequelize.INTEGER, allowNull: true });
      await addAssignmentColumn("effective_at", { type: Sequelize.DATE, allowNull: true });
      await addAssignmentColumn("activated_at", { type: Sequelize.DATE, allowNull: true });
      await addAssignmentColumn("decision_at", { type: Sequelize.DATE, allowNull: true });
      await addAssignmentColumn("idempotency_key", { type: Sequelize.STRING(160), allowNull: true });
      await addAssignmentColumn("request_fingerprint", { type: Sequelize.STRING(64), allowNull: true });
      await addAssignmentColumn("ended_by_actor_type", { type: Sequelize.STRING(40), allowNull: true });
      await addAssignmentColumn("ended_by_actor_id", { type: Sequelize.INTEGER, allowNull: true });
      await queryInterface.sequelize.query(`
        UPDATE "PenetapanPembimbings"
           SET semester_penjaluran_ke = COALESCE(semester_penjaluran_ke, 1),
               decision_at = COALESCE(decision_at, "createdAt"),
               activated_at = CASE WHEN status = 'active' THEN COALESCE(activated_at, tanggal_mulai, "createdAt") ELSE activated_at END,
               semester_outcome_code = CASE WHEN status = 'active' THEN COALESCE(semester_outcome_code, 'in_progress') ELSE semester_outcome_code END,
               end_reason_code = CASE
                 WHEN status = 'ended' THEN COALESCE(end_reason_code,
                   CASE WHEN sumber_data = 'pergantian' THEN 'supervisor_replaced'
                        WHEN sumber_data = 'perpanjangan' THEN 'semester_carried_forward'
                        ELSE 'legacy_reconciled' END)
                 ELSE end_reason_code END,
               assignment_transition_code = CASE
                 WHEN sumber_data = 'pergantian' THEN COALESCE(assignment_transition_code, 'supervisor_replaced')
                 WHEN sumber_data = 'perpanjangan' THEN COALESCE(assignment_transition_code, 'semester_carried_forward')
                 ELSE assignment_transition_code END
      `, { transaction });
      await queryInterface.addConstraint("PenetapanPembimbings", {
        fields: ["semester_penjaluran_ke"],
        type: "check",
        name: "ck_assignment_semester_range",
        where: { semester_penjaluran_ke: { [Sequelize.Op.between]: [1, 3] } },
        transaction,
      }).catch(() => {});
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
        transaction,
      }).catch(() => {});
      await queryInterface.sequelize.query(`
        WITH ordered AS (
          SELECT id,
                 LAG(id) OVER (
                   PARTITION BY mahasiswa_id, pendaftaran_penjaluran_id
                   ORDER BY COALESCE(tanggal_mulai, "createdAt"), id
                 ) AS previous_id
            FROM "PenetapanPembimbings"
           WHERE pendaftaran_penjaluran_id IS NOT NULL AND status <> 'cancelled'
        )
        UPDATE "PenetapanPembimbings" assignment
           SET previous_assignment_id = ordered.previous_id
          FROM ordered
         WHERE assignment.id = ordered.id
           AND assignment.previous_assignment_id IS NULL
           AND ordered.previous_id IS NOT NULL
      `, { transaction });

      const extension = await queryInterface.describeTable("IzinLanjutSkripsis");
      await queryInterface.removeIndex("IzinLanjutSkripsis", "uq_izin_lanjut_mahasiswa_semester", { transaction }).catch(() => {});
      const addExtensionColumn = async (name, definition) => {
        if (!extension[name]) {
          await queryInterface.addColumn("IzinLanjutSkripsis", name, definition, { transaction });
        }
      };
      await addExtensionColumn("pendaftaran_penjaluran_id", {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "PendaftaranPenjalurans", key: "id" },
        onDelete: "RESTRICT",
        onUpdate: "CASCADE",
      });
      await addExtensionColumn("penetapan_asal_id", {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "PenetapanPembimbings", key: "id" },
        onDelete: "RESTRICT",
        onUpdate: "CASCADE",
      });
      await addExtensionColumn("reviewer_p1_id", {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "Dosens", key: "id" },
        onDelete: "RESTRICT",
        onUpdate: "CASCADE",
      });
      await addExtensionColumn("penetapan_hasil_id", {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "PenetapanPembimbings", key: "id" },
        onDelete: "RESTRICT",
        onUpdate: "CASCADE",
      });
      await addExtensionColumn("idempotency_key", { type: Sequelize.STRING(160), allowNull: true });
      await addExtensionColumn("request_fingerprint", { type: Sequelize.STRING(64), allowNull: true });
      await addExtensionColumn("decided_by_actor_type", { type: Sequelize.STRING(40), allowNull: true });
      await addExtensionColumn("decided_by_actor_id", { type: Sequelize.INTEGER, allowNull: true });
      await queryInterface.addConstraint("PenetapanPembimbings", {
        fields: ["izin_lanjut_id"],
        type: "foreign key",
        name: "fk_assignment_extension",
        references: { table: "IzinLanjutSkripsis", field: "id" },
        onDelete: "RESTRICT",
        onUpdate: "CASCADE",
        transaction,
      }).catch(() => {});

      const guidance = await queryInterface.describeTable("BimbinganSkripsis");
      if (!guidance.penetapan_pembimbing_id) {
        await queryInterface.addColumn("BimbinganSkripsis", "penetapan_pembimbing_id", {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: "PenetapanPembimbings", key: "id" },
          onDelete: "RESTRICT",
          onUpdate: "CASCADE",
        }, { transaction });
      }

      await queryInterface.addIndex("PenetapanPembimbings", ["previous_assignment_id"], {
        name: "idx_assignment_previous",
        transaction,
      }).catch(() => {});
      await queryInterface.addIndex("PenetapanPembimbings", ["pendaftaran_penjaluran_id", "semester_penjaluran_ke"], {
        name: "idx_assignment_cycle_semester",
        transaction,
      }).catch(() => {});
      await queryInterface.addIndex("PenetapanPembimbings", ["effective_at", "status"], {
        name: "idx_assignment_scheduled_due",
        transaction,
      }).catch(() => {});
      await queryInterface.addIndex("PenetapanPembimbings", ["idempotency_key"], {
        name: "uq_assignment_idempotency_key",
        unique: true,
        where: { idempotency_key: { [Sequelize.Op.ne]: null } },
        transaction,
      }).catch(() => {});
      await queryInterface.addIndex("PenetapanPembimbings", ["mahasiswa_id", "periode_mulai_id", "semester_penjaluran_ke"], {
        name: "uq_assignment_scheduled_transition",
        unique: true,
        where: { status: "scheduled" },
        transaction,
      }).catch(() => {});
      await queryInterface.addIndex("IzinLanjutSkripsis", ["mahasiswa_id", "pendaftaran_penjaluran_id", "semester_penjaluran_ke"], {
        name: "uq_extension_cycle_target_semester",
        unique: true,
        where: { pendaftaran_penjaluran_id: { [Sequelize.Op.ne]: null } },
        transaction,
      }).catch(() => {});
      await queryInterface.addIndex("IzinLanjutSkripsis", ["idempotency_key"], {
        name: "uq_extension_idempotency_key",
        unique: true,
        where: { idempotency_key: { [Sequelize.Op.ne]: null } },
        transaction,
      }).catch(() => {});
      await queryInterface.addIndex("BimbinganSkripsis", ["penetapan_pembimbing_id"], {
        name: "idx_guidance_assignment",
        transaction,
      }).catch(() => {});
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const [table, index] of [
        ["BimbinganSkripsis", "idx_guidance_assignment"],
        ["IzinLanjutSkripsis", "uq_extension_idempotency_key"],
        ["IzinLanjutSkripsis", "uq_extension_cycle_target_semester"],
        ["PenetapanPembimbings", "uq_assignment_scheduled_transition"],
        ["PenetapanPembimbings", "uq_assignment_idempotency_key"],
        ["PenetapanPembimbings", "idx_assignment_scheduled_due"],
        ["PenetapanPembimbings", "idx_assignment_cycle_semester"],
        ["PenetapanPembimbings", "idx_assignment_previous"],
      ]) await queryInterface.removeIndex(table, index, { transaction }).catch(() => {});
      await queryInterface.addIndex("IzinLanjutSkripsis", ["mahasiswa_id", "semester_penjaluran_ke"], {
        name: "uq_izin_lanjut_mahasiswa_semester", unique: true, transaction,
      }).catch(() => {});

      await queryInterface.removeColumn("BimbinganSkripsis", "penetapan_pembimbing_id", { transaction });
      for (const column of ["decided_by_actor_id", "decided_by_actor_type", "request_fingerprint", "idempotency_key", "penetapan_hasil_id", "reviewer_p1_id", "penetapan_asal_id", "pendaftaran_penjaluran_id"]) {
        await queryInterface.removeColumn("IzinLanjutSkripsis", column, { transaction });
      }
      for (const column of ["ended_by_actor_id", "ended_by_actor_type", "request_fingerprint", "idempotency_key", "decision_at", "activated_at", "effective_at", "izin_lanjut_id", "semester_outcome_code", "assignment_transition_code", "end_reason_code", "previous_assignment_id"]) {
        await queryInterface.removeColumn("PenetapanPembimbings", column, { transaction });
      }
    });
    // PostgreSQL enum values are deliberately retained: removing values is destructive.
  },
};
