import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Eye,
  MapPin,
  RefreshCcw,
  Search,
  Send,
  XCircle,
} from "lucide-react";
import Swal from "sweetalert2";

const PAGE_SIZE = 10;

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
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

function formatLabel(value) {
  if (!value) return "-";
  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function statusPermohonanBadge(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "approved") return "bg-[#e6f8ef] text-[#1f8a58]";
  if (normalized === "rejected") return "bg-[#ffeded] text-[#b03d3d]";
  return "bg-[#fff5df] text-[#9b6d00]";
}

function statusResumeBadge(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "approved") return "bg-[#e6f8ef] text-[#1f8a58]";
  if (normalized === "rejected") return "bg-[#ffeded] text-[#b03d3d]";
  if (normalized === "revisi") return "bg-[#fff5df] text-[#9b6d00]";
  if (normalized === "submitted") return "bg-[#edf3ff] text-[#2952b7]";
  return "bg-[#eef2fb] text-[#55658f]";
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

const DOSEN_BIMBINGAN_TABS = [
  { key: "semua", label: "Semua" },
  { key: "permohonan_sesi", label: "Permohonan Sesi" },
  { key: "resume_masuk", label: "Resume Masuk" },
  { key: "selesai", label: "Selesai" },
];

function isRowInDosenTab(row, tabKey) {
  if (!row) return false;
  const statusPermohonan = String(row.status_permohonan || "").toLowerCase();
  const statusResume = String(row.status_resume || "").toLowerCase();

  if (tabKey === "permohonan_sesi") {
    return statusPermohonan === "pending";
  }
  if (tabKey === "resume_masuk") {
    return statusPermohonan === "approved" && statusResume === "submitted";
  }
  if (tabKey === "selesai") {
    return (
      statusPermohonan === "rejected" ||
      statusResume === "approved" ||
      statusResume === "revisi" ||
      statusResume === "rejected"
    );
  }
  return true;
}

function DosenBimbinganReviewPage({ session, apiBaseUrl, onSessionExpired, onRefreshParent, onModeChange }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState(null);
  const [activeProcessTab, setActiveProcessTab] = useState("semua");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const [mode, setMode] = useState("list");
  const [selectedRowId, setSelectedRowId] = useState(null);
  const [selectedRow, setSelectedRow] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [decision, setDecision] = useState("approve");
  const [decisionCatatan, setDecisionCatatan] = useState("");
  const [decisionLokasi, setDecisionLokasi] = useState("");

  const [resumeAction, setResumeAction] = useState("approve");
  const [resumeCatatan, setResumeCatatan] = useState("");

  const [savingDecision, setSavingDecision] = useState(false);
  const [savingResume, setSavingResume] = useState(false);

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

      const payload = await response.json().catch(() => null);
      const message = String(payload?.message || "").toLowerCase();
      const isTokenError =
        message.includes("token tidak valid") ||
        message.includes("token tidak ditemukan") ||
        message.includes("kadaluarsa");

      if (response.status === 401 || (response.status === 403 && isTokenError)) {
        onSessionExpired?.();
        throw new Error("__SESSION_EXPIRED__");
      }

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || "Terjadi kesalahan pada server");
      }

      return payload.data;
    },
    [apiBaseUrl, onSessionExpired, session.token]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchWithAuth("/api/dosen/bimbingan");
      setRows(Array.isArray(data?.rows) ? data.rows : []);
      setStats(data?.stats || null);
    } catch (loadError) {
      if (loadError.message !== "__SESSION_EXPIRED__") {
        setError(loadError.message || "Gagal memuat data bimbingan mahasiswa.");
      }
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  const loadDetail = useCallback(
    async (id) => {
      setLoadingDetail(true);
      try {
        const detail = await fetchWithAuth(`/api/dosen/bimbingan/${id}`);
        setSelectedRow(detail || null);
      } catch (detailError) {
        if (detailError.message !== "__SESSION_EXPIRED__") {
          showErrorToast(detailError.message || "Gagal memuat detail sesi bimbingan.");
        }
        setSelectedRow(null);
      } finally {
        setLoadingDetail(false);
      }
    },
    [fetchWithAuth]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    onModeChange?.(mode === "list");
  }, [mode, onModeChange]);

  const rowsByProcessTab = useMemo(() => {
    return rows.filter((row) => isRowInDosenTab(row, activeProcessTab));
  }, [activeProcessTab, rows]);

  const processTabCounts = useMemo(() => {
    const counts = {};
    DOSEN_BIMBINGAN_TABS.forEach((tab) => {
      counts[tab.key] = rows.filter((row) => isRowInDosenTab(row, tab.key)).length;
    });
    return counts;
  }, [rows]);

  const filteredRows = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return rowsByProcessTab;
    return rowsByProcessTab.filter((row) => {
      const haystack = [
        row.id,
        row.mahasiswa?.nim,
        row.mahasiswa?.nama,
        row.mahasiswa?.angkatan,
        row.status_permohonan,
        row.status_resume,
        row.permintaan_tanggal,
        row.permintaan_jam,
        row.permintaan_pesan,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(keyword);
    });
  }, [query, rowsByProcessTab]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE)), [filteredRows.length]);
  const pagedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, page]);

  const rangeStart = filteredRows.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, filteredRows.length);

  useEffect(() => {
    setPage(1);
  }, [activeProcessTab, query]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const openDetail = async (row, nextDecision = "approve") => {
    setSelectedRowId(row.id);
    setMode("detail");
    setDecision(nextDecision === "reject" ? "reject" : "approve");
    setDecisionCatatan(row.catatan_dosen || "");
    setDecisionLokasi(row.lokasi_bimbingan || "");
    setResumeAction("approve");
    setResumeCatatan("");
    await loadDetail(row.id);
  };

  const backToList = () => {
    setMode("list");
    setSelectedRowId(null);
    setSelectedRow(null);
    setDecision("approve");
    setDecisionCatatan("");
    setDecisionLokasi("");
    setResumeAction("approve");
    setResumeCatatan("");
  };

  const handleSubmitDecision = async () => {
    if (!selectedRowId || !selectedRow) {
      showErrorToast("Data detail bimbingan belum siap.");
      return;
    }

    const catatanTrimmed = decisionCatatan.trim();
    if (catatanTrimmed.length < 5) {
      showErrorToast("Catatan keputusan minimal 5 karakter.");
      return;
    }

    if (decision === "approve" && decisionLokasi.trim().length < 3) {
      showErrorToast("Lokasi bimbingan minimal 3 karakter saat approve.");
      return;
    }

    const endpoint =
      decision === "approve"
        ? `/api/dosen/bimbingan/${selectedRowId}/approve`
        : `/api/dosen/bimbingan/${selectedRowId}/reject`;

    const body =
      decision === "approve"
        ? { catatan_dosen: catatanTrimmed, lokasi_bimbingan: decisionLokasi.trim() }
        : { catatan_dosen: catatanTrimmed };

    const confirm = await Swal.fire({
      title: decision === "approve" ? "Setujui sesi bimbingan?" : "Tolak sesi bimbingan?",
      text: "Pastikan keputusan sudah sesuai.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: decision === "approve" ? "Ya, setujui" : "Ya, tolak",
      cancelButtonText: "Batal",
      confirmButtonColor: decision === "approve" ? "#137748" : "#b73a3a",
    });
    if (!confirm.isConfirmed) return;

    setSavingDecision(true);
    try {
      await fetchWithAuth(endpoint, {
        method: "POST",
        body: JSON.stringify(body),
      });
      showSuccessToast(decision === "approve" ? "Permohonan bimbingan disetujui." : "Permohonan bimbingan ditolak.");
      await loadData();
      await loadDetail(selectedRowId);
      onRefreshParent?.();
    } catch (saveError) {
      if (saveError.message !== "__SESSION_EXPIRED__") {
        showErrorToast(saveError.message || "Gagal menyimpan keputusan bimbingan.");
      }
    } finally {
      setSavingDecision(false);
    }
  };

  const handleSubmitResumeReview = async () => {
    if (!selectedRowId || !selectedRow) {
      showErrorToast("Data detail bimbingan belum siap.");
      return;
    }

    const catatanTrimmed = resumeCatatan.trim();
    if ((resumeAction === "revisi" || resumeAction === "reject") && catatanTrimmed.length < 5) {
      showErrorToast("Catatan review minimal 5 karakter untuk revisi/penolakan resume.");
      return;
    }

    const confirm = await Swal.fire({
      title: "Simpan review resume?",
      text: "Pastikan isi review sudah sesuai.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Simpan",
      cancelButtonText: "Batal",
      confirmButtonColor: "#2f63e3",
    });
    if (!confirm.isConfirmed) return;

    setSavingResume(true);
    try {
      await fetchWithAuth(`/api/dosen/bimbingan/${selectedRowId}/review-resume`, {
        method: "POST",
        body: JSON.stringify({
          action: resumeAction,
          catatan_review: catatanTrimmed,
        }),
      });
      showSuccessToast("Review resume berhasil disimpan.");
      setResumeCatatan("");
      await loadData();
      await loadDetail(selectedRowId);
      onRefreshParent?.();
    } catch (resumeError) {
      if (resumeError.message !== "__SESSION_EXPIRED__") {
        showErrorToast(resumeError.message || "Gagal menyimpan review resume.");
      }
    } finally {
      setSavingResume(false);
    }
  };

  const canReviewResume =
    selectedRow?.status_permohonan === "approved" && selectedRow?.status_resume === "submitted";

  return (
    <div className={mode === "list" ? "flex min-h-0 flex-1 flex-col" : "space-y-4"}>
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-[#4e5e86]">Total Sesi</p>
          <p className="mt-2 text-2xl font-black text-[#1b274b]">{stats?.total_sesi || 0}</p>
        </div>
        <div className="rounded-xl border border-[#ffe8c4] bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-[#4e5e86]">Pending Permohonan</p>
          <p className="mt-2 text-2xl font-black text-[#1b274b]">{stats?.pending_permohonan || 0}</p>
        </div>
        <div className="rounded-xl border border-[#dff3ec] bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-[#4e5e86]">Resume Menunggu Review</p>
          <p className="mt-2 text-2xl font-black text-[#1b274b]">{stats?.submitted_resume || 0}</p>
        </div>
        <div className="rounded-xl border border-[#dae6ff] bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-[#4e5e86]">Sesi Tervalidasi</p>
          <p className="mt-2 text-2xl font-black text-[#1b274b]">{stats?.counted_sessions || 0}</p>
        </div>
      </section>

      {mode === "list" ? (
        <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-black text-[#1b274b]">Grid Permohonan Bimbingan Mahasiswa</h3>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7282a8]" />
                <input
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Cari NIM, nama, status, tanggal..."
                  className="w-[320px] rounded-lg border border-[#d3dbef] py-2 pl-8 pr-3 text-sm outline-none focus:border-[#2f63e3]"
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

          <div className="mb-3 flex flex-wrap gap-2 border-b border-[#e8edf8] pb-3">
            {DOSEN_BIMBINGAN_TABS.map((tab) => {
              const isActive = activeProcessTab === tab.key;
              return (
                <button
                  key={`tab-dosen-bimbingan-${tab.key}`}
                  type="button"
                  onClick={() => setActiveProcessTab(tab.key)}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                    isActive
                      ? "border-[#2f63e3] bg-[#edf3ff] text-[#2f63e3]"
                      : "border-[#d3dbef] bg-white text-[#4d5e89] hover:bg-[#f5f8ff]"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-black ${
                      isActive ? "bg-[#2f63e3] text-white" : "bg-[#eef2fb] text-[#5e6f98]"
                    }`}
                  >
                    {processTabCounts[tab.key] || 0}
                  </span>
                </button>
              );
            })}
          </div>

          {error ? (
            <div className="mb-3 rounded-lg border border-[#f6d7d7] bg-[#fff2f2] p-3 text-sm font-semibold text-[#a03f3f]">
              {error}
            </div>
          ) : null}

          <div className="relative mt-1 flex-1 overflow-auto rounded-lg border border-[#e6ecf8]">
            <table className="w-full min-w-[1280px] text-left text-sm">
              <thead>
                <tr className="border-y border-[#e6ecf8] text-[#4d5e89]">
                  <th className="bg-[#f8fbff] px-3 py-2 font-semibold">No</th>
                  <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Nama Mahasiswa</th>
                  <th className="bg-[#f8fbff] px-3 py-2 font-semibold">NIM</th>
                  <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Tanggal/Jam</th>
                  <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Permintaan</th>
                  <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Status Permohonan</th>
                  <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Status Resume</th>
                  <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Diperbarui</th>
                  <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length > 0
                  ? pagedRows.map((row, index) => {
                      const nomorUrut = rangeStart + index;
                      return (
                        <tr key={`row-bimbingan-dosen-${row.id}`} className="border-b border-[#eff3fb] align-top">
                          <td className="px-3 py-2 font-semibold text-[#254080]">{nomorUrut}</td>
                          <td className="px-3 py-2">
                            <p className="font-semibold text-[#1f2d53]">{row.mahasiswa?.nama || "-"}</p>
                            <p className="text-xs text-[#61709b]">Angkatan {row.mahasiswa?.angkatan || "-"}</p>
                          </td>
                          <td className="px-3 py-2 font-semibold text-[#27407b]">{row.mahasiswa?.nim || "-"}</td>
                          <td className="px-3 py-2">
                            {formatDate(row.permintaan_tanggal)} | {row.permintaan_jam || "-"}
                          </td>
                          <td className="max-w-[320px] px-3 py-2">
                            <p className="line-clamp-2">{row.permintaan_pesan || "-"}</p>
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusPermohonanBadge(
                                row.status_permohonan
                              )}`}
                            >
                              {row.status_permohonan_label || formatLabel(row.status_permohonan)}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusResumeBadge(
                                row.status_resume
                              )}`}
                            >
                              {row.status_resume_label || formatLabel(row.status_resume)}
                            </span>
                          </td>
                          <td className="px-3 py-2">{formatDateTime(row.updatedAt)}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  openDetail(row, row.status_permohonan === "pending" ? "approve" : "approve")
                                }
                                className="inline-flex items-center gap-1 rounded-md bg-[#2f63e3] px-3 py-1.5 text-xs font-bold text-white transition hover:brightness-110"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                {row.status_permohonan === "pending" ? "Review" : "Detail"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  : null}
              </tbody>
            </table>
            {loading ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[41px] flex items-center justify-center px-4 text-center text-sm font-semibold text-[#7b88ab]">
                Memuat data bimbingan...
              </div>
            ) : null}
            {!loading && filteredRows.length === 0 ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[41px] flex items-center justify-center px-4 text-center text-sm font-semibold text-[#7b88ab]">
                Belum ada permohonan bimbingan dari mahasiswa.
              </div>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#e8edf8] pt-3">
            <p className="text-sm text-[#4f5e86]">
              Menampilkan {rangeStart} - {rangeEnd} dari {filteredRows.length} data permohonan bimbingan.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page === 1}
                className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] transition hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Sebelumnya
              </button>
              <span className="text-sm font-semibold text-[#314778]">
                Halaman {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={page >= totalPages}
                className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] transition hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Berikutnya
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {mode === "detail" ? (
        <div className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <button
              type="button"
              onClick={backToList}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#d3dbef] text-[#2b3f74] hover:bg-[#f3f7ff]"
              title="Kembali ke grid bimbingan"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h3 className="text-lg font-black text-[#1b274b]">Detail Permohonan Bimbingan</h3>
              <p className="text-sm text-[#5d6c91]">
                Review keputusan dosen untuk sesi bimbingan mahasiswa dan validasi resume.
              </p>
            </div>
          </div>

          {loadingDetail ? (
            <div className="rounded-lg border border-[#e2e9f8] bg-[#f8fbff] p-6 text-center text-sm font-semibold text-[#60709a]">
              Memuat detail bimbingan...
            </div>
          ) : null}

          {!loadingDetail && selectedRow ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <div className="rounded-lg border border-[#e2e9f8] bg-[#f8fbff] p-4">
                  <h4 className="text-sm font-black text-[#1b274b]">Data Mahasiswa</h4>
                  <div className="mt-2 grid grid-cols-1 gap-2 text-sm text-[#324c86]">
                    <p>
                      <span className="font-semibold">NIM:</span> {selectedRow.mahasiswa?.nim || "-"}
                    </p>
                    <p>
                      <span className="font-semibold">Nama:</span> {selectedRow.mahasiswa?.nama || "-"}
                    </p>
                    <p>
                      <span className="font-semibold">Email:</span> {selectedRow.mahasiswa?.email || "-"}
                    </p>
                    <p>
                      <span className="font-semibold">Angkatan:</span> {selectedRow.mahasiswa?.angkatan || "-"}
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-[#e2e9f8] bg-white p-4">
                  <h4 className="text-sm font-black text-[#1b274b]">Ringkasan Permohonan</h4>
                  <div className="mt-2 grid grid-cols-1 gap-2 text-sm text-[#324c86]">
                    <p className="inline-flex items-center gap-1">
                      <CalendarDays className="h-4 w-4" />
                      {formatDate(selectedRow.permintaan_tanggal)} | {selectedRow.permintaan_jam || "-"}
                    </p>
                    <p className="inline-flex items-center gap-1">
                      <Clock3 className="h-4 w-4" />
                      Diajukan: {formatDateTime(selectedRow.createdAt)}
                    </p>
                    <p className="inline-flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      Lokasi: {selectedRow.lokasi_bimbingan || "-"}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusPermohonanBadge(
                          selectedRow.status_permohonan
                        )}`}
                      >
                        {selectedRow.status_permohonan_label || formatLabel(selectedRow.status_permohonan)}
                      </span>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusResumeBadge(
                          selectedRow.status_resume
                        )}`}
                      >
                        Resume: {selectedRow.status_resume_label || formatLabel(selectedRow.status_resume)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-[#e2e9f8] bg-white p-4">
                <h4 className="text-sm font-black text-[#1b274b]">Pesan Mahasiswa</h4>
                <p className="mt-2 whitespace-pre-wrap text-sm text-[#2c406f]">{selectedRow.permintaan_pesan || "-"}</p>
              </div>

              {selectedRow.resume_mahasiswa ? (
                <div className="rounded-lg border border-[#e2e9f8] bg-white p-4">
                  <h4 className="text-sm font-black text-[#1b274b]">Resume Mahasiswa</h4>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-[#2c406f]">{selectedRow.resume_mahasiswa}</p>
                </div>
              ) : null}

              {selectedRow.status_permohonan === "pending" ? (
                <div className="rounded-lg border border-[#e2e9f8] bg-white p-4">
                  <h4 className="text-sm font-black text-[#1b274b]">Keputusan Permohonan Bimbingan</h4>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDecision("approve")}
                      className={`rounded-md px-3 py-1 text-sm font-bold ${
                        decision === "approve"
                          ? "bg-[#137748] text-white"
                          : "border border-[#cfd8ea] bg-white text-[#2f4679]"
                      }`}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => setDecision("reject")}
                      className={`rounded-md px-3 py-1 text-sm font-bold ${
                        decision === "reject"
                          ? "bg-[#b73a3a] text-white"
                          : "border border-[#cfd8ea] bg-white text-[#2f4679]"
                      }`}
                    >
                      Tolak
                    </button>
                  </div>

                  <div className="mt-3">
                    <label className="mb-1 block text-sm font-semibold text-[#3d4f7d]">
                      {decision === "approve" ? "Catatan/Pesan Persetujuan" : "Alasan Penolakan"}
                    </label>
                    <textarea
                      rows={3}
                      value={decisionCatatan}
                      onChange={(event) => setDecisionCatatan(event.target.value)}
                      placeholder={
                        decision === "approve"
                          ? "Contoh: Silakan hadir tepat waktu sesuai jadwal."
                          : "Contoh: Jadwal bentrok dengan agenda lain."
                      }
                      className="w-full rounded-lg border border-[#cfdaf0] px-3 py-2 text-sm text-[#1b274b] outline-none focus:border-[#2f63e3]"
                    />
                  </div>

                  {decision === "approve" ? (
                    <div className="mt-3">
                      <label className="mb-1 block text-sm font-semibold text-[#3d4f7d]">Lokasi Bimbingan</label>
                      <input
                        type="text"
                        value={decisionLokasi}
                        onChange={(event) => setDecisionLokasi(event.target.value)}
                        placeholder="Contoh: Ruang Dosen 2.14 / Zoom"
                        className="w-full rounded-lg border border-[#cfdaf0] px-3 py-2 text-sm text-[#1b274b] outline-none focus:border-[#2f63e3]"
                      />
                    </div>
                  ) : null}

                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={handleSubmitDecision}
                      disabled={savingDecision}
                      className="inline-flex items-center gap-2 rounded-lg bg-[#2f63e3] px-4 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Send className="h-4 w-4" />
                      {savingDecision ? "Menyimpan..." : decision === "approve" ? "Simpan Approve" : "Simpan Tolak"}
                    </button>
                  </div>
                </div>
              ) : null}

              {canReviewResume ? (
                <div className="rounded-lg border border-[#e2e9f8] bg-white p-4">
                  <h4 className="text-sm font-black text-[#1b274b]">Review Resume Mahasiswa</h4>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setResumeAction("approve")}
                      className={`rounded-md px-3 py-1 text-sm font-bold ${
                        resumeAction === "approve"
                          ? "bg-[#137748] text-white"
                          : "border border-[#cfd8ea] bg-white text-[#2f4679]"
                      }`}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => setResumeAction("revisi")}
                      className={`rounded-md px-3 py-1 text-sm font-bold ${
                        resumeAction === "revisi"
                          ? "bg-[#d09a13] text-white"
                          : "border border-[#cfd8ea] bg-white text-[#2f4679]"
                      }`}
                    >
                      Revisi
                    </button>
                    <button
                      type="button"
                      onClick={() => setResumeAction("reject")}
                      className={`rounded-md px-3 py-1 text-sm font-bold ${
                        resumeAction === "reject"
                          ? "bg-[#b73a3a] text-white"
                          : "border border-[#cfd8ea] bg-white text-[#2f4679]"
                      }`}
                    >
                      Reject
                    </button>
                  </div>

                  <div className="mt-3">
                    <label className="mb-1 block text-sm font-semibold text-[#3d4f7d]">Catatan Review Resume</label>
                    <textarea
                      rows={3}
                      value={resumeCatatan}
                      onChange={(event) => setResumeCatatan(event.target.value)}
                      placeholder={
                        resumeAction === "approve"
                          ? "Opsional: catatan singkat untuk mahasiswa."
                          : "Wajib isi alasan revisi/penolakan."
                      }
                      className="w-full rounded-lg border border-[#cfdaf0] px-3 py-2 text-sm text-[#1b274b] outline-none focus:border-[#2f63e3]"
                    />
                  </div>

                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={handleSubmitResumeReview}
                      disabled={savingResume}
                      className="inline-flex items-center gap-2 rounded-lg bg-[#2f63e3] px-4 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Send className="h-4 w-4" />
                      {savingResume ? "Menyimpan..." : "Simpan Review Resume"}
                    </button>
                  </div>
                </div>
              ) : null}

              {selectedRow.status_resume === "approved" && selectedRow.is_counted ? (
                <div className="inline-flex items-center gap-2 rounded-md bg-[#e8f8ef] px-3 py-2 text-sm font-semibold text-[#1f8a58]">
                  <CheckCircle2 className="h-4 w-4" />
                  Resume telah disetujui dan sesi dihitung ke progres minimal 8 bimbingan.
                </div>
              ) : null}

              {selectedRow.status_permohonan === "rejected" ? (
                <div className="inline-flex items-center gap-2 rounded-md bg-[#ffeded] px-3 py-2 text-sm font-semibold text-[#b03d3d]">
                  <XCircle className="h-4 w-4" />
                  Permohonan ditolak. Mahasiswa perlu mengajukan jadwal baru.
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default DosenBimbinganReviewPage;
