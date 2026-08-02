import React, { useState } from "react";
import { LockKeyhole, LogOut } from "lucide-react";

export default function ForcedPasswordChangePage({ session, apiBaseUrl, onPasswordChanged, onLogout }) {
  const [currentPassword, setCurrentPassword] = useState(""); const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState(""); const [message, setMessage] = useState(""); const [loading, setLoading] = useState(false);
  const submit = async (event) => {
    event.preventDefault(); setMessage("");
    if (newPassword !== confirmation) { setMessage("Konfirmasi password baru tidak sama."); return; }
    try {
      setLoading(true);
      const response = await fetch(`${apiBaseUrl}/api/auth/change-password`, { method: "POST", headers: { "content-type": "application/json", Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }) });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.data?.token) { setMessage(body?.message || "Password belum dapat diubah."); return; }
      onPasswordChanged(body.data);
    } catch (_) { setMessage("Tidak dapat terhubung ke server. Coba kembali."); } finally { setLoading(false); }
  };
  return <main className="flex min-h-screen items-center justify-center bg-[#eaf1ff] p-4"><section className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-xl">
    <LockKeyhole className="h-10 w-10 text-[#1d4ac6]" /><h1 className="mt-4 text-2xl font-black text-[#10224f]">Ganti password untuk melanjutkan</h1>
    <p className="mt-2 text-sm text-slate-600">Akses fitur lain dikunci sampai password awal diganti. Gunakan minimal 10 karakter; spasi pada password tidak dihapus.</p>
    <form onSubmit={submit} className="mt-6 space-y-4">{[[currentPassword,setCurrentPassword,"Password saat ini"],[newPassword,setNewPassword,"Password baru"],[confirmation,setConfirmation,"Ulangi password baru"]].map(([value,setValue,label]) =>
      <label key={label} className="block text-sm font-bold text-slate-700">{label}<input type="password" value={value} onChange={(event)=>setValue(event.target.value)} required className="mt-1 h-12 w-full rounded-xl border px-4 font-normal" /></label>)}
      {message ? <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{message}</p> : null}
      <button disabled={loading} className="h-12 w-full rounded-xl bg-[#1d4ac6] font-bold text-white disabled:opacity-60">{loading ? "Menyimpan..." : "Simpan password baru"}</button>
    </form><button type="button" onClick={onLogout} className="mt-4 flex w-full items-center justify-center gap-2 text-sm font-bold text-slate-600"><LogOut className="h-4 w-4" />Keluar</button>
  </section></main>;
}
