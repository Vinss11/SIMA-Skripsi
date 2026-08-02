"use strict";

const fs = require("fs");
const crypto = require("crypto");
const XLSX = require("xlsx");
const { Op } = require("sequelize");
const db = require("../models");
const policy = require("../services/academicPolicy");
const academic = require("../services/academicDataService");

function sendError(res, error) {
  const status = error.status || 500;
  if (status >= 500) console.error("Academic API error:", error);
  return res.status(status).json({ success: false, message: error.message || "Terjadi kesalahan pada layanan akademik.", code: error.code || "ACADEMIC_INTERNAL_ERROR", detail: error.detail || null });
}

function normalizePeriodBody(body) {
  const parsed = policy.parseAcademicPeriodCode(body.kode);
  if (!parsed) throw new academic.AcademicDataError("Kode periode harus berformat YYYY-YYYY-GANJIL/GENAP dengan rentang satu tahun.", 400, "ACADEMIC_PERIOD_CODE_INVALID");
  if (body.tahun_mulai != null && Number(body.tahun_mulai) !== parsed.tahun_mulai) throw new academic.AcademicDataError("Tahun mulai tidak cocok dengan kode.", 400, "ACADEMIC_PERIOD_YEAR_MISMATCH");
  const start = body.tanggal_mulai ? new Date(body.tanggal_mulai) : null;
  const end = body.tanggal_selesai ? new Date(body.tanggal_selesai) : null;
  const status = String(body.status || "draft").trim().toLowerCase();
  if (!["draft", "active", "closed"].includes(status)) {
    throw new academic.AcademicDataError("Status periode akademik tidak valid.", 400, "ACADEMIC_PERIOD_STATUS_INVALID");
  }
  if ((start && Number.isNaN(start.getTime())) || (end && Number.isNaN(end.getTime())) || (start && end && end < start)) {
    throw new academic.AcademicDataError("Rentang tanggal periode akademik tidak valid.", 400, "ACADEMIC_PERIOD_DATE_RANGE_INVALID");
  }
  if (status === "active" && (!start || !end)) {
    throw new academic.AcademicDataError("Tanggal resmi wajib lengkap sebelum periode diaktifkan.", 400, "ACADEMIC_PERIOD_OFFICIAL_DATES_REQUIRED");
  }
  return { kode: parsed.kode, tahun_mulai: parsed.tahun_mulai, tahun_selesai: parsed.tahun_selesai,
    tahun_akademik: `${parsed.tahun_mulai}/${parsed.tahun_selesai}`, semester: parsed.semester,
    tanggal_mulai: start, tanggal_selesai: end,
    status, sumber: body.sumber || "manual", metadata: body.metadata || {} };
}

const masterConfigs = {
  sources: { model: "SumberDataAkademik", create: ["kode", "nama", "jenis", "kode_program_studi", "authority_level", "is_active", "metadata"] },
  kurikulum: { model: "Kurikulum", create: ["kode", "nama", "kode_program_studi", "program_kuliah", "berlaku_mulai_id", "berlaku_selesai_id", "status", "metadata"] },
  "mata-kuliah": { model: "MataKuliah", create: ["kode", "nama", "sks_default", "kode_program_studi", "program_kuliah", "role_akademik", "status", "metadata"] },
};

function pick(body, fields) { return fields.reduce((acc, key) => { if (Object.prototype.hasOwnProperty.call(body, key)) acc[key] = body[key]; return acc; }, {}); }

async function persistAcademicPeriod({ id = null, payload }) {
  return db.sequelize.transaction(async (transaction) => {
    // A transaction-scoped advisory lock also serializes the empty-table/create
    // case, which row locks alone cannot protect.
    await db.sequelize.query(
      "SELECT pg_advisory_xact_lock(hashtext('stage5-single-active-academic-period'))",
      { transaction },
    );
    await db.PeriodeAkademik.findAll({ attributes: ["id"], transaction, lock: transaction.LOCK.UPDATE });

    let row = null;
    if (id != null) {
      row = await db.PeriodeAkademik.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!row) throw new academic.AcademicDataError("Data master tidak ditemukan.", 404, "ACADEMIC_MASTER_NOT_FOUND");
    }
    if (payload.status === "active") {
      await db.PeriodeAkademik.update({ status: "closed" }, {
        where: { status: "active", ...(row ? { id: { [Op.ne]: row.id } } : {}) },
        transaction,
      });
    }
    if (row) await row.update(payload, { transaction });
    else row = await db.PeriodeAkademik.create(payload, { transaction });

    if (id != null) {
      await db.SnapshotAkademikMahasiswa.update({ calculation_status: "stale" }, { where: {
        calculation_status: "ready",
        [Op.or]: [
          { snapshot_scope: "current", is_current: true },
          { snapshot_scope: "period_end", periode_akademik_id: row.id },
        ],
      }, transaction });
    }
    return row;
  });
}

exports.listMaster = async (req, res) => {
  try {
    if (req.params.resource === "periode") return res.json({ success: true, data: await db.PeriodeAkademik.findAll({ order: [["tahun_mulai", "DESC"], ["semester", "ASC"]] }) });
    const config = masterConfigs[req.params.resource];
    if (!config) throw new academic.AcademicDataError("Master tidak dikenal.", 404, "ACADEMIC_MASTER_NOT_FOUND");
    return res.json({ success: true, data: await db[config.model].findAll({ order: [["updatedAt", "DESC"]] }) });
  } catch (error) { return sendError(res, error); }
};

exports.createMaster = async (req, res) => {
  try {
    if (req.params.resource === "periode") return res.status(201).json({ success: true,
      data: await persistAcademicPeriod({ payload: normalizePeriodBody(req.body || {}) }) });
    const config = masterConfigs[req.params.resource];
    if (!config) throw new academic.AcademicDataError("Master tidak dikenal.", 404, "ACADEMIC_MASTER_NOT_FOUND");
    const payload = pick(req.body || {}, config.create);
    if (payload.kode) payload.kode = policy.normalizeCode(payload.kode);
    return res.status(201).json({ success: true, data: await db[config.model].create(payload) });
  } catch (error) { return sendError(res, error); }
};

exports.updateMaster = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (req.params.resource === "periode") {
      const existing = await db.PeriodeAkademik.findByPk(id);
      if (!existing) throw new academic.AcademicDataError("Data master tidak ditemukan.", 404, "ACADEMIC_MASTER_NOT_FOUND");
      const payload = normalizePeriodBody({ ...existing.toJSON(), ...req.body });
      const row = await persistAcademicPeriod({ id, payload });
      return res.json({ success: true, data: row });
    }
    const model = req.params.resource === "periode" ? db.PeriodeAkademik : db[masterConfigs[req.params.resource]?.model];
    if (!model) throw new academic.AcademicDataError("Master tidak dikenal.", 404, "ACADEMIC_MASTER_NOT_FOUND");
    const row = await model.findByPk(id);
    if (!row) throw new academic.AcademicDataError("Data master tidak ditemukan.", 404, "ACADEMIC_MASTER_NOT_FOUND");
    const payload = pick(req.body || {}, masterConfigs[req.params.resource].create);
    await row.update(payload);
    return res.json({ success: true, data: row });
  } catch (error) { return sendError(res, error); }
};

exports.createAlias = async (req, res) => {
  try {
    const row = await db.MataKuliahAlias.create({ mata_kuliah_id: Number(req.params.id), source_id: req.body.source_id || null,
      kode_alias: policy.normalizeCode(req.body.kode_alias), kode_program_studi: req.body.kode_program_studi || "INFORMATIKA",
      program_kuliah: req.body.program_kuliah || "reguler", is_active: true });
    return res.status(201).json({ success: true, data: row });
  } catch (error) { return sendError(res, error); }
};

exports.createEquivalenceGroup = async (req, res) => {
  try { return res.status(201).json({ success: true, data: await db.KelompokEkuivalensiMataKuliah.create(req.body) }); }
  catch (error) { return sendError(res, error); }
};
exports.upsertEquivalence = async (req, res) => {
  try {
    const direction = req.body.arah || "bidirectional";
    if (direction === "source_to_target" && (!req.body.mata_kuliah_sumber_id || !req.body.mata_kuliah_tujuan_id)) {
      throw new academic.AcademicDataError("Ekuivalensi satu arah wajib memiliki mata kuliah sumber dan tujuan.", 400, "ACADEMIC_EQUIVALENCE_PAIR_REQUIRED");
    }
    const [row, created] = await db.EkuivalensiMataKuliah.upsert({ ...req.body, arah: direction,
      mata_kuliah_id: req.body.mata_kuliah_id || req.body.mata_kuliah_sumber_id,
      id: req.params.id ? Number(req.params.id) : undefined }, { returning: true });
    return res.status(created ? 201 : 200).json({ success: true, data: row });
  } catch (error) { return sendError(res, error); }
};

exports.assignCurriculum = async (req, res) => {
  try {
    const result = await db.sequelize.transaction(async (transaction) => {
      await db.MahasiswaKurikulum.update({ is_active: false }, { where: { mahasiswa_id: Number(req.params.id), is_active: true }, transaction });
      const row = await db.MahasiswaKurikulum.create({ mahasiswa_id: Number(req.params.id), kurikulum_id: Number(req.body.kurikulum_id),
        periode_mulai_id: req.body.periode_mulai_id || null, source_id: req.body.source_id || null, assigned_by: req.user.id,
        metadata: { reason: req.body.reason || null } }, { transaction });
      await academic.queueSnapshot(Number(req.params.id), `curriculum:${row.id}`, transaction);
      return row;
    });
    return res.status(201).json({ success: true, data: result });
  } catch (error) { return sendError(res, error); }
};

const TEMPLATE_HEADERS = {
  course_attempts: ["nim", "kode_periode", "kode_mata_kuliah", "attempt_ke", "kelas", "sks", "nilai_huruf", "nilai_angka", "status_registrasi", "status_kelulusan", "external_record_id", "external_revision", "credit_origin", "recognition_status", "academic_effective_at"],
  methodology_status: ["nim", "kode_periode", "status_metodologi", "nilai_huruf", "nilai_angka", "academic_effective_at"],
};

exports.downloadTemplate = async (req, res) => {
  try {
    const headers = TEMPLATE_HEADERS[req.params.dataset];
    if (!headers) throw new academic.AcademicDataError("Dataset template tidak dikenal.", 404, "ACADEMIC_IMPORT_SCHEMA_INVALID");
    const sheet = XLSX.utils.aoa_to_sheet([headers]);
    const dictionary = XLSX.utils.json_to_sheet(headers.map((field) => ({ field, wajib: !["attempt_ke", "kelas", "nilai_huruf", "nilai_angka", "external_record_id", "external_revision"].includes(field), catatan: "Gunakan nilai sesuai data dictionary Tahap 5" })));
    const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, sheet, "Data"); XLSX.utils.book_append_sheet(workbook, dictionary, "Data Dictionary");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=template_${req.params.dataset}_v1.xlsx`); return res.send(buffer);
  } catch (error) { return sendError(res, error); }
};

function readWorkbookRows(filepath, datasetType) {
  const workbook = XLSX.readFile(filepath, { raw: true, cellFormula: true, cellNF: true, bookVBA: false });
  if (!workbook.SheetNames.includes("Data")) throw new academic.AcademicDataError("Sheet Data tidak ditemukan.", 400, "ACADEMIC_IMPORT_SCHEMA_INVALID");
  const sheet = workbook.Sheets.Data;
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });
  const headers = (matrix[0] || []).map((value) => String(value || "").trim());
  const required = datasetType === "course_attempts"
    ? ["nim", "kode_periode", "kode_mata_kuliah", "sks", "status_registrasi"]
    : ["nim", "kode_periode", "status_metodologi"];
  const missingHeaders = required.filter((field) => !headers.includes(field));
  if (missingHeaders.length) throw new academic.AcademicDataError("Header template tidak lengkap.", 400, "ACADEMIC_IMPORT_SCHEMA_INVALID", { missing_headers: missingHeaders });
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true });
  const formulaRows = new Set();
  Object.entries(sheet).forEach(([address, cell]) => { if (address[0] !== "!" && cell?.f) formulaRows.add(XLSX.utils.decode_cell(address).r + 1); });
  return rows.map((row, index) => {
    const cellTypes = {};
    headers.forEach((header, columnIndex) => {
      const cell = sheet[XLSX.utils.encode_cell({ r: index + 1, c: columnIndex })];
      if (header) cellTypes[header] = { type: cell?.t || "blank", has_formula: Boolean(cell?.f) };
    });
    return { ...row, __sheet_name: "Data", __row_number: index + 2, __has_formula: formulaRows.has(index + 2), __cell_types: cellTypes };
  });
}

function assertWorkbookSignature(bytes, filename) {
  const extension = String(filename || "").toLowerCase().split(".").pop();
  const zip = bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
  const ole = bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
  if ((["xlsx", "ods"].includes(extension) && !zip) || (extension === "xls" && !ole)) {
    throw new academic.AcademicDataError("Signature file tidak sesuai format Excel.", 400, "ACADEMIC_IMPORT_FILE_INVALID");
  }
}

exports.createImport = async (req, res) => {
  let filepath = req.file?.path;
  try {
    if (!req.file) throw new academic.AcademicDataError("File Excel wajib diunggah.", 400, "ACADEMIC_IMPORT_FILE_REQUIRED");
    const datasetType = String(req.body.dataset_type || "").trim();
    if (!TEMPLATE_HEADERS[datasetType]) throw new academic.AcademicDataError("Dataset tidak didukung.", 400, "ACADEMIC_IMPORT_SCHEMA_INVALID");
    const bytes = fs.readFileSync(filepath);
    assertWorkbookSignature(bytes, req.file.originalname);
    const rows = readWorkbookRows(filepath, datasetType);
    if (!rows.length || rows.length > 10000) throw new academic.AcademicDataError("Jumlah baris harus antara 1 dan 10.000.", 400, "ACADEMIC_IMPORT_SIZE_INVALID");
    const sourceId = Number(req.body.source_id);
    if (!await db.SumberDataAkademik.findByPk(sourceId)) throw new academic.AcademicDataError("Sumber data tidak ditemukan.", 400, "ACADEMIC_SOURCE_NOT_FOUND");
    const completenessScope = req.body.completeness_scope ? JSON.parse(req.body.completeness_scope) : {};
    const programKuliah = String(req.body.program_kuliah || completenessScope.program_kuliah || "").trim().toLowerCase();
    if (!["reguler", "internasional"].includes(programKuliah)) throw new academic.AcademicDataError("Program kuliah wajib dipilih.", 400, "ACADEMIC_PROGRAM_TYPE_INVALID");
    const result = await academic.createImportPreviewTransactional({ datasetType, schemaVersion: req.body.schema_version || "v1",
      sourceId, externalRevision: req.body.external_revision || null, defaultPeriodId: Number(req.body.periode_akademik_id) || null,
      programCode: req.body.kode_program_studi || "INFORMATIKA", programKuliah,
      completenessScope: { ...completenessScope, kode_program_studi: completenessScope.kode_program_studi || req.body.kode_program_studi || "INFORMATIKA",
        program_kuliah: programKuliah }, rows, filename: String(req.file.originalname).replace(/[^a-zA-Z0-9._-]/g, "_"), mime: req.file.mimetype,
      fileSize: req.file.size, fileSha256: crypto.createHash("sha256").update(bytes).digest("hex"), actorId: req.user.id,
      idempotencyKey: req.headers["idempotency-key"] || null });
    return res.status(result.replayed ? 200 : 201).json({ success: true, data: result.batch, replayed: result.replayed });
  } catch (error) { return sendError(res, error); }
  finally { if (filepath) fs.promises.unlink(filepath).catch(() => {}); }
};

exports.getImportPreview = async (req, res) => {
  try {
    const batch = await db.ImportAkademikBatch.findByPk(req.params.id, { include: [{ model: db.ImportAkademikRow, as: "rows" }] });
    if (!batch) throw new academic.AcademicDataError("Batch tidak ditemukan.", 404, "ACADEMIC_IMPORT_NOT_FOUND");
    return res.json({ success: true, data: batch });
  } catch (error) { return sendError(res, error); }
};
exports.listImports = async (req, res) => {
  try { return res.json({ success: true, data: await db.ImportAkademikBatch.findAll({ order: [["createdAt", "DESC"]], limit: Math.min(Number(req.query.limit) || 100, 500) }) }); }
  catch (error) { return sendError(res, error); }
};

exports.revalidateImport = async (req, res) => {
  try {
    const result = await academic.revalidateImportBatch(Number(req.params.id));
    return res.json({ success: true, data: result });
  } catch (error) { return sendError(res, error); }
};

exports.cancelImport = async (req, res) => {
  try {
    const batch = await db.ImportAkademikBatch.findByPk(req.params.id);
    if (!batch || !["uploaded", "validated", "invalid", "expired"].includes(batch.status)) throw new academic.AcademicDataError("Batch tidak dapat dibatalkan.", 409, "ACADEMIC_IMPORT_STATE_INVALID");
    await batch.update({ status: "cancelled" }); return res.json({ success: true, data: batch });
  } catch (error) { return sendError(res, error); }
};

exports.commitImport = async (req, res) => {
  try { const result = await academic.commitImport(Number(req.params.id), { actorId: req.user.id, checksum: req.body.validation_checksum, idempotencyKey: req.headers["idempotency-key"] || null }); return res.json({ success: true, data: result.batch, affected_mahasiswa_ids: result.affected || [], replayed: result.replayed }); }
  catch (error) { return sendError(res, error); }
};

exports.downloadImportReport = async (req, res) => {
  try {
    const batch = await db.ImportAkademikBatch.findByPk(req.params.id, { include: [{ model: db.ImportAkademikRow, as: "rows" }] });
    if (!batch) throw new academic.AcademicDataError("Batch tidak ditemukan.", 404, "ACADEMIC_IMPORT_NOT_FOUND");
    const columns = ["row_number", "action", "errors", "warnings", "nim"];
    const lines = [columns.join(","), ...batch.rows.map((row) => columns.map((key) => {
      const value = key === "nim" ? row.normalized_payload?.nim : Array.isArray(row[key]) ? row[key].join("|") : row[key];
      return `"${String(policy.sanitizeSpreadsheetString(value ?? "")).replace(/"/g, '""')}"`;
    }).join(","))];
    res.setHeader("Content-Type", "text/csv; charset=utf-8"); res.setHeader("Content-Disposition", `attachment; filename=academic_import_${batch.id}_report.csv`); return res.send(`\uFEFF${lines.join("\n")}`);
  } catch (error) { return sendError(res, error); }
};

exports.getStudentDetailAdmin = async (req, res) => {
  try {
    const mahasiswaId = Number(req.params.id);
    if (req.user.role !== "admin" && req.user.program_kuliah) {
      const assignment = await db.MahasiswaKurikulum.findOne({ where: { mahasiswa_id: mahasiswaId, is_active: true } });
      const curriculum = assignment ? await db.Kurikulum.findByPk(assignment.kurikulum_id) : null;
      if (curriculum && curriculum.program_kuliah !== req.user.program_kuliah) throw new academic.AcademicDataError("Mahasiswa berada di luar scope program Anda.", 403, "ACADEMIC_OBJECT_ACCESS_DENIED");
    }
    return res.json({ success: true, data: await academic.getStudentAcademicDetail(mahasiswaId) });
  } catch (e) { return sendError(res, e); }
};
exports.getMyAcademic = async (req, res) => { try { return res.json({ success: true, data: await academic.getStudentAcademicDetail(Number(req.user.id)) }); } catch (e) { return sendError(res, e); } };
exports.getMyEligibility = async (req, res) => { try { return res.json({ success: true, data: await academic.evaluateEligibility({ mahasiswaId: Number(req.user.id), context: req.query.context || "reporting" }) }); } catch (e) { return sendError(res, e); } };

exports.createCorrection = async (req, res) => { try { return res.status(201).json({ success: true, data: await academic.correctAcademicRecord(req.params.type, Number(req.params.id), { actorId: req.user.id, reason: req.body.reason, expectedRevision: req.body.expected_revision, changes: req.body.changes, evidenceReference: req.body.evidence_reference }) }); } catch (e) { return sendError(res, e); } };
exports.revokeCorrection = async (req, res) => { try { return res.json({ success: true, data: await academic.revokeAcademicCorrection(Number(req.params.id), { actorId: req.user.id, reason: req.body.reason }) }); } catch (e) { return sendError(res, e); } };
exports.listCorrections = async (req, res) => { try { return res.json({ success: true, data: await db.KoreksiDataAkademik.findAll({ order: [["createdAt", "DESC"]], limit: 200 }) }); } catch (e) { return sendError(res, e); } };

exports.listConflicts = async (req, res) => { try { return res.json({ success: true, data: await db.KonflikDataAkademik.findAll({ where: req.query.status ? { status: req.query.status } : {}, order: [["createdAt", "DESC"]] }) }); } catch (e) { return sendError(res, e); } };
exports.decideConflict = async (req, res) => {
  try {
    const decision = req.body.decision || req.params.action;
    const result = await academic.resolveAcademicConflict(Number(req.params.id), { decision, actorId: req.user.id,
      changes: req.body.changes || null, reason: req.body.reason || null });
    return res.json({ success: true, data: result });
  } catch (e) { return sendError(res, e); }
};

exports.listSnapshotJobs = async (req, res) => { try { return res.json({ success: true, data: await db.PekerjaanSnapshotAkademik.findAll({ order: [["updatedAt", "DESC"]], limit: 200 }) }); } catch (e) { return sendError(res, e); } };
exports.listOutbox = async (req, res) => { try { return res.json({ success: true, data: await db.OutboxAkademik.findAll({ order: [["updatedAt", "DESC"]], limit: 200 }) }); } catch (e) { return sendError(res, e); } };
exports.retryOutbox = async (req, res) => {
  try {
    const row = await db.OutboxAkademik.findByPk(req.params.id); if (!row) throw new academic.AcademicDataError("Outbox tidak ditemukan.", 404, "ACADEMIC_OUTBOX_NOT_FOUND");
    if (row.status === "processed") throw new academic.AcademicDataError("Outbox sudah selesai diproses.", 409, "ACADEMIC_OUTBOX_ALREADY_PROCESSED");
    await row.update({ status: "pending", available_at: new Date(), last_error: null }); return res.json({ success: true, data: row });
  } catch (e) { return sendError(res, e); }
};
exports.retrySnapshotJob = async (req, res) => {
  try {
    const job = await db.PekerjaanSnapshotAkademik.findByPk(req.params.id); if (!job) throw new academic.AcademicDataError("Job tidak ditemukan.", 404, "ACADEMIC_SNAPSHOT_JOB_NOT_FOUND");
    await job.update({ status: "processing", attempt_count: Number(job.attempt_count) + 1, last_error_code: null, last_error_message: null });
    try { const result = await academic.calculateSnapshot(job.mahasiswa_id); await job.update({ status: "completed", completed_at: new Date() }); return res.json({ success: true, data: { job, snapshot: result.snapshot, noop: result.noop } }); }
    catch (error) { await job.update({ status: "failed", last_error_code: error.code || "ACADEMIC_SNAPSHOT_FAILED", last_error_message: String(error.message).slice(0, 500) }); throw error; }
  } catch (e) { return sendError(res, e); }
};
exports.rebuildSnapshots = async (req, res) => {
  try {
    const ids = req.body.mahasiswa_id ? [Number(req.body.mahasiswa_id)] : (await db.Mahasiswa.findAll({ attributes: ["id"] })).map((v) => v.id);
    if (req.body.dry_run !== false) return res.json({ success: true, data: { mode: "dry-run", mahasiswa_ids: ids } });
    const results = []; for (const id of ids) results.push({ mahasiswa_id: id, ...(await academic.calculateSnapshot(id)) });
    return res.json({ success: true, data: { mode: "execute", results } });
  } catch (e) { return sendError(res, e); }
};

exports.listRuleSets = async (req, res) => { try { return res.json({ success: true, data: await db.RuleSetAkademik.findAll({ order: [["context", "ASC"], ["version", "DESC"]] }) }); } catch (e) { return sendError(res, e); } };
exports.createRuleSet = async (req, res) => {
  try {
    if (req.body.mode === "enforced") throw new academic.AcademicDataError("Mode enforced belum dapat diaktifkan sampai seluruh consumer menjadi gate akademik.", 409, "ACADEMIC_RULE_ENFORCEMENT_NOT_READY");
    return res.status(201).json({ success: true, data: await db.RuleSetAkademik.create({ ...req.body, status: "draft" }) });
  } catch (e) { return sendError(res, e); }
};
exports.changeRuleStatus = async (req, res) => {
  try {
    if (!["activate", "retire"].includes(req.params.action)) throw new academic.AcademicDataError("Aksi rule-set tidak valid.", 400, "ACADEMIC_RULE_ACTION_INVALID");
    const row = await db.sequelize.transaction(async (transaction) => {
      const locked = await db.RuleSetAkademik.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!locked) throw new academic.AcademicDataError("Rule-set tidak ditemukan.", 404, "ACADEMIC_RULE_NOT_CONFIGURED");
      if (req.params.action === "activate") {
        if (locked.mode === "enforced") throw new academic.AcademicDataError("Mode enforced belum dapat diaktifkan sampai seluruh consumer menjadi gate akademik.", 409, "ACADEMIC_RULE_ENFORCEMENT_NOT_READY");
        const active = await db.RuleSetAkademik.findAll({ where: { context: locked.context, status: "active", id: { [Op.ne]: locked.id } }, transaction, lock: transaction.LOCK.UPDATE });
        for (const item of active) await item.update({ status: "retired" }, { transaction });
        await locked.update({ status: "active", activated_at: new Date(), activated_by: req.user.id }, { transaction });
      } else await locked.update({ status: "retired" }, { transaction });
      return locked;
    });
    return res.json({ success: true, data: row });
  } catch (e) { return sendError(res, e); }
};

exports.getMonitoring = async (req, res) => {
  try {
    const where = {}; if (req.query.data_state) where.data_state = req.query.data_state;
    if (req.user.program_kuliah) {
      const curricula = await db.Kurikulum.findAll({ where: { program_kuliah: req.user.program_kuliah }, attributes: ["id"] });
      where.kurikulum_id = { [Op.in]: curricula.map((item) => item.id) };
    }
    const snapshots = await db.SnapshotAkademikMahasiswa.findAll({ where: { ...where, snapshot_scope: "current", is_current: true }, order: [["updatedAt", "DESC"]], limit: Math.min(Number(req.query.limit) || 100, 500) });
    const ids = snapshots.map((v) => v.mahasiswa_id); const students = await db.Mahasiswa.findAll({ where: { id: { [Op.in]: ids } }, attributes: ["id", "nim", "nama", "angkatan"] });
    const map = new Map(students.map((v) => [v.id, v])); return res.json({ success: true, data: snapshots.map((v) => ({ ...v.toJSON(), mahasiswa: map.get(v.mahasiswa_id) || null })) });
  } catch (e) { return sendError(res, e); }
};

exports.getFailedOperations = async (req, res) => {
  try { const [batches, jobs, outbox] = await Promise.all([db.ImportAkademikBatch.findAll({ where: { status: "failed" } }), db.PekerjaanSnapshotAkademik.findAll({ where: { status: "failed" } }), db.OutboxAkademik.findAll({ where: { status: "failed" } })]); return res.json({ success: true, data: { batches, snapshot_jobs: jobs, outbox } }); }
  catch (e) { return sendError(res, e); }
};

module.exports.sendError = sendError;
