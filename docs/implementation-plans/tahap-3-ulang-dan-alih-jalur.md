# Rancangan Pengerjaan Tahap 3 — Ulang dan Alih Jalur

## 1. Tujuan

Menyediakan ulang dan alih jalur untuk Penelitian, Magang, dan Perintisan Bisnis dengan pamit, pengakhiran siklus lama, pendaftaran baru, serta histori yang utuh.

## 2. Aturan inti

Mengacu pada BR-DAFTAR-002–006, BR-PAMIT-001–003, BR-PENETAPAN-003, dan BR-AUDIT-001–004.

- Ulang: target sama dengan jalur aktual sebelumnya.
- Alih: target berbeda dari jalur aktual sebelumnya.
- Jalur asal selalu dihitung server.
- Pamit wajib bila ada penetapan aktif dan diputuskan P1 aktif.
- Mahasiswa tidak memilih pembimbing baru.
- Data lama tidak dihapus; ulang/alih memulai siklus progres baru.

## 3. Perubahan data

1. Generalisasi data pamit dengan `jenis_perubahan`, `jalur_asal`, `jalur_tujuan`, `penetapan_lama_id`, status, keputusan, dan `pendaftaran_baru_id`.
2. Pertahankan nama tabel legacy bila rename berisiko, tetapi gunakan kontrak API umum.
3. Pastikan satu pamit hanya dipakai satu pendaftaran.
4. Simpan alasan pengakhiran sebagai kode sistem dan teks tampilan otomatis.

## 4. Backend

### Paket 1 — Eligibility

Buat endpoint eligibility yang mengembalikan periode, jalur asal, penetapan aktif, kebutuhan pamit, pamit aktif, dan target ulang/alih yang valid.

### Paket 2 — Pamit

1. Mahasiswa mengirim jenis perubahan, target, alasan, dan pesan.
2. Server mengikat P1 serta penetapan aktif.
3. Approval P1 mengakhiri penetapan, membatalkan bimbingan mendatang yang pending, mempertahankan histori, dan mengirim pemberitahuan.
4. Rejection tidak mengubah penetapan.
5. Sediakan penanganan Sekprodi jika P1 tidak dapat memberi keputusan karena statusnya.

### Paket 3 — Pendaftaran

1. Generalisasi endpoint yang saat ini terbatas pada Ulang Penelitian.
2. Tolak pendaftaran periode ganda, pengajuan aktif, pamit belum approved, dan target tidak valid.
3. Jangan menerima dosen lama/baru dari frontend.
4. Arahkan target Magang ke form individual dan Perintisan ke pembentukan kelompok.

### Paket 4 — Perintisan lintas siklus

- Setiap peserta harus eligible secara individual.
- Kelompok lama tetap histori; buat kelompok baru pada siklus baru.
- Anggota dapat berasal dari pendaftaran baru, ulang, atau alih pada periode yang sama.
- Kegagalan satu anggota memblokir pembentukan/finalisasi kelompok.

## 5. Frontend

- Aktifkan tab Ulang dan Alih dengan jalur asal readonly.
- Hapus pilihan dosen lama/baru.
- Tampilkan stepper: Pamit → Pendaftaran → Form/Kelompok → Review → Final → Pembimbing Aktif.
- Tampilkan alasan penolakan dan next action.

## 6. Pengujian

Test minimal: ulang setiap jalur, alih seluruh kombinasi antar-tiga jalur, pamit approved/rejected, P1 tidak tersedia, same-period duplicate, pemakaian pamit ganda, kelompok campuran eligibility, histori lama, serta pemisahan progres lama dan baru.

## 7. Definition of Done

- Semua kombinasi ulang/alih yang valid berjalan end-to-end.
- Jalur asal tidak dapat dipalsukan frontend.
- Siklus lama berakhir tanpa kehilangan histori.
- Pembimbing baru hanya aktif setelah final Sekprodi.
- Ulang/alih transaksional, idempotent, dan mempunyai pemberitahuan.

