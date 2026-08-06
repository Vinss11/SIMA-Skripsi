# Rancangan Pengerjaan Tahap 15 — Laporan, Audit, dan Kesiapan Rilis

## 1. Tujuan

Menyediakan monitoring dan laporan end-to-end, memverifikasi audit/integritas, serta menyiapkan deployment aman untuk tiga jalur aktif sampai kelulusan.

## 2. Acuan

BR-AUDIT-001–004 dan Definition of Done sistem. Pengabdian tetap hold dan hanya wajib dijaga agar data/fitur lama tidak rusak.

## 3. Laporan minimum

- Mahasiswa per jalur, periode, baru/ulang/alih, dan status.
- Penetapan serta beban P1/P2 per semester.
- Progres bimbingan dan izin lanjut.
- Kewajiban mata kuliah penjaluran per jalur/kurikulum, attempt lulus/tidak lulus, serta kebutuhan repeat.
- Mahasiswa yang clearance yudisiumnya tertahan karena mata kuliah penjaluran.
- Mahasiswa yang belum dapat diverifikasi/dijadwalkan sidang karena mata kuliah penjaluran.
- Eligibility/hold pendadaran.
- Ketersediaan, beban penguji, jadwal, konflik, dan ruang.
- Penggantian penguji/reschedule.
- Nilai, revisi, yudisium, dan kelulusan.
- Data anomali dan rekonsiliasi.

Filter dan agregasi dilakukan backend; export besar memakai job/streaming agar tidak membebani request utama.

## 4. Audit dan integritas

1. Petakan seluruh keputusan kritis beserta aktor dan before/after.
2. Pastikan histori tidak dapat diedit melalui endpoint umum.
3. Buat checker untuk penetapan ganda, cache P1, kelompok, status mahasiswa, jadwal bentrok, nilai belum lengkap, dan mahasiswa lulus dengan penetapan aktif.
4. Checker akademik minimum mendeteksi mapping jalur–mata kuliah hilang/beririsan, kewajiban ganda, hasil tanpa sumber audit, kewajiban lama aktif setelah alih, repeat setelah sudah lulus, `DefenseVerificationFact`/jadwal sidang tanpa attempt lulus yang sesuai, serta mahasiswa siap yudisium/lulus tanpa attempt lulus jalur aktif terakhir.
5. Semua script mempunyai dry-run, output ID, mode execute eksplisit, dan aman diulang.
6. Tetapkan retensi file, backup, serta akses data pribadi.

## 5. Test lintas sistem

### Automated

- Unit test aturan domain.
- Integration test setiap transisi state dan rollback.
- Contract test API penting.
- E2E happy path Penelitian, Magang, dan Perintisan dari pendaftaran sampai lulus.
- E2E ulang/alih dan jalur gagal/rejected.
- E2E submit form + pengingat Gateway → keputusan final → import hasil lulus/tidak lulus → gate sidang → repeat bila perlu → pemeriksaan ulang clearance yudisium.
- E2E alih jalur mengganti mata kuliah tanpa menghapus histori; kegagalan mata kuliah tidak memblokir bimbingan tetapi memblokir sidang dan yudisium.
- Security test role, forced password, upload, rate limit, dan akses objek.
- Performance test antrean, laporan, auto-scheduling, dan kelompok.

### UAT

Gunakan akun Admin, Sekprodi, Ketua Cluster, Pengawas Magang, Pengampu Perintisan, P1, P2, Penguji, mahasiswa individual, ketua kelompok, dan anggota. Catat bukti dan approval setiap skenario.

## 6. Deployment

1. Bekukan versi aturan bisnis dan keputusan yang masih terbuka.
2. Backup database dan file.
3. Jalankan migration di staging.
4. Jalankan backfill/reconciliation dry-run lalu execute terkontrol.
5. Jalankan automated test dan UAT staging.
6. Siapkan rollback migration/aplikasi yang aman.
7. Deploy production pada window yang disepakati.
8. Jalankan smoke test dan checker integritas.
9. Pantau error, job, notifikasi, dan anomali data.
10. Hapus fallback legacy hanya setelah minimal satu periode stabil dan ada persetujuan.

## 7. Decision gate release

Release belum boleh dinyatakan selesai jika review topik Penelitian, detail judul mandiri, P2, kelas penguji, bobot nilai, mapping mata kuliah penjaluran per kurikulum, sumber hasil lulus/tidak lulus, gate sidang, atau pemeriksaan ulang yudisium yang memengaruhi produksi belum diputuskan.

## 8. Definition of Done

- Tiga jalur aktif lulus E2E dari pendaftaran baru/ulang/alih sampai kelulusan.
- Semua tahap 1–14 memenuhi Definition of Done.
- Laporan dapat direkonsiliasi dengan data sumber.
- Hasil mata kuliah dan sumbernya dapat ditelusuri tanpa menjadikan SIMPS sebagai pengganti Gateway atau pengelola key-in.
- Pendaftaran penjaluran dan bimbingan tidak terblokir oleh mata kuliah penjaluran, sedangkan verifikasi/penjadwalan sidang dan clearance yudisium hanya lolos setelah mata kuliah jalur aktif terakhir lulus.
- Audit dan checker integritas lulus tanpa anomali kritis.
- Migration, backup, rollback, monitoring, dan runbook tersedia.
- UAT ditandatangani pihak terkait.
- Dokumentasi, BPMN, kode, test, dan aturan bisnis konsisten.
