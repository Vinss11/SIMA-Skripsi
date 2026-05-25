import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowLeft,
  Eye,
  FileSearch,
  RefreshCcw,
} from "lucide-react";

const PAGE_SIZE = 20;

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

function getStatusChip(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "approved") {
    return {
      label: "Approved",
      className: "bg-[#137748] text-white",
    };
  }
  if (normalized === "rejected") {
    return {
      label: "Rejected",
      className: "bg-[#b73a3a] text-white",
    };
  }
  if (normalized === "pending") {
    return {
      label: "Pending",
      className: "bg-[#fdf1d4] text-[#a06a00]",
    };
  }
  return {
    label: formatLabel(status),
    className: "bg-[#eef2fb] text-[#5c6d95]",
  };
}

function getTahapLabel(tahapApproval, tipePengajuan, status) {
  const tahap = String(tahapApproval || "");
  const tipe = String(tipePengajuan || "").toLowerCase();
  const normalizedStatus = String(status || "").toLowerCase();

  if (normalizedStatus === "approved") return "Selesai (Disetujui)";
  if (normalizedStatus === "rejected") return "Selesai (Ditolak)";
  if (tipe === "judul_mandiri" && normalizedStatus === "pending") return "Menunggu Review Dosen";
  if (tahap === "pending_ketua_klaster") return "Menunggu Review Ketua Cluster";
  if (tahap === "pending_dosen_pembimbing") return "Menunggu Review Dosen Pembimbing";
  if (normalizedStatus === "pending") return "Sedang Direview";
  return formatLabel(tahap || status || "-");
}

function normalizeClusterFromTopikCode(code) {
  const value = String(code || "").trim().toUpperCase();
  if (!value) return null;
  if (value.startsWith("SIRKER")) return "SIRKEL";
  if (value.startsWith("SIRKEL")) return "SIRKEL";
  if (value.startsWith("ITSC")) return "ITSC";
  if (value.startsWith("SIBER")) return "SIBER";
  if (value.startsWith("MVK")) return "MVK";
  if (value.startsWith("MEDIS") || value.startsWith("SDATA")) return "ITSC";
  return null;
}

function getTopikCodesFromRow(row) {
  if (!row || row.tipe_pengajuan !== "topik_dosen") return [];
  if (!Array.isArray(row.topik_dipilih)) return [];
  return row.topik_dipilih.filter(Boolean);
}

function getKodeTopikDisplay(row) {
  if (!row || row.tipe_pengajuan !== "topik_dosen") return "-";
  const approvedKode = typeof row.topik_disetujui === "object" ? row.topik_disetujui?.kode : null;
  if (approvedKode) return approvedKode;
  const codes = getTopikCodesFromRow(row);
  return codes.length > 0 ? codes.join(", ") : "-";
}

function getJudulDisplay(row, detail = null) {
  if (!row) return "-";
  if (row.tipe_pengajuan === "judul_mandiri") {
    return row.judul_mandiri?.judul || detail?.detail_pengajuan?.judul_mandiri || "-";
  }
  if (row.tipe_pengajuan !== "topik_dosen") return "-";
  if (typeof row.topik_disetujui === "object" && row.topik_disetujui?.judul) {
    return row.topik_disetujui.judul;
  }
  if (typeof row.topik_disetujui === "string" && row.topik_disetujui.trim()) {
    return row.topik_disetujui;
  }
  if (Array.isArray(row.topik_dipilih_detail) && row.topik_dipilih_detail.length > 0) {
    return row.topik_dipilih_detail
      .map((item) => item?.judul)
      .filter(Boolean)
      .join(" | ") || "-";
  }
  if (Array.isArray(detail?.detail_pengajuan?.topik_dipilih) && detail.detail_pengajuan.topik_dipilih.length > 0) {
    return detail.detail_pengajuan.topik_dipilih
      .map((item) => item?.judul)
      .filter(Boolean)
      .join(" | ") || "-";
  }
  return "-";
}

function getClusterDisplay(row) {
  if (!row || row.tipe_pengajuan !== "topik_dosen") return "-";
  const codes = [];
  if (typeof row.topik_disetujui === "object" && row.topik_disetujui?.kode) {
    codes.push(row.topik_disetujui.kode);
  } else {
    codes.push(...getTopikCodesFromRow(row));
  }

  const clusters = [...new Set(codes.map(normalizeClusterFromTopikCode).filter(Boolean))];
  return clusters.length > 0 ? clusters.join(", ") : "-";
}

function StatusPage({
  session,
  apiBaseUrl,
  onSessionExpired,
  initialSubmissions = [],
}) {
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);

  const [submissions, setSubmissions] = useState(
    Array.isArray(initialSubmissions) ? initialSubmissions : []
  );
  const [selectedSubmissionId, setSelectedSubmissionId] = useState(
    Array.isArray(initialSubmissions) && initialSubmissions[0] ? initialSubmissions[0].id : null
  );
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [viewMode, setViewMode] = useState("list");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let isMounted = true;

    const fetchWithAuth = async (path) => {
      const response = await fetch(`${apiBaseUrl}${path}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.token}`,
          "Content-Type": "application/json",
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
        throw new Error(payload?.message || `Gagal memuat data ${path}`);
      }

      return payload.data;
    };

    const loadSummary = async () => {
      setLoading(true);
      setError("");

      const submissionsResult = await fetchWithAuth("/api/submissions")
        .then((value) => ({ status: "fulfilled", value }))
        .catch((reason) => ({ status: "rejected", reason }));

      if (!isMounted) return;

      const issues = [];
      let nextSubmissions = [];

      if (submissionsResult.status === "fulfilled") {
        nextSubmissions = Array.isArray(submissionsResult.value) ? submissionsResult.value : [];
        setSubmissions(nextSubmissions);
      } else if (submissionsResult.reason?.message !== "__SESSION_EXPIRED__") {
        setSubmissions([]);
        issues.push(submissionsResult.reason?.message || "Gagal memuat data submissions.");
      }

      if (nextSubmissions.length === 0) {
        setSelectedSubmissionId(null);
        setSelectedDetail(null);
        setViewMode("list");
      } else {
        setSelectedSubmissionId((prev) =>
          nextSubmissions.some((row) => row.id === prev) ? prev : nextSubmissions[0].id
        );
      }

      setError(issues.join(" "));
      setLoading(false);
    };

    loadSummary();

    return () => {
      isMounted = false;
    };
  }, [apiBaseUrl, onSessionExpired, refreshTick, session.token]);

  useEffect(() => {
    let isMounted = true;
    if (!selectedSubmissionId) {
      setSelectedDetail(null);
      setDetailError("");
      return;
    }

    const fetchWithAuth = async (path) => {
      const response = await fetch(`${apiBaseUrl}${path}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.token}`,
          "Content-Type": "application/json",
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
        throw new Error(payload?.message || `Gagal memuat detail pengajuan ${selectedSubmissionId}`);
      }

      return payload.data;
    };

    const loadDetail = async () => {
      setLoadingDetail(true);
      setDetailError("");

      try {
        const detail = await fetchWithAuth(`/api/submissions/${selectedSubmissionId}`);
        if (!isMounted) return;
        setSelectedDetail(detail || null);
      } catch (detailLoadError) {
        if (!isMounted) return;
        if (detailLoadError.message !== "__SESSION_EXPIRED__") {
          setSelectedDetail(null);
          setDetailError(detailLoadError.message || "Gagal memuat detail pengajuan.");
        }
      } finally {
        if (isMounted) setLoadingDetail(false);
      }
    };

    loadDetail();

    return () => {
      isMounted = false;
    };
  }, [apiBaseUrl, onSessionExpired, refreshTick, selectedSubmissionId, session.token]);

  const filteredRows = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return submissions;

    return submissions.filter((row) => {
      const topikText = getJudulDisplay(row);
      const kodeTopik = getKodeTopikDisplay(row);
      const cluster = getClusterDisplay(row);

      const haystack = [
        row.id,
        row.jenis_jalur,
        row.tipe_pengajuan,
        row.status,
        row.tahap_approval,
        topikText,
        kodeTopik,
        cluster,
        row.dosen_pembimbing,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(keyword);
    });
  }, [query, submissions]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE)),
    [filteredRows.length]
  );

  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, page]);

  const rowStart = filteredRows.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rowEnd = filteredRows.length === 0 ? 0 : Math.min(filteredRows.length, page * PAGE_SIZE);

  const selectedSubmissionRow = useMemo(
    () => submissions.find((row) => row.id === selectedSubmissionId) || null,
    [submissions, selectedSubmissionId]
  );
  const selectedTopikRows = useMemo(() => {
    if (!selectedDetail || selectedDetail.tipe_pengajuan !== "topik_dosen") return [];
    return Array.isArray(selectedDetail.detail_pengajuan?.topik_dipilih)
      ? selectedDetail.detail_pengajuan.topik_dipilih
      : [];
  }, [selectedDetail]);
  const alasanPenolakanList = useMemo(() => {
    const raw = selectedDetail?.hasil_pengajuan?.alasan_penolakan;
    if (Array.isArray(raw)) return raw.filter((item) => String(item || "").trim().length > 0);
    if (typeof raw === "string" && raw.trim().length > 0) return [raw.trim()];
    return [];
  }, [selectedDetail]);
  const selectedStatusChip = getStatusChip(selectedDetail?.status || selectedSubmissionRow?.status || "-");

  const handleOpenDetail = (submissionId) => {
    setSelectedSubmissionId(submissionId);
    setViewMode("detail");
  };

  const handleBackToList = () => {
    setViewMode("list");
  };

  const handleRefresh = () => {
    setRefreshTick((prev) => prev + 1);
  };

  return (
    <div className="w-full space-y-4 pb-8">
      {error ? (
        <div className="rounded-lg border border-[#f5d0d0] bg-[#fff2f2] px-4 py-3 text-sm font-semibold text-[#a03f3f]">
          {error}
        </div>
      ) : null}

      

      <section className="rounded-xl border border-[#dce4f7] bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleBackToList}
            disabled={viewMode === "list"}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#d3dbef] text-[#27407b] transition hover:bg-[#f3f6ff] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Kembali ke daftar riwayat pengajuan"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleRefresh}
            className="inline-flex items-center gap-2 rounded-lg border border-[#d3dbef] px-3 py-2 text-sm font-semibold text-[#27407b] transition hover:bg-[#f3f6ff]"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </section>

      {viewMode === "list" ? (
      <section className="rounded-xl border border-[#e8ecf6] bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-black text-[#1a2648]">Riwayat Pengajuan</h3>
          <div className="relative">
            <Activity className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7282a8]" />
            <input
              type="text"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Cari ID, jalur, tipe, status, judul, cluster, kode..."
              className="w-[320px] rounded-lg border border-[#d3dbef] py-2 pl-8 pr-3 text-sm outline-none focus:border-[#2f63e3]"
            />
          </div>
        </div>

        <div className="relative overflow-auto rounded-lg border border-[#e6ecf8] bg-white grid-unified-height-dynamic">
          <table className="w-full min-w-[1150px] text-left text-sm">
            <thead>
              <tr className="border-y border-[#e6ecf8] text-[#4d5e89]">
                <th className="bg-[#f8fbff] px-3 py-2 font-semibold">No</th>
                <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Jalur</th>
                <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Tipe</th>
                <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Judul</th>
                <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Cluster</th>
                <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Kode Topik</th>
                <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Status</th>
                <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Tahap</th>
                <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Diperbarui</th>
                <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((row, index) => {
                const chip = getStatusChip(row.status);
                const isSelected = row.id === selectedSubmissionId;
                const judulDisplay = getJudulDisplay(
                  row,
                  row.id === selectedSubmissionId ? selectedDetail : null
                );
                const clusterDisplay = getClusterDisplay(row);
                const kodeTopikDisplay = getKodeTopikDisplay(row);

                return (
                  <tr key={`status-row-${row.id}`} className="border-b border-[#eff3fb]">
                    <td className="px-3 py-2 font-bold text-[#274181]">{rowStart + index}</td>
                    <td className="px-3 py-2">{formatLabel(row.jenis_jalur)}</td>
                    <td className="px-3 py-2">{formatLabel(row.tipe_pengajuan)}</td>
                    <td className="px-3 py-2 max-w-[280px] truncate" title={judulDisplay}>
                      {judulDisplay}
                    </td>
                    <td className="px-3 py-2">{clusterDisplay}</td>
                    <td className="px-3 py-2">{kodeTopikDisplay}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-1 text-xs font-bold ${chip.className}`}>
                        {chip.label}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-xs font-semibold text-[#4f5d85]">
                        {getTahapLabel(row.tahap_approval, row.tipe_pengajuan, row.status)}
                      </span>
                    </td>
                    <td className="px-3 py-2">{formatDateTime(row.updatedAt || row.createdAt)}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => handleOpenDetail(row.id)}
                        className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-bold text-white transition ${
                          isSelected ? "bg-[#2354cf]" : "bg-[#2f63e3] hover:brightness-110"
                        }`}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Detail
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {!loading && filteredRows.length === 0 ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[41px] flex items-center justify-center px-4 text-center text-sm font-semibold text-[#7b88ab]">
              Belum ada riwayat pengajuan.
            </div>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[#e8edf8] pt-3">
          <p className="text-sm text-[#4f5e86]">
            Menampilkan {rowStart} - {rowEnd} dari {filteredRows.length} data pengajuan.
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

      {viewMode === "detail" && selectedDetail ? (
        <section className="rounded-xl border border-[#e8ecf6] bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-xl font-black text-[#1a2648]">Detail Pengajuan</h3>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${selectedStatusChip.className}`}>
              {selectedStatusChip.label}
            </span>
          </div>

          {detailError ? (
            <div className="rounded-lg border border-[#f5d0d0] bg-[#fff2f2] px-3 py-2 text-sm font-semibold text-[#a03f3f]">
              {detailError}
            </div>
          ) : null}

          {loadingDetail ? (
            <div className="rounded-lg border border-[#e8edf8] bg-white p-4 text-sm font-semibold text-[#5f6b89]">
              Memuat detail pengajuan...
            </div>
          ) : null}

          {!loadingDetail && !selectedDetail ? (
            <div className="rounded-lg border border-[#e8edf8] bg-white p-6 text-center">
              <FileSearch className="mx-auto h-10 w-10 text-[#7b88ab]" />
              <p className="mt-3 text-sm font-semibold text-[#5f6b89]">
                Pilih salah satu pengajuan untuk melihat detail.
              </p>
            </div>
          ) : null}

          {!loadingDetail && selectedDetail ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-lg border border-[#e8ecf6] bg-white p-3">
                  <p className="text-xs font-semibold text-[#5f6b89]">Jalur</p>
                  <p className="mt-1 text-sm font-bold text-[#1a2648]">{formatLabel(selectedDetail.jenis_jalur)}</p>
                </div>
                <div className="rounded-lg border border-[#e8ecf6] bg-white p-3">
                  <p className="text-xs font-semibold text-[#5f6b89]">Tipe</p>
                  <p className="mt-1 text-sm font-bold text-[#1a2648]">{formatLabel(selectedDetail.tipe_pengajuan)}</p>
                </div>
                <div className="rounded-lg border border-[#e8ecf6] bg-white p-3">
                  <p className="text-xs font-semibold text-[#5f6b89]">Diajukan</p>
                  <p className="mt-1 text-sm font-bold text-[#1a2648]">{formatDateTime(selectedDetail.diajukan_pada)}</p>
                </div>
                <div className="rounded-lg border border-[#e8ecf6] bg-white p-3">
                  <p className="text-xs font-semibold text-[#5f6b89]">Diperbarui</p>
                  <p className="mt-1 text-sm font-bold text-[#1a2648]">{formatDateTime(selectedDetail.diperbarui_pada)}</p>
                </div>
              </div>

              <div className="rounded-lg border border-[#e8ecf6] bg-white p-4">
                <h4 className="text-base font-black text-[#1a2648]">Detail Topik/Judul</h4>
                {selectedDetail.tipe_pengajuan === "judul_mandiri" ? (
                  <div className="mt-3 space-y-2 text-sm text-[#26355f]">
                    <p><span className="font-semibold">Judul:</span> {selectedDetail.detail_pengajuan?.judul_mandiri || "-"}</p>
                    <p><span className="font-semibold">Deskripsi:</span> {selectedDetail.detail_pengajuan?.deskripsi_mandiri || "-"}</p>
                    <p><span className="font-semibold">Keyword:</span> {selectedDetail.detail_pengajuan?.keyword_mandiri || "-"}</p>
                  </div>
                ) : (
                  <div className="mt-3 space-y-3">
                    {selectedTopikRows.length > 0 ? (
                      selectedTopikRows.map((item) => (
                        <div
                          key={`status-detail-topik-${item.slot || item.kode}`}
                          className="rounded-lg border border-[#e8ecf6] bg-white p-3"
                        >
                          <p className="text-xs font-semibold text-[#60719a]">Pilihan {item.slot || "-"}</p>
                          <p className="mt-1 text-sm font-bold text-[#1a2648]">
                            {item.kode || "-"} - {item.judul || "-"}
                          </p>
                          <p className="mt-1 text-sm text-[#495a84]">Dosen: {item.dosen || "-"}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-[#5f6b89]">Detail topik belum tersedia.</p>
                    )}
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-[#e8ecf6] bg-white p-4">
                <h4 className="text-base font-black text-[#1a2648]">Ringkasan Hasil Review</h4>
                <div className="mt-3 space-y-2 text-sm text-[#26355f]">
                  <p>
                    <span className="font-semibold">Dosen Pembimbing:</span>{" "}
                    {selectedDetail.hasil_pengajuan?.dosen_pembimbing?.nama || "-"}
                  </p>
                  <p>
                    <span className="font-semibold">Alasan Persetujuan:</span>{" "}
                    {selectedDetail.hasil_pengajuan?.alasan_persetujuan || "-"}
                  </p>
                  <div>
                    <p className="font-semibold">Alasan Penolakan:</p>
                    {alasanPenolakanList.length > 0 ? (
                      <ul className="mt-1 list-disc pl-5">
                        {alasanPenolakanList.map((item, index) => (
                          <li key={`status-alasan-penolakan-${index}`}>{item}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1">-</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-[#e8ecf6] bg-white p-4">
                <h4 className="text-base font-black text-[#1a2648]">Riwayat Keputusan Reviewer</h4>
                <div className="mt-3 space-y-3">
                  {(selectedDetail.riwayat_persetujuan || []).length > 0 ? (
                    selectedDetail.riwayat_persetujuan.map((item, index) => {
                      const chip = getStatusChip(item.status);
                      return (
                        <div
                          key={`riwayat-${selectedDetail.id}-${index}`}
                          className="rounded-lg border border-[#e8ecf6] bg-white p-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className={`rounded-full px-2 py-1 text-xs font-bold ${chip.className}`}>
                                {chip.label}
                              </span>
                              <span className="text-xs font-semibold text-[#5b688b]">
                                {formatLabel(item.tipe_approval)}
                              </span>
                            </div>
                            <span className="text-xs font-semibold text-[#5b688b]">
                              {item.dosen?.nama || "-"} | {formatDateTime(item.tanggal_keputusan)}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-[#26355f]">{item.keterangan || "-"}</p>
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-lg border border-[#e8ecf6] bg-white p-4 text-sm text-[#5f6b89]">
                      Belum ada keputusan reviewer untuk pengajuan ini.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

export default StatusPage;


