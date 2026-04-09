const XLSX = require("xlsx");
const fs = require("fs");
const { Topik, Dosen, Mahasiswa, sequelize } = require("../models");

// ========== TOPIK UPLOAD ==========

// POST /api/admin/upload/topics - Upload Excel Topik
exports.uploadTopics = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    // Cek apakah file di-upload
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "File Excel harus di-upload",
      });
    }

    const filePath = req.file.path;

    // Baca file Excel
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);

    console.log(`📄 Memproses ${data.length} baris data dari Excel...`);

    // Validasi data kosong
    if (data.length === 0) {
      fs.unlinkSync(filePath);
      return res.status(400).json({
        success: false,
        message: "File Excel kosong atau format tidak sesuai",
      });
    }

    const results = {
      success: [],
      failed: [],
      total: data.length,
    };

    // Proses setiap baris
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNumber = i + 2; // +2 karena row 1 adalah header

      try {
        // Ekstrak data
        const kode = row["Kode Topik"] || row["kode"] || row["KODE"];
        const judul = row["Judul"] || row["judul"] || row["JUDUL"];
        const deskripsi = row["Deskripsi"] || row["deskripsi"] || row["DESKRIPSI"];
        const cluster = row["Cluster"] || row["cluster"] || row["CLUSTER"];
        const nipDosen = row["NIP Dosen"] || row["nip"] || row["NIP"];

        // Validasi field wajib
        if (!kode || !judul || !cluster || !nipDosen) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: "Field wajib tidak lengkap (Kode Topik, Judul, Cluster, NIP Dosen harus diisi)",
          });
          continue;
        }

        // Validasi cluster
        const validClusters = ["Sirkel", "Siber", "ITSC", "MVK"];
        if (!validClusters.includes(cluster)) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: `Cluster tidak valid. Harus salah satu dari: ${validClusters.join(", ")}`,
          });
          continue;
        }

        // Cari dosen berdasarkan NIP
        const dosen = await Dosen.findOne({
          where: { nip: nipDosen },
          transaction: t,
        });

        if (!dosen) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: `Dosen dengan NIP ${nipDosen} tidak ditemukan di database`,
          });
          continue;
        }

        // Cek apakah kode topik sudah ada
        const existingTopik = await Topik.findOne({
          where: { kode: kode },
          transaction: t,
        });

        if (existingTopik) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: `Kode topik ${kode} sudah ada di database`,
          });
          continue;
        }

        // Insert topik ke database
        const newTopik = await Topik.create(
          {
            kode: kode.trim(),
            judul: judul.trim(),
            deskripsi: deskripsi ? deskripsi.trim() : null,
            cluster: cluster.trim(),
            dosen_id: dosen.id,
            status: "available",
          },
          { transaction: t }
        );

        results.success.push({
          row: rowNumber,
          kode: newTopik.kode,
          judul: newTopik.judul,
          dosen: dosen.nama,
        });
      } catch (error) {
        results.failed.push({
          row: rowNumber,
          data: row,
          error: error.message,
        });
      }
    }

    // Commit transaction jika ada yang berhasil
    if (results.success.length > 0) {
      await t.commit();
    } else {
      await t.rollback();
    }

    // Hapus file setelah diproses
    fs.unlinkSync(filePath);

    // Response
    const statusCode = results.success.length > 0 ? 201 : 400;

    res.status(statusCode).json({
      success: results.success.length > 0,
      message: `Upload selesai. Berhasil: ${results.success.length}, Gagal: ${results.failed.length}`,
      data: {
        total: results.total,
        berhasil: results.success.length,
        gagal: results.failed.length,
        detail_berhasil: results.success,
        detail_gagal: results.failed,
      },
    });
  } catch (error) {
    if (!t.finished) {
      await t.rollback();
    }

    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    console.error("Error di uploadTopics:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// GET /api/upload/template - Download template Excel Topik
exports.downloadTemplate = (req, res) => {
  try {
    const templateData = [
      {
        "Kode Topik": "SIRKEL03",
        Judul: "Contoh Judul Topik Penelitian",
        Deskripsi: "Deskripsi singkat tentang topik penelitian ini",
        Cluster: "Sirkel",
        "NIP Dosen": "198501012010121001",
      },
      {
        "Kode Topik": "SIBER03",
        Judul: "Implementasi Blockchain untuk Keamanan Data",
        Deskripsi: "Penelitian implementasi blockchain dalam sistem keamanan data",
        Cluster: "Siber",
        "NIP Dosen": "198601012011121002",
      },
      {
        "Kode Topik": "ITSC05",
        Judul: "Sistem Informasi Manajemen Perpustakaan",
        Deskripsi: "Pengembangan sistem informasi untuk manajemen perpustakaan digital",
        Cluster: "ITSC",
        "NIP Dosen": "199001012015121003",
      },
      {
        "Kode Topik": "MVK02",
        Judul: "Analisis Sentimen Media Sosial Menggunakan Deep Learning",
        Deskripsi: "Penelitian analisis sentimen pada data Twitter menggunakan LSTM",
        Cluster: "MVK",
        "NIP Dosen": "199001012015121003",
      },
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(templateData);

    // Set lebar kolom (TANPA kolom Kuota)
    ws["!cols"] = [
      { wch: 15 }, // Kode Topik
      { wch: 50 }, // Judul
      { wch: 60 }, // Deskripsi
      { wch: 10 }, // Cluster
      { wch: 20 }, // NIP Dosen
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Template Topik");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Disposition", "attachment; filename=template_topik.xlsx");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    res.send(buffer);
  } catch (error) {
    console.error("Error di downloadTemplate:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// ========== MAHASISWA UPLOAD ==========

// POST /api/admin/upload/mahasiswa - Upload Excel Mahasiswa
exports.uploadMahasiswa = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "File Excel harus di-upload",
      });
    }

    const filePath = req.file.path;

    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);

    console.log(`📄 Memproses ${data.length} baris data mahasiswa dari Excel...`);

    if (data.length === 0) {
      fs.unlinkSync(filePath);
      return res.status(400).json({
        success: false,
        message: "File Excel kosong atau format tidak sesuai",
      });
    }

    const results = {
      success: [],
      failed: [],
      total: data.length,
    };

    const DEFAULT_PASSWORD = "12345678";

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNumber = i + 2;

      try {
        const nim = row["NIM"] || row["nim"];
        const nama = row["Nama"] || row["nama"] || row["NAMA"];
        const email = row["Email"] || row["email"] || row["EMAIL"];
        const angkatan = row["Angkatan"] || row["angkatan"] || row["ANGKATAN"];
        const nipDPA = row["NIP DPA"] || row["nip_dpa"] || row["NIP_DPA"];

        if (!nim || !nama || !email || !angkatan || !nipDPA) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: "Field wajib tidak lengkap (NIM, Nama, Email, Angkatan, NIP DPA harus diisi)",
          });
          continue;
        }

        if (!/^\d{8}$/.test(nim.toString())) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: "Format NIM tidak valid. NIM harus 8 digit angka",
          });
          continue;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: "Format email tidak valid",
          });
          continue;
        }

        if (!/^\d{4}$/.test(angkatan.toString())) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: "Format angkatan tidak valid. Harus 4 digit tahun (contoh: 2022)",
          });
          continue;
        }

        const existingMahasiswaNIM = await Mahasiswa.findOne({
          where: { nim: nim.toString() },
          transaction: t,
        });

        if (existingMahasiswaNIM) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: `NIM ${nim} sudah terdaftar di database`,
          });
          continue;
        }

        const existingMahasiswaEmail = await Mahasiswa.findOne({
          where: { email: email.toLowerCase() },
          transaction: t,
        });

        if (existingMahasiswaEmail) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: `Email ${email} sudah terdaftar di database`,
          });
          continue;
        }

        const dpa = await Dosen.findOne({
          where: { nip: nipDPA.toString() },
          transaction: t,
        });

        if (!dpa) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: `Dosen dengan NIP ${nipDPA} tidak ditemukan di database`,
          });
          continue;
        }

        const newMahasiswa = await Mahasiswa.create(
          {
            nim: nim.toString().trim(),
            nama: nama.trim(),
            email: email.toLowerCase().trim(),
            // Password akan di-hash oleh hook model (beforeCreate)
            password: DEFAULT_PASSWORD,
            is_default_password: true,
            angkatan: angkatan.toString().trim(),
            dosen_pembimbing_akademik_id: dpa.id,
            status_jalur_saat_ini: "belum_mengajukan",
          },
          { transaction: t }
        );

        results.success.push({
          row: rowNumber,
          nim: newMahasiswa.nim,
          nama: newMahasiswa.nama,
          email: newMahasiswa.email,
          angkatan: newMahasiswa.angkatan,
          dpa: dpa.nama,
        });
      } catch (error) {
        results.failed.push({
          row: rowNumber,
          data: row,
          error: error.message,
        });
      }
    }

    if (results.success.length > 0) {
      await t.commit();
    } else {
      await t.rollback();
    }

    fs.unlinkSync(filePath);

    const statusCode = results.success.length > 0 ? 201 : 400;

    res.status(statusCode).json({
      success: results.success.length > 0,
      message: `Upload selesai. Berhasil: ${results.success.length}, Gagal: ${results.failed.length}`,
      data: {
        total: results.total,
        berhasil: results.success.length,
        gagal: results.failed.length,
        password_default: DEFAULT_PASSWORD,
        detail_berhasil: results.success,
        detail_gagal: results.failed,
      },
    });
  } catch (error) {
    if (!t.finished) {
      await t.rollback();
    }

    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    console.error("Error di uploadMahasiswa:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// GET /api/upload/mahasiswa-template - Download template Excel Mahasiswa
exports.downloadMahasiswaTemplate = (req, res) => {
  try {
    const templateData = [
      {
        NIM: "22523001",
        Nama: "John Doe",
        Email: "john.doe@student.university.ac.id",
        Angkatan: "2022",
        "NIP DPA": "199001012015121003",
      },
      {
        NIM: "22523002",
        Nama: "Jane Smith",
        Email: "jane.smith@student.university.ac.id",
        Angkatan: "2022",
        "NIP DPA": "199001012015121003",
      },
      {
        NIM: "23523001",
        Nama: "Alice Johnson",
        Email: "alice.johnson@student.university.ac.id",
        Angkatan: "2023",
        "NIP DPA": "198601012011121002",
      },
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(templateData);

    ws["!cols"] = [{ wch: 12 }, { wch: 25 }, { wch: 40 }, { wch: 10 }, { wch: 20 }];

    XLSX.utils.book_append_sheet(wb, ws, "Template Mahasiswa");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Disposition", "attachment; filename=template_mahasiswa.xlsx");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    res.send(buffer);
  } catch (error) {
    console.error("Error di downloadMahasiswaTemplate:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// ========== DOSEN UPLOAD ==========

// POST /api/upload/dosen - Upload Excel Dosen
exports.uploadDosen = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "File Excel harus di-upload",
      });
    }

    const filePath = req.file.path;

    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);

    console.log(`📄 Memproses ${data.length} baris data dosen dari Excel...`);

    if (data.length === 0) {
      fs.unlinkSync(filePath);
      return res.status(400).json({
        success: false,
        message: "File Excel kosong atau format tidak sesuai",
      });
    }

    const results = {
      success: [],
      failed: [],
      total: data.length,
    };

    const DEFAULT_PASSWORD_DOSEN = process.env.DEFAULT_PASSWORD_DOSEN || "12345678"; // Password default untuk dosen

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNumber = i + 2;

      try {
        const nip = row["NIP"] || row["nip"];
        const nama = row["Nama"] || row["nama"] || row["NAMA"];
        const email = row["Email"] || row["email"] || row["EMAIL"];
        const jabatan = row["Jabatan"] || row["jabatan"] || row["JABATAN"];
        const kuotaBimbingan = row["Kuota Bimbingan"] || row["kuota_bimbingan"] || row["KUOTA_BIMBINGAN"] || 5;

        // Validasi field wajib
        if (!nip || !nama || !email || !jabatan) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: "Field wajib tidak lengkap (NIP, Nama, Email, Jabatan harus diisi)",
          });
          continue;
        }

        // Validasi format NIP (minimal 10 digit, maksimal 20 digit angka)
        if (!/^\d{10,20}$/.test(nip.toString())) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: "Format NIP tidak valid. NIP harus 10-20 digit angka",
          });
          continue;
        }

        // Validasi format email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: "Format email tidak valid",
          });
          continue;
        }

        // Validasi jabatan
        const validJabatan = ["Guru Besar", "Lektor Kepala", "Lektor", "Asisten Ahli"];
        if (!validJabatan.includes(jabatan)) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: `Jabatan tidak valid. Harus salah satu dari: ${validJabatan.join(", ")}`,
          });
          continue;
        }

        // Validasi kuota bimbingan (harus angka positif)
        const kuota = parseInt(kuotaBimbingan);
        if (isNaN(kuota) || kuota < 1) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: "Kuota bimbingan harus berupa angka minimal 1",
          });
          continue;
        }

        // Cek apakah NIP sudah ada
        const existingDosenNIP = await Dosen.findOne({
          where: { nip: nip.toString() },
          transaction: t,
        });

        if (existingDosenNIP) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: `NIP ${nip} sudah terdaftar di database`,
          });
          continue;
        }

        // Cek apakah email sudah ada
        const existingDosenEmail = await Dosen.findOne({
          where: { email: email.toLowerCase() },
          transaction: t,
        });

        if (existingDosenEmail) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: `Email ${email} sudah terdaftar di database`,
          });
          continue;
        }

        // Insert dosen ke database
        const newDosen = await Dosen.create(
          {
            nip: nip.toString().trim(),
            nama: nama.trim(),
            email: email.toLowerCase().trim(),
            // Password akan di-hash oleh hook model (beforeCreate)
            password: DEFAULT_PASSWORD_DOSEN,
            is_default_password: true,
            jabatan: jabatan.trim(),
            kuota_bimbingan: kuota,
          },
          { transaction: t }
        );

        results.success.push({
          row: rowNumber,
          nip: newDosen.nip,
          nama: newDosen.nama,
          email: newDosen.email,
          jabatan: newDosen.jabatan,
          kuota_bimbingan: newDosen.kuota_bimbingan,
        });
      } catch (error) {
        results.failed.push({
          row: rowNumber,
          data: row,
          error: error.message,
        });
      }
    }

    if (results.success.length > 0) {
      await t.commit();
    } else {
      await t.rollback();
    }

    fs.unlinkSync(filePath);

    const statusCode = results.success.length > 0 ? 201 : 400;

    res.status(statusCode).json({
      success: results.success.length > 0,
      message: `Upload selesai. Berhasil: ${results.success.length}, Gagal: ${results.failed.length}`,
      data: {
        total: results.total,
        berhasil: results.success.length,
        gagal: results.failed.length,
        password_default: DEFAULT_PASSWORD_DOSEN,
        detail_berhasil: results.success,
        detail_gagal: results.failed,
      },
    });
  } catch (error) {
    if (!t.finished) {
      await t.rollback();
    }

    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    console.error("Error di uploadDosen:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// GET /api/upload/dosen-template - Download template Excel Dosen
exports.downloadDosenTemplate = (req, res) => {
  try {
    const templateData = [
      {
        NIP: "198501012010121001",
        Nama: "Dr. Ahmad Fauzi",
        Email: "ahmad.fauzi@university.ac.id",
        Jabatan: "Lektor Kepala",
        "Kuota Bimbingan": 10,
      },
      {
        NIP: "198601012011121002",
        Nama: "Dr. Budi Santoso",
        Email: "budi.santoso@university.ac.id",
        Jabatan: "Lektor",
        "Kuota Bimbingan": 8,
      },
      {
        NIP: "199001012015121003",
        Nama: "Dr. Citra Dewi",
        Email: "citra.dewi@university.ac.id",
        Jabatan: "Asisten Ahli",
        "Kuota Bimbingan": 5,
      },
      {
        NIP: "199201012016121004",
        Nama: "Prof. Dr. Dodi Prasetyo",
        Email: "dodi.prasetyo@university.ac.id",
        Jabatan: "Guru Besar",
        "Kuota Bimbingan": 12,
      },
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(templateData);

    // Set lebar kolom
    ws["!cols"] = [
      { wch: 20 }, // NIP
      { wch: 30 }, // Nama
      { wch: 35 }, // Email
      { wch: 20 }, // Jabatan
      { wch: 18 }, // Kuota Bimbingan
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Template Dosen");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Disposition", "attachment; filename=template_dosen.xlsx");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    res.send(buffer);
  } catch (error) {
    console.error("Error di downloadDosenTemplate:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};
