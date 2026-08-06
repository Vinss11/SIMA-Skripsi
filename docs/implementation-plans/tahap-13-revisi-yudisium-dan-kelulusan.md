# Rancangan Pengerjaan Tahap 13 — Revisi, Yudisium, dan Kelulusan

## 1. Tujuan

Menutup siklus mahasiswa setelah sidang melalui revisi, verifikasi akhir, yudisium, kelulusan, dan pengakhiran penetapan pembimbing.

## 2. Acuan

BR-NILAI-002, BR-SEMESTER-003, BR-SIDANG-002, BR-AKADEMIK-001, BR-AKADEMIK-007, BR-AKADEMIK-009, BR-AKADEMIK-010, dan BR-AUDIT-001–004.

## 3. State machine

```text
sidang_lulus → revisi_pending → revisi_diajukan → revisi_selesai
             → clearance_akademik_pending
             → siap_yudisium → yudisium_disetujui → lulus
```

Jalur gagal sidang dan pengulangan sidang harus dikonfigurasi terpisah; jangan mengubahnya otomatis menjadi ulang penjaluran tanpa keputusan akademik.

Secara normal mahasiswa sudah lulus mata kuliah penjaluran sebelum sidang karena Tahap 8 menerapkannya sebagai hard gate. Tahap 13 tetap memeriksa ulang untuk menangani koreksi data akademik setelah sidang atau data legacy. `clearance_akademik_pending` tidak membatalkan hasil sidang/revisi yang sudah sah, tetapi menahan yudisium sampai data kembali valid.

## 4. Paket pengerjaan

1. Mahasiswa mengunggah revisi dan menjawab setiap item wajib.
2. Pembimbing/otoritas memvalidasi atau mengembalikan revisi dengan catatan.
3. Sistem menegakkan batas waktu dan menampilkan keterlambatan tanpa menghapus akses secara diam-diam.
4. Gate yudisium mengecek hasil terkunci, revisi selesai, dokumen akhir, tidak ada hold, dan memvalidasi ulang bahwa mata kuliah penjaluran jalur aktif terakhir tetap berstatus `lulus` pada attempt efektif yang sama/lebih baru.
5. Resolver memakai mapping jalur–kurikulum dan histori Tahap 5; nama mata kuliah tidak dicocokkan sebagai teks bebas.
6. Jika hasil belum tersedia atau masih `sedang_mengambil`, tampilkan next action memeriksa Gateway dan menunggu hasil akademik.
7. Jika `tidak_lulus`, pertahankan seluruh progres lalu tampilkan kebutuhan repeat semester berikutnya tanpa membuat tugas key-in di SIMPS.
8. Jika data atau mapping tidak tersedia, hasil gate `undetermined` dan masuk antrean rekonsiliasi; tidak boleh dianggap lulus.
9. Rapat/otoritas yudisium menetapkan approved/hold dengan catatan kekurangan.
10. Status lulus menyimpan tanggal dan keputusan, mengakhiri penetapan pembimbing, menutup bimbingan baru, dan mempertahankan histori.
11. Perubahan setelah lulus hanya melalui koreksi ter-audit.

## 5. UI dan output

- Mahasiswa melihat revisi, deadline, status validasi, mata kuliah penjaluran yang wajib, hasil akademik, next action, dan hasil akhir.
- Pembimbing mempunyai antrean revisi.
- Sekprodi mempunyai dashboard kesiapan yudisium dan daftar kekurangan; Admin hanya mengelola import/koreksi hasil melalui Data Akademik.
- Output akhir memuat mahasiswa, jalur, pembimbing, penguji, jadwal, nilai, hasil, dan tanggal lulus.

## 6. Pengujian

Uji revisi tidak lengkap, deadline, penolakan revisi, hold yudisium, approval ganda, pengakhiran penetapan, larangan bimbingan setelah lulus, serta koreksi hasil. Tambahkan kasus mata kuliah lulus, sedang diambil, belum di-key-in, tidak lulus lalu repeat, data tidak tersedia, mapping jalur salah, alih jalur, dan percobaan bypass API.

## 7. Definition of Done

Mahasiswa dapat mencapai status lulus melalui state yang valid; setiap gate memiliki bukti, aktor, waktu, dan histori; tidak ada mahasiswa lulus yang masih memiliki penetapan aktif; dan tidak ada mahasiswa siap yudisium tanpa bukti lulus mata kuliah penjaluran yang sesuai jalur aktif terakhir. Status mata kuliah yang belum lulus hanya menahan clearance, tanpa mereset progres atau membatalkan hasil sidang.
