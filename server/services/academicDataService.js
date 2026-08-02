"use strict";

const crypto = require("crypto");
const { Op, where: sqlWhere, json } = require("sequelize");
const db = require("../models");
const policy = require("./academicPolicy");

const CALCULATION_VERSION = "stage5-v1";
const PREVIEW_TTL_MS = 24 * 60 * 60 * 1000;

class AcademicDataError extends Error {
  constructor(message, status = 400, code = "ACADEMIC_ERROR", detail = null) {
    super(message); this.status = status; this.code = code; this.detail = detail;
  }
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.keys(value).sort().reduce((acc, key) => { acc[key] = stable(value[key]); return acc; }, {});
  return value;
}
function checksum(value) { return crypto.createHash("sha256").update(JSON.stringify(stable(value))).digest("hex"); }
function plain(value) { return value?.toJSON ? value.toJSON() : value; }

function normalizeProgramKuliah(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!["reguler", "internasional"].includes(normalized)) {
    throw new AcademicDataError("Program kuliah import tidak dikenal.", 400, "ACADEMIC_PROGRAM_TYPE_INVALID");
  }
  return normalized;
}

const COMPLETENESS_SCOPE_TYPES = new Set(["student", "program", "cohort"]);

function normalizeCompletenessScope(scope = {}, { defaultPeriodId = null, programCode = "INFORMATIKA", programKuliah = "reguler" } = {}) {
  const scopeType = String(scope.scope_type || "program").trim().toLowerCase();
  if (!COMPLETENESS_SCOPE_TYPES.has(scopeType)) {
    throw new AcademicDataError("Scope kelengkapan dataset tidak dikenal.", 400, "ACADEMIC_COMPLETENESS_SCOPE_INVALID");
  }
  const isComplete = scope.is_complete === true;
  if (isComplete && !Number(defaultPeriodId)) {
    throw new AcademicDataError("Periode akademik wajib dipilih ketika dataset dinyatakan lengkap.", 400, "ACADEMIC_COMPLETENESS_PERIOD_REQUIRED");
  }
  const mahasiswaId = Number(scope.mahasiswa_id || 0) || null;
  if (scopeType === "student" && !mahasiswaId) {
    throw new AcademicDataError("Mahasiswa wajib ditentukan untuk completeness scope student.", 400, "ACADEMIC_COMPLETENESS_STUDENT_REQUIRED");
  }
  const cohort = String(scope.cohort || scope.angkatan || "").trim() || null;
  if (scopeType === "cohort" && !cohort) {
    throw new AcademicDataError("Angkatan wajib ditentukan untuk completeness scope cohort.", 400, "ACADEMIC_COMPLETENESS_COHORT_REQUIRED");
  }
  return {
    ...scope,
    scope_type: scopeType,
    mahasiswa_id: scopeType === "student" ? mahasiswaId : null,
    cohort: scopeType === "cohort" ? cohort : null,
    is_complete: isComplete,
    kode_program_studi: scope.kode_program_studi || programCode,
    program_kuliah: normalizeProgramKuliah(scope.program_kuliah || programKuliah),
  };
}

async function resolveCourse(code, sourceId, programCode, programKuliah, transaction) {
  const normalized = policy.normalizeCode(code);
  const courses = await db.MataKuliah.findAll({ where: { kode: normalized, kode_program_studi: programCode, program_kuliah: programKuliah, status: "active" }, transaction });
  const aliases = await db.MataKuliahAlias.findAll({
    where: { kode_alias: normalized, kode_program_studi: programCode, program_kuliah: programKuliah,
      is_active: true, [Op.or]: [{ source_id: sourceId }, { source_id: null }] }, transaction,
  });
  const ids = new Set([...courses.map((v) => v.id), ...aliases.map((v) => v.mata_kuliah_id)]);
  if (ids.size !== 1) return { course: null, error: ids.size === 0 ? "ACADEMIC_COURSE_NOT_FOUND" : "ACADEMIC_COURSE_AMBIGUOUS" };
  return { course: await db.MataKuliah.findByPk([...ids][0], { transaction }), error: null };
}

async function validateRows({ datasetType, sourceId, rows, defaultPeriodId, programCode = "INFORMATIKA", programKuliah = "reguler", transaction }) {
  const normalizedProgramKuliah = normalizeProgramKuliah(programKuliah);
  const output = [];
  const seen = new Set();
  const normalizedNims = [...new Set(rows.map((row) => policy.normalizeNim(row?.nim)).filter(Boolean))];
  const normalizedPeriodCodes = [...new Set(rows.map((row) => policy.normalizeCode(row?.kode_periode)).filter(Boolean))];
  const normalizedCourseCodes = datasetType === "course_attempts" ? [...new Set(rows.map((row) => policy.normalizeCode(row?.kode_mata_kuliah)).filter(Boolean))] : [];
  const [students, periods, defaultPeriod, directCourses, aliases] = await Promise.all([
    normalizedNims.length ? db.Mahasiswa.findAll({ where: { nim: { [Op.in]: normalizedNims } }, attributes: ["id", "nim"], transaction }) : [],
    normalizedPeriodCodes.length ? db.PeriodeAkademik.findAll({ where: { kode: { [Op.in]: normalizedPeriodCodes } }, transaction }) : [],
    defaultPeriodId ? db.PeriodeAkademik.findByPk(defaultPeriodId, { transaction }) : null,
    normalizedCourseCodes.length ? db.MataKuliah.findAll({ where: { kode: { [Op.in]: normalizedCourseCodes }, kode_program_studi: programCode,
      program_kuliah: normalizedProgramKuliah, status: "active" }, transaction }) : [],
    normalizedCourseCodes.length ? db.MataKuliahAlias.findAll({ where: { kode_alias: { [Op.in]: normalizedCourseCodes }, kode_program_studi: programCode,
      program_kuliah: normalizedProgramKuliah, is_active: true, [Op.or]: [{ source_id: sourceId }, { source_id: null }] }, transaction }) : [],
  ]);
  const aliasCourseIds = [...new Set(aliases.map((row) => row.mata_kuliah_id))];
  const aliasCourses = aliasCourseIds.length ? await db.MataKuliah.findAll({ where: { id: { [Op.in]: aliasCourseIds }, status: "active" }, transaction }) : [];
  const courseById = new Map([...directCourses, ...aliasCourses].map((row) => [Number(row.id), row]));
  const studentMap = new Map(); students.forEach((row) => { if (!studentMap.has(row.nim)) studentMap.set(row.nim, []); studentMap.get(row.nim).push(row); });
  const periodMap = new Map(); periods.forEach((row) => { if (!periodMap.has(row.kode)) periodMap.set(row.kode, []); periodMap.get(row.kode).push(row); });
  const courseCandidates = new Map();
  directCourses.forEach((row) => { if (!courseCandidates.has(row.kode)) courseCandidates.set(row.kode, new Set()); courseCandidates.get(row.kode).add(Number(row.id)); });
  aliases.forEach((row) => { if (courseById.has(Number(row.mata_kuliah_id))) { if (!courseCandidates.has(row.kode_alias)) courseCandidates.set(row.kode_alias, new Set()); courseCandidates.get(row.kode_alias).add(Number(row.mata_kuliah_id)); } });
  const externalIds = [...new Set(rows.map((row) => String(row?.external_record_id ?? "").trim()).filter(Boolean))];
  const externalAttempts = externalIds.length ? await db.PercobaanMataKuliahMahasiswa.findAll({ where: { source_id: sourceId, external_record_id: { [Op.in]: externalIds }, is_active: true }, transaction }) : [];
  const externalAttemptMap = new Map(externalAttempts.map((row) => [row.external_record_id, row]));
  const externalAttemptIds = externalAttempts.map((row) => row.id);
  const corrections = externalAttemptIds.length ? await db.KoreksiDataAkademik.findAll({ where: { target_entity: "course_attempt", status: "active",
    [Op.or]: [{ target_record_id: { [Op.in]: externalAttemptIds } }, { replacement_record_id: { [Op.in]: externalAttemptIds } }] }, transaction }) : [];
  const correctedAttemptIds = new Set(corrections.flatMap((row) => [Number(row.target_record_id), Number(row.replacement_record_id)]));
  for (let index = 0; index < rows.length; index += 1) {
    const input = rows[index] || {};
    const errors = [];
    const warnings = [];
    if (input.__has_formula) errors.push("ACADEMIC_FORMULA_NOT_ALLOWED");
    const nim = policy.normalizeNim(input.nim);
    const mahasiswaMatches = studentMap.get(nim) || [];
    if (mahasiswaMatches.length !== 1) errors.push(mahasiswaMatches.length ? "ACADEMIC_NIM_AMBIGUOUS" : "ACADEMIC_NIM_NOT_FOUND");
    const periodCode = policy.normalizeCode(input.kode_periode);
    const periodMatches = periodCode ? periodMap.get(periodCode) || [] : [];
    let period = periodCode ? periodMatches.length === 1 ? periodMatches[0] : null : defaultPeriod;
    if (periodMatches.length > 1) errors.push("ACADEMIC_PERIOD_AMBIGUOUS");
    if (!period) errors.push("ACADEMIC_PERIOD_NOT_FOUND");

    let course = null;
    let normalized = { nim, kode_periode: periodCode || period?.kode || null, kode_program_studi: programCode,
      program_kuliah: normalizedProgramKuliah };
    if (datasetType === "course_attempts") {
      const courseCode = policy.normalizeCode(input.kode_mata_kuliah);
      const candidateIds = courseCandidates.get(courseCode) || new Set();
      course = candidateIds.size === 1 ? courseById.get([...candidateIds][0]) : null;
      if (candidateIds.size !== 1) errors.push(candidateIds.size ? "ACADEMIC_COURSE_AMBIGUOUS" : "ACADEMIC_COURSE_NOT_FOUND");
      const validation = policy.validateAttempt(input);
      errors.push(...validation.errors);
      normalized = {
        ...normalized, kode_mata_kuliah: policy.normalizeCode(input.kode_mata_kuliah),
        attempt_ke: input.attempt_ke === null || input.attempt_ke === undefined || String(input.attempt_ke).trim() === "" ? null : Number(input.attempt_ke),
        kelas_normalized: policy.normalizeCode(input.kelas || "DEFAULT") || "DEFAULT",
        nilai_huruf: String(input.nilai_huruf ?? "").trim().toUpperCase() || null,
        external_record_id: String(input.external_record_id ?? "").trim() || null,
        external_revision: String(input.external_revision ?? "").trim() || null,
        academic_effective_at: input.academic_effective_at || input.tanggal_hasil_resmi || null,
        ...validation.normalized,
      };
      if (normalized.academic_effective_at && Number.isNaN(new Date(normalized.academic_effective_at).getTime())) errors.push("ACADEMIC_EFFECTIVE_DATE_INVALID");
      const duplicateKey = `${nim}|${period?.id || periodCode}|${course?.id || normalized.kode_mata_kuliah}|${normalized.kelas_normalized}|${normalized.attempt_ke ?? "auto"}|${normalized.external_record_id || "fallback"}`;
      if (seen.has(duplicateKey)) errors.push("ACADEMIC_DUPLICATE_IN_FILE");
      seen.add(duplicateKey);
    } else if (datasetType === "methodology_status") {
      const result = policy.validateMethodologyStatus(input.status_metodologi);
      if (!result.valid) errors.push("ACADEMIC_METHODOLOGY_STATUS_INVALID");
      normalized = { ...normalized, status_metodologi: result.normalized,
        nilai_huruf: String(input.nilai_huruf ?? "").trim().toUpperCase() || null,
        nilai_angka: policy.parseNullableNumber(input.nilai_angka),
        academic_effective_at: input.academic_effective_at || input.tanggal_hasil_resmi || null };
      if (Number.isNaN(normalized.nilai_angka)) errors.push("ACADEMIC_NUMERIC_GRADE_INVALID");
      if (normalized.academic_effective_at && Number.isNaN(new Date(normalized.academic_effective_at).getTime())) errors.push("ACADEMIC_EFFECTIVE_DATE_INVALID");
    } else {
      errors.push("ACADEMIC_IMPORT_SCHEMA_INVALID");
    }

    let action = errors.length ? "invalid" : "create";
    if (!errors.length && datasetType === "course_attempts") {
      let existing = null;
      if (normalized.external_record_id) existing = externalAttemptMap.get(normalized.external_record_id) || null;
      else {
        const fallbackWhere = { source_id: sourceId, mahasiswa_id: mahasiswaMatches[0].id, mata_kuliah_id: course.id,
          periode_akademik_id: period.id, kelas_normalized: normalized.kelas_normalized, external_record_id: null, is_active: true };
        if (normalized.attempt_ke) fallbackWhere.attempt_ke = normalized.attempt_ke;
        const fallbackMatches = await db.PercobaanMataKuliahMahasiswa.findAll({ where: fallbackWhere, transaction });
        if (fallbackMatches.length > 1) errors.push("ACADEMIC_ATTEMPT_AMBIGUOUS");
        else existing = fallbackMatches[0] || null;
      }
      if (existing) {
        normalized._existing_id = existing.id;
        const activeCorrection = correctedAttemptIds.has(Number(existing.id)) || await db.KoreksiDataAkademik.findOne({ where: { target_entity: "course_attempt", status: "active", [Op.or]: [{ target_record_id: existing.id }, { replacement_record_id: existing.id }] }, transaction });
        const comparable = ["kelas_normalized", "nilai_huruf", "nilai_angka", "status_registrasi", "status_kelulusan", "credit_origin", "recognition_status"];
        const unchanged = comparable.every((field) => String(existing[field] ?? "") === String(normalized[field] ?? "")) && Number(existing.sks_diambil) === Number(normalized.sks);
        action = activeCorrection ? "conflict" : unchanged ? "noop" : "supersede";
        if (activeCorrection) errors.push("ACADEMIC_IMPORT_CONFLICT_ACTIVE_CORRECTION");
      }
      if (errors.length && action === "create") action = "invalid";
    }
    output.push({ sheet_name: input.__sheet_name || "Data", row_number: input.__row_number || index + 2,
      raw_payload: input, normalized_payload: normalized, mahasiswa_id: mahasiswaMatches[0]?.id || null,
      periode_akademik_id: period?.id || null, mata_kuliah_id: course?.id || null, action, errors, warnings,
      row_fingerprint: checksum({ datasetType, normalized }) });
  }
  return output;
}

async function createImportPreview(input) {
  const t = input.transaction;
  const programKuliah = normalizeProgramKuliah(input.programKuliah || input.completenessScope?.program_kuliah || "reguler");
  const completenessScope = normalizeCompletenessScope(input.completenessScope, {
    defaultPeriodId: input.defaultPeriodId, programCode: input.programCode, programKuliah,
  });
  const businessFingerprint = checksum({ dataset_type: input.datasetType, schema_version: input.schemaVersion,
    source_id: input.sourceId, period_id: input.defaultPeriodId || null, program_code: input.programCode || "INFORMATIKA",
    program_kuliah: programKuliah, completeness_scope: completenessScope, file_sha256: input.fileSha256 });
  if (input.idempotencyKey) {
    const byKey = await db.ImportAkademikBatch.findOne({ where: { idempotency_key: input.idempotencyKey }, include: [{ model: db.ImportAkademikRow, as: "rows" }], transaction: t });
    if (byKey) {
      if (byKey.business_fingerprint !== businessFingerprint) throw new AcademicDataError("Idempotency key preview digunakan untuk payload berbeda.", 409, "ACADEMIC_IMPORT_IDEMPOTENCY_CONFLICT");
      return { batch: byKey, replayed: true };
    }
  }
  const replay = await db.ImportAkademikBatch.findOne({ where: { business_fingerprint: businessFingerprint }, include: [{ model: db.ImportAkademikRow, as: "rows" }], transaction: t });
  if (replay) return { batch: replay, replayed: true };
  const validated = await validateRows({ ...input, completenessScope, programKuliah, transaction: t });
  const counts = validated.reduce((acc, row) => { acc.total += 1; acc[row.action] = (acc[row.action] || 0) + 1; return acc; }, { total: 0, create: 0, invalid: 0, conflict: 0, noop: 0, supersede: 0 });
  const validationChecksum = checksum(validated.map((row) => ({ fingerprint: row.row_fingerprint, action: row.action, errors: row.errors })));
  const batch = await db.ImportAkademikBatch.create({ dataset_type: input.datasetType, schema_version: input.schemaVersion,
    source_id: input.sourceId, external_revision: input.externalRevision || null, periode_akademik_id: input.defaultPeriodId || null,
    original_filename: input.filename, detected_mime: input.mime, file_size: input.fileSize, file_sha256: input.fileSha256,
    business_fingerprint: businessFingerprint, validation_checksum: validationChecksum,
    status: counts.invalid || counts.conflict ? "invalid" : "validated", counts, completeness_scope: completenessScope,
    preview_expires_at: new Date(Date.now() + PREVIEW_TTL_MS), uploaded_by: input.actorId, idempotency_key: input.idempotencyKey || null,
  }, { transaction: t });
  await db.ImportAkademikRow.bulkCreate(validated.map((row) => ({ ...row, batch_id: batch.id })), { transaction: t });
  const conflictingRows = await db.ImportAkademikRow.findAll({
    where: { batch_id: batch.id, action: "conflict" }, transaction: t,
  });
  if (conflictingRows.length) {
    await db.KonflikDataAkademik.bulkCreate(conflictingRows.map((row) => ({
      entity_type: "course_attempt",
      left_record_id: row.normalized_payload?._existing_id || null,
      right_record_id: null,
      import_row_id: row.id,
      conflict_fields: row.errors || [],
      status: "open",
      resolution: {},
    })), { transaction: t });
  }
  return { batch: await db.ImportAkademikBatch.findByPk(batch.id, { include: [{ model: db.ImportAkademikRow, as: "rows" }], transaction: t }), replayed: false };
}

async function createImportPreviewTransactional(input) {
  const programKuliah = normalizeProgramKuliah(input.programKuliah || input.completenessScope?.program_kuliah || "reguler");
  const completenessScope = normalizeCompletenessScope(input.completenessScope, {
    defaultPeriodId: input.defaultPeriodId, programCode: input.programCode, programKuliah,
  });
  const businessFingerprint = checksum({ dataset_type: input.datasetType, schema_version: input.schemaVersion,
    source_id: input.sourceId, period_id: input.defaultPeriodId || null, program_code: input.programCode || "INFORMATIKA",
    program_kuliah: programKuliah, completeness_scope: completenessScope, file_sha256: input.fileSha256 });
  try {
    return await db.sequelize.transaction((transaction) => createImportPreview({ ...input, completenessScope, programKuliah, transaction }));
  } catch (error) {
    if (!(error instanceof db.Sequelize.UniqueConstraintError)) throw error;
    const replay = await db.ImportAkademikBatch.findOne({ where: input.idempotencyKey
      ? { [Op.or]: [{ idempotency_key: input.idempotencyKey }, { business_fingerprint: businessFingerprint }] }
      : { business_fingerprint: businessFingerprint }, include: [{ model: db.ImportAkademikRow, as: "rows" }] });
    if (!replay || replay.business_fingerprint !== businessFingerprint) throw new AcademicDataError("Concurrent preview memakai idempotency key untuk payload berbeda.", 409, "ACADEMIC_IMPORT_IDEMPOTENCY_CONFLICT");
    return { batch: replay, replayed: true };
  }
}

function validationSummary(rows) {
  return rows.reduce((acc, row) => { acc.total += 1; acc[row.action] = (acc[row.action] || 0) + 1; return acc; },
    { total: 0, create: 0, invalid: 0, conflict: 0, noop: 0, supersede: 0 });
}

async function replaceBatchValidation(batch, validated, transaction) {
  const oldRows = await db.ImportAkademikRow.findAll({ where: { batch_id: batch.id }, attributes: ["id"], transaction, lock: transaction.LOCK.UPDATE });
  const oldIds = oldRows.map((row) => row.id);
  if (oldIds.length) await db.KonflikDataAkademik.destroy({ where: { import_row_id: { [Op.in]: oldIds }, status: "open" }, transaction });
  await db.ImportAkademikRow.destroy({ where: { batch_id: batch.id }, transaction });
  const createdRows = await db.ImportAkademikRow.bulkCreate(validated.map((row) => ({ ...row, batch_id: batch.id })), { transaction, returning: true });
  const conflicts = createdRows.filter((row) => row.action === "conflict");
  if (conflicts.length) await db.KonflikDataAkademik.bulkCreate(conflicts.map((row) => ({ entity_type: "course_attempt",
    left_record_id: row.normalized_payload?._existing_id || null, import_row_id: row.id,
    conflict_fields: row.errors || [], status: "open", resolution: {} })), { transaction });
  const counts = validationSummary(createdRows);
  const validationChecksum = checksum(createdRows.map((row) => ({ fingerprint: row.row_fingerprint, action: row.action, errors: row.errors })));
  await batch.update({ status: counts.invalid || counts.conflict ? "invalid" : "validated", validation_checksum: validationChecksum,
    preview_expires_at: new Date(Date.now() + PREVIEW_TTL_MS), counts }, { transaction });
  return db.ImportAkademikBatch.findByPk(batch.id, { include: [{ model: db.ImportAkademikRow, as: "rows" }], transaction });
}

async function revalidateImportBatch(batchId) {
  return db.sequelize.transaction(async (transaction) => {
    const batch = await db.ImportAkademikBatch.findByPk(batchId, { include: [{ model: db.ImportAkademikRow, as: "rows" }], transaction, lock: transaction.LOCK.UPDATE });
    if (!batch || !["invalid", "validated", "expired"].includes(batch.status)) throw new AcademicDataError("Batch tidak dapat direvalidasi.", 409, "ACADEMIC_IMPORT_STATE_INVALID");
    const rows = batch.rows.map((row) => ({ ...row.raw_payload, __sheet_name: row.sheet_name, __row_number: row.row_number }));
    const validated = await validateRows({ datasetType: batch.dataset_type, sourceId: batch.source_id, rows,
      defaultPeriodId: batch.periode_akademik_id, programCode: batch.completeness_scope?.kode_program_studi || "INFORMATIKA",
      programKuliah: batch.completeness_scope?.program_kuliah || "reguler", transaction });
    return replaceBatchValidation(batch, validated, transaction);
  });
}

async function resolveAcademicConflict(conflictId, { decision, actorId, changes = null, reason = null }) {
  const allowed = new Set(["keep_admin_correction", "accept_source", "create_manual_correction", "dismiss_false_positive"]);
  if (!allowed.has(decision)) throw new AcademicDataError("Keputusan konflik tidak valid.", 400, "ACADEMIC_CONFLICT_DECISION_INVALID");
  return db.sequelize.transaction(async (transaction) => {
    const conflict = await db.KonflikDataAkademik.findByPk(conflictId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!conflict || conflict.status !== "open") throw new AcademicDataError("Konflik aktif tidak ditemukan.", 404, "ACADEMIC_CONFLICT_NOT_FOUND");
    const row = await db.ImportAkademikRow.findByPk(conflict.import_row_id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!row) throw new AcademicDataError("Raw row konflik tidak ditemukan.", 409, "ACADEMIC_CONFLICT_ROW_MISSING");
    const batch = await db.ImportAkademikBatch.findByPk(row.batch_id, { transaction, lock: transaction.LOCK.UPDATE });
    const normalized = { ...(row.normalized_payload || {}) };
    let activeAttempt = normalized.external_record_id
      ? await db.PercobaanMataKuliahMahasiswa.findOne({ where: { source_id: batch.source_id, external_record_id: normalized.external_record_id, is_active: true }, transaction, lock: transaction.LOCK.UPDATE })
      : await db.PercobaanMataKuliahMahasiswa.findOne({ where: { source_id: batch.source_id, mahasiswa_id: row.mahasiswa_id,
        mata_kuliah_id: row.mata_kuliah_id, periode_akademik_id: row.periode_akademik_id,
        kelas_normalized: normalized.kelas_normalized || "DEFAULT", attempt_ke: normalized.attempt_ke, is_active: true }, transaction, lock: transaction.LOCK.UPDATE });
    if (!activeAttempt) throw new AcademicDataError("Fakta akademik aktif untuk konflik tidak ditemukan.", 409, "ACADEMIC_CONFLICT_FACT_MISSING");
    let action = "noop";
    if (decision === "accept_source") {
      const correction = await db.KoreksiDataAkademik.findOne({ where: { target_entity: "course_attempt", replacement_record_id: activeAttempt.id, status: "active" }, transaction, lock: transaction.LOCK.UPDATE });
      if (correction) await correction.update({ status: "superseded" }, { transaction });
      action = "supersede";
    } else if (decision === "create_manual_correction") {
      const corrected = await correctAcademicRecord("course_attempt", activeAttempt.id, { actorId, reason: reason || "Resolusi konflik import akademik",
        expectedRevision: activeAttempt.version, changes: changes || {}, transaction });
      activeAttempt = await db.PercobaanMataKuliahMahasiswa.findByPk(corrected.record.id, { transaction });
    }
    normalized._existing_id = activeAttempt.id;
    const errors = (row.errors || []).filter((code) => code !== "ACADEMIC_IMPORT_CONFLICT_ACTIVE_CORRECTION");
    await row.update({ normalized_payload: normalized, action, errors,
      result_entity_type: action === "noop" ? "course_attempt" : null, result_entity_id: action === "noop" ? activeAttempt.id : null }, { transaction });
    await conflict.update({ status: decision === "dismiss_false_positive" ? "dismissed" : "resolved",
      resolution: { decision, changes: changes || null, reason: reason || null }, resolved_by: actorId, resolved_at: new Date() }, { transaction });
    const rows = await db.ImportAkademikRow.findAll({ where: { batch_id: batch.id }, transaction });
    const counts = validationSummary(rows);
    const validationChecksum = checksum(rows.map((item) => ({ fingerprint: item.row_fingerprint, action: item.action, errors: item.errors })));
    await batch.update({ status: counts.invalid || counts.conflict ? "invalid" : "validated", counts, validation_checksum: validationChecksum }, { transaction });
    await queueSnapshot(row.mahasiswa_id, `conflict:${conflict.id}:${decision}`, transaction);
    return { conflict: plain(conflict), batch: plain(batch), row: plain(row), fact: plain(activeAttempt) };
  });
}

async function ingestAcademicDataset({ source, schemaVersion, externalRevision, completenessScope, rows, idempotencyKey,
  datasetType = "course_attempts", defaultPeriodId = null, programCode = "INFORMATIKA", programKuliah = null, actorId = null,
  filename = "external-academic-dataset.json", mime = "application/json" }) {
  const sourceRecord = Number.isInteger(source)
    ? await db.SumberDataAkademik.findByPk(source)
    : source?.id
      ? await db.SumberDataAkademik.findByPk(source.id)
      : await db.SumberDataAkademik.findOne({ where: { kode: policy.normalizeCode(source?.kode || source) } });
  if (!sourceRecord?.is_active) throw new AcademicDataError("Sumber data akademik tidak ditemukan atau tidak aktif.", 404, "ACADEMIC_SOURCE_NOT_FOUND");
  const payload = rows || [];
  const fileSha256 = checksum({ source: sourceRecord.id, schemaVersion, externalRevision, completenessScope, rows: payload });
  const resolvedProgramKuliah = normalizeProgramKuliah(programKuliah || completenessScope?.program_kuliah || "reguler");
  return createImportPreviewTransactional({ datasetType, schemaVersion, sourceId: sourceRecord.id, externalRevision,
    completenessScope: { ...(completenessScope || {}), kode_program_studi: completenessScope?.kode_program_studi || programCode,
      program_kuliah: resolvedProgramKuliah }, rows: payload, idempotencyKey, defaultPeriodId, programCode,
    programKuliah: resolvedProgramKuliah, actorId, filename, mime,
    fileSize: Buffer.byteLength(JSON.stringify(payload)), fileSha256 });
}

async function nextAttemptNumber(row, transaction) {
  if (Number.isInteger(row.normalized_payload.attempt_ke) && row.normalized_payload.attempt_ke > 0) return { number: row.normalized_payload.attempt_ke, source: "source" };
  const max = await db.PercobaanMataKuliahMahasiswa.max("attempt_ke", { where: { mahasiswa_id: row.mahasiswa_id, mata_kuliah_id: row.mata_kuliah_id }, transaction });
  return { number: Number(max || 0) + 1, source: "calculated" };
}

async function findAuthoritativeAttempt(row, sourceId, transaction) {
  const payload = row.normalized_payload || {};
  if (payload.external_record_id) return db.PercobaanMataKuliahMahasiswa.findOne({ where: { source_id: sourceId,
    external_record_id: payload.external_record_id, is_active: true }, transaction, lock: transaction.LOCK.UPDATE });
  const where = { source_id: sourceId, mahasiswa_id: row.mahasiswa_id, mata_kuliah_id: row.mata_kuliah_id,
    periode_akademik_id: row.periode_akademik_id, kelas_normalized: payload.kelas_normalized || "DEFAULT",
    external_record_id: null, is_active: true };
  if (payload.attempt_ke) where.attempt_ke = payload.attempt_ke;
  const matches = await db.PercobaanMataKuliahMahasiswa.findAll({ where, transaction, lock: transaction.LOCK.UPDATE });
  if (matches.length > 1) throw new AcademicDataError("Natural key attempt berubah menjadi ambigu sebelum commit.", 409, "ACADEMIC_ATTEMPT_AMBIGUOUS");
  return matches[0] || null;
}

function attemptPayloadUnchanged(existing, normalized) {
  const comparable = ["kelas_normalized", "nilai_huruf", "nilai_angka", "status_registrasi", "status_kelulusan", "credit_origin", "recognition_status"];
  return comparable.every((field) => String(existing[field] ?? "") === String(normalized[field] ?? ""))
    && Number(existing.sks_diambil) === Number(normalized.sks);
}

async function academicFactsRevisionChecksum(mahasiswaId, transaction) {
  const attributes = ["id", "updatedAt"];
  const [attempts, methodology, coverage, curriculum, corrections, conflicts, academicPeriods] = await Promise.all([
    db.PercobaanMataKuliahMahasiswa.findAll({ where: { mahasiswa_id: mahasiswaId, is_active: true }, attributes: [...attributes, "version"], transaction }),
    db.RiwayatMetodologiPenelitian.findAll({ where: { mahasiswa_id: mahasiswaId, is_active: true }, attributes: [...attributes, "version"], transaction }),
    db.CakupanDatasetAkademik.findAll({ where: { is_active: true, [Op.or]: [{ mahasiswa_id: mahasiswaId }, { mahasiswa_id: null }] }, attributes: [...attributes, "version", "checksum"], transaction }),
    db.MahasiswaKurikulum.findAll({ where: { mahasiswa_id: mahasiswaId, is_active: true }, attributes, transaction }),
    db.KoreksiDataAkademik.findAll({ where: { status: "active", [Op.or]: [{ target_record_id: { [Op.in]: db.sequelize.literal(`(SELECT id FROM "PercobaanMataKuliahMahasiswas" WHERE mahasiswa_id = ${Number(mahasiswaId)})`) } }] }, attributes, transaction }),
    db.KonflikDataAkademik.findAll({ where: { status: "open", [Op.or]: [{ entity_type: "student", left_record_id: mahasiswaId }, { entity_type: "course_attempt", left_record_id: { [Op.in]: db.sequelize.literal(`(SELECT id FROM "PercobaanMataKuliahMahasiswas" WHERE mahasiswa_id = ${Number(mahasiswaId)})`) } }] }, attributes, transaction }),
    db.PeriodeAkademik.findAll({ attributes: ["id", "status", "tanggal_mulai", "tanggal_selesai", "updatedAt"], transaction }),
  ]);
  return checksum({ mahasiswaId, attempts, methodology, coverage, curriculum, corrections, conflicts, academicPeriods });
}

async function queueSnapshot(mahasiswaId, reason, transaction, periodId = null) {
  const factsRevision = await academicFactsRevisionChecksum(mahasiswaId, transaction);
  const target = checksum({ facts_revision: factsRevision, snapshot_scope: periodId ? "period_end" : "current", period_id: periodId || null });
  const [job] = await db.PekerjaanSnapshotAkademik.findOrCreate({ where: { mahasiswa_id: mahasiswaId, target_checksum: target, calculation_version: CALCULATION_VERSION }, defaults: { status: "queued" }, transaction });
  if (job.status === "failed") await job.update({ status: "queued", next_retry_at: null, last_error_code: null, last_error_message: null }, { transaction });
  const [outbox] = await db.OutboxAkademik.findOrCreate({ where: { deduplication_key: `snapshot:${mahasiswaId}:${target}` }, defaults: { event_type: "academic.snapshot.requested", aggregate_type: "mahasiswa", aggregate_id: mahasiswaId, payload: { job_id: job.id, reason, period_id: periodId }, status: "pending", available_at: new Date() }, transaction });
  if (outbox.status === "failed") await outbox.update({ status: "pending", available_at: new Date(), last_error: null }, { transaction });
  return job;
}

async function commitImport(batchId, { actorId, checksum: requestedChecksum, idempotencyKey }) {
  const transaction = await db.sequelize.transaction();
  let batch;
  try {
    batch = await db.ImportAkademikBatch.findByPk(batchId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!batch) throw new AcademicDataError("Batch import tidak ditemukan.", 404, "ACADEMIC_IMPORT_NOT_FOUND");
    if (!idempotencyKey) throw new AcademicDataError("Idempotency-Key commit wajib dikirim.", 400, "IDEMPOTENCY_KEY_REQUIRED");
    const commitFingerprint = checksum({ batch_id: Number(batchId), validation_checksum: requestedChecksum });
    if (batch.status === "committed") {
      if (batch.commit_idempotency_key !== idempotencyKey || batch.commit_request_fingerprint !== commitFingerprint) {
        throw new AcademicDataError("Replay commit tidak identik dengan request awal.", 409, "ACADEMIC_IMPORT_IDEMPOTENCY_CONFLICT");
      }
      await transaction.commit(); return { batch, replayed: true };
    }
    if (batch.status !== "validated") throw new AcademicDataError("Batch belum valid atau memiliki error.", 409, "ACADEMIC_IMPORT_HAS_ERRORS", batch.counts);
    if (batch.preview_expires_at && new Date(batch.preview_expires_at) <= new Date()) throw new AcademicDataError("Preview import kedaluwarsa.", 409, "ACADEMIC_IMPORT_PREVIEW_EXPIRED");
    if (!requestedChecksum || requestedChecksum !== batch.validation_checksum) throw new AcademicDataError("Checksum preview berubah.", 409, "ACADEMIC_RECORD_STALE_REVISION");
    if (batch.commit_idempotency_key && (batch.commit_idempotency_key !== idempotencyKey || batch.commit_request_fingerprint !== commitFingerprint)) throw new AcademicDataError("Idempotency key commit digunakan untuk payload berbeda.", 409, "ACADEMIC_IMPORT_IDEMPOTENCY_CONFLICT");
    await batch.update({ status: "committing", commit_idempotency_key: idempotencyKey, commit_request_fingerprint: commitFingerprint }, { transaction });
    const batchRows = await db.ImportAkademikRow.findAll({ where: { batch_id: batch.id }, order: [["row_number", "ASC"]], transaction, lock: transaction.LOCK.UPDATE });
    const periodIds = [...new Set(batchRows.map((row) => Number(row.periode_akademik_id)).filter(Boolean))];
    const periods = periodIds.length ? await db.PeriodeAkademik.findAll({ where: { id: { [Op.in]: periodIds } }, transaction }) : [];
    const periodsById = new Map(periods.map((item) => [Number(item.id), item]));
    const lockedStudentIds = [...new Set(batchRows.map((row) => row.mahasiswa_id).filter(Boolean))].sort((a, b) => a - b);
    if (lockedStudentIds.length) await db.Mahasiswa.findAll({ where: { id: { [Op.in]: lockedStudentIds } }, attributes: ["id"], order: [["id", "ASC"]], transaction, lock: transaction.LOCK.UPDATE });
    const affected = new Set();
    for (const row of batchRows) {
      if (batch.dataset_type === "course_attempts") {
        if (row.action === "conflict" || row.action === "invalid") throw new AcademicDataError("Batch memuat row yang tidak dapat di-commit.", 409, "ACADEMIC_IMPORT_HAS_ERRORS");
        const p = row.normalized_payload;
        const authoritativeAttempt = await findAuthoritativeAttempt(row, batch.source_id, transaction);
        if (authoritativeAttempt) {
          const activeCorrection = await db.KoreksiDataAkademik.findOne({ where: { target_entity: "course_attempt", status: "active",
            [Op.or]: [{ target_record_id: authoritativeAttempt.id }, { replacement_record_id: authoritativeAttempt.id }] }, transaction, lock: transaction.LOCK.UPDATE });
          if (activeCorrection && Number(authoritativeAttempt.id) !== Number(p._existing_id)) throw new AcademicDataError("Fakta dikoreksi Admin setelah preview.", 409, "ACADEMIC_IMPORT_CONFLICT_ACTIVE_CORRECTION");
        }
        if (row.action === "noop" && !authoritativeAttempt) throw new AcademicDataError("Fakta noop berubah setelah preview.", 409, "ACADEMIC_RECORD_STALE_REVISION");
        if (row.action === "noop" || (authoritativeAttempt && attemptPayloadUnchanged(authoritativeAttempt, p))) {
          await row.update({ action: "noop", result_entity_type: "course_attempt", result_entity_id: authoritativeAttempt?.id || p._existing_id }, { transaction });
          affected.add(row.mahasiswa_id);
          continue;
        }
        const attempt = await nextAttemptNumber(row, transaction);
        const previousAttempt = authoritativeAttempt || (p._existing_id ? await db.PercobaanMataKuliahMahasiswa.findByPk(p._existing_id, { transaction, lock: transaction.LOCK.UPDATE }) : null);
        const recordedAt = new Date();
        const academicEffectiveAt = new Date(p.academic_effective_at || periodsById.get(Number(row.periode_akademik_id))?.tanggal_selesai || recordedAt);
        if (previousAttempt) await previousAttempt.update({ is_active: false, superseded_at: recordedAt }, { transaction });
        const created = await db.PercobaanMataKuliahMahasiswa.create({ mahasiswa_id: row.mahasiswa_id, mata_kuliah_id: row.mata_kuliah_id,
          periode_akademik_id: row.periode_akademik_id, source_id: batch.source_id, import_row_id: row.id,
          external_record_id: p.external_record_id, external_revision: p.external_revision || batch.external_revision,
          kelas_normalized: p.kelas_normalized, attempt_ke: previousAttempt?.attempt_ke || attempt.number, attempt_number_source: previousAttempt?.attempt_number_source || attempt.source,
          sks_diambil: p.sks, sks_lulus: p.status_kelulusan === "passed" && policy.isCreditRecognized(p.credit_origin, p.recognition_status) ? p.sks : 0,
          nilai_huruf: p.nilai_huruf, nilai_angka: p.nilai_angka, status_registrasi: p.status_registrasi,
          status_kelulusan: p.status_kelulusan, credit_origin: p.credit_origin, recognition_status: p.recognition_status,
          effective_at: recordedAt, academic_effective_at: academicEffectiveAt, recorded_at: recordedAt,
          version: Number(previousAttempt?.version || 0) + 1, previous_version_id: previousAttempt?.id || null,
          metadata: { batch_id: batch.id } }, { transaction });
        await row.update({ result_entity_type: "course_attempt", result_entity_id: created.id }, { transaction });
        const course = await db.MataKuliah.findByPk(row.mata_kuliah_id, { transaction });
        if (course?.role_akademik === "methodology") await createMethodologyFromAttempt(created, course, batch, row, transaction);
      } else {
        const p = row.normalized_payload;
        const previous = await db.RiwayatMetodologiPenelitian.findOne({ where: { mahasiswa_id: row.mahasiswa_id, is_active: true }, order: [["effective_at", "DESC"]], transaction, lock: transaction.LOCK.UPDATE });
        const recordedAt = new Date();
        const academicEffectiveAt = new Date(p.academic_effective_at || periodsById.get(Number(row.periode_akademik_id))?.tanggal_selesai || recordedAt);
        if (previous) await previous.update({ is_active: false, superseded_at: recordedAt }, { transaction });
        const created = await db.RiwayatMetodologiPenelitian.create({ mahasiswa_id: row.mahasiswa_id, periode_akademik_id: row.periode_akademik_id,
          source_id: batch.source_id, import_row_id: row.id, status: p.status_metodologi, nilai_huruf: p.nilai_huruf,
          nilai_angka: p.nilai_angka, effective_at: recordedAt, academic_effective_at: academicEffectiveAt, recorded_at: recordedAt,
          version: Number(previous?.version || 0) + 1,
          previous_version_id: previous?.id || null, evidence_type: "source_status", metadata: { batch_id: batch.id } }, { transaction });
        await row.update({ result_entity_type: "methodology_history", result_entity_id: created.id }, { transaction });
      }
      affected.add(row.mahasiswa_id);
    }
    const scope = normalizeCompletenessScope(batch.completeness_scope, {
      defaultPeriodId: batch.periode_akademik_id,
      programCode: batch.completeness_scope?.kode_program_studi || "INFORMATIKA",
      programKuliah: batch.completeness_scope?.program_kuliah || "reguler",
    });
    if (scope.is_complete === true) {
      const coverageKey = { source_id: batch.source_id, dataset_type: batch.dataset_type,
        mahasiswa_id: scope.scope_type === "student" ? Number(scope.mahasiswa_id || 0) || null : null,
        periode_akademik_id: batch.periode_akademik_id, scope_type: scope.scope_type || "program",
        kode_program_studi: scope.kode_program_studi || null, program_kuliah: scope.program_kuliah || null, is_active: true };
      const cohortIdentity = scope.scope_type === "cohort" ? {
        [Op.or]: [
          sqlWhere(json("metadata.cohort"), scope.cohort),
          sqlWhere(json("metadata.angkatan"), scope.cohort),
        ],
      } : null;
      const previousCoverage = await db.CakupanDatasetAkademik.findOne({
        where: { ...coverageKey, ...(cohortIdentity ? { [Op.and]: [cohortIdentity] } : {}) },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      const declaredAt = new Date();
      if (previousCoverage) await previousCoverage.update({ is_active: false, superseded_at: declaredAt }, { transaction });
      await db.CakupanDatasetAkademik.create({ ...coverageKey, batch_id: batch.id,
        source_revision: batch.external_revision, is_complete: true, declared_by_source: scope.declared_by_source === true,
        declared_at: declaredAt, checksum: checksum(scope), version: Number(previousCoverage?.version || 0) + 1,
        previous_version_id: previousCoverage?.id || null, metadata: scope,
      }, { transaction });
    }
    for (const mahasiswaId of affected) await queueSnapshot(mahasiswaId, `import:${batch.id}`, transaction);
    await batch.update({ status: "committed", committed_by: actorId, committed_at: new Date() }, { transaction });
    await db.OutboxAkademik.create({ event_type: "academic.import.committed", aggregate_type: "import_batch", aggregate_id: batch.id,
      deduplication_key: `import:${batch.id}:committed`, payload: { mahasiswa_ids: [...affected] }, status: "pending", available_at: new Date() }, { transaction });
    await transaction.commit(); return { batch, replayed: false, affected: [...affected] };
  } catch (error) {
    await transaction.rollback();
    if (batch && !["committed", "invalid"].includes(batch.status)) await db.ImportAkademikBatch.update({ status: "failed", error_summary: { code: error.code || "ACADEMIC_IMPORT_COMMIT_FAILED", message: String(error.message).slice(0, 500) } }, { where: { id: batchId } });
    throw error;
  }
}

async function createMethodologyFromAttempt(attempt, course, batch, row, transaction) {
  let methodologyStatus = "sedang_mengambil";
  if (attempt.status_registrasi === "completed") methodologyStatus = attempt.status_kelulusan === "passed" ? "lulus" : attempt.status_kelulusan === "failed" ? "tidak_lulus" : "sedang_mengambil";
  const previous = await db.RiwayatMetodologiPenelitian.findOne({ where: { mahasiswa_id: attempt.mahasiswa_id }, order: [["effective_at", "DESC"]], transaction });
  if (["tidak_lulus", "mengulang"].includes(previous?.status) && ["enrolled", "planned"].includes(attempt.status_registrasi)) methodologyStatus = "mengulang";
  if (previous?.is_active) await previous.update({ is_active: false, superseded_at: attempt.effective_at }, { transaction });
  await db.RiwayatMetodologiPenelitian.create({ mahasiswa_id: attempt.mahasiswa_id, periode_akademik_id: attempt.periode_akademik_id,
    attempt_id: attempt.id, source_id: batch.source_id, import_row_id: row.id, status: methodologyStatus,
    nilai_huruf: attempt.nilai_huruf, nilai_angka: attempt.nilai_angka, effective_at: attempt.effective_at,
    academic_effective_at: attempt.academic_effective_at, recorded_at: attempt.recorded_at,
    version: Number(previous?.version || 0) + 1, previous_version_id: previous?.id || null, evidence_type: "course_attempt",
    metadata: { course_id: course.id, batch_id: batch.id } }, { transaction });
}

function latestAttemptVersions(rows) {
  const selected = new Map();
  rows.forEach((row) => {
    const key = row.external_record_id
      ? `external:${row.source_id}:${row.external_record_id}`
      : `natural:${row.source_id}:${row.mahasiswa_id}:${row.mata_kuliah_id}:${row.periode_akademik_id}:${row.kelas_normalized}:${row.attempt_ke}`;
    const current = selected.get(key);
    if (!current || Number(row.version) > Number(current.version)) selected.set(key, row);
  });
  return [...selected.values()];
}

async function calculateSnapshotInTransaction(mahasiswaId, { transaction, periodId = null }) {
  const mahasiswa = await db.Mahasiswa.findByPk(mahasiswaId, { attributes: ["id", "angkatan"], transaction, lock: transaction.LOCK.UPDATE });
  if (!mahasiswa) throw new AcademicDataError("Mahasiswa tidak ditemukan.", 404, "ACADEMIC_STUDENT_NOT_FOUND");
  const period = periodId ? await db.PeriodeAkademik.findByPk(periodId, { transaction }) : null;
  if (periodId && !period) throw new AcademicDataError("Periode akademik snapshot tidak ditemukan.", 404, "ACADEMIC_PERIOD_NOT_FOUND");
  if (periodId && !period.tanggal_selesai) throw new AcademicDataError("Tanggal selesai periode akademik wajib tersedia untuk snapshot historis.", 409, "ACADEMIC_PERIOD_END_DATE_REQUIRED");
  const cutoff = periodId ? new Date(period.tanggal_selesai) : new Date();
  const activePeriods = periodId ? [] : await db.PeriodeAkademik.findAll({ where: { status: "active" },
    order: [["tanggal_mulai", "DESC"], ["createdAt", "DESC"]], transaction });
  const periodsCoveringCutoff = activePeriods.filter((item) => item.tanggal_mulai && item.tanggal_selesai
    && new Date(item.tanggal_mulai) <= cutoff && new Date(item.tanggal_selesai) >= cutoff);
  const currentTargetPeriod = periodId ? null
    : periodsCoveringCutoff.length === 1 ? periodsCoveringCutoff[0]
      : activePeriods.length === 1 ? activePeriods[0] : null;
  const attemptVersions = await db.PercobaanMataKuliahMahasiswa.findAll({ where: { mahasiswa_id: mahasiswaId,
    academic_effective_at: { [Op.lte]: cutoff } }, order: [["periode_akademik_id", "ASC"], ["attempt_ke", "ASC"], ["version", "DESC"]], transaction });
  const attempts = latestAttemptVersions(attemptVersions);
  const curriculumAssignments = await db.MahasiswaKurikulum.findAll({ where: { mahasiswa_id: mahasiswaId }, transaction });
  const curriculumPeriodIds = curriculumAssignments.map((item) => item.periode_mulai_id).filter(Boolean);
  const curriculumPeriods = curriculumPeriodIds.length ? await db.PeriodeAkademik.findAll({ where: { id: { [Op.in]: curriculumPeriodIds } }, transaction }) : [];
  const curriculumPeriodMap = new Map(curriculumPeriods.map((item) => [Number(item.id), item]));
  const assignment = (periodId ? curriculumAssignments.filter((item) => {
    const starts = curriculumPeriodMap.get(Number(item.periode_mulai_id))?.tanggal_mulai;
    return starts ? new Date(starts) <= cutoff : item.is_active;
  }) : curriculumAssignments.filter((item) => item.is_active))
    .sort((a, b) => new Date(curriculumPeriodMap.get(Number(b.periode_mulai_id))?.tanggal_mulai || 0) - new Date(curriculumPeriodMap.get(Number(a.periode_mulai_id))?.tanggal_mulai || 0))[0] || null;
  const curriculum = assignment ? await db.Kurikulum.findByPk(assignment.kurikulum_id, { transaction }) : null;
  const requirements = assignment ? await db.KurikulumMataKuliah.findAll({ where: { kurikulum_id: assignment.kurikulum_id, is_active: true }, transaction }) : [];
  const methodology = await db.RiwayatMetodologiPenelitian.findOne({ where: { mahasiswa_id: mahasiswaId,
    academic_effective_at: { [Op.lte]: cutoff } }, order: [["academic_effective_at", "DESC"], ["version", "DESC"]], transaction });
  const attemptIds = attempts.map((v) => v.id);
  const conflicts = await db.KonflikDataAkademik.count({ where: { status: "open",
    [Op.or]: [{ entity_type: "student", left_record_id: mahasiswaId },
      { entity_type: "course_attempt", left_record_id: { [Op.in]: attemptIds.length ? attemptIds : [0] } }] }, transaction });
  const completenessCandidates = await db.CakupanDatasetAkademik.findAll({ where: { is_active: true,
    [Op.or]: [{ mahasiswa_id: mahasiswaId }, { mahasiswa_id: null }] }, transaction });
  const coveragePeriodIds = [...new Set(completenessCandidates.map((item) => item.periode_akademik_id).filter(Boolean))];
  const coveragePeriods = coveragePeriodIds.length ? await db.PeriodeAkademik.findAll({ where: { id: { [Op.in]: coveragePeriodIds } }, transaction }) : [];
  const coveragePeriodMap = new Map(coveragePeriods.map((item) => [Number(item.id), item]));
  const completeness = completenessCandidates.filter((item) => {
    const coveragePeriod = coveragePeriodMap.get(Number(item.periode_akademik_id));
    const coverageEnd = coveragePeriod?.tanggal_selesai;
    const programMatches = (!item.kode_program_studi || item.kode_program_studi === curriculum?.kode_program_studi)
      && (!item.program_kuliah || item.program_kuliah === curriculum?.program_kuliah);
    const scopeType = String(item.scope_type || "").toLowerCase();
    const declaredCohort = String(item.metadata?.cohort || item.metadata?.angkatan || "").trim();
    const scopeMatches = scopeType === "student" ? Number(item.mahasiswa_id) === Number(mahasiswaId)
        : scopeType === "program" ? programMatches
          : scopeType === "cohort" ? Boolean(mahasiswa.angkatan && declaredCohort
            && String(mahasiswa.angkatan) === declaredCohort && programMatches) : false;
    return scopeMatches && programMatches && (!coverageEnd || new Date(coverageEnd) <= cutoff);
  });
  const passed = attempts.filter((v) => v.status_kelulusan === "passed" && policy.isCreditRecognized(v.credit_origin, v.recognition_status));
  const passedCourseIds = new Set(passed.map((v) => Number(v.mata_kuliah_id)));
  const equivalenceCandidates = await db.EkuivalensiMataKuliah.findAll({ where: { is_active: true,
    [Op.or]: [{ kurikulum_id: assignment?.kurikulum_id || null }, { kurikulum_id: null }] }, transaction });
  const boundaryIds = [...new Set(equivalenceCandidates.flatMap((item) => [item.berlaku_mulai_id, item.berlaku_selesai_id]).filter(Boolean))];
  const boundaries = boundaryIds.length ? await db.PeriodeAkademik.findAll({ where: { id: { [Op.in]: boundaryIds } }, transaction }) : [];
  const boundaryMap = new Map(boundaries.map((item) => [Number(item.id), item]));
  const equivalences = equivalenceCandidates.filter((item) => {
    const start = boundaryMap.get(Number(item.berlaku_mulai_id))?.tanggal_mulai;
    const end = boundaryMap.get(Number(item.berlaku_selesai_id))?.tanggal_selesai;
    return (!start || new Date(start) <= cutoff) && (!end || new Date(end) >= cutoff);
  });
  const groupsByCourse = new Map();
  const substitutionTargets = new Map();
  const addGroup = (courseId, groupId) => { if (!courseId) return; if (!groupsByCourse.has(courseId)) groupsByCourse.set(courseId, new Set()); groupsByCourse.get(courseId).add(groupId); };
  const addSubstitution = (sourceId, targetId) => { if (!sourceId || !targetId) return; if (!substitutionTargets.has(sourceId)) substitutionTargets.set(sourceId, new Set()); substitutionTargets.get(sourceId).add(targetId); };
  const legacyGroups = new Map();
  equivalences.forEach((item) => {
    const groupId = Number(item.kelompok_id);
    const sourceId = Number(item.mata_kuliah_sumber_id || 0);
    const targetId = Number(item.mata_kuliah_tujuan_id || 0);
    if (sourceId && targetId) {
      addGroup(sourceId, groupId); addGroup(targetId, groupId); addSubstitution(sourceId, targetId);
      if (item.arah === "bidirectional") addSubstitution(targetId, sourceId);
    } else if (item.arah === "bidirectional" && item.mata_kuliah_id) {
      if (!legacyGroups.has(groupId)) legacyGroups.set(groupId, []); legacyGroups.get(groupId).push(Number(item.mata_kuliah_id));
      addGroup(Number(item.mata_kuliah_id), groupId);
    }
  });
  legacyGroups.forEach((courseIds) => courseIds.forEach((sourceId) => courseIds.forEach((targetId) => { if (sourceId !== targetId) addSubstitution(sourceId, targetId); })));
  const requirementMet = (courseId) => passedCourseIds.has(Number(courseId))
    || [...passedCourseIds].some((sourceId) => substitutionTargets.get(sourceId)?.has(Number(courseId)));
  const missing = requirements.filter((v) => v.sifat === "wajib" && !requirementMet(v.mata_kuliah_id)).map((v) => v.mata_kuliah_id);
  const creditedUnits = new Map();
  passed.forEach((attempt) => {
    const groups = [...(groupsByCourse.get(Number(attempt.mata_kuliah_id)) || [])];
    const key = groups.length ? `group:${groups.sort((a, b) => a - b)[0]}` : `course:${attempt.mata_kuliah_id}`;
    creditedUnits.set(key, Math.max(Number(creditedUnits.get(key) || 0), Number(attempt.sks_lulus || 0)));
  });
  const quality = [];
  let dataState = "available";
  const completenessGroups = new Map();
  completeness.forEach((item) => {
    const declaredCohort = item.scope_type === "cohort" ? String(item.metadata?.cohort || item.metadata?.angkatan || "") : "";
    const key = [item.source_id, item.dataset_type, item.periode_akademik_id, item.scope_type, item.mahasiswa_id || 0,
      item.kode_program_studi || "", item.program_kuliah || "", declaredCohort].join("|");
    if (!completenessGroups.has(key)) completenessGroups.set(key, []); completenessGroups.get(key).push(item);
  });
  const completenessConflict = [...completenessGroups.values()].some((items) => items.length > 1 && new Set(items.map((v) => `${v.is_complete}:${v.checksum}`)).size > 1);
  const requiredCoveragePeriodIds = periodId ? [Number(periodId)]
    : currentTargetPeriod ? [Number(currentTargetPeriod.id)] : [];
  const completeCourseCoverage = completeness.filter((item) => item.dataset_type === "course_attempts" && item.is_complete === true);
  const coveredPeriodIds = new Set(completeCourseCoverage.map((item) => Number(item.periode_akademik_id)));
  const hasCompleteCoverage = requiredCoveragePeriodIds.length > 0 && completeCourseCoverage.length > 0
    && requiredCoveragePeriodIds.every((requiredPeriodId) => coveredPeriodIds.has(requiredPeriodId));
  if (conflicts > 0 || completenessConflict) { dataState = "conflicted"; quality.push("ACADEMIC_DATA_CONFLICTED"); }
  else if (!periodId && !currentTargetPeriod) { dataState = "incomplete"; quality.push("ACADEMIC_ACTIVE_PERIOD_UNDETERMINED"); }
  else if (!attempts.length && !methodology && !completeness.length) { dataState = "unavailable"; quality.push("ACADEMIC_DATA_UNAVAILABLE"); }
  else if (!assignment) { dataState = "incomplete"; quality.push("ACADEMIC_CURRICULUM_UNASSIGNED"); }
  else if (!hasCompleteCoverage) { dataState = "incomplete"; quality.push("ACADEMIC_COVERAGE_INCOMPLETE"); }
  const facts = { cutoff: periodId ? cutoff.toISOString() : "current", period_id: periodId || null,
    target_period_id: periodId || currentTargetPeriod?.id || null,
    attempts: attempts.map((v) => plain(v)), curriculum_id: assignment?.kurikulum_id || null,
    requirements: requirements.map(plain), equivalences: equivalences.map(plain), methodology: plain(methodology), completeness: completeness.map(plain) };
  const inputChecksum = checksum(facts);
  const snapshotScope = periodId ? "period_end" : "current";
  const existingWhere = periodId
    ? { mahasiswa_id: mahasiswaId, periode_akademik_id: periodId, calculation_version: CALCULATION_VERSION, snapshot_scope: "period_end" }
    : { mahasiswa_id: mahasiswaId, snapshot_scope: "current", is_current: true };
  const existing = await db.SnapshotAkademikMahasiswa.findOne({ where: existingWhere, transaction, lock: transaction.LOCK.UPDATE });
  if (existing?.input_checksum === inputChecksum && existing.calculation_status === "ready") return { snapshot: existing, noop: true };
  if (existing && snapshotScope === "current") await existing.update({ is_current: false, calculation_status: "stale" }, { transaction });
  const snapshotValues = { mahasiswa_id: mahasiswaId, kurikulum_id: assignment?.kurikulum_id || null,
    periode_akademik_id: periodId || null, cutoff_at: cutoff, snapshot_scope: snapshotScope,
    total_sks_diambil: attempts.filter((v) => !["withdrawn", "cancelled"].includes(v.status_registrasi)).reduce((sum, v) => sum + Number(v.sks_diambil || 0), 0),
    total_sks_lulus: [...creditedUnits.values()].reduce((sum, value) => sum + value, 0), wajib_total: requirements.filter((v) => v.sifat === "wajib").length,
    wajib_lulus: requirements.filter((v) => v.sifat === "wajib").length - missing.length, wajib_belum_lulus: missing,
    metodologi_status: methodology?.status || null, data_state: dataState, quality_issues: quality,
    source_revisions: [...new Set(attempts.map((v) => v.external_revision).filter(Boolean))], calculation_version: CALCULATION_VERSION,
    calculation_status: "ready", input_checksum: inputChecksum, calculated_at: new Date(), is_current: snapshotScope === "current",
  };
  const snapshot = existing && snapshotScope === "period_end"
    ? await existing.update(snapshotValues, { transaction })
    : await db.SnapshotAkademikMahasiswa.create(snapshotValues, { transaction });
  return { snapshot, noop: false };
}

async function calculateSnapshot(mahasiswaId, { transaction = null, periodId = null } = {}) {
  if (transaction) return calculateSnapshotInTransaction(mahasiswaId, { transaction, periodId });
  try {
    return await db.sequelize.transaction((ownedTransaction) => calculateSnapshotInTransaction(mahasiswaId, { transaction: ownedTransaction, periodId }));
  } catch (error) {
    if (error instanceof db.Sequelize.UniqueConstraintError) {
      const snapshot = await db.SnapshotAkademikMahasiswa.findOne({ where: periodId
        ? { mahasiswa_id: mahasiswaId, periode_akademik_id: periodId, calculation_version: CALCULATION_VERSION, snapshot_scope: "period_end" }
        : { mahasiswa_id: mahasiswaId, snapshot_scope: "current", is_current: true } });
      if (snapshot) return { snapshot, noop: true, replayed: true };
    }
    throw error;
  }
}

async function evaluateEligibility({ mahasiswaId, context, referenceType = null, referenceId = null, persist = false, transaction = null, correlationId = null }) {
  let snapshot = await db.SnapshotAkademikMahasiswa.findOne({ where: { mahasiswa_id: mahasiswaId, snapshot_scope: "current", is_current: true }, transaction });
  const rule = await db.RuleSetAkademik.findOne({ where: { context, status: "active" }, order: [["version", "DESC"]], transaction });
  if (!snapshot || snapshot.calculation_status !== "ready") {
    const [attemptCount, methodologyCount, curriculumCount, coverageCount] = await Promise.all([
      db.PercobaanMataKuliahMahasiswa.count({ where: { mahasiswa_id: mahasiswaId, is_active: true }, transaction }),
      db.RiwayatMetodologiPenelitian.count({ where: { mahasiswa_id: mahasiswaId, is_active: true }, transaction }),
      db.MahasiswaKurikulum.count({ where: { mahasiswa_id: mahasiswaId, is_active: true }, transaction }),
      db.CakupanDatasetAkademik.count({ where: { is_active: true, [Op.or]: [{ mahasiswa_id: mahasiswaId }, { mahasiswa_id: null }] }, transaction }),
    ]);
    snapshot = attemptCount || methodologyCount || curriculumCount || coverageCount
      ? (await calculateSnapshot(mahasiswaId, { transaction })).snapshot
      : { id: null, total_sks_lulus: 0, wajib_belum_lulus: [], metodologi_status: null, data_state: "unavailable", calculation_status: "ready" };
  }
  const configuredMode = rule?.mode || "informational";
  const mode = configuredMode === "enforced" ? "shadow" : configuredMode;
  const reasons = [];
  if (snapshot.data_state === "unavailable") reasons.push("ACADEMIC_DATA_UNAVAILABLE");
  if (snapshot.data_state === "incomplete") reasons.push("ACADEMIC_DATA_INCOMPLETE");
  if (snapshot.data_state === "conflicted") reasons.push("ACADEMIC_DATA_CONFLICTED");
  const config = rule?.configuration || {};
  if (config.require_methodology_passed && snapshot.metodologi_status !== "lulus") reasons.push(snapshot.metodologi_status === "sedang_mengambil" ? "METHODOLOGY_IN_PROGRESS" : snapshot.metodologi_status ? "METHODOLOGY_NOT_PASSED" : "METHODOLOGY_NOT_TAKEN");
  if (config.minimum_credits != null && Number(snapshot.total_sks_lulus) < Number(config.minimum_credits)) reasons.push("MINIMUM_CREDITS_NOT_MET");
  if (config.require_all_mandatory && snapshot.wajib_belum_lulus.length) reasons.push("REQUIRED_COURSES_INCOMPLETE");
  let evaluatedResult = reasons.some((v) => v.startsWith("ACADEMIC_DATA_")) ? "undetermined" : reasons.length ? "blocked" : "eligible";
  if (!rule && evaluatedResult === "eligible") reasons.push("RULE_NOT_ENFORCED");
  if (configuredMode === "enforced") reasons.push("ACADEMIC_ENFORCEMENT_NOT_READY");
  if (!reasons.length) reasons.push("ELIGIBLE");
  const effectiveDecision = policy.mapEffectiveDecision(mode, evaluatedResult, rule?.undetermined_policy);
  const result = { context, snapshot_id: snapshot.id, rule_set_id: rule?.id || null, rule_version: rule?.version || null,
    mode, evaluated_result: evaluatedResult, effective_decision: effectiveDecision, reason_codes: reasons,
    input_facts: { total_sks_lulus: Number(snapshot.total_sks_lulus), wajib_belum_lulus: snapshot.wajib_belum_lulus,
      metodologi_status: snapshot.metodologi_status, data_state: snapshot.data_state, calculation_status: snapshot.calculation_status },
    correlation_id: correlationId || crypto.randomUUID(), evaluated_at: new Date() };
  if (persist && (snapshot.id || rule)) result.id = (await db.EvaluasiEligibilityAkademik.create({ ...result, mahasiswa_id: mahasiswaId, reference_type: referenceType, reference_id: referenceId }, { transaction })).id;
  return result;
}

async function getStudentAcademicDetail(mahasiswaId) {
  const mahasiswa = await db.Mahasiswa.findByPk(mahasiswaId, { attributes: ["id", "nim", "nama", "angkatan"] });
  if (!mahasiswa) throw new AcademicDataError("Mahasiswa tidak ditemukan.", 404, "ACADEMIC_STUDENT_NOT_FOUND");
  const [storedSnapshot, attempts, methodology, curriculum, evaluations] = await Promise.all([
    db.SnapshotAkademikMahasiswa.findOne({ where: { mahasiswa_id: mahasiswaId, snapshot_scope: "current", is_current: true } }),
    db.PercobaanMataKuliahMahasiswa.findAll({ where: { mahasiswa_id: mahasiswaId, is_active: true }, order: [["periode_akademik_id", "DESC"]] }),
    db.RiwayatMetodologiPenelitian.findAll({ where: { mahasiswa_id: mahasiswaId }, order: [["effective_at", "DESC"]] }),
    db.MahasiswaKurikulum.findOne({ where: { mahasiswa_id: mahasiswaId, is_active: true } }),
    db.EvaluasiEligibilityAkademik.findAll({ where: { mahasiswa_id: mahasiswaId }, order: [["evaluated_at", "DESC"]], limit: 20 }),
  ]);
  let snapshot = storedSnapshot;
  const needsRefresh = !snapshot || snapshot.calculation_status !== "ready";
  if (needsRefresh) {
    await db.sequelize.transaction((transaction) => queueSnapshot(mahasiswaId, "academic-detail-read", transaction));
    snapshot = snapshot ? { ...plain(snapshot), calculation_status: "refreshing" }
      : { id: null, mahasiswa_id: mahasiswaId, snapshot_scope: "current", calculation_status: "refreshing", data_state: "unavailable",
        quality_issues: ["ACADEMIC_SNAPSHOT_REFRESH_QUEUED"] };
  }
  return { mahasiswa: plain(mahasiswa), snapshot: plain(snapshot), refreshing: needsRefresh, attempts: attempts.map(plain),
    methodology_history: methodology.map(plain), curriculum_assignment: plain(curriculum), evaluations: evaluations.map(plain) };
}

const CORRECTABLE = {
  course_attempt: {
    model: () => db.PercobaanMataKuliahMahasiswa,
    fields: ["sks_diambil", "sks_lulus", "nilai_huruf", "nilai_angka", "status_registrasi", "status_kelulusan", "credit_origin", "recognition_status"],
  },
  methodology_history: {
    model: () => db.RiwayatMetodologiPenelitian,
    fields: ["status", "nilai_huruf", "nilai_angka"],
  },
};

function methodologyStatusFromAttempt(attempt, previousStatus = null) {
  if (attempt.status_registrasi === "completed") return attempt.status_kelulusan === "passed" ? "lulus" : attempt.status_kelulusan === "failed" ? "tidak_lulus" : "sedang_mengambil";
  if (["planned", "enrolled"].includes(attempt.status_registrasi) && ["tidak_lulus", "mengulang"].includes(previousStatus)) return "mengulang";
  return "sedang_mengambil";
}

function validateCorrection(type, before, changes) {
  const merged = { ...before, ...changes };
  const errors = [];
  if (type === "course_attempt") {
    errors.push(...policy.validateAttempt({ ...merged, sks: merged.sks_diambil }).errors);
    const sksLulus = policy.parseNullableNumber(merged.sks_lulus);
    if (!Number.isFinite(sksLulus) || sksLulus < 0 || sksLulus > Number(merged.sks_diambil)) errors.push("ACADEMIC_PASSED_CREDITS_INVALID");
    const grade = policy.parseNullableNumber(merged.nilai_angka);
    if (grade !== null && (!Number.isFinite(grade) || grade < 0 || grade > 100)) errors.push("ACADEMIC_NUMERIC_GRADE_OUT_OF_RANGE");
  } else {
    if (!policy.validateMethodologyStatus(merged.status).valid) errors.push("ACADEMIC_METHODOLOGY_STATUS_INVALID");
    const grade = policy.parseNullableNumber(merged.nilai_angka);
    if (grade !== null && (!Number.isFinite(grade) || grade < 0 || grade > 100)) errors.push("ACADEMIC_NUMERIC_GRADE_OUT_OF_RANGE");
  }
  if (errors.length) throw new AcademicDataError("Nilai koreksi akademik tidak valid.", 400, "ACADEMIC_CORRECTION_INVALID", [...new Set(errors)]);
}

async function correctAcademicRecord(type, recordId, { actorId, reason, expectedRevision, changes, evidenceReference = null, transaction: externalTransaction = null }) {
  const spec = CORRECTABLE[type];
  if (!spec) throw new AcademicDataError("Jenis record tidak dapat dikoreksi.", 400, "ACADEMIC_CORRECTION_TYPE_INVALID");
  if (!String(reason || "").trim()) throw new AcademicDataError("Alasan koreksi wajib diisi.", 400, "ACADEMIC_CORRECTION_REASON_REQUIRED");
  const run = async (transaction) => {
    const model = spec.model();
    const current = await model.findByPk(recordId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!current || !current.is_active) throw new AcademicDataError("Record aktif tidak ditemukan.", 404, "ACADEMIC_RECORD_NOT_FOUND");
    if (Number(current.version) !== Number(expectedRevision)) throw new AcademicDataError("Record telah berubah. Muat ulang data terbaru.", 409, "ACADEMIC_RECORD_STALE_REVISION");
    const activeCorrection = await db.KoreksiDataAkademik.findOne({ where: { target_entity: type, replacement_record_id: current.id, status: "active" }, transaction });
    const before = plain(current);
    const sanitized = {};
    spec.fields.forEach((field) => { if (Object.prototype.hasOwnProperty.call(changes || {}, field)) sanitized[field] = changes[field]; });
    if (!Object.keys(sanitized).length) throw new AcademicDataError("Tidak ada field koreksi yang valid.", 400, "ACADEMIC_CORRECTION_EMPTY");
    validateCorrection(type, before, sanitized);
    const correctionEffectiveAt = new Date();
    const clone = { ...before, ...sanitized, id: undefined, createdAt: undefined, updatedAt: undefined,
      version: Number(current.version) + 1, previous_version_id: current.id, is_active: true, superseded_at: null,
      effective_at: correctionEffectiveAt, academic_effective_at: current.academic_effective_at || current.effective_at,
      recorded_at: correctionEffectiveAt,
      metadata: { ...(before.metadata || {}), correction: true } };
    delete clone.id; delete clone.createdAt; delete clone.updatedAt;
    await current.update({ is_active: false, superseded_at: correctionEffectiveAt }, { transaction });
    const replacement = await model.create(clone, { transaction });
    let methodologyLineage = {};
    if (type === "course_attempt") {
      const course = await db.MataKuliah.findByPk(current.mata_kuliah_id, { transaction });
      if (course?.role_akademik === "methodology") {
        const currentHistory = await db.RiwayatMetodologiPenelitian.findOne({ where: { mahasiswa_id: current.mahasiswa_id, is_active: true }, transaction, lock: transaction.LOCK.UPDATE });
        const nextStatus = methodologyStatusFromAttempt(replacement, currentHistory?.status);
        const historyEffectiveAt = new Date();
        if (currentHistory) await currentHistory.update({ is_active: false, superseded_at: historyEffectiveAt }, { transaction });
        const generatedHistory = await db.RiwayatMetodologiPenelitian.create({ mahasiswa_id: current.mahasiswa_id, periode_akademik_id: current.periode_akademik_id,
          attempt_id: replacement.id, source_id: current.source_id, import_row_id: current.import_row_id, status: nextStatus,
          nilai_huruf: replacement.nilai_huruf, nilai_angka: replacement.nilai_angka, effective_at: historyEffectiveAt,
          academic_effective_at: replacement.academic_effective_at, recorded_at: historyEffectiveAt,
          version: Number(currentHistory?.version || 0) + 1, previous_version_id: currentHistory?.id || null,
          evidence_type: "admin_correction", metadata: { corrected_attempt_id: replacement.id } }, { transaction });
        methodologyLineage = { methodology_history_id: generatedHistory.id, previous_methodology_history_id: currentHistory?.id || null };
      }
    }
    if (activeCorrection) await activeCorrection.update({ status: "superseded" }, { transaction });
    const correction = await db.KoreksiDataAkademik.create({ target_entity: type, target_record_id: current.id,
      replacement_record_id: replacement.id, previous_correction_id: activeCorrection?.id || null,
      before_values: spec.fields.reduce((a, f) => ({ ...a, [f]: before[f] }), {}), after_values: { ...sanitized, ...methodologyLineage },
      reason: String(reason).trim(), evidence_reference: evidenceReference, expected_revision: Number(expectedRevision), actor_id: actorId,
    }, { transaction });
    await queueSnapshot(current.mahasiswa_id, `correction:${correction.id}`, transaction);
    await db.OutboxAkademik.create({ event_type: "academic.correction.created", aggregate_type: type,
      aggregate_id: replacement.id, deduplication_key: `correction:${correction.id}:created`, payload: { mahasiswa_id: current.mahasiswa_id },
      status: "pending", available_at: new Date() }, { transaction });
    return { correction: plain(correction), record: plain(replacement) };
  };
  return externalTransaction ? run(externalTransaction) : db.sequelize.transaction(run);
}

async function revokeAcademicCorrection(correctionId, { actorId, reason }) {
  if (!String(reason || "").trim()) throw new AcademicDataError("Alasan revoke wajib diisi.", 400, "ACADEMIC_CORRECTION_REASON_REQUIRED");
  return db.sequelize.transaction(async (transaction) => {
    const correction = await db.KoreksiDataAkademik.findByPk(correctionId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!correction || correction.status !== "active") throw new AcademicDataError("Koreksi aktif tidak ditemukan.", 404, "ACADEMIC_CORRECTION_NOT_FOUND");
    const spec = CORRECTABLE[correction.target_entity];
    const model = spec.model();
    const replacement = await model.findByPk(correction.replacement_record_id, { transaction, lock: transaction.LOCK.UPDATE });
    const original = await model.findByPk(correction.target_record_id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!replacement?.is_active || !original) throw new AcademicDataError("Lineage koreksi tidak lagi aktif.", 409, "ACADEMIC_RECORD_STALE_REVISION");
    const revokedAt = new Date();
    await replacement.update({ is_active: false, superseded_at: revokedAt }, { transaction });
    const originalPlain = plain(original);
    const restoredPayload = { ...originalPlain, id: undefined, createdAt: undefined, updatedAt: undefined,
      effective_at: revokedAt, version: Number(replacement.version || 0) + 1, previous_version_id: replacement.id,
      academic_effective_at: original.academic_effective_at || original.effective_at, recorded_at: revokedAt,
      is_active: true, superseded_at: null, metadata: { ...(originalPlain.metadata || {}), correction_revoke: correction.id } };
    delete restoredPayload.id; delete restoredPayload.createdAt; delete restoredPayload.updatedAt;
    const restoredRecord = await model.create(restoredPayload, { transaction });
    if (correction.target_entity === "course_attempt") {
      const generatedHistoryId = correction.after_values?.methodology_history_id;
      const generatedHistory = generatedHistoryId ? await db.RiwayatMetodologiPenelitian.findByPk(generatedHistoryId, { transaction, lock: transaction.LOCK.UPDATE }) : null;
      if (generatedHistory?.is_active) await generatedHistory.update({ is_active: false, superseded_at: revokedAt }, { transaction });
      const course = await db.MataKuliah.findByPk(original.mata_kuliah_id, { transaction });
      if (course?.role_akademik === "methodology") await db.RiwayatMetodologiPenelitian.create({
        mahasiswa_id: original.mahasiswa_id, periode_akademik_id: original.periode_akademik_id, attempt_id: restoredRecord.id,
        source_id: original.source_id, import_row_id: original.import_row_id, status: methodologyStatusFromAttempt(restoredRecord),
        nilai_huruf: restoredRecord.nilai_huruf, nilai_angka: restoredRecord.nilai_angka, effective_at: revokedAt,
        academic_effective_at: restoredRecord.academic_effective_at, recorded_at: revokedAt,
        version: Number(generatedHistory?.version || 0) + 1, previous_version_id: generatedHistory?.id || null,
        evidence_type: "correction_revoke", metadata: { revoked_correction_id: correction.id },
      }, { transaction });
    }
    await correction.update({ status: "revoked", revoked_at: new Date(), revoked_by: actorId,
      after_values: { ...(correction.after_values || {}), revoke_reason: String(reason).trim() } }, { transaction });
    await queueSnapshot(original.mahasiswa_id, `correction-revoked:${correction.id}`, transaction);
    return { correction: plain(correction), restored_record: plain(restoredRecord) };
  });
}

module.exports = { AcademicDataError, CALCULATION_VERSION, checksum, validateRows, createImportPreview, createImportPreviewTransactional, ingestAcademicDataset, commitImport,
  calculateSnapshot, evaluateEligibility, getStudentAcademicDetail, queueSnapshot,
  correctAcademicRecord, revokeAcademicCorrection, revalidateImportBatch, resolveAcademicConflict };
