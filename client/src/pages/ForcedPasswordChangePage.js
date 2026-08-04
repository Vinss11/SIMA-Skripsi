import React, { useState } from "react";
import { Eye, EyeOff, LockKeyhole, LogOut } from "lucide-react";
import { withAuthTabHeader } from "../utils/authTab";

const MINIMUM_PASSWORD_LENGTH = 10;
const MAXIMUM_PASSWORD_BYTES = 72;
const COMMON_PASSWORDS = new Set(["password", "password123", "1234567890", "qwerty12345", "admin12345"]);

const getPasswordPolicyMessage = (reason) => {
  const messages = {
    PASSWORD_TOO_SHORT: `Password baru minimal ${MINIMUM_PASSWORD_LENGTH} karakter.`,
    PASSWORD_TOO_LONG: `Password baru terlalu panjang (maksimal ${MAXIMUM_PASSWORD_BYTES} byte).`,
    PASSWORD_SAME_AS_CURRENT: "Password baru harus berbeda dari password saat ini.",
    PASSWORD_TOO_COMMON: "Password baru terlalu umum dan mudah ditebak.",
    PASSWORD_CONTAINS_IDENTIFIER:
      "Password baru tidak boleh sama persis dengan NIM, NIK, NIP, kode dosen, atau email akun.",
  };
  return messages[reason] || "Password baru belum memenuhi salah satu kebijakan keamanan.";
};

const getClientValidationMessages = ({ currentPassword, newPassword, confirmation, session }) => {
  const messages = [];
  const normalizedPassword = String(newPassword || "").toLowerCase();
  const identifiers = [session?.user?.username, session?.user?.email]
    .filter(Boolean)
    .map((value) => String(value).trim().toLowerCase())
    .filter(Boolean);

  if (newPassword.length < MINIMUM_PASSWORD_LENGTH) {
    messages.push(getPasswordPolicyMessage("PASSWORD_TOO_SHORT"));
  }
  if (new TextEncoder().encode(newPassword).length > MAXIMUM_PASSWORD_BYTES) {
    messages.push(getPasswordPolicyMessage("PASSWORD_TOO_LONG"));
  }
  if (newPassword === currentPassword) {
    messages.push(getPasswordPolicyMessage("PASSWORD_SAME_AS_CURRENT"));
  }
  if (COMMON_PASSWORDS.has(normalizedPassword)) {
    messages.push(getPasswordPolicyMessage("PASSWORD_TOO_COMMON"));
  }
  if (identifiers.some((identifier) => normalizedPassword === identifier)) {
    messages.push(getPasswordPolicyMessage("PASSWORD_CONTAINS_IDENTIFIER"));
  }
  if (newPassword !== confirmation) {
    messages.push("Konfirmasi password baru harus sama dengan password baru.");
  }

  return [...new Set(messages)];
};

export default function ForcedPasswordChangePage({ session, apiBaseUrl, onPasswordChanged, onLogout }) {
  const [currentPassword, setCurrentPassword] = useState(""); const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState(""); const [messages, setMessages] = useState([]); const [loading, setLoading] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState({ current: false, next: false, confirmation: false });
  const passwordFields = [
    { key: "current", value: currentPassword, setValue: setCurrentPassword, label: "Password saat ini" },
    { key: "next", value: newPassword, setValue: setNewPassword, label: "Password baru" },
    { key: "confirmation", value: confirmation, setValue: setConfirmation, label: "Ulangi password baru" },
  ];
  const submit = async (event) => {
    event.preventDefault(); setMessages([]);
    const validationMessages = getClientValidationMessages({
      currentPassword,
      newPassword,
      confirmation,
      session,
    });
    if (validationMessages.length > 0) { setMessages(validationMessages); return; }
    try {
      setLoading(true);
      const response = await fetch(`${apiBaseUrl}/api/auth/change-password`, { method: "POST", credentials: "include", headers: withAuthTabHeader({ "content-type": "application/json", Authorization: `Bearer ${session.token}` }),
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }) });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.data?.token) {
        const policyReasons = Array.isArray(body?.detail?.reasons) ? body.detail.reasons : [];
        setMessages(
          policyReasons.length > 0
            ? [...new Set(policyReasons.map(getPasswordPolicyMessage))]
            : [body?.message || "Password belum dapat diubah."]
        );
        return;
      }
      onPasswordChanged(body.data);
    } catch (_) { setMessages(["Tidak dapat terhubung ke server. Coba kembali."]); } finally { setLoading(false); }
  };
  return <main className="flex min-h-screen items-center justify-center bg-[#eaf1ff] p-4"><section className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-xl">
    <LockKeyhole className="h-10 w-10 text-[#1d4ac6]" /><h1 className="mt-4 text-2xl font-black text-[#10224f]">Ganti password untuk melanjutkan</h1>
    <p className="mt-2 text-sm text-slate-600">Akses fitur lain dikunci sampai password awal diganti. Gunakan minimal 10 karakter; spasi pada password tidak dihapus.</p>
    <form onSubmit={submit} className="mt-6 space-y-4">{passwordFields.map(({ key, value, setValue, label }) => {
      const isVisible = visiblePasswords[key];
      const inputId = `forced-password-${key}`;
      return <div key={key}>
        <label htmlFor={inputId} className="block text-sm font-bold text-slate-700">{label}</label>
        <div className="relative mt-1">
          <input id={inputId} type={isVisible ? "text" : "password"} value={value} onChange={(event) => { setValue(event.target.value); setMessages([]); }} required autoComplete={key === "current" ? "current-password" : "new-password"} className="h-12 w-full rounded-xl border px-4 pr-12 font-normal" />
          <button
            type="button"
            onClick={() => setVisiblePasswords((current) => ({ ...current, [key]: !current[key] }))}
            aria-label={isVisible ? `Sembunyikan ${label.toLowerCase()}` : `Tampilkan ${label.toLowerCase()}`}
            aria-pressed={isVisible}
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-slate-500 transition hover:text-[#1d4ac6] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1d4ac6]"
          >
            {isVisible ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>
      </div>;
    })}
      {messages.length > 0 ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <p className="font-bold">Periksa kembali password:</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 font-semibold">
            {messages.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      ) : null}
      <button disabled={loading} className="h-12 w-full rounded-xl bg-[#1d4ac6] font-bold text-white disabled:opacity-60">{loading ? "Menyimpan..." : "Simpan password baru"}</button>
    </form><button type="button" onClick={onLogout} className="mt-4 flex w-full items-center justify-center gap-2 text-sm font-bold text-slate-600"><LogOut className="h-4 w-4" />Keluar</button>
  </section></main>;
}
