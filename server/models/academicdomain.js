"use strict";

const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  const json = (value = {}) => ({ type: DataTypes.JSONB, allowNull: false, defaultValue: value });
  const string = (allowNull = false, length = 120) => ({ type: DataTypes.STRING(length), allowNull });
  const integer = (allowNull = false) => ({ type: DataTypes.INTEGER, allowNull });
  const boolean = (value = true) => ({ type: DataTypes.BOOLEAN, allowNull: false, defaultValue: value });
  const date = (allowNull = true) => ({ type: DataTypes.DATE, allowNull });
  const status = (value) => ({ ...string(false, 40), defaultValue: value });

  const specs = {
    MataKuliah: ["MataKuliahs", {
      kode: string(false, 80), nama: string(false, 180),
      program_kuliah: { ...string(false, 30), defaultValue: "reguler" },
    }, [{ unique: true, fields: ["kode", "program_kuliah"] }]],
    PercobaanMataKuliahMahasiswa: ["PercobaanMataKuliahMahasiswas", {
      mahasiswa_id: integer(), pendaftaran_penjaluran_id: integer(true), mata_kuliah_id: integer(), periode_akademik_id: integer(),
      nilai_penjaluran_import_row_id: integer(true), attempt_ke: integer(), nilai_huruf: string(true, 10),
      status_registrasi: string(false, 30),
      status_kelulusan: { ...string(false, 20), defaultValue: "unknown" },
      version: { ...integer(), defaultValue: 1 }, previous_version_id: integer(true), is_active: boolean(),
    }],
    MappingMataKuliahPenjaluran: ["MappingMataKuliahPenjalurans", {
      jalur: string(false, 40), mata_kuliah_id: integer(), periode_berlaku_id: integer(true),
      program_kuliah: { ...string(false, 30), defaultValue: "reguler" }, is_active: boolean(),
    }, [{ unique: true, fields: ["jalur", "program_kuliah", "periode_berlaku_id"] }]],
    ImportNilaiPenjaluran: ["ImportNilaiPenjalurans", {
      periode_penjaluran_id: integer(), file_sha256: string(false, 64),
      status: status("validated"), counts: json(), uploaded_by: integer(), committed_by: integer(true), committed_at: date(),
    }, [{ unique: true, fields: ["periode_penjaluran_id", "file_sha256"] }]],
    ImportNilaiPenjaluranRow: ["ImportNilaiPenjaluranRows", {
      import_id: integer(), row_number: integer(), pendaftaran_penjaluran_id: integer(true), mata_kuliah_id: integer(true),
      nilai_huruf: string(true, 10), is_valid: boolean(false), errors: json([]), raw_payload: json(),
      old_grade: string(true, 10),
    }, [{ unique: true, fields: ["import_id", "row_number"] }]],
  };

  const models = {};
  Object.entries(specs).forEach(([name, [tableName, attributes, indexes = []]]) => {
    class AcademicModel extends Model {}
    AcademicModel.init({ id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true }, ...attributes }, {
      sequelize, modelName: name, tableName, timestamps: true, indexes,
    });
    models[name] = AcademicModel;
  });

  models.ImportNilaiPenjaluran.associate = (all) => {
    models.ImportNilaiPenjaluran.hasMany(all.ImportNilaiPenjaluranRow, { foreignKey: "import_id", as: "rows" });
  };
  models.ImportNilaiPenjaluranRow.associate = (all) => {
    models.ImportNilaiPenjaluranRow.belongsTo(all.ImportNilaiPenjaluran, { foreignKey: "import_id", as: "import" });
  };
  return models.MataKuliah;
};
