"use strict";

process.env.NODE_ENV = "test";
const path = require("node:path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  sequelize,
  Admin,
  Dosen,
  DosenKlaster,
  Klaster,
  Mahasiswa,
  Pengajuan,
  PeriodePenjaluran,
  PeriodeSidang,
  PendaftaranSidang,
  JadwalSidangPenguji,
  MasterPenanggungJawabPenjaluran,
  DosenKetersediaanPeriode,
  RiwayatStatusDosen,
  TindakLanjutStatusDosen,
} = require("../models");
const adminController = require("../controllers/adminController");
const sekretarisController = require("../controllers/sekretarisController");
const { validateDosenForNewAssignment } = require("../services/dosenStatusService");
const { getMahasiswaSupervisionAccess } = require("../services/mahasiswaSupervisionAccessService");

sequelize.options.logging = false;

function getJakartaDateOnly() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function createResponseRecorder() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return payload;
    },
  };
}

async function updateStatus({ adminId, dosenId, body }) {
  const req = {
    params: { id: String(dosenId) },
    body: {
      status_effective_at: getJakartaDateOnly(),
      status_reason: "Pengujian integrasi perubahan status dosen",
      ...body,
    },
    user: { id: adminId, role: "admin" },
  };
  const res = createResponseRecorder();
  await adminController.updateDosenStatus(req, res);
  assert.equal(res.statusCode, 200, res.payload?.message || "Perubahan status harus berhasil");
  assert.equal(res.payload?.success, true);
  return res.payload.data;
}

test("integrasi perubahan status dosen menjaga akun dan membuat tindak lanjut hanya saat diperlukan", async (t) => {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-10);
  const createdDosenIds = [];
  const createdMahasiswaIds = [];
  const createdClusterIds = [];
  const createdPeriodIds = [];
  const createdDefensePeriodIds = [];
  const createdDefenseRegistrationIds = [];
  const createdDefenseScheduleIds = [];
  const createdSubmissionIds = [];
  const createdMasterRoleIds = [];
  let admin = null;

  t.after(async () => {
    if (createdDosenIds.length > 0) {
      await TindakLanjutStatusDosen.destroy({ where: { dosen_id: createdDosenIds }, force: true });
      await RiwayatStatusDosen.destroy({ where: { dosen_id: createdDosenIds }, force: true });
      await DosenKetersediaanPeriode.destroy({ where: { dosen_id: createdDosenIds }, force: true });
      await DosenKlaster.destroy({ where: { dosen_id: createdDosenIds }, force: true });
    }
    if (createdDefenseScheduleIds.length > 0) {
      await JadwalSidangPenguji.destroy({ where: { id: createdDefenseScheduleIds }, force: true });
    }
    if (createdDefenseRegistrationIds.length > 0) {
      await PendaftaranSidang.destroy({ where: { id: createdDefenseRegistrationIds }, force: true });
    }
    if (createdDefensePeriodIds.length > 0) {
      await PeriodeSidang.destroy({ where: { id: createdDefensePeriodIds }, force: true });
    }
    if (createdSubmissionIds.length > 0) {
      await Pengajuan.destroy({ where: { id: createdSubmissionIds }, force: true });
    }
    if (createdMasterRoleIds.length > 0) {
      await MasterPenanggungJawabPenjaluran.destroy({ where: { id: createdMasterRoleIds }, force: true });
    }
    if (createdMahasiswaIds.length > 0) {
      await Mahasiswa.destroy({ where: { id: createdMahasiswaIds }, force: true });
    }
    if (createdPeriodIds.length > 0) {
      await PeriodePenjaluran.destroy({ where: { id: createdPeriodIds }, force: true });
    }
    if (createdDosenIds.length > 0) await Dosen.destroy({ where: { id: createdDosenIds }, force: true });
    if (createdClusterIds.length > 0) {
      await Klaster.destroy({ where: { id: createdClusterIds }, force: true });
    }
    if (admin) await admin.destroy({ force: true });
    await sequelize.close();
  });

  admin = await Admin.create({
    nip: `A${suffix}`,
    nama: `Admin Tahap 1 ${suffix}`,
    email: `admin.tahap1.${suffix}@test.local`,
    password: "test-password",
    role: "staff",
  }, { hooks: false });

  async function createDosen(number, accountIsActive = true) {
    const dosen = await Dosen.create({
      kode_dosen: `T1${suffix}${number}`,
      nik: `${number}${suffix}`.slice(0, 9),
      nama: `Dosen Tahap 1 ${number}`,
      email: `dosen.tahap1.${suffix}.${number}@test.local`,
      password: "test-password",
      kuota_bimbingan: 10,
      status_keaktifan: "active",
      account_is_active: accountIsActive,
      continue_existing_supervision: true,
    }, { hooks: false });
    createdDosenIds.push(dosen.id);
    return dosen;
  }

  async function attachActiveStudent(dosen, number) {
    const mahasiswa = await Mahasiswa.create({
      nim: `T1${suffix}${number}`,
      nama: `Mahasiswa Tahap 1 ${number}`,
      email: `mahasiswa.tahap1.${suffix}.${number}@test.local`,
      password: "test-password",
      status_jalur_saat_ini: "baru",
      dosen_pembimbing_skripsi_id: dosen.id,
    }, { hooks: false });
    createdMahasiswaIds.push(mahasiswa.id);
    return mahasiswa;
  }

  await t.test("account_is_active yang tidak dikirim mempertahankan keputusan admin sebelumnya", async () => {
    const dosen = await createDosen(1, false);
    await updateStatus({
      adminId: admin.id,
      dosenId: dosen.id,
      body: { status_keaktifan: "study_leave", continue_existing_supervision: true },
    });
    await dosen.reload();
    assert.equal(dosen.account_is_active, false);
    assert.equal(dosen.status_keaktifan, "study_leave");
    assert.equal(dosen.continue_existing_supervision, true);
  });

  await t.test("Izin Belajar dapat ditetapkan sebagai DPA sedangkan Tugas Belajar ditolak", async () => {
    const dosen = await createDosen(20);
    const mahasiswaIzin = await Mahasiswa.create({
      nim: `DPA${suffix}1`,
      nama: "Mahasiswa DPA Izin Belajar",
      email: `dpa.izin.${suffix}@test.local`,
      password: "test-password",
      status_jalur_saat_ini: "belum_mengajukan",
    }, { hooks: false });
    const mahasiswaTugas = await Mahasiswa.create({
      nim: `DPA${suffix}2`,
      nama: "Mahasiswa DPA Tugas Belajar",
      email: `dpa.tugas.${suffix}@test.local`,
      password: "test-password",
      status_jalur_saat_ini: "belum_mengajukan",
    }, { hooks: false });
    createdMahasiswaIds.push(mahasiswaIzin.id, mahasiswaTugas.id);

    await updateStatus({
      adminId: admin.id,
      dosenId: dosen.id,
      body: { status_keaktifan: "study_permission", continue_existing_supervision: false },
    });
    await dosen.reload();
    assert.equal(dosen.status_keaktifan, "study_permission");
    assert.equal(dosen.continue_existing_supervision, true);

    const izinResponse = createResponseRecorder();
    await adminController.assignDosenPembimbingAkademik({
      params: { id: String(mahasiswaIzin.id) },
      body: { dosen_pembimbing_akademik_id: dosen.id },
    }, izinResponse);
    assert.equal(izinResponse.statusCode, 200, izinResponse.payload?.message);

    await updateStatus({
      adminId: admin.id,
      dosenId: dosen.id,
      body: { status_keaktifan: "study_leave", continue_existing_supervision: true },
    });
    const tugasResponse = createResponseRecorder();
    await adminController.assignDosenPembimbingAkademik({
      params: { id: String(mahasiswaTugas.id) },
      body: { dosen_pembimbing_akademik_id: dosen.id },
    }, tugasResponse);
    assert.equal(tugasResponse.statusCode, 409);
    assert.equal(tugasResponse.payload?.code, "DPA_NOT_ELIGIBLE");
  });

  await t.test("study_leave dengan izin lanjut tidak membuat tindak lanjut penggantian", async () => {
    const dosen = await createDosen(2);
    await attachActiveStudent(dosen, 2);
    const result = await updateStatus({
      adminId: admin.id,
      dosenId: dosen.id,
      body: { status_keaktifan: "study_leave", continue_existing_supervision: true },
    });
    assert.equal(result.follow_up.replacement_required, false);
    assert.equal(await TindakLanjutStatusDosen.count({ where: { dosen_id: dosen.id, status: "open" } }), 0);
  });

  await t.test("izin bimbingan lama tetap true ketika field tidak dikirim pada update berikutnya", async () => {
    const dosen = await createDosen(7);
    await attachActiveStudent(dosen, 7);
    await updateStatus({
      adminId: admin.id,
      dosenId: dosen.id,
      body: { status_keaktifan: "study_leave", continue_existing_supervision: true },
    });
    await updateStatus({
      adminId: admin.id,
      dosenId: dosen.id,
      body: { status_keaktifan: "study_leave", account_is_active: false },
    });

    await dosen.reload();
    assert.equal(dosen.continue_existing_supervision, true);
    assert.equal(await TindakLanjutStatusDosen.count({ where: { dosen_id: dosen.id, status: "open" } }), 0);
  });

  await t.test("study_leave tanpa izin lanjut membuat satu tindak lanjut penggantian", async () => {
    const dosen = await createDosen(3);
    await attachActiveStudent(dosen, 3);
    const result = await updateStatus({
      adminId: admin.id,
      dosenId: dosen.id,
      body: { status_keaktifan: "study_leave", continue_existing_supervision: false },
    });
    assert.equal(result.follow_up.replacement_required, true);
    assert.equal(await TindakLanjutStatusDosen.count({ where: { dosen_id: dosen.id, status: "open" } }), 1);
  });

  await t.test("retired selalu mematikan akun dan izin bimbingan lama", async () => {
    const dosen = await createDosen(4);
    await attachActiveStudent(dosen, 4);
    const result = await updateStatus({
      adminId: admin.id,
      dosenId: dosen.id,
      body: {
        status_keaktifan: "retired",
        account_is_active: true,
        continue_existing_supervision: true,
      },
    });
    await dosen.reload();
    assert.equal(dosen.account_is_active, false);
    assert.equal(dosen.continue_existing_supervision, false);
    assert.equal(result.follow_up.replacement_required, true);
    assert.equal(await TindakLanjutStatusDosen.count({ where: { dosen_id: dosen.id, status: "open" } }), 1);
  });

  await t.test("perubahan status berulang mengonsolidasikan tindak lanjut menjadi satu record terbuka", async () => {
    const dosen = await createDosen(8);
    await attachActiveStudent(dosen, 8);
    await updateStatus({
      adminId: admin.id,
      dosenId: dosen.id,
      body: { status_keaktifan: "inactive", continue_existing_supervision: false },
    });
    await updateStatus({
      adminId: admin.id,
      dosenId: dosen.id,
      body: { status_keaktifan: "inactive", account_is_active: false },
    });

    assert.equal(await TindakLanjutStatusDosen.count({ where: { dosen_id: dosen.id, status: "open" } }), 1);
    assert.equal(await TindakLanjutStatusDosen.count({ where: { dosen_id: dosen.id } }), 1);
  });

  await t.test("tindak lanjut otomatis selesai setelah evaluasi ulang menemukan dampak nol", async () => {
    const dosen = await createDosen(9);
    const mahasiswa = await attachActiveStudent(dosen, 9);
    await updateStatus({
      adminId: admin.id,
      dosenId: dosen.id,
      body: { status_keaktifan: "inactive", continue_existing_supervision: false },
    });
    await mahasiswa.update({ status_jalur_saat_ini: "selesai" });
    const result = await updateStatus({
      adminId: admin.id,
      dosenId: dosen.id,
      body: { status_keaktifan: "inactive", account_is_active: false },
    });

    assert.equal(result.impact.mahasiswa_bimbingan_aktif, 0);
    assert.equal(result.tindak_lanjut_aksi, "resolved");
    assert.equal(await TindakLanjutStatusDosen.count({ where: { dosen_id: dosen.id, status: "open" } }), 0);
    assert.equal(await TindakLanjutStatusDosen.count({ where: { dosen_id: dosen.id, status: "resolved" } }), 1);
  });

  await t.test("penutupan tindak lanjut diblokir selama peran, review, dan jadwal sidang masih terdampak", async () => {
    const dosen = await createDosen(10);
    const mahasiswa = await Mahasiswa.create({
      nim: `T1${suffix}10R`,
      nama: "Mahasiswa Dampak Operasional",
      email: `mahasiswa.tahap1.${suffix}.10r@test.local`,
      password: "test-password",
      status_jalur_saat_ini: "baru",
    }, { hooks: false });
    createdMahasiswaIds.push(mahasiswa.id);

    const masterRole = await MasterPenanggungJawabPenjaluran.create({ ketua_itsc_dosen_id: dosen.id });
    createdMasterRoleIds.push(masterRole.id);
    const submission = await Pengajuan.create({
      mahasiswa_id: mahasiswa.id,
      jenis_jalur: "baru",
      tipe_pengajuan: "topik_dosen",
      topik_1_kode: `T1-${suffix}`,
      topik_1_judul: "Topik pengujian dampak review",
      dosen_pilihan_1: dosen.id,
      dosen_1_nama: dosen.nama,
      dosen_saat_ini: dosen.id,
      status: "pending",
    }, { hooks: false });
    createdSubmissionIds.push(submission.id);
    const defensePeriod = await PeriodeSidang.create({
      label_periode: `Sidang Dampak Tahap 1 ${suffix}`,
      periode: "uas",
      tahun_akademik: "2195/2196",
      semester: "genap",
      tanggal_mulai_pendaftaran: "2196-01-01",
      tanggal_selesai_pendaftaran: "2196-01-31",
      status: "closed",
    });
    createdDefensePeriodIds.push(defensePeriod.id);
    const defenseRegistration = await PendaftaranSidang.create({
      periode_sidang_id: defensePeriod.id,
      mahasiswa_id: mahasiswa.id,
      dosen_pembimbing_id: dosen.id,
      status: "scheduled",
      registered_at: new Date(),
      assigned_at: new Date(),
    });
    createdDefenseRegistrationIds.push(defenseRegistration.id);
    const defenseSchedule = await JadwalSidangPenguji.create({
      periode_sidang_id: defensePeriod.id,
      pendaftaran_sidang_id: defenseRegistration.id,
      mahasiswa_id: mahasiswa.id,
      dosen_pembimbing_id: dosen.id,
      tanggal_sidang: "2196-02-01",
      sesi_ke: 1,
      sesi_mulai: "08:00",
      sesi_selesai: "09:00",
      ruangan: "Ruang Integrasi",
      penguji1_dosen_id: dosen.id,
      penguji2_dosen_id: dosen.id,
      assignment_status: "assigned",
      generated_at: new Date(),
    });
    createdDefenseScheduleIds.push(defenseSchedule.id);

    await updateStatus({
      adminId: admin.id,
      dosenId: dosen.id,
      body: { status_keaktifan: "inactive", continue_existing_supervision: true },
    });
    const followUp = await TindakLanjutStatusDosen.findOne({ where: { dosen_id: dosen.id, status: "open" } });
    assert.ok(followUp);
    const res = createResponseRecorder();
    await sekretarisController.resolveTindakLanjutStatusDosen({
      params: { id: String(followUp.id) },
      body: { catatan_tindak_lanjut: "Belum dapat ditutup" },
      user: { id: admin.id, role: "admin" },
    }, res);

    assert.equal(res.statusCode, 409);
    assert.equal(res.payload?.code, "FOLLOW_UP_IMPACT_REMAINS");
    assert.deepEqual(
      new Set(res.payload?.detail?.required_categories || []),
      new Set(["review_pending", "penugasan_periode", "jadwal_sidang"])
    );
    await followUp.reload();
    assert.equal(followUp.status, "open");
  });

  await t.test("reaktivasi mengunci ketersediaan lama sebagai needs_review", async () => {
    const dosen = await createDosen(11);
    const period = await PeriodePenjaluran.create({
      tahun_akademik: "2194/2195",
      semester: "ganjil",
      label_periode: `Reaktivasi Tahap 1 ${suffix}`,
      tanggal_mulai: new Date("2194-08-01T00:00:00.000Z"),
      tanggal_selesai: new Date("2194-08-31T00:00:00.000Z"),
      status: "active",
      is_active: true,
    });
    createdPeriodIds.push(period.id);
    const availability = await DosenKetersediaanPeriode.create({
      dosen_id: dosen.id,
      periode_penjaluran_id: period.id,
      tersedia_membimbing: true,
      configuration_status: "ready",
    });
    await updateStatus({
      adminId: admin.id,
      dosenId: dosen.id,
      body: { status_keaktifan: "inactive", continue_existing_supervision: true },
    });
    await updateStatus({
      adminId: admin.id,
      dosenId: dosen.id,
      body: { status_keaktifan: "active" },
    });

    await availability.reload();
    assert.equal(availability.tersedia_membimbing, false);
    assert.equal(availability.configuration_status, "needs_review");
  });

  await t.test("dosen lama pada study_leave yang diizinkan tetap dapat memproses seluruh kapabilitas bimbingan", async () => {
    const dosen = await createDosen(12);
    const mahasiswa = await attachActiveStudent(dosen, 12);
    await updateStatus({
      adminId: admin.id,
      dosenId: dosen.id,
      body: { status_keaktifan: "study_leave", continue_existing_supervision: true },
    });

    const access = await getMahasiswaSupervisionAccess(mahasiswa.id);
    assert.equal(access.status, "active");
    assert.equal(access.can_create_guidance, true);
    assert.equal(access.can_submit_resume, true);
    assert.equal(access.can_upload_document, true);
    assert.equal(access.can_register_defense, true);
  });

  await t.test("preview periode tidak mewajibkan Pengabdian dan menerima dosen yang merangkap peran", async () => {
    const roleHolder = await createDosen(5);
    const requiredClusterCodes = ["ITSC", "SIRKEL", "SIBER", "MVK"];
    const existingClusters = await Klaster.findAll({ where: { kode: requiredClusterCodes } });
    const existingCodes = new Set(existingClusters.map((cluster) => cluster.kode));
    const createdClusters = await Klaster.bulkCreate(requiredClusterCodes
      .filter((code) => !existingCodes.has(code))
      .map((code) => ({ kode: code, nama: `Cluster Test ${code}` })), { returning: true });
    createdClusterIds.push(...createdClusters.map((cluster) => cluster.id));
    const clusters = [...existingClusters, ...createdClusters];
    assert.equal(clusters.length, requiredClusterCodes.length, "Empat master cluster release harus tersedia");
    await DosenKlaster.bulkCreate(clusters.map((cluster) => ({
      dosen_id: roleHolder.id,
      klaster_id: cluster.id,
    })));

    const allDosens = await Dosen.findAll({ attributes: ["id", "status_keaktifan"] });
    const res = createResponseRecorder();
    await sekretarisController.previewPeriodePendaftaran({
      body: {
        periode: {
          tahun_akademik: "2198/2199",
          semester: "ganjil",
          label_periode: `Preview Tahap 1 ${suffix}`,
          tanggal_mulai: "2198-08-01",
          tanggal_selesai: "2198-08-31",
        },
        penanggung_jawab: {
          ketua_itsc_dosen_id: roleHolder.id,
          ketua_sirkel_dosen_id: roleHolder.id,
          ketua_siber_dosen_id: roleHolder.id,
          ketua_mvk_dosen_id: roleHolder.id,
          pengawas_magang_dosen_id: roleHolder.id,
          pengawas_perintisan_bisnis_dosen_id: roleHolder.id,
        },
        ketersediaan_dosen: allDosens.map((dosen) => ({
          dosen_id: dosen.id,
          tersedia_membimbing: false,
          configuration_status: dosen.status_keaktifan === "active"
            ? "ready"
            : "locked_by_master_status",
        })),
      },
      user: { sekretaris_prodi_id: null, role: "sekretaris_prodi" },
    }, res);

    const errors = res.payload?.detail || {};
    assert.equal(errors.pengawas_pengabdian_dosen_id, undefined);
    for (const value of Object.values(errors)) {
      assert.doesNotMatch(String(value || ""), /lebih dari satu peran/i);
    }
    assert.ok([200, 400].includes(res.statusCode));

    const duplicatePeriod = await PeriodePenjaluran.create({
      tahun_akademik: "2196/2197",
      semester: "ganjil",
      label_periode: `Validasi Tahap 1 ${suffix}`,
      tanggal_mulai: new Date("2196-08-01T00:00:00.000Z"),
      tanggal_selesai: new Date("2196-08-31T23:59:59.000Z"),
      status: "closed",
      is_active: false,
    });
    createdPeriodIds.push(duplicatePeriod.id);
    const validationRes = createResponseRecorder();
    await sekretarisController.validatePeriodePendaftaran({
      body: {
        periode: {
          tahun_akademik: duplicatePeriod.tahun_akademik,
          semester: duplicatePeriod.semester,
          label_periode: `Label Baru ${suffix}`,
          tanggal_mulai: "2196-09-01",
          tanggal_selesai: "2196-09-30",
        },
        penanggung_jawab: {
          ketua_itsc_dosen_id: roleHolder.id,
          ketua_sirkel_dosen_id: roleHolder.id,
          ketua_siber_dosen_id: roleHolder.id,
          ketua_mvk_dosen_id: roleHolder.id,
          pengawas_magang_dosen_id: roleHolder.id,
          pengawas_perintisan_bisnis_dosen_id: roleHolder.id,
        },
      },
      user: { sekretaris_prodi_id: null, role: "sekretaris_prodi" },
    }, validationRes);

    assert.equal(validationRes.statusCode, 400);
    assert.match(validationRes.payload?.message || "", /sudah ada/i);
    assert.match(validationRes.payload?.detail?.periode || "", /sudah ada/i);
    assert.equal(validationRes.payload?.detail?.ketersediaan_dosen, undefined);
  });

  await t.test("service kandidat membaca perubahan status terbaru melalui policy tanpa cache", async () => {
    const dosen = await createDosen(6);
    const period = await PeriodePenjaluran.create({
      tahun_akademik: "2197/2198",
      semester: "genap",
      label_periode: `Kandidat Tahap 1 ${suffix}`,
      tanggal_mulai: new Date("2198-02-01T00:00:00.000Z"),
      tanggal_selesai: new Date("2198-02-28T00:00:00.000Z"),
      status: "closed",
      is_active: false,
    });
    createdPeriodIds.push(period.id);
    await DosenKetersediaanPeriode.create({
      dosen_id: dosen.id,
      periode_penjaluran_id: period.id,
      tersedia_membimbing: true,
      configuration_status: "ready",
    });

    const before = await validateDosenForNewAssignment(dosen.id, period.id);
    assert.equal(before.allowed, true);

    await dosen.update({ status_keaktifan: "study_leave", continue_existing_supervision: true });
    const after = await validateDosenForNewAssignment(dosen.id, period.id);
    assert.equal(after.allowed, false);
    assert.equal(after.reason, "master_status");
  });
});
