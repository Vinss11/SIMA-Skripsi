# Runbook cutover autentikasi Tahap 6

1. Jalankan seluruh migration dan `npm run reconcile:stage6-auth-security:dry-run`.
2. Backup database dan verifikasi bahwa NIM Mahasiswa, tipe akun Dosen, serta provenance provisioning Admin valid sebelum membentuk credential awal.
3. Jalankan rekonsiliasi credential awal dalam mode dry-run. Laporan wajib memisahkan:

   - Dosen `default` yang akan di-hash ulang ke `12345678`;
   - Mahasiswa `default` yang akan di-hash ulang ke NIM masing-masing;
   - Admin baru/default yang terbukti belum menyelesaikan forced change dan akan di-hash ulang ke `12345678` melalui approval per target;
   - akun `active` yang tidak boleh diubah;
   - akun privileged ambigu atau akun tanpa identifier yang harus ditinjau manual dan tidak boleh diproses massal.

4. Setelah laporan disetujui, jalankan mode execute idempoten. Untuk setiap akun yang benar-benar berubah, service menaikkan `credential_version`, mencabut session/reset token, mengisi `password_origin=institutional_default`, mengisi forced-change reason, dan membuat audit. Password maupun hash tidak boleh masuk report/log.
5. Smoke test minimum:

   - setiap NIM yang terisi dan belum ada dapat menyelesaikan bootstrap pendaftaran pertama; akun, credential default, dan pendaftaran terbentuk tanpa password/hash pada response;
   - kegagalan bootstrap tidak meninggalkan akun atau pendaftaran parsial, sedangkan NIM existing tidak dapat diambil alih melalui bootstrap;
   - Dosen default login dengan `12345678`, hanya memperoleh restricted session, lalu wajib mengganti password;
   - Mahasiswa default login menggunakan NIM sebagai username dan password, hanya memperoleh restricted session, lalu wajib mengganti password;
   - Admin baru/default dengan provenance valid login menggunakan `12345678`, hanya memperoleh restricted session, lalu wajib mengganti password;
   - endpoint bisnis mengembalikan `PASSWORD_CHANGE_REQUIRED` sebelum forced change selesai;
   - setelah perubahan password, credential awal dan seluruh session lama tidak berlaku.

6. Email recovery tetap opsional sebagai jalur self-service. Aktifkan hanya setelah `AUTH_DELIVERY_KEY`, `AUTH_FRONTEND_ORIGIN`, provider webhook, worker, dan monitoring tersedia. Set `AUTH_RECOVERY_ENABLED=true` setelah smoke test delivery. Email dummy tidak diberi status verified secara palsu.
7. Untuk Dosen/Mahasiswa yang lupa password dan tidak dapat mengakses email dummy, Admin memakai **Reset ke Password Awal**, wajib memberi alasan, lalu pengguna login restricted dan mengganti password. Reset-link tetap dipakai bila kanal recovery terverifikasi tersedia.
8. Password awal Admin hanya berlaku pada provisioning akun baru. Admin/Sekretaris Prodi existing tidak boleh di-reset melalui API non-privileged. Bila seluruh akun privileged terkunci saat cutover, operator database menjalankan recovery offline dengan persetujuan tercatat:

   ```powershell
   npm run recover:stage6-privileged -- --account-type=admin --account-id=<id>
   $env:PRIVILEGED_RECOVERY_PASSWORD_HASH='<bcrypt-hash-yang-dibuat-offline>'
   $env:PRIVILEGED_RECOVERY_REASON='<nomor tiket dan persetujuan minimal 20 karakter>'
   npm run recover:stage6-privileged -- --account-type=admin --account-id=<id> --execute
   ```

9. Hapus dua environment variable recovery segera setelah eksekusi. Periksa event `privileged.offline_recovery`, login dengan secret yang diserahkan melalui kanal organisasi, lalu ganti password kembali melalui UI.
10. Jalankan rekonsiliasi ulang. Akun privileged diselesaikan satu per satu melalui recovery offline; jangan menandai email secara massal tanpa keputusan institusi.

Script selalu dry-run kecuali `--execute`, membutuhkan target ID eksplisit, menerima bcrypt hash saja, menaikkan credential version, mencabut seluruh sesi, dan membuat audit event.
