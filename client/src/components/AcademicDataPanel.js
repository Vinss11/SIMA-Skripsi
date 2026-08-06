import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Download, RefreshCcw, Search, SlidersHorizontal, Upload } from "lucide-react";
import Swal from "sweetalert2";

const PAGE_SIZE = 10;
const PREVIEW_PAGE_SIZE = 5;

function showSuccessToast(message) {
  return Swal.fire({
    toast: true,
    position: "top-end",
    icon: "success",
    title: message,
    showConfirmButton: false,
    timer: 2200,
    timerProgressBar: true,
  });
}

function Badge({ children, status }) {
  const tone = status === "Lulus"
    ? "bg-emerald-100 text-emerald-800"
    : status === "Tidak lulus"
      ? "bg-rose-100 text-rose-800"
      : status === "Sedang mengambil"
        ? "bg-blue-100 text-blue-800"
        : "bg-amber-100 text-amber-800";
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${tone}`}>{children}</span>;
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString("id-ID") : "-";
}

function StudentSummary({ data }) {
  const rows = data?.rows || [];
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
        Nilai minimum lulus yang berlaku: <b>{data?.minimum_passing_grade || "-"}</b>.
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-[#607096]">Belum ada pendaftaran dan nilai mata kuliah penjaluran.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[#dce4f4]">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#f4f7fc] text-[#445476]"><tr><th className="px-3 py-2">Jenis</th><th className="px-3 py-2">Jalur & Mata Kuliah</th><th className="px-3 py-2">Periode</th><th className="px-3 py-2">Attempt</th><th className="px-3 py-2">Nilai</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Keterangan</th></tr></thead>
            <tbody>{rows.map((row) => (
              <tr key={`${row.pendaftaran_id}-${row.mata_kuliah_id || "hold"}`} className="border-t border-[#e5eaf4]">
                <td className="px-3 py-2">{row.jenis_pendaftaran_label}</td>
                <td className="px-3 py-2"><b>{row.jalur_label}</b><br/><span className="text-xs text-slate-600">{row.kode_mata_kuliah ? `${row.kode_mata_kuliah} · ` : ""}{row.mata_kuliah}</span></td>
                <td className="px-3 py-2">{row.periode}</td><td className="px-3 py-2">{row.attempt || "-"}</td>
                <td className="px-3 py-2 font-bold">{row.nilai || "-"}</td><td className="px-3 py-2"><Badge status={row.status_nilai}>{row.status_nilai}</Badge></td>
                <td className="px-3 py-2 text-xs text-slate-600">{row.reused_previous_pass ? "Hasil lulus sebelumnya tetap berlaku" : row.status_nilai === "Tidak lulus" ? "Perlu mengulang" : "-"}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function GradeGrid({ periods, periodId, setPeriodId, rows, policy }) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [trackFilter, setTrackFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filterDraft, setFilterDraft] = useState({ periodId: "", type: "", track: "", status: "" });
  const [page, setPage] = useState(1);
  const filterPanelRef = useRef(null);

  const filteredRows = useMemo(() => rows.filter((row) => {
    const needle = query.trim().toLowerCase();
    const searchable = `${row.nim} ${row.nama} ${row.periode} ${row.jalur_label} ${row.mata_kuliah}`.toLowerCase();
    return (!needle || searchable.includes(needle))
      && (!typeFilter || row.jenis_pendaftaran === typeFilter)
      && (!trackFilter || row.jalur === trackFilter)
      && (!statusFilter || row.status_nilai === statusFilter);
  }), [rows, query, typeFilter, trackFilter, statusFilter]);

  const defaultPeriodId = periods.length ? String(periods[0].id) : "";
  const activeFilterCount = [typeFilter, trackFilter, statusFilter].filter(Boolean).length
    + (periodId && String(periodId) !== defaultPeriodId ? 1 : 0);
  const hasActiveFilters = Boolean(query || activeFilterCount);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = filteredRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const rangeStart = filteredRows.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const rangeEnd = filteredRows.length ? Math.min(currentPage * PAGE_SIZE, filteredRows.length) : 0;
  const selectedPeriod = periods.find((period) => String(period.id) === String(periodId));

  useEffect(() => { setPage(1); }, [periodId, query, typeFilter, trackFilter, statusFilter]);

  useEffect(() => {
    if (!showFilters) setFilterDraft({ periodId: String(periodId || ""), type: typeFilter, track: trackFilter, status: statusFilter });
  }, [periodId, showFilters, statusFilter, trackFilter, typeFilter]);

  useEffect(() => {
    if (!showFilters) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!filterPanelRef.current?.contains(event.target)) setShowFilters(false);
    };
    const closeOnEscape = (event) => { if (event.key === "Escape") setShowFilters(false); };
    window.addEventListener("mousedown", closeOnOutsideClick);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("mousedown", closeOnOutsideClick);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [showFilters]);

  const resetFilters = () => {
    setQuery(""); setPeriodId(defaultPeriodId); setTypeFilter(""); setTrackFilter(""); setStatusFilter(""); setPage(1);
  };

  const toggleFilters = () => {
    setFilterDraft({ periodId: String(periodId || defaultPeriodId), type: typeFilter, track: trackFilter, status: statusFilter });
    setShowFilters((current) => !current);
  };

  const applyFilters = () => {
    setPeriodId(filterDraft.periodId);
    setTypeFilter(filterDraft.type);
    setTrackFilter(filterDraft.track);
    setStatusFilter(filterDraft.status);
    setPage(1);
    setShowFilters(false);
  };

  const resetDraft = () => setFilterDraft({ periodId: defaultPeriodId, type: "", track: "", status: "" });
  const draftIsDirty = String(filterDraft.periodId) !== String(periodId || "")
    || filterDraft.type !== typeFilter || filterDraft.track !== trackFilter || filterDraft.status !== statusFilter;
  const hasDraftFilters = filterDraft.type || filterDraft.track || filterDraft.status
    || (filterDraft.periodId && filterDraft.periodId !== defaultPeriodId);

  return (
    <section className="rounded-xl border border-[#dce4f4] bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-black text-[#1b274b]">Grid Daftar Nilai</h3>
          <p className="text-sm text-[#5d6c91]">Menampilkan nilai mata kuliah penjaluran berdasarkan periode pendaftaran Sekprodi.</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <div className="relative min-w-0 flex-1 sm:w-[340px] sm:flex-none">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7282a8]"/>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari NIM, nama, periode, jalur, mata kuliah..." className="w-full rounded-lg border border-[#d3dbef] py-2 pl-8 pr-3 text-sm outline-none focus:border-[#2f63e3]"/>
          </div>
          <div className="relative" ref={filterPanelRef}>
            <button type="button" onClick={toggleFilters} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition ${showFilters || activeFilterCount ? "border-[#2f63e3] bg-[#eef3ff] text-[#2348a5]" : "border-[#d3dbef] text-[#27407b] hover:bg-[#f3f6ff]"}`}>
              <SlidersHorizontal className="h-4 w-4"/>Filter{activeFilterCount ? <span className="rounded-full bg-[#2f63e3] px-1.5 py-0.5 text-xs font-bold leading-none text-white">{activeFilterCount}</span> : null}
            </button>
            {showFilters ? (
              <div className="absolute right-0 top-[calc(100%+8px)] z-[70] flex max-h-[560px] w-[min(430px,calc(100vw-3rem))] flex-col rounded-xl border border-[#dbe5f8] bg-white shadow-xl">
                <div className="border-b border-[#e5ecf9] px-4 py-3">
                  <p className="text-base font-bold text-[#1e315f]">Filter Data Nilai</p>
                  <p className="text-xs text-[#60709a]">Atur filter bertumpuk, lalu klik Terapkan.</p>
                </div>
                <div className="space-y-3 overflow-auto p-3">
                  {[
                    { key: "periodId", label: "Periode Pendaftaran", empty: "Periode terbaru", options: periods.map((item) => ({ value: String(item.id), label: item.label_periode })) },
                    { key: "type", label: "Jenis Pendaftaran", empty: "Semua jenis pendaftaran", options: [{ value: "baru", label: "Baru" }, { value: "ulang", label: "Ulang" }, { value: "alih", label: "Alih" }] },
                    { key: "track", label: "Jalur Penjaluran", empty: "Semua jalur penjaluran", options: [{ value: "penelitian", label: "Penelitian" }, { value: "magang", label: "Magang" }, { value: "perintisan_bisnis", label: "Perintisan Bisnis" }] },
                    { key: "status", label: "Status Nilai", empty: "Semua status nilai", options: ["Belum tersedia", "Sedang mengambil", "Lulus", "Tidak lulus"].map((value) => ({ value, label: value })) },
                  ].map((filter) => (
                    <div key={filter.key} className="rounded-lg border border-[#e6ecf8] p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-sm font-semibold text-[#2a4175]">{filter.label}</p>
                        <button type="button" onClick={() => setFilterDraft((current) => ({ ...current, [filter.key]: filter.key === "periodId" ? defaultPeriodId : "" }))} className="text-xs font-semibold text-[#2f63e3] hover:underline">Reset</button>
                      </div>
                      <select value={filterDraft[filter.key]} onChange={(event) => setFilterDraft((current) => ({ ...current, [filter.key]: event.target.value }))} className="w-full rounded-lg border border-[#d3dbef] px-3 py-2 text-sm text-[#23396b] outline-none focus:border-[#2f63e3]">
                        {filter.key !== "periodId" ? <option value="">{filter.empty}</option> : null}
                        {filter.options.map((option) => <option key={`${filter.key}-${option.value}`} value={option.value}>{option.label}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-[#e5ecf9] px-3 py-3">
                  <button type="button" onClick={resetDraft} disabled={!hasDraftFilters} className="rounded-lg border border-[#d3dbef] px-3 py-2 text-sm font-semibold text-[#27407b] hover:bg-[#f3f6ff] disabled:cursor-not-allowed disabled:opacity-50">Reset all</button>
                  <button type="button" onClick={applyFilters} disabled={!draftIsDirty} className="rounded-lg bg-[#2f63e3] px-3 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">Terapkan</button>
                </div>
              </div>
            ) : null}
          </div>
          <button type="button" onClick={resetFilters} disabled={!hasActiveFilters} className="rounded-lg border border-[#d3dbef] px-3 py-2 text-sm font-semibold text-[#27407b] hover:bg-[#f3f6ff] disabled:cursor-not-allowed disabled:opacity-50">Reset</button>
        </div>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#69779d]">
        <span>Periode: <b className="text-[#354a7e]">{selectedPeriod?.label_periode || "Belum dipilih"}</b></span>
        {policy ? <span>Nilai minimum lulus: <b className="text-[#354a7e]">{policy.minimum_passing_grade}</b></span> : null}
      </div>

      <div className="relative overflow-auto rounded-lg border border-[#e6ecf8] bg-white grid-unified-height">
        <table className="w-full min-w-[1650px] text-left text-sm">
          <thead><tr className="border-y border-[#e6ecf8] text-[#4d5e89]">
            {["No", "NIM", "Nama", "Jenis Pendaftaran", "Jalur Penjaluran", "Status Pendaftaran", "Kode Mata Kuliah", "Mata Kuliah Penjaluran", "Periode Penjaluran", "Attempt", "Nilai", "Status Nilai", "Diperbarui"].map((header) => <th key={header} className="whitespace-nowrap bg-[#f8fbff] px-3 py-2 font-semibold">{header}</th>)}
          </tr></thead>
          <tbody>{pagedRows.map((row, index) => (
            <tr key={`${row.pendaftaran_id}-${row.mata_kuliah_id || "hold"}`} className="border-b border-[#eff3fb]">
              <td className="px-3 py-2">{(currentPage - 1) * PAGE_SIZE + index + 1}</td><td className="px-3 py-2 font-semibold text-[#254080]">{row.nim || "-"}</td><td className="px-3 py-2">{row.nama || "-"}</td>
              <td className="px-3 py-2">{row.jenis_pendaftaran_label || "-"}</td><td className="px-3 py-2">{row.jalur_label || "-"}</td><td className="px-3 py-2 capitalize">{row.status_pendaftaran || "-"}</td>
              <td className="px-3 py-2 font-semibold text-[#354a7e]">{row.kode_mata_kuliah || "-"}</td><td className="px-3 py-2">{row.mata_kuliah || "-"}</td><td className="px-3 py-2">{row.periode || "-"}</td>
              <td className="px-3 py-2">{row.attempt || "-"}</td><td className="px-3 py-2 font-bold">{row.nilai || "-"}</td><td className="px-3 py-2"><Badge status={row.status_nilai}>{row.status_nilai}</Badge></td><td className="whitespace-nowrap px-3 py-2">{formatDate(row.updated_at)}</td>
            </tr>
          ))}</tbody>
        </table>
        {filteredRows.length === 0 ? <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[41px] flex items-center justify-center px-4 text-center text-sm font-semibold text-[#7b88ab]">Data nilai mahasiswa tidak ditemukan.</div> : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#e8edf8] pt-3">
        <p className="text-sm text-[#4f5e86]">Menampilkan {rangeStart} - {rangeEnd} dari {filteredRows.length} data nilai mahasiswa.</p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={currentPage === 1} className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:opacity-50">Sebelumnya</button>
          <span className="text-sm font-semibold text-[#314778]">Halaman {currentPage} / {totalPages}</span>
          <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={currentPage >= totalPages} className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:opacity-50">Berikutnya</button>
        </div>
      </div>
    </section>
  );
}

function ImportGrades({ periods, periodId, setPeriodId, preview, setPreview, file, setFile, busy, download, validate, commit }) {
  const [previewPage, setPreviewPage] = useState(1);
  const previewRows = preview?.rows || [];
  const validCount = Number(preview?.counts?.valid || 0);
  const invalidCount = Number(preview?.counts?.invalid || 0);
  const totalPages = Math.max(1, Math.ceil(previewRows.length / PREVIEW_PAGE_SIZE));
  const currentPage = Math.min(previewPage, totalPages);
  const pagedRows = previewRows.slice((currentPage - 1) * PREVIEW_PAGE_SIZE, currentPage * PREVIEW_PAGE_SIZE);
  const rangeStart = previewRows.length ? (currentPage - 1) * PREVIEW_PAGE_SIZE + 1 : 0;
  const rangeEnd = previewRows.length ? Math.min(currentPage * PREVIEW_PAGE_SIZE, previewRows.length) : 0;

  useEffect(() => { setPreviewPage(1); }, [preview]);

  const rawValue = (row, ...keys) => {
    for (const key of keys) if (row.raw_payload?.[key] !== undefined) return row.raw_payload[key];
    return "-";
  };

  return (
    <>
      <section className="rounded-xl border border-[#dce4f4] bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-[#16244a]">Import Nilai via Excel</h3>
            <p className="mt-2 text-sm text-[#66769a]">Pilih periode, unduh template yang sudah berisi data mahasiswa, lalu isi hanya kolom Nilai.</p>
            <p className="mt-1 text-xs font-semibold text-[#40527e]">Nilai yang diterima: A, B+, B, B-, B/C, C+, C, C-, C/D, D+, D, D-, D/F, F.</p>
          </div>
          <button type="button" disabled={!periodId || busy} onClick={() => download(`/api/admin/akademik/nilai/template?periode_pendaftaran_id=${periodId}`, `template_nilai_penjaluran_${periodId}.xlsx`)} className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 px-3 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"><Download className="h-4 w-4"/>Download Template</button>
        </div>

        <label className="mt-4 block text-sm font-bold text-[#29385f]">Periode pendaftaran penjaluran
          <select value={periodId} onChange={(event) => { setPeriodId(event.target.value); setPreview(null); }} className="mt-1 block w-full rounded-lg border border-[#d3dbef] bg-white p-2 text-sm font-normal text-[#26375f] md:w-96"><option value="">Pilih periode</option>{periods.map((period) => <option key={period.id} value={period.id}>{period.label_periode}</option>)}</select>
        </label>

        <form onSubmit={validate} className="mt-4">
          <input required type="file" accept=".xlsx,.xls" onChange={(event) => setFile(event.target.files?.[0] || null)} className="block w-full rounded-lg border border-[#d3dbef] p-2 text-sm"/>
          <button disabled={!periodId || !file || busy} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#2f63e3] px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"><Upload className="h-4 w-4"/>{busy ? "Memproses..." : "Preview Data"}</button>
        </form>

        <div className="mt-4 rounded-lg border border-[#dce4f4] bg-[#f8fbff] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-bold text-[#29385f]">{preview ? `Hasil preview import #${preview.id}` : "Preview nilai akan tampil di sini setelah upload template."}</p>
              <p className="mt-1 text-sm text-[#59698f]">Valid: {validCount} | Tidak valid: {invalidCount}</p>
              <p className="mt-1 text-xs text-[#68779b]">Preview menampilkan maksimal {previewRows.length} data ({PREVIEW_PAGE_SIZE} data per halaman).</p>
            </div>
            {invalidCount > 0 ? <button type="button" onClick={() => download(`/api/admin/akademik/nilai/imports/${preview.id}/report`, `laporan_kesalahan_${preview.id}.csv`)} className="rounded-lg border border-rose-300 px-3 py-2 text-sm font-bold text-rose-700 hover:bg-rose-50">Download Laporan Perbaikan</button> : null}
          </div>

          <div className="mt-4 overflow-x-auto rounded-lg border border-[#d9e2f3] bg-white">
            <table className="w-full min-w-[1500px] text-left text-sm">
              <thead className="bg-[#f4f7fc] text-[#40527e]"><tr>{["No", "ID Pendaftaran", "NIM", "Nama", "Jenis", "Jalur", "Mata Kuliah", "Attempt", "Nilai Lama", "Nilai Baru", "Pesan Error"].map((header) => <th key={header} className="whitespace-nowrap px-3 py-2 font-semibold">{header}</th>)}</tr></thead>
              <tbody>{pagedRows.map((row, index) => (
                <tr key={row.id || `${row.row_number}-${index}`} className="border-t border-[#e8edf8]">
                  <td className="px-3 py-2">{(currentPage - 1) * PREVIEW_PAGE_SIZE + index + 1}</td>
                  <td className="px-3 py-2">{row.pendaftaran_penjaluran_id || rawValue(row, "ID Pendaftaran")}</td>
                  <td className="px-3 py-2 font-semibold text-[#254080]">{rawValue(row, "NIM")}</td>
                  <td className="px-3 py-2">{rawValue(row, "Nama")}</td>
                  <td className="px-3 py-2">{rawValue(row, "Jenis Pendaftaran")}</td>
                  <td className="px-3 py-2">{rawValue(row, "Jalur Penjaluran")}</td>
                  <td className="px-3 py-2">{rawValue(row, "Mata Kuliah Penjaluran")}</td>
                  <td className="px-3 py-2">{rawValue(row, "Attempt")}</td>
                  <td className="px-3 py-2">{row.old_grade || "-"}</td>
                  <td className="px-3 py-2 font-bold">{row.nilai_huruf || rawValue(row, "Nilai")}</td>
                  <td className={`px-3 py-2 ${row.is_valid ? "text-emerald-700" : "text-rose-700"}`}>{row.is_valid ? "Valid" : (row.errors || []).join("; ")}</td>
                </tr>
              ))}</tbody>
            </table>
            {previewRows.length === 0 ? <div className="flex min-h-[52px] items-center justify-center text-sm font-semibold text-[#7b88ab]">Belum ada data preview.</div> : null}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[#4f5e86]">Menampilkan {rangeStart} - {rangeEnd} dari {previewRows.length} data preview.</p>
            <div className="flex items-center gap-2"><button type="button" onClick={() => setPreviewPage((value) => Math.max(1, value - 1))} disabled={currentPage === 1} className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] disabled:opacity-50">Sebelumnya</button><span className="text-sm font-semibold text-[#314778]">Halaman {currentPage} / {totalPages}</span><button type="button" onClick={() => setPreviewPage((value) => Math.min(totalPages, value + 1))} disabled={currentPage >= totalPages} className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] disabled:opacity-50">Berikutnya</button></div>
          </div>
        </div>
      </section>
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#dce4f4] bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-[#314778]">Data valid baru akan masuk database setelah tombol simpan ditekan.</p>
        <button type="button" disabled={busy || !preview || preview.status === "committed" || validCount === 0} onClick={commit} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">Simpan {validCount} Data Valid</button>
      </section>
    </>
  );
}

function AcademicManagement({ api, token, readOnly = false, onBack, onSessionExpired }) {
  const [tab, setTab] = useState("list");
  const [periods, setPeriods] = useState([]);
  const [periodId, setPeriodId] = useState("");
  const [rows, setRows] = useState([]);
  const [policy, setPolicy] = useState(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const endpoint = readOnly ? "/api/sekretaris/akademik" : "/api/admin/akademik";
  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const request = useCallback(async (path, options = {}) => {
    const response = await fetch(`${api}${path}`, { ...options, headers: { ...authHeaders, ...(options.headers || {}) } });
    const payload = await response.json();
    if ([401, 403].includes(response.status)) onSessionExpired?.();
    if (!response.ok) throw new Error(payload.message || "Permintaan gagal.");
    return payload;
  }, [api, authHeaders, onSessionExpired]);

  useEffect(() => {
    request(`${endpoint}/nilai/periode`)
      .then(({ data }) => {
        setPeriods(data || []);
        if (data?.length) setPeriodId((current) => current || String(data[0].id));
      })
      .catch((error) => setMessage(error.message));
  }, [endpoint, request]);

  const loadRows = useCallback(async () => {
    if (!periodId) { setRows([]); return; }
    try {
      const payload = await request(`${endpoint}/nilai?periode_pendaftaran_id=${periodId}`);
      setRows(payload.data || []); setPolicy(payload.policy || null); setMessage("");
    } catch (error) { setRows([]); setMessage(error.message); }
  }, [endpoint, periodId, request]);

  useEffect(() => { loadRows(); }, [loadRows]);

  const download = async (path, filename) => {
    try {
      setBusy(true); setMessage("");
      const response = await fetch(`${api}${path}`, { headers: authHeaders });
      if ([401, 403].includes(response.status)) onSessionExpired?.();
      if (!response.ok) { const body = await response.json(); throw new Error(body.message || "Download gagal."); }
      const blob = await response.blob(); const url = URL.createObjectURL(blob); const link = document.createElement("a");
      link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
    } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  };

  const validate = async (event) => {
    event.preventDefault(); if (!periodId || !file) return; setBusy(true); setMessage(""); setPreview(null);
    try {
      const form = new FormData(); form.append("periode_pendaftaran_id", periodId); form.append("file", file);
      const payload = await request("/api/admin/akademik/nilai/imports", { method: "POST", body: form });
      setPreview(payload.data); setMessage(payload.replayed ? "File ini pernah divalidasi; preview sebelumnya ditampilkan kembali." : "Validasi selesai.");
    } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  };

  const commit = async () => {
    if (!preview) return; setBusy(true); setMessage("");
    try {
      const validCount = Number(preview?.counts?.valid || 0);
      const payload = await request(`/api/admin/akademik/nilai/imports/${preview.id}/commit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      await loadRows();
      setPreview(null);
      setFile(null);
      setMessage("");
      setTab("list");
      showSuccessToast(
        payload.replayed
          ? "Import ini sudah pernah disimpan; tidak ada nilai atau attempt ganda."
          : `${validCount} data nilai berhasil disimpan.`
      );
    } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  };

  if (readOnly) {
    return <div className="space-y-4">{message ? <div className="rounded-lg bg-[#f4f7ff] p-3 text-sm font-semibold text-[#334b7e]">{message}</div> : null}<GradeGrid periods={periods} periodId={periodId} setPeriodId={setPeriodId} rows={rows} policy={policy}/></div>;
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-[#dce4f4] bg-white p-4 shadow-sm">
        <h2 className="text-lg font-black text-[#16244a]">Menu Data Akademik</h2>
        <p className="mt-1 text-sm text-[#66769a]">Kelola daftar nilai dan proses import nilai mata kuliah penjaluran dari satu halaman.</p>
        <div className="mt-4 flex flex-wrap gap-2">{[["list", "Daftar Nilai"], ["import", "Import Nilai"]].map(([key, label]) => <button key={key} type="button" onClick={() => setTab(key)} className={`rounded-full px-4 py-2 text-sm font-bold transition ${tab === key ? "bg-[#2f63e3] text-white shadow-sm" : "border border-[#d4def4] bg-white text-[#27407b] hover:bg-[#f4f7ff]"}`}>{label}</button>)}</div>
      </section>
      <section className="flex items-center gap-2 rounded-xl border border-[#dce4f4] bg-white p-3 shadow-sm">
        <button type="button" onClick={onBack} aria-label="Kembali" className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#d3dbef] text-[#40527e] hover:bg-[#f4f7ff]"><ArrowLeft className="h-4 w-4"/></button>
        <button type="button" onClick={loadRows} disabled={busy} className="inline-flex items-center gap-2 rounded-lg border border-[#d3dbef] px-3 py-2 text-sm font-semibold text-[#27407b] hover:bg-[#f4f7ff] disabled:opacity-50"><RefreshCcw className="h-4 w-4"/>Refresh</button>
      </section>
      {message ? <div className="rounded-lg bg-[#f4f7ff] p-3 text-sm font-semibold text-[#334b7e]">{message}</div> : null}
      {tab === "list"
        ? <GradeGrid periods={periods} periodId={periodId} setPeriodId={setPeriodId} rows={rows} policy={policy}/>
        : <ImportGrades periods={periods} periodId={periodId} setPeriodId={setPeriodId} preview={preview} setPreview={setPreview} file={file} setFile={setFile} busy={busy} download={download} validate={validate} commit={commit}/>}
    </div>
  );
}

export default function AcademicDataPanel({ mode = "student", session, apiBaseUrl, onSessionExpired, onBack }) {
  const [data, setData] = useState(null); const [loading, setLoading] = useState(mode === "student"); const [error, setError] = useState("");
  useEffect(() => {
    if (mode !== "student") return undefined; let active = true; setLoading(true);
    fetch(`${apiBaseUrl}/api/mahasiswa/akademik/mata-kuliah-penjaluran`, { headers: { Authorization: `Bearer ${session.token}` } })
      .then(async (response) => { const payload = await response.json(); if ([401, 403].includes(response.status)) { onSessionExpired?.(); return; } if (!response.ok) throw new Error(payload.message); if (active) setData(payload.data); })
      .catch((requestError) => { if (active) setError(requestError.message || "Gagal memuat data akademik."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [apiBaseUrl, mode, onSessionExpired, session.token]);

  if (mode === "admin" || mode === "secretary") return <AcademicManagement api={apiBaseUrl} token={session.token} readOnly={mode === "secretary"} onBack={onBack} onSessionExpired={onSessionExpired}/>;

  return <section className="rounded-xl border border-[#dce4f4] bg-white p-5 shadow-sm"><div className="mb-4"><h2 className="text-lg font-black text-[#29385f]">Nilai Mata Kuliah Penjaluran</h2><p className="text-sm text-[#66769a]">Satu sumber nilai untuk Data Akademik, Dokumen, dan pemeriksaan syarat sidang.</p></div>{loading ? <p className="text-sm text-[#66769a]">Memuat data akademik...</p> : error ? <div className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</div> : <StudentSummary data={data}/>}</section>;
}
