# BPMN SIMA-Skripsi Multi-Pool Collaboration Workflow

File `sima-skripsi-end-to-end.bpmn` telah dirancang ulang secara presisi dengan **6 Pool Terpisah (*Multi-Participant Collaboration*)** sesuai aturan bisnis akademik SIMA-Skripsi ([aturan-bisnis-simps.md](file:///d:/MyProjects/SIMA-Skripsi/docs/business-rules/aturan-bisnis-simps.md#BR-ROLE-003)).

---

## 1. Konsep Pemodelan & Notasi Standar

Diagram ini menerapkan kaidah resmi BPMN 2.0 untuk interaksi antar-entitas terpisah:

- **Horizontal Sequence Flows (`sequenceFlow` - Garis Lurus Utuh)**: Menghubungkan aktivitas di **dalam Pool/Peserta yang sama** (secara horizontal dari kiri ke kanan).
- **Vertical Message Flows (`messageFlow` - Garis Putus-Putus dengan Amplop/Lingkaran)**: Digunakan untuk **komunikasi & notifikasi antar-Pool yang berbeda** (secara vertikal dari atas ke bawah / bawah ke atas).
- **Send Task (`sendTask` - Amplop Hitam)** & **Receive Task (`receiveTask` - Amplop Putih)**: Menggambarkan pengiriman notifikasi dari Sistem dan penerimaan notifikasi oleh aktor pengguna.

---

## 2. Struktur 6 Pool Terpisah (*Participants*)

1. **Mahasiswa (Pool 1 - Atas)**:
   - Memulai alur pendaftaran, menerima notifikasi, submit log bimbingan, mendaftar sidang, upload revisi, hingga menerima notifikasi kelulusan.
2. **Sistem SIMA-Skripsi (Pool 2 - Tengah-Atas)**:
   - Menjalankan validasi otomatis backend, reservasi slot, pengolahan kuota bimbingan, kalkulasi nilai akhir, serta bertindak sebagai **Notification Hub** pengirim notifikasi (`sendTask`).
3. **Dosen (Pembimbing & Penguji) (Pool 3 - Tengah)**:
   - Menerima penugasan pembimbing, me-review log bimbingan, memberikan ACC sidang, menginput ketersediaan waktu penguji, menguji sidang, dan approve revisi.
4. **Penanggung Jawab / Pengampu Penjaluran (Pool 4 - Tengah-Bawah)**:
   - Gabungan lane khusus pengampu jalur: **Ketua Cluster (Penelitian)**, **Pengawas Magang (Magang)**, **Pengampu Perintisan (Perintisan Bisnis)**, dan **Pengampu Pengabdian (Pengabdian Masyarakat)**. Melakukan review & persetujuan awal pengajuan judul/topik mahasiswa sesuai jalur.
5. **Sekretaris Prodi (Pool 5 - Bawah-Tengah)**:
   - Mengonfigurasi periode, menerima pengajuan disetujui dari pengampu jalur, menetapkan dosen pembimbing P1/P2, menjadwalkan sidang & plot penguji, serta memformalisasi yudisium.
6. **Admin System (Pool 6 - Bawah)**:
   - Inisiasi master data mahasiswa/dosen via Excel dan pengelolaan status akun/keaktifan dosen.

---

## 3. Alur Komunikasi Notifikasi & Pesan Vertikal (*Message Flows*)

- **`MF_Admin_To_Sekprodi`**: Admin menyiapkan data master $\rightarrow$ Sekprodi membuat draft periode.
- **`MF_Notif_Periode`**: System `sendTask` $\rightarrow$ Mahasiswa `receiveTask` (Notifikasi Periode Penjaluran Dibuka).
- **`MF_Mahasiswa_Submit_Pendaftaran`**: Mahasiswa submit pengajuan $\rightarrow$ System memvalidasi eligibility.
- **`MF_System_Forward_To_Track`**: System meneruskan pengajuan valid $\rightarrow$ Penanggung Jawab / Pengampu Penjaluran.
- **`MF_Track_Reject_Proposal` & `Approve_Proposal`**: Pengampu Jalur mereview:
  - Jika **Ditolak** $\rightarrow$ System `sendTask` $\rightarrow$ Mahasiswa `receiveTask` (Notifikasi Pengajuan Ditolak).
  - Jika **Disetujui** $\rightarrow$ Diteruskan ke Sekretaris Prodi untuk penetapan Dosen Pembimbing P1 & P2.
- **`MF_Notif_Penetapan_Mahasiswa` & `Dosen`**: System `sendTask` $\rightarrow$ Mahasiswa & Dosen (Notifikasi Penetapan Pembimbing P1/P2).
- **`MF_Mahasiswa_Submit_Log`**: Mahasiswa submit log $\rightarrow$ Dosen me-review bimbingan.
- **`MF_Notif_ACC_Mahasiswa`**: System `sendTask` $\rightarrow$ Mahasiswa (Notifikasi ACC / Izin Lanjut Sidang).
- **`MF_Notif_Jadwal_Mahasiswa` & `Penguji`**: System `sendTask` $\rightarrow$ Mahasiswa & Dosen Penguji (Notifikasi Jadwal Sidang).
- **`MF_Notif_Kelulusan_Mahasiswa`**: System `sendTask` $\rightarrow$ Mahasiswa (Notifikasi Kelulusan Skripsi & Yudisium).

---

## 4. Cara Membuka di Camunda Modeler

1. Buka aplikasi **Camunda Modeler**.
2. Pilih `File` > `Open File...`.
3. Buka berkas [`sima-skripsi-end-to-end.bpmn`](file:///d:/MyProjects/SIMA-Skripsi/docs/bpmn/sima-skripsi-end-to-end.bpmn).
4. Seluruh 6 Pool akan tampil sejajar secara horizontal, dengan panah putus-putus (`Message Flow`) yang menghubungkan pesan antar-Pool secara rapi dan ortogonal.
