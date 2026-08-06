import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, Eye, RefreshCcw, Save, X } from "lucide-react";

function formatDateLabel(value, withWeekday = true) {
  if (!value) return "-";
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", {
    ...(withWeekday ? { weekday: "long" } : {}),
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

function toDateOnly(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateOnly(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function uniqueSorted(values) {
  return [...new Set((values || []).map((item) => String(item).slice(0, 10)).filter(Boolean))].sort();
}

function AvailabilityCalendarModal({ open, allowedDates, selectedDates, onClose, onApply }) {
  const allowed = useMemo(() => new Map((allowedDates || []).map((item) => [item.tanggal_sidang, item])), [allowedDates]);
  const [visibleMonth, setVisibleMonth] = useState(new Date());
  const [draftDates, setDraftDates] = useState([]);

  useEffect(() => {
    if (!open) return;
    const initial = parseDateOnly(selectedDates?.[0] || allowedDates?.[0]?.tanggal_sidang) || new Date();
    setVisibleMonth(new Date(initial.getFullYear(), initial.getMonth(), 1));
    setDraftDates(uniqueSorted(selectedDates));
  }, [allowedDates, open, selectedDates]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  if (!open) return null;
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const cells = Array.from({ length: 42 }, (_, index) => new Date(year, month, index - offset + 1));
  const selectedSet = new Set(draftDates);
  const monthLabel = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(visibleMonth);

  const toggleDate = (dateOnly) => {
    if (!allowed.has(dateOnly)) return;
    setDraftDates((current) => current.includes(dateOnly)
      ? current.filter((item) => item !== dateOnly)
      : uniqueSorted([...current, dateOnly]));
  };

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center bg-[#101d3b]/65 p-4 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label="Pilih tanggal ketersediaan" className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[#d8e1f4] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#e4eaf6] px-6 py-5">
          <div>
            <h3 className="text-xl font-black text-[#17264d]">Pilih Tanggal Ketersediaan</h3>
            <p className="mt-1 text-sm text-[#60709a]">Hanya tanggal sidang yang telah ditetapkan Sekretaris Prodi yang dapat dipilih.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup kalender" className="rounded-lg border border-[#d5def1] p-2 text-[#52658f] hover:bg-[#f3f6ff]"><X className="h-5 w-5" /></button>
        </div>

        <div className="min-h-0 overflow-y-auto p-6">
          <div className="mx-auto max-w-3xl rounded-xl border border-[#dce4f5] bg-[#fbfcff] p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <button type="button" onClick={() => setVisibleMonth(new Date(year, month - 1, 1))} className="rounded-lg border border-[#d2dcf1] bg-white p-2 text-[#28427d] hover:bg-[#eef3ff]"><ChevronLeft className="h-5 w-5" /></button>
              <p className="text-lg font-black capitalize text-[#1d315f]">{monthLabel}</p>
              <button type="button" onClick={() => setVisibleMonth(new Date(year, month + 1, 1))} className="rounded-lg border border-[#d2dcf1] bg-white p-2 text-[#28427d] hover:bg-[#eef3ff]"><ChevronRight className="h-5 w-5" /></button>
            </div>
            <div className="grid grid-cols-7 gap-2 text-center">
              {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((day) => <div key={day} className="py-2 text-xs font-bold uppercase tracking-wide text-[#64749a]">{day}</div>)}
              {cells.map((date) => {
                const dateOnly = toDateOnly(date);
                const option = allowed.get(dateOnly);
                const inMonth = date.getMonth() === month;
                const enabled = inMonth && Boolean(option);
                const selected = selectedSet.has(dateOnly);
                return (
                  <button
                    key={dateOnly}
                    type="button"
                    disabled={!enabled}
                    onClick={() => toggleDate(dateOnly)}
                    className={`relative flex min-h-[66px] flex-col items-center justify-center rounded-xl border text-sm font-bold transition ${selected ? "border-[#2f63e3] bg-[#2f63e3] text-white shadow-md" : enabled ? "border-[#bfd0f3] bg-white text-[#263b6f] hover:border-[#2f63e3] hover:bg-[#eef3ff]" : "border-transparent bg-transparent text-[#b7c0d2]"} disabled:cursor-not-allowed`}
                  >
                    <span>{date.getDate()}</span>
                    {enabled ? <span className={`mt-1 text-[10px] ${selected ? "text-[#eaf0ff]" : "text-[#6577a2]"}`}>{option.jumlah_sesi} sesi</span> : null}
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-[#69789b]">Hari Jumat memiliki 4 sesi. Hari lainnya memiliki 5 sesi, masing-masing berdurasi 1,5 jam.</p>
          </div>

          <div className="mx-auto mt-4 max-w-3xl rounded-xl border border-[#dce4f5] p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-[#263b6f]">Tanggal dipilih ({draftDates.length})</p>
              {draftDates.length ? <button type="button" onClick={() => setDraftDates([])} className="text-xs font-bold text-[#b73a3a] hover:underline">Hapus semua</button> : null}
            </div>
            <div className="mt-3 flex min-h-[38px] flex-wrap gap-2">
              {draftDates.length ? draftDates.map((dateOnly) => <button key={dateOnly} type="button" onClick={() => toggleDate(dateOnly)} className="inline-flex items-center gap-1 rounded-full border border-[#c8d7f7] bg-[#eef3ff] px-3 py-1.5 text-xs font-bold text-[#274b9f]">{formatDateLabel(dateOnly)} <X className="h-3 w-3" /></button>) : <p className="text-sm text-[#7a88a9]">Belum ada tanggal yang dipilih.</p>}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-[#e4eaf6] bg-[#f8faff] px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-[#d2dcf1] bg-white px-4 py-2 text-sm font-bold text-[#344b7f] hover:bg-[#f1f5ff]">Batal</button>
          <button type="button" onClick={() => { onApply(uniqueSorted(draftDates)); onClose(); }} className="rounded-lg bg-[#2f63e3] px-4 py-2 text-sm font-bold text-white hover:brightness-110">Terapkan {draftDates.length} Tanggal</button>
        </div>
      </div>
    </div>
  );
}

function DosenSidangKetersediaanPage({ session, apiBaseUrl, onSessionExpired }) {
  const [view, setView] = useState("list");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [periods, setPeriods] = useState([]);
  const [detail, setDetail] = useState(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [form, setForm] = useState({
    tanggal_sidang_list: [],
    mobilitas_ruangan: "dapat_berpindah",
    maksimal_sesi_per_hari: 5,
    membutuhkan_jeda: false,
  });
  const [fieldErrors, setFieldErrors] = useState({});

  const fetchWithAuth = useCallback(async (path, options = {}) => {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      headers: { Authorization: `Bearer ${session.token}`, "Content-Type": "application/json", ...(options.headers || {}) },
    });
    if (response.status === 401 || response.status === 403) {
      const body = await response.json().catch(() => null);
      const message = String(body?.message || "").toLowerCase();
      if (response.status === 401 || message.includes("token tidak valid") || message.includes("token tidak ditemukan") || message.includes("kadaluarsa")) {
        onSessionExpired?.();
        throw new Error("__SESSION_EXPIRED__");
      }
    }
    return response;
  }, [apiBaseUrl, onSessionExpired, session.token]);

  const loadPeriods = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const response = await fetchWithAuth("/api/dosen/sidang/ketersediaan");
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.success) throw new Error(body?.message || "Gagal memuat periode sidang.");
      setPeriods(Array.isArray(body?.data?.periodes) ? body.data.periodes : []);
    } catch (loadError) {
      if (loadError.message !== "__SESSION_EXPIRED__") setError(loadError.message || "Gagal memuat periode sidang.");
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  const loadDetail = useCallback(async (periodId) => {
    try {
      setLoading(true);
      setError("");
      setSuccess("");
      const response = await fetchWithAuth(`/api/dosen/sidang/ketersediaan?periode_sidang_id=${periodId}`);
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.success) throw new Error(body?.message || "Gagal memuat detail periode sidang.");
      const nextDetail = body?.data || null;
      const selectedDates = uniqueSorted((nextDetail?.ketersediaan || []).map((item) => item.tanggal_sidang));
      setDetail(nextDetail);
      setForm({
        tanggal_sidang_list: selectedDates,
        mobilitas_ruangan: nextDetail?.preferensi?.mobilitas_ruangan || "dapat_berpindah",
        maksimal_sesi_per_hari: Number(nextDetail?.preferensi?.maksimal_sesi_per_hari || 5),
        membutuhkan_jeda: Boolean(nextDetail?.preferensi?.membutuhkan_jeda),
      });
      setFieldErrors({});
      setView("detail");
    } catch (loadError) {
      if (loadError.message !== "__SESSION_EXPIRED__") setError(loadError.message || "Gagal memuat detail periode sidang.");
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => { loadPeriods().catch(() => {}); }, [loadPeriods]);

  const handleSave = async () => {
    const errors = {};
    if (!form.tanggal_sidang_list.length) errors.tanggal_sidang_list = "Pilih minimal satu tanggal ketersediaan.";
    if (!form.mobilitas_ruangan) errors.mobilitas_ruangan = "Mobilitas ruangan wajib dipilih.";
    if (form.maksimal_sesi_per_hari < 1 || form.maksimal_sesi_per_hari > 5) errors.maksimal_sesi_per_hari = "Pilih nilai antara 1 sampai 5.";
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    try {
      setSaving(true);
      setError("");
      setSuccess("");
      const response = await fetchWithAuth("/api/dosen/sidang/ketersediaan", {
        method: "POST",
        body: JSON.stringify({ periode_sidang_id: detail?.periode_sidang?.id, ...form }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.success) throw new Error(body?.message || "Gagal menyimpan ketersediaan sidang.");
      setSuccess(body?.message || "Ketersediaan penguji sidang berhasil disimpan.");
      await loadDetail(detail.periode_sidang.id);
      setSuccess(body?.message || "Ketersediaan penguji sidang berhasil disimpan.");
    } catch (saveError) {
      if (saveError.message !== "__SESSION_EXPIRED__") setError(saveError.message || "Gagal menyimpan ketersediaan sidang.");
    } finally {
      setSaving(false);
    }
  };

  const period = detail?.periode_sidang;
  const isOpen = String(period?.status || "").toLowerCase() === "open";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {error ? <div className="rounded-xl border border-[#f3caca] bg-[#fff2f2] p-4 text-sm font-semibold text-[#a03f3f]">{error}</div> : null}
      {success ? <div className="rounded-xl border border-[#bfe8d0] bg-[#eefbf3] p-4 text-sm font-semibold text-[#147347]">{success}</div> : null}

      <section className="rounded-xl border border-[#e4e9f6] bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={view === "list"} onClick={() => { setView("list"); setDetail(null); setError(""); setSuccess(""); loadPeriods().catch(() => {}); }} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#d3dbef] text-[#27407b] hover:bg-[#f3f6ff] disabled:cursor-not-allowed disabled:opacity-50"><ArrowLeft className="h-4 w-4" /></button>
          <button type="button" disabled={loading} onClick={() => { if (view === "detail" && period?.id) loadDetail(period.id).catch(() => {}); else loadPeriods().catch(() => {}); }} className="inline-flex items-center gap-2 rounded-lg border border-[#d3dbef] px-3 py-2 text-sm font-semibold text-[#27407b] hover:bg-[#f3f6ff] disabled:opacity-60"><RefreshCcw className="h-4 w-4" />Refresh</button>
        </div>
      </section>

      {view === "list" ? (
        <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
          <div>
            <h3 className="text-lg font-black text-[#1b274b]">Grid Periode Sidang</h3>
            <p className="mt-1 text-sm text-[#66769a]">Pilih Detail untuk mengisi ketersediaan pada periode sidang yang dibuka Sekretaris Prodi.</p>
          </div>
          <div className="relative mt-3 flex-1 overflow-auto rounded-lg border border-[#e6ecf8] grid-unified-height">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead><tr className="border-y border-[#e6ecf8] text-[#4d5e89]">
                <th className="bg-[#f8fbff] px-3 py-2 font-semibold">No</th><th className="bg-[#f8fbff] px-3 py-2 font-semibold">Periode Sidang</th><th className="bg-[#f8fbff] px-3 py-2 font-semibold">Tahun Akademik</th><th className="bg-[#f8fbff] px-3 py-2 font-semibold">Semester</th><th className="bg-[#f8fbff] px-3 py-2 font-semibold">Rentang Pendaftaran</th><th className="bg-[#f8fbff] px-3 py-2 font-semibold">Hari Sidang</th><th className="bg-[#f8fbff] px-3 py-2 font-semibold">Status Pengisian</th><th className="bg-[#f8fbff] px-3 py-2 font-semibold">Diperbarui</th><th className="bg-[#f8fbff] px-3 py-2 font-semibold">Aksi</th>
              </tr></thead>
              <tbody>{periods.map((item, index) => <tr key={item.id} className="border-b border-[#eff3fb]">
                <td className="px-3 py-2">{index + 1}</td><td className="px-3 py-2 font-semibold text-[#1f2d53]">{item.label_periode}</td><td className="px-3 py-2">{item.tahun_akademik}</td><td className="px-3 py-2 capitalize">{item.semester}</td><td className="px-3 py-2">{formatDateLabel(item.tanggal_mulai_pendaftaran, false)} s/d {formatDateLabel(item.tanggal_selesai_pendaftaran, false)}</td><td className="px-3 py-2">{item.jumlah_hari_sidang} tanggal</td>
                <td className="px-3 py-2"><span className={`rounded-full px-2 py-1 text-xs font-bold ${item.ketersediaan_diisi ? "bg-[#e5f8ed] text-[#147347]" : "bg-[#fff4d9] text-[#926600]"}`}>{item.ketersediaan_diisi ? `${item.jumlah_tanggal_tersedia} tanggal dipilih` : "Belum diisi"}</span></td><td className="px-3 py-2">{formatDateTime(item.ketersediaan_diperbarui_at)}</td>
                <td className="px-3 py-2"><button type="button" onClick={() => loadDetail(item.id).catch(() => {})} className="inline-flex items-center gap-1 rounded-md bg-[#2f63e3] px-3 py-1.5 text-xs font-bold text-white hover:brightness-110"><Eye className="h-3.5 w-3.5" />Detail</button></td>
              </tr>)}</tbody>
            </table>
            {!loading && periods.length === 0 ? <div className="absolute inset-x-0 bottom-0 top-[41px] flex items-center justify-center text-sm font-semibold text-[#7b88ab]">Belum ada periode sidang yang dibuka.</div> : null}
            {loading ? <div className="absolute inset-x-0 bottom-0 top-[41px] flex items-center justify-center text-sm font-semibold text-[#7b88ab]">Memuat periode sidang...</div> : null}
          </div>
        </section>
      ) : null}

      {view === "detail" && period ? (
        <>
          <section className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h3 className="text-lg font-black text-[#1b274b]">Detail Ketersediaan — {period.label_periode}</h3><p className="mt-1 text-sm text-[#66769a]">Pilih tanggal tersedia dan lengkapi aturan penjadwalan Anda.</p></div>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${isOpen ? "bg-[#e5f8ed] text-[#147347]" : "bg-[#eef2fb] text-[#59678e]"}`}>{isOpen ? "Periode Aktif" : "Periode Ditutup"}</span>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
              <div className="rounded-lg border border-[#e1e8f7] bg-[#f8fbff] p-3"><p className="font-bold text-[#263b6f]">Rentang pendaftaran</p><p className="mt-1 text-[#596b94]">{formatDateLabel(period.tanggal_mulai_pendaftaran, false)} s/d {formatDateLabel(period.tanggal_selesai_pendaftaran, false)}</p></div>
              <div className="rounded-lg border border-[#e1e8f7] bg-[#f8fbff] p-3"><p className="font-bold text-[#263b6f]">Tanggal sidang</p><p className="mt-1 text-[#596b94]">{detail.tanggal_sidang?.length || 0} tanggal ditetapkan</p></div>
              <div className="rounded-lg border border-[#e1e8f7] bg-[#f8fbff] p-3"><p className="font-bold text-[#263b6f]">Ruangan</p><p className="mt-1 text-[#596b94]">{period.ruangan_sidang?.join(", ") || "-"}</p></div>
            </div>
          </section>

          <section className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
            <h3 className="text-lg font-black text-[#1b274b]">Form Ketersediaan Penguji</h3>
            <div className="mt-4 rounded-xl border border-[#dfe7f6] bg-[#f9fbff] p-4">
              <p className="text-sm font-bold text-[#263b6f]">Tanggal Anda Tersedia <span className="text-[#b73a3a]">*</span></p>
              <button type="button" disabled={!isOpen} onClick={() => setCalendarOpen(true)} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[#9db5ed] bg-white px-4 py-2.5 text-sm font-bold text-[#244a9f] hover:bg-[#eef3ff] disabled:cursor-not-allowed disabled:opacity-60"><CalendarDays className="h-4 w-4" />Buka Kalender Ketersediaan</button>
              <div className="mt-3 flex flex-wrap gap-2">{form.tanggal_sidang_list.map((dateOnly) => <span key={dateOnly} className="rounded-full border border-[#c8d7f7] bg-white px-3 py-1.5 text-xs font-bold text-[#274b9f]">{formatDateLabel(dateOnly)}</span>)}</div>
              {!form.tanggal_sidang_list.length ? <p className="mt-2 text-xs text-[#7583a5]">Belum ada tanggal yang dipilih.</p> : null}
              {fieldErrors.tanggal_sidang_list ? <p className="mt-2 text-xs font-semibold text-[#b73a3a]">{fieldErrors.tanggal_sidang_list}</p> : null}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <fieldset className="rounded-xl border border-[#dfe7f6] p-4"><legend className="px-1 text-sm font-bold text-[#263b6f]">Mobilitas Ruangan</legend>
                <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm text-[#334773]"><input type="radio" name="mobilitas" value="dapat_berpindah" disabled={!isOpen} checked={form.mobilitas_ruangan === "dapat_berpindah"} onChange={(event) => setForm((prev) => ({ ...prev, mobilitas_ruangan: event.target.value }))} className="accent-[#2f63e3]" />Dapat berpindah ruangan</label>
                <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-[#334773]"><input type="radio" name="mobilitas" value="satu_ruangan" disabled={!isOpen} checked={form.mobilitas_ruangan === "satu_ruangan"} onChange={(event) => setForm((prev) => ({ ...prev, mobilitas_ruangan: event.target.value }))} className="accent-[#2f63e3]" />Harus berada di satu ruangan yang sama</label>
              </fieldset>
              <label className="rounded-xl border border-[#dfe7f6] p-4 text-sm font-bold text-[#263b6f]">Maksimal Sesi per Hari
                <select disabled={!isOpen} value={form.maksimal_sesi_per_hari} onChange={(event) => setForm((prev) => ({ ...prev, maksimal_sesi_per_hari: Number(event.target.value) }))} className="mt-3 block w-full rounded-lg border border-[#d1daf0] bg-white px-3 py-2 font-normal outline-none focus:border-[#2f63e3]">{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value} sesi</option>)}</select>
              </label>
              <fieldset className="rounded-xl border border-[#dfe7f6] p-4"><legend className="px-1 text-sm font-bold text-[#263b6f]">Kebutuhan Jeda</legend>
                <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm text-[#334773]"><input type="radio" name="jeda" disabled={!isOpen} checked={!form.membutuhkan_jeda} onChange={() => setForm((prev) => ({ ...prev, membutuhkan_jeda: false }))} className="accent-[#2f63e3]" />Tidak memerlukan jeda</label>
                <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-[#334773]"><input type="radio" name="jeda" disabled={!isOpen} checked={form.membutuhkan_jeda} onChange={() => setForm((prev) => ({ ...prev, membutuhkan_jeda: true }))} className="accent-[#2f63e3]" />Memerlukan minimal satu sesi jeda</label>
              </fieldset>
            </div>

            <div className="mt-4 flex justify-end border-t border-[#e7edf8] pt-4"><button type="button" disabled={!isOpen || saving} onClick={() => handleSave().catch(() => {})} className="inline-flex items-center gap-2 rounded-lg bg-[#2f63e3] px-4 py-2 text-sm font-bold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"><Save className="h-4 w-4" />{saving ? "Menyimpan..." : "Simpan Ketersediaan"}</button></div>
            {!isOpen ? <p className="mt-3 rounded-lg border border-[#f2dfb3] bg-[#fff9e9] px-3 py-2 text-sm font-semibold text-[#7a5a00]">Periode telah ditutup. Data hanya dapat dilihat.</p> : null}
          </section>

          <section className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
            <h3 className="text-lg font-black text-[#1b274b]">Jadwal Anda Sebagai Penguji</h3>
            <div className="mt-3 overflow-auto rounded-lg border border-[#e6ecf8]"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-y border-[#e6ecf8] text-[#4d5e89]"><th className="bg-[#f8fbff] px-3 py-2 font-semibold">Tanggal</th><th className="bg-[#f8fbff] px-3 py-2 font-semibold">Sesi</th><th className="bg-[#f8fbff] px-3 py-2 font-semibold">Ruangan</th><th className="bg-[#f8fbff] px-3 py-2 font-semibold">Mahasiswa</th></tr></thead><tbody>{(detail.jadwal_anda || []).map((item) => <tr key={item.id} className="border-b border-[#eff3fb]"><td className="px-3 py-2">{formatDateLabel(item.tanggal_sidang)}</td><td className="px-3 py-2">Sesi {item.sesi_ke} ({item.sesi_mulai} - {item.sesi_selesai})</td><td className="px-3 py-2">{item.ruangan}</td><td className="px-3 py-2">{item.mahasiswa ? `${item.mahasiswa.nama} (${item.mahasiswa.nim})` : "-"}</td></tr>)}</tbody></table>{!detail.jadwal_anda?.length ? <p className="px-3 py-4 text-sm font-semibold text-[#7b88ab]">Belum ada jadwal sidang yang ditugaskan ke Anda.</p> : null}</div>
          </section>
        </>
      ) : null}

      <AvailabilityCalendarModal open={calendarOpen} allowedDates={detail?.tanggal_sidang || []} selectedDates={form.tanggal_sidang_list} onClose={() => setCalendarOpen(false)} onApply={(dates) => { setForm((prev) => ({ ...prev, tanggal_sidang_list: dates })); setFieldErrors((prev) => ({ ...prev, tanggal_sidang_list: "" })); }} />
    </div>
  );
}

export default DosenSidangKetersediaanPage;
