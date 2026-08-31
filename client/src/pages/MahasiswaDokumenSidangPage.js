import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Eye, FileText, FileUp, RefreshCcw } from "lucide-react";
import Swal from "sweetalert2";

const DOKUMEN_ORDER = ["transkrip", "cept", "draft_skripsi", "paper"];

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

function showSuccessToast(message) {
  Swal.fire({
    toast: true,
    position: "top-end",
    icon: "success",
    title: message,
    showConfirmButton: false,
    timer: 2500,
    timerProgressBar: true,
  });
}

function MahasiswaDokumenSidangPage({ session, apiBaseUrl, onSessionExpired }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fieldMessages, setFieldMessages] = useState({});
  const [data, setData] = useState(null);
  const [uploadingKey, setUploadingKey] = useState("");
  const [selectedFiles, setSelectedFiles] = useState({
    transkrip: null,
    cept: null,
    draft_skripsi: null,
    paper: null,
  });
  const fileInputRefs = useRef({});

  const fetchWithAuth = useCallback(async (path, options = {}) => {
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
  }, [apiBaseUrl, onSessionExpired, session.token]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const docResponse = await fetchWithAuth("/api/mahasiswa/dokumen-sidang");
      const docPayload = await docResponse.json().catch(() => null);
      if (!docResponse.ok || !docPayload?.success) {
        throw new Error(docPayload?.message || "Gagal memuat data dokumen sidang.");
      }
      setData(docPayload.data || null);
    } catch (loadError) {
      if (loadError.message !== "__SESSION_EXPIRED__") {
        setError(loadError.message || "Gagal memuat data dokumen sidang.");
      }
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    loadData().catch(() => {});
  }, [loadData]);

  const dokumenItems = useMemo(() => {
    const source = data?.dokumen || {};
    return DOKUMEN_ORDER.map((key) => source[key]).filter(Boolean);
  }, [data]);

  const gate = data?.gate || {};
  const supervisionAccess = data?.supervision_access || null;
  const isReplacementPending = supervisionAccess?.status === "replacement_pending";
  const canUploadDocument = supervisionAccess?.can_upload_document !== false;
  const counted = Number(gate.counted_sessions || 0);
  const target = Number(gate.target_minimum || 8);
  const progressPercent = Math.max(0, Math.min(100, Math.round((counted / Math.max(target, 1)) * 100)));
  const mataKuliahPenjaluran = data?.persyaratan_sistem?.mata_kuliah_penjaluran || null;

  const handlePickFile = (docKey, file) => {
    setSelectedFiles((prev) => ({
      ...prev,
      [docKey]: file || null,
    }));
    setFieldMessages((prev) => ({
      ...prev,
      [docKey]: "",
    }));
  };

  const handleUpload = async (docKey) => {
    if (!canUploadDocument) {
      setFieldMessages((prev) => ({
        ...prev,
        [docKey]: supervisionAccess?.reason || "Upload dokumen belum dapat dilakukan.",
      }));
      return;
    }
    const selected = selectedFiles[docKey];
    if (!selected) {
      setFieldMessages((prev) => ({
        ...prev,
        [docKey]: "Silakan pilih file terlebih dahulu sebelum upload.",
      }));
      return;
    }

    const formData = new FormData();
    formData.append("file", selected);

    try {
      setUploadingKey(docKey);
      setError("");
      setFieldMessages((prev) => ({
        ...prev,
        [docKey]: "",
      }));
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
      if (fileInputRefs.current[docKey]) {
        fileInputRefs.current[docKey].value = "";
      }
      setFieldMessages((prev) => ({
        ...prev,
        [docKey]: "",
      }));
      showSuccessToast("Dokumen berhasil diunggah dan masuk antrean review dosen pembimbing.");
      await loadData();
    } catch (uploadError) {
      if (uploadError.message !== "__SESSION_EXPIRED__") {
        setFieldMessages((prev) => ({
          ...prev,
          [docKey]: uploadError.message || "Upload dokumen gagal.",
        }));
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

  const handleView = async (docKey) => {
    const previewWindow = window.open("about:blank", "_blank");
    if (previewWindow) previewWindow.opener = null;
    try {
      setError("");
      const response = await fetchWithAuth(`/api/mahasiswa/dokumen-sidang/${docKey}/download`);
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message || "Gagal membuka dokumen.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      if (previewWindow) {
        previewWindow.location.href = url;
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }
      window.setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
    } catch (viewError) {
      previewWindow?.close();
      if (viewError.message !== "__SESSION_EXPIRED__") {
        setError(viewError.message || "Gagal membuka dokumen.");
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

      {isReplacementPending ? (
        <div className="rounded-xl border border-[#f0cf91] bg-[#fff8e8] p-4 text-sm text-[#795300]">
          <p className="font-black">Menunggu Penggantian Pembimbing</p>
          <p className="mt-1">
            Pembimbing Anda tidak dapat melanjutkan bimbingan. Upload dokumen dan pendaftaran sidang dinonaktifkan sementara sampai pembimbing pengganti aktif. Dokumen lama tetap dapat dilihat dan diunduh.
          </p>
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
        {data?.summary?.semua_disetujui ? (
          <p className="mt-2 rounded-lg border border-[#d6f1e2] bg-[#ecfaf2] px-3 py-2 text-sm font-semibold text-[#196a45]">
            Semua dokumen sudah disetujui dosen pembimbing. Silakan daftar sidang ketika periode sidang dibuka.
          </p>
        ) : null}
        {!gate.unlocked ? (
          <p className="mt-2 rounded-lg border border-[#cfe0ff] bg-[#f4f8ff] px-3 py-2 text-sm font-semibold text-[#315086]">
            Dokumen sudah dapat diunggah dan direview. Minimal {target} bimbingan tervalidasi tetap menjadi syarat untuk mendaftar sidang.
          </p>
        ) : null}
      </section>

      <section className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h3 className="text-lg font-black text-[#1b274b]">Mata Kuliah Penjaluran</h3><p className="text-sm text-[#5d6c91]">Syarat otomatis dari Data Akademik. Item ini bukan dokumen upload dan tidak dapat di-approve manual.</p></div>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${mataKuliahPenjaluran?.fulfilled ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{mataKuliahPenjaluran?.syarat_sidang || (mataKuliahPenjaluran?.fulfilled ? "Terpenuhi" : "Belum terpenuhi")}</span>
        </div>
        <div className="mt-3 grid gap-2 rounded-lg bg-[#f8fbff] p-3 text-sm text-[#42588f] md:grid-cols-3"><p><span className="font-semibold">Mata kuliah:</span> {mataKuliahPenjaluran?.mata_kuliah || "-"}</p><p><span className="font-semibold">Nilai:</span> {mataKuliahPenjaluran?.nilai || "-"}</p><p><span className="font-semibold">Status:</span> {mataKuliahPenjaluran?.status || "Belum tersedia"}</p></div>
      </section>

      <section className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
        <h3 className="text-lg font-black text-[#1b274b]">Unggah Dokumen Kelayakan Sidang</h3>
        <p className="mt-1 text-sm text-[#5d6c91]">
          Unggah Transkrip Nilai, Sertifikat CEPT, Draft Skripsi, dan Paper. Seluruh dokumen wajib disetujui sebelum mendaftar sidang.
        </p>

        {loading ? (
          <div className="mt-4 rounded-lg border border-[#e2e9f8] bg-[#f8fbff] p-4 text-sm font-semibold text-[#60709a]">
            Memuat data dokumen...
          </div>
        ) : null}

        {!loading ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {dokumenItems.map((item) => {
              const normalizedStatus = String(item.status || "").toLowerCase();
              const isRevision = normalizedStatus === "revisi";
              const canPickFile = canUploadDocument && item.can_upload !== false && uploadingKey !== item.key;
              const selectedFile = selectedFiles[item.key];

              return (
                <article
                  key={item.key}
                  className={`flex min-h-[360px] flex-col overflow-hidden rounded-xl border bg-white shadow-sm ${
                    isRevision ? "border-[#efb4b4]" : "border-[#dfe6f4]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 border-b border-[#edf1f8] px-4 py-4">
                    <div className="min-w-0">
                      <h4 className="break-words text-base font-black text-[#24396d]">{item.label}</h4>
                      <p className="mt-1 text-xs font-semibold text-[#8693b2]">Dokumen Kelayakan Sidang</p>
                    </div>
                    <div className="shrink-0">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusBadgeClass(item.status)}`}>
                        {item.status_label}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col items-center justify-center px-4 py-6 text-center">
                    {item.has_file ? (
                      <FileText className={`h-16 w-16 ${isRevision ? "text-[#d04a4a]" : "text-[#3f5cc4]"}`} strokeWidth={1.6} />
                    ) : (
                      <FileUp className="h-16 w-16 text-[#9ba4b8]" strokeWidth={1.6} />
                    )}
                    <p className="mt-3 max-w-full break-words text-sm font-semibold text-[#475574]">
                      {item.file_name || "Belum ada file yang diunggah"}
                    </p>
                    <p className="mt-1 text-xs text-[#8490ac]">
                      {item.uploaded_at ? `Terakhir diunggah ${formatDateTime(item.uploaded_at)}` : "PDF, DOC, atau DOCX"}
                    </p>
                    {isRevision ? (
                      <div className="mt-4 max-h-40 w-full overflow-y-auto rounded-lg border border-[#f0bcbc] bg-[#fff1f1] px-3 py-3 text-left text-xs text-[#a33b3b]">
                        <p className="font-black">Catatan Revisi</p>
                        <p className="mt-1 whitespace-pre-wrap break-words leading-5">
                          {item.review_note || "Perbaiki dokumen sesuai arahan dosen pembimbing."}
                        </p>
                      </div>
                    ) : null}
                    {normalizedStatus === "submitted" ? (
                      <p className="mt-3 rounded-full bg-[#fff5dc] px-3 py-1 text-xs font-bold text-[#956400]">
                        Menunggu review dosen
                      </p>
                    ) : null}
                    {normalizedStatus === "approved" ? (
                      <p className="mt-3 rounded-full bg-[#e7f7ef] px-3 py-1 text-xs font-bold text-[#14724a]">
                        Telah disetujui dosen
                      </p>
                    ) : null}
                  </div>

                  <input
                    ref={(element) => {
                      fileInputRefs.current[item.key] = element;
                    }}
                    type="file"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    disabled={!canPickFile}
                    onChange={(event) => handlePickFile(item.key, event.target.files?.[0] || null)}
                    className="hidden"
                  />

                  {selectedFile ? (
                    <div className="mx-4 mb-3 rounded-lg border border-[#cfdbf5] bg-[#f6f9ff] p-3">
                      <p className="truncate text-xs font-semibold text-[#405680]">File dipilih: {selectedFile.name}</p>
                      <button
                        type="button"
                        disabled={!canPickFile}
                        onClick={() => handleUpload(item.key).catch(() => {})}
                        className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#2f63e3] px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <FileUp className="h-4 w-4" />
                        {uploadingKey === item.key ? "Mengunggah..." : "Unggah Sekarang"}
                      </button>
                    </div>
                  ) : null}

                  {fieldMessages[item.key] ? (
                    <div
                      className={`mx-4 mb-3 rounded-lg border px-3 py-2 text-xs ${
                        String(fieldMessages[item.key]).toLowerCase().includes("berhasil")
                          ? "border-[#d6f1e2] bg-[#ecfaf2] text-[#196a45]"
                          : "border-[#f6d7d7] bg-[#fff2f2] text-[#a03f3f]"
                      }`}
                    >
                      {fieldMessages[item.key]}
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 gap-2 border-t border-[#edf1f8] p-3 sm:grid-cols-2">
                    {item.has_file ? (
                      <>
                        <button
                          type="button"
                          disabled={uploadingKey === item.key}
                          onClick={() => handleView(item.key).catch(() => {})}
                          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#3854b8] px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
                        >
                          <Eye className="h-4 w-4" />
                          Lihat
                        </button>
                        <button
                          type="button"
                          disabled={!canPickFile}
                          onClick={() => fileInputRefs.current[item.key]?.click()}
                          className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#d75151] px-3 py-2 text-xs font-bold text-[#c43e3e] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <FileUp className="h-4 w-4" />
                          {item.can_upload === false ? "Dokumen Dikunci" : "Upload Ulang"}
                        </button>
                        <button
                          type="button"
                          disabled={uploadingKey === item.key}
                          onClick={() => handleDownload(item.key, item.file_name).catch(() => {})}
                          className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#d3dbef] px-3 py-2 text-xs font-bold text-[#405680] sm:col-span-2"
                        >
                          <Download className="h-4 w-4" />
                          Unduh
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={!canPickFile}
                        onClick={() => fileInputRefs.current[item.key]?.click()}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#4664d4] px-3 py-2 text-xs font-bold uppercase tracking-wide text-[#3854b8] disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2"
                      >
                        <FileUp className="h-4 w-4" />
                        Unggah
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </section>
    </div>
  );
}

export default MahasiswaDokumenSidangPage;
