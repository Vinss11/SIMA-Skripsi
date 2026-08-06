# Aturan Bisnis SIMPS

## 1. Tujuan dokumen

Dokumen ini menjadi sumber acuan tunggal untuk analisis, implementasi backend, antarmuka, pengujian, dan BPMN SIMPS. Aturan disusun berdasarkan catatan bimbingan pertama dan keputusan pengembangan terbaru.

Jika implementasi, desain, atau BPMN berbeda dengan dokumen ini, perbedaannya harus diselesaikan terlebih dahulu. Perubahan aturan wajib dicatat pada riwayat perubahan di bagian akhir dokumen.

## 2. Status aturan

Setiap aturan menggunakan salah satu status berikut:

- **Final**: sudah menjadi keputusan pengembangan dan boleh diimplementasikan.
- **Sementara**: dipakai agar pengembangan dapat berjalan, tetapi masih dapat disesuaikan.
- **Hold**: aturan tetap didokumentasikan dan implementasi yang sudah ada dipertahankan, tetapi pengembangan baru serta perubahan flow dihentikan sementara.
- **Ditunda**: belum boleh diubah atau dikembangkan sampai ada hasil bimbingan.
- **Di luar scope**: tidak digunakan pada versi sistem sekarang.

## 3. Scope pengembangan

### 3.1 Scope aktif

- Master data dosen dan status keaktifan.
- Konfigurasi penerimaan mahasiswa bimbingan baru per periode.
- Penelitian.
- Magang.
- Perintisan Bisnis.
- Pendaftaran baru, ulang jalur, dan alih jalur.
- Penetapan Pembimbing 1 dan Pembimbing 2.
- Histori pembimbing dan aktivitas mahasiswa per semester.
- Bimbingan, izin lanjut, persyaratan pendadaran, penjadwalan, penilaian, revisi, dan kelulusan.
- Pemberitahuan dalam aplikasi.

Ketiga jalur aktif harus diselesaikan secara end-to-end sampai hasil sidang, revisi, yudisium, dan kelulusan.

### 3.2 Scope hold

- Pengabdian Masyarakat.

Kode dan data Pengabdian yang sudah ada tidak dihapus. Perbaikan kritis yang menjaga keamanan atau integritas data tetap diperbolehkan, tetapi fitur baru, perubahan flow, dan perluasan test bisnis Pengabdian tidak menjadi prioritas release aktif sampai status hold dicabut.

### 3.3 Keputusan Penelitian yang masih ditunda

- Keputusan review tiga pilihan topik secara berurutan atau paralel.
- Aturan final topik dosen dan judul mandiri.

Penelitian termasuk scope aktif, tetapi bagian yang bergantung pada dua keputusan tersebut tidak boleh diubah berdasarkan asumsi. Perilaku yang sedang berjalan dipertahankan sampai hasil bimbingan tersedia. Setelah keputusan diperoleh, aturan ini, BPMN, implementasi, dan test wajib diperbarui bersama.

### 3.4 Di luar scope versi sekarang

- Surat tugas pembimbing.
- Nomor surat, penerbitan surat, file surat, penandatangan, dan addendum surat.
- Aktivasi pembimbing berdasarkan penerbitan surat.

Penetapan pembimbing aktif segera setelah keputusan final Sekretaris Prodi berhasil disimpan.

## 4. Istilah dan peran

### BR-ROLE-001 — Admin

**Status: Final**

Admin bertanggung jawab atas:

- master mahasiswa;
- master dosen;
- status keaktifan dosen;
- status akun;
- import data;
- reset akses jika diperlukan;
- master data umum yang tidak merupakan keputusan akademik.

Admin tidak menentukan pembimbing final mahasiswa.

### BR-ROLE-002 — Sekretaris Prodi

**Status: Final**

Sekretaris Prodi bertanggung jawab atas:

- periode penjaluran;
- penanggung jawab/pengampu jalur;
- konfigurasi dosen yang menerima bimbingan baru;
- keputusan final pengajuan;
- pemilihan P1 dan P2;
- tindak lanjut dampak perubahan status dosen;
- verifikasi akademik dan pendadaran;
- penjadwalan sidang;
- perubahan penguji dan reschedule;
- monitoring histori mahasiswa.

### BR-ROLE-003 — Penanggung jawab jalur

**Status: Final**

Penanggung jawab jalur meliputi Ketua Cluster Penelitian, Pengawas Magang, Pengampu Perintisan, dan—ketika scope hold dibuka kembali—Pengampu Pengabdian. Penanggung jawab jalur:

- ditentukan Sekretaris Prodi sebelum periode dibuka;
- memeriksa pengajuan sesuai jalur dan periode penugasannya;
- dapat menyetujui atau menolak pengajuan;
- tidak otomatis menjadi pembimbing mahasiswa;
- hanya menjadi pembimbing jika dipilih pada keputusan final dan memenuhi persyaratan pembimbing.

### BR-ROLE-004 — Pembimbing

**Status: Final**

- P1 merupakan pembimbing utama.
- P2 merupakan pembimbing kedua dan bersifat opsional sampai ada keputusan akademik yang mewajibkannya.
- P1 dan P2 harus merupakan dosen berbeda.
- Hak akses pembimbing berasal dari penetapan aktif, bukan hanya kolom cache pada mahasiswa.
- Keputusan pamit dilakukan oleh P1 aktif.

### BR-ROLE-005 — Peran melekat pada akun dosen

**Status: Final**

Peran tambahan seperti pengampu, ketua cluster, pembimbing, dan penguji melekat pada akun dosen. Dosen tidak membuat akun terpisah untuk setiap peran. Menu yang tampil mengikuti peran yang sedang dimiliki.

## 5. Master dosen dan ketersediaan

### BR-DOSEN-001 — Status master dosen

**Status: Final**

Status master dosen terdiri dari:

- `active`;
- `inactive`;
- `study_leave`;
- `retired`.

Status ditetapkan Admin dan berlaku secara global.

### BR-DOSEN-002 — Dampak status

**Status: Final**

| Status | Menerima bimbingan baru | Melanjutkan bimbingan lama |
| --- | --- | --- |
| `active` | Dapat, jika konfigurasi periode mengizinkan | Dapat |
| `inactive` | Tidak dapat | Mengikuti izin melanjutkan bimbingan lama |
| `study_leave` | Tidak dapat | Dapat jika Admin mengizinkan |
| `retired` | Tidak dapat | Tidak dapat |

Status login dikelola terpisah melalui status akun. Dosen tugas belajar dapat tetap login walaupun tidak dapat menerima mahasiswa baru.

### BR-DOSEN-003 — Ketersediaan per periode

**Status: Final**

- Sekretaris Prodi mengatur apakah dosen menerima mahasiswa bimbingan baru pada periode penjaluran tertentu.
- Perubahan konfigurasi berlaku untuk pemilihan berikutnya dan harus langsung tercermin tanpa refresh manual.
- Menonaktifkan penerimaan mahasiswa baru tidak membatalkan penetapan lama.
- Kuota bimbingan dikelola pada fitur kuota, bukan diduplikasi di konfigurasi ketersediaan.
- Tidak diperlukan field alasan pada konfigurasi ketersediaan.

### BR-DOSEN-004 — Tindak lanjut perubahan status

**Status: Final**

Tindak lanjut hanya dibuat jika perubahan status benar-benar menghasilkan dampak yang belum selesai, seperti:

- mahasiswa aktif kehilangan hak melanjutkan bimbingan;
- review aktif yang harus dialihkan;
- jadwal sidang yang terdampak.

Dosen `study_leave` yang tetap diizinkan melanjutkan bimbingan tidak memerlukan penggantian pembimbing hanya karena perubahan status master.

## 6. Periode penjaluran

### BR-PERIODE-001 — Fungsi periode

**Status: Final**

Periode penjaluran merupakan jendela pendaftaran pada semester akademik tertentu, bukan masa satu semester penuh. Periode tetap menyimpan tahun akademik dan semester agar aktivitas mahasiswa dapat ditelusuri per semester.

### BR-PERIODE-002 — Pembukaan periode

**Status: Final**

Tidak ada status draft periode yang harus dikelola pengguna. Alurnya:

1. Sekretaris Prodi mengisi identitas dan tanggal periode.
2. Sistem menampilkan preview.
3. Sekretaris Prodi menentukan pengampu/penanggung jawab.
4. Sekretaris Prodi mengatur dosen yang menerima bimbingan baru.
5. Sistem memvalidasi kesiapan.
6. Sekretaris Prodi membuka periode.

Preview bukan status bisnis tersendiri dan tidak mengaktifkan pendaftaran.

### BR-PERIODE-003 — Perubahan ketika periode aktif

**Status: Final**

Sekretaris Prodi dapat mengubah penerimaan bimbingan baru selama periode aktif. Perubahan:

- langsung memengaruhi kandidat pada keputusan final berikutnya;
- tidak mencabut pembimbing yang sudah ditetapkan;
- tidak mengubah histori penetapan yang sudah aktif atau berakhir.

## 7. Pendaftaran penjaluran

### BR-DAFTAR-001 — Jenis pendaftaran

**Status: Final**

Jenis pendaftaran terdiri dari:

- `baru`: mahasiswa belum mempunyai siklus penjaluran sebelumnya;
- `ulang`: mahasiswa memulai siklus baru pada jalur yang sama;
- `alih`: mahasiswa memulai siklus baru pada jalur yang berbeda.

### BR-DAFTAR-002 — Penentuan jalur asal

**Status: Final**

Jalur asal ditentukan server dari pendaftaran terakhir yang sudah disetujui. Jalur asal dari input frontend tidak boleh menjadi sumber kebenaran.

### BR-DAFTAR-003 — Ulang jalur

**Status: Final**

- Jalur tujuan harus sama dengan jalur asal.
- Mahasiswa harus menyelesaikan pamit jika masih memiliki penetapan aktif.
- Ulang membuat pendaftaran, kelompok jika relevan, dan siklus progres baru.
- Data siklus lama tidak dihapus.

### BR-DAFTAR-004 — Alih jalur

**Status: Final**

- Jalur tujuan harus berbeda dari jalur asal.
- Mahasiswa harus menyelesaikan pamit jika masih memiliki penetapan aktif.
- Alih membuat pendaftaran dan siklus progres baru.
- Data jalur dan kelompok lama dipertahankan sebagai histori.

### BR-DAFTAR-005 — Pembatasan pendaftaran

**Status: Final**

Mahasiswa tidak dapat mendaftar jika:

- periode belum dibuka atau di luar rentang tanggal;
- sudah mempunyai pendaftaran pada periode yang sama;
- masih mempunyai pengajuan aktif yang belum selesai;
- pamit wajib tetapi belum disetujui;
- target jalur tidak tersedia;
- aturan semester lanjutan mewajibkan proses lain terlebih dahulu.

### BR-DAFTAR-006 — Pemilihan pembimbing

**Status: Final**

Mahasiswa tidak memilih pembimbing lama atau baru pada form pendaftaran ulang/alih. Pembimbing lama dibaca dari histori, sedangkan pembimbing baru dipilih Sekretaris Prodi pada keputusan final.

### BR-DAFTAR-007 — Pendaftaran pertama dan provisioning akun mahasiswa

**Status: Final**

Pendaftaran jenis `baru` boleh dimulai oleh mahasiswa yang NIM-nya belum tersedia pada Master Mahasiswa. Kondisi “NIM belum ditemukan pada master” merupakan mode pembuatan akun baru, bukan error kelayakan pendaftaran.

Aturan flow:

- NIM tidak ditemukan pada master → izinkan mahasiswa mengisi identitas dan form penjaluran pertama; pada submit final, sistem membuat akun Mahasiswa, data master minimum, credential awal, dan pendaftaran dalam satu transaksi;
- NIM ditemukan dan belum mempunyai pendaftaran pada periode aktif → mahasiswa wajib membuktikan kepemilikan akun melalui autentikasi sebelum melanjutkan;
- NIM ditemukan dan sudah mempunyai pendaftaran pada periode aktif → pendaftaran ditolak sebagai duplikat;
- NIM hanya wajib terisi dan tidak dibatasi pola fakultas/angkatan tertentu. Periode tertutup, target jalur tidak aktif, data minimum tidak lengkap, atau pendaftaran ganda tetap ditolak.

Untuk akun yang dibuat melalui pendaftaran pertama, password awal menggunakan NIM sesuai BR-AKUN-001. Credential dibuat melalui credential service dengan state `default`; password maupun hash tidak boleh dikembalikan melalui response. Seluruh data form pendaftaran pertama boleh diselesaikan dalam request bootstrap yang sama, tetapi setelah akun terbentuk pengguna hanya memperoleh akses restricted dan wajib mengganti password sebelum memakai endpoint bisnis berikutnya.

Pengecualian bootstrap ini hanya berlaku untuk pemohon utama pada pendaftaran jenis `baru`. Ulang/alih tetap wajib authenticated, dan anggota kelompok Perintisan yang belum mempunyai akun harus melakukan provisioning pendaftaran pertamanya sendiri atau melalui proses master/import yang sah.

## 8. Pamit dan pengakhiran siklus lama

### BR-PAMIT-001 — Kewajiban pamit

**Status: Final**

Pamit wajib untuk ulang/alih jika mahasiswa masih mempunyai penetapan pembimbing aktif. Jika tidak ada penetapan aktif, sistem dapat melewati pamit setelah memastikan histori mahasiswa tersedia.

### BR-PAMIT-002 — Keputusan pamit

**Status: Final**

- Pamit diproses P1 aktif.
- P2 dapat diberi pemberitahuan tetapi tidak memberikan keputusan kedua.
- Pamit yang ditolak tidak mengakhiri penetapan.
- Pamit yang disetujui mengakhiri penetapan lama.
- Satu pamit hanya dapat digunakan untuk satu pendaftaran baru.

### BR-PAMIT-003 — Dampak pamit disetujui

**Status: Final**

Ketika pamit disetujui:

- penetapan lama berstatus berakhir;
- permohonan bimbingan mendatang yang masih pending dibatalkan;
- catatan dan bimbingan yang sudah terjadi tetap tersimpan;
- cache pembimbing aktif mahasiswa dikosongkan;
- mahasiswa dapat melanjutkan pendaftaran ulang/alih;
- mahasiswa dan dosen terkait menerima pemberitahuan.

### BR-PAMIT-004 — Masa berlaku pamit

**Status: Final**

- Pamit hanya berlaku untuk periode tujuan yang direkam saat pamit diajukan.
- Pamit tidak dapat digunakan untuk membuat pendaftaran pada periode lain.
- Pamit berstatus `pending` atau `approved` yang belum dikonsumsi otomatis menjadi `cancelled` ketika periode tujuan ditutup.
- Pamit yang sudah dibatalkan karena periode berakhir tidak dapat diaktifkan kembali; mahasiswa harus mengajukan pamit baru untuk periode aktif berikutnya jika masih diwajibkan.

## 9. Penelitian

### BR-PENELITIAN-001 — Sifat pengajuan

**Status: Final**

Penelitian diproses sebagai pengajuan individual melalui topik dosen atau judul mandiri. Mahasiswa harus mempunyai pendaftaran aktif dengan target Penelitian sebelum mengirim pengajuan.

### BR-PENELITIAN-002 — Pilihan topik dosen

**Status: Final untuk kebutuhan data; urutan review Ditunda**

- Mahasiswa dapat mengirim sampai tiga pilihan topik berdasarkan prioritas.
- Topik dan dosen harus berasal dari data sistem; frontend tidak boleh mengubah judul atau pemilik topik.
- Topik yang sedang diproses harus direservasi agar tidak diambil mahasiswa lain secara tidak sah.
- Setiap keputusan dosen dan Ketua Cluster disimpan pada histori review.
- Hanya satu topik yang dapat menjadi topik final mahasiswa.
- Topik yang tidak dipilih harus dilepas kembali sesuai status ketersediaannya.

Keputusan apakah review dilakukan berurutan dari pilihan 1 ke pilihan berikutnya atau paralel masih menunggu hasil bimbingan. Implementasi yang sedang berjalan tidak diubah sampai keputusan tersebut dicatat pada dokumen ini.

### BR-PENELITIAN-003 — Judul mandiri

**Status: Sementara**

- Mahasiswa mengajukan judul dan bidang/cluster yang relevan.
- Calon pembimbing dan Ketua Cluster melakukan review sesuai tanggung jawabnya.
- Detail urutan review dan pihak yang memilih calon pembimbing masih menunggu konfirmasi.
- Persetujuan sebelum Sekretaris Prodi belum mengaktifkan pembimbing.

### BR-PENELITIAN-004 — Keputusan final

**Status: Final**

1. Pengajuan yang telah memenuhi review masuk ke antrean Sekretaris Prodi.
2. Sekretaris Prodi melihat seluruh judul/topik dan histori review.
3. Sekretaris Prodi menentukan topik/judul final serta P1 dan opsional P2.
4. Sistem memvalidasi status, ketersediaan, cluster/bidang, dan kuota dosen.
5. Keputusan final membuat penetapan aktif dan membuka bimbingan.

Tidak ada tahap penerbitan surat tugas setelah keputusan final.

## 10. Magang

### BR-MAGANG-001 — Sifat pengajuan

**Status: Final**

Magang diproses sebagai pengajuan individual. Mahasiswa dapat memilih mitra aktif atau mengajukan perusahaan nonmitra sesuai form dan persyaratan yang berlaku.

### BR-MAGANG-002 — Data dan dokumen

**Status: Final**

- Form menyimpan data perusahaan, posisi, dan informasi kegiatan yang diperlukan.
- Mitra yang dipilih direferensikan ke master mitra dan disimpan juga sebagai snapshot untuk menjaga histori.
- Dokumen wajib dan opsional divalidasi berdasarkan jenis perusahaan.
- Batas ukuran, tipe file, dan kewajiban dokumen harus berasal dari konfigurasi/validasi backend, bukan hanya frontend.
- Dokumen pengajuan lama tidak dihapus ketika mahasiswa ulang atau alih jalur.

### BR-MAGANG-003 — Alur persetujuan

**Status: Final**

1. Mahasiswa mempunyai pendaftaran aktif dengan target Magang.
2. Mahasiswa mengisi form dan mengunggah dokumen.
3. Pengawas Magang pada periode tersebut mereview.
4. Penolakan dikembalikan kepada mahasiswa dengan catatan.
5. Persetujuan Pengawas Magang meneruskan pengajuan ke keputusan final Sekretaris Prodi.
6. Sekretaris Prodi memilih P1 dan opsional P2.
7. Sistem memvalidasi status, ketersediaan, dan kuota dosen.
8. Keputusan final membuat penetapan aktif dan membuka bimbingan.

Pengawas Magang tidak otomatis menjadi pembimbing mahasiswa.

## 11. Pengabdian Masyarakat

### BR-PENGABDIAN-001 — Sifat pengajuan

**Status: Hold**

Pengabdian Masyarakat diproses sebagai pengajuan individual sampai terdapat keputusan akademik berbeda.

### BR-PENGABDIAN-002 — Alur persetujuan

**Status: Hold**

1. Mahasiswa mempunyai pendaftaran aktif dengan target Pengabdian.
2. Mahasiswa mengisi dan mengirim form Pengabdian.
3. Pengampu Pengabdian pada periode tersebut mereview.
4. Penolakan dikembalikan kepada mahasiswa dengan catatan.
5. Persetujuan pengampu meneruskan pengajuan ke keputusan final Sekretaris Prodi.
6. Sekretaris Prodi memilih P1 dan opsional P2.
7. Sistem memvalidasi status, ketersediaan, dan kuota dosen.
8. Keputusan final membuat penetapan aktif dan membuka bimbingan.

Persetujuan pengampu belum mengaktifkan pembimbing.

Selama status hold, aturan ini dipertahankan sebagai rancangan dan acuan implementasi yang sudah ada, tetapi bukan target pengembangan release aktif.

## 12. Perintisan Bisnis

### BR-PERINTISAN-001 — Sifat pengajuan

**Status: Final**

Perintisan Bisnis diproses sebagai pengajuan kelompok. Form dikirim oleh ketua kelompok.

### BR-PERINTISAN-002 — Keanggotaan kelompok

**Status: Final**

- Semua anggota harus berada pada periode yang sama.
- Semua anggota harus mempunyai target Perintisan Bisnis.
- Anggota ulang/alih harus menyelesaikan pamit jika diwajibkan.
- Satu mahasiswa hanya boleh berada dalam satu kelompok aktif.
- Kelompok lama tidak dipakai ulang; periode/siklus baru membuat kelompok baru.
- Perubahan kelompok lama tidak boleh menghapus histori keanggotaan.

Jumlah anggota mengikuti ketentuan akademik yang berlaku pada form. Jika ketentuan jumlah berubah, validasi backend, frontend, dan dokumentasi harus diubah bersama.

### BR-PERINTISAN-003 — Alur persetujuan

**Status: Final**

1. Kelompok dibentuk dan seluruh anggota tervalidasi.
2. Ketua mengisi dan mengirim form.
3. Pengampu Perintisan mereview.
4. Persetujuan pengampu meneruskan kelompok ke keputusan final Sekretaris Prodi.
5. Sekretaris Prodi memilih P1 dan opsional P2 untuk seluruh kelompok.
6. Kuota setiap dosen dihitung berdasarkan jumlah anggota.
7. Sistem membuat penetapan dengan komposisi P1/P2 yang sama untuk setiap anggota.
8. Seluruh proses finalisasi dilakukan dalam satu transaksi.

Jika satu anggota gagal diproses, seluruh keputusan final kelompok dibatalkan/rollback.

### BR-PERINTISAN-004 — Carry-forward kelompok per semester

**Status: Final**

- Carry-forward Perintisan Bisnis selalu diproses per kelompok, bukan per mahasiswa.
- Sistem mengunci kelompok, seluruh anggota, assignment sumber, dan komposisi P1/P2 sebelum transisi dibuat.
- Seluruh anggota berpindah bersama dengan komposisi P1/P2 yang sama, atau seluruh perubahan assignment di-rollback.
- Jika satu anggota atau pembimbing tidak memenuhi syarat, tidak ada anggota yang diproses sebagian dan status kelompok menjadi `needs_review`.
- Aktivasi assignment terjadwal kelompok juga bersifat atomik.
- Setiap anggota wajib mengajukan izin semester ketiga sendiri dan P1 memutus setiap izin secara individual.
- Carry-forward semester ketiga baru dijalankan setelah seluruh anggota mempunyai izin `approved` yang terikat pada mahasiswa, pendaftaran, dan assignment asal masing-masing.
- Satu izin tidak boleh menjadi dasar assignment anggota lain; setiap izin mencatat assignment hasil milik pemohon yang sama.
- Jika satu izin ditolak atau satu anggota gagal divalidasi, tidak boleh ada assignment semester ketiga yang diproses sebagian dan kelompok masuk `needs_review`.

## 13. Penetapan dan histori pembimbing

### BR-PENETAPAN-001 — Dasar penetapan

**Status: Final**

Dasar penetapan adalah **Keputusan Final Sekretaris Prodi**. Data minimal yang dicatat:

- mahasiswa;
- pendaftaran;
- periode mulai;
- semester penjaluran ke-;
- P1 dan P2;
- tanggal mulai;
- tanggal selesai;
- status;
- sumber data;
- Sekretaris Prodi yang menetapkan;
- waktu keputusan.

### BR-PENETAPAN-002 — Penetapan aktif

**Status: Final**

- Satu mahasiswa maksimal mempunyai satu penetapan aktif.
- Satu penetapan wajib mempunyai P1.
- P2 opsional.
- P1 dan P2 harus berbeda.
- Setiap anggota penetapan mempunyai status dan masa aktif sendiri yang konsisten dengan penetapan induk.
- Kolom `dosen_pembimbing_skripsi_id` pada mahasiswa hanya merupakan cache P1 aktif untuk kompatibilitas.

### BR-PENETAPAN-003 — Pemisahan progres

**Status: Final**

- Pergantian pembimbing dalam siklus yang sama tidak mereset progres.
- Ulang dan alih membuat siklus progres baru.
- Data lama selalu dipertahankan sebagai histori.
- Bimbingan jalur lama tidak otomatis dihitung sebagai pemenuhan jalur baru.

### BR-PENETAPAN-004 — Histori per semester

**Status: Final**

Sistem harus dapat menjawab untuk setiap semester:

- jalur yang dijalani mahasiswa;
- semester penjaluran ke-;
- P1 dan P2;
- aktivitas/progres bimbingan;
- tanggal mulai dan selesai penetapan;
- alasan sistem ketika penetapan berakhir;
- status akhir semester.

## 14. Masa penjaluran dan izin lanjut

### BR-SEMESTER-001 — Masa normal

**Status: Final**

Masa penjaluran normal adalah dua semester:

- semester penjaluran ke-1;
- semester penjaluran ke-2.

Perpindahan semester membuat rekam penetapan semester baru agar histori dapat dibaca per semester, walaupun komposisi pembimbing tetap sama.
Assignment semester kedua tetap membuka akses bimbingan. Jendela izin semester ketiga dibuka 30 hari sebelum `tanggal_mulai` periode akademik berikutnya dan wajib divalidasi oleh server. Sebelum tanggal tersebut, izin belum dapat diajukan. Penguncian karena izin hanya berlaku ketika semester ketiga efektif tetapi izin approved tidak tersedia.

### BR-SEMESTER-002 — Semester ketiga

**Status: Final**

Semester ketiga tidak diberikan otomatis. Mahasiswa harus mengajukan izin lanjut. Jika disetujui, sistem membuat penetapan semester ke-3. Jika ditolak, mahasiswa diarahkan ke ulang/alih sesuai aturan akademik.

### BR-SEMESTER-003 — Pengakhiran penetapan

**Status: Final**

Penetapan diakhiri karena salah satu kondisi berikut:

- diganti dalam siklus yang sama;
- pamit disetujui;
- ulang jalur;
- alih jalur;
- masa penetapan berakhir;
- izin lanjut ditolak;
- mahasiswa selesai;
- proses dibatalkan.

Alasan berakhir dibuat otomatis oleh sistem; Sekretaris Prodi tidak diwajibkan menulis alasan bebas untuk kejadian yang sudah diketahui sistem.

## 15. Mata kuliah penjaluran dan data akademik

### BR-AKADEMIK-001 — Histori mata kuliah penjaluran

**Status: Final**

Setiap jalur mempunyai tepat satu mata kuliah penjaluran yang menjadi syarat kelulusan:

| Jalur | Mata kuliah penjaluran |
| --- | --- |
| Penelitian | Metodologi Penelitian |
| Pengabdian Masyarakat | Metode/Metodologi Pengabdian Masyarakat sesuai versi kurikulum |
| Perintisan Bisnis | Metode/Metodologi Perintisan Bisnis sesuai versi kurikulum |
| Magang | Manajemen Diri |

Nama dan kode aktual mengikuti kurikulum mahasiswa; perbedaan istilah ditangani melalui master, versi kurikulum, dan alias, bukan pencocokan teks bebas.

Sistem menyimpan histori status:

- belum mengambil;
- sedang mengambil;
- lulus;
- tidak lulus;
- mengulang.

Data menyimpan mata kuliah, jalur, siklus penjaluran, periode, attempt, nilai jika tersedia, sumber data, dan waktu perubahan. Status tidak boleh hanya disimpan sebagai alasan ulang berbentuk teks bebas.

Mata kuliah ini berlangsung sebagai attempt akademik satu semester. Status tidak lulus mewajibkan attempt mata kuliah yang sama pada semester akademik berikutnya, tetapi tidak otomatis membuat ulang jalur, mengakhiri pembimbing, atau mereset progres. Normalnya sidang belum dapat terjadi sebelum lulus; bila koreksi data setelah sidang menemukan ketidaksesuaian, hasil sidang tidak dihapus otomatis tetapi jadwal/kelulusan masuk hold dan wajib ditindaklanjuti secara teraudit.

### BR-AKADEMIK-002 — Sumber data

**Status: Sementara**

Sebelum integrasi akademik tersedia, data dapat dimasukkan Admin melalui import dengan preview, validasi, dan laporan error. Integrasi akademik dapat menggantikan input manual tanpa mengubah aturan bisnis.

### BR-AKADEMIK-003 — Data kosong dan kelengkapan dataset

**Status: Final**

Tidak adanya record akademik berarti data belum tersedia, bukan otomatis `belum_mengambil` atau `tidak_lulus`. Kesimpulan berbasis absensi hanya sah jika sumber mendeklarasikan cakupan dataset lengkap untuk mahasiswa, periode, dan jenis dataset terkait. Deklarasi aktif yang tumpang tindih atau bertentangan menghasilkan status data `conflicted`.

### BR-AKADEMIK-004 — Semester akademik kanonik

**Status: Final**

Data akademik menggunakan `PeriodeAkademik` dengan rentang tahun mulai–selesai dan semester. `PeriodePenjaluran` hanya merupakan jendela pendaftaran dan wajib mereferensikan semester akademik secara eksplisit. Tanggal jendela penjaluran tidak boleh digunakan sebagai tanggal mulai semester akademik.

### BR-AKADEMIK-005 — Versioning, koreksi, dan sumber efektif

**Status: Final untuk mekanisme; prioritas antarsumber menunggu keputusan**

Attempt, histori mata kuliah penjaluran, kewajiban, dan koreksi tidak diubah atau dihapus secara in-place. Koreksi Admin membuat versi baru, menyimpan before/after, alasan, aktor, waktu, serta hubungan ke versi sebelumnya. Import tidak boleh menimpa koreksi aktif secara diam-diam dan harus masuk antrean konflik.

### BR-AKADEMIK-006 — Snapshot dan kualitas data

**Status: Final**

Total SKS, mata kuliah wajib, dan status mata kuliah penjaluran untuk konsumsi workflow berasal dari snapshot akademik berversi. Status proses kalkulasi dipisahkan dari kualitas data. Snapshot `failed` atau `stale` tidak dianggap sebagai data lengkap.

### BR-AKADEMIK-007 — Dampak terhadap workflow dan kelulusan

**Status: Final**

Status mata kuliah penjaluran tidak memblokir pendaftaran penjaluran, penetapan pembimbing, bimbingan, atau izin lanjut. Status tersebut menjadi blocking gate pada verifikasi/pendaftaran sidang dan diperiksa kembali ketika mahasiswa akan dinyatakan siap yudisium/lulus. Mahasiswa hanya dapat memperoleh `DefenseVerificationFact`, dijadwalkan, mengikuti sidang, dan memenuhi clearance yudisium jika mata kuliah yang diwajibkan oleh jalur aktif terakhir berstatus `lulus` pada attempt efektif.

Evaluasi akademik tetap membedakan `evaluated_result` (`eligible`, `blocked`, atau `undetermined`) dari `effective_decision` (`allow`, `warn`, atau `block`). Enforcement berlaku pada konteks `defense_verification`, `defense_scheduling`, dan `graduation_clearance`; konteks lain hanya informasional.

### BR-AKADEMIK-008 — Alias, ekuivalensi, dan pengakuan kredit

**Status: Final untuk mekanisme**

Alias menunjuk satu mata kuliah kanonik yang sama, sedangkan ekuivalensi merupakan pengakuan substitusi berversi. Kredit transfer, konversi, MBKM, waived, atau exempted hanya dihitung setelah status pengakuannya sah. Mata kuliah dalam kelompok ekuivalensi tidak boleh menggandakan total SKS.

### BR-AKADEMIK-009 — Key-in oleh Admin dan informasi Gateway

**Status: Final**

Setelah keputusan final jalur, sistem membuat kewajiban mata kuliah penjaluran berstatus `active`. Admin melakukan key-in langsung pada sistem akademik/Gateway di luar SIMPS. SIMPS tidak membuat antrean, tugas, status, atau konfirmasi key-in; SIMPS hanya menerima hasil registrasi/nilai melalui import, integrasi, atau koreksi resmi yang dapat diaudit.

Instruksi untuk mengecek Gateway secara berkala sudah ditampilkan segera setelah mahasiswa berhasil mengirim form awal pendaftaran penjaluran. Finalisasi tidak mengirim pengingat yang sama untuk kedua kalinya. Selama hasil akademik belum masuk, SIMPS menampilkan `data_belum_tersedia` dan tidak menyimpulkan apakah key-in sudah dilakukan.

Pendaftaran baru, ulang, atau alih yang berhasil langsung dapat dibaca pada grid Data Akademik melalui projection pendaftaran dan mapping mata kuliah. Projection ini tidak membuat nilai atau attempt akademik. Nilai yang diimpor Admin menjadi satu sumber yang sama untuk grid Admin, menu Data Akademik mahasiswa, dan item sistem `Mata Kuliah Penjaluran` pada menu Dokumen/Persyaratan Sidang.

Admin memilih periode pendaftaran penjaluran yang dibuat Sekretaris Prodi, mengunduh template mahasiswa, dan hanya mengisi kolom `Nilai`. Nilai yang diterima adalah `A`, `B+`, `B`, `B-`, `B/C`, `C+`, `C`, `C-`, `C/D`, `D+`, `D`, `D-`, `D/F`, atau `F`. Batas kelulusan wajib berasal dari satu konfigurasi backend yang disahkan Prodi. Import dilakukan melalui preview dan menyimpan baris valid secara versioned; identitas, jalur, dan mata kuliah pada template tidak boleh dipercaya tanpa validasi ulang server.

### BR-AKADEMIK-010 — Ulang dan alih jalur

**Status: Final**

- Jika mata kuliah penjaluran tidak lulus, sistem membuat kebutuhan repeat untuk mata kuliah yang sama pada semester berikutnya setelah periode akademik tersedia.
- Ulang mata kuliah tidak sama dengan ulang penjaluran dan tidak membuat siklus/pembimbing baru.
- Ulang jalur pada jalur yang sama mempertahankan mata kuliah penjaluran yang sama; attempt baru hanya diperlukan jika belum lulus.
- Alih jalur mengakhiri kewajiban aktif lama dengan alasan `track_changed` dan membuat kewajiban baru sesuai jalur tujuan berstatus `active` bila belum dipenuhi melalui ekuivalensi resmi. Mahasiswa kembali diarahkan memeriksa Gateway untuk mata kuliah tujuan tanpa pembuatan tugas key-in di SIMPS.
- Attempt dan nilai jalur lama tetap menjadi histori serta tidak dihapus. Kelulusan mata kuliah jalur lama tidak otomatis memenuhi mata kuliah jalur tujuan kecuali terdapat ekuivalensi kurikulum resmi.

## 16. Akun dan password

### BR-AKUN-001 — Password awal

**Status: Final**

Akun tersedia setelah dibuat atau di-import dengan password awal institusional berikut:

- Dosen dan Admin menggunakan `12345678`;
- Mahasiswa menggunakan NIM miliknya sendiri.

Password awal wajib di-hash melalui credential service, tidak boleh disimpan sebagai plaintext, dan tidak boleh dikembalikan pada response, report, log, maupun browser storage. Akun dibuat dengan `credential_state = default` dan `is_default_password = true`. Ketentuan `12345678` untuk Admin berlaku pada provisioning akun Admin baru dan rekonsiliasi per akun Admin lama yang benar-benar masih berstatus `default`; akun Admin `active` tidak boleh diubah otomatis. Pemulihan Admin yang sudah aktif tetap mengikuti recovery offline privileged dan tidak tersedia melalui menu reset akun biasa. Sekretaris Prodi tidak menggunakan password awal bersama dan mengikuti provisioning/recovery khusus akun privileged.

Nilai password awal hanya boleh didefinisikan pada konfigurasi/policy kredensial terpusat dan tidak boleh diduplikasi sebagai literal pada controller, model hook, seeder production, atau frontend.

### BR-AKUN-002 — Wajib ganti password

**Status: Final**

Pengguna dengan `credential_state` `default` atau `temporary`:

- dapat login;
- hanya dapat mengakses ganti password dan logout;
- tidak dapat menjalankan aktivitas aplikasi sampai password berhasil diganti.

Pembatasan harus diterapkan pada frontend dan middleware backend.

### BR-AKUN-003 — Reset password

**Status: Final**

Sistem menyediakan dua jalur reset untuk akun non-privileged:

1. self-service lupa password melalui tautan sekali pakai ke kanal terverifikasi; dan
2. reset oleh Admin ke password awal institusional apabila email akun dummy/tidak dapat diakses.

Response public forgot-password tetap generik. Token self-service disimpan sebagai hash, mempunyai masa berlaku, dikonsumsi secara atomik, dan mencabut seluruh sesi lama. Reset oleh Admin wajib meminta alasan, mencabut seluruh sesi dan token aktif, menaikkan `credential_version`, mengubah state menjadi `default`, mencatat audit, dan tidak menampilkan hash. Setelah reset, Dosen login menggunakan `12345678`, sedangkan Mahasiswa login menggunakan NIM, kemudian wajib mengganti password sebelum mengakses aktivitas bisnis.

### BR-AKUN-004 â€” Sesi dan pencabutan

**Status: Final**

Setiap access token wajib menunjuk sesi server-side dan versi kredensial akun. Akun, sesi, expiry, dan versi kredensial diperiksa pada setiap request. Logout mencabut sesi berjalan; logout-all, ganti password, reset password, dan reset oleh Admin mencabut sesi yang relevan.

### BR-AKUN-005 â€” Kanal pemulihan dan kewenangan Admin

**Status: Final**

Tautan pemulihan hanya boleh dikirim ke email/kanal yang telah diverifikasi atau berasal dari trusted source yang keputusan serta waktu verifikasinya tercatat. Admin dapat menerbitkan tautan reset atau melakukan reset ke password awal institusional hanya untuk Mahasiswa dan Dosen, wajib memberi alasan, dan tidak pernah menerima hash maupun token. Reset Admin dan Sekretaris Prodi tidak tersedia melalui flow ini.

### BR-AKUN-006 â€” Kebijakan password

**Status: Final**

Password baru minimal 10 karakter dan maksimal 72 byte UTF-8 sebelum bcrypt. Password tidak di-trim, dipotong, atau dinormalisasi diam-diam; password yang sama dengan password aktif, terlalu umum, atau sama persis dengan identifier akun ditolak. Identifier akun boleh menjadi bagian dari password apabila terdapat pembeda tambahan, misalnya nama pengguna atau karakter lain.

Ketentuan minimum 10 karakter berlaku untuk password baru yang dipilih pengguna, bukan untuk credential awal institusional. Saat forced change, password baru Dosen dan Admin tidak boleh sama dengan `12345678`; password baru Mahasiswa tidak boleh sama dengan NIM atau identifier akun lainnya.

## 17. Bimbingan

### BR-BIMBINGAN-001 — Tujuan bimbingan

**Status: Final**

Mahasiswa memilih P1 atau P2 sebagai tujuan permohonan. Hanya dosen tujuan dengan penetapan aktif yang dapat memproses permohonan dan resume.

### BR-BIMBINGAN-002 — Keterkaitan histori

**Status: Final**

Setiap bimbingan harus dapat ditelusuri ke:

- penetapan pembimbing;
- periode;
- semester penjaluran ke-;
- jalur;
- siklus baru/ulang/alih.

### BR-BIMBINGAN-003 — Reviewer efektif dan pergantian

**Status: Final**

- Target P1/P2 saat permohonan dibuat bersifat historis dan tidak boleh ditimpa.
- Hak mutasi berasal dari anggota penetapan yang menjadi reviewer efektif.
- Pergantian pembimbing atau semester memindahkan resume yang belum selesai ke pengganti dengan urutan P1/P2 yang sama dan mencatat transfer append-only.
- Jika pengganti dengan peran yang sama tidak tersedia, sistem memakai P1 aktif pada assignment pengganti sebagai fallback deterministik dan mencatat reason `cross_role_system_fallback`. Jika P1 aktif belum tersedia, proses menjadi hold dan dilanjutkan otomatis setelah assignment lengkap; tidak ada pemilihan reviewer manual dari halaman tata kelola.
- Setelah transfer efektif, dosen lama hanya mempunyai akses histori sesuai kewenangan dan tidak dapat memproses permohonan atau resume.

### BR-BIMBINGAN-004 — Validasi sesi dan versi resume

**Status: Final**

- Setiap submit atau revisi resume menghasilkan versi baru; versi dan keputusan lama tidak dihapus atau ditimpa.
- Sesi dihitung hanya jika berada pada siklus yang dievaluasi, permohonan diterima, sesi terjadi, resume disetujui reviewer yang sah, dan data tidak diinvalidasi atau ambigu.
- Untuk implementasi awal, persetujuan resume menjadi bukti sesi terjadi (`approved_resume`).
- Setiap hasil dihitung/tidak dihitung menyimpan policy version, evaluator version, waktu evaluasi, dan reason code.

### BR-BIMBINGAN-005 — Kebijakan minimum

**Status: Final untuk konfigurasi; scope enforcement menunggu keputusan akademik**

- Minimum bimbingan disimpan sebagai policy berversi dengan scope program studi, program kuliah, jalur, dan periode akademik.
- Nilai delapan dimigrasikan sebagai policy legacy awal, bukan konstanta controller.
- Policy merupakan konfigurasi internal yang ditetapkan melalui migration/release teruji, bukan dikelola Sekretaris Prodi melalui halaman khusus.
- Sistem menampilkan progres per semester dan kumulatif per siklus.
- Pilihan enforcement `cycle` atau `semester` dan approval readiness P1 atau seluruh pembimbing aktif harus disahkan sebelum diaktifkan pada production.

### BR-BIMBINGAN-006 — Idempotensi, audit, dan readiness

**Status: Final untuk mekanisme; readiness berjalan shadow sampai scope approval disahkan**

- Seluruh mutasi bimbingan memakai `Idempotency-Key`, fingerprint payload, dan optimistic precondition version.
- Retry identik mengembalikan hasil pertama; key sama dengan payload berbeda ditolak.
- Mutation kritis menghasilkan event dan notifikasi atomik tanpa menyalin isi resume atau catatan sensitif ke notifikasi.
- Tahap 7 hanya menerbitkan fakta kesiapan bimbingan berversi/checksum. Fakta tersebut tidak sama dengan verifikasi pendadaran dan tidak langsung menjadwalkan sidang.

### BR-BIMBINGAN-007 — Tanpa halaman tata kelola bimbingan

**Status: Final**

- Menu dan halaman `Tata Kelola Bimbingan` tidak digunakan.
- Mahasiswa menjalankan permohonan dan resume pada halaman bimbingan.
- Dosen memproses tugas pada `Review Bimbingan`.
- Sekretaris Prodi melihat progres melalui `Mahasiswa Bimbingan` dan histori melalui `Riwayat Bimbingan`.
- Pergantian reviewer diselesaikan otomatis dari assignment aktif. Sekretaris Prodi memperbaiki assignment melalui flow pergantian pembimbing yang sudah ada, bukan memilih reviewer pada halaman terpisah.
- Approval resume tidak dihapus manual. Koreksi membuat versi resume/keputusan baru oleh reviewer yang berwenang; invalidasi teknis hanya melalui service ter-audit ketika sumber menjadi tidak sah.

## 18. Persyaratan pendadaran

### BR-SIDANG-001 — Persyaratan minimum

**Status: Final untuk kebutuhan data; nilai batas dapat dikonfigurasi**

Mahasiswa hanya dapat dijadwalkan jika seluruh persyaratan wajib valid, meliputi:

- jumlah minimum bimbingan tervalidasi;
- persetujuan pembimbing;
- transkrip;
- total SKS;
- seluruh mata kuliah wajib lulus;
- mata kuliah penjaluran yang sesuai dengan jalur aktif terakhir telah lulus;
- sertifikat CEPT;
- skor CEPT minimal, dengan nilai awal acuan 420;
- CEPT belum kedaluwarsa, dengan acuan masa berlaku dua tahun;
- draf/laporan tugas akhir;
- capture atau logbook bimbingan;
- publikasi ilmiah jika diwajibkan;
- LOA jika diwajibkan;
- pemeriksaan akademik khusus pendadaran yang telah disahkan.

Mata kuliah penjaluran merupakan blocker pendadaran/sidang dan diperiksa kembali pada yudisium sesuai BR-AKADEMIK-007. Status selain `lulus`, termasuk data `undetermined`, tidak boleh menghasilkan izin sidang.

Batas skor dan masa berlaku harus disimpan sebagai konfigurasi agar dapat diubah tanpa mengubah kode.

### BR-SIDANG-002 — Verifikasi

**Status: Final**

- Setiap item menyimpan status, pemeriksa, waktu, dan catatan.
- Mahasiswa yang belum lengkap berstatus hold dan tidak dijadwalkan.
- Membatalkan verifikasi membutuhkan konfirmasi.
- Sistem harus menampilkan kekurangan setiap mahasiswa.

## 19. Master dan ketersediaan sidang

### BR-JADWAL-001 — Komposisi dosen sidang

**Status: Final**

Setiap sidang terdiri dari tepat tiga dosen:

- satu pembimbing;
- Penguji 1;
- Penguji 2.

Pembimbing wajib hadir dan melekat pada mahasiswa. Jika pembimbing berhalangan, sidang dijadwal ulang, bukan mengganti pembimbing untuk sidang tersebut.

### BR-JADWAL-002 — Master bidang dan kelas penguji

**Status: Final untuk kebutuhan data; terminologi kelas perlu divalidasi kembali**

Dosen memiliki bidang ilmu dan kelas penguji. Aturan awal:

- kelas 2 atau 3 harus dipasangkan dengan kelas 1;
- pasangan penguji mempertimbangkan bidang mahasiswa;
- sistem mencegah kombinasi penguji yang tidak sesuai;
- keputusan auto-assign menampilkan alasan rekomendasi.

Karakteristik penguji tidak disimpan ulang pada setiap slot ketersediaan.

### BR-JADWAL-003 — Master ruangan

**Status: Final**

Ruangan disimpan sebagai master yang dapat digunakan kembali. Periode sidang hanya memilih ruangan yang tersedia. Jadwal mereferensikan master ruangan agar histori tetap konsisten.

### BR-JADWAL-004 — Periode dan slot sidang

**Status: Final**

Sekretaris Prodi menentukan:

- rentang tanggal;
- tanggal pengecualian;
- sesi dan durasi;
- waktu istirahat;
- ruangan yang tersedia.

Acuan awal durasi sidang adalah 90 menit. Aturan khusus hari Jumat dan sesi lain disimpan sebagai konfigurasi periode, bukan ditanam permanen dalam kode.

### BR-JADWAL-005 — Ketersediaan dosen

**Status: Final**

Dosen mengisi ketersediaan menguji pada slot yang telah dibuka Sekretaris Prodi. Sistem menandai dosen yang belum mengisi. Penjadwalan mempertimbangkan ketersediaan pembimbing dan penguji.

### BR-JADWAL-006 — Larangan bentrok

**Status: Final**

Sistem menolak kondisi berikut:

- dosen berada pada dua sidang dalam waktu yang sama;
- mahasiswa mempunyai dua jadwal dalam waktu yang sama;
- ruangan digunakan dua sidang dalam waktu yang sama;
- pembimbing tidak tersedia;
- jumlah dosen bukan tiga orang;
- pembimbing dipilih sebagai salah satu dari dua penguji mahasiswa yang sama.

## 20. Penggantian penguji dan reschedule

### BR-RESCHEDULE-001 — Penggantian penguji

**Status: Final**

Penguji yang berhalangan dapat mengajukan pergantian dan mengusulkan pengganti. Sekretaris Prodi memutuskan perubahan. Sistem menyimpan penguji lama, penguji baru, alasan, pengusul, pemutus, waktu, dan pemberitahuan.

### BR-RESCHEDULE-002 — Reschedule

**Status: Final**

Jika pembimbing berhalangan, jadwal dipindahkan. Jadwal lama tidak ditimpa atau dihapus. Sistem menyimpan hubungan jadwal lama dan jadwal baru serta memberi tahu seluruh pihak.

## 21. Nilai, revisi, dan kelulusan

### BR-NILAI-001 — Penilaian

**Status: Final untuk kebutuhan data; bobot nilai perlu dikonfirmasi**

Sistem menyimpan:

- nilai dari setiap penilai;
- komponen dan bobot;
- nilai akhir;
- status lulus/tidak lulus;
- catatan revisi;
- batas waktu revisi;
- tanggal kelulusan;
- berita acara.

Nilai yang sudah dikunci hanya dapat diubah melalui mekanisme buka kunci dengan audit.

### BR-NILAI-002 — Revisi dan penyelesaian

**Status: Final**

Alur akhir:

1. Nilai dikunci.
2. Mahasiswa menerima hasil dan revisi.
3. Mahasiswa menyelesaikan revisi.
4. Pembimbing/otoritas memvalidasi revisi.
5. Persyaratan akhir diperiksa, termasuk kelulusan mata kuliah penjaluran yang sesuai dengan jalur aktif terakhir.
6. Mahasiswa berstatus siap yudisium/lulus.
7. Penetapan pembimbing diakhiri.

## 22. Pemberitahuan

### BR-NOTIF-001 — Kanal pemberitahuan

**Status: Final**

Pemberitahuan utama tersedia melalui menu universal dan indikator lonceng. Menu menampilkan daftar tanpa tabel kaku, status belum dibaca, dan aksi melihat detail.

### BR-NOTIF-002 — Isi pemberitahuan

**Status: Final**

Judul ditentukan sistem. Setiap pemberitahuan menyimpan penerima, ringkasan, jenis, referensi objek, status baca, dan waktu. Aksi membaca membuka detail objek terkait.

Pemberitahuan minimal dibuat untuk:

- pamit;
- ulang/alih;
- review pengampu;
- keputusan final;
- permintaan, konfirmasi, kegagalan, dan pengulangan key-in mata kuliah penjaluran;
- pengingat Gateway pada konfirmasi keberhasilan submit form awal serta pembaruan ketika status berubah;
- penetapan/pergantian pembimbing;
- bimbingan;
- izin lanjut;
- verifikasi sidang;
- jadwal dan reschedule;
- perubahan penguji;
- nilai, revisi, dan kelulusan.

## 23. Audit, histori, dan transaksi

### BR-AUDIT-001 — Tidak menghapus histori

**Status: Final**

Perubahan status, jalur, kelompok, pembimbing, jadwal, penguji, dan nilai tidak boleh menghapus histori yang sudah sah.

### BR-AUDIT-002 — Aktor dan waktu

**Status: Final**

Setiap keputusan penting menyimpan aktor, role, waktu, objek, serta data sebelum dan sesudah jika relevan.

### BR-AUDIT-003 — Transaksi

**Status: Final**

Operasi yang mengubah beberapa entitas harus transaksional, khususnya:

- finalisasi kelompok Perintisan;
- aktivasi/pergantian pembimbing;
- pergantian semester;
- penjadwalan;
- reschedule;
- penguncian nilai.

Kegagalan satu langkah membatalkan seluruh perubahan terkait.

### BR-AUDIT-004 — Idempotensi

**Status: Final**

Klik ganda atau pengiriman request ulang tidak boleh membuat pendaftaran, penetapan, pemberitahuan utama, jadwal, atau hasil nilai ganda.

## 24. Aturan yang masih menunggu konfirmasi

Hal berikut tidak boleh diasumsikan sebagai keputusan final:

1. Review topik Penelitian berurutan atau paralel.
2. P2 wajib atau opsional pada setiap jalur.
3. Jumlah anggota kelompok Perintisan jika aturan akademik berubah.
4. Istilah dan aturan resmi kelas penguji 1/2/3.
5. Bobot nilai pembimbing dan penguji.
6. Persyaratan publikasi/LOA untuk setiap jalur.
7. Batas maksimal izin lanjut setelah semester ketiga.
8. Apakah persetujuan siap sidang memerlukan P1 saja atau P1 dan P2.

Keputusan baru harus memperbarui dokumen ini sebelum implementasi diubah.

## 25. Definition of done sistem

Sistem dianggap selesai sesuai scope apabila:

- seluruh aturan berstatus Final mempunyai implementasi dan test;
- jalur baru, ulang, dan alih dapat diselesaikan end-to-end untuk Penelitian, Magang, dan Perintisan Bisnis;
- ketiga jalur aktif dapat dilanjutkan dari keputusan final, penetapan pembimbing, bimbingan, persyaratan sidang, penjadwalan, penilaian, revisi, sampai yudisium dan kelulusan;
- Pengabdian tetap aman dan data yang sudah ada tidak rusak, tetapi penyelesaian flow Pengabdian tidak menjadi syarat release selama berstatus hold;
- histori mahasiswa dapat dibaca per periode dan semester;
- tidak ada aktivasi pembimbing yang bergantung pada surat tugas;
- password awal hanya dapat dipakai untuk login restricted dan tidak dapat dipakai untuk aktivitas bisnis sebelum forced change selesai;
- mahasiswa yang belum memenuhi syarat tidak dapat dijadwalkan;
- setiap sidang memiliki tepat tiga dosen tanpa bentrok;
- perubahan penguji dan reschedule mempunyai histori;
- nilai, revisi, dan kelulusan tercatat;
- mata kuliah penjaluran mengikuti jalur aktif terakhir; SIMPS membaca hasil akademik resmi tanpa mengelola key-in, hasil tidak lulus menghasilkan repeat semester berikutnya, serta memblokir sidang dan clearance yudisium/kelulusan;
- role dan otorisasi diuji;
- operasi kritis transaksional dan idempotent;
- BPMN, dokumentasi, UI, backend, dan test menyatakan aturan yang sama;
- seluruh skenario UAT disetujui pengguna terkait.

Release tiga jalur aktif belum dapat dinyatakan selesai sebelum aturan Penelitian yang masih menunggu konfirmasi diputuskan, didokumentasikan, diimplementasikan, dan diuji. Pengabdian kembali menjadi syarat penyelesaian hanya setelah status hold dicabut.

## 26. Riwayat perubahan

| Versi | Tanggal | Perubahan |
| --- | --- | --- |
| 1.3 | 2026-08-05 | Halaman Tata Kelola Bimbingan dihapus; policy menjadi konfigurasi internal, reviewer pengganti di-resolve otomatis, dan koreksi approval memakai versi baru. |
| 1.2 | 2026-08-05 | Mata kuliah penjaluran ditetapkan sebagai hard gate sidang dan diperiksa kembali saat yudisium; pengingat Gateway ditempatkan setelah submit form awal dan tidak diduplikasi saat finalisasi. |
| 1.1 | 2026-07-28 | Scope aktif diubah menjadi Penelitian, Magang, dan Perintisan Bisnis sampai kelulusan/yudisium; Pengabdian Masyarakat berstatus hold. |
| 1.0 | 2026-07-27 | Dokumen awal berdasarkan catatan bimbingan pertama dan keputusan pengembangan tanpa surat tugas; Penelitian ditunda. |
