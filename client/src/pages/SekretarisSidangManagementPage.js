import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarCheck2, CalendarDays, CalendarRange, ChevronLeft, ChevronRight, Eye, RefreshCcw, Save, X } from "lucide-react";
import Swal from "sweetalert2";
import { formatDosenFullName } from "../utils/dosen";

const GRID_PAGE_SIZE = 20;
const SIDANG_TABS = [
  { id: "periode-pendaftaran", label: "Periode Pendaftaran Sidang" },
  { id: "pendaftar-sidang", label: "Pendaftar Sidang" },
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

function MultiDateCalendarModal({ open, selectedDates, minDate, initialDate, onClose, onApply }) {
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
  const monthLabel = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(visibleMonth);
  const today = toLocalDateOnly(new Date());

  const toggleDate = (dateOnly) => {
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
                return (
                  <button
                    key={dateOnly}
                    type="button"
                    disabled={disabled}
                    onClick={() => toggleDate(dateOnly)}
                    className={`relative flex min-h-[58px] items-center justify-center rounded-xl border text-sm font-bold transition ${
                      selected
                        ? "border-[#2f63e3] bg-[#2f63e3] text-white shadow-md"
                        : dateOnly === today
                          ? "border-[#2f63e3] bg-[#eef3ff] text-[#244cae]"
                          : disabled
                            ? "border-transparent bg-transparent text-[#b5bfd4]"
                            : "border-[#e0e7f5] bg-white text-[#263b6f] hover:border-[#7799ed] hover:bg-[#f2f6ff]"
                    } disabled:cursor-not-allowed`}
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
            <div className="flex items-center justify-between gap-3"><p className="text-sm font-bold text-[#263b6f]">Tanggal dipilih ({draftDates.length})</p>{draftDates.length ? <button type="button" onClick={() => setDraftDates([])} className="text-xs font-bold text-[#b73a3a] hover:underline">Hapus semua</button> : null}</div>
            <div className="mt-3 flex min-h-[38px] flex-wrap gap-2">
              {draftDates.length ? draftDates.map((dateOnly) => <button key={dateOnly} type="button" onClick={() => toggleDate(dateOnly)} className="inline-flex items-center gap-1 rounded-full border border-[#c8d7f7] bg-[#eef3ff] px-3 py-1.5 text-xs font-bold text-[#274b9f]">{formatDateLabel(dateOnly)} <X className="h-3 w-3" /></button>) : <p className="text-sm text-[#7a88a9]">Belum ada tanggal yang dipilih.</p>}
            </div>
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

function SekretarisSidangManagementPage({ session, apiBaseUrl, onSessionExpired }) {
  const todayDateOnly = useMemo(() => getJakartaTodayDateOnly(), []);
  const [activeTab, setActiveTab] = useState("periode-pendaftaran");
  const [periodePageMode, setPeriodePageMode] = useState("list");
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [savingForm, setSavingForm] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [overview, setOverview] = useState({ active_periode: null, periodes: [] });
  const [selectedPeriodeId, setSelectedPeriodeId] = useState("");
  const [queueRows, setQueueRows] = useState([]);
  const [queueQuery, setQueueQuery] = useState("");
  const [queuePage, setQueuePage] = useState(1);

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
      setSelectedPeriodeId((prev) => (prev ? prev : fallbackId ? String(fallbackId) : ""));
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
      } catch (loadError) {
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
  }, [loadQueueByPeriode, selectedPeriodeId]);

  const selectedPeriode = useMemo(() => {
    const numericId = Number(selectedPeriodeId || 0);
    return (overview?.periodes || []).find((item) => Number(item.id) === numericId) || null;
  }, [overview, selectedPeriodeId]);

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
      setPeriodePageMode("list");
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

  const handleSaveSelectedPeriode = async () => {
    if (!selectedPeriode) return;
    const tanggalSelesai = String(editPeriodeForm.tanggal_selesai_pendaftaran || "").trim();
    const tanggalMulai = String(selectedPeriode.tanggal_mulai_pendaftaran || "").slice(0, 10);
    const validationErrors = {};
    if (!tanggalSelesai) {
      validationErrors.tanggal_selesai_pendaftaran = "Tanggal selesai pendaftaran wajib diisi.";
    } else if (tanggalMulai && tanggalSelesai < tanggalMulai) {
      validationErrors.tanggal_selesai_pendaftaran = "Tanggal selesai tidak boleh sebelum tanggal mulai pendaftaran.";
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
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.success) {
        if (body?.field_errors && typeof body.field_errors === "object") {
          setEditPeriodeErrors(body.field_errors);
          setError("");
          return;
        }
        throw new Error(body?.message || "Gagal memperbarui periode sidang.");
      }
      setSuccess(body?.message || "Periode sidang berhasil diperbarui.");
      setEditPeriodeErrors({});
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

  const handleSaveSidangSettings = async () => {
    if (!selectedPeriode) return;
    const dateList = Array.isArray(editPeriodeForm.tanggal_sidang_list)
      ? uniqueSorted(editPeriodeForm.tanggal_sidang_list)
      : [];
    const roomList = Array.isArray(editPeriodeForm.ruangan_list)
      ? uniqueSorted(editPeriodeForm.ruangan_list)
      : [];

    if (dateList.length === 0) {
      setError("Pilih minimal 1 hari sidang dari kalender.");
      setSuccess("");
      return;
    }
    if (roomList.length === 0) {
      setEditRoomError("Tambahkan minimal satu ruangan sidang.");
      setError("");
      setSuccess("");
      return;
    }

    try {
      setSavingForm(true);
      setError("");
      setSuccess("");
      setEditRoomError("");
      const response = await fetchWithAuth(`/api/sekretaris/sidang/periode/${selectedPeriode.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          tanggal_sidang_list: dateList,
          ruangan_list: roomList,
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.success) {
        throw new Error(body?.message || "Gagal menyimpan pengaturan hari dan ruangan sidang.");
      }
      setSuccess(body?.message || "Pengaturan hari dan ruangan sidang berhasil disimpan.");
      await loadOverview();
    } catch (actionError) {
      if (actionError.message !== "__SESSION_EXPIRED__") {
        setError(actionError.message || "Gagal menyimpan pengaturan hari dan ruangan sidang.");
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
    const confirm = window.confirm(
      `Tutup periode sidang ${selectedPeriode.label_periode || formatPeriodeSidangLabel(selectedPeriode)}?`
    );
    if (!confirm) return;

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
      setSuccess(body?.message || "Periode sidang berhasil ditutup.");
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

  const handleAutoAssign = async () => {
    if (!selectedPeriode) return;
    try {
      setSavingForm(true);
      setError("");
      setSuccess("");
      const response = await fetchWithAuth("/api/sekretaris/sidang/assign", {
        method: "POST",
        body: JSON.stringify({ periode_sidang_id: selectedPeriode.id }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.success) {
        throw new Error(body?.message || "Gagal menjalankan auto-assign penguji.");
      }
      const assignedCount = Number(body?.data?.assigned_count || 0);
      const unassignedCount = Number(body?.data?.unassigned_count || 0);
      setSuccess(`Auto-assign selesai: ${assignedCount} terjadwal, ${unassignedCount} belum terjadwal.`);
      await loadQueueByPeriode(selectedPeriode.id);
      await loadOverview();
    } catch (actionError) {
      if (actionError.message !== "__SESSION_EXPIRED__") {
        setError(actionError.message || "Gagal menjalankan auto-assign penguji.");
      }
    } finally {
      setSavingForm(false);
    }
  };

  const filteredQueueRows = useMemo(() => {
    const keyword = String(queueQuery || "").trim().toLowerCase();
    if (!keyword) return queueRows;
    return queueRows.filter((row) => {
      const haystack = [
        row?.mahasiswa?.nim,
        row?.mahasiswa?.nama,
        row?.judul_skripsi,
        row?.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(keyword);
    });
  }, [queueRows, queueQuery]);

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
  const activeSidangMenuTab = periodePageMode === "registrants"
    ? "pendaftar-sidang"
    : "periode-pendaftaran";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
      {success ? (
        <div className="rounded-xl border border-[#d6f1e2] bg-[#ecfaf2] p-4 text-sm font-semibold text-[#196a45]">
          {success}
        </div>
      ) : null}

      <section className="rounded-xl border border-[#e4e9f6] bg-white p-3 shadow-sm">
        <h3 className="text-lg font-black text-[#1b274b]">Menu Manajemen Sidang</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {SIDANG_TABS.map((tab) => (
            <button
              key={`sidang-tab-${tab.id}`}
              type="button"
              onClick={() => {
                setActiveTab("periode-pendaftaran");
                setSelectedRegistrantId(null);
                setSelectedRegistrantDetail(null);
                setError("");
                setSuccess("");
                if (tab.id === "pendaftar-sidang") {
                  const defaultPeriodeId = overview?.active_periode?.id || overview?.periodes?.[0]?.id || "";
                  setSelectedPeriodeId(defaultPeriodeId ? String(defaultPeriodeId) : "");
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
              onClick={() => {
                setPeriodePageMode("list");
                setOpenPeriodeErrors({});
                setError("");
                setSuccess("");
              }}
              disabled={periodePageMode === "list"}
              aria-label="Kembali ke daftar periode pendaftaran sidang"
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
            {periodePageMode !== "registrants" ? (
              <button
                type="button"
                disabled={savingForm}
                onClick={() => {
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

          {periodePageMode === "list" || periodePageMode === "registrants" ? (
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

          {periodePageMode === "registrants" ? (
          <section className="flex flex-col rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-lg font-black text-[#1b274b]">Grid Pendaftar Sidang</h3>
                <p className="mt-1 text-sm text-[#66769a]">Menampilkan mahasiswa yang mendaftar pada periode sidang terpilih.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={selectedPeriodeId}
                  onChange={(event) => {
                    setSelectedPeriodeId(event.target.value);
                    setSelectedRegistrantId(null);
                    setSelectedRegistrantDetail(null);
                    setQueuePage(1);
                  }}
                  className="min-w-[260px] rounded-lg border border-[#d1daf0] bg-white px-3 py-2 text-sm outline-none focus:border-[#2f63e3]"
                  aria-label="Filter periode sidang"
                >
                  {(overview?.periodes || []).length === 0 ? <option value="">Belum ada periode sidang</option> : null}
                  {(overview?.periodes || []).map((item) => (
                    <option key={`queue-period-${item.id}`} value={String(item.id)}>
                      {item.label_periode || formatPeriodeSidangLabel(item)}{String(item.status || "").toLowerCase() === "open" ? " (Aktif)" : ""}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={queueQuery}
                  onChange={(event) => {
                    setQueueQuery(event.target.value);
                    setQueuePage(1);
                  }}
                  placeholder="Cari NIM, nama, judul, status..."
                  className="w-[300px] rounded-lg border border-[#d1daf0] px-3 py-2 text-sm outline-none focus:border-[#2f63e3]"
                />
              </div>
            </div>

            <div className="relative shrink-0 overflow-auto rounded-lg border border-[#e6ecf8] grid-unified-height">
              <table className="w-full min-w-[1400px] text-left text-sm">
                <thead>
                  <tr className="border-y border-[#e6ecf8] text-[#4d5e89]">
                    <th className="bg-[#f8fbff] px-3 py-2 font-semibold">No</th>
                    <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Mahasiswa</th>
                    <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Judul Skripsi</th>
                    <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Semester Penjaluran</th>
                    <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Status Pendaftaran</th>
                    <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Tanggal Daftar</th>
                    <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedRows.map((row, index) => (
                    <tr key={`queue-row-${row.id}`} className="border-b border-[#eff3fb]">
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
          </section>
          ) : null}

          {periodePageMode === "registrants" && selectedRegistrantId ? (
            <section className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
              <h3 className="text-lg font-black text-[#1b274b]">Detail Pendaftar Sidang</h3>
              {loadingDetail ? (
                <div className="mt-3 rounded-lg border border-[#e2e9f8] bg-[#f8fbff] p-4 text-sm font-semibold text-[#60709a]">
                  Memuat detail mahasiswa...
                </div>
              ) : null}
              {!loadingDetail && selectedRegistrantDetail ? (
                <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
                  <div className="rounded-lg border border-[#e2e9f8] bg-[#f8fbff] p-3 text-sm text-[#42588f]">
                    <p className="font-bold text-[#1f2d53]">Identitas Mahasiswa</p>
                    <p className="mt-1">Nama: {selectedRegistrantDetail?.mahasiswa?.nama || "-"}</p>
                    <p>NIM: {selectedRegistrantDetail?.mahasiswa?.nim || "-"}</p>
                    <p>Email: {selectedRegistrantDetail?.mahasiswa?.email || "-"}</p>
                    <p>Angkatan: {selectedRegistrantDetail?.mahasiswa?.angkatan || "-"}</p>
                    <p>Status Jalur: {selectedRegistrantDetail?.mahasiswa?.status_jalur_saat_ini || "-"}</p>
                  </div>
                  <div className="rounded-lg border border-[#e2e9f8] bg-[#f8fbff] p-3 text-sm text-[#42588f]">
                    <p className="font-bold text-[#1f2d53]">Data Skripsi & Penjaluran</p>
                    <p className="mt-1">
                      Judul Skripsi: {selectedRegistrantDetail?.pengajuan_skripsi?.judul_skripsi || "-"}
                    </p>
                    <p>
                      Semester Penjaluran:{" "}
                      {selectedRegistrantDetail?.penjaluran_terakhir?.semester_mahasiswa
                        ? `Semester ${selectedRegistrantDetail.penjaluran_terakhir.semester_mahasiswa}`
                        : "-"}
                    </p>
                    <p>Jalur Penjaluran: {selectedRegistrantDetail?.penjaluran_terakhir?.jalur || "-"}</p>
                    <p>Dosen Pembimbing: {formatDosenFullName(selectedRegistrantDetail?.dosen_pembimbing?.nama, selectedRegistrantDetail?.dosen_pembimbing?.gelar) || "-"}</p>
                  </div>
                  <div className="rounded-lg border border-[#e2e9f8] bg-[#f8fbff] p-3 text-sm text-[#42588f]">
                    <p className="font-bold text-[#1f2d53]">Status Pendaftaran Sidang</p>
                    <p className="mt-1">
                      Status: {selectedRegistrantDetail?.pendaftaran_sidang?.status || "-"}
                    </p>
                    <p>
                      Terdaftar:{" "}
                      {formatDateTime(selectedRegistrantDetail?.pendaftaran_sidang?.registered_at)}
                    </p>
                    <p>
                      Periode:{" "}
                      {selectedRegistrantDetail?.periode_sidang
                        ? formatPeriodeSidangLabel(selectedRegistrantDetail.periode_sidang)
                        : "-"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-[#e2e9f8] bg-[#f8fbff] p-3 text-sm text-[#42588f]">
                    <p className="font-bold text-[#1f2d53]">Progress Bimbingan</p>
                    <p className="mt-1">
                      Sesi Tervalidasi:{" "}
                      {selectedRegistrantDetail?.bimbingan_progress?.counted_sessions || 0} /{" "}
                      {selectedRegistrantDetail?.bimbingan_progress?.target_minimum || 8}
                    </p>
                    <p>
                      Dokumen Approved:{" "}
                      {selectedRegistrantDetail?.bimbingan_progress?.dokumen_approved_count || 0} /{" "}
                      {selectedRegistrantDetail?.bimbingan_progress?.dokumen_total_required || 3}
                    </p>
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
                  ? "Periode sedang aktif. Hanya tanggal selesai pendaftaran yang dapat diperbarui."
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
                <div className="mt-4 flex flex-wrap gap-2 border-t border-[#e8edf8] pt-4">
                  <button
                    type="button"
                    disabled={savingForm}
                    onClick={() => handleSaveSelectedPeriode().catch(() => {})}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#2f63e3] px-3 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Save className="h-4 w-4" />
                    Simpan Perubahan
                  </button>
                  <button
                    type="button"
                    disabled={savingForm}
                    onClick={() => handleCloseSelectedPeriode().catch(() => {})}
                    className="rounded-lg bg-[#b73a3a] px-3 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Tutup Periode Aktif
                  </button>
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

            <div className="flex flex-wrap gap-2">
              {(overview?.periodes || []).map((item) => (
                <button
                  key={`period-setting-${item.id}`}
                  type="button"
                  onClick={() => setSelectedPeriodeId(String(item.id))}
                  className={`rounded-full border px-3 py-1 text-xs font-bold ${
                    String(selectedPeriodeId) === String(item.id)
                      ? "border-[#2f63e3] bg-[#2f63e3] text-white"
                      : "border-[#cfd8ef] bg-white text-[#2f4477]"
                  }`}
                >
                  {formatPeriodeSidangLabel(item)} - {item.status}
                </button>
              ))}
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
                      <input
                        type="text"
                        value={editRoomInput}
                        onChange={(event) => {
                          setEditRoomInput(event.target.value);
                          setEditRoomError("");
                        }}
                        placeholder="Contoh: Ruang Sidang A"
                        aria-invalid={Boolean(editRoomError)}
                        className={`min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm outline-none ${editRoomError ? "border-[#dc4c4c] bg-[#fffafa] focus:border-[#c73737]" : "border-[#d1daf0] focus:border-[#2f63e3]"}`}
                      />
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

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={savingForm}
                    onClick={() => {
                      handleSaveSidangSettings().catch(() => {});
                    }}
                    className="inline-flex items-center gap-2 rounded-lg border border-[#d1daf0] bg-white px-3 py-2 text-sm font-semibold text-[#2b3f73] hover:bg-[#f1f5ff] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Save className="h-4 w-4" />
                    Simpan Konfigurasi
                  </button>
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
                  <button
                    type="button"
                    disabled={savingForm || String(selectedPeriode.status || "").toLowerCase() !== "open"}
                    onClick={() => {
                      handleCloseSelectedPeriode().catch(() => {});
                    }}
                    className="rounded-lg bg-[#b73a3a] px-3 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Tutup Periode
                  </button>
                  <button
                    type="button"
                    disabled={savingForm}
                    onClick={() => {
                      handleAutoAssign().catch(() => {});
                    }}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#2f63e3] px-3 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <CalendarCheck2 className="h-4 w-4" />
                    Auto Assign Penguji
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
        minDate={todayDateOnly}
        initialDate={selectedPeriode?.tanggal_selesai_pendaftaran || todayDateOnly}
        onClose={() => setCalendarOpen(false)}
        onApply={(dates) => setEditPeriodeForm((prev) => ({ ...prev, tanggal_sidang_list: dates }))}
      />
    </div>
  );
}

export default SekretarisSidangManagementPage;
