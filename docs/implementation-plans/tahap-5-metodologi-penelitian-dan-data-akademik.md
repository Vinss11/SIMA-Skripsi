# Rancangan Pengerjaan Tahap 5 — Metodologi Penelitian dan Data Akademik

## 1. Tujuan

Menyediakan histori Metodologi Penelitian dan data akademik terstruktur untuk eligibility penjaluran, izin lanjut, verifikasi pendadaran, dan laporan.

## 2. Acuan

BR-AKADEMIK-001–002 dan BR-SIDANG-001. Detail pengaruh Metodologi Penelitian terhadap flow Penelitian tetap decision gate.

## 3. Model data

Simpan mahasiswa, periode, status (`belum_mengambil`, `sedang_mengambil`, `lulus`, `tidak_lulus`, `mengulang`), nilai bila tersedia, sumber, aktor, dan waktu. Perubahan tidak menimpa histori periode lama.

Tambahkan snapshot akademik yang dapat memuat total SKS, mata kuliah wajib, IP/IPK bila diperlukan, dan waktu sinkronisasi.

## 4. Paket pengerjaan

1. Definisikan kamus status dan validator transisi.
2. Buat migration, model, association, dan index mahasiswa-periode.
3. Buat import Excel dengan template, preview, valid/tidak valid, pesan per baris, dan idempotensi.
4. Sediakan input koreksi Admin dengan audit; jangan memberi hak koreksi kepada mahasiswa.
5. Buat service eligibility yang mengembalikan keputusan dan alasan terstruktur.
6. Integrasikan ke ulang/alih, izin lanjut, dan verifikasi sidang setelah aturan tiap flow dikunci.
7. Siapkan adapter agar integrasi akademik kelak dapat mengganti import manual.

## 5. UI

- Admin: import, preview, koreksi, histori.
- Sekprodi: filter mahasiswa dan status akademik.
- Mahasiswa: status readonly dan petunjuk bila ada data yang perlu dikoreksi.

## 6. Pengujian

Uji duplikasi import, transisi status, koreksi, data lintas semester, baris invalid, rollback batch, dan alasan eligibility.

## 7. Definition of Done

Status Metodologi Penelitian dan snapshot akademik dapat ditelusuri per semester, tidak lagi bergantung pada teks alasan bebas, dan siap dipakai sebagai aturan terkonfigurasi.

