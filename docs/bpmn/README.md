# BPMN Penjaluran Penelitian

File `penjaluran-penelitian.bpmn` adalah model BPMN 2.0 untuk alur penjaluran skripsi jalur penelitian.

## Cara membuka

- Camunda Modeler: `File` > `Open File`, lalu pilih file `.bpmn`.
- bpmn.io: buka `https://demo.bpmn.io`, lalu gunakan `Open Diagram`.

## Struktur model

Diagram utama menggunakan satu pool karena mahasiswa, dosen, ketua cluster, Sekprodi, dan sistem diperlakukan sebagai bagian dari satu workflow organisasi. Perpindahan pekerjaan antaraktor menggunakan sequence flow. Lane ditempatkan di dalam subprocess sesuai penanggung jawab aktivitas.

Proses utama terdiri dari:

1. Pengajuan Topik Penelitian.
2. Review Topik Secara Independen sebagai parallel multi-instance subprocess.
3. Gateway hasil keputusan final.
4. Finalisasi penjaluran disetujui atau ditolak.

Subprocess review dibuat multi-instance paralel atas koleksi topik yang dipilih. Setiap topik melewati review dosen pemilik topik, ketua cluster, lalu Sekprodi secara independen. Ketika satu topik ditetapkan sebagai topik final, instance lain dapat dihentikan oleh completion condition dan diselesaikan oleh proses finalisasi.

## Arti notasi utama

- Lingkaran tipis: start event.
- Lingkaran tebal: end event.
- Kotak sudut membulat dengan tanda `+`: collapsed subprocess.
- Tiga garis vertikal pada subprocess review: parallel multi-instance.
- Belah ketupat dengan tanda `X`: exclusive gateway.
- User task: pekerjaan yang dilakukan pengguna.
- Service task: pekerjaan otomatis oleh sistem.
- Send task: pengiriman notifikasi oleh sistem.
