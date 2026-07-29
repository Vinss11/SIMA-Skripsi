"use strict";

process.env.NODE_ENV = "test";
const path = require("node:path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  sequelize,
  Mahasiswa,
  PeriodePenjaluran,
  PendaftaranPenjaluran,
  KelompokPerintisanBisnis,
  AnggotaKelompokPerintisan,
  Dosen,
  DosenKetersediaanPeriode,
  PenetapanPembimbing,
  PenetapanPembimbingDosen,
  Notifikasi,
} = require("../models");
const pendaftaranController = require("../controllers/pendaftaranController");
const {
  resolveAuthoritativeAssignmentTargets,
  finalizePenjaluranDecision,
} = require("../services/penjaluranFinalizationService");
const { normalizeWorkflow } = require("../services/penjaluranWorkflowService");

sequelize.options.logging = false;

function responseRecorder() {
  return {
    statusCode: 200,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return payload; },
  };
}

test("kontrak integrasi penjaluran Tahap 2", async (t) => {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-10);
  const mahasiswaIds = [];
  const registrationIds = [];
  const dosenIds = [];
  let periodId = null;
  let groupId = null;

  t.after(async () => {
    if (mahasiswaIds.length || dosenIds.length) {
      await Notifikasi.destroy({
        where: {
          [require("sequelize").Op.or]: [
            { recipient_type: "mahasiswa", recipient_id: mahasiswaIds },
            { recipient_type: "dosen", recipient_id: dosenIds },
          ],
        },
        force: true,
      });
    }
    const assignments = mahasiswaIds.length
      ? await PenetapanPembimbing.findAll({ where: { mahasiswa_id: mahasiswaIds }, attributes: ["id"], raw: true })
      : [];
    if (assignments.length) {
      await PenetapanPembimbingDosen.destroy({ where: { penetapan_pembimbing_id: assignments.map((item) => item.id) }, force: true });
      await PenetapanPembimbing.destroy({ where: { id: assignments.map((item) => item.id) }, force: true });
    }
    if (groupId) await AnggotaKelompokPerintisan.destroy({ where: { kelompok_id: groupId }, force: true });
    if (groupId) await KelompokPerintisanBisnis.destroy({ where: { id: groupId }, force: true });
    if (registrationIds.length) await PendaftaranPenjaluran.destroy({ where: { id: registrationIds }, force: true });
    if (dosenIds.length) await DosenKetersediaanPeriode.destroy({ where: { dosen_id: dosenIds }, force: true });
    if (mahasiswaIds.length) await Mahasiswa.destroy({ where: { id: mahasiswaIds }, force: true });
    if (dosenIds.length) await Dosen.destroy({ where: { id: dosenIds }, force: true });
    if (periodId) await PeriodePenjaluran.destroy({ where: { id: periodId }, force: true });
    await sequelize.close();
  });

  await t.test("endpoint umum menolak Ulang/Alih sebelum menulis data", async () => {
    const res = responseRecorder();
    await pendaftaranController.submitPendaftaranJalurBaru({
      body: { pendaftaran: "ulang" },
    }, res);
    assert.equal(res.statusCode, 409);
    assert.equal(res.payload?.code, "REGISTRATION_TYPE_NOT_AVAILABLE");
  });

  await t.test("endpoint umum menolak pilihan pembimbing dari mahasiswa", async () => {
    const res = responseRecorder();
    await pendaftaranController.submitPendaftaranJalurBaru({
      body: {
        pendaftaran: "baru",
        dosen_pembimbing_ta_id: 99,
      },
    }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.payload?.code, "STUDENT_SUPERVISOR_SELECTION_NOT_ALLOWED");
  });

  await t.test("normalisasi workflow selalu mengekspos stage dan status mentah", () => {
    const result = normalizeWorkflow({
      status: "review_sekprodi",
      actor: "sekretaris_prodi",
      allowedActions: ["approve", "reject"],
    });
    assert.equal(result.workflow_stage, "final_review_sekprodi");
    assert.equal(result.raw_workflow_status, "review_sekprodi");
    assert.deepEqual(result.allowed_actions, ["approve", "reject"]);
  });

  await t.test("anggota Perintisan final selalu dibaca dari tabel otoritatif, bukan snapshot JSON", async () => {
    const period = await PeriodePenjaluran.create({
      tahun_akademik: "2196/2197",
      semester: "ganjil",
      label_periode: `Tahap 2 ${suffix}`,
      tanggal_mulai: new Date("2196-08-01T00:00:00.000Z"),
      tanggal_selesai: new Date("2196-08-31T00:00:00.000Z"),
      status: "closed",
      is_active: false,
    });
    periodId = period.id;

    const students = [];
    for (let index = 1; index <= 3; index += 1) {
      const student = await Mahasiswa.create({
        nim: `T2${suffix}${index}`,
        nama: `Mahasiswa Tahap 2 ${index}`,
        email: `mahasiswa.tahap2.${suffix}.${index}@test.local`,
        password: "test-password",
        status_jalur_saat_ini: "belum_mengajukan",
      }, { hooks: false });
      students.push(student);
      mahasiswaIds.push(student.id);
    }
    const registrations = [];
    for (const student of students) {
      const registration = await PendaftaranPenjaluran.create({
        mahasiswa_id: student.id,
        periode_penjaluran_id: period.id,
        jalur: "baru",
        program_kuliah: "reguler",
        semester_mahasiswa: 7,
        status: "approved",
        jenis_jalur_diambil: "perintisan_bisnis",
        form_lanjutan_status: "review_sekprodi",
        form_lanjutan_payload: {
          jalur: "perintisan_bisnis",
          kelompok: { id: -1, anggota: [{ mahasiswa_id: student.id }] },
        },
      });
      registrations.push(registration);
      registrationIds.push(registration.id);
    }
    const group = await KelompokPerintisanBisnis.create({
      periode_penjaluran_id: period.id,
      ketua_mahasiswa_id: students[0].id,
      status: "submitted",
    });
    groupId = group.id;
    await AnggotaKelompokPerintisan.bulkCreate(registrations.map((registration, index) => ({
      kelompok_id: group.id,
      mahasiswa_id: students[index].id,
      pendaftaran_penjaluran_id: registration.id,
      posisi: index === 0 ? "ketua" : "anggota",
      peran_tim: ["hustler", "hipster", "hacker"][index],
      jenis_pendaftaran: "baru",
    })));

    await sequelize.transaction(async (transaction) => {
      const targets = await resolveAuthoritativeAssignmentTargets({
        registration: registrations[0],
        track: "perintisan_bisnis",
        transaction,
      });
      assert.equal(targets.length, 3);
      assert.deepEqual(
        new Set(targets.map((item) => Number(item.mahasiswa_id))),
        new Set(students.map((item) => Number(item.id)))
      );
    });
  });

  await t.test("finalisasi identik idempotent dan payload berbeda menghasilkan conflict", async () => {
    const student = await Mahasiswa.create({
      nim: `T2I${suffix}`,
      nama: "Mahasiswa Idempotensi Tahap 2",
      email: `mahasiswa.idempotensi.${suffix}@test.local`,
      password: "test-password",
      status_jalur_saat_ini: "belum_mengajukan",
    }, { hooks: false });
    mahasiswaIds.push(student.id);
    const registration = await PendaftaranPenjaluran.create({
      mahasiswa_id: student.id,
      periode_penjaluran_id: periodId,
      jalur: "baru",
      program_kuliah: "reguler",
      semester_mahasiswa: 7,
      status: "approved",
      jenis_jalur_diambil: "magang",
      form_lanjutan_status: "review_sekprodi",
    });
    registrationIds.push(registration.id);

    const supervisors = [];
    for (let index = 1; index <= 2; index += 1) {
      const dosen = await Dosen.create({
        kode_dosen: `T2I${suffix}${index}`,
        nik: `${index}${suffix}`.slice(0, 9),
        nama: `Dosen Idempotensi ${index}`,
        email: `dosen.idempotensi.${suffix}.${index}@test.local`,
        password: "test-password",
        kuota_bimbingan: 10,
        status_keaktifan: "active",
        account_is_active: true,
        continue_existing_supervision: true,
      }, { hooks: false });
      supervisors.push(dosen);
      dosenIds.push(dosen.id);
      await DosenKetersediaanPeriode.create({
        dosen_id: dosen.id,
        periode_penjaluran_id: periodId,
        tersedia_membimbing: true,
        configuration_status: "ready",
      });
    }

    const first = await sequelize.transaction((transaction) => finalizePenjaluranDecision({
      registration,
      track: "magang",
      supervisorIds: [supervisors[0].id],
      currentDecisionStatus: "review_sekprodi",
      transaction,
    }));
    assert.equal(first.replayed, false);
    await student.reload();
    assert.equal(student.status_jalur_saat_ini, "magang");
    assert.equal(await PenetapanPembimbing.count({ where: { mahasiswa_id: student.id, status: "active" } }), 1);

    const replay = await sequelize.transaction((transaction) => finalizePenjaluranDecision({
      registration,
      track: "magang",
      supervisorIds: [supervisors[0].id],
      currentDecisionStatus: "approved",
      transaction,
    }));
    assert.equal(replay.replayed, true);
    assert.equal(await PenetapanPembimbing.count({ where: { mahasiswa_id: student.id } }), 1);

    await assert.rejects(
      sequelize.transaction((transaction) => finalizePenjaluranDecision({
        registration,
        track: "magang",
        supervisorIds: [supervisors[1].id],
        currentDecisionStatus: "approved",
        transaction,
      })),
      (error) => error?.code === "IDEMPOTENCY_CONFLICT"
    );
  });
});
