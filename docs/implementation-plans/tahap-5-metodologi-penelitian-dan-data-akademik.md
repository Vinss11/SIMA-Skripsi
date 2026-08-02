# Rancangan Pengerjaan Tahap 5 — Metodologi Penelitian dan Data Akademik

## 1. Tujuan

Menyediakan data akademik terstruktur, dapat diaudit, dan dapat diganti sumbernya tanpa mengubah aturan bisnis. Fokus tahap ini adalah histori Metodologi Penelitian, mata kuliah dan nilai, total SKS, data kurikulum, snapshot akademik, serta evaluasi eligibility yang dapat dipakai oleh penjaluran, ulang/alih, izin lanjut, verifikasi pendadaran, dan laporan.

Hasil akhirnya harus memungkinkan sistem menjawab:

- apa status Metodologi Penelitian mahasiswa pada setiap semester;
- nilai dan percobaan mata kuliah yang mendasari status tersebut;
- berapa total SKS yang diambil dan lulus;
- mata kuliah wajib mana yang sudah atau belum lulus;
- dari sumber dan batch mana data berasal;
- kapan data berubah dan siapa yang mengoreksi;
- rule versi berapa yang menghasilkan keputusan eligible/blocked;
- apakah hasil evaluasi pasti atau belum dapat ditentukan karena data belum lengkap.

## 2. Acuan aturan bisnis

Rancangan mengacu pada:

- BR-ROLE-001 dan BR-ROLE-002;
- BR-PERIODE-001;
- BR-AKADEMIK-001 dan BR-AKADEMIK-002;
- BR-SIDANG-001 dan BR-SIDANG-002;
- BR-AUDIT-001 sampai BR-AUDIT-004.

Aturan yang sudah dapat diimplementasikan:

- histori Metodologi mempunyai status `belum_mengambil`, `sedang_mengambil`, `lulus`, `tidak_lulus`, atau `mengulang`;
- histori menyimpan periode, nilai bila tersedia, sumber data, dan waktu perubahan;
- status tidak disimpan sebagai teks alasan bebas;
- sebelum integrasi akademik tersedia, Admin dapat mengimpor data dengan preview, validasi, dan laporan error;
- sistem harus menyimpan transkrip, total SKS, mata kuliah wajib, dan status Metodologi sebagai data persyaratan pendadaran;
- setiap item verifikasi menyimpan status, pemeriksa, waktu, dan catatan;
- kekurangan mahasiswa harus ditampilkan secara terstruktur.

Aturan yang belum boleh diasumsikan:

- status/nilai Metodologi yang mengizinkan pendaftaran jalur Penelitian;
- apakah Metodologi memblokir ulang/alih atau izin lanjut;
- nilai minimum kelulusan Metodologi bila status tidak diberikan sumber;
- daftar mata kuliah wajib dan versi kurikulum yang berlaku;
- minimum total SKS pendadaran;
- penggunaan IP/IPK sebagai gate;
- urutan prioritas ketika data integrasi, import, dan koreksi Admin berbeda.

Sebelum keputusan tersebut disahkan, data tetap disimpan dan ditampilkan, tetapi rule terkait berjalan sebagai `informational` atau `shadow`, bukan hard blocker.

## 3. Batas tahap

### 3.1 Termasuk Tahap 5

- semester akademik kanonik untuk data akademik;
- master kurikulum dan mata kuliah minimum yang diperlukan untuk evaluasi;
- histori percobaan mata kuliah mahasiswa;
- histori status Metodologi Penelitian;
- import Excel melalui upload, preview, commit, dan laporan hasil;
- koreksi Admin dengan alasan dan audit;
- snapshot akademik terhitung;
- rule engine eligibility berversi;
- integrasi read-only/advisory ke Penelitian, ulang/alih, izin lanjut, dan pendadaran;
- endpoint Admin, Sekprodi, dan mahasiswa;
- rekonsiliasi, keamanan data, observability, dan pengujian.

### 3.2 Tidak termasuk Tahap 5

- integrasi langsung ke sistem akademik eksternal;
- perubahan keputusan eligibility Penelitian sebelum BR disahkan;
- digitalisasi seluruh fitur KRS/KHS universitas;
- pengelolaan pembayaran, cuti, status registrasi, atau kalender kuliah penuh;
- OCR transkrip PDF sebagai sumber data otoritatif;
- penggantian workflow upload/approval dokumen transkrip sidang;
- penjadwalan dan penilaian sidang selain adapter eligibility;
- perubahan nilai akademik pada sistem sumber eksternal.

Dokumen transkrip di `DokumenSidang` dan data transkrip terstruktur mempunyai fungsi berbeda. Approval dokumen membuktikan berkas telah diperiksa; record akademik terstruktur menjadi dasar perhitungan SKS/mata kuliah. Salah satunya tidak otomatis menggantikan yang lain.

## 4. Istilah dan sumber kebenaran

| Konsep | Sumber kebenaran |
| --- | --- |
| Semester akademik | `PeriodeAkademik` kanonik |
| Mata kuliah | master `MataKuliah` beserta alias kode |
| Kurikulum mahasiswa | assignment kurikulum yang berlaku bagi mahasiswa |
| Percobaan mata kuliah | record immutable/versioned per mahasiswa, mata kuliah, dan semester |
| Status Metodologi per semester | histori Metodologi yang terhubung ke attempt/sumber |
| Status Metodologi terkini | projection dari histori efektif terbaru, bukan kolom teks mahasiswa |
| Total SKS/mata kuliah wajib | snapshot hasil kalkulasi dari record kanonik |
| Dokumen transkrip | `DokumenSidang`, bukan sumber hitungan mata kuliah |
| Keputusan eligibility | hasil evaluasi rule berversi terhadap snapshot tertentu |
| Data mentah import | baris import immutable untuk audit, bukan langsung sumber UI |

`PeriodePenjaluran` hanya jendela pendaftaran dan dapat mempunyai lebih dari satu record pada semester akademik yang sama. Karena itu data akademik tidak boleh mengandalkan `periode_penjaluran_id` sebagai identitas semester kanonik.

## 5. Kontrak domain

### 5.1 Periode akademik kanonik

Buat `PeriodeAkademik` dengan data minimum:

- `kode`: kode internal stabil, misalnya `2026-2027-GANJIL`;
- `external_id`, nullable untuk integrasi mendatang;
- `tahun_mulai`, misalnya `2026`;
- `tahun_selesai`, misalnya `2027`;
- `tahun_akademik` sebagai label kompatibilitas `2026/2027`, bila masih dibutuhkan API lama;
- `semester`: `ganjil` atau `genap`;
- tanggal mulai/selesai akademik bila tersedia;
- status `draft`, `active`, atau `closed`;
- sumber dan metadata audit.

Unique constraint berlaku pada `kode` dan `(tahun_mulai, tahun_selesai, semester)`. Validator memastikan `tahun_selesai = tahun_mulai + 1`. `PeriodePenjaluran` ditambah `periode_akademik_id` secara additive agar penjaluran dan assignment memakai identitas semester yang sama tanpa mengubah fungsi jendela pendaftaran.

### 5.2 Data kosong bukan “belum mengambil”

Sistem membedakan:

- `data_state = available`: sumber menyatakan status akademik;
- `data_state = unavailable`: belum ada data otoritatif;
- `data_state = incomplete`: sebagian data tersedia tetapi tidak cukup untuk evaluasi;
- `data_state = conflicted`: terdapat sumber aktif yang bertentangan.

`belum_mengambil` hanya disimpan jika sumber secara eksplisit menyatakannya atau dapat dibuktikan dari dataset lengkap pada semester tersebut. Tidak adanya row tidak boleh otomatis dianggap `belum_mengambil`, `tidak_lulus`, atau blocker.

Bukti kelengkapan disimpan pada `CakupanDatasetAkademik`, bukan hanya metadata bebas pada batch. Data minimum:

- batch/source revision;
- `dataset_type`;
- mahasiswa nullable untuk cakupan cohort/global;
- periode akademik;
- `scope_type`: `student`, `cohort`, atau `program`. Scope `global` belum didukung agar deklarasi kelengkapan selalu memiliki batas program studi/program kuliah yang eksplisit;
- scope program studi/program kuliah bila relevan;
- `is_complete`;
- `declared_by_source` dan `declared_at`;
- metadata/filter cakupan serta checksum.

Kesimpulan berbasis absensi hanya boleh dibuat jika terdapat tepat satu deklarasi completeness aktif yang mencakup mahasiswa, periode, dan dataset terkait. Deklarasi yang tumpang tindih atau bertentangan menghasilkan `data_state = conflicted`.

### 5.3 Histori Metodologi

Allowed status bisnis:

| Status | Makna |
| --- | --- |
| `belum_mengambil` | Dataset lengkap menyatakan mata kuliah belum pernah diambil sampai semester tersebut |
| `sedang_mengambil` | Terdaftar pada semester berjalan dan belum mempunyai hasil final |
| `lulus` | Hasil final memenuhi kriteria kelulusan sumber/rule resmi |
| `tidak_lulus` | Hasil final tidak memenuhi kelulusan |
| `mengulang` | Mengambil kembali setelah attempt yang tidak lulus/ditarik sesuai data sumber |

Transisi normal:

| Dari | Event | Menjadi |
| --- | --- | --- |
| Tidak ada + dataset lengkap | Belum pernah mengambil | `belum_mengambil` |
| `belum_mengambil` | KRS/record mengambil | `sedang_mengambil` |
| `sedang_mengambil` | Nilai lulus final | `lulus` |
| `sedang_mengambil` | Nilai tidak lulus final | `tidak_lulus` |
| `tidak_lulus` | Mengambil pada semester berikutnya | `mengulang` |
| `mengulang` | Nilai lulus final | `lulus` |
| `mengulang` | Nilai tidak lulus final | `tidak_lulus` |

Import koreksi tidak mengedit event lama. Ia menonaktifkan/supersede record salah dan membuat versi baru dengan referensi record sebelumnya.

### 5.4 Attempt mata kuliah

Satu attempt minimum menyimpan:

- mahasiswa;
- mata kuliah;
- periode akademik;
- nomor attempt bila sumber menyediakannya;
- kelas/external record ID bila tersedia;
- SKS diambil dan SKS lulus;
- nilai huruf, nilai angka, dan status hasil secara nullable;
- status registrasi `planned`, `enrolled`, `completed`, `withdrawn`, atau `cancelled`;
- status kelulusan `passed`, `failed`, atau `unknown`;
- sumber, import row, waktu efektif, dan versi.

Nilai angka `0` berbeda dari nilai kosong. Parsing tidak boleh menggunakan truthy/falsy untuk nilai.

Natural key attempt:

- prioritas pertama: `(source_id, external_record_id)` ketika external ID tersedia;
- fallback: `(source_id, mahasiswa_id, mata_kuliah_id, periode_akademik_id, kelas_normalized, attempt_ke)`;
- jika sumber tidak memberi `attempt_ke`, sistem menghitungnya deterministik dari histori lintas periode, tetapi menyimpan `attempt_number_source = calculated`;
- jika sumber memberi nomor, simpan `attempt_number_source = source` dan validasi urutannya.

Dua kelas mata kuliah sama pada semester yang sama tidak otomatis dianggap duplikat. Resolver harus memahami status registrasi dan external ID. Kasus `withdrawn` lalu `enrolled` ulang, transfer credit, konversi, MBKM, serta `waived/exempted` memakai `credit_origin` dan `recognition_status` terstruktur. SKS yang diakui hanya dihitung setelah aturan ekuivalensi/pengakuan menyatakan valid.

### 5.5 Kurikulum dan mata kuliah wajib

Model minimum:

- `Kurikulum`: kode, nama, program studi, program kuliah, periode berlaku mulai/selesai, dan status;
- `MataKuliah`: kode kanonik, nama, SKS, scope institusi/program studi, dan status;
- `MataKuliahAlias`: alias kode dari sumber lama/integrasi;
- `KelompokEkuivalensiMataKuliah`: identitas kelompok substitusi dan dasar keputusan;
- `EkuivalensiMataKuliah`: kelompok, mata kuliah, kurikulum, masa berlaku, arah pengakuan, dan dasar keputusan;
- `KurikulumMataKuliah`: mata kuliah, wajib/pilihan, SKS, kategori, semester rekomendasi;
- `MahasiswaKurikulum`: mahasiswa, kurikulum, tanggal/periode berlaku, sumber.

`program_studi_id` digunakan bila master program studi tersedia; jika belum, gunakan `kode_program_studi` terkontrol dan siapkan FK migration berikutnya. `program_kuliah` minimal membedakan `reguler` dan `internasional` bila kurikulumnya berbeda. Kode kurikulum/mata kuliah tidak diasumsikan unik global; unique key menyertakan scope institusi/prodi yang relevan.

Alias dan ekuivalensi tidak sama:

- alias berarti kode berbeda menunjuk mata kuliah kanonik yang sama;
- ekuivalensi berarti mata kuliah berbeda diakui memenuhi requirement satu sama lain menurut kurikulum, arah, dan masa berlaku.

Metodologi ditandai melalui kategori/role mata kuliah, bukan pencocokan nama bebas. Calculator memakai ekuivalensi untuk mencegah SKS ganda, memenuhi mata kuliah wajib dengan pengganti yang sah, dan menangani perpindahan kurikulum tanpa false blocker.

### 5.6 Snapshot akademik

Snapshot adalah hasil kalkulasi immutable untuk mahasiswa pada suatu cutoff. Data minimum:

- mahasiswa dan kurikulum;
- periode/cutoff akademik;
- total SKS diambil;
- total SKS lulus;
- IP semester dan IPK bila sumber/aturan memerlukannya;
- jumlah mata kuliah wajib dan yang lulus;
- daftar kode wajib yang belum lulus;
- status Metodologi terkini;
- `data_state` dan daftar masalah kualitas data;
- source revision/batch terakhir;
- calculation version dan `calculated_at`;
- checksum input.

Snapshot tidak dikoreksi manual. Koreksi dilakukan pada record sumber kanonik, kemudian snapshot dihitung ulang.

Status proses kalkulasi disimpan terpisah dari kualitas data:

- `queued`;
- `calculating`;
- `ready`;
- `failed`;
- `stale`.

`calculation_status = failed` berarti proses sistem gagal, meskipun input mungkin lengkap. `data_state = incomplete` berarti kalkulasi berhasil membaca input tetapi fakta akademiknya belum lengkap. Consumer hanya memakai snapshot `ready`; status lain menghasilkan effective decision yang aman sesuai konteks dan reason code proses.

### 5.7 Evaluasi eligibility

Hasil rule engine mempunyai tiga state:

- `eligible`;
- `blocked`;
- `undetermined` karena data belum tersedia, tidak lengkap, atau konflik.

Setiap evaluasi menyimpan:

- konteks: `research_registration`, `change_track`, `extension`, `defense_verification`, atau `reporting`;
- mahasiswa, pendaftaran/siklus bila relevan;
- snapshot akademik;
- rule-set ID dan versi;
- mode rule: `informational`, `shadow`, atau `enforced`;
- `evaluated_result`: `eligible`, `blocked`, atau `undetermined` sebagai hasil kalkulasi rule;
- `effective_decision`: `allow`, `block`, atau `warn` sebagai dampak pada flow;
- reason codes, input facts, waktu, dan correlation ID.

Mapping minimum:

| Mode | Evaluated result | Effective decision |
| --- | --- | --- |
| `informational` | apa pun | `allow` atau `warn`, tidak pernah `block` |
| `shadow` | `blocked`/`undetermined` | `allow` dengan warning dan telemetry |
| `enforced` | `eligible` | `allow` |
| `enforced` | `blocked` | `block` |
| `enforced` | `undetermined` | mengikuti kebijakan fail-open/fail-closed yang disahkan per konteks |

Consumer wajib membaca `effective_decision`, bukan mengartikan `evaluated_result` secara langsung.

Reason code minimum:

- `ACADEMIC_DATA_UNAVAILABLE`;
- `ACADEMIC_DATA_INCOMPLETE`;
- `ACADEMIC_DATA_CONFLICTED`;
- `METHODOLOGY_NOT_TAKEN`;
- `METHODOLOGY_IN_PROGRESS`;
- `METHODOLOGY_NOT_PASSED`;
- `MINIMUM_CREDITS_NOT_MET`;
- `REQUIRED_COURSES_INCOMPLETE`;
- `TRANSCRIPT_DOCUMENT_NOT_APPROVED`;
- `RULE_NOT_ENFORCED`;
- `ELIGIBLE`.

Rule yang belum final mengembalikan fakta dan hasil shadow, tetapi tidak mengubah `eligible` flow utama.

### 5.8 Invariant global

1. NIM dinormalisasi dan dicocokkan ke tepat satu mahasiswa.
2. Satu kode periode akademik menunjuk tepat satu semester.
3. Mata kuliah sumber harus cocok ke kode kanonik/alias yang unik.
4. Satu external attempt ID hanya dapat mengaktifkan satu versi record.
5. Exact replay import tidak membuat attempt, histori, snapshot, atau audit ganda.
6. Raw import dan record lama tidak dihapus setelah commit.
7. Koreksi selalu menyimpan before/after, alasan, aktor, waktu, dan record yang digantikan.
8. Mahasiswa tidak dapat mengoreksi data akademik sendiri.
9. Admin mengelola/import data; Sekprodi memverifikasi persyaratan, bukan mengubah nilai sumber tanpa wewenang.
10. Missing data tidak diperlakukan sebagai nilai/status negatif.
11. Projection status terkini selalu dapat ditelusuri ke histori aktif.
12. Snapshot selalu dapat direproduksi dari input version dan calculation version.
13. Keputusan kritis menyimpan evaluation snapshot; perubahan data sesudahnya tidak mengubah histori keputusan lama.
14. Sebelum commit tindakan kritis, eligibility dihitung ulang di dalam transaksi atau terhadap revision yang dikunci.
15. Rule version tidak diedit setelah pernah dipakai; buat versi baru.
16. Import preview tidak mengubah data kanonik.
17. Commit batch bersifat idempotent dan transaksional.
18. Formula/file Excel tidak pernah dieksekusi sebagai kode.
19. Data akademik sensitif hanya terlihat sesuai object-level authorization.
20. Integrasi mendatang memakai kontrak ingestion yang sama, bukan menulis langsung ke tabel projection.

## 6. Kontrak data target

### 6.1 Tabel inti

Tabel yang disarankan:

```text
PeriodeAkademik
SumberDataAkademik
Kurikulum
MataKuliah
MataKuliahAlias
KelompokEkuivalensiMataKuliah
EkuivalensiMataKuliah
KurikulumMataKuliah
MahasiswaKurikulum
PercobaanMataKuliahMahasiswa
RiwayatMetodologiPenelitian
CakupanDatasetAkademik
SnapshotAkademikMahasiswa
RuleSetAkademik
EvaluasiEligibilityAkademik
ImportAkademikBatch
ImportAkademikRow
KoreksiDataAkademik
KonflikDataAkademik
PekerjaanSnapshotAkademik
OutboxAkademik
```

Gunakan nama tabel sesuai konvensi repository, tetapi jangan mencampur batch/raw row dengan record kanonik.

`SumberDataAkademik` menyimpan kode sumber, jenis `manual_import`/`integration`/`admin_correction`, scope institusi/prodi, authority level yang sudah disahkan, status aktif, dan metadata koneksi nonrahasia. Credential integrasi tidak disimpan pada tabel ini. Semua natural key serta conflict resolution mereferensikan `source_id` yang stabil.

### 6.2 Batch import

Lifecycle batch:

| Dari | Aksi | Menjadi |
| --- | --- | --- |
| Tidak ada | Upload valid | `uploaded` |
| `uploaded` | Mulai validasi | `validating` |
| `validating` | Validasi selesai | `validated` atau `invalid` |
| `validated` | Commit | `committing` → `committed` |
| `committing` | Transaksi fakta gagal | Fakta rollback; batch menjadi `failed` melalui transaksi terpisah |
| `uploaded`/`validating`/`validated` | Error proses | `failed` |
| `uploaded`/`validated` | Batalkan | `cancelled` |
| `uploaded`/`validated` | Preview melewati masa berlaku | `expired` |
| `committed` | Commit ulang | Replay hasil lama |

Batch menyimpan:

- tipe dataset dan schema version;
- nama file aman, ukuran, MIME terdeteksi, SHA-256;
- sumber dan external revision;
- periode akademik/cutoff;
- aktor upload/commit;
- counts total/valid/invalid/create/update/noop/conflict;
- status, waktu tiap fase, dan error summary;
- `preview_expires_at`, `validated_checksum`, dan `validated_schema_version`;
- idempotency key.

Transaksi fakta dan pencatatan failure dipisahkan. Jika commit fakta gagal, transaksi fakta di-rollback terlebih dahulu; setelah itu status batch `failed`, error summary tersanitasi, dan attempt metadata dicatat melalui transaksi baru. Dengan demikian status failure tidak ikut hilang karena rollback yang sama.

### 6.3 Raw row dan hasil validasi

Setiap row menyimpan:

- nomor sheet/baris;
- payload mentah terkarantina sebagai data, termasuk tipe cell dan indikator formula;
- payload ternormalisasi;
- resolved mahasiswa/periode/mata kuliah;
- action `create`, `supersede`, `noop`, atau `conflict`;
- error/warning codes per field;
- fingerprint row;
- record hasil setelah commit.

Raw payload mempertahankan bukti asli dan tidak pernah dievaluasi sebagai formula. Sanitasi dilakukan saat rendering atau ekspor, bukan dengan merusak data mentah. Formula-injection sanitizer hanya diterapkan pada cell bertipe string saat ekspor CSV/XLSX. Nilai numerik negatif tetap numerik dan tidak boleh diubah hanya karena diawali karakter `-` pada representasi teks.

`KonflikDataAkademik` menyimpan kedua sumber/record yang bertentangan, daftar field konflik, status `open`, `resolved`, atau `dismissed`, keputusan resolusi, aktor, waktu, dan audit. Conflict tidak boleh hanya menjadi flag pada raw row karena dapat tetap hidup setelah batch selesai.

`PekerjaanSnapshotAkademik` menyimpan mahasiswa, target source revision/checksum, calculation version, status `queued`, `processing`, `completed`, atau `failed`, attempt count, last error, next retry, serta timestamp. `OutboxAkademik` menyimpan event fakta committed, correction, conflict resolution, dan rule activation sampai consumer/job memprosesnya secara idempotent.

### 6.4 Source precedence dan koreksi

Jangan menerapkan last-write-wins berdasarkan waktu upload. Resolver record efektif mempertimbangkan:

- identitas record eksternal;
- versi/revision sumber;
- status supersede;
- koreksi Admin aktif;
- konflik yang belum diselesaikan.

Koreksi Admin minimum menyimpan:

- target entity dan record;
- field before/after;
- alasan wajib;
- bukti/reference opsional;
- aktor dan waktu;
- status `active`, `superseded`, atau `revoked`;
- reference ke koreksi sebelumnya.

Import berikutnya tidak boleh diam-diam menimpa koreksi aktif. Preview menandainya sebagai conflict dan meminta resolusi eksplisit: pertahankan koreksi, terima sumber baru, atau buat koreksi baru.

## 7. Kontrak template import

### 7.1 Dataset minimum

Pisahkan template agar error mudah dilacak:

1. master kurikulum dan mata kuliah;
2. assignment kurikulum mahasiswa;
3. hasil/attempt mata kuliah;
4. status Metodologi bila sumber menyediakannya langsung;
5. snapshot ringkas akademik hanya untuk pembanding, bukan pengganti attempt.

Template attempt minimum:

```text
nim
kode_periode
kode_mata_kuliah
attempt_ke (opsional)
sks
nilai_huruf (opsional)
nilai_angka (opsional)
status_registrasi
status_kelulusan (opsional)
external_record_id (disarankan)
external_revision (opsional)
```

### 7.2 Validasi upload

- extension dan MIME harus diizinkan;
- ukuran file, jumlah sheet, baris, dan kolom dibatasi;
- nama sheet dan header harus cocok schema version;
- file terenkripsi, macro-enabled, rusak, atau zip bomb ditolak;
- whitespace, casing kode, NIM, nilai desimal, dan tanggal dinormalisasi;
- formula tidak dievaluasi;
- duplicate di dalam file dideteksi sebelum query database;
- deduplication scope memasukkan dataset type, source, periode/cutoff, schema version, dan file hash;
- unknown NIM, periode, mata kuliah, alias ambigu, nilai invalid, dan kombinasi status tidak logis menjadi error terstruktur;
- warning tidak mengubah fakta dan harus dibedakan dari error blocker.

### 7.3 Preview

Preview menampilkan:

- ringkasan batch;
- create/update/noop/conflict/invalid;
- filter dan pencarian error;
- nilai lama dan baru untuk supersede;
- dampak jumlah mahasiswa/snapshot;
- downloadable error report;
- checksum dan waktu kedaluwarsa preview.

Preview disimpan server-side. Commit menerima `batch_id`, checksum preview, dan idempotency key—bukan mengirim ulang seluruh row dari frontend.

Preview yang melewati `preview_expires_at` berubah menjadi `expired` dan harus divalidasi ulang. Revalidation membuat checksum/schema validation baru serta mempertahankan histori hasil validasi sebelumnya untuk audit.

### 7.4 Commit

Default rancangan adalah all-or-nothing untuk satu batch: batch dengan row invalid/conflict tidak dapat di-commit. Admin memperbaiki file atau menyelesaikan conflict, kemudian melakukan validasi ulang.

Saat commit:

1. kunci batch dan pastikan masih `validated`;
2. pastikan preview belum expired dan validasi checksum/schema/source revision belum berubah;
3. kunci record kanonik yang akan diubah;
4. terapkan create/supersede dalam urutan deterministik;
5. buat histori Metodologi yang relevan;
6. buat audit korelasi batch;
7. antrekan recalculation snapshot setelah fakta kanonik commit;
8. ubah batch menjadi committed;
9. commit transaksi;
10. worker menghitung snapshot idempotent dan mencatat kegagalan untuk retry.

File bytes yang sama bukan exact replay bila dataset type, sumber, periode/cutoff, completeness scope, atau intent import berbeda. Exact replay hanya berlaku jika seluruh fingerprint bisnis sama; penggunaan file yang sama pada scope lain membuat batch terpisah atau conflict yang dapat dijelaskan.

Jika kalkulasi snapshot harus langsung memblokir/membuka tindakan pada request yang sama, lakukan recalculation mahasiswa terkait secara sinkron dalam transaksi terukur. Untuk batch besar, fakta commit atomik dan snapshot diproses melalui outbox/job dengan gate `ACADEMIC_SNAPSHOT_REFRESHING` sampai selesai.

## 8. Kondisi implementasi saat ini

### 8.1 Fondasi yang dapat dipakai

- upload Excel sudah menggunakan library `xlsx` dan middleware file upload;
- import mahasiswa dan template download sudah tersedia sebagai pola implementasi;
- periode menyimpan tahun akademik dan semester;
- `DokumenSidang` sudah menyimpan upload serta status approval transkrip;
- endpoint status sidang sudah mempunyai struktur eligibility dasar;
- role Admin, Sekprodi, dan mahasiswa sudah tersedia;
- audit/idempotensi telah menjadi pola pada Tahap 2–4.

### 8.2 Gap kritis

#### 8.2.1 Belum ada model akademik terstruktur

Belum ditemukan model Metodologi, mata kuliah, kurikulum, attempt, snapshot SKS, atau import batch akademik.

#### 8.2.2 Transkrip hanya berupa dokumen

`transkrip_status = approved` belum membuktikan total SKS atau mata kuliah wajib. Eligibility tidak boleh menghitung fakta akademik dari status file saja.

#### 8.2.3 Eligibility sidang masih terbatas

Flow sekarang terutama memeriksa minimum bimbingan dan tiga dokumen approved. Total SKS, mata kuliah wajib, status Metodologi, dan data_state belum menjadi reason terstruktur.

#### 8.2.4 Minimum bimbingan masih hard-coded

Konstanta minimum bimbingan di controller menunjukkan rule eligibility belum terpusat/bersistem versi. Tahap 5 tidak perlu menyelesaikan seluruh sidang, tetapi adapter akademik harus masuk ke rule engine terpusat, bukan menambah hard-code baru.

#### 8.2.5 Periode penjaluran bukan semester kanonik

Satu jendela pendaftaran tidak cukup sebagai identitas data KRS/KHS dan integrasi akademik lintas flow.

#### 8.2.6 Belum ada source precedence dan conflict resolution

Import manual, koreksi, dan integrasi mendatang dapat saling menimpa tanpa model versi serta resolver record efektif.

#### 8.2.7 Missing data berisiko menjadi false blocker

Tanpa `data_state`, sistem dapat salah menyamakan tidak ada data dengan belum mengambil/tidak lulus.

#### 8.2.8 Belum ada snapshot keputusan

Jika nilai diperbaiki setelah mahasiswa mendaftar, belum ada bukti rule/input apa yang dipakai pada keputusan sebelumnya.

#### 8.2.9 Belum ada endpoint integration test akademik

Belum ada test upload-preview-commit, exact replay, koreksi, konflik, snapshot, atau dampak rule terhadap endpoint konsumen.

## 9. Rencana pengerjaan

### Paket 0 — Keputusan domain dan baseline

1. Tetapkan secara resmi keputusan yang tercantum pada Bagian 15.
2. Inventarisasi format data akademik yang benar-benar tersedia dari pengelola akademik.
3. Tentukan owner data, SLA koreksi, dan siapa yang berhak menyetujui koreksi sensitif.
4. Ambil sampel file yang telah dianonimkan untuk menguji parser tanpa memakai data produksi mentah.
5. Buat characterization test eligibility sidang dan import existing.
6. Bekukan penambahan hard-coded akademik di controller lain.
7. Catat baseline test, build, migration, dan dry-run Tahap 1–4.

Hasil: schema tidak dibangun berdasarkan kolom Excel atau aturan kelulusan yang masih tebakan.

### Paket 1 — Semester akademik, kurikulum, dan mata kuliah

1. Buat migration additive untuk `PeriodeAkademik`.
2. Backfill periode unik dari `tahun_mulai/tahun_selesai/semester` yang dapat ditentukan dari metadata existing.
3. Tandai kombinasi duplikat/ambigu untuk manual review.
4. Tambahkan `periode_akademik_id` nullable pada `PeriodePenjaluran` dan validasi setiap jendela menunjuk tepat satu semester akademik.
5. Jangan memilih mapping otomatis jika tahun/semester ambigu atau tanggal akademik belum dapat dibuktikan.
6. Integrasikan dependency Tahap 4:
   - resolver semester/carry-forward memakai `PeriodeAkademik`;
   - jendela izin semester ke-3 dibuka tepat 30 hari sebelum `PeriodeAkademik.tanggal_mulai` berikutnya;
   - tanggal jendela `PeriodePenjaluran` tidak digunakan sebagai anchor izin;
   - assignment Tahap 4 yang periodenya tidak dapat dipetakan masuk manual review dan transisi diblokir.
7. Buat model kurikulum, mata kuliah, alias, kelompok ekuivalensi, ekuivalensi, kurikulum-mata kuliah, dan mahasiswa-kurikulum dengan scope prodi/program kuliah.
8. Tambahkan constraint/index kode, scope, masa berlaku, dan unique assignment kurikulum aktif mahasiswa.
9. Buat resolver alias dan ekuivalensi yang terpisah serta deterministik.

Hasil: semua record akademik memakai identitas semester dan mata kuliah yang stabil.

### Paket 2 — Attempt dan histori Metodologi

1. Buat tabel attempt versioned serta histori Metodologi.
2. Tambahkan foreign key ke mahasiswa, periode, mata kuliah, batch/row, dan previous version.
3. Tambahkan unique active version untuk external attempt ID atau fallback business key yang ditetapkan Bagian 5.4.
4. Implementasikan validator nilai, status registrasi, status kelulusan, dan transisi Metodologi.
5. Buat projection status Metodologi terkini per mahasiswa.
6. Pastikan status `mengulang` ditentukan dari urutan attempt, bukan input teks bebas saja.
7. Jangan membuat `belum_mengambil` dari absennya row tanpa dataset completeness marker.
8. Buat `CakupanDatasetAkademik` dan resolver overlap/conflict completeness.
9. Implementasikan status transfer, konversi, MBKM, waived/exempted, serta withdrawn/re-enrolled tanpa menghitung SKS ganda.

Hasil: histori Metodologi dapat ditelusuri per semester dan attempt.

### Paket 3 — Infrastruktur import

1. Buat tabel batch/raw row, conflict, snapshot job, outbox, dan state machine import lengkap.
2. Sediakan template berversi serta data dictionary.
3. Gunakan penyimpanan file sementara/private dengan retention terbatas.
4. Implementasikan parser streaming/chunk sejauh didukung library; batasi resource sebelum parsing penuh.
5. Normalisasi row tanpa menulis data kanonik.
6. Simpan error/warning code terstruktur.
7. Implementasikan preview server-side dan error report aman dari formula injection.
8. Implementasikan commit all-or-nothing, idempotency, row locking, dan outbox snapshot.
9. Catat batch failed menggunakan transaksi terpisah setelah transaksi fakta rollback.
10. Implementasikan expiry/revalidation preview.
11. Exact business fingerprint replay mengembalikan batch/hasil lama; file sama dengan dataset/periode/intent berbeda bukan replay.

Hasil: import dapat diperiksa sebelum memengaruhi eligibility.

### Paket 4 — Koreksi Admin dan resolusi konflik

1. Admin membuka detail record beserta source lineage.
2. Koreksi membutuhkan alasan dan expected revision.
3. Service mengunci record aktif dan menolak stale edit.
4. Buat versi baru serta audit before/after; jangan update in-place histori.
5. Tandai snapshot terdampak stale dan antrekan recalculation.
6. Import yang bertentangan dengan koreksi aktif masuk conflict queue.
7. Sediakan revoke/supersede correction, bukan delete.
8. Mahasiswa dapat melihat data dan petunjuk kontak/proses koreksi, tetapi tidak mengubahnya.

Hasil: koreksi dapat dipertanggungjawabkan dan tidak hilang pada import berikutnya.

### Paket 5 — Kalkulasi snapshot akademik

1. Buat calculator murni dan berversi.
2. Pilih record efektif pada cutoff secara deterministik.
3. Hitung SKS diambil/lulus tanpa menggandakan mata kuliah ekuivalen.
4. Terapkan kebijakan repeat/grade replacement yang sudah disahkan.
5. Evaluasi mata kuliah wajib berdasarkan kurikulum mahasiswa.
6. Ambil status Metodologi dari histori efektif.
7. Hitung IP/IPK hanya bila formula dan data lengkap tersedia.
8. Isi data_state serta masalah kualitas data.
9. Simpan checksum input agar recalculation identik menjadi noop.
10. Sediakan rebuild satu mahasiswa, satu batch, dan seluruh data dalam mode dry-run/execute.
11. Kelola lifecycle `queued/calculating/ready/failed/stale` dan job retry secara terpisah dari `data_state`.

Hasil: konsumen tidak menghitung akademik dengan query ad hoc.

### Paket 6 — Rule engine eligibility

1. Buat rule-set berversi dan tidak mutable setelah aktif.
2. Pisahkan konfigurasi threshold dari kode evaluator.
3. Evaluator menerima context, snapshot, dokumen, dan fakta nonakademik terkait.
4. Kembalikan `evaluated_result`, `effective_decision`, mode, reason codes, serta facts yang aman ditampilkan.
5. Persist evaluation untuk tindakan/keputusan kritis.
6. Re-evaluate sebelum commit bila snapshot revision berubah.
7. Jalankan rule yang belum final dalam mode shadow, pastikan consumer tetap membaca `effective_decision = allow/warn`, dan ukur perbedaan hasil.
8. Aktivasi `enforced` membutuhkan BR, konfigurasi, test, dan approval release.

Hasil: perubahan aturan tidak memerlukan penyebaran kondisi ke banyak controller.

### Paket 7 — Integrasi Penelitian, ulang/alih, dan izin lanjut

1. Tambahkan academic facts ke response eligibility tanpa mengubah keputusan existing terlebih dahulu.
2. Penelitian menampilkan status Metodologi dan kekurangan data.
3. Ulang/alih serta izin lanjut menyimpan evaluation snapshot bila rule dikonsultasikan.
4. Jangan memblokir jalur non-Penelitian hanya karena nama mata kuliah mengandung Metodologi.
5. Jika rule Penelitian disahkan, aktifkan melalui versioned rule-set, bukan controller condition.
6. Request dengan `undetermined` mengikuti kebijakan yang disahkan; default sebelum keputusan adalah tidak menjadi blocker baru dan diberi warning.

Hasil: data akademik siap dipakai tanpa mendahului keputusan bisnis.

### Paket 8 — Integrasi persyaratan pendadaran

Perluas service eligibility sidang secara terpusat:

1. lock mahasiswa/siklus ketika pendaftaran sidang akan di-commit;
2. ambil snapshot akademik terbaru yang tidak stale;
3. evaluasi total SKS, mata kuliah wajib, dan Metodologi melalui rule-set;
4. evaluasi approval dokumen transkrip secara terpisah;
5. gabungkan dengan bimbingan, persetujuan pembimbing, CEPT, draft, dan requirement lain;
6. kembalikan checklist per item dengan status `valid`, `invalid`, `pending`, atau `undetermined`;
7. simpan evaluation snapshot pada verifikasi/pendaftaran sidang;
8. Sekprodi dapat memverifikasi item sesuai BR-SIDANG-002, tetapi override fakta akademik harus melalui koreksi resmi;
9. mahasiswa hold bila ada item enforced yang invalid/pending sesuai aturan;
10. jangan mengganti status file transkrip berdasarkan hasil structured data secara otomatis.

Hasil: sistem dapat menjelaskan setiap kekurangan pendadaran tanpa pesan gabungan hard-coded.

### Paket 9 — API dan authorization

Endpoint target minimum:

```text
GET/POST      /api/admin/akademik/periode
PUT           /api/admin/akademik/periode/:id
GET/POST      /api/admin/akademik/sources
PUT           /api/admin/akademik/sources/:id
GET/POST      /api/admin/akademik/kurikulum
PUT           /api/admin/akademik/kurikulum/:id
GET/POST      /api/admin/akademik/mata-kuliah
PUT           /api/admin/akademik/mata-kuliah/:id
POST          /api/admin/akademik/mata-kuliah/:id/aliases
POST          /api/admin/akademik/equivalence-groups
PUT           /api/admin/akademik/equivalences/:id
POST          /api/admin/akademik/mahasiswa/:id/curriculum-assignment
GET  /api/admin/akademik/templates/:dataset
POST /api/admin/akademik/imports
GET  /api/admin/akademik/imports/:id/preview
POST /api/admin/akademik/imports/:id/revalidate
POST /api/admin/akademik/imports/:id/cancel
POST /api/admin/akademik/imports/:id/commit
GET  /api/admin/akademik/imports/:id/report
GET  /api/admin/akademik/mahasiswa/:id
POST /api/admin/akademik/records/:type/:id/corrections
POST /api/admin/akademik/corrections/:id/revoke
GET  /api/admin/akademik/conflicts
POST /api/admin/akademik/conflicts/:id/resolve
POST /api/admin/akademik/conflicts/:id/dismiss
GET  /api/admin/akademik/snapshot-jobs
POST /api/admin/akademik/snapshot-jobs/:id/retry
POST /api/admin/akademik/snapshots/rebuild
GET/POST /api/admin/akademik/rule-sets
POST /api/admin/akademik/rule-sets/:id/activate
POST /api/admin/akademik/rule-sets/:id/retire
GET  /api/admin/akademik/operations/failed
GET  /api/sekretaris/akademik/monitoring
GET  /api/sekretaris/akademik/mahasiswa/:id
GET  /api/mahasiswa/akademik
GET  /api/mahasiswa/akademik/eligibility
```

Endpoint `report` dan file mentah mengembalikan stream/download terotorisasi atau signed URL berumur pendek. Jika pengelolaan master dilakukan melalui import dataset khusus, endpoint mutasi master individual boleh menjadi readonly/ditiadakan, tetapi kontrak lifecycle, validasi, scope, dan auditnya tetap sama dan harus dinyatakan eksplisit.

Authorization:

- Admin mengelola import/master/koreksi sesuai scope;
- Sekprodi melihat data dan verifikasi eligibility, bukan mengedit nilai langsung;
- mahasiswa hanya membaca datanya sendiri;
- file mentah dan error report memakai signed/authorized download, bukan public path;
- seluruh endpoint menerapkan object-level authorization dan pembatasan program studi bila multi-prodi.

Error code minimum:

- `ACADEMIC_IMPORT_SCHEMA_INVALID`;
- `ACADEMIC_IMPORT_HAS_ERRORS`;
- `ACADEMIC_IMPORT_CONFLICT`;
- `ACADEMIC_IMPORT_ALREADY_COMMITTED`;
- `ACADEMIC_RECORD_STALE_REVISION`;
- `ACADEMIC_SOURCE_CONFLICT`;
- `ACADEMIC_SNAPSHOT_STALE`;
- `ACADEMIC_SNAPSHOT_REFRESHING`;
- `ACADEMIC_RULE_NOT_CONFIGURED`.

### Paket 10 — Frontend

#### Admin

- master periode akademik, kurikulum, mata kuliah, alias, dan ekuivalensi sesuai kewenangan;
- download template dan data dictionary;
- wizard upload → validasi → preview → commit → hasil;
- filter row valid/invalid/conflict/noop;
- perbandingan nilai lama/baru;
- error report;
- histori batch dan source lineage;
- detail mahasiswa serta koreksi/revoke dengan alasan.
- conflict queue beserta resolusi;
- monitoring/retry snapshot job dan outbox gagal;
- create/activate/retire rule-set dengan confirmation serta audit.

#### Sekprodi

- monitoring berdasarkan NIM, angkatan, kurikulum, periode, status Metodologi, SKS, missing required course, data_state, dan eligibility;
- detail readonly attempt, histori Metodologi, snapshot, dan evaluation reasons;
- checklist pendadaran tanpa tombol edit nilai.

#### Mahasiswa

- status Metodologi dan histori per semester;
- ringkasan SKS serta mata kuliah wajib yang belum terpenuhi;
- freshness/sumber data dalam label yang mudah dipahami;
- reason dan next action;
- petunjuk pengajuan koreksi, tanpa edit langsung.

UI tidak boleh menyimpulkan eligibility sendiri atau mengubah `undetermined` menjadi failed.

### Paket 11 — Audit, keamanan, dan privasi

- log upload/preview/commit/cancel/replay;
- log koreksi, revoke, conflict resolution, snapshot rebuild, dan rule activation;
- simpan checksum, bukan konten file, pada log umum;
- batasi akses file dan hapus file staging sesuai retention setelah raw row aman;
- sanitasi formula saat ekspor CSV/XLSX;
- jangan menampilkan nilai lengkap pada log aplikasi;
- tetapkan retention raw import dan audit sesuai kebijakan institusi;
- enkripsi transport dan storage sesuai fasilitas deployment;
- rate-limit upload, preview, commit, correction, dan report download.

### Paket 12 — Adapter integrasi akademik mendatang

Definisikan interface ingestion:

```text
ingestAcademicDataset({
  source,
  schemaVersion,
  externalRevision,
  completenessScope,
  rows,
  idempotencyKey
})
```

Import Excel dan integrasi API memakai pipeline validasi/commit yang sama. Adapter eksternal tidak boleh melewati raw lineage, conflict resolver, versioning, snapshot, atau audit.

### Paket 13 — Rekonsiliasi dan backfill

Sediakan `dry-run` dan `execute` untuk mendeteksi:

- NIM import tidak ditemukan atau ambigu;
- periode akademik duplikat/ambigu;
- mata kuliah/alias tidak ditemukan atau ambigu;
- multiple active version untuk attempt yang sama;
- fallback natural key collision dan attempt number tidak konsisten;
- nilai/status tidak konsisten;
- Metodologi lulus tanpa attempt/bukti sumber;
- urutan status Metodologi tidak logis;
- `belum_mengambil` yang dibuat dari dataset tidak lengkap;
- SKS snapshot tidak sama dengan recalculation;
- required course evaluation tanpa kurikulum;
- correction aktif yang tertimpa sumber baru;
- completeness scope tumpang tindih/bertentangan;
- conflict open yang tidak tercermin pada data_state;
- snapshot stale/failed tanpa job retry;
- outbox gagal/tertinggal;
- batch committed tanpa record hasil/audit;
- evaluation memakai snapshot/rule yang tidak ada;
- pendaftaran sidang eligible dengan item enforced invalid;
- document transcript approved tetapi structured data unavailable, dan sebaliknya.

Data ambigu tidak diperbaiki otomatis. Laporan memuat entity ID, reason code, tingkat keyakinan, serta rekomendasi aksi.

## 10. Strategi pengujian

### 10.1 Unit test

- normalisasi NIM, kode periode, mata kuliah, nilai, dan status;
- parsing kode `2026-2027-GANJIL` serta validasi tahun selesai;
- transisi Metodologi;
- missing versus belum mengambil;
- alias/equivalence mata kuliah;
- perbedaan alias dengan ekuivalensi berarah/bermasa berlaku;
- repeat/grade replacement policy;
- transfer credit, konversi, MBKM, waived/exempted, dan withdrawn/re-enrolled;
- perhitungan SKS/wajib/IPK;
- source resolver dan correction precedence;
- snapshot checksum;
- rule evaluation serta mode informational/shadow/enforced;
- formula injection sanitizer.

### 10.2 Integration test import

1. Template benar menghasilkan preview tanpa write kanonik.
2. Header/schema salah ditolak.
3. NIM/mata kuliah/periode unknown menghasilkan error per row.
4. Nilai 0 dipertahankan dan nilai kosong tetap null.
5. Duplicate intra-file dan database terdeteksi.
6. Batch invalid tidak dapat commit.
7. Commit membuat fakta, histori, audit, dan outbox secara atomik.
8. Satu kegagalan me-rollback seluruh batch.
9. Exact replay mengembalikan hasil sama tanpa duplikasi.
10. Commit paralel hanya menghasilkan satu hasil.
11. File macro/encrypted/oversize/formula berbahaya ditangani aman.
12. Error report tidak mengeksekusi formula saat dibuka.
13. Commit rollback tetap mencatat batch `failed` melalui transaksi terpisah.
14. Preview expired ditolak dan dapat direvalidasi.
15. File sama dengan dataset/periode/completeness scope berbeda bukan exact replay.
16. Numeric negatif tidak diubah formula sanitizer, sedangkan string berbahaya disanitasi saat ekspor.

### 10.3 Integration test koreksi dan snapshot

1. Koreksi membutuhkan Admin, alasan, dan expected revision.
2. Mahasiswa/Sekprodi tidak dapat mengubah nilai.
3. Stale correction ditolak.
4. Koreksi membuat versi baru dan snapshot baru.
5. Revoke mengaktifkan fakta efektif sebelumnya secara terkontrol.
6. Import baru tidak menimpa koreksi aktif tanpa resolusi.
7. Rebuild identik menjadi noop.
8. Data incomplete/conflicted menghasilkan snapshot `undetermined`.
9. Completeness per mahasiswa/periode mengizinkan kesimpulan absensi hanya dalam scope yang tepat.
10. Race import versus koreksi menghasilkan conflict/stale revision, bukan lost update.
11. Outbox gagal dapat di-retry tanpa snapshot ganda.
12. Snapshot calculation failed berbeda dari data_state incomplete.

### 10.4 Integration test eligibility

1. Rule Metodologi shadow dapat menghasilkan `evaluated_result = blocked` tetapi `effective_decision` tetap allow/warn dan Penelitian tidak diblokir.
2. Rule enforced memakai versi dan threshold yang aktif.
3. Missing data tidak disamakan dengan tidak lulus.
4. Ulang/alih dan izin menyimpan evaluation snapshot bila dipakai.
5. Perubahan nilai setelah keputusan tidak mengubah histori evaluation lama.
6. Revision berubah sebelum commit memicu re-evaluation.
7. Reason code stabil dan tidak bergantung pesan bebas.
8. Consumer yang mencoba memakai evaluated result sebagai keputusan langsung gagal contract test.

### 10.5 Integration test pendadaran

1. Transkrip file approved tetapi SKS tidak cukup tetap gagal pada item SKS.
2. Structured data lengkap tetapi file belum approved tetap gagal pada item dokumen.
3. Mata kuliah wajib kurang ditampilkan per kode.
4. Metodologi dievaluasi sesuai rule version.
5. Snapshot stale/refreshing tidak dianggap eligible.
6. Sekprodi dapat memverifikasi item tetapi tidak mengubah nilai.
7. Pendaftaran sidang menyimpan evaluation yang dipakai.
8. Request paralel tidak membuat verifikasi/pendaftaran ganda.

### 10.6 Integration test semester, scope, dan Tahap 4

1. Kode periode memakai tahun mulai/selesai dan unique `(tahun_mulai, tahun_selesai, semester)`.
2. Dua jendela `PeriodePenjaluran` pada semester sama menunjuk satu `PeriodeAkademik`.
3. Jendela dengan mapping ambigu tidak dipetakan otomatis.
4. Dua kurikulum untuk angkatan/program kuliah berbeda menghasilkan requirement yang sesuai.
5. Kode mata kuliah sama pada scope prodi berbeda tidak bentrok.
6. Alias memetakan satu mata kuliah yang sama; ekuivalensi memenuhi requirement tanpa menghitung SKS ganda.
7. Transfer/konversi SKS hanya dihitung setelah recognition valid.
8. Dua kelas mata kuliah yang sama dibedakan oleh natural key; withdrawn lalu enrolled ulang tidak menjadi duplicate palsu.
9. External ID kosong memakai fallback key, sedangkan external ID sama pada source berbeda tidak bentrok.
10. Jendela izin semester 3 belum terbuka 31 hari sebelum tanggal mulai, terbuka tepat 30 hari sebelumnya, dan memakai `PeriodeAkademik.tanggal_mulai`.
11. Assignment Tahap 4 dengan period mapping ambigu masuk manual review dan transisi diblokir.

### 10.7 Frontend dan authorization test

- wizard import mempertahankan state setelah refresh;
- double-click commit aman;
- filter dan pagination preview/monitoring benar;
- conflict dan perbandingan before/after terbaca;
- mahasiswa hanya melihat datanya;
- Sekprodi tidak melihat aksi koreksi;
- `undetermined` tampil berbeda dari `blocked`;
- file/report tidak dapat diakses tanpa otorisasi.

### 10.8 UAT minimum

1. Import mahasiswa yang belum mengambil Metodologi secara eksplisit.
2. Sedang mengambil → lulus.
3. Sedang mengambil → tidak lulus → mengulang → lulus.
4. Dataset tidak lengkap menghasilkan unknown, bukan belum mengambil.
5. Koreksi nilai dengan audit dan recalculation.
6. Import konflik dengan koreksi aktif.
7. Penelitian dalam mode shadow.
8. Pendadaran dengan SKS kurang.
9. Pendadaran dengan mata kuliah wajib kurang.
10. Dokumen transkrip approved tetapi data terstruktur belum tersedia.
11. Exact replay batch.
12. Rekonsiliasi data ambigu.
13. Dua jendela penjaluran pada satu semester akademik.
14. Dua kurikulum untuk angkatan/program kuliah berbeda.
15. Alias versus mata kuliah ekuivalen.
16. Transfer/konversi/MBKM dan pencegahan SKS ganda.
17. Race import dengan koreksi Admin.
18. Snapshot job gagal lalu retry.
19. Preview expired dan revalidation.
20. Rule shadow menghitung blocked tetapi flow tetap diizinkan.

## 11. Urutan implementasi dan dependensi

| Urutan | Pekerjaan | Dependensi | Risiko |
| --- | --- | --- | --- |
| 1 | Paket 0: keputusan domain dan baseline | Pemilik aturan/data | Tinggi; memblokir schema/rule |
| 2 | Paket 1: periode, kurikulum, mata kuliah | Keputusan model semester | Tinggi |
| 3 | Paket 2: attempt dan histori Metodologi | Master akademik | Tinggi |
| 4 | Paket 3: import preview/commit | Model fakta stabil | Tinggi |
| 5 | Paket 4–5: koreksi dan snapshot | Import/fakta | Tinggi |
| 6 | Paket 6: rule engine | Snapshot dan keputusan rule | Tinggi |
| 7 | Paket 7–8: adapter flow dan pendadaran | Rule engine; Tahap 3–4 stabil | Tinggi |
| 8 | Paket 9–11: API, frontend, audit/security | Backend flow stabil | Sedang-tinggi |
| 9 | Paket 12: adapter integrasi | Pipeline ingestion stabil | Sedang |
| 10 | Paket 13: rekonsiliasi/constraint final | Schema dan service stabil | Tinggi sebelum release |
| 11 | Test, build, dry-run, dan UAT | Semua paket | Tinggi sebelum release |

## 12. Strategi deployment

1. Backup database dan simpan baseline test/dry-run.
2. Deploy tabel, enum, index, dan foreign key secara additive.
3. Deploy master periode/kurikulum/mata kuliah dan selesaikan ambiguity.
4. Backfill relasi `PeriodePenjaluran → PeriodeAkademik`, jalankan rekonsiliasi Tahap 4, dan jangan aktifkan transisi semester untuk mapping ambigu.
5. Verifikasi jendela izin 30 hari memakai tanggal mulai periode akademik.
6. Deploy import hanya sampai preview.
7. Uji sampel anonim dan verifikasi bersama pemilik data.
8. Aktifkan commit untuk kelompok Admin terbatas.
9. Jalankan outbox/snapshot worker dalam shadow dan uji retry failure.
10. Jalankan snapshot calculator dan bandingkan dengan ringkasan sumber.
11. Aktifkan halaman readonly Admin/Sekprodi/mahasiswa.
12. Jalankan eligibility Penelitian dan pendadaran dalam mode informational/shadow.
13. Pantau mismatch, unknown, conflict, job/outbox lag, dan snapshot failure.
14. Aktifkan correction workflow.
15. Enforce rule satu per satu hanya setelah BR, konfigurasi, test, dan UAT disetujui.
16. Pasang constraint final setelah data aktif bersih.
17. Hentikan query akademik ad hoc dan hard-code yang sudah digantikan.

Rollback aplikasi tidak menghapus fakta, histori, batch, koreksi, snapshot, atau evaluation yang sudah sah. Rule dapat dikembalikan dari `enforced` ke `shadow` tanpa menghapus hasil evaluasi lama.

## 13. Observability dan operasi

Metric minimum:

- upload/validation/commit success-failure;
- jumlah invalid/conflict/noop per batch;
- processing time dan queue depth snapshot;
- outbox pending/failed/retry dan oldest-event age;
- preview expired/revalidated;
- persentase data_state available/incomplete/conflicted/unavailable;
- snapshot mismatch/failure/retry;
- correction dan stale edit conflict;
- shadow versus enforced result mismatch;
- eligibility reason distribution;
- unauthorized file/report access.

Runbook minimum:

- batch gagal commit;
- snapshot tertinggal atau gagal;
- NIM/mata kuliah/periode tidak cocok;
- konflik import versus koreksi;
- rollback enforcement rule;
- kebocoran/akses file tidak sah;
- rebuild snapshot dan rekonsiliasi evaluation.

## 14. Definition of Done Tahap 5

Tahap dinyatakan selesai apabila:

- histori Metodologi tersimpan per semester dengan nilai, sumber, dan lineage;
- periode akademik memakai tahun mulai/selesai yang tidak ambigu dan setiap jendela penjaluran terpetakan secara eksplisit;
- missing data tidak dianggap belum mengambil/tidak lulus;
- kesimpulan berbasis absensi selalu mempunyai bukti `CakupanDatasetAkademik` yang tepat;
- attempt mata kuliah, kurikulum, dan mata kuliah wajib terstruktur;
- kurikulum/mata kuliah terscope prodi/program kuliah dan alias dibedakan dari ekuivalensi;
- attempt tanpa external ID mempunyai fallback natural key deterministik dan transfer/konversi tidak menggandakan SKS;
- total SKS dan requirement dihitung oleh snapshot berversi dan reproducible;
- lifecycle kalkulasi snapshot terpisah dari data_state dan job/outbox dapat di-retry idempotent;
- dokumen transkrip dibedakan dari isi akademik terstruktur;
- import mempunyai template, preview, error per row, commit transaksional, dan report;
- preview dapat expired/revalidate dan rollback commit tetap meninggalkan status batch failed yang teraudit;
- raw cell terkarantina mempertahankan bukti/tipe/formula tanpa pernah dievaluasi serta sanitasi ekspor tidak merusak numeric negatif;
- exact replay dan request paralel tidak menggandakan data;
- exact replay mempertimbangkan dataset, sumber, periode/cutoff, completeness scope, schema, dan file hash;
- koreksi Admin tidak menghapus histori dan tidak tertimpa import diam-diam;
- konflik mempunyai lifecycle serta keputusan resolusi tersendiri;
- mahasiswa hanya mempunyai akses readonly ke datanya;
- Sekprodi dapat memonitor/verifikasi tetapi tidak mengubah nilai tanpa flow koreksi;
- eligibility menyimpan `evaluated_result` dan `effective_decision` secara terpisah beserta mode/reason codes;
- rule belum final tetap shadow/informational;
- hasil shadow blocked tidak pernah memblokir flow utama;
- keputusan kritis menyimpan snapshot dan rule version yang digunakan;
- integrasi Penelitian, ulang/alih, izin, dan pendadaran tidak mempunyai kondisi akademik ad hoc baru;
- pendadaran memeriksa transkrip file, SKS, mata kuliah wajib, dan Metodologi sebagai item terpisah;
- raw import, fakta kanonik, snapshot, dan evaluation dapat ditelusuri end-to-end;
- API mencakup master, import revalidate/cancel, conflict resolution, snapshot/outbox monitoring, rebuild, dan lifecycle rule-set;
- Tahap 4 memakai mapping periode akademik yang tidak ambigu dan jendela izin semester 3 tepat 30 hari sebelum tanggal mulai akademik;
- rekonsiliasi tidak menemukan duplicate active version, snapshot mismatch, conflict tersembunyi, atau false eligibility yang belum ditangani;
- unit test, integration test endpoint, frontend test, build, security test, dry-run, dan UAT lulus;
- aturan bisnis, template, API, backend, frontend, test, dan dokumentasi menyatakan kontrak yang sama.

## 15. Keputusan yang perlu dikunci

| Keputusan | Sikap rancangan |
| --- | --- |
| Status/nilai Metodologi untuk masuk Penelitian | Belum diasumsikan; mode shadow sampai BR final |
| Dampak Metodologi pada ulang/alih dan izin lanjut | Belum diasumsikan; hanya tampilkan fakta |
| Minimum total SKS pendadaran | Konfigurasi berversi; nilainya harus disahkan |
| Daftar mata kuliah wajib | Berasal dari kurikulum resmi berversi |
| Grade passing dan repeat replacement | Harus disahkan per kurikulum/sumber |
| Scope kurikulum/mata kuliah | Wajib menyertakan program studi dan program kuliah bila kurikulum berbeda; kode tidak diasumsikan unik global |
| Alias versus ekuivalensi | Final secara teknis: alias menunjuk entitas sama; ekuivalensi adalah pengakuan substitusi berversi dan dapat berarah |
| Transfer/konversi/MBKM/waiver | Hanya dihitung setelah recognition status dan aturan ekuivalensi disahkan |
| IP/IPK sebagai gate | Tidak diasumsikan sampai BR menyatakan |
| Semester akademik kanonik | Rekomendasi: `PeriodeAkademik` dengan kode `YYYY-YYYY-SEMESTER`; `PeriodePenjaluran` hanya mereferensikannya |
| Commit batch invalid | Rekomendasi: all-or-nothing; partial commit memerlukan keputusan eksplisit dan audit per subset |
| Prioritas import, integrasi, dan koreksi | Tidak memakai last-write-wins; resolver precedence wajib disahkan |
| Persetujuan koreksi | Admin melakukan koreksi; kebutuhan four-eyes approval untuk nilai sensitif wajib diputuskan |
| Dataset completeness | Sumber wajib menyatakan scope lengkap sebelum sistem boleh menyimpulkan `belum_mengambil` |
| Fail-open/fail-closed untuk `undetermined` | Wajib diputuskan per konteks enforced; shadow selalu allow/warn |
| Retention file/raw row | Mengikuti kebijakan privasi institusi; tidak dihapus tanpa jadwal resmi |
| Structured transcript versus dokumen | Keduanya requirement terpisah sampai BR menyatakan lain |

Keputusan baru wajib memperbarui `aturan-bisnis-simps.md`, data dictionary, template, rule-set, migrasi, service, UI, test, dan dokumen ini dalam perubahan yang sama.

## 16. Status implementasi

**Status: implementasi fondasi / belum siap enforcement.**

Mode `enforced` ditolak oleh API dan dievaluasi sebagai `shadow` bila terdapat data legacy. Aktivasi hanya boleh dibuka setelah keputusan bisnis final, seluruh consumer memakai `effective_decision` sebagai gate yang konsisten, pengujian endpoint lengkap lulus, dan UAT disetujui.

- [ ] **Paket 0 — Parsial.** Baseline dan kontrak missing-data tersedia; threshold, precedence sumber, approval koreksi sensitif, serta kebijakan fail-open/fail-closed belum disahkan.
- [ ] **Paket 1 — Parsial.** Model semester, kurikulum, mata kuliah, mapping, serta form Admin untuk tanggal resmi dan status periode tersedia; tiga periode legacy masih menunggu tanggal kalender akademik resmi yang tidak boleh diisi melalui asumsi sistem.
- [x] **Paket 2 — Selesai.** Attempt dan histori Metodologi mempunyai version lineage, `academic_effective_at` yang terpisah dari `recorded_at`, constraint active-version, koreksi, serta revoke yang konsisten. Late import tetap masuk ke snapshot periode akademik yang benar.
- [x] **Paket 3 — Selesai.** Upload, template, preview server-side, raw row, revalidation, conflict cleanup, commit atomik, exact replay, fallback key, scope program kuliah, dan report aman tersedia. Deklarasi dataset lengkap mewajibkan periode, membatasi tipe scope, serta menampilkan scope coverage sebelum commit.
- [x] **Paket 4 — Selesai.** Koreksi tervalidasi dan keputusan konflik `keep_admin_correction`, `accept_source`, `create_manual_correction`, serta `dismiss_false_positive` mengubah fakta/raw row dan status batch secara konsisten.
- [x] **Paket 5 — Selesai.** Snapshot `current` dan `period_end` dipisahkan; snapshot historis tidak menggantikan current. Snapshot current mensyaratkan coverage periode akademik aktif, termasuk saat mahasiswa belum mempunyai attempt; periode aktif yang tidak dapat ditentukan menghasilkan `incomplete`. Scope cohort hanya berlaku bila atribut angkatan mahasiswa dan deklarasi coverage cocok. Ekuivalensi berarah, cutoff akademik, checksum revision fakta, serta worker seluruh event outbox dengan `SKIP LOCKED` dan retry/backoff tersedia. Endpoint GET hanya membaca snapshot dan mengantrekan refresh bila stale/belum tersedia.
- [ ] **Paket 6 — Parsial.** Evaluated result, effective decision, reason code, dan persistence tersedia; enforcement sengaja dinonaktifkan.
- [ ] **Paket 7 — Parsial.** Penelitian, ulang/alih, dan izin lanjut menerima evaluasi akademik advisory; gate enforced belum diaktifkan.
- [ ] **Paket 8 — Parsial.** Checklist pendadaran membaca eligibility terpusat, tetapi threshold resmi dan UAT belum tersedia.
- [x] **Paket 9 — Selesai.** API master, import, correction, conflict, snapshot/job/outbox, rule-set, mahasiswa, dan monitoring memiliki role authorization.
- [ ] **Paket 10 — Parsial.** UI mahasiswa, monitoring Sekprodi, import, master, kurikulum, konflik, koreksi/revoke, rule, jobs/outbox, batch, dan report tersedia. Form Admin menyorot periode tanpa tanggal resmi, dapat menetapkan status periode, menonaktifkan deklarasi completeness sebelum periode dipilih, dan menampilkan preview scope; automated frontend interaction test belum lengkap.
- [ ] **Paket 11 — Parsial.** Formula quarantine, sanitasi report, batas ukuran, authorization, rate limit, dan audit lineage tersedia; kebijakan retention/enkripsi institusi serta security UAT belum disahkan.
- [x] **Paket 12 — Selesai.** `ingestAcademicDataset()` memakai transaksi dan pipeline preview/validation yang sama dengan import file.
- [ ] **Paket 13 — Parsial.** Rekonsiliasi dry-run/execute tersedia dan memeriksa scope completeness ilegal serta cohort tanpa atribut. Tiga tanggal periode akademik resmi masih menjadi satu-satunya kelompok finding operasional.

Tahap 5 belum boleh dinyatakan siap produksi atau siap enforcement sampai seluruh item parsial yang menjadi gate operasional diselesaikan.
