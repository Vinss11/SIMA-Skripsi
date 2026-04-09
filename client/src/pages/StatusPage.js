import React from "react";
import { CheckCircle, Info, XCircle, Clock } from "lucide-react";

// Component untuk status card
const StatusCard = ({ status, judul, judulEng, tanggalPengajuan, tanggalReview, reviewer, catatan }) => {
  const statusConfig = {
    disetujui: {
      badge: "Disetujui",
      badgeColor: "bg-green-100 text-green-700",
      bgColor: "bg-green-50",
      borderColor: "border-green-200",
      catatanBg: "bg-green-50",
    },
    ditolak: {
      badge: "Ditolak",
      badgeColor: "bg-red-100 text-red-700",
      bgColor: "bg-red-50",
      borderColor: "border-red-200",
      catatanBg: "bg-red-50",
    },
    menunggu: {
      badge: "Menunggu Review",
      badgeColor: "bg-yellow-100 text-yellow-700",
      bgColor: "bg-yellow-50",
      borderColor: "border-yellow-200",
      catatanBg: "bg-yellow-50",
    },
  };

  const config = statusConfig[status] || statusConfig.menunggu;

  return (
    <div className="bg-white border rounded-lg p-6 mb-4 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <span className={`${config.badgeColor} px-3 py-1 rounded-full text-xs font-semibold`}>{config.badge}</span>
      </div>

      <h3 className="text-lg font-bold text-gray-900 mb-1">{judul}</h3>
      <p className="text-sm text-gray-600 italic mb-4">{judulEng}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-sm text-gray-600">Tanggal Pengajuan</p>
          <p className="font-semibold text-gray-900">{tanggalPengajuan}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Tanggal Review</p>
          <p className="font-semibold text-gray-900">{tanggalReview}</p>
        </div>
      </div>

      <div className="mb-4">
        <p className="text-sm text-gray-600 mb-1">Reviewer</p>
        <p className="font-semibold text-gray-900">{reviewer}</p>
      </div>

      {catatan && (
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Catatan Reviewer</p>
          <div className={`${config.catatanBg} border ${config.borderColor} rounded-lg p-4`}>
            <p className="text-sm text-gray-800">{catatan}</p>
          </div>
        </div>
      )}
    </div>
  );
};

// Main Status Page Component
const StatusPage = () => {
  const statusData = [
    {
      id: 1,
      status: "disetujui",
      judul: "Sistem Deteksi Kanker Paru-paru dari Citra CT Scan Menggunakan CNN",
      judulEng: "Lung Cancer Detection System from CT Scan Images Using CNN",
      tanggalPengajuan: "15 September 2025",
      tanggalReview: "20 September 2025",
      reviewer: "Dr. Siti Nurhaliza, M.T",
      catatan: "Judul disetujui. Silakan lanjutkan dengan penentuan pembimbing dan mulai penyusunan proposal. Pastikan dataset citra CT Scan sudah dipersiapkan.",
    },
    {
      id: 2,
      status: "ditolak",
      judul: "Sistem Pengenalan Wajah untuk Presensi Menggunakan Deep Learning",
      judulEng: "Face Recognition System for Attendance Using Deep Learning",
      tanggalPengajuan: "15 September 2025",
      tanggalReview: "20 September 2025",
      reviewer: "Dr. Rina Wulandari, M.Sc",
      catatan: "Judul ini sudah diambil atau tidak ada slot tersedia. Silahkan menghubungi dosen pembimbing.",
    },
  ];

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg shadow-lg p-8 mb-6">
        <div className="flex items-center space-x-3">
          <CheckCircle className="w-8 h-8" />
          <div>
            <h1 className="text-2xl font-bold">Status Pengajuan Judul</h1>
            <p className="text-blue-100">Status dan feedback dari pengajuan judul skripsi Anda</p>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-start space-x-3">
        <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-blue-900">Proses review akan dilakukan dan akan dikirimkan melalui email setelah review selesai.</p>
      </div>

      <div>
        {statusData.map((item) => (
          <StatusCard key={item.id} status={item.status} judul={item.judul} judulEng={item.judulEng} tanggalPengajuan={item.tanggalPengajuan} tanggalReview={item.tanggalReview} reviewer={item.reviewer} catatan={item.catatan} />
        ))}
      </div>

      {statusData.length === 0 && (
        <div className="bg-white border rounded-lg p-12 text-center">
          <Clock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Belum Ada Pengajuan</h3>
          <p className="text-gray-600">Anda belum memiliki pengajuan judul skripsi.</p>
        </div>
      )}
    </div>
  );
};

export default StatusPage;
