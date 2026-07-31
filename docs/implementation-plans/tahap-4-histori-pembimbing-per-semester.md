# Rancangan Pengerjaan Tahap 4 — Histori Pembimbing per Semester

## 1. Tujuan

Menjadikan penetapan pembimbing sebagai sumber kebenaran untuk menjawab siapa P1/P2 mahasiswa pada setiap semester akademik, pada siklus dan jalur apa penetapan tersebut berlaku, kapan masa tugas dimulai dan berakhir, serta kejadian apa yang menyebabkan perubahan atau pengakhiran.

Tahap ini harus menghasilkan lifecycle semester yang utuh:

- keputusan final penjaluran membuat penetapan semester ke-1;
- mahasiswa yang belum selesai dapat dibawa dari semester ke-1 ke semester ke-2 dengan record baru, walaupun P1/P2 tetap sama;
- semester ke-3 hanya dibuat setelah izin lanjut disetujui;
- pergantian P1/P2 dalam semester yang sama tidak menaikkan nomor semester dan tidak mereset progres;
- ulang/alih kembali membuat siklus baru dengan semester ke-1;
- histori, aktivitas bimbingan, alasan berakhir, dan status akhir semester dapat ditelusuri tanpa bergantung pada cache mahasiswa.

## 2. Acuan aturan bisnis

Rancangan mengacu pada:

- BR-DOSEN-001 sampai BR-DOSEN-004;
- BR-PERIODE-001 dan BR-PERIODE-002;
- BR-DAFTAR-003 dan BR-DAFTAR-004;
- BR-PENETAPAN-001 sampai BR-PENETAPAN-004;
- BR-SEMESTER-001 sampai BR-SEMESTER-003;
- BR-BIMBINGAN-002;
- BR-NOTIF-001 dan BR-NOTIF-002;
- BR-AUDIT-001 sampai BR-AUDIT-004.

Aturan inti yang harus dipertahankan:

- satu mahasiswa maksimal mempunyai satu penetapan aktif;
- satu penetapan wajib mempunyai P1, sedangkan P2 opsional dan harus berbeda;
- setiap anggota mempunyai status dan masa aktif yang konsisten dengan induk;
- perpindahan semester selalu membuat record penetapan baru;
- semester normal hanya semester ke-1 dan ke-2;
- semester ke-3 memerlukan izin lanjut approved;
- pergantian pembimbing pada siklus yang sama mempertahankan progres;
- ulang/alih membuat siklus dan hitungan semester baru;
- `dosen_pembimbing_skripsi_id` hanya cache P1 aktif;
- dasar penetapan adalah keputusan final Sekprodi, bukan surat tugas;
- alasan pengakhiran yang diketahui sistem tidak boleh bergantung pada teks bebas.

## 3. Batas tahap

### 3.1 Termasuk Tahap 4

- model histori pembimbing per siklus, periode akademik, dan semester penjaluran;
- finalisasi penetapan semester ke-1 hanya melalui finalizer keputusan Sekprodi Tahap 2, termasuk ketika finalizer memproses pendaftaran ulang/alih yang root-nya dibuat Tahap 3;
- preview serta konfirmasi carry-forward semester ke-1 menuju semester ke-2;
- izin lanjut dan aktivasi semester ke-3;
- rejection izin lanjut dan pengakhiran penetapan lama;
- pergantian P1/P2 tanpa menaikkan nomor semester;
- pengakhiran karena pamit, ulang/alih, selesai, pembatalan, dan akhir masa penetapan;
- relasi progres bimbingan dengan siklus sebagaimana ditetapkan Tahap 3;
- monitoring, timeline, audit, notifikasi, rekonsiliasi, dan endpoint integration test.

### 3.2 Kriteria masuk sebelum migration Tahap 4

Paket migration Tahap 4 belum boleh dimulai sebelum fondasi Tahap 2–3 berikut selesai dan diverifikasi:

1. retry final approval Tahap 3 idempotent pada level API;
2. tidak ada bypass workflow setelah pamit approved;
3. replay pendaftaran berhasil tanpa mewajibkan ulang `pamit_id` yang sudah dikonsumsi;
4. BR-PAMIT-004 tentang masa berlaku/konsumsi pamit sudah tercatat resmi;
5. seluruh migration Tahap 3 yang menjadi dependensi sudah masuk version control dan berstatus `up` pada environment verifikasi;
6. predicate rekonsiliasi Tahap 2 sudah dikoreksi;
7. dry-run Tahap 2 diulang dan setiap temuan diklasifikasikan sebagai defect, legacy valid, atau manual review;
8. dry-run Tahap 1, histori pembimbing, dan Tahap 3 tetap bersih setelah koreksi;
9. backend test dan frontend production build dijalankan ulang pada commit yang akan menjadi baseline Tahap 4.

Hasil verifikasi yang dicantumkan dalam catatan koreksi—45 test backend lulus, frontend build berhasil, migration `up`, serta dry-run Tahap 1/histori/Tahap 3 bersih—dipakai sebagai baseline sementara, bukan bukti final. Seluruhnya wajib diulang setelah empat temuan dry-run Tahap 2 diselesaikan.

### 3.3 Tidak termasuk Tahap 4

- perubahan workflow keputusan final tiga jalur selain adapter assignment;
- implementasi ulang/alih selain konsumsi hasil Tahap 3;
- penentuan batas maksimal atau mekanisme semester ke-4 dan seterusnya;
- perubahan persyaratan sidang, penilaian, revisi, dan kelulusan;
- aktivasi assignment berdasarkan penerbitan surat tugas;
- penghapusan histori assignment atau bimbingan lama;
- pemberian keputusan izin lanjut kepada aktor baru yang belum ditetapkan aturan bisnis.

Karena aturan bisnis menyatakan batas izin setelah semester ke-3 masih terbuka, Tahap 4 hanya mengaktifkan semester ke-3. Attempt membuat semester ke-4 atau lebih harus diblokir dengan reason code yang eksplisit sampai aturan baru disahkan.

## 4. Kontrak domain

### 4.1 Pendaftaran sebagai root siklus

Satu `PendaftaranPenjaluran` approved menjadi root satu siklus. Nomor semester dihitung di dalam pendaftaran tersebut, bukan dari seluruh histori pendaftaran mahasiswa.

| Kejadian | Pendaftaran | Semester | Progres |
| --- | --- | --- | --- |
| Final penjaluran baru | Pendaftaran baru | 1 | Siklus baru |
| Carry-forward normal | Tetap | 1 → 2 | Tetap |
| Izin lanjut approved | Tetap | 2 → 3 | Tetap |
| Pergantian P1/P2 | Tetap | Tidak berubah | Tetap |
| Ulang/alih | Pendaftaran baru | Kembali 1 | Siklus baru |

`semester_mahasiswa`, selisih terhadap pendaftaran pertama, jumlah seluruh pendaftaran approved, dan `status_jalur_saat_ini` tidak boleh menjadi sumber nomor semester penjaluran.

### 4.2 Identitas semester akademik

`PeriodePenjaluran` adalah jendela pendaftaran, bukan masa semester penuh, tetapi metadata `tahun_akademik` dan `semester` tetap menjadi identitas semester akademik. Untuk Tahap 4:

- satu record assignment mewakili tepat satu semester akademik pada satu siklus;
- `periode_mulai_id` menunjuk periode yang metadata tahun/semesternya merepresentasikan semester assignment;
- carry-forward tidak bergantung pada `is_active` atau tanggal buka/tutup pendaftaran;
- periode tujuan ditentukan dari urutan tahun akademik dan `ganjil → genap → ganjil` berikutnya;
- jika record periode tujuan belum tersedia atau ambigu, carry-forward diblokir sampai Sekprodi memperbaiki konfigurasi;
- tanggal penutupan pendaftaran tidak otomatis menjadi `tanggal_selesai` assignment.

Urutan periode tidak boleh hanya memakai `createdAt`. Gunakan nilai tahun akademik, urutan semester, `tanggal_mulai`, lalu ID sebagai tie-breaker deterministik.

### 4.3 Jenis perubahan assignment

| Operasi | `sumber_data` | Semester baru? | Komposisi boleh berubah? | Progres direset? |
| --- | --- | --- | --- | --- |
| Final penjaluran | `penjaluran` | Ya, semester 1 | Ya, dari keputusan Sekprodi | Ya, hanya karena siklus baru |
| Carry-forward | `perpanjangan` | Ya, +1 | Secara default tidak | Tidak |
| Izin semester 3 | `perpanjangan` | Ya, 3 | Secara default tidak | Tidak |
| Pergantian | `pergantian` | Tidak | Ya | Tidak |
| Backfill | `legacy_backfill` | Mengikuti bukti | Mengikuti bukti | Tidak mengubah data |

Jika pada saat carry-forward salah satu dosen tidak boleh melanjutkan bimbingan lama, carry-forward tidak boleh sekaligus menyamarkan pergantian. Selesaikan tindak lanjut dosen/pergantian terlebih dahulu atau lakukan operasi terorkestrasi yang tetap menghasilkan audit `pergantian` terpisah.

### 4.4 Invariant global

1. Maksimum satu assignment `active` per mahasiswa dijamin partial unique index; assignment `scheduled` tidak memberi hak akses aktif.
2. Maksimum satu assignment representatif per pendaftaran dan semester akademik, kecuali terdapat beberapa record akibat pergantian pada semester yang sama.
3. Tepat satu record terakhir dalam semester dapat aktif; record sebelumnya dalam semester yang sama berakhir karena pergantian.
4. Setiap assignment nonlegacy wajib mempunyai mahasiswa, pendaftaran, periode, nomor semester, P1, tanggal mulai, sumber data, dan dasar keputusan.
5. Pendaftaran assignment wajib milik mahasiswa yang sama dan berstatus approved.
6. Jalur assignment selalu di-resolve dari pendaftaran, bukan disalin dari frontend.
7. Semester pertama setiap pendaftaran selalu `1`.
8. Carry-forward hanya boleh menaikkan semester tepat satu tingkat pada pendaftaran yang sama.
9. Semester ke-2 tidak memerlukan izin lanjut.
10. Semester ke-3 wajib menunjuk izin lanjut approved untuk mahasiswa, pendaftaran, dan periode tujuan yang sama.
11. Semester ke-4 atau lebih ditolak sampai aturan bisnis ditambahkan.
12. Pergantian mempertahankan pendaftaran, periode akademik, dan nomor semester assignment aktif.
13. Carry-forward dengan komposisi sama tetap membuat record baru.
14. Cache P1 mahasiswa harus sama dengan anggota urutan 1 assignment aktif atau null bila tidak ada assignment aktif.
15. Status dan tanggal anggota harus konsisten dengan induk.
16. `tanggal_selesai` tidak boleh lebih awal dari `tanggal_mulai`.
17. Assignment ended/cancelled tidak dapat diaktifkan kembali; buat record baru melalui flow resmi.
18. Retry identik tidak membuat assignment, audit, atau notifikasi ganda.
19. Dua carry-forward paralel menghasilkan satu record baru atau satu conflict deterministik.
20. Histori lama tidak diedit untuk menyesuaikan keadaan baru, kecuali rekonsiliasi dengan bukti dan audit migration.
21. Maksimum satu assignment `scheduled` per mahasiswa dan periode tujuan untuk intent semester yang sama.
22. Carry-forward yang disiapkan sebelum tanggal efektif tidak boleh mengakhiri assignment lama lebih awal.
23. Aktivasi scheduled, pengakhiran assignment lama, sinkronisasi anggota/cache, audit, dan notifikasi dilakukan atomik pada tanggal efektif.
24. Lookup assignment aktif memeriksa `status = active`, `effective_at <= now`, dan tanggal selesai; record scheduled tidak pernah dianggap aktif hanya karena sudah dibuat.

## 5. State machine

### 5.1 Status assignment

| Dari | Aksi | Menjadi | Catatan |
| --- | --- | --- | --- |
| Tidak ada | Buat draft | `draft` | Belum memberi hak akses aktif |
| `draft` | Jadwalkan untuk masa depan | `scheduled` | Belum memberi hak akses dan belum mengakhiri assignment lama |
| `draft` | Aktivasi efektif hari ini | `active` | Mengakhiri assignment aktif lama secara atomik bila operasi sah |
| `scheduled` | Waktu efektif tercapai | `active` | Diproses worker terjadwal dengan lock dan idempotensi |
| `draft`/`scheduled` | Batalkan keputusan | `cancelled` | Tidak pernah menjadi sumber akses |
| `active` | Carry-forward | `ended` | Record baru semester berikutnya menjadi active |
| `active` | Pergantian | `ended` | Record baru pada semester yang sama menjadi active |
| `active` | Pamit/selesai/izin ditolak/dibatalkan | `ended` | Tidak selalu mempunyai pengganti langsung |
| `ended`/`cancelled` | Aksi aktivasi | Ditolak | Terminal |

Worker aktivasi scheduled berjalan berkala dan memproses `effective_at <= now`. Untuk setiap record, worker mengunci mahasiswa, assignment sumber, dan scheduled assignment; memvalidasi ulang eligibility; lalu mengakhiri assignment lama dan mengaktifkan assignment baru dalam satu transaksi. Kegagalan tidak boleh meninggalkan dua assignment aktif atau tanpa assignment aktif. Scheduled yang gagal masuk status operasional `activation_failed` pada tabel job/audit—bukan enum assignment—agar dapat di-retry setelah masalah diperbaiki.

### 5.2 Kode alasan berakhir

Gunakan enum/kode stabil untuk mesin dan label terjemahan untuk UI:

- `semester_carried_forward`;
- `supervisor_replaced`;
- `pamit_approved`;
- `assignment_term_expired`;
- `extension_rejected`;
- `student_completed`;
- `workflow_cancelled`;
- `legacy_reconciled`.

Simpan `end_reason_code` sebagai sumber kebenaran. `alasan_berakhir` dapat dipertahankan sebagai snapshot label/penjelasan kompatibilitas, tetapi controller tidak menyusun teks bebas untuk kejadian yang sudah mempunyai kode.

### 5.3 Transisi assignment dan status akhir semester

`assignment_transition_code` menjelaskan mengapa satu record assignment digantikan sementara semester masih berjalan. Nilai minimum:

- `supervisor_replaced`;
- `semester_carried_forward`;
- `extension_assignment_created`.

`semester_outcome_code` menjelaskan hasil agregat satu semester, bukan nasib setiap record assignment. Nilai minimum:

- `continued`: dilanjutkan ke semester berikutnya;
- `extension_approved`: izin semester 3 disetujui;
- `extension_rejected`: izin ditolak;
- `repeated`: masuk ulang jalur;
- `transferred`: alih jalur;
- `completed`: mahasiswa menyelesaikan proses;
- `cancelled`: proses dibatalkan;
- `in_progress`: hanya untuk semester assignment aktif.

Record assignment lama yang berakhir karena replacement menyimpan `end_reason_code = supervisor_replaced` dan `assignment_transition_code = supervisor_replaced`, tetapi `semester_outcome_code` tetap null. Pada timeline, kelompok semester tersebut tetap `in_progress` selama assignment pengganti masih aktif. Outcome semester baru ditetapkan pada record terminal terakhir atau dihitung oleh agregator dari event semester yang otoritatif.

Setiap record ended wajib mempunyai `end_reason_code`. `semester_outcome_code` wajib hanya ketika record tersebut menutup atau melanjutkan semester, bukan ketika terjadi replacement di tengah semester.

## 6. Kontrak data target

### 6.1 Penetapan pembimbing

Pertahankan field yang sudah tersedia dan tambahkan secara additive:

- `previous_assignment_id`: rantai langsung ke assignment sebelumnya;
- `end_reason_code`;
- `assignment_transition_code`;
- `semester_outcome_code`;
- `izin_lanjut_id`, nullable dan wajib untuk semester ke-3;
- `effective_at`: waktu assignment dijadwalkan mulai berlaku;
- `activated_at`: waktu aktivasi atomik benar-benar berhasil;
- `decision_at`, agar waktu keputusan tidak bergantung pada `createdAt`;
- `idempotency_key` atau tabel request operation ekuivalen;
- `ended_by_actor_type` dan `ended_by_actor_id` bila audit bersama belum menyimpan aktor secara memadai.

Field existing yang tetap menjadi bagian kontrak:

- `mahasiswa_id`;
- `pendaftaran_penjaluran_id`;
- `periode_mulai_id`;
- `semester_penjaluran_ke`;
- `tanggal_mulai` dan `tanggal_selesai`;
- `status`;
- `sumber_data`;
- `created_by_sekretaris_id`;
- `alasan_berakhir` sebagai snapshot kompatibilitas.

`surat_tugas_id` tidak menjadi syarat draft maupun aktivasi.

Enum status ditambah `scheduled`. Partial unique index existing untuk `active` dipertahankan, lalu tambahkan unique index terarah untuk mencegah lebih dari satu scheduled transition pada mahasiswa, periode tujuan, dan nomor semester yang sama. `previous_assignment_id` wajib menggunakan `ON DELETE RESTRICT` karena rantai histori tidak boleh putus akibat penghapusan assignment lama.

### 6.2 Anggota assignment

Setiap anggota menyimpan:

- assignment induk;
- dosen;
- `urutan` 1 atau 2;
- `peran` utama atau pendamping;
- status;
- tanggal mulai dan selesai.

Constraint database wajib menjamin:

- unique `(penetapan_pembimbing_id, urutan)`;
- unique `(penetapan_pembimbing_id, dosen_id)`;
- urutan 1 selalu `utama` dan urutan 2 selalu `pendamping`;
- range tanggal valid;
- P1 tersedia tepat satu pada assignment noncancelled.

Constraint “wajib mempunyai P1” yang melibatkan dua tabel tidak cukup dengan model validation. Validasi dilakukan di service dalam transaksi sebelum aktivasi, ditambah deferred trigger atau prosedur verifikasi bila database mendukung.

### 6.3 Izin lanjut

`IzinLanjutSkripsi` harus diikat ke konteks siklus, bukan hanya mahasiswa dan cache P1:

- tambahkan `pendaftaran_penjaluran_id`;
- tambahkan `penetapan_asal_id`;
- simpan `reviewer_p1_id` sebagai snapshot;
- `periode_penjaluran_id` menjadi periode tujuan semester ke-3;
- tambahkan `penetapan_hasil_id` setelah approval berhasil;
- tambahkan metadata idempotensi dan audit keputusan.

Unique key minimum adalah mahasiswa + pendaftaran + semester tujuan. Izin pada siklus lama tidak boleh membuka semester ke-3 pada siklus baru.

### 6.4 Relasi progres

Prasyarat Tahap 3 berlaku penuh:

- `BimbinganSkripsi` baru wajib mempunyai `pendaftaran_penjaluran_id`;
- `BimbinganSkripsi` baru wajib mempunyai `penetapan_pembimbing_id`;
- pergantian dan carry-forward tetap memakai pendaftaran yang sama sehingga progres tidak direset;
- query histori mengelompokkan aktivitas berdasarkan pendaftaran dan assignment yang melayani bimbingan;
- ulang/alih memakai pendaftaran baru sehingga progres lama tidak masuk hitungan siklus baru;
- record progres legacy ambigu ditandai manual review dan tidak ditebak.

Aturan penulisan:

1. service bimbingan mengambil `pendaftaran_penjaluran_id` dan `penetapan_pembimbing_id` dari assignment aktif yang otoritatif;
2. frontend tidak boleh mengirim atau mengganti assignment secara bebas;
3. dosen yang melayani bimbingan harus menjadi anggota assignment tersebut sesuai aturan akses;
4. assignment dan pendaftaran wajib milik mahasiswa yang sama;
5. scheduled assignment belum boleh dipakai untuk bimbingan;
6. pergantian/carry-forward tidak mengubah foreign key bimbingan lama;
7. bimbingan baru setelah aktivasi memakai assignment baru;
8. backfill hanya dilakukan jika assignment dapat ditentukan dari mahasiswa, pendaftaran, dosen, serta rentang `tanggal_mulai/effective_at` sampai `tanggal_selesai`;
9. data dengan nol atau lebih dari satu kandidat masuk manual review.

Dengan dua foreign key tersebut, pendaftaran tetap menjadi root siklus dan assignment menjadi sumber semester/pembimbing yang melayani aktivitas. Sistem tidak lagi mencoba menentukan semester bimbingan dari rentang pembukaan `PeriodePenjaluran`.

## 7. Kondisi implementasi saat ini

### 7.1 Fondasi yang sudah sesuai

- tabel induk dan anggota assignment sudah tersedia;
- partial unique index satu assignment active per mahasiswa sudah ada;
- constraint urutan/peran serta unique dosen/urutan sudah ada;
- status dan tanggal anggota sudah ditambahkan;
- service draft, activate, replace, end, active lookup, dan history sudah tersedia;
- cache P1 diperbarui pada aktivasi serta dikosongkan pada pengakhiran;
- finalizer Tahap 2 membuat assignment semester ke-1;
- timeline mahasiswa/dosen dan monitoring Sekprodi sudah tersedia;
- script backfill dan rekonsiliasi assignment sudah tersedia;
- keputusan izin lanjut sudah memakai transaction dan row lock pada record izin;
- hanya P1 aktif yang dapat memutus izin pada controller sekarang.

### 7.2 Gap kritis

#### 7.2.1 Nomor semester masih dapat dihitung lintas siklus

`resolveSemesterPenjaluranKe()` menghitung posisi periode dari seluruh pendaftaran approved mahasiswa. `getSemesterPenjaluranAktif()` bahkan memakai periode pendaftaran pertama mahasiswa. Ulang/alih seharusnya mereset semester menjadi 1 pada pendaftaran baru.

#### 7.2.2 Belum ada service carry-forward semester

Belum ada preview kandidat, batch konfirmasi, lock, idempotensi, atau transaksi yang mengakhiri semester ke-1 dan membuat semester ke-2 dengan komposisi sama.

#### 7.2.3 Approval izin belum membuat semester ke-3

Controller saat ini hanya mengubah status izin menjadi approved dan cache status mahasiswa. Tidak ada assignment semester ke-3 yang dibuat dalam transaksi yang sama.

#### 7.2.4 Rejection izin belum mengakhiri assignment

Controller mengubah state mahasiswa menjadi ulang, tetapi tidak mengakhiri assignment aktif dengan alasan `extension_rejected`. Akibatnya akses P1/P2 dan cache dapat tetap aktif.

#### 7.2.5 Izin lanjut belum terikat kuat ke siklus dan assignment

Model izin menyimpan mahasiswa, satu dosen, periode, dan nomor semester, tetapi belum menyimpan pendaftaran, assignment asal, reviewer P1 snapshot, atau assignment hasil approval.

#### 7.2.6 Alasan berakhir masih berupa teks

`alasan_berakhir` belum mempunyai reason code stabil. Pelaporan dan frontend terpaksa membandingkan teks yang mudah berubah.

#### 7.2.7 Carry-forward dan pergantian masih memakai primitive yang sama

`replaceSupervisorAssignment()` menyimpulkan sumber berdasarkan komposisi. Untuk Tahap 4 diperlukan intent eksplisit agar retry, validasi semester, izin, dan audit tidak bergantung pada heuristik komposisi.

#### 7.2.8 Validasi dosen baru belum dibedakan dari kelanjutan lama

Carry-forward bukan penetapan mahasiswa baru. Dosen `study_leave` yang diizinkan melanjutkan boleh dibawa, sedangkan `retired` tidak. Service harus memakai policy melanjutkan bimbingan lama, bukan `validateDosenForNewAssignment()`.

#### 7.2.9 Status akhir semester belum tersimpan

Sistem dapat menampilkan status assignment, tetapi belum dapat membedakan ended karena carry-forward, pergantian, selesai, ulang, atau alih dengan kode terstruktur.

#### 7.2.10 Monitoring belum lengkap

Monitoring sudah mendukung pencarian, periode, dosen, status, dan sumber, tetapi belum filter jalur, nomor semester, outcome, dan data anomali. Urutannya juga masih dominan `createdAt`.

#### 7.2.11 Endpoint izin mengizinkan role Sekprodi tetapi keputusan memerlukan identitas P1

Route menerima role dosen dan Sekprodi, sedangkan controller tetap mewajibkan aktor menjadi P1. Kontrak aktor perlu dinormalisasi agar UI dan otorisasi tidak menampilkan kemampuan yang sebenarnya tidak tersedia.

#### 7.2.12 Belum ada integration test lifecycle semester lengkap

Test assignment yang ada membuktikan replacement dan rollback dasar, tetapi belum membuktikan semester 1 → 2, izin → semester 3, rejection, reset ulang/alih, batch retry, serta isolasi progres per siklus melalui endpoint.

#### 7.2.13 Bimbingan belum mengikat assignment pelayan

Relasi ke pendaftaran memisahkan siklus, tetapi belum cukup untuk menentukan assignment/P1/P2 yang melayani suatu bimbingan ketika terjadi replacement atau carry-forward dalam siklus yang sama. Inferensi dari tanggal dan periode pendaftaran tidak aman.

#### 7.2.14 Belum ada status scheduled dan aktivasi efektif

Carry-forward yang disiapkan sebelum semester dimulai berisiko langsung mengakhiri assignment lama. Model belum dapat membedakan keputusan yang sudah disiapkan dari assignment yang sudah efektif memberi hak akses.

#### 7.2.15 Outcome pamit dan pendaftaran baru dapat bertabrakan

Assignment sudah berakhir ketika pamit approved. Pendaftaran ulang/alih berikutnya seharusnya hanya mengonsumsi pamit, bukan mencari assignment aktif atau mengedit histori ended untuk mengganti outcome.

#### 7.2.16 Carry-forward kelompok Perintisan belum mempunyai atomicity contract

Transaksi per mahasiswa cocok untuk Penelitian dan Magang, tetapi dapat memecah kelompok Perintisan jika aturan akademik mewajibkan seluruh anggota berlanjut bersama. Perilaku anggota selesai/berhenti dan perubahan komposisi kelompok belum diputuskan.

## 8. Rencana pengerjaan

### Paket 0 — Baseline dan keputusan domain

1. Penuhi seluruh kriteria masuk Bagian 3.2 dan simpan hasil verifikasi sebagai artefak release.
2. Stabilkan finalizer Tahap 2 dan flow ulang/alih Tahap 3.
3. Tambahkan characterization test untuk service assignment, cache, akses dosen, izin lanjut, monitoring, dan pembuatan bimbingan saat ini.
4. Bekukan perubahan enum/status selama migration dirancang.
5. Sebelum migration, tambahkan atau revisi aturan bisnis untuk menetapkan:
   - aktor yang menyetujui izin semester 3;
   - apakah izin rejected boleh diajukan ulang;
   - apakah carry-forward mengonsumsi kuota periode tujuan;
   - aktor yang menjalankan carry-forward;
   - sumber tanggal efektif semester baru;
   - status assignment sebelum tanggal efektif;
   - atomicity serta perubahan anggota kelompok Perintisan;
   - batas dan mekanisme semester ke-4+.
6. Sikap teknis rancangan untuk assignment masa depan adalah `scheduled`; keputusan ini tetap harus dicatat dalam BR/workflow operasional.
7. Selama batas semester berikutnya belum final, tegaskan semester ke-4+ tetap blocked.

Hasil: tidak ada implementasi berdasarkan asumsi yang mengubah keputusan akademik.

### Paket 1 — Migration additive histori semester

1. Tambahkan kolom assignment target pada Bagian 6.1.
2. Tambahkan foreign key self-reference `previous_assignment_id` dengan `ON DELETE RESTRICT`.
3. Tambahkan foreign key izin hasil dan constraint nomor semester positif.
4. Tambahkan index:
   - `(pendaftaran_penjaluran_id, semester_penjaluran_ke)`;
   - `(periode_mulai_id, status)`;
   - `(mahasiswa_id, tanggal_mulai, id)`;
   - `previous_assignment_id`;
   - `end_reason_code` dan `semester_outcome_code` untuk monitoring.
5. Tambahkan enum `scheduled`, kolom `effective_at`/`activated_at`, dan unique index scheduled transition.
6. Tambahkan `pendaftaran_penjaluran_id` serta `penetapan_pembimbing_id` pada `BimbinganSkripsi`, beserta index dan foreign key `ON DELETE RESTRICT`.
7. Pertahankan kolom baru nullable selama backfill.
8. Jangan mengubah atau menghapus field legacy pada release pertama.

Hasil: schema mampu menyimpan rantai assignment dan hasil semester tanpa memutus kompatibilitas.

### Paket 2 — Resolver siklus dan semester

Buat service murni, misalnya `semesterAssignmentResolver`, yang menyediakan:

- `resolveAssignmentCycle(mahasiswaId)`;
- `resolveCurrentAssignmentTerm(pendaftaranId)`;
- `resolveNextAcademicPeriod(currentPeriodId)`;
- `resolveNextSemesterNumber(activeAssignment)`;
- `classifyAssignmentTransition(current, requested)`.

Aturannya:

1. kunci mahasiswa dan assignment aktif untuk operasi mutasi;
2. ambil pendaftaran dari assignment aktif;
3. pastikan pendaftaran milik mahasiswa dan approved;
4. tentukan nomor semester dari assignment dalam pendaftaran yang sama;
5. abaikan assignment pendaftaran/siklus lama;
6. cari periode akademik berikutnya secara deterministik;
7. deteksi periode hilang, duplikat metadata semester, lompatan periode, dan nomor semester tidak kontinu;
8. untuk pendaftaran baru tanpa histori, hasil selalu semester 1;
9. untuk pergantian, hasil tetap semester dan periode yang sama;
10. untuk carry-forward, hasil harus `current + 1` dan periode berikutnya.

Hasil: seluruh endpoint memakai satu definisi semester yang konsisten dan ulang/alih benar-benar reset.

### Paket 3 — Primitive assignment berbasis intent

Pisahkan operasi domain di atas primitive draft/activate/end:

```text
createInitialSemesterAssignment()
scheduleSemesterAssignment()
activateScheduledAssignment()
carryForwardSemesterAssignment()
replaceSupervisorsWithinSemester()
endSemesterAssignment()
```

Setiap operasi wajib:

1. menerima `expected_assignment_id` dan idempotency key;
2. mengunci mahasiswa, assignment aktif, anggota, pendaftaran, dan periode terkait;
3. memvalidasi transition intent, bukan menebak dari komposisi;
4. bila `effective_at` berada di masa depan, membuat record `scheduled` tanpa mengakhiri assignment lama;
5. bila efektif sekarang, membuat record baru sebelum mengakhiri record lama dalam transaksi yang sama, kemudian mengaktifkannya setelah seluruh validasi lulus;
6. mengisi `previous_assignment_id`, reason code, assignment transition, semester outcome bila terminal, actor, dan waktu keputusan;
7. menyinkronkan status/tanggal seluruh anggota;
8. menyinkronkan cache P1 hanya ketika assignment benar-benar active;
9. membuat audit dan notifikasi dalam transaksi;
10. mengembalikan hasil lama untuk retry identik;
11. menghasilkan `409 ASSIGNMENT_TRANSITION_CONFLICT` untuk retry dengan payload berbeda.

Tambahkan worker `activateScheduledAssignments()` yang aman dijalankan lebih dari sekali, memakai row locking/skip locked, memproses batch kecil, dan menghasilkan alert untuk record jatuh tempo yang gagal aktif.

`replaceSupervisorAssignment()` lama menjadi adapter sementara dan diarahkan ke primitive sesuai intent yang eksplisit.

Hasil: carry-forward, pergantian, dan initial assignment tidak lagi saling tertukar.

### Paket 4 — Initial assignment semester ke-1

1. Satu-satunya jalur aktivasi assignment awal adalah finalizer keputusan final Sekprodi Tahap 2.
2. Untuk ulang/alih, Tahap 3 hanya membuat root pendaftaran dan mengarahkan mahasiswa ke form jalur tujuan; setelah review selesai, finalizer Tahap 2 memanggil `createInitialSemesterAssignment()`.
3. Wajibkan pendaftaran approved dan belum mempunyai assignment aktif/semester 1 hasil keputusan yang sama.
4. Paksa `semester_penjaluran_ke = 1` tanpa menghitung histori pendaftaran lain.
5. Gunakan periode pendaftaran sebagai periode semester pertama.
6. Validasi P1/P2 sebagai penetapan baru: status master, ketersediaan periode, kuota, dan P1 ≠ P2.
7. Simpan aktor Sekprodi serta timestamp keputusan final.
8. Retry final approval mengembalikan assignment yang sama.

Hasil: semua siklus baru dimulai dari semester ke-1 secara konsisten.

### Paket 5 — Preview carry-forward semester 1 ke 2

Buat query preview readonly berdasarkan periode sumber dan tujuan. Kandidat harus:

- mempunyai assignment active semester ke-1;
- berada pada pendaftaran/siklus yang sama;
- belum selesai, dibatalkan, pamit approved, ulang, atau alih;
- tidak mempunyai assignment semester ke-2;
- tidak mempunyai workflow terminal yang mengakhiri bimbingan;
- mempunyai periode tujuan yang valid;
- mempunyai P1 dan metadata anggota konsisten.

Klasifikasikan setiap mahasiswa:

- `ready`: dapat dibawa dengan komposisi sama;
- `requires_supervisor_followup`: ada dosen yang tidak boleh melanjutkan;
- `already_processed`: semester 2 sudah ada;
- `completed_or_ended`: tidak perlu dibawa;
- `data_issue`: relasi atau histori ambigu.

Response preview menyertakan reason code, assignment sumber, P1/P2, jalur, pendaftaran, progres ringkas, dan target semester. Preview tidak boleh mengubah data.

Hasil: Sekprodi mengetahui dampak sebelum menjalankan batch.

### Paket 6 — Konfirmasi carry-forward semester 2

Buat `carryForwardSemesterAssignment()` individual dan bulk orchestrator:

1. request mengirim ID assignment sumber, periode tujuan, dan idempotency key; bukan semester/P1/P2 bebas;
2. server menghitung ulang eligibility di dalam transaksi;
3. gunakan policy `continue_existing_supervision`, bukan availability mahasiswa baru;
4. copy komposisi P1/P2 dari assignment sumber;
5. buat assignment baru pada pendaftaran sama, semester 2, sumber `perpanjangan`;
6. jika tanggal efektif masih di masa depan, simpan sebagai `scheduled`; assignment semester 1 tetap active dan cache tidak berubah;
7. pada tanggal efektif, worker mengaktifkan semester 2 dan mengakhiri semester 1 secara atomik dengan:
   - `end_reason_code = semester_carried_forward`;
   - `semester_outcome_code = continued`;
   - tanggal selesai sama dengan tanggal efektif semester 2;
8. aktifkan anggota baru dan sinkronkan cache;
9. jangan membatalkan jadwal bimbingan hanya karena komposisi sama;
10. jangan mengubah foreign key bimbingan lama; bimbingan setelah aktivasi mengambil assignment semester 2;
11. buat notifikasi “dijadwalkan” saat keputusan dibuat dan notifikasi “aktif” saat aktivasi berhasil, masing-masing dengan deduplication key berbeda;
12. pada bulk Penelitian/Magang, setiap mahasiswa memakai transaksi sendiri agar satu data rusak tidak me-rollback seluruh angkatan;
13. pada Perintisan, unit transaksi mengikuti kontrak kelompok yang disahkan di Paket 0;
14. retry batch aman dan tidak membuat duplikasi.

Untuk Perintisan, jangan memakai default transaksi per mahasiswa sebelum aturan bisnis diputuskan. Jika kelompok wajib tetap utuh, lock kelompok, seluruh anggota aktif, pendaftaran, dan assignment; lalu schedule/activate seluruh anggota dalam satu transaksi per kelompok. Jika anggota boleh berlanjut/selesai sendiri, dokumentasikan bagaimana status serta komposisi kelompok semester berikutnya dibentuk. Ketua tidak boleh secara sepihak menghapus atau mengganti anggota tanpa workflow resmi.

Hasil: semester ke-2 mempunyai record mandiri tanpa kehilangan progres semester ke-1.

### Paket 7 — Pengajuan izin lanjut semester ke-3

1. Mahasiswa hanya dapat mengajukan dari assignment active semester ke-2.
2. Server mengikat izin ke mahasiswa, pendaftaran, assignment sumber, P1 reviewer, dan periode tujuan.
3. Periode tujuan harus tepat setelah periode assignment semester 2.
4. Tolak bila mahasiswa selesai, pamit, ulang/alih, assignment berubah, atau sudah mempunyai izin pada siklus/semester yang sama.
5. Snapshot P1 berasal dari anggota urutan 1, bukan cache.
6. P2 dapat menerima informasi tetapi tidak memutus jika kebijakan P1-only dipertahankan.
7. Retry identik mengembalikan izin yang sama.
8. Izin pending menjadi stale/cancelled bila assignment sumber berubah; mahasiswa mengajukan ulang terhadap P1 aktif.

Hasil: izin tidak dapat digunakan lintas siklus atau terhadap assignment yang sudah berubah.

### Paket 8 — Keputusan izin dan semester ke-3

Buat `decideExtensionAndTransitionSemester()` dalam satu transaksi.

Untuk approval:

1. kunci izin, mahasiswa, assignment sumber, anggota, pendaftaran, dan periode tujuan;
2. validasi aktor adalah reviewer P1 yang masih sah;
3. validasi izin pending dan assignment sumber masih active semester 2;
4. validasi seluruh pembimbing boleh melanjutkan bimbingan lama;
5. ubah izin menjadi approved;
6. buat assignment semester 3 dengan komposisi sama, sumber `perpanjangan`, `izin_lanjut_id`, dan `effective_at`;
7. jika tanggal efektif masih di masa depan, assignment semester 3 menjadi `scheduled` dan semester 2 tetap active;
8. pada tanggal efektif, aktifkan semester 3 dan akhiri semester 2 secara atomik dengan reason `semester_carried_forward` serta outcome `extension_approved`;
9. isi `penetapan_hasil_id` pada izin segera setelah scheduled/active assignment berhasil dibuat;
10. sinkronkan cache hanya saat aktivasi, lalu buat audit dan notifikasi sesuai fase scheduled/active;
11. commit bersama.

Untuk rejection:

1. alasan P1 wajib;
2. ubah izin menjadi rejected;
3. akhiri assignment semester 2 dengan reason/outcome `extension_rejected`;
4. akhiri anggota dan kosongkan cache P1;
5. batalkan hanya permohonan bimbingan mendatang yang masih pending sesuai policy;
6. pertahankan bimbingan, resume, dokumen, dan histori yang sudah terjadi;
7. set gate ulang/alih melalui service Tahap 3, bukan hanya cache `status_jalur_saat_ini`;
8. buat audit serta notifikasi mahasiswa, P1, dan P2;
9. commit bersama.

Retry keputusan sama mengembalikan hasil sebelumnya. Keputusan berbeda setelah terminal menghasilkan `409 EXTENSION_DECISION_CONFLICT`.

Hasil: tidak ada izin approved tanpa semester 3 atau izin rejected dengan assignment masih aktif.

### Paket 9 — Pergantian pembimbing dalam semester yang sama

1. Gunakan `replaceSupervisorsWithinSemester()` dari workflow tindak lanjut Tahap 1.
2. Pertahankan pendaftaran, periode, dan nomor semester assignment aktif.
3. Validasi dosen baru memakai aturan penetapan baru; dosen yang dipertahankan memakai aturan kelanjutan lama.
4. Akhiri assignment lama dengan `end_reason_code = supervisor_replaced` dan `assignment_transition_code = supervisor_replaced`; jangan isi semester outcome pada record ini.
5. Buat assignment baru `sumber_data = pergantian` dan `previous_assignment_id` menunjuk record lama.
6. Batalkan jadwal mendatang milik dosen yang dilepas dan alihkan review resume sesuai policy existing.
7. Jangan mereset atau memindahkan progres siklus.
8. Jika ada izin pending yang mengikat assignment lama, tandai stale/cancelled dan minta submit ulang.

Hasil: pergantian dapat dibedakan dari pergantian semester dalam audit maupun UI.

### Paket 10 — Pengakhiran dari flow lain

Semua flow memakai `endSemesterAssignment()` dengan mapping terpusat:

| Event | Reason | Outcome |
| --- | --- | --- |
| Pamit ulang approved | `pamit_approved` | `repeated` |
| Pamit alih approved | `pamit_approved` | `transferred` |
| Masa penetapan selesai | `assignment_term_expired` | sesuai keputusan berikutnya |
| Izin ditolak | `extension_rejected` | `extension_rejected` |
| Mahasiswa selesai | `student_completed` | `completed` |
| Proses dibatalkan | `workflow_cancelled` | `cancelled` |

Service bersifat idempotent, memakai `expected_assignment_id`, menyinkronkan anggota/cache, dan tidak menghapus histori. Flow pemanggil tidak boleh mengubah assignment/cache langsung.

Mapping pamit bersifat final pada saat approval karena pamit sudah menyimpan `jenis_perubahan` dan target. Pamit rejected tidak mengubah assignment. Ketika pendaftaran ulang/alih kemudian dibuat, service Tahap 3 hanya mengonsumsi pamit dan membuat root siklus baru; service tersebut tidak mencari assignment aktif, tidak mengakhiri assignment lagi, dan tidak mengedit reason/outcome histori lama. Jika mahasiswa tidak mempunyai assignment aktif sehingga pamit tidak diperlukan, pendaftaran baru juga tidak menciptakan event pengakhiran assignment lama.

Hasil: semua alasan akhir dapat dilaporkan secara konsisten.

### Paket 11 — Histori dan monitoring API

Endpoint target:

```text
GET  /api/mahasiswa/penetapan-pembimbing
GET  /api/dosen/mahasiswa/:id/penetapan-pembimbing
GET  /api/sekretaris/mahasiswa/:id/penetapan-pembimbing
GET  /api/sekretaris/penetapan-pembimbing
GET  /api/sekretaris/semester-transition/preview
POST /api/sekretaris/semester-transition/confirm
POST /api/sekretaris/semester-transition/confirm-bulk
```

Timeline dinormalisasi per siklus:

```json
{
  "registration": {},
  "track": "penelitian",
  "semesters": [
    {
      "academic_period": {},
      "semester_penjaluran_ke": 1,
      "semester_outcome": "continued",
      "scheduled_transition": null,
      "assignments": [],
      "progress_summary": {}
    }
  ]
}
```

Monitoring Sekprodi menambah filter:

- mahasiswa/NIM;
- dosen;
- jalur;
- pendaftaran/siklus;
- periode akademik;
- semester penjaluran ke-;
- sumber;
- status assignment;
- outcome/reason;
- anomali data.

Gunakan pagination dan sort akademik: siklus, periode, nomor semester, tanggal efektif, lalu ID. Histori readonly; mutasi hanya melalui endpoint workflow resmi.

### Paket 12 — Frontend

#### Timeline mahasiswa dan dosen

- kelompokkan berdasarkan siklus dan jalur;
- tampilkan kartu per semester akademik;
- tampilkan P1/P2, tanggal aktif, sumber, status akhir, dan alasan berakhir;
- tampilkan beberapa assignment dalam semester yang sama sebagai pergantian, bukan semester baru;
- tampilkan scheduled assignment dan tanggal efektif tanpa menganggapnya aktif;
- tampilkan ringkasan progres dari pendaftaran yang sama;
- tandai data legacy/ambigu dengan jelas.

#### Monitoring Sekprodi

- filter lengkap sesuai Paket 11;
- preview carry-forward dengan jumlah ready/follow-up/already processed/data issue;
- pilihan individual dan bulk;
- dialog konfirmasi menyebut tanggal efektif dan periode tujuan;
- tampilkan status aktivasi scheduled serta kegagalan worker yang memerlukan tindak lanjut;
- hasil batch menampilkan success/skipped/failed per mahasiswa;
- refresh state dari API setelah operasi; jangan melakukan optimistic mutation untuk assignment.

#### Izin lanjut

- tampilkan assignment sumber dan periode tujuan readonly;
- hanya P1 yang sah melihat tombol keputusan jika kebijakan P1-only;
- setelah approval tampilkan assignment semester 3;
- setelah rejection tampilkan next action ulang/alih;
- retry/double-click tidak menggandakan keputusan.

Hasil: pengguna dapat memahami perbedaan semester baru, pergantian, dan siklus baru.

### Paket 13 — Notifikasi dan audit

Notifikasi minimum:

- assignment semester 1 aktif;
- assignment semester berikutnya dijadwalkan dan kemudian berhasil diaktifkan;
- carry-forward semester 2 berhasil;
- izin lanjut diajukan kepada P1 dan diinformasikan kepada P2;
- izin disetujui dan semester 3 aktif;
- izin ditolak dan mahasiswa diarahkan ulang/alih;
- P1/P2 diganti;
- assignment diakhiri karena selesai/pamit/pembatalan;
- item carry-forward memerlukan tindak lanjut dosen.

Gunakan deduplication key berbasis event + assignment/izin ID. Notifikasi database dibuat dalam transaksi; kanal eksternal memakai outbox setelah commit.

Audit minimum merekam:

- assignment lama dan baru;
- pendaftaran, periode, dan nomor semester;
- komposisi sebelum/sesudah;
- status, reason, dan outcome sebelum/sesudah;
- izin lanjut bila ada;
- aktor, role, waktu, correlation ID, dan idempotency key.

### Paket 14 — Backfill dan rekonsiliasi

Perluas script menjadi mode `dry-run` dan `execute`, dengan laporan per record dan tingkat keyakinan. Deteksi:

- lebih dari satu assignment active per mahasiswa;
- assignment tanpa P1 atau P1/P2 sama;
- status/tanggal anggota tidak sama dengan induk;
- cache P1 tidak cocok;
- assignment nonlegacy tanpa pendaftaran/periode/semester;
- nomor semester dihitung lintas siklus;
- pendaftaran baru ulang/alih dengan semester bukan 1;
- carry-forward dengan semester tidak berurutan;
- beberapa assignment satu semester tanpa rantai `previous_assignment_id`;
- source `perpanjangan` tetapi pendaftaran berubah;
- source `pergantian` tetapi semester/periode berubah;
- ended tanpa reason/outcome;
- izin approved tanpa assignment semester 3;
- izin rejected tetapi assignment masih active;
- assignment semester 3 tanpa izin approved;
- assignment semester 4+;
- overlap tanggal assignment;
- lebih dari satu scheduled transition pada mahasiswa/periode/semester yang sama;
- scheduled melewati `effective_at` tetapi belum active;
- bimbingan/progres terhubung ke siklus yang salah;
- bimbingan tanpa assignment atau assignment berbeda dari pendaftaran/dosen pelayan.

Backfill deterministik:

1. kelompokkan assignment per mahasiswa dan pendaftaran;
2. urutkan menurut periode akademik, tanggal efektif, lalu ID;
3. semester pertama setiap pendaftaran menjadi 1;
4. periode berikutnya pada pendaftaran sama menaikkan semester;
5. beberapa assignment pada periode sama diklasifikasikan sebagai pergantian;
6. isi rantai previous dan reason/outcome jika dapat dibuktikan;
7. data ambigu masuk manual review dan tidak diperbaiki otomatis;
8. backfill assignment bimbingan hanya jika tepat satu kandidat cocok dengan mahasiswa, pendaftaran, dosen, dan rentang aktif;
9. constraint ketat dipasang setelah data aktif bersih.

Hasil: histori legacy tidak dipaksakan menjadi data pasti tanpa bukti.

## 9. Strategi pengujian

### 9.1 Unit test

- resolver periode akademik berikutnya;
- reset nomor semester per pendaftaran;
- classifier initial/carry-forward/replacement/new cycle;
- allowed transition assignment;
- mapping reason/outcome;
- agregasi semester yang mengabaikan replacement sebagai outcome terminal;
- transition `draft → scheduled → active` dan eligibility waktu efektif;
- eligibility carry-forward;
- policy dosen baru versus melanjutkan lama;
- validator izin per siklus;
- idempotency fingerprint;
- formatter timeline per siklus dan semester.

### 9.2 Integration test initial assignment

1. Finalizer keputusan Sekprodi untuk tiga jalur membuat assignment semester 1.
2. Pendaftaran ulang/alih yang selesai direview masuk finalizer yang sama dan membuat semester 1 walaupun mahasiswa pernah semester 3.
3. P1 wajib, P2 opsional, dan P1 ≠ P2.
4. Pendaftaran bukan milik mahasiswa ditolak.
5. Dosen tidak tersedia untuk mahasiswa baru ditolak.
6. Cache dan anggota aktif konsisten.
7. Retry final approval tidak menggandakan assignment/notifikasi.

### 9.3 Integration test carry-forward

1. Preview hanya memuat assignment semester 1 yang eligible.
2. Confirm dengan tanggal masa depan membuat semester 2 scheduled tanpa mengakhiri semester 1.
3. Worker pada tanggal efektif mengakhiri semester 1 dan mengaktifkan semester 2 secara atomik.
4. Komposisi sama tetap menghasilkan record baru.
5. Pendaftaran dan progres tetap sama.
6. Bimbingan lama tetap menunjuk assignment lama; bimbingan setelah aktivasi menunjuk assignment baru.
7. Scheduled assignment tidak dapat melayani bimbingan sebelum efektif.
8. Dosen study leave yang diizinkan melanjutkan diterima.
9. Dosen retired atau tidak boleh melanjutkan masuk follow-up, bukan dipindah otomatis.
10. Mahasiswa selesai/pamit/ulang/alih tidak dibawa.
11. Periode tujuan hilang/ambigu ditolak.
12. Dua request paralel menghasilkan satu semester 2.
13. Worker terlambat/gagal tidak menghasilkan dua active assignment dan dapat di-retry.
14. Kegagalan di tengah transaksi me-rollback assignment lama, baru, cache, audit, dan notifikasi.
15. Bulk Penelitian/Magang mengisolasi kegagalan satu mahasiswa dan dapat di-retry.
16. Carry-forward Perintisan mengikuti atomicity kelompok yang sudah disahkan.

### 9.4 Integration test izin lanjut

1. Hanya semester 2 active dapat mengajukan izin semester 3.
2. Izin mengikat pendaftaran, assignment sumber, P1, dan periode tujuan.
3. P2/dosen lain ditolak memberi keputusan.
4. Approval masa depan membuat semester 3 scheduled tanpa mengakhiri semester 2; aktivasi efektif melakukan transisi atomik.
5. Rejection mengakhiri assignment, anggota, dan cache serta membuka gate ulang/alih.
6. Assignment berubah saat izin pending membuat izin stale/cancelled.
7. Izin siklus lama tidak dapat membuka siklus baru.
8. Retry keputusan sama idempotent; keputusan berbeda conflict.
9. Semester 3 tanpa izin approved ditolak database/service.
10. Semester 4 ditolak dengan `SEMESTER_LIMIT_UNDEFINED`.

### 9.5 Integration test pergantian dan pengakhiran

1. Pergantian mempertahankan pendaftaran/periode/nomor semester.
2. Progres tidak direset.
3. Jadwal mendatang dosen yang dilepas dibatalkan sesuai policy.
4. Carry-forward tidak membatalkan jadwal jika komposisi sama.
5. Pamit ulang/alih approved menghasilkan reason `pamit_approved` dengan outcome `repeated`/`transferred`.
6. Pendaftaran baru hanya mengonsumsi pamit dan tidak mengedit assignment ended.
7. Replacement menyimpan assignment transition tetapi tidak menutup outcome semester.
8. End service idempotent dan expected assignment mencegah race.

### 9.6 Integration test assignment pada bimbingan

1. Bimbingan baru mengambil pendaftaran dan assignment aktif dari server.
2. Field assignment/pendaftaran manipulatif dari frontend diabaikan atau ditolak.
3. Dosen harus menjadi anggota assignment yang direferensikan.
4. Scheduled assignment tidak dapat dipakai sebelum aktif.
5. Setelah carry-forward, bimbingan lama tetap pada assignment semester 1 dan bimbingan baru memakai semester 2.
6. Setelah replacement, bimbingan lama tetap pada assignment lama dan bimbingan baru memakai assignment pengganti.
7. Ulang/alih tidak membawa bimbingan siklus lama ke assignment semester 1 siklus baru.
8. Backfill tepat satu kandidat berhasil; nol atau beberapa kandidat masuk manual review.

### 9.7 API, frontend, dan authorization test

- mahasiswa hanya melihat historinya;
- dosen hanya melihat mahasiswa yang pernah/masih dibimbing sesuai kebijakan akses;
- Sekprodi dapat monitoring dan carry-forward;
- histori tidak menyediakan mutasi langsung;
- filter jalur/periode/semester/source/status/outcome benar;
- timeline membedakan dua assignment pada semester sama dari semester baru;
- timeline menampilkan scheduled tanpa memberinya label aktif;
- state setelah refresh berasal dari API;
- double-click tidak menggandakan operasi;
- hasil bulk parsial tampil jelas.

### 9.8 UAT minimum

1. Penelitian semester 1 → 2 dengan P1/P2 sama.
2. Magang semester 1 → 2 dengan P2 kosong.
3. Perintisan semester 1 → 2 mengikuti atomicity kelompok yang ditetapkan aturan bisnis.
4. Semester 2 → izin approved → semester 3.
5. Semester 2 → izin rejected → ulang/alih.
6. Pergantian P1 pada semester 2 tanpa reset progres.
7. Study leave boleh melanjutkan.
8. Retired memerlukan penggantian sebelum carry-forward.
9. Ulang setelah semester 3 kembali semester 1.
10. Histori legacy ambigu ditandai manual review.
11. Carry-forward disiapkan sebelum tanggal efektif, terlihat scheduled, lalu aktif tanpa gap/overlap hak akses.
12. Pamit ulang dan pamit alih menghasilkan outcome final berbeda tanpa update kedua saat pendaftaran dibuat.

Pada setiap skenario verifikasi assignment induk/anggota, pendaftaran, periode, nomor semester, P1/P2, cache, progres, izin, reason/outcome, audit, notifikasi, dan akses pengguna.

## 10. Urutan implementasi dan dependensi

| Urutan | Pekerjaan | Dependensi | Risiko |
| --- | --- | --- | --- |
| 1 | Paket 0: baseline dan keputusan domain | Tahap 1–3 stabil | Tinggi; memblokir kontrak |
| 2 | Paket 1: migration additive | Keputusan domain | Tinggi karena data legacy |
| 3 | Paket 2: resolver siklus/semester | Schema additive | Tinggi |
| 4 | Paket 3: primitive assignment berbasis intent | Resolver | Tinggi |
| 5 | Paket 4: initial semester 1 | Finalizer Tahap 2 setelah root/form Tahap 3 selesai | Tinggi |
| 6 | Paket 5–6: preview dan carry-forward semester 2 | Primitive dan policy dosen | Tinggi |
| 7 | Paket 7–8: izin dan semester 3 | Carry-forward stabil | Tinggi |
| 8 | Paket 9–10: pergantian/pengakhiran terpusat | Primitive | Tinggi |
| 9 | Paket 11–13: API, frontend, notifikasi, audit | Semua flow backend | Sedang-tinggi |
| 10 | Paket 14: backfill, rekonsiliasi, constraint final | Schema dan service stabil | Tinggi sebelum deploy |
| 11 | Integration test, build, dan UAT | Semua paket | Tinggi sebelum release |

## 11. Strategi deployment

1. Backup database dan jalankan characterization test.
2. Deploy kolom, enum scheduled, index, serta foreign key assignment/bimbingan secara additive.
3. Deploy resolver baru dalam shadow mode dan bandingkan hasil dengan perhitungan lama.
4. Jalankan rekonsiliasi dry-run; selesaikan assignment aktif yang ambigu.
5. Backfill pendaftaran, periode, semester, previous, reason, outcome, dan izin yang dapat dibuktikan.
6. Deploy dual-read untuk histori, tetapi semua write baru memakai service berbasis intent.
7. Migrasikan finalizer semester 1.
8. Aktifkan preview carry-forward tanpa tombol mutasi.
9. Verifikasi hasil preview satu periode akademik.
10. Aktifkan scheduler/worker dan monitor dalam shadow mode tanpa aktivasi.
11. Aktifkan carry-forward individual, lalu bulk Penelitian/Magang dan Perintisan sesuai atomicity yang disahkan.
12. Migrasikan approval/rejection izin ke transaksi assignment baru.
13. Aktifkan monitoring/timeline baru.
14. Pasang constraint final setelah data aktif bersih.
15. Hentikan pemakaian perhitungan semester global dan direct cache update.
16. Hapus adapter lama setelah satu release stabil dan tidak ada consumer lama.

Rollback aplikasi tidak boleh menghapus histori yang sudah sah. Assignment semester baru yang sudah aktif hanya boleh dikoreksi melalui flow resmi, bukan migration down destruktif.

## 12. Observability dan operasi

Tambahkan metric/log terstruktur:

- jumlah kandidat carry-forward per klasifikasi;
- carry-forward success/skipped/failed;
- scheduled pending/due/activated/activation_failed dan activation lag;
- izin pending/approved/rejected/stale;
- assignment active conflict;
- cache mismatch;
- assignment tanpa P1/pendaftaran/periode/semester;
- semester 3 tanpa izin;
- latency dan rollback operasi transisi;
- idempotency replay/conflict.

Setiap log mutasi memuat correlation ID, mahasiswa, pendaftaran, assignment lama/baru, periode, semester, actor, dan hasil tanpa memuat isi catatan sensitif secara berlebihan.

Sediakan runbook untuk:

- retry batch carry-forward;
- retry scheduled activation yang gagal tanpa menggeser tanggal efektif;
- memperbaiki periode tujuan yang hilang;
- menangani dosen yang tidak boleh melanjutkan;
- menyelesaikan active conflict;
- merekonsiliasi cache;
- meninjau data legacy ambigu.

## 13. Definition of Done Tahap 4

Tahap dinyatakan selesai apabila:

- satu-satunya aktivator assignment awal adalah finalizer keputusan Sekprodi Tahap 2; ulang/alih masuk melalui finalizer yang sama setelah flow Tahap 3 selesai;
- nomor semester dihitung per pendaftaran, bukan dari histori global mahasiswa;
- perpindahan semester 1 ke 2 membuat record baru walaupun P1/P2 sama;
- carry-forward masa depan menghasilkan scheduled assignment dan tidak mengakhiri assignment lama sebelum `effective_at`;
- carry-forward memvalidasi hak melanjutkan dosen, bukan ketersediaan mahasiswa baru;
- semester ke-3 hanya dapat aktif melalui izin approved yang terikat pada siklus yang sama;
- approval izin dan pembuatan semester 3 berada dalam satu transaksi;
- rejection izin mengakhiri assignment/anggota, mengosongkan cache, dan membuka next action ulang/alih;
- semester ke-4+ diblokir sampai aturan bisnis tersedia;
- pergantian P1/P2 mempertahankan pendaftaran, semester, dan progres;
- replacement hanya mencatat assignment transition; outcome semester tetap in progress sampai record terminal terakhir;
- ulang/alih mereset nomor semester dan memisahkan progres melalui pendaftaran baru;
- satu mahasiswa tidak pernah mempunyai lebih dari satu assignment active;
- setiap assignment nonlegacy mempunyai P1, pendaftaran, periode, semester, tanggal, sumber, serta dasar keputusan;
- setiap ended assignment mempunyai reason terstruktur; outcome semester hanya diisi oleh record/event yang benar-benar menutup atau melanjutkan semester;
- setiap bimbingan baru mengikat pendaftaran dan assignment aktif dari server; foreign key lama tidak berubah ketika replacement/carry-forward;
- status/tanggal anggota konsisten dengan induk;
- cache P1 selalu sesuai assignment aktif;
- retry dan request paralel tidak menggandakan assignment, izin, audit, atau notifikasi;
- monitoring dapat difilter berdasarkan mahasiswa, dosen, jalur, siklus, periode, semester, sumber, status, outcome, dan anomali;
- timeline menjawab jalur, semester, P1/P2, progres, tanggal, alasan akhir, dan status akhir setiap semester;
- pamit ulang/alih menetapkan outcome assignment lama saat approval dan pendaftaran baru tidak mengedit histori tersebut;
- rekonsiliasi tidak menemukan active conflict, semester lintas siklus, izin/assignment tidak sinkron, atau progres lintas siklus yang belum ditangani;
- unit test, integration test endpoint, frontend test, build, dry-run rekonsiliasi, dan UAT lulus;
- aturan bisnis, API, backend, frontend, test, dan dokumentasi menyatakan lifecycle yang sama.

## 14. Keputusan yang perlu dikunci

| Keputusan | Sikap rancangan |
| --- | --- |
| Aktor pemberi izin semester ke-3 | Mengikuti flow existing: P1 aktif; perlu ditegaskan sebagai BR karena BR-SEMESTER-002 belum menyebut aktor |
| Izin semester ke-3 yang ditolak dapat diajukan ulang | Belum diasumsikan; wajib menjadi aturan eksplisit beserta batas waktu/jumlah dan dampak assignment |
| Carry-forward memakai kuota periode tujuan | Belum diasumsikan; wajib diputuskan karena aturan hanya membedakan bimbingan baru dan kelanjutan lama |
| Aktor pelaksana carry-forward | Belum final; rancangan menyediakan operasi Sekprodi terotorisasi, tetapi aktornya wajib disahkan di BR |
| Tanggal efektif semester baru | Gunakan tanggal efektif dari kalender/keputusan yang disahkan dan dikonfirmasi aktor resmi, bukan tanggal tutup pendaftaran |
| Status sebelum tanggal efektif | Gunakan `scheduled`; tidak memberi akses dan tidak mengakhiri assignment lama sampai aktivasi atomik |
| Carry-forward kelompok Perintisan | Wajib diputuskan: satu transaksi per kelompok atau per anggota, aturan anggota selesai/berhenti, dan perubahan komposisi |
| Semester ke-4 dan seterusnya | Diblokir dengan `SEMESTER_LIMIT_UNDEFINED` sampai batas maksimal diputuskan |
| Periode tujuan belum mempunyai record | Blokir dan minta perbaikan konfigurasi; jangan membuat periode implisit |
| Pergantian bersamaan dengan carry-forward | Catat sebagai operasi/audit pergantian terpisah agar alasan dan intent tidak hilang |
| Relasi aktivitas langsung ke assignment | Final: `BimbinganSkripsi` wajib menyimpan FK pendaftaran dan FK assignment yang diambil server dari assignment aktif |
| Outcome pamit ulang/alih | Final: ditetapkan saat pamit approved (`repeated`/`transferred`); pendaftaran baru hanya mengonsumsi pamit |
| Surat tugas | Metadata opsional; tidak menjadi syarat aktivasi |

Keputusan baru wajib memperbarui `aturan-bisnis-simps.md`, kontrak API, migrasi, service, frontend, test, dan dokumen ini dalam perubahan yang sama.
