import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

const STATE_LABELS = {
  available: "Data tersedia",
  unavailable: "Data belum tersedia",
  incomplete: "Data belum lengkap",
  conflicted: "Data berkonflik",
};

function Badge({ children, tone = "blue" }) {
  const classes = tone === "green" ? "bg-emerald-100 text-emerald-800" : tone === "red" ? "bg-rose-100 text-rose-800" : tone === "amber" ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${classes}`}>{children}</span>;
}

function StudentSummary({ data }) {
  const snapshot = data?.snapshot;
  if (!snapshot) return <p className="text-sm text-[#607096]">Belum ada snapshot akademik.</p>;
  const stateTone = snapshot.data_state === "available" ? "green" : snapshot.data_state === "conflicted" ? "red" : "amber";
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={stateTone}>{STATE_LABELS[snapshot.data_state] || snapshot.data_state}</Badge>
        <Badge>{snapshot.calculation_status}</Badge>
        <span className="text-xs text-[#66769a]">Dihitung {snapshot.calculated_at ? new Date(snapshot.calculated_at).toLocaleString("id-ID") : "-"}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg bg-[#f4f7ff] p-4"><p className="text-xs font-semibold text-[#6b7898]">SKS diambil</p><p className="mt-1 text-2xl font-black text-[#26375f]">{Number(snapshot.total_sks_diambil || 0)}</p></div>
        <div className="rounded-lg bg-[#eefaf4] p-4"><p className="text-xs font-semibold text-[#527966]">SKS lulus</p><p className="mt-1 text-2xl font-black text-[#24593c]">{Number(snapshot.total_sks_lulus || 0)}</p></div>
        <div className="rounded-lg bg-[#fff8e8] p-4"><p className="text-xs font-semibold text-[#886d32]">Wajib lulus</p><p className="mt-1 text-2xl font-black text-[#6f5315]">{snapshot.wajib_lulus}/{snapshot.wajib_total}</p></div>
        <div className="rounded-lg bg-[#f7f2ff] p-4"><p className="text-xs font-semibold text-[#725c91]">Metodologi</p><p className="mt-1 text-lg font-black text-[#513b71]">{snapshot.metodologi_status?.replaceAll("_", " ") || "Belum diketahui"}</p></div>
      </div>
      {snapshot.wajib_belum_lulus?.length ? <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><b>Mata kuliah wajib belum terpenuhi:</b> {snapshot.wajib_belum_lulus.join(", ")}</div> : null}
      {snapshot.quality_issues?.length ? <div className="rounded-lg border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-bold text-slate-700">Kualitas data</p><ul className="mt-1 list-disc pl-5 text-sm text-slate-600">{snapshot.quality_issues.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}
      <div className="overflow-x-auto rounded-lg border border-[#dce4f4]">
        <table className="min-w-full text-left text-sm"><thead className="bg-[#f4f7fc] text-[#445476]"><tr><th className="px-3 py-2">Periode</th><th className="px-3 py-2">Mata kuliah</th><th className="px-3 py-2">Nilai</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">SKS lulus</th></tr></thead>
          <tbody>{(data.attempts || []).map((row) => <tr key={row.id} className="border-t border-[#e5eaf4]"><td className="px-3 py-2">#{row.periode_akademik_id}</td><td className="px-3 py-2">#{row.mata_kuliah_id}</td><td className="px-3 py-2">{row.nilai_huruf ?? row.nilai_angka ?? "-"}</td><td className="px-3 py-2">{row.status_kelulusan}</td><td className="px-3 py-2">{Number(row.sks_lulus || 0)}</td></tr>)}</tbody>
        </table>
      </div>
      <p className="text-xs text-[#6d7895]">Data ini hanya-baca. Jika ada ketidaksesuaian, hubungi Admin Prodi dan sertakan bukti akademik; perubahan dilakukan melalui alur koreksi teraudit.</p>
    </div>
  );
}

function AdminImport({ api, token, onChanged }) {
  const [sources, setSources] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [periodDrafts, setPeriodDrafts] = useState({});
  const [file, setFile] = useState(null);
  const [dataset, setDataset] = useState("course_attempts");
  const [sourceId, setSourceId] = useState("");
  const [periodId, setPeriodId] = useState("");
  const [batch, setBatch] = useState(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const commitKeyRef = useRef(null);

  const loadMaster = useCallback(async () => {
    const headers = { Authorization: `Bearer ${token}` };
    const [sourceResponse, periodResponse] = await Promise.all([fetch(`${api}/api/admin/akademik/sources`, { headers }), fetch(`${api}/api/admin/akademik/periode`, { headers })]);
    const [sourcePayload, periodPayload] = await Promise.all([sourceResponse.json(), periodResponse.json()]);
    const loadedPeriods = periodPayload.data || [];
    setSources(sourcePayload.data || []); setPeriods(loadedPeriods);
    setPeriodDrafts(Object.fromEntries(loadedPeriods.map((period) => [period.id, {
      tanggal_mulai: period.tanggal_mulai ? String(period.tanggal_mulai).slice(0, 10) : "",
      tanggal_selesai: period.tanggal_selesai ? String(period.tanggal_selesai).slice(0, 10) : "",
    }])));
  }, [api, token]);
  useEffect(() => { loadMaster().catch((error) => setMessage(error.message)); }, [loadMaster]);

  const preview = async (event) => {
    event.preventDefault(); if (!file || !sourceId) return;
    setBusy(true); setMessage(""); setBatch(null);
    try {
      const form = new FormData(); form.append("file", file); form.append("dataset_type", dataset); form.append("schema_version", "v1"); form.append("source_id", sourceId); if (periodId) form.append("periode_akademik_id", periodId);
      const response = await fetch(`${api}/api/admin/akademik/imports`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Idempotency-Key": window.crypto?.randomUUID?.() || String(Date.now()) }, body: form });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.message || "Preview gagal."); setBatch(payload.data); setMessage(payload.replayed ? "Preview replay ditemukan." : "Preview berhasil dibuat.");
    } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  };
  const commit = async () => {
    if (!batch) return; setBusy(true); setMessage(""); if (!commitKeyRef.current) commitKeyRef.current = window.crypto?.randomUUID?.() || String(Date.now());
    try {
      const response = await fetch(`${api}/api/admin/akademik/imports/${batch.id}/commit`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "Idempotency-Key": commitKeyRef.current }, body: JSON.stringify({ validation_checksum: batch.validation_checksum }) });
      const payload = await response.json(); if (!response.ok) { commitKeyRef.current = null; throw new Error(payload.message || "Commit gagal."); } commitKeyRef.current = null; setBatch(payload.data); setMessage(payload.replayed ? "Commit diputar ulang dengan aman." : "Data akademik berhasil di-commit."); onChanged?.();
    } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  };
  const updatePeriodDraft = (id, field, value) => setPeriodDrafts((current) => ({ ...current, [id]: { ...current[id], [field]: value } }));
  const savePeriod = async (period) => {
    const draft = periodDrafts[period.id] || {};
    if (!draft.tanggal_mulai || !draft.tanggal_selesai) { setMessage("Tanggal mulai dan selesai wajib diisi."); return; }
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`${api}/api/admin/akademik/periode/${period.id}`, { method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ tanggal_mulai: draft.tanggal_mulai, tanggal_selesai: draft.tanggal_selesai }) });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.message || "Tanggal periode gagal disimpan.");
      setMessage(`Tanggal resmi ${period.kode} berhasil disimpan.`); await loadMaster(); onChanged?.();
    } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  };
  return <div className="space-y-4">
    <div className="rounded-lg border border-[#dce4f4] p-4">
      <div className="mb-3"><h3 className="font-bold text-[#29385f]">Tanggal Resmi Periode Akademik</h3><p className="text-xs text-[#68769a]">Digunakan sebagai acuan transisi semester dan jendela izin lanjut. Isi berdasarkan kalender akademik resmi.</p></div>
      <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-[#f4f7fc]"><tr><th className="px-3 py-2">Periode</th><th className="px-3 py-2">Mulai</th><th className="px-3 py-2">Selesai</th><th className="px-3 py-2">Aksi</th></tr></thead><tbody>{periods.map((period) => <tr key={period.id} className="border-t"><td className="px-3 py-2 font-semibold">{period.kode}</td><td className="px-3 py-2"><input aria-label={`Tanggal mulai ${period.kode}`} type="date" value={periodDrafts[period.id]?.tanggal_mulai || ""} onChange={(event) => updatePeriodDraft(period.id, "tanggal_mulai", event.target.value)} className="rounded border p-2"/></td><td className="px-3 py-2"><input aria-label={`Tanggal selesai ${period.kode}`} type="date" value={periodDrafts[period.id]?.tanggal_selesai || ""} onChange={(event) => updatePeriodDraft(period.id, "tanggal_selesai", event.target.value)} className="rounded border p-2"/></td><td className="px-3 py-2"><button type="button" disabled={busy} onClick={() => savePeriod(period)} className="rounded bg-[#2f63e3] px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Simpan</button></td></tr>)}</tbody></table></div>
    </div>
    <form onSubmit={preview} className="grid gap-3 rounded-lg border border-[#dce4f4] p-4 md:grid-cols-2"><select value={dataset} onChange={(e) => setDataset(e.target.value)} className="rounded-lg border p-2 text-sm"><option value="course_attempts">Attempt mata kuliah</option><option value="methodology_status">Status Metodologi</option></select><select required value={sourceId} onChange={(e) => setSourceId(e.target.value)} className="rounded-lg border p-2 text-sm"><option value="">Pilih sumber</option>{sources.map((v) => <option key={v.id} value={v.id}>{v.kode} — {v.nama}</option>)}</select><select value={periodId} onChange={(e) => setPeriodId(e.target.value)} className="rounded-lg border p-2 text-sm"><option value="">Periode dari setiap baris</option>{periods.map((v) => <option key={v.id} value={v.id}>{v.kode}</option>)}</select><input required type="file" accept=".xlsx,.xls,.ods" onChange={(e) => setFile(e.target.files?.[0] || null)} className="rounded-lg border p-2 text-sm"/><button disabled={busy} className="rounded-lg bg-[#2f63e3] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? "Memproses…" : "Validasi & preview"}</button></form>
    {message ? <div className="rounded-lg bg-[#f4f7ff] p-3 text-sm font-semibold text-[#334b7e]">{message}</div> : null}
    {batch ? <div className="rounded-lg border border-[#dce4f4] p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-bold text-[#29385f]">Batch #{batch.id}</p><p className="text-sm text-[#68769a]">Status {batch.status} · total {batch.counts?.total || 0} · invalid {batch.counts?.invalid || 0}</p></div><button type="button" disabled={busy || batch.status !== "validated"} onClick={commit} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Commit atomik</button></div></div> : null}
    <AdminOperations api={api} token={token} onMessage={setMessage}/>
  </div>;
}

function AdminOperations({ api, token, onMessage }) {
  const [data, setData] = useState({ imports: [], conflicts: [], corrections: [], jobs: [], outbox: [], rules: [], curricula: [], courses: [] });
  const [studentId, setStudentId] = useState(""); const [student, setStudent] = useState(null);
  const [master, setMaster] = useState({ resource: "sources", kode: "", nama: "", sks: "3" });
  const [assignment, setAssignment] = useState({ mahasiswa_id: "", kurikulum_id: "" });
  const [rule, setRule] = useState({ context: "research_registration", mode: "shadow" });
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" }), [token]);
  const request = useCallback(async (path, options = {}) => {
    const response = await fetch(`${api}${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) } });
    const payload = await response.json(); if (!response.ok) throw new Error(payload.message || "Operasi akademik gagal."); return payload.data;
  }, [api, headers]);
  const load = useCallback(async () => {
    const paths = { imports: "/api/admin/akademik/imports", conflicts: "/api/admin/akademik/conflicts?status=open",
      corrections: "/api/admin/akademik/corrections", jobs: "/api/admin/akademik/snapshot-jobs", outbox: "/api/admin/akademik/outbox",
      rules: "/api/admin/akademik/rule-sets", curricula: "/api/admin/akademik/kurikulum", courses: "/api/admin/akademik/mata-kuliah" };
    const entries = await Promise.all(Object.entries(paths).map(async ([key, path]) => [key, await request(path)])); setData(Object.fromEntries(entries));
  }, [request]);
  useEffect(() => { load().catch((error) => onMessage(error.message)); }, [load, onMessage]);
  const mutate = async (path, body = {}, method = "POST") => { try { await request(path, { method, body: JSON.stringify(body) }); onMessage("Perubahan akademik berhasil disimpan."); await load(); } catch (error) { onMessage(error.message); } };
  const createMaster = async (event) => {
    event.preventDefault(); const common = { kode: master.kode, nama: master.nama };
    const body = master.resource === "sources" ? { ...common, jenis: "manual_import", authority_level: 10 }
      : master.resource === "kurikulum" ? { ...common, kode_program_studi: "INFORMATIKA", program_kuliah: "reguler", status: "draft" }
        : { ...common, sks_default: Number(master.sks), kode_program_studi: "INFORMATIKA", program_kuliah: "reguler", status: "active" };
    await mutate(`/api/admin/akademik/${master.resource}`, body); setMaster((value) => ({ ...value, kode: "", nama: "" }));
  };
  const lookupStudent = async () => { try { setStudent(await request(`/api/admin/akademik/mahasiswa/${Number(studentId)}`)); } catch (error) { onMessage(error.message); } };
  const correct = async (type, record) => {
    const raw = window.prompt("Masukkan perubahan sebagai JSON, contoh: {\"nilai_angka\":80}"); if (!raw) return;
    const reason = window.prompt("Alasan dan dasar bukti koreksi:"); if (!reason) return;
    try { await mutate(`/api/admin/akademik/records/${type}/${record.id}/corrections`, { expected_revision: record.version, reason, changes: JSON.parse(raw) }); await lookupStudent(); }
    catch (error) { onMessage(error.message); }
  };
  const downloadReport = async (batchId) => { try { const response = await fetch(`${api}/api/admin/akademik/imports/${batchId}/report`, { headers: { Authorization: `Bearer ${token}` } }); if (!response.ok) throw new Error("Report gagal diunduh."); const blob = await response.blob(); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `academic_import_${batchId}_report.csv`; link.click(); URL.revokeObjectURL(url); } catch (error) { onMessage(error.message); } };
  return <div className="space-y-4">
    <div className="grid gap-4 lg:grid-cols-2"><form onSubmit={createMaster} className="space-y-2 rounded-lg border p-4"><h3 className="font-bold text-[#29385f]">Master Akademik</h3><select value={master.resource} onChange={(event) => setMaster({ ...master, resource: event.target.value })} className="w-full rounded border p-2"><option value="sources">Sumber data</option><option value="kurikulum">Kurikulum</option><option value="mata-kuliah">Mata kuliah</option></select><input required placeholder="Kode" value={master.kode} onChange={(event) => setMaster({ ...master, kode: event.target.value })} className="w-full rounded border p-2"/><input required placeholder="Nama" value={master.nama} onChange={(event) => setMaster({ ...master, nama: event.target.value })} className="w-full rounded border p-2"/>{master.resource === "mata-kuliah" ? <input type="number" min="0.5" step="0.5" value={master.sks} onChange={(event) => setMaster({ ...master, sks: event.target.value })} className="w-full rounded border p-2"/> : null}<button className="rounded bg-[#2f63e3] px-3 py-2 text-sm font-bold text-white">Tambah master</button></form>
      <form onSubmit={(event) => { event.preventDefault(); mutate(`/api/admin/akademik/mahasiswa/${assignment.mahasiswa_id}/curriculum-assignment`, { kurikulum_id: Number(assignment.kurikulum_id) }); }} className="space-y-2 rounded-lg border p-4"><h3 className="font-bold text-[#29385f]">Assignment Kurikulum</h3><input required type="number" placeholder="ID mahasiswa" value={assignment.mahasiswa_id} onChange={(event) => setAssignment({ ...assignment, mahasiswa_id: event.target.value })} className="w-full rounded border p-2"/><select required value={assignment.kurikulum_id} onChange={(event) => setAssignment({ ...assignment, kurikulum_id: event.target.value })} className="w-full rounded border p-2"><option value="">Pilih kurikulum</option>{data.curricula.map((item) => <option key={item.id} value={item.id}>{item.kode} · {item.nama}</option>)}</select><button className="rounded bg-[#2f63e3] px-3 py-2 text-sm font-bold text-white">Tetapkan</button></form></div>
    <div className="rounded-lg border p-4"><h3 className="font-bold text-[#29385f]">Konflik Terbuka</h3>{data.conflicts.length ? data.conflicts.map((item) => <div key={item.id} className="mt-2 flex flex-wrap items-center gap-2 border-t pt-2 text-sm"><span className="mr-auto">#{item.id} · row #{item.import_row_id}</span><button onClick={() => mutate(`/api/admin/akademik/conflicts/${item.id}/resolve`, { decision: "keep_admin_correction" })} className="rounded bg-slate-700 px-2 py-1 text-white">Pertahankan koreksi</button><button onClick={() => mutate(`/api/admin/akademik/conflicts/${item.id}/resolve`, { decision: "accept_source" })} className="rounded bg-emerald-700 px-2 py-1 text-white">Terima sumber</button><button onClick={() => mutate(`/api/admin/akademik/conflicts/${item.id}/dismiss`, { decision: "dismiss_false_positive" })} className="rounded bg-amber-600 px-2 py-1 text-white">False positive</button></div>) : <p className="mt-2 text-sm text-slate-500">Tidak ada konflik terbuka.</p>}</div>
    <div className="rounded-lg border p-4"><div className="flex gap-2"><input type="number" placeholder="ID mahasiswa" value={studentId} onChange={(event) => setStudentId(event.target.value)} className="rounded border p-2"/><button onClick={lookupStudent} className="rounded bg-slate-700 px-3 text-sm font-bold text-white">Muat fakta</button></div>{student ? <div className="mt-3 space-y-2 text-sm"><b>{student.mahasiswa?.nim} · {student.mahasiswa?.nama}</b>{student.attempts?.map((item) => <div key={`a-${item.id}`} className="flex justify-between border-t pt-2"><span>Attempt #{item.id} · MK #{item.mata_kuliah_id} · v{item.version}</span><button onClick={() => correct("course_attempt", item)} className="text-blue-700">Koreksi</button></div>)}{student.methodology_history?.filter((item) => item.is_active).map((item) => <div key={`m-${item.id}`} className="flex justify-between border-t pt-2"><span>Metodologi #{item.id} · {item.status} · v{item.version}</span><button onClick={() => correct("methodology_history", item)} className="text-blue-700">Koreksi</button></div>)}</div> : null}</div>
    <div className="grid gap-4 lg:grid-cols-2"><div className="rounded-lg border p-4"><h3 className="font-bold">Koreksi Aktif</h3>{data.corrections.filter((item) => item.status === "active").map((item) => <div key={item.id} className="mt-2 flex justify-between border-t pt-2 text-sm"><span>#{item.id} · {item.target_entity}</span><button onClick={() => { const reason = window.prompt("Alasan revoke:"); if (reason) mutate(`/api/admin/akademik/corrections/${item.id}/revoke`, { reason }); }} className="text-rose-700">Revoke</button></div>)}</div><div className="rounded-lg border p-4"><h3 className="font-bold">Rule-set (belum enforcement)</h3><div className="mt-2 flex gap-2"><input value={rule.context} onChange={(event) => setRule({ ...rule, context: event.target.value })} className="min-w-0 flex-1 rounded border p-2"/><select value={rule.mode} onChange={(event) => setRule({ ...rule, mode: event.target.value })} className="rounded border p-2"><option value="shadow">Shadow</option><option value="informational">Informational</option></select><button onClick={() => mutate("/api/admin/akademik/rule-sets", { kode: `RULE-${Date.now()}`, context: rule.context, version: 1, mode: rule.mode, configuration: {} })} className="rounded bg-[#2f63e3] px-2 text-white">Buat</button></div>{data.rules.slice(0, 8).map((item) => <div key={item.id} className="mt-2 flex justify-between border-t pt-2 text-sm"><span>{item.context} · {item.mode} · {item.status}</span>{item.status === "draft" ? <button onClick={() => mutate(`/api/admin/akademik/rule-sets/${item.id}/activate`)} className="text-blue-700">Aktifkan</button> : null}</div>)}</div></div>
    <div className="grid gap-4 lg:grid-cols-3"><div className="rounded-lg border p-4"><h3 className="font-bold">Batch Terbaru</h3>{data.imports.slice(0, 8).map((item) => <div key={item.id} className="mt-2 flex justify-between border-t pt-2 text-sm"><span>#{item.id} · {item.status}</span><button onClick={() => downloadReport(item.id)} className="text-blue-700">Report</button></div>)}</div><div className="rounded-lg border p-4"><h3 className="font-bold">Snapshot Jobs</h3>{data.jobs.slice(0, 8).map((item) => <div key={item.id} className="mt-2 flex justify-between border-t pt-2 text-sm"><span>#{item.id} · {item.status}</span>{item.status === "failed" ? <button onClick={() => mutate(`/api/admin/akademik/snapshot-jobs/${item.id}/retry`)} className="text-blue-700">Retry</button> : null}</div>)}</div><div className="rounded-lg border p-4"><h3 className="font-bold">Outbox</h3>{data.outbox.slice(0, 8).map((item) => <div key={item.id} className="mt-2 flex justify-between border-t pt-2 text-sm"><span>#{item.id} · {item.status}</span>{["failed", "pending"].includes(item.status) ? <button onClick={() => mutate(`/api/admin/akademik/outbox/${item.id}/retry`)} className="text-blue-700">Retry</button> : null}</div>)}</div></div>
  </div>;
}

export default function AcademicDataPanel({ mode = "student", session, apiBaseUrl, onSessionExpired }) {
  const [data, setData] = useState(null); const [loading, setLoading] = useState(mode !== "admin"); const [error, setError] = useState("");
  const endpoint = useMemo(() => mode === "student" ? "/api/mahasiswa/akademik" : mode === "secretary" ? "/api/sekretaris/akademik/monitoring" : null, [mode]);
  const load = useCallback(async () => {
    if (!endpoint) return; setLoading(true); setError("");
    try { const response = await fetch(`${apiBaseUrl}${endpoint}`, { headers: { Authorization: `Bearer ${session.token}` } }); const payload = await response.json(); if ([401, 403].includes(response.status)) { onSessionExpired?.(); return; } if (!response.ok) throw new Error(payload.message); setData(payload.data); }
    catch (requestError) { setError(requestError.message || "Gagal memuat data akademik."); } finally { setLoading(false); }
  }, [apiBaseUrl, endpoint, onSessionExpired, session.token]);
  useEffect(() => { load(); }, [load]);
  return <section className="rounded-xl border border-[#dce4f4] bg-white p-5 shadow-sm"><div className="mb-4"><h2 className="text-lg font-black text-[#29385f]">Data Akademik Terstruktur</h2><p className="text-sm text-[#66769a]">Histori Metodologi, mata kuliah, SKS, lineage sumber, dan kualitas data.</p></div>{loading ? <p className="text-sm text-[#66769a]">Memuat data akademik…</p> : error ? <div className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</div> : mode === "admin" ? <AdminImport api={apiBaseUrl} token={session.token} onChanged={load}/> : mode === "secretary" ? <div className="overflow-x-auto rounded-lg border border-[#dce4f4]"><table className="min-w-full text-left text-sm"><thead className="bg-[#f4f7fc]"><tr><th className="px-3 py-2">Mahasiswa</th><th className="px-3 py-2">Data</th><th className="px-3 py-2">Metodologi</th><th className="px-3 py-2">SKS lulus</th><th className="px-3 py-2">Wajib kurang</th></tr></thead><tbody>{(data || []).map((row) => <tr key={row.id} className="border-t"><td className="px-3 py-2"><b>{row.mahasiswa?.nim || row.mahasiswa_id}</b><br/>{row.mahasiswa?.nama || "-"}</td><td className="px-3 py-2"><Badge tone={row.data_state === "available" ? "green" : row.data_state === "conflicted" ? "red" : "amber"}>{STATE_LABELS[row.data_state] || row.data_state}</Badge></td><td className="px-3 py-2">{row.metodologi_status?.replaceAll("_", " ") || "-"}</td><td className="px-3 py-2">{Number(row.total_sks_lulus || 0)}</td><td className="px-3 py-2">{row.wajib_belum_lulus?.length || 0}</td></tr>)}</tbody></table></div> : <StudentSummary data={data}/>}</section>;
}
