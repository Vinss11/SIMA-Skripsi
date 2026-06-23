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
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
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

const DOSEN_PAGE_SIZE = 20;
const DOSEN_UPLOAD_PREVIEW_MAX_ROWS = 10;
const DOSEN_UPLOAD_PREVIEW_PAGE_SIZE = 5;
const DOSEN_FILTER_INITIAL = {
  jabatan_struktural: "",
  klaster: "",
  kuota_bimbingan: "",
  status_bimbingan: "",
  status_kuota: "",
};
const JABATAN_STRUKTURAL_OPTIONS = [
  "Ketua Jurusan Informatika",
  "Sekretaris Jurusan Informatika",
  "Ketua Program Studi Informatika - Program Sarjana",
  "Sekretaris Program Studi Informatika - Program Sarjana Reguler",
  "Sekretaris Program Studi Informatika - Program Sarjana International Program",
  "Ketua Program Studi Informatika - Program Sarjana Pendidikan Jarak Jauh",
  "Ketua Program Studi Informatika - Program Magister",
];
const DOSEN_MANAGEMENT_TABS = [
  { key: "data-dosen", label: "Data Dosen" },
  { key: "jabatan-struktural", label: "Jabatan Struktural" },
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

function formatAdminDosenOptionLabel(dosen) {
  if (!dosen) return "";
  const nama = String(dosen.nama || "").trim();
  const nik = String(dosen.nik || "").trim();
  if (nama && nik) return `${nama} - NIK: ${nik}`;
  if (nama) return nama;
  if (nik) return `NIK: ${nik}`;
  return "";
}

function getAdminDosenSearchHaystack(dosen) {
  return [dosen?.nama, dosen?.nik, dosen?.kode_dosen, dosen?.email]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function parseCount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sanitizeTwoDigitPositiveNumber(value) {
  return String(value || "")
    .replace(/\D/g, "")
    .slice(0, 2);
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
  heightClass = "grid-unified-height",
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
  uploadButtonLabel = "Upload File",
  previewMessage = "Preview hasil upload akan tampil di sini setelah file diproses.",
  previewHelpText = "Upload dapat berisi minimal 1 baris data.",
  successLabel = "Berhasil",
  failedLabel = "Gagal",
  successCountKey = "berhasil",
  failedCountKey = "gagal",
  extraNote,
  children,
}) {
  const [error, setError] = useState("");

  const handleFileChange = (event) => {
    const selectedFile = event.target.files?.[0] || null;
    setError("");
    setUploadResult(null);
    setFile(selectedFile);
  };

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
        if (data) {
          setUploadResult(data);
        }
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
    <div className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-black text-[#1b274b]">{title}</h3>
        <a
          href={templateUrl}
          className="inline-flex items-center gap-2 rounded-lg border border-[#b8e0cb] px-3 py-2 text-sm font-semibold text-[#0f7b50] hover:bg-[#effaf4]"
        >
          <Download className="h-4 w-4" />
          Download Template
        </a>
      </div>
      <p className="text-sm text-[#5d6c91]">{description}</p>
      {extraNote ? <p className="mt-2 text-xs font-semibold text-[#50608a]">{extraNote}</p> : null}

      <form onSubmit={handleUpload} className="mt-4 space-y-3">
        <input
          type="file"
          accept=".xls,.xlsx,.ods"
          onChange={handleFileChange}
          className="w-full rounded-lg border border-[#d3dbef] px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={isUploading}
          className="inline-flex items-center gap-2 rounded-lg bg-[#2f63e3] px-4 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Upload className="h-4 w-4" />
          {isUploading ? "Mengupload..." : uploadButtonLabel}
        </button>
      </form>

      {error ? <div className="mt-3 rounded-lg border border-[#f5d0d0] bg-[#fff2f2] px-3 py-2 text-sm font-semibold text-[#a33f3f]">{error}</div> : null}

      <div className="mt-4 rounded-lg border border-[#dce6f7] bg-[#f8fbff] p-4">
        <p className="text-sm font-bold text-[#1e2f57]">
          {uploadResult?.message || previewMessage}
        </p>
        <p className="mt-1 text-sm text-[#42527c]">
          {successLabel}: {uploadResult?.data?.[successCountKey] ?? 0} | {failedLabel}:{" "}
          {uploadResult?.data?.[failedCountKey] ?? 0}
        </p>
        {previewHelpText ? <p className="mt-1 text-xs text-[#5d6c91]">{previewHelpText}</p> : null}

        {children}
      </div>
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
  const [isSavingDosenImport, setIsSavingDosenImport] = useState(false);
  const [dosenUploadPreviewPage, setDosenUploadPreviewPage] = useState(1);
  const [dosenQuery, setDosenQuery] = useState("");
  const [dosenFilters, setDosenFilters] = useState({ ...DOSEN_FILTER_INITIAL });
  const [dosenFilterDraft, setDosenFilterDraft] = useState({ ...DOSEN_FILTER_INITIAL });
  const [showDosenFilterPanel, setShowDosenFilterPanel] = useState(false);
  const [dosenMode, setDosenMode] = useState("list");
  const [dosenManagementTab, setDosenManagementTab] = useState("data-dosen");
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
  const [isEditingJabatanStruktural, setIsEditingJabatanStruktural] = useState(false);
  const [jabatanDraft, setJabatanDraft] = useState({});
  const [jabatanSearchQueryByField, setJabatanSearchQueryByField] = useState({});
  const [activeJabatanSearchField, setActiveJabatanSearchField] = useState("");
  const [savingJabatanStruktural, setSavingJabatanStruktural] = useState(false);
  const [jabatanActionError, setJabatanActionError] = useState("");
  const sessionExpiredRef = useRef(false);
  const contentScrollRef = useRef(null);
  const dosenGridScrollRef = useRef(null);
  const dosenFilterRef = useRef(null);
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

  useEffect(() => {
    if (!showDosenFilterPanel) return undefined;

    const handleOutsideClick = (event) => {
      if (dosenFilterRef.current?.contains(event.target)) return;
      setShowDosenFilterPanel(false);
    };
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setShowDosenFilterPanel(false);
      }
    };

    window.addEventListener("mousedown", handleOutsideClick);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("mousedown", handleOutsideClick);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [showDosenFilterPanel]);

  useEffect(() => {
    if (dosenMode !== "list" || dosenManagementTab !== "data-dosen") {
      setShowDosenFilterPanel(false);
    }
  }, [dosenManagementTab, dosenMode]);

  const summary = useMemo(() => aggregateStatistics(statistics), [statistics]);
  const activeTabHeader = TAB_HEADERS[activeTab] || TAB_HEADERS.dashboard;
  const templateDosenUrl = `${apiBaseUrl}/api/admin/upload/dosen-template`;
  const templateMahasiswaUrl = `${apiBaseUrl}/api/admin/upload/mahasiswa-template`;

  const jabatanAssignments = useMemo(
    () =>
      JABATAN_STRUKTURAL_OPTIONS.map((jabatan) => {
        const dosen = dosenRows.find((row) => row.jabatan_struktural === jabatan) || null;
        return {
          jabatan,
          dosen,
          dosen_id: dosen?.id || null,
        };
      }),
    [dosenRows]
  );

  const jabatanDraftFromRows = useMemo(() => {
    const next = {};
    for (const item of jabatanAssignments) {
      next[item.jabatan] = item.dosen_id ? String(item.dosen_id) : "";
    }
    return next;
  }, [jabatanAssignments]);

  const jabatanSearchLabelsFromRows = useMemo(() => {
    const next = {};
    for (const item of jabatanAssignments) {
      next[item.jabatan] = formatAdminDosenOptionLabel(item.dosen);
    }
    return next;
  }, [jabatanAssignments]);

  useEffect(() => {
    if (!isEditingJabatanStruktural) {
      setJabatanDraft(jabatanDraftFromRows);
      setJabatanSearchQueryByField(jabatanSearchLabelsFromRows);
      setActiveJabatanSearchField("");
      setJabatanActionError("");
    }
  }, [isEditingJabatanStruktural, jabatanDraftFromRows, jabatanSearchLabelsFromRows]);

  const dosenFilterOptions = useMemo(() => {
    const jabatanSet = new Set();
    const klasterMap = new Map();
    const kuotaSet = new Set();
    let hasNoJabatan = false;
    let hasNoKlaster = false;

    for (const row of dosenRows) {
      const jabatan = String(row?.jabatan_struktural || "").trim();
      if (jabatan) {
        jabatanSet.add(jabatan);
      } else {
        hasNoJabatan = true;
      }

      if (Array.isArray(row?.klasters) && row.klasters.length > 0) {
        for (const klaster of row.klasters) {
          const kode = String(klaster?.kode || "").trim();
          if (!kode) continue;
          klasterMap.set(kode, {
            value: kode,
            label: klaster?.nama ? `${kode} - ${klaster.nama}` : kode,
          });
        }
      } else {
        hasNoKlaster = true;
      }

      const kuota = Number(row?.kuota_bimbingan);
      if (Number.isFinite(kuota) && kuota >= 0) {
        kuotaSet.add(kuota);
      }
    }

    return {
      jabatan_struktural: [
        ...(hasNoJabatan ? [{ value: "__none__", label: "Tanpa jabatan struktural" }] : []),
        ...Array.from(jabatanSet)
          .sort((a, b) => a.localeCompare(b, "id"))
          .map((value) => ({ value, label: value })),
      ],
      klaster: [
        ...(hasNoKlaster ? [{ value: "__none__", label: "Tanpa klaster" }] : []),
        ...Array.from(klasterMap.values()).sort((a, b) => a.label.localeCompare(b.label, "id")),
      ],
      kuota_bimbingan: Array.from(kuotaSet).sort((a, b) => a - b),
    };
  }, [dosenRows]);

  const filteredDosenRows = useMemo(() => {
    const keyword = dosenQuery.trim().toLowerCase();
    const selectedJabatan = String(dosenFilters.jabatan_struktural || "").trim();
    const selectedKlaster = String(dosenFilters.klaster || "").trim().toLowerCase();
    const selectedKuota = String(dosenFilters.kuota_bimbingan || "").trim();
    const selectedStatusBimbingan = String(dosenFilters.status_bimbingan || "").trim();
    const selectedStatusKuota = String(dosenFilters.status_kuota || "").trim();

    return dosenRows.filter((row) => {
      const jabatan = String(row?.jabatan_struktural || "").trim();
      if (
        selectedJabatan &&
        (selectedJabatan === "__none__" ? Boolean(jabatan) : jabatan !== selectedJabatan)
      ) {
        return false;
      }

      const klasterCodes = Array.isArray(row?.klasters)
        ? row.klasters.map((item) => String(item?.kode || "").trim().toLowerCase()).filter(Boolean)
        : [];
      if (
        selectedKlaster &&
        (selectedKlaster === "__none__"
          ? klasterCodes.length > 0
          : !klasterCodes.includes(selectedKlaster))
      ) {
        return false;
      }

      const kuota = Number(row?.kuota_bimbingan || 0);
      const jumlahBimbingan = Number(row?.jumlah_bimbingan || 0);
      const sisaKuota = Number(row?.sisa_kuota || 0);
      if (selectedKuota && String(kuota) !== selectedKuota) {
        return false;
      }
      if (
        selectedStatusBimbingan &&
        (selectedStatusBimbingan === "ada" ? jumlahBimbingan <= 0 : jumlahBimbingan > 0)
      ) {
        return false;
      }
      if (selectedStatusKuota === "tersedia" && !(kuota > 0 && sisaKuota > 0)) {
        return false;
      }
      if (selectedStatusKuota === "penuh" && !(kuota > 0 && sisaKuota <= 0)) {
        return false;
      }
      if (selectedStatusKuota === "belum_diatur" && kuota > 0) {
        return false;
      }

      if (!keyword) return true;

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
  }, [dosenFilters, dosenQuery, dosenRows]);

  const dosenActiveFilterChips = useMemo(() => {
    const chips = [];
    const jabatan = String(dosenFilters.jabatan_struktural || "").trim();
    const klaster = String(dosenFilters.klaster || "").trim();
    const kuota = String(dosenFilters.kuota_bimbingan || "").trim();
    const statusBimbingan = String(dosenFilters.status_bimbingan || "").trim();
    const statusKuota = String(dosenFilters.status_kuota || "").trim();

    if (jabatan) {
      chips.push({
        key: "jabatan_struktural",
        label: jabatan === "__none__" ? "Jabatan: Tidak ada" : `Jabatan: ${jabatan}`,
      });
    }
    if (klaster) {
      chips.push({
        key: "klaster",
        label: klaster === "__none__" ? "Klaster: Tidak ada" : `Klaster: ${klaster}`,
      });
    }
    if (kuota) {
      chips.push({ key: "kuota_bimbingan", label: `Kuota: ${kuota}` });
    }
    if (statusBimbingan) {
      chips.push({
        key: "status_bimbingan",
        label: statusBimbingan === "ada" ? "Bimbingan: Ada" : "Bimbingan: Belum ada",
      });
    }
    if (statusKuota) {
      const labelByStatus = {
        tersedia: "Tersedia",
        penuh: "Penuh",
        belum_diatur: "Belum diatur",
      };
      chips.push({ key: "status_kuota", label: `Status Kuota: ${labelByStatus[statusKuota]}` });
    }
    return chips;
  }, [dosenFilters]);
  const hasDosenActiveFilters = dosenActiveFilterChips.length > 0;
  const hasDosenDraftFilters = Object.values(dosenFilterDraft).some(
    (value) => String(value || "").trim().length > 0
  );
  const isDosenFilterDraftDirty = Object.keys(DOSEN_FILTER_INITIAL).some(
    (key) => String(dosenFilterDraft[key] || "").trim() !== String(dosenFilters[key] || "").trim()
  );

  const handleToggleDosenFilterPanel = () => {
    setShowDosenFilterPanel((prev) => {
      const next = !prev;
      if (next) {
        setDosenFilterDraft({ ...dosenFilters });
      }
      return next;
    });
  };

  const handleApplyDosenFilters = () => {
    setDosenFilters({ ...dosenFilterDraft });
    setShowDosenFilterPanel(false);
  };

  const handleResetDosenFilters = () => {
    setDosenFilters({ ...DOSEN_FILTER_INITIAL });
    setDosenFilterDraft({ ...DOSEN_FILTER_INITIAL });
    setShowDosenFilterPanel(false);
  };

  const dosenUploadValidRows = useMemo(() => {
    if (Array.isArray(uploadDosenResult?.data?.detail_valid)) {
      return uploadDosenResult.data.detail_valid;
    }
    return Array.isArray(uploadDosenResult?.data?.detail_berhasil)
      ? uploadDosenResult.data.detail_berhasil
      : [];
  }, [uploadDosenResult]);

  const dosenUploadPreviewRows = useMemo(() => {
    const successRows = dosenUploadValidRows;
    const failedRows = Array.isArray(uploadDosenResult?.data?.detail_gagal)
      ? uploadDosenResult.data.detail_gagal
      : [];

    const pickField = (row, keys) => {
      const source = row && typeof row === "object" ? row : {};
      for (const key of keys) {
        const value = source[key];
        if (value !== undefined && value !== null && String(value).trim()) {
          return String(value).trim();
        }
      }
      return "-";
    };

    const normalizedSuccess = successRows.map((item, index) => ({
      key: `dosen-upload-ok-${item?.row ?? index}-${item?.kode_dosen ?? index}`,
      nomor: index + 1,
      baris: item?.row ?? "-",
      nama: item?.nama || "-",
      email: item?.email || "-",
      nik: item?.nik || "-",
      klaster: item?.klaster || "-",
      kuota: item?.kuota_bimbingan ?? "-",
      status: "valid",
      pesan_error: "-",
    }));

    const normalizedFailed = failedRows.map((item, index) => {
      const raw = item?.data || {};
      return {
        key: `dosen-upload-err-${item?.row ?? index}-${index}`,
        nomor: normalizedSuccess.length + index + 1,
        baris: item?.row ?? "-",
        nama: pickField(raw, ["Nama", "nama", "NAMA"]),
        email: pickField(raw, ["Email", "email", "EMAIL"]),
        nik: pickField(raw, ["NIK", "Nik", "nik", "Nip"]),
        klaster: pickField(raw, ["Klaster", "klaster", "KLASTER", "Cluster", "cluster", "CLUSTER"]),
        kuota: pickField(raw, ["Kuota Bimbingan", "kuota_bimbingan", "KUOTA_BIMBINGAN"]),
        status: "error",
        pesan_error: String(item?.error || "Data tidak valid."),
      };
    });

    return [...normalizedSuccess, ...normalizedFailed];
  }, [dosenUploadValidRows, uploadDosenResult]);

  const dosenUploadPreviewRowsLimited = useMemo(
    () => dosenUploadPreviewRows.slice(0, DOSEN_UPLOAD_PREVIEW_MAX_ROWS),
    [dosenUploadPreviewRows]
  );

  const dosenUploadPreviewTotalPages = useMemo(
    () => Math.max(1, Math.ceil(dosenUploadPreviewRowsLimited.length / DOSEN_UPLOAD_PREVIEW_PAGE_SIZE)),
    [dosenUploadPreviewRowsLimited.length]
  );

  const dosenUploadPreviewRowsPaged = useMemo(() => {
    const start = (dosenUploadPreviewPage - 1) * DOSEN_UPLOAD_PREVIEW_PAGE_SIZE;
    return dosenUploadPreviewRowsLimited.slice(start, start + DOSEN_UPLOAD_PREVIEW_PAGE_SIZE);
  }, [dosenUploadPreviewPage, dosenUploadPreviewRowsLimited]);

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
  }, [dosenFilters, dosenQuery, dosenMode]);

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

  useEffect(() => {
    setDosenUploadPreviewPage(1);
  }, [uploadDosenResult]);

  useEffect(() => {
    if (dosenUploadPreviewPage > dosenUploadPreviewTotalPages) {
      setDosenUploadPreviewPage(dosenUploadPreviewTotalPages);
    }
  }, [dosenUploadPreviewPage, dosenUploadPreviewTotalPages]);

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

  const handleSaveDosenImport = async () => {
    setError("");

    if (dosenUploadValidRows.length === 0) {
      setError("Tidak ada data valid untuk disimpan.");
      return;
    }

    try {
      setIsSavingDosenImport(true);
      const response = await fetch(`${apiBaseUrl}/api/admin/upload/dosen/commit`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ rows: dosenUploadValidRows }),
      });

      const payload = await response.json().catch(() => null);
      if (response.status === 401 || response.status === 403) {
        onSessionExpired?.();
        throw new Error("Sesi login berakhir. Silakan login ulang.");
      }

      if (!response.ok || !payload?.success) {
        if (payload) {
          setUploadDosenResult(payload);
        }
        throw new Error(payload?.message || "Gagal menyimpan data dosen hasil preview.");
      }

      setUploadDosenResult(payload);
      setDosenFile(null);
      await loadData();
      setDosenMode("list");
      showSuccessToast(payload.message || "Data dosen hasil import berhasil disimpan.");
    } catch (saveError) {
      setError(saveError.message || "Terjadi kesalahan saat menyimpan import dosen.");
    } finally {
      setIsSavingDosenImport(false);
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

  const findDosenByDraftValue = (selectedValue) => {
    const normalizedValue = String(selectedValue || "").trim();
    if (!normalizedValue) return null;
    return dosenRows.find((dosen) => String(dosen.id) === normalizedValue) || null;
  };

  const handleJabatanSearchQueryChange = (jabatan, value) => {
    setJabatanSearchQueryByField((prev) => ({ ...prev, [jabatan]: value }));
    setJabatanDraft((prev) => {
      const selectedDosen = findDosenByDraftValue(prev?.[jabatan]);
      if (!selectedDosen) return prev;

      const selectedLabel = formatAdminDosenOptionLabel(selectedDosen);
      if (String(value).trim().toLowerCase() === selectedLabel.trim().toLowerCase()) {
        return prev;
      }

      return { ...prev, [jabatan]: "" };
    });
  };

  const handleJabatanSearchBlur = (jabatan) => {
    window.setTimeout(() => {
      setActiveJabatanSearchField((prev) => (prev === jabatan ? "" : prev));
    }, 120);
  };

  const handleSelectJabatanDosen = (jabatan, dosen) => {
    setJabatanDraft((prev) => ({ ...prev, [jabatan]: String(dosen.id) }));
    setJabatanSearchQueryByField((prev) => ({
      ...prev,
      [jabatan]: formatAdminDosenOptionLabel(dosen),
    }));
    setActiveJabatanSearchField("");
  };

  const handleClearJabatanDosen = (jabatan) => {
    setJabatanDraft((prev) => ({ ...prev, [jabatan]: "" }));
    setJabatanSearchQueryByField((prev) => ({ ...prev, [jabatan]: "" }));
    setActiveJabatanSearchField("");
  };

  const handleStartEditJabatanStruktural = () => {
    setJabatanDraft(jabatanDraftFromRows);
    setJabatanSearchQueryByField(jabatanSearchLabelsFromRows);
    setActiveJabatanSearchField("");
    setJabatanActionError("");
    setIsEditingJabatanStruktural(true);
  };

  const handleCancelEditJabatanStruktural = () => {
    setJabatanDraft(jabatanDraftFromRows);
    setJabatanSearchQueryByField(jabatanSearchLabelsFromRows);
    setActiveJabatanSearchField("");
    setJabatanActionError("");
    setIsEditingJabatanStruktural(false);
  };

  const handleSaveJabatanStruktural = async () => {
    setJabatanActionError("");

    const usedDosenIds = new Map();
    for (const jabatan of JABATAN_STRUKTURAL_OPTIONS) {
      const dosenId = Number(jabatanDraft[jabatan] || 0);
      if (!dosenId) continue;

      if (usedDosenIds.has(dosenId)) {
        const dosen = dosenRows.find((row) => Number(row.id) === dosenId);
        setJabatanActionError(
          `${dosen?.nama || "Dosen"} dipilih untuk lebih dari satu jabatan. Satu dosen hanya boleh memiliki satu jabatan struktural.`
        );
        return;
      }
      usedDosenIds.set(dosenId, jabatan);
    }

    const confirmation = await Swal.fire({
      title: "Simpan jabatan struktural?",
      text: "Perubahan ini akan menentukan akses khusus seperti menu Sekprodi untuk dosen yang menjabat.",
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#2f63e3",
      cancelButtonColor: "#8b96b2",
      confirmButtonText: "Simpan",
      cancelButtonText: "Batal",
    });

    if (!confirmation.isConfirmed) return;

    setSavingJabatanStruktural(true);
    try {
      const assignments = {};
      for (const jabatan of JABATAN_STRUKTURAL_OPTIONS) {
        const dosenId = Number(jabatanDraft[jabatan] || 0);
        assignments[jabatan] = dosenId || null;
      }

      const response = await fetch(`${apiBaseUrl}/api/admin/dosen/jabatan-struktural`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${session.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ assignments }),
      });

      const payload = await response.json().catch(() => null);
      if (response.status === 401 || response.status === 403) {
        onSessionExpired?.();
        throw new Error("Sesi login berakhir. Silakan login ulang.");
      }
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || "Gagal menyimpan jabatan struktural.");
      }

      if (Array.isArray(payload.data?.rows)) {
        setDosenRows(payload.data.rows);
      } else {
        await loadData();
      }
      setIsEditingJabatanStruktural(false);
      showSuccessToast(payload.message || "Jabatan struktural berhasil disimpan.");
    } catch (saveError) {
      setJabatanActionError(saveError.message || "Terjadi kesalahan saat menyimpan jabatan struktural.");
    } finally {
      setSavingJabatanStruktural(false);
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
              heightClass="grid-unified-height"
              columns={[
                { key: "status_jalur_saat_ini", label: "Status Jalur" },
                { key: "count", label: "Jumlah", render: (row) => parseCount(row.count) },
              ]}
            />
            <DataTable
              title="Pengajuan per Status"
              rows={summary.pengajuanPerStatus}
              heightClass="grid-unified-height"
              columns={[
                { key: "status", label: "Status Pengajuan" },
                { key: "count", label: "Jumlah", render: (row) => parseCount(row.count) },
              ]}
            />
            <DataTable
              title="Pengajuan per Jenis Jalur"
              rows={summary.pengajuanPerJenis}
              heightClass="grid-unified-height"
              columns={[
                { key: "jenis_jalur", label: "Jenis Jalur" },
                { key: "count", label: "Jumlah", render: (row) => parseCount(row.count) },
              ]}
            />
            <DataTable
              title="Pengajuan per Tipe"
              rows={summary.pengajuanPerTipe}
              heightClass="grid-unified-height"
              columns={[
                { key: "tipe_pengajuan", label: "Tipe Pengajuan" },
                { key: "count", label: "Jumlah", render: (row) => parseCount(row.count) },
              ]}
            />
          </div>
        ) : null}

        {!loading && activeTab === "upload-dosen" ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-[#dce4f7] bg-white p-4 shadow-sm">
              <p className="text-lg font-black text-[#1b274b]">Menu Manajemen Dosen</p>
              <p className="mt-1 text-sm text-[#5d6c91]">
                Kelola data dosen dan penugasan jabatan struktural dari satu halaman.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {DOSEN_MANAGEMENT_TABS.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setDosenManagementTab(item.key);
                      setSelectedDosen(null);
                      setDosenActionError("");
                      setDosenActionMessage("");
                      if (item.key !== "data-dosen") {
                        setDosenMode("list");
                      }
                    }}
                    className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                      dosenManagementTab === item.key
                        ? "bg-[#2f63e3] text-white shadow-sm"
                        : "border border-[#d4def4] bg-white text-[#27407b] hover:bg-[#f4f7ff]"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {dosenManagementTab === "data-dosen" ? (
              <>
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
                      setUploadDosenResult(null);
                    }}
                    className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                      dosenMode === "add"
                        ? "bg-[#2f63e3] text-white"
                        : "border border-[#d3dbef] text-[#27407b] hover:bg-[#f3f6ff]"
                    }`}
                  >
                    <Plus className="h-4 w-4" />
                    Add
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDosen(null);
                      setDosenMode("import");
                      setDosenActionError("");
                      setDosenActionMessage("");
                    }}
                    className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                      dosenMode === "import"
                        ? "bg-[#2f63e3] text-white"
                        : "border border-[#d3dbef] text-[#27407b] hover:bg-[#f3f6ff]"
                    }`}
                  >
                    <Upload className="h-4 w-4" />
                    Import
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

            {dosenMode === "import" ? (
              <div className="space-y-4">
                <UploadPanel
                  title="Upload Dosen via Excel"
                  description="Gunakan template dosen. Isi sheet Template Dosen minimal 1 baris data."
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
                  onUploadSuccess={() => setDosenUploadPreviewPage(1)}
                  uploadButtonLabel="Preview Data"
                  previewMessage="Preview dosen akan tampil di sini setelah upload template."
                  previewHelpText={`Preview menampilkan maksimal ${DOSEN_UPLOAD_PREVIEW_MAX_ROWS} data (5 data per halaman).`}
                  successLabel="Valid"
                  failedLabel="Tidak valid"
                  successCountKey="valid"
                  failedCountKey="invalid"
                  extraNote="Isi sheet Template Dosen minimal 1 baris. Sheet Contoh Pengisian hanya referensi dan tidak perlu di-upload sebagai data."
                >
                  <div className="mt-4 overflow-hidden rounded-lg border border-[#d6e0f5] bg-white">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[1200px] table-auto">
                        <thead className="bg-[#f4f7ff] text-left text-sm font-bold text-[#2f4473]">
                          <tr>
                          <th className="px-3 py-2 font-semibold">No</th>
                          <th className="px-3 py-2 font-semibold">Baris</th>
                          <th className="px-3 py-2 font-semibold">Nama</th>
                          <th className="px-3 py-2 font-semibold">Email</th>
                          <th className="px-3 py-2 font-semibold">NIK</th>
                          <th className="px-3 py-2 font-semibold">Klaster</th>
                          <th className="px-3 py-2 font-semibold">Kuota</th>
                          <th className="px-3 py-2 font-semibold">Status</th>
                          <th className="px-3 py-2 font-semibold">Pesan Error</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dosenUploadPreviewRowsPaged.length > 0 ? (
                          dosenUploadPreviewRowsPaged.map((row) => (
                            <tr
                              key={row.key}
                              className={`border-t border-[#ecf1fb] text-sm text-[#23345d] ${
                                row.status === "error" ? "bg-[#fff8f8]" : "bg-white"
                              }`}
                            >
                              <td className="px-3 py-2">{row.nomor}</td>
                              <td className="px-3 py-2">{row.baris}</td>
                              <td className="px-3 py-2">{row.nama}</td>
                              <td className="px-3 py-2">{row.email}</td>
                              <td className="px-3 py-2">{row.nik}</td>
                              <td className="px-3 py-2">{row.klaster}</td>
                              <td className="px-3 py-2">{row.kuota}</td>
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
                            <td className="px-3 py-4 text-center" colSpan={9}>
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
                      Menampilkan{" "}
                      {dosenUploadPreviewRowsLimited.length === 0
                        ? 0
                        : (dosenUploadPreviewPage - 1) * DOSEN_UPLOAD_PREVIEW_PAGE_SIZE + 1}{" "}
                      -{" "}
                      {Math.min(
                        dosenUploadPreviewPage * DOSEN_UPLOAD_PREVIEW_PAGE_SIZE,
                        dosenUploadPreviewRowsLimited.length
                      )}{" "}
                      dari {dosenUploadPreviewRowsLimited.length} data preview.
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setDosenUploadPreviewPage((prev) => Math.max(1, prev - 1))}
                        disabled={dosenUploadPreviewPage <= 1}
                        className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-xs font-semibold text-[#314778] transition hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Sebelumnya
                      </button>
                      <span className="text-xs font-semibold text-[#314778]">
                        Halaman {dosenUploadPreviewPage} / {dosenUploadPreviewTotalPages}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setDosenUploadPreviewPage((prev) => Math.min(dosenUploadPreviewTotalPages, prev + 1))
                        }
                        disabled={dosenUploadPreviewPage >= dosenUploadPreviewTotalPages}
                        className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-xs font-semibold text-[#314778] transition hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Berikutnya
                      </button>
                    </div>
                  </div>
                </UploadPanel>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#dce6f7] bg-white p-4 shadow-sm">
                  <p className="text-sm font-semibold text-[#314778]">
                    Data valid baru akan masuk database setelah tombol simpan ditekan.
                  </p>
                  <button
                    type="button"
                    onClick={handleSaveDosenImport}
                    disabled={isSavingDosenImport || dosenUploadValidRows.length === 0}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#0f7b50] px-4 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSavingDosenImport ? "Menyimpan..." : `Simpan ${dosenUploadValidRows.length} Data Valid`}
                  </button>
                </div>
              </div>
            ) : dosenMode === "add" ? (
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
                        type="text"
                        inputMode="numeric"
                        maxLength={2}
                        value={createDosenForm.kuota_bimbingan}
                        onChange={(event) =>
                          setCreateDosenForm((prev) => ({
                            ...prev,
                            kuota_bimbingan: sanitizeTwoDigitPositiveNumber(event.target.value),
                          }))
                        }
                        placeholder="Masukkan kuota bimbingan"
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
                      <div className="flex flex-wrap items-center gap-2">
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
                        <div className="relative" ref={dosenFilterRef}>
                          <button
                            type="button"
                            onClick={handleToggleDosenFilterPanel}
                            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                              showDosenFilterPanel || hasDosenActiveFilters
                                ? "border-[#2f63e3] bg-[#eef3ff] text-[#2348a5]"
                                : "border-[#d3dbef] text-[#27407b] hover:bg-[#f3f6ff]"
                            }`}
                          >
                            <SlidersHorizontal className="h-4 w-4" />
                            Filter
                            {hasDosenActiveFilters ? (
                              <span className="rounded-full bg-[#2f63e3] px-1.5 py-0.5 text-xs font-bold leading-none text-white">
                                {dosenActiveFilterChips.length}
                              </span>
                            ) : null}
                          </button>

                          {showDosenFilterPanel ? (
                            <div className="absolute right-0 top-[calc(100%+8px)] z-50 flex max-h-[620px] w-[430px] max-w-[calc(100vw-32px)] flex-col rounded-xl border border-[#dbe5f8] bg-white shadow-xl">
                              <div className="border-b border-[#e5ecf9] px-4 py-3">
                                <p className="text-base font-bold text-[#1e315f]">Filter Data Dosen</p>
                                <p className="text-xs text-[#60709a]">
                                  Atur filter bertumpuk, lalu klik Terapkan.
                                </p>
                              </div>

                              <div className="space-y-3 overflow-auto p-3">
                                <div className="rounded-lg border border-[#e6ecf8] p-3">
                                  <div className="mb-2 flex items-center justify-between">
                                    <p className="text-sm font-semibold text-[#2a4175]">Jabatan Struktural</p>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setDosenFilterDraft((prev) => ({ ...prev, jabatan_struktural: "" }))
                                      }
                                      className="text-xs font-semibold text-[#2f63e3] hover:underline"
                                    >
                                      Reset
                                    </button>
                                  </div>
                                  <select
                                    value={dosenFilterDraft.jabatan_struktural}
                                    onChange={(event) =>
                                      setDosenFilterDraft((prev) => ({
                                        ...prev,
                                        jabatan_struktural: event.target.value,
                                      }))
                                    }
                                    className="w-full rounded-lg border border-[#d3dbef] px-3 py-2 text-sm text-[#23396b] outline-none focus:border-[#2f63e3]"
                                  >
                                    <option value="">Semua jabatan struktural</option>
                                    {dosenFilterOptions.jabatan_struktural.map((item) => (
                                      <option key={`filter-jabatan-${item.value}`} value={item.value}>
                                        {item.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <div className="rounded-lg border border-[#e6ecf8] p-3">
                                  <div className="mb-2 flex items-center justify-between">
                                    <p className="text-sm font-semibold text-[#2a4175]">Klaster</p>
                                    <button
                                      type="button"
                                      onClick={() => setDosenFilterDraft((prev) => ({ ...prev, klaster: "" }))}
                                      className="text-xs font-semibold text-[#2f63e3] hover:underline"
                                    >
                                      Reset
                                    </button>
                                  </div>
                                  <select
                                    value={dosenFilterDraft.klaster}
                                    onChange={(event) =>
                                      setDosenFilterDraft((prev) => ({ ...prev, klaster: event.target.value }))
                                    }
                                    className="w-full rounded-lg border border-[#d3dbef] px-3 py-2 text-sm text-[#23396b] outline-none focus:border-[#2f63e3]"
                                  >
                                    <option value="">Semua klaster</option>
                                    {dosenFilterOptions.klaster.map((item) => (
                                      <option key={`filter-klaster-${item.value}`} value={item.value}>
                                        {item.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <div className="rounded-lg border border-[#e6ecf8] p-3">
                                  <div className="mb-2 flex items-center justify-between">
                                    <p className="text-sm font-semibold text-[#2a4175]">Kuota Bimbingan</p>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setDosenFilterDraft((prev) => ({ ...prev, kuota_bimbingan: "" }))
                                      }
                                      className="text-xs font-semibold text-[#2f63e3] hover:underline"
                                    >
                                      Reset
                                    </button>
                                  </div>
                                  <select
                                    value={dosenFilterDraft.kuota_bimbingan}
                                    onChange={(event) =>
                                      setDosenFilterDraft((prev) => ({
                                        ...prev,
                                        kuota_bimbingan: event.target.value,
                                      }))
                                    }
                                    className="w-full rounded-lg border border-[#d3dbef] px-3 py-2 text-sm text-[#23396b] outline-none focus:border-[#2f63e3]"
                                  >
                                    <option value="">Semua kuota bimbingan</option>
                                    {dosenFilterOptions.kuota_bimbingan.map((item) => (
                                      <option key={`filter-kuota-${item}`} value={String(item)}>
                                        Kuota {item}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <div className="rounded-lg border border-[#e6ecf8] p-3">
                                  <div className="mb-2 flex items-center justify-between">
                                    <p className="text-sm font-semibold text-[#2a4175]">Status Bimbingan</p>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setDosenFilterDraft((prev) => ({ ...prev, status_bimbingan: "" }))
                                      }
                                      className="text-xs font-semibold text-[#2f63e3] hover:underline"
                                    >
                                      Reset
                                    </button>
                                  </div>
                                  <select
                                    value={dosenFilterDraft.status_bimbingan}
                                    onChange={(event) =>
                                      setDosenFilterDraft((prev) => ({
                                        ...prev,
                                        status_bimbingan: event.target.value,
                                      }))
                                    }
                                    className="w-full rounded-lg border border-[#d3dbef] px-3 py-2 text-sm text-[#23396b] outline-none focus:border-[#2f63e3]"
                                  >
                                    <option value="">Semua status bimbingan</option>
                                    <option value="ada">Memiliki mahasiswa bimbingan</option>
                                    <option value="belum">Belum memiliki mahasiswa bimbingan</option>
                                  </select>
                                </div>

                                <div className="rounded-lg border border-[#e6ecf8] p-3">
                                  <div className="mb-2 flex items-center justify-between">
                                    <p className="text-sm font-semibold text-[#2a4175]">
                                      Status Ketersediaan Kuota
                                    </p>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setDosenFilterDraft((prev) => ({ ...prev, status_kuota: "" }))
                                      }
                                      className="text-xs font-semibold text-[#2f63e3] hover:underline"
                                    >
                                      Reset
                                    </button>
                                  </div>
                                  <select
                                    value={dosenFilterDraft.status_kuota}
                                    onChange={(event) =>
                                      setDosenFilterDraft((prev) => ({
                                        ...prev,
                                        status_kuota: event.target.value,
                                      }))
                                    }
                                    className="w-full rounded-lg border border-[#d3dbef] px-3 py-2 text-sm text-[#23396b] outline-none focus:border-[#2f63e3]"
                                  >
                                    <option value="">Semua status kuota</option>
                                    <option value="tersedia">Kuota masih tersedia</option>
                                    <option value="penuh">Kuota penuh</option>
                                    <option value="belum_diatur">Kuota belum diatur</option>
                                  </select>
                                </div>
                              </div>

                              <div className="flex items-center justify-between gap-2 border-t border-[#e5ecf9] px-3 py-3">
                                <button
                                  type="button"
                                  onClick={() => setDosenFilterDraft({ ...DOSEN_FILTER_INITIAL })}
                                  disabled={!hasDosenDraftFilters}
                                  className="rounded-lg border border-[#d3dbef] px-3 py-2 text-sm font-semibold text-[#27407b] hover:bg-[#f3f6ff] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  Reset all
                                </button>
                                <button
                                  type="button"
                                  onClick={handleApplyDosenFilters}
                                  disabled={!isDosenFilterDraftDirty}
                                  className="rounded-lg bg-[#2f63e3] px-3 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  Terapkan
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={handleResetDosenFilters}
                          disabled={!hasDosenActiveFilters}
                          className="rounded-lg border border-[#d3dbef] px-3 py-2 text-sm font-semibold text-[#27407b] hover:bg-[#f3f6ff] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Reset
                        </button>
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
                      className="relative overflow-auto rounded-lg border border-[#e6ecf8] grid-unified-height"
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
              </>
            ) : null}

            {dosenManagementTab === "jabatan-struktural" ? (
              <div className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                <div>
                  <h3 className="text-lg font-black text-[#1b274b]">Master Data Jabatan Struktural</h3>
                  <p className="mt-1 text-sm text-[#5d6c91]">
                    Atur dosen pemegang jabatan struktural. Satu jabatan hanya boleh diisi satu dosen, dan satu dosen
                    hanya boleh memegang satu jabatan struktural.
                  </p>
                </div>

                {jabatanActionError ? (
                  <div className="mt-3 rounded-lg border border-[#f6d7d7] bg-[#fff2f2] px-3 py-2 text-sm font-semibold text-[#a03f3f]">
                    {jabatanActionError}
                  </div>
                ) : null}

                <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {jabatanAssignments.map((item) => {
                    const selectedValue = jabatanDraft[item.jabatan] || "";
                    const selectedDosen = selectedValue
                      ? dosenRows.find((row) => Number(row.id) === Number(selectedValue))
                      : isEditingJabatanStruktural
                        ? null
                        : item.dosen;
                    const selectedDosenLabel = formatAdminDosenOptionLabel(selectedDosen);
                    const selectedLabel = selectedDosenLabel || "Belum ditugaskan";
                    const searchValue = String(jabatanSearchQueryByField[item.jabatan] ?? "");
                    const inputValue = searchValue || selectedDosenLabel;
                    const normalizedSearch = searchValue.trim().toLowerCase();
                    const shouldShowResults =
                      activeJabatanSearchField === item.jabatan &&
                      normalizedSearch.length > 0 &&
                      normalizedSearch !== selectedDosenLabel.trim().toLowerCase();
                    const selectedInOtherRole = new Set(
                      Object.entries(jabatanDraft)
                        .filter(([jabatan]) => jabatan !== item.jabatan)
                        .map(([, value]) => Number(value || 0))
                        .filter((value) => Number.isInteger(value) && value > 0)
                    );
                    const candidateRows = dosenRows
                      .filter((dosen) => {
                        if (!normalizedSearch) return true;
                        return getAdminDosenSearchHaystack(dosen).includes(normalizedSearch);
                      })
                      .slice(0, 8);

                    return (
                      <div key={`jabatan-card-${item.jabatan}`} className="rounded-lg border border-[#dfe7f7] bg-[#f8fbff] p-3">
                        <label className="mb-2 block text-sm font-bold text-[#24427c]">{item.jabatan}</label>
                        {isEditingJabatanStruktural ? (
                          <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7282a8]" />
                            <input
                              type="text"
                              value={inputValue}
                              onFocus={() => setActiveJabatanSearchField(item.jabatan)}
                              onBlur={() => handleJabatanSearchBlur(item.jabatan)}
                              onChange={(event) => handleJabatanSearchQueryChange(item.jabatan, event.target.value)}
                              placeholder="Cari nama, NIK, kode, atau email dosen"
                              className={`w-full rounded-lg border border-[#cdd8f0] bg-white py-2 pl-9 text-sm text-[#25395f] outline-none focus:border-[#2f63e3] focus:ring-2 focus:ring-[#2f63e3]/20 ${
                                selectedValue ? "pr-24" : "pr-3"
                              }`}
                            />
                            {selectedValue ? (
                              <button
                                type="button"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => handleClearJabatanDosen(item.jabatan)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-[#d7e0f4] bg-[#f8fbff] px-2 py-1 text-xs font-bold text-[#53658f] hover:bg-white"
                              >
                                Kosongkan
                              </button>
                            ) : null}

                            {shouldShowResults ? (
                              <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 max-h-56 overflow-auto rounded-lg border border-[#d9e3fb] bg-white shadow-lg">
                                <button
                                  type="button"
                                  onMouseDown={(event) => event.preventDefault()}
                                  onClick={() => handleClearJabatanDosen(item.jabatan)}
                                  className="flex w-full items-center justify-between border-b border-[#edf1fb] px-3 py-2 text-left text-sm text-[#213460] hover:bg-[#f4f7ff]"
                                >
                                  <span className="font-semibold">Belum ditugaskan</span>
                                  <span className="text-xs text-[#7282a8]">Kosongkan jabatan</span>
                                </button>
                                {candidateRows.length > 0 ? (
                                  candidateRows.map((dosen) => {
                                    const isDisabledRow = selectedInOtherRole.has(Number(dosen.id));
                                    return (
                                      <button
                                        key={`jabatan-combobox-${item.jabatan}-${dosen.id}`}
                                        type="button"
                                        onMouseDown={(event) => event.preventDefault()}
                                        onClick={() => {
                                          if (isDisabledRow) return;
                                          handleSelectJabatanDosen(item.jabatan, dosen);
                                        }}
                                        disabled={isDisabledRow}
                                        className={`flex w-full items-center justify-between gap-3 border-b border-[#edf1fb] px-3 py-2 text-left text-sm last:border-b-0 ${
                                          isDisabledRow
                                            ? "cursor-not-allowed bg-[#f8fafc] text-[#98a3c0]"
                                            : "text-[#213460] hover:bg-[#f4f7ff]"
                                        }`}
                                      >
                                        <span>
                                          <span className="block font-semibold">{dosen.nama || "-"}</span>
                                          <span className="block text-xs text-[#7282a8]">
                                            {dosen.kode_dosen || "-"} · {dosen.email || "-"}
                                          </span>
                                        </span>
                                        <span className="shrink-0 text-xs font-semibold">
                                          {isDisabledRow ? "Sudah dipakai" : `NIK: ${dosen.nik || "-"}`}
                                        </span>
                                      </button>
                                    );
                                  })
                                ) : (
                                  <p className="px-3 py-2 text-xs font-semibold text-[#7282a8]">Dosen tidak ditemukan.</p>
                                )}
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <div className="rounded-lg border border-[#cdd8f0] bg-white px-3 py-2 text-sm text-[#50618d]">
                            {selectedLabel}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-[#e8edf8] pt-4">
                  {isEditingJabatanStruktural ? (
                    <>
                      <button
                        type="button"
                        onClick={handleCancelEditJabatanStruktural}
                        disabled={savingJabatanStruktural}
                        className="rounded-lg border border-[#d3dbef] px-4 py-2 text-sm font-bold text-[#344b7c] hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveJabatanStruktural}
                        disabled={savingJabatanStruktural}
                        className="rounded-lg bg-[#2f63e3] px-4 py-2 text-sm font-bold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {savingJabatanStruktural ? "Menyimpan..." : "Simpan"}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={handleStartEditJabatanStruktural}
                      className="rounded-lg border border-[#d3dbef] px-4 py-2 text-sm font-bold text-[#27407b] hover:bg-[#f4f7ff]"
                    >
                      Edit
                    </button>
                  )}
                </div>
              </div>
            ) : null}
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



