import React from "react";
import { Calendar, FileText, Activity, CheckCircle, Clock, Square } from "lucide-react";
import Header from "../components/Header";
import Navigation from "../components/Navigation";
import InfoCard from "../components/InfoCard";
import ProgressBar from "../components/ProgressBar";
import ActionCard from "../components/ActionCard";
import PengajuanPage from "./PengajuanPage";
import StatusPage from "./StatusPage";
import BimbinganPage from "./BimbinganPage";

const WelcomeCard = ({ userName, userNim, currentDate }) => {
  return (
    <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg shadow-lg p-8 mb-6">
      <h2 className="text-2xl font-bold mb-2">Selamat Datang, {userName}!</h2>
      <p className="text-blue-100 mb-4">{userNim}</p>
      <div className="flex items-center text-blue-100">
        <Calendar className="w-4 h-4 mr-2" />
        <span>{currentDate}</span>
      </div>
    </div>
  );
};

const ProgressItem = ({ status, title, subtitle }) => {
  const icons = {
    completed: <CheckCircle className="w-5 h-5 text-green-600" />,
    pending: <Clock className="w-5 h-5 text-yellow-600" />,
    upcoming: <Square className="w-5 h-5 text-gray-400" />,
  };

  const bgColors = {
    completed: "bg-green-50",
    pending: "bg-yellow-50",
    upcoming: "bg-gray-50",
  };

  return (
    <div className={`${bgColors[status]} border rounded-lg p-4 mb-3 flex items-center space-x-4`}>
      <div>{icons[status]}</div>
      <div className="flex-1">
        <h4 className="font-semibold text-gray-900">{title}</h4>
        {subtitle && <p className="text-sm text-gray-600">{subtitle}</p>}
      </div>
    </div>
  );
};

const DashboardPage = () => {
  const [activeTab, setActiveTab] = React.useState("dashboard");

  const userData = {
    name: "Muhammad Rizki",
    nim: "18523001",
    currentDate: "Senin, 27 Oktober 2025",
  };

  const progressData = {
    overall: 45,
    items: [
      { status: "completed", title: "Pengajuan Judul", subtitle: null },
      { status: "completed", title: "Persetujuan DPA", subtitle: "Dr. Ahmad Fadli, M.Kom" },
      { status: "completed", title: "Persetujuan Kaprodi", subtitle: "Dr. Budi Santoso, M.Kom" },
      { status: "pending", title: "Proses Bimbingan", subtitle: "Sedang berlangsung - 5 dari 8 sesi" },
      { status: "upcoming", title: "Sidang Akhir", subtitle: "Belum terjadwal" },
    ],
  };

  // Jika tab pengajuan aktif, tampilkan halaman pengajuan
  if (activeTab === "pengajuan") {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header userName={userData.name} userNim={userData.nim} />
        <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
        <PengajuanPage />
      </div>
    );
  }

  // Jika tab status aktif, tampilkan halaman status
  if (activeTab === "status") {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header userName={userData.name} userNim={userData.nim} />
        <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
        <StatusPage />
      </div>
    );
  }

  // Jika tab bimbingan aktif, tampilkan halaman bimbingan
  if (activeTab === "bimbingan") {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header userName={userData.name} userNim={userData.nim} />
        <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
        <BimbinganPage />
      </div>
    );
  }

  // Tampilan dashboard default
  return (
    <div className="min-h-screen bg-gray-50">
      <Header userName={userData.name} userNim={userData.nim} />
      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="container mx-auto px-6 py-8">
        <WelcomeCard userName={userData.name} userNim={userData.nim} currentDate={userData.currentDate} />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <InfoCard icon="⚠️" title="Menunggu Persetujuan" subtitle="Dalam Proses" badge="Dalam Proses" badgeColor="yellow" />
          <InfoCard icon="👨‍🏫" title="Dr. Ahmad Fadli, M.Kom" subtitle="140230000" badge="Pembimbing Akademik" badgeColor="blue" />
          <InfoCard icon="👩‍🏫" title="Dr. Siti Nurhaliza, M.T" subtitle="140230001" badge="Pembimbing Pengujian" badgeColor="red" />
          <InfoCard icon="✅" title="5 dari 8" subtitle="Sesi terlaksana" badge="Bimbingan" badgeColor="green" />
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Progress Skripsi Anda</h2>
          <p className="text-gray-600 mb-6">Timeline pengerjaan skripsi dari awal hingga sidang</p>

          <ProgressBar progress={progressData.overall} />

          <div>
            {progressData.items.map((item, index) => (
              <ProgressItem key={index} status={item.status} title={item.title} subtitle={item.subtitle} />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ActionCard
            icon={<FileText className="w-6 h-6" />}
            title="Ajukan Judul Baru"
            description="Ajukan judul skripsi atau lakukan revisi judul yang ada"
            buttonText="Buat Pengajuan"
            buttonColor="blue"
            onClick={() => setActiveTab("pengajuan")}
          />
          <ActionCard
            icon={<Activity className="w-6 h-6" />}
            title="Cek Status Pengajuan"
            description="Lihat status dan feedback dari dosen pembimbing"
            buttonText="Lihat Status"
            buttonColor="yellow"
            onClick={() => setActiveTab("status")}
          />
        </div>
      </main>
    </div>
  );
};

export default DashboardPage;
