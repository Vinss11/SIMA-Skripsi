# BPMN Penjaluran Penelitian — Implementasi Aktual

Diagram ini disusun dari implementasi aplikasi saat ini dan dipisahkan menjadi dua file agar setiap cabang mudah dibaca:

- `penjaluran-topik-dosen-aktual.bpmn`: mahasiswa memilih 1–3 topik dosen dan setiap topik direview secara independen.
- `penjaluran-judul-mandiri-aktual.bpmn`: mahasiswa mengajukan judul sendiri dengan satu calon pembimbing.

Kedua diagram menggunakan lane:

1. Sekretaris Prodi.
2. Sistem SIMA.
3. Mahasiswa.
4. Dosen Pemilik Topik/Calon Pembimbing.
5. Ketua Klaster.

## Catatan pemodelan

- Pendaftaran awal jalur penelitian langsung dibuat berstatus `approved` oleh sistem.
- DPA tidak menjadi lane karena tidak melakukan keputusan pada workflow penelitian saat ini.
- Review topik dosen dimodelkan sebagai parallel multi-instance untuk 1–3 slot topik.
- Jika pemilik topik atau calon pembimbing juga merupakan Ketua Klaster, validasi Ketua Klaster dicatat sebagai auto-approved.
- Tidak ada timer auto-reject. Implementasi hanya menyimpan pengingat review berkala.
- Tidak ada loop revisi setelah reviewer menolak pengajuan.
- Diagram bersifat deskriptif (`isExecutable="false"`) dan ditujukan untuk dokumentasi/analisis BPMN.

## Membuka diagram

Gunakan Camunda Modeler atau buka https://demo.bpmn.io lalu pilih **Open Diagram**.
