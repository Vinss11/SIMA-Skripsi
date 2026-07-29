# Rancangan Pengerjaan Tahap 6 — Wajib Ganti dan Reset Password

## 1. Tujuan

Memastikan akun dengan password awal atau sementara tidak dapat menggunakan fitur aplikasi sebelum mengganti password, serta menyediakan reset yang aman.

## 2. Acuan

BR-AKUN-001–003. Password literal tidak ditulis pada source atau dokumen bisnis; gunakan konfigurasi dan hashing.

## 3. Paket pengerjaan

### Paket 1 — Enforcement backend

1. Middleware memeriksa `is_default_password`/`must_change_password`.
2. Hanya endpoint profil minimum, ganti password, refresh session yang aman, dan logout yang diizinkan.
3. Semua role menggunakan aturan yang sama.
4. Session/token lama dicabut atau dirotasi setelah password berubah.

### Paket 2 — Frontend guard

- Redirect paksa ke halaman ganti password.
- Hilangkan akses sidebar dan route lain.
- Jangan hanya memakai toast/modal yang dapat ditutup.
- Tangani response backend jika pengguna membuka URL langsung.

### Paket 3 — Lupa/reset password

1. Token acak, one-time, disimpan sebagai hash, dan kedaluwarsa.
2. Response permintaan reset tidak membocorkan keberadaan akun.
3. Password hasil reset menandai wajib ganti.
4. Admin dapat mereset dengan audit tanpa melihat password lama.
5. Rate limit dan invalidasi token setelah dipakai.

## 4. Pengujian

Uji semua role, akses endpoint langsung, token expired/reused, reset akun tidak dikenal, pergantian password, invalidasi session, rate limit, dan hashing.

## 5. Definition of Done

Tidak ada pengguna dengan password default/sementara yang dapat melakukan aktivitas bisnis; reset aman, ter-audit, dan tidak membocorkan akun.

