# Rancangan Pengerjaan Tahap 7 — Penguatan Proses Bimbingan

## 1. Tujuan

Mengikat setiap aktivitas bimbingan pada penetapan, semester, jalur, dan siklus yang benar serta memperjelas hak P1/P2 dan kesiapan sidang.

## 2. Acuan

BR-PENETAPAN-003–004, BR-BIMBINGAN-001–002, BR-SEMESTER-001–003, dan BR-SIDANG-001.

## 3. Paket pengerjaan

1. Tambahkan referensi penetapan, periode, semester, jalur, dan siklus pada bimbingan baru.
2. Backfill data lama dengan laporan untuk baris ambigu.
3. Mahasiswa memilih P1 atau P2 aktif sebagai tujuan.
4. Hanya dosen tujuan yang dapat menerima/menolak, memberi catatan, dan memvalidasi resume.
5. Pergantian pembimbing mempertahankan bimbingan dalam siklus sama; request pending dosen lama ditangani eksplisit.
6. Ulang/alih tidak menghapus histori tetapi penghitung progres memakai siklus baru.
7. Buat konfigurasi minimum bimbingan berdasarkan jalur/program/periode.
8. Tambahkan workflow siap sidang: diajukan, persetujuan pembimbing yang diwajibkan, dan diteruskan ke verifikasi akademik.
9. Semua aksi membuat audit dan pemberitahuan.

## 4. UI

- Timeline bimbingan menampilkan semester dan pembimbing.
- Mahasiswa melihat progres minimum dan status resume.
- Dosen hanya melihat antrean yang menjadi kewenangannya.
- Sekprodi dapat melihat histori tanpa mengubah isi akademik.

## 5. Pengujian

Uji otorisasi P1/P2, dosen lama setelah pergantian, pemisahan ulang/alih, hitungan minimum, backfill, request bersamaan, dan kesiapan sidang.

## 6. Definition of Done

Setiap bimbingan dapat ditelusuri ke penetapan dan semester; otorisasi tidak memakai cache legacy sebagai sumber utama; progres dan kesiapan sidang dihitung konsisten.

