# Indeks Rencana Implementasi SIMPS

Seluruh rencana mengacu pada [`aturan-bisnis-simps.md`](../business-rules/aturan-bisnis-simps.md). Urutan tahap menunjukkan dependensi utama; pekerjaan dalam tahap yang berbeda hanya boleh diparalelkan jika kontrak data tahap sebelumnya sudah stabil.

1. [Finalisasi Status dan Konfigurasi Dosen](./tahap-1-finalisasi-status-dan-konfigurasi-dosen.md)
2. [Finalisasi Penjaluran Tiga Jalur Aktif](./tahap-2-finalisasi-penjaluran-tiga-jalur-aktif.md)
3. [Ulang dan Alih Jalur](./tahap-3-ulang-dan-alih-jalur.md)
4. [Histori Pembimbing per Semester](./tahap-4-histori-pembimbing-per-semester.md)
5. [Mata Kuliah Penjaluran dan Data Akademik](./tahap-5-metodologi-penelitian-dan-data-akademik.md)
6. [Wajib Ganti dan Reset Password](./tahap-6-wajib-ganti-dan-reset-password.md)
7. [Penguatan Proses Bimbingan](./tahap-7-penguatan-proses-bimbingan.md)
8. [Verifikasi Persyaratan Pendadaran](./tahap-8-verifikasi-persyaratan-pendadaran.md)
9. [Master Bidang, Kelas Penguji, dan Ruangan](./tahap-9-master-bidang-kelas-penguji-dan-ruangan.md)
10. [Ketersediaan dan Penjadwalan Sidang](./tahap-10-ketersediaan-dan-penjadwalan-sidang.md)
11. [Penggantian Penguji dan Reschedule](./tahap-11-penggantian-penguji-dan-reschedule.md)
12. [Penilaian dan Hasil Sidang](./tahap-12-penilaian-dan-hasil-sidang.md)
13. [Revisi, Yudisium, dan Kelulusan](./tahap-13-revisi-yudisium-dan-kelulusan.md)
14. [Pemberitahuan Universal](./tahap-14-pemberitahuan-universal.md)
15. [Laporan, Audit, dan Kesiapan Rilis](./tahap-15-laporan-audit-dan-kesiapan-rilis.md)

## Aturan pengelolaan dokumen

- Perubahan bisnis diperbarui pada aturan bisnis terlebih dahulu.
- Setiap tahap mencatat keputusan yang masih menunggu konfirmasi.
- Pengabdian Masyarakat berstatus hold dan tidak menjadi target release aktif.
- Scope aktif adalah Penelitian, Magang, dan Perintisan Bisnis.
- Surat tugas pembimbing tidak menjadi dependensi tahap mana pun.
- Tahap hanya dinyatakan selesai setelah backend, frontend, migration, test, dokumentasi, dan UAT terkait konsisten.
