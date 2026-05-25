import React, { useEffect, useMemo, useState } from "react";
import { Download, FileUp, RefreshCcw } from "lucide-react";

const DOKUMEN_ORDER = ["transkrip", "cept", "draft_skripsi"];

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

function statusBadgeClass(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "approved") return "bg-[#dff3ec] text-[#106d45]";
  if (normalized === "submitted") return "bg-[#fdf1d4] text-[#a06a00]";
  if (normalized === "revisi") return "bg-[#ffe9e9] text-[#b73a3a]";
  return "bg-[#eef2fb] text-[#5c6d95]";
}

function statusSidangLabel(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "lolos_pendaftaran_sidang") return "Lolos ke Tahap Pendaftaran Sidang";
  if (normalized === "menunggu_review_dosen") return "Menunggu Review Dokumen Dosen";
  if (normalized === "perlu_revisi_dokumen") return "Perlu Revisi Dokumen";
  if (normalized === "siap_upload_dokumen") return "Siap Upload Dokumen";
  return "Menunggu Minimal 8 Bimbingan Tervalidasi";
}

function MahasiswaDokumenSidangPage({ session, apiBaseUrl, onSessionExpired }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [uploadingKey, setUploadingKey] = useState("");
  const [selectedFiles, setSelectedFiles] = useState({
    transkrip: null,
    cept: null,
    draft_skripsi: null,
  });

  const fetchWithAuth = async (path, options = {}) => {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${session.token}`,
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

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await fetchWithAuth("/api/mahasiswa/dokumen-sidang");
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || "Gagal memuat data dokumen sidang.");
      }
      setData(payload.data || null);
    } catch (loadError) {
      if (loadError.message !== "__SESSION_EXPIRED__") {
        setError(loadError.message || "Gagal memuat data dokumen sidang.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData().catch(() => {});
  }, []);

  const dokumenItems = useMemo(() => {
    const source = data?.dokumen || {};
    return DOKUMEN_ORDER.map((key) => source[key]).filter(Boolean);
  }, [data]);

  const gate = data?.gate || {};
  const counted = Number(gate.counted_sessions || 0);
  const target = Number(gate.target_minimum || 8);
  const progressPercent = Math.max(0, Math.min(100, Math.round((counted / Math.max(target, 1)) * 100)));

  const handlePickFile = (docKey, file) => {
    setSelectedFiles((prev) => ({
      ...prev,
      [docKey]: file || null,
    }));
  };

  const handleUpload = async (docKey) => {
    const selected = selectedFiles[docKey];
    if (!selected) {
      setError("Pilih file terlebih dahulu sebelum upload.");
      return;
    }

    const formData = new FormData();
    formData.append("file", selected);

    try {
      setUploadingKey(docKey);
      setError("");
      const response = await fetchWithAuth(`/api/mahasiswa/dokumen-sidang/${docKey}/upload`, {
        method: "POST",
        body: formData,
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || "Upload dokumen gagal.");
      }

      setSelectedFiles((prev) => ({
        ...prev,
        [docKey]: null,
      }));
      await loadData();
    } catch (uploadError) {
      if (uploadError.message !== "__SESSION_EXPIRED__") {
        setError(uploadError.message || "Upload dokumen gagal.");
      }
    } finally {
      setUploadingKey("");
    }
  };

  const handleDownload = async (docKey, fileName) => {
    try {
      const response = await fetchWithAuth(`/api/mahasiswa/dokumen-sidang/${docKey}/download`);
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

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-xl border border-[#f6d7d7] bg-[#fff2f2] p-4 text-sm font-semibold text-[#a03f3f]">
          {error}
        </div>
      ) : null}

      <section className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-lg font-black text-[#1b274b]">Progress Bimbingan Skripsi</h3>
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
        </div>
        <p className="text-sm text-[#5d6c91]">
          Sesi tervalidasi: <span className="font-bold text-[#1b274b]">{counted}</span> dari{" "}
          <span className="font-bold text-[#1b274b]">{target}</span>
        </p>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#dfe6f7]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#2f63e3] to-[#2740a3]"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <p className="mt-3 text-sm font-semibold text-[#415480]">
          Status Tahap Sidang: {statusSidangLabel(data?.status_pendaftaran_sidang)}
        </p>
        {!gate.unlocked ? (
          <p className="mt-2 rounded-lg border border-[#f2dfb3] bg-[#fff9e9] px-3 py-2 text-sm font-semibold text-[#7a5a00]">
            Upload dokumen akan terbuka otomatis setelah mencapai minimal {target} bimbingan tervalidasi.
          </p>
        ) : null}
      </section>

      <section className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
        <h3 className="text-lg font-black text-[#1b274b]">Unggah Dokumen Kelayakan Sidang</h3>
        <p className="mt-1 text-sm text-[#5d6c91]">
          Unggah dokumen Transkrip Nilai, Sertifikat CEPT, dan Draft Skripsi. Setiap dokumen direview dosen secara terpisah.
        </p>

        {loading ? (
          <div className="mt-4 rounded-lg border border-[#e2e9f8] bg-[#f8fbff] p-4 text-sm font-semibold text-[#60709a]">
            Memuat data dokumen...
          </div>
        ) : null}

        {!loading ? (
          <div className="mt-4 space-y-3">
            {dokumenItems.map((item) => (
              <div key={item.key} className="rounded-lg border border-[#e2e9f8] bg-[#f8fbff] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-base font-black text-[#1b274b]">{item.label}</p>
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusBadgeClass(item.status)}`}>
                    {item.status_label}
                  </span>
                </div>

                <div className="mt-2 space-y-1 text-sm text-[#42588f]">
                  <p>
                    <span className="font-semibold">File Saat Ini:</span> {item.file_name || "-"}
                  </p>
                  <p>
                    <span className="font-semibold">Terakhir Upload:</span> {formatDateTime(item.uploaded_at)}
                  </p>
                  <p>
                    <span className="font-semibold">Catatan Review Dosen:</span> {item.review_note || "-"}
                  </p>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    disabled={!gate.unlocked || uploadingKey === item.key}
                    onChange={(event) => handlePickFile(item.key, event.target.files?.[0] || null)}
                    className="max-w-[350px] rounded-lg border border-[#d1daf0] bg-white px-3 py-2 text-sm text-[#2e406e]"
                  />
                  <button
                    type="button"
                    disabled={!gate.unlocked || uploadingKey === item.key}
                    onClick={() => {
                      handleUpload(item.key).catch(() => {});
                    }}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#2f63e3] px-3 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <FileUp className="h-4 w-4" />
                    {uploadingKey === item.key ? "Mengunggah..." : item.has_file ? "Upload Ulang" : "Upload"}
                  </button>
                  <button
                    type="button"
                    disabled={!item.has_file || uploadingKey === item.key}
                    onClick={() => {
                      handleDownload(item.key, item.file_name).catch(() => {});
                    }}
                    className="inline-flex items-center gap-2 rounded-lg border border-[#d3dbef] bg-white px-3 py-2 text-sm font-semibold text-[#27407b] transition hover:bg-[#f3f6ff] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Download className="h-4 w-4" />
                    Unduh
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}

export default MahasiswaDokumenSidangPage;

