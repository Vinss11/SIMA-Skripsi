# Tahap 5 — Nilai Mata Kuliah Penjaluran

## 1. Tujuan

Admin mengimpor nilai mata kuliah penjaluran mahasiswa secara massal berdasarkan periode pendaftaran penjaluran yang dibuat Sekretaris Prodi.

Nilai yang disimpan menjadi sumber yang sama untuk:

- grid Data Akademik Admin;
- menu Data Akademik mahasiswa;
- item syarat `Mata Kuliah Penjaluran` pada menu Dokumen;
- pemeriksaan kelayakan sidang dan yudisium.

SIMPS tidak mengelola antrean atau konfirmasi key-in Gateway. Pesan agar mahasiswa memeriksa Gateway tetap ditampilkan setelah form awal berhasil dikirim.

## 2. Mapping mata kuliah

| Jalur penjaluran | Mata kuliah |
| --- | --- |
| Penelitian | Metodologi Penelitian |
| Magang | Manajemen Diri |
| Perintisan Bisnis | Metode/Metodologi Perintisan Bisnis sesuai kurikulum |
| Pengabdian Masyarakat | Tetap hold |

Mapping memakai kode mata kuliah dan kurikulum, bukan pencocokan nama bebas.

## 3. Nilai yang diperbolehkan

```text
A
B+
B
B-
B/C
C+
C
C-
C/D
D+
D
D-
D/F
F
```

Normalisasi input:

- hapus spasi di awal/akhir;
- ubah huruf menjadi uppercase;
- tolak nilai selain daftar di atas;
- nilai kosong berarti belum tersedia dan tidak disimpan sebagai hasil;
- batas nilai lulus harus berasal dari satu konfigurasi backend yang disahkan Prodi, bukan ditebak atau di-hardcode terpisah pada frontend.

## 4. Grid Data Akademik Admin

Data grid otomatis berasal dari pendaftaran penjaluran yang berhasil dibuat.

Kolom minimum:

```text
NIM
Nama
Jenis Pendaftaran       # Baru | Ulang | Alih
Jalur Penjaluran        # Penelitian | Magang | Perintisan Bisnis
Mata Kuliah Penjaluran
Nilai
Status                  # Belum tersedia | Lulus | Tidak lulus
```

Aturan:

- pilih data menggunakan `periode_pendaftaran_penjaluran_id` milik periode yang dibuat Sekretaris Prodi;
- pendaftaran baru langsung tampil dengan nilai `Belum tersedia`;
- pendaftaran rejected/cancelled tetap dapat berada pada histori, tetapi tidak masuk template nilai aktif;
- ulang pada mata kuliah yang sudah lulus menampilkan hasil sah sebelumnya dan tidak meminta nilai baru;
- alih membuat baris mata kuliah tujuan, sedangkan nilai jalur lama tetap menjadi histori;
- jangan membuat nilai atau attempt palsu hanya agar baris tampil.

## 5. Tab pada halaman Admin

### 5.1 Daftar Nilai

- filter periode pendaftaran penjaluran;
- pencarian NIM/nama;
- filter jenis pendaftaran, jalur, dan status nilai;
- grid sesuai bagian 4;
- read-only untuk penggunaan normal.

### 5.2 Import Nilai

Hanya berisi:

1. pilihan periode pendaftaran penjaluran;
2. tombol `Download Template Nilai`;
3. input file Excel;
4. tombol `Validasi & Preview`;
5. tabel hasil valid/tidak valid;
6. tombol `Simpan Data Valid`;
7. tombol download laporan kesalahan bila ada.

Jangan tampilkan rule-set, source authority, completeness scope, assignment kurikulum, JSON correction, snapshot job, outbox, atau istilah `commit atomik` pada halaman ini.

## 6. Template Excel

Admin memilih satu periode pendaftaran, lalu sistem menghasilkan template berisi:

| ID Pendaftaran | NIM | Nama | Jenis Pendaftaran | Jalur Penjaluran | Kode Mata Kuliah | Mata Kuliah Penjaluran | Nilai |
| --- | --- | --- | --- | --- | --- | --- | --- |
| otomatis | otomatis | otomatis | otomatis | otomatis | otomatis | otomatis | **diisi Admin** |

Aturan template:

- seluruh kolom selain `Nilai` sudah diisi sistem dan tidak boleh diubah;
- hanya pendaftaran yang layak menerima hasil pada periode terpilih yang diekspor;
- `ID Pendaftaran` menjadi identitas server, bukan NIM saja;
- file memuat petunjuk dan daftar nilai yang diperbolehkan;
- satu baris mewakili satu mahasiswa, mata kuliah, dan attempt;
- template tidak memuat antrean/status key-in.

## 7. Flow import massal

```text
Admin pilih periode pendaftaran
→ download template
→ isi kolom Nilai untuk banyak mahasiswa
→ upload file
→ sistem validasi dan menampilkan preview
→ Admin klik Simpan Data Valid
→ nilai tampil pada seluruh consumer
```

Validasi server minimum:

- ID pendaftaran ditemukan dan berada pada periode yang dipilih;
- NIM dan identitas baris masih cocok dengan data server;
- jalur dan mata kuliah sesuai mapping;
- pendaftaran tidak rejected/cancelled;
- nilai termasuk enum yang diperbolehkan;
- tidak ada baris ganda;
- import file yang sama tidak membuat nilai/attempt ganda;
- koreksi nilai membuat versi baru dan mempertahankan histori lama.

Preview menampilkan:

- jumlah seluruh baris;
- jumlah valid;
- jumlah tidak valid;
- alasan kesalahan per baris;
- nilai lama dan nilai baru bila merupakan koreksi.

`Simpan Data Valid` hanya menyimpan baris valid. Baris tidak valid tidak mengubah database dan dapat diunduh sebagai laporan.

## 8. Dampak setelah nilai disimpan

### 8.1 Data Akademik mahasiswa

Tampilkan:

- jenis pendaftaran;
- jalur dan mata kuliah penjaluran;
- periode;
- nilai;
- status lulus/tidak lulus;
- kebutuhan mengulang;
- histori attempt.

### 8.2 Menu Dokumen

Tambahkan item sistem:

```text
Mata Kuliah Penjaluran
Mata kuliah : Manajemen Diri
Nilai       : B+
Status      : Lulus
Syarat sidang: Terpenuhi
```

Item ini bukan file upload dan tidak dapat di-approve manual. Status selalu dibaca dari nilai Data Akademik.

### 8.3 Sidang dan yudisium

- hanya nilai yang dinyatakan lulus oleh konfigurasi resmi yang memenuhi syarat;
- nilai belum tersedia atau tidak lulus memblokir verifikasi/penjadwalan sidang;
- status diperiksa kembali sebelum yudisium;
- koreksi nilai otomatis memperbarui atau menginvalidasi syarat terkait.

## 9. Ulang dan alih jalur

### Ulang

- jika sudah lulus mata kuliah yang sama, gunakan hasil lama;
- jika tidak lulus, buat attempt berikutnya ketika hasil semester berikutnya diimpor;
- pembimbing dan progres bimbingan tidak direset.

### Alih

- gunakan mata kuliah sesuai jalur tujuan;
- nilai jalur lama tetap menjadi histori;
- buat baris tujuan dengan `Belum tersedia`;
- nilai lama tidak memenuhi jalur baru kecuali terdapat ekuivalensi resmi.

## 10. Model minimum

Gunakan atau sesuaikan model berikut:

```text
MappingMataKuliahPenjaluran
- kurikulum_id
- jalur
- mata_kuliah_id
- periode_berlaku

KewajibanMataKuliahPenjaluran
- mahasiswa_id
- pendaftaran_penjaluran_id
- mata_kuliah_id
- status
- fulfilled_attempt_id

PercobaanMataKuliahMahasiswa
- mahasiswa_id
- pendaftaran_penjaluran_id
- mata_kuliah_id
- periode_akademik_id
- attempt_ke
- nilai_huruf
- status_kelulusan
- source_id/import_row_id
- version/previous_version_id
```

Tidak ada model `TugasKeyinMataKuliahPenjaluran`.

## 11. API minimum

```text
GET  /api/admin/akademik/nilai?periode_pendaftaran_id=:id
GET  /api/admin/akademik/nilai/template?periode_pendaftaran_id=:id
POST /api/admin/akademik/nilai/imports
POST /api/admin/akademik/nilai/imports/:id/commit
GET  /api/admin/akademik/nilai/imports/:id/report
GET  /api/mahasiswa/akademik/mata-kuliah-penjaluran
GET  /api/mahasiswa/dokumen/persyaratan-sidang
```

Seluruh validasi dan penentuan status lulus dilakukan backend.

## 12. Urutan pengerjaan

1. Tetapkan mapping mata kuliah dan batas nilai lulus resmi.
2. Siapkan model/migration mapping, kewajiban, dan attempt.
3. Buat query grid berdasarkan periode pendaftaran penjaluran.
4. Buat generator template Excel.
5. Buat preview, validasi, import, versioning, dan laporan error.
6. Sederhanakan halaman Admin menjadi tab Daftar Nilai dan Import Nilai.
7. Hubungkan hasil ke Data Akademik mahasiswa.
8. Hubungkan hasil ke menu Dokumen dan gate sidang.
9. Integrasikan ulang/alih dan pemeriksaan yudisium.
10. Jalankan test, rekonsiliasi, dan UAT.

## 13. Pengujian minimum

1. Pendaftaran baru muncul pada periode yang benar.
2. Template hanya menyisakan kolom Nilai untuk diisi Admin.
3. Seluruh enum nilai valid dapat diimpor.
4. Nilai salah, identitas berubah, dan baris ganda ditolak.
5. File sama aman diunggah ulang.
6. Import banyak mahasiswa berhasil dalam satu proses.
7. Hasil tampil konsisten di Admin, mahasiswa, dan Dokumen.
8. Nilai tidak lulus memblokir sidang tanpa memblokir bimbingan.
9. Ulang mempertahankan hasil lulus dan membuat attempt baru hanya bila diperlukan.
10. Alih memakai mata kuliah baru serta mempertahankan histori lama.
11. Koreksi nilai membuat versi baru dan memperbarui gate sidang/yudisium.

## 14. Definition of Done

- Admin dapat download template berdasarkan periode pendaftaran;
- Admin cukup mengisi satu kolom Nilai;
- import massal mempunyai preview dan laporan error;
- nilai tidak dapat diduplikasi atau diubah tanpa histori;
- grid Admin, Data Akademik mahasiswa, dan menu Dokumen konsisten;
- mata kuliah wajib lulus sebelum sidang dan yudisium;
- ulang/alih tidak merusak histori atau progres;
- tidak ada antrean/status/konfirmasi key-in di SIMPS;
- seluruh test dan UAT lulus.
