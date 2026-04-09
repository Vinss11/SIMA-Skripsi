import React, { useState } from "react";
import { MessageSquare, User, Mail, Calendar, MapPin, Clock, FileText, CheckCircle, XCircle } from "lucide-react";

// Component untuk Info Pembimbing
const PembimbingInfo = ({ nama, email, bidang }) => {
  return (
    <div className="flex-1">
      <h3 className="text-lg font-bold text-gray-900">{nama}</h3>
      <p className="text-sm text-blue-600 mb-2">Pembimbing Pengujian</p>
      <div className="flex items-center space-x-2 text-sm text-gray-600 mb-1">
        <Mail className="w-4 h-4" />
        <span>{email}</span>
      </div>
      <p className="text-sm text-gray-600">Bidang: {bidang}</p>
    </div>
  );
};

// Component untuk Jadwal Bimbingan Mendatang
const JadwalCard = ({ tanggal, waktu, topik, lokasi, status }) => {
  return (
    <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-6 mb-4">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Calendar className="w-5 h-5 text-yellow-700" />
          <h3 className="font-bold text-gray-900">Jadwal Bimbingan Mendatang</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-sm text-gray-600 mb-1">Tanggal & Waktu</p>
          <p className="font-semibold text-gray-900">{tanggal}</p>
          <p className="text-sm text-gray-700">{waktu}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600 mb-1">Lokasi</p>
          <p className="font-semibold text-gray-900">{lokasi}</p>
        </div>
      </div>

      <div>
        <p className="text-sm text-gray-600 mb-1">Topik</p>
        <p className="font-semibold text-gray-900">{topik}</p>
      </div>
    </div>
  );
};

// Component untuk Card Riwayat Bimbingan
const RiwayatCard = ({ tanggal, waktu, topik, catatan, status, statusColor }) => {
  const statusConfig = {
    selesai: {
      icon: <CheckCircle className="w-5 h-5 text-green-600" />,
      bgColor: "bg-green-50",
      borderColor: "border-green-200",
      badge: "bg-green-100 text-green-700",
    },
    dibatalkan: {
      icon: <XCircle className="w-5 h-5 text-red-600" />,
      bgColor: "bg-red-50",
      borderColor: "border-red-200",
      badge: "bg-red-100 text-red-700",
    },
  };

  const config = statusConfig[statusColor] || statusConfig.selesai;

  return (
    <div className={`${config.bgColor} border ${config.borderColor} rounded-lg p-6 mb-4`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-2">
          {config.icon}
          <span className={`${config.badge} px-3 py-1 rounded-full text-xs font-semibold`}>{status}</span>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-gray-900">{tanggal}</p>
          <p className="text-xs text-gray-600">{waktu}</p>
        </div>
      </div>

      <div className="mb-3">
        <p className="text-sm text-gray-600 mb-1">Topik Pembahasan</p>
        <p className="font-semibold text-gray-900">{topik}</p>
      </div>

      {catatan && (
        <div>
          <p className="text-sm text-gray-600 mb-2">Catatan & Feedback</p>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-800">{catatan}</p>
          </div>
        </div>
      )}
    </div>
  );
};

// Main Bimbingan Page Component
const BimbinganPage = () => {
  const pembimbingData = {
    nama: "Dr. Siti Nurhaliza, M.T",
    email: "sitinurhaliza@uii.ac.id",
    bidang: "Informatika Medis, Medical Image Processing",
  };

  const jadwalMendatang = {
    tanggal: "15 November 2025",
    waktu: "10:00 - 11:00 WIB",
    topik: "Review Revisi BAB 3 dan Progress BAB 4",
    lokasi: "Ruang Dosen Informatika Lt. 3",
  };

  const riwayatBimbingan = [
    {
      id: 1,
      tanggal: "8 November 2025",
      waktu: "10:00 - 11:00 WIB",
      topik: "Review BAB 3: Metodologi Penelitian",
      catatan: "Metodologi sudah baik, namun perlu diperjelas pada bagian dataset dan preprocessing. Tambahkan flowchart untuk memperjelas alur penelitian. Lanjutkan ke BAB 4.",
      status: "Selesai",
      statusColor: "selesai",
    },
    {
      id: 2,
      tanggal: "1 November 2025",
      waktu: "14:00 - 15:00 WIB",
      topik: "Pembahasan Hasil Implementasi Sistem",
      catatan: "Implementasi berjalan baik. Hasil akurasi model sudah cukup bagus (87%). Perlu ditambahkan analisis confusion matrix dan comparison dengan metode lain.",
      status: "Selesai",
      statusColor: "selesai",
    },
    {
      id: 3,
      tanggal: "25 Oktober 2025",
      waktu: "10:00 - 11:00 WIB",
      topik: "Review BAB 2: Tinjauan Pustaka",
      catatan: "BAB 2 sudah cukup komprehensif. Tambahkan beberapa penelitian terbaru (2023-2024) terkait deep learning untuk medical imaging. Perbaiki format sitasi.",
      status: "Selesai",
      statusColor: "selesai",
    },
    {
      id: 4,
      tanggal: "18 Oktober 2025",
      waktu: "10:00 - 11:00 WIB",
      topik: "Kick-off dan Penjelasan Outline Skripsi",
      catatan: "Topik penelitian sudah disetujui. Mahasiswa diminta untuk membuat outline lengkap dan mulai mengumpulkan literatur untuk BAB 2. Timeline pengerjaan sudah dijelaskan.",
      status: "Selesai",
      statusColor: "selesai",
    },
  ];

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg shadow-lg p-8 mb-6">
        <div className="flex items-center space-x-3">
          <MessageSquare className="w-8 h-8" />
          <div>
            <h1 className="text-2xl font-bold">Bimbingan Skripsi</h1>
            <p className="text-blue-100">Kelola jadwal dan bimbingan dengan dosen</p>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-start space-x-2">
          <User className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-blue-900 mb-1">Informasi Pembimbing</h3>
            <PembimbingInfo nama={pembimbingData.nama} email={pembimbingData.email} bidang={pembimbingData.bidang} />
          </div>
        </div>
      </div>

      <div className="mb-6">
        <div className="flex items-center space-x-2 mb-4">
          <Calendar className="w-5 h-5 text-yellow-700" />
          <h2 className="text-lg font-bold text-gray-900">Jadwal Bimbingan Mendatang</h2>
        </div>
        <JadwalCard tanggal={jadwalMendatang.tanggal} waktu={jadwalMendatang.waktu} topik={jadwalMendatang.topik} lokasi={jadwalMendatang.lokasi} />
      </div>

      <div>
        <div className="flex items-center space-x-2 mb-4">
          <FileText className="w-5 h-5 text-gray-700" />
          <h2 className="text-lg font-bold text-gray-900">Riwayat Bimbingan</h2>
        </div>
        <p className="text-sm text-gray-600 mb-4">Catatan dan feedback dari setiap sesi bimbingan</p>

        {riwayatBimbingan.map((riwayat) => (
          <RiwayatCard key={riwayat.id} tanggal={riwayat.tanggal} waktu={riwayat.waktu} topik={riwayat.topik} catatan={riwayat.catatan} status={riwayat.status} statusColor={riwayat.statusColor} />
        ))}
      </div>
    </div>
  );
};

export default BimbinganPage;
