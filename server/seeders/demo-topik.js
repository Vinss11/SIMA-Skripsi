"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert(
      "Topiks",
      [
        // Topik dari Dosen 1 (Dr. Ahmad Fauzi) - Cluster Sirkel
        {
          kode: "SIRKEL01",
          judul: "Sistem Rekomendasi Produk E-Commerce Menggunakan Collaborative Filtering",
          deskripsi: "Penelitian tentang pengembangan sistem rekomendasi untuk meningkatkan pengalaman pengguna dalam e-commerce",
          cluster: "Sirkel",
          status: "available",
          dosen_id: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          kode: "SIRKEL02",
          judul: "Analisis Sentimen Media Sosial Menggunakan Deep Learning",
          deskripsi: "Penggunaan LSTM dan CNN untuk analisis sentimen pada data Twitter",
          cluster: "Sirkel",
          status: "available",
          dosen_id: 1,

          createdAt: new Date(),
          updatedAt: new Date(),
        },
        // Topik dari Dosen 2 (Dr. Budi Santoso) - Cluster Siber
        {
          kode: "SIBER01",
          judul: "Deteksi Intrusi Jaringan Menggunakan Machine Learning",
          deskripsi: "Implementasi algoritma ML untuk mendeteksi serangan pada jaringan komputer",
          cluster: "Siber",
          status: "available",
          dosen_id: 2,

          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          kode: "SIBER02",
          judul: "Analisis Keamanan Protokol IoT dengan Penetration Testing",
          deskripsi: "Penelitian keamanan pada protokol komunikasi perangkat IoT",
          cluster: "Siber",
          status: "available",
          dosen_id: 2,

          createdAt: new Date(),
          updatedAt: new Date(),
        },
        // Topik dari Dosen 3 (Dr. Citra Dewi) - Cluster ITSC
        {
          kode: "ITSC01",
          judul: "Pengembangan Chatbot Customer Service Menggunakan NLP",
          deskripsi: "Implementasi chatbot cerdas untuk layanan pelanggan berbasis Natural Language Processing",
          cluster: "ITSC",
          status: "available",
          dosen_id: 3,

          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          kode: "ITSC02",
          judul: "Sistem Manajemen Proyek Berbasis Web dengan Metode Agile",
          deskripsi: "Pengembangan aplikasi project management dengan pendekatan Scrum",
          cluster: "ITSC",
          status: "available",
          dosen_id: 3,

          createdAt: new Date(),
          updatedAt: new Date(),
        },
        // Topik dari Dosen 4 (Dr. Dodi Prasetyo) - Cluster MVK
        {
          kode: "MVK01",
          judul: "Augmented Reality untuk Pembelajaran Anatomi Tubuh Manusia",
          deskripsi: "Aplikasi AR mobile untuk memvisualisasikan anatomi tubuh manusia secara interaktif",
          cluster: "MVK",
          status: "available",
          dosen_id: 4,

          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          kode: "MVK02",
          judul: "Game Edukasi Matematika untuk Anak SD Berbasis Unity",
          deskripsi: "Pengembangan game interaktif untuk pembelajaran matematika tingkat sekolah dasar",
          cluster: "MVK",
          status: "available",
          dosen_id: 4,

          createdAt: new Date(),
          updatedAt: new Date(),
        },
        // Topik dari Dosen 5 (Eka Wijaya) - Cluster ITSC
        {
          kode: "ITSC03",
          judul: "Optimasi Algoritma Pencarian Rute Menggunakan A-Star",
          deskripsi: "Implementasi dan optimasi algoritma A-Star untuk sistem navigasi",
          cluster: "ITSC",
          status: "available",
          dosen_id: 5,

          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          kode: "ITSC04",
          judul: "Sistem Informasi Geografis Pemetaan Potensi Bencana",
          deskripsi: "Pengembangan SIG untuk pemetaan dan analisis potensi bencana alam",
          cluster: "ITSC",
          status: "available",
          dosen_id: 5,

          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      {}
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("Topiks", null, {});
  },
};
