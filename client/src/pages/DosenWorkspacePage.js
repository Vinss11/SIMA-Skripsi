import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  BookOpenCheck,
  CalendarRange,
  ClipboardList,
  Download,
  Bell,
  Eye,
  FileSpreadsheet,
  LayoutDashboard,
  ListChecks,
  LogOut,
  MessageSquareText,
  Plus,
  RefreshCcw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Upload,
  GraduationCap,
  UserCircle2,
  Users,
} from "lucide-react";
import Swal from "sweetalert2";
import MenuSectionHeader from "../components/MenuSectionHeader";
import DosenBimbinganReviewPage from "./DosenBimbinganReviewPage";
import DosenDokumenSidangReviewPage from "./DosenDokumenSidangReviewPage";
import DosenSidangKetersediaanPage from "./DosenSidangKetersediaanPage";
import SekretarisSidangManagementPage from "./SekretarisSidangManagementPage";

const TOPIK_PAGE_SIZE = 20;
const MASTER_TOPIK_PAGE_SIZE = 20;
const MAHASISWA_MASTER_PAGE_SIZE = 20;
const DOSEN_GRID_PAGE_SIZE = 20;
const MAHASISWA_MASTER_FILTER_INITIAL = {
  angkatan: "",
  semester_penjaluran: "",
  periode: "",
  penjaluran: "",
  tipe_pendaftaran: "",
};
const PENDAFTARAN_FILTER_INITIAL = {
  angkatan: "",
  tahun_akademik: "",
  semester_akademik: "",
  penjaluran: "",
  tipe_pendaftaran: "",
};
const MASTER_DOSEN_TAB_OPTIONS = [
  { key: "penanggung-jawab", label: "Penanggung Jawab Penjaluran" },
  { key: "kuota-bimbingan", label: "Kuota Bimbingan Mahasiswa" },
];
const TOPIK_UPLOAD_PREVIEW_MAX_ROWS = 10;
const TOPIK_UPLOAD_PREVIEW_PAGE_SIZE = 5;
const TOPIK_CLUSTER_OPTIONS = ["Sirkel", "Siber", "ITSC", "MVK"];
const TOPIK_CLUSTER_CODE_BY_LABEL = {
  Sirkel: "SIRKEL",
  Siber: "SIBER",
  ITSC: "ITSC",
  MVK: "MVK",
};
const TOPIK_CLUSTER_LABEL_BY_CODE = {
  SIRKEL: "Sirkel",
  SIBER: "Siber",
  ITSC: "ITSC",
  MVK: "MVK",
};
const PERIODE_MASTER_KETUA_FIELDS = [
  {
    key: "ketua_itsc_dosen_id",
    code: "ITSC",
    label: "Ketua ITSC (Informatika Teori & Sistem Cerdas)",
  },
  {
    key: "ketua_sirkel_dosen_id",
    code: "SIRKEL",
    label: "Ketua SIRKEL (Sistem Informasi & Rekayasa Perangkat Lunak)",
  },
  {
    key: "ketua_siber_dosen_id",
    code: "SIBER",
    label: "Ketua SIBER (Sistem Siber)",
  },
  {
    key: "ketua_mvk_dosen_id",
    code: "MVK",
    label: "Ketua MVK (Multimedia & Visi Komputer)",
  },
];
const PERIODE_MASTER_JALUR_FIELDS = [
  {
    key: "pengawas_magang_dosen_id",
    label: "Dosen Pengawas Magang",
    optionLabel: "Pilih dosen pengawas magang",
  },
  {
    key: "pengawas_pengabdian_dosen_id",
    label: "Dosen Pengampu Pengabdian Masyarakat",
    optionLabel: "Pilih dosen pengampu pengabdian",
  },
  {
    key: "pengawas_perintisan_bisnis_dosen_id",
    label: "Dosen Pengampu Perintisan Bisnis",
    optionLabel: "Pilih dosen pengampu perintisan bisnis",
  },
];
const PERIODE_MASTER_ALL_FIELDS = [...PERIODE_MASTER_KETUA_FIELDS, ...PERIODE_MASTER_JALUR_FIELDS];
const PERIODE_MASTER_INITIAL = {
  ketua_itsc_dosen_id: "",
  ketua_sirkel_dosen_id: "",
  ketua_siber_dosen_id: "",
  ketua_mvk_dosen_id: "",
  pengawas_magang_dosen_id: "",
  pengawas_pengabdian_dosen_id: "",
  pengawas_perintisan_bisnis_dosen_id: "",
};
function buildPeriodeMasterSearchInitial() {
  const next = {};
  for (const item of PERIODE_MASTER_ALL_FIELDS) {
    next[item.key] = "";
  }
  return next;
}

function buildMahasiswaMasterPeriodeFilterValue(row) {
  const periodeLabel = String(row?.periode_label || "").trim();
  if (periodeLabel) return periodeLabel;

  const tahunAkademik = String(row?.tahun_akademik || "").trim();
  const semesterAkademik = String(row?.semester_akademik || "").trim();
  if (tahunAkademik && semesterAkademik) {
    return `${tahunAkademik} - ${formatLabel(semesterAkademik)}`;
  }
  if (tahunAkademik) return tahunAkademik;
  if (semesterAkademik) return formatLabel(semesterAkademik);
  return "";
}

const PERIODE_FORM_INITIAL = {
  tahun_akademik: "",
  semester: "ganjil",
  tanggal_mulai: "",
  tanggal_selesai: "",
};
const RESEARCH_CLUSTER_EDITOR_FIELDS = [
  {
    key: "ITSC",
    label: "Ketua ITSC (Informatika Teori & Sistem Cerdas)",
  },
  {
    key: "SIRKEL",
    label: "Ketua SIRKEL (Sistem Informasi & Rekayasa Perangkat Lunak)",
  },
  {
    key: "SIBER",
    label: "Ketua SIBER (Sistem Siber)",
  },
  {
    key: "MVK",
    label: "Ketua MVK (Multimedia & Visi Komputer)",
  },
];

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function parseDateTime(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getReviewCountdown(deadlineAt, now = new Date()) {
  const deadline = parseDateTime(deadlineAt);
  if (!deadline) {
    return {
      has_deadline: false,
      is_expired: false,
      remaining_ms: 0,
      label: "-",
      short_label: "-",
      deadline,
    };
  }

  const remainingMs = deadline.getTime() - now.getTime();
  if (remainingMs <= 0) {
    return {
      has_deadline: true,
      is_expired: true,
      remaining_ms: 0,
      label: "Waktu review habis",
      short_label: "Habis",
      deadline,
    };
  }

  const totalSeconds = Math.floor(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value) => String(value).padStart(2, "0");

  return {
    has_deadline: true,
    is_expired: false,
    remaining_ms: remainingMs,
    label: `${pad(hours)}j ${pad(minutes)}m ${pad(seconds)}d`,
    short_label: `${hours}j ${pad(minutes)}m`,
    deadline,
  };
}

function getSubmissionTopikCount(row) {
  if (!row || row.tipe_pengajuan !== "topik_dosen") return 0;
  const fromDetails = Array.isArray(row.topik_dipilih_detail) ? row.topik_dipilih_detail.length : 0;
  if (fromDetails > 0) return fromDetails;
  const fromCodes = Array.isArray(row.topik_dipilih) ? row.topik_dipilih.length : 0;
  return fromCodes;
}

function hasSameDosenTopikBadge(row) {
  if (!row || row.tipe_pengajuan !== "topik_dosen") return false;
  const topikDetails = Array.isArray(row.topik_dipilih_detail) ? row.topik_dipilih_detail : [];
  if (topikDetails.length <= 1) return false;
  const dosenSet = new Set(topikDetails.map((item) => Number(item?.dosen_id)).filter(Boolean));
  return dosenSet.size === 1;
}

function isKetuaClusterSubmissionReview(row) {
  const context = String(row?.review_context || "").toLowerCase();
  const stage = String(row?.tahap || row?.tahap_approval || "").toLowerCase();
  return (
    context === "ketua_klaster" ||
    context === "ketua_cluster" ||
    stage === "pending_ketua_klaster" ||
    stage === "pending_ketua_cluster"
  );
}

function getPeriodeStatusKey(periode) {
  if (isPeriodeEnded(periode)) return "closed";
  const explicitStatus = String(periode?.status || "")
    .trim()
    .toLowerCase();
  if (explicitStatus) return explicitStatus;
  return periode?.is_active ? "active" : "closed";
}

function parsePeriodeDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isPeriodeEnded(periode, now = new Date()) {
  const end = parsePeriodeDate(periode?.tanggal_selesai);
  if (!end) return false;
  return now.getTime() > end.getTime();
}

function canEditPeriodeRow(periode, now = new Date()) {
  const status = getPeriodeStatusKey(periode);
  if (status === "closed") return false;
  if (isPeriodeEnded(periode, now)) return false;
  return status === "active" || status === "draft";
}

function formatLabel(value) {
  if (!value) return "-";
  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatPeriodeMasterDosenInputLabel(dosen) {
  if (!dosen) return "";
  const nama = String(dosen?.nama || "").trim();
  const nik = String(dosen?.nik || "").trim();
  if (nama && nik) return `${nama} - NIK: ${nik}`;
  if (nama) return nama;
  if (nik) return `NIK: ${nik}`;
  return "";
}

function buildPeriodeMasterFormFromSource(source) {
  const next = { ...PERIODE_MASTER_INITIAL };
  for (const item of PERIODE_MASTER_ALL_FIELDS) {
    next[item.key] = source?.[item.key] ? String(source[item.key]) : "";
  }
  return next;
}

function buildPeriodeMasterSearchFromSource(source) {
  const next = buildPeriodeMasterSearchInitial();
  for (const item of PERIODE_MASTER_ALL_FIELDS) {
    const associationKey = item.key.replace(/_id$/, "");
    next[item.key] = formatPeriodeMasterDosenInputLabel(source?.[associationKey]);
  }
  return next;
}

function escapeHtml(value) {
  return String(value ?? "-")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getMagangPayload(row) {
  const payload = row?.payload;
  return payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
}

function formatMagangPayloadValue(value) {
  if (value === undefined || value === null || value === "") return "-";
  if (Array.isArray(value)) {
    const joined = value.map((item) => formatMagangPayloadValue(item)).filter((item) => item !== "-").join(", ");
    return joined || "-";
  }
  if (typeof value === "boolean") return value ? "Ya" : "Tidak";
  if (typeof value === "object") {
    if (value.nama) return String(value.nama);
    if (value.name) return String(value.name);
    return JSON.stringify(value);
  }
  return String(value);
}

function pickMagangPayloadText(row, keys) {
  const payload = getMagangPayload(row);
  for (const key of keys) {
    const value = payload[key];
    const formatted = formatMagangPayloadValue(value);
    if (formatted !== "-") return formatted;
  }
  return "-";
}

function getMagangCompanyName(row) {
  const payload = getMagangPayload(row);
  const snapshot = payload.mitra_snapshot && typeof payload.mitra_snapshot === "object" ? payload.mitra_snapshot : {};
  return (
    formatMagangPayloadValue(payload.company_name) !== "-"
      ? formatMagangPayloadValue(payload.company_name)
      : formatMagangPayloadValue(payload.chosen_institution) !== "-"
      ? formatMagangPayloadValue(payload.chosen_institution)
      : formatMagangPayloadValue(snapshot.nama)
  );
}

function getMagangCompanyTypeLabel(row) {
  const companyType = String(getMagangPayload(row).company_type || "").toLowerCase();
  if (companyType === "partner_company") return "Mitra";
  if (companyType === "non_partner_company") return "Non Mitra";
  return formatLabel(companyType || "-");
}

function getMagangReviewStatus(row) {
  return row?.workflow_status || row?.form_lanjutan_status || "-";
}

function getMagangStatusBadgeClass(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "approved") return "bg-[#137748] text-white";
  if (normalized === "rejected") return "bg-[#b73a3a] text-white";
  if (normalized === "review_dosen_magang") return "bg-[#eaf1ff] text-[#2756b8]";
  if (normalized === "review_sekprodi") return "bg-[#fff4d8] text-[#9b6b00]";
  if (normalized === "submitted") return "bg-[#fdf1d4] text-[#a06a00]";
  return "bg-[#eef2fb] text-[#5c6d95]";
}

function getMagangDetailFields(row) {
  const payload = getMagangPayload(row);
  const sector =
    payload.company_sector === "other"
      ? formatMagangPayloadValue(payload.company_sector_other)
      : formatLabel(payload.company_sector);
  const proposedPosition =
    payload.proposed_position === "other"
      ? formatMagangPayloadValue(payload.proposed_position_other)
      : formatLabel(payload.proposed_position);
  const applicationMethod =
    payload.internship_application_method === "other"
      ? formatMagangPayloadValue(payload.internship_application_method_other)
      : formatLabel(payload.internship_application_method);

  return [
    ["Mahasiswa", `${row?.mahasiswa?.nama || "-"} (${row?.mahasiswa?.nim || "-"})`],
    ["Email", row?.mahasiswa?.email || "-"],
    ["Angkatan", row?.mahasiswa?.angkatan || "-"],
    ["Periode", row?.periode?.label_periode || "-"],
    ["Status Review", row?.workflow_status_label || formatLabel(getMagangReviewStatus(row))],
    ["Tipe Perusahaan", getMagangCompanyTypeLabel(row)],
    ["Institusi Dipilih", payload.chosen_institution],
    ["Nama Perusahaan", getMagangCompanyName(row)],
    ["Alamat Institusi", payload.complete_address_of_institution],
    ["Sektor Perusahaan", sector],
    ["Posisi Diajukan", proposedPosition],
    ["Nomor Telepon", payload.phone_number],
    ["Tanggal Apply", payload.tanggal_apply],
    ["Metode Apply", payload.metode_apply],
    ["Bukti Apply", payload.bukti_apply],
    ["Website Perusahaan", payload.internship_company_website_url],
    ["URL Vacancy", payload.internship_vacancy_url],
    ["Catatan Dokumen Pendukung", payload.supporting_documents_note],
    ["CV", payload.cv_file_name],
    ["Portfolio", payload.portfolio_file_name],
    ["Transkrip", payload.transcript_file_name],
    ["Dokumen Pendukung Lain", payload.other_supporting_documents_file_name],
    ["Tahun Berdiri", payload.year_of_establishment],
    ["Jumlah Karyawan", payload.number_of_employees],
    ["Metode Pendaftaran Magang", applicationMethod],
    ["Proses Seleksi", payload.selection_processes],
  ];
}

function getMagangTimelineHtml(row) {
  const timeline = Array.isArray(getMagangPayload(row).workflow_timeline)
    ? getMagangPayload(row).workflow_timeline
    : [];
  if (timeline.length === 0) {
    return `<div style="border:1px solid #e4e9f6;border-radius:8px;padding:10px;background:#f8fbff;color:#65749b;font-weight:600;">Belum ada timeline workflow.</div>`;
  }

  return timeline
    .map((item) => {
      const actor = formatLabel(item?.actor || "-");
      const status = formatLabel(item?.status || "-");
      const at = formatDateTime(item?.at);
      return `
        <div style="border:1px solid #e4e9f6;border-radius:8px;padding:10px;background:#f8fbff;margin-top:8px;">
          <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;">
            <b>${escapeHtml(status)}</b>
            <span style="font-size:12px;color:#60709a;">${escapeHtml(at)}</span>
          </div>
          <p style="margin:4px 0 0;color:#42537d;">${escapeHtml(actor)}</p>
          <p style="margin:4px 0 0;color:#2f426f;">${escapeHtml(item?.note || "-")}</p>
        </div>
      `;
    })
    .join("");
}

function getPengampuReviewStatus(row) {
  return row?.workflow_status || row?.form_lanjutan_status || "-";
}

function getPengampuReviewSummary(row) {
  return formatMagangPayloadValue(getMagangPayload(row).ringkasan);
}

function getPengampuReviewNote(row) {
  return formatMagangPayloadValue(getMagangPayload(row).catatan);
}

function getPengampuReviewStatusBadgeClass(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "approved") return "bg-[#137748] text-white";
  if (normalized === "rejected") return "bg-[#b73a3a] text-white";
  if (normalized === "submitted") return "bg-[#fdf1d4] text-[#a06a00]";
  return "bg-[#eef2fb] text-[#5c6d95]";
}

function getPengampuReviewDetailFields(row, config) {
  return [
    ["Mahasiswa", `${row?.mahasiswa?.nama || "-"} (${row?.mahasiswa?.nim || "-"})`],
    ["Email", row?.mahasiswa?.email || "-"],
    ["Angkatan", row?.mahasiswa?.angkatan || "-"],
    ["Periode", row?.periode?.label_periode || "-"],
    ["Jalur", formatLabel(config?.jalur || row?.jalur)],
    ["Status Review", row?.workflow_status_label || formatLabel(getPengampuReviewStatus(row))],
    [config?.summaryLabel || "Ringkasan", getPengampuReviewSummary(row)],
    [config?.noteLabel || "Catatan", getPengampuReviewNote(row)],
    ["Tanggal Dikirim", formatDateTime(row?.submitted_at || row?.createdAt)],
  ];
}

function getSubmissionStatusBadgeClass(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "approved") return "bg-[#137748] text-white";
  if (normalized === "rejected") return "bg-[#b73a3a] text-white";
  if (normalized === "pending") return "bg-[#fdf1d4] text-[#a06a00]";
  return "bg-[#eef2fb] text-[#5c6d95]";
}

function getSubmissionApprovalRoleKey(item) {
  const approvalType = String(item?.tipe_approval || "calon_pembimbing").toLowerCase();
  if (
    approvalType === "koordinator" ||
    approvalType === "ketua_klaster" ||
    approvalType === "ketua_cluster"
  ) {
    return "ketua_cluster";
  }
  return "dosen_pembimbing";
}

function getSubmissionDecisionNoteLabel(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "approved") return "Alasan approve";
  if (normalized === "rejected") return "Alasan reject";
  return "Catatan keputusan";
}

function getSubmissionGridStatus(row) {
  if (!row) return "-";
  return row.status_dosen || row.reviewer_display_status || row.reviewer_status || row.status || "-";
}

function getDosenSubmissionTahapLabel(row) {
  const tahap = String(row?.tahap_approval || row?.tahap || "").toLowerCase();
  const status = String(row?.status || "").toLowerCase();
  const tipePengajuan = String(row?.tipe_pengajuan || "").toLowerCase();

  if (status === "approved") return "Selesai (Disetujui)";
  if (status === "rejected") return "Selesai (Ditolak)";
  if (status === "menunggu_set_ketua_cluster") return "Menunggu Penetapan Ketua Cluster";
  if (tahap === "pending_ketua_klaster") return "Menunggu Review Ketua Cluster";
  if (tahap === "pending_review_parallel") return "Menunggu Review Dosen Pembimbing";
  if (tahap === "pending_dosen_pembimbing") return "Menunggu Review Dosen Pembimbing";
  if (tahap === "deadline_terlewati") return "Batas Review Dosen Terlewati";
  if (tahap === "menunggu_set_ketua_cluster") return "Menunggu Penetapan Ketua Cluster";
  if (tipePengajuan === "judul_mandiri" && status === "pending") return "Menunggu Review Dosen";
  if (status === "pending") return "Sedang Direview";
  return formatLabel(tahap || status || "-");
}

function shouldShowTopikReviewCountdown(row) {
  const tahap = String(row?.tahap_approval || "").toLowerCase();
  const tipe = String(row?.tipe_pengajuan || "").toLowerCase();
  const status = String(row?.status || "").toLowerCase();
  return (
    status === "pending" &&
    ((tipe === "topik_dosen" && (tahap === "pending_review_parallel" || tahap === "deadline_terlewati")) ||
      (tipe === "judul_mandiri" && tahap === "pending_dosen_pembimbing"))
  );
}

function SubmissionDecisionHistoryGroup({
  title,
  description,
  rows,
  emptyMessage,
  tone = "dosen",
}) {
  const accent =
    tone === "ketua"
      ? {
          panel: "border-[#d7e5ff] bg-[#f6f9ff]",
          count: "bg-[#eaf1ff] text-[#2854aa]",
        }
      : {
          panel: "border-[#e4e9f6] bg-[#fbfcff]",
          count: "bg-[#eef3ff] text-[#2f426f]",
        };

  return (
    <section className={`rounded-xl border p-3 ${accent.panel}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h5 className="text-sm font-black text-[#1b274b]">{title}</h5>
          <p className="mt-1 text-xs font-semibold text-[#6a789d]">{description}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${accent.count}`}>
          {rows.length} keputusan
        </span>
      </div>

      {rows.length > 0 ? (
        <div className="mt-3 space-y-3">
          {rows.map((item, index) => (
            <article
              key={`submission-decision-history-${tone}-${item?.tanggal_keputusan || index}`}
              className="rounded-lg border border-[#dfe6f5] bg-white p-3 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${getSubmissionStatusBadgeClass(
                        item?.status
                      )}`}
                    >
                      {formatLabel(item?.status)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-bold text-[#253a70]">
                    {item?.dosen?.nama || "Dosen"}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-[#6a789d]">
                    {formatDateTime(item?.tanggal_keputusan)}
                  </p>
                </div>
              </div>

              <div className="mt-3 rounded-lg border border-[#d7e0f2] bg-[#fbfcff] px-3 py-2">
                <p className="text-xs font-black uppercase tracking-wide text-[#52638e]">
                  {getSubmissionDecisionNoteLabel(item?.status)}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-[#243866]">{item?.keterangan || "-"}</p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-3 rounded-lg border border-dashed border-[#d5ddf0] bg-white/70 px-3 py-3 text-sm font-semibold text-[#68779f]">
          {emptyMessage}
        </div>
      )}
    </section>
  );
}

function showSuccessToast(message) {
  Swal.fire({
    toast: true,
    position: "top-end",
    icon: "success",
    title: message,
    showConfirmButton: false,
    timer: 2200,
    timerProgressBar: true,
  });
}

function showErrorToast(message) {
  Swal.fire({
    toast: true,
    position: "top-end",
    icon: "error",
    title: message,
    showConfirmButton: false,
    timer: 2600,
    timerProgressBar: true,
  });
}

function toDateInputValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function normalizeResearchClusterCode(value) {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw) return "";
  if (raw === "SIRKER") return "SIRKEL";
  if (raw.includes("SISTEM INFORMASI") || raw.includes("REKAYASA PERANGKAT LUNAK") || raw.includes("SIRKEL")) {
    return "SIRKEL";
  }
  if (raw.includes("SIBER")) return "SIBER";
  if (raw.includes("MULTIMEDIA") || raw.includes("VISI KOMPUTER") || raw.includes("MVK")) return "MVK";
  if (raw.includes("INFORMATIKA TEORI") || raw.includes("SISTEM CERDAS") || raw.includes("ITSC")) return "ITSC";
  return raw;
}

function normalizeTopikClusterCode(value) {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw) return null;
  if (raw === "SIRKER") return "SIRKEL";
  if (raw.includes("SISTEM INFORMASI") || raw.includes("REKAYASA PERANGKAT LUNAK") || raw.includes("SIRKEL")) {
    return "SIRKEL";
  }
  if (raw.includes("SIBER")) return "SIBER";
  if (raw.includes("MULTIMEDIA") || raw.includes("VISI KOMPUTER") || raw.includes("MVK")) return "MVK";
  if (raw.includes("INFORMATIKA TEORI") || raw.includes("SISTEM CERDAS") || raw.includes("ITSC")) return "ITSC";
  if (TOPIK_CLUSTER_LABEL_BY_CODE[raw]) return raw;
  return null;
}

function normalizeTopikClusterLabel(value) {
  const code = normalizeTopikClusterCode(value);
  if (!code) return null;
  return TOPIK_CLUSTER_LABEL_BY_CODE[code] || null;
}

function resolveTopikClusterFromKode(kode) {
  const normalizedKode = String(kode || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9]/g, "");
  if (!normalizedKode) return null;
  const prefix = normalizedKode.replace(/[0-9].*$/, "");
  const code = normalizeTopikClusterCode(prefix);
  if (!code) return null;
  return {
    code,
    label: TOPIK_CLUSTER_LABEL_BY_CODE[code] || null,
  };
}

function pickTopikUploadField(rawRow, candidates) {
  if (!rawRow || typeof rawRow !== "object") return "";
  for (const key of candidates) {
    const value = rawRow[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }
  return "";
}

const DOSEN_PENGAMPU_REVIEW_TABS = {
  pengabdian: {
    jalur: "pengabdian",
    tabId: "pengabdian-review",
    responsibilityType: "pengawas_pengabdian",
    endpointSlug: "pengabdian",
    menuLabel: "Review Pengabdian",
    title: "Review Pengabdian Masyarakat",
    gridTitle: "Grid Review Pengabdian Masyarakat",
    subtitle: "Review form jalur pengabdian masyarakat yang masuk ke dosen pengampu.",
    subjectLabel: "Program Pengabdian",
    summaryLabel: "Ringkasan Pengabdian",
    noteLabel: "Catatan Pengabdian",
    emptyMessage: "Belum ada review pengabdian masyarakat yang menunggu keputusan.",
    approveSuccess: "Pengajuan pengabdian masyarakat berhasil disetujui.",
    rejectSuccess: "Pengajuan pengabdian masyarakat berhasil ditolak.",
  },
  perintisan_bisnis: {
    jalur: "perintisan_bisnis",
    tabId: "perintisan-review",
    responsibilityType: "pengawas_perintisan_bisnis",
    endpointSlug: "perintisan-bisnis",
    menuLabel: "Review Perintisan Bisnis",
    title: "Review Perintisan Bisnis",
    gridTitle: "Grid Review Perintisan Bisnis",
    subtitle: "Review form jalur perintisan bisnis yang masuk ke dosen pengampu.",
    subjectLabel: "Rencana Bisnis",
    summaryLabel: "Ringkasan Perintisan Bisnis",
    noteLabel: "Catatan Perintisan Bisnis",
    emptyMessage: "Belum ada review perintisan bisnis yang menunggu keputusan.",
    approveSuccess: "Pengajuan perintisan bisnis berhasil disetujui.",
    rejectSuccess: "Pengajuan perintisan bisnis berhasil ditolak.",
  },
};

const DOSEN_PENGAMPU_REVIEW_CONFIG_BY_TAB = Object.values(DOSEN_PENGAMPU_REVIEW_TABS).reduce(
  (acc, item) => {
    acc[item.tabId] = item;
    return acc;
  },
  {}
);

function buildNavSections(isSekretaris, responsibilityItems = []) {
  if (!isSekretaris) {
    const specialItems = [];
    const hasKetuaClusterResponsibility = responsibilityItems.some((item) => item?.type === "ketua_klaster");
    const hasPengawasMagangResponsibility = responsibilityItems.some((item) => item?.type === "pengawas_magang");
    if (hasKetuaClusterResponsibility) {
      specialItems.push({ id: "ketua-cluster-review", label: "Review Ketua Cluster", icon: ShieldAlert });
    }
    if (hasPengawasMagangResponsibility) {
      specialItems.push({ id: "magang-review", label: "Review Magang", icon: ClipboardList });
    }
    for (const item of Object.values(DOSEN_PENGAMPU_REVIEW_TABS)) {
      const hasResponsibility = responsibilityItems.some((responsibility) => responsibility?.type === item.responsibilityType);
      if (hasResponsibility) {
        specialItems.push({ id: item.tabId, label: item.menuLabel, icon: ClipboardList });
      }
    }

    const sections = [
      {
        key: "umum",
        label: "Umum",
        items: [{ id: "dashboard", label: "Dashboard", icon: LayoutDashboard }],
      },
      {
        key: "mahasiswa",
        label: "Mahasiswa",
        items: [
          { id: "mahasiswa-bimbingan", label: "Mahasiswa Bimbingan", icon: GraduationCap },
          { id: "bimbingan-review", label: "Review Bimbingan", icon: MessageSquareText },
          { id: "submissions", label: "Pengajuan Mahasiswa", icon: ClipboardList },
          { id: "permohonan-extend", label: "Permohonan Extend", icon: ShieldAlert },
          { id: "pamit", label: "Pamit Mahasiswa", icon: Users },
        ],
      },
      {
        key: "dosen",
        label: "Dosen",
        items: [{ id: "topik", label: "Manajemen Topik", icon: BookOpenCheck }],
      },
      ...(specialItems.length > 0
        ? [
            {
              key: "tugas-khusus",
              label: "Tugas Khusus",
              items: specialItems,
            },
          ]
        : []),
      {
        key: "sidang",
        label: "Sidang",
        items: [
          { id: "dokumen-sidang-review", label: "Review Dokumen Sidang", icon: FileSpreadsheet },
          { id: "ketersediaan-sidang", label: "Ketersediaan Sidang", icon: CalendarRange },
        ],
      },
    ];
    return sections;
  }

  return [
    {
      key: "umum",
      label: "Umum",
      items: [{ id: "dashboard", label: "Dashboard", icon: LayoutDashboard }],
    },
    {
      key: "mahasiswa",
      label: "Mahasiswa",
      items: [
        { id: "master-mahasiswa", label: "Master Mahasiswa", icon: GraduationCap },
        { id: "mahasiswa-bimbingan", label: "Mahasiswa Bimbingan", icon: GraduationCap },
        { id: "bimbingan-review", label: "Review Bimbingan", icon: MessageSquareText },
        { id: "submissions", label: "Pengajuan Mahasiswa", icon: ClipboardList },
        { id: "permohonan-extend", label: "Permohonan Extend", icon: ShieldAlert },
        { id: "pamit", label: "Pamit Mahasiswa", icon: Users },
      ],
    },
    {
      key: "dosen",
      label: "Dosen",
      items: [
        { id: "master-dosen", label: "Master Dosen", icon: Users },
        { id: "topik", label: "Manajemen Topik", icon: BookOpenCheck },
        { id: "master-topik", label: "Master Topik", icon: BookOpenCheck },
      ],
    },
    {
      key: "penjaluran",
      label: "Penjaluran",
      items: [
        { id: "penjaluran", label: "Manajemen Penjaluran", icon: ListChecks },
        { id: "periode", label: "Manajemen Periode", icon: CalendarRange },
      ],
    },
    {
      key: "sidang",
      label: "Sidang",
      items: [{ id: "sidang-akhir", label: "Manajemen Sidang", icon: CalendarRange }],
    },
  ];
}

function buildTabHeaders(isSekretaris) {
  const baseHeaders = {
    dashboard: {
      icon: LayoutDashboard,
      title: "Dashboard Dosen",
      subtitle: "Ringkasan review pengajuan, status pamit, topik aktif, dan kuota bimbingan.",
    },
    "mahasiswa-bimbingan": {
      icon: GraduationCap,
      title: "Mahasiswa Bimbingan",
      subtitle: "Lihat histori penjaluran mahasiswa yang sedang Anda bimbing.",
    },
    "bimbingan-review": {
      icon: MessageSquareText,
      title: "Review Bimbingan",
      subtitle: "Terima, jadwalkan, dan review sesi bimbingan mahasiswa.",
    },
    "dokumen-sidang-review": {
      icon: FileSpreadsheet,
      title: "Review Dokumen Sidang",
      subtitle: "Review dokumen CEPT, transkrip, dan draft skripsi per mahasiswa.",
    },
    "ketersediaan-sidang": {
      icon: CalendarRange,
      title: "Ketersediaan Sidang",
      subtitle: "Isi ketersediaan hari/sesi sebagai penguji, tipe penilaian, dan kondisi fisik.",
    },
    submissions: {
      icon: ClipboardList,
      title: "Pengajuan Mahasiswa",
      subtitle: "Review pengajuan judul mahasiswa, lalu putuskan approve atau tolak.",
    },
    "ketua-cluster-review": {
      icon: ShieldAlert,
      title: "Review Ketua Cluster",
      subtitle: "Review pengajuan topik yang sudah disetujui dosen pembimbing dan menunggu keputusan ketua cluster.",
    },
    "magang-review": {
      icon: ClipboardList,
      title: "Review Magang",
      subtitle: "Review permintaan surat rekomendasi magang yang masuk ke dosen pengawas magang.",
    },
    "pengabdian-review": {
      icon: ClipboardList,
      title: DOSEN_PENGAMPU_REVIEW_TABS.pengabdian.title,
      subtitle: DOSEN_PENGAMPU_REVIEW_TABS.pengabdian.subtitle,
    },
    "perintisan-review": {
      icon: ClipboardList,
      title: DOSEN_PENGAMPU_REVIEW_TABS.perintisan_bisnis.title,
      subtitle: DOSEN_PENGAMPU_REVIEW_TABS.perintisan_bisnis.subtitle,
    },
    "permohonan-extend": {
      icon: ShieldAlert,
      title: "Permohonan Extend",
      subtitle: "Review permintaan izin melanjutkan skripsi mahasiswa semester ke-3.",
    },
    pamit: {
      icon: Users,
      title: "Pamit Mahasiswa",
      subtitle: "Kelola permintaan pamit mahasiswa yang masih aktif di bimbingan Anda.",
    },
    topik: {
      icon: BookOpenCheck,
      title: "Manajemen Topik",
      subtitle: "Tambah, upload, dan pantau topik yang Anda tawarkan ke mahasiswa.",
    },
    "master-topik": {
      icon: BookOpenCheck,
      title: "Master Topik",
      subtitle: "Monitoring seluruh topik yang tersedia di sistem.",
    },
  };

  if (!isSekretaris) {
    return baseHeaders;
  }

  return {
    ...baseHeaders,
    "master-mahasiswa": {
      icon: GraduationCap,
      title: "Master Data Mahasiswa",
      subtitle: "Lihat histori penjaluran mahasiswa secara lengkap dalam mode baca.",
    },
    "master-dosen": {
      icon: Users,
      title: "Master Dosen",
      subtitle: "Atur penanggung jawab penjaluran dan kuota bimbingan dosen.",
    },
    penjaluran: {
      icon: ListChecks,
      title: "Manajemen Penjaluran",
      subtitle: "Pantau pendaftaran jalur mahasiswa serta tindak lanjut approval penjaluran.",
    },
    periode: {
      icon: CalendarRange,
      title: "Manajemen Periode",
      subtitle: "Buka, lihat, dan kelola periode penjaluran sesuai jadwal akademik.",
    },
    "sidang-akhir": {
      icon: CalendarRange,
      title: "Manajemen Sidang",
      subtitle: "Set periode sidang, ruangan, jadwal, serta auto-assign penguji.",
    },
  };
}

function DosenWorkspacePage({ session, apiBaseUrl, onLogout, onSessionExpired, isSekretaris = false }) {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [masterDosenTab, setMasterDosenTab] = useState("penanggung-jawab");
  const [topikMode, setTopikMode] = useState("list");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isBimbinganReviewListMode, setIsBimbinganReviewListMode] = useState(true);

  const [submissions, setSubmissions] = useState([]);
  const [submissionQuery, setSubmissionQuery] = useState("");
  const [submissionPage, setSubmissionPage] = useState(1);
  const [submissionMode, setSubmissionMode] = useState("list");
  const [selectedSubmissionId, setSelectedSubmissionId] = useState(null);
  const [submissionDetail, setSubmissionDetail] = useState(null);
  const [loadingSubmissionDetail, setLoadingSubmissionDetail] = useState(false);
  const [submissionDecision, setSubmissionDecision] = useState("approve");
  const [submissionKeterangan, setSubmissionKeterangan] = useState("");
  const [submissionTopikFocusSlot, setSubmissionTopikFocusSlot] = useState("");
  const [submissionShowFinalSummary, setSubmissionShowFinalSummary] = useState(false);
  const [izinLanjutRows, setIzinLanjutRows] = useState([]);
  const [izinLanjutQuery, setIzinLanjutQuery] = useState("");
  const [izinLanjutPage, setIzinLanjutPage] = useState(1);
  const [pamitRows, setPamitRows] = useState([]);
  const [pamitPage, setPamitPage] = useState(1);
  const [magangReviewRows, setMagangReviewRows] = useState([]);
  const [magangReviewQuery, setMagangReviewQuery] = useState("");
  const [magangReviewPage, setMagangReviewPage] = useState(1);
  const [magangReviewActionId, setMagangReviewActionId] = useState(null);
  const [pengampuReviewRowsByJalur, setPengampuReviewRowsByJalur] = useState({
    pengabdian: [],
    perintisan_bisnis: [],
  });
  const [pengampuReviewQueryByJalur, setPengampuReviewQueryByJalur] = useState({
    pengabdian: "",
    perintisan_bisnis: "",
  });
  const [pengampuReviewPageByJalur, setPengampuReviewPageByJalur] = useState({
    pengabdian: 1,
    perintisan_bisnis: 1,
  });
  const [pengampuReviewActionId, setPengampuReviewActionId] = useState(null);
  const [kuotaData, setKuotaData] = useState(null);
  const penjaluranResponsibilityItems = useMemo(
    () => (Array.isArray(kuotaData?.tanggung_jawab_penjaluran?.items)
      ? kuotaData.tanggung_jawab_penjaluran.items
      : []),
    [kuotaData?.tanggung_jawab_penjaluran?.items]
  );
  const navSections = useMemo(
    () => buildNavSections(isSekretaris, penjaluranResponsibilityItems),
    [isSekretaris, penjaluranResponsibilityItems]
  );
  const tabHeaders = useMemo(() => buildTabHeaders(isSekretaris), [isSekretaris]);

  const [topikRows, setTopikRows] = useState([]);
  const [topikQuery, setTopikQuery] = useState("");
  const [topikPage, setTopikPage] = useState(1);
  const [masterTopikRows, setMasterTopikRows] = useState([]);
  const [masterTopikQuery, setMasterTopikQuery] = useState("");
  const [masterTopikPage, setMasterTopikPage] = useState(1);
  const [masterDosenKuotaOverview, setMasterDosenKuotaOverview] = useState({
    summary: null,
    dosens: [],
  });
  const [masterDosenKuotaQuery, setMasterDosenKuotaQuery] = useState("");
  const [masterDosenKuotaPage, setMasterDosenKuotaPage] = useState(1);
  const [masterDosenKuotaMode, setMasterDosenKuotaMode] = useState("all");
  const [masterDosenKuotaValue, setMasterDosenKuotaValue] = useState("5");
  const [masterDosenSelectedDosenIds, setMasterDosenSelectedDosenIds] = useState([]);
  const [savingMasterDosenKuota, setSavingMasterDosenKuota] = useState(false);

  const [topikForm, setTopikForm] = useState({
    kode: "",
    judul: "",
    deskripsi: "",
    keyword: "",
    cluster: "Sirkel",
  });
  const allowedTopikClusters = useMemo(() => {
    const klasterRows = Array.isArray(kuotaData?.dosen?.klasters) ? kuotaData.dosen.klasters : [];
    const labels = [];
    for (const item of klasterRows) {
      const normalized = normalizeTopikClusterLabel(item?.kode || item?.nama);
      if (normalized && !labels.includes(normalized)) {
        labels.push(normalized);
      }
    }
    return labels.length > 0 ? labels : TOPIK_CLUSTER_OPTIONS;
  }, [kuotaData?.dosen?.klasters]);
  const [topikUploadFile, setTopikUploadFile] = useState(null);
  const [uploadingTopik, setUploadingTopik] = useState(false);
  const [savingUploadedTopik, setSavingUploadedTopik] = useState(false);
  const [uploadTopikResult, setUploadTopikResult] = useState(null);
  const [topikUploadPreviewPage, setTopikUploadPreviewPage] = useState(1);
  const topikUploadPreviewRows = useMemo(() => {
    const successRows = Array.isArray(uploadTopikResult?.data?.detail_berhasil)
      ? uploadTopikResult.data.detail_berhasil
      : [];
    const failedRows = Array.isArray(uploadTopikResult?.data?.detail_gagal)
      ? uploadTopikResult.data.detail_gagal
      : [];

    const normalizedSuccess = successRows.map((item, index) => ({
      key: `ok-${item?.row ?? index}-${item?.kode ?? index}`,
      nomor: index + 1,
      baris: item?.row ?? "-",
      kode: String(item?.kode || "-"),
      cluster: String(item?.cluster || "-"),
      judul: String(item?.judul || "-"),
      keyword: String(item?.keyword || "-"),
      status: "valid",
      pesan_error: "-",
    }));

    const normalizedFailed = failedRows.map((item, index) => {
      const rawRow = item?.data || {};
      return {
        key: `err-${item?.row ?? index}-${index}`,
        nomor: normalizedSuccess.length + index + 1,
        baris: item?.row ?? "-",
        kode: pickTopikUploadField(rawRow, ["Kode Topik", "kode", "KODE"]) || "-",
        cluster: pickTopikUploadField(rawRow, ["Cluster", "cluster", "CLUSTER"]) || "-",
        judul: pickTopikUploadField(rawRow, ["Judul", "judul", "JUDUL"]) || "-",
        keyword: pickTopikUploadField(rawRow, ["Keyword", "keyword", "KEYWORD", "Kata Kunci", "kata_kunci"]) || "-",
        status: "error",
        pesan_error: String(item?.error || "Data tidak valid."),
      };
    });

    return [...normalizedSuccess, ...normalizedFailed];
  }, [uploadTopikResult]);
  const topikUploadPreviewRowsLimited = useMemo(
    () => topikUploadPreviewRows.slice(0, TOPIK_UPLOAD_PREVIEW_MAX_ROWS),
    [topikUploadPreviewRows]
  );
  const topikUploadPreviewTotalPages = useMemo(
    () => Math.max(1, Math.ceil(topikUploadPreviewRowsLimited.length / TOPIK_UPLOAD_PREVIEW_PAGE_SIZE)),
    [topikUploadPreviewRowsLimited.length]
  );
  const topikUploadPreviewRowsPaged = useMemo(() => {
    const start = (topikUploadPreviewPage - 1) * TOPIK_UPLOAD_PREVIEW_PAGE_SIZE;
    return topikUploadPreviewRowsLimited.slice(start, start + TOPIK_UPLOAD_PREVIEW_PAGE_SIZE);
  }, [topikUploadPreviewPage, topikUploadPreviewRowsLimited]);
  const topikUploadValidRows = useMemo(
    () => (Array.isArray(uploadTopikResult?.data?.detail_valid) ? uploadTopikResult.data.detail_valid : []),
    [uploadTopikResult]
  );
  const [savingTopik, setSavingTopik] = useState(false);

  const [pendaftaranRows, setPendaftaranRows] = useState([]);
  const [pendaftaranSearch, setPendaftaranSearch] = useState("");
  const [pendaftaranFilters, setPendaftaranFilters] = useState({
    ...PENDAFTARAN_FILTER_INITIAL,
  });
  const [pendaftaranFilterDraft, setPendaftaranFilterDraft] = useState({
    ...PENDAFTARAN_FILTER_INITIAL,
  });
  const [showPendaftaranFilterPanel, setShowPendaftaranFilterPanel] = useState(false);
  const [pendaftaranFilterPopupLayout, setPendaftaranFilterPopupLayout] = useState({
    top: 0,
    left: 0,
    width: 430,
    maxHeight: 520,
  });
  const [pendaftaranPage, setPendaftaranPage] = useState(1);
  const [mahasiswaMasterRows, setMahasiswaMasterRows] = useState([]);
  const [mahasiswaMasterQuery, setMahasiswaMasterQuery] = useState("");
  const [mahasiswaMasterFilters, setMahasiswaMasterFilters] = useState({
    ...MAHASISWA_MASTER_FILTER_INITIAL,
  });
  const [mahasiswaMasterFilterDraft, setMahasiswaMasterFilterDraft] = useState({
    ...MAHASISWA_MASTER_FILTER_INITIAL,
  });
  const [showMahasiswaMasterFilterPanel, setShowMahasiswaMasterFilterPanel] = useState(false);
  const [mahasiswaMasterFilterPopupLayout, setMahasiswaMasterFilterPopupLayout] = useState({
    top: 0,
    left: 0,
    width: 430,
    maxHeight: 520,
  });
  const [mahasiswaMasterPage, setMahasiswaMasterPage] = useState(1);
  const [periodeOverview, setPeriodeOverview] = useState({
    active_periode: null,
    draft_periode: null,
    periodes: [],
    dosen_options: [],
    ketua_klaster_options: [],
    master_penanggung_jawab: null,
    penanggung_jawab_lock: null,
  });
  const [periodeMasterForm, setPeriodeMasterForm] = useState({ ...PERIODE_MASTER_INITIAL });
  const [periodeMasterSearchQueryByField, setPeriodeMasterSearchQueryByField] = useState(
    buildPeriodeMasterSearchInitial
  );
  const [debouncedPeriodeMasterSearchQueryByField, setDebouncedPeriodeMasterSearchQueryByField] = useState(
    buildPeriodeMasterSearchInitial
  );
  const [activePeriodeMasterSearchField, setActivePeriodeMasterSearchField] = useState("");
  const [periodeMasterErrors, setPeriodeMasterErrors] = useState({});
  const [periodeMasterEditMode, setPeriodeMasterEditMode] = useState(false);
  const [savingPeriodeMaster, setSavingPeriodeMaster] = useState(false);
  const [periodeForm, setPeriodeForm] = useState({ ...PERIODE_FORM_INITIAL });
  const [periodeFormErrors, setPeriodeFormErrors] = useState({});
  const [periodeMode, setPeriodeMode] = useState("list");
  const [periodePage, setPeriodePage] = useState(1);
  const [editingPeriode, setEditingPeriode] = useState(null);
  const [periodeEditForm, setPeriodeEditForm] = useState({
    tanggal_mulai: "",
    tanggal_selesai: "",
  });
  const [periodeReadonlyRoles, setPeriodeReadonlyRoles] = useState({
    loading: false,
    rows: [],
    error: "",
  });
  const [ketuaKlasterOverview, setKetuaKlasterOverview] = useState({
    active_periode: null,
    periode_terpilih: null,
    periodes: [],
    rows: [],
  });
  const [ketuaKlasterPeriodeId, setKetuaKlasterPeriodeId] = useState("");
  const [ketuaKlasterQuery, setKetuaKlasterQuery] = useState("");
  const [ketuaKlasterPage, setKetuaKlasterPage] = useState(1);
  const [ketuaKlasterDraft, setKetuaKlasterDraft] = useState({});
  const [ketuaKlasterError, setKetuaKlasterError] = useState("");
  const [savingKetuaKlasterId, setSavingKetuaKlasterId] = useState(null);
  const [savingPeriode, setSavingPeriode] = useState(false);
  const [rowActionLoadingId, setRowActionLoadingId] = useState(null);
  const [exportingPendaftaran, setExportingPendaftaran] = useState(false);
  const [exportingMahasiswaMaster, setExportingMahasiswaMaster] = useState(false);
  const [countdownNowTs, setCountdownNowTs] = useState(() => Date.now());
  const [showSubmissionNotificationPanel, setShowSubmissionNotificationPanel] = useState(false);
  const [submissionNotificationSeenAt, setSubmissionNotificationSeenAt] = useState(0);

  const periodeMasterSource = useMemo(
    () => (periodeOverview?.master_penanggung_jawab && typeof periodeOverview.master_penanggung_jawab === "object"
      ? periodeOverview.master_penanggung_jawab
      : null),
    [periodeOverview?.master_penanggung_jawab]
  );

  const sessionExpiredRef = useRef(false);
  const pendaftaranFilterTriggerRef = useRef(null);
  const pendaftaranFilterPopupRef = useRef(null);
  const mahasiswaMasterFilterTriggerRef = useRef(null);
  const mahasiswaMasterFilterPopupRef = useRef(null);
  const submissionNotificationRef = useRef(null);
  const activeTabHeader = tabHeaders[activeTab] || tabHeaders.dashboard;
  const isSubmissionReviewTabActive = activeTab === "submissions" || activeTab === "ketua-cluster-review";
  const activePengampuReviewConfig = DOSEN_PENGAMPU_REVIEW_CONFIG_BY_TAB[activeTab] || null;
  const activePengampuReviewJalur = activePengampuReviewConfig?.jalur || "";
  const activePengampuReviewRows = useMemo(
    () => (activePengampuReviewJalur ? pengampuReviewRowsByJalur[activePengampuReviewJalur] || [] : []),
    [activePengampuReviewJalur, pengampuReviewRowsByJalur]
  );
  const activePengampuReviewQuery = activePengampuReviewJalur
    ? pengampuReviewQueryByJalur[activePengampuReviewJalur] || ""
    : "";
  const activePengampuReviewPage = activePengampuReviewJalur
    ? pengampuReviewPageByJalur[activePengampuReviewJalur] || 1
    : 1;
  const availableTabIds = useMemo(
    () => navSections.flatMap((section) => section.items.map((item) => item.id)),
    [navSections]
  );
  const countdownNowDate = useMemo(() => new Date(countdownNowTs), [countdownNowTs]);
  const submissionNotificationStorageKey = useMemo(() => {
    const baseId = session?.user?.id || session?.user?.username || "dosen";
    const role = isSekretaris ? "sekretaris_prodi" : "dosen";
    return `simps_notif_submission_seen_at_${role}_${baseId}`;
  }, [isSekretaris, session?.user?.id, session?.user?.username]);
  const penanggungJawabLock = periodeOverview?.penanggung_jawab_lock || null;
  const isPeriodeMasterConfigured = Boolean(periodeMasterSource?.id);
  const isPeriodeMasterLocked = Boolean(penanggungJawabLock?.locked);
  const isPeriodeMasterFormEditable =
    !isPeriodeMasterLocked && (!isPeriodeMasterConfigured || periodeMasterEditMode);
  const periodeMasterLockMessage =
    penanggungJawabLock?.message ||
    "Penanggung jawab penjaluran belum dapat diubah saat ada periode atau pengajuan aktif.";
  const isPeriodeReadonly = editingPeriode ? !canEditPeriodeRow(editingPeriode) : true;
  const useGridViewportLayout =
    !loading &&
    ((activeTab === "master-mahasiswa" || activeTab === "mahasiswa-bimbingan") ||
      (activeTab === "bimbingan-review" && isBimbinganReviewListMode) ||
      activeTab === "dokumen-sidang-review" ||
      activeTab === "ketersediaan-sidang" ||
      (isSubmissionReviewTabActive && submissionMode === "list") ||
      activeTab === "magang-review" ||
      Boolean(activePengampuReviewConfig) ||
      activeTab === "permohonan-extend" ||
      activeTab === "pamit" ||
      (isSekretaris && activeTab === "master-dosen") ||
      (isSekretaris && activeTab === "master-topik") ||
      (activeTab === "topik" && topikMode === "list") ||
      (isSekretaris && activeTab === "penjaluran") ||
      (isSekretaris &&
        activeTab === "periode" &&
        periodeMode === "list"));

  useEffect(() => {
    if (activeTab !== "bimbingan-review") {
      setIsBimbinganReviewListMode(true);
    }
  }, [activeTab]);

  useEffect(() => {
    if (!availableTabIds.includes(activeTab)) {
      setActiveTab("dashboard");
    }
  }, [activeTab, availableTabIds]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCountdownNowTs(Date.now());
    }, 1000);
    return () => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(submissionNotificationStorageKey);
    const parsed = Number(raw || 0);
    setSubmissionNotificationSeenAt(Number.isFinite(parsed) && parsed > 0 ? parsed : 0);
  }, [submissionNotificationStorageKey]);

  useEffect(() => {
    if (!showSubmissionNotificationPanel) return undefined;
    const handleOutsideClick = (event) => {
      if (submissionNotificationRef.current?.contains(event.target)) return;
      setShowSubmissionNotificationPanel(false);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [showSubmissionNotificationPanel]);

  useEffect(() => {
    if (!showMahasiswaMasterFilterPanel) return undefined;
    const handleMouseDown = (event) => {
      const withinTrigger = mahasiswaMasterFilterTriggerRef.current?.contains(event.target);
      const withinPopup = mahasiswaMasterFilterPopupRef.current?.contains(event.target);
      if (withinTrigger || withinPopup) return;
      setShowMahasiswaMasterFilterPanel(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setShowMahasiswaMasterFilterPanel(false);
      }
    };
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showMahasiswaMasterFilterPanel]);

  useEffect(() => {
    if (!(activeTab === "master-mahasiswa" || activeTab === "mahasiswa-bimbingan")) {
      setShowMahasiswaMasterFilterPanel(false);
    }
  }, [activeTab]);

  const updateMahasiswaMasterFilterPopupLayout = useCallback(() => {
    const triggerElement = mahasiswaMasterFilterTriggerRef.current;
    if (!triggerElement || typeof window === "undefined") return;

    const triggerRect = triggerElement.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const margin = 12;
    const gap = 8;
    const preferredWidth = 430;
    const maxAllowedWidth = Math.max(250, viewportWidth - margin * 2);
    const width = Math.min(preferredWidth, maxAllowedWidth);

    let left = triggerRect.right - width;
    if (left < margin) left = margin;
    if (left + width > viewportWidth - margin) {
      left = viewportWidth - margin - width;
    }

    const availableBelow = viewportHeight - triggerRect.bottom - gap - margin;
    const availableAbove = triggerRect.top - gap - margin;
    const openUp = availableBelow < 360 && availableAbove > availableBelow;
    const maxHeight = Math.max(
      280,
      Math.min(620, openUp ? Math.max(280, availableAbove) : Math.max(280, availableBelow))
    );

    let top = openUp ? triggerRect.top - gap - maxHeight : triggerRect.bottom + gap;
    if (top < margin) top = margin;
    if (top + maxHeight > viewportHeight - margin) {
      top = viewportHeight - margin - maxHeight;
    }

    setMahasiswaMasterFilterPopupLayout({
      top,
      left,
      width,
      maxHeight,
    });
  }, []);

  useEffect(() => {
    if (!showMahasiswaMasterFilterPanel) return undefined;
    updateMahasiswaMasterFilterPopupLayout();
    const handleWindowReposition = () => {
      updateMahasiswaMasterFilterPopupLayout();
    };
    window.addEventListener("resize", handleWindowReposition);
    window.addEventListener("scroll", handleWindowReposition, true);
    return () => {
      window.removeEventListener("resize", handleWindowReposition);
      window.removeEventListener("scroll", handleWindowReposition, true);
    };
  }, [showMahasiswaMasterFilterPanel, updateMahasiswaMasterFilterPopupLayout]);

  const updatePendaftaranFilterPopupLayout = useCallback(() => {
    const triggerElement = pendaftaranFilterTriggerRef.current;
    if (!triggerElement || typeof window === "undefined") return;

    const triggerRect = triggerElement.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const margin = 12;
    const gap = 8;
    const preferredWidth = 430;
    const maxAllowedWidth = Math.max(250, viewportWidth - margin * 2);
    const width = Math.min(preferredWidth, maxAllowedWidth);

    let left = triggerRect.right - width;
    if (left < margin) left = margin;
    if (left + width > viewportWidth - margin) {
      left = viewportWidth - margin - width;
    }

    const availableBelow = viewportHeight - triggerRect.bottom - gap - margin;
    const availableAbove = triggerRect.top - gap - margin;
    const openUp = availableBelow < 360 && availableAbove > availableBelow;
    const maxHeight = Math.max(
      280,
      Math.min(620, openUp ? Math.max(280, availableAbove) : Math.max(280, availableBelow))
    );

    let top = openUp ? triggerRect.top - gap - maxHeight : triggerRect.bottom + gap;
    if (top < margin) top = margin;
    if (top + maxHeight > viewportHeight - margin) {
      top = viewportHeight - margin - maxHeight;
    }

    setPendaftaranFilterPopupLayout({
      top,
      left,
      width,
      maxHeight,
    });
  }, []);

  useEffect(() => {
    if (!showPendaftaranFilterPanel) return undefined;
    const handleMouseDown = (event) => {
      const withinTrigger = pendaftaranFilterTriggerRef.current?.contains(event.target);
      const withinPopup = pendaftaranFilterPopupRef.current?.contains(event.target);
      if (withinTrigger || withinPopup) return;
      setShowPendaftaranFilterPanel(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setShowPendaftaranFilterPanel(false);
      }
    };
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showPendaftaranFilterPanel]);

  useEffect(() => {
    if (!(isSekretaris && activeTab === "penjaluran")) {
      setShowPendaftaranFilterPanel(false);
    }
  }, [activeTab, isSekretaris]);

  useEffect(() => {
    if (!showPendaftaranFilterPanel) return undefined;
    updatePendaftaranFilterPopupLayout();
    const handleWindowReposition = () => {
      updatePendaftaranFilterPopupLayout();
    };
    window.addEventListener("resize", handleWindowReposition);
    window.addEventListener("scroll", handleWindowReposition, true);
    return () => {
      window.removeEventListener("resize", handleWindowReposition);
      window.removeEventListener("scroll", handleWindowReposition, true);
    };
  }, [showPendaftaranFilterPanel, updatePendaftaranFilterPopupLayout]);

  useEffect(() => {
    if (!(isSekretaris && activeTab === "master-dosen")) {
      setMasterDosenSelectedDosenIds([]);
      setMasterDosenKuotaMode("all");
    }
  }, [activeTab, isSekretaris]);

  useEffect(() => {
    setTopikUploadPreviewPage(1);
  }, [uploadTopikResult]);

  useEffect(() => {
    if (topikUploadPreviewPage > topikUploadPreviewTotalPages) {
      setTopikUploadPreviewPage(topikUploadPreviewTotalPages);
    }
  }, [topikUploadPreviewPage, topikUploadPreviewTotalPages]);

  useEffect(() => {
    setTopikForm((prev) => {
      if (allowedTopikClusters.includes(prev.cluster)) {
        return prev;
      }
      return {
        ...prev,
        cluster: allowedTopikClusters[0] || TOPIK_CLUSTER_OPTIONS[0],
      };
    });
  }, [allowedTopikClusters]);

  useEffect(() => {
    const nextMasterForm = buildPeriodeMasterFormFromSource(periodeMasterSource);
    const nextSearchQuery = buildPeriodeMasterSearchFromSource(periodeMasterSource);
    setPeriodeMasterForm(nextMasterForm);
    setPeriodeMasterSearchQueryByField(nextSearchQuery);
    setDebouncedPeriodeMasterSearchQueryByField(nextSearchQuery);
    setActivePeriodeMasterSearchField("");
    setPeriodeMasterErrors({});
    setPeriodeMasterEditMode(false);
  }, [periodeMasterSource]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedPeriodeMasterSearchQueryByField(periodeMasterSearchQueryByField);
    }, 280);
    return () => window.clearTimeout(timer);
  }, [periodeMasterSearchQueryByField]);

  const fetchWithAuth = useCallback(
    async (path, options = {}) => {
      const response = await fetch(`${apiBaseUrl}${path}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${session.token}`,
          "Content-Type": "application/json",
          ...(options.headers || {}),
        },
      });

      let data = null;
      try {
        data = await response.json();
      } catch (parseError) {
        data = null;
      }

      const message = String(data?.message || "");
      const lowerMessage = message.toLowerCase();
      const isTokenError =
        lowerMessage.includes("token tidak valid") ||
        lowerMessage.includes("token tidak ditemukan") ||
        lowerMessage.includes("kadaluarsa");

      if (response.status === 401 || (response.status === 403 && isTokenError)) {
        if (!sessionExpiredRef.current) {
          sessionExpiredRef.current = true;
          onSessionExpired?.();
        }
        throw new Error("__SESSION_EXPIRED__");
      }

      if (!response.ok || !data?.success) {
        const errorObj = new Error(data?.message || `Gagal memuat ${path}`);
        if (data?.detail && typeof data.detail === "object") {
          errorObj.detail = data.detail;
        }
        throw errorObj;
      }

      return data.data;
    },
    [apiBaseUrl, onSessionExpired, session.token]
  );

  const loadAllData = useCallback(async () => {
    sessionExpiredRef.current = false;
    setLoading(true);
    setError("");

    let resolvedKuota = null;
    const issues = [];

    try {
      resolvedKuota = await fetchWithAuth("/api/dosen/kuota");
      setKuotaData(resolvedKuota || null);
    } catch (kuotaError) {
      resolvedKuota = null;
      setKuotaData(null);
      issues.push(kuotaError.message || "Gagal memuat data kuota dosen.");
    }

    if (sessionExpiredRef.current) return;

    const dosenId = resolvedKuota?.dosen?.id;
    const mahasiswaMasterPath = isSekretaris
      ? "/api/sekretaris/mahasiswa/master"
      : "/api/dosen/mahasiswa-master";
    const promises = [
      fetchWithAuth("/api/dosen/submissions"),
      fetchWithAuth("/api/dosen/permohonan-extend"),
      fetchWithAuth("/api/dosen/pamit-mahasiswa"),
      dosenId ? fetchWithAuth(`/api/topics?dosen_id=${dosenId}`) : Promise.resolve([]),
      fetchWithAuth(mahasiswaMasterPath),
      !isSekretaris ? fetchWithAuth("/api/dosen/non-penelitian/magang/reviews") : Promise.resolve([]),
      !isSekretaris ? fetchWithAuth("/api/dosen/non-penelitian/pengabdian/reviews") : Promise.resolve([]),
      !isSekretaris ? fetchWithAuth("/api/dosen/non-penelitian/perintisan-bisnis/reviews") : Promise.resolve([]),
    ];

    if (isSekretaris) {
      promises.push(fetchWithAuth("/api/sekretaris/pendaftaran"));
      promises.push(fetchWithAuth("/api/sekretaris/periode"));
      promises.push(fetchWithAuth("/api/sekretaris/master-dosen/kuota-overview"));
      promises.push(fetchWithAuth("/api/topics"));
    }

    const results = await Promise.allSettled(promises);
    if (sessionExpiredRef.current) return;

    const [
      submissionsResult,
      izinLanjutResult,
      pamitResult,
      topikResult,
      mahasiswaMasterResult,
      magangReviewResult,
      pengabdianReviewResult,
      perintisanReviewResult,
      pendaftaranResult,
      periodeResult,
      masterDosenKuotaResult,
      masterTopikResult,
    ] = results;

    if (submissionsResult?.status === "fulfilled") {
      setSubmissions(Array.isArray(submissionsResult.value) ? submissionsResult.value : []);
    } else {
      setSubmissions([]);
      issues.push(submissionsResult?.reason?.message || "Gagal memuat pengajuan mahasiswa.");
    }

    if (izinLanjutResult?.status === "fulfilled") {
      setIzinLanjutRows(Array.isArray(izinLanjutResult.value) ? izinLanjutResult.value : []);
    } else {
      setIzinLanjutRows([]);
      issues.push(izinLanjutResult?.reason?.message || "Gagal memuat data permohonan extend semester 3.");
    }

    if (pamitResult?.status === "fulfilled") {
      setPamitRows(Array.isArray(pamitResult.value) ? pamitResult.value : []);
    } else {
      setPamitRows([]);
      issues.push(pamitResult?.reason?.message || "Gagal memuat data pamit mahasiswa.");
    }

    if (topikResult?.status === "fulfilled") {
      setTopikRows(Array.isArray(topikResult.value) ? topikResult.value : []);
    } else {
      setTopikRows([]);
      issues.push(topikResult?.reason?.message || "Gagal memuat data topik.");
    }

    if (mahasiswaMasterResult?.status === "fulfilled") {
      setMahasiswaMasterRows(Array.isArray(mahasiswaMasterResult.value) ? mahasiswaMasterResult.value : []);
    } else {
      setMahasiswaMasterRows([]);
      issues.push(mahasiswaMasterResult?.reason?.message || "Gagal memuat master data mahasiswa.");
    }

    if (magangReviewResult?.status === "fulfilled") {
      setMagangReviewRows(Array.isArray(magangReviewResult.value) ? magangReviewResult.value : []);
    } else {
      setMagangReviewRows([]);
      if (!isSekretaris) {
        issues.push(magangReviewResult?.reason?.message || "Gagal memuat review magang.");
      }
    }

    const nextPengampuRows = {
      pengabdian: [],
      perintisan_bisnis: [],
    };
    if (pengabdianReviewResult?.status === "fulfilled") {
      nextPengampuRows.pengabdian = Array.isArray(pengabdianReviewResult.value)
        ? pengabdianReviewResult.value
        : [];
    } else if (!isSekretaris) {
      issues.push(pengabdianReviewResult?.reason?.message || "Gagal memuat review pengabdian masyarakat.");
    }
    if (perintisanReviewResult?.status === "fulfilled") {
      nextPengampuRows.perintisan_bisnis = Array.isArray(perintisanReviewResult.value)
        ? perintisanReviewResult.value
        : [];
    } else if (!isSekretaris) {
      issues.push(perintisanReviewResult?.reason?.message || "Gagal memuat review perintisan bisnis.");
    }
    setPengampuReviewRowsByJalur(nextPengampuRows);

    if (isSekretaris) {
      if (pendaftaranResult?.status === "fulfilled") {
        setPendaftaranRows(Array.isArray(pendaftaranResult.value) ? pendaftaranResult.value : []);
      } else {
        setPendaftaranRows([]);
        issues.push(pendaftaranResult?.reason?.message || "Gagal memuat data penjaluran.");
      }

      if (periodeResult?.status === "fulfilled") {
        const periodPayload = periodeResult.value || {};
        setPeriodeOverview({
          active_periode: periodPayload.active_periode || null,
          draft_periode: periodPayload.draft_periode || null,
          periodes: Array.isArray(periodPayload.periodes) ? periodPayload.periodes : [],
          dosen_options: Array.isArray(periodPayload.dosen_options) ? periodPayload.dosen_options : [],
          ketua_klaster_options: Array.isArray(periodPayload.ketua_klaster_options)
            ? periodPayload.ketua_klaster_options
            : [],
          master_penanggung_jawab: periodPayload.master_penanggung_jawab || null,
          penanggung_jawab_lock: periodPayload.penanggung_jawab_lock || null,
        });
      } else {
        setPeriodeOverview({
          active_periode: null,
          draft_periode: null,
          periodes: [],
          dosen_options: [],
          ketua_klaster_options: [],
          master_penanggung_jawab: null,
          penanggung_jawab_lock: null,
        });
        issues.push(periodeResult?.reason?.message || "Gagal memuat data periode.");
      }

      if (masterTopikResult?.status === "fulfilled") {
        setMasterTopikRows(Array.isArray(masterTopikResult.value) ? masterTopikResult.value : []);
      } else {
        setMasterTopikRows([]);
        issues.push(masterTopikResult?.reason?.message || "Gagal memuat master topik.");
      }

      if (masterDosenKuotaResult?.status === "fulfilled") {
        const payload = masterDosenKuotaResult.value || {};
        setMasterDosenKuotaOverview({
          summary: payload.summary || null,
          dosens: Array.isArray(payload.dosens) ? payload.dosens : [],
        });
      } else {
        setMasterDosenKuotaOverview({ summary: null, dosens: [] });
        issues.push(masterDosenKuotaResult?.reason?.message || "Gagal memuat data kuota dosen.");
      }
      setKetuaKlasterOverview({
        active_periode: null,
        periode_terpilih: null,
        periodes: [],
        rows: [],
      });
      setKetuaKlasterPeriodeId("");
    } else {
      setMasterTopikRows([]);
      setPeriodeOverview({
        active_periode: null,
        draft_periode: null,
        periodes: [],
        dosen_options: [],
        ketua_klaster_options: [],
        master_penanggung_jawab: null,
        penanggung_jawab_lock: null,
      });
      setMasterDosenKuotaOverview({ summary: null, dosens: [] });
      setKetuaKlasterOverview({
        active_periode: null,
        periode_terpilih: null,
        periodes: [],
        rows: [],
      });
      setKetuaKlasterPeriodeId("");
    }

    setError(issues.join(" "));
    setLoading(false);
  }, [fetchWithAuth, isSekretaris]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  useEffect(() => {
    const pollIntervalMs = 30000;
    const timer = window.setInterval(async () => {
      try {
        const latestSubmissions = await fetchWithAuth("/api/dosen/submissions");
        if (Array.isArray(latestSubmissions)) {
          setSubmissions(latestSubmissions);
        }
      } catch (pollError) {
        if (pollError?.message !== "__SESSION_EXPIRED__") {
          // silent polling error
        }
      }
    }, pollIntervalMs);

    return () => {
      window.clearInterval(timer);
    };
  }, [fetchWithAuth]);

  const summary = useMemo(() => {
    const regularSubmissions = submissions.filter((item) => !isKetuaClusterSubmissionReview(item));
    const pendingSubmissions = regularSubmissions.filter((item) => item.status === "pending").length;
    const pendingPamit = pamitRows.filter((item) => item.status_dospem === "pending").length;
    return {
      totalSubmissions: regularSubmissions.length,
      pendingSubmissions,
      pendingPamit,
      topikAktif: topikRows.length,
      kuotaTotal: kuotaData?.kuota?.total ?? 0,
      kuotaTerpakai: kuotaData?.kuota?.terpakai ?? 0,
      kuotaSisa: kuotaData?.kuota?.sisa ?? 0,
    };
  }, [submissions, pamitRows, topikRows, kuotaData]);

  const contextualSubmissions = useMemo(() => {
    if (activeTab === "ketua-cluster-review") {
      return submissions.filter((row) => isKetuaClusterSubmissionReview(row));
    }
    if (activeTab === "submissions") {
      return submissions.filter((row) => !isKetuaClusterSubmissionReview(row));
    }
    return submissions;
  }, [activeTab, submissions]);

  const filteredSubmissions = useMemo(() => {
    const keyword = submissionQuery.trim().toLowerCase();
    if (!keyword) return contextualSubmissions;

    return contextualSubmissions.filter((row) => {
      const topikDetailText = Array.isArray(row.topik_dipilih_detail)
        ? row.topik_dipilih_detail.map((item) => item?.judul).filter(Boolean).join(" ")
        : "";
      const topikText = Array.isArray(row.topik_dipilih)
        ? row.topik_dipilih.join(" ")
        : row.judul_mandiri || "";
      const topikCount = getSubmissionTopikCount(row);
      const sameDosenText = hasSameDosenTopikBadge(row) ? "dosen sama" : "";
      const haystack = [
        row.id,
        row.mahasiswa?.nim,
        row.mahasiswa?.nama,
        row.mahasiswa?.angkatan,
        row.jenis_jalur,
        row.tipe_pengajuan,
        row.status,
        topikText,
        topikDetailText,
        row.topik_fokus?.judul,
        row.topik_fokus?.kode,
        row.review_deadline_at,
        topikCount > 0 ? `${topikCount} topik` : "",
        sameDosenText,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(keyword);
    });
  }, [contextualSubmissions, submissionQuery]);

  const filteredIzinLanjutRows = useMemo(() => {
    const keyword = izinLanjutQuery.trim().toLowerCase();
    if (!keyword) return izinLanjutRows;

    return izinLanjutRows.filter((row) => {
      const haystack = [
        row.id,
        row.mahasiswa?.nim,
        row.mahasiswa?.nama,
        row.mahasiswa?.angkatan,
        row.semester_penjaluran_ke,
        row.status,
        row.periode?.label_periode,
        row.alasan_pengajuan,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(keyword);
    });
  }, [izinLanjutRows, izinLanjutQuery]);

  const filteredMagangReviewRows = useMemo(() => {
    const keyword = magangReviewQuery.trim().toLowerCase();
    if (!keyword) return magangReviewRows;

    return magangReviewRows.filter((row) => {
      const payload = getMagangPayload(row);
      const payloadText = Object.entries(payload)
        .filter(([, value]) => value !== null && value !== undefined && typeof value !== "object")
        .map(([, value]) => String(value))
        .join(" ");
      const haystack = [
        row.id,
        row.jalur,
        row.form_lanjutan_status,
        row.workflow_status,
        row.workflow_status_label,
        row.mahasiswa?.nim,
        row.mahasiswa?.nama,
        row.mahasiswa?.email,
        row.mahasiswa?.angkatan,
        row.periode?.label_periode,
        getMagangCompanyName(row),
        getMagangCompanyTypeLabel(row),
        pickMagangPayloadText(row, ["proposed_position", "proposed_position_other"]),
        pickMagangPayloadText(row, ["company_sector", "company_sector_other"]),
        payloadText,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(keyword);
    });
  }, [magangReviewRows, magangReviewQuery]);

  const filteredPengampuReviewRows = useMemo(() => {
    const keyword = activePengampuReviewQuery.trim().toLowerCase();
    if (!keyword) return activePengampuReviewRows;

    return activePengampuReviewRows.filter((row) => {
      const haystack = [
        row.id,
        row.jalur,
        row.form_lanjutan_status,
        row.workflow_status,
        row.workflow_status_label,
        row.mahasiswa?.nim,
        row.mahasiswa?.nama,
        row.mahasiswa?.email,
        row.mahasiswa?.angkatan,
        row.periode?.label_periode,
        getPengampuReviewSummary(row),
        getPengampuReviewNote(row),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(keyword);
    });
  }, [activePengampuReviewRows, activePengampuReviewQuery]);

  const filteredTopikRows = useMemo(() => {
    const keyword = topikQuery.trim().toLowerCase();
    if (!keyword) return topikRows;

    return topikRows.filter((row) => {
      const haystack = [row.kode, row.judul, row.keyword, row.cluster, row.status]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(keyword);
    });
  }, [topikRows, topikQuery]);

  const totalTopikPages = useMemo(
    () => Math.max(1, Math.ceil(filteredTopikRows.length / TOPIK_PAGE_SIZE)),
    [filteredTopikRows.length]
  );

  const pagedTopikRows = useMemo(() => {
    const start = (topikPage - 1) * TOPIK_PAGE_SIZE;
    return filteredTopikRows.slice(start, start + TOPIK_PAGE_SIZE);
  }, [filteredTopikRows, topikPage]);

  useEffect(() => {
    setTopikPage(1);
  }, [topikQuery]);

  useEffect(() => {
    if (topikPage > totalTopikPages) {
      setTopikPage(totalTopikPages);
    }
  }, [topikPage, totalTopikPages]);

  const filteredMasterTopikRows = useMemo(() => {
    const keyword = masterTopikQuery.trim().toLowerCase();
    if (!keyword) return masterTopikRows;

    return masterTopikRows.filter((row) => {
      const haystack = [
        row.kode,
        row.judul,
        row.keyword,
        row.cluster,
        row.status,
        row.dosen?.nama,
        row.dosen_nama,
        row.nama_dosen,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(keyword);
    });
  }, [masterTopikRows, masterTopikQuery]);

  const totalMasterTopikPages = useMemo(
    () => Math.max(1, Math.ceil(filteredMasterTopikRows.length / MASTER_TOPIK_PAGE_SIZE)),
    [filteredMasterTopikRows.length]
  );

  const pagedMasterTopikRows = useMemo(() => {
    const start = (masterTopikPage - 1) * MASTER_TOPIK_PAGE_SIZE;
    return filteredMasterTopikRows.slice(start, start + MASTER_TOPIK_PAGE_SIZE);
  }, [filteredMasterTopikRows, masterTopikPage]);

  useEffect(() => {
    setMasterTopikPage(1);
  }, [masterTopikQuery]);

  useEffect(() => {
    if (masterTopikPage > totalMasterTopikPages) {
      setMasterTopikPage(totalMasterTopikPages);
    }
  }, [masterTopikPage, totalMasterTopikPages]);

  const pendaftaranFilterOptions = useMemo(() => {
    const angkatanSet = new Set();
    const tahunAkademikSet = new Set();
    const semesterAkademikSet = new Set();
    const penjaluranSet = new Set();
    const tipePendaftaranSet = new Set();

    for (const row of pendaftaranRows) {
      if (row?.mahasiswa?.angkatan) {
        angkatanSet.add(String(row.mahasiswa.angkatan).trim());
      }

      const tahunAkademik = String(row?.periode?.tahun_akademik || "").trim();
      if (tahunAkademik) {
        tahunAkademikSet.add(tahunAkademik);
      }

      const semesterAkademik = String(row?.periode?.semester || "").trim();
      if (semesterAkademik) {
        semesterAkademikSet.add(semesterAkademik);
      }

      const namaPenjaluran = row?.jenis_jalur_diambil || row?.penjaluran_baru || row?.penjaluran_sebelumnya;
      if (namaPenjaluran) {
        penjaluranSet.add(String(namaPenjaluran).trim());
      }

      if (row?.jalur) {
        tipePendaftaranSet.add(String(row.jalur).trim());
      }
    }

    return {
      angkatan: Array.from(angkatanSet).sort((a, b) => Number(b) - Number(a)),
      tahun_akademik: Array.from(tahunAkademikSet).sort((a, b) => b.localeCompare(a, "id")),
      semester_akademik: Array.from(semesterAkademikSet).sort((a, b) => a.localeCompare(b, "id")),
      penjaluran: Array.from(penjaluranSet).sort((a, b) => a.localeCompare(b, "id")),
      tipe_pendaftaran: Array.from(tipePendaftaranSet).sort((a, b) => a.localeCompare(b, "id")),
    };
  }, [pendaftaranRows]);

  const filteredPendaftaranRows = useMemo(() => {
    if (!isSekretaris) return [];

    const selectedAngkatan = String(pendaftaranFilters.angkatan || "").trim();
    const selectedTahunAkademik = String(pendaftaranFilters.tahun_akademik || "").trim();
    const selectedSemesterAkademik = String(pendaftaranFilters.semester_akademik || "").trim().toLowerCase();
    const selectedPenjaluran = String(pendaftaranFilters.penjaluran || "").trim().toLowerCase();
    const selectedTipePendaftaran = String(pendaftaranFilters.tipe_pendaftaran || "").trim().toLowerCase();
    const keyword = pendaftaranSearch.trim().toLowerCase();

    return pendaftaranRows.filter((row) => {
      if (selectedAngkatan && String(row?.mahasiswa?.angkatan || "").trim() !== selectedAngkatan) {
        return false;
      }

      if (selectedTahunAkademik && String(row?.periode?.tahun_akademik || "").trim() !== selectedTahunAkademik) {
        return false;
      }

      if (
        selectedSemesterAkademik &&
        String(row?.periode?.semester || "").trim().toLowerCase() !== selectedSemesterAkademik
      ) {
        return false;
      }

      const namaPenjaluran = row?.jenis_jalur_diambil || row?.penjaluran_baru || row?.penjaluran_sebelumnya;
      if (selectedPenjaluran && String(namaPenjaluran || "").trim().toLowerCase() !== selectedPenjaluran) {
        return false;
      }

      if (selectedTipePendaftaran && String(row?.jalur || "").trim().toLowerCase() !== selectedTipePendaftaran) {
        return false;
      }

      if (!keyword) return true;

      const haystack = [
        row.mahasiswa?.nim,
        row.mahasiswa?.nama,
        row.mahasiswa?.email,
        row.mahasiswa?.angkatan,
        row.semester_mahasiswa ? `semester ${row.semester_mahasiswa}` : null,
        row.jalur,
        row.jenis_jalur_diambil,
        row.penjaluran_baru,
        row.penjaluran_sebelumnya,
        row.status,
        row.periode?.label_periode,
        row.periode?.tahun_akademik,
        row.periode?.semester,
        row.dosen_pembimbing_akademik?.nama,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(keyword);
    });
  }, [isSekretaris, pendaftaranFilters, pendaftaranRows, pendaftaranSearch]);

  const pendaftaranActiveFilterChips = useMemo(() => {
    const chips = [];
    const angkatan = String(pendaftaranFilters.angkatan || "").trim();
    const tahunAkademik = String(pendaftaranFilters.tahun_akademik || "").trim();
    const semesterAkademik = String(pendaftaranFilters.semester_akademik || "").trim();
    const penjaluran = String(pendaftaranFilters.penjaluran || "").trim();
    const tipePendaftaran = String(pendaftaranFilters.tipe_pendaftaran || "").trim();

    if (angkatan) {
      chips.push({ key: "angkatan", label: `Angkatan: ${angkatan}` });
    }
    if (tahunAkademik) {
      chips.push({ key: "tahun_akademik", label: `Tahun Akademik: ${tahunAkademik}` });
    }
    if (semesterAkademik) {
      chips.push({ key: "semester_akademik", label: `Semester: ${formatLabel(semesterAkademik)}` });
    }
    if (penjaluran) {
      chips.push({ key: "penjaluran", label: `Penjaluran: ${formatLabel(penjaluran)}` });
    }
    if (tipePendaftaran) {
      chips.push({ key: "tipe_pendaftaran", label: `Tipe: ${formatLabel(tipePendaftaran)}` });
    }

    return chips;
  }, [pendaftaranFilters]);
  const hasPendaftaranActiveFilters = useMemo(() => {
    return pendaftaranActiveFilterChips.length > 0;
  }, [pendaftaranActiveFilterChips]);
  const hasPendaftaranDraftFilters = useMemo(() => {
    return Object.values(pendaftaranFilterDraft).some((value) => String(value || "").trim().length > 0);
  }, [pendaftaranFilterDraft]);
  const isPendaftaranFilterDraftDirty = useMemo(() => {
    return Object.keys(PENDAFTARAN_FILTER_INITIAL).some(
      (key) =>
        String(pendaftaranFilterDraft[key] || "").trim() !==
        String(pendaftaranFilters[key] || "").trim()
    );
  }, [pendaftaranFilterDraft, pendaftaranFilters]);

  const handleTogglePendaftaranFilterPanel = useCallback(() => {
    setShowPendaftaranFilterPanel((prev) => {
      const next = !prev;
      if (next) {
        setPendaftaranFilterDraft({ ...pendaftaranFilters });
        window.requestAnimationFrame(() => {
          updatePendaftaranFilterPopupLayout();
        });
      }
      return next;
    });
  }, [pendaftaranFilters, updatePendaftaranFilterPopupLayout]);

  const handleApplyPendaftaranFilters = useCallback(() => {
    setPendaftaranFilters({ ...pendaftaranFilterDraft });
    setShowPendaftaranFilterPanel(false);
  }, [pendaftaranFilterDraft]);

  const handleResetPendaftaranFilters = useCallback(() => {
    setPendaftaranFilters({ ...PENDAFTARAN_FILTER_INITIAL });
    setPendaftaranFilterDraft({ ...PENDAFTARAN_FILTER_INITIAL });
    setShowPendaftaranFilterPanel(false);
  }, []);

  const totalSubmissionPages = useMemo(
    () => Math.max(1, Math.ceil(filteredSubmissions.length / DOSEN_GRID_PAGE_SIZE)),
    [filteredSubmissions.length]
  );
  const submissionReviewTopikOptions = useMemo(() => {
    const allTopikRows = Array.isArray(submissionDetail?.detail_pengajuan?.topik_dipilih)
      ? submissionDetail.detail_pengajuan.topik_dipilih
      : [];
    const reviewerRows = Array.isArray(submissionDetail?.reviewer_slot_decisions)
      ? submissionDetail.reviewer_slot_decisions
      : [];

    const sourceRows =
      submissionDetail?.tipe_pengajuan === "topik_dosen" && reviewerRows.length > 0
        ? reviewerRows.map((reviewerItem) => {
            const matchedTopik =
              allTopikRows.find((topikItem) => Number(topikItem?.slot) === Number(reviewerItem?.slot)) || null;
            const matchedTopikApproved =
              String(matchedTopik?.reviewer_status || "").toLowerCase() === "approved";
            return {
              ...(matchedTopik || {}),
              slot: reviewerItem?.slot,
              kode: reviewerItem?.kode || matchedTopik?.kode || null,
              reviewer_status: reviewerItem?.reviewer_status || matchedTopik?.reviewer_status || null,
              reviewer_note: reviewerItem?.reviewer_note || matchedTopik?.reviewer_note || null,
              reviewer_decided_at: reviewerItem?.reviewer_decided_at || matchedTopik?.reviewer_decided_at || null,
              pembimbing_approval_note:
                reviewerItem?.pembimbing_approval_note ||
                matchedTopik?.pembimbing_approval_note ||
                (matchedTopikApproved ? matchedTopik?.reviewer_note || null : null),
              pembimbing_approved_at:
                reviewerItem?.pembimbing_approved_at ||
                matchedTopik?.pembimbing_approved_at ||
                (matchedTopikApproved ? matchedTopik?.reviewer_decided_at || null : null),
              pembimbing_approved_by:
                reviewerItem?.pembimbing_approved_by ||
                matchedTopik?.pembimbing_approved_by ||
                (matchedTopikApproved ? matchedTopik?.dosen || null : null),
            };
          })
        : allTopikRows;

    return [...sourceRows].sort((left, right) => {
      const leftSlot = Number(left?.slot ?? 0);
      const rightSlot = Number(right?.slot ?? 0);
      return leftSlot - rightSlot;
    });
  }, [submissionDetail]);
  const submissionReviewTopikFocused = useMemo(() => {
    if (submissionReviewTopikOptions.length === 0) return null;
    const selected = submissionReviewTopikOptions.find(
      (item) => String(item?.slot ?? "") === String(submissionTopikFocusSlot || "")
    );
    return selected || submissionReviewTopikOptions[0];
  }, [submissionReviewTopikOptions, submissionTopikFocusSlot]);
  const submissionReviewPembimbingApproval = useMemo(() => {
    const approvedBy = submissionReviewTopikFocused?.pembimbing_approved_by;
    const approvedByName =
      approvedBy && typeof approvedBy === "object"
        ? approvedBy.nama || approvedBy.nik || ""
        : String(approvedBy || "").trim();
    return {
      note: String(submissionReviewTopikFocused?.pembimbing_approval_note || "").trim(),
      decidedAt: submissionReviewTopikFocused?.pembimbing_approved_at || null,
      approvedByName,
    };
  }, [submissionReviewTopikFocused]);
  const shouldShowPembimbingApprovalNote =
    (activeTab === "ketua-cluster-review" || submissionDetail?.review_context === "ketua_klaster") &&
    Boolean(
      submissionReviewPembimbingApproval.note ||
        submissionReviewPembimbingApproval.decidedAt ||
        submissionReviewPembimbingApproval.approvedByName
    );
  const submissionReviewTopikIsSingleDosen = useMemo(() => {
    if (submissionReviewTopikOptions.length <= 1) return true;
    const dosenSet = new Set(
      submissionReviewTopikOptions.map((item) => String(item?.dosen || "").trim()).filter(Boolean)
    );
    return dosenSet.size <= 1;
  }, [submissionReviewTopikOptions]);
  const submissionReviewTopikPendingOptions = useMemo(
    () =>
      submissionReviewTopikOptions.filter(
        (item) => String(item?.reviewer_status || "").toLowerCase() === "pending"
      ),
    [submissionReviewTopikOptions]
  );
  const submissionReviewFirstPendingIndex = useMemo(
    () =>
      submissionReviewTopikOptions.findIndex(
        (item) => String(item?.reviewer_status || "").toLowerCase() === "pending"
      ),
    [submissionReviewTopikOptions]
  );
  const submissionReviewFocusedIndex = useMemo(
    () =>
      submissionReviewTopikOptions.findIndex(
        (item) => String(item?.slot ?? "") === String(submissionTopikFocusSlot || "")
      ),
    [submissionReviewTopikOptions, submissionTopikFocusSlot]
  );
  const submissionReviewMaxUnlockedIndex = useMemo(() => {
    if (!submissionDetail?.can_review) return submissionReviewTopikOptions.length - 1;
    if (submissionReviewFirstPendingIndex < 0) return submissionReviewTopikOptions.length - 1;
    return submissionReviewFirstPendingIndex;
  }, [submissionDetail?.can_review, submissionReviewFirstPendingIndex, submissionReviewTopikOptions.length]);
  const submissionReviewCountdown = useMemo(
    () => getReviewCountdown(submissionDetail?.review_deadline_at, countdownNowDate),
    [countdownNowDate, submissionDetail?.review_deadline_at]
  );
  const submissionDecisionHistory = useMemo(
    () =>
      Array.isArray(submissionDetail?.riwayat_persetujuan)
        ? submissionDetail.riwayat_persetujuan
        : [],
    [submissionDetail?.riwayat_persetujuan]
  );
  const submissionDosenDecisionHistory = useMemo(
    () =>
      submissionDecisionHistory.filter(
        (item) => getSubmissionApprovalRoleKey(item) !== "ketua_cluster"
      ),
    [submissionDecisionHistory]
  );
  const submissionKetuaClusterDecisionHistory = useMemo(
    () =>
      submissionDecisionHistory.filter(
        (item) => getSubmissionApprovalRoleKey(item) === "ketua_cluster"
      ),
    [submissionDecisionHistory]
  );

  const submissionNotificationItems = useMemo(() => {
    return submissions
      .filter((row) => row?.status === "pending" && !isKetuaClusterSubmissionReview(row))
      .slice()
      .sort(
        (left, right) =>
          new Date(right?.diajukan_pada || right?.diperbarui_pada || 0).getTime() -
          new Date(left?.diajukan_pada || left?.diperbarui_pada || 0).getTime()
      );
  }, [submissions]);
  const unreadSubmissionNotificationCount = useMemo(() => {
    if (submissionNotificationItems.length === 0) return 0;
    return submissionNotificationItems.filter((item) => {
      const createdAt = new Date(item?.diajukan_pada || item?.diperbarui_pada || 0).getTime();
      if (!Number.isFinite(createdAt) || createdAt <= 0) return false;
      return createdAt > Number(submissionNotificationSeenAt || 0);
    }).length;
  }, [submissionNotificationItems, submissionNotificationSeenAt]);

  const pagedSubmissions = useMemo(() => {
    const start = (submissionPage - 1) * DOSEN_GRID_PAGE_SIZE;
    return filteredSubmissions.slice(start, start + DOSEN_GRID_PAGE_SIZE);
  }, [filteredSubmissions, submissionPage]);
  const submissionRangeStart =
    filteredSubmissions.length === 0 ? 0 : (submissionPage - 1) * DOSEN_GRID_PAGE_SIZE + 1;
  const submissionRangeEnd = Math.min(
    submissionPage * DOSEN_GRID_PAGE_SIZE,
    filteredSubmissions.length
  );

  const totalIzinLanjutPages = useMemo(
    () => Math.max(1, Math.ceil(filteredIzinLanjutRows.length / DOSEN_GRID_PAGE_SIZE)),
    [filteredIzinLanjutRows.length]
  );
  const pagedIzinLanjutRows = useMemo(() => {
    const start = (izinLanjutPage - 1) * DOSEN_GRID_PAGE_SIZE;
    return filteredIzinLanjutRows.slice(start, start + DOSEN_GRID_PAGE_SIZE);
  }, [filteredIzinLanjutRows, izinLanjutPage]);
  const izinRangeStart =
    filteredIzinLanjutRows.length === 0 ? 0 : (izinLanjutPage - 1) * DOSEN_GRID_PAGE_SIZE + 1;
  const izinRangeEnd = Math.min(
    izinLanjutPage * DOSEN_GRID_PAGE_SIZE,
    filteredIzinLanjutRows.length
  );

  const totalPamitPages = useMemo(
    () => Math.max(1, Math.ceil(pamitRows.length / DOSEN_GRID_PAGE_SIZE)),
    [pamitRows.length]
  );
  const pagedPamitRows = useMemo(() => {
    const start = (pamitPage - 1) * DOSEN_GRID_PAGE_SIZE;
    return pamitRows.slice(start, start + DOSEN_GRID_PAGE_SIZE);
  }, [pamitRows, pamitPage]);
  const pamitRangeStart = pamitRows.length === 0 ? 0 : (pamitPage - 1) * DOSEN_GRID_PAGE_SIZE + 1;
  const pamitRangeEnd = Math.min(pamitPage * DOSEN_GRID_PAGE_SIZE, pamitRows.length);

  const totalMagangReviewPages = useMemo(
    () => Math.max(1, Math.ceil(filteredMagangReviewRows.length / DOSEN_GRID_PAGE_SIZE)),
    [filteredMagangReviewRows.length]
  );
  const pagedMagangReviewRows = useMemo(() => {
    const start = (magangReviewPage - 1) * DOSEN_GRID_PAGE_SIZE;
    return filteredMagangReviewRows.slice(start, start + DOSEN_GRID_PAGE_SIZE);
  }, [filteredMagangReviewRows, magangReviewPage]);
  const magangReviewRangeStart =
    filteredMagangReviewRows.length === 0 ? 0 : (magangReviewPage - 1) * DOSEN_GRID_PAGE_SIZE + 1;
  const magangReviewRangeEnd = Math.min(
    magangReviewPage * DOSEN_GRID_PAGE_SIZE,
    filteredMagangReviewRows.length
  );

  const totalPengampuReviewPages = useMemo(
    () => Math.max(1, Math.ceil(filteredPengampuReviewRows.length / DOSEN_GRID_PAGE_SIZE)),
    [filteredPengampuReviewRows.length]
  );
  const pagedPengampuReviewRows = useMemo(() => {
    const start = (activePengampuReviewPage - 1) * DOSEN_GRID_PAGE_SIZE;
    return filteredPengampuReviewRows.slice(start, start + DOSEN_GRID_PAGE_SIZE);
  }, [activePengampuReviewPage, filteredPengampuReviewRows]);
  const pengampuReviewRangeStart =
    filteredPengampuReviewRows.length === 0 ? 0 : (activePengampuReviewPage - 1) * DOSEN_GRID_PAGE_SIZE + 1;
  const pengampuReviewRangeEnd = Math.min(
    activePengampuReviewPage * DOSEN_GRID_PAGE_SIZE,
    filteredPengampuReviewRows.length
  );

  const totalPendaftaranPages = useMemo(
    () => Math.max(1, Math.ceil(filteredPendaftaranRows.length / DOSEN_GRID_PAGE_SIZE)),
    [filteredPendaftaranRows.length]
  );
  const pagedPendaftaranRows = useMemo(() => {
    const start = (pendaftaranPage - 1) * DOSEN_GRID_PAGE_SIZE;
    return filteredPendaftaranRows.slice(start, start + DOSEN_GRID_PAGE_SIZE);
  }, [filteredPendaftaranRows, pendaftaranPage]);
  const pendaftaranRangeStart =
    filteredPendaftaranRows.length === 0
      ? 0
      : (pendaftaranPage - 1) * DOSEN_GRID_PAGE_SIZE + 1;
  const pendaftaranRangeEnd = Math.min(
    pendaftaranPage * DOSEN_GRID_PAGE_SIZE,
    filteredPendaftaranRows.length
  );

  const periodeRows = useMemo(
    () => (Array.isArray(periodeOverview.periodes) ? periodeOverview.periodes : []),
    [periodeOverview.periodes]
  );
  const periodeDosenOptions = useMemo(
    () => (Array.isArray(periodeOverview.dosen_options) ? periodeOverview.dosen_options : []),
    [periodeOverview.dosen_options]
  );
  const periodeKetuaKlasterOptions = useMemo(
    () => (Array.isArray(periodeOverview.ketua_klaster_options) ? periodeOverview.ketua_klaster_options : []),
    [periodeOverview.ketua_klaster_options]
  );
  const periodeDosenMap = useMemo(
    () => new Map(periodeDosenOptions.map((item) => [Number(item.id), item])),
    [periodeDosenOptions]
  );
  const totalPeriodePages = useMemo(
    () => Math.max(1, Math.ceil(periodeRows.length / DOSEN_GRID_PAGE_SIZE)),
    [periodeRows.length]
  );
  const pagedPeriodeRows = useMemo(() => {
    const start = (periodePage - 1) * DOSEN_GRID_PAGE_SIZE;
    return periodeRows.slice(start, start + DOSEN_GRID_PAGE_SIZE);
  }, [periodeRows, periodePage]);
  const periodeRangeStart = periodeRows.length === 0 ? 0 : (periodePage - 1) * DOSEN_GRID_PAGE_SIZE + 1;
  const periodeRangeEnd = Math.min(periodePage * DOSEN_GRID_PAGE_SIZE, periodeRows.length);
  const periodeReadonlyKetuaByCluster = useMemo(() => {
    const rows = Array.isArray(periodeReadonlyRoles.rows) ? periodeReadonlyRoles.rows : [];
    const map = new Map();
    for (const row of rows) {
      const code = normalizeResearchClusterCode(row?.kode || row?.nama);
      if (!code || map.has(code)) continue;
      map.set(code, row);
    }
    return map;
  }, [periodeReadonlyRoles.rows]);

  const masterDosenKuotaRows = useMemo(
    () => (Array.isArray(masterDosenKuotaOverview?.dosens) ? masterDosenKuotaOverview.dosens : []),
    [masterDosenKuotaOverview?.dosens]
  );
  const filteredMasterDosenKuotaRows = useMemo(() => {
    const keyword = masterDosenKuotaQuery.trim().toLowerCase();
    if (!keyword) return masterDosenKuotaRows;
    return masterDosenKuotaRows.filter((row) => {
      const haystack = [
        row?.kode_dosen,
        row?.nik,
        row?.nama,
        row?.email,
        row?.jabatan_struktural,
        row?.kuota?.total,
        row?.kuota?.terpakai,
        row?.kuota?.sisa,
      ]
        .filter((item) => item !== null && item !== undefined && String(item).trim() !== "")
        .join(" ")
        .toLowerCase();
      return haystack.includes(keyword);
    });
  }, [masterDosenKuotaQuery, masterDosenKuotaRows]);
  const totalMasterDosenKuotaPages = useMemo(
    () => Math.max(1, Math.ceil(filteredMasterDosenKuotaRows.length / DOSEN_GRID_PAGE_SIZE)),
    [filteredMasterDosenKuotaRows.length]
  );
  const pagedMasterDosenKuotaRows = useMemo(() => {
    const start = (masterDosenKuotaPage - 1) * DOSEN_GRID_PAGE_SIZE;
    return filteredMasterDosenKuotaRows.slice(start, start + DOSEN_GRID_PAGE_SIZE);
  }, [filteredMasterDosenKuotaRows, masterDosenKuotaPage]);
  const masterDosenKuotaRangeStart =
    filteredMasterDosenKuotaRows.length === 0
      ? 0
      : (masterDosenKuotaPage - 1) * DOSEN_GRID_PAGE_SIZE + 1;
  const masterDosenKuotaRangeEnd = Math.min(
    masterDosenKuotaPage * DOSEN_GRID_PAGE_SIZE,
    filteredMasterDosenKuotaRows.length
  );
  const pagedMasterDosenKuotaIds = useMemo(
    () =>
      pagedMasterDosenKuotaRows
        .map((row) => Number(row?.id))
        .filter((id) => Number.isInteger(id) && id > 0),
    [pagedMasterDosenKuotaRows]
  );
  const isMasterDosenKuotaPageAllSelected = useMemo(() => {
    if (pagedMasterDosenKuotaIds.length === 0) return false;
    const selectedSet = new Set(masterDosenSelectedDosenIds.map((item) => Number(item)));
    return pagedMasterDosenKuotaIds.every((id) => selectedSet.has(id));
  }, [masterDosenSelectedDosenIds, pagedMasterDosenKuotaIds]);
  const masterPeriodeMissingLabels = useMemo(() => {
    return PERIODE_MASTER_ALL_FIELDS
      .filter((item) => !String(periodeMasterForm?.[item.key] || "").trim())
      .map((item) => item.label);
  }, [periodeMasterForm]);
  const periodeMasterSelectedDosenIdsByField = useMemo(() => {
    const map = {};
    for (const item of PERIODE_MASTER_ALL_FIELDS) {
      const parsedId = Number(periodeMasterForm?.[item.key]);
      map[item.key] = Number.isInteger(parsedId) && parsedId > 0 ? parsedId : null;
    }
    return map;
  }, [periodeMasterForm]);
  const periodeMasterOptionsByField = useMemo(() => {
    const next = {};
    for (const ketuaField of PERIODE_MASTER_KETUA_FIELDS) {
      const clusterOption = periodeKetuaKlasterOptions.find(
        (row) => String(row?.kode || "").toUpperCase() === ketuaField.code
      );
      next[ketuaField.key] = Array.isArray(clusterOption?.kandidat_dosen)
        ? clusterOption.kandidat_dosen
        : [];
    }
    for (const jalurField of PERIODE_MASTER_JALUR_FIELDS) {
      next[jalurField.key] = periodeDosenOptions;
    }
    return next;
  }, [periodeDosenOptions, periodeKetuaKlasterOptions]);

  useEffect(() => {
    setMasterDosenKuotaPage(1);
  }, [masterDosenKuotaQuery]);

  useEffect(() => {
    if (masterDosenKuotaPage > totalMasterDosenKuotaPages) {
      setMasterDosenKuotaPage(totalMasterDosenKuotaPages);
    }
  }, [masterDosenKuotaPage, totalMasterDosenKuotaPages]);

  const filteredKetuaKlasterRows = useMemo(() => {
    const rows = Array.isArray(ketuaKlasterOverview.rows) ? ketuaKlasterOverview.rows : [];
    const keyword = ketuaKlasterQuery.trim().toLowerCase();
    if (!keyword) return rows;
    return rows.filter((row) => {
      const haystack = [
        row.kode,
        row.nama,
        row.ketua?.ketua_dosen?.nama,
        row.ketua?.ketua_dosen?.nik,
        row.ketua?.ketua_dosen?.kode_dosen,
        ...(Array.isArray(row.kandidat_dosen) ? row.kandidat_dosen.map((item) => item.nama) : []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(keyword);
    });
  }, [ketuaKlasterOverview.rows, ketuaKlasterQuery]);

  const totalKetuaKlasterPages = useMemo(
    () => Math.max(1, Math.ceil(filteredKetuaKlasterRows.length / DOSEN_GRID_PAGE_SIZE)),
    [filteredKetuaKlasterRows.length]
  );
  const pagedKetuaKlasterRows = useMemo(() => {
    const start = (ketuaKlasterPage - 1) * DOSEN_GRID_PAGE_SIZE;
    return filteredKetuaKlasterRows.slice(start, start + DOSEN_GRID_PAGE_SIZE);
  }, [filteredKetuaKlasterRows, ketuaKlasterPage]);
  const ketuaKlasterRangeStart =
    filteredKetuaKlasterRows.length === 0 ? 0 : (ketuaKlasterPage - 1) * DOSEN_GRID_PAGE_SIZE + 1;
  const ketuaKlasterRangeEnd = Math.min(
    ketuaKlasterPage * DOSEN_GRID_PAGE_SIZE,
    filteredKetuaKlasterRows.length
  );
  const selectedKetuaPeriode = useMemo(() => {
    const selectedId = Number(ketuaKlasterPeriodeId);
    if (Number.isInteger(selectedId) && selectedId > 0) {
      const fromOptions = (ketuaKlasterOverview.periodes || []).find(
        (item) => Number(item.id) === selectedId
      );
      if (fromOptions) return fromOptions;
    }
    return ketuaKlasterOverview.periode_terpilih || null;
  }, [ketuaKlasterOverview.periode_terpilih, ketuaKlasterOverview.periodes, ketuaKlasterPeriodeId]);

  const ketuaReviewStats = useMemo(() => {
    const rows = Array.isArray(ketuaKlasterOverview.rows) ? ketuaKlasterOverview.rows : [];
    const total = rows.length;
    const terisi = rows.filter((row) => Boolean(row?.ketua?.ketua_dosen?.id)).length;
    const belumTerisi = Math.max(0, total - terisi);
    return { total, terisi, belumTerisi };
  }, [ketuaKlasterOverview.rows]);

  const mahasiswaMasterHistoryRows = useMemo(() => {
    return mahasiswaMasterRows.flatMap((mahasiswa) => {
      const history = Array.isArray(mahasiswa.riwayat_penjaluran)
        ? mahasiswa.riwayat_penjaluran
        : [];

      if (history.length === 0) {
        return [
          {
            mahasiswa_id: mahasiswa.id,
            pendaftaran_id: null,
            nim: mahasiswa.nim,
            nama: mahasiswa.nama,
            email: mahasiswa.email,
            angkatan: mahasiswa.angkatan,
            status_jalur_saat_ini: mahasiswa.status_jalur_saat_ini,
            dosen_pembimbing_akademik: mahasiswa.dosenPembimbingAkademik?.nama || "-",
            dosen_pembimbing_skripsi: mahasiswa.dosenPembimbingSkripsi?.nama || "-",
            semester_penjaluran_ke: 0,
            semester_penjaluran_aktif: mahasiswa.semester_penjaluran_aktif || 0,
            tahun_akademik: null,
            semester_akademik: null,
            periode_label: null,
            jalur: null,
            nama_penjaluran: null,
            pembimbing_ta: null,
            pendaftaran_status: null,
            tanggal_penjaluran: null,
            updatedAt: mahasiswa.updatedAt,
          },
        ];
      }

      return history.map((item) => ({
        mahasiswa_id: mahasiswa.id,
        pendaftaran_id: item.id,
        nim: mahasiswa.nim,
        nama: mahasiswa.nama,
        email: mahasiswa.email,
        angkatan: mahasiswa.angkatan,
        status_jalur_saat_ini: mahasiswa.status_jalur_saat_ini,
        dosen_pembimbing_akademik: mahasiswa.dosenPembimbingAkademik?.nama || "-",
        dosen_pembimbing_skripsi: mahasiswa.dosenPembimbingSkripsi?.nama || "-",
        semester_penjaluran_ke: item.semester_penjaluran_ke || 0,
        semester_penjaluran_aktif:
          item.semester_penjaluran_aktif ??
          mahasiswa.semester_penjaluran_aktif ??
          item.semester_penjaluran_ke ??
          0,
        tahun_akademik: item.periode_penjaluran?.tahun_akademik || null,
        semester_akademik: item.periode_penjaluran?.semester || null,
        periode_label: item.periode_penjaluran?.label_periode || null,
        jalur: item.jalur || null,
        nama_penjaluran: item.nama_penjaluran || null,
        pembimbing_ta: item.pembimbing_ta?.nama || null,
        pendaftaran_status: item.status || null,
        tanggal_penjaluran: item.createdAt || null,
        updatedAt: item.updatedAt || mahasiswa.updatedAt,
      }));
    });
  }, [mahasiswaMasterRows]);

  const mahasiswaBimbinganHistoryRows = useMemo(() => {
    const dosenId = Number(kuotaData?.dosen?.id);
    if (!Number.isFinite(dosenId)) return [];

    const mahasiswaBimbinganIds = new Set(
      mahasiswaMasterRows
        .filter((mahasiswa) => Number(mahasiswa.dosen_pembimbing_skripsi_id) === dosenId)
        .map((mahasiswa) => mahasiswa.id)
    );

    return mahasiswaMasterHistoryRows.filter((row) => mahasiswaBimbinganIds.has(row.mahasiswa_id));
  }, [kuotaData?.dosen?.id, mahasiswaMasterRows, mahasiswaMasterHistoryRows]);

  const mahasiswaRowsByActiveTab = useMemo(() => {
    return activeTab === "mahasiswa-bimbingan"
      ? mahasiswaBimbinganHistoryRows
      : mahasiswaMasterHistoryRows;
  }, [activeTab, mahasiswaBimbinganHistoryRows, mahasiswaMasterHistoryRows]);

  const mahasiswaMasterFilterOptions = useMemo(() => {
    const angkatanSet = new Set();
    const semesterPenjaluranSet = new Set();
    const periodeSet = new Set();
    const penjaluranSet = new Set();
    const tipePendaftaranSet = new Set();

    for (const row of mahasiswaRowsByActiveTab) {
      if (row?.angkatan) {
        angkatanSet.add(String(row.angkatan).trim());
      }
      const semesterPenjaluran = Number(row?.semester_penjaluran_aktif || row?.semester_penjaluran_ke || 0);
      if (Number.isFinite(semesterPenjaluran) && semesterPenjaluran > 0) {
        semesterPenjaluranSet.add(String(semesterPenjaluran));
      }
      const periodeValue = buildMahasiswaMasterPeriodeFilterValue(row);
      if (periodeValue) {
        periodeSet.add(periodeValue);
      }
      if (row?.nama_penjaluran) {
        penjaluranSet.add(String(row.nama_penjaluran).trim());
      }
      if (row?.jalur) {
        tipePendaftaranSet.add(String(row.jalur).trim().toLowerCase());
      }
    }

    const jalurOrder = ["baru", "ulang", "alih"];
    const tipePendaftaranList = jalurOrder
      .filter((item) => tipePendaftaranSet.has(item))
      .concat(
        Array.from(tipePendaftaranSet)
          .filter((item) => !jalurOrder.includes(item))
          .sort((a, b) => a.localeCompare(b, "id"))
      );

    return {
      angkatan: Array.from(angkatanSet).sort((a, b) => Number(b) - Number(a)),
      semester_penjaluran: Array.from(semesterPenjaluranSet).sort((a, b) => Number(a) - Number(b)),
      periode: Array.from(periodeSet).sort((a, b) => a.localeCompare(b, "id")),
      penjaluran: Array.from(penjaluranSet).sort((a, b) => a.localeCompare(b, "id")),
      tipe_pendaftaran: tipePendaftaranList,
    };
  }, [mahasiswaRowsByActiveTab]);

  const filteredMahasiswaMasterRows = useMemo(() => {
    const selectedAngkatan = String(mahasiswaMasterFilters.angkatan || "").trim();
    const selectedSemesterPenjaluran = String(mahasiswaMasterFilters.semester_penjaluran || "").trim();
    const selectedPeriode = String(mahasiswaMasterFilters.periode || "").trim();
    const selectedPenjaluran = String(mahasiswaMasterFilters.penjaluran || "").trim().toLowerCase();
    const selectedTipePendaftaran = String(mahasiswaMasterFilters.tipe_pendaftaran || "")
      .trim()
      .toLowerCase();
    const keyword = mahasiswaMasterQuery.trim().toLowerCase();

    return mahasiswaRowsByActiveTab.filter((row) => {
      if (selectedAngkatan && String(row?.angkatan || "").trim() !== selectedAngkatan) {
        return false;
      }

      const semesterPenjaluran = String(
        Number(row?.semester_penjaluran_aktif || row?.semester_penjaluran_ke || 0) || ""
      );
      if (selectedSemesterPenjaluran && semesterPenjaluran !== selectedSemesterPenjaluran) {
        return false;
      }

      const periodeValue = buildMahasiswaMasterPeriodeFilterValue(row);
      if (selectedPeriode && periodeValue !== selectedPeriode) {
        return false;
      }

      if (selectedPenjaluran && String(row?.nama_penjaluran || "").trim().toLowerCase() !== selectedPenjaluran) {
        return false;
      }

      if (selectedTipePendaftaran && String(row?.jalur || "").trim().toLowerCase() !== selectedTipePendaftaran) {
        return false;
      }

      if (!keyword) return true;

      const haystack = [
        row.nim,
        row.nama,
        row.email,
        row.angkatan,
        row.status_jalur_saat_ini,
        row.dosen_pembimbing_akademik,
        row.dosen_pembimbing_skripsi,
        (row.semester_penjaluran_aktif || row.semester_penjaluran_ke)
          ? `semester ${row.semester_penjaluran_aktif || row.semester_penjaluran_ke}`
          : null,
        row.tahun_akademik,
        row.semester_akademik,
        row.periode_label,
        row.jalur,
        row.nama_penjaluran,
        row.pembimbing_ta,
        row.pendaftaran_status,
        `tipe ${formatLabel(row.jalur)}`,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(keyword);
    });
  }, [mahasiswaRowsByActiveTab, mahasiswaMasterFilters, mahasiswaMasterQuery]);

  const totalMahasiswaMasterPages = useMemo(
    () => Math.max(1, Math.ceil(filteredMahasiswaMasterRows.length / MAHASISWA_MASTER_PAGE_SIZE)),
    [filteredMahasiswaMasterRows.length]
  );

  const pagedMahasiswaMasterRows = useMemo(() => {
    const start = (mahasiswaMasterPage - 1) * MAHASISWA_MASTER_PAGE_SIZE;
    return filteredMahasiswaMasterRows.slice(start, start + MAHASISWA_MASTER_PAGE_SIZE);
  }, [filteredMahasiswaMasterRows, mahasiswaMasterPage]);

  const mahasiswaMasterRangeStart =
    filteredMahasiswaMasterRows.length === 0
      ? 0
      : (mahasiswaMasterPage - 1) * MAHASISWA_MASTER_PAGE_SIZE + 1;
  const mahasiswaMasterRangeEnd = Math.min(
    mahasiswaMasterPage * MAHASISWA_MASTER_PAGE_SIZE,
    filteredMahasiswaMasterRows.length
  );
  const mahasiswaMasterActiveFilterChips = useMemo(() => {
    const chips = [];
    const angkatan = String(mahasiswaMasterFilters.angkatan || "").trim();
    const semesterPenjaluran = String(mahasiswaMasterFilters.semester_penjaluran || "").trim();
    const periode = String(mahasiswaMasterFilters.periode || "").trim();
    const penjaluran = String(mahasiswaMasterFilters.penjaluran || "").trim();
    const tipePendaftaran = String(mahasiswaMasterFilters.tipe_pendaftaran || "").trim();

    if (angkatan) {
      chips.push({ key: "angkatan", label: `Angkatan: ${angkatan}` });
    }
    if (semesterPenjaluran) {
      chips.push({
        key: "semester_penjaluran",
        label: `Semester Penjaluran: ${semesterPenjaluran}`,
      });
    }
    if (periode) {
      chips.push({ key: "periode", label: `Periode: ${periode}` });
    }
    if (penjaluran) {
      chips.push({ key: "penjaluran", label: `Penjaluran: ${penjaluran}` });
    }
    if (tipePendaftaran) {
      chips.push({ key: "tipe_pendaftaran", label: `Tipe: ${formatLabel(tipePendaftaran)}` });
    }

    return chips;
  }, [mahasiswaMasterFilters]);
  const hasMahasiswaMasterActiveFilters = useMemo(() => {
    return mahasiswaMasterActiveFilterChips.length > 0;
  }, [mahasiswaMasterActiveFilterChips]);
  const hasMahasiswaMasterDraftFilters = useMemo(() => {
    return Object.values(mahasiswaMasterFilterDraft).some((value) => String(value || "").trim().length > 0);
  }, [mahasiswaMasterFilterDraft]);
  const isMahasiswaMasterFilterDraftDirty = useMemo(() => {
    return Object.keys(MAHASISWA_MASTER_FILTER_INITIAL).some(
      (key) =>
        String(mahasiswaMasterFilterDraft[key] || "").trim() !==
        String(mahasiswaMasterFilters[key] || "").trim()
    );
  }, [mahasiswaMasterFilterDraft, mahasiswaMasterFilters]);

  const handleToggleMahasiswaMasterFilterPanel = useCallback(() => {
    setShowMahasiswaMasterFilterPanel((prev) => {
      const next = !prev;
      if (next) {
        setMahasiswaMasterFilterDraft({ ...mahasiswaMasterFilters });
        window.requestAnimationFrame(() => {
          updateMahasiswaMasterFilterPopupLayout();
        });
      }
      return next;
    });
  }, [mahasiswaMasterFilters, updateMahasiswaMasterFilterPopupLayout]);

  const handleApplyMahasiswaMasterFilters = useCallback(() => {
    setMahasiswaMasterFilters({ ...mahasiswaMasterFilterDraft });
    setShowMahasiswaMasterFilterPanel(false);
  }, [mahasiswaMasterFilterDraft]);

  const handleResetMahasiswaMasterFilters = useCallback(() => {
    setMahasiswaMasterFilters({ ...MAHASISWA_MASTER_FILTER_INITIAL });
    setMahasiswaMasterFilterDraft({ ...MAHASISWA_MASTER_FILTER_INITIAL });
    setShowMahasiswaMasterFilterPanel(false);
  }, []);

  useEffect(() => {
    setMahasiswaMasterPage(1);
  }, [mahasiswaMasterFilters, mahasiswaMasterQuery]);

  useEffect(() => {
    if (mahasiswaMasterPage > totalMahasiswaMasterPages) {
      setMahasiswaMasterPage(totalMahasiswaMasterPages);
    }
  }, [mahasiswaMasterPage, totalMahasiswaMasterPages]);

  useEffect(() => {
    setSubmissionPage(1);
  }, [submissionQuery]);

  useEffect(() => {
    if (submissionPage > totalSubmissionPages) {
      setSubmissionPage(totalSubmissionPages);
    }
  }, [submissionPage, totalSubmissionPages]);

  useEffect(() => {
    setIzinLanjutPage(1);
  }, [izinLanjutQuery]);

  useEffect(() => {
    if (izinLanjutPage > totalIzinLanjutPages) {
      setIzinLanjutPage(totalIzinLanjutPages);
    }
  }, [izinLanjutPage, totalIzinLanjutPages]);

  useEffect(() => {
    if (pamitPage > totalPamitPages) {
      setPamitPage(totalPamitPages);
    }
  }, [pamitPage, totalPamitPages]);

  useEffect(() => {
    setMagangReviewPage(1);
  }, [magangReviewQuery]);

  useEffect(() => {
    if (magangReviewPage > totalMagangReviewPages) {
      setMagangReviewPage(totalMagangReviewPages);
    }
  }, [magangReviewPage, totalMagangReviewPages]);

  useEffect(() => {
    if (!activePengampuReviewJalur) return;
    if (activePengampuReviewPage > totalPengampuReviewPages) {
      setPengampuReviewPageByJalur((prev) => ({
        ...prev,
        [activePengampuReviewJalur]: totalPengampuReviewPages,
      }));
    }
  }, [activePengampuReviewJalur, activePengampuReviewPage, totalPengampuReviewPages]);

  useEffect(() => {
    setPendaftaranPage(1);
  }, [pendaftaranFilters, pendaftaranSearch]);

  useEffect(() => {
    if (pendaftaranPage > totalPendaftaranPages) {
      setPendaftaranPage(totalPendaftaranPages);
    }
  }, [pendaftaranPage, totalPendaftaranPages]);

  useEffect(() => {
    if (periodePage > totalPeriodePages) {
      setPeriodePage(totalPeriodePages);
    }
  }, [periodePage, totalPeriodePages]);

  useEffect(() => {
    const nextDraft = {};
    for (const row of ketuaKlasterOverview.rows || []) {
      nextDraft[row.id] = row?.ketua?.ketua_dosen?.id ? String(row.ketua.ketua_dosen.id) : "";
    }
    setKetuaKlasterDraft(nextDraft);
  }, [ketuaKlasterOverview.rows, ketuaKlasterOverview.periode_terpilih?.id]);

  useEffect(() => {
    setKetuaKlasterPage(1);
  }, [ketuaKlasterQuery]);

  useEffect(() => {
    if (ketuaKlasterPage > totalKetuaKlasterPages) {
      setKetuaKlasterPage(totalKetuaKlasterPages);
    }
  }, [ketuaKlasterPage, totalKetuaKlasterPages]);

  useEffect(() => {
    if (!isSubmissionReviewTabActive) {
      setSubmissionMode("list");
      setSelectedSubmissionId(null);
      setSubmissionDetail(null);
      setSubmissionKeterangan("");
      setSubmissionDecision("approve");
      setSubmissionTopikFocusSlot("");
      setSubmissionShowFinalSummary(false);
    }
  }, [isSubmissionReviewTabActive]);

  useEffect(() => {
    if (submissionReviewTopikOptions.length === 0) {
      if (submissionTopikFocusSlot) {
        setSubmissionTopikFocusSlot("");
      }
      return;
    }
    const pendingOption =
      submissionReviewTopikOptions.find((item) => String(item?.reviewer_status || "").toLowerCase() === "pending") || null;
    const hasSelectedSlot = submissionReviewTopikOptions.some(
      (item) => String(item?.slot ?? "") === String(submissionTopikFocusSlot || "")
    );
    const selectedOption = hasSelectedSlot
      ? submissionReviewTopikOptions.find((item) => String(item?.slot ?? "") === String(submissionTopikFocusSlot || "")) || null
      : null;
    if (!hasSelectedSlot) {
      setSubmissionTopikFocusSlot(String((pendingOption || submissionReviewTopikOptions[0])?.slot ?? ""));
      return;
    }
    if (
      submissionDetail?.can_review &&
      pendingOption &&
      String(selectedOption?.reviewer_status || "").toLowerCase() !== "pending"
    ) {
      setSubmissionTopikFocusSlot(String(pendingOption.slot ?? ""));
    }
  }, [submissionDetail?.can_review, submissionReviewTopikOptions, submissionTopikFocusSlot]);

  const markSubmissionNotificationsAsRead = useCallback(() => {
    const nowTs = Date.now();
    setSubmissionNotificationSeenAt(nowTs);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(submissionNotificationStorageKey, String(nowTs));
    }
  }, [submissionNotificationStorageKey]);

  const handleToggleSubmissionNotificationPanel = () => {
    setShowSubmissionNotificationPanel((prev) => {
      const next = !prev;
      if (next) {
        markSubmissionNotificationsAsRead();
      }
      return next;
    });
  };

  const handleOpenSubmissionReview = async (id, defaultDecision = "approve") => {
    setSelectedSubmissionId(id);
    setSubmissionDecision(defaultDecision === "reject" ? "reject" : "approve");
    setSubmissionKeterangan("");
    setSubmissionTopikFocusSlot("");
    setSubmissionShowFinalSummary(false);
    setLoadingSubmissionDetail(true);
    try {
      const detail = await fetchWithAuth(`/api/dosen/submissions/${id}`);
      setSubmissionDetail(detail || null);
      setSubmissionMode("review");
    } catch (detailError) {
      if (detailError?.message !== "__SESSION_EXPIRED__") {
        showErrorToast(detailError.message || "Gagal memuat detail pengajuan.");
      }
      setSelectedSubmissionId(null);
    } finally {
      setLoadingSubmissionDetail(false);
    }
  };

  const handleBackToSubmissionList = () => {
    setSubmissionMode("list");
    setSelectedSubmissionId(null);
    setSubmissionDetail(null);
    setSubmissionKeterangan("");
    setSubmissionDecision("approve");
    setSubmissionTopikFocusSlot("");
    setSubmissionShowFinalSummary(false);
  };

  const handleOpenSubmissionStepByIndex = (index) => {
    if (index < 0 || index >= submissionReviewTopikOptions.length) return;
    if (submissionDetail?.can_review && index > submissionReviewMaxUnlockedIndex) return;
    const nextSlot = submissionReviewTopikOptions[index]?.slot;
    if (!nextSlot) return;
    setSubmissionTopikFocusSlot(String(nextSlot));
    setSubmissionKeterangan("");
    setSubmissionShowFinalSummary(false);
  };

  const handleRefreshSubmissionReview = async () => {
    if (!selectedSubmissionId) return;
    setLoadingSubmissionDetail(true);
    try {
      const detail = await fetchWithAuth(`/api/dosen/submissions/${selectedSubmissionId}`);
      setSubmissionDetail(detail || null);
    } catch (detailError) {
      if (detailError?.message !== "__SESSION_EXPIRED__") {
        showErrorToast(detailError.message || "Gagal memuat ulang detail pengajuan.");
      }
    } finally {
      setLoadingSubmissionDetail(false);
    }
  };

  const handleSubmitSubmissionDecision = async () => {
    if (!selectedSubmissionId || !submissionDetail) {
      showErrorToast("Detail pengajuan belum siap diproses.");
      return;
    }

    if (submissionDetail?.can_review !== true) {
      showErrorToast("Anda tidak memiliki akses keputusan untuk pengajuan ini.");
      return;
    }

    if (submissionDecision === "reject" && !submissionKeterangan.trim()) {
      showErrorToast("Alasan penolakan wajib diisi.");
      return;
    }

    if (
      submissionDetail?.tipe_pengajuan === "topik_dosen" &&
      String(submissionReviewTopikFocused?.reviewer_status || "").toLowerCase() !== "pending"
    ) {
      showErrorToast("Slot topik ini sudah memiliki keputusan. Pilih slot yang masih pending.");
      return;
    }

    const isApprove = submissionDecision === "approve";
    const endpoint = isApprove
      ? `/api/dosen/submissions/${selectedSubmissionId}/approve`
      : `/api/dosen/submissions/${selectedSubmissionId}/reject`;
    const payload = { keterangan: submissionKeterangan.trim() };
    if (submissionDetail?.tipe_pengajuan === "topik_dosen") {
      const selectedTopikSlot = Number(submissionTopikFocusSlot || submissionReviewTopikFocused?.slot || 0);
      if (!Number.isInteger(selectedTopikSlot) || selectedTopikSlot <= 0) {
        showErrorToast("Pilih topik slot yang akan diproses terlebih dahulu.");
        return;
      }
      payload.topik_slot = selectedTopikSlot;
    }
    const confirmTitle = isApprove ? "Setujui pengajuan ini?" : "Tolak pengajuan ini?";
    const confirmButtonText = isApprove ? "Ya, setujui" : "Ya, tolak";

    const confirm = await Swal.fire({
      title: confirmTitle,
      text: "Pastikan keputusan sudah sesuai.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText,
      cancelButtonText: "Batal",
      confirmButtonColor: isApprove ? "#137748" : "#b73a3a",
    });
    if (!confirm.isConfirmed) return;

    setRowActionLoadingId(selectedSubmissionId);
    try {
      const isTopikDosenSubmission = submissionDetail?.tipe_pengajuan === "topik_dosen";
      await fetchWithAuth(endpoint, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      handleBackToSubmissionList();

      if (isTopikDosenSubmission) {
        showSuccessToast(isApprove ? "Slot topik berhasil disetujui." : "Slot topik berhasil ditolak.");
      } else {
        showSuccessToast(isApprove ? "Pengajuan berhasil disetujui." : "Pengajuan berhasil ditolak.");
      }
      try {
        await loadAllData();
      } catch (refreshError) {
        if (refreshError?.message !== "__SESSION_EXPIRED__") {
          showErrorToast(refreshError.message || "Keputusan tersimpan, tetapi grid gagal direfresh.");
        }
      }
    } catch (decisionError) {
      if (decisionError?.message !== "__SESSION_EXPIRED__") {
        showErrorToast(decisionError.message || "Gagal memproses keputusan pengajuan.");
      }
    } finally {
      setRowActionLoadingId(null);
    }
  };

  const handleOpenMagangReviewDetail = async (id) => {
    setMagangReviewActionId(id);
    try {
      const detail = await fetchWithAuth(`/api/dosen/non-penelitian/magang/reviews/${id}`);
      const fieldsHtml = getMagangDetailFields(detail)
        .map(
          ([label, value]) => `
            <tr>
              <td style="width:220px;padding:8px 10px;border-bottom:1px solid #edf2fb;color:#52638d;font-weight:700;vertical-align:top;">${escapeHtml(label)}</td>
              <td style="padding:8px 10px;border-bottom:1px solid #edf2fb;color:#203665;vertical-align:top;">${escapeHtml(
                formatMagangPayloadValue(value)
              )}</td>
            </tr>
          `
        )
        .join("");

      await Swal.fire({
        title: `Detail Review Magang #${detail?.id || id}`,
        width: 860,
        confirmButtonText: "Tutup",
        html: `
          <div style="text-align:left;font-size:14px;line-height:1.55;color:#24345e;">
            <p style="margin-bottom:10px;color:#52638d;">
              Form ini masuk ke antrean dosen pengawas magang. Beri keputusan setelah data perusahaan, posisi, dan dokumen pendukung sesuai.
            </p>
            <table style="width:100%;border-collapse:collapse;border:1px solid #e4e9f6;border-radius:10px;overflow:hidden;">
              <tbody>${fieldsHtml}</tbody>
            </table>
            <h4 style="margin:16px 0 8px;color:#1b274b;font-size:15px;">Timeline Workflow</h4>
            ${getMagangTimelineHtml(detail)}
          </div>
        `,
      });
    } catch (detailError) {
      if (detailError?.message !== "__SESSION_EXPIRED__") {
        showErrorToast(detailError.message || "Gagal memuat detail review magang.");
      }
    } finally {
      setMagangReviewActionId(null);
    }
  };

  const handleMagangReviewDecision = async (row, decision) => {
    const id = row?.id;
    if (!id) {
      showErrorToast("Data review magang tidak valid.");
      return;
    }

    const isApprove = decision === "approve";
    const result = await Swal.fire({
      title: isApprove ? "Setujui pengajuan magang?" : "Tolak pengajuan magang?",
      text: isApprove
        ? "Pengajuan akan disetujui oleh dosen pengawas magang."
        : "Mahasiswa akan melihat alasan penolakan ini.",
      input: "textarea",
      inputPlaceholder: isApprove ? "Catatan persetujuan (opsional)" : "Alasan penolakan",
      showCancelButton: true,
      confirmButtonText: isApprove ? "Setujui" : "Tolak",
      cancelButtonText: "Batal",
      confirmButtonColor: isApprove ? "#137748" : "#b73a3a",
      inputValidator: (value) => {
        const note = String(value || "").trim();
        if (!isApprove && !note) return "Alasan penolakan wajib diisi.";
        return undefined;
      },
    });
    if (!result.isConfirmed) return;

    setMagangReviewActionId(id);
    try {
      await fetchWithAuth(`/api/dosen/non-penelitian/magang/reviews/${id}/${isApprove ? "approve" : "reject"}`, {
        method: "POST",
        body: JSON.stringify({ keterangan: String(result.value || "").trim() }),
      });
      showSuccessToast(isApprove ? "Pengajuan magang berhasil disetujui." : "Pengajuan magang berhasil ditolak.");
      await loadAllData();
    } catch (decisionError) {
      if (decisionError?.message !== "__SESSION_EXPIRED__") {
        showErrorToast(decisionError.message || "Gagal memproses keputusan review magang.");
      }
    } finally {
      setMagangReviewActionId(null);
    }
  };

  const handlePengampuReviewQueryChange = (jalur, value) => {
    if (!jalur) return;
    setPengampuReviewQueryByJalur((prev) => ({ ...prev, [jalur]: value }));
    setPengampuReviewPageByJalur((prev) => ({ ...prev, [jalur]: 1 }));
  };

  const handleSetPengampuReviewPage = (jalur, updater) => {
    if (!jalur) return;
    setPengampuReviewPageByJalur((prev) => {
      const currentPage = prev[jalur] || 1;
      const nextPage = typeof updater === "function" ? updater(currentPage) : updater;
      return { ...prev, [jalur]: nextPage };
    });
  };

  const handleOpenPengampuReviewDetail = async (id, config) => {
    if (!id || !config?.endpointSlug) {
      showErrorToast("Data review tidak valid.");
      return;
    }

    const actionKey = `${config.jalur}-${id}`;
    setPengampuReviewActionId(actionKey);
    try {
      const detail = await fetchWithAuth(`/api/dosen/non-penelitian/${config.endpointSlug}/reviews/${id}`);
      const fieldsHtml = getPengampuReviewDetailFields(detail, config)
        .map(
          ([label, value]) => `
            <tr>
              <td style="width:220px;padding:8px 10px;border-bottom:1px solid #edf2fb;color:#52638d;font-weight:700;vertical-align:top;">${escapeHtml(label)}</td>
              <td style="padding:8px 10px;border-bottom:1px solid #edf2fb;color:#203665;vertical-align:top;">${escapeHtml(
                formatMagangPayloadValue(value)
              )}</td>
            </tr>
          `
        )
        .join("");

      await Swal.fire({
        title: `Detail ${config.title} #${detail?.id || id}`,
        width: 820,
        confirmButtonText: "Tutup",
        html: `
          <div style="text-align:left;font-size:14px;line-height:1.55;color:#24345e;">
            <p style="margin-bottom:10px;color:#52638d;">
              Form ini masuk ke antrean ${escapeHtml(config.title.toLowerCase())}. Beri keputusan setelah ringkasan dan catatan mahasiswa sudah sesuai.
            </p>
            <table style="width:100%;border-collapse:collapse;border:1px solid #e4e9f6;border-radius:10px;overflow:hidden;">
              <tbody>${fieldsHtml}</tbody>
            </table>
            <h4 style="margin:16px 0 8px;color:#1b274b;font-size:15px;">Timeline Workflow</h4>
            ${getMagangTimelineHtml(detail)}
          </div>
        `,
      });
    } catch (detailError) {
      if (detailError?.message !== "__SESSION_EXPIRED__") {
        showErrorToast(detailError.message || `Gagal memuat detail ${config.title.toLowerCase()}.`);
      }
    } finally {
      setPengampuReviewActionId(null);
    }
  };

  const handlePengampuReviewDecision = async (row, config, decision) => {
    const id = row?.id;
    if (!id || !config?.endpointSlug) {
      showErrorToast("Data review tidak valid.");
      return;
    }

    const isApprove = decision === "approve";
    const result = await Swal.fire({
      title: isApprove ? `Setujui ${config.title.toLowerCase()}?` : `Tolak ${config.title.toLowerCase()}?`,
      text: isApprove
        ? "Pengajuan akan disetujui oleh dosen pengampu."
        : "Mahasiswa akan melihat alasan penolakan ini.",
      input: "textarea",
      inputPlaceholder: isApprove ? "Catatan persetujuan (opsional)" : "Alasan penolakan",
      showCancelButton: true,
      confirmButtonText: isApprove ? "Setujui" : "Tolak",
      cancelButtonText: "Batal",
      confirmButtonColor: isApprove ? "#137748" : "#b73a3a",
      inputValidator: (value) => {
        const note = String(value || "").trim();
        if (!isApprove && !note) return "Alasan penolakan wajib diisi.";
        return undefined;
      },
    });
    if (!result.isConfirmed) return;

    const actionKey = `${config.jalur}-${id}`;
    setPengampuReviewActionId(actionKey);
    try {
      await fetchWithAuth(`/api/dosen/non-penelitian/${config.endpointSlug}/reviews/${id}/${isApprove ? "approve" : "reject"}`, {
        method: "POST",
        body: JSON.stringify({ keterangan: String(result.value || "").trim() }),
      });
      showSuccessToast(isApprove ? config.approveSuccess : config.rejectSuccess);
      await loadAllData();
    } catch (decisionError) {
      if (decisionError?.message !== "__SESSION_EXPIRED__") {
        showErrorToast(decisionError.message || `Gagal memproses keputusan ${config.title.toLowerCase()}.`);
      }
    } finally {
      setPengampuReviewActionId(null);
    }
  };

  const handlePamitApprove = async (id) => {
    try {
      const result = await Swal.fire({
        title: "Setujui pamit?",
        text: "Catatan approval bisa diisi opsional.",
        input: "text",
        inputPlaceholder: "Catatan approval (opsional)",
        showCancelButton: true,
        confirmButtonText: "Setujui",
        cancelButtonText: "Batal",
      });
      if (!result.isConfirmed) return;

      await fetchWithAuth(`/api/dosen/pamit-mahasiswa/${id}/approve`, {
        method: "POST",
        body: JSON.stringify({ keterangan_dospem: result.value || "" }),
      });

      showSuccessToast("Pamit berhasil disetujui.");
      await loadAllData();
    } catch (approveError) {
      if (approveError?.message !== "__SESSION_EXPIRED__") {
        showErrorToast(approveError.message || "Gagal menyetujui pamit.");
      }
    }
  };

  const handlePamitReject = async (id) => {
    try {
      const result = await Swal.fire({
        title: "Tolak pamit",
        text: "Isi alasan penolakan wajib.",
        input: "textarea",
        inputPlaceholder: "Alasan penolakan pamit",
        showCancelButton: true,
        confirmButtonText: "Tolak",
        cancelButtonText: "Batal",
        inputValidator: (value) => (!value?.trim() ? "Alasan penolakan wajib diisi." : undefined),
      });
      if (!result.isConfirmed) return;

      await fetchWithAuth(`/api/dosen/pamit-mahasiswa/${id}/reject`, {
        method: "POST",
        body: JSON.stringify({ keterangan_dospem: result.value.trim() }),
      });

      showSuccessToast("Pamit berhasil ditolak.");
      await loadAllData();
    } catch (rejectError) {
      if (rejectError?.message !== "__SESSION_EXPIRED__") {
        showErrorToast(rejectError.message || "Gagal menolak pamit.");
      }
    }
  };

  const handleOpenIzinLanjutDetail = async (id) => {
    setRowActionLoadingId(id);
    try {
      const detail = await fetchWithAuth(`/api/dosen/permohonan-extend/${id}`);
      const mahasiswa = detail?.mahasiswa || {};
      const periode = detail?.periode || {};
      const dosen = detail?.dosen_pembimbing_skripsi || {};

      await Swal.fire({
        title: `Detail Permohonan Extend #${detail?.id || id}`,
        width: 760,
        confirmButtonText: "Tutup",
        html: `
          <div style="text-align:left;font-size:14px;line-height:1.65;color:#24345e;">
            <p><b>Mahasiswa:</b> ${escapeHtml(mahasiswa.nama)} (${escapeHtml(mahasiswa.nim)})</p>
            <p><b>Email:</b> ${escapeHtml(mahasiswa.email)}</p>
            <p><b>Angkatan:</b> ${escapeHtml(mahasiswa.angkatan)}</p>
            <p><b>Status Jalur Saat Ini:</b> ${escapeHtml(mahasiswa.status_jalur_saat_ini)}</p>
            <hr style="margin:10px 0;border:none;border-top:1px solid #e3e9f8;" />
            <p><b>Semester Penjaluran:</b> Semester ${escapeHtml(
              detail?.semester_penjaluran_ke ?? "-"
            )}</p>
            <p><b>Periode:</b> ${escapeHtml(periode.label_periode || "-")}</p>
            <p><b>Dosen Pembimbing Skripsi:</b> ${escapeHtml(dosen.nama)} (${escapeHtml(
              dosen.nik || "-"
            )})</p>
            <p><b>Status Izin:</b> ${escapeHtml(formatLabel(detail?.status))}</p>
            <p><b>Tanggal Pengajuan:</b> ${escapeHtml(formatDateTime(detail?.tanggal_pengajuan))}</p>
            <p><b>Tanggal Keputusan:</b> ${escapeHtml(formatDateTime(detail?.tanggal_keputusan))}</p>
            <hr style="margin:10px 0;border:none;border-top:1px solid #e3e9f8;" />
            <p><b>Alasan Mahasiswa:</b></p>
            <p style="margin-top:4px;background:#f8fbff;border:1px solid #e6ecf8;border-radius:8px;padding:10px;">
              ${escapeHtml(detail?.alasan_pengajuan)}
            </p>
            <p style="margin-top:10px;"><b>Catatan Dosen:</b></p>
            <p style="margin-top:4px;background:#fff;border:1px solid #e6ecf8;border-radius:8px;padding:10px;">
              ${escapeHtml(detail?.keterangan_dosen || "-")}
            </p>
          </div>
        `,
      });
    } catch (detailError) {
      if (detailError?.message !== "__SESSION_EXPIRED__") {
        showErrorToast(detailError.message || "Gagal memuat detail permohonan extend.");
      }
    } finally {
      setRowActionLoadingId(null);
    }
  };

  const handleApproveIzinLanjut = async (id) => {
    const result = await Swal.fire({
      title: "Setujui permohonan extend?",
      text: "Catatan persetujuan dapat diisi opsional.",
      input: "textarea",
      inputPlaceholder: "Catatan persetujuan (opsional)",
      showCancelButton: true,
      confirmButtonText: "Setujui",
      cancelButtonText: "Batal",
      confirmButtonColor: "#137748",
    });
    if (!result.isConfirmed) return;

    setRowActionLoadingId(id);
    try {
      await fetchWithAuth(`/api/dosen/permohonan-extend/${id}/approve`, {
        method: "POST",
        body: JSON.stringify({
          keterangan_dosen: String(result.value || "").trim(),
        }),
      });
      showSuccessToast("Permohonan extend berhasil disetujui.");
      await loadAllData();
    } catch (approveError) {
      if (approveError?.message !== "__SESSION_EXPIRED__") {
        showErrorToast(approveError.message || "Gagal menyetujui permohonan extend.");
      }
    } finally {
      setRowActionLoadingId(null);
    }
  };

  const handleRejectIzinLanjut = async (id) => {
    const result = await Swal.fire({
      title: "Tolak permohonan extend?",
      text: "Alasan penolakan wajib diisi. Jika ditolak, mahasiswa wajib penjaluran ulang.",
      input: "textarea",
      inputPlaceholder: "Alasan penolakan",
      showCancelButton: true,
      confirmButtonText: "Tolak",
      cancelButtonText: "Batal",
      confirmButtonColor: "#b73a3a",
      inputValidator: (value) => (!value?.trim() ? "Alasan penolakan wajib diisi." : undefined),
    });
    if (!result.isConfirmed) return;

    setRowActionLoadingId(id);
    try {
      await fetchWithAuth(`/api/dosen/permohonan-extend/${id}/reject`, {
        method: "POST",
        body: JSON.stringify({
          keterangan_dosen: result.value.trim(),
        }),
      });
      showSuccessToast("Permohonan extend ditolak. Mahasiswa wajib melakukan penjaluran ulang.");
      await loadAllData();
    } catch (rejectError) {
      if (rejectError?.message !== "__SESSION_EXPIRED__") {
        showErrorToast(rejectError.message || "Gagal menolak permohonan extend.");
      }
    } finally {
      setRowActionLoadingId(null);
    }
  };

  const handleTopikFormChange = (event) => {
    const { name, value } = event.target;
    setTopikForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleTopikApiSubmit = async (event) => {
    event.preventDefault();
    const normalizedCluster = normalizeTopikClusterLabel(topikForm.cluster);
    const payload = {
      kode: topikForm.kode.trim().toUpperCase(),
      judul: topikForm.judul.trim(),
      deskripsi: topikForm.deskripsi.trim(),
      keyword: topikForm.keyword.trim(),
      cluster: normalizedCluster || topikForm.cluster,
    };

    if (!payload.kode || !payload.judul || !payload.keyword || !payload.cluster) {
      showErrorToast("Kode topik, judul, keyword, dan cluster wajib diisi.");
      return;
    }

    if (!allowedTopikClusters.includes(payload.cluster)) {
      showErrorToast(`Cluster yang bisa dipilih hanya: ${allowedTopikClusters.join(", ")}.`);
      return;
    }

    const kodeCluster = resolveTopikClusterFromKode(payload.kode);
    if (!kodeCluster || !kodeCluster.label) {
      showErrorToast("Format kode topik tidak valid. Gunakan prefix: SIRKEL, SIBER, ITSC, atau MVK.");
      return;
    }

    if (kodeCluster.label !== payload.cluster) {
      const expectedCode = TOPIK_CLUSTER_CODE_BY_LABEL[payload.cluster] || payload.cluster;
      showErrorToast(
        `Kode topik ${payload.kode} tidak sesuai dengan cluster ${payload.cluster}. Prefix kode harus ${expectedCode}.`
      );
      return;
    }

    setSavingTopik(true);
    try {
      await fetchWithAuth("/api/topics", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setTopikForm({
        kode: "",
        judul: "",
        deskripsi: "",
        keyword: "",
        cluster: allowedTopikClusters[0] || TOPIK_CLUSTER_OPTIONS[0],
      });
      showSuccessToast("Topik berhasil ditambahkan.");
      await loadAllData();
      setTopikMode("list");
    } catch (createError) {
      if (createError?.message !== "__SESSION_EXPIRED__") {
        showErrorToast(createError.message || "Gagal menambahkan topik.");
      }
    } finally {
      setSavingTopik(false);
    }
  };

  const handleTopikUploadFileChange = (event) => {
    const selectedFile = event.target.files?.[0] || null;
    setTopikUploadFile(selectedFile);
    setUploadTopikResult(null);
    setTopikUploadPreviewPage(1);
  };

  const handleTopikUploadSubmit = async () => {
    if (!topikUploadFile) {
      showErrorToast("Pilih file Excel terlebih dahulu.");
      return;
    }

    setUploadingTopik(true);
    setUploadTopikResult(null);
    try {
      const formData = new FormData();
      formData.append("file", topikUploadFile);

      const response = await fetch(`${apiBaseUrl}/api/admin/upload/topics/preview`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
        body: formData,
      });

      let json = null;
      try {
        json = await response.json();
      } catch (parseError) {
        json = null;
      }

      const uploadMessage = String(json?.message || "");
      const uploadLowerMessage = uploadMessage.toLowerCase();
      const isUploadTokenError =
        uploadLowerMessage.includes("token tidak valid") ||
        uploadLowerMessage.includes("token tidak ditemukan") ||
        uploadLowerMessage.includes("kadaluarsa");

      if (response.status === 401 || (response.status === 403 && isUploadTokenError)) {
        if (!sessionExpiredRef.current) {
          sessionExpiredRef.current = true;
          onSessionExpired?.();
        }
        throw new Error("__SESSION_EXPIRED__");
      }

      if (!response.ok || !json) {
        if (json) {
          setUploadTopikResult(json);
        }
        throw new Error(json?.message || "Upload topik gagal diproses.");
      }

      setUploadTopikResult(json);
      if (json.success) {
        showSuccessToast("Preview topik berhasil dibuat.");
      } else {
        showErrorToast(json.message || "Preview topik selesai dengan kegagalan.");
      }
    } catch (uploadError) {
      if (uploadError?.message !== "__SESSION_EXPIRED__") {
        showErrorToast(uploadError.message || "Gagal memproses preview topik.");
      }
    } finally {
      setUploadingTopik(false);
    }
  };

  const handleSaveUploadedTopik = async () => {
    if (topikUploadValidRows.length === 0) {
      showErrorToast("Belum ada data valid untuk disimpan.");
      return;
    }

    setSavingUploadedTopik(true);
    try {
      await fetchWithAuth("/api/admin/upload/topics/commit", {
        method: "POST",
        body: JSON.stringify({ rows: topikUploadValidRows }),
      });
      showSuccessToast("Topik valid berhasil disimpan ke database.");
      setUploadTopikResult(null);
      setTopikUploadFile(null);
      await loadAllData();
      setTopikMode("list");
    } catch (saveError) {
      if (saveError?.message !== "__SESSION_EXPIRED__") {
        showErrorToast(saveError.message || "Gagal menyimpan topik hasil preview.");
      }
    } finally {
      setSavingUploadedTopik(false);
    }
  };

  const handlePendaftaranApprove = async (id) => {
    setRowActionLoadingId(id);
    try {
      await fetchWithAuth(`/api/sekretaris/pendaftaran/${id}/approve`, {
        method: "POST",
        body: JSON.stringify({ note: "Disetujui oleh sekretaris prodi." }),
      });
      showSuccessToast("Pendaftaran berhasil di-approve.");
      await loadAllData();
    } catch (approveError) {
      if (approveError?.message !== "__SESSION_EXPIRED__") {
        showErrorToast(approveError.message || "Gagal approve pendaftaran.");
      }
    } finally {
      setRowActionLoadingId(null);
    }
  };

  const handleExportPendaftaran = async () => {
    if (!isSekretaris) return;
    setExportingPendaftaran(true);
    try {
      const params = new URLSearchParams();
      const search = pendaftaranSearch.trim();
      if (search) {
        params.set("search", search);
      }

      const selectedAngkatan = String(pendaftaranFilters?.angkatan || "").trim();
      const selectedTahunAkademik = String(pendaftaranFilters?.tahun_akademik || "").trim();
      const selectedSemesterAkademik = String(pendaftaranFilters?.semester_akademik || "").trim();
      const selectedPenjaluran = String(pendaftaranFilters?.penjaluran || "").trim();
      const selectedTipePendaftaran = String(pendaftaranFilters?.tipe_pendaftaran || "").trim();

      if (selectedAngkatan) params.set("angkatan", selectedAngkatan);
      if (selectedTahunAkademik) params.set("tahun_akademik", selectedTahunAkademik);
      if (selectedSemesterAkademik) params.set("semester", selectedSemesterAkademik);
      if (selectedPenjaluran) params.set("penjaluran", selectedPenjaluran);
      if (selectedTipePendaftaran) params.set("tipe_pendaftaran", selectedTipePendaftaran);

      const query = params.toString() ? `?${params.toString()}` : "";

      const response = await fetch(`${apiBaseUrl}/api/sekretaris/pendaftaran/export${query}`, {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
      });

      let exportErrorPayload = null;
      if (!response.ok) {
        try {
          exportErrorPayload = await response.clone().json();
        } catch (parseError) {
          exportErrorPayload = null;
        }
      }

      const exportMessage = String(exportErrorPayload?.message || "");
      const exportLowerMessage = exportMessage.toLowerCase();
      const isExportTokenError =
        exportLowerMessage.includes("token tidak valid") ||
        exportLowerMessage.includes("token tidak ditemukan") ||
        exportLowerMessage.includes("kadaluarsa");

      if (response.status === 401 || (response.status === 403 && isExportTokenError)) {
        if (!sessionExpiredRef.current) {
          sessionExpiredRef.current = true;
          onSessionExpired?.();
        }
        throw new Error("__SESSION_EXPIRED__");
      }

      if (!response.ok) {
        throw new Error(exportErrorPayload?.message || "Export data penjaluran gagal diproses.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `export_pendaftaran_penjaluran_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showSuccessToast("Export data penjaluran berhasil.");
    } catch (exportError) {
      if (exportError?.message !== "__SESSION_EXPIRED__") {
        showErrorToast(exportError.message || "Gagal export data penjaluran.");
      }
    } finally {
      setExportingPendaftaran(false);
    }
  };

  const handlePendaftaranReject = async (id) => {
    const result = await Swal.fire({
      title: "Tolak pendaftaran",
      text: "Isi alasan penolakan.",
      input: "textarea",
      inputPlaceholder: "Alasan penolakan",
      showCancelButton: true,
      confirmButtonText: "Tolak",
      cancelButtonText: "Batal",
      inputValidator: (value) => (!value?.trim() ? "Alasan penolakan wajib diisi." : undefined),
    });
    if (!result.isConfirmed) return;

    setRowActionLoadingId(id);
    try {
      await fetchWithAuth(`/api/sekretaris/pendaftaran/${id}/reject`, {
        method: "POST",
        body: JSON.stringify({ note: result.value.trim() }),
      });
      showSuccessToast("Pendaftaran berhasil ditolak.");
      await loadAllData();
    } catch (rejectError) {
      if (rejectError?.message !== "__SESSION_EXPIRED__") {
        showErrorToast(rejectError.message || "Gagal reject pendaftaran.");
      }
    } finally {
      setRowActionLoadingId(null);
    }
  };

  const handlePeriodeInputChange = (event) => {
    const { name, value } = event.target;
    setPeriodeForm((prev) => ({ ...prev, [name]: value }));
    setPeriodeFormErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const handleExportMahasiswaMaster = async () => {
    if (!(isSekretaris && activeTab === "master-mahasiswa")) return;
    setExportingMahasiswaMaster(true);
    try {
      const params = new URLSearchParams();
      const search = mahasiswaMasterQuery.trim();
      if (search) {
        params.set("search", search);
      }

      const selectedAngkatan = String(mahasiswaMasterFilters?.angkatan || "").trim();
      const selectedSemesterPenjaluran = String(mahasiswaMasterFilters?.semester_penjaluran || "").trim();
      const selectedPeriode = String(mahasiswaMasterFilters?.periode || "").trim();
      const selectedPenjaluran = String(mahasiswaMasterFilters?.penjaluran || "").trim();
      const selectedTipePendaftaran = String(mahasiswaMasterFilters?.tipe_pendaftaran || "").trim();

      if (selectedAngkatan) params.set("angkatan", selectedAngkatan);
      if (selectedSemesterPenjaluran) params.set("semester_penjaluran", selectedSemesterPenjaluran);
      if (selectedPeriode) params.set("periode", selectedPeriode);
      if (selectedPenjaluran) params.set("penjaluran", selectedPenjaluran);
      if (selectedTipePendaftaran) params.set("tipe_pendaftaran", selectedTipePendaftaran);

      const query = params.toString() ? `?${params.toString()}` : "";
      const response = await fetch(`${apiBaseUrl}/api/sekretaris/mahasiswa/master/export${query}`, {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
      });

      let exportErrorPayload = null;
      if (!response.ok) {
        try {
          exportErrorPayload = await response.clone().json();
        } catch (_parseError) {
          exportErrorPayload = null;
        }
      }

      const exportMessage = String(exportErrorPayload?.message || "");
      const exportLowerMessage = exportMessage.toLowerCase();
      const isExportTokenError =
        exportLowerMessage.includes("token tidak valid") ||
        exportLowerMessage.includes("token tidak ditemukan") ||
        exportLowerMessage.includes("kadaluarsa");

      if (response.status === 401 || (response.status === 403 && isExportTokenError)) {
        if (!sessionExpiredRef.current) {
          sessionExpiredRef.current = true;
          onSessionExpired?.();
        }
        throw new Error("__SESSION_EXPIRED__");
      }

      if (!response.ok) {
        throw new Error(exportErrorPayload?.message || "Export master data mahasiswa gagal diproses.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `export_master_mahasiswa_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showSuccessToast("Export master data mahasiswa berhasil.");
    } catch (exportError) {
      if (exportError?.message !== "__SESSION_EXPIRED__") {
        showErrorToast(exportError.message || "Gagal export master data mahasiswa.");
      }
    } finally {
      setExportingMahasiswaMaster(false);
    }
  };

  const validatePeriodeMasterUniqueAssignments = useCallback((formValues) => {
    const duplicatesByField = {};
    const assignedMap = new Map();

    for (const item of PERIODE_MASTER_ALL_FIELDS) {
      const dosenId = Number(formValues?.[item.key]);
      if (!Number.isInteger(dosenId) || dosenId <= 0) continue;
      if (!assignedMap.has(dosenId)) {
        assignedMap.set(dosenId, []);
      }
      assignedMap.get(dosenId).push(item.key);
    }

    for (const fieldKeys of assignedMap.values()) {
      if (fieldKeys.length < 2) continue;
      for (const fieldKey of fieldKeys) {
        duplicatesByField[fieldKey] = "Dosen yang sama tidak boleh dipilih untuk lebih dari satu peran.";
      }
    }

    return duplicatesByField;
  }, []);

  const getPeriodeMasterAssignmentConflict = useCallback(
    (fieldKey, dosenId, formValues = periodeMasterForm) => {
      const parsedDosenId = Number(dosenId);
      if (!Number.isInteger(parsedDosenId) || parsedDosenId <= 0) return null;
      const conflictField = PERIODE_MASTER_ALL_FIELDS.find((item) => {
        if (item.key === fieldKey) return false;
        return Number(formValues?.[item.key]) === parsedDosenId;
      });
      return conflictField || null;
    },
    [periodeMasterForm]
  );

  const handlePeriodeMasterSearchQueryChange = (fieldKey, value) => {
    if (!isPeriodeMasterFormEditable) return;
    setPeriodeMasterSearchQueryByField((prev) => ({ ...prev, [fieldKey]: value }));
    setPeriodeMasterForm((prev) => {
      const selectedId = Number(prev?.[fieldKey]);
      if (!Number.isInteger(selectedId) || selectedId <= 0) return prev;
      const selectedDosen = periodeDosenMap.get(selectedId);
      const selectedLabel = formatPeriodeMasterDosenInputLabel(selectedDosen);
      if (String(value).trim().toLowerCase() === selectedLabel.trim().toLowerCase()) {
        return prev;
      }
      return { ...prev, [fieldKey]: "" };
    });
    setPeriodeMasterErrors((prev) => {
      if (!prev[fieldKey]) return prev;
      const next = { ...prev };
      delete next[fieldKey];
      return next;
    });
  };

  const handlePeriodeMasterSearchFocus = (fieldKey) => {
    if (!isPeriodeMasterFormEditable) return;
    setActivePeriodeMasterSearchField(fieldKey);
  };

  const handlePeriodeMasterSearchBlur = (fieldKey) => {
    window.setTimeout(() => {
      setActivePeriodeMasterSearchField((prev) => (prev === fieldKey ? "" : prev));
    }, 120);
  };

  const handleSelectPeriodeMasterDosen = (fieldKey, dosenValue) => {
    if (!isPeriodeMasterFormEditable) return;
    const parsedId = Number(dosenValue?.id ?? dosenValue);
    if (!Number.isInteger(parsedId) || parsedId <= 0) return;
    const conflictField = getPeriodeMasterAssignmentConflict(fieldKey, parsedId);
    if (conflictField) {
      showErrorToast(`Dosen ini sudah ditugaskan sebagai ${conflictField.label}. Satu dosen hanya boleh memiliki satu tanggung jawab.`);
      return;
    }
    const selectedDosen = typeof dosenValue === "object" && dosenValue
      ? dosenValue
      : periodeDosenMap.get(parsedId);
    const selectedLabel = formatPeriodeMasterDosenInputLabel(selectedDosen);
    setPeriodeMasterForm((prev) => ({ ...prev, [fieldKey]: String(parsedId) }));
    setPeriodeMasterSearchQueryByField((prev) => ({ ...prev, [fieldKey]: selectedLabel }));
    setDebouncedPeriodeMasterSearchQueryByField((prev) => ({ ...prev, [fieldKey]: selectedLabel }));
    setActivePeriodeMasterSearchField("");
    setPeriodeMasterErrors((prev) => {
      if (!prev[fieldKey]) return prev;
      const next = { ...prev };
      delete next[fieldKey];
      return next;
    });
  };

  const getPeriodeMasterCandidateRows = useCallback(
    (fieldKey) => {
      const options = Array.isArray(periodeMasterOptionsByField[fieldKey])
        ? periodeMasterOptionsByField[fieldKey]
        : [];
      if (options.length === 0) return [];

      const currentSelectedId = Number(periodeMasterForm?.[fieldKey]);
      const selectedByOtherFields = new Map();
      for (const item of PERIODE_MASTER_ALL_FIELDS) {
        if (item.key === fieldKey) continue;
        const selectedId = Number(periodeMasterForm?.[item.key]);
        if (Number.isInteger(selectedId) && selectedId > 0) {
          selectedByOtherFields.set(selectedId, item);
        }
      }
      const searchQuery = String(debouncedPeriodeMasterSearchQueryByField?.[fieldKey] || "")
        .trim()
        .toLowerCase();

      return options
        .map((row) => {
          const rowId = Number(row?.id);
          const conflictField = rowId !== currentSelectedId ? selectedByOtherFields.get(rowId) : null;
          return {
            ...row,
            assignment_conflict_field: conflictField?.key || null,
            assignment_conflict_label: conflictField?.label || null,
          };
        })
        .filter((row) => {
          const rowId = Number(row?.id);
          return Number.isInteger(rowId) && rowId > 0;
        })
        .filter((row) => {
          if (!searchQuery) return true;
          const haystack = `${String(row?.nama || "")} ${String(row?.nik || "")}`.toLowerCase();
          return haystack.includes(searchQuery);
        })
        .slice(0, 8);
    },
    [periodeMasterForm, periodeMasterOptionsByField, debouncedPeriodeMasterSearchQueryByField]
  );

  const resetPeriodeMasterFormToSource = useCallback(() => {
    const nextMasterForm = buildPeriodeMasterFormFromSource(periodeMasterSource);
    const nextSearchQuery = buildPeriodeMasterSearchFromSource(periodeMasterSource);
    setPeriodeMasterForm(nextMasterForm);
    setPeriodeMasterSearchQueryByField(nextSearchQuery);
    setDebouncedPeriodeMasterSearchQueryByField(nextSearchQuery);
    setActivePeriodeMasterSearchField("");
    setPeriodeMasterErrors({});
  }, [periodeMasterSource]);

  const handleStartEditPeriodeMaster = () => {
    if (isPeriodeMasterLocked) {
      showErrorToast(periodeMasterLockMessage);
      return;
    }
    setPeriodeMasterErrors({});
    setPeriodeMasterEditMode(true);
  };

  const handleCancelEditPeriodeMaster = () => {
    resetPeriodeMasterFormToSource();
    setPeriodeMasterEditMode(false);
  };

  const handleSavePeriodeMaster = async () => {
    if (!isPeriodeMasterFormEditable) {
      showErrorToast(
        isPeriodeMasterLocked
          ? periodeMasterLockMessage
          : "Klik Edit terlebih dahulu untuk mengubah master data penanggung jawab."
      );
      return;
    }

    const fieldErrors = {};
    PERIODE_MASTER_ALL_FIELDS.forEach((item) => {
      if (!periodeMasterForm[item.key]) {
        fieldErrors[item.key] = `${item.label} wajib dipilih.`;
      }
    });
    const duplicateErrors = validatePeriodeMasterUniqueAssignments(periodeMasterForm);
    Object.assign(fieldErrors, duplicateErrors);

    if (Object.keys(fieldErrors).length > 0) {
      setPeriodeMasterErrors(fieldErrors);
      showErrorToast("Master data penanggung jawab belum valid.");
      return;
    }

    setPeriodeMasterErrors({});
    setSavingPeriodeMaster(true);
    try {
      await fetchWithAuth("/api/sekretaris/periode/master-penanggung-jawab", {
        method: "POST",
        body: JSON.stringify({
          ketua_itsc_dosen_id: Number(periodeMasterForm.ketua_itsc_dosen_id),
          ketua_sirkel_dosen_id: Number(periodeMasterForm.ketua_sirkel_dosen_id),
          ketua_siber_dosen_id: Number(periodeMasterForm.ketua_siber_dosen_id),
          ketua_mvk_dosen_id: Number(periodeMasterForm.ketua_mvk_dosen_id),
          pengawas_magang_dosen_id: Number(periodeMasterForm.pengawas_magang_dosen_id),
          pengawas_pengabdian_dosen_id: Number(periodeMasterForm.pengawas_pengabdian_dosen_id),
          pengawas_perintisan_bisnis_dosen_id: Number(
            periodeMasterForm.pengawas_perintisan_bisnis_dosen_id
          ),
        }),
      });
      showSuccessToast("Master data penanggung jawab berhasil disimpan.");
      await loadAllData();
      setPeriodeMasterEditMode(false);
    } catch (saveError) {
      if (saveError?.message !== "__SESSION_EXPIRED__") {
        if (saveError?.detail && typeof saveError.detail === "object") {
          if (saveError.detail.penanggung_jawab_lock) {
            showErrorToast(saveError.message || periodeMasterLockMessage);
            try {
              await loadAllData();
            } catch (refreshError) {
              if (refreshError?.message === "__SESSION_EXPIRED__") {
                throw refreshError;
              }
            }
            return;
          }
          setPeriodeMasterErrors(saveError.detail);
          return;
        }
        showErrorToast(saveError.message || "Gagal menyimpan master data penanggung jawab.");
      }
    } finally {
      setSavingPeriodeMaster(false);
    }
  };

  const handleToggleMasterDosenKuotaRow = (dosenId) => {
    const parsedId = Number(dosenId);
    if (!Number.isInteger(parsedId) || parsedId <= 0) return;
    setMasterDosenSelectedDosenIds((prev) => {
      const exists = prev.some((item) => Number(item) === parsedId);
      if (exists) {
        return prev.filter((item) => Number(item) !== parsedId);
      }
      return [...prev, parsedId];
    });
  };

  const handleToggleMasterDosenKuotaPage = () => {
    if (pagedMasterDosenKuotaIds.length === 0) return;
    setMasterDosenSelectedDosenIds((prev) => {
      const set = new Set(prev.map((item) => Number(item)));
      if (isMasterDosenKuotaPageAllSelected) {
        pagedMasterDosenKuotaIds.forEach((id) => set.delete(id));
      } else {
        pagedMasterDosenKuotaIds.forEach((id) => set.add(id));
      }
      return [...set];
    });
  };

  const handleSaveMasterDosenKuota = async () => {
    const parsedKuota = Number(masterDosenKuotaValue);
    if (!Number.isInteger(parsedKuota) || parsedKuota < 1) {
      showErrorToast("Kuota bimbingan wajib angka bulat minimal 1.");
      return;
    }

    const selectedIds = [...new Set(masterDosenSelectedDosenIds.map((item) => Number(item)).filter((id) => Number.isInteger(id) && id > 0))];
    if (masterDosenKuotaMode === "selected" && selectedIds.length === 0) {
      showErrorToast("Pilih minimal satu dosen terlebih dahulu.");
      return;
    }

    const selectedSet = new Set(selectedIds);
    const targetRows =
      masterDosenKuotaMode === "all"
        ? masterDosenKuotaRows
        : masterDosenKuotaRows.filter((row) => selectedSet.has(Number(row?.id)));
    const invalidKuotaRows = targetRows
      .map((row) => {
        const sisa = Number(row?.kuota?.sisa || 0);
        const terpakai = Number(row?.kuota?.terpakai || 0);
        const minimalKuota = Math.max(1, sisa, terpakai);
        return {
          nama: row?.nama || row?.kode_dosen || row?.nik || "Dosen",
          minimalKuota,
          sisa,
          terpakai,
        };
      })
      .filter((row) => parsedKuota < row.minimalKuota);

    if (invalidKuotaRows.length > 0) {
      const contoh = invalidKuotaRows[0];
      showErrorToast(
        `Kuota ${parsedKuota} tidak valid. Contoh: ${contoh.nama} minimal ${contoh.minimalKuota} (sisa ${contoh.sisa}, terpakai ${contoh.terpakai}).`
      );
      return;
    }

    const konfirmasi = await Swal.fire({
      title: "Simpan kuota bimbingan?",
      html:
        masterDosenKuotaMode === "all"
          ? `Kuota akan diatur menjadi <b>${parsedKuota}</b> untuk <b>semua dosen</b>.`
          : `Kuota akan diatur menjadi <b>${parsedKuota}</b> untuk <b>${selectedIds.length} dosen terpilih</b>.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Ya, simpan",
      cancelButtonText: "Batal",
      confirmButtonColor: "#117246",
    });
    if (!konfirmasi.isConfirmed) return;

    setSavingMasterDosenKuota(true);
    try {
      const payload = await fetchWithAuth("/api/sekretaris/master-dosen/kuota", {
        method: "PUT",
        body: JSON.stringify({
          mode: masterDosenKuotaMode,
          kuota_bimbingan: parsedKuota,
          dosen_ids: masterDosenKuotaMode === "selected" ? selectedIds : [],
        }),
      });
      showSuccessToast(payload?.message || "Kuota bimbingan berhasil diperbarui.");
      if (masterDosenKuotaMode === "selected") {
        setMasterDosenSelectedDosenIds([]);
      }
      await loadAllData();
    } catch (errorSave) {
      if (errorSave?.message !== "__SESSION_EXPIRED__") {
        showErrorToast(errorSave.message || "Gagal menyimpan kuota bimbingan.");
      }
    } finally {
      setSavingMasterDosenKuota(false);
    }
  };

  const handleOpenPeriode = async () => {
    const fieldErrors = {};
    const masterErrors = {};
    const tahunAkademik = periodeForm.tahun_akademik.trim();
    const tahunRegex = /^\d{4}\/\d{4}$/;

    PERIODE_MASTER_ALL_FIELDS.forEach((item) => {
      if (!periodeMasterForm[item.key]) {
        masterErrors[item.key] = `${item.label} belum diatur di master data.`;
      }
    });
    const duplicateMasterErrors = validatePeriodeMasterUniqueAssignments(periodeMasterForm);
    Object.assign(masterErrors, duplicateMasterErrors);

    if (!tahunAkademik) {
      fieldErrors.tahun_akademik = "Tahun akademik wajib diisi.";
    } else if (!tahunRegex.test(tahunAkademik)) {
      fieldErrors.tahun_akademik = "Gunakan format YYYY/YYYY, contoh 2026/2027.";
    }
    if (!periodeForm.semester) {
      fieldErrors.semester = "Semester wajib dipilih.";
    }
    if (!periodeForm.tanggal_mulai) {
      fieldErrors.tanggal_mulai = "Tanggal mulai wajib diisi.";
    }
    if (!periodeForm.tanggal_selesai) {
      fieldErrors.tanggal_selesai = "Tanggal selesai wajib diisi.";
    }
    if (
      periodeForm.tanggal_mulai &&
      periodeForm.tanggal_selesai &&
      periodeForm.tanggal_mulai > periodeForm.tanggal_selesai
    ) {
      fieldErrors.tanggal_mulai = "Tanggal mulai tidak boleh melewati tanggal selesai.";
      fieldErrors.tanggal_selesai = "Tanggal selesai harus setelah tanggal mulai.";
    }

    if (Object.keys(masterErrors).length > 0) {
      setPeriodeMasterErrors(masterErrors);
      setPeriodeFormErrors(fieldErrors);
      showErrorToast("Periksa validasi master data penanggung jawab terlebih dahulu.");
      return;
    }
    setPeriodeMasterErrors({});

    if (Object.keys(fieldErrors).length > 0) {
      setPeriodeFormErrors(fieldErrors);
      return;
    }
    setPeriodeFormErrors({});

    const ketuaSummary = PERIODE_MASTER_KETUA_FIELDS
      .map((item) => {
        const dosen = periodeDosenMap.get(Number(periodeMasterForm[item.key]));
        return `${item.label}: <b>${dosen?.nama || "-"}</b>`;
      })
      .join("<br>");

    const konfirmasi = await Swal.fire({
      title: "Buka periode ini?",
      html: `
        Periode yang akan dibuka:<br><b>${formatLabel(periodeForm.semester)} ${tahunAkademik}</b><br><br>
        ${ketuaSummary}<br><br>
        Pengawas Magang: <b>${periodeDosenMap.get(Number(periodeMasterForm.pengawas_magang_dosen_id))?.nama || "-"}</b><br>
        Pengampu Pengabdian Masyarakat: <b>${periodeDosenMap.get(Number(periodeMasterForm.pengawas_pengabdian_dosen_id))?.nama || "-"}</b><br>
        Pengampu Perintisan Bisnis: <b>${periodeDosenMap.get(Number(periodeMasterForm.pengawas_perintisan_bisnis_dosen_id))?.nama || "-"}</b>
      `,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Ya, buka periode",
      cancelButtonText: "Batal",
      confirmButtonColor: "#117246",
    });
    if (!konfirmasi.isConfirmed) return;

    setSavingPeriode(true);
    try {
      await fetchWithAuth("/api/sekretaris/periode/open", {
        method: "POST",
        body: JSON.stringify({
          ketua_itsc_dosen_id: Number(periodeMasterForm.ketua_itsc_dosen_id),
          ketua_sirkel_dosen_id: Number(periodeMasterForm.ketua_sirkel_dosen_id),
          ketua_siber_dosen_id: Number(periodeMasterForm.ketua_siber_dosen_id),
          ketua_mvk_dosen_id: Number(periodeMasterForm.ketua_mvk_dosen_id),
          pengawas_magang_dosen_id: Number(periodeMasterForm.pengawas_magang_dosen_id),
          pengawas_pengabdian_dosen_id: Number(periodeMasterForm.pengawas_pengabdian_dosen_id),
          pengawas_perintisan_bisnis_dosen_id: Number(
            periodeMasterForm.pengawas_perintisan_bisnis_dosen_id
          ),
          tahun_akademik: tahunAkademik,
          semester: periodeForm.semester,
          tanggal_mulai: periodeForm.tanggal_mulai || null,
          tanggal_selesai: periodeForm.tanggal_selesai || null,
        }),
      });

      showSuccessToast("Periode berhasil dibuka.");
      setPeriodeForm({ ...PERIODE_FORM_INITIAL });
      setPeriodeFormErrors({});
      await loadAllData();
      setPeriodeMode("list");
    } catch (openError) {
      if (openError?.message !== "__SESSION_EXPIRED__") {
        if (openError?.detail && typeof openError.detail === "object") {
          const nextPeriodeErrors = {};
          const nextMasterErrors = {};
          const masterKeys = new Set([
            ...PERIODE_MASTER_KETUA_FIELDS.map((item) => item.key),
            ...PERIODE_MASTER_JALUR_FIELDS.map((item) => item.key),
          ]);
          Object.entries(openError.detail).forEach(([key, message]) => {
            if (masterKeys.has(key)) {
              nextMasterErrors[key] = message;
            } else {
              nextPeriodeErrors[key] = message;
            }
          });
          setPeriodeFormErrors(nextPeriodeErrors);
          setPeriodeMasterErrors(nextMasterErrors);
          return;
        }
        showErrorToast(openError.message || "Gagal membuka periode.");
      }
    } finally {
      setSavingPeriode(false);
    }
  };

  const loadReadonlyPeriodeRoles = useCallback(
    async (periodeId) => {
      if (!periodeId) {
        setPeriodeReadonlyRoles({ loading: false, rows: [], error: "" });
        return;
      }

      setPeriodeReadonlyRoles({ loading: true, rows: [], error: "" });
      try {
        const payload = await fetchWithAuth(`/api/sekretaris/ketua-klaster?periode_penjaluran_id=${periodeId}`);
        setPeriodeReadonlyRoles({
          loading: false,
          rows: Array.isArray(payload?.rows) ? payload.rows : [],
          error: "",
        });
      } catch (errorLoad) {
        if (errorLoad?.message === "__SESSION_EXPIRED__") {
          throw errorLoad;
        }
        setPeriodeReadonlyRoles({
          loading: false,
          rows: [],
          error: errorLoad?.message || "Gagal memuat data penanggung jawab periode.",
        });
      }
    },
    [fetchWithAuth]
  );

  const handleOpenPeriodeEditor = async (row) => {
    setEditingPeriode(row);
    setPeriodeFormErrors({});
    setPeriodeEditForm({
      tanggal_mulai: toDateInputValue(row?.tanggal_mulai),
      tanggal_selesai: toDateInputValue(row?.tanggal_selesai),
    });
    setPeriodeMode("edit");
    await loadReadonlyPeriodeRoles(row?.id);
  };

  const handlePeriodeEditInputChange = (event) => {
    const { name, value } = event.target;
    setPeriodeEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleUpdatePeriodeTanggal = async () => {
    if (!editingPeriode?.id) return;
    if (
      periodeEditForm.tanggal_mulai &&
      periodeEditForm.tanggal_selesai &&
      periodeEditForm.tanggal_mulai > periodeEditForm.tanggal_selesai
    ) {
      showErrorToast("Tanggal mulai tidak boleh lebih besar dari tanggal selesai.");
      return;
    }

    setSavingPeriode(true);
    try {
      await fetchWithAuth(`/api/sekretaris/periode/${editingPeriode.id}/tanggal`, {
        method: "PATCH",
        body: JSON.stringify({
          tanggal_mulai: periodeEditForm.tanggal_mulai || null,
          tanggal_selesai: periodeEditForm.tanggal_selesai || null,
        }),
      });
      showSuccessToast("Tanggal periode berhasil diperbarui.");
      await loadAllData();
      setPeriodeMode("list");
      setEditingPeriode(null);
      setPeriodeReadonlyRoles({ loading: false, rows: [], error: "" });
    } catch (editError) {
      if (editError?.message !== "__SESSION_EXPIRED__") {
        showErrorToast(editError.message || "Gagal memperbarui tanggal periode.");
      }
    } finally {
      setSavingPeriode(false);
    }
  };

  const handleClosePeriodeFromEditor = async () => {
    if (!editingPeriode?.id || !editingPeriode?.is_active) {
      showErrorToast("Hanya periode aktif yang bisa ditutup.");
      return;
    }

    const konfirmasi = await Swal.fire({
      title: "Tutup periode aktif?",
      html: `Anda akan menutup periode <b>${editingPeriode.label_periode || "-"}</b>.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Ya, tutup periode",
      cancelButtonText: "Batal",
      confirmButtonColor: "#b83a3a",
    });
    if (!konfirmasi.isConfirmed) return;

    setSavingPeriode(true);
    try {
      await fetchWithAuth(`/api/sekretaris/periode/${editingPeriode.id}/close`, {
        method: "POST",
        body: JSON.stringify({}),
      });

      showSuccessToast("Periode pendaftaran berhasil ditutup.");
      await loadAllData();
      setPeriodeMode("list");
      setEditingPeriode(null);
      setPeriodeReadonlyRoles({ loading: false, rows: [], error: "" });
    } catch (closeByIdError) {
      if (closeByIdError?.message !== "__SESSION_EXPIRED__") {
        showErrorToast(closeByIdError.message || "Gagal menutup periode.");
      }
    } finally {
      setSavingPeriode(false);
    }
  };

  const loadKetuaKlasterByPeriode = useCallback(
    async (periodeId) => {
      setKetuaKlasterError("");
      const query = periodeId ? `?periode_penjaluran_id=${periodeId}` : "";
      const payload = await fetchWithAuth(`/api/sekretaris/ketua-klaster${query}`);
      setKetuaKlasterOverview({
        active_periode: payload?.active_periode || null,
        periode_terpilih: payload?.periode_terpilih || null,
        periodes: Array.isArray(payload?.periodes) ? payload.periodes : [],
        rows: Array.isArray(payload?.rows) ? payload.rows : [],
      });
      setKetuaKlasterPeriodeId(payload?.periode_terpilih?.id ? String(payload.periode_terpilih.id) : "");
    },
    [fetchWithAuth]
  );

  useEffect(() => {
    if (!isSekretaris || activeTab !== "ketua-klaster") return;
    loadKetuaKlasterByPeriode(ketuaKlasterPeriodeId || "").catch((errorLoad) => {
      if (errorLoad?.message !== "__SESSION_EXPIRED__") {
        const message = errorLoad.message || "Gagal memuat data ketua klaster.";
        setKetuaKlasterError(message);
      }
    });
  }, [activeTab, isSekretaris, ketuaKlasterPeriodeId, loadKetuaKlasterByPeriode]);

  const handleChangeKetuaKlasterPeriode = async (event) => {
    const value = event.target.value;
    setKetuaKlasterPeriodeId(value);
    try {
      await loadKetuaKlasterByPeriode(value);
    } catch (errorLoad) {
      if (errorLoad?.message !== "__SESSION_EXPIRED__") {
        showErrorToast(errorLoad.message || "Gagal memuat data ketua klaster.");
      }
    }
  };

  const handleKetuaKlasterDraftChange = (klasterId, dosenId) => {
    setKetuaKlasterDraft((prev) => ({
      ...prev,
      [klasterId]: dosenId,
    }));
  };

  const handleSaveKetuaKlaster = async (row) => {
    const selectedDosenId = Number(ketuaKlasterDraft[row.id]);
    const selectedPeriodeId = Number(ketuaKlasterPeriodeId || ketuaKlasterOverview.periode_terpilih?.id);

    if (!Number.isInteger(selectedPeriodeId) || selectedPeriodeId <= 0) {
      showErrorToast("Periode belum dipilih.");
      return;
    }

    if (!Number.isInteger(selectedDosenId) || selectedDosenId <= 0) {
      showErrorToast(`Pilih ketua untuk klaster ${row.kode} terlebih dahulu.`);
      return;
    }

    const selectedDosen = Array.isArray(row.kandidat_dosen)
      ? row.kandidat_dosen.find((item) => item.id === selectedDosenId)
      : null;
    const confirm = await Swal.fire({
      title: "Simpan ketua klaster?",
      html: `Klaster: <b>${row.kode} - ${row.nama}</b><br>Ketua: <b>${selectedDosen?.nama || "-"}</b>`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Ya, simpan",
      cancelButtonText: "Batal",
      confirmButtonColor: "#2f63e3",
    });
    if (!confirm.isConfirmed) return;

    setSavingKetuaKlasterId(row.id);
    try {
      await fetchWithAuth("/api/sekretaris/ketua-klaster/assign", {
        method: "POST",
        body: JSON.stringify({
          periode_penjaluran_id: selectedPeriodeId,
          klaster_id: row.id,
          dosen_id: selectedDosenId,
        }),
      });
      showSuccessToast(`Ketua klaster ${row.kode} berhasil disimpan.`);
      await loadKetuaKlasterByPeriode(selectedPeriodeId);
    } catch (saveError) {
      if (saveError?.message !== "__SESSION_EXPIRED__") {
        showErrorToast(saveError.message || "Gagal menyimpan ketua klaster.");
      }
    } finally {
      setSavingKetuaKlasterId(null);
    }
  };

  const handleActivateDraftPeriode = async () => {
    const selectedId = Number(selectedKetuaPeriode?.id || ketuaKlasterPeriodeId);
    if (!Number.isInteger(selectedId) || selectedId <= 0) {
      showErrorToast("Pilih periode draft terlebih dahulu.");
      return;
    }

    const selectedStatus = String(selectedKetuaPeriode?.status || "").toLowerCase();
    if (selectedStatus === "active") {
      showErrorToast("Periode ini sudah aktif.");
      return;
    }
    if (selectedStatus === "closed") {
      showErrorToast("Periode closed tidak bisa diaktifkan. Buat draft periode baru.");
      return;
    }

    if (ketuaReviewStats.belumTerisi > 0) {
      showErrorToast(
        `Masih ada ${ketuaReviewStats.belumTerisi} klaster tanpa ketua. Lengkapi dulu sebelum aktivasi.`
      );
      return;
    }

    const confirm = await Swal.fire({
      title: "Aktifkan periode ini?",
      html: `Periode: <b>${selectedKetuaPeriode?.label_periode || "-"}</b><br/>Setelah aktif, periode dipakai untuk alur approval klaster.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Ya, aktifkan",
      cancelButtonText: "Batal",
      confirmButtonColor: "#117246",
    });
    if (!confirm.isConfirmed) return;

    setSavingPeriode(true);
    try {
      await fetchWithAuth(`/api/sekretaris/periode/${selectedId}/activate`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      showSuccessToast("Periode berhasil diaktifkan.");
      await loadAllData();
      setPeriodeMode("list");
    } catch (activateError) {
      if (activateError?.message !== "__SESSION_EXPIRED__") {
        showErrorToast(activateError.message || "Gagal mengaktifkan periode.");
      }
    } finally {
      setSavingPeriode(false);
    }
  };

  const mahasiswaMasterFilterPopup = showMahasiswaMasterFilterPanel && typeof document !== "undefined"
    ? createPortal(
        <div
          ref={mahasiswaMasterFilterPopupRef}
          className="fixed z-[120] rounded-xl border border-[#dbe5f8] bg-white shadow-xl"
          style={{
            top: `${mahasiswaMasterFilterPopupLayout.top}px`,
            left: `${mahasiswaMasterFilterPopupLayout.left}px`,
            width: `${mahasiswaMasterFilterPopupLayout.width}px`,
            maxHeight: `${mahasiswaMasterFilterPopupLayout.maxHeight}px`,
          }}
        >
          <div className="border-b border-[#e5ecf9] px-4 py-3">
            <p className="text-base font-bold text-[#1e315f]">Filter Data Mahasiswa</p>
            <p className="text-xs text-[#60709a]">Atur filter bertumpuk, lalu klik Terapkan.</p>
          </div>
          <div
            className="space-y-3 overflow-auto p-3"
            style={{ maxHeight: `${Math.max(160, mahasiswaMasterFilterPopupLayout.maxHeight - 126)}px` }}
          >
            <div className="rounded-lg border border-[#e6ecf8] p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-[#2a4175]">Angkatan</p>
                <button
                  type="button"
                  onClick={() => setMahasiswaMasterFilterDraft((prev) => ({ ...prev, angkatan: "" }))}
                  className="text-xs font-semibold text-[#2f63e3] hover:underline"
                >
                  Reset
                </button>
              </div>
              <select
                value={mahasiswaMasterFilterDraft.angkatan}
                onChange={(event) =>
                  setMahasiswaMasterFilterDraft((prev) => ({
                    ...prev,
                    angkatan: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-[#d3dbef] px-3 py-2 text-sm text-[#23396b] outline-none focus:border-[#2f63e3]"
              >
                <option value="">Semua angkatan</option>
                {mahasiswaMasterFilterOptions.angkatan.map((item) => (
                  <option key={`filter-angkatan-${item}`} value={item}>
                    Angkatan {item}
                  </option>
                ))}
              </select>
            </div>
            <div className="rounded-lg border border-[#e6ecf8] p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-[#2a4175]">Semester Penjaluran</p>
                <button
                  type="button"
                  onClick={() =>
                    setMahasiswaMasterFilterDraft((prev) => ({
                      ...prev,
                      semester_penjaluran: "",
                    }))
                  }
                  className="text-xs font-semibold text-[#2f63e3] hover:underline"
                >
                  Reset
                </button>
              </div>
              <select
                value={mahasiswaMasterFilterDraft.semester_penjaluran}
                onChange={(event) =>
                  setMahasiswaMasterFilterDraft((prev) => ({
                    ...prev,
                    semester_penjaluran: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-[#d3dbef] px-3 py-2 text-sm text-[#23396b] outline-none focus:border-[#2f63e3]"
              >
                <option value="">Semua semester penjaluran</option>
                {mahasiswaMasterFilterOptions.semester_penjaluran.map((item) => (
                  <option key={`filter-semester-penjaluran-${item}`} value={item}>
                    Semester Penjaluran {item}
                  </option>
                ))}
              </select>
            </div>
            <div className="rounded-lg border border-[#e6ecf8] p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-[#2a4175]">Periode Pendaftaran</p>
                <button
                  type="button"
                  onClick={() => setMahasiswaMasterFilterDraft((prev) => ({ ...prev, periode: "" }))}
                  className="text-xs font-semibold text-[#2f63e3] hover:underline"
                >
                  Reset
                </button>
              </div>
              <select
                value={mahasiswaMasterFilterDraft.periode}
                onChange={(event) =>
                  setMahasiswaMasterFilterDraft((prev) => ({
                    ...prev,
                    periode: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-[#d3dbef] px-3 py-2 text-sm text-[#23396b] outline-none focus:border-[#2f63e3]"
              >
                <option value="">Semua periode pendaftaran</option>
                {mahasiswaMasterFilterOptions.periode.map((item) => (
                  <option key={`filter-periode-${item}`} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div className="rounded-lg border border-[#e6ecf8] p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-[#2a4175]">Penjaluran</p>
                <button
                  type="button"
                  onClick={() => setMahasiswaMasterFilterDraft((prev) => ({ ...prev, penjaluran: "" }))}
                  className="text-xs font-semibold text-[#2f63e3] hover:underline"
                >
                  Reset
                </button>
              </div>
              <select
                value={mahasiswaMasterFilterDraft.penjaluran}
                onChange={(event) =>
                  setMahasiswaMasterFilterDraft((prev) => ({
                    ...prev,
                    penjaluran: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-[#d3dbef] px-3 py-2 text-sm text-[#23396b] outline-none focus:border-[#2f63e3]"
              >
                <option value="">Semua penjaluran</option>
                {mahasiswaMasterFilterOptions.penjaluran.map((item) => (
                  <option key={`filter-penjaluran-${item}`} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div className="rounded-lg border border-[#e6ecf8] p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-[#2a4175]">Tipe Pendaftaran</p>
                <button
                  type="button"
                  onClick={() =>
                    setMahasiswaMasterFilterDraft((prev) => ({
                      ...prev,
                      tipe_pendaftaran: "",
                    }))
                  }
                  className="text-xs font-semibold text-[#2f63e3] hover:underline"
                >
                  Reset
                </button>
              </div>
              <select
                value={mahasiswaMasterFilterDraft.tipe_pendaftaran}
                onChange={(event) =>
                  setMahasiswaMasterFilterDraft((prev) => ({
                    ...prev,
                    tipe_pendaftaran: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-[#d3dbef] px-3 py-2 text-sm text-[#23396b] outline-none focus:border-[#2f63e3]"
              >
                <option value="">Semua tipe daftar</option>
                {mahasiswaMasterFilterOptions.tipe_pendaftaran.map((item) => (
                  <option key={`filter-tipe-pendaftaran-${item}`} value={item}>
                    {formatLabel(item)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-[#e5ecf9] px-3 py-3">
            <button
              type="button"
              onClick={() => setMahasiswaMasterFilterDraft({ ...MAHASISWA_MASTER_FILTER_INITIAL })}
              disabled={!hasMahasiswaMasterDraftFilters}
              className="rounded-lg border border-[#d3dbef] px-3 py-2 text-sm font-semibold text-[#27407b] hover:bg-[#f3f6ff] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Reset all
            </button>
            <button
              type="button"
              onClick={handleApplyMahasiswaMasterFilters}
              disabled={!isMahasiswaMasterFilterDraftDirty}
              className="rounded-lg bg-[#2f63e3] px-3 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Terapkan
            </button>
          </div>
        </div>,
        document.body
      )
    : null;

  const pendaftaranFilterPopup = showPendaftaranFilterPanel && typeof document !== "undefined"
    ? createPortal(
        <div
          ref={pendaftaranFilterPopupRef}
          className="fixed z-[120] rounded-xl border border-[#dbe5f8] bg-white shadow-xl"
          style={{
            top: `${pendaftaranFilterPopupLayout.top}px`,
            left: `${pendaftaranFilterPopupLayout.left}px`,
            width: `${pendaftaranFilterPopupLayout.width}px`,
            maxHeight: `${pendaftaranFilterPopupLayout.maxHeight}px`,
          }}
        >
          <div className="border-b border-[#e5ecf9] px-4 py-3">
            <p className="text-base font-bold text-[#1e315f]">Filter Manajemen Penjaluran</p>
            <p className="text-xs text-[#60709a]">Atur filter bertumpuk, lalu klik Terapkan.</p>
          </div>
          <div
            className="space-y-3 overflow-auto p-3"
            style={{ maxHeight: `${Math.max(160, pendaftaranFilterPopupLayout.maxHeight - 126)}px` }}
          >
            <div className="rounded-lg border border-[#e6ecf8] p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-[#2a4175]">Angkatan</p>
                <button
                  type="button"
                  onClick={() => setPendaftaranFilterDraft((prev) => ({ ...prev, angkatan: "" }))}
                  className="text-xs font-semibold text-[#2f63e3] hover:underline"
                >
                  Reset
                </button>
              </div>
              <select
                value={pendaftaranFilterDraft.angkatan}
                onChange={(event) =>
                  setPendaftaranFilterDraft((prev) => ({
                    ...prev,
                    angkatan: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-[#d3dbef] px-3 py-2 text-sm text-[#23396b] outline-none focus:border-[#2f63e3]"
              >
                <option value="">Semua angkatan</option>
                {pendaftaranFilterOptions.angkatan.map((item) => (
                  <option key={`pendaftaran-filter-angkatan-${item}`} value={item}>
                    Angkatan {item}
                  </option>
                ))}
              </select>
            </div>
            <div className="rounded-lg border border-[#e6ecf8] p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-[#2a4175]">Tahun Akademik</p>
                <button
                  type="button"
                  onClick={() => setPendaftaranFilterDraft((prev) => ({ ...prev, tahun_akademik: "" }))}
                  className="text-xs font-semibold text-[#2f63e3] hover:underline"
                >
                  Reset
                </button>
              </div>
              <select
                value={pendaftaranFilterDraft.tahun_akademik}
                onChange={(event) =>
                  setPendaftaranFilterDraft((prev) => ({
                    ...prev,
                    tahun_akademik: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-[#d3dbef] px-3 py-2 text-sm text-[#23396b] outline-none focus:border-[#2f63e3]"
              >
                <option value="">Semua tahun akademik</option>
                {pendaftaranFilterOptions.tahun_akademik.map((item) => (
                  <option key={`pendaftaran-filter-tahun-${item}`} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div className="rounded-lg border border-[#e6ecf8] p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-[#2a4175]">Semester Akademik</p>
                <button
                  type="button"
                  onClick={() => setPendaftaranFilterDraft((prev) => ({ ...prev, semester_akademik: "" }))}
                  className="text-xs font-semibold text-[#2f63e3] hover:underline"
                >
                  Reset
                </button>
              </div>
              <select
                value={pendaftaranFilterDraft.semester_akademik}
                onChange={(event) =>
                  setPendaftaranFilterDraft((prev) => ({
                    ...prev,
                    semester_akademik: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-[#d3dbef] px-3 py-2 text-sm text-[#23396b] outline-none focus:border-[#2f63e3]"
              >
                <option value="">Semua semester akademik</option>
                {pendaftaranFilterOptions.semester_akademik.map((item) => (
                  <option key={`pendaftaran-filter-semester-akademik-${item}`} value={item}>
                    {formatLabel(item)}
                  </option>
                ))}
              </select>
            </div>
            <div className="rounded-lg border border-[#e6ecf8] p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-[#2a4175]">Penjaluran</p>
                <button
                  type="button"
                  onClick={() => setPendaftaranFilterDraft((prev) => ({ ...prev, penjaluran: "" }))}
                  className="text-xs font-semibold text-[#2f63e3] hover:underline"
                >
                  Reset
                </button>
              </div>
              <select
                value={pendaftaranFilterDraft.penjaluran}
                onChange={(event) =>
                  setPendaftaranFilterDraft((prev) => ({
                    ...prev,
                    penjaluran: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-[#d3dbef] px-3 py-2 text-sm text-[#23396b] outline-none focus:border-[#2f63e3]"
              >
                <option value="">Semua penjaluran</option>
                {pendaftaranFilterOptions.penjaluran.map((item) => (
                  <option key={`pendaftaran-filter-penjaluran-${item}`} value={item}>
                    {formatLabel(item)}
                  </option>
                ))}
              </select>
            </div>
            <div className="rounded-lg border border-[#e6ecf8] p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-[#2a4175]">Tipe Pendaftaran</p>
                <button
                  type="button"
                  onClick={() =>
                    setPendaftaranFilterDraft((prev) => ({
                      ...prev,
                      tipe_pendaftaran: "",
                    }))
                  }
                  className="text-xs font-semibold text-[#2f63e3] hover:underline"
                >
                  Reset
                </button>
              </div>
              <select
                value={pendaftaranFilterDraft.tipe_pendaftaran}
                onChange={(event) =>
                  setPendaftaranFilterDraft((prev) => ({
                    ...prev,
                    tipe_pendaftaran: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-[#d3dbef] px-3 py-2 text-sm text-[#23396b] outline-none focus:border-[#2f63e3]"
              >
                <option value="">Semua tipe daftar</option>
                {pendaftaranFilterOptions.tipe_pendaftaran.map((item) => (
                  <option key={`pendaftaran-filter-tipe-${item}`} value={item}>
                    {formatLabel(item)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-[#e5ecf9] px-3 py-3">
            <button
              type="button"
              onClick={() => setPendaftaranFilterDraft({ ...PENDAFTARAN_FILTER_INITIAL })}
              disabled={!hasPendaftaranDraftFilters}
              className="rounded-lg border border-[#d3dbef] px-3 py-2 text-sm font-semibold text-[#27407b] hover:bg-[#f3f6ff] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Reset all
            </button>
            <button
              type="button"
              onClick={handleApplyPendaftaranFilters}
              disabled={!isPendaftaranFilterDraftDirty}
              className="rounded-lg bg-[#2f63e3] px-3 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Terapkan
            </button>
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <div className="h-screen overflow-hidden bg-[#f2f3f7]">
      <header className="fixed inset-x-0 top-0 bg-[#2f63e3] text-white shadow-sm">
        <div className="flex w-full items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-[#f7d13d] p-1.5">
              <BookOpenCheck className="h-7 w-7 text-[#1f3a84]" />
            </div>
            <p className="text-sm font-black tracking-wide">
              {isSekretaris ? "SIMPS UII - DOSEN & SEKRETARIS PRODI" : "SIMPS UII - DOSEN"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div ref={submissionNotificationRef} className="relative">
              <button
                type="button"
                onClick={handleToggleSubmissionNotificationPanel}
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/30 text-white transition hover:bg-white/20"
                title="Notifikasi pengajuan mahasiswa"
                aria-label="Notifikasi pengajuan mahasiswa"
              >
                <Bell className="h-4.5 w-4.5" />
                {unreadSubmissionNotificationCount > 0 ? (
                  <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-[#ff4d4f]" />
                ) : null}
              </button>

              {showSubmissionNotificationPanel ? (
                <div className="absolute right-0 top-12 z-50 w-[360px] rounded-xl border border-[#dbe3f7] bg-white p-3 text-[#1f3260] shadow-xl">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-sm font-black text-[#1f3260]">Notifikasi Pengajuan</p>
                    <span className="rounded-full bg-[#eef3ff] px-2 py-0.5 text-xs font-bold text-[#2f63e3]">
                      {submissionNotificationItems.length}
                    </span>
                  </div>
                  {submissionNotificationItems.length === 0 ? (
                    <div className="rounded-lg border border-[#e6ecf8] bg-[#f8fbff] px-3 py-2 text-xs font-semibold text-[#60709a]">
                      Belum ada pengajuan baru.
                    </div>
                  ) : (
                    <div className="max-h-[320px] space-y-2 overflow-auto pr-1">
                      {submissionNotificationItems.slice(0, 8).map((item) => {
                        const topikCount = getSubmissionTopikCount(item);
                        const deadline = shouldShowTopikReviewCountdown(item)
                          ? getReviewCountdown(item?.review_deadline_at, countdownNowDate)
                          : null;
                        return (
                          <button
                            key={`notif-submission-${item.id}`}
                            type="button"
                            onClick={() => {
                              setShowSubmissionNotificationPanel(false);
                              handleOpenSubmissionReview(item.id).catch(() => {});
                            }}
                            className="w-full rounded-lg border border-[#e6ecf8] bg-white px-3 py-2 text-left transition hover:bg-[#f4f7ff]"
                          >
                            <p className="text-xs font-black text-[#22386f]">
                              {item?.mahasiswa?.nama || "Mahasiswa"} ({item?.mahasiswa?.nim || "-"})
                            </p>
                            <p className="mt-1 text-xs text-[#5d6d96]">
                              {topikCount > 0 ? `${topikCount} topik` : formatLabel(item?.tipe_pengajuan)} •{" "}
                              {formatDateTime(item?.diajukan_pada || item?.diperbarui_pada)}
                            </p>
                            {deadline?.has_deadline ? (
                              <p
                                className={`mt-1 text-[11px] font-semibold ${
                                  deadline.is_expired ? "text-[#b73a3a]" : "text-[#31559f]"
                                }`}
                              >
                                {deadline.is_expired ? "Batas review terlewati." : `Sisa review: ${deadline.label}`}
                              </p>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
            <UserCircle2 className="h-7 w-7 text-[#dde7ff]" />
            <div className="text-right">
              <p className="text-sm font-bold">{session.user?.nama}</p>
              <p className="text-xs text-[#d4e1ff]">{session.user?.username}</p>
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
        <div className="grid h-full grid-cols-1 gap-4 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="h-full rounded-xl border border-[#dce4f7] bg-white p-2 shadow-sm lg:overflow-y-auto">
            <p className="px-3 pb-2 pt-1 text-xs font-bold uppercase tracking-[0.08em] text-[#7d89a8]">Navigasi</p>
            <div className="space-y-3">
              {navSections.map((section) => (
                <div key={`nav-section-${section.key}`}>
                  <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#8a96b5]">
                    {section.label}
                  </p>
                  <div className="space-y-1">
                    {(section.items || []).map((item) => {
                      const Icon = item.icon;
                      const isActive = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setActiveTab(item.id)}
                          className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition ${
                            isActive ? "bg-[#2f63e3] text-white" : "text-[#405070] hover:bg-[#f2f6ff]"
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={loadAllData}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#d3dbef] bg-white px-4 py-2 text-sm font-semibold text-[#2b3f74] transition hover:bg-[#f2f6ff]"
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh Data
            </button>
          </aside>

          <main
            className={`min-w-0 pr-1 ${
              useGridViewportLayout
                ? "flex h-full flex-col gap-4 overflow-y-auto"
                : "space-y-4 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            }`}
            style={{ msOverflowStyle: "none", overflowAnchor: "none" }}
          >
            <MenuSectionHeader
              icon={activeTabHeader.icon}
              title={activeTabHeader.title}
              subtitle={activeTabHeader.subtitle}
            />

            {activeTab === "dashboard" ? (
              <section className="grid grid-cols-1 gap-4 lg:grid-cols-4">
                <div className="rounded-xl border border-[#dae6ff] bg-white p-4 shadow-sm">
                  <p className="text-sm font-semibold text-[#4e5e86]">Total Pengajuan</p>
                  <p className="mt-2 text-2xl font-black text-[#1b274b]">{summary.totalSubmissions}</p>
                </div>
                <div className="rounded-xl border border-[#ffe8c4] bg-white p-4 shadow-sm">
                  <p className="text-sm font-semibold text-[#4e5e86]">Pending Review</p>
                  <p className="mt-2 text-2xl font-black text-[#1b274b]">{summary.pendingSubmissions}</p>
                </div>
                <div className="rounded-xl border border-[#dff3ec] bg-white p-4 shadow-sm">
                  <p className="text-sm font-semibold text-[#4e5e86]">Pamit Pending</p>
                  <p className="mt-2 text-2xl font-black text-[#1b274b]">{summary.pendingPamit}</p>
                </div>
                <div className="rounded-xl border border-[#e3e8f7] bg-white p-4 shadow-sm">
                  <p className="text-sm font-semibold text-[#4e5e86]">Kuota Bimbingan</p>
                  <p className="mt-2 text-2xl font-black text-[#1b274b]">
                    {summary.kuotaTerpakai}/{summary.kuotaTotal}
                  </p>
                  <p className="mt-1 text-sm text-[#5d6c91]">Sisa: {summary.kuotaSisa}</p>
                </div>
              </section>
            ) : null}

            {loading ? (
              <div className="rounded-xl border border-[#dce4f7] bg-white p-4 text-sm font-semibold text-[#55658f] shadow-sm">
                Memuat data dashboard...
              </div>
            ) : null}

            {error ? (
              <div className="rounded-xl border border-[#f6d7d7] bg-[#fff2f2] p-4 text-sm font-semibold text-[#a03f3f]">
                {error}
              </div>
            ) : null}

            {!loading && activeTab === "dashboard" ? (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <div className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                  <h3 className="mb-3 text-lg font-black text-[#1b274b]">Ringkasan Topik</h3>
                  <p className="text-sm text-[#51608a]">Jumlah topik yang Anda kelola saat ini:</p>
                  <p className="mt-2 text-3xl font-black text-[#1b274b]">{summary.topikAktif}</p>
                </div>
                <div className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                  <h3 className="mb-3 text-lg font-black text-[#1b274b]">Info Kuota</h3>
                  <div className="space-y-2 text-sm text-[#2a3c66]">
                    <p>
                      <span className="font-bold">Dosen:</span> {kuotaData?.dosen?.nama || "-"}
                    </p>
                    <p>
                      <span className="font-bold">NIK:</span> {kuotaData?.dosen?.nik || "-"}
                    </p>
                    <p>
                      <span className="font-bold">Total Kuota:</span> {summary.kuotaTotal}
                    </p>
                    <p>
                      <span className="font-bold">Terpakai:</span> {summary.kuotaTerpakai}
                    </p>
                    <p>
                      <span className="font-bold">Sisa:</span> {summary.kuotaSisa}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {!loading &&
            ((isSekretaris && activeTab === "master-mahasiswa") || activeTab === "mahasiswa-bimbingan") ? (
              <div className="flex min-h-0 flex-1 flex-col gap-4">
                <div className="rounded-xl border border-[#e4e9f6] bg-white p-3 shadow-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={loadAllData}
                      className="inline-flex items-center gap-2 rounded-lg border border-[#d3dbef] px-3 py-2 text-sm font-semibold text-[#27407b] hover:bg-[#f3f6ff]"
                    >
                      <RefreshCcw className="h-4 w-4" />
                      Refresh
                    </button>
                    {isSekretaris && activeTab === "master-mahasiswa" ? (
                      <button
                        type="button"
                        onClick={handleExportMahasiswaMaster}
                        disabled={exportingMahasiswaMaster}
                        className="inline-flex items-center gap-2 rounded-lg bg-[#0f7b50] px-3 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Download className="h-4 w-4" />
                        {exportingMahasiswaMaster ? "Exporting..." : "Download Excel"}
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-black text-[#1b274b]">
                        {activeTab === "mahasiswa-bimbingan"
                          ? "Grid Mahasiswa Bimbingan Dosen"
                          : "Grid Master Data Mahasiswa"}
                      </h3>
                      <p className="text-sm text-[#5d6c91]">
                        {activeTab === "mahasiswa-bimbingan"
                          ? "Menampilkan histori penjaluran mahasiswa yang saat ini dibimbing oleh dosen yang login."
                          : "Data ini dikelola oleh sekretaris prodi. Dosen dapat melihat histori ini secara baca saja."}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7282a8]" />
                        <input
                          type="text"
                          value={mahasiswaMasterQuery}
                          onChange={(event) => setMahasiswaMasterQuery(event.target.value)}
                          placeholder="Cari NIM, nama, periode, penjaluran, pembimbing..."
                          className="w-[340px] rounded-lg border border-[#d3dbef] py-2 pl-8 pr-3 text-sm outline-none focus:border-[#2f63e3]"
                        />
                      </div>
                      <div className="relative" ref={mahasiswaMasterFilterTriggerRef}>
                        <button
                          type="button"
                          onClick={handleToggleMahasiswaMasterFilterPanel}
                          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                            showMahasiswaMasterFilterPanel || hasMahasiswaMasterActiveFilters
                              ? "border-[#2f63e3] bg-[#eef3ff] text-[#2348a5]"
                              : "border-[#d3dbef] text-[#27407b] hover:bg-[#f3f6ff]"
                          }`}
                        >
                          <SlidersHorizontal className="h-4 w-4" />
                          Filter
                          {hasMahasiswaMasterActiveFilters ? (
                            <span className="rounded-full bg-[#2f63e3] px-1.5 py-0.5 text-xs font-bold leading-none text-white">
                              {mahasiswaMasterActiveFilterChips.length}
                            </span>
                          ) : null}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={handleResetMahasiswaMasterFilters}
                        disabled={!hasMahasiswaMasterActiveFilters}
                        className="rounded-lg border border-[#d3dbef] px-3 py-2 text-sm font-semibold text-[#27407b] hover:bg-[#f3f6ff] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Reset
                      </button>
                    </div>
                  </div>

                  <div className="relative mt-1 overflow-auto rounded-lg border border-[#e6ecf8] bg-white grid-unified-height">
                  <table className="w-full min-w-[2300px] text-left text-sm">
                    <thead>
                      <tr className="border-y border-[#e6ecf8] text-[#4d5e89]">
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">No</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">NIM</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Nama</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Email</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Angkatan</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Status Jalur Saat Ini</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Semester Penjaluran</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Periode Penjaluran</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Tahun Akademik</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Semester Akademik</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Jalur</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Nama Penjaluran</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Pembimbing TA</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">DPA</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Dospem Skripsi</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Status Pendaftaran</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Tanggal Penjaluran</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMahasiswaMasterRows.length > 0
                        ? pagedMahasiswaMasterRows.map((row, index) => (
                            <tr
                              key={`master-mahasiswa-row-${row.mahasiswa_id || row.nim || "x"}-${row.pendaftaran_id || "none"}-${index}`}
                              className="border-b border-[#eff3fb]"
                            >
                              <td className="px-3 py-2">
                                {(mahasiswaMasterPage - 1) * MAHASISWA_MASTER_PAGE_SIZE + index + 1}
                              </td>
                              <td className="px-3 py-2 font-semibold text-[#254080]">{row.nim || "-"}</td>
                              <td className="px-3 py-2">{row.nama || "-"}</td>
                              <td className="px-3 py-2">{row.email || "-"}</td>
                              <td className="px-3 py-2">{row.angkatan || "-"}</td>
                              <td className="px-3 py-2">{row.status_jalur_saat_ini || "-"}</td>
                              <td className="px-3 py-2">
                                {row.semester_penjaluran_aktif || row.semester_penjaluran_ke
                                  ? `Semester ${row.semester_penjaluran_aktif || row.semester_penjaluran_ke}`
                                  : "-"}
                              </td>
                              <td className="px-3 py-2">{row.periode_label || "-"}</td>
                              <td className="px-3 py-2">{row.tahun_akademik || "-"}</td>
                              <td className="px-3 py-2">
                                {row.semester_akademik ? formatLabel(row.semester_akademik) : "-"}
                              </td>
                              <td className="px-3 py-2">{row.jalur ? formatLabel(row.jalur) : "-"}</td>
                              <td className="px-3 py-2">
                                {row.nama_penjaluran ? formatLabel(row.nama_penjaluran) : "-"}
                              </td>
                              <td className="px-3 py-2">{row.pembimbing_ta || "-"}</td>
                              <td className="px-3 py-2">{row.dosen_pembimbing_akademik || "-"}</td>
                              <td className="px-3 py-2">{row.dosen_pembimbing_skripsi || "-"}</td>
                              <td className="px-3 py-2">
                                {row.pendaftaran_status ? formatLabel(row.pendaftaran_status) : "-"}
                              </td>
                              <td className="px-3 py-2">{formatDateTime(row.tanggal_penjaluran)}</td>
                              <td className="px-3 py-2">{formatDateTime(row.updatedAt)}</td>
                            </tr>
                          ))
                        : null}
                    </tbody>
                  </table>
                  {filteredMahasiswaMasterRows.length === 0 ? (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[41px] flex items-center justify-center px-4 text-center text-sm font-semibold text-[#7b88ab]">
                      Data mahasiswa tidak ditemukan.
                    </div>
                  ) : null}
                </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#e8edf8] pt-3">
                  <p className="text-sm text-[#4f5e86]">
                    Menampilkan {mahasiswaMasterRangeStart} - {mahasiswaMasterRangeEnd} dari{" "}
                    {filteredMahasiswaMasterRows.length} data mahasiswa.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setMahasiswaMasterPage((prev) => Math.max(1, prev - 1))}
                      disabled={mahasiswaMasterPage === 1}
                      className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] transition hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Sebelumnya
                    </button>
                    <span className="text-sm font-semibold text-[#314778]">
                      Halaman {mahasiswaMasterPage} / {totalMahasiswaMasterPages}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setMahasiswaMasterPage((prev) =>
                          Math.min(totalMahasiswaMasterPages, prev + 1)
                        )
                      }
                      disabled={mahasiswaMasterPage >= totalMahasiswaMasterPages}
                      className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] transition hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Berikutnya
                    </button>
                  </div>
                </div>
                </div>
              </div>
            ) : null}

            {!loading && activeTab === "bimbingan-review" ? (
              <DosenBimbinganReviewPage
                session={session}
                apiBaseUrl={apiBaseUrl}
                onSessionExpired={onSessionExpired}
                onRefreshParent={loadAllData}
                onModeChange={(isListMode) => setIsBimbinganReviewListMode(Boolean(isListMode))}
              />
            ) : null}

            {!loading && activeTab === "dokumen-sidang-review" ? (
              <DosenDokumenSidangReviewPage
                session={session}
                apiBaseUrl={apiBaseUrl}
                onSessionExpired={onSessionExpired}
              />
            ) : null}

            {!loading && activeTab === "ketersediaan-sidang" ? (
              <DosenSidangKetersediaanPage
                session={session}
                apiBaseUrl={apiBaseUrl}
                onSessionExpired={onSessionExpired}
              />
            ) : null}

            {!loading && isSekretaris && activeTab === "sidang-akhir" ? (
              <SekretarisSidangManagementPage
                session={session}
                apiBaseUrl={apiBaseUrl}
                onSessionExpired={onSessionExpired}
              />
            ) : null}

            {!loading && isSubmissionReviewTabActive ? (
              <div className={submissionMode === "list" ? "flex min-h-0 flex-1 flex-col" : "space-y-4"}>
                {submissionMode === "list" ? (
                  <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <h3 className="text-lg font-black text-[#1b274b]">
                        {activeTab === "ketua-cluster-review"
                          ? "Grid Review Ketua Cluster"
                          : "Grid Pengajuan Mahasiswa"}
                      </h3>
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7282a8]" />
                          <input
                            type="text"
                            value={submissionQuery}
                            onChange={(event) => setSubmissionQuery(event.target.value)}
                            placeholder={
                              activeTab === "ketua-cluster-review"
                                ? "Cari pengajuan ketua cluster..."
                                : "Cari nama, NIM, jumlah topik, status, tahap..."
                            }
                            className="w-[320px] rounded-lg border border-[#d3dbef] py-2 pl-8 pr-3 text-sm outline-none focus:border-[#2f63e3]"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={loadAllData}
                          className="inline-flex items-center gap-2 rounded-lg border border-[#d3dbef] px-3 py-2 text-sm font-semibold text-[#27407b] hover:bg-[#f3f6ff]"
                        >
                          <RefreshCcw className="h-4 w-4" />
                          Refresh
                        </button>
                      </div>
                    </div>

                    <div className="relative mt-1 flex-1 overflow-auto rounded-lg border border-[#e6ecf8] grid-unified-height">
                      <table className="w-full min-w-[1280px] table-fixed text-left text-sm">
                        <colgroup>
                          <col style={{ width: "56px" }} />
                          <col style={{ width: "300px" }} />
                          <col style={{ width: "150px" }} />
                          <col style={{ width: "170px" }} />
                          <col style={{ width: "130px" }} />
                          <col style={{ width: "300px" }} />
                          <col style={{ width: "190px" }} />
                          <col style={{ width: "120px" }} />
                        </colgroup>
                        <thead>
                          <tr className="border-y border-[#e6ecf8] text-[#4d5e89]">
                            <th className="bg-[#f8fbff] px-3 py-2 font-semibold whitespace-nowrap">No</th>
                            <th className="bg-[#f8fbff] px-3 py-2 font-semibold whitespace-nowrap">Nama Mahasiswa</th>
                            <th className="bg-[#f8fbff] px-3 py-2 font-semibold whitespace-nowrap">NIM</th>
                            <th className="bg-[#f8fbff] px-3 py-2 font-semibold whitespace-nowrap">Jumlah Topik</th>
                            <th className="bg-[#f8fbff] px-3 py-2 font-semibold whitespace-nowrap">Status</th>
                            <th className="bg-[#f8fbff] px-3 py-2 font-semibold whitespace-nowrap">Tahap</th>
                            <th className="bg-[#f8fbff] px-3 py-2 font-semibold whitespace-nowrap">Diperbarui</th>
                            <th className="bg-[#f8fbff] px-3 py-2 font-semibold whitespace-nowrap">Aksi</th>
                          </tr>
                        </thead>
                        <tbody>
                            {filteredSubmissions.length > 0
                              ? pagedSubmissions.map((row, index) => {
                                  const nomorUrut = submissionRangeStart + index;
                                  const topikCount = getSubmissionTopikCount(row);
                                  const hasSameDosenBadge = hasSameDosenTopikBadge(row);
                                  const gridStatus = getSubmissionGridStatus(row);
                                  const reviewCountdown =
                                    shouldShowTopikReviewCountdown(row)
                                      ? getReviewCountdown(row.review_deadline_at, countdownNowDate)
                                      : null;

                                  return (
                                    <tr key={`submission-${row.id}`} className="border-b border-[#eff3fb] align-top">
                                      <td className="px-3 py-2 font-semibold text-[#254080] whitespace-nowrap align-top">{nomorUrut}</td>
                                      <td className="px-3 py-2">
                                        <p className="font-semibold text-[#1f2d53] break-words">{row.mahasiswa?.nama || "-"}</p>
                                        <p className="text-xs text-[#61709b]">
                                          Angkatan {row.mahasiswa?.angkatan || "-"} • {formatLabel(row.jenis_jalur)}
                                        </p>
                                      </td>
                                      <td className="px-3 py-2 font-semibold text-[#27407b] whitespace-nowrap align-top">{row.mahasiswa?.nim || "-"}</td>
                                      <td className="px-3 py-2 whitespace-nowrap align-top">
                                        {row.tipe_pengajuan === "topik_dosen" ? (
                                          <div className="flex flex-wrap items-center gap-2">
                                            <span className="inline-flex rounded-full bg-[#edf3ff] px-2.5 py-1 text-xs font-bold text-[#2f63e3]">
                                              {topikCount > 0 ? `${topikCount} Topik` : "0 Topik"}
                                            </span>
                                            {hasSameDosenBadge ? (
                                              <span className="inline-flex rounded-full bg-[#fff4d8] px-2 py-0.5 text-[11px] font-bold text-[#9b6b00]">
                                                Dosen sama
                                              </span>
                                            ) : null}
                                          </div>
                                        ) : (
                                          <span className="text-xs font-semibold text-[#5e6c92]">Judul Mandiri</span>
                                        )}
                                      </td>
                                      <td className="px-3 py-2 whitespace-nowrap align-top">
                                        <span
                                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${getSubmissionStatusBadgeClass(
                                            gridStatus
                                          )}`}
                                        >
                                          {formatLabel(gridStatus)}
                                        </span>
                                      </td>
                                      <td className="px-3 py-2 align-top break-words">
                                        <p className="font-semibold text-[#2a3f74]">{getDosenSubmissionTahapLabel(row)}</p>
                                        {reviewCountdown?.has_deadline ? (
                                          <p
                                            className={`mt-1 text-[11px] font-semibold ${
                                              reviewCountdown.is_expired ? "text-[#b73a3a]" : "text-[#355da8]"
                                            }`}
                                          >
                                            {reviewCountdown.is_expired
                                              ? "Waktu review habis (72 jam)."
                                              : `Sisa review: ${reviewCountdown.label}`}
                                          </p>
                                        ) : null}
                                      </td>
                                      <td className="px-3 py-2 whitespace-nowrap align-top">{formatDateTime(row.diperbarui_pada || row.diajukan_pada)}</td>
                                      <td className="px-3 py-2 whitespace-nowrap align-top">
                                        {row.status === "pending" && row.can_review ? (
                                          <div className="flex items-center gap-2">
                                            <button
                                              type="button"
                                              disabled={loadingSubmissionDetail}
                                              onClick={() => handleOpenSubmissionReview(row.id, "approve")}
                                              className="rounded-md bg-[#137748] px-3 py-1 text-xs font-bold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                                            >
                                              Approve
                                            </button>
                                            <button
                                              type="button"
                                              disabled={loadingSubmissionDetail}
                                              onClick={() => handleOpenSubmissionReview(row.id, "reject")}
                                              className="rounded-md bg-[#b73a3a] px-3 py-1 text-xs font-bold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                                            >
                                              Reject
                                            </button>
                                          </div>
                                        ) : (
                                          <button
                                            type="button"
                                            disabled={loadingSubmissionDetail}
                                            onClick={() => handleOpenSubmissionReview(row.id)}
                                            className="inline-flex items-center gap-1 rounded-md bg-[#2f63e3] px-3 py-1.5 text-xs font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                                          >
                                            <Eye className="h-3.5 w-3.5" />
                                            Detail
                                          </button>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })
                              : null}
                        </tbody>
                      </table>
                      {filteredSubmissions.length === 0 ? (
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[41px] flex items-center justify-center px-4 text-center text-sm font-semibold text-[#7b88ab]">
                          Belum ada pengajuan mahasiswa.
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#e8edf8] pt-3">
                      <p className="text-sm text-[#4f5e86]">
                        Menampilkan {submissionRangeStart} - {submissionRangeEnd} dari{" "}
                        {filteredSubmissions.length} data pengajuan.
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSubmissionPage((prev) => Math.max(1, prev - 1))}
                          disabled={submissionPage === 1}
                          className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] transition hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Sebelumnya
                        </button>
                        <span className="text-sm font-semibold text-[#314778]">
                          Halaman {submissionPage} / {totalSubmissionPages}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setSubmissionPage((prev) => Math.min(totalSubmissionPages, prev + 1))
                          }
                          disabled={submissionPage >= totalSubmissionPages}
                          className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] transition hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Berikutnya
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

                {submissionMode === "review" ? (
                  <div className="flex min-h-0 flex-1 flex-col gap-4">
                    <div className="rounded-xl border border-[#e4e9f6] bg-white p-3 shadow-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={handleBackToSubmissionList}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#d3dbef] text-[#2b3f74] hover:bg-[#f3f7ff]"
                          title="Kembali ke grid pengajuan"
                        >
                          <ArrowLeft className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={handleRefreshSubmissionReview}
                          disabled={loadingSubmissionDetail}
                          className="inline-flex items-center gap-2 rounded-lg border border-[#d3dbef] px-3 py-2 text-sm font-semibold text-[#27407b] hover:bg-[#f3f6ff] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <RefreshCcw className="h-4 w-4" />
                          Refresh
                        </button>
                      </div>
                    </div>

                    <div className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                      <h3 className="text-lg font-black text-[#1b274b]">Detail Pengajuan Mahasiswa</h3>
                      <p className="text-sm text-[#5d6c91]">Lihat detail pengajuan mahasiswa sebelum memberi keputusan.</p>

                      {loadingSubmissionDetail ? (
                        <div className="mt-4 rounded-lg border border-[#e2e9f8] bg-[#f8fbff] p-6 text-center text-sm font-semibold text-[#60709a]">
                          Memuat detail pengajuan...
                        </div>
                      ) : null}

                      {!loadingSubmissionDetail && submissionDetail ? (
                        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
                          <div className="rounded-lg border border-[#e2e9f8] bg-[#f8fbff] p-4">
                            <h4 className="text-sm font-black text-[#1b274b]">Data Mahasiswa</h4>
                            <div className="mt-2 grid grid-cols-1 gap-2 text-sm text-[#324c86]">
                              <p><span className="font-semibold">NIM:</span> {submissionDetail.mahasiswa?.nim || "-"}</p>
                              <p><span className="font-semibold">Nama:</span> {submissionDetail.mahasiswa?.nama || "-"}</p>
                              <p><span className="font-semibold">Email:</span> {submissionDetail.mahasiswa?.email || "-"}</p>
                              <p><span className="font-semibold">Angkatan:</span> {submissionDetail.mahasiswa?.angkatan || "-"}</p>
                            </div>
                          </div>
                          <div className="rounded-lg border border-[#e2e9f8] bg-white p-4">
                            <h4 className="text-sm font-black text-[#1b274b]">Ringkasan Pengajuan</h4>
                            <div className="mt-2 grid grid-cols-1 gap-2 text-sm text-[#324c86]">
                              <p><span className="font-semibold">Jenis Jalur:</span> {formatLabel(submissionDetail.jenis_jalur)}</p>
                              <p><span className="font-semibold">Tipe:</span> {formatLabel(submissionDetail.tipe_pengajuan)}</p>
                              <p><span className="font-semibold">Diajukan:</span> {formatDateTime(submissionDetail.diajukan_pada)}</p>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-[#324c86]">Status:</span>
                                <span
                                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${getSubmissionStatusBadgeClass(
                                    submissionDetail.status
                                  )}`}
                                >
                                  {formatLabel(submissionDetail.status)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    {!loadingSubmissionDetail && submissionDetail ? (
                      <div className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                        <h3 className="text-lg font-black text-[#1b274b]">Detail Topik Diajukan</h3>
                        <p className="text-sm text-[#5d6c91]">
                          Tinjau detail topik atau judul yang dipilih mahasiswa pada pengajuan ini.
                        </p>
                        {submissionDetail.tipe_pengajuan === "topik_dosen" ? (
                          <div className="mt-4 space-y-3">
                                <div className="rounded-lg border border-[#dbe5fb] bg-[#f8fbff] px-3 py-2 text-sm text-[#324c86]">
                                  <p className="font-semibold">
                                    Mahasiswa: {submissionDetail.mahasiswa?.nama || "-"} | NIM: {submissionDetail.mahasiswa?.nim || "-"} |
                                    {" "}Topik{" "}
                                    {submissionReviewFocusedIndex >= 0 ? submissionReviewFocusedIndex + 1 : 1} dari{" "}
                                    {Math.max(1, submissionReviewTopikOptions.length)}
                                  </p>
                                  {submissionReviewTopikOptions.length > 1 && submissionReviewTopikIsSingleDosen ? (
                                    <p className="mt-1 text-xs font-semibold text-[#8a5a00]">
                                      Semua topik berada pada dosen yang sama.
                                    </p>
                                  ) : null}
                                  {shouldShowTopikReviewCountdown(submissionDetail) &&
                                  submissionReviewCountdown.has_deadline ? (
                                    <p
                                      className={`mt-1 text-xs font-semibold ${
                                        submissionReviewCountdown.is_expired ? "text-[#b73a3a]" : "text-[#355da8]"
                                      }`}
                                    >
                                      {submissionReviewCountdown.is_expired
                                        ? "Waktu review 72 jam telah berakhir. Sistem akan memfinalisasi otomatis."
                                        : `Sisa waktu review 72 jam: ${submissionReviewCountdown.label} (batas: ${formatDateTime(
                                            submissionDetail.review_deadline_at
                                          )})`}
                                    </p>
                                  ) : null}
                                </div>

                                {submissionReviewTopikOptions.length > 0 ? (
                                  <div className="overflow-x-auto rounded-lg border border-[#e3e9f8] bg-white p-2">
                                    <div className="flex min-w-max items-stretch gap-2">
                                      {submissionReviewTopikOptions.map((topik, index) => {
                                        const reviewerStatus = String(topik?.reviewer_status || "pending").toLowerCase();
                                        const isDone = reviewerStatus !== "pending";
                                        const isActive =
                                          String(topik?.slot ?? "") === String(submissionReviewTopikFocused?.slot ?? "");
                                        const isLocked =
                                          submissionDetail?.can_review &&
                                          index > submissionReviewMaxUnlockedIndex &&
                                          !submissionShowFinalSummary;
                                        return (
                                          <button
                                            key={`submission-topik-step-${topik.slot}-${topik.kode || "none"}`}
                                            type="button"
                                            disabled={isLocked}
                                            onClick={() => handleOpenSubmissionStepByIndex(index)}
                                            className={`min-w-[190px] rounded-lg border px-3 py-2 text-left text-xs transition ${
                                              isActive
                                                ? "border-[#2f63e3] bg-[#edf3ff]"
                                                : "border-[#dde5f8] bg-white hover:bg-[#f7f9ff]"
                                            } ${isLocked ? "cursor-not-allowed opacity-50" : ""}`}
                                          >
                                            <p className="font-black text-[#27407b]">
                                              Pilihan {topik.slot || index + 1} - {topik.kode || "-"}
                                            </p>
                                            <p className="mt-1 text-[#5d6c91]">
                                              {isDone ? "Selesai" : isLocked ? "Terkunci" : "Sedang diproses"}
                                            </p>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="rounded-lg border border-[#e8ecf8] bg-[#f9fbff] px-3 py-2 text-xs font-semibold text-[#5f6d95]">
                                    Tidak ada topik pilihan untuk ditampilkan.
                                  </div>
                                )}

                                <div className="rounded-lg border border-[#e4e9f6] bg-[#f8fbff] p-3">
                                  <div className="grid grid-cols-1 gap-2 text-sm text-[#2f426f]">
                                    <p><span className="font-semibold">Slot:</span> {submissionReviewTopikFocused?.slot || "-"}</p>
                                    <p><span className="font-semibold">Kode Topik:</span> {submissionReviewTopikFocused?.kode || "-"}</p>
                                    <p><span className="font-semibold">Judul Topik:</span> {submissionReviewTopikFocused?.judul || "-"}</p>
                                    <p><span className="font-semibold">Cluster:</span> {submissionReviewTopikFocused?.cluster || "-"}</p>
                                    <p><span className="font-semibold">Keyword:</span> {submissionReviewTopikFocused?.keyword || "-"}</p>
                                    <p><span className="font-semibold">Dosen:</span> {submissionReviewTopikFocused?.dosen || "-"}</p>
                                    <p>
                                      <span className="font-semibold">Status Slot:</span>{" "}
                                      {formatLabel(submissionReviewTopikFocused?.reviewer_status || "pending")}
                                    </p>
                                  </div>
                                  {shouldShowPembimbingApprovalNote ? (
                                    <div className="mt-3 rounded-lg border border-[#cfe0ff] bg-[#f4f8ff] p-3 text-sm text-[#2f426f]">
                                      <p className="font-black text-[#244279]">
                                        Alasan Approve Dosen Pembimbing
                                      </p>
                                      <p className="mt-1">
                                        <span className="font-semibold">Dosen:</span>{" "}
                                        {submissionReviewPembimbingApproval.approvedByName || submissionReviewTopikFocused?.dosen || "-"}
                                      </p>
                                      <p className="mt-1">
                                        <span className="font-semibold">Catatan approve:</span>{" "}
                                        {submissionReviewPembimbingApproval.note || "-"}
                                      </p>
                                      {submissionReviewPembimbingApproval.decidedAt ? (
                                        <p className="mt-1 text-xs font-semibold text-[#5c6d95]">
                                          Diputuskan: {formatDateTime(submissionReviewPembimbingApproval.decidedAt)}
                                        </p>
                                      ) : null}
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                        ) : (
                          <div className="mt-4 rounded-lg border border-[#e4e9f6] bg-[#f8fbff] p-3">
                            <div className="space-y-2 text-sm text-[#324c86]">
                              {shouldShowTopikReviewCountdown(submissionDetail) &&
                              submissionReviewCountdown.has_deadline ? (
                                <p
                                  className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                                    submissionReviewCountdown.is_expired
                                      ? "border-[#f3c9c9] bg-[#fff5f5] text-[#b73a3a]"
                                      : "border-[#dbe4fa] bg-white text-[#355da8]"
                                  }`}
                                >
                                  {submissionReviewCountdown.is_expired
                                    ? "Waktu review 72 jam telah berakhir. Sistem akan memproses otomatis."
                                    : `Sisa waktu review 72 jam: ${submissionReviewCountdown.label} (batas: ${formatDateTime(
                                        submissionDetail.review_deadline_at
                                      )})`}
                                </p>
                              ) : null}
                              <p><span className="font-semibold">Judul:</span> {submissionDetail.detail_pengajuan?.judul_mandiri || "-"}</p>
                              <p><span className="font-semibold">Cluster:</span> {submissionDetail.detail_pengajuan?.cluster_mandiri || "-"}</p>
                              <p><span className="font-semibold">Deskripsi:</span> {submissionDetail.detail_pengajuan?.deskripsi_mandiri || "-"}</p>
                              <p><span className="font-semibold">Keyword:</span> {submissionDetail.detail_pengajuan?.keyword_mandiri || "-"}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : null}

                    {!loadingSubmissionDetail && submissionDetail ? (
                      <div className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                        {submissionDetail.tipe_pengajuan === "topik_dosen" &&
                        submissionDetail.status === "pending" &&
                        submissionDetail.can_review ? (
                          submissionShowFinalSummary || submissionReviewTopikPendingOptions.length === 0 ? (
                            <>
                              <h4 className="text-sm font-black text-[#1b274b]">Ringkasan Keputusan</h4>
                              <p className="mt-1 text-sm text-[#5d6c91]">
                                Semua slot topik sudah diproses. Silakan review ringkasan sebelum kembali ke grid.
                              </p>
                              <div className="mt-3 space-y-2">
                                {submissionReviewTopikOptions.map((item) => {
                                  const normalizedStatus = String(item?.reviewer_status || "pending").toLowerCase();
                                  const statusLabel =
                                    normalizedStatus === "approved"
                                      ? "Disetujui"
                                      : normalizedStatus === "rejected"
                                      ? "Ditolak"
                                      : formatLabel(normalizedStatus);
                                  const statusClass =
                                    normalizedStatus === "approved"
                                      ? "bg-[#e8f8ef] text-[#127947]"
                                      : normalizedStatus === "rejected"
                                      ? "bg-[#fff0f0] text-[#b73a3a]"
                                      : "bg-[#eef3ff] text-[#2f63e3]";
                                  return (
                                    <div
                                      key={`submission-summary-slot-${item.slot}-${item.kode || "none"}`}
                                      className="rounded-lg border border-[#e4e9f6] bg-[#f8fbff] p-3"
                                    >
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <p className="text-sm font-bold text-[#28417a]">
                                          Pilihan {item.slot || "-"} - {item.kode || "-"}
                                        </p>
                                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClass}`}>
                                          {statusLabel}
                                        </span>
                                      </div>
                                      <p className="mt-1 text-sm text-[#405384]">{item.judul || "-"}</p>
                                      {item?.reviewer_note ? (
                                        <p className="mt-1 text-xs font-semibold text-[#566797]">
                                          Catatan: {item.reviewer_note}
                                        </p>
                                      ) : null}
                                    </div>
                                  );
                                })}
                              </div>
                              <div className="mt-4 flex justify-end">
                                <button
                                  type="button"
                                  onClick={handleBackToSubmissionList}
                                  className="rounded-lg bg-[#2f63e3] px-4 py-2 text-sm font-bold text-white transition hover:brightness-110"
                                >
                                  Kembali ke Grid
                                </button>
                              </div>
                            </>
                          ) : (
                            <>
                              <h3 className="text-lg font-black text-[#1b274b]">Form Keputusan Topik</h3>
                              <p className="mt-1 text-sm text-[#5d6c91]">
                                Anda sedang dalam mode{" "}
                                <span className={submissionDecision === "approve" ? "font-bold text-[#137748]" : "font-bold text-[#b73a3a]"}>
                                  {submissionDecision === "approve" ? "APPROVE" : "REJECT"}
                                </span>
                                {" "}sesuai tombol aksi yang dipilih di grid.
                              </p>

                              <div className="mt-3 rounded-lg border border-[#e4e9f6] bg-[#f8fbff] p-3">
                                <p className="text-sm font-semibold text-[#2f426f]">Keputusan</p>
                                <div className="mt-2">
                                  <span
                                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${
                                      submissionDecision === "approve"
                                        ? "bg-[#e8f8ef] text-[#127947]"
                                        : "bg-[#fff0f0] text-[#b73a3a]"
                                    }`}
                                  >
                                    {submissionDecision === "approve" ? "APPROVE" : "REJECT"}
                                  </span>
                                  <p className="mt-2 text-xs font-semibold text-[#5d6c91]">
                                    Opsi lawan disembunyikan agar keputusan konsisten dengan tombol aksi awal.
                                    Untuk mengganti mode, kembali ke grid lalu pilih tombol aksi lainnya.
                                  </p>
                                </div>
                                <div className="mt-3">
                                  <label className="mb-1 block text-sm font-semibold text-[#344b7f]">
                                    {submissionDecision === "reject" ? "Alasan (wajib untuk tolak)" : "Catatan (opsional)"}
                                  </label>
                                  <textarea
                                    rows={4}
                                    value={submissionKeterangan}
                                    onChange={(event) => setSubmissionKeterangan(event.target.value)}
                                    placeholder={
                                      submissionDecision === "reject"
                                        ? "Isi alasan penolakan topik..."
                                        : "Isi catatan persetujuan topik (opsional)..."
                                    }
                                    className="w-full rounded-lg border border-[#d3dbef] px-3 py-2 text-sm outline-none focus:border-[#2f63e3]"
                                  />
                                </div>
                              </div>

                              <div className="mt-4 flex justify-end">
                                <button
                                  type="button"
                                  disabled={rowActionLoadingId === selectedSubmissionId}
                                  onClick={handleSubmitSubmissionDecision}
                                  className={`rounded-lg px-4 py-2 text-sm font-bold text-white transition ${
                                    submissionDecision === "approve"
                                      ? "bg-[#137748] hover:brightness-110"
                                      : "bg-[#b73a3a] hover:brightness-110"
                                  } disabled:cursor-not-allowed disabled:opacity-60`}
                                >
                                  {rowActionLoadingId === selectedSubmissionId
                                    ? "Memproses..."
                                    : submissionReviewTopikPendingOptions.length > 1
                                    ? submissionDecision === "approve"
                                      ? "Simpan Approve & Lanjut"
                                      : "Simpan Reject & Lanjut"
                                    : submissionDecision === "approve"
                                    ? "Simpan Approve"
                                    : "Simpan Reject"}
                                </button>
                              </div>
                            </>
                          )
                        ) : submissionDetail.status === "pending" && submissionDetail.can_review ? (
                          <>
                            <h4 className="text-sm font-black text-[#1b274b]">Form Keputusan</h4>
                            <p className="mt-1 text-sm text-[#5d6c91]">
                              Mode keputusan aktif:{" "}
                              <span className={submissionDecision === "approve" ? "font-bold text-[#137748]" : "font-bold text-[#b73a3a]"}>
                                {submissionDecision === "approve" ? "Approve Pengajuan" : "Tolak Pengajuan"}
                              </span>
                            </p>
                            <div className="mt-3">
                              <label className="mb-1 block text-sm font-semibold text-[#344b7f]">
                                {submissionDecision === "approve" ? "Catatan Persetujuan" : "Alasan Penolakan"}
                              </label>
                              <textarea
                                rows={4}
                                value={submissionKeterangan}
                                onChange={(event) => setSubmissionKeterangan(event.target.value)}
                                placeholder={
                                  submissionDecision === "approve"
                                    ? "Isi catatan persetujuan..."
                                    : "Isi alasan penolakan..."
                                }
                                className="w-full rounded-lg border border-[#d3dbef] px-3 py-2 text-sm outline-none focus:border-[#2f63e3]"
                              />
                            </div>
                            <div className="mt-4 flex justify-end">
                              <button
                                type="button"
                                disabled={rowActionLoadingId === selectedSubmissionId}
                                onClick={handleSubmitSubmissionDecision}
                                className={`rounded-lg px-4 py-2 text-sm font-bold text-white transition ${
                                  submissionDecision === "approve"
                                    ? "bg-[#137748] hover:brightness-110"
                                    : "bg-[#b73a3a] hover:brightness-110"
                                } disabled:cursor-not-allowed disabled:opacity-60`}
                              >
                                {rowActionLoadingId === selectedSubmissionId
                                  ? "Memproses..."
                                  : submissionDecision === "approve"
                                  ? "Simpan Approve"
                                  : "Simpan Tolak"}
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <h3 className="text-lg font-black text-[#1b274b]">
                              {submissionDetail.status === "pending" ? "Status Review" : "Riwayat Keputusan"}
                            </h3>
                            <p className="mt-1 text-sm text-[#5d6c91]">
                              {submissionDetail.status === "pending"
                                ? "Pantau status review dan sisa waktu keputusan untuk pengajuan ini."
                                : "Lihat jejak keputusan dari dosen pembimbing hingga ketua cluster untuk pengajuan ini."}
                            </p>
                            {submissionDetail.status === "pending" ? (
                              <div className="mt-3 rounded-lg border border-[#e7ecf8] bg-[#f9fbff] px-3 py-2 text-sm font-semibold text-[#5e6d95]">
                                Anda belum bisa memberi keputusan untuk pengajuan ini.
                                {submissionDetail.reviewer_status
                                  ? ` Status reviewer Anda: ${formatLabel(submissionDetail.reviewer_status)}.`
                                  : ""}
                                {submissionReviewCountdown.has_deadline
                                  ? submissionReviewCountdown.is_expired
                                    ? " Batas review 72 jam sudah terlewati."
                                    : ` Sisa waktu review: ${submissionReviewCountdown.label}.`
                                  : ""}
                              </div>
                            ) : null}
                            {submissionDecisionHistory.length > 0 ? (
                              <div className="mt-4 space-y-4">
                                <SubmissionDecisionHistoryGroup
                                  title="Keputusan Dosen Pembimbing"
                                  description="Riwayat approve atau reject dari dosen pemilik topik/calon pembimbing."
                                  rows={submissionDosenDecisionHistory}
                                  emptyMessage="Belum ada keputusan dari dosen pembimbing."
                                  tone="dosen"
                                />
                                <SubmissionDecisionHistoryGroup
                                  title="Keputusan Ketua Cluster"
                                  description="Riwayat keputusan final dari ketua cluster setelah tahap dosen pembimbing."
                                  rows={submissionKetuaClusterDecisionHistory}
                                  emptyMessage="Belum ada keputusan dari ketua cluster."
                                  tone="ketua"
                                />
                              </div>
                            ) : (
                              <div className="mt-3 rounded-lg border border-[#e9edf8] bg-[#f7f9ff] px-3 py-2 text-sm font-semibold text-[#5e6d95]">
                                Belum ada riwayat keputusan untuk pengajuan ini.
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {!loading && activeTab === "magang-review" ? (
              <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black text-[#1b274b]">Grid Review Magang</h3>
                    <p className="mt-1 text-sm text-[#5d6c91]">
                      Hanya menampilkan permintaan surat rekomendasi magang yang masuk ke dosen pengawas magang pada periode aktif.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7282a8]" />
                      <input
                        type="text"
                        value={magangReviewQuery}
                        onChange={(event) => setMagangReviewQuery(event.target.value)}
                        placeholder="Cari nama, NIM, perusahaan, posisi, status..."
                        className="w-[340px] rounded-lg border border-[#d3dbef] py-2 pl-8 pr-3 text-sm outline-none focus:border-[#2f63e3]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={loadAllData}
                      className="inline-flex items-center gap-2 rounded-lg border border-[#d3dbef] px-3 py-2 text-sm font-semibold text-[#27407b] hover:bg-[#f3f6ff]"
                    >
                      <RefreshCcw className="h-4 w-4" />
                      Refresh
                    </button>
                  </div>
                </div>

                <div className="relative mt-1 flex-1 overflow-auto rounded-lg border border-[#e6ecf8] grid-unified-height">
                  <table className="w-full min-w-[1360px] table-fixed text-left text-sm">
                    <colgroup>
                      <col style={{ width: "56px" }} />
                      <col style={{ width: "260px" }} />
                      <col style={{ width: "140px" }} />
                      <col style={{ width: "180px" }} />
                      <col style={{ width: "280px" }} />
                      <col style={{ width: "150px" }} />
                      <col style={{ width: "190px" }} />
                      <col style={{ width: "180px" }} />
                      <col style={{ width: "220px" }} />
                    </colgroup>
                    <thead>
                      <tr className="border-y border-[#e6ecf8] text-[#4d5e89]">
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold whitespace-nowrap">No</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold whitespace-nowrap">Mahasiswa</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold whitespace-nowrap">NIM</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold whitespace-nowrap">Periode</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold whitespace-nowrap">Perusahaan / Institusi</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold whitespace-nowrap">Tipe</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold whitespace-nowrap">Posisi</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold whitespace-nowrap">Status</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold whitespace-nowrap">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMagangReviewRows.length > 0
                        ? pagedMagangReviewRows.map((row, index) => {
                            const nomorUrut = magangReviewRangeStart + index;
                            const status = getMagangReviewStatus(row);
                            const canReview = String(status || "").toLowerCase() === "review_dosen_magang";
                            const isRowBusy = magangReviewActionId === row.id;
                            const proposedPosition = pickMagangPayloadText(row, [
                              "proposed_position_other",
                              "proposed_position",
                            ]);

                            return (
                              <tr key={`magang-review-${row.id}`} className="border-b border-[#eff3fb] align-top">
                                <td className="px-3 py-2 font-semibold text-[#254080] whitespace-nowrap align-top">
                                  {nomorUrut}
                                </td>
                                <td className="px-3 py-2">
                                  <p className="font-semibold text-[#1f2d53] break-words">{row.mahasiswa?.nama || "-"}</p>
                                  <p className="text-xs text-[#61709b]">
                                    Angkatan {row.mahasiswa?.angkatan || "-"} • {row.mahasiswa?.email || "-"}
                                  </p>
                                </td>
                                <td className="px-3 py-2 font-semibold text-[#27407b] whitespace-nowrap align-top">
                                  {row.mahasiswa?.nim || "-"}
                                </td>
                                <td className="px-3 py-2 text-[#2f426f] align-top break-words">
                                  {row.periode?.label_periode || "-"}
                                </td>
                                <td className="px-3 py-2 align-top">
                                  <p className="font-semibold text-[#243968] break-words">{getMagangCompanyName(row)}</p>
                                  <p className="mt-1 text-xs text-[#61709b] break-words">
                                    {pickMagangPayloadText(row, ["complete_address_of_institution"])}
                                  </p>
                                </td>
                                <td className="px-3 py-2 align-top">
                                  <span className="inline-flex rounded-full bg-[#eef3ff] px-2.5 py-1 text-xs font-bold text-[#2f63e3]">
                                    {getMagangCompanyTypeLabel(row)}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-[#2f426f] align-top break-words">
                                  {formatLabel(proposedPosition)}
                                </td>
                                <td className="px-3 py-2 align-top">
                                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${getMagangStatusBadgeClass(status)}`}>
                                    {row.workflow_status_label || formatLabel(status)}
                                  </span>
                                  <p className="mt-1 text-[11px] font-semibold text-[#61709b]">
                                    Dikirim: {formatDateTime(row.submitted_at || row.createdAt)}
                                  </p>
                                </td>
                                <td className="px-3 py-2 align-top">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <button
                                      type="button"
                                      disabled={isRowBusy}
                                      onClick={() => handleOpenMagangReviewDetail(row.id)}
                                      className="inline-flex items-center gap-1 rounded-md bg-[#2f63e3] px-3 py-1.5 text-xs font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                      Detail
                                    </button>
                                    {canReview ? (
                                      <>
                                        <button
                                          type="button"
                                          disabled={isRowBusy}
                                          onClick={() => handleMagangReviewDecision(row, "approve")}
                                          className="rounded-md bg-[#137748] px-3 py-1.5 text-xs font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                          Approve
                                        </button>
                                        <button
                                          type="button"
                                          disabled={isRowBusy}
                                          onClick={() => handleMagangReviewDecision(row, "reject")}
                                          className="rounded-md bg-[#b73a3a] px-3 py-1.5 text-xs font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                          Reject
                                        </button>
                                      </>
                                    ) : null}
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        : null}
                    </tbody>
                  </table>
                  {filteredMagangReviewRows.length === 0 ? (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[41px] flex items-center justify-center px-4 text-center text-sm font-semibold text-[#7b88ab]">
                      Belum ada review magang yang menunggu keputusan.
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#e8edf8] pt-3">
                  <p className="text-sm text-[#4f5e86]">
                    Menampilkan {magangReviewRangeStart} - {magangReviewRangeEnd} dari{" "}
                    {filteredMagangReviewRows.length} data review magang.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setMagangReviewPage((prev) => Math.max(1, prev - 1))}
                      disabled={magangReviewPage === 1}
                      className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] transition hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Sebelumnya
                    </button>
                    <span className="text-sm font-semibold text-[#314778]">
                      Halaman {magangReviewPage} / {totalMagangReviewPages}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setMagangReviewPage((prev) => Math.min(totalMagangReviewPages, prev + 1))
                      }
                      disabled={magangReviewPage >= totalMagangReviewPages}
                      className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] transition hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Berikutnya
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {!loading && activePengampuReviewConfig ? (
              <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black text-[#1b274b]">{activePengampuReviewConfig.gridTitle}</h3>
                    <p className="mt-1 text-sm text-[#5d6c91]">{activePengampuReviewConfig.subtitle}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7282a8]" />
                      <input
                        type="text"
                        value={activePengampuReviewQuery}
                        onChange={(event) =>
                          handlePengampuReviewQueryChange(activePengampuReviewConfig.jalur, event.target.value)
                        }
                        placeholder="Cari nama, NIM, periode, ringkasan, status..."
                        className="w-[360px] rounded-lg border border-[#d3dbef] py-2 pl-8 pr-3 text-sm outline-none focus:border-[#2f63e3]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={loadAllData}
                      className="inline-flex items-center gap-2 rounded-lg border border-[#d3dbef] px-3 py-2 text-sm font-semibold text-[#27407b] hover:bg-[#f3f6ff]"
                    >
                      <RefreshCcw className="h-4 w-4" />
                      Refresh
                    </button>
                  </div>
                </div>

                <div className="relative mt-1 flex-1 overflow-auto rounded-lg border border-[#e6ecf8] grid-unified-height">
                  <table className="w-full min-w-[1300px] table-fixed text-left text-sm">
                    <colgroup>
                      <col style={{ width: "56px" }} />
                      <col style={{ width: "260px" }} />
                      <col style={{ width: "140px" }} />
                      <col style={{ width: "180px" }} />
                      <col style={{ width: "180px" }} />
                      <col style={{ width: "320px" }} />
                      <col style={{ width: "240px" }} />
                      <col style={{ width: "170px" }} />
                      <col style={{ width: "220px" }} />
                    </colgroup>
                    <thead>
                      <tr className="border-y border-[#e6ecf8] text-[#4d5e89]">
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold whitespace-nowrap">No</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold whitespace-nowrap">Mahasiswa</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold whitespace-nowrap">NIM</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold whitespace-nowrap">Periode</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold whitespace-nowrap">Jalur</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold whitespace-nowrap">
                          {activePengampuReviewConfig.summaryLabel}
                        </th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold whitespace-nowrap">
                          {activePengampuReviewConfig.noteLabel}
                        </th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold whitespace-nowrap">Status</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold whitespace-nowrap">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPengampuReviewRows.length > 0
                        ? pagedPengampuReviewRows.map((row, index) => {
                            const nomorUrut = pengampuReviewRangeStart + index;
                            const status = getPengampuReviewStatus(row);
                            const canReview = String(status || "").toLowerCase() === "submitted";
                            const actionKey = `${activePengampuReviewConfig.jalur}-${row.id}`;
                            const isRowBusy = pengampuReviewActionId === actionKey;

                            return (
                              <tr key={`pengampu-review-${activePengampuReviewConfig.jalur}-${row.id}`} className="border-b border-[#eff3fb] align-top">
                                <td className="px-3 py-2 font-semibold text-[#254080] whitespace-nowrap align-top">
                                  {nomorUrut}
                                </td>
                                <td className="px-3 py-2">
                                  <p className="font-semibold text-[#1f2d53] break-words">{row.mahasiswa?.nama || "-"}</p>
                                  <p className="text-xs text-[#61709b]">
                                    Angkatan {row.mahasiswa?.angkatan || "-"} • {row.mahasiswa?.email || "-"}
                                  </p>
                                </td>
                                <td className="px-3 py-2 font-semibold text-[#27407b] whitespace-nowrap align-top">
                                  {row.mahasiswa?.nim || "-"}
                                </td>
                                <td className="px-3 py-2 text-[#2f426f] align-top break-words">
                                  {row.periode?.label_periode || "-"}
                                </td>
                                <td className="px-3 py-2 align-top">
                                  <span className="inline-flex rounded-full bg-[#eef3ff] px-2.5 py-1 text-xs font-bold text-[#2f63e3]">
                                    {formatLabel(row.jalur || activePengampuReviewConfig.jalur)}
                                  </span>
                                </td>
                                <td className="px-3 py-2 align-top">
                                  <p className="line-clamp-3 text-[#243968] break-words">{getPengampuReviewSummary(row)}</p>
                                </td>
                                <td className="px-3 py-2 align-top">
                                  <p className="line-clamp-3 text-[#526184] break-words">{getPengampuReviewNote(row)}</p>
                                </td>
                                <td className="px-3 py-2 align-top">
                                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${getPengampuReviewStatusBadgeClass(status)}`}>
                                    {row.workflow_status_label || formatLabel(status)}
                                  </span>
                                  <p className="mt-1 text-[11px] font-semibold text-[#61709b]">
                                    Dikirim: {formatDateTime(row.submitted_at || row.createdAt)}
                                  </p>
                                </td>
                                <td className="px-3 py-2 align-top">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <button
                                      type="button"
                                      disabled={isRowBusy}
                                      onClick={() => handleOpenPengampuReviewDetail(row.id, activePengampuReviewConfig)}
                                      className="inline-flex items-center gap-1 rounded-md bg-[#2f63e3] px-3 py-1.5 text-xs font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                      Detail
                                    </button>
                                    {canReview ? (
                                      <>
                                        <button
                                          type="button"
                                          disabled={isRowBusy}
                                          onClick={() =>
                                            handlePengampuReviewDecision(row, activePengampuReviewConfig, "approve")
                                          }
                                          className="rounded-md bg-[#137748] px-3 py-1.5 text-xs font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                          Approve
                                        </button>
                                        <button
                                          type="button"
                                          disabled={isRowBusy}
                                          onClick={() =>
                                            handlePengampuReviewDecision(row, activePengampuReviewConfig, "reject")
                                          }
                                          className="rounded-md bg-[#b73a3a] px-3 py-1.5 text-xs font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                          Reject
                                        </button>
                                      </>
                                    ) : null}
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        : null}
                    </tbody>
                  </table>
                  {filteredPengampuReviewRows.length === 0 ? (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[41px] flex items-center justify-center px-4 text-center text-sm font-semibold text-[#7b88ab]">
                      {activePengampuReviewConfig.emptyMessage}
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#e8edf8] pt-3">
                  <p className="text-sm text-[#4f5e86]">
                    Menampilkan {pengampuReviewRangeStart} - {pengampuReviewRangeEnd} dari{" "}
                    {filteredPengampuReviewRows.length} data review.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        handleSetPengampuReviewPage(activePengampuReviewConfig.jalur, (prev) =>
                          Math.max(1, prev - 1)
                        )
                      }
                      disabled={activePengampuReviewPage === 1}
                      className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] transition hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Sebelumnya
                    </button>
                    <span className="text-sm font-semibold text-[#314778]">
                      Halaman {activePengampuReviewPage} / {totalPengampuReviewPages}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        handleSetPengampuReviewPage(activePengampuReviewConfig.jalur, (prev) =>
                          Math.min(totalPengampuReviewPages, prev + 1)
                        )
                      }
                      disabled={activePengampuReviewPage >= totalPengampuReviewPages}
                      className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] transition hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Berikutnya
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {!loading && activeTab === "permohonan-extend" ? (
              <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-lg font-black text-[#1b274b]">Grid Permohonan Extend Penjaluran Semester 3</h3>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7282a8]" />
                      <input
                        type="text"
                        value={izinLanjutQuery}
                        onChange={(event) => setIzinLanjutQuery(event.target.value)}
                        placeholder="Cari ID, NIM, nama, periode, status..."
                        className="w-[320px] rounded-lg border border-[#d3dbef] py-2 pl-8 pr-3 text-sm outline-none focus:border-[#2f63e3]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={loadAllData}
                      className="inline-flex items-center gap-2 rounded-lg border border-[#d3dbef] px-3 py-2 text-sm font-semibold text-[#27407b] hover:bg-[#f3f6ff]"
                    >
                      <RefreshCcw className="h-4 w-4" />
                      Refresh
                    </button>
                  </div>
                </div>

                <div className="relative mt-1 flex-1 overflow-auto rounded-lg border border-[#e6ecf8] grid-unified-height">
                  <table className="w-full min-w-[1400px] text-left text-sm">
                    <thead>
                      <tr className="border-y border-[#e6ecf8] text-[#4d5e89]">
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">ID</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Mahasiswa</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Semester</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Periode</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Alasan Mahasiswa</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Status</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Diajukan</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredIzinLanjutRows.length > 0
                        ? pagedIzinLanjutRows.map((row) => (
                            <tr key={`izin-lanjut-${row.id}`} className="border-b border-[#eff3fb]">
                              <td className="px-3 py-2 font-semibold text-[#254080]">#{row.id}</td>
                              <td className="px-3 py-2">
                                <p className="font-semibold text-[#1f2d53]">{row.mahasiswa?.nama || "-"}</p>
                                <p className="text-xs text-[#61709b]">
                                  {row.mahasiswa?.nim || "-"} | Angkatan {row.mahasiswa?.angkatan || "-"}
                                </p>
                              </td>
                              <td className="px-3 py-2">Semester {row.semester_penjaluran_ke || "-"}</td>
                              <td className="px-3 py-2">{row.periode?.label_periode || "-"}</td>
                              <td className="px-3 py-2">
                                <p className="line-clamp-2 text-[#2f426f]">{row.alasan_pengajuan || "-"}</p>
                              </td>
                              <td className="px-3 py-2">
                                <span
                                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${getSubmissionStatusBadgeClass(
                                    row.status
                                  )}`}
                                >
                                  {formatLabel(row.status)}
                                </span>
                              </td>
                              <td className="px-3 py-2">{formatDateTime(row.tanggal_pengajuan)}</td>
                              <td className="px-3 py-2">
                                {row.status === "pending" ? (
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      disabled={rowActionLoadingId === row.id}
                                      onClick={() => handleApproveIzinLanjut(row.id)}
                                      className="rounded-md bg-[#137748] px-3 py-1 text-xs font-bold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      Approve
                                    </button>
                                    <button
                                      type="button"
                                      disabled={rowActionLoadingId === row.id}
                                      onClick={() => handleRejectIzinLanjut(row.id)}
                                      className="rounded-md bg-[#b73a3a] px-3 py-1 text-xs font-bold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      Tolak
                                    </button>
                                    <button
                                      type="button"
                                      disabled={rowActionLoadingId === row.id}
                                      onClick={() => handleOpenIzinLanjutDetail(row.id)}
                                      className="inline-flex items-center gap-1 rounded-md bg-[#2f63e3] px-3 py-1 text-xs font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                      Detail
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={rowActionLoadingId === row.id}
                                    onClick={() => handleOpenIzinLanjutDetail(row.id)}
                                    className="inline-flex items-center gap-1 rounded-md bg-[#2f63e3] px-3 py-1.5 text-xs font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                    Detail
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))
                        : null}
                    </tbody>
                  </table>
                  {filteredIzinLanjutRows.length === 0 ? (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[41px] flex items-center justify-center px-4 text-center text-sm font-semibold text-[#7b88ab]">
                      Belum ada permintaan permohonan extend semester 3.
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#e8edf8] pt-3">
                  <p className="text-sm text-[#4f5e86]">
                    Menampilkan {izinRangeStart} - {izinRangeEnd} dari {filteredIzinLanjutRows.length} data
                    permohonan.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIzinLanjutPage((prev) => Math.max(1, prev - 1))}
                      disabled={izinLanjutPage === 1}
                      className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] transition hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Sebelumnya
                    </button>
                    <span className="text-sm font-semibold text-[#314778]">
                      Halaman {izinLanjutPage} / {totalIzinLanjutPages}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setIzinLanjutPage((prev) => Math.min(totalIzinLanjutPages, prev + 1))
                      }
                      disabled={izinLanjutPage >= totalIzinLanjutPages}
                      className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] transition hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Berikutnya
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {!loading && activeTab === "pamit" ? (
              <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                <h3 className="mb-3 text-lg font-black text-[#1b274b]">Grid Pamit Mahasiswa</h3>
                <div className="relative mt-1 flex-1 overflow-auto rounded-lg border border-[#e6ecf8] grid-unified-height">
                  <table className="min-w-[1200px] text-left text-sm">
                    <thead>
                      <tr className="border-y border-[#e6ecf8] text-[#4d5e89]">
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">ID</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Mahasiswa</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Status</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Alasan Ulang</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Tanggal</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pamitRows.length > 0
                        ? pagedPamitRows.map((row) => (
                            <tr key={`pamit-${row.id}`} className="border-b border-[#eff3fb]">
                              <td className="px-3 py-2">{row.id}</td>
                              <td className="px-3 py-2">
                                {row.mahasiswa?.nim || "-"} - {row.mahasiswa?.nama || "-"}
                              </td>
                              <td className="px-3 py-2">{formatLabel(row.status_dospem)}</td>
                              <td className="px-3 py-2">{row.alasan_ulang || "-"}</td>
                              <td className="px-3 py-2">{formatDateTime(row.createdAt)}</td>
                              <td className="px-3 py-2">
                                {row.status_dospem === "pending" ? (
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handlePamitApprove(row.id)}
                                      className="rounded-md bg-[#137748] px-3 py-1 text-xs font-bold text-white hover:brightness-110"
                                    >
                                      Approve
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handlePamitReject(row.id)}
                                      className="rounded-md bg-[#b73a3a] px-3 py-1 text-xs font-bold text-white hover:brightness-110"
                                    >
                                      Tolak
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-xs text-[#68779f]">Sudah diproses</span>
                                )}
                              </td>
                            </tr>
                          ))
                        : null}
                    </tbody>
                  </table>
                  {pamitRows.length === 0 ? (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[41px] flex items-center justify-center px-4 text-center text-sm font-semibold text-[#7b88ab]">
                      Belum ada data pamit mahasiswa.
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#e8edf8] pt-3">
                  <p className="text-sm text-[#4f5e86]">
                    Menampilkan {pamitRangeStart} - {pamitRangeEnd} dari {pamitRows.length} data pamit.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPamitPage((prev) => Math.max(1, prev - 1))}
                      disabled={pamitPage === 1}
                      className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] transition hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Sebelumnya
                    </button>
                    <span className="text-sm font-semibold text-[#314778]">
                      Halaman {pamitPage} / {totalPamitPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPamitPage((prev) => Math.min(totalPamitPages, prev + 1))}
                      disabled={pamitPage >= totalPamitPages}
                      className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] transition hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Berikutnya
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {!loading && isSekretaris && activeTab === "master-dosen" ? (
              <div
                className={
                  masterDosenTab === "kuota-bimbingan"
                    ? "space-y-4 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    : "space-y-4 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                }
              >
                <div className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                  <p className="text-lg font-black text-[#1b274b]">Menu Master Dosen</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {MASTER_DOSEN_TAB_OPTIONS.map((item) => (
                      <button
                        key={`master-dosen-tab-${item.key}`}
                        type="button"
                        onClick={() => setMasterDosenTab(item.key)}
                        className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                          masterDosenTab === item.key
                            ? "border-[#2f63e3] bg-[#2f63e3] text-white"
                            : "border-[#d3dbef] text-[#345087] hover:bg-[#f4f7ff]"
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {masterDosenTab === "penanggung-jawab" ? (
                  <div className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                    <div>
                      <p className="text-sm font-black text-[#1b274b]">
                        Master Data Penanggung Jawab Penjaluran
                      </p>
                      <p className="mt-1 text-sm text-[#5d6c91]">
                        Atur ketua cluster dan pembimbing jalur yang akan dipakai otomatis saat periode penjaluran dibuka.
                        Satu dosen hanya boleh memiliki satu tanggung jawab.
                      </p>
                    </div>

                    {isPeriodeMasterLocked ? (
                      <div className="mt-3 rounded-lg border border-[#f0d3a5] bg-[#fff8ec] px-3 py-2 text-sm font-semibold text-[#8a5a14]">
                        {periodeMasterLockMessage}
                      </div>
                    ) : isPeriodeMasterConfigured && !periodeMasterEditMode ? (
                      <div className="mt-3 rounded-lg border border-[#d9e4fb] bg-[#f8fbff] px-3 py-2 text-sm text-[#526184]">
                        Master data sudah tersimpan dan dikunci sebagai read-only. Klik Edit jika memang perlu
                        mengganti penanggung jawab.
                      </div>
                    ) : (
                      <div className="mt-3 rounded-lg border border-[#d9e4fb] bg-[#f8fbff] px-3 py-2 text-sm text-[#526184]">
                        Pilih dosen berbeda untuk setiap tanggung jawab. Dosen yang sudah dipakai di field lain
                        akan tampil nonaktif di hasil pencarian.
                      </div>
                    )}

                    <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
                      {PERIODE_MASTER_KETUA_FIELDS.map((item) => {
                        const selectedId = periodeMasterSelectedDosenIdsByField[item.key];
                        const selectedDosen = selectedId ? periodeDosenMap.get(Number(selectedId)) : null;
                        const selectedLabel = formatPeriodeMasterDosenInputLabel(selectedDosen);
                        const searchValue = String(periodeMasterSearchQueryByField[item.key] || "");
                        const debouncedSearchValue = String(
                          debouncedPeriodeMasterSearchQueryByField[item.key] || ""
                        );
                        const searchResults = getPeriodeMasterCandidateRows(item.key);
                        const shouldShowResults =
                          isPeriodeMasterFormEditable &&
                          activePeriodeMasterSearchField === item.key &&
                          searchValue.trim().length > 0 &&
                          searchValue.trim().toLowerCase() !== selectedLabel.trim().toLowerCase();
                        const isDebouncing =
                          searchValue.trim().length > 0 &&
                          searchValue.trim().toLowerCase() !== debouncedSearchValue.trim().toLowerCase();
                        return (
                          <div
                            key={`master-dosen-ketua-${item.code}`}
                            className="rounded-lg border border-[#e6ecf8] bg-[#fbfcff] p-3"
                          >
                            <label className="mb-1 block text-sm font-semibold text-[#344b7f]">{item.label}</label>
                            <div className="relative">
                              <input
                                type="text"
                                value={searchValue}
                                disabled={!isPeriodeMasterFormEditable}
                                onFocus={() => handlePeriodeMasterSearchFocus(item.key)}
                                onBlur={() => handlePeriodeMasterSearchBlur(item.key)}
                                onChange={(event) =>
                                  handlePeriodeMasterSearchQueryChange(item.key, event.target.value)
                                }
                                placeholder={`Cari nama atau NIK dosen ketua ${item.code}`}
                                className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[#2f63e3] ${
                                  !isPeriodeMasterFormEditable
                                    ? "cursor-not-allowed border-[#d3dbef] bg-[#f7f9ff] text-[#526184]"
                                    : periodeMasterErrors[item.key]
                                    ? "border-[#dc4b4b] bg-[#fff7f7]"
                                    : "border-[#d3dbef]"
                                }`}
                              />
                              {shouldShowResults ? (
                                <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 max-h-44 overflow-auto rounded-lg border border-[#d9e3fb] bg-white shadow-lg">
                                  {isDebouncing ? (
                                    <p className="px-3 py-2 text-xs font-semibold text-[#7282a8]">Mencari...</p>
                                  ) : searchResults.length > 0 ? (
                                    searchResults.map((dosen) => {
                                      const hasConflict = Boolean(dosen.assignment_conflict_field);
                                      return (
                                        <button
                                          key={`master-dosen-ketua-${item.code}-${dosen.id}`}
                                          type="button"
                                          disabled={hasConflict}
                                          onMouseDown={(event) => event.preventDefault()}
                                          onClick={() => handleSelectPeriodeMasterDosen(item.key, dosen)}
                                          className={`flex w-full items-center justify-between gap-3 border-b border-[#edf1fb] px-3 py-2 text-left text-sm last:border-b-0 ${
                                            hasConflict
                                              ? "cursor-not-allowed bg-[#f7f9ff] text-[#93a0bd]"
                                              : "text-[#213460] hover:bg-[#f4f7ff]"
                                          }`}
                                        >
                                          <span className="font-semibold">{dosen.nama || "-"}</span>
                                          <span className="text-right text-xs text-[#5d6c91]">
                                            {hasConflict
                                              ? `Sudah ditugaskan: ${dosen.assignment_conflict_label}`
                                              : `NIK: ${dosen.nik || "-"}`}
                                          </span>
                                        </button>
                                      );
                                    })
                                  ) : (
                                    <p className="px-3 py-2 text-xs font-semibold text-[#7282a8]">
                                      Dosen tidak ditemukan.
                                    </p>
                                  )}
                                </div>
                              ) : null}
                            </div>
                            {periodeMasterErrors[item.key] ? (
                              <p className="mt-1 text-xs font-semibold text-[#c23737]">{periodeMasterErrors[item.key]}</p>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-3">
                      {PERIODE_MASTER_JALUR_FIELDS.map((item) => {
                        const selectedId = periodeMasterSelectedDosenIdsByField[item.key];
                        const selectedDosen = selectedId ? periodeDosenMap.get(Number(selectedId)) : null;
                        const selectedLabel = formatPeriodeMasterDosenInputLabel(selectedDosen);
                        const searchValue = String(periodeMasterSearchQueryByField[item.key] || "");
                        const debouncedSearchValue = String(
                          debouncedPeriodeMasterSearchQueryByField[item.key] || ""
                        );
                        const searchResults = getPeriodeMasterCandidateRows(item.key);
                        const shouldShowResults =
                          isPeriodeMasterFormEditable &&
                          activePeriodeMasterSearchField === item.key &&
                          searchValue.trim().length > 0 &&
                          searchValue.trim().toLowerCase() !== selectedLabel.trim().toLowerCase();
                        const isDebouncing =
                          searchValue.trim().length > 0 &&
                          searchValue.trim().toLowerCase() !== debouncedSearchValue.trim().toLowerCase();
                        return (
                          <div
                            key={`master-dosen-jalur-${item.key}`}
                            className="rounded-lg border border-[#e6ecf8] bg-[#fbfcff] p-3"
                          >
                            <label className="mb-1 block text-sm font-semibold text-[#344b7f]">{item.label}</label>
                            <div className="relative">
                              <input
                                type="text"
                                value={searchValue}
                                disabled={!isPeriodeMasterFormEditable}
                                onFocus={() => handlePeriodeMasterSearchFocus(item.key)}
                                onBlur={() => handlePeriodeMasterSearchBlur(item.key)}
                                onChange={(event) =>
                                  handlePeriodeMasterSearchQueryChange(item.key, event.target.value)
                                }
                                placeholder={`Cari nama atau NIK untuk ${item.label.toLowerCase()}`}
                                className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[#2f63e3] ${
                                  !isPeriodeMasterFormEditable
                                    ? "cursor-not-allowed border-[#d3dbef] bg-[#f7f9ff] text-[#526184]"
                                    : periodeMasterErrors[item.key]
                                    ? "border-[#dc4b4b] bg-[#fff7f7]"
                                    : "border-[#d3dbef]"
                                }`}
                              />
                              {shouldShowResults ? (
                                <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 max-h-44 overflow-auto rounded-lg border border-[#d9e3fb] bg-white shadow-lg">
                                  {isDebouncing ? (
                                    <p className="px-3 py-2 text-xs font-semibold text-[#7282a8]">Mencari...</p>
                                  ) : searchResults.length > 0 ? (
                                    searchResults.map((dosen) => {
                                      const hasConflict = Boolean(dosen.assignment_conflict_field);
                                      return (
                                        <button
                                          key={`master-dosen-${item.key}-${dosen.id}`}
                                          type="button"
                                          disabled={hasConflict}
                                          onMouseDown={(event) => event.preventDefault()}
                                          onClick={() => handleSelectPeriodeMasterDosen(item.key, dosen)}
                                          className={`flex w-full items-center justify-between gap-3 border-b border-[#edf1fb] px-3 py-2 text-left text-sm last:border-b-0 ${
                                            hasConflict
                                              ? "cursor-not-allowed bg-[#f7f9ff] text-[#93a0bd]"
                                              : "text-[#213460] hover:bg-[#f4f7ff]"
                                          }`}
                                        >
                                          <span className="font-semibold">{dosen.nama || "-"}</span>
                                          <span className="text-right text-xs text-[#5d6c91]">
                                            {hasConflict
                                              ? `Sudah ditugaskan: ${dosen.assignment_conflict_label}`
                                              : `NIK: ${dosen.nik || "-"}`}
                                          </span>
                                        </button>
                                      );
                                    })
                                  ) : (
                                    <p className="px-3 py-2 text-xs font-semibold text-[#7282a8]">
                                      Dosen tidak ditemukan.
                                    </p>
                                  )}
                                </div>
                              ) : null}
                            </div>
                            {periodeMasterErrors[item.key] ? (
                              <p className="mt-1 text-xs font-semibold text-[#c23737]">{periodeMasterErrors[item.key]}</p>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-4 flex flex-wrap justify-end gap-2">
                      {isPeriodeMasterConfigured && !periodeMasterEditMode ? (
                        <button
                          type="button"
                          onClick={handleStartEditPeriodeMaster}
                          disabled={savingPeriodeMaster || isPeriodeMasterLocked}
                          className="inline-flex items-center gap-2 rounded-lg border border-[#d3dbef] px-4 py-2 text-sm font-semibold text-[#27407b] transition hover:bg-[#f3f6ff] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Edit
                        </button>
                      ) : (
                        <>
                          {isPeriodeMasterConfigured ? (
                            <button
                              type="button"
                              onClick={handleCancelEditPeriodeMaster}
                              disabled={savingPeriodeMaster}
                              className="inline-flex items-center gap-2 rounded-lg border border-[#d3dbef] px-4 py-2 text-sm font-semibold text-[#27407b] transition hover:bg-[#f3f6ff] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Cancel
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={handleSavePeriodeMaster}
                            disabled={savingPeriodeMaster || !isPeriodeMasterFormEditable}
                            className="inline-flex items-center gap-2 rounded-lg bg-[#2f63e3] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {savingPeriodeMaster ? "Menyimpan..." : "Simpan Master Data"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ) : null}

                {masterDosenTab === "kuota-bimbingan" ? (
                  <>
                    <div className="rounded-xl border border-[#dce4f7] bg-white p-3 shadow-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setMasterDosenTab("penanggung-jawab")}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#d3dbef] text-[#27407b] transition hover:bg-[#f3f6ff]"
                          aria-label="Kembali ke tab penanggung jawab"
                        >
                          <ArrowLeft className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={loadAllData}
                          className="inline-flex items-center gap-2 rounded-lg border border-[#d3dbef] px-3 py-2 text-sm font-semibold text-[#27407b] hover:bg-[#f3f6ff]"
                        >
                          <RefreshCcw className="h-4 w-4" />
                          Refresh
                        </button>
                      </div>
                    </div>

                    <div className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                      <div className="mb-3">
                        <h3 className="text-lg font-black text-[#1b274b]">Set Kuota Dosen</h3>
                        <p className="text-sm text-[#5d6c91]">
                          Atur kuota bimbingan untuk semua dosen atau hanya dosen tertentu.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={masterDosenKuotaMode}
                          onChange={(event) => setMasterDosenKuotaMode(event.target.value)}
                          className="rounded-lg border border-[#d3dbef] px-3 py-2 text-sm outline-none focus:border-[#2f63e3]"
                        >
                          <option value="all">Set untuk semua dosen</option>
                          <option value="selected">Set untuk dosen terpilih</option>
                        </select>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={masterDosenKuotaValue}
                          onChange={(event) => setMasterDosenKuotaValue(event.target.value)}
                          placeholder="Kuota bimbingan"
                          className="w-[180px] rounded-lg border border-[#d3dbef] px-3 py-2 text-sm outline-none focus:border-[#2f63e3]"
                        />
                        <button
                          type="button"
                          disabled={savingMasterDosenKuota}
                          onClick={handleSaveMasterDosenKuota}
                          className="inline-flex items-center gap-2 rounded-lg bg-[#117246] px-4 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {savingMasterDosenKuota ? "Menyimpan..." : "Simpan Kuota"}
                        </button>
                      </div>
                    </div>

                    <div className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                        <h3 className="text-lg font-black text-[#1b274b]">Grid Kuota Dosen</h3>
                        <div className="flex items-center gap-2">
                          {masterDosenKuotaMode === "selected" ? (
                            <span className="rounded-full bg-[#eef3ff] px-3 py-1 text-xs font-bold text-[#2f63e3]">
                              Dipilih: {masterDosenSelectedDosenIds.length}
                            </span>
                          ) : null}
                          <div className="relative">
                            <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7282a8]" />
                            <input
                              type="text"
                              value={masterDosenKuotaQuery}
                              onChange={(event) => setMasterDosenKuotaQuery(event.target.value)}
                              placeholder="Cari dosen, email, jabatan..."
                              className="w-[320px] rounded-lg border border-[#d3dbef] py-2 pl-8 pr-3 text-sm outline-none focus:border-[#2f63e3]"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="relative mt-1 overflow-auto rounded-lg border border-[#e6ecf8] grid-unified-height">
                        <table className="w-full min-w-[1400px] text-left text-sm">
                          <thead>
                            <tr className="border-y border-[#e6ecf8] text-[#4d5e89]">
                              <th className="bg-[#f8fbff] px-3 py-2 font-semibold">
                                <input
                                  type="checkbox"
                                  checked={isMasterDosenKuotaPageAllSelected}
                                  onChange={handleToggleMasterDosenKuotaPage}
                                  disabled={masterDosenKuotaMode !== "selected"}
                                  className="h-4 w-4 accent-[#2f63e3]"
                                />
                              </th>
                              <th className="bg-[#f8fbff] px-3 py-2 font-semibold">No</th>
                              <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Kode/NIK</th>
                              <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Nama Dosen</th>
                              <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Jabatan Struktural</th>
                              <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Kuota</th>
                              <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Mahasiswa Bimbingan</th>
                              <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Sisa Kuota</th>
                              <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredMasterDosenKuotaRows.length > 0
                              ? pagedMasterDosenKuotaRows.map((row, index) => {
                                  const rowId = Number(row?.id);
                                  const isChecked = masterDosenSelectedDosenIds.some(
                                    (item) => Number(item) === rowId
                                  );
                                  return (
                                    <tr key={`master-dosen-kuota-${row.id}`} className="border-b border-[#eff3fb]">
                                      <td className="px-3 py-2">
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={() => handleToggleMasterDosenKuotaRow(rowId)}
                                          disabled={masterDosenKuotaMode !== "selected"}
                                          className="h-4 w-4 accent-[#2f63e3]"
                                        />
                                      </td>
                                      <td className="px-3 py-2">
                                        {(masterDosenKuotaPage - 1) * DOSEN_GRID_PAGE_SIZE + index + 1}
                                      </td>
                                      <td className="px-3 py-2">
                                        {row.kode_dosen || "-"}
                                        <div className="text-xs text-[#7080a6]">{row.nik || "-"}</div>
                                      </td>
                                      <td className="px-3 py-2">
                                        <p className="font-semibold text-[#1f3160]">{row.nama || "-"}</p>
                                        <p className="text-xs text-[#6a779a]">{row.email || "-"}</p>
                                      </td>
                                      <td className="px-3 py-2">{row.jabatan_struktural || "-"}</td>
                                      <td className="px-3 py-2">{row.kuota?.total ?? 0}</td>
                                      <td className="px-3 py-2">{row.kuota?.terpakai ?? 0}</td>
                                      <td className="px-3 py-2">{row.kuota?.sisa ?? 0}</td>
                                      <td className="px-3 py-2">
                                        {row.kuota?.is_penuh ? (
                                          <span className="rounded-full bg-[#ffe5e5] px-2 py-1 text-xs font-bold text-[#b13a3a]">
                                            Penuh
                                          </span>
                                        ) : (
                                          <span className="rounded-full bg-[#e8f8ef] px-2 py-1 text-xs font-bold text-[#127947]">
                                            Tersedia
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })
                              : null}
                          </tbody>
                        </table>

                        {filteredMasterDosenKuotaRows.length === 0 ? (
                          <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[41px] flex items-center justify-center px-4 text-center text-sm font-semibold text-[#7b88ab]">
                            Data kuota dosen tidak ditemukan.
                          </div>
                        ) : null}
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#e8edf8] pt-3">
                        <p className="text-sm text-[#4f5e86]">
                          Menampilkan {masterDosenKuotaRangeStart} - {masterDosenKuotaRangeEnd} dari{" "}
                          {filteredMasterDosenKuotaRows.length} data dosen.
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setMasterDosenKuotaPage((prev) => Math.max(1, prev - 1))}
                            disabled={masterDosenKuotaPage === 1}
                            className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] transition hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Sebelumnya
                          </button>
                          <span className="text-sm font-semibold text-[#314778]">
                            Halaman {masterDosenKuotaPage} / {totalMasterDosenKuotaPages}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setMasterDosenKuotaPage((prev) =>
                                Math.min(totalMasterDosenKuotaPages, prev + 1)
                              )
                            }
                            disabled={masterDosenKuotaPage >= totalMasterDosenKuotaPages}
                            className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] transition hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Berikutnya
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}

            {!loading && isSekretaris && activeTab === "master-topik" ? (
              <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-lg font-black text-[#1b274b]">Grid Master Topik</h3>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7282a8]" />
                      <input
                        type="text"
                        value={masterTopikQuery}
                        onChange={(event) => setMasterTopikQuery(event.target.value)}
                        placeholder="Cari kode, judul, keyword, cluster, dosen, status..."
                        className="w-[320px] rounded-lg border border-[#d3dbef] py-2 pl-8 pr-3 text-sm outline-none focus:border-[#2f63e3]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={loadAllData}
                      className="inline-flex items-center gap-2 rounded-lg border border-[#d3dbef] px-3 py-2 text-sm font-semibold text-[#27407b] hover:bg-[#f3f6ff]"
                    >
                      <RefreshCcw className="h-4 w-4" />
                      Refresh
                    </button>
                  </div>
                </div>

                <div className="relative mt-1 flex-1 overflow-auto rounded-lg border border-[#e6ecf8] grid-unified-height">
                  <table className="w-full min-w-[1500px] text-left text-sm">
                    <thead>
                      <tr className="border-y border-[#e6ecf8] text-[#4d5e89]">
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">No</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Kode</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Judul</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Keyword</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Cluster</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Dosen</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Status</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMasterTopikRows.length > 0
                        ? pagedMasterTopikRows.map((row, index) => (
                            <tr key={`master-topik-${row.id}`} className="border-b border-[#eff3fb]">
                              <td className="px-3 py-2">
                                {(masterTopikPage - 1) * MASTER_TOPIK_PAGE_SIZE + index + 1}
                              </td>
                              <td className="px-3 py-2 font-semibold text-[#254080]">{row.kode || "-"}</td>
                              <td className="px-3 py-2">{row.judul || "-"}</td>
                              <td className="px-3 py-2">{row.keyword || "-"}</td>
                              <td className="px-3 py-2">{row.cluster || "-"}</td>
                              <td className="px-3 py-2">
                                {row.dosen?.nama || row.dosen_nama || row.nama_dosen || "-"}
                              </td>
                              <td className="px-3 py-2">{formatLabel(row.status)}</td>
                              <td className="px-3 py-2">{formatDateTime(row.updatedAt)}</td>
                            </tr>
                          ))
                        : null}
                    </tbody>
                  </table>
                  {filteredMasterTopikRows.length === 0 ? (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[41px] flex items-center justify-center px-4 text-center text-sm font-semibold text-[#7b88ab]">
                      Data topik tidak ditemukan.
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#e8edf8] pt-3">
                  <p className="text-sm text-[#4f5e86]">
                    Menampilkan{" "}
                    {filteredMasterTopikRows.length === 0
                      ? 0
                      : (masterTopikPage - 1) * MASTER_TOPIK_PAGE_SIZE + 1}{" "}
                    - {Math.min(masterTopikPage * MASTER_TOPIK_PAGE_SIZE, filteredMasterTopikRows.length)} dari{" "}
                    {filteredMasterTopikRows.length} data topik.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setMasterTopikPage((prev) => Math.max(1, prev - 1))}
                      disabled={masterTopikPage === 1}
                      className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] transition hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Sebelumnya
                    </button>
                    <span className="text-sm font-semibold text-[#314778]">
                      Halaman {masterTopikPage} / {totalMasterTopikPages}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setMasterTopikPage((prev) => Math.min(totalMasterTopikPages, prev + 1))
                      }
                      disabled={masterTopikPage >= totalMasterTopikPages}
                      className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] transition hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Berikutnya
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {!loading && activeTab === "topik" ? (
              <div
                className={
                  topikMode === "list"
                    ? "flex min-h-0 flex-1 flex-col gap-4"
                    : "space-y-4 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                }
              >
                <div className="rounded-xl border border-[#dce4f7] bg-white p-3 shadow-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setTopikMode("list")}
                      disabled={topikMode === "list"}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#d3dbef] text-[#27407b] transition hover:bg-[#f3f6ff] disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="Kembali ke data topik"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={loadAllData}
                      className="inline-flex items-center gap-2 rounded-lg border border-[#d3dbef] px-3 py-2 text-sm font-semibold text-[#27407b] hover:bg-[#f3f6ff]"
                    >
                      <RefreshCcw className="h-4 w-4" />
                      Refresh
                    </button>
                    <button
                      type="button"
                      onClick={() => setTopikMode("add")}
                      className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                        topikMode === "add"
                          ? "bg-[#2f63e3] text-white"
                          : "border border-[#d3dbef] text-[#27407b] hover:bg-[#f3f6ff]"
                      }`}
                    >
                      <Plus className="h-4 w-4" />
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => setTopikMode("import")}
                      className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                        topikMode === "import"
                          ? "bg-[#2f63e3] text-white"
                          : "border border-[#d3dbef] text-[#27407b] hover:bg-[#f3f6ff]"
                      }`}
                    >
                      <Upload className="h-4 w-4" />
                      Import
                    </button>
                  </div>
                </div>

                {topikMode === "list" ? (
                  <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <h3 className="text-lg font-black text-[#1b274b]">Grid Topik Dosen</h3>
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7282a8]" />
                          <input
                            type="text"
                            value={topikQuery}
                            onChange={(event) => setTopikQuery(event.target.value)}
                            placeholder="Cari kode, judul, keyword, cluster, status..."
                            className="w-[320px] rounded-lg border border-[#d3dbef] py-2 pl-8 pr-3 text-sm outline-none focus:border-[#2f63e3]"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={loadAllData}
                          className="inline-flex items-center gap-2 rounded-lg border border-[#d3dbef] px-3 py-2 text-sm font-semibold text-[#27407b] hover:bg-[#f3f6ff]"
                        >
                          <RefreshCcw className="h-4 w-4" />
                          Refresh
                        </button>
                      </div>
                    </div>

                    <div className="relative mt-1 flex-1 overflow-auto rounded-lg border border-[#e6ecf8] grid-unified-height">
                      <table className="w-full min-w-[1300px] text-left text-sm">
                        <thead>
                          <tr className="border-y border-[#e6ecf8] text-[#4d5e89]">
                            <th className="bg-[#f8fbff] px-3 py-2 font-semibold">No</th>
                            <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Kode</th>
                            <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Judul</th>
                            <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Keyword</th>
                            <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Cluster</th>
                            <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Status</th>
                            <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Updated</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredTopikRows.length > 0
                            ? pagedTopikRows.map((row, index) => (
                                <tr key={`topik-${row.id}`} className="border-b border-[#eff3fb]">
                                  <td className="px-3 py-2">{(topikPage - 1) * TOPIK_PAGE_SIZE + index + 1}</td>
                                  <td className="px-3 py-2 font-semibold text-[#254080]">{row.kode || "-"}</td>
                                  <td className="px-3 py-2">{row.judul || "-"}</td>
                                  <td className="px-3 py-2">{row.keyword || "-"}</td>
                                  <td className="px-3 py-2">{row.cluster || "-"}</td>
                                  <td className="px-3 py-2">{formatLabel(row.status)}</td>
                                  <td className="px-3 py-2">{formatDateTime(row.updatedAt)}</td>
                                </tr>
                              ))
                            : null}
                        </tbody>
                      </table>
                      {filteredTopikRows.length === 0 ? (
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[41px] flex items-center justify-center px-4 text-center text-sm font-semibold text-[#7b88ab]">
                          Data topik tidak ditemukan.
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#e8edf8] pt-3">
                      <p className="text-sm text-[#4f5e86]">
                        Menampilkan {filteredTopikRows.length === 0 ? 0 : (topikPage - 1) * TOPIK_PAGE_SIZE + 1} -{" "}
                        {Math.min(topikPage * TOPIK_PAGE_SIZE, filteredTopikRows.length)} dari {filteredTopikRows.length} data topik.
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setTopikPage((prev) => Math.max(1, prev - 1))}
                          disabled={topikPage === 1}
                          className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] transition hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Sebelumnya
                        </button>
                        <span className="text-sm font-semibold text-[#314778]">
                          Halaman {topikPage} / {totalTopikPages}
                        </span>
                        <button
                          type="button"
                          onClick={() => setTopikPage((prev) => Math.min(totalTopikPages, prev + 1))}
                          disabled={topikPage >= totalTopikPages}
                          className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] transition hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Berikutnya
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

                {topikMode !== "list" ? (
                  <div className="space-y-4">
                    {topikMode === "import" ? (
                    <div className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-lg font-black text-[#1b274b]">Upload Topik via Excel</h3>
                        <a
                          href={`${apiBaseUrl}/api/admin/upload/template`}
                          className="inline-flex items-center gap-2 rounded-lg border border-[#b8e0cb] px-3 py-2 text-sm font-semibold text-[#0f7b50] hover:bg-[#effaf4]"
                        >
                          <Download className="h-4 w-4" />
                          Download Template
                        </a>
                      </div>
                      <p className="text-sm text-[#5d6c91]">
                        Gunakan template topik. Sistem otomatis memasangkan topik ke akun dosen yang sedang login.
                      </p>

                      <div className="mt-4 space-y-3">
                        <input
                          type="file"
                          accept=".xls,.xlsx,.ods"
                          onChange={handleTopikUploadFileChange}
                          className="w-full rounded-lg border border-[#d3dbef] px-3 py-2 text-sm"
                        />
                        <button
                          type="button"
                          onClick={handleTopikUploadSubmit}
                          disabled={uploadingTopik || !topikUploadFile}
                          className="inline-flex items-center gap-2 rounded-lg bg-[#2f63e3] px-4 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Upload className="h-4 w-4" />
                          {uploadingTopik ? "Mengupload..." : "Upload Template"}
                        </button>
                      </div>
                      <div className="mt-4 rounded-lg border border-[#dce6f7] bg-[#f8fbff] p-4">
                        <p className="text-sm font-bold text-[#1e2f57]">
                          {uploadTopikResult?.message || "Preview topik akan tampil di sini setelah upload template."}
                        </p>
                        <p className="mt-1 text-sm text-[#42527c]">
                          Valid: {uploadTopikResult?.data?.valid ?? 0} | Tidak valid: {uploadTopikResult?.data?.invalid ?? 0}
                        </p>
                        <p className="mt-1 text-xs text-[#5d6c91]">
                          Preview menampilkan maksimal {TOPIK_UPLOAD_PREVIEW_MAX_ROWS} data (5 data per halaman).
                        </p>

                        {Array.isArray(uploadTopikResult?.detail?.missing_columns) &&
                        uploadTopikResult.detail.missing_columns.length > 0 ? (
                          <div className="mt-3 rounded-md border border-[#f0d7d7] bg-[#fff7f7] p-3 text-sm text-[#963838]">
                            <p className="font-semibold">Template tidak valid.</p>
                            <p className="mt-1">
                              Kolom yang belum sesuai: {uploadTopikResult.detail.missing_columns.join(", ")}.
                            </p>
                          </div>
                        ) : null}

                        <div className="mt-4 overflow-hidden rounded-lg border border-[#d6e0f5] bg-white">
                          <div className="overflow-x-auto">
                            <table className="w-full min-w-[1120px] table-auto">
                              <thead className="bg-[#f4f7ff] text-left text-sm font-bold text-[#2f4473]">
                                <tr>
                                  <th className="px-3 py-2">No</th>
                                  <th className="px-3 py-2">Baris Excel</th>
                                  <th className="px-3 py-2">Kode Topik</th>
                                  <th className="px-3 py-2">Cluster</th>
                                  <th className="px-3 py-2">Judul Topik</th>
                                  <th className="px-3 py-2">Keyword</th>
                                  <th className="px-3 py-2">Status</th>
                                  <th className="px-3 py-2">Pesan Error</th>
                                </tr>
                              </thead>
                              <tbody>
                                {topikUploadPreviewRowsPaged.length > 0 ? (
                                  topikUploadPreviewRowsPaged.map((row) => (
                                    <tr
                                      key={row.key}
                                      className={`border-t border-[#ecf1fb] text-sm text-[#23345d] ${
                                        row.status === "error" ? "bg-[#fff8f8]" : "bg-white"
                                      }`}
                                    >
                                      <td className="px-3 py-2">{row.nomor}</td>
                                      <td className="px-3 py-2">{row.baris}</td>
                                      <td className="px-3 py-2">{row.kode}</td>
                                      <td className="px-3 py-2">{row.cluster}</td>
                                      <td className="px-3 py-2">{row.judul}</td>
                                      <td className="px-3 py-2">{row.keyword}</td>
                                      <td className="px-3 py-2">
                                        <span
                                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${
                                            row.status === "error"
                                              ? "bg-[#ffe3e3] text-[#a93d3d]"
                                              : "bg-[#def4e8] text-[#117246]"
                                          }`}
                                        >
                                          {row.status === "error" ? "Tidak Valid" : "Valid"}
                                        </span>
                                      </td>
                                      <td className={`px-3 py-2 ${row.status === "error" ? "text-[#a93d3d]" : ""}`}>
                                        {row.pesan_error}
                                      </td>
                                    </tr>
                                  ))
                                ) : (
                                  <tr className="border-t border-[#ecf1fb] text-sm text-[#5d6c91]">
                                    <td className="px-3 py-4 text-center" colSpan={8}>
                                      Belum ada data preview.
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                          <p className="text-xs text-[#5d6c91]">
                            Menampilkan {topikUploadPreviewRowsLimited.length === 0 ? 0 : (topikUploadPreviewPage - 1) * TOPIK_UPLOAD_PREVIEW_PAGE_SIZE + 1}
                            {" - "}
                            {Math.min(
                              topikUploadPreviewPage * TOPIK_UPLOAD_PREVIEW_PAGE_SIZE,
                              topikUploadPreviewRowsLimited.length
                            )}{" "}
                            dari {topikUploadPreviewRowsLimited.length} data preview.
                          </p>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setTopikUploadPreviewPage((prev) => Math.max(1, prev - 1))}
                              disabled={topikUploadPreviewPage <= 1}
                              className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-xs font-semibold text-[#314778] transition hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Sebelumnya
                            </button>
                            <span className="text-xs font-semibold text-[#314778]">
                              Halaman {topikUploadPreviewPage} / {topikUploadPreviewTotalPages}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setTopikUploadPreviewPage((prev) =>
                                  Math.min(topikUploadPreviewTotalPages, prev + 1)
                                )
                              }
                              disabled={topikUploadPreviewPage >= topikUploadPreviewTotalPages}
                              className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-xs font-semibold text-[#314778] transition hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Berikutnya
                            </button>
                          </div>
                        </div>

                        <div className="mt-4 flex justify-end">
                          <button
                            type="button"
                            onClick={handleSaveUploadedTopik}
                            disabled={savingUploadedTopik || topikUploadValidRows.length === 0}
                            className="inline-flex items-center gap-2 rounded-lg bg-[#117246] px-4 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <FileSpreadsheet className="h-4 w-4" />
                            {savingUploadedTopik ? "Menyimpan..." : "Simpan ke Database"}
                          </button>
                        </div>
                      </div>
                    </div>
                    ) : null}

                    {topikMode === "add" ? (
                    <div className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                      <h3 className="mb-3 text-lg font-black text-[#1b274b]">Tambah Topik via Form</h3>
                      <form onSubmit={handleTopikApiSubmit} className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-sm font-semibold text-[#344b7f]">Kode Topik</label>
                          <input
                            type="text"
                            name="kode"
                            value={topikForm.kode}
                            onChange={handleTopikFormChange}
                            placeholder="Contoh: SIRKEL99"
                            className="w-full rounded-lg border border-[#d3dbef] px-3 py-2 text-sm outline-none focus:border-[#2f63e3]"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-semibold text-[#344b7f]">Cluster</label>
                          <select
                            name="cluster"
                            value={topikForm.cluster}
                            onChange={handleTopikFormChange}
                            className="w-full rounded-lg border border-[#d3dbef] px-3 py-2 text-sm outline-none focus:border-[#2f63e3]"
                          >
                            {allowedTopikClusters.map((cluster) => (
                              <option key={cluster} value={cluster}>
                                {cluster}
                              </option>
                            ))}
                          </select>
                          <p className="mt-1 text-xs text-[#6b789e]">
                            Opsi cluster mengikuti assignment cluster dosen login.
                          </p>
                        </div>
                        <div className="lg:col-span-2">
                          <label className="mb-1 block text-sm font-semibold text-[#344b7f]">Judul Topik</label>
                          <input
                            type="text"
                            name="judul"
                            value={topikForm.judul}
                            onChange={handleTopikFormChange}
                            placeholder="Masukkan judul topik"
                            className="w-full rounded-lg border border-[#d3dbef] px-3 py-2 text-sm outline-none focus:border-[#2f63e3]"
                          />
                        </div>
                        <div className="lg:col-span-2">
                          <label className="mb-1 block text-sm font-semibold text-[#344b7f]">Keyword</label>
                          <input
                            type="text"
                            name="keyword"
                            value={topikForm.keyword}
                            onChange={handleTopikFormChange}
                            placeholder="Contoh: machine learning, rekomendasi, sistem informasi"
                            className="w-full rounded-lg border border-[#d3dbef] px-3 py-2 text-sm outline-none focus:border-[#2f63e3]"
                          />
                          <p className="mt-1 text-xs text-[#6b789e]">
                            Pisahkan beberapa keyword dengan koma agar mudah dicari mahasiswa.
                          </p>
                        </div>
                        <div className="lg:col-span-2">
                          <label className="mb-1 block text-sm font-semibold text-[#344b7f]">Deskripsi (opsional)</label>
                          <textarea
                            name="deskripsi"
                            value={topikForm.deskripsi}
                            onChange={handleTopikFormChange}
                            rows={4}
                            placeholder="Deskripsi singkat topik"
                            className="w-full rounded-lg border border-[#d3dbef] px-3 py-2 text-sm outline-none focus:border-[#2f63e3]"
                          />
                        </div>
                        <div className="lg:col-span-2">
                          <button
                            type="submit"
                            disabled={savingTopik}
                            className="inline-flex items-center gap-2 rounded-lg bg-[#2f63e3] px-4 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <FileSpreadsheet className="h-4 w-4" />
                            {savingTopik ? "Menyimpan..." : "Simpan Topik"}
                          </button>
                        </div>
                      </form>
                    </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {!loading && isSekretaris && activeTab === "penjaluran" ? (
              <div className="flex min-h-0 flex-1 flex-col gap-4">
                <div className="rounded-xl border border-[#e4e9f6] bg-white p-3 shadow-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={loadAllData}
                      className="inline-flex items-center gap-2 rounded-lg border border-[#d3dbef] px-3 py-2 text-sm font-semibold text-[#27407b] hover:bg-[#f3f6ff]"
                    >
                      <RefreshCcw className="h-4 w-4" />
                      Refresh
                    </button>
                    <button
                      type="button"
                      onClick={handleExportPendaftaran}
                      disabled={exportingPendaftaran}
                      className="inline-flex items-center gap-2 rounded-lg bg-[#0f7b50] px-3 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Download className="h-4 w-4" />
                      {exportingPendaftaran ? "Exporting..." : "Download Excel"}
                    </button>
                  </div>
                </div>

                <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-black text-[#1b274b]">Grid Manajemen Penjaluran</h3>
                      <p className="text-sm text-[#5d6c91]">
                        Pantau data pendaftaran dan gunakan filter untuk mempersempit hasil.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7282a8]" />
                        <input
                          type="text"
                          value={pendaftaranSearch}
                          onChange={(event) => setPendaftaranSearch(event.target.value)}
                          placeholder="Cari NIM, nama, email, jalur..."
                          className="w-[320px] rounded-lg border border-[#d3dbef] py-2 pl-8 pr-3 text-sm outline-none focus:border-[#2f63e3]"
                        />
                      </div>
                      <div className="relative" ref={pendaftaranFilterTriggerRef}>
                        <button
                          type="button"
                          onClick={handleTogglePendaftaranFilterPanel}
                          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                            showPendaftaranFilterPanel || hasPendaftaranActiveFilters
                              ? "border-[#2f63e3] bg-[#eef3ff] text-[#2348a5]"
                              : "border-[#d3dbef] text-[#27407b] hover:bg-[#f3f6ff]"
                          }`}
                        >
                          <SlidersHorizontal className="h-4 w-4" />
                          Filter
                          {hasPendaftaranActiveFilters ? (
                            <span className="rounded-full bg-[#2f63e3] px-1.5 py-0.5 text-xs font-bold leading-none text-white">
                              {pendaftaranActiveFilterChips.length}
                            </span>
                          ) : null}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={handleResetPendaftaranFilters}
                        disabled={!hasPendaftaranActiveFilters}
                        className="inline-flex items-center gap-2 rounded-lg border border-[#d3dbef] px-3 py-2 text-sm font-semibold text-[#27407b] transition hover:bg-[#f3f6ff] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Reset
                      </button>
                    </div>
                  </div>

                <div className="relative mt-1 flex-1 overflow-auto rounded-lg border border-[#e6ecf8] grid-unified-height">
                  <table className="w-full min-w-[1650px] text-left text-sm">
                    <thead>
                      <tr className="border-y border-[#e6ecf8] text-[#4d5e89]">
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Tanggal</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Tahun Akademik</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Semester</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Angkatan</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">NIM</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Nama</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Jalur</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Penjaluran</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">DPA</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPendaftaranRows.length > 0
                        ? pagedPendaftaranRows.map((row) => {
                            const namaPenjaluran =
                              row.jenis_jalur_diambil || row.penjaluran_baru || row.penjaluran_sebelumnya;

                            return (
                              <tr key={`pendaftaran-${row.id}`} className="border-b border-[#eff3fb]">
                                <td className="px-3 py-2">{formatDateTime(row.createdAt)}</td>
                                <td className="px-3 py-2">{row.periode?.tahun_akademik || "-"}</td>
                                <td className="px-3 py-2">
                                  {row.periode?.semester ? formatLabel(row.periode.semester) : "-"}
                                </td>
                                <td className="px-3 py-2">{row.mahasiswa?.angkatan || "-"}</td>
                                <td className="px-3 py-2 font-semibold text-[#254080]">
                                  {row.mahasiswa?.nim || "-"}
                                </td>
                                <td className="px-3 py-2">{row.mahasiswa?.nama || "-"}</td>
                                <td className="px-3 py-2">{formatLabel(row.jalur)}</td>
                                <td className="px-3 py-2">{namaPenjaluran ? formatLabel(namaPenjaluran) : "-"}</td>
                                <td className="px-3 py-2">{row.dosen_pembimbing_akademik?.nama || "-"}</td>
                                <td className="px-3 py-2">
                                  {row.status === "submitted" ? (
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        disabled={rowActionLoadingId === row.id}
                                        onClick={() => handlePendaftaranApprove(row.id)}
                                        className="rounded-md bg-[#137748] px-3 py-1 text-xs font-bold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        Approve
                                      </button>
                                      <button
                                        type="button"
                                        disabled={rowActionLoadingId === row.id}
                                        onClick={() => handlePendaftaranReject(row.id)}
                                        className="rounded-md bg-[#b73a3a] px-3 py-1 text-xs font-bold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        Tolak
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-[#68779f]">Selesai diproses</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        : null}
                    </tbody>
                  </table>
                  {filteredPendaftaranRows.length === 0 ? (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[41px] flex items-center justify-center px-4 text-center text-sm font-semibold text-[#7b88ab]">
                      Belum ada data penjaluran.
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#e8edf8] pt-3">
                  <p className="text-sm text-[#4f5e86]">
                    Menampilkan {pendaftaranRangeStart} - {pendaftaranRangeEnd} dari{" "}
                    {filteredPendaftaranRows.length} data penjaluran.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPendaftaranPage((prev) => Math.max(1, prev - 1))}
                      disabled={pendaftaranPage === 1}
                      className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] transition hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Sebelumnya
                    </button>
                    <span className="text-sm font-semibold text-[#314778]">
                      Halaman {pendaftaranPage} / {totalPendaftaranPages}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setPendaftaranPage((prev) => Math.min(totalPendaftaranPages, prev + 1))
                      }
                      disabled={pendaftaranPage >= totalPendaftaranPages}
                      className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] transition hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Berikutnya
                    </button>
                  </div>
                </div>
                </div>
              </div>
            ) : null}


            {!loading && isSekretaris && activeTab === "ketua-klaster" ? (
              <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                {ketuaKlasterError ? (
                  <div className="mb-3 rounded-lg border border-[#f6d7d7] bg-[#fff2f2] px-3 py-2 text-sm font-semibold text-[#a03f3f]">
                    {ketuaKlasterError}
                  </div>
                ) : null}

                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black text-[#1b274b]">Set Ketua Cluster Per Periode</h3>
                    <p className="text-sm text-[#5d6c91]">
                      Pilih periode, lalu tetapkan ketua untuk setiap klaster penelitian.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={ketuaKlasterPeriodeId}
                      onChange={handleChangeKetuaKlasterPeriode}
                      className="min-w-[260px] rounded-lg border border-[#d3dbef] px-3 py-2 text-sm outline-none focus:border-[#2f63e3]"
                    >
                      {(ketuaKlasterOverview.periodes || []).map((item) => (
                        <option key={`ketua-periode-opt-${item.id}`} value={item.id}>
                          {item.label_periode || `${formatLabel(item.semester)} ${item.tahun_akademik}`}
                          {item.status ? ` (${formatLabel(item.status)})` : item.is_active ? " (Aktif)" : ""}
                        </option>
                      ))}
                    </select>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7282a8]" />
                      <input
                        type="text"
                        value={ketuaKlasterQuery}
                        onChange={(event) => setKetuaKlasterQuery(event.target.value)}
                        placeholder="Cari klaster / ketua..."
                        className="w-[260px] rounded-lg border border-[#d3dbef] py-2 pl-8 pr-3 text-sm outline-none focus:border-[#2f63e3]"
                      />
                    </div>
                  </div>
                </div>

                <div className="relative mt-1 flex-1 overflow-auto rounded-lg border border-[#e6ecf8] grid-unified-height">
                  <table className="w-full min-w-[1300px] text-left text-sm">
                    <thead>
                      <tr className="border-y border-[#e6ecf8] text-[#4d5e89]">
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Klaster</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Ketua Saat Ini</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Ditetapkan Oleh</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Kandidat Dosen</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredKetuaKlasterRows.length > 0
                        ? pagedKetuaKlasterRows.map((row) => (
                            <tr key={`ketua-klaster-row-${row.id}`} className="border-b border-[#eff3fb]">
                              <td className="px-3 py-2">
                                <p className="font-semibold text-[#1f3160]">{row.kode}</p>
                                <p className="text-xs text-[#6a779a]">{row.nama}</p>
                              </td>
                              <td className="px-3 py-2">
                                {row.ketua?.ketua_dosen ? (
                                  <>
                                    <p className="font-semibold text-[#1f3160]">{row.ketua.ketua_dosen.nama}</p>
                                    <p className="text-xs text-[#6a779a]">
                                      {row.ketua.ketua_dosen.kode_dosen} • {row.ketua.ketua_dosen.nik || "-"}
                                    </p>
                                  </>
                                ) : (
                                  <span className="rounded-full bg-[#fff3e0] px-2 py-1 text-xs font-bold text-[#9b6200]">
                                    Belum diset
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-sm text-[#44537b]">
                                {row.ketua?.assigned_by?.nama || "-"}
                              </td>
                              <td className="px-3 py-2">
                                <select
                                  value={ketuaKlasterDraft[row.id] || ""}
                                  onChange={(event) =>
                                    handleKetuaKlasterDraftChange(row.id, event.target.value)
                                  }
                                  className="w-full min-w-[320px] rounded-lg border border-[#d3dbef] px-3 py-2 text-sm outline-none focus:border-[#2f63e3]"
                                >
                                  <option value="">Pilih dosen ketua klaster</option>
                                  {(row.kandidat_dosen || []).map((item) => (
                                    <option key={`ketua-klaster-candidate-${row.id}-${item.id}`} value={item.id}>
                                      {item.nama} ({item.kode_dosen})
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-3 py-2">
                                <button
                                  type="button"
                                  disabled={savingKetuaKlasterId === row.id || !(row.kandidat_dosen || []).length}
                                  onClick={() => handleSaveKetuaKlaster(row)}
                                  className="inline-flex items-center gap-1 rounded-md bg-[#2f63e3] px-3 py-1.5 text-xs font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  <ClipboardList className="h-3.5 w-3.5" />
                                  {savingKetuaKlasterId === row.id ? "Menyimpan..." : "Simpan"}
                                </button>
                              </td>
                            </tr>
                          ))
                        : null}
                    </tbody>
                  </table>

                  {filteredKetuaKlasterRows.length === 0 ? (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[41px] flex items-center justify-center px-4 text-center text-sm font-semibold text-[#7b88ab]">
                      Data klaster tidak ditemukan.
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#e8edf8] pt-3">
                  <p className="text-sm text-[#4f5e86]">
                    Menampilkan {ketuaKlasterRangeStart} - {ketuaKlasterRangeEnd} dari{" "}
                    {filteredKetuaKlasterRows.length} data klaster.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setKetuaKlasterPage((prev) => Math.max(1, prev - 1))}
                      disabled={ketuaKlasterPage === 1}
                      className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] transition hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Sebelumnya
                    </button>
                    <span className="text-sm font-semibold text-[#314778]">
                      Halaman {ketuaKlasterPage} / {totalKetuaKlasterPages}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setKetuaKlasterPage((prev) => Math.min(totalKetuaKlasterPages, prev + 1))
                      }
                      disabled={ketuaKlasterPage >= totalKetuaKlasterPages}
                      className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] transition hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Berikutnya
                    </button>
                  </div>
                </div>
              </div>
            ) : null}


            {!loading && isSekretaris && activeTab === "periode" ? (
              <div
                className={
                  periodeMode === "list"
                    ? "flex min-h-0 flex-1 flex-col gap-4"
                    : "space-y-4 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                }
              >
                <div className="rounded-xl border border-[#dce4f7] bg-white p-3 shadow-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPeriodeMode("list");
                        setEditingPeriode(null);
                        setPeriodeFormErrors({});
                        setPeriodeMasterErrors({});
                        setPeriodeReadonlyRoles({ loading: false, rows: [], error: "" });
                      }}
                      disabled={periodeMode === "list"}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#d3dbef] text-[#27407b] transition hover:bg-[#f3f6ff] disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="Kembali ke data periode"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={loadAllData}
                      className="inline-flex items-center gap-2 rounded-lg border border-[#d3dbef] px-3 py-2 text-sm font-semibold text-[#27407b] hover:bg-[#f3f6ff]"
                    >
                      <RefreshCcw className="h-4 w-4" />
                      Refresh
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPeriodeMode("open");
                        setEditingPeriode(null);
                        setPeriodeReadonlyRoles({ loading: false, rows: [], error: "" });
                        setPeriodeFormErrors({});
                        setPeriodeMasterErrors({});
                      }}
                      className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                        periodeMode === "open"
                          ? "bg-[#2f63e3] text-white"
                          : "border border-[#d3dbef] text-[#27407b] hover:bg-[#f3f6ff]"
                      }`}
                    >
                      <CalendarRange className="h-4 w-4" />
                      Buka Periode
                    </button>
                  </div>
                </div>

                {periodeMode === "list" ? (
                  <>
                    <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                      <h3 className="mb-3 text-lg font-black text-[#1b274b]">Riwayat Periode</h3>
                      <div className="relative mt-1 flex-1 overflow-auto rounded-lg border border-[#e6ecf8] grid-unified-height">
                        <table className="w-full min-w-[980px] text-left text-sm">
                          <thead>
                            <tr className="border-y border-[#e6ecf8] text-[#4d5e89]">
                              <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Label Periode</th>
                              <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Tahun Akademik</th>
                              <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Semester</th>
                              <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Tanggal Mulai</th>
                              <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Tanggal Selesai</th>
                              <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Status</th>
                              <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Aksi</th>
                            </tr>
                          </thead>
                          <tbody>
                            {periodeRows.length > 0
                              ? pagedPeriodeRows.map((row) => {
                                  const canEditRow = canEditPeriodeRow(row);
                                  const isRowActive = getPeriodeStatusKey(row) === "active";
                                  return (
                                  <tr key={`periode-${row.id}`} className="border-b border-[#eff3fb]">
                                    <td className="px-3 py-2">{row.label_periode || "-"}</td>
                                    <td className="px-3 py-2">{row.tahun_akademik || "-"}</td>
                                    <td className="px-3 py-2">{formatLabel(row.semester)}</td>
                                    <td className="px-3 py-2">{formatDateTime(row.tanggal_mulai)}</td>
                                    <td className="px-3 py-2">{formatDateTime(row.tanggal_selesai)}</td>
                                    <td className="px-3 py-2">
                                      {isRowActive ? (
                                        <span className="rounded-full bg-[#e8f8ef] px-2 py-1 text-xs font-bold text-[#127947]">Aktif</span>
                                      ) : (
                                        <span className="rounded-full bg-[#eef2fb] px-2 py-1 text-xs font-bold text-[#58658d]">Nonaktif</span>
                                      )}
                                    </td>
                                    <td className="px-3 py-2">
                                      <button
                                        type="button"
                                        disabled={savingPeriode}
                                        onClick={() => {
                                          handleOpenPeriodeEditor(row).catch(() => {});
                                        }}
                                        className="inline-flex items-center gap-1 rounded-md bg-[#2f63e3] px-3 py-1.5 text-xs font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        {canEditRow ? (
                                          <>
                                            <CalendarRange className="h-3.5 w-3.5" />
                                            Edit
                                          </>
                                        ) : (
                                          <>
                                            <Eye className="h-3.5 w-3.5" />
                                            Detail
                                          </>
                                        )}
                                      </button>
                                    </td>
                                  </tr>
                                  );
                                })
                              : null}
                          </tbody>
                        </table>
                        {periodeRows.length === 0 ? (
                          <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[41px] flex items-center justify-center px-4 text-center text-sm font-semibold text-[#7b88ab]">
                            Belum ada data periode.
                          </div>
                        ) : null}
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#e8edf8] pt-3">
                        <p className="text-sm text-[#4f5e86]">
                          Menampilkan {periodeRangeStart} - {periodeRangeEnd} dari {periodeRows.length} data
                          periode.
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setPeriodePage((prev) => Math.max(1, prev - 1))}
                            disabled={periodePage === 1}
                            className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] transition hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Sebelumnya
                          </button>
                          <span className="text-sm font-semibold text-[#314778]">
                            Halaman {periodePage} / {totalPeriodePages}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setPeriodePage((prev) => Math.min(totalPeriodePages, prev + 1))
                            }
                            disabled={periodePage >= totalPeriodePages}
                            className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] transition hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Berikutnya
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                ) : null}

                {periodeMode === "open" ? (
                  <div className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                    <h3 className="text-lg font-black text-[#1b274b]">Buka Periode Baru</h3>
                    <p className="mt-1 text-sm text-[#5d6c91]">
                      Gunakan master data penanggung jawab, lalu isi detail periode yang akan dibuka.
                    </p>

                    <div className="mt-4 space-y-4">
                      <section className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-black text-[#1b274b]">
                              1. Preview Master Penanggung Jawab (Read Only)
                            </p>
                            <p className="mt-1 text-sm text-[#5d6c91]">
                              Pengaturan ketua cluster dan pembimbing jalur dikelola dari menu Master Dosen.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveTab("master-dosen");
                              setMasterDosenTab("penanggung-jawab");
                            }}
                            className="inline-flex items-center gap-2 rounded-lg border border-[#d3dbef] px-3 py-2 text-sm font-semibold text-[#27407b] hover:bg-[#f3f6ff]"
                          >
                            Buka Master Dosen
                          </button>
                        </div>

                        {masterPeriodeMissingLabels.length > 0 ? (
                          <div className="mt-3 rounded-lg border border-[#f5d0d0] bg-[#fff3f3] px-3 py-2 text-sm font-semibold text-[#a33f3f]">
                            Master data belum lengkap. Lengkapi dulu: {masterPeriodeMissingLabels.join(", ")}.
                          </div>
                        ) : null}

                        <div className="mt-3 rounded-lg border border-[#dbe4f6] bg-[#f8fbff] p-3">
                          <p className="text-xs font-black uppercase tracking-wide text-[#4e5d87]">Preview Penanggung Jawab</p>
                          <div className="mt-2 grid grid-cols-1 gap-2 lg:grid-cols-2">
                            {PERIODE_MASTER_KETUA_FIELDS.map((item) => (
                              <p key={`periode-master-preview-ketua-${item.key}`} className="text-sm text-[#2c3d68]">
                                <span className="font-semibold">{item.label}:</span>{" "}
                                {periodeDosenMap.get(Number(periodeMasterForm[item.key]))?.nama || "-"}
                              </p>
                            ))}
                            {PERIODE_MASTER_JALUR_FIELDS.map((item) => (
                              <p key={`periode-master-preview-jalur-${item.key}`} className="text-sm text-[#2c3d68]">
                                <span className="font-semibold">{item.label}:</span>{" "}
                                {periodeDosenMap.get(Number(periodeMasterForm[item.key]))?.nama || "-"}
                              </p>
                            ))}
                          </div>
                        </div>
                      </section>

                      <section className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                        <p className="text-sm font-black text-[#1b274b]">
                          2. Detail Periode Penjaluran
                        </p>
                        <p className="mt-1 text-sm text-[#5d6c91]">
                          Isi periode akademik yang akan dibuka.
                        </p>

                        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-sm font-semibold text-[#344b7f]">Tahun Akademik</label>
                            <input
                              type="text"
                              name="tahun_akademik"
                              value={periodeForm.tahun_akademik}
                              onChange={handlePeriodeInputChange}
                              placeholder="Contoh: 2026/2027"
                              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[#2f63e3] ${
                                periodeFormErrors.tahun_akademik ? "border-[#dc4b4b] bg-[#fff7f7]" : "border-[#d3dbef]"
                              }`}
                            />
                            {periodeFormErrors.tahun_akademik ? (
                              <p className="mt-1 text-xs font-semibold text-[#c23737]">{periodeFormErrors.tahun_akademik}</p>
                            ) : null}
                          </div>
                          <div>
                            <label className="mb-1 block text-sm font-semibold text-[#344b7f]">Semester</label>
                            <select
                              name="semester"
                              value={periodeForm.semester}
                              onChange={handlePeriodeInputChange}
                              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[#2f63e3] ${
                                periodeFormErrors.semester ? "border-[#dc4b4b] bg-[#fff7f7]" : "border-[#d3dbef]"
                              }`}
                            >
                              <option value="ganjil">Ganjil</option>
                              <option value="genap">Genap</option>
                            </select>
                            {periodeFormErrors.semester ? (
                              <p className="mt-1 text-xs font-semibold text-[#c23737]">{periodeFormErrors.semester}</p>
                            ) : null}
                          </div>
                          <div>
                            <label className="mb-1 block text-sm font-semibold text-[#344b7f]">Tanggal Mulai</label>
                            <input
                              type="date"
                              name="tanggal_mulai"
                              value={periodeForm.tanggal_mulai}
                              onChange={handlePeriodeInputChange}
                              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[#2f63e3] ${
                                periodeFormErrors.tanggal_mulai ? "border-[#dc4b4b] bg-[#fff7f7]" : "border-[#d3dbef]"
                              }`}
                            />
                            {periodeFormErrors.tanggal_mulai ? (
                              <p className="mt-1 text-xs font-semibold text-[#c23737]">{periodeFormErrors.tanggal_mulai}</p>
                            ) : null}
                          </div>
                          <div>
                            <label className="mb-1 block text-sm font-semibold text-[#344b7f]">Tanggal Selesai</label>
                            <input
                              type="date"
                              name="tanggal_selesai"
                              value={periodeForm.tanggal_selesai}
                              onChange={handlePeriodeInputChange}
                              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[#2f63e3] ${
                                periodeFormErrors.tanggal_selesai ? "border-[#dc4b4b] bg-[#fff7f7]" : "border-[#d3dbef]"
                              }`}
                            />
                            {periodeFormErrors.tanggal_selesai ? (
                              <p className="mt-1 text-xs font-semibold text-[#c23737]">{periodeFormErrors.tanggal_selesai}</p>
                            ) : null}
                          </div>
                        </div>
                      </section>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={savingPeriode}
                        onClick={handleOpenPeriode}
                        className="rounded-lg bg-[#117246] px-4 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Buka Periode
                      </button>
                    </div>
                  </div>
                ) : null}

                {false ? (
                  <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-black text-[#1b274b]">Set Ketua Cluster Per Periode</h3>
                        <p className="text-sm text-[#5d6c91]">
                          Pilih periode draft, lalu tetapkan ketua untuk setiap klaster.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={ketuaKlasterPeriodeId}
                          onChange={handleChangeKetuaKlasterPeriode}
                          className="min-w-[260px] rounded-lg border border-[#d3dbef] px-3 py-2 text-sm outline-none focus:border-[#2f63e3]"
                        >
                          {(ketuaKlasterOverview.periodes || []).map((item) => (
                            <option key={`ketua-periode-opt-${item.id}`} value={item.id}>
                              {item.label_periode || `${formatLabel(item.semester)} ${item.tahun_akademik}`}
                              {item.status ? ` (${formatLabel(item.status)})` : item.is_active ? " (Aktif)" : ""}
                            </option>
                          ))}
                        </select>
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7282a8]" />
                          <input
                            type="text"
                            value={ketuaKlasterQuery}
                            onChange={(event) => setKetuaKlasterQuery(event.target.value)}
                            placeholder="Cari klaster / ketua..."
                            className="w-[260px] rounded-lg border border-[#d3dbef] py-2 pl-8 pr-3 text-sm outline-none focus:border-[#2f63e3]"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="relative mt-1 flex-1 overflow-auto rounded-lg border border-[#e6ecf8] grid-unified-height">
                      <table className="w-full min-w-[1300px] text-left text-sm">
                        <thead>
                          <tr className="border-y border-[#e6ecf8] text-[#4d5e89]">
                            <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Klaster</th>
                            <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Ketua Saat Ini</th>
                            <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Ditetapkan Oleh</th>
                            <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Kandidat Dosen</th>
                            <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Aksi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredKetuaKlasterRows.length > 0
                            ? pagedKetuaKlasterRows.map((row) => (
                                <tr key={`ketua-klaster-row-${row.id}`} className="border-b border-[#eff3fb]">
                                  <td className="px-3 py-2">
                                    <p className="font-semibold text-[#1f3160]">{row.kode}</p>
                                    <p className="text-xs text-[#6a779a]">{row.nama}</p>
                                  </td>
                                  <td className="px-3 py-2">
                                    {row.ketua?.ketua_dosen ? (
                                      <>
                                        <p className="font-semibold text-[#1f3160]">{row.ketua.ketua_dosen.nama}</p>
                                        <p className="text-xs text-[#6a779a]">
                                          {row.ketua.ketua_dosen.kode_dosen} • {row.ketua.ketua_dosen.nik || "-"}
                                        </p>
                                      </>
                                    ) : (
                                      <span className="rounded-full bg-[#fff3e0] px-2 py-1 text-xs font-bold text-[#9b6200]">
                                        Belum diset
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-sm text-[#44537b]">
                                    {row.ketua?.assigned_by?.nama || "-"}
                                  </td>
                                  <td className="px-3 py-2">
                                    <select
                                      value={ketuaKlasterDraft[row.id] || ""}
                                      onChange={(event) =>
                                        handleKetuaKlasterDraftChange(row.id, event.target.value)
                                      }
                                      className="w-full min-w-[320px] rounded-lg border border-[#d3dbef] px-3 py-2 text-sm outline-none focus:border-[#2f63e3]"
                                    >
                                      <option value="">Pilih dosen ketua klaster</option>
                                      {(row.kandidat_dosen || []).map((item) => (
                                        <option key={`ketua-klaster-candidate-${row.id}-${item.id}`} value={item.id}>
                                          {item.nama} ({item.kode_dosen})
                                        </option>
                                      ))}
                                    </select>
                                  </td>
                                  <td className="px-3 py-2">
                                    <button
                                      type="button"
                                      disabled={savingKetuaKlasterId === row.id || !(row.kandidat_dosen || []).length}
                                      onClick={() => handleSaveKetuaKlaster(row)}
                                      className="inline-flex items-center gap-1 rounded-md bg-[#2f63e3] px-3 py-1.5 text-xs font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      <ClipboardList className="h-3.5 w-3.5" />
                                      {savingKetuaKlasterId === row.id ? "Menyimpan..." : "Simpan"}
                                    </button>
                                  </td>
                                </tr>
                              ))
                            : null}
                        </tbody>
                      </table>

                      {filteredKetuaKlasterRows.length === 0 ? (
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[41px] flex items-center justify-center px-4 text-center text-sm font-semibold text-[#7b88ab]">
                          Data klaster tidak ditemukan.
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#e8edf8] pt-3">
                      <p className="text-sm text-[#4f5e86]">
                        Menampilkan {ketuaKlasterRangeStart} - {ketuaKlasterRangeEnd} dari{" "}
                        {filteredKetuaKlasterRows.length} data klaster.
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setKetuaKlasterPage((prev) => Math.max(1, prev - 1))}
                          disabled={ketuaKlasterPage === 1}
                          className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] transition hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Sebelumnya
                        </button>
                        <span className="text-sm font-semibold text-[#314778]">
                          Halaman {ketuaKlasterPage} / {totalKetuaKlasterPages}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setKetuaKlasterPage((prev) => Math.min(totalKetuaKlasterPages, prev + 1))
                          }
                          disabled={ketuaKlasterPage >= totalKetuaKlasterPages}
                          className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] transition hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Berikutnya
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

                {false ? (
                  <div className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                    <h3 className="text-lg font-black text-[#1b274b]">Review Ringkas Periode</h3>
                    <p className="mt-1 text-sm text-[#5d6c91]">
                      Pastikan semua klaster sudah memiliki ketua sebelum periode diaktifkan.
                    </p>

                    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                      <div className="rounded-lg border border-[#e6ecf8] bg-[#f8fbff] p-3">
                        <p className="text-xs font-bold uppercase text-[#6b789d]">Periode Dipilih</p>
                        <p className="mt-1 text-lg font-black text-[#1b274b]">
                          {selectedKetuaPeriode?.label_periode || "-"}
                        </p>
                        <p className="text-sm text-[#5d6c91]">
                          Status: {formatLabel(selectedKetuaPeriode?.status || "draft")}
                        </p>
                      </div>
                      <div className="rounded-lg border border-[#e6ecf8] bg-[#f8fbff] p-3">
                        <p className="text-xs font-bold uppercase text-[#6b789d]">Ketua Terisi</p>
                        <p className="mt-1 text-lg font-black text-[#127947]">{ketuaReviewStats.terisi}</p>
                        <p className="text-sm text-[#5d6c91]">dari {ketuaReviewStats.total} klaster</p>
                      </div>
                      <div className="rounded-lg border border-[#e6ecf8] bg-[#fff8f0] p-3">
                        <p className="text-xs font-bold uppercase text-[#9b6200]">Belum Terisi</p>
                        <p className="mt-1 text-lg font-black text-[#b05616]">{ketuaReviewStats.belumTerisi}</p>
                        <p className="text-sm text-[#8c6a3b]">Harus 0 sebelum aktivasi</p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-lg border border-[#e6ecf8] bg-white p-3">
                      <h4 className="text-sm font-bold text-[#1f3160]">Checklist Aktivasi</h4>
                      <ul className="mt-2 space-y-2 text-sm">
                        <li className={ketuaReviewStats.total > 0 ? "text-[#127947]" : "text-[#a03f3f]"}>
                          • Master klaster tersedia
                        </li>
                        <li className={ketuaReviewStats.belumTerisi === 0 ? "text-[#127947]" : "text-[#a03f3f]"}>
                          • Semua klaster sudah punya ketua
                        </li>
                        <li className="text-[#4f5e86]">• Tidak ada periode aktif lain</li>
                      </ul>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={savingPeriode || !selectedKetuaPeriode}
                        onClick={handleActivateDraftPeriode}
                        className="rounded-lg bg-[#117246] px-4 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Aktifkan Periode
                      </button>
                    </div>
                  </div>
                ) : null}

                {periodeMode === "edit" ? (
                  <div className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                    <h3 className="text-lg font-black text-[#1b274b]">Detail Periode</h3>
                    <p className="mt-1 text-sm text-[#5d6c91]">
                      {isPeriodeReadonly
                        ? "Periode ini sudah selesai. Data ditampilkan sebagai detail."
                        : "Ubah tanggal periode dan kelola status aktif periode terpilih."}
                    </p>

                    <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm font-semibold text-[#344b7f]">Label Periode</label>
                        <input
                          type="text"
                          value={editingPeriode?.label_periode || "-"}
                          disabled
                          className="w-full rounded-lg border border-[#d3dbef] bg-[#f7f9ff] px-3 py-2 text-sm text-[#4f5d85]"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-semibold text-[#344b7f]">Semester</label>
                        <input
                          type="text"
                          value={editingPeriode?.semester ? formatLabel(editingPeriode.semester) : "-"}
                          disabled
                          className="w-full rounded-lg border border-[#d3dbef] bg-[#f7f9ff] px-3 py-2 text-sm text-[#4f5d85]"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-semibold text-[#344b7f]">Tanggal Mulai</label>
                        <input
                          type="date"
                          name="tanggal_mulai"
                          value={periodeEditForm.tanggal_mulai}
                          onChange={handlePeriodeEditInputChange}
                          disabled={isPeriodeReadonly}
                          className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${
                            isPeriodeReadonly
                              ? "border-[#d3dbef] bg-[#f7f9ff] text-[#4f5d85]"
                              : "border-[#d3dbef] focus:border-[#2f63e3]"
                          }`}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-semibold text-[#344b7f]">Tanggal Selesai</label>
                        <input
                          type="date"
                          name="tanggal_selesai"
                          value={periodeEditForm.tanggal_selesai}
                          onChange={handlePeriodeEditInputChange}
                          disabled={isPeriodeReadonly}
                          className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${
                            isPeriodeReadonly
                              ? "border-[#d3dbef] bg-[#f7f9ff] text-[#4f5d85]"
                              : "border-[#d3dbef] focus:border-[#2f63e3]"
                          }`}
                        />
                      </div>
                    </div>

                    <section className="mt-4 rounded-xl border border-[#e6ecf8] bg-[#f8fbff] p-4">
                      <p className="text-sm font-black uppercase tracking-wide text-[#2b4f9c]">
                        Penanggung Jawab Periode (Read Only)
                      </p>
                      <p className="mt-1 text-sm text-[#5d6c91]">
                        Data dosen di bawah ini hanya untuk dilihat dan mengikuti konfigurasi saat periode dibuka.
                      </p>

                      {periodeReadonlyRoles.loading ? (
                        <div className="mt-3 rounded-lg border border-[#dbe4f6] bg-white px-3 py-2 text-sm text-[#5d6c91]">
                          Memuat data penanggung jawab periode...
                        </div>
                      ) : null}

                      {periodeReadonlyRoles.error ? (
                        <div className="mt-3 rounded-lg border border-[#f2cccc] bg-[#fff6f6] px-3 py-2 text-sm font-semibold text-[#b13a3a]">
                          {periodeReadonlyRoles.error}
                        </div>
                      ) : null}

                      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
                        {RESEARCH_CLUSTER_EDITOR_FIELDS.map((cluster) => {
                          const row = periodeReadonlyKetuaByCluster.get(cluster.key);
                          const dosen = row?.ketua?.ketua_dosen || null;
                          return (
                            <div
                              key={`readonly-ketua-${cluster.key}`}
                              className="rounded-lg border border-[#dbe4f6] bg-white p-3"
                            >
                              <p className="text-xs font-black uppercase tracking-wide text-[#6f7da5]">{cluster.label}</p>
                              <p className="mt-1 text-sm font-semibold text-[#1f3160]">{dosen?.nama || "-"}</p>
                              <p className="text-xs text-[#5d6c91]">{dosen ? `${dosen.kode_dosen || "-"} • ${dosen.nik || "-"}` : "-"}</p>
                            </div>
                          );
                        })}
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-3">
                        {[
                          {
                            label: "Penanggung Jawab Jalur Magang",
                            dosen: editingPeriode?.pengawasMagangDosen,
                          },
                          {
                            label: "Penanggung Jawab Jalur Pengabdian Masyarakat",
                            dosen: editingPeriode?.pengawasPengabdianDosen,
                          },
                          {
                            label: "Penanggung Jawab Jalur Perintisan Bisnis",
                            dosen: editingPeriode?.pengawasPerintisanBisnisDosen,
                          },
                        ].map((item) => (
                          <div key={`readonly-jalur-${item.label}`} className="rounded-lg border border-[#dbe4f6] bg-white p-3">
                            <p className="text-xs font-black uppercase tracking-wide text-[#6f7da5]">{item.label}</p>
                            <p className="mt-1 text-sm font-semibold text-[#1f3160]">{item.dosen?.nama || "-"}</p>
                            <p className="text-xs text-[#5d6c91]">
                              {item.dosen ? `${item.dosen.kode_dosen || "-"} • ${item.dosen.nik || "-"}` : "-"}
                            </p>
                          </div>
                        ))}
                      </div>
                    </section>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {!isPeriodeReadonly ? (
                        <>
                          <button
                            type="button"
                            disabled={savingPeriode}
                            onClick={handleUpdatePeriodeTanggal}
                            className="rounded-lg bg-[#2f63e3] px-4 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Simpan Perubahan
                          </button>
                          <button
                            type="button"
                            disabled={savingPeriode || !editingPeriode?.is_active}
                            onClick={handleClosePeriodeFromEditor}
                            className="rounded-lg bg-[#b83a3a] px-4 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Tutup Periode
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </main>
        </div>
      </div>
      {mahasiswaMasterFilterPopup}
      {pendaftaranFilterPopup}
    </div>
  );
}

export default DosenWorkspacePage;
