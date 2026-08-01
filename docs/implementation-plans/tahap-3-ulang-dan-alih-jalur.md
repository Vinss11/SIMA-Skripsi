# Rancangan Pengerjaan Tahap 3 — Ulang dan Alih Jalur

## 1. Tujuan

Menyediakan pendaftaran ulang dan alih jalur untuk Penelitian, Magang, dan Perintisan Bisnis dengan aturan pamit yang benar, pengakhiran siklus lama secara transaksional, pembentukan siklus progres baru, serta histori yang tetap utuh.

Tahap ini menggeneralisasi flow yang saat ini terutama masih berorientasi pada Ulang Penelitian. Hasil akhirnya harus memungkinkan mahasiswa:

- mengulang jalur yang sama;
- berpindah ke salah satu dari dua jalur aktif lainnya;
- menyelesaikan pamit melalui P1 aktif jika masih mempunyai penetapan aktif;
- melewati pamit jika tidak mempunyai penetapan aktif dan histori telah diverifikasi;
- memulai form atau kelompok baru tanpa membawa progres, dokumen, kelompok, maupun pembimbing lama sebagai data aktif;
- memperoleh pembimbing baru hanya melalui keputusan final Sekprodi pada workflow Tahap 2.

## 2. Acuan aturan bisnis

Rancangan ini terutama mengacu pada:

- BR-DAFTAR-001 sampai BR-DAFTAR-006;
- BR-PAMIT-001 sampai BR-PAMIT-003;
- BR-PENELITIAN-001 sampai BR-PENELITIAN-004;
- BR-MAGANG-001 sampai BR-MAGANG-003;
- BR-PERINTISAN-001 sampai BR-PERINTISAN-003;
- BR-PENETAPAN-001 sampai BR-PENETAPAN-004;
- BR-SEMESTER-002 dan BR-SEMESTER-003;
- BR-NOTIF-001 dan BR-NOTIF-002;
- BR-AUDIT-001 sampai BR-AUDIT-004.

Aturan inti:

- `ulang` membuat siklus baru pada jalur yang sama dengan jalur asal;
- `alih` membuat siklus baru pada jalur yang berbeda;
- jalur asal selalu dihitung server dari pendaftaran terakhir yang sudah disetujui;
- pamit wajib hanya jika masih ada penetapan pembimbing aktif;
- pamit diputuskan P1 aktif; P2 hanya menerima pemberitahuan;
- pamit ditolak tidak mengakhiri penetapan;
- pamit disetujui mengakhiri penetapan lama dan membatalkan permohonan bimbingan mendatang yang masih pending;
- satu pamit hanya dapat dipakai untuk satu pendaftaran baru;
- mahasiswa tidak memilih pembimbing lama atau baru;
- data siklus lama tidak dihapus;
- pembimbing baru dipilih Sekprodi pada keputusan final;
- ulang/alih memulai progres baru dan progres jalur lama tidak otomatis dihitung pada jalur baru.

Aturan final masa berlaku pamit: pamit hanya berlaku untuk satu `periode_tujuan_id` yang direkam ketika diajukan. Pamit `pending` atau `approved` yang belum dikonsumsi otomatis berubah menjadi `cancelled` saat periode tujuan ditutup dan tidak dapat digunakan lintas periode.

## 3. Batas tahap

### 3.1 Termasuk Tahap 3

- eligibility ulang/alih untuk tiga jalur aktif;
- penentuan jalur asal oleh server;
- pamit umum yang tidak bergantung pada model pengajuan Penelitian;
- keputusan pamit oleh P1 aktif;
- pengakhiran penetapan dan pembatalan bimbingan pending;
- konsumsi satu pamit oleh satu pendaftaran baru;
- pembentukan pendaftaran/siklus baru;
- routing ke form Penelitian, Magang, atau kelompok Perintisan;
- kelompok Perintisan yang anggotanya dapat mempunyai jenis pendaftaran baru, ulang, atau alih;
- audit, notifikasi, idempotensi, rekonsiliasi, dan pengujian end-to-end.

### 3.2 Tidak termasuk Tahap 3

- perubahan urutan review Penelitian yang masih ditunda;
- perubahan finalisasi tiga jalur yang sudah menjadi tanggung jawab Tahap 2, selain adapter agar memahami siklus ulang/alih;
- carry-forward semester dalam siklus yang sama;
- izin semester ketiga selain pembacaan hasilnya sebagai eligibility gate;
- reset atau penggabungan histori lama;
- flow Pengabdian selama berstatus hold;
- penggantian P1 hanya agar pamit dapat diputuskan tanpa mengikuti flow dampak status dosen;
- aktivasi pembimbing berdasarkan surat tugas.

## 4. Kontrak domain

### 4.1 Istilah siklus

Satu record pendaftaran menjadi root satu siklus penjaluran. Semua pengajuan, kelompok, penetapan awal, dan progres baru harus terhubung ke pendaftaran tersebut.

| Konsep | Sumber kebenaran |
| --- | --- |
| Siklus lama | pendaftaran akademik terakhir yang disetujui berdasarkan urutan periode dan keputusan yang deterministik |
| Jalur asal | target akademik pendaftaran lama |
| Siklus baru | pendaftaran `ulang` atau `alih` yang baru dibuat |
| Jalur tujuan | sama dengan asal untuk ulang; berbeda untuk alih |
| Penetapan lama | penetapan aktif/histori yang terhubung ke siklus lama |
| P1 pemutus pamit | P1 aktif dari penetapan lama, bukan cache mahasiswa |
| Pembimbing baru | penetapan dari keputusan final Sekprodi pada siklus baru |
| Progres baru | seluruh data progres yang terikat ke pendaftaran/siklus baru |

`status_jalur_saat_ini`, `pengajuan_aktif_id`, dan `dosen_pembimbing_skripsi_id` adalah state/cache operasional. Ketiganya bukan sumber untuk menentukan jalur asal, histori pembimbing, atau identitas P1 pamit.

### 4.2 Resolver jalur

Gunakan satu helper, misalnya `resolveRegistrationTrack(pendaftaran)`, untuk seluruh flow:

```text
baru  → jenis_jalur_diambil
ulang → jenis_jalur_diambil
alih  → penjaluran_baru
```

Jalur asal dihitung dari hasil resolver pada pendaftaran terakhir yang berstatus disetujui. Nilai `penjaluran_sebelumnya` dari frontend tidak pernah dipercaya.

Pendaftaran asal wajib dicari dengan query yang deterministik:

```text
WHERE mahasiswa_id = mahasiswa aktif
  AND status = approved
  AND target jalur dapat di-resolve ke jalur yang valid
  AND id bukan pendaftaran periode tujuan yang sedang dibuat

ORDER BY
  periode.tanggal_mulai DESC,
  COALESCE(tanggal_keputusan, updatedAt) DESC,
  id DESC
LIMIT 1
```

`createdAt DESC` tidak boleh menjadi satu-satunya urutan karena record hasil import atau backfill dapat dibuat setelah siklus akademik yang lebih baru. Jika dua periode bertumpang tindih atau tanggal mulai periode tidak tersedia, record ditandai sebagai data ambigu dan pendaftaran diblokir sampai rekonsiliasi selesai.

### 4.3 Matriks target

| Jenis | Jalur asal | Target yang valid |
| --- | --- | --- |
| Ulang | Penelitian | Penelitian |
| Ulang | Magang | Magang |
| Ulang | Perintisan Bisnis | Perintisan Bisnis |
| Alih | Penelitian | Magang, Perintisan Bisnis |
| Alih | Magang | Penelitian, Perintisan Bisnis |
| Alih | Perintisan Bisnis | Penelitian, Magang |

Pengabdian tidak pernah ditawarkan selama hold. Target juga harus tersedia pada periode aktif dan lolos gate semester lanjutan.

### 4.4 Invariant global

1. Satu mahasiswa maksimal mempunyai satu pendaftaran pada satu periode.
2. Jalur asal selalu berasal dari database.
3. Ulang wajib mempunyai target sama dengan asal.
4. Alih wajib mempunyai target berbeda dari asal.
5. Mahasiswa tidak dapat mendaftar jika masih mempunyai workflow/pengajuan aktif yang belum terminal.
6. Pamit hanya diperlukan jika ada penetapan aktif.
7. Pamit merujuk tepat satu penetapan lama dan satu P1 pemutus.
8. P2 tidak dapat approve/reject pamit.
9. Approval pamit, pengakhiran penetapan, pembatalan bimbingan pending, pengosongan cache, histori, dan notifikasi berada dalam satu transaksi.
10. Rejection tidak mengubah penetapan, bimbingan, cache, topik, atau progres lama.
11. Satu pamit disetujui hanya dapat dikonsumsi oleh satu pendaftaran baru.
12. Pamit dikonsumsi ketika pendaftaran baru berhasil dibuat, bukan ketika form jalur dikirim.
13. Pendaftaran baru tidak menyimpan pilihan pembimbing baru dari mahasiswa.
14. Kelompok Perintisan lama tidak dipakai ulang.
15. Finalisasi siklus baru menghasilkan penetapan semester ke-1 untuk siklus baru.
16. Retry identik tidak membuat pamit, pendaftaran, kelompok, histori, atau notifikasi ganda.
17. Setiap progres baru, terutama `BimbinganSkripsi`, wajib mempunyai `pendaftaran_penjaluran_id` dan dibaca dalam scope pendaftaran aktif.
18. Pamit `approved` hanya berlaku untuk `periode_tujuan_id` yang direkam saat submit dan tidak dapat dipakai setelah periode tersebut ditutup.
19. Perubahan assignment ketika pamit masih `pending` membatalkan pamit lama; reviewer atau referensi assignment tidak dipindahkan diam-diam.
20. Approval pamit tidak otomatis mengubah status topik lama dari `taken` menjadi `available` tanpa aturan bisnis tersendiri.

## 5. Workflow target

### 5.1 Jika masih ada penetapan aktif

```text
Pilih Ulang/Alih dan target
  → server menghitung jalur asal dan memvalidasi target
  → mahasiswa mengirim pamit
  → P1 aktif approve/reject
      ├─ reject  → penetapan lama tetap aktif
      └─ approve → penetapan lama berakhir
                  + bimbingan pending dibatalkan
                  + cache P1 dikosongkan
                  + siap membuat pendaftaran baru
  → pendaftaran baru dibuat dan pamit dikonsumsi
  → form/kelompok baru
  → review jalur
  → final Sekprodi
  → P1/P2 baru aktif
```

### 5.2 Jika tidak ada penetapan aktif

```text
Pilih Ulang/Alih dan target
  → server memverifikasi histori pendaftaran/penetapan lama
  → pamit = tidak diperlukan
  → pendaftaran baru dibuat
  → form/kelompok baru
  → review jalur
  → final Sekprodi
  → P1/P2 baru aktif
```

Bypass pamit bukan keputusan frontend. API eligibility mengembalikan `pamit_required: false` beserta alasan sistem setelah histori berhasil diverifikasi.

### 5.3 Lifecycle pamit

Lifecycle normalisasi:

| Status | Makna |
| --- | --- |
| `pending` | Menunggu keputusan P1 aktif |
| `approved` | P1 menyetujui dan dampak pengakhiran berhasil dilakukan |
| `rejected` | P1 menolak; siklus lama tetap berjalan |
| `consumed` | Pamit approved sudah dipakai satu pendaftaran baru |
| `cancelled` | Pamit dibatalkan/stale sebelum keputusan, dengan alasan audit |

Transisi yang diperbolehkan:

| Dari | Aksi | Menjadi | Dampak |
| --- | --- | --- | --- |
| Tidak ada | Mahasiswa submit | `pending` | Mengikat periode tujuan, pendaftaran lama, assignment lama, dan P1 aktif |
| `pending` | P1 approve | `approved` | Mengakhiri assignment lama secara transaksional |
| `pending` | P1 reject | `rejected` | Siklus lama tidak berubah |
| `pending` | Assignment/P1 berubah | `cancelled` | Alasan `assignment_changed`; mahasiswa harus membuat pamit baru terhadap assignment baru |
| `pending` | Periode tujuan ditutup | `cancelled` | Alasan `target_period_closed` |
| `approved` | Pendaftaran baru commit | `consumed` | Mengikat tepat satu pendaftaran baru |
| `approved` | Pendaftaran baru gagal/rollback | `approved` | Tetap dapat dicoba kembali pada periode tujuan yang sama |
| `approved` | Periode tujuan ditutup sebelum dikonsumsi | `cancelled` | Tidak dapat dibawa ke periode berikutnya |
| `rejected` | Mahasiswa mencoba kembali | pamit baru `pending` | Record lama tetap menjadi histori |
| `cancelled` | Mahasiswa mencoba kembali | pamit baru `pending` | Eligibility dihitung ulang dari state terbaru |
| `consumed` | Aksi apa pun | Ditolak | State terminal dan tidak reusable |

Transisi `pending → approved/rejected` dan `approved → consumed` harus idempotent. Tidak ada transisi langsung dari `rejected` atau `cancelled` kembali ke `pending` pada record yang sama.

Kolom legacy `status_dospem` dapat dipertahankan selama migrasi, tetapi API mengembalikan `pamit_status`. `status_dpa` tidak menjadi gate bisnis karena aturan final hanya membutuhkan keputusan P1.

## 6. Kontrak data target

### 6.1 Data pamit minimum

Pamit generik minimal menyimpan:

- `mahasiswa_id`;
- `periode_tujuan_id`;
- `jenis_perubahan`: `ulang` atau `alih`;
- `pendaftaran_lama_id`;
- `jalur_asal`;
- `jalur_tujuan`;
- `penetapan_lama_id`;
- `reviewer_p1_id`;
- `status`;
- alasan dan pesan mahasiswa;
- keputusan/catatan P1;
- waktu pengajuan dan keputusan;
- `pendaftaran_baru_id` ketika dikonsumsi;
- aktor dan metadata idempotensi;
- alasan pembatalan bila stale/cancelled.

`pengajuan_sebelumnya_id` dan `pengajuan_baru_id` boleh dipertahankan untuk kompatibilitas Penelitian, tetapi bukan lagi relasi utama. Relasi utama adalah pendaftaran lama dan pendaftaran baru agar Magang serta Perintisan dapat menggunakan flow yang sama.

### 6.2 Constraint yang diperlukan

- foreign key pamit ke mahasiswa, pendaftaran lama, penetapan lama, reviewer P1, dan pendaftaran baru;
- foreign key pamit ke periode tujuan;
- unique `pendaftaran_baru_id` ketika tidak null;
- maksimum satu pamit aktif (`pending` atau `approved` belum consumed) per mahasiswa;
- unique mahasiswa-periode pada pendaftaran;
- pendaftaran baru menyimpan referensi `pendaftaran_asal_id` atau relasi siklus ekuivalen;
- constraint/check bahwa jalur asal dan tujuan valid;
- unique idempotency key dalam scope mahasiswa dan operasi.

Jika partial unique index sulit diterapkan lintas status, gunakan kolom lifecycle tunggal dan index parsial PostgreSQL. Pengecekan aplikasi tetap dilakukan untuk pesan error, tetapi constraint database menjadi pengaman race condition.

### 6.3 Histori keputusan

Setiap transisi pamit dan pendaftaran menyimpan:

- objek dan ID;
- status sebelum/sesudah;
- aktor ID serta role;
- jalur asal/tujuan;
- penetapan lama;
- alasan/catatan;
- waktu;
- data sebelum/sesudah yang relevan;
- correlation/idempotency key.

Histori tidak ditimpa ketika mahasiswa mengajukan pamit baru setelah penolakan.

### 6.4 Referensi siklus pada progres

`BimbinganSkripsi` harus ditambah `pendaftaran_penjaluran_id` sebagai foreign key ke root siklus. Kontraknya:

- setiap bimbingan baru mengambil pendaftaran dari penetapan aktif dan wajib menyimpan ID tersebut;
- server menolak pembuatan bimbingan bila assignment aktif tidak terhubung ke pendaftaran yang sama;
- seluruh query progres aktif, jumlah bimbingan, kelayakan tahap berikutnya, dashboard, dan ekspor difilter berdasarkan pendaftaran aktif;
- histori lintas siklus boleh ditampilkan, tetapi harus dikelompokkan per pendaftaran dan tidak ikut dihitung sebagai progres siklus aktif;
- dokumen/progres lain yang mempunyai makna per siklus wajib memakai foreign key pendaftaran yang sama atau relasi turunan yang tidak ambigu;
- backfill hanya dilakukan bila pendaftaran dapat ditentukan dari assignment, pengajuan, periode, dan waktu bimbingan secara konsisten;
- record legacy yang mempunyai lebih dari satu kandidat ditandai `manual_review`, tidak ditebak dan tidak dimasukkan ke hitungan progres aktif.

Foreign key dibuat additive dan nullable selama backfill. Setelah seluruh data aktif bersih, penulisan baru diwajibkan pada service/model validation dan kolom dapat dibuat `NOT NULL` untuk record baru sesuai kemampuan database.

## 7. Kondisi implementasi saat ini

### 7.1 Bagian yang sudah sesuai

- endpoint ulang/alih sudah membutuhkan autentikasi mahasiswa;
- sudah ada pemeriksaan periode aktif dan window tanggal;
- sudah ada pemeriksaan pendaftaran pada periode yang sama;
- keputusan pamit pada route aktif dilakukan oleh P1, bukan P2 atau DPA;
- P2 dapat melihat pamit tetapi `can_review` hanya diberikan kepada P1;
- rejection pamit tidak mengakhiri penetapan;
- approval memanggil `endActiveSupervisorAssignment()` dalam transaksi;
- cache P1 dikosongkan melalui service penetapan;
- histori bimbingan yang sudah terjadi tidak dihapus;
- finalisasi jalur baru pada Tahap 2 sudah menggunakan service penetapan transaksional;
- model kelompok Perintisan sudah menghubungkan anggota ke pendaftaran masing-masing.

### 7.2 Gap kritis

#### 7.2.1 Flow baru mendukung Ulang Penelitian saja

`submitPendaftaranUlangAlih()` masih menolak `alih` dan target selain Penelitian. Endpoint pengajuan ulang juga masih terpisah menjadi `ulang/topik-dosen` serta `ulang/judul-mandiri`, sedangkan Magang dan Perintisan belum mempunyai kontrak ulang/alih yang utuh.

#### 7.2.2 Model pamit masih terikat pada Pengajuan Penelitian

Pamit mewajibkan `pengajuan_sebelumnya_id` dan penanda konsumsi masih berupa `pengajuan_baru_id`. Magang serta Perintisan tidak mempunyai `Pengajuan` Penelitian sehingga tidak dapat memakai model ini dengan benar.

#### 7.2.3 Jalur asal masih dapat berasal dari sumber yang salah

Beberapa flow mencari `Pengajuan` approved terakhir. Sumber tersebut hanya mewakili Penelitian dan tidak selalu sama dengan pendaftaran terakhir yang disetujui. Jalur asal wajib diambil dari pendaftaran.

#### 7.2.4 Pendaftaran setelah approval pamit berpotensi gagal

Approval pamit mengakhiri penetapan dan mengosongkan cache P1. Pendaftaran ulang kemudian masih mencoba membaca pembimbing sebelumnya dari penetapan aktif atau cache mahasiswa. Setelah approval, kedua sumber tersebut memang sudah kosong. Pembimbing lama harus dibaca dari `penetapan_lama_id` yang ditangkap pada pamit/histori.

#### 7.2.5 Pamit dikonsumsi terlalu lambat

Pamit baru ditandai digunakan ketika pengajuan Penelitian baru dibuat. Aturan bisnis menyatakan satu pamit dipakai untuk satu pendaftaran baru. Jika pendaftaran sudah dibuat tetapi form belum dikirim, pamit masih terlihat reusable.

#### 7.2.6 Approval pamit belum mengunci record secara lengkap

Controller memakai transaksi, tetapi pamit dan penetapan yang diputuskan belum seluruhnya diambil dengan row lock. Request approve/reject paralel masih berisiko berlomba.

#### 7.2.7 P1 pemutus tidak disnapshot

Pamit tidak menyimpan `penetapan_lama_id` dan `reviewer_p1_id`. Otorisasi saat review dihitung dari penetapan aktif terkini, sehingga pergantian pembimbing di antara submit dan review dapat mengubah pemutus tanpa membatalkan intent lama dan tanpa histori yang memadai.

#### 7.2.8 Bimbingan mendatang yang pending belum dibatalkan oleh approval pamit

`endActiveSupervisorAssignment()` mengakhiri penetapan dan cache, tetapi tidak menjalankan aturan khusus pamit untuk membatalkan permohonan bimbingan mendatang yang masih pending. Dibutuhkan service penutupan siklus khusus, bukan sekadar generic assignment end.

#### 7.2.9 Status DPA legacy masih tersebar

Route DPA sudah dinonaktifkan dan approval P1 menyalin hasil ke `status_dpa` untuk kompatibilitas, tetapi controller DPA lama masih tersedia. Kontrak API dan UI perlu berhenti menganggap DPA sebagai tahap keputusan.

#### 7.2.10 Eligibility tanpa penetapan aktif belum didukung penuh

Beberapa eligibility mensyaratkan mahasiswa masih mempunyai pembimbing aktif, padahal aturan memperbolehkan melewati pamit jika tidak ada penetapan aktif dan histori tersedia.

#### 7.2.11 Pendaftaran/kelompok dapat bertindak atas identitas anggota lain

Flow kelompok yang membuat pendaftaran beberapa mahasiswa sekaligus dari input ketua berisiko mempercayai data anggota dari request. Pada target Tahap 3, setiap anggota existing harus sudah mempunyai pendaftaran validnya sendiri dan identitas diambil dari database.

#### 7.2.12 Semester awal siklus baru dapat salah

Resolver semester penetapan saat ini berpotensi menghitung seluruh pendaftaran approved mahasiswa. Ulang/alih merupakan siklus baru, sehingga penetapan pertama pada pendaftaran baru harus `semester_penjaluran_ke = 1`, bukan kelanjutan nomor siklus lama.

#### 7.2.13 Belum ada integration test endpoint end-to-end

Belum ada test yang membuktikan pamit, konsumsi pamit, ulang tiga jalur, enam kombinasi alih, pemisahan progres, kelompok campuran, retry, dan rollback melalui endpoint lengkap.

#### 7.2.14 Progres belum mempunyai foreign key siklus yang konkret

`BimbinganSkripsi` masih terutama terhubung ke mahasiswa dan dosen, belum ke `pendaftaran_penjaluran_id`. Setelah alih jalur, query berdasarkan mahasiswa saja dapat mencampurkan bimbingan siklus lama dengan progres siklus baru dan melanggar BR-PENETAPAN-003.

#### 7.2.15 Pemilihan pendaftaran asal belum deterministik secara akademik

Query record terakhir berisiko mengandalkan `createdAt DESC`. Import dan backfill dapat menghasilkan urutan pembuatan yang berbeda dari urutan periode akademik sehingga jalur asal yang dipilih dapat salah.

#### 7.2.16 Masa berlaku pamit belum dimodelkan

Pamit belum menyimpan periode tujuan. Tanpa scope tersebut, pamit approved dari periode yang sudah ditutup dapat dipakai pada periode berikutnya meskipun target, konfigurasi, dan konteks akademiknya telah berubah.

#### 7.2.17 Controller legacy tidak layak menjadi fondasi flow umum

Model dan controller lama mengasumsikan adanya `Pengajuan` Penelitian, mengambil pembimbing dari assignment aktif setelah assignment tersebut diakhiri, dan menunda konsumsi pamit. Implementasi baru harus berada pada service generik; route lama hanya menjadi adapter kompatibilitas sementara.

## 8. Rencana pengerjaan

### Paket 0 — Baseline dan characterization test

1. Inventarisasi endpoint, status, dan kolom legacy yang terkait ulang, alih, pamit, pengajuan ulang, kelompok, serta assignment source.
2. Buat characterization test untuk perilaku yang sudah benar: P1-only decision, rejection tidak mengakhiri, dan approval mengakhiri assignment.
3. Tandai route/controller DPA sebagai legacy dan pastikan tidak terpasang pada router aktif.
4. Catat data produksi yang memakai `PamitUlang`, `pengajuan_baru_id`, atau pembimbing legacy pada pendaftaran.
5. Stabilkan finalizer Tahap 2 dan bekukan perubahan decision gate Penelitian.
6. Inventarisasi seluruh model/query progres yang saat ini dihitung per mahasiswa tanpa scope pendaftaran, terutama `BimbinganSkripsi`.

Hasil: generalisasi dapat dilakukan tanpa merusak histori dan flow yang sudah sah.

### Paket 1 — Service eligibility ulang/alih

Buat service tunggal, misalnya `getChangeTrackEligibility(mahasiswaId, options)`, yang:

1. mengunci/membaca mahasiswa sesuai konteks transaksi;
2. menemukan periode pendaftaran aktif dan memeriksa window tanggal;
3. menemukan pendaftaran terakhir yang disetujui memakai urutan `periode.tanggal_mulai DESC`, `tanggal_keputusan/updatedAt DESC`, lalu `id DESC`;
4. menentukan jalur asal melalui resolver pendaftaran;
5. memastikan tidak ada pendaftaran pada periode aktif;
6. memastikan tidak ada pengajuan/workflow aktif yang belum terminal;
7. membaca hasil gate semester lanjutan;
8. menemukan penetapan aktif dan histori terakhir;
9. menentukan apakah pamit wajib;
10. menemukan pamit periode tujuan yang masih valid beserta status terakhirnya;
11. menghitung target ulang dan alih yang valid;
12. mengecualikan jalur hold/tidak tersedia;
13. mengembalikan reason code dan next action yang stabil.

Response minimum:

```json
{
  "eligible": true,
  "periode": {},
  "previous_registration": {},
  "origin_track": "penelitian",
  "active_assignment": {},
  "pamit_required": true,
  "active_pamit": {},
  "allowed_changes": {
    "ulang": ["penelitian"],
    "alih": ["magang", "perintisan_bisnis"]
  },
  "blocking_reasons": [],
  "next_action": "submit_pamit"
}
```

Hasil: frontend tidak menghitung jalur asal atau kewajiban pamit sendiri.

### Paket 2 — Generalisasi model pamit

1. Tambahkan relasi periode tujuan, pendaftaran lama, jalur asal/tujuan, jenis perubahan, penetapan lama, reviewer P1, lifecycle status, dan pendaftaran baru.
2. Ubah `pengajuan_sebelumnya_id` menjadi nullable untuk data non-Penelitian.
3. Pertahankan field status DPA dan pengajuan lama selama masa kompatibilitas, tetapi hentikan penulisannya pada flow baru kecuali backfill adapter memerlukannya.
4. Tambahkan unique/partial index satu pamit aktif per mahasiswa-periode tujuan dan satu pendaftaran baru per pamit.
5. Tambahkan histori transisi atau gunakan audit workflow bersama dari Tahap 2.
6. Backfill:
   - pendaftaran lama dari relasi pengajuan lama;
   - penetapan lama dari histori mahasiswa pada waktu pamit;
   - reviewer P1 dari anggota urutan 1;
   - pendaftaran baru dari `pengajuan_baru_id → pendaftaran_penjaluran_id`;
   - jenis perubahan/jalur bila dapat ditentukan tanpa asumsi.
7. Record ambigu tidak dihapus; tandai untuk manual review.

Hasil: satu model pamit dapat digunakan seluruh jalur aktif.

### Paket 3 — Foreign key siklus pada progres

1. Tambahkan `pendaftaran_penjaluran_id` secara additive pada `BimbinganSkripsi` beserta index dan foreign key.
2. Inventarisasi model dokumen/progres lain yang dihitung per siklus dan tambahkan referensi yang sama bila belum tersedia.
3. Ubah service pembuatan bimbingan agar mengambil pendaftaran dari assignment aktif, bukan request frontend atau cache mahasiswa.
4. Tolak bimbingan baru jika pendaftaran pada assignment tidak tersedia atau berbeda dengan siklus aktif.
5. Ubah query progres, dashboard, kelayakan, jumlah bimbingan, ekspor, dan histori aktif agar memakai scope `pendaftaran_penjaluran_id`.
6. Sediakan backfill deterministik berdasarkan assignment, periode, pengajuan, dan timestamp.
7. Masukkan record ambigu ke laporan manual review dan jangan ikutkan pada progres aktif sampai diselesaikan.
8. Tambahkan characterization test sebelum perubahan query dan integration test setelah migrasi.

Hasil: progres lama dan baru terpisah secara fisik serta dapat dibuktikan pada level database.

### Paket 4 — Submit pamit

1. Mahasiswa mengirim hanya `jenis_perubahan`, `jalur_tujuan`, alasan, pesan P1, dan idempotency key; periode tujuan selalu berasal dari periode aktif server.
2. Server menghitung jalur asal dan memvalidasi target.
3. Server menolak submit pamit jika tidak ada penetapan aktif; response mengarahkan langsung ke pendaftaran.
4. Kunci mahasiswa, penetapan aktif, anggota P1, dan pamit aktif.
5. Simpan `periode_tujuan_id`, `penetapan_lama_id`, serta `reviewer_p1_id` dari sumber otoritatif.
6. Jangan bergantung pada Pengajuan Penelitian terakhir.
7. Buat histori dan notifikasi P1; P2 menerima pemberitahuan tanpa allowed action.
8. Retry identik mengembalikan pamit aktif yang sama dengan `replayed: true`.
9. Request berbeda ketika masih ada pamit aktif menghasilkan conflict atau meminta pembatalan eksplisit sesuai lifecycle.

Hasil: pamit sudah menyatakan intent ulang/alih dan aman terhadap perubahan data frontend.

### Paket 5 — Keputusan pamit dan pengakhiran siklus lama

Buat service transaksional, misalnya `decidePamit()`, dengan alur:

1. kunci pamit;
2. kunci penetapan lama dan anggota pembimbing;
3. validasi status masih `pending`;
4. validasi aktor adalah `reviewer_p1_id` yang sah;
5. evaluasi perubahan penetapan/P1 dan status periode tujuan sejak pamit dibuat;
6. jika assignment/P1 berubah, ubah pamit menjadi `cancelled` dengan alasan `assignment_changed`, buat histori/notifikasi, dan minta mahasiswa membuat pamit baru terhadap assignment aktif;
7. untuk rejection:
   - simpan keputusan dan alasan;
   - pertahankan assignment/cache/bimbingan/topik;
   - kirim notifikasi;
8. untuk approval:
   - akhiri tepat penetapan yang direferensikan;
   - akhiri status anggota penetapan secara konsisten;
   - batalkan hanya permohonan bimbingan mendatang yang masih pending;
   - pertahankan seluruh catatan dan bimbingan yang sudah terjadi;
   - kosongkan cache P1;
   - pertahankan snapshot dan status akademik topik lama;
   - bersihkan hanya reservasi teknis yang terbukti yatim; jangan mengubah topik `taken` menjadi `available` tanpa aturan bisnis eksplisit;
   - ubah pamit menjadi `approved`;
   - tulis audit serta notifikasi mahasiswa, P1, dan P2;
9. commit seluruh perubahan bersama.

Retry keputusan yang sama mengembalikan hasil sebelumnya. Keputusan berbeda terhadap pamit terminal menghasilkan `409 PAMIT_DECISION_CONFLICT`.

Hasil: tidak ada kondisi pamit approved tetapi assignment/cache/pending guidance belum konsisten.

### Paket 6 — P1 tidak dapat memberi keputusan

Aturan final menetapkan P1 aktif sebagai pemutus. Penanganan yang aman:

1. jika P1 masih diizinkan melanjutkan bimbingan, akun tersebut tetap dapat memutus pamit;
2. jika P1 tidak diizinkan melanjutkan, gunakan tindak lanjut status dosen Tahap 1 untuk menetapkan P1 pengganti;
3. batalkan pamit pending lama dengan alasan `assignment_changed` setelah penggantian P1 berhasil;
4. minta mahasiswa membuat pamit baru yang mengikat assignment dan P1 pengganti;
5. jika tidak lagi ada penetapan aktif, evaluasi ulang sehingga pamit dapat dilewati berdasarkan histori;
6. jangan memberikan override keputusan kepada Sekprodi tanpa aturan bisnis eksplisit.

Jika pengguna menghendaki Sekprodi dapat approve pamit sebagai exception, keputusan tersebut harus ditambahkan lebih dahulu ke aturan bisnis beserta syarat, alasan wajib, dan auditnya.

Hasil: kasus P1 tidak tersedia tidak deadlock dan tetap konsisten dengan BR-PAMIT-002.

### Paket 7 — Pendaftaran ulang/alih dan konsumsi pamit

Buat service transaksional `createChangeTrackRegistration()`:

1. kunci mahasiswa dan periode aktif;
2. hitung ulang eligibility; jangan memakai hasil lama dari frontend;
3. kunci pendaftaran lama;
4. kunci pamit approved jika wajib;
5. validasi pamit sesuai mahasiswa, periode tujuan yang masih aktif, jenis perubahan, jalur asal, jalur tujuan, dan penetapan lama;
6. jika pamit tidak wajib, verifikasi histori penetapan lama;
7. tolak field pembimbing lama/baru dari request;
8. buat pendaftaran baru dengan:
   - `jalur = ulang/alih`;
   - target akademik yang benar;
   - referensi pendaftaran asal;
   - status/form awal sesuai kontrak Tahap 2;
9. tandai pamit `consumed` dan isi `pendaftaran_baru_id` dalam transaksi yang sama;
10. buat root progres/siklus baru;
11. jangan mengubah atau menghapus data progres lama;
12. tulis histori serta notifikasi;
13. kembalikan target form berikutnya.

Idempotensi API:

- retry dengan periode, jenis, target, dan pamit sama mengembalikan pendaftaran yang sudah dibuat;
- retry dengan target berbeda menghasilkan `409 REGISTRATION_IDEMPOTENCY_CONFLICT`;
- dua request paralel dilindungi unique mahasiswa-periode dan lock pamit.

Hasil: pamit tidak dapat dipakai dua kali dan tidak ada pendaftaran tanpa root siklus baru.

### Paket 8 — Pemisahan progres dan adapter finalisasi

1. Jadikan pendaftaran baru sebagai scope seluruh form/pengajuan/progres baru.
2. Penelitian membuat Pengajuan baru yang terhubung ke pendaftaran baru; jangan reuse Pengajuan lama.
3. Magang membuat payload dan dokumen baru; dokumen lama tetap readonly pada histori.
4. Perintisan membuat kelompok baru; kelompok lama tidak dimutasi.
5. Finalization service Tahap 2 membaca jenis pendaftaran dari siklus baru tetapi membuat assignment awal dengan sumber `penjaluran`/kode sumber siklus baru, bukan pergantian dalam siklus lama.
6. Penetapan pertama pada siklus baru menggunakan `semester_penjaluran_ke = 1`.
7. Progres bimbingan baru dimulai kosong dan setiap record baru mengikat `pendaftaran_penjaluran_id` dari assignment aktif.
8. Histori UI menyediakan tautan ke siklus lama tanpa mencampurkan perhitungan progres.

Jika dibutuhkan audit lebih eksplisit, perluas enum sumber assignment dengan `ulang` dan `alih`; jika tidak, gunakan `penjaluran` dan baca jenis dari relasi pendaftaran.

Hasil: ulang/alih benar-benar menjadi siklus baru, bukan pergantian pembimbing biasa.

### Paket 9 — Adapter per jalur

#### Penelitian

- gunakan form topik dosen/judul mandiri Tahap 2 dengan `pendaftaran_penjaluran_id` baru;
- jangan mewajibkan `pamit_id` lagi pada endpoint form karena konsumsi sudah terjadi pada pendaftaran;
- tampilkan referensi siklus/topik lama sebagai readonly;
- pertahankan decision gate review yang sedang berjalan.

#### Magang

- arahkan ke form Magang individual;
- jangan copy payload atau file lama ke form aktif;
- bila diperlukan untuk kenyamanan, sediakan aksi “gunakan sebagai draft” yang menyalin field nonotoritatif secara eksplisit dan tetap membuat snapshot/dokumen baru;
- Pengawas periode baru melakukan review.

#### Perintisan Bisnis

- setiap calon anggota existing harus sudah mempunyai pendaftaran periode aktif dengan target Perintisan;
- setiap anggota ulang/alih harus sudah menyelesaikan pamit atau dinyatakan tidak memerlukan pamit;
- identitas, jenis pendaftaran, periode, dan eligibility anggota dibaca dari database;
- ketua tidak dapat membuat pendaftaran anggota lain hanya dari NIM/nama request;
- mekanisme minimum Tahap 3 adalah ketua memilih record pendaftaran Perintisan yang valid dari database, bukan mengirim identitas bebas;
- server mengunci pendaftaran ketua dan seluruh calon anggota sebelum membentuk kelompok;
- satu mahasiswa hanya dapat terikat pada satu kelompok aktif dalam periode yang sama;
- bentuk kelompok baru dan kunci membership lama sebagai histori;
- seluruh anggota dapat melihat kelompok dan status keanggotaannya;
- jika aturan akademik mengharuskan persetujuan anggota, tambahkan lifecycle undangan `pending → accepted/rejected/expired` sebelum kelompok dapat diajukan; jangan mengasumsikan persetujuan otomatis tanpa keputusan aturan bisnis;
- kegagalan satu anggota membatalkan pembentukan kelompok;
- finalisasi mengikuti sumber anggota otoritatif Tahap 2.

Hasil: ketiga jalur memakai lifecycle yang sama dengan detail form masing-masing.

### Paket 10 — API dan otorisasi

Endpoint target yang disarankan:

```text
GET  /api/jalur/change/eligibility
POST /api/jalur/change/pamit
GET  /api/jalur/change/pamit/:id
POST /api/dosen/pamit/:id/decision
POST /api/pendaftaran/change
GET  /api/jalur/change/history
```

Kontrak dapat tetap memakai route legacy sementara, tetapi response harus dinormalisasi.

Aturan otorisasi:

- mahasiswa hanya melihat/membuat pamit dan pendaftaran miliknya;
- P1 reviewer hanya melihat dan memutus pamit yang ditugaskan kepadanya;
- P2 hanya melihat pamit mahasiswa aktifnya tanpa aksi keputusan;
- Sekprodi melihat histori dan menangani dampak status/assignment, bukan mengambil keputusan pamit tanpa aturan exception;
- seluruh endpoint memakai object-level authorization, bukan hanya role middleware.

Error code minimum:

- `NO_APPROVED_PREVIOUS_REGISTRATION`;
- `NO_ACTIVE_PERIOD` / `REGISTRATION_WINDOW_CLOSED`;
- `ACTIVE_WORKFLOW_EXISTS`;
- `SAME_PERIOD_REGISTRATION_EXISTS`;
- `INVALID_REPEAT_TARGET`;
- `INVALID_TRANSFER_TARGET`;
- `PAMIT_REQUIRED`;
- `PAMIT_NOT_REQUIRED`;
- `PAMIT_PENDING`;
- `PAMIT_REJECTED`;
- `PAMIT_ALREADY_CONSUMED`;
- `PAMIT_TARGET_PERIOD_CLOSED`;
- `PAMIT_STALE_ASSIGNMENT`;
- `PAMIT_DECISION_CONFLICT`;
- `REGISTRATION_IDEMPOTENCY_CONFLICT`.

Hasil: frontend dapat menentukan next action tanpa parsing pesan bebas.

### Paket 11 — Frontend

#### Halaman eligibility

1. Tampilkan jalur asal readonly dari API.
2. Tampilkan pilihan Ulang atau Alih yang benar-benar eligible.
3. Untuk Ulang, target otomatis sama dan readonly.
4. Untuk Alih, hanya tampilkan dua jalur aktif yang berbeda.
5. Tampilkan alasan blokir dan gate semester.

#### Halaman pamit

1. Tampilkan P1/P2 dan penetapan lama readonly.
2. Kirim jenis perubahan, target, alasan, dan pesan.
3. Stepper pamit menampilkan `pending → approved/rejected/cancelled → consumed` sesuai state machine API.
4. Jika tidak memerlukan pamit, lewati langkah secara otomatis berdasarkan response API.
5. Rejection atau cancellation menampilkan alasan dan memungkinkan pengajuan pamit baru tanpa menghapus histori.

#### Halaman lanjutan

1. Setelah approval, tampilkan aksi “Buat Pendaftaran”.
2. Setelah pendaftaran, arahkan ke form target atau pembentukan kelompok.
3. Hapus seluruh pilihan pembimbing lama/baru.
4. Stepper penuh:

```text
Eligibility → Pamit (jika perlu) → Pendaftaran → Form/Kelompok
→ Review Jalur → Final Sekprodi → Pembimbing Aktif
```

5. Histori siklus lama tersedia readonly dan terpisah dari progres baru.
6. Gunakan `workflow_stage`, reason code, dan `next_action` dari API.

Hasil: UI tidak menyimpan logika jalur asal, pamit, atau pembimbing secara mandiri.

### Paket 12 — Notifikasi dan audit

Notifikasi minimum dibuat untuk:

- pamit diajukan kepada P1;
- informasi pamit kepada P2;
- pamit dibatalkan karena assignment/P1 berubah atau periode tujuan ditutup;
- pamit disetujui/ditolak;
- penetapan lama berakhir;
- pendaftaran ulang/alih berhasil;
- anggota diundang/terikat ke kelompok Perintisan baru bila flow membutuhkan;
- keputusan final dan pembimbing baru dari Tahap 2.

Gunakan deduplication key berbasis event dan object ID. Notifikasi database dibuat dalam transaksi perubahan; kanal eksternal memakai outbox setelah commit.

Hasil: retry tidak menggandakan pemberitahuan dan audit dapat menelusuri satu perubahan dari pamit sampai assignment baru.

### Paket 13 — Rekonsiliasi data legacy

Sediakan dry-run dan execute untuk mendeteksi:

- pamit tanpa pendaftaran/penetapan lama;
- pamit tanpa periode tujuan atau melewati masa berlaku;
- pamit yang reviewer P1-nya tidak dapat ditentukan;
- pamit approved tetapi assignment lama masih active;
- pamit rejected tetapi assignment telah ended karena pamit;
- pamit dengan `pengajuan_baru_id` tetapi tanpa pendaftaran baru;
- satu pamit dipakai lebih dari satu pengajuan/pendaftaran;
- pendaftaran ulang/alih tanpa pamit padahal saat dibuat masih ada assignment active;
- pendaftaran dengan jalur asal/tujuan tidak valid;
- pendaftaran ganda mahasiswa-periode;
- cache P1 masih terisi setelah pamit approved;
- bimbingan mendatang pending setelah pamit approved;
- kelompok lama yang dipakai ulang pada siklus baru;
- anggota Perintisan tanpa pendaftaran periode/target yang sesuai;
- assignment pertama siklus baru dengan semester bukan 1;
- progres lama yang terhubung ke pendaftaran baru.
- `BimbinganSkripsi` tanpa pendaftaran atau mempunyai lebih dari satu kandidat siklus;
- query progres aktif yang masih tidak memakai scope pendaftaran.

Dry-run mencetak ID, alasan, tingkat keyakinan, dan aksi. Data ambigu masuk manual review; jangan menebak atau menghapus histori.

## 9. Strategi pengujian

### 9.1 Unit test

Uji minimal:

- resolver target jalur setiap jenis pendaftaran;
- pemilihan pendaftaran asal berdasarkan urutan periode, tanggal keputusan, dan ID;
- matriks ulang/alih tiga jalur;
- pamit-required resolver;
- state machine pamit;
- allowed transition dan reason code;
- idempotency fingerprint;
- semester awal siklus baru;
- pembatalan bimbingan pending tanpa mengubah histori selesai;
- eligibility anggota kelompok campuran.
- validator scope pendaftaran pada bimbingan/progres.

### 9.2 Integration test pamit

1. Pamit mengikat pendaftaran lama, penetapan lama, dan P1 aktif.
2. P2 dapat melihat tetapi tidak memutus.
3. Dosen selain P1 ditolak.
4. Approval mengakhiri induk dan anggota penetapan.
5. Approval mengosongkan cache P1.
6. Approval membatalkan bimbingan mendatang yang pending.
7. Approval mempertahankan bimbingan yang sudah terjadi, resume, dan dokumen lama.
8. Rejection tidak mengubah assignment/cache/bimbingan/topik.
9. Approve/reject paralel hanya menghasilkan satu keputusan terminal.
10. Retry keputusan identik sukses tanpa histori/notifikasi ganda.
11. Keputusan berbeda setelah terminal menghasilkan conflict.
12. Pergantian assignment/P1 saat pamit pending membatalkan pamit dengan alasan `assignment_changed`.
13. Pamit baru setelah cancellation mengikat assignment dan P1 pengganti.
14. Pamit approved yang belum dikonsumsi dibatalkan ketika periode tujuan ditutup.
15. Kegagalan pendaftaran membuat pamit tetap approved selama periode tujuan masih aktif.
16. P1 yang tidak boleh melanjutkan diarahkan melalui tindak lanjut status dosen.

### 9.3 Integration test pendaftaran

1. Jalur asal dibaca dari pendaftaran approved terakhir menurut urutan periode, tanggal keputusan, dan ID; `createdAt` hasil backfill tidak mengalahkan urutan akademik.
2. Manipulasi `jalur_asal`, pembimbing lama, dan pembimbing baru dari frontend diabaikan/ditolak.
3. Ulang Penelitian, Magang, dan Perintisan berhasil dengan target sama.
4. Enam kombinasi alih antar-tiga jalur berhasil.
5. Alih ke jalur sama ditolak.
6. Ulang ke jalur berbeda ditolak.
7. Pengabdian sebagai target ditolak selama hold.
8. Same-period duplicate ditolak termasuk dua request paralel.
9. Workflow aktif dan gate semester memblokir pendaftaran.
10. Jika assignment aktif ada, pamit pending/rejected/milik siklus lain ditolak.
11. Jika tidak ada assignment aktif dan histori valid, pendaftaran dapat dibuat tanpa pamit.
12. Pamit consumed tidak dapat dipakai lagi pada periode berikutnya.
13. Pamit berubah menjadi consumed tepat ketika pendaftaran berhasil commit.
14. Kegagalan pendaftaran me-rollback konsumsi pamit.
15. Retry identik mengembalikan pendaftaran yang sama tanpa duplikasi.
16. Pamit dari periode tujuan lama ditolak pada periode baru.

### 9.4 Integration test siklus dan jalur

Untuk setiap jalur tujuan:

- form/pengajuan baru terhubung ke pendaftaran baru;
- data form/dokumen/kelompok lama tetap ada;
- progres baru dimulai kosong;
- final Sekprodi membuat assignment aktif baru;
- assignment baru memakai semester ke-1 pada siklus baru;
- P1/P2 baru tidak berasal dari input mahasiswa;
- histori menampilkan hubungan siklus lama dan baru.
- `BimbinganSkripsi` baru menyimpan pendaftaran baru dan query progres aktif tidak menghitung bimbingan siklus lama;
- bimbingan legacy ambigu tidak otomatis dimasukkan ke siklus aktif.

### 9.5 Integration test Perintisan campuran

1. Kelompok dapat berisi mahasiswa baru, ulang, dan alih yang masing-masing eligible.
2. Semua anggota berada pada periode dan target Perintisan yang sama.
3. Anggota ulang/alih tanpa pamit yang diwajibkan ditolak.
4. Ketua tidak dapat membuat pendaftaran anggota lain dari data bebas.
5. Kelompok lama tidak dipakai ulang.
6. Satu anggota pada dua kelompok aktif ditolak.
7. Kegagalan satu anggota me-rollback pembentukan kelompok.
8. Finalisasi seluruh anggota mengikuti test transaksional Tahap 2.
9. Server mengunci seluruh pendaftaran anggota ketika kelompok dibentuk.
10. Setiap anggota dapat melihat kelompoknya.
11. Jika lifecycle undangan diaktifkan, kelompok tidak dapat diajukan sebelum seluruh undangan diterima.

### 9.6 Frontend test

- jalur asal readonly;
- matriks target benar;
- stepper melewati pamit ketika tidak diperlukan;
- P1/P2 lama readonly dan tidak ada input pembimbing baru;
- alasan rejection dan next action tampil;
- double-click tidak menggandakan request/record;
- state setelah refresh berasal dari API;
- histori siklus lama tidak tercampur dengan progres baru;
- anggota Perintisan nonketua hanya melihat status kelompok.

### 9.7 UAT

Minimal skenario UAT:

1. Ulang Penelitian dengan pamit approved.
2. Ulang Magang tanpa assignment aktif sehingga pamit dilewati.
3. Ulang Perintisan dengan kelompok baru.
4. Penelitian → Magang.
5. Penelitian → Perintisan.
6. Magang → Penelitian.
7. Magang → Perintisan.
8. Perintisan → Penelitian.
9. Perintisan → Magang.
10. Pamit rejected.
11. P1 berubah/tidak tersedia saat pamit pending sehingga pamit lama cancelled dan mahasiswa mengajukan pamit baru.
12. Kelompok Perintisan beranggota campuran baru/ulang/alih.

Pada setiap skenario, verifikasi pendaftaran lama, penetapan lama, bimbingan lama, dokumen lama, kelompok lama, cache, pamit, pendaftaran baru, progres baru, notifikasi, dan assignment baru.

## 10. Urutan implementasi dan dependensi

| Urutan | Pekerjaan | Dependensi | Risiko |
| --- | --- | --- | --- |
| 1 | Stabilkan finalizer Tahap 2 dan jalankan Paket 0 | Tahap 1–2 stabil | Tinggi |
| 2 | Terapkan BR masa berlaku pamit dan binding anggota Perintisan | Selesai; pamit scoped ke periode tujuan | Selesai |
| 3 | Migration additive pamit generik (Paket 2) | Urutan 1–2 | Tinggi karena data legacy |
| 4 | Tambah referensi pendaftaran pada progres (Paket 3) | Urutan 1 | Tinggi karena backfill |
| 5 | Bangun resolver jalur asal dan eligibility (Paket 1) | Urutan 3–4 | Tinggi |
| 6 | Bangun submit serta decision service pamit (Paket 4–6) | Urutan 5 | Tinggi |
| 7 | Bangun pendaftaran dan konsumsi pamit (Paket 7) | Urutan 6 | Tinggi |
| 8 | Generalisasi form, finalizer adapter, dan tiga jalur (Paket 8–9) | Urutan 4 dan 7 | Tinggi |
| 9 | Implementasikan kelompok Perintisan campuran | Urutan 5–8 | Tinggi |
| 10 | Implementasikan API, frontend, notifikasi, audit, dan idempotensi (Paket 10–12) | Urutan 5–9 | Sedang-tinggi |
| 11 | Jalankan rekonsiliasi legacy dan pasang constraint final (Paket 13) | Schema dan service stabil | Tinggi sebelum deploy |
| 12 | Jalankan integration test endpoint, frontend test, UAT, dan sinkronisasi dokumentasi | Semua pekerjaan | Tinggi sebelum release |

## 11. Strategi deployment

1. Backup database dan jalankan characterization test.
2. Deploy kolom/relasi pamit baru secara additive.
3. Deploy `pendaftaran_penjaluran_id` nullable pada `BimbinganSkripsi` dan progres lain yang relevan.
4. Backfill relasi pamit dan progres yang dapat ditentukan dengan aman.
5. Jalankan rekonsiliasi dry-run dan selesaikan record ambigu.
6. Deploy dual-read: utamakan field baru, fallback ke field legacy hanya untuk histori.
7. Wajibkan penulisan foreign key pendaftaran pada seluruh progres baru.
8. Deploy service generik; jadikan route/controller legacy sebagai adapter sementara, bukan fondasi domain.
9. Aktifkan eligibility dan pamit generik di balik feature flag.
10. Migrasikan Ulang Penelitian terlebih dahulu untuk membuktikan kompatibilitas.
11. Aktifkan Ulang Magang dan Ulang Perintisan.
12. Aktifkan enam kombinasi Alih.
13. Pasang partial unique index setelah data bersih.
14. Hentikan penulisan field DPA/pengajuan legacy setelah satu release stabil.
15. Hapus route/controller legacy hanya setelah tidak ada consumer lama.

Rollback aplikasi tidak boleh menghapus pamit, pendaftaran, assignment ended, atau histori yang sudah sah. Migration down hanya dijalankan jika aman terhadap data baru.

## 12. Definition of Done Tahap 3

Tahap dinyatakan selesai apabila:

- Ulang Penelitian, Magang, dan Perintisan berjalan end-to-end;
- enam kombinasi Alih antar-tiga jalur aktif berjalan end-to-end;
- jalur asal selalu berasal dari query pendaftaran approved yang terurut secara akademik dan tidak dapat dipalsukan frontend;
- target Ulang selalu sama dan target Alih selalu berbeda;
- Pengabdian tidak tersedia sebagai target selama hold;
- pamit hanya diwajibkan ketika ada penetapan aktif;
- mahasiswa tanpa penetapan aktif dapat melewati pamit setelah histori diverifikasi;
- pamit mengikat penetapan lama dan P1 aktif yang benar;
- pamit mengikat periode tujuan dan tidak dapat dipakai setelah periode tersebut ditutup;
- perubahan assignment/P1 membatalkan pamit pending lama dan pamit baru harus mengikat assignment pengganti;
- hanya P1 dapat memutus, sedangkan P2 hanya menerima informasi;
- rejection tidak mengubah siklus lama;
- approval mengakhiri penetapan lama, membatalkan bimbingan pending mendatang, mempertahankan histori, dan mengosongkan cache;
- satu pamit hanya dikonsumsi satu pendaftaran dan konsumsi terjadi saat pendaftaran commit;
- pendaftaran baru tidak menerima pilihan pembimbing;
- form, dokumen, kelompok, dan progres lama tetap utuh;
- pendaftaran baru menjadi root siklus/progres baru dan `BimbinganSkripsi` aktif selalu mempunyai `pendaftaran_penjaluran_id`;
- query progres aktif tidak mencampurkan bimbingan atau dokumen dari siklus lama;
- approval pamit tidak otomatis melepas topik `taken` tanpa aturan bisnis eksplisit;
- kelompok Perintisan lama tidak digunakan ulang dan setiap anggota baru tervalidasi individual;
- assignment pertama siklus baru menggunakan semester penjaluran ke-1;
- pembimbing baru hanya aktif setelah final Sekprodi melalui workflow Tahap 2;
- retry identik tidak menggandakan pamit, pendaftaran, kelompok, histori, assignment, atau notifikasi;
- request paralel dan kegagalan di tengah operasi menghasilkan satu state konsisten atau rollback penuh;
- rekonsiliasi tidak menemukan pamit approved dengan assignment lama aktif, pamit reusable, pendaftaran ganda, atau progres lintas siklus;
- seluruh unit test, integration test endpoint, frontend test, build, dry-run rekonsiliasi, dan UAT lulus;
- aturan bisnis, BPMN, API, backend, frontend, test, dan dokumentasi menyatakan flow yang sama.

## 13. Keputusan yang perlu dikunci

| Keputusan | Sikap rancangan |
| --- | --- |
| Sekprodi boleh override keputusan pamit atau tidak | Tidak diasumsikan; gunakan P1 aktif/pengganti sampai aturan berubah |
| Pamit pending ketika assignment/P1 berganti | Batalkan pamit lama dengan alasan `assignment_changed`; mahasiswa membuat pamit baru terhadap assignment pengganti |
| Masa berlaku pamit approved | Final: scoped ke `periode_tujuan_id`; menjadi `cancelled` saat periode ditutup dan tidak dapat digunakan lintas periode. |
| Pelepasan topik lama setelah pamit | Snapshot dan status `taken` dipertahankan; pelepasan hanya boleh dilakukan setelah ada BR akademik eksplisit |
| Binding anggota Perintisan | Minimum: pilih pendaftaran valid dari database, lock seluruh anggota, unique kelompok aktif, dan visibilitas ke anggota. Lifecycle undangan ditambahkan bila persetujuan anggota diwajibkan aturan akademik |
| Pendaftaran sebagai root siklus atau membuat tabel siklus khusus | Gunakan pendaftaran sebagai root kecuali kebutuhan lintas semester Tahap 4 membuktikan perlunya entitas terpisah |
| Kode sumber assignment awal ulang/alih | Gunakan `penjaluran` + jenis pada pendaftaran, atau tambah enum `ulang`/`alih` jika audit memerlukan |
| Menyalin draft data Magang lama | Hanya sebagai aksi eksplisit; dokumen dan record aktif tetap baru |

Keputusan baru wajib memperbarui `aturan-bisnis-simps.md`, BPMN, kontrak API, migrasi, implementasi, dan test dalam perubahan yang sama.
# Status implementasi (1 Agustus 2026 — blocker ditutup)

Kontrak backend Tahap 3 telah diimplementasikan secara additive. Sumber jalur dibaca dari pendaftaran approved terakhir secara deterministik; pamit generik dikunci ke periode, pendaftaran lama, penetapan lama, dan Pembimbing 1; approval memutus assignment serta jadwal mendatang dalam satu transaksi; dan pamit baru dikonsumsi ketika pendaftaran ulang/alih berhasil dibuat. Pendaftaran baru menjadi root siklus melalui `pendaftaran_asal_id`, sedangkan bimbingan baru ditautkan melalui `pendaftaran_penjaluran_id`.

Endpoint utama tersedia pada `/api/jalur/change/*`, `/api/pendaftaran/change`, dan `/api/dosen/pamit/:id/decision`. Endpoint lama pendaftaran/pamit tetap menjadi adapter kompatibilitas. UI mahasiswa sudah menggunakan eligibility generik untuk tiga jalur aktif dan tidak lagi menerima jalur asal atau calon pembimbing sebagai sumber keputusan. Migrasi `20260730100000-generalize-change-cycle.js`, rekonsiliasi `reconcile:stage3-change-cycles:*`, histori otoritatif, notifikasi, serta integration test lifecycle disertakan.

Hardening 31 Juli 2026 menambahkan verifikasi snapshot assignment sebelum keputusan pamit, pembatalan bimbingan yang dibatasi ke permohonan `pending` pada siklus lama, fingerprint dan `Idempotency-Key` wajib untuk pamit serta pendaftaran, pemeriksaan workflow nonterminal dan gate semester, notifikasi view-only untuk Pembimbing 2, pembatalan pamit saat periode ditutup, dan adapter lifecycle untuk endpoint status/history lama. Migrasi tambahannya adalah `20260731100000-strengthen-stage3-idempotency.js`.

Koreksi blocker 31 Juli 2026 memastikan keputusan terminal diperiksa sebelum snapshot assignment sehingga retry approval tetap `approved` dan ditandai replay, sedangkan keputusan terminal berbeda menghasilkan `409 PAMIT_DECISION_CONFLICT`. Pamit approved hanya mengecualikan `PAMIT_PENDING` dan gate semester akibat assignment yang sengaja diakhiri; workflow Penelitian, Magang/Perintisan, dan kelompok Perintisan aktif tetap memblokir. Replay pendaftaran merekonstruksi fingerprint dari pamit yang terhubung ke pendaftaran hasil, dan frontend mereset idempotency key hanya setelah hasil pasti sambil mempertahankannya pada kegagalan jaringan atau respons yang tidak dapat diverifikasi.

Verifikasi 1 Agustus 2026 menyatakan seluruh blocker koreksi tersebut tertutup. Migrasi `20260731100000-strengthen-stage3-idempotency.js` sudah tracked dalam commit `6e7684d`, sehingga kolom dan unique index idempotensi dapat diterapkan pada database lain melalui alur migrasi normal.
