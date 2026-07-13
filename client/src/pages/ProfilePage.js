import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Eye, EyeOff, KeyRound, LogOut, Save, UserCircle2 } from "lucide-react";

function resolveIdentity(user) {
  const role = String(user?.role || "").toLowerCase();
  if (role === "mahasiswa") {
    return { label: "NIM", value: user?.nim || user?.username || "-" };
  }
  if (role === "dosen") {
    return {
      label: "NIK / Kode Dosen",
      value: user?.kode_dosen || user?.nik || user?.nip || user?.username || "-",
    };
  }
  if (role === "admin") {
    return { label: "NIP", value: user?.nip || user?.username || "-" };
  }
  return { label: "NIK", value: user?.nik || user?.nip || user?.username || "-" };
}

function PasswordInput({ id, label, value, onChange, visible, onToggle, error, autoComplete }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-[#243a70]">
        {label} <span className="text-[#c53f3f]">*</span>
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          className={`h-10 w-full rounded-lg border bg-white px-3 pr-11 text-sm text-[#1e315f] outline-none transition focus:ring-2 ${
            error
              ? "border-[#df4d4d] focus:border-[#df4d4d] focus:ring-[#df4d4d]/15"
              : "border-[#cdd8ef] focus:border-[#2f63e3] focus:ring-[#2f63e3]/15"
          }`}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute inset-y-0 right-0 inline-flex w-10 items-center justify-center text-[#60709a] transition hover:text-[#2f63e3]"
          title={visible ? "Sembunyikan password" : "Tampilkan password"}
          aria-label={visible ? "Sembunyikan password" : "Tampilkan password"}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {error ? <p className="mt-1 text-xs font-medium text-[#c53f3f]">{error}</p> : null}
    </div>
  );
}

function ProfilePage({ session, apiBaseUrl, onBack, onLogout, onSessionExpired, onPasswordChanged }) {
  const [profile, setProfile] = useState(session?.user || null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [form, setForm] = useState({ oldPassword: "", newPassword: "", confirmPassword: "" });
  const [errors, setErrors] = useState({});
  const [visible, setVisible] = useState({ oldPassword: false, newPassword: false, confirmPassword: false });
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    let active = true;
    const loadProfile = async () => {
      try {
        setLoading(true);
        setLoadError("");
        const response = await fetch(`${apiBaseUrl}/api/auth/profile`, {
          headers: { Authorization: `Bearer ${session.token}`, "Content-Type": "application/json" },
        });
        const payload = await response.json().catch(() => null);
        if (response.status === 401 || response.status === 403) {
          onSessionExpired?.();
          return;
        }
        if (!response.ok || !payload?.success || !payload?.data?.user) {
          throw new Error(payload?.message || "Gagal memuat profil.");
        }
        if (active) setProfile(payload.data.user);
      } catch (error) {
        if (active) setLoadError(error.message || "Tidak dapat terhubung ke server.");
      } finally {
        if (active) setLoading(false);
      }
    };
    loadProfile();
    return () => {
      active = false;
    };
  }, [apiBaseUrl, onSessionExpired, session.token]);

  const identity = useMemo(() => resolveIdentity(profile || session?.user), [profile, session?.user]);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "", form: "" }));
    setSuccessMessage("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = {};
    if (!form.oldPassword) nextErrors.oldPassword = "Password lama wajib diisi.";
    if (!form.newPassword) nextErrors.newPassword = "Password baru wajib diisi.";
    else if (form.newPassword.length < 6) nextErrors.newPassword = "Password baru minimal 6 karakter.";
    if (!form.confirmPassword) nextErrors.confirmPassword = "Konfirmasi password wajib diisi.";
    else if (form.newPassword !== form.confirmPassword) {
      nextErrors.confirmPassword = "Konfirmasi password tidak sama.";
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    try {
      setSubmitting(true);
      setErrors({});
      setSuccessMessage("");
      const response = await fetch(`${apiBaseUrl}/api/auth/change-password`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword: form.oldPassword, newPassword: form.newPassword }),
      });
      const payload = await response.json().catch(() => null);
      if (response.status === 401 && String(payload?.message || "").toLowerCase().includes("password lama")) {
        setErrors({ oldPassword: payload.message });
        return;
      }
      if (response.status === 401 || response.status === 403) {
        onSessionExpired?.();
        return;
      }
      if (!response.ok || !payload?.success) {
        setErrors({ form: payload?.message || "Gagal mengubah password." });
        return;
      }
      setForm({ oldPassword: "", newPassword: "", confirmPassword: "" });
      setVisible({ oldPassword: false, newPassword: false, confirmPassword: false });
      setSuccessMessage(payload.message || "Password berhasil diubah.");
      onPasswordChanged?.();
    } catch (error) {
      setErrors({ form: "Tidak dapat terhubung ke server." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f2f3f7]">
      <header className="sticky top-0 z-40 bg-[#2f63e3] text-white shadow-sm">
        <div className="flex min-h-[64px] w-full items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-[#f7d13d] p-1.5">
              <img
                src={`${process.env.PUBLIC_URL}/2_UII Background Terang.png`}
                alt="Logo UII"
                className="h-7 w-7 object-contain"
              />
            </div>
            <p className="text-sm font-black tracking-wide">SIMPS UII</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/30 px-3 py-2 text-xs font-semibold transition hover:bg-white/20"
          >
            <LogOut className="h-3.5 w-3.5" />
            Keluar
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:py-8">
        <button
          type="button"
          onClick={onBack}
          className="mb-4 inline-flex h-10 items-center gap-2 rounded-lg border border-[#cfd9ee] bg-white px-3 text-sm font-semibold text-[#2b3f74] transition hover:bg-[#f5f8ff]"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali
        </button>

        <section className="overflow-hidden rounded-lg border border-[#dce4f7] bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-[#e2e8f5] px-5 py-4 sm:px-6">
            <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#edf3ff] text-[#2f63e3]">
              <UserCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-[#17264d]">Edit Profil</h1>
              <p className="mt-0.5 text-sm text-[#60709a]">Informasi akun dan pengaturan password.</p>
            </div>
          </div>

          <div className="px-5 py-5 sm:px-6">
            {loadError ? (
              <div className="mb-4 rounded-lg border border-[#f2caca] bg-[#fff3f3] px-4 py-3 text-sm font-semibold text-[#a63c3c]">
                {loadError}
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="profile-name" className="mb-1.5 block text-sm font-semibold text-[#243a70]">Nama</label>
                <input
                  id="profile-name"
                  value={loading ? "Memuat..." : profile?.nama || session?.user?.nama || "-"}
                  disabled
                  className="h-10 w-full cursor-not-allowed rounded-lg border border-[#d5deef] bg-[#f3f6fb] px-3 text-sm text-[#66769a]"
                />
              </div>
              <div>
                <label htmlFor="profile-identity" className="mb-1.5 block text-sm font-semibold text-[#243a70]">{identity.label}</label>
                <input
                  id="profile-identity"
                  value={loading ? "Memuat..." : identity.value}
                  disabled
                  className="h-10 w-full cursor-not-allowed rounded-lg border border-[#d5deef] bg-[#f3f6fb] px-3 text-sm text-[#66769a]"
                />
              </div>
            </div>

            <div className="my-6 border-t border-[#e2e8f5]" />

            <div className="mb-4 flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-[#2f63e3]" />
              <h2 className="text-base font-black text-[#17264d]">Ubah Password</h2>
            </div>

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <PasswordInput
                id="old-password"
                label="Password lama"
                value={form.oldPassword}
                onChange={(event) => updateField("oldPassword", event.target.value)}
                visible={visible.oldPassword}
                onToggle={() => setVisible((current) => ({ ...current, oldPassword: !current.oldPassword }))}
                error={errors.oldPassword}
                autoComplete="current-password"
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <PasswordInput
                  id="new-password"
                  label="Password baru"
                  value={form.newPassword}
                  onChange={(event) => updateField("newPassword", event.target.value)}
                  visible={visible.newPassword}
                  onToggle={() => setVisible((current) => ({ ...current, newPassword: !current.newPassword }))}
                  error={errors.newPassword}
                  autoComplete="new-password"
                />
                <PasswordInput
                  id="confirm-password"
                  label="Konfirmasi password baru"
                  value={form.confirmPassword}
                  onChange={(event) => updateField("confirmPassword", event.target.value)}
                  visible={visible.confirmPassword}
                  onToggle={() => setVisible((current) => ({ ...current, confirmPassword: !current.confirmPassword }))}
                  error={errors.confirmPassword}
                  autoComplete="new-password"
                />
              </div>

              {errors.form ? <p className="text-sm font-semibold text-[#c53f3f]">{errors.form}</p> : null}
              {successMessage ? (
                <div className="rounded-lg border border-[#bfe4d2] bg-[#effaf4] px-4 py-3 text-sm font-semibold text-[#167449]">
                  {successMessage}
                </div>
              ) : null}

              <div className="flex justify-end border-t border-[#e2e8f5] pt-4">
                <button
                  type="submit"
                  disabled={submitting || loading}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#2f63e3] px-4 text-sm font-bold text-white transition hover:bg-[#2858cc] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Save className="h-4 w-4" />
                  {submitting ? "Menyimpan..." : "Simpan Password"}
                </button>
              </div>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}

export default ProfilePage;
