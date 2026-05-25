import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Download, RefreshCcw, Search, XCircle } from "lucide-react";

const PAGE_SIZE = 20;
const DOC_ORDER = ["transkrip", "cept", "draft_skripsi"];

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
  const [reviewNotes, setReviewNotes] = useState({
    transkrip: "",
    cept: "",
    draft_skripsi: "",
  });

  const fetchWithAuth = async (path, options = {}) => {
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
  };

  const loadRows = async () => {
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
  };

  const loadDetail = async (mahasiswaId) => {
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
      setReviewNotes({
        transkrip: nextDetail?.dokumen?.transkrip?.review_note || "",
        cept: nextDetail?.dokumen?.cept?.review_note || "",
        draft_skripsi: nextDetail?.dokumen?.draft_skripsi?.review_note || "",
      });
    } catch (detailError) {
      if (detailError.message !== "__SESSION_EXPIRED__") {
        setError(detailError.message || "Gagal memuat detail dokumen sidang.");
      }
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    loadRows().catch(() => {});
  }, []);

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

  const handleReview = async (docKey, decision) => {
    if (!selectedMahasiswaId) return;
    const note = String(reviewNotes[docKey] || "").trim();
    if (decision === "revisi" && note.length < 5) {
      setError("Catatan revisi minimal 5 karakter.");
      return;
    }
    try {
      setSavingDocKey(docKey);
      setError("");
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
      await Promise.all([loadRows(), loadDetail(selectedMahasiswaId)]);
    } catch (reviewError) {
      if (reviewError.message !== "__SESSION_EXPIRED__") {
        setError(reviewError.message || "Gagal menyimpan review dokumen.");
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
                        Detail
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
          {loadingDetail ? (
            <div className="mt-3 rounded-lg border border-[#e2e9f8] bg-[#f8fbff] p-4 text-sm font-semibold text-[#60709a]">
              Memuat detail dokumen sidang...
            </div>
          ) : null}

          {!loadingDetail && detail ? (
            <div className="mt-4 space-y-3">
              <div className="rounded-lg border border-[#e2e9f8] bg-[#f8fbff] p-4">
                <p className="text-sm text-[#324c86]">
                  <span className="font-semibold">Mahasiswa:</span> {detail?.mahasiswa?.nama || "-"} ({detail?.mahasiswa?.nim || "-"})
                </p>
                <p className="mt-1 text-sm text-[#324c86]">
                  <span className="font-semibold">Progress Bimbingan Valid:</span>{" "}
                  {Number(detail?.gate?.counted_sessions || 0)} / {Number(detail?.gate?.target_minimum || 8)}
                </p>
                <p className="mt-1 text-sm text-[#324c86]">
                  <span className="font-semibold">Status Tahap:</span> {tahapSidangLabel(detail?.status_pendaftaran_sidang)}
                </p>
              </div>

              {DOC_ORDER.map((docKey) => {
                const doc = detail?.dokumen?.[docKey];
                if (!doc) return null;
                return (
                  <div key={`detail-doc-${docKey}`} className="rounded-lg border border-[#e2e9f8] bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-base font-black text-[#1b274b]">{doc.label}</p>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${docStatusBadge(doc.status)}`}>
                        {doc.status_label}
                      </span>
                    </div>

                    <div className="mt-2 space-y-1 text-sm text-[#42588f]">
                      <p>
                        <span className="font-semibold">File:</span> {doc.file_name || "-"}
                      </p>
                      <p>
                        <span className="font-semibold">Terakhir Upload:</span> {formatDateTime(doc.uploaded_at)}
                      </p>
                      <p>
                        <span className="font-semibold">Catatan Review:</span> {doc.review_note || "-"}
                      </p>
                    </div>

                    <div className="mt-3 rounded-lg border border-[#dce4f7] bg-[#f8fbff] p-3">
                      <label className="mb-1 block text-sm font-semibold text-[#3d4f7d]">Catatan Revisi Dosen</label>
                      <textarea
                        rows={3}
                        value={reviewNotes[docKey] || ""}
                        onChange={(event) =>
                          setReviewNotes((prev) => ({
                            ...prev,
                            [docKey]: event.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-[#d1daf0] px-3 py-2 text-sm text-[#1f2d53] outline-none focus:border-[#2f63e3]"
                        placeholder="Isi catatan jika dokumen perlu revisi..."
                      />
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={!doc.has_file || savingDocKey === docKey}
                        onClick={() => {
                          handleDownload(docKey, doc.file_name).catch(() => {});
                        }}
                        className="inline-flex items-center gap-2 rounded-lg border border-[#d3dbef] bg-white px-3 py-2 text-sm font-semibold text-[#27407b] transition hover:bg-[#f3f6ff] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Download className="h-4 w-4" />
                        Unduh
                      </button>
                      <button
                        type="button"
                        disabled={!doc.has_file || savingDocKey === docKey}
                        onClick={() => {
                          handleReview(docKey, "approve").catch(() => {});
                        }}
                        className="inline-flex items-center gap-2 rounded-lg bg-[#137748] px-3 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {savingDocKey === docKey ? "Menyimpan..." : "Approve"}
                      </button>
                      <button
                        type="button"
                        disabled={!doc.has_file || savingDocKey === docKey}
                        onClick={() => {
                          handleReview(docKey, "revisi").catch(() => {});
                        }}
                        className="inline-flex items-center gap-2 rounded-lg bg-[#b73a3a] px-3 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <XCircle className="h-4 w-4" />
                        {savingDocKey === docKey ? "Menyimpan..." : "Revisi"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

export default DosenDokumenSidangReviewPage;

