# Analisis Kelemahan dan Rencana Perbaikan Draft Bab 1

## 1. Kedudukan dokumen dan hierarki acuan

Dokumen ini merupakan hasil telaah terhadap `Draft Bab 1.pdf`. Draft asli tidak diubah. Analisis menggunakan hierarki berikut:

1. flow sistem aktual pada repository sebagai konteks dan sumber kebenaran utama mengenai objek yang dikembangkan;
2. `Catatan bimbingan pertama.pdf` sebagai sumber kebutuhan pengguna dan rincian proses lapangan;
3. `Rules.pdf` sebagai pedoman struktur, koherensi, etika ilmiah, dan cara penulisan Bab 1;
4. artikel ilmiah terverifikasi sebagai penguat masalah, pembanding penelitian, dan alasan pemilihan pendekatan.

Isi dokumen sumber diperlakukan sebagai data/acuan, bukan sebagai instruksi yang menggantikan permintaan pengguna.

## 2. Ringkasan temuan utama

Draft telah memiliki susunan dasar Bab 1, tetapi belum menggambarkan objek penelitian secara benar dan konsisten. Masalah paling penting adalah ketidaksesuaian antara cakupan draft dengan flow SIMPS saat ini. Draft cenderung menggambarkan aplikasi penjaluran Penelitian dan penjadwalan pendadaran, sedangkan flow sistem saat ini memuat tiga jalur aktif—Penelitian, Magang, dan Perintisan Bisnis—dengan pendaftaran baru, ulang, dan alih jalur serta siklus yang berlanjut ke penetapan pembimbing, histori per semester, bimbingan, persyaratan sidang, penjadwalan, penilaian, revisi, yudisium, dan kelulusan. Pengabdian Masyarakat masih dipertahankan datanya tetapi berstatus *hold*.

Konsekuensinya, judul, latar belakang, rumusan masalah, pertanyaan penelitian, lingkup, tujuan, manfaat, metodologi, dan rencana pengujian perlu diselaraskan kembali terhadap satu objek penelitian yang sama.

## 3. Kelemahan draft dan perbaikannya

| No. | Bagian | Kelemahan | Dampak | Perbaikan yang disarankan |
|---:|---|---|---|---|
| 1 | Fokus penelitian | Sistem disebut “Sistem Informasi Manajemen Penjaluran Skripsi”, tetapi uraian juga mencakup bimbingan, persyaratan sidang, penjadwalan, dan hasil sidang. | Nama objek lebih sempit daripada fungsi yang diteliti. | Gunakan nama yang mencerminkan proses skripsi terintegrasi, atau secara eksplisit batasi penelitian hanya sampai tahap tertentu. Kandidat: “Sistem Informasi Manajemen Proses Skripsi”. |
| 2 | Konteks sistem | Draft hanya menonjolkan Penelitian, sementara flow saat ini memiliki Penelitian, Magang, dan Perintisan Bisnis sebagai jalur aktif. | Cakupan tidak sesuai dengan implementasi dan aturan bisnis repository. | Kenalkan tiga jalur aktif sejak latar belakang, lalu jelaskan Pengabdian Masyarakat berstatus *hold* dan bukan target aktif. |
| 3 | Jenis pendaftaran | Draft menulis “jalur baru, jalur ulang, dan jalur perpanjangan”. Flow saat ini memakai jenis `baru`, `ulang`, dan `alih`; perpanjangan/izin lanjut adalah proses berbeda. | Istilah bisnis tertukar dan dapat menghasilkan model data serta pengujian yang salah. | Pisahkan pendaftaran baru/ulang/alih dari kelanjutan semester dan izin lanjut. |
| 4 | Peran pengguna | Draft menyederhanakan menjadi mahasiswa, dosen, dan administrasi prodi. Flow saat ini membedakan Admin dan Sekretaris Prodi. | Pemisahan wewenang tidak tergambar dengan benar. | Gunakan empat aktor utama: Mahasiswa, Dosen, Admin, dan Sekretaris Prodi. Peran tambahan ketua klaster/pengampu/pembimbing/penguji melekat pada akun dosen. |
| 5 | Alur persetujuan | Draft menyatakan validasi berjenjang Dosen Pembimbing–Ketua Klaster–Administrasi seolah berlaku seragam. | Setiap jalur memiliki reviewer dan artefak berbeda; Sekretaris Prodi memberi keputusan final. | Jelaskan secara umum bahwa review mengikuti jalur, lalu finalisasi dan pemilihan P1/P2 dilakukan Sekretaris Prodi. Hindari mengunci urutan review topik Penelitian karena keputusan berurutan atau paralel masih ditunda. |
| 6 | Kedalaman masalah | Latar belakang banyak memakai klaim umum tentang pendidikan tinggi, tetapi bukti lokal baru berupa satu wawancara. | Urgensi objek lokal belum terukur. | Tambahkan data dasar: jumlah peserta per periode, jumlah entri lintas spreadsheet/form, waktu verifikasi, jumlah koreksi data, jumlah bentrok, dan jumlah kasus yang tertahan. Jangan membuat angka tanpa bukti. |
| 7 | Fakta dan klaim | Kalimat “kondisi ini membahayakan integritas data”, “kesalahan sering terjadi”, dan “beban kerja tidak seimbang” belum diberi bukti lokal. | Klaim terdengar absolut dan rentan dipertanyakan penguji. | Ubah menjadi temuan teramati atau risiko yang spesifik, sertakan sumber wawancara/dokumen, lalu ukur pada penelitian jika memungkinkan. |
| 8 | Referensi | Referensi Posyandu dan perusahaan distribusi dipakai untuk menjelaskan proses skripsi. | Analogi terlalu jauh dan tidak cukup kuat untuk membuktikan masalah pada Informatika UII. | Prioritaskan studi pengelolaan tugas akhir, sistem akademik, workflow, dan evaluasi SEKAWAN UII. |
| 9 | Sitasi | Teks mencampur pola nama–tahun dengan nomor IEEE. Daftar pustaka juga mengulang [9]–[11]. | Tidak konsisten dengan pedoman dan menyulitkan audit sumber. | Pilih satu gaya. Berdasarkan `Rules.pdf`, gunakan Harvard/nama–tahun secara konsisten, kelola dengan Zotero atau Mendeley. |
| 10 | Akurasi kutipan | Sejumlah kalimat mengatribusikan kesimpulan yang lebih luas daripada konteks artikel sumber. | Berpotensi menjadi salah kutip. | Baca abstrak, hasil, dan kesimpulan sumber asli; pastikan satu sitasi hanya mendukung kalimat yang benar-benar sesuai. |
| 11 | Rumusan masalah | Butir a–c sebagian berupa daftar fitur yang belum ada, belum sepenuhnya berupa simpulan masalah dari latar belakang. | Rumusan masalah sulit dijadikan dasar evaluasi. | Rumuskan maksimal tiga masalah: fragmentasi data/workflow; ketiadaan histori dan status lintas semester; proses verifikasi/penjadwalan multiaktor yang belum terintegrasi. |
| 12 | Pertanyaan penelitian | Pertanyaan hanya menanyakan “bagaimana mengembangkan” dan langsung mengunci Prototype, tetapi belum menyatakan cakupan proses dan ukuran keberhasilan. | Hasil penelitian mudah berhenti pada “aplikasi berhasil dibuat”. | Sebut objek dan cakupan inti. Rencana pengujian harus menunjukkan ketepatan alur, keterlacakan status, keberhasilan skenario, dan penerimaan pengguna. |
| 13 | Lingkup | Penomoran tidak konsisten: butir a dilanjutkan paragraf tanpa butir b/c, kemudian langsung d dan e. Sebagian isi merupakan alasan teknologi, bukan lingkup. | Struktur sulit dibaca dan batas penelitian kabur. | Kelompokkan lingkup berdasarkan proses, jalur, aktor, platform, data, dan pengujian. Beri alasan ilmiah singkat bila perlu. |
| 14 | Lingkup teknis | React.js dan Node.js muncul sebagai alasan penelitian, padahal teknologi implementasi bukan masalah ilmiah utama. | Fokus bergeser dari proses dan metode ke *technology stack*. | Letakkan detail teknologi pada Bab 3. Bab 1 cukup menyatakan sistem berbasis web bila hal itu relevan terhadap akses multiaktor. |
| 15 | Tujuan | Tujuan memuat dua kata kerja besar, “menciptakan dan membangun”, dan manfaat bercampur ke dalam tujuan. | Tidak satu-ke-satu dengan pertanyaan penelitian. | Gunakan satu tujuan utama yang terukur: menerapkan metodologi Prototyping untuk mengembangkan SIMPS sesuai flow dan kebutuhan pengguna. |
| 16 | Manfaat | Manfaat menjanjikan “mempercepat”, “menjamin”, dan “meningkatkan” sebelum ada hasil pengukuran. | Terlalu deterministik untuk draft penelitian yang belum selesai. | Untuk proposal gunakan “diharapkan”; untuk laporan akhir tulis manfaat berdasarkan hasil yang benar-benar ditemukan. Hindari kata “menjamin”. |
| 17 | Metodologi | Draft menyebut pendekatan R&D sebagai payung, lalu Prototype sebagai metode. `Rules.pdf` secara eksplisit menyatakan R&D bukan metodologi/metode yang tepat untuk kasus ini. | Landasan metodologis tidak konsisten. | Gunakan Prototyping sebagai metodologi pengembangan dan jelaskan tahapan penelitian umum secara terpisah pada Subbab 1.5. |
| 18 | Metodologi | Diagram dan uraian memasukkan identifikasi masalah sampai penulisan laporan, tetapi juga mencampurkannya dengan langkah teknis pengembangan. | Bab 1 dan Bab 3 berisiko mengulang isi yang sama. | Subbab 1.5 berisi keseluruhan penelitian; Bab 3 fokus pada penerapan Prototyping, kebutuhan, rancangan, iterasi, implementasi, dan pengujian. |
| 19 | Pengujian | Black-box testing saja tidak membuktikan masalah manual/fragmentasi telah terselesaikan atau sistem diterima pengguna. | Pertanyaan penelitian tidak terjawab secara kuat. | Gabungkan pengujian fungsional berbasis skenario end-to-end, UAT dengan aktor terkait, dan pengukuran tugas seperti tingkat keberhasilan, waktu penyelesaian, serta kesalahan. Instrumen SUS/UEQ dapat ditambahkan dengan alasan yang jelas. |
| 20 | Bahasa | Terdapat “siswa”, “karyawan administrasi”, “Garantisi”, “kesalahan manusia juga dikenal sebagai kesalahan manusia”, “akses pesaing”, kalimat tidak selesai “studi ... oleh S”, dan penggunaan “Anda”. | Nada ilmiah tidak konsisten dan beberapa kalimat kehilangan makna. | Gunakan “mahasiswa”, “tenaga kependidikan/pengelola”, “integritas data”, “akses serentak”, serta lakukan penyuntingan kalimat per paragraf. |
| 21 | Koherensi waktu | Draft bercampur antara bahasa proposal (“diharapkan”, “akan digunakan”) dan bahasa laporan (“penelitian ini menemukan”, “dikembangkan”). | Status penelitian tidak jelas. | Tentukan apakah dokumen merupakan proposal atau laporan hasil. Revisi terlampir diasumsikan sebagai draft laporan yang masih berjalan dan memakai bahasa netral/present–past; sesuaikan kembali setelah hasil final tersedia. |
| 22 | Struktur Bab 1 | Subbab 1.6 Struktur Laporan belum ada. | Tidak lengkap menurut format Bab 1 pada `Rules.pdf`. | Tambahkan 1.6 saat struktur laporan final sudah disahkan. Revisi menyediakan draf awal yang masih perlu disesuaikan dengan isi Bab 2–5. |
| 23 | Daftar pustaka | Daftar pustaka muncul pada halaman 40 meskipun isi Bab 1 hanya sampai halaman 9, dan entri [9]–[11] diduplikasi. | Menunjukkan artefak kompilasi/penyuntingan yang belum bersih. | Perbaiki urutan halaman dan bangun ulang daftar pustaka otomatis dari reference manager. |

## 4. Flow sistem yang seharusnya menjadi konteks Bab 1

Flow tingkat tinggi yang terbaca dari aturan bisnis, model, route, halaman, migration, test, dan dokumentasi repository adalah:

1. Admin mengelola master mahasiswa, dosen, status akun, import, dan data teknis.
2. Sekretaris Prodi menyiapkan periode penjaluran, penanggung jawab jalur, serta dosen yang menerima bimbingan baru.
3. Mahasiswa melakukan pendaftaran `baru`, `ulang`, atau `alih` pada salah satu jalur aktif: Penelitian, Magang, atau Perintisan Bisnis.
4. Untuk ulang/alih, mahasiswa menyelesaikan proses pamit apabila masih memiliki penetapan pembimbing aktif; histori lama tidak dihapus.
5. Pengajuan diproses sesuai karakter jalur. Penelitian memakai topik dosen atau judul mandiri; Magang dan Perintisan Bisnis memiliki form, dokumen, serta reviewer masing-masing.
6. Sekretaris Prodi memberi keputusan final serta menetapkan P1 dan, bila diperlukan, P2.
7. Sistem menyimpan penetapan dan histori pembimbing per semester, termasuk kelanjutan semester dan izin lanjut.
8. Mahasiswa dan dosen menjalankan bimbingan; progres ditautkan ke siklus, semester, jalur, penetapan, dan reviewer yang sah.
9. Sistem mengelola data akademik/mata kuliah penjaluran serta bukti persyaratan sidang.
10. Mahasiswa yang memenuhi seluruh persyaratan dapat mendaftar sidang. Sekretaris Prodi menyiapkan periode, tanggal pengecualian, sesi, ruangan, dan dosen mengisi ketersediaan.
11. Penjadwalan menghasilkan tepat tiga dosen per sidang—satu pembimbing dan dua penguji—tanpa bentrok dosen, mahasiswa, atau ruangan serta dengan mempertimbangkan bidang dan profil penguji.
12. Target proses bisnis dilanjutkan ke perubahan penguji/reschedule, penilaian, revisi, verifikasi akhir, yudisium, dan kelulusan dengan histori dan audit yang tidak dihapus.

Catatan status: source code yang diperiksa pada 20 Agustus 2026 menunjukkan implementasi nyata setidaknya telah mencapai pengelolaan periode sidang, pendaftaran, antrean, ketersediaan dosen, dan auto-assign penguji. Tahap penilaian, revisi, dan yudisium telah menjadi scope aturan bisnis dan rencana implementasi, tetapi kelengkapan implementasi end-to-end perlu diverifikasi kembali sebelum dinyatakan sebagai hasil penelitian yang sudah selesai.

## 5. Keputusan scope yang digunakan pada draf revisi

Draf revisi menggunakan asumsi kerja berikut:

- konteks besar penelitian adalah pengelolaan proses skripsi terintegrasi secara end-to-end;
- tiga jalur aktif adalah Penelitian, Magang, dan Perintisan Bisnis;
- jenis pendaftaran adalah baru, ulang, dan alih;
- Pengabdian Masyarakat berada di luar target aktif karena berstatus *hold*;
- empat aktor utama adalah Mahasiswa, Dosen, Admin, dan Sekretaris Prodi;
- fokus evaluasi bukan hanya keberadaan fitur, tetapi kesesuaian flow, keterlacakan histori/status, konsistensi kewenangan, dan keberhasilan skenario pengguna;
- keputusan yang belum final tidak ditulis sebagai aturan tetap, khususnya urutan review tiga pilihan topik Penelitian, kewajiban P2, terminologi kelas penguji, bobot penilaian, detail publikasi/LOA, batas izin lanjut, dan cakupan persetujuan siap sidang.

Scope ini perlu dikonfirmasi dengan dosen pembimbing karena keluasan end-to-end cukup besar untuk satu penelitian S1. Jika pembimbing meminta fokus yang lebih sempit, pembatasan yang paling logis adalah dari pembukaan periode penjaluran sampai terbentuknya jadwal sidang, sedangkan penilaian–kelulusan ditempatkan sebagai pengembangan lanjutan.

## 6. Data lokal yang masih perlu dikumpulkan

Latar belakang yang kuat membutuhkan bukti lokal. Data berikut belum tersedia secara terverifikasi dalam tiga PDF dan sebaiknya diminta kepada Sekretaris Prodi/Admin:

| Data | Kegunaan |
|---|---|
| Jumlah mahasiswa per jalur dan per periode | Menjelaskan skala proses. |
| Jumlah pendaftaran baru, ulang, dan alih | Membuktikan pentingnya histori dan siklus. |
| Jumlah spreadsheet, Google Form, dan aplikasi yang dipakai pada satu siklus | Mengukur fragmentasi sumber data. |
| Waktu rata-rata verifikasi syarat sidang per mahasiswa | Menjadi baseline efisiensi. |
| Jumlah data ganda/koreksi administrasi per periode | Menguatkan masalah konsistensi data. |
| Jumlah bentrok atau perubahan jadwal/penguji | Menguatkan masalah penjadwalan. |
| Jumlah mahasiswa yang tertahan dan jenis kekurangannya | Menjelaskan kebutuhan status dan notifikasi. |
| Jumlah dosen, slot ketersediaan, ruangan, dan peserta sidang | Menjelaskan kompleksitas alokasi. |
| Waktu penyusunan jadwal manual | Menjadi pembanding terhadap dukungan sistem. |

Transkrip bimbingan memberi ilustrasi sekitar 70 peserta yang membutuhkan 210 penugasan dosen karena setiap sidang melibatkan tiga dosen. Angka ini belum boleh disajikan sebagai statistik final sebelum periode, sumber rekap, dan nilai pastinya dikonfirmasi.

## 7. Audit singkat referensi pada draft lama

- Thamrin dan Andriani (2021) serta Arizal dkk. (2022) relevan karena langsung membahas pengelolaan skripsi/tugas akhir berbasis web.
- Safitri (2021) relevan untuk detail implementasi REST API, tetapi tidak cukup untuk membenarkan bahwa React.js dan Node.js adalah solusi penelitian paling tepat. Letakkan pada Bab 2 atau Bab 3.
- Ananda (2021) dapat dipakai untuk konteks kendala penyelesaian tugas akhir setelah nama penulis, metadata, dan isi klaim diverifikasi dari artikel asli.
- Rachmawati dan Harahap (2025) membahas Posyandu. Sumber ini terlalu jauh untuk menjadi bukti utama masalah pengelolaan skripsi.
- Marliana dkk. (2021) membahas perusahaan distribusi. Sumber dapat menjadi ilustrasi umum integrasi sistem, tetapi bukan bukti langsung untuk konteks akademik UII.
- Daftar pustaka lama menduplikasi entri [9], [10], dan [11].
- Klaim faktual lokal tetap harus bersumber pada wawancara, observasi, dokumen operasional, atau data sistem; jurnal tidak boleh dipakai untuk seolah-olah membuktikan kondisi lokal yang tidak mereka teliti.

## 8. Referensi tambahan yang direkomendasikan

1. Kusumo, R. H. P. dan Suranto, B. (2023), “Evaluasi User Experience Sistem Informasi Manajemen Tugas Akhir (SEKAWAN) Informatika Universitas Islam Indonesia Menggunakan Metode User Experience Questionnaire (UEQ),” *AUTOMATA*, 4(1). Sumber ini paling dekat dengan konteks institusi dan menunjukkan perlunya kelengkapan informasi serta evaluasi pengalaman pengguna.
2. Arizal, A., Puteri, A. N., Zakiyabarsi, F. dan Priambodo, D. F. (2022), “Metode Prototype pada Sistem Informasi Manajemen Tugas Akhir Mahasiswa Berbasis Website,” *Jurnal TIKomSiN*, 10(1). DOI: https://doi.org/10.30646/tikomsin.v10i1.606.
3. Fitria, N., Nasution, F. H. dan Aldimas, A. (2024), “Perancangan Sistem Informasi Pengelolaan Judul Proposal Tugas Akhir Mahasiswa Program Studi Sistem Informasi Berbasis Web,” *JIKOMSI*, 7(1), 55–65. DOI: https://doi.org/10.55338/jikomsi.v7i1.2501.
4. Thamrin, T., Ambiyar, A., Simatupang, W. dan Wahyudi, R. (2023), “Heuristic Evaluation on Interface of Thesis Management Information System in Vocational Environment,” *Jurnal Teknologi Informasi dan Pendidikan*, 16(2), 139–151. DOI: https://doi.org/10.24036/jtip.v16i2.727.
5. Yue, M. dan Feng, H. (2021), “Optimization and practice of requirement analysis based on prototype portrait in software development process,” *Journal of Computational Methods in Sciences and Engineering*, 21(5), 1339–1347. DOI: https://doi.org/10.3233/JCM-214973.
6. Thamrin, R. M. H. dan Andriani, R. (2021), “Perancangan Sistem Informasi Pendaftaran dan Pengelolaan Data Skripsi Mahasiswa Berbasis Web,” *SISFOTENIKA*, 11(1), 101–110. Metadata dan URL penerbit perlu dimasukkan melalui Zotero/Mendeley dari artikel asli.

Referensi tersebut tidak perlu semuanya dimasukkan ke Bab 1. Pilih sumber berdasarkan fungsi argumennya: bukti konteks lokal, pembanding cakupan sistem tugas akhir, alasan Prototyping, atau dasar evaluasi. Target 30–50 bacaan pada `Rules.pdf` adalah target literatur yang dibaca, bukan alasan untuk memenuhi Bab 1 dengan sitasi yang tidak relevan.

## 9. Checklist sebelum draf menjadi naskah final

- [ ] Judul penelitian telah disetujui dan sama dengan cakupan sistem.
- [ ] Status dokumen telah dipastikan: proposal atau laporan akhir.
- [ ] Data kuantitatif lokal telah dikumpulkan dan dapat dilacak sumbernya.
- [ ] BPMN *as-is* dan *to-be* sudah divalidasi oleh pengguna proses.
- [ ] Batas implementasi aktual sudah dibedakan dari target pengembangan.
- [ ] Seluruh keputusan bisnis yang masih tertunda tidak diklaim sebagai aturan final.
- [ ] Pertanyaan, tujuan, metode, pengujian, hasil, dan kesimpulan dapat ditelusuri satu-ke-satu.
- [ ] Gaya sitasi Harvard konsisten dan seluruh entri daftar pustaka disitasi.
- [ ] Semua klaim fakta/data memiliki sumber.
- [ ] Tidak ada referensi duplikat, metadata kosong, atau tautan yang tidak dapat diverifikasi.
- [ ] Bahasa proposal/laporan digunakan secara konsisten.
- [ ] Subbab 1.6 disesuaikan setelah struktur Bab 2–5 final.

