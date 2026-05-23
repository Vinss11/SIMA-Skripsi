import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  RefreshCcw,
  Search,
  Send,
} from "lucide-react";
import Swal from "sweetalert2";

const PAGE_SIZE = 10;
const DOSEN_REVIEW_TABS = [
  { key: "permohonan_sesi", label: "Permohonan Sesi" },
  { key: "resume_bimbingan", label: "Resume Bimbingan" },
];

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

function formatLabel(value) {
  if (!value) return "-";
  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function statusPermohonanBadge(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "approved") return "bg-[#137748] text-white";
  if (normalized === "rejected") return "bg-[#b73a3a] text-white";
  if (normalized === "pending") return "bg-[#fdf1d4] text-[#a06a00]";
  return "bg-[#eef2fb] text-[#5c6d95]";
}

function statusResumeBadge(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "approved") return "bg-[#137748] text-white";
  if (normalized === "rejected") return "bg-[#b73a3a] text-white";
  if (normalized === "pending" || normalized === "revisi") return "bg-[#fdf1d4] text-[#a06a00]";
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

function DosenBimbinganReviewPage({ session, apiBaseUrl, onSessionExpired, onRefreshParent, onModeChange }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);
  const [activeReviewTab, setActiveReviewTab] = useState("permohonan_sesi");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const [mode, setMode] = useState("list");
  const [selectedRowId, setSelectedRowId] = useState(null);
  const [selectedRow, setSelectedRow] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [decision, setDecision] = useState("approve");
  const [decisionCatatan, setDecisionCatatan] = useState("");
  const [decisionTanggal, setDecisionTanggal] = useState("");
  const [decisionJam, setDecisionJam] = useState("");
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
      const queryView = new URLSearchParams({ view: activeReviewTab }).toString();
      const data = await fetchWithAuth(`/api/dosen/bimbingan?${queryView}`);
      setRows(Array.isArray(data?.rows) ? data.rows : []);
    } catch (loadError) {
      if (loadError.message !== "__SESSION_EXPIRED__") {
        setError(loadError.message || "Gagal memuat data bimbingan mahasiswa.");
      }
    } finally {
      setLoading(false);
    }
  }, [activeReviewTab, fetchWithAuth]);

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

  useEffect(() => {
    setMode("list");
    setSelectedRowId(null);
    setSelectedRow(null);
    setQuery("");
    setPage(1);
  }, [activeReviewTab]);

  const filteredRows = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return rows;
    return rows.filter((row) => {
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
  }, [query, rows]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE)), [filteredRows.length]);
  const pagedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, page]);

  const rangeStart = filteredRows.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, filteredRows.length);

  useEffect(() => {
    setPage(1);
  }, [query, activeReviewTab]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const backToList = () => {
    setMode("list");
    setSelectedRowId(null);
    setSelectedRow(null);
    setDecision("approve");
    setDecisionCatatan("");
    setDecisionTanggal("");
    setDecisionJam("");
    setDecisionLokasi("");
    setResumeAction("approve");
    setResumeCatatan("");
  };

  const openActionPage = async (row, actionType) => {
    if (!row?.id) return;

    setSelectedRowId(row.id);
    setMode("detail");

    if (actionType === "permohonan_reject") {
      setDecision("reject");
    } else {
      setDecision("approve");
    }

    if (actionType === "resume_reject") {
      setResumeAction("reject");
    } else {
      setResumeAction("approve");
    }

    setDecisionCatatan(row.catatan_dosen || "");
    setDecisionTanggal(row.permintaan_tanggal || "");
    setDecisionJam(row.permintaan_jam || "");
    setDecisionLokasi(row.lokasi_bimbingan || "");
    setResumeCatatan("");

    await loadDetail(row.id);
  };

  const handleRefresh = async () => {
    await loadData();
    if (mode === "detail" && selectedRowId) {
      await loadDetail(selectedRowId);
    }
    onRefreshParent?.();
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

    if (decision === "approve") {
      if (!decisionTanggal) {
        showErrorToast("Tanggal bimbingan wajib diisi.");
        return;
      }
      if (!isValidJam(decisionJam)) {
        showErrorToast("Waktu bimbingan wajib format HH:mm.");
        return;
      }
      if (decisionLokasi.trim().length < 3) {
        showErrorToast("Ruangan/lokasi bimbingan minimal 3 karakter.");
        return;
      }
    }

    const endpoint =
      decision === "approve"
        ? `/api/dosen/bimbingan/${selectedRowId}/approve`
        : `/api/dosen/bimbingan/${selectedRowId}/reject`;

    const body =
      decision === "approve"
        ? {
            catatan_dosen: catatanTrimmed,
            tanggal_bimbingan: decisionTanggal,
            jam_bimbingan: decisionJam,
            lokasi_bimbingan: decisionLokasi.trim(),
          }
        : { catatan_dosen: catatanTrimmed };

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
    if (resumeAction === "reject" && catatanTrimmed.length < 5) {
      showErrorToast("Catatan review minimal 5 karakter untuk penolakan resume.");
      return;
    }

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
    <div className={mode === "list" ? "flex min-h-0 flex-1 flex-col gap-4" : "space-y-4"}>
      <div className="rounded-xl border border-[#e4e9f6] bg-white p-3 shadow-sm">
        <p className="text-sm font-black text-[#1b274b]">Menu Review Bimbingan</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {DOSEN_REVIEW_TABS.map((tab) => {
            const isActive = activeReviewTab === tab.key;
            return (
              <button
                key={`review-tab-${tab.key}`}
                type="button"
                onClick={() => setActiveReviewTab(tab.key)}
                className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                  isActive
                    ? "border-[#2f63e3] bg-[#edf3ff] text-[#2f63e3]"
                    : "border-[#d3dbef] bg-white text-[#4d5e89] hover:bg-[#f5f8ff]"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-[#dce4f7] bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={backToList}
            disabled={mode === "list"}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#d3dbef] text-[#27407b] transition hover:bg-[#f3f6ff] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Kembali ke data review bimbingan"
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
        </div>
      </div>

      {mode === "list" ? (
        <>
          <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-black text-[#1b274b]">
                {activeReviewTab === "permohonan_sesi"
                  ? "Grid Permohonan Sesi Bimbingan"
                  : "Grid Resume Bimbingan Mahasiswa"}
              </h3>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7282a8]" />
                  <input
                    type="text"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={
                      activeReviewTab === "permohonan_sesi"
                        ? "Cari NIM, nama, pesan, status, tanggal..."
                        : "Cari NIM, nama, resume, status, tanggal..."
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
                    <th className="bg-[#f8fbff] px-3 py-2 font-semibold">
                      {activeReviewTab === "permohonan_sesi" ? "Permintaan" : "Resume Mahasiswa"}
                    </th>
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
                          <tr key={`row-bimbingan-dosen-${row.id}`} className="border-b border-[#eff3fb] align-middle">
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
                              <p className="line-clamp-2">
                                {activeReviewTab === "permohonan_sesi"
                                  ? row.permintaan_pesan || "-"
                                  : row.resume_mahasiswa || "-"}
                              </p>
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
                                {activeReviewTab === "permohonan_sesi" ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        openActionPage(row, "permohonan_approve").catch(() => {});
                                      }}
                                      className="rounded-md bg-[#137748] px-3 py-1 text-xs font-bold text-white transition hover:brightness-110"
                                    >
                                      Approve
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        openActionPage(row, "permohonan_reject").catch(() => {});
                                      }}
                                      className="rounded-md bg-[#b73a3a] px-3 py-1 text-xs font-bold text-white transition hover:brightness-110"
                                    >
                                      Reject
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        openActionPage(row, "resume_approve").catch(() => {});
                                      }}
                                      className="rounded-md bg-[#137748] px-3 py-1 text-xs font-bold text-white transition hover:brightness-110"
                                    >
                                      Approve
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        openActionPage(row, "resume_reject").catch(() => {});
                                      }}
                                      className="rounded-md bg-[#b73a3a] px-3 py-1 text-xs font-bold text-white transition hover:brightness-110"
                                    >
                                      Reject
                                    </button>
                                  </>
                                )}
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
                  {activeReviewTab === "permohonan_sesi"
                    ? "Belum ada permohonan sesi bimbingan dari mahasiswa."
                    : "Belum ada resume bimbingan yang menunggu review."}
                </div>
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#e8edf8] pt-3">
              <p className="text-sm text-[#4f5e86]">
                Menampilkan {rangeStart} - {rangeEnd} dari {filteredRows.length} data{" "}
                {activeReviewTab === "permohonan_sesi" ? "permohonan sesi" : "resume bimbingan"}.
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
        </>
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
              <h3 className="text-lg font-black text-[#1b274b]">
                {activeReviewTab === "permohonan_sesi"
                  ? "Review Permohonan Sesi Bimbingan"
                  : "Review Resume Bimbingan"}
              </h3>
              <p className="text-sm text-[#5d6c91]">
                {activeReviewTab === "permohonan_sesi"
                  ? "Tetapkan keputusan dosen untuk permohonan sesi bimbingan mahasiswa."
                  : "Review dan putuskan hasil resume bimbingan mahasiswa."}
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
                  <h4 className="text-sm font-black text-[#1b274b]">Identitas Mahasiswa</h4>
                  <div className="mt-2 grid grid-cols-1 gap-2 text-sm text-[#324c86]">
                    <p>
                      <span className="font-semibold">NIM:</span> {selectedRow.mahasiswa?.nim || "-"}
                    </p>
                    <p>
                      <span className="font-semibold">Nama:</span> {selectedRow.mahasiswa?.nama || "-"}
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-[#e2e9f8] bg-white p-4">
                  <h4 className="text-sm font-black text-[#1b274b]">
                    {activeReviewTab === "permohonan_sesi"
                      ? "Ringkasan Permohonan Sesi"
                      : "Ringkasan Sesi Bimbingan"}
                  </h4>
                  <div className="mt-2 grid grid-cols-1 gap-2 text-sm text-[#324c86]">
                    <p>
                      <span className="font-semibold">Tanggal:</span> {formatDate(selectedRow.permintaan_tanggal)}
                    </p>
                    <p>
                      <span className="font-semibold">Waktu:</span> {selectedRow.permintaan_jam || "-"}
                    </p>
                    <p>
                      <span className="font-semibold">Ruangan:</span> {selectedRow.lokasi_bimbingan || "-"}
                    </p>
                    {activeReviewTab === "resume_bimbingan" ? (
                      <p className="text-xs text-[#5e6f98]">
                        Sesi ini sudah disetujui, mahasiswa telah mengirim resume untuk direview.
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

              {activeReviewTab === "permohonan_sesi" ? (
                <div className="rounded-lg border border-[#e2e9f8] bg-white p-4">
                  <h4 className="text-sm font-black text-[#1b274b]">Pesan Mahasiswa</h4>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-[#2c406f]">{selectedRow.permintaan_pesan || "-"}</p>
                </div>
              ) : null}

              {activeReviewTab === "resume_bimbingan" ? (
                <div className="rounded-lg border border-[#e2e9f8] bg-white p-4">
                  <h4 className="text-sm font-black text-[#1b274b]">Resume Mahasiswa</h4>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-[#2c406f]">{selectedRow.resume_mahasiswa || "-"}</p>
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
                    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                      <div>
                        <label className="mb-1 block text-sm font-semibold text-[#3d4f7d]">Tanggal Bimbingan</label>
                        <input
                          type="date"
                          value={decisionTanggal}
                          onChange={(event) => setDecisionTanggal(event.target.value)}
                          className="w-full rounded-lg border border-[#cfdaf0] px-3 py-2 text-sm text-[#1b274b] outline-none focus:border-[#2f63e3]"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-semibold text-[#3d4f7d]">Waktu Bimbingan</label>
                        <input
                          type="time"
                          value={decisionJam}
                          onChange={(event) => setDecisionJam(event.target.value)}
                          className="w-full rounded-lg border border-[#cfdaf0] px-3 py-2 text-sm text-[#1b274b] outline-none focus:border-[#2f63e3]"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-semibold text-[#3d4f7d]">Ruangan Bimbingan</label>
                        <input
                          type="text"
                          value={decisionLokasi}
                          onChange={(event) => setDecisionLokasi(event.target.value)}
                          placeholder="Contoh: Ruang Dosen 2.14 / Zoom"
                          className="w-full rounded-lg border border-[#cfdaf0] px-3 py-2 text-sm text-[#1b274b] outline-none focus:border-[#2f63e3]"
                        />
                      </div>
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
                          : "Wajib isi alasan penolakan."
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

            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default DosenBimbinganReviewPage;
