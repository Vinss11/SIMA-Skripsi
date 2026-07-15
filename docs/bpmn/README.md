# BPMN Penjaluran Penelitian

File `penjaluran-penelitian.bpmn` adalah model BPMN 2.0 untuk alur penjaluran skripsi jalur penelitian.

## Cara membuka

- Camunda Modeler: `File` > `Open File`, lalu pilih file `.bpmn`.
- bpmn.io: buka `https://demo.bpmn.io`, lalu gunakan `Open Diagram`.

## Struktur model

Diagram menggunakan lima pool untuk membedakan entitas yang berpartisipasi:

1. Mahasiswa.
2. Sistem SIMPS.
3. Dosen Pemilik Topik.
4. Ketua Cluster.
5. Sekretaris Prodi.

Aktivitas di dalam pool yang sama dihubungkan dengan sequence flow. Komunikasi dan perpindahan informasi antar-pool dihubungkan dengan message flow.

Empat kotak besar berupa artefak Group membagi alur lengkap menjadi proses besar:

1. Pendaftaran Penjaluran Penelitian oleh mahasiswa.
2. Review Dosen Pemilik Topik.
3. Review Ketua Cluster.
4. Keputusan Final Sekprodi dan Penetapan Hasil Penjaluran.

Group dipakai karena satu proses besar dapat melibatkan beberapa pool, sedangkan subprocess tidak boleh membungkus aktivitas milik participant lain. Group hanya mengelompokkan tampilan dan tidak mengubah urutan eksekusi proses.

Proses pertama dimulai ketika periode penjaluran dibuka dan mahasiswa melakukan pendaftaran, mengisi informasi, memilih maksimal tiga topik, lalu mengirimkannya. Di dalam pool Sistem SIMPS terdapat expanded subprocess `Proses Review Independen per Topik`. Subprocess ini dibuat multi-instance paralel berdasarkan kumpulan topik yang dipilih. Setiap topik bergerak secara independen melalui review dosen, ketua cluster, dan Sekprodi. Ketika satu topik ditetapkan sebagai topik final, proses topik lain dihentikan dan reservasinya dilepaskan sebagai bagian dari proses besar keempat.

## Arti notasi utama

- Lingkaran tipis: start event.
- Lingkaran tebal: end event.
- Pool: batas proses untuk masing-masing entitas.
- Garis penuh berpanah: sequence flow di dalam satu pool.
- Garis putus-putus berpanah: message flow antar-pool.
- Kotak garis putus-putus: Group untuk menandai proses besar lintas entitas.
- Kotak sudut membulat dengan tanda `+`: collapsed subprocess finalisasi.
- Tiga garis vertikal pada subprocess review: parallel multi-instance subprocess.
- Belah ketupat dengan tanda `X`: exclusive gateway.
- Belah ketupat dengan pentagon: event-based gateway untuk menunggu hasil atau permintaan perbaikan.
- User task: pekerjaan yang dilakukan pengguna.
- Service task: pekerjaan otomatis oleh sistem.
- Send task: pengiriman notifikasi oleh sistem.
- Receive task dan message event: penerimaan keputusan atau informasi dari pool lain.
