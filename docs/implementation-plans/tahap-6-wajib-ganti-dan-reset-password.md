# Rancangan Pengerjaan Tahap 6 — Wajib Ganti dan Reset Password

## Status implementasi (1 Agustus 2026)

Gate 6A dan minimum transisi Gate 6B telah diimplementasikan: bypass login email dan fallback JWT dihapus, empat role memakai credential state/version, root guard serta middleware memaksa perubahan password, access token menunjuk live server session, dan logout/revocation tersedia. Gate 6C tersedia di balik `AUTH_RECOVERY_ENABLED`: token reset hashed dan single-use, payload delivery dienkripsi AES-GCM, worker mendukung retry/dead-letter, serta Admin reset dibatasi untuk Mahasiswa/Dosen. Aktivasi recovery produksi tetap menunggu konfigurasi provider, delivery key, dan penetapan kanal email terverifikasi.

## 1. Tujuan

Memastikan akun dengan password awal atau sementara hanya dapat login untuk mengganti password atau logout, tidak dapat menjalankan aktivitas bisnis melalui UI maupun API, dan seluruh sesi lama dicabut setelah kredensial berubah.

Tahap ini juga menyediakan lupa/reset password yang:

- tidak membocorkan keberadaan akun;
- menggunakan token acak, sekali pakai, tersimpan sebagai hash, dan kedaluwarsa;
- aman terhadap replay, race condition, brute force, dan pengambilalihan akun lintas role;
- mempunyai delivery, audit, rate limit, serta prosedur pemulihan yang dapat dioperasikan;
- tidak pernah menampilkan password lama, hash, token reset, atau secret pada log dan response umum.

## 2. Acuan aturan bisnis

Rancangan mengacu pada:

- BR-ROLE-001;
- BR-AKUN-001 sampai BR-AKUN-003;
- BR-AUDIT-001, BR-AUDIT-002, dan BR-AUDIT-004.

Aturan final:

- akun mahasiswa tersedia setelah import;
- password awal ditandai sebagai password default;
- nilai literal password awal tidak ditulis pada aturan bisnis atau source code;
- pengguna dengan password default hanya dapat mengakses ganti password dan logout;
- pembatasan wajib berlaku di frontend dan middleware backend;
- lupa/reset password tersedia;
- password sementara hasil reset kembali mewajibkan ganti password.

Frontend hanya lapisan pengalaman pengguna. Backend tetap menjadi enforcement source of truth.

## 3. Batas tahap

### 3.1 Termasuk Tahap 6

- normalisasi state kredensial untuk mahasiswa, dosen, Admin, dan Sekprodi;
- pembatasan global akun default/sementara;
- perubahan password lintas role melalui service tunggal;
- versioning kredensial dan pencabutan sesi;
- logout sesi saat ini dan seluruh sesi;
- forgot/reset password mandiri;
- reset/aktivasi berbasis link oleh Admin untuk target non-privileged, dengan audit dan object-level authorization;
- session/access-token hardening yang diperlukan untuk revocation;
- delivery reset melalui adapter/outbox;
- password policy, rate limit, lock/backoff, audit, rekonsiliasi, dan monitoring;
- frontend forced route untuk semua role;
- endpoint integration, authorization, concurrency, dan security test.

### 3.2 Tidak termasuk Tahap 6

- multi-factor authentication;
- single sign-on/OAuth/SAML;
- perubahan status akademik atau role pengguna;
- pemulihan akun tanpa email/kanal terverifikasi sebelum prosedurnya disahkan;
- pengelolaan credential sistem akademik eksternal;
- penyimpanan jawaban pertanyaan keamanan;
- pengiriman password atau token melalui kanal publik/tidak terotorisasi.

### 3.3 Release gate wajib

Tahap 6 dipecah menjadi tiga release gate yang harus dilewati berurutan:

| Gate | Isi minimum | Syarat rilis |
| --- | --- | --- |
| **6A — Tutup bypass dan paksa ganti password** | hapus login email tanpa password dan paparan password awal; credential state/version; forced-change seluruh role; password policy; hardening JWT; frontend guard | seluruh bypass tertutup, secret fail-closed, direct API/deep link terblokir, dan characterization/integration test 6A lulus |
| **6B — Session dan revocation** | session registry; live account/session lookup; logout; logout-all; revocation setelah change password; token/storage migration | sesi dapat dicabut server-side, token legacy ditolak saat cutover, dan test revocation/replay/concurrency 6B lulus |
| **6C — Recovery berbasis link** | verified recovery channel; forgot/reset link; limiter; encrypted token outbox; delivery worker; reset/activation target non-privileged oleh Admin | 6A dan 6B sudah stabil; limiter, provider, outbox, retry/dead-letter, redaction, serta consume atomik sudah teruji |

Ketentuan gate:

1. Gate tidak boleh digabung hanya untuk mengejar tanggal rilis apabila acceptance gate sebelumnya belum lulus.
2. Forgot/reset tidak boleh diaktifkan sebelum server-side session revocation, limiter, dan delivery siap.
3. Kode 6C boleh dideploy dalam keadaan feature flag mati setelah 6B, tetapi endpoint publik dan worker tidak boleh diaktifkan lebih awal.
4. Reset akun Admin/Sekprodi tidak termasuk rilis awal 6C dan tetap nonaktif sampai capability khusus, aturan otorisasi, audit, dan bila diperlukan step-up/four-eyes disahkan.
5. Setiap gate mempunyai migration, rollback, test, observability, dan Definition of Done sendiri; kelulusan Tahap 6 penuh mensyaratkan 6A–6C lulus.

## 4. Kondisi implementasi saat ini

### 4.1 Fondasi yang sudah tersedia

- `is_default_password` tersedia pada mahasiswa, dosen, Admin, dan Sekprodi;
- login utama mengembalikan `prompt_change_password`;
- endpoint `/api/auth/change-password` menangani empat role;
- password disimpan menggunakan bcrypt melalui model hooks;
- halaman mahasiswa sudah mempunyai kartu paksa ganti password;
- token Bearer dan middleware autentikasi sudah tersedia;
- status akun dosen diperiksa saat request terautentikasi.

### 4.2 Gap kritis

#### 4.2.1 Belum ada enforcement backend untuk password default

Middleware autentikasi belum mengambil state password untuk semua role dan belum menolak endpoint bisnis. Pengguna dapat memanggil API secara langsung meskipun frontend menyembunyikan menu.

#### 4.2.2 Frontend hanya memaksa mahasiswa

Guard saat ini memeriksa role mahasiswa. Dosen, Admin, dan Sekprodi dengan password default masih dapat melihat/menggunakan workspace masing-masing.

#### 4.2.3 Login mahasiswa via email merupakan bypass kredensial

Endpoint `/api/auth/login-mahasiswa-email` menerima email tanpa password, membandingkan hash dengan literal default, membocorkan apakah email terdaftar, lalu menerbitkan JWT. Endpoint ini harus dihentikan sebelum enforcement dianggap aman.

#### 4.2.4 Secret dan password literal masih mempunyai fallback

JWT memakai fallback secret development dan beberapa controller/seeder memakai literal/fallback password awal. Produksi harus gagal start bila secret wajib tidak tersedia; shared default tidak boleh menjadi fallback source.

#### 4.2.5 Password awal dapat tampil pada response/frontend

Flow pendaftaran dapat mengembalikan `default_password` dan melakukan login otomatis. Ini memperluas paparan password ke response, browser storage, telemetry, screenshot, dan pengguna selain pemilik akun.

#### 4.2.6 Perubahan password tidak mencabut token lama

JWT lama tetap valid sampai kedaluwarsa karena tidak ada credential version/session registry. Frontend hanya mengubah flag lokal.

#### 4.2.7 Belum ada logout server-side

Logout hanya membersihkan storage browser. Token yang disalin tetap dapat digunakan.

#### 4.2.8 Password policy tersebar dan terlalu lemah

Endpoint umum hanya mensyaratkan enam karakter. Endpoint mahasiswa lama juga menduplikasi perubahan password. Policy, hashing, error, dan audit berpotensi menyimpang.

#### 4.2.9 Belum ada forgot/reset token dan delivery

Belum ditemukan model reset token, email/outbox reset, expiry, single-use consume, atau endpoint lupa password.

#### 4.2.10 Belum ada rate limit autentikasi terpusat

Login, change password, dan endpoint pemulihan belum mempunyai limiter/backoff yang terlihat pada app-level.

#### 4.2.11 Access token berumur panjang tersimpan di browser storage

JWT default 24 jam disimpan pada session/local storage. Ini memperbesar dampak XSS dan membuat revocation/remember-me sulit dikelola.

#### 4.2.12 Lookup/status akun belum seragam

Middleware hanya memuat ulang akun dosen. Perubahan status/password Admin, mahasiswa, atau Sekprodi tidak langsung membatalkan token yang sudah diterbitkan.

## 5. Kontrak domain

### 5.1 State kredensial

Gunakan state kredensial kanonik:

| State | Makna | Akses |
| --- | --- | --- |
| `default` | Password awal akun belum diganti | Login, ganti password, logout |
| `temporary` | State kompatibilitas untuk password sementara legacy; tidak diterbitkan flow versi awal | Login, ganti password, logout |
| `active` | Password permanen telah dibuat pengguna | Sesuai role/status akun |

Permintaan forgot-password tidak mengubah state menjadi restricted dan tidak mengunci akun. Versi awal tidak membuat atau mengirim temporary password. Aktivasi/reset selalu memakai one-time link dan pengguna memilih password sendiri.

`is_default_password` dipertahankan selama kompatibilitas, tetapi source of truth target adalah `credential_state`. Mapping:

- `default`/`temporary` → `is_default_password = true`;
- `active` → `is_default_password = false`.

### 5.2 Status akun terpisah dari kredensial

Status login/keaktifan akun dan credential state adalah dua dimensi berbeda. Password aktif tidak mengaktifkan akun yang dinonaktifkan. Reset password juga tidak boleh mengubah status master dosen, status akun, role, capability, atau program kuliah.

### 5.3 Versioning kredensial

Setiap akun mempunyai `credential_version` integer positif. Semua access token/session menyimpan versi pada saat diterbitkan.

Versi dinaikkan ketika:

- password berhasil diganti;
- self-service reset berhasil;
- Admin menerbitkan reset/activation link untuk target non-privileged;
- akun ditandai compromised;
- tindakan keamanan mencabut seluruh sesi.

Middleware membandingkan token/session version dengan database pada setiap request. Versi berbeda menghasilkan `401 SESSION_REVOKED`.

### 5.4 State machine perubahan password

| Dari | Aksi | Menjadi | Dampak sesi |
| --- | --- | --- | --- |
| `default` | Ganti dengan password valid | `active` | Cabut seluruh sesi lama, buat sesi baru |
| `temporary` | Ganti dengan password valid | `active` | Cabut seluruh sesi lama, buat sesi baru |
| `active` | Ganti password biasa | `active` | Cabut seluruh sesi lama, buat sesi baru |
| Apa pun | Admin reset non-privileged berbasis link | activation-required tanpa membuat password baru | Cabut seluruh sesi dan reset token lama saat kebijakan reset dijalankan |
| Apa pun | Self-service reset dengan password pilihan pengguna | `active` | Cabut seluruh sesi dan reset token lama |

Self-service reset dan Admin activation/reset versi awal hanya menghasilkan one-time link. Sistem tidak membuat, menampilkan, melaporkan, atau mengirim temporary password. State `temporary` hanya dipertahankan untuk kompatibilitas akun legacy dan bukan write path baru.

### 5.5 Invariant global

1. Semua role memakai credential service dan middleware yang sama.
2. Restricted account hanya dapat memanggil change-password dan logout.
3. Flag dari JWT/frontend tidak pernah menjadi satu-satunya sumber credential state.
4. Password, hash, reset token, refresh token, dan secret tidak pernah dicatat pada log.
5. Password awal/temporary tidak dikembalikan oleh endpoint bisnis umum.
6. Tidak ada shared default literal/fallback pada production path.
7. Reset request selalu memberi response generik, terlepas akun ditemukan atau tidak.
8. Reset token random, hashed, single-use, purpose-bound, dan mempunyai expiry.
9. Token reset baru mencabut token reset aktif lama untuk account/purpose yang sama.
10. Consume token, update password, increment version, revoke sessions/token lain, dan audit berada dalam satu transaksi.
11. Password change biasa memverifikasi password saat ini.
12. Password baru tidak boleh sama dengan password saat ini.
13. Password input tidak di-trim atau diubah diam-diam.
14. Panjang input dibatasi sebelum bcrypt dan tidak boleh melebihi 72 byte UTF-8; batas karakter tambahan dapat diterapkan untuk resource abuse.
15. Logout saat ini mencabut sesi saat ini; logout-all mencabut seluruh sesi.
16. Account disabled tidak dapat login/reset menjadi aktif tanpa flow status akun.
17. Exact retry tidak membuat reset token, sesi, delivery, atau audit ganda.
18. Dua consume token paralel menghasilkan tepat satu keberhasilan.
19. Reset akun Admin/Sekprodi ditolak dan endpoint/capability-nya tidak dirilis sampai model otorisasi khusus disahkan dan diimplementasikan.
20. Recovery tidak mengubah role/capability/identitas akun.

## 6. Kontrak data target

### 6.1 Kolom keamanan akun

Tambahkan secara additive pada keempat tabel akun atau abstraksikan melalui repository keamanan yang konsisten:

- `credential_state`;
- `credential_version`, default 1;
- `password_changed_at`;
- `password_origin`: `initial`, `self_change`, `self_reset`, `admin_reset`, atau `migration`;
- `force_change_reason`, nullable;
- `security_updated_at`;
- `security_updated_by_type/id`, bila audit bersama belum mencukupi.
- `recovery_email_verified_at`, nullable, atau relasi kanal pemulihan terverifikasi yang ekuivalen.

Email pemulihan hanya eligible bila telah diverifikasi. Jika institusi memutuskan bahwa email institusi dari sumber akademik resmi otomatis dipercaya, keputusan tersebut harus tertulis, sumber/provenance harus tersimpan, dan waktu verifikasi diisi saat import/sinkronisasi. Email import biasa tidak boleh otomatis dianggap sah tanpa keputusan ini.

`is_default_password` tetap dual-write selama satu release kompatibilitas. Model hooks tidak boleh menjadi satu-satunya lokasi hashing; seluruh mutasi password diarahkan ke `CredentialService` agar transaction, versioning, session revocation, token revocation, dan audit selalu dijalankan.

### 6.2 Session registry

Buat `AuthSession`:

- UUID/session ID;
- `account_type` dan `account_id`;
- role/capability snapshot minimum;
- credential version;
- refresh-token hash bila refresh session digunakan;
- created, last-used, absolute expiry, dan idle expiry;
- revoked at/by/reason;
- hash/fingerprint IP dan user-agent secukupnya;
- remember-me flag;
- rotation family/reuse detection metadata.

Target session:

- access token berumur pendek;
- refresh/session token random tersimpan sebagai hash;
- browser menerima refresh token melalui cookie `HttpOnly`, `Secure`, dan `SameSite` yang sesuai;
- access token tidak disimpan jangka panjang di `localStorage`;
- endpoint mutasi berbasis cookie dilindungi CSRF sesuai arsitektur final.

Jika migrasi cookie belum dapat dilakukan dalam release yang sama, minimum aman tetap wajib: `sid` + `credential_version` pada JWT, lookup live setiap request, server-side revocation, access-token TTL dipendekkan, dan token lama tanpa claim baru ditolak saat cutover.

### 6.3 Reset token

Buat `PasswordResetToken`:

- ID;
- account type/ID;
- purpose `self_reset` atau `admin_activation`; purpose temporary credential tidak dipakai versi awal;
- selector opsional dan token hash/HMAC;
- requested/created/expires/used/revoked timestamps;
- revoked reason;
- request/delivery correlation ID;
- attempt count dan last attempted at;
- metadata risiko yang tidak menyimpan secret.

Token mentah tidak disimpan pada `PasswordResetToken`; tabel ini hanya menyimpan hash/HMAC. Gunakan random cryptographically secure dengan entropy memadai dan jangan memakai JWT access token sebagai reset token.

### 6.4 Delivery dan audit

Buat/adaptasi:

- `AuthOutbox` untuk email reset/activation;
- `AuthSecurityEvent` untuk login, failed login, password change, reset request/consume, Admin reset, session revoke, limiter, dan recovery conflict;
- `PasswordCredentialHistory` bila kebijakan melarang penggunaan kembali N password terakhir.

Mekanisme token-outbox versi awal ditetapkan sebagai berikut:

1. service membuat token mentah dan menyimpan hash/HMAC-nya pada `PasswordResetToken`;
2. pada transaksi database yang sama, service mengenkripsi token mentah khusus untuk payload `AuthOutbox` menggunakan authenticated encryption dan key delivery terpisah dari JWT/database key;
3. outbox hanya menyimpan ciphertext, key version, nonce/IV, authentication tag bila tidak melekat pada ciphertext, template ID, recipient reference, correlation ID, dan metadata non-rahasia minimum;
4. worker berizin mendekripsi hanya ketika mengklaim job untuk dikirim, membangun link dari frontend origin allowlist, lalu meredaksi token/link dari log dan telemetry;
5. ciphertext tidak pernah dikembalikan oleh API operasional biasa;
6. ciphertext dihapus setelah status terminal `sent`, `dead_letter`, `cancelled`, atau setelah retention gagal-kirim yang disahkan; hash pada `PasswordResetToken` tetap disimpan sesuai retention audit;
7. retry memakai ciphertext/job yang sama selama token masih berlaku dan tidak membuat token atau delivery baru;
8. rotasi key mempertahankan kemampuan dekripsi job aktif berdasarkan key version, dengan akses dibatasi pada producer/worker yang memerlukannya.

Dengan desain ini worker dapat mengirim token sementara database verifikasi tetap tidak menyimpan token mentah.
Job terminal yang ciphertext-nya sudah dihapus tidak dapat di-retry dengan token lama. Operasi recovery berikutnya harus membuat permintaan, token, hash, ciphertext, correlation ID, dan audit baru.

### 6.5 Token claims

Access token minimum:

```json
{
  "sub": "mahasiswa:123",
  "role": "mahasiswa",
  "sid": "uuid-session",
  "cv": 2,
  "jti": "uuid-token",
  "iss": "sima",
  "aud": "sima-api",
  "iat": 0,
  "exp": 0
}
```

Verifier mengunci algorithm allowlist, issuer, audience, expiry, session, credential version, dan account status. JWT secret/key wajib berasal dari secret manager/environment dan aplikasi production gagal start jika memakai fallback/default.

## 7. Password policy

Policy disediakan oleh service/config berversi, bukan hard-code per controller:

- minimum length ditetapkan pemilik keamanan; rekomendasi awal minimal 10–12 karakter;
- maksimum absolut 72 byte UTF-8 sebelum bcrypt; input yang melampaui batas ditolak, bukan dipotong;
- menolak password sama dengan password lama;
- opsional menolak N hash histori terakhir;
- menolak password yang sangat umum/terkompromi bila dataset/service tersedia;
- menolak password yang identik dengan username/email/NIM/NIK;
- tidak mewajibkan pola komposisi rumit tanpa keputusan kebijakan;
- mendukung password manager dan paste;
- confirmation hanya validasi frontend; backend menerima satu password baru;
- hashing cost berasal dari konfigurasi dan dapat direhash saat login bila cost berubah.

Password dihitung menggunakan `Buffer.byteLength(password, 'utf8')` atau ekuivalennya sebelum bcrypt. Password tidak di-trim, dipotong, atau dinormalisasi Unicode secara diam-diam sehingga byte yang divalidasi sama dengan byte yang di-hash.

Policy error mengembalikan reason code tanpa mengungkap hash/history:

- `PASSWORD_TOO_SHORT`;
- `PASSWORD_TOO_LONG`;
- `PASSWORD_SAME_AS_CURRENT`;
- `PASSWORD_RECENTLY_USED`;
- `PASSWORD_TOO_COMMON`;
- `PASSWORD_CONTAINS_IDENTIFIER`.

## 8. Workflow target

### 8.1 Login akun default/sementara

```text
Login dengan credential benar
  → server membuat session restricted
  → response: credential_state + next_action=change_password
  → frontend membuka forced change route
  → API bisnis mengembalikan 403 PASSWORD_CHANGE_REQUIRED
  → change password sukses
  → version naik, semua session lama revoked
  → session/token baru diterbitkan
  → akses role normal dibuka
```

Login tidak perlu ditolak karena pengguna membutuhkan jalur untuk mengganti password. Restricted session tidak mempunyai akses profile, notification, upload, dashboard, atau endpoint bisnis lain.

### 8.2 Ganti password terautentikasi

1. autentikasi session dan izinkan endpoint meskipun restricted;
2. rate-limit per account/session/IP;
3. kunci account security row;
4. verifikasi credential version/session masih aktif;
5. verifikasi password lama;
6. validasi password baru;
7. hash melalui credential service;
8. update state `active`, waktu, origin, dan version;
9. revoke seluruh session/reset token aktif;
10. buat audit;
11. commit;
12. buat session baru dan kembalikan kontrak auth baru.

Response tidak hanya meminta frontend mengubah flag lokal. Frontend mengganti session dari response server atau login ulang.

### 8.3 Forgot password

1. client mengirim email/identifier recovery yang didukung;
2. normalisasi input dan terapkan rate limit;
3. response selalu generik, misalnya `202`;
4. bila account valid, statusnya boleh dipulihkan, dan kanal recovery terverifikasi, revoke token reset aktif lama;
5. buat token baru + hash + expiry;
6. enqueue delivery outbox;
7. audit request tanpa menyimpan token;
8. worker mengirim link ke origin frontend allowlist;
9. delivery gagal masuk retry/dead-letter dan metric.

Response, status HTTP, ukuran pesan, dan perilaku waktu dibuat semirip praktis antara account ada/tidak ada. Endpoint tidak menyebut role atau status account.

### 8.4 Validasi dan consume reset token

Validasi token menggunakan `POST` dengan token di request body, bukan query string atau path URL. Halaman frontend harus segera membersihkan fragmen/data bootstrap dari address bar dan tidak mengirim token ke analytics, referrer, error reporter, atau log. Endpoint validasi hanya mengembalikan status generik valid/invalid/expired tanpa informasi account sensitif. Saat confirm:

1. hash token dan cari record aktif;
2. kunci reset token serta account;
3. validasi purpose, expiry, used/revoked, attempt, dan account state;
4. validasi password baru;
5. consume token satu kali;
6. update hash/state/version;
7. revoke seluruh reset token lain dan session;
8. buat audit;
9. commit;
10. arahkan login atau buat session baru sesuai kebijakan.

### 8.5 Reset oleh Admin

Versi awal hanya menyediakan penerbitan one-time activation/reset link untuk target non-privileged yang diizinkan aturan otorisasi. Admin tidak melihat password lama, password baru, hash, atau token. Tidak ada temporary password buatan Admin.

Reset akun Admin/Sekprodi ditunda. Route, tombol, dan capability untuk target privileged tidak boleh diaktifkan sebelum tersedia tabel/aturan capability yang eksplisit, object-level authorization, audit, dan keputusan step-up/four-eyes. Pemeriksaan role ad hoc di controller tidak dianggap memenuhi syarat ini.

### 8.6 Logout

- `logout` mencabut `sid` saat ini dan membersihkan cookie/client state;
- `logout-all` menaikkan/revoke security sessions untuk seluruh perangkat;
- restricted account tetap dapat logout;
- endpoint idempotent;
- refresh-token replay setelah logout ditolak dan dicatat.

## 9. Enforcement backend

Middleware order:

```text
authenticate credential
  → verify token cryptography/claims
  → load session + live account security
  → validate account active + credential version
  → enforce credential restriction
  → authorize role/capability/object
  → controller
```

Route change-password dan logout ditandai eksplisit `allowDuringCredentialRestriction`. Jangan mengandalkan pencocokan substring URL. Public login/forgot/reset berada di luar restricted session tetapi memiliki limiter sendiri.

Response restricted minimum:

```json
{
  "success": false,
  "code": "PASSWORD_CHANGE_REQUIRED",
  "message": "Password awal/sementara harus diganti terlebih dahulu.",
  "next_action": "change_password"
}
```

Middleware diterapkan pada root API/router sehingga route baru otomatis dilindungi. Test inventaris route memastikan tidak ada router bisnis yang terlewat.

## 10. Rencana pengerjaan

### Paket 0 — Baseline, keputusan, dan penutupan bypass

1. Inventaris seluruh account creation, import, seeder, login, change password, token issuance, dan response yang memuat credential.
2. Hapus/deprecate `/login-mahasiswa-email` sebelum feature enforcement aktif.
3. Hapus login otomatis yang membaca `default_password` dari response pendaftaran.
4. Hapus fallback JWT secret dan password literal dari production path.
5. Pastikan seeder demo tidak dapat berjalan di production dan seluruh nilai berasal dari config development yang eksplisit.
6. Tentukan delivery channel, token expiry, password policy, session TTL, remember-me, trusted recovery source, dan retention; catat reset privileged account sebagai fitur yang ditunda.
7. Buat characterization test login/change-password keempat role.
8. Catat baseline migration, test, build, dan security scan secret.

Hasil: tidak ada jalur autentikasi tanpa secret pengguna yang merusak enforcement baru.

### Gate 6A — Tutup bypass, forced-change, credential state, dan JWT hardening

Gate 6A terdiri dari Paket 0–3, Paket 5–6 untuk enforcement/change password, bagian JWT hardening Paket 4 yang tidak bergantung pada session registry, Paket 11 untuk forced route, serta kontrak/test terkait. Session registry dan recovery belum diaktifkan pada gate ini.

### Paket 1 — Migration state keamanan

1. Tambahkan kolom Bagian 6.1 pada empat tabel akun.
2. Pada 6A, tambahkan credential/security event dan optional password history; tabel session dibuat pada 6B, sedangkan reset token/outbox dibuat pada 6C.
3. Tambahkan unique/index sesuai gate ketika tabel terkait diperkenalkan.
4. Backfill credential state dari `is_default_password`.
5. Backfill version 1 dan password changed timestamp bila dapat ditentukan.
6. Data ambigu ditandai manual review; jangan otomatis menganggap active.
7. Pertahankan dual-read/write satu release.

Hasil: semua role mempunyai state yang dapat diverifikasi dan dicabut.

### Paket 2 — Account security repository

Buat resolver tunggal:

```text
resolveAccount({ accountType, accountId })
resolveAccountByLoginIdentifier(identifier)
resolveRecoveryAccounts(normalizedEmail)
getAccountSecurityState()
```

Aturan:

- identifier dinormalisasi sesuai tipe tanpa mengubah password;
- query memilih atribut security konsisten untuk empat model;
- role/capability tidak dipercaya hanya dari token;
- email yang cocok ke beberapa account tidak dipilih diam-diam;
- pasangan Dosen–Sekprodi dengan NIK dan email yang sama, jabatan kedua akun yang sah, serta program kuliah yang sama diperlakukan sebagai alias satu identitas: akun Dosen menjadi login utama, capability Sekprodi dan `sekretaris_prodi_id` berasal dari akun pasangan, serta resolusi dicatat sebagai `IDENTITY_ALIAS_RESOLVED`;
- kombinasi kandidat selain alias sah tersebut ditolak secara generik sebagai `IDENTIFIER_AMBIGUOUS` dan tidak pernah mengekspos role, ID, atau identifier kandidat pada response publik;
- rekonsiliasi mencatat alias sehat pada bagian `informational`; hanya collision sebenarnya yang menambah `total_findings`;
- recovery collision ditangani dengan delivery aman per account atau manual recovery, tanpa membocorkan lewat response;
- status account diperiksa untuk semua role.

### Paket 3 — Credential service dan password policy

Implementasikan:

- `verifyPassword()`;
- `validateNewPassword()`;
- `changePassword()`;
- `setPasswordFromReset()`;
- `issueActivationResetLink()` tanpa membuat password sementara;
- `revokeAllCredentials()`;
- `rehashIfNeeded()`.

Service memiliki transaksi, row lock, hashing, state/version update, session/reset revocation sesuai gate, dan audit. Endpoint mahasiswa lama menjadi adapter sementara lalu dihapus. Validator menolak password di atas 72 byte UTF-8 sebelum memanggil bcrypt.

### Paket 4 — Session service dan token hardening

1. Hilangkan fallback secret; validasi key saat startup.
2. Gunakan claim standar, algorithm allowlist, issuer, audience, `sid`, `cv`, dan `jti`.
3. Buat session registry dan current/all-session revoke.
4. Pendekkan access-token TTL dan implementasikan refresh rotation bila dipilih.
5. Deteksi reuse refresh token dan revoke token family.
6. Migrasikan penyimpanan browser sesuai target HttpOnly/memory.
7. Rotasi signing key/cutover sehingga token legacy tanpa session/version tidak berlaku.

Penghapusan fallback secret, startup validation, algorithm allowlist, issuer, audience, dan expiry masuk Gate 6A. Session registry, `sid`, refresh rotation, logout, logout-all, dan revocation server-side masuk Gate 6B.

### Paket 5 — Middleware forced change

1. Refactor `authenticateToken` menjadi async/await yang konsisten.
2. Load session dan state akun untuk setiap role.
3. Tambahkan `enforceCredentialState` pada root protected API.
4. Allowlist hanya change-password dan logout menggunakan route metadata.
5. Response memakai code/next action stabil.
6. Route baru protected secara default.
7. Tambahkan route inventory test untuk seluruh router.

Hasil: URL langsung/cURL tidak dapat melewati forced change.

### Paket 6 — Change password lintas role

1. Gunakan satu endpoint/service kanonik.
2. Validasi old password dan policy baru.
3. Lock account dan tangani dua request paralel.
4. Ubah state menjadi active dan increment version.
5. Revoke semua session/reset token.
6. Terbitkan session baru atau minta login ulang sesuai keputusan.
7. Audit tanpa password.
8. Hapus duplikasi endpoint role setelah consumer dimigrasikan.

Pada 6A, perubahan password wajib menaikkan `credential_version` dan menolak token versi lama sejauh mekanisme cutover 6A mendukung. Gate 6B menyelesaikan pencabutan session server-side dan logout-all secara penuh.

### Gate 6B — Session registry, logout, dan revocation

Gate 6B menyelesaikan Paket 4 dan bagian session/revocation pada Paket 6, lalu mengaktifkan:

- `AuthSession` dan live lookup untuk semua role;
- logout current dan logout-all yang benar-benar mencabut sesi;
- invalidasi session/token setelah change password atau perubahan status keamanan;
- access-token TTL pendek dan refresh rotation bila arsitektur refresh dipilih;
- migrasi penyimpanan browser dari token jangka panjang di `localStorage`/`sessionStorage`;
- pengujian replay, stale credential version, concurrent revoke, dan session-store failure.

Gate 6B harus lulus sebelum endpoint forgot/reset, outbox recovery, atau Admin activation/reset dapat diaktifkan.

### Gate 6C — Recovery, delivery, dan Admin activation/reset non-privileged

### Paket 7 — Forgot/reset password

1. Buat request, validate, dan confirm endpoint; validate wajib `POST` dan menerima token pada body.
2. Gunakan response generik dan limiter.
3. Generate token CSPRNG; simpan hash saja.
4. Link memakai frontend origin allowlist, bukan Host header mentah.
5. Consume atomik, single-use, purpose-bound, dan expiry.
6. Password reset menaikkan version serta mencabut session/token lain.
7. Retry request tidak menggandakan delivery dalam cooldown/idempotency scope.
8. Audit request/delivery/consume/failure.
9. Hanya account dengan kanal recovery terverifikasi yang boleh menerima link.
10. Jangan memasukkan token ke query URL endpoint API, access log, analytics, referrer, atau error telemetry.

### Paket 8 — Delivery adapter dan worker

1. Definisikan interface email/notification provider.
2. Simpan hash token dan ciphertext token outbox dalam transaksi token creation yang sama.
3. Enkripsi token menggunakan authenticated encryption serta delivery key terpisah dan berversi.
4. Worker memakai claim/lease, mendekripsi saat pengiriman, retry exponential, max attempt, dan dead-letter.
5. Hapus ciphertext setelah status terminal/retention gagal-kirim yang disahkan; pertahankan hash reset token sesuai retention audit.
6. Template tidak mengandung password dan tidak menyebut apakah request dipicu Admin bila tidak diperlukan.
7. Jangan log link/token/ciphertext/key material.
8. Sediakan sink development yang aman dan tidak aktif di production.
9. Monitoring delivery failure tanpa menampilkan recipient lengkap.

### Paket 9 — Admin activation/reset non-privileged dan lifecycle akun awal

1. Ganti shared default hanya dengan one-time activation link; jangan membuat temporary password.
2. Import/create account tidak mengembalikan password pada response umum.
3. Admin memilih target melalui object-level authorization.
4. Penerbitan reset link mencabut session/token sesuai kebijakan dan menandai activation-required tanpa membuat password.
5. Tolak target Admin/Sekprodi secara default; jangan sediakan permission semu atau pemeriksaan controller ad hoc.
6. Implementasi reset target privileged menjadi tahap lanjutan setelah capability khusus dan aturan approval tersedia.
7. Bulk activation/reset ditunda dari versi awal kecuali kebutuhan dan kontrolnya disahkan terpisah; secret tidak boleh masuk report.
8. Buat audit target, actor, reason, method, dan delivery status.

### Paket 10 — Rate limiting dan abuse protection

Limiter minimum:

- login per IP dan normalized account key;
- forgot request per IP dan recovery key;
- reset validation/confirm per token selector dan IP;
- change password per account/session/IP;
- Admin reset per actor/target;
- refresh token per session/family.

Gunakan store terdistribusi untuk multi-instance. Konfigurasi trusted proxy harus eksplisit agar IP tidak dapat dipalsukan. Gunakan backoff/temporary lock yang tidak membuat permanent account denial-of-service. Response login/reset tetap tidak mengungkap apakah limiter terkait account valid.

### Paket 11 — Frontend forced route semua role

1. Guard berada di root App/router, bukan hanya Dashboard mahasiswa.
2. Gunakan credential state/next action dari server.
3. Ketika restricted, render hanya halaman ganti password dan logout.
4. Jangan render sidebar, dashboard, notification fetch, profile fetch, atau prefetch bisnis.
5. Guard tidak dapat ditutup dan tidak bergantung toast.
6. Interceptor menangani `PASSWORD_CHANGE_REQUIRED` dari URL/request langsung.
7. Setelah sukses, ganti session dari response server; jangan hanya mengubah flag storage.
8. Multi-tab menerima logout/version change melalui BroadcastChannel/storage event sesuai arsitektur session.
9. Halaman forgot/reset tidak menampilkan status keberadaan akun.

### Paket 12 — API dan kontrak error

Endpoint target:

```text
POST /api/auth/login
POST /api/auth/change-password
POST /api/auth/logout
POST /api/auth/logout-all
POST /api/auth/refresh
POST /api/auth/password/forgot
POST /api/auth/password/reset/validate
POST /api/auth/password/reset/confirm
GET  /api/auth/sessions
DELETE /api/auth/sessions/:id

POST /api/admin/accounts/:type/:id/reset-link
GET  /api/admin/security-events
GET  /api/admin/auth-outbox/failed
POST /api/admin/auth-outbox/:id/retry
```

Endpoint refresh/sessions digunakan hanya setelah Gate 6B aktif. Endpoint forgot/reset dan Admin reset-link tetap feature-off sampai Gate 6C lulus. Endpoint target Admin/Sekprodi harus menolak secara eksplisit dan tidak dianggap tersedia sebelum capability khusus diimplementasikan. Jangan menyediakan endpoint tanpa implementasi revocation utuh.

Error code minimum:

- `PASSWORD_CHANGE_REQUIRED`;
- `INVALID_CURRENT_PASSWORD`;
- `PASSWORD_POLICY_VIOLATION` + detail reason aman;
- `SESSION_REVOKED`;
- `SESSION_EXPIRED`;
- `RESET_TOKEN_INVALID`;
- `RESET_TOKEN_EXPIRED`;
- `RESET_TOKEN_USED`;
- `RESET_REQUEST_ACCEPTED`;
- `AUTH_RATE_LIMITED`;
- `ACCOUNT_RECOVERY_UNAVAILABLE` hanya pada kanal Admin terotorisasi, bukan public response.

### Paket 13 — Audit, monitoring, dan rekonsiliasi

Rekonsiliasi dry-run/execute mendeteksi:

- `is_default_password` tidak konsisten dengan credential state;
- credential version null/tidak valid;
- account tanpa password hash valid;
- account active yang hash-nya cocok dengan daftar legacy shared default yang disetujui untuk audit;
- session active dengan version lama/account disabled;
- reset token aktif yang expired/used;
- beberapa reset token aktif pada purpose sama;
- outbox delivery tertinggal/gagal;
- password literal/default pada source/config/seeder production;
- JWT secret fallback/default;
- endpoint protected yang tidak memakai middleware;
- response/schema yang masih memuat `default_password`;
- security event yang kehilangan actor/target/correlation.

Pemeriksaan hash legacy dilakukan di proses terkontrol tanpa mencetak candidate maupun hash. Account terdampak ditandai force-change/recovery sesuai runbook, bukan password-nya diubah diam-diam tanpa pemberitahuan.

## 11. Strategi pengujian

### 11.1 Unit test

- mapping credential state dan legacy flag;
- password policy boundary termasuk Unicode, tepat 72 byte UTF-8, dan lebih dari 72 byte;
- credential version increment;
- reset token hash/expiry/purpose;
- session/revocation evaluator;
- allowed route metadata;
- recovery collision resolver;
- limiter key normalization;
- log redaction.

### 11.2 Integration test forced change

Untuk mahasiswa, dosen, Admin, dan Sekprodi:

1. login default/sementara berhasil dan menghasilkan restricted session;
2. change-password dan logout diizinkan;
3. profile, dashboard, notification, upload, review, dan endpoint bisnis ditolak;
4. direct URL/cURL tetap ditolak;
5. capability Sekprodi pada akun dosen tidak melewati restriction;
6. perubahan flag frontend/token claim tidak membuka akses;
7. route baru tanpa metadata tetap protected;
8. account disabled tetap ditolak walaupun restricted credential valid.

### 11.3 Integration test change password dan sesi

1. old password salah ditolak dan dilimit.
2. Password policy konsisten semua role.
3. Password baru sama/recent ditolak sesuai policy.
4. Sukses mengubah state/version/cache legacy secara atomik.
5. Seluruh token/session lama ditolak setelah commit.
6. Session baru dapat mengakses sesuai role.
7. Dua request paralel hanya satu berhasil.
8. Kegagalan operasi database sebelum commit me-rollback seluruh perubahan. Kegagalan penerbitan response/session baru setelah commit tidak mengembalikan password lama; pengguna diminta login ulang.
9. Logout current tidak mencabut session lain; logout-all mencabut semuanya.
10. Refresh reuse terdeteksi bila refresh architecture aktif.

### 11.4 Integration test forgot/reset

1. Account ada/tidak ada memperoleh public response generik yang sama.
2. Email collision tidak membocorkan role/account.
3. Email belum terverifikasi tidak menerima link, tetapi public response tetap generik.
4. Email institusi hasil sumber akademik hanya eligible bila provenance/keputusan trusted-source dan waktu verifikasinya tersimpan.
5. Token plaintext tidak tersimpan/log; reset-token table hanya menyimpan hash dan outbox hanya menyimpan ciphertext.
6. Worker dapat mendekripsi ciphertext yang valid; ciphertext/key version rusak gagal aman tanpa membocorkan token.
7. Ciphertext dihapus pada status terminal sesuai retention, sementara hash reset token tetap tersedia sesuai audit retention.
8. Token expired, revoked, wrong purpose, malformed, dan used ditolak.
9. Dua consume paralel menghasilkan satu sukses.
10. Request baru mencabut token lama.
11. Reset mencabut seluruh session dan menaikkan version.
12. Self-reset user-chosen menghasilkan state `active`.
13. Delivery failure dapat di-retry tanpa token/delivery ganda.
14. Reset link tidak memakai Host header penyerang.
15. Validasi memakai POST body; token tidak muncul pada query/path, access log, analytics, atau referrer.
16. Rate limit berlaku tanpa account enumeration.

### 11.5 Integration test Admin activation/reset dan akun awal

1. Admin berizin dapat menerbitkan reset-link target non-privileged dengan alasan/audit.
2. Target Admin/Sekprodi selalu ditolak selama capability khusus belum tersedia.
3. Route/tombol privileged reset tidak tersedia dan role check ad hoc tidak dapat mengaktifkannya.
4. Admin tidak melihat password lama/baru, hash, token, atau ciphertext.
5. Activation/reset link unik dan one-time; tidak ada temporary password.
6. Response create/import tidak memuat default password.
7. Reset tidak mengubah role/status/capability target.

### 11.6 Frontend test

- forced page berlaku untuk empat role;
- sidebar/content/prefetch tidak dirender ketika restricted;
- toast dapat ditutup tanpa membuka akses;
- refresh/deep link tetap ke forced route;
- response backend restricted memindahkan UI;
- sukses memakai session baru, bukan flag lokal;
- logout multi-tab konsisten;
- forgot selalu menampilkan pesan generik;
- reset invalid/expired tidak membocorkan account;
- reset token tidak tertinggal pada address bar/history/referrer/analytics;
- password manager dan paste berfungsi.

### 11.7 Security test

- secret scan source, history release, config example, dan build artifact;
- JWT `alg`/issuer/audience/expiry/claim tampering;
- token/session fixation dan replay;
- reset token brute force/race;
- rate-limit bypass melalui header/proxy;
- CSRF bila cookie digunakan;
- XSS impact/storage review;
- log/telemetry redaction;
- response account enumeration;
- open redirect pada reset link;
- timing comparison secara praktis;
- dependency/security scanner sesuai pipeline proyek.

### 11.8 UAT minimum

1. Mahasiswa import pertama kali mengganti password.
2. Dosen baru mengganti password.
3. Admin dan Sekprodi default tidak dapat membuka workspace.
4. Forgot password account valid.
5. Forgot password email tidak dikenal memberi response sama.
6. Token reset expired dan reused.
7. Admin menerbitkan reset-link mahasiswa/dosen tanpa melihat credential.
8. Reset Admin/Sekprodi tetap tidak tersedia sebelum capability khusus.
9. Logout satu perangkat dan seluruh perangkat.
10. Account dinonaktifkan dengan session aktif.
11. Migrasi account legacy shared default.
12. Delivery email gagal lalu retry.

## 12. Urutan implementasi dan dependensi

| Urutan | Gate/pekerjaan | Dependensi | Exit criteria ringkas |
| --- | --- | --- | --- |
| 1 | **6A** — Paket 0, credential schema/repository/service, JWT hardening dasar, forced middleware, change-password, root frontend guard, kontrak API dan rekonsiliasi 6A | keputusan credential/password policy dan secret production | bypass login/paparan credential/fallback secret tertutup; forced-change empat role lulus melalui UI dan direct API |
| 2 | Stabilkan dan observasi 6A | build, migration, integration/security/UAT 6A | tidak ada route bypass atau token legacy yang tidak tertangani |
| 3 | **6B** — session schema/service, `sid`/version lookup, logout/logout-all, server-side revocation, storage/token migration | 6A stabil | stale/revoked session selalu ditolak; logout/replay/concurrency/session failure test lulus |
| 4 | Stabilkan dan observasi 6B | integration/security/UAT 6B | server-side revocation dan runbook session terbukti operasional |
| 5 | **6C** — verified recovery channel, limiter, reset token, encrypted outbox, worker/provider, forgot/reset, Admin reset-link non-privileged | 6B stabil; provider, delivery key, limiter store, dan retention siap | token aman dan single-use; delivery/retry/dead-letter teruji; tidak ada enumeration; privileged reset tetap tertutup |
| 6 | Rekonsiliasi dan finalisasi Tahap 6 | seluruh gate lulus | constraint final, build, seluruh test, observability, runbook, dan UAT lulus |

Paket 10 (limiter) untuk login/change-password harus masuk 6A. Bagian limiter session masuk 6B. Limiter forgot/reset dan Admin reset-link wajib selesai sebelum 6C diaktifkan. Paket 11–13 dikerjakan per irisan gate, bukan menunggu seluruh backend selesai.

## 13. Strategi deployment

1. Backup database dan simpan baseline test/build sebelum setiap gate.
2. **Rilis 6A:** rotasi/hapus secret/default credential yang diketahui; validasi production fail-closed; hapus email-login bypass dan paparan default password; deploy/backfill credential state/version; jalankan middleware report-only; perbaiki route; deploy root frontend guard; lalu aktifkan forced-change.
3. Observasi 6A dan jangan melanjutkan jika terdapat route bypass, migration mismatch, atau login regression.
4. **Rilis 6B:** deploy session registry dan claim baru; migrasikan storage/token client; paksa login ulang token legacy; lalu aktifkan logout, logout-all, dan revocation.
5. Observasi 6B dan buktikan stale/revoked session, refresh replay, serta perubahan password tidak meninggalkan sesi aktif.
6. **Persiapan 6C dalam feature-off:** deploy recovery verification data, reset token, encrypted outbox, delivery key, limiter, worker, template, dan endpoint tanpa membuka akses publik.
7. Jalankan end-to-end delivery pada environment aman, termasuk decrypt, retry, dead-letter, ciphertext cleanup, redaction, dan consume concurrency.
8. **Aktifkan 6C** hanya setelah 6B stabil dan seluruh dependency delivery/limiter lulus; aktifkan forgot/reset dan Admin reset-link hanya untuk target non-privileged.
9. Jangan aktifkan reset Admin/Sekprodi. Fitur tersebut membutuhkan proyek/keputusan lanjutan untuk capability dan approval khusus.
10. Paksa recovery pada account legacy yang menggunakan shared default melalui activation/reset link.
11. Hentikan dual-write legacy setelah sedikitnya satu release stabil dan rekonsiliasi bersih.

Rollback enforcement dapat mengubah middleware dari enforce ke report-only dalam keadaan darurat, tetapi tidak boleh menghidupkan kembali bypass login, secret lama, session revoked, atau token reset yang sudah consumed.

## 14. Observability dan runbook

Metric minimum:

- login success/failure/rate-limited per role tanpa identifier mentah;
- restricted request count per route group;
- password change success/failure;
- active/revoked/expired session;
- forgot request dan reset consume outcome;
- reset token expired/replay;
- delivery queued/sent/failed/dead-letter/age;
- Admin reset dan privileged reset attempt;
- credential state distribution dan legacy mismatch;
- token version mismatch/reuse detection.

Alert minimum:

- lonjakan failed login/reset;
- reset token replay;
- outbox/dead-letter menumpuk;
- production memakai fallback secret/config;
- middleware lookup gagal;
- account privileged di-reset;
- route protected tidak terinventarisasi.

Runbook minimum:

- email reset tidak terkirim;
- user kehilangan akses email;
- account compromised;
- shared default ditemukan;
- JWT signing key rotation;
- session store unavailable;
- limiter store unavailable;
- Admin/Sekprodi terkunci;
- recovery collision email lintas account;
- rollback enforcement tanpa membuka bypass.

## 15. Definition of Done Tahap 6

### 15.1 Gate 6A selesai apabila

- login mahasiswa tanpa password, fallback JWT secret, dan paparan password awal sudah dihapus;
- credential state/version dan legacy mapping konsisten untuk empat role;
- akun default/legacy temporary hanya dapat change-password dan logout melalui UI maupun direct API;
- frontend root guard berlaku bagi mahasiswa, dosen, Admin, dan Sekprodi;
- JWT production fail-closed dan memverifikasi algorithm, issuer, audience, expiry, serta versi kredensial sesuai kontrak 6A;
- password policy lintas role menolak input lebih dari 72 byte UTF-8 sebelum bcrypt tanpa trim/truncation/normalisasi diam-diam;
- limiter login/change-password, migration, characterization, integration, frontend, security test, build, observability, dan rollback 6A lulus.

### 15.2 Gate 6B selesai apabila

- setiap session mempunyai registry/identifier dan diperiksa terhadap live account serta credential version;
- logout, logout-all, change password, status keamanan, dan revocation benar-benar menolak session/token lama;
- token jangka panjang tidak lagi disimpan di `localStorage`/`sessionStorage` sesuai arsitektur target;
- token legacy telah diputus pada cutover;
- replay, concurrency, session-store failure, refresh rotation/reuse bila digunakan, integration/security test, observability, dan runbook 6B lulus.

### 15.3 Gate 6C selesai apabila

- 6A dan 6B telah dinyatakan stabil sebelum feature flag recovery diaktifkan;
- forgot/reset hanya mengirim ke kanal pemulihan terverifikasi atau trusted-source yang keputusan/provenance-nya tercatat;
- validasi reset memakai POST body dan token tidak masuk query/path, browser history, access log, analytics, referrer, atau error telemetry;
- `PasswordResetToken` hanya menyimpan hash/HMAC, sedangkan outbox menyimpan token terenkripsi dengan delivery key terpisah dan berversi;
- worker dapat mendekripsi saat kirim, melakukan retry/dead-letter, serta menghapus ciphertext setelah status terminal/retention;
- limiter, generic response, single-use/race-safe consume, session revocation, delivery/redaction, integration/security test, UAT, observability, dan runbook 6C lulus;
- Admin hanya dapat menerbitkan activation/reset link target non-privileged yang diizinkan dan tidak pernah menerima password/token;
- reset Admin/Sekprodi tetap tidak tersedia sampai capability khusus benar-benar diimplementasikan.

### 15.4 Tahap 6 selesai apabila

Seluruh gate 6A–6C telah lulus dan:

- keempat role dengan credential default/temporary hanya dapat change-password dan logout;
- enforcement berlaku pada root backend dan frontend;
- direct API/deep link tidak dapat melewati restriction;
- login via email tanpa password sudah dihapus;
- tidak ada fallback JWT secret/shared default pada production path;
- password awal/temporary tidak muncul pada response bisnis, log, report, atau browser storage;
- credential state/version menjadi sumber kebenaran dan legacy flag konsisten;
- change/reset password mencabut seluruh session/token lama secara atomik;
- logout current/all benar-benar mencabut session server-side;
- password policy terpusat dan berlaku semua role;
- forgot/reset tidak membocorkan account;
- reset token hashed, single-use, expiring, purpose-bound, dan race-safe;
- delivery mempunyai encrypted outbox, retry, dead-letter, ciphertext cleanup, key rotation, dan redaction;
- Admin reset-link target non-privileged terotorisasi, ter-audit, dan tidak mengungkap credential;
- reset tidak mengubah role atau status account;
- limiter/backoff melindungi seluruh endpoint autentikasi;
- token cryptography/claims/session/account live state diverifikasi;
- frontend tidak hanya mengubah prompt flag lokal setelah sukses;
- rekonsiliasi tidak menemukan bypass route, fallback secret, exposed default password, stale session, atau reset token invalid yang belum ditangani;
- unit, integration, authorization, concurrency, frontend, security test, build, dan UAT lulus;
- aturan bisnis, konfigurasi, API, backend, frontend, template email, runbook, dan dokumentasi menyatakan flow yang sama.

## 16. Keputusan yang perlu dikunci

| Keputusan | Sikap rancangan |
| --- | --- |
| Cara aktivasi akun awal | **Dikunci untuk versi awal:** one-time activation link; tidak ada shared default atau temporary password baru |
| Self-service reset menghasilkan active atau temporary | **Dikunci untuk versi awal:** pengguna memilih password melalui link dan state menjadi `active`; `temporary` hanya kompatibilitas legacy |
| Password policy | Minimum length, maksimum absolut 72 byte UTF-8 sebelum bcrypt, history, common-password check, dan hashing cost wajib dikonfigurasi/disahkan |
| Reset token expiry | Harus dikonfigurasi; rekomendasi waktu singkat dan tidak dapat diperpanjang setelah dibuat |
| Delivery channel | Hanya email/kanal terverifikasi; trusted email institusi harus mempunyai keputusan eksplisit, provenance, dan timestamp verifikasi |
| Token pada outbox | **Dikunci:** hash/HMAC pada reset-token table; ciphertext authenticated-encryption pada outbox; delivery key terpisah/bersistem versi; ciphertext dihapus setelah terminal/retention |
| Session architecture | Target HttpOnly refresh/session cookie + short-lived access token; minimum transisi tetap wajib server-side sid/version revocation |
| Remember me | Menambah refresh absolute expiry, bukan access token panjang di localStorage |
| Session setelah change/reset | Rekomendasi cabut semua dan terbitkan satu session baru atau minta login ulang |
| Admin reset privileged account | **Ditunda:** route/capability reset Admin/Sekprodi tidak dirilis sampai capability khusus, object authorization, audit, dan keputusan step-up/four-eyes tersedia |
| Password history | Opsional tetapi harus konsisten lintas role bila diaktifkan |
| Account tanpa email valid | Tidak dipulihkan lewat public reset; gunakan SOP Admin terotorisasi |
| Email sama pada beberapa account | Jangan pilih diam-diam atau bocorkan; tetapkan delivery per account atau manual recovery |
| Rate-limit thresholds/store | Konfigurasi environment dan store terdistribusi untuk multi-instance |
| Retention session/reset/audit | Mengikuti kebijakan keamanan dan privasi institusi |

Keputusan baru wajib memperbarui `aturan-bisnis-simps.md`, konfigurasi, migration, middleware, credential/session service, frontend, test, email template, runbook, dan dokumen ini dalam perubahan yang sama.
