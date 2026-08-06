# Rancangan Pengerjaan Tahap 7 — Penguatan Proses Bimbingan

## 1. Tujuan

Tahap 7 memperkuat proses bimbingan agar setiap permohonan, sesi, resume, validasi, dan progres:

- terikat pada mahasiswa, siklus penjaluran, semester akademik, jalur, penetapan pembimbing, serta anggota P1/P2 yang benar;
- hanya dapat diproses oleh dosen yang memang menjadi tujuan atau reviewer pengganti yang ditetapkan secara sah;
- tetap dapat ditelusuri setelah pergantian pembimbing, pergantian semester, ulang, atau alih jalur;
- dihitung menggunakan kebijakan minimum yang terkonfigurasi dan berversi;
- dapat menyediakan fakta kesiapan bimbingan untuk workflow pendadaran tanpa mengambil alih verifikasi akademik Tahap 8;
- transaksional, idempotent, ter-audit, dan menghasilkan pemberitahuan yang tepat.

Hasil tahap ini bukan sekadar memperbaiki tampilan bimbingan. Backend harus menjadi sumber kebenaran untuk kewenangan, keterkaitan histori, perhitungan progres, dan status persetujuan pembimbing.

### Keputusan penyederhanaan 5 Agustus 2026

Halaman `Tata Kelola Bimbingan` dihapus karena tidak menjadi pekerjaan operasional harian dan mencampurkan konfigurasi teknis dengan proses akademik. Model policy, evaluasi, event, serta reviewer transfer tetap dipertahankan sebagai mekanisme internal; yang dihapus adalah menu, halaman konfigurasi/monitoring khusus, dan keputusan manual yang seharusnya dapat diturunkan dari assignment.

Distribusi fungsi setelah halaman dihapus:

| Kebutuhan | Lokasi/flow baru |
| --- | --- |
| Permohonan, jadwal, dan resume mahasiswa | halaman bimbingan mahasiswa |
| Tugas menerima, reschedule, dan review resume | `Review Bimbingan` dosen |
| Ringkasan progres mahasiswa | `Mahasiswa Bimbingan` Sekretaris Prodi |
| Histori sesi dan resume | `Riwayat Bimbingan` |
| Pergantian pembimbing/reviewer | flow pergantian pembimbing dan assignment aktif |
| Minimum bimbingan | policy internal berversi yang dipasang melalui migration/release |
| Koreksi resume approved | versi/keputusan baru oleh reviewer berwenang; bukan tombol invalidasi Sekprodi |
| Anomali sistem | notifikasi dan laporan rekonsiliasi teknis, bukan halaman operasional baru |

## 2. Acuan aturan bisnis

Rancangan mengacu pada:

- BR-ROLE-004;
- BR-DOSEN-002 sampai BR-DOSEN-004;
- BR-PENETAPAN-001 sampai BR-PENETAPAN-004;
- BR-SEMESTER-001 sampai BR-SEMESTER-003;
- BR-BIMBINGAN-001 dan BR-BIMBINGAN-002;
- BR-SIDANG-001 dan BR-SIDANG-002;
- BR-NOTIF-001;
- BR-AUDIT-001 sampai BR-AUDIT-004.

Aturan final yang wajib dijaga:

1. Mahasiswa memilih P1 atau P2 aktif sebagai tujuan bimbingan.
2. Hanya dosen tujuan dengan penetapan aktif yang dapat memproses permohonan dan resume.
3. Pergantian pembimbing dalam siklus yang sama tidak mereset progres.
4. Ulang atau alih jalur membuat siklus progres baru.
5. Bimbingan jalur lama tidak otomatis memenuhi jalur baru.
6. Histori harus dapat dibaca per semester, jalur, P1/P2, dan masa penetapan.
7. Status dosen menentukan apakah bimbingan lama dapat dilanjutkan.
8. P2 masih opsional.
9. Jumlah minimum bimbingan merupakan konfigurasi internal berversi, bukan konstanta controller dan bukan form Sekretaris Prodi.
10. Operasi lintas entitas wajib transaksional dan retry tidak boleh menggandakan data.

## 3. Keputusan yang belum boleh diasumsikan

Aturan bisnis masih menunda keputusan berikut:

- apakah persetujuan siap sidang cukup dari P1 atau membutuhkan P1 dan P2;
- apakah P2 diwajibkan pada jalur tertentu;
- apakah minimum bimbingan berlaku kumulatif per siklus atau minimum terpisah per semester.

Rancangan data harus dapat mendukung pilihan tersebut, tetapi production enforcement tidak boleh mengaktifkan salah satu pilihan sebelum aturan bisnis diperbarui. Untuk sementara:

- P1 wajib dan P2 tetap opsional;
- progres ditampilkan dalam dua bentuk: per semester dan kumulatif per siklus;
- workflow siap sidang dapat dibangun di balik feature flag atau mode shadow;
- kebijakan approval scope dan count scope harus tersimpan sebagai konfigurasi eksplisit yang dikelola melalui migration/release, bukan UI pengguna.

## 4. Batas tahap

### 4.1 Termasuk Tahap 7

- implementasi workflow aktif untuk Penelitian, Magang, dan Perintisan Bisnis;
- normalisasi keterkaitan bimbingan dengan assignment, anggota assignment, siklus, semester, periode akademik, dan jalur;
- pemilihan P1/P2 sebagai target;
- workflow permohonan, penjadwalan ulang, resume, revisi, dan validasi;
- object-level authorization mahasiswa, dosen, dan Sekretaris Prodi;
- kebijakan minimum bimbingan terpusat dan berversi;
- progres per semester dan kumulatif per siklus;
- penanganan bimbingan ketika pembimbing diganti;
- pemisahan progres ulang/alih;
- fakta kesiapan bimbingan dan persetujuan pembimbing untuk dikonsumsi Tahap 8;
- audit event, notifikasi, idempotensi, concurrency control, dan rekonsiliasi;
- UI mahasiswa dan dosen serta ringkasan/histori melalui halaman Sekretaris Prodi yang sudah ada; tidak membuat halaman tata kelola khusus;
- migration, backfill, integration test, security test, dan UAT.

### 4.2 Tidak termasuk Tahap 7

- pengembangan workflow baru Pengabdian Masyarakat selama jalur tersebut berstatus hold;
- verifikasi transkrip, SKS, mata kuliah wajib, CEPT, publikasi, LOA, dan dokumen pendadaran lain;
- key-in dan histori mata kuliah penjaluran (ditangani Tahap 5); Tahap 7 tidak memblokir bimbingan, tetapi Tahap 8 wajib mengonsumsinya sebagai gate pendadaran/sidang;
- keputusan final kelayakan pendadaran;
- penjadwalan sidang;
- penentuan penguji;
- penilaian, revisi pascasidang, yudisium, dan kelulusan;
- perubahan aturan akademik yang masih berstatus menunggu konfirmasi;
- penghapusan histori bimbingan lama.

Tahap 7 menghasilkan fakta bimbingan. Tahap 8 menggabungkan fakta tersebut dengan persyaratan akademik dan dokumen untuk menghasilkan status verifikasi pendadaran.

Data Pengabdian Masyarakat yang sudah ada tetap dapat dibaca, dimigrasikan secara konservatif, dan tidak boleh dirusak. Adapter read-only dapat mengikuti kontrak histori baru, tetapi create, transition, readiness, policy enforcement, dan UI workflow baru tidak diaktifkan untuk Pengabdian sampai status hold dicabut melalui pembaruan aturan bisnis.

## 5. Kondisi implementasi saat ini

### 5.1 Fondasi yang sudah tersedia

Implementasi saat ini sudah memiliki:

- model BimbinganSkripsi dengan permohonan, keputusan dosen, jadwal, resume, review resume, dan is_counted;
- foreign key pendaftaran_penjaluran_id serta penetapan_pembimbing_id;
- pemilihan dosen_pembimbing_id pada form mahasiswa;
- validasi target terhadap anggota assignment aktif;
- pengecekan status dosen untuk melanjutkan bimbingan lama;
- dukungan P1 dan P2 pada supervision access;
- transaksi dan row lock pada create, keputusan dosen, submit resume, review resume, dan expire;
- pembatalan permohonan mendatang ketika pembimbing diganti;
- pemindahan reviewer untuk resume yang belum selesai setelah pergantian;
- UI mahasiswa dan dosen untuk permohonan serta resume;
- penetapan pembimbing per semester dari Tahap 4.

Fondasi tersebut dipertahankan dan direfaktor, bukan dibuat ulang tanpa kebutuhan.

### 5.2 Gap kritis

#### 5.2.1 Progres masih bercampur lintas siklus

Statistik mahasiswa dibangun dari seluruh BimbinganSkripsi milik mahasiswa. Akibatnya bimbingan siklus lama, ulang, atau alih dapat ikut terhitung pada progres baru.

Perhitungan target harus selalu menerima context:

- mahasiswa;
- pendaftaran/siklus aktif;
- semester penjaluran;
- jalur;
- policy version.

#### 5.2.2 Minimum delapan sesi masih hard-coded

Nilai 8 terdapat pada bimbinganController, dokumenSidangController, dan sidangAkhirController. Ini berisiko menghasilkan tiga hasil kelayakan yang berbeda ketika kebijakan berubah.

Semua consumer harus memakai GuidanceProgressService dan GuidanceRequirementPolicy yang sama.

#### 5.2.3 Keterkaitan histori belum lengkap

Bimbingan baru sudah menyimpan assignment dan pendaftaran, tetapi belum mempunyai referensi/snapshot eksplisit untuk:

- anggota assignment tujuan;
- urutan P1/P2 ketika bimbingan dibuat;
- periode akademik kanonik;
- semester penjaluran ke-;
- jalur;
- jenis siklus baru/ulang/alih;
- policy minimum yang digunakan.

Nilai tersebut tidak boleh dihitung kembali hanya dari status mahasiswa saat ini karena status dapat berubah.

#### 5.2.4 Foreign key legacy masih nullable

Baris lama dapat tidak mempunyai pendaftaran atau assignment. Baris ambigu tidak boleh otomatis dimasukkan ke siklus aktif hanya karena mahasiswa atau dosennya sama.

#### 5.2.5 Antrean dosen masih memakai legacy fallback

Daftar dosen menggabungkan:

- dosen tujuan;
- reviewer pengganti;
- semua mahasiswa yang saat ini dibimbing dosen;
- cache legacy mahasiswa.

Ini dapat menampilkan sesi historis yang bukan kewenangan antrean dosen. Queue tindakan harus hanya memuat row yang target/reviewer efektifnya adalah dosen tersebut. Akses histori read-only, bila diperlukan, harus memakai policy terpisah.

#### 5.2.6 Dosen lama masih berpotensi memproses setelah reviewer dipindahkan

Controller mengizinkan aksi jika dosen sama dengan dosen_id asli atau reviewer_dosen_id. Setelah reviewer dipindahkan, dosen lama tetap cocok dengan dosen_id sehingga masih dapat mereview.

Kewenangan mutasi harus berasal dari effective_reviewer_assignment_member_id. Target awal disimpan sebagai histori, tetapi tidak otomatis tetap mempunyai hak mutasi.

#### 5.2.7 Pemindahan resume selalu menuju P1 baru

Service pergantian saat ini memindahkan resume yang belum selesai ke P1 baru. Untuk penggantian P2, pemindahan seharusnya mempertahankan peran bila P2 pengganti tersedia. Fallback lintas peran memerlukan keputusan Sekretaris Prodi dan audit eksplisit.

#### 5.2.8 Resume dan keputusan ditimpa

Resume mahasiswa, catatan review, status, dan reviewer tersimpan pada satu row. Revisi menimpa isi sebelumnya sehingga histori versi resume dan keputusan tidak utuh.

#### 5.2.9 is_counted menjadi flag manual tanpa reason

is_counted dapat berubah tanpa menyimpan:

- rule/policy version;
- alasan dihitung atau tidak;
- validator;
- waktu efektif;
- invalidation reason.

Untuk data baru, counted harus merupakan hasil validasi yang dapat dijelaskan. Legacy flag hanya dipertahankan selama migrasi.

#### 5.2.10 Belum ada fakta sesi benar-benar terjadi

Saat ini sistem terutama menyimpulkan sesi dapat diberi resume setelah waktu jadwal terlewati. Diperlukan fakta minimal occurrence/validation agar jadwal yang disetujui tetapi tidak terjadi tidak otomatis memenuhi progres.

Jika bisnis belum menginginkan tombol konfirmasi kehadiran terpisah, resume yang disetujui dosen dapat menjadi bukti sesi terjadi. Keputusan ini harus eksplisit pada policy dan test.

#### 5.2.11 Belum ada audit dan notifikasi bimbingan yang konsisten

Mutation bimbingan belum memakai event/audit service dan notification service yang sama dalam transaksi. BR-NOTIF-001 mewajibkan pemberitahuan untuk bimbingan.

#### 5.2.12 Retry API belum idempotent

Row lock mencegah sebagian race, tetapi klik ganda masih terlihat sebagai error atau berpotensi membuat request baru pada kondisi tertentu. Create, approve, reject, reschedule, submit resume, review, transfer reviewer, dan approval siap sidang membutuhkan idempotency contract.

#### 5.2.13 Siap sidang belum mempunyai workflow domain

Perhitungan minimum tersedia secara tersebar, tetapi belum ada:

- pengajuan readiness mahasiswa;
- snapshot policy/fakta;
- approval pembimbing per assignment member;
- invalidation ketika fakta berubah;
- handoff ke verifikasi akademik Tahap 8.

#### 5.2.14 Identitas Sekretaris Prodi sebagai dosen belum kuat

Resolver saat ini dapat mencari dosen berdasarkan NIK, email, atau jabatan struktural. Fallback jabatan dapat salah mengikat identitas. Jika Sekretaris Prodi juga bertindak sebagai pembimbing, harus ada relasi akun/person/dosen yang eksplisit.

## 6. Kontrak domain

### 6.1 Istilah

| Istilah | Makna |
| --- | --- |
| Siklus | Satu PendaftaranPenjaluran baru, ulang, atau alih yang menjadi batas progres |
| Semester assignment | Penetapan pembimbing pada semester penjaluran tertentu |
| Target awal | Anggota P1/P2 yang dipilih mahasiswa saat permohonan dibuat |
| Reviewer efektif | Anggota assignment yang saat ini berwenang memproses row |
| Sesi tervalidasi | Sesi yang memenuhi status permohonan, bukti terjadi, resume, dan validasi sesuai policy |
| Progres semester | Sesi tervalidasi yang terikat assignment semester tersebut |
| Progres siklus | Agregat sesi valid dari seluruh assignment dalam pendaftaran/siklus yang sama |
| Readiness bimbingan | Fakta minimum dan persetujuan pembimbing; belum sama dengan verified pendadaran |

### 6.2 Invariant bimbingan

1. Bimbingan baru wajib mempunyai mahasiswa, siklus, target assignment/member, dan effective reviewer assignment/member.
2. Mahasiswa pada bimbingan harus sama dengan mahasiswa pada assignment dan pendaftaran.
3. Assignment harus aktif serta termasuk dalam siklus mahasiswa ketika permohonan dibuat.
4. Target member harus active dan berurutan 1 atau 2.
5. target_dosen_id harus sama dengan dosen milik target member.
6. Target assignment/member, peran awal, semester, jalur, dan siklus tidak berubah setelah create.
7. Effective reviewer assignment/member dapat berubah hanya melalui GuidanceReviewerTransfer yang teraudit.
8. Queue mutasi dosen hanya berasal dari reviewer efektif, bukan cache mahasiswa.
9. Dosen yang tidak boleh melanjutkan bimbingan lama tidak dapat membuat keputusan baru.
10. Sesi yang sudah sah tidak dihapus ketika assignment berakhir.
11. Pergantian dalam siklus sama mempertahankan sesi valid.
12. Ulang/alih membuat pendaftaran baru sehingga progres mulai dari scope baru.
13. Perpindahan semester membuat assignment baru; sesi baru terikat ke assignment baru.
14. P2 tidak dibuat/dipaksa bila assignment hanya mempunyai P1.
15. Counted tidak dapat true sebelum resume/occurrence divalidasi.
16. Revisi resume tidak menghapus versi sebelumnya.
17. Semua aggregate baru mempunyai row_version dan seluruh update memakai optimistic precondition.
18. Satu action dosen hanya menghasilkan satu transition, audit, dan notifikasi utama.
19. Aksi kedua dengan idempotency key dan fingerprint sama mengembalikan hasil pertama melalui GuidanceCommandReceipt.
20. Aksi kedua dengan key sama tetapi payload berbeda menghasilkan 409 IDEMPOTENCY_CONFLICT.
21. Sekretaris Prodi hanya dapat membaca histori akademik; mutasi isi bimbingan hanya jika identitasnya juga merupakan dosen target yang sah.

### 6.3 State permohonan

State permohonan kanonik:

| State | Makna | Transisi yang diperbolehkan |
| --- | --- | --- |
| pending | menunggu dosen tujuan | accepted, rescheduled, rejected, withdrawn, cancelled_supervisor_change |
| accepted | jadwal diterima tanpa perubahan | resume dapat dikirim setelah waktu sesi |
| rescheduled | jadwal diubah dan diterima dosen | resume dapat dikirim setelah waktu sesi |
| rejected | ditolak dengan alasan | terminal |
| withdrawn | ditarik mahasiswa sesuai aturan | terminal |
| cancelled_supervisor_change | dibatalkan karena reviewer/assignment berakhir | terminal; mahasiswa membuat request baru |

Status expired legacy dipetakan menjadi withdrawn dengan reason schedule_passed. Jangan menambah makna baru melalui label UI saja.

### 6.4 State resume

| State | Makna |
| --- | --- |
| not_submitted | belum ada versi resume |
| submitted | versi terbaru menunggu reviewer efektif |
| revision_required | reviewer meminta revisi |
| approved | versi tertentu divalidasi reviewer efektif |
| invalidated | approval lama tidak lagi berlaku karena koreksi administratif yang sah |

Reject resume akademik diperlakukan sebagai revision_required kecuali aturan bisnis kelak menetapkan penolakan terminal. Setiap submit/revisi menghasilkan GuidanceResumeVersion baru.

### 6.5 Fakta counted

Satu sesi dihitung jika seluruh kondisi policy terpenuhi, minimal:

- berada pada siklus yang dievaluasi;
- status permohonan accepted atau rescheduled;
- waktu sesi telah terjadi;
- mempunyai resume version approved;
- approval dilakukan reviewer efektif yang sah;
- tidak invalidated;
- tidak merupakan duplikat sesi.

GuidanceProgressService menghasilkan:

- counted;
- not_counted_reason_codes;
- target_assignment_id;
- effective_reviewer_assignment_id;
- semester_penjaluran_ke;
- cycle_registration_id;
- policy_id dan policy_version;
- evaluator_version;
- evaluated_at.

Hasil tersebut selalu dipersist sebagai GuidanceProgressEvaluation. GuidanceProgressSnapshot hanya mengagregasi evaluation aktif dalam scope policy yang sama.

Reason code minimum:

- REQUEST_NOT_ACCEPTED;
- SESSION_NOT_OCCURRED;
- RESUME_NOT_SUBMITTED;
- RESUME_NOT_APPROVED;
- REVIEWER_NOT_AUTHORIZED;
- WRONG_CYCLE;
- INVALIDATED;
- DUPLICATE_SESSION;
- LEGACY_CONTEXT_AMBIGUOUS.

## 7. Kontrak data target

### 7.1 Penguatan BimbinganSkripsi

Tambahkan atau normalkan:

- pendaftaran_penjaluran_id, wajib untuk row baru;
- penetapan_pembimbing_id dipertahankan sebagai alias kompatibilitas assignment asal selama migrasi;
- target_assignment_id, wajib untuk row baru dan immutable;
- target_assignment_member_id, wajib untuk row baru;
- target_dosen_id atau pertahankan dosen_id sebagai immutable target awal;
- target_urutan_snapshot: 1 atau 2;
- effective_reviewer_assignment_id, wajib untuk row baru;
- effective_reviewer_assignment_member_id;
- periode_akademik_id;
- semester_penjaluran_ke_snapshot;
- jalur_snapshot;
- cycle_type_snapshot: baru, ulang, atau alih;
- request_status kanonik;
- request_decided_at;
- scheduled_at dengan timezone yang jelas atau tanggal/jam tervalidasi;
- occurred_at, nullable;
- occurrence_source;
- cancelled_at dan cancellation_reason_code;
- current_resume_version_id;
- progress_policy_id;
- legacy_context_status: resolved, ambiguous, excluded;
- row_version, wajib untuk seluruh write path baru dan dinaikkan pada setiap transition;
- created command receipt/correlation reference bila diperlukan untuk tracing.

target_assignment_id serta target_assignment_member_id selalu menunjuk penugasan asal dan tidak berubah ketika pembimbing atau semester berganti. effective_reviewer_assignment_id serta effective_reviewer_assignment_member_id menunjukkan kewenangan proses saat ini dan boleh berubah hanya melalui GuidanceReviewerTransfer. Foreign key member harus konsisten dengan assignment pasangannya. Tambahkan constraint/check bahwa snapshot semester positif dan target urutan hanya 1/2.

### 7.2 GuidanceReviewerTransfer

Entitas append-only ini membuktikan perpindahan kewenangan tanpa mengubah assignment asal:

- guidance_id;
- from_assignment_id;
- from_assignment_member_id;
- to_assignment_id;
- to_assignment_member_id;
- transition_type: supervisor_replacement, semester_transition, atau manual_resolution;
- reason_code;
- effective_at;
- transferred_by_actor_type;
- transferred_by_actor_id;
- event_id;
- correlation_id;
- row_version_before dan row_version_after.

Setelah transfer tersimpan, BimbinganSkripsi memperbarui effective reviewer pair ke tujuan transfer dalam transaksi yang sama. target assignment pair tidak pernah diperbarui. Transfer chain harus dapat direkonstruksi dari assignment/member asal hingga reviewer efektif terakhir.

### 7.3 GuidanceResumeVersion

Field minimum:

- guidance_id;
- version_number;
- resume_text;
- submitted_by_mahasiswa_id;
- submitted_at;
- status;
- reviewed_by_assignment_member_id;
- reviewed_by_dosen_id;
- reviewed_at;
- review_note;
- invalidated_at/by/reason;
- previous_version_id;
- content_hash;
- idempotency key/fingerprint.

Unique guidance_id + version_number. Satu guidance hanya boleh mempunyai satu versi current, tetapi seluruh versi lama tetap tersimpan.

### 7.4 GuidanceEvent

Append-only event minimum:

- guidance_id;
- event_type;
- actor_type dan actor_id;
- actor_role;
- from_state dan to_state;
- assignment/member context;
- occurred_at;
- correlation_id;
- idempotency_key;
- before/after metadata teredaksi;
- reason_code dan catatan bila relevan.

Event type minimum:

- request_created;
- request_accepted;
- request_rescheduled;
- request_rejected;
- request_withdrawn;
- request_cancelled_supervisor_change;
- resume_submitted;
- resume_revision_requested;
- resume_approved;
- resume_invalidated;
- reviewer_transferred;
- progress_evaluated;
- readiness_requested;
- readiness_approved;
- readiness_rejected;
- readiness_invalidated.

### 7.5 GuidanceRequirementPolicy

Konfigurasi berversi:

- program studi;
- program_kuliah;
- jalur;
- periode akademik atau effective range;
- version dan status draft/active/retired;
- minimum_validated_sessions;
- count_scope: cycle atau semester;
- occurrence_proof_mode;
- supervisor_approval_scope: p1 atau all_active_supervisors;
- apakah P2 diperlukan untuk readiness jika P2 tersedia;
- effective_at dan retired_at;
- created/approved by;
- decision reference dan audit.

Precedence konfigurasi wajib deterministik:

1. program studi + program_kuliah + jalur + periode akademik;
2. program studi + program_kuliah + jalur;
3. fallback global yang telah disahkan.

Tidak boleh fallback dari program reguler ke internasional atau sebaliknya. Dua policy aktif yang sama kuat harus ditolak constraint/service.

Perubahan policy tidak boleh diam-diam mengubah pengajuan readiness yang sudah diputus. Readiness menyimpan policy snapshot/version.

### 7.6 GuidanceProgressEvaluation

Setiap evaluasi satu sesi disimpan sebagai bukti detail:

- guidance_id;
- resume_version_id;
- policy_id;
- policy_version_snapshot;
- cycle_registration_id;
- periode_akademik_id;
- counted;
- reason_codes dalam bentuk array/JSON reason code terkontrol;
- evaluated_at;
- evaluator_version;
- superseded_at.

Satu evaluation aktif mewakili hasil terbaru untuk kombinasi guidance, resume version, cycle, dan policy version. Evaluasi ulang tidak menimpa row lama: row lama diberi superseded_at dan row baru dibuat. reason_codes kosong hanya jika counted true. Evaluasi wajib dapat direproduksi dari data sumber dan evaluator_version.

### 7.7 GuidanceProgressSnapshot

Snapshot opsional tetapi direkomendasikan untuk audit/performa:

- mahasiswa;
- cycle registration;
- semester assignment bila scope semester;
- policy/version;
- counted total;
- required total;
- remaining total;
- status insufficient/sufficient;
- reason summary;
- source watermark;
- calculated_at.

Snapshot bukan sumber mutasi manual. Service dapat menghitung ulang dari session/resume/event dan mendeteksi stale watermark.

GuidanceProgressSnapshot merupakan agregat dari GuidanceProgressEvaluation aktif, bukan pengganti bukti evaluasi per sesi.

### 7.8 GuidanceReadinessRequest

Field minimum:

- mahasiswa_id;
- pendaftaran_penjaluran_id;
- active_assignment_id;
- policy_id/version snapshot;
- counted_snapshot;
- status draft, waiting_supervisor, supervisor_approved, supervisor_rejected, invalidated, forwarded_to_verification;
- requested_at;
- forwarded_at;
- invalidation reason;
- idempotency key/fingerprint.

### 7.9 GuidanceReadinessApproval

Satu row per assignment member yang diwajibkan policy:

- readiness_request_id;
- assignment_member_id;
- urutan/peran snapshot;
- requirement status required/optional;
- decision pending/approved/rejected;
- note;
- decided_at;
- assignment/status snapshot;
- idempotency key.

Jangan menyimpan p1_approved dan p2_approved sebagai dua kolom tetap karena P2 opsional dan approval scope belum final.

### 7.10 GuidanceReadinessFact

Kontrak fakta immutable/versioned yang dikonsumsi Tahap 8:

- readiness_request_id;
- mahasiswa_id;
- pendaftaran_penjaluran_id;
- policy_id;
- policy_version_snapshot;
- counted_snapshot;
- required_snapshot;
- approval_snapshot;
- status: valid atau invalidated;
- fact_version;
- issued_at;
- invalidated_at;
- invalidation_reason;
- checksum.

Unique readiness_request_id + fact_version. approval_snapshot hanya memuat fakta keputusan minimum yang diperlukan, bukan catatan akademik sensitif. Checksum dihitung dari canonical payload field fakta dan dipakai untuk mendeteksi perubahan/korupsi, bukan sebagai pengganti signature otorisasi.

Tahap 8 menyimpan fact ID, version, dan checksum yang dievaluasi. Ketika invalidation terjadi, Tahap 7 menerbitkan versi fakta baru berstatus invalidated dan event/outbox sehingga Tahap 8 dapat menandai hasilnya stale/hold. Fakta lama tidak dihapus.

### 7.11 GuidanceCommandReceipt

Tabel umum untuk retry mutasi:

- actor_type;
- actor_id;
- operation;
- idempotency_key;
- request_fingerprint;
- status: processing, completed, atau failed_retryable;
- aggregate_type;
- aggregate_id;
- response_status;
- response_payload_minimal;
- completed_at;
- expires_at/retention metadata.

Unique actor_type + actor_id + operation + idempotency_key. Receipt dibuat/claim dalam transaksi mutation. Exact retry setelah commit mengembalikan response_status dan response_payload_minimal yang sama. Payload minimal tidak menyimpan resume, catatan sensitif, token, atau response besar.

Jika receipt masih processing, request lain tidak menjalankan command kedua dan mengembalikan status retry yang stabil. Key sama dengan fingerprint berbeda menghasilkan IDEMPOTENCY_CONFLICT. Receipt gagal sebelum commit ikut rollback; kegagalan mengirim response setelah commit tidak membatalkan hasil dan retry membaca receipt completed.

## 8. Aturan otorisasi

### 8.1 Mahasiswa

Mahasiswa dapat:

- melihat seluruh histori miliknya;
- membuat request hanya pada assignment aktif dan target P1/P2 aktif;
- menarik request pending sesuai aturan;
- mengirim/memperbaiki resume miliknya setelah sesi dapat diisi;
- meminta readiness untuk siklus aktif jika minimum policy terpenuhi.

Mahasiswa tidak dapat:

- mengganti assignment/member/siklus pada row;
- menandai sesi counted;
- menyetujui resume sendiri;
- mengubah histori semester/siklus lama;
- memilih dosen dari cache legacy bila assignment aktif tersedia.

### 8.2 Dosen

Dosen dapat memutasi row hanya jika:

- identitas dosen terhubung eksplisit ke akun login;
- row.effective_reviewer_assignment_member_id menunjuk membership miliknya;
- membership dan assignment memenuhi policy akses saat action;
- status master mengizinkan melanjutkan bimbingan;
- state row menerima action tersebut.

Dosen lama kehilangan hak mutasi setelah reviewer transfer efektif, walaupun dosen_id awal masih menyimpan identitasnya.

### 8.3 Sekretaris Prodi

Sekretaris Prodi dapat:

- melihat ringkasan progres melalui `Mahasiswa Bimbingan`;
- melihat timeline melalui `Riwayat Bimbingan`;
- memperbaiki pembimbing melalui workflow pergantian pembimbing yang sudah ada.

Sekretaris Prodi tidak mengelola policy, memilih reviewer efektif, menginvalidasi approval resume, mengubah resume, menyetujui sesi, atau mengesahkan resume atas nama pembimbing. Jika orang yang sama juga dosen target, akses mutasi berasal dari relasi dosen dan membership, bukan role Sekretaris Prodi.

## 9. Workflow target

### 9.1 Membuat permohonan

1. Mahasiswa mengirim target_assignment_member_id, pesan, tanggal, jam, timezone, dan idempotency key.
2. Service mengunci mahasiswa, pendaftaran aktif, assignment aktif, dan membership target.
3. Validasi akses bimbingan mahasiswa serta status dosen.
4. Validasi assignment, pendaftaran, semester, dan jalur konsisten.
5. Validasi jadwal tidak lampau dan tidak bentrok/duplikat sesuai policy.
6. Simpan request beserta snapshot context dan row_version 1.
7. Set target_assignment_id/effective_reviewer_assignment_id ke assignment aktif yang sama serta target/effective member ke membership pilihan yang sama.
8. Buat event dan notifikasi dosen dalam transaksi yang sama.
9. Commit dan kembalikan kontrak canonical.

### 9.2 Dosen menerima atau reschedule

1. Kunci guidance row dan reviewer member.
2. Verifikasi effective reviewer adalah dosen login.
3. Verifikasi state masih pending dan dosen boleh melanjutkan.
4. Validasi tanggal, jam, lokasi/media, dan catatan.
5. Jika jadwal berubah, state menjadi rescheduled; jika sama menjadi accepted.
6. Simpan event serta notifikasi mahasiswa secara atomik.
7. Exact retry mengembalikan hasil sebelumnya.

### 9.3 Dosen menolak

Penolakan hanya dari pending, alasan wajib, bersifat terminal untuk request tersebut, dan tidak menghapus hak mahasiswa membuat request baru selama assignment masih aktif.

### 9.4 Mahasiswa menarik permohonan

Aturan awal mempertahankan perilaku sekarang: request pending dapat ditarik setelah jadwal yang diminta terlewati. Bila pemilik bisnis menghendaki penarikan sebelum diproses, BR-BIMBINGAN harus diperbarui terlebih dahulu.

Withdraw menyimpan aktor, waktu, reason, event, dan notifikasi. Field akademik yang sudah sah tidak dihapus.

### 9.5 Submit dan revisi resume

1. Request harus accepted/rescheduled dan waktu sesi sudah dimulai.
2. Mahasiswa membuat GuidanceResumeVersion baru.
3. Versi lama tidak diubah.
4. Current version menjadi submitted dan counted menjadi false/hasil evaluator not ready.
5. Reviewer efektif menerima notifikasi.
6. Revisi setelah revision_required membuat nomor versi berikutnya.

### 9.6 Review resume

1. Reviewer efektif mengunci guidance dan current resume version.
2. Reviewer hanya dapat approve atau meminta revisi.
3. Approval menandai version approved, occurred_at sesuai policy, dan menjalankan progress evaluator.
4. Revision request menyimpan note wajib dan tidak menghapus versi.
5. GuidanceProgressEvaluation, aggregate snapshot, event, dan notifikasi dibuat dalam transaksi.
6. Aksi paralel hanya menghasilkan satu keputusan.

### 9.7 Pergantian pembimbing dalam siklus sama

Dalam transaksi aktivasi assignment pengganti:

1. kunci assignment lama/baru dan guidance terkait;
2. sesi yang sudah tervalidasi tetap utuh dan tetap dihitung pada siklus;
3. pending atau jadwal mendatang tanpa resume dibatalkan dengan cancelled_supervisor_change;
4. resume submitted/revision_required yang sesinya sudah terjadi dipindahkan ke replacement member dengan urutan/peran sama;
5. P1 lama dipindahkan ke P1 baru dan P2 lama ke P2 baru;
6. jika peran pengganti tidak tersedia, pilih P1 aktif pada assignment baru sebagai fallback deterministik dengan reason `cross_role_system_fallback`;
7. jika P1 aktif juga belum tersedia, row menjadi `waiting_for_active_reviewer`; worker mengulang resolusi setelah assignment diperbaiki melalui flow pergantian pembimbing;
8. target awal tidak ditimpa; hanya effective reviewer yang berubah;
9. buat GuidanceReviewerTransfer dari assignment/member lama ke assignment/member baru;
10. update effective reviewer pair, event, assignment transition, notifikasi, dan audit dibuat atomik.

Setelah transfer, dosen lama hanya dapat melihat histori sesuai policy dan tidak dapat melakukan mutasi.

### 9.8 Pergantian semester

- assignment semester baru menjadi target request baru;
- bimbingan lama tetap menunjuk assignment semester asal;
- tampilan menyediakan progres per semester;
- agregat siklus dapat menggabungkan semester jika policy count_scope adalah cycle;
- assignment semester lama yang ended tidak menerima request baru;
- carry-forward pembimbing tidak menyalin row bimbingan.

Pada saat assignment semester baru efektif, transition service juga mengklasifikasikan pekerjaan semester lama:

1. sesi yang sudah mempunyai resume approved tetap selesai pada semester asal;
2. sesi yang sudah terjadi dengan resume submitted/revision_required tetap pada semester asal, tetapi effective reviewer dapat dipetakan ke membership baru dengan peran sama agar penyelesaian tidak buntu;
3. request pending atau jadwal pada/setelah batas semester baru dibatalkan dengan reason semester_transition dan mahasiswa membuat request baru pada assignment baru;
4. request tidak boleh dipindahkan dengan mengubah semester snapshot atau assignment asal;
5. bila batas efektif semester atau mapping reviewer ambigu, resolver memakai member dengan peran sama lalu P1 aktif sebagai fallback; bila assignment belum lengkap, row menunggu assignment aktif dan tidak dihitung.

Pemetaan pada butir 2 wajib membuat GuidanceReviewerTransfer berjenis semester_transition. target assignment/member tetap menunjuk semester asal, sedangkan effective reviewer assignment/member menunjuk assignment semester baru.

Aturan tanggal batas menggunakan PeriodeAkademik kanonik, bukan tanggal buka/tutup PeriodePenjaluran.

### 9.9 Ulang atau alih

- pendaftaran baru menjadi cycle ID baru;
- request baru tidak dapat menunjuk assignment/siklus lama;
- progres siklus baru dimulai dari scope baru;
- histori lama tetap terlihat dengan label jalur dan cycle outcome;
- tidak ada update massal yang memindahkan bimbingan lama ke pendaftaran baru;
- evaluator Tahap 8 hanya menerima progress fact untuk cycle yang diajukan.

### 9.10 Readiness bimbingan

1. Mahasiswa meminta readiness untuk siklus aktif.
2. Service menghitung ulang progres menggunakan policy aktif.
3. Jika minimum belum terpenuhi, request ditolak dengan daftar kekurangan terstruktur.
4. Jika cukup, buat GuidanceReadinessRequest dan required approval rows berdasarkan policy snapshot.
5. Pembimbing yang diwajibkan memberi approve/reject dengan catatan.
6. Setelah seluruh approval wajib terpenuhi, status menjadi supervisor_approved.
7. Service menerbitkan GuidanceReadinessFact versi baru, lengkap dengan checksum, untuk Tahap 8.
8. Tahap 8 tetap memeriksa akademik, CEPT, dokumen, dan persyaratan lain.

Jika approval scope belum disahkan, endpoint readiness tetap feature-off atau shadow dan tidak boleh menjadi gate penjadwalan.

### 9.11 Invalidation readiness

Readiness yang sudah dibuat perlu dievaluasi ulang jika:

- approval resume yang counted di-invalidasi;
- policy berubah sebelum readiness diputus dan kebijakan menyatakan harus re-evaluate;
- cycle/assignment tidak lagi aktif karena ulang/alih/pamit;
- supervisor approval dibatalkan melalui prosedur sah;
- ditemukan duplikasi atau backfill yang salah.

Invalidation tidak menghapus keputusan lama. Buat GuidanceReadinessFact versi berikutnya berstatus invalidated, event, reason, waktu, aktor, notifikasi/outbox, dan beri tahu Tahap 8 agar status downstream menjadi stale/hold sesuai kontraknya.

## 10. Service target

### 10.1 GuidanceContextService

Tanggung jawab:

- resolve current cycle dan assignment;
- resolve target P1/P2;
- memvalidasi konsistensi mahasiswa, pendaftaran, periode, semester, jalur;
- menghasilkan immutable snapshot;
- tidak menggunakan cache dosen_pembimbing_skripsi_id jika histori assignment tersedia.

### 10.2 GuidanceAuthorizationService

Tanggung jawab:

- canCreateRequest;
- canViewGuidance;
- canMutateRequest;
- canSubmitResume;
- canReviewResume;
- canDecideReadiness;
- explain denial dengan code stabil.

### 10.3 GuidanceWorkflowService

Semua mutation controller menjadi adapter tipis ke service:

- createRequest;
- acceptOrReschedule;
- rejectRequest;
- withdrawRequest;
- submitResumeVersion;
- reviewResumeVersion;
- transferReviewer;
- invalidateResumeApproval.

### 10.4 GuidanceProgressService

Satu-satunya evaluator minimum bimbingan untuk:

- halaman bimbingan;
- monitoring dosen/Sekretaris Prodi;
- upload dokumen;
- sidang akhir;
- GuidanceReadinessRequest;
- Tahap 8.

Controller tidak boleh mempunyai konstanta minimum sendiri.

### 10.5 GuidanceReadinessService

Tanggung jawab:

- request readiness;
- resolve policy;
- membuat required approval rows;
- menerima keputusan pembimbing;
- invalidate/re-evaluate;
- menerbitkan fact untuk Tahap 8.

### 10.6 GuidanceAuditNotificationService

Membuat event dan notifikasi di transaction yang sama. Jika pengiriman eksternal digunakan, simpan outbox dalam transaksi dan kirim setelah commit.

## 11. Kontrak API target

### 11.1 Mahasiswa

| Method | Endpoint | Fungsi |
| --- | --- | --- |
| GET | /api/mahasiswa/bimbingan/context | assignment, P1/P2, cycle, semester, policy, capability |
| GET | /api/mahasiswa/bimbingan | timeline dengan filter cycle/semester |
| POST | /api/mahasiswa/bimbingan | membuat request idempotent |
| POST | /api/mahasiswa/bimbingan/:id/withdraw | menarik request |
| POST | /api/mahasiswa/bimbingan/:id/resume-versions | submit/revisi resume |
| GET | /api/mahasiswa/bimbingan/progress | progres semester dan siklus |
| POST | /api/mahasiswa/bimbingan/readiness | meminta readiness |
| GET | /api/mahasiswa/bimbingan/readiness/current | status dan approval |

### 11.2 Dosen

| Method | Endpoint | Fungsi |
| --- | --- | --- |
| GET | /api/dosen/bimbingan/tasks | hanya antrean kewenangan |
| GET | /api/dosen/bimbingan/history | histori read-only sesuai scope |
| GET | /api/dosen/bimbingan/:id | detail dengan capability |
| POST | /api/dosen/bimbingan/:id/accept | menerima/reschedule |
| POST | /api/dosen/bimbingan/:id/reject | menolak request |
| POST | /api/dosen/bimbingan/:id/resume-versions/:version/decision | approve/revisi |
| GET | /api/dosen/bimbingan/readiness/tasks | approval readiness wajib |
| POST | /api/dosen/bimbingan/readiness/:id/decision | keputusan readiness |

### 11.3 Sekretaris Prodi

Tidak ada API khusus halaman tata kelola. Halaman `Mahasiswa Bimbingan` dan `Riwayat Bimbingan` memakai endpoint existing untuk summary/detail read-only. Mutasi assignment tetap melalui API pergantian pembimbing Tahap 1/4. Endpoint publik pembuatan/aktivasi/retire policy, pemilihan reviewer manual, dan invalidasi approval resume tidak menjadi bagian kontrak UI.

Seluruh mutating endpoint baru wajib menerima Idempotency-Key. Seluruh update aggregate yang sudah ada wajib menerima expected_version atau If-Match yang dibandingkan dengan row_version; create menginisialisasi row_version = 1. Mutation tanpa precondition ditolak, kecuali create aggregate baru. Setiap command memakai GuidanceCommandReceipt. Error code minimum:

- GUIDANCE_ASSIGNMENT_REQUIRED;
- GUIDANCE_TARGET_NOT_ACTIVE;
- GUIDANCE_TARGET_MISMATCH;
- GUIDANCE_REVIEWER_NOT_AUTHORIZED;
- GUIDANCE_WRONG_CYCLE;
- GUIDANCE_WRONG_SEMESTER;
- GUIDANCE_STATE_CONFLICT;
- GUIDANCE_DUPLICATE_SLOT;
- GUIDANCE_REPLACEMENT_PENDING;
- GUIDANCE_REVIEWER_RESOLUTION_REQUIRED;
- GUIDANCE_POLICY_NOT_FOUND;
- GUIDANCE_MINIMUM_NOT_MET;
- GUIDANCE_READINESS_POLICY_PENDING;
- GUIDANCE_VERSION_CONFLICT;
- GUIDANCE_COMMAND_IN_PROGRESS;
- IDEMPOTENCY_CONFLICT.

## 12. Paket pengerjaan

### Paket 0 — Kunci keputusan dan baseline

1. Catat keputusan count_scope dan supervisor_approval_scope yang masih menunggu.
2. Inventaris seluruh endpoint, query progres, cache supervisor, konstanta 8, dan consumer readiness.
3. Tambahkan characterization test terhadap flow sekarang.
4. Ambil baseline jumlah row, null foreign key, status, is_counted, duplicate slot, dan reviewer transfer.
5. Petakan account Sekretaris Prodi ke dosen tanpa fallback jabatan.
6. Putuskan occurrence proof mode.

Hasil: perubahan selanjutnya dapat dibandingkan dan tidak mengubah aturan yang belum final secara diam-diam.

### Paket 1 — Migration additive

1. Tambahkan kolom konteks pada BimbinganSkripsi.
2. Buat GuidanceReviewerTransfer, GuidanceResumeVersion, GuidanceEvent, GuidanceRequirementPolicy, GuidanceProgressEvaluation, GuidanceProgressSnapshot, GuidanceReadinessRequest, GuidanceReadinessApproval, GuidanceReadinessFact, dan GuidanceCommandReceipt.
3. Tambahkan foreign key RESTRICT/SET NULL sesuai kebutuhan histori.
4. Tambahkan unique/index untuk:
   - guidance + resume version;
   - active policy scope;
   - readiness + assignment member;
   - readiness fact + fact version;
   - active progress evaluation per guidance/resume/policy/cycle;
   - reviewer transfer chain;
   - idempotency key + actor + operation;
   - target/effective reviewer task queue;
   - cycle + semester + progress query.
5. Pertahankan kolom legacy selama dual-read/write.

### Paket 2 — Backfill dan klasifikasi data lama

Backfill berurutan:

1. dari penetapan_pembimbing_id yang valid;
2. dari pendaftaran_penjaluran_id dan assignment semester yang rentang waktunya mencakup sesi;
3. dari pengajuan yang terikat pendaftaran;
4. dari histori assignment mahasiswa+dosen+tanggal;
5. fallback cache hanya untuk row sebelum histori tersedia dan harus diberi source legacy.

Mapping status legacy wajib menggunakan tabel berikut pada migration, adapter API, dan frontend compatibility layer:

| Status lama | Status baru |
| --- | --- |
| request approved | accepted |
| request expired | withdrawn + reason_code schedule_passed |
| resume belum_diisi | not_submitted |
| resume submitted | submitted |
| resume revisi | revision_required |
| resume rejected | revision_required sementara |

Nilai rescheduled, rejected request, dan cancelled_supervisor_change tetap dipetakan ke state kanonik yang ekuivalen. Mapping hanya dilakukan oleh satu compatibility module agar migration, response lama, dan frontend tidak mempunyai kamus berbeda. Resume rejected bersifat revision_required sementara sampai aturan bisnis menetapkan penolakan terminal.

Setiap row memperoleh:

- resolved;
- ambiguous;
- excluded.

Row ambiguous tidak dihitung sampai diselesaikan. Script mendukung dry-run, report, execute, resume, checksum, dan rerun idempotent. Jangan memindahkan row ke siklus terbaru hanya karena itu satu-satunya siklus aktif sekarang.

### Paket 3 — Context dan authorization service

1. Buat resolver context tunggal.
2. Ganti query antrean dosen agar hanya effective reviewer masuk task queue.
3. Pisahkan task access dan history view access.
4. Hapus legacy fallback dari mutating authorization.
5. Gunakan relasi identitas eksplisit untuk Sekretaris Prodi/dosen.
6. Tambahkan authorization matrix tests.

### Paket 4 — Workflow permohonan

1. Pindahkan create/accept/reschedule/reject/withdraw ke service.
2. Simpan snapshot context dan target member.
3. Terapkan GuidanceCommandReceipt, Idempotency-Key, serta row_version/expected_version wajib.
4. Simpan event/notifikasi transaksional.
5. Normalisasi expired legacy menjadi withdrawn + reason.
6. Pertahankan adapter endpoint lama selama frontend migrasi.

### Paket 5 — Resume versioning dan progress evaluator

1. Backfill resume lama menjadi version 1.
2. Pindahkan submit/review ke GuidanceResumeVersion.
3. Jadikan is_counted field kompatibilitas/read model, bukan input mutasi.
4. Implementasikan evaluator dengan reason code dan simpan setiap hasil pada GuidanceProgressEvaluation.
5. Migrasikan tiga konstanta minimum ke policy service.
6. Bandingkan evaluator baru dengan hasil lama dalam shadow mode.
7. Putuskan constraint final setelah mismatch terselesaikan.

### Paket 6 — Integrasi pergantian pembimbing

1. Refactor handleGuidanceAfterSupervisorReplacement ke transferReviewer dan GuidanceReviewerTransfer append-only.
2. Cocokkan pengganti berdasarkan urutan/peran, bukan selalu P1.
3. Batalkan pending/future request secara atomik.
4. Pertahankan sesi validated.
5. Transfer submitted/revision_required dengan event dan notification.
6. Terapkan fallback P1 aktif dan `waiting_for_active_reviewer` bila assignment belum lengkap; tidak membuat antrean keputusan reviewer manual.
7. Pastikan dosen lama tidak dapat mutate setelah commit.
8. Uji rollback aktivasi assignment jika transfer/event/notifikasi gagal.

### Paket 7 — Policy minimum dan progres

1. Hapus UI konfigurasi policy; seed/migrasikan policy berversi melalui release teruji.
2. Definisikan precedence program studi, program_kuliah, jalur, dan periode.
3. Sajikan progres semester serta siklus.
4. Migrasikan BimbinganPage, monitoring dosen, dokumen sidang, dan sidang akhir ke service yang sama.
5. Tolak policy seed/activation yang ambigu atau tumpang tindih pada startup/migration validation.
6. Audit perubahan policy berdasarkan deployment/migration reference.

Nilai 8 dapat dimigrasikan sebagai policy legacy awal agar perilaku tidak berubah, tetapi harus diberi source dan tidak dianggap keputusan final baru.

### Paket 8 — Workflow readiness bimbingan

1. Implementasikan request dan approval rows.
2. Gunakan policy snapshot.
3. Feature-off bila approval scope belum final.
4. Implementasikan invalidation/re-evaluation.
5. Terbitkan GuidanceReadinessFact/version/checksum untuk Tahap 8.
6. Jangan langsung menandai verified pendadaran atau menjadwalkan sidang.

### Paket 9 — Audit, notifikasi, dan outbox

1. Definisikan event type dan recipient.
2. Gunakan notification reference ke guidance/readiness.
3. Deduplicate berdasarkan event + recipient.
4. Jangan masukkan isi resume penuh/catatan sensitif pada notifikasi.
5. Sediakan deep link ke objek.
6. Buat monitoring notification/outbox failure.

### Paket 10 — Frontend

Mahasiswa:

- context card siklus/jalur/semester;
- dropdown P1/P2 dengan peran dan status;
- timeline per semester;
- progress cycle dan semester;
- histori versi resume;
- alasan sesi tidak dihitung;
- status reviewer transfer;
- readiness dan daftar approval bila feature aktif.

Dosen:

- task queue yang benar-benar actionable;
- tab history terpisah;
- label P1/P2, semester, jalur, dan target awal/effective reviewer;
- warning optimistic concurrency;
- version comparison resume;
- readiness task hanya jika diwajibkan policy.

Sekretaris Prodi tidak mempunyai halaman frontend baru. Ringkasan progres tetap berada pada `Mahasiswa Bimbingan`, histori pada `Riwayat Bimbingan`, dan pergantian pembimbing pada flow tindak lanjut yang sudah ada. Menu `Tata Kelola Bimbingan`, tab policy, queue reviewer manual, dan tombol invalidasi approval dihapus.

### Paket 11 — Rekonsiliasi dan constraint final

Deteksi:

- row tanpa cycle/assignment/member;
- target assignment/member berubah dari histori asal;
- effective reviewer assignment/member tidak konsisten;
- transfer reviewer tanpa GuidanceReviewerTransfer atau event;
- mahasiswa assignment berbeda;
- target dosen berbeda dari target member;
- reviewer efektif bukan anggota assignment sah;
- task dosen lama masih actionable;
- counted tanpa approved resume;
- counted/read model tanpa GuidanceProgressEvaluation aktif;
- lebih dari satu GuidanceProgressEvaluation aktif untuk scope yang sama;
- approved resume tanpa reviewer sah;
- cycle lama ikut progres aktif;
- duplicate slot/idempotency event;
- policy aktif tumpang tindih;
- readiness snapshot stale;
- GuidanceReadinessFact version/checksum tidak cocok dengan readiness;
- Tahap 8 masih memakai fact yang invalidated;
- command completed tanpa GuidanceCommandReceipt atau receipt tanpa aggregate;
- row_version null/tidak naik pada transition;
- event/notifikasi hilang;
- legacy cache digunakan untuk authorization.

Setelah laporan bersih, wajibkan foreign key untuk data baru dan hentikan dual-write/read legacy secara bertahap.

## 13. Strategi pengujian

### 13.1 Unit test

- context resolver baru/ulang/alih;
- assignment member P1/P2;
- state transition request/resume;
- policy precedence dan overlap;
- isolasi policy reguler dan internasional melalui program_kuliah;
- count scope cycle/semester;
- reason code evaluator;
- supersede GuidanceProgressEvaluation;
- reviewer replacement role mapping;
- idempotency fingerprint;
- GuidanceCommandReceipt lifecycle dan minimal response replay;
- readiness required approver resolver;
- GuidanceReadinessFact version/checksum/invalidation;
- notification recipient/deduplication.

### 13.2 Integration test mahasiswa

1. Mahasiswa tanpa assignment aktif ditolak.
2. Mahasiswa memilih P1 aktif.
3. Mahasiswa memilih P2 aktif.
4. Target bukan member assignment ditolak.
5. P2 tidak tersedia tidak menghasilkan pilihan palsu.
6. Dosen yang tidak boleh melanjutkan ditolak.
7. Request menyimpan cycle/semester/jalur, target assignment/member, dan effective reviewer assignment/member.
8. Duplicate exact request mengembalikan hasil sama.
9. Key sama payload berbeda menghasilkan conflict.
10. Resume sebelum waktu sesi ditolak.
11. Revisi membuat version baru.
12. Mahasiswa tidak dapat mengubah bimbingan mahasiswa lain.

### 13.3 Integration test dosen

1. Hanya reviewer efektif melihat task actionable.
2. Co-supervisor bukan target tidak dapat memproses.
3. Dosen lama tidak dapat memproses setelah transfer.
4. Dosen dengan status retired/ineligible ditolak.
5. Accept/reschedule/reject hanya dari pending.
6. Dua keputusan paralel hanya satu berhasil.
7. Exact retry tidak menggandakan event/notifikasi.
8. Retry setelah commit mengembalikan response pertama dari GuidanceCommandReceipt.
9. expected_version lama ditolak tanpa menjalankan mutation.
10. Approve resume menghasilkan GuidanceProgressEvaluation counted sesuai policy.
11. Revision request tidak menghapus versi/evaluation lama.
12. Sekretaris Prodi tanpa membership dosen tidak dapat bertindak.

### 13.4 Integration test siklus dan semester

1. Pergantian pembimbing satu siklus mempertahankan counted.
2. Pending/future request dosen lama dibatalkan.
3. Submitted resume ditransfer ke pengganti peran sama.
4. Transfer mempertahankan target assignment/member dan memperbarui effective reviewer assignment/member melalui GuidanceReviewerTransfer.
5. P2 pengganti tidak tersedia memakai P1 aktif sebagai fallback teraudit; jika assignment belum mempunyai P1 aktif, proses menunggu assignment diperbaiki tanpa pilihan reviewer manual.
6. Semester kedua membuat request pada assignment baru.
7. Pending/future request pada batas semester dibatalkan tanpa memindahkan snapshot semester.
8. Submitted resume semester lama dapat diselesaikan reviewer baru dengan peran sama dan transfer type semester_transition.
9. Progres semester terpisah.
10. Agregat siklus mengikuti count_scope.
11. Ulang memulai progres baru.
12. Alih tidak menghitung bimbingan jalur lama.
13. Backfill ambigu tidak dihitung.

### 13.5 Integration test policy/readiness

1. Policy exact dipilih deterministik.
2. Policy reguler tidak terpilih untuk program internasional dan sebaliknya.
3. Policy overlap ditolak.
4. Minimum belum cukup mengembalikan kekurangan.
5. Counted cukup membuat readiness.
6. Required approver mengikuti policy snapshot.
7. P2 opsional tidak membuat approval row palsu.
8. Approval scope yang belum final membuat feature tetap off/shadow.
9. Reject menyimpan note dan event.
10. Fakta valid mempunyai version/checksum stabil.
11. Fakta berubah menerbitkan versi invalidated tanpa menghapus versi lama.
12. Tahap 8 mendeteksi fact version/checksum stale.
13. Readiness tidak langsung menjadwalkan sidang.

### 13.6 Backfill/reconciliation test

- fixture assignment lengkap;
- assignment berganti pada tanggal sesi;
- semester carry-forward;
- ulang/alih;
- cache legacy saja;
- lebih dari satu kandidat assignment;
- rerun idempotent;
- mapping status legacy sama pada migration, API adapter, dan frontend;
- rollback batch;
- checksum dan report konsisten.

### 13.7 Frontend test

- dropdown hanya P1/P2 eligible;
- context jalur/semester terlihat;
- task dan history dosen terpisah;
- dosen tanpa capability tidak melihat tombol aksi;
- revision history tidak hilang;
- progress cycle/semester sesuai API;
- stale action menampilkan conflict dan refresh;
- status reviewer transfer jelas;
- Sekretaris Prodi read-only;
- readiness feature flag dihormati.

### 13.8 Security test

- horizontal access mahasiswa;
- dosen memalsukan guidance/member ID;
- Sekretaris Prodi memalsukan identitas dosen;
- replay/idempotency abuse;
- mass assignment terhadap cycle/assignment/count;
- race accept/reject/review;
- sensitive resume/catatan tidak masuk notifikasi/log;
- query task tidak membocorkan mahasiswa bukan kewenangan;
- endpoint lama tetap memakai authorization baru.
- write tanpa Idempotency-Key atau precondition version ditolak sesuai kontrak.

### 13.9 UAT minimum

1. Mahasiswa mengajukan ke P1.
2. Mahasiswa mengajukan ke P2.
3. Dosen menerima tanpa reschedule.
4. Dosen reschedule.
5. Dosen menolak.
6. Mahasiswa submit dan revisi resume.
7. Dosen approve resume dan progres bertambah.
8. Pergantian P1 dengan pending request.
9. Pergantian P2 dengan submitted resume.
10. Pergantian semester dengan komposisi sama.
11. Ulang dan alih dengan histori lama tetap terlihat.
12. Minimum berbeda menurut policy.
13. Readiness minimum belum cukup.
14. Readiness cukup dan approval sesuai keputusan final.
15. Sekretaris Prodi membaca histori tanpa mengubah isi.
16. Penelitian, Magang, dan Perintisan Bisnis menjalankan workflow baru.
17. Pengabdian hanya dapat dibaca dan tidak memperoleh create/readiness workflow baru.

## 14. Urutan implementasi

| Urutan | Pekerjaan | Dependensi | Risiko |
| --- | --- | --- | --- |
| 1 | Paket 0: keputusan, baseline, characterization | pemilik bisnis/akademik | Kritis |
| 2 | Paket 1: migration additive | Tahap 3–5 stabil | Kritis |
| 3 | Paket 2: backfill dry-run dan klasifikasi | schema baru | Kritis |
| 4 | Paket 3–4: context, authorization, request workflow | assignment history | Kritis |
| 5 | Paket 5: resume version dan evaluator shadow | workflow baru | Tinggi |
| 6 | Paket 6: replacement integration | service assignment | Kritis |
| 7 | Paket 7: policy/progress consumer migration | evaluator cocok | Kritis |
| 8 | Paket 8: readiness feature-off/shadow | keputusan approval scope | Tinggi |
| 9 | Paket 9–10: notifikasi dan frontend | API stabil | Tinggi |
| 10 | Paket 11: rekonsiliasi, constraint, legacy retirement | semua write path baru | Kritis |
| 11 | integration/security test, build, UAT | seluruh paket | Kritis sebelum rilis |

## 15. Strategi deployment

1. Backup database dan simpan baseline row/count per mahasiswa/siklus.
2. Deploy migration additive, termasuk assignment pair, reviewer transfer, progress evaluation, readiness fact, command receipt, serta row_version, tanpa mengubah perilaku lama.
3. Jalankan backfill dry-run, mapping status legacy, dan review row ambigu.
4. Deploy dual-read/write context, reviewer assignment pair, serta resume versions.
5. Aktifkan authorization baru untuk task queue lebih dahulu.
6. Jalankan progress evaluator dalam shadow mode, simpan GuidanceProgressEvaluation, dan bandingkan dengan tiga consumer lama.
7. Selesaikan mismatch; jangan enforce jika cycle lama masih ikut terhitung.
8. Aktifkan workflow request/resume baru, mandatory precondition version, serta GuidanceCommandReceipt.
9. Aktifkan replacement integration dan pantau `waiting_for_active_reviewer` serta fallback P1 otomatis.
10. Migrasikan frontend dan seluruh consumer minimum.
11. Aktifkan policy evaluator sebagai source of truth.
12. Aktifkan readiness dan GuidanceReadinessFact handoff hanya setelah approval/count scope disahkan; jika belum, pertahankan shadow.
13. Jalankan rekonsiliasi final dan pasang constraint untuk row baru.
14. Hentikan legacy fallback/cache sebagai sumber authorization.

Rollback tidak boleh menghapus resume versions, events, target/effective assignment reference, reviewer transfers, progress evaluations/snapshots, command receipts, atau readiness facts yang telah sah. Feature readiness dapat dimatikan tanpa menghidupkan kembali perhitungan lintas siklus atau akses dosen lama.

## 16. Observability dan runbook

Metric minimum:

- request created/accepted/rescheduled/rejected/withdrawn;
- resume submitted/revision/approved;
- counted dan not-counted per reason;
- task authorization denial;
- reviewer transfer dan unresolved reviewer;
- transfer chain/assignment pair mismatch;
- progress evaluation created/superseded;
- progress mismatch shadow vs legacy;
- policy resolution failure/overlap per program_kuliah;
- readiness requested/approved/rejected/invalidated;
- readiness fact issued/invalidated dan stale consumer;
- idempotency replay/conflict/command in progress;
- row version conflict;
- notification/outbox failure;
- legacy/ambiguous row count.

Alert minimum:

- dosen lama berhasil melakukan mutation setelah transfer;
- guidance baru tanpa assignment/member/cycle;
- target assignment berubah atau effective reviewer pair tidak konsisten;
- counted lintas siklus;
- counted tanpa approved resume/evaluation;
- policy aktif tumpang tindih;
- unresolved reviewer menumpuk;
- progress mismatch melewati ambang;
- readiness stale masih diterima Tahap 8;
- command completed tanpa receipt;
- notification utama gagal terus-menerus.

Runbook minimum:

- memperbaiki row backfill ambigu;
- salah pemetaan siklus/semester;
- reviewer pengganti tidak tersedia;
- memperbaiki transfer chain tanpa mengubah assignment asal;
- membatalkan approval resume secara sah;
- memperbaiki duplicate session;
- policy salah aktif;
- rebuild progress snapshot;
- supersede/rebuild progress evaluation;
- memulihkan receipt processing yang orphan tanpa menjalankan command ganda;
- invalidasi readiness dan sinkronisasi Tahap 8;
- rollback authorization tanpa membuka legacy bypass.

## 17. Definition of Done

Tahap 7 selesai apabila:

- setiap bimbingan baru terikat ke siklus, assignment, assignment member, semester, periode akademik, dan jalur;
- target assignment/member asal immutable dan terpisah dari effective reviewer assignment/member;
- setiap perpindahan reviewer mempunyai GuidanceReviewerTransfer append-only dan event;
- P1/P2 ditentukan dari assignment aktif, bukan cache mahasiswa;
- hanya reviewer efektif yang dapat memproses request/resume;
- dosen lama kehilangan hak mutasi setelah transfer;
- pending/future request dan resume belum selesai ditangani eksplisit saat pergantian;
- sesi tervalidasi tetap dihitung setelah pergantian dalam siklus sama;
- ulang/alih tidak mewarisi progres jalur lama;
- progres semester dan siklus dapat dijelaskan;
- minimum bimbingan berasal dari satu policy service berversi;
- tidak ada lagi konstanta minimum pada controller consumer;
- resume revisions dan keputusan tersimpan sebagai histori;
- setiap hasil counted/not-counted mempunyai GuidanceProgressEvaluation dengan policy snapshot, resume version, reason, evaluator version, dan waktu;
- snapshot progres hanya mengagregasi evaluation aktif dan dapat direkonstruksi;
- readiness menghasilkan GuidanceReadinessFact berversi/checksum tanpa melewati verifikasi Tahap 8;
- invalidation fakta diterbitkan sebagai versi baru dan dapat membuat consumer Tahap 8 stale/hold;
- approval scope yang belum final tidak diaktifkan secara diam-diam;
- Sekretaris Prodi memakai halaman progres/histori existing, tanpa halaman tata kelola dan bukan reviewer akademik otomatis;
- seluruh write path baru memakai row_version/precondition wajib dan GuidanceCommandReceipt;
- exact retry setelah commit mengembalikan hasil pertama, sedangkan fingerprint berbeda ditolak;
- setiap mutation kritis transaksional dan idempotent;
- audit serta notifikasi dibuat konsisten tanpa membocorkan isi sensitif;
- backfill/reconciliation tidak menyisakan row ambigu yang ikut dihitung;
- mapping status legacy tunggal digunakan migration, adapter API, dan frontend;
- policy membedakan program studi, program_kuliah, jalur, serta periode dengan precedence deterministik;
- workflow baru aktif hanya untuk Penelitian, Magang, dan Perintisan Bisnis;
- data Pengabdian tetap terbaca/tidak rusak dan tidak memperoleh workflow baru selama hold;
- unit, integration, authorization, concurrency, migration, frontend, security test, build, dan UAT lulus;
- aturan bisnis, backend, frontend, API, BPMN, test, serta dokumen Tahap 8 menyatakan flow yang sama.

## 18. Keputusan yang perlu dikunci

| Keputusan | Sikap rancangan |
| --- | --- |
| Minimum awal | Migrasikan 8 sebagai policy legacy agar perilaku tetap, bukan hard-code |
| Scope minimum | Tampilkan cycle dan semester; enforcement menunggu pilihan cycle atau semester |
| Bukti sesi terjadi | Rekomendasi awal: resume approved menjadi bukti; keputusan bisnis harus dicatat |
| Approval siap sidang | Mendukung P1 atau seluruh pembimbing aktif; enforcement menunggu keputusan final |
| P2 per jalur | Tetap opsional sampai aturan bisnis diperbarui |
| Transfer resume P1/P2 | Pertahankan urutan/peran; jangan selalu ke P1 |
| Pengganti peran tidak ada | Gunakan P1 aktif sebagai fallback sistem teraudit; bila P1 belum tersedia, tunggu assignment diperbaiki |
| Penarikan request pending | Pertahankan aturan berjalan sampai keputusan baru dicatat |
| Koreksi approval | Reviewer sah membuat versi/keputusan koreksi baru; Sekretaris Prodi tidak mempunyai tombol invalidasi |
| Akses histori co-supervisor | Read-only dan harus diputuskan policy; tidak memberi hak task/mutation |
| Retention resume/event | Mengikuti kebijakan akademik/audit institusi; tidak boleh merusak histori sah |

Keputusan baru harus memperbarui aturan-bisnis-simps.md, policy, migration bila perlu, service, API, frontend, BPMN, test, dan dokumen Tahap 7–8 dalam perubahan yang sama.
