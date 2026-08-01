"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const qi = queryInterface;
    const id = { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false };
    const timestamps = {
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
    };
    const json = (value = {}) => ({ type: Sequelize.JSONB, allowNull: false, defaultValue: value });
    const str = (allowNull = false, length = 120) => ({ type: Sequelize.STRING(length), allowNull });
    const int = (allowNull = false) => ({ type: Sequelize.INTEGER, allowNull });
    const bool = (value = true) => ({ type: Sequelize.BOOLEAN, allowNull: false, defaultValue: value });
    const date = (allowNull = true) => ({ type: Sequelize.DATE, allowNull });
    const dec = (allowNull = false) => ({ type: Sequelize.DECIMAL(8, 3), allowNull });
    const fk = (table, allowNull = false) => ({ type: Sequelize.INTEGER, allowNull, references: { model: table, key: "id" }, onUpdate: "CASCADE", onDelete: allowNull ? "SET NULL" : "RESTRICT" });
    const table = (columns) => ({ id, ...columns, ...timestamps });

    await qi.sequelize.transaction(async (transaction) => {
      const period = await qi.describeTable("PeriodeAkademiks");
      if (!period.tahun_mulai) await qi.addColumn("PeriodeAkademiks", "tahun_mulai", int(true), { transaction });
      if (!period.tahun_selesai) await qi.addColumn("PeriodeAkademiks", "tahun_selesai", int(true), { transaction });
      await qi.sequelize.query(`
        UPDATE "PeriodeAkademiks"
           SET tahun_mulai = COALESCE(tahun_mulai, NULLIF(SUBSTRING(tahun_akademik FROM '(\\d{4})'), '')::integer),
               tahun_selesai = COALESCE(tahun_selesai, (NULLIF(SUBSTRING(tahun_akademik FROM '(\\d{4})'), '')::integer + 1))
         WHERE tahun_akademik ~ '\\d{4}'
      `, { transaction });

      const definitions = [
        ["SumberDataAkademiks", table({ kode: { ...str(false, 80), unique: true }, nama: str(false, 160), jenis: str(false, 40), kode_program_studi: str(true, 40), authority_level: { ...int(), defaultValue: 0 }, is_active: bool(), metadata: json() })],
        ["Kurikulums", table({ kode: str(false, 80), nama: str(false, 180), kode_program_studi: str(false, 40), program_kuliah: { ...str(false, 30), defaultValue: "reguler" }, berlaku_mulai_id: fk("PeriodeAkademiks", true), berlaku_selesai_id: fk("PeriodeAkademiks", true), status: { ...str(false, 40), defaultValue: "draft" }, metadata: json() })],
        ["MataKuliahs", table({ kode: str(false, 80), nama: str(false, 180), sks_default: dec(), kode_program_studi: { ...str(false, 40), defaultValue: "INFORMATIKA" }, program_kuliah: { ...str(false, 30), defaultValue: "reguler" }, role_akademik: str(true, 40), status: { ...str(false, 40), defaultValue: "active" }, metadata: json() })],
        ["MataKuliahAliases", table({ mata_kuliah_id: fk("MataKuliahs"), source_id: fk("SumberDataAkademiks", true), kode_alias: str(false, 80), kode_program_studi: { ...str(false, 40), defaultValue: "INFORMATIKA" }, is_active: bool() })],
        ["KelompokEkuivalensiMataKuliahs", table({ kode: { ...str(false, 80), unique: true }, nama: str(false, 180), dasar_keputusan: { type: Sequelize.TEXT, allowNull: false }, status: { ...str(false, 40), defaultValue: "active" } })],
        ["EkuivalensiMataKuliahs", table({ kelompok_id: fk("KelompokEkuivalensiMataKuliahs"), mata_kuliah_id: fk("MataKuliahs"), kurikulum_id: fk("Kurikulums", true), arah: { ...str(false, 30), defaultValue: "bidirectional" }, berlaku_mulai_id: fk("PeriodeAkademiks", true), berlaku_selesai_id: fk("PeriodeAkademiks", true), dasar_keputusan: { type: Sequelize.TEXT, allowNull: false }, is_active: bool() })],
        ["KurikulumMataKuliahs", table({ kurikulum_id: fk("Kurikulums"), mata_kuliah_id: fk("MataKuliahs"), sifat: { ...str(false, 20), defaultValue: "pilihan" }, sks: dec(), kategori: str(true, 60), semester_rekomendasi: int(true), is_active: bool() })],
        ["MahasiswaKurikulums", table({ mahasiswa_id: fk("Mahasiswas"), kurikulum_id: fk("Kurikulums"), periode_mulai_id: fk("PeriodeAkademiks", true), source_id: fk("SumberDataAkademiks", true), is_active: bool(), assigned_by: int(true), metadata: json() })],
        ["ImportAkademikBatches", table({ dataset_type: str(false, 50), schema_version: str(false, 30), source_id: fk("SumberDataAkademiks"), external_revision: str(true), periode_akademik_id: fk("PeriodeAkademiks", true), original_filename: str(false, 255), detected_mime: str(), file_size: int(), file_sha256: str(false, 64), business_fingerprint: { ...str(false, 64), unique: true }, validation_checksum: str(true, 64), status: { ...str(false, 40), defaultValue: "uploaded" }, counts: json(), completeness_scope: json(), error_summary: json(), preview_expires_at: date(), uploaded_by: int(), committed_by: int(true), committed_at: date(), idempotency_key: str(true, 160) })],
        ["ImportAkademikRows", table({ batch_id: fk("ImportAkademikBatches"), sheet_name: str(false, 100), row_number: int(), raw_payload: json(), normalized_payload: json(), mahasiswa_id: fk("Mahasiswas", true), periode_akademik_id: fk("PeriodeAkademiks", true), mata_kuliah_id: fk("MataKuliahs", true), action: str(false, 30), errors: json([]), warnings: json([]), row_fingerprint: str(false, 64), result_entity_type: str(true, 60), result_entity_id: int(true) })],
        ["CakupanDatasetAkademiks", table({ batch_id: fk("ImportAkademikBatches", true), source_id: fk("SumberDataAkademiks"), source_revision: str(true), dataset_type: str(false, 50), mahasiswa_id: fk("Mahasiswas", true), periode_akademik_id: fk("PeriodeAkademiks"), scope_type: str(false, 30), kode_program_studi: str(true, 40), program_kuliah: str(true, 30), is_complete: bool(false), is_active: bool(), declared_by_source: bool(false), declared_at: { ...date(false), defaultValue: Sequelize.fn("NOW") }, checksum: str(false, 64), metadata: json() })],
        ["PercobaanMataKuliahMahasiswas", table({ mahasiswa_id: fk("Mahasiswas"), mata_kuliah_id: fk("MataKuliahs"), periode_akademik_id: fk("PeriodeAkademiks"), source_id: fk("SumberDataAkademiks"), import_row_id: fk("ImportAkademikRows", true), external_record_id: str(true, 160), external_revision: str(true), kelas_normalized: { ...str(false, 80), defaultValue: "DEFAULT" }, attempt_ke: int(), attempt_number_source: str(false, 20), sks_diambil: dec(), sks_lulus: { ...dec(), defaultValue: 0 }, nilai_huruf: str(true, 10), nilai_angka: dec(true), status_registrasi: str(false, 30), status_kelulusan: { ...str(false, 20), defaultValue: "unknown" }, credit_origin: { ...str(false, 30), defaultValue: "regular" }, recognition_status: { ...str(false, 30), defaultValue: "not_required" }, effective_at: { ...date(false), defaultValue: Sequelize.fn("NOW") }, version: { ...int(), defaultValue: 1 }, previous_version_id: fk("PercobaanMataKuliahMahasiswas", true), is_active: bool(), superseded_at: date(), metadata: json() })],
        ["RiwayatMetodologiPenelitians", table({ mahasiswa_id: fk("Mahasiswas"), periode_akademik_id: fk("PeriodeAkademiks"), attempt_id: fk("PercobaanMataKuliahMahasiswas", true), source_id: fk("SumberDataAkademiks"), import_row_id: fk("ImportAkademikRows", true), status: str(false, 30), nilai_huruf: str(true, 10), nilai_angka: dec(true), effective_at: { ...date(false), defaultValue: Sequelize.fn("NOW") }, version: { ...int(), defaultValue: 1 }, previous_version_id: fk("RiwayatMetodologiPenelitians", true), is_active: bool(), evidence_type: str(false, 40), metadata: json() })],
        ["SnapshotAkademikMahasiswas", table({ mahasiswa_id: fk("Mahasiswas"), kurikulum_id: fk("Kurikulums", true), periode_akademik_id: fk("PeriodeAkademiks", true), cutoff_at: { ...date(false), defaultValue: Sequelize.fn("NOW") }, total_sks_diambil: { ...dec(), defaultValue: 0 }, total_sks_lulus: { ...dec(), defaultValue: 0 }, ip_semester: dec(true), ipk: dec(true), wajib_total: { ...int(), defaultValue: 0 }, wajib_lulus: { ...int(), defaultValue: 0 }, wajib_belum_lulus: json([]), metodologi_status: str(true, 30), data_state: str(false, 30), quality_issues: json([]), source_revisions: json([]), calculation_version: str(false, 30), calculation_status: str(false, 30), input_checksum: str(false, 64), calculated_at: date(), is_current: bool() })],
        ["RuleSetAkademiks", table({ kode: str(false, 80), context: str(false, 50), version: int(), mode: { ...str(false, 30), defaultValue: "shadow" }, undetermined_policy: { ...str(false, 30), defaultValue: "warn" }, configuration: json(), status: { ...str(false, 40), defaultValue: "draft" }, activated_at: date(), activated_by: int(true) })],
        ["EvaluasiEligibilityAkademiks", table({ context: str(false, 50), mahasiswa_id: fk("Mahasiswas"), reference_type: str(true, 60), reference_id: int(true), snapshot_id: fk("SnapshotAkademikMahasiswas", true), rule_set_id: fk("RuleSetAkademiks", true), rule_version: int(true), mode: str(false, 30), evaluated_result: str(false, 30), effective_decision: str(false, 30), reason_codes: json([]), input_facts: json(), correlation_id: str(), evaluated_at: { ...date(false), defaultValue: Sequelize.fn("NOW") } })],
        ["KoreksiDataAkademiks", table({ target_entity: str(false, 60), target_record_id: int(), replacement_record_id: int(true), previous_correction_id: fk("KoreksiDataAkademiks", true), before_values: json(), after_values: json(), reason: { type: Sequelize.TEXT, allowNull: false }, evidence_reference: str(true, 255), expected_revision: int(), actor_id: int(), status: { ...str(false, 40), defaultValue: "active" }, revoked_at: date(), revoked_by: int(true) })],
        ["KonflikDataAkademiks", table({ entity_type: str(false, 60), left_record_id: int(true), right_record_id: int(true), import_row_id: fk("ImportAkademikRows", true), conflict_fields: json([]), status: { ...str(false, 40), defaultValue: "open" }, resolution: json(), resolved_by: int(true), resolved_at: date() })],
        ["PekerjaanSnapshotAkademiks", table({ mahasiswa_id: fk("Mahasiswas"), target_checksum: str(false, 64), calculation_version: str(false, 30), status: { ...str(false, 40), defaultValue: "queued" }, attempt_count: { ...int(), defaultValue: 0 }, last_error_code: str(true, 80), last_error_message: { type: Sequelize.TEXT, allowNull: true }, next_retry_at: date(), completed_at: date() })],
        ["OutboxAkademiks", table({ event_type: str(false, 80), aggregate_type: str(false, 60), aggregate_id: int(), deduplication_key: { ...str(false, 180), unique: true }, payload: json(), status: { ...str(false, 40), defaultValue: "pending" }, attempt_count: { ...int(), defaultValue: 0 }, available_at: { ...date(false), defaultValue: Sequelize.fn("NOW") }, processed_at: date(), last_error: { type: Sequelize.TEXT, allowNull: true } })],
      ];

      const existing = new Set((await qi.showAllTables({ transaction })).map((v) => typeof v === "string" ? v : v.tableName));
      for (const [name, columns] of definitions) {
        if (!existing.has(name)) await qi.createTable(name, columns, { transaction });
      }

      const indexes = [
        ["PeriodeAkademiks", ["tahun_mulai", "tahun_selesai", "semester"], "uq_periode_akademik_year_range", true],
        ["Kurikulums", ["kode", "kode_program_studi", "program_kuliah"], "uq_kurikulum_scope", true],
        ["MataKuliahs", ["kode", "kode_program_studi", "program_kuliah"], "uq_mata_kuliah_scope", true],
        ["MataKuliahAliases", ["source_id", "kode_alias", "kode_program_studi"], "uq_mata_kuliah_alias_scope", true],
        ["KurikulumMataKuliahs", ["kurikulum_id", "mata_kuliah_id"], "uq_kurikulum_mata_kuliah", true],
        ["ImportAkademikRows", ["batch_id", "sheet_name", "row_number"], "uq_import_akademik_row", true],
        ["RuleSetAkademiks", ["kode", "version"], "uq_rule_set_akademik_version", true],
        ["PekerjaanSnapshotAkademiks", ["mahasiswa_id", "target_checksum", "calculation_version"], "uq_snapshot_job", true],
      ];
      for (const [name, fields, indexName, unique] of indexes) {
        const names = new Set((await qi.showIndex(name, { transaction })).map((v) => v.name));
        if (!names.has(indexName)) await qi.addIndex(name, fields, { name: indexName, unique, transaction });
      }

      await qi.sequelize.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_mahasiswa_kurikulum_active ON "MahasiswaKurikulums" (mahasiswa_id) WHERE is_active = true`, { transaction });
      await qi.sequelize.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_attempt_external_active ON "PercobaanMataKuliahMahasiswas" (source_id, external_record_id) WHERE is_active = true AND external_record_id IS NOT NULL`, { transaction });
      await qi.sequelize.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_attempt_fallback_active ON "PercobaanMataKuliahMahasiswas" (source_id, mahasiswa_id, mata_kuliah_id, periode_akademik_id, kelas_normalized, attempt_ke) WHERE is_active = true AND external_record_id IS NULL`, { transaction });
      await qi.sequelize.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_snapshot_current ON "SnapshotAkademikMahasiswas" (mahasiswa_id) WHERE is_current = true`, { transaction });
      await qi.sequelize.query(`ALTER TABLE "PeriodeAkademiks" DROP CONSTRAINT IF EXISTS ck_periode_akademik_year_range`, { transaction });
      await qi.sequelize.query(`ALTER TABLE "PeriodeAkademiks" ADD CONSTRAINT ck_periode_akademik_year_range CHECK (tahun_mulai IS NULL OR tahun_selesai = tahun_mulai + 1)`, { transaction });
    });
  },

  async down(queryInterface) {
    const tables = ["OutboxAkademiks", "PekerjaanSnapshotAkademiks", "KonflikDataAkademiks", "KoreksiDataAkademiks", "EvaluasiEligibilityAkademiks", "RuleSetAkademiks", "SnapshotAkademikMahasiswas", "RiwayatMetodologiPenelitians", "PercobaanMataKuliahMahasiswas", "CakupanDatasetAkademiks", "ImportAkademikRows", "ImportAkademikBatches", "MahasiswaKurikulums", "KurikulumMataKuliahs", "EkuivalensiMataKuliahs", "KelompokEkuivalensiMataKuliahs", "MataKuliahAliases", "MataKuliahs", "Kurikulums", "SumberDataAkademiks"];
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const name of tables) await queryInterface.dropTable(name, { transaction });
      await queryInterface.removeColumn("PeriodeAkademiks", "tahun_selesai", { transaction });
      await queryInterface.removeColumn("PeriodeAkademiks", "tahun_mulai", { transaction });
    });
  },
};
