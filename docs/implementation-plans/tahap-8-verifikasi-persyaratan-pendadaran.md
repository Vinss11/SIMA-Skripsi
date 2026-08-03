# Rancangan Implementasi Tahap 8 — Verifikasi Persyaratan Pendadaran

## 1. Ringkasan

Tahap 8 membangun satu proses verifikasi persyaratan pendadaran yang terstruktur, berversi, dapat dijelaskan, dan menjadi satu-satunya sumber izin bagi penjadwalan sidang.

Tahap ini tidak sekadar menambah checklist pada UI. Implementasi harus:

- membaca fakta akademik dari Tahap 5;
- membaca fakta kesiapan bimbingan dari Tahap 7;
- mengelola bukti dan dokumen pendadaran secara versioned;
- memisahkan hasil evaluasi sistem dari keputusan verifikator;
- menerbitkan fakta verifikasi pendadaran yang immutable dan mempunyai checksum;
- menginvalidasi fakta jika salah satu sumber berubah;
- menolak seluruh jalur penjadwalan yang tidak membawa fakta verifikasi valid;
- mempertahankan histori lama dan data Pengabdian Masyarakat secara read-only.

Hasil akhir Tahap 8 adalah kontrak yang dapat digunakan Tahap 9:

```text
Fakta akademik Tahap 5 ───────┐
                              ├─> Evaluasi persyaratan ─> Verifikasi Sekprodi ─> DefenseVerificationFact
Fakta bimbingan Tahap 7 ──────┤                                      │
                              │                                      └─> Gate penjadwalan Tahap 9
Bukti/dokumen pendadaran ─────┘
```

`GuidanceReadinessFact` bukan verifikasi pendadaran dan tidak boleh langsung membuka penjadwalan. `DefenseVerificationFact` adalah fakta baru yang menggabungkan seluruh persyaratan yang berlaku pada satu mahasiswa dan satu siklus penjaluran.

## 2. Acuan aturan bisnis

Rancangan mengacu pada:

- BR-ROLE-002 — Sekretaris Prodi bertanggung jawab atas verifikasi akademik dan pendadaran;
- BR-AKADEMIK-003 — data kosong bukan otomatis gagal/lulus;
- BR-AKADEMIK-004 — semester akademik menggunakan `PeriodeAkademik`;
- BR-AKADEMIK-005 — data akademik, koreksi, dan sumber bersifat versioned;
- BR-AKADEMIK-006 — workflow membaca snapshot akademik berversi;
- BR-AKADEMIK-007 — `evaluated_result` dipisahkan dari `effective_decision`;
- BR-AKADEMIK-008 — SKS dan mata kuliah tidak boleh dihitung ganda;
- BR-BIMBINGAN-002 — bimbingan harus terikat siklus, jalur, assignment, periode, dan semester;
- BR-BIMBINGAN-004 — sesi valid harus mempunyai evaluasi dan resume yang sah;
- BR-BIMBINGAN-005 — minimum bimbingan berasal dari policy berversi;
- BR-BIMBINGAN-006 — Tahap 7 hanya menerbitkan fakta kesiapan bimbingan;
- BR-SIDANG-001 — seluruh persyaratan wajib harus valid sebelum dijadwalkan;
- BR-SIDANG-002 — setiap item menyimpan status, pemeriksa, waktu, dan catatan;
- scope aktif Penelitian, Magang, dan Perintisan Bisnis;
- Pengabdian Masyarakat tetap berstatus hold.

## 3. Kondisi implementasi sekarang

### 3.1 Yang sudah dapat dipakai

Implementasi sekarang sudah mempunyai sebagian fondasi:

- `DokumenSidang` untuk transkrip, CEPT, dan draft skripsi;
- upload, download, dan review dokumen oleh mahasiswa/dosen;
- `PendaftaranSidang` dan periode sidang;
- evaluator akademik melalui `academicDataService.evaluateEligibility()`;
- snapshot akademik berversi dari Tahap 5;
- progres bimbingan dan `GuidanceReadinessFact` dari Tahap 7;
- pengecekan eligibility sebelum `registerMahasiswaSidang()`;
- penjadwalan manual dan otomatis pada `sidangAkhirController`.

Fondasi tersebut harus dipertahankan selama migrasi agar fitur lama tidak langsung rusak.

### 3.2 Kekurangan implementasi sekarang

Gate sekarang belum cukup kuat karena:

1. Eligibility dihitung langsung di controller, bukan melalui aggregate verifikasi yang mempunyai lifecycle.
2. Tiga status dokumen legacy dianggap mewakili semua kebutuhan jalur.
3. CEPT baru berupa file dan status review; skor, tanggal tes, tanggal kedaluwarsa, sumber, dan issuer belum menjadi fakta terstruktur.
4. Belum ada policy persyaratan per program studi, program kuliah, jalur, dan periode akademik.
5. Belum ada status `hold`, `verified`, `invalidated`, dan alasan kekurangan yang konsisten.
6. Belum ada snapshot policy dan fakta sumber ketika verifikasi dilakukan.
7. Belum ada `DefenseVerificationFact` yang dapat diperiksa oleh penjadwalan.
8. Koreksi akademik atau invalidasi bimbingan belum otomatis membuat verifikasi lama stale.
9. Endpoint penjadwalan hanya bergantung pada status pendaftaran dan hasil perhitungan saat itu.
10. Review dosen pada dokumen belum dibedakan dari keputusan final Sekretaris Prodi.
11. Dokumen diubah melalui kolom file tunggal sehingga histori versi bukti belum kuat.
12. Belum ada idempotency receipt dan optimistic concurrency untuk seluruh write path verifikasi.

## 4. Batas scope Tahap 8

### 4.1 Scope aktif

Tahap 8 diaktifkan untuk:

- Penelitian;
- Magang;
- Perintisan Bisnis;
- mahasiswa dengan siklus `baru`;
- mahasiswa dengan siklus `ulang`;
- mahasiswa dengan siklus `alih`.

Verifikasi dilakukan per mahasiswa, termasuk untuk anggota Perintisan Bisnis. Status satu anggota tidak boleh otomatis memverifikasi anggota lain karena fakta akademik, CEPT, dokumen, dan kesiapan tiap anggota dapat berbeda.

### 4.2 Scope hold

Untuk Pengabdian Masyarakat:

- data dokumen dan pendaftaran lama tetap dapat dibaca;
- histori verifikasi lama tidak dihapus;
- adapter read-only boleh menampilkan status legacy;
- create verifikasi baru, policy enforcement baru, dan penerbitan fakta baru ditolak dengan `DEFENSE_TRACK_NOT_ENABLED`;
- penolakan create tidak boleh merusak histori yang sudah ada.

### 4.3 Di luar scope Tahap 8

Tahap ini tidak mencakup:

- algoritma penempatan jadwal, ruangan, dan penguji;
- penilaian sidang;
- revisi setelah sidang;
- yudisium dan kelulusan final;
- tanda tangan digital dokumen;
- integrasi langsung dengan penyedia CEPT eksternal jika API belum tersedia;
- perubahan aturan jalur Pengabdian.

Tahap 8 hanya menyiapkan fakta yang diwajibkan sebelum Tahap 9 menjadwalkan mahasiswa.

## 5. Keputusan yang wajib dipisahkan dari implementasi mekanisme

Beberapa aturan belum boleh diasumsikan sebagai enforcement final:

1. Minimum total SKS per program kuliah dan periode.
2. Daftar mata kuliah wajib yang harus lulus.
3. Pengaruh final Metodologi Penelitian untuk masing-masing jalur.
4. Approval readiness cukup P1 atau seluruh pembimbing aktif.
5. Publikasi dan LOA diwajibkan untuk jalur serta kondisi apa.
6. Bentuk logbook/capture yang sah per jalur.
7. Apakah transkrip wajib diunggah ulang jika snapshot akademik resmi telah lengkap.
8. Pihak yang memberi preliminary review untuk tiap jenis bukti.

Mekanisme policy, evaluator, snapshot, audit, dan mode shadow tetap dapat diimplementasikan. Rule yang belum disahkan wajib mempunyai:

- `enforcement_mode = informational` atau `shadow`;
- `evaluated_result` yang tetap dihitung;
- `effective_decision` yang tidak memblokir;
- label jelas pada UI bahwa rule belum menjadi gate;
- metrik perbandingan sebelum rule diaktifkan.

Tidak boleh mengubah rule tersebut menjadi `blocking` hanya karena field dan evaluatornya sudah tersedia.

## 6. Prinsip desain

### 6.1 Sumber kebenaran

- Data akademik: `SnapshotAkademikMahasiswa` dan evaluasi Tahap 5.
- Bimbingan: `GuidanceReadinessFact` valid terbaru dari Tahap 7.
- Dokumen: versi bukti pada domain Tahap 8, bukan nama file pada request.
- CEPT: record terstruktur yang mempunyai bukti dokumen.
- Policy: versi policy aktif yang di-resolve server.
- Keputusan final: aggregate `DefenseVerification` dan fact yang diterbitkan darinya.

Frontend, JSON payload lama, kolom cache mahasiswa, dan status pada `DokumenSidang` hanya menjadi adapter sementara, bukan sumber kebenaran final.

### 6.2 Siklus sebagai boundary

Setiap verifikasi wajib terikat pada:

- `mahasiswa_id`;
- `pendaftaran_penjaluran_id`;
- `jalur_snapshot`;
- `cycle_type_snapshot` (`baru`, `ulang`, atau `alih`);
- `program_studi_code_snapshot`;
- `program_kuliah_snapshot`;
- periode akademik evaluasi;
- assignment pembimbing aktif ketika permintaan dibuat.

Verifikasi siklus lama tidak boleh dipakai pada siklus baru, ulang, atau alih berikutnya.

### 6.3 Evaluation, decision, dan fact

Tiga konsep berikut tidak boleh digabung:

1. `RequirementEvaluation`: hasil mesin untuk satu item.
2. `DefenseVerification`: keputusan workflow Sekretaris Prodi.
3. `DefenseVerificationFact`: bukti immutable bahwa verifikasi pernah valid.

Perubahan sumber tidak menghapus keputusan lama. Sistem menginvalidasi fact, memperbarui status aggregate menjadi stale/hold, lalu meminta evaluasi atau verifikasi ulang.

### 6.4 Fail closed untuk penjadwalan

Jika fact tidak ditemukan, invalid, stale, checksum tidak cocok, berbeda siklus, atau policy tidak lagi berlaku, penjadwalan harus menolak permintaan.

Rule shadow tidak ikut memblokir, tetapi seluruh rule blocking harus berstatus valid.

## 7. Katalog persyaratan

Katalog awal menggunakan kode stabil berikut:

| Kode | Sumber | Tipe awal | Keterangan |
| --- | --- | --- | --- |
| `GUIDANCE_READINESS` | sistem | blocking setelah approval scope disahkan | fakta kesiapan bimbingan Tahap 7 |
| `SUPERVISOR_APPROVAL` | sistem | blocking | approval pembimbing sesuai policy |
| `ACADEMIC_SNAPSHOT_READY` | sistem | blocking | snapshot tersedia, siap, dan tidak conflicted/stale |
| `MINIMUM_CREDITS` | sistem | shadow sampai threshold disahkan | total SKS lulus |
| `REQUIRED_COURSES_PASSED` | sistem | shadow sampai daftar disahkan | seluruh mata kuliah wajib lulus |
| `METHODOLOGY_STATUS` | sistem | sesuai policy jalur | status Metodologi Penelitian |
| `TRANSCRIPT_EVIDENCE` | dokumen/sistem | configurable | transkrip atau bukti snapshot resmi |
| `CEPT_CERTIFICATE` | dokumen | blocking | sertifikat CEPT tervalidasi |
| `CEPT_MINIMUM_SCORE` | sistem dari CEPT | blocking | default awal 420, configurable |
| `CEPT_VALIDITY` | sistem dari CEPT | blocking | default awal dua tahun, configurable |
| `FINAL_DRAFT_OR_REPORT` | dokumen | blocking | draft Penelitian atau laporan jalur |
| `GUIDANCE_LOGBOOK` | dokumen/sistem | configurable | logbook atau capture bimbingan |
| `SCIENTIFIC_PUBLICATION` | dokumen | conditional | publikasi jika policy mewajibkan |
| `LETTER_OF_ACCEPTANCE` | dokumen | conditional | LOA jika policy mewajibkan |
| `ACADEMIC_CLEARANCE` | manual/sistem | blocking | pemeriksaan akademik/yudisium oleh pihak berwenang |

Katalog tidak menyimpan threshold yang berubah. Threshold berada pada versi policy.

## 8. Matriks awal per jalur

Matriks berikut menjadi template konfigurasi, bukan konstanta source code.

| Persyaratan | Penelitian | Magang | Perintisan Bisnis |
| --- | --- | --- | --- |
| Kesiapan bimbingan | wajib | wajib | wajib per anggota |
| Persetujuan pembimbing | wajib | wajib | wajib per anggota |
| Snapshot akademik | wajib | wajib | wajib |
| CEPT | wajib sesuai policy | wajib sesuai policy | wajib sesuai policy |
| Draft/laporan | draft skripsi | laporan magang | laporan bisnis/tugas akhir |
| Logbook | configurable | logbook magang configurable | logbook kegiatan configurable |
| Publikasi | conditional | default tidak wajib sampai disahkan | conditional |
| LOA | conditional | default tidak wajib sampai disahkan | conditional |
| Clearance akademik | wajib | wajib | wajib |

Nilai `conditional` wajib memiliki ekspresi policy yang eksplisit. Jangan memakai percabangan tersembunyi di controller.

## 9. Model data yang disarankan

### 9.1 `DefenseRequirementCatalog`

Master kode persyaratan yang stabil.

Field minimum:

```text
id
code                  unique
label
description
source_type           system | document | manual | composite
value_type            boolean | number | date | document | composite
is_system_managed
is_active
createdAt
updatedAt
```

Catalog tidak diedit untuk mengubah aturan historis. Perubahan kewajiban dan threshold disimpan pada policy version.

### 9.2 `DefenseRequirementPolicy`

Header policy dengan lifecycle berversi.

```text
id
kode_program_studi
program_kuliah
jalur
periode_akademik_id
version
status                draft | active | retired
effective_at
retired_at
created_by_type
created_by_id
approved_by_type
approved_by_id
decision_reference
row_version
createdAt
updatedAt
```

Precedence resolution:

1. program studi + program kuliah + jalur + periode akademik;
2. program studi + program kuliah + jalur;
3. fallback global yang telah disahkan.

Database wajib mencegah dua policy aktif pada scope yang sama menggunakan unique partial index dengan normalisasi nilai nullable.

### 9.3 `DefenseRequirementPolicyItem`

```text
id
policy_id
requirement_catalog_id
requirement_code_snapshot
is_required
condition_expression
enforcement_mode       blocking | warning | shadow | informational
evaluation_strategy
threshold_config       JSONB
accepted_evidence_types JSONB
reviewer_role
sort_order
createdAt
updatedAt
```

Contoh `threshold_config`:

```json
{
  "minimum_score": 420,
  "validity_months": 24,
  "valid_through_reference": "scheduled_defense_date"
}
```

`condition_expression` harus memakai DSL terbatas atau evaluator yang di-whitelist. Jangan mengeksekusi JavaScript dari database.

### 9.4 `DefenseVerification`

Aggregate utama satu mahasiswa dan satu siklus.

```text
id
mahasiswa_id
pendaftaran_penjaluran_id
active_assignment_id
periode_akademik_id
policy_id
policy_version_snapshot
program_studi_code_snapshot
program_kuliah_snapshot
jalur_snapshot
cycle_type_snapshot
status
evaluated_result
effective_decision
requested_at
submitted_at
verified_at
verified_by_sekretaris_id
held_at
hold_reason_code
invalidated_at
invalidation_reason
cancelled_at
cancel_reason
source_watermark
row_version
createdAt
updatedAt
```

Status workflow:

```text
draft
collecting_evidence
ready_for_verification
under_review
needs_revision
hold
verified
stale
invalidated
cancelled
```

Aturan status:

- `ready_for_verification` hanya jika seluruh item blocking siap dinilai;
- `verified` hanya melalui keputusan Sekretaris Prodi;
- `hold` dapat terjadi karena kekurangan, keputusan manual, atau source anomaly;
- `stale` berarti fakta sumber berubah setelah evaluasi/verifikasi;
- `invalidated` adalah keputusan eksplisit yang membatalkan verifikasi sebelumnya;
- `cancelled` menutup request tanpa menghapus histori.

### 9.5 `DefenseRequirementEvaluation`

Menyimpan hasil evaluasi per item dan per versi evaluasi.

```text
id
defense_verification_id
requirement_code
policy_item_id
evaluation_version
source_type
source_entity_type
source_entity_id
source_version
source_checksum
evaluated_result        valid | invalid | undetermined | not_applicable
effective_decision      allow | warn | block
reason_codes            JSONB
facts_snapshot          JSONB
evaluated_at
evaluator_version
superseded_at
createdAt
updatedAt
```

`facts_snapshot` hanya memuat fakta minimum yang dibutuhkan untuk audit, bukan salinan dokumen atau data sensitif berlebihan.

### 9.6 `DefenseEvidence` dan `DefenseEvidenceVersion`

`DefenseEvidence` menjadi aggregate logis satu jenis bukti pada satu verifikasi.

```text
DefenseEvidence
- id
- defense_verification_id
- requirement_code
- status
- current_version_id
- row_version
- createdAt
- updatedAt

DefenseEvidenceVersion
- id
- defense_evidence_id
- version_number
- storage_key
- original_file_name
- mime_type
- file_size
- sha256_checksum
- scan_status
- uploaded_by_type
- uploaded_by_id
- uploaded_at
- metadata
- superseded_at
- invalidated_at
- invalidation_reason
- createdAt
```

Versi lama tidak ditimpa atau dihapus ketika mahasiswa mengunggah revisi.

### 9.7 `CeptCredential`

CEPT wajib menjadi fakta terstruktur yang menunjuk bukti dokumen.

```text
id
mahasiswa_id
defense_verification_id
evidence_version_id
score
test_date
expires_at
issuer
certificate_number_encrypted
verification_source
status                submitted | verified | rejected | expired | invalidated
verified_by_type
verified_by_id
verified_at
invalidation_reason
row_version
createdAt
updatedAt
```

Ketentuan evaluasi:

- skor harus bilangan dalam rentang yang dikonfigurasi;
- `expires_at` dihitung server dari tanggal tes dan policy, kecuali issuer memberikan tanggal resmi;
- timezone dan date-only semantics harus eksplisit;
- validitas diperiksa kembali terhadap tanggal sidang ketika jadwal dibuat;
- nomor sertifikat tidak ditaruh di log atau notifikasi.

### 9.8 `DefenseRequirementReview`

Keputusan review append-only.

```text
id
defense_verification_id
requirement_evaluation_id
evidence_version_id
decision              approved | revision_required | rejected | waived | invalidated
actor_type
actor_id
actor_role
note
reason_code
decided_at
idempotency_key
request_fingerprint
createdAt
```

Review dosen adalah preliminary review jika policy menetapkannya. Review tersebut tidak otomatis menggantikan verifikasi final Sekretaris Prodi.

### 9.9 `DefenseVerificationEvent`

```text
id
defense_verification_id
event_type
actor_type
actor_id
actor_role
from_state
to_state
reason_code
metadata
correlation_id
idempotency_key
occurred_at
createdAt
```

Event minimum:

- `verification_created`;
- `evidence_uploaded`;
- `evidence_reviewed`;
- `evaluation_completed`;
- `verification_submitted`;
- `verification_held`;
- `verification_unheld`;
- `verification_approved`;
- `verification_stale`;
- `verification_invalidated`;
- `verification_cancelled`;
- `fact_issued`;
- `fact_invalidated`.

### 9.10 `DefenseVerificationFact`

Kontrak resmi untuk Tahap 9.

```text
id
defense_verification_id
mahasiswa_id
pendaftaran_penjaluran_id
policy_id
policy_version_snapshot
guidance_readiness_fact_id
guidance_fact_version_snapshot
guidance_fact_checksum_snapshot
academic_snapshot_id
academic_snapshot_version
academic_snapshot_checksum
requirement_summary
status                  valid | invalidated | expired
fact_version
issued_at
valid_until
invalidated_at
invalidation_reason
checksum
createdAt
```

Checksum dihitung dari canonical payload yang mencakup seluruh ID/version/checksum sumber dan ringkasan keputusan blocking.

Tahap 9 wajib menyimpan `defense_verification_fact_id`, `fact_version`, dan `checksum` yang dipakai ketika jadwal dibuat.

### 9.11 `DefenseCommandReceipt`

```text
id
actor_type
actor_id
operation
idempotency_key
request_fingerprint
status
aggregate_type
aggregate_id
response_status
response_payload_minimal
completed_at
expires_at
createdAt
updatedAt
```

Unique constraint:

```text
(actor_type, actor_id, operation, idempotency_key)
```

Receipt digunakan untuk create, submit, review, hold, unhold, verify, invalidate, cancel, dan upload-finalize.

### 9.12 Outbox dan dependency registry

Tambahkan:

```text
DefenseVerificationDependency
- defense_verification_id
- source_type
- source_id
- source_version
- source_checksum
- active

DefenseOutbox
- event_type
- aggregate_id
- payload_minimal
- status
- attempt_count
- available_at
- processed_at
- last_error
```

Dependency dipakai untuk menemukan verifikasi yang terdampak ketika fakta bimbingan, snapshot akademik, policy, atau bukti berubah.

## 10. Constraint dan indeks database

Constraint minimum:

1. Satu `DefenseVerification` nonterminal per mahasiswa dan pendaftaran penjaluran.
2. `pendaftaran_penjaluran_id` harus dimiliki `mahasiswa_id` yang sama.
3. Jalur aktif hanya Penelitian, Magang, dan Perintisan Bisnis untuk create baru.
4. Status `verified` mewajibkan `verified_at`, `verified_by_sekretaris_id`, policy, academic snapshot, dan guidance fact terisi.
5. Status fact `valid` mewajibkan seluruh source ID, version, checksum, dan checksum fact terisi.
6. `DefenseEvidenceVersion.version_number` unik per evidence.
7. Satu current evidence version per evidence.
8. Satu active evaluation per verification, requirement, dan policy item.
9. Satu policy aktif per scope.
10. `row_version` wajib dan positif untuk seluruh aggregate write path.
11. `PendaftaranSidang` baru wajib mempunyai `defense_verification_fact_id`.
12. `JadwalSidangPenguji` baru wajib dapat ditelusuri ke fact yang dipakai ketika penjadwalan.

Indeks minimum:

- antrean berdasarkan `status`, `jalur_snapshot`, dan `periode_akademik_id`;
- lookup mahasiswa + pendaftaran;
- dependency source type + source ID + active;
- fact verification + version;
- evidence verification + requirement code;
- CEPT mahasiswa + status + expiry;
- command receipt unique index;
- outbox status + available_at.

## 11. Resolusi policy

Service `resolveDefenseRequirementPolicy()` menerima:

```text
kodeProgramStudi
programKuliah
jalur
periodeAkademikId
evaluationAt
```

Aturan:

1. hanya policy `active` dengan rentang efektif valid yang dipertimbangkan;
2. gunakan precedence yang telah ditentukan;
3. jika tidak ada policy, hasil `DEFENSE_POLICY_NOT_FOUND` dan workflow fail closed;
4. jika lebih dari satu policy mempunyai precedence sama, hasil `DEFENSE_POLICY_AMBIGUOUS`;
5. policy yang dipakai disimpan sebagai snapshot pada aggregate dan setiap evaluation;
6. aktivasi policy baru tidak mengubah histori verifikasi lama secara diam-diam;
7. policy baru dapat menandai verifikasi nonterminal untuk re-evaluation melalui job terkontrol;
8. retirement policy tidak menghapus policy dari histori.

## 12. Evaluator persyaratan

Buat satu service terpusat:

```text
evaluateDefenseRequirements()
├── lock verification
├── resolve policy
├── resolve cycle dan assignment
├── validate active track
├── load latest valid GuidanceReadinessFact
├── load academic snapshot dan eligibility evaluation
├── load latest evidence versions
├── evaluate structured CEPT
├── evaluate document/manual items
├── persist evaluations append-only
├── calculate evaluated_result
├── calculate effective_decision
├── update source watermark dan dependencies
├── emit event/outbox
└── commit
```

### 12.1 Hasil aggregate

`evaluated_result`:

- `eligible`: semua rule yang dapat dievaluasi memenuhi syarat;
- `blocked`: sedikitnya satu rule blocking invalid;
- `undetermined`: data blocking belum tersedia atau kualitas sumber belum layak.

`effective_decision`:

- `allow`: seluruh rule blocking valid;
- `warn`: hanya rule warning/shadow yang tidak memenuhi;
- `block`: terdapat rule blocking invalid atau undetermined.

`undetermined` pada rule blocking harus menghasilkan `block`, bukan dianggap lolos.

### 12.2 Reason code

Reason code minimum:

```text
GUIDANCE_FACT_MISSING
GUIDANCE_FACT_INVALIDATED
GUIDANCE_FACT_STALE
GUIDANCE_APPROVAL_INCOMPLETE
ACADEMIC_SNAPSHOT_MISSING
ACADEMIC_SNAPSHOT_STALE
ACADEMIC_DATA_CONFLICTED
ACADEMIC_CALCULATION_FAILED
MINIMUM_CREDITS_NOT_MET
REQUIRED_COURSES_NOT_PASSED
METHODOLOGY_NOT_PASSED
CEPT_EVIDENCE_MISSING
CEPT_SCORE_BELOW_THRESHOLD
CEPT_EXPIRED
CEPT_DATA_INVALID
FINAL_REPORT_MISSING
LOGBOOK_MISSING
PUBLICATION_MISSING
LOA_MISSING
ACADEMIC_CLEARANCE_PENDING
EVIDENCE_SCAN_PENDING
EVIDENCE_REJECTED
MANUAL_HOLD_ACTIVE
POLICY_NOT_FOUND
POLICY_AMBIGUOUS
SOURCE_CHECKSUM_MISMATCH
```

UI memetakan reason code ke teks. Backend tidak bergantung pada teks terjemahan untuk logika.

## 13. Konsumsi `GuidanceReadinessFact`

Tahap 8 hanya menerima fakta jika:

- mahasiswa sama;
- `pendaftaran_penjaluran_id` sama;
- status fact `valid`;
- fact merupakan versi terbaru yang tidak diinvalidasi;
- checksum dapat diverifikasi;
- policy guidance pada fact masih dapat ditelusuri;
- approval snapshot memenuhi scope policy yang berlaku saat fakta diterbitkan.

Jika mode readiness Tahap 7 masih `shadow`:

- evaluator tetap menyimpan hasil;
- UI menampilkan status shadow;
- hasil tidak boleh diperlakukan sebagai approval blocking yang sudah disahkan;
- enforcement Tahap 8 tetap berada pada release gate 8A sampai keputusan approval scope dan rollout Tahap 7 selesai.

Tahap 8 tidak menghitung ulang jumlah bimbingan untuk menerbitkan fact final. Perhitungan ulang hanya boleh digunakan sebagai alat rekonsiliasi dan harus dibandingkan dengan fact Tahap 7.

## 14. Konsumsi fakta akademik

Evaluator membaca:

- snapshot akademik current yang aktif;
- versi dan checksum snapshot;
- `total_sks_lulus`;
- daftar mata kuliah wajib belum lulus;
- status Metodologi;
- `data_state`;
- `calculation_status`;
- hasil `evaluated_result` dan `effective_decision` Tahap 5.

Aturan:

- `stale`, `failed`, `unavailable`, atau `conflicted` tidak dianggap valid;
- tidak adanya data tidak berarti mahasiswa gagal secara akademik, tetapi menghasilkan `undetermined`;
- rule shadow dari Tahap 5 tidak boleh berubah menjadi blocking di Tahap 8;
- jika threshold Tahap 8 lebih spesifik dan sudah disahkan, policy ID/version harus direkam;
- koreksi akademik menerbitkan invalidation event terhadap fact pendadaran yang bergantung pada snapshot lama.

## 15. Alur CEPT

### 15.1 Input mahasiswa

Mahasiswa mengisi:

- skor;
- tanggal tes;
- issuer;
- nomor sertifikat bila diperlukan;
- file sertifikat.

Backend:

- memvalidasi nilai terstruktur;
- menghitung expiry sesuai policy;
- memverifikasi file sudah lolos validasi dan scanning;
- membuat `CeptCredential` dan `DefenseEvidenceVersion` dalam satu transaksi finalisasi upload;
- tidak mempercayai `expires_at` dari frontend.

### 15.2 Review

Reviewer memeriksa kesesuaian data terstruktur dengan sertifikat. Keputusan review menyimpan evidence version yang diperiksa.

Jika mahasiswa mengunggah versi baru setelah review:

- review lama tetap ada;
- evidence lama menjadi superseded;
- item CEPT kembali pending;
- evaluasi dan fact terkait diinvalidasi.

### 15.3 Kedaluwarsa

CEPT diperiksa pada dua titik:

1. saat verifikasi pendadaran dengan reference date saat itu;
2. saat penjadwalan menggunakan tanggal sidang yang akan ditetapkan.

Jika CEPT valid saat verifikasi tetapi akan kedaluwarsa sebelum tanggal sidang, penjadwalan ditolak dengan `CEPT_EXPIRES_BEFORE_DEFENSE` dan verifikasi masuk `stale` atau `hold` sesuai policy.

## 16. Alur dokumen dan bukti

Status evidence:

```text
missing
uploading
scan_pending
submitted
under_review
revision_required
approved
rejected
superseded
invalidated
```

Alur:

1. Mahasiswa meminta upload session.
2. Server memvalidasi requirement, ukuran, MIME, extension, dan ownership.
3. File ditempatkan di storage privat menggunakan key acak.
4. Sistem menghitung checksum dan menjalankan malware scan.
5. Mahasiswa melakukan finalize dengan `Idempotency-Key`.
6. Sistem membuat evidence version.
7. Reviewer yang berwenang memberi preliminary review.
8. Evaluator memperbarui item dan kekurangan.
9. Sekprodi mengambil keputusan final pada aggregate.

File tidak boleh disimpan dengan nama asli sebagai storage path. Download menggunakan endpoint terautorisasi atau signed URL singkat.

## 17. Workflow verifikasi

### 17.1 Membuat draft

Mahasiswa dapat membuat draft jika:

- mempunyai pendaftaran penjaluran approved pada salah satu jalur aktif;
- mempunyai assignment pembimbing yang dapat ditelusuri;
- tidak mempunyai verifikasi nonterminal pada siklus yang sama;
- tidak sudah dijadwalkan atau menyelesaikan sidang pada siklus tersebut;
- policy dapat di-resolve.

Create menyimpan context snapshot dan `row_version = 1`.

### 17.2 Pengumpulan bukti

Mahasiswa dapat mengisi bukti selama status:

- `draft`;
- `collecting_evidence`;
- `needs_revision`;
- `hold` jika hold mengizinkan revisi dokumen.

Setiap perubahan evidence memicu evaluator. UI selalu menampilkan kekurangan terbaru dan membedakan rule blocking, warning, serta shadow.

### 17.3 Submit untuk verifikasi

Submit:

- memakai `Idempotency-Key`;
- mewajibkan `expected_version`;
- mengunci verification dan evidence aktif;
- menjalankan evaluator;
- menolak jika bukti wajib belum siap direview;
- mengubah status menjadi `under_review`;
- membuat event dan notifikasi Sekprodi atomik.

### 17.4 Review item

Sekprodi dapat:

- menyetujui item manual/dokumen;
- meminta revisi;
- menolak bukti;
- memberi waiver hanya jika policy dan capability khusus mengizinkan;
- menempatkan verifikasi pada hold.

Waiver wajib menyimpan reason code, alasan, aktor, waktu, capability, dan scope. Jangan menyediakan waiver generik tanpa aturan otorisasi.

### 17.5 Verifikasi final

Dalam satu transaksi:

1. Kunci `DefenseVerification`.
2. Validasi `expected_version`.
3. Jalankan ulang evaluator.
4. Kunci dan baca versi sumber terbaru.
5. Pastikan seluruh rule blocking `allow`.
6. Pastikan tidak ada manual hold.
7. Simpan keputusan Sekprodi.
8. Terbitkan `DefenseVerificationFact` versi berikutnya.
9. Simpan dependency dan checksum.
10. Buat event, outbox, dan notifikasi.
11. Commit.

Jika salah satu langkah gagal, seluruh transaksi rollback.

### 17.6 Hold dan unhold

Hold wajib mempunyai:

- `reason_code`;
- catatan;
- actor;
- waktu;
- dampak terhadap edit mahasiswa;
- kondisi untuk unhold.

Unhold:

- memerlukan konfirmasi;
- tidak otomatis mengembalikan status `verified`;
- menjalankan evaluasi ulang;
- mengembalikan ke `collecting_evidence`, `ready_for_verification`, atau `under_review` sesuai hasil.

### 17.7 Invalidasi dan pembatalan

Invalidasi verifikasi:

- hanya untuk verifikasi yang pernah `verified`;
- membutuhkan konfirmasi, alasan, `expected_version`, dan `Idempotency-Key`;
- tidak menghapus decision atau fact lama;
- menandai fact lama invalidated;
- menerbitkan fact invalidation version;
- membuat status aggregate `invalidated` atau `stale`;
- memberi notifikasi mahasiswa dan Sekprodi terkait;
- jika sudah terjadwal, membuat tindak lanjut jadwal, bukan menghapus jadwal diam-diam.

Pembatalan request berbeda dengan invalidasi. Cancel dipakai untuk request yang belum verified dan menyimpan alasan penutupan.

## 18. Invalidation dan re-evaluation

Sumber perubahan yang wajib memicu re-evaluation:

- `GuidanceReadinessFact` diinvalidasi atau mendapat versi baru;
- approval resume yang mendasari progres diinvalidasi;
- snapshot akademik dikoreksi atau dihitung ulang;
- academic correction dicabut;
- CEPT kedaluwarsa;
- evidence version baru diunggah;
- review evidence dibatalkan;
- policy baru diaktifkan untuk request nonterminal;
- assignment atau siklus berubah;
- manual hold dibuat.

Proses invalidation:

```text
source event
  -> lookup DefenseVerificationDependency
  -> lock verification
  -> tandai source lama stale
  -> supersede evaluation aktif
  -> invalidasi fact valid
  -> terbitkan fact invalidation version
  -> ubah status verification
  -> buat event/outbox/notifikasi
  -> jika sudah terjadwal, buat scheduling follow-up
```

Job expiry harian memeriksa CEPT dan `valid_until`. Job harus idempoten dan memakai checkpoint.

## 19. Gate pendaftaran dan penjadwalan

### 19.1 Pendaftaran sidang

`registerMahasiswaSidang()` tidak lagi menyusun eligibility sendiri. Endpoint memanggil:

```text
assertValidDefenseVerificationFact({
  mahasiswaId,
  pendaftaranPenjaluranId,
  requestedDefensePeriodId
})
```

Pendaftaran menyimpan:

- `defense_verification_id`;
- `defense_verification_fact_id`;
- `fact_version_snapshot`;
- `fact_checksum_snapshot`;
- `pendaftaran_penjaluran_id`.

### 19.2 Penjadwalan manual dan otomatis

Semua write path berikut wajib memanggil gate yang sama:

- register sidang;
- assign jadwal individual;
- auto-assign;
- bulk assign;
- reschedule ke tanggal baru;
- import jadwal jika tersedia;
- endpoint internal atau worker.

UI disable bukan kontrol keamanan. Backend menjadi enforcement mutlak.

### 19.3 Recheck di dalam transaksi

Sebelum membuat jadwal:

1. Kunci pendaftaran sidang.
2. Kunci fact yang direferensikan.
3. Pastikan fact valid dan checksum cocok.
4. Pastikan tidak ada fact invalidation version yang lebih baru.
5. Pastikan siklus dan mahasiswa sama.
6. Evaluasi CEPT terhadap tanggal sidang target.
7. Pastikan tidak ada hold aktif.
8. Baru simpan jadwal.

Hal ini mencegah race antara invalidasi verifikasi dan proses penjadwalan.

### 19.4 Verifikasi invalid setelah dijadwalkan

Jadwal yang sudah ada tidak dihapus otomatis. Sistem:

- menandai `eligibility_status = stale` atau `hold` pada jadwal;
- memblokir langkah lanjut yang memerlukan eligibility valid;
- membuat tindak lanjut Sekprodi;
- memberi pilihan terkontrol untuk reverify, reschedule, atau cancel;
- mempertahankan seluruh audit.

## 20. Otorisasi

### Mahasiswa

- melihat checklist dan fakta miliknya;
- membuat draft;
- mengunggah/revisi bukti miliknya;
- submit verifikasi;
- tidak dapat mengubah evaluation, policy snapshot, review, atau fact.

### Pembimbing

- melihat mahasiswa berdasarkan assignment dan kewenangan efektif;
- memberi approval yang memang diwajibkan policy;
- melakukan preliminary review hanya pada item yang diberikan kepadanya;
- tidak dapat melakukan verifikasi final Sekprodi;
- akses histori mengikuti assignment dan transfer reviewer.

### Sekretaris Prodi

- melihat antrean tiga jalur aktif;
- review persyaratan;
- hold/unhold;
- verifikasi final;
- invalidasi dengan alasan;
- mengelola lifecycle policy jika capability tersedia;
- melihat audit dan dependency.

### Admin

- mengelola sumber/master data yang menjadi kewenangannya;
- tidak otomatis dapat memverifikasi pendadaran;
- koreksi akademik mengikuti mekanisme Tahap 5 dan memicu invalidation.

Setiap endpoint harus memverifikasi role, ownership, scope prodi, assignment, dan capability. Pemeriksaan role frontend tidak cukup.

## 21. Kontrak API

### 21.1 Mahasiswa

| Method | Endpoint | Fungsi |
| --- | --- | --- |
| GET | `/api/mahasiswa/pendadaran/context` | siklus, assignment, policy, dan mode enforcement |
| GET | `/api/mahasiswa/pendadaran/current` | aggregate, checklist, kekurangan, dan fact status |
| POST | `/api/mahasiswa/pendadaran` | membuat draft |
| POST | `/api/mahasiswa/pendadaran/:id/evidence/upload-session` | meminta upload session |
| POST | `/api/mahasiswa/pendadaran/:id/evidence/finalize` | membuat evidence version |
| POST | `/api/mahasiswa/pendadaran/:id/cept` | menyimpan fakta CEPT terstruktur |
| POST | `/api/mahasiswa/pendadaran/:id/evaluate` | meminta evaluasi terbaru |
| POST | `/api/mahasiswa/pendadaran/:id/submit` | submit verifikasi |
| GET | `/api/mahasiswa/pendadaran/:id/history` | histori evidence, evaluation, dan event yang boleh dilihat |
| GET | `/api/mahasiswa/pendadaran/evidence/:versionId/download` | download bukti terautorisasi |

### 21.2 Pembimbing

| Method | Endpoint | Fungsi |
| --- | --- | --- |
| GET | `/api/dosen/pendadaran/tasks` | antrean approval/review sesuai assignment |
| GET | `/api/dosen/pendadaran/:id` | detail item yang menjadi kewenangannya |
| POST | `/api/dosen/pendadaran/:id/requirements/:code/review` | preliminary review/approval |
| GET | `/api/dosen/pendadaran/evidence/:versionId/download` | download bukti dalam scope |

### 21.3 Sekretaris Prodi

| Method | Endpoint | Fungsi |
| --- | --- | --- |
| GET | `/api/sekretaris/pendadaran/queue` | antrean dan filter |
| GET | `/api/sekretaris/pendadaran/:id` | detail lengkap dan dependency |
| POST | `/api/sekretaris/pendadaran/:id/requirements/:code/review` | review item |
| POST | `/api/sekretaris/pendadaran/:id/hold` | hold |
| POST | `/api/sekretaris/pendadaran/:id/unhold` | unhold dan evaluate ulang |
| POST | `/api/sekretaris/pendadaran/:id/verify` | verifikasi final dan terbitkan fact |
| POST | `/api/sekretaris/pendadaran/:id/invalidate` | invalidasi verifikasi |
| POST | `/api/sekretaris/pendadaran/:id/cancel` | cancel request nonterminal |
| GET | `/api/sekretaris/pendadaran/:id/audit` | event, review, dan fact history |
| GET | `/api/sekretaris/pendadaran/policies` | daftar policy |
| POST | `/api/sekretaris/pendadaran/policies` | membuat draft policy |
| POST | `/api/sekretaris/pendadaran/policies/:id/activate` | aktivasi policy |
| POST | `/api/sekretaris/pendadaran/policies/:id/retire` | retirement policy |

### 21.4 Header mutasi

Seluruh mutation menerima:

```http
Idempotency-Key: <unique-key>
If-Match: <row-version>
```

`expected_version` pada body boleh didukung sebagai adapter, tetapi service menerima satu nilai precondition yang telah dinormalisasi.

Error code minimum:

```text
IDEMPOTENCY_KEY_REQUIRED
IDEMPOTENCY_CONFLICT
DEFENSE_PRECONDITION_REQUIRED
DEFENSE_VERSION_CONFLICT
DEFENSE_POLICY_NOT_FOUND
DEFENSE_POLICY_AMBIGUOUS
DEFENSE_POLICY_ACTIVE_SCOPE_CONFLICT
DEFENSE_CONTEXT_INVALID
DEFENSE_TRACK_NOT_ENABLED
DEFENSE_REQUIREMENTS_INCOMPLETE
DEFENSE_SOURCE_STALE
DEFENSE_FACT_INVALID
DEFENSE_FACT_CHECKSUM_MISMATCH
DEFENSE_MANUAL_HOLD_ACTIVE
DEFENSE_REVIEW_NOT_AUTHORIZED
DEFENSE_ALREADY_VERIFIED
DEFENSE_SCHEDULE_GATE_REJECTED
CEPT_EXPIRES_BEFORE_DEFENSE
```

## 22. UI/UX

### 22.1 Mahasiswa

Halaman Persyaratan Pendadaran menampilkan:

- jalur, siklus, program kuliah, periode, dan policy version;
- status besar: mengumpulkan, menunggu review, perlu revisi, hold, verified, stale;
- progress item blocking;
- daftar kekurangan dengan reason yang dapat ditindaklanjuti;
- pemisahan rule blocking, warning, dan shadow;
- sumber data akademik dan waktu snapshot tanpa membuka detail internal sensitif;
- status fakta bimbingan;
- form CEPT terstruktur;
- upload dan histori versi dokumen;
- catatan review per versi;
- timeline verifikasi;
- status fact dan alasan invalidasi;
- tombol submit hanya ketika item siap direview.

Mahasiswa tidak melihat checksum mentah sebagai fokus UI, tetapi ID/version fakta dapat ditampilkan pada bagian audit teknis.

### 22.2 Pembimbing

Workspace dosen menampilkan:

- task approval kesiapan/pendadaran sesuai policy;
- identitas siklus dan assignment;
- item yang boleh direview;
- evidence version yang sedang aktif;
- histori versi dan review sebelumnya;
- warning jika reviewer efektif berubah;
- keputusan approve/revision dengan precondition version.

### 22.3 Sekretaris Prodi

Halaman monitoring menyediakan:

- filter jalur, program kuliah, periode, status, reason code, dan age;
- kolom kekurangan blocking;
- status sumber akademik, bimbingan, CEPT, dan dokumen;
- indikator stale/checksum mismatch;
- detail seluruh evaluation dan fakta sumber;
- review item;
- hold/unhold;
- verify dan invalidate dengan modal konfirmasi;
- timeline event dan version history;
- policy management;
- bulk action hanya untuk tindakan homogen dan aman.

Bulk verify tidak boleh sekadar mengirim seluruh ID. Server memproses setiap aggregate dengan precondition masing-masing dan mengembalikan hasil per item. Tidak ada partial success tersembunyi.

### 22.4 Penjadwalan

UI penjadwalan menampilkan:

- badge verification fact valid/stale/invalid;
- fact version yang digunakan;
- reason penolakan gate;
- warning CEPT yang mendekati kedaluwarsa;
- tindak lanjut jika verifikasi invalid setelah jadwal dibuat.

## 23. Notifikasi

Notifikasi minimum:

- mahasiswa berhasil submit verifikasi;
- Sekprodi menerima task baru;
- evidence perlu revisi;
- verifikasi masuk hold;
- hold dilepas;
- verifikasi berhasil;
- verifikasi menjadi stale;
- verifikasi diinvalidasi;
- fact invalid menyebabkan jadwal perlu ditinjau;
- CEPT akan kedaluwarsa sebelum periode sidang target.

Notifikasi:

- dibuat atomik dengan transaksi bisnis atau melalui transactional outbox;
- mempunyai deduplication key;
- tidak memuat nomor sertifikat, isi dokumen, nilai lengkap, atau catatan sensitif;
- menunjuk action key dan aggregate ID.

## 24. Strategi migrasi data legacy

### 24.1 Migration additive

Jangan langsung menghapus `DokumenSidang` atau mengubah enum lama. Tambahkan tabel domain baru dan kolom referensi pada:

- `PendaftaranSidang`;
- `JadwalSidangPenguji`;
- bila diperlukan `DokumenSidang` sebagai pointer migration state.

### 24.2 Backfill dokumen

Untuk setiap `DokumenSidang`:

- buat verification legacy jika siklus dapat ditentukan tunggal;
- buat evidence dan evidence version untuk file yang ada;
- simpan checksum jika file masih tersedia;
- petakan status lama;
- tandai context `ambiguous` jika siklus tidak dapat ditentukan;
- jangan menerbitkan fact valid otomatis hanya karena tiga status legacy `approved`.

Pemetaan awal:

| Status legacy | Status evidence baru |
| --- | --- |
| `belum_upload` | `missing` |
| `submitted` | `submitted` |
| `revisi` | `revision_required` |
| `approved` | `approved_legacy` sampai direkonsiliasi |

`approved_legacy` tidak otomatis sama dengan verification final.

### 24.3 Backfill pendaftaran dan jadwal

Pendaftaran/jadwal lama:

- tetap dapat dibaca;
- diberi `verification_context_status = legacy | resolved | ambiguous`;
- tidak dipaksa mempunyai fact baru jika terjadi sebelum cutover;
- mutasi baru terhadap record legacy harus melalui adapter dan rekonsiliasi;
- laporan membedakan legacy exemption dari fact-based verification.

### 24.4 Rekonsiliasi

Script dry-run melaporkan:

- dokumen tanpa mahasiswa;
- mahasiswa tanpa siklus tunggal;
- file hilang atau checksum gagal;
- status approved tanpa reviewer/waktu;
- pendaftaran sidang tanpa assignment;
- jadwal tanpa pendaftaran;
- data Pengabdian;
- policy scope yang belum tersedia;
- perbedaan eligibility legacy dan evaluator baru.

Script execute harus idempoten, batchable, mempunyai checkpoint, dan tidak menghapus data.

## 25. Release gate

### 8A — Domain, backfill, dan shadow evaluation

- buat schema dan model;
- buat policy lifecycle;
- migrasikan evidence legacy;
- implementasikan evaluator;
- konsumsi snapshot akademik dan guidance fact;
- jalankan dual-read serta shadow comparison;
- tampilkan UI checklist tanpa mengubah gate produksi;
- selesaikan keputusan akademik yang masih tertunda.

Exit criteria:

- tidak ada data loss;
- mismatch legacy versus evaluator dapat dijelaskan;
- policy scope lengkap untuk tiga jalur aktif;
- invalidation dependency berjalan.

### 8B — Workflow verifikasi dan fact issuance

- aktifkan upload versioned;
- aktifkan review dosen sesuai policy;
- aktifkan antrean Sekprodi;
- aktifkan hold/unhold/verify/invalidate;
- terbitkan `DefenseVerificationFact`;
- readiness Tahap 7 sudah keluar dari shadow untuk scope yang disahkan;
- rule akademik blocking sudah mempunyai keputusan eksplisit.

Exit criteria:

- fact dapat diverifikasi checksum-nya;
- retry idempoten;
- invalidasi sumber membuat fact stale/invalid;
- tiga jalur aktif lulus UAT.

### 8C — Enforcement penjadwalan

- hubungkan register sidang ke fact;
- hubungkan manual/auto/bulk/reschedule ke gate yang sama;
- aktifkan recheck CEPT terhadap tanggal sidang;
- aktifkan follow-up jadwal ketika fact invalid;
- hentikan write path legacy.

Tahap 8 belum selesai jika hanya UI checklist tersedia tetapi endpoint penjadwalan masih dapat melewati fact.

## 26. Paket pengerjaan terurut

### Paket 1 — Audit dan keputusan bisnis

1. Inventarisasi seluruh dokumen dan gate lama.
2. Petakan requirement per tiga jalur aktif.
3. Putuskan threshold akademik dan scope approval.
4. Tentukan preliminary reviewer tiap bukti.
5. Dokumentasikan rule shadow dan blocking.

### Paket 2 — Catalog dan policy

1. Buat catalog requirement.
2. Buat header/item policy berversi.
3. Implementasikan lifecycle draft/active/retired.
4. Tambahkan unique active scope constraint.
5. Implementasikan resolver dan precedence.
6. Seed policy legacy sebagai draft atau shadow, bukan active blocking tanpa persetujuan.

### Paket 3 — Aggregate dan audit

1. Buat `DefenseVerification`.
2. Buat evaluation, event, review, command receipt, dependency, dan outbox.
3. Terapkan state machine dan row version.
4. Terapkan idempotency replay.
5. Tambahkan constraint context lengkap.

### Paket 4 — Evidence versioning dan CEPT

1. Buat storage contract privat.
2. Implementasikan upload session/finalize.
3. Validasi file signature, MIME, size, checksum, dan scan status.
4. Buat histori evidence version.
5. Buat CEPT structured credential dan evaluator expiry.

### Paket 5 — Adapter Tahap 5 dan Tahap 7

1. Buat academic fact adapter.
2. Buat guidance readiness fact adapter.
3. Verifikasi checksum dan source version.
4. Simpan dependency.
5. Tangani missing, stale, conflicted, dan shadow.

### Paket 6 — Evaluator

1. Implementasikan strategy per requirement code.
2. Simpan evaluation append-only.
3. Hitung evaluated result dan effective decision.
4. Buat reason code registry.
5. Buat source watermark.
6. Tambahkan dry-run evaluator untuk monitoring.

### Paket 7 — Workflow mahasiswa dan dosen

1. Context dan current checklist API.
2. Create draft dan submit.
3. Evidence history UI.
4. CEPT form.
5. Task dan preliminary review dosen.
6. Notifikasi dan timeline.

### Paket 8 — Workflow Sekprodi

1. Queue dan filter.
2. Detail source facts dan evaluation.
3. Item review.
4. Hold/unhold.
5. Verify dan issue fact.
6. Invalidate/cancel.
7. Policy UI dan audit.

### Paket 9 — Invalidation worker

1. Consume event Tahap 5 dan Tahap 7.
2. Dependency lookup.
3. Re-evaluation idempoten.
4. CEPT expiry job.
5. Scheduling follow-up.
6. Retry/dead-letter monitoring.

### Paket 10 — Enforcement sidang

1. Tambahkan fact FK pada pendaftaran dan jadwal.
2. Buat shared assertion service.
3. Refactor seluruh endpoint penjadwalan.
4. Tambahkan transaction lock dan recheck.
5. Matikan eligibility calculation tersebar.

### Paket 11 — Backfill dan cutover

1. Dry-run legacy migration.
2. Perbaiki context ambiguous.
3. Dual-read comparison.
4. Cutover read path.
5. Cutover write path.
6. Retire adapter legacy setelah observability stabil.

### 26.1 Peta target implementasi kode

Struktur berikut disarankan agar logika tidak kembali tersebar di controller:

```text
server/
├── models/
│   └── defenserequirementdomain.js
├── migrations/
│   ├── create-defense-requirement-domain.js
│   ├── add-defense-fact-references.js
│   └── strengthen-defense-verification-invariants.js
├── services/
│   ├── defensePolicyService.js
│   ├── defenseContextService.js
│   ├── defenseEvidenceService.js
│   ├── ceptCredentialService.js
│   ├── defenseRequirementEvaluator.js
│   ├── defenseVerificationWorkflowService.js
│   ├── defenseVerificationFactService.js
│   ├── defenseInvalidationService.js
│   └── defenseSchedulingGateService.js
├── controllers/
│   ├── pendadaranMahasiswaController.js
│   ├── pendadaranDosenController.js
│   └── pendadaranSekretarisController.js
├── scripts/
│   ├── backfill-defense-verification.js
│   ├── reconcile-defense-verification.js
│   └── process-defense-outbox.js
└── tests/
    ├── stage8DefenseVerification.integration.test.js
    ├── stage8DefenseInvalidation.integration.test.js
    ├── stage8DefenseSchedulingGate.integration.test.js
    └── stage8DefenseMigration.integration.test.js

client/src/
├── pages/
│   ├── PersyaratanPendadaranPage.js
│   ├── DosenPendadaranReviewPage.js
│   └── SekretarisPendadaranPage.js
└── components/
    ├── DefenseRequirementChecklist.js
    ├── DefenseEvidenceHistory.js
    ├── DefenseVerificationTimeline.js
    ├── DefenseSourceFactPanel.js
    └── DefensePolicyPanel.js
```

Refactor khusus implementasi lama:

- `dokumenSidangController` menjadi adapter selama dual-write, lalu delegasikan upload/review ke `defenseEvidenceService`;
- `sidangAkhirController.getMahasiswaSidangEligibility()` diganti pemanggilan evaluator/fact service;
- `registerMahasiswaSidang()`, auto-assign, manual assign, bulk assign, dan reschedule memanggil `defenseSchedulingGateService`;
- `DokumenSidang` dipertahankan untuk read compatibility sampai backfill dan cutover selesai;
- jangan menambahkan evaluator baru langsung di controller.

## 27. Strategi pengujian

### 27.1 Unit test

- policy precedence dan ambiguity;
- CEPT score boundary 419/420/421;
- expiry sebelum, tepat pada, dan setelah reference date;
- academic `eligible`, `blocked`, `undetermined`;
- rule shadow tidak memblokir;
- condition expression whitelist;
- canonical checksum;
- reason code mapping;
- state transition;
- context validation.

### 27.2 Integration test per jalur

#### Penelitian

- guidance fact valid;
- akademik valid;
- CEPT valid;
- draft skripsi valid;
- requirement conditional sesuai policy;
- Sekprodi verify menerbitkan satu fact valid.

#### Magang

- laporan/logbook sesuai policy Magang;
- item Penelitian yang tidak berlaku menjadi `not_applicable`;
- verifikasi dan fact terikat siklus Magang.

#### Perintisan Bisnis

- tiga anggota dievaluasi individual;
- satu anggota tidak memenuhi CEPT tidak mengubah status anggota lain;
- context kelompok tetap dapat ditelusuri;
- fact tiap anggota berbeda.

### 27.3 Siklus

- siklus baru;
- ulang pada jalur yang sama tidak memakai fact siklus lama;
- alih tidak memakai dokumen/fact jalur asal tanpa rule carry-over eksplisit;
- semester transition assignment tidak mengubah cycle registration;
- assignment pengganti tetap dapat melanjutkan task yang sah.

### 27.4 Akademik

- snapshot missing menghasilkan undetermined;
- snapshot stale/failed/conflicted memblokir rule blocking;
- SKS di bawah/tepat/di atas threshold;
- mata kuliah wajib belum lulus;
- Metodologi sedang mengambil/tidak lulus/lulus;
- koreksi akademik setelah verify menginvalidasi fact;
- revoke correction memicu re-evaluation;
- rule akademik shadow tidak memblokir.

### 27.5 Bimbingan

- guidance fact missing;
- fact checksum salah;
- fact berasal dari siklus lain;
- fact invalidated setelah verify;
- approval scope belum lengkap;
- perubahan policy readiness;
- invalidasi resume membuat defense fact stale.

### 27.6 Evidence dan CEPT

- file kosong, MIME palsu, extension salah, terlalu besar;
- checksum sama dan upload retry;
- scan pending/infected;
- versi baru mensupersede versi lama;
- review versi lama tidak dapat diterapkan ke versi baru;
- skor CEPT di bawah batas;
- CEPT expired;
- CEPT valid saat verify tetapi expired sebelum tanggal sidang;
- data sertifikat tidak cocok dengan file;
- akses download lintas mahasiswa ditolak.

### 27.7 Workflow dan otorisasi

- mahasiswa tidak dapat review;
- dosen tanpa assignment/task ditolak;
- dosen lama setelah transfer tidak dapat mutate;
- Sekprodi dapat verify pada scope prodi;
- Admin tidak otomatis dapat verify;
- hold/unhold membutuhkan version dan alasan;
- invalidasi membutuhkan konfirmasi;
- retry identik mengembalikan hasil pertama;
- key sama dengan payload berbeda menghasilkan 409.

### 27.8 Concurrency

- dua create verification pada siklus sama;
- upload finalize ganda;
- dua reviewer memproses versi sama;
- verify bersamaan dengan evidence revision;
- verify bersamaan dengan academic correction;
- invalidation bersamaan dengan scheduling;
- dua policy diaktifkan pada scope sama;
- auto-assign dan manual assign pada fact yang sama.

Hasil harus deterministik, tidak menggandakan fact/event/notifikasi, dan transaksi yang kalah mendapat conflict yang dapat ditindaklanjuti.

### 27.9 Penjadwalan

- register tanpa fact ditolak;
- fact invalid/stale/expired ditolak;
- fact milik mahasiswa/siklus lain ditolak;
- checksum mismatch ditolak;
- manual, auto, bulk, dan reschedule memakai gate sama;
- invalidasi setelah jadwal membuat follow-up tanpa menghapus jadwal;
- transaksi penjadwalan rollback jika fact berubah sebelum commit.

### 27.10 Legacy dan Pengabdian

- histori `DokumenSidang` lama tetap terbaca;
- approved legacy tidak otomatis menerbitkan fact;
- context ambiguous tidak dianggap verified;
- create Pengabdian ditolak;
- histori Pengabdian tetap terbaca;
- backfill dapat dijalankan ulang tanpa duplikasi.

### 27.11 Frontend

- checklist blocking/warning/shadow tampil berbeda;
- histori evidence version;
- reason code dan kekurangan;
- stale banner;
- modal konfirmasi hold/invalidate;
- optimistic conflict meminta reload;
- policy management;
- reviewer task resolution;
- fact status pada halaman penjadwalan;
- responsive layout dan keyboard accessibility.

## 28. Observability dan operasi

Metric minimum:

- verification per status dan jalur;
- rata-rata waktu dari submit ke verify;
- kekurangan terbanyak per requirement;
- jumlah stale/invalidation per source;
- policy resolution failure;
- checksum mismatch;
- idempotency replay/conflict;
- scheduling gate rejection;
- CEPT mendekati expiry;
- outbox retry/dead-letter;
- perbedaan shadow versus legacy gate.

Structured log hanya memuat ID teknis, reason code, version, correlation ID, dan timing. Jangan mencatat isi dokumen, nomor sertifikat, nilai lengkap, atau catatan review sensitif.

Runbook minimum:

- re-evaluate satu verification;
- replay outbox;
- reconcile dependency;
- memperbaiki context ambiguous;
- memverifikasi checksum file;
- menangani fact invalid setelah jadwal;
- rollback enforcement ke shadow tanpa menghapus data.

## 29. Risiko dan mitigasi

| Risiko | Mitigasi |
| --- | --- |
| Rule akademik belum disahkan | shadow/informational sampai keputusan eksplisit |
| Status legacy dianggap setara verified | gunakan `approved_legacy`, wajib rekonsiliasi |
| Source berubah setelah verify | dependency registry dan fact invalidation |
| Controller berbeda memakai gate berbeda | satu shared `DefenseSchedulingGateService` |
| CEPT valid saat verify tetapi expired saat sidang | recheck terhadap tanggal jadwal |
| File ditimpa | evidence version immutable |
| Retry menggandakan keputusan/fact | command receipt dan unique constraint |
| Race verify vs correction | row lock, source version, checksum, dan transaction recheck |
| Bulk review menghasilkan partial state tersembunyi | hasil per aggregate dan transaksi eksplisit |
| Pengabdian ikut aktif tanpa sengaja | active-track guard pada service dan test |
| Data sensitif bocor | storage privat, endpoint terotorisasi, metadata minimal |

## 30. Definition of Done

Tahap 8 dianggap selesai jika:

1. Policy persyaratan berversi tersedia untuk Penelitian, Magang, dan Perintisan Bisnis.
2. Database mencegah dua policy aktif pada scope yang sama.
3. Setiap verifikasi terikat mahasiswa, pendaftaran, jalur, cycle type, program, periode, dan assignment.
4. Academic snapshot dan GuidanceReadinessFact dikonsumsi berdasarkan ID/version/checksum.
5. Rule shadow tidak memblokir dan ditandai jelas.
6. CEPT menyimpan skor, tanggal tes, expiry, issuer, status, reviewer, dan evidence version.
7. Dokumen/bukti mempunyai histori versi immutable.
8. Setiap item mempunyai status, evaluator/reviewer, waktu, reason code, dan fakta sumber.
9. Sekprodi dapat hold, unhold, verify, invalidate, dan melihat audit.
10. Verifikasi final menerbitkan `DefenseVerificationFact` yang berversi dan ber-checksum.
11. Perubahan sumber menginvalidasi fact tanpa menghapus histori.
12. Register, manual scheduling, auto scheduling, bulk scheduling, dan reschedule menolak fact tidak valid.
13. Invalidasi setelah jadwal menghasilkan follow-up yang teraudit.
14. Seluruh write path baru memakai idempotency dan optimistic concurrency.
15. Penelitian, Magang, Perintisan, baru, ulang, alih, dan semester transition lulus integration test.
16. Concurrency test dan bypass API test lulus.
17. Histori Pengabdian tetap terbaca dan create baru ditolak.
18. Backfill legacy idempoten dan tidak menghapus data.
19. Build frontend, migration test, rollback test, integration test, security test, dan UAT lulus.
20. Tidak ada mahasiswa yang dapat memperoleh jadwal baru tanpa `DefenseVerificationFact` valid.

## 31. Handoff ke Tahap 9

Tahap 8 menyerahkan kontrak berikut:

```json
{
  "defense_verification_fact_id": 1201,
  "defense_verification_id": 881,
  "mahasiswa_id": 42,
  "pendaftaran_penjaluran_id": 310,
  "policy_id": 17,
  "policy_version": 3,
  "fact_version": 2,
  "status": "valid",
  "valid_until": "2027-05-14",
  "checksum": "sha256:...",
  "blocking_requirements": {
    "valid": 10,
    "invalid": 0,
    "undetermined": 0
  }
}
```

Tahap 9 tidak menerima boolean `eligible: true` tanpa fact identity. Tahap 9 wajib melakukan recheck fact di dalam transaksi penjadwalan dan menyimpan fact version/checksum yang digunakan.
