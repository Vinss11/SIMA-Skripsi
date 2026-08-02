# Runbook cutover autentikasi Tahap 6

1. Jalankan seluruh migration dan `npm run reconcile:stage6-auth-security:dry-run`.
2. Aktifkan recovery hanya setelah `AUTH_DELIVERY_KEY`, `AUTH_FRONTEND_ORIGIN`, provider webhook, worker, dan monitoring tersedia. Set `AUTH_RECOVERY_ENABLED=true` setelah smoke test delivery.
3. Untuk akun Mahasiswa/Dosen berstatus `default` atau `temporary`, jalankan `npm run provision:stage6-activations`. Script membuat token dan outbox secara atomik; email baru dianggap terverifikasi setelah pemilik akun mengonsumsi tautan aktivasi. Jangan menyalin token atau password secara manual. Untuk akun aktif yang belum mempunyai kanal recovery terverifikasi, Admin tetap harus mencocokkan email ke sumber resmi melalui tombol **Verifikasi Email Pemulihan** sebelum mengirim tautan reset.
4. Admin/Sekretaris Prodi tidak boleh di-reset melalui API. Bila seluruh akun privileged terkunci saat cutover, operator database menjalankan recovery offline dengan persetujuan tercatat:

   ```powershell
   npm run recover:stage6-privileged -- --account-type=admin --account-id=<id>
   $env:PRIVILEGED_RECOVERY_PASSWORD_HASH='<bcrypt-hash-yang-dibuat-offline>'
   $env:PRIVILEGED_RECOVERY_REASON='<nomor tiket dan persetujuan minimal 20 karakter>'
   npm run recover:stage6-privileged -- --account-type=admin --account-id=<id> --execute
   ```

5. Hapus dua environment variable recovery segera setelah eksekusi. Periksa event `privileged.offline_recovery`, login dengan secret yang diserahkan melalui kanal organisasi, lalu ganti password kembali melalui UI.
6. Jalankan rekonsiliasi ulang. Akun privileged diselesaikan satu per satu melalui recovery offline; jangan menandai email secara massal tanpa keputusan institusi.

Script selalu dry-run kecuali `--execute`, membutuhkan target ID eksplisit, menerima bcrypt hash saja, menaikkan credential version, mencabut seluruh sesi, dan membuat audit event.
