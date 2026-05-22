import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  Download,
  FileSpreadsheet,
  LayoutDashboard,
  ListChecks,
  LogOut,
  PencilLine,
  RefreshCcw,
  Search,
  ShieldCheck,
  Upload,
  UserCircle2,
} from "lucide-react";
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";
import MenuSectionHeader from "../components/MenuSectionHeader";

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "statistik", label: "Statistik", icon: BarChart3 },
  { id: "upload-dosen", label: "Manajemen Dosen", icon: FileSpreadsheet },
  { id: "upload-mahasiswa", label: "Upload Mahasiswa", icon: Upload },
  { id: "pengajuan", label: "Data Pengajuan", icon: ListChecks },
];

const TAB_HEADERS = {
  dashboard: {
    icon: LayoutDashboard,
    title: "Dashboard Admin",
    subtitle: "Monitoring ringkas data mahasiswa, pengajuan, dan performa operasional sistem.",
  },
  statistik: {
    icon: BarChart3,
    title: "Statistik Akademik",
    subtitle: "Rekap per status, jenis jalur, dan tipe pengajuan dalam satu tempat.",
  },
  "upload-dosen": {
    icon: FileSpreadsheet,
    title: "Manajemen Dosen",
    subtitle: "Kelola master data dosen, import Excel, serta pemutakhiran profil dosen.",
  },
  "upload-mahasiswa": {
    icon: Upload,
    title: "Upload Mahasiswa (Teknis)",
    subtitle: "Input teknis data mahasiswa melalui template. Master penjaluran dikelola sekretaris prodi.",
  },
  pengajuan: {
    icon: ListChecks,
    title: "Data Pengajuan",
    subtitle: "Pantau seluruh riwayat pengajuan mahasiswa dari semua jalur.",
  },
};

const DOSEN_PAGE_SIZE = 25;
const JABATAN_STRUKTURAL_OPTIONS = [
  "Ketua Jurusan Informatika",
  "Sekretaris Jurusan Informatika",
  "Ketua Program Studi Informatika - Program Sarjana",
  "Sekretaris Program Studi Informatika - Program Sarjana Reguler",
  "Sekretaris Program Studi Informatika - Program Sarjana International Program",
  "Ketua Program Studi Informatika - Program Sarjana Pendidikan Jarak Jauh",
  "Ketua Program Studi Informatika - Program Magister",
];

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

function parseCount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

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

function aggregateStatistics(stats) {
  const mahasiswaPerStatus = Array.isArray(stats?.mahasiswa_per_status) ? stats.mahasiswa_per_status : [];
  const pengajuanPerStatus = Array.isArray(stats?.pengajuan_per_status) ? stats.pengajuan_per_status : [];
  const pengajuanPerJenis = Array.isArray(stats?.pengajuan_per_jenis_jalur) ? stats.pengajuan_per_jenis_jalur : [];
  const pengajuanPerTipe = Array.isArray(stats?.pengajuan_per_tipe) ? stats.pengajuan_per_tipe : [];

  return {
    totalMahasiswa: mahasiswaPerStatus.reduce((sum, item) => sum + parseCount(item.count), 0),
    totalPengajuan: pengajuanPerStatus.reduce((sum, item) => sum + parseCount(item.count), 0),
    pendingPengajuan: pengajuanPerStatus
      .filter((item) => item.status === "pending")
      .reduce((sum, item) => sum + parseCount(item.count), 0),
    approvedPengajuan: pengajuanPerStatus
      .filter((item) => item.status === "approved")
      .reduce((sum, item) => sum + parseCount(item.count), 0),
    mahasiswaPerStatus,
    pengajuanPerStatus,
    pengajuanPerJenis,
    pengajuanPerTipe,
  };
}

function StatCard({ title, value, subtitle, tone }) {
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${tone}`}>
      <p className="text-sm font-semibold text-[#4e5e86]">{title}</p>
      <p className="mt-2 text-3xl font-black text-[#1b274b]">{value}</p>
      <p className="mt-1 text-sm text-[#5d6c91]">{subtitle}</p>
    </div>
  );
}

function DataTable({
  title,
  rows,
  columns,
  emptyMessage = "Belum ada data.",
  heightClass = "h-[520px]",
  minTableWidthClass = "min-w-[560px]",
}) {
  return (
    <div className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-lg font-black text-[#1b274b]">{title}</h3>
      <div className={`relative overflow-auto rounded-lg border border-[#e6ecf8] ${heightClass}`}>
        <table className={`w-full ${minTableWidthClass} text-left text-sm`}>
          <thead>
            <tr className="border-b border-[#e7ecf8] text-[#50608a]">
              {columns.map((column) => (
                <th key={column.key} className="px-2 py-2 font-semibold">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map((row, index) => (
                <tr key={`${title}-${index}`} className="border-b border-[#f0f3fa] last:border-b-0">
                  {columns.map((column) => (
                    <td key={`${title}-${index}-${column.key}`} className="px-2 py-2 text-[#1f2d53]">
                      {column.render ? column.render(row) : row[column.key] ?? "-"}
                    </td>
                  ))}
                </tr>
              ))
            ) : null}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[41px] flex items-center justify-center px-4 text-center text-sm font-semibold text-[#7b88ab]">
            {emptyMessage}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function UploadPanel({
  title,
  description,
  templateUrl,
  endpoint,
  token,
  apiBaseUrl,
  file,
  setFile,
  uploadResult,
  setUploadResult,
  isUploading,
  setIsUploading,
  onUploadSuccess,
  extraNote,
}) {
  const [error, setError] = useState("");

  const handleUpload = async (event) => {
    event.preventDefault();
    setError("");
    setUploadResult(null);

    if (!file) {
      setError("Pilih file Excel terlebih dahulu.");
      return;
    }

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${apiBaseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      let data = null;
      try {
        data = await response.json();
      } catch (parseError) {
        data = null;
      }

      if (!response.ok || !data) {
        throw new Error(data?.message || "Upload gagal diproses.");
      }

      setUploadResult(data);
      onUploadSuccess?.(data);

      if (!data.success) {
        setError(data.message || "Upload selesai tetapi ada kegagalan.");
      }
    } catch (uploadError) {
      setError(uploadError.message || "Terjadi kesalahan saat upload.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="rounded-xl border border-[#e4e9f6] bg-white p-6 shadow-sm">
      <h3 className="text-xl font-black text-[#1b274b]">{title}</h3>
      <p className="mt-1 text-sm text-[#5d6c91]">{description}</p>
      {extraNote ? <p className="mt-2 text-xs font-semibold text-[#50608a]">{extraNote}</p> : null}

      <div className="mt-4 flex flex-wrap gap-3">
        <a
          href={templateUrl}
          className="inline-flex items-center gap-2 rounded-lg border border-[#b8e0cb] bg-white px-4 py-2 text-sm font-bold text-[#0f7b50] transition hover:bg-[#effaf4]"
        >
          <Download className="h-4 w-4" />
          Download Template
        </a>
      </div>

      <form onSubmit={handleUpload} className="mt-4 space-y-3">
        <input
          type="file"
          accept=".xls,.xlsx,.ods"
          onChange={(event) => setFile(event.target.files?.[0] || null)}
          className="w-full rounded-lg border border-[#d7deef] px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={isUploading}
          className="inline-flex items-center gap-2 rounded-lg bg-[#2f63e3] px-4 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Upload className="h-4 w-4" />
          {isUploading ? "Mengupload..." : "Upload File"}
        </button>
      </form>

      {error ? <div className="mt-3 rounded-lg border border-[#f5d0d0] bg-[#fff2f2] px-3 py-2 text-sm font-semibold text-[#a33f3f]">{error}</div> : null}

      {uploadResult ? (
        <div className="mt-4 rounded-lg border border-[#dce6f7] bg-[#f8fbff] p-4">
          <p className="text-sm font-bold text-[#1e2f57]">{uploadResult.message}</p>
          <p className="mt-1 text-sm text-[#42527c]">
            Berhasil: {uploadResult?.data?.berhasil ?? 0} | Gagal: {uploadResult?.data?.gagal ?? 0}
          </p>
          {Array.isArray(uploadResult?.data?.detail_gagal) && uploadResult.data.detail_gagal.length > 0 ? (
            <div className="mt-3">
              <p className="text-xs font-bold uppercase tracking-wide text-[#6f7da3]">Contoh Error</p>
              <ul className="mt-1 list-disc pl-5 text-sm text-[#38496f]">
                {uploadResult.data.detail_gagal.slice(0, 5).map((item, index) => (
                  <li key={`failed-${index}`}>
                    Baris {item.row}: {item.error}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function AdminDashboardPage({ session, apiBaseUrl, onLogout, onSessionExpired }) {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statistics, setStatistics] = useState(null);
  const [pengajuanRows, setPengajuanRows] = useState([]);
  const [dosenRows, setDosenRows] = useState([]);
  const [dosenFile, setDosenFile] = useState(null);
  const [mahasiswaFile, setMahasiswaFile] = useState(null);
  const [uploadDosenResult, setUploadDosenResult] = useState(null);
  const [uploadMahasiswaResult, setUploadMahasiswaResult] = useState(null);
  const [isUploadingDosen, setIsUploadingDosen] = useState(false);
  const [isUploadingMahasiswa, setIsUploadingMahasiswa] = useState(false);
  const [isDownloadingDosen, setIsDownloadingDosen] = useState(false);
  const [dosenQuery, setDosenQuery] = useState("");
  const [dosenMode, setDosenMode] = useState("list");
  const [dosenPage, setDosenPage] = useState(1);
  const [klasterOptions, setKlasterOptions] = useState([]);
  const [createDosenForm, setCreateDosenForm] = useState({
    nik: "",
    nama: "",
    gelar: "",
    email: "",
    jabatan_struktural: "",
    kuota_bimbingan: "5",
    klaster_ids: [],
  });
  const [creatingDosen, setCreatingDosen] = useState(false);
  const [createDosenMessage, setCreateDosenMessage] = useState("");
  const [createDosenError, setCreateDosenError] = useState("");
  const [selectedDosen, setSelectedDosen] = useState(null);
  const [dosenEditForm, setDosenEditForm] = useState({
    gelar: "",
    jabatan_struktural: "",
    klaster_ids: [],
  });
  const [savingDosenEdit, setSavingDosenEdit] = useState(false);
  const [dosenActionMessage, setDosenActionMessage] = useState("");
  const [dosenActionError, setDosenActionError] = useState("");
  const sessionExpiredRef = useRef(false);
  const contentScrollRef = useRef(null);
  const dosenGridScrollRef = useRef(null);
  const preserveContentScrollTopRef = useRef(null);
  const preserveGridScrollTopRef = useRef(null);
  const restoreRafRef = useRef([]);

  const fetchWithAuth = useCallback(
    async (path) => {
      const response = await fetch(`${apiBaseUrl}${path}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.token}`,
          "Content-Type": "application/json",
        },
      });

      let data = null;
      try {
        data = await response.json();
      } catch (parseError) {
        data = null;
      }

      if (response.status === 401 || response.status === 403) {
        if (!sessionExpiredRef.current) {
          sessionExpiredRef.current = true;
          onSessionExpired?.();
        }
        throw new Error("__SESSION_EXPIRED__");
      }

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || `Gagal memuat ${path}`);
      }

      return data.data;
    },
    [apiBaseUrl, onSessionExpired, session.token]
  );

  const loadData = useCallback(async () => {
    sessionExpiredRef.current = false;
    setLoading(true);
    setError("");

    const [statsResult, pengajuanResult, dosenResult, klasterResult] = await Promise.allSettled([
      fetchWithAuth("/api/admin/statistics"),
      fetchWithAuth("/api/admin/pengajuan"),
      fetchWithAuth("/api/admin/dosen"),
      fetchWithAuth("/api/admin/klasters"),
    ]);

    if (sessionExpiredRef.current) return;

    const issues = [];

    if (statsResult.status === "fulfilled") {
      setStatistics(statsResult.value);
    } else {
      setStatistics(null);
      issues.push(statsResult.reason?.message || "Gagal memuat statistik admin.");
    }

    if (pengajuanResult.status === "fulfilled") {
      setPengajuanRows(Array.isArray(pengajuanResult.value) ? pengajuanResult.value : []);
    } else {
      setPengajuanRows([]);
      issues.push(pengajuanResult.reason?.message || "Gagal memuat data pengajuan.");
    }

    if (dosenResult.status === "fulfilled") {
      setDosenRows(Array.isArray(dosenResult.value) ? dosenResult.value : []);
    } else {
      setDosenRows([]);
      issues.push(dosenResult.reason?.message || "Gagal memuat data dosen.");
    }

    if (klasterResult.status === "fulfilled") {
      setKlasterOptions(Array.isArray(klasterResult.value) ? klasterResult.value : []);
    } else {
      setKlasterOptions([]);
      issues.push(klasterResult.reason?.message || "Gagal memuat data klaster.");
    }

    setError(issues.join(" "));
    setLoading(false);
  }, [fetchWithAuth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const summary = useMemo(() => aggregateStatistics(statistics), [statistics]);
  const activeTabHeader = TAB_HEADERS[activeTab] || TAB_HEADERS.dashboard;
  const templateDosenUrl = `${apiBaseUrl}/api/admin/upload/dosen-template`;
  const templateMahasiswaUrl = `${apiBaseUrl}/api/admin/upload/mahasiswa-template`;

  const filteredDosenRows = useMemo(() => {
    const keyword = dosenQuery.trim().toLowerCase();
    if (!keyword) return dosenRows;

    return dosenRows.filter((row) => {
      const klasterLabel = Array.isArray(row.klasters)
        ? row.klasters.map((item) => `${item.kode} ${item.nama}`).join(" ")
        : "";
      const haystack = [
        row.kode_dosen,
        row.nik,
        row.nama,
        row.gelar,
        row.email,
        row.jabatan_struktural,
        klasterLabel,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(keyword);
    });
  }, [dosenRows, dosenQuery]);

  const totalDosenPages = useMemo(
    () => Math.max(1, Math.ceil(filteredDosenRows.length / DOSEN_PAGE_SIZE)),
    [filteredDosenRows.length]
  );

  const pagedDosenRows = useMemo(() => {
    const start = (dosenPage - 1) * DOSEN_PAGE_SIZE;
    return filteredDosenRows.slice(start, start + DOSEN_PAGE_SIZE);
  }, [filteredDosenRows, dosenPage]);

  const dosenRangeStart = filteredDosenRows.length === 0 ? 0 : (dosenPage - 1) * DOSEN_PAGE_SIZE + 1;
  const dosenRangeEnd = Math.min(dosenPage * DOSEN_PAGE_SIZE, filteredDosenRows.length);

  useEffect(() => {
    setDosenPage(1);
  }, [dosenQuery, dosenMode]);

  useEffect(() => {
    if (dosenPage > totalDosenPages) {
      setDosenPage(totalDosenPages);
    }
  }, [dosenPage, totalDosenPages]);

  useEffect(() => {
    if (dosenMode !== "list") {
      setSelectedDosen(null);
    }
  }, [dosenMode]);

  useLayoutEffect(() => {
    const cancelPendingRaf = () => {
      if (!Array.isArray(restoreRafRef.current)) return;
      restoreRafRef.current.forEach((id) => {
        if (typeof id === "number") {
          cancelAnimationFrame(id);
        }
      });
      restoreRafRef.current = [];
    };

    const restoreScroll = (element, snapshot) => {
      if (!element || snapshot === null || snapshot === undefined) return;
      const maxScrollTop = Math.max(0, element.scrollHeight - element.clientHeight);

      // Backward compatible: older snapshot stored as number ratio.
      if (typeof snapshot === "number") {
        element.scrollTop = maxScrollTop * Math.min(1, Math.max(0, snapshot));
        return;
      }

      if (snapshot?.atBottom) {
        element.scrollTop = maxScrollTop;
        return;
      }

      const ratio = Number(snapshot?.ratio);
      const safeRatio = Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : 0;
      element.scrollTop = maxScrollTop * safeRatio;
    };

    const scheduleRestore = (element, snapshot) => {
      if (!element) return;
      restoreScroll(element, snapshot);
      const raf1 = requestAnimationFrame(() => {
        restoreScroll(element, snapshot);
        const raf2 = requestAnimationFrame(() => {
          restoreScroll(element, snapshot);
        });
        restoreRafRef.current.push(raf2);
      });
      restoreRafRef.current.push(raf1);
    };

    cancelPendingRaf();

    if (preserveContentScrollTopRef.current !== null && contentScrollRef.current) {
      scheduleRestore(contentScrollRef.current, preserveContentScrollTopRef.current);
      preserveContentScrollTopRef.current = null;
    }

    if (preserveGridScrollTopRef.current !== null && dosenGridScrollRef.current) {
      scheduleRestore(dosenGridScrollRef.current, preserveGridScrollTopRef.current);
      preserveGridScrollTopRef.current = null;
    }

    return () => {
      cancelPendingRaf();
    };
  }, [dosenPage]);

  const goToDosenPage = (nextPage) => {
    const captureScroll = (element) => {
      if (!element) return null;
      const maxScrollTop = Math.max(0, element.scrollHeight - element.clientHeight);
      const scrollTop = element.scrollTop;
      const ratio = maxScrollTop > 0 ? scrollTop / maxScrollTop : 0;
      const atBottom = maxScrollTop > 0 ? maxScrollTop - scrollTop <= 24 : true;
      return { ratio, atBottom };
    };

    if (contentScrollRef.current) {
      preserveContentScrollTopRef.current = captureScroll(contentScrollRef.current);
    } else {
      preserveContentScrollTopRef.current = null;
    }

    if (dosenGridScrollRef.current) {
      preserveGridScrollTopRef.current = captureScroll(dosenGridScrollRef.current);
    } else {
      preserveGridScrollTopRef.current = null;
    }

    setDosenPage((prev) => {
      const target = typeof nextPage === "function" ? nextPage(prev) : nextPage;
      if (!Number.isFinite(target)) return prev;
      return Math.max(1, Math.min(totalDosenPages, target));
    });
  };

  const handleDownloadDosenExcel = async () => {
    setIsDownloadingDosen(true);
    setError("");

    try {
      const query = dosenQuery.trim() ? `?q=${encodeURIComponent(dosenQuery.trim())}` : "";
      const response = await fetch(`${apiBaseUrl}/api/admin/dosen/export${query}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
      });

      if (response.status === 401 || response.status === 403) {
        onSessionExpired?.();
        throw new Error("Sesi login berakhir. Silakan login ulang.");
      }

      if (!response.ok) {
        let failedPayload = null;
        try {
          failedPayload = await response.json();
        } catch (parseError) {
          failedPayload = null;
        }
        throw new Error(failedPayload?.message || "Gagal mengunduh data dosen.");
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = `data_dosen_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (downloadError) {
      setError(downloadError.message || "Terjadi kesalahan saat mengunduh data dosen.");
    } finally {
      setIsDownloadingDosen(false);
    }
  };

  const handleOpenDosenEdit = (dosen) => {
    const jabatanValue = JABATAN_STRUKTURAL_OPTIONS.includes(dosen?.jabatan_struktural)
      ? dosen.jabatan_struktural
      : "";
    setSelectedDosen(dosen);
    setDosenEditForm({
      gelar: dosen?.gelar || "",
      jabatan_struktural: jabatanValue,
      klaster_ids: Array.isArray(dosen?.klasters) ? dosen.klasters.map((item) => item.id) : [],
    });
    setDosenActionError("");
    setDosenActionMessage("");
  };

  const handleBackToDosenGrid = () => {
    setSelectedDosen(null);
    setDosenActionError("");
    setDosenActionMessage("");
    setDosenMode("list");
    setDosenPage(1);
    setDosenQuery("");
  };

  const toggleEditDosenKlaster = (klasterId) => {
    setDosenEditForm((prev) => {
      const exists = prev.klaster_ids.includes(klasterId);
      return {
        ...prev,
        klaster_ids: exists
          ? prev.klaster_ids.filter((id) => id !== klasterId)
          : [...prev.klaster_ids, klasterId],
      };
    });
  };

  const toggleCreateDosenKlaster = (klasterId) => {
    setCreateDosenForm((prev) => {
      const exists = prev.klaster_ids.includes(klasterId);
      return {
        ...prev,
        klaster_ids: exists
          ? prev.klaster_ids.filter((id) => id !== klasterId)
          : [...prev.klaster_ids, klasterId],
      };
    });
  };

  const resetCreateDosenForm = () => {
    setCreateDosenForm({
      nik: "",
      nama: "",
      gelar: "",
      email: "",
      jabatan_struktural: "",
      kuota_bimbingan: "5",
      klaster_ids: [],
    });
  };

  const handleCreateDosen = async (event) => {
    event.preventDefault();
    setCreateDosenError("");
    setCreateDosenMessage("");
    setCreatingDosen(true);

    try {
      const response = await fetch(`${apiBaseUrl}/api/admin/dosen`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nik: createDosenForm.nik.trim() || null,
          nama: createDosenForm.nama.trim(),
          gelar: createDosenForm.gelar.trim() || null,
          email: createDosenForm.email.trim().toLowerCase(),
          jabatan_struktural: createDosenForm.jabatan_struktural.trim() || null,
          kuota_bimbingan: createDosenForm.kuota_bimbingan,
          klaster_ids: createDosenForm.klaster_ids,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || "Gagal menambahkan dosen.");
      }

      const row = payload.data;
      const kuota = Number(row?.kuota_bimbingan || 0);
      const mapped = {
        id: row?.id,
        kode_dosen: row?.kode_dosen || "-",
        nik: row?.nik || null,
        nama: row?.nama || "-",
        gelar: row?.gelar || null,
        email: row?.email || "-",
        jabatan_struktural: row?.jabatan_struktural || null,
        kuota_bimbingan: kuota,
        jumlah_bimbingan: 0,
        sisa_kuota: kuota,
        klasters: Array.isArray(row?.klasters) ? row.klasters : [],
        createdAt: row?.createdAt,
        updatedAt: row?.updatedAt,
      };

      setDosenRows((prev) =>
        [...prev, mapped].sort((a, b) => String(a.nama || "").localeCompare(String(b.nama || ""), "id-ID"))
      );
      resetCreateDosenForm();
      setCreateDosenMessage("");
      setDosenMode("list");
      setDosenPage(1);
      showSuccessToast(payload.message || "Data dosen berhasil ditambahkan.");
    } catch (createError) {
      setCreateDosenError(createError.message || "Terjadi kesalahan saat menambah dosen.");
    } finally {
      setCreatingDosen(false);
    }
  };

  const handleSaveDosenEdit = async (event) => {
    event.preventDefault();
    if (!selectedDosen?.id) return;

    setDosenActionError("");
    setDosenActionMessage("");
    setSavingDosenEdit(true);

    try {
      const response = await fetch(`${apiBaseUrl}/api/admin/dosen/${selectedDosen.id}/profil`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${session.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          gelar: dosenEditForm.gelar,
          jabatan_struktural: dosenEditForm.jabatan_struktural,
          klaster_ids: dosenEditForm.klaster_ids,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || "Gagal memperbarui profil dosen.");
      }

      setDosenRows((prev) =>
        prev.map((item) =>
          item.id === selectedDosen.id
            ? {
                ...item,
                gelar: payload.data?.gelar ?? null,
                jabatan_struktural: payload.data?.jabatan_struktural ?? null,
                klasters: Array.isArray(payload.data?.klasters)
                  ? payload.data.klasters.map((item) => ({
                      id: item.id,
                      kode: item.kode,
                      nama: item.nama,
                    }))
                  : item.klasters || [],
                updatedAt: payload.data?.updatedAt ?? item.updatedAt,
              }
            : item
        )
      );

      setSelectedDosen((prev) =>
        prev
          ? {
              ...prev,
              gelar: payload.data?.gelar ?? null,
              jabatan_struktural: payload.data?.jabatan_struktural ?? null,
              updatedAt: payload.data?.updatedAt ?? prev.updatedAt,
            }
          : prev
      );

      setDosenActionMessage("");
      setSelectedDosen(null);
      showSuccessToast(payload.message || "Data dosen berhasil disimpan.");
    } catch (saveError) {
      setDosenActionError(saveError.message || "Terjadi kesalahan saat menyimpan.");
    } finally {
      setSavingDosenEdit(false);
    }
  };

  return (
    <div className="h-screen overflow-hidden bg-[#f2f3f7]">
      <header className="fixed inset-x-0 top-0 bg-[#2f63e3] text-white shadow-sm">
        <div className="flex w-full items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-[#f7d13d] p-1.5">
              <ShieldCheck className="h-7 w-7 text-[#1f3a84]" />
            </div>
            <div>
              <p className="text-sm font-black tracking-wide">SIMPS UII - ADMIN</p>
            </div>
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
            <p className="px-3 pb-2 pt-1 text-xs font-bold tracking-[0.08em] text-[#7d89a8] uppercase">Navigasi Admin</p>
            <div className="space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition ${
                      isActive ? "bg-[#2f63e3] text-white shadow-sm" : "text-[#405070] hover:bg-[#f2f6ff]"
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
              onClick={loadData}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#d3dbef] bg-white px-4 py-2 text-sm font-semibold text-[#2b3f74] transition hover:bg-[#f2f6ff]"
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh Data
            </button>
          </aside>

          <div
            ref={contentScrollRef}
            className="min-w-0 space-y-4 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{ msOverflowStyle: "none", overflowAnchor: "none" }}
          >
            <MenuSectionHeader
              icon={activeTabHeader.icon}
              title={activeTabHeader.title}
              subtitle={activeTabHeader.subtitle}
            />

            {error ? (
              <div className="rounded-xl border border-[#f6d7d7] bg-[#fff2f2] p-4 text-sm font-semibold text-[#a03f3f]">{error}</div>
            ) : null}

            {loading ? (
              <div className="rounded-xl bg-white p-6 shadow-sm">
                <p className="text-sm font-semibold text-[#55658f]">Memuat data admin...</p>
              </div>
            ) : null}

        {!loading && activeTab === "dashboard" ? (
          <div className="space-y-4">
            <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard title="Total Mahasiswa" value={summary.totalMahasiswa} subtitle="Data dari status mahasiswa" tone="border-[#d8e3ff] bg-[#edf3ff]" />
              <StatCard title="Total Pengajuan" value={summary.totalPengajuan} subtitle="Semua riwayat pengajuan" tone="border-[#dff3ec] bg-[#ecfaf5]" />
              <StatCard title="Pending Pengajuan" value={summary.pendingPengajuan} subtitle="Perlu tindak lanjut dosen" tone="border-[#ffe8c4] bg-[#fff7e8]" />
              <StatCard title="Approved Pengajuan" value={summary.approvedPengajuan} subtitle="Sudah disetujui" tone="border-[#dff3ec] bg-[#edfaf3]" />
            </section>
          </div>
        ) : null}

        {!loading && activeTab === "statistik" ? (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <DataTable
              title="Mahasiswa per Status"
              rows={summary.mahasiswaPerStatus}
              heightClass="h-[260px]"
              columns={[
                { key: "status_jalur_saat_ini", label: "Status Jalur" },
                { key: "count", label: "Jumlah", render: (row) => parseCount(row.count) },
              ]}
            />
            <DataTable
              title="Pengajuan per Status"
              rows={summary.pengajuanPerStatus}
              heightClass="h-[260px]"
              columns={[
                { key: "status", label: "Status Pengajuan" },
                { key: "count", label: "Jumlah", render: (row) => parseCount(row.count) },
              ]}
            />
            <DataTable
              title="Pengajuan per Jenis Jalur"
              rows={summary.pengajuanPerJenis}
              heightClass="h-[260px]"
              columns={[
                { key: "jenis_jalur", label: "Jenis Jalur" },
                { key: "count", label: "Jumlah", render: (row) => parseCount(row.count) },
              ]}
            />
            <DataTable
              title="Pengajuan per Tipe"
              rows={summary.pengajuanPerTipe}
              heightClass="h-[260px]"
              columns={[
                { key: "tipe_pengajuan", label: "Tipe Pengajuan" },
                { key: "count", label: "Jumlah", render: (row) => parseCount(row.count) },
              ]}
            />
          </div>
        ) : null}

        {!loading && activeTab === "upload-dosen" ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-[#dce4f7] bg-white p-3 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleBackToDosenGrid}
                    disabled={dosenMode === "list" && !selectedDosen}
                    title="Kembali ke grid data dosen"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#d3dbef] text-[#27407b] transition hover:bg-[#f3f6ff] disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Kembali ke grid data dosen"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={loadData}
                    className="inline-flex items-center gap-2 rounded-lg border border-[#d3dbef] px-3 py-2 text-sm font-semibold text-[#27407b] hover:bg-[#f3f6ff]"
                  >
                    <RefreshCcw className="h-4 w-4" />
                    Refresh
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDosen(null);
                      setDosenMode("add");
                      setDosenActionError("");
                      setDosenActionMessage("");
                    }}
                    className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                      dosenMode === "add"
                        ? "bg-[#2f63e3] text-white"
                        : "border border-[#d3dbef] text-[#27407b] hover:bg-[#f3f6ff]"
                    }`}
                  >
                    <Upload className="h-4 w-4" />
                    Add
                  </button>
                </div>

                {dosenMode === "list" ? (
                  <button
                    type="button"
                    onClick={handleDownloadDosenExcel}
                    disabled={isDownloadingDosen}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#0f7b50] px-4 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Download className="h-4 w-4" />
                    {isDownloadingDosen ? "Mengunduh..." : "Download Data Dosen"}
                  </button>
                ) : null}
              </div>
            </div>

            {dosenMode === "add" ? (
              <div className="space-y-4">
                <UploadPanel
                  title="Upload Data Dosen"
                  description="Alternatif input massal data dosen terbaru. Download template lalu upload kembali file yang sudah diisi."
                  templateUrl={templateDosenUrl}
                  endpoint="/api/admin/upload/dosen"
                  token={session.token}
                  apiBaseUrl={apiBaseUrl}
                  file={dosenFile}
                  setFile={setDosenFile}
                  uploadResult={uploadDosenResult}
                  setUploadResult={setUploadDosenResult}
                  isUploading={isUploadingDosen}
                  setIsUploading={setIsUploadingDosen}
                  onUploadSuccess={loadData}
                  extraNote="Format kolom: NIK, Nama, Gelar, Email, Jabatan Struktural, Klaster, Kuota Bimbingan. NIK boleh dikosongkan."
                />

                <div className="rounded-xl border border-[#e4e9f6] bg-white p-6 shadow-sm">
                  <h3 className="text-xl font-black text-[#1b274b]">Form Tambah Dosen</h3>
                  <p className="mt-1 text-sm text-[#5d6c91]">
                    Alternatif selain upload Excel. Isi satu per satu, lalu data akan langsung masuk ke grid manajemen dosen.
                  </p>

                  <form onSubmit={handleCreateDosen} className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-[#324c86]">NIK (opsional)</label>
                      <input
                        type="text"
                        value={createDosenForm.nik}
                        onChange={(event) =>
                          setCreateDosenForm((prev) => ({
                            ...prev,
                            nik: event.target.value.replace(/\D/g, "").slice(0, 9),
                          }))
                        }
                        placeholder="Contoh: 900000001"
                        className="w-full rounded-lg border border-[#d0dbf4] px-3 py-2 text-sm outline-none focus:border-[#2f63e3] focus:ring-2 focus:ring-[#2f63e3]/20"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-semibold text-[#324c86]">Kuota Bimbingan</label>
                      <input
                        type="number"
                        min={1}
                        value={createDosenForm.kuota_bimbingan}
                        onChange={(event) =>
                          setCreateDosenForm((prev) => ({
                            ...prev,
                            kuota_bimbingan: event.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-[#d0dbf4] px-3 py-2 text-sm outline-none focus:border-[#2f63e3] focus:ring-2 focus:ring-[#2f63e3]/20"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-semibold text-[#324c86]">Nama</label>
                      <input
                        type="text"
                        value={createDosenForm.nama}
                        onChange={(event) =>
                          setCreateDosenForm((prev) => ({
                            ...prev,
                            nama: event.target.value,
                          }))
                        }
                        placeholder="Nama dosen"
                        className="w-full rounded-lg border border-[#d0dbf4] px-3 py-2 text-sm outline-none focus:border-[#2f63e3] focus:ring-2 focus:ring-[#2f63e3]/20"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-semibold text-[#324c86]">Gelar</label>
                      <input
                        type="text"
                        value={createDosenForm.gelar}
                        onChange={(event) =>
                          setCreateDosenForm((prev) => ({
                            ...prev,
                            gelar: event.target.value,
                          }))
                        }
                        placeholder="Contoh: S.T., M.Kom."
                        className="w-full rounded-lg border border-[#d0dbf4] px-3 py-2 text-sm outline-none focus:border-[#2f63e3] focus:ring-2 focus:ring-[#2f63e3]/20"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-semibold text-[#324c86]">Email</label>
                      <input
                        type="email"
                        value={createDosenForm.email}
                        onChange={(event) =>
                          setCreateDosenForm((prev) => ({
                            ...prev,
                            email: event.target.value,
                          }))
                        }
                        placeholder="nama@uii.ac.id"
                        className="w-full rounded-lg border border-[#d0dbf4] px-3 py-2 text-sm outline-none focus:border-[#2f63e3] focus:ring-2 focus:ring-[#2f63e3]/20"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-semibold text-[#324c86]">Jabatan Struktural</label>
                      <select
                        value={createDosenForm.jabatan_struktural}
                        onChange={(event) =>
                          setCreateDosenForm((prev) => ({
                            ...prev,
                            jabatan_struktural: event.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-[#d0dbf4] px-3 py-2 text-sm outline-none focus:border-[#2f63e3] focus:ring-2 focus:ring-[#2f63e3]/20"
                      >
                        <option value="">Tidak memiliki jabatan struktural</option>
                        {JABATAN_STRUKTURAL_OPTIONS.map((option) => (
                          <option key={`jabatan-create-${option}`} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <p className="mb-2 text-sm font-semibold text-[#324c86]">Klaster Riset (boleh lebih dari satu)</p>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {klasterOptions.map((klaster) => {
                          const isChecked = createDosenForm.klaster_ids.includes(klaster.id);
                          return (
                            <label
                              key={`create-klaster-${klaster.id}`}
                              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                                isChecked
                                  ? "border-[#2f63e3] bg-[#edf3ff] text-[#1e3f99]"
                                  : "border-[#d8e0f3] bg-white text-[#2d3f6f]"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleCreateDosenKlaster(klaster.id)}
                                className="h-4 w-4"
                              />
                              <span>{klaster.kode} - {klaster.nama}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div className="md:col-span-2">
                      <button
                        type="submit"
                        disabled={creatingDosen}
                        className="inline-flex items-center gap-2 rounded-lg bg-[#1f5acc] px-4 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {creatingDosen ? "Menyimpan..." : "Tambah Dosen"}
                      </button>
                    </div>
                  </form>

                  {createDosenError ? (
                    <div className="mt-4 rounded-lg border border-[#f6d7d7] bg-[#fff2f2] px-3 py-2 text-sm font-semibold text-[#a03f3f]">
                      {createDosenError}
                    </div>
                  ) : null}
                  {createDosenMessage ? (
                    <div className="mt-4 rounded-lg border border-[#d2efdf] bg-[#effcf5] px-3 py-2 text-sm font-semibold text-[#1b7a49]">
                      {createDosenMessage}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <>
                {selectedDosen ? (
                  <div className="rounded-xl border border-[#e4e9f6] bg-white p-6 shadow-sm">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-xl font-black text-[#1b274b]">Edit Dosen</h3>
                        <p className="text-sm text-[#5d6c91]">
                          {selectedDosen.nama} ({selectedDosen.kode_dosen || selectedDosen.nik || "-"})
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleBackToDosenGrid}
                        className="inline-flex items-center gap-2 rounded-lg border border-[#d3dbef] px-3 py-2 text-sm font-semibold text-[#27407b] hover:bg-[#f3f6ff]"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        Kembali ke Grid
                      </button>
                    </div>

                    <form onSubmit={handleSaveDosenEdit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm font-semibold text-[#324c86]">Gelar</label>
                        <input
                          type="text"
                          value={dosenEditForm.gelar}
                          onChange={(event) =>
                            setDosenEditForm((prev) => ({
                              ...prev,
                              gelar: event.target.value,
                            }))
                          }
                          maxLength={120}
                          placeholder="Contoh: S.T., M.Kom."
                          className="w-full rounded-lg border border-[#d0dbf4] px-3 py-2 text-sm outline-none focus:border-[#2f63e3] focus:ring-2 focus:ring-[#2f63e3]/20"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-semibold text-[#324c86]">Jabatan Struktural</label>
                        <select
                          value={dosenEditForm.jabatan_struktural}
                          onChange={(event) =>
                            setDosenEditForm((prev) => ({
                              ...prev,
                              jabatan_struktural: event.target.value,
                            }))
                          }
                          className="w-full rounded-lg border border-[#d0dbf4] px-3 py-2 text-sm outline-none focus:border-[#2f63e3] focus:ring-2 focus:ring-[#2f63e3]/20"
                        >
                          <option value="">Tidak memiliki jabatan struktural</option>
                          {JABATAN_STRUKTURAL_OPTIONS.map((option) => (
                            <option key={`jabatan-edit-${option}`} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="md:col-span-2">
                        <p className="mb-2 text-sm font-semibold text-[#324c86]">Klaster Riset (boleh lebih dari satu)</p>
                        {klasterOptions.length === 0 ? (
                          <div className="rounded-lg border border-[#dbe3f7] bg-[#f8fbff] px-3 py-2 text-sm text-[#5a6b95]">
                            Data klaster belum tersedia.
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {klasterOptions.map((klaster) => {
                              const isChecked = dosenEditForm.klaster_ids.includes(klaster.id);
                              return (
                                <label
                                  key={`edit-klaster-${klaster.id}`}
                                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                                    isChecked
                                      ? "border-[#2f63e3] bg-[#edf3ff] text-[#1e3f99]"
                                      : "border-[#d8e0f3] bg-white text-[#2d3f6f]"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => toggleEditDosenKlaster(klaster.id)}
                                    className="h-4 w-4"
                                  />
                                  <span>
                                    {klaster.kode} - {klaster.nama}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div className="md:col-span-2">
                        <button
                          type="submit"
                          disabled={savingDosenEdit}
                          className="inline-flex items-center gap-2 rounded-lg bg-[#2f63e3] px-4 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {savingDosenEdit ? "Menyimpan..." : "Simpan Perubahan"}
                        </button>
                      </div>
                    </form>

                    {dosenActionError ? (
                      <div className="mt-4 rounded-lg border border-[#f6d7d7] bg-[#fff2f2] px-3 py-2 text-sm font-semibold text-[#a03f3f]">
                        {dosenActionError}
                      </div>
                    ) : null}
                    {dosenActionMessage ? (
                      <div className="mt-4 rounded-lg border border-[#d2efdf] bg-[#effcf5] px-3 py-2 text-sm font-semibold text-[#1b7a49]">
                        {dosenActionMessage}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <h3 className="text-lg font-black text-[#1b274b]">Grid Manajemen Dosen</h3>
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7282a8]" />
                          <input
                            type="text"
                            value={dosenQuery}
                            onChange={(event) => setDosenQuery(event.target.value)}
                            placeholder="Cari nama, kode, NIK, email, jabatan..."
                            className="w-[280px] rounded-lg border border-[#d3dbef] py-2 pl-8 pr-3 text-sm outline-none focus:border-[#2f63e3]"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={loadData}
                          className="inline-flex items-center gap-2 rounded-lg border border-[#d3dbef] px-3 py-2 text-sm font-semibold text-[#27407b] hover:bg-[#f3f6ff]"
                        >
                          <RefreshCcw className="h-4 w-4" />
                          Refresh
                        </button>
                      </div>
                    </div>

                    <div
                      ref={dosenGridScrollRef}
                      className="relative h-[560px] overflow-auto rounded-lg border border-[#e6ecf8]"
                      style={{ overflowAnchor: "none" }}
                    >
                      <table className="min-w-[1850px] text-left text-sm">
                        <thead>
                          <tr className="border-y border-[#e6ecf8] text-[#4d5e89]">
                            <th className="bg-[#f8fbff] px-3 py-2 font-semibold">No</th>
                            <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Kode Dosen</th>
                            <th className="bg-[#f8fbff] px-3 py-2 font-semibold">NIK</th>
                            <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Nama</th>
                            <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Gelar</th>
                            <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Email</th>
                            <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Jabatan Struktural</th>
                            <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Klaster</th>
                            <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Kuota</th>
                            <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Bimbingan</th>
                            <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Sisa</th>
                            <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Updated</th>
                            <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Aksi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredDosenRows.length > 0 ? (
                            pagedDosenRows.map((row, index) => (
                              <tr key={`dosen-row-${row.id}`} className="border-b border-[#eff3fb]">
                                <td className="px-3 py-2">{(dosenPage - 1) * DOSEN_PAGE_SIZE + index + 1}</td>
                                <td className="px-3 py-2 font-semibold text-[#254080]">{row.kode_dosen || "-"}</td>
                                <td className="px-3 py-2">{row.nik || "-"}</td>
                                <td className="px-3 py-2">{row.nama || "-"}</td>
                                <td className="px-3 py-2">{row.gelar || "-"}</td>
                                <td className="px-3 py-2">{row.email || "-"}</td>
                                <td className="px-3 py-2">{row.jabatan_struktural || "-"}</td>
                                <td className="px-3 py-2">
                                  {Array.isArray(row.klasters) && row.klasters.length > 0
                                    ? row.klasters.map((item) => item.kode).join(", ")
                                    : "-"}
                                </td>
                                <td className="px-3 py-2">{row.kuota_bimbingan ?? "-"}</td>
                                <td className="px-3 py-2">{row.jumlah_bimbingan ?? 0}</td>
                                <td className="px-3 py-2">{row.sisa_kuota ?? 0}</td>
                                <td className="px-3 py-2">{formatDateTime(row.updatedAt)}</td>
                                <td className="px-3 py-2">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenDosenEdit(row)}
                                    className="inline-flex items-center gap-1 rounded-md bg-[#2f63e3] px-3 py-1.5 text-xs font-bold text-white hover:brightness-110"
                                  >
                                    <PencilLine className="h-3.5 w-3.5" />
                                    Edit
                                  </button>
                                </td>
                              </tr>
                            ))
                          ) : null}
                        </tbody>
                      </table>
                      {filteredDosenRows.length === 0 ? (
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[41px] flex items-center justify-center px-4 text-center text-sm font-semibold text-[#7b88ab]">
                          Data dosen tidak ditemukan.
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#e8edf8] pt-3">
                      <p className="text-sm text-[#4f5e86]">
                        Menampilkan {dosenRangeStart} - {dosenRangeEnd} dari {filteredDosenRows.length} data dosen.
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => goToDosenPage((prev) => prev - 1)}
                          disabled={dosenPage === 1}
                          className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] transition hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Sebelumnya
                        </button>
                        <span className="text-sm font-semibold text-[#314778]">
                          Halaman {dosenPage} / {totalDosenPages}
                        </span>
                        <button
                          type="button"
                          onClick={() => goToDosenPage((prev) => prev + 1)}
                          disabled={dosenPage >= totalDosenPages}
                          className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] transition hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Berikutnya
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ) : null}

        {!loading && activeTab === "upload-mahasiswa" ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-[#dce4f7] bg-[#f8fbff] p-4 shadow-sm">
              <p className="text-sm font-semibold text-[#2b3f74]">
                Master data penjaluran mahasiswa dipindahkan ke role sekretaris prodi. Menu admin ini difokuskan untuk upload teknis data mahasiswa.
              </p>
            </div>
            <UploadPanel
              title="Upload Data Mahasiswa"
              description="Download template mahasiswa terlebih dahulu, isi sesuai format, lalu upload kembali file Excel."
              templateUrl={templateMahasiswaUrl}
              endpoint="/api/admin/upload/mahasiswa"
              token={session.token}
              apiBaseUrl={apiBaseUrl}
              file={mahasiswaFile}
              setFile={setMahasiswaFile}
              uploadResult={uploadMahasiswaResult}
              setUploadResult={setUploadMahasiswaResult}
              isUploading={isUploadingMahasiswa}
              setIsUploading={setIsUploadingMahasiswa}
              onUploadSuccess={loadData}
            />
          </div>
        ) : null}

            {!loading && activeTab === "pengajuan" ? (
              <DataTable
                title="Daftar Pengajuan"
                rows={pengajuanRows}
                columns={[
                  { key: "id", label: "ID" },
                  {
                    key: "mahasiswa",
                    label: "Mahasiswa",
                    render: (row) => `${row.mahasiswa?.nim || "-"} - ${row.mahasiswa?.nama || "-"}`,
                  },
                  { key: "jenis_jalur", label: "Jenis Jalur" },
                  { key: "tipe_pengajuan", label: "Tipe" },
                  { key: "status", label: "Status" },
                ]}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboardPage;

