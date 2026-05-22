import React, { useState } from "react";
import { ArrowLeft, Mail, Send } from "lucide-react";
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";

function MahasiswaEmailLoginPage({ apiBaseUrl, initialEmail = "", onBack, onLoginSuccess }) {
  const [email, setEmail] = useState(initialEmail);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage("");

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      await Swal.fire({
        icon: "warning",
        title: "Email wajib diisi",
        text: "Silakan isi email terlebih dahulu sebelum melanjutkan login.",
        confirmButtonText: "OK",
        confirmButtonColor: "#1e45b0",
      });
      return;
    }

    const confirmResult = await Swal.fire({
      icon: "question",
      title: "Konfirmasi Email",
      html: `Pastikan email berikut sudah benar:<br><strong>${normalizedEmail}</strong>`,
      showCancelButton: true,
      confirmButtonText: "Ya, lanjut",
      cancelButtonText: "Koreksi dulu",
      confirmButtonColor: "#1e45b0",
      cancelButtonColor: "#94a3b8",
      reverseButtons: true,
      focusCancel: true,
    });

    if (!confirmResult.isConfirmed) {
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch(`${apiBaseUrl}/api/auth/login-mahasiswa-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: normalizedEmail }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success || !data?.data?.token || !data?.data?.user) {
        setErrorMessage(data?.message || "Login gagal. Pastikan email benar.");
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
          <h1 className="text-2xl font-black text-[#10224f] sm:text-3xl">Login Mahasiswa via Email</h1>
          <p className="mt-2 text-sm text-[#50618a] sm:text-base">
            Masukkan email yang digunakan saat pendaftaran. Jika email valid, Anda akan langsung masuk ke dashboard.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <label className="group relative block">
              <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#445278]" />
              <input
                type="email"
                placeholder="email@student.university.ac.id"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-12 w-full rounded-xl border border-[#d5def1] bg-white pl-12 pr-4 text-[#0f224d] outline-none transition focus:border-[#1f4dbd] focus:ring-4 focus:ring-[#1f4dbd]/15"
              />
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
                <Send className="h-4 w-4" />
                {isLoading ? "Memproses..." : "Lanjut Masuk"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default MahasiswaEmailLoginPage;
