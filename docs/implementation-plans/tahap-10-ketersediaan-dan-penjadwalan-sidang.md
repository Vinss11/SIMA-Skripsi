# Rancangan Pengerjaan Tahap 10 — Ketersediaan dan Penjadwalan Sidang

## 1. Tujuan

Membuat periode sidang, slot, ketersediaan dosen, auto-assign, dan penetapan ruang tanpa konflik dengan komposisi tepat tiga dosen.

## 2. Acuan

BR-JADWAL-001 dan BR-JADWAL-004–006. Pembimbing wajib hadir; bila berhalangan dilakukan reschedule.

## 3. Paket pengerjaan

### Paket 1 — Periode dan slot

1. Sekprodi menetapkan rentang tanggal, pengecualian, sesi, durasi, istirahat, dan ruangan.
2. Durasi awal 90 menit menjadi konfigurasi, termasuk aturan khusus Jumat.
3. Generator slot idempotent dan tidak menimpa slot yang sudah dipakai tanpa konfirmasi.

### Paket 2 — Ketersediaan dosen

1. Dosen mengisi slot bersedia menguji.
2. Sistem menandai belum mengisi dan menghitung kecukupan kebutuhan.
3. Ketersediaan pembimbing ikut divalidasi.
4. Perubahan setelah jadwal final harus melalui workflow perubahan, bukan update diam-diam.

### Paket 3 — Kandidat dan auto-assign

Algoritma mempertimbangkan bidang, kelas/aturan pasangan, larangan, ketersediaan, pemerataan beban, pembimbing, ruang, dan konflik. Hasil menyertakan alasan serta constraint yang dipenuhi/gagal.

### Paket 4 — Penjadwalan final

1. Setiap mahasiswa tepat mempunyai pembimbing, Penguji 1, dan Penguji 2.
2. Penguji berbeda dan bukan pembimbing mahasiswa tersebut.
3. Cegah bentrok dosen, mahasiswa, dan ruang dengan constraint/check transaksional.
4. Sekprodi dapat meninjau dan menyesuaikan rekomendasi sebelum finalisasi.
5. Finalisasi membuat snapshot dan pemberitahuan.

## 4. UI

- Kalender/matriks slot untuk Sekprodi.
- Form ketersediaan sederhana untuk dosen.
- Indikator kekurangan kapasitas dan konflik.
- Penjelasan rekomendasi auto-assign.

## 5. Pengujian

Uji jumlah dosen bukan tiga, bentrok serentak, pembimbing tidak tersedia, ruang ganda, beban, aturan kelas, bidang, concurrency finalisasi, serta hari/sesi pengecualian.

## 6. Definition of Done

Seluruh mahasiswa verified dapat dijadwalkan tanpa bentrok, tepat tiga dosen, ruang valid, dan alasan penempatan yang dapat ditinjau manusia.

