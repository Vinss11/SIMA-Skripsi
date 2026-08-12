# Analisis Relasi Database terhadap SIMPS BPMN V1.2

## Ruang lingkup

Analisis ini membandingkan `docs/bpmn/SIMPS BPMN V1.2.bpmn` dengan model Sequelize dan migration backend sampai `20260811100000-simplify-academic-and-guidance-schema.js`.

Untuk satu gambar end-to-end gunakan `SIMPS-BPMN-KESELURUHAN-RAPI.dbml`. Untuk pembahasan rinci gunakan tujuh diagram kecil di folder `bpmn-flow/` secara berurutan dari 01 sampai 07. File `simps-physical-relational-schema.dbml` adalah referensi fisik lengkap dan memang tidak ditujukan sebagai satu gambar presentasi.

DBML membedakan:

- `CURRENT`: tabel fisik yang sudah didefinisikan backend.
- `PROPOSED`: tabel tambahan untuk aktivitas BPMN yang belum mempunyai penyimpanan relasional memadai.

## Urutan proses dan tabel

| Urutan BPMN | Proses | Tabel utama saat ini | Kekurangan / tabel usulan |
|---|---|---|---|
| 1 | Login dan kelola aktor | `Admins`, `Dosens`, `SekretarisProdis`, `Mahasiswas`, tabel `Auth*` | ID aktor pada sesi/event bersifat polymorphic sehingga tidak memakai FK fisik. |
| 2 | Kelola status dosen dan kesiapan periode | `RiwayatStatusDosens`, `TindakLanjutStatusDosens`, `DosenKetersediaanPeriodes`, `PeriodePenjalurans` | Sudah memiliki histori dan tindak lanjut. |
| 3 | Publikasi dan validasi topik | `Topiks`, `Klasters`, `DosenKlasters`, `KlasterKetuaPeriodes` | Pilihan topik pada `Pengajuans` masih disimpan sebagai kode/judul snapshot, bukan tiga FK. |
| 4 | Pendaftaran jalur dan review | `PendaftaranPenjalurans`, `Pengajuans`, `RiwayatPersetujuans`, `RiwayatWorkflowPenjalurans` | Detail magang masih berada dalam JSONB dan detail pengabdian belum punya tabel: usulan `PendaftaranMagangs` dan `PendaftaranPengabdians`. |
| 5 | Kelompok perintisan | `KelompokPerintisanBisnis`, `AnggotaKelompokPerintisans` | Sudah terhubung ke periode, ketua, anggota, dan pendaftaran masing-masing anggota. |
| 6 | Ulang/alih/ekstensi | `PamitUlangs`, `RiwayatPamitPenjalurans`, `IzinLanjutSkripsis` | Sudah mempunyai chain pendaftaran/penetapan lama-baru dan idempotency key. |
| 7 | Penetapan pembimbing dan surat tugas | `PenetapanPembimbings`, `PenetapanPembimbingDosens`, `SuratTugasPembimbings`, `AssignmentActivationAttempts` | Surat tugas sudah ada; pada contoh awal keliru ditandai sebagai upcoming. |
| 8 | Bimbingan dan rekap kuota | `BimbinganSkripsis` | Data inti sudah tersimpan setelah domain guidance teknis disederhanakan pada migration terbaru. |
| 9 | Upload dan review dokumen sidang | `DokumenSidangs` | Struktur saat ini satu baris per mahasiswa dan kolom tetap. Usulan `DokumenSidangVersions` + `ReviewDokumenSidangs` memberi versi, hash, hubungan pendaftaran, dan keputusan reviewer. |
| 10 | Buka periode dan jadwalkan sidang | `PeriodeSidangs`, `PeriodeSidangHaris`, `PeriodeSidangRuangans`, `PreferensiPengujiSidangs`, `KetersediaanPengujiSidangs`, `PendaftaranSidangs`, `JadwalSidangPengujis` | Jadwal masih menyimpan nama ruangan sebagai teks, bukan FK ruangan. |
| 11 | Input nilai dan tentukan hasil | Belum ada tabel nilai/hasil | Usulan `RubrikPenilaianSidangs`, `PenilaianSidangs`, `DetailNilaiSidangs`, dan `HasilSidangs`. |
| 12 | Revisi dan approval | Belum ada | Usulan `RevisiSkripsis` dan `PersetujuanRevisiSidangs`. |
| 13 | Verifikasi akhir dan yudisium | Hanya status mahasiswa umum | Usulan `Yudisiums` untuk keputusan formal, periode, pejabat verifikator, dan nomor keputusan. |

## Koreksi terhadap DBML contoh

1. `Admins` saat ini memakai `nip`, `nama`, dan `role`; bukan `username`.
2. `SekretarisProdis` merupakan akun fisik mandiri dan tidak memiliki `dosen_id`.
3. `Dosens` memakai `kode_dosen`, `nik`, status `active/inactive/study_leave/retired`, serta atribut lifecycle keamanan.
4. `Topiks` tidak memiliki `kuota` atau `klaster_id`; klaster topik saat ini adalah enum pada kolom `cluster`.
5. `PendaftaranPenjalurans` membedakan jenis siklus (`baru/ulang/alih`) dari jalur yang diambil (`penelitian/pengabdian/perintisan_bisnis/magang`).
6. `Pengajuans` adalah pengajuan topik dosen atau judul mandiri; bukan container generik untuk mitra dan kelompok.
7. `SuratTugasPembimbings`, `Notifikasis`, tabel histori penetapan, domain nilai penjaluran, serta domain keamanan sudah diimplementasikan.
8. Tabel guidance teknis yang pernah dibuat pada 2 Agustus 2026 telah dihapus oleh migration 11 Agustus 2026; memasukkannya kembali akan membuat diagram tidak sesuai kondisi terbaru.

## Keputusan desain tabel usulan

- Riwayat upload dan revisi dibuat append-only melalui `version_number`; file lama tidak ditimpa. Dokumen diikat lebih dahulu ke siklus `PendaftaranPenjalurans` karena upload terjadi sebelum `PendaftaranSidangs` menurut BPMN.
- Nilai dipisah menjadi header penilaian dan detail rubrik agar jumlah komponen dapat berubah tanpa menambah kolom.
- `HasilSidangs` menjadi hasil agregat tunggal untuk satu jadwal dan menjadi akar proses revisi serta yudisium.
- Approval revisi disimpan per dosen/peran sehingga keputusan penguji dan pembimbing dapat diaudit.
- Yudisium dipisahkan dari status mahasiswa karena merupakan keputusan akademik formal dengan periode dan nomor keputusan sendiri.

## Catatan implementasi

DBML usulan belum merupakan migration. Implementasi sebaiknya dilakukan bertahap: migration tabel detail jalur, migration versi dokumen, migration nilai/hasil, migration revisi, lalu migration yudisium. Setiap tahap perlu menambah model, association, service transaction, authorization, constraint/check, index, dan integration test.
