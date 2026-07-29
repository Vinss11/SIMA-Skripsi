# Rancangan Pengerjaan Tahap 8 — Verifikasi Persyaratan Pendadaran

## 1. Tujuan

Menggantikan pengecekan manual tersebar dengan checklist terstruktur, terkonfigurasi, ter-audit, dan menjadi gate mutlak sebelum penjadwalan.

## 2. Acuan

BR-SIDANG-001–002, BR-AKADEMIK-001–002, BR-BIMBINGAN-002, dan catatan awal mengenai CEPT, SKS, dokumen, persetujuan pembimbing, hold, serta yudisium.

## 3. Model yang disarankan

- Master persyaratan per jalur/program/periode.
- Pengajuan pendadaran mahasiswa.
- Item persyaratan mahasiswa dengan nilai terstruktur, dokumen, status, pemeriksa, waktu, dan catatan.
- Histori verifikasi/hold/unhold/cancel.

## 4. Paket pengerjaan

1. Definisikan persyaratan wajib/kondisional untuk tiga jalur aktif.
2. Simpan skor CEPT dan tanggal tes/kedaluwarsa; batas awal 420 dan masa berlaku disimpan sebagai konfigurasi.
3. Tarik total SKS, mata kuliah wajib, dan Metodologi dari snapshot akademik.
4. Tarik minimum bimbingan dan persetujuan pembimbing dari sistem, bukan upload ulang.
5. Kelola draf/laporan, logbook, publikasi, LOA, dan dokumen lain sesuai aturan jalur.
6. Buat evaluator readiness yang menghasilkan daftar kekurangan.
7. Implementasikan hold/unhold dan pembatalan verifikasi dengan konfirmasi serta audit.
8. Endpoint penjadwalan wajib menolak mahasiswa yang belum `verified`.

## 5. UI

- Mahasiswa: checklist dan kekurangan.
- Pembimbing: persetujuan akademik yang menjadi kewenangannya.
- Sekprodi/akademik: antrean, filter, bulk review aman, hold, dan histori.

## 6. Pengujian

Uji CEPT di bawah batas/expired, SKS kurang, mata kuliah belum lulus, dokumen invalid, pembatalan verifikasi, stale approval, hold, dan bypass API penjadwalan.

## 7. Definition of Done

Tidak ada mahasiswa yang dapat dijadwalkan sebelum seluruh persyaratan wajib valid; setiap cek dapat dijelaskan siapa, kapan, dan berdasarkan data apa.

