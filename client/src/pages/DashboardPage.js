import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Eye,
  EyeOff,
  Clock3,
  FileText,
  FolderOpen,
  GraduationCap,
  KeyRound,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  ShieldAlert,
  Send,
  UserCircle2,
  UserRound,
} from "lucide-react";
import PengajuanPage from "./PengajuanPage";
import StatusPage from "./StatusPage";
import BimbinganPage from "./BimbinganPage";
import MenuSectionHeader from "../components/MenuSectionHeader";

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "izin-lanjut", label: "Permohonan Extend", icon: ShieldAlert },
  { id: "pengajuan", label: "Pengajuan", icon: FileText },
  { id: "status", label: "Status", icon: Activity },
  { id: "bimbingan", label: "Bimbingan", icon: MessageSquare },
  { id: "dokumen", label: "Dokumen", icon: FolderOpen },
];

const TAB_HEADERS = {
  dashboard: {
    icon: LayoutDashboard,
    title: "Dashboard Mahasiswa",
    subtitle: "Ringkasan progres skripsi, pengajuan aktif, dan status pembimbing.",
  },
  "izin-lanjut": {
    icon: ShieldAlert,
    title: "Permohonan Extend",
    subtitle:
      "Ajukan permohonan extend saat masa penjaluran memasuki semester ke-3 atau lebih.",
  },
  pengajuan: {
    icon: FileText,
    title: "Pengajuan Judul Skripsi",
    subtitle: "Pilih topik dari dosen atau ajukan judul mandiri sesuai kebutuhan Anda.",
  },
  status: {
    icon: Activity,
    title: "Status Pengajuan",
    subtitle: "Pantau hasil review dan tindak lanjut setiap pengajuan judul Anda.",
  },
  bimbingan: {
    icon: MessageSquare,
    title: "Bimbingan Skripsi",
    subtitle: "Kelola jadwal, catatan, dan progres sesi bimbingan bersama dosen pembimbing.",
  },
  dokumen: {
    icon: FolderOpen,
    title: "Dokumen Skripsi",
    subtitle: "Akses arsip dokumen pendukung proses skripsi Anda.",
  },
};

const STATUS_VIEW = {
  pending: {
    title: "Menunggu Persetujuan",
    badge: "Dalam Proses",
    cardTone: "bg-[#fff9e8]",
    badgeTone: "bg-[#f7cc53] text-[#705300]",
    lineTone: "border-l-[#f5c542]",
  },
  approved: {
    title: "Pengajuan Disetujui",
    badge: "Disetujui",
    cardTone: "bg-[#e8f8ee]",
    badgeTone: "bg-[#4bb97a] text-white",
    lineTone: "border-l-[#34a853]",
  },
  rejected: {
    title: "Pengajuan Ditolak",
    badge: "Ditolak",
    cardTone: "bg-[#fff0f0]",
    badgeTone: "bg-[#e55353] text-white",
    lineTone: "border-l-[#e55353]",
  },
  default: {
    title: "Belum Ada Pengajuan",
    badge: "Belum Mulai",
    cardTone: "bg-[#f3f5fa]",
    badgeTone: "bg-[#d3d9e8] text-[#3f4f76]",
    lineTone: "border-l-[#9aa8cb]",
  },
};

function formatDateLabel(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatShortDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatJalurLabel(jalur) {
  if (!jalur) return "-";
  const normalized = String(jalur).trim().toLowerCase();
  const map = {
    penelitian: "Penelitian",
    magang: "Magang",
    pengabdian: "Pengabdian Masyarakat",
    perintisan_bisnis: "Perintisan Bisnis",
  };
  if (map[normalized]) return map[normalized];
  return normalized
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function statusFromSubmission(status) {
  return STATUS_VIEW[status] || STATUS_VIEW.default;
}

function computeTimeline({
  hasSubmission,
  hasDPA,
  hasApprovedSubmission,
  hasPendingSubmission,
  hasDospem,
  latestSubmission,
  bimbinganStats,
}) {
  const submissionType = latestSubmission?.tipe_pengajuan === "topik_dosen" ? "Topik Dosen" : latestSubmission?.tipe_pengajuan === "judul_mandiri" ? "Judul Mandiri" : null;
  const submissionDate = latestSubmission ? formatShortDate(latestSubmission.createdAt || latestSubmission.tanggal) : "-";
  const countedSessions = Number(bimbinganStats?.counted_sessions || 0);
  const targetSessions = Number(bimbinganStats?.target_minimum || 8);
  const bimbinganProgressText = `${countedSessions} dari ${targetSessions} sesi tervalidasi`;
  const isBimbinganCompleted = countedSessions >= targetSessions;

  const stages = [
    {
      id: "pengajuan",
      title: "Pengajuan Judul",
      status: hasSubmission ? "completed" : "upcoming",
      subtitle: hasSubmission ? `${submissionType || "Pengajuan"} | ${submissionDate}` : "Belum ada pengajuan",
    },
    {
      id: "dpa",
      title: "Persetujuan DPA",
      status: hasDPA ? "completed" : "pending",
      subtitle: hasDPA ? "DPA sudah ditetapkan" : "Menunggu penetapan DPA",
    },
    {
      id: "approval",
      title: "Proposal Approval",
      status: hasApprovedSubmission ? "completed" : hasPendingSubmission ? "pending" : hasSubmission ? "pending" : "upcoming",
      subtitle: hasApprovedSubmission
        ? "Proposal telah disetujui"
        : hasPendingSubmission
        ? "Menunggu persetujuan dosen"
        : hasSubmission
        ? "Perlu tindak lanjut pengajuan"
        : "Belum ada proposal untuk direview",
    },
    {
      id: "bimbingan",
      title: "Proses Bimbingan",
      status: hasApprovedSubmission && hasDospem ? (isBimbinganCompleted ? "completed" : "pending") : "upcoming",
      subtitle: hasApprovedSubmission && hasDospem ? bimbinganProgressText : "Belum masuk fase bimbingan",
    },
    {
      id: "sidang",
      title: "Sidang Akhir",
      status: "upcoming",
      subtitle: "Belum terjadwal",
    },
  ];

  const scoreMap = { completed: 1, pending: 0.45, upcoming: 0.1 };
  const score = stages.reduce((total, stage) => total + scoreMap[stage.status], 0);
  const basePercentage = Math.round((score / stages.length) * 100);
  const bimbinganStageBoost =
    hasApprovedSubmission && hasDospem && !isBimbinganCompleted
      ? Math.round(Math.min(100, (countedSessions / Math.max(targetSessions, 1)) * 100) * 0.18)
      : 0;
  const percentage = basePercentage + bimbinganStageBoost;

  return {
    stages,
    percentage: Math.min(100, Math.max(0, percentage)),
  };
}

function computeSubmissionFlow(latestSubmission) {
  if (!latestSubmission) return [];

  const status = String(latestSubmission.status || "").toLowerCase();
  const tahapApproval = String(latestSubmission.tahap_approval || "").toLowerCase();
  const tipePengajuan = String(latestSubmission.tipe_pengajuan || "").toLowerCase();

  const dosenDone = status === "approved" || status === "rejected" || tahapApproval === "pending_ketua_klaster";
  const ketuaClusterNeeded = tipePengajuan === "topik_dosen";
  const ketuaDone = !ketuaClusterNeeded || status === "approved" || status === "rejected";
  const ketuaInProgress = ketuaClusterNeeded && tahapApproval === "pending_ketua_klaster" && status === "pending";
  const finalDone = status === "approved" || status === "rejected";

  return [
    {
      id: "sent",
      title: "Pengajuan Terkirim",
      subtitle: `Diajukan ${formatShortDate(latestSubmission.createdAt || latestSubmission.tanggal)}`,
      status: "completed",
    },
    {
      id: "review-dosen",
      title: "Review Dosen Pembimbing",
      subtitle: dosenDone ? "Review dosen sudah selesai." : "Menunggu review dosen pembimbing.",
      status: dosenDone ? "completed" : "pending",
    },
    {
      id: "review-ketua",
      title: "Review Ketua Cluster",
      subtitle: !ketuaClusterNeeded
        ? "Tidak diperlukan untuk tipe pengajuan ini."
        : ketuaDone
          ? "Review ketua cluster sudah selesai."
          : ketuaInProgress
            ? "Sedang menunggu keputusan ketua cluster."
            : "Belum masuk tahap review ketua cluster.",
      status: !ketuaClusterNeeded ? "upcoming" : ketuaDone ? "completed" : ketuaInProgress ? "pending" : "upcoming",
    },
    {
      id: "final",
      title: "Hasil Akhir",
      subtitle:
        status === "approved"
          ? "Pengajuan disetujui."
          : status === "rejected"
            ? "Pengajuan ditolak."
            : "Pengajuan masih diproses.",
      status: finalDone ? "completed" : "pending",
    },
  ];
}

function ProgressStageRow({ stage }) {
  const statusStyle = {
    completed: {
      icon: <CheckCircle2 className="h-5 w-5 text-[#22a56a]" />,
      text: "Selesai",
      textTone: "text-[#1b8b58]",
    },
    pending: {
      icon: <Clock3 className="h-5 w-5 text-[#c48f16]" />,
      text: "Berjalan",
      textTone: "text-[#9a7010]",
    },
    upcoming: {
      icon: <AlertCircle className="h-5 w-5 text-[#8190b2]" />,
      text: "Belum",
      textTone: "text-[#64739a]",
    },
  }[stage.status];

  return (
    <div className="flex items-start gap-3 border-b border-[#eceff6] py-3 last:border-b-0">
      <div className="pt-0.5">{statusStyle.icon}</div>
      <div className="flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="text-[15px] font-bold text-[#1a2648]">{stage.title}</h4>
          <span className={`text-xs font-semibold ${statusStyle.textTone}`}>{statusStyle.text}</span>
        </div>
        <p className="text-sm text-[#5e6b8a]">{stage.subtitle}</p>
      </div>
    </div>
  );
}

function SubmissionFlowRow({ stage }) {
  const statusStyle = {
    completed: {
      icon: <CheckCircle2 className="h-5 w-5 text-[#22a56a]" />,
      text: "Selesai",
      textTone: "text-[#1b8b58]",
    },
    pending: {
      icon: <Clock3 className="h-5 w-5 text-[#c48f16]" />,
      text: "Berjalan",
      textTone: "text-[#9a7010]",
    },
    upcoming: {
      icon: <AlertCircle className="h-5 w-5 text-[#8190b2]" />,
      text: "Belum",
      textTone: "text-[#64739a]",
    },
  }[stage.status] || {
    icon: <AlertCircle className="h-5 w-5 text-[#8190b2]" />,
    text: "Belum",
    textTone: "text-[#64739a]",
  };

  return (
    <div className="flex items-start gap-3 border-b border-[#eceff6] py-3 last:border-b-0">
      <div className="pt-0.5">{statusStyle.icon}</div>
      <div className="flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="text-[15px] font-bold text-[#1a2648]">{stage.title}</h4>
          <span className={`text-xs font-semibold ${statusStyle.textTone}`}>{statusStyle.text}</span>
        </div>
        <p className="text-sm text-[#5e6b8a]">{stage.subtitle}</p>
      </div>
    </div>
  );
}

function SummaryCard({ title, main, subtitle, icon, lineTone, cardTone, badge, badgeTone }) {
  return (
    <div className={`rounded-xl border border-[#e7ecf7] ${cardTone} border-l-4 ${lineTone} p-4 shadow-sm`}>
      <div className="mb-2 flex items-center justify-between text-[13px] font-semibold text-[#4f5d7a]">
        <span>{title}</span>
        {icon}
      </div>
      <h3 className="break-words text-[24px] leading-tight font-black text-[#1b274b]">{main}</h3>
      <p className="mt-1 text-sm text-[#5b6787]">{subtitle}</p>
      <span className={`mt-3 inline-block rounded-full px-3 py-1 text-xs font-bold ${badgeTone}`}>{badge}</span>
    </div>
  );
}

function DashboardHome({ data, onGoToPengajuan, onGoToStatus }) {
  const { profile, jalurStatus, submissions, sessionUser, bimbinganSummary } = data;
  const studentName = profile?.nama || sessionUser?.nama || "Mahasiswa";
  const studentNim = profile?.nim || sessionUser?.username || "-";
  const todayLabel = formatDateLabel(new Date());
  const latestSubmission = jalurStatus?.last_submission || submissions?.[0] || null;
  const submissionStatus = statusFromSubmission(latestSubmission?.status);

  const hasSubmission = Boolean(latestSubmission);
  const hasDPA = Boolean(profile?.dosenPembimbingAkademik);
  const hasDospem = Boolean(profile?.dosenPembimbingSkripsi);
  const latestSubmissionStatus = String(latestSubmission?.status || "").toLowerCase();
  const hasApprovedSubmission = latestSubmissionStatus === "approved" || latestSubmissionStatus === "completed";
  const hasPendingSubmission = latestSubmissionStatus === "pending" || latestSubmissionStatus === "menunggu_set_ketua_cluster";
  const timeline = computeTimeline({
    hasSubmission,
    hasDPA,
    hasApprovedSubmission,
    hasPendingSubmission,
    hasDospem,
    latestSubmission,
    bimbinganStats: bimbinganSummary?.stats || null,
  });
  const submissionFlow = useMemo(() => computeSubmissionFlow(latestSubmission), [latestSubmission]);

  const bimbinganCounted = Number(bimbinganSummary?.stats?.counted_sessions || 0);
  const bimbinganTarget = Number(bimbinganSummary?.stats?.target_minimum || 8);
  const bimbinganProgress = hasApprovedSubmission && hasDospem ? `${bimbinganCounted} dari ${bimbinganTarget}` : "Belum dimulai";
  const bimbinganBadge = hasApprovedSubmission && hasDospem ? "Sesi Tervalidasi" : "Menunggu Approval";

  return (
    <main className="w-full space-y-5 pb-10">
      <section className="rounded-xl bg-gradient-to-r from-[#2f63e3] to-[#3f6de2] p-6 text-white shadow-[0_20px_40px_-25px_rgba(39,77,173,0.85)]">
        <h2 className="text-2xl font-black sm:text-3xl">Selamat Datang, {studentName}!</h2>
        <div className="mt-2 flex items-center gap-2 text-sm text-[#dce6ff]">
          <CalendarDays className="h-4 w-4" />
          <span>{todayLabel}</span>
          <span className="opacity-70">|</span>
          <span>NIM: {studentNim}</span>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Status Pengajuan"
          main={submissionStatus.title}
          subtitle={latestSubmission ? `Update: ${formatShortDate(latestSubmission.updatedAt || latestSubmission.tanggal)}` : "Belum ada pengajuan aktif"}
          icon={<AlertCircle className="h-4 w-4 text-[#9a7b11]" />}
          lineTone={submissionStatus.lineTone}
          cardTone={submissionStatus.cardTone}
          badge={submissionStatus.badge}
          badgeTone={submissionStatus.badgeTone}
        />
        <SummaryCard
          title="Pembimbing Akademik"
          main={profile?.dosenPembimbingAkademik?.nama || "-"}
          subtitle={profile?.dosenPembimbingAkademik?.nik || "Belum ditetapkan"}
          icon={<UserRound className="h-4 w-4 text-[#4263cc]" />}
          lineTone="border-l-[#315fd8]"
          cardTone="bg-[#edf2ff]"
          badge={hasDPA ? "Aktif" : "Belum Ada"}
          badgeTone={hasDPA ? "bg-[#315fd8] text-white" : "bg-[#d7def7] text-[#3b4f86]"}
        />
        <SummaryCard
          title="Pembimbing Skripsi"
          main={profile?.dosenPembimbingSkripsi?.nama || "-"}
          subtitle={profile?.dosenPembimbingSkripsi?.nik || "Belum ditetapkan"}
          icon={<GraduationCap className="h-4 w-4 text-[#bc3c3c]" />}
          lineTone="border-l-[#d14a4a]"
          cardTone="bg-[#fff1f1]"
          badge={hasDospem ? "Aktif" : "Belum Ada"}
          badgeTone={hasDospem ? "bg-[#d14a4a] text-white" : "bg-[#f0d6d6] text-[#7f3b3b]"}
        />
        <SummaryCard
          title="Bimbingan"
          main={bimbinganProgress}
          subtitle="Tracking sesi dengan dosen pembimbing"
          icon={<Activity className="h-4 w-4 text-[#299a62]" />}
          lineTone="border-l-[#2fa86f]"
          cardTone="bg-[#ecfaf2]"
          badge={bimbinganBadge}
          badgeTone={hasApprovedSubmission && hasDospem ? "bg-[#2fa86f] text-white" : "bg-[#d3ebdf] text-[#266f4e]"}
        />
      </section>

      <section className="rounded-xl border border-[#e8ecf6] bg-white p-6 shadow-sm">
        <div className="mb-4">
          <h3 className="text-2xl font-black text-[#1a2648]">Progres Skripsi Anda</h3>
          <p className="text-sm text-[#5f6b89]">Timeline perkembangan dari pengajuan hingga sidang akhir.</p>
        </div>
        <div>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-[#3d4f7d]">Progress Keseluruhan</span>
            <span className="text-sm font-black text-[#2f63e3]">{timeline.percentage}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[#dde4f6]">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-[#2f63e3] via-[#395ed8] to-[#253e97]"
              style={{
                width: `${timeline.percentage}%`,
              }}
            />
          </div>
        </div>
        <div className="mt-4">
          {timeline.stages.map((stage) => (
            <ProgressStageRow key={stage.id} stage={stage} />
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onGoToStatus}
            className="rounded-lg border border-[#c8d4f0] px-4 py-2 text-sm font-bold text-[#2f63e3] transition hover:bg-[#f4f7ff]"
          >
            Lihat Detail Status
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-[#e8ecf6] bg-white p-6 shadow-sm">
        <div className="mb-4">
          <h3 className="text-2xl font-black text-[#1a2648]">Proses Pengajuan Terakhir</h3>
          <p className="text-sm text-[#5f6b89]">
            Ringkasan alur review pengajuan terbaru Anda dari pengajuan awal sampai keputusan akhir.
          </p>
        </div>

        {submissionFlow.length > 0 ? (
          <div className="space-y-1">
            {submissionFlow.map((stage) => (
              <SubmissionFlowRow key={stage.id} stage={stage} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-[#e8edf8] bg-white p-4 text-sm text-[#5f6b89]">
            Belum ada pengajuan terbaru untuk ditampilkan.
          </div>
        )}

        <div className="mt-4">
          <button
            type="button"
            onClick={onGoToStatus}
            className="rounded-lg bg-[#2f63e3] px-4 py-2 text-sm font-bold text-white transition hover:brightness-110"
          >
            Buka Halaman Status
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="overflow-hidden rounded-xl border border-[#dae6ff] bg-white shadow-sm">
          <div className="bg-gradient-to-r from-[#2f63e3] to-[#5381f2] p-5 text-white">
            <h3 className="text-xl font-black">Ajukan Judul Baru</h3>
            <p className="text-sm text-[#dbe7ff]">Pilih topik dosen atau kirim judul mandiri sesuai jalur yang tersedia.</p>
          </div>
          <div className="p-4">
            <button
              type="button"
              onClick={onGoToPengajuan}
              className="w-full rounded-lg bg-[#2f63e3] px-4 py-3 text-sm font-bold text-white transition hover:brightness-110"
            >
              Buat Pengajuan
            </button>
          </div>
        </div>
        <div className="overflow-hidden rounded-xl border border-[#f0e4bf] bg-white shadow-sm">
          <div className="bg-gradient-to-r from-[#fff6db] to-[#ffefbf] p-5">
            <h3 className="text-xl font-black text-[#634700]">Cek Status Pengajuan</h3>
            <p className="text-sm text-[#7c5d0f]">Lihat hasil approval dan feedback dosen dari semua pengajuan Anda.</p>
          </div>
          <div className="p-4">
            <button
              type="button"
              onClick={onGoToStatus}
              className="w-full rounded-lg bg-[#e1ae22] px-4 py-3 text-sm font-bold text-white transition hover:brightness-110"
            >
              Lihat Status
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

function LoadingState() {
  return (
    <div className="w-full space-y-5 pb-10">
      <div className="animate-pulse rounded-xl bg-white p-6 shadow-sm">
        <div className="h-8 w-80 rounded bg-[#e8edf7]" />
        <div className="mt-3 h-4 w-64 rounded bg-[#eef2fa]" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <div key={item} className="h-40 animate-pulse rounded-xl bg-white shadow-sm" />
        ))}
      </div>
    </div>
  );
}

function IzinLanjutSemesterPanel({
  gate,
  alasanPengajuan,
  onAlasanChange,
  onSubmit,
  onGoToPengajuan,
  isSubmitting,
  submitError,
  submitSuccess,
}) {
  const latestIzin = gate?.latest_izin || null;
  const status = String(latestIzin?.status || "belum_diajukan").toLowerCase();

  const statusBadge = {
    pending: "bg-[#fff3d8] text-[#9b6c00]",
    approved: "bg-[#e6f9ef] text-[#1d8d58]",
    rejected: "bg-[#ffecec] text-[#b74242]",
    belum_diajukan: "bg-[#eef2fb] text-[#5d6a8d]",
  }[status] || "bg-[#eef2fb] text-[#5d6a8d]";

  const statusLabel = {
    pending: "Menunggu Persetujuan",
    approved: "Disetujui",
    rejected: "Ditolak",
    belum_diajukan: "Belum Diajukan",
  }[status] || "Belum Diajukan";

  const isSemesterTigaPlus = Boolean(gate?.is_semester_tiga_plus);

  if (!isSemesterTigaPlus) {
    return (
      <section className="space-y-4 rounded-xl border border-[#e8ecf6] bg-white p-6 shadow-sm">
        <div className="rounded-lg border border-[#d7e5ff] bg-[#f5f9ff] p-4">
          <p className="text-sm font-semibold text-[#2f4e9f]">
            Permohonan extend belum diperlukan. Menu ini baru digunakan saat Anda memasuki
            <b> semester penjaluran ke-3</b>. Untuk saat ini, Anda bisa lanjut proses skripsi seperti biasa.
          </p>
        </div>
        <div className="rounded-lg border border-[#e8edf8] bg-white p-4 text-sm text-[#30426f]">
          <p>
            Catatan: jika nanti memasuki semester ke-3, Anda wajib mengajukan permohonan extend dan menunggu
            persetujuan dosen pembimbing skripsi.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-xl border border-[#e8ecf6] bg-white p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 h-6 w-6 text-[#b27a00]" />
        <div>
          <h3 className="text-xl font-black text-[#1a2648]">Akses Terkunci Sampai Permohonan Extend Disetujui</h3>
          <p className="mt-1 text-sm text-[#5f6b89]">
            Mahasiswa maksimal 2 semester penjaluran. Anda saat ini semester ke-
            {gate?.semester_penjaluran_aktif || "-"} dan perlu izin dosen pembimbing skripsi untuk lanjut.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-[#e3e9f8] bg-[#f8fbff] p-4">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusBadge}`}>{statusLabel}</span>
          {latestIzin?.tanggal_pengajuan ? (
            <span className="text-xs font-semibold text-[#5f6b89]">
              Diajukan: {formatShortDate(latestIzin.tanggal_pengajuan)}
            </span>
          ) : null}
        </div>
        <p className="text-sm text-[#30426f]">{gate?.message || "-"}</p>
      </div>

      {latestIzin?.alasan_pengajuan ? (
        <div className="rounded-lg border border-[#e8edf8] bg-white p-4">
          <p className="text-xs font-bold tracking-[0.06em] text-[#64739a] uppercase">Alasan Pengajuan</p>
          <p className="mt-1 text-sm text-[#25345e]">{latestIzin.alasan_pengajuan}</p>
          {latestIzin?.keterangan_dosen ? (
            <>
              <p className="mt-3 text-xs font-bold tracking-[0.06em] text-[#64739a] uppercase">
                Catatan Dosen
              </p>
              <p className="mt-1 text-sm text-[#25345e]">{latestIzin.keterangan_dosen}</p>
            </>
          ) : null}
        </div>
      ) : null}

      {gate?.must_ulang_jalur ? (
        <div className="rounded-lg border border-[#f5d2d2] bg-[#fff2f2] p-4">
          <p className="text-sm font-semibold text-[#a13f3f]">
            Izin ditolak. Anda wajib melakukan penjaluran ulang (`jalur ulang`).
          </p>
          <div className="mt-3">
            <button
              type="button"
              onClick={onGoToPengajuan}
              className="rounded-lg bg-[#2f63e3] px-4 py-2 text-xs font-bold text-white transition hover:brightness-110"
            >
              Lanjut ke Menu Pengajuan
            </button>
          </div>
        </div>
      ) : null}

      {gate?.can_submit_izin ? (
        <div className="rounded-lg border border-[#dbe4f8] bg-[#fbfdff] p-4">
          <label className="mb-2 block text-sm font-semibold text-[#324c86]">
            Alasan Mengajukan Permohonan Extend
          </label>
          <textarea
            rows={4}
            value={alasanPengajuan}
            onChange={(event) => onAlasanChange(event.target.value)}
            placeholder="Tulis alasan dan progres skripsi Anda..."
            className="w-full rounded-lg border border-[#d0dbf4] px-3 py-2 text-sm outline-none focus:border-[#2f63e3] focus:ring-2 focus:ring-[#2f63e3]/20"
          />

          {submitError ? (
            <div className="mt-3 rounded-lg border border-[#f5d0d0] bg-[#fff2f2] px-3 py-2 text-sm font-semibold text-[#a03f3f]">
              {submitError}
            </div>
          ) : null}
          {submitSuccess ? (
            <div className="mt-3 rounded-lg border border-[#d2efdf] bg-[#effcf5] px-3 py-2 text-sm font-semibold text-[#1b7a49]">
              {submitSuccess}
            </div>
          ) : null}

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onSubmit}
              className={`inline-flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-bold transition ${
                isSubmitting
                  ? "cursor-not-allowed bg-[#d5dbea] text-[#7a86a5]"
                  : "bg-[#2f63e3] text-white hover:brightness-110"
              }`}
            >
              <Send className="h-4 w-4" />
              {isSubmitting ? "Mengirim..." : "Ajukan Permohonan Extend"}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ForceChangePasswordCard({
  session,
  oldPassword,
  newPassword,
  confirmPassword,
  showOldPassword,
  showNewPassword,
  showConfirmPassword,
  isSubmitting,
  errorMessage,
  onFieldChange,
  onToggleOldPassword,
  onToggleNewPassword,
  onToggleConfirmPassword,
  onSubmit,
}) {
  return (
    <section className="rounded-xl border border-[#f4d5a0] bg-[#fff7e9] p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 h-6 w-6 text-[#c98300]" />
        <div>
          <h3 className="text-xl font-black text-[#6d4700]">Wajib Ganti Password</h3>
          <p className="mt-1 text-sm text-[#7c5f1c]">
            Untuk keamanan akun, Anda harus mengganti password default sebelum melanjutkan ke menu lain.
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-[#ecd3a7] bg-white/70 px-4 py-3 text-sm text-[#684d1b]">
        Username akun Anda adalah NIM: <span className="font-bold">{session?.user?.username || "-"}</span>
      </div>

      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        <label className="group relative block">
          <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#7c6b42]" />
          <input
            type={showOldPassword ? "text" : "password"}
            name="oldPassword"
            placeholder="Password lama (default: NIM)"
            value={oldPassword}
            onChange={onFieldChange}
            className="h-12 w-full rounded-xl border border-[#d4d9e9] bg-white pl-12 pr-12 text-[#1a2648] outline-none transition focus:border-[#2f63e3] focus:ring-4 focus:ring-[#2f63e3]/15"
          />
          <button
            type="button"
            onClick={onToggleOldPassword}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-[#5a688d] transition hover:text-[#2b3f74]"
          >
            {showOldPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </label>

        <label className="group relative block">
          <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#7c6b42]" />
          <input
            type={showNewPassword ? "text" : "password"}
            name="newPassword"
            placeholder="Password baru (minimal 6 karakter)"
            value={newPassword}
            onChange={onFieldChange}
            className="h-12 w-full rounded-xl border border-[#d4d9e9] bg-white pl-12 pr-12 text-[#1a2648] outline-none transition focus:border-[#2f63e3] focus:ring-4 focus:ring-[#2f63e3]/15"
          />
          <button
            type="button"
            onClick={onToggleNewPassword}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-[#5a688d] transition hover:text-[#2b3f74]"
          >
            {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </label>

        <label className="group relative block">
          <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#7c6b42]" />
          <input
            type={showConfirmPassword ? "text" : "password"}
            name="confirmPassword"
            placeholder="Konfirmasi password baru"
            value={confirmPassword}
            onChange={onFieldChange}
            className="h-12 w-full rounded-xl border border-[#d4d9e9] bg-white pl-12 pr-12 text-[#1a2648] outline-none transition focus:border-[#2f63e3] focus:ring-4 focus:ring-[#2f63e3]/15"
          />
          <button
            type="button"
            onClick={onToggleConfirmPassword}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-[#5a688d] transition hover:text-[#2b3f74]"
          >
            {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </label>

        {errorMessage ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{errorMessage}</div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-xl bg-[#2f63e3] px-5 py-2.5 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Menyimpan..." : "Simpan Password Baru"}
          </button>
        </div>
      </form>
    </section>
  );
}

function DashboardPage({ session, apiBaseUrl, onLogout, onSessionExpired, onPasswordChanged }) {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [refreshTick, setRefreshTick] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState(null);
  const [jalurStatus, setJalurStatus] = useState(null);
  const [jalurEligibility, setJalurEligibility] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [bimbinganSummary, setBimbinganSummary] = useState(null);
  const [izinLanjutReason, setIzinLanjutReason] = useState("");
  const [izinLanjutSubmitting, setIzinLanjutSubmitting] = useState(false);
  const [izinLanjutError, setIzinLanjutError] = useState("");
  const [izinLanjutSuccess, setIzinLanjutSuccess] = useState("");
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordError, setPasswordError] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const sessionExpiredRef = useRef(false);
  const mustChangePassword = Boolean(session?.user?.role === "mahasiswa" && session?.prompt_change_password);
  const semesterLanjutanGate = jalurStatus?.semester_lanjutan_gate || null;
  const isHardLockedBySemester = Boolean(
    !mustChangePassword &&
      semesterLanjutanGate?.is_semester_tiga_plus &&
      semesterLanjutanGate?.is_locked &&
      !semesterLanjutanGate?.must_ulang_jalur
  );
  const onboardingState = jalurEligibility?.onboarding || null;
  const isLockedByOnboarding = Boolean(!mustChangePassword && onboardingState?.is_locked);
  const onboardingLockReason =
    onboardingState?.reason || "Selesaikan form lanjutan jalur terlebih dahulu sebelum membuka menu lain.";
  const onboardingTargetJalur =
    onboardingState?.target_jalur || jalurEligibility?.pendaftaran_aktif?.selected_jalur || null;
  const selectedJalurAktif =
    onboardingTargetJalur ||
    jalurStatus?.pendaftaran_aktif?.jalur_form_lanjutan ||
    jalurEligibility?.pendaftaran_aktif?.selected_jalur ||
    null;
  const latestSubmissionForBimbingan = jalurStatus?.last_submission || submissions?.[0] || null;
  const latestSubmissionStatusForBimbingan = String(latestSubmissionForBimbingan?.status || "").toLowerCase();
  const isPenelitianApprovedForBimbingan =
    latestSubmissionStatusForBimbingan === "approved" || latestSubmissionStatusForBimbingan === "completed";

  useEffect(() => {
    let isMounted = true;
    sessionExpiredRef.current = false;

    const fetchWithAuth = async (path) => {
      const response = await fetch(`${apiBaseUrl}${path}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.token}`,
          "Content-Type": "application/json",
        },
      });

      let data = null;
      try {
        data = await response.json();
      } catch (parseError) {
        data = null;
      }

      if (response.status === 401 || response.status === 403) {
        if (!sessionExpiredRef.current) {
          sessionExpiredRef.current = true;
          onSessionExpired?.();
        }
        throw new Error("__SESSION_EXPIRED__");
      }

      if (!response.ok || !data?.success) {
        const message = data?.message || `Gagal memuat data ${path}`;
        throw new Error(message);
      }

      return data.data;
    };

    const loadData = async () => {
      setLoading(true);
      setError("");

      const [profileResult, jalurResult, jalurEligibilityResult, submissionsResult, bimbinganResult] =
        await Promise.allSettled([
        fetchWithAuth("/api/mahasiswa/profile"),
        fetchWithAuth("/api/jalur/status"),
        fetchWithAuth("/api/jalur/eligibility"),
        fetchWithAuth("/api/submissions"),
        fetchWithAuth("/api/mahasiswa/bimbingan?summary_only=1"),
      ]);

      if (!isMounted) return;
      if (sessionExpiredRef.current) return;

      const issues = [];

      if (profileResult.status === "fulfilled") {
        setProfile(profileResult.value);
      } else {
        setProfile(null);
        issues.push(profileResult.reason?.message || "Gagal memuat profil mahasiswa.");
      }

      if (jalurResult.status === "fulfilled") {
        setJalurStatus(jalurResult.value);
      } else {
        setJalurStatus(null);
        issues.push(jalurResult.reason?.message || "Gagal memuat status jalur.");
      }

      if (jalurEligibilityResult.status === "fulfilled") {
        setJalurEligibility(jalurEligibilityResult.value);
      } else {
        setJalurEligibility(null);
        issues.push(jalurEligibilityResult.reason?.message || "Gagal memuat eligibility jalur.");
      }

      if (submissionsResult.status === "fulfilled") {
        setSubmissions(Array.isArray(submissionsResult.value) ? submissionsResult.value : []);
      } else {
        setSubmissions([]);
        issues.push(submissionsResult.reason?.message || "Gagal memuat data submissions.");
      }

      if (bimbinganResult.status === "fulfilled") {
        setBimbinganSummary(bimbinganResult.value || null);
      } else {
        setBimbinganSummary(null);
        issues.push(bimbinganResult.reason?.message || "Gagal memuat data bimbingan.");
      }

      setError(issues.join(" "));
      setLoading(false);
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [apiBaseUrl, onSessionExpired, refreshTick, session.token]);

  const pageData = useMemo(
    () => ({
      profile,
      jalurStatus,
      jalurEligibility,
      submissions,
      bimbinganSummary,
      sessionUser: session.user,
    }),
    [profile, jalurStatus, jalurEligibility, submissions, bimbinganSummary, session.user]
  );
  const visibleNavItems = NAV_ITEMS;
  const activeTabHeader = TAB_HEADERS[activeTab] || TAB_HEADERS.dashboard;
  const bimbinganLockInfo = useMemo(() => {
    const hasDospem = Boolean(profile?.dosenPembimbingSkripsi?.id);

    if (selectedJalurAktif && selectedJalurAktif !== "penelitian") {
      return {
        isLocked: true,
        reason: `Menu bimbingan belum aktif untuk jalur ${formatJalurLabel(
          selectedJalurAktif
        )}. Saat ini bimbingan hanya dibuka untuk jalur Penelitian.`,
      };
    }

    if (selectedJalurAktif === "penelitian") {
      if (!isPenelitianApprovedForBimbingan) {
        return {
          isLocked: true,
          reason: "Bimbingan aktif setelah pengajuan penelitian Anda disetujui oleh reviewer yang berwenang.",
        };
      }
      if (!hasDospem) {
        return {
          isLocked: true,
          reason: "Dosen pembimbing skripsi belum ditetapkan. Bimbingan akan aktif setelah pembimbing ditetapkan.",
        };
      }
      return { isLocked: false, reason: "" };
    }

    if (!selectedJalurAktif) {
      if (!isPenelitianApprovedForBimbingan) {
        return {
          isLocked: true,
          reason: "Bimbingan aktif setelah pengajuan Anda disetujui.",
        };
      }
      if (!hasDospem) {
        return {
          isLocked: true,
          reason: "Dosen pembimbing skripsi belum ditetapkan.",
        };
      }
    }

    return { isLocked: false, reason: "" };
  }, [isPenelitianApprovedForBimbingan, profile?.dosenPembimbingSkripsi?.id, selectedJalurAktif]);

  useEffect(() => {
    if (mustChangePassword) {
      setActiveTab("dashboard");
      return;
    }

    if (isHardLockedBySemester) {
      setActiveTab("izin-lanjut");
      return;
    }

    if (isLockedByOnboarding) {
      setActiveTab("pengajuan");
    }
  }, [isHardLockedBySemester, isLockedByOnboarding, mustChangePassword]);

  useEffect(() => {
    if (!mustChangePassword && activeTab === "bimbingan" && bimbinganLockInfo.isLocked) {
      setActiveTab("dashboard");
    }
  }, [activeTab, bimbinganLockInfo.isLocked, mustChangePassword]);

  useEffect(() => {
    if (!isHardLockedBySemester) {
      setIzinLanjutError("");
      setIzinLanjutSuccess("");
    }
  }, [isHardLockedBySemester]);

  const handlePasswordFieldChange = (event) => {
    const { name, value } = event.target;
    setPasswordForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleChangePassword = async (event) => {
    event.preventDefault();
    setPasswordError("");

    if (!passwordForm.oldPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordError("Semua field password wajib diisi.");
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setPasswordError("Password baru minimal 6 karakter.");
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("Konfirmasi password baru tidak sama.");
      return;
    }

    try {
      setSavingPassword(true);
      const response = await fetch(`${apiBaseUrl}/api/auth/change-password`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          oldPassword: passwordForm.oldPassword,
          newPassword: passwordForm.newPassword,
        }),
      });

      const data = await response.json().catch(() => null);

      if (response.status === 401 || response.status === 403) {
        const lowerMessage = String(data?.message || "").toLowerCase();
        const isTokenError =
          lowerMessage.includes("token tidak valid") ||
          lowerMessage.includes("token tidak ditemukan") ||
          lowerMessage.includes("kadaluarsa");
        if (isTokenError) {
          onSessionExpired?.();
          return;
        }
      }

      if (!response.ok || !data?.success) {
        setPasswordError(data?.message || "Gagal mengganti password.");
        return;
      }

      setPasswordForm({ oldPassword: "", newPassword: "", confirmPassword: "" });
      setShowOldPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      onPasswordChanged?.();
      setActiveTab("pengajuan");
    } catch (requestError) {
      setPasswordError("Tidak dapat terhubung ke server.");
    } finally {
      setSavingPassword(false);
    }
  };

  const handleSubmitIzinLanjut = async () => {
    setIzinLanjutError("");
    setIzinLanjutSuccess("");

    const alasan = izinLanjutReason.trim();
    if (alasan.length < 10) {
      setIzinLanjutError("Alasan izin lanjut minimal 10 karakter.");
      return;
    }

    try {
      setIzinLanjutSubmitting(true);

      const response = await fetch(`${apiBaseUrl}/api/jalur/izin-lanjut`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ alasan_pengajuan: alasan }),
      });

      const data = await response.json().catch(() => null);

      if (response.status === 401 || response.status === 403) {
        const lowerMessage = String(data?.message || "").toLowerCase();
        const isTokenError =
          lowerMessage.includes("token tidak valid") ||
          lowerMessage.includes("token tidak ditemukan") ||
          lowerMessage.includes("kadaluarsa");
        if (isTokenError) {
          onSessionExpired?.();
          return;
        }
      }

      if (!response.ok || !data?.success) {
        setIzinLanjutError(data?.message || "Gagal mengajukan izin lanjut.");
        return;
      }

      setIzinLanjutReason("");
      setIzinLanjutSuccess(data?.message || "Permintaan izin lanjut berhasil dikirim.");
      setRefreshTick((prev) => prev + 1);
    } catch (requestError) {
      setIzinLanjutError("Tidak dapat terhubung ke server.");
    } finally {
      setIzinLanjutSubmitting(false);
    }
  };

  return (
    <div className="h-screen overflow-hidden bg-[#f2f3f7]">
      <header className="fixed inset-x-0 top-0 z-40 bg-[#2f63e3] text-white shadow-sm">
        <div className="flex w-full items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-[#f7d13d] p-1.5">
              <img
                src={`${process.env.PUBLIC_URL}/2_UII Background Terang.png`}
                alt="Logo UII"
                className="h-7 w-7 object-contain"
              />
            </div>
            <div>
              <p className="text-sm font-black tracking-wide">SIMPS UII</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <UserCircle2 className="h-7 w-7 text-[#dde7ff]" />
            <div className="text-right">
              <p className="text-sm font-bold">{profile?.nama || session.user?.nama}</p>
              <p className="text-xs text-[#d4e1ff]">{profile?.nim || session.user?.username}</p>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="rounded-lg border border-white/30 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/20"
            >
              <span className="inline-flex items-center gap-1">
                <LogOut className="h-3.5 w-3.5" />
                Keluar
              </span>
            </button>
          </div>
        </div>
      </header>

      <div className="mt-[76px] h-[calc(100vh-76px)] w-full overflow-hidden px-4 py-4 sm:px-6 lg:px-8">
        <div className="grid h-full grid-cols-1 items-stretch gap-4 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="h-full rounded-xl border border-[#dce4f7] bg-white p-2 shadow-sm lg:overflow-y-auto">
            <p className="px-3 pb-2 pt-1 text-xs font-bold tracking-[0.08em] text-[#7d89a8] uppercase">Navigasi</p>
            <div className="space-y-1">
              {visibleNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                const isLockedBySemester = isHardLockedBySemester && item.id !== "izin-lanjut";
                const isLockedByOnboardingItem = isLockedByOnboarding && item.id !== "pengajuan";
                const isLockedByBimbinganRule = item.id === "bimbingan" && bimbinganLockInfo.isLocked;
                const isDisabled = mustChangePassword || isLockedBySemester || isLockedByOnboardingItem || isLockedByBimbinganRule;
                const disabledReason = mustChangePassword
                  ? "Ubah password default terlebih dahulu."
                  : isLockedBySemester
                    ? semesterLanjutanGate?.message || "Akses menu lain dikunci sampai permohonan extend diputuskan."
                    : isLockedByOnboardingItem
                      ? onboardingLockReason
                      : isLockedByBimbinganRule
                        ? bimbinganLockInfo.reason
                      : "";

                return (
                  <button
                    key={item.id}
                    type="button"
                    title={isDisabled ? disabledReason : ""}
                    disabled={isDisabled}
                    onClick={() => {
                      if (!isDisabled) {
                        setActiveTab(item.id);
                      }
                    }}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition ${
                      isActive ? "bg-[#2f63e3] text-white shadow-sm" : "text-[#405070] hover:bg-[#f2f6ff]"
                    } ${isDisabled ? "cursor-not-allowed opacity-55" : ""}`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </button>
                );
              })}
            </div>
            {isLockedByOnboarding ? (
              <div className="mt-3 rounded-lg border border-[#f0ddb7] bg-[#fff8e8] px-3 py-2 text-xs font-semibold text-[#835a00]">
                {onboardingLockReason}
                {onboardingTargetJalur ? ` (Jalur: ${String(onboardingTargetJalur).replace(/_/g, " ")})` : ""}
              </div>
            ) : null}
          </aside>

          <div
            className="min-w-0 flex h-full min-h-0 flex-col gap-4 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{ msOverflowStyle: "none" }}
          >
            {mustChangePassword ? (
              <ForceChangePasswordCard
                session={session}
                oldPassword={passwordForm.oldPassword}
                newPassword={passwordForm.newPassword}
                confirmPassword={passwordForm.confirmPassword}
                showOldPassword={showOldPassword}
                showNewPassword={showNewPassword}
                showConfirmPassword={showConfirmPassword}
                isSubmitting={savingPassword}
                errorMessage={passwordError}
                onFieldChange={handlePasswordFieldChange}
                onToggleOldPassword={() => setShowOldPassword((prev) => !prev)}
                onToggleNewPassword={() => setShowNewPassword((prev) => !prev)}
                onToggleConfirmPassword={() => setShowConfirmPassword((prev) => !prev)}
                onSubmit={handleChangePassword}
              />
            ) : null}

            {!mustChangePassword && activeTab !== "bimbingan" ? (
              <MenuSectionHeader
                icon={activeTabHeader.icon}
                title={activeTabHeader.title}
                subtitle={activeTabHeader.subtitle}
              />
            ) : null}

            {error && !mustChangePassword ? (
              <div className="rounded-xl border border-[#f6d7d7] bg-[#fff2f2] p-4 text-sm font-semibold text-[#a03f3f]">{error}</div>
            ) : null}

            {loading && !mustChangePassword ? <LoadingState /> : null}

            {!loading && !mustChangePassword && activeTab === "dashboard" ? (
              <DashboardHome data={pageData} onGoToPengajuan={() => setActiveTab("pengajuan")} onGoToStatus={() => setActiveTab("status")} />
            ) : null}

            {!loading && !mustChangePassword && activeTab === "izin-lanjut" ? (
              <IzinLanjutSemesterPanel
                gate={semesterLanjutanGate}
                alasanPengajuan={izinLanjutReason}
                onAlasanChange={setIzinLanjutReason}
                onSubmit={handleSubmitIzinLanjut}
                onGoToPengajuan={() => setActiveTab("pengajuan")}
                isSubmitting={izinLanjutSubmitting}
                submitError={izinLanjutError}
                submitSuccess={izinLanjutSuccess}
              />
            ) : null}

            {!loading && !mustChangePassword && activeTab === "pengajuan" ? (
              <PengajuanPage
                session={session}
                apiBaseUrl={apiBaseUrl}
                onSessionExpired={onSessionExpired}
                studentProfile={profile}
                jalurEligibility={jalurEligibility}
                onEligibilityRefresh={() => setRefreshTick((prev) => prev + 1)}
              />
            ) : null}
            {!loading && !mustChangePassword && activeTab === "status" ? (
              <StatusPage
                session={session}
                apiBaseUrl={apiBaseUrl}
                onSessionExpired={onSessionExpired}
                initialJalurStatus={jalurStatus}
                initialSubmissions={submissions}
              />
            ) : null}
            {!loading && !mustChangePassword && activeTab === "bimbingan" ? (
              <BimbinganPage
                session={session}
                apiBaseUrl={apiBaseUrl}
                onSessionExpired={onSessionExpired}
                onUpdated={() => setRefreshTick((prev) => prev + 1)}
              />
            ) : null}
            {!loading && !mustChangePassword && activeTab === "dokumen" ? (
              <div className="rounded-xl border border-[#e8ecf6] bg-white p-6 shadow-sm">
                <h3 className="text-xl font-black text-[#1a2648]">Dokumen</h3>
                <p className="mt-2 text-sm text-[#5f6b89]">Halaman dokumen belum diimplementasikan. Nanti bisa kita sambungkan ke API dokumen skripsi.</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
