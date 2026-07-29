# Rancangan Pengerjaan Tahap 13 — Revisi, Yudisium, dan Kelulusan

## 1. Tujuan

Menutup siklus mahasiswa setelah sidang melalui revisi, verifikasi akhir, yudisium, kelulusan, dan pengakhiran penetapan pembimbing.

## 2. Acuan

BR-NILAI-002, BR-SEMESTER-003, BR-SIDANG-002, dan BR-AUDIT-001–004.

## 3. State machine

```text
sidang_lulus → revisi_pending → revisi_diajukan → revisi_selesai
             → siap_yudisium → yudisium_disetujui → lulus
```

Jalur gagal sidang dan pengulangan sidang harus dikonfigurasi terpisah; jangan mengubahnya otomatis menjadi ulang penjaluran tanpa keputusan akademik.

## 4. Paket pengerjaan

1. Mahasiswa mengunggah revisi dan menjawab setiap item wajib.
2. Pembimbing/otoritas memvalidasi atau mengembalikan revisi dengan catatan.
3. Sistem menegakkan batas waktu dan menampilkan keterlambatan tanpa menghapus akses secara diam-diam.
4. Gate yudisium mengecek hasil terkunci, revisi selesai, dokumen akhir, dan tidak ada hold.
5. Rapat/otoritas yudisium menetapkan approved/hold dengan catatan kekurangan.
6. Status lulus menyimpan tanggal dan keputusan, mengakhiri penetapan pembimbing, menutup bimbingan baru, dan mempertahankan histori.
7. Perubahan setelah lulus hanya melalui koreksi ter-audit.

## 5. UI dan output

- Mahasiswa melihat revisi, deadline, status validasi, dan hasil akhir.
- Pembimbing mempunyai antrean revisi.
- Sekprodi mempunyai dashboard kesiapan yudisium dan daftar kekurangan.
- Output akhir memuat mahasiswa, jalur, pembimbing, penguji, jadwal, nilai, hasil, dan tanggal lulus.

## 6. Pengujian

Uji revisi tidak lengkap, deadline, penolakan revisi, hold yudisium, approval ganda, pengakhiran penetapan, larangan bimbingan setelah lulus, serta koreksi hasil.

## 7. Definition of Done

Mahasiswa dapat mencapai status lulus melalui state yang valid; setiap gate memiliki bukti, aktor, waktu, dan histori; tidak ada mahasiswa lulus yang masih memiliki penetapan aktif.

