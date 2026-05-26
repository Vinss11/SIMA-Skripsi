import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCcw, Save } from "lucide-react";

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

function buildSlotKey(tanggalSidang, sesiKe) {
  return `${tanggalSidang}#${sesiKe}`;
}

function DosenSidangKetersediaanPage({ session, apiBaseUrl, onSessionExpired }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [payload, setPayload] = useState(null);
  const [slotForm, setSlotForm] = useState({});

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

  const hydrateForm = (nextPayload) => {
    const slots = Array.isArray(nextPayload?.slots) ? nextPayload.slots : [];
    const availability = Array.isArray(nextPayload?.ketersediaan) ? nextPayload.ketersediaan : [];
    const byKey = {};
    slots.forEach((slot) => {
      const key = buildSlotKey(slot.tanggal_sidang, slot.sesi_ke);
      byKey[key] = {
        tanggal_sidang: slot.tanggal_sidang,
        sesi_ke: slot.sesi_ke,
        sesi_mulai: slot.sesi_mulai,
        sesi_selesai: slot.sesi_selesai,
        is_available: false,
        tipe_penilaian: "santai",
        kondisi_fisik: "fit",
      };
    });
    availability.forEach((item) => {
      const key = buildSlotKey(item.tanggal_sidang, item.sesi_ke);
      if (!byKey[key]) return;
      byKey[key] = {
        ...byKey[key],
        is_available: true,
        tipe_penilaian: item.tipe_penilaian || "santai",
        kondisi_fisik: item.kondisi_fisik || "fit",
      };
    });
    setSlotForm(byKey);
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const response = await fetchWithAuth("/api/dosen/sidang/ketersediaan");
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.success) {
        throw new Error(body?.message || "Gagal memuat data ketersediaan sidang.");
      }
      const nextPayload = body?.data || null;
      setPayload(nextPayload);
      hydrateForm(nextPayload);
    } catch (loadError) {
      if (loadError.message !== "__SESSION_EXPIRED__") {
        setError(loadError.message || "Gagal memuat data ketersediaan sidang.");
      }
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    loadData().catch(() => {});
  }, [loadData]);

  const slotRows = useMemo(() => {
    return Object.values(slotForm).sort((a, b) => {
      const dateCompare = String(a.tanggal_sidang).localeCompare(String(b.tanggal_sidang));
      if (dateCompare !== 0) return dateCompare;
      return Number(a.sesi_ke) - Number(b.sesi_ke);
    });
  }, [slotForm]);

  const tersediaCount = slotRows.filter((row) => row.is_available).length;
  const isPeriodeOpen = String(payload?.periode_sidang?.status || "").toLowerCase() === "open";

  const handleToggle = (key, value) => {
    setSlotForm((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        is_available: value,
      },
    }));
  };

  const handleChange = (key, field, value) => {
    setSlotForm((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value,
      },
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError("");
      const ketersediaan = Object.values(slotForm).map((row) => ({
        tanggal_sidang: row.tanggal_sidang,
        sesi_ke: row.sesi_ke,
        is_available: Boolean(row.is_available),
        tipe_penilaian: row.tipe_penilaian,
        kondisi_fisik: row.kondisi_fisik,
      }));
      const response = await fetchWithAuth("/api/dosen/sidang/ketersediaan", {
        method: "POST",
        body: JSON.stringify({
          periode_sidang_id: payload?.periode_sidang?.id || null,
          ketersediaan,
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.success) {
        throw new Error(body?.message || "Gagal menyimpan ketersediaan sidang.");
      }
      await loadData();
    } catch (saveError) {
      if (saveError.message !== "__SESSION_EXPIRED__") {
        setError(saveError.message || "Gagal menyimpan ketersediaan sidang.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {error ? (
        <div className="rounded-xl border border-[#f6d7d7] bg-[#fff2f2] p-4 text-sm font-semibold text-[#a03f3f]">
          {error}
        </div>
      ) : null}

      <section className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-[#1b274b]">Periode Sidang Aktif</h3>
            <p className="text-sm text-[#5d6c91]">
              {payload?.periode_sidang
                ? `${payload.periode_sidang.label_periode} (${payload.periode_sidang.tanggal_mulai_pendaftaran} s/d ${payload.periode_sidang.tanggal_selesai_pendaftaran})`
                : "Belum ada periode sidang open."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                loadData().catch(() => {});
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-[#d3dbef] px-3 py-2 text-sm font-semibold text-[#27407b] transition hover:bg-[#f3f6ff]"
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </button>
            <button
              type="button"
              disabled={loading || saving || !payload?.periode_sidang || !isPeriodeOpen}
              onClick={() => {
                handleSave().catch(() => {});
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-[#2f63e3] px-3 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {saving ? "Menyimpan..." : "Simpan Ketersediaan"}
            </button>
          </div>
        </div>

        {payload?.periode_sidang?.ruangan_sidang?.length ? (
          <p className="mt-3 text-sm text-[#4f5e86]">
            Ruangan sidang:{" "}
            <span className="font-semibold">{payload.periode_sidang.ruangan_sidang.join(", ")}</span>
          </p>
        ) : null}
        <p className="mt-2 text-sm text-[#4f5e86]">
          Slot tersedia yang Anda pilih: <span className="font-black text-[#1f2d53]">{tersediaCount}</span>
        </p>
        {!isPeriodeOpen && payload?.periode_sidang ? (
          <p className="mt-2 rounded-lg border border-[#f2dfb3] bg-[#fff9e9] px-3 py-2 text-sm font-semibold text-[#7a5a00]">
            Periode sidang belum berstatus open. Pengisian ketersediaan akan aktif saat periode dibuka sekretaris prodi.
          </p>
        ) : null}
      </section>

      <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
        <h3 className="text-lg font-black text-[#1b274b]">Grid Ketersediaan Penguji</h3>
        {loading ? (
          <div className="mt-4 rounded-lg border border-[#e2e9f8] bg-[#f8fbff] p-4 text-sm font-semibold text-[#60709a]">
            Memuat slot sidang...
          </div>
        ) : null}

        {!loading ? (
          <div className="relative mt-3 flex-1 overflow-auto rounded-lg border border-[#e6ecf8] grid-unified-height">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead>
                <tr className="border-y border-[#e6ecf8] text-[#4d5e89]">
                  <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Tanggal</th>
                  <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Sesi</th>
                  <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Waktu</th>
                  <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Tersedia</th>
                  <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Tipe Penilaian</th>
                  <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Kondisi Fisik</th>
                </tr>
              </thead>
              <tbody>
                {slotRows.map((row) => {
                  const key = buildSlotKey(row.tanggal_sidang, row.sesi_ke);
                  return (
                    <tr key={`slot-${key}`} className="border-b border-[#eff3fb]">
                      <td className="px-3 py-2 font-semibold text-[#1f2d53]">{formatDateLabel(row.tanggal_sidang)}</td>
                      <td className="px-3 py-2">Sesi {row.sesi_ke}</td>
                      <td className="px-3 py-2">
                        {row.sesi_mulai} - {row.sesi_selesai}
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={Boolean(row.is_available)}
                          onChange={(event) => handleToggle(key, event.target.checked)}
                          className="h-4 w-4 accent-[#2f63e3]"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={row.tipe_penilaian}
                          disabled={!row.is_available}
                          onChange={(event) => handleChange(key, "tipe_penilaian", event.target.value)}
                          className="rounded-lg border border-[#d1daf0] bg-white px-2 py-1 text-sm text-[#23386e] disabled:opacity-60"
                        >
                          <option value="santai">Santai</option>
                          <option value="ketat">Ketat</option>
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={row.kondisi_fisik}
                          disabled={!row.is_available}
                          onChange={(event) => handleChange(key, "kondisi_fisik", event.target.value)}
                          className="rounded-lg border border-[#d1daf0] bg-white px-2 py-1 text-sm text-[#23386e] disabled:opacity-60"
                        >
                          <option value="fit">Fit</option>
                          <option value="tidak_fit">Tidak Fit</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {slotRows.length === 0 ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[41px] flex items-center justify-center px-4 text-center text-sm font-semibold text-[#7b88ab]">
                Belum ada slot sidang yang bisa dipilih.
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
        <h3 className="text-lg font-black text-[#1b274b]">Jadwal Anda Sebagai Penguji</h3>
        <div className="mt-3 overflow-auto rounded-lg border border-[#e6ecf8]">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-y border-[#e6ecf8] text-[#4d5e89]">
                <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Tanggal</th>
                <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Sesi</th>
                <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Ruangan</th>
                <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Mahasiswa</th>
              </tr>
            </thead>
            <tbody>
              {(payload?.jadwal_anda || []).map((item) => (
                <tr key={`jadwal-saya-${item.id}`} className="border-b border-[#eff3fb]">
                  <td className="px-3 py-2">{formatDateLabel(item.tanggal_sidang)}</td>
                  <td className="px-3 py-2">
                    Sesi {item.sesi_ke} ({item.sesi_mulai} - {item.sesi_selesai})
                  </td>
                  <td className="px-3 py-2">{item.ruangan}</td>
                  <td className="px-3 py-2">
                    {item.mahasiswa ? `${item.mahasiswa.nama} (${item.mahasiswa.nim})` : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!payload?.jadwal_anda?.length ? (
            <p className="px-3 py-4 text-sm font-semibold text-[#7b88ab]">Belum ada jadwal sidang yang ditugaskan ke Anda.</p>
          ) : null}
        </div>
        {payload?.jadwal_anda?.length ? (
          <p className="mt-2 text-xs text-[#6e7ea6]">Terakhir sinkron: {formatDateTime(new Date().toISOString())}</p>
        ) : null}
      </section>
    </div>
  );
}

export default DosenSidangKetersediaanPage;
