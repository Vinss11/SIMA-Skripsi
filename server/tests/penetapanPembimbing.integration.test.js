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
  BimbinganSkripsi,
  Notifikasi,
} = require("../models");
const {
  replaceSupervisorAssignment,
  getActiveSupervisorAssignment,
} = require("../services/penetapanPembimbingService");
const {
  isActiveSupervisor,
  getActiveSupervisorRoleMap,
} = require("../services/supervisorAccessService");

test("alur penetapan dan pergantian pembimbing bersifat transaksional tanpa surat tugas", async (t) => {
  assert.equal(process.env.NODE_ENV, "test", "Integration test wajib dijalankan dengan NODE_ENV=test.");
  const suffix = String(Date.now()).slice(-7);
  const ids = { dosens: [], students: [], registrations: [], assignments: [], notifications: [] };
  let period = null;
  let sekretaris = null;

  t.after(async () => {
    await BimbinganSkripsi.destroy({ where: { mahasiswa_id: { [Op.in]: ids.students } }, force: true });
    await Notifikasi.destroy({
      where: {
        [Op.or]: [
          { recipient_type: "mahasiswa", recipient_id: { [Op.in]: ids.students } },
          { recipient_type: "dosen", recipient_id: { [Op.in]: ids.dosens } },
        ],
      },
      force: true,
    });
    const assignments = await PenetapanPembimbing.findAll({
      where: { mahasiswa_id: { [Op.in]: ids.students } },
      attributes: ["id"],
      raw: true,
    });
    const assignmentIds = assignments.map((item) => Number(item.id));
    if (assignmentIds.length) {
      await PenetapanPembimbingDosen.destroy({ where: { penetapan_pembimbing_id: { [Op.in]: assignmentIds } }, force: true });
      await PenetapanPembimbing.destroy({ where: { id: { [Op.in]: assignmentIds } }, force: true });
    }
    if (ids.registrations.length) await PendaftaranPenjaluran.destroy({ where: { id: { [Op.in]: ids.registrations } }, force: true });
    if (period) await DosenKetersediaanPeriode.destroy({ where: { periode_penjaluran_id: period.id }, force: true });
    if (ids.students.length) await Mahasiswa.destroy({ where: { id: { [Op.in]: ids.students } }, force: true });
    if (ids.dosens.length) await Dosen.destroy({ where: { id: { [Op.in]: ids.dosens } }, force: true });
    if (period) await period.destroy({ force: true });
    if (sekretaris) await sekretaris.destroy({ force: true });
    await sequelize.close();
  });

  sekretaris = await SekretarisProdi.create({
    nik: `9${suffix}1`.slice(0, 9),
    nama: `Sekretaris Test ${suffix}`,
    email: `sekretaris.${suffix}@test.local`,
    password: "test-password",
  }, { hooks: false });
  period = await PeriodePenjaluran.create({
    tahun_akademik: "2098/2099",
    semester: "ganjil",
    label_periode: `Test Histori ${suffix}`,
    status: "closed",
    is_active: false,
    tanggal_mulai: new Date("2098-08-01T00:00:00.000Z"),
    tanggal_selesai: new Date("2098-08-31T00:00:00.000Z"),
  });

  const dosens = [];
  for (let index = 1; index <= 4; index += 1) {
    const dosen = await Dosen.create({
      kode_dosen: `TS${suffix}${index}`,
      nik: `${index}${suffix}1`.slice(0, 9),
      nama: `Dosen Test ${index}`,
      email: `dosen.${suffix}.${index}@test.local`,
      password: "test-password",
      kuota_bimbingan: 10,
      status_keaktifan: "active",
      account_is_active: true,
      continue_existing_supervision: true,
    }, { hooks: false });
    dosens.push(dosen);
    ids.dosens.push(dosen.id);
    await DosenKetersediaanPeriode.create({
      dosen_id: dosen.id,
      periode_penjaluran_id: period.id,
      tersedia_membimbing: true,
      configuration_status: "ready",
      reviewed_at: new Date(),
      reviewed_by_sekretaris_id: sekretaris.id,
      updated_by_sekretaris_id: sekretaris.id,
    });
  }

  async function createStudent(number) {
    const mahasiswa = await Mahasiswa.create({
      nim: `T${suffix}${number}`,
      nama: `Mahasiswa Test ${number}`,
      email: `mahasiswa.${suffix}.${number}@test.local`,
      password: "test-password",
      status_jalur_saat_ini: "baru",
    }, { hooks: false });
    ids.students.push(mahasiswa.id);
    const registration = await PendaftaranPenjaluran.create({
      mahasiswa_id: mahasiswa.id,
      periode_penjaluran_id: period.id,
      jalur: "baru",
      program_kuliah: "reguler",
      semester_mahasiswa: 7,
      status: "approved",
      jenis_jalur_diambil: "penelitian",
      reviewed_by_sekretaris_id: sekretaris.id,
      reviewed_at: new Date(),
    });
    ids.registrations.push(registration.id);
    return { mahasiswa, registration };
  }

  const first = await createStudent(1);
  const initial = await replaceSupervisorAssignment({
    mahasiswaId: first.mahasiswa.id,
    pendaftaranPenjaluranId: first.registration.id,
    periodeMulaiId: period.id,
    dosenPembimbingIds: [dosens[0].id, dosens[1].id],
    createdBySekretarisId: sekretaris.id,
    tanggalMulai: new Date("2098-08-02T00:00:00.000Z"),
  });
  assert.equal(initial.penetapan.status, "active");
  assert.equal(initial.penetapan.surat_tugas_id, null);
  assert.deepEqual(initial.penetapan.pembimbings.map((item) => Number(item.urutan)), [1, 2]);
  assert.deepEqual(initial.penetapan.pembimbings.map((item) => item.status), ["active", "active"]);
  assert.equal(Number((await first.mahasiswa.reload()).dosen_pembimbing_skripsi_id), dosens[0].id);

  const repeated = await replaceSupervisorAssignment({
    mahasiswaId: first.mahasiswa.id,
    pendaftaranPenjaluranId: first.registration.id,
    periodeMulaiId: period.id,
    dosenPembimbingIds: [dosens[0].id, dosens[1].id],
    createdBySekretarisId: sekretaris.id,
  });
  assert.equal(repeated.penetapan.id, initial.penetapan.id);
  assert.equal(await PenetapanPembimbing.count({ where: { mahasiswa_id: first.mahasiswa.id } }), 1);

  const p1Roles = await getActiveSupervisorRoleMap(dosens[0].id);
  const p2Roles = await getActiveSupervisorRoleMap(dosens[1].id);
  assert.equal(p1Roles.get(first.mahasiswa.id).urutan, 1);
  assert.equal(p2Roles.get(first.mahasiswa.id).urutan, 2);
  assert.equal(await isActiveSupervisor(dosens[0].id, first.mahasiswa.id), true);
  assert.equal(await isActiveSupervisor(dosens[1].id, first.mahasiswa.id), true);

  const guidance = await BimbinganSkripsi.create({
    mahasiswa_id: first.mahasiswa.id,
    dosen_id: dosens[0].id,
    permintaan_pesan: "Catatan progres yang harus tetap tersimpan.",
    permintaan_tanggal: "2098-08-03",
    permintaan_jam: "10:00",
    status_permohonan: "approved",
    status_resume: "approved",
    resume_mahasiswa: "Progres lama.",
  });

  const replacement = await replaceSupervisorAssignment({
    mahasiswaId: first.mahasiswa.id,
    pendaftaranPenjaluranId: first.registration.id,
    periodeMulaiId: period.id,
    dosenPembimbingIds: [dosens[2].id, dosens[1].id],
    createdBySekretarisId: sekretaris.id,
    tanggalMulai: new Date("2098-08-10T00:00:00.000Z"),
  });
  assert.notEqual(replacement.penetapan.id, initial.penetapan.id);
  assert.equal((await PenetapanPembimbing.findByPk(initial.penetapan.id)).status, "ended");
  assert.equal(await PenetapanPembimbing.count({ where: { mahasiswa_id: first.mahasiswa.id, status: "active" } }), 1);
  assert.equal(Number((await first.mahasiswa.reload()).dosen_pembimbing_skripsi_id), dosens[2].id);
  assert.equal(await isActiveSupervisor(dosens[0].id, first.mahasiswa.id), false);
  assert.equal(await isActiveSupervisor(dosens[2].id, first.mahasiswa.id), true);
  assert.equal((await BimbinganSkripsi.findByPk(guidance.id)).resume_mahasiswa, "Progres lama.");

  const rollbackCase = await createStudent(2);
  await assert.rejects(
    replaceSupervisorAssignment({
      mahasiswaId: rollbackCase.mahasiswa.id,
      pendaftaranPenjaluranId: rollbackCase.registration.id,
      periodeMulaiId: period.id,
      dosenPembimbingIds: [dosens[3].id],
      createdBySekretarisId: sekretaris.id,
      notificationCreator: async () => {
        throw new Error("Simulasi kegagalan notifikasi setelah aktivasi");
      },
    }),
    /Simulasi kegagalan/
  );
  assert.equal(await PenetapanPembimbing.count({ where: { mahasiswa_id: rollbackCase.mahasiswa.id } }), 0);
  assert.equal((await rollbackCase.mahasiswa.reload()).dosen_pembimbing_skripsi_id, null);
  assert.equal((await getActiveSupervisorAssignment(rollbackCase.mahasiswa.id)).penetapan, null);
});
