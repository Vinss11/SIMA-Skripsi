# Rancangan Pengerjaan Tahap 1 — Finalisasi Status dan Konfigurasi Dosen

## 1. Tujuan

Menstabilkan pengelolaan status master dosen, konfigurasi penerimaan bimbingan baru per periode, penetapan penanggung jawab jalur, dan tindak lanjut dampak perubahan status agar konsisten dengan `aturan-bisnis-simps.md`.

Tahap ini bukan pembangunan ulang. Fondasi fitur sudah tersedia dan pekerjaan difokuskan pada penyelarasan aturan, penutupan gap, konsistensi data, serta pengujian regresi.

## 2. Acuan aturan bisnis

Rancangan ini terutama mengacu pada:

- BR-ROLE-001 sampai BR-ROLE-005;
- BR-DOSEN-001 sampai BR-DOSEN-004;
- BR-PERIODE-001 sampai BR-PERIODE-003;
- BR-PENELITIAN-004, BR-MAGANG-003, dan BR-PERINTISAN-003 untuk validasi pembimbing baru;
- Definition of Done sistem pada bagian 25.

Keputusan scope yang harus dijaga:

- jalur aktif release adalah Penelitian, Magang, dan Perintisan Bisnis;
- Pengabdian Masyarakat masih berstatus **hold** sehingga kode dan datanya dipertahankan, tetapi pengembangan flow baru serta kewajiban konfigurasi baru tidak ditambahkan;
- kuota tetap dikelola pada fitur kuota dan tidak disimpan ulang pada konfigurasi ketersediaan periode;
- preview pembukaan periode bukan status bisnis `draft`;
- status akun terpisah dari status master dosen.

## 3. Kontrak perilaku akhir

### 3.1 Status master dosen

| Status master | Status akun/login | Menerima bimbingan baru | Melanjutkan bimbingan lama | Tindak lanjut penggantian |
| --- | --- | --- | --- | --- |
| `active` | Mengikuti `account_is_active` | Bisa jika konfigurasi periode aktif mengizinkan dan kuota cukup | Bisa | Tidak |
| `inactive` | Mengikuti keputusan Admin | Tidak | Mengikuti `continue_existing_supervision` | Hanya jika ada mahasiswa aktif dan izin lanjut bernilai `false` |
| `study_leave` | Dapat tetap aktif | Tidak | Mengikuti `continue_existing_supervision` | Hanya jika ada mahasiswa aktif dan izin lanjut bernilai `false` |
| `retired` | Otomatis nonaktif | Tidak | Tidak | Hanya jika masih ada dampak aktif yang harus dialihkan/diselesaikan |

Catatan implementasi:

- `active` selalu efektif boleh melanjutkan bimbingan lama;
- `retired` selalu efektif tidak boleh melanjutkan;
- `continue_existing_supervision` hanya bermakna untuk `inactive` dan `study_leave`;
- setiap endpoint yang membuat penugasan pembimbing baru harus memvalidasi ulang status master, konfigurasi periode, dan kuota di backend dalam transaksi;
- perubahan status tidak membatalkan histori atau penetapan lama secara diam-diam.

### 3.2 Konfigurasi Sekprodi

Input bisnis yang dikelola Sekprodi pada konfigurasi periode hanya:

- `menerima_bimbingan_baru` (secara teknis dapat tetap dipetakan ke kolom `tersedia_membimbing`).

Kolom seperti `configuration_status`, waktu review, dan aktor perubahan boleh dipertahankan sebagai metadata sistem/audit, tetapi bukan pilihan bisnis tambahan bagi pengguna. Kuota hanya ditampilkan sebagai informasi baca-saja atau tautan menuju halaman kuota.

### 3.3 Penanggung jawab periode

Sebelum periode dibuka, Sekprodi menetapkan penanggung jawab untuk jalur yang aktif:

- Ketua Cluster Penelitian sesuai cluster;
- Pengawas Magang;
- Pengampu Perintisan Bisnis.

Pengampu Pengabdian dipertahankan sebagai data kompatibilitas, tetapi tidak wajib untuk membuka periode selama Pengabdian berstatus hold.

Penanggung jawab jalur tidak wajib bernilai `menerima_bimbingan_baru = true`. Validasi ketersediaan periode dan kuota baru diterapkan apabila dosen tersebut juga dipilih sebagai P1/P2.

Dokumen aturan bisnis belum menetapkan bahwa satu dosen dilarang memegang lebih dari satu peran penanggung jawab. Karena itu, validasi larangan peran rangkap tidak boleh dijadikan aturan final tanpa keputusan bisnis tambahan.

### 3.4 Tindak lanjut

Tindak lanjut dibuat hanya jika hasil evaluasi menunjukkan dampak yang masih memerlukan tindakan Sekprodi, yaitu:

- mahasiswa aktif kehilangan hak melanjutkan bimbingan;
- review/pengajuan aktif harus dialihkan;
- peran penanggung jawab aktif harus diganti;
- jadwal sidang mendatang terdampak.

Perubahan menjadi `study_leave` atau `inactive` dengan `continue_existing_supervision = true` tidak membuat tindak lanjut penggantian pembimbing hanya karena ada mahasiswa bimbingan lama.

Reaktivasi tidak otomatis membuat record tindak lanjut. Ketersediaan periode dapat diubah menjadi `needs_review` sebagai pekerjaan konfigurasi biasa, tetapi antrean tindak lanjut hanya dibuat jika memang ada dampak operasional lain yang belum selesai.

Record tindak lanjut baru boleh ditutup ketika evaluasi ulang server menunjukkan seluruh kategori dampak telah selesai. Pengecualian manual, jika nantinya dibutuhkan, harus menjadi keputusan bisnis eksplisit, beralasan, dan tercatat sebagai `resolved_with_exception`.

## 4. Kondisi implementasi saat ini dan gap

### 4.1 Sudah tersedia

- enum status `active`, `inactive`, `study_leave`, dan `retired`;
- pemisahan `status_keaktifan`, `account_is_active`, dan `continue_existing_supervision`;
- histori perubahan status dan impact snapshot;
- konfigurasi ketersediaan dosen per periode;
- penghapusan kuota dan field ketersediaan lain dari tabel konfigurasi periode;
- validasi backend untuk status master, ketersediaan periode, dan kuota saat penugasan baru;
- setup periode tanpa status draft persisten;
- sinkronisasi ulang tampilan ketersediaan setelah simpan serta saat tab kembali fokus;
- satu tindak lanjut terbuka maksimum per dosen;
- workflow penggantian pembimbing dari antrean tindak lanjut.

### 4.2 Gap yang harus ditutup

1. Reaktivasi masih selalu dikategorikan sebagai alasan tindak lanjut, walaupun belum tentu ada dampak operasional.
2. Penyelesaian manual tindak lanjut baru memblokir penggantian mahasiswa yang belum selesai; kategori review, peran periode, dan jadwal sidang masih dapat ditutup walaupun dampaknya tersisa.
3. Pembukaan periode masih mewajibkan Pengampu Pengabdian, padahal jalur tersebut berstatus hold.
4. UI/backend masih melarang satu dosen memegang lebih dari satu peran penanggung jawab, sementara larangan tersebut belum ada di dokumen aturan bisnis.
5. Kandidat pembimbing yang tersimpan di state halaman dapat menjadi usang ketika Admin mengubah status dari sesi lain. Validasi backend sudah menjadi pengaman, tetapi dropdown perlu melakukan re-fetch/invalidation saat dibuka atau menerima notifikasi perubahan.
6. Test yang tersedia belum mencakup matriks status, pembuatan/penutupan tindak lanjut, pembukaan periode berdasarkan scope jalur aktif, dan sinkronisasi kandidat secara menyeluruh.

## 5. Rencana pengerjaan

### Paket 1 — Kunci kontrak domain

1. Buat helper/matriks tunggal untuk menghasilkan keputusan efektif:
   - boleh login;
   - boleh menerima penugasan baru;
   - boleh melanjutkan bimbingan lama;
   - perlu penggantian pembimbing.
2. Gunakan helper yang sama pada preview dampak Admin, penyimpanan status, hak akses bimbingan lama, daftar kandidat, dan finalisasi P1/P2.
3. Pastikan `continue_existing_supervision` dinormalisasi oleh server berdasarkan status, bukan dipercaya mentah dari frontend.
4. Pertahankan `account_is_active` sebagai keputusan terpisah, kecuali `retired` yang memaksa akun nonaktif.

Hasil: tidak ada perbedaan keputusan antar-controller untuk status dosen yang sama.

### Paket 2 — Stabilisasi perubahan status master

1. Pertahankan preview dampak sebelum simpan.
2. Simpan perubahan dosen, histori, sinkronisasi ketersediaan periode aktif, penonaktifan topik baru, dan evaluasi tindak lanjut dalam satu transaksi.
3. Saat dosen berubah dari `active` menjadi status lain:
   - keluarkan dari kandidat pembimbing baru secara efektif;
   - set konfigurasi periode aktif menjadi tidak menerima dan terkunci oleh status master;
   - jangan mengakhiri penetapan lama jika dosen masih boleh melanjutkan.
4. Saat reaktivasi:
   - jangan otomatis mengaktifkan topik atau penerimaan bimbingan baru;
   - set ketersediaan periode aktif menjadi perlu ditinjau;
   - jangan membuat tindak lanjut generik hanya untuk proses review ketersediaan.
5. Pastikan perubahan hanya pada status akun tidak mengubah ketersediaan akademik atau membuat tindak lanjut palsu.

Hasil: status master langsung memengaruhi kelayakan tanpa merusak histori dan tanpa membuat pekerjaan semu.

### Paket 3 — Sederhanakan konfigurasi Sekprodi

1. UI hanya menyediakan toggle “Menerima bimbingan baru”.
2. Tampilkan status master sebagai informasi dan kunci toggle untuk dosen nonaktif.
3. Tampilkan kuota sebagai baca-saja; perubahan kuota tetap melalui halaman kuota.
4. Simpan perubahan secara bulk dan idempotent, dengan unique key `(dosen_id, periode_penjaluran_id)`.
5. Setelah simpan, refresh:
   - grid ketersediaan;
   - ringkasan periode;
   - seluruh sumber kandidat pembimbing yang sedang terbuka.
6. Untuk perubahan lintas sesi, pilih salah satu mekanisme minimum:
   - re-fetch kandidat setiap kali dropdown/modal penetapan dibuka; atau
   - cache invalidation berbasis event/SSE/WebSocket.

Rekomendasi tahap stabilisasi: re-fetch saat komponen kandidat dibuka dan saat window kembali fokus. Pendekatan ini lebih kecil risikonya; push event dapat menjadi optimasi berikutnya.

Hasil: perubahan terlihat tanpa tombol refresh manual dan data usang tetap ditolak oleh backend.

### Paket 4 — Selaraskan penanggung jawab dan pembukaan periode

1. Bentuk daftar field wajib berdasarkan jalur release yang aktif, bukan array peran statis.
2. Wajibkan Ketua Cluster Penelitian, Pengawas Magang, dan Pengampu Perintisan Bisnis.
3. Jangan wajibkan Pengampu Pengabdian selama statusnya hold; pertahankan kolom dan data lama.
4. Pisahkan validasi penanggung jawab dari validasi calon P1/P2:
   - penanggung jawab cukup dosen berstatus master `active`;
   - `menerima_bimbingan_baru` dan kuota tidak diperiksa untuk sekadar menjadi penanggung jawab;
   - pemeriksaan lengkap dilakukan jika dosen dipilih sebagai pembimbing.
5. Hapus/relaksasi validasi peran rangkap, kecuali aturan bisnis kemudian menetapkannya secara eksplisit.
6. Pastikan preview dan open menjalankan validator yang sama, sedangkan operasi open tetap atomik dan menolak jika masih ada periode aktif.

Hasil: pembukaan periode sesuai scope aktif dan tidak mencampur peran pengampu dengan kelayakan pembimbing.

### Paket 5 — Benahi siklus hidup tindak lanjut

1. Ubah evaluator agar `required` hanya berasal dari kategori dampak aktual yang belum selesai.
2. Hilangkan `reactivation` sebagai alasan mandiri pembuatan tindak lanjut.
3. Saat status berubah lagi, evaluasi ulang record terbuka:
   - update satu record terbuka yang ada jika dampak masih tersisa;
   - tutup otomatis jika seluruh dampak hilang;
   - jangan membuat duplikat.
4. Pada halaman detail, hitung dampak terkini dari data sumber, bukan hanya snapshot lama.
5. Blokir tombol selesai apabila salah satu kategori wajib masih tersisa.
6. Sediakan aksi konkret per kategori:
   - aktivasi pembimbing pengganti;
   - pengalihan review/pengajuan;
   - penggantian penanggung jawab periode;
   - penggantian/reschedule personel sidang.
7. Setelah setiap aksi, hitung ulang dampak dan tutup otomatis apabila semuanya sudah selesai.
8. Jalankan script rekonsiliasi untuk menutup tindak lanjut lama yang tidak lagi mempunyai dampak nyata.

Hasil: antrean Sekprodi hanya berisi pekerjaan yang benar-benar perlu diselesaikan.

### Paket 6 — Konsistensi semua jalur kandidat pembimbing

Audit seluruh sumber dropdown dan endpoint finalisasi untuk Penelitian, Magang, Perintisan Bisnis, penggantian pembimbing, serta flow legacy yang masih dipertahankan. Setiap jalur harus menggunakan aturan yang sama:

1. `status_keaktifan === active`;
2. konfigurasi periode `ready` dan menerima bimbingan baru;
3. kuota mencukupi jumlah mahasiswa yang akan ditetapkan;
4. P1 dan P2 berbeda;
5. cluster/bidang sesuai bila diwajibkan;
6. validasi ulang di dalam transaksi sesaat sebelum penetapan aktif dibuat.

Untuk kelompok Perintisan Bisnis, kuota dihitung berdasarkan jumlah anggota dan seluruh finalisasi harus rollback jika satu anggota gagal.

Hasil: menyembunyikan dosen dari dropdown dan menolak request usang menghasilkan keputusan yang sama.

### Paket 7 — Migrasi, rekonsiliasi, dan observabilitas

1. Tambahkan migrasi hanya bila diperlukan untuk constraint/index; jangan menambah field bisnis baru tanpa kebutuhan.
2. Pastikan constraint berikut tersedia:
   - satu konfigurasi per dosen-periode;
   - maksimum satu tindak lanjut `open` per dosen;
   - maksimum satu periode efektif aktif.
3. Siapkan dry-run rekonsiliasi untuk:
   - dosen nonaktif yang masih menerima bimbingan baru;
   - dosen aktif hasil reaktivasi yang masih memakai nilai ketersediaan lama tanpa review;
   - tindak lanjut terbuka tanpa dampak;
   - periode aktif yang belum mempunyai konfigurasi lengkap.
4. Hasil dry-run menampilkan jumlah dan ID terdampak sebelum mode execute dijalankan.
5. Catat perubahan status, perubahan ketersediaan, dan penyelesaian tindak lanjut pada audit trail.

Hasil: deployment dapat dilakukan pada data lama tanpa menghasilkan state ambigu.

## 6. Strategi pengujian

### 6.1 Unit test

Gunakan table-driven test untuk seluruh kombinasi:

- empat status master;
- status akun aktif/nonaktif;
- izin lanjut true/false;
- konfigurasi periode menerima/tidak;
- kuota cukup/penuh;
- ada/tidak ada dampak aktif.

Fokus helper: `canReceiveNewAssignment`, `canContinueExistingSupervision`, dan `evaluateStatusFollowUp`.

### 6.2 Integration/API test

Minimal skenario:

1. `active + ready + menerima + kuota tersedia` dapat dipilih sebagai P1/P2.
2. Setiap status nonaktif ditolak sebagai pembimbing baru walaupun request dikirim langsung ke API.
3. `study_leave + continue=true` tetap dapat memproses bimbingan lama dan tidak membuat kewajiban penggantian.
4. `inactive + continue=false` dengan mahasiswa aktif membuat satu tindak lanjut.
5. Perubahan status berulang tidak membuat dua tindak lanjut terbuka.
6. Tindak lanjut tertutup otomatis jika dampak sudah nol.
7. Tindak lanjut tidak dapat ditutup selama review, peran periode, jadwal sidang, atau penggantian mahasiswa masih tersisa.
8. Reaktivasi mengubah ketersediaan menjadi perlu ditinjau tanpa membuat tindak lanjut kosong.
9. Penanggung jawab dapat ditetapkan tanpa menerima bimbingan baru.
10. Penanggung jawab yang sama untuk lebih dari satu peran mengikuti keputusan bisnis final.
11. Periode dapat dibuka tanpa Pengampu Pengabdian selama jalur hold.
12. Finalisasi kelompok Perintisan rollback ketika kuota salah satu pembimbing tidak cukup.

### 6.3 Frontend/component test

1. Toggle terkunci untuk status nonaktif.
2. Kuota tidak dapat diedit dari tab ketersediaan.
3. Setelah simpan, badge, ringkasan, dan dropdown memakai data terbaru tanpa refresh browser.
4. Dropdown yang dibuka ulang melakukan re-fetch dan menghapus dosen yang baru dinonaktifkan.
5. Draft perubahan lokal tidak tertimpa tanpa konfirmasi ketika refresh otomatis terjadi.
6. Form penanggung jawab tidak mewajibkan jalur hold.
7. Tombol selesai tindak lanjut disabled dan menjelaskan kategori yang belum selesai.

### 6.4 UAT

Lakukan UAT bersama Admin dan Sekprodi menggunakan skenario lintas sesi:

1. Sekprodi membuka dropdown pembimbing.
2. Admin mengubah dosen menjadi `study_leave` dengan izin lanjut aktif.
3. Sekprodi membuka ulang dropdown: dosen hilang dari kandidat baru.
4. Bimbingan mahasiswa lama tetap dapat diproses.
5. Tidak ada tindak lanjut penggantian untuk mahasiswa lama.

Ulangi dengan izin lanjut nonaktif dan pastikan tindak lanjut muncul serta baru hilang setelah penggantian selesai.

## 7. Urutan implementasi dan dependensi

| Urutan | Paket | Dependensi | Risiko |
| --- | --- | --- | --- |
| 1 | Kontrak domain dan unit test | Tidak ada | Tinggi, menjadi sumber keputusan semua flow |
| 2 | Status master dan evaluator tindak lanjut | Paket 1 | Tinggi, memengaruhi akses dan data aktif |
| 3 | Penanggung jawab dan pembukaan periode | Paket 1 | Sedang-tinggi |
| 4 | Konfigurasi Sekprodi dan sinkronisasi kandidat | Paket 1–3 | Sedang |
| 5 | Siklus hidup tindak lanjut dan aksi penyelesaian | Paket 2 | Tinggi |
| 6 | Audit seluruh jalur finalisasi P1/P2 | Paket 1–4 | Tinggi |
| 7 | Rekonsiliasi data, integration test, dan UAT | Semua paket | Tinggi sebelum release |

## 8. Definition of Done Tahap 1

Tahap dinyatakan selesai apabila:

- empat status master dan status akun menghasilkan perilaku sesuai matriks;
- dosen nonaktif tidak muncul sebagai kandidat dan ditolak backend untuk mahasiswa baru;
- dosen `study_leave`/`inactive` yang diizinkan melanjutkan tetap dapat memproses bimbingan lama;
- perubahan status dan konfigurasi tercermin pada dropdown tanpa refresh browser manual;
- kuota hanya dikelola pada halaman kuota;
- penanggung jawab periode dapat ditetapkan tanpa harus menerima bimbingan baru;
- pembukaan periode hanya mewajibkan penanggung jawab jalur release aktif;
- tindak lanjut hanya dibuat untuk dampak aktual yang belum selesai;
- tindak lanjut tidak dapat ditutup sebelum seluruh kategori dampak terselesaikan;
- tidak ada lebih dari satu tindak lanjut terbuka per dosen;
- histori status, konfigurasi, dan penetapan lama tetap utuh;
- seluruh unit test, integration test, build frontend, dan skenario UAT Tahap 1 lulus;
- dokumentasi, UI, backend, test, dan BPMN terkait menyatakan aturan yang sama.

## 9. Keputusan yang perlu dikunci sebelum implementasi penuh

Hanya satu keputusan yang belum tertulis eksplisit dalam aturan bisnis saat ini:

- apakah satu dosen boleh merangkap beberapa peran penanggung jawab pada periode yang sama.

Rekomendasi sementara: izinkan peran rangkap karena tidak ada larangan pada sumber aturan bisnis, lalu tambahkan larangan hanya jika keputusan akademik menyatakannya secara eksplisit.
