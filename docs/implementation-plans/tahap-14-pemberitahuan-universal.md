# Rancangan Pengerjaan Tahap 14 — Pemberitahuan Universal

## 1. Tujuan

Menjamin setiap perubahan penting pada tahap 1–13 sampai kepada penerima yang benar melalui menu universal, lonceng, dan tautan detail.

## 2. Acuan

BR-NOTIF-001–002 dan BR-AUDIT-003–004.

## 3. Kontrak data

Simpan penerima tipe/ID, judul sistem, ringkasan, jenis, referensi objek, payload versi minimal, status baca, waktu baca, waktu dibuat, dan idempotency key.

Notifikasi bukan sumber kebenaran status bisnis; detail selalu dimuat dari objek referensi dengan otorisasi ulang.

## 4. Paket pengerjaan

1. Buat katalog event dan template judul untuk seluruh tahap.
2. Tentukan matriks penerima mahasiswa, P1/P2, penanggung jawab, penguji, Sekprodi, dan Admin.
3. Buat notifikasi dalam transaksi bisnis atau pola outbox agar tidak hilang/duplikat.
4. Sediakan daftar paginated, unread count, mark one/all read, dan detail.
5. Sidebar menampilkan indikator merah/pulse saat unread > 0.
6. Baris tanpa header tabel kaku; tombol mata membuka detail terkait.
7. Cegah kebocoran jika penerima tidak lagi berhak melihat objek.
8. Tetapkan retensi/arsip tanpa menghapus audit bisnis.

## 5. Event minimum

Status dosen, pamit, ulang/alih, kelompok, review jalur, keputusan final, penetapan/pergantian, bimbingan, izin lanjut, persyaratan sidang, jadwal, penggantian penguji, reschedule, nilai, revisi, yudisium, dan kelulusan.

## 6. Pengujian

Uji penerima, idempotensi, unread count lintas tab, mark read, referensi terhapus/nonaktif, rollback transaksi, pagination, otorisasi detail, dan aksesibilitas indikator.

## 7. Definition of Done

Seluruh event kritis mempunyai template dan test penerima; tidak ada notifikasi ganda karena retry; menu serta lonceng konsisten dan tautan selalu diotorisasi.

