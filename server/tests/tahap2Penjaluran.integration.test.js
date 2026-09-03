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
  Topik,
  DosenKlaster,
  Klaster,
  Pengajuan,
  RiwayatPersetujuan,
  DosenKetersediaanPeriode,
  PenetapanPembimbing,
  PenetapanPembimbingDosen,
  Notifikasi,
  RiwayatWorkflowPenjaluran,
  AuthSecurityEvent,
  DokumenSidang,
  BidangPenelitian,
  PengajuanBidangPenelitian,
} = require("../models");
const pendaftaranController = require("../controllers/pendaftaranController");
const jalurController = require("../controllers/jalurController");
const dosenController = require("../controllers/dosenController");
const sekretarisController = require("../controllers/sekretarisController");
const {
  resolveAuthoritativeAssignmentTargets,
  resolveFinalAssignmentMetadata,
  finalizePenjaluranDecision,
} = require("../services/penjaluranFinalizationService");
const { normalizeWorkflow } = require("../services/penjaluranWorkflowService");
const { isUlangOrAlih } = require("../services/dokumenSidangCycleService");
const { finalizeTopikParallelSubmission } = require("../services/topikParallelReviewService");

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
  const topikCodes = [];
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
    if (mahasiswaIds.length) {
      await Mahasiswa.update({ pengajuan_aktif_id: null }, { where: { id: mahasiswaIds } });
    }
    if (submissionIds.length) {
      await RiwayatPersetujuan.destroy({ where: { pengajuan_id: submissionIds }, force: true });
    }
    if (submissionIds.length) await Pengajuan.destroy({ where: { id: submissionIds }, force: true });
    if (topikCodes.length) await Topik.destroy({ where: { kode: topikCodes }, force: true });
    if (dosenIds.length) await DosenKlaster.destroy({ where: { dosen_id: dosenIds }, force: true });
    if (groupId) await AnggotaKelompokPerintisan.destroy({ where: { kelompok_id: groupId }, force: true });
    if (groupId) await KelompokPerintisanBisnis.destroy({ where: { id: groupId }, force: true });
    if (registrationIds.length) await PendaftaranPenjaluran.destroy({ where: { id: registrationIds }, force: true });
    if (mahasiswaIds.length) await DokumenSidang.destroy({ where: { mahasiswa_id: mahasiswaIds }, force: true });
    if (mahasiswaIds.length) await AuthSecurityEvent.destroy({ where: { target_type: "mahasiswa", target_id: mahasiswaIds }, force: true });
    if (dosenIds.length) await DosenKetersediaanPeriode.destroy({ where: { dosen_id: dosenIds }, force: true });
    if (additionalPeriodIds.length) await PeriodePenjaluran.destroy({ where: { id: additionalPeriodIds }, force: true });
    if (periodId) await PeriodePenjaluran.destroy({ where: { id: periodId }, force: true });
    if (mahasiswaIds.length) await Mahasiswa.destroy({ where: { id: mahasiswaIds }, force: true });
    if (dosenIds.length) await Dosen.destroy({ where: { id: dosenIds }, force: true });
    if (createdClusterIds.length) await Klaster.destroy({ where: { id: createdClusterIds }, force: true });
    await sequelize.close();
  });

  await t.test("endpoint umum menolak jenis pendaftaran di luar Baru dan onboarding Ulang/Alih", async () => {
    const res = responseRecorder();
    await pendaftaranController.submitPendaftaranJalurBaru({
      body: { pendaftaran: "tidak-valid" },
    }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.payload?.code, "INVALID_REGISTRATION_TYPE");
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
        dosen_pembimbing_akademik_id: reviewer.id,
      });
      registrations.push(registration);
      registrationIds.push(registration.id);
    }
    const candidatesResponse = responseRecorder();
    await jalurController.getPerintisanGroupCandidates({
      user: { id: students[0].id, role: "mahasiswa" },
    }, candidatesResponse);
    assert.equal(candidatesResponse.statusCode, 200, candidatesResponse.payload?.message);
    assert.deepEqual(
      new Set(candidatesResponse.payload?.data?.kandidat?.map((item) => Number(item.pendaftaran_id))),
      new Set(registrations.slice(1).map((item) => Number(item.id)))
    );
    assert.equal(Number(candidatesResponse.payload?.data?.ketua?.dpa?.id), Number(reviewer.id));
    assert.ok(candidatesResponse.payload?.data?.kandidat?.every((item) => Number(item.dpa?.id) === Number(reviewer.id)));

    const createGroupResponse = responseRecorder();
    await jalurController.createPerintisanGroup({
      user: { id: students[0].id, role: "mahasiswa" },
      body: {
        peran_tim: "hustler",
        anggota: [
          { pendaftaran_id: registrations[1].id, peran_tim: "hipster" },
          { pendaftaran_id: registrations[2].id, peran_tim: "hacker" },
        ],
      },
    }, createGroupResponse);
    assert.equal(createGroupResponse.statusCode, 201, createGroupResponse.payload?.message);
    assert.ok(createGroupResponse.payload?.data?.kelompok?.anggota?.every(
      (item) => Number(item.dpa?.id) === Number(reviewer.id)
    ));
    groupId = createGroupResponse.payload?.data?.kelompok?.id;
    let group = await KelompokPerintisanBisnis.findByPk(groupId);
    assert.ok(group);
    assert.equal(group.nama_kelompok, null);
    assert.equal(group.jenis_bisnis, null);
    assert.equal(await AnggotaKelompokPerintisan.count({ where: { kelompok_id: groupId } }), 3);

    const memberSubmitResponse = responseRecorder();
    await jalurController.submitFormNonPenelitian({
      body: { jalur: "perintisan_bisnis", payload: {} },
      user: { id: students[1].id, role: "mahasiswa" },
      files: {},
    }, memberSubmitResponse);
    assert.equal(memberSubmitResponse.statusCode, 403, memberSubmitResponse.payload?.message);
    assert.equal(memberSubmitResponse.payload?.code, "GROUP_LEADER_REQUIRED");

    const submitResponse = responseRecorder();
    await jalurController.submitFormNonPenelitian({
      body: {
        jalur: "perintisan_bisnis",
        payload: {
          nama_kelompok: "Kelompok SIMA Venture",
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
    group = await KelompokPerintisanBisnis.findByPk(groupId);
    assert.equal(group.nama_kelompok, "Kelompok SIMA Venture");
    assert.equal(group.jenis_bisnis, "Teknologi pendidikan");
    assert.equal(await PendaftaranPenjaluran.count({
      where: { id: registrations.map((item) => item.id), form_lanjutan_status: "submitted" },
    }), 3);
    assert.equal(await RiwayatWorkflowPenjaluran.count({
      where: { pendaftaran_penjaluran_id: registrations.map((item) => item.id), event_type: "form_submitted" },
    }), 3);

    const revisionResponse = responseRecorder();
    await jalurController.requestPerintisanBisnisRevisionByDosen({
      params: { id: String(registrations[0].id) },
      body: { keterangan: "Perjelas target pengguna dan rencana validasi bisnis." },
      user: { id: reviewer.id, role: "dosen" },
    }, revisionResponse);
    assert.equal(revisionResponse.statusCode, 200, revisionResponse.payload?.message);
    assert.equal(await PendaftaranPenjaluran.count({
      where: { id: registrations.map((item) => item.id), form_lanjutan_status: "draft" },
    }), 3);
    group = await KelompokPerintisanBisnis.findByPk(groupId);
    assert.equal(group.status, "needs_review");
    await registrations[0].reload();
    const retainedRevisionPayload = registrations[0].form_lanjutan_payload;
    assert.equal(retainedRevisionPayload.nama_bisnis, "SIMA Venture");
    assert.equal(retainedRevisionPayload.lokasi_bisnis, "Bandung");
    assert.equal(retainedRevisionPayload.workflow_status, "revision_required");
    assert.equal(
      retainedRevisionPayload.review_dosen_pengampu?.note,
      "Perjelas target pengguna dan rencana validasi bisnis."
    );

    const resubmitResponse = responseRecorder();
    await jalurController.submitFormNonPenelitian({
      body: { jalur: "perintisan_bisnis", payload: retainedRevisionPayload },
      user: { id: students[0].id, role: "mahasiswa" },
      files: {},
    }, resubmitResponse);
    assert.equal(resubmitResponse.statusCode, 201, resubmitResponse.payload?.message);
    assert.equal(await PendaftaranPenjaluran.count({
      where: { id: registrations.map((item) => item.id), form_lanjutan_status: "submitted" },
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

  await t.test("NIM berformat YY523NNN dapat bootstrap akun dan format lain ditolak", async () => {
    const nim = `22523${suffix.slice(-3)}`;
    const dpa = await Dosen.findByPk(dosenIds[0]);
    assert.ok(dpa);

    await dpa.update({ status_keaktifan: "study_permission", continue_existing_supervision: true });
    const dpaOptionsResponse = responseRecorder();
    await pendaftaranController.getDosenDropdown({}, dpaOptionsResponse);
    const izinBelajarOption = dpaOptionsResponse.payload?.data?.find((item) => Number(item.id) === Number(dpa.id));
    assert.ok(izinBelajarOption, "dosen Izin Belajar tampil pada pilihan DPA");
    assert.equal(izinBelajarOption.can_be_dpa, true);
    assert.equal(izinBelajarOption.can_receive_new_supervision, false);

    await dpa.update({
      status_keaktifan: "retired",
      account_is_active: false,
      continue_existing_supervision: false,
    });
    const regularDpaOptionsResponse = responseRecorder();
    await pendaftaranController.getDosenDropdown({ query: {} }, regularDpaOptionsResponse);
    assert.equal(
      regularDpaOptionsResponse.payload?.data?.some((item) => Number(item.id) === Number(dpa.id)),
      false,
      "dosen pensiun tidak tampil pada pilihan DPA",
    );

    const historicalDosenOptionsResponse = responseRecorder();
    await pendaftaranController.getDosenDropdown({ query: { scope: "history" } }, historicalDosenOptionsResponse);
    const retiredHistoricalOption = historicalDosenOptionsResponse.payload?.data?.find(
      (item) => Number(item.id) === Number(dpa.id),
    );
    assert.ok(retiredHistoricalOption, "dosen pensiun tetap tampil pada pilihan pembimbing sebelumnya");
    assert.equal(retiredHistoricalOption.status_keaktifan, "retired");

    await dpa.update({
      status_keaktifan: "active",
      account_is_active: true,
      continue_existing_supervision: true,
    });

    const changeNim = `23523${suffix.slice(-3)}`;
    const changeSubmitted = responseRecorder();
    await pendaftaranController.submitPendaftaranJalurBaru({
      body: {
        nim: changeNim,
        nama: "Mahasiswa Bootstrap Ulang",
        email: `${changeNim}@students.uii.ac.id`,
        program_kuliah: "reguler",
        pendaftaran: "ulang_alih",
        dosen_pembimbing_akademik_id: dpa.id,
      },
    }, changeSubmitted);
    assert.equal(changeSubmitted.statusCode, 201, changeSubmitted.payload?.message);
    assert.equal(changeSubmitted.payload?.data?.pendaftaran_id, null);
    assert.equal(changeSubmitted.payload?.data?.next_action?.target_form, "ulang_alih");
    assert.equal(changeSubmitted.payload?.data?.next_action?.registration_type, null);
    assert.equal(changeSubmitted.payload?.data?.next_action?.registration_scope, "ulang_alih");
    const changeStudent = await Mahasiswa.findOne({ where: { nim: changeNim } });
    assert.ok(changeStudent);
    mahasiswaIds.push(changeStudent.id);
    assert.equal(changeStudent.pending_registration_type, "ulang_alih");
    assert.equal(await PendaftaranPenjaluran.count({ where: { mahasiswa_id: changeStudent.id } }), 0);

    const invalidCheck = responseRecorder();
    await pendaftaranController.checkNimAvailability({ query: { nim: "22111001" } }, invalidCheck);
    assert.equal(invalidCheck.statusCode, 400);
    assert.equal(invalidCheck.payload?.code, "NIM_FORMAT_INVALID");
    assert.equal(invalidCheck.payload?.detail?.field, "nim");

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
        calon_dosen_pembimbing_id: dpa.id,
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
    assert.equal(registration.calon_dosen_pembimbing_id, dpa.id, "preferensi calon pembimbing tersimpan");
    assert.equal(registration.dosen_pembimbing_ta_id, null, "preferensi tidak menjadi pembimbing final");
    registrationIds.push(registration.id);

    const duplicateCheck = responseRecorder();
    await pendaftaranController.checkNimAvailability({ query: { nim } }, duplicateCheck);
    assert.equal(duplicateCheck.payload?.data?.status, "already_registered");

    const duplicateSubmit = responseRecorder();
    await pendaftaranController.submitPendaftaranJalurBaru({
      body: {
        nim,
        nama: "Mahasiswa NIM Duplikat",
        program_kuliah: "reguler",
        pendaftaran: "baru",
        jenis_jalur_diambil: "penelitian",
        dosen_pembimbing_akademik_id: dpa.id,
      },
    }, duplicateSubmit);
    assert.equal(duplicateSubmit.statusCode, 409);
    assert.equal(duplicateSubmit.payload?.code, "NIM_ALREADY_EXISTS");
    assert.equal(duplicateSubmit.payload?.detail?.field, "nim");
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

    const defenseDocuments = await DokumenSidang.create({
      mahasiswa_id: student.id,
      transkrip_file_path: "uploads/sidang-dokumen/test-transkrip-lama.pdf",
      transkrip_file_name: "transkrip-lama.pdf",
      transkrip_status: "approved",
      transkrip_uploaded_at: new Date("2197-01-01T00:00:00.000Z"),
      transkrip_review_note: "Dokumen siklus pertama",
      transkrip_reviewed_at: new Date("2197-01-02T00:00:00.000Z"),
      cept_file_path: "uploads/sidang-dokumen/test-cept-lama.pdf",
      cept_file_name: "cept-lama.pdf",
      cept_status: "revisi",
      cept_uploaded_at: new Date("2197-01-01T00:00:00.000Z"),
      cept_review_note: "Perlu revisi pada siklus pertama",
      cept_reviewed_at: new Date("2197-01-02T00:00:00.000Z"),
    });

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
    await defenseDocuments.reload();
    assert.equal(defenseDocuments.transkrip_status, "approved", "pendaftaran baru tidak mereset dokumen");

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
    await defenseDocuments.reload();
    for (const prefix of ["transkrip", "cept", "draft_skripsi"]) {
      assert.equal(defenseDocuments[`${prefix}_file_path`], null);
      assert.equal(defenseDocuments[`${prefix}_file_name`], null);
      assert.equal(defenseDocuments[`${prefix}_status`], "belum_upload");
      assert.equal(defenseDocuments[`${prefix}_uploaded_at`], null);
      assert.equal(defenseDocuments[`${prefix}_review_note`], null);
      assert.equal(defenseDocuments[`${prefix}_reviewed_at`], null);
    }
  });

  await t.test("metadata penetapan memperlakukan baru, ulang, dan alih sebagai awal siklus", () => {
    for (const jalur of ["baru", "ulang", "alih"]) {
      assert.deepEqual(resolveFinalAssignmentMetadata({ jalur }), {
        sumberData: "penjaluran",
        semesterPenjaluranKe: 1,
      });
    }
    assert.equal(isUlangOrAlih({ jalur: "baru" }), false);
    assert.equal(isUlangOrAlih({ jalur: "ulang" }), true);
    assert.equal(isUlangOrAlih({ jalur: "alih" }), true);
  });

  await t.test("Topik Dosen mengirim notifikasi kepada setiap dosen pemilik topik", async () => {
    const student = await Mahasiswa.create({
      nim: `T2Q${suffix}`,
      nama: "Mahasiswa Notifikasi Topik Dosen",
      email: `mahasiswa.notifikasi.topik.${suffix}@test.local`,
      password: "test-password",
      status_jalur_saat_ini: "belum_mengajukan",
    }, { hooks: false });
    mahasiswaIds.push(student.id);

    let reviewerNik;
    do {
      reviewerNik = String(Math.floor(100000000 + Math.random() * 900000000));
    } while (await Dosen.count({ where: { nik: reviewerNik } }));
    const reviewer = await Dosen.create({
      kode_dosen: `T2Q${suffix}`,
      nik: reviewerNik,
      nama: "Dosen Notifikasi Topik",
      email: `dosen.notifikasi.topik.${suffix}@test.local`,
      password: "test-password",
      kuota_bimbingan: 10,
      status_keaktifan: "active",
      account_is_active: true,
      continue_existing_supervision: true,
    }, { hooks: false });
    dosenIds.push(reviewer.id);

    await DosenKetersediaanPeriode.create({
      dosen_id: reviewer.id,
      periode_penjaluran_id: periodId,
      tersedia_membimbing: true,
      configuration_status: "ready",
    });
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

    const topikKode = `T2Q${suffix}`.slice(0, 20);
    topikCodes.push(topikKode);
    await Topik.create({
      kode: topikKode,
      judul: "Topik pengujian notifikasi dosen",
      cluster: "ITSC",
      status: "available",
      dosen_id: reviewer.id,
    });

    const response = responseRecorder();
    await jalurController.submitBaruTopikDosen({
      user: { id: student.id, role: "mahasiswa" },
      body: { topik_1_kode: topikKode },
    }, response);

    assert.equal(response.statusCode, 201, response.payload?.message);
    const submissionId = Number(response.payload?.data?.id);
    assert.ok(submissionId > 0);
    submissionIds.push(submissionId);

    const notification = await Notifikasi.findOne({
      where: {
        recipient_type: "dosen",
        recipient_id: reviewer.id,
        type: "research_submission_review_lecturer",
        reference_type: "pengajuan",
        reference_id: submissionId,
      },
    });
    assert.ok(notification);
    assert.equal(notification.action_key, "lecturer_submission_review");
    assert.equal(notification.metadata?.tipe_pengajuan, "topik_dosen");
    assert.deepEqual(notification.metadata?.topik?.map((item) => item.kode), [topikKode]);
  });

  await t.test("judul mandiri dapat diperbaiki dan diajukan ulang setelah ditolak", async () => {
    const student = await Mahasiswa.create({
      nim: `T2N${suffix}`,
      nama: "Mahasiswa Notifikasi Penelitian",
      email: `mahasiswa.notifikasi.${suffix}@test.local`,
      password: "test-password",
      status_jalur_saat_ini: "belum_mengajukan",
    }, { hooks: false });
    mahasiswaIds.push(student.id);

    const supervisor = await Dosen.create({
      kode_dosen: `T2N${suffix}`,
      nik: `4${suffix}`.slice(0, 9),
      nama: "Dosen Notifikasi Penelitian",
      email: `dosen.notifikasi.${suffix}@test.local`,
      password: "test-password",
      kuota_bimbingan: 10,
      status_keaktifan: "active",
      account_is_active: true,
      continue_existing_supervision: true,
    }, { hooks: false });
    dosenIds.push(supervisor.id);

    let cluster = await Klaster.findOne({ where: { kode: "ITSC" } });
    if (!cluster) {
      cluster = await Klaster.create({ kode: "ITSC", nama: "Informatika Teori & Sistem Cerdas" });
      createdClusterIds.push(cluster.id);
    }
    await DosenKlaster.create({ dosen_id: supervisor.id, klaster_id: cluster.id });
    await DosenKetersediaanPeriode.create({
      dosen_id: supervisor.id,
      periode_penjaluran_id: periodId,
      tersedia_membimbing: true,
      configuration_status: "ready",
    });

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
    const bidang = await BidangPenelitian.findOne({ order: [["id", "ASC"]] });
    assert.ok(bidang, "Master bidang penelitian untuk pengujian harus tersedia.");

    const submissionPayload = {
      judul_mandiri: "Sistem rekomendasi penguji berbasis bidang penelitian",
      deskripsi_mandiri: "Penelitian membangun pencocokan bidang untuk rekomendasi dosen penguji.",
      bidang_penelitian_ids: [bidang.id],
      cluster_mandiri: "ITSC",
      prospective_supervisor_id: supervisor.id,
    };
    const response = responseRecorder();
    await jalurController.submitBaruJudulMandiri({
      user: { id: student.id, role: "mahasiswa" },
      body: submissionPayload,
    }, response);

    assert.equal(response.statusCode, 201, response.payload?.message);
    const submissionId = Number(response.payload?.data?.id);
    assert.ok(submissionId > 0);
    submissionIds.push(submissionId);
    assert.equal(await PengajuanBidangPenelitian.count({ where: { pengajuan_id: submissionId } }), 1);

    const notification = await Notifikasi.findOne({
      where: {
        recipient_type: "dosen",
        recipient_id: supervisor.id,
        type: "research_submission_review_lecturer",
        reference_type: "pengajuan",
        reference_id: submissionId,
      },
    });
    assert.ok(notification);
    assert.equal(notification.action_key, "lecturer_submission_review");
    assert.equal(notification.read_at, null);

    const rejectionResponse = responseRecorder();
    await dosenController.rejectSubmission({
      user: { id: supervisor.id, role: "dosen" },
      params: { id: String(submissionId) },
      body: { keterangan: "Judul perlu diperbaiki dan disesuaikan kembali." },
    }, rejectionResponse);
    assert.equal(rejectionResponse.statusCode, 200, rejectionResponse.payload?.message);

    await Promise.all([student.reload(), registration.reload()]);
    const rejectedSubmission = await Pengajuan.findByPk(submissionId);
    assert.equal(rejectedSubmission.status, "rejected");
    assert.equal(student.pengajuan_aktif_id, null);
    assert.equal(student.status_jalur_saat_ini, "belum_mengajukan");
    assert.equal(registration.form_lanjutan_status, "draft");
    assert.equal(registration.form_lanjutan_submitted_at, null);

    const studentNotification = await Notifikasi.findOne({
      where: {
        recipient_type: "mahasiswa",
        recipient_id: student.id,
        type: "research_submission_rejected_student",
        reference_type: "pengajuan",
        reference_id: submissionId,
      },
    });
    assert.ok(studentNotification);
    assert.equal(studentNotification.action_key, "student_submission_status");
    assert.equal(studentNotification.metadata?.can_resubmit, true);

    const eligibilityResponse = responseRecorder();
    await jalurController.getJalurEligibility({
      user: { id: student.id, role: "mahasiswa" },
    }, eligibilityResponse);
    assert.equal(eligibilityResponse.statusCode, 200, eligibilityResponse.payload?.message);
    assert.equal(eligibilityResponse.payload?.data?.flags?.has_active_pengajuan, false);
    assert.equal(eligibilityResponse.payload?.data?.flags?.has_penelitian_submission, false);
    assert.equal(eligibilityResponse.payload?.data?.flags?.can_retry_rejected_penelitian, true);
    assert.equal(eligibilityResponse.payload?.data?.jalur_eligibility?.penelitian?.enabled, true);
    assert.equal(eligibilityResponse.payload?.data?.jalur_eligibility?.penelitian?.reason, "");
    assert.equal(eligibilityResponse.payload?.data?.onboarding?.is_locked, false);
    assert.equal(eligibilityResponse.payload?.data?.onboarding?.reason, "");

    const resubmissionResponse = responseRecorder();
    await jalurController.submitBaruJudulMandiri({
      user: { id: student.id, role: "mahasiswa" },
      body: submissionPayload,
    }, resubmissionResponse);
    assert.equal(resubmissionResponse.statusCode, 201, resubmissionResponse.payload?.message);
    const resubmissionId = Number(resubmissionResponse.payload?.data?.id);
    assert.ok(resubmissionId > 0);
    assert.notEqual(resubmissionId, submissionId);
    submissionIds.push(resubmissionId);
  });

  await t.test("penolakan final Topik Dosen paralel membuka pengajuan ulang dan memberi notifikasi", async () => {
    const student = await Mahasiswa.create({
      nim: `T2T${suffix}`,
      nama: "Mahasiswa Topik Paralel Tahap 2",
      email: `mahasiswa.topik.${suffix}@test.local`,
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
      form_lanjutan_status: "submitted",
      form_lanjutan_submitted_at: new Date(),
    });
    registrationIds.push(registration.id);
    let reviewerNik;
    do {
      reviewerNik = String(Math.floor(100000000 + Math.random() * 900000000));
    } while (await Dosen.count({ where: { nik: reviewerNik } }));
    const reviewer = await Dosen.create({
      kode_dosen: `T2T${suffix}`,
      nik: reviewerNik,
      nama: "Dosen Topik Paralel Tahap 2",
      email: `dosen.topik.${suffix}@test.local`,
      password: "test-password",
      kuota_bimbingan: 10,
      status_keaktifan: "active",
      account_is_active: true,
      continue_existing_supervision: true,
    }, { hooks: false });
    dosenIds.push(reviewer.id);
    const topikKode = `T2X${suffix}`;
    topikCodes.push(topikKode);
    await Topik.create({
      kode: topikKode,
      judul: "Topik pengujian pemulihan penolakan paralel",
      cluster: "ITSC",
      status: "reserved",
      dosen_id: reviewer.id,
    });
    const submission = await Pengajuan.create({
      mahasiswa_id: student.id,
      pendaftaran_penjaluran_id: registration.id,
      jenis_jalur: "baru",
      tipe_pengajuan: "topik_dosen",
      topik_1_kode: topikKode,
      topik_1_judul: "Topik pengujian pemulihan penolakan paralel",
      dosen_pilihan_1: reviewer.id,
      dosen_1_nama: reviewer.nama,
      status: "pending",
    });
    submissionIds.push(submission.id);
    await student.update({ pengajuan_aktif_id: submission.id });
    await RiwayatPersetujuan.create({
      pengajuan_id: submission.id,
      dosen_id: reviewer.id,
      tipe_approval: "calon_pembimbing",
      topik_slot: 1,
      topik_kode: topikKode,
      status: "rejected",
      keterangan: "Topik belum sesuai dengan kepakaran dosen.",
      tanggal_keputusan: new Date(),
    });

    const result = await finalizeTopikParallelSubmission(submission.id);
    assert.equal(result.final_status, "rejected");
    await Promise.all([student.reload(), registration.reload()]);
    const topik = await Topik.findOne({ where: { kode: topikKode } });
    assert.equal(student.pengajuan_aktif_id, null);
    assert.equal(student.status_jalur_saat_ini, "belum_mengajukan");
    assert.equal(registration.form_lanjutan_status, "draft");
    assert.equal(registration.form_lanjutan_submitted_at, null);
    assert.equal(topik.status, "available");
    assert.equal(await Notifikasi.count({
      where: {
        recipient_type: "mahasiswa",
        recipient_id: student.id,
        type: "research_submission_rejected_student",
        reference_id: submission.id,
      },
    }), 1);
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
      keyword_mandiri: null,
      cluster_mandiri: "ITSC",
      prospective_supervisor_id: supervisor.id,
      is_approved_by_supervisor: true,
      status: "menunggu_approval_sekprodi",
    });
    submissionIds.push(submission.id);
    const makeRequest = () => ({
      params: { id: String(submission.id) },
      body: {
        keterangan: "Layak difinalisasi",
        dosen_pembimbing_1_id: 999999,
        dosen_pembimbing_2_id: 999998,
      },
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
    const assignment = await PenetapanPembimbing.findOne({
      where: { mahasiswa_id: student.id, status: "active" },
    });
    const assignedSupervisors = await PenetapanPembimbingDosen.findAll({
      where: { penetapan_pembimbing_id: assignment.id, status: "active" },
      order: [["urutan", "ASC"]],
    });
    assert.equal(assignedSupervisors.length, 1);
    assert.equal(Number(assignedSupervisors[0].dosen_id), Number(supervisor.id));
    assert.equal(assignedSupervisors[0].urutan, 1);
  });

  await t.test("final Topik Dosen menetapkan pemilik topik dan mengabaikan pilihan pembimbing dari request", async () => {
    const student = await Mahasiswa.create({
      nim: `T2O${suffix}`,
      nama: "Mahasiswa Pemilik Topik Tahap 2",
      email: `mahasiswa.pemilik.topik.${suffix}@test.local`,
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
      form_lanjutan_status: "submitted",
      form_lanjutan_submitted_at: new Date(),
    });
    registrationIds.push(registration.id);
    let ownerNik;
    do {
      ownerNik = String(Math.floor(100000000 + Math.random() * 900000000));
    } while (await Dosen.count({ where: { nik: ownerNik } }));
    const owner = await Dosen.create({
      kode_dosen: `T2O${suffix}`,
      nik: ownerNik,
      nama: "Dosen Pemilik Topik Tahap 2",
      email: `dosen.pemilik.topik.${suffix}@test.local`,
      password: "test-password",
      kuota_bimbingan: 10,
      status_keaktifan: "active",
      account_is_active: true,
      continue_existing_supervision: true,
    }, { hooks: false });
    dosenIds.push(owner.id);
    await DosenKetersediaanPeriode.create({
      dosen_id: owner.id,
      periode_penjaluran_id: periodId,
      tersedia_membimbing: true,
      configuration_status: "ready",
    });
    let cluster = await Klaster.findOne({ where: { kode: "ITSC" } });
    if (!cluster) {
      cluster = await Klaster.create({ kode: "ITSC", nama: "Informatika Teori & Sistem Cerdas" });
      createdClusterIds.push(cluster.id);
    }
    await DosenKlaster.create({ dosen_id: owner.id, klaster_id: cluster.id });
    const topikKode = `ITSCZ${suffix}`;
    topikCodes.push(topikKode);
    await Topik.create({
      kode: topikKode,
      judul: "Topik yang pembimbingnya harus pemilik topik",
      cluster: "ITSC",
      status: "reserved",
      dosen_id: owner.id,
    });
    const submission = await Pengajuan.create({
      mahasiswa_id: student.id,
      pendaftaran_penjaluran_id: registration.id,
      jenis_jalur: "baru",
      tipe_pengajuan: "topik_dosen",
      topik_1_kode: topikKode,
      topik_1_judul: "Topik yang pembimbingnya harus pemilik topik",
      dosen_pilihan_1: owner.id,
      dosen_1_nama: owner.nama,
      status: "pending",
    });
    submissionIds.push(submission.id);
    await RiwayatPersetujuan.bulkCreate([
      {
        pengajuan_id: submission.id,
        dosen_id: owner.id,
        tipe_approval: "calon_pembimbing",
        topik_slot: 1,
        topik_kode: topikKode,
        status: "approved",
        keterangan: "Topik diterima pemilik.",
        tanggal_keputusan: new Date(),
      },
      {
        pengajuan_id: submission.id,
        dosen_id: owner.id,
        tipe_approval: "koordinator",
        topik_slot: 1,
        topik_kode: topikKode,
        status: "approved",
        keterangan: "Topik diterima ketua cluster.",
        tanggal_keputusan: new Date(),
      },
      {
        pengajuan_id: submission.id,
        tipe_approval: "sekprodi",
        topik_slot: 1,
        topik_kode: topikKode,
        status: "pending",
        keterangan: "Menunggu keputusan final Sekprodi.",
      },
    ]);

    const response = responseRecorder();
    await sekretarisController.approvePenelitianFinal({
      params: { id: String(submission.id) },
      body: {
        keterangan: "Topik ditetapkan final.",
        topik_slot: 1,
        dosen_pembimbing_1_id: 999999,
        dosen_pembimbing_2_id: 999998,
      },
      user: { id: 900006, role: "sekretaris_prodi", program_kuliah: "reguler" },
    }, response);
    assert.equal(response.statusCode, 200, response.payload?.message);
    const assignment = await PenetapanPembimbing.findOne({
      where: { mahasiswa_id: student.id, status: "active" },
    });
    assert.ok(assignment);
    const assignedSupervisors = await PenetapanPembimbingDosen.findAll({
      where: { penetapan_pembimbing_id: assignment.id, status: "active" },
      order: [["urutan", "ASC"]],
    });
    assert.equal(assignedSupervisors.length, 1);
    assert.equal(Number(assignedSupervisors[0].dosen_id), Number(owner.id));
    assert.equal(assignedSupervisors[0].urutan, 1);
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

    const eligibilityResponse = responseRecorder();
    await jalurController.getJalurEligibility({
      user: { id: student.id, role: "mahasiswa" },
    }, eligibilityResponse);
    assert.equal(eligibilityResponse.statusCode, 200, eligibilityResponse.payload?.message);
    assert.equal(eligibilityResponse.payload?.data?.jalur_eligibility?.magang?.enabled, true);
    assert.equal(eligibilityResponse.payload?.data?.jalur_eligibility?.magang?.reason, "");
    assert.equal(eligibilityResponse.payload?.data?.flags?.can_retry_rejected_non_penelitian, true);
    assert.equal(eligibilityResponse.payload?.data?.onboarding?.is_locked, false);
    assert.equal(eligibilityResponse.payload?.data?.onboarding?.reason, "");

    const retryValidationResponse = responseRecorder();
    await jalurController.submitFormNonPenelitian({
      body: { jalur: "magang", payload: {} },
      user: { id: student.id, role: "mahasiswa" },
      files: {},
    }, retryValidationResponse);
    assert.equal(retryValidationResponse.statusCode, 400);
    assert.notEqual(retryValidationResponse.payload?.code, "FORM_ALREADY_SUBMITTED");
  });
});
