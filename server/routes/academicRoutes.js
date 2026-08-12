"use strict";

const express = require("express");
const controller = require("../controllers/academicController");
const upload = require("../middlewares/uploadMiddleware");
const { authenticateToken, authorizeRole, authorizeSekretarisAccess } = require("../middlewares/authMiddleware");

const mutationBuckets = new Map();
function academicMutationRateLimit(req, res, next) {
  const key = `${req.user?.role || "guest"}:${req.user?.id || req.ip}`;
  const now = Date.now();
  const current = mutationBuckets.get(key);
  if (!current || current.resetAt <= now) mutationBuckets.set(key, { count: 1, resetAt: now + 60000 });
  else {
    current.count += 1;
    if (current.count > 30) return res.status(429).json({ success: false, code: "ACADEMIC_RATE_LIMITED", message: "Terlalu banyak perubahan akademik. Coba kembali sebentar lagi." });
  }
  return next();
}

function gradeUpload(req, res, next) {
  return upload.single("file")(req, res, (error) => error
    ? res.status(400).json({ success: false, code: "GRADE_IMPORT_FILE_INVALID", message: error.message })
    : next());
}

const admin = express.Router();
admin.use(authenticateToken, authorizeRole("admin"));
admin.use((req, res, next) => ["POST", "PUT", "PATCH", "DELETE"].includes(req.method) ? academicMutationRateLimit(req, res, next) : next());
admin.get("/nilai/periode", controller.listPenjaluranPeriods);
admin.get("/nilai/template", controller.downloadPenjaluranGradeTemplate);
admin.get("/nilai", controller.listPenjaluranGrades);
admin.post("/nilai/imports", gradeUpload, controller.previewPenjaluranGradeImport);
admin.post("/nilai/imports/:id/commit", controller.commitPenjaluranGradeImport);
admin.get("/nilai/imports/:id/report", controller.downloadPenjaluranGradeReport);

const secretary = express.Router();
secretary.use(authenticateToken, authorizeRole("sekretaris_prodi"), authorizeSekretarisAccess);
secretary.get("/nilai/periode", controller.listPenjaluranPeriods);
secretary.get("/nilai", controller.listPenjaluranGradesForSecretary);

const student = express.Router();
student.use(authenticateToken, authorizeRole("mahasiswa"));
student.get("/mata-kuliah-penjaluran", controller.getMyPenjaluranGrades);
student.get("/persyaratan-sidang", controller.getMyPenjaluranSidangRequirement);

module.exports = { admin, secretary, student };
