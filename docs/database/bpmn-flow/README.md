# Relasi Database Berurutan Sesuai SIMPS BPMN V1.2

Diagram sengaja dipisahkan per tahap. Jangan menggabungkan ketujuh file ke satu kanvas dbdiagram.io karena hasilnya akan kembali penuh dengan garis silang.

Jika membutuhkan satu diagram keseluruhan, gunakan `../SIMPS-BPMN-KESELURUHAN-RAPI.dbml`. File tersebut menggabungkan seluruh tahap dalam business-flow view dan memakai `TableGroup` bernomor 00–06.

## Urutan penggunaan

| Tahap | File DBML | Aktivitas BPMN |
|---:|---|---|
| 1 | `01-persiapan-master-dan-periode.dbml` | Login admin, master/status dosen, draft periode, ketersediaan, aktivasi periode |
| 2 | `02-publikasi-dan-validasi-topik.dbml` | Publikasi topik dosen, validasi klaster, topik menjadi available |
| 3 | `03-pendaftaran-jalur-dan-pengajuan.dbml` | Pilih DPA/jalur, submit topik/judul/mitra/kelompok, validasi dan reservasi |
| 4 | `04-review-dan-penetapan-pembimbing.dbml` | Review sesuai jalur, final review Sekprodi, penetapan P1/P2, surat tugas |
| 5 | `05-bimbingan-dan-kelayakan-sidang.dbml` | Log bimbingan, review resume, hitung kuota, upload/review dokumen, eligibility |
| 6 | `06-periode-dan-penjadwalan-sidang.dbml` | Periode/hari/ruang, ketersediaan penguji, pendaftaran, jadwal otomatis |
| 7 | `07-penilaian-revisi-dan-yudisium.dbml` | Nilai, hasil sidang, revisi, approval, verifikasi akademik, yudisium |

## Cara membaca

- Header biru: tabel `CURRENT`, sudah ada pada model/migration backend.
- Header oranye: tabel `PROPOSED`, diperlukan oleh BPMN tetapi belum dimigrasikan.
- Hanya PK, FK, status, dan atribut bisnis utama yang ditampilkan.
- Kolom keamanan, metadata, audit teknis, dan timestamp umum disembunyikan dari view agar hubungan tetap terbaca.
- Skema fisik lengkap tetap tersedia di `../simps-physical-relational-schema.dbml` untuk kebutuhan implementasi.

## Cara membuka

1. Buka dbdiagram.io dan buat diagram baru.
2. Salin isi satu file DBML saja, mulai dari tahap 01.
3. Setelah memahami/mengekspor tahap tersebut, buka diagram baru untuk tahap berikutnya.
4. Pertahankan urutan 01 sampai 07 ketika dimasukkan ke laporan.

## Prinsip relasi

Tabel aktor seperti `Dosens`, `Mahasiswas`, dan `SekretarisProdis` muncul kembali pada beberapa file sebagai konteks. Itu bukan tabel duplikat di database; tabel yang sama hanya ditampilkan ulang agar setiap tahap dapat dibaca secara mandiri.
