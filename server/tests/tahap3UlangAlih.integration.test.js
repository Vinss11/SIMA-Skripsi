"use strict";

process.env.NODE_ENV = "test";
const path = require("node:path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const test = require("node:test");
const assert = require("node:assert/strict");
const { Op } = require("sequelize");
const {
  sequelize, Mahasiswa, Dosen, PeriodePenjaluran, PendaftaranPenjaluran,
  PenetapanPembimbing, PenetapanPembimbingDosen, BimbinganSkripsi,
  PamitUlang, RiwayatPamitPenjaluran, Notifikasi,
  Pengajuan, KelompokPerintisanBisnis, AnggotaKelompokPerintisan,
} = require("../models");
const {
  getEligibility, submitPamit, decidePamit, createChangeRegistration,
} = require("../services/penjaluranChangeService");
const changeController = require("../controllers/penjaluranChangeController");

sequelize.options.logging = false;

function responseRecorder() {
  return {
    statusCode: 200, payload: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return payload; },
  };
}

test("lifecycle ulang dan alih jalur Tahap 3", async (t) => {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-10);
  const studentIds = [];
  const dosenIds = [];
  const periodIds = [];
  const registrationIds = [];
  const assignmentIds = [];
  const businessGroupIds = [];
  const previousActivePeriods = await PeriodePenjaluran.findAll({ where: { is_active: true } });

  t.after(async () => {
    await Notifikasi.destroy({ where: { [Op.or]: [
      { recipient_type: "mahasiswa", recipient_id: studentIds },
      { recipient_type: "dosen", recipient_id: dosenIds },
    ] }, force: true });
    const pamits = await PamitUlang.findAll({ where: { mahasiswa_id: studentIds }, attributes: ["id"], raw: true });
    if (pamits.length) await RiwayatPamitPenjaluran.destroy({ where: { pamit_ulang_id: pamits.map((x) => x.id) }, force: true });
    await PamitUlang.destroy({ where: { mahasiswa_id: studentIds }, force: true });
    await BimbinganSkripsi.destroy({ where: { mahasiswa_id: studentIds }, force: true });
    await Pengajuan.destroy({ where: { mahasiswa_id: studentIds }, force: true });
    if (assignmentIds.length) await PenetapanPembimbingDosen.destroy({ where: { penetapan_pembimbing_id: assignmentIds }, force: true });
    await PenetapanPembimbing.destroy({ where: { mahasiswa_id: studentIds }, force: true });
    if (businessGroupIds.length) await AnggotaKelompokPerintisan.destroy({ where: { kelompok_id: businessGroupIds }, force: true });
    if (businessGroupIds.length) await KelompokPerintisanBisnis.destroy({ where: { id: businessGroupIds }, force: true });
    await PendaftaranPenjaluran.destroy({ where: { mahasiswa_id: studentIds }, force: true });
    await Mahasiswa.destroy({ where: { id: studentIds }, force: true });
    await Dosen.destroy({ where: { id: dosenIds }, force: true });
    await PeriodePenjaluran.destroy({ where: { id: periodIds }, force: true });
    for (const period of previousActivePeriods) await period.update({ is_active: true, status: "active" });
    await sequelize.close();
  });

  for (const period of previousActivePeriods) await period.update({ is_active: false, status: "closed" });
  const oldPeriod = await PeriodePenjaluran.create({
    tahun_akademik: "2025/2026", semester: "genap", label_periode: `T3 lama ${suffix}`,
    tanggal_mulai: new Date("2026-01-01T00:00:00Z"), tanggal_selesai: new Date("2026-02-01T00:00:00Z"),
    is_active: false, status: "closed",
  });
  const activePeriod = await PeriodePenjaluran.create({
    tahun_akademik: "2026/2027", semester: "ganjil", label_periode: `T3 aktif ${suffix}`,
    tanggal_mulai: new Date(Date.now() - 86400000), tanggal_selesai: new Date(Date.now() + 86400000 * 5),
    is_active: true, status: "active",
  });
  periodIds.push(oldPeriod.id, activePeriod.id);

  const p1 = await Dosen.create({
    kode_dosen: `T3P1${suffix}`, nama: "Pembimbing Utama T3", email: `t3.p1.${suffix}@test.local`,
    password: "password", kuota_bimbingan: 10,
  }, { hooks: false });
  const p2 = await Dosen.create({
    kode_dosen: `T3P2${suffix}`, nama: "Pembimbing Pendamping T3", email: `t3.p2.${suffix}@test.local`,
    password: "password", kuota_bimbingan: 10,
  }, { hooks: false });
  dosenIds.push(p1.id, p2.id);

  const student = await Mahasiswa.create({
    nim: `T3${suffix}1`, nama: "Mahasiswa Alih T3", email: `t3.student.${suffix}@test.local`,
    password: "password", angkatan: "2022", dosen_pembimbing_skripsi_id: p1.id,
  }, { hooks: false });
  studentIds.push(student.id);
  const source = await PendaftaranPenjaluran.create({
    mahasiswa_id: student.id, periode_penjaluran_id: oldPeriod.id, jalur: "baru",
    program_kuliah: "reguler", semester_mahasiswa: 8, status: "approved",
    jenis_jalur_diambil: "penelitian", form_lanjutan_status: "approved",
  });
  registrationIds.push(source.id);
  const assignment = await PenetapanPembimbing.create({
    mahasiswa_id: student.id, pendaftaran_penjaluran_id: source.id, periode_mulai_id: oldPeriod.id,
    semester_penjaluran_ke: 1, tanggal_mulai: new Date("2026-01-05T00:00:00Z"), status: "active", sumber_data: "penjaluran",
  });
  assignmentIds.push(assignment.id);
  await PenetapanPembimbingDosen.bulkCreate([
    { penetapan_pembimbing_id: assignment.id, dosen_id: p1.id, urutan: 1, peran: "utama", status: "active" },
    { penetapan_pembimbing_id: assignment.id, dosen_id: p2.id, urutan: 2, peran: "pendamping", status: "active" },
  ]);
  const guidance = await BimbinganSkripsi.create({
    mahasiswa_id: student.id, dosen_id: p1.id, pendaftaran_penjaluran_id: source.id,
    permintaan_pesan: "Mohon jadwal bimbingan lama", permintaan_tanggal: "2099-01-01", permintaan_jam: "09:00",
  });
  const approvedGuidance = await BimbinganSkripsi.create({
    mahasiswa_id: student.id, dosen_id: p1.id, pendaftaran_penjaluran_id: source.id,
    permintaan_pesan: "Jadwal approved harus tetap tersimpan", permintaan_tanggal: "2099-01-02", permintaan_jam: "10:00",
    status_permohonan: "approved",
  });
  const unscopedPendingGuidance = await BimbinganSkripsi.create({
    mahasiswa_id: student.id, dosen_id: p1.id, pendaftaran_penjaluran_id: null,
    permintaan_pesan: "Permohonan tanpa root siklus harus direview manual", permintaan_tanggal: "2099-01-03", permintaan_jam: "11:00",
    status_permohonan: "pending",
  });

  await t.test("server menentukan alih dan hanya mengunci Pembimbing 1", async () => {
    const eligibility = await getEligibility(student.id, { targetTrack: "magang" });
    assert.equal(eligibility.source_track, "penelitian");
    assert.equal(eligibility.change_type, "alih");
    assert.equal(eligibility.requires_pamit, true);
    assert.equal(Number(eligibility.reviewer_p1.id), p1.id);
    assert.equal(Number(eligibility.reviewer_p2.id), p2.id);
  });

  await t.test("pamit lama dibatalkan jika Sekprodi sudah mengganti assignment", async () => {
    const swappedStudent = await Mahasiswa.create({
      nim: `T3${suffix}3`, nama: "Mahasiswa Ganti Pembimbing", email: `t3.swap.${suffix}@test.local`,
      password: "password", angkatan: "2022", dosen_pembimbing_skripsi_id: p1.id,
    }, { hooks: false });
    studentIds.push(swappedStudent.id);
    const swappedSource = await PendaftaranPenjaluran.create({
      mahasiswa_id: swappedStudent.id, periode_penjaluran_id: oldPeriod.id, jalur: "baru",
      program_kuliah: "reguler", semester_mahasiswa: 8, status: "approved",
      jenis_jalur_diambil: "penelitian", form_lanjutan_status: "approved",
    });
    registrationIds.push(swappedSource.id);
    const oldAssignment = await PenetapanPembimbing.create({
      mahasiswa_id: swappedStudent.id, pendaftaran_penjaluran_id: swappedSource.id, periode_mulai_id: oldPeriod.id,
      semester_penjaluran_ke: 1, tanggal_mulai: new Date("2026-01-05T00:00:00Z"), status: "active", sumber_data: "penjaluran",
    });
    assignmentIds.push(oldAssignment.id);
    await PenetapanPembimbingDosen.create({
      penetapan_pembimbing_id: oldAssignment.id, dosen_id: p1.id, urutan: 1, peran: "utama", status: "active",
    });
    const stalePamit = await submitPamit({
      mahasiswaId: swappedStudent.id, targetTrack: "magang",
      message: "Mohon izin beralih ke jalur magang.", reason: "Saya memilih pengalaman jalur magang.",
      idempotencyKey: `swap-pamit-${suffix}`,
    });
    await oldAssignment.update({
      status: "ended",
      tanggal_selesai: new Date(),
      end_reason_code: "supervisor_replaced",
      assignment_transition_code: "supervisor_replaced",
    });
    await PenetapanPembimbingDosen.update(
      { status: "ended", tanggal_selesai: new Date() },
      { where: { penetapan_pembimbing_id: oldAssignment.id } }
    );
    const replacement = await PenetapanPembimbing.create({
      mahasiswa_id: swappedStudent.id, pendaftaran_penjaluran_id: swappedSource.id, periode_mulai_id: oldPeriod.id,
      semester_penjaluran_ke: 1, tanggal_mulai: new Date(), status: "active", sumber_data: "pergantian",
    });
    assignmentIds.push(replacement.id);
    await PenetapanPembimbingDosen.create({
      penetapan_pembimbing_id: replacement.id, dosen_id: p2.id, urutan: 1, peran: "utama", status: "active",
    });
    await swappedStudent.update({ dosen_pembimbing_skripsi_id: p2.id });

    const decisionResult = await decidePamit({
      pamitId: stalePamit.id, dosenId: p1.id, decision: "approved", note: "Disetujui.",
    });
    await replacement.reload();
    assert.equal(decisionResult.status, "cancelled");
    assert.equal(decisionResult.cancellation_reason, "assignment_changed");
    assert.equal(replacement.status, "active");
  });

  let pamit;
  await t.test("pamit idempoten, P2 view-only, approval mengakhiri state lama", async () => {
    const request = () => submitPamit({
        mahasiswaId: student.id, targetTrack: "magang",
        message: "Mohon izin mengakhiri bimbingan lama.", reason: "Saya akan beralih ke jalur magang.",
        idempotencyKey: `t3-${suffix}`,
      });
    const [created, repeated] = await Promise.all([request(), request()]);
    pamit = created;
    assert.equal(repeated.id, pamit.id);
    assert.equal(repeated.replayed, true);
    await assert.rejects(
      submitPamit({
        mahasiswaId: student.id, targetTrack: "penelitian",
        message: "Mohon izin mengulang jalur penelitian.", reason: "Saya ingin memulai penelitian dari awal.",
        idempotencyKey: `t3-${suffix}`,
      }),
      (error) => error.code === "PAMIT_IDEMPOTENCY_CONFLICT"
    );
    await assert.rejects(
      decidePamit({ pamitId: pamit.id, dosenId: p2.id, decision: "approved" }),
      (error) => error.code === "NOT_LOCKED_REVIEWER"
    );
    const firstDecision = await decidePamit({
      pamitId: pamit.id, dosenId: p1.id, decision: "approved", note: "Disetujui.",
    });
    assert.equal(firstDecision.status, "approved");
    assert.equal(firstDecision.replayed, false);
    const repeatedDecision = await decidePamit({
      pamitId: pamit.id, dosenId: p1.id, decision: "approved", note: "Disetujui.",
    });
    assert.equal(repeatedDecision.status, "approved");
    assert.equal(repeatedDecision.replayed, true);
    await assert.rejects(
      decidePamit({ pamitId: pamit.id, dosenId: p1.id, decision: "rejected", note: "Ditolak." }),
      (error) => error.code === "PAMIT_DECISION_CONFLICT"
    );
    const persistedPamit = await PamitUlang.findByPk(pamit.id);
    assert.equal(persistedPamit.status, "approved");
    await student.reload();
    await assignment.reload();
    await guidance.reload();
    await approvedGuidance.reload();
    await unscopedPendingGuidance.reload();
    assert.equal(assignment.status, "ended");
    assert.equal(student.dosen_pembimbing_skripsi_id, null);
    assert.equal(guidance.status_permohonan, "cancelled_supervisor_change");
    assert.equal(approvedGuidance.status_permohonan, "approved");
    assert.equal(unscopedPendingGuidance.status_permohonan, "pending");
    assert.equal(await Notifikasi.count({ where: {
      recipient_type: "dosen", recipient_id: p2.id, reference_type: "pamit_penjaluran", reference_id: pamit.id,
    } }), 2);
  });

  await t.test("pamit approved hanya melewati PAMIT_PENDING dan tetap memblokir workflow aktif", async () => {
    const activeResearch = await Pengajuan.create({
      mahasiswa_id: student.id, pendaftaran_penjaluran_id: source.id,
      jenis_jalur: "baru", tipe_pengajuan: "judul_mandiri", judul_mandiri: "Workflow abnormal setelah pamit",
      deskripsi_mandiri: "Pengajuan penelitian nonterminal harus tetap memblokir pendaftaran baru.",
      keyword_mandiri: "workflow, blocker", prospective_supervisor_id: p1.id,
      status: "menunggu_approval_sekprodi",
    });
    const auxiliaryPeriod = await PeriodePenjaluran.create({
      tahun_akademik: "2024/2025", semester: "ganjil", label_periode: `T3 blocker ${suffix}`,
      tanggal_mulai: new Date("2024-08-01T00:00:00Z"), tanggal_selesai: new Date("2024-08-31T00:00:00Z"),
      is_active: false, status: "closed",
    });
    periodIds.push(auxiliaryPeriod.id);
    const activeNonResearch = await PendaftaranPenjaluran.create({
      mahasiswa_id: student.id, periode_penjaluran_id: auxiliaryPeriod.id, jalur: "baru",
      program_kuliah: "reguler", semester_mahasiswa: 6, status: "submitted",
      jenis_jalur_diambil: "perintisan_bisnis", form_lanjutan_status: "submitted",
    });
    registrationIds.push(activeNonResearch.id);
    const activeGroup = await KelompokPerintisanBisnis.create({
      periode_penjaluran_id: auxiliaryPeriod.id, ketua_mahasiswa_id: student.id, status: "submitted",
    });
    businessGroupIds.push(activeGroup.id);
    await AnggotaKelompokPerintisan.create({
      kelompok_id: activeGroup.id, mahasiswa_id: student.id,
      pendaftaran_penjaluran_id: activeNonResearch.id,
      posisi: "ketua", peran_tim: "hustler", jenis_pendaftaran: "baru",
    });

    const eligibility = await getEligibility(student.id, { targetTrack: "magang" });
    assert.equal(eligibility.eligible, false);
    const blockerCodes = new Set(eligibility.blocker_details.map((item) => item.code));
    assert.equal(blockerCodes.has("PAMIT_PENDING"), false);
    assert.equal(blockerCodes.has("ACTIVE_RESEARCH_WORKFLOW"), true);
    assert.equal(blockerCodes.has("ACTIVE_NON_RESEARCH_WORKFLOW"), true);
    assert.equal(blockerCodes.has("ACTIVE_BUSINESS_GROUP"), true);

    await activeResearch.update({ status: "rejected" });
    await activeNonResearch.update({ form_lanjutan_status: "rejected" });
    await activeGroup.update({ status: "rejected" });
  });

  await t.test("commit pendaftaran membuat root siklus baru dan baru kemudian mengonsumsi pamit", async () => {
    const register = () => createChangeRegistration({
      mahasiswaId: student.id, targetTrack: "magang", reason: "Beralih ke jalur magang.",
      idempotencyKey: `change-${suffix}`,
    });
    const registrationResults = await Promise.all([register(), register()]);
    const result = registrationResults.find((item) => !item.replayed);
    const replay = registrationResults.find((item) => item.replayed);
    assert.ok(result);
    assert.ok(replay);
    registrationIds.push(result.registration.id);
    assert.equal(result.registration.jalur, "alih");
    assert.equal(result.registration.pendaftaran_asal_id, source.id);
    assert.equal(result.registration.penjaluran_sebelumnya, "penelitian");
    assert.equal(result.registration.penjaluran_baru, "magang");
    const consumed = await PamitUlang.findByPk(pamit.id);
    assert.equal(consumed.status, "consumed");
    assert.equal(consumed.pendaftaran_baru_id, result.registration.id);
    assert.equal(replay.replayed, true);
    assert.equal(replay.registration.id, result.registration.id);
    const legacyStatusResponse = responseRecorder();
    await changeController.getLegacyPamitStatus({ user: { id: student.id } }, legacyStatusResponse);
    assert.equal(legacyStatusResponse.payload.data.lifecycle_status, "consumed");
    assert.equal(legacyStatusResponse.payload.data.can_continue, false);
    assert.equal(legacyStatusResponse.payload.data.pendaftaran_baru_id, result.registration.id);
  });

  await t.test("eligibility membaca workflow penelitian nonterminal tanpa bergantung pada cache mahasiswa", async () => {
    const workflowStudent = await Mahasiswa.create({
      nim: `T3${suffix}4`, nama: "Mahasiswa Workflow Aktif", email: `t3.workflow.${suffix}@test.local`,
      password: "password", angkatan: "2022", pengajuan_aktif_id: null,
    }, { hooks: false });
    studentIds.push(workflowStudent.id);
    const workflowSource = await PendaftaranPenjaluran.create({
      mahasiswa_id: workflowStudent.id, periode_penjaluran_id: oldPeriod.id, jalur: "baru",
      program_kuliah: "reguler", semester_mahasiswa: 8, status: "approved",
      jenis_jalur_diambil: "penelitian", form_lanjutan_status: "draft",
    });
    registrationIds.push(workflowSource.id);
    await Pengajuan.create({
      mahasiswa_id: workflowStudent.id, pendaftaran_penjaluran_id: workflowSource.id,
      jenis_jalur: "baru", tipe_pengajuan: "judul_mandiri", judul_mandiri: "Workflow belum selesai",
      deskripsi_mandiri: "Deskripsi workflow penelitian yang belum selesai.",
      keyword_mandiri: "workflow, penelitian",
      prospective_supervisor_id: p1.id,
      status: "menunggu_approval_sekprodi",
    });
    const eligibility = await getEligibility(workflowStudent.id, { targetTrack: "magang" });
    assert.equal(eligibility.eligible, false);
    assert.ok(eligibility.blocker_details.some((item) => item.code === "ACTIVE_RESEARCH_WORKFLOW"));
  });

  await t.test("tanpa penetapan aktif mahasiswa dapat ulang tanpa pamit", async () => {
    const noAssignmentStudent = await Mahasiswa.create({
      nim: `T3${suffix}2`, nama: "Mahasiswa Ulang T3", email: `t3.repeat.${suffix}@test.local`,
      password: "password", angkatan: "2022",
    }, { hooks: false });
    studentIds.push(noAssignmentStudent.id);
    const previous = await PendaftaranPenjaluran.create({
      mahasiswa_id: noAssignmentStudent.id, periode_penjaluran_id: oldPeriod.id, jalur: "baru",
      program_kuliah: "reguler", semester_mahasiswa: 8, status: "approved",
      jenis_jalur_diambil: "perintisan_bisnis", form_lanjutan_status: "approved",
    });
    registrationIds.push(previous.id);
    const eligibility = await getEligibility(noAssignmentStudent.id, { targetTrack: "perintisan_bisnis" });
    assert.equal(eligibility.requires_pamit, false);
    assert.equal(eligibility.change_type, "ulang");
    const result = await createChangeRegistration({
      mahasiswaId: noAssignmentStudent.id, targetTrack: "perintisan_bisnis", reason: "Memulai siklus perintisan baru.",
      idempotencyKey: `change-bypass-${suffix}`,
    });
    registrationIds.push(result.registration.id);
    assert.equal(result.registration.jalur, "ulang");
  });
});
