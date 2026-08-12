"use strict";

process.env.NODE_ENV = "test";
require("dotenv").config();

const test = require("node:test");
const assert = require("node:assert/strict");
const XLSX = require("xlsx");
const { Op } = require("sequelize");
const db = require("../models");
const service = require("../services/penjaluranGradeService");

function fillTemplate(buffer, grades) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets.Data;
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  rows.forEach((row, index) => { row.Nilai = Array.isArray(grades) ? (grades[index] || "") : (grades[row.NIM] || ""); });
  workbook.Sheets.Data = XLSX.utils.json_to_sheet(rows, { header: service.HEADERS });
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

test("Tahap 5 baru: template periode, import idempoten, koreksi versi, dan alih jalur", async (t) => {
  const suffix = `${String(Date.now()).slice(-6)}${Math.floor(Math.random() * 1000).toString().padStart(3, "0")}`;
  const created = { students: [], academicPeriods: [], periods: [], registrations: [], imports: [] };
  t.after(async () => {
    const importRows = await db.ImportNilaiPenjaluranRow.findAll({ where: { import_id: { [Op.in]: created.imports } }, attributes: ["id"] });
    await db.PercobaanMataKuliahMahasiswa.destroy({ where: { pendaftaran_penjaluran_id: { [Op.in]: created.registrations } }, force: true });
    await db.ImportNilaiPenjaluranRow.destroy({ where: { id: { [Op.in]: importRows.map((row) => row.id) } }, force: true });
    await db.ImportNilaiPenjaluran.destroy({ where: { id: { [Op.in]: created.imports } }, force: true });
    await db.PendaftaranPenjaluran.destroy({ where: { id: { [Op.in]: created.registrations } }, force: true });
    await db.PeriodePenjaluran.destroy({ where: { id: { [Op.in]: created.periods } }, force: true });
    await db.Mahasiswa.destroy({ where: { id: { [Op.in]: created.students } }, force: true });
    await db.PeriodeAkademik.destroy({ where: { id: { [Op.in]: created.academicPeriods } }, force: true });
    await db.sequelize.close();
  });

  assert.deepEqual(service.gradePolicy.ALLOWED_GRADES, ["A", "B+", "B", "B-", "B/C", "C+", "C", "C-", "C/D", "D+", "D", "D-", "D/F", "F"]);
  assert.equal(service.gradePolicy.isPassingGrade(" C "), true);
  assert.equal(service.gradePolicy.isPassingGrade("C-"), false);

  const startYear = 2120 + Math.floor(Math.random() * 50);
  const academic = await db.PeriodeAkademik.create({ kode: `${startYear}-${startYear + 1}-GANJIL-${suffix}`,
    tahun_akademik: `${startYear}/${startYear + 1}-${suffix}`, semester: "ganjil", status: "draft" });
  created.academicPeriods.push(academic.id);
  const period = await db.PeriodePenjaluran.create({ tahun_akademik: `${startYear}/${startYear + 1}`, semester: "ganjil", label_periode: `Stage5 ${suffix} A`, status: "closed", is_active: false, periode_akademik_id: academic.id });
  const switchPeriod = await db.PeriodePenjaluran.create({ tahun_akademik: `${startYear}/${startYear + 1}`, semester: "genap", label_periode: `Stage5 ${suffix} B`, status: "closed", is_active: false, periode_akademik_id: academic.id });
  created.periods.push(period.id, switchPeriod.id);
  const student = await db.Mahasiswa.create({ nim: `S5${suffix}`.slice(0, 30), nama: "Mahasiswa Nilai Penjaluran", email: `s5.${suffix}@test.local`, password: "test" }, { hooks: false });
  const rejectedStudent = await db.Mahasiswa.create({ nim: `R5${suffix}`.slice(0, 30), nama: "Mahasiswa Rejected", email: `r5.${suffix}@test.local`, password: "test" }, { hooks: false });
  const invalidStudent = await db.Mahasiswa.create({ nim: `I5${suffix}`.slice(0, 30), nama: "Mahasiswa Nilai Invalid", email: `i5.${suffix}@test.local`, password: "test" }, { hooks: false });
  created.students.push(student.id, rejectedStudent.id, invalidStudent.id);
  const registration = await db.PendaftaranPenjaluran.create({ mahasiswa_id: student.id, periode_penjaluran_id: period.id, jalur: "baru", program_kuliah: "reguler", semester_mahasiswa: 6,
    status: "approved", jenis_jalur_diambil: "penelitian", form_lanjutan_status: "approved" });
  const rejected = await db.PendaftaranPenjaluran.create({ mahasiswa_id: rejectedStudent.id, periode_penjaluran_id: period.id, jalur: "baru", program_kuliah: "reguler", semester_mahasiswa: 6,
    status: "rejected", jenis_jalur_diambil: "penelitian", form_lanjutan_status: "rejected" });
  const invalidRegistration = await db.PendaftaranPenjaluran.create({ mahasiswa_id: invalidStudent.id, periode_penjaluran_id: period.id, jalur: "baru", program_kuliah: "reguler", semester_mahasiswa: 6,
    status: "approved", jenis_jalur_diambil: "penelitian", form_lanjutan_status: "approved" });
  created.registrations.push(registration.id, rejected.id, invalidRegistration.id);

  const initialGrid = await service.registrationRows(period.id);
  assert.equal(initialGrid.length, 3, "rejected tetap terlihat sebagai histori grid");
  assert.equal((await service.registrationRows(period.id, { programKuliah: "reguler" })).length, 3, "Sekprodi reguler hanya menerima data program reguler");
  assert.equal((await service.registrationRows(period.id, { programKuliah: "internasional" })).length, 0, "Sekprodi internasional tidak menerima data program reguler");
  assert.equal(initialGrid.find((row) => row.pendaftaran_id === registration.id).status_nilai, "Belum tersedia");
  const template = await service.buildTemplate(period.id);
  const templateRows = XLSX.utils.sheet_to_json(XLSX.read(template, { type: "buffer" }).Sheets.Data, { defval: "" });
  assert.equal(templateRows.length, 2, "rejected tidak masuk template nilai");
  assert.ok(templateRows.some((row) => Number(row["ID Pendaftaran"]) === registration.id));

  const firstFile = fillTemplate(template, { [student.nim]: " b ", [invalidStudent.nim]: "Z" });
  const preview = await service.createPreview({ periodePenjaluranId: period.id, bytes: firstFile, actorId: 9001 });
  created.imports.push(preview.import.id);
  assert.deepEqual(preview.import.counts, { total: 2, valid: 1, invalid: 1 });
  const committed = await service.commitImport(preview.import.id, 9001);
  assert.equal(committed.replayed, false);
  assert.equal((await service.getSidangRequirement(student.id)).fulfilled, true);
  const replayCommit = await service.commitImport(preview.import.id, 9001);
  assert.equal(replayCommit.replayed, true);
  assert.equal(await db.PercobaanMataKuliahMahasiswa.count({ where: { pendaftaran_penjaluran_id: registration.id, is_active: true } }), 1);
  assert.equal((await service.createPreview({ periodePenjaluranId: period.id, bytes: firstFile, actorId: 9001 })).replayed, true);

  const correctionFile = fillTemplate(await service.buildTemplate(period.id), { [student.nim]: "A", [invalidStudent.nim]: "Z" });
  const correction = await service.createPreview({ periodePenjaluranId: period.id, bytes: correctionFile, actorId: 9001 });
  created.imports.push(correction.import.id); await service.commitImport(correction.import.id, 9001);
  const versions = await db.PercobaanMataKuliahMahasiswa.findAll({ where: { pendaftaran_penjaluran_id: registration.id }, order: [["version", "ASC"]] });
  assert.equal(versions.length, 2); assert.equal(versions[0].is_active, false); assert.equal(versions[1].nilai_huruf, "A"); assert.equal(versions[1].previous_version_id, versions[0].id);

  const internationalStudent = await db.Mahasiswa.create({ nim: `N5${suffix}`.slice(0, 30), nama: "Mahasiswa Program Internasional", email: `n5.${suffix}@test.local`, password: "test" }, { hooks: false });
  created.students.push(internationalStudent.id);
  const internationalRegistration = await db.PendaftaranPenjaluran.create({ mahasiswa_id: internationalStudent.id, periode_penjaluran_id: period.id, jalur: "baru", program_kuliah: "internasional", semester_mahasiswa: 6,
    status: "approved", jenis_jalur_diambil: "penelitian", form_lanjutan_status: "approved" });
  created.registrations.push(internationalRegistration.id);
  const regularScope = await service.registrationRows(period.id, { programKuliah: "reguler" });
  const internationalScope = await service.registrationRows(period.id, { programKuliah: "internasional" });
  assert.ok(regularScope.every((row) => row.program_kuliah === "reguler"));
  assert.deepEqual(internationalScope.map((row) => row.pendaftaran_id), [internationalRegistration.id], "Sekprodi internasional menerima tepat data program internasional");

  const switched = await db.PendaftaranPenjaluran.create({ mahasiswa_id: student.id, pendaftaran_asal_id: registration.id, periode_penjaluran_id: switchPeriod.id,
    jalur: "alih", program_kuliah: "reguler", semester_mahasiswa: 7, status: "approved", jenis_jalur_diambil: "magang", penjaluran_sebelumnya: "penelitian", penjaluran_baru: "magang", form_lanjutan_status: "approved" });
  created.registrations.push(switched.id);
  const switchedGrid = await service.registrationRows(switchPeriod.id);
  assert.equal(switchedGrid[0].mata_kuliah, "Manajemen Diri"); assert.equal(switchedGrid[0].status_nilai, "Belum tersedia");
  assert.equal((await service.registrationRows(period.id)).find((row) => row.pendaftaran_id === registration.id).nilai, "A", "nilai Metodologi tetap menjadi histori");
});
