"use strict";

const crypto = require("crypto");
const XLSX = require("xlsx");
const { Op } = require("sequelize");
const db = require("../models");
const gradePolicy = require("../config/penjaluranGradePolicy");

class PenjaluranGradeError extends Error {
  constructor(message, status = 400, code = "PENJALURAN_GRADE_INVALID", detail = null) { super(message); this.status = status; this.code = code; this.detail = detail; }
}

const HEADERS = ["ID Pendaftaran", "NIM", "Nama", "Jenis Pendaftaran", "Jalur Penjaluran", "Kode Mata Kuliah", "Mata Kuliah Penjaluran", "Attempt", "Nilai"];
const TRACK_LABELS = { penelitian: "Penelitian", magang: "Magang", perintisan_bisnis: "Perintisan Bisnis", pengabdian: "Pengabdian Masyarakat" };
const TYPE_LABELS = { baru: "Baru", ulang: "Ulang", alih: "Alih" };

function clean(value) { return String(value ?? "").trim(); }
function registrationTrack(row) { return row.jalur === "alih" ? (row.penjaluran_baru || row.jenis_jalur_diambil) : row.jenis_jalur_diambil; }
function isFinalRegistration(row) { return String(row.status).toLowerCase() === "approved" && String(row.form_lanjutan_status || "").toLowerCase() !== "rejected"; }
function gradeStatus(attempt) {
  if (!attempt) return "Belum tersedia";
  if (["planned", "enrolled"].includes(attempt.status_registrasi)) return "Sedang mengambil";
  return attempt.status_kelulusan === "passed" ? "Lulus" : "Tidak lulus";
}

async function resolveMapping(registration, transaction = null, periodOverride = null) {
  const track = registrationTrack(registration);
  if (!track || track === "pengabdian") return null;
  const assignment = await db.MahasiswaKurikulum.findOne({ where: { mahasiswa_id: registration.mahasiswa_id, is_active: true }, transaction: transaction || undefined });
  const mappings = await db.MappingMataKuliahPenjaluran.findAll({
    where: { jalur: track, program_kuliah: registration.program_kuliah || "reguler", is_active: true,
      [Op.and]: [
        { [Op.or]: [{ kurikulum_id: assignment?.kurikulum_id || null }, { kurikulum_id: null }] },
        { [Op.or]: [{ periode_berlaku_id: (periodOverride || registration.periode)?.periode_akademik_id || null }, { periode_berlaku_id: null }] },
      ] },
    order: [["kurikulum_id", "DESC NULLS LAST"], ["periode_berlaku_id", "DESC NULLS LAST"]], transaction: transaction || undefined,
  });
  const mapping = mappings[0];
  if (!mapping) return null;
  const course = await db.MataKuliah.findByPk(mapping.mata_kuliah_id, { transaction: transaction || undefined });
  return course ? { mapping, course, track } : null;
}

async function resolveAcademicPeriod(period, transaction = null) {
  if (!period) return null;
  if (period.periode_akademik_id) return db.PeriodeAkademik.findByPk(period.periode_akademik_id, { transaction: transaction || undefined });
  return db.PeriodeAkademik.findOne({ where: { tahun_akademik: period.tahun_akademik, semester: period.semester }, transaction: transaction || undefined });
}

async function registrationRows(periodePenjaluranId = null, { mahasiswaId = null, programKuliah = null, transaction = null } = {}) {
  const where = {};
  if (periodePenjaluranId) where.periode_penjaluran_id = Number(periodePenjaluranId);
  if (mahasiswaId) where.mahasiswa_id = Number(mahasiswaId);
  if (programKuliah) where.program_kuliah = String(programKuliah).trim().toLowerCase();
  const registrations = await db.PendaftaranPenjaluran.findAll({ where, include: [
    { model: db.Mahasiswa, as: "mahasiswa", attributes: ["id", "nim", "nama"] },
    { model: db.PeriodePenjaluran, as: "periode", attributes: ["id", "label_periode", "tahun_akademik", "semester", "periode_akademik_id"] },
  ], order: [["createdAt", "DESC"]], transaction: transaction || undefined });
  const result = [];
  for (const registration of registrations) {
    const academicPeriod = await resolveAcademicPeriod(registration.periode, transaction);
    const resolved = await resolveMapping(
      registration,
      transaction,
      academicPeriod ? { periode_akademik_id: academicPeriod.id } : registration.periode,
    );
    const course = resolved?.course || null;
    let attempt = course ? await db.PercobaanMataKuliahMahasiswa.findOne({ where: {
      pendaftaran_penjaluran_id: registration.id, mata_kuliah_id: course.id, is_active: true,
    }, order: [["version", "DESC"]], transaction: transaction || undefined }) : null;
    let reused = false;
    if (!attempt && registration.jalur === "ulang" && course) {
      attempt = await db.PercobaanMataKuliahMahasiswa.findOne({ where: {
        mahasiswa_id: registration.mahasiswa_id, mata_kuliah_id: course.id, is_active: true, status_kelulusan: "passed",
      }, order: [["attempt_ke", "DESC"], ["updatedAt", "DESC"]], transaction: transaction || undefined });
      reused = Boolean(attempt);
    }
    const maxAttempt = course ? Number(await db.PercobaanMataKuliahMahasiswa.max("attempt_ke", { where: { mahasiswa_id: registration.mahasiswa_id, mata_kuliah_id: course.id }, transaction: transaction || undefined }) || 0) : 0;
    result.push({
      pendaftaran_id: registration.id, mahasiswa_id: registration.mahasiswa_id, nim: registration.mahasiswa?.nim || "-", nama: registration.mahasiswa?.nama || "-",
      jenis_pendaftaran: registration.jalur, jenis_pendaftaran_label: TYPE_LABELS[registration.jalur] || registration.jalur,
      jalur: resolved?.track || registrationTrack(registration), jalur_label: TRACK_LABELS[resolved?.track || registrationTrack(registration)] || "-",
      program_kuliah: registration.program_kuliah,
      status_pendaftaran: registration.status, mata_kuliah_id: course?.id || null, kode_mata_kuliah: course?.kode || null,
      mata_kuliah: course?.nama || (registrationTrack(registration) === "pengabdian" ? "Tetap hold" : "Mapping belum tersedia"),
      periode_penjaluran_id: registration.periode_penjaluran_id, periode: registration.periode?.label_periode || "-",
      periode_akademik_id: academicPeriod?.id || null,
      attempt: attempt?.attempt_ke || maxAttempt + 1, nilai: attempt?.nilai_huruf || null, status_nilai: gradeStatus(attempt),
      updated_at: attempt?.updatedAt || registration.updatedAt, reused_previous_pass: reused, eligible_for_import: isFinalRegistration(registration) && Boolean(course) && Boolean(academicPeriod?.id) && !reused,
      attempt_id: attempt?.id || null,
    });
  }
  return result;
}

async function listPeriods() { return db.PeriodePenjaluran.findAll({ attributes: ["id", "label_periode", "tahun_akademik", "semester", "status", "is_active", "periode_akademik_id"], order: [["tahun_akademik", "DESC"], ["semester", "ASC"]] }); }

function templatePayload(row) {
  return { "ID Pendaftaran": row.pendaftaran_id, NIM: row.nim, Nama: row.nama, "Jenis Pendaftaran": row.jenis_pendaftaran_label,
    "Jalur Penjaluran": row.jalur_label, "Kode Mata Kuliah": row.kode_mata_kuliah, "Mata Kuliah Penjaluran": row.mata_kuliah, Attempt: row.attempt, Nilai: "" };
}

async function buildTemplate(periodePenjaluranId) {
  const rows = (await registrationRows(periodePenjaluranId)).filter((row) => row.eligible_for_import).map(templatePayload);
  const sheet = XLSX.utils.json_to_sheet(rows, { header: HEADERS });
  sheet["!cols"] = [{ wch: 17 }, { wch: 16 }, { wch: 28 }, { wch: 20 }, { wch: 22 }, { wch: 20 }, { wch: 32 }, { wch: 10 }, { wch: 12 }];
  const instructions = XLSX.utils.aoa_to_sheet([
    ["PETUNJUK IMPORT NILAI PENJALURAN"], ["Hanya isi kolom Nilai. Jangan mengubah identitas baris."],
    ["Nilai yang diperbolehkan", gradePolicy.ALLOWED_GRADES.join(", ")], ["Nilai minimum lulus", gradePolicy.MINIMUM_PASSING_GRADE],
  ]);
  const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, sheet, "Data"); XLSX.utils.book_append_sheet(workbook, instructions, "Petunjuk");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

function readRows(bytes) {
  const workbook = XLSX.read(bytes, { type: "buffer", raw: true, cellFormula: true });
  if (!workbook.SheetNames.includes("Data")) throw new PenjaluranGradeError("Sheet Data tidak ditemukan.", 400, "GRADE_IMPORT_SCHEMA_INVALID");
  const sheet = workbook.Sheets.Data;
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true });
  const headers = (matrix[0] || []).map(clean);
  const missing = HEADERS.filter((header) => !headers.includes(header));
  if (missing.length) throw new PenjaluranGradeError("Header template tidak lengkap.", 400, "GRADE_IMPORT_SCHEMA_INVALID", { missing_headers: missing });
  return matrix.slice(1).filter((cells) => cells.some((value) => clean(value))).map((cells, index) => ({ rowNumber: index + 2,
    payload: Object.fromEntries(headers.map((header, column) => [header, cells[column] ?? ""])) }));
}

async function createPreview({ periodePenjaluranId, bytes, filename, actorId }) {
  const period = await db.PeriodePenjaluran.findByPk(periodePenjaluranId);
  if (!period) throw new PenjaluranGradeError("Periode pendaftaran penjaluran tidak ditemukan.", 404, "GRADE_PERIOD_NOT_FOUND");
  const fileSha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  const replay = await db.ImportNilaiPenjaluran.findOne({ where: { periode_penjaluran_id: periodePenjaluranId, file_sha256: fileSha256 }, include: [{ model: db.ImportNilaiPenjaluranRow, as: "rows" }] });
  if (replay) return { import: replay, replayed: true };
  const uploaded = readRows(bytes);
  if (!uploaded.length || uploaded.length > 10000) throw new PenjaluranGradeError("File harus berisi 1 sampai 10.000 baris data.", 400, "GRADE_IMPORT_SIZE_INVALID");
  const expectedRows = (await registrationRows(periodePenjaluranId)).filter((row) => row.eligible_for_import);
  const expectedMap = new Map(expectedRows.map((row) => [Number(row.pendaftaran_id), row]));
  const duplicateIds = new Set(); const seen = new Set();
  for (const item of uploaded) { const id = Number(item.payload["ID Pendaftaran"]); if (seen.has(id)) duplicateIds.add(id); seen.add(id); }
  return db.sequelize.transaction(async (transaction) => {
    const rowPayloads = uploaded.map((item) => {
      const id = Number(item.payload["ID Pendaftaran"]); const expected = expectedMap.get(id); const errors = []; const grade = gradePolicy.normalizeGrade(item.payload.Nilai);
      if (!expected) errors.push("Pendaftaran tidak ditemukan, tidak final, atau tidak layak pada periode terpilih.");
      if (duplicateIds.has(id)) errors.push("ID pendaftaran muncul lebih dari satu kali.");
      if (!gradePolicy.isAllowedGrade(grade)) errors.push(grade ? `Nilai ${grade} tidak diperbolehkan.` : "Nilai wajib diisi.");
      if (expected) {
        const comparisons = [["NIM", expected.nim], ["Nama", expected.nama], ["Jenis Pendaftaran", expected.jenis_pendaftaran_label], ["Jalur Penjaluran", expected.jalur_label], ["Kode Mata Kuliah", expected.kode_mata_kuliah], ["Mata Kuliah Penjaluran", expected.mata_kuliah], ["Attempt", expected.attempt]];
        if (comparisons.some(([field, value]) => clean(item.payload[field]) !== clean(value))) errors.push("Identitas baris berubah dari template sistem.");
      }
      return { row_number: item.rowNumber, pendaftaran_penjaluran_id: expected?.pendaftaran_id || null, mata_kuliah_id: expected?.mata_kuliah_id || null,
        nilai_huruf: grade || null, is_valid: errors.length === 0, errors, raw_payload: item.payload, expected_payload: expected ? templatePayload(expected) : {}, old_grade: expected?.nilai || null };
    });
    const valid = rowPayloads.filter((row) => row.is_valid).length;
    const imported = await db.ImportNilaiPenjaluran.create({ periode_penjaluran_id: periodePenjaluranId, original_filename: clean(filename).slice(0, 255), file_sha256: fileSha256,
      status: valid ? "validated" : "invalid", counts: { total: rowPayloads.length, valid, invalid: rowPayloads.length - valid }, uploaded_by: actorId }, { transaction });
    await db.ImportNilaiPenjaluranRow.bulkCreate(rowPayloads.map((row) => ({ ...row, import_id: imported.id })), { transaction });
    return { import: await db.ImportNilaiPenjaluran.findByPk(imported.id, { include: [{ model: db.ImportNilaiPenjaluranRow, as: "rows" }], transaction }), replayed: false };
  });
}

async function getSystemSource(transaction) {
  const [source] = await db.SumberDataAkademik.findOrCreate({ where: { kode: "NILAI-PENJALURAN" }, defaults: { nama: "Import Nilai Mata Kuliah Penjaluran", jenis: "penjaluran_grade_import", kode_program_studi: "INFORMATIKA", authority_level: 100, is_active: true, metadata: {} }, transaction });
  return source;
}

async function commitImport(importId, actorId) {
  return db.sequelize.transaction(async (transaction) => {
    const imported = await db.ImportNilaiPenjaluran.findByPk(importId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!imported) throw new PenjaluranGradeError("Preview import tidak ditemukan.", 404, "GRADE_IMPORT_NOT_FOUND");
    if (imported.status === "committed") return { import: imported, replayed: true };
    const importRows = await db.ImportNilaiPenjaluranRow.findAll({ where: { import_id: imported.id }, order: [["row_number", "ASC"]], transaction });
    imported.setDataValue("rows", importRows);
    const source = await getSystemSource(transaction); let saved = 0; let skipped = 0;
    for (const row of importRows.filter((item) => item.is_valid)) {
      const registration = await db.PendaftaranPenjaluran.findByPk(row.pendaftaran_penjaluran_id, { transaction, lock: transaction.LOCK.UPDATE });
      const registrationPeriod = registration ? await db.PeriodePenjaluran.findByPk(registration.periode_penjaluran_id, { transaction }) : null;
      const academicPeriod = await resolveAcademicPeriod(registrationPeriod, transaction);
      if (registration) registration.periode = registrationPeriod;
      const resolved = registration ? await resolveMapping(registration, transaction, registrationPeriod) : null;
      if (!registration || !academicPeriod?.id || !isFinalRegistration(registration) || Number(registration.periode_penjaluran_id) !== Number(imported.periode_penjaluran_id) || Number(resolved?.course?.id) !== Number(row.mata_kuliah_id)) {
        await row.update({ is_valid: false, errors: ["Data pendaftaran berubah setelah preview; baris tidak disimpan."] }, { transaction }); skipped += 1; continue;
      }
      const grade = gradePolicy.normalizeGrade(row.nilai_huruf); const passed = gradePolicy.isPassingGrade(grade);
      let active = await db.PercobaanMataKuliahMahasiswa.findOne({ where: { pendaftaran_penjaluran_id: registration.id, mata_kuliah_id: row.mata_kuliah_id, is_active: true }, transaction, lock: transaction.LOCK.UPDATE });
      if (active && active.nilai_huruf === grade) { await row.update({ result_attempt_id: active.id }, { transaction }); skipped += 1; continue; }
      const maxAttempt = Number(await db.PercobaanMataKuliahMahasiswa.max("attempt_ke", { where: { mahasiswa_id: registration.mahasiswa_id, mata_kuliah_id: row.mata_kuliah_id }, transaction }) || 0);
      const now = new Date(); const version = active ? Number(active.version) + 1 : 1; const attemptKe = active ? active.attempt_ke : maxAttempt + 1;
      if (active) await active.update({ is_active: false, superseded_at: now }, { transaction });
      const attempt = await db.PercobaanMataKuliahMahasiswa.create({ mahasiswa_id: registration.mahasiswa_id, pendaftaran_penjaluran_id: registration.id,
        mata_kuliah_id: row.mata_kuliah_id, periode_akademik_id: academicPeriod.id, source_id: source.id,
        nilai_penjaluran_import_row_id: row.id, external_record_id: `PENJALURAN:${registration.id}:${row.mata_kuliah_id}`, kelas_normalized: "PENJALURAN",
        attempt_ke: attemptKe, attempt_number_source: "system", sks_diambil: resolved.course.sks_default, sks_lulus: passed ? resolved.course.sks_default : 0,
        nilai_huruf: grade, nilai_angka: gradePolicy.GRADE_POINTS[grade], status_registrasi: "completed", status_kelulusan: passed ? "passed" : "failed",
        credit_origin: "regular", recognition_status: "not_required", effective_at: now, academic_effective_at: now, recorded_at: now,
        version, previous_version_id: active?.id || null, is_active: true, metadata: { source: "penjaluran_grade_import", import_id: imported.id } }, { transaction });
      const [requirement] = await db.KewajibanMataKuliahPenjaluran.findOrCreate({ where: { pendaftaran_penjaluran_id: registration.id, mata_kuliah_id: row.mata_kuliah_id },
        defaults: { mahasiswa_id: registration.mahasiswa_id, status: passed ? "lulus" : "tidak_lulus", fulfilled_attempt_id: passed ? attempt.id : null }, transaction });
      await requirement.update({ status: passed ? "lulus" : "tidak_lulus", fulfilled_attempt_id: passed ? attempt.id : null }, { transaction });
      await row.update({ result_attempt_id: attempt.id }, { transaction }); saved += 1;
    }
    const counts = { ...imported.counts, saved, skipped, invalid: importRows.filter((row) => !row.is_valid).length };
    await imported.update({ status: "committed", counts, committed_by: actorId, committed_at: new Date() }, { transaction });
    return { import: imported, replayed: false };
  });
}

async function getStudentData(mahasiswaId) { return { rows: await registrationRows(null, { mahasiswaId }), minimum_passing_grade: gradePolicy.MINIMUM_PASSING_GRADE }; }
async function getSidangRequirement(mahasiswaId, transaction = null) {
  const rows = await registrationRows(null, { mahasiswaId, transaction });
  const row = rows.find((item) => !["rejected", "cancelled"].includes(String(item.status_pendaftaran || "").toLowerCase()));
  if (!row) {
    return {
      required: false,
      fulfilled: true,
      label: "Mata Kuliah Wajib Penjaluran",
      status: "Tidak berlaku",
      minimum_passing_grade: gradePolicy.MINIMUM_PASSING_GRADE,
    };
  }

  const required = row.jalur !== "pengabdian";
  const fulfilled = !required || (Boolean(row.mata_kuliah_id) && row.status_nilai === "Lulus");
  return {
    required,
    fulfilled,
    label: "Mata Kuliah Wajib Penjaluran",
    jalur: row.jalur,
    jalur_label: row.jalur_label,
    kode_mata_kuliah: row.kode_mata_kuliah,
    mata_kuliah: row.mata_kuliah,
    nilai: row.nilai,
    status: required ? row.status_nilai : "Tidak berlaku",
    minimum_passing_grade: gradePolicy.MINIMUM_PASSING_GRADE,
    syarat_sidang: fulfilled ? "Terpenuhi" : "Belum terpenuhi",
    manual_approval_allowed: false,
  };
}

module.exports = { PenjaluranGradeError, HEADERS, listPeriods, registrationRows, buildTemplate, createPreview, commitImport, getStudentData, getSidangRequirement, gradePolicy };
