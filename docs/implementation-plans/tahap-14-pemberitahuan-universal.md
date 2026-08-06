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

Event mata kuliah penjaluran minimum:

- pengingat Gateway pada konfirmasi keberhasilan submit form awal, bukan menunggu keputusan final;
- pembaruan kepada mahasiswa ketika hasil akademik berubah, repeat diperlukan, atau mata kuliah berubah karena alih;
- status sedang mengambil, lulus, atau tidak lulus;
- kebutuhan mengulang pada semester berikutnya;
- kewajiban berubah karena alih jalur;
- clearance yudisium tertahan atau terpenuhi;
- verifikasi/pendaftaran sidang tertahan atau terbuka karena hasil mata kuliah penjaluran.

Judul dibuat oleh sistem dan payload menyimpan `kewajiban_id`, `mata_kuliah_id`, `periode_akademik_id`, serta `jalur_snapshot` bila relevan. Retry dan bulk key-in tidak boleh menghasilkan notifikasi ganda.

## 6. Pengujian

Uji penerima, idempotensi, unread count lintas tab, mark read, referensi terhapus/nonaktif, rollback transaksi, pagination, otorisasi detail, dan aksesibilitas indikator.

## 7. Definition of Done

Seluruh event kritis mempunyai template dan test penerima; pengingat Gateway tampil setelah submit form tanpa diduplikasi saat finalisasi, mahasiswa menerima perubahan hasil/repeat/alih, dan Sekprodi menerima hold sidang/yudisium yang relevan; SIMPS tidak membuat notifikasi tugas key-in Admin; tidak ada notifikasi ganda karena retry; menu serta lonceng konsisten dan tautan selalu diotorisasi.
