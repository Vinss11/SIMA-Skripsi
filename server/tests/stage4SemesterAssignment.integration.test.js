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
  PendaftaranPenjaluran,
  DosenKetersediaanPeriode,
  PenetapanPembimbing,
  PenetapanPembimbingDosen,
  IzinLanjutSkripsi,
  Notifikasi,
} = require("../models");
const { replaceSupervisorAssignment, getActiveSupervisorAssignment } = require("../services/penetapanPembimbingService");
const {
  previewSemesterTransitions,
  carryForwardSemesterAssignment,
  activateScheduledAssignment,
} = require("../services/semesterAssignmentService");
const { submitExtensionRequest, decideExtensionAndTransitionSemester } = require("../services/extensionTransitionService");
const assignmentController = require("../controllers/penetapanPembimbingController");

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
  const ids = { students: [], dosens: [], periods: [], registrations: [] };

  t.after(async () => {
    const assignments = await PenetapanPembimbing.findAll({ where: { mahasiswa_id: { [Op.in]: ids.students } }, attributes: ["id"] });
    const assignmentIds = assignments.map((row) => row.id);
    await PenetapanPembimbing.update({ izin_lanjut_id: null }, { where: { id: { [Op.in]: assignmentIds } } });
    await IzinLanjutSkripsi.update({ penetapan_hasil_id: null, penetapan_asal_id: null }, { where: { mahasiswa_id: { [Op.in]: ids.students } } });
    await IzinLanjutSkripsi.destroy({ where: { mahasiswa_id: { [Op.in]: ids.students } }, force: true });
    await Notifikasi.destroy({ where: { [Op.or]: [
      { recipient_type: "mahasiswa", recipient_id: { [Op.in]: ids.students } },
      { recipient_type: "dosen", recipient_id: { [Op.in]: ids.dosens } },
    ] }, force: true });
    await PenetapanPembimbingDosen.destroy({ where: { penetapan_pembimbing_id: { [Op.in]: assignmentIds } }, force: true });
    await PenetapanPembimbing.destroy({ where: { id: { [Op.in]: assignmentIds } }, force: true });
    await PendaftaranPenjaluran.destroy({ where: { id: { [Op.in]: ids.registrations } }, force: true });
    await DosenKetersediaanPeriode.destroy({ where: { periode_penjaluran_id: { [Op.in]: ids.periods } }, force: true });
    await Mahasiswa.destroy({ where: { id: { [Op.in]: ids.students } }, force: true });
    await Dosen.destroy({ where: { id: { [Op.in]: ids.dosens } }, force: true });
    await PeriodePenjaluran.destroy({ where: { id: { [Op.in]: ids.periods } }, force: true });
    await SekretarisProdi.destroy({ where: { email: `stage4.${suffix}@test.local` }, force: true });
    await sequelize.close();
  });

  const sekretaris = await SekretarisProdi.create({
    nik: `S4${suffix}`.slice(0, 9), nama: "Sekretaris Stage 4", email: `stage4.${suffix}@test.local`, password: "test-password",
  }, { hooks: false });
  const periodDefinitions = [
    ["2025/2026", "genap", "2026-01-10T00:00:00.000Z"],
    ["2026/2027", "ganjil", "2026-08-01T00:00:00.000Z"],
    ["2026/2027", "genap", "2027-01-10T00:00:00.000Z"],
  ];
  const periods = [];
  for (const [year, semester, start] of periodDefinitions) {
    const period = await PeriodePenjaluran.create({
      tahun_akademik: year, semester, label_periode: `Stage4 ${suffix} ${semester} ${year}`,
      status: "closed", is_active: false, tanggal_mulai: new Date(start), tanggal_selesai: new Date(new Date(start).getTime() + 30 * 86400000),
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
    await DosenKetersediaanPeriode.create({
      dosen_id: dosen.id, periode_penjaluran_id: periods[0].id, tersedia_membimbing: true,
      configuration_status: "ready", reviewed_at: new Date(), reviewed_by_sekretaris_id: sekretaris.id,
      updated_by_sekretaris_id: sekretaris.id,
    });
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

  const endpointResponse = await invokeController(assignmentController.confirmSemesterTransition, {
    user: { id: sekretaris.id, role: "sekretaris_prodi" },
    body: {
      expected_assignment_id: initial.penetapan.id,
      target_period_id: periods[1].id,
      effective_at: "2026-08-01T00:00:00.000Z",
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
    effectiveAt: "2026-08-01T00:00:00.000Z", idempotencyKey: `stage4-carry-${suffix}`,
    actorId: sekretaris.id,
  });
  assert.equal(replay.replayed, true);
  assert.equal(replay.assignment.id, scheduled.assignment.id);

  await activateScheduledAssignment({ assignmentId: scheduled.assignment.id, now: new Date("2026-08-02T00:00:00.000Z") });
  const endedFirst = await PenetapanPembimbing.findByPk(initial.penetapan.id);
  assert.equal(endedFirst.status, "ended");
  assert.equal(endedFirst.end_reason_code, "semester_carried_forward");
  assert.equal((await PenetapanPembimbing.findByPk(scheduled.assignment.id)).status, "active");

  const extension = await submitExtensionRequest({
    mahasiswaId: student.id, alasanPengajuan: "Progres penelitian masih berjalan dan perlu diselesaikan.", idempotencyKey: `stage4-extension-${suffix}`,
  });
  assert.equal(extension.izin.penetapan_asal_id, scheduled.assignment.id);
  assert.equal(extension.izin.semester_penjaluran_ke, 3);
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
});
