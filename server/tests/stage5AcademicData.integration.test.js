"use strict";

process.env.NODE_ENV = "test";
require("dotenv").config();

const test = require("node:test");
const assert = require("node:assert/strict");
const { Op } = require("sequelize");
const db = require("../models");
const academic = require("../services/academicDataService");
const academicController = require("../controllers/academicController");
const { processAcademicOutboxOnce } = require("../scripts/process-academic-outbox");

async function invoke(handler, req) {
  const output = { statusCode: 200, payload: null };
  const res = { status(code) { output.statusCode = code; return this; }, json(payload) { output.payload = payload; return payload; } };
  await handler(req, res); return output;
}

test("Tahap 5: preview, commit, snapshot, shadow rule, koreksi, replay, dan missing-data berjalan end-to-end", async (t) => {
  const suffix = String(Date.now()).slice(-8);
  const ids = { students: [], periods: [], sources: [], curricula: [], courses: [], batches: [], equivalenceGroups: [] };
  t.after(async () => {
    await db.EvaluasiEligibilityAkademik.destroy({ where: { mahasiswa_id: { [Op.in]: ids.students } }, force: true });
    if (ids.students.length) await db.sequelize.query(`DELETE FROM "OutboxAkademiks" WHERE event_type = 'academic.correction.created' AND (payload->>'mahasiswa_id')::int IN (${ids.students.map(Number).join(",")})`);
    await db.OutboxAkademik.destroy({ where: { [Op.or]: [{ aggregate_type: "mahasiswa", aggregate_id: { [Op.in]: ids.students } }, { aggregate_type: "import_batch", aggregate_id: { [Op.in]: ids.batches } }] }, force: true });
    await db.PekerjaanSnapshotAkademik.destroy({ where: { mahasiswa_id: { [Op.in]: ids.students } }, force: true });
    await db.SnapshotAkademikMahasiswa.destroy({ where: { mahasiswa_id: { [Op.in]: ids.students } }, force: true });
    await db.KonflikDataAkademik.destroy({ where: { import_row_id: { [Op.in]: db.sequelize.literal(`(SELECT id FROM "ImportAkademikRows" WHERE batch_id IN (${ids.batches.join(",") || "NULL"}))`) } }, force: true });
    await db.KoreksiDataAkademik.destroy({ where: { actor_id: 991001 }, force: true });
    await db.RiwayatMetodologiPenelitian.destroy({ where: { mahasiswa_id: { [Op.in]: ids.students } }, force: true });
    await db.PercobaanMataKuliahMahasiswa.destroy({ where: { mahasiswa_id: { [Op.in]: ids.students } }, force: true });
    await db.CakupanDatasetAkademik.destroy({ where: { [Op.or]: [
      { batch_id: { [Op.in]: ids.batches } }, { mahasiswa_id: { [Op.in]: ids.students } },
      { source_id: { [Op.in]: ids.sources } },
    ] }, force: true });
    await db.ImportAkademikRow.destroy({ where: { batch_id: { [Op.in]: ids.batches } }, force: true });
    await db.ImportAkademikBatch.destroy({ where: { id: { [Op.in]: ids.batches } }, force: true });
    await db.RuleSetAkademik.destroy({ where: { kode: `STAGE5-${suffix}` }, force: true });
    await db.MahasiswaKurikulum.destroy({ where: { mahasiswa_id: { [Op.in]: ids.students } }, force: true });
    await db.KurikulumMataKuliah.destroy({ where: { kurikulum_id: { [Op.in]: ids.curricula } }, force: true });
    await db.EkuivalensiMataKuliah.destroy({ where: { kelompok_id: { [Op.in]: ids.equivalenceGroups } }, force: true });
    await db.KelompokEkuivalensiMataKuliah.destroy({ where: { id: { [Op.in]: ids.equivalenceGroups } }, force: true });
    await db.MataKuliahAlias.destroy({ where: { mata_kuliah_id: { [Op.in]: ids.courses } }, force: true });
    await db.MataKuliah.destroy({ where: { id: { [Op.in]: ids.courses } }, force: true });
    await db.Kurikulum.destroy({ where: { id: { [Op.in]: ids.curricula } }, force: true });
    await db.SumberDataAkademik.destroy({ where: { id: { [Op.in]: ids.sources } }, force: true });
    await db.Mahasiswa.destroy({ where: { id: { [Op.in]: ids.students } }, force: true });
    await db.PeriodeAkademik.destroy({ where: { id: { [Op.in]: ids.periods } }, force: true });
    await db.sequelize.close();
  });

  const year = 2000 + (Number(suffix.slice(-2)) % 20);
  const period = await db.PeriodeAkademik.create({ kode: `${year}-${year + 1}-GANJIL`, tahun_mulai: year, tahun_selesai: year + 1,
    tahun_akademik: `${year}/${year + 1}`, semester: "ganjil", tanggal_mulai: new Date(`${year}-08-01T00:00:00Z`),
    tanggal_selesai: new Date(`${year + 1}-01-01T00:00:00Z`), status: "draft", sumber: "test", metadata: {} });
  ids.periods.push(period.id);
  const activateInitialPeriod = await invoke(academicController.updateMaster, { params: { resource: "periode", id: period.id }, body: { status: "active" } });
  assert.equal(activateInitialPeriod.statusCode, 200);
  const invalidPeriodDates = await invoke(academicController.updateMaster, { params: { resource: "periode", id: period.id },
    body: { tanggal_mulai: `${year + 1}-01-01`, tanggal_selesai: `${year}-08-01` } });
  assert.equal(invalidPeriodDates.statusCode, 400); assert.equal(invalidPeriodDates.payload.code, "ACADEMIC_PERIOD_DATE_RANGE_INVALID");
  const validPeriodDates = await invoke(academicController.updateMaster, { params: { resource: "periode", id: period.id },
    body: { tanggal_mulai: `${year}-08-01`, tanggal_selesai: `${year + 1}-01-01` } });
  assert.equal(validPeriodDates.statusCode, 200);
  const source = await db.SumberDataAkademik.create({ kode: `S5-${suffix}`, nama: "Import Test", jenis: "manual_import", authority_level: 10 }); ids.sources.push(source.id);
  const curriculum = await db.Kurikulum.create({ kode: `K-${suffix}`, nama: "Kurikulum Test", kode_program_studi: "INFORMATIKA", program_kuliah: "reguler", status: "active" }); ids.curricula.push(curriculum.id);
  const course = await db.MataKuliah.create({ kode: `MET${suffix}`, nama: "Metodologi Penelitian", sks_default: 3, kode_program_studi: "INFORMATIKA", program_kuliah: "reguler", role_akademik: "methodology" }); ids.courses.push(course.id);
  await db.KurikulumMataKuliah.create({ kurikulum_id: curriculum.id, mata_kuliah_id: course.id, sifat: "wajib", sks: 3, kategori: "metodologi" });
  const student = await db.Mahasiswa.create({ nim: `S5${suffix}`, nama: "Mahasiswa Tahap 5", email: `s5.${suffix}@test.local`, password: "test", angkatan: "2024" }, { hooks: false }); ids.students.push(student.id);
  const missingStudent = await db.Mahasiswa.create({ nim: `S5M${suffix}`, nama: "Missing Data", email: `s5.missing.${suffix}@test.local`, password: "test" }, { hooks: false }); ids.students.push(missingStudent.id);
  const refreshStudent = await db.Mahasiswa.create({ nim: `S5R${suffix}`, nama: "Snapshot Belum Tersedia", email: `s5.refresh.${suffix}@test.local`, password: "test" }, { hooks: false }); ids.students.push(refreshStudent.id);
  await db.MahasiswaKurikulum.create({ mahasiswa_id: student.id, kurikulum_id: curriculum.id, periode_mulai_id: period.id, source_id: source.id, assigned_by: 991001 });

  const input = { datasetType: "course_attempts", schemaVersion: "v1", sourceId: source.id, defaultPeriodId: period.id,
    completenessScope: { scope_type: "student", mahasiswa_id: student.id, is_complete: true, declared_by_source: true },
    rows: [{ nim: student.nim, kode_periode: period.kode, kode_mata_kuliah: course.kode, sks: 3, nilai_angka: 0,
      status_registrasi: "completed", status_kelulusan: "failed", external_record_id: `EXT-${suffix}` }],
    filename: "attempt.xlsx", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileSize: 200,
    fileSha256: academic.checksum(`file-${suffix}`), actorId: 991001, idempotencyKey: `preview-${suffix}` };
  await assert.rejects(academic.createImportPreviewTransactional({ ...input, defaultPeriodId: null,
    fileSha256: academic.checksum(`missing-period-${suffix}`), idempotencyKey: `missing-period-${suffix}` }),
  (error) => error.status === 400 && error.code === "ACADEMIC_COMPLETENESS_PERIOD_REQUIRED");
  await assert.rejects(academic.createImportPreviewTransactional({ ...input,
    completenessScope: { scope_type: "faculty", is_complete: false },
    fileSha256: academic.checksum(`invalid-scope-${suffix}`), idempotencyKey: `invalid-scope-${suffix}` }),
  (error) => error.status === 400 && error.code === "ACADEMIC_COMPLETENESS_SCOPE_INVALID");
  await assert.rejects(academic.createImportPreviewTransactional({ ...input,
    completenessScope: { scope_type: "global", is_complete: true },
    fileSha256: academic.checksum(`global-scope-${suffix}`), idempotencyKey: `global-scope-${suffix}` }),
  (error) => error.status === 400 && error.code === "ACADEMIC_COMPLETENESS_SCOPE_INVALID");
  await assert.rejects(academic.createImportPreviewTransactional({ ...input,
    completenessScope: { scope_type: "cohort", is_complete: true },
    fileSha256: academic.checksum(`missing-cohort-${suffix}`), idempotencyKey: `missing-cohort-${suffix}` }),
  (error) => error.status === 400 && error.code === "ACADEMIC_COMPLETENESS_COHORT_REQUIRED");
  const preview = await db.sequelize.transaction((transaction) => academic.createImportPreview({ ...input, transaction })); ids.batches.push(preview.batch.id);
  assert.equal(preview.batch.status, "validated"); assert.equal(preview.batch.rows[0].normalized_payload.nilai_angka, 0);
  assert.equal(await db.PercobaanMataKuliahMahasiswa.count({ where: { mahasiswa_id: student.id } }), 0, "preview tidak menulis fakta kanonik");
  const previewReplay = await db.sequelize.transaction((transaction) => academic.createImportPreview({ ...input, transaction }));
  assert.equal(previewReplay.replayed, true); assert.equal(previewReplay.batch.id, preview.batch.id);

  const [firstCommit, secondCommit] = await Promise.all([
    academic.commitImport(preview.batch.id, { actorId: 991001, checksum: preview.batch.validation_checksum, idempotencyKey: `preview-${suffix}` }),
    academic.commitImport(preview.batch.id, { actorId: 991001, checksum: preview.batch.validation_checksum, idempotencyKey: `preview-${suffix}` }),
  ]);
  assert.ok(firstCommit.replayed !== secondCommit.replayed); assert.equal(await db.PercobaanMataKuliahMahasiswa.count({ where: { mahasiswa_id: student.id, is_active: true } }), 1);
  await assert.rejects(academic.commitImport(preview.batch.id, { actorId: 991001, checksum: preview.batch.validation_checksum,
    idempotencyKey: `different-commit-${suffix}` }), (error) => error.code === "ACADEMIC_IMPORT_IDEMPOTENCY_CONFLICT");
  const attempt = await db.PercobaanMataKuliahMahasiswa.findOne({ where: { mahasiswa_id: student.id, is_active: true } }); assert.equal(Number(attempt.nilai_angka), 0);
  const snapshot = (await academic.calculateSnapshot(student.id)).snapshot; assert.equal(Number(snapshot.total_sks_lulus), 0); assert.equal(snapshot.metodologi_status, "tidak_lulus");
  assert.equal(snapshot.data_state, "available");

  await db.RuleSetAkademik.create({ kode: `STAGE5-${suffix}`, context: "research_registration", version: 1, mode: "shadow",
    configuration: { require_methodology_passed: true }, status: "active", activated_at: new Date(), activated_by: 991001 });
  const shadow = await academic.evaluateEligibility({ mahasiswaId: student.id, context: "research_registration", persist: true });
  assert.equal(shadow.evaluated_result, "blocked"); assert.equal(shadow.effective_decision, "warn"); assert.ok(shadow.reason_codes.includes("METHODOLOGY_NOT_PASSED"));
  const enforced = await invoke(academicController.createRuleSet, { body: { kode: `ENFORCED-${suffix}`, context: "change_track",
    version: 1, mode: "enforced", configuration: {} }, user: { id: 991001, role: "admin" } });
  assert.equal(enforced.statusCode, 409); assert.equal(enforced.payload.code, "ACADEMIC_RULE_ENFORCEMENT_NOT_READY");

  await assert.rejects(academic.correctAcademicRecord("course_attempt", attempt.id, { actorId: 991001,
    reason: "Koreksi invalid harus ditolak", expectedRevision: attempt.version, changes: { sks_diambil: -1 } }),
  (error) => error.code === "ACADEMIC_CORRECTION_INVALID");

  const attemptCorrection = await academic.correctAcademicRecord("course_attempt", attempt.id, { actorId: 991001,
    reason: "Koreksi manual untuk menguji resolusi konflik sumber", expectedRevision: attempt.version, changes: { nilai_huruf: "E" } });
  const conflictPreview = await academic.ingestAcademicDataset({ source, schemaVersion: "v1", externalRevision: `R-${suffix}`,
    completenessScope: { scope_type: "student", mahasiswa_id: student.id, is_complete: true }, idempotencyKey: `adapter-${suffix}`,
    defaultPeriodId: period.id, actorId: 991001, rows: [{ nim: student.nim, kode_periode: period.kode,
      kode_mata_kuliah: course.kode, sks: 3, nilai_angka: 40, status_registrasi: "completed",
      status_kelulusan: "failed", external_record_id: `EXT-${suffix}` }] });
  ids.batches.push(conflictPreview.batch.id);
  assert.equal(conflictPreview.batch.status, "invalid"); assert.equal(conflictPreview.batch.rows[0].action, "conflict");
  const conflict = await db.KonflikDataAkademik.findOne({ where: { import_row_id: conflictPreview.batch.rows[0].id, status: "open" } });
  assert.ok(conflict);
  assert.equal((await academic.calculateSnapshot(student.id)).snapshot.data_state, "conflicted");
  const resolved = await invoke(academicController.decideConflict, { params: { id: conflict.id, action: "resolve" },
    body: { decision: "keep_admin_correction" }, user: { id: 991001, role: "admin" } });
  assert.equal(resolved.statusCode, 200);
  assert.equal(resolved.payload.data.batch.status, "validated");
  await academic.commitImport(conflictPreview.batch.id, { actorId: 991001,
    checksum: resolved.payload.data.batch.validation_checksum, idempotencyKey: `conflict-commit-${suffix}` });
  assert.equal(await db.CakupanDatasetAkademik.count({ where: { mahasiswa_id: student.id, is_active: true } }), 1);
  assert.equal(await db.CakupanDatasetAkademik.count({ where: { mahasiswa_id: student.id } }), 2);

  const revokedAttemptCorrection = await academic.revokeAcademicCorrection(attemptCorrection.correction.id, { actorId: 991001,
    reason: "Bukti koreksi attempt dibatalkan" });
  const restoredAttempt = await db.PercobaanMataKuliahMahasiswa.findByPk(revokedAttemptCorrection.restored_record.id);
  const restoredMethodology = await db.RiwayatMetodologiPenelitian.findOne({ where: { mahasiswa_id: student.id, is_active: true } });
  assert.equal(Number(restoredMethodology.attempt_id), Number(restoredAttempt.id));
  assert.equal(restoredMethodology.status, "tidak_lulus");

  const history = restoredMethodology;
  await academic.correctAcademicRecord("methodology_history", history.id, { actorId: 991001, reason: "Koreksi berdasarkan berita acara resmi", expectedRevision: history.version, changes: { status: "lulus", nilai_huruf: "A" } });
  const correctedSnapshot = (await academic.calculateSnapshot(student.id)).snapshot; assert.equal(correctedSnapshot.metodologi_status, "lulus");
  assert.ok(attemptCorrection.record.id);
  const allowed = await academic.evaluateEligibility({ mahasiswaId: student.id, context: "research_registration" }); assert.equal(allowed.evaluated_result, "eligible"); assert.equal(allowed.effective_decision, "allow");

  const missing = (await academic.calculateSnapshot(missingStudent.id)).snapshot; assert.equal(missing.data_state, "unavailable"); assert.equal(missing.metodologi_status, null);

  const sourceEquivalentCourse = await db.MataKuliah.create({ kode: `SRC${suffix}`, nama: "Sumber Ekuivalensi", sks_default: 2,
    kode_program_studi: "INFORMATIKA", program_kuliah: "reguler", status: "active" }); ids.courses.push(sourceEquivalentCourse.id);
  const targetEquivalentCourse = await db.MataKuliah.create({ kode: `TGT${suffix}`, nama: "Tujuan Ekuivalensi", sks_default: 2,
    kode_program_studi: "INFORMATIKA", program_kuliah: "reguler", status: "active" }); ids.courses.push(targetEquivalentCourse.id);
  await db.KurikulumMataKuliah.bulkCreate([
    { kurikulum_id: curriculum.id, mata_kuliah_id: sourceEquivalentCourse.id, sifat: "wajib", sks: 2 },
    { kurikulum_id: curriculum.id, mata_kuliah_id: targetEquivalentCourse.id, sifat: "wajib", sks: 2 },
  ]);
  const equivalenceGroup = await db.KelompokEkuivalensiMataKuliah.create({ kode: `EQ-${suffix}`, nama: "Ekuivalensi satu arah",
    dasar_keputusan: "Keputusan pengujian arah ekuivalensi", status: "active" }); ids.equivalenceGroups.push(equivalenceGroup.id);
  await db.EkuivalensiMataKuliah.create({ kelompok_id: equivalenceGroup.id, mata_kuliah_id: sourceEquivalentCourse.id,
    mata_kuliah_sumber_id: sourceEquivalentCourse.id, mata_kuliah_tujuan_id: targetEquivalentCourse.id,
    kurikulum_id: curriculum.id, arah: "source_to_target", dasar_keputusan: "Sumber hanya menggantikan tujuan", is_active: true });
  const partialStudent = await db.Mahasiswa.create({ nim: `S5P${suffix}`, nama: "Coverage Parsial", email: `s5.partial.${suffix}@test.local`, password: "test" }, { hooks: false }); ids.students.push(partialStudent.id);
  const reverseStudent = await db.Mahasiswa.create({ nim: `S5V${suffix}`, nama: "Arah Ekuivalensi Terbalik", email: `s5.reverse.${suffix}@test.local`, password: "test" }, { hooks: false }); ids.students.push(reverseStudent.id);
  for (const item of [partialStudent, reverseStudent]) await db.MahasiswaKurikulum.create({ mahasiswa_id: item.id,
    kurikulum_id: curriculum.id, periode_mulai_id: period.id, source_id: source.id, assigned_by: 991001 });
  const recordedAt = new Date();
  for (const [item, passedCourse] of [[partialStudent, sourceEquivalentCourse], [reverseStudent, targetEquivalentCourse]]) {
    await db.PercobaanMataKuliahMahasiswa.create({ mahasiswa_id: item.id, mata_kuliah_id: passedCourse.id,
      periode_akademik_id: period.id, source_id: source.id, kelas_normalized: "DEFAULT", attempt_ke: 1,
      attempt_number_source: "source", sks_diambil: 2, sks_lulus: 2, nilai_huruf: "A", nilai_angka: 90,
      status_registrasi: "completed", status_kelulusan: "passed", credit_origin: "regular", recognition_status: "not_required",
      effective_at: recordedAt, academic_effective_at: period.tanggal_selesai, recorded_at: recordedAt, version: 1, is_active: true, metadata: {} });
  }
  const partialSnapshot = (await academic.calculateSnapshot(partialStudent.id)).snapshot;
  assert.equal(partialSnapshot.data_state, "incomplete"); assert.ok(partialSnapshot.quality_issues.includes("ACADEMIC_COVERAGE_INCOMPLETE"));
  assert.ok(!partialSnapshot.wajib_belum_lulus.includes(targetEquivalentCourse.id), "arah sumber ke tujuan memenuhi requirement tujuan");
  const reverseSnapshot = (await academic.calculateSnapshot(reverseStudent.id)).snapshot;
  assert.ok(reverseSnapshot.wajib_belum_lulus.includes(sourceEquivalentCourse.id), "arah tujuan ke sumber tidak boleh dianggap ekuivalen");

  const internationalCourse = await db.MataKuliah.create({ kode: course.kode, nama: "Metodologi Internasional", sks_default: 3,
    kode_program_studi: "INFORMATIKA", program_kuliah: "internasional", role_akademik: "methodology" }); ids.courses.push(internationalCourse.id);
  await db.MataKuliahAlias.bulkCreate([
    { mata_kuliah_id: course.id, source_id: source.id, kode_alias: `ALIAS${suffix}`, kode_program_studi: "INFORMATIKA", program_kuliah: "reguler", is_active: true },
    { mata_kuliah_id: internationalCourse.id, source_id: source.id, kode_alias: `ALIAS${suffix}`, kode_program_studi: "INFORMATIKA", program_kuliah: "internasional", is_active: true },
  ]);
  const internationalRows = await db.sequelize.transaction((transaction) => academic.validateRows({ datasetType: "course_attempts",
    sourceId: source.id, defaultPeriodId: period.id, programCode: "INFORMATIKA", programKuliah: "internasional", transaction,
    rows: [{ nim: student.nim, kode_periode: period.kode, kode_mata_kuliah: `ALIAS${suffix}`, sks: 3,
      status_registrasi: "completed", status_kelulusan: "failed" }] }));
  assert.equal(Number(internationalRows[0].mata_kuliah_id), Number(internationalCourse.id));
  await assert.rejects(db.sequelize.transaction((transaction) => academic.validateRows({ datasetType: "course_attempts",
    sourceId: source.id, rows: [], programKuliah: "unknown", transaction })), (error) => error.code === "ACADEMIC_PROGRAM_TYPE_INVALID");

  const followingPeriod = await db.PeriodeAkademik.create({ kode: `${year}-${year + 1}-GENAP`, tahun_mulai: year, tahun_selesai: year + 1,
    tahun_akademik: `${year}/${year + 1}`, semester: "genap", tanggal_mulai: new Date(`${year + 1}-01-02T00:00:00Z`),
    tanggal_selesai: new Date(`${year + 1}-07-01T00:00:00Z`), status: "draft", sumber: "test", metadata: {} });
  ids.periods.push(followingPeriod.id);
  const parallelActivation = await Promise.all([
    invoke(academicController.updateMaster, { params: { resource: "periode", id: period.id }, body: { status: "active" } }),
    invoke(academicController.updateMaster, { params: { resource: "periode", id: followingPeriod.id }, body: { status: "active" } }),
  ]);
  assert.ok(parallelActivation.every((result) => result.statusCode === 200));
  assert.equal(await db.PeriodeAkademik.count({ where: { status: "active" } }), 1,
    "aktivasi paralel tidak boleh menghasilkan dua periode akademik aktif");
  const activateFollowingPeriod = await invoke(academicController.updateMaster, {
    params: { resource: "periode", id: followingPeriod.id }, body: { status: "active" },
  });
  assert.equal(activateFollowingPeriod.statusCode, 200);
  await period.reload();
  assert.equal(period.status, "closed");
  const noAttemptStudent = await db.Mahasiswa.create({ nim: `S5N${suffix}`, nama: "Tanpa Attempt Periode Aktif",
    email: `s5.no-attempt.${suffix}@test.local`, password: "test", angkatan: "2024" }, { hooks: false });
  ids.students.push(noAttemptStudent.id);
  await db.MahasiswaKurikulum.create({ mahasiswa_id: noAttemptStudent.id, kurikulum_id: curriculum.id,
    periode_mulai_id: period.id, source_id: source.id, assigned_by: 991001 });
  await db.CakupanDatasetAkademik.create({ source_id: source.id, dataset_type: "course_attempts",
    mahasiswa_id: noAttemptStudent.id, periode_akademik_id: period.id, scope_type: "student",
    kode_program_studi: "INFORMATIKA", program_kuliah: "reguler", is_complete: true, is_active: true,
    declared_by_source: true, declared_at: new Date(), checksum: academic.checksum(`old-coverage-${suffix}`),
    metadata: { scope_type: "student", mahasiswa_id: noAttemptStudent.id } });
  await db.CakupanDatasetAkademik.create({ source_id: source.id, dataset_type: "course_attempts",
    mahasiswa_id: null, periode_akademik_id: followingPeriod.id, scope_type: "cohort",
    kode_program_studi: "INFORMATIKA", program_kuliah: "reguler", is_complete: true, is_active: true,
    declared_by_source: true, declared_at: new Date(), checksum: academic.checksum(`wrong-cohort-${suffix}`),
    metadata: { scope_type: "cohort", cohort: "1999" } });
  const noAttemptSnapshot = (await academic.calculateSnapshot(noAttemptStudent.id)).snapshot;
  assert.equal(noAttemptSnapshot.data_state, "incomplete");
  assert.ok(noAttemptSnapshot.quality_issues.includes("ACADEMIC_COVERAGE_INCOMPLETE"),
    "coverage periode lama tidak boleh mencukupi snapshot current tanpa attempt");
  await invoke(academicController.updateMaster, { params: { resource: "periode", id: followingPeriod.id }, body: { status: "closed" } });
  const undeterminedPeriodSnapshot = (await academic.calculateSnapshot(missingStudent.id)).snapshot;
  assert.equal(undeterminedPeriodSnapshot.data_state, "incomplete");
  assert.ok(undeterminedPeriodSnapshot.quality_issues.includes("ACADEMIC_ACTIVE_PERIOD_UNDETERMINED"));
  await invoke(academicController.updateMaster, { params: { resource: "periode", id: followingPeriod.id }, body: { status: "active" } });
  const laterCourse = await db.MataKuliah.create({ kode: `LATER${suffix}`, nama: "Mata Kuliah Setelah Cutoff", sks_default: 4,
    kode_program_studi: "INFORMATIKA", program_kuliah: "reguler", status: "active" }); ids.courses.push(laterCourse.id);
  const futureEffective = new Date(`${year + 1}-02-01T00:00:00Z`);
  await db.PercobaanMataKuliahMahasiswa.create({ mahasiswa_id: student.id, mata_kuliah_id: laterCourse.id,
    periode_akademik_id: followingPeriod.id, source_id: source.id, kelas_normalized: "DEFAULT", attempt_ke: 1,
    attempt_number_source: "source", sks_diambil: 4, sks_lulus: 4, nilai_huruf: "A", nilai_angka: 90,
    status_registrasi: "completed", status_kelulusan: "passed", credit_origin: "regular", recognition_status: "not_required",
    effective_at: new Date(), academic_effective_at: futureEffective, recorded_at: new Date(), version: 1, is_active: true, metadata: {} });
  const activeHistory = await db.RiwayatMetodologiPenelitian.findOne({ where: { mahasiswa_id: student.id, is_active: true } });
  await activeHistory.update({ is_active: false, superseded_at: new Date() });
  await db.RiwayatMetodologiPenelitian.create({ mahasiswa_id: student.id, periode_akademik_id: followingPeriod.id,
    attempt_id: null, source_id: source.id, status: "tidak_lulus", effective_at: new Date(),
    academic_effective_at: futureEffective, recorded_at: new Date(),
    version: Number(activeHistory.version) + 1, previous_version_id: activeHistory.id, is_active: true,
    evidence_type: "source_status", metadata: {} });
  const historicalResults = await Promise.all([academic.calculateSnapshot(student.id, { periodId: period.id }), academic.calculateSnapshot(student.id, { periodId: period.id })]);
  assert.equal(Number(historicalResults[0].snapshot.total_sks_lulus), 0);
  assert.equal(Number(historicalResults[0].snapshot.total_sks_diambil), 3, "late import tetap masuk berdasarkan waktu berlaku akademik");
  assert.equal(historicalResults[0].snapshot.metodologi_status, "lulus");
  assert.equal(historicalResults[0].snapshot.snapshot_scope, "period_end");
  assert.equal(historicalResults[0].snapshot.is_current, false);
  assert.equal(new Date(historicalResults[0].snapshot.cutoff_at).getTime(), new Date(period.tanggal_selesai).getTime());
  const stillCurrent = await db.SnapshotAkademikMahasiswa.findOne({ where: { mahasiswa_id: student.id, snapshot_scope: "current", is_current: true } });
  assert.equal(Number(stillCurrent.id), Number(correctedSnapshot.id), "snapshot historis tidak menggantikan snapshot current");

  const readOnlyDetail = await academic.getStudentAcademicDetail(refreshStudent.id);
  assert.equal(readOnlyDetail.refreshing, true); assert.equal(readOnlyDetail.snapshot.calculation_status, "refreshing");
  assert.equal(await db.SnapshotAkademikMahasiswa.count({ where: { mahasiswa_id: refreshStudent.id } }), 0,
    "GET hanya mengantrekan refresh dan tidak menghitung snapshot sinkron");

  const firstJob = await db.sequelize.transaction((transaction) => academic.queueSnapshot(student.id, "worker-test", transaction));
  const replayJob = await db.sequelize.transaction((transaction) => academic.queueSnapshot(student.id, "worker-test-replay", transaction));
  assert.equal(firstJob.id, replayJob.id, "facts checksum menduplikasi job identik");
  for (let index = 0; index < 200; index += 1) { if (!await processAcademicOutboxOnce()) break; }
  assert.equal((await firstJob.reload()).status, "completed");
  assert.equal(await db.OutboxAkademik.count({ where: { status: "pending", event_type: {
    [Op.in]: ["academic.snapshot.requested", "academic.import.committed", "academic.correction.created"] } } }), 0,
  "seluruh jenis outbox yang diproduksi Tahap 5 harus selesai diproses");

  const endpoint = await invoke(academicController.getMyAcademic, { user: { id: student.id, role: "mahasiswa" } });
  assert.equal(endpoint.statusCode, 200); assert.equal(endpoint.payload.success, true); assert.equal(endpoint.payload.data.mahasiswa.id, student.id);
});
