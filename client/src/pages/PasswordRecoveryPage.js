import React, { useEffect, useState } from "react";

export default function PasswordRecoveryPage({ apiBaseUrl, mode, resetToken = "", onBack, onComplete }) {
  const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [confirmation,setConfirmation]=useState("");
  const [status,setStatus]=useState(mode === "reset" ? "validating" : "ready"); const [message,setMessage]=useState("");
  useEffect(()=>{ if(mode!=="reset") return; if(!resetToken){setStatus("invalid");setMessage("Tautan reset tidak valid.");return;}
    fetch(`${apiBaseUrl}/api/auth/reset-password/validate`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token:resetToken})})
      .then(async response=>({ok:response.ok,body:await response.json().catch(()=>null)})).then(({ok,body})=>{setStatus(ok?"ready":"invalid");if(!ok)setMessage(body?.message||"Tautan reset tidak valid.");})
      .catch(()=>{setStatus("invalid");setMessage("Validasi tautan gagal. Coba kembali.");}); },[apiBaseUrl,mode,resetToken]);
  const submit=async event=>{event.preventDefault();setMessage("");if(mode==="reset"&&password!==confirmation){setMessage("Konfirmasi password tidak sama.");return;}setStatus("loading");
    try{const url=mode==="forgot"?"forgot-password":"reset-password/confirm";const body=mode==="forgot"?{email}:{token:resetToken,new_password:password};
      const response=await fetch(`${apiBaseUrl}/api/auth/${url}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});const payload=await response.json().catch(()=>null);
      if(!response.ok){setStatus("ready");setMessage(payload?.message||"Permintaan gagal diproses.");return;}setStatus("done");setMessage(payload?.message||"Permintaan berhasil diproses.");}
    catch(_){setStatus("ready");setMessage("Tidak dapat terhubung ke server.");}};
  return <main className="flex min-h-screen items-center justify-center bg-[#eaf1ff] p-4"><section className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl">
    <h1 className="text-2xl font-black text-[#10224f]">{mode==="forgot"?"Lupa password":"Atur password baru"}</h1>
    <p className="mt-2 text-sm text-slate-600">{mode==="forgot"?"Masukkan email pemulihan akun. Jawaban selalu dibuat generik untuk melindungi data akun.":"Token hanya dikirim melalui body request dan sudah dihapus dari address bar."}</p>
    {status==="validating"?<p className="mt-6">Memvalidasi tautan...</p>:status==="invalid"?<p className="mt-6 rounded-xl bg-red-50 p-3 text-red-700">{message}</p>:
    <form onSubmit={submit} className="mt-6 space-y-4">{mode==="forgot"?<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email pemulihan" className="h-12 w-full rounded-xl border px-4" />:<>
      <input type="password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password baru" className="h-12 w-full rounded-xl border px-4" />
      <input type="password" required value={confirmation} onChange={e=>setConfirmation(e.target.value)} placeholder="Ulangi password baru" className="h-12 w-full rounded-xl border px-4" /></>}
      {message?<p className="rounded-xl bg-blue-50 p-3 text-sm text-blue-800">{message}</p>:null}{status!=="done"?<button disabled={status==="loading"} className="h-12 w-full rounded-xl bg-[#1d4ac6] font-bold text-white">Kirim</button>:null}
    </form>}{(onBack||onComplete)?<button type="button" onClick={status==="done"&&onComplete?onComplete:(onBack||onComplete)} className="mt-5 w-full text-sm font-bold text-[#1d4ac6]">Kembali ke login</button>:null}
  </section></main>;
}
