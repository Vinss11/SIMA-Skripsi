"use strict";

const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  const json = (value = {}) => ({ type: DataTypes.JSONB, allowNull: false, defaultValue: value });
  const text = (allowNull = true) => ({ type: DataTypes.TEXT, allowNull });
  const string = (allowNull = false, length = 120) => ({ type: DataTypes.STRING(length), allowNull });
  const integer = (allowNull = false) => ({ type: DataTypes.INTEGER, allowNull });
  const boolean = (value = true) => ({ type: DataTypes.BOOLEAN, allowNull: false, defaultValue: value });
  const date = (allowNull = true) => ({ type: DataTypes.DATE, allowNull });
  const decimal = (allowNull = false) => ({ type: DataTypes.DECIMAL(8, 3), allowNull });
  const status = (value) => ({ ...string(false, 40), defaultValue: value });

  const specs = {
    SumberDataAkademik: ["SumberDataAkademiks", {
      kode: { ...string(false, 80), unique: true }, nama: string(false, 160), jenis: string(false, 40),
      kode_program_studi: string(true, 40), authority_level: { ...integer(), defaultValue: 0 },
      is_active: boolean(), metadata: json(),
    }],
    Kurikulum: ["Kurikulums", {
      kode: string(false, 80), nama: string(false, 180), kode_program_studi: string(false, 40),
      program_kuliah: { ...string(false, 30), defaultValue: "reguler" }, berlaku_mulai_id: integer(true),
      berlaku_selesai_id: integer(true), status: status("draft"), metadata: json(),
    }, [{ unique: true, fields: ["kode", "kode_program_studi", "program_kuliah"] }]],
    MataKuliah: ["MataKuliahs", {
      kode: string(false, 80), nama: string(false, 180), sks_default: decimal(),
      kode_program_studi: { ...string(false, 40), defaultValue: "INFORMATIKA" },
      program_kuliah: { ...string(false, 30), defaultValue: "reguler" }, role_akademik: string(true, 40),
      status: status("active"), metadata: json(),
    }, [{ unique: true, fields: ["kode", "kode_program_studi", "program_kuliah"] }]],
    MataKuliahAlias: ["MataKuliahAliases", {
      mata_kuliah_id: integer(), source_id: integer(true), kode_alias: string(false, 80),
      kode_program_studi: { ...string(false, 40), defaultValue: "INFORMATIKA" },
      program_kuliah: { ...string(false, 30), defaultValue: "reguler" }, is_active: boolean(),
    }, [{ unique: true, fields: ["source_id", "kode_alias", "kode_program_studi", "program_kuliah"] }]],
    KelompokEkuivalensiMataKuliah: ["KelompokEkuivalensiMataKuliahs", {
      kode: { ...string(false, 80), unique: true }, nama: string(false, 180), dasar_keputusan: text(false), status: status("active"),
    }],
    EkuivalensiMataKuliah: ["EkuivalensiMataKuliahs", {
      kelompok_id: integer(), mata_kuliah_id: integer(), kurikulum_id: integer(true),
      mata_kuliah_sumber_id: integer(true), mata_kuliah_tujuan_id: integer(true),
      arah: { ...string(false, 30), defaultValue: "bidirectional" }, berlaku_mulai_id: integer(true),
      berlaku_selesai_id: integer(true), dasar_keputusan: text(false), is_active: boolean(),
    }, [{ unique: true, fields: ["kelompok_id", "mata_kuliah_id", "kurikulum_id"] }]],
    KurikulumMataKuliah: ["KurikulumMataKuliahs", {
      kurikulum_id: integer(), mata_kuliah_id: integer(), sifat: { ...string(false, 20), defaultValue: "pilihan" },
      sks: decimal(), kategori: string(true, 60), semester_rekomendasi: integer(true), is_active: boolean(),
    }, [{ unique: true, fields: ["kurikulum_id", "mata_kuliah_id"] }]],
    MahasiswaKurikulum: ["MahasiswaKurikulums", {
      mahasiswa_id: integer(), kurikulum_id: integer(), periode_mulai_id: integer(true), source_id: integer(true),
      is_active: boolean(), assigned_by: integer(true), metadata: json(),
    }],
    ImportAkademikBatch: ["ImportAkademikBatches", {
      dataset_type: string(false, 50), schema_version: string(false, 30), source_id: integer(),
      external_revision: string(true), periode_akademik_id: integer(true), original_filename: string(false, 255),
      detected_mime: string(false), file_size: integer(), file_sha256: string(false, 64),
      business_fingerprint: { ...string(false, 64), unique: true }, validation_checksum: string(true, 64),
      status: status("uploaded"), counts: json(), completeness_scope: json(), error_summary: json(),
      preview_expires_at: date(), uploaded_by: integer(), committed_by: integer(true), committed_at: date(),
      idempotency_key: string(true, 160), commit_idempotency_key: string(true, 160), commit_request_fingerprint: string(true, 64),
    }],
    ImportAkademikRow: ["ImportAkademikRows", {
      batch_id: integer(), sheet_name: string(false, 100), row_number: integer(), raw_payload: json(),
      normalized_payload: json(), mahasiswa_id: integer(true), periode_akademik_id: integer(true),
      mata_kuliah_id: integer(true), action: string(false, 30), errors: json([]), warnings: json([]),
      row_fingerprint: string(false, 64), result_entity_type: string(true, 60), result_entity_id: integer(true),
    }, [{ unique: true, fields: ["batch_id", "sheet_name", "row_number"] }]],
    CakupanDatasetAkademik: ["CakupanDatasetAkademiks", {
      batch_id: integer(true), source_id: integer(), source_revision: string(true), dataset_type: string(false, 50),
      mahasiswa_id: integer(true), periode_akademik_id: integer(), scope_type: string(false, 30),
      kode_program_studi: string(true, 40), program_kuliah: string(true, 30), is_complete: boolean(false),
      is_active: boolean(), declared_by_source: boolean(false), declared_at: date(false), checksum: string(false, 64),
      version: { ...integer(), defaultValue: 1 }, previous_version_id: integer(true), superseded_at: date(), metadata: json(),
    }],
    PercobaanMataKuliahMahasiswa: ["PercobaanMataKuliahMahasiswas", {
      mahasiswa_id: integer(), pendaftaran_penjaluran_id: integer(true), mata_kuliah_id: integer(), periode_akademik_id: integer(), source_id: integer(),
      nilai_penjaluran_import_row_id: integer(true),
      import_row_id: integer(true), external_record_id: string(true, 160), external_revision: string(true),
      kelas_normalized: { ...string(false, 80), defaultValue: "DEFAULT" }, attempt_ke: integer(),
      attempt_number_source: string(false, 20), sks_diambil: decimal(), sks_lulus: { ...decimal(), defaultValue: 0 },
      nilai_huruf: string(true, 10), nilai_angka: decimal(true), status_registrasi: string(false, 30),
      status_kelulusan: { ...string(false, 20), defaultValue: "unknown" },
      credit_origin: { ...string(false, 30), defaultValue: "regular" },
      recognition_status: { ...string(false, 30), defaultValue: "not_required" }, effective_at: date(false),
      academic_effective_at: date(false), recorded_at: date(false),
      version: { ...integer(), defaultValue: 1 }, previous_version_id: integer(true), is_active: boolean(),
      superseded_at: date(), metadata: json(),
    }],
    MappingMataKuliahPenjaluran: ["MappingMataKuliahPenjalurans", {
      kurikulum_id: integer(true), jalur: string(false, 40), mata_kuliah_id: integer(),
      periode_berlaku_id: integer(true), program_kuliah: { ...string(false, 30), defaultValue: "reguler" },
      is_active: boolean(), metadata: json(),
    }, [{ unique: true, fields: ["kurikulum_id", "jalur", "program_kuliah", "periode_berlaku_id"] }]],
    KewajibanMataKuliahPenjaluran: ["KewajibanMataKuliahPenjalurans", {
      mahasiswa_id: integer(), pendaftaran_penjaluran_id: integer(), mata_kuliah_id: integer(),
      status: status("belum_tersedia"), fulfilled_attempt_id: integer(true),
    }, [{ unique: true, fields: ["pendaftaran_penjaluran_id", "mata_kuliah_id"] }]],
    ImportNilaiPenjaluran: ["ImportNilaiPenjalurans", {
      periode_penjaluran_id: integer(), original_filename: string(false, 255), file_sha256: string(false, 64),
      status: status("validated"), counts: json(), uploaded_by: integer(), committed_by: integer(true), committed_at: date(),
    }, [{ unique: true, fields: ["periode_penjaluran_id", "file_sha256"] }]],
    ImportNilaiPenjaluranRow: ["ImportNilaiPenjaluranRows", {
      import_id: integer(), row_number: integer(), pendaftaran_penjaluran_id: integer(true),
      mata_kuliah_id: integer(true), nilai_huruf: string(true, 10), is_valid: boolean(false),
      errors: json([]), raw_payload: json(), expected_payload: json(), old_grade: string(true, 10),
      result_attempt_id: integer(true),
    }, [{ unique: true, fields: ["import_id", "row_number"] }]],
    RiwayatMetodologiPenelitian: ["RiwayatMetodologiPenelitians", {
      mahasiswa_id: integer(), periode_akademik_id: integer(), attempt_id: integer(true), source_id: integer(),
      import_row_id: integer(true), status: string(false, 30), nilai_huruf: string(true, 10), nilai_angka: decimal(true),
      effective_at: date(false), academic_effective_at: date(false), recorded_at: date(false),
      version: { ...integer(), defaultValue: 1 }, previous_version_id: integer(true),
      is_active: boolean(), superseded_at: date(), evidence_type: string(false, 40), metadata: json(),
    }],
    SnapshotAkademikMahasiswa: ["SnapshotAkademikMahasiswas", {
      mahasiswa_id: integer(), kurikulum_id: integer(true), periode_akademik_id: integer(true), cutoff_at: date(false),
      snapshot_scope: { ...string(false, 20), defaultValue: "current" },
      total_sks_diambil: { ...decimal(), defaultValue: 0 }, total_sks_lulus: { ...decimal(), defaultValue: 0 },
      ip_semester: decimal(true), ipk: decimal(true), wajib_total: { ...integer(), defaultValue: 0 },
      wajib_lulus: { ...integer(), defaultValue: 0 }, wajib_belum_lulus: json([]), metodologi_status: string(true, 30),
      data_state: string(false, 30), quality_issues: json([]), source_revisions: json([]),
      calculation_version: string(false, 30), calculation_status: string(false, 30), input_checksum: string(false, 64),
      calculated_at: date(), is_current: boolean(),
    }],
    RuleSetAkademik: ["RuleSetAkademiks", {
      kode: string(false, 80), context: string(false, 50), version: integer(), mode: { ...string(false, 30), defaultValue: "shadow" },
      undetermined_policy: { ...string(false, 30), defaultValue: "warn" }, configuration: json(), status: status("draft"),
      activated_at: date(), activated_by: integer(true),
    }, [{ unique: true, fields: ["kode", "version"] }]],
    EvaluasiEligibilityAkademik: ["EvaluasiEligibilityAkademiks", {
      context: string(false, 50), mahasiswa_id: integer(), reference_type: string(true, 60), reference_id: integer(true),
      snapshot_id: integer(true), rule_set_id: integer(true), rule_version: integer(true), mode: string(false, 30),
      evaluated_result: string(false, 30), effective_decision: string(false, 30), reason_codes: json([]), input_facts: json(),
      correlation_id: string(false), evaluated_at: date(false),
    }],
    KoreksiDataAkademik: ["KoreksiDataAkademiks", {
      target_entity: string(false, 60), target_record_id: integer(), replacement_record_id: integer(true),
      previous_correction_id: integer(true), before_values: json(), after_values: json(), reason: text(false),
      evidence_reference: string(true, 255), expected_revision: integer(), actor_id: integer(), status: status("active"),
      revoked_at: date(), revoked_by: integer(true),
    }],
    KonflikDataAkademik: ["KonflikDataAkademiks", {
      entity_type: string(false, 60), left_record_id: integer(true), right_record_id: integer(true), import_row_id: integer(true),
      conflict_fields: json([]), status: status("open"), resolution: json(), resolved_by: integer(true), resolved_at: date(),
    }],
    PekerjaanSnapshotAkademik: ["PekerjaanSnapshotAkademiks", {
      mahasiswa_id: integer(), target_checksum: string(false, 64), calculation_version: string(false, 30), status: status("queued"),
      attempt_count: { ...integer(), defaultValue: 0 }, last_error_code: string(true, 80), last_error_message: text(),
      next_retry_at: date(), completed_at: date(),
    }, [{ unique: true, fields: ["mahasiswa_id", "target_checksum", "calculation_version"] }]],
    OutboxAkademik: ["OutboxAkademiks", {
      event_type: string(false, 80), aggregate_type: string(false, 60), aggregate_id: integer(),
      deduplication_key: { ...string(false, 180), unique: true }, payload: json(), status: status("pending"),
      attempt_count: { ...integer(), defaultValue: 0 }, available_at: date(false), processed_at: date(), last_error: text(),
    }],
  };

  const models = {};
  Object.entries(specs).forEach(([name, [tableName, attributes, indexes = []]]) => {
    class AcademicModel extends Model {}
    AcademicModel.init({ id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true }, ...attributes }, {
      sequelize, modelName: name, tableName, timestamps: true, indexes,
    });
    models[name] = AcademicModel;
  });

  models.ImportAkademikBatch.associate = (all) => {
    models.ImportAkademikBatch.hasMany(all.ImportAkademikRow, { foreignKey: "batch_id", as: "rows" });
  };
  models.ImportAkademikRow.associate = (all) => {
    models.ImportAkademikRow.belongsTo(all.ImportAkademikBatch, { foreignKey: "batch_id", as: "batch" });
  };
  models.ImportNilaiPenjaluran.associate = (all) => {
    models.ImportNilaiPenjaluran.hasMany(all.ImportNilaiPenjaluranRow, { foreignKey: "import_id", as: "rows" });
  };
  models.ImportNilaiPenjaluranRow.associate = (all) => {
    models.ImportNilaiPenjaluranRow.belongsTo(all.ImportNilaiPenjaluran, { foreignKey: "import_id", as: "import" });
  };
  return models.SumberDataAkademik;
};
