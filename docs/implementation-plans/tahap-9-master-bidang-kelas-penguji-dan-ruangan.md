# Rancangan Pengerjaan Tahap 9 — Master Bidang, Kelas Penguji, dan Ruangan

## 1. Tujuan

Menyediakan master yang stabil untuk pencocokan penguji dan penjadwalan ruangan, menggantikan atribut per-slot dan nama ruangan bebas.

## 2. Acuan

BR-JADWAL-002–003. Istilah/aturan resmi kelas 1/2/3 masih membutuhkan konfirmasi; struktur dapat dibuat tanpa memaksakan algoritmanya.

## 3. Model data

### Bidang

- `MasterBidangIlmu`: kode, nama, status aktif.
- `DosenBidangIlmu`: dosen, bidang, utama, bobot/tingkat kompetensi opsional.
- Relasi bidang pada pengajuan/topik/judul sebagai input pencocokan.

### Profil penguji

- Kelas penguji terstruktur dan historinya.
- Larangan pasangan, preferensi pasangan, serta masa berlaku aturan.
- Karakteristik master tidak diduplikasi pada setiap slot ketersediaan.

### Ruangan

- `MasterRuangan`: kode, nama, lokasi, kapasitas, status.
- `RuanganPeriodeSidang`: periode, ruangan, aktif/tersedia.
- Jadwal mereferensikan `ruangan_id`; snapshot nama opsional untuk histori, bukan sumber utama.

## 4. Paket pengerjaan

1. Konfirmasi kamus bidang dan sumber klasifikasi dosen.
2. Buat CRUD berotorisasi, unique key, histori perubahan, dan proteksi penghapusan referensi.
3. Migrasikan cluster/bidang lama dengan mapping eksplisit dan laporan yang tidak cocok.
4. Pindahkan karakteristik penguji dari ketersediaan slot ke profil master.
5. Buat master ruangan dan mapping data periode lama.
6. Sediakan status nonaktif tanpa menghapus histori.

## 5. Pengujian

Uji kode duplikat, dosen multi-bidang, bidang utama tunggal, referensi nonaktif, larangan hard-delete, mapping legacy, dan perubahan nama ruangan tanpa merusak jadwal lama.

## 6. Definition of Done

Algoritma tahap berikutnya memperoleh bidang, kelas/aturan pasangan, dan ruangan dari master terstruktur; data lama tetap dapat ditelusuri.

