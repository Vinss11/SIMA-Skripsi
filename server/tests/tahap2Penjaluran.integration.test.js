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
  DosenKlaster,
  Klaster,
  Pengajuan,
  DosenKetersediaanPeriode,
  PenetapanPembimbing,
  PenetapanPembimbingDosen,
  Notifikasi,
  RiwayatWorkflowPenjaluran,
  AuthSecurityEvent,
} = require("../models");
const pendaftaranController = require("../controllers/pendaftaranController");
const jalurController = require("../controllers/jalurController");
const sekretarisController = require("../controllers/sekretarisController");
const {
  resolveAuthoritativeAssignmentTargets,
  resolveFinalAssignmentMetadata,
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
  const submissionIds = [];
  const createdClusterIds = [];
  const additionalPeriodIds = [];
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
    if (submissionIds.length) await Pengajuan.destroy({ where: { id: submissionIds }, force: true });
    if (dosenIds.length) await DosenKlaster.destroy({ where: { dosen_id: dosenIds }, force: true });
    if (groupId) await AnggotaKelompokPerintisan.destroy({ where: { kelompok_id: groupId }, force: true });
    if (groupId) await KelompokPerintisanBisnis.destroy({ where: { id: groupId }, force: true });
    if (registrationIds.length) await PendaftaranPenjaluran.destroy({ where: { id: registrationIds }, force: true });
    if (mahasiswaIds.length) await AuthSecurityEvent.destroy({ where: { target_type: "mahasiswa", target_id: mahasiswaIds }, force: true });
    if (dosenIds.length) await DosenKetersediaanPeriode.destroy({ where: { dosen_id: dosenIds }, force: true });
    if (additionalPeriodIds.length) await PeriodePenjaluran.destroy({ where: { id: additionalPeriodIds }, force: true });
    if (periodId) await PeriodePenjaluran.destroy({ where: { id: periodId }, force: true });
    if (mahasiswaIds.length) await Mahasiswa.destroy({ where: { id: mahasiswaIds }, force: true });
    if (dosenIds.length) await Dosen.destroy({ where: { id: dosenIds }, force: true });
    if (createdClusterIds.length) await Klaster.destroy({ where: { id: createdClusterIds }, force: true });
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
    assert.equal(result.workflow_stage, "waiting_final_decision");
    assert.equal(result.raw_workflow_status, "review_sekprodi");
    assert.deepEqual(result.allowed_actions, ["approve", "reject"]);
    assert.equal(normalizeWorkflow({ status: "draft" }).workflow_stage, "draft");
    assert.equal(normalizeWorkflow({ status: "submitted" }).workflow_stage, "under_path_review");
    assert.equal(normalizeWorkflow({ status: "approved" }).workflow_stage, "approved");
  });

  await t.test("endpoint Perintisan menjalankan submit, review Pengampu, dan final Sekprodi untuk seluruh anggota", async () => {
    const reviewer = await Dosen.create({
      kode_dosen: `T2R${suffix}`,
      nik: `5${suffix}`.slice(0, 9),
      nama: "Pengampu Perintisan Tahap 2",
      email: `pengampu.perintisan.${suffix}@test.local`,
      password: "test-password",
      kuota_bimbingan: 10,
      status_keaktifan: "active",
      account_is_active: true,
      continue_existing_supervision: true,
    }, { hooks: false });
    dosenIds.push(reviewer.id);

    const now = Date.now();
    const period = await PeriodePenjaluran.create({
      tahun_akademik: "2026/2027",
      semester: "ganjil",
      label_periode: `Tahap 2 ${suffix}`,
      tanggal_mulai: new Date(now - 24 * 60 * 60 * 1000),
      tanggal_selesai: new Date(now + 24 * 60 * 60 * 1000),
      status: "active",
      is_active: true,
      pengawas_perintisan_bisnis_dosen_id: reviewer.id,
    });
    periodId = period.id;
    await DosenKetersediaanPeriode.create({
      dosen_id: reviewer.id,
      periode_penjaluran_id: period.id,
      tersedia_membimbing: true,
      configuration_status: "ready",
    });

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
        form_lanjutan_status: "draft",
      });
      registrations.push(registration);
      registrationIds.push(registration.id);
    }
    const group = await KelompokPerintisanBisnis.create({
      periode_penjaluran_id: period.id,
      ketua_mahasiswa_id: students[0].id,
      status: "draft",
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

    const submitResponse = responseRecorder();
    await jalurController.submitFormNonPenelitian({
      body: {
        jalur: "perintisan_bisnis",
        payload: {
          nama_bisnis: "SIMA Venture",
          jenis_bisnis: "Teknologi pendidikan",
          lokasi_bisnis: "Bandung",
          deskripsi_bisnis: "Platform kolaborasi akademik untuk mempercepat proses tugas akhir.",
          masalah_yang_diselesaikan: "Proses akademik masih tersebar dan sulit dipantau oleh pengguna.",
          produk_layanan: "Layanan pengelolaan workflow akademik terintegrasi untuk perguruan tinggi.",
          target_konsumen: "Mahasiswa, dosen, dan pengelola program studi di perguruan tinggi.",
          model_bisnis: "Berlangganan perangkat lunak per program studi setiap semester akademik.",
          tahap_perkembangan: "Purwarupa sudah diuji oleh kelompok pada lingkungan pengembangan.",
          rencana_kegiatan: "Validasi kebutuhan, pengujian pengguna, dan penyempurnaan model bisnis.",
          target_luaran: "Purwarupa tervalidasi dan laporan pengujian pengguna yang terdokumentasi.",
        },
      },
      user: { id: students[0].id, role: "mahasiswa" },
      files: {},
    }, submitResponse);
    assert.equal(submitResponse.statusCode, 201, submitResponse.payload?.message);
    assert.equal(await PendaftaranPenjaluran.count({
      where: { id: registrations.map((item) => item.id), form_lanjutan_status: "submitted" },
    }), 3);
    assert.equal(await RiwayatWorkflowPenjaluran.count({
      where: { pendaftaran_penjaluran_id: registrations.map((item) => item.id), event_type: "form_submitted" },
    }), 3);

    const reviewResponse = responseRecorder();
    await jalurController.approvePerintisanBisnisReviewByDosen({
      params: { id: String(registrations[0].id) },
      body: { keterangan: "Model bisnis dan pembagian peran kelompok layak." },
      user: { id: reviewer.id, role: "dosen" },
    }, reviewResponse);
    assert.equal(reviewResponse.statusCode, 200, reviewResponse.payload?.message);
    assert.equal(await PendaftaranPenjaluran.count({
      where: { id: registrations.map((item) => item.id), form_lanjutan_status: "review_sekprodi" },
    }), 3);
    await Promise.all(registrations.map((registration) => registration.reload()));

    await sequelize.transaction(async (transaction) => {
      const leaderRegistration = await PendaftaranPenjaluran.findByPk(registrations[0].id, { transaction });
      const targets = await resolveAuthoritativeAssignmentTargets({
        registration: leaderRegistration,
        track: "perintisan_bisnis",
        transaction,
      });
      assert.equal(targets.length, 3);
      assert.deepEqual(
        new Set(targets.map((item) => Number(item.mahasiswa_id))),
        new Set(students.map((item) => Number(item.id)))
      );
    });

    await registrations[1].update({ form_lanjutan_status: "submitted" });
    await assert.rejects(
      sequelize.transaction((transaction) => resolveAuthoritativeAssignmentTargets({
        registration: registrations[0],
        track: "perintisan_bisnis",
        transaction,
      })),
      (error) => error?.code === "GROUP_WORKFLOW_MISMATCH"
    );
    await registrations[1].update({ form_lanjutan_status: "review_sekprodi" });

    await group.update({ ketua_mahasiswa_id: students[1].id });
    await assert.rejects(
      sequelize.transaction((transaction) => resolveAuthoritativeAssignmentTargets({
        registration: registrations[0],
        track: "perintisan_bisnis",
        transaction,
      })),
      (error) => error?.code === "INVALID_GROUP_COMPOSITION"
    );
    await group.update({ ketua_mahasiswa_id: students[0].id });

    const groupSupervisor = await Dosen.create({
      kode_dosen: `T2G${suffix}`,
      nik: `7${suffix}`.slice(0, 9),
      nama: "Dosen Kelompok Tahap 2",
      email: `dosen.kelompok.${suffix}@test.local`,
      password: "test-password",
      kuota_bimbingan: 10,
      status_keaktifan: "active",
      account_is_active: true,
      continue_existing_supervision: true,
    }, { hooks: false });
    dosenIds.push(groupSupervisor.id);
    await DosenKetersediaanPeriode.create({
      dosen_id: groupSupervisor.id,
      periode_penjaluran_id: period.id,
      tersedia_membimbing: true,
      configuration_status: "ready",
    });
    const finalResponse = responseRecorder();
    await jalurController.approveNonPenelitianReviewBySekretaris({
      params: { id: String(registrations[0].id) },
      body: { keterangan: "Kelompok lengkap dan layak", dosen_pembimbing_id: groupSupervisor.id },
      user: { id: 900003, role: "sekretaris_prodi", program_kuliah: "reguler" },
    }, finalResponse);
    assert.equal(finalResponse.statusCode, 200, finalResponse.payload?.message);
    assert.equal(await PenetapanPembimbing.count({
      where: { mahasiswa_id: students.map((item) => item.id), status: "active" },
    }), 3);
    assert.equal(await PenetapanPembimbingDosen.count({
      where: { dosen_id: groupSupervisor.id, urutan: 1, status: "active" },
    }), 3);
    assert.equal(await RiwayatWorkflowPenjaluran.count({
      where: { pendaftaran_penjaluran_id: registrations.map((item) => item.id), event_type: "final_decision" },
    }), 3);
    assert.equal(await Notifikasi.count({
      where: { recipient_type: "mahasiswa", recipient_id: students.map((item) => item.id) },
    }) >= 12, true);
    await group.reload();
    assert.equal(group.status, "approved");
  });

  await t.test("NIM bebas dapat bootstrap akun dan pendaftaran ketika periode dibuka", async () => {
    const nim = `BEBAS-${suffix}`;
    const dpa = await Dosen.findByPk(dosenIds[0]);
    assert.ok(dpa);

    const initialCheck = responseRecorder();
    await pendaftaranController.checkNimAvailability({ query: { nim } }, initialCheck);
    assert.equal(initialCheck.statusCode, 200);
    assert.equal(initialCheck.payload?.data?.status, "new_account_allowed");
    assert.equal(initialCheck.payload?.data?.master_found, false);

    const submitted = responseRecorder();
    await pendaftaranController.submitPendaftaranJalurBaru({
      body: {
        nim,
        nama: "Mahasiswa NIM Bebas",
        email: `${nim}@students.uii.ac.id`,
        program_kuliah: "reguler",
        pendaftaran: "baru",
        jenis_jalur_diambil: "penelitian",
        dosen_pembimbing_akademik_id: dpa.id,
      },
    }, submitted);
    assert.equal(submitted.statusCode, 201);
    assert.equal(submitted.payload?.data?.account_created, true);
    assert.equal(submitted.payload?.data?.credential_state, "default");
    assert.equal(Object.hasOwn(submitted.payload?.data || {}, "password"), false);
    assert.equal(Object.hasOwn(submitted.payload?.data || {}, "default_password"), false);

    const student = await Mahasiswa.findOne({ where: { nim } });
    assert.ok(student);
    mahasiswaIds.push(student.id);
    assert.equal(await student.comparePassword(nim), true);
    assert.equal(student.credential_state, "default");
    const registration = await PendaftaranPenjaluran.findOne({
      where: { mahasiswa_id: student.id, periode_penjaluran_id: periodId },
    });
    assert.ok(registration);
    registrationIds.push(registration.id);

    const duplicateCheck = responseRecorder();
    await pendaftaranController.checkNimAvailability({ query: { nim } }, duplicateCheck);
    assert.equal(duplicateCheck.payload?.data?.status, "already_registered");
  });

  await t.test("finalizer menolak jalur pendaftaran dan status approval yang tidak sesuai", async () => {
    const registration = await PendaftaranPenjaluran.findByPk(registrationIds[0]);
    await assert.rejects(
      sequelize.transaction((transaction) => resolveAuthoritativeAssignmentTargets({
        registration,
        track: "magang",
        transaction,
      })),
      (error) => error?.code === "REGISTRATION_TRACK_MISMATCH"
    );

    await registration.update({ status: "submitted" });
    await assert.rejects(
      sequelize.transaction((transaction) => resolveAuthoritativeAssignmentTargets({
        registration,
        track: "perintisan_bisnis",
        transaction,
      })),
      (error) => error?.code === "REGISTRATION_NOT_APPROVED"
    );
    await registration.update({ status: "approved" });
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
    const firstAssignment = await PenetapanPembimbing.findOne({
      where: { mahasiswa_id: student.id, status: "active" },
    });
    assert.equal(firstAssignment.sumber_data, "penjaluran");
    assert.equal(firstAssignment.semester_penjaluran_ke, 1);

    await registration.update({ form_lanjutan_status: "approved" });

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

    const nextPeriod = await PeriodePenjaluran.create({
      tahun_akademik: "2197/2198",
      semester: "genap",
      label_periode: `Siklus Ulang Tahap 2 ${suffix}`,
      tanggal_mulai: new Date("2198-02-01T00:00:00.000Z"),
      tanggal_selesai: new Date("2198-02-28T00:00:00.000Z"),
      status: "closed",
      is_active: false,
    });
    additionalPeriodIds.push(nextPeriod.id);
    await DosenKetersediaanPeriode.create({
      dosen_id: supervisors[0].id,
      periode_penjaluran_id: nextPeriod.id,
      tersedia_membimbing: true,
      configuration_status: "ready",
    });
    const repeatRegistration = await PendaftaranPenjaluran.create({
      mahasiswa_id: student.id,
      periode_penjaluran_id: nextPeriod.id,
      jalur: "ulang",
      program_kuliah: "reguler",
      semester_mahasiswa: 8,
      status: "approved",
      jenis_jalur_diambil: "magang",
      penjaluran_sebelumnya: "magang",
      form_lanjutan_status: "review_sekprodi",
    });
    registrationIds.push(repeatRegistration.id);
    await sequelize.transaction((transaction) => finalizePenjaluranDecision({
      registration: repeatRegistration,
      track: "magang",
      supervisorIds: [supervisors[0].id],
      currentDecisionStatus: "review_sekprodi",
      transaction,
    }));
    const repeatAssignment = await PenetapanPembimbing.findOne({
      where: { mahasiswa_id: student.id, status: "active" },
    });
    assert.equal(repeatAssignment.pendaftaran_penjaluran_id, repeatRegistration.id);
    assert.equal(repeatAssignment.sumber_data, "penjaluran");
    assert.equal(repeatAssignment.semester_penjaluran_ke, 1);
  });

  await t.test("metadata penetapan memperlakukan baru, ulang, dan alih sebagai awal siklus", () => {
    for (const jalur of ["baru", "ulang", "alih"]) {
      assert.deepEqual(resolveFinalAssignmentMetadata({ jalur }), {
        sumberData: "penjaluran",
        semesterPenjaluranKe: 1,
      });
    }
  });

  await t.test("endpoint final Penelitian menolak cluster salah lalu mengaktifkan penetapan yang valid", async () => {
    const student = await Mahasiswa.create({
      nim: `T2P${suffix}`,
      nama: "Mahasiswa Penelitian Tahap 2",
      email: `mahasiswa.penelitian.${suffix}@test.local`,
      password: "test-password",
      status_jalur_saat_ini: "sedang_mengajukan",
    }, { hooks: false });
    mahasiswaIds.push(student.id);
    const registration = await PendaftaranPenjaluran.create({
      mahasiswa_id: student.id,
      periode_penjaluran_id: periodId,
      jalur: "baru",
      program_kuliah: "reguler",
      semester_mahasiswa: 7,
      status: "approved",
      jenis_jalur_diambil: "penelitian",
      form_lanjutan_status: "draft",
    });
    registrationIds.push(registration.id);
    const supervisor = await Dosen.create({
      kode_dosen: `T2P${suffix}`,
      nik: `6${suffix}`.slice(0, 9),
      nama: "Dosen Penelitian Tahap 2",
      email: `dosen.penelitian.${suffix}@test.local`,
      password: "test-password",
      kuota_bimbingan: 10,
      status_keaktifan: "active",
      account_is_active: true,
      continue_existing_supervision: true,
    }, { hooks: false });
    dosenIds.push(supervisor.id);
    await DosenKetersediaanPeriode.create({
      dosen_id: supervisor.id,
      periode_penjaluran_id: periodId,
      tersedia_membimbing: true,
      configuration_status: "ready",
    });
    const submission = await Pengajuan.create({
      mahasiswa_id: student.id,
      pendaftaran_penjaluran_id: registration.id,
      jenis_jalur: "baru",
      tipe_pengajuan: "judul_mandiri",
      judul_mandiri: "Riset sistem informasi terintegrasi",
      deskripsi_mandiri: "Penelitian integrasi workflow akademik.",
      keyword_mandiri: "workflow, akademik",
      cluster_mandiri: "ITSC",
      prospective_supervisor_id: supervisor.id,
      is_approved_by_supervisor: true,
      status: "menunggu_approval_sekprodi",
    });
    submissionIds.push(submission.id);
    const makeRequest = () => ({
      params: { id: String(submission.id) },
      body: { keterangan: "Layak difinalisasi", dosen_pembimbing_1_id: supervisor.id },
      user: { id: 900004, role: "sekretaris_prodi", program_kuliah: "reguler" },
    });
    const crossProgramResponse = responseRecorder();
    await sekretarisController.approvePenelitianFinal({
      ...makeRequest(),
      user: { id: 900005, role: "sekretaris_prodi", program_kuliah: "internasional" },
    }, crossProgramResponse);
    assert.equal(crossProgramResponse.statusCode, 404);
    const wrongClusterResponse = responseRecorder();
    await sekretarisController.approvePenelitianFinal(makeRequest(), wrongClusterResponse);
    assert.equal(wrongClusterResponse.statusCode, 409);
    assert.equal(wrongClusterResponse.payload?.code, "SUPERVISOR_CLUSTER_MISMATCH");
    assert.equal(await PenetapanPembimbing.count({ where: { mahasiswa_id: student.id } }), 0);

    let cluster = await Klaster.findOne({ where: { kode: "ITSC" } });
    if (!cluster) {
      cluster = await Klaster.create({ kode: "ITSC", nama: "Informatika Teori & Sistem Cerdas" });
      createdClusterIds.push(cluster.id);
    }
    await DosenKlaster.create({ dosen_id: supervisor.id, klaster_id: cluster.id });
    const successResponse = responseRecorder();
    await sekretarisController.approvePenelitianFinal(makeRequest(), successResponse);
    assert.equal(successResponse.statusCode, 200, successResponse.payload?.message);
    await submission.reload();
    assert.equal(submission.status, "approved");
    assert.equal(await PenetapanPembimbing.count({ where: { mahasiswa_id: student.id, status: "active" } }), 1);
  });

  await t.test("endpoint final Magang idempotent terhadap request paralel dan membuat satu penetapan", async () => {
    const student = await Mahasiswa.create({
      nim: `T2E${suffix}`,
      nama: "Mahasiswa Endpoint Magang Tahap 2",
      email: `mahasiswa.endpoint.magang.${suffix}@test.local`,
      password: "test-password",
      status_jalur_saat_ini: "sedang_mengajukan",
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
      form_lanjutan_payload: {
        jalur: "magang",
        workflow_status: "review_sekprodi",
        workflow_timeline: [],
      },
    });
    registrationIds.push(registration.id);
    const supervisor = await Dosen.create({
      kode_dosen: `T2E${suffix}`,
      nik: `8${suffix}`.slice(0, 9),
      nama: "Dosen Endpoint Magang",
      email: `dosen.endpoint.magang.${suffix}@test.local`,
      password: "test-password",
      kuota_bimbingan: 10,
      status_keaktifan: "active",
      account_is_active: true,
      continue_existing_supervision: true,
    }, { hooks: false });
    dosenIds.push(supervisor.id);
    await DosenKetersediaanPeriode.create({
      dosen_id: supervisor.id,
      periode_penjaluran_id: periodId,
      tersedia_membimbing: true,
      configuration_status: "ready",
    });

    const makeRequest = () => ({
      params: { id: String(registration.id) },
      body: { keterangan: "Disetujui melalui pengujian endpoint", dosen_pembimbing_id: supervisor.id },
      user: { id: 900001, role: "sekretaris_prodi", program_kuliah: "reguler" },
    });
    const firstResponse = responseRecorder();
    const secondResponse = responseRecorder();
    await supervisor.update({ status_keaktifan: "study_leave" });
    const staleModalResponse = responseRecorder();
    await jalurController.approveNonPenelitianReviewBySekretaris(makeRequest(), staleModalResponse);
    assert.equal(staleModalResponse.statusCode, 409);
    assert.equal(staleModalResponse.payload?.code, "SUPERVISOR_NOT_ELIGIBLE");
    assert.equal(await PenetapanPembimbing.count({ where: { mahasiswa_id: student.id } }), 0);
    await supervisor.update({ status_keaktifan: "active", kuota_bimbingan: 0 });
    const fullQuotaResponse = responseRecorder();
    await jalurController.approveNonPenelitianReviewBySekretaris(makeRequest(), fullQuotaResponse);
    assert.equal(fullQuotaResponse.statusCode, 409);
    assert.equal(fullQuotaResponse.payload?.code, "SUPERVISOR_NOT_ELIGIBLE");
    await supervisor.update({ kuota_bimbingan: 10 });
    await Promise.all([
      jalurController.approveNonPenelitianReviewBySekretaris(makeRequest(), firstResponse),
      jalurController.approveNonPenelitianReviewBySekretaris(makeRequest(), secondResponse),
    ]);

    assert.equal(firstResponse.statusCode, 200, firstResponse.payload?.message);
    assert.equal(secondResponse.statusCode, 200, secondResponse.payload?.message);
    assert.equal([firstResponse.payload?.replayed, secondResponse.payload?.replayed].filter(Boolean).length, 1);
    await registration.reload();
    assert.equal(registration.form_lanjutan_status, "approved");
    const assignments = await PenetapanPembimbing.findAll({ where: { mahasiswa_id: student.id } });
    assert.equal(assignments.length, 1);
    assert.equal(assignments[0].status, "active");
    assert.equal(assignments[0].sumber_data, "penjaluran");
    assert.equal(assignments[0].semester_penjaluran_ke, 1);
    assert.equal(await Notifikasi.count({
      where: { recipient_type: "mahasiswa", recipient_id: student.id },
    }), 1);
    const workflowHistory = await RiwayatWorkflowPenjaluran.findAll({
      where: { pendaftaran_penjaluran_id: registration.id },
    });
    assert.equal(workflowHistory.length, 1);
    assert.equal(workflowHistory[0].event_type, "final_decision");
    assert.equal(workflowHistory[0].workflow_stage, "approved");
  });

  await t.test("penolakan final nonpenelitian mencatat histori dan notifikasi tepat satu kali", async () => {
    const student = await Mahasiswa.create({
      nim: `T2R${suffix}`,
      nama: "Mahasiswa Penolakan Tahap 2",
      email: `mahasiswa.penolakan.${suffix}@test.local`,
      password: "test-password",
      status_jalur_saat_ini: "sedang_mengajukan",
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
      form_lanjutan_payload: { jalur: "magang", workflow_status: "review_sekprodi", workflow_timeline: [] },
    });
    registrationIds.push(registration.id);
    const request = {
      params: { id: String(registration.id) },
      body: { keterangan: "Dokumen magang belum memenuhi ketentuan" },
      user: { id: 900002, role: "sekretaris_prodi", program_kuliah: "reguler" },
    };
    const firstResponse = responseRecorder();
    await jalurController.rejectNonPenelitianReviewBySekretaris(request, firstResponse);
    assert.equal(firstResponse.statusCode, 200, firstResponse.payload?.message);
    const replayResponse = responseRecorder();
    await jalurController.rejectNonPenelitianReviewBySekretaris(request, replayResponse);
    assert.equal(replayResponse.statusCode, 200, replayResponse.payload?.message);
    assert.equal(replayResponse.payload?.replayed, true);
    assert.equal(await RiwayatWorkflowPenjaluran.count({
      where: { pendaftaran_penjaluran_id: registration.id, event_type: "final_decision" },
    }), 1);
    assert.equal(await Notifikasi.count({
      where: {
        recipient_type: "mahasiswa",
        recipient_id: student.id,
        type: "penjaluran_final_rejected_student",
      },
    }), 1);
  });
});
