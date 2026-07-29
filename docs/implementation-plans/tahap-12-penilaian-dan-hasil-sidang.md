# Rancangan Pengerjaan Tahap 12 — Penilaian dan Hasil Sidang

## 1. Tujuan

Mencatat nilai setiap penilai, menghitung hasil akhir, mengunci keputusan sidang, dan menghasilkan daftar revisi secara aman.

## 2. Acuan

BR-NILAI-001–002. Bobot nilai dan pihak pengunci merupakan decision gate akademik yang harus dikonfirmasi sebelum aktivasi produksi.

## 3. Model data

- Master komponen dan bobot berdasarkan jalur/periode.
- Nilai per jadwal, dosen, peran, dan komponen.
- Hasil akhir: nilai numerik/huruf bila digunakan, status lulus/tidak lulus, pemutus, dan waktu kunci.
- Revisi per penilai: uraian, kategori, wajib, dan status.
- Histori buka kunci dan koreksi.

## 4. Paket pengerjaan

1. Definisikan rubrik dan validator rentang nilai.
2. Hanya tiga dosen pada jadwal final yang dapat mengisi sesuai perannya.
3. Autosave draft dibedakan dari submit final.
4. Perhitungan dilakukan backend dengan versi aturan/bobot tersimpan.
5. Hasil tidak dapat dikunci sebelum seluruh nilai wajib masuk.
6. Penguncian dan buka kunci berotorisasi, beralasan, dan ter-audit.
7. Setelah dikunci, hasil dan revisi tampil kepada mahasiswa sesuai waktu publikasi.
8. Berita acara dihasilkan dari data terkunci; bukan surat tugas pembimbing.

## 5. Pengujian

Uji nilai di luar rentang, penilai asing, komponen kurang, bobot tidak 100%, submit ganda, concurrency, kalkulasi, buka kunci, perubahan rubrik historis, dan publikasi hasil.

## 6. Definition of Done

Setiap hasil dapat direkonstruksi dari nilai penilai dan versi rubrik; nilai terkunci aman dari perubahan langsung dan revisi tercatat untuk tahap berikutnya.

