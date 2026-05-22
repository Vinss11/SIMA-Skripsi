import React, { useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, Clock3, MapPin, MessageSquareText, RefreshCcw, Send, XCircle } from "lucide-react";
import Swal from "sweetalert2";

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
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

function statusBadge(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "approved") {
    return "bg-[#e6f8ef] text-[#1f8a58]";
  }
  if (normalized === "rejected") {
    return "bg-[#ffeded] text-[#b03d3d]";
  }
  return "bg-[#fff5df] text-[#9b6d00]";
}

function resumeBadge(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "approved") return "bg-[#e6f8ef] text-[#1f8a58]";
  if (normalized === "rejected") return "bg-[#ffeded] text-[#b03d3d]";
  if (normalized === "revisi") return "bg-[#fff5df] text-[#9b6d00]";
  if (normalized === "submitted") return "bg-[#edf3ff] text-[#2952b7]";
  return "bg-[#eef2fb] text-[#55658f]";
}

function showSuccessToast(message) {
  Swal.fire({
    toast: true,
    position: "top-end",
    icon: "success",
    title: message,
    showConfirmButton: false,
    timer: 2200,
    timerProgressBar: true,
  });
}

const MAHASISWA_BIMBINGAN_TABS = [
  { key: "semua", label: "Semua" },
  { key: "menunggu", label: "Menunggu" },
  { key: "perlu_resume", label: "Perlu Resume" },
  { key: "perlu_revisi", label: "Perlu Revisi" },
  { key: "selesai", label: "Selesai" },
];

function isRowInMahasiswaTab(row, tabKey) {
  if (!row) return false;
  const statusPermohonan = String(row.status_permohonan || "").toLowerCase();
  const statusResume = String(row.status_resume || "").toLowerCase();

  if (tabKey === "menunggu") {
    return statusPermohonan === "pending" || (statusPermohonan === "approved" && statusResume === "submitted");
  }
  if (tabKey === "perlu_resume") {
    return statusPermohonan === "approved" && statusResume === "belum_diisi";
  }
  if (tabKey === "perlu_revisi") {
    return statusResume === "revisi" || statusResume === "rejected";
  }
  if (tabKey === "selesai") {
    return statusPermohonan === "approved" && statusResume === "approved" && Boolean(row.is_counted);
  }
  return true;
}

function BimbinganPage({ session, apiBaseUrl, onSessionExpired, onUpdated }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState(null);
  const [dosenPembimbing, setDosenPembimbing] = useState(null);
  const [form, setForm] = useState({
    pesan: "",
    tanggal: "",
    jam: "",
  });
  const [resumeDraft, setResumeDraft] = useState({});
  const [submittingResumeId, setSubmittingResumeId] = useState(null);
  const [activeTab, setActiveTab] = useState("semua");

  const fetchWithAuth = async (path, options = {}) => {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${session.token}`,
        "Content-Type": "application/json",
        ...(options.headers || {}),
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
      throw new Error("__SESSION_EXPIRED__");
    }

    if (!response.ok || !payload?.success) {
      throw new Error(payload?.message || "Terjadi kesalahan pada server");
    }

    return payload;
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");
      const payload = await fetchWithAuth("/api/mahasiswa/bimbingan");
      const data = payload?.data || {};
      setRows(Array.isArray(data.rows) ? data.rows : []);
      setStats(data.stats || null);
      setDosenPembimbing(data.dosen_pembimbing || null);
    } catch (loadError) {
      if (loadError.message !== "__SESSION_EXPIRED__") {
        setError(loadError.message || "Gagal memuat data bimbingan");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBaseUrl, session.token]);

  const progressPercent = useMemo(() => {
    return Number(stats?.progress_percent || 0);
  }, [stats]);

  const tabCounts = useMemo(() => {
    const counts = {};
    MAHASISWA_BIMBINGAN_TABS.forEach((tab) => {
      counts[tab.key] = rows.filter((row) => isRowInMahasiswaTab(row, tab.key)).length;
    });
    return counts;
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => isRowInMahasiswaTab(row, activeTab));
  }, [activeTab, rows]);

  const handleSubmitRequest = async (event) => {
    event.preventDefault();
    setError("");
    try {
      setSubmittingRequest(true);
      await fetchWithAuth("/api/mahasiswa/bimbingan", {
        method: "POST",
        body: JSON.stringify({
          pesan: form.pesan,
          tanggal: form.tanggal,
          jam: form.jam,
        }),
      });
      showSuccessToast("Pengajuan sesi bimbingan berhasil dibuat.");
      setForm({ pesan: "", tanggal: "", jam: "" });
      await loadData();
      onUpdated?.();
    } catch (submitError) {
      if (submitError.message !== "__SESSION_EXPIRED__") {
        setError(submitError.message || "Gagal mengirim permintaan bimbingan");
      }
    } finally {
      setSubmittingRequest(false);
    }
  };

  const handleSubmitResume = async (rowId) => {
    const resume = String(resumeDraft[rowId] || "").trim();
    if (resume.length < 20) {
      setError("Resume minimal 20 karakter.");
      return;
    }
    setError("");
    try {
      setSubmittingResumeId(rowId);
      await fetchWithAuth(`/api/mahasiswa/bimbingan/${rowId}/resume`, {
        method: "POST",
        body: JSON.stringify({ resume }),
      });
      showSuccessToast("Resume bimbingan berhasil dikirim.");
      setResumeDraft((prev) => ({ ...prev, [rowId]: "" }));
      await loadData();
      onUpdated?.();
    } catch (resumeError) {
      if (resumeError.message !== "__SESSION_EXPIRED__") {
        setError(resumeError.message || "Gagal mengirim resume");
      }
    } finally {
      setSubmittingResumeId(null);
    }
  };

  return (
    <div className="w-full space-y-4 pb-8">
      {error ? (
        <div className="rounded-lg border border-[#f5d0d0] bg-[#fff2f2] px-4 py-3 text-sm font-semibold text-[#a03f3f]">{error}</div>
      ) : null}

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-xl border border-[#e8ecf6] bg-white p-4 shadow-sm xl:col-span-2">
          <h3 className="text-lg font-black text-[#1b274b]">Progress Bimbingan</h3>
          <p className="text-sm text-[#5d6c91]">
            Sesi tervalidasi: {stats?.counted_sessions || 0} dari {stats?.target_minimum || 8}
          </p>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#dfe6f7]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#2f63e3] to-[#2740a3]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-[#2b3f74] md:grid-cols-4">
            <p>
              <span className="font-bold">Pending:</span> {stats?.pending_permohonan || 0}
            </p>
            <p>
              <span className="font-bold">Approved:</span> {stats?.approved_permohonan || 0}
            </p>
            <p>
              <span className="font-bold">Resume Submit:</span> {stats?.submitted_resume || 0}
            </p>
            <p>
              <span className="font-bold">Resume Approved:</span> {stats?.approved_resume || 0}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-[#e8ecf6] bg-white p-4 shadow-sm">
          <h3 className="text-lg font-black text-[#1b274b]">Dosen Pembimbing Skripsi</h3>
          {dosenPembimbing ? (
            <div className="mt-2 space-y-1 text-sm text-[#2b3f74]">
              <p className="font-bold text-[#1b274b]">{dosenPembimbing.nama}</p>
              <p>NIK: {dosenPembimbing.nik || "-"}</p>
              <p>Email: {dosenPembimbing.email || "-"}</p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-[#5d6c91]">Belum ada dosen pembimbing skripsi aktif.</p>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-[#e8ecf6] bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <MessageSquareText className="h-5 w-5 text-[#2f63e3]" />
          <h3 className="text-lg font-black text-[#1b274b]">Ajukan Jadwal Bimbingan</h3>
        </div>
        <form onSubmit={handleSubmitRequest} className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <div className="lg:col-span-3">
            <label className="mb-1 block text-sm font-semibold text-[#3d4f7d]">Pesan ke dosen</label>
            <textarea
              value={form.pesan}
              onChange={(event) => setForm((prev) => ({ ...prev, pesan: event.target.value }))}
              placeholder="Tulis topik yang ingin dibahas pada sesi bimbingan..."
              rows={3}
              className="w-full rounded-lg border border-[#d3dbef] px-3 py-2 text-sm text-[#1b274b] outline-none focus:border-[#2f63e3]"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-[#3d4f7d]">Tanggal</label>
            <input
              type="date"
              value={form.tanggal}
              onChange={(event) => setForm((prev) => ({ ...prev, tanggal: event.target.value }))}
              className="w-full rounded-lg border border-[#d3dbef] px-3 py-2 text-sm text-[#1b274b] outline-none focus:border-[#2f63e3]"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-[#3d4f7d]">Jam</label>
            <input
              type="time"
              value={form.jam}
              onChange={(event) => setForm((prev) => ({ ...prev, jam: event.target.value }))}
              className="w-full rounded-lg border border-[#d3dbef] px-3 py-2 text-sm text-[#1b274b] outline-none focus:border-[#2f63e3]"
              required
            />
          </div>
          <div className="flex items-end justify-end">
            <button
              type="submit"
              disabled={submittingRequest || !dosenPembimbing}
              className="inline-flex items-center gap-2 rounded-lg bg-[#2f63e3] px-4 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-55"
            >
              <Send className="h-4 w-4" />
              {submittingRequest ? "Mengirim..." : "Kirim Permohonan"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-[#e8ecf6] bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-lg font-black text-[#1b274b]">Riwayat Sesi Bimbingan</h3>
          <button
            type="button"
            onClick={loadData}
            className="inline-flex items-center gap-2 rounded-lg border border-[#d3dbef] px-3 py-2 text-sm font-semibold text-[#27407b] hover:bg-[#f3f6ff]"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        <div className="mb-3 flex flex-wrap gap-2 border-b border-[#e8edf8] pb-3">
          {MAHASISWA_BIMBINGAN_TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={`tab-bimbingan-${tab.key}`}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                  isActive
                    ? "border-[#2f63e3] bg-[#edf3ff] text-[#2f63e3]"
                    : "border-[#d3dbef] bg-white text-[#4d5e89] hover:bg-[#f5f8ff]"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-black ${
                    isActive ? "bg-[#2f63e3] text-white" : "bg-[#eef2fb] text-[#5e6f98]"
                  }`}
                >
                  {tabCounts[tab.key] || 0}
                </span>
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="rounded-lg border border-[#e8ecf6] bg-[#fafcff] px-4 py-6 text-sm font-semibold text-[#5d6c91]">
            Memuat data bimbingan...
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="rounded-lg border border-[#e8ecf6] bg-[#fafcff] px-4 py-6 text-center text-sm font-semibold text-[#7b88ab]">
            Tidak ada sesi pada tab ini.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRows.map((row) => {
              const canSubmitResume =
                row.status_permohonan === "approved" &&
                (row.status_resume === "belum_diisi" || row.status_resume === "revisi");

              return (
                <article key={`row-bimbingan-${row.id}`} className="rounded-lg border border-[#e6ecf8] bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-[#1b274b]">Sesi #{row.id}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-[#4e5e86]">
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-4 w-4" />
                          {formatDate(row.permintaan_tanggal)} | {row.permintaan_jam}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock3 className="h-4 w-4" />
                          Diajukan: {formatDateTime(row.createdAt)}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusBadge(row.status_permohonan)}`}>
                        {row.status_permohonan_label}
                      </span>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${resumeBadge(row.status_resume)}`}>
                        Resume: {row.status_resume_label}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
                    <div className="rounded-md border border-[#edf1fa] bg-[#fafcff] p-3">
                      <p className="text-xs font-bold text-[#63739b]">Pesan Mahasiswa</p>
                      <p className="mt-1 text-sm text-[#2b3f74]">{row.permintaan_pesan}</p>
                    </div>
                    <div className="rounded-md border border-[#edf1fa] bg-[#fafcff] p-3">
                      <p className="text-xs font-bold text-[#63739b]">Catatan Dosen</p>
                      <p className="mt-1 text-sm text-[#2b3f74]">{row.catatan_dosen || "-"}</p>
                      <p className="mt-2 inline-flex items-center gap-1 text-sm text-[#42588f]">
                        <MapPin className="h-4 w-4" />
                        Lokasi: {row.lokasi_bimbingan || "-"}
                      </p>
                    </div>
                  </div>

                  {row.resume_mahasiswa ? (
                    <div className="mt-3 rounded-md border border-[#edf1fa] bg-[#fafcff] p-3">
                      <p className="text-xs font-bold text-[#63739b]">Resume Mahasiswa</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-[#2b3f74]">{row.resume_mahasiswa}</p>
                    </div>
                  ) : null}

                  {row.catatan_review_resume ? (
                    <div className="mt-3 rounded-md border border-[#edf1fa] bg-[#fafcff] p-3">
                      <p className="text-xs font-bold text-[#63739b]">Catatan Review Dosen</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-[#2b3f74]">{row.catatan_review_resume}</p>
                    </div>
                  ) : null}

                  {canSubmitResume ? (
                    <div className="mt-3 rounded-md border border-[#dce6ff] bg-[#f7faff] p-3">
                      <p className="text-sm font-bold text-[#1b274b]">Kirim Resume Bimbingan</p>
                      <textarea
                        rows={3}
                        value={resumeDraft[row.id] || ""}
                        onChange={(event) =>
                          setResumeDraft((prev) => ({
                            ...prev,
                            [row.id]: event.target.value,
                          }))
                        }
                        placeholder="Tuliskan ringkasan hasil diskusi dan rencana tindak lanjut..."
                        className="mt-2 w-full rounded-lg border border-[#cfdaf0] px-3 py-2 text-sm text-[#1b274b] outline-none focus:border-[#2f63e3]"
                      />
                      <div className="mt-2 flex justify-end">
                        <button
                          type="button"
                          disabled={submittingResumeId === row.id}
                          onClick={() => handleSubmitResume(row.id)}
                          className="inline-flex items-center gap-2 rounded-lg bg-[#2f63e3] px-4 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-55"
                        >
                          {submittingResumeId === row.id ? "Mengirim..." : "Kirim Resume"}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {row.status_permohonan === "approved" && row.status_resume === "submitted" ? (
                    <div className="mt-3 inline-flex items-center gap-2 rounded-md bg-[#edf3ff] px-3 py-2 text-sm font-semibold text-[#2f63e3]">
                      <Clock3 className="h-4 w-4" />
                      Resume sedang menunggu review dosen pembimbing.
                    </div>
                  ) : null}

                  {row.status_resume === "approved" && row.is_counted ? (
                    <div className="mt-3 inline-flex items-center gap-2 rounded-md bg-[#e8f8ef] px-3 py-2 text-sm font-semibold text-[#1f8a58]">
                      <CheckCircle2 className="h-4 w-4" />
                      Sesi ini sudah dihitung ke progres minimal 8 bimbingan.
                    </div>
                  ) : null}

                  {row.status_permohonan === "rejected" ? (
                    <div className="mt-3 inline-flex items-center gap-2 rounded-md bg-[#ffeded] px-3 py-2 text-sm font-semibold text-[#b03d3d]">
                      <XCircle className="h-4 w-4" />
                      Permohonan ditolak. Silakan ajukan jadwal baru.
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

export default BimbinganPage;
