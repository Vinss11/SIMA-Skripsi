"use strict";

process.env.NODE_ENV = "test";
require("dotenv").config();

const test = require("node:test");
const assert = require("node:assert/strict");
const { Op } = require("sequelize");
const {
  sequelize,
  Mahasiswa,
  Dosen,
  SekretarisProdi,
  PeriodePenjaluran,
  PeriodeAkademik,
  PendaftaranPenjaluran,
  DosenKetersediaanPeriode,
  PenetapanPembimbing,
  PenetapanPembimbingDosen,
  IzinLanjutSkripsi,
  Notifikasi,
  BimbinganSkripsi,
  KelompokPerintisanBisnis,
  AnggotaKelompokPerintisan,
} = require("../models");
const { replaceSupervisorAssignment, getActiveSupervisorAssignment } = require("../services/penetapanPembimbingService");
const {
  previewSemesterTransitions,
  carryForwardSemesterAssignment,
  activateScheduledAssignments,
} = require("../services/semesterAssignmentService");
const { submitExtensionRequest, decideExtensionAndTransitionSemester } = require("../services/extensionTransitionService");
const { buildSemesterLanjutanGate } = require("../services/semesterLanjutanService");
const assignmentController = require("../controllers/penetapanPembimbingController");
const jalurController = require("../controllers/jalurController");
const dosenController = require("../controllers/dosenController");

async function invokeController(handler, req) {
  const response = { statusCode: 200, payload: null };
  const res = {
    status(code) { response.statusCode = code; return this; },
    json(payload) { response.payload = payload; return payload; },
  };
  await handler(req, res);
  return response;
}

test("Tahap 4: carry-forward dan izin semester 3 membentuk assignment per semester secara idempoten", async (t) => {
  const suffix = `${Date.now()}`.slice(-8);
  const ids = { students: [], dosens: [], periods: [], academicPeriods: [], registrations: [], groups: [] };

  t.after(async () => {
    const assignments = await PenetapanPembimbing.findAll({ where: { mahasiswa_id: { [Op.in]: ids.students } }, attributes: ["id"] });
    const assignmentIds = assignments.map((row) => row.id);
    await BimbinganSkripsi.destroy({ where: { mahasiswa_id: { [Op.in]: ids.students } }, force: true });
    await PenetapanPembimbing.update({ izin_lanjut_id: null }, { where: { id: { [Op.in]: assignmentIds } } });
    await IzinLanjutSkripsi.update({ penetapan_hasil_id: null, penetapan_asal_id: null }, { where: { mahasiswa_id: { [Op.in]: ids.students } } });
    await IzinLanjutSkripsi.destroy({ where: { mahasiswa_id: { [Op.in]: ids.students } }, force: true });
    await Notifikasi.destroy({ where: { [Op.or]: [
      { recipient_type: "mahasiswa", recipient_id: { [Op.in]: ids.students } },
      { recipient_type: "dosen", recipient_id: { [Op.in]: ids.dosens } },
      { reference_type: "kelompok_perintisan_bisnis", reference_id: { [Op.in]: ids.groups } },
    ] }, force: true });
    await PenetapanPembimbingDosen.destroy({ where: { penetapan_pembimbing_id: { [Op.in]: assignmentIds } }, force: true });
    await PenetapanPembimbing.destroy({ where: { id: { [Op.in]: assignmentIds } }, force: true });
    await AnggotaKelompokPerintisan.destroy({ where: { kelompok_id: { [Op.in]: ids.groups } }, force: true });
    await KelompokPerintisanBisnis.destroy({ where: { id: { [Op.in]: ids.groups } }, force: true });
    await PendaftaranPenjaluran.destroy({ where: { id: { [Op.in]: ids.registrations } }, force: true });
    await DosenKetersediaanPeriode.destroy({ where: { periode_penjaluran_id: { [Op.in]: ids.periods } }, force: true });
    await Mahasiswa.destroy({ where: { id: { [Op.in]: ids.students } }, force: true });
    await Dosen.destroy({ where: { id: { [Op.in]: ids.dosens } }, force: true });
    await PeriodePenjaluran.destroy({ where: { id: { [Op.in]: ids.periods } }, force: true });
    await PeriodeAkademik.destroy({ where: { id: { [Op.in]: ids.academicPeriods } }, force: true });
    await SekretarisProdi.destroy({ where: { email: `stage4.${suffix}@test.local` }, force: true });
    await sequelize.close();
  });

  const sekretaris = await SekretarisProdi.create({
    nik: `S4${suffix}`.slice(0, 9), nama: "Sekretaris Stage 4", email: `stage4.${suffix}@test.local`, password: "test-password",
  }, { hooks: false });
  const academicBaseYear = 3000 + Number(suffix.slice(-3));
  const transitionStart = new Date(Date.now() + 2 * 86400000);
  transitionStart.setUTCHours(0, 0, 0, 0);
  const sourceAcademicStart = new Date(transitionStart.getTime() - 180 * 86400000);
  const followingAcademicStart = new Date(transitionStart.getTime() + 180 * 86400000);
  const transitionEffectiveIso = transitionStart.toISOString();
  const activationTime = new Date(transitionStart.getTime() + 86400000);
  const periodDefinitions = [
    [`${academicBaseYear}/${academicBaseYear + 1}`, "genap", sourceAcademicStart],
    [`${academicBaseYear + 1}/${academicBaseYear + 2}`, "ganjil", transitionStart],
    [`${academicBaseYear + 1}/${academicBaseYear + 2}`, "genap", followingAcademicStart],
  ];
  const periods = [];
  const academicPeriods = [];
  for (const [periodIndex, [year, semester, start]] of periodDefinitions.entries()) {
    const academic = await PeriodeAkademik.create({
      kode: `STAGE4-${suffix}-${semester}-${year.replace("/", "-")}`,
      tahun_akademik: year,
      semester,
      tanggal_mulai: new Date(start),
      tanggal_selesai: new Date(new Date(start).getTime() + 120 * 86400000),
      status: periodIndex === 0 ? "active" : "draft",
      sumber: "integration_test",
      metadata: {},
    });
    academicPeriods.push(academic); ids.academicPeriods.push(academic.id);
    const period = await PeriodePenjaluran.create({
      tahun_akademik: year, semester, label_periode: `Stage4 ${suffix} ${semester} ${year}`,
      status: "closed", is_active: false, tanggal_mulai: new Date(start), tanggal_selesai: new Date(new Date(start).getTime() + 30 * 86400000),
      periode_akademik_id: academic.id,
    });
    periods.push(period); ids.periods.push(period.id);
  }
  const dosens = [];
  for (let index = 1; index <= 2; index += 1) {
    const dosen = await Dosen.create({
      kode_dosen: `S4${suffix}${index}`, nik: `${index}${suffix}`.slice(0, 9), nama: `Dosen Stage4 ${index}`,
      email: `stage4.dosen.${suffix}.${index}@test.local`, password: "test-password", kuota_bimbingan: 10,
      status_keaktifan: "active", account_is_active: true, continue_existing_supervision: true,
    }, { hooks: false });
    dosens.push(dosen); ids.dosens.push(dosen.id);
    for (const period of periods) {
      await DosenKetersediaanPeriode.create({
        dosen_id: dosen.id, periode_penjaluran_id: period.id, tersedia_membimbing: true,
        configuration_status: "ready", reviewed_at: new Date(), reviewed_by_sekretaris_id: sekretaris.id,
        updated_by_sekretaris_id: sekretaris.id,
      });
    }
  }
  const student = await Mahasiswa.create({
    nim: `S4${suffix}`, nama: "Mahasiswa Stage 4", email: `stage4.student.${suffix}@test.local`, password: "test-password", status_jalur_saat_ini: "penelitian",
  }, { hooks: false });
  ids.students.push(student.id);
  const registration = await PendaftaranPenjaluran.create({
    mahasiswa_id: student.id, periode_penjaluran_id: periods[0].id, jalur: "baru", program_kuliah: "reguler",
    semester_mahasiswa: 7, status: "approved", jenis_jalur_diambil: "penelitian", reviewed_by_sekretaris_id: sekretaris.id, reviewed_at: new Date(),
  });
  ids.registrations.push(registration.id);

  const initial = await replaceSupervisorAssignment({
    mahasiswaId: student.id, pendaftaranPenjaluranId: registration.id, periodeMulaiId: periods[0].id,
    semesterPenjaluranKe: 1, dosenPembimbingIds: dosens.map((item) => item.id), createdBySekretarisId: sekretaris.id,
  });
  const preview = await previewSemesterTransitions({ sourcePeriodId: periods[0].id, targetPeriodId: periods[1].id });
  assert.equal(preview.summary.ready, 1);

  const invalidDateResponse = await invokeController(assignmentController.confirmSemesterTransition, {
    user: { id: sekretaris.id, role: "sekretaris_prodi" },
    body: { expected_assignment_id: initial.penetapan.id, target_period_id: periods[1].id,
      effective_at: new Date(transitionStart.getTime() - 86400000).toISOString() },
    get(name) { return name === "Idempotency-Key" ? `stage4-invalid-date-${suffix}` : null; },
  });
  assert.equal(invalidDateResponse.statusCode, 409);
  assert.equal(invalidDateResponse.payload.code, "ASSIGNMENT_EFFECTIVE_DATE_INVALID");

  const initialAssignment = await PenetapanPembimbing.findByPk(initial.penetapan.id);
  const originalSourceStart = initialAssignment.tanggal_mulai;
  await initialAssignment.update({ tanggal_mulai: new Date(transitionStart.getTime() + 3600000) });
  const beforeSourceStartResponse = await invokeController(assignmentController.confirmSemesterTransition, {
    user: { id: sekretaris.id, role: "sekretaris_prodi" },
    body: { expected_assignment_id: initial.penetapan.id, target_period_id: periods[1].id, effective_at: transitionEffectiveIso },
    get(name) { return name === "Idempotency-Key" ? `stage4-before-source-start-${suffix}` : null; },
  });
  assert.equal(beforeSourceStartResponse.statusCode, 409);
  assert.equal(beforeSourceStartResponse.payload.code, "ASSIGNMENT_EFFECTIVE_DATE_INVALID");
  await initialAssignment.update({ tanggal_mulai: originalSourceStart });

  const endpointResponse = await invokeController(assignmentController.confirmSemesterTransition, {
    user: { id: sekretaris.id, role: "sekretaris_prodi" },
    body: {
      expected_assignment_id: initial.penetapan.id,
      target_period_id: periods[1].id,
      effective_at: transitionEffectiveIso,
    },
    get(name) { return name === "Idempotency-Key" ? `stage4-carry-${suffix}` : null; },
  });
  assert.equal(endpointResponse.statusCode, 201);
  assert.equal(endpointResponse.payload.success, true);
  const scheduled = endpointResponse.payload.data;
  assert.equal(scheduled.scheduled, true);
  assert.equal(scheduled.assignment.status, "scheduled");
  assert.equal((await getActiveSupervisorAssignment(student.id)).penetapan.id, initial.penetapan.id);

  const replay = await carryForwardSemesterAssignment({
    expectedAssignmentId: initial.penetapan.id, targetPeriodId: periods[1].id,
    effectiveAt: transitionEffectiveIso, idempotencyKey: `stage4-carry-${suffix}`,
    actorId: sekretaris.id,
  });
  assert.equal(replay.replayed, true);
  assert.equal(replay.assignment.id, scheduled.assignment.id);

  await dosens[1].update({ status_keaktifan: "study_leave", continue_existing_supervision: false });
  const failedActivation = await activateScheduledAssignments({ now: activationTime });
  assert.ok(failedActivation.failed.some((item) => Number(item.id) === Number(scheduled.assignment.id)));
  assert.equal((await PenetapanPembimbing.findByPk(scheduled.assignment.id)).status, "scheduled");
  await dosens[1].update({ status_keaktifan: "active", continue_existing_supervision: true });
  const retriedActivation = await activateScheduledAssignments({ now: activationTime });
  assert.ok(retriedActivation.activated.includes(scheduled.assignment.id));
  const endedFirst = await PenetapanPembimbing.findByPk(initial.penetapan.id);
  assert.equal(endedFirst.status, "ended");
  assert.equal(endedFirst.end_reason_code, "semester_carried_forward");
  const activeSecond = await PenetapanPembimbing.findByPk(scheduled.assignment.id);
  assert.equal(activeSecond.status, "active");
  // Worker diuji dengan clock eksplisit; selaraskan effective_at agar lookup berbasis clock proses melihat assignment aktif.
  await activeSecond.update({ effective_at: new Date(Date.now() - 86400000) });

  const semesterTwoGate = await buildSemesterLanjutanGate(student.id);
  assert.equal(semesterTwoGate.semester_penjaluran_aktif, 2);
  assert.equal(semesterTwoGate.is_locked, false);
  assert.equal(semesterTwoGate.can_submit_izin, false);
  assert.equal(semesterTwoGate.reason, "jendela_izin_belum_dibuka");
  const extensionTargetStart = new Date(Date.now() + 20 * 86400000);
  await academicPeriods[2].update({
    tanggal_mulai: extensionTargetStart,
    tanggal_selesai: new Date(extensionTargetStart.getTime() + 120 * 86400000),
  });
  const openSemesterTwoGate = await buildSemesterLanjutanGate(student.id);
  assert.equal(openSemesterTwoGate.can_submit_izin, true);
  assert.equal(openSemesterTwoGate.reason, "semester_dua_dapat_mengajukan_izin");

  const extensionRequests = await Promise.all([1, 2].map(() => submitExtensionRequest({
    mahasiswaId: student.id, alasanPengajuan: "Progres penelitian masih berjalan dan perlu diselesaikan.", idempotencyKey: `stage4-extension-${suffix}`,
  })));
  const extension = extensionRequests.find((item) => !item.replayed);
  assert.ok(extensionRequests.some((item) => item.replayed));
  assert.equal(extension.izin.penetapan_asal_id, scheduled.assignment.id);
  assert.equal(extension.izin.semester_penjaluran_ke, 3);
  assert.equal(await Notifikasi.count({ where: { reference_type: "izin_lanjut_skripsi", reference_id: extension.izin.id } }), 2);
  await assert.rejects(
    decideExtensionAndTransitionSemester({
      izinId: extension.izin.id, reviewerDosenId: dosens[1].id, decision: "approved",
      note: "Tidak berwenang.", idempotencyKey: `stage4-p2-${suffix}`,
    }),
    (error) => error.code === "EXTENSION_REVIEWER_FORBIDDEN"
  );
  const decision = await decideExtensionAndTransitionSemester({
    izinId: extension.izin.id, reviewerDosenId: dosens[0].id, decision: "approved",
    note: "Progres layak dilanjutkan.", idempotencyKey: `stage4-decision-${suffix}`,
  });
  assert.equal(decision.izin.status, "approved");
  assert.equal(decision.assignment.semester_penjaluran_ke, 3);
  assert.equal(decision.assignment.status, "scheduled");
  assert.equal(Number(decision.izin.penetapan_hasil_id), decision.assignment.id);

  const decisionReplay = await decideExtensionAndTransitionSemester({
    izinId: extension.izin.id, reviewerDosenId: dosens[0].id, decision: "approved",
    note: "Progres layak dilanjutkan.", idempotencyKey: `stage4-decision-${suffix}`,
  });
  assert.equal(decisionReplay.replayed, true);
  assert.equal(decisionReplay.assignment.id, decision.assignment.id);
  await assert.rejects(
    decideExtensionAndTransitionSemester({
      izinId: extension.izin.id, reviewerDosenId: dosens[0].id, decision: "approved",
      note: "Catatan berbeda.", idempotencyKey: `stage4-decision-${suffix}`,
    }),
    (error) => error.code === "EXTENSION_DECISION_IDEMPOTENCY_CONFLICT"
  );
  await assert.rejects(
    decideExtensionAndTransitionSemester({
      izinId: extension.izin.id, reviewerDosenId: dosens[0].id, decision: "approved",
      note: "Progres layak dilanjutkan.", idempotencyKey: `stage4-decision-other-${suffix}`,
    }),
    (error) => error.code === "EXTENSION_DECISION_IDEMPOTENCY_CONFLICT"
  );
  assert.equal(await Notifikasi.count({ where: { reference_type: "izin_lanjut_skripsi", reference_id: extension.izin.id } }), 5);

  const rejectedStudent = await Mahasiswa.create({
    nim: `S4R${suffix}`, nama: "Mahasiswa Ditolak Stage 4", email: `stage4.rejected.${suffix}@test.local`, password: "test-password", status_jalur_saat_ini: "penelitian",
  }, { hooks: false });
  ids.students.push(rejectedStudent.id);
  const rejectedRegistration = await PendaftaranPenjaluran.create({
    mahasiswa_id: rejectedStudent.id, periode_penjaluran_id: periods[1].id, jalur: "baru", program_kuliah: "reguler",
    semester_mahasiswa: 8, status: "approved", jenis_jalur_diambil: "penelitian", reviewed_by_sekretaris_id: sekretaris.id, reviewed_at: new Date(),
  });
  ids.registrations.push(rejectedRegistration.id);
  const rejectedSource = await replaceSupervisorAssignment({
    mahasiswaId: rejectedStudent.id, pendaftaranPenjaluranId: rejectedRegistration.id, periodeMulaiId: periods[1].id,
    semesterPenjaluranKe: 2, dosenPembimbingIds: dosens.map((item) => item.id), createdBySekretarisId: sekretaris.id,
  });
  const pendingGuidance = await BimbinganSkripsi.create({
    mahasiswa_id: rejectedStudent.id, dosen_id: dosens[0].id,
    pendaftaran_penjaluran_id: rejectedRegistration.id, penetapan_pembimbing_id: rejectedSource.penetapan.id,
    permintaan_pesan: "Mohon jadwal bimbingan.", permintaan_tanggal: "2026-07-01", permintaan_jam: "09:00", status_permohonan: "pending",
  });
  const rejectedExtension = await submitExtensionRequest({
    mahasiswaId: rejectedStudent.id, alasanPengajuan: "Masih memerlukan waktu untuk menyelesaikan penelitian.", idempotencyKey: `stage4-reject-request-${suffix}`,
  });
  const rejectedDecision = await decideExtensionAndTransitionSemester({
    izinId: rejectedExtension.izin.id, reviewerDosenId: dosens[0].id, decision: "rejected",
    note: "Progres belum memenuhi syarat.", idempotencyKey: `stage4-reject-decision-${suffix}`,
  });
  assert.equal(rejectedDecision.izin.status, "rejected");
  await pendingGuidance.reload();
  assert.equal(pendingGuidance.status_permohonan, "expired");
  assert.equal((await PenetapanPembimbing.findByPk(rejectedSource.penetapan.id)).status, "ended");

  const invalidThirdStudent = await Mahasiswa.create({
    nim: `S4T${suffix}`, nama: "Mahasiswa Semester Tiga Tanpa Izin",
    email: `stage4.third.${suffix}@test.local`, password: "test-password",
    status_jalur_saat_ini: "penelitian", dosen_pembimbing_skripsi_id: dosens[0].id,
  }, { hooks: false });
  ids.students.push(invalidThirdStudent.id);
  const invalidThirdRegistration = await PendaftaranPenjaluran.create({
    mahasiswa_id: invalidThirdStudent.id, periode_penjaluran_id: periods[2].id, jalur: "baru", program_kuliah: "reguler",
    semester_mahasiswa: 9, status: "approved", jenis_jalur_diambil: "penelitian", reviewed_by_sekretaris_id: sekretaris.id, reviewed_at: new Date(),
  });
  ids.registrations.push(invalidThirdRegistration.id);
  const invalidThirdAssignment = await PenetapanPembimbing.create({
    mahasiswa_id: invalidThirdStudent.id, pendaftaran_penjaluran_id: invalidThirdRegistration.id,
    periode_mulai_id: periods[2].id, semester_penjaluran_ke: 3, status: "active", sumber_data: "penjaluran",
    tanggal_mulai: new Date("2026-07-31T00:00:00.000Z"), effective_at: new Date("2026-07-31T00:00:00.000Z"), semester_outcome_code: "in_progress",
  });
  await PenetapanPembimbingDosen.create({
    penetapan_pembimbing_id: invalidThirdAssignment.id, dosen_id: dosens[0].id,
    urutan: 1, peran: "utama", status: "active", tanggal_mulai: new Date("2026-07-31T00:00:00.000Z"),
  });
  const thirdSemesterGate = await buildSemesterLanjutanGate(invalidThirdStudent.id);
  assert.equal(thirdSemesterGate.is_semester_tiga_plus, true);
  assert.equal(thirdSemesterGate.is_locked, true);
  assert.equal(thirdSemesterGate.reason, "izin_belum_diajukan");

  const groupStudents = [];
  const groupRegistrations = [];
  const groupSources = [];
  for (let index = 0; index < 3; index += 1) {
    const groupStudent = await Mahasiswa.create({
      nim: `S4G${suffix}${index}`, nama: `Anggota Perintisan ${index + 1}`,
      email: `stage4.group.${suffix}.${index}@test.local`, password: "test-password", status_jalur_saat_ini: "perintisan_bisnis",
    }, { hooks: false });
    ids.students.push(groupStudent.id); groupStudents.push(groupStudent);
    const groupRegistration = await PendaftaranPenjaluran.create({
      mahasiswa_id: groupStudent.id, periode_penjaluran_id: periods[0].id, jalur: "baru", program_kuliah: "reguler",
      semester_mahasiswa: 7, status: "approved", jenis_jalur_diambil: "perintisan_bisnis",
      form_lanjutan_status: "approved", reviewed_by_sekretaris_id: sekretaris.id, reviewed_at: new Date(),
    });
    ids.registrations.push(groupRegistration.id); groupRegistrations.push(groupRegistration);
    groupSources.push(await replaceSupervisorAssignment({
      mahasiswaId: groupStudent.id, pendaftaranPenjaluranId: groupRegistration.id, periodeMulaiId: periods[0].id,
      semesterPenjaluranKe: 1, dosenPembimbingIds: dosens.map((item) => item.id), createdBySekretarisId: sekretaris.id,
    }));
  }
  const businessGroup = await KelompokPerintisanBisnis.create({
    periode_penjaluran_id: periods[0].id, ketua_mahasiswa_id: groupStudents[0].id, status: "approved",
  });
  ids.groups.push(businessGroup.id);
  await AnggotaKelompokPerintisan.bulkCreate(groupStudents.map((item, index) => ({
    kelompok_id: businessGroup.id, mahasiswa_id: item.id, pendaftaran_penjaluran_id: groupRegistrations[index].id,
    posisi: index === 0 ? "ketua" : "anggota", peran_tim: ["hustler", "hipster", "hacker"][index], jenis_pendaftaran: "baru",
  })));

  const thirdMembers = await PenetapanPembimbingDosen.findAll({
    where: { penetapan_pembimbing_id: groupSources[2].penetapan.id }, order: [["urutan", "ASC"]],
  });
  await thirdMembers[1].destroy();
  const failedGroupResponse = await invokeController(assignmentController.confirmSemesterTransition, {
    user: { id: sekretaris.id, role: "sekretaris_prodi" },
    body: { expected_assignment_id: groupSources[0].penetapan.id, target_period_id: periods[1].id, effective_at: transitionEffectiveIso },
    get(name) { return name === "Idempotency-Key" ? `stage4-group-failed-${suffix}` : null; },
  });
  assert.equal(failedGroupResponse.statusCode, 409);
  assert.equal(failedGroupResponse.payload.success, false);
  assert.equal(failedGroupResponse.payload.code, "PERINTISAN_GROUP_REVIEW_REQUIRED");
  const failedGroupCarry = failedGroupResponse.payload.data;
  assert.equal(failedGroupCarry.group_needs_review, true);
  assert.equal(await PenetapanPembimbing.count({
    where: { mahasiswa_id: { [Op.in]: groupStudents.map((item) => item.id) }, semester_penjaluran_ke: 2 },
  }), 0);
  assert.equal((await businessGroup.reload()).status, "needs_review");
  assert.ok((await businessGroup.reload()).review_reason_code);
  const failedBulkResponse = await invokeController(assignmentController.confirmSemesterTransitionsBulk, {
    user: { id: sekretaris.id, role: "sekretaris_prodi" },
    body: { items: [{ expected_assignment_id: groupSources[0].penetapan.id, target_period_id: periods[1].id }] },
    get(name) { return name === "Idempotency-Key" ? `stage4-group-bulk-failed-${suffix}` : null; },
  });
  assert.equal(failedBulkResponse.statusCode, 207);
  assert.equal(failedBulkResponse.payload.data.results[0].success, false);

  await PenetapanPembimbingDosen.create({
    penetapan_pembimbing_id: groupSources[2].penetapan.id, dosen_id: dosens[1].id,
    urutan: 2, peran: "pendamping", status: "active", tanggal_mulai: new Date(),
  });
  await businessGroup.update({ status: "approved" });
  const groupCarry = await carryForwardSemesterAssignment({
    expectedAssignmentId: groupSources[0].penetapan.id, targetPeriodId: periods[1].id,
    effectiveAt: transitionEffectiveIso, idempotencyKey: `stage4-group-success-${suffix}`, actorId: sekretaris.id,
  });
  assert.equal(groupCarry.assignments.length, 3);
  assert.equal(groupCarry.assignments.every((item) => item.status === "scheduled"), true);
  assert.equal(await PenetapanPembimbing.count({
    where: { mahasiswa_id: { [Op.in]: groupStudents.map((item) => item.id) }, semester_penjaluran_ke: 2, status: "scheduled" },
  }), 3);

  const groupSemesterTwoActivation = await activateScheduledAssignments({ now: activationTime });
  assert.equal(groupSemesterTwoActivation.failed.length, 0);
  const activeGroupSemesterTwo = await PenetapanPembimbing.findAll({
    where: { mahasiswa_id: { [Op.in]: groupStudents.map((item) => item.id) }, semester_penjaluran_ke: 2, status: "active" },
    order: [["mahasiswa_id", "ASC"]],
  });
  assert.equal(activeGroupSemesterTwo.length, 3);
  await PenetapanPembimbing.update({
    tanggal_mulai: new Date(Date.now() - 86400000),
    effective_at: new Date(Date.now() - 86400000),
  }, { where: { id: { [Op.in]: activeGroupSemesterTwo.map((item) => item.id) } } });
  await PenetapanPembimbingDosen.update({
    tanggal_mulai: new Date(Date.now() - 86400000),
  }, { where: { penetapan_pembimbing_id: { [Op.in]: activeGroupSemesterTwo.map((item) => item.id) } } });

  const groupExtensions = [];
  for (let index = 0; index < groupStudents.length; index += 1) {
    const reason = `Anggota ${index + 1} memerlukan semester ketiga untuk menyelesaikan bisnis.`;
    const requestKey = `stage4-group-extension-${suffix}-${index}`;
    const response = await invokeController(jalurController.submitIzinLanjutSemester, {
      user: { id: groupStudents[index].id, role: "mahasiswa" },
      body: { alasan_pengajuan: reason },
      get(name) { return name === "Idempotency-Key" ? requestKey : null; },
    });
    assert.equal(response.statusCode, 201);
    assert.equal(response.payload.success, true);
    groupExtensions.push(response.payload.data);
    if (index === 0) {
      const networkRetry = await invokeController(jalurController.submitIzinLanjutSemester, {
        user: { id: groupStudents[index].id, role: "mahasiswa" }, body: { alasan_pengajuan: reason },
        get(name) { return name === "Idempotency-Key" ? requestKey : null; },
      });
      assert.equal(networkRetry.statusCode, 200);
      assert.equal(networkRetry.payload.replayed, true);
      assert.equal(networkRetry.payload.data.id, response.payload.data.id);
    }
  }

  const firstApproval = await invokeController(dosenController.approveIzinLanjut, {
    user: { id: dosens[0].id, role: "dosen" }, params: { id: groupExtensions[0].id },
    body: { keterangan_dosen: "Anggota pertama layak melanjutkan." },
    get(name) { return name === "Idempotency-Key" ? `stage4-group-decision-${suffix}-0` : null; },
  });
  assert.equal(firstApproval.statusCode, 200);
  assert.equal(firstApproval.payload.data.group_waiting_extensions, true);
  assert.equal(await PenetapanPembimbing.count({ where: { mahasiswa_id: { [Op.in]: groupStudents.map((item) => item.id) }, semester_penjaluran_ke: 3 } }), 0);

  const rejectedGroupMember = await invokeController(dosenController.rejectIzinLanjut, {
    user: { id: dosens[0].id, role: "dosen" }, params: { id: groupExtensions[1].id },
    body: { keterangan_dosen: "Progres anggota kedua belum memenuhi syarat." },
    get(name) { return name === "Idempotency-Key" ? `stage4-group-reject-${suffix}` : null; },
  });
  assert.equal(rejectedGroupMember.statusCode, 200);
  assert.equal((await businessGroup.reload()).status, "needs_review");
  assert.equal(await PenetapanPembimbing.count({ where: { mahasiswa_id: { [Op.in]: groupStudents.map((item) => item.id) }, semester_penjaluran_ke: 3 } }), 0);

  // Kelompok success dipisahkan dari kelompok rejection agar keputusan terminal tidak pernah dimutasi balik.
  const successfulGroupStudents = [];
  const successfulGroupRegistrations = [];
  const successfulGroupSources = [];
  for (let index = 0; index < 3; index += 1) {
    const member = await Mahasiswa.create({
      nim: `S4S${suffix}${index}`, nama: `Anggota Perintisan Sukses ${index + 1}`,
      email: `stage4.group.success.${suffix}.${index}@test.local`, password: "test-password", status_jalur_saat_ini: "perintisan_bisnis",
    }, { hooks: false });
    ids.students.push(member.id); successfulGroupStudents.push(member);
    const memberRegistration = await PendaftaranPenjaluran.create({
      mahasiswa_id: member.id, periode_penjaluran_id: periods[0].id, jalur: "baru", program_kuliah: "reguler",
      semester_mahasiswa: 7, status: "approved", jenis_jalur_diambil: "perintisan_bisnis",
      form_lanjutan_status: "approved", reviewed_by_sekretaris_id: sekretaris.id, reviewed_at: new Date(),
    });
    ids.registrations.push(memberRegistration.id); successfulGroupRegistrations.push(memberRegistration);
    successfulGroupSources.push(await replaceSupervisorAssignment({
      mahasiswaId: member.id, pendaftaranPenjaluranId: memberRegistration.id, periodeMulaiId: periods[0].id,
      semesterPenjaluranKe: 1, dosenPembimbingIds: dosens.map((item) => item.id), createdBySekretarisId: sekretaris.id,
    }));
  }
  const successfulBusinessGroup = await KelompokPerintisanBisnis.create({
    periode_penjaluran_id: periods[0].id, ketua_mahasiswa_id: successfulGroupStudents[0].id, status: "approved",
  });
  ids.groups.push(successfulBusinessGroup.id);
  await AnggotaKelompokPerintisan.bulkCreate(successfulGroupStudents.map((item, index) => ({
    kelompok_id: successfulBusinessGroup.id, mahasiswa_id: item.id, pendaftaran_penjaluran_id: successfulGroupRegistrations[index].id,
    posisi: index === 0 ? "ketua" : "anggota", peran_tim: ["hustler", "hipster", "hacker"][index], jenis_pendaftaran: "baru",
  })));
  const successfulSemesterTwoCarry = await carryForwardSemesterAssignment({
    expectedAssignmentId: successfulGroupSources[0].penetapan.id, targetPeriodId: periods[1].id,
    effectiveAt: transitionEffectiveIso, idempotencyKey: `stage4-group-success-semtwo-${suffix}`, actorId: sekretaris.id,
  });
  assert.equal(successfulSemesterTwoCarry.assignments.length, 3);
  const successfulSemesterTwoActivation = await activateScheduledAssignments({ now: activationTime });
  assert.equal(successfulSemesterTwoActivation.failed.length, 0);
  const successfulActiveSemesterTwo = await PenetapanPembimbing.findAll({
    where: { mahasiswa_id: { [Op.in]: successfulGroupStudents.map((item) => item.id) }, semester_penjaluran_ke: 2, status: "active" },
  });
  assert.equal(successfulActiveSemesterTwo.length, 3);
  await PenetapanPembimbing.update({ tanggal_mulai: new Date(Date.now() - 86400000), effective_at: new Date(Date.now() - 86400000) }, {
    where: { id: { [Op.in]: successfulActiveSemesterTwo.map((item) => item.id) } },
  });
  await PenetapanPembimbingDosen.update({ tanggal_mulai: new Date(Date.now() - 86400000) }, {
    where: { penetapan_pembimbing_id: { [Op.in]: successfulActiveSemesterTwo.map((item) => item.id) } },
  });

  const successfulGroupExtensions = [];
  for (let index = 0; index < successfulGroupStudents.length; index += 1) {
    const response = await invokeController(jalurController.submitIzinLanjutSemester, {
      user: { id: successfulGroupStudents[index].id, role: "mahasiswa" },
      body: { alasan_pengajuan: `Anggota sukses ${index + 1} memerlukan semester ketiga.` },
      get(name) { return name === "Idempotency-Key" ? `stage4-success-extension-${suffix}-${index}` : null; },
    });
    assert.equal(response.statusCode, 201);
    successfulGroupExtensions.push(response.payload.data);
  }
  for (const index of [0, 1, 2]) {
    const response = await invokeController(dosenController.approveIzinLanjut, {
      user: { id: dosens[0].id, role: "dosen" }, params: { id: successfulGroupExtensions[index].id },
      body: { keterangan_dosen: `Anggota ${index + 1} layak melanjutkan.` },
      get(name) { return name === "Idempotency-Key" ? `stage4-success-decision-${suffix}-${index}` : null; },
    });
    assert.equal(response.statusCode, 200);
    if (index < 2) assert.equal(response.payload.data.group_waiting_extensions, true);
    if (index === 2) assert.equal(response.payload.data.assignments.length, 3);
  }

  const groupSemesterThree = await PenetapanPembimbing.findAll({
    where: { mahasiswa_id: { [Op.in]: successfulGroupStudents.map((item) => item.id) }, semester_penjaluran_ke: 3 },
    order: [["mahasiswa_id", "ASC"]],
  });
  assert.equal(groupSemesterThree.length, 3);
  const izinByStudent = new Map((await IzinLanjutSkripsi.findAll({ where: { id: { [Op.in]: successfulGroupExtensions.map((item) => item.id) } } })).map((item) => [Number(item.mahasiswa_id), item]));
  for (const assignment of groupSemesterThree) {
    const ownPermission = izinByStudent.get(Number(assignment.mahasiswa_id));
    assert.equal(Number(assignment.izin_lanjut_id), Number(ownPermission.id));
    assert.equal(Number(assignment.previous_assignment_id), Number(ownPermission.penetapan_asal_id));
    assert.equal(Number(ownPermission.penetapan_hasil_id), Number(assignment.id));
    assert.equal(Number(assignment.pendaftaran_penjaluran_id), Number(ownPermission.pendaftaran_penjaluran_id));
  }

  const brokenTargetMembers = await PenetapanPembimbingDosen.findAll({ where: { penetapan_pembimbing_id: groupSemesterThree[2].id }, order: [["urutan", "ASC"]] });
  await brokenTargetMembers[1].destroy();
  const failedGroupActivation = await activateScheduledAssignments({ now: new Date(extensionTargetStart.getTime() + 86400000) });
  assert.ok(failedGroupActivation.failed.length >= 1);
  assert.equal(await PenetapanPembimbing.count({ where: { id: { [Op.in]: groupSemesterThree.map((item) => item.id) }, status: "active" } }), 0);
  assert.equal((await successfulBusinessGroup.reload()).status, "needs_review");
  await PenetapanPembimbingDosen.create({
    penetapan_pembimbing_id: groupSemesterThree[2].id, dosen_id: dosens[1].id,
    urutan: 2, peran: "pendamping", status: "scheduled",
  });
  const retriedGroupActivation = await activateScheduledAssignments({ now: new Date(extensionTargetStart.getTime() + 86400000) });
  assert.equal(retriedGroupActivation.failed.length, 0);
  assert.equal(await PenetapanPembimbing.count({ where: { id: { [Op.in]: groupSemesterThree.map((item) => item.id) }, status: "active" } }), 3);
  assert.equal((await successfulBusinessGroup.reload()).status, "approved");
});
