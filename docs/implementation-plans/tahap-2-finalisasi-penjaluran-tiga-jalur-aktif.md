# Rancangan Pengerjaan Tahap 2 — Finalisasi Penjaluran Tiga Jalur Aktif

> **Status implementasi 1 Agustus 2026 — selesai:** koreksi kontrak workflow, invariant finalizer, siklus ulang/alih, invariant kelompok, notifikasi, histori otoritatif, migration/backfill, integration test controller, alur endpoint Perintisan lengkap, dan audit rekonsiliasi operasional telah diterapkan. Predicate rekonsiliasi memakai `Pengajuans` untuk Penelitian dan `form_lanjutan_status` untuk Magang/Perintisan. Temuan notifikasi sudah dipisahkan menjadi data legacy dan anomali alur saat ini tanpa membuat ulang notifikasi lama. Rincian dry-run ada pada bagian 7.2; catatan gap lama dipertahankan sebagai arsip baseline.

## 1. Tujuan

Menstabilkan penjaluran baru untuk Penelitian, Magang, dan Perintisan Bisnis mulai dari pendaftaran pada periode aktif, pengiriman form, review penanggung jawab jalur, keputusan final Sekretaris Prodi, sampai terbentuknya penetapan P1/P2 aktif yang langsung membuka bimbingan tanpa surat tugas.

Tahap ini bukan pembangunan ulang seluruh flow. Implementasi dasar ketiga jalur sudah tersedia; pekerjaan difokuskan pada penyatuan kontrak, penutupan celah integritas data, pemindahan keputusan pembimbing sepenuhnya ke Sekprodi, finalisasi transaksional, idempotensi, histori keputusan, dan pengujian end-to-end.

## 2. Acuan aturan bisnis

Rancangan ini terutama mengacu pada:

- BR-PERIODE-003;
- BR-DAFTAR-001, BR-DAFTAR-005, dan BR-DAFTAR-006;
- BR-PENELITIAN-001 sampai BR-PENELITIAN-004;
- BR-MAGANG-001 sampai BR-MAGANG-003;
- BR-PERINTISAN-001 sampai BR-PERINTISAN-003;
- BR-PENETAPAN-001 sampai BR-PENETAPAN-003;
- BR-NOTIF-001 dan BR-NOTIF-002;
- BR-AUDIT-001 sampai BR-AUDIT-004;
- Definition of Done sistem pada bagian 25.

Keputusan scope yang wajib dijaga:

- jalur release aktif hanya Penelitian, Magang, dan Perintisan Bisnis;
- Pengabdian Masyarakat tetap aman dan datanya tidak dihapus, tetapi flow baru, perluasan UI, dan test bisnis barunya tidak menjadi target selama berstatus hold;
- persetujuan dosen, Ketua Cluster, Pengawas Magang, atau Pengampu Perintisan belum mengaktifkan pembimbing;
- keputusan final Sekprodi adalah satu-satunya dasar penetapan P1/P2 aktif;
- P1 wajib, P2 opsional sampai ada keputusan akademik yang mewajibkannya;
- surat tugas, nomor surat, file surat, dan penerbitan surat berada di luar scope serta tidak boleh menjadi prasyarat aktivasi pembimbing;
- pendaftaran ulang/alih, pamit, dan pemisahan siklus lama dikerjakan pada Tahap 3;
- carry-forward semester dan histori lintas semester dikerjakan pada Tahap 4.

## 3. Decision gate yang tidak boleh diasumsikan

### 3.1 Review topik Penelitian

Urutan review sampai tiga pilihan topik—berurutan atau paralel—masih berstatus ditunda. Tahap 2 boleh:

- memperkuat validasi data dan transaksi;
- memperbaiki histori keputusan;
- memperbaiki reservasi dan pelepasan topik;
- memperbaiki keputusan final Sekprodi;
- menambah test terhadap perilaku yang sedang berjalan.

Tahap 2 tidak boleh mengubah strategi urutan review sampai keputusan dimasukkan ke dokumen aturan bisnis. Service atau enum internal yang menggunakan istilah `parallel` tidak boleh dijadikan bukti bahwa pola paralel sudah merupakan keputusan final.

### 3.2 Judul mandiri

Urutan review dan pihak yang memilih calon pembimbing masih bersifat sementara. Tahap 2 mempertahankan perilaku berjalan, tetapi memastikan:

- pengajuan terhubung ke pendaftaran Penelitian yang benar;
- cluster/bidang tersimpan dan tervalidasi;
- seluruh keputusan tersimpan sebagai histori;
- persetujuan calon pembimbing/Ketua Cluster tidak membuat penetapan aktif;
- Sekprodi tetap melakukan keputusan final P1 dan opsional P2.

### 3.3 Jumlah anggota Perintisan

Baseline form saat ini adalah satu ketua dan dua anggota, dengan tepat satu Hustler, Hipster, dan Hacker. Nilai ini harus berasal dari satu konfigurasi/konstanta domain yang digunakan backend dan frontend, bukan hardcode terpisah. Perubahan jumlah anggota baru dilakukan setelah aturan akademik dan dokumen bisnis diperbarui.

## 4. Batas tahap

### 4.1 Termasuk Tahap 2

- pendaftaran jenis `baru` untuk tiga jalur aktif;
- pengikatan form ke pendaftaran dan periode;
- pengajuan Penelitian melalui topik dosen atau judul mandiri;
- pengajuan Magang individual beserta mitra dan dokumen;
- pembentukan dan pengajuan kelompok Perintisan;
- review penanggung jawab jalur;
- antrean dan keputusan final Sekprodi;
- penetapan P1/P2 semester pertama;
- sinkronisasi cache dan status mahasiswa setelah finalisasi;
- histori, pemberitahuan minimum, idempotensi, rekonsiliasi, dan test terkait.

### 4.2 Tidak termasuk Tahap 2

- generalisasi ulang/alih dan pamit;
- semester kedua/ketiga dan izin lanjut;
- proses bimbingan setelah penetapan aktif selain verifikasi bahwa akses sudah terbuka;
- pendadaran, sidang, nilai, revisi, yudisium, dan kelulusan;
- perubahan flow Pengabdian;
- aktivasi berdasarkan surat tugas;
- perubahan decision gate Penelitian yang masih ditunda.

Implementasi Tahap 2 tetap harus menyediakan kontrak yang dapat dipakai Tahap 3 dan Tahap 4 tanpa mengubah arti pendaftaran atau keputusan final.

## 5. Kontrak domain bersama

### 5.1 Entitas dan sumber kebenaran

| Informasi | Sumber kebenaran | Catatan |
| --- | --- | --- |
| Jenis pendaftaran | `PendaftaranPenjaluran.jalur` | Pada Tahap 2 selalu `baru` |
| Jalur akademik yang dipilih | record pendaftaran | Penelitian, Magang, atau Perintisan Bisnis |
| Periode | relasi pendaftaran ke periode | Tidak boleh dikirim ulang sebagai sumber kebenaran oleh form |
| Status pendaftaran | record pendaftaran | Terpisah dari status workflow form/review |
| Status workflow pengajuan | pengajuan/form jalur | Tidak disimpulkan dari status mahasiswa |
| Penanggung jawab review | penugasan pada periode | Bukan input mahasiswa dan bukan jabatan global semata |
| P1/P2 aktif | penetapan dan anggota penetapan | Cache mahasiswa bukan sumber otoritatif |
| P1 cache | `dosen_pembimbing_skripsi_id` | Hanya disinkronkan dari penetapan aktif |
| Timeline keputusan | histori/audit event | JSON payload boleh menjadi snapshot, bukan satu-satunya histori otoritatif |

### 5.2 Pemisahan lifecycle

Pendaftaran dan pengajuan tidak boleh memakai satu status untuk dua makna.

```text
Pendaftaran:
validasi → accepted/approved → mempunyai form jalur

Pengajuan/form:
draft → submitted → review penanggung jawab → review Sekprodi
      → approved/rejected

Penetapan:
tidak ada → draft internal dalam transaksi → active
```

Tidak diperlukan gate manual Sekprodi hanya untuk mengaktifkan pendaftaran baru jika server sudah memvalidasi seluruh syarat. Apabila verifikasi pendaftaran manual yang ada ingin dipertahankan sebagai proses bisnis, aturan tersebut harus ditambahkan terlebih dahulu ke dokumen bisnis. Status `approved` pada pendaftaran tidak boleh disalahartikan sebagai keputusan final akademik atau aktivasi pembimbing.

### 5.3 Status normalisasi API

Status spesifik database boleh dipertahankan untuk kompatibilitas, tetapi setiap response workflow wajib menyediakan dua nilai yang eksplisit:

```json
{
  "workflow_stage": "waiting_final_decision",
  "raw_workflow_status": "review_sekprodi"
}
```

Kamus `workflow_stage` bersama:

| Workflow stage | Makna |
| --- | --- |
| `draft` | Form belum dikirim |
| `submitted` | Form sudah dikirim dan menunggu routing |
| `under_path_review` | Sedang diperiksa dosen/penanggung jawab jalur |
| `waiting_final_decision` | Seluruh review wajib selesai dan menunggu keputusan final Sekprodi |
| `approved` | Keputusan final berhasil dan penetapan aktif tersedia |
| `rejected` | Pengajuan ditolak oleh aktor yang berwenang |
| `completed` | Workflow telah ditutup setelah seluruh hasil terkait selesai |
| `cancelled` | Proses dibatalkan secara sah |

Response juga mengembalikan `current_actor`, `allowed_actions`, `blocking_reasons`, dan timeline. Frontend hanya menggunakan `workflow_stage` untuk menentukan tampilan umum dan tidak menebak next action dari status mentah. `raw_workflow_status` tetap tersedia untuk detail jalur, audit, dan kompatibilitas selama migrasi.

### 5.4 Invariant global

1. Satu mahasiswa maksimal mempunyai satu pendaftaran pada periode yang sama.
2. Satu pendaftaran hanya mempunyai satu pengajuan/form utama aktif.
3. Jalur pada form wajib sama dengan target jalur pendaftaran.
4. Form hanya dapat dikirim ketika periode dan pendaftaran masih memenuhi syarat.
5. Setelah satu form aktif dikirim, mahasiswa tidak dapat mengirim jalur lain.
6. Approval pra-Sekprodi tidak membuat penetapan atau cache P1.
7. Final approval selalu menghasilkan tepat satu penetapan aktif dengan P1 dan opsional P2.
8. P1 dan P2 harus berbeda.
9. Status, ketersediaan periode, bidang/cluster, dan kuota diperiksa ulang saat finalisasi.
10. Request ulang tidak membuat pendaftaran, histori keputusan, penetapan, atau pemberitahuan ganda.
11. Seluruh perubahan finalisasi berada dalam satu transaksi.
12. Pengabdian tidak dapat dipilih sebagai target pendaftaran baru selama berstatus hold.

## 6. Kontrak workflow per jalur

### 6.1 Penelitian

```text
Pendaftaran Penelitian
  → pilih sampai tiga topik ATAU ajukan judul mandiri
  → review calon dosen sesuai perilaku berjalan
  → review Ketua Cluster sesuai perilaku berjalan
  → antrean final Sekprodi
  → Sekprodi menetapkan topik/judul final + P1 + opsional P2
  → penetapan aktif + bimbingan terbuka
```

Ketentuan:

- topik, judul topik, dan pemilik topik selalu dibaca ulang dari database;
- prioritas/slot disimpan eksplisit dan unik dalam satu pengajuan;
- reservasi menggunakan row lock dan transaksi;
- satu topik tidak dapat menjadi final bagi dua mahasiswa;
- topik yang kalah, ditolak final, dibatalkan, atau ditinggalkan dilepas sesuai state terakhir yang sah;
- Sekprodi melihat seluruh pilihan dan histori review sebelum memutuskan;
- P1 tidak boleh otomatis dikunci ke dosen pemilik/pemenang topik jika aturan bisnis menyatakan Sekprodi menentukan P1;
- P1/P2 harus memenuhi cluster/bidang yang relevan serta aturan status, ketersediaan, dan kuota;
- status jalur mahasiswa setelah finalisasi berasal dari target pendaftaran (`penelitian`), bukan dari jenis pendaftaran (`baru`).

### 6.2 Magang

```text
Pendaftaran Magang
  → isi form dan unggah dokumen
  → review Pengawas Magang periode
  → antrean final Sekprodi
  → Sekprodi menetapkan P1 + opsional P2
  → penetapan aktif + bimbingan terbuka
```

Ketentuan:

- mitra aktif dipilih melalui ID master, bukan nama bebas;
- server membuat snapshot nama dan atribut penting mitra pada saat submit;
- perusahaan nonmitra disimpan sebagai data snapshot tanpa membuat master mitra secara diam-diam;
- posisi, perusahaan, dan detail kegiatan yang diperlukan tersimpan sebagai data pengajuan;
- aturan wajib dokumen, ekstensi/MIME, dan ukuran berasal dari konfigurasi backend yang sama dengan metadata UI;
- file di-stage terlebih dahulu dan dibersihkan ketika transaksi gagal;
- download hanya dapat dilakukan oleh pemilik, Pengawas Magang periode terkait, dan Sekprodi yang berwenang;
- menonaktifkan master mitra setelah submit tidak mengubah snapshot historis;
- Pengawas Magang tidak otomatis menjadi P1/P2.

### 6.3 Perintisan Bisnis

```text
Pendaftaran dan kelompok tervalidasi
  → ketua mengisi dan mengirim satu form kelompok
  → review Pengampu Perintisan periode
  → antrean final Sekprodi
  → Sekprodi menetapkan P1 + opsional P2 untuk seluruh anggota
  → seluruh penetapan aktif dalam satu transaksi
```

Ketentuan:

- setiap anggota mempunyai pendaftaran sendiri pada periode yang sama dengan target Perintisan;
- satu anggota hanya berada pada satu kelompok aktif;
- tepat satu anggota berposisi ketua;
- hanya ketua yang dapat mengubah dan mengirim form;
- payload kelompok disimpan satu kali sebagai sumber utama; tampilan anggota membaca sumber kelompok, bukan menyalin JSON independen yang dapat berbeda;
- perubahan anggota setelah submit dilarang atau dilakukan melalui flow koreksi yang mempunyai histori;
- review dilakukan satu kali untuk kelompok dan hasilnya terlihat pada seluruh anggota;
- pada final approval, tabel `KelompokPerintisanBisnis` dan `AnggotaKelompokPerintisan` adalah sumber kebenaran anggota; `form_lanjutan_payload.kelompok.anggota` hanya snapshot audit;
- kelompok dan seluruh row anggota diambil ulang serta dikunci dalam transaksi keputusan final;
- setiap anggota harus masih berada pada kelompok yang sama dan mempunyai pendaftaran target Perintisan pada periode kelompok;
- kuota P1 dan P2 masing-masing membutuhkan slot sebesar jumlah anggota;
- komposisi P1/P2 sama untuk seluruh anggota;
- jika satu anggota, satu penetapan, satu notifikasi utama, atau satu update gagal, seluruh finalisasi rollback;
- kegagalan tidak meninggalkan sebagian anggota berstatus approved atau mempunyai pembimbing aktif.

## 7. Kondisi implementasi saat ini

### 7.1 Bagian yang sudah sesuai

Implementasi saat ini sudah memenuhi fondasi bisnis berikut dan perilaku ini wajib dipertahankan selama refactor:

- approval dosen pengampu/penanggung jawab belum langsung mengaktifkan pembimbing;
- Sekprodi tetap menjadi pengambil keputusan final;
- P1 dan P2 divalidasi serta harus berbeda;
- status master, konfigurasi periode, dan kuota diperiksa sebelum penetapan;
- penetapan pembimbing diaktifkan tanpa surat tugas;
- riwayat penetapan dibuat melalui service transaksional;
- notifikasi penetapan dibuat dalam transaksi yang sama sehingga kegagalannya dapat me-rollback aktivasi;
- Perintisan memproses seluruh anggota dalam satu transaksi controller;
- Penelitian, Magang, dan Perintisan sudah mempunyai antrean serta aksi final Sekprodi;
- Penelitian memakai `replaceSupervisorAssignment()` pada [sekretarisController.js](../../server/controllers/sekretarisController.js:4069);
- finalisasi Perintisan memakai service yang sama untuk setiap anggota pada [jalurController.js](../../server/controllers/jalurController.js:3066);
- model pendaftaran, pengajuan Penelitian, kelompok, anggota kelompok, penetapan, dan anggota penetapan sudah tersedia;
- unique active assignment per mahasiswa dan deduplication key pemberitahuan sudah tersedia.

### 7.2 Status koreksi implementasi 2026-07-30

1. Kamus `workflow_stage` sudah mengikuti kontrak bagian 5.3: `draft`, `under_path_review`, `waiting_final_decision`, `approved`, `rejected`, `completed`, dan `cancelled`.
2. Finalizer mengunci ulang sumber keputusan dan pendaftaran, lalu memvalidasi jalur akademik, approval pendaftaran, tahap workflow, serta konsistensi sumber sebelum membuat penetapan.
3. Pendaftaran `baru`, `ulang`, dan `alih` diperlakukan sebagai siklus baru dengan `sumber_data = penjaluran` dan `semester_penjaluran_ke = 1`.
4. Finalisasi Perintisan memvalidasi tepat tiga anggota, satu ketua dan dua anggota, komposisi Hustler/Hipster/Hacker, keunikan mahasiswa/pendaftaran, periode, jalur, approval, status kelompok, dan konsistensi workflow dari tabel yang dikunci.
5. Histori Magang dan Perintisan tersimpan pada `RiwayatWorkflowPenjalurans`. JSON hanya menjadi snapshot/fallback dan timeline lama dibackfill dengan deduplication key.
6. Notifikasi workflow tersedia untuk form terkirim, antrean review, keputusan penanggung jawab, antrean final, penolakan final, dan penetapan pembimbing.
7. Integration test controller mencakup final Penelitian, Magang, dan Perintisan, salah program, salah cluster, status dosen berubah, kuota penuh, request paralel, idempotensi, histori, dan notifikasi.
8. Skenario Perintisan tidak lagi hanya menguji resolver: test menjalankan submit ketua, review Pengampu, final Sekprodi, lalu memverifikasi tiga penetapan P1 aktif, histori final, notifikasi, dan status kelompok.
9. `reconcile-stage2-registrations.js` memeriksa duplikat pendaftaran, jalur tidak valid, final approved tanpa penetapan, penetapan tanpa pendaftaran, cache P1 berbeda, histori workflow hilang, kelompok Perintisan tidak konsisten, finalisasi tanpa notifikasi, dan lebih dari satu penetapan aktif.

Dry-run pada 1 Agustus 2026 berhasil dijalankan dan menemukan empat anomali data lama. Dua pendaftaran Penelitian tanpa histori dikonfirmasi melalui `Pengajuans` otoritatif—masing-masing mempunyai Pengajuan `pending` dan `approved` dari sebelum fitur histori—bukan lagi dipilih karena `form_lanjutan_status`. Dua finalisasi tanpa notifikasi diklasifikasikan sebagai `legacy_before_notification_feature` berdasarkan batas migration `20260724090000`; kategori `missing_notification_current_flow` berjumlah nol. Mode `--execute` tetap fail-safe dan tidak membuat ulang notifikasi lama, karena pemberitahuan terlambat dapat membingungkan pengguna dan memerlukan keputusan operasional manual.

Pengujian tersebut memakai controller dengan request/response recorder dan database nyata. Pengujian black-box melalui server HTTP lengkap beserta seluruh middleware tetap dapat ditambahkan ketika proyek menyediakan HTTP test harness.

### 7.2.1 Baseline sebelum koreksi (arsip)

Bagian berikut mempertahankan catatan audit awal sebagai histori rancangan; seluruh butir prioritasnya telah ditutup oleh implementasi pada bagian 7.2.

#### Sumber anggota final Perintisan belum aman

#### 7.2.1 Sumber anggota final Perintisan belum aman

Final approval saat ini menghitung kebutuhan kuota dan daftar penerima penetapan dari snapshot `form_lanjutan_payload.kelompok.anggota` di [jalurController.js](../../server/controllers/jalurController.js:2946) dan [jalurController.js](../../server/controllers/jalurController.js:3051). Snapshot dapat stale jika data kelompok berubah setelah form dikirim.

Perbaikan wajib:

1. Muat ulang `KelompokPerintisanBisnis` berdasarkan kelompok sumber.
2. Kunci row kelompok dan seluruh `AnggotaKelompokPerintisan` dengan transaction lock.
3. Pastikan kelompok masih berada pada state yang boleh difinalisasi.
4. Pastikan seluruh anggota masih aktif pada kelompok yang sama.
5. Muat serta kunci pendaftaran setiap anggota.
6. Pastikan semua pendaftaran berada pada periode yang sama dengan kelompok dan menargetkan Perintisan Bisnis.
7. Hitung kebutuhan kuota dari jumlah anggota hasil query tersebut.
8. Jalankan penetapan seluruh anggota dari daftar otoritatif tersebut.
9. Rollback seluruh transaksi bila satu anggota gagal.

JSON tetap dipertahankan sebagai snapshot audit saat submit, tetapi tidak dipakai sebagai sumber kebenaran keputusan final.

#### 7.2.2 Belum ada integration test endpoint Tahap 2

[penetapanPembimbing.integration.test.js](../../server/tests/penetapanPembimbing.integration.test.js:31) sudah membuktikan service penetapan transaksional, idempotent untuk komposisi sama, dan rollback ketika pembuatan notifikasi gagal. Test tersebut belum memanggil endpoint final approval ketiga jalur beserta seluruh middleware, state transition, dan side effect-nya.

Kekurangan ini menjadi blocker terbesar sebelum Tahap 2 dapat dinyatakan selesai. Test endpoint minimum dijabarkan pada bagian 9.

#### 7.2.3 Finalisasi masih tersebar di dua controller

Penelitian difinalisasi di `sekretarisController`, sedangkan Magang dan Perintisan difinalisasi di `jalurController`. Walaupun saat ini fungsional, duplikasi orchestration membuat validasi, update status, idempotensi, notifikasi, dan error handling dapat menyimpang.

Controller harus menjadi adapter tipis dan mendelegasikan keputusan final kepada satu service `finalizePenjaluranDecision()` sebagaimana Paket 6.

#### 7.2.4 Retry final approval belum idempotent pada level API

Penelitian saat ini mengembalikan “tidak ditemukan atau sudah diproses” ketika request diulang di [sekretarisController.js](../../server/controllers/sekretarisController.js:3933). Non-Penelitian mengembalikan conflict ketika status sudah bukan `review_sekprodi` di [jalurController.js](../../server/controllers/jalurController.js:2889). Kondisi ini membuat keberhasilan yang response-nya terputus terlihat sebagai kegagalan bagi pengguna.

Kontrak yang dituju:

- request kedua dengan sumber, keputusan, topik bila relevan, P1, P2, dan aktor yang sama mengembalikan hasil final sebelumnya sebagai sukses;
- request kedua dengan keputusan atau komposisi pembimbing berbeda mengembalikan `409 IDEMPOTENCY_CONFLICT`;
- histori, pemakaian kuota, penetapan, cache, dan notifikasi tidak bertambah pada retry identik;
- response mengembalikan `replayed: true` agar client dan audit dapat membedakan hasil replay.

#### 7.2.5 Status workflow belum dinormalisasi penuh

Status mentah masih berbeda antarjalur dan frontend masih perlu memahami detail enum internal. Seluruh endpoint list, detail, aksi, dan status mahasiswa harus mengembalikan `workflow_stage` serta `raw_workflow_status` sesuai bagian 5.3.

### 7.3 Gap baseline sebelum koreksi (arsip)

Daftar berikut adalah temuan sebelum implementasi koreksi dan tidak lagi menjadi status source terkini.

1. Endpoint pendaftaran umum masih menerima `ulang`/`alih`; scope tersebut harus dipindahkan penuh ke flow authenticated Tahap 3.
2. Pendaftaran baru masih menerima dan menyimpan pilihan dosen pembimbing TA dari mahasiswa, padahal P1/P2 diputuskan Sekprodi saat final.
3. Endpoint pendaftaran publik masih dapat membuat akun mahasiswa, menggunakan NIM sebagai password, dan mengembalikan password awal. Ini tidak sesuai kontrak bahwa akun berasal dari master/import dan juga melampaui tanggung jawab penjaluran.
4. Belum terlihat constraint database unik `(mahasiswa_id, periode_penjaluran_id)`, sehingga pengecekan aplikasi saja masih rentan race condition.
5. Endpoint daftar dosen publik mencampur kebutuhan DPA dengan kandidat pembimbing final. Kandidat P1/P2 seharusnya hanya tersedia pada konteks keputusan Sekprodi.
6. Data pembimbing legacy masih disimpan pada kolom pendaftaran sebelum keputusan final, sehingga sumber kebenaran berpotensi ganda.
7. Finalisasi Penelitian masih memakai dosen pemenang/pemilik topik sebagai P1 dan hanya menerima pilihan P2, sementara aturan final menyebut Sekprodi menentukan P1 dan P2.
8. Validasi cluster/bidang pada finalisasi Penelitian belum terpusat untuk seluruh P1/P2.
9. Finalisasi Penelitian berisiko mengisi status jalur mahasiswa dari jenis pendaftaran (`baru`) alih-alih target akademik (`penelitian`).
10. Finalisasi non-Penelitian belum menyinkronkan seluruh state mahasiswa dengan kontrak yang sama seperti Penelitian.
11. Timeline non-Penelitian masih berada di JSON payload yang disalin ke beberapa pendaftaran anggota Perintisan, sehingga dapat mengalami drift.
12. Model kelompok hanya menjamin mahasiswa unik di dalam satu kelompok; belum ada constraint efektif yang mencegah satu mahasiswa berada pada dua kelompok aktif di periode yang sama.
13. Jumlah anggota, aturan dokumen, dan batas file masih tersebar sebagai hardcode.

## 8. Rencana pengerjaan

### Paket 0 — Baseline dan penguncian keputusan

1. Catat state machine aktual ketiga jalur dan petakan setiap enum mentah ke fase normalisasi.
2. Tandai cabang Penelitian yang bergantung pada decision gate agar tidak ikut diubah.
3. Inventarisasi semua endpoint yang dapat membuat pendaftaran, pengajuan, keputusan review, final approval, penetapan, dan notifikasi.
4. Buat characterization test untuk perilaku yang sudah sah sebelum refactor.
5. Bekukan penggunaan flow surat tugas sebagai aktivator dan tambahkan test bahwa keputusan final langsung menghasilkan penetapan aktif.

Hasil: refactor mempunyai baseline dan tidak mengubah keputusan Penelitian yang masih ditunda.

### Paket 1 — Finalisasi kontrak pendaftaran baru

1. Pisahkan endpoint pendaftaran baru dari ulang/alih secara tegas.
2. Wajibkan autentikasi mahasiswa yang sudah tersedia di master/import untuk pendaftaran baru.
3. Hilangkan pembuatan akun, penyimpanan password literal NIM, dan pengembalian password dari response pendaftaran.
4. Jika self-registration tetap diinginkan, hentikan implementasi paket ini sampai aturan bisnis diperbarui dan desain keamanan disetujui.
5. Server mengambil mahasiswa dari token dan master data; frontend tidak mengirim NIM/nama/email sebagai sumber identitas.
6. Server menentukan periode aktif dan memeriksa window tanggal di dalam transaksi.
7. Tolak target selain tiga jalur aktif.
8. Abaikan/tolak field pembimbing TA pada request pendaftaran baru.
9. Tambahkan unique constraint `(mahasiswa_id, periode_penjaluran_id)` dan tangani conflict sebagai response idempotent/409 yang jelas.
10. Pastikan tidak ada pengajuan aktif lain dan target form tersedia.
11. Bentuk response `next_action` dari jalur yang tersimpan di database.

Hasil: pendaftaran baru tidak dapat dipalsukan, tidak membuat akun, dan tidak menetapkan pembimbing.

### Paket 2 — Kontrak pengajuan dan histori bersama

1. Buat resolver tunggal `resolveRegistrationTrack` yang digunakan seluruh controller.
2. Buat guard bersama untuk memvalidasi kepemilikan mahasiswa, target jalur, periode, status pendaftaran, dan belum adanya form aktif lain.
3. Buat mapper terpusat yang menghasilkan `workflow_stage` dan `raw_workflow_status` tanpa harus langsung mengganti semua enum legacy.
4. Tambahkan histori workflow terstruktur yang minimal menyimpan:
   - objek dan ID objek;
   - jalur;
   - status sebelum dan sesudah;
   - aktor ID dan role;
   - keputusan/catatan;
   - waktu;
   - metadata relevan seperti slot topik atau kelompok.
5. Pertahankan payload JSON sebagai snapshot form, bukan sebagai satu-satunya audit trail.
6. Setiap transisi menggunakan helper yang memvalidasi allowed transition dan menghasilkan histori dalam transaksi yang sama.
7. Response list, detail, dan hasil aksi ketiga jalur mengembalikan struktur status dan timeline yang sama.
8. Tambahkan contract test untuk memastikan setiap raw status mempunyai tepat satu mapping, termasuk `completed` dan `cancelled`.

Hasil: frontend dan audit tidak perlu memahami variasi enum internal setiap jalur.

### Paket 3 — Stabilisasi Penelitian

1. Pastikan setiap pengajuan terhubung ke tepat satu pendaftaran Penelitian milik mahasiswa.
2. Tambahkan constraint/guard agar satu pendaftaran tidak mempunyai dua pengajuan Penelitian aktif.
3. Saat menerima pilihan topik:
   - hanya terima ID/kode dan prioritas;
   - baca judul, pemilik, cluster, dan status dari database;
   - kunci row topik sebelum reservasi;
   - tolak topik duplikat dalam satu pengajuan.
4. Simpan setiap review dosen dan Ketua Cluster sebagai histori yang tidak ditimpa.
5. Pertahankan urutan review aktual sampai decision gate diselesaikan.
6. Pastikan seluruh cabang terminal melepaskan topik yang tidak dipilih secara idempotent.
7. Pada detail final Sekprodi, tampilkan semua opsi topik/judul, prioritas, cluster, dan histori aktor.
8. Ubah kontrak final approval agar Sekprodi mengirim `pembimbing_1_id` dan opsional `pembimbing_2_id`.
9. Untuk topik dosen, tampilkan pemilik topik sebagai rekomendasi P1, tetapi jangan menjadikannya keputusan tersembunyi kecuali aturan bisnis diperbarui.
10. Validasi kedua pembimbing terhadap cluster/bidang, status master, ketersediaan periode, kuota, dan perbedaan P1/P2.
11. Finalisasi topik, pengajuan, status mahasiswa, penetapan, pelepasan topik lain, histori, dan notifikasi dilakukan dalam satu transaksi.

Hasil: Penelitian tetap mengikuti flow review berjalan tetapi keputusan final dan integritas topiknya sesuai aturan.

### Paket 4 — Stabilisasi Magang

1. Ubah pilihan mitra menjadi referensi ID master dan verifikasi `is_active` ketika submit.
2. Simpan snapshot mitra pada record/payload pengajuan untuk histori.
3. Definisikan schema payload Magang dan validasi backend untuk setiap field.
4. Pusatkan matriks dokumen berdasarkan jenis perusahaan:
   - wajib/opsional;
   - MIME/extensi;
   - ukuran maksimum;
   - jumlah file;
   - label dan deskripsi UI.
5. Gunakan middleware dan service validator dari konfigurasi yang sama.
6. Stage upload sebelum commit, promosikan setelah validasi, dan bersihkan semua file ketika rollback.
7. Pastikan Pengawas Magang berasal dari penugasan periode pendaftaran, bukan periode terbaru saat review.
8. Approval Pengawas hanya memindahkan ke `review_sekprodi` serta membuat histori/notifikasi.
9. Final Sekprodi memilih P1 dan opsional P2; Pengawas tidak menjadi default otomatis.
10. Finalisasi menyinkronkan status form, status mahasiswa, penetapan, histori, dan notifikasi dalam satu transaksi.

Hasil: data Magang historis stabil dan tidak bergantung pada validasi frontend atau nama mitra bebas.

### Paket 5 — Stabilisasi Perintisan Bisnis

1. Pindahkan aturan jumlah anggota dan komposisi peran ke konstanta/config domain bersama.
2. Validasi setiap mahasiswa berdasarkan pendaftaran pada periode yang sama dan target Perintisan.
3. Tambahkan proteksi database/service agar satu mahasiswa tidak berada pada lebih dari satu kelompok aktif pada periode yang sama.
4. Pastikan tepat satu ketua dan hanya akun ketua yang dapat mengirim form.
5. Jadikan kelompok/form kelompok sebagai aggregate root; anggota tidak menyimpan salinan payload workflow yang dapat menyimpang.
6. Simpan perubahan komposisi sebelum submit sebagai histori; kunci komposisi setelah submit.
7. Approval Pengampu berlaku sekali untuk kelompok dan memindahkan kelompok ke antrean Sekprodi.
8. Final approval tidak membaca daftar anggota atau jumlah kuota dari snapshot JSON.
9. Ambil ulang serta kunci `KelompokPerintisanBisnis` dan seluruh `AnggotaKelompokPerintisan` dari database.
10. Ambil ulang serta kunci pendaftaran setiap anggota; validasi kelompok, periode, jalur, dan statusnya sebagai satu aggregate.
11. Gunakan hasil query terkunci tersebut sebagai daftar otoritatif mahasiswa dan pendaftaran.
12. Kunci kandidat P1/P2 untuk serialisasi perhitungan kuota.
13. Hitung kebutuhan slot masing-masing dosen sebesar jumlah anggota otoritatif.
14. Buat penetapan dengan komposisi sama bagi seluruh anggota.
15. Update seluruh anggota, status kelompok, histori, cache P1, dan notifikasi di transaksi yang sama.
16. Gunakan idempotency key berbasis kelompok + keputusan final; request ulang mengembalikan hasil final yang sama.

Hasil: tidak ada partial approval atau partial assignment pada kelompok.

### Paket 6 — Service finalisasi bersama

Buat orchestration service, misalnya `finalizePenjaluranDecision`, dengan input eksplisit:

```text
source_type, source_id, registration/group,
periode_id, jalur, pembimbing_1_id, pembimbing_2_id,
sekretaris_id, decision_note, idempotency_key
```

Struktur tanggung jawab yang dituju:

```text
controller Penelitian ─┐
controller Magang ─────┼─→ adapter sumber jalur
controller Perintisan ─┘          │
                                  ▼
                    finalizePenjaluranDecision()
                    ├── kunci sumber dan pendaftaran
                    ├── validasi workflow dan otorisasi
                    ├── resolve anggota otoritatif
                    ├── validasi P1/P2 dan kuota
                    ├── jalankan perubahan khusus jalur
                    ├── aktifkan penetapan
                    ├── sinkronkan status dan cache
                    ├── tulis histori dan notifikasi
                    └── simpan hasil idempotensi
```

Service melakukan:

1. membuka/menggunakan transaksi;
2. mengunci sumber pengajuan atau kelompok;
3. memverifikasi scope program kuliah Sekprodi;
4. memverifikasi status `review_sekprodi` dan seluruh review wajib;
5. menyelesaikan daftar mahasiswa dan pendaftaran dari database, tidak dari snapshot form;
6. menolak penetapan aktif yang tidak sesuai lifecycle;
7. mengunci P1/P2 lalu memvalidasi status, ketersediaan, cluster/bidang, dan kuota total;
8. membuat serta mengaktifkan penetapan semester pertama;
9. menyinkronkan cache P1;
10. memperbarui status pengajuan/form, kelompok, pendaftaran bila diperlukan, dan status jalur mahasiswa;
11. menulis histori keputusan;
12. membuat pemberitahuan dengan deduplication key;
13. membentuk fingerprint keputusan dari sumber, keputusan, topik bila relevan, P1, P2, dan scope aktor;
14. menyimpan fingerprint/idempotency key bersama hasil final yang dapat dibaca ulang;
15. mengembalikan hasil lama dengan `replayed: true` bila keputusan identik sudah berhasil;
16. melempar `409 IDEMPOTENCY_CONFLICT` bila request ulang membawa keputusan atau komposisi berbeda;
17. rollback seluruh perubahan ketika satu langkah gagal.

Adapter per jalur hanya bertanggung jawab menyiapkan konteks dan aksi spesifik, seperti penetapan topik `taken` atau penyelesaian aggregate kelompok.

Hasil: tiga jalur mempunyai semantik final approval, error, audit, dan idempotensi yang sama.

### Paket 7 — API dan otorisasi

1. Pisahkan endpoint berdasarkan aktor:
   - mahasiswa: membuat/melihat pendaftaran dan form miliknya;
   - penanggung jawab: melihat/memutus antrean periode tugasnya;
   - Sekprodi: melihat/memutus final sesuai program kuliah;
   - Admin: tidak membuat keputusan akademik final.
2. Jangan menyediakan kandidat P1/P2 melalui endpoint publik.
3. Endpoint kandidat Sekprodi melakukan query terbaru dan mengembalikan eligibility serta kapasitas.
4. Semua detail dan download dokumen memverifikasi object-level authorization.
5. Gunakan error code konsisten untuk periode tertutup, duplicate registration, stale state, quota conflict, unavailable lecturer, invalid transition, dan idempotency conflict.
6. Re-fetch dan revalidate tetap dilakukan walaupun UI sudah menyaring opsi.

Hasil: aktor hanya dapat melihat dan melakukan aksi sesuai perannya.

### Paket 8 — Frontend dan pengalaman status

#### Mahasiswa

1. Tampilkan hanya tiga jalur aktif.
2. Jangan tampilkan pemilihan P1/P2 pada pendaftaran baru.
3. Setelah pendaftaran, kunci menu pengajuan jalur lain sampai proses aktif selesai.
4. Gunakan stepper konsisten:
   - Pendaftaran;
   - Form terkirim;
   - Review penanggung jawab;
   - Keputusan final Sekprodi;
   - Pembimbing aktif.
5. Tampilkan alasan penolakan dan next action dari API.
6. Untuk Perintisan, anggota melihat status kelompok readonly dan ketua mempunyai aksi edit/submit.

#### Penanggung jawab jalur

1. Antrean hanya berisi pengajuan pada periode penugasannya.
2. Detail menampilkan form, dokumen, histori, dan aksi approve/reject.
3. Aksi ganda disabled saat request berjalan dan aman jika dikirim ulang.

#### Sekprodi

1. Sediakan antrean final terpisah/filter per jalur dengan komponen keputusan konsisten.
2. Detail menampilkan seluruh review sebelumnya sebelum tombol keputusan.
3. P1 wajib dan P2 opsional; kandidat diambil ulang saat modal dibuka dan saat window kembali fokus.
4. Tampilkan alasan dosen tidak eligible tanpa membocorkan data sensitif.
5. Untuk Perintisan, tampilkan jumlah slot yang akan digunakan pada P1 dan P2.
6. Setelah berhasil, hapus item dari antrean, refresh kapasitas, dan tampilkan tautan penetapan aktif.

Hasil: UI mengikuti response state machine dan tidak membuat keputusan bisnis sendiri.

### Paket 9 — Migrasi dan rekonsiliasi data

1. Tambahkan unique constraint mahasiswa-periode setelah membersihkan duplikat.
2. Tambahkan constraint/index pengajuan-per-pendaftaran sesuai model final.
3. Tambahkan proteksi keanggotaan kelompok aktif sesuai desain aggregate.
4. Bila histori workflow baru dibuat, backfill event minimum dari timestamp/status lama tanpa mengarang aktor yang tidak diketahui.
5. Rekonsiliasi:
   - pendaftaran baru yang sudah mempunyai pembimbing sebelum final Sekprodi;
   - pengajuan tanpa pendaftaran;
   - form yang jalurnya berbeda dari pendaftaran;
   - topik reserved tanpa pengajuan aktif;
   - topik taken oleh lebih dari satu pengajuan;
   - kelompok tanpa ketua, anggota ganda, atau lintas periode;
   - anggota kelompok dengan payload/status berbeda;
   - final approved tanpa penetapan aktif;
   - penetapan aktif tetapi form belum final approved;
   - cache P1 tidak cocok dengan penetapan;
   - status jalur mahasiswa berisi jenis pendaftaran, bukan jalur akademik.
6. Sediakan mode dry-run dan execute; dry-run menampilkan jumlah, ID, alasan, serta aksi yang akan dilakukan.
7. Jangan menghapus data historis sah. State ambigu dipindahkan ke laporan manual review bila tidak dapat ditentukan secara aman.

Hasil: constraint baru dapat dipasang tanpa menyembunyikan konflik data lama.

### Paket 10 — Pemberitahuan minimum

Tahap 14 akan menyempurnakan pengalaman menu universal. Tahap 2 tetap wajib membuat event/pemberitahuan minimum untuk:

- form berhasil dikirim;
- pengajuan diteruskan kepada penanggung jawab;
- keputusan approve/reject penanggung jawab;
- pengajuan masuk antrean Sekprodi;
- keputusan final;
- penetapan P1/P2 aktif.

Setiap pemberitahuan mempunyai jenis, penerima, ringkasan, referensi objek, waktu, dan deduplication key. Pembuatan notifikasi berada dalam transaksi finalisasi atau memakai transactional outbox jika pengiriman eksternal ditambahkan kemudian.

Hasil: retry tidak menggandakan notifikasi dan kegagalan notifikasi utama tidak menghasilkan finalisasi setengah jadi.

## 9. Strategi pengujian

### 9.1 Unit test

Uji minimal:

- resolver target jalur dari pendaftaran;
- pemetaan raw status ke fase normalisasi;
- allowed transition setiap jalur;
- eligibility pendaftaran baru;
- normalisasi dan validasi payload Magang;
- matriks dokumen Magang;
- aturan jumlah/peran anggota Perintisan;
- perhitungan kebutuhan kuota kelompok;
- komposisi P1/P2;
- reservasi dan pelepasan topik;
- idempotency decision resolver.

### 9.2 Integration/API test bersama

1. Mahasiswa hanya dapat mendaftar sekali pada periode yang sama, termasuk dua request paralel.
2. Pendaftaran menolak jalur hold.
3. Request pendaftaran yang membawa P1/P2 ditolak atau field diabaikan secara aman.
4. Form dengan jalur berbeda dari pendaftaran ditolak.
5. Approval penanggung jawab tidak membuat penetapan/cache P1.
6. Final Sekprodi membuat satu penetapan aktif dan membuka akses bimbingan.
7. Dosen nonaktif, tidak tersedia, salah cluster, atau kuota penuh ditolak pada finalisasi.
8. Perubahan status/ketersediaan setelah modal dibuka menghasilkan stale conflict dan tidak membuat data parsial.
9. P1 dan P2 yang sama ditolak sesuai BR-PENETAPAN-002.
10. Notifikasi mahasiswa, P1, dan P2 dibuat dengan referensi keputusan/penetapan yang benar.
11. Pemanggilan final approval kedua dengan payload identik berhasil dengan `replayed: true` tanpa menggandakan histori, pemakaian kuota, penetapan, cache, atau notifikasi.
12. Pemanggilan kedua dengan keputusan atau P1/P2 berbeda menghasilkan `409 IDEMPOTENCY_CONFLICT`.
13. Kegagalan notifikasi atau update terakhir menyebabkan rollback lengkap.
14. Sekprodi program lain tidak dapat melihat atau memutus pengajuan.
15. Response list, detail, dan aksi selalu mempunyai `workflow_stage` serta `raw_workflow_status` yang benar.

### 9.3 Integration test Penelitian

1. Pengajuan tanpa pendaftaran Penelitian ditolak.
2. Data judul/pemilik topik yang dimanipulasi frontend diabaikan/ditolak.
3. Dua mahasiswa tidak dapat mereservasi topik yang sama secara bersamaan.
4. Seluruh review tersimpan dengan aktor dan waktu.
5. Hanya topik yang memenuhi review dapat dipilih final.
6. Topik terpilih menjadi `taken`; topik lain dilepas.
7. Endpoint final approve menetapkan topik final, P1, P2, dan satu riwayat penetapan aktif.
8. Sekprodi dapat memilih P1 dan P2 eligible sesuai kontrak final.
9. Status mahasiswa menjadi `penelitian`, bukan `baru`.
10. Reject/cancel terminal tidak meninggalkan topik reserved.
11. Dosen nonaktif, tidak tersedia, atau kuotanya tidak cukup ditolak tanpa perubahan parsial.
12. Test perilaku review berjalan diberi label characterization sampai decision gate diputuskan.

### 9.4 Integration test Magang

1. Mitra nonaktif ditolak saat submit baru.
2. Snapshot mitra tetap sama setelah master berubah.
3. Perusahaan nonmitra tervalidasi tanpa membuat master mitra.
4. Dokumen wajib, MIME, ukuran, dan akses download diuji di backend.
5. File dibersihkan jika transaksi gagal.
6. Hanya Pengawas Magang pada periode terkait dapat mereview.
7. Endpoint diuji end-to-end dari approval Pengawas Magang, perpindahan ke `waiting_final_decision`, sampai final Sekprodi.
8. Pengawas tidak otomatis menjadi pembimbing.
9. Final approval membuat P1/P2 aktif dan menyinkronkan form, mahasiswa, riwayat penetapan, serta notifikasi.

### 9.5 Integration test Perintisan

1. Ketua/anggota berbeda, berada pada periode sama, dan mempunyai target Perintisan.
2. Satu mahasiswa tidak dapat masuk dua kelompok aktif.
3. Hanya ketua dapat submit.
4. Komposisi Hustler/Hipster/Hacker tervalidasi.
5. Approval Pengampu berlaku ke seluruh kelompok tanpa membuat pembimbing.
6. Final approval mengabaikan daftar anggota yang stale/manipulatif pada JSON dan membaca anggota dari tabel kelompok.
7. Perubahan data kelompok di antara submit dan final terdeteksi melalui query serta lock; state yang tidak valid ditolak.
8. P1/P2 membutuhkan slot sebesar jumlah anggota hasil query database.
9. Tiga anggota menghasilkan tepat tiga penetapan aktif dan tiga histori yang terhubung ke pendaftaran masing-masing.
10. Seluruh anggota memperoleh komposisi P1/P2 yang sama.
11. Kegagalan pada anggota pertama, tengah, atau terakhir me-rollback semua penetapan, cache, status, histori, dan notifikasi.
12. Request ulang tidak membuat kelompok, penetapan, histori, pemakaian kuota, atau notifikasi ganda.

### 9.6 Frontend/component test

1. Hanya jalur aktif yang tampil.
2. Form pendaftaran baru tidak menampilkan pilihan P1/P2.
3. Stepper memetakan seluruh raw status dengan benar.
4. Kandidat Sekprodi di-refresh ketika modal dibuka/fokus kembali.
5. Tombol keputusan mencegah klik ganda.
6. Error stale state, kuota, dan ketersediaan mempunyai pesan serta next action.
7. Anggota Perintisan hanya mempunyai tampilan readonly.
8. Timeline tiga jalur memakai format yang konsisten.

### 9.7 UAT end-to-end

Lakukan minimal tiga sesi UAT terpisah:

1. Penelitian: mahasiswa → calon dosen/Ketua Cluster → Sekprodi → pembimbing aktif.
2. Magang: mahasiswa → Pengawas Magang → Sekprodi → pembimbing aktif.
3. Perintisan: ketua dan anggota → Pengampu Perintisan → Sekprodi → seluruh pembimbing aktif.

Pada setiap sesi, verifikasi status mahasiswa, histori aktor/waktu, cache P1, akses bimbingan, kapasitas dosen, notifikasi, dan tidak adanya dependensi surat tugas.

## 10. Urutan implementasi dan dependensi

| Urutan | Paket | Dependensi | Risiko |
| --- | --- | --- | --- |
| 1 | Baseline dan decision gate | Tahap 1 stabil | Tinggi |
| 2 | Kontrak pendaftaran dan constraint | Paket 0 | Tinggi |
| 3 | Kontrak pengajuan/histori bersama | Paket 1 | Tinggi |
| 4 | Service finalisasi bersama | Paket 2 dan kontrak penetapan Tahap 1 | Tinggi |
| 5 | Penelitian | Paket 2–4 | Tinggi karena decision gate dan reservasi |
| 6 | Magang | Paket 2–4 | Sedang-tinggi karena file |
| 7 | Perintisan Bisnis | Paket 2–4 | Tinggi karena aggregate dan kuota kelompok |
| 8 | API, otorisasi, dan frontend | Paket 2–7 | Sedang-tinggi |
| 9 | Migrasi/rekonsiliasi | Model final paket 1–7 | Tinggi sebelum deployment |
| 10 | Test, UAT, dan dokumentasi | Semua paket | Tinggi sebelum release |

Penelitian, Magang, dan Perintisan dapat dikerjakan paralel setelah kontrak pendaftaran, histori, dan finalization service disepakati. Perubahan schema bersama tidak boleh dikerjakan paralel tanpa satu pemilik kontrak.

## 11. Strategi deployment

1. Jalankan characterization test dan backup database.
2. Deploy schema/history yang bersifat additive.
3. Jalankan rekonsiliasi dry-run dan selesaikan konflik manual.
4. Pasang constraint unik setelah data bersih.
5. Deploy service normalisasi dan finalisasi di belakang feature flag bila diperlukan.
6. Migrasikan jalur satu per satu: Magang, Perintisan, lalu Penelitian, atau sesuai hasil risiko pengujian.
7. Jalankan smoke test final approval pada data uji untuk setiap jalur.
8. Pantau conflict, rollback, duplicate key, orphan reservation, dan final approved tanpa assignment.
9. Hapus jalur kode legacy hanya setelah satu release stabil dan tidak ada pembaca lama.

Rollback aplikasi tidak boleh membatalkan atau menghapus penetapan sah yang sudah aktif. Migration down hanya digunakan jika aman terhadap data yang sudah dibuat.

## 12. Definition of Done Tahap 2

Tahap dinyatakan selesai apabila:

- mahasiswa dari master dapat membuat satu pendaftaran baru pada periode aktif untuk salah satu dari tiga jalur aktif;
- Pengabdian tidak tersedia sebagai pilihan baru selama hold;
- pendaftaran tidak membuat akun, tidak mengembalikan password, dan tidak menerima keputusan P1/P2 dari mahasiswa;
- pendaftaran, pengajuan, dan penetapan mempunyai lifecycle terpisah serta status normalisasi konsisten;
- Penelitian topik dosen dan judul mandiri mencapai antrean final tanpa mengubah decision gate yang belum disahkan;
- Magang menyimpan referensi dan snapshot mitra serta memvalidasi dokumen di backend;
- Perintisan diproses sebagai satu kelompok dengan satu form dan satu keputusan review;
- finalisasi Perintisan membaca kelompok, anggota, dan pendaftaran dari tabel yang dikunci, bukan dari snapshot JSON;
- approval penanggung jawab jalur tidak mengaktifkan pembimbing;
- Sekprodi dapat melihat seluruh histori review dan menetapkan P1 serta opsional P2;
- status, ketersediaan, cluster/bidang, dan kuota P1/P2 divalidasi ulang dalam transaksi final;
- keputusan final langsung menghasilkan penetapan aktif tanpa surat tugas;
- finalisasi Perintisan menghasilkan komposisi P1/P2 yang sama untuk seluruh anggota atau rollback seluruhnya;
- status jalur mahasiswa, cache P1, form, kelompok, histori, dan notifikasi konsisten setelah finalisasi;
- satu mahasiswa tidak mempunyai pendaftaran ganda pada periode yang sama atau lebih dari satu penetapan aktif;
- klik ganda dan request ulang tidak menghasilkan record atau pemberitahuan ganda;
- retry keputusan identik mengembalikan hasil sebelumnya sebagai sukses, sedangkan retry dengan keputusan berbeda menghasilkan `409 IDEMPOTENCY_CONFLICT`;
- seluruh endpoint workflow mengembalikan `workflow_stage` dan `raw_workflow_status`;
- tidak ada topik reserved yatim, kelompok parsial, final approved tanpa penetapan, atau cache P1 yang berbeda dari penetapan;
- integration test endpoint membuktikan final approval Penelitian, Magang, dan Perintisan beserta penolakan eligibility, notifikasi, idempotensi, dan rollback kelompok;
- seluruh unit test, integration test, frontend test, build, rekonsiliasi dry-run, dan UAT tiga jalur lulus;
- aturan bisnis, BPMN, backend, frontend, test, dan dokumentasi menyatakan workflow yang sama.

## 13. Keputusan yang perlu dikunci sebelum perubahan terkait

| Keputusan | Status saat ini | Sikap Tahap 2 |
| --- | --- | --- |
| Review topik berurutan atau paralel | Ditunda | Pertahankan perilaku berjalan |
| Detail urutan review judul mandiri | Sementara | Pertahankan, jangan perluas asumsi |
| P2 wajib atau opsional | Belum final per jalur | Perlakukan opsional |
| Jumlah anggota Perintisan jika berubah | Menunggu aturan akademik | Gunakan baseline form saat ini dari satu config |
| Self-registration versus akun dari import | Aturan menyatakan akun tersedia setelah import | Gunakan akun master; ubah aturan dahulu jika self-registration dipertahankan |

Setiap keputusan baru harus memperbarui `aturan-bisnis-simps.md`, BPMN, kontrak API, implementasi, dan test dalam perubahan yang sama.
