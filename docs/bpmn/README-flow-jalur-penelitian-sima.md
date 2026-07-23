# Diagram BPMN Jalur Penelitian SIMA

Diagram utama tersedia dalam dua format:

- [`flow-jalur-penelitian-sima.svg`](flow-jalur-penelitian-sima.svg) untuk kualitas vektor dan penyuntingan.
- [`flow-jalur-penelitian-sima.png`](flow-jalur-penelitian-sima.png) untuk pratinjau cepat.
- [`flow-jalur-penelitian-sima-camunda7.bpmn`](flow-jalur-penelitian-sima-camunda7.bpmn) untuk Camunda Platform 7.

## Menjalankan di Camunda 7

1. Buka file `.bpmn` menggunakan Camunda Modeler.
2. Deploy ke Camunda Platform 7 melalui tombol **Deploy current diagram**.
3. Mulai proses dengan key `Process_SimaResearchRegistration` dan variabel awal:
   - `jenisPengajuan`: `TOPIK_DOSEN` atau `JUDUL_MANDIRI`.
4. Selesaikan user task melalui Tasklist. Worker SIMA harus menangani external-task topic yang tercantum di bawah.

External-task topics:

- `sima-check-eligibility` menghasilkan `eligible`.
- `sima-notify-ineligible`.
- `sima-validate-topic-proposal` menghasilkan `dataValidTopik`.
- `sima-reserve-topics` dan menyediakan koleksi `selectedTopics` berisi 1–3 topik.
- `sima-evaluate-topic-reviews` menghasilkan `adaTopikDisetujui`.
- `sima-select-highest-priority`.
- `sima-validate-independent-proposal` menghasilkan `dataValidMandiri`.
- `sima-finalize-approval`.
- `sima-handle-rejection`.

Variabel keputusan yang diisi saat menyelesaikan user task review adalah `calonDosenDisetujui`, `ketuaClusterTersedia`, `ketuaClusterDisetujui`, dan `sekprodiDisetujui`.

Diagram menggunakan satu pool proses utama dengan lima lane:

1. Mahasiswa.
2. Sistem SIMA.
3. Calon Dosen Pembimbing/Pemilik Topik.
4. Ketua Cluster.
5. Sekretaris Prodi.

## Notasi penting

- Belah ketupat bertanda `X`: exclusive gateway (XOR).
- Kotak review dengan tiga garis vertikal: parallel multi-instance untuk 1–3 dosen pemilik topik.
- Event jam pada batas aktivitas review: batas waktu review dosen.
- Garis penuh: sequence flow.
- Garis merah: jalur penolakan yang bergabung menuju satu hasil akhir.

## Hasil akhir

- Pendaftaran penelitian disetujui.
- Pendaftaran penelitian ditolak.
- Pendaftaran tidak dapat diproses.

SVG dibuat pada kanvas lebar agar dua cabang tetap terbaca dan konektor dapat menggunakan rute ortogonal tanpa menimpa kotak aktivitas. Buka SVG di browser, Inkscape, Figma, atau editor vektor lain; gunakan zoom untuk membaca detail.
