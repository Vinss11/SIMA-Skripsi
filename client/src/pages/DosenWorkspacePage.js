import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Upload,
  GraduationCap,
  UserCircle2,
  Users,
} from "lucide-react";
import Swal from "sweetalert2";
import MenuSectionHeader from "../components/MenuSectionHeader";
import StandardTabs from "../components/StandardTabs";
import DosenBimbinganReviewPage from "./DosenBimbinganReviewPage";

const TOPIK_PAGE_SIZE = 25;
const MASTER_TOPIK_PAGE_SIZE = 25;
const MAHASISWA_MASTER_PAGE_SIZE = 25;
const DOSEN_GRID_PAGE_SIZE = 25;
const TOPIK_CLUSTER_OPTIONS = ["Sirkel", "Siber", "ITSC", "MVK"];
const PERIODE_FORM_INITIAL = {
  ketua_itsc_dosen_id: "",
  ketua_sirkel_dosen_id: "",
  ketua_siber_dosen_id: "",
  ketua_mvk_dosen_id: "",
  pengawas_magang_dosen_id: "",
  pengawas_pengabdian_dosen_id: "",
  pengawas_perintisan_bisnis_dosen_id: "",
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

function buildNavItems(isSekretaris) {
  if (!isSekretaris) {
    return [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { id: "mahasiswa-bimbingan", label: "Mahasiswa Bimbingan", icon: GraduationCap },
      { id: "bimbingan-review", label: "Review Bimbingan", icon: MessageSquareText },
      { id: "submissions", label: "Pengajuan Mahasiswa", icon: ClipboardList },
      { id: "permohonan-extend", label: "Permohonan Extend", icon: ShieldAlert },
      { id: "pamit", label: "Pamit Mahasiswa", icon: Users },
      { id: "topik", label: "Manajemen Topik", icon: BookOpenCheck },
    ];
  }

  return [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "master-mahasiswa", label: "Master Mahasiswa", icon: GraduationCap },
    { id: "mahasiswa-bimbingan", label: "Mahasiswa Bimbingan", icon: GraduationCap },
    { id: "bimbingan-review", label: "Review Bimbingan", icon: MessageSquareText },
    { id: "submissions", label: "Pengajuan Mahasiswa", icon: ClipboardList },
    { id: "permohonan-extend", label: "Permohonan Extend", icon: ShieldAlert },
    { id: "pamit", label: "Pamit Mahasiswa", icon: Users },
    { id: "topik", label: "Manajemen Topik", icon: BookOpenCheck },
    { id: "master-topik", label: "Master Topik", icon: BookOpenCheck },
    { id: "penjaluran", label: "Manajemen Penjaluran", icon: ListChecks },
    { id: "periode", label: "Manajemen Periode", icon: CalendarRange },
  ];
}

function buildTabHeaders(isSekretaris) {
  const baseHeaders = {
    dashboard: {
      icon: LayoutDashboard,
      title: "Dashboard Dosen",
      subtitle: "Ringkasan review pengajuan, status pamit, topik aktif, dan kuota bimbingan.",
    },
    "master-mahasiswa": {
      icon: GraduationCap,
      title: "Master Data Mahasiswa",
      subtitle: "Lihat histori penjaluran mahasiswa secara lengkap dalam mode baca.",
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
  };
}

function DosenWorkspacePage({ session, apiBaseUrl, onLogout, onSessionExpired, isSekretaris = false }) {
  const navItems = useMemo(() => buildNavItems(isSekretaris), [isSekretaris]);
  const tabHeaders = useMemo(() => buildTabHeaders(isSekretaris), [isSekretaris]);
  const [activeTab, setActiveTab] = useState("dashboard");
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

  const [topikForm, setTopikForm] = useState({
    kode: "",
    judul: "",
    deskripsi: "",
    cluster: "Sirkel",
  });
  const [savingTopik, setSavingTopik] = useState(false);

  const [topikUploadFile, setTopikUploadFile] = useState(null);
  const [uploadingTopik, setUploadingTopik] = useState(false);
  const [uploadTopikResult, setUploadTopikResult] = useState(null);

  const [pendaftaranRows, setPendaftaranRows] = useState([]);
  const [pendaftaranSearch, setPendaftaranSearch] = useState("");
  const [pendaftaranPage, setPendaftaranPage] = useState(1);
  const [mahasiswaMasterRows, setMahasiswaMasterRows] = useState([]);
  const [mahasiswaMasterQuery, setMahasiswaMasterQuery] = useState("");
  const [mahasiswaMasterPage, setMahasiswaMasterPage] = useState(1);
  const [periodeOverview, setPeriodeOverview] = useState({
    active_periode: null,
    draft_periode: null,
    periodes: [],
    dosen_options: [],
    ketua_klaster_options: [],
  });
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

  const sessionExpiredRef = useRef(false);
  const activeTabHeader = tabHeaders[activeTab] || tabHeaders.dashboard;
  const isPeriodeReadonly =
    String(editingPeriode?.status || (editingPeriode?.is_active ? "active" : "closed")).toLowerCase() ===
    "closed";
  const useGridViewportLayout =
    !loading &&
    ((activeTab === "master-mahasiswa" || activeTab === "mahasiswa-bimbingan") ||
      (activeTab === "bimbingan-review" && isBimbinganReviewListMode) ||
      (activeTab === "submissions" && submissionMode === "list") ||
      activeTab === "permohonan-extend" ||
      activeTab === "pamit" ||
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
        });
      } else {
        setPeriodeOverview({
          active_periode: null,
          draft_periode: null,
          periodes: [],
          dosen_options: [],
          ketua_klaster_options: [],
        });
        issues.push(periodeResult?.reason?.message || "Gagal memuat data periode.");
      }

      if (masterTopikResult?.status === "fulfilled") {
        setMasterTopikRows(Array.isArray(masterTopikResult.value) ? masterTopikResult.value : []);
      } else {
        setMasterTopikRows([]);
        issues.push(masterTopikResult?.reason?.message || "Gagal memuat master topik.");
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

  const filteredMahasiswaMasterRows = useMemo(() => {
    const keyword = mahasiswaMasterQuery.trim().toLowerCase();
    if (!keyword) return mahasiswaRowsByActiveTab;

    return mahasiswaRowsByActiveTab.filter((row) => {
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
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(keyword);
    });
  }, [mahasiswaRowsByActiveTab, mahasiswaMasterQuery]);

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

  useEffect(() => {
    setMahasiswaMasterPage(1);
  }, [mahasiswaMasterQuery]);

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
    const payload = {
      kode: topikForm.kode.trim().toUpperCase(),
      judul: topikForm.judul.trim(),
      deskripsi: topikForm.deskripsi.trim(),
      cluster: topikForm.cluster,
    };

    if (!payload.kode || !payload.judul || !payload.cluster) {
      showErrorToast("Kode topik, judul, dan cluster wajib diisi.");
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
        cluster: "Sirkel",
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

      const response = await fetch(`${apiBaseUrl}/api/admin/upload/topics`, {
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
        throw new Error(json?.message || "Upload topik gagal diproses.");
      }

      setUploadTopikResult(json);
      if (json.success) {
        showSuccessToast("Upload topik berhasil diproses.");
        await loadAllData();
      } else {
        showErrorToast(json.message || "Upload topik selesai dengan kegagalan.");
      }
    } catch (uploadError) {
      if (uploadError?.message !== "__SESSION_EXPIRED__") {
        showErrorToast(uploadError.message || "Gagal upload topik.");
      }
    } finally {
      setUploadingTopik(false);
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

  const handleOpenPeriode = async () => {
    const fieldErrors = {};
    const tahunAkademik = periodeForm.tahun_akademik.trim();
    const tahunRegex = /^\d{4}\/\d{4}$/;
    const ketuaFields = [
      { key: "ketua_itsc_dosen_id", label: "Ketua cluster ITSC (Informatika Teori & Sistem Cerdas)" },
      { key: "ketua_sirkel_dosen_id", label: "Ketua cluster SIRKEL (Sistem Informasi & Rekayasa Perangkat Lunak)" },
      { key: "ketua_siber_dosen_id", label: "Ketua cluster SIBER (Sistem Siber)" },
      { key: "ketua_mvk_dosen_id", label: "Ketua cluster MVK (Multimedia & Visi Komputer)" },
    ];

    ketuaFields.forEach((item) => {
      if (!periodeForm[item.key]) {
        fieldErrors[item.key] = `${item.label} wajib dipilih.`;
      }
    });
    if (!periodeForm.pengawas_magang_dosen_id) {
      fieldErrors.pengawas_magang_dosen_id = "Dosen pengawas magang wajib dipilih.";
    }
    if (!periodeForm.pengawas_pengabdian_dosen_id) {
      fieldErrors.pengawas_pengabdian_dosen_id = "Dosen pengampu jalur pengabdian masyarakat wajib dipilih.";
    }
    if (!periodeForm.pengawas_perintisan_bisnis_dosen_id) {
      fieldErrors.pengawas_perintisan_bisnis_dosen_id = "Dosen pengampu jalur perintisan bisnis wajib dipilih.";
    }
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

    if (Object.keys(fieldErrors).length > 0) {
      setPeriodeFormErrors(fieldErrors);
      return;
    }
    setPeriodeFormErrors({});

    const ketuaSummary = ketuaFields
      .map((item) => {
        const dosen = periodeDosenMap.get(Number(periodeForm[item.key]));
        return `${item.label}: <b>${dosen?.nama || "-"}</b>`;
      })
      .join("<br>");

    const konfirmasi = await Swal.fire({
      title: "Buka periode ini?",
      html: `
        Periode yang akan dibuka:<br><b>${formatLabel(periodeForm.semester)} ${tahunAkademik}</b><br><br>
        ${ketuaSummary}<br><br>
        Pengawas Magang: <b>${periodeDosenMap.get(Number(periodeForm.pengawas_magang_dosen_id))?.nama || "-"}</b><br>
        Pengampu Pengabdian Masyarakat: <b>${periodeDosenMap.get(Number(periodeForm.pengawas_pengabdian_dosen_id))?.nama || "-"}</b><br>
        Pengampu Perintisan Bisnis: <b>${periodeDosenMap.get(Number(periodeForm.pengawas_perintisan_bisnis_dosen_id))?.nama || "-"}</b>
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
          ketua_itsc_dosen_id: Number(periodeForm.ketua_itsc_dosen_id),
          ketua_sirkel_dosen_id: Number(periodeForm.ketua_sirkel_dosen_id),
          ketua_siber_dosen_id: Number(periodeForm.ketua_siber_dosen_id),
          ketua_mvk_dosen_id: Number(periodeForm.ketua_mvk_dosen_id),
          pengawas_magang_dosen_id: Number(periodeForm.pengawas_magang_dosen_id),
          pengawas_pengabdian_dosen_id: Number(periodeForm.pengawas_pengabdian_dosen_id),
          pengawas_perintisan_bisnis_dosen_id: Number(periodeForm.pengawas_perintisan_bisnis_dosen_id),
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
          setPeriodeFormErrors(openError.detail);
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
            <div className="space-y-1">
              {navItems.map((item) => {
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

            {!loading && (activeTab === "master-mahasiswa" || activeTab === "mahasiswa-bimbingan") ? (
              <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
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

                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7282a8]" />
                      <input
                        type="text"
                        value={mahasiswaMasterQuery}
                        onChange={(event) => setMahasiswaMasterQuery(event.target.value)}
                        placeholder="Cari NIM, nama, periode, jalur, pembimbing..."
                        className="w-[340px] rounded-lg border border-[#d3dbef] py-2 pl-8 pr-3 text-sm outline-none focus:border-[#2f63e3]"
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

                <div className="relative mt-1 flex-1 overflow-auto rounded-lg border border-[#e6ecf8]">
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

                    <div className="relative mt-1 flex-1 overflow-auto rounded-lg border border-[#e6ecf8]">
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
                            <div className="mt-3 overflow-auto rounded-lg border border-[#e6ecf8]">
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
                  <h3 className="text-lg font-black text-[#1b274b]">Grid Permohonan Extend Semester 3</h3>
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

                <div className="relative mt-1 flex-1 overflow-auto rounded-lg border border-[#e6ecf8]">
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
                <div className="relative mt-1 flex-1 overflow-auto rounded-lg border border-[#e6ecf8]">
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

                <div className="relative mt-1 flex-1 overflow-auto rounded-lg border border-[#e6ecf8]">
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
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <StandardTabs
                        items={[
                          { key: "list", label: "Data Topik", icon: BookOpenCheck },
                          { key: "api", label: "Add", icon: ClipboardList },
                          { key: "upload", label: "Upload Excel", icon: FileSpreadsheet },
                        ]}
                        activeKey={topikMode}
                        onChange={(nextMode) => setTopikMode(nextMode)}
                      />
                    </div>

                    <a
                      href={`${apiBaseUrl}/api/admin/upload/template`}
                      className="inline-flex items-center gap-2 rounded-lg bg-[#0f7b50] px-4 py-2 text-sm font-bold text-white transition hover:brightness-110"
                    >
                      <Download className="h-4 w-4" />
                      Download Template Topik
                    </a>
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

                    <div className="relative mt-1 flex-1 overflow-auto rounded-lg border border-[#e6ecf8]">
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
                          {TOPIK_CLUSTER_OPTIONS.map((cluster) => (
                            <option key={cluster} value={cluster}>
                              {cluster}
                            </option>
                          ))}
                        </select>
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
                ) : null}

                {topikMode === "upload" ? (
                  <div className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                    <h3 className="mb-1 text-lg font-black text-[#1b274b]">Upload Topik via Excel</h3>
                    <p className="text-sm text-[#5d6c91]">
                      Gunakan template topik. Untuk akun dosen/sekretaris, sistem otomatis memasangkan topik ke akun dosen yang sedang login.
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
                        className="inline-flex items-center gap-2 rounded-lg bg-[#0f7b50] px-4 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Upload className="h-4 w-4" />
                        {uploadingTopik ? "Mengupload..." : "Upload Topik"}
                      </button>
                    </form>

                    {uploadTopikResult ? (
                      <div className="mt-4 rounded-lg border border-[#dce6f7] bg-[#f8fbff] p-4">
                        <p className="text-sm font-bold text-[#1e2f57]">{uploadTopikResult.message}</p>
                        <p className="mt-1 text-sm text-[#42527c]">
                          Berhasil: {uploadTopikResult?.data?.berhasil ?? 0} | Gagal: {uploadTopikResult?.data?.gagal ?? 0}
                        </p>
                      </div>
                    ) : null}
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

                <div className="relative mt-1 flex-1 overflow-auto rounded-lg border border-[#e6ecf8]">
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

                <div className="relative mt-1 flex-1 overflow-auto rounded-lg border border-[#e6ecf8]">
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
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <StandardTabs
                        backButton={{
                          onClick: () => {
                            setPeriodeMode("list");
                            setEditingPeriode(null);
                            setPeriodeFormErrors({});
                            setPeriodeReadonlyRoles({ loading: false, rows: [], error: "" });
                          },
                          disabled: periodeMode === "list",
                          title: "Kembali ke data periode",
                          icon: ArrowLeft,
                        }}
                        items={[
                          {
                            key: "list",
                            label: "Data Periode",
                            icon: CalendarRange,
                          },
                          {
                            key: "open",
                            label: "Buka Periode",
                            icon: CalendarRange,
                          },
                        ]}
                        activeKey={periodeMode}
                        onChange={(nextMode) => {
                          setPeriodeMode(nextMode);
                          setEditingPeriode(null);
                          setPeriodeReadonlyRoles({ loading: false, rows: [], error: "" });
                          if (nextMode === "open") {
                            setPeriodeFormErrors({});
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>

                {periodeMode === "list" ? (
                  <>
                    <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                      <h3 className="mb-3 text-lg font-black text-[#1b274b]">Riwayat Periode</h3>
                      <div className="relative mt-1 flex-1 overflow-auto rounded-lg border border-[#e6ecf8]">
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
                      Tetapkan dosen penanggung jawab jalur, lalu isi periode yang akan dibuka.
                    </p>

                    <div className="mt-4 space-y-4">
                      <section className="rounded-xl border border-[#e6ecf8] bg-[#f8fbff] p-4">
                        <p className="text-sm font-black uppercase tracking-wide text-[#2b4f9c]">
                          1. Ketua Cluster Penelitian
                        </p>
                        <p className="mt-1 text-sm text-[#5d6c91]">
                          Pilih dosen ketua untuk setiap cluster penelitian.
                        </p>

                        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
                          {[
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
                          ].map((item) => {
                            const clusterOption = periodeKetuaKlasterOptions.find(
                              (row) => String(row.kode || "").toUpperCase() === item.code
                            );
                            const kandidat = Array.isArray(clusterOption?.kandidat_dosen)
                              ? clusterOption.kandidat_dosen
                              : [];
                            return (
                              <div key={`periode-ketua-${item.code}`}>
                                <label className="mb-1 block text-sm font-semibold text-[#344b7f]">
                                  {item.label}
                                </label>
                                <select
                                  name={item.key}
                                  value={periodeForm[item.key]}
                                  onChange={handlePeriodeInputChange}
                                  className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[#2f63e3] ${
                                    periodeFormErrors[item.key] ? "border-[#dc4b4b] bg-[#fff7f7]" : "border-[#d3dbef]"
                                  }`}
                                >
                                  <option value="">Pilih dosen ketua {item.code}</option>
                                  {kandidat.map((dosen) => (
                                    <option key={`periode-ketua-${item.code}-${dosen.id}`} value={dosen.id}>
                                      {dosen.nama} ({dosen.kode_dosen || dosen.nik || "-"})
                                    </option>
                                  ))}
                                </select>
                                {periodeFormErrors[item.key] ? (
                                  <p className="mt-1 text-xs font-semibold text-[#c23737]">{periodeFormErrors[item.key]}</p>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      </section>

                      <section className="rounded-xl border border-[#e6ecf8] bg-[#f8fbff] p-4">
                        <p className="text-sm font-black uppercase tracking-wide text-[#2b4f9c]">
                          2. Penanggung Jawab Jalur Magang
                        </p>
                        <p className="mt-1 text-sm text-[#5d6c91]">
                          Pilih dosen pengawas untuk alur penjaluran jalur magang.
                        </p>

                        <div className="mt-3">
                          <label className="mb-1 block text-sm font-semibold text-[#344b7f]">Dosen Pengawas Magang</label>
                          <select
                            name="pengawas_magang_dosen_id"
                            value={periodeForm.pengawas_magang_dosen_id}
                            onChange={handlePeriodeInputChange}
                            className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[#2f63e3] ${
                              periodeFormErrors.pengawas_magang_dosen_id ? "border-[#dc4b4b] bg-[#fff7f7]" : "border-[#d3dbef]"
                            }`}
                          >
                            <option value="">Pilih dosen pengawas magang</option>
                            {periodeDosenOptions.map((dosen) => (
                              <option key={`periode-pengawas-magang-${dosen.id}`} value={dosen.id}>
                                {dosen.nama} ({dosen.kode_dosen || dosen.nik || "-"})
                              </option>
                            ))}
                          </select>
                          {periodeFormErrors.pengawas_magang_dosen_id ? (
                            <p className="mt-1 text-xs font-semibold text-[#c23737]">
                              {periodeFormErrors.pengawas_magang_dosen_id}
                            </p>
                          ) : null}
                        </div>
                      </section>

                      <section className="rounded-xl border border-[#e6ecf8] bg-[#f8fbff] p-4">
                        <p className="text-sm font-black uppercase tracking-wide text-[#2b4f9c]">
                          3. Penanggung Jawab Jalur Pengabdian Masyarakat
                        </p>
                        <p className="mt-1 text-sm text-[#5d6c91]">
                          Pilih dosen pengampu untuk alur penjaluran jalur pengabdian masyarakat.
                        </p>

                        <div className="mt-3">
                          <label className="mb-1 block text-sm font-semibold text-[#344b7f]">
                            Dosen Pengampu Pengabdian Masyarakat
                          </label>
                          <select
                            name="pengawas_pengabdian_dosen_id"
                            value={periodeForm.pengawas_pengabdian_dosen_id}
                            onChange={handlePeriodeInputChange}
                            className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[#2f63e3] ${
                              periodeFormErrors.pengawas_pengabdian_dosen_id
                                ? "border-[#dc4b4b] bg-[#fff7f7]"
                                : "border-[#d3dbef]"
                            }`}
                          >
                            <option value="">Pilih dosen pengampu pengabdian</option>
                            {periodeDosenOptions.map((dosen) => (
                              <option key={`periode-pengawas-pengabdian-${dosen.id}`} value={dosen.id}>
                                {dosen.nama} ({dosen.kode_dosen || dosen.nik || "-"})
                              </option>
                            ))}
                          </select>
                          {periodeFormErrors.pengawas_pengabdian_dosen_id ? (
                            <p className="mt-1 text-xs font-semibold text-[#c23737]">
                              {periodeFormErrors.pengawas_pengabdian_dosen_id}
                            </p>
                          ) : null}
                        </div>
                      </section>

                      <section className="rounded-xl border border-[#e6ecf8] bg-[#f8fbff] p-4">
                        <p className="text-sm font-black uppercase tracking-wide text-[#2b4f9c]">
                          4. Penanggung Jawab Jalur Perintisan Bisnis
                        </p>
                        <p className="mt-1 text-sm text-[#5d6c91]">
                          Pilih dosen pengampu untuk alur penjaluran jalur perintisan bisnis.
                        </p>

                        <div className="mt-3">
                          <label className="mb-1 block text-sm font-semibold text-[#344b7f]">
                            Dosen Pengampu Perintisan Bisnis
                          </label>
                          <select
                            name="pengawas_perintisan_bisnis_dosen_id"
                            value={periodeForm.pengawas_perintisan_bisnis_dosen_id}
                            onChange={handlePeriodeInputChange}
                            className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[#2f63e3] ${
                              periodeFormErrors.pengawas_perintisan_bisnis_dosen_id
                                ? "border-[#dc4b4b] bg-[#fff7f7]"
                                : "border-[#d3dbef]"
                            }`}
                          >
                            <option value="">Pilih dosen pengampu perintisan bisnis</option>
                            {periodeDosenOptions.map((dosen) => (
                              <option key={`periode-pengawas-perintisan-${dosen.id}`} value={dosen.id}>
                                {dosen.nama} ({dosen.kode_dosen || dosen.nik || "-"})
                              </option>
                            ))}
                          </select>
                          {periodeFormErrors.pengawas_perintisan_bisnis_dosen_id ? (
                            <p className="mt-1 text-xs font-semibold text-[#c23737]">
                              {periodeFormErrors.pengawas_perintisan_bisnis_dosen_id}
                            </p>
                          ) : null}
                        </div>
                      </section>

                      <section className="rounded-xl border border-[#e6ecf8] bg-[#f8fbff] p-4">
                        <p className="text-sm font-black uppercase tracking-wide text-[#2b4f9c]">
                          5. Detail Periode Penjaluran
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

                    <div className="relative mt-1 flex-1 overflow-auto rounded-lg border border-[#e6ecf8]">
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
    </div>
  );
}

export default DosenWorkspacePage;
