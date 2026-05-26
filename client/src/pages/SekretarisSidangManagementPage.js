import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarCheck2, Plus, RefreshCcw, Save } from "lucide-react";

function formatDateLabel(value) {
  if (!value) return "-";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
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

function uniqueSorted(values) {
  return Array.from(new Set((values || []).filter(Boolean))).sort();
}

function SekretarisSidangManagementPage({ session, apiBaseUrl, onSessionExpired }) {
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [overview, setOverview] = useState({ active_periode: null, periodes: [] });
  const [selectedPeriodeId, setSelectedPeriodeId] = useState("");
  const [queueRows, setQueueRows] = useState([]);
  const [queuePeriode, setQueuePeriode] = useState(null);

  const [createForm, setCreateForm] = useState({
    label_periode: "",
    tanggal_mulai_pendaftaran: "",
    tanggal_selesai_pendaftaran: "",
    catatan: "",
    tanggal_sidang_list: [],
    ruangan_list: [],
  });
  const [datePickerValue, setDatePickerValue] = useState("");
  const [roomInput, setRoomInput] = useState("");

  const [editConfig, setEditConfig] = useState({
    label_periode: "",
    tanggal_mulai_pendaftaran: "",
    tanggal_selesai_pendaftaran: "",
    catatan: "",
    tanggal_sidang_list: [],
    ruangan_list: [],
  });
  const [editDatePicker, setEditDatePicker] = useState("");
  const [editRoomInput, setEditRoomInput] = useState("");

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
  }, [apiBaseUrl, onSessionExpired, session.token]);

  const loadOverview = useCallback(async () => {
    try {
      setLoadingOverview(true);
      setError("");
      const response = await fetchWithAuth("/api/sekretaris/sidang/periode");
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.success) {
        throw new Error(body?.message || "Gagal memuat overview sidang.");
      }
      const data = body?.data || { active_periode: null, periodes: [] };
      setOverview(data);
      if (!selectedPeriodeId) {
        const fallback =
          data?.active_periode?.id ||
          (Array.isArray(data?.periodes) && data.periodes.length > 0 ? data.periodes[0].id : "");
        setSelectedPeriodeId(fallback ? String(fallback) : "");
      }
    } catch (loadError) {
      if (loadError.message !== "__SESSION_EXPIRED__") {
        setError(loadError.message || "Gagal memuat overview sidang.");
      }
    } finally {
      setLoadingOverview(false);
    }
  }, [fetchWithAuth, selectedPeriodeId]);

  const loadQueue = useCallback(async (periodeId) => {
    if (!periodeId) {
      setQueueRows([]);
      setQueuePeriode(null);
      return;
    }
    try {
      setLoadingQueue(true);
      setError("");
      const response = await fetchWithAuth(`/api/sekretaris/sidang/queue?periode_sidang_id=${periodeId}`);
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.success) {
        throw new Error(body?.message || "Gagal memuat antrian sidang.");
      }
      const data = body?.data || {};
      setQueuePeriode(data?.periode_sidang || null);
      setQueueRows(Array.isArray(data?.rows) ? data.rows : []);
    } catch (loadError) {
      if (loadError.message !== "__SESSION_EXPIRED__") {
        setError(loadError.message || "Gagal memuat antrian sidang.");
      }
    } finally {
      setLoadingQueue(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    loadOverview().catch(() => {});
  }, [loadOverview]);

  useEffect(() => {
    if (selectedPeriodeId) {
      loadQueue(Number(selectedPeriodeId)).catch(() => {});
    }
  }, [loadQueue, selectedPeriodeId]);

  const selectedPeriode = useMemo(() => {
    const id = Number(selectedPeriodeId || 0);
    return (overview?.periodes || []).find((item) => Number(item.id) === id) || null;
  }, [overview, selectedPeriodeId]);

  useEffect(() => {
    if (!selectedPeriode) return;
    setEditConfig({
      label_periode: selectedPeriode.label_periode || "",
      tanggal_mulai_pendaftaran: selectedPeriode.tanggal_mulai_pendaftaran || "",
      tanggal_selesai_pendaftaran: selectedPeriode.tanggal_selesai_pendaftaran || "",
      catatan: selectedPeriode.catatan || "",
      tanggal_sidang_list: Array.isArray(selectedPeriode.hari_sidang) ? selectedPeriode.hari_sidang : [],
      ruangan_list: Array.isArray(selectedPeriode.ruangan_sidang) ? selectedPeriode.ruangan_sidang : [],
    });
    setEditDatePicker("");
    setEditRoomInput("");
  }, [selectedPeriode]);

  const addCreateDate = () => {
    if (!datePickerValue) return;
    setCreateForm((prev) => ({
      ...prev,
      tanggal_sidang_list: uniqueSorted([...prev.tanggal_sidang_list, datePickerValue]),
    }));
    setDatePickerValue("");
  };

  const addCreateRoom = () => {
    const clean = String(roomInput || "").trim();
    if (!clean) return;
    setCreateForm((prev) => ({
      ...prev,
      ruangan_list: uniqueSorted([...prev.ruangan_list, clean]),
    }));
    setRoomInput("");
  };

  const addEditDate = () => {
    if (!editDatePicker) return;
    setEditConfig((prev) => ({
      ...prev,
      tanggal_sidang_list: uniqueSorted([...prev.tanggal_sidang_list, editDatePicker]),
    }));
    setEditDatePicker("");
  };

  const addEditRoom = () => {
    const clean = String(editRoomInput || "").trim();
    if (!clean) return;
    setEditConfig((prev) => ({
      ...prev,
      ruangan_list: uniqueSorted([...prev.ruangan_list, clean]),
    }));
    setEditRoomInput("");
  };

  const removeFromList = (list, value) => list.filter((item) => item !== value);

  const handleCreatePeriode = async () => {
    try {
      setSaving(true);
      setError("");
      setSuccess("");
      const response = await fetchWithAuth("/api/sekretaris/sidang/periode", {
        method: "POST",
        body: JSON.stringify(createForm),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.success) {
        throw new Error(body?.message || "Gagal membuat periode sidang.");
      }
      setSuccess(body?.message || "Periode sidang berhasil dibuat.");
      setCreateForm({
        label_periode: "",
        tanggal_mulai_pendaftaran: "",
        tanggal_selesai_pendaftaran: "",
        catatan: "",
        tanggal_sidang_list: [],
        ruangan_list: [],
      });
      await loadOverview();
    } catch (actionError) {
      if (actionError.message !== "__SESSION_EXPIRED__") {
        setError(actionError.message || "Gagal membuat periode sidang.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSelectedPeriode = async () => {
    if (!selectedPeriode) return;
    try {
      setSaving(true);
      setError("");
      setSuccess("");
      const response = await fetchWithAuth(`/api/sekretaris/sidang/periode/${selectedPeriode.id}`, {
        method: "PATCH",
        body: JSON.stringify(editConfig),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.success) {
        throw new Error(body?.message || "Gagal memperbarui konfigurasi periode sidang.");
      }
      setSuccess(body?.message || "Konfigurasi periode sidang berhasil disimpan.");
      await loadOverview();
      await loadQueue(selectedPeriode.id);
    } catch (actionError) {
      if (actionError.message !== "__SESSION_EXPIRED__") {
        setError(actionError.message || "Gagal memperbarui konfigurasi periode sidang.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleOpenClose = async (action) => {
    if (!selectedPeriode) return;
    try {
      setSaving(true);
      setError("");
      setSuccess("");
      const endpoint =
        action === "open"
          ? `/api/sekretaris/sidang/periode/${selectedPeriode.id}/open`
          : `/api/sekretaris/sidang/periode/${selectedPeriode.id}/close`;
      const response = await fetchWithAuth(endpoint, {
        method: "POST",
        body: JSON.stringify({}),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.success) {
        throw new Error(body?.message || `Gagal ${action === "open" ? "membuka" : "menutup"} periode sidang.`);
      }
      setSuccess(body?.message || "Status periode sidang berhasil diperbarui.");
      await loadOverview();
      await loadQueue(selectedPeriode.id);
    } catch (actionError) {
      if (actionError.message !== "__SESSION_EXPIRED__") {
        setError(actionError.message || "Gagal memperbarui status periode sidang.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleAutoAssign = async () => {
    if (!selectedPeriode) return;
    try {
      setSaving(true);
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
      setSuccess(
        `Auto-assign selesai: ${assignedCount} terjadwal, ${unassignedCount} belum terjadwal.`
      );
      await loadQueue(selectedPeriode.id);
      await loadOverview();
    } catch (actionError) {
      if (actionError.message !== "__SESSION_EXPIRED__") {
        setError(actionError.message || "Gagal menjalankan auto-assign penguji.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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

      <section className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-black text-[#1b274b]">Buat Periode Sidang Baru</h3>
          <button
            type="button"
            onClick={() => {
              loadOverview().catch(() => {});
              if (selectedPeriodeId) {
                loadQueue(Number(selectedPeriodeId)).catch(() => {});
              }
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-[#d3dbef] px-3 py-2 text-sm font-semibold text-[#27407b] transition hover:bg-[#f3f6ff]"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          <input
            type="text"
            value={createForm.label_periode}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, label_periode: event.target.value }))}
            placeholder="Label periode sidang"
            className="rounded-lg border border-[#d1daf0] px-3 py-2 text-sm outline-none focus:border-[#2f63e3]"
          />
          <input
            type="date"
            value={createForm.tanggal_mulai_pendaftaran}
            onChange={(event) =>
              setCreateForm((prev) => ({ ...prev, tanggal_mulai_pendaftaran: event.target.value }))
            }
            className="rounded-lg border border-[#d1daf0] px-3 py-2 text-sm outline-none focus:border-[#2f63e3]"
          />
          <input
            type="date"
            value={createForm.tanggal_selesai_pendaftaran}
            onChange={(event) =>
              setCreateForm((prev) => ({ ...prev, tanggal_selesai_pendaftaran: event.target.value }))
            }
            className="rounded-lg border border-[#d1daf0] px-3 py-2 text-sm outline-none focus:border-[#2f63e3]"
          />
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              handleCreatePeriode().catch(() => {});
            }}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#2f63e3] px-3 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            {saving ? "Menyimpan..." : "Simpan Periode"}
          </button>
        </div>

        <textarea
          value={createForm.catatan}
          onChange={(event) => setCreateForm((prev) => ({ ...prev, catatan: event.target.value }))}
          rows={2}
          placeholder="Catatan (opsional)"
          className="mt-3 w-full rounded-lg border border-[#d1daf0] px-3 py-2 text-sm outline-none focus:border-[#2f63e3]"
        />

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-[#e5ebf8] bg-[#f8fbff] p-3">
            <p className="text-sm font-bold text-[#233a74]">Hari Sidang (klik per tanggal)</p>
            <div className="mt-2 flex gap-2">
              <input
                type="date"
                value={datePickerValue}
                onChange={(event) => setDatePickerValue(event.target.value)}
                className="rounded-lg border border-[#d1daf0] px-3 py-2 text-sm outline-none focus:border-[#2f63e3]"
              />
              <button
                type="button"
                onClick={addCreateDate}
                className="rounded-lg border border-[#d1daf0] px-3 py-2 text-sm font-semibold text-[#27407b] hover:bg-white"
              >
                Tambah
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {createForm.tanggal_sidang_list.map((tanggal) => (
                <button
                  key={`create-tanggal-${tanggal}`}
                  type="button"
                  onClick={() =>
                    setCreateForm((prev) => ({
                      ...prev,
                      tanggal_sidang_list: removeFromList(prev.tanggal_sidang_list, tanggal),
                    }))
                  }
                  className="rounded-full border border-[#c9d7f5] bg-white px-3 py-1 text-xs font-semibold text-[#2c4ca0]"
                >
                  {tanggal} x
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-[#e5ebf8] bg-[#f8fbff] p-3">
            <p className="text-sm font-bold text-[#233a74]">Ruangan Sidang</p>
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={roomInput}
                onChange={(event) => setRoomInput(event.target.value)}
                placeholder="Contoh: Lab 2.14"
                className="flex-1 rounded-lg border border-[#d1daf0] px-3 py-2 text-sm outline-none focus:border-[#2f63e3]"
              />
              <button
                type="button"
                onClick={addCreateRoom}
                className="rounded-lg border border-[#d1daf0] px-3 py-2 text-sm font-semibold text-[#27407b] hover:bg-white"
              >
                Tambah
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {createForm.ruangan_list.map((room) => (
                <button
                  key={`create-room-${room}`}
                  type="button"
                  onClick={() =>
                    setCreateForm((prev) => ({
                      ...prev,
                      ruangan_list: removeFromList(prev.ruangan_list, room),
                    }))
                  }
                  className="rounded-full border border-[#c9d7f5] bg-white px-3 py-1 text-xs font-semibold text-[#2c4ca0]"
                >
                  {room} x
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-black text-[#1b274b]">Periode Sidang Tersedia</h3>
          {loadingOverview ? <span className="text-sm font-semibold text-[#6f7ea6]">Memuat...</span> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(overview?.periodes || []).map((item) => (
            <button
              key={`periode-${item.id}`}
              type="button"
              onClick={() => setSelectedPeriodeId(String(item.id))}
              className={`rounded-full border px-3 py-1 text-xs font-bold ${
                String(selectedPeriodeId) === String(item.id)
                  ? "border-[#2f63e3] bg-[#2f63e3] text-white"
                  : "border-[#cfd8ef] bg-white text-[#2f4477]"
              }`}
            >
              {item.label_periode} ({item.status})
            </button>
          ))}
        </div>

        {selectedPeriode ? (
          <div className="mt-4 space-y-3 rounded-lg border border-[#e5ebf8] bg-[#f8fbff] p-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
              <input
                type="text"
                value={editConfig.label_periode}
                onChange={(event) => setEditConfig((prev) => ({ ...prev, label_periode: event.target.value }))}
                className="rounded-lg border border-[#d1daf0] px-3 py-2 text-sm outline-none focus:border-[#2f63e3]"
              />
              <input
                type="date"
                value={editConfig.tanggal_mulai_pendaftaran}
                onChange={(event) =>
                  setEditConfig((prev) => ({ ...prev, tanggal_mulai_pendaftaran: event.target.value }))
                }
                className="rounded-lg border border-[#d1daf0] px-3 py-2 text-sm outline-none focus:border-[#2f63e3]"
              />
              <input
                type="date"
                value={editConfig.tanggal_selesai_pendaftaran}
                onChange={(event) =>
                  setEditConfig((prev) => ({ ...prev, tanggal_selesai_pendaftaran: event.target.value }))
                }
                className="rounded-lg border border-[#d1daf0] px-3 py-2 text-sm outline-none focus:border-[#2f63e3]"
              />
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  handleSaveSelectedPeriode().catch(() => {});
                }}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#d1daf0] bg-white px-3 py-2 text-sm font-semibold text-[#2b3f73] hover:bg-[#f1f5ff] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                Simpan Konfigurasi
              </button>
            </div>

            <textarea
              value={editConfig.catatan}
              onChange={(event) => setEditConfig((prev) => ({ ...prev, catatan: event.target.value }))}
              rows={2}
              className="w-full rounded-lg border border-[#d1daf0] px-3 py-2 text-sm outline-none focus:border-[#2f63e3]"
              placeholder="Catatan periode"
            />

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <p className="text-sm font-bold text-[#233a74]">Hari Sidang</p>
                <div className="mt-2 flex gap-2">
                  <input
                    type="date"
                    value={editDatePicker}
                    onChange={(event) => setEditDatePicker(event.target.value)}
                    className="rounded-lg border border-[#d1daf0] px-3 py-2 text-sm outline-none focus:border-[#2f63e3]"
                  />
                  <button
                    type="button"
                    onClick={addEditDate}
                    className="rounded-lg border border-[#d1daf0] px-3 py-2 text-sm font-semibold text-[#27407b] hover:bg-white"
                  >
                    Tambah
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {editConfig.tanggal_sidang_list.map((tanggal) => (
                    <button
                      key={`edit-tanggal-${tanggal}`}
                      type="button"
                      onClick={() =>
                        setEditConfig((prev) => ({
                          ...prev,
                          tanggal_sidang_list: removeFromList(prev.tanggal_sidang_list, tanggal),
                        }))
                      }
                      className="rounded-full border border-[#c9d7f5] bg-white px-3 py-1 text-xs font-semibold text-[#2c4ca0]"
                    >
                      {tanggal} x
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-bold text-[#233a74]">Ruangan Sidang</p>
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={editRoomInput}
                    onChange={(event) => setEditRoomInput(event.target.value)}
                    placeholder="Contoh: Ruang Dosen 2.14"
                    className="flex-1 rounded-lg border border-[#d1daf0] px-3 py-2 text-sm outline-none focus:border-[#2f63e3]"
                  />
                  <button
                    type="button"
                    onClick={addEditRoom}
                    className="rounded-lg border border-[#d1daf0] px-3 py-2 text-sm font-semibold text-[#27407b] hover:bg-white"
                  >
                    Tambah
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {editConfig.ruangan_list.map((room) => (
                    <button
                      key={`edit-room-${room}`}
                      type="button"
                      onClick={() =>
                        setEditConfig((prev) => ({
                          ...prev,
                          ruangan_list: removeFromList(prev.ruangan_list, room),
                        }))
                      }
                      className="rounded-full border border-[#c9d7f5] bg-white px-3 py-1 text-xs font-semibold text-[#2c4ca0]"
                    >
                      {room} x
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={saving || selectedPeriode.status === "open"}
                onClick={() => {
                  handleOpenClose("open").catch(() => {});
                }}
                className="rounded-lg bg-[#137748] px-3 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Buka Periode
              </button>
              <button
                type="button"
                disabled={saving || selectedPeriode.status === "closed"}
                onClick={() => {
                  handleOpenClose("close").catch(() => {});
                }}
                className="rounded-lg bg-[#b73a3a] px-3 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Tutup Periode
              </button>
              <button
                type="button"
                disabled={saving}
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
        ) : null}
      </section>

      <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
        <h3 className="text-lg font-black text-[#1b274b]">
          Antrian Pendaftaran Sidang
          {queuePeriode ? ` - ${queuePeriode.label_periode}` : ""}
        </h3>
        {loadingQueue ? (
          <div className="mt-3 rounded-lg border border-[#e2e9f8] bg-[#f8fbff] p-4 text-sm font-semibold text-[#60709a]">
            Memuat antrian sidang...
          </div>
        ) : null}

        {!loadingQueue ? (
          <div className="relative mt-3 flex-1 overflow-auto rounded-lg border border-[#e6ecf8] grid-unified-height">
            <table className="w-full min-w-[1260px] text-left text-sm">
              <thead>
                <tr className="border-y border-[#e6ecf8] text-[#4d5e89]">
                  <th className="bg-[#f8fbff] px-3 py-2 font-semibold">No</th>
                  <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Mahasiswa</th>
                  <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Dosen Pembimbing</th>
                  <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Status</th>
                  <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Tanggal Daftar</th>
                  <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Jadwal Sidang</th>
                  <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Penguji</th>
                </tr>
              </thead>
              <tbody>
                {queueRows.map((row, index) => (
                  <tr key={`queue-${row.id}`} className="border-b border-[#eff3fb]">
                    <td className="px-3 py-2 font-semibold text-[#254080]">{index + 1}</td>
                    <td className="px-3 py-2">
                      <p className="font-semibold text-[#1f2d53]">
                        {row?.mahasiswa?.nama || "-"} ({row?.mahasiswa?.nim || "-"})
                      </p>
                      <p className="text-xs text-[#61709b]">Angkatan {row?.mahasiswa?.angkatan || "-"}</p>
                    </td>
                    <td className="px-3 py-2">{row?.dosen_pembimbing?.nama || "-"}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${
                          row.status === "scheduled"
                            ? "bg-[#dff3ec] text-[#106d45]"
                            : row.status === "cancelled"
                            ? "bg-[#ffe9e9] text-[#b73a3a]"
                            : "bg-[#fdf1d4] text-[#a06a00]"
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-3 py-2">{formatDateTime(row.registered_at)}</td>
                    <td className="px-3 py-2">
                      {row?.jadwal_sidang
                        ? `${formatDateLabel(row.jadwal_sidang.tanggal_sidang)} | Sesi ${row.jadwal_sidang.sesi_ke} (${row.jadwal_sidang.sesi_mulai}-${row.jadwal_sidang.sesi_selesai}) | ${row.jadwal_sidang.ruangan}`
                        : "-"}
                    </td>
                    <td className="px-3 py-2">
                      {row?.jadwal_sidang
                        ? `${row.jadwal_sidang?.penguji1?.nama || "-"} & ${row.jadwal_sidang?.penguji2?.nama || "-"}`
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!queueRows.length ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[41px] flex items-center justify-center px-4 text-center text-sm font-semibold text-[#7b88ab]">
                Belum ada pendaftaran sidang pada periode ini.
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}

export default SekretarisSidangManagementPage;
