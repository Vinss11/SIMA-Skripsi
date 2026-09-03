import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, CalendarRange, ChevronLeft, ChevronRight, Eye, Pencil, RefreshCcw, Save, Search, SlidersHorizontal, X } from "lucide-react";
import Swal from "sweetalert2";
import { formatDosenFullName } from "../utils/dosen";

const GRID_PAGE_SIZE = 20;
const EXAMINER_GRID_PAGE_SIZE = 5;
const SIDANG_TABS = [
  { id: "periode-pendaftaran", label: "Periode Pendaftaran Sidang" },
  { id: "data-ketersediaan", label: "Data Ketersediaan" },
  { id: "assign-penguji", label: "Assign Dosen Penguji" },
];
const SIDANG_ROOM_OPTIONS = [
  "Ruang Sidang Pendadaran 1",
  "Ruang Sidang Pendadaran 2",
  "Ruang Sidang Pendadaran 3",
  "Ruang Sidang Pendadaran 4",
  "Ruang Sidang Pendadaran Prodi",
];

function showErrorToast(message) {
  Swal.fire({
    toast: true,
    position: "top-end",
    icon: "error",
    title: message,
    showConfirmButton: false,
    timer: 3200,
    timerProgressBar: true,
  });
}

function showSuccessToast(message) {
  Swal.fire({
    toast: true,
    position: "top-end",
    icon: "success",
    title: message,
    showConfirmButton: false,
    timer: 2800,
    timerProgressBar: true,
  });
}

function getJakartaTodayDateOnly() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(new Date()).reduce((acc, part) => {
    if (part.type !== "literal") acc[part.type] = part.value;
    return acc;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function formatDateLabel(value) {
  if (!value) return "-";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
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

function getAssignmentGridValues(registration, decision) {
  const schedule = registration?.jadwal_sidang;
  return {
    penguji1: formatDosenFullName(
      decision?.penguji1?.nama || schedule?.penguji1?.nama,
      decision?.penguji1?.gelar || schedule?.penguji1?.gelar
    ) || "",
    penguji2: formatDosenFullName(
      decision?.penguji2?.nama || schedule?.penguji2?.nama,
      decision?.penguji2?.gelar || schedule?.penguji2?.gelar
    ) || "",
    tanggal_sidang: String(decision?.tanggal_sidang || schedule?.tanggal_sidang || ""),
    sesi_ke: String(decision?.sesi_ke || schedule?.sesi_ke || ""),
    ruangan: String(decision?.ruangan || schedule?.ruangan || ""),
  };
}

function statusPendaftaranBadge(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "scheduled") return "bg-[#dff3ec] text-[#106d45]";
  if (normalized === "cancelled") return "bg-[#ffe9e9] text-[#b73a3a]";
  return "bg-[#fdf1d4] text-[#a06a00]";
}

function formatPeriodeSidangLabel(item) {
  if (!item) return "-";
  const periode = String(item.periode || "").toUpperCase();
  const semester = String(item.semester || "").toLowerCase() === "genap" ? "Genap" : "Ganjil";
  return `${periode} ${item.tahun_akademik || "-"} (${semester})`;
}

function uniqueSorted(values) {
  return Array.from(new Set((values || []).filter(Boolean))).sort((a, b) =>
    String(a).localeCompare(String(b))
  );
}

function isValidAcademicYear(value) {
  const match = String(value || "").trim().match(/^(\d{4})\/(\d{4})$/);
  return Boolean(match) && Number(match[2]) === Number(match[1]) + 1;
}

function buildAcademicYearOptions(referenceDate = new Date()) {
  const currentYear = Number(new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
  }).format(referenceDate));
  return [-1, 0, 1, 2, 3, 4, 5].map((offset) => {
    const startYear = currentYear + offset;
    return `${startYear}/${startYear + 1}`;
  });
}

const ACADEMIC_YEAR_OPTIONS = buildAcademicYearOptions();

function fieldClass(hasError) {
  return `mt-1 block w-full rounded-lg border px-3 py-2 text-sm font-normal outline-none ${
    hasError
      ? "border-[#dc4c4c] bg-[#fffafa] focus:border-[#c73737] focus:ring-1 focus:ring-[#f1b6b6]"
      : "border-[#d1daf0] focus:border-[#2f63e3]"
  }`;
}

function FieldError({ message }) {
  return message ? <p className="mt-1 text-xs font-semibold text-[#b73a3a]">{message}</p> : null;
}

function toLocalDateOnly(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseLocalDate(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function MultiDateCalendarModal({ open, selectedDates, lockedDates = [], minDate, initialDate, onClose, onApply, onLockedDateClick }) {
  const [visibleMonth, setVisibleMonth] = useState(() => new Date());
  const [draftDates, setDraftDates] = useState([]);

  useEffect(() => {
    if (!open) return;
    const initial = parseLocalDate(selectedDates?.[0] || initialDate || minDate) || new Date();
    setVisibleMonth(new Date(initial.getFullYear(), initial.getMonth(), 1));
    setDraftDates(uniqueSorted(selectedDates || []));
  }, [initialDate, minDate, open, selectedDates]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open]);

  if (!open) return null;

  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const firstDayOffset = (new Date(year, month, 1).getDay() + 6) % 7;
  const cells = Array.from({ length: 42 }, (_, index) => new Date(year, month, index - firstDayOffset + 1));
  const selectedSet = new Set(draftDates);
  const lockedSet = new Set((lockedDates || []).map(String));
  const monthLabel = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(visibleMonth);
  const today = toLocalDateOnly(new Date());

  const toggleDate = (dateOnly) => {
    if (lockedSet.has(dateOnly)) {
      onLockedDateClick?.(dateOnly);
      return;
    }
    setDraftDates((current) => current.includes(dateOnly)
      ? current.filter((item) => item !== dateOnly)
      : uniqueSorted([...current, dateOnly]));
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-[#0f1d3b]/65 p-4 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label="Pilih tanggal sidang" className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[#d9e3f7] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#e4eaf6] px-6 py-5">
          <div>
            <h3 className="text-xl font-black text-[#17264d]">Pilih Tanggal Sidang</h3>
            <p className="mt-1 text-sm text-[#60709a]">Klik beberapa tanggal yang tidak harus berurutan, lalu tekan Terapkan Pilihan.</p>
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
                const dateOnly = toLocalDateOnly(date);
                const inCurrentMonth = date.getMonth() === month;
                const isPast = dateOnly < minDate;
                const disabled = !inCurrentMonth || isPast;
                const selected = selectedSet.has(dateOnly);
                const locked = lockedSet.has(dateOnly);
                return (
                  <button
                    key={dateOnly}
                    type="button"
                    disabled={disabled}
                    onClick={() => toggleDate(dateOnly)}
                    title={locked ? "Tanggal sudah memiliki jadwal sidang dan tidak dapat dihapus" : undefined}
                    className={`relative flex min-h-[58px] items-center justify-center rounded-xl border text-sm font-bold transition ${
                      selected
                        ? "border-[#2f63e3] bg-[#2f63e3] text-white shadow-md"
                        : dateOnly === today
                          ? "border-[#2f63e3] bg-[#eef3ff] text-[#244cae]"
                          : disabled
                            ? "border-transparent bg-transparent text-[#b5bfd4]"
                            : "border-[#e0e7f5] bg-white text-[#263b6f] hover:border-[#7799ed] hover:bg-[#f2f6ff]"
                    } ${locked ? "cursor-not-allowed ring-2 ring-[#f3b4b4] ring-offset-1" : ""} disabled:cursor-not-allowed`}
                  >
                    {date.getDate()}
                    {dateOnly === today ? <span className={`absolute bottom-1 text-[9px] ${selected ? "text-white" : "text-[#2f63e3]"}`}>Hari ini</span> : null}
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-[#6b7898]">Semua hari dapat dipilih secara khusus. Hanya tanggal lampau yang dinonaktifkan.</p>
          </div>

          <div className="mx-auto mt-4 max-w-3xl rounded-xl border border-[#dce4f5] p-4">
            <div className="flex items-center justify-between gap-3"><p className="text-sm font-bold text-[#263b6f]">Tanggal dipilih ({draftDates.length})</p>{draftDates.length ? <button type="button" onClick={() => setDraftDates((current) => current.filter((dateOnly) => lockedSet.has(dateOnly)))} className="text-xs font-bold text-[#b73a3a] hover:underline">Hapus tanggal yang dapat dihapus</button> : null}</div>
            <div className="mt-3 flex min-h-[38px] flex-wrap gap-2">
              {draftDates.length ? draftDates.map((dateOnly) => <button key={dateOnly} type="button" onClick={() => toggleDate(dateOnly)} className="inline-flex items-center gap-1 rounded-full border border-[#c8d7f7] bg-[#eef3ff] px-3 py-1.5 text-xs font-bold text-[#274b9f]">{formatDateLabel(dateOnly)} <X className="h-3 w-3" /></button>) : <p className="text-sm text-[#7a88a9]">Belum ada tanggal yang dipilih.</p>}
            </div>
            {lockedSet.size > 0 ? <p className="mt-3 text-xs font-semibold text-[#a35b00]">Tanggal yang sudah memiliki jadwal sidang dikunci dan tidak dapat dihapus.</p> : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#e4eaf6] bg-[#f8faff] px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-[#d2dcf1] bg-white px-4 py-2 text-sm font-bold text-[#344b7f] hover:bg-[#f1f5ff]">Batal</button>
          <button type="button" onClick={() => { onApply(uniqueSorted(draftDates)); onClose(); }} className="rounded-lg bg-[#2f63e3] px-4 py-2 text-sm font-bold text-white hover:brightness-110">Terapkan {draftDates.length} Tanggal</button>
        </div>
      </div>
    </div>
  );
}

function ExaminerAvailabilityDetailModal({ dosen, sidangDates, onClose }) {
  const [visibleMonth, setVisibleMonth] = useState(() => new Date());

  useEffect(() => {
    if (!dosen) return;
    const initial = parseLocalDate(dosen.tanggal_tersedia?.[0] || sidangDates?.[0]?.tanggal_sidang) || new Date();
    setVisibleMonth(new Date(initial.getFullYear(), initial.getMonth(), 1));
  }, [dosen, sidangDates]);

  useEffect(() => {
    if (!dosen) return undefined;
    const closeOnEscape = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [dosen, onClose]);

  if (!dosen) return null;

  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const firstDayOffset = (new Date(year, month, 1).getDay() + 6) % 7;
  const cells = Array.from({ length: 42 }, (_, index) => new Date(year, month, index - firstDayOffset + 1));
  const selectedDates = new Set((dosen.tanggal_tersedia || []).map(String));
  const configuredDates = new Set((sidangDates || []).map((item) => String(item.tanggal_sidang)));
  const monthLabel = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(visibleMonth);
  const slotsByDate = (dosen.slot_tersedia || []).reduce((result, item) => {
    const key = String(item.tanggal_sidang);
    if (!result[key]) result[key] = [];
    result[key].push(item);
    return result;
  }, {});

  return (
    <div className="fixed inset-0 z-[170] flex items-center justify-center bg-[#0f1d3b]/65 p-4 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label="Detail ketersediaan dosen penguji" className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[#d9e3f7] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#e4eaf6] px-6 py-5">
          <div>
            <h3 className="text-xl font-black text-[#17264d]">Kalender Ketersediaan Penguji</h3>
            <p className="mt-1 text-sm font-semibold text-[#3d5286]">{formatDosenFullName(dosen.nama, dosen.gelar) || "-"}</p>
            <p className="text-xs text-[#6b789b]">{dosen.nik || dosen.kode_dosen || "-"}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup kalender ketersediaan" className="rounded-lg border border-[#d5def1] p-2 text-[#52658f] hover:bg-[#f3f6ff]"><X className="h-5 w-5" /></button>
        </div>

        <div className="min-h-0 overflow-y-auto p-6">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-xl border border-[#dce4f5] bg-[#fbfcff] p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <button type="button" onClick={() => setVisibleMonth(new Date(year, month - 1, 1))} className="rounded-lg border border-[#d2dcf1] bg-white p-2 text-[#28427d] hover:bg-[#eef3ff]"><ChevronLeft className="h-5 w-5" /></button>
                <p className="text-lg font-black capitalize text-[#1d315f]">{monthLabel}</p>
                <button type="button" onClick={() => setVisibleMonth(new Date(year, month + 1, 1))} className="rounded-lg border border-[#d2dcf1] bg-white p-2 text-[#28427d] hover:bg-[#eef3ff]"><ChevronRight className="h-5 w-5" /></button>
              </div>
              <div className="grid grid-cols-7 gap-2 text-center">
                {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((day) => <div key={day} className="py-2 text-xs font-bold uppercase tracking-wide text-[#64749a]">{day}</div>)}
                {cells.map((date) => {
                  const dateOnly = toLocalDateOnly(date);
                  const inCurrentMonth = date.getMonth() === month;
                  const selected = selectedDates.has(dateOnly);
                  const configured = configuredDates.has(dateOnly);
                  return <div key={dateOnly} className={`flex min-h-[58px] flex-col items-center justify-center rounded-xl border text-sm font-bold ${selected ? "border-[#2f63e3] bg-[#2f63e3] text-white shadow-sm" : configured && inCurrentMonth ? "border-[#d7e1f5] bg-white text-[#52658e]" : "border-transparent text-[#b7c0d2]"}`}><span>{date.getDate()}</span>{selected ? <span className="mt-1 text-[9px] text-[#e8efff]">Tersedia</span> : null}</div>;
                })}
              </div>
            </div>

            <div className="rounded-xl border border-[#dce4f5] bg-[#f8fbff] p-4">
              <h4 className="font-black text-[#1f2d53]">Tanggal dan Sesi Tersedia</h4>
              <div className="mt-3 max-h-[420px] space-y-3 overflow-y-auto pr-1">
                {(dosen.tanggal_tersedia || []).map((dateOnly) => (
                  <div key={`lecturer-date-${dateOnly}`} className="rounded-lg border border-[#dfe7f5] bg-white p-3">
                    <p className="text-sm font-bold text-[#294a91]">{formatDateLabel(dateOnly)}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(slotsByDate[dateOnly] || []).map((slot) => <span key={`${dateOnly}-${slot.sesi_ke}`} className="rounded-full bg-[#e8eefc] px-2.5 py-1 text-xs font-bold text-[#315196]">Sesi {slot.sesi_ke}</span>)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
            <div className="rounded-lg border border-[#dfe7f5] bg-[#f8fbff] p-3"><p className="font-bold text-[#263b6f]">Mobilitas Ruangan</p><p className="mt-1 text-[#596b94]">{dosen.preferensi?.mobilitas_ruangan === "satu_ruangan" ? "Satu ruangan yang sama" : "Dapat berpindah ruangan"}</p></div>
            <div className="rounded-lg border border-[#dfe7f5] bg-[#f8fbff] p-3"><p className="font-bold text-[#263b6f]">Maksimal Sesi per Hari</p><p className="mt-1 text-[#596b94]">{dosen.preferensi?.maksimal_sesi_per_hari || "-"} sesi</p></div>
            <div className="rounded-lg border border-[#dfe7f5] bg-[#f8fbff] p-3"><p className="font-bold text-[#263b6f]">Kebutuhan Jeda</p><p className="mt-1 text-[#596b94]">{dosen.preferensi?.membutuhkan_jeda ? "Memerlukan minimal satu sesi jeda" : "Tidak memerlukan jeda"}</p></div>
          </div>
        </div>

        <div className="flex justify-end border-t border-[#e4eaf6] bg-[#f8faff] px-6 py-4"><button type="button" onClick={onClose} className="rounded-lg bg-[#2f63e3] px-4 py-2 text-sm font-bold text-white hover:brightness-110">Tutup</button></div>
      </div>
    </div>
  );
}

function RegistrantDetailModal({ open, loading, detail, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open]);

  if (!open) return null;

  const mahasiswa = detail?.mahasiswa;
  const penjaluran = detail?.penjaluran_terakhir;
  const pendaftaran = detail?.pendaftaran_sidang;
  const progress = detail?.bimbingan_progress;

  const InfoRow = ({ label, value }) => (
    <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-3 border-b border-[#e8edf8] py-2.5 last:border-b-0">
      <dt className="text-xs font-bold uppercase tracking-wide text-[#7886a7]">{label}</dt>
      <dd className="min-w-0 break-words text-sm font-semibold text-[#334a7e]">{value || "-"}</dd>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-[180] flex items-center justify-center bg-[#0f1d3b]/65 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div role="dialog" aria-modal="true" aria-label="Detail pendaftar sidang" className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[#d9e3f7] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#e4eaf6] px-6 py-5">
          <div>
            <h3 className="text-xl font-black text-[#17264d]">Detail Pendaftar Sidang</h3>
            <p className="mt-1 text-sm text-[#6b789b]">Informasi mahasiswa, penjaluran, dan kelayakan pendaftaran sidang.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup detail pendaftar sidang" className="rounded-lg border border-[#d5def1] p-2 text-[#52658f] hover:bg-[#f3f6ff]"><X className="h-5 w-5" /></button>
        </div>

        <div className="min-h-0 overflow-y-auto p-6">
          {loading ? (
            <div className="flex min-h-[280px] items-center justify-center rounded-xl border border-[#e2e9f8] bg-[#f8fbff] text-sm font-semibold text-[#60709a]">
              Memuat detail mahasiswa...
            </div>
          ) : detail ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <section className="rounded-xl border border-[#dfe7f5] bg-[#fbfcff] p-4">
                <h4 className="mb-2 font-black text-[#1f2d53]">Identitas Mahasiswa</h4>
                <dl>
                  <InfoRow label="Nama" value={mahasiswa?.nama} />
                  <InfoRow label="NIM" value={mahasiswa?.nim} />
                  <InfoRow label="Email" value={mahasiswa?.email} />
                  <InfoRow label="Angkatan" value={mahasiswa?.angkatan} />
                  <InfoRow label="Status Jalur" value={mahasiswa?.status_jalur_saat_ini} />
                </dl>
              </section>

              <section className="rounded-xl border border-[#dfe7f5] bg-[#fbfcff] p-4">
                <h4 className="mb-2 font-black text-[#1f2d53]">Data Skripsi dan Penjaluran</h4>
                <dl>
                  <InfoRow label="Judul Skripsi" value={detail?.pengajuan_skripsi?.judul_skripsi} />
                  <InfoRow label="Semester" value={penjaluran?.semester_mahasiswa ? `Semester ${penjaluran.semester_mahasiswa}` : "-"} />
                  <InfoRow label="Jalur" value={penjaluran?.jalur} />
                  <InfoRow label="Pembimbing" value={formatDosenFullName(detail?.dosen_pembimbing?.nama, detail?.dosen_pembimbing?.gelar)} />
                </dl>
              </section>

              <section className="rounded-xl border border-[#dfe7f5] bg-[#fbfcff] p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h4 className="font-black text-[#1f2d53]">Status Pendaftaran</h4>
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusPendaftaranBadge(pendaftaran?.status)}`}>{pendaftaran?.status || "-"}</span>
                </div>
                <dl>
                  <InfoRow label="Terdaftar" value={formatDateTime(pendaftaran?.registered_at)} />
                  <InfoRow label="Periode" value={detail?.periode_sidang ? formatPeriodeSidangLabel(detail.periode_sidang) : "-"} />
                </dl>
              </section>

              <section className="rounded-xl border border-[#dfe7f5] bg-[#fbfcff] p-4">
                <h4 className="mb-2 font-black text-[#1f2d53]">Progress Kelayakan</h4>
                <dl>
                  <InfoRow label="Sesi Tervalidasi" value={`${progress?.counted_sessions || 0} / ${progress?.target_minimum || 8}`} />
                  <InfoRow label="Dokumen Disetujui" value={`${progress?.dokumen_approved_count || 0} / ${progress?.dokumen_total_required || 4}`} />
                </dl>
              </section>
            </div>
          ) : (
            <div className="flex min-h-[280px] items-center justify-center rounded-xl border border-[#f0d7d7] bg-[#fff8f8] text-sm font-semibold text-[#a34444]">
              Detail pendaftar sidang tidak dapat ditampilkan.
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-[#e4eaf6] bg-[#f8faff] px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg bg-[#2f63e3] px-4 py-2 text-sm font-bold text-white hover:brightness-110">Tutup</button>
        </div>
      </div>
    </div>
  );
}

function AssignmentEditModal({ row, dayOptions, lecturerOptions, roomOptions, otherRows, supervisorId, onClose, onSave }) {
  const [form, setForm] = useState({
    tanggal_sidang: "",
    sesi_ke: "",
    penguji1_dosen_id: "",
    penguji2_dosen_id: "",
  });
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!row) return;
    setForm({
      tanggal_sidang: String(row.tanggal_sidang || ""),
      sesi_ke: String(row.sesi_ke || ""),
      penguji1_dosen_id: String(row.penguji1_dosen_id || ""),
      penguji2_dosen_id: String(row.penguji2_dosen_id || ""),
    });
    setFormError("");
  }, [row]);

  useEffect(() => {
    if (!row) return undefined;
    const closeOnEscape = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, row]);

  if (!row) return null;

  const selectedDay = (dayOptions || []).find((item) => String(item.tanggal_sidang) === form.tanggal_sidang);
  const sessions = selectedDay?.sesi || [];
  const busyLecturerIds = new Set(
    (otherRows || [])
      .filter((item) => String(item.tanggal_sidang) === form.tanggal_sidang && String(item.sesi_ke) === String(form.sesi_ke))
      .flatMap((item) => [Number(item.penguji1_dosen_id), Number(item.penguji2_dosen_id)])
      .filter(Boolean)
  );
  const availableLecturers = (lecturerOptions || []).filter((item) =>
    Number(item.id) !== Number(supervisorId || 0)
    && !busyLecturerIds.has(Number(item.id))
    && (item.slot_tersedia || []).some((slot) =>
      String(slot.tanggal_sidang) === form.tanggal_sidang
      && String(slot.sesi_ke) === String(form.sesi_ke)
    )
  );

  const updateDate = (tanggalSidang) => {
    setForm((current) => ({
      ...current,
      tanggal_sidang: tanggalSidang,
      sesi_ke: "",
      penguji1_dosen_id: "",
      penguji2_dosen_id: "",
    }));
    setFormError("");
  };

  const updateSession = (sessionNumber) => {
    setForm((current) => ({
      ...current,
      sesi_ke: sessionNumber,
      penguji1_dosen_id: "",
      penguji2_dosen_id: "",
    }));
    setFormError("");
  };

  const submitEdit = () => {
    const penguji1Id = Number(form.penguji1_dosen_id || 0);
    const penguji2Id = Number(form.penguji2_dosen_id || 0);
    if (!form.tanggal_sidang || !form.sesi_ke || !penguji1Id || !penguji2Id) {
      setFormError("Hari, sesi, dan kedua dosen penguji wajib dipilih.");
      return;
    }
    if (penguji1Id === penguji2Id) {
      setFormError("Dosen Penguji 1 dan Dosen Penguji 2 harus berbeda.");
      return;
    }
    const session = sessions.find((item) => String(item.sesi_ke) === String(form.sesi_ke));
    const occupiedRooms = new Set(
      (otherRows || [])
        .filter((item) => String(item.tanggal_sidang) === form.tanggal_sidang && String(item.sesi_ke) === String(form.sesi_ke))
        .map((item) => String(item.ruangan || ""))
    );
    const selectedRoom = [row.ruangan, ...(roomOptions || [])]
      .map((item) => String(item || "").trim())
      .find((item, index, items) => item && items.indexOf(item) === index && !occupiedRooms.has(item));
    if (!selectedRoom) {
      setFormError("Tidak ada ruangan yang tersedia pada hari dan sesi tersebut.");
      return;
    }
    const penguji1 = availableLecturers.find((item) => Number(item.id) === penguji1Id);
    const penguji2 = availableLecturers.find((item) => Number(item.id) === penguji2Id);
    if (!penguji1 || !penguji2) {
      setFormError("Salah satu dosen tidak tersedia pada hari dan sesi yang dipilih.");
      return;
    }
    if (
      penguji1.profil_penilaian_penguji === "intensitas_tinggi"
      && penguji2.profil_penilaian_penguji === "intensitas_tinggi"
    ) {
      setFormError("Dua dosen dengan profil Intensitas Tinggi tidak dapat dipasangkan dalam satu sidang.");
      return;
    }
    onSave({
      ...row,
      tanggal_sidang: form.tanggal_sidang,
      sesi_ke: Number(form.sesi_ke),
      sesi_mulai: session?.sesi_mulai || row.sesi_mulai,
      sesi_selesai: session?.sesi_selesai || row.sesi_selesai,
      ruangan: selectedRoom,
      penguji1_dosen_id: penguji1Id,
      penguji2_dosen_id: penguji2Id,
      penguji1,
      penguji2,
      manually_edited: true,
      match_score: null,
      matched_fields: [],
    });
  };

  return (
    <div className="fixed inset-0 z-[180] flex items-center justify-center bg-[#0f1d3b]/65 p-4 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label="Edit penugasan dosen penguji" className="w-full max-w-3xl overflow-hidden rounded-2xl border border-[#d9e3f7] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#e4eaf6] px-6 py-5">
          <div>
            <h3 className="text-xl font-black text-[#17264d]">Edit Penugasan Dosen Penguji</h3>
            <p className="mt-1 text-sm text-[#60709a]">Nilai awal berasal dari rekomendasi AI untuk {row.mahasiswa_nama || "mahasiswa terpilih"}.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup editor" className="rounded-lg border border-[#d5def1] p-2 text-[#52658f] hover:bg-[#f3f6ff]"><X className="h-5 w-5" /></button>
        </div>

        <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
          <label className="text-sm font-bold text-[#263b6f]">
            Hari Sidang <span className="text-[#b73a3a]">*</span>
            <select value={form.tanggal_sidang} onChange={(event) => updateDate(event.target.value)} className={fieldClass(false)}>
              <option value="">Pilih hari sidang</option>
              {(dayOptions || []).map((item) => <option key={item.tanggal_sidang} value={item.tanggal_sidang}>{formatDateLabel(item.tanggal_sidang)}</option>)}
            </select>
          </label>
          <label className="text-sm font-bold text-[#263b6f]">
            Sesi <span className="text-[#b73a3a]">*</span>
            <select value={form.sesi_ke} onChange={(event) => updateSession(event.target.value)} disabled={!form.tanggal_sidang} className={fieldClass(false)}>
              <option value="">Pilih sesi</option>
              {sessions.map((item) => <option key={item.sesi_ke} value={item.sesi_ke}>Sesi {item.sesi_ke} · {item.sesi_mulai}–{item.sesi_selesai}</option>)}
            </select>
          </label>
          <label className="text-sm font-bold text-[#263b6f]">
            Dosen Penguji 1 <span className="text-[#b73a3a]">*</span>
            <select value={form.penguji1_dosen_id} onChange={(event) => { setForm((current) => ({ ...current, penguji1_dosen_id: event.target.value })); setFormError(""); }} disabled={!form.sesi_ke} className={fieldClass(false)}>
              <option value="">{form.sesi_ke ? "Pilih dosen penguji 1" : "Pilih hari dan sesi terlebih dahulu"}</option>
              {availableLecturers.filter((item) => String(item.id) !== form.penguji2_dosen_id).map((item) => <option key={item.id} value={item.id}>{formatDosenFullName(item.nama, item.gelar)}</option>)}
            </select>
          </label>
          <label className="text-sm font-bold text-[#263b6f]">
            Dosen Penguji 2 <span className="text-[#b73a3a]">*</span>
            <select value={form.penguji2_dosen_id} onChange={(event) => { setForm((current) => ({ ...current, penguji2_dosen_id: event.target.value })); setFormError(""); }} disabled={!form.sesi_ke} className={fieldClass(false)}>
              <option value="">{form.sesi_ke ? "Pilih dosen penguji 2" : "Pilih hari dan sesi terlebih dahulu"}</option>
              {availableLecturers.filter((item) => String(item.id) !== form.penguji1_dosen_id).map((item) => <option key={item.id} value={item.id}>{formatDosenFullName(item.nama, item.gelar)}</option>)}
            </select>
          </label>
          <div className="md:col-span-2 rounded-lg border border-[#dbe5f8] bg-[#f7faff] px-4 py-3 text-sm text-[#52658f]">
            Hari mengikuti konfigurasi periode sidang. Daftar dosen hanya menampilkan dosen yang mengisi ketersediaan pada hari dan sesi terpilih. Ruangan dipilih otomatis dari ruangan yang masih kosong.
          </div>
          {form.sesi_ke && availableLecturers.length < 2 ? (
            <div className="md:col-span-2 rounded-lg border border-[#f0d7a6] bg-[#fff9ec] px-4 py-3 text-sm font-semibold text-[#946200]">
              Hanya tersedia {availableLecturers.length} dosen pada hari dan sesi ini. Pilih sesi lain agar tersedia minimal 2 dosen penguji.
            </div>
          ) : null}
          {formError ? <div className="md:col-span-2 rounded-lg border border-[#f1c8c8] bg-[#fff7f7] px-4 py-3 text-sm font-semibold text-[#b73a3a]">{formError}</div> : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-[#e4eaf6] bg-[#f8faff] px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-[#d2dcf1] bg-white px-4 py-2 text-sm font-bold text-[#344b7f] hover:bg-[#f1f5ff]">Batal</button>
          <button type="button" onClick={submitEdit} className="inline-flex items-center gap-2 rounded-lg bg-[#2f63e3] px-4 py-2 text-sm font-bold text-white hover:brightness-110"><Save className="h-4 w-4" /> Simpan Perubahan</button>
        </div>
      </div>
    </div>
  );
}

function SekretarisSidangManagementPage({ session, apiBaseUrl, onSessionExpired, onRegisterLeaveGuard }) {
  const todayDateOnly = useMemo(() => getJakartaTodayDateOnly(), []);
  const [activeTab, setActiveTab] = useState("periode-pendaftaran");
  const [periodePageMode, setPeriodePageMode] = useState("list");
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [savingForm, setSavingForm] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [assigningExaminers, setAssigningExaminers] = useState(false);
  const [savingAssignments, setSavingAssignments] = useState(false);
  const [error, setError] = useState("");
  const [, setSuccess] = useState("");
  const [setupDraftPeriodeId, setSetupDraftPeriodeId] = useState(null);

  const [overview, setOverview] = useState({ active_periode: null, periodes: [] });
  const [selectedPeriodeId, setSelectedPeriodeId] = useState("");
  const [queueRows, setQueueRows] = useState([]);
  const [queueContext, setQueueContext] = useState({ hari_sidang: [], dosen_tersedia: [] });
  const [selectedAvailableDosen, setSelectedAvailableDosen] = useState(null);
  const [examinerPage, setExaminerPage] = useState(1);
  const [examinerQuery, setExaminerQuery] = useState("");
  const [queueQuery, setQueueQuery] = useState("");
  const [queuePage, setQueuePage] = useState(1);
  const [showAssignmentFilters, setShowAssignmentFilters] = useState(false);
  const [assignmentFilters, setAssignmentFilters] = useState({
    penguji1: "",
    penguji2: "",
    tanggal_sidang: "",
    sesi_ke: "",
    ruangan: "",
  });
  const [selectedAssignmentRegistrantIds, setSelectedAssignmentRegistrantIds] = useState([]);
  const [assignmentRows, setAssignmentRows] = useState([]);
  const [assignmentCommitted, setAssignmentCommitted] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(null);

  const [selectedRegistrantId, setSelectedRegistrantId] = useState(null);
  const [selectedRegistrantDetail, setSelectedRegistrantDetail] = useState(null);

  const [openPeriodeForm, setOpenPeriodeForm] = useState({
    periode: "uts",
    tahun_akademik: "",
    semester: "ganjil",
    tanggal_mulai_pendaftaran: "",
    tanggal_selesai_pendaftaran: "",
  });
  const [openPeriodeErrors, setOpenPeriodeErrors] = useState({});

  const [editPeriodeForm, setEditPeriodeForm] = useState({
    periode: "uts",
    tahun_akademik: "",
    semester: "ganjil",
    tanggal_mulai_pendaftaran: "",
    tanggal_selesai_pendaftaran: "",
    catatan: "",
    tanggal_sidang_list: [],
    ruangan_list: [],
  });
  const [editPeriodeErrors, setEditPeriodeErrors] = useState({});
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [editRoomInput, setEditRoomInput] = useState("");
  const [editRoomError, setEditRoomError] = useState("");

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

      if (response.status === 401 || response.status === 403) {
        const body = await response.json().catch(() => null);
        const message = String(body?.message || "").toLowerCase();
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
    },
    [apiBaseUrl, onSessionExpired, session.token]
  );

  const loadOverview = useCallback(async () => {
    try {
      setLoadingOverview(true);
      setError("");
      const response = await fetchWithAuth("/api/sekretaris/sidang/periode");
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.success) {
        throw new Error(body?.message || "Gagal memuat periode sidang.");
      }
      const data = body?.data || { active_periode: null, periodes: [] };
      setOverview(data);
      const fallbackId =
        data?.active_periode?.id ||
        (Array.isArray(data?.periodes) && data.periodes.length > 0 ? data.periodes[0].id : "");
      setSelectedPeriodeId((prev) => {
        const previousStillExists = prev && (data?.periodes || []).some(
          (item) => String(item.id) === String(prev)
        );
        return previousStillExists ? prev : fallbackId ? String(fallbackId) : "";
      });
    } catch (loadError) {
      if (loadError.message !== "__SESSION_EXPIRED__") {
        setError(loadError.message || "Gagal memuat periode sidang.");
      }
    } finally {
      setLoadingOverview(false);
    }
  }, [fetchWithAuth]);

  const loadQueueByPeriode = useCallback(
    async (periodeId) => {
      if (!periodeId) {
        setQueueRows([]);
        setQueueContext({ hari_sidang: [], dosen_tersedia: [] });
        return;
      }
      try {
        setLoadingQueue(true);
        setError("");
        const response = await fetchWithAuth(`/api/sekretaris/sidang/queue?periode_sidang_id=${periodeId}`);
        const body = await response.json().catch(() => null);
        if (!response.ok || !body?.success) {
          throw new Error(body?.message || "Gagal memuat data pendaftar sidang.");
        }
        const rows = Array.isArray(body?.data?.rows) ? body.data.rows : [];
        setQueueRows(rows);
        setQueueContext({
          hari_sidang: Array.isArray(body?.data?.hari_sidang) ? body.data.hari_sidang : [],
          dosen_tersedia: Array.isArray(body?.data?.dosen_tersedia) ? body.data.dosen_tersedia : [],
        });
      } catch (loadError) {
        setQueueRows([]);
        setQueueContext({ hari_sidang: [], dosen_tersedia: [] });
        if (loadError.message !== "__SESSION_EXPIRED__") {
          setError(loadError.message || "Gagal memuat data pendaftar sidang.");
        }
      } finally {
        setLoadingQueue(false);
      }
    },
    [fetchWithAuth]
  );

  const loadRegistrantDetail = useCallback(
    async (registrationId) => {
      if (!registrationId) return;
      try {
        setLoadingDetail(true);
        setSelectedRegistrantDetail(null);
        setError("");
        const response = await fetchWithAuth(`/api/sekretaris/sidang/queue/${registrationId}`);
        const body = await response.json().catch(() => null);
        if (!response.ok || !body?.success) {
          throw new Error(body?.message || "Gagal memuat detail pendaftar sidang.");
        }
        setSelectedRegistrantDetail(body?.data || null);
      } catch (loadError) {
        if (loadError.message !== "__SESSION_EXPIRED__") {
          setError(loadError.message || "Gagal memuat detail pendaftar sidang.");
        }
      } finally {
        setLoadingDetail(false);
      }
    },
    [fetchWithAuth]
  );

  const runExaminerAssignment = useCallback(async ({ commit = false } = {}) => {
    if (!selectedPeriodeId) {
      showErrorToast("Pilih periode sidang terlebih dahulu.");
      return;
    }
    if (!commit && selectedAssignmentRegistrantIds.length === 0) {
      showErrorToast("Pilih minimal satu mahasiswa yang akan diproses oleh AI.");
      return;
    }
    try {
      if (commit) setSavingAssignments(true);
      else setAssigningExaminers(true);
      const response = await fetchWithAuth("/api/sekretaris/sidang/assign", {
        method: "POST",
        body: JSON.stringify({
          periode_sidang_id: Number(selectedPeriodeId),
          commit,
          pendaftaran_sidang_ids: commit
            ? assignmentRows.map((row) => Number(row.pendaftaran_sidang_id))
            : selectedAssignmentRegistrantIds.map(Number),
          ...(commit ? {
            assignments: assignmentRows.map((row) => ({
              pendaftaran_sidang_id: row.pendaftaran_sidang_id,
              tanggal_sidang: row.tanggal_sidang,
              sesi_ke: row.sesi_ke,
              ruangan: row.ruangan,
              penguji1_dosen_id: row.penguji1_dosen_id,
              penguji2_dosen_id: row.penguji2_dosen_id,
            })),
          } : {}),
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.success) {
        throw new Error(body?.message || "Gagal menjalankan rekomendasi dosen penguji.");
      }
      const rows = Array.isArray(body?.data?.assigned) ? body.data.assigned : [];
      setAssignmentRows(rows);
      setAssignmentCommitted(commit);
      showSuccessToast(body?.message || (commit
        ? "Hasil penugasan berhasil disimpan."
        : "Rekomendasi dosen penguji berhasil dibuat."));
      if (commit) await loadQueueByPeriode(Number(selectedPeriodeId));
    } catch (assignmentError) {
      if (assignmentError.message !== "__SESSION_EXPIRED__") {
        showErrorToast(assignmentError.message || "Gagal menjalankan rekomendasi dosen penguji.");
      }
    } finally {
      if (commit) setSavingAssignments(false);
      else setAssigningExaminers(false);
    }
  }, [assignmentRows, fetchWithAuth, loadQueueByPeriode, selectedAssignmentRegistrantIds, selectedPeriodeId]);

  useEffect(() => {
    loadOverview().catch(() => {});
  }, [loadOverview]);

  useEffect(() => {
    if (!error) return;
    showErrorToast(error);
    setError("");
  }, [error]);

  useEffect(() => {
    if (selectedPeriodeId) {
      loadQueueByPeriode(Number(selectedPeriodeId)).catch(() => {});
    }
    setQueuePage(1);
    setSelectedRegistrantId(null);
    setSelectedRegistrantDetail(null);
    setAssignmentRows([]);
    setAssignmentCommitted(false);
    setSelectedAssignmentRegistrantIds([]);
    setShowAssignmentFilters(false);
    setAssignmentFilters({ penguji1: "", penguji2: "", tanggal_sidang: "", sesi_ke: "", ruangan: "" });
  }, [loadQueueByPeriode, selectedPeriodeId]);

  const selectedPeriode = useMemo(() => {
    const numericId = Number(selectedPeriodeId || 0);
    return (overview?.periodes || []).find((item) => Number(item.id) === numericId) || null;
  }, [overview, selectedPeriodeId]);

  const scheduledSidangDates = useMemo(() => uniqueSorted(
    queueRows
      .map((row) => row?.jadwal_sidang?.tanggal_sidang)
      .filter(Boolean)
      .map(String)
  ), [queueRows]);

  const handleRemoveSidangDate = useCallback((tanggal) => {
    if (scheduledSidangDates.includes(String(tanggal))) {
      showErrorToast(
        `Hari sidang ${formatDateLabel(tanggal)} tidak dapat dihapus karena sudah memiliki jadwal dan dosen penguji.`
      );
      return;
    }
    setEditPeriodeForm((prev) => ({
      ...prev,
      tanggal_sidang_list: (prev.tanggal_sidang_list || []).filter((item) => item !== tanggal),
    }));
    setEditPeriodeErrors((prev) => ({ ...prev, tanggal_sidang_list: "" }));
  }, [scheduledSidangDates]);

  useEffect(() => {
    if (!["configure", "registrants"].includes(periodePageMode)) return;
    const periodes = Array.isArray(overview?.periodes) ? overview.periodes : [];
    if (periodes.length === 0) return;
    if (selectedPeriode) return;
    const fallbackPeriode = periodePageMode === "registrants"
      ? overview?.active_periode || periodes[0]
      : periodes[0];
    setSelectedPeriodeId(String(fallbackPeriode.id));
  }, [overview, periodePageMode, selectedPeriode]);

  useEffect(() => {
    if (!selectedPeriode) return;
    setEditPeriodeForm({
      periode: selectedPeriode.periode || "uts",
      tahun_akademik: selectedPeriode.tahun_akademik || "",
      semester: selectedPeriode.semester || "ganjil",
      tanggal_mulai_pendaftaran: selectedPeriode.tanggal_mulai_pendaftaran || "",
      tanggal_selesai_pendaftaran: selectedPeriode.tanggal_selesai_pendaftaran || "",
      catatan: selectedPeriode.catatan || "",
      tanggal_sidang_list: Array.isArray(selectedPeriode.hari_sidang)
        ? uniqueSorted(selectedPeriode.hari_sidang)
        : [],
      ruangan_list: Array.isArray(selectedPeriode.ruangan_sidang)
        ? uniqueSorted(selectedPeriode.ruangan_sidang)
        : [],
    });
    setCalendarOpen(false);
    setEditRoomInput("");
    setEditRoomError("");
    setEditPeriodeErrors({});
  }, [selectedPeriode]);

  const addEditRoom = useCallback(() => {
    const clean = String(editRoomInput || "").trim();
    if (!clean) {
      setEditRoomError("Ruangan sidang wajib diisi sebelum ditambahkan.");
      return;
    }
    setEditRoomError("");
    setEditPeriodeForm((prev) => {
      const existing = Array.isArray(prev.ruangan_list) ? prev.ruangan_list : [];
      const lowerMap = new Map(existing.map((room) => [String(room).toLowerCase(), room]));
      if (!lowerMap.has(clean.toLowerCase())) {
        lowerMap.set(clean.toLowerCase(), clean);
      }
      return {
        ...prev,
        ruangan_list: uniqueSorted(Array.from(lowerMap.values())),
      };
    });
    setEditRoomInput("");
  }, [editRoomInput]);

  const validatePeriodForm = useCallback(
    (form) => {
      const errors = {};
      if (!["uts", "uas"].includes(String(form.periode || "").toLowerCase())) {
        errors.periode = "Jenis periode wajib dipilih.";
      }
      if (!String(form.tahun_akademik || "").trim()) {
        errors.tahun_akademik = "Tahun akademik wajib diisi.";
      } else if (!isValidAcademicYear(form.tahun_akademik)) {
        errors.tahun_akademik = "Gunakan format YYYY/YYYY dengan tahun berurutan, contoh 2025/2026.";
      }
      if (!["ganjil", "genap"].includes(String(form.semester || "").toLowerCase())) {
        errors.semester = "Semester wajib dipilih.";
      }
      if (!form.tanggal_mulai_pendaftaran) {
        errors.tanggal_mulai_pendaftaran = "Tanggal mulai pendaftaran wajib diisi.";
      }
      if (!form.tanggal_selesai_pendaftaran) {
        errors.tanggal_selesai_pendaftaran = "Tanggal selesai pendaftaran wajib diisi.";
      }
      if (form.tanggal_mulai_pendaftaran && form.tanggal_selesai_pendaftaran
        && form.tanggal_selesai_pendaftaran < form.tanggal_mulai_pendaftaran) {
        errors.tanggal_selesai_pendaftaran = "Tanggal selesai tidak boleh lebih awal dari tanggal mulai.";
      }
      return errors;
    },
    []
  );

  const handleContinuePeriodeConfiguration = async () => {
    const validationErrors = validatePeriodForm(openPeriodeForm);
    setOpenPeriodeErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      setError("");
      setSuccess("");
      return;
    }

    try {
      setSavingForm(true);
      setError("");
      setSuccess("");

      const createResponse = await fetchWithAuth("/api/sekretaris/sidang/periode", {
        method: "POST",
        body: JSON.stringify(openPeriodeForm),
      });
      const createBody = await createResponse.json().catch(() => null);
      if (!createResponse.ok || !createBody?.success) {
        if (createBody?.field_errors && typeof createBody.field_errors === "object") {
          setOpenPeriodeErrors(createBody.field_errors);
          setError("");
          return;
        }
        throw new Error(createBody?.message || "Gagal membuat periode pendaftaran sidang.");
      }

      const periodeId = Number(createBody?.data?.periode?.id || 0);
      if (!periodeId) {
        throw new Error("Periode sidang berhasil dibuat tetapi ID tidak ditemukan.");
      }

      setSuccess("Data periode tersimpan sebagai draft. Lengkapi hari dan ruangan untuk membuka periode.");
      setOpenPeriodeErrors({});
      setSetupDraftPeriodeId(periodeId);
      setSelectedPeriodeId(String(periodeId));
      setOpenPeriodeForm({
        periode: "uts",
        tahun_akademik: "",
        semester: "ganjil",
        tanggal_mulai_pendaftaran: "",
        tanggal_selesai_pendaftaran: "",
      });
      await loadOverview();
      setActiveTab("periode-pendaftaran");
      setPeriodePageMode("configure");
    } catch (actionError) {
      if (actionError.message !== "__SESSION_EXPIRED__") {
        setError(actionError.message || "Gagal membuka periode pendaftaran sidang.");
      }
    } finally {
      setSavingForm(false);
    }
  };

  const confirmAndDiscardSetupDraft = useCallback(async () => {
    if (periodePageMode !== "configure" || !setupDraftPeriodeId) return true;

    const confirmation = await Swal.fire({
      title: "Keluar dari pengaturan periode?",
      text: "Periode belum selesai dibuka. Jika keluar, data sementara akan dihapus dan pengisian periode harus dimulai kembali dari awal.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Ya, Keluar dan Ulangi",
      cancelButtonText: "Tetap di Halaman",
      confirmButtonColor: "#b5473c",
    });
    if (!confirmation.isConfirmed) return false;

    try {
      setSavingForm(true);
      const response = await fetchWithAuth(
        `/api/sekretaris/sidang/periode/${setupDraftPeriodeId}/draft`,
        { method: "DELETE" }
      );
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.success) {
        throw new Error(body?.message || "Gagal membatalkan draft periode sidang.");
      }

      setSetupDraftPeriodeId(null);
      setSelectedPeriodeId("");
      setCalendarOpen(false);
      setEditRoomInput("");
      setEditRoomError("");
      setSuccess("");
      await loadOverview();
      return true;
    } catch (actionError) {
      if (actionError.message !== "__SESSION_EXPIRED__") {
        showErrorToast(actionError.message || "Gagal membatalkan draft periode sidang.");
      }
      return false;
    } finally {
      setSavingForm(false);
    }
  }, [fetchWithAuth, loadOverview, periodePageMode, setupDraftPeriodeId]);

  useEffect(() => {
    onRegisterLeaveGuard?.(confirmAndDiscardSetupDraft);
    return () => onRegisterLeaveGuard?.(null);
  }, [confirmAndDiscardSetupDraft, onRegisterLeaveGuard]);

  useEffect(() => {
    if (periodePageMode !== "configure" || !setupDraftPeriodeId) return undefined;
    const warnBeforeBrowserExit = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const discardDraftAfterBrowserExit = () => {
      fetch(`${apiBaseUrl}/api/sekretaris/sidang/periode/${setupDraftPeriodeId}/draft`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.token}`,
          "Content-Type": "application/json",
        },
        keepalive: true,
      }).catch(() => {});
    };
    window.addEventListener("beforeunload", warnBeforeBrowserExit);
    window.addEventListener("pagehide", discardDraftAfterBrowserExit);
    return () => {
      window.removeEventListener("beforeunload", warnBeforeBrowserExit);
      window.removeEventListener("pagehide", discardDraftAfterBrowserExit);
    };
  }, [apiBaseUrl, periodePageMode, session.token, setupDraftPeriodeId]);

  const handleSaveSelectedPeriode = async () => {
    if (!selectedPeriode) return;
    const tanggalSelesai = String(editPeriodeForm.tanggal_selesai_pendaftaran || "").trim();
    const tanggalMulai = String(selectedPeriode.tanggal_mulai_pendaftaran || "").slice(0, 10);
    const tanggalSidangList = Array.isArray(editPeriodeForm.tanggal_sidang_list)
      ? uniqueSorted(editPeriodeForm.tanggal_sidang_list)
      : [];
    const ruanganList = Array.isArray(editPeriodeForm.ruangan_list)
      ? uniqueSorted(editPeriodeForm.ruangan_list)
      : [];
    const validationErrors = {};
    if (!tanggalSelesai) {
      validationErrors.tanggal_selesai_pendaftaran = "Tanggal selesai pendaftaran wajib diisi.";
    } else if (tanggalMulai && tanggalSelesai < tanggalMulai) {
      validationErrors.tanggal_selesai_pendaftaran = "Tanggal selesai tidak boleh sebelum tanggal mulai pendaftaran.";
    }
    if (tanggalSidangList.length === 0) {
      validationErrors.tanggal_sidang_list = "Pilih minimal satu hari sidang.";
    }
    if (ruanganList.length === 0) {
      validationErrors.ruangan_list = "Tambahkan minimal satu ruangan sidang.";
      setEditRoomError(validationErrors.ruangan_list);
    }
    setEditPeriodeErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      setError("");
      setSuccess("");
      return;
    }

    try {
      setSavingForm(true);
      setError("");
      setSuccess("");
      const response = await fetchWithAuth(`/api/sekretaris/sidang/periode/${selectedPeriode.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          tanggal_selesai_pendaftaran: tanggalSelesai,
          tanggal_sidang_list: tanggalSidangList,
          ruangan_list: ruanganList,
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.success) {
        if (body?.field_errors && typeof body.field_errors === "object") {
          setEditPeriodeErrors(body.field_errors);
          if (Array.isArray(body?.protected_dates) && body.protected_dates.length > 0) {
            showErrorToast(body?.message || "Hari yang sudah memiliki jadwal sidang tidak dapat dihapus.");
          }
          setError("");
          return;
        }
        throw new Error(body?.message || "Gagal memperbarui periode sidang.");
      }
      setSuccess(body?.message || "Periode sidang berhasil diperbarui.");
      setEditPeriodeErrors({});
      setEditRoomError("");
      setPeriodePageMode("list");
      await loadOverview();
      await loadQueueByPeriode(selectedPeriode.id);
    } catch (actionError) {
      if (actionError.message !== "__SESSION_EXPIRED__") {
        setError(actionError.message || "Gagal memperbarui periode sidang.");
      }
    } finally {
      setSavingForm(false);
    }
  };

  const handleOpenSelectedPeriode = async () => {
    if (!selectedPeriode) return;
    const dateList = Array.isArray(editPeriodeForm.tanggal_sidang_list)
      ? uniqueSorted(editPeriodeForm.tanggal_sidang_list)
      : [];
    const roomList = Array.isArray(editPeriodeForm.ruangan_list)
      ? uniqueSorted(editPeriodeForm.ruangan_list)
      : [];
    if (dateList.length === 0) {
      setError("Pilih minimal 1 tanggal sidang dari kalender sebelum membuka periode.");
      setSuccess("");
      return;
    }
    if (roomList.length === 0) {
      setEditRoomError("Tambahkan minimal satu ruangan sidang sebelum membuka periode.");
      setError("");
      setSuccess("");
      return;
    }
    const confirm = window.confirm(
      `Buka periode sidang ${selectedPeriode.label_periode || formatPeriodeSidangLabel(selectedPeriode)}?`
    );
    if (!confirm) return;

    try {
      setSavingForm(true);
      setError("");
      setSuccess("");
      setEditRoomError("");
      const settingsResponse = await fetchWithAuth(`/api/sekretaris/sidang/periode/${selectedPeriode.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          tanggal_sidang_list: dateList,
          ruangan_list: roomList,
        }),
      });
      const settingsBody = await settingsResponse.json().catch(() => null);
      if (!settingsResponse.ok || !settingsBody?.success) {
        throw new Error(settingsBody?.message || "Gagal menyimpan hari dan ruangan sidang.");
      }
      const response = await fetchWithAuth(`/api/sekretaris/sidang/periode/${selectedPeriode.id}/open`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.success) {
        throw new Error(body?.message || "Gagal membuka periode sidang.");
      }
      setSuccess(body?.message || "Periode sidang berhasil dibuka.");
      setSetupDraftPeriodeId(null);
      setPeriodePageMode("list");
      await loadOverview();
      await loadQueueByPeriode(selectedPeriode.id);
    } catch (actionError) {
      if (actionError.message !== "__SESSION_EXPIRED__") {
        setError(actionError.message || "Gagal membuka periode sidang.");
      }
    } finally {
      setSavingForm(false);
    }
  };

  const handleCloseSelectedPeriode = async () => {
    if (!selectedPeriode) return;
    const periodeLabel = selectedPeriode.label_periode || formatPeriodeSidangLabel(selectedPeriode);
    const confirmation = await Swal.fire({
      title: "Tutup periode sidang?",
      text: `Periode ${periodeLabel} akan ditutup dan tidak dapat digunakan untuk pendaftaran baru.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Ya, Tutup Periode",
      cancelButtonText: "Batal",
      confirmButtonColor: "#b73a3a",
      cancelButtonColor: "#64748b",
      reverseButtons: true,
      focusCancel: true,
    });
    if (!confirmation.isConfirmed) return;

    try {
      setSavingForm(true);
      setError("");
      setSuccess("");
      const response = await fetchWithAuth(`/api/sekretaris/sidang/periode/${selectedPeriode.id}/close`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.success) {
        throw new Error(body?.message || "Gagal menutup periode sidang.");
      }
      setSuccess("");
      showSuccessToast(
        `Periode sidang ${periodeLabel} berhasil ditutup.`
      );
      setPeriodePageMode("list");
      await loadOverview();
      await loadQueueByPeriode(selectedPeriode.id);
    } catch (actionError) {
      if (actionError.message !== "__SESSION_EXPIRED__") {
        setError(actionError.message || "Gagal menutup periode sidang.");
      }
    } finally {
      setSavingForm(false);
    }
  };

  const assignmentFilterOptions = useMemo(() => {
    const decisionByRegistrationId = new Map(
      assignmentRows.map((row) => [Number(row.pendaftaran_sidang_id), row])
    );
    const values = queueRows.map((registration) => getAssignmentGridValues(
      registration,
      decisionByRegistrationId.get(Number(registration.id))
    ));
    const distinct = (items) => Array.from(new Set(items.filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b), "id"));
    return {
      penguji1: distinct(values.map((item) => item.penguji1)),
      penguji2: distinct(values.map((item) => item.penguji2)),
      tanggal_sidang: distinct([
        ...queueContext.hari_sidang.map((item) => item?.tanggal_sidang),
        ...values.map((item) => item.tanggal_sidang),
      ]),
      sesi_ke: distinct([
        ...queueContext.hari_sidang.flatMap((item) => (item?.sesi || []).map((sesi) => String(sesi?.sesi_ke || sesi || ""))),
        ...values.map((item) => item.sesi_ke),
      ]),
      ruangan: distinct([
        ...(Array.isArray(selectedPeriode?.ruangan_sidang) ? selectedPeriode.ruangan_sidang : []),
        ...values.map((item) => item.ruangan),
      ]),
    };
  }, [assignmentRows, queueContext.hari_sidang, queueRows, selectedPeriode]);

  const filteredQueueRows = useMemo(() => {
    const keyword = String(queueQuery || "").trim().toLowerCase();
    const decisionByRegistrationId = new Map(
      assignmentRows.map((row) => [Number(row.pendaftaran_sidang_id), row])
    );
    return queueRows.filter((row) => {
      const haystack = [
        row?.mahasiswa?.nim,
        row?.mahasiswa?.nama,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (keyword && !haystack.includes(keyword)) return false;
      if (periodePageMode !== "registrants") return true;

      const values = getAssignmentGridValues(row, decisionByRegistrationId.get(Number(row.id)));
      return (!assignmentFilters.penguji1 || values.penguji1 === assignmentFilters.penguji1)
        && (!assignmentFilters.penguji2 || values.penguji2 === assignmentFilters.penguji2)
        && (!assignmentFilters.tanggal_sidang || values.tanggal_sidang === assignmentFilters.tanggal_sidang)
        && (!assignmentFilters.sesi_ke || values.sesi_ke === assignmentFilters.sesi_ke)
        && (!assignmentFilters.ruangan || values.ruangan === assignmentFilters.ruangan);
    });
  }, [assignmentFilters, assignmentRows, periodePageMode, queueRows, queueQuery]);

  const filteredAvailableExaminers = useMemo(() => {
    const keyword = String(examinerQuery || "").trim().toLowerCase();
    if (!keyword) return queueContext.dosen_tersedia;
    return queueContext.dosen_tersedia.filter((dosen) => [
      dosen?.nik,
      dosen?.nama,
    ].filter(Boolean).join(" ").toLowerCase().includes(keyword));
  }, [examinerQuery, queueContext.dosen_tersedia]);

  const totalPages = Math.max(1, Math.ceil(filteredQueueRows.length / GRID_PAGE_SIZE));
  const currentPage = Math.min(queuePage, totalPages);
  const pageStart = filteredQueueRows.length ? (currentPage - 1) * GRID_PAGE_SIZE + 1 : 0;
  const pageEnd = filteredQueueRows.length
    ? Math.min(filteredQueueRows.length, currentPage * GRID_PAGE_SIZE)
    : 0;
  const pagedRows = filteredQueueRows.slice(
    (currentPage - 1) * GRID_PAGE_SIZE,
    currentPage * GRID_PAGE_SIZE
  );
  const examinerTotalPages = Math.max(
    1,
    Math.ceil(filteredAvailableExaminers.length / EXAMINER_GRID_PAGE_SIZE)
  );
  const currentExaminerPage = Math.min(examinerPage, examinerTotalPages);
  const examinerPageStart = filteredAvailableExaminers.length
    ? (currentExaminerPage - 1) * EXAMINER_GRID_PAGE_SIZE + 1
    : 0;
  const examinerPageEnd = filteredAvailableExaminers.length
    ? Math.min(filteredAvailableExaminers.length, currentExaminerPage * EXAMINER_GRID_PAGE_SIZE)
    : 0;
  const pagedAvailableExaminers = filteredAvailableExaminers.slice(
    (currentExaminerPage - 1) * EXAMINER_GRID_PAGE_SIZE,
    currentExaminerPage * EXAMINER_GRID_PAGE_SIZE
  );
  // Disiapkan sebagai sumber data hasil keputusan AI pada integrasi berikutnya.
  const assignmentDecisionRows = assignmentRows;
  const assignmentDecisionByRegistrationId = new Map(
    assignmentDecisionRows.map((row) => [Number(row.pendaftaran_sidang_id), row])
  );
  const activeSidangMenuTab = periodePageMode === "availability"
    ? "data-ketersediaan"
    : periodePageMode === "registrants"
      ? "assign-penguji"
      : "periode-pendaftaran";
  const assignableRegistrantIds = filteredQueueRows
    .filter((row) => String(row?.status || "").toLowerCase() === "submitted")
    .map((row) => Number(row.id));
  const allAssignableRegistrantsSelected = assignableRegistrantIds.length > 0
    && assignableRegistrantIds.every((id) => selectedAssignmentRegistrantIds.includes(id));

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
      <section className="rounded-xl border border-[#e4e9f6] bg-white p-3 shadow-sm">
        <h3 className="text-lg font-black text-[#1b274b]">Menu Manajemen Sidang</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {SIDANG_TABS.map((tab) => (
            <button
              key={`sidang-tab-${tab.id}`}
              type="button"
              onClick={async () => {
                if (!(await confirmAndDiscardSetupDraft())) return;
                setActiveTab("periode-pendaftaran");
                setSelectedRegistrantId(null);
                setSelectedRegistrantDetail(null);
                setError("");
                setSuccess("");
                if (tab.id === "data-ketersediaan") {
                  const activeId = overview?.active_periode?.id || selectedPeriodeId;
                  if (activeId) setSelectedPeriodeId(String(activeId));
                  setQueueQuery("");
                  setExaminerQuery("");
                  setQueuePage(1);
                  setExaminerPage(1);
                  setPeriodePageMode("availability");
                  return;
                }
                if (tab.id === "assign-penguji") {
                  const activeId = overview?.active_periode?.id || selectedPeriodeId;
                  if (activeId) setSelectedPeriodeId(String(activeId));
                  setQueueQuery("");
                  setQueuePage(1);
                  setSelectedAssignmentRegistrantIds([]);
                  setPeriodePageMode("registrants");
                  return;
                }
                setPeriodePageMode("list");
              }}
              className={`rounded-full border px-3 py-1.5 text-sm font-bold ${
                activeSidangMenuTab === tab.id
                  ? "border-[#2f63e3] bg-[#2f63e3] text-white"
                  : "border-[#cfd8ef] bg-white text-[#2f4477]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {activeTab === "periode-pendaftaran" ? (
        <section className="rounded-xl border border-[#dce4f7] bg-white p-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                if (!(await confirmAndDiscardSetupDraft())) return;
                setPeriodePageMode(
                  "list"
                );
                setOpenPeriodeErrors({});
                setError("");
                setSuccess("");
              }}
              disabled={["list", "availability", "registrants"].includes(periodePageMode)}
              aria-label="Kembali ke daftar sebelumnya"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#d3dbef] text-[#27407b] transition hover:bg-[#f3f6ff] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={loadingOverview || loadingQueue}
              onClick={() => {
                loadOverview().catch(() => {});
                if (selectedPeriodeId) loadQueueByPeriode(Number(selectedPeriodeId)).catch(() => {});
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-[#d3dbef] px-3 py-2 text-sm font-semibold text-[#27407b] transition hover:bg-[#f3f6ff] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </button>
            {!["registrants", "availability"].includes(periodePageMode) ? (
              <button
                type="button"
                disabled={savingForm}
                onClick={async () => {
                  if (!(await confirmAndDiscardSetupDraft())) return;
                  setPeriodePageMode("open");
                  setOpenPeriodeErrors({});
                  setError("");
                  setSuccess("");
                }}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  periodePageMode === "open"
                    ? "bg-[#2f63e3] text-white"
                    : "border border-[#d3dbef] text-[#27407b] hover:bg-[#f3f6ff]"
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <CalendarRange className="h-4 w-4" />
                Buka Periode Baru
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {activeTab === "periode-pendaftaran" ? (
        <>
          {periodePageMode === "open" ? (
            <section className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
              <div>
                <h3 className="text-lg font-black text-[#1b274b]">Detail Periode Pendaftaran Sidang</h3>
                <p className="mt-1 text-sm text-[#66769a]">
                  Isi identitas periode dan rentang waktu pendaftaran. Setelah itu, lanjutkan dengan memilih hari dan ruangan sidang.
                </p>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="block text-sm font-semibold text-[#29385f]">
                  Tahun Akademik <span className="text-[#b73a3a]">*</span>
                  <select
                    value={openPeriodeForm.tahun_akademik}
                    onChange={(event) => {
                      setOpenPeriodeForm((prev) => ({ ...prev, tahun_akademik: event.target.value }));
                      setOpenPeriodeErrors((prev) => ({ ...prev, tahun_akademik: "" }));
                    }}
                    aria-invalid={Boolean(openPeriodeErrors.tahun_akademik)}
                    className={`${fieldClass(openPeriodeErrors.tahun_akademik)} bg-white`}
                  >
                    <option value="">Pilih tahun akademik</option>
                    {ACADEMIC_YEAR_OPTIONS.map((academicYear) => (
                      <option key={academicYear} value={academicYear}>{academicYear}</option>
                    ))}
                  </select>
                  <FieldError message={openPeriodeErrors.tahun_akademik} />
                </label>
                <label className="block text-sm font-semibold text-[#29385f]">
                  Semester <span className="text-[#b73a3a]">*</span>
                  <select
                    value={openPeriodeForm.semester}
                    onChange={(event) => {
                      setOpenPeriodeForm((prev) => ({ ...prev, semester: event.target.value }));
                      setOpenPeriodeErrors((prev) => ({ ...prev, semester: "" }));
                    }}
                    aria-invalid={Boolean(openPeriodeErrors.semester)}
                    className={`${fieldClass(openPeriodeErrors.semester)} bg-white`}
                  >
                    <option value="ganjil">Ganjil</option>
                    <option value="genap">Genap</option>
                  </select>
                  <FieldError message={openPeriodeErrors.semester} />
                </label>
                <label className="block text-sm font-semibold text-[#29385f] md:col-span-2">
                  Jenis Periode Sidang <span className="text-[#b73a3a]">*</span>
                  <select
                    value={openPeriodeForm.periode}
                    onChange={(event) => {
                      setOpenPeriodeForm((prev) => ({ ...prev, periode: event.target.value }));
                      setOpenPeriodeErrors((prev) => ({ ...prev, periode: "" }));
                    }}
                    aria-invalid={Boolean(openPeriodeErrors.periode)}
                    className={`${fieldClass(openPeriodeErrors.periode)} bg-white`}
                  >
                    <option value="uts">UTS</option>
                    <option value="uas">UAS</option>
                  </select>
                  <FieldError message={openPeriodeErrors.periode} />
                </label>
                <label className="block text-sm font-semibold text-[#29385f]">
                  Tanggal Mulai Pendaftaran <span className="text-[#b73a3a]">*</span>
                  <input
                    type="date"
                    value={openPeriodeForm.tanggal_mulai_pendaftaran}
                    onChange={(event) => {
                      setOpenPeriodeForm((prev) => ({ ...prev, tanggal_mulai_pendaftaran: event.target.value }));
                      setOpenPeriodeErrors((prev) => ({ ...prev, tanggal_mulai_pendaftaran: "", tanggal_selesai_pendaftaran: "" }));
                    }}
                    aria-invalid={Boolean(openPeriodeErrors.tanggal_mulai_pendaftaran)}
                    className={fieldClass(openPeriodeErrors.tanggal_mulai_pendaftaran)}
                  />
                  <FieldError message={openPeriodeErrors.tanggal_mulai_pendaftaran} />
                </label>
                <label className="block text-sm font-semibold text-[#29385f]">
                  Tanggal Selesai Pendaftaran <span className="text-[#b73a3a]">*</span>
                  <input
                    type="date"
                    value={openPeriodeForm.tanggal_selesai_pendaftaran}
                    min={openPeriodeForm.tanggal_mulai_pendaftaran || todayDateOnly}
                    onChange={(event) => {
                      setOpenPeriodeForm((prev) => ({ ...prev, tanggal_selesai_pendaftaran: event.target.value }));
                      setOpenPeriodeErrors((prev) => ({ ...prev, tanggal_selesai_pendaftaran: "" }));
                    }}
                    aria-invalid={Boolean(openPeriodeErrors.tanggal_selesai_pendaftaran)}
                    className={fieldClass(openPeriodeErrors.tanggal_selesai_pendaftaran)}
                  />
                  <FieldError message={openPeriodeErrors.tanggal_selesai_pendaftaran} />
                </label>
              </div>

              {overview?.active_periode ? (
                <div className="mt-4 rounded-lg border border-[#f2dfb3] bg-[#fff9e9] p-3 text-sm text-[#7a5a00]">
                  <p className="font-bold">Periode aktif saat ini</p>
                  <p className="mt-1">
                    {overview.active_periode.label_periode || formatPeriodeSidangLabel(overview.active_periode)} ({formatDateLabel(overview.active_periode.tanggal_mulai_pendaftaran)} s/d {formatDateLabel(overview.active_periode.tanggal_selesai_pendaftaran)}).
                  </p>
                </div>
              ) : null}

              <div className="mt-4 flex justify-end border-t border-[#e8edf8] pt-4">
                <button
                  type="button"
                  disabled={savingForm}
                  onClick={() => handleContinuePeriodeConfiguration().catch(() => {})}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#2f63e3] px-4 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <CalendarDays className="h-4 w-4" />
                  {savingForm ? "Memproses..." : "Lanjut Atur Hari & Ruangan"}
                </button>
              </div>
            </section>
          ) : null}

          {["list", "assignment-list", "availability", "registrants"].includes(periodePageMode) ? (
            <>
          {periodePageMode === "list" ? (
          <section className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="text-lg font-black text-[#1b274b]">Riwayat Periode Pendaftaran Sidang</h3>
                <p className="mt-1 text-sm text-[#66769a]">Pilih periode untuk melihat pendaftar atau memperbarui rentang pendaftaran.</p>
              </div>
              {loadingOverview ? <span className="text-sm text-[#6f7ea6]">Memuat...</span> : null}
            </div>
            <div className="relative shrink-0 overflow-auto rounded-lg border border-[#e6ecf8] bg-white grid-unified-height">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead>
                  <tr className="border-y border-[#e6ecf8] text-[#4d5e89]">
                    <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Label Periode</th>
                    <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Tahun Akademik</th>
                    <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Semester</th>
                    <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Rentang Pendaftaran</th>
                    <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Status</th>
                    <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {(overview?.periodes || []).map((item) => {
                    const isOpen = String(item.status || "").toLowerCase() === "open";
                    return (
                      <tr key={`periode-row-${item.id}`} className="border-b border-[#eff3fb]">
                        <td className="px-3 py-2 font-semibold text-[#1f2d53]">{item.label_periode || formatPeriodeSidangLabel(item)}</td>
                        <td className="px-3 py-2">{item.tahun_akademik || "-"}</td>
                        <td className="px-3 py-2 capitalize">{item.semester || "-"}</td>
                        <td className="px-3 py-2">{formatDateLabel(item.tanggal_mulai_pendaftaran)} s/d {formatDateLabel(item.tanggal_selesai_pendaftaran)}</td>
                        <td className="px-3 py-2">
                          <span className={`rounded-full px-2 py-1 text-xs font-bold ${isOpen ? "bg-[#e8f8ef] text-[#127947]" : "bg-[#eef2fb] text-[#58658d]"}`}>
                            {isOpen ? "Aktif" : "Nonaktif"}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPeriodeId(String(item.id));
                              setPeriodePageMode(isOpen ? "edit" : "detail");
                              setEditPeriodeErrors({});
                              setError("");
                              setSuccess("");
                            }}
                            className="inline-flex items-center gap-1 rounded-md bg-[#2f63e3] px-3 py-1.5 text-xs font-bold text-white transition hover:brightness-110"
                          >
                            {isOpen ? (
                              <>
                                <CalendarRange className="h-3.5 w-3.5" />
                                Edit
                              </>
                            ) : (
                              <>
                                <Eye className="h-3.5 w-3.5" />
                                Detail
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!loadingOverview && (overview?.periodes || []).length === 0 ? (
                <div className="flex min-h-[180px] items-center justify-center px-4 text-center text-sm font-semibold text-[#7b88ab]">
                  Belum ada periode pendaftaran sidang.
                </div>
              ) : null}
            </div>

          </section>
          ) : null}

          {periodePageMode === "assignment-list" ? (
            <section className="flex flex-col rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
              <div className="mb-3">
                <h3 className="text-lg font-black text-[#1b274b]">Daftar Periode Assign Dosen Penguji</h3>
                <p className="mt-1 text-sm text-[#66769a]">
                  Pilih periode aktif untuk melakukan assign atau buka detail periode nonaktif untuk melihat hasil penjadwalan.
                </p>
              </div>
              <div className="relative shrink-0 overflow-auto rounded-lg border border-[#e6ecf8] bg-white grid-unified-height">
                <table className="w-full min-w-[1050px] text-left text-sm">
                  <thead>
                    <tr className="border-y border-[#e6ecf8] text-[#4d5e89]">
                      <th className="bg-[#f8fbff] px-3 py-2 font-semibold">No</th>
                      <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Periode Sidang</th>
                      <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Hari Sidang</th>
                      <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Pendaftar</th>
                      <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Sudah Dijadwalkan</th>
                      <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Status</th>
                      <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(overview?.periodes || []).map((item, index) => {
                      const isOpen = String(item.status || "").toLowerCase() === "open";
                      return (
                        <tr key={`assignment-period-${item.id}`} className="border-b border-[#eff3fb]">
                          <td className="px-3 py-2 font-semibold text-[#254080]">{index + 1}</td>
                          <td className="px-3 py-2">
                            <p className="font-semibold text-[#1f2d53]">{item.label_periode || formatPeriodeSidangLabel(item)}</p>
                            <p className="text-xs text-[#61709b]">
                              {formatDateLabel(item.tanggal_mulai_pendaftaran)} s/d {formatDateLabel(item.tanggal_selesai_pendaftaran)}
                            </p>
                          </td>
                          <td className="px-3 py-2">{Array.isArray(item.hari_sidang) ? item.hari_sidang.length : 0} hari</td>
                          <td className="px-3 py-2">{Number(item?.stats?.total_pendaftaran || 0)} mahasiswa</td>
                          <td className="px-3 py-2">{Number(item?.stats?.scheduled || 0)} mahasiswa</td>
                          <td className="px-3 py-2">
                            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${isOpen ? "bg-[#e8f8ef] text-[#127947]" : "bg-[#eef2fb] text-[#58658d]"}`}>
                              {isOpen ? "Aktif" : "Nonaktif"}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPeriodeId(String(item.id));
                                setQueueQuery("");
                                setQueuePage(1);
                                setSelectedRegistrantId(null);
                                setSelectedRegistrantDetail(null);
                                setPeriodePageMode("registrants");
                              }}
                              className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-bold text-white transition hover:brightness-110 ${isOpen ? "bg-[#137748]" : "bg-[#2f63e3]"}`}
                            >
                              {isOpen ? "Assign" : <><Eye className="h-3.5 w-3.5" /> Detail</>}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {!loadingOverview && (overview?.periodes || []).length === 0 ? (
                  <div className="flex min-h-[180px] items-center justify-center px-4 text-center text-sm font-semibold text-[#7b88ab]">
                    Belum ada periode sidang.
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          {["availability", "registrants"].includes(periodePageMode) ? (
          <section className="flex flex-col rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-lg font-black text-[#1b274b]">
                  {periodePageMode === "availability" ? "Data Ketersediaan Sidang" : "Assign Dosen Penguji"}
                </h3>
                <p className="mt-1 text-sm text-[#66769a]">
                  {selectedPeriode?.label_periode || formatPeriodeSidangLabel(selectedPeriode)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={selectedPeriodeId}
                  onChange={(event) => setSelectedPeriodeId(event.target.value)}
                  aria-label="Filter periode sidang"
                  className="w-[280px] rounded-lg border border-[#d1daf0] bg-white px-3 py-2 text-sm outline-none focus:border-[#2f63e3]"
                >
                  {(overview?.periodes || []).map((item) => (
                    <option key={`filter-period-${item.id}`} value={item.id}>
                      {item.label_periode || formatPeriodeSidangLabel(item)}{String(item.status || "").toLowerCase() === "open" ? " (Aktif)" : ""}
                    </option>
                  ))}
                </select>
                <div className="relative flex items-center gap-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7890bd]" />
                    <input
                      type="text"
                      value={queueQuery}
                      onChange={(event) => {
                        setQueueQuery(event.target.value);
                        setQueuePage(1);
                      }}
                      placeholder="Cari NIM atau nama mahasiswa..."
                      className="w-[300px] rounded-lg border border-[#d1daf0] py-2 pl-9 pr-3 text-sm outline-none focus:border-[#2f63e3]"
                    />
                  </div>
                  {periodePageMode === "registrants" ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setShowAssignmentFilters((current) => !current)}
                        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition ${showAssignmentFilters ? "border-[#2f63e3] bg-[#eef3ff] text-[#234ca7]" : "border-[#d1daf0] bg-white text-[#263f78] hover:bg-[#f7f9ff]"}`}
                        aria-expanded={showAssignmentFilters}
                      >
                        <SlidersHorizontal className="h-4 w-4" /> Filter
                      </button>
                      {showAssignmentFilters ? (
                        <div className="absolute right-0 top-[calc(100%+8px)] z-30 w-[620px] max-w-[calc(100vw-48px)] rounded-xl border border-[#dce4f5] bg-white p-4 shadow-xl">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <p className="font-bold text-[#203666]">Filter Penugasan Dosen Penguji</p>
                            <button type="button" onClick={() => setShowAssignmentFilters(false)} aria-label="Tutup filter" className="rounded-md p-1 text-[#61739d] hover:bg-[#f0f4fd]"><X className="h-4 w-4" /></button>
                          </div>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            {[
                              ["penguji1", "Dosen Penguji 1", assignmentFilterOptions.penguji1],
                              ["penguji2", "Dosen Penguji 2", assignmentFilterOptions.penguji2],
                              ["tanggal_sidang", "Hari Sidang", assignmentFilterOptions.tanggal_sidang],
                              ["sesi_ke", "Sesi", assignmentFilterOptions.sesi_ke],
                              ["ruangan", "Ruangan", assignmentFilterOptions.ruangan],
                            ].map(([key, label, options]) => (
                              <label key={key} className="text-sm font-semibold text-[#314778]">
                                {label}
                                <select
                                  value={assignmentFilters[key]}
                                  onChange={(event) => {
                                    setAssignmentFilters((current) => ({ ...current, [key]: event.target.value }));
                                    setQueuePage(1);
                                  }}
                                  className="mt-1 w-full rounded-lg border border-[#d1daf0] bg-white px-3 py-2 text-sm font-normal text-[#263b6f] outline-none focus:border-[#2f63e3]"
                                >
                                  <option value="">Semua {label}</option>
                                  {options.map((option) => (
                                    <option key={`${key}-${option}`} value={option}>
                                      {key === "tanggal_sidang" ? formatDateLabel(option) : key === "sesi_ke" ? `Sesi ${option}` : option}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            ))}
                          </div>
                          <div className="mt-4 flex justify-end gap-2 border-t border-[#e8edf8] pt-3">
                            <button
                              type="button"
                              onClick={() => {
                                setAssignmentFilters({ penguji1: "", penguji2: "", tanggal_sidang: "", sesi_ke: "", ruangan: "" });
                                setQueuePage(1);
                              }}
                              className="rounded-lg border border-[#d1daf0] bg-white px-3 py-2 text-sm font-semibold text-[#314778] hover:bg-[#f7f9ff]"
                            >
                              Reset
                            </button>
                            <button type="button" onClick={() => setShowAssignmentFilters(false)} className="rounded-lg bg-[#2f63e3] px-4 py-2 text-sm font-bold text-white hover:brightness-110">Terapkan</button>
                          </div>
                        </div>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </div>
            </div>

            {periodePageMode === "availability" ? (
            <>
            <div className="mb-4 rounded-xl border border-[#dce5f7] bg-[#f8fbff] p-4">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="font-black text-[#1f2d53]">Hari Sidang yang Dibuka</h4>
                  <span className="rounded-full bg-[#e8eefc] px-2.5 py-1 text-xs font-bold text-[#315196]">
                    {queueContext.hari_sidang.length} hari
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {queueContext.hari_sidang.length ? queueContext.hari_sidang.map((item) => (
                    <span key={`assignment-date-${item.tanggal_sidang}`} className="rounded-full border border-[#cbd9f5] bg-white px-3 py-1.5 text-xs font-bold text-[#294a91]">
                      {formatDateLabel(item.tanggal_sidang)} · {Array.isArray(item.sesi) ? item.sesi.length : 0} sesi
                    </span>
                  )) : <p className="text-sm text-[#7482a5]">Belum ada hari sidang yang dikonfigurasi.</p>}
                </div>
            </div>

            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <h4 className="font-black text-[#1f2d53]">Dosen Bersedia Menjadi Penguji</h4>
                <p className="mt-1 text-sm text-[#66769a]">Data dosen yang telah mengisi ketersediaan pada periode ini.</p>
              </div>
              <input
                type="text"
                value={examinerQuery}
                onChange={(event) => {
                  setExaminerQuery(event.target.value);
                  setExaminerPage(1);
                }}
                placeholder="Cari NIK atau nama dosen..."
                className="w-[300px] rounded-lg border border-[#d1daf0] px-3 py-2 text-sm outline-none focus:border-[#2f63e3]"
              />
            </div>

            <div className="relative h-[286px] overflow-auto rounded-lg border border-[#e6ecf8]">
              <table className="w-full min-w-[1050px] text-left text-sm">
                <thead><tr className="border-y border-[#e6ecf8] text-[#4d5e89]"><th className="sticky top-0 bg-[#f8fbff] px-3 py-2 font-semibold">No</th><th className="sticky top-0 bg-[#f8fbff] px-3 py-2 font-semibold">Dosen</th><th className="sticky top-0 bg-[#f8fbff] px-3 py-2 font-semibold">Hari Tersedia</th><th className="sticky top-0 bg-[#f8fbff] px-3 py-2 font-semibold">Slot Tersedia</th><th className="sticky top-0 bg-[#f8fbff] px-3 py-2 font-semibold">Mobilitas Ruangan</th><th className="sticky top-0 bg-[#f8fbff] px-3 py-2 font-semibold">Maksimal Sesi</th><th className="sticky top-0 bg-[#f8fbff] px-3 py-2 font-semibold">Kebutuhan Jeda</th><th className="sticky top-0 bg-[#f8fbff] px-3 py-2 font-semibold">Aksi</th></tr></thead>
                <tbody>{pagedAvailableExaminers.map((dosen, index) => <tr key={`available-examiner-${dosen.id}`} className="border-b border-[#eff3fb]"><td className="px-3 py-3 font-semibold text-[#254080]">{examinerPageStart + index}</td><td className="px-3 py-3"><p className="font-semibold text-[#1f2d53]">{formatDosenFullName(dosen.nama, dosen.gelar) || "-"}</p><p className="text-xs text-[#61709b]">{dosen.nik || dosen.kode_dosen || dosen.email || "-"}</p></td><td className="px-3 py-3">{dosen.tanggal_tersedia?.length || 0} hari</td><td className="px-3 py-3">{dosen.jumlah_slot_tersedia || 0} slot</td><td className="px-3 py-3">{dosen.preferensi?.mobilitas_ruangan === "satu_ruangan" ? "Satu ruangan" : "Dapat berpindah"}</td><td className="px-3 py-3">{dosen.preferensi?.maksimal_sesi_per_hari || "-"} sesi/hari</td><td className="px-3 py-3">{dosen.preferensi?.membutuhkan_jeda ? "Memerlukan jeda" : "Tanpa jeda"}</td><td className="px-3 py-3"><button type="button" onClick={() => setSelectedAvailableDosen(dosen)} className="inline-flex items-center gap-1 rounded-md bg-[#2f63e3] px-3 py-1.5 text-xs font-bold text-white transition hover:brightness-110"><Eye className="h-3.5 w-3.5" />Detail</button></td></tr>)}</tbody>
              </table>
              {!loadingQueue && filteredAvailableExaminers.length === 0 ? <div className="absolute inset-x-0 bottom-0 top-[41px] flex items-center justify-center px-4 text-center text-sm font-semibold text-[#7b88ab]">Belum ada dosen yang sesuai dengan pencarian.</div> : null}
            </div>

            <div className="mb-5 mt-3 flex flex-wrap items-center justify-between gap-3 border-b border-[#e8edf8] pb-5">
              <p className="text-sm text-[#4f5e86]">Menampilkan {examinerPageStart} - {examinerPageEnd} dari {filteredAvailableExaminers.length} data dosen.</p>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setExaminerPage((prev) => Math.max(1, prev - 1))} disabled={currentExaminerPage === 1} className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] transition hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:opacity-50">Sebelumnya</button>
                <span className="text-sm font-semibold text-[#314778]">Halaman {currentExaminerPage} / {examinerTotalPages}</span>
                <button type="button" onClick={() => setExaminerPage((prev) => Math.min(examinerTotalPages, prev + 1))} disabled={currentExaminerPage >= examinerTotalPages} className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] transition hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:opacity-50">Berikutnya</button>
              </div>
            </div>
            </>
            ) : null}

            {periodePageMode === "availability" ? (
            <>
            <div className="mb-2">
              <h4 className="font-black text-[#1f2d53]">Mahasiswa Pendaftar Sidang</h4>
              <p className="mt-1 text-sm text-[#66769a]">Data mahasiswa yang mendaftar pada periode ini beserta status penjadwalannya.</p>
            </div>

            <div className="relative shrink-0 overflow-auto rounded-lg border border-[#e6ecf8] grid-unified-height">
              <table className="w-full min-w-[1400px] text-left text-sm">
                <thead>
                  <tr className="border-y border-[#e6ecf8] text-[#4d5e89]">
                    {periodePageMode === "registrants" ? (
                      <th className="bg-[#f8fbff] px-3 py-2 text-center font-semibold">
                        <input
                          type="checkbox"
                          checked={allAssignableRegistrantsSelected}
                          disabled={assignableRegistrantIds.length === 0}
                          onChange={(event) => {
                            setSelectedAssignmentRegistrantIds(event.target.checked ? assignableRegistrantIds : []);
                            setAssignmentRows([]);
                            setAssignmentCommitted(false);
                          }}
                          aria-label="Pilih semua mahasiswa yang belum dijadwalkan"
                          className="h-4 w-4 accent-[#2f63e3]"
                        />
                      </th>
                    ) : null}
                    <th className="bg-[#f8fbff] px-3 py-2 font-semibold">No</th>
                    <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Mahasiswa</th>
                    <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Judul Skripsi</th>
                    <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Semester Penjaluran</th>
                    <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Status Pendaftaran</th>
                    <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Jadwal & Dosen Penguji</th>
                    <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Tanggal Daftar</th>
                    <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedRows.map((row, index) => (
                    <tr key={`queue-row-${row.id}`} className="border-b border-[#eff3fb]">
                      {periodePageMode === "registrants" ? (
                        <td className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={selectedAssignmentRegistrantIds.includes(Number(row.id))}
                            disabled={String(row?.status || "").toLowerCase() !== "submitted"}
                            onChange={(event) => {
                              const registrationId = Number(row.id);
                              setSelectedAssignmentRegistrantIds((current) => event.target.checked
                                ? Array.from(new Set([...current, registrationId]))
                                : current.filter((id) => id !== registrationId));
                              setAssignmentRows([]);
                              setAssignmentCommitted(false);
                            }}
                            aria-label={`Pilih ${row?.mahasiswa?.nama || "mahasiswa"}`}
                            className="h-4 w-4 accent-[#2f63e3]"
                          />
                        </td>
                      ) : null}
                      <td className="px-3 py-2 font-semibold text-[#254080]">{pageStart + index}</td>
                      <td className="px-3 py-2">
                        <p className="font-semibold text-[#1f2d53]">
                          {row?.mahasiswa?.nama || "-"} ({row?.mahasiswa?.nim || "-"})
                        </p>
                        <p className="text-xs text-[#61709b]">Angkatan {row?.mahasiswa?.angkatan || "-"}</p>
                      </td>
                      <td className="px-3 py-2">{row?.judul_skripsi || "-"}</td>
                      <td className="px-3 py-2">
                        {row?.semester_penjaluran ? `Semester ${row.semester_penjaluran}` : "-"}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusPendaftaranBadge(
                            row?.status
                          )}`}
                        >
                          {row?.status || "-"}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {row?.jadwal_sidang ? (
                          <div className="min-w-[260px] text-xs text-[#53658f]">
                            <p className="font-bold text-[#263a66]">
                              {formatDateLabel(row.jadwal_sidang.tanggal_sidang)} · {row.jadwal_sidang.sesi_mulai || "-"}–{row.jadwal_sidang.sesi_selesai || "-"}
                            </p>
                            <p>{row.jadwal_sidang.ruangan || "-"}</p>
                            <p className="mt-1">Penguji 1: {formatDosenFullName(row.jadwal_sidang.penguji1?.nama, row.jadwal_sidang.penguji1?.gelar) || "-"}</p>
                            <p>Penguji 2: {formatDosenFullName(row.jadwal_sidang.penguji2?.nama, row.jadwal_sidang.penguji2?.gelar) || "-"}</p>
                          </div>
                        ) : <span className="text-xs text-[#8793af]">Belum di-assign</span>}
                      </td>
                      <td className="px-3 py-2">{formatDateTime(row?.registered_at)}</td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedRegistrantId(row.id);
                            loadRegistrantDetail(row.id).catch(() => {});
                          }}
                          className="inline-flex items-center gap-1 rounded-md bg-[#2f63e3] px-3 py-1.5 text-xs font-bold text-white transition hover:brightness-110"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Detail
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {loadingQueue ? (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[41px] flex items-center justify-center px-4 text-center text-sm font-semibold text-[#7b88ab]">
                  Memuat data pendaftar sidang...
                </div>
              ) : null}
              {!loadingQueue && filteredQueueRows.length === 0 ? (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[41px] flex items-center justify-center px-4 text-center text-sm font-semibold text-[#7b88ab]">
                  Belum ada mahasiswa yang mendaftar sidang di periode ini.
                </div>
              ) : null}
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[#e8edf8] pt-3">
              <p className="text-sm text-[#4f5e86]">
                Menampilkan {pageStart} - {pageEnd} dari {filteredQueueRows.length} data pendaftar sidang.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQueuePage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] transition hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Sebelumnya
                </button>
                <span className="text-sm font-semibold text-[#314778]">
                  Halaman {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setQueuePage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage >= totalPages}
                  className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] transition hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Berikutnya
                </button>
              </div>
            </div>
            </>
            ) : null}

            {periodePageMode === "registrants" ? (
            <div className="mt-3">
              <div className="mb-3 flex flex-wrap items-center justify-end gap-3">
                {String(selectedPeriode?.status || "").toLowerCase() === "open" ? (
                  <button
                    type="button"
                    onClick={() => runExaminerAssignment({ commit: false })}
                    disabled={selectedAssignmentRegistrantIds.length === 0 || assigningExaminers || savingAssignments}
                    className="rounded-lg bg-[#137748] px-4 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {assigningExaminers ? "Memproses Rekomendasi..." : `Assign Otomatis dengan AI (${selectedAssignmentRegistrantIds.length})`}
                  </button>
                ) : null}
              </div>

              <div className="relative h-[300px] overflow-auto rounded-lg border border-[#e6ecf8]">
                <table className="w-full min-w-[1250px] text-left text-sm">
                  <thead>
                    <tr className="border-y border-[#e6ecf8] text-[#4d5e89]">
                      <th className="sticky top-0 bg-[#f8fbff] px-3 py-2 text-center font-semibold">
                        <input
                          type="checkbox"
                          checked={allAssignableRegistrantsSelected}
                          disabled={assignableRegistrantIds.length === 0}
                          onChange={(event) => {
                            setSelectedAssignmentRegistrantIds(event.target.checked ? assignableRegistrantIds : []);
                            setAssignmentRows([]);
                            setAssignmentCommitted(false);
                          }}
                          aria-label="Pilih semua mahasiswa yang belum dijadwalkan"
                          className="h-4 w-4 accent-[#2f63e3]"
                        />
                      </th>
                      <th className="sticky top-0 bg-[#f8fbff] px-3 py-2 font-semibold">No</th>
                      <th className="sticky top-0 bg-[#f8fbff] px-3 py-2 font-semibold">Mahasiswa</th>
                      <th className="sticky top-0 bg-[#f8fbff] px-3 py-2 font-semibold">Dosen Penguji 1</th>
                      <th className="sticky top-0 bg-[#f8fbff] px-3 py-2 font-semibold">Dosen Penguji 2</th>
                      <th className="sticky top-0 bg-[#f8fbff] px-3 py-2 font-semibold">Hari Sidang</th>
                      <th className="sticky top-0 bg-[#f8fbff] px-3 py-2 font-semibold">Sesi</th>
                      <th className="sticky top-0 bg-[#f8fbff] px-3 py-2 font-semibold">Ruangan</th>
                      <th className="sticky top-0 bg-[#f8fbff] px-3 py-2 font-semibold">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedRows.map((registration, index) => {
                      const row = assignmentDecisionByRegistrationId.get(Number(registration.id));
                      const existingSchedule = registration?.jadwal_sidang;
                      return (
                      <tr key={`assignment-registration-${registration.id}`} className="border-b border-[#eff3fb]">
                        <td className="px-3 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={selectedAssignmentRegistrantIds.includes(Number(registration.id))}
                            disabled={String(registration?.status || "").toLowerCase() !== "submitted"}
                            onChange={(event) => {
                              const registrationId = Number(registration.id);
                              setSelectedAssignmentRegistrantIds((current) => event.target.checked
                                ? Array.from(new Set([...current, registrationId]))
                                : current.filter((id) => id !== registrationId));
                              setAssignmentRows([]);
                              setAssignmentCommitted(false);
                            }}
                            aria-label={`Pilih ${registration?.mahasiswa?.nama || "mahasiswa"}`}
                            className="h-4 w-4 accent-[#2f63e3]"
                          />
                        </td>
                        <td className="px-3 py-3 font-semibold text-[#254080]">{pageStart + index}</td>
                        <td className="px-3 py-3">
                          <p className="font-bold text-[#253b6c]">{registration?.mahasiswa?.nama || "-"}</p>
                          <p className="text-xs text-[#7582a2]">{registration?.mahasiswa?.nim || "-"}</p>
                        </td>
                        <td className="px-3 py-3">{formatDosenFullName(row?.penguji1?.nama || existingSchedule?.penguji1?.nama, row?.penguji1?.gelar || existingSchedule?.penguji1?.gelar) || "-"}</td>
                        <td className="px-3 py-3">{formatDosenFullName(row?.penguji2?.nama || existingSchedule?.penguji2?.nama, row?.penguji2?.gelar || existingSchedule?.penguji2?.gelar) || "-"}</td>
                        <td className="px-3 py-3">{formatDateLabel(row?.tanggal_sidang || existingSchedule?.tanggal_sidang)}</td>
                        <td className="px-3 py-3">{row?.sesi_ke ? `Sesi ${row.sesi_ke}` : existingSchedule?.sesi_ke ? `Sesi ${existingSchedule.sesi_ke}` : "-"}</td>
                        <td className="px-3 py-3">{row?.ruangan || existingSchedule?.ruangan || "-"}</td>
                        <td className="px-3 py-3">
                          {row ? (
                            <button
                              type="button"
                              onClick={() => setEditingAssignment(row)}
                              disabled={assignmentCommitted}
                              className="inline-flex items-center gap-1 rounded-md bg-[#2f63e3] px-3 py-1.5 text-xs font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Pencil className="h-3.5 w-3.5" /> Edit
                            </button>
                          ) : <span className="text-xs text-[#8793af]">-</span>}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
                {!loadingQueue && filteredQueueRows.length === 0 ? (
                  <div className="absolute inset-x-0 bottom-0 top-[41px] flex items-center justify-center px-4 text-center text-sm font-semibold text-[#7b88ab]">
                    Belum ada mahasiswa yang mendaftar sidang di periode ini.
                  </div>
                ) : null}
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[#e8edf8] pt-3">
                <p className="text-sm text-[#4f5e86]">Menampilkan {pageStart} - {pageEnd} dari {filteredQueueRows.length} data pendaftar sidang.</p>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setQueuePage((prev) => Math.max(1, prev - 1))} disabled={currentPage === 1} className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] disabled:opacity-50">Sebelumnya</button>
                  <span className="text-sm font-semibold text-[#314778]">Halaman {currentPage} / {totalPages}</span>
                  <button type="button" onClick={() => setQueuePage((prev) => Math.min(totalPages, prev + 1))} disabled={currentPage >= totalPages} className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] disabled:opacity-50">Berikutnya</button>
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => runExaminerAssignment({ commit: true })}
                  disabled={assignmentDecisionRows.length === 0 || assignmentCommitted || assigningExaminers || savingAssignments}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#2f63e3] px-4 py-2 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Save className="h-4 w-4" /> {savingAssignments ? "Menyimpan..." : assignmentCommitted ? "Hasil Tersimpan" : "Simpan Hasil Penugasan"}
                </button>
              </div>
            </div>
            ) : null}
          </section>
          ) : null}

            </>
          ) : null}

          {selectedPeriode && (periodePageMode === "edit" || periodePageMode === "detail") ? (
            <section className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
              <h3 className="text-lg font-black text-[#1b274b]">
                {periodePageMode === "edit" ? "Edit Periode Pendaftaran Sidang" : "Detail Periode Pendaftaran Sidang"}
              </h3>
              <p className="mt-1 text-sm text-[#66769a]">
                {periodePageMode === "edit"
                  ? "Periode sedang aktif. Tanggal selesai pendaftaran, hari sidang, dan ruangan dapat diperbarui."
                  : "Periode sudah tidak aktif. Data hanya dapat dilihat dan tidak dapat diubah."}
              </p>

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="text-sm font-semibold text-[#29385f]">
                  Label Periode
                  <input
                    type="text"
                    value={selectedPeriode.label_periode || formatPeriodeSidangLabel(selectedPeriode)}
                    disabled
                    className="mt-1 w-full rounded-lg border border-[#d3dbef] bg-[#f7f9ff] px-3 py-2 text-sm text-[#4f5d85]"
                  />
                </label>
                <label className="text-sm font-semibold text-[#29385f]">
                  Status
                  <input
                    type="text"
                    value={periodePageMode === "edit" ? "Aktif" : "Nonaktif"}
                    disabled
                    className="mt-1 w-full rounded-lg border border-[#d3dbef] bg-[#f7f9ff] px-3 py-2 text-sm text-[#4f5d85]"
                  />
                </label>
                <label className="text-sm font-semibold text-[#29385f]">
                  Tahun Akademik
                  <input
                    type="text"
                    value={selectedPeriode.tahun_akademik || "-"}
                    disabled
                    className="mt-1 w-full rounded-lg border border-[#d3dbef] bg-[#f7f9ff] px-3 py-2 text-sm text-[#4f5d85]"
                  />
                </label>
                <label className="text-sm font-semibold text-[#29385f]">
                  Semester
                  <input
                    type="text"
                    value={String(selectedPeriode.semester || "-").replace(/^./, (char) => char.toUpperCase())}
                    disabled
                    className="mt-1 w-full rounded-lg border border-[#d3dbef] bg-[#f7f9ff] px-3 py-2 text-sm text-[#4f5d85]"
                  />
                </label>
                <label className="text-sm font-semibold text-[#29385f]">
                  Tanggal Mulai Pendaftaran
                  <input
                    type="date"
                    value={String(selectedPeriode.tanggal_mulai_pendaftaran || "").slice(0, 10)}
                    disabled
                    className="mt-1 w-full rounded-lg border border-[#d3dbef] bg-[#f7f9ff] px-3 py-2 text-sm text-[#4f5d85]"
                  />
                </label>
                <label className="text-sm font-semibold text-[#29385f]">
                  Tanggal Selesai Pendaftaran {periodePageMode === "edit" ? <span className="text-[#b73a3a]">*</span> : null}
                  <input
                    type="date"
                    value={editPeriodeForm.tanggal_selesai_pendaftaran}
                    min={String(selectedPeriode.tanggal_mulai_pendaftaran || "").slice(0, 10)}
                    disabled={periodePageMode !== "edit"}
                    onChange={(event) => {
                      setEditPeriodeForm((prev) => ({ ...prev, tanggal_selesai_pendaftaran: event.target.value }));
                      setEditPeriodeErrors((prev) => ({ ...prev, tanggal_selesai_pendaftaran: "" }));
                    }}
                    aria-invalid={Boolean(editPeriodeErrors.tanggal_selesai_pendaftaran)}
                    className={
                      periodePageMode === "edit"
                        ? fieldClass(editPeriodeErrors.tanggal_selesai_pendaftaran)
                        : "mt-1 w-full rounded-lg border border-[#d3dbef] bg-[#f7f9ff] px-3 py-2 text-sm text-[#4f5d85]"
                    }
                  />
                  {periodePageMode === "edit" ? <FieldError message={editPeriodeErrors.tanggal_selesai_pendaftaran} /> : null}
                </label>
              </div>

              {periodePageMode === "edit" ? (
                <div className="mt-5 border-t border-[#e8edf8] pt-5">
                  <div>
                    <h4 className="text-base font-black text-[#1b274b]">Pengaturan Hari & Ruangan Sidang</h4>
                    <p className="mt-1 text-sm text-[#66769a]">Perbarui hari pelaksanaan dan ruangan yang tersedia untuk periode ini.</p>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="rounded-lg border border-[#e2e9f8] bg-[#f8fbff] p-3">
                      <p className="text-sm font-bold text-[#233a74]">Hari Sidang <span className="text-[#b73a3a]">*</span></p>
                      <p className="mt-1 text-xs text-[#68779b]">Pilih beberapa tanggal dari kalender; tanggal tidak harus berurutan.</p>
                      <button
                        type="button"
                        onClick={() => setCalendarOpen(true)}
                        className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[#9db5ed] bg-[#eef3ff] px-4 py-2.5 text-sm font-bold text-[#244a9f] transition hover:border-[#2f63e3] hover:bg-[#e4edff]"
                      >
                        <CalendarDays className="h-4 w-4" />
                        Buka Kalender Tanggal Sidang
                      </button>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(editPeriodeForm.tanggal_sidang_list || []).map((tanggal) => (
                          <button
                            key={`edit-active-tanggal-${tanggal}`}
                            type="button"
                            onClick={() => handleRemoveSidangDate(tanggal)}
                            className="rounded-full border border-[#c9d7f5] bg-white px-3 py-1 text-xs font-semibold text-[#2c4ca0]"
                          >
                            {formatDateLabel(tanggal)} <X className="ml-1 inline h-3 w-3" />
                          </button>
                        ))}
                      </div>
                      {(editPeriodeForm.tanggal_sidang_list || []).length === 0 ? (
                        <p className="mt-2 text-xs font-semibold text-[#8a6a20]">Belum ada tanggal sidang yang dipilih.</p>
                      ) : null}
                      <FieldError message={editPeriodeErrors.tanggal_sidang_list} />
                    </div>

                    <div className="rounded-lg border border-[#e2e9f8] bg-[#f8fbff] p-3">
                      <p className="text-sm font-bold text-[#233a74]">Ruangan Sidang <span className="text-[#b73a3a]">*</span></p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <select
                          value={editRoomInput}
                          onChange={(event) => {
                            setEditRoomInput(event.target.value);
                            setEditRoomError("");
                          }}
                          aria-invalid={Boolean(editRoomError)}
                          aria-label="Pilih ruangan sidang"
                          className={`min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm outline-none ${editRoomError ? "border-[#dc4c4c] bg-[#fffafa] focus:border-[#c73737]" : "border-[#d1daf0] bg-white focus:border-[#2f63e3]"}`}
                        >
                          <option value="">Pilih ruangan sidang</option>
                          {SIDANG_ROOM_OPTIONS.map((room) => (
                            <option key={room} value={room}>{room}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={addEditRoom}
                          className="rounded-lg border border-[#d1daf0] bg-white px-3 py-2 text-sm font-semibold text-[#27407b] transition hover:bg-[#f3f6ff]"
                        >
                          Tambah Ruangan
                        </button>
                      </div>
                      <FieldError message={editRoomError} />
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(editPeriodeForm.ruangan_list || []).map((ruangan) => (
                          <button
                            key={`edit-active-ruangan-${ruangan}`}
                            type="button"
                            onClick={() => setEditPeriodeForm((prev) => ({
                              ...prev,
                              ruangan_list: (prev.ruangan_list || []).filter((item) => item !== ruangan),
                            }))}
                            className="rounded-full border border-[#c9d7f5] bg-white px-3 py-1 text-xs font-semibold text-[#2c4ca0]"
                          >
                            {ruangan} <X className="ml-1 inline h-3 w-3" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-[#e8edf8] pt-4">
                    <button
                      type="button"
                      disabled={savingForm}
                      onClick={() => handleSaveSelectedPeriode().catch(() => {})}
                      className="inline-flex items-center gap-2 rounded-lg bg-[#2f63e3] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Save className="h-4 w-4" />
                      {savingForm ? "Menyimpan..." : "Simpan Perubahan"}
                    </button>
                    <button
                      type="button"
                      disabled={savingForm}
                      onClick={() => handleCloseSelectedPeriode().catch(() => {})}
                      className="rounded-lg bg-[#b73a3a] px-4 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Tutup Periode
                    </button>
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}
        </>
      ) : null}

      {activeTab === "periode-pendaftaran" && periodePageMode === "configure" ? (
        <>
          <section className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-black text-[#1b274b]">Pengaturan Hari & Ruangan Sidang</h3>
              <button
                type="button"
                onClick={() => {
                  loadOverview().catch(() => {});
                  if (selectedPeriodeId) {
                    loadQueueByPeriode(Number(selectedPeriodeId)).catch(() => {});
                  }
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-[#d3dbef] px-3 py-2 text-sm font-semibold text-[#27407b] transition hover:bg-[#f3f6ff]"
              >
                <RefreshCcw className="h-4 w-4" />
                Refresh
              </button>
            </div>

            {(overview?.periodes || []).length === 0 ? (
              <div className="mt-3 rounded-lg border border-[#f2dfb3] bg-[#fff9e9] p-3 text-sm text-[#7a5a00]">
                <p className="font-bold">Belum ada periode sidang</p>
                <p className="mt-1">
                  Kalender hari sidang dan pemilihan ruangan akan tampil setelah Anda membuat periode terlebih dahulu.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab("periode-pendaftaran")}
                  className="mt-2 inline-flex items-center rounded-lg bg-[#2f63e3] px-3 py-2 text-sm font-bold text-white transition hover:brightness-110"
                >
                  Buka Tab Periode Pendaftaran Sidang
                </button>
              </div>
            ) : null}

            {selectedPeriode ? (
              <div className="mt-3 space-y-3 rounded-lg border border-[#e5ebf8] bg-[#f8fbff] p-3">
                <div className="rounded-lg border border-[#e2e9f8] bg-white p-3 text-sm text-[#4a5f93]">
                  <p className="font-bold text-[#1f2d53]">Periode Aktif Konfigurasi</p>
                  <p className="mt-1">{selectedPeriode.label_periode || formatPeriodeSidangLabel(selectedPeriode)}</p>
                  <p>
                    Rentang pendaftaran: {formatDateLabel(selectedPeriode.tanggal_mulai_pendaftaran)} s/d{" "}
                    {formatDateLabel(selectedPeriode.tanggal_selesai_pendaftaran)}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-[#e2e9f8] bg-white p-3">
                    <p className="text-sm font-bold text-[#233a74]">Hari Sidang (pilih dari kalender)</p>
                    <p className="mt-1 text-xs text-[#68779b]">Pilih beberapa tanggal khusus; tanggal tidak harus berurutan.</p>
                    <button
                      type="button"
                      onClick={() => setCalendarOpen(true)}
                      className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[#9db5ed] bg-[#eef3ff] px-4 py-2.5 text-sm font-bold text-[#244a9f] transition hover:border-[#2f63e3] hover:bg-[#e4edff]"
                    >
                      <CalendarDays className="h-4 w-4" />
                      Buka Kalender Tanggal Sidang
                    </button>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(editPeriodeForm.tanggal_sidang_list || []).map((tanggal) => (
                        <button
                          key={`edit-tanggal-${tanggal}`}
                          type="button"
                          onClick={() =>
                            setEditPeriodeForm((prev) => ({
                              ...prev,
                              tanggal_sidang_list: (prev.tanggal_sidang_list || []).filter(
                                (item) => item !== tanggal
                              ),
                            }))
                          }
                          className="rounded-full border border-[#c9d7f5] bg-white px-3 py-1 text-xs font-semibold text-[#2c4ca0]"
                        >
                          {formatDateLabel(tanggal)} <X className="ml-1 inline h-3 w-3" />
                        </button>
                      ))}
                    </div>
                    {(editPeriodeForm.tanggal_sidang_list || []).length === 0 ? <p className="mt-2 text-xs font-semibold text-[#8a6a20]">Belum ada tanggal sidang yang dipilih.</p> : null}
                  </div>

                  <div className="rounded-lg border border-[#e2e9f8] bg-white p-3">
                    <p className="text-sm font-bold text-[#233a74]">Ruangan Sidang</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <select
                        value={editRoomInput}
                        onChange={(event) => {
                          setEditRoomInput(event.target.value);
                          setEditRoomError("");
                        }}
                        aria-invalid={Boolean(editRoomError)}
                        aria-label="Pilih ruangan sidang"
                        className={`min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm outline-none ${editRoomError ? "border-[#dc4c4c] bg-[#fffafa] focus:border-[#c73737]" : "border-[#d1daf0] focus:border-[#2f63e3]"}`}
                      >
                        <option value="">Pilih ruangan sidang</option>
                        {SIDANG_ROOM_OPTIONS.map((room) => (
                          <option key={room} value={room}>
                            {room}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={addEditRoom}
                        className="rounded-lg border border-[#d1daf0] px-3 py-2 text-sm font-semibold text-[#27407b] transition hover:bg-[#f3f6ff]"
                      >
                        Tambah Ruangan
                      </button>
                    </div>
                    <FieldError message={editRoomError} />
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(editPeriodeForm.ruangan_list || []).map((ruangan) => (
                        <button
                          key={`edit-ruangan-${ruangan}`}
                          type="button"
                          onClick={() =>
                            setEditPeriodeForm((prev) => ({
                              ...prev,
                              ruangan_list: (prev.ruangan_list || []).filter((item) => item !== ruangan),
                            }))
                          }
                          className="rounded-full border border-[#c9d7f5] bg-white px-3 py-1 text-xs font-semibold text-[#2c4ca0]"
                        >
                          {ruangan} x
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={savingForm || String(selectedPeriode.status || "").toLowerCase() === "open"}
                    onClick={() => {
                      handleOpenSelectedPeriode().catch(() => {});
                    }}
                    className="rounded-lg bg-[#137748] px-3 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Buka Periode
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-3 rounded-lg border border-[#e5ebf8] bg-[#f8fbff] p-3 text-sm font-semibold text-[#6a79a3]">
                Pilih salah satu periode sidang untuk mengatur hari dan ruangan.
              </div>
            )}
          </section>
        </>
      ) : null}

      <MultiDateCalendarModal
        open={calendarOpen}
        selectedDates={editPeriodeForm.tanggal_sidang_list}
        lockedDates={periodePageMode === "edit" ? scheduledSidangDates : []}
        minDate={todayDateOnly}
        initialDate={selectedPeriode?.tanggal_selesai_pendaftaran || todayDateOnly}
        onClose={() => setCalendarOpen(false)}
        onLockedDateClick={(tanggal) => showErrorToast(
          `Hari sidang ${formatDateLabel(tanggal)} tidak dapat dihapus karena sudah memiliki jadwal dan dosen penguji.`
        )}
        onApply={(dates) => {
          setEditPeriodeForm((prev) => ({ ...prev, tanggal_sidang_list: dates }));
          setEditPeriodeErrors((prev) => ({ ...prev, tanggal_sidang_list: "" }));
        }}
      />
      <ExaminerAvailabilityDetailModal
        dosen={selectedAvailableDosen}
        sidangDates={queueContext.hari_sidang}
        onClose={() => setSelectedAvailableDosen(null)}
      />
      <RegistrantDetailModal
        open={Boolean(selectedRegistrantId)}
        loading={loadingDetail}
        detail={selectedRegistrantDetail}
        onClose={() => {
          setSelectedRegistrantId(null);
          setSelectedRegistrantDetail(null);
        }}
      />
      <AssignmentEditModal
        row={editingAssignment}
        dayOptions={queueContext.hari_sidang}
        lecturerOptions={queueContext.dosen_tersedia}
        roomOptions={selectedPeriode?.ruangan_sidang || []}
        otherRows={assignmentRows.filter((item) => Number(item.pendaftaran_sidang_id) !== Number(editingAssignment?.pendaftaran_sidang_id))}
        supervisorId={queueRows.find((item) => Number(item.id) === Number(editingAssignment?.pendaftaran_sidang_id))?.dosen_pembimbing?.id}
        onClose={() => setEditingAssignment(null)}
        onSave={(updatedRow) => {
          setAssignmentRows((current) => current.map((item) =>
            Number(item.pendaftaran_sidang_id) === Number(updatedRow.pendaftaran_sidang_id) ? updatedRow : item
          ));
          setAssignmentCommitted(false);
          setEditingAssignment(null);
          showSuccessToast("Draft penugasan berhasil diperbarui.");
        }}
      />
    </div>
  );
}

export default SekretarisSidangManagementPage;
