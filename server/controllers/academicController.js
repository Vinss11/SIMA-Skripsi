"use strict";

const fs = require("fs");
const db = require("../models");
const penjaluranGrades = require("../services/penjaluranGradeService");

function sendError(res, error) {
  const status = error.status || 500;
  if (status >= 500) console.error("Academic API error:", error);
  return res.status(status).json({
    success: false,
    message: error.message || "Terjadi kesalahan pada layanan akademik.",
    code: error.code || "ACADEMIC_INTERNAL_ERROR",
    detail: error.detail || null,
  });
}

function periodId(req) {
  return Number(req.query.periode_pendaftaran_id || req.query.periode_penjaluran_id);
}

function sanitizeSpreadsheetString(value) {
  const text = String(value ?? "");
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

// PeriodeAkademik tetap menjadi context lintas fitur (semester assignment),
// walaupun master akademik generik tidak lagi diekspos sebagai menu.
exports.updateMaster = async (req, res) => {
  try {
    if (req.params.resource !== "periode") throw new penjaluranGrades.PenjaluranGradeError("Master akademik tidak tersedia.", 404, "ACADEMIC_MASTER_NOT_FOUND");
    const row = await db.sequelize.transaction(async (transaction) => {
      const period = await db.PeriodeAkademik.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!period) throw new penjaluranGrades.PenjaluranGradeError("Periode akademik tidak ditemukan.", 404, "ACADEMIC_PERIOD_NOT_FOUND");
      if (req.body.status === "active") await db.PeriodeAkademik.update({ status: "closed" }, { where: { status: "active" }, transaction });
      await period.update({ status: req.body.status || period.status }, { transaction });
      return period;
    });
    return res.json({ success: true, data: row });
  } catch (error) { return sendError(res, error); }
};

exports.listPenjaluranPeriods = async (_req, res) => {
  try { return res.json({ success: true, data: await penjaluranGrades.listPeriods() }); }
  catch (error) { return sendError(res, error); }
};

exports.listPenjaluranGrades = async (req, res) => {
  try {
    const id = periodId(req);
    if (!id) throw new penjaluranGrades.PenjaluranGradeError("Periode pendaftaran penjaluran wajib dipilih.", 400, "GRADE_PERIOD_REQUIRED");
    return res.json({
      success: true,
      data: await penjaluranGrades.registrationRows(id),
      policy: { minimum_passing_grade: penjaluranGrades.gradePolicy.MINIMUM_PASSING_GRADE, allowed_grades: penjaluranGrades.gradePolicy.ALLOWED_GRADES },
    });
  } catch (error) { return sendError(res, error); }
};

exports.listPenjaluranGradesForSecretary = async (req, res) => {
  try {
    const id = periodId(req);
    if (!id) throw new penjaluranGrades.PenjaluranGradeError("Periode pendaftaran penjaluran wajib dipilih.", 400, "GRADE_PERIOD_REQUIRED");
    const rows = await penjaluranGrades.registrationRows(id, { programKuliah: req.user.program_kuliah });
    return res.json({
      success: true,
      data: rows,
      scope: { program_kuliah: req.user.program_kuliah },
      policy: { minimum_passing_grade: penjaluranGrades.gradePolicy.MINIMUM_PASSING_GRADE, allowed_grades: penjaluranGrades.gradePolicy.ALLOWED_GRADES },
    });
  } catch (error) { return sendError(res, error); }
};

exports.downloadPenjaluranGradeTemplate = async (req, res) => {
  try {
    const id = periodId(req);
    if (!id) throw new penjaluranGrades.PenjaluranGradeError("Periode pendaftaran penjaluran wajib dipilih.", 400, "GRADE_PERIOD_REQUIRED");
    const buffer = await penjaluranGrades.buildTemplate(id);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=template_nilai_penjaluran_${id}.xlsx`);
    return res.send(buffer);
  } catch (error) { return sendError(res, error); }
};

exports.previewPenjaluranGradeImport = async (req, res) => {
  const filepath = req.file?.path;
  try {
    if (!req.file) throw new penjaluranGrades.PenjaluranGradeError("File Excel wajib diunggah.", 400, "GRADE_IMPORT_FILE_REQUIRED");
    const result = await penjaluranGrades.createPreview({
      periodePenjaluranId: Number(req.body.periode_pendaftaran_id || req.body.periode_penjaluran_id),
      bytes: fs.readFileSync(filepath),
      actorId: req.user.id,
    });
    return res.status(result.replayed ? 200 : 201).json({ success: true, data: result.import, replayed: result.replayed });
  } catch (error) { return sendError(res, error); }
  finally { if (filepath) fs.promises.unlink(filepath).catch(() => {}); }
};

exports.commitPenjaluranGradeImport = async (req, res) => {
  try {
    const result = await penjaluranGrades.commitImport(Number(req.params.id), req.user.id);
    return res.json({ success: true, data: result.import, replayed: result.replayed });
  } catch (error) { return sendError(res, error); }
};

exports.downloadPenjaluranGradeReport = async (req, res) => {
  try {
    const imported = await db.ImportNilaiPenjaluran.findByPk(req.params.id, { include: [{ model: db.ImportNilaiPenjaluranRow, as: "rows" }] });
    if (!imported) throw new penjaluranGrades.PenjaluranGradeError("Import tidak ditemukan.", 404, "GRADE_IMPORT_NOT_FOUND");
    const lines = ["Baris,ID Pendaftaran,NIM,Nilai,Status,Kesalahan", ...imported.rows.filter((row) => !row.is_valid).map((row) => [
      row.row_number, row.pendaftaran_penjaluran_id || "", row.raw_payload?.NIM || "", row.nilai_huruf || "", "Tidak valid", (row.errors || []).join(" | "),
    ].map((value) => `"${sanitizeSpreadsheetString(value).replace(/"/g, '""')}"`).join(","))];
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=laporan_kesalahan_nilai_${imported.id}.csv`);
    return res.send(`\uFEFF${lines.join("\n")}`);
  } catch (error) { return sendError(res, error); }
};

exports.getMyPenjaluranGrades = async (req, res) => {
  try { return res.json({ success: true, data: await penjaluranGrades.getStudentData(Number(req.user.id)) }); }
  catch (error) { return sendError(res, error); }
};

exports.getMyPenjaluranSidangRequirement = async (req, res) => {
  try { return res.json({ success: true, data: await penjaluranGrades.getSidangRequirement(Number(req.user.id)) }); }
  catch (error) { return sendError(res, error); }
};

module.exports.sendError = sendError;
