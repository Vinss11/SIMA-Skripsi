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

const admin = express.Router();
admin.use(authenticateToken, authorizeRole("admin"));
admin.use((req, res, next) => ["POST", "PUT", "PATCH", "DELETE"].includes(req.method) ? academicMutationRateLimit(req, res, next) : next());
["periode", "sources", "kurikulum", "mata-kuliah"].forEach((resource) => {
  admin.get(`/${resource}`, (req, res, next) => { req.params.resource = resource; return controller.listMaster(req, res, next); });
  admin.post(`/${resource}`, (req, res, next) => { req.params.resource = resource; return controller.createMaster(req, res, next); });
  admin.put(`/${resource}/:id`, (req, res, next) => { req.params.resource = resource; return controller.updateMaster(req, res, next); });
});
admin.post("/mata-kuliah/:id/aliases", controller.createAlias);
admin.post("/equivalence-groups", controller.createEquivalenceGroup);
admin.put("/equivalences/:id", controller.upsertEquivalence);
admin.post("/mahasiswa/:id/curriculum-assignment", controller.assignCurriculum);
admin.get("/templates/:dataset", controller.downloadTemplate);
admin.post("/imports", (req, res, next) => upload.single("file")(req, res, (error) => error ? res.status(400).json({ success: false, code: "ACADEMIC_IMPORT_FILE_INVALID", message: error.message }) : next()), controller.createImport);
admin.get("/imports", controller.listImports);
admin.get("/imports/:id/preview", controller.getImportPreview);
admin.post("/imports/:id/revalidate", controller.revalidateImport);
admin.post("/imports/:id/cancel", controller.cancelImport);
admin.post("/imports/:id/commit", controller.commitImport);
admin.get("/imports/:id/report", controller.downloadImportReport);
admin.get("/mahasiswa/:id", controller.getStudentDetailAdmin);
admin.post("/records/:type/:id/corrections", controller.createCorrection);
admin.get("/corrections", controller.listCorrections);
admin.post("/corrections/:id/revoke", controller.revokeCorrection);
admin.get("/conflicts", controller.listConflicts);
admin.post("/conflicts/:id/:action", controller.decideConflict);
admin.get("/snapshot-jobs", controller.listSnapshotJobs);
admin.post("/snapshot-jobs/:id/retry", controller.retrySnapshotJob);
admin.get("/outbox", controller.listOutbox);
admin.post("/outbox/:id/retry", controller.retryOutbox);
admin.post("/snapshots/rebuild", controller.rebuildSnapshots);
admin.get("/rule-sets", controller.listRuleSets);
admin.post("/rule-sets", controller.createRuleSet);
admin.post("/rule-sets/:id/:action", controller.changeRuleStatus);
admin.get("/operations/failed", controller.getFailedOperations);

const secretary = express.Router();
secretary.use(authenticateToken, authorizeRole("sekretaris_prodi"), authorizeSekretarisAccess);
secretary.get("/monitoring", controller.getMonitoring);
secretary.get("/mahasiswa/:id", controller.getStudentDetailAdmin);

const student = express.Router();
student.use(authenticateToken, authorizeRole("mahasiswa"));
student.get("/", controller.getMyAcademic);
student.get("/eligibility", controller.getMyEligibility);

module.exports = { admin, secretary, student };
