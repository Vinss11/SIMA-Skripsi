"use strict";

process.env.NODE_ENV = "test";
require("dotenv").config();
const test = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { Op } = require("sequelize");
const db = require("../models");
const workflow = require("../services/guidanceWorkflowService");
const { getCurrentProgressForMahasiswa, recalculateCurrentProgressForMahasiswa, resolvePolicy } = require("../services/guidanceProgressService");
const { activateSupervisorAssignment } = require("../services/penetapanPembimbingService");
const readiness = require("../services/guidanceReadinessService");
const governance = require("../controllers/guidanceGovernanceController");
const { processProgressRecalculationJobOnce } = require("../services/guidanceProgressRecalculationService");

db.sequelize.options.logging = false;

test("Tahap 7: workflow terikat siklus, idempoten, versioned, dan hanya reviewer efektif yang dapat memproses", async (t) => {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-10);
  const ids = { students: [], dosens: [], secretaries: [], periods: [], academic: [], registrations: [], assignments: [], guidance: [], policies: [] };
  t.after(async () => {
    const guidanceIds = ids.guidance;
    await db.GuidanceProgressRecalculationJob.destroy({ where: { mahasiswa_id: ids.students }, force: true });
    await db.Notifikasi.destroy({ where: { [Op.or]: [{ recipient_type: "mahasiswa", recipient_id: ids.students }, { recipient_type: "dosen", recipient_id: ids.dosens },
      { recipient_type: "sekretaris_prodi", recipient_id: ids.secretaries }] }, force: true });
    await db.GuidanceProgressSnapshot.destroy({ where: { mahasiswa_id: ids.students }, force: true });
    await db.GuidanceProgressEvaluation.destroy({ where: { guidance_id: guidanceIds }, force: true });
    await db.GuidanceReviewerTransfer.destroy({ where: { guidance_id: guidanceIds }, force: true });
    await db.GuidanceEvent.destroy({ where: { guidance_id: guidanceIds }, force: true });
    await db.GuidanceResumeVersion.destroy({ where: { guidance_id: guidanceIds }, force: true });
    await db.GuidanceCommandReceipt.destroy({ where: { [Op.or]: [{ actor_type: "mahasiswa", actor_id: ids.students }, { actor_type: "dosen", actor_id: ids.dosens }] }, force: true });
    await db.GuidanceCommandReceipt.destroy({ where: { actor_type: "sekretaris_prodi", actor_id: { [Op.in]: [999999, ...ids.secretaries] } }, force: true });
    await db.BimbinganSkripsi.destroy({ where: { id: guidanceIds }, force: true });
    await db.PenetapanPembimbingDosen.destroy({ where: { penetapan_pembimbing_id: ids.assignments }, force: true });
    await db.PenetapanPembimbing.destroy({ where: { id: ids.assignments }, force: true });
    await db.PendaftaranPenjaluran.destroy({ where: { id: ids.registrations }, force: true });
    await db.GuidanceRequirementPolicy.destroy({ where: { id: ids.policies }, force: true });
    await db.Mahasiswa.destroy({ where: { id: ids.students }, force: true });
    await db.Dosen.destroy({ where: { id: ids.dosens }, force: true });
    await db.SekretarisProdi.destroy({ where: { id: ids.secretaries }, force: true });
    await db.PeriodePenjaluran.destroy({ where: { id: ids.periods }, force: true });
    await db.PeriodeAkademik.destroy({ where: { id: ids.academic }, force: true });
    await db.sequelize.close();
  });

  const occupied = new Set((await db.PeriodeAkademik.findAll({ attributes: ["tahun_akademik", "semester"] })).map((row) => `${row.tahun_akademik}:${row.semester}`));
  let year = 2100; while (occupied.has(`${year}/${year + 1}:ganjil`) && year < 2198) year += 1;
  const academic = await db.PeriodeAkademik.create({ kode: `S7-${suffix}`, tahun_mulai: year, tahun_selesai: year + 1, tahun_akademik: `${year}/${year + 1}`, semester: "ganjil",
    tanggal_mulai: new Date(`${year}-08-01T00:00:00Z`), tanggal_selesai: new Date(`${year}-12-31T00:00:00Z`), status: "draft", sumber: "stage7_test", metadata: {} });
  ids.academic.push(academic.id);
  const period = await db.PeriodePenjaluran.create({ tahun_akademik: `${year}/${year + 1}`, semester: "ganjil", label_periode: `Stage7 ${suffix}`,
    status: "closed", is_active: false, periode_akademik_id: academic.id }); ids.periods.push(period.id);

  const invoke = async (handler, { params = {}, body = {}, operationKey, user = { id: 999999, sekretaris_prodi_id: 999999 } }) => {
    const response = { statusCode: 200, payload: null, status(code) { this.statusCode = code; return this; }, json(payload) { this.payload = payload; return this; } };
    await handler({ params, body, user, query: {}, get: (name) => name === "Idempotency-Key" ? operationKey : null }, response);
    return response;
  };
  const policyBody = { kode_program_studi: "INFORMATIKA", program_kuliah: "reguler", jalur: "perintisan_bisnis",
    periode_akademik_id: academic.id, minimum_validated_sessions: 3, count_scope: "cycle", occurrence_proof_mode: "approved_resume", supervisor_approval_scope: "p1" };
  const firstDraftResponse = await invoke(governance.createPolicy, { body: policyBody, operationKey: `s7-policy-create-a-${suffix}` });
  const secondDraftResponse = await invoke(governance.createPolicy, { body: policyBody, operationKey: `s7-policy-create-b-${suffix}` });
  ids.policies.push(firstDraftResponse.payload.data.id, secondDraftResponse.payload.data.id);
  const firstActive = await invoke(governance.activatePolicy, { params: { id: firstDraftResponse.payload.data.id },
    body: { expected_version: 1 }, operationKey: `s7-policy-active-a-${suffix}` }); assert.equal(firstActive.statusCode, 200);
  const conflict = await invoke(governance.activatePolicy, { params: { id: secondDraftResponse.payload.data.id },
    body: { expected_version: 1 }, operationKey: `s7-policy-active-b-conflict-${suffix}` }); assert.equal(conflict.statusCode, 409); assert.equal(conflict.payload.code, "GUIDANCE_POLICY_ACTIVE_SCOPE_CONFLICT");
  const retired = await invoke(governance.retirePolicy, { params: { id: firstDraftResponse.payload.data.id },
    body: { expected_version: 2 }, operationKey: `s7-policy-retire-a-${suffix}` }); assert.equal(retired.payload.data.status, "retired");
  const secondActive = await invoke(governance.activatePolicy, { params: { id: secondDraftResponse.payload.data.id },
    body: { expected_version: 1 }, operationKey: `s7-policy-active-b-${suffix}` }); assert.equal(secondActive.payload.data.status, "active");
  const resolvedScopedPolicy = await resolvePolicy({ kodeProgramStudi: "INFORMATIKA", programKuliah: "reguler",
    jalur: "perintisan_bisnis", periodeAkademikId: academic.id }); assert.equal(resolvedScopedPolicy.id, secondDraftResponse.payload.data.id);
  const parallelPolicyBody = { ...policyBody, jalur: "magang" };
  const parallelPolicies = await Promise.all(["a", "b"].map(() => invoke(governance.createPolicy, {
    body: parallelPolicyBody, operationKey: `s7-policy-parallel-${suffix}` })));
  assert.equal(parallelPolicies[0].payload.data.id, parallelPolicies[1].payload.data.id);
  assert.equal(parallelPolicies.filter((response) => response.payload.replayed).length, 1);
  ids.policies.push(parallelPolicies[0].payload.data.id);
  const dosens = [];
  for (let i = 1; i <= 3; i += 1) {
    const dosen = await db.Dosen.create({ kode_dosen: `S7${suffix}${i}`, nik: `${i}${suffix}`.slice(0, 9), nama: `Dosen Stage7 ${i}`,
      email: `stage7.${suffix}.${i}@test.local`, password: "test", status_keaktifan: "active", account_is_active: true,
      continue_existing_supervision: true, kuota_bimbingan: 10 }, { hooks: false }); dosens.push(dosen); ids.dosens.push(dosen.id);
  }
  const secretary = await db.SekretarisProdi.create({ nik: `9${suffix}`.slice(0, 9), nama: "Sekretaris Stage7",
    email: `stage7.secretary.${suffix}@test.local`, password: "test", jabatan: "Sekretaris Prodi" }, { hooks: false });
  ids.secretaries.push(secretary.id);
  const student = await db.Mahasiswa.create({ nim: `S7${suffix}`.slice(0, 10), nama: "Mahasiswa Stage7", email: `stage7.${suffix}@test.local`,
    password: "test", status_jalur_saat_ini: "penelitian" }, { hooks: false }); ids.students.push(student.id);
  const registration = await db.PendaftaranPenjaluran.create({ mahasiswa_id: student.id, periode_penjaluran_id: period.id, jalur: "baru",
    program_kuliah: "reguler", semester_mahasiswa: 7, status: "approved", jenis_jalur_diambil: "penelitian", form_lanjutan_status: "approved" }); ids.registrations.push(registration.id);
  const assignment = await db.PenetapanPembimbing.create({ mahasiswa_id: student.id, pendaftaran_penjaluran_id: registration.id,
    periode_mulai_id: period.id, semester_penjaluran_ke: 1, tanggal_mulai: new Date(), status: "active", sumber_data: "penjaluran" }); ids.assignments.push(assignment.id);
  const members = await db.PenetapanPembimbingDosen.bulkCreate(dosens.slice(0, 2).map((dosen, index) => ({ penetapan_pembimbing_id: assignment.id,
    dosen_id: dosen.id, urutan: index + 1, peran: index ? "pendamping" : "utama", status: "active", tanggal_mulai: new Date() })), { returning: true });

  const date = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const created = await workflow.createRequest({ mahasiswaId: student.id, targetMemberId: members[1].id, pesan: "Membahas perkembangan implementasi tahap tujuh.",
    tanggal: date, jam: "10:00", idempotencyKey: `s7-create-${suffix}` });
  ids.guidance.push(created.data.id); assert.equal(created.status, 201); assert.equal(created.data.target_urutan_snapshot, 2);
  assert.equal(created.data.pendaftaran_penjaluran_id, registration.id); assert.equal(created.data.periode_akademik_id, academic.id);
  const replay = await workflow.createRequest({ mahasiswaId: student.id, targetMemberId: members[1].id, pesan: "Membahas perkembangan implementasi tahap tujuh.",
    tanggal: date, jam: "10:00", idempotencyKey: `s7-create-${suffix}` });
  assert.equal(replay.replayed, true); assert.equal(replay.data.id, created.data.id);
  await assert.rejects(() => workflow.createRequest({ mahasiswaId: student.id, targetMemberId: members[0].id, pesan: "Payload berbeda untuk key yang sama.",
    tanggal: date, jam: "11:00", idempotencyKey: `s7-create-${suffix}` }), (error) => error.code === "IDEMPOTENCY_CONFLICT");

  await assert.rejects(() => workflow.decideRequest({ guidanceId: created.data.id, dosenId: dosens[0].id, action: "approve", catatan: "Disetujui",
    tanggal: date, jam: "10:00", lokasi: "Ruang 1", expectedVersion: 1, idempotencyKey: `s7-wrong-reviewer-${suffix}` }), (error) => error.code === "GUIDANCE_REVIEWER_NOT_AUTHORIZED");
  const accepted = await workflow.decideRequest({ guidanceId: created.data.id, dosenId: dosens[1].id, action: "approve", catatan: "Jadwal disetujui",
    tanggal: date, jam: "10:00", lokasi: "Ruang 2", expectedVersion: 1, idempotencyKey: `s7-accept-${suffix}` });
  assert.equal(accepted.data.request_status, "accepted"); assert.equal(accepted.data.row_version, 2);
  const guidance = await db.BimbinganSkripsi.findByPk(created.data.id); await guidance.update({ scheduled_at: new Date(Date.now() - 3600000), permintaan_tanggal: new Date(Date.now() - 86400000).toISOString().slice(0, 10) });
  const submitted = await workflow.submitResumeVersion({ guidanceId: guidance.id, mahasiswaId: student.id,
    resume: "Resume versi pertama yang menyimpan histori secara immutable.", expectedVersion: 2, idempotencyKey: `s7-resume-${suffix}` });
  assert.equal(submitted.data.row_version, 3);
  const reviewed = await workflow.reviewResumeVersion({ guidanceId: guidance.id, dosenId: dosens[1].id, action: "approve", catatan: "Sudah sesuai",
    expectedVersion: 3, idempotencyKey: `s7-review-${suffix}` });
  assert.equal(reviewed.data.is_counted, true); assert.equal(reviewed.data.row_version, 4);
  assert.equal(await db.GuidanceResumeVersion.count({ where: { guidance_id: guidance.id } }), 1);
  assert.equal(await db.GuidanceProgressEvaluation.count({ where: { guidance_id: guidance.id, counted: true, superseded_at: null } }), 1);
  const progress = await getCurrentProgressForMahasiswa(student.id); assert.equal(progress.cycle.counted, 1); assert.equal(progress.policy.minimum_validated_sessions, 8);
  const researchDraft = await invoke(governance.createPolicy, { body: { kode_program_studi: "INFORMATIKA", program_kuliah: "reguler",
    jalur: "penelitian", periode_akademik_id: academic.id, minimum_validated_sessions: 2, count_scope: "cycle",
    occurrence_proof_mode: "approved_resume", supervisor_approval_scope: "p1" }, operationKey: `s7-policy-research-${suffix}` });
  const researchPolicy = researchDraft.payload.data; ids.policies.push(researchPolicy.id);
  const researchActivation = await invoke(governance.activatePolicy, { params: { id: researchPolicy.id },
    body: { expected_version: researchPolicy.row_version }, operationKey: `s7-policy-research-activate-${suffix}` });
  assert.equal(researchActivation.payload.recalculation_jobs_queued, 1);
  const evaluationsBeforeRead = await db.GuidanceProgressEvaluation.count({ where: { guidance_id: guidance.id } });
  const staleReads = await Promise.all([getCurrentProgressForMahasiswa(student.id), getCurrentProgressForMahasiswa(student.id)]);
  assert.equal(staleReads[0].evaluation_state.requires_recalculation, true);
  assert.equal(staleReads[0].cycle.counted, 1, "GET menampilkan evaluation terakhir selama rekalkulasi policy");
  assert.equal(staleReads[0].cycle.is_stale, true);
  assert.equal(await db.GuidanceProgressEvaluation.count({ where: { guidance_id: guidance.id } }), evaluationsBeforeRead);
  const recalculated = await Promise.all([recalculateCurrentProgressForMahasiswa(student.id), recalculateCurrentProgressForMahasiswa(student.id)]);
  const reevaluatedForPolicy = recalculated[0];
  assert.equal(recalculated[1].cycle.counted, 1);
  assert.equal(reevaluatedForPolicy.policy.id, researchPolicy.id); assert.equal(reevaluatedForPolicy.cycle.counted, 1);
  assert.equal((await db.GuidanceProgressEvaluation.findOne({ where: { guidance_id: guidance.id, superseded_at: null } })).policy_id, researchPolicy.id);
  const processedPolicyJob = await processProgressRecalculationJobOnce(); assert.ok(processedPolicyJob?.job_id);
  assert.equal((await db.GuidanceProgressRecalculationJob.findByPk(processedPolicyJob.job_id)).status, "completed");
  const events = await db.GuidanceEvent.findAll({ where: { guidance_id: guidance.id } });
  assert.deepEqual(events.map((event) => event.event_type), ["request_created", "request_accepted", "resume_submitted", "resume_approved"]);

  const pendingTransfer = await workflow.createRequest({ mahasiswaId: student.id, targetMemberId: members[1].id,
    pesan: "Resume kedua akan diselesaikan setelah penggantian P2.", tanggal: date, jam: "11:00", idempotencyKey: `s7-transfer-create-${suffix}` });
  ids.guidance.push(pendingTransfer.data.id);
  await workflow.decideRequest({ guidanceId: pendingTransfer.data.id, dosenId: dosens[1].id, action: "approve", catatan: "Jadwal disetujui",
    tanggal: date, jam: "11:00", lokasi: "Ruang 2", expectedVersion: 1, idempotencyKey: `s7-transfer-accept-${suffix}` });
  const transferGuidance = await db.BimbinganSkripsi.findByPk(pendingTransfer.data.id);
  await transferGuidance.update({ scheduled_at: new Date(Date.now() - 3600000), permintaan_tanggal: new Date(Date.now() - 86400000).toISOString().slice(0, 10) });
  await workflow.submitResumeVersion({ guidanceId: transferGuidance.id, mahasiswaId: student.id,
    resume: "Resume yang tetap menjadi histori P2 lama dan direview P2 pengganti.", expectedVersion: 2, idempotencyKey: `s7-transfer-resume-${suffix}` });
  const replacement = await db.PenetapanPembimbing.create({ mahasiswa_id: student.id, pendaftaran_penjaluran_id: registration.id,
    periode_mulai_id: period.id, semester_penjaluran_ke: 1, status: "draft", sumber_data: "pergantian", previous_assignment_id: assignment.id }); ids.assignments.push(replacement.id);
  const replacementMembers = await db.PenetapanPembimbingDosen.bulkCreate([dosens[0], dosens[2]].map((dosen, index) => ({ penetapan_pembimbing_id: replacement.id,
    dosen_id: dosen.id, urutan: index + 1, peran: index ? "pendamping" : "utama", status: "draft" })), { returning: true });
  await activateSupervisorAssignment({ penetapanId: replacement.id });
  await transferGuidance.reload();
  assert.equal(transferGuidance.target_assignment_member_id, members[1].id, "target P2 lama immutable");
  assert.equal(transferGuidance.effective_reviewer_assignment_member_id, replacementMembers[1].id, "reviewer berpindah ke P2 baru");
  assert.equal(await db.GuidanceReviewerTransfer.count({ where: { guidance_id: transferGuidance.id, transition_type: "supervisor_replacement" } }), 1);
  await assert.rejects(() => workflow.reviewResumeVersion({ guidanceId: transferGuidance.id, dosenId: dosens[1].id, action: "approve", catatan: "lama",
    expectedVersion: transferGuidance.row_version, idempotencyKey: `s7-old-reviewer-${suffix}` }), (error) => error.code === "GUIDANCE_REVIEWER_NOT_AUTHORIZED");
  await assert.rejects(() => workflow.reviewResumeVersion({ guidanceId: transferGuidance.id, dosenId: dosens[2].id, action: "delete", catatan: "tidak valid",
    expectedVersion: transferGuidance.row_version, idempotencyKey: `s7-invalid-review-${suffix}` }), (error) => error.code === "GUIDANCE_REVIEW_ACTION_INVALID");
  const replacementReview = await workflow.reviewResumeVersion({ guidanceId: transferGuidance.id, dosenId: dosens[2].id, action: "approve", catatan: "Disetujui P2 pengganti",
    expectedVersion: transferGuidance.row_version, idempotencyKey: `s7-new-reviewer-${suffix}` });
  assert.equal(replacementReview.data.is_counted, true);
  const historicalProgress = await getCurrentProgressForMahasiswa(student.id);
  assert.equal(historicalProgress.cycle.counted, 2, "review sah P2 lama tetap dihitung setelah transfer reviewer");
  const historicalEvaluation = await db.GuidanceProgressEvaluation.findOne({ where: { guidance_id: guidance.id, superseded_at: null } });
  assert.equal(historicalEvaluation.counted, true);

  const invalidated = await workflow.invalidateResumeApproval({ guidanceId: transferGuidance.id, actorId: 1,
    reason: "Approval dibatalkan karena bukti sesi perlu diverifikasi ulang.", expectedVersion: replacementReview.data.row_version,
    idempotencyKey: `s7-invalidate-${suffix}` });
  assert.equal(invalidated.data.is_counted, false);
  assert.equal((await db.GuidanceResumeVersion.findByPk(transferGuidance.current_resume_version_id)).status, "invalidated");

  // Transisi semester mempertahankan assignment asal, tetapi memindahkan reviewer efektif sesuai urutan P2.
  const semesterDate = new Date(Date.now() + 8 * 86400000).toISOString().slice(0, 10);
  const semesterGuidanceCreated = await workflow.createRequest({ mahasiswaId: student.id, targetDosenId: dosens[2].id,
    pesan: "Resume menunggu review ketika assignment berganti semester.", tanggal: semesterDate, jam: "15:00", idempotencyKey: `s7-semester-create-${suffix}` });
  ids.guidance.push(semesterGuidanceCreated.data.id);
  await workflow.decideRequest({ guidanceId: semesterGuidanceCreated.data.id, dosenId: dosens[2].id, action: "approve", catatan: "Jadwal disetujui",
    tanggal: semesterDate, jam: "15:00", lokasi: "Ruang semester", expectedVersion: 1, idempotencyKey: `s7-semester-accept-${suffix}` });
  const semesterGuidance = await db.BimbinganSkripsi.findByPk(semesterGuidanceCreated.data.id);
  await semesterGuidance.update({ scheduled_at: new Date(Date.now() - 3600000), permintaan_tanggal: new Date(Date.now() - 86400000).toISOString().slice(0, 10) });
  await workflow.submitResumeVersion({ guidanceId: semesterGuidance.id, mahasiswaId: student.id, resume: "Resume tetap terikat semester asal.",
    expectedVersion: 2, idempotencyKey: `s7-semester-resume-${suffix}` });
  const carried = await db.PenetapanPembimbing.create({ mahasiswa_id: student.id, pendaftaran_penjaluran_id: registration.id,
    periode_mulai_id: period.id, semester_penjaluran_ke: 2, status: "draft", sumber_data: "perpanjangan", previous_assignment_id: replacement.id }); ids.assignments.push(carried.id);
  const carriedMembers = await db.PenetapanPembimbingDosen.bulkCreate([dosens[0], dosens[2]].map((dosen, index) => ({ penetapan_pembimbing_id: carried.id,
    dosen_id: dosen.id, urutan: index + 1, peran: index ? "pendamping" : "utama", status: "draft" })), { returning: true });
  await activateSupervisorAssignment({ penetapanId: carried.id }); await semesterGuidance.reload();
  assert.equal(semesterGuidance.target_assignment_id, replacement.id);
  assert.equal(semesterGuidance.effective_reviewer_assignment_id, carried.id);
  assert.equal(semesterGuidance.effective_reviewer_assignment_member_id, carriedMembers[1].id);
  assert.equal(await db.GuidanceReviewerTransfer.count({ where: { guidance_id: semesterGuidance.id, transition_type: "semester_transition" } }), 1);

  // Magang, Perintisan, siklus ulang, dan alih memakai context assignment yang sama kuatnya.
  const matrix = [
    { cycle: "baru", track: "magang" },
    { cycle: "baru", track: "perintisan_bisnis" },
    { cycle: "ulang", track: "penelitian" },
    { cycle: "alih", track: "magang", previous: "penelitian" },
  ];
  let offset = 2;
  for (const item of matrix) {
    const matrixStudent = await db.Mahasiswa.create({ nim: `M${offset}${suffix}`.slice(0, 10), nama: `Mahasiswa ${item.cycle} ${item.track}`,
      email: `s7.matrix.${suffix}.${offset}@test.local`, password: "test", status_jalur_saat_ini: item.track }, { hooks: false }); ids.students.push(matrixStudent.id);
    const matrixRegistration = await db.PendaftaranPenjaluran.create({ mahasiswa_id: matrixStudent.id, periode_penjaluran_id: period.id,
      jalur: item.cycle, program_kuliah: offset % 2 ? "internasional" : "reguler", semester_mahasiswa: 7, status: "approved",
      jenis_jalur_diambil: item.cycle === "alih" ? null : item.track, penjaluran_sebelumnya: item.previous || null,
      penjaluran_baru: item.cycle === "alih" ? item.track : null, form_lanjutan_status: "approved" }); ids.registrations.push(matrixRegistration.id);
    const matrixAssignment = await db.PenetapanPembimbing.create({ mahasiswa_id: matrixStudent.id, pendaftaran_penjaluran_id: matrixRegistration.id,
      periode_mulai_id: period.id, semester_penjaluran_ke: 1, tanggal_mulai: new Date(), status: "active", sumber_data: "penjaluran" }); ids.assignments.push(matrixAssignment.id);
    const [matrixMember] = await db.PenetapanPembimbingDosen.bulkCreate([{ penetapan_pembimbing_id: matrixAssignment.id, dosen_id: dosens[0].id,
      urutan: 1, peran: "utama", status: "active", tanggal_mulai: new Date() }], { returning: true });
    const matrixDate = new Date(Date.now() + (offset + 2) * 86400000).toISOString().slice(0, 10);
    const matrixGuidance = await workflow.createRequest({ mahasiswaId: matrixStudent.id, targetMemberId: matrixMember.id,
      pesan: `Pengujian jalur ${item.track} pada siklus ${item.cycle}.`, tanggal: matrixDate, jam: "09:00", idempotencyKey: `s7-matrix-${suffix}-${offset}` });
    ids.guidance.push(matrixGuidance.data.id); assert.equal(matrixGuidance.data.jalur_snapshot, item.track); assert.equal(matrixGuidance.data.cycle_type_snapshot, item.cycle);
    offset += 1;
  }

  // Status P1/P2 dinilai per target: P1 aktif tetap dapat dipilih, P2 yang tidak boleh melanjutkan ditolak.
  await dosens[2].update({ status_keaktifan: "study_leave", continue_existing_supervision: false });
  const statusDate = new Date(Date.now() + 9 * 86400000).toISOString().slice(0, 10);
  await assert.rejects(() => workflow.createRequest({ mahasiswaId: student.id, targetDosenId: dosens[2].id,
    pesan: "P2 sedang tugas belajar dan tidak boleh melanjutkan.", tanggal: statusDate, jam: "09:00", idempotencyKey: `s7-status-p2-${suffix}` }),
  (error) => error.code === "GUIDANCE_REVIEWER_UNAVAILABLE");
  const p1Allowed = await workflow.createRequest({ mahasiswaId: student.id, targetDosenId: dosens[0].id,
    pesan: "P1 aktif tetap dapat menerima permohonan.", tanggal: statusDate, jam: "10:00", idempotencyKey: `s7-status-p1-${suffix}` });
  ids.guidance.push(p1Allowed.data.id); await dosens[2].update({ status_keaktifan: "active", continue_existing_supervision: true });
  await dosens[0].update({ status_keaktifan: "inactive", continue_existing_supervision: false });
  await assert.rejects(() => workflow.decideRequest({ guidanceId: p1Allowed.data.id, dosenId: dosens[0].id, action: "approve", catatan: "Ditahan status",
    tanggal: statusDate, jam: "10:00", lokasi: "Ruang", expectedVersion: 1, idempotencyKey: `s7-status-write-${suffix}` }),
  (error) => error.code === "GUIDANCE_REVIEWER_CAPABILITY_DENIED");
  await dosens[0].update({ status_keaktifan: "active", continue_existing_supervision: true });
  const activeP1Member = await db.PenetapanPembimbingDosen.findOne({ where: { penetapan_pembimbing_id: carried.id, dosen_id: dosens[0].id } });
  await activeP1Member.update({ status: "ended", tanggal_selesai: null });
  await assert.rejects(() => workflow.decideRequest({ guidanceId: p1Allowed.data.id, dosenId: dosens[0].id, action: "approve", catatan: "Ditahan assignment",
    tanggal: statusDate, jam: "10:00", lokasi: "Ruang", expectedVersion: 1, idempotencyKey: `s7-member-write-${suffix}` }),
  (error) => error.code === "GUIDANCE_REVIEWER_ASSIGNMENT_INACTIVE");
  await activeP1Member.update({ status: "active", tanggal_selesai: null });

  // Lock assignment menserialisasi dua create untuk slot sama: tepat satu transaksi berhasil.
  const concurrentDate = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
  const concurrent = await Promise.allSettled(["a", "b"].map((tag) => workflow.createRequest({ mahasiswaId: student.id, targetDosenId: dosens[0].id,
    pesan: "Permohonan konkuren pada slot yang sama.", tanggal: concurrentDate, jam: "13:00", idempotencyKey: `s7-concurrent-${suffix}-${tag}` })));
  const fulfilled = concurrent.filter((result) => result.status === "fulfilled"); const rejected = concurrent.filter((result) => result.status === "rejected");
  assert.equal(fulfilled.length, 1); assert.equal(rejected.length, 1); assert.equal(rejected[0].reason.code, "GUIDANCE_DUPLICATE_SLOT"); ids.guidance.push(fulfilled[0].value.data.id);

  // Dua command identik dengan key yang sama harus berakhir sebagai hasil + replay, bukan unique violation/500.
  const sameKeyDate = new Date(Date.now() + 11 * 86400000).toISOString().slice(0, 10);
  const sameKeyPayload = { mahasiswaId: student.id, targetDosenId: dosens[0].id, pesan: "Retry paralel dengan key identik.",
    tanggal: sameKeyDate, jam: "14:00", idempotencyKey: `s7-parallel-same-key-${suffix}` };
  const sameKeyResults = await Promise.all([workflow.createRequest(sameKeyPayload), workflow.createRequest(sameKeyPayload)]);
  assert.equal(sameKeyResults[0].data.id, sameKeyResults[1].data.id);
  assert.equal(sameKeyResults.filter((result) => result.replayed).length, 1); ids.guidance.push(sameKeyResults[0].data.id);

  assert.equal(readiness.mode(), "shadow");
  await assert.rejects(() => readiness.decideReadiness({ readinessId: 0, dosenId: dosens[0].id, decision: "unexpected",
    expectedVersion: 1, idempotencyKey: `s7-readiness-invalid-${suffix}` }), (error) => error.code === "GUIDANCE_READINESS_DECISION_INVALID");
  await assert.rejects(() => readiness.decideReadiness({ readinessId: 0, dosenId: dosens[0].id, decision: "approved",
    expectedVersion: 1, idempotencyKey: `s7-readiness-shadow-${suffix}` }), (error) => error.code === "GUIDANCE_READINESS_POLICY_PENDING");

  // Bila urutan reviewer lama tidak tersedia, workflow membuat antrean resolusi, event, dan notifikasi kedua pihak.
  const unresolvedDate = new Date(Date.now() + 12 * 86400000).toISOString().slice(0, 10);
  const unresolvedCreated = await workflow.createRequest({ mahasiswaId: student.id, targetDosenId: dosens[2].id,
    pesan: "Resume P2 memerlukan resolusi ketika P2 tidak diganti.", tanggal: unresolvedDate, jam: "15:00", idempotencyKey: `s7-unresolved-create-${suffix}` });
  ids.guidance.push(unresolvedCreated.data.id);
  await workflow.decideRequest({ guidanceId: unresolvedCreated.data.id, dosenId: dosens[2].id, action: "approve", catatan: "Jadwal disetujui",
    tanggal: unresolvedDate, jam: "15:00", lokasi: "Ruang", expectedVersion: 1, idempotencyKey: `s7-unresolved-accept-${suffix}` });
  const unresolvedRow = await db.BimbinganSkripsi.findByPk(unresolvedCreated.data.id);
  await unresolvedRow.update({ scheduled_at: new Date(Date.now() - 3600000), permintaan_tanggal: new Date(Date.now() - 86400000).toISOString().slice(0, 10) });
  await workflow.submitResumeVersion({ guidanceId: unresolvedRow.id, mahasiswaId: student.id, resume: "Resume menunggu reviewer pengganti.",
    expectedVersion: 2, idempotencyKey: `s7-unresolved-resume-${suffix}` });
  const sameDayPast = await workflow.createRequest({ mahasiswaId: student.id, targetDosenId: dosens[0].id,
    pesan: "Sesi hari ini yang telah lewat tidak boleh dianggap sesi mendatang.", tanggal: unresolvedDate, jam: "16:00",
    idempotencyKey: `s7-same-day-past-${suffix}` }); ids.guidance.push(sameDayPast.data.id);
  await db.BimbinganSkripsi.update({ scheduled_at: new Date(Date.now() - 3600000),
    permintaan_tanggal: new Date().toISOString().slice(0, 10) }, { where: { id: sameDayPast.data.id } });
  const p1Only = await db.PenetapanPembimbing.create({ mahasiswa_id: student.id, pendaftaran_penjaluran_id: registration.id,
    periode_mulai_id: period.id, semester_penjaluran_ke: 2, status: "draft", sumber_data: "pergantian", previous_assignment_id: carried.id,
    created_by_sekretaris_id: secretary.id }); ids.assignments.push(p1Only.id);
  await db.PenetapanPembimbingDosen.create({ penetapan_pembimbing_id: p1Only.id, dosen_id: dosens[0].id, urutan: 1,
    peran: "utama", status: "draft" });
  await activateSupervisorAssignment({ penetapanId: p1Only.id }); await unresolvedRow.reload();
  assert.equal((await db.BimbinganSkripsi.findByPk(sameDayPast.data.id)).request_status, "pending");
  const p1OnlyMember = await db.PenetapanPembimbingDosen.findOne({ where: { penetapan_pembimbing_id: p1Only.id } });
  assert.equal(unresolvedRow.reviewer_resolution_status, "resolved");
  assert.equal(unresolvedRow.reviewer_resolution_reason_code, null);
  assert.equal(unresolvedRow.effective_reviewer_assignment_member_id, p1OnlyMember.id);
  const automaticTransfer = await db.GuidanceReviewerTransfer.findOne({ where: { guidance_id: unresolvedRow.id, transition_type: "supervisor_replacement" } });
  assert.equal(automaticTransfer.reason_code, "CROSS_ROLE_SYSTEM_FALLBACK_TO_P1");
  const automaticEvent = await db.GuidanceEvent.findByPk(automaticTransfer.event_id);
  assert.equal(automaticEvent.metadata.from_urutan, 2); assert.equal(automaticEvent.metadata.to_urutan, 1);
  assert.equal(automaticEvent.metadata.cross_role_system_fallback, true);

  // Backfill execute dapat diulang tanpa menggandakan resume, evaluation, atau event audit.
  const backfillLegacy = await db.BimbinganSkripsi.create({ mahasiswa_id: student.id, dosen_id: dosens[0].id,
    penetapan_pembimbing_id: p1Only.id, permintaan_pesan: "Legacy untuk uji rerun backfill", permintaan_tanggal: new Date(),
    permintaan_jam: "07:00", status_permohonan: "approved", status_resume: "approved", resume_mahasiswa: "Resume legacy yang disetujui.",
    tanggal_review_resume: new Date(), reviewer_dosen_id: dosens[0].id, is_counted: true, legacy_context_status: "ambiguous" });
  ids.guidance.push(backfillLegacy.id);
  const backfillArgs = ["scripts/backfill-stage7-guidance.js", "--execute", "--batch-size=1", `--after-id=${backfillLegacy.id - 1}`];
  execFileSync(process.execPath, backfillArgs, { cwd: require("node:path").resolve(__dirname, ".."), env: { ...process.env, NODE_ENV: "test" } });
  const backfillCounts = { versions: await db.GuidanceResumeVersion.count({ where: { guidance_id: backfillLegacy.id } }),
    evaluations: await db.GuidanceProgressEvaluation.count({ where: { guidance_id: backfillLegacy.id } }),
    events: await db.GuidanceEvent.count({ where: { guidance_id: backfillLegacy.id, event_type: "legacy_backfill_classified" } }) };
  execFileSync(process.execPath, backfillArgs, { cwd: require("node:path").resolve(__dirname, ".."), env: { ...process.env, NODE_ENV: "test" } });
  assert.deepEqual({ versions: await db.GuidanceResumeVersion.count({ where: { guidance_id: backfillLegacy.id } }),
    evaluations: await db.GuidanceProgressEvaluation.count({ where: { guidance_id: backfillLegacy.id } }),
    events: await db.GuidanceEvent.count({ where: { guidance_id: backfillLegacy.id, event_type: "legacy_backfill_classified" } }) }, backfillCounts);

  // Pengabdian tetap read-only: histori legacy terbaca, sedangkan create workflow baru ditolak.
  const holdStudent = await db.Mahasiswa.create({ nim: `H${suffix}`.slice(0, 10), nama: "Mahasiswa Pengabdian Hold",
    email: `s7.hold.${suffix}@test.local`, password: "test", status_jalur_saat_ini: "baru" }, { hooks: false }); ids.students.push(holdStudent.id);
  const holdRegistration = await db.PendaftaranPenjaluran.create({ mahasiswa_id: holdStudent.id, periode_penjaluran_id: period.id, jalur: "baru",
    program_kuliah: "reguler", semester_mahasiswa: 7, status: "approved", jenis_jalur_diambil: "pengabdian", form_lanjutan_status: "approved" }); ids.registrations.push(holdRegistration.id);
  const holdAssignment = await db.PenetapanPembimbing.create({ mahasiswa_id: holdStudent.id, pendaftaran_penjaluran_id: holdRegistration.id,
    periode_mulai_id: period.id, semester_penjaluran_ke: 1, tanggal_mulai: new Date(), status: "active", sumber_data: "penjaluran" }); ids.assignments.push(holdAssignment.id);
  const [holdMember] = await db.PenetapanPembimbingDosen.bulkCreate([{ penetapan_pembimbing_id: holdAssignment.id, dosen_id: dosens[0].id,
    urutan: 1, peran: "utama", status: "active", tanggal_mulai: new Date() }], { returning: true });
  const legacy = await db.BimbinganSkripsi.create({ mahasiswa_id: holdStudent.id, dosen_id: dosens[0].id, permintaan_pesan: "Histori lama",
    permintaan_tanggal: new Date(), permintaan_jam: "08:00", status_permohonan: "approved", status_resume: "approved", legacy_context_status: "ambiguous" }); ids.guidance.push(legacy.id);
  await assert.rejects(() => workflow.createRequest({ mahasiswaId: holdStudent.id, targetMemberId: holdMember.id, pesan: "Create baru harus ditolak.",
    tanggal: statusDate, jam: "11:00", idempotencyKey: `s7-hold-${suffix}` }), (error) => error.code === "GUIDANCE_TRACK_NOT_ENABLED");
  assert.equal((await db.BimbinganSkripsi.findAll({ where: { mahasiswa_id: holdStudent.id } })).length, 1);
  await assert.rejects(() => db.BimbinganSkripsi.create({ mahasiswa_id: holdStudent.id, dosen_id: dosens[0].id, permintaan_pesan: "Context palsu",
    permintaan_tanggal: new Date(), permintaan_jam: "12:00", status_permohonan: "pending", status_resume: "belum_diisi", legacy_context_status: "resolved" }),
  (error) => error.name === "SequelizeDatabaseError");
});
