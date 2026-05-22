"use strict";

const MITRA_MAGANG_DEFAULT = [
  {
    nama: "Lembaga Ilmu Pengetahuan Indonesia (LIPI)",
    bidang_jenis: "Lembaga Riset Pemerintah",
    lokasi: "Bandung",
    email_kontak: "humas@mail.lipi.go.id",
    website: "http://lipi.go.id/",
  },
  {
    nama: "PT Softwareseni",
    bidang_jenis: "Software House",
    lokasi: "Yogyakarta",
    email_kontak: "info@softwareseni.com",
    website: "http://www.softwareseni.co.id/",
  },
  {
    nama: "PT Javan Cipta Solusi",
    bidang_jenis: "Software House",
    lokasi: "Yogyakarta dan Bandung",
    email_kontak: "info@javan.co.id",
    website: "http://www.javan.co.id",
  },
  {
    nama: "Technophoria Indonesia",
    bidang_jenis: "IT Consultant",
    lokasi: "Yogyakarta",
    email_kontak: "info@technophoriajogja.com",
    website: "http://technophoriajogja.com/",
  },
  {
    nama: "CV Folarium Technomedia",
    bidang_jenis: "Software House",
    lokasi: "Yogyakarta",
    email_kontak: "hello@folarium.co.id",
    website: "http://www.folarium.co.id/",
  },
  {
    nama: "AVO Innovation Technology",
    bidang_jenis: "Beauty and Cosmetic",
    lokasi: "Yogyakarta",
    email_kontak: "avoskin@avo.co.id",
    website: "https://www.avoskinbeauty.com/",
  },
  {
    nama: "PT Krafthaus Indonesia",
    bidang_jenis: "Digital Agency",
    lokasi: "Yogyakarta",
    email_kontak: "company@krafthaus.co.id",
    website: "http://krafthaus.co.id/",
  },
  {
    nama: "Kreasikode",
    bidang_jenis: "Software House",
    lokasi: "Yogyakarta",
    email_kontak: null,
    website: "http://www.kreasikode.com/",
  },
  {
    nama: "PT Javasigna Intermedia",
    bidang_jenis: "Digital Agency",
    lokasi: "Yogyakarta",
    email_kontak: "hello@javasign.net",
    website: "http://javasign.id/",
  },
  {
    nama: "Agate Studio",
    bidang_jenis: "Game Developer",
    lokasi: "Bandung",
    email_kontak: "contact@agatestudio.com",
    website: "http://www.agatestudio.com/",
  },
  {
    nama: "PT Swamedia Informatika",
    bidang_jenis: "Software Developer",
    lokasi: "Bandung",
    email_kontak: "swainfo@swamedia.co.id",
    website: "http://www.swamedia.co.id/",
  },
  {
    nama: "Tokopedia",
    bidang_jenis: "Online Shop / Marketplace",
    lokasi: null,
    email_kontak: null,
    website: "http://www.tokopedia.com",
  },
  {
    nama: "Geekgarden",
    bidang_jenis: "Software House",
    lokasi: null,
    email_kontak: "info@geekgarden.id",
    website: "http://geekgarden.id",
  },
  {
    nama: "Gameloft",
    bidang_jenis: "Game Developer",
    lokasi: "Yogyakarta",
    email_kontak: null,
    website: "https://www.gameloft.com/id/",
  },
  {
    nama: "CBN Internet",
    bidang_jenis: "Internet Service Provider, Cloud Computing, Data Center",
    lokasi: null,
    email_kontak: null,
    website: "https://cbn.id/about/",
  },
  {
    nama: "PT Farma Global Teknologi",
    bidang_jenis: "Software House - Teknologi Bidang Kesehatan",
    lokasi: "Yogyakarta",
    email_kontak: "info@farmagitechs.co.id",
    website: "https://farmagitechs.co.id/",
  },
  {
    nama: "Bank Syariah Indonesia",
    bidang_jenis: "Bank",
    lokasi: null,
    email_kontak: null,
    website: "https://ir.bankbsi.co.id/home.html",
  },
];

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const payload = MITRA_MAGANG_DEFAULT.map((item) => ({
      ...item,
      status: "active",
      is_active: true,
      catatan: null,
      createdAt: now,
      updatedAt: now,
    }));

    await queryInterface.bulkInsert("MitraMagangs", payload, {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete(
      "MitraMagangs",
      {
        nama: {
          [Sequelize.Op.in]: MITRA_MAGANG_DEFAULT.map((item) => item.nama),
        },
      },
      {}
    );
  },
};
