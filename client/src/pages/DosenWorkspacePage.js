import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  BookOpenCheck,
  CalendarRange,
  ClipboardList,
  Download,
  Eye,
  FileSpreadsheet,
  LayoutDashboard,
  ListChecks,
  LogOut,
  MessageSquareText,
  RefreshCcw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Upload,
  GraduationCap,
  UserCircle2,
  Users,
} from "lucide-react";
import Swal from "sweetalert2";
import MenuSectionHeader from "../components/MenuSectionHeader";
import DosenBimbinganReviewPage from "./DosenBimbinganReviewPage";
import DosenDokumenSidangReviewPage from "./DosenDokumenSidangReviewPage";
import DosenSidangKetersediaanPage from "./DosenSidangKetersediaanPage";
import SekretarisSidangManagementPage from "./SekretarisSidangManagementPage";

const TOPIK_PAGE_SIZE = 20;
const MASTER_TOPIK_PAGE_SIZE = 20;
const MAHASISWA_MASTER_PAGE_SIZE = 20;
const DOSEN_GRID_PAGE_SIZE = 20;
const MAHASISWA_MASTER_FILTER_INITIAL = {
  angkatan: "",
  semester_penjaluran: "",
  periode: "",
  penjaluran: "",
  tipe_pendaftaran: "",
};
const MASTER_DOSEN_TAB_OPTIONS = [
  { key: "penanggung-jawab", label: "Penanggung Jawab Penjaluran" },
  { key: "kuota-bimbingan", label: "Kuota Bimbingan Mahasiswa" },
];
const TOPIK_UPLOAD_PREVIEW_MAX_ROWS = 10;
const TOPIK_UPLOAD_PREVIEW_PAGE_SIZE = 5;
const TOPIK_CLUSTER_OPTIONS = ["Sirkel", "Siber", "ITSC", "MVK"];
const TOPIK_CLUSTER_CODE_BY_LABEL = {
  Sirkel: "SIRKEL",
  Siber: "SIBER",
  ITSC: "ITSC",
  MVK: "MVK",
};
const TOPIK_CLUSTER_LABEL_BY_CODE = {
  SIRKEL: "Sirkel",
  SIBER: "Siber",
  ITSC: "ITSC",
  MVK: "MVK",
};
const PERIODE_MASTER_KETUA_FIELDS = [
  {
    key: "ketua_itsc_dosen_id",
    code: "ITSC",
    label: "Ketua ITSC (Informatika Teori & Sistem Cerdas)",
  },
  {
    key: "ketua_sirkel_dosen_id",
    code: "SIRKEL",
    label: "Ketua SIRKEL (Sistem Informasi & Rekayasa Perangkat Lunak)",
  },
  {
    key: "ketua_siber_dosen_id",
    code: "SIBER",
    label: "Ketua SIBER (Sistem Siber)",
  },
  {
    key: "ketua_mvk_dosen_id",
    code: "MVK",
    label: "Ketua MVK (Multimedia & Visi Komputer)",
  },
];
const PERIODE_MASTER_JALUR_FIELDS = [
  {
    key: "pengawas_magang_dosen_id",
    label: "Dosen Pengawas Magang",
    optionLabel: "Pilih dosen pengawas magang",
  },
  {
    key: "pengawas_pengabdian_dosen_id",
    label: "Dosen Pengampu Pengabdian Masyarakat",
    optionLabel: "Pilih dosen pengampu pengabdian",
  },
  {
    key: "pengawas_perintisan_bisnis_dosen_id",
    label: "Dosen Pengampu Perintisan Bisnis",
    optionLabel: "Pilih dosen pengampu perintisan bisnis",
  },
];
const PERIODE_MASTER_ALL_FIELDS = [...PERIODE_MASTER_KETUA_FIELDS, ...PERIODE_MASTER_JALUR_FIELDS];
const PERIODE_MASTER_INITIAL = {
  ketua_itsc_dosen_id: "",
  ketua_sirkel_dosen_id: "",
  ketua_siber_dosen_id: "",
  ketua_mvk_dosen_id: "",
  pengawas_magang_dosen_id: "",
  pengawas_pengabdian_dosen_id: "",
  pengawas_perintisan_bisnis_dosen_id: "",
};
function buildPeriodeMasterSearchInitial() {
  const next = {};
  for (const item of PERIODE_MASTER_ALL_FIELDS) {
    next[item.key] = "";
  }
  return next;
}

function buildMahasiswaMasterPeriodeFilterValue(row) {
  const periodeLabel = String(row?.periode_label || "").trim();
  if (periodeLabel) return periodeLabel;

  const tahunAkademik = String(row?.tahun_akademik || "").trim();
  const semesterAkademik = String(row?.semester_akademik || "").trim();
  if (tahunAkademik && semesterAkademik) {
    return `${tahunAkademik} - ${formatLabel(semesterAkademik)}`;
  }
  if (tahunAkademik) return tahunAkademik;
  if (semesterAkademik) return formatLabel(semesterAkademik);
  return "";
}
const PERIODE_FORM_INITIAL = {
  tahun_akademik: "",
  semester: "ganjil",
  tanggal_mulai: "",
  tanggal_selesai: "",
};
const RESEARCH_CLUSTER_EDITOR_FIELDS = [
  {
    key: "ITSC",
    label: "Ketua ITSC (Informatika Teori & Sistem Cerdas)",
  },
  {
    key: "SIRKEL",
    label: "Ketua SIRKEL (Sistem Informasi & Rekayasa Perangkat Lunak)",
  },
  {
    key: "SIBER",
    label: "Ketua SIBER (Sistem Siber)",
  },
  {
    key: "MVK",
    label: "Ketua MVK (Multimedia & Visi Komputer)",
  },
];

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatLabel(value) {
  if (!value) return "-";
  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatPeriodeMasterDosenInputLabel(dosen) {
  if (!dosen) return "";
  const nama = String(dosen?.nama || "").trim();
  const nik = String(dosen?.nik || "").trim();
  if (nama && nik) return `${nama} - NIK: ${nik}`;
  if (nama) return nama;
  if (nik) return `NIK: ${nik}`;
  return "";
}

function escapeHtml(value) {
  return String(value ?? "-")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getSubmissionStatusBadgeClass(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "approved") return "bg-[#137748] text-white";
  if (normalized === "rejected") return "bg-[#b73a3a] text-white";
  if (normalized === "pending") return "bg-[#fdf1d4] text-[#a06a00]";
  return "bg-[#eef2fb] text-[#5c6d95]";
}

function showSuccessToast(message) {
  Swal.fire({
    toast: true,
    position: "top-end",
    icon: "success",
    title: message,
    showConfirmButton: false,
    timer: 2200,
    timerProgressBar: true,
  });
}

function showErrorToast(message) {
  Swal.fire({
    toast: true,
    position: "top-end",
    icon: "error",
    title: message,
    showConfirmButton: false,
    timer: 2600,
    timerProgressBar: true,
  });
}

function toDateInputValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function normalizeResearchClusterCode(value) {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw) return "";
  if (raw === "SIRKER") return "SIRKEL";
  if (raw.includes("SISTEM INFORMASI") || raw.includes("REKAYASA PERANGKAT LUNAK") || raw.includes("SIRKEL")) {
    return "SIRKEL";
  }
  if (raw.includes("SIBER")) return "SIBER";
  if (raw.includes("MULTIMEDIA") || raw.includes("VISI KOMPUTER") || raw.includes("MVK")) return "MVK";
  if (raw.includes("INFORMATIKA TEORI") || raw.includes("SISTEM CERDAS") || raw.includes("ITSC")) return "ITSC";
  return raw;
}

function normalizeTopikClusterCode(value) {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw) return null;
  if (raw === "SIRKER") return "SIRKEL";
  if (raw.includes("SISTEM INFORMASI") || raw.includes("REKAYASA PERANGKAT LUNAK") || raw.includes("SIRKEL")) {
    return "SIRKEL";
  }
  if (raw.includes("SIBER")) return "SIBER";
  if (raw.includes("MULTIMEDIA") || raw.includes("VISI KOMPUTER") || raw.includes("MVK")) return "MVK";
  if (raw.includes("INFORMATIKA TEORI") || raw.includes("SISTEM CERDAS") || raw.includes("ITSC")) return "ITSC";
  if (TOPIK_CLUSTER_LABEL_BY_CODE[raw]) return raw;
  return null;
}

function normalizeTopikClusterLabel(value) {
  const code = normalizeTopikClusterCode(value);
  if (!code) return null;
  return TOPIK_CLUSTER_LABEL_BY_CODE[code] || null;
}

function resolveTopikClusterFromKode(kode) {
  const normalizedKode = String(kode || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9]/g, "");
  if (!normalizedKode) return null;
  const prefix = normalizedKode.replace(/[0-9].*$/, "");
  const code = normalizeTopikClusterCode(prefix);
  if (!code) return null;
  return {
    code,
    label: TOPIK_CLUSTER_LABEL_BY_CODE[code] || null,
  };
}

function pickTopikUploadField(rawRow, candidates) {
  if (!rawRow || typeof rawRow !== "object") return "";
  for (const key of candidates) {
    const value = rawRow[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }
  return "";
}

function buildNavSections(isSekretaris) {
  if (!isSekretaris) {
    return [
      {
        key: "umum",
        label: "Umum",
        items: [{ id: "dashboard", label: "Dashboard", icon: LayoutDashboard }],
      },
      {
        key: "mahasiswa",
        label: "Mahasiswa",
        items: [
          { id: "mahasiswa-bimbingan", label: "Mahasiswa Bimbingan", icon: GraduationCap },
          { id: "bimbingan-review", label: "Review Bimbingan", icon: MessageSquareText },
          { id: "submissions", label: "Pengajuan Mahasiswa", icon: ClipboardList },
          { id: "permohonan-extend", label: "Permohonan Extend", icon: ShieldAlert },
          { id: "pamit", label: "Pamit Mahasiswa", icon: Users },
        ],
      },
      {
        key: "dosen",
        label: "Dosen",
        items: [{ id: "topik", label: "Manajemen Topik", icon: BookOpenCheck }],
      },
      {
        key: "sidang",
        label: "Sidang",
        items: [
          { id: "dokumen-sidang-review", label: "Review Dokumen Sidang", icon: FileSpreadsheet },
          { id: "ketersediaan-sidang", label: "Ketersediaan Sidang", icon: CalendarRange },
        ],
      },
    ];
  }

  return [
    {
      key: "umum",
      label: "Umum",
      items: [{ id: "dashboard", label: "Dashboard", icon: LayoutDashboard }],
    },
    {
      key: "mahasiswa",
      label: "Mahasiswa",
      items: [
        { id: "master-mahasiswa", label: "Master Mahasiswa", icon: GraduationCap },
        { id: "mahasiswa-bimbingan", label: "Mahasiswa Bimbingan", icon: GraduationCap },
        { id: "bimbingan-review", label: "Review Bimbingan", icon: MessageSquareText },
        { id: "submissions", label: "Pengajuan Mahasiswa", icon: ClipboardList },
        { id: "permohonan-extend", label: "Permohonan Extend", icon: ShieldAlert },
        { id: "pamit", label: "Pamit Mahasiswa", icon: Users },
      ],
    },
    {
      key: "dosen",
      label: "Dosen",
      items: [
        { id: "master-dosen", label: "Master Dosen", icon: Users },
        { id: "topik", label: "Manajemen Topik", icon: BookOpenCheck },
        { id: "master-topik", label: "Master Topik", icon: BookOpenCheck },
      ],
    },
    {
      key: "penjaluran",
      label: "Penjaluran",
      items: [
        { id: "penjaluran", label: "Manajemen Penjaluran", icon: ListChecks },
        { id: "periode", label: "Manajemen Periode", icon: CalendarRange },
      ],
    },
    {
      key: "sidang",
      label: "Sidang",
      items: [{ id: "sidang-akhir", label: "Manajemen Sidang", icon: CalendarRange }],
    },
  ];
}

function buildTabHeaders(isSekretaris) {
  const baseHeaders = {
    dashboard: {
      icon: LayoutDashboard,
      title: "Dashboard Dosen",
      subtitle: "Ringkasan review pengajuan, status pamit, topik aktif, dan kuota bimbingan.",
    },
    "mahasiswa-bimbingan": {
      icon: GraduationCap,
      title: "Mahasiswa Bimbingan",
      subtitle: "Lihat histori penjaluran mahasiswa yang sedang Anda bimbing.",
    },
    "bimbingan-review": {
      icon: MessageSquareText,
      title: "Review Bimbingan",
      subtitle: "Terima, jadwalkan, dan review sesi bimbingan mahasiswa.",
    },
    "dokumen-sidang-review": {
      icon: FileSpreadsheet,
      title: "Review Dokumen Sidang",
      subtitle: "Review dokumen CEPT, transkrip, dan draft skripsi per mahasiswa.",
    },
    "ketersediaan-sidang": {
      icon: CalendarRange,
      title: "Ketersediaan Sidang",
      subtitle: "Isi ketersediaan hari/sesi sebagai penguji, tipe penilaian, dan kondisi fisik.",
    },
    submissions: {
      icon: ClipboardList,
      title: "Pengajuan Mahasiswa",
      subtitle: "Review pengajuan judul mahasiswa, lalu putuskan approve atau tolak.",
    },
    "permohonan-extend": {
      icon: ShieldAlert,
      title: "Permohonan Extend",
      subtitle: "Review permintaan izin melanjutkan skripsi mahasiswa semester ke-3.",
    },
    pamit: {
      icon: Users,
      title: "Pamit Mahasiswa",
      subtitle: "Kelola permintaan pamit mahasiswa yang masih aktif di bimbingan Anda.",
    },
    topik: {
      icon: BookOpenCheck,
      title: "Manajemen Topik",
      subtitle: "Tambah, upload, dan pantau topik yang Anda tawarkan ke mahasiswa.",
    },
    "master-topik": {
      icon: BookOpenCheck,
      title: "Master Topik",
      subtitle: "Monitoring seluruh topik yang tersedia di sistem.",
    },
  };

  if (!isSekretaris) {
    return baseHeaders;
  }

  return {
    ...baseHeaders,
    "master-mahasiswa": {
      icon: GraduationCap,
      title: "Master Data Mahasiswa",
      subtitle: "Lihat histori penjaluran mahasiswa secara lengkap dalam mode baca.",
    },
    "master-dosen": {
      icon: Users,
      title: "Master Dosen",
      subtitle: "Atur penanggung jawab penjaluran dan kuota bimbingan dosen.",
    },
    penjaluran: {
      icon: ListChecks,
      title: "Manajemen Penjaluran",
      subtitle: "Pantau pendaftaran jalur mahasiswa serta tindak lanjut approval penjaluran.",
    },
    periode: {
      icon: CalendarRange,
      title: "Manajemen Periode",
      subtitle: "Buka, lihat, dan kelola periode penjaluran sesuai jadwal akademik.",
    },
    "sidang-akhir": {
      icon: CalendarRange,
      title: "Manajemen Sidang",
      subtitle: "Set periode sidang, ruangan, jadwal, serta auto-assign penguji.",
    },
  };
}

function DosenWorkspacePage({ session, apiBaseUrl, onLogout, onSessionExpired, isSekretaris = false }) {
  const navSections = useMemo(() => buildNavSections(isSekretaris), [isSekretaris]);
  const tabHeaders = useMemo(() => buildTabHeaders(isSekretaris), [isSekretaris]);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [masterDosenTab, setMasterDosenTab] = useState("penanggung-jawab");
  const [topikMode, setTopikMode] = useState("list");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isBimbinganReviewListMode, setIsBimbinganReviewListMode] = useState(true);

  const [submissions, setSubmissions] = useState([]);
  const [submissionQuery, setSubmissionQuery] = useState("");
  const [submissionPage, setSubmissionPage] = useState(1);
  const [submissionMode, setSubmissionMode] = useState("list");
  const [selectedSubmissionId, setSelectedSubmissionId] = useState(null);
  const [submissionDetail, setSubmissionDetail] = useState(null);
  const [loadingSubmissionDetail, setLoadingSubmissionDetail] = useState(false);
  const [submissionDecision, setSubmissionDecision] = useState("approve");
  const [submissionKeterangan, setSubmissionKeterangan] = useState("");
  const [izinLanjutRows, setIzinLanjutRows] = useState([]);
  const [izinLanjutQuery, setIzinLanjutQuery] = useState("");
  const [izinLanjutPage, setIzinLanjutPage] = useState(1);
  const [pamitRows, setPamitRows] = useState([]);
  const [pamitPage, setPamitPage] = useState(1);
  const [kuotaData, setKuotaData] = useState(null);

  const [topikRows, setTopikRows] = useState([]);
  const [topikQuery, setTopikQuery] = useState("");
  const [topikPage, setTopikPage] = useState(1);
  const [masterTopikRows, setMasterTopikRows] = useState([]);
  const [masterTopikQuery, setMasterTopikQuery] = useState("");
  const [masterTopikPage, setMasterTopikPage] = useState(1);
  const [masterDosenKuotaOverview, setMasterDosenKuotaOverview] = useState({
    summary: null,
    dosens: [],
  });
  const [masterDosenKuotaQuery, setMasterDosenKuotaQuery] = useState("");
  const [masterDosenKuotaPage, setMasterDosenKuotaPage] = useState(1);
  const [masterDosenKuotaMode, setMasterDosenKuotaMode] = useState("all");
  const [masterDosenKuotaValue, setMasterDosenKuotaValue] = useState("5");
  const [masterDosenSelectedDosenIds, setMasterDosenSelectedDosenIds] = useState([]);
  const [savingMasterDosenKuota, setSavingMasterDosenKuota] = useState(false);

  const [topikForm, setTopikForm] = useState({
    kode: "",
    judul: "",
    deskripsi: "",
    cluster: "Sirkel",
  });
  const allowedTopikClusters = useMemo(() => {
    const klasterRows = Array.isArray(kuotaData?.dosen?.klasters) ? kuotaData.dosen.klasters : [];
    const labels = [];
    for (const item of klasterRows) {
      const normalized = normalizeTopikClusterLabel(item?.kode || item?.nama);
      if (normalized && !labels.includes(normalized)) {
        labels.push(normalized);
      }
    }
    return labels.length > 0 ? labels : TOPIK_CLUSTER_OPTIONS;
  }, [kuotaData?.dosen?.klasters]);
  const [topikUploadFile, setTopikUploadFile] = useState(null);
  const [uploadingTopik, setUploadingTopik] = useState(false);
  const [savingUploadedTopik, setSavingUploadedTopik] = useState(false);
  const [uploadTopikResult, setUploadTopikResult] = useState(null);
  const [topikUploadPreviewPage, setTopikUploadPreviewPage] = useState(1);
  const topikUploadPreviewRows = useMemo(() => {
    const successRows = Array.isArray(uploadTopikResult?.data?.detail_berhasil)
      ? uploadTopikResult.data.detail_berhasil
      : [];
    const failedRows = Array.isArray(uploadTopikResult?.data?.detail_gagal)
      ? uploadTopikResult.data.detail_gagal
      : [];

    const normalizedSuccess = successRows.map((item, index) => ({
      key: `ok-${item?.row ?? index}-${item?.kode ?? index}`,
      nomor: index + 1,
      baris: item?.row ?? "-",
      kode: String(item?.kode || "-"),
      cluster: String(item?.cluster || "-"),
      judul: String(item?.judul || "-"),
      status: "valid",
      pesan_error: "-",
    }));

    const normalizedFailed = failedRows.map((item, index) => {
      const rawRow = item?.data || {};
      return {
        key: `err-${item?.row ?? index}-${index}`,
        nomor: normalizedSuccess.length + index + 1,
        baris: item?.row ?? "-",
        kode: pickTopikUploadField(rawRow, ["Kode Topik", "kode", "KODE"]) || "-",
        cluster: pickTopikUploadField(rawRow, ["Cluster", "cluster", "CLUSTER"]) || "-",
        judul: pickTopikUploadField(rawRow, ["Judul", "judul", "JUDUL"]) || "-",
        status: "error",
        pesan_error: String(item?.error || "Data tidak valid."),
      };
    });

    return [...normalizedSuccess, ...normalizedFailed];
  }, [uploadTopikResult]);
  const topikUploadPreviewRowsLimited = useMemo(
    () => topikUploadPreviewRows.slice(0, TOPIK_UPLOAD_PREVIEW_MAX_ROWS),
    [topikUploadPreviewRows]
  );
  const topikUploadPreviewTotalPages = useMemo(
    () => Math.max(1, Math.ceil(topikUploadPreviewRowsLimited.length / TOPIK_UPLOAD_PREVIEW_PAGE_SIZE)),
    [topikUploadPreviewRowsLimited.length]
  );
  const topikUploadPreviewRowsPaged = useMemo(() => {
    const start = (topikUploadPreviewPage - 1) * TOPIK_UPLOAD_PREVIEW_PAGE_SIZE;
    return topikUploadPreviewRowsLimited.slice(start, start + TOPIK_UPLOAD_PREVIEW_PAGE_SIZE);
  }, [topikUploadPreviewPage, topikUploadPreviewRowsLimited]);
  const topikUploadValidRows = useMemo(
    () => (Array.isArray(uploadTopikResult?.data?.detail_valid) ? uploadTopikResult.data.detail_valid : []),
    [uploadTopikResult]
  );
  const [savingTopik, setSavingTopik] = useState(false);

  const [pendaftaranRows, setPendaftaranRows] = useState([]);
  const [pendaftaranSearch, setPendaftaranSearch] = useState("");
  const [pendaftaranPage, setPendaftaranPage] = useState(1);
  const [mahasiswaMasterRows, setMahasiswaMasterRows] = useState([]);
  const [mahasiswaMasterQuery, setMahasiswaMasterQuery] = useState("");
  const [mahasiswaMasterFilters, setMahasiswaMasterFilters] = useState({
    ...MAHASISWA_MASTER_FILTER_INITIAL,
  });
  const [mahasiswaMasterFilterDraft, setMahasiswaMasterFilterDraft] = useState({
    ...MAHASISWA_MASTER_FILTER_INITIAL,
  });
  const [showMahasiswaMasterFilterPanel, setShowMahasiswaMasterFilterPanel] = useState(false);
  const [mahasiswaMasterFilterPopupLayout, setMahasiswaMasterFilterPopupLayout] = useState({
    top: 0,
    left: 0,
    width: 430,
    maxHeight: 520,
  });
  const [mahasiswaMasterPage, setMahasiswaMasterPage] = useState(1);
  const [periodeOverview, setPeriodeOverview] = useState({
    active_periode: null,
    draft_periode: null,
    periodes: [],
    dosen_options: [],
    ketua_klaster_options: [],
    master_penanggung_jawab: null,
  });
  const [periodeMasterForm, setPeriodeMasterForm] = useState({ ...PERIODE_MASTER_INITIAL });
  const [periodeMasterSearchQueryByField, setPeriodeMasterSearchQueryByField] = useState(
    buildPeriodeMasterSearchInitial
  );
  const [debouncedPeriodeMasterSearchQueryByField, setDebouncedPeriodeMasterSearchQueryByField] = useState(
    buildPeriodeMasterSearchInitial
  );
  const [activePeriodeMasterSearchField, setActivePeriodeMasterSearchField] = useState("");
  const [periodeMasterErrors, setPeriodeMasterErrors] = useState({});
  const [savingPeriodeMaster, setSavingPeriodeMaster] = useState(false);
  const [periodeForm, setPeriodeForm] = useState({ ...PERIODE_FORM_INITIAL });
  const [periodeFormErrors, setPeriodeFormErrors] = useState({});
  const [periodeMode, setPeriodeMode] = useState("list");
  const [periodePage, setPeriodePage] = useState(1);
  const [editingPeriode, setEditingPeriode] = useState(null);
  const [periodeEditForm, setPeriodeEditForm] = useState({
    tanggal_mulai: "",
    tanggal_selesai: "",
  });
  const [periodeReadonlyRoles, setPeriodeReadonlyRoles] = useState({
    loading: false,
    rows: [],
    error: "",
  });
  const [ketuaKlasterOverview, setKetuaKlasterOverview] = useState({
    active_periode: null,
    periode_terpilih: null,
    periodes: [],
    rows: [],
  });
  const [ketuaKlasterPeriodeId, setKetuaKlasterPeriodeId] = useState("");
  const [ketuaKlasterQuery, setKetuaKlasterQuery] = useState("");
  const [ketuaKlasterPage, setKetuaKlasterPage] = useState(1);
  const [ketuaKlasterDraft, setKetuaKlasterDraft] = useState({});
  const [ketuaKlasterError, setKetuaKlasterError] = useState("");
  const [savingKetuaKlasterId, setSavingKetuaKlasterId] = useState(null);
  const [savingPeriode, setSavingPeriode] = useState(false);
  const [rowActionLoadingId, setRowActionLoadingId] = useState(null);
  const [exportingPendaftaran, setExportingPendaftaran] = useState(false);
  const [exportingMahasiswaMaster, setExportingMahasiswaMaster] = useState(false);

  const periodeMasterSource = useMemo(
    () => (periodeOverview?.master_penanggung_jawab && typeof periodeOverview.master_penanggung_jawab === "object"
      ? periodeOverview.master_penanggung_jawab
      : null),
    [periodeOverview?.master_penanggung_jawab]
  );

  const sessionExpiredRef = useRef(false);
  const mahasiswaMasterFilterTriggerRef = useRef(null);
  const mahasiswaMasterFilterPopupRef = useRef(null);
  const activeTabHeader = tabHeaders[activeTab] || tabHeaders.dashboard;
  const availableTabIds = useMemo(
    () => navSections.flatMap((section) => section.items.map((item) => item.id)),
    [navSections]
  );
  const isPeriodeReadonly =
    String(editingPeriode?.status || (editingPeriode?.is_active ? "active" : "closed")).toLowerCase() ===
    "closed";
  const useGridViewportLayout =
    !loading &&
    ((activeTab === "master-mahasiswa" || activeTab === "mahasiswa-bimbingan") ||
      (activeTab === "bimbingan-review" && isBimbinganReviewListMode) ||
      activeTab === "dokumen-sidang-review" ||
      activeTab === "ketersediaan-sidang" ||
      (activeTab === "submissions" && submissionMode === "list") ||
      activeTab === "permohonan-extend" ||
      activeTab === "pamit" ||
      (isSekretaris && activeTab === "master-dosen") ||
      (isSekretaris && activeTab === "master-topik") ||
      (activeTab === "topik" && topikMode === "list") ||
      (isSekretaris && activeTab === "penjaluran") ||
      (isSekretaris &&
        activeTab === "periode" &&
        periodeMode === "list"));

  useEffect(() => {
    if (activeTab !== "bimbingan-review") {
      setIsBimbinganReviewListMode(true);
    }
  }, [activeTab]);

  useEffect(() => {
    if (!availableTabIds.includes(activeTab)) {
      setActiveTab("dashboard");
    }
  }, [activeTab, availableTabIds]);

  useEffect(() => {
    if (!showMahasiswaMasterFilterPanel) return undefined;
    const handleMouseDown = (event) => {
      const withinTrigger = mahasiswaMasterFilterTriggerRef.current?.contains(event.target);
      const withinPopup = mahasiswaMasterFilterPopupRef.current?.contains(event.target);
      if (withinTrigger || withinPopup) return;
      setShowMahasiswaMasterFilterPanel(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setShowMahasiswaMasterFilterPanel(false);
      }
    };
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showMahasiswaMasterFilterPanel]);

  useEffect(() => {
    if (!(activeTab === "master-mahasiswa" || activeTab === "mahasiswa-bimbingan")) {
      setShowMahasiswaMasterFilterPanel(false);
    }
  }, [activeTab]);

  const updateMahasiswaMasterFilterPopupLayout = useCallback(() => {
    const triggerElement = mahasiswaMasterFilterTriggerRef.current;
    if (!triggerElement || typeof window === "undefined") return;

    const triggerRect = triggerElement.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const margin = 12;
    const gap = 8;
    const preferredWidth = 430;
    const maxAllowedWidth = Math.max(250, viewportWidth - margin * 2);
    const width = Math.min(preferredWidth, maxAllowedWidth);

    let left = triggerRect.right - width;
    if (left < margin) left = margin;
    if (left + width > viewportWidth - margin) {
      left = viewportWidth - margin - width;
    }

    const availableBelow = viewportHeight - triggerRect.bottom - gap - margin;
    const availableAbove = triggerRect.top - gap - margin;
    const openUp = availableBelow < 360 && availableAbove > availableBelow;
    const maxHeight = Math.max(
      280,
      Math.min(620, openUp ? Math.max(280, availableAbove) : Math.max(280, availableBelow))
    );

    let top = openUp ? triggerRect.top - gap - maxHeight : triggerRect.bottom + gap;
    if (top < margin) top = margin;
    if (top + maxHeight > viewportHeight - margin) {
      top = viewportHeight - margin - maxHeight;
    }

    setMahasiswaMasterFilterPopupLayout({
      top,
      left,
      width,
      maxHeight,
    });
  }, []);

  useEffect(() => {
    if (!showMahasiswaMasterFilterPanel) return undefined;
    updateMahasiswaMasterFilterPopupLayout();
    const handleWindowReposition = () => {
      updateMahasiswaMasterFilterPopupLayout();
    };
    window.addEventListener("resize", handleWindowReposition);
    window.addEventListener("scroll", handleWindowReposition, true);
    return () => {
      window.removeEventListener("resize", handleWindowReposition);
      window.removeEventListener("scroll", handleWindowReposition, true);
    };
  }, [showMahasiswaMasterFilterPanel, updateMahasiswaMasterFilterPopupLayout]);

  useEffect(() => {
    if (!(isSekretaris && activeTab === "master-dosen")) {
      setMasterDosenSelectedDosenIds([]);
      setMasterDosenKuotaMode("all");
    }
  }, [activeTab, isSekretaris]);

  useEffect(() => {
    setTopikUploadPreviewPage(1);
  }, [uploadTopikResult]);

  useEffect(() => {
    if (topikUploadPreviewPage > topikUploadPreviewTotalPages) {
      setTopikUploadPreviewPage(topikUploadPreviewTotalPages);
    }
  }, [topikUploadPreviewPage, topikUploadPreviewTotalPages]);

  useEffect(() => {
    setTopikForm((prev) => {
      if (allowedTopikClusters.includes(prev.cluster)) {
        return prev;
      }
      return {
        ...prev,
        cluster: allowedTopikClusters[0] || TOPIK_CLUSTER_OPTIONS[0],
      };
    });
  }, [allowedTopikClusters]);

  useEffect(() => {
    const nextMasterForm = {
      ketua_itsc_dosen_id: periodeMasterSource?.ketua_itsc_dosen_id
        ? String(periodeMasterSource.ketua_itsc_dosen_id)
        : "",
      ketua_sirkel_dosen_id: periodeMasterSource?.ketua_sirkel_dosen_id
        ? String(periodeMasterSource.ketua_sirkel_dosen_id)
        : "",
      ketua_siber_dosen_id: periodeMasterSource?.ketua_siber_dosen_id
        ? String(periodeMasterSource.ketua_siber_dosen_id)
        : "",
      ketua_mvk_dosen_id: periodeMasterSource?.ketua_mvk_dosen_id
        ? String(periodeMasterSource.ketua_mvk_dosen_id)
        : "",
      pengawas_magang_dosen_id: periodeMasterSource?.pengawas_magang_dosen_id
        ? String(periodeMasterSource.pengawas_magang_dosen_id)
        : "",
      pengawas_pengabdian_dosen_id: periodeMasterSource?.pengawas_pengabdian_dosen_id
        ? String(periodeMasterSource.pengawas_pengabdian_dosen_id)
        : "",
      pengawas_perintisan_bisnis_dosen_id: periodeMasterSource?.pengawas_perintisan_bisnis_dosen_id
        ? String(periodeMasterSource.pengawas_perintisan_bisnis_dosen_id)
        : "",
    };
    const nextSearchQuery = buildPeriodeMasterSearchInitial();
    for (const item of PERIODE_MASTER_ALL_FIELDS) {
      const associationKey = item.key.replace(/_id$/, "");
      nextSearchQuery[item.key] = formatPeriodeMasterDosenInputLabel(periodeMasterSource?.[associationKey]);
    }
    setPeriodeMasterForm(nextMasterForm);
    setPeriodeMasterSearchQueryByField(nextSearchQuery);
    setDebouncedPeriodeMasterSearchQueryByField(nextSearchQuery);
    setActivePeriodeMasterSearchField("");
    setPeriodeMasterErrors({});
  }, [periodeMasterSource]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedPeriodeMasterSearchQueryByField(periodeMasterSearchQueryByField);
    }, 280);
    return () => window.clearTimeout(timer);
  }, [periodeMasterSearchQueryByField]);

  const fetchWithAuth = useCallback(
    async (path, options = {}) => {
      const response = await fetch(`${apiBaseUrl}${path}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${session.token}`,
          "Content-Type": "application/json",
          ...(options.headers || {}),
        },
      });

      let data = null;
      try {
        data = await response.json();
      } catch (parseError) {
        data = null;
      }

      const message = String(data?.message || "");
      const lowerMessage = message.toLowerCase();
      const isTokenError =
        lowerMessage.includes("token tidak valid") ||
        lowerMessage.includes("token tidak ditemukan") ||
        lowerMessage.includes("kadaluarsa");

      if (response.status === 401 || (response.status === 403 && isTokenError)) {
        if (!sessionExpiredRef.current) {
          sessionExpiredRef.current = true;
          onSessionExpired?.();
        }
        throw new Error("__SESSION_EXPIRED__");
      }

      if (!response.ok || !data?.success) {
        const errorObj = new Error(data?.message || `Gagal memuat ${path}`);
        if (data?.detail && typeof data.detail === "object") {
          errorObj.detail = data.detail;
        }
        throw errorObj;
      }

      return data.data;
    },
    [apiBaseUrl, onSessionExpired, session.token]
  );

  const loadAllData = useCallback(async () => {
    sessionExpiredRef.current = false;
    setLoading(true);
    setError("");

    let resolvedKuota = null;
    const issues = [];

    try {
      resolvedKuota = await fetchWithAuth("/api/dosen/kuota");
      setKuotaData(resolvedKuota || null);
    } catch (kuotaError) {
      resolvedKuota = null;
      setKuotaData(null);
      issues.push(kuotaError.message || "Gagal memuat data kuota dosen.");
    }

    if (sessionExpiredRef.current) return;

    const dosenId = resolvedKuota?.dosen?.id;
    const mahasiswaMasterPath = isSekretaris
      ? "/api/sekretaris/mahasiswa/master"
      : "/api/dosen/mahasiswa-master";
    const promises = [
      fetchWithAuth("/api/dosen/submissions"),
      fetchWithAuth("/api/dosen/permohonan-extend"),
      fetchWithAuth("/api/dosen/pamit-mahasiswa"),
      dosenId ? fetchWithAuth(`/api/topics?dosen_id=${dosenId}`) : Promise.resolve([]),
      fetchWithAuth(mahasiswaMasterPath),
    ];

    if (isSekretaris) {
      promises.push(fetchWithAuth("/api/sekretaris/pendaftaran"));
      promises.push(fetchWithAuth("/api/sekretaris/periode"));
      promises.push(fetchWithAuth("/api/sekretaris/master-dosen/kuota-overview"));
      promises.push(fetchWithAuth("/api/topics"));
    }

    const results = await Promise.allSettled(promises);
    if (sessionExpiredRef.current) return;

    const [
      submissionsResult,
      izinLanjutResult,
      pamitResult,
      topikResult,
      mahasiswaMasterResult,
      pendaftaranResult,
      periodeResult,
      masterDosenKuotaResult,
      masterTopikResult,
    ] = results;

    if (submissionsResult?.status === "fulfilled") {
      setSubmissions(Array.isArray(submissionsResult.value) ? submissionsResult.value : []);
    } else {
      setSubmissions([]);
      issues.push(submissionsResult?.reason?.message || "Gagal memuat pengajuan mahasiswa.");
    }

    if (izinLanjutResult?.status === "fulfilled") {
      setIzinLanjutRows(Array.isArray(izinLanjutResult.value) ? izinLanjutResult.value : []);
    } else {
      setIzinLanjutRows([]);
      issues.push(izinLanjutResult?.reason?.message || "Gagal memuat data permohonan extend semester 3.");
    }

    if (pamitResult?.status === "fulfilled") {
      setPamitRows(Array.isArray(pamitResult.value) ? pamitResult.value : []);
    } else {
      setPamitRows([]);
      issues.push(pamitResult?.reason?.message || "Gagal memuat data pamit mahasiswa.");
    }

    if (topikResult?.status === "fulfilled") {
      setTopikRows(Array.isArray(topikResult.value) ? topikResult.value : []);
    } else {
      setTopikRows([]);
      issues.push(topikResult?.reason?.message || "Gagal memuat data topik.");
    }

    if (mahasiswaMasterResult?.status === "fulfilled") {
      setMahasiswaMasterRows(Array.isArray(mahasiswaMasterResult.value) ? mahasiswaMasterResult.value : []);
    } else {
      setMahasiswaMasterRows([]);
      issues.push(mahasiswaMasterResult?.reason?.message || "Gagal memuat master data mahasiswa.");
    }

    if (isSekretaris) {
      if (pendaftaranResult?.status === "fulfilled") {
        setPendaftaranRows(Array.isArray(pendaftaranResult.value) ? pendaftaranResult.value : []);
      } else {
        setPendaftaranRows([]);
        issues.push(pendaftaranResult?.reason?.message || "Gagal memuat data penjaluran.");
      }

      if (periodeResult?.status === "fulfilled") {
        const periodPayload = periodeResult.value || {};
        setPeriodeOverview({
          active_periode: periodPayload.active_periode || null,
          draft_periode: periodPayload.draft_periode || null,
          periodes: Array.isArray(periodPayload.periodes) ? periodPayload.periodes : [],
          dosen_options: Array.isArray(periodPayload.dosen_options) ? periodPayload.dosen_options : [],
          ketua_klaster_options: Array.isArray(periodPayload.ketua_klaster_options)
            ? periodPayload.ketua_klaster_options
            : [],
          master_penanggung_jawab: periodPayload.master_penanggung_jawab || null,
        });
      } else {
        setPeriodeOverview({
          active_periode: null,
          draft_periode: null,
          periodes: [],
          dosen_options: [],
          ketua_klaster_options: [],
          master_penanggung_jawab: null,
        });
        issues.push(periodeResult?.reason?.message || "Gagal memuat data periode.");
      }

      if (masterTopikResult?.status === "fulfilled") {
        setMasterTopikRows(Array.isArray(masterTopikResult.value) ? masterTopikResult.value : []);
      } else {
        setMasterTopikRows([]);
        issues.push(masterTopikResult?.reason?.message || "Gagal memuat master topik.");
      }

      if (masterDosenKuotaResult?.status === "fulfilled") {
        const payload = masterDosenKuotaResult.value || {};
        setMasterDosenKuotaOverview({
          summary: payload.summary || null,
          dosens: Array.isArray(payload.dosens) ? payload.dosens : [],
        });
      } else {
        setMasterDosenKuotaOverview({ summary: null, dosens: [] });
        issues.push(masterDosenKuotaResult?.reason?.message || "Gagal memuat data kuota dosen.");
      }
      setKetuaKlasterOverview({
        active_periode: null,
        periode_terpilih: null,
        periodes: [],
        rows: [],
      });
      setKetuaKlasterPeriodeId("");
    } else {
      setMasterTopikRows([]);
      setPeriodeOverview({
        active_periode: null,
        draft_periode: null,
        periodes: [],
        dosen_options: [],
        ketua_klaster_options: [],
        master_penanggung_jawab: null,
      });
      setMasterDosenKuotaOverview({ summary: null, dosens: [] });
      setKetuaKlasterOverview({
        active_periode: null,
        periode_terpilih: null,
        periodes: [],
        rows: [],
      });
      setKetuaKlasterPeriodeId("");
    }

    setError(issues.join(" "));
    setLoading(false);
  }, [fetchWithAuth, isSekretaris]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const summary = useMemo(() => {
    const pendingSubmissions = submissions.filter((item) => item.status === "pending").length;
    const pendingPamit = pamitRows.filter((item) => item.status_dospem === "pending").length;
    return {
      totalSubmissions: submissions.length,
      pendingSubmissions,
      pendingPamit,
      topikAktif: topikRows.length,
      kuotaTotal: kuotaData?.kuota?.total ?? 0,
      kuotaTerpakai: kuotaData?.kuota?.terpakai ?? 0,
      kuotaSisa: kuotaData?.kuota?.sisa ?? 0,
    };
  }, [submissions, pamitRows, topikRows, kuotaData]);

  const filteredSubmissions = useMemo(() => {
    const keyword = submissionQuery.trim().toLowerCase();
    if (!keyword) return submissions;

    return submissions.filter((row) => {
      const topikDetailText = Array.isArray(row.topik_dipilih_detail)
        ? row.topik_dipilih_detail.map((item) => item?.judul).filter(Boolean).join(" ")
        : "";
      const topikText = Array.isArray(row.topik_dipilih)
        ? row.topik_dipilih.join(" ")
        : row.judul_mandiri || "";
      const haystack = [
        row.id,
        row.mahasiswa?.nim,
        row.mahasiswa?.nama,
        row.mahasiswa?.angkatan,
        row.jenis_jalur,
        row.tipe_pengajuan,
        row.status,
        topikText,
        topikDetailText,
        row.topik_fokus?.judul,
        row.topik_fokus?.kode,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(keyword);
    });
  }, [submissions, submissionQuery]);

  const filteredIzinLanjutRows = useMemo(() => {
    const keyword = izinLanjutQuery.trim().toLowerCase();
    if (!keyword) return izinLanjutRows;

    return izinLanjutRows.filter((row) => {
      const haystack = [
        row.id,
        row.mahasiswa?.nim,
        row.mahasiswa?.nama,
        row.mahasiswa?.angkatan,
        row.semester_penjaluran_ke,
        row.status,
        row.periode?.label_periode,
        row.alasan_pengajuan,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(keyword);
    });
  }, [izinLanjutRows, izinLanjutQuery]);

  const filteredTopikRows = useMemo(() => {
    const keyword = topikQuery.trim().toLowerCase();
    if (!keyword) return topikRows;

    return topikRows.filter((row) => {
      const haystack = [row.kode, row.judul, row.cluster, row.status].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(keyword);
    });
  }, [topikRows, topikQuery]);

  const totalTopikPages = useMemo(
    () => Math.max(1, Math.ceil(filteredTopikRows.length / TOPIK_PAGE_SIZE)),
    [filteredTopikRows.length]
  );

  const pagedTopikRows = useMemo(() => {
    const start = (topikPage - 1) * TOPIK_PAGE_SIZE;
    return filteredTopikRows.slice(start, start + TOPIK_PAGE_SIZE);
  }, [filteredTopikRows, topikPage]);

  useEffect(() => {
    setTopikPage(1);
  }, [topikQuery]);

  useEffect(() => {
    if (topikPage > totalTopikPages) {
      setTopikPage(totalTopikPages);
    }
  }, [topikPage, totalTopikPages]);

  const filteredMasterTopikRows = useMemo(() => {
    const keyword = masterTopikQuery.trim().toLowerCase();
    if (!keyword) return masterTopikRows;

    return masterTopikRows.filter((row) => {
      const haystack = [
        row.kode,
        row.judul,
        row.cluster,
        row.status,
        row.dosen?.nama,
        row.dosen_nama,
        row.nama_dosen,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(keyword);
    });
  }, [masterTopikRows, masterTopikQuery]);

  const totalMasterTopikPages = useMemo(
    () => Math.max(1, Math.ceil(filteredMasterTopikRows.length / MASTER_TOPIK_PAGE_SIZE)),
    [filteredMasterTopikRows.length]
  );

  const pagedMasterTopikRows = useMemo(() => {
    const start = (masterTopikPage - 1) * MASTER_TOPIK_PAGE_SIZE;
    return filteredMasterTopikRows.slice(start, start + MASTER_TOPIK_PAGE_SIZE);
  }, [filteredMasterTopikRows, masterTopikPage]);

  useEffect(() => {
    setMasterTopikPage(1);
  }, [masterTopikQuery]);

  useEffect(() => {
    if (masterTopikPage > totalMasterTopikPages) {
      setMasterTopikPage(totalMasterTopikPages);
    }
  }, [masterTopikPage, totalMasterTopikPages]);

  const filteredPendaftaranRows = useMemo(() => {
    if (!isSekretaris) return [];
    const keyword = pendaftaranSearch.trim().toLowerCase();
    if (!keyword) return pendaftaranRows;
    return pendaftaranRows.filter((row) => {
      const haystack = [
        row.mahasiswa?.nim,
        row.mahasiswa?.nama,
        row.mahasiswa?.email,
        row.jalur,
        row.status,
        row.periode?.label_periode,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(keyword);
    });
  }, [isSekretaris, pendaftaranRows, pendaftaranSearch]);

  const totalSubmissionPages = useMemo(
    () => Math.max(1, Math.ceil(filteredSubmissions.length / DOSEN_GRID_PAGE_SIZE)),
    [filteredSubmissions.length]
  );
  const submissionTopikLookup = useMemo(() => {
    const rows = [
      ...(Array.isArray(topikRows) ? topikRows : []),
      ...(Array.isArray(masterTopikRows) ? masterTopikRows : []),
    ];
    const map = new Map();
    rows.forEach((item) => {
      const kode = String(item?.kode || "").trim().toUpperCase();
      if (!kode || map.has(kode)) return;
      map.set(kode, item);
    });
    return map;
  }, [masterTopikRows, topikRows]);

  const pagedSubmissions = useMemo(() => {
    const start = (submissionPage - 1) * DOSEN_GRID_PAGE_SIZE;
    return filteredSubmissions.slice(start, start + DOSEN_GRID_PAGE_SIZE);
  }, [filteredSubmissions, submissionPage]);
  const submissionRangeStart =
    filteredSubmissions.length === 0 ? 0 : (submissionPage - 1) * DOSEN_GRID_PAGE_SIZE + 1;
  const submissionRangeEnd = Math.min(
    submissionPage * DOSEN_GRID_PAGE_SIZE,
    filteredSubmissions.length
  );

  const totalIzinLanjutPages = useMemo(
    () => Math.max(1, Math.ceil(filteredIzinLanjutRows.length / DOSEN_GRID_PAGE_SIZE)),
    [filteredIzinLanjutRows.length]
  );
  const pagedIzinLanjutRows = useMemo(() => {
    const start = (izinLanjutPage - 1) * DOSEN_GRID_PAGE_SIZE;
    return filteredIzinLanjutRows.slice(start, start + DOSEN_GRID_PAGE_SIZE);
  }, [filteredIzinLanjutRows, izinLanjutPage]);
  const izinRangeStart =
    filteredIzinLanjutRows.length === 0 ? 0 : (izinLanjutPage - 1) * DOSEN_GRID_PAGE_SIZE + 1;
  const izinRangeEnd = Math.min(
    izinLanjutPage * DOSEN_GRID_PAGE_SIZE,
    filteredIzinLanjutRows.length
  );

  const totalPamitPages = useMemo(
    () => Math.max(1, Math.ceil(pamitRows.length / DOSEN_GRID_PAGE_SIZE)),
    [pamitRows.length]
  );
  const pagedPamitRows = useMemo(() => {
    const start = (pamitPage - 1) * DOSEN_GRID_PAGE_SIZE;
    return pamitRows.slice(start, start + DOSEN_GRID_PAGE_SIZE);
  }, [pamitRows, pamitPage]);
  const pamitRangeStart = pamitRows.length === 0 ? 0 : (pamitPage - 1) * DOSEN_GRID_PAGE_SIZE + 1;
  const pamitRangeEnd = Math.min(pamitPage * DOSEN_GRID_PAGE_SIZE, pamitRows.length);

  const totalPendaftaranPages = useMemo(
    () => Math.max(1, Math.ceil(filteredPendaftaranRows.length / DOSEN_GRID_PAGE_SIZE)),
    [filteredPendaftaranRows.length]
  );
  const pagedPendaftaranRows = useMemo(() => {
    const start = (pendaftaranPage - 1) * DOSEN_GRID_PAGE_SIZE;
    return filteredPendaftaranRows.slice(start, start + DOSEN_GRID_PAGE_SIZE);
  }, [filteredPendaftaranRows, pendaftaranPage]);
  const pendaftaranRangeStart =
    filteredPendaftaranRows.length === 0
      ? 0
      : (pendaftaranPage - 1) * DOSEN_GRID_PAGE_SIZE + 1;
  const pendaftaranRangeEnd = Math.min(
    pendaftaranPage * DOSEN_GRID_PAGE_SIZE,
    filteredPendaftaranRows.length
  );

  const periodeRows = useMemo(
    () => (Array.isArray(periodeOverview.periodes) ? periodeOverview.periodes : []),
    [periodeOverview.periodes]
  );
  const periodeDosenOptions = useMemo(
    () => (Array.isArray(periodeOverview.dosen_options) ? periodeOverview.dosen_options : []),
    [periodeOverview.dosen_options]
  );
  const periodeKetuaKlasterOptions = useMemo(
    () => (Array.isArray(periodeOverview.ketua_klaster_options) ? periodeOverview.ketua_klaster_options : []),
    [periodeOverview.ketua_klaster_options]
  );
  const periodeDosenMap = useMemo(
    () => new Map(periodeDosenOptions.map((item) => [Number(item.id), item])),
    [periodeDosenOptions]
  );
  const totalPeriodePages = useMemo(
    () => Math.max(1, Math.ceil(periodeRows.length / DOSEN_GRID_PAGE_SIZE)),
    [periodeRows.length]
  );
  const pagedPeriodeRows = useMemo(() => {
    const start = (periodePage - 1) * DOSEN_GRID_PAGE_SIZE;
    return periodeRows.slice(start, start + DOSEN_GRID_PAGE_SIZE);
  }, [periodeRows, periodePage]);
  const periodeRangeStart = periodeRows.length === 0 ? 0 : (periodePage - 1) * DOSEN_GRID_PAGE_SIZE + 1;
  const periodeRangeEnd = Math.min(periodePage * DOSEN_GRID_PAGE_SIZE, periodeRows.length);
  const periodeReadonlyKetuaByCluster = useMemo(() => {
    const rows = Array.isArray(periodeReadonlyRoles.rows) ? periodeReadonlyRoles.rows : [];
    const map = new Map();
    for (const row of rows) {
      const code = normalizeResearchClusterCode(row?.kode || row?.nama);
      if (!code || map.has(code)) continue;
      map.set(code, row);
    }
    return map;
  }, [periodeReadonlyRoles.rows]);

  const masterDosenKuotaRows = useMemo(
    () => (Array.isArray(masterDosenKuotaOverview?.dosens) ? masterDosenKuotaOverview.dosens : []),
    [masterDosenKuotaOverview?.dosens]
  );
  const filteredMasterDosenKuotaRows = useMemo(() => {
    const keyword = masterDosenKuotaQuery.trim().toLowerCase();
    if (!keyword) return masterDosenKuotaRows;
    return masterDosenKuotaRows.filter((row) => {
      const haystack = [
        row?.kode_dosen,
        row?.nik,
        row?.nama,
        row?.email,
        row?.jabatan_struktural,
        row?.kuota?.total,
        row?.kuota?.terpakai,
        row?.kuota?.sisa,
      ]
        .filter((item) => item !== null && item !== undefined && String(item).trim() !== "")
        .join(" ")
        .toLowerCase();
      return haystack.includes(keyword);
    });
  }, [masterDosenKuotaQuery, masterDosenKuotaRows]);
  const totalMasterDosenKuotaPages = useMemo(
    () => Math.max(1, Math.ceil(filteredMasterDosenKuotaRows.length / DOSEN_GRID_PAGE_SIZE)),
    [filteredMasterDosenKuotaRows.length]
  );
  const pagedMasterDosenKuotaRows = useMemo(() => {
    const start = (masterDosenKuotaPage - 1) * DOSEN_GRID_PAGE_SIZE;
    return filteredMasterDosenKuotaRows.slice(start, start + DOSEN_GRID_PAGE_SIZE);
  }, [filteredMasterDosenKuotaRows, masterDosenKuotaPage]);
  const masterDosenKuotaRangeStart =
    filteredMasterDosenKuotaRows.length === 0
      ? 0
      : (masterDosenKuotaPage - 1) * DOSEN_GRID_PAGE_SIZE + 1;
  const masterDosenKuotaRangeEnd = Math.min(
    masterDosenKuotaPage * DOSEN_GRID_PAGE_SIZE,
    filteredMasterDosenKuotaRows.length
  );
  const pagedMasterDosenKuotaIds = useMemo(
    () =>
      pagedMasterDosenKuotaRows
        .map((row) => Number(row?.id))
        .filter((id) => Number.isInteger(id) && id > 0),
    [pagedMasterDosenKuotaRows]
  );
  const isMasterDosenKuotaPageAllSelected = useMemo(() => {
    if (pagedMasterDosenKuotaIds.length === 0) return false;
    const selectedSet = new Set(masterDosenSelectedDosenIds.map((item) => Number(item)));
    return pagedMasterDosenKuotaIds.every((id) => selectedSet.has(id));
  }, [masterDosenSelectedDosenIds, pagedMasterDosenKuotaIds]);
  const masterPeriodeMissingLabels = useMemo(() => {
    return PERIODE_MASTER_ALL_FIELDS
      .filter((item) => !String(periodeMasterForm?.[item.key] || "").trim())
      .map((item) => item.label);
  }, [periodeMasterForm]);
  const periodeMasterSelectedDosenIdsByField = useMemo(() => {
    const map = {};
    for (const item of PERIODE_MASTER_ALL_FIELDS) {
      const parsedId = Number(periodeMasterForm?.[item.key]);
      map[item.key] = Number.isInteger(parsedId) && parsedId > 0 ? parsedId : null;
    }
    return map;
  }, [periodeMasterForm]);
  const periodeMasterOptionsByField = useMemo(() => {
    const next = {};
    for (const ketuaField of PERIODE_MASTER_KETUA_FIELDS) {
      const clusterOption = periodeKetuaKlasterOptions.find(
        (row) => String(row?.kode || "").toUpperCase() === ketuaField.code
      );
      next[ketuaField.key] = Array.isArray(clusterOption?.kandidat_dosen)
        ? clusterOption.kandidat_dosen
        : [];
    }
    for (const jalurField of PERIODE_MASTER_JALUR_FIELDS) {
      next[jalurField.key] = periodeDosenOptions;
    }
    return next;
  }, [periodeDosenOptions, periodeKetuaKlasterOptions]);

  useEffect(() => {
    setMasterDosenKuotaPage(1);
  }, [masterDosenKuotaQuery]);

  useEffect(() => {
    if (masterDosenKuotaPage > totalMasterDosenKuotaPages) {
      setMasterDosenKuotaPage(totalMasterDosenKuotaPages);
    }
  }, [masterDosenKuotaPage, totalMasterDosenKuotaPages]);

  const filteredKetuaKlasterRows = useMemo(() => {
    const rows = Array.isArray(ketuaKlasterOverview.rows) ? ketuaKlasterOverview.rows : [];
    const keyword = ketuaKlasterQuery.trim().toLowerCase();
    if (!keyword) return rows;
    return rows.filter((row) => {
      const haystack = [
        row.kode,
        row.nama,
        row.ketua?.ketua_dosen?.nama,
        row.ketua?.ketua_dosen?.nik,
        row.ketua?.ketua_dosen?.kode_dosen,
        ...(Array.isArray(row.kandidat_dosen) ? row.kandidat_dosen.map((item) => item.nama) : []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(keyword);
    });
  }, [ketuaKlasterOverview.rows, ketuaKlasterQuery]);

  const totalKetuaKlasterPages = useMemo(
    () => Math.max(1, Math.ceil(filteredKetuaKlasterRows.length / DOSEN_GRID_PAGE_SIZE)),
    [filteredKetuaKlasterRows.length]
  );
  const pagedKetuaKlasterRows = useMemo(() => {
    const start = (ketuaKlasterPage - 1) * DOSEN_GRID_PAGE_SIZE;
    return filteredKetuaKlasterRows.slice(start, start + DOSEN_GRID_PAGE_SIZE);
  }, [filteredKetuaKlasterRows, ketuaKlasterPage]);
  const ketuaKlasterRangeStart =
    filteredKetuaKlasterRows.length === 0 ? 0 : (ketuaKlasterPage - 1) * DOSEN_GRID_PAGE_SIZE + 1;
  const ketuaKlasterRangeEnd = Math.min(
    ketuaKlasterPage * DOSEN_GRID_PAGE_SIZE,
    filteredKetuaKlasterRows.length
  );
  const selectedKetuaPeriode = useMemo(() => {
    const selectedId = Number(ketuaKlasterPeriodeId);
    if (Number.isInteger(selectedId) && selectedId > 0) {
      const fromOptions = (ketuaKlasterOverview.periodes || []).find(
        (item) => Number(item.id) === selectedId
      );
      if (fromOptions) return fromOptions;
    }
    return ketuaKlasterOverview.periode_terpilih || null;
  }, [ketuaKlasterOverview.periode_terpilih, ketuaKlasterOverview.periodes, ketuaKlasterPeriodeId]);

  const ketuaReviewStats = useMemo(() => {
    const rows = Array.isArray(ketuaKlasterOverview.rows) ? ketuaKlasterOverview.rows : [];
    const total = rows.length;
    const terisi = rows.filter((row) => Boolean(row?.ketua?.ketua_dosen?.id)).length;
    const belumTerisi = Math.max(0, total - terisi);
    return { total, terisi, belumTerisi };
  }, [ketuaKlasterOverview.rows]);

  const mahasiswaMasterHistoryRows = useMemo(() => {
    return mahasiswaMasterRows.flatMap((mahasiswa) => {
      const history = Array.isArray(mahasiswa.riwayat_penjaluran)
        ? mahasiswa.riwayat_penjaluran
        : [];

      if (history.length === 0) {
        return [
          {
            mahasiswa_id: mahasiswa.id,
            pendaftaran_id: null,
            nim: mahasiswa.nim,
            nama: mahasiswa.nama,
            email: mahasiswa.email,
            angkatan: mahasiswa.angkatan,
            status_jalur_saat_ini: mahasiswa.status_jalur_saat_ini,
            dosen_pembimbing_akademik: mahasiswa.dosenPembimbingAkademik?.nama || "-",
            dosen_pembimbing_skripsi: mahasiswa.dosenPembimbingSkripsi?.nama || "-",
            semester_penjaluran_ke: 0,
            semester_penjaluran_aktif: mahasiswa.semester_penjaluran_aktif || 0,
            tahun_akademik: null,
            semester_akademik: null,
            periode_label: null,
            jalur: null,
            nama_penjaluran: null,
            pembimbing_ta: null,
            pendaftaran_status: null,
            tanggal_penjaluran: null,
            updatedAt: mahasiswa.updatedAt,
          },
        ];
      }

      return history.map((item) => ({
        mahasiswa_id: mahasiswa.id,
        pendaftaran_id: item.id,
        nim: mahasiswa.nim,
        nama: mahasiswa.nama,
        email: mahasiswa.email,
        angkatan: mahasiswa.angkatan,
        status_jalur_saat_ini: mahasiswa.status_jalur_saat_ini,
        dosen_pembimbing_akademik: mahasiswa.dosenPembimbingAkademik?.nama || "-",
        dosen_pembimbing_skripsi: mahasiswa.dosenPembimbingSkripsi?.nama || "-",
        semester_penjaluran_ke: item.semester_penjaluran_ke || 0,
        semester_penjaluran_aktif:
          item.semester_penjaluran_aktif ??
          mahasiswa.semester_penjaluran_aktif ??
          item.semester_penjaluran_ke ??
          0,
        tahun_akademik: item.periode_penjaluran?.tahun_akademik || null,
        semester_akademik: item.periode_penjaluran?.semester || null,
        periode_label: item.periode_penjaluran?.label_periode || null,
        jalur: item.jalur || null,
        nama_penjaluran: item.nama_penjaluran || null,
        pembimbing_ta: item.pembimbing_ta?.nama || null,
        pendaftaran_status: item.status || null,
        tanggal_penjaluran: item.createdAt || null,
        updatedAt: item.updatedAt || mahasiswa.updatedAt,
      }));
    });
  }, [mahasiswaMasterRows]);

  const mahasiswaBimbinganHistoryRows = useMemo(() => {
    const dosenId = Number(kuotaData?.dosen?.id);
    if (!Number.isFinite(dosenId)) return [];

    const mahasiswaBimbinganIds = new Set(
      mahasiswaMasterRows
        .filter((mahasiswa) => Number(mahasiswa.dosen_pembimbing_skripsi_id) === dosenId)
        .map((mahasiswa) => mahasiswa.id)
    );

    return mahasiswaMasterHistoryRows.filter((row) => mahasiswaBimbinganIds.has(row.mahasiswa_id));
  }, [kuotaData?.dosen?.id, mahasiswaMasterRows, mahasiswaMasterHistoryRows]);

  const mahasiswaRowsByActiveTab = useMemo(() => {
    return activeTab === "mahasiswa-bimbingan"
      ? mahasiswaBimbinganHistoryRows
      : mahasiswaMasterHistoryRows;
  }, [activeTab, mahasiswaBimbinganHistoryRows, mahasiswaMasterHistoryRows]);

  const mahasiswaMasterFilterOptions = useMemo(() => {
    const angkatanSet = new Set();
    const semesterPenjaluranSet = new Set();
    const periodeSet = new Set();
    const penjaluranSet = new Set();
    const tipePendaftaranSet = new Set();

    for (const row of mahasiswaRowsByActiveTab) {
      if (row?.angkatan) {
        angkatanSet.add(String(row.angkatan).trim());
      }
      const semesterPenjaluran = Number(row?.semester_penjaluran_aktif || row?.semester_penjaluran_ke || 0);
      if (Number.isFinite(semesterPenjaluran) && semesterPenjaluran > 0) {
        semesterPenjaluranSet.add(String(semesterPenjaluran));
      }
      const periodeValue = buildMahasiswaMasterPeriodeFilterValue(row);
      if (periodeValue) {
        periodeSet.add(periodeValue);
      }
      if (row?.nama_penjaluran) {
        penjaluranSet.add(String(row.nama_penjaluran).trim());
      }
      if (row?.jalur) {
        tipePendaftaranSet.add(String(row.jalur).trim().toLowerCase());
      }
    }

    const jalurOrder = ["baru", "ulang", "alih"];
    const tipePendaftaranList = jalurOrder
      .filter((item) => tipePendaftaranSet.has(item))
      .concat(
        Array.from(tipePendaftaranSet)
          .filter((item) => !jalurOrder.includes(item))
          .sort((a, b) => a.localeCompare(b, "id"))
      );

    return {
      angkatan: Array.from(angkatanSet).sort((a, b) => Number(b) - Number(a)),
      semester_penjaluran: Array.from(semesterPenjaluranSet).sort((a, b) => Number(a) - Number(b)),
      periode: Array.from(periodeSet).sort((a, b) => a.localeCompare(b, "id")),
      penjaluran: Array.from(penjaluranSet).sort((a, b) => a.localeCompare(b, "id")),
      tipe_pendaftaran: tipePendaftaranList,
    };
  }, [mahasiswaRowsByActiveTab]);

  const filteredMahasiswaMasterRows = useMemo(() => {
    const selectedAngkatan = String(mahasiswaMasterFilters.angkatan || "").trim();
    const selectedSemesterPenjaluran = String(mahasiswaMasterFilters.semester_penjaluran || "").trim();
    const selectedPeriode = String(mahasiswaMasterFilters.periode || "").trim();
    const selectedPenjaluran = String(mahasiswaMasterFilters.penjaluran || "").trim().toLowerCase();
    const selectedTipePendaftaran = String(mahasiswaMasterFilters.tipe_pendaftaran || "")
      .trim()
      .toLowerCase();
    const keyword = mahasiswaMasterQuery.trim().toLowerCase();

    return mahasiswaRowsByActiveTab.filter((row) => {
      if (selectedAngkatan && String(row?.angkatan || "").trim() !== selectedAngkatan) {
        return false;
      }

      const semesterPenjaluran = String(
        Number(row?.semester_penjaluran_aktif || row?.semester_penjaluran_ke || 0) || ""
      );
      if (selectedSemesterPenjaluran && semesterPenjaluran !== selectedSemesterPenjaluran) {
        return false;
      }

      const periodeValue = buildMahasiswaMasterPeriodeFilterValue(row);
      if (selectedPeriode && periodeValue !== selectedPeriode) {
        return false;
      }

      if (selectedPenjaluran && String(row?.nama_penjaluran || "").trim().toLowerCase() !== selectedPenjaluran) {
        return false;
      }

      if (selectedTipePendaftaran && String(row?.jalur || "").trim().toLowerCase() !== selectedTipePendaftaran) {
        return false;
      }

      if (!keyword) return true;

      const haystack = [
        row.nim,
        row.nama,
        row.email,
        row.angkatan,
        row.status_jalur_saat_ini,
        row.dosen_pembimbing_akademik,
        row.dosen_pembimbing_skripsi,
        (row.semester_penjaluran_aktif || row.semester_penjaluran_ke)
          ? `semester ${row.semester_penjaluran_aktif || row.semester_penjaluran_ke}`
          : null,
        row.tahun_akademik,
        row.semester_akademik,
        row.periode_label,
        row.jalur,
        row.nama_penjaluran,
        row.pembimbing_ta,
        row.pendaftaran_status,
        `tipe ${formatLabel(row.jalur)}`,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(keyword);
    });
  }, [mahasiswaRowsByActiveTab, mahasiswaMasterFilters, mahasiswaMasterQuery]);

  const totalMahasiswaMasterPages = useMemo(
    () => Math.max(1, Math.ceil(filteredMahasiswaMasterRows.length / MAHASISWA_MASTER_PAGE_SIZE)),
    [filteredMahasiswaMasterRows.length]
  );

  const pagedMahasiswaMasterRows = useMemo(() => {
    const start = (mahasiswaMasterPage - 1) * MAHASISWA_MASTER_PAGE_SIZE;
    return filteredMahasiswaMasterRows.slice(start, start + MAHASISWA_MASTER_PAGE_SIZE);
  }, [filteredMahasiswaMasterRows, mahasiswaMasterPage]);

  const mahasiswaMasterRangeStart =
    filteredMahasiswaMasterRows.length === 0
      ? 0
      : (mahasiswaMasterPage - 1) * MAHASISWA_MASTER_PAGE_SIZE + 1;
  const mahasiswaMasterRangeEnd = Math.min(
    mahasiswaMasterPage * MAHASISWA_MASTER_PAGE_SIZE,
    filteredMahasiswaMasterRows.length
  );
  const mahasiswaMasterActiveFilterChips = useMemo(() => {
    const chips = [];
    const angkatan = String(mahasiswaMasterFilters.angkatan || "").trim();
    const semesterPenjaluran = String(mahasiswaMasterFilters.semester_penjaluran || "").trim();
    const periode = String(mahasiswaMasterFilters.periode || "").trim();
    const penjaluran = String(mahasiswaMasterFilters.penjaluran || "").trim();
    const tipePendaftaran = String(mahasiswaMasterFilters.tipe_pendaftaran || "").trim();

    if (angkatan) {
      chips.push({ key: "angkatan", label: `Angkatan: ${angkatan}` });
    }
    if (semesterPenjaluran) {
      chips.push({
        key: "semester_penjaluran",
        label: `Semester Penjaluran: ${semesterPenjaluran}`,
      });
    }
    if (periode) {
      chips.push({ key: "periode", label: `Periode: ${periode}` });
    }
    if (penjaluran) {
      chips.push({ key: "penjaluran", label: `Penjaluran: ${penjaluran}` });
    }
    if (tipePendaftaran) {
      chips.push({ key: "tipe_pendaftaran", label: `Tipe: ${formatLabel(tipePendaftaran)}` });
    }

    return chips;
  }, [mahasiswaMasterFilters]);
  const hasMahasiswaMasterActiveFilters = useMemo(() => {
    return mahasiswaMasterActiveFilterChips.length > 0;
  }, [mahasiswaMasterActiveFilterChips]);
  const hasMahasiswaMasterDraftFilters = useMemo(() => {
    return Object.values(mahasiswaMasterFilterDraft).some((value) => String(value || "").trim().length > 0);
  }, [mahasiswaMasterFilterDraft]);
  const isMahasiswaMasterFilterDraftDirty = useMemo(() => {
    return Object.keys(MAHASISWA_MASTER_FILTER_INITIAL).some(
      (key) =>
        String(mahasiswaMasterFilterDraft[key] || "").trim() !==
        String(mahasiswaMasterFilters[key] || "").trim()
    );
  }, [mahasiswaMasterFilterDraft, mahasiswaMasterFilters]);

  const handleToggleMahasiswaMasterFilterPanel = useCallback(() => {
    setShowMahasiswaMasterFilterPanel((prev) => {
      const next = !prev;
      if (next) {
        setMahasiswaMasterFilterDraft({ ...mahasiswaMasterFilters });
        window.requestAnimationFrame(() => {
          updateMahasiswaMasterFilterPopupLayout();
        });
      }
      return next;
    });
  }, [mahasiswaMasterFilters, updateMahasiswaMasterFilterPopupLayout]);

  const handleApplyMahasiswaMasterFilters = useCallback(() => {
    setMahasiswaMasterFilters({ ...mahasiswaMasterFilterDraft });
    setShowMahasiswaMasterFilterPanel(false);
  }, [mahasiswaMasterFilterDraft]);

  const handleResetMahasiswaMasterFilters = useCallback(() => {
    setMahasiswaMasterFilters({ ...MAHASISWA_MASTER_FILTER_INITIAL });
    setMahasiswaMasterFilterDraft({ ...MAHASISWA_MASTER_FILTER_INITIAL });
    setShowMahasiswaMasterFilterPanel(false);
  }, []);

  useEffect(() => {
    setMahasiswaMasterPage(1);
  }, [mahasiswaMasterFilters, mahasiswaMasterQuery]);

  useEffect(() => {
    if (mahasiswaMasterPage > totalMahasiswaMasterPages) {
      setMahasiswaMasterPage(totalMahasiswaMasterPages);
    }
  }, [mahasiswaMasterPage, totalMahasiswaMasterPages]);

  useEffect(() => {
    setSubmissionPage(1);
  }, [submissionQuery]);

  useEffect(() => {
    if (submissionPage > totalSubmissionPages) {
      setSubmissionPage(totalSubmissionPages);
    }
  }, [submissionPage, totalSubmissionPages]);

  useEffect(() => {
    setIzinLanjutPage(1);
  }, [izinLanjutQuery]);

  useEffect(() => {
    if (izinLanjutPage > totalIzinLanjutPages) {
      setIzinLanjutPage(totalIzinLanjutPages);
    }
  }, [izinLanjutPage, totalIzinLanjutPages]);

  useEffect(() => {
    if (pamitPage > totalPamitPages) {
      setPamitPage(totalPamitPages);
    }
  }, [pamitPage, totalPamitPages]);

  useEffect(() => {
    setPendaftaranPage(1);
  }, [pendaftaranSearch]);

  useEffect(() => {
    if (pendaftaranPage > totalPendaftaranPages) {
      setPendaftaranPage(totalPendaftaranPages);
    }
  }, [pendaftaranPage, totalPendaftaranPages]);

  useEffect(() => {
    if (periodePage > totalPeriodePages) {
      setPeriodePage(totalPeriodePages);
    }
  }, [periodePage, totalPeriodePages]);

  useEffect(() => {
    const nextDraft = {};
    for (const row of ketuaKlasterOverview.rows || []) {
      nextDraft[row.id] = row?.ketua?.ketua_dosen?.id ? String(row.ketua.ketua_dosen.id) : "";
    }
    setKetuaKlasterDraft(nextDraft);
  }, [ketuaKlasterOverview.rows, ketuaKlasterOverview.periode_terpilih?.id]);

  useEffect(() => {
    setKetuaKlasterPage(1);
  }, [ketuaKlasterQuery]);

  useEffect(() => {
    if (ketuaKlasterPage > totalKetuaKlasterPages) {
      setKetuaKlasterPage(totalKetuaKlasterPages);
    }
  }, [ketuaKlasterPage, totalKetuaKlasterPages]);

  useEffect(() => {
    if (activeTab !== "submissions") {
      setSubmissionMode("list");
      setSelectedSubmissionId(null);
      setSubmissionDetail(null);
      setSubmissionKeterangan("");
      setSubmissionDecision("approve");
    }
  }, [activeTab]);

  const handleOpenSubmissionReview = async (id, defaultDecision = "approve") => {
    setSelectedSubmissionId(id);
    setSubmissionDecision(defaultDecision === "reject" ? "reject" : "approve");
    setSubmissionKeterangan("");
    setLoadingSubmissionDetail(true);
    try {
      const detail = await fetchWithAuth(`/api/dosen/submissions/${id}`);
      setSubmissionDetail(detail || null);
      setSubmissionMode("review");
    } catch (detailError) {
      if (detailError?.message !== "__SESSION_EXPIRED__") {
        showErrorToast(detailError.message || "Gagal memuat detail pengajuan.");
      }
      setSelectedSubmissionId(null);
    } finally {
      setLoadingSubmissionDetail(false);
    }
  };

  const handleBackToSubmissionList = () => {
    setSubmissionMode("list");
    setSelectedSubmissionId(null);
    setSubmissionDetail(null);
    setSubmissionKeterangan("");
    setSubmissionDecision("approve");
  };

  const handleSubmitSubmissionDecision = async () => {
    if (!selectedSubmissionId || !submissionDetail) {
      showErrorToast("Detail pengajuan belum siap diproses.");
      return;
    }

    if (submissionDecision === "reject" && !submissionKeterangan.trim()) {
      showErrorToast("Alasan penolakan wajib diisi.");
      return;
    }

    const isApprove = submissionDecision === "approve";
    const endpoint = isApprove
      ? `/api/dosen/submissions/${selectedSubmissionId}/approve`
      : `/api/dosen/submissions/${selectedSubmissionId}/reject`;
    const confirmTitle = isApprove ? "Setujui pengajuan ini?" : "Tolak pengajuan ini?";
    const confirmButtonText = isApprove ? "Ya, setujui" : "Ya, tolak";

    const confirm = await Swal.fire({
      title: confirmTitle,
      text: "Pastikan keputusan sudah sesuai.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText,
      cancelButtonText: "Batal",
      confirmButtonColor: isApprove ? "#137748" : "#b73a3a",
    });
    if (!confirm.isConfirmed) return;

    setRowActionLoadingId(selectedSubmissionId);
    try {
      await fetchWithAuth(endpoint, {
        method: "POST",
        body: JSON.stringify({ keterangan: submissionKeterangan.trim() }),
      });
      showSuccessToast(isApprove ? "Pengajuan berhasil disetujui." : "Pengajuan berhasil ditolak.");
      await loadAllData();
      handleBackToSubmissionList();
    } catch (decisionError) {
      if (decisionError?.message !== "__SESSION_EXPIRED__") {
        showErrorToast(decisionError.message || "Gagal memproses keputusan pengajuan.");
      }
    } finally {
      setRowActionLoadingId(null);
    }
  };

  const handlePamitApprove = async (id) => {
    try {
      const result = await Swal.fire({
        title: "Setujui pamit?",
        text: "Catatan approval bisa diisi opsional.",
        input: "text",
        inputPlaceholder: "Catatan approval (opsional)",
        showCancelButton: true,
        confirmButtonText: "Setujui",
        cancelButtonText: "Batal",
      });
      if (!result.isConfirmed) return;

      await fetchWithAuth(`/api/dosen/pamit-mahasiswa/${id}/approve`, {
        method: "POST",
        body: JSON.stringify({ keterangan_dospem: result.value || "" }),
      });

      showSuccessToast("Pamit berhasil disetujui.");
      await loadAllData();
    } catch (approveError) {
      if (approveError?.message !== "__SESSION_EXPIRED__") {
        showErrorToast(approveError.message || "Gagal menyetujui pamit.");
      }
    }
  };

  const handlePamitReject = async (id) => {
    try {
      const result = await Swal.fire({
        title: "Tolak pamit",
        text: "Isi alasan penolakan wajib.",
        input: "textarea",
        inputPlaceholder: "Alasan penolakan pamit",
        showCancelButton: true,
        confirmButtonText: "Tolak",
        cancelButtonText: "Batal",
        inputValidator: (value) => (!value?.trim() ? "Alasan penolakan wajib diisi." : undefined),
      });
      if (!result.isConfirmed) return;

      await fetchWithAuth(`/api/dosen/pamit-mahasiswa/${id}/reject`, {
        method: "POST",
        body: JSON.stringify({ keterangan_dospem: result.value.trim() }),
      });

      showSuccessToast("Pamit berhasil ditolak.");
      await loadAllData();
    } catch (rejectError) {
      if (rejectError?.message !== "__SESSION_EXPIRED__") {
        showErrorToast(rejectError.message || "Gagal menolak pamit.");
      }
    }
  };

  const handleOpenIzinLanjutDetail = async (id) => {
    setRowActionLoadingId(id);
    try {
      const detail = await fetchWithAuth(`/api/dosen/permohonan-extend/${id}`);
      const mahasiswa = detail?.mahasiswa || {};
      const periode = detail?.periode || {};
      const dosen = detail?.dosen_pembimbing_skripsi || {};

      await Swal.fire({
        title: `Detail Permohonan Extend #${detail?.id || id}`,
        width: 760,
        confirmButtonText: "Tutup",
        html: `
          <div style="text-align:left;font-size:14px;line-height:1.65;color:#24345e;">
            <p><b>Mahasiswa:</b> ${escapeHtml(mahasiswa.nama)} (${escapeHtml(mahasiswa.nim)})</p>
            <p><b>Email:</b> ${escapeHtml(mahasiswa.email)}</p>
            <p><b>Angkatan:</b> ${escapeHtml(mahasiswa.angkatan)}</p>
            <p><b>Status Jalur Saat Ini:</b> ${escapeHtml(mahasiswa.status_jalur_saat_ini)}</p>
            <hr style="margin:10px 0;border:none;border-top:1px solid #e3e9f8;" />
            <p><b>Semester Penjaluran:</b> Semester ${escapeHtml(
              detail?.semester_penjaluran_ke ?? "-"
            )}</p>
            <p><b>Periode:</b> ${escapeHtml(periode.label_periode || "-")}</p>
            <p><b>Dosen Pembimbing Skripsi:</b> ${escapeHtml(dosen.nama)} (${escapeHtml(
              dosen.nik || "-"
            )})</p>
            <p><b>Status Izin:</b> ${escapeHtml(formatLabel(detail?.status))}</p>
            <p><b>Tanggal Pengajuan:</b> ${escapeHtml(formatDateTime(detail?.tanggal_pengajuan))}</p>
            <p><b>Tanggal Keputusan:</b> ${escapeHtml(formatDateTime(detail?.tanggal_keputusan))}</p>
            <hr style="margin:10px 0;border:none;border-top:1px solid #e3e9f8;" />
            <p><b>Alasan Mahasiswa:</b></p>
            <p style="margin-top:4px;background:#f8fbff;border:1px solid #e6ecf8;border-radius:8px;padding:10px;">
              ${escapeHtml(detail?.alasan_pengajuan)}
            </p>
            <p style="margin-top:10px;"><b>Catatan Dosen:</b></p>
            <p style="margin-top:4px;background:#fff;border:1px solid #e6ecf8;border-radius:8px;padding:10px;">
              ${escapeHtml(detail?.keterangan_dosen || "-")}
            </p>
          </div>
        `,
      });
    } catch (detailError) {
      if (detailError?.message !== "__SESSION_EXPIRED__") {
        showErrorToast(detailError.message || "Gagal memuat detail permohonan extend.");
      }
    } finally {
      setRowActionLoadingId(null);
    }
  };

  const handleApproveIzinLanjut = async (id) => {
    const result = await Swal.fire({
      title: "Setujui permohonan extend?",
      text: "Catatan persetujuan dapat diisi opsional.",
      input: "textarea",
      inputPlaceholder: "Catatan persetujuan (opsional)",
      showCancelButton: true,
      confirmButtonText: "Setujui",
      cancelButtonText: "Batal",
      confirmButtonColor: "#137748",
    });
    if (!result.isConfirmed) return;

    setRowActionLoadingId(id);
    try {
      await fetchWithAuth(`/api/dosen/permohonan-extend/${id}/approve`, {
        method: "POST",
        body: JSON.stringify({
          keterangan_dosen: String(result.value || "").trim(),
        }),
      });
      showSuccessToast("Permohonan extend berhasil disetujui.");
      await loadAllData();
    } catch (approveError) {
      if (approveError?.message !== "__SESSION_EXPIRED__") {
        showErrorToast(approveError.message || "Gagal menyetujui permohonan extend.");
      }
    } finally {
      setRowActionLoadingId(null);
    }
  };

  const handleRejectIzinLanjut = async (id) => {
    const result = await Swal.fire({
      title: "Tolak permohonan extend?",
      text: "Alasan penolakan wajib diisi. Jika ditolak, mahasiswa wajib penjaluran ulang.",
      input: "textarea",
      inputPlaceholder: "Alasan penolakan",
      showCancelButton: true,
      confirmButtonText: "Tolak",
      cancelButtonText: "Batal",
      confirmButtonColor: "#b73a3a",
      inputValidator: (value) => (!value?.trim() ? "Alasan penolakan wajib diisi." : undefined),
    });
    if (!result.isConfirmed) return;

    setRowActionLoadingId(id);
    try {
      await fetchWithAuth(`/api/dosen/permohonan-extend/${id}/reject`, {
        method: "POST",
        body: JSON.stringify({
          keterangan_dosen: result.value.trim(),
        }),
      });
      showSuccessToast("Permohonan extend ditolak. Mahasiswa wajib melakukan penjaluran ulang.");
      await loadAllData();
    } catch (rejectError) {
      if (rejectError?.message !== "__SESSION_EXPIRED__") {
        showErrorToast(rejectError.message || "Gagal menolak permohonan extend.");
      }
    } finally {
      setRowActionLoadingId(null);
    }
  };

  const handleTopikFormChange = (event) => {
    const { name, value } = event.target;
    setTopikForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleTopikApiSubmit = async (event) => {
    event.preventDefault();
    const normalizedCluster = normalizeTopikClusterLabel(topikForm.cluster);
    const payload = {
      kode: topikForm.kode.trim().toUpperCase(),
      judul: topikForm.judul.trim(),
      deskripsi: topikForm.deskripsi.trim(),
      cluster: normalizedCluster || topikForm.cluster,
    };

    if (!payload.kode || !payload.judul || !payload.cluster) {
      showErrorToast("Kode topik, judul, dan cluster wajib diisi.");
      return;
    }

    if (!allowedTopikClusters.includes(payload.cluster)) {
      showErrorToast(`Cluster yang bisa dipilih hanya: ${allowedTopikClusters.join(", ")}.`);
      return;
    }

    const kodeCluster = resolveTopikClusterFromKode(payload.kode);
    if (!kodeCluster || !kodeCluster.label) {
      showErrorToast("Format kode topik tidak valid. Gunakan prefix: SIRKEL, SIBER, ITSC, atau MVK.");
      return;
    }

    if (kodeCluster.label !== payload.cluster) {
      const expectedCode = TOPIK_CLUSTER_CODE_BY_LABEL[payload.cluster] || payload.cluster;
      showErrorToast(
        `Kode topik ${payload.kode} tidak sesuai dengan cluster ${payload.cluster}. Prefix kode harus ${expectedCode}.`
      );
      return;
    }

    setSavingTopik(true);
    try {
      await fetchWithAuth("/api/topics", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setTopikForm({
        kode: "",
        judul: "",
        deskripsi: "",
        cluster: allowedTopikClusters[0] || TOPIK_CLUSTER_OPTIONS[0],
      });
      showSuccessToast("Topik berhasil ditambahkan.");
      await loadAllData();
      setTopikMode("list");
    } catch (createError) {
      if (createError?.message !== "__SESSION_EXPIRED__") {
        showErrorToast(createError.message || "Gagal menambahkan topik.");
      }
    } finally {
      setSavingTopik(false);
    }
  };

  const handleTopikUploadSubmit = async (event) => {
    event.preventDefault();
    if (!topikUploadFile) {
      showErrorToast("Pilih file Excel terlebih dahulu.");
      return;
    }

    setUploadingTopik(true);
    setUploadTopikResult(null);
    try {
      const formData = new FormData();
      formData.append("file", topikUploadFile);

      const response = await fetch(`${apiBaseUrl}/api/admin/upload/topics/preview`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
        body: formData,
      });

      let json = null;
      try {
        json = await response.json();
      } catch (parseError) {
        json = null;
      }

      const uploadMessage = String(json?.message || "");
      const uploadLowerMessage = uploadMessage.toLowerCase();
      const isUploadTokenError =
        uploadLowerMessage.includes("token tidak valid") ||
        uploadLowerMessage.includes("token tidak ditemukan") ||
        uploadLowerMessage.includes("kadaluarsa");

      if (response.status === 401 || (response.status === 403 && isUploadTokenError)) {
        if (!sessionExpiredRef.current) {
          sessionExpiredRef.current = true;
          onSessionExpired?.();
        }
        throw new Error("__SESSION_EXPIRED__");
      }

      if (!response.ok || !json) {
        if (json) {
          setUploadTopikResult(json);
        }
        throw new Error(json?.message || "Upload topik gagal diproses.");
      }

      setUploadTopikResult(json);
      if (json.success) {
        showSuccessToast("Preview topik berhasil dibuat.");
      } else {
        showErrorToast(json.message || "Preview topik selesai dengan kegagalan.");
      }
    } catch (uploadError) {
      if (uploadError?.message !== "__SESSION_EXPIRED__") {
        showErrorToast(uploadError.message || "Gagal memproses preview topik.");
      }
    } finally {
      setUploadingTopik(false);
    }
  };

  const handleSaveUploadedTopik = async () => {
    if (topikUploadValidRows.length === 0) {
      showErrorToast("Belum ada data valid untuk disimpan.");
      return;
    }

    setSavingUploadedTopik(true);
    try {
      await fetchWithAuth("/api/admin/upload/topics/commit", {
        method: "POST",
        body: JSON.stringify({ rows: topikUploadValidRows }),
      });
      showSuccessToast("Topik valid berhasil disimpan ke database.");
      setUploadTopikResult(null);
      setTopikUploadFile(null);
      await loadAllData();
    } catch (saveError) {
      if (saveError?.message !== "__SESSION_EXPIRED__") {
        showErrorToast(saveError.message || "Gagal menyimpan topik hasil preview.");
      }
    } finally {
      setSavingUploadedTopik(false);
    }
  };

  const handlePendaftaranApprove = async (id) => {
    setRowActionLoadingId(id);
    try {
      await fetchWithAuth(`/api/sekretaris/pendaftaran/${id}/approve`, {
        method: "POST",
        body: JSON.stringify({ note: "Disetujui oleh sekretaris prodi." }),
      });
      showSuccessToast("Pendaftaran berhasil di-approve.");
      await loadAllData();
    } catch (approveError) {
      if (approveError?.message !== "__SESSION_EXPIRED__") {
        showErrorToast(approveError.message || "Gagal approve pendaftaran.");
      }
    } finally {
      setRowActionLoadingId(null);
    }
  };

  const handleExportPendaftaran = async () => {
    if (!isSekretaris) return;
    setExportingPendaftaran(true);
    try {
      const query = pendaftaranSearch.trim()
        ? `?search=${encodeURIComponent(pendaftaranSearch.trim())}`
        : "";

      const response = await fetch(`${apiBaseUrl}/api/sekretaris/pendaftaran/export${query}`, {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
      });

      let exportErrorPayload = null;
      if (!response.ok) {
        try {
          exportErrorPayload = await response.clone().json();
        } catch (parseError) {
          exportErrorPayload = null;
        }
      }

      const exportMessage = String(exportErrorPayload?.message || "");
      const exportLowerMessage = exportMessage.toLowerCase();
      const isExportTokenError =
        exportLowerMessage.includes("token tidak valid") ||
        exportLowerMessage.includes("token tidak ditemukan") ||
        exportLowerMessage.includes("kadaluarsa");

      if (response.status === 401 || (response.status === 403 && isExportTokenError)) {
        if (!sessionExpiredRef.current) {
          sessionExpiredRef.current = true;
          onSessionExpired?.();
        }
        throw new Error("__SESSION_EXPIRED__");
      }

      if (!response.ok) {
        throw new Error(exportErrorPayload?.message || "Export data penjaluran gagal diproses.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `export_pendaftaran_penjaluran_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showSuccessToast("Export data penjaluran berhasil.");
    } catch (exportError) {
      if (exportError?.message !== "__SESSION_EXPIRED__") {
        showErrorToast(exportError.message || "Gagal export data penjaluran.");
      }
    } finally {
      setExportingPendaftaran(false);
    }
  };

  const handlePendaftaranReject = async (id) => {
    const result = await Swal.fire({
      title: "Tolak pendaftaran",
      text: "Isi alasan penolakan.",
      input: "textarea",
      inputPlaceholder: "Alasan penolakan",
      showCancelButton: true,
      confirmButtonText: "Tolak",
      cancelButtonText: "Batal",
      inputValidator: (value) => (!value?.trim() ? "Alasan penolakan wajib diisi." : undefined),
    });
    if (!result.isConfirmed) return;

    setRowActionLoadingId(id);
    try {
      await fetchWithAuth(`/api/sekretaris/pendaftaran/${id}/reject`, {
        method: "POST",
        body: JSON.stringify({ note: result.value.trim() }),
      });
      showSuccessToast("Pendaftaran berhasil ditolak.");
      await loadAllData();
    } catch (rejectError) {
      if (rejectError?.message !== "__SESSION_EXPIRED__") {
        showErrorToast(rejectError.message || "Gagal reject pendaftaran.");
      }
    } finally {
      setRowActionLoadingId(null);
    }
  };

  const handlePeriodeInputChange = (event) => {
    const { name, value } = event.target;
    setPeriodeForm((prev) => ({ ...prev, [name]: value }));
    setPeriodeFormErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const handleExportMahasiswaMaster = async () => {
    if (!(isSekretaris && activeTab === "master-mahasiswa")) return;
    setExportingMahasiswaMaster(true);
    try {
      const params = new URLSearchParams();
      const search = mahasiswaMasterQuery.trim();
      if (search) {
        params.set("search", search);
      }

      const selectedAngkatan = String(mahasiswaMasterFilters?.angkatan || "").trim();
      const selectedSemesterPenjaluran = String(mahasiswaMasterFilters?.semester_penjaluran || "").trim();
      const selectedPeriode = String(mahasiswaMasterFilters?.periode || "").trim();
      const selectedPenjaluran = String(mahasiswaMasterFilters?.penjaluran || "").trim();
      const selectedTipePendaftaran = String(mahasiswaMasterFilters?.tipe_pendaftaran || "").trim();

      if (selectedAngkatan) params.set("angkatan", selectedAngkatan);
      if (selectedSemesterPenjaluran) params.set("semester_penjaluran", selectedSemesterPenjaluran);
      if (selectedPeriode) params.set("periode", selectedPeriode);
      if (selectedPenjaluran) params.set("penjaluran", selectedPenjaluran);
      if (selectedTipePendaftaran) params.set("tipe_pendaftaran", selectedTipePendaftaran);

      const query = params.toString() ? `?${params.toString()}` : "";
      const response = await fetch(`${apiBaseUrl}/api/sekretaris/mahasiswa/master/export${query}`, {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
      });

      let exportErrorPayload = null;
      if (!response.ok) {
        try {
          exportErrorPayload = await response.clone().json();
        } catch (_parseError) {
          exportErrorPayload = null;
        }
      }

      const exportMessage = String(exportErrorPayload?.message || "");
      const exportLowerMessage = exportMessage.toLowerCase();
      const isExportTokenError =
        exportLowerMessage.includes("token tidak valid") ||
        exportLowerMessage.includes("token tidak ditemukan") ||
        exportLowerMessage.includes("kadaluarsa");

      if (response.status === 401 || (response.status === 403 && isExportTokenError)) {
        if (!sessionExpiredRef.current) {
          sessionExpiredRef.current = true;
          onSessionExpired?.();
        }
        throw new Error("__SESSION_EXPIRED__");
      }

      if (!response.ok) {
        throw new Error(exportErrorPayload?.message || "Export master data mahasiswa gagal diproses.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `export_master_mahasiswa_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showSuccessToast("Export master data mahasiswa berhasil.");
    } catch (exportError) {
      if (exportError?.message !== "__SESSION_EXPIRED__") {
        showErrorToast(exportError.message || "Gagal export master data mahasiswa.");
      }
    } finally {
      setExportingMahasiswaMaster(false);
    }
  };

  const validatePeriodeMasterUniqueAssignments = useCallback((formValues) => {
    const duplicatesByField = {};
    const assignedMap = new Map();

    for (const item of PERIODE_MASTER_ALL_FIELDS) {
      const dosenId = Number(formValues?.[item.key]);
      if (!Number.isInteger(dosenId) || dosenId <= 0) continue;
      if (!assignedMap.has(dosenId)) {
        assignedMap.set(dosenId, []);
      }
      assignedMap.get(dosenId).push(item.key);
    }

    for (const fieldKeys of assignedMap.values()) {
      if (fieldKeys.length < 2) continue;
      for (const fieldKey of fieldKeys) {
        duplicatesByField[fieldKey] = "Dosen yang sama tidak boleh dipilih untuk lebih dari satu peran.";
      }
    }

    return duplicatesByField;
  }, []);

  const handlePeriodeMasterSearchQueryChange = (fieldKey, value) => {
    setPeriodeMasterSearchQueryByField((prev) => ({ ...prev, [fieldKey]: value }));
    setPeriodeMasterForm((prev) => {
      const selectedId = Number(prev?.[fieldKey]);
      if (!Number.isInteger(selectedId) || selectedId <= 0) return prev;
      const selectedDosen = periodeDosenMap.get(selectedId);
      const selectedLabel = formatPeriodeMasterDosenInputLabel(selectedDosen);
      if (String(value).trim().toLowerCase() === selectedLabel.trim().toLowerCase()) {
        return prev;
      }
      return { ...prev, [fieldKey]: "" };
    });
    setPeriodeMasterErrors((prev) => {
      if (!prev[fieldKey]) return prev;
      const next = { ...prev };
      delete next[fieldKey];
      return next;
    });
  };

  const handlePeriodeMasterSearchFocus = (fieldKey) => {
    setActivePeriodeMasterSearchField(fieldKey);
  };

  const handlePeriodeMasterSearchBlur = (fieldKey) => {
    window.setTimeout(() => {
      setActivePeriodeMasterSearchField((prev) => (prev === fieldKey ? "" : prev));
    }, 120);
  };

  const handleSelectPeriodeMasterDosen = (fieldKey, dosenValue) => {
    const parsedId = Number(dosenValue?.id ?? dosenValue);
    if (!Number.isInteger(parsedId) || parsedId <= 0) return;
    const selectedDosen = typeof dosenValue === "object" && dosenValue
      ? dosenValue
      : periodeDosenMap.get(parsedId);
    const selectedLabel = formatPeriodeMasterDosenInputLabel(selectedDosen);
    setPeriodeMasterForm((prev) => ({ ...prev, [fieldKey]: String(parsedId) }));
    setPeriodeMasterSearchQueryByField((prev) => ({ ...prev, [fieldKey]: selectedLabel }));
    setDebouncedPeriodeMasterSearchQueryByField((prev) => ({ ...prev, [fieldKey]: selectedLabel }));
    setActivePeriodeMasterSearchField("");
    setPeriodeMasterErrors((prev) => {
      if (!prev[fieldKey]) return prev;
      const next = { ...prev };
      delete next[fieldKey];
      return next;
    });
  };

  const getPeriodeMasterCandidateRows = useCallback(
    (fieldKey) => {
      const options = Array.isArray(periodeMasterOptionsByField[fieldKey])
        ? periodeMasterOptionsByField[fieldKey]
        : [];
      if (options.length === 0) return [];

      const currentSelectedId = Number(periodeMasterForm?.[fieldKey]);
      const selectedByOtherFields = new Set(
        PERIODE_MASTER_ALL_FIELDS.map((item) => item.key)
          .filter((key) => key !== fieldKey)
          .map((key) => Number(periodeMasterForm?.[key]))
          .filter((id) => Number.isInteger(id) && id > 0)
      );
      const searchQuery = String(debouncedPeriodeMasterSearchQueryByField?.[fieldKey] || "")
        .trim()
        .toLowerCase();

      return options
        .filter((row) => {
          const rowId = Number(row?.id);
          if (!Number.isInteger(rowId) || rowId <= 0) return false;
          if (rowId === currentSelectedId) return true;
          return !selectedByOtherFields.has(rowId);
        })
        .filter((row) => {
          if (!searchQuery) return true;
          const haystack = `${String(row?.nama || "")} ${String(row?.nik || "")}`.toLowerCase();
          return haystack.includes(searchQuery);
        })
        .slice(0, 8);
    },
    [periodeMasterForm, periodeMasterOptionsByField, debouncedPeriodeMasterSearchQueryByField]
  );

  const handleSavePeriodeMaster = async () => {
    const fieldErrors = {};
    PERIODE_MASTER_ALL_FIELDS.forEach((item) => {
      if (!periodeMasterForm[item.key]) {
        fieldErrors[item.key] = `${item.label} wajib dipilih.`;
      }
    });
    const duplicateErrors = validatePeriodeMasterUniqueAssignments(periodeMasterForm);
    Object.assign(fieldErrors, duplicateErrors);

    if (Object.keys(fieldErrors).length > 0) {
      setPeriodeMasterErrors(fieldErrors);
      showErrorToast("Master data penanggung jawab belum valid.");
      return;
    }

    setPeriodeMasterErrors({});
    setSavingPeriodeMaster(true);
    try {
      await fetchWithAuth("/api/sekretaris/periode/master-penanggung-jawab", {
        method: "POST",
        body: JSON.stringify({
          ketua_itsc_dosen_id: Number(periodeMasterForm.ketua_itsc_dosen_id),
          ketua_sirkel_dosen_id: Number(periodeMasterForm.ketua_sirkel_dosen_id),
          ketua_siber_dosen_id: Number(periodeMasterForm.ketua_siber_dosen_id),
          ketua_mvk_dosen_id: Number(periodeMasterForm.ketua_mvk_dosen_id),
          pengawas_magang_dosen_id: Number(periodeMasterForm.pengawas_magang_dosen_id),
          pengawas_pengabdian_dosen_id: Number(periodeMasterForm.pengawas_pengabdian_dosen_id),
          pengawas_perintisan_bisnis_dosen_id: Number(
            periodeMasterForm.pengawas_perintisan_bisnis_dosen_id
          ),
        }),
      });
      showSuccessToast("Master data penanggung jawab berhasil disimpan.");
      await loadAllData();
    } catch (saveError) {
      if (saveError?.message !== "__SESSION_EXPIRED__") {
        if (saveError?.detail && typeof saveError.detail === "object") {
          setPeriodeMasterErrors(saveError.detail);
          return;
        }
        showErrorToast(saveError.message || "Gagal menyimpan master data penanggung jawab.");
      }
    } finally {
      setSavingPeriodeMaster(false);
    }
  };

  const handleToggleMasterDosenKuotaRow = (dosenId) => {
    const parsedId = Number(dosenId);
    if (!Number.isInteger(parsedId) || parsedId <= 0) return;
    setMasterDosenSelectedDosenIds((prev) => {
      const exists = prev.some((item) => Number(item) === parsedId);
      if (exists) {
        return prev.filter((item) => Number(item) !== parsedId);
      }
      return [...prev, parsedId];
    });
  };

  const handleToggleMasterDosenKuotaPage = () => {
    if (pagedMasterDosenKuotaIds.length === 0) return;
    setMasterDosenSelectedDosenIds((prev) => {
      const set = new Set(prev.map((item) => Number(item)));
      if (isMasterDosenKuotaPageAllSelected) {
        pagedMasterDosenKuotaIds.forEach((id) => set.delete(id));
      } else {
        pagedMasterDosenKuotaIds.forEach((id) => set.add(id));
      }
      return [...set];
    });
  };

  const handleSaveMasterDosenKuota = async () => {
    const parsedKuota = Number(masterDosenKuotaValue);
    if (!Number.isInteger(parsedKuota) || parsedKuota < 1) {
      showErrorToast("Kuota bimbingan wajib angka bulat minimal 1.");
      return;
    }

    const selectedIds = [...new Set(masterDosenSelectedDosenIds.map((item) => Number(item)).filter((id) => Number.isInteger(id) && id > 0))];
    if (masterDosenKuotaMode === "selected" && selectedIds.length === 0) {
      showErrorToast("Pilih minimal satu dosen terlebih dahulu.");
      return;
    }

    const selectedSet = new Set(selectedIds);
    const targetRows =
      masterDosenKuotaMode === "all"
        ? masterDosenKuotaRows
        : masterDosenKuotaRows.filter((row) => selectedSet.has(Number(row?.id)));
    const invalidKuotaRows = targetRows
      .map((row) => {
        const sisa = Number(row?.kuota?.sisa || 0);
        const terpakai = Number(row?.kuota?.terpakai || 0);
        const minimalKuota = Math.max(1, sisa, terpakai);
        return {
          nama: row?.nama || row?.kode_dosen || row?.nik || "Dosen",
          minimalKuota,
          sisa,
          terpakai,
        };
      })
      .filter((row) => parsedKuota < row.minimalKuota);

    if (invalidKuotaRows.length > 0) {
      const contoh = invalidKuotaRows[0];
      showErrorToast(
        `Kuota ${parsedKuota} tidak valid. Contoh: ${contoh.nama} minimal ${contoh.minimalKuota} (sisa ${contoh.sisa}, terpakai ${contoh.terpakai}).`
      );
      return;
    }

    const konfirmasi = await Swal.fire({
      title: "Simpan kuota bimbingan?",
      html:
        masterDosenKuotaMode === "all"
          ? `Kuota akan diatur menjadi <b>${parsedKuota}</b> untuk <b>semua dosen</b>.`
          : `Kuota akan diatur menjadi <b>${parsedKuota}</b> untuk <b>${selectedIds.length} dosen terpilih</b>.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Ya, simpan",
      cancelButtonText: "Batal",
      confirmButtonColor: "#117246",
    });
    if (!konfirmasi.isConfirmed) return;

    setSavingMasterDosenKuota(true);
    try {
      const payload = await fetchWithAuth("/api/sekretaris/master-dosen/kuota", {
        method: "PUT",
        body: JSON.stringify({
          mode: masterDosenKuotaMode,
          kuota_bimbingan: parsedKuota,
          dosen_ids: masterDosenKuotaMode === "selected" ? selectedIds : [],
        }),
      });
      showSuccessToast(payload?.message || "Kuota bimbingan berhasil diperbarui.");
      if (masterDosenKuotaMode === "selected") {
        setMasterDosenSelectedDosenIds([]);
      }
      await loadAllData();
    } catch (errorSave) {
      if (errorSave?.message !== "__SESSION_EXPIRED__") {
        showErrorToast(errorSave.message || "Gagal menyimpan kuota bimbingan.");
      }
    } finally {
      setSavingMasterDosenKuota(false);
    }
  };

  const handleOpenPeriode = async () => {
    const fieldErrors = {};
    const masterErrors = {};
    const tahunAkademik = periodeForm.tahun_akademik.trim();
    const tahunRegex = /^\d{4}\/\d{4}$/;

    PERIODE_MASTER_ALL_FIELDS.forEach((item) => {
      if (!periodeMasterForm[item.key]) {
        masterErrors[item.key] = `${item.label} belum diatur di master data.`;
      }
    });
    const duplicateMasterErrors = validatePeriodeMasterUniqueAssignments(periodeMasterForm);
    Object.assign(masterErrors, duplicateMasterErrors);

    if (!tahunAkademik) {
      fieldErrors.tahun_akademik = "Tahun akademik wajib diisi.";
    } else if (!tahunRegex.test(tahunAkademik)) {
      fieldErrors.tahun_akademik = "Gunakan format YYYY/YYYY, contoh 2026/2027.";
    }
    if (!periodeForm.semester) {
      fieldErrors.semester = "Semester wajib dipilih.";
    }
    if (!periodeForm.tanggal_mulai) {
      fieldErrors.tanggal_mulai = "Tanggal mulai wajib diisi.";
    }
    if (!periodeForm.tanggal_selesai) {
      fieldErrors.tanggal_selesai = "Tanggal selesai wajib diisi.";
    }
    if (
      periodeForm.tanggal_mulai &&
      periodeForm.tanggal_selesai &&
      periodeForm.tanggal_mulai > periodeForm.tanggal_selesai
    ) {
      fieldErrors.tanggal_mulai = "Tanggal mulai tidak boleh melewati tanggal selesai.";
      fieldErrors.tanggal_selesai = "Tanggal selesai harus setelah tanggal mulai.";
    }

    if (Object.keys(masterErrors).length > 0) {
      setPeriodeMasterErrors(masterErrors);
      setPeriodeFormErrors(fieldErrors);
      showErrorToast("Periksa validasi master data penanggung jawab terlebih dahulu.");
      return;
    }
    setPeriodeMasterErrors({});

    if (Object.keys(fieldErrors).length > 0) {
      setPeriodeFormErrors(fieldErrors);
      return;
    }
    setPeriodeFormErrors({});

    const ketuaSummary = PERIODE_MASTER_KETUA_FIELDS
      .map((item) => {
        const dosen = periodeDosenMap.get(Number(periodeMasterForm[item.key]));
        return `${item.label}: <b>${dosen?.nama || "-"}</b>`;
      })
      .join("<br>");

    const konfirmasi = await Swal.fire({
      title: "Buka periode ini?",
      html: `
        Periode yang akan dibuka:<br><b>${formatLabel(periodeForm.semester)} ${tahunAkademik}</b><br><br>
        ${ketuaSummary}<br><br>
        Pengawas Magang: <b>${periodeDosenMap.get(Number(periodeMasterForm.pengawas_magang_dosen_id))?.nama || "-"}</b><br>
        Pengampu Pengabdian Masyarakat: <b>${periodeDosenMap.get(Number(periodeMasterForm.pengawas_pengabdian_dosen_id))?.nama || "-"}</b><br>
        Pengampu Perintisan Bisnis: <b>${periodeDosenMap.get(Number(periodeMasterForm.pengawas_perintisan_bisnis_dosen_id))?.nama || "-"}</b>
      `,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Ya, buka periode",
      cancelButtonText: "Batal",
      confirmButtonColor: "#117246",
    });
    if (!konfirmasi.isConfirmed) return;

    setSavingPeriode(true);
    try {
      await fetchWithAuth("/api/sekretaris/periode/open", {
        method: "POST",
        body: JSON.stringify({
          ketua_itsc_dosen_id: Number(periodeMasterForm.ketua_itsc_dosen_id),
          ketua_sirkel_dosen_id: Number(periodeMasterForm.ketua_sirkel_dosen_id),
          ketua_siber_dosen_id: Number(periodeMasterForm.ketua_siber_dosen_id),
          ketua_mvk_dosen_id: Number(periodeMasterForm.ketua_mvk_dosen_id),
          pengawas_magang_dosen_id: Number(periodeMasterForm.pengawas_magang_dosen_id),
          pengawas_pengabdian_dosen_id: Number(periodeMasterForm.pengawas_pengabdian_dosen_id),
          pengawas_perintisan_bisnis_dosen_id: Number(
            periodeMasterForm.pengawas_perintisan_bisnis_dosen_id
          ),
          tahun_akademik: tahunAkademik,
          semester: periodeForm.semester,
          tanggal_mulai: periodeForm.tanggal_mulai || null,
          tanggal_selesai: periodeForm.tanggal_selesai || null,
        }),
      });

      showSuccessToast("Periode berhasil dibuka.");
      setPeriodeForm({ ...PERIODE_FORM_INITIAL });
      setPeriodeFormErrors({});
      await loadAllData();
      setPeriodeMode("list");
    } catch (openError) {
      if (openError?.message !== "__SESSION_EXPIRED__") {
        if (openError?.detail && typeof openError.detail === "object") {
          const nextPeriodeErrors = {};
          const nextMasterErrors = {};
          const masterKeys = new Set([
            ...PERIODE_MASTER_KETUA_FIELDS.map((item) => item.key),
            ...PERIODE_MASTER_JALUR_FIELDS.map((item) => item.key),
          ]);
          Object.entries(openError.detail).forEach(([key, message]) => {
            if (masterKeys.has(key)) {
              nextMasterErrors[key] = message;
            } else {
              nextPeriodeErrors[key] = message;
            }
          });
          setPeriodeFormErrors(nextPeriodeErrors);
          setPeriodeMasterErrors(nextMasterErrors);
          return;
        }
        showErrorToast(openError.message || "Gagal membuka periode.");
      }
    } finally {
      setSavingPeriode(false);
    }
  };

  const loadReadonlyPeriodeRoles = useCallback(
    async (periodeId) => {
      if (!periodeId) {
        setPeriodeReadonlyRoles({ loading: false, rows: [], error: "" });
        return;
      }

      setPeriodeReadonlyRoles({ loading: true, rows: [], error: "" });
      try {
        const payload = await fetchWithAuth(`/api/sekretaris/ketua-klaster?periode_penjaluran_id=${periodeId}`);
        setPeriodeReadonlyRoles({
          loading: false,
          rows: Array.isArray(payload?.rows) ? payload.rows : [],
          error: "",
        });
      } catch (errorLoad) {
        if (errorLoad?.message === "__SESSION_EXPIRED__") {
          throw errorLoad;
        }
        setPeriodeReadonlyRoles({
          loading: false,
          rows: [],
          error: errorLoad?.message || "Gagal memuat data penanggung jawab periode.",
        });
      }
    },
    [fetchWithAuth]
  );

  const handleOpenPeriodeEditor = async (row) => {
    setEditingPeriode(row);
    setPeriodeFormErrors({});
    setPeriodeEditForm({
      tanggal_mulai: toDateInputValue(row?.tanggal_mulai),
      tanggal_selesai: toDateInputValue(row?.tanggal_selesai),
    });
    setPeriodeMode("edit");
    await loadReadonlyPeriodeRoles(row?.id);
  };

  const handlePeriodeEditInputChange = (event) => {
    const { name, value } = event.target;
    setPeriodeEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleUpdatePeriodeTanggal = async () => {
    if (!editingPeriode?.id) return;
    if (
      periodeEditForm.tanggal_mulai &&
      periodeEditForm.tanggal_selesai &&
      periodeEditForm.tanggal_mulai > periodeEditForm.tanggal_selesai
    ) {
      showErrorToast("Tanggal mulai tidak boleh lebih besar dari tanggal selesai.");
      return;
    }

    setSavingPeriode(true);
    try {
      await fetchWithAuth(`/api/sekretaris/periode/${editingPeriode.id}/tanggal`, {
        method: "PATCH",
        body: JSON.stringify({
          tanggal_mulai: periodeEditForm.tanggal_mulai || null,
          tanggal_selesai: periodeEditForm.tanggal_selesai || null,
        }),
      });
      showSuccessToast("Tanggal periode berhasil diperbarui.");
      await loadAllData();
      setPeriodeMode("list");
      setEditingPeriode(null);
      setPeriodeReadonlyRoles({ loading: false, rows: [], error: "" });
    } catch (editError) {
      if (editError?.message !== "__SESSION_EXPIRED__") {
        showErrorToast(editError.message || "Gagal memperbarui tanggal periode.");
      }
    } finally {
      setSavingPeriode(false);
    }
  };

  const handleClosePeriodeFromEditor = async () => {
    if (!editingPeriode?.id || !editingPeriode?.is_active) {
      showErrorToast("Hanya periode aktif yang bisa ditutup.");
      return;
    }

    const konfirmasi = await Swal.fire({
      title: "Tutup periode aktif?",
      html: `Anda akan menutup periode <b>${editingPeriode.label_periode || "-"}</b>.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Ya, tutup periode",
      cancelButtonText: "Batal",
      confirmButtonColor: "#b83a3a",
    });
    if (!konfirmasi.isConfirmed) return;

    setSavingPeriode(true);
    try {
      await fetchWithAuth(`/api/sekretaris/periode/${editingPeriode.id}/close`, {
        method: "POST",
        body: JSON.stringify({}),
      });

      showSuccessToast("Periode pendaftaran berhasil ditutup.");
      await loadAllData();
      setPeriodeMode("list");
      setEditingPeriode(null);
      setPeriodeReadonlyRoles({ loading: false, rows: [], error: "" });
    } catch (closeByIdError) {
      if (closeByIdError?.message !== "__SESSION_EXPIRED__") {
        showErrorToast(closeByIdError.message || "Gagal menutup periode.");
      }
    } finally {
      setSavingPeriode(false);
    }
  };

  const loadKetuaKlasterByPeriode = useCallback(
    async (periodeId) => {
      setKetuaKlasterError("");
      const query = periodeId ? `?periode_penjaluran_id=${periodeId}` : "";
      const payload = await fetchWithAuth(`/api/sekretaris/ketua-klaster${query}`);
      setKetuaKlasterOverview({
        active_periode: payload?.active_periode || null,
        periode_terpilih: payload?.periode_terpilih || null,
        periodes: Array.isArray(payload?.periodes) ? payload.periodes : [],
        rows: Array.isArray(payload?.rows) ? payload.rows : [],
      });
      setKetuaKlasterPeriodeId(payload?.periode_terpilih?.id ? String(payload.periode_terpilih.id) : "");
    },
    [fetchWithAuth]
  );

  useEffect(() => {
    if (!isSekretaris || activeTab !== "ketua-klaster") return;
    loadKetuaKlasterByPeriode(ketuaKlasterPeriodeId || "").catch((errorLoad) => {
      if (errorLoad?.message !== "__SESSION_EXPIRED__") {
        const message = errorLoad.message || "Gagal memuat data ketua klaster.";
        setKetuaKlasterError(message);
      }
    });
  }, [activeTab, isSekretaris, ketuaKlasterPeriodeId, loadKetuaKlasterByPeriode]);

  const handleChangeKetuaKlasterPeriode = async (event) => {
    const value = event.target.value;
    setKetuaKlasterPeriodeId(value);
    try {
      await loadKetuaKlasterByPeriode(value);
    } catch (errorLoad) {
      if (errorLoad?.message !== "__SESSION_EXPIRED__") {
        showErrorToast(errorLoad.message || "Gagal memuat data ketua klaster.");
      }
    }
  };

  const handleKetuaKlasterDraftChange = (klasterId, dosenId) => {
    setKetuaKlasterDraft((prev) => ({
      ...prev,
      [klasterId]: dosenId,
    }));
  };

  const handleSaveKetuaKlaster = async (row) => {
    const selectedDosenId = Number(ketuaKlasterDraft[row.id]);
    const selectedPeriodeId = Number(ketuaKlasterPeriodeId || ketuaKlasterOverview.periode_terpilih?.id);

    if (!Number.isInteger(selectedPeriodeId) || selectedPeriodeId <= 0) {
      showErrorToast("Periode belum dipilih.");
      return;
    }

    if (!Number.isInteger(selectedDosenId) || selectedDosenId <= 0) {
      showErrorToast(`Pilih ketua untuk klaster ${row.kode} terlebih dahulu.`);
      return;
    }

    const selectedDosen = Array.isArray(row.kandidat_dosen)
      ? row.kandidat_dosen.find((item) => item.id === selectedDosenId)
      : null;
    const confirm = await Swal.fire({
      title: "Simpan ketua klaster?",
      html: `Klaster: <b>${row.kode} - ${row.nama}</b><br>Ketua: <b>${selectedDosen?.nama || "-"}</b>`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Ya, simpan",
      cancelButtonText: "Batal",
      confirmButtonColor: "#2f63e3",
    });
    if (!confirm.isConfirmed) return;

    setSavingKetuaKlasterId(row.id);
    try {
      await fetchWithAuth("/api/sekretaris/ketua-klaster/assign", {
        method: "POST",
        body: JSON.stringify({
          periode_penjaluran_id: selectedPeriodeId,
          klaster_id: row.id,
          dosen_id: selectedDosenId,
        }),
      });
      showSuccessToast(`Ketua klaster ${row.kode} berhasil disimpan.`);
      await loadKetuaKlasterByPeriode(selectedPeriodeId);
    } catch (saveError) {
      if (saveError?.message !== "__SESSION_EXPIRED__") {
        showErrorToast(saveError.message || "Gagal menyimpan ketua klaster.");
      }
    } finally {
      setSavingKetuaKlasterId(null);
    }
  };

  const handleActivateDraftPeriode = async () => {
    const selectedId = Number(selectedKetuaPeriode?.id || ketuaKlasterPeriodeId);
    if (!Number.isInteger(selectedId) || selectedId <= 0) {
      showErrorToast("Pilih periode draft terlebih dahulu.");
      return;
    }

    const selectedStatus = String(selectedKetuaPeriode?.status || "").toLowerCase();
    if (selectedStatus === "active") {
      showErrorToast("Periode ini sudah aktif.");
      return;
    }
    if (selectedStatus === "closed") {
      showErrorToast("Periode closed tidak bisa diaktifkan. Buat draft periode baru.");
      return;
    }

    if (ketuaReviewStats.belumTerisi > 0) {
      showErrorToast(
        `Masih ada ${ketuaReviewStats.belumTerisi} klaster tanpa ketua. Lengkapi dulu sebelum aktivasi.`
      );
      return;
    }

    const confirm = await Swal.fire({
      title: "Aktifkan periode ini?",
      html: `Periode: <b>${selectedKetuaPeriode?.label_periode || "-"}</b><br/>Setelah aktif, periode dipakai untuk alur approval klaster.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Ya, aktifkan",
      cancelButtonText: "Batal",
      confirmButtonColor: "#117246",
    });
    if (!confirm.isConfirmed) return;

    setSavingPeriode(true);
    try {
      await fetchWithAuth(`/api/sekretaris/periode/${selectedId}/activate`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      showSuccessToast("Periode berhasil diaktifkan.");
      await loadAllData();
      setPeriodeMode("list");
    } catch (activateError) {
      if (activateError?.message !== "__SESSION_EXPIRED__") {
        showErrorToast(activateError.message || "Gagal mengaktifkan periode.");
      }
    } finally {
      setSavingPeriode(false);
    }
  };

  const mahasiswaMasterFilterPopup = showMahasiswaMasterFilterPanel && typeof document !== "undefined"
    ? createPortal(
        <div
          ref={mahasiswaMasterFilterPopupRef}
          className="fixed z-[120] rounded-xl border border-[#dbe5f8] bg-white shadow-xl"
          style={{
            top: `${mahasiswaMasterFilterPopupLayout.top}px`,
            left: `${mahasiswaMasterFilterPopupLayout.left}px`,
            width: `${mahasiswaMasterFilterPopupLayout.width}px`,
            maxHeight: `${mahasiswaMasterFilterPopupLayout.maxHeight}px`,
          }}
        >
          <div className="border-b border-[#e5ecf9] px-4 py-3">
            <p className="text-base font-bold text-[#1e315f]">Filter Data Mahasiswa</p>
            <p className="text-xs text-[#60709a]">Atur filter bertumpuk, lalu klik Terapkan.</p>
          </div>
          <div
            className="space-y-3 overflow-auto p-3"
            style={{ maxHeight: `${Math.max(160, mahasiswaMasterFilterPopupLayout.maxHeight - 126)}px` }}
          >
            <div className="rounded-lg border border-[#e6ecf8] p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-[#2a4175]">Angkatan</p>
                <button
                  type="button"
                  onClick={() => setMahasiswaMasterFilterDraft((prev) => ({ ...prev, angkatan: "" }))}
                  className="text-xs font-semibold text-[#2f63e3] hover:underline"
                >
                  Reset
                </button>
              </div>
              <select
                value={mahasiswaMasterFilterDraft.angkatan}
                onChange={(event) =>
                  setMahasiswaMasterFilterDraft((prev) => ({
                    ...prev,
                    angkatan: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-[#d3dbef] px-3 py-2 text-sm text-[#23396b] outline-none focus:border-[#2f63e3]"
              >
                <option value="">Semua angkatan</option>
                {mahasiswaMasterFilterOptions.angkatan.map((item) => (
                  <option key={`filter-angkatan-${item}`} value={item}>
                    Angkatan {item}
                  </option>
                ))}
              </select>
            </div>
            <div className="rounded-lg border border-[#e6ecf8] p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-[#2a4175]">Semester Penjaluran</p>
                <button
                  type="button"
                  onClick={() =>
                    setMahasiswaMasterFilterDraft((prev) => ({
                      ...prev,
                      semester_penjaluran: "",
                    }))
                  }
                  className="text-xs font-semibold text-[#2f63e3] hover:underline"
                >
                  Reset
                </button>
              </div>
              <select
                value={mahasiswaMasterFilterDraft.semester_penjaluran}
                onChange={(event) =>
                  setMahasiswaMasterFilterDraft((prev) => ({
                    ...prev,
                    semester_penjaluran: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-[#d3dbef] px-3 py-2 text-sm text-[#23396b] outline-none focus:border-[#2f63e3]"
              >
                <option value="">Semua semester penjaluran</option>
                {mahasiswaMasterFilterOptions.semester_penjaluran.map((item) => (
                  <option key={`filter-semester-penjaluran-${item}`} value={item}>
                    Semester Penjaluran {item}
                  </option>
                ))}
              </select>
            </div>
            <div className="rounded-lg border border-[#e6ecf8] p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-[#2a4175]">Periode Pendaftaran</p>
                <button
                  type="button"
                  onClick={() => setMahasiswaMasterFilterDraft((prev) => ({ ...prev, periode: "" }))}
                  className="text-xs font-semibold text-[#2f63e3] hover:underline"
                >
                  Reset
                </button>
              </div>
              <select
                value={mahasiswaMasterFilterDraft.periode}
                onChange={(event) =>
                  setMahasiswaMasterFilterDraft((prev) => ({
                    ...prev,
                    periode: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-[#d3dbef] px-3 py-2 text-sm text-[#23396b] outline-none focus:border-[#2f63e3]"
              >
                <option value="">Semua periode pendaftaran</option>
                {mahasiswaMasterFilterOptions.periode.map((item) => (
                  <option key={`filter-periode-${item}`} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div className="rounded-lg border border-[#e6ecf8] p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-[#2a4175]">Penjaluran</p>
                <button
                  type="button"
                  onClick={() => setMahasiswaMasterFilterDraft((prev) => ({ ...prev, penjaluran: "" }))}
                  className="text-xs font-semibold text-[#2f63e3] hover:underline"
                >
                  Reset
                </button>
              </div>
              <select
                value={mahasiswaMasterFilterDraft.penjaluran}
                onChange={(event) =>
                  setMahasiswaMasterFilterDraft((prev) => ({
                    ...prev,
                    penjaluran: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-[#d3dbef] px-3 py-2 text-sm text-[#23396b] outline-none focus:border-[#2f63e3]"
              >
                <option value="">Semua penjaluran</option>
                {mahasiswaMasterFilterOptions.penjaluran.map((item) => (
                  <option key={`filter-penjaluran-${item}`} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div className="rounded-lg border border-[#e6ecf8] p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-[#2a4175]">Tipe Pendaftaran</p>
                <button
                  type="button"
                  onClick={() =>
                    setMahasiswaMasterFilterDraft((prev) => ({
                      ...prev,
                      tipe_pendaftaran: "",
                    }))
                  }
                  className="text-xs font-semibold text-[#2f63e3] hover:underline"
                >
                  Reset
                </button>
              </div>
              <select
                value={mahasiswaMasterFilterDraft.tipe_pendaftaran}
                onChange={(event) =>
                  setMahasiswaMasterFilterDraft((prev) => ({
                    ...prev,
                    tipe_pendaftaran: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-[#d3dbef] px-3 py-2 text-sm text-[#23396b] outline-none focus:border-[#2f63e3]"
              >
                <option value="">Semua tipe daftar</option>
                {mahasiswaMasterFilterOptions.tipe_pendaftaran.map((item) => (
                  <option key={`filter-tipe-pendaftaran-${item}`} value={item}>
                    {formatLabel(item)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-[#e5ecf9] px-3 py-3">
            <button
              type="button"
              onClick={() => setMahasiswaMasterFilterDraft({ ...MAHASISWA_MASTER_FILTER_INITIAL })}
              disabled={!hasMahasiswaMasterDraftFilters}
              className="rounded-lg border border-[#d3dbef] px-3 py-2 text-sm font-semibold text-[#27407b] hover:bg-[#f3f6ff] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Reset all
            </button>
            <button
              type="button"
              onClick={handleApplyMahasiswaMasterFilters}
              disabled={!isMahasiswaMasterFilterDraftDirty}
              className="rounded-lg bg-[#2f63e3] px-3 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Terapkan
            </button>
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <div className="h-screen overflow-hidden bg-[#f2f3f7]">
      <header className="fixed inset-x-0 top-0 bg-[#2f63e3] text-white shadow-sm">
        <div className="flex w-full items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-[#f7d13d] p-1.5">
              <BookOpenCheck className="h-7 w-7 text-[#1f3a84]" />
            </div>
            <p className="text-sm font-black tracking-wide">
              {isSekretaris ? "SIMPS UII - DOSEN & SEKRETARIS PRODI" : "SIMPS UII - DOSEN"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <UserCircle2 className="h-7 w-7 text-[#dde7ff]" />
            <div className="text-right">
              <p className="text-sm font-bold">{session.user?.nama}</p>
              <p className="text-xs text-[#d4e1ff]">{session.user?.username}</p>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="rounded-lg border border-white/30 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/20"
            >
              <span className="inline-flex items-center gap-1">
                <LogOut className="h-3.5 w-3.5" />
                Keluar
              </span>
            </button>
          </div>
        </div>
      </header>

      <div className="mt-[76px] h-[calc(100vh-76px)] w-full overflow-hidden px-4 py-4 sm:px-6 lg:px-8">
        <div className="grid h-full grid-cols-1 gap-4 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="h-full rounded-xl border border-[#dce4f7] bg-white p-2 shadow-sm lg:overflow-y-auto">
            <p className="px-3 pb-2 pt-1 text-xs font-bold uppercase tracking-[0.08em] text-[#7d89a8]">Navigasi</p>
            <div className="space-y-3">
              {navSections.map((section) => (
                <div key={`nav-section-${section.key}`}>
                  <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#8a96b5]">
                    {section.label}
                  </p>
                  <div className="space-y-1">
                    {(section.items || []).map((item) => {
                      const Icon = item.icon;
                      const isActive = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setActiveTab(item.id)}
                          className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition ${
                            isActive ? "bg-[#2f63e3] text-white" : "text-[#405070] hover:bg-[#f2f6ff]"
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={loadAllData}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#d3dbef] bg-white px-4 py-2 text-sm font-semibold text-[#2b3f74] transition hover:bg-[#f2f6ff]"
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh Data
            </button>
          </aside>

          <main
            className={`min-w-0 pr-1 ${
              useGridViewportLayout
                ? "flex h-full flex-col gap-4 overflow-hidden"
                : "space-y-4 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            }`}
            style={{ msOverflowStyle: "none", overflowAnchor: "none" }}
          >
            <MenuSectionHeader
              icon={activeTabHeader.icon}
              title={activeTabHeader.title}
              subtitle={activeTabHeader.subtitle}
            />

            {activeTab === "dashboard" ? (
              <section className="grid grid-cols-1 gap-4 lg:grid-cols-4">
                <div className="rounded-xl border border-[#dae6ff] bg-white p-4 shadow-sm">
                  <p className="text-sm font-semibold text-[#4e5e86]">Total Pengajuan</p>
                  <p className="mt-2 text-2xl font-black text-[#1b274b]">{summary.totalSubmissions}</p>
                </div>
                <div className="rounded-xl border border-[#ffe8c4] bg-white p-4 shadow-sm">
                  <p className="text-sm font-semibold text-[#4e5e86]">Pending Review</p>
                  <p className="mt-2 text-2xl font-black text-[#1b274b]">{summary.pendingSubmissions}</p>
                </div>
                <div className="rounded-xl border border-[#dff3ec] bg-white p-4 shadow-sm">
                  <p className="text-sm font-semibold text-[#4e5e86]">Pamit Pending</p>
                  <p className="mt-2 text-2xl font-black text-[#1b274b]">{summary.pendingPamit}</p>
                </div>
                <div className="rounded-xl border border-[#e3e8f7] bg-white p-4 shadow-sm">
                  <p className="text-sm font-semibold text-[#4e5e86]">Kuota Bimbingan</p>
                  <p className="mt-2 text-2xl font-black text-[#1b274b]">
                    {summary.kuotaTerpakai}/{summary.kuotaTotal}
                  </p>
                  <p className="mt-1 text-sm text-[#5d6c91]">Sisa: {summary.kuotaSisa}</p>
                </div>
              </section>
            ) : null}

            {loading ? (
              <div className="rounded-xl border border-[#dce4f7] bg-white p-4 text-sm font-semibold text-[#55658f] shadow-sm">
                Memuat data dashboard...
              </div>
            ) : null}

            {error ? (
              <div className="rounded-xl border border-[#f6d7d7] bg-[#fff2f2] p-4 text-sm font-semibold text-[#a03f3f]">
                {error}
              </div>
            ) : null}

            {!loading && activeTab === "dashboard" ? (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <div className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                  <h3 className="mb-3 text-lg font-black text-[#1b274b]">Ringkasan Topik</h3>
                  <p className="text-sm text-[#51608a]">Jumlah topik yang Anda kelola saat ini:</p>
                  <p className="mt-2 text-3xl font-black text-[#1b274b]">{summary.topikAktif}</p>
                </div>
                <div className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                  <h3 className="mb-3 text-lg font-black text-[#1b274b]">Info Kuota</h3>
                  <div className="space-y-2 text-sm text-[#2a3c66]">
                    <p>
                      <span className="font-bold">Dosen:</span> {kuotaData?.dosen?.nama || "-"}
                    </p>
                    <p>
                      <span className="font-bold">NIK:</span> {kuotaData?.dosen?.nik || "-"}
                    </p>
                    <p>
                      <span className="font-bold">Total Kuota:</span> {summary.kuotaTotal}
                    </p>
                    <p>
                      <span className="font-bold">Terpakai:</span> {summary.kuotaTerpakai}
                    </p>
                    <p>
                      <span className="font-bold">Sisa:</span> {summary.kuotaSisa}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {!loading &&
            ((isSekretaris && activeTab === "master-mahasiswa") || activeTab === "mahasiswa-bimbingan") ? (
              <div className="flex min-h-0 flex-1 flex-col gap-4">
                <div className="rounded-xl border border-[#e4e9f6] bg-white p-3 shadow-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={loadAllData}
                      className="inline-flex items-center gap-2 rounded-lg border border-[#d3dbef] px-3 py-2 text-sm font-semibold text-[#27407b] hover:bg-[#f3f6ff]"
                    >
                      <RefreshCcw className="h-4 w-4" />
                      Refresh
                    </button>
                    {isSekretaris && activeTab === "master-mahasiswa" ? (
                      <button
                        type="button"
                        onClick={handleExportMahasiswaMaster}
                        disabled={exportingMahasiswaMaster}
                        className="inline-flex items-center gap-2 rounded-lg bg-[#0f7b50] px-3 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Download className="h-4 w-4" />
                        {exportingMahasiswaMaster ? "Exporting..." : "Download Excel"}
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                  <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-black text-[#1b274b]">
                        {activeTab === "mahasiswa-bimbingan"
                          ? "Grid Mahasiswa Bimbingan Dosen"
                          : "Grid Master Data Mahasiswa"}
                      </h3>
                      <p className="text-sm text-[#5d6c91]">
                        {activeTab === "mahasiswa-bimbingan"
                          ? "Menampilkan histori penjaluran mahasiswa yang saat ini dibimbing oleh dosen yang login."
                          : "Data ini dikelola oleh sekretaris prodi. Dosen dapat melihat histori ini secara baca saja."}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7282a8]" />
                        <input
                          type="text"
                          value={mahasiswaMasterQuery}
                          onChange={(event) => setMahasiswaMasterQuery(event.target.value)}
                          placeholder="Cari NIM, nama, periode, penjaluran, pembimbing..."
                          className="w-[340px] rounded-lg border border-[#d3dbef] py-2 pl-8 pr-3 text-sm outline-none focus:border-[#2f63e3]"
                        />
                      </div>
                      <div className="relative" ref={mahasiswaMasterFilterTriggerRef}>
                        <button
                          type="button"
                          onClick={handleToggleMahasiswaMasterFilterPanel}
                          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                            showMahasiswaMasterFilterPanel || hasMahasiswaMasterActiveFilters
                              ? "border-[#2f63e3] bg-[#eef3ff] text-[#2348a5]"
                              : "border-[#d3dbef] text-[#27407b] hover:bg-[#f3f6ff]"
                          }`}
                        >
                          <SlidersHorizontal className="h-4 w-4" />
                          Filter
                          {hasMahasiswaMasterActiveFilters ? (
                            <span className="rounded-full bg-[#2f63e3] px-1.5 py-0.5 text-xs font-bold leading-none text-white">
                              {mahasiswaMasterActiveFilterChips.length}
                            </span>
                          ) : null}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={handleResetMahasiswaMasterFilters}
                        disabled={!hasMahasiswaMasterActiveFilters}
                        className="rounded-lg border border-[#d3dbef] px-3 py-2 text-sm font-semibold text-[#27407b] hover:bg-[#f3f6ff] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Reset
                      </button>
                    </div>
                  </div>

                  {hasMahasiswaMasterActiveFilters ? (
                    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-[#e5ebf8] bg-[#f9fbff] px-3 py-2">
                      {mahasiswaMasterActiveFilterChips.map((chip) => (
                        <span
                          key={`chip-filter-master-mahasiswa-${chip.key}`}
                          className="inline-flex items-center gap-2 rounded-full border border-[#ccdbfa] bg-white px-2.5 py-1 text-xs font-semibold text-[#2a4175]"
                        >
                          {chip.label}
                          <button
                            type="button"
                            onClick={() =>
                              setMahasiswaMasterFilters((prev) => ({ ...prev, [chip.key]: "" }))
                            }
                            className="rounded-full border border-[#cfdbf5] px-1 text-[10px] font-bold text-[#5f719d] hover:bg-[#eef3ff]"
                            aria-label={`Hapus filter ${chip.label}`}
                          >
                            x
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <div className="relative mt-1 flex-1 overflow-auto rounded-lg border border-[#e6ecf8] grid-unified-height">
                  <table className="min-w-[2300px] text-left text-sm">
                    <thead>
                      <tr className="border-y border-[#e6ecf8] text-[#4d5e89]">
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">No</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">NIM</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Nama</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Email</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Angkatan</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Status Jalur Saat Ini</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Semester Penjaluran</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Periode Penjaluran</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Tahun Akademik</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Semester Akademik</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Jalur</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Nama Penjaluran</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Pembimbing TA</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">DPA</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Dospem Skripsi</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Status Pendaftaran</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Tanggal Penjaluran</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMahasiswaMasterRows.length > 0
                        ? pagedMahasiswaMasterRows.map((row, index) => (
                            <tr
                              key={`master-mahasiswa-row-${row.mahasiswa_id || row.nim || "x"}-${row.pendaftaran_id || "none"}-${index}`}
                              className="border-b border-[#eff3fb]"
                            >
                              <td className="px-3 py-2">
                                {(mahasiswaMasterPage - 1) * MAHASISWA_MASTER_PAGE_SIZE + index + 1}
                              </td>
                              <td className="px-3 py-2 font-semibold text-[#254080]">{row.nim || "-"}</td>
                              <td className="px-3 py-2">{row.nama || "-"}</td>
                              <td className="px-3 py-2">{row.email || "-"}</td>
                              <td className="px-3 py-2">{row.angkatan || "-"}</td>
                              <td className="px-3 py-2">{row.status_jalur_saat_ini || "-"}</td>
                              <td className="px-3 py-2">
                                {row.semester_penjaluran_aktif || row.semester_penjaluran_ke
                                  ? `Semester ${row.semester_penjaluran_aktif || row.semester_penjaluran_ke}`
                                  : "-"}
                              </td>
                              <td className="px-3 py-2">{row.periode_label || "-"}</td>
                              <td className="px-3 py-2">{row.tahun_akademik || "-"}</td>
                              <td className="px-3 py-2">
                                {row.semester_akademik ? formatLabel(row.semester_akademik) : "-"}
                              </td>
                              <td className="px-3 py-2">{row.jalur ? formatLabel(row.jalur) : "-"}</td>
                              <td className="px-3 py-2">
                                {row.nama_penjaluran ? formatLabel(row.nama_penjaluran) : "-"}
                              </td>
                              <td className="px-3 py-2">{row.pembimbing_ta || "-"}</td>
                              <td className="px-3 py-2">{row.dosen_pembimbing_akademik || "-"}</td>
                              <td className="px-3 py-2">{row.dosen_pembimbing_skripsi || "-"}</td>
                              <td className="px-3 py-2">
                                {row.pendaftaran_status ? formatLabel(row.pendaftaran_status) : "-"}
                              </td>
                              <td className="px-3 py-2">{formatDateTime(row.tanggal_penjaluran)}</td>
                              <td className="px-3 py-2">{formatDateTime(row.updatedAt)}</td>
                            </tr>
                          ))
                        : null}
                    </tbody>
                  </table>
                  {filteredMahasiswaMasterRows.length === 0 ? (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[41px] flex items-center justify-center px-4 text-center text-sm font-semibold text-[#7b88ab]">
                      Data mahasiswa tidak ditemukan.
                    </div>
                  ) : null}
                </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#e8edf8] pt-3">
                  <p className="text-sm text-[#4f5e86]">
                    Menampilkan {mahasiswaMasterRangeStart} - {mahasiswaMasterRangeEnd} dari{" "}
                    {filteredMahasiswaMasterRows.length} data mahasiswa.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setMahasiswaMasterPage((prev) => Math.max(1, prev - 1))}
                      disabled={mahasiswaMasterPage === 1}
                      className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] transition hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Sebelumnya
                    </button>
                    <span className="text-sm font-semibold text-[#314778]">
                      Halaman {mahasiswaMasterPage} / {totalMahasiswaMasterPages}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setMahasiswaMasterPage((prev) =>
                          Math.min(totalMahasiswaMasterPages, prev + 1)
                        )
                      }
                      disabled={mahasiswaMasterPage >= totalMahasiswaMasterPages}
                      className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] transition hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Berikutnya
                    </button>
                  </div>
                </div>
                </div>
              </div>
            ) : null}

            {!loading && activeTab === "bimbingan-review" ? (
              <DosenBimbinganReviewPage
                session={session}
                apiBaseUrl={apiBaseUrl}
                onSessionExpired={onSessionExpired}
                onRefreshParent={loadAllData}
                onModeChange={(isListMode) => setIsBimbinganReviewListMode(Boolean(isListMode))}
              />
            ) : null}

            {!loading && activeTab === "dokumen-sidang-review" ? (
              <DosenDokumenSidangReviewPage
                session={session}
                apiBaseUrl={apiBaseUrl}
                onSessionExpired={onSessionExpired}
              />
            ) : null}

            {!loading && activeTab === "ketersediaan-sidang" ? (
              <DosenSidangKetersediaanPage
                session={session}
                apiBaseUrl={apiBaseUrl}
                onSessionExpired={onSessionExpired}
              />
            ) : null}

            {!loading && isSekretaris && activeTab === "sidang-akhir" ? (
              <SekretarisSidangManagementPage
                session={session}
                apiBaseUrl={apiBaseUrl}
                onSessionExpired={onSessionExpired}
              />
            ) : null}

            {!loading && activeTab === "submissions" ? (
              <div className={submissionMode === "list" ? "flex min-h-0 flex-1 flex-col" : "space-y-4"}>
                {submissionMode === "list" ? (
                  <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <h3 className="text-lg font-black text-[#1b274b]">Grid Pengajuan Mahasiswa</h3>
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7282a8]" />
                          <input
                            type="text"
                            value={submissionQuery}
                            onChange={(event) => setSubmissionQuery(event.target.value)}
                            placeholder="Cari NIM, nama, jalur, judul, cluster, kode..."
                            className="w-[320px] rounded-lg border border-[#d3dbef] py-2 pl-8 pr-3 text-sm outline-none focus:border-[#2f63e3]"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={loadAllData}
                          className="inline-flex items-center gap-2 rounded-lg border border-[#d3dbef] px-3 py-2 text-sm font-semibold text-[#27407b] hover:bg-[#f3f6ff]"
                        >
                          <RefreshCcw className="h-4 w-4" />
                          Refresh
                        </button>
                      </div>
                    </div>

                    <div className="relative mt-1 flex-1 overflow-auto rounded-lg border border-[#e6ecf8] grid-unified-height">
                      <table className="w-full min-w-[2060px] table-fixed text-left text-sm">
                        <colgroup>
                          <col style={{ width: "56px" }} />
                          <col style={{ width: "220px" }} />
                          <col style={{ width: "120px" }} />
                          <col style={{ width: "88px" }} />
                          <col style={{ width: "120px" }} />
                          <col style={{ width: "640px" }} />
                          <col style={{ width: "110px" }} />
                          <col style={{ width: "130px" }} />
                          <col style={{ width: "110px" }} />
                          <col style={{ width: "220px" }} />
                          <col style={{ width: "170px" }} />
                          <col style={{ width: "170px" }} />
                        </colgroup>
                        <thead>
                          <tr className="border-y border-[#e6ecf8] text-[#4d5e89]">
                            <th className="bg-[#f8fbff] px-3 py-2 font-semibold whitespace-nowrap">No</th>
                            <th className="bg-[#f8fbff] px-3 py-2 font-semibold whitespace-nowrap">Nama Mahasiswa</th>
                            <th className="bg-[#f8fbff] px-3 py-2 font-semibold whitespace-nowrap">NIM</th>
                            <th className="bg-[#f8fbff] px-3 py-2 font-semibold whitespace-nowrap">Jalur</th>
                            <th className="bg-[#f8fbff] px-3 py-2 font-semibold whitespace-nowrap">Tipe</th>
                            <th className="bg-[#f8fbff] px-3 py-2 font-semibold whitespace-nowrap">Judul</th>
                            <th className="bg-[#f8fbff] px-3 py-2 font-semibold whitespace-nowrap">Cluster</th>
                            <th className="bg-[#f8fbff] px-3 py-2 font-semibold whitespace-nowrap">Kode Topik</th>
                            <th className="bg-[#f8fbff] px-3 py-2 font-semibold whitespace-nowrap">Status</th>
                            <th className="bg-[#f8fbff] px-3 py-2 font-semibold whitespace-nowrap">Tahap</th>
                            <th className="bg-[#f8fbff] px-3 py-2 font-semibold whitespace-nowrap">Diperbarui</th>
                            <th className="bg-[#f8fbff] px-3 py-2 font-semibold whitespace-nowrap">Aksi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredSubmissions.length > 0
                            ? pagedSubmissions.map((row, index) => {
                                const nomorUrut = submissionRangeStart + index;
                                const kodeTopikUtama =
                                  row.topik_fokus?.kode ||
                                  row.topik_disetujui?.kode ||
                                  (Array.isArray(row.topik_dipilih) && row.topik_dipilih.length > 0
                                    ? row.topik_dipilih[0]
                                    : null);
                                const normalizedKodeTopik = String(kodeTopikUtama || "")
                                  .trim()
                                  .toUpperCase();
                                const topikByKode = normalizedKodeTopik
                                  ? submissionTopikLookup.get(normalizedKodeTopik)
                                  : null;
                                const judulTopik =
                                  row.tipe_pengajuan === "judul_mandiri"
                                    ? row.judul_mandiri || "-"
                                    : row.topik_fokus?.judul ||
                                      row.topik_disetujui?.judul ||
                                      topikByKode?.judul ||
                                      (Array.isArray(row.topik_dipilih_detail)
                                        ? row.topik_dipilih_detail.find((item) => item?.kode === normalizedKodeTopik)?.judul
                                        : null) ||
                                      "-";
                                const clusterTopik =
                                  row.tipe_pengajuan === "judul_mandiri"
                                    ? "-"
                                    : topikByKode?.cluster || normalizedKodeTopik.replace(/[0-9].*$/, "") || "-";

                                return (
                                <tr key={`submission-${row.id}`} className="border-b border-[#eff3fb] align-top">
                                  <td className="px-3 py-2 font-semibold text-[#254080] whitespace-nowrap align-top">{nomorUrut}</td>
                                  <td className="px-3 py-2">
                                    <p className="font-semibold text-[#1f2d53] break-words">{row.mahasiswa?.nama || "-"}</p>
                                    <p className="text-xs text-[#61709b] whitespace-nowrap">Angkatan {row.mahasiswa?.angkatan || "-"}</p>
                                  </td>
                                  <td className="px-3 py-2 font-semibold text-[#27407b] whitespace-nowrap align-top">{row.mahasiswa?.nim || "-"}</td>
                                  <td className="px-3 py-2 whitespace-nowrap align-top">{formatLabel(row.jenis_jalur)}</td>
                                  <td className="px-3 py-2 whitespace-nowrap align-top">{formatLabel(row.tipe_pengajuan)}</td>
                                  <td className="px-3 py-2 align-top">
                                    <p
                                      className="max-w-[620px] overflow-hidden text-ellipsis whitespace-nowrap"
                                      title={judulTopik}
                                    >
                                      {judulTopik}
                                    </p>
                                  </td>
                                  <td className="px-3 py-2 whitespace-nowrap align-top">{clusterTopik}</td>
                                  <td className="px-3 py-2 whitespace-nowrap align-top">
                                    {normalizedKodeTopik ? (
                                      <span className="inline-flex whitespace-nowrap rounded-full bg-[#edf3ff] px-2 py-0.5 text-xs font-semibold text-[#2a4eab]">
                                        {normalizedKodeTopik}
                                      </span>
                                    ) : (
                                      "-"
                                    )}
                                  </td>
                                  <td className="px-3 py-2 whitespace-nowrap align-top">
                                    <span
                                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${getSubmissionStatusBadgeClass(
                                        row.status
                                      )}`}
                                    >
                                      {formatLabel(row.status)}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 align-top break-words">{formatLabel(row.tahap_approval)}</td>
                                  <td className="px-3 py-2 whitespace-nowrap align-top">{formatDateTime(row.diperbarui_pada || row.diajukan_pada)}</td>
                                  <td className="px-3 py-2 whitespace-nowrap align-top">
                                    {row.status === "pending" ? (
                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          disabled={loadingSubmissionDetail || rowActionLoadingId === row.id}
                                          onClick={() => handleOpenSubmissionReview(row.id, "approve")}
                                          className="rounded-md bg-[#137748] px-3 py-1 text-xs font-bold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                          Approve
                                        </button>
                                        <button
                                          type="button"
                                          disabled={loadingSubmissionDetail || rowActionLoadingId === row.id}
                                          onClick={() => handleOpenSubmissionReview(row.id, "reject")}
                                          className="rounded-md bg-[#b73a3a] px-3 py-1 text-xs font-bold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                          Tolak
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        type="button"
                                        disabled={loadingSubmissionDetail}
                                        onClick={() => handleOpenSubmissionReview(row.id, "approve")}
                                        className="inline-flex items-center gap-1 rounded-md bg-[#2f63e3] px-3 py-1.5 text-xs font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        <Eye className="h-3.5 w-3.5" />
                                        Detail
                                      </button>
                                    )}
                                  </td>
                                </tr>
                                );
                              })
                            : null}
                        </tbody>
                      </table>
                      {filteredSubmissions.length === 0 ? (
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[41px] flex items-center justify-center px-4 text-center text-sm font-semibold text-[#7b88ab]">
                          Belum ada pengajuan mahasiswa.
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#e8edf8] pt-3">
                      <p className="text-sm text-[#4f5e86]">
                        Menampilkan {submissionRangeStart} - {submissionRangeEnd} dari{" "}
                        {filteredSubmissions.length} data pengajuan.
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSubmissionPage((prev) => Math.max(1, prev - 1))}
                          disabled={submissionPage === 1}
                          className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] transition hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Sebelumnya
                        </button>
                        <span className="text-sm font-semibold text-[#314778]">
                          Halaman {submissionPage} / {totalSubmissionPages}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setSubmissionPage((prev) => Math.min(totalSubmissionPages, prev + 1))
                          }
                          disabled={submissionPage >= totalSubmissionPages}
                          className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] transition hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Berikutnya
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

                {submissionMode === "review" ? (
                  <div className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                    <div className="mb-4 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleBackToSubmissionList}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#d3dbef] text-[#2b3f74] hover:bg-[#f3f7ff]"
                        title="Kembali ke grid pengajuan"
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </button>
                      <div>
                        <h3 className="text-lg font-black text-[#1b274b]">Detail Pengajuan Mahasiswa</h3>
                        <p className="text-sm text-[#5d6c91]">Lihat detail dan riwayat keputusan pengajuan mahasiswa.</p>
                      </div>
                    </div>

                    {loadingSubmissionDetail ? (
                      <div className="rounded-lg border border-[#e2e9f8] bg-[#f8fbff] p-6 text-center text-sm font-semibold text-[#60709a]">
                        Memuat detail pengajuan...
                      </div>
                    ) : null}

                    {!loadingSubmissionDetail && submissionDetail ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                          <div className="rounded-lg border border-[#e2e9f8] bg-[#f8fbff] p-4">
                            <h4 className="text-sm font-black text-[#1b274b]">Data Mahasiswa</h4>
                            <div className="mt-2 grid grid-cols-1 gap-2 text-sm text-[#324c86]">
                              <p><span className="font-semibold">NIM:</span> {submissionDetail.mahasiswa?.nim || "-"}</p>
                              <p><span className="font-semibold">Nama:</span> {submissionDetail.mahasiswa?.nama || "-"}</p>
                              <p><span className="font-semibold">Email:</span> {submissionDetail.mahasiswa?.email || "-"}</p>
                              <p><span className="font-semibold">Angkatan:</span> {submissionDetail.mahasiswa?.angkatan || "-"}</p>
                            </div>
                          </div>
                          <div className="rounded-lg border border-[#e2e9f8] bg-white p-4">
                            <h4 className="text-sm font-black text-[#1b274b]">Ringkasan Pengajuan</h4>
                            <div className="mt-2 grid grid-cols-1 gap-2 text-sm text-[#324c86]">
                              <p><span className="font-semibold">Jenis Jalur:</span> {formatLabel(submissionDetail.jenis_jalur)}</p>
                              <p><span className="font-semibold">Tipe:</span> {formatLabel(submissionDetail.tipe_pengajuan)}</p>
                              <p><span className="font-semibold">Diajukan:</span> {formatDateTime(submissionDetail.diajukan_pada)}</p>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-[#324c86]">Status:</span>
                                <span
                                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${getSubmissionStatusBadgeClass(
                                    submissionDetail.status
                                  )}`}
                                >
                                  {formatLabel(submissionDetail.status)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-lg border border-[#e2e9f8] bg-white p-4">
                          <h4 className="text-sm font-black text-[#1b274b]">Detail Topik/Judul</h4>
                          {submissionDetail.tipe_pengajuan === "topik_dosen" ? (
                            <div className="mt-3 overflow-auto rounded-lg border border-[#e6ecf8] grid-unified-height">
                              <table className="w-full min-w-[700px] text-left text-sm">
                                <thead>
                                  <tr className="border-y border-[#e6ecf8] text-[#4d5e89]">
                                    <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Slot</th>
                                    <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Kode</th>
                                    <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Judul</th>
                                    <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Dosen</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(submissionDetail.detail_pengajuan?.topik_dipilih || []).map((topik) => (
                                    <tr key={`review-topik-${topik.slot}-${topik.kode}`} className="border-b border-[#eff3fb]">
                                      <td className="px-3 py-2">{topik.slot}</td>
                                      <td className="px-3 py-2 font-semibold text-[#254080]">{topik.kode}</td>
                                      <td className="px-3 py-2">{topik.judul || "-"}</td>
                                      <td className="px-3 py-2">{topik.dosen || "-"}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="mt-3 space-y-2 text-sm text-[#324c86]">
                              <p><span className="font-semibold">Judul:</span> {submissionDetail.detail_pengajuan?.judul_mandiri || "-"}</p>
                              <p><span className="font-semibold">Deskripsi:</span> {submissionDetail.detail_pengajuan?.deskripsi_mandiri || "-"}</p>
                              <p><span className="font-semibold">Keyword:</span> {submissionDetail.detail_pengajuan?.keyword_mandiri || "-"}</p>
                            </div>
                          )}
                        </div>

                        <div className="rounded-lg border border-[#e2e9f8] bg-white p-4">
                          {submissionDetail.status === "pending" ? (
                            <>
                              <h4 className="text-sm font-black text-[#1b274b]">Form Keputusan</h4>
                              <div className="mt-3 space-y-3">
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setSubmissionDecision("approve")}
                                    className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${
                                      submissionDecision === "approve"
                                        ? "bg-[#137748] text-white"
                                        : "border border-[#cfe3d8] bg-white text-[#1e6f45]"
                                    }`}
                                  >
                                    Approve
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setSubmissionDecision("reject")}
                                    className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${
                                      submissionDecision === "reject"
                                        ? "bg-[#b73a3a] text-white"
                                        : "border border-[#f0cfcf] bg-white text-[#9f3535]"
                                    }`}
                                  >
                                    Tolak
                                  </button>
                                </div>

                                <div>
                                  <label className="mb-1 block text-sm font-semibold text-[#344b7f]">
                                    {submissionDecision === "approve" ? "Alasan/Catatan Persetujuan" : "Alasan Penolakan"}
                                  </label>
                                  <textarea
                                    rows={4}
                                    value={submissionKeterangan}
                                    onChange={(event) => setSubmissionKeterangan(event.target.value)}
                                    placeholder={
                                      submissionDecision === "approve"
                                        ? "Isi catatan persetujuan..."
                                        : "Isi alasan penolakan..."
                                    }
                                    className="w-full rounded-lg border border-[#d3dbef] px-3 py-2 text-sm outline-none focus:border-[#2f63e3]"
                                  />
                                </div>
                              </div>
                            </>
                          ) : (
                            <>
                              <h4 className="text-sm font-black text-[#1b274b]">Riwayat Keputusan</h4>
                              {Array.isArray(submissionDetail.riwayat_persetujuan) &&
                              submissionDetail.riwayat_persetujuan.length > 0 ? (
                                <div className="mt-3 space-y-3">
                                  {submissionDetail.riwayat_persetujuan.map((item, index) => (
                                    <div
                                      key={`riwayat-keputusan-${item.tanggal_keputusan || index}`}
                                      className="rounded-lg border border-[#e7ecf8] bg-[#f9fbff] p-3"
                                    >
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <span
                                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${getSubmissionStatusBadgeClass(
                                            item.status
                                          )}`}
                                        >
                                          {formatLabel(item.status)}
                                        </span>
                                        <span className="text-xs font-semibold text-[#5d6c91]">
                                          {item.dosen?.nama || "Dosen"} | {formatDateTime(item.tanggal_keputusan)}
                                        </span>
                                      </div>
                                      <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-[#4f5f88]">
                                        {item.status === "approved" ? "Alasan Approve" : "Alasan Reject"}
                                      </p>
                                      <p className="mt-1 text-sm text-[#2f426f]">{item.keterangan || "-"}</p>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="mt-3 rounded-lg border border-[#e9edf8] bg-[#f7f9ff] px-3 py-2 text-sm font-semibold text-[#5e6d95]">
                                  Belum ada riwayat keputusan untuk pengajuan ini.
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={handleBackToSubmissionList}
                            className="rounded-lg border border-[#d3dbef] bg-white px-4 py-2 text-sm font-semibold text-[#2a3f75] transition hover:bg-[#f3f7ff]"
                          >
                            Kembali
                          </button>
                          {submissionDetail.status === "pending" ? (
                            <button
                              type="button"
                              disabled={rowActionLoadingId === selectedSubmissionId}
                              onClick={handleSubmitSubmissionDecision}
                              className={`rounded-lg px-4 py-2 text-sm font-bold text-white transition ${
                                submissionDecision === "approve"
                                  ? "bg-[#137748] hover:brightness-110"
                                  : "bg-[#b73a3a] hover:brightness-110"
                              } disabled:cursor-not-allowed disabled:opacity-60`}
                            >
                              {rowActionLoadingId === selectedSubmissionId
                                ? "Memproses..."
                                : submissionDecision === "approve"
                                ? "Simpan Approve"
                                : "Simpan Tolak"}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {!loading && activeTab === "permohonan-extend" ? (
              <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-lg font-black text-[#1b274b]">Grid Permohonan Extend Penjaluran Semester 3</h3>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7282a8]" />
                      <input
                        type="text"
                        value={izinLanjutQuery}
                        onChange={(event) => setIzinLanjutQuery(event.target.value)}
                        placeholder="Cari ID, NIM, nama, periode, status..."
                        className="w-[320px] rounded-lg border border-[#d3dbef] py-2 pl-8 pr-3 text-sm outline-none focus:border-[#2f63e3]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={loadAllData}
                      className="inline-flex items-center gap-2 rounded-lg border border-[#d3dbef] px-3 py-2 text-sm font-semibold text-[#27407b] hover:bg-[#f3f6ff]"
                    >
                      <RefreshCcw className="h-4 w-4" />
                      Refresh
                    </button>
                  </div>
                </div>

                <div className="relative mt-1 flex-1 overflow-auto rounded-lg border border-[#e6ecf8] grid-unified-height">
                  <table className="w-full min-w-[1400px] text-left text-sm">
                    <thead>
                      <tr className="border-y border-[#e6ecf8] text-[#4d5e89]">
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">ID</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Mahasiswa</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Semester</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Periode</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Alasan Mahasiswa</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Status</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Diajukan</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredIzinLanjutRows.length > 0
                        ? pagedIzinLanjutRows.map((row) => (
                            <tr key={`izin-lanjut-${row.id}`} className="border-b border-[#eff3fb]">
                              <td className="px-3 py-2 font-semibold text-[#254080]">#{row.id}</td>
                              <td className="px-3 py-2">
                                <p className="font-semibold text-[#1f2d53]">{row.mahasiswa?.nama || "-"}</p>
                                <p className="text-xs text-[#61709b]">
                                  {row.mahasiswa?.nim || "-"} | Angkatan {row.mahasiswa?.angkatan || "-"}
                                </p>
                              </td>
                              <td className="px-3 py-2">Semester {row.semester_penjaluran_ke || "-"}</td>
                              <td className="px-3 py-2">{row.periode?.label_periode || "-"}</td>
                              <td className="px-3 py-2">
                                <p className="line-clamp-2 text-[#2f426f]">{row.alasan_pengajuan || "-"}</p>
                              </td>
                              <td className="px-3 py-2">
                                <span
                                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${getSubmissionStatusBadgeClass(
                                    row.status
                                  )}`}
                                >
                                  {formatLabel(row.status)}
                                </span>
                              </td>
                              <td className="px-3 py-2">{formatDateTime(row.tanggal_pengajuan)}</td>
                              <td className="px-3 py-2">
                                {row.status === "pending" ? (
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      disabled={rowActionLoadingId === row.id}
                                      onClick={() => handleApproveIzinLanjut(row.id)}
                                      className="rounded-md bg-[#137748] px-3 py-1 text-xs font-bold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      Approve
                                    </button>
                                    <button
                                      type="button"
                                      disabled={rowActionLoadingId === row.id}
                                      onClick={() => handleRejectIzinLanjut(row.id)}
                                      className="rounded-md bg-[#b73a3a] px-3 py-1 text-xs font-bold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      Tolak
                                    </button>
                                    <button
                                      type="button"
                                      disabled={rowActionLoadingId === row.id}
                                      onClick={() => handleOpenIzinLanjutDetail(row.id)}
                                      className="inline-flex items-center gap-1 rounded-md bg-[#2f63e3] px-3 py-1 text-xs font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                      Detail
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={rowActionLoadingId === row.id}
                                    onClick={() => handleOpenIzinLanjutDetail(row.id)}
                                    className="inline-flex items-center gap-1 rounded-md bg-[#2f63e3] px-3 py-1.5 text-xs font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                    Detail
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))
                        : null}
                    </tbody>
                  </table>
                  {filteredIzinLanjutRows.length === 0 ? (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[41px] flex items-center justify-center px-4 text-center text-sm font-semibold text-[#7b88ab]">
                      Belum ada permintaan permohonan extend semester 3.
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#e8edf8] pt-3">
                  <p className="text-sm text-[#4f5e86]">
                    Menampilkan {izinRangeStart} - {izinRangeEnd} dari {filteredIzinLanjutRows.length} data
                    permohonan.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIzinLanjutPage((prev) => Math.max(1, prev - 1))}
                      disabled={izinLanjutPage === 1}
                      className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] transition hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Sebelumnya
                    </button>
                    <span className="text-sm font-semibold text-[#314778]">
                      Halaman {izinLanjutPage} / {totalIzinLanjutPages}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setIzinLanjutPage((prev) => Math.min(totalIzinLanjutPages, prev + 1))
                      }
                      disabled={izinLanjutPage >= totalIzinLanjutPages}
                      className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] transition hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Berikutnya
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {!loading && activeTab === "pamit" ? (
              <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                <h3 className="mb-3 text-lg font-black text-[#1b274b]">Grid Pamit Mahasiswa</h3>
                <div className="relative mt-1 flex-1 overflow-auto rounded-lg border border-[#e6ecf8] grid-unified-height">
                  <table className="min-w-[1200px] text-left text-sm">
                    <thead>
                      <tr className="border-y border-[#e6ecf8] text-[#4d5e89]">
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">ID</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Mahasiswa</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Status</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Alasan Ulang</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Tanggal</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pamitRows.length > 0
                        ? pagedPamitRows.map((row) => (
                            <tr key={`pamit-${row.id}`} className="border-b border-[#eff3fb]">
                              <td className="px-3 py-2">{row.id}</td>
                              <td className="px-3 py-2">
                                {row.mahasiswa?.nim || "-"} - {row.mahasiswa?.nama || "-"}
                              </td>
                              <td className="px-3 py-2">{formatLabel(row.status_dospem)}</td>
                              <td className="px-3 py-2">{row.alasan_ulang || "-"}</td>
                              <td className="px-3 py-2">{formatDateTime(row.createdAt)}</td>
                              <td className="px-3 py-2">
                                {row.status_dospem === "pending" ? (
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handlePamitApprove(row.id)}
                                      className="rounded-md bg-[#137748] px-3 py-1 text-xs font-bold text-white hover:brightness-110"
                                    >
                                      Approve
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handlePamitReject(row.id)}
                                      className="rounded-md bg-[#b73a3a] px-3 py-1 text-xs font-bold text-white hover:brightness-110"
                                    >
                                      Tolak
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-xs text-[#68779f]">Sudah diproses</span>
                                )}
                              </td>
                            </tr>
                          ))
                        : null}
                    </tbody>
                  </table>
                  {pamitRows.length === 0 ? (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[41px] flex items-center justify-center px-4 text-center text-sm font-semibold text-[#7b88ab]">
                      Belum ada data pamit mahasiswa.
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#e8edf8] pt-3">
                  <p className="text-sm text-[#4f5e86]">
                    Menampilkan {pamitRangeStart} - {pamitRangeEnd} dari {pamitRows.length} data pamit.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPamitPage((prev) => Math.max(1, prev - 1))}
                      disabled={pamitPage === 1}
                      className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] transition hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Sebelumnya
                    </button>
                    <span className="text-sm font-semibold text-[#314778]">
                      Halaman {pamitPage} / {totalPamitPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPamitPage((prev) => Math.min(totalPamitPages, prev + 1))}
                      disabled={pamitPage >= totalPamitPages}
                      className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] transition hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Berikutnya
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {!loading && isSekretaris && activeTab === "master-dosen" ? (
              <div
                className={
                  masterDosenTab === "kuota-bimbingan"
                    ? "space-y-4 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    : "space-y-4 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                }
              >
                <div className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                  <p className="text-lg font-black text-[#1b274b]">Menu Master Dosen</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {MASTER_DOSEN_TAB_OPTIONS.map((item) => (
                      <button
                        key={`master-dosen-tab-${item.key}`}
                        type="button"
                        onClick={() => setMasterDosenTab(item.key)}
                        className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                          masterDosenTab === item.key
                            ? "border-[#2f63e3] bg-[#2f63e3] text-white"
                            : "border-[#d3dbef] text-[#345087] hover:bg-[#f4f7ff]"
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {masterDosenTab === "penanggung-jawab" ? (
                  <div className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                    <div>
                      <p className="text-sm font-black text-[#1b274b]">
                        Master Data Penanggung Jawab Penjaluran
                      </p>
                      <p className="mt-1 text-sm text-[#5d6c91]">
                        Atur ketua cluster dan pembimbing jalur yang akan dipakai otomatis saat periode penjaluran dibuka.
                      </p>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
                      {PERIODE_MASTER_KETUA_FIELDS.map((item) => {
                        const selectedId = periodeMasterSelectedDosenIdsByField[item.key];
                        const selectedDosen = selectedId ? periodeDosenMap.get(Number(selectedId)) : null;
                        const selectedLabel = formatPeriodeMasterDosenInputLabel(selectedDosen);
                        const searchValue = String(periodeMasterSearchQueryByField[item.key] || "");
                        const debouncedSearchValue = String(
                          debouncedPeriodeMasterSearchQueryByField[item.key] || ""
                        );
                        const searchResults = getPeriodeMasterCandidateRows(item.key);
                        const shouldShowResults =
                          activePeriodeMasterSearchField === item.key &&
                          searchValue.trim().length > 0 &&
                          searchValue.trim().toLowerCase() !== selectedLabel.trim().toLowerCase();
                        const isDebouncing =
                          searchValue.trim().length > 0 &&
                          searchValue.trim().toLowerCase() !== debouncedSearchValue.trim().toLowerCase();
                        return (
                          <div
                            key={`master-dosen-ketua-${item.code}`}
                            className="rounded-lg border border-[#e6ecf8] bg-[#fbfcff] p-3"
                          >
                            <label className="mb-1 block text-sm font-semibold text-[#344b7f]">{item.label}</label>
                            <div className="relative">
                              <input
                                type="text"
                                value={searchValue}
                                onFocus={() => handlePeriodeMasterSearchFocus(item.key)}
                                onBlur={() => handlePeriodeMasterSearchBlur(item.key)}
                                onChange={(event) =>
                                  handlePeriodeMasterSearchQueryChange(item.key, event.target.value)
                                }
                                placeholder={`Cari nama atau NIK dosen ketua ${item.code}`}
                                className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[#2f63e3] ${
                                  periodeMasterErrors[item.key]
                                    ? "border-[#dc4b4b] bg-[#fff7f7]"
                                    : "border-[#d3dbef]"
                                }`}
                              />
                              {shouldShowResults ? (
                                <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 max-h-44 overflow-auto rounded-lg border border-[#d9e3fb] bg-white shadow-lg">
                                  {isDebouncing ? (
                                    <p className="px-3 py-2 text-xs font-semibold text-[#7282a8]">Mencari...</p>
                                  ) : searchResults.length > 0 ? (
                                    searchResults.map((dosen) => (
                                      <button
                                        key={`master-dosen-ketua-${item.code}-${dosen.id}`}
                                        type="button"
                                        onMouseDown={(event) => event.preventDefault()}
                                        onClick={() => handleSelectPeriodeMasterDosen(item.key, dosen)}
                                        className="flex w-full items-center justify-between border-b border-[#edf1fb] px-3 py-2 text-left text-sm text-[#213460] hover:bg-[#f4f7ff] last:border-b-0"
                                      >
                                        <span className="font-semibold">{dosen.nama || "-"}</span>
                                        <span className="text-xs text-[#5d6c91]">NIK: {dosen.nik || "-"}</span>
                                      </button>
                                    ))
                                  ) : (
                                    <p className="px-3 py-2 text-xs font-semibold text-[#7282a8]">
                                      Dosen tidak ditemukan.
                                    </p>
                                  )}
                                </div>
                              ) : null}
                            </div>
                            {periodeMasterErrors[item.key] ? (
                              <p className="mt-1 text-xs font-semibold text-[#c23737]">{periodeMasterErrors[item.key]}</p>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-3">
                      {PERIODE_MASTER_JALUR_FIELDS.map((item) => {
                        const selectedId = periodeMasterSelectedDosenIdsByField[item.key];
                        const selectedDosen = selectedId ? periodeDosenMap.get(Number(selectedId)) : null;
                        const selectedLabel = formatPeriodeMasterDosenInputLabel(selectedDosen);
                        const searchValue = String(periodeMasterSearchQueryByField[item.key] || "");
                        const debouncedSearchValue = String(
                          debouncedPeriodeMasterSearchQueryByField[item.key] || ""
                        );
                        const searchResults = getPeriodeMasterCandidateRows(item.key);
                        const shouldShowResults =
                          activePeriodeMasterSearchField === item.key &&
                          searchValue.trim().length > 0 &&
                          searchValue.trim().toLowerCase() !== selectedLabel.trim().toLowerCase();
                        const isDebouncing =
                          searchValue.trim().length > 0 &&
                          searchValue.trim().toLowerCase() !== debouncedSearchValue.trim().toLowerCase();
                        return (
                          <div
                            key={`master-dosen-jalur-${item.key}`}
                            className="rounded-lg border border-[#e6ecf8] bg-[#fbfcff] p-3"
                          >
                            <label className="mb-1 block text-sm font-semibold text-[#344b7f]">{item.label}</label>
                            <div className="relative">
                              <input
                                type="text"
                                value={searchValue}
                                onFocus={() => handlePeriodeMasterSearchFocus(item.key)}
                                onBlur={() => handlePeriodeMasterSearchBlur(item.key)}
                                onChange={(event) =>
                                  handlePeriodeMasterSearchQueryChange(item.key, event.target.value)
                                }
                                placeholder={`Cari nama atau NIK untuk ${item.label.toLowerCase()}`}
                                className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[#2f63e3] ${
                                  periodeMasterErrors[item.key]
                                    ? "border-[#dc4b4b] bg-[#fff7f7]"
                                    : "border-[#d3dbef]"
                                }`}
                              />
                              {shouldShowResults ? (
                                <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 max-h-44 overflow-auto rounded-lg border border-[#d9e3fb] bg-white shadow-lg">
                                  {isDebouncing ? (
                                    <p className="px-3 py-2 text-xs font-semibold text-[#7282a8]">Mencari...</p>
                                  ) : searchResults.length > 0 ? (
                                    searchResults.map((dosen) => (
                                      <button
                                        key={`master-dosen-${item.key}-${dosen.id}`}
                                        type="button"
                                        onMouseDown={(event) => event.preventDefault()}
                                        onClick={() => handleSelectPeriodeMasterDosen(item.key, dosen)}
                                        className="flex w-full items-center justify-between border-b border-[#edf1fb] px-3 py-2 text-left text-sm text-[#213460] hover:bg-[#f4f7ff] last:border-b-0"
                                      >
                                        <span className="font-semibold">{dosen.nama || "-"}</span>
                                        <span className="text-xs text-[#5d6c91]">NIK: {dosen.nik || "-"}</span>
                                      </button>
                                    ))
                                  ) : (
                                    <p className="px-3 py-2 text-xs font-semibold text-[#7282a8]">
                                      Dosen tidak ditemukan.
                                    </p>
                                  )}
                                </div>
                              ) : null}
                            </div>
                            {periodeMasterErrors[item.key] ? (
                              <p className="mt-1 text-xs font-semibold text-[#c23737]">{periodeMasterErrors[item.key]}</p>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-4 flex justify-end">
                      <button
                        type="button"
                        onClick={handleSavePeriodeMaster}
                        disabled={savingPeriodeMaster}
                        className="inline-flex items-center gap-2 rounded-lg bg-[#2f63e3] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {savingPeriodeMaster ? "Menyimpan..." : "Simpan Master Data"}
                      </button>
                    </div>
                  </div>
                ) : null}

                {masterDosenTab === "kuota-bimbingan" ? (
                  <>
                    <div className="rounded-xl border border-[#dce4f7] bg-white p-3 shadow-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setMasterDosenTab("penanggung-jawab")}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#d3dbef] text-[#27407b] transition hover:bg-[#f3f6ff]"
                          aria-label="Kembali ke tab penanggung jawab"
                        >
                          <ArrowLeft className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={loadAllData}
                          className="inline-flex items-center gap-2 rounded-lg border border-[#d3dbef] px-3 py-2 text-sm font-semibold text-[#27407b] hover:bg-[#f3f6ff]"
                        >
                          <RefreshCcw className="h-4 w-4" />
                          Refresh
                        </button>
                      </div>
                    </div>

                    <div className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                      <div className="mb-3">
                        <h3 className="text-lg font-black text-[#1b274b]">Set Kuota Dosen</h3>
                        <p className="text-sm text-[#5d6c91]">
                          Atur kuota bimbingan untuk semua dosen atau hanya dosen tertentu.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={masterDosenKuotaMode}
                          onChange={(event) => setMasterDosenKuotaMode(event.target.value)}
                          className="rounded-lg border border-[#d3dbef] px-3 py-2 text-sm outline-none focus:border-[#2f63e3]"
                        >
                          <option value="all">Set untuk semua dosen</option>
                          <option value="selected">Set untuk dosen terpilih</option>
                        </select>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={masterDosenKuotaValue}
                          onChange={(event) => setMasterDosenKuotaValue(event.target.value)}
                          placeholder="Kuota bimbingan"
                          className="w-[180px] rounded-lg border border-[#d3dbef] px-3 py-2 text-sm outline-none focus:border-[#2f63e3]"
                        />
                        <button
                          type="button"
                          disabled={savingMasterDosenKuota}
                          onClick={handleSaveMasterDosenKuota}
                          className="inline-flex items-center gap-2 rounded-lg bg-[#117246] px-4 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {savingMasterDosenKuota ? "Menyimpan..." : "Simpan Kuota"}
                        </button>
                      </div>
                    </div>

                    <div className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                        <h3 className="text-lg font-black text-[#1b274b]">Grid Kuota Dosen</h3>
                        <div className="flex items-center gap-2">
                          {masterDosenKuotaMode === "selected" ? (
                            <span className="rounded-full bg-[#eef3ff] px-3 py-1 text-xs font-bold text-[#2f63e3]">
                              Dipilih: {masterDosenSelectedDosenIds.length}
                            </span>
                          ) : null}
                          <div className="relative">
                            <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7282a8]" />
                            <input
                              type="text"
                              value={masterDosenKuotaQuery}
                              onChange={(event) => setMasterDosenKuotaQuery(event.target.value)}
                              placeholder="Cari dosen, email, jabatan..."
                              className="w-[320px] rounded-lg border border-[#d3dbef] py-2 pl-8 pr-3 text-sm outline-none focus:border-[#2f63e3]"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="relative mt-1 overflow-auto rounded-lg border border-[#e6ecf8] grid-unified-height">
                        <table className="w-full min-w-[1400px] text-left text-sm">
                          <thead>
                            <tr className="border-y border-[#e6ecf8] text-[#4d5e89]">
                              <th className="bg-[#f8fbff] px-3 py-2 font-semibold">
                                <input
                                  type="checkbox"
                                  checked={isMasterDosenKuotaPageAllSelected}
                                  onChange={handleToggleMasterDosenKuotaPage}
                                  disabled={masterDosenKuotaMode !== "selected"}
                                  className="h-4 w-4 accent-[#2f63e3]"
                                />
                              </th>
                              <th className="bg-[#f8fbff] px-3 py-2 font-semibold">No</th>
                              <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Kode/NIK</th>
                              <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Nama Dosen</th>
                              <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Jabatan Struktural</th>
                              <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Kuota</th>
                              <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Mahasiswa Bimbingan</th>
                              <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Sisa Kuota</th>
                              <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredMasterDosenKuotaRows.length > 0
                              ? pagedMasterDosenKuotaRows.map((row, index) => {
                                  const rowId = Number(row?.id);
                                  const isChecked = masterDosenSelectedDosenIds.some(
                                    (item) => Number(item) === rowId
                                  );
                                  return (
                                    <tr key={`master-dosen-kuota-${row.id}`} className="border-b border-[#eff3fb]">
                                      <td className="px-3 py-2">
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={() => handleToggleMasterDosenKuotaRow(rowId)}
                                          disabled={masterDosenKuotaMode !== "selected"}
                                          className="h-4 w-4 accent-[#2f63e3]"
                                        />
                                      </td>
                                      <td className="px-3 py-2">
                                        {(masterDosenKuotaPage - 1) * DOSEN_GRID_PAGE_SIZE + index + 1}
                                      </td>
                                      <td className="px-3 py-2">
                                        {row.kode_dosen || "-"}
                                        <div className="text-xs text-[#7080a6]">{row.nik || "-"}</div>
                                      </td>
                                      <td className="px-3 py-2">
                                        <p className="font-semibold text-[#1f3160]">{row.nama || "-"}</p>
                                        <p className="text-xs text-[#6a779a]">{row.email || "-"}</p>
                                      </td>
                                      <td className="px-3 py-2">{row.jabatan_struktural || "-"}</td>
                                      <td className="px-3 py-2">{row.kuota?.total ?? 0}</td>
                                      <td className="px-3 py-2">{row.kuota?.terpakai ?? 0}</td>
                                      <td className="px-3 py-2">{row.kuota?.sisa ?? 0}</td>
                                      <td className="px-3 py-2">
                                        {row.kuota?.is_penuh ? (
                                          <span className="rounded-full bg-[#ffe5e5] px-2 py-1 text-xs font-bold text-[#b13a3a]">
                                            Penuh
                                          </span>
                                        ) : (
                                          <span className="rounded-full bg-[#e8f8ef] px-2 py-1 text-xs font-bold text-[#127947]">
                                            Tersedia
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })
                              : null}
                          </tbody>
                        </table>

                        {filteredMasterDosenKuotaRows.length === 0 ? (
                          <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[41px] flex items-center justify-center px-4 text-center text-sm font-semibold text-[#7b88ab]">
                            Data kuota dosen tidak ditemukan.
                          </div>
                        ) : null}
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#e8edf8] pt-3">
                        <p className="text-sm text-[#4f5e86]">
                          Menampilkan {masterDosenKuotaRangeStart} - {masterDosenKuotaRangeEnd} dari{" "}
                          {filteredMasterDosenKuotaRows.length} data dosen.
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setMasterDosenKuotaPage((prev) => Math.max(1, prev - 1))}
                            disabled={masterDosenKuotaPage === 1}
                            className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] transition hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Sebelumnya
                          </button>
                          <span className="text-sm font-semibold text-[#314778]">
                            Halaman {masterDosenKuotaPage} / {totalMasterDosenKuotaPages}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setMasterDosenKuotaPage((prev) =>
                                Math.min(totalMasterDosenKuotaPages, prev + 1)
                              )
                            }
                            disabled={masterDosenKuotaPage >= totalMasterDosenKuotaPages}
                            className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] transition hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Berikutnya
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}

            {!loading && isSekretaris && activeTab === "master-topik" ? (
              <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-lg font-black text-[#1b274b]">Grid Master Topik</h3>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7282a8]" />
                      <input
                        type="text"
                        value={masterTopikQuery}
                        onChange={(event) => setMasterTopikQuery(event.target.value)}
                        placeholder="Cari kode, judul, cluster, dosen, status..."
                        className="w-[320px] rounded-lg border border-[#d3dbef] py-2 pl-8 pr-3 text-sm outline-none focus:border-[#2f63e3]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={loadAllData}
                      className="inline-flex items-center gap-2 rounded-lg border border-[#d3dbef] px-3 py-2 text-sm font-semibold text-[#27407b] hover:bg-[#f3f6ff]"
                    >
                      <RefreshCcw className="h-4 w-4" />
                      Refresh
                    </button>
                  </div>
                </div>

                <div className="relative mt-1 flex-1 overflow-auto rounded-lg border border-[#e6ecf8] grid-unified-height">
                  <table className="w-full min-w-[1400px] text-left text-sm">
                    <thead>
                      <tr className="border-y border-[#e6ecf8] text-[#4d5e89]">
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">No</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Kode</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Judul</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Cluster</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Dosen</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Status</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMasterTopikRows.length > 0
                        ? pagedMasterTopikRows.map((row, index) => (
                            <tr key={`master-topik-${row.id}`} className="border-b border-[#eff3fb]">
                              <td className="px-3 py-2">
                                {(masterTopikPage - 1) * MASTER_TOPIK_PAGE_SIZE + index + 1}
                              </td>
                              <td className="px-3 py-2 font-semibold text-[#254080]">{row.kode || "-"}</td>
                              <td className="px-3 py-2">{row.judul || "-"}</td>
                              <td className="px-3 py-2">{row.cluster || "-"}</td>
                              <td className="px-3 py-2">
                                {row.dosen?.nama || row.dosen_nama || row.nama_dosen || "-"}
                              </td>
                              <td className="px-3 py-2">{formatLabel(row.status)}</td>
                              <td className="px-3 py-2">{formatDateTime(row.updatedAt)}</td>
                            </tr>
                          ))
                        : null}
                    </tbody>
                  </table>
                  {filteredMasterTopikRows.length === 0 ? (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[41px] flex items-center justify-center px-4 text-center text-sm font-semibold text-[#7b88ab]">
                      Data topik tidak ditemukan.
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#e8edf8] pt-3">
                  <p className="text-sm text-[#4f5e86]">
                    Menampilkan{" "}
                    {filteredMasterTopikRows.length === 0
                      ? 0
                      : (masterTopikPage - 1) * MASTER_TOPIK_PAGE_SIZE + 1}{" "}
                    - {Math.min(masterTopikPage * MASTER_TOPIK_PAGE_SIZE, filteredMasterTopikRows.length)} dari{" "}
                    {filteredMasterTopikRows.length} data topik.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setMasterTopikPage((prev) => Math.max(1, prev - 1))}
                      disabled={masterTopikPage === 1}
                      className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] transition hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Sebelumnya
                    </button>
                    <span className="text-sm font-semibold text-[#314778]">
                      Halaman {masterTopikPage} / {totalMasterTopikPages}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setMasterTopikPage((prev) => Math.min(totalMasterTopikPages, prev + 1))
                      }
                      disabled={masterTopikPage >= totalMasterTopikPages}
                      className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] transition hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Berikutnya
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {!loading && activeTab === "topik" ? (
              <div
                className={
                  topikMode === "list"
                    ? "flex min-h-0 flex-1 flex-col gap-4"
                    : "space-y-4 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                }
              >
                <div className="rounded-xl border border-[#dce4f7] bg-white p-3 shadow-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setTopikMode("list")}
                      disabled={topikMode === "list"}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#d3dbef] text-[#27407b] transition hover:bg-[#f3f6ff] disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="Kembali ke data topik"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={loadAllData}
                      className="inline-flex items-center gap-2 rounded-lg border border-[#d3dbef] px-3 py-2 text-sm font-semibold text-[#27407b] hover:bg-[#f3f6ff]"
                    >
                      <RefreshCcw className="h-4 w-4" />
                      Refresh
                    </button>
                    <button
                      type="button"
                      onClick={() => setTopikMode("api")}
                      className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                        topikMode === "api"
                          ? "bg-[#2f63e3] text-white"
                          : "border border-[#d3dbef] text-[#27407b] hover:bg-[#f3f6ff]"
                      }`}
                    >
                      <ClipboardList className="h-4 w-4" />
                      Add
                    </button>
                  </div>
                </div>

                {topikMode === "list" ? (
                  <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <h3 className="text-lg font-black text-[#1b274b]">Grid Topik Dosen</h3>
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7282a8]" />
                          <input
                            type="text"
                            value={topikQuery}
                            onChange={(event) => setTopikQuery(event.target.value)}
                            placeholder="Cari kode, judul, cluster, status..."
                            className="w-[320px] rounded-lg border border-[#d3dbef] py-2 pl-8 pr-3 text-sm outline-none focus:border-[#2f63e3]"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={loadAllData}
                          className="inline-flex items-center gap-2 rounded-lg border border-[#d3dbef] px-3 py-2 text-sm font-semibold text-[#27407b] hover:bg-[#f3f6ff]"
                        >
                          <RefreshCcw className="h-4 w-4" />
                          Refresh
                        </button>
                      </div>
                    </div>

                    <div className="relative mt-1 flex-1 overflow-auto rounded-lg border border-[#e6ecf8] grid-unified-height">
                      <table className="w-full min-w-[1200px] text-left text-sm">
                        <thead>
                          <tr className="border-y border-[#e6ecf8] text-[#4d5e89]">
                            <th className="bg-[#f8fbff] px-3 py-2 font-semibold">No</th>
                            <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Kode</th>
                            <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Judul</th>
                            <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Cluster</th>
                            <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Status</th>
                            <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Updated</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredTopikRows.length > 0
                            ? pagedTopikRows.map((row, index) => (
                                <tr key={`topik-${row.id}`} className="border-b border-[#eff3fb]">
                                  <td className="px-3 py-2">{(topikPage - 1) * TOPIK_PAGE_SIZE + index + 1}</td>
                                  <td className="px-3 py-2 font-semibold text-[#254080]">{row.kode || "-"}</td>
                                  <td className="px-3 py-2">{row.judul || "-"}</td>
                                  <td className="px-3 py-2">{row.cluster || "-"}</td>
                                  <td className="px-3 py-2">{formatLabel(row.status)}</td>
                                  <td className="px-3 py-2">{formatDateTime(row.updatedAt)}</td>
                                </tr>
                              ))
                            : null}
                        </tbody>
                      </table>
                      {filteredTopikRows.length === 0 ? (
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[41px] flex items-center justify-center px-4 text-center text-sm font-semibold text-[#7b88ab]">
                          Data topik tidak ditemukan.
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#e8edf8] pt-3">
                      <p className="text-sm text-[#4f5e86]">
                        Menampilkan {filteredTopikRows.length === 0 ? 0 : (topikPage - 1) * TOPIK_PAGE_SIZE + 1} -{" "}
                        {Math.min(topikPage * TOPIK_PAGE_SIZE, filteredTopikRows.length)} dari {filteredTopikRows.length} data topik.
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setTopikPage((prev) => Math.max(1, prev - 1))}
                          disabled={topikPage === 1}
                          className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] transition hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Sebelumnya
                        </button>
                        <span className="text-sm font-semibold text-[#314778]">
                          Halaman {topikPage} / {totalTopikPages}
                        </span>
                        <button
                          type="button"
                          onClick={() => setTopikPage((prev) => Math.min(totalTopikPages, prev + 1))}
                          disabled={topikPage >= totalTopikPages}
                          className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] transition hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Berikutnya
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

                {topikMode === "api" ? (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-lg font-black text-[#1b274b]">Upload Topik via Excel</h3>
                        <a
                          href={`${apiBaseUrl}/api/admin/upload/template`}
                          className="inline-flex items-center gap-2 rounded-lg border border-[#b8e0cb] px-3 py-2 text-sm font-semibold text-[#0f7b50] hover:bg-[#effaf4]"
                        >
                          <Download className="h-4 w-4" />
                          Download Template
                        </a>
                      </div>
                      <p className="text-sm text-[#5d6c91]">
                        Gunakan template topik. Sistem otomatis memasangkan topik ke akun dosen yang sedang login.
                      </p>

                      <form onSubmit={handleTopikUploadSubmit} className="mt-4 space-y-3">
                        <input
                          type="file"
                          accept=".xls,.xlsx,.ods"
                          onChange={(event) => setTopikUploadFile(event.target.files?.[0] || null)}
                          className="w-full rounded-lg border border-[#d3dbef] px-3 py-2 text-sm"
                        />
                        <button
                          type="submit"
                          disabled={uploadingTopik}
                          className="inline-flex items-center gap-2 rounded-lg bg-[#2f63e3] px-4 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Upload className="h-4 w-4" />
                          {uploadingTopik ? "Mengupload..." : "Upload Template"}
                        </button>
                      </form>
                      <div className="mt-4 rounded-lg border border-[#dce6f7] bg-[#f8fbff] p-4">
                        <p className="text-sm font-bold text-[#1e2f57]">
                          {uploadTopikResult?.message || "Preview topik akan tampil di sini setelah upload template."}
                        </p>
                        <p className="mt-1 text-sm text-[#42527c]">
                          Valid: {uploadTopikResult?.data?.valid ?? 0} | Tidak valid: {uploadTopikResult?.data?.invalid ?? 0}
                        </p>
                        <p className="mt-1 text-xs text-[#5d6c91]">
                          Preview menampilkan maksimal {TOPIK_UPLOAD_PREVIEW_MAX_ROWS} data (5 data per halaman).
                        </p>

                        {Array.isArray(uploadTopikResult?.detail?.missing_columns) &&
                        uploadTopikResult.detail.missing_columns.length > 0 ? (
                          <div className="mt-3 rounded-md border border-[#f0d7d7] bg-[#fff7f7] p-3 text-sm text-[#963838]">
                            <p className="font-semibold">Template tidak valid.</p>
                            <p className="mt-1">
                              Kolom yang belum sesuai: {uploadTopikResult.detail.missing_columns.join(", ")}.
                            </p>
                          </div>
                        ) : null}

                        <div className="mt-4 overflow-hidden rounded-lg border border-[#d6e0f5] bg-white">
                          <div className="overflow-x-auto">
                            <table className="w-full min-w-[1020px] table-auto">
                              <thead className="bg-[#f4f7ff] text-left text-sm font-bold text-[#2f4473]">
                                <tr>
                                  <th className="px-3 py-2">No</th>
                                  <th className="px-3 py-2">Baris Excel</th>
                                  <th className="px-3 py-2">Kode Topik</th>
                                  <th className="px-3 py-2">Cluster</th>
                                  <th className="px-3 py-2">Judul Topik</th>
                                  <th className="px-3 py-2">Status</th>
                                  <th className="px-3 py-2">Pesan Error</th>
                                </tr>
                              </thead>
                              <tbody>
                                {topikUploadPreviewRowsPaged.length > 0 ? (
                                  topikUploadPreviewRowsPaged.map((row) => (
                                    <tr
                                      key={row.key}
                                      className={`border-t border-[#ecf1fb] text-sm text-[#23345d] ${
                                        row.status === "error" ? "bg-[#fff8f8]" : "bg-white"
                                      }`}
                                    >
                                      <td className="px-3 py-2">{row.nomor}</td>
                                      <td className="px-3 py-2">{row.baris}</td>
                                      <td className="px-3 py-2">{row.kode}</td>
                                      <td className="px-3 py-2">{row.cluster}</td>
                                      <td className="px-3 py-2">{row.judul}</td>
                                      <td className="px-3 py-2">
                                        <span
                                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${
                                            row.status === "error"
                                              ? "bg-[#ffe3e3] text-[#a93d3d]"
                                              : "bg-[#def4e8] text-[#117246]"
                                          }`}
                                        >
                                          {row.status === "error" ? "Tidak Valid" : "Valid"}
                                        </span>
                                      </td>
                                      <td className={`px-3 py-2 ${row.status === "error" ? "text-[#a93d3d]" : ""}`}>
                                        {row.pesan_error}
                                      </td>
                                    </tr>
                                  ))
                                ) : (
                                  <tr className="border-t border-[#ecf1fb] text-sm text-[#5d6c91]">
                                    <td className="px-3 py-4 text-center" colSpan={7}>
                                      Belum ada data preview.
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                          <p className="text-xs text-[#5d6c91]">
                            Menampilkan {topikUploadPreviewRowsLimited.length === 0 ? 0 : (topikUploadPreviewPage - 1) * TOPIK_UPLOAD_PREVIEW_PAGE_SIZE + 1}
                            {" - "}
                            {Math.min(
                              topikUploadPreviewPage * TOPIK_UPLOAD_PREVIEW_PAGE_SIZE,
                              topikUploadPreviewRowsLimited.length
                            )}{" "}
                            dari {topikUploadPreviewRowsLimited.length} data preview.
                          </p>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setTopikUploadPreviewPage((prev) => Math.max(1, prev - 1))}
                              disabled={topikUploadPreviewPage <= 1}
                              className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-xs font-semibold text-[#314778] transition hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Sebelumnya
                            </button>
                            <span className="text-xs font-semibold text-[#314778]">
                              Halaman {topikUploadPreviewPage} / {topikUploadPreviewTotalPages}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setTopikUploadPreviewPage((prev) =>
                                  Math.min(topikUploadPreviewTotalPages, prev + 1)
                                )
                              }
                              disabled={topikUploadPreviewPage >= topikUploadPreviewTotalPages}
                              className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-xs font-semibold text-[#314778] transition hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Berikutnya
                            </button>
                          </div>
                        </div>

                        <div className="mt-4 flex justify-end">
                          <button
                            type="button"
                            onClick={handleSaveUploadedTopik}
                            disabled={savingUploadedTopik || topikUploadValidRows.length === 0}
                            className="inline-flex items-center gap-2 rounded-lg bg-[#117246] px-4 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <FileSpreadsheet className="h-4 w-4" />
                            {savingUploadedTopik ? "Menyimpan..." : "Simpan ke Database"}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                      <h3 className="mb-3 text-lg font-black text-[#1b274b]">Tambah Topik via Form</h3>
                      <form onSubmit={handleTopikApiSubmit} className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-sm font-semibold text-[#344b7f]">Kode Topik</label>
                          <input
                            type="text"
                            name="kode"
                            value={topikForm.kode}
                            onChange={handleTopikFormChange}
                            placeholder="Contoh: SIRKEL99"
                            className="w-full rounded-lg border border-[#d3dbef] px-3 py-2 text-sm outline-none focus:border-[#2f63e3]"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-semibold text-[#344b7f]">Cluster</label>
                          <select
                            name="cluster"
                            value={topikForm.cluster}
                            onChange={handleTopikFormChange}
                            className="w-full rounded-lg border border-[#d3dbef] px-3 py-2 text-sm outline-none focus:border-[#2f63e3]"
                          >
                            {allowedTopikClusters.map((cluster) => (
                              <option key={cluster} value={cluster}>
                                {cluster}
                              </option>
                            ))}
                          </select>
                          <p className="mt-1 text-xs text-[#6b789e]">
                            Opsi cluster mengikuti assignment cluster dosen login.
                          </p>
                        </div>
                        <div className="lg:col-span-2">
                          <label className="mb-1 block text-sm font-semibold text-[#344b7f]">Judul Topik</label>
                          <input
                            type="text"
                            name="judul"
                            value={topikForm.judul}
                            onChange={handleTopikFormChange}
                            placeholder="Masukkan judul topik"
                            className="w-full rounded-lg border border-[#d3dbef] px-3 py-2 text-sm outline-none focus:border-[#2f63e3]"
                          />
                        </div>
                        <div className="lg:col-span-2">
                          <label className="mb-1 block text-sm font-semibold text-[#344b7f]">Deskripsi (opsional)</label>
                          <textarea
                            name="deskripsi"
                            value={topikForm.deskripsi}
                            onChange={handleTopikFormChange}
                            rows={4}
                            placeholder="Deskripsi singkat topik"
                            className="w-full rounded-lg border border-[#d3dbef] px-3 py-2 text-sm outline-none focus:border-[#2f63e3]"
                          />
                        </div>
                        <div className="lg:col-span-2">
                          <button
                            type="submit"
                            disabled={savingTopik}
                            className="inline-flex items-center gap-2 rounded-lg bg-[#2f63e3] px-4 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <FileSpreadsheet className="h-4 w-4" />
                            {savingTopik ? "Menyimpan..." : "Simpan Topik"}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {!loading && isSekretaris && activeTab === "penjaluran" ? (
              <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-lg font-black text-[#1b274b]">Grid Manajemen Penjaluran</h3>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7282a8]" />
                      <input
                        type="text"
                        value={pendaftaranSearch}
                        onChange={(event) => setPendaftaranSearch(event.target.value)}
                        placeholder="Cari NIM, nama, email, jalur..."
                        className="w-[320px] rounded-lg border border-[#d3dbef] py-2 pl-8 pr-3 text-sm outline-none focus:border-[#2f63e3]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleExportPendaftaran}
                      disabled={exportingPendaftaran}
                      className="inline-flex items-center gap-2 rounded-lg bg-[#0f7b50] px-3 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Download className="h-4 w-4" />
                      {exportingPendaftaran ? "Exporting..." : "Export Excel"}
                    </button>
                  </div>
                </div>

                <div className="relative mt-1 flex-1 overflow-auto rounded-lg border border-[#e6ecf8] grid-unified-height">
                  <table className="w-full min-w-[1400px] text-left text-sm">
                    <thead>
                      <tr className="border-y border-[#e6ecf8] text-[#4d5e89]">
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Tanggal</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Periode</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">NIM</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Nama</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Jalur</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Status</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">DPA</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPendaftaranRows.length > 0
                        ? pagedPendaftaranRows.map((row) => (
                            <tr key={`pendaftaran-${row.id}`} className="border-b border-[#eff3fb]">
                              <td className="px-3 py-2">{formatDateTime(row.createdAt)}</td>
                              <td className="px-3 py-2">{row.periode?.label_periode || "-"}</td>
                              <td className="px-3 py-2 font-semibold text-[#254080]">{row.mahasiswa?.nim || "-"}</td>
                              <td className="px-3 py-2">{row.mahasiswa?.nama || "-"}</td>
                              <td className="px-3 py-2">{formatLabel(row.jalur)}</td>
                              <td className="px-3 py-2">{formatLabel(row.status)}</td>
                              <td className="px-3 py-2">{row.dosen_pembimbing_akademik?.nama || "-"}</td>
                              <td className="px-3 py-2">
                                {row.status === "submitted" ? (
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      disabled={rowActionLoadingId === row.id}
                                      onClick={() => handlePendaftaranApprove(row.id)}
                                      className="rounded-md bg-[#137748] px-3 py-1 text-xs font-bold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      Approve
                                    </button>
                                    <button
                                      type="button"
                                      disabled={rowActionLoadingId === row.id}
                                      onClick={() => handlePendaftaranReject(row.id)}
                                      className="rounded-md bg-[#b73a3a] px-3 py-1 text-xs font-bold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      Tolak
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-xs text-[#68779f]">Selesai diproses</span>
                                )}
                              </td>
                            </tr>
                          ))
                        : null}
                    </tbody>
                  </table>
                  {filteredPendaftaranRows.length === 0 ? (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[41px] flex items-center justify-center px-4 text-center text-sm font-semibold text-[#7b88ab]">
                      Belum ada data penjaluran.
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#e8edf8] pt-3">
                  <p className="text-sm text-[#4f5e86]">
                    Menampilkan {pendaftaranRangeStart} - {pendaftaranRangeEnd} dari{" "}
                    {filteredPendaftaranRows.length} data penjaluran.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPendaftaranPage((prev) => Math.max(1, prev - 1))}
                      disabled={pendaftaranPage === 1}
                      className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] transition hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Sebelumnya
                    </button>
                    <span className="text-sm font-semibold text-[#314778]">
                      Halaman {pendaftaranPage} / {totalPendaftaranPages}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setPendaftaranPage((prev) => Math.min(totalPendaftaranPages, prev + 1))
                      }
                      disabled={pendaftaranPage >= totalPendaftaranPages}
                      className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] transition hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Berikutnya
                    </button>
                  </div>
                </div>
              </div>
            ) : null}


            {!loading && isSekretaris && activeTab === "ketua-klaster" ? (
              <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                {ketuaKlasterError ? (
                  <div className="mb-3 rounded-lg border border-[#f6d7d7] bg-[#fff2f2] px-3 py-2 text-sm font-semibold text-[#a03f3f]">
                    {ketuaKlasterError}
                  </div>
                ) : null}

                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black text-[#1b274b]">Set Ketua Cluster Per Periode</h3>
                    <p className="text-sm text-[#5d6c91]">
                      Pilih periode, lalu tetapkan ketua untuk setiap klaster penelitian.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={ketuaKlasterPeriodeId}
                      onChange={handleChangeKetuaKlasterPeriode}
                      className="min-w-[260px] rounded-lg border border-[#d3dbef] px-3 py-2 text-sm outline-none focus:border-[#2f63e3]"
                    >
                      {(ketuaKlasterOverview.periodes || []).map((item) => (
                        <option key={`ketua-periode-opt-${item.id}`} value={item.id}>
                          {item.label_periode || `${formatLabel(item.semester)} ${item.tahun_akademik}`}
                          {item.status ? ` (${formatLabel(item.status)})` : item.is_active ? " (Aktif)" : ""}
                        </option>
                      ))}
                    </select>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7282a8]" />
                      <input
                        type="text"
                        value={ketuaKlasterQuery}
                        onChange={(event) => setKetuaKlasterQuery(event.target.value)}
                        placeholder="Cari klaster / ketua..."
                        className="w-[260px] rounded-lg border border-[#d3dbef] py-2 pl-8 pr-3 text-sm outline-none focus:border-[#2f63e3]"
                      />
                    </div>
                  </div>
                </div>

                <div className="relative mt-1 flex-1 overflow-auto rounded-lg border border-[#e6ecf8] grid-unified-height">
                  <table className="w-full min-w-[1300px] text-left text-sm">
                    <thead>
                      <tr className="border-y border-[#e6ecf8] text-[#4d5e89]">
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Klaster</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Ketua Saat Ini</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Ditetapkan Oleh</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Kandidat Dosen</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredKetuaKlasterRows.length > 0
                        ? pagedKetuaKlasterRows.map((row) => (
                            <tr key={`ketua-klaster-row-${row.id}`} className="border-b border-[#eff3fb]">
                              <td className="px-3 py-2">
                                <p className="font-semibold text-[#1f3160]">{row.kode}</p>
                                <p className="text-xs text-[#6a779a]">{row.nama}</p>
                              </td>
                              <td className="px-3 py-2">
                                {row.ketua?.ketua_dosen ? (
                                  <>
                                    <p className="font-semibold text-[#1f3160]">{row.ketua.ketua_dosen.nama}</p>
                                    <p className="text-xs text-[#6a779a]">
                                      {row.ketua.ketua_dosen.kode_dosen} • {row.ketua.ketua_dosen.nik || "-"}
                                    </p>
                                  </>
                                ) : (
                                  <span className="rounded-full bg-[#fff3e0] px-2 py-1 text-xs font-bold text-[#9b6200]">
                                    Belum diset
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-sm text-[#44537b]">
                                {row.ketua?.assigned_by?.nama || "-"}
                              </td>
                              <td className="px-3 py-2">
                                <select
                                  value={ketuaKlasterDraft[row.id] || ""}
                                  onChange={(event) =>
                                    handleKetuaKlasterDraftChange(row.id, event.target.value)
                                  }
                                  className="w-full min-w-[320px] rounded-lg border border-[#d3dbef] px-3 py-2 text-sm outline-none focus:border-[#2f63e3]"
                                >
                                  <option value="">Pilih dosen ketua klaster</option>
                                  {(row.kandidat_dosen || []).map((item) => (
                                    <option key={`ketua-klaster-candidate-${row.id}-${item.id}`} value={item.id}>
                                      {item.nama} ({item.kode_dosen})
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-3 py-2">
                                <button
                                  type="button"
                                  disabled={savingKetuaKlasterId === row.id || !(row.kandidat_dosen || []).length}
                                  onClick={() => handleSaveKetuaKlaster(row)}
                                  className="inline-flex items-center gap-1 rounded-md bg-[#2f63e3] px-3 py-1.5 text-xs font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  <ClipboardList className="h-3.5 w-3.5" />
                                  {savingKetuaKlasterId === row.id ? "Menyimpan..." : "Simpan"}
                                </button>
                              </td>
                            </tr>
                          ))
                        : null}
                    </tbody>
                  </table>

                  {filteredKetuaKlasterRows.length === 0 ? (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[41px] flex items-center justify-center px-4 text-center text-sm font-semibold text-[#7b88ab]">
                      Data klaster tidak ditemukan.
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#e8edf8] pt-3">
                  <p className="text-sm text-[#4f5e86]">
                    Menampilkan {ketuaKlasterRangeStart} - {ketuaKlasterRangeEnd} dari{" "}
                    {filteredKetuaKlasterRows.length} data klaster.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setKetuaKlasterPage((prev) => Math.max(1, prev - 1))}
                      disabled={ketuaKlasterPage === 1}
                      className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] transition hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Sebelumnya
                    </button>
                    <span className="text-sm font-semibold text-[#314778]">
                      Halaman {ketuaKlasterPage} / {totalKetuaKlasterPages}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setKetuaKlasterPage((prev) => Math.min(totalKetuaKlasterPages, prev + 1))
                      }
                      disabled={ketuaKlasterPage >= totalKetuaKlasterPages}
                      className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] transition hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Berikutnya
                    </button>
                  </div>
                </div>
              </div>
            ) : null}


            {!loading && isSekretaris && activeTab === "periode" ? (
              <div
                className={
                  periodeMode === "list"
                    ? "flex min-h-0 flex-1 flex-col gap-4"
                    : "space-y-4 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                }
              >
                <div className="rounded-xl border border-[#dce4f7] bg-white p-3 shadow-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPeriodeMode("list");
                        setEditingPeriode(null);
                        setPeriodeFormErrors({});
                        setPeriodeMasterErrors({});
                        setPeriodeReadonlyRoles({ loading: false, rows: [], error: "" });
                      }}
                      disabled={periodeMode === "list"}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#d3dbef] text-[#27407b] transition hover:bg-[#f3f6ff] disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="Kembali ke data periode"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={loadAllData}
                      className="inline-flex items-center gap-2 rounded-lg border border-[#d3dbef] px-3 py-2 text-sm font-semibold text-[#27407b] hover:bg-[#f3f6ff]"
                    >
                      <RefreshCcw className="h-4 w-4" />
                      Refresh
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPeriodeMode("open");
                        setEditingPeriode(null);
                        setPeriodeReadonlyRoles({ loading: false, rows: [], error: "" });
                        setPeriodeFormErrors({});
                        setPeriodeMasterErrors({});
                      }}
                      className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                        periodeMode === "open"
                          ? "bg-[#2f63e3] text-white"
                          : "border border-[#d3dbef] text-[#27407b] hover:bg-[#f3f6ff]"
                      }`}
                    >
                      <CalendarRange className="h-4 w-4" />
                      Buka Periode
                    </button>
                  </div>
                </div>

                {periodeMode === "list" ? (
                  <>
                    <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                      <h3 className="mb-3 text-lg font-black text-[#1b274b]">Riwayat Periode</h3>
                      <div className="relative mt-1 flex-1 overflow-auto rounded-lg border border-[#e6ecf8] grid-unified-height">
                        <table className="w-full min-w-[980px] text-left text-sm">
                          <thead>
                            <tr className="border-y border-[#e6ecf8] text-[#4d5e89]">
                              <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Label Periode</th>
                              <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Tahun Akademik</th>
                              <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Semester</th>
                              <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Tanggal Mulai</th>
                              <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Tanggal Selesai</th>
                              <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Status</th>
                              <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Aksi</th>
                            </tr>
                          </thead>
                          <tbody>
                            {periodeRows.length > 0
                              ? pagedPeriodeRows.map((row) => (
                                  <tr key={`periode-${row.id}`} className="border-b border-[#eff3fb]">
                                    <td className="px-3 py-2">{row.label_periode || "-"}</td>
                                    <td className="px-3 py-2">{row.tahun_akademik || "-"}</td>
                                    <td className="px-3 py-2">{formatLabel(row.semester)}</td>
                                    <td className="px-3 py-2">{formatDateTime(row.tanggal_mulai)}</td>
                                    <td className="px-3 py-2">{formatDateTime(row.tanggal_selesai)}</td>
                                    <td className="px-3 py-2">
                                      {row.is_active ? (
                                        <span className="rounded-full bg-[#e8f8ef] px-2 py-1 text-xs font-bold text-[#127947]">Aktif</span>
                                      ) : (
                                        <span className="rounded-full bg-[#eef2fb] px-2 py-1 text-xs font-bold text-[#58658d]">Nonaktif</span>
                                      )}
                                    </td>
                                    <td className="px-3 py-2">
                                      <button
                                        type="button"
                                        disabled={savingPeriode}
                                        onClick={() => {
                                          handleOpenPeriodeEditor(row).catch(() => {});
                                        }}
                                        className="inline-flex items-center gap-1 rounded-md bg-[#2f63e3] px-3 py-1.5 text-xs font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        {row.is_active || row.status === "draft" ? (
                                          <>
                                            <CalendarRange className="h-3.5 w-3.5" />
                                            Edit
                                          </>
                                        ) : (
                                          <>
                                            <Eye className="h-3.5 w-3.5" />
                                            Detail
                                          </>
                                        )}
                                      </button>
                                    </td>
                                  </tr>
                                ))
                              : null}
                          </tbody>
                        </table>
                        {periodeRows.length === 0 ? (
                          <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[41px] flex items-center justify-center px-4 text-center text-sm font-semibold text-[#7b88ab]">
                            Belum ada data periode.
                          </div>
                        ) : null}
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#e8edf8] pt-3">
                        <p className="text-sm text-[#4f5e86]">
                          Menampilkan {periodeRangeStart} - {periodeRangeEnd} dari {periodeRows.length} data
                          periode.
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setPeriodePage((prev) => Math.max(1, prev - 1))}
                            disabled={periodePage === 1}
                            className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] transition hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Sebelumnya
                          </button>
                          <span className="text-sm font-semibold text-[#314778]">
                            Halaman {periodePage} / {totalPeriodePages}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setPeriodePage((prev) => Math.min(totalPeriodePages, prev + 1))
                            }
                            disabled={periodePage >= totalPeriodePages}
                            className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] transition hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Berikutnya
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                ) : null}

                {periodeMode === "open" ? (
                  <div className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                    <h3 className="text-lg font-black text-[#1b274b]">Buka Periode Baru</h3>
                    <p className="mt-1 text-sm text-[#5d6c91]">
                      Gunakan master data penanggung jawab, lalu isi detail periode yang akan dibuka.
                    </p>

                    <div className="mt-4 space-y-4">
                      <section className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-black text-[#1b274b]">
                              1. Preview Master Penanggung Jawab (Read Only)
                            </p>
                            <p className="mt-1 text-sm text-[#5d6c91]">
                              Pengaturan ketua cluster dan pembimbing jalur dikelola dari menu Master Dosen.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveTab("master-dosen");
                              setMasterDosenTab("penanggung-jawab");
                            }}
                            className="inline-flex items-center gap-2 rounded-lg border border-[#d3dbef] px-3 py-2 text-sm font-semibold text-[#27407b] hover:bg-[#f3f6ff]"
                          >
                            Buka Master Dosen
                          </button>
                        </div>

                        {masterPeriodeMissingLabels.length > 0 ? (
                          <div className="mt-3 rounded-lg border border-[#f5d0d0] bg-[#fff3f3] px-3 py-2 text-sm font-semibold text-[#a33f3f]">
                            Master data belum lengkap. Lengkapi dulu: {masterPeriodeMissingLabels.join(", ")}.
                          </div>
                        ) : null}

                        <div className="mt-3 rounded-lg border border-[#dbe4f6] bg-[#f8fbff] p-3">
                          <p className="text-xs font-black uppercase tracking-wide text-[#4e5d87]">Preview Penanggung Jawab</p>
                          <div className="mt-2 grid grid-cols-1 gap-2 lg:grid-cols-2">
                            {PERIODE_MASTER_KETUA_FIELDS.map((item) => (
                              <p key={`periode-master-preview-ketua-${item.key}`} className="text-sm text-[#2c3d68]">
                                <span className="font-semibold">{item.label}:</span>{" "}
                                {periodeDosenMap.get(Number(periodeMasterForm[item.key]))?.nama || "-"}
                              </p>
                            ))}
                            {PERIODE_MASTER_JALUR_FIELDS.map((item) => (
                              <p key={`periode-master-preview-jalur-${item.key}`} className="text-sm text-[#2c3d68]">
                                <span className="font-semibold">{item.label}:</span>{" "}
                                {periodeDosenMap.get(Number(periodeMasterForm[item.key]))?.nama || "-"}
                              </p>
                            ))}
                          </div>
                        </div>
                      </section>

                      <section className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                        <p className="text-sm font-black text-[#1b274b]">
                          2. Detail Periode Penjaluran
                        </p>
                        <p className="mt-1 text-sm text-[#5d6c91]">
                          Isi periode akademik yang akan dibuka.
                        </p>

                        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-sm font-semibold text-[#344b7f]">Tahun Akademik</label>
                            <input
                              type="text"
                              name="tahun_akademik"
                              value={periodeForm.tahun_akademik}
                              onChange={handlePeriodeInputChange}
                              placeholder="Contoh: 2026/2027"
                              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[#2f63e3] ${
                                periodeFormErrors.tahun_akademik ? "border-[#dc4b4b] bg-[#fff7f7]" : "border-[#d3dbef]"
                              }`}
                            />
                            {periodeFormErrors.tahun_akademik ? (
                              <p className="mt-1 text-xs font-semibold text-[#c23737]">{periodeFormErrors.tahun_akademik}</p>
                            ) : null}
                          </div>
                          <div>
                            <label className="mb-1 block text-sm font-semibold text-[#344b7f]">Semester</label>
                            <select
                              name="semester"
                              value={periodeForm.semester}
                              onChange={handlePeriodeInputChange}
                              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[#2f63e3] ${
                                periodeFormErrors.semester ? "border-[#dc4b4b] bg-[#fff7f7]" : "border-[#d3dbef]"
                              }`}
                            >
                              <option value="ganjil">Ganjil</option>
                              <option value="genap">Genap</option>
                            </select>
                            {periodeFormErrors.semester ? (
                              <p className="mt-1 text-xs font-semibold text-[#c23737]">{periodeFormErrors.semester}</p>
                            ) : null}
                          </div>
                          <div>
                            <label className="mb-1 block text-sm font-semibold text-[#344b7f]">Tanggal Mulai</label>
                            <input
                              type="date"
                              name="tanggal_mulai"
                              value={periodeForm.tanggal_mulai}
                              onChange={handlePeriodeInputChange}
                              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[#2f63e3] ${
                                periodeFormErrors.tanggal_mulai ? "border-[#dc4b4b] bg-[#fff7f7]" : "border-[#d3dbef]"
                              }`}
                            />
                            {periodeFormErrors.tanggal_mulai ? (
                              <p className="mt-1 text-xs font-semibold text-[#c23737]">{periodeFormErrors.tanggal_mulai}</p>
                            ) : null}
                          </div>
                          <div>
                            <label className="mb-1 block text-sm font-semibold text-[#344b7f]">Tanggal Selesai</label>
                            <input
                              type="date"
                              name="tanggal_selesai"
                              value={periodeForm.tanggal_selesai}
                              onChange={handlePeriodeInputChange}
                              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[#2f63e3] ${
                                periodeFormErrors.tanggal_selesai ? "border-[#dc4b4b] bg-[#fff7f7]" : "border-[#d3dbef]"
                              }`}
                            />
                            {periodeFormErrors.tanggal_selesai ? (
                              <p className="mt-1 text-xs font-semibold text-[#c23737]">{periodeFormErrors.tanggal_selesai}</p>
                            ) : null}
                          </div>
                        </div>
                      </section>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={savingPeriode}
                        onClick={handleOpenPeriode}
                        className="rounded-lg bg-[#117246] px-4 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Buka Periode
                      </button>
                    </div>
                  </div>
                ) : null}

                {false ? (
                  <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-black text-[#1b274b]">Set Ketua Cluster Per Periode</h3>
                        <p className="text-sm text-[#5d6c91]">
                          Pilih periode draft, lalu tetapkan ketua untuk setiap klaster.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={ketuaKlasterPeriodeId}
                          onChange={handleChangeKetuaKlasterPeriode}
                          className="min-w-[260px] rounded-lg border border-[#d3dbef] px-3 py-2 text-sm outline-none focus:border-[#2f63e3]"
                        >
                          {(ketuaKlasterOverview.periodes || []).map((item) => (
                            <option key={`ketua-periode-opt-${item.id}`} value={item.id}>
                              {item.label_periode || `${formatLabel(item.semester)} ${item.tahun_akademik}`}
                              {item.status ? ` (${formatLabel(item.status)})` : item.is_active ? " (Aktif)" : ""}
                            </option>
                          ))}
                        </select>
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7282a8]" />
                          <input
                            type="text"
                            value={ketuaKlasterQuery}
                            onChange={(event) => setKetuaKlasterQuery(event.target.value)}
                            placeholder="Cari klaster / ketua..."
                            className="w-[260px] rounded-lg border border-[#d3dbef] py-2 pl-8 pr-3 text-sm outline-none focus:border-[#2f63e3]"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="relative mt-1 flex-1 overflow-auto rounded-lg border border-[#e6ecf8] grid-unified-height">
                      <table className="w-full min-w-[1300px] text-left text-sm">
                        <thead>
                          <tr className="border-y border-[#e6ecf8] text-[#4d5e89]">
                            <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Klaster</th>
                            <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Ketua Saat Ini</th>
                            <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Ditetapkan Oleh</th>
                            <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Kandidat Dosen</th>
                            <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Aksi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredKetuaKlasterRows.length > 0
                            ? pagedKetuaKlasterRows.map((row) => (
                                <tr key={`ketua-klaster-row-${row.id}`} className="border-b border-[#eff3fb]">
                                  <td className="px-3 py-2">
                                    <p className="font-semibold text-[#1f3160]">{row.kode}</p>
                                    <p className="text-xs text-[#6a779a]">{row.nama}</p>
                                  </td>
                                  <td className="px-3 py-2">
                                    {row.ketua?.ketua_dosen ? (
                                      <>
                                        <p className="font-semibold text-[#1f3160]">{row.ketua.ketua_dosen.nama}</p>
                                        <p className="text-xs text-[#6a779a]">
                                          {row.ketua.ketua_dosen.kode_dosen} • {row.ketua.ketua_dosen.nik || "-"}
                                        </p>
                                      </>
                                    ) : (
                                      <span className="rounded-full bg-[#fff3e0] px-2 py-1 text-xs font-bold text-[#9b6200]">
                                        Belum diset
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-sm text-[#44537b]">
                                    {row.ketua?.assigned_by?.nama || "-"}
                                  </td>
                                  <td className="px-3 py-2">
                                    <select
                                      value={ketuaKlasterDraft[row.id] || ""}
                                      onChange={(event) =>
                                        handleKetuaKlasterDraftChange(row.id, event.target.value)
                                      }
                                      className="w-full min-w-[320px] rounded-lg border border-[#d3dbef] px-3 py-2 text-sm outline-none focus:border-[#2f63e3]"
                                    >
                                      <option value="">Pilih dosen ketua klaster</option>
                                      {(row.kandidat_dosen || []).map((item) => (
                                        <option key={`ketua-klaster-candidate-${row.id}-${item.id}`} value={item.id}>
                                          {item.nama} ({item.kode_dosen})
                                        </option>
                                      ))}
                                    </select>
                                  </td>
                                  <td className="px-3 py-2">
                                    <button
                                      type="button"
                                      disabled={savingKetuaKlasterId === row.id || !(row.kandidat_dosen || []).length}
                                      onClick={() => handleSaveKetuaKlaster(row)}
                                      className="inline-flex items-center gap-1 rounded-md bg-[#2f63e3] px-3 py-1.5 text-xs font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      <ClipboardList className="h-3.5 w-3.5" />
                                      {savingKetuaKlasterId === row.id ? "Menyimpan..." : "Simpan"}
                                    </button>
                                  </td>
                                </tr>
                              ))
                            : null}
                        </tbody>
                      </table>

                      {filteredKetuaKlasterRows.length === 0 ? (
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[41px] flex items-center justify-center px-4 text-center text-sm font-semibold text-[#7b88ab]">
                          Data klaster tidak ditemukan.
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#e8edf8] pt-3">
                      <p className="text-sm text-[#4f5e86]">
                        Menampilkan {ketuaKlasterRangeStart} - {ketuaKlasterRangeEnd} dari{" "}
                        {filteredKetuaKlasterRows.length} data klaster.
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setKetuaKlasterPage((prev) => Math.max(1, prev - 1))}
                          disabled={ketuaKlasterPage === 1}
                          className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] transition hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Sebelumnya
                        </button>
                        <span className="text-sm font-semibold text-[#314778]">
                          Halaman {ketuaKlasterPage} / {totalKetuaKlasterPages}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setKetuaKlasterPage((prev) => Math.min(totalKetuaKlasterPages, prev + 1))
                          }
                          disabled={ketuaKlasterPage >= totalKetuaKlasterPages}
                          className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] transition hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Berikutnya
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

                {false ? (
                  <div className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                    <h3 className="text-lg font-black text-[#1b274b]">Review Ringkas Periode</h3>
                    <p className="mt-1 text-sm text-[#5d6c91]">
                      Pastikan semua klaster sudah memiliki ketua sebelum periode diaktifkan.
                    </p>

                    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                      <div className="rounded-lg border border-[#e6ecf8] bg-[#f8fbff] p-3">
                        <p className="text-xs font-bold uppercase text-[#6b789d]">Periode Dipilih</p>
                        <p className="mt-1 text-lg font-black text-[#1b274b]">
                          {selectedKetuaPeriode?.label_periode || "-"}
                        </p>
                        <p className="text-sm text-[#5d6c91]">
                          Status: {formatLabel(selectedKetuaPeriode?.status || "draft")}
                        </p>
                      </div>
                      <div className="rounded-lg border border-[#e6ecf8] bg-[#f8fbff] p-3">
                        <p className="text-xs font-bold uppercase text-[#6b789d]">Ketua Terisi</p>
                        <p className="mt-1 text-lg font-black text-[#127947]">{ketuaReviewStats.terisi}</p>
                        <p className="text-sm text-[#5d6c91]">dari {ketuaReviewStats.total} klaster</p>
                      </div>
                      <div className="rounded-lg border border-[#e6ecf8] bg-[#fff8f0] p-3">
                        <p className="text-xs font-bold uppercase text-[#9b6200]">Belum Terisi</p>
                        <p className="mt-1 text-lg font-black text-[#b05616]">{ketuaReviewStats.belumTerisi}</p>
                        <p className="text-sm text-[#8c6a3b]">Harus 0 sebelum aktivasi</p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-lg border border-[#e6ecf8] bg-white p-3">
                      <h4 className="text-sm font-bold text-[#1f3160]">Checklist Aktivasi</h4>
                      <ul className="mt-2 space-y-2 text-sm">
                        <li className={ketuaReviewStats.total > 0 ? "text-[#127947]" : "text-[#a03f3f]"}>
                          • Master klaster tersedia
                        </li>
                        <li className={ketuaReviewStats.belumTerisi === 0 ? "text-[#127947]" : "text-[#a03f3f]"}>
                          • Semua klaster sudah punya ketua
                        </li>
                        <li className="text-[#4f5e86]">• Tidak ada periode aktif lain</li>
                      </ul>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={savingPeriode || !selectedKetuaPeriode}
                        onClick={handleActivateDraftPeriode}
                        className="rounded-lg bg-[#117246] px-4 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Aktifkan Periode
                      </button>
                    </div>
                  </div>
                ) : null}

                {periodeMode === "edit" ? (
                  <div className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                    <h3 className="text-lg font-black text-[#1b274b]">Detail Periode</h3>
                    <p className="mt-1 text-sm text-[#5d6c91]">
                      {isPeriodeReadonly
                        ? "Periode ini sudah selesai. Data ditampilkan sebagai detail."
                        : "Ubah tanggal periode dan kelola status aktif periode terpilih."}
                    </p>

                    <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm font-semibold text-[#344b7f]">Label Periode</label>
                        <input
                          type="text"
                          value={editingPeriode?.label_periode || "-"}
                          disabled
                          className="w-full rounded-lg border border-[#d3dbef] bg-[#f7f9ff] px-3 py-2 text-sm text-[#4f5d85]"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-semibold text-[#344b7f]">Semester</label>
                        <input
                          type="text"
                          value={editingPeriode?.semester ? formatLabel(editingPeriode.semester) : "-"}
                          disabled
                          className="w-full rounded-lg border border-[#d3dbef] bg-[#f7f9ff] px-3 py-2 text-sm text-[#4f5d85]"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-semibold text-[#344b7f]">Tanggal Mulai</label>
                        <input
                          type="date"
                          name="tanggal_mulai"
                          value={periodeEditForm.tanggal_mulai}
                          onChange={handlePeriodeEditInputChange}
                          disabled={isPeriodeReadonly}
                          className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${
                            isPeriodeReadonly
                              ? "border-[#d3dbef] bg-[#f7f9ff] text-[#4f5d85]"
                              : "border-[#d3dbef] focus:border-[#2f63e3]"
                          }`}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-semibold text-[#344b7f]">Tanggal Selesai</label>
                        <input
                          type="date"
                          name="tanggal_selesai"
                          value={periodeEditForm.tanggal_selesai}
                          onChange={handlePeriodeEditInputChange}
                          disabled={isPeriodeReadonly}
                          className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${
                            isPeriodeReadonly
                              ? "border-[#d3dbef] bg-[#f7f9ff] text-[#4f5d85]"
                              : "border-[#d3dbef] focus:border-[#2f63e3]"
                          }`}
                        />
                      </div>
                    </div>

                    <section className="mt-4 rounded-xl border border-[#e6ecf8] bg-[#f8fbff] p-4">
                      <p className="text-sm font-black uppercase tracking-wide text-[#2b4f9c]">
                        Penanggung Jawab Periode (Read Only)
                      </p>
                      <p className="mt-1 text-sm text-[#5d6c91]">
                        Data dosen di bawah ini hanya untuk dilihat dan mengikuti konfigurasi saat periode dibuka.
                      </p>

                      {periodeReadonlyRoles.loading ? (
                        <div className="mt-3 rounded-lg border border-[#dbe4f6] bg-white px-3 py-2 text-sm text-[#5d6c91]">
                          Memuat data penanggung jawab periode...
                        </div>
                      ) : null}

                      {periodeReadonlyRoles.error ? (
                        <div className="mt-3 rounded-lg border border-[#f2cccc] bg-[#fff6f6] px-3 py-2 text-sm font-semibold text-[#b13a3a]">
                          {periodeReadonlyRoles.error}
                        </div>
                      ) : null}

                      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
                        {RESEARCH_CLUSTER_EDITOR_FIELDS.map((cluster) => {
                          const row = periodeReadonlyKetuaByCluster.get(cluster.key);
                          const dosen = row?.ketua?.ketua_dosen || null;
                          return (
                            <div
                              key={`readonly-ketua-${cluster.key}`}
                              className="rounded-lg border border-[#dbe4f6] bg-white p-3"
                            >
                              <p className="text-xs font-black uppercase tracking-wide text-[#6f7da5]">{cluster.label}</p>
                              <p className="mt-1 text-sm font-semibold text-[#1f3160]">{dosen?.nama || "-"}</p>
                              <p className="text-xs text-[#5d6c91]">{dosen ? `${dosen.kode_dosen || "-"} • ${dosen.nik || "-"}` : "-"}</p>
                            </div>
                          );
                        })}
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-3">
                        {[
                          {
                            label: "Penanggung Jawab Jalur Magang",
                            dosen: editingPeriode?.pengawasMagangDosen,
                          },
                          {
                            label: "Penanggung Jawab Jalur Pengabdian Masyarakat",
                            dosen: editingPeriode?.pengawasPengabdianDosen,
                          },
                          {
                            label: "Penanggung Jawab Jalur Perintisan Bisnis",
                            dosen: editingPeriode?.pengawasPerintisanBisnisDosen,
                          },
                        ].map((item) => (
                          <div key={`readonly-jalur-${item.label}`} className="rounded-lg border border-[#dbe4f6] bg-white p-3">
                            <p className="text-xs font-black uppercase tracking-wide text-[#6f7da5]">{item.label}</p>
                            <p className="mt-1 text-sm font-semibold text-[#1f3160]">{item.dosen?.nama || "-"}</p>
                            <p className="text-xs text-[#5d6c91]">
                              {item.dosen ? `${item.dosen.kode_dosen || "-"} • ${item.dosen.nik || "-"}` : "-"}
                            </p>
                          </div>
                        ))}
                      </div>
                    </section>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {!isPeriodeReadonly ? (
                        <>
                          <button
                            type="button"
                            disabled={savingPeriode}
                            onClick={handleUpdatePeriodeTanggal}
                            className="rounded-lg bg-[#2f63e3] px-4 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Simpan Perubahan
                          </button>
                          <button
                            type="button"
                            disabled={savingPeriode || !editingPeriode?.is_active}
                            onClick={handleClosePeriodeFromEditor}
                            className="rounded-lg bg-[#b83a3a] px-4 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Tutup Periode
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </main>
        </div>
      </div>
      {mahasiswaMasterFilterPopup}
    </div>
  );
}

export default DosenWorkspacePage;


