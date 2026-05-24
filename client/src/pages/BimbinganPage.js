import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Eye,
  MapPin,
  MessageSquareText,
  Pencil,
  RefreshCcw,
  Search,
  Send,
  XCircle,
} from "lucide-react";
import Swal from "sweetalert2";

const PAGE_SIZE = 20;
const BIMBINGAN_VIEW_TABS = [
  { key: "riwayat", label: "Riwayat Bimbingan" },
  { key: "permohonan", label: "Permohonan Bimbingan" },
  { key: "resume", label: "Resume Bimbingan" },
];
const MAHASISWA_BIMBINGAN_TAB_STORAGE_KEY = "sima_mahasiswa_bimbingan_active_tab";

function getInitialBimbinganViewTab() {
  if (typeof window === "undefined") return BIMBINGAN_VIEW_TABS[0].key;
  try {
    const saved = window.sessionStorage.getItem(MAHASISWA_BIMBINGAN_TAB_STORAGE_KEY);
    if (BIMBINGAN_VIEW_TABS.some((tab) => tab.key === saved)) {
      return saved;
    }
  } catch (_) {
    // Ignore storage access error, fallback to default tab.
  }
  return BIMBINGAN_VIEW_TABS[0].key;
}

function isValidJam(value) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(String(value || "").trim());
}

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

function getNowJakartaParts() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = formatter.formatToParts(new Date()).reduce((accumulator, part) => {
    if (part.type !== "literal") {
      accumulator[part.type] = part.value;
    }
    return accumulator;
  }, {});
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

function hasScheduleStarted(tanggal, jam) {
  const normalizedTanggal = String(tanggal || "").trim().slice(0, 10);
  const normalizedJam = String(jam || "").trim();
  if (!normalizedTanggal) return false;

  const now = getNowJakartaParts();
  if (normalizedTanggal < now.date) return true;
  if (normalizedTanggal > now.date) return false;

  if (!isValidJam(normalizedJam)) return false;
  return normalizedJam <= now.time;
}

function isPendingSchedulePassed(row) {
  const statusPermohonan = String(row?.status_permohonan || "").toLowerCase();
  if (statusPermohonan !== "pending") return false;
  return hasScheduleStarted(row?.permintaan_tanggal, row?.permintaan_jam);
}

function isApprovedLikeStatus(status) {
  const normalized = String(status || "").toLowerCase();
  return normalized === "approved" || normalized === "rescheduled";
}

function isRowInBimbinganViewTab(row, tabKey) {
  if (!row) return false;
  const statusPermohonan = String(row.status_permohonan || "").toLowerCase();

  if (tabKey === "permohonan") {
    return ["pending", "rejected", "expired"].includes(statusPermohonan);
  }
  if (tabKey === "resume") {
    return isApprovedLikeStatus(statusPermohonan);
  }
  return true;
}

function statusPermohonanBadge(status, isOverduePending = false) {
  if (isOverduePending) {
    return "bg-[#b73a3a] text-white";
  }

  const normalized = String(status || "").toLowerCase();
  if (normalized === "approved") return "bg-[#e6f8ef] text-[#1f8a58]";
  if (normalized === "rescheduled") return "bg-[#e8f1ff] text-[#244ea7]";
  if (normalized === "rejected") return "bg-[#ffeded] text-[#b03d3d]";
  if (normalized === "expired") return "bg-[#b73a3a] text-white";
  if (normalized === "pending") return "bg-[#fff5df] text-[#9b6d00]";
  return "bg-[#eef2fb] text-[#55658f]";
}

function resumeBadge(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "approved") return "bg-[#e6f8ef] text-[#1f8a58]";
  if (normalized === "rejected") return "bg-[#ffeded] text-[#b03d3d]";
  if (normalized === "revisi") return "bg-[#fff5df] text-[#9b6d00]";
  if (normalized === "submitted") return "bg-[#edf3ff] text-[#2952b7]";
  return "bg-[#eef2fb] text-[#55658f]";
}

function normalizeResumeStatusLabel(status) {
  const map = {
    belum_diisi: "Belum Diisi",
    submitted: "Menunggu Review",
    approved: "Disetujui",
    revisi: "Perlu Revisi",
    rejected: "Ditolak",
  };
  return map[String(status || "").toLowerCase()] || String(status || "-");
}

function isResumeEditableStatus(statusResume) {
  const normalizedStatus = String(statusResume || "").toLowerCase();
  return normalizedStatus === "belum_diisi" || normalizedStatus === "revisi";
}

function isResumeWaitingSessionStart(row) {
  if (!row) return false;
  return (
    isApprovedLikeStatus(row.status_permohonan) &&
    isResumeEditableStatus(row.status_resume) &&
    !hasScheduleStarted(row.permintaan_tanggal, row.permintaan_jam)
  );
}

function canSubmitResumeNow(row) {
  if (!row) return false;
  return (
    isApprovedLikeStatus(row.status_permohonan) &&
    isResumeEditableStatus(row.status_resume) &&
    hasScheduleStarted(row.permintaan_tanggal, row.permintaan_jam)
  );
}

function getResumeStatusMeta(row) {
  if (isResumeWaitingSessionStart(row)) {
    return {
      label: "Menunggu Sesi Bimbingan",
      badgeClass: "bg-[#fff5df] text-[#9b6d00]",
    };
  }

  return {
    label: row?.status_resume_label || normalizeResumeStatusLabel(row?.status_resume),
    badgeClass: resumeBadge(row?.status_resume),
  };
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

function BimbinganPage({ session, apiBaseUrl, onSessionExpired, onUpdated }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState(null);
  const [dosenPembimbing, setDosenPembimbing] = useState(null);

  const [mode, setMode] = useState("list");
  const [selectedRowId, setSelectedRowId] = useState(null);
  const [selectedRow, setSelectedRow] = useState(null);

  const [activeViewTab, setActiveViewTab] = useState(getInitialBimbinganViewTab);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const [form, setForm] = useState({
    pesan: "",
    tanggal: "",
    jam: "",
  });
  const [formErrors, setFormErrors] = useState({});
  const [submittingRequest, setSubmittingRequest] = useState(false);

  const [resumeDraft, setResumeDraft] = useState({});
  const [submittingResumeId, setSubmittingResumeId] = useState(null);
  const [expiringRequestId, setExpiringRequestId] = useState(null);

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
      const tokenError =
        message.includes("token tidak valid") ||
        message.includes("token tidak ditemukan") ||
        message.includes("kadaluarsa");

      if (response.status === 401 || (response.status === 403 && tokenError)) {
        onSessionExpired?.();
        throw new Error("__SESSION_EXPIRED__");
      }

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || "Terjadi kesalahan pada server");
      }

      return payload;
    },
    [apiBaseUrl, onSessionExpired, session.token]
  );

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const payload = await fetchWithAuth("/api/mahasiswa/bimbingan");
      const data = payload?.data || {};
      const fetchedRows = Array.isArray(data.rows) ? data.rows : [];
      setRows(fetchedRows);
      setStats(data.stats || null);
      setDosenPembimbing(data.dosen_pembimbing || null);
      return fetchedRows;
    } catch (loadError) {
      if (loadError.message !== "__SESSION_EXPIRED__") {
        setError(loadError.message || "Gagal memuat data bimbingan.");
      }
      return [];
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(MAHASISWA_BIMBINGAN_TAB_STORAGE_KEY, activeViewTab);
    } catch (_) {
      // Ignore storage access error.
    }
  }, [activeViewTab]);

  useEffect(() => {
    if (mode !== "detail" || !selectedRowId) return;
    const latest = rows.find((item) => Number(item.id) === Number(selectedRowId)) || null;
    setSelectedRow(latest);
    if (!latest) {
      setMode("list");
      setSelectedRowId(null);
    }
  }, [mode, rows, selectedRowId]);

  useEffect(() => {
    setPage(1);
  }, [query, activeViewTab]);

  useEffect(() => {
    setMode("list");
    setSelectedRowId(null);
    setSelectedRow(null);
    setQuery("");
  }, [activeViewTab]);

  const progressPercent = useMemo(() => Number(stats?.progress_percent || 0), [stats]);

  const acceptedCount = useMemo(
    () =>
      Number(
        stats?.accepted_permohonan ??
          (Number(stats?.approved_permohonan || 0) + Number(stats?.rescheduled_permohonan || 0))
      ),
    [stats]
  );

  const tabCounts = useMemo(() => {
    const result = {};
    BIMBINGAN_VIEW_TABS.forEach((tab) => {
      result[tab.key] = rows.filter((row) => isRowInBimbinganViewTab(row, tab.key)).length;
    });
    return result;
  }, [rows]);

  const filteredRows = useMemo(() => {
    const rowsByTab = rows.filter((row) => isRowInBimbinganViewTab(row, activeViewTab));
    const keyword = query.trim().toLowerCase();
    if (!keyword) return rowsByTab;

    return rowsByTab.filter((row) => {
      const haystack = [
        row.id,
        row.permintaan_tanggal,
        row.permintaan_jam,
        row.status_permohonan,
        row.status_permohonan_label,
        row.status_resume,
        row.status_resume_label,
        row.permintaan_pesan,
        row.resume_mahasiswa,
        row.catatan_dosen,
        row.catatan_review_resume,
        row.lokasi_bimbingan,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(keyword);
    });
  }, [activeViewTab, query, rows]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE)), [filteredRows.length]);
  const pagedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, page]);
  const rangeStart = filteredRows.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, filteredRows.length);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const resetFormErrors = () => {
    setFormErrors({});
  };

  const validateAjukanForm = () => {
    const nextErrors = {};
    if (String(form.pesan || "").trim().length < 10) {
      nextErrors.pesan = "Pesan minimal 10 karakter.";
    }
    if (!String(form.tanggal || "").trim()) {
      nextErrors.tanggal = "Tanggal wajib diisi.";
    }
    if (!isValidJam(form.jam)) {
      nextErrors.jam = "Jam wajib format HH:mm.";
    }
    setFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const openDetail = (row) => {
    if (!row?.id) return;
    setSelectedRowId(row.id);
    setSelectedRow(row);
    setResumeDraft((prev) => {
      if (typeof prev[row.id] === "string") return prev;
      return { ...prev, [row.id]: row.resume_mahasiswa || "" };
    });
    setMode("detail");
  };

  const backToList = () => {
    setMode("list");
    setSelectedRowId(null);
    setSelectedRow(null);
  };

  const openAjukanMode = () => {
    setMode("add");
    resetFormErrors();
  };

  const handleRefresh = async () => {
    const freshRows = await loadData();
    if (mode === "detail" && selectedRowId) {
      const latest = freshRows.find((item) => Number(item.id) === Number(selectedRowId)) || null;
      setSelectedRow(latest);
      if (!latest) {
        backToList();
      }
    }
    onUpdated?.();
  };

  const handleSubmitRequest = async (event) => {
    event.preventDefault();
    setError("");

    if (!validateAjukanForm()) return;

    try {
      setSubmittingRequest(true);
      await fetchWithAuth("/api/mahasiswa/bimbingan", {
        method: "POST",
        body: JSON.stringify({
          pesan: String(form.pesan || "").trim(),
          tanggal: form.tanggal,
          jam: form.jam,
        }),
      });
      showSuccessToast("Pengajuan sesi bimbingan berhasil dibuat.");
      setForm({ pesan: "", tanggal: "", jam: "" });
      resetFormErrors();
      setMode("list");
      await loadData();
      onUpdated?.();
    } catch (submitError) {
      if (submitError.message !== "__SESSION_EXPIRED__") {
        setError(submitError.message || "Gagal mengirim permohonan bimbingan.");
      }
    } finally {
      setSubmittingRequest(false);
    }
  };

  const handleSubmitResume = async (rowId) => {
    const resume = String(resumeDraft[rowId] || "").trim();
    if (resume.length < 20) {
      setError("Resume minimal 20 karakter.");
      return;
    }

    const currentRow = rows.find((item) => Number(item.id) === Number(rowId)) || selectedRow;
    if (!canSubmitResumeNow(currentRow)) {
      setError("Resume hanya bisa diisi saat sesi bimbingan sudah dimulai.");
      return;
    }

    const confirmation = await Swal.fire({
      title: "Kirim resume bimbingan?",
      text: "Resume yang dikirim akan masuk ke antrean review dosen.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Ya, Kirim Resume",
      cancelButtonText: "Batal",
      confirmButtonColor: "#2f63e3",
    });
    if (!confirmation.isConfirmed) return;

    setError("");
    try {
      setSubmittingResumeId(rowId);
      const payload = await fetchWithAuth(`/api/mahasiswa/bimbingan/${rowId}/resume`, {
        method: "POST",
        body: JSON.stringify({ resume }),
      });
      const fallbackUpdatedRow = {
        id: rowId,
        resume_mahasiswa: resume,
        status_resume: "submitted",
        status_resume_label: normalizeResumeStatusLabel("submitted"),
        catatan_review_resume: null,
        is_counted: false,
        updatedAt: new Date().toISOString(),
      };
      const rowFromServer =
        payload?.data && Number(payload.data.id) === Number(rowId) ? payload.data : null;
      const mergedRow = { ...fallbackUpdatedRow, ...(rowFromServer || {}) };

      setRows((prevRows) =>
        prevRows.map((item) =>
          Number(item.id) === Number(rowId)
            ? {
                ...item,
                ...mergedRow,
                id: item.id,
              }
            : item
        )
      );
      setSelectedRow((prevSelected) => {
        if (!prevSelected || Number(prevSelected.id) !== Number(rowId)) return prevSelected;
        return {
          ...prevSelected,
          ...mergedRow,
          id: prevSelected.id,
        };
      });
      showSuccessToast("Resume bimbingan berhasil dikirim.");
      setResumeDraft((prev) => ({ ...prev, [rowId]: "" }));
      onUpdated?.();
    } catch (resumeError) {
      if (resumeError.message !== "__SESSION_EXPIRED__") {
        setError(resumeError.message || "Gagal mengirim resume.");
      }
    } finally {
      setSubmittingResumeId(null);
    }
  };

  const handleExpireRequest = async (row) => {
    if (!row?.id) return;

    const confirm = await Swal.fire({
      title: "Tarik permohonan ini?",
      text: "Status akan menjadi expired dan dosen tidak bisa approve permohonan ini lagi.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Ya, tarik permohonan",
      cancelButtonText: "Batal",
      confirmButtonColor: "#b73a3a",
    });

    if (!confirm.isConfirmed) return;

    setError("");
    try {
      setExpiringRequestId(row.id);
      await fetchWithAuth(`/api/mahasiswa/bimbingan/${row.id}/expire`, {
        method: "POST",
      });
      showSuccessToast("Permohonan berhasil ditarik dan diubah menjadi expired.");
      await handleRefresh();
    } catch (expireError) {
      if (expireError.message !== "__SESSION_EXPIRED__") {
        setError(expireError.message || "Gagal menarik permohonan bimbingan.");
      }
    } finally {
      setExpiringRequestId(null);
    }
  };

  const selectedIsOverduePending = selectedRow ? isPendingSchedulePassed(selectedRow) : false;
  const selectedResumeText = String(selectedRow?.resume_mahasiswa || "").trim();
  const selectedResumeStatusMeta = getResumeStatusMeta(selectedRow);
  const selectedResumeWaitingSessionStart = isResumeWaitingSessionStart(selectedRow);
  const canSubmitResumeOnDetail =
    activeViewTab !== "riwayat" &&
    selectedRow &&
    canSubmitResumeNow(selectedRow);
  const shouldShowPreviousRejectedResume =
    canSubmitResumeOnDetail &&
    selectedRow &&
    ["revisi", "rejected"].includes(String(selectedRow.status_resume || "").toLowerCase()) &&
    Boolean(selectedResumeText);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-4">
      <section className="rounded-xl bg-gradient-to-r from-[#2f63e3] to-[#3f6fe0] p-4 text-white shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-lg border border-[#87a9ff] bg-[#ffffff1f] p-2">
            <MessageSquareText className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-black">Bimbingan Skripsi</h2>
            <p className="text-sm text-[#e6edff]">
              Kelola pengajuan sesi bimbingan, pantau status, dan kirim resume sesuai progres.
            </p>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-lg border border-[#f5d0d0] bg-[#fff2f2] px-4 py-3 text-sm font-semibold text-[#a03f3f]">{error}</div>
      ) : null}

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-xl border border-[#e8ecf6] bg-white p-4 shadow-sm xl:col-span-2">
          <h3 className="text-lg font-black text-[#1b274b]">Progress Bimbingan</h3>
          <p className="text-sm text-[#5d6c91]">
            Sesi tervalidasi: {stats?.counted_sessions || 0} dari {stats?.target_minimum || 8}
          </p>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#dfe6f7]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#2f63e3] to-[#2740a3]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-[#2b3f74] md:grid-cols-5">
            <p>
              <span className="font-bold">Pending:</span> {stats?.pending_permohonan || 0}
            </p>
            <p>
              <span className="font-bold">Disetujui:</span> {acceptedCount}
            </p>
            <p>
              <span className="font-bold">Resume Submit:</span> {stats?.submitted_resume || 0}
            </p>
            <p>
              <span className="font-bold">Resume Approved:</span> {stats?.approved_resume || 0}
            </p>
            <p>
              <span className="font-bold">Expired:</span> {stats?.expired_permohonan || 0}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-[#e8ecf6] bg-white p-4 shadow-sm">
          <h3 className="text-lg font-black text-[#1b274b]">Dosen Pembimbing Skripsi</h3>
          {dosenPembimbing ? (
            <div className="mt-2 space-y-1 text-sm text-[#2b3f74]">
              <p className="font-bold text-[#1b274b]">{dosenPembimbing.nama}</p>
              <p>NIK: {dosenPembimbing.nik || "-"}</p>
              <p>Email: {dosenPembimbing.email || "-"}</p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-[#5d6c91]">Belum ada dosen pembimbing skripsi aktif.</p>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-[#e4e9f6] bg-white p-3 shadow-sm">
        <p className="text-sm font-black text-[#1b274b]">Menu Bimbingan</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {BIMBINGAN_VIEW_TABS.map((tab) => {
            const isActive = activeViewTab === tab.key;
            return (
              <button
                key={`bimbingan-view-tab-${tab.key}`}
                type="button"
                onClick={() => setActiveViewTab(tab.key)}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                  isActive
                    ? "border-[#2f63e3] bg-[#edf3ff] text-[#2f63e3]"
                    : "border-[#d3dbef] bg-white text-[#4d5e89] hover:bg-[#f5f8ff]"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-black ${
                    isActive ? "bg-[#2f63e3] text-white" : "bg-[#eef2fb] text-[#5e6f98]"
                  }`}
                >
                  {tabCounts[tab.key] || 0}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-[#dce4f7] bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={backToList}
            disabled={mode === "list"}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#d3dbef] text-[#27407b] transition hover:bg-[#f3f6ff] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Kembali ke daftar bimbingan"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              handleRefresh().catch(() => {});
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-[#d3dbef] px-3 py-2 text-sm font-semibold text-[#27407b] hover:bg-[#f3f6ff]"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </button>
          {activeViewTab !== "resume" ? (
            <button
              type="button"
              onClick={openAjukanMode}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold transition ${
                mode === "add"
                  ? "border-[#2f63e3] bg-[#2f63e3] text-white hover:brightness-110"
                  : "border-[#d3dbef] bg-white text-[#27407b] hover:bg-[#f3f6ff]"
              }`}
            >
              <Send className="h-4 w-4" />
              Ajukan Bimbingan
            </button>
          ) : null}
        </div>
      </section>

      {mode === "list" ? (
        <section className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-black text-[#1b274b]">
              {activeViewTab === "permohonan"
                ? "Grid Permohonan Bimbingan"
                : activeViewTab === "resume"
                  ? "Grid Resume Bimbingan"
                  : "Grid Riwayat Sesi Bimbingan"}
            </h3>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7282a8]" />
                <input
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={
                    activeViewTab === "permohonan"
                      ? "Cari tanggal, jam, status permohonan, pesan..."
                      : activeViewTab === "resume"
                        ? "Cari tanggal, status resume, catatan, lokasi..."
                        : "Cari tanggal, jam, status, pesan, catatan..."
                  }
                  className="w-[320px] rounded-lg border border-[#d3dbef] py-2 pl-8 pr-3 text-sm outline-none focus:border-[#2f63e3]"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  handleRefresh().catch(() => {});
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-[#d3dbef] px-3 py-2 text-sm font-semibold text-[#27407b] hover:bg-[#f3f6ff]"
              >
                <RefreshCcw className="h-4 w-4" />
                Refresh
              </button>
            </div>
          </div>

          <div className="relative overflow-auto rounded-lg border border-[#e6ecf8] bg-white grid-unified-height">
              <table className="w-full min-w-[1380px] text-left text-sm">
                <thead>
                  <tr className="border-y border-[#e6ecf8] text-[#4d5e89]">
                    <th className="bg-[#f8fbff] px-3 py-2 font-semibold">No</th>
                    <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Tanggal/Jam</th>
                    {activeViewTab !== "resume" ? (
                      <>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Pesan Mahasiswa</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Status Permohonan</th>
                      </>
                    ) : null}
                    <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Status Resume</th>
                    {activeViewTab === "resume" ? (
                      <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Catatan Resume</th>
                    ) : null}
                    <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Catatan Dosen</th>
                    {activeViewTab === "resume" ? (
                      <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Catatan Review</th>
                    ) : null}
                    <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Diperbarui</th>
                    <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                {filteredRows.length > 0
                  ? pagedRows.map((row, index) => {
                      const nomorUrut = rangeStart + index;
                      const isOverduePending = isPendingSchedulePassed(row);
                      const isExpired = String(row.status_permohonan || "").toLowerCase() === "expired";
                      const resumeStatusMeta = getResumeStatusMeta(row);
                      const canEditResumeNow = canSubmitResumeNow(row);
                      return (
                        <tr
                          key={`row-bimbingan-${row.id}`}
                          className={`border-b border-[#eff3fb] align-middle ${
                            isOverduePending || isExpired ? "bg-[#fff7f7]" : ""
                          }`}
                        >
                          <td className="px-3 py-2 font-semibold text-[#254080]">{nomorUrut}</td>
                          <td className="px-3 py-2">
                            {formatDate(row.permintaan_tanggal)} | {row.permintaan_jam || "-"}
                          </td>
                          {activeViewTab !== "resume" ? (
                            <>
                              <td className="max-w-[320px] px-3 py-2">
                                <p className="line-clamp-2">{row.permintaan_pesan || "-"}</p>
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex flex-wrap gap-1.5">
                                  <span
                                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusPermohonanBadge(
                                      row.status_permohonan,
                                      isOverduePending
                                    )}`}
                                  >
                                    {isOverduePending ? "Terlampaui (Pending)" : row.status_permohonan_label || "-"}
                                  </span>
                                  {isExpired ? (
                                    <span className="inline-flex rounded-full bg-[#ffeded] px-2.5 py-1 text-xs font-bold text-[#b03d3d]">
                                      Merah Prioritas
                                    </span>
                                  ) : null}
                                </div>
                              </td>
                            </>
                          ) : null}
                          <td className="px-3 py-2">
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${resumeStatusMeta.badgeClass}`}>
                              {resumeStatusMeta.label || "-"}
                            </span>
                          </td>
                          {activeViewTab === "resume" ? (
                            <td className="max-w-[320px] px-3 py-2">
                              <p className="line-clamp-2">{row.resume_mahasiswa || "-"}</p>
                            </td>
                          ) : null}
                          <td className="max-w-[260px] px-3 py-2">
                            <p className="line-clamp-2">{row.catatan_dosen || "-"}</p>
                            <p className="mt-1 text-xs text-[#5a6a93]">Lokasi: {row.lokasi_bimbingan || "-"}</p>
                          </td>
                          {activeViewTab === "resume" ? (
                            <td className="max-w-[260px] px-3 py-2">
                              <p className="line-clamp-2">{row.catatan_review_resume || "-"}</p>
                            </td>
                          ) : null}
                          <td className="px-3 py-2">{formatDateTime(row.updatedAt)}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => openDetail(row)}
                                className="inline-flex items-center gap-1 rounded-md bg-[#2f63e3] px-2.5 py-1 text-xs font-bold text-white transition hover:brightness-110"
                              >
                                {activeViewTab === "resume" && canEditResumeNow ? (
                                  <Pencil className="h-3.5 w-3.5" />
                                ) : (
                                  <Eye className="h-3.5 w-3.5" />
                                )}
                                {activeViewTab === "resume" && canEditResumeNow ? "Isi Resume" : "Detail"}
                              </button>
                              {activeViewTab !== "resume" && isOverduePending ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleExpireRequest(row).catch(() => {});
                                  }}
                                  disabled={expiringRequestId === row.id}
                                  className="rounded-md bg-[#b73a3a] px-2.5 py-1 text-xs font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {expiringRequestId === row.id ? "Memproses..." : "Tarik"}
                                </button>
                              ) : null}
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
                {activeViewTab === "permohonan"
                  ? "Belum ada data permohonan bimbingan."
                  : activeViewTab === "resume"
                    ? "Belum ada data resume bimbingan."
                    : "Belum ada data sesi bimbingan pada filter ini."}
              </div>
            ) : null}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[#e8edf8] pt-3">
            <p className="text-sm text-[#4f5e86]">
              Menampilkan {rangeStart} - {rangeEnd} dari {filteredRows.length} data sesi bimbingan.
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
        </section>
      ) : null}

      {mode === "add" ? (
        <section className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <MessageSquareText className="h-5 w-5 text-[#2f63e3]" />
            <h3 className="text-lg font-black text-[#1b274b]">Ajukan Jadwal Bimbingan</h3>
          </div>
          <form onSubmit={handleSubmitRequest} className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <div className="lg:col-span-3">
              <label className="mb-1 block text-sm font-semibold text-[#3d4f7d]">Pesan ke dosen</label>
              <textarea
                value={form.pesan}
                onChange={(event) => {
                  setForm((prev) => ({ ...prev, pesan: event.target.value }));
                  setFormErrors((prev) => ({ ...prev, pesan: "" }));
                }}
                placeholder="Tulis topik yang ingin dibahas pada sesi bimbingan..."
                rows={3}
                className={`w-full rounded-lg border px-3 py-2 text-sm text-[#1b274b] outline-none focus:border-[#2f63e3] ${
                  formErrors.pesan ? "border-[#dc4b4b] bg-[#fff7f7]" : "border-[#d3dbef]"
                }`}
              />
              {formErrors.pesan ? <p className="mt-1 text-xs font-semibold text-[#c23737]">{formErrors.pesan}</p> : null}
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-[#3d4f7d]">Tanggal</label>
              <input
                type="date"
                value={form.tanggal}
                onChange={(event) => {
                  setForm((prev) => ({ ...prev, tanggal: event.target.value }));
                  setFormErrors((prev) => ({ ...prev, tanggal: "" }));
                }}
                className={`w-full rounded-lg border px-3 py-2 text-sm text-[#1b274b] outline-none focus:border-[#2f63e3] ${
                  formErrors.tanggal ? "border-[#dc4b4b] bg-[#fff7f7]" : "border-[#d3dbef]"
                }`}
              />
              {formErrors.tanggal ? <p className="mt-1 text-xs font-semibold text-[#c23737]">{formErrors.tanggal}</p> : null}
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-[#3d4f7d]">Jam</label>
              <input
                type="time"
                value={form.jam}
                onChange={(event) => {
                  setForm((prev) => ({ ...prev, jam: event.target.value }));
                  setFormErrors((prev) => ({ ...prev, jam: "" }));
                }}
                className={`w-full rounded-lg border px-3 py-2 text-sm text-[#1b274b] outline-none focus:border-[#2f63e3] ${
                  formErrors.jam ? "border-[#dc4b4b] bg-[#fff7f7]" : "border-[#d3dbef]"
                }`}
              />
              {formErrors.jam ? <p className="mt-1 text-xs font-semibold text-[#c23737]">{formErrors.jam}</p> : null}
            </div>
            <div className="flex items-end justify-end">
              <button
                type="submit"
                disabled={submittingRequest || !dosenPembimbing}
                className="inline-flex items-center gap-2 rounded-lg bg-[#2f63e3] px-4 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-55"
              >
                <Send className="h-4 w-4" />
                {submittingRequest ? "Mengirim..." : "Kirim Permohonan"}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {mode === "detail" ? (
        <section className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
          {selectedRow ? (
            <div className="space-y-4">
              {activeViewTab === "resume" ? (
                <>
                  <div>
                    <h3 className="text-lg font-black text-[#1b274b]">
                      {canSubmitResumeOnDetail ? "Isi Resume Bimbingan" : "Detail Resume Bimbingan"}
                    </h3>
                    <p className="text-sm text-[#5d6c91]">
                      {canSubmitResumeOnDetail
                        ? "Lengkapi resume sesi bimbingan sebagai tindak lanjut setelah sesi disetujui dosen."
                        : "Lihat status sesi bimbingan dan tunggu jadwal dimulai sebelum mengirim resume."}
                    </p>
                  </div>

                  <div className="rounded-lg border border-[#e2e9f8] bg-[#f8fbff] p-4">
                    <h4 className="text-sm font-black text-[#1b274b]">Ringkasan Sesi Bimbingan</h4>
                    <div className="mt-3 space-y-2 text-sm text-[#324c86]">
                      <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-3">
                        <span className="font-semibold text-[#5a6a93]">Tanggal/Jam</span>
                        <span className="font-semibold text-[#1f2d53]">
                          {formatDate(selectedRow.permintaan_tanggal)} | {selectedRow.permintaan_jam || "-"}
                        </span>
                      </div>
                      <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-3">
                        <span className="font-semibold text-[#5a6a93]">Lokasi</span>
                        <span className="font-semibold text-[#1f2d53]">{selectedRow.lokasi_bimbingan || "-"}</span>
                      </div>
                      <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-3">
                        <span className="font-semibold text-[#5a6a93]">Status Resume</span>
                        <span>
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${selectedResumeStatusMeta.badgeClass}`}>
                            {selectedResumeStatusMeta.label || "-"}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-[#e2e9f8] bg-white p-4">
                    <h4 className="text-sm font-black text-[#1b274b]">Catatan Dosen</h4>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-[#2c406f]">{selectedRow.catatan_dosen || "-"}</p>
                    <p className="mt-3 inline-flex items-center gap-1 text-sm text-[#42588f]">
                      <MapPin className="h-4 w-4" />
                      Lokasi: {selectedRow.lokasi_bimbingan || "-"}
                    </p>
                  </div>

                  {selectedRow.catatan_review_resume ? (
                    <div className="rounded-lg border border-[#e2e9f8] bg-white p-4">
                      <h4 className="text-sm font-black text-[#1b274b]">Catatan Review Dosen</h4>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-[#2c406f]">{selectedRow.catatan_review_resume || "-"}</p>
                    </div>
                  ) : null}
                </>
              ) : (
                <>
                  <div>
                    <h3 className="text-lg font-black text-[#1b274b]">Detail Sesi Bimbingan</h3>
                    <p className="text-sm text-[#5d6c91]">Lihat status sesi, catatan dosen, dan tindak lanjut resume bimbingan.</p>
                  </div>

                  <div className="rounded-lg border border-[#e2e9f8] bg-[#f8fbff] p-4">
                    <h4 className="text-sm font-black text-[#1b274b]">Ringkasan Permohonan</h4>
                    <div className="mt-3 space-y-2 text-sm text-[#324c86]">
                      <div className="grid grid-cols-[160px_minmax(0,1fr)] gap-3">
                        <span className="font-semibold text-[#5a6a93]">Tanggal Bimbingan</span>
                        <span className="font-semibold text-[#1f2d53]">{formatDate(selectedRow.permintaan_tanggal)}</span>
                      </div>
                      <div className="grid grid-cols-[160px_minmax(0,1fr)] gap-3">
                        <span className="font-semibold text-[#5a6a93]">Waktu Bimbingan</span>
                        <span className="font-semibold text-[#1f2d53]">{selectedRow.permintaan_jam || "-"}</span>
                      </div>
                      <div className="grid grid-cols-[160px_minmax(0,1fr)] gap-3">
                        <span className="font-semibold text-[#5a6a93]">Status Permohonan</span>
                        <span>
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusPermohonanBadge(
                              selectedRow.status_permohonan,
                              selectedIsOverduePending
                            )}`}
                          >
                            {selectedIsOverduePending
                              ? "Terlampaui (Pending)"
                              : selectedRow.status_permohonan_label || "-"}
                          </span>
                        </span>
                      </div>
                      <div className="grid grid-cols-[160px_minmax(0,1fr)] gap-3">
                        <span className="font-semibold text-[#5a6a93]">Status Resume</span>
                        <span>
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${selectedResumeStatusMeta.badgeClass}`}>
                            {selectedResumeStatusMeta.label || "-"}
                          </span>
                        </span>
                      </div>
                      <div className="grid grid-cols-[160px_minmax(0,1fr)] gap-3">
                        <span className="font-semibold text-[#5a6a93]">Pesan Mahasiswa</span>
                        <p className="whitespace-pre-wrap font-semibold text-[#1f2d53]">{selectedRow.permintaan_pesan || "-"}</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-[#e2e9f8] bg-white p-4">
                    <h4 className="text-sm font-black text-[#1b274b]">Pesan dari Dosen</h4>
                    <div className="mt-3 space-y-2 text-sm text-[#324c86]">
                      <div className="grid grid-cols-[160px_minmax(0,1fr)] gap-3">
                        <span className="font-semibold text-[#5a6a93]">Catatan Dosen</span>
                        <p className="whitespace-pre-wrap font-semibold text-[#1f2d53]">{selectedRow.catatan_dosen || "-"}</p>
                      </div>
                      <div className="grid grid-cols-[160px_minmax(0,1fr)] gap-3">
                        <span className="font-semibold text-[#5a6a93]">Lokasi</span>
                        <p className="inline-flex items-center gap-1 font-semibold text-[#1f2d53]">
                          <MapPin className="h-4 w-4" />
                          {selectedRow.lokasi_bimbingan || "-"}
                        </p>
                      </div>
                    </div>
                  </div>

                </>
              )}

              {selectedIsOverduePending ? (
                <div className="rounded-lg border border-[#f6d8d8] bg-[#fff3f3] p-4">
                  <p className="text-sm font-semibold text-[#8a2f2f]">
                    Jadwal yang diajukan sudah lewat. Kamu bisa menunggu respons dosen, atau tarik permohonan ini.
                  </p>
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        handleExpireRequest(selectedRow).catch(() => {});
                      }}
                      disabled={expiringRequestId === selectedRow.id}
                      className="rounded-lg bg-[#b73a3a] px-3 py-2 text-xs font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {expiringRequestId === selectedRow.id ? "Memproses..." : "Tarik Permohonan (Expired)"}
                    </button>
                  </div>
                </div>
              ) : null}

              {activeViewTab === "resume" && selectedResumeWaitingSessionStart ? (
                <div className="rounded-lg border border-[#f4e4b5] bg-[#fff9e8] p-4">
                  <p className="text-sm font-semibold text-[#8b6400]">
                    Resume belum bisa diisi. Tunggu sampai sesi dimulai pada {formatDate(selectedRow.permintaan_tanggal)} pukul{" "}
                    {selectedRow.permintaan_jam || "--:--"} WIB.
                  </p>
                </div>
              ) : null}

              {canSubmitResumeOnDetail ? (
                <div className="rounded-lg border border-[#dce6ff] bg-[#f7faff] p-4">
                  {shouldShowPreviousRejectedResume ? (
                    <div className="mb-4 rounded-lg border border-[#e2e9f8] bg-white p-3">
                      <h5 className="text-sm font-black text-[#1b274b]">Resume Sebelumnya (Perlu Revisi)</h5>
                      <textarea
                        rows={4}
                        value={selectedRow.resume_mahasiswa || ""}
                        readOnly
                        disabled
                        className="mt-2 w-full rounded-lg border border-[#d6deef] bg-[#f7f9ff] px-3 py-2 text-sm text-[#50618f] outline-none disabled:cursor-not-allowed disabled:opacity-100"
                      />
                      <p className="mt-2 text-xs font-semibold text-[#5d6c91]">
                        Gunakan resume sebelumnya sebagai referensi sebelum mengirim revisi.
                      </p>
                    </div>
                  ) : null}
                  <h4 className="text-sm font-black text-[#1b274b]">Kirim Resume Bimbingan</h4>
                  <textarea
                    rows={4}
                    value={resumeDraft[selectedRow.id] || ""}
                    onChange={(event) =>
                      setResumeDraft((prev) => ({
                        ...prev,
                        [selectedRow.id]: event.target.value,
                      }))
                    }
                    placeholder="Tuliskan ringkasan hasil diskusi dan rencana tindak lanjut..."
                    className="mt-2 w-full rounded-lg border border-[#cfdaf0] px-3 py-2 text-sm text-[#1b274b] outline-none focus:border-[#2f63e3]"
                  />
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      disabled={submittingResumeId === selectedRow.id}
                      onClick={() => {
                        handleSubmitResume(selectedRow.id).catch(() => {});
                      }}
                      className="inline-flex items-center gap-2 rounded-lg bg-[#2f63e3] px-4 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      <Send className="h-4 w-4" />
                      {submittingResumeId === selectedRow.id ? "Mengirim..." : "Kirim Resume"}
                    </button>
                  </div>
                </div>
              ) : null}

              {isApprovedLikeStatus(selectedRow.status_permohonan) && selectedRow.status_resume === "submitted" ? (
                <div className="inline-flex items-center gap-2 rounded-md bg-[#edf3ff] px-3 py-2 text-sm font-semibold text-[#2f63e3]">
                  <Clock3 className="h-4 w-4" />
                  Resume sedang menunggu review dosen pembimbing.
                </div>
              ) : null}

              {selectedRow.status_resume === "approved" && selectedRow.is_counted ? (
                <div className="inline-flex items-center gap-2 rounded-md bg-[#e8f8ef] px-3 py-2 text-sm font-semibold text-[#1f8a58]">
                  <CheckCircle2 className="h-4 w-4" />
                  Sesi ini sudah dihitung ke progres minimal 8 bimbingan.
                </div>
              ) : null}

              {selectedRow.status_permohonan === "rejected" ? (
                <div className="inline-flex items-center gap-2 rounded-md bg-[#ffeded] px-3 py-2 text-sm font-semibold text-[#b03d3d]">
                  <XCircle className="h-4 w-4" />
                  Permohonan ditolak. Silakan ajukan jadwal baru.
                </div>
              ) : null}

              {selectedRow.status_permohonan === "expired" ? (
                <div className="inline-flex items-center gap-2 rounded-md bg-[#ffeded] px-3 py-2 text-sm font-semibold text-[#b03d3d]">
                  <XCircle className="h-4 w-4" />
                  Permohonan ini sudah expired karena ditarik mahasiswa.
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-lg border border-[#e8ecf6] bg-[#fafcff] px-4 py-6 text-sm font-semibold text-[#5d6c91]">
              Data detail tidak ditemukan. Silakan kembali ke list.
            </div>
          )}
        </section>
      ) : null}

      {mode === "detail" && selectedRow && activeViewTab !== "resume" ? (
        <section className="rounded-xl border border-[#d9e4ff] bg-white p-4 shadow-sm">
          <div>
            <h3 className="text-xl font-black text-[#1b274b]">Detail Resume Bimbingan</h3>
    
          </div>

          <div className="mt-4 rounded-xl border-2 border-[#c9d9ff] bg-[#f3f7ff] p-5">
            <label className="block text-sm font-semibold text-[#5a6a93]">Resume Mahasiswa</label>
            <textarea
              rows={5}
              value={selectedRow.resume_mahasiswa || ""}
              readOnly
              disabled
              placeholder="Resume bimbingan masih belum diisi."
              className="mt-2 w-full rounded-lg border border-[#d6deef] bg-[#f7f9ff] px-3 py-2 text-sm text-[#50618f] outline-none disabled:cursor-not-allowed disabled:opacity-100"
            />
            <p className="mt-2 text-xs font-semibold text-[#5d6c91]">
              {selectedResumeText
                ? "Resume hanya bisa diubah dari tab Resume Bimbingan."
                : "Resume bimbingan masih belum diisi."}
            </p>

            {selectedRow.catatan_review_resume ? (
              <div className="mt-4 rounded-lg border border-[#dbe5ff] bg-white p-3">
                <p className="text-sm font-black text-[#1b274b]">Pesan Revisi Dosen</p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-[#2c406f]">{selectedRow.catatan_review_resume || "-"}</p>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}

export default BimbinganPage;


