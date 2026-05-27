import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarCheck2, Eye, Plus, RefreshCcw, Save } from "lucide-react";

const GRID_PAGE_SIZE = 20;
const SIDANG_TABS = [
  { id: "periode-pendaftaran", label: "Periode Pendaftaran Sidang" },
  { id: "pengaturan-sidang", label: "Pengaturan Hari & Ruangan" },
];

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

function SekretarisSidangManagementPage({ session, apiBaseUrl, onSessionExpired }) {
  const todayDateOnly = useMemo(() => getJakartaTodayDateOnly(), []);
  const [activeTab, setActiveTab] = useState("periode-pendaftaran");
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
    catatan: "",
  });

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
  const [editDatePicker, setEditDatePicker] = useState("");
  const [editRoomInput, setEditRoomInput] = useState("");

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
    if (activeTab !== "pengaturan-sidang") return;
    const periodes = Array.isArray(overview?.periodes) ? overview.periodes : [];
    if (periodes.length === 0) return;
    if (selectedPeriode) return;
    setSelectedPeriodeId(String(periodes[0].id));
  }, [activeTab, overview, selectedPeriode]);

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
    setEditDatePicker("");
    setEditRoomInput("");
  }, [selectedPeriode]);

  const addEditDate = useCallback(() => {
    if (!editDatePicker) return;
    setEditPeriodeForm((prev) => ({
      ...prev,
      tanggal_sidang_list: uniqueSorted([...(prev.tanggal_sidang_list || []), editDatePicker]),
    }));
    setEditDatePicker("");
  }, [editDatePicker]);

  const addEditRoom = useCallback(() => {
    const clean = String(editRoomInput || "").trim();
    if (!clean) return;
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
      if (!["uts", "uas"].includes(String(form.periode || "").toLowerCase())) {
        return "Field periode wajib diisi (UTS/UAS).";
      }
      if (!String(form.tahun_akademik || "").trim()) {
        return "Field tahun akademik wajib diisi.";
      }
      if (!["ganjil", "genap"].includes(String(form.semester || "").toLowerCase())) {
        return "Field semester wajib diisi (ganjil/genap).";
      }
      if (!form.tanggal_mulai_pendaftaran || !form.tanggal_selesai_pendaftaran) {
        return "Tanggal mulai dan tanggal selesai pendaftaran wajib diisi.";
      }
      if (form.tanggal_mulai_pendaftaran < todayDateOnly) {
        return "Tanggal mulai pendaftaran sidang tidak boleh sebelum hari ini.";
      }
      if (form.tanggal_selesai_pendaftaran < todayDateOnly) {
        return "Tanggal selesai pendaftaran sidang tidak boleh sebelum hari ini.";
      }
      if (form.tanggal_selesai_pendaftaran < form.tanggal_mulai_pendaftaran) {
        return "Tanggal selesai pendaftaran sidang tidak boleh lebih kecil dari tanggal mulai.";
      }
      return "";
    },
    [todayDateOnly]
  );

  const handleOpenPeriodeFromForm = async () => {
    const validationMessage = validatePeriodForm(openPeriodeForm);
    if (validationMessage) {
      setError(validationMessage);
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
        throw new Error(createBody?.message || "Gagal membuat periode pendaftaran sidang.");
      }

      const periodeId = Number(createBody?.data?.periode?.id || 0);
      if (!periodeId) {
        throw new Error("Periode sidang berhasil dibuat tetapi ID tidak ditemukan.");
      }

      const openResponse = await fetchWithAuth(`/api/sekretaris/sidang/periode/${periodeId}/open`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      const openBody = await openResponse.json().catch(() => null);
      if (!openResponse.ok || !openBody?.success) {
        setSuccess(
          createBody?.message ||
            "Periode sidang berhasil dibuat sebagai draft. Lanjutkan pengaturan hari dan ruangan."
        );
        setError(
          openBody?.message ||
            "Periode berhasil dibuat, namun belum bisa dibuka. Atur hari dan ruangan sidang di tab Pengaturan Hari & Ruangan."
        );
        setSelectedPeriodeId(String(periodeId));
        setOpenPeriodeForm({
          periode: "uts",
          tahun_akademik: "",
          semester: "ganjil",
          tanggal_mulai_pendaftaran: "",
          tanggal_selesai_pendaftaran: "",
          catatan: "",
        });
        await loadOverview();
        return;
      }

      setSuccess(openBody?.message || "Periode pendaftaran sidang berhasil dibuka.");
      setOpenPeriodeForm({
        periode: "uts",
        tahun_akademik: "",
        semester: "ganjil",
        tanggal_mulai_pendaftaran: "",
        tanggal_selesai_pendaftaran: "",
        catatan: "",
      });
      await loadOverview();
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
    const validationMessage = validatePeriodForm(editPeriodeForm);
    if (validationMessage) {
      setError(validationMessage);
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
          periode: editPeriodeForm.periode,
          tahun_akademik: editPeriodeForm.tahun_akademik,
          semester: editPeriodeForm.semester,
          tanggal_mulai_pendaftaran: editPeriodeForm.tanggal_mulai_pendaftaran,
          tanggal_selesai_pendaftaran: editPeriodeForm.tanggal_selesai_pendaftaran,
          catatan: editPeriodeForm.catatan,
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.success) {
        throw new Error(body?.message || "Gagal memperbarui periode sidang.");
      }
      setSuccess(body?.message || "Periode sidang berhasil diperbarui.");
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
      setError("Masukkan minimal 1 ruangan sidang.");
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
    const confirm = window.confirm(
      `Buka periode sidang ${selectedPeriode.label_periode || formatPeriodeSidangLabel(selectedPeriode)}?`
    );
    if (!confirm) return;

    try {
      setSavingForm(true);
      setError("");
      setSuccess("");
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

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
      {error ? (
        <div className="rounded-xl border border-[#f6d7d7] bg-[#fff2f2] p-4 text-sm font-semibold text-[#a03f3f]">
          {error}
        </div>
      ) : null}
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
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-full border px-3 py-1.5 text-sm font-bold ${
                activeTab === tab.id
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
        <>
          <section className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-black text-[#1b274b]">Buka Periode Pendaftaran Sidang</h3>
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

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
              <select
                value={openPeriodeForm.periode}
                onChange={(event) =>
                  setOpenPeriodeForm((prev) => ({ ...prev, periode: event.target.value }))
                }
                className="rounded-lg border border-[#d1daf0] px-3 py-2 text-sm outline-none focus:border-[#2f63e3]"
              >
                <option value="uts">UTS</option>
                <option value="uas">UAS</option>
              </select>
              <input
                type="text"
                value={openPeriodeForm.tahun_akademik}
                onChange={(event) =>
                  setOpenPeriodeForm((prev) => ({ ...prev, tahun_akademik: event.target.value }))
                }
                placeholder="Tahun akademik (contoh 2026/2027)"
                className="rounded-lg border border-[#d1daf0] px-3 py-2 text-sm outline-none focus:border-[#2f63e3]"
              />
              <select
                value={openPeriodeForm.semester}
                onChange={(event) =>
                  setOpenPeriodeForm((prev) => ({ ...prev, semester: event.target.value }))
                }
                className="rounded-lg border border-[#d1daf0] px-3 py-2 text-sm outline-none focus:border-[#2f63e3]"
              >
                <option value="ganjil">Ganjil</option>
                <option value="genap">Genap</option>
              </select>
              <input
                type="date"
                value={openPeriodeForm.tanggal_mulai_pendaftaran}
                min={todayDateOnly}
                onChange={(event) =>
                  setOpenPeriodeForm((prev) => ({
                    ...prev,
                    tanggal_mulai_pendaftaran: event.target.value,
                  }))
                }
                className="rounded-lg border border-[#d1daf0] px-3 py-2 text-sm outline-none focus:border-[#2f63e3]"
              />
              <input
                type="date"
                value={openPeriodeForm.tanggal_selesai_pendaftaran}
                min={openPeriodeForm.tanggal_mulai_pendaftaran || todayDateOnly}
                onChange={(event) =>
                  setOpenPeriodeForm((prev) => ({
                    ...prev,
                    tanggal_selesai_pendaftaran: event.target.value,
                  }))
                }
                className="rounded-lg border border-[#d1daf0] px-3 py-2 text-sm outline-none focus:border-[#2f63e3]"
              />
            </div>

            <textarea
              rows={2}
              value={openPeriodeForm.catatan}
              onChange={(event) =>
                setOpenPeriodeForm((prev) => ({ ...prev, catatan: event.target.value }))
              }
              placeholder="Catatan periode (opsional)"
              className="mt-3 w-full rounded-lg border border-[#d1daf0] px-3 py-2 text-sm outline-none focus:border-[#2f63e3]"
            />

            <div className="mt-3">
              <button
                type="button"
                disabled={savingForm}
                onClick={() => {
                  handleOpenPeriodeFromForm().catch(() => {});
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-[#2f63e3] px-3 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
                {savingForm ? "Memproses..." : "Buka Periode Pendaftaran Sidang"}
              </button>
            </div>

            {overview?.active_periode ? (
              <div className="mt-3 rounded-lg border border-[#f2dfb3] bg-[#fff9e9] p-3 text-sm text-[#7a5a00]">
                <p className="font-bold">Pengingat Periode Aktif</p>
                <p className="mt-1">
                  Saat ini ada periode pendaftaran sidang yang sedang aktif:{" "}
                  <span className="font-semibold">
                    {overview.active_periode.label_periode || formatPeriodeSidangLabel(overview.active_periode)}
                  </span>{" "}
                  ({formatDateLabel(overview.active_periode.tanggal_mulai_pendaftaran)} s/d{" "}
                  {formatDateLabel(overview.active_periode.tanggal_selesai_pendaftaran)}).
                </p>
              </div>
            ) : null}
          </section>

          <section className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-black text-[#1b274b]">Periode Tersedia</h3>
              {loadingOverview ? <span className="text-sm text-[#6f7ea6]">Memuat...</span> : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {(overview?.periodes || []).map((item) => (
                <button
                  key={`periode-chip-${item.id}`}
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

            {selectedPeriode ? (
              <div className="mt-3 rounded-lg border border-[#e5ebf8] bg-[#f8fbff] p-3">
                <p className="text-sm font-bold text-[#233a74]">Edit Periode Terpilih</p>
                <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
                  <select
                    value={editPeriodeForm.periode}
                    onChange={(event) =>
                      setEditPeriodeForm((prev) => ({ ...prev, periode: event.target.value }))
                    }
                    className="rounded-lg border border-[#d1daf0] px-3 py-2 text-sm outline-none focus:border-[#2f63e3]"
                  >
                    <option value="uts">UTS</option>
                    <option value="uas">UAS</option>
                  </select>
                  <input
                    type="text"
                    value={editPeriodeForm.tahun_akademik}
                    onChange={(event) =>
                      setEditPeriodeForm((prev) => ({ ...prev, tahun_akademik: event.target.value }))
                    }
                    className="rounded-lg border border-[#d1daf0] px-3 py-2 text-sm outline-none focus:border-[#2f63e3]"
                  />
                  <select
                    value={editPeriodeForm.semester}
                    onChange={(event) =>
                      setEditPeriodeForm((prev) => ({ ...prev, semester: event.target.value }))
                    }
                    className="rounded-lg border border-[#d1daf0] px-3 py-2 text-sm outline-none focus:border-[#2f63e3]"
                  >
                    <option value="ganjil">Ganjil</option>
                    <option value="genap">Genap</option>
                  </select>
                  <input
                    type="date"
                    value={editPeriodeForm.tanggal_mulai_pendaftaran}
                    min={todayDateOnly}
                    onChange={(event) =>
                      setEditPeriodeForm((prev) => ({
                        ...prev,
                        tanggal_mulai_pendaftaran: event.target.value,
                      }))
                    }
                    className="rounded-lg border border-[#d1daf0] px-3 py-2 text-sm outline-none focus:border-[#2f63e3]"
                  />
                  <input
                    type="date"
                    value={editPeriodeForm.tanggal_selesai_pendaftaran}
                    min={editPeriodeForm.tanggal_mulai_pendaftaran || todayDateOnly}
                    onChange={(event) =>
                      setEditPeriodeForm((prev) => ({
                        ...prev,
                        tanggal_selesai_pendaftaran: event.target.value,
                      }))
                    }
                    className="rounded-lg border border-[#d1daf0] px-3 py-2 text-sm outline-none focus:border-[#2f63e3]"
                  />
                </div>
                <textarea
                  rows={2}
                  value={editPeriodeForm.catatan}
                  onChange={(event) =>
                    setEditPeriodeForm((prev) => ({ ...prev, catatan: event.target.value }))
                  }
                  className="mt-2 w-full rounded-lg border border-[#d1daf0] px-3 py-2 text-sm outline-none focus:border-[#2f63e3]"
                  placeholder="Catatan periode (opsional)"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={savingForm}
                    onClick={() => {
                      handleSaveSelectedPeriode().catch(() => {});
                    }}
                    className="inline-flex items-center gap-2 rounded-lg border border-[#d1daf0] bg-white px-3 py-2 text-sm font-semibold text-[#2b3f73] hover:bg-[#f1f5ff] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Save className="h-4 w-4" />
                    Simpan Perubahan
                  </button>
                  <button
                    type="button"
                    disabled={savingForm || String(selectedPeriode.status || "").toLowerCase() !== "open"}
                    onClick={() => {
                      handleCloseSelectedPeriode().catch(() => {});
                    }}
                    className="rounded-lg bg-[#b73a3a] px-3 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Tutup Periode Aktif
                  </button>
                </div>
              </div>
            ) : null}
          </section>

          <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-black text-[#1b274b]">
                Grid Pendaftar Sidang
                {selectedPeriode ? ` - ${formatPeriodeSidangLabel(selectedPeriode)}` : ""}
              </h3>
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

            <div className="relative flex-1 overflow-auto rounded-lg border border-[#e6ecf8] grid-unified-height">
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

          {selectedRegistrantId ? (
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
                    <p>Dosen Pembimbing: {selectedRegistrantDetail?.dosen_pembimbing?.nama || "-"}</p>
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

      {activeTab === "pengaturan-sidang" ? (
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
                    <div className="mt-2 flex flex-wrap gap-2">
                      <input
                        type="date"
                        min={todayDateOnly}
                        value={editDatePicker}
                        onChange={(event) => setEditDatePicker(event.target.value)}
                        className="rounded-lg border border-[#d1daf0] px-3 py-2 text-sm outline-none focus:border-[#2f63e3]"
                      />
                      <button
                        type="button"
                        onClick={addEditDate}
                        className="rounded-lg border border-[#d1daf0] px-3 py-2 text-sm font-semibold text-[#27407b] transition hover:bg-[#f3f6ff]"
                      >
                        Tambah Tanggal
                      </button>
                    </div>
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
                          {tanggal} x
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border border-[#e2e9f8] bg-white p-3">
                    <p className="text-sm font-bold text-[#233a74]">Ruangan Sidang</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <input
                        type="text"
                        value={editRoomInput}
                        onChange={(event) => setEditRoomInput(event.target.value)}
                        placeholder="Contoh: Ruang Sidang A"
                        className="flex-1 rounded-lg border border-[#d1daf0] px-3 py-2 text-sm outline-none focus:border-[#2f63e3]"
                      />
                      <button
                        type="button"
                        onClick={addEditRoom}
                        className="rounded-lg border border-[#d1daf0] px-3 py-2 text-sm font-semibold text-[#27407b] transition hover:bg-[#f3f6ff]"
                      >
                        Tambah Ruangan
                      </button>
                    </div>
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
    </div>
  );
}

export default SekretarisSidangManagementPage;
