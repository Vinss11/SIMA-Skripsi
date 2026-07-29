# Rancangan Pengerjaan Tahap 11 — Penggantian Penguji dan Reschedule

## 1. Tujuan

Menangani perubahan setelah jadwal final tanpa kehilangan jadwal, personel, keputusan, dan pemberitahuan lama.

## 2. Acuan

BR-RESCHEDULE-001–002, BR-JADWAL-001, dan BR-AUDIT-001–004.

## 3. Model workflow

- Permintaan perubahan: jenis, jadwal, pengusul, alasan, penguji pengganti yang diusulkan, status, pemutus, dan waktu.
- Revisi jadwal: hubungan jadwal lama-baru, nomor revisi, alasan, dan status.
- Histori anggota sidang menyimpan peran, masa berlaku, dan sumber perubahan.

## 4. Paket pengerjaan

### Penggantian penguji

1. Penguji mengajukan dan dapat mengusulkan pengganti.
2. Sekprodi memvalidasi eligibility, bidang, kelas, ketersediaan, dan konflik pengganti.
3. Approval mengganti hanya penguji terkait secara transaksional.
4. Rejection mempertahankan jadwal.
5. Semua pihak diberi pemberitahuan.

### Reschedule

1. Jika pembimbing berhalangan, sistem tidak menawarkan penggantian pembimbing sidang.
2. Cari slot dan ruang baru yang memenuhi seluruh peserta.
3. Jadwal lama ditandai rescheduled dan tetap readonly.
4. Buat jadwal revisi baru dan hubungkan ke jadwal lama.
5. Cegah perubahan bila sidang sudah completed/hasil dikunci kecuali workflow koreksi khusus.

## 5. Pengujian

Uji pengusul tidak sah, pengganti bentrok, pembimbing berhalangan, request ganda, approval bersamaan, jadwal completed, rollback pemberitahuan, dan histori berantai lebih dari satu reschedule.

## 6. Definition of Done

Penggantian penguji dan reschedule hanya melalui keputusan Sekprodi, selalu tervalidasi ulang, mempunyai histori lengkap, dan tidak menimpa jadwal final lama.

