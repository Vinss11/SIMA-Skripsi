import React, { useState } from "react";
import { ArrowRight, CircleHelp, Eye, EyeOff, Lock, User } from "lucide-react";

function LoginPage({ apiBaseUrl, onLoginSuccess, onOpenRegistration }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage("");

    if (!username.trim() || !password.trim()) {
      setErrorMessage("Username dan password wajib diisi.");
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
          username: username.trim(),
          password: password.trim(),
        }),
      });

      let data = null;
      try {
        data = await response.json();
      } catch (parseError) {
        data = null;
      }

      if (!response.ok || !data?.success || !data?.data?.token || !data?.data?.user) {
        const fallbackMessage = "Login gagal, periksa kembali username dan password.";
        setErrorMessage(data?.message || fallbackMessage);
        return;
      }

      onLoginSuccess(
        {
          token: data.data.token,
          user: data.data.user,
          prompt_change_password: data.data.prompt_change_password,
        },
        rememberMe
      );
    } catch (error) {
      setErrorMessage("Tidak bisa terhubung ke server. Pastikan backend berjalan di http://localhost:3000.");
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
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_10%,rgba(255,255,255,0.45),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(245,223,171,0.35),transparent_35%),linear-gradient(135deg,rgba(18,39,87,0.35)_0%,rgba(31,78,183,0.2)_35%,rgba(223,236,255,0.15)_100%)]" />
      <div className="absolute -left-28 bottom-0 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(245,201,82,0.5)_0%,rgba(245,201,82,0)_70%)]" />
      <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(255,245,216,0.85)_0%,rgba(255,245,216,0)_70%)]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-4xl rounded-[28px] border border-white/50 bg-white/90 p-6 shadow-[0_35px_80px_-30px_rgba(20,56,118,0.55)] backdrop-blur-md sm:p-10 md:p-14">
          <div className="mx-auto flex max-w-xl flex-col items-center">
            <div className="mb-3">
              <img
                src={`${process.env.PUBLIC_URL}/2_UII Background Terang.png`}
                alt="Logo Universitas Islam Indonesia"
                className="h-auto w-[280px] max-w-full object-contain sm:w-[340px]"
              />
            </div>

            <h1 className="mt-4 text-center text-4xl font-black tracking-wide text-[#10224f]">SIMP UII</h1>
            <p className="mt-2 text-center text-sm font-semibold text-[#4a5671] sm:text-lg">
              Sistem Informasi Manajemen Pengurusan Skripsi
            </p>

            <form onSubmit={handleSubmit} className="mt-10 w-full space-y-4">
              <label className="group relative block">
                <User className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#445278]" />
                <input
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="h-14 w-full rounded-2xl border border-[#d5def1] bg-white pl-12 pr-4 text-[#0f224d] outline-none transition focus:border-[#1f4dbd] focus:ring-4 focus:ring-[#1f4dbd]/15"
                />
              </label>

              <label className="group relative block">
                <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#445278]" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-14 w-full rounded-2xl border border-[#d5def1] bg-white pl-12 pr-12 text-[#0f224d] outline-none transition focus:border-[#1f4dbd] focus:ring-4 focus:ring-[#1f4dbd]/15"
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

              <div className="flex items-center gap-3 pt-1 text-sm font-semibold text-[#32405f]">
                <input
                  id="rememberMe"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                  className="h-4 w-4 rounded border-[#9fb2de] text-[#1f4dbd] focus:ring-[#1f4dbd]"
                />
                <label htmlFor="rememberMe">Ingat saya di perangkat ini</label>
              </div>

              {errorMessage ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{errorMessage}</div>
              ) : null}

              <button
                type="submit"
                disabled={isLoading}
                className="group mt-1 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#1d4ac6] via-[#1a43b4] to-[#173b98] text-base font-bold text-white shadow-[0_14px_28px_-12px_rgba(20,56,118,0.8)] transition hover:scale-[1.01] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isLoading ? "Memproses..." : "Masuk ke SIMP UII"}
                <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
              </button>
            </form>

            <div className="mt-6 w-full">
              <div className="mb-4 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-[#7a86a5]">
                <div className="h-px flex-1 bg-[#e1e7f4]" />
                <span>Atau</span>
                <div className="h-px flex-1 bg-[#e1e7f4]" />
              </div>

              <button type="button" onClick={onOpenRegistration} className="inline-flex w-full items-center justify-center gap-2 text-sm font-bold text-[#23408c] transition hover:text-[#1a2f6a]">
                <CircleHelp className="h-4 w-4" />
                Sudah penjaluran?
              </button>
            </div>
          </div>
        </div>
      </div>

     
    </div>
  );
}

export default LoginPage;
