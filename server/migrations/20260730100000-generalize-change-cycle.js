"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      const add = (table, name, options) => queryInterface.addColumn(table, name, options, { transaction });
      await add("PendaftaranPenjalurans", "pendaftaran_asal_id", {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "PendaftaranPenjalurans", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      });
      await add("BimbinganSkripsis", "pendaftaran_penjaluran_id", {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "PendaftaranPenjalurans", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      });
      await queryInterface.changeColumn("PamitUlangs", "pengajuan_sebelumnya_id", {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "Pengajuans", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      }, { transaction });
      await queryInterface.sequelize.query(
        'ALTER TABLE "PamitUlangs" ALTER COLUMN "pengajuan_sebelumnya_id" DROP NOT NULL',
        { transaction }
      );
      const pamitFields = {
        periode_tujuan_id: { type: Sequelize.INTEGER, references: { model: "PeriodePenjalurans", key: "id" }, onDelete: "SET NULL" },
        pendaftaran_lama_id: { type: Sequelize.INTEGER, references: { model: "PendaftaranPenjalurans", key: "id" }, onDelete: "SET NULL" },
        pendaftaran_baru_id: { type: Sequelize.INTEGER, references: { model: "PendaftaranPenjalurans", key: "id" }, onDelete: "SET NULL" },
        penetapan_lama_id: { type: Sequelize.INTEGER, references: { model: "PenetapanPembimbings", key: "id" }, onDelete: "SET NULL" },
        reviewer_p1_id: { type: Sequelize.INTEGER, references: { model: "Dosens", key: "id" }, onDelete: "SET NULL" },
        jenis_perubahan: { type: Sequelize.STRING(16) },
        jalur_asal: { type: Sequelize.STRING(40) },
        jalur_tujuan: { type: Sequelize.STRING(40) },
        status: { type: Sequelize.ENUM("pending", "approved", "rejected", "consumed", "cancelled"), allowNull: false, defaultValue: "pending" },
        submitted_at: { type: Sequelize.DATE },
        decided_at: { type: Sequelize.DATE },
        consumed_at: { type: Sequelize.DATE },
        cancellation_reason: { type: Sequelize.TEXT },
        idempotency_key: { type: Sequelize.STRING(255) },
        metadata: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      };
      for (const [name, options] of Object.entries(pamitFields)) await add("PamitUlangs", name, options);
      await queryInterface.sequelize.query(`
        UPDATE "PamitUlangs" SET
          status = (CASE status_dospem WHEN 'approved' THEN 'approved' WHEN 'rejected' THEN 'rejected' ELSE 'pending' END)::"enum_PamitUlangs_status",
          jenis_perubahan = 'ulang',
          jalur_asal = 'penelitian', jalur_tujuan = 'penelitian',
          submitted_at = COALESCE("createdAt", NOW()),
          decided_at = tanggal_approval_dospem
      `, { transaction });
      await queryInterface.sequelize.query(`
        WITH ranked AS (
          SELECT id, ROW_NUMBER() OVER (
            PARTITION BY mahasiswa_id ORDER BY COALESCE(tanggal_approval_dospem, "updatedAt", "createdAt") DESC, id DESC
          ) AS row_number
          FROM "PamitUlangs" WHERE status IN ('pending', 'approved')
        )
        UPDATE "PamitUlangs" p SET status = 'cancelled',
          cancellation_reason = 'Dibatalkan saat migrasi karena ada pamit terbuka yang lebih baru.'
        FROM ranked r WHERE p.id = r.id AND r.row_number > 1
      `, { transaction });
      await queryInterface.sequelize.query(`
        UPDATE "BimbinganSkripsis" b
        SET pendaftaran_penjaluran_id = p.pendaftaran_penjaluran_id
        FROM "Pengajuans" p
        WHERE b.pengajuan_id = p.id AND b.pendaftaran_penjaluran_id IS NULL
      `, { transaction });
      await queryInterface.addIndex("PamitUlangs", ["mahasiswa_id"], {
        name: "pamit_one_open_per_student",
        unique: true,
        where: { status: { [Sequelize.Op.in]: ["pending", "approved"] } },
        transaction,
      });
      await queryInterface.addIndex("PamitUlangs", ["pendaftaran_baru_id"], {
        name: "pamit_new_registration_unique", unique: true, where: { pendaftaran_baru_id: { [Sequelize.Op.ne]: null } }, transaction,
      });
      await queryInterface.addIndex("PamitUlangs", ["idempotency_key"], {
        name: "pamit_idempotency_unique", unique: true, where: { idempotency_key: { [Sequelize.Op.ne]: null } }, transaction,
      });
      await queryInterface.addIndex("BimbinganSkripsis", ["pendaftaran_penjaluran_id"], { name: "bimbingan_cycle_idx", transaction });
      await queryInterface.createTable("RiwayatPamitPenjalurans", {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        pamit_ulang_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: "PamitUlangs", key: "id" }, onDelete: "CASCADE" },
        from_status: Sequelize.STRING(30), to_status: { type: Sequelize.STRING(30), allowNull: false },
        event_type: { type: Sequelize.STRING(60), allowNull: false }, actor_type: { type: Sequelize.STRING(30), allowNull: false },
        actor_id: Sequelize.INTEGER, note: Sequelize.TEXT, metadata: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
        occurred_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
        deduplication_key: { type: Sequelize.STRING(255), allowNull: false, unique: true },
        createdAt: { type: Sequelize.DATE, allowNull: false }, updatedAt: { type: Sequelize.DATE, allowNull: false },
      }, { transaction });
      await transaction.commit();
    } catch (error) { await transaction.rollback(); throw error; }
  },
  async down(queryInterface) {
    await queryInterface.dropTable("RiwayatPamitPenjalurans");
    for (const field of ["periode_tujuan_id", "pendaftaran_lama_id", "pendaftaran_baru_id", "penetapan_lama_id", "reviewer_p1_id", "jenis_perubahan", "jalur_asal", "jalur_tujuan", "status", "submitted_at", "decided_at", "consumed_at", "cancellation_reason", "idempotency_key", "metadata"]) await queryInterface.removeColumn("PamitUlangs", field);
    await queryInterface.removeColumn("BimbinganSkripsis", "pendaftaran_penjaluran_id");
    await queryInterface.removeColumn("PendaftaranPenjalurans", "pendaftaran_asal_id");
  },
};
