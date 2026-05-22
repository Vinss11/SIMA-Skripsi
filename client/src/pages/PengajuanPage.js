import React, { useEffect, useMemo, useState } from "react";
import { FileEdit, Info, Lightbulb, RotateCcw, Search, Send } from "lucide-react";
import Swal from "sweetalert2";

const MAGANG_PROPOSED_POSITION_OPTIONS = [
  "analyst",
  "designer",
  "programmer",
  "tester",
  "network engineer",
  "data scientist",
  "other",
];

const MAGANG_COMPANY_SECTOR_OPTIONS = [
  "it industry",
  "goverment",
  "education/school",
  "economy/financial",
  "other",
];

const MAGANG_NON_PARTNER_OPTION_LABEL = "Other (Non partner Company)";

const MAGANG_COMPANY_TYPE_OPTIONS = [
  { value: "partner_company", label: "Partner Company (name listed in the options above)" },
  { value: "non_partner_company", label: "Non partner Company (name not listed above)" },
];

const MAGANG_APPLICATION_METHOD_OPTIONS = [
  "via Internship Vacancy",
  "Independent (no vacancy/via Direct Contact)",
  "other",
];

function formatJalurLabel(value) {
  if (!value) return "-";
  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function isHttpUrl(value) {
  if (!value) return false;
  try {
    const parsed = new URL(String(value));
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (error) {
    return false;
  }
}

function statusBadge(item) {
  if (item?.is_available) {
    return {
      label: "Tersedia",
      className: "bg-[#e8f8ef] text-[#157a46]",
    };
  }

  if (item?.status === "taken") {
    return {
      label: "Sudah Diambil",
      className: "bg-[#fff0f0] text-[#b33b3b]",
    };
  }

  if (item?.status === "reserved") {
    return {
      label: "Reserved",
      className: "bg-[#fff7e7] text-[#a46b00]",
    };
  }

  return {
    label: "Tidak Tersedia",
    className: "bg-[#edf0f7] text-[#5f6b88]",
  };
}

function formatCluster(value) {
  if (!value) return "-";
  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function PengajuanTypeSelector({ selectedType, onTypeChange, disabled }) {
  return (
    <div className="rounded-xl border border-[#e4e9f6] bg-white p-6 shadow-sm">
      <h2 className="mb-2 text-xl font-black text-[#1b274b]">Pilih Jenis Pengajuan Penelitian</h2>
      <p className="mb-4 text-sm text-[#5d6c91]">
        Anda dapat memilih judul yang disediakan dosen atau mengajukan judul sendiri.
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onTypeChange("dosen")}
          className={`flex items-start gap-3 rounded-lg border-2 p-4 text-left transition-all ${
            selectedType === "dosen"
              ? "border-[#2f63e3] bg-[#edf3ff]"
              : "border-[#e1e7f3] hover:border-[#9cb7f5]"
          } ${disabled ? "cursor-not-allowed opacity-55" : ""}`}
        >
          <FileEdit className="mt-1 h-5 w-5 text-[#2f63e3]" />
          <div>
            <h3 className="font-bold text-[#1b274b]">Judul dari Dosen</h3>
            <p className="text-sm text-[#5d6c91]">
              Pilih dari daftar judul yang sudah disediakan oleh dosen pembimbing.
            </p>
          </div>
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={() => onTypeChange("sendiri")}
          className={`flex items-start gap-3 rounded-lg border-2 p-4 text-left transition-all ${
            selectedType === "sendiri"
              ? "border-[#2f63e3] bg-[#edf3ff]"
              : "border-[#e1e7f3] hover:border-[#9cb7f5]"
          } ${disabled ? "cursor-not-allowed opacity-55" : ""}`}
        >
          <Lightbulb className="mt-1 h-5 w-5 text-[#2f63e3]" />
          <div>
            <h3 className="font-bold text-[#1b274b]">Judul Sendiri</h3>
            <p className="text-sm text-[#5d6c91]">
              Ajukan judul penelitian yang Anda susun sendiri sesuai bidang minat.
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}

function FormJudulDosen({ session, apiBaseUrl, onSessionExpired, onSubmitted, disabled }) {
  const [loadingTopik, setLoadingTopik] = useState(true);
  const [topikError, setTopikError] = useState("");
  const [topikRows, setTopikRows] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCodes, setSelectedCodes] = useState({
    topik_1_kode: "",
    topik_2_kode: "",
    topik_3_kode: "",
  });
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");

  useEffect(() => {
    let isMounted = true;

    const fetchTopik = async () => {
      setLoadingTopik(true);
      setTopikError("");

      try {
        const response = await fetch(`${apiBaseUrl}/api/topics`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${session.token}`,
            "Content-Type": "application/json",
          },
        });

        const payload = await response.json().catch(() => null);
        const message = String(payload?.message || "").toLowerCase();
        const tokenError =
          message.includes("token tidak valid") ||
          message.includes("token tidak ditemukan") ||
          message.includes("kadaluarsa");

        if (response.status === 401 || (response.status === 403 && tokenError)) {
          onSessionExpired?.();
          return;
        }

        if (!response.ok || !payload?.success) {
          throw new Error(payload?.message || "Gagal memuat daftar topik.");
        }

        if (!isMounted) return;
        setTopikRows(Array.isArray(payload.data) ? payload.data : []);
      } catch (error) {
        if (!isMounted) return;
        setTopikRows([]);
        setTopikError(error.message || "Gagal memuat daftar topik.");
      } finally {
        if (isMounted) setLoadingTopik(false);
      }
    };

    fetchTopik();

    return () => {
      isMounted = false;
    };
  }, [apiBaseUrl, onSessionExpired, session.token]);

  const filteredTopik = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    if (!keyword) return topikRows;

    return topikRows.filter((item) => {
      const haystack = [item.kode, item.judul, item.cluster, item.dosen?.nama, item.dosen?.nik]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(keyword);
    });
  }, [topikRows, searchQuery]);

  const availableTopik = useMemo(() => topikRows.filter((item) => item?.is_available), [topikRows]);

  const topikByKode = useMemo(() => {
    const map = {};
    topikRows.forEach((item) => {
      if (item?.kode) map[item.kode] = item;
    });
    return map;
  }, [topikRows]);

  const selectedList = useMemo(() => {
    const ordered = [
      { slot: 1, kode: selectedCodes.topik_1_kode },
      { slot: 2, kode: selectedCodes.topik_2_kode },
      { slot: 3, kode: selectedCodes.topik_3_kode },
    ];

    return ordered
      .filter((item) => item.kode)
      .map((item) => ({
        slot: item.slot,
        ...topikByKode[item.kode],
      }))
      .filter((item) => item?.kode);
  }, [selectedCodes.topik_1_kode, selectedCodes.topik_2_kode, selectedCodes.topik_3_kode, topikByKode]);

  const duplicateCodes = useMemo(() => {
    const entries = [selectedCodes.topik_1_kode, selectedCodes.topik_2_kode, selectedCodes.topik_3_kode].filter(Boolean);
    return entries.length !== new Set(entries).size;
  }, [selectedCodes.topik_1_kode, selectedCodes.topik_2_kode, selectedCodes.topik_3_kode]);

  const canSubmit = Boolean(selectedCodes.topik_1_kode) && !duplicateCodes && !submitLoading && !disabled;
  const isTopik2Enabled = Boolean(selectedCodes.topik_1_kode) && !disabled;
  const isTopik3Enabled = Boolean(selectedCodes.topik_1_kode && selectedCodes.topik_2_kode) && !disabled;

  const optionListForSlot = (slotNumber) => {
    const selectedElsewhere = new Set(
      [1, 2, 3]
        .filter((slot) => slot !== slotNumber)
        .map((slot) => selectedCodes[`topik_${slot}_kode`])
        .filter(Boolean)
    );
    return availableTopik.filter((item) => !selectedElsewhere.has(item.kode));
  };

  const handleSelectChange = (field, value) => {
    setSelectedCodes((prev) => {
      if (field === "topik_1_kode") {
        const next = { ...prev, topik_1_kode: value };
        if (!value) {
          next.topik_2_kode = "";
          next.topik_3_kode = "";
          return next;
        }
        if (next.topik_2_kode === value) {
          next.topik_2_kode = "";
          next.topik_3_kode = "";
          return next;
        }
        if (next.topik_3_kode === value) {
          next.topik_3_kode = "";
        }
        if (!next.topik_2_kode) {
          next.topik_3_kode = "";
        }
        return next;
      }

      if (field === "topik_2_kode") {
        const next = { ...prev, topik_2_kode: value };
        if (!prev.topik_1_kode) {
          next.topik_2_kode = "";
          next.topik_3_kode = "";
          return next;
        }
        if (!value || value === prev.topik_1_kode) {
          next.topik_2_kode = "";
          next.topik_3_kode = "";
          return next;
        }
        if (next.topik_3_kode === value) {
          next.topik_3_kode = "";
        }
        return next;
      }

      if (field === "topik_3_kode") {
        if (!prev.topik_1_kode || !prev.topik_2_kode) {
          return {
            ...prev,
            topik_3_kode: "",
          };
        }
      }

      return { ...prev, [field]: value };
    });
    setSubmitError("");
    setSubmitSuccess("");
  };

  const handleReset = () => {
    setSelectedCodes({
      topik_1_kode: "",
      topik_2_kode: "",
      topik_3_kode: "",
    });
    setSubmitError("");
    setSubmitSuccess("");
  };

  const handleSubmitTopik = async () => {
    if (disabled) return;
    if (!selectedCodes.topik_1_kode) {
      setSubmitError("Minimal pilih 1 topik di pilihan pertama.");
      return;
    }
    if (duplicateCodes) {
      setSubmitError("Pilihan topik tidak boleh duplikat.");
      return;
    }

    const unavailableChoice = selectedList.find((item) => !item?.is_available);
    if (unavailableChoice) {
      setSubmitError(`Topik ${unavailableChoice.kode} sudah tidak tersedia. Silakan pilih topik lain.`);
      return;
    }

    const ringkasanPilihan = selectedList.map((item) => `Pilihan ${item.slot}: ${item.kode} - ${item.judul}`).join("<br/>");
    const confirm = await Swal.fire({
      title: "Konfirmasi Pengajuan Topik",
      html: `<div style="text-align:left">${ringkasanPilihan}</div>`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Ya, Ajukan",
      cancelButtonText: "Batal",
      confirmButtonColor: "#2f63e3",
    });
    if (!confirm.isConfirmed) return;

    setSubmitLoading(true);
    setSubmitError("");
    setSubmitSuccess("");

    const payload = {
      topik_1_kode: selectedCodes.topik_1_kode,
    };
    if (selectedCodes.topik_2_kode) payload.topik_2_kode = selectedCodes.topik_2_kode;
    if (selectedCodes.topik_3_kode) payload.topik_3_kode = selectedCodes.topik_3_kode;

    try {
      const response = await fetch(`${apiBaseUrl}/api/jalur/baru/topik-dosen`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => null);
      const message = String(data?.message || "").toLowerCase();
      const tokenError =
        message.includes("token tidak valid") ||
        message.includes("token tidak ditemukan") ||
        message.includes("kadaluarsa");

      if (response.status === 401 || (response.status === 403 && tokenError)) {
        onSessionExpired?.();
        return;
      }

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Pengajuan topik dosen gagal.");
      }

      setSubmitSuccess(data.message || "Pengajuan topik dosen berhasil dikirim.");
      setSelectedCodes({
        topik_1_kode: "",
        topik_2_kode: "",
        topik_3_kode: "",
      });
      onSubmitted?.();
    } catch (error) {
      setSubmitError(error.message || "Pengajuan topik dosen gagal.");
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-[#1b274b]">Grid Daftar Judul dari Dosen</h2>
            <p className="text-sm text-[#5d6c91]">
              Daftar referensi topik. Pemilihan dilakukan di form bawah (minimal 1, maksimal 3 topik).
            </p>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7282a8]" />
            <input
              type="text"
              placeholder="Cari kode, judul, bidang, dosen..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-[340px] rounded-lg border border-[#d3dbef] py-2 pl-8 pr-3 text-sm outline-none focus:border-[#2f63e3]"
            />
          </div>
        </div>

        <div className="relative h-[430px] overflow-auto rounded-lg border border-[#e6ecf8]">
          <table className="min-w-[1200px] text-left text-sm">
            <thead>
              <tr className="border-y border-[#e6ecf8] text-[#4d5e89]">
                <th className="bg-[#f8fbff] px-3 py-2 font-semibold">No</th>
                <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Kode Topik</th>
                <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Judul</th>
                <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Bidang</th>
                <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Dosen</th>
                <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Kuota</th>
                <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {!loadingTopik && filteredTopik.length > 0
                ? filteredTopik.map((item, index) => {
                    const badge = statusBadge(item);
                    const kuotaDosen = item.kuota_dosen || {};
                    return (
                      <tr key={`topik-${item.id || item.kode}`} className="border-b border-[#eff3fb]">
                        <td className="px-3 py-2">{index + 1}</td>
                        <td className="px-3 py-2 font-semibold text-[#254080]">{item.kode || "-"}</td>
                        <td className="px-3 py-2">
                          <p className="font-semibold text-[#1f2d53]">{item.judul || "-"}</p>
                          <p className="text-xs text-[#6c7a9f]">{item.deskripsi || "-"}</p>
                        </td>
                        <td className="px-3 py-2">{formatCluster(item.cluster)}</td>
                        <td className="px-3 py-2">{item.dosen?.nama || "-"}</td>
                        <td className="px-3 py-2">
                          {kuotaDosen.terpakai ?? 0}/{kuotaDosen.total ?? 0}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`rounded-full px-2 py-1 text-xs font-bold ${badge.className}`}>
                            {badge.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                : null}
            </tbody>
          </table>

          {loadingTopik ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[41px] flex items-center justify-center px-4 text-center text-sm font-semibold text-[#7b88ab]">
              Memuat daftar topik...
            </div>
          ) : null}
          {!loadingTopik && filteredTopik.length === 0 ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[41px] flex items-center justify-center px-4 text-center text-sm font-semibold text-[#7b88ab]">
              Data topik tidak ditemukan.
            </div>
          ) : null}
        </div>

        {topikError ? (
          <div className="mt-3 rounded-lg border border-[#f5d0d0] bg-[#fff2f2] px-3 py-2 text-sm font-semibold text-[#a03f3f]">
            {topikError}
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-[#e4e9f6] bg-white p-6 shadow-sm">
        <h2 className="mb-2 text-lg font-black text-[#1b274b]">Form Pemilihan Topik (1-3 Topik)</h2>
        <p className="mb-4 text-sm text-[#5d6c91]">Pilih minimal 1 topik. Pilihan tidak boleh duplikat.</p>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-semibold text-[#324c86]">Topik Pilihan 1 (Wajib)</label>
            <select
              value={selectedCodes.topik_1_kode}
              onChange={(event) => handleSelectChange("topik_1_kode", event.target.value)}
              disabled={disabled}
              className={`w-full rounded-lg border border-[#d0dbf4] px-3 py-2 text-sm outline-none ${
                disabled ? "cursor-not-allowed bg-[#f3f5fb] text-[#8b97b6]" : "focus:border-[#2f63e3] focus:ring-2 focus:ring-[#2f63e3]/20"
              }`}
            >
              <option value="">Pilih topik 1</option>
              {optionListForSlot(1).map((item) => (
                <option key={`slot-1-${item.kode}`} value={item.kode}>
                  {item.kode} - {item.judul}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-[#324c86]">Topik Pilihan 2 (Opsional)</label>
            <select
              value={selectedCodes.topik_2_kode}
              onChange={(event) => handleSelectChange("topik_2_kode", event.target.value)}
              disabled={!isTopik2Enabled}
              className={`w-full rounded-lg border border-[#d0dbf4] px-3 py-2 text-sm outline-none ${
                isTopik2Enabled ? "focus:border-[#2f63e3] focus:ring-2 focus:ring-[#2f63e3]/20" : "cursor-not-allowed bg-[#f3f5fb] text-[#8b97b6]"
              }`}
            >
              <option value="">Pilih topik 2</option>
              {optionListForSlot(2).map((item) => (
                <option key={`slot-2-${item.kode}`} value={item.kode}>
                  {item.kode} - {item.judul}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-[#324c86]">Topik Pilihan 3 (Opsional)</label>
            <select
              value={selectedCodes.topik_3_kode}
              onChange={(event) => handleSelectChange("topik_3_kode", event.target.value)}
              disabled={!isTopik3Enabled}
              className={`w-full rounded-lg border border-[#d0dbf4] px-3 py-2 text-sm outline-none ${
                isTopik3Enabled ? "focus:border-[#2f63e3] focus:ring-2 focus:ring-[#2f63e3]/20" : "cursor-not-allowed bg-[#f3f5fb] text-[#8b97b6]"
              }`}
            >
              <option value="">Pilih topik 3</option>
              {optionListForSlot(3).map((item) => (
                <option key={`slot-3-${item.kode}`} value={item.kode}>
                  {item.kode} - {item.judul}
                </option>
              ))}
            </select>
          </div>
        </div>

        {duplicateCodes ? (
          <div className="mt-4 rounded-lg border border-[#f5d0d0] bg-[#fff2f2] px-3 py-2 text-sm font-semibold text-[#a03f3f]">
            Pilihan topik tidak boleh sama.
          </div>
        ) : null}

        <div className="mt-6 rounded-lg border border-[#e8edf8] bg-[#f8fbff] p-4">
          <h3 className="text-sm font-black text-[#1b274b]">Detail Pengajuan</h3>
          {selectedList.length > 0 ? (
            <div className="mt-3 space-y-3">
              {selectedList.map((item) => (
                <div key={`detail-${item.slot}-${item.kode}`} className="rounded-lg border border-[#dde5f7] bg-white px-3 py-2">
                  <p className="text-xs font-bold text-[#5c6a91]">Pilihan {item.slot}</p>
                  <p className="text-sm font-bold text-[#1f2d53]">
                    {item.kode} - {item.judul}
                  </p>
                  <p className="text-xs text-[#62719a]">
                    Bidang: {formatCluster(item.cluster)} | Dosen: {item.dosen?.nama || "-"}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-[#5d6c91]">Belum ada topik yang dipilih.</p>
          )}
        </div>

        {submitError ? (
          <div className="mt-4 rounded-lg border border-[#f5d0d0] bg-[#fff2f2] px-3 py-2 text-sm font-semibold text-[#a03f3f]">
            {submitError}
          </div>
        ) : null}
        {submitSuccess ? (
          <div className="mt-4 rounded-lg border border-[#d2efdf] bg-[#effcf5] px-3 py-2 text-sm font-semibold text-[#1b7a49]">
            {submitSuccess}
          </div>
        ) : null}

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={handleReset}
            disabled={disabled}
            className={`inline-flex items-center gap-2 rounded-lg border border-[#d1daf0] px-5 py-2 text-sm font-semibold transition ${
              disabled ? "cursor-not-allowed bg-[#f5f7fb] text-[#7f8aac]" : "text-[#314778] hover:bg-[#f4f7ff]"
            }`}
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>
          <button
            type="button"
            onClick={handleSubmitTopik}
            disabled={!canSubmit}
            className={`inline-flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-bold transition ${
              canSubmit ? "bg-[#2f63e3] text-white hover:brightness-110" : "cursor-not-allowed bg-[#d5dbea] text-[#7a86a5]"
            }`}
          >
            <Send className="h-4 w-4" />
            {submitLoading ? "Mengirim..." : "Ajukan Topik Dosen"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FormJudulSendiri() {
  return (
    <div className="rounded-xl border border-[#e4e9f6] bg-white p-6 shadow-sm">
      <h2 className="mb-2 text-lg font-black text-[#1b274b]">Pengajuan Judul Mandiri</h2>
      <div className="rounded-lg border border-[#e0e8fa] bg-[#f7faff] px-4 py-3 text-sm font-semibold text-[#435784]">
        Form judul mandiri masih di-hold. Untuk sementara gunakan opsi <b>Judul dari Dosen</b> terlebih dahulu.
      </div>
    </div>
  );
}

function FormNonPenelitianGeneric({
  jalur,
  jalurLabel,
  session,
  apiBaseUrl,
  onSessionExpired,
  onSubmitted,
  disabled,
}) {
  const [ringkasan, setRingkasan] = useState("");
  const [catatan, setCatatan] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");

  const handleSubmit = async () => {
    if (disabled) return;
    if (!ringkasan.trim()) {
      setSubmitError("Ringkasan pengajuan wajib diisi.");
      return;
    }

    const confirm = await Swal.fire({
      title: `Konfirmasi Form ${jalurLabel}`,
      text: "Pastikan data sudah benar sebelum dikirim.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Ya, Kirim",
      cancelButtonText: "Batal",
      confirmButtonColor: "#2f63e3",
    });
    if (!confirm.isConfirmed) return;

    setSubmitLoading(true);
    setSubmitError("");
    setSubmitSuccess("");

    try {
      const response = await fetch(`${apiBaseUrl}/api/jalur/non-penelitian/submit`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jalur,
          payload: {
            ringkasan: ringkasan.trim(),
            catatan: catatan.trim(),
          },
        }),
      });

      const data = await response.json().catch(() => null);
      const message = String(data?.message || "").toLowerCase();
      const tokenError =
        message.includes("token tidak valid") ||
        message.includes("token tidak ditemukan") ||
        message.includes("kadaluarsa");

      if (response.status === 401 || (response.status === 403 && tokenError)) {
        onSessionExpired?.();
        return;
      }

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Submit form jalur gagal.");
      }

      setSubmitSuccess(data.message || `Form ${jalurLabel} berhasil dikirim.`);
      setRingkasan("");
      setCatatan("");
      onSubmitted?.();
    } catch (error) {
      setSubmitError(error.message || "Submit form jalur gagal.");
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-[#e4e9f6] bg-white p-6 shadow-sm">
      <h2 className="mb-2 text-xl font-black text-[#1b274b]">Form Pengajuan {jalurLabel}</h2>
      <p className="mb-4 text-sm text-[#5d6c91]">Isi ringkasan pengajuan sesuai jalur {jalurLabel}.</p>

      <div className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-semibold text-[#324c86]">Ringkasan Pengajuan *</label>
          <textarea
            rows={4}
            value={ringkasan}
            onChange={(event) => setRingkasan(event.target.value)}
            disabled={disabled}
            className={`w-full rounded-lg border border-[#d0dbf4] px-3 py-2 text-sm outline-none ${
              disabled ? "cursor-not-allowed bg-[#f3f5fb] text-[#8b97b6]" : "focus:border-[#2f63e3] focus:ring-2 focus:ring-[#2f63e3]/20"
            }`}
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-[#324c86]">Catatan (opsional)</label>
          <textarea
            rows={3}
            value={catatan}
            onChange={(event) => setCatatan(event.target.value)}
            disabled={disabled}
            className={`w-full rounded-lg border border-[#d0dbf4] px-3 py-2 text-sm outline-none ${
              disabled ? "cursor-not-allowed bg-[#f3f5fb] text-[#8b97b6]" : "focus:border-[#2f63e3] focus:ring-2 focus:ring-[#2f63e3]/20"
            }`}
          />
        </div>

        {submitError ? (
          <div className="rounded-lg border border-[#f5d0d0] bg-[#fff2f2] px-3 py-2 text-sm font-semibold text-[#a03f3f]">
            {submitError}
          </div>
        ) : null}
        {submitSuccess ? (
          <div className="rounded-lg border border-[#d2efdf] bg-[#effcf5] px-3 py-2 text-sm font-semibold text-[#1b7a49]">
            {submitSuccess}
          </div>
        ) : null}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => {
              setRingkasan("");
              setCatatan("");
              setSubmitError("");
              setSubmitSuccess("");
            }}
            disabled={disabled}
            className={`inline-flex items-center gap-2 rounded-lg border border-[#d1daf0] px-5 py-2 text-sm font-semibold transition ${
              disabled ? "cursor-not-allowed bg-[#f5f7fb] text-[#7f8aac]" : "text-[#314778] hover:bg-[#f4f7ff]"
            }`}
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={disabled || submitLoading}
            className={`inline-flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-bold transition ${
              disabled || submitLoading
                ? "cursor-not-allowed bg-[#d5dbea] text-[#7a86a5]"
                : "bg-[#2f63e3] text-white hover:brightness-110"
            }`}
          >
            <Send className="h-4 w-4" />
            {submitLoading ? "Mengirim..." : "Kirim Form"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FormSuratRekomendasiMagang({
  session,
  apiBaseUrl,
  onSessionExpired,
  onSubmitted,
  studentProfile,
  disabled,
}) {
  const [formData, setFormData] = useState({
    phone_number: "",
    proposed_position: "",
    proposed_position_other: "",
    company_sector: "",
    company_sector_other: "",
    chosen_institution: "",
    complete_address_of_institution: "",
    company_type: "",
    sudah_apply_ke_mitra: null,
    tanggal_apply: "",
    metode_apply: "",
    bukti_apply: "",
    internship_company_website_url: "",
    internship_vacancy_url: "",
    supporting_documents_note: "",
    cv_file_name: "",
    portfolio_file_name: "",
    transcript_file_name: "",
    other_supporting_documents_file_name: "",
    company_name: "",
    year_of_establishment: "",
    number_of_employees: "",
    internship_application_method: "",
    internship_application_method_other: "",
    selection_processes_text: "",
  });
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");
  const [mitraMagangOptions, setMitraMagangOptions] = useState([]);
  const [loadingMitraOptions, setLoadingMitraOptions] = useState(false);
  const [mitraOptionsError, setMitraOptionsError] = useState("");

  const isNonPartner = formData.company_type === "non_partner_company";
  const partnerInstitutionOptions = useMemo(
    () => mitraMagangOptions.map((item) => String(item?.nama || "").trim()).filter(Boolean),
    [mitraMagangOptions]
  );

  useEffect(() => {
    let isMounted = true;

    const fetchMitraMagangOptions = async () => {
      setLoadingMitraOptions(true);
      setMitraOptionsError("");

      try {
        const response = await fetch(`${apiBaseUrl}/api/jalur/non-penelitian/magang/mitra`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${session.token}`,
            "Content-Type": "application/json",
          },
        });

        const payload = await response.json().catch(() => null);
        const message = String(payload?.message || "").toLowerCase();
        const tokenError =
          message.includes("token tidak valid") ||
          message.includes("token tidak ditemukan") ||
          message.includes("kadaluarsa");

        if (response.status === 401 || (response.status === 403 && tokenError)) {
          onSessionExpired?.();
          return;
        }

        if (!response.ok || !payload?.success) {
          throw new Error(payload?.message || "Gagal memuat data mitra magang.");
        }

        if (!isMounted) return;
        const options = Array.isArray(payload?.data?.options) ? payload.data.options : [];
        setMitraMagangOptions(options);
      } catch (error) {
        if (!isMounted) return;
        setMitraMagangOptions([]);
        setMitraOptionsError(error.message || "Gagal memuat data mitra magang.");
      } finally {
        if (isMounted) setLoadingMitraOptions(false);
      }
    };

    fetchMitraMagangOptions();

    return () => {
      isMounted = false;
    };
  }, [apiBaseUrl, onSessionExpired, session.token]);

  useEffect(() => {
    if (isNonPartner) {
      if (formData.chosen_institution !== MAGANG_NON_PARTNER_OPTION_LABEL) {
        setFormData((prev) => ({
          ...prev,
          chosen_institution: MAGANG_NON_PARTNER_OPTION_LABEL,
        }));
      }
      return;
    }

    if (!formData.chosen_institution) return;
    if (formData.chosen_institution === MAGANG_NON_PARTNER_OPTION_LABEL) {
      setFormData((prev) => ({
        ...prev,
        chosen_institution: "",
      }));
      return;
    }

    if (!partnerInstitutionOptions.includes(formData.chosen_institution)) {
      setFormData((prev) => ({
        ...prev,
        chosen_institution: "",
      }));
    }
  }, [formData.chosen_institution, isNonPartner, partnerInstitutionOptions]);

  const updateField = (field, value) => {
    setFormData((prev) => {
      if (field === "company_type") {
        if (value === "non_partner_company") {
          return {
            ...prev,
            company_type: value,
            chosen_institution: MAGANG_NON_PARTNER_OPTION_LABEL,
          };
        }
        return {
          ...prev,
          company_type: value,
          chosen_institution:
            prev.chosen_institution === MAGANG_NON_PARTNER_OPTION_LABEL
              ? ""
              : prev.chosen_institution,
        };
      }

      return { ...prev, [field]: value };
    });
    setSubmitError("");
    setSubmitSuccess("");
  };

  const resetForm = () => {
    setFormData({
      phone_number: "",
      proposed_position: "",
      proposed_position_other: "",
      company_sector: "",
      company_sector_other: "",
      chosen_institution: "",
      complete_address_of_institution: "",
      company_type: "",
      sudah_apply_ke_mitra: null,
      tanggal_apply: "",
      metode_apply: "",
      bukti_apply: "",
      internship_company_website_url: "",
      internship_vacancy_url: "",
      supporting_documents_note: "",
      cv_file_name: "",
      portfolio_file_name: "",
      transcript_file_name: "",
      other_supporting_documents_file_name: "",
      company_name: "",
      year_of_establishment: "",
      number_of_employees: "",
      internship_application_method: "",
      internship_application_method_other: "",
      selection_processes_text: "",
    });
    setSubmitError("");
    setSubmitSuccess("");
  };

  const validateForm = () => {
    if (formData.sudah_apply_ke_mitra !== true) {
      return "Pengajuan magang hanya dapat dikirim setelah Anda apply ke mitra magang.";
    }
    if (!formData.tanggal_apply.trim()) return "Tanggal apply wajib diisi.";
    if (!formData.metode_apply.trim()) return "Metode apply wajib diisi.";
    if (!formData.bukti_apply.trim()) return "Bukti apply wajib diisi.";

    if (!formData.phone_number.trim()) return "Phone number wajib diisi.";
    if (!formData.proposed_position) return "Proposed / Expected Position wajib dipilih.";
    if (formData.proposed_position === "other" && !formData.proposed_position_other.trim()) {
      return "Isian other pada Proposed / Expected Position wajib diisi.";
    }
    if (!formData.company_sector) return "Company Sector wajib dipilih.";
    if (formData.company_sector === "other" && !formData.company_sector_other.trim()) {
      return "Isian other pada Company Sector wajib diisi.";
    }
    if (!formData.company_type) return "Type of Company wajib dipilih.";
    if (!formData.chosen_institution) return "Chosen Institution wajib dipilih.";
    if (!isNonPartner) {
      if (partnerInstitutionOptions.length === 0) {
        return "Daftar mitra magang belum tersedia. Hubungi sekretaris prodi.";
      }
      if (!partnerInstitutionOptions.includes(formData.chosen_institution)) {
        return "Chosen Institution tidak valid. Pilih dari daftar mitra yang tersedia.";
      }
    }
    if (!formData.complete_address_of_institution.trim()) return "Complete address of the institution wajib diisi.";
    if (!formData.internship_company_website_url.trim()) return "Internship Company website URL wajib diisi.";
    if (!isHttpUrl(formData.internship_company_website_url.trim())) {
      return "Internship Company website URL harus berupa URL http/https yang valid.";
    }
    if (formData.internship_vacancy_url.trim() && !isHttpUrl(formData.internship_vacancy_url.trim())) {
      return "Internship vacancy URL harus berupa URL http/https yang valid.";
    }
    if (!formData.internship_vacancy_url.trim() && !formData.supporting_documents_note.trim()) {
      return "Jika Internship vacancy URL tidak diisi, jelaskan dokumen pendukung institusi pada kolom catatan.";
    }
    if (!formData.cv_file_name.trim()) return "Upload CV wajib diisi (nama file).";
    if (!formData.portfolio_file_name.trim()) return "Upload portfolios of Past Work wajib diisi (nama file).";
    if (!formData.transcript_file_name.trim()) return "Upload Academic Transcript wajib diisi (nama file).";
    if (!formData.other_supporting_documents_file_name.trim()) {
      return "Upload other supporting documents wajib diisi (nama file).";
    }

    if (isNonPartner) {
      if (!formData.company_name.trim()) return "Company name wajib diisi untuk Non partner Company.";
      if (!formData.year_of_establishment.trim()) return "Year of establishment wajib diisi untuk Non partner Company.";
      if (!formData.number_of_employees.trim()) return "Number of employees wajib diisi untuk Non partner Company.";
      if (!formData.internship_application_method) {
        return "Internship Application method wajib dipilih untuk Non partner Company.";
      }
      if (
        formData.internship_application_method === "other" &&
        !formData.internship_application_method_other.trim()
      ) {
        return "Isian other pada Internship Application method wajib diisi.";
      }
      if (!formData.selection_processes_text.trim()) {
        return "Selection Processes wajib diisi untuk Non partner Company.";
      }
    }

    return "";
  };

  const buildPayload = () => {
    const normalizeText = (value) => String(value || "").trim();
    const selectionProcesses = normalizeText(formData.selection_processes_text)
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);

    return {
      phone_number: normalizeText(formData.phone_number),
      proposed_position: formData.proposed_position,
      proposed_position_other: normalizeText(formData.proposed_position_other),
      company_sector: formData.company_sector,
      company_sector_other: normalizeText(formData.company_sector_other),
      chosen_institution: isNonPartner
        ? MAGANG_NON_PARTNER_OPTION_LABEL
        : normalizeText(formData.chosen_institution),
      complete_address_of_institution: normalizeText(formData.complete_address_of_institution),
      company_type: formData.company_type,
      sudah_apply_ke_mitra: formData.sudah_apply_ke_mitra === true,
      tanggal_apply: normalizeText(formData.tanggal_apply),
      metode_apply: normalizeText(formData.metode_apply),
      bukti_apply: normalizeText(formData.bukti_apply),
      internship_company_website_url: normalizeText(formData.internship_company_website_url),
      internship_vacancy_url: normalizeText(formData.internship_vacancy_url),
      supporting_documents_note: normalizeText(formData.supporting_documents_note),
      cv_file_name: normalizeText(formData.cv_file_name),
      portfolio_file_name: normalizeText(formData.portfolio_file_name),
      transcript_file_name: normalizeText(formData.transcript_file_name),
      other_supporting_documents_file_name: normalizeText(formData.other_supporting_documents_file_name),
      company_name: isNonPartner ? normalizeText(formData.company_name) : "",
      year_of_establishment: isNonPartner ? normalizeText(formData.year_of_establishment) : "",
      number_of_employees: isNonPartner ? normalizeText(formData.number_of_employees) : "",
      internship_application_method: isNonPartner ? formData.internship_application_method : "",
      internship_application_method_other:
        isNonPartner && formData.internship_application_method === "other"
          ? normalizeText(formData.internship_application_method_other)
          : "",
      selection_processes: isNonPartner ? selectionProcesses : [],
    };
  };

  const handleSubmit = async () => {
    if (disabled) return;
    const validationError = validateForm();
    if (validationError) {
      setSubmitError(validationError);
      return;
    }

    const confirm = await Swal.fire({
      title: "Konfirmasi Permintaan Surat Rekomendasi Magang",
      text: "Pastikan seluruh data sudah benar sebelum dikirim.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Ya, Kirim",
      cancelButtonText: "Batal",
      confirmButtonColor: "#2f63e3",
    });
    if (!confirm.isConfirmed) return;

    setSubmitLoading(true);
    setSubmitError("");
    setSubmitSuccess("");

    try {
      const response = await fetch(`${apiBaseUrl}/api/jalur/non-penelitian/submit`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jalur: "magang",
          payload: buildPayload(),
        }),
      });

      const data = await response.json().catch(() => null);
      const message = String(data?.message || "").toLowerCase();
      const tokenError =
        message.includes("token tidak valid") ||
        message.includes("token tidak ditemukan") ||
        message.includes("kadaluarsa");

      if (response.status === 401 || (response.status === 403 && tokenError)) {
        onSessionExpired?.();
        return;
      }

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Permintaan surat rekomendasi magang gagal dikirim.");
      }

      setSubmitSuccess(data.message || "Permintaan surat rekomendasi magang berhasil dikirim.");
      resetForm();
      onSubmitted?.();
    } catch (error) {
      setSubmitError(error.message || "Permintaan surat rekomendasi magang gagal dikirim.");
    } finally {
      setSubmitLoading(false);
    }
  };

  const applyGateReason = useMemo(() => {
    if (formData.sudah_apply_ke_mitra === null) {
      return "Konfirmasi status apply ke mitra wajib dipilih terlebih dahulu.";
    }
    if (formData.sudah_apply_ke_mitra === false) {
      return "Submit dinonaktifkan karena Anda belum apply ke mitra magang.";
    }
    if (!formData.tanggal_apply.trim() || !formData.metode_apply.trim() || !formData.bukti_apply.trim()) {
      return "Lengkapi tanggal apply, metode apply, dan bukti apply untuk mengaktifkan submit.";
    }
    return "";
  }, [
    formData.sudah_apply_ke_mitra,
    formData.tanggal_apply,
    formData.metode_apply,
    formData.bukti_apply,
  ]);

  const submitIsDisabled = disabled || submitLoading || Boolean(applyGateReason);

  return (
    <div className="rounded-xl border border-[#e4e9f6] bg-white p-6 shadow-sm">
      <h2 className="text-xl font-black text-[#1b274b]">Permintaan Surat Rekomendasi Magang</h2>
      <p className="mt-1 text-sm text-[#5d6c91]">
        Isi form sesuai ketentuan jalur magang. Data mahasiswa diambil dari akun aktif.
      </p>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-semibold text-[#324c86]">NIM</label>
          <input
            type="text"
            readOnly
            value={studentProfile?.nim || session?.user?.username || "-"}
            className="w-full rounded-lg border border-[#d9e1f3] bg-[#f5f8ff] px-3 py-2 text-sm text-[#49639a]"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-[#324c86]">Nama</label>
          <input
            type="text"
            readOnly
            value={studentProfile?.nama || session?.user?.nama || "-"}
            className="w-full rounded-lg border border-[#d9e1f3] bg-[#f5f8ff] px-3 py-2 text-sm text-[#49639a]"
          />
        </div>
      </div>

      <div className="mt-4">
        <label className="mb-2 block text-sm font-semibold text-[#324c86]">Phone number *</label>
        <input
          type="text"
          value={formData.phone_number}
          onChange={(event) => updateField("phone_number", event.target.value)}
          disabled={disabled}
          className={`w-full rounded-lg border border-[#d0dbf4] px-3 py-2 text-sm outline-none ${
            disabled ? "cursor-not-allowed bg-[#f3f5fb] text-[#8b97b6]" : "focus:border-[#2f63e3] focus:ring-2 focus:ring-[#2f63e3]/20"
          }`}
        />
      </div>

      <div className="mt-6">
        <p className="mb-2 text-sm font-semibold text-[#324c86]">Proposed / Expected Position *</p>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {MAGANG_PROPOSED_POSITION_OPTIONS.map((option) => (
            <label key={`position-${option}`} className="flex items-center gap-2 rounded-lg border border-[#dce4f5] px-3 py-2 text-sm text-[#334772]">
              <input
                type="radio"
                name="proposed_position"
                disabled={disabled}
                checked={formData.proposed_position === option}
                onChange={() => updateField("proposed_position", option)}
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
        {formData.proposed_position === "other" ? (
          <input
            type="text"
            placeholder="Isi posisi lain"
            value={formData.proposed_position_other}
            disabled={disabled}
            onChange={(event) => updateField("proposed_position_other", event.target.value)}
            className={`mt-2 w-full rounded-lg border border-[#d0dbf4] px-3 py-2 text-sm outline-none ${
              disabled ? "cursor-not-allowed bg-[#f3f5fb] text-[#8b97b6]" : "focus:border-[#2f63e3] focus:ring-2 focus:ring-[#2f63e3]/20"
            }`}
          />
        ) : null}
      </div>

      <div className="mt-6">
        <p className="mb-2 text-sm font-semibold text-[#324c86]">Company Sector *</p>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {MAGANG_COMPANY_SECTOR_OPTIONS.map((option) => (
            <label key={`sector-${option}`} className="flex items-center gap-2 rounded-lg border border-[#dce4f5] px-3 py-2 text-sm text-[#334772]">
              <input
                type="radio"
                name="company_sector"
                disabled={disabled}
                checked={formData.company_sector === option}
                onChange={() => updateField("company_sector", option)}
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
        {formData.company_sector === "other" ? (
          <input
            type="text"
            placeholder="Isi sektor lain"
            value={formData.company_sector_other}
            disabled={disabled}
            onChange={(event) => updateField("company_sector_other", event.target.value)}
            className={`mt-2 w-full rounded-lg border border-[#d0dbf4] px-3 py-2 text-sm outline-none ${
              disabled ? "cursor-not-allowed bg-[#f3f5fb] text-[#8b97b6]" : "focus:border-[#2f63e3] focus:ring-2 focus:ring-[#2f63e3]/20"
            }`}
          />
        ) : null}
      </div>

      <div className="mt-6">
        <label className="mb-2 block text-sm font-semibold text-[#324c86]">Chosen Institution *</label>
        <select
          value={formData.chosen_institution}
          onChange={(event) => updateField("chosen_institution", event.target.value)}
          disabled={disabled || isNonPartner || loadingMitraOptions}
          className={`w-full rounded-lg border border-[#d0dbf4] px-3 py-2 text-sm outline-none ${
            disabled || isNonPartner || loadingMitraOptions
              ? "cursor-not-allowed bg-[#f3f5fb] text-[#8b97b6]"
              : "focus:border-[#2f63e3] focus:ring-2 focus:ring-[#2f63e3]/20"
          }`}
        >
          <option value="">
            {loadingMitraOptions ? "Memuat daftar mitra..." : "Pilih institusi mitra"}
          </option>
          {partnerInstitutionOptions.map((option) => (
            <option key={`inst-${option}`} value={option}>
              {option}
            </option>
          ))}
        </select>
        {isNonPartner ? (
          <p className="mt-1 text-xs text-[#5d6c91]">
            Untuk Non partner Company, sistem otomatis menggunakan opsi{" "}
            <b>{MAGANG_NON_PARTNER_OPTION_LABEL}</b>.
          </p>
        ) : null}
        {mitraOptionsError ? (
          <p className="mt-1 text-xs font-semibold text-[#c23737]">{mitraOptionsError}</p>
        ) : null}
      </div>

      <div className="mt-4">
        <label className="mb-2 block text-sm font-semibold text-[#324c86]">Complete address of the institution *</label>
        <textarea
          rows={3}
          value={formData.complete_address_of_institution}
          onChange={(event) => updateField("complete_address_of_institution", event.target.value)}
          disabled={disabled}
          className={`w-full rounded-lg border border-[#d0dbf4] px-3 py-2 text-sm outline-none ${
            disabled ? "cursor-not-allowed bg-[#f3f5fb] text-[#8b97b6]" : "focus:border-[#2f63e3] focus:ring-2 focus:ring-[#2f63e3]/20"
          }`}
        />
      </div>

      <div className="mt-6">
        <p className="mb-2 text-sm font-semibold text-[#324c86]">Type of Company *</p>
        <div className="grid grid-cols-1 gap-2">
          {MAGANG_COMPANY_TYPE_OPTIONS.map((option) => (
            <label key={`company-type-${option.value}`} className="flex items-center gap-2 rounded-lg border border-[#dce4f5] px-3 py-2 text-sm text-[#334772]">
              <input
                type="radio"
                name="company_type"
                disabled={disabled}
                checked={formData.company_type === option.value}
                onChange={() => updateField("company_type", option.value)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-[#e4ebf9] bg-[#f9fbff] p-4">
        <h3 className="text-sm font-black text-[#1b274b]">Konfirmasi Apply ke Mitra</h3>
        <p className="mt-1 text-xs text-[#5d6c91]">
          Wajib: mahasiswa harus sudah apply terlebih dahulu ke tempat magang sebelum submit form ini.
        </p>

        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
          <label className="flex items-center gap-2 rounded-lg border border-[#dce4f5] px-3 py-2 text-sm text-[#334772]">
            <input
              type="radio"
              name="sudah_apply_ke_mitra"
              disabled={disabled}
              checked={formData.sudah_apply_ke_mitra === true}
              onChange={() => updateField("sudah_apply_ke_mitra", true)}
            />
            <span>Sudah apply ke mitra magang</span>
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-[#dce4f5] px-3 py-2 text-sm text-[#334772]">
            <input
              type="radio"
              name="sudah_apply_ke_mitra"
              disabled={disabled}
              checked={formData.sudah_apply_ke_mitra === false}
              onChange={() => updateField("sudah_apply_ke_mitra", false)}
            />
            <span>Belum apply ke mitra magang</span>
          </label>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-semibold text-[#324c86]">Tanggal apply *</label>
            <input
              type="date"
              value={formData.tanggal_apply}
              onChange={(event) => updateField("tanggal_apply", event.target.value)}
              disabled={disabled || formData.sudah_apply_ke_mitra !== true}
              className={`w-full rounded-lg border border-[#d0dbf4] px-3 py-2 text-sm outline-none ${
                disabled || formData.sudah_apply_ke_mitra !== true
                  ? "cursor-not-allowed bg-[#f3f5fb] text-[#8b97b6]"
                  : "focus:border-[#2f63e3] focus:ring-2 focus:ring-[#2f63e3]/20"
              }`}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-[#324c86]">Metode apply *</label>
            <input
              type="text"
              placeholder="Contoh: Email / Website / LinkedIn / Walk-in"
              value={formData.metode_apply}
              onChange={(event) => updateField("metode_apply", event.target.value)}
              disabled={disabled || formData.sudah_apply_ke_mitra !== true}
              className={`w-full rounded-lg border border-[#d0dbf4] px-3 py-2 text-sm outline-none ${
                disabled || formData.sudah_apply_ke_mitra !== true
                  ? "cursor-not-allowed bg-[#f3f5fb] text-[#8b97b6]"
                  : "focus:border-[#2f63e3] focus:ring-2 focus:ring-[#2f63e3]/20"
              }`}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-[#324c86]">Bukti apply *</label>
            <input
              type="text"
              placeholder="Nama file / URL / catatan bukti"
              value={formData.bukti_apply}
              onChange={(event) => updateField("bukti_apply", event.target.value)}
              disabled={disabled || formData.sudah_apply_ke_mitra !== true}
              className={`w-full rounded-lg border border-[#d0dbf4] px-3 py-2 text-sm outline-none ${
                disabled || formData.sudah_apply_ke_mitra !== true
                  ? "cursor-not-allowed bg-[#f3f5fb] text-[#8b97b6]"
                  : "focus:border-[#2f63e3] focus:ring-2 focus:ring-[#2f63e3]/20"
              }`}
            />
          </div>
        </div>

        {applyGateReason ? (
          <div className="mt-3 rounded-md border border-[#ffe0a8] bg-[#fff8e7] px-3 py-2 text-xs font-semibold text-[#9d6a00]">
            {applyGateReason}
          </div>
        ) : null}
      </div>

      {isNonPartner ? (
        <div className="mt-6 rounded-lg border border-[#e4ebf9] bg-[#f9fbff] p-4">
          <h3 className="text-sm font-black text-[#1b274b]">Data Tambahan Non Partner Company</h3>
          <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-[#324c86]">Company name *</label>
              <input
                type="text"
                value={formData.company_name}
                onChange={(event) => updateField("company_name", event.target.value)}
                disabled={disabled}
                className={`w-full rounded-lg border border-[#d0dbf4] px-3 py-2 text-sm outline-none ${
                  disabled ? "cursor-not-allowed bg-[#f3f5fb] text-[#8b97b6]" : "focus:border-[#2f63e3] focus:ring-2 focus:ring-[#2f63e3]/20"
                }`}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-[#324c86]">Year of establishment *</label>
              <input
                type="text"
                value={formData.year_of_establishment}
                onChange={(event) => updateField("year_of_establishment", event.target.value)}
                disabled={disabled}
                className={`w-full rounded-lg border border-[#d0dbf4] px-3 py-2 text-sm outline-none ${
                  disabled ? "cursor-not-allowed bg-[#f3f5fb] text-[#8b97b6]" : "focus:border-[#2f63e3] focus:ring-2 focus:ring-[#2f63e3]/20"
                }`}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-[#324c86]">Number of employees *</label>
              <input
                type="text"
                value={formData.number_of_employees}
                onChange={(event) => updateField("number_of_employees", event.target.value)}
                disabled={disabled}
                className={`w-full rounded-lg border border-[#d0dbf4] px-3 py-2 text-sm outline-none ${
                  disabled ? "cursor-not-allowed bg-[#f3f5fb] text-[#8b97b6]" : "focus:border-[#2f63e3] focus:ring-2 focus:ring-[#2f63e3]/20"
                }`}
              />
            </div>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-sm font-semibold text-[#324c86]">Internship Application method *</p>
            <div className="grid grid-cols-1 gap-2">
              {MAGANG_APPLICATION_METHOD_OPTIONS.map((option) => (
                <label key={`app-method-${option}`} className="flex items-center gap-2 rounded-lg border border-[#dce4f5] px-3 py-2 text-sm text-[#334772]">
                  <input
                    type="radio"
                    name="internship_application_method"
                    disabled={disabled}
                    checked={formData.internship_application_method === option}
                    onChange={() => updateField("internship_application_method", option)}
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
            {formData.internship_application_method === "other" ? (
              <input
                type="text"
                placeholder="Isi metode lain"
                value={formData.internship_application_method_other}
                disabled={disabled}
                onChange={(event) => updateField("internship_application_method_other", event.target.value)}
                className={`mt-2 w-full rounded-lg border border-[#d0dbf4] px-3 py-2 text-sm outline-none ${
                  disabled ? "cursor-not-allowed bg-[#f3f5fb] text-[#8b97b6]" : "focus:border-[#2f63e3] focus:ring-2 focus:ring-[#2f63e3]/20"
                }`}
              />
            ) : null}
          </div>

          <div className="mt-4">
            <label className="mb-2 block text-sm font-semibold text-[#324c86]">Selection Processes (satu baris = satu proses) *</label>
            <textarea
              rows={4}
              value={formData.selection_processes_text}
              onChange={(event) => updateField("selection_processes_text", event.target.value)}
              disabled={disabled}
              className={`w-full rounded-lg border border-[#d0dbf4] px-3 py-2 text-sm outline-none ${
                disabled ? "cursor-not-allowed bg-[#f3f5fb] text-[#8b97b6]" : "focus:border-[#2f63e3] focus:ring-2 focus:ring-[#2f63e3]/20"
              }`}
            />
          </div>
        </div>
      ) : null}

      <div className="mt-6 rounded-lg border border-[#e4ebf9] bg-[#f9fbff] p-4">
        <h3 className="text-sm font-black text-[#1b274b]">Dokumen Pendukung</h3>
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold text-[#324c86]">Upload CV (nama file) *</label>
            <input
              type="text"
              value={formData.cv_file_name}
              onChange={(event) => updateField("cv_file_name", event.target.value)}
              disabled={disabled}
              className={`w-full rounded-lg border border-[#d0dbf4] px-3 py-2 text-sm outline-none ${
                disabled ? "cursor-not-allowed bg-[#f3f5fb] text-[#8b97b6]" : "focus:border-[#2f63e3] focus:ring-2 focus:ring-[#2f63e3]/20"
              }`}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-[#324c86]">Upload portfolios of Past Work (nama file) *</label>
            <input
              type="text"
              value={formData.portfolio_file_name}
              onChange={(event) => updateField("portfolio_file_name", event.target.value)}
              disabled={disabled}
              className={`w-full rounded-lg border border-[#d0dbf4] px-3 py-2 text-sm outline-none ${
                disabled ? "cursor-not-allowed bg-[#f3f5fb] text-[#8b97b6]" : "focus:border-[#2f63e3] focus:ring-2 focus:ring-[#2f63e3]/20"
              }`}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-[#324c86]">Upload Academic Transcript (nama file) *</label>
            <input
              type="text"
              value={formData.transcript_file_name}
              onChange={(event) => updateField("transcript_file_name", event.target.value)}
              disabled={disabled}
              className={`w-full rounded-lg border border-[#d0dbf4] px-3 py-2 text-sm outline-none ${
                disabled ? "cursor-not-allowed bg-[#f3f5fb] text-[#8b97b6]" : "focus:border-[#2f63e3] focus:ring-2 focus:ring-[#2f63e3]/20"
              }`}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-[#324c86]">Upload other supporting documents (nama file) *</label>
            <input
              type="text"
              value={formData.other_supporting_documents_file_name}
              onChange={(event) => updateField("other_supporting_documents_file_name", event.target.value)}
              disabled={disabled}
              className={`w-full rounded-lg border border-[#d0dbf4] px-3 py-2 text-sm outline-none ${
                disabled ? "cursor-not-allowed bg-[#f3f5fb] text-[#8b97b6]" : "focus:border-[#2f63e3] focus:ring-2 focus:ring-[#2f63e3]/20"
              }`}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-[#324c86]">Internship Company website URL *</label>
            <input
              type="text"
              value={formData.internship_company_website_url}
              onChange={(event) => updateField("internship_company_website_url", event.target.value)}
              disabled={disabled}
              placeholder="https://..."
              className={`w-full rounded-lg border border-[#d0dbf4] px-3 py-2 text-sm outline-none ${
                disabled ? "cursor-not-allowed bg-[#f3f5fb] text-[#8b97b6]" : "focus:border-[#2f63e3] focus:ring-2 focus:ring-[#2f63e3]/20"
              }`}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-[#324c86]">Internship vacancy URL (opsional)</label>
            <input
              type="text"
              value={formData.internship_vacancy_url}
              onChange={(event) => updateField("internship_vacancy_url", event.target.value)}
              disabled={disabled}
              placeholder="https://..."
              className={`w-full rounded-lg border border-[#d0dbf4] px-3 py-2 text-sm outline-none ${
                disabled ? "cursor-not-allowed bg-[#f3f5fb] text-[#8b97b6]" : "focus:border-[#2f63e3] focus:ring-2 focus:ring-[#2f63e3]/20"
              }`}
            />
          </div>
        </div>
        <div className="mt-4">
          <label className="mb-2 block text-sm font-semibold text-[#324c86]">
            Catatan dokumen pendukung (wajib jika internship vacancy URL kosong)
          </label>
          <textarea
            rows={3}
            value={formData.supporting_documents_note}
            onChange={(event) => updateField("supporting_documents_note", event.target.value)}
            disabled={disabled}
            className={`w-full rounded-lg border border-[#d0dbf4] px-3 py-2 text-sm outline-none ${
              disabled ? "cursor-not-allowed bg-[#f3f5fb] text-[#8b97b6]" : "focus:border-[#2f63e3] focus:ring-2 focus:ring-[#2f63e3]/20"
            }`}
          />
        </div>
      </div>

      {submitError ? (
        <div className="mt-4 rounded-lg border border-[#f5d0d0] bg-[#fff2f2] px-3 py-2 text-sm font-semibold text-[#a03f3f]">
          {submitError}
        </div>
      ) : null}
      {submitSuccess ? (
        <div className="mt-4 rounded-lg border border-[#d2efdf] bg-[#effcf5] px-3 py-2 text-sm font-semibold text-[#1b7a49]">
          {submitSuccess}
        </div>
      ) : null}

      <div className="mt-5 flex justify-end gap-3">
        <button
          type="button"
          onClick={resetForm}
          disabled={disabled}
          className={`inline-flex items-center gap-2 rounded-lg border border-[#d1daf0] px-5 py-2 text-sm font-semibold transition ${
            disabled ? "cursor-not-allowed bg-[#f5f7fb] text-[#7f8aac]" : "text-[#314778] hover:bg-[#f4f7ff]"
          }`}
        >
          <RotateCcw className="h-4 w-4" />
          Reset
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitIsDisabled}
          className={`inline-flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-bold transition ${
            submitIsDisabled
              ? "cursor-not-allowed bg-[#d5dbea] text-[#7a86a5]"
              : "bg-[#2f63e3] text-white hover:brightness-110"
          }`}
        >
          <Send className="h-4 w-4" />
          {submitLoading ? "Mengirim..." : "Kirim Permintaan Surat"}
        </button>
      </div>
    </div>
  );
}

function PengajuanPage({
  session,
  apiBaseUrl,
  onSessionExpired,
  jalurEligibility,
  studentProfile,
  onEligibilityRefresh,
}) {
  const [selectedType, setSelectedType] = useState("dosen");

  const selectedJalur =
    jalurEligibility?.onboarding?.target_jalur ||
    jalurEligibility?.pendaftaran_aktif?.selected_jalur ||
    null;

  const onboardingLocked = Boolean(jalurEligibility?.onboarding?.is_locked);
  const onboardingReason = jalurEligibility?.onboarding?.reason || "";
  const renderJalur = selectedJalur || "penelitian";
  const renderJalurEligibility = jalurEligibility?.jalur_eligibility?.[renderJalur] || null;
  const currentFormDisabled = Boolean(renderJalurEligibility && renderJalurEligibility.enabled === false);
  const currentFormDisabledReason = renderJalurEligibility?.reason || "";

  return (
    <div className="w-full space-y-6 pb-8">
      <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <Info className="mt-0.5 h-5 w-5 text-blue-600" />
        <p className="text-sm text-blue-900">
          Pastikan pengajuan sesuai jalur yang Anda pilih saat pendaftaran penjaluran.
        </p>
      </div>

      {selectedJalur ? (
        <div className="rounded-lg border border-[#dbe4f8] bg-[#f8fbff] px-4 py-3 text-sm font-semibold text-[#355189]">
          Jalur terdaftar periode aktif: <b>{formatJalurLabel(selectedJalur)}</b>.
          {onboardingLocked && onboardingReason ? ` ${onboardingReason}` : ""}
          {!onboardingLocked && currentFormDisabledReason ? ` ${currentFormDisabledReason}` : ""}
        </div>
      ) : null}

      {renderJalur === "penelitian" ? (
        <>
          <PengajuanTypeSelector
            selectedType={selectedType}
            onTypeChange={setSelectedType}
            disabled={currentFormDisabled}
          />

          {selectedType === "dosen" ? (
            <FormJudulDosen
              session={session}
              apiBaseUrl={apiBaseUrl}
              onSessionExpired={onSessionExpired}
              onSubmitted={onEligibilityRefresh}
              disabled={currentFormDisabled}
            />
          ) : (
            <FormJudulSendiri />
          )}
        </>
      ) : null}

      {renderJalur === "magang" ? (
        <FormSuratRekomendasiMagang
          session={session}
          apiBaseUrl={apiBaseUrl}
          onSessionExpired={onSessionExpired}
          onSubmitted={onEligibilityRefresh}
          studentProfile={studentProfile}
          disabled={currentFormDisabled}
        />
      ) : null}

      {renderJalur === "pengabdian" || renderJalur === "perintisan_bisnis" ? (
        <FormNonPenelitianGeneric
          jalur={renderJalur}
          jalurLabel={formatJalurLabel(renderJalur)}
          session={session}
          apiBaseUrl={apiBaseUrl}
          onSessionExpired={onSessionExpired}
          onSubmitted={onEligibilityRefresh}
          disabled={currentFormDisabled}
        />
      ) : null}
    </div>
  );
}

export default PengajuanPage;
