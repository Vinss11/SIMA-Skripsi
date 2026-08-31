import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Download, Eye, FileText, RefreshCcw, Search, XCircle } from "lucide-react";
import Swal from "sweetalert2";

const PAGE_SIZE = 20;
const DOC_ORDER = ["transkrip", "cept", "draft_skripsi", "paper"];

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

function docStatusBadge(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "approved") return "bg-[#dff3ec] text-[#106d45]";
  if (normalized === "submitted") return "bg-[#fdf1d4] text-[#a06a00]";
  if (normalized === "revisi") return "bg-[#ffe9e9] text-[#b73a3a]";
  return "bg-[#eef2fb] text-[#5c6d95]";
}

function tahapSidangLabel(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "lolos_pendaftaran_sidang") return "Lolos Daftar Sidang";
  if (normalized === "menunggu_review_dosen") return "Menunggu Review Dosen";
  if (normalized === "perlu_revisi_dokumen") return "Perlu Revisi";
  return "Belum Selesai";
}

function showSuccessToast(message) {
  Swal.fire({
    toast: true,
    position: "top-end",
    icon: "success",
    title: message,
    showConfirmButton: false,
    timer: 2500,
    timerProgressBar: true,
  });
}

function DosenDokumenSidangReviewPage({ session, apiBaseUrl, onSessionExpired }) {
  const [mode, setMode] = useState("list");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selectedMahasiswaId, setSelectedMahasiswaId] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detail, setDetail] = useState(null);
  const [savingDocKey, setSavingDocKey] = useState("");
  const [revisionDocKey, setRevisionDocKey] = useState("");
  const [reviewNotes, setReviewNotes] = useState({
    transkrip: "",
    cept: "",
    draft_skripsi: "",
    paper: "",
  });
  const [reviewErrors, setReviewErrors] = useState({});

  const fetchWithAuth = useCallback(async (path, options = {}) => {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${session.token}`,
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });

    if (response.status === 401 || response.status === 403) {
      const payload = await response.json().catch(() => null);
      const message = String(payload?.message || "").toLowerCase();
      const isTokenError =
        message.includes("token tidak valid") ||
        message.includes("token tidak ditemukan") ||
        message.includes("kadaluarsa");
      if (response.status === 401 || isTokenError) {
        onSessionExpired?.();
        throw new Error("__SESSION_EXPIRED__");
      }
    }
    return response;
  }, [apiBaseUrl, onSessionExpired, session.token]);

  const loadRows = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const response = await fetchWithAuth("/api/dosen/dokumen-sidang");
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || "Gagal memuat dokumen sidang mahasiswa.");
      }
      const nextRows = Array.isArray(payload?.data?.rows) ? payload.data.rows : [];
      setRows(nextRows);
    } catch (loadError) {
      if (loadError.message !== "__SESSION_EXPIRED__") {
        setError(loadError.message || "Gagal memuat dokumen sidang mahasiswa.");
      }
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  const loadDetail = useCallback(async (mahasiswaId) => {
    if (!mahasiswaId) return;
    try {
      setLoadingDetail(true);
      setError("");
      const response = await fetchWithAuth(`/api/dosen/dokumen-sidang/${mahasiswaId}`);
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || "Gagal memuat detail dokumen sidang.");
      }
      const nextDetail = payload?.data || null;
      setDetail(nextDetail);
      setRevisionDocKey("");
      setReviewErrors({});
      setReviewNotes({
        transkrip: "",
        cept: "",
        draft_skripsi: "",
        paper: "",
      });
    } catch (detailError) {
      if (detailError.message !== "__SESSION_EXPIRED__") {
        setError(detailError.message || "Gagal memuat detail dokumen sidang.");
      }
    } finally {
      setLoadingDetail(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    loadRows().catch(() => {});
  }, [loadRows]);

  const filteredRows = useMemo(() => {
    const keyword = String(query || "").trim().toLowerCase();
    if (!keyword) return rows;
    return rows.filter((row) => {
      const haystack = [
        row?.mahasiswa?.nim,
        row?.mahasiswa?.nama,
        row?.mahasiswa?.angkatan,
        row?.status_pendaftaran_sidang,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(keyword);
    });
  }, [rows, query]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const pagedRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const rangeStart = filteredRows.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = filteredRows.length === 0 ? 0 : Math.min(filteredRows.length, page * PAGE_SIZE);

  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const openDetail = async (mahasiswaId) => {
    setSelectedMahasiswaId(mahasiswaId);
    setMode("detail");
    await loadDetail(mahasiswaId);
  };

  const handleDownload = async (docKey, fileName) => {
    if (!selectedMahasiswaId) return;
    try {
      const response = await fetchWithAuth(
        `/api/dosen/dokumen-sidang/${selectedMahasiswaId}/${docKey}/download`,
        { headers: { Authorization: `Bearer ${session.token}` } }
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message || "Gagal mengunduh dokumen.");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName || `${docKey}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(url);
    } catch (downloadError) {
      if (downloadError.message !== "__SESSION_EXPIRED__") {
        setError(downloadError.message || "Gagal mengunduh dokumen.");
      }
    }
  };

  const handleView = async (docKey) => {
    if (!selectedMahasiswaId) return;
    const previewWindow = window.open("about:blank", "_blank");
    if (previewWindow) previewWindow.opener = null;
    try {
      setError("");
      const response = await fetchWithAuth(
        `/api/dosen/dokumen-sidang/${selectedMahasiswaId}/${docKey}/download`,
        { headers: { Authorization: `Bearer ${session.token}` } }
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message || "Gagal membuka dokumen.");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      if (previewWindow) {
        previewWindow.location.href = url;
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }
      window.setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
    } catch (viewError) {
      previewWindow?.close();
      if (viewError.message !== "__SESSION_EXPIRED__") {
        setError(viewError.message || "Gagal membuka dokumen.");
      }
    }
  };

  const handleReview = async (docKey, decision) => {
    if (!selectedMahasiswaId) return;
    const currentDocument = detail?.dokumen?.[docKey];
    if (!currentDocument?.can_review) {
      setReviewErrors((current) => ({
        ...current,
        [docKey]: currentDocument?.status === "revisi"
          ? "Keputusan dikunci sampai mahasiswa mengunggah ulang dokumen."
          : currentDocument?.status === "approved"
          ? "Dokumen sudah disetujui dan keputusannya telah dikunci."
          : "Dokumen belum siap direview.",
      }));
      return;
    }
    const note = decision === "revisi" ? String(reviewNotes[docKey] || "").trim() : "";
    if (decision === "revisi" && note.length < 5) {
      setReviewErrors((current) => ({ ...current, [docKey]: "Catatan revisi minimal 5 karakter." }));
      return;
    }
    const confirmation = await Swal.fire({
      title: decision === "approve" ? "Setujui dokumen ini?" : "Kembalikan dokumen untuk revisi?",
      text: decision === "approve"
        ? "Mahasiswa tidak dapat mengunggah ulang setelah dokumen disetujui."
        : "Dosen tidak dapat memberi keputusan lagi sampai mahasiswa mengunggah versi baru.",
      icon: decision === "approve" ? "question" : "warning",
      showCancelButton: true,
      confirmButtonText: decision === "approve" ? "Ya, Approve" : "Ya, Minta Revisi",
      cancelButtonText: "Batal",
      confirmButtonColor: decision === "approve" ? "#137748" : "#b73a3a",
    });
    if (!confirmation.isConfirmed) return;
    try {
      setSavingDocKey(docKey);
      setError("");
      setReviewErrors((current) => ({ ...current, [docKey]: "" }));
      const response = await fetchWithAuth(`/api/dosen/dokumen-sidang/${selectedMahasiswaId}/review`, {
        method: "POST",
        body: JSON.stringify({
          document_key: docKey,
          decision,
          note,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || "Gagal menyimpan review dokumen.");
      }
      setDetail((current) => current ? {
        ...current,
        gate: payload.data?.gate || current.gate,
        summary: payload.data?.summary || current.summary,
        status_pendaftaran_sidang: payload.data?.status_pendaftaran_sidang || current.status_pendaftaran_sidang,
        dokumen: payload.data?.dokumen || current.dokumen,
      } : current);
      setReviewNotes((current) => ({ ...current, [docKey]: "" }));
      setRevisionDocKey("");
      showSuccessToast(
        decision === "approve"
          ? "Dokumen berhasil disetujui dan dikunci."
          : "Permintaan revisi terkirim. Menunggu mahasiswa mengunggah ulang dokumen."
      );
      await loadRows();
    } catch (reviewError) {
      if (reviewError.message !== "__SESSION_EXPIRED__") {
        setReviewErrors((current) => ({ ...current, [docKey]: reviewError.message || "Gagal menyimpan review dokumen." }));
      }
    } finally {
      setSavingDocKey("");
    }
  };

  return (
    <div className={mode === "list" ? "flex min-h-0 flex-1 flex-col gap-4" : "space-y-4"}>
      {error ? (
        <div className="rounded-xl border border-[#f6d7d7] bg-[#fff2f2] p-4 text-sm font-semibold text-[#a03f3f]">
          {error}
        </div>
      ) : null}

      <section className="rounded-xl border border-[#dce4f7] bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setMode("list")}
            disabled={mode === "list"}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#d3dbef] text-[#27407b] transition hover:bg-[#f3f6ff] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Kembali ke daftar dokumen sidang"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              loadRows().catch(() => {});
              if (selectedMahasiswaId && mode === "detail") {
                loadDetail(selectedMahasiswaId).catch(() => {});
              }
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-[#d3dbef] px-3 py-2 text-sm font-semibold text-[#27407b] transition hover:bg-[#f3f6ff]"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </section>

      {mode === "list" ? (
        <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-black text-[#1b274b]">Grid Dokumen Sidang Mahasiswa</h3>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7282a8]" />
              <input
                type="text"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Cari NIM, nama, status..."
                className="w-[300px] rounded-lg border border-[#d3dbef] py-2 pl-8 pr-3 text-sm outline-none focus:border-[#2f63e3]"
              />
            </div>
          </div>

          <div className="relative overflow-auto rounded-lg border border-[#e6ecf8] bg-white grid-unified-height">
            <table className="w-full min-w-[1300px] text-left text-sm">
              <thead>
                <tr className="border-y border-[#e6ecf8] text-[#4d5e89]">
                  <th className="bg-[#f8fbff] px-3 py-2 font-semibold">No</th>
                  <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Nama Mahasiswa</th>
                  <th className="bg-[#f8fbff] px-3 py-2 font-semibold">NIM</th>
                  <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Bimbingan Valid</th>
                  <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Transkrip</th>
                  <th className="bg-[#f8fbff] px-3 py-2 font-semibold">CEPT</th>
                  <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Draft Skripsi</th>
                  <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Paper</th>
                  <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Tahap</th>
                  <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((row, index) => (
                  <tr key={`dok-sidang-row-${row?.mahasiswa?.id || index}`} className="border-b border-[#eff3fb]">
                    <td className="px-3 py-2 font-semibold text-[#254080]">{rangeStart + index}</td>
                    <td className="px-3 py-2">
                      <p className="font-semibold text-[#1f2d53]">{row?.mahasiswa?.nama || "-"}</p>
                      <p className="text-xs text-[#61709b]">Angkatan {row?.mahasiswa?.angkatan || "-"}</p>
                    </td>
                    <td className="px-3 py-2">{row?.mahasiswa?.nim || "-"}</td>
                    <td className="px-3 py-2">
                      {Number(row?.gate?.counted_sessions || 0)} / {Number(row?.gate?.target_minimum || 8)}
                    </td>
                    {DOC_ORDER.map((docKey) => (
                      <td key={`doc-status-${docKey}-${row?.mahasiswa?.id}`} className="px-3 py-2">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${docStatusBadge(row?.dokumen?.[docKey]?.status)}`}>
                          {row?.dokumen?.[docKey]?.status_label || "-"}
                        </span>
                      </td>
                    ))}
                    <td className="px-3 py-2">
                      <span className="text-xs font-semibold text-[#4f5d85]">
                        {tahapSidangLabel(row?.status_pendaftaran_sidang)}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => {
                          openDetail(row?.mahasiswa?.id).catch(() => {});
                        }}
                        className="inline-flex items-center gap-1 rounded-md bg-[#2f63e3] px-3 py-1 text-xs font-bold text-white transition hover:brightness-110"
                      >
                        {row.can_review === false ? "Detail (read-only)" : "Detail"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {loading ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[41px] flex items-center justify-center px-4 text-center text-sm font-semibold text-[#7b88ab]">
                Memuat data dokumen sidang...
              </div>
            ) : null}
            {!loading && filteredRows.length === 0 ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[41px] flex items-center justify-center px-4 text-center text-sm font-semibold text-[#7b88ab]">
                Belum ada mahasiswa yang memenuhi syarat review dokumen sidang.
              </div>
            ) : null}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[#e8edf8] pt-3">
            <p className="text-sm text-[#4f5e86]">
              Menampilkan {rangeStart} - {rangeEnd} dari {filteredRows.length} data dokumen sidang.
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

      {mode === "detail" ? (
        <section className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
          <h3 className="text-lg font-black text-[#1b274b]">Review Dokumen Sidang Mahasiswa</h3>
          <p className="mt-1 text-sm text-[#5d6c91]">
            Periksa dokumen kelayakan sidang, berikan catatan, lalu tentukan keputusan untuk setiap dokumen.
          </p>
          {loadingDetail ? (
            <div className="mt-3 rounded-lg border border-[#e2e9f8] bg-[#f8fbff] p-4 text-sm font-semibold text-[#60709a]">
              Memuat detail dokumen sidang...
            </div>
          ) : null}

          {!loadingDetail && detail ? (
            <div className="mt-4 space-y-4">
              <div className="rounded-xl border border-[#e2e9f8] bg-[#f8fbff] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h4 className="text-base font-black text-[#1b274b]">Progress dan Identitas Mahasiswa</h4>
                    <p className="mt-1 text-sm text-[#5d6c91]">Ringkasan mahasiswa dan kesiapan bimbingan menuju pendaftaran sidang.</p>
                  </div>
                  <span className="rounded-full bg-[#edf3ff] px-3 py-1 text-xs font-bold text-[#2f63e3]">
                    {tahapSidangLabel(detail?.status_pendaftaran_sidang)}
                  </span>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-semibold text-[#5a6a93]">Nama Mahasiswa</label>
                    <input
                      type="text"
                      value={detail?.mahasiswa?.nama || "-"}
                      readOnly
                      disabled
                      className="mt-2 w-full rounded-lg border border-[#d6deef] bg-white px-3 py-2 text-sm text-[#50618f] outline-none disabled:cursor-default disabled:opacity-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#5a6a93]">NIM</label>
                    <input
                      type="text"
                      value={detail?.mahasiswa?.nim || "-"}
                      readOnly
                      disabled
                      className="mt-2 w-full rounded-lg border border-[#d6deef] bg-white px-3 py-2 text-sm text-[#50618f] outline-none disabled:cursor-default disabled:opacity-100"
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <div className="flex items-center justify-between gap-3 text-sm text-[#415480]">
                    <span className="font-semibold">Progress Bimbingan Valid</span>
                    <span className="font-black text-[#1b274b]">
                      {Number(detail?.gate?.counted_sessions || 0)} / {Number(detail?.gate?.target_minimum || 8)}
                    </span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#dfe6f7]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#2f63e3] to-[#2740a3]"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round(
                            (Number(detail?.gate?.counted_sessions || 0) /
                              Math.max(1, Number(detail?.gate?.target_minimum || 8))) *
                              100
                          )
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {detail?.persyaratan_sistem?.mata_kuliah_penjaluran ? (
                <div className="rounded-xl border border-[#e2e9f8] bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 className="text-base font-black text-[#1b274b]">Mata Kuliah Penjaluran</h4>
                      <p className="mt-1 text-sm text-[#5d6c91]">Syarat otomatis dari Data Akademik dan tidak memerlukan keputusan manual dosen.</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${detail.persyaratan_sistem.mata_kuliah_penjaluran.fulfilled ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                      {detail.persyaratan_sistem.mata_kuliah_penjaluran.syarat_sidang || (detail.persyaratan_sistem.mata_kuliah_penjaluran.fulfilled ? "Terpenuhi" : "Belum Terpenuhi")}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 rounded-lg bg-[#f8fbff] p-3 text-sm text-[#42588f] md:grid-cols-3">
                    <p><span className="font-semibold">Mata kuliah:</span> {detail.persyaratan_sistem.mata_kuliah_penjaluran.mata_kuliah || "-"}</p>
                    <p><span className="font-semibold">Nilai:</span> {detail.persyaratan_sistem.mata_kuliah_penjaluran.nilai || "-"}</p>
                    <p><span className="font-semibold">Status:</span> {detail.persyaratan_sistem.mata_kuliah_penjaluran.status || "Belum tersedia"}</p>
                  </div>
                </div>
              ) : null}

              {detail?.can_review === false ? (
                <div className="rounded-lg border border-[#cfdcf6] bg-[#f3f7ff] p-4 text-sm font-semibold text-[#34549b]">
                  Anda tercatat sebagai Pembimbing 2. Dokumen dapat dilihat dan diunduh, tetapi keputusan dokumen saat ini hanya diproses Pembimbing 1.
                </div>
              ) : null}

              <div className="rounded-xl border border-[#e2e9f8] bg-white p-4">
                <h4 className="text-lg font-black text-[#1b274b]">Dokumen Kelayakan Sidang</h4>
                <p className="mt-1 text-sm text-[#5d6c91]">
                  Buka dokumen untuk memeriksa isinya, kemudian setujui atau kembalikan kepada mahasiswa untuk direvisi.
                </p>
                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {DOC_ORDER.map((docKey) => {
                    const doc = detail?.dokumen?.[docKey];
                    if (!doc) return null;
                    const canDecide = detail?.can_review !== false && doc.can_review === true;
                    const isRevision = String(doc.status || "").toLowerCase() === "revisi";
                    const resultStatusMessage = isRevision
                      ? "Permintaan revisi terkirim. Menunggu mahasiswa mengunggah ulang dokumen."
                      : doc.status === "approved"
                        ? "Dokumen berhasil disetujui dan dikunci."
                        : "";
                    return (
                      <article
                        key={`detail-doc-${docKey}`}
                        className={`flex min-h-[540px] flex-col overflow-hidden rounded-xl border bg-white shadow-sm ${
                          isRevision ? "border-[#efb4b4]" : "border-[#dfe6f4]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3 border-b border-[#edf1f8] px-4 py-4">
                          <div className="min-w-0">
                            <h5 className="break-words text-base font-black text-[#24396d]">{doc.label}</h5>
                            <p className="mt-1 text-xs font-semibold text-[#8693b2]">Dokumen Kelayakan Sidang</p>
                          </div>
                          <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${docStatusBadge(doc.status)}`}>
                            {doc.status_label}
                          </span>
                        </div>

                        <div className="flex flex-1 flex-col items-center justify-center px-4 py-6 text-center">
                          <FileText className={`h-16 w-16 ${isRevision ? "text-[#d04a4a]" : "text-[#3f5cc4]"}`} strokeWidth={1.6} />
                          <p className="mt-3 max-w-full break-words text-sm font-semibold text-[#475574]">
                            {doc.file_name || "Belum ada file yang diunggah"}
                          </p>
                          <p className="mt-1 text-xs text-[#8490ac]">
                            {doc.uploaded_at ? `Terakhir diunggah ${formatDateTime(doc.uploaded_at)}` : "Dokumen belum tersedia"}
                          </p>
                          {doc.review_note ? (
                            <div className={`mt-4 max-h-40 w-full overflow-y-auto rounded-lg border px-3 py-2 text-left text-xs ${isRevision ? "border-red-200 bg-red-50 text-red-700" : "border-[#dce4f7] bg-[#f8fbff] text-[#42588f]"}`}>
                              <p className="font-black">Catatan keputusan terakhir</p>
                              <p className="mt-1 whitespace-pre-wrap break-words leading-5">{doc.review_note}</p>
                            </div>
                          ) : null}
                        </div>

                        <div className="grid grid-cols-2 gap-2 border-t border-[#edf1f8] p-3">
                          <button
                            type="button"
                            disabled={!doc.has_file || savingDocKey === docKey}
                            onClick={() => handleView(docKey).catch(() => {})}
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#3854b8] px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Eye className="h-4 w-4" />
                            Lihat
                          </button>
                          <button
                            type="button"
                            disabled={!doc.has_file || savingDocKey === docKey}
                            onClick={() => handleDownload(docKey, doc.file_name).catch(() => {})}
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#d3dbef] px-3 py-2 text-xs font-bold text-[#405680] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Download className="h-4 w-4" />
                            Unduh
                          </button>
                        </div>

                        <div className="border-t border-[#edf1f8] bg-[#f8fbff] p-3">
                          {revisionDocKey === docKey ? (
                            <div>
                              <label className="block text-sm font-semibold text-[#3d4f7d]">
                                Alasan Revisi <span className="text-[#d93030]">*</span>
                              </label>
                              <textarea
                                autoFocus
                                rows={3}
                                value={reviewNotes[docKey] || ""}
                                onChange={(event) =>
                                  setReviewNotes((prev) => ({ ...prev, [docKey]: event.target.value }))
                                }
                                className="mt-2 w-full resize-none rounded-lg border border-[#d1daf0] bg-white px-3 py-2 text-sm text-[#1f2d53] outline-none focus:border-[#b73a3a]"
                                placeholder="Jelaskan bagian dokumen yang wajib diperbaiki..."
                                disabled={!canDecide || savingDocKey === docKey}
                              />
                              {reviewErrors[docKey] ? <p className="mt-2 text-xs font-semibold text-red-600">{reviewErrors[docKey]}</p> : null}
                              <div className="mt-3 grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  disabled={savingDocKey === docKey}
                                  onClick={() => {
                                    setRevisionDocKey("");
                                    setReviewNotes((current) => ({ ...current, [docKey]: "" }));
                                    setReviewErrors((current) => ({ ...current, [docKey]: "" }));
                                  }}
                                  className="inline-flex items-center justify-center rounded-lg border border-[#d3dbef] bg-white px-3 py-2 text-xs font-bold text-[#405680] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  Batal
                                </button>
                                <button
                                  type="button"
                                  disabled={!canDecide || savingDocKey === docKey}
                                  onClick={() => handleReview(docKey, "revisi").catch(() => {})}
                                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#b73a3a] px-3 py-2 text-xs font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  <XCircle className="h-4 w-4" />
                                  {savingDocKey === docKey ? "Menyimpan..." : "Kirim Revisi"}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                disabled={!canDecide || savingDocKey === docKey}
                                onClick={() => handleReview(docKey, "approve").catch(() => {})}
                                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#137748] px-3 py-2 text-xs font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                                {savingDocKey === docKey ? "Menyimpan..." : "Approve"}
                              </button>
                              <button
                                type="button"
                                disabled={!canDecide || savingDocKey === docKey}
                                onClick={() => {
                                  setRevisionDocKey(docKey);
                                  setReviewErrors((current) => ({ ...current, [docKey]: "" }));
                                }}
                                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#b73a3a] px-3 py-2 text-xs font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <XCircle className="h-4 w-4" />
                                Revisi
                              </button>
                            </div>
                          )}
                          {resultStatusMessage ? (
                            <p className={`mt-3 rounded-lg border px-3 py-2 text-xs font-semibold ${doc.status === "approved" ? "border-[#d6f1e2] bg-[#ecfaf2] text-[#196a45]" : "border-[#f2dfb3] bg-[#fff9e9] text-[#7a5a00]"}`}>
                              {resultStatusMessage}
                            </p>
                          ) : null}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

export default DosenDokumenSidangReviewPage;
