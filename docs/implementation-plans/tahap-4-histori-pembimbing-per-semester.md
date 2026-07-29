# Rancangan Pengerjaan Tahap 4 — Histori Pembimbing per Semester

## 1. Tujuan

Menjadikan penetapan pembimbing sebagai sumber utama untuk P1/P2, masa tugas, semester penjaluran, pergantian, perpanjangan, dan pengakhiran.

## 2. Acuan

BR-PENETAPAN-001–004, BR-SEMESTER-001–003, BR-BIMBINGAN-002, dan BR-AUDIT-001–004.

## 3. Kontrak data

- Maksimum satu penetapan aktif per mahasiswa.
- Minimal satu anggota P1; P2 opsional dan berbeda.
- Anggota menyimpan urutan, status, tanggal mulai, dan tanggal selesai.
- `dosen_pembimbing_skripsi_id` hanya cache P1 aktif.
- Dasar penetapan adalah keputusan final Sekprodi tanpa surat tugas.

## 4. Paket pengerjaan

### Paket 1 — Konsistensi model dan constraint

Audit unique index, foreign key, enum status/sumber, konsistensi anggota-induk, dan transaction lock. Jangan mengandalkan validasi aplikasi saja.

### Paket 2 — Semester 1 dan 2

1. Final penjaluran membuat semester ke-1.
2. Saat semester berganti, tampilkan preview mahasiswa belum selesai.
3. Konfirmasi carry-forward mengakhiri record sebelumnya dan membuat record semester ke-2, walaupun P1/P2 sama.
4. Jangan memakai tanggal penutupan pendaftaran sebagai akhir otomatis masa bimbingan.

### Paket 3 — Semester 3 dan izin lanjut

1. Semester ke-3 hanya dibuat setelah izin lanjut approved.
2. Approval memanggil service penetapan dalam transaksi yang sama.
3. Rejection mengakhiri kelayakan lanjut dan mengarahkan ulang/alih sesuai aturan.

### Paket 4 — Pergantian dan pengakhiran

- Pergantian dalam siklus sama mempertahankan progres.
- Ulang/alih membuat siklus baru.
- Pamit, selesai, pembatalan, dan izin ditolak mengakhiri penetapan dengan alasan sistem.

### Paket 5 — Backfill dan rekonsiliasi

Sediakan dry-run dan execute untuk data legacy. Laporkan penetapan ganda, tanpa P1, cache tidak cocok, semester kosong, atau relasi pendaftaran tidak ditemukan.

### Paket 6 — Monitoring

Halaman Sekprodi menyediakan filter mahasiswa, dosen, jalur, periode, semester, sumber, dan status. Histori readonly; perubahan hanya melalui flow resmi.

## 5. Pengujian

Uji initial assignment, idempotensi, pergantian P1/P2, carry-forward, izin lanjut, rollback, cache, akses P1/P2, backfill, dan satu-active constraint.

## 6. Definition of Done

Sistem dapat menjawab siapa P1/P2 mahasiswa pada setiap semester, kapan mulai/selesai, jalur dan pendaftarannya, dasar keputusan, serta alasan sistem ketika berakhir.

