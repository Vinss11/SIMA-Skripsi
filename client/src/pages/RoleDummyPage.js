import React from "react";
import { LogOut, Shield, GraduationCap, UserCheck } from "lucide-react";

const ROLE_CONFIG = {
  mahasiswa: {
    title: "Halo Mahasiswa",
    icon: GraduationCap,
    accent: "from-[#0ea5e9] to-[#1d4ed8]",
    bg: "from-[#e0f2fe] via-[#eff6ff] to-[#dbeafe]",
  },
  dosen: {
    title: "Halo Dosen",
    icon: UserCheck,
    accent: "from-[#16a34a] to-[#15803d]",
    bg: "from-[#dcfce7] via-[#ecfdf5] to-[#d1fae5]",
  },
  admin: {
    title: "Halo Admin",
    icon: Shield,
    accent: "from-[#f59e0b] to-[#d97706]",
    bg: "from-[#fef3c7] via-[#fffbeb] to-[#fde68a]",
  },
};

function RoleDummyPage({ session, onLogout }) {
  const role = session?.user?.role || "";
  const profile = ROLE_CONFIG[role] || {
    title: "Halo Pengguna",
    icon: Shield,
    accent: "from-[#334155] to-[#0f172a]",
    bg: "from-[#e2e8f0] via-[#f8fafc] to-[#cbd5e1]",
  };
  const Icon = profile.icon;

  return (
    <div className={`min-h-screen bg-gradient-to-br ${profile.bg} p-4 sm:p-10`}>
      <div className="mx-auto flex min-h-[85vh] w-full max-w-5xl flex-col justify-center rounded-3xl border border-white/70 bg-white/75 p-8 shadow-2xl backdrop-blur-md sm:p-12">
        <div className="mb-6 flex items-center gap-4">
          <div className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${profile.accent} text-white`}>
            <Icon className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-black text-[#0f224d] sm:text-4xl">{profile.title}</h1>
        </div>

        <p className="max-w-2xl text-base text-[#334155] sm:text-lg">
          Login berhasil. Ini masih halaman dummy untuk validasi role dari API backend. Nanti halaman ini bisa kita ganti ke dashboard masing-masing role.
        </p>

        <div className="mt-8 grid gap-4 rounded-2xl bg-white/90 p-6 shadow-inner sm:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#64748b]">Nama</p>
            <p className="mt-1 text-lg font-semibold text-[#0f172a]">{session?.user?.nama || "-"}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#64748b]">Username</p>
            <p className="mt-1 text-lg font-semibold text-[#0f172a]">{session?.user?.username || "-"}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#64748b]">Role</p>
            <p className="mt-1 text-lg font-semibold capitalize text-[#0f172a]">{session?.user?.role || "-"}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#64748b]">Token</p>
            <p className="mt-1 break-all text-sm text-[#334155]">{session?.token ? "Tersimpan" : "-"}</p>
          </div>
        </div>

        <div className="mt-8">
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-2 rounded-xl bg-[#0f224d] px-5 py-3 text-sm font-bold text-white transition hover:brightness-110"
          >
            <LogOut className="h-4 w-4" />
            Keluar
          </button>
        </div>
      </div>
    </div>
  );
}

export default RoleDummyPage;
