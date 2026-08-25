const XLSX = require("xlsx");

const TOPIK_IMPORT_TEMPLATE_ROWS = [
  {
    Judul: "Contoh Judul Topik Penelitian",
    Deskripsi: "Deskripsi singkat tentang topik penelitian ini",
    "Bidang Penelitian": "Information Systems, Business Intelligence",
    Cluster: "Sirkel",
  },
  {
    Judul: "Implementasi Blockchain untuk Keamanan Data",
    Deskripsi: "Penelitian implementasi blockchain dalam sistem keamanan data",
    "Bidang Penelitian": "Blockchain, Information Security",
    Cluster: "Siber",
  },
  {
    Judul: "Sistem Informasi Manajemen Perpustakaan",
    Deskripsi: "Pengembangan sistem informasi untuk manajemen perpustakaan digital",
    "Bidang Penelitian": "Information Systems, Database Technology",
    Cluster: "ITSC",
  },
  {
    Judul: "Analisis Sentimen Media Sosial Menggunakan Deep Learning",
    Deskripsi: "Penelitian analisis sentimen pada data Twitter menggunakan LSTM",
    "Bidang Penelitian": "Natural Language Processing, Deep Learning",
    Cluster: "MVK",
  },
];

function buildTopikImportTemplateBuffer() {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(TOPIK_IMPORT_TEMPLATE_ROWS);
  worksheet["!cols"] = [
    { wch: 50 },
    { wch: 60 },
    { wch: 55 },
    { wch: 10 },
  ];
  XLSX.utils.book_append_sheet(workbook, worksheet, "Template Topik");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

module.exports = { buildTopikImportTemplateBuffer };
