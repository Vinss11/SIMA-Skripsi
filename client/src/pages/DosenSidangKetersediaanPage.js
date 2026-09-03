import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, Download, Eye, FileCheck2, Pencil, RefreshCcw, Save, X } from "lucide-react";
import Swal from "sweetalert2";

const GRADE_LETTER_OPTIONS = [
  "A", "A-", "A/B", "B+", "B", "B-", "B/C", "C+", "C", "C-",
  "C/D", "D+", "D", "D-", "D/E", "E+", "E", "E-", "E/F", "F",
];

const INVALID_ASSESSMENT_TEXT_CHARACTERS = new Set([
  "+", "=", "_", "{", "}", "[", "]", "<", ">", "?", "/", "\\", "|", ":", ";", "'", '"',
]);

function getAssessmentTextError(value, label) {
  const text = String(value || "").trim();
  const hasInvalidCharacter = Array.from(text).some((character) => {
    const code = character.charCodeAt(0);
    return INVALID_ASSESSMENT_TEXT_CHARACTERS.has(character) || code < 32 || code === 127;
  });
  if (!text || (!hasInvalidCharacter && !text.includes("--"))) return "";
  return `${label} tidak boleh mengandung karakter { } [ ] < > ? + = _ / \\ | : ; ' ", atau pola -- (komentar SQL).`;
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

function decisionLabel(value) {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "lulus") return "Lulus";
  if (normalized === "lulus_dengan_revisi") return "Lulus dengan Revisi";
  if (normalized === "tidak_lulus") return "Tidak Lulus";
  return "Belum Diputuskan";
}

function graduationStatusLabel(value) {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "lulus") return "Lulus Sepenuhnya";
  if (normalized === "lulus_bersyarat") return "Menunggu Penyelesaian Revisi";
  if (normalized === "tidak_lulus") return "Tidak Lulus";
  return "Menunggu Penilaian";
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

function ScheduleDayDetailModal({ detail, onClose }) {
  useEffect(() => {
    if (!detail) return undefined;
    const onKeyDown = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [detail, onClose]);

  if (!detail) return null;

  return (
    <div className="fixed inset-0 z-[170] flex items-center justify-center bg-[#101d3b]/65 p-4 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label="Detail jadwal penguji" className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[#d8e1f4] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#e4eaf6] px-6 py-5">
          <div>
            <h3 className="text-xl font-black text-[#17264d]">Detail Jadwal Penguji</h3>
            <p className="mt-1 text-sm text-[#60709a]">{formatDateLabel(detail.tanggal_sidang)}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup detail jadwal" className="rounded-lg border border-[#d5def1] p-2 text-[#52658f] hover:bg-[#f3f6ff]"><X className="h-5 w-5" /></button>
        </div>
        <div className="min-h-0 overflow-y-auto p-6">
          <div className="overflow-auto rounded-xl border border-[#dfe7f6]">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead><tr className="border-y border-[#e6ecf8] text-[#4d5e89]"><th className="bg-[#f8fbff] px-3 py-2 font-semibold">Sesi</th><th className="bg-[#f8fbff] px-3 py-2 font-semibold">Waktu</th><th className="bg-[#f8fbff] px-3 py-2 font-semibold">Ruangan</th><th className="bg-[#f8fbff] px-3 py-2 font-semibold">Mahasiswa</th><th className="bg-[#f8fbff] px-3 py-2 font-semibold">Peran</th></tr></thead>
              <tbody>{detail.rows.map((item) => <tr key={item.id} className="border-b border-[#eff3fb]"><td className="px-3 py-3 font-semibold text-[#263a66]">Sesi {item.sesi_ke}</td><td className="px-3 py-3">{item.sesi_mulai}–{item.sesi_selesai}</td><td className="px-3 py-3">{item.ruangan || "-"}</td><td className="px-3 py-3"><p className="font-semibold text-[#263a66]">{item.mahasiswa?.nama || "-"}</p><p className="text-xs text-[#6b789b]">{item.mahasiswa?.nim || "-"}</p></td><td className="px-3 py-3"><span className="rounded-full bg-[#e8eefc] px-2.5 py-1 text-xs font-bold text-[#315196]">{item.peran_penguji || "Penguji"}</span></td></tr>)}</tbody>
            </table>
          </div>
        </div>
        <div className="flex justify-end border-t border-[#e4eaf6] bg-[#f8faff] px-6 py-4"><button type="button" onClick={onClose} className="rounded-lg bg-[#2f63e3] px-4 py-2 text-sm font-bold text-white hover:brightness-110">Tutup</button></div>
      </div>
    </div>
  );
}

function DosenSidangKetersediaanPage({ session, apiBaseUrl, onSessionExpired, mode = "management" }) {
  const isAssessmentMode = mode === "assessment";
  const [activeSection, setActiveSection] = useState(isAssessmentMode ? "assessment" : "availability");
  const [view, setView] = useState("list");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [periods, setPeriods] = useState([]);
  const [detail, setDetail] = useState(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedScheduleDay, setSelectedScheduleDay] = useState(null);
  const [assessmentRows, setAssessmentRows] = useState([]);
  const [selectedAssessment, setSelectedAssessment] = useState(null);
  const [savingAssessment, setSavingAssessment] = useState(false);
  const [assessmentForm, setAssessmentForm] = useState({ nilai_akhir: "", huruf_nilai: "", keputusan: "", catatan: "", catatan_revisi: "" });
  const [revisionReview, setRevisionReview] = useState({ status: "approved", catatan: "" });
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

  const loadDetail = useCallback(async (periodId, nextView = "availability-detail") => {
    try {
      setLoading(true);
      setError("");
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
      setView(nextView);
    } catch (loadError) {
      if (loadError.message !== "__SESSION_EXPIRED__") setError(loadError.message || "Gagal memuat detail periode sidang.");
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  const loadAssessmentList = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const response = await fetchWithAuth("/api/dosen/sidang/penilaian");
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.success) throw new Error(body?.message || "Gagal memuat daftar penilaian sidang.");
      setAssessmentRows(Array.isArray(body?.data?.rows) ? body.data.rows : []);
      setView("list");
    } catch (loadError) {
      if (loadError.message !== "__SESSION_EXPIRED__") setError(loadError.message || "Gagal memuat daftar penilaian sidang.");
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  const loadAssessmentDetail = useCallback(async (scheduleId) => {
    try {
      setLoading(true);
      setError("");
      const response = await fetchWithAuth(`/api/dosen/sidang/penilaian/${scheduleId}`);
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.success) throw new Error(body?.message || "Gagal memuat detail penilaian sidang.");
      const next = body.data;
      setSelectedAssessment(next);
      setAssessmentForm({
        nilai_akhir: next?.penilaian_saya?.nilai_akhir ?? "",
        huruf_nilai: next?.penilaian_saya?.huruf_nilai || "",
        keputusan: next?.penilaian_saya?.keputusan || "",
        catatan: next?.penilaian_saya?.catatan || "",
        catatan_revisi: next?.penilaian_saya?.catatan_revisi || "",
      });
      setRevisionReview({ status: "approved", catatan: "" });
      setView("assessment-detail");
    } catch (loadError) {
      if (loadError.message !== "__SESSION_EXPIRED__") setError(loadError.message || "Gagal memuat detail penilaian sidang.");
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  const submitAssessment = async () => {
    if (!selectedAssessment?.id) return;
    if (!selectedAssessment.session_started) {
      setError(`Penilaian belum dapat diberikan. Sesi dimulai ${formatDateLabel(selectedAssessment.tanggal_sidang)} pukul ${selectedAssessment.sesi_mulai} WIB.`);
      return;
    }
    const catatanError = getAssessmentTextError(assessmentForm.catatan, "Catatan penilaian");
    const catatanRevisiError = assessmentForm.keputusan === "lulus_dengan_revisi"
      ? getAssessmentTextError(assessmentForm.catatan_revisi, "Catatan revisi")
      : "";
    if (catatanError || catatanRevisiError) {
      setError("Periksa kembali catatan penilaian sebelum menyimpan.");
      return;
    }
    try {
      setSavingAssessment(true);
      setError("");
      const response = await fetchWithAuth(`/api/dosen/sidang/penilaian/${selectedAssessment.id}`, {
        method: "POST",
        body: JSON.stringify(assessmentForm),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.success) throw new Error(body?.message || "Gagal menyimpan penilaian sidang.");
      showSuccessToast(body.message || "Penilaian sidang berhasil disimpan.");
      await loadAssessmentDetail(selectedAssessment.id);
    } catch (saveError) {
      if (saveError.message !== "__SESSION_EXPIRED__") setError(saveError.message || "Gagal menyimpan penilaian sidang.");
    } finally {
      setSavingAssessment(false);
    }
  };

  const reviewRevision = async () => {
    const revisionId = selectedAssessment?.revisi_terakhir?.id;
    if (!revisionId) return;
    try {
      setSavingAssessment(true);
      setError("");
      const response = await fetchWithAuth(`/api/dosen/sidang/revisi/${revisionId}/review`, {
        method: "POST",
        body: JSON.stringify(revisionReview),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.success) throw new Error(body?.message || "Gagal menyimpan review revisi.");
      showSuccessToast(body.message || "Review revisi berhasil disimpan.");
      await loadAssessmentDetail(selectedAssessment.id);
    } catch (reviewError) {
      if (reviewError.message !== "__SESSION_EXPIRED__") setError(reviewError.message || "Gagal menyimpan review revisi.");
    } finally {
      setSavingAssessment(false);
    }
  };

  const downloadRevision = async () => {
    const revision = selectedAssessment?.revisi_terakhir;
    if (!revision?.id) return;
    try {
      const response = await fetchWithAuth(`/api/dosen/sidang/revisi/${revision.id}/download`);
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message || "Gagal mengunduh file revisi.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = revision.file_name || "revisi-skripsi";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      if (downloadError.message !== "__SESSION_EXPIRED__") setError(downloadError.message || "Gagal mengunduh file revisi.");
    }
  };

  useEffect(() => {
    if (isAssessmentMode) loadAssessmentList().catch(() => {});
    else loadPeriods().catch(() => {});
  }, [isAssessmentMode, loadAssessmentList, loadPeriods]);

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
      const response = await fetchWithAuth("/api/dosen/sidang/ketersediaan", {
        method: "POST",
        body: JSON.stringify({ periode_sidang_id: detail?.periode_sidang?.id, ...form }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.success) throw new Error(body?.message || "Gagal menyimpan ketersediaan sidang.");
      const successMessage = body?.message || "Ketersediaan penguji sidang berhasil disimpan.";
      await loadDetail(detail.periode_sidang.id);
      showSuccessToast(successMessage);
    } catch (saveError) {
      if (saveError.message !== "__SESSION_EXPIRED__") setError(saveError.message || "Gagal menyimpan ketersediaan sidang.");
    } finally {
      setSaving(false);
    }
  };

  const period = detail?.periode_sidang;
  const isOpen = String(period?.status || "").toLowerCase() === "open";
  const scheduleDays = useMemo(() => {
    const grouped = new Map();
    (detail?.jadwal_anda || []).forEach((item) => {
      const date = String(item.tanggal_sidang || "");
      if (!grouped.has(date)) grouped.set(date, []);
      grouped.get(date).push(item);
    });
    return Array.from(grouped.entries()).map(([tanggalSidang, rows]) => ({
      tanggal_sidang: tanggalSidang,
      rows,
      jam: [...new Set(
        [...rows]
          .sort((left, right) => Number(left.sesi_ke || 0) - Number(right.sesi_ke || 0))
          .map((item) => [item.sesi_mulai, item.sesi_selesai].filter(Boolean).join("–"))
          .filter(Boolean)
      )],
      ruangan: [...new Set(rows.map((item) => item.ruangan).filter(Boolean))],
      mahasiswa_count: new Set(rows.map((item) => item.mahasiswa?.id).filter(Boolean)).size,
    }));
  }, [detail?.jadwal_anda]);
  const assessmentLocked = Boolean(selectedAssessment?.penilaian_saya);
  const assessmentTextErrors = {
    catatan: assessmentLocked ? "" : getAssessmentTextError(assessmentForm.catatan, "Catatan penilaian"),
    catatan_revisi: !assessmentLocked && assessmentForm.keputusan === "lulus_dengan_revisi"
      ? getAssessmentTextError(assessmentForm.catatan_revisi, "Catatan revisi")
      : "",
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {error ? <div className="rounded-xl border border-[#f3caca] bg-[#fff2f2] p-4 text-sm font-semibold text-[#a03f3f]">{error}</div> : null}

      {!isAssessmentMode ? (
        <section className="rounded-xl border border-[#e4e9f6] bg-white p-3 shadow-sm">
          <h3 className="text-lg font-black text-[#1b274b]">Menu Manajemen Jadwal Sidang</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {[
              { id: "availability", label: "Ketersediaan Sidang" },
              { id: "schedule", label: "Jadwal Sidang" },
            ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setActiveSection(item.id);
                setView("list");
                setDetail(null);
                setSelectedScheduleDay(null);
                setSelectedAssessment(null);
                setError("");
                loadPeriods().catch(() => {});
              }}
              className={`rounded-full border px-3 py-1.5 text-sm font-bold ${activeSection === item.id ? "border-[#2f63e3] bg-[#2f63e3] text-white" : "border-[#cfd8ef] bg-white text-[#2f4477]"}`}
            >
              {item.label}
            </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-xl border border-[#e4e9f6] bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={view === "list"} onClick={() => { setView("list"); setDetail(null); setSelectedScheduleDay(null); setSelectedAssessment(null); setError(""); if (activeSection === "assessment") loadAssessmentList().catch(() => {}); else loadPeriods().catch(() => {}); }} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#d3dbef] text-[#27407b] hover:bg-[#f3f6ff] disabled:cursor-not-allowed disabled:opacity-50"><ArrowLeft className="h-4 w-4" /></button>
          <button type="button" disabled={loading} onClick={() => { if (activeSection === "assessment") { if (view === "assessment-detail" && selectedAssessment?.id) loadAssessmentDetail(selectedAssessment.id).catch(() => {}); else loadAssessmentList().catch(() => {}); } else if (view !== "list" && period?.id) loadDetail(period.id, view).catch(() => {}); else loadPeriods().catch(() => {}); }} className="inline-flex items-center gap-2 rounded-lg border border-[#d3dbef] px-3 py-2 text-sm font-semibold text-[#27407b] hover:bg-[#f3f6ff] disabled:opacity-60"><RefreshCcw className="h-4 w-4" />Refresh</button>
        </div>
      </section>

      {activeSection === "availability" && view === "list" ? (
        <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
          <div>
            <h3 className="text-lg font-black text-[#1b274b]">Grid Periode Sidang</h3>
            <p className="mt-1 text-sm text-[#66769a]">Pilih Atur untuk mengisi atau memperbarui ketersediaan pada periode sidang yang dibuka Sekretaris Prodi.</p>
          </div>
          <div className="relative mt-3 flex-1 overflow-auto rounded-lg border border-[#e6ecf8] grid-unified-height">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead><tr className="border-y border-[#e6ecf8] text-[#4d5e89]">
                <th className="bg-[#f8fbff] px-3 py-2 font-semibold">No</th><th className="bg-[#f8fbff] px-3 py-2 font-semibold">Periode Sidang</th><th className="bg-[#f8fbff] px-3 py-2 font-semibold">Tahun Akademik</th><th className="bg-[#f8fbff] px-3 py-2 font-semibold">Semester</th><th className="bg-[#f8fbff] px-3 py-2 font-semibold">Rentang Pendaftaran</th><th className="bg-[#f8fbff] px-3 py-2 font-semibold">Hari Sidang</th><th className="bg-[#f8fbff] px-3 py-2 font-semibold">Status Pengisian</th><th className="bg-[#f8fbff] px-3 py-2 font-semibold">Diperbarui</th><th className="bg-[#f8fbff] px-3 py-2 font-semibold">Aksi</th>
              </tr></thead>
              <tbody>{periods.map((item, index) => <tr key={item.id} className="border-b border-[#eff3fb]">
                <td className="px-3 py-2">{index + 1}</td><td className="px-3 py-2 font-semibold text-[#1f2d53]">{item.label_periode}</td><td className="px-3 py-2">{item.tahun_akademik}</td><td className="px-3 py-2 capitalize">{item.semester}</td><td className="px-3 py-2">{formatDateLabel(item.tanggal_mulai_pendaftaran, false)} s/d {formatDateLabel(item.tanggal_selesai_pendaftaran, false)}</td><td className="px-3 py-2">{item.jumlah_hari_sidang} tanggal</td>
                <td className="px-3 py-2"><span className={`rounded-full px-2 py-1 text-xs font-bold ${item.ketersediaan_diisi ? "bg-[#e5f8ed] text-[#147347]" : "bg-[#fff4d9] text-[#926600]"}`}>{item.ketersediaan_diisi ? `${item.jumlah_tanggal_tersedia} tanggal dipilih` : "Belum diisi"}</span></td><td className="px-3 py-2">{formatDateTime(item.ketersediaan_diperbarui_at)}</td>
                <td className="px-3 py-2"><button type="button" onClick={() => loadDetail(item.id, "availability-detail").catch(() => {})} className="inline-flex items-center gap-1 rounded-md bg-[#2f63e3] px-3 py-1.5 text-xs font-bold text-white hover:brightness-110"><Pencil className="h-3.5 w-3.5" />Atur</button></td>
              </tr>)}</tbody>
            </table>
            {!loading && periods.length === 0 ? <div className="absolute inset-x-0 bottom-0 top-[41px] flex items-center justify-center text-sm font-semibold text-[#7b88ab]">Belum ada periode sidang yang dibuka.</div> : null}
            {loading ? <div className="absolute inset-x-0 bottom-0 top-[41px] flex items-center justify-center text-sm font-semibold text-[#7b88ab]">Memuat periode sidang...</div> : null}
          </div>
        </section>
      ) : null}

      {activeSection === "schedule" && view === "list" ? (
        <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
          <div>
            <h3 className="text-lg font-black text-[#1b274b]">Grid Jadwal Sidang per Periode</h3>
            <p className="mt-1 text-sm text-[#66769a]">Lihat rekap penugasan Anda sebagai dosen penguji pada setiap periode sidang.</p>
          </div>
          <div className="relative mt-3 flex-1 overflow-auto rounded-lg border border-[#e6ecf8] grid-unified-height">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead><tr className="border-y border-[#e6ecf8] text-[#4d5e89]"><th className="bg-[#f8fbff] px-3 py-2 font-semibold">No</th><th className="bg-[#f8fbff] px-3 py-2 font-semibold">Periode Sidang</th><th className="bg-[#f8fbff] px-3 py-2 font-semibold">Tahun Akademik</th><th className="bg-[#f8fbff] px-3 py-2 font-semibold">Semester</th><th className="bg-[#f8fbff] px-3 py-2 font-semibold">Status Periode</th><th className="bg-[#f8fbff] px-3 py-2 font-semibold">Hari Menguji</th><th className="bg-[#f8fbff] px-3 py-2 font-semibold">Total Jadwal</th><th className="bg-[#f8fbff] px-3 py-2 font-semibold">Aksi</th></tr></thead>
              <tbody>{periods.map((item, index) => {
                const periodOpen = String(item.status || "").toLowerCase() === "open";
                return <tr key={`schedule-period-${item.id}`} className="border-b border-[#eff3fb]"><td className="px-3 py-2">{index + 1}</td><td className="px-3 py-2 font-semibold text-[#1f2d53]">{item.label_periode}</td><td className="px-3 py-2">{item.tahun_akademik}</td><td className="px-3 py-2 capitalize">{item.semester}</td><td className="px-3 py-2"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${periodOpen ? "bg-[#e5f8ed] text-[#147347]" : "bg-[#eef2fb] text-[#59678e]"}`}>{periodOpen ? "Aktif" : "Nonaktif"}</span></td><td className="px-3 py-2">{item.jumlah_hari_menguji || 0} hari</td><td className="px-3 py-2">{item.jumlah_jadwal_penguji || 0} jadwal</td><td className="px-3 py-2"><button type="button" onClick={() => loadDetail(item.id, "schedule-detail").catch(() => {})} className="inline-flex items-center gap-1 rounded-md bg-[#2f63e3] px-3 py-1.5 text-xs font-bold text-white hover:brightness-110"><Eye className="h-3.5 w-3.5" />Detail</button></td></tr>;
              })}</tbody>
            </table>
            {!loading && periods.length === 0 ? <div className="absolute inset-x-0 bottom-0 top-[41px] flex items-center justify-center text-sm font-semibold text-[#7b88ab]">Belum ada data periode sidang.</div> : null}
            {loading ? <div className="absolute inset-x-0 bottom-0 top-[41px] flex items-center justify-center text-sm font-semibold text-[#7b88ab]">Memuat jadwal sidang...</div> : null}
          </div>
        </section>
      ) : null}

      {activeSection === "schedule" && view === "schedule-detail" && period ? (
        <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h3 className="text-lg font-black text-[#1b274b]">Detail Jadwal Sidang — {period.label_periode}</h3><p className="mt-1 text-sm text-[#66769a]">Rekap hari penugasan Anda sebagai dosen penguji.</p></div>
            <span className="rounded-full bg-[#e8eefc] px-3 py-1 text-xs font-bold text-[#315196]">{scheduleDays.length} hari · {detail.jadwal_anda?.length || 0} jadwal</span>
          </div>
          <div className="relative mt-4 flex-1 overflow-auto rounded-lg border border-[#e6ecf8] grid-unified-height">
            <table className="w-full min-w-[1020px] text-left text-sm">
              <thead><tr className="border-y border-[#e6ecf8] text-[#4d5e89]"><th className="bg-[#f8fbff] px-3 py-2 font-semibold">No</th><th className="bg-[#f8fbff] px-3 py-2 font-semibold">Hari/Tanggal</th><th className="bg-[#f8fbff] px-3 py-2 font-semibold">Jam</th><th className="bg-[#f8fbff] px-3 py-2 font-semibold">Jumlah Sesi</th><th className="bg-[#f8fbff] px-3 py-2 font-semibold">Ruangan</th><th className="bg-[#f8fbff] px-3 py-2 font-semibold">Mahasiswa</th><th className="bg-[#f8fbff] px-3 py-2 font-semibold">Aksi</th></tr></thead>
              <tbody>{scheduleDays.map((day, index) => <tr key={`schedule-day-${day.tanggal_sidang}`} className="border-b border-[#eff3fb]"><td className="px-3 py-3">{index + 1}</td><td className="px-3 py-3 font-semibold text-[#263a66]">{formatDateLabel(day.tanggal_sidang)}</td><td className="px-3 py-3"><div className="flex flex-wrap gap-1.5">{day.jam.length ? day.jam.map((jam) => <span key={`${day.tanggal_sidang}-${jam}`} className="whitespace-nowrap rounded-full bg-[#e8eefc] px-2.5 py-1 text-xs font-bold text-[#315196]">{jam}</span>) : "-"}</div></td><td className="px-3 py-3">{day.rows.length} sesi</td><td className="px-3 py-3">{day.ruangan.join(", ") || "-"}</td><td className="px-3 py-3">{day.mahasiswa_count} mahasiswa</td><td className="px-3 py-3"><button type="button" onClick={() => setSelectedScheduleDay(day)} className="inline-flex items-center gap-1 rounded-md bg-[#2f63e3] px-3 py-1.5 text-xs font-bold text-white hover:brightness-110"><Eye className="h-3.5 w-3.5" />Detail</button></td></tr>)}</tbody>
            </table>
            {!loading && scheduleDays.length === 0 ? <div className="absolute inset-x-0 bottom-0 top-[41px] flex items-center justify-center text-sm font-semibold text-[#7b88ab]">Belum ada jadwal penguji pada periode ini.</div> : null}
          </div>
        </section>
      ) : null}

      {activeSection === "assessment" && view === "list" ? (
        <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
          <div>
            <h3 className="text-lg font-black text-[#1b274b]">Penilaian dan Revisi Sidang</h3>
            <p className="mt-1 text-sm text-[#66769a]">Isi penilaian setelah sesi dimulai dan periksa revisi mahasiswa yang ditugaskan kepada Anda.</p>
          </div>
          <div className="relative mt-3 flex-1 overflow-auto rounded-lg border border-[#e6ecf8] grid-unified-height">
            <table className="w-full min-w-[1250px] text-left text-sm">
              <thead><tr className="border-y border-[#e6ecf8] text-[#4d5e89]"><th className="bg-[#f8fbff] px-3 py-2 font-semibold">No</th><th className="bg-[#f8fbff] px-3 py-2 font-semibold">Mahasiswa</th><th className="bg-[#f8fbff] px-3 py-2 font-semibold">Jadwal</th><th className="bg-[#f8fbff] px-3 py-2 font-semibold">Peran</th><th className="bg-[#f8fbff] px-3 py-2 font-semibold">Status Penilaian</th><th className="bg-[#f8fbff] px-3 py-2 font-semibold">Keputusan</th><th className="bg-[#f8fbff] px-3 py-2 font-semibold">Status Revisi</th><th className="bg-[#f8fbff] px-3 py-2 font-semibold">Aksi</th></tr></thead>
              <tbody>{assessmentRows.map((item, index) => {
                const assessmentStatus = item.penilaian_saya ? "Sudah Dinilai" : item.session_started ? "Belum Dinilai" : "Sesi Belum Dimulai";
                const revisionStatus = item.revisi_terakhir?.status === "submitted" ? "Menunggu Review" : item.revisi_terakhir?.status === "revision_required" ? "Perlu Revisi Lagi" : item.revisi_terakhir?.status === "approved" ? "Disetujui" : item.keputusan?.status_kelulusan === "lulus_bersyarat" ? "Menunggu Upload" : "-";
                return <tr key={`assessment-${item.id}`} className="border-b border-[#eff3fb]"><td className="px-3 py-3">{index + 1}</td><td className="px-3 py-3"><p className="font-bold text-[#263a66]">{item.mahasiswa?.nama || "-"}</p><p className="text-xs text-[#7582a2]">{item.mahasiswa?.nim || "-"}</p></td><td className="px-3 py-3"><p className="font-semibold text-[#263a66]">{formatDateLabel(item.tanggal_sidang)}</p><p className="text-xs text-[#7582a2]">{item.sesi_mulai}–{item.sesi_selesai} · {item.ruangan}</p></td><td className="px-3 py-3 capitalize">{String(item.peran_saya || "-").replace("penguji", "Penguji ")}</td><td className="px-3 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${item.penilaian_saya ? "bg-[#e5f8ed] text-[#147347]" : item.session_started ? "bg-[#fff4d9] text-[#926600]" : "bg-[#eef2fb] text-[#59678e]"}`}>{assessmentStatus}</span></td><td className="px-3 py-3">{decisionLabel(item.keputusan?.keputusan)}</td><td className="px-3 py-3">{revisionStatus}</td><td className="px-3 py-3"><button type="button" onClick={() => loadAssessmentDetail(item.id).catch(() => {})} className="inline-flex items-center gap-1 rounded-md bg-[#2f63e3] px-3 py-1.5 text-xs font-bold text-white hover:brightness-110"><FileCheck2 className="h-3.5 w-3.5" />{item.can_review_revision ? "Review Revisi" : item.penilaian_saya ? "Lihat Penilaian" : item.keputusan ? "Lihat Hasil" : "Isi Penilaian"}</button></td></tr>;
              })}</tbody>
            </table>
            {!loading && assessmentRows.length === 0 ? <div className="absolute inset-x-0 bottom-0 top-[41px] flex items-center justify-center text-sm font-semibold text-[#7b88ab]">Belum ada jadwal sidang yang ditugaskan kepada Anda.</div> : null}
            {loading ? <div className="absolute inset-x-0 bottom-0 top-[41px] flex items-center justify-center text-sm font-semibold text-[#7b88ab]">Memuat data penilaian sidang...</div> : null}
          </div>
        </section>
      ) : null}

      {activeSection === "assessment" && view === "assessment-detail" && selectedAssessment ? (
        <div className="space-y-4">
          <section className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-black text-[#1b274b]">Penilaian Sidang — {selectedAssessment.mahasiswa?.nama || "-"}</h3><p className="mt-1 text-sm text-[#66769a]">{selectedAssessment.mahasiswa?.nim || "-"} · {formatDateLabel(selectedAssessment.tanggal_sidang)} · {selectedAssessment.sesi_mulai}–{selectedAssessment.sesi_selesai}</p></div><span className="rounded-full bg-[#e8eefc] px-3 py-1 text-xs font-bold capitalize text-[#315196]">{String(selectedAssessment.peran_saya || "penguji").replace("penguji", "Penguji ")}</span></div>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3"><div className="rounded-lg border border-[#dfe7f5] bg-[#f8fbff] p-3"><p className="text-xs font-bold uppercase text-[#7582a2]">Ruangan</p><p className="mt-1 font-semibold text-[#263a66]">{selectedAssessment.ruangan || "-"}</p></div><div className="rounded-lg border border-[#dfe7f5] bg-[#f8fbff] p-3"><p className="text-xs font-bold uppercase text-[#7582a2]">Penguji 1</p><p className="mt-1 font-semibold text-[#263a66]">{selectedAssessment.penguji1?.nama || "-"}</p></div><div className="rounded-lg border border-[#dfe7f5] bg-[#f8fbff] p-3"><p className="text-xs font-bold uppercase text-[#7582a2]">Penguji 2</p><p className="mt-1 font-semibold text-[#263a66]">{selectedAssessment.penguji2?.nama || "-"}</p></div></div>
            {!selectedAssessment.session_started ? <div className="mt-4 rounded-xl border border-[#f0d7a6] bg-[#fffaf0] p-4 text-sm font-semibold text-[#8a6200]">Penilaian baru dapat diberikan saat sesi dimulai, yaitu {formatDateLabel(selectedAssessment.tanggal_sidang)} pukul {selectedAssessment.sesi_mulai} WIB.</div> : null}
          </section>

          {(!selectedAssessment.keputusan || assessmentLocked) ? (
            <section className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
              <h3 className="text-lg font-black text-[#1b274b]">{assessmentLocked ? "Penilaian Anda" : "Form Penilaian"}</h3>
              <p className="mt-1 text-sm text-[#66769a]">{assessmentLocked ? "Penilaian telah dikirim dan tidak dapat diubah." : "Keputusan akhir dibentuk setelah kedua penguji mengirim penilaian."}</p>
              {assessmentLocked ? <div className="mt-4 rounded-xl border border-[#c8ead6] bg-[#f1fbf5] p-3 text-sm font-semibold text-[#147347]">Penilaian ini sudah final. Anda hanya dapat melihat data yang telah dikirim.</div> : null}
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                <label className="text-sm font-bold text-[#263b6f]">Nilai Akhir (0–100)<input type="number" min="0" max="100" step="0.01" inputMode="decimal" disabled={!selectedAssessment.session_started || assessmentLocked} value={assessmentForm.nilai_akhir} onKeyDown={(event) => { if (["e", "E", "+", "-"].includes(event.key)) event.preventDefault(); }} onChange={(event) => { const nextValue = event.target.value; if (nextValue === "" || (/^\d{0,3}(?:\.\d{0,2})?$/.test(nextValue) && Number(nextValue) <= 100)) setAssessmentForm((prev) => ({ ...prev, nilai_akhir: nextValue })); }} className="mt-1 w-full rounded-lg border border-[#d1daf0] bg-white px-3 py-2 font-normal disabled:bg-[#f1f4fa]" /></label>
                <label className="text-sm font-bold text-[#263b6f]">Huruf Nilai<select disabled={!selectedAssessment.session_started || assessmentLocked} value={assessmentForm.huruf_nilai} onChange={(event) => setAssessmentForm((prev) => ({ ...prev, huruf_nilai: event.target.value }))} className="mt-1 w-full rounded-lg border border-[#d1daf0] bg-white px-3 py-2 font-normal disabled:bg-[#f1f4fa]"><option value="">Pilih huruf nilai</option>{GRADE_LETTER_OPTIONS.map((grade) => <option key={grade} value={grade}>{grade}</option>)}</select></label>
                <label className="text-sm font-bold text-[#263b6f]">Keputusan<select disabled={!selectedAssessment.session_started || assessmentLocked} value={assessmentForm.keputusan} onChange={(event) => setAssessmentForm((prev) => ({ ...prev, keputusan: event.target.value }))} className="mt-1 w-full rounded-lg border border-[#d1daf0] bg-white px-3 py-2 font-normal disabled:bg-[#f1f4fa]"><option value="">Pilih keputusan</option><option value="lulus">Lulus</option><option value="lulus_dengan_revisi">Lulus dengan Revisi</option><option value="tidak_lulus">Tidak Lulus</option></select></label>
              </div>
              <label className="mt-4 block text-sm font-bold text-[#263b6f]">Catatan Penilaian<textarea rows="4" disabled={!selectedAssessment.session_started || assessmentLocked} value={assessmentForm.catatan} aria-invalid={Boolean(assessmentTextErrors.catatan)} onChange={(event) => setAssessmentForm((prev) => ({ ...prev, catatan: event.target.value }))} placeholder={assessmentForm.keputusan === "tidak_lulus" ? "Alasan tidak lulus wajib diisi" : "Catatan umum penilaian sidang"} className={`mt-1 w-full rounded-lg border bg-white px-3 py-2 font-normal disabled:bg-[#f1f4fa] ${assessmentTextErrors.catatan ? "border-[#d64545]" : "border-[#d1daf0]"}`} />{assessmentTextErrors.catatan ? <span className="mt-1 block text-xs font-semibold text-[#c23737]">{assessmentTextErrors.catatan}</span> : null}</label>
              {assessmentForm.keputusan === "lulus_dengan_revisi" ? <label className="mt-4 block text-sm font-bold text-[#263b6f]">Catatan Revisi <span className="text-[#b73a3a]">*</span><textarea rows="5" disabled={!selectedAssessment.session_started || assessmentLocked} value={assessmentForm.catatan_revisi} aria-invalid={Boolean(assessmentTextErrors.catatan_revisi)} onChange={(event) => setAssessmentForm((prev) => ({ ...prev, catatan_revisi: event.target.value }))} placeholder="Tuliskan poin-poin yang wajib diperbaiki mahasiswa" className={`mt-1 w-full rounded-lg border bg-white px-3 py-2 font-normal disabled:bg-[#f1f4fa] ${assessmentTextErrors.catatan_revisi ? "border-[#d64545]" : "border-[#d1daf0]"}`} />{assessmentTextErrors.catatan_revisi ? <span className="mt-1 block text-xs font-semibold text-[#c23737]">{assessmentTextErrors.catatan_revisi}</span> : null}</label> : null}
              {!assessmentLocked ? <div className="mt-4 flex justify-end border-t border-[#e7edf8] pt-4"><button type="button" disabled={!selectedAssessment.session_started || savingAssessment || assessmentForm.nilai_akhir === "" || !assessmentForm.huruf_nilai || !assessmentForm.keputusan || Boolean(assessmentTextErrors.catatan) || Boolean(assessmentTextErrors.catatan_revisi)} onClick={() => submitAssessment().catch(() => {})} className="inline-flex items-center gap-2 rounded-lg bg-[#2f63e3] px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"><Save className="h-4 w-4" />{savingAssessment ? "Menyimpan..." : "Simpan Penilaian"}</button></div> : null}
            </section>
          ) : null}

          {selectedAssessment.keputusan ? (
            <section className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-lg font-black text-[#1b274b]">Hasil Keputusan Sidang</h3><p className="mt-1 text-sm text-[#66769a]">Keputusan telah difinalisasi setelah kedua penguji mengirim penilaian.</p></div><span className={`rounded-full px-3 py-1.5 text-xs font-black ${selectedAssessment.keputusan.status_kelulusan === "lulus" ? "bg-[#e5f8ed] text-[#147347]" : selectedAssessment.keputusan.status_kelulusan === "tidak_lulus" ? "bg-[#ffe9e9] text-[#b73a3a]" : "bg-[#fff4d9] text-[#926600]"}`}>{graduationStatusLabel(selectedAssessment.keputusan.status_kelulusan)}</span></div>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2"><div className="rounded-lg border border-[#dfe7f5] bg-[#f8fbff] p-4"><p className="text-xs font-bold uppercase text-[#7582a2]">Keputusan</p><p className="mt-1 text-lg font-black text-[#263a66]">{decisionLabel(selectedAssessment.keputusan.keputusan)}</p></div><div className="rounded-lg border border-[#dfe7f5] bg-[#f8fbff] p-4"><p className="text-xs font-bold uppercase text-[#7582a2]">Nilai Akhir</p><p className="mt-1 text-lg font-black text-[#263a66]">{selectedAssessment.keputusan.nilai_akhir}</p></div></div>
              <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">{(selectedAssessment.penilaians || []).map((item) => <div key={item.id} className="rounded-xl border border-[#dfe7f5] p-4"><p className="font-black text-[#263a66]">{item.peran === "penguji1" ? "Penguji 1" : "Penguji 2"} — {item.dosen?.nama || "-"}</p><p className="mt-2 text-sm text-[#52658f]">Nilai: <b>{item.nilai_akhir}</b>{item.huruf_nilai ? <> (<b>{item.huruf_nilai}</b>)</> : null} · {decisionLabel(item.keputusan)}</p>{item.catatan ? <p className="mt-2 whitespace-pre-wrap text-sm text-[#52658f]">{item.catatan}</p> : null}{item.catatan_revisi ? <div className="mt-3 rounded-lg bg-[#fff8e8] p-3 text-sm text-[#765900]"><b>Catatan revisi:</b><p className="mt-1 whitespace-pre-wrap">{item.catatan_revisi}</p></div> : null}</div>)}</div>
            </section>
          ) : null}

          {selectedAssessment.keputusan?.status_kelulusan === "lulus_bersyarat" ? (
            <section className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
              <h3 className="text-lg font-black text-[#1b274b]">Review Revisi Mahasiswa</h3>
              {!selectedAssessment.revisi_terakhir ? <p className="mt-3 rounded-lg bg-[#fff8e8] p-3 text-sm font-semibold text-[#765900]">Mahasiswa belum mengunggah file skripsi hasil revisi.</p> : <><div className="mt-4 rounded-xl border border-[#dfe7f5] bg-[#f8fbff] p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-black text-[#263a66]">Revisi Versi {selectedAssessment.revisi_terakhir.versi}</p><p className="mt-1 text-sm text-[#60709a]">{selectedAssessment.revisi_terakhir.file_name} · {formatDateTime(selectedAssessment.revisi_terakhir.uploaded_at)}</p></div><button type="button" onClick={() => downloadRevision().catch(() => {})} className="inline-flex items-center gap-2 rounded-lg border border-[#b9c9ec] bg-white px-3 py-2 text-sm font-bold text-[#294a91]"><Download className="h-4 w-4" />Unduh File</button></div><div className="mt-3 rounded-lg bg-white p-3 text-sm text-[#52658f]"><b>Tanggapan mahasiswa:</b><p className="mt-1 whitespace-pre-wrap">{selectedAssessment.revisi_terakhir.tanggapan_revisi}</p></div></div><div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">{(selectedAssessment.revisi_terakhir.persetujuans || []).map((approval) => <div key={approval.id} className="rounded-lg border border-[#dfe7f5] p-3 text-sm"><p className="font-bold text-[#263a66]">{approval.dosen?.nama || "Dosen Penguji"}</p><p className="mt-1 capitalize text-[#60709a]">Status: {String(approval.status || "pending").replaceAll("_", " ")}</p>{approval.catatan ? <p className="mt-2 text-[#60709a]">{approval.catatan}</p> : null}</div>)}</div></>}
              {selectedAssessment.can_review_revision ? <div className="mt-4 rounded-xl border border-[#cbd9f4] bg-[#f7f9ff] p-4"><p className="font-black text-[#263a66]">Keputusan Review Anda</p><div className="mt-3 flex flex-wrap gap-4"><label className="flex items-center gap-2 text-sm font-semibold text-[#334773]"><input type="radio" checked={revisionReview.status === "approved"} onChange={() => setRevisionReview({ status: "approved", catatan: "" })} />Setujui Revisi</label><label className="flex items-center gap-2 text-sm font-semibold text-[#334773]"><input type="radio" checked={revisionReview.status === "revision_required"} onChange={() => setRevisionReview((prev) => ({ ...prev, status: "revision_required" }))} />Minta Revisi Kembali</label></div>{revisionReview.status === "revision_required" ? <textarea rows="4" value={revisionReview.catatan} onChange={(event) => setRevisionReview((prev) => ({ ...prev, catatan: event.target.value }))} placeholder="Jelaskan bagian yang masih harus diperbaiki" className="mt-3 w-full rounded-lg border border-[#d1daf0] bg-white px-3 py-2 text-sm" /> : null}<div className="mt-3 flex justify-end"><button type="button" disabled={savingAssessment} onClick={() => reviewRevision().catch(() => {})} className="inline-flex items-center gap-2 rounded-lg bg-[#137748] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><Save className="h-4 w-4" />Simpan Review</button></div></div> : null}
            </section>
          ) : null}
        </div>
      ) : null}

      {activeSection === "availability" && view === "availability-detail" && period ? (
        <>
          <section className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h3 className="text-lg font-black text-[#1b274b]">Detail Ketersediaan {period.label_periode}</h3><p className="mt-1 text-sm text-[#66769a]">Pilih tanggal tersedia dan lengkapi aturan penjadwalan Anda.</p></div>
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

            <div className="mt-4 grid grid-cols-1 items-stretch gap-4 lg:grid-cols-3">
              <div className="h-full rounded-xl border border-[#dfe7f6] bg-[#f9fbff] p-4">
                <p className="text-sm font-bold text-[#263b6f]">Mobilitas Ruangan</p>
                <div className="mt-3 space-y-3">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-[#334773]"><input type="radio" name="mobilitas" value="dapat_berpindah" disabled={!isOpen} checked={form.mobilitas_ruangan === "dapat_berpindah"} onChange={(event) => setForm((prev) => ({ ...prev, mobilitas_ruangan: event.target.value }))} className="accent-[#2f63e3]" />Dapat berpindah ruangan</label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-[#334773]"><input type="radio" name="mobilitas" value="satu_ruangan" disabled={!isOpen} checked={form.mobilitas_ruangan === "satu_ruangan"} onChange={(event) => setForm((prev) => ({ ...prev, mobilitas_ruangan: event.target.value }))} className="accent-[#2f63e3]" />Harus berada di satu ruangan yang sama</label>
                </div>
              </div>
              <label className="block h-full rounded-xl border border-[#dfe7f6] bg-[#f9fbff] p-4 text-sm font-bold text-[#263b6f]">
                Maksimal Sesi per Hari
                <select disabled={!isOpen} value={form.maksimal_sesi_per_hari} onChange={(event) => setForm((prev) => ({ ...prev, maksimal_sesi_per_hari: Number(event.target.value) }))} className="mt-3 block w-full rounded-lg border border-[#d1daf0] bg-white px-3 py-2 font-normal outline-none focus:border-[#2f63e3]">{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value} sesi</option>)}</select>
              </label>
              <div className="h-full rounded-xl border border-[#dfe7f6] bg-[#f9fbff] p-4">
                <p className="text-sm font-bold text-[#263b6f]">Kebutuhan Jeda</p>
                <div className="mt-3 space-y-3">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-[#334773]"><input type="radio" name="jeda" disabled={!isOpen} checked={!form.membutuhkan_jeda} onChange={() => setForm((prev) => ({ ...prev, membutuhkan_jeda: false }))} className="accent-[#2f63e3]" />Tidak memerlukan jeda</label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-[#334773]"><input type="radio" name="jeda" disabled={!isOpen} checked={form.membutuhkan_jeda} onChange={() => setForm((prev) => ({ ...prev, membutuhkan_jeda: true }))} className="accent-[#2f63e3]" />Memerlukan minimal satu sesi jeda</label>
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end border-t border-[#e7edf8] pt-4"><button type="button" disabled={!isOpen || saving} onClick={() => handleSave().catch(() => {})} className="inline-flex items-center gap-2 rounded-lg bg-[#2f63e3] px-4 py-2 text-sm font-bold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"><Save className="h-4 w-4" />{saving ? "Menyimpan..." : "Simpan Ketersediaan"}</button></div>
            {!isOpen ? <p className="mt-3 rounded-lg border border-[#f2dfb3] bg-[#fff9e9] px-3 py-2 text-sm font-semibold text-[#7a5a00]">Periode telah ditutup. Data hanya dapat dilihat.</p> : null}
          </section>

        </>
      ) : null}

      <AvailabilityCalendarModal open={calendarOpen} allowedDates={detail?.tanggal_sidang || []} selectedDates={form.tanggal_sidang_list} onClose={() => setCalendarOpen(false)} onApply={(dates) => { setForm((prev) => ({ ...prev, tanggal_sidang_list: dates })); setFieldErrors((prev) => ({ ...prev, tanggal_sidang_list: "" })); }} />
      <ScheduleDayDetailModal detail={selectedScheduleDay} onClose={() => setSelectedScheduleDay(null)} />
    </div>
  );
}

export default DosenSidangKetersediaanPage;
