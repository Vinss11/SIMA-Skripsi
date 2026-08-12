"use strict";

// Generates small, standalone DBML diagrams in the exact business sequence of
// SIMPS BPMN V1.2. These are readability views, not replacements for the full
// physical schema in ../simps-physical-relational-schema.dbml.

const fs = require("fs");
const path = require("path");

const CURRENT = "#2F75B5";
const PROPOSED = "#D97706";
const current = (name, body, note) => `Table ${name} [headercolor: ${CURRENT}] {\n${body}\n  Note: 'CURRENT — ${note}'\n}`;
const proposed = (name, body, note) => `Table ${name} [headercolor: ${PROPOSED}] {\n${body}\n  Note: 'PROPOSED — ${note}'\n}`;
const header = (number, title, bpmn) => `// SIMPS BPMN V1.2 — TAHAP ${number}: ${title}
// Urutan BPMN: ${bpmn}
// Biru = CURRENT (sudah ada) | Oranye = PROPOSED (belum dimigrasikan)
// View ini hanya menampilkan kolom penggerak relasi/proses agar diagram terbaca.

Project SIMPS_BPMN_${number.replaceAll(".", "_")} {
  database_type: 'PostgreSQL'
  Note: '${title}'
}`;

const actorTables = {
  Admins: current("Admins", `  id integer [pk, increment]
  nip varchar(20) [not null, unique]
  nama varchar(100) [not null]
  role varchar(20) [not null]`, "administrator sistem"),
  Dosens: current("Dosens", `  id integer [pk, increment]
  kode_dosen varchar(255) [not null, unique]
  nama varchar(255) [not null]
  status_keaktifan varchar(30) [not null]
  account_is_active boolean [not null]
  kuota_bimbingan integer [not null]`, "dosen, pembimbing, penguji, dan penanggung jawab jalur"),
  SekretarisProdis: current("SekretarisProdis", `  id integer [pk, increment]
  nik varchar(9) [not null, unique]
  nama varchar(100) [not null]`, "sekretaris program studi"),
  Mahasiswas: current("Mahasiswas", `  id integer [pk, increment]
  nim varchar(20) [not null, unique]
  nama varchar(100) [not null]
  dosen_pembimbing_akademik_id integer [ref: > Dosens.id]
  dosen_pembimbing_skripsi_id integer [ref: > Dosens.id]
  status_jalur_saat_ini varchar(40) [not null]
  pengajuan_aktif_id integer`, "mahasiswa dan pointer status proses aktif"),
};

const stages = [
  {
    file: "01-persiapan-master-dan-periode.dbml",
    title: "Persiapan Master dan Periode Penjaluran",
    order: "Admin login → kelola master/status dosen → Sekprodi membuat periode → set ketersediaan → sistem memvalidasi dan mengaktifkan periode",
    tables: [actorTables.Admins, actorTables.Dosens, actorTables.SekretarisProdis,
      current("RiwayatStatusDosens", `  id integer [pk, increment]
  dosen_id integer [not null, ref: > Dosens.id]
  status_sebelumnya varchar(30)
  status_baru varchar(30) [not null]
  effective_at date
  reason text
  changed_by integer [ref: > Admins.id]`, "audit perubahan status dosen"),
      current("TindakLanjutStatusDosens", `  id integer [pk, increment]
  dosen_id integer [not null, ref: > Dosens.id]
  riwayat_status_dosen_id integer [not null, ref: > RiwayatStatusDosens.id]
  status varchar(20) [not null]
  resolved_by_sekretaris_id integer [ref: > SekretarisProdis.id]
  resolved_at timestamptz`, "penanganan dampak perubahan status dosen"),
      current("PeriodeAkademiks", `  id integer [pk, increment]
  kode varchar(40) [not null, unique]
  tahun_akademik varchar(20) [not null]
  semester varchar(10) [not null]
  status varchar(20) [not null]`, "periode akademik kanonis"),
      current("PeriodePenjalurans", `  id integer [pk, increment]
  periode_akademik_id integer [ref: > PeriodeAkademiks.id]
  label_periode varchar(50) [not null, unique]
  tanggal_mulai timestamptz
  tanggal_selesai timestamptz
  ketua_penelitian_dosen_id integer [ref: > Dosens.id]
  pengawas_magang_dosen_id integer [ref: > Dosens.id]
  pengawas_pengabdian_dosen_id integer [ref: > Dosens.id]
  pengawas_perintisan_bisnis_dosen_id integer [ref: > Dosens.id]
  status varchar(20) [not null]`, "periode pendaftaran dan review penjaluran"),
      current("DosenKetersediaanPeriodes", `  id integer [pk, increment]
  dosen_id integer [not null, ref: > Dosens.id]
  periode_penjaluran_id integer [not null, ref: > PeriodePenjalurans.id]
  tersedia_membimbing boolean [not null]
  configuration_status varchar(30)
  updated_by_sekretaris_id integer [ref: > SekretarisProdis.id]`, "ketersediaan dosen per periode"),
      current("RiwayatKetersediaanMembimbings", `  id integer [pk, increment]
  dosen_id integer [not null, ref: > Dosens.id]
  periode_penjaluran_id integer [not null, ref: > PeriodePenjalurans.id]
  tersedia_sebelumnya boolean
  tersedia_baru boolean [not null]
  changed_by_sekretaris_id integer [ref: > SekretarisProdis.id]`, "audit perubahan ketersediaan")],
  },
  {
    file: "02-publikasi-dan-validasi-topik.dbml",
    title: "Publikasi dan Validasi Topik Dosen",
    order: "Dosen mempublikasikan topik → sistem menyimpan → ketua klaster/Sekprodi memvalidasi → topik tersedia untuk dipilih",
    tables: [actorTables.Dosens, actorTables.SekretarisProdis,
      current("PeriodePenjalurans", `  id integer [pk, increment]
  label_periode varchar(50) [not null, unique]
  status varchar(20) [not null]`, "periode aktif"),
      current("Klasters", `  id integer [pk, increment]
  kode varchar(20) [not null, unique]
  nama varchar(120) [not null, unique]`, "master klaster penelitian"),
      current("DosenKlasters", `  dosen_id integer [pk, ref: > Dosens.id]
  klaster_id integer [pk, ref: > Klasters.id]`, "keanggotaan dosen pada klaster"),
      current("KlasterKetuaPeriodes", `  id integer [pk, increment]
  klaster_id integer [not null, ref: > Klasters.id]
  dosen_id integer [not null, ref: > Dosens.id]
  periode_penjaluran_id integer [not null, ref: > PeriodePenjalurans.id]
  assigned_by_sekretaris_id integer [ref: > SekretarisProdis.id]`, "ketua klaster per periode"),
      current("Topiks", `  id integer [pk, increment]
  kode varchar(20) [not null, unique]
  judul varchar(255) [not null]
  cluster varchar(20) [not null]
  status varchar(20) [not null]
  dosen_id integer [not null, ref: > Dosens.id]`, "topik publikasi dosen")],
  },
  {
    file: "03-pendaftaran-jalur-dan-pengajuan.dbml",
    title: "Pendaftaran Jalur dan Pengajuan Mahasiswa",
    order: "Mahasiswa memilih DPA dan jalur → mengisi topik/judul/mitra/kelompok → submit → sistem memvalidasi kelayakan dan mereservasi slot",
    tables: [actorTables.Dosens, actorTables.Mahasiswas,
      current("PeriodePenjalurans", `  id integer [pk, increment]
  label_periode varchar(50) [not null, unique]
  status varchar(20) [not null]`, "periode tujuan pendaftaran"),
      current("PendaftaranPenjalurans", `  id integer [pk, increment]
  mahasiswa_id integer [not null, ref: > Mahasiswas.id]
  periode_penjaluran_id integer [not null, ref: > PeriodePenjalurans.id]
  pendaftaran_asal_id integer [ref: > PendaftaranPenjalurans.id]
  jalur varchar(20) [not null]
  jenis_jalur_diambil varchar(40)
  dosen_pembimbing_akademik_id integer [ref: > Dosens.id]
  status varchar(30) [not null]
  form_lanjutan_status varchar(40) [not null]`, "header satu siklus pendaftaran mahasiswa"),
      current("Topiks", `  id integer [pk, increment]
  kode varchar(20) [not null, unique]
  judul varchar(255) [not null]
  status varchar(20) [not null]
  dosen_id integer [not null, ref: > Dosens.id]`, "opsi topik dosen"),
      current("Pengajuans", `  id integer [pk, increment]
  mahasiswa_id integer [not null, ref: > Mahasiswas.id]
  pendaftaran_penjaluran_id integer [ref: > PendaftaranPenjalurans.id]
  pengajuan_sebelumnya_id integer [ref: > Pengajuans.id]
  tipe_pengajuan varchar(30) [not null]
  topik_1_kode varchar(20)
  topik_2_kode varchar(20)
  topik_3_kode varchar(20)
  judul_mandiri varchar(500)
  prospective_supervisor_id integer [ref: > Dosens.id]
  status varchar(40) [not null]`, "pengajuan topik dosen atau judul mandiri"),
      current("MitraMagangs", `  id integer [pk, increment]
  nama varchar(180) [not null, unique]
  posisi_magang varchar(180)
  quota_magang integer
  status varchar(20) [not null]`, "master mitra magang"),
      proposed("PendaftaranMagangs", `  id bigint [pk, increment]
  pendaftaran_penjaluran_id integer [not null, unique, ref: - PendaftaranPenjalurans.id]
  mitra_magang_id integer [not null, ref: > MitraMagangs.id]
  posisi_dilamar varchar(180)
  surat_penerimaan_file_path varchar(500)`, "detail relasional jalur magang"),
      proposed("PendaftaranPengabdians", `  id bigint [pk, increment]
  pendaftaran_penjaluran_id integer [not null, unique, ref: - PendaftaranPenjalurans.id]
  nama_mitra_masyarakat varchar(180) [not null]
  lokasi varchar(255) [not null]
  proposal_file_path varchar(500)`, "detail relasional jalur pengabdian"),
      current("KelompokPerintisanBisnis", `  id integer [pk, increment]
  periode_penjaluran_id integer [not null, ref: > PeriodePenjalurans.id]
  ketua_mahasiswa_id integer [not null, ref: > Mahasiswas.id]
  status varchar(30) [not null]`, "kelompok jalur perintisan bisnis"),
      current("AnggotaKelompokPerintisans", `  id integer [pk, increment]
  kelompok_id integer [not null, ref: > KelompokPerintisanBisnis.id]
  mahasiswa_id integer [not null, ref: > Mahasiswas.id]
  pendaftaran_penjaluran_id integer [not null, ref: > PendaftaranPenjalurans.id]
  posisi varchar(20) [not null]
  peran_tim varchar(20) [not null]`, "anggota dan pendaftaran kelompok")],
  },
  {
    file: "04-review-dan-penetapan-pembimbing.dbml",
    title: "Review Jalur dan Penetapan Pembimbing",
    order: "Sistem meneruskan pengajuan → dosen/penanggung jawab jalur mereview → Sekprodi final review → menetapkan P1/P2 → sistem mengaktifkan penetapan dan surat tugas",
    tables: [actorTables.Dosens, actorTables.SekretarisProdis, actorTables.Mahasiswas,
      current("PendaftaranPenjalurans", `  id integer [pk, increment]
  mahasiswa_id integer [not null, ref: > Mahasiswas.id]
  status varchar(30) [not null]
  reviewed_by_sekretaris_id integer [ref: > SekretarisProdis.id]
  reviewed_at timestamptz`, "pendaftaran yang direview"),
      current("Pengajuans", `  id integer [pk, increment]
  mahasiswa_id integer [not null, ref: > Mahasiswas.id]
  pendaftaran_penjaluran_id integer [ref: > PendaftaranPenjalurans.id]
  prospective_supervisor_id integer [ref: > Dosens.id]
  status varchar(40) [not null]`, "pengajuan yang diteruskan ke reviewer"),
      current("RiwayatPersetujuans", `  id integer [pk, increment]
  pengajuan_id integer [not null, ref: > Pengajuans.id]
  dosen_id integer [ref: > Dosens.id]
  sekretaris_prodi_id integer [ref: > SekretarisProdis.id]
  tipe_approval varchar(30) [not null]
  status varchar(20) [not null]
  tanggal_keputusan timestamptz [not null]`, "keputusan setiap reviewer"),
      current("RiwayatWorkflowPenjalurans", `  id integer [pk, increment]
  pendaftaran_penjaluran_id integer [not null, ref: > PendaftaranPenjalurans.id]
  workflow_stage varchar(80) [not null]
  event_type varchar(80) [not null]
  actor_type varchar(40) [not null]
  occurred_at timestamptz [not null]`, "audit perpindahan tahap workflow"),
      current("SuratTugasPembimbings", `  id integer [pk, increment]
  nomor_surat varchar(150) [unique]
  status varchar(20) [not null]
  issued_by_sekretaris_id integer [ref: > SekretarisProdis.id]`, "surat tugas pembimbing"),
      current("PenetapanPembimbings", `  id integer [pk, increment]
  mahasiswa_id integer [not null, ref: > Mahasiswas.id]
  pendaftaran_penjaluran_id integer [ref: > PendaftaranPenjalurans.id]
  surat_tugas_id integer [ref: > SuratTugasPembimbings.id]
  previous_assignment_id integer [ref: > PenetapanPembimbings.id]
  created_by_sekretaris_id integer [ref: > SekretarisProdis.id]
  status varchar(20) [not null]
  effective_at timestamptz`, "header penetapan dan histori pergantian"),
      current("PenetapanPembimbingDosens", `  id integer [pk, increment]
  penetapan_pembimbing_id integer [not null, ref: > PenetapanPembimbings.id]
  dosen_id integer [not null, ref: > Dosens.id]
  urutan integer [not null]
  peran varchar(20) [not null]
  status varchar(20) [not null]`, "anggota P1/P2 dalam penetapan"),
      current("AssignmentActivationAttempts", `  id integer [pk, increment]
  penetapan_pembimbing_id integer [not null, unique, ref: - PenetapanPembimbings.id]
  status varchar(30) [not null]
  attempt_count integer [not null]
  activated_at timestamptz`, "reliability aktivasi penetapan")],
  },
  {
    file: "05-bimbingan-dan-kelayakan-sidang.dbml",
    title: "Bimbingan dan Kelayakan Sidang",
    order: "Mahasiswa mengajukan/log bimbingan → dosen memverifikasi resume → sistem menghitung bimbingan valid → mahasiswa upload dokumen → dosen review/revisi → sistem memberi eligibility sidang",
    tables: [actorTables.Dosens, actorTables.Mahasiswas,
      current("PendaftaranPenjalurans", `  id integer [pk, increment]
  mahasiswa_id integer [not null, ref: > Mahasiswas.id]
  jenis_jalur_diambil varchar(40)
  status varchar(30) [not null]`, "siklus penjaluran aktif"),
      current("PenetapanPembimbings", `  id integer [pk, increment]
  mahasiswa_id integer [not null, ref: > Mahasiswas.id]
  pendaftaran_penjaluran_id integer [ref: > PendaftaranPenjalurans.id]
  status varchar(20) [not null]`, "penetapan pembimbing aktif"),
      current("PenetapanPembimbingDosens", `  id integer [pk, increment]
  penetapan_pembimbing_id integer [not null, ref: > PenetapanPembimbings.id]
  dosen_id integer [not null, ref: > Dosens.id]
  urutan integer [not null]
  status varchar(20) [not null]`, "reviewer P1/P2"),
      current("BimbinganSkripsis", `  id integer [pk, increment]
  mahasiswa_id integer [not null, ref: > Mahasiswas.id]
  dosen_id integer [not null, ref: > Dosens.id]
  pendaftaran_penjaluran_id integer [ref: > PendaftaranPenjalurans.id]
  penetapan_pembimbing_id integer [ref: > PenetapanPembimbings.id]
  target_assignment_member_id integer [ref: > PenetapanPembimbingDosens.id]
  permintaan_tanggal date [not null]
  status_permohonan varchar(40) [not null]
  status_resume varchar(30) [not null]
  reviewer_dosen_id integer [ref: > Dosens.id]
  is_counted boolean [not null]`, "permohonan, pertemuan, resume, dan validitas bimbingan"),
      current("DokumenSidangs", `  id integer [pk, increment]
  mahasiswa_id integer [not null, unique, ref: - Mahasiswas.id]
  transkrip_status varchar(30) [not null]
  cept_status varchar(30) [not null]
  draft_skripsi_status varchar(30) [not null]`, "snapshot dokumen sidang saat ini"),
      proposed("DokumenSidangVersions", `  id bigint [pk, increment]
  pendaftaran_penjaluran_id integer [not null, ref: > PendaftaranPenjalurans.id]
  mahasiswa_id integer [not null, ref: > Mahasiswas.id]
  jenis_dokumen varchar(40) [not null]
  version_number integer [not null]
  file_path varchar(500) [not null]
  status varchar(30) [not null]

  Indexes {
    (pendaftaran_penjaluran_id, jenis_dokumen, version_number) [unique]
  }`, "versi upload/re-upload dokumen"),
      proposed("ReviewDokumenSidangs", `  id bigint [pk, increment]
  dokumen_version_id bigint [not null, ref: > DokumenSidangVersions.id]
  reviewer_dosen_id integer [not null, ref: > Dosens.id]
  penetapan_pembimbing_dosen_id integer [ref: > PenetapanPembimbingDosens.id]
  keputusan varchar(30) [not null]
  decided_at timestamptz [not null]`, "keputusan pembimbing per versi dokumen")],
  },
  {
    file: "06-periode-dan-penjadwalan-sidang.dbml",
    title: "Periode, Ketersediaan, dan Penjadwalan Sidang",
    order: "Sekprodi membuka periode serta tanggal/ruang → dosen mengisi ketersediaan/preferensi → mahasiswa mendaftar → sistem memilih ruang, sesi, dan penguji → jadwal disimpan",
    tables: [actorTables.Dosens, actorTables.SekretarisProdis, actorTables.Mahasiswas,
      current("PeriodeSidangs", `  id integer [pk, increment]
  label_periode varchar(120) [not null, unique]
  tanggal_mulai_pendaftaran date [not null]
  tanggal_selesai_pendaftaran date [not null]
  status varchar(20) [not null]
  created_by_sekretaris_id integer [ref: > SekretarisProdis.id]`, "periode sidang"),
      current("PeriodeSidangHaris", `  id integer [pk, increment]
  periode_sidang_id integer [not null, ref: > PeriodeSidangs.id]
  tanggal_sidang date [not null]`, "hari yang dibuka"),
      current("PeriodeSidangRuangans", `  id integer [pk, increment]
  periode_sidang_id integer [not null, ref: > PeriodeSidangs.id]
  nama_ruangan varchar(120) [not null]`, "ruangan yang tersedia"),
      current("PreferensiPengujiSidangs", `  id integer [pk, increment]
  periode_sidang_id integer [not null, ref: > PeriodeSidangs.id]
  dosen_id integer [not null, ref: > Dosens.id]
  mobilitas_ruangan varchar(30) [not null]
  maksimal_sesi_per_hari integer [not null]`, "preferensi beban dan mobilitas penguji"),
      current("KetersediaanPengujiSidangs", `  id integer [pk, increment]
  periode_sidang_id integer [not null, ref: > PeriodeSidangs.id]
  dosen_id integer [not null, ref: > Dosens.id]
  tanggal_sidang date [not null]
  sesi_ke integer [not null]`, "ketersediaan penguji per slot"),
      current("PendaftaranSidangs", `  id integer [pk, increment]
  periode_sidang_id integer [not null, ref: > PeriodeSidangs.id]
  mahasiswa_id integer [not null, ref: > Mahasiswas.id]
  dosen_pembimbing_id integer [ref: > Dosens.id]
  status varchar(20) [not null]
  registered_at timestamptz [not null]`, "pendaftaran mahasiswa ke periode sidang"),
      current("JadwalSidangPengujis", `  id integer [pk, increment]
  periode_sidang_id integer [not null, ref: > PeriodeSidangs.id]
  pendaftaran_sidang_id integer [not null, unique, ref: - PendaftaranSidangs.id]
  mahasiswa_id integer [not null, ref: > Mahasiswas.id]
  tanggal_sidang date [not null]
  sesi_ke integer [not null]
  ruangan varchar(120) [not null]
  penguji1_dosen_id integer [not null, ref: > Dosens.id]
  penguji2_dosen_id integer [not null, ref: > Dosens.id]
  assignment_status varchar(20) [not null]`, "hasil penjadwalan otomatis")],
  },
  {
    file: "07-penilaian-revisi-dan-yudisium.dbml",
    title: "Penilaian, Revisi, dan Yudisium",
    order: "Penguji memasukkan nilai → sistem menghitung hasil → jika revisi mahasiswa mengunggah → dosen approve/revisi ulang → verifikasi akademik → Sekprodi memformalkan yudisium → siklus ditutup",
    tables: [actorTables.Dosens, actorTables.SekretarisProdis, actorTables.Mahasiswas,
      current("PeriodeAkademiks", `  id integer [pk, increment]
  kode varchar(40) [not null, unique]
  tahun_akademik varchar(20) [not null]
  semester varchar(10) [not null]`, "periode yudisium"),
      current("JadwalSidangPengujis", `  id integer [pk, increment]
  mahasiswa_id integer [not null, ref: > Mahasiswas.id]
  penguji1_dosen_id integer [not null, ref: > Dosens.id]
  penguji2_dosen_id integer [not null, ref: > Dosens.id]
  assignment_status varchar(20) [not null]`, "sidang yang dinilai"),
      proposed("RubrikPenilaianSidangs", `  id integer [pk, increment]
  kode varchar(40) [not null, unique]
  nama varchar(160) [not null]
  bobot decimal(5,2) [not null]
  is_active boolean [not null]`, "master komponen nilai"),
      proposed("PenilaianSidangs", `  id bigint [pk, increment]
  jadwal_sidang_penguji_id integer [not null, ref: > JadwalSidangPengujis.id]
  dosen_id integer [not null, ref: > Dosens.id]
  peran_penilai varchar(20) [not null]
  status varchar(20) [not null]
  nilai_total decimal(5,2)

  Indexes {
    (jadwal_sidang_penguji_id, dosen_id, peran_penilai) [unique]
  }`, "header lembar nilai per penguji"),
      proposed("DetailNilaiSidangs", `  id bigint [pk, increment]
  penilaian_sidang_id bigint [not null, ref: > PenilaianSidangs.id]
  rubrik_penilaian_sidang_id integer [not null, ref: > RubrikPenilaianSidangs.id]
  nilai decimal(5,2) [not null]`, "nilai per komponen rubrik"),
      proposed("HasilSidangs", `  id bigint [pk, increment]
  jadwal_sidang_penguji_id integer [not null, unique, ref: - JadwalSidangPengujis.id]
  nilai_akhir decimal(5,2)
  status_hasil varchar(30) [not null]
  batas_revisi_at timestamptz
  finalized_by_sekretaris_id integer [ref: > SekretarisProdis.id]`, "hasil agregat dan keputusan sidang"),
      proposed("RevisiSkripsis", `  id bigint [pk, increment]
  hasil_sidang_id bigint [not null, ref: > HasilSidangs.id]
  mahasiswa_id integer [not null, ref: > Mahasiswas.id]
  version_number integer [not null]
  file_path varchar(500) [not null]
  status varchar(30) [not null]`, "versi revisi pasca-sidang"),
      proposed("PersetujuanRevisiSidangs", `  id bigint [pk, increment]
  revisi_skripsi_id bigint [not null, ref: > RevisiSkripsis.id]
  dosen_id integer [not null, ref: > Dosens.id]
  peran_penilai varchar(20) [not null]
  keputusan varchar(30) [not null]
  decided_at timestamptz [not null]`, "approval revisi oleh dosen"),
      proposed("Yudisiums", `  id bigint [pk, increment]
  hasil_sidang_id bigint [not null, unique, ref: - HasilSidangs.id]
  mahasiswa_id integer [not null, ref: > Mahasiswas.id]
  periode_akademik_id integer [not null, ref: > PeriodeAkademiks.id]
  status varchar(20) [not null]
  nomor_keputusan varchar(120)
  tanggal_yudisium date
  verified_by_sekretaris_id integer [ref: > SekretarisProdis.id]`, "keputusan akademik final")],
  },
];

for (const [index, stage] of stages.entries()) {
  const number = String(index + 1).padStart(2, "0");
  const content = [header(number, stage.title, stage.order), ...stage.tables, ""].join("\n\n");
  fs.writeFileSync(path.join(__dirname, stage.file), content, "utf8");
}

console.log(`Generated ${stages.length} ordered BPMN DBML views in ${__dirname}`);
