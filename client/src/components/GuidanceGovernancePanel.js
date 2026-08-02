import React, { useCallback, useEffect, useState } from "react";

const key = (operation, id = "new") => `${operation}-${id}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const label = (value) => String(value || "-").replaceAll("_", " ");

export default function GuidanceGovernancePanel({ session, apiBaseUrl, onSessionExpired }) {
  const [view, setView] = useState("monitoring");
  const [rows, setRows] = useState([]); const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  const [candidates, setCandidates] = useState({});
  const [form, setForm] = useState({ kode_program_studi: "INFORMATIKA", program_kuliah: "reguler", jalur: "penelitian",
    minimum_validated_sessions: 8, count_scope: "cycle", supervisor_approval_scope: "p1" });

  const request = useCallback(async (path, options = {}) => {
    const response = await fetch(`${apiBaseUrl}${path}`, { ...options, headers: { Authorization: `Bearer ${session.token}`,
      "Content-Type": "application/json", ...(options.headers || {}) } });
    const payload = await response.json().catch(() => null);
    if (response.status === 401) { onSessionExpired?.(); throw new Error("Sesi berakhir."); }
    if (!response.ok || !payload?.success) throw new Error(payload?.message || "Permintaan gagal diproses.");
    return payload;
  }, [apiBaseUrl, onSessionExpired, session.token]);

  const load = useCallback(async () => {
    try { setLoading(true); setError(""); const [monitoring, policy] = await Promise.all([
      request("/api/sekretaris/bimbingan/monitoring"), request("/api/sekretaris/bimbingan/policies")]);
      setRows(monitoring?.data?.rows || []); setPolicies(policy?.data?.rows || []);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, [request]);
  useEffect(() => { load(); }, [load]);

  const mutate = async (path, operation, id, body) => {
    try { setError(""); await request(path, { method: "POST", headers: { "Idempotency-Key": key(operation, id) }, body: JSON.stringify(body) }); await load(); }
    catch (e) { setError(e.message); }
  };
  const createPolicy = async (event) => { event.preventDefault(); await mutate("/api/sekretaris/bimbingan/policies", "create-policy", "new",
    { ...form, minimum_validated_sessions: Number(form.minimum_validated_sessions), occurrence_proof_mode: "approved_resume" }); };
  const loadCandidates = async (id) => { try { const payload = await request(`/api/sekretaris/bimbingan/${id}/reviewer-candidates`);
    setCandidates((old) => ({ ...old, [id]: payload?.data?.rows || [] })); } catch (e) { setError(e.message); } };

  return <section className="space-y-4">
    <div className="flex gap-2 rounded-xl border border-[#dce4f7] bg-white p-2 shadow-sm">
      {[['monitoring', 'Monitoring'], ['policy', 'Policy']].map(([id, text]) => <button key={id} type="button" onClick={() => setView(id)}
        className={`rounded-lg px-4 py-2 text-sm font-bold ${view === id ? 'bg-[#2f63e3] text-white' : 'text-[#405070] hover:bg-[#f2f6ff]'}`}>{text}</button>)}
      <button type="button" onClick={load} className="ml-auto rounded-lg border border-[#d3dbef] px-3 py-2 text-xs font-bold text-[#314778]">Muat ulang</button>
    </div>
    {error ? <div className="rounded-lg border border-[#f5d0d0] bg-[#fff2f2] p-3 text-sm font-semibold text-[#a03f3f]">{error}</div> : null}
    {loading ? <div className="rounded-xl bg-white p-4 text-sm font-semibold text-[#55658f]">Memuat tata kelola bimbingan...</div> : null}

    {!loading && view === "policy" ? <>
      <form onSubmit={createPolicy} className="grid gap-3 rounded-xl border border-[#dce4f7] bg-white p-4 shadow-sm md:grid-cols-3">
        <h3 className="font-black text-[#1b274b] md:col-span-3">Buat policy draft</h3>
        <input value={form.kode_program_studi} onChange={(e) => setForm({ ...form, kode_program_studi: e.target.value.toUpperCase() })} placeholder="Kode program studi" className="rounded-lg border px-3 py-2 text-sm" required />
        <select value={form.program_kuliah} onChange={(e) => setForm({ ...form, program_kuliah: e.target.value })} className="rounded-lg border px-3 py-2 text-sm"><option value="reguler">Reguler</option><option value="internasional">Internasional</option></select>
        <select value={form.jalur} onChange={(e) => setForm({ ...form, jalur: e.target.value })} className="rounded-lg border px-3 py-2 text-sm"><option value="penelitian">Penelitian</option><option value="magang">Magang</option><option value="perintisan_bisnis">Perintisan Bisnis</option></select>
        <input type="number" min="1" value={form.minimum_validated_sessions} onChange={(e) => setForm({ ...form, minimum_validated_sessions: e.target.value })} className="rounded-lg border px-3 py-2 text-sm" />
        <select value={form.count_scope} onChange={(e) => setForm({ ...form, count_scope: e.target.value })} className="rounded-lg border px-3 py-2 text-sm"><option value="cycle">Per siklus</option><option value="semester">Per semester</option></select>
        <select value={form.supervisor_approval_scope} onChange={(e) => setForm({ ...form, supervisor_approval_scope: e.target.value })} className="rounded-lg border px-3 py-2 text-sm"><option value="p1">P1</option><option value="all_active_supervisors">Semua pembimbing aktif</option></select>
        <button className="rounded-lg bg-[#2f63e3] px-4 py-2 text-sm font-bold text-white md:col-span-3">Simpan Draft</button>
      </form>
      <div className="overflow-x-auto rounded-xl border border-[#dce4f7] bg-white shadow-sm"><table className="min-w-full text-left text-sm"><thead className="bg-[#f6f8fe] text-[#46577f]"><tr>
        <th className="px-3 py-2">Scope</th><th className="px-3 py-2">Versi</th><th className="px-3 py-2">Minimum</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Aksi</th></tr></thead><tbody>
        {policies.map((policy) => <tr key={policy.id} className="border-t"><td className="px-3 py-2">{[policy.kode_program_studi, policy.program_kuliah, label(policy.jalur), policy.periode_akademik_id].filter(Boolean).join(' / ') || 'Global'}</td>
          <td className="px-3 py-2">v{policy.version}</td><td className="px-3 py-2">{policy.minimum_validated_sessions} ({policy.count_scope})</td><td className="px-3 py-2 font-bold">{label(policy.status)}</td><td className="px-3 py-2">
          {policy.status === 'draft' ? <button onClick={() => mutate(`/api/sekretaris/bimbingan/policies/${policy.id}/activate`, 'activate-policy', policy.id, { expected_version: policy.row_version })} className="rounded bg-[#1f8a58] px-2 py-1 text-xs font-bold text-white">Aktifkan</button> : null}
          {policy.status === 'active' ? <button onClick={() => mutate(`/api/sekretaris/bimbingan/policies/${policy.id}/retire`, 'retire-policy', policy.id, { expected_version: policy.row_version })} className="rounded bg-[#b56a18] px-2 py-1 text-xs font-bold text-white">Retire</button> : null}</td></tr>)}
      </tbody></table></div>
    </> : null}

    {!loading && view === "monitoring" ? <div className="space-y-3">{rows.map((row) => <article key={row.id} className="rounded-xl border border-[#dce4f7] bg-white p-4 shadow-sm">
      <div className="flex flex-wrap justify-between gap-2"><div><p className="font-black text-[#1b274b]">{row.mahasiswa?.nama || 'Mahasiswa'} ({row.mahasiswa?.nim || '-'})</p>
        <p className="text-xs font-semibold text-[#65749a]">{label(row.jalur_snapshot)} • semester {row.semester_penjaluran_ke_snapshot || '-'} • context {label(row.legacy_context_status)}</p></div>
        <div className="text-right text-xs font-bold text-[#40578c]"><p>Request: {label(row.request_status)}</p><p>Resume: {label(row.status_resume)}</p><p>Reviewer: {label(row.reviewer_resolution_status)}</p></div></div>
      {row.reviewer_resolution_status !== 'resolved' ? <div className="mt-3 rounded-lg bg-[#fff8e8] p-3"><button type="button" onClick={() => loadCandidates(row.id)} className="rounded border px-2 py-1 text-xs font-bold">Muat reviewer kandidat</button>
        {(candidates[row.id] || []).map((candidate) => <button key={candidate.id} type="button" onClick={() => mutate(`/api/sekretaris/bimbingan/${row.id}/resolve-reviewer`, 'resolve-reviewer', row.id,
          { target_assignment_member_id: candidate.id, reason_code: 'MANUAL_RESOLUTION', expected_version: row.row_version })} className="ml-2 mt-2 rounded bg-[#2f63e3] px-2 py-1 text-xs font-bold text-white">P{candidate.urutan} {candidate.nama} ({label(candidate.master_status)})</button>)}</div> : null}
      {row.status_resume === 'approved' ? <button type="button" onClick={() => { const reason = window.prompt('Alasan invalidasi approval resume:'); if (reason) mutate(`/api/sekretaris/bimbingan/${row.id}/resume-approval/invalidate`, 'invalidate-resume', row.id, { reason, expected_version: row.row_version }); }}
        className="mt-3 rounded bg-[#b73a3a] px-3 py-1.5 text-xs font-bold text-white">Invalidasi approval resume</button> : null}
      {row.resumeVersions?.length ? <details className="mt-3 text-sm"><summary className="cursor-pointer font-bold text-[#314778]">Riwayat resume ({row.resumeVersions.length})</summary><ul className="mt-2 space-y-1 text-xs text-[#59698e]">{row.resumeVersions.map((v) => <li key={v.id}>v{v.version_number} — {label(v.status)}</li>)}</ul></details> : null}
    </article>)}{rows.length === 0 ? <div className="rounded-xl bg-white p-4 text-sm text-[#65749a]">Belum ada data monitoring.</div> : null}</div> : null}
  </section>;
}
