# Rancangan Pengerjaan Tahap 9 — Bidang Penelitian, Kelas Penguji, dan Ruangan

## 1. Tujuan

Menyediakan master yang stabil untuk pencocokan penguji dan penjadwalan ruangan, menggantikan atribut per-slot dan nama ruangan bebas.

## 2. Acuan

BR-JADWAL-002–003. Istilah/aturan resmi kelas 1/2/3 masih membutuhkan konfirmasi; struktur dapat dibuat tanpa memaksakan algoritmanya.

## 3. Model data

### Bidang penelitian

- `BidangPenelitian`: kode, nama, deskripsi, dan contoh kata kunci untuk konteks klasifikasi AI.
- `DosenBidangPenelitian`: relasi banyak-ke-banyak dosen dan bidang penelitian tanpa pembagian peran.
- `PengajuanBidangPenelitian` serta `TopikBidangPenelitian`: relasi banyak-ke-banyak tanpa pembagian peran sebagai input pencocokan penguji.
- Seluruh bidang penelitian selalu aktif; bidang yang sudah direferensikan tidak boleh dihapus.

### Profil penguji

- Kelas penguji terstruktur dan historinya.
- Larangan pasangan, preferensi pasangan, serta masa berlaku aturan.
- Karakteristik master tidak diduplikasi pada setiap slot ketersediaan.

### Ruangan

- `MasterRuangan`: kode, nama, lokasi, kapasitas, status.
- `RuanganPeriodeSidang`: periode, ruangan, aktif/tersedia.
- Jadwal mereferensikan `ruangan_id`; snapshot nama opsional untuk histori, bukan sumber utama.

## 4. Paket pengerjaan

1. Konfirmasi kamus bidang penelitian dan sumber klasifikasi dosen.
2. Buat CRUD berotorisasi, unique key, histori perubahan, dan proteksi penghapusan referensi.
3. Migrasikan cluster/bidang lama dengan mapping eksplisit dan laporan yang tidak cocok.
4. Pindahkan karakteristik penguji dari ketersediaan slot ke profil master.
5. Buat master ruangan dan mapping data periode lama.
6. Sediakan status nonaktif tanpa menghapus histori.

## 5. Pengujian

Uji nama bidang duplikat, dosen/pengajuan/topik multi-bidang tanpa pembagian peran, larangan hard-delete untuk bidang yang digunakan, mapping legacy, dan perubahan nama ruangan tanpa merusak jadwal lama.

## 6. Definition of Done

Algoritma tahap berikutnya memperoleh bidang, kelas/aturan pasangan, dan ruangan dari master terstruktur; data lama tetap dapat ditelusuri.
