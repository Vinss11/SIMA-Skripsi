import React, { useState } from "react";
import { FileEdit, Lightbulb, Info, Search, Send, RotateCcw, ChevronDown } from "lucide-react";

// Component untuk pilihan jenis pengajuan
const PengajuanTypeSelector = ({ selectedType, onTypeChange }) => {
  return (
    <div className="bg-white rounded-lg border p-6 mb-6">
      <h2 className="text-lg font-bold text-gray-900 mb-2">Pilih Jenis Pengajuan</h2>
      <p className="text-sm text-gray-600 mb-4">Anda dapat memilih judul yang disediakan dosen atau mengajukan judul sendiri</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button onClick={() => onTypeChange("dosen")} className={`flex items-start space-x-3 p-4 rounded-lg border-2 transition-all ${selectedType === "dosen" ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-blue-300"}`}>
          <FileEdit className="w-5 h-5 text-blue-600 mt-1" />
          <div className="text-left">
            <h3 className="font-semibold text-gray-900">Judul dari Dosen</h3>
            <p className="text-sm text-gray-600">Pilih dari daftar judul yang sudah disediakan oleh dosen pembimbing</p>
          </div>
        </button>

        <button onClick={() => onTypeChange("sendiri")} className={`flex items-start space-x-3 p-4 rounded-lg border-2 transition-all ${selectedType === "sendiri" ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-blue-300"}`}>
          <Lightbulb className="w-5 h-5 text-blue-600 mt-1" />
          <div className="text-left">
            <h3 className="font-semibold text-gray-900">Judul Sendiri</h3>
            <p className="text-sm text-gray-600">Ajukan judul penelitian yang Anda buat sendiri</p>
          </div>
        </button>
      </div>
    </div>
  );
};

// Component untuk daftar judul dari dosen
const JudulCard = ({ judul, selected, onSelect }) => {
  return (
    <div onClick={onSelect} className={`border rounded-lg p-4 mb-3 cursor-pointer transition-all ${selected ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-blue-300"}`}>
      <h3 className="font-semibold text-gray-900 mb-2">{judul.title}</h3>
      <p className="text-sm text-gray-600 mb-3">{judul.subtitle}</p>
      <div className="flex items-center space-x-4 text-sm">
        <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-medium">{judul.badge}</span>
        <span className="text-gray-600">{judul.pembimbing}</span>
        {judul.kuota && <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full font-medium">{judul.kuota}</span>}
        {judul.slot && <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium">{judul.slot}</span>}
      </div>
      <p className="text-sm text-gray-600 mt-3">{judul.description}</p>
    </div>
  );
};

// Form Judul dari Dosen
const FormJudulDosen = ({ onSubmit, onReset }) => {
  const [selectedJudul, setSelectedJudul] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAll, setShowAll] = useState(false);

  const judulList = [
    {
      id: 1,
      title: "Sistem Deteksi Intrusi Jaringan Menggunakan Machine Learning",
      subtitle: "Network Intrusion Detection System using Machine Learning",
      badge: "Sistem Siber",
      pembimbing: "Dr. Ahmad Fadli, M.Kom",
      kuota: "Kuota Penuh",
      description: "Pengembangan sistem deteksi intrusi jaringan berbasis machine learning untuk mengidentifikasi dan mencegah serangan siber secara real-time.",
    },
    {
      id: 2,
      title: "Implementasi Blockchain untuk Keamanan Data Elektronik Medical Record",
      subtitle: "Blockchain Implementation for Electronic Medical Record Data Security",
      badge: "Sistem Siber",
      pembimbing: "Dr. Budi Santoso, M.Kom",
      slot: "Tersedia 2 slot",
      description: "Penelitian untuk mengimplementasikan teknologi blockchain dalam mengamankan data rekam medis elektronik dan meningkatkan privacy pasien.",
    },
    {
      id: 3,
      title: "Sistem Pengenalan Wajah untuk Presensi Menggunakan Deep Learning",
      subtitle: "Face Recognition System for Attendance Using Deep Learning",
      badge: "Computer Vision",
      pembimbing: "Dr. Siti Nurhaliza, M.T",
      slot: "Tersedia 3 slot",
      description: "Pengembangan sistem presensi otomatis menggunakan teknologi pengenalan wajah berbasis deep learning untuk meningkatkan efisiensi absensi.",
    },
  ];

  const filteredJudul = judulList.filter((judul) => judul.title.toLowerCase().includes(searchQuery.toLowerCase()) || judul.subtitle.toLowerCase().includes(searchQuery.toLowerCase()));

  const displayedJudul = showAll ? filteredJudul : filteredJudul.slice(0, 3);

  return (
    <div>
      <div className="bg-white rounded-lg border p-6 mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-2">Daftar Judul dari Dosen</h2>
        <p className="text-sm text-gray-600 mb-4">Pilih salah satu judul yang tersedia untuk diajukan</p>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Cari judul atau dosen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-blue-600 font-medium">Semua Bidang ↑</button>
        </div>

        <div>
          {displayedJudul.map((judul) => (
            <JudulCard key={judul.id} judul={judul} selected={selectedJudul === judul.id} onSelect={() => setSelectedJudul(judul.id)} />
          ))}
        </div>

        {filteredJudul.length > 3 && (
          <button onClick={() => setShowAll(!showAll)} className="w-full mt-4 py-2 text-blue-600 font-medium hover:bg-blue-50 rounded-lg transition-colors">
            {showAll ? "Tampilkan Lebih Sedikit" : `Lihat ${filteredJudul.length - 3} Judul Lainnya`}
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Detail Judul Terpilih</h2>
        <p className="text-sm text-gray-600 mb-4">Detail dari judul yang Anda pilih (akan otomatis terisi)</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Judul Skripsi (Bahasa Indonesia) *</label>
            <input type="text" disabled className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Judul Skripsi (Bahasa Inggris) *</label>
            <input type="text" disabled className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50" />
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Bidang Minat *</label>
          <div className="relative">
            <select disabled className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 appearance-none">
              <option>Pilih bidang minat</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          </div>
        </div>

        <div className="flex justify-end space-x-3">
          <button onClick={onReset} className="flex items-center space-x-2 px-6 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            <RotateCcw className="w-4 h-4" />
            <span>Reset</span>
          </button>
          <button
            onClick={onSubmit}
            disabled={!selectedJudul}
            className={`flex items-center space-x-2 px-6 py-2 rounded-lg font-medium transition-colors ${selectedJudul ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-gray-300 text-gray-500 cursor-not-allowed"}`}
          >
            <Send className="w-4 h-4" />
            <span>Ajukan Judul Terpilih</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// Form Judul Sendiri
const FormJudulSendiri = ({ onSubmit, onReset }) => {
  const [formData, setFormData] = useState({
    judulIndo: "",
    judulEng: "",
    bidangMinat: "",
    latarBelakang: "",
    keyword: "",
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="bg-white rounded-lg border p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-4">Informasi Judul</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Judul Skripsi (Bahasa Indonesia) *</label>
          <input type="text" name="judulIndo" value={formData.judulIndo} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Judul Skripsi (Bahasa Inggris) *</label>
          <input type="text" name="judulEng" value={formData.judulEng} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Bidang Minat *</label>
        <div className="relative">
          <select name="bidangMinat" value={formData.bidangMinat} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none">
            <option value="">Pilih bidang minat</option>
            <option value="sistem-siber">Sistem Siber</option>
            <option value="computer-vision">Computer Vision</option>
            <option value="data-science">Data Science</option>
            <option value="web-development">Web Development</option>
            <option value="mobile-development">Mobile Development</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
        </div>
      </div>

      <div className="border-t pt-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Deskripsi Penelitian</h2>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Latar Belakang & Rumusan Masalah *</label>
          <textarea
            name="latarBelakang"
            value={formData.latarBelakang}
            onChange={handleChange}
            rows="4"
            placeholder="Jelaskan latar belakang penelitian dan rumusan masalah yang akan diselesaikan"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          ></textarea>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Keyword *</label>
          <input
            type="text"
            name="keyword"
            value={formData.keyword}
            onChange={handleChange}
            placeholder="Pisahkan dengan koma (contoh: machine learning, cybersecurity, intrusion detection)"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex justify-end space-x-3">
          <button onClick={onReset} className="flex items-center space-x-2 px-6 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            <RotateCcw className="w-4 h-4" />
            <span>Reset</span>
          </button>
          <button onClick={() => onSubmit(formData)} className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">
            <Send className="w-4 h-4" />
            <span>Ajukan Judul Terpilih</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// Main Pengajuan Page Component
const PengajuanPage = () => {
  const [selectedType, setSelectedType] = useState("dosen");

  const handleSubmit = (data) => {
    console.log("Form submitted:", data);
    alert("Pengajuan berhasil dikirim!");
  };

  const handleReset = () => {
    if (window.confirm("Apakah Anda yakin ingin mereset form?")) {
      window.location.reload();
    }
  };

  return (
    <div>
      <div className="container mx-auto px-6 py-8">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg shadow-lg p-8 mb-6">
          <div className="flex items-center space-x-3">
            <FileEdit className="w-8 h-8" />
            <div>
              <h1 className="text-2xl font-bold">Pengajuan Judul Skripsi</h1>
              <p className="text-blue-100">Pilih judul dari dosen atau ajukan judul sendiri</p>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-start space-x-3">
          <Info className="w-5 h-5 text-blue-600 mt-0.5" />
          <p className="text-sm text-blue-900">Pastikan judul yang diajukan sesuai dengan bidang minat informatika dan belum pernah diajukan sebelumnya.</p>
        </div>

        <PengajuanTypeSelector selectedType={selectedType} onTypeChange={setSelectedType} />

        {selectedType === "dosen" ? <FormJudulDosen onSubmit={handleSubmit} onReset={handleReset} /> : <FormJudulSendiri onSubmit={handleSubmit} onReset={handleReset} />}
      </div>
    </div>
  );
};

export default PengajuanPage;
