"use strict";

// Memastikan relasi tetap diisi pada instalasi baru ketika master dosen dibuat
// melalui seeder setelah seluruh migrasi selesai dijalankan.
module.exports = require("../migrations/20260824110000-seed-dosen-bidang-penelitian");
