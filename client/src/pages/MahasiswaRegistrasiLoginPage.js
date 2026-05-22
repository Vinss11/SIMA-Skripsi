import React, { useState } from "react";
import { ArrowLeft, Eye, EyeOff, Lock, LogIn, User } from "lucide-react";

function MahasiswaRegistrasiLoginPage({ apiBaseUrl, initialNim = "", onBack, onLoginSuccess }) {
  const [username, setUsername] = useState(initialNim || "");
  const [password, setPassword] = useState(initialNim || "");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage("");

    const normalizedUsername = username.trim();
    const normalizedPassword = password.trim();

    if (!normalizedUsername || !normalizedPassword) {
      setErrorMessage("Username dan password wajib diisi.");
      return;
    }

    if (!/^\d{8}$/.test(normalizedUsername)) {
      setErrorMessage("Username harus NIM 8 digit angka.");
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch(`${apiBaseUrl}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: normalizedUsername,
          password: normalizedPassword,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success || !data?.data?.token || !data?.data?.user) {
        setErrorMessage(data?.message || "Login gagal. Pastikan username dan password sesuai.");
        return;
      }

      if (data?.data?.user?.role !== "mahasiswa") {
        setErrorMessage("Akun ini bukan akun mahasiswa.");
        return;
      }

      onLoginSuccess(
        {
          token: data.data.token,
          user: data.data.user,
          prompt_change_password: data.data.prompt_change_password,
        },
        true
      );
    } catch (error) {
      setErrorMessage("Tidak bisa terhubung ke server.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#d7e7ff]">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(${process.env.PUBLIC_URL})`,
        }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(18,39,87,0.45)_0%,rgba(31,78,183,0.25)_45%,rgba(223,236,255,0.2)_100%)]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-2xl rounded-[24px] border border-white/50 bg-white/90 p-6 shadow-[0_30px_70px_-30px_rgba(20,56,118,0.65)] backdrop-blur-md sm:p-10">
          <h1 className="text-2xl font-black text-[#10224f] sm:text-3xl">Login Mahasiswa Baru</h1>
          <p className="mt-2 text-sm text-[#50618a] sm:text-base">
            Gunakan NIM sebagai username dan password awal. Setelah berhasil masuk, Anda wajib mengganti password.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <label className="group relative block">
              <User className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#445278]" />
              <input
                type="text"
                placeholder="NIM (8 digit)"
                value={username}
                onChange={(event) => setUsername(event.target.value.replace(/\D/g, "").slice(0, 8))}
                className="h-12 w-full rounded-xl border border-[#d5def1] bg-white pl-12 pr-4 text-[#0f224d] outline-none transition focus:border-[#1f4dbd] focus:ring-4 focus:ring-[#1f4dbd]/15"
              />
            </label>

            <label className="group relative block">
              <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#445278]" />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password awal (NIM)"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-12 w-full rounded-xl border border-[#d5def1] bg-white pl-12 pr-12 text-[#0f224d] outline-none transition focus:border-[#1f4dbd] focus:ring-4 focus:ring-[#1f4dbd]/15"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#33406a] transition hover:text-[#14357c]"
                aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </label>

            {errorMessage ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{errorMessage}</div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-2 rounded-xl border border-[#cfd9f2] bg-white px-4 py-2 text-sm font-bold text-[#23408c] transition hover:bg-[#f4f7ff]"
              >
                <ArrowLeft className="h-4 w-4" />
                Kembali
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="inline-flex items-center gap-2 rounded-xl bg-[#1e45b0] px-5 py-2.5 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <LogIn className="h-4 w-4" />
                {isLoading ? "Memproses..." : "Masuk"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default MahasiswaRegistrasiLoginPage;

