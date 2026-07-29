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
} = require("../models");
const {
  getEligibility, submitPamit, decidePamit, createChangeRegistration,
} = require("../services/penjaluranChangeService");

sequelize.options.logging = false;

test("lifecycle ulang dan alih jalur Tahap 3", async (t) => {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-10);
  const studentIds = [];
  const dosenIds = [];
  const periodIds = [];
  const registrationIds = [];
  const assignmentIds = [];
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
    if (assignmentIds.length) await PenetapanPembimbingDosen.destroy({ where: { penetapan_pembimbing_id: assignmentIds }, force: true });
    await PenetapanPembimbing.destroy({ where: { mahasiswa_id: studentIds }, force: true });
    await PendaftaranPenjaluran.destroy({ where: { mahasiswa_id: studentIds }, force: true });
    await Mahasiswa.destroy({ where: { id: studentIds }, force: true });
    await Dosen.destroy({ where: { id: dosenIds }, force: true });
    await PeriodePenjaluran.destroy({ where: { id: periodIds }, force: true });
    for (const period of previousActivePeriods) await period.update({ is_active: true, status: "active" });
    await sequelize.close();
  });

  for (const period of previousActivePeriods) await period.update({ is_active: false });
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

  await t.test("server menentukan alih dan hanya mengunci Pembimbing 1", async () => {
    const eligibility = await getEligibility(student.id, { targetTrack: "magang" });
    assert.equal(eligibility.source_track, "penelitian");
    assert.equal(eligibility.change_type, "alih");
    assert.equal(eligibility.requires_pamit, true);
    assert.equal(Number(eligibility.reviewer_p1.id), p1.id);
    assert.equal(Number(eligibility.reviewer_p2.id), p2.id);
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
    await assert.rejects(
      decidePamit({ pamitId: pamit.id, dosenId: p2.id, decision: "approved" }),
      (error) => error.code === "NOT_LOCKED_REVIEWER"
    );
    await decidePamit({ pamitId: pamit.id, dosenId: p1.id, decision: "approved", note: "Disetujui." });
    await student.reload();
    await assignment.reload();
    await guidance.reload();
    assert.equal(assignment.status, "ended");
    assert.equal(student.dosen_pembimbing_skripsi_id, null);
    assert.equal(guidance.status_permohonan, "cancelled_supervisor_change");
  });

  await t.test("commit pendaftaran membuat root siklus baru dan baru kemudian mengonsumsi pamit", async () => {
    const result = await createChangeRegistration({
      mahasiswaId: student.id, targetTrack: "magang", reason: "Beralih ke jalur magang.", pamitId: pamit.id,
    });
    registrationIds.push(result.registration.id);
    assert.equal(result.registration.jalur, "alih");
    assert.equal(result.registration.pendaftaran_asal_id, source.id);
    assert.equal(result.registration.penjaluran_sebelumnya, "penelitian");
    assert.equal(result.registration.penjaluran_baru, "magang");
    const consumed = await PamitUlang.findByPk(pamit.id);
    assert.equal(consumed.status, "consumed");
    assert.equal(consumed.pendaftaran_baru_id, result.registration.id);
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
    });
    registrationIds.push(result.registration.id);
    assert.equal(result.registration.jalur, "ulang");
  });
});
