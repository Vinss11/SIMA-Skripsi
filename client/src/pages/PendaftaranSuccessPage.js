import React from "react";
import { CheckCircle2, LogIn, ShieldCheck } from "lucide-react";

function PendaftaranSuccessPage({ registrationData, onOpenMahasiswaBaruLogin }) {
  const username = registrationData?.akun_login?.username || "-";
  const defaultPassword = registrationData?.akun_login?.default_password || username;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#d7e7ff]">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(${process.env.PUBLIC_URL})`,
        }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(18,39,87,0.45)_0%,rgba(31,78,183,0.25)_45%,rgba(223,236,255,0.2)_100%)]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-4xl rounded-[28px] border border-white/50 bg-white/90 p-8 shadow-[0_35px_80px_-30px_rgba(20,56,118,0.55)] backdrop-blur-md sm:p-12">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#eaf2ff] px-4 py-2 text-sm font-bold text-[#1e45b0]">
            <CheckCircle2 className="h-4 w-4" />
            Pendaftaran Berhasil
          </div>

          <h1 className="mt-5 text-3xl font-black text-[#10224f] sm:text-4xl">Pendaftaran Penjaluran Berhasil</h1>
          <p className="mt-2 text-sm text-[#4f5f85] sm:text-base">
            Mata kuliah penjaluran semester pertama akan di key in kan oleh prodi. Jangan lupa untuk selalu memantau gateway untuk matakuliah penjaluran yang sudah di key in kan.
          </p>

          <div className="mt-6 rounded-xl border border-[#cde9d9] bg-[#eefcf4] p-5 text-[#236a46]">
            <p className="text-sm font-bold sm:text-base">Informasi Login Mahasiswa Baru</p>
            <div className="mt-2 space-y-1 text-sm sm:text-base">
              <p>
                Username: <span className="font-semibold">{username}</span>
              </p>
              <p>
                Password default: <span className="font-semibold">{defaultPassword}</span>
              </p>
            </div>
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-[#bde0cb] bg-white/70 px-3 py-2 text-xs font-semibold text-[#2f6a4c] sm:text-sm">
              <ShieldCheck className="mt-0.5 h-4 w-4 flex-none" />
              <p>Setelah berhasil masuk, mahasiswa wajib mengganti password sebelum mengakses menu lain.</p>
            </div>
          </div>

          <div className="mt-6">
            <button
              type="button"
              onClick={() => onOpenMahasiswaBaruLogin?.(username)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#1e45b0] px-5 py-2.5 text-sm font-bold text-white transition hover:brightness-110"
            >
              <LogIn className="h-4 w-4" />
              Login Mahasiswa Baru
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PendaftaranSuccessPage;
