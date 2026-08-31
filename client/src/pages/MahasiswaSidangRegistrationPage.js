import React, { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Clock3, Download, Eye, FileCheck2, RefreshCcw, Send, Upload, XCircle } from "lucide-react";
import Swal from "sweetalert2";

function formatDate(value, withTime = false) {
  if (!value) return "-";
  const date = withTime ? new Date(value) : new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
}

function statusLabel(value) {
  const status = String(value || "").toLowerCase();
  if (status === "submitted") return "Menunggu Penjadwalan";
  if (status === "scheduled") return "Sudah Dijadwalkan";
  if (status === "cancelled") return "Dibatalkan";
  return value || "Belum Mendaftar";
}

function documentStatusLabel(value) {
  const status = String(value || "").toLowerCase();
  if (status === "approved") return "Disetujui";
  if (status === "submitted") return "Menunggu Review";
  if (status === "revisi") return "Perlu Revisi";
  if (status === "belum_upload") return "Belum Diunggah";
  return value || "Belum Diunggah";
}

function decisionLabel(value) {
  const status = String(value || "").toLowerCase();
  if (status === "lulus") return "Lulus";
  if (status === "lulus_dengan_revisi") return "Lulus dengan Revisi";
  if (status === "tidak_lulus") return "Tidak Lulus";
  return "Menunggu Keputusan";
}

function graduationLabel(value) {
  const status = String(value || "").toLowerCase();
  if (status === "lulus") return "Lulus Sepenuhnya";
  if (status === "lulus_bersyarat") return "Wajib Menyelesaikan Revisi";
  if (status === "tidak_lulus") return "Tidak Lulus";
  return "Menunggu Hasil Sidang";
}

function RequirementCard({ title, fulfilled, description, icon: Icon = FileCheck2 }) {
  return (
    <div className={`rounded-xl border p-4 ${fulfilled ? "border-[#c8ead6] bg-[#f1fbf5]" : "border-[#f0d7a6] bg-[#fffaf0]"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className={`rounded-lg p-2 ${fulfilled ? "bg-[#daf3e4] text-[#147347]" : "bg-[#fff0c9] text-[#956800]"}`}><Icon className="h-5 w-5" /></span>
          <div><p className="font-bold text-[#1f2d53]">{title}</p><p className="mt-1 text-sm text-[#60709a]">{description}</p></div>
        </div>
        {fulfilled ? <CheckCircle2 className="h-5 w-5 shrink-0 text-[#198754]" /> : <XCircle className="h-5 w-5 shrink-0 text-[#c27a00]" />}
      </div>
    </div>
  );
}

function MahasiswaSidangRegistrationPage({ session, apiBaseUrl, onSessionExpired }) {
  const [activeSection, setActiveSection] = useState("registration");
  const [view, setView] = useState("list");
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState("");
  const [validationErrors, setValidationErrors] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [detail, setDetail] = useState(null);
  const [result, setResult] = useState(null);
  const [revisionFile, setRevisionFile] = useState(null);
  const [revisionResponse, setRevisionResponse] = useState("");
  const [uploadingRevision, setUploadingRevision] = useState(false);

  const fetchWithAuth = useCallback(async (path, options = {}) => {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      headers: { Authorization: `Bearer ${session.token}`, ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }), ...(options.headers || {}) },
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
      const response = await fetchWithAuth("/api/mahasiswa/sidang/periode");
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.success) throw new Error(body?.message || "Gagal memuat periode sidang.");
      setPeriods(Array.isArray(body?.data?.rows) ? body.data.rows : []);
    } catch (loadError) {
      if (loadError.message !== "__SESSION_EXPIRED__") setError(loadError.message || "Gagal memuat periode sidang.");
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  const loadDetail = useCallback(async (periodId) => {
    try {
      setLoading(true);
      setError("");
      setValidationErrors([]);
      const response = await fetchWithAuth(`/api/mahasiswa/sidang/periode/${periodId}`);
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.success) throw new Error(body?.message || "Gagal memuat detail pendaftaran sidang.");
      setDetail(body?.data || null);
      setView("detail");
    } catch (loadError) {
      if (loadError.message !== "__SESSION_EXPIRED__") setError(loadError.message || "Gagal memuat detail pendaftaran sidang.");
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  const loadResult = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const response = await fetchWithAuth("/api/mahasiswa/sidang/hasil");
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.success) throw new Error(body?.message || "Gagal memuat hasil sidang.");
      setResult(body.data || null);
    } catch (loadError) {
      if (loadError.message !== "__SESSION_EXPIRED__") setError(loadError.message || "Gagal memuat hasil sidang.");
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  const uploadRevision = async () => {
    if (!revisionFile || revisionResponse.trim().length < 10) {
      setError("Pilih file revisi dan isi tanggapan revisi minimal 10 karakter.");
      return;
    }
    try {
      setUploadingRevision(true);
      setError("");
      const formData = new FormData();
      formData.append("file", revisionFile);
      formData.append("tanggapan_revisi", revisionResponse.trim());
      const response = await fetchWithAuth("/api/mahasiswa/sidang/revisi/upload", { method: "POST", body: formData });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.success) throw new Error(body?.message || "Gagal mengunggah revisi sidang.");
      setRevisionFile(null);
      setRevisionResponse("");
      await loadResult();
      Swal.fire({ toast: true, position: "top-end", icon: "success", title: body.message || "Revisi berhasil diunggah.", showConfirmButton: false, timer: 3000, timerProgressBar: true });
    } catch (uploadError) {
      if (uploadError.message !== "__SESSION_EXPIRED__") setError(uploadError.message || "Gagal mengunggah revisi sidang.");
    } finally {
      setUploadingRevision(false);
    }
  };

  const downloadRevision = async (revision) => {
    try {
      const response = await fetchWithAuth(`/api/mahasiswa/sidang/revisi/${revision.id}/download`);
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

  useEffect(() => { loadPeriods().catch(() => {}); }, [loadPeriods]);

  const handleRegister = async () => {
    if (!detail?.periode_sidang?.id) return;
    const confirmation = await Swal.fire({
      title: "Konfirmasi Pendaftaran Sidang",
      text: `Apakah Anda yakin ingin mendaftar pada periode ${detail.periode_sidang.label_periode}?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Ya, Daftar",
      cancelButtonText: "Batal",
      confirmButtonColor: "#2f63e3",
      cancelButtonColor: "#64748b",
      reverseButtons: true,
      focusCancel: true,
    });
    if (!confirmation.isConfirmed) return;
    try {
      setRegistering(true);
      setError("");
      setValidationErrors([]);
      const response = await fetchWithAuth("/api/mahasiswa/sidang/daftar", {
        method: "POST",
        body: JSON.stringify({ periode_sidang_id: detail.periode_sidang.id }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.success) {
        const errors = Array.isArray(body?.data?.validation_errors) ? body.data.validation_errors : [];
        setValidationErrors(errors);
        throw new Error(body?.message || "Pendaftaran sidang gagal.");
      }
      await loadDetail(detail.periode_sidang.id);
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: body?.message || "Pendaftaran sidang berhasil dikirim.",
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
      });
    } catch (registerError) {
      if (registerError.message !== "__SESSION_EXPIRED__") setError(registerError.message || "Pendaftaran sidang gagal.");
    } finally {
      setRegistering(false);
    }
  };

  const eligibility = detail?.eligibility || {};
  const counted = Number(eligibility.counted_sessions || 0);
  const target = Number(eligibility.target_minimum || 0);
  const progress = Math.max(0, Math.min(100, Math.round((counted / Math.max(target, 1)) * 100)));
  const documents = Array.isArray(eligibility.dokumen) ? eligibility.dokumen : [];
  const requiredCourse = eligibility.mata_kuliah_penjaluran || null;
  const registration = detail?.pendaftaran || null;
  const hasActiveRegistration = Boolean(registration && String(registration.status || "").toLowerCase() !== "cancelled");
  const canAttemptRegister = Boolean(detail?.registration_window_open) && !hasActiveRegistration;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {error ? <div className="rounded-xl border border-[#f3caca] bg-[#fff2f2] p-4 text-sm font-semibold text-[#a03f3f]">{error}</div> : null}

      <section className="rounded-xl border border-[#e4e9f6] bg-white p-3 shadow-sm">
        <h3 className="text-lg font-black text-[#1b274b]">Menu Sidang</h3>
        <div className="mt-2 flex flex-wrap gap-2">{[
          { id: "registration", label: "Pendaftaran & Jadwal" },
          { id: "result", label: "Hasil Sidang & Revisi" },
        ].map((item) => <button key={item.id} type="button" onClick={() => { setActiveSection(item.id); setView("list"); setDetail(null); setError(""); if (item.id === "result") loadResult().catch(() => {}); else loadPeriods().catch(() => {}); }} className={`rounded-full border px-3 py-1.5 text-sm font-bold ${activeSection === item.id ? "border-[#2f63e3] bg-[#2f63e3] text-white" : "border-[#cfd8ef] bg-white text-[#2f4477]"}`}>{item.label}</button>)}</div>
      </section>

      {activeSection === "registration" ? <section className="rounded-xl border border-[#e4e9f6] bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={view === "list"} onClick={() => { setView("list"); setDetail(null); setError(""); setValidationErrors([]); loadPeriods().catch(() => {}); }} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#d3dbef] text-[#27407b] hover:bg-[#f3f6ff] disabled:cursor-not-allowed disabled:opacity-50"><ArrowLeft className="h-4 w-4" /></button>
          <button type="button" disabled={loading} onClick={() => { if (view === "detail" && detail?.periode_sidang?.id) loadDetail(detail.periode_sidang.id).catch(() => {}); else loadPeriods().catch(() => {}); }} className="inline-flex items-center gap-2 rounded-lg border border-[#d3dbef] px-3 py-2 text-sm font-semibold text-[#27407b] hover:bg-[#f3f6ff] disabled:opacity-60"><RefreshCcw className="h-4 w-4" />Refresh</button>
        </div>
      </section> : <section className="rounded-xl border border-[#e4e9f6] bg-white p-3 shadow-sm"><button type="button" disabled={loading} onClick={() => loadResult().catch(() => {})} className="inline-flex items-center gap-2 rounded-lg border border-[#d3dbef] px-3 py-2 text-sm font-semibold text-[#27407b] hover:bg-[#f3f6ff] disabled:opacity-60"><RefreshCcw className="h-4 w-4" />Refresh</button></section>}

      {activeSection === "registration" && view === "list" ? (
        <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
          <div><h3 className="text-lg font-black text-[#1b274b]">Grid Periode Pendaftaran Sidang</h3><p className="mt-1 text-sm text-[#66769a]">Pilih tombol Pendaftaran untuk melihat kelayakan dan mendaftar sidang.</p></div>
          <div className="relative mt-3 flex-1 overflow-auto rounded-lg border border-[#e6ecf8] grid-unified-height">
            <table className="w-full min-w-[1050px] text-left text-sm"><thead><tr className="border-y border-[#e6ecf8] text-[#4d5e89]"><th className="bg-[#f8fbff] px-3 py-2 font-semibold">No</th><th className="bg-[#f8fbff] px-3 py-2 font-semibold">Periode</th><th className="bg-[#f8fbff] px-3 py-2 font-semibold">Tahun Akademik</th><th className="bg-[#f8fbff] px-3 py-2 font-semibold">Semester</th><th className="bg-[#f8fbff] px-3 py-2 font-semibold">Rentang Pendaftaran</th><th className="bg-[#f8fbff] px-3 py-2 font-semibold">Status Periode</th><th className="bg-[#f8fbff] px-3 py-2 font-semibold">Status Pendaftaran</th><th className="bg-[#f8fbff] px-3 py-2 font-semibold">Aksi</th></tr></thead>
              <tbody>{periods.map((item, index) => <tr key={item.id} className="border-b border-[#eff3fb]"><td className="px-3 py-2">{index + 1}</td><td className="px-3 py-2 font-bold text-[#1f2d53]">{item.label_periode}</td><td className="px-3 py-2">{item.tahun_akademik}</td><td className="px-3 py-2 capitalize">{item.semester}</td><td className="px-3 py-2">{formatDate(item.tanggal_mulai_pendaftaran)} s/d {formatDate(item.tanggal_selesai_pendaftaran)}</td><td className="px-3 py-2"><span className={`rounded-full px-2 py-1 text-xs font-bold ${item.registration_window_open ? "bg-[#e5f8ed] text-[#147347]" : "bg-[#eef2fb] text-[#59678e]"}`}>{item.registration_window_open ? "Pendaftaran Dibuka" : "Ditutup"}</span></td><td className="px-3 py-2">{statusLabel(item.pendaftaran?.status)}</td><td className="px-3 py-2"><button type="button" onClick={() => loadDetail(item.id).catch(() => {})} className="inline-flex items-center gap-1 rounded-md bg-[#2f63e3] px-3 py-1.5 text-xs font-bold text-white hover:brightness-110"><Eye className="h-3.5 w-3.5" />Pendaftaran</button></td></tr>)}</tbody>
            </table>
            {!loading && periods.length === 0 ? <div className="absolute inset-x-0 bottom-0 top-[41px] flex items-center justify-center text-sm font-semibold text-[#7b88ab]">Belum ada periode pendaftaran sidang.</div> : null}
            {loading ? <div className="absolute inset-x-0 bottom-0 top-[41px] flex items-center justify-center text-sm font-semibold text-[#7b88ab]">Memuat periode sidang...</div> : null}
          </div>
        </section>
      ) : null}

      {activeSection === "registration" && view === "detail" && detail?.periode_sidang ? (
        <>
          <section className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-black text-[#1b274b]">Pendaftaran — {detail.periode_sidang.label_periode}</h3><p className="mt-1 text-sm text-[#66769a]">Periksa seluruh syarat sebelum mengirim pendaftaran.</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${detail.registration_window_open ? "bg-[#e5f8ed] text-[#147347]" : "bg-[#eef2fb] text-[#59678e]"}`}>{detail.registration_window_open ? "Pendaftaran Dibuka" : "Pendaftaran Ditutup"}</span></div>
            <p className="mt-3 text-sm text-[#4f6088]">Rentang pendaftaran: {formatDate(detail.periode_sidang.tanggal_mulai_pendaftaran)} s/d {formatDate(detail.periode_sidang.tanggal_selesai_pendaftaran)}</p>
          </section>

          <section className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
            <h3 className="text-lg font-black text-[#1b274b]">Kelayakan Pendaftaran Sidang</h3>
            <div className={`mt-4 rounded-xl border p-4 ${eligibility.bimbingan_ready ? "border-[#c8ead6] bg-[#f1fbf5]" : "border-[#f0d7a6] bg-[#fffaf0]"}`}>
              <div className="flex items-center justify-between gap-3"><div><p className="font-bold text-[#1f2d53]">Progress Bimbingan Skripsi</p><p className="mt-1 text-sm text-[#60709a]">{counted} dari minimal {target} sesi tervalidasi</p></div><span className="text-sm font-black text-[#274b9f]">{progress}%</span></div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-[#dfe6f7]"><div className={`h-full rounded-full ${eligibility.bimbingan_ready ? "bg-[#198754]" : "bg-gradient-to-r from-[#2f63e3] to-[#2740a3]"}`} style={{ width: `${progress}%` }} /></div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">{documents.map((document) => <RequirementCard key={document.key} title={document.label} fulfilled={Boolean(document.approved)} description={`Status: ${documentStatusLabel(document.status)}`} />)}</div>

            {requiredCourse?.required ? (
              <div className={`mt-4 rounded-xl border p-4 ${requiredCourse.fulfilled ? "border-[#c8ead6] bg-[#f1fbf5]" : "border-[#f0d7a6] bg-[#fffaf0]"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className={`rounded-lg p-2 ${requiredCourse.fulfilled ? "bg-[#daf3e4] text-[#147347]" : "bg-[#fff0c9] text-[#956800]"}`}><FileCheck2 className="h-5 w-5" /></span>
                    <div>
                      <p className="font-bold text-[#1f2d53]">Nilai Mata Kuliah Wajib Penjaluran</p>
                      <p className="mt-1 text-sm text-[#60709a]">Jalur: {requiredCourse.jalur_label || requiredCourse.jalur || "-"}</p>
                      <p className="mt-1 text-sm text-[#60709a]">Mata kuliah: {[requiredCourse.kode_mata_kuliah, requiredCourse.mata_kuliah].filter(Boolean).join(" — ") || "Mapping belum tersedia"}</p>
                      <p className="mt-1 text-sm text-[#60709a]">Nilai: <span className="font-bold text-[#1f2d53]">{requiredCourse.nilai || "Belum tersedia"}</span> · Minimum lulus: {requiredCourse.minimum_passing_grade || "C"} · Status: {requiredCourse.status || "Belum tersedia"}</p>
                    </div>
                  </div>
                  {requiredCourse.fulfilled ? <CheckCircle2 className="h-5 w-5 shrink-0 text-[#198754]" /> : <XCircle className="h-5 w-5 shrink-0 text-[#c27a00]" />}
                </div>
              </div>
            ) : null}

            {validationErrors.length ? <div className="mt-4 rounded-xl border border-[#efc2c2] bg-[#fff3f3] p-4"><p className="font-bold text-[#9f3434]">Pendaftaran belum dapat dikirim:</p><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#9f3434]">{validationErrors.map((item, index) => <li key={`${item.code || item.field}-${index}`}>{item.message}</li>)}</ul></div> : null}

            {registration ? <div className="mt-4 rounded-xl border border-[#cbd9f4] bg-[#f5f8ff] p-4 text-sm text-[#405887]"><p className="font-bold text-[#1f2d53]">Status Pendaftaran: {statusLabel(registration.status)}</p><p className="mt-1">Dikirim: {formatDate(registration.registered_at, true)}</p>{registration.jadwal_sidang ? <p className="mt-1">Jadwal: {formatDate(registration.jadwal_sidang.tanggal_sidang)} · Sesi {registration.jadwal_sidang.sesi_ke} · {registration.jadwal_sidang.ruangan}</p> : <p className="mt-1">Jadwal sidang belum ditetapkan.</p>}</div> : null}

            <div className="mt-4 flex justify-end border-t border-[#e7edf8] pt-4"><button type="button" disabled={!canAttemptRegister || registering} onClick={() => handleRegister().catch(() => {})} className="inline-flex items-center gap-2 rounded-lg bg-[#2f63e3] px-4 py-2 text-sm font-bold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"><Send className="h-4 w-4" />{registering ? "Mengirim..." : hasActiveRegistration ? "Sudah Mendaftar" : "Daftar Sidang"}</button></div>
            {!detail.registration_window_open && !registration ? <p className="mt-2 text-right text-xs font-semibold text-[#8a6a20]"><Clock3 className="mr-1 inline h-3.5 w-3.5" />Pendaftaran hanya dapat dikirim selama rentang periode aktif.</p> : null}
          </section>
        </>
      ) : null}

      {activeSection === "result" ? (
        !result ? (
          <section className="flex min-h-[360px] items-center justify-center rounded-xl border border-[#e4e9f6] bg-white p-6 text-center shadow-sm"><div><Clock3 className="mx-auto h-10 w-10 text-[#8593b3]" /><p className="mt-3 font-black text-[#263a66]">Belum Ada Hasil Sidang</p><p className="mt-1 text-sm text-[#66769a]">Jadwal atau hasil penilaian sidang Anda belum tersedia.</p></div></section>
        ) : (
          <div className="space-y-4">
            <section className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-black text-[#1b274b]">Hasil Sidang</h3><p className="mt-1 text-sm text-[#66769a]">{formatDate(result.tanggal_sidang)} · {result.sesi_mulai}–{result.sesi_selesai} · {result.ruangan}</p></div><span className={`rounded-full px-3 py-1.5 text-xs font-black ${result.keputusan?.status_kelulusan === "lulus" ? "bg-[#e5f8ed] text-[#147347]" : result.keputusan?.status_kelulusan === "tidak_lulus" ? "bg-[#ffe9e9] text-[#b73a3a]" : "bg-[#fff4d9] text-[#926600]"}`}>{graduationLabel(result.keputusan?.status_kelulusan)}</span></div>
              {!result.keputusan ? <div className="mt-4 rounded-xl border border-[#f0d7a6] bg-[#fffaf0] p-4 text-sm font-semibold text-[#8a6200]">Keputusan akhir belum tersedia karena penilaian kedua penguji belum lengkap.</div> : <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2"><div className="rounded-xl border border-[#dfe7f5] bg-[#f8fbff] p-4"><p className="text-xs font-bold uppercase text-[#7582a2]">Keputusan Sidang</p><p className="mt-1 text-xl font-black text-[#263a66]">{decisionLabel(result.keputusan.keputusan)}</p></div><div className="rounded-xl border border-[#dfe7f5] bg-[#f8fbff] p-4"><p className="text-xs font-bold uppercase text-[#7582a2]">Nilai Akhir</p><p className="mt-1 text-xl font-black text-[#263a66]">{result.keputusan.nilai_akhir}</p></div></div>}
            </section>

            {result.keputusan ? <section className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm"><h3 className="text-lg font-black text-[#1b274b]">Catatan Dosen Penguji</h3><div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">{(result.penilaians || []).map((item) => <div key={item.id} className="rounded-xl border border-[#dfe7f5] bg-[#fbfcff] p-4"><p className="font-black text-[#263a66]">{item.peran === "penguji1" ? "Penguji 1" : "Penguji 2"} — {item.dosen?.nama || "-"}</p><p className="mt-2 text-sm text-[#52658f]">Nilai: <b>{item.nilai_akhir}</b> · {decisionLabel(item.keputusan)}</p>{item.catatan ? <div className="mt-3 text-sm text-[#52658f]"><b>Catatan penilaian:</b><p className="mt-1 whitespace-pre-wrap">{item.catatan}</p></div> : null}{item.catatan_revisi ? <div className="mt-3 rounded-lg border border-[#f0d7a6] bg-[#fffaf0] p-3 text-sm text-[#765900]"><b>Revisi wajib:</b><p className="mt-1 whitespace-pre-wrap">{item.catatan_revisi}</p></div> : null}</div>)}</div></section> : null}

            {result.keputusan?.status_kelulusan === "lulus_bersyarat" ? <section className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm"><h3 className="text-lg font-black text-[#1b274b]">Upload Skripsi Hasil Revisi</h3><p className="mt-1 text-sm text-[#66769a]">Unggah versi terbaru dan jelaskan bagaimana setiap catatan dosen telah ditindaklanjuti.</p>{result.revisi_terakhir?.status === "submitted" ? <div className="mt-4 rounded-xl border border-[#cbd9f4] bg-[#f5f8ff] p-4 text-sm font-semibold text-[#405887]">Revisi versi {result.revisi_terakhir.versi} sedang menunggu review dosen.</div> : <div className="mt-4 rounded-xl border border-[#dfe7f5] bg-[#f8fbff] p-4"><label className="block text-sm font-bold text-[#263b6f]">File Skripsi Revisi <span className="text-[#b73a3a]">*</span><input type="file" accept=".pdf,.doc,.docx" onChange={(event) => setRevisionFile(event.target.files?.[0] || null)} className="mt-2 block w-full rounded-lg border border-[#d1daf0] bg-white px-3 py-2 font-normal" /></label><label className="mt-4 block text-sm font-bold text-[#263b6f]">Tanggapan Revisi <span className="text-[#b73a3a]">*</span><textarea rows="5" value={revisionResponse} onChange={(event) => setRevisionResponse(event.target.value)} placeholder="Jelaskan perubahan yang dilakukan berdasarkan catatan para penguji" className="mt-2 w-full rounded-lg border border-[#d1daf0] bg-white px-3 py-2 font-normal" /></label><div className="mt-4 flex justify-end"><button type="button" disabled={uploadingRevision || !revisionFile || revisionResponse.trim().length < 10} onClick={() => uploadRevision().catch(() => {})} className="inline-flex items-center gap-2 rounded-lg bg-[#2f63e3] px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"><Upload className="h-4 w-4" />{uploadingRevision ? "Mengunggah..." : `Unggah ${result.revisi_terakhir ? "Revisi Berikutnya" : "Revisi"}`}</button></div></div>}</section> : null}

            {(result.keputusan?.revisis || []).length ? <section className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm"><h3 className="text-lg font-black text-[#1b274b]">Riwayat Revisi</h3><div className="mt-4 space-y-3">{[...result.keputusan.revisis].sort((left, right) => Number(right.versi) - Number(left.versi)).map((revision) => <div key={revision.id} className="rounded-xl border border-[#dfe7f5] bg-[#fbfcff] p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-black text-[#263a66]">Revisi Versi {revision.versi}</p><p className="mt-1 text-xs text-[#7582a2]">{revision.file_name} · {formatDate(revision.uploaded_at, true)}</p></div><button type="button" onClick={() => downloadRevision(revision).catch(() => {})} className="inline-flex items-center gap-2 rounded-lg border border-[#b9c9ec] bg-white px-3 py-2 text-xs font-bold text-[#294a91]"><Download className="h-3.5 w-3.5" />Unduh</button></div><p className="mt-3 whitespace-pre-wrap text-sm text-[#52658f]">{revision.tanggapan_revisi}</p><div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">{(revision.persetujuans || []).map((approval) => <div key={approval.id} className="rounded-lg border border-[#e5eaf5] bg-white p-3 text-sm"><p className="font-bold text-[#263a66]">{approval.dosen?.nama || "Dosen Penguji"}</p><p className="mt-1 capitalize text-[#60709a]">{String(approval.status || "pending").replaceAll("_", " ")}</p>{approval.catatan ? <p className="mt-2 text-[#9a4b36]">{approval.catatan}</p> : null}</div>)}</div></div>)}</div></section> : null}
          </div>
        )
      ) : null}
    </div>
  );
}

export default MahasiswaSidangRegistrationPage;
