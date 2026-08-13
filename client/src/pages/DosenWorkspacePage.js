import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  Activity,
  BookOpenCheck,
  Building2,
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
  Pencil,
  Plus,
  RefreshCcw,
  Save,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Trash2,
  Upload,
  GraduationCap,
  UserCircle2,
  Users,
  X,
} from "lucide-react";
import Swal from "sweetalert2";
import MenuSectionHeader from "../components/MenuSectionHeader";
import SupervisorAssignmentTimeline from "../components/SupervisorAssignmentTimeline";
import NotificationMenuBadge from "../components/NotificationMenuBadge";
import NotificationPage from "./NotificationPage";
import useNotifications from "../hooks/useNotifications";
import DosenBimbinganReviewPage from "./DosenBimbinganReviewPage";
import DosenDokumenSidangReviewPage from "./DosenDokumenSidangReviewPage";
import DosenSidangKetersediaanPage from "./DosenSidangKetersediaanPage";
import SekretarisSidangManagementPage from "./SekretarisSidangManagementPage";
import AcademicDataPanel from "../components/AcademicDataPanel";

const TOPIK_PAGE_SIZE = 20;
const MASTER_TOPIK_PAGE_SIZE = 20;
const MAHASISWA_MASTER_PAGE_SIZE = 20;
const DOSEN_GRID_PAGE_SIZE = 20;
const DOSEN_AVAILABILITY_PAGE_SIZE = 20;
const DOSEN_FOLLOW_UP_PAGE_SIZE = 20;
const MAHASISWA_MASTER_FILTER_INITIAL = {
  angkatan: "",
  program_kuliah: "",
  semester_penjaluran: "",
  periode: "",
  penjaluran: "",
  tipe_pendaftaran: "",
};
const MASTER_TOPIK_FILTER_INITIAL = {
  cluster: "",
  status: "",
  dosen: "",
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
  { key: "ketersediaan-periode", label: "Ketersediaan per Periode" },
  { key: "riwayat-penetapan", label: "Riwayat Pembimbing" },
  { key: "tindak-lanjut", label: "Tindak Lanjut" },
];
const SUPERVISOR_ASSIGNMENT_SOURCE_LABELS = {
  penjaluran: "Penjaluran",
  perpanjangan: "Perpanjangan",
  pergantian: "Pergantian",
  legacy_backfill: "Data Lama",
};
const SUPERVISOR_ASSIGNMENT_STATUS_LABELS = {
  draft: "Draft",
  scheduled: "Terjadwal",
  active: "Aktif",
  ended: "Berakhir",
  cancelled: "Dibatalkan",
};
const DOSEN_MASTER_STATUS_LABELS = {
  active: "Aktif",
  study_permission: "Izin Belajar",
  inactive: "Nonaktif Sementara",
  study_leave: "Tugas Belajar",
  retired: "Pensiun",
};
const MITRA_MAGANG_FORM_INITIAL = {
  nama: "",
  bidang_jenis: "",
  lokasi: "",
  email_kontak: "",
  website: "",
  status: "active",
  posisi_magang: "",
  quota_magang: "",
  kriteria: "",
  prosedur_perusahaan: "",
};
const MITRA_MAGANG_FORM_ERRORS_INITIAL = {
  nama: "",
  bidang_jenis: "",
  lokasi: "",
  status: "",
  quota_magang: "",
};
const MITRA_MAGANG_STATUS_FILTER_OPTIONS = [
  { value: "active", label: "Aktif" },
  { value: "inactive", label: "Nonaktif" },
  { value: "all", label: "Semua" },
];
const MAGANG_PROPOSED_POSITION_OPTIONS = [
  "analyst",
  "designer",
  "programmer",
  "tester",
  "network engineer",
  "data scientist",
  "other",
];
const MAGANG_COMPANY_SECTOR_OPTIONS = [
  "it industry",
  "goverment",
  "education/school",
  "economy/financial",
  "other",
];
const MAGANG_COMPANY_TYPE_OPTIONS = [
  { value: "partner_company", label: "Partner Company (name listed in the partner list)" },
  { value: "non_partner_company", label: "Non partner Company (name not listed in the partner list)" },
];
const MAGANG_APPLICATION_METHOD_OPTIONS = [
  "via Internship Vacancy",
  "Independent (no vacancy/via Direct Contact)",
  "other",
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
    requiredForRelease: false,
  },
  {
    key: "pengawas_perintisan_bisnis_dosen_id",
    label: "Dosen Pengampu Perintisan Bisnis",
    optionLabel: "Pilih dosen pengampu perintisan bisnis",
  },
];
const PERIODE_MASTER_ALL_FIELDS = [...PERIODE_MASTER_KETUA_FIELDS, ...PERIODE_MASTER_JALUR_FIELDS];
const PERIODE_MASTER_REQUIRED_FIELDS = PERIODE_MASTER_ALL_FIELDS.filter(
  (item) => item.requiredForRelease !== false
);
const PERIODE_MASTER_INITIAL = {
  ketua_itsc_dosen_id: "",
  ketua_sirkel_dosen_id: "",
  ketua_siber_dosen_id: "",
  ketua_mvk_dosen_id: "",
  pengawas_magang_dosen_id: "",
  pengawas_pengabdian_dosen_id: "",
  pengawas_perintisan_bisnis_dosen_id: "",
};

function sanitizeTwoDigitPositiveNumber(value) {
  return String(value || "")
    .replace(/\D/g, "")
    .slice(0, 2);
}

function formatAcademicYearInput(value) {
  const digits = String(value || "")
    .replace(/\D/g, "")
    .slice(0, 8);
  if (digits.length <= 4) return digits;
  return `${digits.slice(0, 4)}/${digits.slice(4)}`;
}

function getAcademicYearError(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{4})\/(\d{4})$/);
  if (!match) return "Gunakan format YYYY/YYYY, contoh 2026/2027.";

  const startYear = Number(match[1]);
  const endYear = Number(match[2]);
  if (!Number.isFinite(startYear) || !Number.isFinite(endYear) || endYear !== startYear + 1) {
    return "Tahun kedua harus satu tahun setelah tahun pertama, contoh 2026/2027.";
  }

  return "";
}

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
  label_periode: "",
  tanggal_mulai: "",
  tanggal_selesai: "",
};
const PERIODE_SETUP_STORAGE_KEY = "periode_penjaluran_setup";

function readStoredPeriodeSetup() {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PERIODE_SETUP_STORAGE_KEY) || "null");
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (_) {
    return null;
  }
}
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

function getSubmissionTopikCount(row) {
  if (!row || row.tipe_pengajuan !== "topik_dosen") return 0;
  const reviewerSlots = Array.isArray(row.reviewer_slot_decisions) ? row.reviewer_slot_decisions.length : 0;
  if (reviewerSlots > 0) return reviewerSlots;
  if (isKetuaClusterSubmissionReview(row)) return 1;
  const fromDetails = Array.isArray(row.topik_dipilih_detail) ? row.topik_dipilih_detail.length : 0;
  if (fromDetails > 0) return fromDetails;
  const fromCodes = Array.isArray(row.topik_dipilih) ? row.topik_dipilih.length : 0;
  return fromCodes;
}

function hasSameDosenTopikBadge(row) {
  if (!row || row.tipe_pengajuan !== "topik_dosen") return false;
  const reviewerSlots = Array.isArray(row.reviewer_slot_decisions) ? row.reviewer_slot_decisions : [];
  const reviewerSlotSet = new Set(reviewerSlots.map((item) => Number(item?.slot)).filter(Boolean));
  const allTopikDetails = Array.isArray(row.topik_dipilih_detail) ? row.topik_dipilih_detail : [];
  const topikDetails =
    reviewerSlotSet.size > 0 && !isKetuaClusterSubmissionReview(row)
      ? allTopikDetails.filter((item) => reviewerSlotSet.has(Number(item?.slot)))
      : allTopikDetails;
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

const DOSEN_PREFIX_TITLE_WORDS = new Set(["prof", "dr", "ir", "drs", "dra", "h", "hj"]);

function formatDosenFullName(namaValue, gelarValue) {
  const nama = String(namaValue || "").trim().replace(/\s+/g, " ");
  const gelar = String(gelarValue || "").trim().replace(/\s+/g, " ").replace(/\s*,\s*/g, ", ");
  if (!nama) return gelar;
  if (!gelar) return nama;
  const titleParts = gelar.split(",").map((item) => item.trim()).filter(Boolean);
  const prefixes = [];
  while (
    titleParts.length > 0
    && titleParts[0].split(" ").filter(Boolean).every(
      (word) => DOSEN_PREFIX_TITLE_WORDS.has(word.replace(/\./g, "").toLowerCase())
    )
  ) {
    prefixes.push(titleParts.shift());
  }
  return `${prefixes.length ? `${prefixes.join(" ")} ` : ""}${nama}${titleParts.length ? `, ${titleParts.join(", ")}` : ""}`;
}

function ReplacementDosenCombobox({
  candidates = [],
  value,
  onChange,
  hasError = false,
  placeholder = "Cari nama atau kode dosen...",
  allowEmpty = false,
  inputId,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedDosen = candidates.find((candidate) => Number(candidate.id) === Number(value)) || null;
  const selectedLabel = selectedDosen ? formatDosenFullName(selectedDosen.nama, selectedDosen.gelar) : "";
  const [query, setQuery] = useState(selectedLabel);

  useEffect(() => {
    if (!isOpen) setQuery(selectedLabel);
  }, [isOpen, selectedLabel]);

  const normalizedQuery = query.trim().toLowerCase();
  const isSelectedLabel = selectedLabel && normalizedQuery === selectedLabel.toLowerCase();
  const filteredCandidates = candidates.filter((candidate) => {
    if (!normalizedQuery || isSelectedLabel) return true;
    return [
      formatDosenFullName(candidate.nama, candidate.gelar),
      candidate.kode_dosen,
      candidate.nik,
      candidate.email,
    ].some((item) => String(item || "").toLowerCase().includes(normalizedQuery));
  });

  const clearSelection = () => {
    setQuery("");
    onChange("");
    setIsOpen(true);
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7282a8]" />
        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls={`${inputId}-options`}
          value={query}
          onFocus={() => setIsOpen(true)}
          onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
          onChange={(event) => {
            setQuery(event.target.value);
            if (value) onChange("");
            setIsOpen(true);
          }}
          placeholder={placeholder}
          className={`w-full rounded-lg border bg-white py-2.5 pl-9 pr-10 text-sm outline-none ${
            hasError
              ? "border-[#d64545] focus:border-[#d64545]"
              : "border-[#d3dbef] focus:border-[#2f63e3]"
          }`}
        />
        {allowEmpty && (value || query) ? (
          <button
            type="button"
            aria-label="Kosongkan pembimbing kedua"
            onMouseDown={(event) => event.preventDefault()}
            onClick={clearSelection}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7b88a8] hover:text-[#344a7a]"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {isOpen ? (
        <div
          id={`${inputId}-options`}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-40 max-h-[260px] overflow-y-auto rounded-lg border border-[#d9e3fb] bg-white shadow-lg"
        >
          {allowEmpty ? (
            <button
              type="button"
              role="option"
              aria-selected={!value}
              onMouseDown={(event) => event.preventDefault()}
              onClick={clearSelection}
              className="flex min-h-[52px] w-full items-center border-b border-[#edf1fb] px-3 py-2 text-left text-sm font-semibold text-[#526184] hover:bg-[#f4f7ff]"
            >
              Tidak ada pembimbing kedua
            </button>
          ) : null}
          {filteredCandidates.length > 0 ? filteredCandidates.map((candidate) => {
            const capacity = candidate.kuota && typeof candidate.kuota === "object" ? candidate.kuota : null;
            const remainingCapacity = candidate.sisa ?? capacity?.sisa ?? 0;
            const totalCapacity = candidate.kuota_total ?? capacity?.total ?? candidate.kuota ?? 0;
            return (
            <button
              key={`${inputId}-${candidate.id}`}
              type="button"
              role="option"
              aria-selected={Number(value) === Number(candidate.id)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(String(candidate.id));
                setQuery(formatDosenFullName(candidate.nama, candidate.gelar));
                setIsOpen(false);
              }}
              className={`flex min-h-[52px] w-full items-center justify-between gap-3 border-b border-[#edf1fb] px-3 py-2 text-left last:border-b-0 hover:bg-[#f4f7ff] ${
                Number(value) === Number(candidate.id) ? "bg-[#eaf0ff]" : "bg-white"
              }`}
            >
              <span className="min-w-0"><span className="block truncate text-sm font-bold text-[#263a66]">{formatDosenFullName(candidate.nama, candidate.gelar)}</span><span className="block text-xs text-[#7282a8]">{candidate.kode_dosen || candidate.nik || candidate.email || "-"}</span></span>
              <span className="shrink-0 text-xs font-semibold text-[#526184]">Sisa {remainingCapacity}/{totalCapacity}</span>
            </button>
            );
          }) : (
            <p className="px-3 py-4 text-center text-sm font-semibold text-[#7282a8]">Dosen tidak ditemukan.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function ResearchReviewReadonlyInput({ label, value }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-semibold text-[#324c86]">{label}</label>
      <input
        type="text"
        readOnly
        disabled
        value={value || ""}
        className="w-full cursor-default rounded-lg border border-[#d2dcef] bg-[#f3f5fb] px-3 py-2 text-sm text-[#5c6888] outline-none disabled:cursor-default disabled:bg-[#f3f5fb] disabled:text-[#8b97b6]"
      />
    </div>
  );
}

function ResearchReviewReadonlyTextarea({ label, value, rows = 4 }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-semibold text-[#324c86]">{label}</label>
      <textarea
        rows={rows}
        readOnly
        disabled
        value={value || ""}
        className="w-full cursor-default rounded-lg border border-[#d2dcef] bg-[#f3f5fb] px-3 py-2 text-sm text-[#5c6888] outline-none disabled:cursor-default disabled:bg-[#f3f5fb] disabled:text-[#8b97b6]"
      />
    </div>
  );
}

function ResearchReviewDetailForm({ detail, topikRows = [] }) {
  const isJudulMandiri = detail?.tipe_pengajuan === "judul_mandiri";

  if (isJudulMandiri) {
    return (
      <section className="bg-white">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <ResearchReviewReadonlyInput label="Judul Penelitian" value={detail.detail_pengajuan?.judul_mandiri || "-"} />
          <ResearchReviewReadonlyInput label="Keyword" value={detail.detail_pengajuan?.keyword_mandiri || "-"} />
        </div>
        <div className="mt-4">
          <ResearchReviewReadonlyTextarea label="Deskripsi Singkat" value={detail.detail_pengajuan?.deskripsi_mandiri || "-"} />
        </div>
        <div className="mt-4">
          <ResearchReviewReadonlyInput label="Cluster Penelitian" value={detail.detail_pengajuan?.cluster_mandiri || "-"} />
          <p className="mt-1 text-xs text-[#60709a]">
            Cluster ini menentukan daftar calon dosen dan ketua cluster yang akan mereview setelah dosen pembimbing.
          </p>
        </div>
        <div className="mt-4">
          <ResearchReviewReadonlyInput
            label="Calon Dosen Pembimbing"
            value={formatDosenFullName(
              detail.detail_pengajuan?.calon_dosen_pembimbing?.nama || detail.hasil_pengajuan?.dosen_pembimbing?.nama,
              detail.detail_pengajuan?.calon_dosen_pembimbing?.gelar || detail.hasil_pengajuan?.dosen_pembimbing?.gelar
            ) || "-"}
          />
        </div>
      </section>
    );
  }

  return (
    <section className="bg-white">
      <div className="space-y-5">
        {topikRows.length > 0 ? (
          topikRows.map((item, index) => (
            <div key={`research-review-topic-${item.slot || index}-${item.kode || "none"}`}>
              <h3 className="text-sm font-black text-[#1b274b]">Topik Pilihan {item.slot || index + 1}</h3>
              <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
                <ResearchReviewReadonlyInput label="Judul Penelitian" value={item.judul || "-"} />
                <ResearchReviewReadonlyInput label="Keyword" value={item.keyword || "-"} />
              </div>
              <div className="mt-4">
                <ResearchReviewReadonlyTextarea
                  label="Deskripsi Singkat"
                  value={item.deskripsi || item.description || item.ringkasan || "-"}
                />
              </div>
              <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
                <div>
                  <ResearchReviewReadonlyInput label="Cluster Penelitian" value={item.cluster || "-"} />
                  <p className="mt-1 text-xs text-[#60709a]">
                    Cluster ini menentukan daftar calon dosen dan ketua cluster yang akan mereview setelah dosen pembimbing.
                  </p>
                </div>
                <ResearchReviewReadonlyInput label="Calon Dosen Pembimbing" value={item.dosen || "-"} />
              </div>
              <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
                <ResearchReviewReadonlyInput label="Kode Topik" value={item.kode || "-"} />
                <ResearchReviewReadonlyInput label="Status Review" value={formatLabel(item.reviewer_status || "pending")} />
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-lg border border-[#e8ecf8] bg-[#f8fbff] p-4 text-sm font-semibold text-[#5f6b89]">
            Detail topik belum tersedia.
          </div>
        )}
      </div>
    </section>
  );
}

function formatPeriodeMasterDosenInputLabel(dosen) {
  if (!dosen) return "";
  const nama = formatDosenFullName(dosen?.nama, dosen?.gelar);
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

function pickFormattedMagangValue(values) {
  for (const value of values) {
    const formatted = formatMagangPayloadValue(value);
    if (formatted !== "-") return formatted;
  }
  return "-";
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

function getMagangMitraSnapshot(row) {
  const payload = getMagangPayload(row);
  return payload.mitra_snapshot && typeof payload.mitra_snapshot === "object" && !Array.isArray(payload.mitra_snapshot)
    ? payload.mitra_snapshot
    : {};
}

function getMagangCompanyName(row) {
  const payload = getMagangPayload(row);
  const snapshot = getMagangMitraSnapshot(row);
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

function getMagangCompanySectorLabel(row) {
  const payload = getMagangPayload(row);
  return payload.company_sector === "other"
    ? formatMagangPayloadValue(payload.company_sector_other)
    : formatLabel(payload.company_sector);
}

function getMagangProposedPositionLabel(row) {
  const payload = getMagangPayload(row);
  return payload.proposed_position === "other"
    ? formatMagangPayloadValue(payload.proposed_position_other)
    : formatLabel(payload.proposed_position);
}

function getMagangApplicationMethodLabel(row) {
  const payload = getMagangPayload(row);
  return payload.internship_application_method === "other"
    ? formatMagangPayloadValue(payload.internship_application_method_other)
    : formatLabel(payload.internship_application_method);
}

function getMagangMitraGridData(row) {
  const payload = getMagangPayload(row);
  const snapshot = getMagangMitraSnapshot(row);
  return {
    nama: getMagangCompanyName(row),
    bidang_jenis: pickFormattedMagangValue([snapshot.bidang_jenis, getMagangCompanySectorLabel(row)]),
    lokasi: pickFormattedMagangValue([snapshot.lokasi, payload.complete_address_of_institution]),
    email_kontak: pickFormattedMagangValue([snapshot.email_kontak]),
    website: pickFormattedMagangValue([snapshot.website, payload.internship_company_website_url]),
    posisi_magang: pickFormattedMagangValue([snapshot.posisi_magang, getMagangProposedPositionLabel(row)]),
    quota_magang: pickFormattedMagangValue([snapshot.quota_magang]),
    kriteria: pickFormattedMagangValue([snapshot.kriteria]),
    prosedur_perusahaan: pickFormattedMagangValue([
      snapshot.prosedur_perusahaan,
      getMagangApplicationMethodLabel(row),
      payload.selection_processes,
    ]),
  };
}

function getMagangReviewStatus(row) {
  return row?.workflow_status || row?.form_lanjutan_status || "-";
}

function getMagangStatusBadgeClass(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "approved") return "bg-[#137748] text-white";
  if (normalized === "rejected") return "bg-[#b73a3a] text-white";
  if (normalized === "cancelled") return "bg-[#eef2f7] text-[#526078]";
  if (normalized === "review_dosen_magang") return "bg-[#eaf1ff] text-[#2756b8]";
  if (normalized === "review_sekprodi") return "bg-[#fff4d8] text-[#9b6b00]";
  if (normalized === "submitted") return "bg-[#fdf1d4] text-[#a06a00]";
  return "bg-[#eef2fb] text-[#5c6d95]";
}

function ReadonlyMagangInput({ label, value, wide = false }) {
  return (
    <div className={wide ? "md:col-span-2 xl:col-span-3" : ""}>
      <label className="mb-2 block text-sm font-semibold text-[#324c86]">{label}</label>
      <input
        type="text"
        readOnly
        disabled
        value={value || ""}
        className="w-full cursor-default rounded-lg border border-[#d0dbf4] bg-[#f3f5fb] px-3 py-2 text-sm text-[#596789] outline-none disabled:cursor-default"
      />
    </div>
  );
}

function ReadonlyMagangTextarea({ label, value, rows = 3 }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-[#324c86]">{label}</label>
      <textarea
        rows={rows}
        readOnly
        disabled
        value={value || ""}
        className="w-full cursor-default rounded-lg border border-[#d0dbf4] bg-[#f3f5fb] px-3 py-2 text-sm text-[#596789] outline-none disabled:cursor-default"
      />
    </div>
  );
}

function ReadonlyMagangRadioGroup({ label, name, options, value, columns = "md:grid-cols-2" }) {
  return (
    <div>
      {label ? <p className="mb-2 text-sm font-semibold text-[#324c86]">{label}</p> : null}
      <div className={`grid grid-cols-1 gap-2 ${columns}`}>
        {options.map((option) => {
          const optionValue = typeof option === "string" ? option : option.value;
          const optionLabel = typeof option === "string" ? option : option.label;
          return (
            <label
              key={`${name}-${optionValue}`}
              className="flex items-center gap-2 rounded-lg border border-[#dce4f5] bg-[#f7f9fe] px-3 py-2 text-sm text-[#334772]"
            >
              <input type="radio" name={name} disabled checked={String(value || "") === String(optionValue)} readOnly />
              <span>{optionLabel}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function ReadonlyMagangFileField({ label, value, onOpen }) {
  const hasFile = Boolean(value && value !== "-");
  const canOpen = hasFile && typeof onOpen === "function";
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-[#324c86]">{label}</label>
      <div className="flex min-h-[42px] items-center gap-2 rounded-lg border border-[#d0dbf4] bg-[#f3f5fb] px-3 py-2 text-sm text-[#596789]">
        <button
          type="button"
          disabled={!canOpen}
          onClick={onOpen}
          style={{ all: "revert", flexShrink: 0, whiteSpace: "nowrap" }}
          title={canOpen ? `Lihat ${label}` : "File belum tersedia"}
        >
          Lihat File
        </button>
        <span className="truncate">{hasFile ? value : "No file chosen"}</span>
      </div>
    </div>
  );
}

function MagangReadonlyDetailForm({ detail, onOpenDocument }) {
  const payload = getMagangPayload(detail);
  const mahasiswa = detail?.mahasiswa || {};
  const isNonPartner = payload.company_type === "non_partner_company";
  const uploadedDocuments =
    payload.uploaded_documents && typeof payload.uploaded_documents === "object" && !Array.isArray(payload.uploaded_documents)
      ? payload.uploaded_documents
      : {};
  const makeDocumentOpenHandler = (documentKey, fallbackName) => {
    const metadata = uploadedDocuments[documentKey];
    const fileName = metadata?.original_name || fallbackName || "-";
    if (!metadata || !fileName || fileName === "-" || typeof onOpenDocument !== "function") return undefined;
    return () => onOpenDocument(documentKey, fileName);
  };
  const applyStatusValue =
    payload.sudah_apply_ke_mitra === true || String(payload.sudah_apply_ke_mitra).toLowerCase() === "true"
      ? "true"
      : "false";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ReadonlyMagangInput label="NIM" value={mahasiswa.nim || "-"} />
        <ReadonlyMagangInput label="Nama" value={mahasiswa.nama || "-"} />
      </div>

      <ReadonlyMagangInput label="Phone number" value={payload.phone_number || "-"} wide />

      <ReadonlyMagangRadioGroup
        label="Type of Company"
        name={`review-company-type-${detail.id}`}
        options={MAGANG_COMPANY_TYPE_OPTIONS}
        value={payload.company_type}
        columns="grid-cols-1"
      />

      {!isNonPartner ? (
        <>
          {payload.mitra_snapshot ? (
            <div>
              <h3 className="text-sm font-black text-[#1b274b]">Detail Mitra Magang Terpilih</h3>
              <p className="mt-1 text-xs text-[#5d6c91]">Snapshot mitra yang dipilih saat form dikirim.</p>
              <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                <ReadonlyMagangInput label="Nama Mitra" value={payload.mitra_snapshot.nama || "-"} />
                <ReadonlyMagangInput label="Bidang / Jenis" value={payload.mitra_snapshot.bidang_jenis || "-"} />
                <ReadonlyMagangInput label="Lokasi" value={payload.mitra_snapshot.lokasi || "-"} />
                <ReadonlyMagangInput label="Website" value={payload.mitra_snapshot.website || "-"} />
                <ReadonlyMagangInput label="Posisi Magang" value={payload.mitra_snapshot.posisi_magang || "-"} />
                <ReadonlyMagangInput label="Quota Magang" value={payload.mitra_snapshot.quota_magang ?? "-"} />
              </div>
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <ReadonlyMagangTextarea label="Kriteria" value={payload.mitra_snapshot.kriteria || "-"} rows={2} />
                <ReadonlyMagangTextarea
                  label="Prosedur dari Perusahaan"
                  value={payload.mitra_snapshot.prosedur_perusahaan || "-"}
                  rows={2}
                />
              </div>
            </div>
          ) : null}

          <div className="space-y-4">
            <ReadonlyMagangInput label="Chosen Institution" value={payload.chosen_institution || "-"} wide />
            <ReadonlyMagangTextarea
              label="Complete address of the institution"
              value={payload.complete_address_of_institution || "-"}
            />
          </div>
        </>
      ) : (
        <>
          <div className="rounded-lg border border-[#e4ebf9] bg-[#f9fbff] p-4">
            <h3 className="text-sm font-black text-[#1b274b]">Data Tambahan Non Partner Company</h3>
            <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
              <ReadonlyMagangInput label="Company name" value={payload.company_name || "-"} />
              <ReadonlyMagangInput label="Year of establishment" value={payload.year_of_establishment || "-"} />
              <ReadonlyMagangInput label="Number of employees" value={payload.number_of_employees || "-"} />
            </div>
            <div className="mt-4">
              <ReadonlyMagangRadioGroup
                label="Internship Application method"
                name={`review-internship-method-${detail.id}`}
                options={MAGANG_APPLICATION_METHOD_OPTIONS}
                value={payload.internship_application_method}
                columns="grid-cols-1"
              />
              {payload.internship_application_method === "other" ? (
                <div className="mt-3">
                  <ReadonlyMagangInput
                    label="Metode lainnya"
                    value={payload.internship_application_method_other || "-"}
                  />
                </div>
              ) : null}
            </div>
            <div className="mt-4">
              <ReadonlyMagangTextarea
                label="Selection Processes (satu baris = satu proses)"
                value={
                  Array.isArray(payload.selection_processes)
                    ? payload.selection_processes.join("\n")
                    : payload.selection_processes || "-"
                }
                rows={4}
              />
            </div>
          </div>
          <ReadonlyMagangTextarea
            label="Complete address of the institution"
            value={payload.complete_address_of_institution || "-"}
          />
        </>
      )}

      <ReadonlyMagangRadioGroup
        label="Proposed / Expected Position"
        name={`review-proposed-position-${detail.id}`}
        options={MAGANG_PROPOSED_POSITION_OPTIONS}
        value={payload.proposed_position}
      />
      {payload.proposed_position === "other" ? (
        <ReadonlyMagangInput label="Posisi lainnya" value={payload.proposed_position_other || "-"} wide />
      ) : null}

      <ReadonlyMagangRadioGroup
        label="Company Sector"
        name={`review-company-sector-${detail.id}`}
        options={MAGANG_COMPANY_SECTOR_OPTIONS}
        value={payload.company_sector}
      />
      {payload.company_sector === "other" ? (
        <ReadonlyMagangInput label="Sektor lainnya" value={payload.company_sector_other || "-"} wide />
      ) : null}

      <div className="rounded-lg border border-[#e4ebf9] bg-[#f9fbff] p-4">
        <h3 className="text-sm font-black text-[#1b274b]">Konfirmasi Apply ke Mitra</h3>
        <p className="mt-1 text-xs text-[#5d6c91]">Status apply mahasiswa pada saat form dikirim.</p>
        <div className="mt-3">
          <ReadonlyMagangRadioGroup
            label=""
            name={`review-apply-status-${detail.id}`}
            options={[
              { value: "true", label: "Sudah apply ke mitra magang" },
              { value: "false", label: "Belum apply ke mitra magang" },
            ]}
            value={applyStatusValue}
          />
        </div>
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
          <ReadonlyMagangInput label="Tanggal apply" value={payload.tanggal_apply || "-"} />
          <ReadonlyMagangInput
            label="Metode apply"
            value={
              { email: "Email", portal_website: "Portal / Website", walk_in: "Walk-in / Langsung" }[
                payload.metode_apply
              ] || payload.metode_apply || "-"
            }
          />
          {uploadedDocuments.bukti_apply || payload.bukti_apply_file_name ? (
            <ReadonlyMagangFileField
              label="File bukti apply"
              value={uploadedDocuments.bukti_apply?.original_name || payload.bukti_apply_file_name || "-"}
              onOpen={makeDocumentOpenHandler("bukti_apply", payload.bukti_apply_file_name)}
            />
          ) : null}
          <ReadonlyMagangInput label="Catatan tambahan" value={payload.bukti_apply || "-"} />
        </div>
      </div>

      <div className="rounded-lg border border-[#e4ebf9] bg-[#f9fbff] p-4">
        <h3 className="text-sm font-black text-[#1b274b]">Dokumen Pendukung</h3>
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
          <ReadonlyMagangFileField
            label="Upload CV"
            value={uploadedDocuments.cv?.original_name || payload.cv_file_name || "-"}
            onOpen={makeDocumentOpenHandler("cv", payload.cv_file_name)}
          />
          <ReadonlyMagangFileField
            label="Upload portfolios of Past Work"
            value={uploadedDocuments.portfolio?.original_name || payload.portfolio_file_name || "-"}
            onOpen={makeDocumentOpenHandler("portfolio", payload.portfolio_file_name)}
          />
          <ReadonlyMagangFileField
            label="Upload Academic Transcript"
            value={uploadedDocuments.transcript?.original_name || payload.transcript_file_name || "-"}
            onOpen={makeDocumentOpenHandler("transcript", payload.transcript_file_name)}
          />
          <ReadonlyMagangFileField
            label="Upload other supporting documents"
            value={
              uploadedDocuments.other_supporting_documents?.original_name ||
              payload.other_supporting_documents_file_name ||
              "-"
            }
            onOpen={makeDocumentOpenHandler(
              "other_supporting_documents",
              payload.other_supporting_documents_file_name
            )}
          />
          <ReadonlyMagangInput
            label="Internship Company website URL"
            value={payload.internship_company_website_url || "-"}
          />
          <ReadonlyMagangInput label="Internship vacancy URL (opsional)" value={payload.internship_vacancy_url || "-"} />
        </div>
        <div className="mt-4">
          <ReadonlyMagangFileField
            label="Catatan dokumen pendukung (wajib jika internship vacancy URL kosong)"
            value={uploadedDocuments.supporting_documents_note?.original_name || payload.supporting_documents_note || "-"}
            onOpen={makeDocumentOpenHandler("supporting_documents_note", payload.supporting_documents_note)}
          />
        </div>
      </div>
    </div>
  );
}

function PerintisanReadonlyDetailForm({ detail, onOpenDocument }) {
  const payload = getMagangPayload(detail);
  const members = Array.isArray(payload.kelompok?.anggota)
    ? payload.kelompok.anggota
    : [payload.ketua, ...(Array.isArray(payload.anggota) ? payload.anggota : [])].filter(Boolean);
  const uploadedDocuments =
    payload.uploaded_documents && typeof payload.uploaded_documents === "object" && !Array.isArray(payload.uploaded_documents)
      ? payload.uploaded_documents
      : {};
  const dokumenPendukung = uploadedDocuments.dokumen_pendukung || null;
  const openDokumenPendukung =
    dokumenPendukung && typeof onOpenDocument === "function"
      ? () => onOpenDocument(
          "dokumen_pendukung",
          dokumenPendukung.original_name || payload.dokumen_pendukung || "dokumen-pendukung"
        )
      : undefined;

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-[#e4e9f6] bg-white p-6 shadow-sm">
        <h2 className="text-xl font-black text-[#1b274b]">Form Pengajuan Perintisan Bisnis</h2>
        <p className="mt-1 text-sm text-[#5d6c91]">
          Tampilan read-only dari form yang telah dikirim oleh ketua kelompok.
        </p>
      </section>

      <section className="rounded-xl border border-[#e4e9f6] bg-white p-6 shadow-sm">
        <h3 className="text-lg font-black text-[#1b274b]">Data Kelompok</h3>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          {members.length > 0 ? members.map((member) => (
            <div
              key={`readonly-perintisan-member-${member.mahasiswa_id || member.nim}`}
              className="rounded-lg border border-[#dce5f7] bg-[#f8fbff] px-4 py-3"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-bold uppercase text-[#7180a5]">
                  {member.posisi === "ketua" ? "Ketua" : "Anggota"}
                </p>
                <span className="rounded-md bg-[#e7eeff] px-2 py-1 text-xs font-bold uppercase text-[#3157b7]">
                  {member.peran_tim || "-"}
                </span>
              </div>
              <p className="mt-2 font-bold text-[#1b274b]">{member.nama || "-"}</p>
              <p className="text-sm text-[#5d6c91]">{member.nim || "-"}</p>
              <p className="mt-1 text-xs text-[#7180a5]">
                Pendaftaran {formatLabel(member.jenis_pendaftaran || "-")}
              </p>
            </div>
          )) : (
            <p className="text-sm text-[#5d6c91]">Data kelompok tidak tersedia.</p>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-[#e4e9f6] bg-white p-6 shadow-sm">
        <h3 className="text-lg font-black text-[#1b274b]">Detail Perintisan Bisnis</h3>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <ReadonlyMagangInput label="Nama Bisnis" value={payload.nama_bisnis || "-"} />
          <ReadonlyMagangInput label="Jenis Bisnis" value={payload.jenis_bisnis || "-"} />
          <div className="md:col-span-2"><ReadonlyMagangInput label="Lokasi Bisnis" value={payload.lokasi_bisnis || "-"} /></div>
          <div className="md:col-span-2"><ReadonlyMagangTextarea label="Deskripsi Bisnis" value={payload.deskripsi_bisnis || "-"} /></div>
          <div className="md:col-span-2"><ReadonlyMagangTextarea label="Permasalahan yang Ingin Diselesaikan" value={payload.masalah_yang_diselesaikan || "-"} /></div>
          <div className="md:col-span-2"><ReadonlyMagangTextarea label="Produk atau Layanan" value={payload.produk_layanan || "-"} /></div>
          <div className="md:col-span-2"><ReadonlyMagangTextarea label="Target Pengguna atau Konsumen" value={payload.target_konsumen || "-"} /></div>
          <div className="md:col-span-2"><ReadonlyMagangTextarea label="Model Bisnis" value={payload.model_bisnis || "-"} /></div>
          <div className="md:col-span-2"><ReadonlyMagangTextarea label="Tahap Perkembangan Bisnis" value={payload.tahap_perkembangan || "-"} /></div>
          <div className="md:col-span-2"><ReadonlyMagangTextarea label="Rencana Kegiatan Selama Penjaluran" value={payload.rencana_kegiatan || "-"} /></div>
          <div className="md:col-span-2"><ReadonlyMagangTextarea label="Target atau Luaran" value={payload.target_luaran || "-"} /></div>
          <div className="md:col-span-2"><ReadonlyMagangInput label="Tautan Bisnis / Media Sosial" value={payload.tautan_bisnis || "-"} /></div>
        </div>
      </section>

      <section className="rounded-xl border border-[#e4e9f6] bg-white p-6 shadow-sm">
        <h3 className="text-lg font-black text-[#1b274b]">Dokumen dan Pernyataan</h3>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <ReadonlyMagangFileField
              label="Dokumen Pendukung"
              value={dokumenPendukung?.original_name || payload.dokumen_pendukung || "-"}
              onOpen={openDokumenPendukung}
            />
            <p className="mt-1 text-xs text-[#6b789d]">Format: PDF, DOC, atau DOCX. Maks 5 MB.</p>
          </div>
          <div className="md:col-span-2">
            <ReadonlyMagangTextarea label="Catatan Tambahan" value={payload.catatan || "-"} />
          </div>
        </div>
      </section>
    </div>
  );
}

function NonPenelitianDecisionResultSection({ detail }) {
  const payload = getMagangPayload(detail);
  const reviewDosen = payload.review_dosen_pengampu || null;
  const reviewFinal = payload.review_result || null;
  const dosenPembimbing = payload.dosen_pembimbing || detail?.dosen_pembimbing || null;

  return (
    <section className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
      <div className="mb-3">
        <h3 className="text-lg font-black text-[#1b274b]">Hasil Keputusan</h3>
        <p className="mt-1 text-sm text-[#5d6c91]">
          Ringkasan keputusan dosen pengampu dan keputusan final Sekretaris Prodi.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <ReadonlyMagangInput label="Keputusan Dosen Pengampu" value={reviewDosen?.status ? formatLabel(reviewDosen.status) : "Belum ada keputusan"} />
        <ReadonlyMagangInput label="Keputusan Final Sekprodi" value={reviewFinal?.status ? formatLabel(reviewFinal.status) : "Belum ada keputusan"} />
        <ReadonlyMagangInput
          label="Dosen Pembimbing"
          value={formatDosenFullName(dosenPembimbing?.nama, dosenPembimbing?.gelar) || dosenPembimbing?.nama || "Belum ditetapkan"}
        />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <ReadonlyMagangTextarea label="Catatan Dosen Pengampu" value={reviewDosen?.note || "-"} rows={2} />
        <ReadonlyMagangTextarea label="Catatan Sekretaris Prodi" value={reviewFinal?.note || "-"} rows={2} />
      </div>
    </section>
  );
}

function getPengampuReviewStatus(row) {
  return row?.workflow_status || row?.form_lanjutan_status || "-";
}

function getPengampuReviewSummary(row) {
  const payload = getMagangPayload(row);
  if (row?.jalur === "magang") {
    const companyName = getMagangCompanyName(row);
    const position = pickMagangPayloadText(row, ["proposed_position_other", "proposed_position"]);
    return [companyName, position !== "-" ? formatLabel(position) : null].filter(Boolean).join(" - ") || "-";
  }
  return formatMagangPayloadValue(
    payload.ringkasan || payload.nama_bisnis || payload.nama_program
  );
}

function getPengampuReviewNote(row) {
  return formatMagangPayloadValue(getMagangPayload(row).catatan);
}

function getFinalResearchChosenTopic(row) {
  const topics = Array.isArray(row?.topik) ? row.topik : [];
  return topics.find((topic) => topic?.dipilih) || topics.find((topic) => topic?.status === "approved") || topics[0] || null;
}

function getFinalResearchReadyTopics(row) {
  const readyTopics = Array.isArray(row?.topik_lolos_cluster) ? row.topik_lolos_cluster : [];
  if (readyTopics.length > 0) {
    return [...readyTopics].sort((left, right) => Number(left?.slot || 0) - Number(right?.slot || 0));
  }
  const chosenTopic = getFinalResearchChosenTopic(row);
  return chosenTopic ? [chosenTopic] : [];
}

function getFinalResearchTopicKey(topic) {
  return topic?.slot != null ? String(topic.slot) : "judul-mandiri";
}

function getFinalResearchTitle(row) {
  const topic = getFinalResearchChosenTopic(row);
  if (!topic) return "-";
  const topicType = row?.tipe_pengajuan === "judul_mandiri" ? "Judul Mandiri" : "Topik Dosen";
  const slotLabel = topic.slot ? `Pilihan ${topic.slot}` : topicType;
  const codeLabel = topic.kode ? ` - ${topic.kode}` : "";
  return `${slotLabel}${codeLabel}: ${topic.judul || "-"}`;
}

function getFinalResearchSummary(row) {
  const topic = getFinalResearchChosenTopic(row);
  const topicType = row?.tipe_pengajuan === "judul_mandiri" ? "Judul Mandiri" : "Topik Dosen";
  return [
    topicType,
    topic?.dosen_nama ? `Dosen: ${formatDosenFullName(topic.dosen_nama, topic.dosen_gelar)}` : null,
    row?.ketua_cluster?.nama ? `Ketua Cluster: ${formatDosenFullName(row.ketua_cluster.nama, row.ketua_cluster.gelar)}` : null,
  ]
    .filter(Boolean)
    .join(" | ") || "-";
}

function getFinalApprovalStageLabel(row, isResearch) {
  if (isResearch) return "Menunggu Keputusan Final Sekprodi";
  return row?.workflow_status_label || "Menunggu Keputusan Final Sekprodi";
}

function getFinalApprovalReviewerLabel(row, isResearch) {
  if (isResearch) return "Sekretaris Prodi";
  const status = String(row?.workflow_status || row?.form_lanjutan_status || "").trim().toLowerCase();
  if (status === "review_sekprodi") return "Sekretaris Prodi";
  const role = String(row?.reviewer_target?.role || "").trim().toLowerCase();
  if (role === "pengawas_magang" || role === "dosen_pengawas_magang") return "Dosen Pengawas Magang";
  if (role.includes("pengabdian")) return "Dosen Pengampu Pengabdian";
  if (role.includes("perintisan")) return "Dosen Pengampu Perintisan";
  return formatLabel(role || "-");
}

function getFinalDecisionTimelineStatusChip(status) {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "approved") {
    return { label: "Approved", className: "bg-[#137748] text-white" };
  }
  if (normalized === "rejected") {
    return { label: "Rejected", className: "bg-[#b73a3a] text-white" };
  }
  if (normalized === "review_sekprodi") {
    return { label: "Menunggu Sekprodi", className: "bg-[#e8efff] text-[#2f63e3]" };
  }
  if (normalized === "submitted" || normalized === "review_dosen_magang") {
    return { label: "Menunggu Review Dosen", className: "bg-[#fdf1d4] text-[#a06a00]" };
  }
  return { label: formatLabel(status || "-"), className: "bg-[#eef2fb] text-[#5c6d95]" };
}

function getFinalDecisionTimelineActorLabel(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "";
  if (normalized === "mahasiswa") return "Mahasiswa";
  if (normalized === "system") return "Sistem";
  if (normalized === "dosen_pengawas_magang") return "Dosen Pengawas Magang";
  if (normalized === "dosen_pengampu_pengabdian") return "Dosen Pengampu Pengabdian Masyarakat";
  if (normalized === "dosen_pengampu_perintisan_bisnis") return "Dosen Pengampu Perintisan Bisnis";
  if (normalized === "sekretaris_prodi") return "Sekretaris Prodi";
  return formatLabel(value);
}

function getFinalDecisionTimelineNoteDisplay(item) {
  const status = String(item?.status || "").trim().toLowerCase();
  const actor = String(item?.actor || "").trim().toLowerCase();
  const note = String(item?.note || "").trim();

  if (actor === "system" && status === "review_dosen_magang") {
    return "Menunggu review dosen pengawas magang.";
  }
  if (actor === "system" && status === "review_sekprodi") {
    return "Menunggu keputusan final sekretaris prodi.";
  }
  if (actor === "dosen_pengawas_magang" && note) {
    return `Catatan Dosen Pengawas Magang: ${note}`;
  }
  if (actor === "dosen_pengampu_pengabdian" && note) {
    return `Catatan Dosen Pengampu Pengabdian Masyarakat: ${note}`;
  }
  if (actor === "dosen_pengampu_perintisan_bisnis" && note) {
    return `Catatan Dosen Pengampu Perintisan Bisnis: ${note}`;
  }
  if (actor === "sekretaris_prodi" && note) {
    return `Catatan Sekretaris Prodi: ${note}`;
  }
  return note || "-";
}

function FinalDecisionDetailSection({ detail }) {
  const timeline = getMagangPayload(detail).workflow_timeline;
  const items = Array.isArray(timeline) ? timeline : [];

  return (
    <div className="rounded-xl border border-[#e4e9f6] bg-white p-4">
      <div className="mb-3">
        <h3 className="text-lg font-black text-[#1b274b]">Detail Keputusan</h3>
        <p className="mt-1 text-sm text-[#5d6c91]">
          Timeline progress dari submit form sampai keputusan terakhir.
        </p>
      </div>
      {items.length > 0 ? (
        <div className="space-y-3">
          {items.map((item, index) => {
            const chip = getFinalDecisionTimelineStatusChip(item?.status);
            const actorLabel = getFinalDecisionTimelineActorLabel(item?.actor);
            return (
              <div
                key={`sekprodi-final-decision-${index}-${item?.status || "item"}`}
                className="rounded-lg border border-[#e8ecf6] bg-white p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${chip.className}`}>
                    {chip.label}
                  </span>
                  <span className="text-xs font-semibold text-[#68779e]">{formatDateTime(item?.at)}</span>
                </div>
                <p className="mt-2 text-sm font-semibold text-[#26355f]">
                  {getFinalDecisionTimelineNoteDisplay(item)}
                </p>
                {actorLabel ? <p className="mt-1 text-xs text-[#68779e]">Aktor: {actorLabel}</p> : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-[#e8ecf6] bg-white p-4 text-sm text-[#5f6b89]">
          Belum ada detail keputusan.
        </div>
      )}
    </div>
  );
}

function getPengampuReviewStatusBadgeClass(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "approved") return "bg-[#137748] text-white";
  if (normalized === "rejected") return "bg-[#b73a3a] text-white";
  if (normalized === "submitted") return "bg-[#fdf1d4] text-[#a06a00]";
  return "bg-[#eef2fb] text-[#5c6d95]";
}

function getPengampuReviewDetailFields(row, config) {
  const payload = getMagangPayload(row);
  const ketua = payload.ketua || {};
  const anggota = Array.isArray(payload.anggota) ? payload.anggota : [];
  const anggotaText = anggota.length > 0
    ? anggota
        .map(
          (item) =>
            `${item.nama || "-"} (${item.nim || "-"})${
              item.peran_tim ? ` - ${formatLabel(item.peran_tim)}` : ""
            }`
        )
        .join(", ")
    : "-";
  const commonFields = [
    ["Mahasiswa", `${row?.mahasiswa?.nama || "-"} (${row?.mahasiswa?.nim || "-"})`],
    ["Email", row?.mahasiswa?.email || "-"],
    ["Angkatan", row?.mahasiswa?.angkatan || "-"],
    ["Periode", row?.periode?.label_periode || "-"],
    ["Jalur", formatLabel(config?.jalur || row?.jalur)],
    ["Status Review", row?.workflow_status_label || formatLabel(getPengampuReviewStatus(row))],
    ["Nama Kelompok", payload.nama_kelompok],
    [
      "Ketua Kelompok",
      `${ketua.nama || row?.mahasiswa?.nama || "-"} (${ketua.nim || row?.mahasiswa?.nim || "-"})${
        ketua.peran_tim ? ` - ${formatLabel(ketua.peran_tim)}` : ""
      }`,
    ],
    ["Anggota", anggotaText],
  ];
  const detailFields = config?.jalur === "perintisan_bisnis"
    ? [
        ["Nama Bisnis", payload.nama_bisnis],
        ["Jenis Bisnis", payload.jenis_bisnis],
        ["Lokasi Bisnis", payload.lokasi_bisnis],
        ["Deskripsi Bisnis", payload.deskripsi_bisnis],
        ["Permasalahan", payload.masalah_yang_diselesaikan],
        ["Produk / Layanan", payload.produk_layanan],
        ["Target Konsumen", payload.target_konsumen],
        ["Model Bisnis", payload.model_bisnis],
        ["Tahap Perkembangan", payload.tahap_perkembangan],
        ["Rencana Kegiatan", payload.rencana_kegiatan],
        ["Target Luaran", payload.target_luaran],
        ["Tautan Bisnis", payload.tautan_bisnis],
      ]
    : [
        ["Nama Program", payload.nama_program],
        ["Mitra / Komunitas", payload.nama_mitra],
        ["Jenis Mitra", payload.jenis_mitra],
        ["Lokasi Pengabdian", payload.lokasi_pengabdian],
        ["Kontak Mitra", payload.kontak_mitra],
        ["Permasalahan Mitra", payload.permasalahan_mitra],
        ["Solusi", payload.solusi_ditawarkan],
        ["Deskripsi Kegiatan", payload.deskripsi_kegiatan],
        ["Penerima Manfaat", payload.penerima_manfaat],
        ["Rencana Pelaksanaan", payload.rencana_pelaksanaan],
        ["Periode Kegiatan", `${payload.periode_mulai || "-"} s.d. ${payload.periode_selesai || "-"}`],
        ["Target Luaran", payload.target_luaran],
        ["Indikator Keberhasilan", payload.indikator_keberhasilan],
      ];

  return [
    ...commonFields,
    ...detailFields,
    ["Dokumen Pendukung", payload.dokumen_pendukung],
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

function getSubmissionStatusLabel(status) {
  return String(status || "").toLowerCase() === "cancelled" ? "Dibatalkan" : formatLabel(status);
}

function getSubmissionApprovalRoleLabel(item) {
  const approvalType = String(item?.tipe_approval || "calon_pembimbing").toLowerCase();
  if (String(item?.status || "").toLowerCase() === "cancelled") return "Sistem";
  if (approvalType === "sekprodi") return "Sekretaris Prodi";
  if (
    approvalType === "koordinator" ||
    approvalType === "ketua_klaster" ||
    approvalType === "ketua_cluster"
  ) {
    return "Ketua Cluster";
  }
  return "Dosen Pembimbing";
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
  if (status === "menunggu_approval_sekprodi") return "Menunggu Persetujuan Sekprodi";
  if (tahap === "pending_ketua_klaster") return "Menunggu Review Ketua Cluster";
  if (tahap === "pending_review_parallel") return "Menunggu Review Dosen Pembimbing";
  if (tahap === "pending_dosen_pembimbing") return "Menunggu Review Dosen Pembimbing";
  if (tahap === "deadline_terlewati") return "Batas Review Dosen Terlewati";
  if (tahap === "menunggu_set_ketua_cluster") return "Menunggu Penetapan Ketua Cluster";
  if (tahap === "menunggu_approval_sekprodi") return "Menunggu Persetujuan Sekprodi";
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

function SubmissionDecisionDetailSection({ items = [] }) {
  return (
    <section>
      <div className="mb-3">
        <h3 className="text-lg font-black text-[#1b274b]">Detail Keputusan</h3>
        <p className="mt-1 text-sm text-[#5d6c91]">
          Timeline progress dari submit form sampai keputusan terakhir.
        </p>
      </div>

      {items.length > 0 ? (
        <div className="space-y-3">
          {items.map((item, index) => (
            <article
              key={`submission-decision-detail-${item?.tanggal_keputusan || index}`}
              className="rounded-lg border border-[#e8ecf6] bg-white p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${getSubmissionStatusBadgeClass(
                      item?.status
                    )}`}
                  >
                    {getSubmissionStatusLabel(item?.status)}
                  </span>
                  <span className="text-xs font-semibold text-[#5b688b]">
                    {[getSubmissionApprovalRoleLabel(item), formatDosenFullName(item?.dosen?.nama, item?.dosen?.gelar) || item?.sekretaris_prodi?.nama]
                      .filter(Boolean)
                      .join(" | ")}
                  </span>
                </div>
                <span className="text-xs font-semibold text-[#68779e]">
                  {formatDateTime(item?.tanggal_keputusan)}
                </span>
              </div>
              <p className="mt-2 text-sm font-semibold text-[#26355f]">{item?.keterangan || "-"}</p>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-[#e8ecf6] bg-white p-4 text-sm text-[#5f6b89]">
          Belum ada detail keputusan.
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

function showInfoToast(message) {
  Swal.fire({
    toast: true,
    position: "top-end",
    icon: "info",
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

function getJakartaDateInputValue() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
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
    approveSuccess: "Proposal perintisan bisnis disetujui dan diteruskan ke Sekprodi.",
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

function buildMonitoringNonResearchDetail(row) {
  const source = row?.pengajuan_detail || {};
  const payload = source?.payload && typeof source.payload === "object" && !Array.isArray(source.payload)
    ? source.payload
    : {};
  const jalur = String(payload.jalur || row?.penjaluran || "").trim().toLowerCase();

  return {
    id: row?.pendaftaran_id || source.id || null,
    mahasiswa: row?.mahasiswa || null,
    jalur,
    workflow_status: source.workflow_status || payload.workflow_status || null,
    form_lanjutan_status: source.workflow_status || payload.workflow_status || null,
    submitted_at: source.submitted_at || null,
    payload,
  };
}

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
        items: [
          { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
          { id: "notifications", label: "Pemberitahuan", icon: Bell },
        ],
      },
      {
        key: "mahasiswa",
        label: "Mahasiswa",
        items: [
          { id: "monitoring-mahasiswa", label: "Mahasiswa Bimbingan", icon: GraduationCap },
          { id: "mahasiswa-dpa", label: "Mahasiswa DPA", icon: UserCircle2 },
          { id: "mahasiswa-bimbingan", label: "Riwayat Bimbingan", icon: ListChecks },
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
      items: [
        { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
        { id: "notifications", label: "Pemberitahuan", icon: Bell },
      ],
    },
    {
      key: "mahasiswa",
      label: "Mahasiswa",
      items: [
        { id: "master-mahasiswa", label: "Master Mahasiswa", icon: GraduationCap },
        { id: "akademik", label: "Monitoring Akademik", icon: FileSpreadsheet },
        { id: "monitoring-mahasiswa", label: "Mahasiswa Bimbingan", icon: GraduationCap },
        { id: "mahasiswa-dpa", label: "Mahasiswa DPA", icon: UserCircle2 },
        { id: "mahasiswa-bimbingan", label: "Riwayat Bimbingan", icon: ListChecks },
        { id: "bimbingan-review", label: "Review Bimbingan", icon: MessageSquareText },
        { id: "submissions", label: "Pengajuan Mahasiswa", icon: ClipboardList },
        { id: "approval-penelitian", label: "Keputusan Final Sekprodi", icon: ListChecks },
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
        { id: "mitra-magang", label: "Mitra Magang", icon: Building2 },
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
    notifications: {
      icon: Bell,
      title: "Pemberitahuan",
      subtitle: "Lihat pemberitahuan penugasan dan aktivitas terbaru.",
    },
    "mahasiswa-bimbingan": {
      icon: ListChecks,
      title: "Riwayat Bimbingan",
      subtitle: "Lihat histori penjaluran mahasiswa yang sedang Anda bimbing.",
    },
    "mahasiswa-dpa": {
      icon: UserCircle2,
      title: "Mahasiswa DPA",
      subtitle: "Pantau mahasiswa yang memilih Anda sebagai dosen pembimbing akademik.",
    },
    "monitoring-mahasiswa": {
      icon: GraduationCap,
      title: "Mahasiswa Bimbingan",
      subtitle: "Pantau progres bimbingan, kelengkapan dokumen, dan tahap sidang mahasiswa.",
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
      subtitle: "Kelola tanggal ketersediaan dan preferensi penjadwalan Anda sebagai penguji sidang.",
    },
    submissions: {
      icon: ClipboardList,
      title: "Pengajuan Mahasiswa",
      subtitle: "Tinjau pengajuan penelitian mahasiswa sebagai dosen calon pembimbing.",
    },
    "approval-penelitian": {
      icon: ListChecks,
      title: "Keputusan Final Sekprodi",
      subtitle: "Putuskan pengajuan penelitian setelah seluruh review dosen dan persetujuan ketua cluster selesai.",
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
    akademik: {
      icon: FileSpreadsheet,
      title: "Monitoring Akademik",
      subtitle: "Pantau nilai mata kuliah penjaluran mahasiswa sesuai program secara read-only.",
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
    "mitra-magang": {
      icon: Building2,
      title: "Manajemen Mitra Magang",
      subtitle: "Kelola daftar mitra magang aktif yang dapat dipilih mahasiswa pada pengajuan magang.",
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

function DosenWorkspacePage({ session, apiBaseUrl, onLogout, onSessionExpired, onOpenProfile, isSekretaris = false }) {
  const [activeTab, setActiveTab] = useState("dashboard");
  const notificationState = useNotifications({ apiBaseUrl, token: session.token, onSessionExpired });
  const submissionNotificationRef = useRef(null);
  const showSubmissionNotificationPanel = false;
  const submissionNotificationItems = [];
  const unreadSubmissionNotificationCount = notificationState.unreadCount;
  const setShowSubmissionNotificationPanel = () => {};
  const handleToggleSubmissionNotificationPanel = () => setActiveTab("notifications");
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
  const [finalResearchRows, setFinalResearchRows] = useState([]);
  const [finalResearchActionId, setFinalResearchActionId] = useState(null);
  const [finalResearchQuery, setFinalResearchQuery] = useState("");
  const [finalResearchMode, setFinalResearchMode] = useState("list");
  const [finalResearchDetail, setFinalResearchDetail] = useState(null);
  const [finalResearchFocusSlot, setFinalResearchFocusSlot] = useState("");
  const [finalResearchViewedSlots, setFinalResearchViewedSlots] = useState([]);
  const [finalResearchDecision, setFinalResearchDecision] = useState("");
  const [finalResearchDecisionNote, setFinalResearchDecisionNote] = useState("");
  const [finalResearchDecisionError, setFinalResearchDecisionError] = useState("");
  const [finalResearchPrimarySupervisorId, setFinalResearchPrimarySupervisorId] = useState("");
  const [finalResearchSecondarySupervisorId, setFinalResearchSecondarySupervisorId] = useState("");
  const [finalNonPenelitianMode, setFinalNonPenelitianMode] = useState("list");
  const [selectedFinalNonPenelitianId, setSelectedFinalNonPenelitianId] = useState(null);
  const [finalNonPenelitianDetail, setFinalNonPenelitianDetail] = useState(null);
  const [loadingFinalNonPenelitianDetail, setLoadingFinalNonPenelitianDetail] = useState(false);
  const [finalNonPenelitianDecision, setFinalNonPenelitianDecision] = useState("");
  const [finalNonPenelitianDecisionNote, setFinalNonPenelitianDecisionNote] = useState("");
  const [finalNonPenelitianDosenPembimbingId, setFinalNonPenelitianDosenPembimbingId] = useState("");
  const [finalNonPenelitianDosenPembimbing2Id, setFinalNonPenelitianDosenPembimbing2Id] = useState("");
  const [finalNonPenelitianDosenQuery, setFinalNonPenelitianDosenQuery] = useState("");
  const [finalNonPenelitianDosenComboOpen, setFinalNonPenelitianDosenComboOpen] = useState(false);
  const [finalNonPenelitianDosen2Query, setFinalNonPenelitianDosen2Query] = useState("");
  const [finalNonPenelitianDosen2ComboOpen, setFinalNonPenelitianDosen2ComboOpen] = useState(false);
  const [finalNonPenelitianDecisionErrors, setFinalNonPenelitianDecisionErrors] = useState({
    note: "",
    dosen: "",
  });
  const [izinLanjutRows, setIzinLanjutRows] = useState([]);
  const [izinLanjutQuery, setIzinLanjutQuery] = useState("");
  const [izinLanjutPage, setIzinLanjutPage] = useState(1);
  const [pamitRows, setPamitRows] = useState([]);
  const [pamitPage, setPamitPage] = useState(1);
  const [magangReviewRows, setMagangReviewRows] = useState([]);
  const [magangReviewQuery, setMagangReviewQuery] = useState("");
  const [magangReviewPage, setMagangReviewPage] = useState(1);
  const [magangReviewActionId, setMagangReviewActionId] = useState(null);
  const [magangReviewMode, setMagangReviewMode] = useState("list");
  const [selectedMagangReviewId, setSelectedMagangReviewId] = useState(null);
  const [magangReviewDetail, setMagangReviewDetail] = useState(null);
  const [loadingMagangReviewDetail, setLoadingMagangReviewDetail] = useState(false);
  const [magangReviewDecisionNote, setMagangReviewDecisionNote] = useState("");
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
  const [pengampuReviewMode, setPengampuReviewMode] = useState("list");
  const [selectedPengampuReviewId, setSelectedPengampuReviewId] = useState(null);
  const [pengampuReviewDetail, setPengampuReviewDetail] = useState(null);
  const [loadingPengampuReviewDetail, setLoadingPengampuReviewDetail] = useState(false);
  const [pengampuReviewDecisionNote, setPengampuReviewDecisionNote] = useState("");
  const [sekprodiNonPenelitianRows, setSekprodiNonPenelitianRows] = useState([]);
  const [sekprodiNonPenelitianActionId, setSekprodiNonPenelitianActionId] = useState(null);
  const [mitraMagangRows, setMitraMagangRows] = useState([]);
  const [mitraMagangQuery, setMitraMagangQuery] = useState("");
  const [mitraMagangStatusFilter, setMitraMagangStatusFilter] = useState("active");
  const [mitraMagangPage, setMitraMagangPage] = useState(1);
  const [mitraMagangMode, setMitraMagangMode] = useState("list");
  const [mitraMagangForm, setMitraMagangForm] = useState(MITRA_MAGANG_FORM_INITIAL);
  const [mitraMagangFormErrors, setMitraMagangFormErrors] = useState(MITRA_MAGANG_FORM_ERRORS_INITIAL);
  const [editingMitraMagang, setEditingMitraMagang] = useState(null);
  const [savingMitraMagang, setSavingMitraMagang] = useState(false);
  const [deletingMitraMagangId, setDeletingMitraMagangId] = useState(null);
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
  const [masterTopikFilters, setMasterTopikFilters] = useState({ ...MASTER_TOPIK_FILTER_INITIAL });
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
  const [dosenPeriodAvailability, setDosenPeriodAvailability] = useState({
    periodes: [], periode: null, dosens: [], readiness: null, is_readonly: false,
  });
  const [dosenStatusFollowUps, setDosenStatusFollowUps] = useState([]);
  const [dosenStatusFollowUpQuery, setDosenStatusFollowUpQuery] = useState("");
  const [dosenStatusFollowUpPage, setDosenStatusFollowUpPage] = useState(1);
  const [dosenStatusFollowUpDetailRow, setDosenStatusFollowUpDetailRow] = useState(null);
  const [dosenStatusFollowUpDetail, setDosenStatusFollowUpDetail] = useState(null);
  const [loadingDosenStatusFollowUpDetail, setLoadingDosenStatusFollowUpDetail] = useState(false);
  const [savingDosenStatusFollowUpAction, setSavingDosenStatusFollowUpAction] = useState("");
  const [dosenStatusFollowUpForms, setDosenStatusFollowUpForms] = useState({});
  const [dosenStatusFollowUpResolutionForm, setDosenStatusFollowUpResolutionForm] = useState({ note: "" });
  const [dosenStatusFollowUpFormErrors, setDosenStatusFollowUpFormErrors] = useState({});
  const [selectedAvailabilityDosenIds, setSelectedAvailabilityDosenIds] = useState([]);
  const [dirtyAvailabilityDosenIds, setDirtyAvailabilityDosenIds] = useState([]);
  const [dosenPeriodAvailabilityQuery, setDosenPeriodAvailabilityQuery] = useState("");
  const [dosenPeriodAvailabilityPage, setDosenPeriodAvailabilityPage] = useState(1);
  const [savingBulkAvailability, setSavingBulkAvailability] = useState(false);
  const [supervisorAssignmentMonitoring, setSupervisorAssignmentMonitoring] = useState({
    rows: [],
    pagination: { page: 1, limit: 20, total: 0, total_pages: 1 },
    filter_options: { periodes: [], dosens: [] },
  });
  const [supervisorAssignmentFilters, setSupervisorAssignmentFilters] = useState({
    q: "",
    periode_id: "",
    dosen_id: "",
    status: "",
    sumber_data: "",
    semester_penjaluran_ke: "",
  });
  const [supervisorAssignmentPage, setSupervisorAssignmentPage] = useState(1);
  const [loadingSupervisorAssignments, setLoadingSupervisorAssignments] = useState(false);
  const [semesterTransitionForm, setSemesterTransitionForm] = useState({ source_period_id: "", effective_at: "" });
  const [semesterTransitionPreview, setSemesterTransitionPreview] = useState(null);
  const [selectedSemesterTransitions, setSelectedSemesterTransitions] = useState([]);
  const [loadingSemesterTransition, setLoadingSemesterTransition] = useState(false);
  const semesterTransitionBatchKeyRef = useRef(null);
  const semesterTransitionBatchPayloadRef = useRef(null);
  const [refreshingDosenPeriodAvailability, setRefreshingDosenPeriodAvailability] = useState(false);
  const selectedDosenAvailabilityPeriodIdRef = useRef(null);
  const dirtyAvailabilityDosenIdsRef = useRef([]);
  const availabilityRefreshInFlightRef = useRef(false);
  const availabilityRefreshPromptOpenRef = useRef(false);
  const lastAvailabilityAutoRefreshAtRef = useRef(0);
  useEffect(() => {
    dirtyAvailabilityDosenIdsRef.current = dirtyAvailabilityDosenIds;
  }, [dirtyAvailabilityDosenIds]);
  const filteredDosenPeriodAvailabilityRows = useMemo(() => {
    const keyword = dosenPeriodAvailabilityQuery.trim().toLowerCase();
    if (!keyword) return dosenPeriodAvailability.dosens;
    return dosenPeriodAvailability.dosens.filter((row) =>
      [row.nama, row.gelar, formatDosenFullName(row.nama, row.gelar), row.kode_dosen, row.nik, row.email]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(keyword)
    );
  }, [dosenPeriodAvailability.dosens, dosenPeriodAvailabilityQuery]);
  const totalDosenPeriodAvailabilityPages = useMemo(
    () => Math.max(1, Math.ceil(filteredDosenPeriodAvailabilityRows.length / DOSEN_AVAILABILITY_PAGE_SIZE)),
    [filteredDosenPeriodAvailabilityRows.length]
  );
  const pagedDosenPeriodAvailabilityRows = useMemo(() => {
    const start = (dosenPeriodAvailabilityPage - 1) * DOSEN_AVAILABILITY_PAGE_SIZE;
    return filteredDosenPeriodAvailabilityRows.slice(start, start + DOSEN_AVAILABILITY_PAGE_SIZE);
  }, [dosenPeriodAvailabilityPage, filteredDosenPeriodAvailabilityRows]);
  const dosenPeriodAvailabilityRangeStart = filteredDosenPeriodAvailabilityRows.length === 0
    ? 0
    : (dosenPeriodAvailabilityPage - 1) * DOSEN_AVAILABILITY_PAGE_SIZE + 1;
  const dosenPeriodAvailabilityRangeEnd = Math.min(
    dosenPeriodAvailabilityPage * DOSEN_AVAILABILITY_PAGE_SIZE,
    filteredDosenPeriodAvailabilityRows.length
  );
  useEffect(() => {
    if (dosenPeriodAvailabilityPage > totalDosenPeriodAvailabilityPages) {
      setDosenPeriodAvailabilityPage(totalDosenPeriodAvailabilityPages);
    }
  }, [dosenPeriodAvailabilityPage, totalDosenPeriodAvailabilityPages]);
  const filteredDosenStatusFollowUps = useMemo(() => {
    const keyword = dosenStatusFollowUpQuery.trim().toLowerCase();
    if (!keyword) return dosenStatusFollowUps;
    return dosenStatusFollowUps.filter((row) => [
      row.dosen?.nama,
      row.dosen?.gelar,
      formatDosenFullName(row.dosen?.nama, row.dosen?.gelar),
      row.dosen?.kode_dosen,
      row.dosen?.nik,
      DOSEN_MASTER_STATUS_LABELS[row.dosen?.status_keaktifan],
    ].filter(Boolean).join(" ").toLowerCase().includes(keyword));
  }, [dosenStatusFollowUpQuery, dosenStatusFollowUps]);
  const totalDosenStatusFollowUpPages = useMemo(
    () => Math.max(1, Math.ceil(filteredDosenStatusFollowUps.length / DOSEN_FOLLOW_UP_PAGE_SIZE)),
    [filteredDosenStatusFollowUps.length]
  );
  const pagedDosenStatusFollowUps = useMemo(() => {
    const start = (dosenStatusFollowUpPage - 1) * DOSEN_FOLLOW_UP_PAGE_SIZE;
    return filteredDosenStatusFollowUps.slice(start, start + DOSEN_FOLLOW_UP_PAGE_SIZE);
  }, [dosenStatusFollowUpPage, filteredDosenStatusFollowUps]);
  const dosenStatusFollowUpRangeStart = filteredDosenStatusFollowUps.length === 0
    ? 0
    : (dosenStatusFollowUpPage - 1) * DOSEN_FOLLOW_UP_PAGE_SIZE + 1;
  const dosenStatusFollowUpRangeEnd = Math.min(
    dosenStatusFollowUpPage * DOSEN_FOLLOW_UP_PAGE_SIZE,
    filteredDosenStatusFollowUps.length
  );
  useEffect(() => {
    if (dosenStatusFollowUpPage > totalDosenStatusFollowUpPages) {
      setDosenStatusFollowUpPage(totalDosenStatusFollowUpPages);
    }
  }, [dosenStatusFollowUpPage, totalDosenStatusFollowUpPages]);
  const affectedDosenStatusFollowUpStudents = Array.isArray(dosenStatusFollowUpDetail?.affected_mahasiswa)
    ? dosenStatusFollowUpDetail.affected_mahasiswa
    : [];
  const rawDosenStatusFollowUpBlockingCount = dosenStatusFollowUpDetail?.resolution_status?.blocking_count;
  const dosenStatusFollowUpBlockingCount = Number.isInteger(rawDosenStatusFollowUpBlockingCount)
    ? rawDosenStatusFollowUpBlockingCount
    : affectedDosenStatusFollowUpStudents.length;
  const hasPendingDosenStatusReplacement = dosenStatusFollowUpBlockingCount > 0;

  const [topikForm, setTopikForm] = useState({
    kode: "",
    judul: "",
    deskripsi: "",
    keyword: "",
    cluster: "Sirkel",
  });
  const [topikFormErrors, setTopikFormErrors] = useState({});
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
  const [topikUploadCommitEndpoint, setTopikUploadCommitEndpoint] = useState("/api/dosen/upload/topics/commit");
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
  const [monitoringMahasiswa, setMonitoringMahasiswa] = useState({
    summary: { total: 0, perlu_tindakan: 0, siap_sidang: 0 },
    rows: [],
  });
  const [monitoringMahasiswaQuery, setMonitoringMahasiswaQuery] = useState("");
  const [monitoringMahasiswaMode, setMonitoringMahasiswaMode] = useState("list");
  const [selectedMonitoringMahasiswa, setSelectedMonitoringMahasiswa] = useState(null);
  const [monitoringSubmissionDetail, setMonitoringSubmissionDetail] = useState(null);
  const [loadingMonitoringDetail, setLoadingMonitoringDetail] = useState(false);
  const [monitoringDetailError, setMonitoringDetailError] = useState("");
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
  const [supervisorHistoryPanel, setSupervisorHistoryPanel] = useState({
    mahasiswaId: null, mahasiswaName: "", loading: false, data: null, error: "",
  });
  const [periodeOverview, setPeriodeOverview] = useState({
    active_periode: null,
    draft_periode: null,
    periodes: [],
    dosen_options: [],
    dosen_pembimbing_options: [],
    ketua_klaster_options: [],
    master_penanggung_jawab: null,
    penanggung_jawab_lock: null,
  });
  const storedPeriodeSetup = useMemo(readStoredPeriodeSetup, []);
  const [periodeMasterForm, setPeriodeMasterForm] = useState({
    ...PERIODE_MASTER_INITIAL,
    ...(storedPeriodeSetup?.penanggung_jawab || {}),
  });
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
  const [periodeForm, setPeriodeForm] = useState({
    ...PERIODE_FORM_INITIAL,
    ...(storedPeriodeSetup?.periode || {}),
  });
  const [periodeFormErrors, setPeriodeFormErrors] = useState({});
  const [periodeMode, setPeriodeMode] = useState(
    storedPeriodeSetup && (
      storedPeriodeSetup.step === "availability"
      || storedPeriodeSetup.step === "preview"
      || (Array.isArray(storedPeriodeSetup.dosens) && storedPeriodeSetup.dosens.length > 0)
      || Object.values(storedPeriodeSetup.periode || {}).some((value) => String(value || "").trim())
    ) ? "open" : "list"
  );
  const [periodeSetup, setPeriodeSetup] = useState({
    step: storedPeriodeSetup?.step || "periode",
    dosens: Array.isArray(storedPeriodeSetup?.dosens) ? storedPeriodeSetup.dosens : [],
    preview: storedPeriodeSetup?.preview || null,
    previous_period: storedPeriodeSetup?.previous_period || null,
  });
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
  const [savingKetuaKlasterId] = useState(null);
  const [savingPeriode, setSavingPeriode] = useState(false);
  const [rowActionLoadingId, setRowActionLoadingId] = useState(null);
  const [exportingPendaftaran, setExportingPendaftaran] = useState(false);
  const [exportingMahasiswaMaster, setExportingMahasiswaMaster] = useState(false);

  const periodeMasterSource = useMemo(
    () => (periodeOverview?.master_penanggung_jawab && typeof periodeOverview.master_penanggung_jawab === "object"
      ? periodeOverview.master_penanggung_jawab
      : null),
    [periodeOverview?.master_penanggung_jawab]
  );

  const sessionExpiredRef = useRef(false);
  const extensionDecisionKeysRef = useRef(new Map());
  const pendaftaranFilterTriggerRef = useRef(null);
  const pendaftaranFilterPopupRef = useRef(null);
  const mahasiswaMasterFilterTriggerRef = useRef(null);
  const mahasiswaMasterFilterPopupRef = useRef(null);
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
    ((activeTab === "master-mahasiswa" ||
      activeTab === "mahasiswa-bimbingan" ||
      activeTab === "mahasiswa-dpa" ||
      activeTab === "monitoring-mahasiswa") ||
      (activeTab === "bimbingan-review" && isBimbinganReviewListMode) ||
      activeTab === "dokumen-sidang-review" ||
      activeTab === "ketersediaan-sidang" ||
      (isSekretaris && activeTab === "approval-penelitian") ||
      (isSubmissionReviewTabActive && submissionMode === "list") ||
      activeTab === "magang-review" ||
      Boolean(activePengampuReviewConfig) ||
      activeTab === "permohonan-extend" ||
      activeTab === "pamit" ||
      (isSekretaris && activeTab === "master-dosen") ||
      (isSekretaris && activeTab === "master-topik") ||
      (isSekretaris && activeTab === "mitra-magang") ||
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
    if (typeof window === "undefined" || periodeMode !== "open" || periodeSetup.step === "opened") return;
    window.localStorage.setItem(PERIODE_SETUP_STORAGE_KEY, JSON.stringify({
      step: periodeSetup.step,
      periode: periodeForm,
      penanggung_jawab: periodeMasterForm,
      dosens: periodeSetup.dosens,
      preview: periodeSetup.preview,
      previous_period: periodeSetup.previous_period,
    }));
  }, [periodeMode, periodeSetup, periodeForm, periodeMasterForm]);

  useEffect(() => {
    if (!availableTabIds.includes(activeTab)) {
      setActiveTab("dashboard");
    }
  }, [activeTab, availableTabIds]);

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
    if (!(activeTab === "master-mahasiswa" || activeTab === "mahasiswa-bimbingan" || activeTab === "mahasiswa-dpa")) {
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
        const sessionError = new Error("__SESSION_EXPIRED__");
        sessionError.status = response.status;
        throw sessionError;
      }

      if (!response.ok || !data?.success) {
        const errorObj = new Error(data?.message || `Gagal memuat ${path}`);
        errorObj.status = response.status;
        if (data?.detail && typeof data.detail === "object") {
          errorObj.detail = data.detail;
        }
        throw errorObj;
      }

      return data.data;
    },
    [apiBaseUrl, onSessionExpired, session.token]
  );

  const applyPeriodeOverview = useCallback((payload = {}) => {
    setPeriodeOverview({
      active_periode: payload.active_periode || null,
      draft_periode: payload.draft_periode || null,
      periodes: Array.isArray(payload.periodes) ? payload.periodes : [],
      dosen_options: Array.isArray(payload.dosen_options) ? payload.dosen_options : [],
      dosen_pembimbing_options: Array.isArray(payload.dosen_pembimbing_options)
        ? payload.dosen_pembimbing_options
        : [],
      ketua_klaster_options: Array.isArray(payload.ketua_klaster_options)
        ? payload.ketua_klaster_options
        : [],
      master_penanggung_jawab: payload.master_penanggung_jawab || null,
      penanggung_jawab_lock: payload.penanggung_jawab_lock || null,
    });
  }, []);

  const loadPeriodeOverview = useCallback(async () => {
    const payload = await fetchWithAuth("/api/sekretaris/periode");
    applyPeriodeOverview(payload || {});
    return payload;
  }, [applyPeriodeOverview, fetchWithAuth]);

  const loadSupervisorAssignmentMonitoring = useCallback(async ({ page = 1, filters = {} } = {}) => {
    setLoadingSupervisorAssignments(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      Object.entries(filters).forEach(([key, value]) => {
        if (String(value || "").trim()) params.set(key, String(value).trim());
      });
      const payload = await fetchWithAuth(`/api/sekretaris/penetapan-pembimbing?${params.toString()}`);
      setSupervisorAssignmentMonitoring({
        rows: Array.isArray(payload?.rows) ? payload.rows : [],
        pagination: payload?.pagination || { page, limit: 20, total: 0, total_pages: 1 },
        filter_options: {
          periodes: Array.isArray(payload?.filter_options?.periodes) ? payload.filter_options.periodes : [],
          dosens: Array.isArray(payload?.filter_options?.dosens) ? payload.filter_options.dosens : [],
        },
      });
      return true;
    } catch (monitoringError) {
      if (monitoringError.message !== "__SESSION_EXPIRED__") {
        showErrorToast(monitoringError.message || "Gagal memuat riwayat penetapan pembimbing.");
      }
      return false;
    } finally {
      setLoadingSupervisorAssignments(false);
    }
  }, [fetchWithAuth]);

  const loadSemesterTransitionPreview = useCallback(async () => {
    if (!semesterTransitionForm.source_period_id) {
      showErrorToast("Pilih periode sumber semester 1.");
      return;
    }
    setLoadingSemesterTransition(true);
    try {
      const params = new URLSearchParams({ source_period_id: semesterTransitionForm.source_period_id });
      const payload = await fetchWithAuth(`/api/sekretaris/semester-transition/preview?${params.toString()}`);
      setSemesterTransitionPreview(payload || null);
      setSelectedSemesterTransitions((payload?.rows || []).filter((row) => row.classification === "ready").map((row) => row.expected_assignment_id));
    } catch (error) {
      if (error.message !== "__SESSION_EXPIRED__") showErrorToast(error.message || "Gagal memuat preview transisi semester.");
    } finally {
      setLoadingSemesterTransition(false);
    }
  }, [fetchWithAuth, semesterTransitionForm.source_period_id]);

  const confirmSemesterTransitions = useCallback(async () => {
    const readyRows = (semesterTransitionPreview?.rows || []).filter((row) => selectedSemesterTransitions.includes(row.expected_assignment_id));
    if (!readyRows.length) {
      showErrorToast("Pilih minimal satu kandidat ready.");
      return;
    }
    setLoadingSemesterTransition(true);
    try {
      const requestBody = JSON.stringify({
        effective_at: semesterTransitionForm.effective_at || null,
        items: readyRows.map((row) => ({ expected_assignment_id: row.expected_assignment_id, target_period_id: row.target_period_id })),
      });
      if (semesterTransitionBatchPayloadRef.current && semesterTransitionBatchPayloadRef.current !== requestBody) {
        semesterTransitionBatchKeyRef.current = null;
      }
      const key = semesterTransitionBatchKeyRef.current
        || `semester-transition-bulk-${window.crypto?.randomUUID?.() || Date.now()}`;
      semesterTransitionBatchKeyRef.current = key;
      semesterTransitionBatchPayloadRef.current = requestBody;
      const payload = await fetchWithAuth("/api/sekretaris/semester-transition/confirm-bulk", {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: requestBody,
      });
      // Response keputusan sudah diterima; aksi bulk berikutnya harus memakai intent baru.
      semesterTransitionBatchKeyRef.current = null;
      semesterTransitionBatchPayloadRef.current = null;
      const failed = (payload?.results || []).filter((row) => !row.success).length;
      showSuccessToast(failed ? `Transisi diproses dengan ${failed} item memerlukan tindak lanjut.` : "Transisi semester berhasil diproses.");
      await loadSemesterTransitionPreview();
      await loadSupervisorAssignmentMonitoring({ page: supervisorAssignmentPage, filters: supervisorAssignmentFilters });
    } catch (error) {
      // HTTP/business response berarti server telah menjawab. Network/unknown error mempertahankan key untuk retry aman.
      if (Number.isInteger(error?.status)) {
        semesterTransitionBatchKeyRef.current = null;
        semesterTransitionBatchPayloadRef.current = null;
      }
      if (error.message !== "__SESSION_EXPIRED__") showErrorToast(error.message || "Gagal mengonfirmasi transisi semester.");
    } finally {
      setLoadingSemesterTransition(false);
    }
  }, [fetchWithAuth, loadSemesterTransitionPreview, loadSupervisorAssignmentMonitoring, selectedSemesterTransitions, semesterTransitionForm.effective_at, semesterTransitionPreview, supervisorAssignmentFilters, supervisorAssignmentPage]);

  const retrySemesterTransition = useCallback(async (row) => {
    setLoadingSemesterTransition(true);
    try {
      await fetchWithAuth("/api/sekretaris/semester-transition/confirm", {
        method: "POST",
        headers: { "Idempotency-Key": `semester-transition-retry-${window.crypto?.randomUUID?.() || Date.now()}` },
        body: JSON.stringify({
          expected_assignment_id: row.expected_assignment_id,
          target_period_id: row.target_period_id,
          effective_at: semesterTransitionForm.effective_at || null,
        }),
      });
      showSuccessToast("Kelompok berhasil divalidasi dan transisi diproses ulang.");
      await loadSemesterTransitionPreview();
      await loadSupervisorAssignmentMonitoring({ page: 1, filters: supervisorAssignmentFilters });
    } catch (error) {
      if (error.message !== "__SESSION_EXPIRED__") showErrorToast(error.message || "Kelompok masih memerlukan tindak lanjut.");
    } finally {
      setLoadingSemesterTransition(false);
    }
  }, [fetchWithAuth, loadSemesterTransitionPreview, loadSupervisorAssignmentMonitoring, semesterTransitionForm.effective_at, supervisorAssignmentFilters]);

  const openSemesterTransitionFollowUp = useCallback((row) => {
    const query = row.mahasiswa?.nim || row.mahasiswa?.nama || "";
    setSupervisorAssignmentFilters((previous) => ({ ...previous, q: query }));
    setSupervisorAssignmentPage(1);
    setTimeout(() => document.getElementById("supervisor-assignment-history")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }, []);

  const handleOpenFinalResearchDetail = async (submission) => {
    try {
      await loadPeriodeOverview();
    } catch (overviewError) {
      if (overviewError.message === "__SESSION_EXPIRED__") return;
      showErrorToast(overviewError.message || "Gagal memperbarui daftar calon pembimbing.");
      return;
    }
    const approvedTopics = Array.isArray(submission?.topik_lolos_cluster)
      ? [...submission.topik_lolos_cluster].sort((left, right) => Number(left.slot) - Number(right.slot))
      : [];
    const firstSlot = approvedTopics[0] ? getFinalResearchTopicKey(approvedTopics[0]) : "";
    setFinalResearchDetail(submission);
    setFinalResearchFocusSlot(firstSlot);
    setFinalResearchViewedSlots(firstSlot ? [firstSlot] : []);
    setFinalResearchDecision("");
    setFinalResearchDecisionNote("");
    setFinalResearchDecisionError("");
    setFinalResearchPrimarySupervisorId("");
    setFinalResearchSecondarySupervisorId("");
    setFinalResearchMode("review");
  };

  const handleBackToFinalResearchList = () => {
    setFinalResearchMode("list");
    setFinalResearchDetail(null);
    setFinalResearchFocusSlot("");
    setFinalResearchViewedSlots([]);
    setFinalResearchDecision("");
    setFinalResearchDecisionNote("");
    setFinalResearchDecisionError("");
    setFinalResearchPrimarySupervisorId("");
    setFinalResearchSecondarySupervisorId("");
  };

  const handleSelectFinalResearchTopic = (slot) => {
    const normalizedSlot = String(slot);
    setFinalResearchFocusSlot(normalizedSlot);
    setFinalResearchViewedSlots((current) =>
      current.includes(normalizedSlot) ? current : [...current, normalizedSlot]
    );
  };

  const handleSubmitFinalResearchDecision = async () => {
    if (!finalResearchDetail?.id || !finalResearchDecision) return;
    const note = String(finalResearchDecisionNote || "").trim();
    if (finalResearchDecision === "approve" && !hasViewedAllFinalResearchTopics) {
      setFinalResearchDecisionError("Tinjau seluruh pilihan topik sebelum memberikan keputusan final.");
      return;
    }
    if (!note) {
      setFinalResearchDecisionError(
        finalResearchDecision === "approve" ? "Catatan keputusan wajib diisi." : "Alasan penolakan wajib diisi."
      );
      return;
    }
    if (finalResearchDecision === "approve" && !Number(finalResearchPrimarySupervisorId)) {
      setFinalResearchDecisionError("Pembimbing 1 wajib dipilih oleh sekretaris prodi.");
      return;
    }

    setFinalResearchActionId(finalResearchDetail.id);
    try {
      await fetchWithAuth(
        `/api/sekretaris/penelitian/final/${finalResearchDetail.id}/${finalResearchDecision}`,
        {
          method: "POST",
          body: JSON.stringify({
            keterangan: note,
            ...(finalResearchFocusedTopic?.slot != null
              ? { topik_slot: Number(finalResearchFocusedTopic.slot) }
              : {}),
            ...(finalResearchDecision === "approve"
              ? { dosen_pembimbing_1_id: Number(finalResearchPrimarySupervisorId) }
              : {}),
            ...(finalResearchDecision === "approve" && finalResearchSecondarySupervisorId
              ? { dosen_pembimbing_2_id: Number(finalResearchSecondarySupervisorId) }
              : {}),
          }),
        }
      );
      showSuccessToast(
        finalResearchDecision === "approve"
          ? "Topik penelitian ditetapkan sebagai topik final."
          : "Topik ditolak. Proses topik lainnya tetap berjalan."
      );
      handleBackToFinalResearchList();
      await loadAllData();
    } catch (actionError) {
      if (actionError.message !== "__SESSION_EXPIRED__") showErrorToast(actionError.message);
    } finally {
      setFinalResearchActionId(null);
    }
  };

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
      fetchWithAuth("/api/dosen/monitoring-mahasiswa"),
      !isSekretaris ? fetchWithAuth("/api/dosen/non-penelitian/magang/reviews") : Promise.resolve([]),
      !isSekretaris ? fetchWithAuth("/api/dosen/non-penelitian/pengabdian/reviews") : Promise.resolve([]),
      !isSekretaris ? fetchWithAuth("/api/dosen/non-penelitian/perintisan-bisnis/reviews") : Promise.resolve([]),
    ];

    if (isSekretaris) {
      promises.push(fetchWithAuth("/api/sekretaris/pendaftaran"));
      promises.push(fetchWithAuth("/api/sekretaris/non-penelitian/reviews"));
      promises.push(fetchWithAuth("/api/sekretaris/penelitian/final"));
      promises.push(fetchWithAuth("/api/sekretaris/periode"));
      promises.push(fetchWithAuth("/api/sekretaris/master-dosen/kuota-overview"));
      promises.push(fetchWithAuth("/api/topics"));
      promises.push(fetchWithAuth(`/api/sekretaris/mitra-magang?status=${mitraMagangStatusFilter}`));
      promises.push(fetchWithAuth("/api/sekretaris/master-dosen/ketersediaan"));
      promises.push(fetchWithAuth("/api/sekretaris/master-dosen/tindak-lanjut-status"));
    }

    const results = await Promise.allSettled(promises);
    if (sessionExpiredRef.current) return;

    const [
      submissionsResult,
      izinLanjutResult,
      pamitResult,
      topikResult,
      mahasiswaMasterResult,
      monitoringMahasiswaResult,
      magangReviewResult,
      pengabdianReviewResult,
      perintisanReviewResult,
      pendaftaranResult,
      sekprodiNonPenelitianResult,
      finalResearchResult,
      periodeResult,
      masterDosenKuotaResult,
      masterTopikResult,
      mitraMagangResult,
      dosenAvailabilityResult,
      dosenFollowUpResult,
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

    if (monitoringMahasiswaResult?.status === "fulfilled") {
      const payload = monitoringMahasiswaResult.value || {};
      setMonitoringMahasiswa({
        summary: payload.summary || { total: 0, perlu_tindakan: 0, siap_sidang: 0 },
        rows: Array.isArray(payload.rows) ? payload.rows : [],
      });
    } else {
      setMonitoringMahasiswa({
        summary: { total: 0, perlu_tindakan: 0, siap_sidang: 0 },
        rows: [],
      });
      issues.push(
        monitoringMahasiswaResult?.reason?.message || "Gagal memuat data mahasiswa bimbingan."
      );
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

      if (sekprodiNonPenelitianResult?.status === "fulfilled") {
        setSekprodiNonPenelitianRows(
          Array.isArray(sekprodiNonPenelitianResult.value)
            ? sekprodiNonPenelitianResult.value
            : []
        );
      } else {
        setSekprodiNonPenelitianRows([]);
        issues.push(
          sekprodiNonPenelitianResult?.reason?.message ||
            "Gagal memuat proposal yang menunggu keputusan final sekretaris prodi."
        );
      }

      if (finalResearchResult?.status === "fulfilled") {
        setFinalResearchRows(
          Array.isArray(finalResearchResult.value) ? finalResearchResult.value : []
        );
      } else {
        setFinalResearchRows([]);
        issues.push(
          finalResearchResult?.reason?.message ||
            "Gagal memuat pengajuan penelitian yang menunggu persetujuan final."
        );
      }

      if (periodeResult?.status === "fulfilled") {
        applyPeriodeOverview(periodeResult.value || {});
      } else {
        applyPeriodeOverview();
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

      if (mitraMagangResult?.status === "fulfilled") {
        setMitraMagangRows(Array.isArray(mitraMagangResult.value) ? mitraMagangResult.value : []);
      } else {
        setMitraMagangRows([]);
        issues.push(mitraMagangResult?.reason?.message || "Gagal memuat data mitra magang.");
      }
      if (dosenAvailabilityResult?.status === "fulfilled") {
        const payload = dosenAvailabilityResult.value || {};
        selectedDosenAvailabilityPeriodIdRef.current = payload.periode?.id || null;
        setDosenPeriodAvailability({
          periodes: Array.isArray(payload.periodes) ? payload.periodes : [],
          periode: payload.periode || null,
          dosens: Array.isArray(payload.dosens) ? payload.dosens : [],
          readiness: payload.readiness || null,
          is_readonly: payload.is_readonly === true,
        });
        setSelectedAvailabilityDosenIds([]);
      } else {
        selectedDosenAvailabilityPeriodIdRef.current = null;
        setDosenPeriodAvailability({ periodes: [], periode: null, dosens: [], readiness: null, is_readonly: false });
        setSelectedAvailabilityDosenIds([]);
        issues.push(dosenAvailabilityResult?.reason?.message || "Gagal memuat ketersediaan dosen per periode.");
      }
      if (dosenFollowUpResult?.status === "fulfilled") {
        setDosenStatusFollowUps(Array.isArray(dosenFollowUpResult.value) ? dosenFollowUpResult.value : []);
      } else {
        setDosenStatusFollowUps([]);
      }
      setKetuaKlasterOverview({
        active_periode: null,
        periode_terpilih: null,
        periodes: [],
        rows: [],
      });
      setKetuaKlasterPeriodeId("");
    } else {
      setFinalResearchRows([]);
      setMasterTopikRows([]);
      applyPeriodeOverview();
      setMasterDosenKuotaOverview({ summary: null, dosens: [] });
      setMitraMagangRows([]);
      setKetuaKlasterOverview({
        active_periode: null,
        periode_terpilih: null,
        periodes: [],
        rows: [],
      });
      setKetuaKlasterPeriodeId("");
    }

    const visibleIssues = [...new Set(issues.filter((message) => {
      const normalized = String(message || "").toLowerCase();
      return !(
        normalized.includes("tidak diizinkan memproses bimbingan lama")
        || normalized.includes("tindak lanjut harus diselesaikan oleh sekprodi")
      );
    }))];
    setError(visibleIssues.join(" "));
    setLoading(false);
  }, [applyPeriodeOverview, fetchWithAuth, isSekretaris, mitraMagangStatusFilter]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  useEffect(() => {
    if (!isSekretaris || activeTab !== "approval-penelitian") return undefined;

    let refreshInProgress = false;
    const refreshCandidates = async ({ silent = true } = {}) => {
      if (refreshInProgress) return;
      refreshInProgress = true;
      try {
        await loadPeriodeOverview();
      } catch (overviewError) {
        if (!silent && overviewError.message !== "__SESSION_EXPIRED__") {
          showErrorToast(overviewError.message || "Gagal memperbarui daftar pembimbing.");
        }
      } finally {
        refreshInProgress = false;
      }
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refreshCandidates();
    };

    refreshCandidates({ silent: false });
    const timer = window.setInterval(refreshCandidates, 30000);
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [activeTab, isSekretaris, loadPeriodeOverview]);

  useEffect(() => {
    if (!isSekretaris || activeTab !== "master-dosen" || masterDosenTab !== "riwayat-penetapan") return undefined;
    const timer = window.setTimeout(() => {
      loadSupervisorAssignmentMonitoring({
        page: supervisorAssignmentPage,
        filters: supervisorAssignmentFilters,
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [
    activeTab,
    isSekretaris,
    loadSupervisorAssignmentMonitoring,
    masterDosenTab,
    supervisorAssignmentFilters,
    supervisorAssignmentPage,
  ]);

  const resetMitraMagangForm = useCallback(() => {
    setMitraMagangForm(MITRA_MAGANG_FORM_INITIAL);
    setMitraMagangFormErrors(MITRA_MAGANG_FORM_ERRORS_INITIAL);
    setEditingMitraMagang(null);
  }, []);

  const handleOpenAddMitraMagang = useCallback(() => {
    resetMitraMagangForm();
    setMitraMagangMode("form");
  }, [resetMitraMagangForm]);

  const handleBackFromMitraMagangForm = useCallback(() => {
    resetMitraMagangForm();
    setMitraMagangMode("list");
  }, [resetMitraMagangForm]);

  useEffect(() => {
    if (!(isSekretaris && activeTab === "mitra-magang")) {
      setMitraMagangMode("list");
      resetMitraMagangForm();
    }
  }, [activeTab, isSekretaris, resetMitraMagangForm]);

  const handleMitraMagangInputChange = useCallback((event) => {
    const { name, value } = event.target;
    setMitraMagangForm((prev) => ({ ...prev, [name]: value }));
    if (Object.prototype.hasOwnProperty.call(MITRA_MAGANG_FORM_ERRORS_INITIAL, name)) {
      setMitraMagangFormErrors((prev) => ({ ...prev, [name]: "" }));
    }
  }, []);

  const handleMitraMagangQuotaChange = useCallback((value) => {
    const digitsOnly = String(value || "").replace(/\D/g, "").slice(0, 2);
    const normalizedValue = digitsOnly ? String(Math.min(99, Number(digitsOnly))) : "";
    setMitraMagangForm((prev) => ({ ...prev, quota_magang: normalizedValue }));
    setMitraMagangFormErrors((prev) => ({ ...prev, quota_magang: "" }));
  }, []);

  const handleToggleMitraMagangStatus = useCallback(() => {
    setMitraMagangForm((prev) => ({
      ...prev,
      status: prev.status === "active" ? "inactive" : "active",
    }));
    setMitraMagangFormErrors((prev) => ({ ...prev, status: "" }));
  }, []);

  const handleEditMitraMagang = useCallback((row) => {
    if (!row || row.is_active === false || row.status === "inactive") {
      showErrorToast("Mitra magang nonaktif tidak dapat diedit.");
      return;
    }
    setEditingMitraMagang(row);
    setMitraMagangForm({
      nama: row.nama || "",
      bidang_jenis: row.bidang_jenis || "",
      lokasi: row.lokasi || "",
      email_kontak: row.email_kontak || "",
      website: row.website || "",
      status: row.status || "active",
      posisi_magang: row.posisi_magang || "",
      quota_magang: row.quota_magang ?? "",
      kriteria: row.kriteria || "",
      prosedur_perusahaan: row.prosedur_perusahaan || "",
    });
    setMitraMagangFormErrors(MITRA_MAGANG_FORM_ERRORS_INITIAL);
    setMitraMagangMode("form");
  }, []);

  const handleSubmitMitraMagang = useCallback(
    async (event) => {
      event.preventDefault();
      const nama = String(mitraMagangForm.nama || "").trim();
      const bidangJenis = String(mitraMagangForm.bidang_jenis || "").trim();
      const lokasi = String(mitraMagangForm.lokasi || "").trim();
      const status = String(mitraMagangForm.status || "").trim();
      const quotaMagang = String(mitraMagangForm.quota_magang || "").trim();
      const nextErrors = {
        nama: nama ? "" : "Nama mitra magang wajib diisi.",
        bidang_jenis: bidangJenis ? "" : "Bidang / jenis wajib diisi.",
        lokasi: lokasi ? "" : "Lokasi wajib diisi.",
        status: status ? "" : "Status wajib dipilih.",
        quota_magang: quotaMagang ? "" : "Quota magang wajib diisi.",
      };
      setMitraMagangFormErrors(nextErrors);
      if (Object.values(nextErrors).some(Boolean)) {
        return;
      }

      const normalizedQuota = mitraMagangForm.quota_magang
        ? Math.min(99, Number(String(mitraMagangForm.quota_magang).replace(/\D/g, "").slice(0, 2)))
        : null;
      const payload = {
        nama,
        bidang_jenis: bidangJenis,
        lokasi,
        email_kontak: String(mitraMagangForm.email_kontak || "").trim(),
        website: String(mitraMagangForm.website || "").trim(),
        posisi_magang: String(mitraMagangForm.posisi_magang || "").trim(),
        quota_magang: Number.isFinite(normalizedQuota) ? normalizedQuota : null,
        kriteria: String(mitraMagangForm.kriteria || "").trim(),
        prosedur_perusahaan: String(mitraMagangForm.prosedur_perusahaan || "").trim(),
        status: status === "inactive" ? "inactive" : "active",
      };

      const isEditMode = Boolean(editingMitraMagang?.id);
      setSavingMitraMagang(true);
      try {
        await fetchWithAuth(
          isEditMode
            ? `/api/sekretaris/mitra-magang/${editingMitraMagang.id}`
            : "/api/sekretaris/mitra-magang",
          {
            method: isEditMode ? "PUT" : "POST",
            body: JSON.stringify(payload),
          }
        );
        showSuccessToast(isEditMode ? "Mitra magang berhasil diperbarui." : "Mitra magang berhasil ditambahkan.");
        resetMitraMagangForm();
        setMitraMagangMode("list");
        await loadAllData();
      } catch (submitError) {
        if (submitError.message !== "__SESSION_EXPIRED__") {
          const message = submitError.message || "Gagal menyimpan mitra magang.";
          const lowerMessage = message.toLowerCase();
          setMitraMagangFormErrors((prev) => ({
            ...prev,
            ...(lowerMessage.includes("quota") || lowerMessage.includes("kuota")
              ? { quota_magang: message }
              : {}),
            ...(lowerMessage.includes("nama") || lowerMessage.includes("terdaftar")
              ? { nama: message }
              : lowerMessage.includes("quota") || lowerMessage.includes("kuota")
              ? {}
              : { nama: message }),
          }));
        }
      } finally {
        setSavingMitraMagang(false);
      }
    },
    [editingMitraMagang, fetchWithAuth, loadAllData, mitraMagangForm, resetMitraMagangForm]
  );

  const handleDeactivateMitraMagang = useCallback(
    async (row) => {
      if (!row?.id) return;
      const result = await Swal.fire({
        title: "Nonaktifkan mitra magang?",
        text: `${row.nama || "Mitra"} tidak akan muncul lagi di pilihan mahasiswa.`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Nonaktifkan",
        cancelButtonText: "Batal",
        confirmButtonColor: "#b73a3a",
      });
      if (!result.isConfirmed) return;

      setDeletingMitraMagangId(row.id);
      try {
        await fetchWithAuth(`/api/sekretaris/mitra-magang/${row.id}`, { method: "DELETE" });
        showSuccessToast("Mitra magang berhasil dinonaktifkan.");
        if (editingMitraMagang?.id === row.id) {
          resetMitraMagangForm();
        }
        await loadAllData();
      } catch (deleteError) {
        if (deleteError.message !== "__SESSION_EXPIRED__") {
          showErrorToast(deleteError.message || "Gagal menonaktifkan mitra magang.");
        }
      } finally {
        setDeletingMitraMagangId(null);
      }
    },
    [editingMitraMagang?.id, fetchWithAuth, loadAllData, resetMitraMagangForm]
  );

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

  const filteredMonitoringMahasiswaRows = useMemo(() => {
    const query = monitoringMahasiswaQuery.trim().toLowerCase();
    const rows = Array.isArray(monitoringMahasiswa.rows) ? monitoringMahasiswa.rows : [];
    if (!query) return rows;

    return rows.filter((row) =>
      [
        row.mahasiswa?.nim,
        row.mahasiswa?.nama,
        row.mahasiswa?.angkatan,
        row.jalur,
        row.penjaluran,
        row.tahap,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [monitoringMahasiswa.rows, monitoringMahasiswaQuery]);

  const monitoringDetailJalur = String(
    selectedMonitoringMahasiswa?.penjaluran || selectedMonitoringMahasiswa?.jalur || ""
  )
    .trim()
    .toLowerCase();
  const isMonitoringResearchDetail = monitoringDetailJalur === "penelitian";
  const monitoringResearchTopicRows = useMemo(() => {
    if (!isMonitoringResearchDetail || !monitoringSubmissionDetail) return [];
    const topics = Array.isArray(monitoringSubmissionDetail?.detail_pengajuan?.topik_dipilih)
      ? monitoringSubmissionDetail.detail_pengajuan.topik_dipilih
      : [];
    const approvedTopic = monitoringSubmissionDetail?.hasil_pengajuan?.topik_disetujui;
    if (!approvedTopic) return topics;
    const completeTopic = topics.find(
      (item) =>
        (approvedTopic.slot && Number(item?.slot) === Number(approvedTopic.slot)) ||
        (approvedTopic.kode && String(item?.kode || "") === String(approvedTopic.kode))
    );
    return [{ ...(completeTopic || {}), ...approvedTopic }];
  }, [isMonitoringResearchDetail, monitoringSubmissionDetail]);

  const monitoringSubmissionTitle = useMemo(() => {
    if (!monitoringSubmissionDetail) return "-";
    if (isMonitoringResearchDetail) {
      return (
        monitoringSubmissionDetail?.hasil_pengajuan?.topik_disetujui?.judul ||
        monitoringSubmissionDetail?.detail_pengajuan?.judul_mandiri ||
        monitoringResearchTopicRows[0]?.judul ||
        "-"
      );
    }
    const payload = getMagangPayload(monitoringSubmissionDetail);
    if (monitoringDetailJalur === "magang") {
      const company = getMagangCompanyName(monitoringSubmissionDetail);
      const position = getMagangProposedPositionLabel(monitoringSubmissionDetail);
      return [company, position !== "-" ? position : null].filter(Boolean).join(" - ") || "-";
    }
    return payload.nama_program || payload.nama_bisnis || payload.nama_usaha || payload.ringkasan || "-";
  }, [isMonitoringResearchDetail, monitoringDetailJalur, monitoringResearchTopicRows, monitoringSubmissionDetail]);

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

  const masterTopikFilterOptions = useMemo(() => {
    const clusterSet = new Set();
    const statusSet = new Set();
    const dosenMap = new Map();

    for (const row of masterTopikRows) {
      const cluster = String(row?.cluster || "").trim();
      if (cluster) clusterSet.add(cluster);

      const status = String(row?.status || "").trim().toLowerCase();
      if (status) statusSet.add(status);

      const dosenId = row?.dosen?.id ?? row?.dosen_id ?? row?.dosenId;
      const dosenName = formatDosenFullName(
        row?.dosen?.nama || row?.dosen_nama || row?.nama_dosen,
        row?.dosen?.gelar || row?.dosen_gelar
      );
      const dosenKey = dosenId ? String(dosenId) : dosenName.toLowerCase();
      if (dosenKey && dosenName) {
        dosenMap.set(dosenKey, dosenName);
      }
    }

    return {
      cluster: Array.from(clusterSet).sort((a, b) => a.localeCompare(b, "id")),
      status: Array.from(statusSet).sort((a, b) => a.localeCompare(b, "id")),
      dosen: Array.from(dosenMap.entries())
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.label.localeCompare(b.label, "id")),
    };
  }, [masterTopikRows]);

  const filteredMasterTopikRows = useMemo(() => {
    const keyword = masterTopikQuery.trim().toLowerCase();
    const selectedCluster = String(masterTopikFilters.cluster || "").trim();
    const selectedStatus = String(masterTopikFilters.status || "").trim().toLowerCase();
    const selectedDosen = String(masterTopikFilters.dosen || "").trim();

    return masterTopikRows.filter((row) => {
      if (selectedCluster && String(row?.cluster || "").trim() !== selectedCluster) {
        return false;
      }

      if (selectedStatus && String(row?.status || "").trim().toLowerCase() !== selectedStatus) {
        return false;
      }

      const dosenId = row?.dosen?.id ?? row?.dosen_id ?? row?.dosenId;
      const dosenName = formatDosenFullName(
        row?.dosen?.nama || row?.dosen_nama || row?.nama_dosen,
        row?.dosen?.gelar || row?.dosen_gelar
      );
      const rowDosenKey = dosenId ? String(dosenId) : dosenName.toLowerCase();
      if (selectedDosen && rowDosenKey !== selectedDosen) {
        return false;
      }

      if (!keyword) return true;

      const haystack = [
        row.kode,
        row.judul,
        row.keyword,
        row.cluster,
        row.status,
        row.dosen?.nama,
        row.dosen?.gelar,
        row.dosen_nama,
        row.dosen_gelar,
        row.nama_dosen,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(keyword);
    });
  }, [masterTopikRows, masterTopikFilters, masterTopikQuery]);

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
  }, [masterTopikFilters, masterTopikQuery]);

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
        row.calon_dosen_pembimbing?.nama,
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
  const submissionDecisionHistory = useMemo(
    () =>
      Array.isArray(submissionDetail?.riwayat_persetujuan)
        ? submissionDetail.riwayat_persetujuan
        : [],
    [submissionDetail?.riwayat_persetujuan]
  );

  const filteredFinalResearchRows = useMemo(() => {
    const keyword = finalResearchQuery.trim().toLowerCase();
    if (!keyword) return finalResearchRows;
    return finalResearchRows.filter((item) => {
      const searchable = [
        item.id,
        "penelitian",
        item.tipe_pengajuan === "judul_mandiri" ? "judul mandiri" : "topik dosen",
        item.mahasiswa?.nim,
        item.mahasiswa?.nama,
        item.mahasiswa?.email,
        item.ketua_cluster?.nama,
        getFinalResearchTitle(item),
        getFinalResearchSummary(item),
        ...(Array.isArray(item.topik)
          ? item.topik.flatMap((topik) => [topik.kode, topik.judul, topik.dosen_nama, topik.status])
          : []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return searchable.includes(keyword);
    });
  }, [finalResearchQuery, finalResearchRows]);
  const finalResearchApprovedTopics = useMemo(
    () =>
      Array.isArray(finalResearchDetail?.topik_lolos_cluster)
        ? [...finalResearchDetail.topik_lolos_cluster].sort((left, right) => Number(left.slot) - Number(right.slot))
        : [],
    [finalResearchDetail]
  );
  const finalResearchFocusedTopic = useMemo(
    () =>
      finalResearchApprovedTopics.find(
        (item) => getFinalResearchTopicKey(item) === String(finalResearchFocusSlot)
      ) || finalResearchApprovedTopics[0] || null,
    [finalResearchApprovedTopics, finalResearchFocusSlot]
  );
  const hasViewedAllFinalResearchTopics =
    finalResearchApprovedTopics.length > 0 &&
    finalResearchApprovedTopics.every((item) => finalResearchViewedSlots.includes(getFinalResearchTopicKey(item)));

  const filteredFinalNonPenelitianRows = useMemo(() => {
    const keyword = finalResearchQuery.trim().toLowerCase();
    return sekprodiNonPenelitianRows.filter((row) => {
      if (!keyword) return true;
      const jalur = String(row?.jalur || "").trim().toLowerCase();
      const mitraGridData = jalur === "magang" ? getMagangMitraGridData(row) : {};

      const haystack = [
        row.id,
        row.jalur,
        formatLabel(row.jalur),
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
        mitraGridData.nama,
        mitraGridData.bidang_jenis,
        mitraGridData.lokasi,
        mitraGridData.email_kontak,
        mitraGridData.website,
        mitraGridData.posisi_magang,
        mitraGridData.quota_magang,
        mitraGridData.kriteria,
        mitraGridData.prosedur_perusahaan,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(keyword);
    });
  }, [finalResearchQuery, sekprodiNonPenelitianRows]);

  const isFinalResearchDetailMode = finalResearchMode === "review";
  const isFinalNonPenelitianDetailMode = finalNonPenelitianMode === "review" || isFinalResearchDetailMode;
  const finalApprovalGridRows = useMemo(() => {
    return [
      ...filteredFinalResearchRows.map((row) => ({
        key: `final-penelitian-${row.id}`,
        type: "penelitian",
        row,
      })),
      ...filteredFinalNonPenelitianRows.map((row) => ({
        key: `final-${row.jalur || "non-penelitian"}-${row.id}`,
        type: "non_penelitian",
        row,
      })),
    ].sort((left, right) => {
      const leftRow = left.row || {};
      const rightRow = right.row || {};
      const leftTime = new Date(leftRow.submitted_at || leftRow.diperbarui_pada || leftRow.updatedAt || leftRow.createdAt || 0).getTime();
      const rightTime = new Date(rightRow.submitted_at || rightRow.diperbarui_pada || rightRow.updatedAt || rightRow.createdAt || 0).getTime();
      return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
    });
  }, [filteredFinalNonPenelitianRows, filteredFinalResearchRows]);

  const filteredMitraMagangRows = useMemo(() => {
    const keyword = mitraMagangQuery.trim().toLowerCase();
    if (!keyword) return mitraMagangRows;
    return mitraMagangRows.filter((row) => {
      const haystack = [
        row.id,
        row.nama,
        row.bidang_jenis,
        row.lokasi,
        row.email_kontak,
        row.website,
        row.posisi_magang,
        row.quota_magang,
        row.kriteria,
        row.prosedur_perusahaan,
        row.status,
        row.is_active ? "aktif active" : "nonaktif inactive",
        row.createdAt,
        row.updatedAt,
      ]
        .filter((item) => item !== null && item !== undefined && String(item).trim() !== "")
        .join(" ")
        .toLowerCase();
      return haystack.includes(keyword);
    });
  }, [mitraMagangQuery, mitraMagangRows]);
  const totalMitraMagangPages = useMemo(
    () => Math.max(1, Math.ceil(filteredMitraMagangRows.length / DOSEN_GRID_PAGE_SIZE)),
    [filteredMitraMagangRows.length]
  );
  const pagedMitraMagangRows = useMemo(() => {
    const start = (mitraMagangPage - 1) * DOSEN_GRID_PAGE_SIZE;
    return filteredMitraMagangRows.slice(start, start + DOSEN_GRID_PAGE_SIZE);
  }, [filteredMitraMagangRows, mitraMagangPage]);
  const mitraMagangRangeStart =
    filteredMitraMagangRows.length === 0 ? 0 : (mitraMagangPage - 1) * DOSEN_GRID_PAGE_SIZE + 1;
  const mitraMagangRangeEnd = Math.min(
    mitraMagangPage * DOSEN_GRID_PAGE_SIZE,
    filteredMitraMagangRows.length
  );

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
  const periodeDosenPembimbingOptions = useMemo(
    () => (Array.isArray(periodeOverview.dosen_pembimbing_options)
      ? periodeOverview.dosen_pembimbing_options
      : []),
    [periodeOverview.dosen_pembimbing_options]
  );
  const periodeKetuaKlasterOptions = useMemo(
    () => (Array.isArray(periodeOverview.ketua_klaster_options) ? periodeOverview.ketua_klaster_options : []),
    [periodeOverview.ketua_klaster_options]
  );
  const finalResearchClusterCode = useMemo(() => {
    const explicitCluster = normalizeTopikClusterCode(
      finalResearchFocusedTopic?.cluster || finalResearchDetail?.cluster_penelitian
    );
    return explicitCluster || resolveTopikClusterFromKode(finalResearchFocusedTopic?.kode)?.code || "";
  }, [finalResearchDetail?.cluster_penelitian, finalResearchFocusedTopic?.cluster, finalResearchFocusedTopic?.kode]);
  const finalResearchSupervisorOptions = useMemo(() => {
    if (!finalResearchClusterCode) return [];
    return periodeDosenPembimbingOptions.filter((dosen) => {
      const clusterCodes = Array.isArray(dosen.cluster_codes) ? dosen.cluster_codes : [];
      const isClusterMember = clusterCodes.some(
        (code) => normalizeResearchClusterCode(code) === finalResearchClusterCode
      );
      return isClusterMember && dosen.kuota?.is_penuh !== true;
    });
  }, [finalResearchClusterCode, periodeDosenPembimbingOptions]);
  const periodeDosenMap = useMemo(
    () => new Map(periodeDosenPembimbingOptions.map((item) => [Number(item.id), item])),
    [periodeDosenPembimbingOptions]
  );
  useEffect(() => {
    const validIds = new Set(periodeDosenPembimbingOptions.map((dosen) => Number(dosen.id)));
    let removedSelection = false;

    if (
      finalNonPenelitianDosenPembimbingId
      && !validIds.has(Number(finalNonPenelitianDosenPembimbingId))
    ) {
      setFinalNonPenelitianDosenPembimbingId("");
      setFinalNonPenelitianDosenQuery("");
      removedSelection = true;
    }
    if (
      finalNonPenelitianDosenPembimbing2Id
      && !validIds.has(Number(finalNonPenelitianDosenPembimbing2Id))
    ) {
      setFinalNonPenelitianDosenPembimbing2Id("");
      setFinalNonPenelitianDosen2Query("");
      removedSelection = true;
    }
    if (
      finalResearchPrimarySupervisorId
      && !validIds.has(Number(finalResearchPrimarySupervisorId))
    ) {
      setFinalResearchPrimarySupervisorId("");
      removedSelection = true;
    }
    if (
      finalResearchSecondarySupervisorId
      && !validIds.has(Number(finalResearchSecondarySupervisorId))
    ) {
      setFinalResearchSecondarySupervisorId("");
      removedSelection = true;
    }

    if (removedSelection) {
      showInfoToast("Pilihan pembimbing dihapus karena dosen tidak lagi tersedia pada periode aktif.");
    }
  }, [
    finalNonPenelitianDosenPembimbing2Id,
    finalNonPenelitianDosenPembimbingId,
    finalResearchPrimarySupervisorId,
    finalResearchSecondarySupervisorId,
    periodeDosenPembimbingOptions,
  ]);
  useEffect(() => {
    const eligibleIds = new Set(finalResearchSupervisorOptions.map((dosen) => Number(dosen.id)));
    let removedSelection = false;
    if (finalResearchPrimarySupervisorId && !eligibleIds.has(Number(finalResearchPrimarySupervisorId))) {
      setFinalResearchPrimarySupervisorId("");
      removedSelection = true;
    }
    if (finalResearchSecondarySupervisorId && !eligibleIds.has(Number(finalResearchSecondarySupervisorId))) {
      setFinalResearchSecondarySupervisorId("");
      removedSelection = true;
    }
    if (removedSelection) {
      showInfoToast("Pilihan pembimbing dihapus karena tidak sesuai cluster atau tidak menerima bimbingan baru.");
    }
  }, [
    finalResearchPrimarySupervisorId,
    finalResearchSecondarySupervisorId,
    finalResearchSupervisorOptions,
  ]);
  const selectedFinalNonPenelitianDosen = useMemo(
    () => periodeDosenMap.get(Number(finalNonPenelitianDosenPembimbingId || 0)) || null,
    [finalNonPenelitianDosenPembimbingId, periodeDosenMap]
  );
  const selectedFinalNonPenelitianDosen2 = useMemo(
    () => periodeDosenMap.get(Number(finalNonPenelitianDosenPembimbing2Id || 0)) || null,
    [finalNonPenelitianDosenPembimbing2Id, periodeDosenMap]
  );
  const filteredFinalNonPenelitianDosenOptions = useMemo(() => {
    const keyword = finalNonPenelitianDosenQuery.trim().toLowerCase();
    const source = periodeDosenPembimbingOptions.map((dosen) => ({
      ...dosen,
      label: `${formatDosenFullName(dosen.nama, dosen.gelar) || "-"} - NIK: ${dosen.nik || "-"}`,
    }));
    if (!keyword) return source;
    return source.filter((dosen) =>
        [dosen.nama, dosen.gelar, formatDosenFullName(dosen.nama, dosen.gelar), dosen.nik, dosen.email, dosen.label]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(keyword)
      );
  }, [finalNonPenelitianDosenQuery, periodeDosenPembimbingOptions]);
  const filteredFinalNonPenelitianDosen2Options = useMemo(() => {
    const keyword = finalNonPenelitianDosen2Query.trim().toLowerCase();
    const source = periodeDosenPembimbingOptions
      .filter((dosen) => Number(dosen.id) !== Number(finalNonPenelitianDosenPembimbingId || 0))
      .map((dosen) => ({
        ...dosen,
        label: `${formatDosenFullName(dosen.nama, dosen.gelar) || "-"} - NIK: ${dosen.nik || "-"}`,
      }));
    if (!keyword) return source;
    return source.filter((dosen) =>
      [dosen.nama, dosen.gelar, formatDosenFullName(dosen.nama, dosen.gelar), dosen.nik, dosen.email, dosen.label]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(keyword)
    );
  }, [finalNonPenelitianDosen2Query, finalNonPenelitianDosenPembimbingId, periodeDosenPembimbingOptions]);
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
        row.ketua?.ketua_dosen?.gelar,
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
            program_kuliah: mahasiswa.program_kuliah || null,
            status_jalur_saat_ini: mahasiswa.status_jalur_saat_ini,
            dosen_pembimbing_akademik: formatDosenFullName(mahasiswa.dosenPembimbingAkademik?.nama, mahasiswa.dosenPembimbingAkademik?.gelar) || "-",
            dosen_pembimbing_skripsi: formatDosenFullName(mahasiswa.dosenPembimbingSkripsi?.nama, mahasiswa.dosenPembimbingSkripsi?.gelar) || "-",
            semester_mahasiswa: null,
            semester_penjaluran_ke: 0,
            semester_penjaluran_aktif: mahasiswa.semester_penjaluran_aktif || 0,
            tahun_akademik: null,
            semester_akademik: null,
            periode_label: null,
            jalur: null,
            nama_penjaluran: null,
            penjaluran_sebelumnya: null,
            penjaluran_baru: null,
            pembimbing_ta: null,
            pembimbing_ta_sebelumnya: null,
            pembimbing_ta_baru: null,
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
        program_kuliah: item.program_kuliah || mahasiswa.program_kuliah || null,
        status_jalur_saat_ini: mahasiswa.status_jalur_saat_ini,
        dosen_pembimbing_akademik: formatDosenFullName(mahasiswa.dosenPembimbingAkademik?.nama, mahasiswa.dosenPembimbingAkademik?.gelar) || "-",
        dosen_pembimbing_skripsi: formatDosenFullName(mahasiswa.dosenPembimbingSkripsi?.nama, mahasiswa.dosenPembimbingSkripsi?.gelar) || "-",
        semester_mahasiswa: item.semester_mahasiswa || null,
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
        penjaluran_sebelumnya: item.penjaluran_sebelumnya || null,
        penjaluran_baru: item.penjaluran_baru || null,
        pembimbing_ta: formatDosenFullName(item.pembimbing_ta?.nama, item.pembimbing_ta?.gelar) || null,
        pembimbing_ta_sebelumnya: formatDosenFullName(item.dosen_pembimbing_ta_sebelumnya?.nama, item.dosen_pembimbing_ta_sebelumnya?.gelar) || null,
        pembimbing_ta_baru: formatDosenFullName(item.dosen_pembimbing_ta_baru?.nama, item.dosen_pembimbing_ta_baru?.gelar) || null,
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
        .filter((mahasiswa) => mahasiswa.is_mahasiswa_bimbingan === true
          || Number(mahasiswa.dosen_pembimbing_skripsi_id) === dosenId)
        .map((mahasiswa) => mahasiswa.id)
    );

    return mahasiswaMasterHistoryRows.filter((row) => mahasiswaBimbinganIds.has(row.mahasiswa_id));
  }, [kuotaData?.dosen?.id, mahasiswaMasterRows, mahasiswaMasterHistoryRows]);

  const mahasiswaDpaHistoryRows = useMemo(() => {
    const dosenId = Number(kuotaData?.dosen?.id);
    if (!Number.isFinite(dosenId)) return [];

    const mahasiswaDpaIds = new Set(
      mahasiswaMasterRows
        .filter((mahasiswa) => Number(mahasiswa.dosen_pembimbing_akademik_id) === dosenId)
        .map((mahasiswa) => mahasiswa.id)
    );

    return mahasiswaMasterHistoryRows.filter((row) => mahasiswaDpaIds.has(row.mahasiswa_id));
  }, [kuotaData?.dosen?.id, mahasiswaMasterRows, mahasiswaMasterHistoryRows]);

  const mahasiswaRowsByActiveTab = useMemo(() => {
    if (activeTab === "mahasiswa-bimbingan") return mahasiswaBimbinganHistoryRows;
    if (activeTab === "mahasiswa-dpa") return mahasiswaDpaHistoryRows;
    return mahasiswaMasterHistoryRows;
  }, [activeTab, mahasiswaBimbinganHistoryRows, mahasiswaDpaHistoryRows, mahasiswaMasterHistoryRows]);

  const mahasiswaMasterFilterOptions = useMemo(() => {
    const angkatanSet = new Set();
    const programKuliahSet = new Set();
    const semesterPenjaluranSet = new Set();
    const periodeSet = new Set();
    const penjaluranSet = new Set();
    const tipePendaftaranSet = new Set();

    for (const row of mahasiswaRowsByActiveTab) {
      if (row?.angkatan) {
        angkatanSet.add(String(row.angkatan).trim());
      }
      if (row?.program_kuliah) {
        programKuliahSet.add(String(row.program_kuliah).trim().toLowerCase());
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
      program_kuliah: Array.from(programKuliahSet).sort((a, b) => a.localeCompare(b, "id")),
      semester_penjaluran: Array.from(semesterPenjaluranSet).sort((a, b) => Number(a) - Number(b)),
      periode: Array.from(periodeSet).sort((a, b) => a.localeCompare(b, "id")),
      penjaluran: Array.from(penjaluranSet).sort((a, b) => a.localeCompare(b, "id")),
      tipe_pendaftaran: tipePendaftaranList,
    };
  }, [mahasiswaRowsByActiveTab]);

  const filteredMahasiswaMasterRows = useMemo(() => {
    const selectedAngkatan = String(mahasiswaMasterFilters.angkatan || "").trim();
    const selectedProgramKuliah = String(mahasiswaMasterFilters.program_kuliah || "").trim().toLowerCase();
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

      if (selectedProgramKuliah && String(row?.program_kuliah || "").trim().toLowerCase() !== selectedProgramKuliah) {
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
        row.program_kuliah,
        row.program_kuliah ? formatLabel(row.program_kuliah) : null,
        row.status_jalur_saat_ini,
        row.semester_mahasiswa ? `semester mahasiswa ${row.semester_mahasiswa}` : null,
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
        row.penjaluran_sebelumnya,
        row.penjaluran_baru,
        row.pembimbing_ta,
        row.pembimbing_ta_sebelumnya,
        row.pembimbing_ta_baru,
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
    const programKuliah = String(mahasiswaMasterFilters.program_kuliah || "").trim();
    const semesterPenjaluran = String(mahasiswaMasterFilters.semester_penjaluran || "").trim();
    const periode = String(mahasiswaMasterFilters.periode || "").trim();
    const penjaluran = String(mahasiswaMasterFilters.penjaluran || "").trim();
    const tipePendaftaran = String(mahasiswaMasterFilters.tipe_pendaftaran || "").trim();

    if (angkatan) {
      chips.push({ key: "angkatan", label: `Angkatan: ${angkatan}` });
    }
    if (programKuliah) {
      chips.push({ key: "program_kuliah", label: `Program: ${formatLabel(programKuliah)}` });
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

  const loadSupervisorHistoryPanel = async (row) => {
    const mahasiswaId = Number(row?.mahasiswa_id);
    if (!mahasiswaId) return;
    setSupervisorHistoryPanel({ mahasiswaId, mahasiswaName: row?.nama || "Mahasiswa", loading: true, data: null, error: "" });
    try {
      const path = isSekretaris
        ? `/api/sekretaris/mahasiswa/${mahasiswaId}/penetapan-pembimbing`
        : `/api/dosen/mahasiswa/${mahasiswaId}/penetapan-pembimbing`;
      const payload = await fetchWithAuth(path);
      setSupervisorHistoryPanel({ mahasiswaId, mahasiswaName: row?.nama || payload?.mahasiswa?.nama || "Mahasiswa", loading: false, data: payload, error: "" });
    } catch (historyError) {
      setSupervisorHistoryPanel({ mahasiswaId, mahasiswaName: row?.nama || "Mahasiswa", loading: false, data: null, error: historyError.message || "Gagal memuat histori pembimbing." });
    }
  };

  useEffect(() => {
    setMahasiswaMasterPage(1);
  }, [activeTab, mahasiswaMasterFilters, mahasiswaMasterQuery]);

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
    setMitraMagangPage(1);
  }, [mitraMagangQuery, mitraMagangStatusFilter]);

  useEffect(() => {
    if (mitraMagangPage > totalMitraMagangPages) {
      setMitraMagangPage(totalMitraMagangPages);
    }
  }, [mitraMagangPage, totalMitraMagangPages]);

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
    if (activeTab !== "monitoring-mahasiswa") {
      setMonitoringMahasiswaMode("list");
      setSelectedMonitoringMahasiswa(null);
      setMonitoringSubmissionDetail(null);
      setMonitoringDetailError("");
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "magang-review") {
      handleBackToMagangReviewList();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "approval-penelitian") {
      setFinalResearchMode("list");
      setFinalResearchDetail(null);
      setFinalResearchFocusSlot("");
      setFinalResearchViewedSlots([]);
      setFinalResearchDecision("");
      setFinalResearchDecisionNote("");
      setFinalResearchDecisionError("");
      setFinalNonPenelitianMode("list");
      setSelectedFinalNonPenelitianId(null);
      setFinalNonPenelitianDetail(null);
      setFinalNonPenelitianDecision("");
      setFinalNonPenelitianDecisionNote("");
      setFinalNonPenelitianDosenPembimbingId("");
      setFinalNonPenelitianDosenPembimbing2Id("");
      setFinalNonPenelitianDosenQuery("");
      setFinalNonPenelitianDosenComboOpen(false);
      setFinalNonPenelitianDosen2Query("");
      setFinalNonPenelitianDosen2ComboOpen(false);
      setFinalNonPenelitianDecisionErrors({ note: "", dosen: "" });
    }
  }, [activeTab]);

  useEffect(() => {
    handleBackToPengampuReviewList();
  }, [activePengampuReviewJalur]);

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

  const handleOpenMonitoringDetail = async (row) => {
    if (!row?.mahasiswa?.id) return;

    setSelectedMonitoringMahasiswa(row);
    setMonitoringMahasiswaMode("detail");
    setMonitoringSubmissionDetail(null);
    setMonitoringDetailError("");
    setLoadingMonitoringDetail(true);

    try {
      const normalizedJalur = String(row.penjaluran || row.jalur || "").trim().toLowerCase();
      if (normalizedJalur === "penelitian") {
        if (!row.pengajuan_id) throw new Error("Detail pengajuan penelitian belum tersedia.");
        const detail = await fetchWithAuth(`/api/dosen/submissions/${row.pengajuan_id}`);
        setMonitoringSubmissionDetail(detail || null);
      } else {
        setMonitoringSubmissionDetail(buildMonitoringNonResearchDetail(row));
      }
    } catch (detailError) {
      if (detailError?.message !== "__SESSION_EXPIRED__") {
        setMonitoringDetailError(detailError.message || "Gagal memuat detail mahasiswa bimbingan.");
      }
    } finally {
      setLoadingMonitoringDetail(false);
    }
  };

  const handleBackToMonitoringList = () => {
    setMonitoringMahasiswaMode("list");
    setSelectedMonitoringMahasiswa(null);
    setMonitoringSubmissionDetail(null);
    setMonitoringDetailError("");
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
      showErrorToast(submissionDetail?.review_block_reason || "Anda tidak memiliki akses keputusan untuk pengajuan ini.");
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

  const handleBackToMagangReviewList = () => {
    setMagangReviewMode("list");
    setSelectedMagangReviewId(null);
    setMagangReviewDetail(null);
    setMagangReviewDecisionNote("");
  };

  const handleOpenMagangReviewDetail = async (id) => {
    setSelectedMagangReviewId(id);
    setMagangReviewDecisionNote("");
    setLoadingMagangReviewDetail(true);
    setMagangReviewMode("review");
    try {
      const detail = await fetchWithAuth(`/api/dosen/non-penelitian/magang/reviews/${id}`);
      setMagangReviewDetail(detail || null);
    } catch (detailError) {
      if (detailError?.message !== "__SESSION_EXPIRED__") {
        showErrorToast(detailError.message || "Gagal memuat detail review magang.");
      }
      handleBackToMagangReviewList();
    } finally {
      setLoadingMagangReviewDetail(false);
    }
  };

  const handleRefreshMagangReviewDetail = async () => {
    if (!selectedMagangReviewId) return;
    setLoadingMagangReviewDetail(true);
    try {
      const detail = await fetchWithAuth(`/api/dosen/non-penelitian/magang/reviews/${selectedMagangReviewId}`);
      setMagangReviewDetail(detail || null);
    } catch (detailError) {
      if (detailError?.message !== "__SESSION_EXPIRED__") {
        showErrorToast(detailError.message || "Gagal memuat ulang detail review magang.");
      }
    } finally {
      setLoadingMagangReviewDetail(false);
    }
  };

  const handleOpenMagangReviewDocument = async (documentKey, fileName) => {
    const id = selectedMagangReviewId || magangReviewDetail?.id;
    if (!id || !documentKey) {
      showErrorToast("Dokumen magang tidak valid.");
      return;
    }

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/dosen/non-penelitian/magang/reviews/${id}/documents/${documentKey}`,
        {
          headers: {
            Authorization: `Bearer ${session.token}`,
          },
        }
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const message = String(payload?.message || "Gagal membuka dokumen magang.");
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

        throw new Error(message);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const openedWindow = window.open(url, "_blank", "noopener,noreferrer");
      if (!openedWindow) {
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = fileName || "dokumen-magang";
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
      }
      window.setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch (documentError) {
      if (documentError?.message !== "__SESSION_EXPIRED__") {
        showErrorToast(documentError.message || "Gagal membuka dokumen magang.");
      }
    }
  };

  const handleSubmitMagangReviewDecision = async (decision) => {
    const id = selectedMagangReviewId || magangReviewDetail?.id;
    if (!id) {
      showErrorToast("Data review magang tidak valid.");
      return;
    }

    const isApprove = decision === "approve";
    const note = String(magangReviewDecisionNote || "").trim();
    if (!isApprove && !note) {
      showErrorToast("Alasan penolakan wajib diisi.");
      return;
    }

    setMagangReviewActionId(id);
    try {
      await fetchWithAuth(`/api/dosen/non-penelitian/magang/reviews/${id}/${isApprove ? "approve" : "reject"}`, {
        method: "POST",
        body: JSON.stringify({ keterangan: note }),
      });
      showSuccessToast(
        isApprove
          ? "Pengajuan magang disetujui dan diteruskan ke Sekprodi."
          : "Pengajuan magang berhasil ditolak."
      );
      await loadAllData();
      handleBackToMagangReviewList();
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

  const handleBackToPengampuReviewList = () => {
    setPengampuReviewMode("list");
    setSelectedPengampuReviewId(null);
    setPengampuReviewDetail(null);
    setPengampuReviewDecisionNote("");
  };

  const handleOpenPengampuReviewDetail = async (id, config) => {
    if (!id || !config?.endpointSlug) {
      showErrorToast("Data review tidak valid.");
      return;
    }

    setSelectedPengampuReviewId(id);
    setPengampuReviewDecisionNote("");
    setLoadingPengampuReviewDetail(true);
    setPengampuReviewMode("review");
    try {
      const detail = await fetchWithAuth(`/api/dosen/non-penelitian/${config.endpointSlug}/reviews/${id}`);
      setPengampuReviewDetail(detail || null);
    } catch (detailError) {
      if (detailError?.message !== "__SESSION_EXPIRED__") {
        showErrorToast(detailError.message || `Gagal memuat detail ${config.title.toLowerCase()}.`);
      }
      handleBackToPengampuReviewList();
    } finally {
      setLoadingPengampuReviewDetail(false);
    }
  };

  const handleRefreshPengampuReviewDetail = async () => {
    if (!selectedPengampuReviewId || !activePengampuReviewConfig?.endpointSlug) return;
    setLoadingPengampuReviewDetail(true);
    try {
      const detail = await fetchWithAuth(
        `/api/dosen/non-penelitian/${activePengampuReviewConfig.endpointSlug}/reviews/${selectedPengampuReviewId}`
      );
      setPengampuReviewDetail(detail || null);
    } catch (detailError) {
      if (detailError?.message !== "__SESSION_EXPIRED__") {
        showErrorToast(detailError.message || `Gagal memuat ulang detail ${activePengampuReviewConfig.title.toLowerCase()}.`);
      }
    } finally {
      setLoadingPengampuReviewDetail(false);
    }
  };

  const handleOpenPengampuReviewDocument = async (documentKey, fileName) => {
    const id = selectedPengampuReviewId || pengampuReviewDetail?.id;
    if (!id || !documentKey || !activePengampuReviewConfig?.endpointSlug) {
      showErrorToast("Dokumen proposal tidak valid.");
      return;
    }

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/dosen/non-penelitian/${activePengampuReviewConfig.endpointSlug}/reviews/${id}/documents/${documentKey}`,
        { headers: { Authorization: `Bearer ${session.token}` } }
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const message = String(payload?.message || "Gagal membuka dokumen proposal.");
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
        throw new Error(message);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const openedWindow = window.open(url, "_blank", "noopener,noreferrer");
      if (!openedWindow) {
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = fileName || "dokumen-proposal";
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
      }
      window.setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch (documentError) {
      if (documentError?.message !== "__SESSION_EXPIRED__") {
        showErrorToast(documentError.message || "Gagal membuka dokumen proposal.");
      }
    }
  };

  const handleSubmitPengampuReviewDecision = async (config, decision) => {
    const id = selectedPengampuReviewId || pengampuReviewDetail?.id;
    if (!id || !config?.endpointSlug) {
      showErrorToast("Data review tidak valid.");
      return;
    }

    const isApprove = decision === "approve";
    const note = String(pengampuReviewDecisionNote || "").trim();
    if (!isApprove && !note) {
      showErrorToast("Alasan penolakan wajib diisi.");
      return;
    }

    const actionKey = `${config.jalur}-${id}`;
    setPengampuReviewActionId(actionKey);
    try {
      await fetchWithAuth(`/api/dosen/non-penelitian/${config.endpointSlug}/reviews/${id}/${isApprove ? "approve" : "reject"}`, {
        method: "POST",
        body: JSON.stringify({ keterangan: note }),
      });
      showSuccessToast(isApprove ? config.approveSuccess : config.rejectSuccess);
      await loadAllData();
      handleBackToPengampuReviewList();
    } catch (decisionError) {
      if (decisionError?.message !== "__SESSION_EXPIRED__") {
        showErrorToast(decisionError.message || `Gagal memproses keputusan ${config.title.toLowerCase()}.`);
      }
    } finally {
      setPengampuReviewActionId(null);
    }
  };

  const handleOpenSekprodiNonPenelitianDetail = async (row) => {
    const id = row?.id;
    if (!id) return;

    setSelectedFinalNonPenelitianId(id);
    setFinalNonPenelitianDecision("");
    setFinalNonPenelitianDecisionNote("");
    setFinalNonPenelitianDosenPembimbingId("");
    setFinalNonPenelitianDosenPembimbing2Id("");
    setFinalNonPenelitianDosenQuery("");
    setFinalNonPenelitianDosenComboOpen(false);
    setFinalNonPenelitianDosen2Query("");
    setFinalNonPenelitianDosen2ComboOpen(false);
    setFinalNonPenelitianDecisionErrors({ note: "", dosen: "" });
    setLoadingFinalNonPenelitianDetail(true);
    setFinalNonPenelitianMode("review");
    setSekprodiNonPenelitianActionId(id);
    try {
      const detail = await fetchWithAuth(`/api/sekretaris/non-penelitian/reviews/${id}`);
      setFinalNonPenelitianDetail(detail || null);
    } catch (detailError) {
      if (detailError?.message !== "__SESSION_EXPIRED__") {
        showErrorToast(detailError.message || "Gagal memuat detail proposal.");
      }
      setFinalNonPenelitianMode("list");
      setSelectedFinalNonPenelitianId(null);
      setFinalNonPenelitianDetail(null);
    } finally {
      setLoadingFinalNonPenelitianDetail(false);
      setSekprodiNonPenelitianActionId(null);
    }
  };

  const handleBackToFinalNonPenelitianList = () => {
    setFinalNonPenelitianMode("list");
    setSelectedFinalNonPenelitianId(null);
    setFinalNonPenelitianDetail(null);
    setFinalNonPenelitianDecision("");
    setFinalNonPenelitianDecisionNote("");
    setFinalNonPenelitianDosenPembimbingId("");
    setFinalNonPenelitianDosenPembimbing2Id("");
    setFinalNonPenelitianDosenQuery("");
    setFinalNonPenelitianDosenComboOpen(false);
    setFinalNonPenelitianDosen2Query("");
    setFinalNonPenelitianDosen2ComboOpen(false);
    setFinalNonPenelitianDecisionErrors({ note: "", dosen: "" });
  };

  const handleRefreshFinalNonPenelitianDetail = async () => {
    if (!selectedFinalNonPenelitianId) return;
    setLoadingFinalNonPenelitianDetail(true);
    try {
      const detail = await fetchWithAuth(`/api/sekretaris/non-penelitian/reviews/${selectedFinalNonPenelitianId}`);
      setFinalNonPenelitianDetail(detail || null);
    } catch (detailError) {
      if (detailError?.message !== "__SESSION_EXPIRED__") {
        showErrorToast(detailError.message || "Gagal memuat ulang detail proposal.");
      }
    } finally {
      setLoadingFinalNonPenelitianDetail(false);
    }
  };

  const handleOpenSekprodiNonPenelitianDocument = async (documentKey, fileName) => {
    const id = selectedFinalNonPenelitianId || finalNonPenelitianDetail?.id;
    if (!id || !documentKey) {
      showErrorToast("Dokumen proposal tidak valid.");
      return;
    }

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/sekretaris/non-penelitian/reviews/${id}/documents/${documentKey}`,
        {
          headers: {
            Authorization: `Bearer ${session.token}`,
          },
        }
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const message = String(payload?.message || "Gagal membuka dokumen proposal.");
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

        throw new Error(message);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const openedWindow = window.open(url, "_blank", "noopener,noreferrer");
      if (!openedWindow) {
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = fileName || "dokumen-proposal";
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
      }
      window.setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch (documentError) {
      if (documentError?.message !== "__SESSION_EXPIRED__") {
        showErrorToast(documentError.message || "Gagal membuka dokumen proposal.");
      }
    }
  };

  const handleSekprodiNonPenelitianDecision = async (decision) => {
    const id = selectedFinalNonPenelitianId || finalNonPenelitianDetail?.id;
    if (!id) {
      showErrorToast("Data proposal tidak valid.");
      return;
    }
    if (!["approve", "reject"].includes(decision)) {
      showErrorToast("Pilih keputusan terlebih dahulu.");
      return;
    }
    const isApprove = decision === "approve";
    const note = String(finalNonPenelitianDecisionNote || "").trim();
    const dosenPembimbingId = Number(finalNonPenelitianDosenPembimbingId || 0);
    const dosenPembimbing2Id = Number(finalNonPenelitianDosenPembimbing2Id || 0);
    const nextErrors = { note: "", dosen: "" };
    if (isApprove && !dosenPembimbingId) {
      nextErrors.dosen = "Pilih dosen pembimbing terlebih dahulu sebelum approve final.";
    }
    if (!note) {
      nextErrors.note = isApprove ? "Catatan keputusan wajib diisi." : "Alasan penolakan wajib diisi.";
    }
    setFinalNonPenelitianDecisionErrors(nextErrors);
    if (nextErrors.note || nextErrors.dosen) {
      return;
    }

    setSekprodiNonPenelitianActionId(id);
    try {
      await fetchWithAuth(
        `/api/sekretaris/non-penelitian/reviews/${id}/${isApprove ? "approve" : "reject"}`,
        {
          method: "POST",
          body: JSON.stringify({
            dosen_pembimbing_id: isApprove ? dosenPembimbingId : null,
            dosen_pembimbing_2_id: isApprove && dosenPembimbing2Id ? dosenPembimbing2Id : null,
            keterangan: note,
          }),
        }
      );
      showSuccessToast(
        isApprove
          ? "Proposal disetujui final dan dosen pembimbing berhasil ditetapkan."
          : "Proposal berhasil ditolak."
      );
      await loadAllData();
      handleBackToFinalNonPenelitianList();
    } catch (decisionError) {
      if (decisionError?.message !== "__SESSION_EXPIRED__") {
        showErrorToast(decisionError.message || "Gagal memproses keputusan proposal.");
      }
    } finally {
      setSekprodiNonPenelitianActionId(null);
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
      const decisionKey = extensionDecisionKeysRef.current.get(`approve:${id}`)
        || `extension-approve-${id}-${window.crypto?.randomUUID?.() || Date.now()}`;
      extensionDecisionKeysRef.current.set(`approve:${id}`, decisionKey);
      await fetchWithAuth(`/api/dosen/permohonan-extend/${id}/approve`, {
        method: "POST",
        headers: { "Idempotency-Key": decisionKey },
        body: JSON.stringify({
          keterangan_dosen: String(result.value || "").trim(),
        }),
      });
      extensionDecisionKeysRef.current.delete(`approve:${id}`);
      showSuccessToast("Permohonan extend berhasil disetujui.");
      await loadAllData();
    } catch (approveError) {
      if (approveError?.status) extensionDecisionKeysRef.current.delete(`approve:${id}`);
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
      const decisionKey = extensionDecisionKeysRef.current.get(`reject:${id}`)
        || `extension-reject-${id}-${window.crypto?.randomUUID?.() || Date.now()}`;
      extensionDecisionKeysRef.current.set(`reject:${id}`, decisionKey);
      await fetchWithAuth(`/api/dosen/permohonan-extend/${id}/reject`, {
        method: "POST",
        headers: { "Idempotency-Key": decisionKey },
        body: JSON.stringify({
          keterangan_dosen: result.value.trim(),
        }),
      });
      extensionDecisionKeysRef.current.delete(`reject:${id}`);
      showSuccessToast("Permohonan extend ditolak. Mahasiswa wajib melakukan penjaluran ulang.");
      await loadAllData();
    } catch (rejectError) {
      if (rejectError?.status) extensionDecisionKeysRef.current.delete(`reject:${id}`);
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
    setTopikFormErrors((prev) => ({
      ...prev,
      [name]: "",
      ...(name === "kode" || name === "cluster" ? { kode: "", cluster: "" } : {}),
    }));
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

    const nextErrors = {};
    if (!payload.kode) nextErrors.kode = "Kode topik wajib diisi.";
    if (!payload.cluster) nextErrors.cluster = "Cluster wajib dipilih.";
    if (!payload.judul) nextErrors.judul = "Judul topik wajib diisi.";
    if (!payload.keyword) nextErrors.keyword = "Keyword wajib diisi.";

    if (Object.keys(nextErrors).length > 0) {
      setTopikFormErrors(nextErrors);
      return;
    }

    if (!allowedTopikClusters.includes(payload.cluster)) {
      setTopikFormErrors({ cluster: `Cluster yang bisa dipilih hanya: ${allowedTopikClusters.join(", ")}.` });
      return;
    }

    const kodeCluster = resolveTopikClusterFromKode(payload.kode);
    if (!kodeCluster || !kodeCluster.label) {
      setTopikFormErrors({ kode: "Format kode topik tidak valid. Gunakan prefix: SIRKEL, SIBER, ITSC, atau MVK." });
      return;
    }

    if (kodeCluster.label !== payload.cluster) {
      const expectedCode = TOPIK_CLUSTER_CODE_BY_LABEL[payload.cluster] || payload.cluster;
      setTopikFormErrors({
        kode: `Kode topik ${payload.kode} tidak sesuai dengan cluster ${payload.cluster}.`,
        cluster: `Prefix kode harus ${expectedCode}.`,
      });
      return;
    }

    setTopikFormErrors({});
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
      setTopikFormErrors({});
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
    setTopikUploadCommitEndpoint("/api/dosen/upload/topics/commit");
  };

  const handleTopikUploadSubmit = async () => {
    if (!topikUploadFile) {
      showErrorToast("Pilih file Excel terlebih dahulu.");
      return;
    }

    setUploadingTopik(true);
    setUploadTopikResult(null);
    try {
      const normalizedApiBaseUrl = String(apiBaseUrl || "").replace(/\/+$/, "");
      const uploadBaseUrls = [];
      if (normalizedApiBaseUrl) uploadBaseUrls.push(normalizedApiBaseUrl);
      if (
        typeof window !== "undefined" &&
        ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname) &&
        !uploadBaseUrls.includes("http://localhost:3000")
      ) {
        uploadBaseUrls.push("http://localhost:3000");
      }
      if (typeof window !== "undefined" && !uploadBaseUrls.includes(window.location.origin)) {
        uploadBaseUrls.push(window.location.origin);
      }

      const uploadEndpoints = ["/api/dosen/upload/topics", "/api/admin/upload/topics"];
      let lastUploadError = null;
      let json = null;
      let activeCommitEndpoint = `${normalizedApiBaseUrl}${uploadEndpoints[0]}/commit`;

      for (const baseUrl of uploadBaseUrls) {
        for (const basePath of uploadEndpoints) {
          try {
            const formData = new FormData();
            formData.append("file", topikUploadFile);

            const response = await fetch(`${baseUrl}${basePath}/preview`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${session.token}`,
              },
              body: formData,
            });

            let responseJson = null;
            try {
              responseJson = await response.json();
            } catch (parseError) {
              responseJson = null;
            }

            const uploadMessage = String(responseJson?.message || "");
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

            const isMissingEndpoint =
              response.status === 404 ||
              String(responseJson?.message || "").toLowerCase().includes("endpoint tidak ditemukan");

            if (isMissingEndpoint) {
              lastUploadError = new Error(responseJson?.message || "Endpoint upload topik tidak ditemukan.");
              continue;
            }

            if (!response.ok || !responseJson) {
              if (responseJson) {
                setUploadTopikResult(responseJson);
              }
              throw new Error(responseJson?.message || "Upload topik gagal diproses.");
            }

            json = responseJson;
            activeCommitEndpoint = `${baseUrl}${basePath}/commit`;
            break;
          } catch (endpointError) {
            if (endpointError?.message === "__SESSION_EXPIRED__") {
              throw endpointError;
            }

            const isNetworkError =
              endpointError instanceof TypeError ||
              String(endpointError?.message || "").toLowerCase() === "failed to fetch";
            if (isNetworkError) {
              lastUploadError = endpointError;
              continue;
            }

            throw endpointError;
          }
        }
        if (json) break;
      }

      if (!json) {
        throw lastUploadError || new Error("Upload topik gagal diproses.");
      }

      setTopikUploadCommitEndpoint(activeCommitEndpoint);
      setUploadTopikResult(json);
      if (json.success) {
        showSuccessToast("Preview topik berhasil dibuat.");
      } else {
        showErrorToast(json.message || "Preview topik selesai dengan kegagalan.");
      }
    } catch (uploadError) {
      if (uploadError?.message !== "__SESSION_EXPIRED__") {
        const isNetworkError =
          uploadError instanceof TypeError ||
          String(uploadError?.message || "").toLowerCase() === "failed to fetch";
        showErrorToast(
          isNetworkError
            ? "Gagal menghubungi endpoint upload topik. Pastikan backend sudah berjalan dan refresh halaman."
            : uploadError.message || "Gagal memproses preview topik."
        );
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
      const commitUrl = topikUploadCommitEndpoint.startsWith("http")
        ? topikUploadCommitEndpoint
        : `${apiBaseUrl}${topikUploadCommitEndpoint}`;
      const response = await fetch(commitUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ rows: topikUploadValidRows }),
      });

      let payload = null;
      try {
        payload = await response.json();
      } catch (parseError) {
        payload = null;
      }

      const message = String(payload?.message || "").toLowerCase();
      const tokenError =
        message.includes("token tidak valid") ||
        message.includes("token tidak ditemukan") ||
        message.includes("kadaluarsa");

      if (response.status === 401 || (response.status === 403 && tokenError)) {
        if (!sessionExpiredRef.current) {
          sessionExpiredRef.current = true;
          onSessionExpired?.();
        }
        throw new Error("__SESSION_EXPIRED__");
      }

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || "Gagal menyimpan topik hasil preview.");
      }

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
    const nextValue = name === "tahun_akademik" ? formatAcademicYearInput(value) : value;
    setPeriodeForm((prev) => ({ ...prev, [name]: nextValue }));
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
      const selectedProgramKuliah = String(mahasiswaMasterFilters?.program_kuliah || "").trim();
      const selectedSemesterPenjaluran = String(mahasiswaMasterFilters?.semester_penjaluran || "").trim();
      const selectedPeriode = String(mahasiswaMasterFilters?.periode || "").trim();
      const selectedPenjaluran = String(mahasiswaMasterFilters?.penjaluran || "").trim();
      const selectedTipePendaftaran = String(mahasiswaMasterFilters?.tipe_pendaftaran || "").trim();

      if (selectedAngkatan) params.set("angkatan", selectedAngkatan);
      if (selectedProgramKuliah) params.set("program_kuliah", selectedProgramKuliah);
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

      const searchQuery = String(debouncedPeriodeMasterSearchQueryByField?.[fieldKey] || "")
        .trim()
        .toLowerCase();

      return options
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
    [periodeMasterOptionsByField, debouncedPeriodeMasterSearchQueryByField]
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
    PERIODE_MASTER_REQUIRED_FIELDS.forEach((item) => {
      if (!periodeMasterForm[item.key]) {
        fieldErrors[item.key] = `${item.label} wajib dipilih.`;
      }
    });

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

  const loadDosenPeriodAvailability = useCallback(async (periodeId) => {
    if (availabilityRefreshInFlightRef.current) return false;
    availabilityRefreshInFlightRef.current = true;
    setRefreshingDosenPeriodAvailability(true);
    try {
      const suffix = periodeId ? `?periode_penjaluran_id=${encodeURIComponent(periodeId)}` : "";
      const payload = await fetchWithAuth(`/api/sekretaris/master-dosen/ketersediaan${suffix}`);
      selectedDosenAvailabilityPeriodIdRef.current = payload?.periode?.id || null;
      setDosenPeriodAvailability({
        periodes: Array.isArray(payload?.periodes) ? payload.periodes : [],
        periode: payload?.periode || null,
        dosens: Array.isArray(payload?.dosens) ? payload.dosens : [],
        readiness: payload?.readiness || null,
        is_readonly: payload?.is_readonly === true,
      });
      setSelectedAvailabilityDosenIds([]);
      dirtyAvailabilityDosenIdsRef.current = [];
      setDirtyAvailabilityDosenIds([]);
      setDosenPeriodAvailabilityPage(1);
      return true;
    } catch (availabilityError) {
      showErrorToast(availabilityError.message || "Gagal memuat ketersediaan dosen.");
      return false;
    } finally {
      availabilityRefreshInFlightRef.current = false;
      setRefreshingDosenPeriodAvailability(false);
    }
  }, [fetchWithAuth]);

  const requestDosenPeriodAvailabilityRefresh = useCallback(async ({
    periodeId = selectedDosenAvailabilityPeriodIdRef.current,
    manual = false,
  } = {}) => {
    if (availabilityRefreshPromptOpenRef.current || availabilityRefreshInFlightRef.current) return false;
    if (dirtyAvailabilityDosenIdsRef.current.length > 0) {
      availabilityRefreshPromptOpenRef.current = true;
      const confirmation = await Swal.fire({
        title: "Perubahan belum disimpan",
        text: "Muat ulang akan membuang perubahan ketersediaan yang belum disimpan.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Muat Ulang",
        cancelButtonText: "Batal",
        confirmButtonColor: "#2f63e3",
      });
      availabilityRefreshPromptOpenRef.current = false;
      if (!confirmation.isConfirmed) return false;
    }
    const refreshed = await loadDosenPeriodAvailability(periodeId);
    if (refreshed && manual) showSuccessToast("Status dosen berhasil diperbarui.");
    return refreshed;
  }, [loadDosenPeriodAvailability]);

  const confirmAvailabilityDraftDiscard = useCallback(async () => {
    const leavingAvailability = activeTab === "master-dosen"
      && masterDosenTab === "ketersediaan-periode";
    if (!leavingAvailability || dirtyAvailabilityDosenIdsRef.current.length === 0) return true;

    const confirmation = await Swal.fire({
      title: "Perubahan belum disimpan",
      text: "Perubahan ketersediaan belum disimpan. Tetap pindah halaman dan buang perubahan?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Tetap Pindah",
      cancelButtonText: "Batal",
      confirmButtonColor: "#b5473c",
    });
    if (!confirmation.isConfirmed) return false;

    return loadDosenPeriodAvailability(selectedDosenAvailabilityPeriodIdRef.current);
  }, [activeTab, loadDosenPeriodAvailability, masterDosenTab]);

  useEffect(() => {
    if (!isSekretaris || activeTab !== "master-dosen" || masterDosenTab !== "ketersediaan-periode") return;
    lastAvailabilityAutoRefreshAtRef.current = Date.now();
    requestDosenPeriodAvailabilityRefresh();
  }, [activeTab, isSekretaris, masterDosenTab, requestDosenPeriodAvailabilityRefresh]);

  useEffect(() => {
    if (!isSekretaris || activeTab !== "master-dosen" || masterDosenTab !== "ketersediaan-periode") return undefined;
    const refreshWhenActive = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastAvailabilityAutoRefreshAtRef.current < 1000) return;
      lastAvailabilityAutoRefreshAtRef.current = now;
      requestDosenPeriodAvailabilityRefresh();
    };
    document.addEventListener("visibilitychange", refreshWhenActive);
    window.addEventListener("focus", refreshWhenActive);
    return () => {
      document.removeEventListener("visibilitychange", refreshWhenActive);
      window.removeEventListener("focus", refreshWhenActive);
    };
  }, [activeTab, isSekretaris, masterDosenTab, requestDosenPeriodAvailabilityRefresh]);

  const updateDosenAvailabilityDraft = (dosenId, changes) => {
    setDosenPeriodAvailability((prev) => ({
      ...prev,
      dosens: prev.dosens.map((row) => Number(row.id) === Number(dosenId) ? { ...row, ...changes } : row),
    }));
    setDirtyAvailabilityDosenIds((previous) => {
      const next = previous.some((id) => Number(id) === Number(dosenId))
        ? previous
        : [...previous, Number(dosenId)];
      dirtyAvailabilityDosenIdsRef.current = next;
      return next;
    });
  };

  const handleSaveDosenAvailabilityChanges = async () => {
    const periodeId = Number(dosenPeriodAvailability.periode?.id);
    const dirtyIds = new Set(dirtyAvailabilityDosenIds.map(Number));
    const rows = dosenPeriodAvailability.dosens.filter(
      (row) => dirtyIds.has(Number(row.id)) && row.can_edit === true && !dosenPeriodAvailability.is_readonly
    );
    if (!periodeId || rows.length === 0) return;
    setSavingBulkAvailability(true);
    try {
      await fetchWithAuth("/api/sekretaris/master-dosen/ketersediaan", {
        method: "PUT",
        body: JSON.stringify({
          periode_penjaluran_id: periodeId,
          rows: rows.map((row) => ({
            dosen_id: row.id,
            tersedia_membimbing: Boolean(row.tersedia_membimbing),
          })),
        }),
      });
      await Promise.all([
        loadDosenPeriodAvailability(periodeId),
        loadPeriodeOverview(),
      ]);
      showSuccessToast(`Perubahan ketersediaan ${rows.length} dosen berhasil disimpan.`);
    } catch (availabilityError) {
      showErrorToast(availabilityError.message || "Gagal menyimpan ketersediaan dosen.");
    } finally {
      setSavingBulkAvailability(false);
    }
  };

  const getSelectedAvailabilityRows = () => {
    const selectedIds = new Set(selectedAvailabilityDosenIds.map(Number));
    return dosenPeriodAvailability.dosens.filter(
      (row) => selectedIds.has(Number(row.id)) && row.can_edit === true && !dosenPeriodAvailability.is_readonly
    );
  };

  const toggleAvailabilitySelection = (dosenId) => {
    const parsedId = Number(dosenId);
    setSelectedAvailabilityDosenIds((previous) => previous.some((id) => Number(id) === parsedId)
      ? previous.filter((id) => Number(id) !== parsedId)
      : [...previous, parsedId]);
  };

  const selectAllEditableAvailability = () => {
    const ids = dosenPeriodAvailability.dosens
      .filter((row) => row.can_edit === true)
      .map((row) => Number(row.id));
    setSelectedAvailabilityDosenIds(ids);
    if (ids.length === 0) showErrorToast("Tidak ada dosen aktif yang dapat dipilih.");
  };

  const applyAvailabilityDraftToSelected = (selectedRows, tersediaMembimbing) => {
    const selectedIds = new Set(selectedRows.map((row) => Number(row.id)));
    setDosenPeriodAvailability((previous) => ({
      ...previous,
      dosens: previous.dosens.map((row) => selectedIds.has(Number(row.id))
        ? {
            ...row,
            tersedia_membimbing: tersediaMembimbing,
            configuration_status: "ready",
          }
        : row),
    }));
    setDirtyAvailabilityDosenIds((previous) => {
      const next = [...new Set([...previous.map(Number), ...selectedIds])];
      dirtyAvailabilityDosenIdsRef.current = next;
      return next;
    });
    setSelectedAvailabilityDosenIds([]);
  };

  const handleMarkSelectedReceiving = async () => {
    const selectedRows = getSelectedAvailabilityRows();
    if (selectedRows.length === 0) {
      showErrorToast("Pilih minimal satu dosen terlebih dahulu.");
      return;
    }
    const confirmation = await Swal.fire({
      title: `Tandai ${selectedRows.length} dosen menerima bimbingan baru?`,
      text: "Perubahan akan diterapkan ke grid dan disimpan ketika tombol Simpan Perubahan ditekan.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Tandai Menerima",
      cancelButtonText: "Batal",
      confirmButtonColor: "#117246",
    });
    if (!confirmation.isConfirmed) return;
    applyAvailabilityDraftToSelected(selectedRows, true);
  };

  const handleMarkSelectedNotInvolved = async () => {
    const selectedRows = getSelectedAvailabilityRows();
    if (selectedRows.length === 0) {
      showErrorToast("Pilih minimal satu dosen terlebih dahulu.");
      return;
    }
    const result = await Swal.fire({
      title: `Tandai ${selectedRows.length} dosen tidak menerima bimbingan baru?`,
      text: "Perubahan akan diterapkan ke grid dan disimpan ketika tombol Simpan Perubahan ditekan.",
      showCancelButton: true,
      confirmButtonText: "Terapkan",
      cancelButtonText: "Batal",
      confirmButtonColor: "#b45309",
    });
    if (!result.isConfirmed) return;
    applyAvailabilityDraftToSelected(selectedRows, false);
  };

  const loadDosenStatusFollowUpPage = async (row, options = {}) => {
    if (!row?.id) return null;
    setLoadingDosenStatusFollowUpDetail(true);
    setDosenStatusFollowUpFormErrors({});
    try {
      const context = await fetchWithAuth(`/api/sekretaris/master-dosen/tindak-lanjut-status/${row.id}/current-impact`);
      const today = getJakartaDateInputValue();
      setDosenStatusFollowUpDetailRow(row);
      setDosenStatusFollowUpDetail(context);
      setDosenStatusFollowUpForms((previous) => {
        const next = options.resetForms ? {} : { ...previous };
        (context?.affected_mahasiswa || []).forEach((mahasiswa) => {
          next[mahasiswa.id] = {
            primary_id: "",
            secondary_id: "",
            tanggal_mulai: today,
            catatan: "",
            ...(next[mahasiswa.id] || {}),
          };
        });
        return next;
      });
      if (options.resetForms) {
        setDosenStatusFollowUpResolutionForm({ note: "" });
      }
      return context;
    } catch (error) {
      showErrorToast(error.message || "Gagal memuat detail tindak lanjut.");
      if (options.resetForms) setDosenStatusFollowUpDetailRow(null);
      return null;
    } finally {
      setLoadingDosenStatusFollowUpDetail(false);
    }
  };

  const handleOpenDosenStatusFollowUpPage = async (row) => {
    setDosenStatusFollowUpDetailRow(row);
    setDosenStatusFollowUpDetail(null);
    await loadDosenStatusFollowUpPage(row, { resetForms: true });
  };

  const handleBackFromDosenStatusFollowUpPage = () => {
    setDosenStatusFollowUpDetailRow(null);
    setDosenStatusFollowUpDetail(null);
    setDosenStatusFollowUpForms({});
    setDosenStatusFollowUpResolutionForm({ note: "" });
    setDosenStatusFollowUpFormErrors({});
  };

  const updateDosenStatusFollowUpStudentForm = (mahasiswaId, field, value) => {
    setDosenStatusFollowUpForms((previous) => ({
      ...previous,
      [mahasiswaId]: { ...(previous[mahasiswaId] || {}), [field]: value },
    }));
    setDosenStatusFollowUpFormErrors((previous) => {
      const next = { ...previous };
      delete next[`${mahasiswaId}.${field}`];
      delete next.general;
      return next;
    });
  };

  const handleActivateInlineReplacement = async (mahasiswa) => {
    const form = dosenStatusFollowUpForms[mahasiswa.id] || {};
    const primaryId = Number(form.primary_id || 0);
    const secondaryId = Number(form.secondary_id || 0);
    const errors = {};
    if (!primaryId) errors[`${mahasiswa.id}.primary_id`] = "Pembimbing 1 wajib dipilih.";
    if (secondaryId && secondaryId === primaryId) errors[`${mahasiswa.id}.secondary_id`] = "Pembimbing 1 dan 2 tidak boleh sama.";
    if (!form.tanggal_mulai) errors[`${mahasiswa.id}.tanggal_mulai`] = "Tanggal efektif wajib diisi.";
    if (form.tanggal_mulai && form.tanggal_mulai > getJakartaDateInputValue()) errors[`${mahasiswa.id}.tanggal_mulai`] = "Tanggal efektif tidak boleh menggunakan tanggal mendatang.";
    if (Object.keys(errors).length > 0) {
      setDosenStatusFollowUpFormErrors((previous) => ({ ...previous, ...errors }));
      return;
    }
    const activePeriod = dosenStatusFollowUpDetail?.replacement_context?.active_period;
    if (!activePeriod?.id) {
      showErrorToast("Belum ada periode aktif untuk memvalidasi pembimbing pengganti.");
      return;
    }
    setSavingDosenStatusFollowUpAction(`activate-${mahasiswa.id}`);
    try {
      const result = await fetchWithAuth(`/api/sekretaris/master-dosen/tindak-lanjut-status/${dosenStatusFollowUpDetailRow.id}/mahasiswa/${mahasiswa.id}/replacement`, {
        method: "POST",
        body: JSON.stringify({
          dosen_pembimbing_ids: [primaryId, secondaryId].filter(Boolean),
          periode_penjaluran_id: activePeriod.id,
          tanggal_mulai: form.tanggal_mulai,
          catatan: String(form.catatan || "").trim() || null,
        }),
      });
      if (result?.follow_up_resolved) {
        setDosenStatusFollowUps((previous) => previous.filter(
          (item) => item.id !== dosenStatusFollowUpDetailRow.id
        ));
        handleBackFromDosenStatusFollowUpPage();
        showSuccessToast("Pembimbing pengganti aktif dan tindak lanjut telah selesai.");
        return;
      }
      await loadDosenStatusFollowUpPage(dosenStatusFollowUpDetailRow);
      showSuccessToast("Pembimbing pengganti berhasil diaktifkan.");
    } catch (error) {
      showErrorToast(error.message || "Gagal mengaktifkan pembimbing pengganti.");
    } finally {
      setSavingDosenStatusFollowUpAction("");
    }
  };

  const handleResolveInlineDosenStatusFollowUp = async () => {
    const note = String(dosenStatusFollowUpResolutionForm.note || "").trim();
    setSavingDosenStatusFollowUpAction("resolve");
    try {
      await fetchWithAuth(`/api/sekretaris/master-dosen/tindak-lanjut-status/${dosenStatusFollowUpDetailRow.id}/resolve`, {
        method: "PUT",
        body: JSON.stringify({
          catatan_tindak_lanjut: note || null,
        }),
      });
      setDosenStatusFollowUps((previous) => previous.filter((item) => item.id !== dosenStatusFollowUpDetailRow.id));
      handleBackFromDosenStatusFollowUpPage();
      showSuccessToast("Tindak lanjut status dosen berhasil diselesaikan.");
    } catch (error) {
      showErrorToast(error.message || "Gagal menyelesaikan tindak lanjut.");
    } finally {
      setSavingDosenStatusFollowUpAction("");
    }
  };

  const handleSaveMasterDosenKuota = async () => {
    const parsedKuota = Number(masterDosenKuotaValue);
    if (!/^\d{1,2}$/.test(String(masterDosenKuotaValue || "")) || !Number.isInteger(parsedKuota) || parsedKuota < 1 || parsedKuota > 99) {
      showErrorToast("Kuota bimbingan wajib angka bulat 1-99.");
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
        const minimalKuota = Math.max(1, terpakai);
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
        `Kuota ${parsedKuota} tidak valid. Contoh: ${contoh.nama} minimal ${contoh.minimalKuota} karena sudah terpakai ${contoh.terpakai}.`
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

    if (!String(periodeForm.label_periode || "").trim()) {
      fieldErrors.label_periode = "Label periode wajib diisi.";
    }

    PERIODE_MASTER_REQUIRED_FIELDS.forEach((item) => {
      if (!periodeMasterForm[item.key]) {
        masterErrors[item.key] = `${item.label} belum diatur di master data.`;
      }
    });

    if (!tahunAkademik) {
      fieldErrors.tahun_akademik = "Tahun akademik wajib diisi.";
    } else {
      const tahunAkademikError = getAcademicYearError(tahunAkademik);
      if (tahunAkademikError) {
        fieldErrors.tahun_akademik = tahunAkademikError;
      }
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

    setSavingPeriode(true);
    try {
      const template = await fetchWithAuth("/api/sekretaris/periode/setup-template");
      setPeriodeSetup({
        step: "availability",
        dosens: Array.isArray(template?.dosens) ? template.dosens : [],
        preview: null,
        previous_period: template?.previous_period || null,
      });
      setSelectedAvailabilityDosenIds([]);
    } catch (openError) {
      if (openError?.message !== "__SESSION_EXPIRED__") {
        showErrorToast(openError.message || "Gagal memuat template ketersediaan.");
      }
    } finally {
      setSavingPeriode(false);
    }
  };

  const handleStartPeriodeSetup = async () => {
    setSavingPeriode(true);
    try {
      const template = await fetchWithAuth("/api/sekretaris/periode/setup-template");
      const suggested = template?.suggested_period || {};
      setPeriodeForm((previous) => ({
        ...previous,
        tahun_akademik: previous.tahun_akademik || suggested.tahun_akademik || "",
        semester: previous.semester || suggested.semester || "ganjil",
        label_periode: previous.label_periode || suggested.label_periode || "",
      }));
      if (template?.penanggung_jawab) {
        setPeriodeMasterForm((previous) => ({ ...previous, ...template.penanggung_jawab }));
      }
      setPeriodeSetup((previous) => ({
        ...previous,
        step: "periode",
        previous_period: template?.previous_period || null,
      }));
      setPeriodeMode("open");
      setEditingPeriode(null);
      setPeriodeReadonlyRoles({ loading: false, rows: [], error: "" });
      setPeriodeFormErrors({});
      setPeriodeMasterErrors({});
    } catch (error) {
      showErrorToast(error.message || "Gagal menyiapkan periode berikutnya.");
    } finally {
      setSavingPeriode(false);
    }
  };

  const buildPeriodeSetupPayload = () => ({
    periode: {
      ...periodeForm,
      label_periode: periodeForm.label_periode
        || `${formatLabel(periodeForm.semester)} ${periodeForm.tahun_akademik}`,
    },
    penanggung_jawab: {
      ...periodeMasterForm,
      pengampu_pengabdian_dosen_id: Number(periodeMasterForm.pengawas_pengabdian_dosen_id),
      pengampu_perintisan_bisnis_dosen_id: Number(periodeMasterForm.pengawas_perintisan_bisnis_dosen_id),
    },
    ketersediaan_dosen: periodeSetup.dosens.map((row) => ({
      dosen_id: Number(row.id),
      tersedia_membimbing: Boolean(row.tersedia_membimbing),
      configuration_status: row.configuration_status === "copied" ? "ready" : row.configuration_status,
    })),
  });

  const updatePeriodeSetupDosen = (dosenId, changes) => {
    setPeriodeSetup((previous) => ({
      ...previous,
      preview: null,
      dosens: previous.dosens.map((row) => Number(row.id) === Number(dosenId)
        ? { ...row, ...changes }
        : row),
    }));
  };

  const handlePreviewPeriodeSetup = async () => {
    const needsReview = periodeSetup.dosens.filter((row) => row.configuration_status === "needs_review");
    if (needsReview.length > 0) {
      showErrorToast(`${needsReview.length} dosen masih perlu ditinjau.`);
      return;
    }
    setSavingPeriode(true);
    try {
      const preview = await fetchWithAuth("/api/sekretaris/periode/preview", {
        method: "POST",
        body: JSON.stringify(buildPeriodeSetupPayload()),
      });
      setPeriodeSetup((previous) => ({ ...previous, step: "preview", preview }));
    } catch (previewError) {
      showErrorToast(previewError.message || "Preview pembukaan periode gagal dibuat.");
    } finally {
      setSavingPeriode(false);
    }
  };

  const handleOpenPeriodeFromPreview = async () => {
    const confirmation = await Swal.fire({
      title: "Buka pendaftaran sekarang?",
      text: "Periode akan langsung aktif dan dapat digunakan mahasiswa.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Buka Pendaftaran",
      cancelButtonText: "Batal",
      confirmButtonColor: "#117246",
    });
    if (!confirmation.isConfirmed) return;
    setSavingPeriode(true);
    try {
      await fetchWithAuth("/api/sekretaris/periode/open", {
        method: "POST",
        body: JSON.stringify(buildPeriodeSetupPayload()),
      });
      window.localStorage.removeItem(PERIODE_SETUP_STORAGE_KEY);
      setPeriodeSetup((previous) => ({ ...previous, step: "opened" }));
      showSuccessToast("Pendaftaran periode berhasil dibuka.");
      await loadAllData();
    } catch (openError) {
      showErrorToast(openError.message || "Gagal membuka pendaftaran.");
    } finally {
      setSavingPeriode(false);
    }
  };

  const handleCancelPeriodeSetup = async () => {
    if (periodeSetup.step !== "periode" || periodeSetup.dosens.length > 0) {
      const result = await Swal.fire({
        title: "Batalkan persiapan periode?",
        text: "Seluruh data persiapan yang tersimpan di browser akan dihapus.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Ya, batalkan",
        cancelButtonText: "Kembali",
        confirmButtonColor: "#b83a3a",
      });
      if (!result.isConfirmed) return;
    }
    window.localStorage.removeItem(PERIODE_SETUP_STORAGE_KEY);
    setPeriodeForm({ ...PERIODE_FORM_INITIAL });
    setPeriodeSetup({ step: "periode", dosens: [], preview: null, previous_period: null });
    setSelectedAvailabilityDosenIds([]);
    setPeriodeMode("list");
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
                <p className="text-sm font-semibold text-[#2a4175]">Program</p>
                <button
                  type="button"
                  onClick={() => setMahasiswaMasterFilterDraft((prev) => ({ ...prev, program_kuliah: "" }))}
                  className="text-xs font-semibold text-[#2f63e3] hover:underline"
                >
                  Reset
                </button>
              </div>
              <select
                value={mahasiswaMasterFilterDraft.program_kuliah}
                onChange={(event) =>
                  setMahasiswaMasterFilterDraft((prev) => ({
                    ...prev,
                    program_kuliah: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-[#d3dbef] px-3 py-2 text-sm text-[#23396b] outline-none focus:border-[#2f63e3]"
              >
                <option value="">Semua program</option>
                {mahasiswaMasterFilterOptions.program_kuliah.map((item) => (
                  <option key={`filter-program-kuliah-${item}`} value={item}>
                    {formatLabel(item)}
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
                  <span className="absolute right-0.5 top-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-black text-white">
                    {unreadSubmissionNotificationCount > 99 ? "99+" : unreadSubmissionNotificationCount}
                  </span>
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
                            {Number(item?.reminder_count || 0) > 0 ? (
                              <p className="mt-1 text-[11px] font-semibold text-[#a06a00]">
                                Pengingat ke-{item.reminder_count}
                                {item.last_reminded_at
                                  ? ` dikirim ${formatDateTime(item.last_reminded_at)}`
                                  : ""}
                              </p>
                            ) : null}
                            {item?.review_eligible === false ? (
                              <p className="mt-1 text-[11px] font-semibold text-[#b36a16]">
                                Keputusan dinonaktifkan: {item.review_block_reason || "dosen sedang tidak tersedia"}
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
                                       <button
              type="button"
              onClick={onOpenProfile}
              title="Edit profil"
              className="flex items-center gap-2 rounded-lg px-2 py-1 text-right transition hover:bg-white/15"
            >
              <UserCircle2 className="h-7 w-7 text-[#dde7ff]" />
              <span>
                <span className="block text-sm font-bold">{session.user?.nama}</span>
                <span className="block text-xs text-[#d4e1ff]">{session.user?.username}</span>
              </span>
            </button>
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
                          onClick={async () => {
                            if (item.id === activeTab || await confirmAvailabilityDraftDiscard()) {
                              setActiveTab(item.id);
                            }
                          }}
                          className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition ${
                            isActive ? "bg-[#2f63e3] text-white" : "text-[#405070] hover:bg-[#f2f6ff]"
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                          <span>{item.label}</span>
                          {item.id === "notifications" ? (
                            <NotificationMenuBadge count={notificationState.unreadCount} active={isActive} />
                          ) : null}
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
                      <span className="font-bold">Dosen:</span> {formatDosenFullName(kuotaData?.dosen?.nama, kuotaData?.dosen?.gelar) || "-"}
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

            {!loading && activeTab === "notifications" ? (
              <NotificationPage
                notificationState={notificationState}
                onNavigate={(notification) => {
                  if (["lecturer_supervised_student", "lecturer_supervision_history"].includes(notification?.action_key)) {
                    setActiveTab("monitoring-mahasiswa");
                  } else if (notification?.action_key === "defense_document_review") {
                    setActiveTab("dokumen-sidang-review");
                  }
                }}
              />
            ) : null}

            {!loading && activeTab === "monitoring-mahasiswa" ? (
              monitoringMahasiswaMode === "detail" ? (
                <div className="space-y-4">
                  <section className="rounded-xl border border-[#e4e9f6] bg-white p-3 shadow-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleBackToMonitoringList}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#d3dbef] text-[#2b3f74] hover:bg-[#f3f7ff]"
                        title="Kembali ke grid mahasiswa bimbingan"
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenMonitoringDetail(selectedMonitoringMahasiswa)}
                        disabled={loadingMonitoringDetail}
                        className="inline-flex items-center gap-2 rounded-lg border border-[#d3dbef] px-3 py-2 text-sm font-semibold text-[#27407b] hover:bg-[#f3f6ff] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <RefreshCcw className="h-4 w-4" />
                        Refresh
                      </button>
                    </div>
                  </section>

                  <section className="rounded-xl border border-[#e4e9f6] bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-black text-[#1b274b]">Progress Bimbingan</h3>
                        <p className="mt-1 text-sm text-[#5d6c91]">
                          Progress sesi bimbingan tervalidasi untuk {selectedMonitoringMahasiswa?.mahasiswa?.nama || "mahasiswa"}.
                        </p>
                      </div>
                      <span className="text-2xl font-black text-[#2454b8]">
                        {selectedMonitoringMahasiswa?.bimbingan?.progress_percent || 0}%
                      </span>
                    </div>
                    <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#e8edf8]">
                      <div
                        className="h-full rounded-full bg-[#2f63e3] transition-[width]"
                        style={{ width: `${selectedMonitoringMahasiswa?.bimbingan?.progress_percent || 0}%` }}
                      />
                    </div>
                    <div className="mt-4 grid grid-cols-1 gap-4 border-t border-[#edf1f8] pt-4 sm:grid-cols-3">
                      <div>
                        <p className="text-xs font-bold uppercase text-[#68779e]">Sesi Tervalidasi</p>
                        <p className="mt-1 text-base font-black text-[#1f2d53]">
                          {selectedMonitoringMahasiswa?.bimbingan?.tervalidasi || 0}/{selectedMonitoringMahasiswa?.bimbingan?.target || 8} sesi
                        </p>
                        {selectedMonitoringMahasiswa?.bimbingan?.is_stale ? <p className="mt-1 text-xs font-bold text-[#9a6900]">Sedang dihitung ulang</p> : null}
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase text-[#68779e]">Dokumen Sidang</p>
                        <p className="mt-1 text-base font-black text-[#1f2d53]">
                          {selectedMonitoringMahasiswa?.dokumen?.approved || 0}/{selectedMonitoringMahasiswa?.dokumen?.target || 3} disetujui
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase text-[#68779e]">Tahap Saat Ini</p>
                        <p className="mt-1 text-base font-black text-[#1f2d53]">
                          {selectedMonitoringMahasiswa?.tahap || "-"}
                        </p>
                      </div>
                    </div>
                  </section>

                  {loadingMonitoringDetail ? (
                    <section className="rounded-xl border border-[#e4e9f6] bg-white p-8 text-center text-sm font-semibold text-[#60709a] shadow-sm">
                      Memuat detail pengajuan mahasiswa...
                    </section>
                  ) : null}

                  {!loadingMonitoringDetail && monitoringDetailError ? (
                    <section className="rounded-xl border border-[#efb5b5] bg-[#fff6f6] p-4 text-sm font-semibold text-[#a93636] shadow-sm">
                      {monitoringDetailError}
                    </section>
                  ) : null}

                  {!loadingMonitoringDetail && monitoringSubmissionDetail ? (
                    <>
                      <section className="rounded-xl border border-[#e4e9f6] bg-white p-5 shadow-sm">
                        <div className="mb-4">
                          <h3 className="text-lg font-black text-[#1b274b]">Detail Pengajuan</h3>
                          <p className="mt-1 text-sm text-[#5d6c91]">
                            Informasi penjaluran dan form yang diajukan mahasiswa.
                          </p>
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                          <ResearchReviewReadonlyInput
                            label="Mahasiswa"
                            value={selectedMonitoringMahasiswa?.mahasiswa?.nama || "-"}
                          />
                          <ResearchReviewReadonlyInput
                            label="NIM"
                            value={selectedMonitoringMahasiswa?.mahasiswa?.nim || "-"}
                          />
                          <ResearchReviewReadonlyInput
                            label="Jalur"
                            value={formatLabel(selectedMonitoringMahasiswa?.penjaluran || selectedMonitoringMahasiswa?.jalur || "-")}
                          />
                          <ResearchReviewReadonlyInput
                            label="Pendaftaran"
                            value={formatLabel(selectedMonitoringMahasiswa?.jalur || "-")}
                          />
                          <ResearchReviewReadonlyInput label="Judul / Pengajuan" value={monitoringSubmissionTitle} />
                          <ResearchReviewReadonlyInput
                            label="Status"
                            value={formatLabel(selectedMonitoringMahasiswa?.status_pengajuan || monitoringSubmissionDetail?.status || monitoringSubmissionDetail?.workflow_status || "approved")}
                          />
                        </div>

                        <div className="mt-6 border-t border-[#e8edf7] pt-5">
                          {isMonitoringResearchDetail ? (
                            <ResearchReviewDetailForm
                              detail={monitoringSubmissionDetail}
                              topikRows={monitoringResearchTopicRows}
                            />
                          ) : monitoringDetailJalur === "magang" ? (
                            <MagangReadonlyDetailForm detail={monitoringSubmissionDetail} />
                          ) : (
                            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
                              {getPengampuReviewDetailFields(
                                monitoringSubmissionDetail,
                                DOSEN_PENGAMPU_REVIEW_TABS[monitoringDetailJalur] ||
                                  DOSEN_PENGAMPU_REVIEW_TABS.perintisan_bisnis
                              ).map(([label, value]) => (
                                <div key={`monitoring-detail-${label}`} className="border-b border-[#e8edf7] px-1 py-3">
                                  <p className="text-xs font-black uppercase text-[#64749d]">{label}</p>
                                  <p className="mt-1 break-words text-sm font-semibold text-[#203665]">
                                    {formatMagangPayloadValue(value)}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </section>

                      {isMonitoringResearchDetail ? (
                        <section className="rounded-xl border border-[#e4e9f6] bg-white p-5 shadow-sm">
                          <SubmissionDecisionDetailSection
                            items={monitoringSubmissionDetail?.riwayat_persetujuan || []}
                          />
                        </section>
                      ) : (
                        <FinalDecisionDetailSection detail={monitoringSubmissionDetail} />
                      )}
                    </>
                  ) : null}
                </div>
              ) : (
              <div className="flex min-h-0 flex-1 flex-col gap-4">
                <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {[
                    {
                      label: "Mahasiswa Bimbingan",
                      value: monitoringMahasiswa.summary?.total || 0,
                      tone: "border-[#d7e3ff] text-[#2454b8]",
                    },
                    {
                      label: "Perlu Tindakan",
                      value: monitoringMahasiswa.summary?.perlu_tindakan || 0,
                      tone: "border-[#f2ddb0] text-[#8a5d00]",
                    },
                    {
                      label: "Tahap Sidang",
                      value: monitoringMahasiswa.summary?.siap_sidang || 0,
                      tone: "border-[#cfe9dc] text-[#167347]",
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className={`rounded-lg border bg-white px-4 py-3 shadow-sm ${item.tone}`}
                    >
                      <p className="text-sm font-semibold text-[#5d6c91]">{item.label}</p>
                      <p className="mt-1 text-2xl font-black">{item.value}</p>
                    </div>
                  ))}
                </section>

                <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-black text-[#1b274b]">Progress Mahasiswa Bimbingan</h3>
                      <p className="mt-1 text-sm text-[#5d6c91]">
                        Progres diperbarui otomatis dari review bimbingan, dokumen, dan pendaftaran sidang.
                      </p>
                    </div>
                    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                      <div className="relative min-w-0 flex-1 sm:w-[320px] sm:flex-none">
                        <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7282a8]" />
                        <input
                          type="text"
                          value={monitoringMahasiswaQuery}
                          onChange={(event) => setMonitoringMahasiswaQuery(event.target.value)}
                          placeholder="Cari NIM, nama, jalur, atau tahap..."
                          className="w-full rounded-lg border border-[#d3dbef] py-2 pl-8 pr-3 text-sm outline-none focus:border-[#2f63e3]"
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

                  <div className="relative min-h-0 flex-1 overflow-auto rounded-lg border border-[#e6ecf8] grid-unified-height">
                    <table className="w-full min-w-[1350px] text-left text-sm">
                      <thead className="sticky top-0 z-10">
                        <tr className="border-b border-[#e6ecf8] text-[#4d5e89]">
                          <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Mahasiswa</th>
                          <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Penjaluran</th>
                          <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Progress Bimbingan</th>
                          <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Dokumen Sidang</th>
                          <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Tahap Saat Ini</th>
                          <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Aktivitas Terakhir</th>
                          <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredMonitoringMahasiswaRows.map((row) => (
                          <tr key={`monitoring-${row.mahasiswa?.id}`} className="border-b border-[#eff3fb]">
                            <td className="px-3 py-3">
                              <p className="font-bold text-[#1f2d53]">{row.mahasiswa?.nama || "-"}</p>
                              <p className="mt-0.5 text-xs text-[#61709b]">
                                {row.mahasiswa?.nim || "-"} | Angkatan {row.mahasiswa?.angkatan || "-"}
                              </p>
                            </td>
                            <td className="px-3 py-3">
                              <p className="font-semibold text-[#2f426f]">
                                {row.penjaluran ? formatLabel(row.penjaluran) : "-"}
                              </p>
                              <p className="mt-0.5 text-xs text-[#69779d]">
                                {row.jalur ? formatLabel(row.jalur) : "-"}
                              </p>
                            </td>
                            <td className="px-3 py-3">
                              <div className="w-[220px]">
                                <div className="mb-1 flex items-center justify-between text-xs font-semibold text-[#405070]">
                                  <span>
                                    {row.bimbingan?.tervalidasi || 0}/{row.bimbingan?.target || 8} sesi
                                  </span>
                                  <span>{row.bimbingan?.progress_percent || 0}%</span>
                                </div>
                                <div className="h-2 overflow-hidden rounded-full bg-[#e8edf8]">
                                  <div
                                    className="h-full rounded-full bg-[#2f63e3]"
                                    style={{ width: `${row.bimbingan?.progress_percent || 0}%` }}
                                  />
                                </div>
                                {row.bimbingan?.pending_permohonan || row.bimbingan?.pending_resume ? (
                                  <p className="mt-1 text-xs font-semibold text-[#9a6900]">
                                    Ada review yang perlu ditindaklanjuti
                                  </p>
                                ) : null}
                                {row.bimbingan?.is_stale ? <p className="mt-1 text-xs font-bold text-[#9a6900]">Sedang dihitung ulang</p> : null}
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <p className="font-bold text-[#2f426f]">
                                {row.dokumen?.approved || 0}/{row.dokumen?.target || 3} disetujui
                              </p>
                              <p className="mt-0.5 text-xs text-[#69779d]">
                                {row.dokumen?.submitted || 0} menunggu review
                                {row.dokumen?.revisi ? ` | ${row.dokumen.revisi} revisi` : ""}
                              </p>
                            </td>
                            <td className="px-3 py-3">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${
                                  row.perlu_tindakan
                                    ? "bg-[#fff2cf] text-[#8b6200]"
                                    : row.tahap === "Sidang Dijadwalkan"
                                      ? "bg-[#dff3e8] text-[#167347]"
                                      : "bg-[#e8efff] text-[#2454b8]"
                                }`}
                              >
                                {row.tahap || "-"}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-[#43537d]">
                              {formatDateTime(row.aktivitas_terakhir)}
                            </td>
                            <td className="px-3 py-3">
                              <button
                                type="button"
                                onClick={() => handleOpenMonitoringDetail(row)}
                                className="inline-flex items-center gap-1.5 rounded-md bg-[#2f63e3] px-3 py-1.5 text-xs font-bold text-white hover:brightness-110"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                Detail
                              </button>
                            </td>
                          </tr>
                        ))}
                        {filteredMonitoringMahasiswaRows.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="h-[300px] px-4 text-center align-middle">
                              <Activity className="mx-auto h-9 w-9 text-[#9aa8c7]" />
                              <p className="mt-3 font-bold text-[#52638d]">
                                Belum ada mahasiswa bimbingan yang dapat dimonitor
                              </p>
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
              )
            ) : null}

            {!loading &&
            ((isSekretaris && activeTab === "master-mahasiswa") ||
              activeTab === "mahasiswa-bimbingan" ||
              activeTab === "mahasiswa-dpa") ? (
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
                          ? "Grid Riwayat Bimbingan"
                          : activeTab === "mahasiswa-dpa"
                            ? "Grid Mahasiswa DPA"
                          : "Grid Master Data Mahasiswa"}
                      </h3>
                      <p className="text-sm text-[#5d6c91]">
                        {activeTab === "mahasiswa-bimbingan"
                          ? "Menampilkan histori penjaluran mahasiswa yang saat ini dibimbing oleh dosen yang login."
                          : activeTab === "mahasiswa-dpa"
                            ? "Menampilkan histori penjaluran mahasiswa yang memilih dosen login sebagai DPA."
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
                  <table className="w-full min-w-[3120px] text-left text-sm">
                    <thead>
                      <tr className="border-y border-[#e6ecf8] text-[#4d5e89]">
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">No</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">NIM</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Nama</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Email</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Angkatan</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Program</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Status Jalur Saat Ini</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Semester Mahasiswa</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Semester Penjaluran</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Periode Penjaluran</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Tahun Akademik</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Semester Akademik</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Jalur</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Nama Penjaluran</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Penjaluran Sebelumnya</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Penjaluran Baru</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Pembimbing TA</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Pembimbing TA Sebelumnya</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Pembimbing TA Baru</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">DPA</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Dospem Skripsi</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Status Pendaftaran</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Tanggal Penjaluran</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Updated</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Histori Pembimbing</th>
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
                              <td className="px-3 py-2">
                                {row.program_kuliah ? formatLabel(row.program_kuliah) : "-"}
                              </td>
                              <td className="px-3 py-2">{row.status_jalur_saat_ini || "-"}</td>
                              <td className="px-3 py-2">{row.semester_mahasiswa || "-"}</td>
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
                              <td className="px-3 py-2">
                                {row.penjaluran_sebelumnya ? formatLabel(row.penjaluran_sebelumnya) : "-"}
                              </td>
                              <td className="px-3 py-2">
                                {row.penjaluran_baru ? formatLabel(row.penjaluran_baru) : "-"}
                              </td>
                              <td className="px-3 py-2">{row.pembimbing_ta || "-"}</td>
                              <td className="px-3 py-2">{row.pembimbing_ta_sebelumnya || "-"}</td>
                              <td className="px-3 py-2">{row.pembimbing_ta_baru || "-"}</td>
                              <td className="px-3 py-2">{row.dosen_pembimbing_akademik || "-"}</td>
                              <td className="px-3 py-2">{row.dosen_pembimbing_skripsi || "-"}</td>
                              <td className="px-3 py-2">
                                {row.pendaftaran_status ? formatLabel(row.pendaftaran_status) : "-"}
                              </td>
                              <td className="px-3 py-2">{formatDateTime(row.tanggal_penjaluran)}</td>
                              <td className="px-3 py-2">{formatDateTime(row.updatedAt)}</td>
                              <td className="px-3 py-2">
                                <button type="button" onClick={() => loadSupervisorHistoryPanel(row)} className="whitespace-nowrap rounded-lg bg-[#2f63e3] px-3 py-1.5 text-xs font-bold text-white">Lihat Histori</button>
                              </td>
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

                  {supervisorHistoryPanel.mahasiswaId ? (
                    <div className="mt-4 rounded-xl border border-[#dbe4f6] bg-[#f8fbff] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h4 className="font-black text-[#1b274b]">Riwayat Pembimbing - {supervisorHistoryPanel.mahasiswaName}</h4>
                          <p className="text-sm text-[#5d6c91]">Penetapan aktif dan histori setiap periode.</p>
                        </div>
                        <button type="button" onClick={() => setSupervisorHistoryPanel({ mahasiswaId: null, mahasiswaName: "", loading: false, data: null, error: "" })} className="rounded-lg border border-[#d3dbef] p-2 text-[#596887]" aria-label="Tutup histori"><X className="h-4 w-4" /></button>
                      </div>
                      <SupervisorAssignmentTimeline data={supervisorHistoryPanel.data} loading={supervisorHistoryPanel.loading} error={supervisorHistoryPanel.error} compact />
                    </div>
                  ) : null}

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
            {!loading && isSekretaris && activeTab === "akademik" ? (
              <AcademicDataPanel mode="secretary" session={session} apiBaseUrl={apiBaseUrl} onSessionExpired={onSessionExpired} />
            ) : null}

            {!loading && isSekretaris && activeTab === "approval-penelitian" ? (
              <div
                className={
                  isFinalNonPenelitianDetailMode
                    ? "flex min-h-0 flex-1 flex-col gap-4"
                    : "flex min-h-0 flex-1 flex-col rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm"
                }
              >
                <div
                  className={
                    isFinalNonPenelitianDetailMode
                      ? "rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm"
                      : "contents"
                  }
                >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black text-[#1b274b]">
                      Grid Keputusan Final
                    </h3>
                    <p className="mt-1 text-sm text-[#5d6c91]">
                      Menampilkan semua pengajuan yang sudah masuk tahap keputusan final sekretaris prodi.
                    </p>
                  </div>
                  <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                    <div className="relative min-w-0 flex-1 sm:w-[340px] sm:flex-none">
                      <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7282a8]" />
                      <input
                        value={finalResearchQuery}
                        onChange={(event) => setFinalResearchQuery(event.target.value)}
                        placeholder="Cari mahasiswa, jalur, topik, dosen, atau ringkasan..."
                        className="w-full rounded-lg border border-[#d3dbef] py-2 pl-8 pr-3 text-sm outline-none focus:border-[#2f63e3]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={loadAllData}
                      className="inline-flex items-center gap-2 rounded-lg border border-[#d3dbef] px-3 py-2 text-sm font-semibold text-[#27407b] hover:bg-[#f3f6ff] disabled:opacity-50"
                    >
                      <RefreshCcw className="h-4 w-4" />
                      Refresh
                    </button>
                  </div>
                </div>
                </div>

                {isFinalResearchDetailMode ? (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-[#e4e9f6] bg-white p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={handleBackToFinalResearchList}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#d3dbef] text-[#2b3f74] hover:bg-[#f3f7ff]"
                          title="Kembali ke grid keputusan final"
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

                    <div className="rounded-xl border border-[#e4e9f6] bg-white p-4">
                      <h3 className="text-lg font-black text-[#1b274b]">Review Final Penelitian</h3>
                      <p className="mt-1 text-sm text-[#5d6c91]">
                        Tinjau topik yang telah disetujui Ketua Cluster. Tolak berlaku untuk topik aktif, sedangkan approve menetapkannya sebagai topik final.
                      </p>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {finalResearchApprovedTopics.map((topik) => {
                          const slot = getFinalResearchTopicKey(topik);
                          const active = slot === getFinalResearchTopicKey(finalResearchFocusedTopic);
                          const viewed = finalResearchViewedSlots.includes(slot);
                          return (
                            <button
                              key={`final-research-topic-${topik.slot}-${topik.kode || "none"}`}
                              type="button"
                              onClick={() => handleSelectFinalResearchTopic(slot)}
                              className={`min-w-[190px] rounded-lg border px-3 py-2 text-left text-xs transition ${
                                active
                                  ? "border-[#2f63e3] bg-[#edf3ff]"
                                  : "border-[#dde5f8] bg-white hover:bg-[#f7f9ff]"
                              }`}
                            >
                              <p className="font-black text-[#27407b]">
                                {topik.slot != null ? `Pilihan ${topik.slot} - ${topik.kode || "-"}` : "Judul Mandiri"}
                              </p>
                              <p className={`mt-1 font-semibold ${viewed ? "text-[#137748]" : "text-[#6b789b]"}`}>
                                {viewed ? "Sudah dilihat" : "Belum dilihat"}
                              </p>
                            </button>
                          );
                        })}
                      </div>

                      <div className="mt-4 rounded-lg border border-[#e4e9f6] bg-white p-4">
                        <ResearchReviewDetailForm
                          detail={{ tipe_pengajuan: "topik_dosen" }}
                          topikRows={
                            finalResearchFocusedTopic
                              ? [
                                  {
                                    ...finalResearchFocusedTopic,
                                    dosen: formatDosenFullName(finalResearchFocusedTopic.dosen_nama, finalResearchFocusedTopic.dosen_gelar),
                                    reviewer_status: finalResearchFocusedTopic.status_ketua_cluster,
                                  },
                                ]
                              : []
                          }
                        />
                        {finalResearchFocusedTopic ? (
                          <div className="mt-4 rounded-lg border border-[#cfe0ff] bg-[#f4f8ff] p-3 text-sm text-[#2f426f]">
                            <p className="font-black text-[#244279]">Keputusan Ketua Cluster</p>
                            <p className="mt-1">
                              {finalResearchFocusedTopic.ketua_cluster?.nama || "Ketua Cluster"} | {finalResearchFocusedTopic.catatan_ketua_cluster || "-"}
                            </p>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="rounded-xl border border-[#e4e9f6] bg-white p-4">
                      <SubmissionDecisionDetailSection items={finalResearchDetail?.riwayat_persetujuan || []} />
                    </div>

                    <div className="rounded-xl border border-[#e4e9f6] bg-white p-4">
                      <h3 className="text-lg font-black text-[#1b274b]">Form Keputusan</h3>
                      <p className="mt-1 text-sm text-[#5d6c91]">
                        Penolakan berlaku pada topik yang sedang dibuka. Approve menetapkan topik tersebut sebagai topik final dan membatalkan proses topik lainnya.
                      </p>
                      {!hasViewedAllFinalResearchTopics ? (
                        <div className="mt-3 rounded-lg border border-[#f0d99d] bg-[#fff9e9] px-3 py-2 text-sm font-semibold text-[#8a6200]">
                          Buka seluruh pilihan topik terlebih dahulu untuk mengaktifkan keputusan final.
                        </div>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setFinalResearchDecision("reject");
                            setFinalResearchPrimarySupervisorId("");
                            setFinalResearchSecondarySupervisorId("");
                            setFinalResearchDecisionError("");
                          }}
                          className={`rounded-lg px-4 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                            finalResearchDecision === "reject"
                              ? "bg-[#b73a3a] text-white"
                              : "border border-[#e2a2a2] bg-white text-[#a33737]"
                          }`}
                        >
                          Tolak
                        </button>
                        <button
                          type="button"
                          disabled={!hasViewedAllFinalResearchTopics}
                          onClick={() => {
                            setFinalResearchDecision("approve");
                            setFinalResearchDecisionError("");
                          }}
                          className={`rounded-lg px-4 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                            finalResearchDecision === "approve"
                              ? "bg-[#137748] text-white"
                              : "border border-[#9bc9b2] bg-white text-[#137748]"
                          }`}
                        >
                          Approve
                        </button>
                      </div>
                      {finalResearchDecision ? (
                        <div className="mt-3">
                          {finalResearchDecision === "approve" ? (
                            <div className="mb-3 grid gap-3 md:grid-cols-2">
                              <div>
                                <label className="mb-1 block text-sm font-semibold text-[#344b7f]">
                                  Pembimbing 1 <span className="text-[#b73a3a]">*</span>
                                </label>
                                <ReplacementDosenCombobox
                                  inputId="final-research-primary-supervisor"
                                  candidates={finalResearchSupervisorOptions.filter(
                                    (dosen) => Number(dosen.id) !== Number(finalResearchSecondarySupervisorId || 0)
                                  )}
                                  value={finalResearchPrimarySupervisorId}
                                  onChange={(value) => {
                                    setFinalResearchPrimarySupervisorId(value);
                                    setFinalResearchDecisionError("");
                                  }}
                                  hasError={finalResearchDecisionError.startsWith("Pembimbing 1")}
                                  placeholder="Cari nama, kode, atau NIK dosen..."
                                />
                              </div>
                              <div>
                                <label className="mb-1 block text-sm font-semibold text-[#344b7f]">
                                  Pembimbing 2 <span className="font-normal text-[#7582a2]">(opsional)</span>
                                </label>
                                <ReplacementDosenCombobox
                                  inputId="final-research-secondary-supervisor"
                                  candidates={finalResearchSupervisorOptions.filter(
                                    (dosen) => Number(dosen.id) !== Number(finalResearchPrimarySupervisorId || 0)
                                  )}
                                  value={finalResearchSecondarySupervisorId}
                                  onChange={(value) => {
                                    setFinalResearchSecondarySupervisorId(value);
                                    setFinalResearchDecisionError("");
                                  }}
                                  placeholder="Cari nama, kode, atau NIK dosen..."
                                  allowEmpty
                                />
                              </div>
                              <p className="md:col-span-2 text-xs font-semibold text-[#60709a]">
                                Hanya menampilkan dosen cluster {finalResearchClusterCode || "topik terpilih"} yang menerima bimbingan baru dan masih memiliki kuota.
                              </p>
                            </div>
                          ) : null}
                          <label className="mb-1 block text-sm font-semibold text-[#344b7f]">
                            {finalResearchDecision === "approve" ? "Catatan keputusan" : "Alasan penolakan"}
                            <span className="ml-1 text-[#b73a3a]">*</span>
                          </label>
                          <textarea
                            rows={4}
                            value={finalResearchDecisionNote}
                            onChange={(event) => {
                              setFinalResearchDecisionNote(event.target.value);
                              setFinalResearchDecisionError("");
                            }}
                            className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[#2f63e3] ${
                              finalResearchDecisionError ? "border-[#d33b3b] bg-[#fffafa]" : "border-[#d3dbef]"
                            }`}
                          />
                          {finalResearchDecisionError ? (
                            <p className="mt-1 text-xs font-semibold text-[#b73a3a]">{finalResearchDecisionError}</p>
                          ) : null}
                          <div className="mt-4 flex justify-end">
                            <button
                              type="button"
                              disabled={Number(finalResearchActionId) === Number(finalResearchDetail?.id)}
                              onClick={handleSubmitFinalResearchDecision}
                              className={`rounded-lg px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60 ${
                                finalResearchDecision === "reject" ? "bg-[#b73a3a]" : "bg-[#137748]"
                              }`}
                            >
                              {Number(finalResearchActionId) === Number(finalResearchDetail?.id)
                                ? "Memproses..."
                                : finalResearchDecision === "reject"
                                ? "Tolak"
                                : "Approve"}
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : finalNonPenelitianMode === "review" ? (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-[#e4e9f6] bg-white p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={handleBackToFinalNonPenelitianList}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#d3dbef] text-[#2b3f74] hover:bg-[#f3f7ff]"
                          title="Kembali ke grid keputusan final"
                        >
                          <ArrowLeft className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={handleRefreshFinalNonPenelitianDetail}
                          disabled={loadingFinalNonPenelitianDetail}
                          className="inline-flex items-center gap-2 rounded-lg border border-[#d3dbef] px-3 py-2 text-sm font-semibold text-[#27407b] hover:bg-[#f3f6ff] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <RefreshCcw className="h-4 w-4" />
                          Refresh
                        </button>
                      </div>
                    </div>

                    <div className="rounded-xl border border-[#e4e9f6] bg-white p-4">
                      <h3 className="text-lg font-black text-[#1b274b]">
                        Review Final {formatLabel(finalNonPenelitianDetail?.jalur || "Pengajuan")}
                      </h3>
                      <p className="text-sm text-[#5d6c91]">
                        Tinjau detail pengajuan sebelum menetapkan keputusan final sekretaris prodi.
                      </p>

                      {loadingFinalNonPenelitianDetail ? (
                        <div className="mt-4 rounded-lg border border-[#e2e9f8] bg-[#f8fbff] p-6 text-center text-sm font-semibold text-[#60709a]">
                          Memuat detail keputusan final...
                        </div>
                      ) : null}

                      {!loadingFinalNonPenelitianDetail && finalNonPenelitianDetail ? (
                        <div className="mt-4">
                          {String(finalNonPenelitianDetail.jalur || "").toLowerCase() === "magang" ? (
                            <MagangReadonlyDetailForm
                              detail={finalNonPenelitianDetail}
                              onOpenDocument={handleOpenSekprodiNonPenelitianDocument}
                            />
                          ) : String(finalNonPenelitianDetail.jalur || "").toLowerCase() === "perintisan_bisnis" ? (
                            <PerintisanReadonlyDetailForm
                              detail={finalNonPenelitianDetail}
                              onOpenDocument={handleOpenSekprodiNonPenelitianDocument}
                            />
                          ) : (
                            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
                              {getPengampuReviewDetailFields(
                                finalNonPenelitianDetail,
                                DOSEN_PENGAMPU_REVIEW_TABS[finalNonPenelitianDetail.jalur] ||
                                  DOSEN_PENGAMPU_REVIEW_TABS.perintisan_bisnis
                              ).map(([label, value]) => (
                                <div key={`sekprodi-final-field-${label}`} className="rounded-lg border border-[#e2e9f8] bg-[#f8fbff] p-3">
                                  <p className="text-xs font-black uppercase text-[#64749d]">{label}</p>
                                  <p className="mt-1 break-words text-sm font-semibold text-[#203665]">
                                    {formatMagangPayloadValue(value)}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>

                    {!loadingFinalNonPenelitianDetail &&
                    finalNonPenelitianDetail &&
                    String(finalNonPenelitianDetail.jalur || "").toLowerCase() === "perintisan_bisnis" ? (
                      <NonPenelitianDecisionResultSection detail={finalNonPenelitianDetail} />
                    ) : null}

                    {!loadingFinalNonPenelitianDetail && finalNonPenelitianDetail ? (
                      <FinalDecisionDetailSection detail={finalNonPenelitianDetail} />
                    ) : null}

                    {!loadingFinalNonPenelitianDetail && finalNonPenelitianDetail ? (
                      <div className="rounded-xl border border-[#e4e9f6] bg-white p-4">
                        <h3 className="text-lg font-black text-[#1b274b]">Form Keputusan</h3>
                        {String(getMagangReviewStatus(finalNonPenelitianDetail) || "").toLowerCase() === "review_sekprodi" ? (
                          <>
                            <p className="mt-1 text-sm text-[#5d6c91]">
                              Approve akan menetapkan dosen pembimbing dan mengaktifkan akses bimbingan mahasiswa.
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setFinalNonPenelitianDecision("reject");
                                  setFinalNonPenelitianDosenPembimbingId("");
                                  setFinalNonPenelitianDosenPembimbing2Id("");
                                  setFinalNonPenelitianDosenQuery("");
                                  setFinalNonPenelitianDosenComboOpen(false);
                                  setFinalNonPenelitianDosen2Query("");
                                  setFinalNonPenelitianDosen2ComboOpen(false);
                                  setFinalNonPenelitianDecisionErrors({ note: "", dosen: "" });
                                }}
                                className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
                                  finalNonPenelitianDecision === "reject"
                                    ? "bg-[#b73a3a] text-white"
                                    : "border border-[#e2a2a2] bg-white text-[#a33737] hover:bg-[#fff3f3]"
                                }`}
                              >
                                Tolak
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setFinalNonPenelitianDecision("approve");
                                  setFinalNonPenelitianDecisionErrors({ note: "", dosen: "" });
                                }}
                                className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
                                  finalNonPenelitianDecision === "approve"
                                    ? "bg-[#137748] text-white"
                                    : "border border-[#9bc9b2] bg-white text-[#137748] hover:bg-[#eefaf3]"
                                }`}
                              >
                                Approve
                              </button>
                            </div>
                            <div className="mt-3 space-y-4">
                              {finalNonPenelitianDecision ? (
                                <div>
                                  <label className="mb-1 block text-sm font-semibold text-[#344b7f]">
                                    {finalNonPenelitianDecision === "approve" ? "Catatan keputusan" : "Alasan penolakan"}
                                    <span className="ml-1 text-[#b73a3a]">*</span>
                                  </label>
                                  <textarea
                                    rows={4}
                                    value={finalNonPenelitianDecisionNote}
                                    onChange={(event) => {
                                      setFinalNonPenelitianDecisionNote(event.target.value);
                                      if (finalNonPenelitianDecisionErrors.note) {
                                        setFinalNonPenelitianDecisionErrors((current) => ({ ...current, note: "" }));
                                      }
                                    }}
                                    placeholder={
                                      finalNonPenelitianDecision === "approve"
                                        ? "Isi catatan persetujuan..."
                                        : "Isi alasan penolakan..."
                                    }
                                    className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[#2f63e3] ${
                                      finalNonPenelitianDecisionErrors.note
                                        ? "border-[#d33b3b] bg-[#fffafa]"
                                        : "border-[#d3dbef]"
                                    }`}
                                  />
                                  {finalNonPenelitianDecisionErrors.note ? (
                                    <p className="mt-1 text-xs font-semibold text-[#b73a3a]">
                                      {finalNonPenelitianDecisionErrors.note}
                                    </p>
                                  ) : null}
                                </div>
                              ) : (
                                <div className="rounded-lg border border-[#e7ecf8] bg-[#f9fbff] px-3 py-2 text-sm font-semibold text-[#5e6d95]">
                                  Pilih Approve atau Tolak untuk menampilkan field keputusan.
                                </div>
                              )}

                              {finalNonPenelitianDecision === "approve" ? (
                                <div className="relative">
                                  <label className="mb-1 block text-sm font-semibold text-[#344b7f]">
                                    Dosen Pembimbing Baru
                                    <span className="ml-1 text-[#b73a3a]">*</span>
                                  </label>
                                  <div className="relative">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7282a8]" />
                                    <input
                                      type="search"
                                      name="dosen-pembimbing-utama-search"
                                      autoComplete="off"
                                      data-form-type="other"
                                      role="combobox"
                                      aria-expanded={finalNonPenelitianDosenComboOpen}
                                      aria-controls="final-dosen-pembimbing-options"
                                      value={
                                        finalNonPenelitianDosenComboOpen
                                          ? finalNonPenelitianDosenQuery
                                          : finalNonPenelitianDosenQuery ||
                                            (selectedFinalNonPenelitianDosen
                                              ? `${selectedFinalNonPenelitianDosen.nama || "-"} - NIK: ${selectedFinalNonPenelitianDosen.nik || "-"}`
                                              : "")
                                      }
                                      onFocus={() => {
                                        const nextQuery = selectedFinalNonPenelitianDosen
                                          ? `${selectedFinalNonPenelitianDosen.nama || "-"} - NIK: ${selectedFinalNonPenelitianDosen.nik || "-"}`
                                          : finalNonPenelitianDosenQuery;
                                        setFinalNonPenelitianDosenQuery(nextQuery);
                                        setFinalNonPenelitianDosenComboOpen(true);
                                      }}
                                      onBlur={() => {
                                        window.setTimeout(() => setFinalNonPenelitianDosenComboOpen(false), 120);
                                      }}
                                      onChange={(event) => {
                                        setFinalNonPenelitianDosenQuery(event.target.value);
                                        setFinalNonPenelitianDosenPembimbingId("");
                                        setFinalNonPenelitianDosenComboOpen(true);
                                        if (finalNonPenelitianDecisionErrors.dosen) {
                                          setFinalNonPenelitianDecisionErrors((current) => ({ ...current, dosen: "" }));
                                        }
                                      }}
                                      placeholder="Cari nama atau NIK dosen..."
                                      className={`w-full rounded-lg border py-2 pl-9 pr-3 text-sm outline-none focus:border-[#2f63e3] ${
                                        finalNonPenelitianDecisionErrors.dosen
                                          ? "border-[#d33b3b] bg-[#fffafa]"
                                          : "border-[#d3dbef]"
                                      }`}
                                    />
                                  </div>
                                  {finalNonPenelitianDecisionErrors.dosen ? (
                                    <p className="mt-1 text-xs font-semibold text-[#b73a3a]">
                                      {finalNonPenelitianDecisionErrors.dosen}
                                    </p>
                                  ) : null}
                                  {finalNonPenelitianDosenComboOpen ? (
                                    <div
                                      id="final-dosen-pembimbing-options"
                                      role="listbox"
                                      className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 max-h-[280px] overflow-auto rounded-lg border border-[#d9e3fb] bg-white text-sm shadow-lg"
                                    >
                                      {filteredFinalNonPenelitianDosenOptions.length > 0 ? (
                                        filteredFinalNonPenelitianDosenOptions.map((dosen) => (
                                          <button
                                            key={`final-dosen-combo-${dosen.id}`}
                                            type="button"
                                            role="option"
                                            aria-selected={Number(finalNonPenelitianDosenPembimbingId) === Number(dosen.id)}
                                            disabled={dosen.kuota?.is_penuh === true}
                                            onMouseDown={(event) => event.preventDefault()}
                                            onClick={() => {
                                              setFinalNonPenelitianDosenPembimbingId(String(dosen.id));
                                              if (Number(finalNonPenelitianDosenPembimbing2Id) === Number(dosen.id)) {
                                                setFinalNonPenelitianDosenPembimbing2Id("");
                                                setFinalNonPenelitianDosen2Query("");
                                                setFinalNonPenelitianDosen2ComboOpen(false);
                                              }
                                              setFinalNonPenelitianDosenQuery(dosen.label);
                                              setFinalNonPenelitianDosenComboOpen(false);
                                              setFinalNonPenelitianDecisionErrors((current) => ({ ...current, dosen: "" }));
                                            }}
                                            className={`flex h-14 w-full items-center justify-between gap-3 border-b border-[#edf1fb] px-3 py-2 text-left last:border-b-0 hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:bg-[#f4f5f8] disabled:text-[#8a94ad] ${
                                              Number(finalNonPenelitianDosenPembimbingId) === Number(dosen.id)
                                                ? "bg-[#e8efff] font-bold text-[#2756b8]"
                                                : "text-[#263a66]"
                                            }`}
                                          >
                                            <span className="min-w-0 flex-1 font-semibold leading-5">
                                              {formatDosenFullName(dosen.nama, dosen.gelar) || "-"}
                                            </span>
                                            <span className="shrink-0 text-right text-xs text-[#27407b]">
                                              {dosen.kuota?.is_penuh ? "Kuota penuh" : `Sisa kuota: ${dosen.kuota?.sisa ?? 0}`}<br />
                                              {dosen.kuota?.terpakai ?? 0}/{dosen.kuota?.total ?? 0} bimbingan
                                            </span>
                                          </button>
                                        ))
                                      ) : (
                                        <div className="px-3 py-2 text-[#6d7898]">Dosen tidak ditemukan.</div>
                                      )}
                                    </div>
                                  ) : null}
                                  <div className="relative mt-3">
                                    <label className="mb-1 block text-sm font-semibold text-[#344b7f]">
                                      Pembimbing 2 <span className="font-normal text-[#7582a2]">(opsional)</span>
                                    </label>
                                    <div className="relative">
                                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7282a8]" />
                                      <input
                                        type="search"
                                        name="dosen-pembimbing-kedua-search"
                                        autoComplete="off"
                                        data-form-type="other"
                                        role="combobox"
                                        aria-expanded={finalNonPenelitianDosen2ComboOpen}
                                        aria-controls="final-dosen-pembimbing-2-options"
                                        value={
                                          finalNonPenelitianDosen2ComboOpen
                                            ? finalNonPenelitianDosen2Query
                                            : finalNonPenelitianDosen2Query ||
                                              (selectedFinalNonPenelitianDosen2
                                                ? `${selectedFinalNonPenelitianDosen2.nama || "-"} - NIK: ${selectedFinalNonPenelitianDosen2.nik || "-"}`
                                                : "")
                                        }
                                        onFocus={() => {
                                          const nextQuery = selectedFinalNonPenelitianDosen2
                                            ? `${selectedFinalNonPenelitianDosen2.nama || "-"} - NIK: ${selectedFinalNonPenelitianDosen2.nik || "-"}`
                                            : finalNonPenelitianDosen2Query;
                                          setFinalNonPenelitianDosen2Query(nextQuery);
                                          setFinalNonPenelitianDosen2ComboOpen(true);
                                        }}
                                        onBlur={() => {
                                          window.setTimeout(() => setFinalNonPenelitianDosen2ComboOpen(false), 120);
                                        }}
                                        onChange={(event) => {
                                          setFinalNonPenelitianDosen2Query(event.target.value);
                                          setFinalNonPenelitianDosenPembimbing2Id("");
                                          setFinalNonPenelitianDosen2ComboOpen(true);
                                        }}
                                        placeholder="Cari nama atau NIK dosen..."
                                        className="w-full rounded-lg border border-[#d3dbef] py-2 pl-9 pr-3 text-sm outline-none focus:border-[#2f63e3]"
                                      />
                                    </div>
                                    {finalNonPenelitianDosen2ComboOpen ? (
                                      <div
                                        id="final-dosen-pembimbing-2-options"
                                        role="listbox"
                                        className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 max-h-[280px] overflow-auto rounded-lg border border-[#d9e3fb] bg-white text-sm shadow-lg"
                                      >
                                        {filteredFinalNonPenelitianDosen2Options.length > 0 ? (
                                          filteredFinalNonPenelitianDosen2Options.map((dosen) => (
                                            <button
                                              key={`final-dosen-2-combo-${dosen.id}`}
                                              type="button"
                                              role="option"
                                              aria-selected={Number(finalNonPenelitianDosenPembimbing2Id) === Number(dosen.id)}
                                              disabled={dosen.kuota?.is_penuh === true}
                                              onMouseDown={(event) => event.preventDefault()}
                                              onClick={() => {
                                                setFinalNonPenelitianDosenPembimbing2Id(String(dosen.id));
                                                setFinalNonPenelitianDosen2Query(dosen.label);
                                                setFinalNonPenelitianDosen2ComboOpen(false);
                                              }}
                                              className={`flex h-14 w-full items-center justify-between gap-3 border-b border-[#edf1fb] px-3 py-2 text-left last:border-b-0 hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:bg-[#f4f5f8] disabled:text-[#8a94ad] ${
                                                Number(finalNonPenelitianDosenPembimbing2Id) === Number(dosen.id)
                                                  ? "bg-[#e8efff] font-bold text-[#2756b8]"
                                                  : "text-[#263a66]"
                                              }`}
                                            >
                                              <span className="min-w-0 flex-1 font-semibold leading-5">
                                                {formatDosenFullName(dosen.nama, dosen.gelar) || "-"}
                                              </span>
                                              <span className="shrink-0 text-right text-xs text-[#27407b]">
                                                {dosen.kuota?.is_penuh ? "Kuota penuh" : `Sisa kuota: ${dosen.kuota?.sisa ?? 0}`}<br />
                                                {dosen.kuota?.terpakai ?? 0}/{dosen.kuota?.total ?? 0} bimbingan
                                              </span>
                                            </button>
                                          ))
                                        ) : (
                                          <div className="px-3 py-2 text-[#6d7898]">Dosen tidak ditemukan.</div>
                                        )}
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                            <div className="mt-4 flex flex-wrap justify-end gap-2">
                              <button
                                type="button"
                                disabled={
                                  sekprodiNonPenelitianActionId === selectedFinalNonPenelitianId ||
                                  !finalNonPenelitianDecision
                                }
                                onClick={() => handleSekprodiNonPenelitianDecision(finalNonPenelitianDecision)}
                                className={`rounded-lg px-4 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 ${
                                  finalNonPenelitianDecision === "reject" ? "bg-[#b73a3a]" : "bg-[#137748]"
                                }`}
                              >
                                {finalNonPenelitianDecision === "reject"
                                  ? "Tolak"
                                  : finalNonPenelitianDecision === "approve"
                                  ? "Approve"
                                  : "Pilih Keputusan"}
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="mt-3 rounded-lg border border-[#e7ecf8] bg-[#f9fbff] px-3 py-2 text-sm font-semibold text-[#5e6d95]">
                            Pengajuan ini sudah tidak berada pada tahap keputusan final sekretaris prodi.
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="relative mt-1 min-h-0 flex-1 overflow-auto rounded-lg border border-[#e6ecf8] grid-unified-height">
                    <table className="w-full min-w-[1380px] table-fixed text-left text-sm">
                      <colgroup>
                        <col style={{ width: "50px" }} />
                        <col style={{ width: "200px" }} />
                        <col style={{ width: "105px" }} />
                        <col style={{ width: "230px" }} />
                        <col style={{ width: "250px" }} />
                        <col style={{ width: "190px" }} />
                        <col style={{ width: "150px" }} />
                        <col style={{ width: "135px" }} />
                        <col style={{ width: "128px" }} />
                      </colgroup>
                      <thead className="sticky top-0 z-10">
                        <tr className="border-b border-[#e6ecf8] text-[#4d5e89]">
                          <th className="bg-[#f8fbff] px-3 py-2 font-semibold">No</th>
                          <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Mahasiswa</th>
                          <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Jalur</th>
                          <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Ringkasan</th>
                          <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Detail</th>
                          <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Tahap</th>
                          <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Reviewer Saat Ini</th>
                          <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Diperbarui</th>
                          <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {finalApprovalGridRows.map(({ key, type, row }, index) => {
                          const isResearch = type === "penelitian";
                          const rowBusy = isResearch
                            ? Number(finalResearchActionId) === Number(row.id)
                            : sekprodiNonPenelitianActionId === row.id;
                          const jalurLabel = isResearch ? "Penelitian" : formatLabel(row.jalur);
                          const researchTopics = isResearch ? getFinalResearchReadyTopics(row) : [];
                          const title = isResearch ? getFinalResearchTitle(row) : getPengampuReviewSummary(row);
                          const summary = isResearch
                            ? getFinalResearchSummary(row)
                            : getPengampuReviewNote(row) !== "-"
                            ? getPengampuReviewNote(row)
                            : row.periode?.label_periode || row.workflow_status_label || "-";
                          const stage = getFinalApprovalStageLabel(row, isResearch);
                          const reviewer = getFinalApprovalReviewerLabel(row, isResearch);
                          const time = isResearch
                            ? formatDateTime(row.diperbarui_pada || row.diajukan_pada)
                            : formatDateTime(row.submitted_at || row.updatedAt || row.createdAt);

                          return (
                            <tr key={key} className="border-b border-[#eff3fb] align-top">
                              <td className="px-3 py-3 font-bold text-[#274181]">{index + 1}</td>
                              <td className="px-3 py-3">
                                <p className="font-semibold text-[#1f2d53] break-words">{row.mahasiswa?.nama || "-"}</p>
                                <p className="mt-1 text-xs leading-5 text-[#61709b] break-words">
                                  {row.mahasiswa?.nim || "-"}
                                  {row.mahasiswa?.email ? ` | ${row.mahasiswa.email}` : ""}
                                  {row.mahasiswa?.angkatan ? ` | Angkatan ${row.mahasiswa.angkatan}` : ""}
                                </p>
                              </td>
                              <td className="px-3 py-3">
                                <span className="inline-flex rounded-full bg-[#eef4ff] px-2.5 py-1 text-xs font-bold text-[#2756bd]">
                                  {jalurLabel}
                                </span>
                              </td>
                              <td className="px-3 py-3">
                                {isResearch ? (
                                  <div className="space-y-1">
                                    {researchTopics.map((topic) => (
                                      <p
                                        key={`final-grid-summary-${row.id}-${getFinalResearchTopicKey(topic)}`}
                                        className="line-clamp-1 text-xs leading-5 text-[#1f2d53] break-words"
                                        title={`${topic.slot != null ? `Pilihan ${topic.slot}` : "Judul Mandiri"}${
                                          topic.kode ? ` - ${topic.kode}` : ""
                                        }: ${topic.judul || "-"}`}
                                      >
                                        <span className="font-bold">
                                          {topic.slot != null ? `Pilihan ${topic.slot}` : "Judul Mandiri"}
                                          {topic.kode ? ` - ${topic.kode}` : ""}:
                                        </span>{" "}
                                        {topic.judul || "-"}
                                      </p>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="line-clamp-3 font-semibold leading-5 text-[#1f2d53] break-words">{title}</p>
                                )}
                              </td>
                              <td className="px-3 py-3">
                                {isResearch ? (
                                  <div className="space-y-1">
                                    {researchTopics.map((topic) => (
                                      <p
                                        key={`final-grid-detail-${row.id}-${getFinalResearchTopicKey(topic)}`}
                                        className="line-clamp-1 text-xs leading-5 text-[#43537d] break-words"
                                        title={`Dosen: ${formatDosenFullName(topic.dosen_nama, topic.dosen_gelar) || "-"} | Ketua Cluster: ${
                                          formatDosenFullName(topic.ketua_cluster?.nama, topic.ketua_cluster?.gelar) || "-"
                                        }`}
                                      >
                                        <span className="font-semibold">Dosen:</span> {formatDosenFullName(topic.dosen_nama, topic.dosen_gelar) || "-"}
                                        {" | "}
                                        <span className="font-semibold">Ketua:</span> {formatDosenFullName(topic.ketua_cluster?.nama, topic.ketua_cluster?.gelar) || "-"}
                                      </p>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="line-clamp-3 leading-5 text-[#43537d] break-words">{summary}</p>
                                )}
                              </td>
                              <td className="px-3 py-3">
                                <span className="inline-flex max-w-full rounded-full bg-[#e8efff] px-2.5 py-1 text-xs font-bold leading-4 text-[#2454b8]">
                                  {stage}
                                </span>
                              </td>
                              <td className="px-3 py-3 text-[#2f426f]">{reviewer}</td>
                              <td className="px-3 py-3 text-[#43537d]">{time}</td>
                              <td className="px-3 py-3">
                                {isResearch ? (
                                  <button
                                    type="button"
                                    disabled={rowBusy}
                                    onClick={() => handleOpenFinalResearchDetail(row)}
                                    className="inline-flex items-center gap-1 rounded-md bg-[#2f63e3] px-3 py-1.5 text-xs font-bold text-white transition hover:brightness-110 disabled:opacity-50"
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                    Review
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={rowBusy}
                                    onClick={() => handleOpenSekprodiNonPenelitianDetail(row)}
                                    className="inline-flex items-center gap-1 rounded-md bg-[#2f63e3] px-3 py-1.5 text-xs font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                    Review
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                        {finalApprovalGridRows.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="h-[340px] px-4 text-center align-middle">
                              <div className="mx-auto max-w-md">
                                <ListChecks className="mx-auto h-9 w-9 text-[#9aa8c7]" />
                                <p className="mt-3 font-bold text-[#52638d]">
                                  Belum ada pengajuan yang menunggu keputusan final.
                                </p>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="mt-3 flex items-center justify-between border-t border-[#e8edf8] pt-3">
                  <p className="text-sm text-[#4f5e86]">
                    Menampilkan{" "}
                    {finalApprovalGridRows.length}{" "}
                    pengajuan yang menunggu keputusan final.
                  </p>
                </div>
              </div>
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
                              ? pagedSubmissions.map((gridRow, index) => {
                                  const nomorUrut = submissionRangeStart + index;
                                  const row = gridRow.raw || gridRow;
                                  const source = gridRow.source || "penelitian";
                                  const activeGridTab = "penelitian";
                                  const gridStatus = gridRow.status || getSubmissionGridStatus(row);
                                  const payload = getMagangPayload(row);
                                  const mitraData = source === "magang" ? getMagangMitraGridData(row) : null;
                                  const config = DOSEN_PENGAMPU_REVIEW_TABS[source] || null;
                                  const actionKey = `${source}-${row.id}`;
                                  const isPengampuBusy = pengampuReviewActionId === actionKey;
                                  const actionButtons =
                                    source === "penelitian" ? (
                                      <button
                                        type="button"
                                        disabled={loadingSubmissionDetail}
                                        onClick={() => handleOpenSubmissionReview(row.id)}
                                        title={row.review_eligible === false ? row.review_block_reason || "Keputusan sedang dinonaktifkan" : "Buka review"}
                                        className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${row.review_eligible === false ? "bg-[#7b88a8] hover:bg-[#6d7997]" : "bg-[#2f63e3] hover:brightness-110"}`}
                                      >
                                        <Eye className="h-3.5 w-3.5" />
                                        {row.review_eligible === false ? "Lihat" : "Review"}
                                      </button>
                                    ) : source === "magang" ? (
                                      <button
                                        type="button"
                                        disabled={magangReviewActionId === row.id}
                                        onClick={() => handleOpenMagangReviewDetail(row.id)}
                                        className="inline-flex items-center gap-1 rounded-md bg-[#2f63e3] px-3 py-1.5 text-xs font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        <Eye className="h-3.5 w-3.5" />
                                        Review
                                      </button>
                                    ) : config ? (
                                      <button
                                        type="button"
                                        disabled={isPengampuBusy}
                                        onClick={() => handleOpenPengampuReviewDetail(row.id, config)}
                                        className="inline-flex items-center gap-1 rounded-md bg-[#2f63e3] px-3 py-1.5 text-xs font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        <Eye className="h-3.5 w-3.5" />
                                        Review
                                      </button>
                                    ) : null;

                                  if (activeGridTab === "semua") {
                                    return (
                                      <tr key={`submission-${gridRow.id}`} className="border-b border-[#eff3fb] align-top">
                                        <td className="px-3 py-2 font-semibold text-[#254080] whitespace-nowrap align-top">{nomorUrut}</td>
                                        <td className="px-3 py-2">
                                          <p className="font-semibold text-[#1f2d53] break-words">{gridRow.mahasiswa?.nama || "-"}</p>
                                          <p className="text-xs text-[#61709b]">Angkatan {gridRow.mahasiswa?.angkatan || "-"}</p>
                                        </td>
                                        <td className="px-3 py-2 font-semibold text-[#27407b] whitespace-nowrap align-top">{gridRow.mahasiswa?.nim || "-"}</td>
                                        <td className="px-3 py-2 text-[#2f426f] whitespace-nowrap align-top">{formatLabel(source)}</td>
                                        <td className="px-3 py-2 text-[#2f426f] break-words align-top">{gridRow.summary || "-"}</td>
                                        <td className="px-3 py-2 whitespace-nowrap align-top">
                                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${getSubmissionStatusBadgeClass(gridStatus)}`}>
                                            {formatLabel(gridStatus)}
                                          </span>
                                        </td>
                                        <td className="px-3 py-2 align-top break-words">
                                          <p className="font-semibold text-[#2a3f74]">{gridRow.tahap || "-"}</p>
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap align-top">{formatDateTime(gridRow.updatedAt)}</td>
                                        <td className="px-3 py-2 whitespace-nowrap align-top">{actionButtons}</td>
                                      </tr>
                                    );
                                  }

                                  if (source === "magang") {
                                    return (
                                      <tr key={`submission-${gridRow.id}`} className="border-b border-[#eff3fb] align-top">
                                        <td className="px-3 py-2 font-semibold text-[#254080] whitespace-nowrap align-top">{nomorUrut}</td>
                                        <td className="px-3 py-2">
                                          <p className="font-semibold text-[#1f2d53] break-words">{gridRow.mahasiswa?.nama || "-"}</p>
                                          <p className="text-xs text-[#61709b]">Angkatan {gridRow.mahasiswa?.angkatan || "-"}</p>
                                        </td>
                                        <td className="px-3 py-2 font-semibold text-[#27407b] whitespace-nowrap align-top">{gridRow.mahasiswa?.nim || "-"}</td>
                                        <td className="px-3 py-2 text-[#2f426f] whitespace-nowrap align-top">{formatLabel(payload.company_type)}</td>
                                        <td className="px-3 py-2 text-[#2f426f] break-words align-top">{mitraData?.nama || "-"}</td>
                                        <td className="px-3 py-2 text-[#2f426f] break-words align-top">{mitraData?.posisi_magang || "-"}</td>
                                        <td className="px-3 py-2 text-[#2f426f] break-words align-top">{mitraData?.lokasi || "-"}</td>
                                        <td className="px-3 py-2 text-[#2f426f] whitespace-nowrap align-top">{formatMagangPayloadValue(payload.sudah_apply_ke_mitra)}</td>
                                        <td className="px-3 py-2 whitespace-nowrap align-top">
                                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${getSubmissionStatusBadgeClass(gridStatus)}`}>
                                            {formatLabel(gridStatus)}
                                          </span>
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap align-top">{formatDateTime(gridRow.submittedAt)}</td>
                                        <td className="px-3 py-2 whitespace-nowrap align-top">{actionButtons}</td>
                                      </tr>
                                    );
                                  }

                                  if (source === "pengabdian") {
                                    return (
                                      <tr key={`submission-${gridRow.id}`} className="border-b border-[#eff3fb] align-top">
                                        <td className="px-3 py-2 font-semibold text-[#254080] whitespace-nowrap align-top">{nomorUrut}</td>
                                        <td className="px-3 py-2">
                                          <p className="font-semibold text-[#1f2d53] break-words">{gridRow.mahasiswa?.nama || "-"}</p>
                                          <p className="text-xs text-[#61709b]">Angkatan {gridRow.mahasiswa?.angkatan || "-"}</p>
                                        </td>
                                        <td className="px-3 py-2 font-semibold text-[#27407b] whitespace-nowrap align-top">{gridRow.mahasiswa?.nim || "-"}</td>
                                        <td className="px-3 py-2 text-[#2f426f] break-words align-top">{formatMagangPayloadValue(payload.nama_program)}</td>
                                        <td className="px-3 py-2 text-[#2f426f] break-words align-top">{formatMagangPayloadValue(payload.nama_mitra)}</td>
                                        <td className="px-3 py-2 text-[#2f426f] break-words align-top">{formatMagangPayloadValue(payload.lokasi_pengabdian)}</td>
                                        <td className="px-3 py-2 text-[#2f426f] break-words align-top">{formatMagangPayloadValue(payload.target_luaran)}</td>
                                        <td className="px-3 py-2 whitespace-nowrap align-top">
                                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${getSubmissionStatusBadgeClass(gridStatus)}`}>
                                            {formatLabel(gridStatus)}
                                          </span>
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap align-top">{formatDateTime(gridRow.submittedAt)}</td>
                                        <td className="px-3 py-2 whitespace-nowrap align-top">{actionButtons}</td>
                                      </tr>
                                    );
                                  }

                                  if (source === "perintisan_bisnis") {
                                    return (
                                      <tr key={`submission-${gridRow.id}`} className="border-b border-[#eff3fb] align-top">
                                        <td className="px-3 py-2 font-semibold text-[#254080] whitespace-nowrap align-top">{nomorUrut}</td>
                                        <td className="px-3 py-2">
                                          <p className="font-semibold text-[#1f2d53] break-words">{gridRow.mahasiswa?.nama || "-"}</p>
                                          <p className="text-xs text-[#61709b]">Angkatan {gridRow.mahasiswa?.angkatan || "-"}</p>
                                        </td>
                                        <td className="px-3 py-2 font-semibold text-[#27407b] whitespace-nowrap align-top">{gridRow.mahasiswa?.nim || "-"}</td>
                                        <td className="px-3 py-2 text-[#2f426f] break-words align-top">{formatMagangPayloadValue(payload.nama_bisnis)}</td>
                                        <td className="px-3 py-2 text-[#2f426f] break-words align-top">{formatMagangPayloadValue(payload.jenis_bisnis)}</td>
                                        <td className="px-3 py-2 text-[#2f426f] break-words align-top">{formatMagangPayloadValue(payload.lokasi_bisnis)}</td>
                                        <td className="px-3 py-2 text-[#2f426f] break-words align-top">{formatMagangPayloadValue(payload.tahap_perkembangan)}</td>
                                        <td className="px-3 py-2 whitespace-nowrap align-top">
                                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${getSubmissionStatusBadgeClass(gridStatus)}`}>
                                            {formatLabel(gridStatus)}
                                          </span>
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap align-top">{formatDateTime(gridRow.submittedAt)}</td>
                                        <td className="px-3 py-2 whitespace-nowrap align-top">{actionButtons}</td>
                                      </tr>
                                    );
                                  }

                                  const topikCount = getSubmissionTopikCount(row);
                                  return (
                                    <tr key={`submission-${gridRow.id}`} className="border-b border-[#eff3fb] align-top">
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
                                        {row.review_eligible === false ? (
                                          <p className="mt-1 text-xs font-semibold text-[#b36a16]">Keputusan dinonaktifkan · perlu dialihkan Sekprodi</p>
                                        ) : null}
                                      </td>
                                      <td className="px-3 py-2 whitespace-nowrap align-top">{formatDateTime(row.diperbarui_pada || row.diajukan_pada)}</td>
                                      <td className="px-3 py-2 whitespace-nowrap align-top">{actionButtons}</td>
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
                                  {shouldShowTopikReviewCountdown(submissionDetail) ? (
                                    <p className="mt-1 text-xs font-semibold text-[#355da8]">
                                      Menunggu seluruh reviewer memberikan keputusan.
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

                                <div className="rounded-lg border border-[#e4e9f6] bg-white p-4">
                                  <ResearchReviewDetailForm
                                    detail={submissionDetail}
                                    topikRows={submissionReviewTopikFocused ? [submissionReviewTopikFocused] : []}
                                  />
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
                          <div className="mt-4 rounded-lg border border-[#e4e9f6] bg-white p-4">
                            {shouldShowTopikReviewCountdown(submissionDetail) ? (
                              <p className="mb-4 rounded-lg border border-[#dbe4fa] bg-[#f8fbff] px-3 py-2 text-xs font-semibold text-[#355da8]">
                                Pengajuan tetap menunggu keputusan dosen tanpa batas waktu otomatis.
                              </p>
                            ) : null}
                            <ResearchReviewDetailForm detail={submissionDetail} />
                          </div>
                        )}
                      </div>
                    ) : null}

                    {!loadingSubmissionDetail &&
                    submissionDetail &&
                    submissionDetail.can_review &&
                    activeTab === "ketua-cluster-review" ? (
                      <div className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                        <SubmissionDecisionDetailSection items={submissionDecisionHistory} />
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
                                Pilih keputusan untuk topik yang sedang direview.
                              </p>

                              <div className="mt-3 rounded-lg border border-[#e4e9f6] bg-[#f8fbff] p-3">
                                <p className="text-sm font-semibold text-[#2f426f]">Keputusan</p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSubmissionDecision("approve");
                                      setSubmissionKeterangan("");
                                    }}
                                    className={`rounded-md border px-4 py-2 text-sm font-bold transition ${
                                      submissionDecision === "approve"
                                        ? "border-[#137748] bg-[#137748] text-white"
                                        : "border-[#9bcdb4] bg-white text-[#137748] hover:bg-[#eef9f3]"
                                    }`}
                                  >
                                    Approve
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSubmissionDecision("reject");
                                      setSubmissionKeterangan("");
                                    }}
                                    className={`rounded-md border px-4 py-2 text-sm font-bold transition ${
                                      submissionDecision === "reject"
                                        ? "border-[#b73a3a] bg-[#b73a3a] text-white"
                                        : "border-[#e5abab] bg-white text-[#b73a3a] hover:bg-[#fff3f3]"
                                    }`}
                                  >
                                    Reject
                                  </button>
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
                              Pilih keputusan untuk pengajuan yang sedang direview.
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setSubmissionDecision("approve");
                                  setSubmissionKeterangan("");
                                }}
                                className={`rounded-md border px-4 py-2 text-sm font-bold transition ${
                                  submissionDecision === "approve"
                                    ? "border-[#137748] bg-[#137748] text-white"
                                    : "border-[#9bcdb4] bg-white text-[#137748] hover:bg-[#eef9f3]"
                                }`}
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSubmissionDecision("reject");
                                  setSubmissionKeterangan("");
                                }}
                                className={`rounded-md border px-4 py-2 text-sm font-bold transition ${
                                  submissionDecision === "reject"
                                    ? "border-[#b73a3a] bg-[#b73a3a] text-white"
                                    : "border-[#e5abab] bg-white text-[#b73a3a] hover:bg-[#fff3f3]"
                                }`}
                              >
                                Reject
                              </button>
                            </div>
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
                        ) : submissionDetail.status === "pending" && submissionDetail.has_pending_review && submissionDetail.review_eligible === false ? (
                          <>
                            <div className="rounded-lg border border-[#f1d4a8] bg-[#fff8e8] px-4 py-3">
                              <p className="text-sm font-black text-[#8a5514]">Keputusan sementara dinonaktifkan</p>
                              <p className="mt-1 text-sm text-[#805f32]">
                                {submissionDetail.review_block_reason || "Dosen sedang tidak aktif atau tidak tersedia pada periode pengajuan."}
                              </p>
                              <p className="mt-1 text-xs font-semibold text-[#9b7137]">Pengajuan tetap ditampilkan agar dapat diketahui dan dialihkan oleh Sekretaris Prodi.</p>
                            </div>
                            <div className="mt-3"><SubmissionDecisionDetailSection items={submissionDecisionHistory} /></div>
                          </>
                        ) : (
                          <SubmissionDecisionDetailSection items={submissionDecisionHistory} />
                        )}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {false ? (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-black text-[#1b274b]">Tindak Lanjut Perubahan Status Dosen</h3>
                          <p className="mt-1 text-sm text-[#5d6c91]">Proses penggantian pembimbing, penyesuaian tugas, dan reaktivasi dosen dari satu halaman.</p>
                        </div>
                        <button type="button" onClick={loadAllData} className="inline-flex items-center gap-2 rounded-lg border border-[#d3dbef] px-3 py-2 text-sm font-semibold text-[#27407b] hover:bg-[#f3f6ff]">
                          <RefreshCcw className="h-4 w-4" /> Refresh
                        </button>
                      </div>
                    </div>

                    <div className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#dbe4f6] bg-[#f8fbff] p-3">
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7282a8]" />
                          <input
                            type="search"
                            value={dosenStatusFollowUpQuery}
                            onChange={(event) => {
                              setDosenStatusFollowUpQuery(event.target.value);
                              setDosenStatusFollowUpPage(1);
                            }}
                            placeholder="Cari nama, kode, atau status dosen..."
                            aria-label="Cari tindak lanjut status dosen"
                            className="w-[320px] rounded-lg border border-[#d3dbef] bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[#2f63e3]"
                          />
                        </div>
                        <span className="rounded-full bg-[#fff1df] px-3 py-1.5 text-xs font-black text-[#a15b18]">{filteredDosenStatusFollowUps.length} perlu diproses</span>
                      </div>

                      <div className="overflow-auto rounded-lg border border-[#e6ecf8]">
                        <table className="w-full min-w-[1120px] text-left text-sm">
                          <thead>
                            <tr className="border-b border-[#e6ecf8] text-[#4d5e89]">
                              <th className="bg-[#f8fbff] px-3 py-2">Dosen</th>
                              <th className="bg-[#f8fbff] px-3 py-2">Status Master</th>
                              <th className="bg-[#f8fbff] px-3 py-2 text-center">Mahasiswa Aktif</th>
                              <th className="bg-[#f8fbff] px-3 py-2 text-center">Review Tertunda</th>
                              <th className="bg-[#f8fbff] px-3 py-2 text-center">Jadwal Sidang</th>
                              <th className="bg-[#f8fbff] px-3 py-2">Jenis Tindak Lanjut</th>
                              <th className="bg-[#f8fbff] px-3 py-2">Status</th>
                              <th className="bg-[#f8fbff] px-3 py-2 text-center">Aksi</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pagedDosenStatusFollowUps.map((row) => {
                              const impact = row.impact_snapshot || {};
                              const requiresReplacement = row.dosen?.continue_existing_supervision === false
                                && Number(impact.mahasiswa_bimbingan_aktif || 0) > 0;
                              const typeLabel = impact.reactivation_required
                                ? "Reaktivasi"
                                : requiresReplacement
                                ? "Penggantian Pembimbing"
                                : "Penyesuaian Tugas";
                              return (
                                <tr key={`follow-up-${row.id}`} className="border-b border-[#eff3fb] last:border-b-0">
                                  <td className="px-3 py-3"><p className="font-bold text-[#1f3160]">{formatDosenFullName(row.dosen?.nama, row.dosen?.gelar) || "Dosen"}</p><p className="text-xs text-[#6a779a]">{row.dosen?.kode_dosen || row.dosen?.nik || "-"}</p></td>
                                  <td className="px-3 py-3"><span className="rounded-full bg-[#fff1df] px-2 py-1 text-xs font-bold text-[#a15b18]">{DOSEN_MASTER_STATUS_LABELS[row.dosen?.status_keaktifan] || row.dosen?.status_keaktifan || "-"}</span></td>
                                  <td className="px-3 py-3 text-center font-bold text-[#1f3160]">{Number(impact.mahasiswa_bimbingan_aktif || 0)}</td>
                                  <td className="px-3 py-3 text-center font-bold text-[#1f3160]">{Number(impact.review_pending || 0)}</td>
                                  <td className="px-3 py-3 text-center font-bold text-[#1f3160]">{Number(impact.jadwal_sidang_mendatang || 0)}</td>
                                  <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${requiresReplacement ? "bg-[#fff0f0] text-[#a03f3f]" : impact.reactivation_required ? "bg-[#eef3ff] text-[#34549b]" : "bg-[#fff8ed] text-[#a15b18]"}`}>{typeLabel}</span></td>
                                  <td className="px-3 py-3"><span className="rounded-full bg-[#fff1df] px-2 py-1 text-xs font-bold text-[#a15b18]">Terbuka</span></td>
                                  <td className="px-3 py-3 text-center"><button type="button" onClick={() => handleOpenDosenStatusFollowUpPage(row)} className="rounded-lg bg-[#2f63e3] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#2454c7]">Proses</button></td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        {filteredDosenStatusFollowUps.length === 0 ? (
                          <p className="p-8 text-center text-sm font-semibold text-[#7b88ab]">{dosenStatusFollowUps.length === 0 ? "Tidak ada tindak lanjut terbuka." : "Tindak lanjut yang dicari tidak ditemukan."}</p>
                        ) : null}
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#e8edf8] pt-3">
                        <p className="text-sm text-[#4f5e86]">Menampilkan {dosenStatusFollowUpRangeStart} - {dosenStatusFollowUpRangeEnd} dari {filteredDosenStatusFollowUps.length} tindak lanjut.</p>
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => setDosenStatusFollowUpPage((previous) => Math.max(1, previous - 1))} disabled={dosenStatusFollowUpPage === 1} className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] disabled:cursor-not-allowed disabled:opacity-50">Sebelumnya</button>
                          <span className="text-sm font-semibold text-[#314778]">Halaman {dosenStatusFollowUpPage} / {totalDosenStatusFollowUpPages}</span>
                          <button type="button" onClick={() => setDosenStatusFollowUpPage((previous) => Math.min(totalDosenStatusFollowUpPages, previous + 1))} disabled={dosenStatusFollowUpPage >= totalDosenStatusFollowUpPages} className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] disabled:cursor-not-allowed disabled:opacity-50">Berikutnya</button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {!loading && activeTab === "magang-review" ? (
              magangReviewMode === "review" ? (
                <div className="flex min-h-0 flex-1 flex-col gap-4">
                  <div className="rounded-xl border border-[#e4e9f6] bg-white p-3 shadow-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleBackToMagangReviewList}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#d3dbef] text-[#2b3f74] hover:bg-[#f3f7ff]"
                        title="Kembali ke grid review magang"
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={handleRefreshMagangReviewDetail}
                        disabled={loadingMagangReviewDetail}
                        className="inline-flex items-center gap-2 rounded-lg border border-[#d3dbef] px-3 py-2 text-sm font-semibold text-[#27407b] hover:bg-[#f3f6ff] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <RefreshCcw className="h-4 w-4" />
                        Refresh
                      </button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                    <h3 className="text-lg font-black text-[#1b274b]">Review Magang</h3>
                    <p className="text-sm text-[#5d6c91]">
                      Tinjau permintaan surat rekomendasi magang sebelum memberi keputusan.
                    </p>

                    {loadingMagangReviewDetail ? (
                      <div className="mt-4 rounded-lg border border-[#e2e9f8] bg-[#f8fbff] p-6 text-center text-sm font-semibold text-[#60709a]">
                        Memuat detail review magang...
                      </div>
                    ) : null}

                    {!loadingMagangReviewDetail && magangReviewDetail ? (
                      <div className="mt-4">
                        <MagangReadonlyDetailForm
                          detail={magangReviewDetail}
                          onOpenDocument={handleOpenMagangReviewDocument}
                        />
                      </div>
                    ) : null}
                  </div>

                  {!loadingMagangReviewDetail && magangReviewDetail ? (
                    <div className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                      <h3 className="text-lg font-black text-[#1b274b]">Form Keputusan</h3>
                      {String(getMagangReviewStatus(magangReviewDetail) || "").toLowerCase() === "review_dosen_magang" ? (
                        <>
                          <p className="mt-1 text-sm text-[#5d6c91]">
                            Approve akan meneruskan pengajuan ke Sekprodi. Tolak wajib menyertakan alasan.
                          </p>
                          <div className="mt-3">
                            <label className="mb-1 block text-sm font-semibold text-[#344b7f]">
                              Catatan keputusan
                            </label>
                            <textarea
                              rows={4}
                              value={magangReviewDecisionNote}
                              onChange={(event) => setMagangReviewDecisionNote(event.target.value)}
                              placeholder="Isi catatan persetujuan atau alasan penolakan..."
                              className="w-full rounded-lg border border-[#d3dbef] px-3 py-2 text-sm outline-none focus:border-[#2f63e3]"
                            />
                          </div>
                          <div className="mt-4 flex flex-wrap justify-end gap-2">
                            <button
                              type="button"
                              disabled={magangReviewActionId === selectedMagangReviewId}
                              onClick={() => handleSubmitMagangReviewDecision("reject")}
                              className="rounded-lg bg-[#b73a3a] px-4 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Tolak
                            </button>
                            <button
                              type="button"
                              disabled={magangReviewActionId === selectedMagangReviewId}
                              onClick={() => handleSubmitMagangReviewDecision("approve")}
                              className="rounded-lg bg-[#137748] px-4 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Approve
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="mt-3 rounded-lg border border-[#e7ecf8] bg-[#f9fbff] px-3 py-2 text-sm font-semibold text-[#5e6d95]">
                          Pengajuan ini sudah tidak berada pada tahap review dosen pengawas magang.
                        </div>
                      )}
                    </div>
                  ) : null}

                  {!loadingMagangReviewDetail && magangReviewDetail ? (
                    <div className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                      <h3 className="text-lg font-black text-[#1b274b]">Timeline Workflow</h3>
                      <div className="mt-3 space-y-2">
                        {Array.isArray(getMagangPayload(magangReviewDetail).workflow_timeline) &&
                        getMagangPayload(magangReviewDetail).workflow_timeline.length > 0 ? (
                          getMagangPayload(magangReviewDetail).workflow_timeline.map((item, index) => (
                            <div key={`magang-review-timeline-${index}`} className="rounded-lg border border-[#e4e9f6] bg-[#f8fbff] p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-sm font-black text-[#27407b]">{formatLabel(item?.status || "-")}</p>
                                <p className="text-xs font-semibold text-[#60709a]">{formatDateTime(item?.at)}</p>
                              </div>
                              <p className="mt-1 text-sm font-semibold text-[#42537d]">{formatLabel(item?.actor || "-")}</p>
                              <p className="mt-1 text-sm text-[#2f426f]">{item?.note || "-"}</p>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-lg border border-[#e4e9f6] bg-[#f8fbff] p-3 text-sm font-semibold text-[#65749b]">
                            Belum ada timeline workflow.
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
              <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black text-[#1b274b]">Grid Review Magang</h3>
                    <p className="mt-1 text-sm text-[#5d6c91]">
                      Hanya menampilkan permintaan surat rekomendasi magang yang masuk ke dosen pengawas magang pada periode aktif.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
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
                      <col style={{ width: "130px" }} />
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
                                  <button
                                    type="button"
                                    disabled={isRowBusy}
                                    onClick={() => handleOpenMagangReviewDetail(row.id)}
                                    className="inline-flex items-center gap-1 rounded-md bg-[#2f63e3] px-3 py-1.5 text-xs font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                    Review
                                  </button>
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
              )
            ) : null}

            {!loading && activePengampuReviewConfig ? (
              pengampuReviewMode === "review" ? (
                <div className="flex min-h-0 flex-1 flex-col gap-4">
                  <div className="rounded-xl border border-[#e4e9f6] bg-white p-3 shadow-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleBackToPengampuReviewList}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#d3dbef] text-[#2b3f74] hover:bg-[#f3f7ff]"
                        title="Kembali ke grid review"
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={handleRefreshPengampuReviewDetail}
                        disabled={loadingPengampuReviewDetail}
                        className="inline-flex items-center gap-2 rounded-lg border border-[#d3dbef] px-3 py-2 text-sm font-semibold text-[#27407b] hover:bg-[#f3f6ff] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <RefreshCcw className="h-4 w-4" />
                        Refresh
                      </button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                    <h3 className="text-lg font-black text-[#1b274b]">{activePengampuReviewConfig.title}</h3>
                    <p className="text-sm text-[#5d6c91]">
                      Tinjau detail pengajuan sebelum memberi keputusan sebagai dosen pengampu.
                    </p>

                    {loadingPengampuReviewDetail ? (
                      <div className="mt-4 rounded-lg border border-[#e2e9f8] bg-[#f8fbff] p-6 text-center text-sm font-semibold text-[#60709a]">
                        Memuat detail review...
                      </div>
                    ) : null}

                    {!loadingPengampuReviewDetail && pengampuReviewDetail ? (
                      activePengampuReviewConfig.jalur === "perintisan_bisnis" ? (
                        <div className="mt-4">
                          <PerintisanReadonlyDetailForm
                            detail={pengampuReviewDetail}
                            onOpenDocument={handleOpenPengampuReviewDocument}
                          />
                        </div>
                      ) : (
                        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
                          {getPengampuReviewDetailFields(pengampuReviewDetail, activePengampuReviewConfig).map(([label, value]) => (
                            <div key={`pengampu-review-field-${label}`} className="rounded-lg border border-[#e2e9f8] bg-[#f8fbff] p-3">
                              <p className="text-xs font-black uppercase text-[#64749d]">{label}</p>
                              <p className="mt-1 break-words text-sm font-semibold text-[#203665]">
                                {formatMagangPayloadValue(value)}
                              </p>
                            </div>
                          ))}
                        </div>
                      )
                    ) : null}
                  </div>

                  {!loadingPengampuReviewDetail &&
                  pengampuReviewDetail &&
                  activePengampuReviewConfig.jalur === "perintisan_bisnis" ? (
                    <>
                      <NonPenelitianDecisionResultSection detail={pengampuReviewDetail} />
                      <FinalDecisionDetailSection detail={pengampuReviewDetail} />
                    </>
                  ) : null}

                  {!loadingPengampuReviewDetail &&
                  pengampuReviewDetail &&
                  activePengampuReviewConfig.jalur !== "perintisan_bisnis" ? (
                    <div className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                      <h3 className="text-lg font-black text-[#1b274b]">Timeline Workflow</h3>
                      <div className="mt-3 space-y-2">
                        {Array.isArray(getMagangPayload(pengampuReviewDetail).workflow_timeline) &&
                        getMagangPayload(pengampuReviewDetail).workflow_timeline.length > 0 ? (
                          getMagangPayload(pengampuReviewDetail).workflow_timeline.map((item, index) => (
                            <div key={`pengampu-review-timeline-${index}`} className="rounded-lg border border-[#e4e9f6] bg-[#f8fbff] p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-sm font-black text-[#27407b]">{formatLabel(item?.status || "-")}</p>
                                <p className="text-xs font-semibold text-[#60709a]">{formatDateTime(item?.at)}</p>
                              </div>
                              <p className="mt-1 text-sm font-semibold text-[#42537d]">{formatLabel(item?.actor || "-")}</p>
                              <p className="mt-1 text-sm text-[#2f426f]">{item?.note || "-"}</p>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-lg border border-[#e4e9f6] bg-[#f8fbff] p-3 text-sm font-semibold text-[#65749b]">
                            Belum ada timeline workflow.
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}

                  {!loadingPengampuReviewDetail && pengampuReviewDetail ? (
                    <div className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                      <h3 className="text-lg font-black text-[#1b274b]">Form Keputusan</h3>
                      {String(getPengampuReviewStatus(pengampuReviewDetail) || "").toLowerCase() === "submitted" ? (
                        <>
                          <p className="mt-1 text-sm text-[#5d6c91]">
                            Approve akan memproses pengajuan ke tahap berikutnya. Tolak wajib menyertakan alasan.
                          </p>
                          <div className="mt-3">
                            <label className="mb-1 block text-sm font-semibold text-[#344b7f]">
                              Catatan keputusan
                            </label>
                            <textarea
                              rows={4}
                              value={pengampuReviewDecisionNote}
                              onChange={(event) => setPengampuReviewDecisionNote(event.target.value)}
                              placeholder="Isi catatan persetujuan atau alasan penolakan..."
                              className="w-full rounded-lg border border-[#d3dbef] px-3 py-2 text-sm outline-none focus:border-[#2f63e3]"
                            />
                          </div>
                          <div className="mt-4 flex flex-wrap justify-end gap-2">
                            <button
                              type="button"
                              disabled={pengampuReviewActionId === `${activePengampuReviewConfig.jalur}-${selectedPengampuReviewId}`}
                              onClick={() => handleSubmitPengampuReviewDecision(activePengampuReviewConfig, "reject")}
                              className="rounded-lg bg-[#b73a3a] px-4 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Tolak
                            </button>
                            <button
                              type="button"
                              disabled={pengampuReviewActionId === `${activePengampuReviewConfig.jalur}-${selectedPengampuReviewId}`}
                              onClick={() => handleSubmitPengampuReviewDecision(activePengampuReviewConfig, "approve")}
                              className="rounded-lg bg-[#137748] px-4 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Approve
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="mt-3 rounded-lg border border-[#e7ecf8] bg-[#f9fbff] px-3 py-2 text-sm font-semibold text-[#5e6d95]">
                          Pengajuan ini sudah tidak berada pada tahap review dosen pengampu.
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : (
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
                      <col style={{ width: "130px" }} />
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
                                  <button
                                    type="button"
                                    disabled={isRowBusy}
                                    onClick={() => handleOpenPengampuReviewDetail(row.id, activePengampuReviewConfig)}
                                    className="inline-flex items-center gap-1 rounded-md bg-[#2f63e3] px-3 py-1.5 text-xs font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                    Review
                                  </button>
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
              )
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
                    <select
                      value={masterTopikFilters.cluster}
                      onChange={(event) =>
                        setMasterTopikFilters((prev) => ({ ...prev, cluster: event.target.value }))
                      }
                      className="w-[150px] rounded-lg border border-[#d3dbef] px-3 py-2 text-sm text-[#23396b] outline-none focus:border-[#2f63e3]"
                    >
                      <option value="">Semua cluster</option>
                      {masterTopikFilterOptions.cluster.map((item) => (
                        <option key={`master-topik-filter-cluster-${item}`} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                    <select
                      value={masterTopikFilters.status}
                      onChange={(event) =>
                        setMasterTopikFilters((prev) => ({ ...prev, status: event.target.value }))
                      }
                      className="w-[150px] rounded-lg border border-[#d3dbef] px-3 py-2 text-sm text-[#23396b] outline-none focus:border-[#2f63e3]"
                    >
                      <option value="">Semua status</option>
                      {masterTopikFilterOptions.status.map((item) => (
                        <option key={`master-topik-filter-status-${item}`} value={item}>
                          {formatLabel(item)}
                        </option>
                      ))}
                    </select>
                    <select
                      value={masterTopikFilters.dosen}
                      onChange={(event) =>
                        setMasterTopikFilters((prev) => ({ ...prev, dosen: event.target.value }))
                      }
                      className="w-[220px] rounded-lg border border-[#d3dbef] px-3 py-2 text-sm text-[#23396b] outline-none focus:border-[#2f63e3]"
                    >
                      <option value="">Semua dosen</option>
                      {masterTopikFilterOptions.dosen.map((item) => (
                        <option key={`master-topik-filter-dosen-${item.value}`} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setMasterTopikFilters({ ...MASTER_TOPIK_FILTER_INITIAL })}
                      disabled={!Object.values(masterTopikFilters).some((value) => String(value || "").trim())}
                      className="rounded-lg border border-[#d3dbef] px-3 py-2 text-sm font-semibold text-[#27407b] hover:bg-[#f3f6ff] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Reset
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
                                {row.status === "pending" && row.can_review !== false ? (
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
                                      {row.can_review === false ? "Detail (read-only)" : "Detail"}
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
                                {row.status_dospem === "pending" && row.can_review !== false ? (
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
                                  <span className="text-xs text-[#68779f]">
                                    {row.status_dospem === "pending" && row.can_review === false
                                      ? "Hanya lihat"
                                      : "Sudah diproses"}
                                  </span>
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

            {!loading && isSekretaris && activeTab === "mitra-magang" ? (
              <div className="flex min-h-0 flex-1 flex-col gap-4">
                {mitraMagangMode === "form" ? (
                  <div className="rounded-xl border border-[#e4e9f6] bg-white p-3 shadow-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleBackFromMitraMagangForm}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#d3dbef] text-[#27407b] transition hover:bg-[#f3f6ff]"
                        title="Kembali ke grid mitra magang"
                        aria-label="Kembali ke grid mitra magang"
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={loadAllData}
                        className="inline-flex items-center gap-2 rounded-lg border border-[#d3dbef] px-4 py-2 text-sm font-semibold text-[#27407b] transition hover:bg-[#f3f6ff]"
                      >
                        <RefreshCcw className="h-4 w-4" />
                        Refresh
                      </button>
                    </div>
                  </div>
                ) : null}

                {mitraMagangMode === "form" ? (
                <form
                  onSubmit={handleSubmitMitraMagang}
                  className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-black text-[#1b274b]">
                        {editingMitraMagang ? "Edit Mitra Magang" : "Tambah Mitra Magang"}
                      </h3>
                      <p className="mt-1 text-sm text-[#5d6c91]">
                        Data aktif akan muncul sebagai pilihan institusi pada form pengajuan magang mahasiswa.
                      </p>
                    </div>
                    {editingMitraMagang ? (
                      <button
                        type="button"
                        onClick={handleBackFromMitraMagangForm}
                        disabled={savingMitraMagang}
                        className="inline-flex items-center gap-2 rounded-lg border border-[#d3dbef] px-3 py-2 text-sm font-semibold text-[#27407b] transition hover:bg-[#f3f6ff] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <X className="h-4 w-4" />
                        Batal Edit
                      </button>
                    ) : null}
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-[#344b7f]">
                        Nama Mitra <span className="text-[#dc4b4b]">*</span>
                      </label>
                      <input
                        type="text"
                        name="nama"
                        value={mitraMagangForm.nama}
                        onChange={handleMitraMagangInputChange}
                        maxLength={180}
                        placeholder="Contoh: PT Contoh Teknologi"
                        aria-invalid={Boolean(mitraMagangFormErrors.nama)}
                        aria-describedby={mitraMagangFormErrors.nama ? "mitra-nama-error" : undefined}
                        className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 ${
                          mitraMagangFormErrors.nama
                            ? "border-[#dc4b4b] bg-[#fff7f7] focus:border-[#dc4b4b] focus:ring-[#dc4b4b]/15"
                            : "border-[#d3dbef] focus:border-[#2f63e3] focus:ring-[#2f63e3]/15"
                        }`}
                      />
                      {mitraMagangFormErrors.nama ? (
                        <p id="mitra-nama-error" className="mt-1 text-xs font-semibold text-[#c23737]">
                          {mitraMagangFormErrors.nama}
                        </p>
                      ) : null}
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-[#344b7f]">
                        Bidang / Jenis <span className="text-[#dc4b4b]">*</span>
                      </label>
                      <input
                        type="text"
                        name="bidang_jenis"
                        value={mitraMagangForm.bidang_jenis}
                        onChange={handleMitraMagangInputChange}
                        maxLength={180}
                        placeholder="Software house, startup, BUMN..."
                        aria-invalid={Boolean(mitraMagangFormErrors.bidang_jenis)}
                        aria-describedby={mitraMagangFormErrors.bidang_jenis ? "mitra-bidang-error" : undefined}
                        className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 ${
                          mitraMagangFormErrors.bidang_jenis
                            ? "border-[#dc4b4b] bg-[#fff7f7] focus:border-[#dc4b4b] focus:ring-[#dc4b4b]/15"
                            : "border-[#d3dbef] focus:border-[#2f63e3] focus:ring-[#2f63e3]/15"
                        }`}
                      />
                      {mitraMagangFormErrors.bidang_jenis ? (
                        <p id="mitra-bidang-error" className="mt-1 text-xs font-semibold text-[#c23737]">
                          {mitraMagangFormErrors.bidang_jenis}
                        </p>
                      ) : null}
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-[#344b7f]">
                        Lokasi <span className="text-[#dc4b4b]">*</span>
                      </label>
                      <input
                        type="text"
                        name="lokasi"
                        value={mitraMagangForm.lokasi}
                        onChange={handleMitraMagangInputChange}
                        maxLength={180}
                        placeholder="Kota / alamat ringkas"
                        aria-invalid={Boolean(mitraMagangFormErrors.lokasi)}
                        aria-describedby={mitraMagangFormErrors.lokasi ? "mitra-lokasi-error" : undefined}
                        className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 ${
                          mitraMagangFormErrors.lokasi
                            ? "border-[#dc4b4b] bg-[#fff7f7] focus:border-[#dc4b4b] focus:ring-[#dc4b4b]/15"
                            : "border-[#d3dbef] focus:border-[#2f63e3] focus:ring-[#2f63e3]/15"
                        }`}
                      />
                      {mitraMagangFormErrors.lokasi ? (
                        <p id="mitra-lokasi-error" className="mt-1 text-xs font-semibold text-[#c23737]">
                          {mitraMagangFormErrors.lokasi}
                        </p>
                      ) : null}
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-[#344b7f]">Email Kontak</label>
                      <input
                        type="email"
                        name="email_kontak"
                        value={mitraMagangForm.email_kontak}
                        onChange={handleMitraMagangInputChange}
                        maxLength={180}
                        placeholder="hr@mitra.co.id"
                        className="w-full rounded-lg border border-[#d3dbef] px-3 py-2 text-sm outline-none focus:border-[#2f63e3] focus:ring-2 focus:ring-[#2f63e3]/15"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-[#344b7f]">Website</label>
                      <input
                        type="text"
                        name="website"
                        value={mitraMagangForm.website}
                        onChange={handleMitraMagangInputChange}
                        maxLength={255}
                        placeholder="https://..."
                        className="w-full rounded-lg border border-[#d3dbef] px-3 py-2 text-sm outline-none focus:border-[#2f63e3] focus:ring-2 focus:ring-[#2f63e3]/15"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-[#344b7f]">Posisi Magang</label>
                      <input
                        type="text"
                        name="posisi_magang"
                        value={mitraMagangForm.posisi_magang}
                        onChange={handleMitraMagangInputChange}
                        maxLength={180}
                        placeholder="Contoh: Frontend Developer, QA Tester"
                        className="w-full rounded-lg border border-[#d3dbef] px-3 py-2 text-sm outline-none focus:border-[#2f63e3] focus:ring-2 focus:ring-[#2f63e3]/15"
                      />
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="max-w-md">
                      <label className="mb-1 block text-sm font-semibold text-[#344b7f]">
                        Quota Magang <span className="text-[#dc4b4b]">*</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="99"
                        step="1"
                        inputMode="numeric"
                        name="quota_magang"
                        value={mitraMagangForm.quota_magang}
                        onChange={(event) => handleMitraMagangQuotaChange(event.target.value)}
                        placeholder="Contoh: 3"
                        aria-invalid={Boolean(mitraMagangFormErrors.quota_magang)}
                        aria-describedby={mitraMagangFormErrors.quota_magang ? "mitra-quota-error" : undefined}
                        className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 ${
                          mitraMagangFormErrors.quota_magang
                            ? "border-[#dc4b4b] bg-[#fff7f7] focus:border-[#dc4b4b] focus:ring-[#dc4b4b]/15"
                            : "border-[#d3dbef] focus:border-[#2f63e3] focus:ring-[#2f63e3]/15"
                        }`}
                      />
                      {mitraMagangFormErrors.quota_magang ? (
                        <p id="mitra-quota-error" className="mt-1 text-xs font-semibold text-[#c23737]">
                          {mitraMagangFormErrors.quota_magang}
                        </p>
                      ) : null}
                    </div>
                    <div className="mt-3 max-w-md">
                      <label className="mb-1 block text-sm font-semibold text-[#344b7f]">
                        Status <span className="text-[#dc4b4b]">*</span>
                      </label>
                      <div className="flex h-[38px] items-center gap-3">
                        <button
                          type="button"
                          role="switch"
                          aria-label="Status mitra magang"
                          aria-checked={mitraMagangForm.status === "active"}
                          aria-describedby={mitraMagangFormErrors.status ? "mitra-status-error" : undefined}
                          title={mitraMagangForm.status === "active" ? "Aktif" : "Nonaktif"}
                          onClick={handleToggleMitraMagangStatus}
                          className={`inline-flex h-8 w-14 items-center rounded-full border px-1 transition ${
                            mitraMagangFormErrors.status
                              ? "border-[#dc4b4b] bg-[#fff7f7]"
                              : mitraMagangForm.status === "active"
                              ? "border-[#2f63e3] bg-[#2f63e3]"
                              : "border-[#c7cfdf] bg-[#c7cfdf]"
                          }`}
                        >
                          <span
                            className={`inline-block h-6 w-6 rounded-full bg-white shadow transition ${
                              mitraMagangForm.status === "active" ? "translate-x-6" : "translate-x-0"
                            }`}
                          />
                        </button>
                        <span className="text-sm font-semibold text-[#344b7f]">
                          {mitraMagangForm.status === "active" ? "Aktif" : "Nonaktif"}
                        </span>
                      </div>
                      {mitraMagangFormErrors.status ? (
                        <p id="mitra-status-error" className="mt-1 text-xs font-semibold text-[#c23737]">
                          {mitraMagangFormErrors.status}
                        </p>
                      ) : null}
                    </div>
                    <div className="mt-3">
                      <label className="mb-1 block text-sm font-semibold text-[#344b7f]">Kriteria</label>
                      <textarea
                        name="kriteria"
                        rows={5}
                        value={mitraMagangForm.kriteria}
                        onChange={handleMitraMagangInputChange}
                        placeholder="Kriteria mahasiswa yang diterima perusahaan."
                        className="w-full rounded-lg border border-[#d3dbef] px-3 py-2 text-sm outline-none focus:border-[#2f63e3] focus:ring-2 focus:ring-[#2f63e3]/15"
                      />
                    </div>
                    <div className="mt-3">
                      <label className="mb-1 block text-sm font-semibold text-[#344b7f]">
                        Prosedur dari Perusahaan
                      </label>
                      <textarea
                        name="prosedur_perusahaan"
                        rows={5}
                        value={mitraMagangForm.prosedur_perusahaan}
                        onChange={handleMitraMagangInputChange}
                        placeholder="Prosedur apply atau tahapan dari perusahaan."
                        className="w-full rounded-lg border border-[#d3dbef] px-3 py-2 text-sm outline-none focus:border-[#2f63e3] focus:ring-2 focus:ring-[#2f63e3]/15"
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={resetMitraMagangForm}
                      disabled={savingMitraMagang}
                      className="inline-flex items-center gap-2 rounded-lg border border-[#d3dbef] px-4 py-2 text-sm font-semibold text-[#27407b] transition hover:bg-[#f3f6ff] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <X className="h-4 w-4" />
                      Reset
                    </button>
                    <button
                      type="submit"
                      disabled={savingMitraMagang}
                      className="inline-flex items-center gap-2 rounded-lg bg-[#2f63e3] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {editingMitraMagang ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                      {savingMitraMagang
                        ? "Menyimpan..."
                        : editingMitraMagang
                        ? "Simpan Perubahan"
                        : "Tambah Mitra"}
                    </button>
                  </div>
                </form>
                ) : null}

                {mitraMagangMode === "list" ? (
                  <>
                <div className="rounded-xl border border-[#e4e9f6] bg-white p-3 shadow-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab("dashboard")}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#d3dbef] text-[#27407b] transition hover:bg-[#f3f6ff]"
                      title="Kembali"
                      aria-label="Kembali"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={loadAllData}
                      className="inline-flex items-center gap-2 rounded-lg border border-[#d3dbef] px-4 py-2 text-sm font-semibold text-[#27407b] transition hover:bg-[#f3f6ff]"
                    >
                      <RefreshCcw className="h-4 w-4" />
                      Refresh
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenAddMitraMagang}
                      className="inline-flex items-center gap-2 rounded-lg border border-[#d3dbef] px-4 py-2 text-sm font-semibold text-[#27407b] transition hover:bg-[#f3f6ff]"
                    >
                      <Plus className="h-4 w-4" />
                      Add
                    </button>
                  </div>
                </div>

                <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-black text-[#1b274b]">Grid Mitra Magang</h3>
                      <p className="mt-1 text-sm text-[#5d6c91]">
                        Menampilkan master data mitra magang beserta status aktifnya.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={mitraMagangStatusFilter}
                        onChange={(event) => setMitraMagangStatusFilter(event.target.value)}
                        className="rounded-lg border border-[#d3dbef] px-3 py-2 text-sm font-semibold text-[#27407b] outline-none focus:border-[#2f63e3]"
                      >
                        {MITRA_MAGANG_STATUS_FILTER_OPTIONS.map((option) => (
                          <option key={`mitra-filter-${option.value}`} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7282a8]" />
                        <input
                          type="text"
                          value={mitraMagangQuery}
                          onChange={(event) => setMitraMagangQuery(event.target.value)}
                          placeholder="Cari nama, bidang, lokasi, kontak..."
                          className="w-[320px] max-w-full rounded-lg border border-[#d3dbef] py-2 pl-8 pr-3 text-sm outline-none focus:border-[#2f63e3]"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={loadAllData}
                        className="inline-flex items-center gap-2 rounded-lg border border-[#d3dbef] px-3 py-2 text-sm font-semibold text-[#27407b] transition hover:bg-[#f3f6ff]"
                      >
                        <RefreshCcw className="h-4 w-4" />
                        Refresh
                      </button>
                    </div>
                  </div>

                  <div className="relative mt-1 min-h-0 flex-1 overflow-auto rounded-lg border border-[#e6ecf8] grid-unified-height">
                    <table className="w-full min-w-[2080px] table-fixed text-left text-sm">
                      <colgroup>
                        <col style={{ width: "56px" }} />
                        <col style={{ width: "250px" }} />
                        <col style={{ width: "190px" }} />
                        <col style={{ width: "190px" }} />
                        <col style={{ width: "220px" }} />
                        <col style={{ width: "250px" }} />
                        <col style={{ width: "180px" }} />
                        <col style={{ width: "170px" }} />
                        <col style={{ width: "260px" }} />
                        <col style={{ width: "300px" }} />
                        <col style={{ width: "120px" }} />
                        <col style={{ width: "170px" }} />
                        <col style={{ width: "170px" }} />
                        <col style={{ width: "170px" }} />
                      </colgroup>
                      <thead>
                        <tr className="border-y border-[#e6ecf8] text-[#4d5e89]">
                          <th className="bg-[#f8fbff] px-3 py-2 font-semibold whitespace-nowrap">No</th>
                          <th className="bg-[#f8fbff] px-3 py-2 font-semibold whitespace-nowrap">Nama Mitra</th>
                          <th className="bg-[#f8fbff] px-3 py-2 font-semibold whitespace-nowrap">Bidang / Jenis</th>
                          <th className="bg-[#f8fbff] px-3 py-2 font-semibold whitespace-nowrap">Lokasi</th>
                          <th className="bg-[#f8fbff] px-3 py-2 font-semibold whitespace-nowrap">Email Kontak</th>
                          <th className="bg-[#f8fbff] px-3 py-2 font-semibold whitespace-nowrap">Website</th>
                          <th className="bg-[#f8fbff] px-3 py-2 font-semibold whitespace-nowrap">Posisi Magang</th>
                          <th className="bg-[#f8fbff] px-3 py-2 font-semibold whitespace-nowrap">Quota Magang</th>
                          <th className="bg-[#f8fbff] px-3 py-2 font-semibold whitespace-nowrap">Kriteria</th>
                          <th className="bg-[#f8fbff] px-3 py-2 font-semibold whitespace-nowrap">
                            Prosedur dari Perusahaan
                          </th>
                          <th className="bg-[#f8fbff] px-3 py-2 font-semibold whitespace-nowrap">Status</th>
                          <th className="bg-[#f8fbff] px-3 py-2 font-semibold whitespace-nowrap">Dibuat</th>
                          <th className="bg-[#f8fbff] px-3 py-2 font-semibold whitespace-nowrap">Diperbarui</th>
                          <th className="bg-[#f8fbff] px-3 py-2 font-semibold whitespace-nowrap">Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedMitraMagangRows.length > 0
                          ? pagedMitraMagangRows.map((row, index) => {
                              const nomorUrut = mitraMagangRangeStart + index;
                              const isActive = row?.is_active !== false && row?.status !== "inactive";
                              const isBusy = deletingMitraMagangId === row.id;
                              return (
                                <tr key={`mitra-magang-${row.id}`} className="border-b border-[#eff3fb] align-top">
                                  <td className="px-3 py-2 font-semibold text-[#254080] whitespace-nowrap">
                                    {nomorUrut}
                                  </td>
                                  <td className="px-3 py-2">
                                    <p className="font-semibold text-[#1f2d53] break-words">{row.nama || "-"}</p>
                                  </td>
                                  <td className="px-3 py-2 text-[#2f426f] break-words">
                                    {row.bidang_jenis || "-"}
                                  </td>
                                  <td className="px-3 py-2 text-[#2f426f] break-words">{row.lokasi || "-"}</td>
                                  <td className="px-3 py-2 text-[#2f426f] break-words">
                                    {row.email_kontak || "-"}
                                  </td>
                                  <td className="px-3 py-2 text-[#2f426f] break-words">
                                    {row.website ? (
                                      <a
                                        href={row.website}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="font-semibold text-[#2f63e3] hover:underline"
                                      >
                                        {row.website}
                                      </a>
                                    ) : (
                                      "-"
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-[#2f426f] break-words">
                                    {row.posisi_magang || "-"}
                                  </td>
                                  <td className="px-3 py-2 text-[#2f426f] break-words">
                                    {row.quota_magang ?? "-"}
                                  </td>
                                  <td className="px-3 py-2 text-[#2f426f] break-words">
                                    {row.kriteria || "-"}
                                  </td>
                                  <td className="px-3 py-2 text-[#2f426f] break-words">
                                    {row.prosedur_perusahaan || "-"}
                                  </td>
                                  <td className="px-3 py-2">
                                    <span
                                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${
                                        isActive
                                          ? "bg-[#e8f7ef] text-[#137748]"
                                          : "bg-[#f1f3f8] text-[#6d7898]"
                                      }`}
                                    >
                                      {isActive ? "Aktif" : "Nonaktif"}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 text-[#43537d] whitespace-nowrap">
                                    {formatDateTime(row.createdAt)}
                                  </td>
                                  <td className="px-3 py-2 text-[#43537d] whitespace-nowrap">
                                    {formatDateTime(row.updatedAt)}
                                  </td>
                                  <td className="px-3 py-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <button
                                        type="button"
                                        disabled={!isActive || savingMitraMagang || isBusy}
                                        onClick={() => handleEditMitraMagang(row)}
                                        className="inline-flex items-center gap-1 rounded-md bg-[#2f63e3] px-3 py-1.5 text-xs font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                        Edit
                                      </button>
                                      <button
                                        type="button"
                                        disabled={!isActive || isBusy}
                                        onClick={() => handleDeactivateMitraMagang(row)}
                                        className="inline-flex items-center gap-1 rounded-md bg-[#b73a3a] px-3 py-1.5 text-xs font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                        {isBusy ? "Proses..." : "Nonaktifkan"}
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          : null}
                      </tbody>
                    </table>
                    {filteredMitraMagangRows.length === 0 ? (
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[41px] flex items-center justify-center px-4 text-center text-sm font-semibold text-[#7b88ab]">
                        Data mitra magang tidak ditemukan.
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#e8edf8] pt-3">
                    <p className="text-sm text-[#4f5e86]">
                      Menampilkan {mitraMagangRangeStart} - {mitraMagangRangeEnd} dari{" "}
                      {filteredMitraMagangRows.length} data mitra magang.
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setMitraMagangPage((prev) => Math.max(1, prev - 1))}
                        disabled={mitraMagangPage === 1}
                        className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] transition hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Sebelumnya
                      </button>
                      <span className="text-sm font-semibold text-[#314778]">
                        Halaman {mitraMagangPage} / {totalMitraMagangPages}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setMitraMagangPage((prev) => Math.min(totalMitraMagangPages, prev + 1))
                        }
                        disabled={mitraMagangPage >= totalMitraMagangPages}
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
                        onClick={async () => {
                          if (item.key !== masterDosenTab && !(await confirmAvailabilityDraftDiscard())) return;
                          if (item.key !== "tindak-lanjut" && dosenStatusFollowUpDetailRow) {
                            handleBackFromDosenStatusFollowUpPage();
                          }
                          setMasterDosenTab(item.key);
                        }}
                        className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                          masterDosenTab === item.key
                            ? "border-[#2f63e3] bg-[#2f63e3] text-white"
                            : "border-[#d3dbef] text-[#345087] hover:bg-[#f4f7ff]"
                        }`}
                      >
                        {item.label}
                        {item.key === "tindak-lanjut" && dosenStatusFollowUps.length > 0 ? (
                          <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-black ${masterDosenTab === item.key ? "bg-white/20 text-white" : "bg-[#fff1df] text-[#a15b18]"}`}>
                            {dosenStatusFollowUps.length}
                          </span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-[#dce4f7] bg-white p-3 shadow-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        if (masterDosenTab === "tindak-lanjut" && dosenStatusFollowUpDetailRow) {
                          handleBackFromDosenStatusFollowUpPage();
                        } else if (masterDosenTab !== "penanggung-jawab") {
                          if (!(await confirmAvailabilityDraftDiscard())) return;
                          setMasterDosenTab("penanggung-jawab");
                        } else {
                          if (!(await confirmAvailabilityDraftDiscard())) return;
                          setActiveTab("dashboard");
                        }
                      }}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#d3dbef] text-[#27407b] transition hover:bg-[#f3f6ff]"
                      title="Kembali"
                      aria-label="Kembali"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (masterDosenTab === "tindak-lanjut" && dosenStatusFollowUpDetailRow) {
                          loadDosenStatusFollowUpPage(dosenStatusFollowUpDetailRow);
                        } else if (masterDosenTab === "ketersediaan-periode") {
                          requestDosenPeriodAvailabilityRefresh({ manual: true });
                        } else if (masterDosenTab === "riwayat-penetapan") {
                          loadSupervisorAssignmentMonitoring({
                            page: supervisorAssignmentPage,
                            filters: supervisorAssignmentFilters,
                          });
                        } else {
                          loadAllData();
                        }
                      }}
                      disabled={Boolean(dosenStatusFollowUpDetailRow && loadingDosenStatusFollowUpDetail)}
                      className="inline-flex items-center gap-2 rounded-lg border border-[#d3dbef] px-3 py-2 text-sm font-semibold text-[#27407b] transition hover:bg-[#f3f6ff] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <RefreshCcw className="h-4 w-4" />
                      Refresh
                    </button>
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
                                    searchResults.map((dosen) => (
                                        <button
                                          key={`master-dosen-ketua-${item.code}-${dosen.id}`}
                                          type="button"
                                          onMouseDown={(event) => event.preventDefault()}
                                          onClick={() => handleSelectPeriodeMasterDosen(item.key, dosen)}
                                          className="flex w-full items-center justify-between gap-3 border-b border-[#edf1fb] px-3 py-2 text-left text-sm text-[#213460] last:border-b-0 hover:bg-[#f4f7ff]"
                                        >
                                          <span className="font-semibold">{formatDosenFullName(dosen.nama, dosen.gelar) || "-"}</span>
                                          <span className="text-right text-xs text-[#5d6c91]">NIK: {dosen.nik || "-"}</span>
                                        </button>
                                      ))
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
                            <label className="mb-1 block text-sm font-semibold text-[#344b7f]">
                              {item.label}{item.requiredForRelease === false ? " (opsional / jalur hold)" : ""}
                            </label>
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
                                    searchResults.map((dosen) => (
                                        <button
                                          key={`master-dosen-${item.key}-${dosen.id}`}
                                          type="button"
                                          onMouseDown={(event) => event.preventDefault()}
                                          onClick={() => handleSelectPeriodeMasterDosen(item.key, dosen)}
                                          className="flex w-full items-center justify-between gap-3 border-b border-[#edf1fb] px-3 py-2 text-left text-sm text-[#213460] last:border-b-0 hover:bg-[#f4f7ff]"
                                        >
                                          <span className="font-semibold">{formatDosenFullName(dosen.nama, dosen.gelar) || "-"}</span>
                                          <span className="text-right text-xs text-[#5d6c91]">NIK: {dosen.nik || "-"}</span>
                                        </button>
                                      ))
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
                          type="text"
                          inputMode="numeric"
                          maxLength={2}
                          value={masterDosenKuotaValue}
                          onChange={(event) => setMasterDosenKuotaValue(sanitizeTwoDigitPositiveNumber(event.target.value))}
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
                        <table className="w-full min-w-[1650px] text-left text-sm">
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
                              <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Mahasiswa Bimbingan (Total)</th>
                              <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Rincian Jalur</th>
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
                                        <p className="font-semibold text-[#1f3160]">{formatDosenFullName(row.nama, row.gelar) || "-"}</p>
                                        <p className="text-xs text-[#6a779a]">{row.email || "-"}</p>
                                      </td>
                                      <td className="px-3 py-2">{row.jabatan_struktural || "-"}</td>
                                      <td className="px-3 py-2">{row.kuota?.total ?? 0}</td>
                                      <td className="px-3 py-2">{row.kuota?.terpakai ?? 0}</td>
                                      <td className="px-3 py-2 text-xs leading-5 text-[#526184]">
                                        <span className="whitespace-nowrap">Penelitian: <b>{row.kuota?.rincian_jalur?.penelitian ?? 0}</b></span>{" · "}
                                        <span className="whitespace-nowrap">Magang: <b>{row.kuota?.rincian_jalur?.magang ?? 0}</b></span>{" · "}
                                        <span className="whitespace-nowrap">Perintisan: <b>{row.kuota?.rincian_jalur?.perintisan_bisnis ?? 0}</b></span>{" · "}
                                        <span className="whitespace-nowrap">Pengabdian: <b>{row.kuota?.rincian_jalur?.pengabdian_masyarakat ?? 0}</b></span>
                                      </td>
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

                {masterDosenTab === "ketersediaan-periode" ? (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                      <div className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-black text-[#1b274b]">Ketersediaan Dosen per Periode Penjaluran</h3>
                          <p className="text-sm text-[#5d6c91]">Status master tetap ditetapkan Admin. Pengaturan ini hanya berlaku pada periode yang dipilih.</p>
                        </div>
                        <div className="flex flex-wrap items-end gap-2">
                          <div>
                            <label className="mb-1 block text-xs font-bold text-[#526184]">Periode penjaluran</label>
                            <select
                              value={dosenPeriodAvailability.periode?.id || ""}
                              onChange={(event) => requestDosenPeriodAvailabilityRefresh({
                                periodeId: event.target.value,
                              })}
                              disabled={refreshingDosenPeriodAvailability}
                              className="min-w-[260px] rounded-lg border border-[#d3dbef] px-3 py-2 text-sm outline-none focus:border-[#2f63e3] disabled:cursor-wait disabled:opacity-60"
                            >
                              {dosenPeriodAvailability.periodes.map((periode) => (
                                <option key={periode.id} value={periode.id}>{periode.label_periode} · {formatLabel(periode.status)}</option>
                              ))}
                            </select>
                          </div>
                          <button
                            type="button"
                            onClick={() => requestDosenPeriodAvailabilityRefresh({
                              periodeId: dosenPeriodAvailability.periode?.id,
                              manual: true,
                            })}
                            disabled={refreshingDosenPeriodAvailability}
                            className="inline-flex items-center gap-2 rounded-lg border border-[#d3dbef] bg-white px-3 py-2 text-sm font-semibold text-[#27407b] transition hover:bg-[#f3f6ff] disabled:cursor-wait disabled:opacity-60"
                          >
                            <RefreshCcw className={`h-4 w-4 ${refreshingDosenPeriodAvailability ? "animate-spin" : ""}`} />
                            Refresh Status Dosen
                          </button>
                        </div>
                      </div>
                      {dosenPeriodAvailability.is_readonly ? (
                        <div className="mt-3 rounded-lg border border-[#d9e1f2] bg-[#f7f9fd] px-3 py-2 text-sm font-semibold text-[#596887]">
                          Periode sudah ditutup. Konfigurasi ditampilkan sebagai riwayat dan tidak dapat diubah.
                        </div>
                      ) : null}
                      {dosenPeriodAvailability.readiness ? (
                        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                          {[
                            ["Siap", dosenPeriodAvailability.readiness.counts?.ready || 0, "border-[#cce8d8] bg-[#f0fbf5] text-[#127947]"],
                            ["Perlu Ditinjau", dosenPeriodAvailability.readiness.counts?.needs_review || 0, "border-[#f0d3a5] bg-[#fff8ed] text-[#a15b18]"],
                            ["Dikunci Admin", dosenPeriodAvailability.readiness.counts?.locked_by_master_status || 0, "border-[#d9e1f2] bg-[#f7f9fd] text-[#596887]"],
                            ["Kesiapan Aktivasi", dosenPeriodAvailability.readiness.ready ? "Siap" : "Belum Siap", dosenPeriodAvailability.readiness.ready ? "border-[#cce8d8] bg-[#f0fbf5] text-[#127947]" : "border-[#f0c6c6] bg-[#fff4f4] text-[#a03f3f]"],
                          ].map(([label, value, style]) => (
                            <div key={label} className={`rounded-lg border p-3 ${style}`}>
                              <p className="text-xs font-bold uppercase">{label}</p>
                              <p className="mt-1 text-xl font-black">{value}</p>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#dbe4f6] bg-[#f8fbff] p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7282a8]" />
                            <input
                              type="search"
                              value={dosenPeriodAvailabilityQuery}
                              onChange={(event) => {
                                setDosenPeriodAvailabilityQuery(event.target.value);
                                setDosenPeriodAvailabilityPage(1);
                              }}
                              placeholder="Cari nama atau kode dosen..."
                              aria-label="Cari dosen pada ketersediaan periode"
                              className="w-[280px] rounded-lg border border-[#d3dbef] bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[#2f63e3]"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={selectAllEditableAvailability}
                            disabled={dosenPeriodAvailability.is_readonly || savingBulkAvailability}
                            className="rounded-lg border border-[#d3dbef] bg-white px-3 py-2 text-xs font-bold text-[#27407b] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Pilih Semua Dosen
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedAvailabilityDosenIds([])}
                            disabled={selectedAvailabilityDosenIds.length === 0 || savingBulkAvailability}
                            className="rounded-lg border border-[#d3dbef] bg-white px-3 py-2 text-xs font-bold text-[#596887] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Hapus Pilihan
                          </button>
                          <span className="text-xs font-bold text-[#526184]">{selectedAvailabilityDosenIds.length} dosen dipilih</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={handleMarkSelectedNotInvolved}
                            disabled={dosenPeriodAvailability.is_readonly || savingBulkAvailability || selectedAvailabilityDosenIds.length === 0}
                            className="rounded-lg bg-[#b45309] px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Tandai Tidak Menerima
                          </button>
                          <button
                            type="button"
                            onClick={handleMarkSelectedReceiving}
                            disabled={dosenPeriodAvailability.is_readonly || savingBulkAvailability || selectedAvailabilityDosenIds.length === 0}
                            className="rounded-lg bg-[#117246] px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {savingBulkAvailability ? "Menyimpan..." : "Tandai Menerima"}
                          </button>
                        </div>
                      </div>
                      <div className="overflow-auto rounded-lg border border-[#e6ecf8]">
                        <table className="w-full min-w-[1120px] text-left text-sm">
                          <thead><tr className="border-b border-[#e6ecf8] text-[#4d5e89]">
                            <th className="bg-[#f8fbff] px-3 py-2 text-center">Pilih</th>
                            <th className="bg-[#f8fbff] px-3 py-2">Dosen</th>
                            <th className="bg-[#f8fbff] px-3 py-2">Status Master Saat Ini</th>
                            <th className="bg-[#f8fbff] px-3 py-2">Status Konfigurasi</th>
                            <th className="bg-[#f8fbff] px-3 py-2 text-center">Menerima Bimbingan Baru</th>
                            <th className="bg-[#f8fbff] px-3 py-2">Kapasitas Saat Ini</th>
                          </tr></thead>
                          <tbody>
                            {pagedDosenPeriodAvailabilityRows.map((row) => {
                              const isActive = row.status_keaktifan === "active";
                              const canEdit = row.can_edit === true && !dosenPeriodAvailability.is_readonly;
                              const configurationMeta = {
                                ready: ["Siap", "bg-[#e8f8ef] text-[#127947]"],
                                needs_review: ["Perlu Ditinjau", "bg-[#fff1df] text-[#a15b18]"],
                                locked_by_master_status: ["Dikunci Admin", "bg-[#edf0f6] text-[#596887]"],
                              }[row.configuration_status] || [row.configuration_status || "Perlu Ditinjau", "bg-[#fff1df] text-[#a15b18]"];
                              return (
                                <tr key={`availability-${row.id}`} className="border-b border-[#eff3fb]">
                                  <td className="px-3 py-2 text-center"><input type="checkbox" checked={selectedAvailabilityDosenIds.some((id) => Number(id) === Number(row.id))} disabled={!canEdit || savingBulkAvailability} onChange={() => toggleAvailabilitySelection(row.id)} aria-label={`Pilih ${row.nama}`} className="h-4 w-4 accent-[#2f63e3]" /></td>
                                  <td className="px-3 py-2"><p className="font-bold text-[#1f3160]">{formatDosenFullName(row.nama, row.gelar)}</p><p className="text-xs text-[#6a779a]">{row.kode_dosen || row.nik || "-"}</p></td>
                                  <td className="px-3 py-2"><span className={`rounded-full px-2 py-1 text-xs font-bold ${isActive ? "bg-[#e8f8ef] text-[#127947]" : "bg-[#fff1df] text-[#a15b18]"}`}>{DOSEN_MASTER_STATUS_LABELS[row.status_keaktifan] || row.status_keaktifan}</span></td>
                                  <td className="px-3 py-2"><span className={`whitespace-nowrap rounded-full px-2 py-1 text-xs font-bold ${configurationMeta[1]}`}>{configurationMeta[0]}</span>{row.review_note ? <p className="mt-1 max-w-[220px] text-xs text-[#6a779a]">{row.review_note}</p> : null}</td>
                                  <td className="px-3 py-2 text-center"><input type="checkbox" checked={Boolean(row.tersedia_membimbing)} disabled={!canEdit || savingBulkAvailability} onChange={(event) => updateDosenAvailabilityDraft(row.id, { tersedia_membimbing: event.target.checked, configuration_status: "ready" })} className="h-4 w-4 accent-[#2f63e3]" /></td>
                                  <td className="px-3 py-2"><p className="font-bold text-[#1f3160]">{Number(row.terpakai || 0)} / {Number(row.kuota || 0)}</p><p className="text-xs text-[#6a779a]">Sisa {Number(row.sisa || 0)}</p></td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        {filteredDosenPeriodAvailabilityRows.length === 0 ? (
                          <p className="p-8 text-center text-sm font-semibold text-[#7b88ab]">
                            {dosenPeriodAvailability.dosens.length === 0
                              ? "Belum ada periode atau data dosen."
                              : "Dosen yang dicari tidak ditemukan."}
                          </p>
                        ) : null}
                      </div>
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#e8edf8] pt-3">
                        <p className="text-sm text-[#4f5e86]">
                          Menampilkan {dosenPeriodAvailabilityRangeStart} - {dosenPeriodAvailabilityRangeEnd} dari {filteredDosenPeriodAvailabilityRows.length} dosen.
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setDosenPeriodAvailabilityPage((previous) => Math.max(1, previous - 1))}
                            disabled={dosenPeriodAvailabilityPage === 1 || savingBulkAvailability}
                            className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Sebelumnya
                          </button>
                          <span className="text-sm font-semibold text-[#314778]">
                            Halaman {dosenPeriodAvailabilityPage} / {totalDosenPeriodAvailabilityPages}
                          </span>
                          <button
                            type="button"
                            onClick={() => setDosenPeriodAvailabilityPage((previous) => Math.min(totalDosenPeriodAvailabilityPages, previous + 1))}
                            disabled={dosenPeriodAvailabilityPage >= totalDosenPeriodAvailabilityPages || savingBulkAvailability}
                            className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Berikutnya
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveDosenAvailabilityChanges}
                            disabled={dosenPeriodAvailability.is_readonly || dirtyAvailabilityDosenIds.length === 0 || savingBulkAvailability}
                            className="ml-1 rounded-lg bg-[#117246] px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {savingBulkAvailability ? "Menyimpan..." : `Simpan Perubahan${dirtyAvailabilityDosenIds.length ? ` (${dirtyAvailabilityDosenIds.length})` : ""}`}
                          </button>
                        </div>
                      </div>
                    </div>

                    {false ? <div className="rounded-xl border border-[#f0d3a5] bg-[#fffaf1] p-4 shadow-sm">
                      <h3 className="text-lg font-black text-[#68400f]">Tindak Lanjut Perubahan Status</h3>
                      <p className="text-sm text-[#805c2d]">Keputusan penggantian pembimbing dan penyesuaian tugas dilakukan manual oleh Sekprodi.</p>
                      <div className="mt-3 grid gap-3 lg:grid-cols-2">
                        {dosenStatusFollowUps.map((row) => {
                          const impact = row.impact_snapshot || {};
                          return <div key={row.id} className="rounded-lg border border-[#efd8b5] bg-white p-3 text-sm">
                            <div className="flex items-start justify-between gap-3"><div><p className="font-black text-[#29385f]">{formatDosenFullName(row.dosen?.nama, row.dosen?.gelar) || "Dosen"}</p><p className="text-xs text-[#6d7896]">Status: {DOSEN_MASTER_STATUS_LABELS[row.dosen?.status_keaktifan] || row.dosen?.status_keaktifan}</p></div><button type="button" onClick={() => handleOpenDosenStatusFollowUpPage(row)} className="rounded-lg bg-[#2f63e3] px-3 py-1.5 text-xs font-bold text-white">Proses</button></div>
                            <p className="mt-2 text-[#596887]">{Number(impact.mahasiswa_bimbingan_aktif || 0)} mahasiswa aktif · {Number(impact.review_pending || 0)} review · {Number(impact.jadwal_sidang_mendatang || 0)} jadwal sidang</p>
                            {impact.reactivation_required ? <p className="mt-2 rounded-md bg-[#eef3ff] px-2 py-1 text-xs font-semibold text-[#34549b]">Reaktivasi: periksa topik lama, ketersediaan periode, kapasitas, dan penetapan kembali peran.</p> : null}
                          </div>;
                        })}
                        {dosenStatusFollowUps.length === 0 ? <p className="text-sm font-semibold text-[#6f7c9c]">Tidak ada tindak lanjut terbuka.</p> : null}
                      </div>
                    </div> : null}
                  </div>
                ) : null}

                {masterDosenTab === "riwayat-penetapan" ? (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-[#dbe5fb] bg-[#f8fbff] p-4 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div><h3 className="text-lg font-black text-[#1b274b]">Carry-forward Semester Berikutnya</h3><p className="text-sm text-[#5d6c91]">Preview mencakup semester 1→2 dan tindak lanjut kelompok semester 2→3; konfirmasi selalu memvalidasi ulang assignment, izin, dan status dosen.</p></div>
                        {semesterTransitionPreview?.target_period ? <span className="rounded-full bg-[#e9f0ff] px-3 py-1 text-xs font-bold text-[#34549b]">Tujuan: {semesterTransitionPreview.target_period.label_periode}</span> : null}
                      </div>
                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        <select value={semesterTransitionForm.source_period_id} onChange={(event) => { setSemesterTransitionForm((previous) => ({ ...previous, source_period_id: event.target.value })); setSemesterTransitionPreview(null); setSelectedSemesterTransitions([]); }} className="rounded-lg border border-[#cdd8ef] bg-white px-3 py-2 text-sm"><option value="">Pilih periode sumber</option>{supervisorAssignmentMonitoring.filter_options.periodes.map((periode) => <option key={`transition-period-${periode.id}`} value={periode.id}>{periode.label_periode}</option>)}</select>
                        <input type="datetime-local" value={semesterTransitionForm.effective_at} onChange={(event) => setSemesterTransitionForm((previous) => ({ ...previous, effective_at: event.target.value }))} className="rounded-lg border border-[#cdd8ef] bg-white px-3 py-2 text-sm" aria-label="Waktu efektif transisi" />
                        <button type="button" onClick={loadSemesterTransitionPreview} disabled={loadingSemesterTransition} className="rounded-lg bg-[#315fc5] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{loadingSemesterTransition ? "Memproses..." : "Preview kandidat"}</button>
                      </div>
                      {semesterTransitionPreview ? <div className="mt-4 space-y-3">
                        <div className="flex flex-wrap gap-2 text-xs font-bold text-[#42527c]">{Object.entries(semesterTransitionPreview.summary || {}).map(([key, count]) => <span key={key} className="rounded-full border border-[#d9e2f5] bg-white px-2 py-1">{key.replaceAll("_", " ")}: {count}</span>)}</div>
                        <div className="max-h-72 overflow-auto rounded-lg border border-[#dde5f5] bg-white">{(semesterTransitionPreview.rows || []).map((row) => <div key={`transition-${row.expected_assignment_id}`} className="border-b border-[#edf1f8] px-3 py-2 text-sm last:border-b-0"><div className="flex items-center gap-3"><input type="checkbox" disabled={row.classification !== "ready"} checked={selectedSemesterTransitions.includes(row.expected_assignment_id)} onChange={(event) => setSelectedSemesterTransitions((previous) => event.target.checked ? [...previous, row.expected_assignment_id] : previous.filter((id) => id !== row.expected_assignment_id))} /><span className="min-w-0 flex-1"><b className="text-[#253965]">{row.mahasiswa?.nama || "Mahasiswa"}</b> <span className="text-[#6a779a]">{row.mahasiswa?.nim || ""}</span>{row.group_review ? <span className="mt-1 block text-xs text-[#6a779a]">{row.group_review.group_name} · {row.reason_code || row.group_review.reason_code || "siap divalidasi ulang"}</span> : null}</span><span className={`rounded-full px-2 py-1 text-xs font-bold ${row.classification === "ready" ? "bg-[#e8f8ef] text-[#127947]" : "bg-[#fff1e7] text-[#9b5b22]"}`}>{row.classification.replaceAll("_", " ")}</span></div>{row.group_review && row.classification !== "group_member" ? <div className="mt-2 flex flex-wrap justify-end gap-2"><button type="button" onClick={() => openSemesterTransitionFollowUp(row)} className="rounded-md border border-[#b9c7e5] px-2.5 py-1 text-xs font-bold text-[#34549b]">Buka Tindak Lanjut</button><button type="button" onClick={() => retrySemesterTransition(row)} disabled={loadingSemesterTransition || row.group_review.retry_available === false} className="rounded-md bg-[#315fc5] px-2.5 py-1 text-xs font-bold text-white disabled:opacity-50">Coba Proses Ulang</button></div> : null}</div>)}</div>
                        <button type="button" onClick={confirmSemesterTransitions} disabled={loadingSemesterTransition || selectedSemesterTransitions.length === 0} className="rounded-lg bg-[#137748] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Konfirmasi {selectedSemesterTransitions.length} kandidat</button>
                      </div> : null}
                    </div>
                    <div id="supervisor-assignment-history" className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                      <div className="mb-4">
                        <h3 className="text-lg font-black text-[#1b274b]">Riwayat Penetapan Pembimbing</h3>
                        <p className="text-sm text-[#5d6c91]">Monitoring read-only seluruh penetapan P1 dan P2. Perubahan hanya dilakukan melalui keputusan final atau tindak lanjut pergantian.</p>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                        <div className="relative xl:col-span-1">
                          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7282a8]" />
                          <input
                            type="search"
                            value={supervisorAssignmentFilters.q}
                            onChange={(event) => {
                              setSupervisorAssignmentFilters((previous) => ({ ...previous, q: event.target.value }));
                              setSupervisorAssignmentPage(1);
                            }}
                            placeholder="Cari mahasiswa atau NIM..."
                            className="w-full rounded-lg border border-[#d3dbef] py-2 pl-9 pr-3 text-sm outline-none focus:border-[#2f63e3]"
                          />
                        </div>
                        <select value={supervisorAssignmentFilters.periode_id} onChange={(event) => { setSupervisorAssignmentFilters((previous) => ({ ...previous, periode_id: event.target.value })); setSupervisorAssignmentPage(1); }} className="rounded-lg border border-[#d3dbef] px-3 py-2 text-sm outline-none focus:border-[#2f63e3]">
                          <option value="">Semua periode</option>
                          {supervisorAssignmentMonitoring.filter_options.periodes.map((periode) => <option key={`history-period-${periode.id}`} value={periode.id}>{periode.label_periode}</option>)}
                        </select>
                        <select value={supervisorAssignmentFilters.dosen_id} onChange={(event) => { setSupervisorAssignmentFilters((previous) => ({ ...previous, dosen_id: event.target.value })); setSupervisorAssignmentPage(1); }} className="rounded-lg border border-[#d3dbef] px-3 py-2 text-sm outline-none focus:border-[#2f63e3]">
                          <option value="">Semua dosen</option>
                          {supervisorAssignmentMonitoring.filter_options.dosens.map((dosen) => <option key={`history-dosen-${dosen.id}`} value={dosen.id}>{formatDosenFullName(dosen.nama, dosen.gelar)}</option>)}
                        </select>
                        <select value={supervisorAssignmentFilters.status} onChange={(event) => { setSupervisorAssignmentFilters((previous) => ({ ...previous, status: event.target.value })); setSupervisorAssignmentPage(1); }} className="rounded-lg border border-[#d3dbef] px-3 py-2 text-sm outline-none focus:border-[#2f63e3]">
                          <option value="">Semua status</option>
                          {Object.entries(SUPERVISOR_ASSIGNMENT_STATUS_LABELS).map(([value, label]) => <option key={`history-status-${value}`} value={value}>{label}</option>)}
                        </select>
                        <select value={supervisorAssignmentFilters.sumber_data} onChange={(event) => { setSupervisorAssignmentFilters((previous) => ({ ...previous, sumber_data: event.target.value })); setSupervisorAssignmentPage(1); }} className="rounded-lg border border-[#d3dbef] px-3 py-2 text-sm outline-none focus:border-[#2f63e3]">
                          <option value="">Semua sumber</option>
                          {Object.entries(SUPERVISOR_ASSIGNMENT_SOURCE_LABELS).map(([value, label]) => <option key={`history-source-${value}`} value={value}>{label}</option>)}
                        </select>
                        <select value={supervisorAssignmentFilters.semester_penjaluran_ke} onChange={(event) => { setSupervisorAssignmentFilters((previous) => ({ ...previous, semester_penjaluran_ke: event.target.value })); setSupervisorAssignmentPage(1); }} className="rounded-lg border border-[#d3dbef] px-3 py-2 text-sm outline-none focus:border-[#2f63e3]">
                          <option value="">Semua semester</option>
                          <option value="1">Semester 1</option><option value="2">Semester 2</option><option value="3">Semester 3</option>
                        </select>
                      </div>
                    </div>

                    <div className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                      <div className="overflow-auto rounded-lg border border-[#e6ecf8]">
                        <table className="w-full min-w-[1320px] text-left text-sm">
                          <thead><tr className="border-b border-[#e6ecf8] text-[#4d5e89]"><th className="bg-[#f8fbff] px-3 py-2">Mahasiswa</th><th className="bg-[#f8fbff] px-3 py-2">Periode Mulai</th><th className="bg-[#f8fbff] px-3 py-2 text-center">Semester Ke-</th><th className="bg-[#f8fbff] px-3 py-2">Pembimbing 1</th><th className="bg-[#f8fbff] px-3 py-2">Pembimbing 2</th><th className="bg-[#f8fbff] px-3 py-2">Tanggal Mulai</th><th className="bg-[#f8fbff] px-3 py-2">Tanggal Selesai</th><th className="bg-[#f8fbff] px-3 py-2">Status</th><th className="bg-[#f8fbff] px-3 py-2">Sumber</th><th className="bg-[#f8fbff] px-3 py-2">Ditetapkan Oleh</th></tr></thead>
                          <tbody>
                            {supervisorAssignmentMonitoring.rows.map((row) => {
                              const primary = (row.pembimbings || []).find((member) => Number(member.urutan) === 1);
                              const secondary = (row.pembimbings || []).find((member) => Number(member.urutan) === 2);
                              const active = row.status === "active";
                              const scheduled = row.status === "scheduled";
                              return <tr key={`supervisor-history-${row.id}`} className="border-b border-[#eff3fb] last:border-b-0">
                                <td className="px-3 py-3"><p className="font-bold text-[#1f3160]">{row.mahasiswa?.nama || "-"}</p><p className="text-xs text-[#6a779a]">{row.mahasiswa?.nim || "-"}</p></td>
                                <td className="px-3 py-3 font-semibold text-[#344a7a]">{row.periode_mulai?.label_periode || row.periode || "Tidak tercatat"}</td>
                                <td className="px-3 py-3 text-center font-bold text-[#344a7a]">{row.semester_penjaluran_ke || "-"}</td>
                                <td className="px-3 py-3 font-semibold text-[#263a6b]">{formatDosenFullName(primary?.dosen?.nama, primary?.dosen?.gelar) || "-"}</td>
                                <td className="px-3 py-3 text-[#42527c]">{formatDosenFullName(secondary?.dosen?.nama, secondary?.dosen?.gelar) || "-"}</td>
                                <td className="whitespace-nowrap px-3 py-3 text-[#42527c]">{row.tanggal_mulai ? formatDateTime(row.tanggal_mulai) : "Tidak tercatat"}</td>
                                <td className="whitespace-nowrap px-3 py-3 text-[#42527c]">{row.tanggal_selesai ? formatDateTime(row.tanggal_selesai) : "-"}</td>
                                <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${active ? "bg-[#e8f8ef] text-[#127947]" : scheduled ? "bg-[#fff5d9] text-[#8a6415]" : "bg-[#edf0f6] text-[#596887]"}`}>{SUPERVISOR_ASSIGNMENT_STATUS_LABELS[row.status] || row.status}</span>{scheduled && row.effective_at ? <p className="mt-1 whitespace-nowrap text-xs text-[#7a6a3c]">Efektif {formatDateTime(row.effective_at)}</p> : null}</td>
                                <td className="px-3 py-3"><span className="rounded-full bg-[#eef3ff] px-2 py-1 text-xs font-bold text-[#34549b]">{SUPERVISOR_ASSIGNMENT_SOURCE_LABELS[row.sumber_data] || row.sumber_data}</span></td>
                                <td className="px-3 py-3"><p className="font-semibold text-[#344a7a]">{row.ditetapkan_oleh?.nama || (row.sumber_data === "legacy_backfill" ? "Migrasi data lama" : "-")}</p><p className="text-xs text-[#6a779a]">{row.tanggal_penetapan ? formatDateTime(row.tanggal_penetapan) : "-"}</p></td>
                              </tr>;
                            })}
                          </tbody>
                        </table>
                        {!loadingSupervisorAssignments && supervisorAssignmentMonitoring.rows.length === 0 ? <p className="p-8 text-center text-sm font-semibold text-[#7b88ab]">Belum ada riwayat penetapan yang sesuai filter.</p> : null}
                        {loadingSupervisorAssignments ? <p className="p-8 text-center text-sm font-semibold text-[#60709a]">Memuat riwayat penetapan...</p> : null}
                      </div>
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#e8edf8] pt-3">
                        <p className="text-sm text-[#4f5e86]">Total {Number(supervisorAssignmentMonitoring.pagination.total || 0)} penetapan.</p>
                        <div className="flex items-center gap-2"><button type="button" onClick={() => setSupervisorAssignmentPage((previous) => Math.max(1, previous - 1))} disabled={supervisorAssignmentPage <= 1 || loadingSupervisorAssignments} className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] disabled:opacity-50">Sebelumnya</button><span className="text-sm font-semibold text-[#314778]">Halaman {supervisorAssignmentMonitoring.pagination.page || 1} / {supervisorAssignmentMonitoring.pagination.total_pages || 1}</span><button type="button" onClick={() => setSupervisorAssignmentPage((previous) => Math.min(supervisorAssignmentMonitoring.pagination.total_pages || 1, previous + 1))} disabled={supervisorAssignmentPage >= (supervisorAssignmentMonitoring.pagination.total_pages || 1) || loadingSupervisorAssignments} className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] disabled:opacity-50">Berikutnya</button></div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {masterDosenTab === "tindak-lanjut" && dosenStatusFollowUpDetailRow ? (
                  <div className="space-y-4">
                    {loadingDosenStatusFollowUpDetail ? <div className="rounded-xl border border-[#e4e9f6] bg-white p-8 text-center text-sm font-semibold text-[#60709a]">Memuat detail tindak lanjut...</div> : null}
                    {!loadingDosenStatusFollowUpDetail && dosenStatusFollowUpDetail ? <>
                      <div className="rounded-xl border border-[#e4e9f6] bg-white p-5 shadow-sm">
                        <h4 className="text-lg font-black text-[#1b274b]">Informasi Dosen dan Dampak</h4>
                        <p className="mt-1 text-sm text-[#5d6c91]">Data ini merupakan hasil analisis terbaru sistem dan bersifat read-only.</p>
                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          <div><label className="mb-1 block text-sm font-bold text-[#344a7a]">Dosen</label><input disabled value={formatDosenFullName(dosenStatusFollowUpDetail.dosen?.nama, dosenStatusFollowUpDetail.dosen?.gelar) || "-"} className="w-full rounded-lg border border-[#d3dbef] bg-[#f4f6fa] px-3 py-2.5 text-sm text-[#596887]" /></div>
                          <div><label className="mb-1 block text-sm font-bold text-[#344a7a]">Status Master</label><input disabled value={DOSEN_MASTER_STATUS_LABELS[dosenStatusFollowUpDetail.dosen?.status_keaktifan] || dosenStatusFollowUpDetail.dosen?.status_keaktifan || "-"} className="w-full rounded-lg border border-[#d3dbef] bg-[#f4f6fa] px-3 py-2.5 text-sm text-[#596887]" /></div>
                          <div><label className="mb-1 block text-sm font-bold text-[#344a7a]">Mahasiswa Aktif</label><input disabled value={Number(dosenStatusFollowUpDetail.current_impact?.mahasiswa_bimbingan_aktif || 0)} className="w-full rounded-lg border border-[#d3dbef] bg-[#f4f6fa] px-3 py-2.5 text-sm text-[#596887]" /></div>
                          <div><label className="mb-1 block text-sm font-bold text-[#344a7a]">Review dan Jadwal Terdampak</label><input disabled value={`${Number(dosenStatusFollowUpDetail.current_impact?.review_pending || 0)} review · ${Number(dosenStatusFollowUpDetail.current_impact?.jadwal_sidang_mendatang || 0)} jadwal sidang`} className="w-full rounded-lg border border-[#d3dbef] bg-[#f4f6fa] px-3 py-2.5 text-sm text-[#596887]" /></div>
                        </div>
                      </div>

                      {affectedDosenStatusFollowUpStudents.map((mahasiswa, index) => {
                        const form = dosenStatusFollowUpForms[mahasiswa.id] || {};
                        const candidates = mahasiswa.replacement_candidates || [];
                        const replacementStatus = mahasiswa.supervision_status === "active" ? "active" : "awaiting_selection";
                        const isLastAffectedStudent = dosenStatusFollowUpBlockingCount === 1;
                        return <div key={`follow-up-form-${mahasiswa.id}`} className="rounded-xl border border-[#e4e9f6] bg-white p-5 shadow-sm">
                          <div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="text-lg font-black text-[#1b274b]">{index + 1}. Penggantian Pembimbing Mahasiswa</h4><p className="mt-1 text-sm font-bold text-[#344a7a]">{mahasiswa.nama} · {mahasiswa.nim}</p><p className="text-sm text-[#5d6c91]">Klaster topik: {mahasiswa.replacement_cluster?.code || "Belum teridentifikasi"}{mahasiswa.replacement_cluster?.label ? ` - ${mahasiswa.replacement_cluster.label}` : ""}</p></div><span className={`rounded-full px-3 py-1 text-xs font-black ${replacementStatus === "active" ? "bg-[#e8f7ef] text-[#137748]" : "bg-[#fff1df] text-[#a15b18]"}`}>{replacementStatus === "active" ? "Pengganti Aktif" : "Menunggu Pengganti"}</span></div>

                          {replacementStatus === "awaiting_selection" ? <div className="mt-5 grid gap-4 md:grid-cols-2">
                            <div><label className="mb-1 block text-sm font-bold text-[#344a7a]">Pembimbing 1 <span className="text-[#c0392b]">*</span></label><ReplacementDosenCombobox inputId={`replacement-primary-${mahasiswa.id}`} candidates={candidates} value={form.primary_id || ""} onChange={(value) => updateDosenStatusFollowUpStudentForm(mahasiswa.id, "primary_id", value)} hasError={Boolean(dosenStatusFollowUpFormErrors[`${mahasiswa.id}.primary_id`])} placeholder="Cari nama atau kode dosen pembimbing utama..." /></div>
                            <div><label className="mb-1 block text-sm font-bold text-[#344a7a]">Pembimbing 2</label><ReplacementDosenCombobox inputId={`replacement-secondary-${mahasiswa.id}`} candidates={candidates} value={form.secondary_id || ""} onChange={(value) => updateDosenStatusFollowUpStudentForm(mahasiswa.id, "secondary_id", value)} hasError={Boolean(dosenStatusFollowUpFormErrors[`${mahasiswa.id}.secondary_id`])} placeholder="Cari nama atau kode dosen pembimbing kedua..." allowEmpty /></div>
                            <div><label className="mb-1 block text-sm font-bold text-[#344a7a]">Tanggal Efektif <span className="text-[#c0392b]">*</span></label><input type="date" max={getJakartaDateInputValue()} value={form.tanggal_mulai || ""} onChange={(event) => updateDosenStatusFollowUpStudentForm(mahasiswa.id, "tanggal_mulai", event.target.value)} className={`w-full rounded-lg border px-3 py-2.5 text-sm outline-none ${dosenStatusFollowUpFormErrors[`${mahasiswa.id}.tanggal_mulai`] ? "border-[#d64545] focus:border-[#d64545]" : "border-[#d3dbef] focus:border-[#2f63e3]"}`} /></div>
                            <div className="md:col-span-2"><label className="mb-1 block text-sm font-bold text-[#344a7a]">Catatan Tambahan <span className="font-normal text-[#6d7896]">(opsional)</span></label><textarea value={form.catatan || ""} onChange={(event) => updateDosenStatusFollowUpStudentForm(mahasiswa.id, "catatan", event.target.value)} placeholder="Tambahkan informasi lain jika diperlukan" className="min-h-[100px] w-full rounded-lg border border-[#d3dbef] px-3 py-2.5 text-sm outline-none focus:border-[#2f63e3]" /></div>
                            <div className="md:col-span-2"><button type="button" onClick={() => handleActivateInlineReplacement(mahasiswa)} disabled={Boolean(savingDosenStatusFollowUpAction)} className="rounded-lg bg-[#2f63e3] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{savingDosenStatusFollowUpAction === `activate-${mahasiswa.id}` ? "Menetapkan..." : isLastAffectedStudent ? "Tetapkan Pengganti & Selesaikan" : "Tetapkan Pembimbing Pengganti"}</button></div>
                          </div> : null}
                          {replacementStatus === "active" ? <div className="mt-4 rounded-lg border border-[#cce8d8] bg-[#f0fbf5] px-4 py-3 text-sm font-semibold text-[#127947]">Pembimbing pengganti sudah aktif dan mahasiswa dapat melanjutkan proses bimbingan.</div> : null}
                        </div>;
                      })}

                      {!hasPendingDosenStatusReplacement ? <div className="rounded-xl border border-[#e4e9f6] bg-white p-5 shadow-sm">
                        <h4 className="text-lg font-black text-[#1b274b]">Penyelesaian Tindak Lanjut</h4>
                        <p className="mt-1 text-sm text-[#5d6c91]">
                          Sistem memeriksa ulang seluruh kategori dampak sebelum tindak lanjut dapat ditutup.
                        </p>
                        {dosenStatusFollowUpDetail.resolution_status?.blocking_message ? (
                          <div className="mt-3 rounded-lg border border-[#f0d5a9] bg-[#fff8ed] px-3 py-2 text-sm font-semibold text-[#8b571e]">
                            {dosenStatusFollowUpDetail.resolution_status.blocking_message}
                          </div>
                        ) : (
                          <div className="mt-3 rounded-lg border border-[#cce8d8] bg-[#f0fbf5] px-3 py-2 text-sm font-semibold text-[#127947]">
                            Seluruh dampak operasional sudah selesai. Tindak lanjut dapat ditutup.
                          </div>
                        )}
                        <div className="mt-4">
                          <label className="mb-1 block text-sm font-bold text-[#344a7a]">Catatan Tindak Lanjut <span className="ml-1 font-normal text-[#6d7896]">(opsional)</span></label>
                          <textarea value={dosenStatusFollowUpResolutionForm.note} onChange={(event) => setDosenStatusFollowUpResolutionForm({ note: event.target.value })} maxLength={1000} className="min-h-[100px] w-full rounded-lg border border-[#d3dbef] px-3 py-2.5 text-sm outline-none focus:border-[#2f63e3]" placeholder="Tambahkan informasi yang belum tercatat oleh sistem, jika ada" />
                          <div className="mt-1 flex justify-end text-xs text-[#6d7896]"><p>{dosenStatusFollowUpResolutionForm.note.length}/1000</p></div>
                        </div>
                        <div className="mt-5 flex gap-2"><button type="button" onClick={handleBackFromDosenStatusFollowUpPage} className="rounded-lg border border-[#d3dbef] px-4 py-2.5 text-sm font-bold text-[#344a7a]">Kembali</button><button type="button" onClick={handleResolveInlineDosenStatusFollowUp} disabled={Boolean(savingDosenStatusFollowUpAction) || dosenStatusFollowUpDetail.resolution_status?.can_resolve !== true} className="rounded-lg bg-[#117246] px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{savingDosenStatusFollowUpAction === "resolve" ? "Menyimpan..." : "Selesaikan Tindak Lanjut"}</button></div>
                      </div> : null}
                    </> : null}
                  </div>
                ) : null}

                {masterDosenTab === "tindak-lanjut" && !dosenStatusFollowUpDetailRow ? (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#dbe4f6] bg-[#f8fbff] p-3">
                        <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7282a8]" /><input type="search" value={dosenStatusFollowUpQuery} onChange={(event) => { setDosenStatusFollowUpQuery(event.target.value); setDosenStatusFollowUpPage(1); }} placeholder="Cari nama, kode, atau status dosen..." aria-label="Cari tindak lanjut status dosen" className="w-[320px] rounded-lg border border-[#d3dbef] bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[#2f63e3]" /></div>
                        <span className="rounded-full bg-[#fff1df] px-3 py-1.5 text-xs font-black text-[#a15b18]">{filteredDosenStatusFollowUps.length} perlu diproses</span>
                      </div>
                      <div className="overflow-auto rounded-lg border border-[#e6ecf8]">
                        <table className="w-full min-w-[1120px] text-left text-sm">
                          <thead><tr className="border-b border-[#e6ecf8] text-[#4d5e89]"><th className="bg-[#f8fbff] px-3 py-2">Dosen</th><th className="bg-[#f8fbff] px-3 py-2">Status Master</th><th className="bg-[#f8fbff] px-3 py-2 text-center">Mahasiswa Aktif</th><th className="bg-[#f8fbff] px-3 py-2 text-center">Review Tertunda</th><th className="bg-[#f8fbff] px-3 py-2 text-center">Jadwal Sidang</th><th className="bg-[#f8fbff] px-3 py-2">Jenis Tindak Lanjut</th><th className="bg-[#f8fbff] px-3 py-2">Status</th><th className="bg-[#f8fbff] px-3 py-2 text-center">Aksi</th></tr></thead>
                          <tbody>{pagedDosenStatusFollowUps.map((row) => {
                            const impact = row.impact_snapshot || {};
                            const requiresReplacement = row.dosen?.continue_existing_supervision === false && Number(impact.mahasiswa_bimbingan_aktif || 0) > 0;
                            const typeLabel = impact.reactivation_required ? "Reaktivasi" : requiresReplacement ? "Penggantian Pembimbing" : "Penyesuaian Tugas";
                            return <tr key={`follow-up-${row.id}`} className="border-b border-[#eff3fb] last:border-b-0">
                              <td className="px-3 py-3"><p className="font-bold text-[#1f3160]">{formatDosenFullName(row.dosen?.nama, row.dosen?.gelar) || "Dosen"}</p><p className="text-xs text-[#6a779a]">{row.dosen?.kode_dosen || row.dosen?.nik || "-"}</p></td>
                              <td className="px-3 py-3"><span className="rounded-full bg-[#fff1df] px-2 py-1 text-xs font-bold text-[#a15b18]">{DOSEN_MASTER_STATUS_LABELS[row.dosen?.status_keaktifan] || row.dosen?.status_keaktifan || "-"}</span></td>
                              <td className="px-3 py-3 text-center font-bold text-[#1f3160]">{Number(impact.mahasiswa_bimbingan_aktif || 0)}</td><td className="px-3 py-3 text-center font-bold text-[#1f3160]">{Number(impact.review_pending || 0)}</td><td className="px-3 py-3 text-center font-bold text-[#1f3160]">{Number(impact.jadwal_sidang_mendatang || 0)}</td>
                              <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${requiresReplacement ? "bg-[#fff0f0] text-[#a03f3f]" : impact.reactivation_required ? "bg-[#eef3ff] text-[#34549b]" : "bg-[#fff8ed] text-[#a15b18]"}`}>{typeLabel}</span></td>
                              <td className="px-3 py-3"><span className="rounded-full bg-[#fff1df] px-2 py-1 text-xs font-bold text-[#a15b18]">Terbuka</span></td>
                              <td className="px-3 py-3 text-center"><button type="button" onClick={() => handleOpenDosenStatusFollowUpPage(row)} className="rounded-lg bg-[#2f63e3] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#2454c7]">Proses</button></td>
                            </tr>;
                          })}</tbody>
                        </table>
                        {filteredDosenStatusFollowUps.length === 0 ? <p className="p-8 text-center text-sm font-semibold text-[#7b88ab]">{dosenStatusFollowUps.length === 0 ? "Tidak ada tindak lanjut terbuka." : "Tindak lanjut yang dicari tidak ditemukan."}</p> : null}
                      </div>
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#e8edf8] pt-3"><p className="text-sm text-[#4f5e86]">Menampilkan {dosenStatusFollowUpRangeStart} - {dosenStatusFollowUpRangeEnd} dari {filteredDosenStatusFollowUps.length} tindak lanjut.</p><div className="flex items-center gap-2"><button type="button" onClick={() => setDosenStatusFollowUpPage((previous) => Math.max(1, previous - 1))} disabled={dosenStatusFollowUpPage === 1} className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] disabled:cursor-not-allowed disabled:opacity-50">Sebelumnya</button><span className="text-sm font-semibold text-[#314778]">Halaman {dosenStatusFollowUpPage} / {totalDosenStatusFollowUpPages}</span><button type="button" onClick={() => setDosenStatusFollowUpPage((previous) => Math.min(totalDosenStatusFollowUpPages, previous + 1))} disabled={dosenStatusFollowUpPage >= totalDosenStatusFollowUpPages} className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] disabled:cursor-not-allowed disabled:opacity-50">Berikutnya</button></div></div>
                    </div>
                  </div>
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
                                {formatDosenFullName(
                                  row.dosen?.nama || row.dosen_nama || row.nama_dosen,
                                  row.dosen?.gelar || row.dosen_gelar
                                ) || "-"}
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
                          <label className="mb-1 block text-sm font-semibold text-[#344b7f]">
                            Kode Topik <span className="text-[#d93030]">*</span>
                          </label>
                          <input
                            type="text"
                            name="kode"
                            value={topikForm.kode}
                            onChange={handleTopikFormChange}
                            placeholder="Contoh: SIRKEL99"
                            className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[#2f63e3] ${
                              topikFormErrors.kode ? "border-[#d93030]" : "border-[#d3dbef]"
                            }`}
                          />
                          {topikFormErrors.kode ? (
                            <p className="mt-1 text-xs font-semibold text-[#d93030]">{topikFormErrors.kode}</p>
                          ) : null}
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-semibold text-[#344b7f]">
                            Cluster <span className="text-[#d93030]">*</span>
                          </label>
                          <select
                            name="cluster"
                            value={topikForm.cluster}
                            onChange={handleTopikFormChange}
                            className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[#2f63e3] ${
                              topikFormErrors.cluster ? "border-[#d93030]" : "border-[#d3dbef]"
                            }`}
                          >
                            {allowedTopikClusters.map((cluster) => (
                              <option key={cluster} value={cluster}>
                                {cluster}
                              </option>
                            ))}
                          </select>
                          {topikFormErrors.cluster ? (
                            <p className="mt-1 text-xs font-semibold text-[#d93030]">{topikFormErrors.cluster}</p>
                          ) : null}
                          <p className="mt-1 text-xs text-[#6b789e]">
                            Opsi cluster mengikuti assignment cluster dosen login.
                          </p>
                        </div>
                        <div className="lg:col-span-2">
                          <label className="mb-1 block text-sm font-semibold text-[#344b7f]">
                            Judul Topik <span className="text-[#d93030]">*</span>
                          </label>
                          <input
                            type="text"
                            name="judul"
                            value={topikForm.judul}
                            onChange={handleTopikFormChange}
                            placeholder="Masukkan judul topik"
                            className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[#2f63e3] ${
                              topikFormErrors.judul ? "border-[#d93030]" : "border-[#d3dbef]"
                            }`}
                          />
                          {topikFormErrors.judul ? (
                            <p className="mt-1 text-xs font-semibold text-[#d93030]">{topikFormErrors.judul}</p>
                          ) : null}
                        </div>
                        <div className="lg:col-span-2">
                          <label className="mb-1 block text-sm font-semibold text-[#344b7f]">
                            Keyword <span className="text-[#d93030]">*</span>
                          </label>
                          <input
                            type="text"
                            name="keyword"
                            value={topikForm.keyword}
                            onChange={handleTopikFormChange}
                            placeholder="Contoh: machine learning, rekomendasi, sistem informasi"
                            className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[#2f63e3] ${
                              topikFormErrors.keyword ? "border-[#d93030]" : "border-[#d3dbef]"
                            }`}
                          />
                          {topikFormErrors.keyword ? (
                            <p className="mt-1 text-xs font-semibold text-[#d93030]">{topikFormErrors.keyword}</p>
                          ) : null}
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
                  <table className="w-full min-w-[2100px] text-left text-sm">
                    <thead>
                      <tr className="border-y border-[#e6ecf8] text-[#4d5e89]">
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Tanggal</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Tahun Akademik</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Semester</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Angkatan</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">NIM</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Nama</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Program</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Jalur</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Penjaluran</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Kelompok</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">DPA</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Calon Pembimbing Sementara</th>
                        <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPendaftaranRows.length > 0
                        ? pagedPendaftaranRows.map((row) => {
                            const namaPenjaluran =
                              row.jalur === "alih" && row.penjaluran_sebelumnya && row.penjaluran_baru
                                ? `${formatLabel(row.penjaluran_sebelumnya)} \u2192 ${formatLabel(row.penjaluran_baru)}`
                                : formatLabel(
                                    row.jenis_jalur_diambil ||
                                      row.penjaluran_baru ||
                                      row.penjaluran_sebelumnya
                                  );

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
                                <td className="px-3 py-2">
                                  {row.program_kuliah === "internasional"
                                    ? "International Program"
                                    : row.program_kuliah === "reguler"
                                    ? "Reguler"
                                    : "-"}
                                </td>
                                <td className="px-3 py-2">{formatLabel(row.jalur)}</td>
                                <td className="px-3 py-2">{namaPenjaluran || "-"}</td>
                                <td className="px-3 py-2">
                                  {row.kelompok_perintisan?.anggota?.length ? (
                                    <div className="space-y-1">
                                      {row.kelompok_perintisan.anggota.map((item) => (
                                        <p key={`${row.id}-${item.mahasiswa_id}`} className="text-xs text-[#405070]">
                                          <b>{formatLabel(item.peran_tim)}:</b> {item.nama || "-"} ({item.nim || "-"})
                                        </p>
                                      ))}
                                    </div>
                                  ) : (
                                    "-"
                                  )}
                                </td>
                                <td className="px-3 py-2">{formatDosenFullName(row.dosen_pembimbing_akademik?.nama, row.dosen_pembimbing_akademik?.gelar) || "-"}</td>
                                <td className="px-3 py-2">
                                  {formatDosenFullName(row.calon_dosen_pembimbing?.nama, row.calon_dosen_pembimbing?.gelar) || "Belum memiliki"}
                                </td>
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
                                    <p className="font-semibold text-[#1f3160]">{formatDosenFullName(row.ketua.ketua_dosen.nama, row.ketua.ketua_dosen.gelar)}</p>
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
                        if (periodeMode === "open") {
                          handleCancelPeriodeSetup().catch(() => {});
                          return;
                        }
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
                      onClick={handleStartPeriodeSetup}
                      disabled={savingPeriode}
                      className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                        periodeMode === "open"
                          ? "bg-[#2f63e3] text-white"
                          : "border border-[#d3dbef] text-[#27407b] hover:bg-[#f3f6ff]"
                      }`}
                    >
                      <CalendarRange className="h-4 w-4" />
                      Buka Periode Baru
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
                    <h3 className="text-2xl font-black tracking-tight text-[#1b274b]">Persiapan Pembukaan Periode</h3>
                    <p className="mt-1 text-sm text-[#5d6c91]">
                      Data baru disimpan ke server ketika tombol Buka Pendaftaran ditekan.
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
                      {["periode", "availability", "preview", "opened"].map((step, index) => (
                        <span key={step} className={`rounded-full px-3 py-1.5 ${periodeSetup.step === step ? "bg-[#2f63e3] text-white" : "bg-[#eef2fb] text-[#657295]"}`}>
                          {index + 1}. {{ periode: "Periode", availability: "Ketersediaan", preview: "Preview", opened: "Dibuka" }[step]}
                        </span>
                      ))}
                    </div>

                    {periodeSetup.step === "periode" ? (
                      <div className="mt-4 space-y-4">
                        <section className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                          <h3 className="text-lg font-black text-[#1b274b]">Detail Periode Penjaluran</h3>
                          <p className="mt-1 text-sm text-[#5d6c91]">Isi identitas dan rentang tanggal pendaftaran.</p>
                          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-sm font-semibold text-[#344b7f]">Tahun Akademik <span className="text-[#c23737]">*</span></label>
                            <input
                              type="text"
                              name="tahun_akademik"
                              value={periodeForm.tahun_akademik}
                              onChange={handlePeriodeInputChange}
                              inputMode="numeric"
                              maxLength={9}
                              pattern="\d{4}/\d{4}"
                              required
                              aria-required="true"
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
                            <label className="mb-1 block text-sm font-semibold text-[#344b7f]">Semester <span className="text-[#c23737]">*</span></label>
                            <select
                              name="semester"
                              value={periodeForm.semester}
                              onChange={handlePeriodeInputChange}
                              required
                              aria-required="true"
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
                          <div className="lg:col-span-2">
                            <label className="mb-1 block text-sm font-semibold text-[#344b7f]">Label Periode <span className="text-[#c23737]">*</span></label>
                            <input type="text" name="label_periode" value={periodeForm.label_periode} onChange={handlePeriodeInputChange} placeholder={`${formatLabel(periodeForm.semester)} ${periodeForm.tahun_akademik || "2026/2027"}`} required aria-required="true" className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[#2f63e3] ${periodeFormErrors.label_periode ? "border-[#dc4b4b] bg-[#fff7f7]" : "border-[#d3dbef]"}`} />
                            {periodeFormErrors.label_periode ? <p className="mt-1 text-xs font-semibold text-[#c23737]">{periodeFormErrors.label_periode}</p> : null}
                          </div>
                          <div>
                            <label className="mb-1 block text-sm font-semibold text-[#344b7f]">Tanggal Mulai <span className="text-[#c23737]">*</span></label>
                            <input
                              type="date"
                              name="tanggal_mulai"
                              value={periodeForm.tanggal_mulai}
                              onChange={handlePeriodeInputChange}
                              required
                              aria-required="true"
                              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[#2f63e3] ${
                                periodeFormErrors.tanggal_mulai ? "border-[#dc4b4b] bg-[#fff7f7]" : "border-[#d3dbef]"
                              }`}
                            />
                            {periodeFormErrors.tanggal_mulai ? (
                              <p className="mt-1 text-xs font-semibold text-[#c23737]">{periodeFormErrors.tanggal_mulai}</p>
                            ) : null}
                          </div>
                          <div>
                            <label className="mb-1 block text-sm font-semibold text-[#344b7f]">Tanggal Selesai <span className="text-[#c23737]">*</span></label>
                            <input
                              type="date"
                              name="tanggal_selesai"
                              value={periodeForm.tanggal_selesai}
                              onChange={handlePeriodeInputChange}
                              required
                              aria-required="true"
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

                        <section className="rounded-xl border border-[#e4e9f6] bg-white p-4 shadow-sm">
                          <h3 className="text-lg font-black text-[#1b274b]">Penanggung Jawab Periode</h3>
                          <p className="mt-1 text-sm text-[#5d6c91]">Penanggung jawab divalidasi langsung dari status master dosen, bukan dari availability.</p>
                          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
                            {PERIODE_MASTER_ALL_FIELDS.map((item) => (
                              <div key={`setup-role-${item.key}`}>
                                <label className="mb-1 block text-sm font-semibold text-[#344b7f]">{item.label} <span className="text-[#c23737]">*</span></label>
                                <select value={periodeMasterForm[item.key] || ""} onChange={(event) => setPeriodeMasterForm((previous) => ({ ...previous, [item.key]: event.target.value }))} className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${periodeMasterErrors[item.key] ? "border-[#dc4b4b] bg-[#fff7f7]" : "border-[#d3dbef]"}`}>
                                  <option value="">Pilih dosen</option>
                                  {(periodeMasterOptionsByField[item.key] || periodeDosenOptions).map((dosen) => <option key={`${item.key}-${dosen.id}`} value={dosen.id}>{formatDosenFullName(dosen.nama, dosen.gelar)} - {dosen.nik || dosen.kode_dosen || "-"}</option>)}
                                </select>
                                {periodeMasterErrors[item.key] ? <p className="mt-1 text-xs font-semibold text-[#c23737]">{periodeMasterErrors[item.key]}</p> : null}
                              </div>
                            ))}
                          </div>
                        </section>
                        <button type="button" disabled={savingPeriode} onClick={handleOpenPeriode} className="rounded-lg bg-[#117246] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{savingPeriode ? "Memuat..." : "Lanjut Atur Ketersediaan"}</button>
                      </div>
                    ) : null}

                    {periodeSetup.step === "availability" ? (
                      <div className="mt-4 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#dbe4f6] bg-[#f8fbff] p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <input type="search" value={dosenPeriodAvailabilityQuery} onChange={(event) => setDosenPeriodAvailabilityQuery(event.target.value)} placeholder="Cari dosen..." className="w-64 rounded-lg border border-[#d3dbef] px-3 py-2 text-sm" />
                            <button type="button" onClick={() => setSelectedAvailabilityDosenIds(periodeSetup.dosens.filter((row) => row.can_edit).map((row) => Number(row.id)))} className="rounded-lg border border-[#d3dbef] bg-white px-3 py-2 text-xs font-bold text-[#27407b]">Pilih Semua Dosen</button>
                            <button type="button" onClick={() => setSelectedAvailabilityDosenIds([])} className="rounded-lg border border-[#d3dbef] bg-white px-3 py-2 text-xs font-bold text-[#596887]">Hapus Pilihan</button>
                            <span className="text-xs font-bold text-[#526184]">{selectedAvailabilityDosenIds.length} dosen dipilih</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button type="button" disabled={!selectedAvailabilityDosenIds.length} onClick={() => selectedAvailabilityDosenIds.forEach((id) => updatePeriodeSetupDosen(id, { tersedia_membimbing: true, configuration_status: "ready" }))} className="rounded-lg bg-[#2f63e3] px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Tandai Menerima</button>
                            <button type="button" disabled={!selectedAvailabilityDosenIds.length} onClick={() => selectedAvailabilityDosenIds.forEach((id) => updatePeriodeSetupDosen(id, { tersedia_membimbing: false, configuration_status: "ready" }))} className="rounded-lg bg-[#b45309] px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Tandai Tidak Menerima</button>
                          </div>
                        </div>
                        <div className="overflow-auto rounded-lg border border-[#e6ecf8]">
                          <table className="w-full min-w-[1050px] text-left text-sm">
                            <thead><tr className="border-b border-[#e6ecf8] text-[#4d5e89]"><th className="bg-[#f8fbff] px-3 py-2 text-center">Pilih</th><th className="bg-[#f8fbff] px-3 py-2">Dosen</th><th className="bg-[#f8fbff] px-3 py-2">Status Master</th><th className="bg-[#f8fbff] px-3 py-2">Status Konfigurasi</th><th className="bg-[#f8fbff] px-3 py-2 text-center">Menerima Bimbingan Baru</th><th className="bg-[#f8fbff] px-3 py-2">Kapasitas Saat Ini</th></tr></thead>
                            <tbody>{periodeSetup.dosens.filter((row) => [row.nama, row.gelar, row.kode_dosen, row.nik].filter(Boolean).join(" ").toLowerCase().includes(dosenPeriodAvailabilityQuery.trim().toLowerCase())).map((row) => {
                              const statusMeta = { copied: ["Disalin dari periode sebelumnya", "bg-[#eef3ff] text-[#34549b]"], ready: ["Siap", "bg-[#e8f8ef] text-[#127947]"], needs_review: ["Perlu Ditinjau", "bg-[#fff1df] text-[#a15b18]"], locked_by_master_status: ["Dikunci Admin", "bg-[#edf0f6] text-[#596887]"] }[row.configuration_status];
                              return <tr key={`setup-dosen-${row.id}`} className="border-b border-[#eff3fb]"><td className="px-3 py-2 text-center"><input type="checkbox" disabled={!row.can_edit} checked={selectedAvailabilityDosenIds.includes(Number(row.id))} onChange={() => toggleAvailabilitySelection(row.id)} /></td><td className="px-3 py-2"><p className="font-bold text-[#1f3160]">{formatDosenFullName(row.nama, row.gelar)}</p><p className="text-xs text-[#6a779a]">{row.kode_dosen || row.nik || "-"}</p></td><td className="px-3 py-2">{DOSEN_MASTER_STATUS_LABELS[row.status_keaktifan] || row.status_keaktifan}</td><td className="px-3 py-2"><span className={`rounded-full px-2 py-1 text-xs font-bold ${statusMeta?.[1] || ""}`}>{statusMeta?.[0] || row.configuration_status}</span></td><td className="px-3 py-2 text-center"><input type="checkbox" checked={Boolean(row.tersedia_membimbing)} disabled={!row.can_edit} onChange={(event) => updatePeriodeSetupDosen(row.id, { tersedia_membimbing: event.target.checked, configuration_status: "ready" })} /></td><td className="px-3 py-2"><b>{row.terpakai}/{row.kuota}</b>, sisa {row.sisa}{row.tersedia_membimbing && row.sisa <= 0 ? <span className="ml-2 text-xs font-bold text-[#b43c3c]">Penuh</span> : null}</td></tr>;
                            })}</tbody>
                          </table>
                        </div>
                        <div className="flex flex-wrap gap-2"><button type="button" onClick={() => setPeriodeSetup((previous) => ({ ...previous, step: "periode" }))} className="rounded-lg border border-[#d3dbef] px-4 py-2 text-sm font-bold text-[#27407b]">Kembali ke Tanggal</button><button type="button" disabled={savingPeriode} onClick={handlePreviewPeriodeSetup} className="rounded-lg bg-[#2f63e3] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">Preview Pembukaan</button></div>
                      </div>
                    ) : null}

                    {periodeSetup.step === "preview" ? (
                      <div className="mt-4 space-y-4">
                        <section className="rounded-xl border border-[#e4e9f6] bg-[#f8fbff] p-4"><h3 className="text-lg font-black text-[#1b274b]">Preview Pembukaan Pendaftaran</h3><p className="mt-2 text-xl font-black text-[#27407b]">{periodeSetup.preview?.periode?.label_periode}</p><p className="text-sm text-[#5d6c91]">{formatDateTime(periodeSetup.preview?.periode?.tanggal_mulai)} - {formatDateTime(periodeSetup.preview?.periode?.tanggal_selesai)}</p></section>
                        <section className="rounded-xl border border-[#e4e9f6] p-4"><h4 className="font-black text-[#1b274b]">Penanggung Jawab</h4><div className="mt-3 grid gap-2 lg:grid-cols-2">{(periodeSetup.preview?.penanggung_jawab || []).map((item) => <div key={item.key} className="rounded-lg bg-[#f8fbff] p-3"><p className="text-xs font-bold text-[#6b789d]">{item.label}</p><p className="font-semibold text-[#263861]">{formatDosenFullName(item.dosen?.nama, item.dosen?.gelar) || "-"}</p></div>)}</div></section>
                        <div className="grid gap-3 md:grid-cols-2">
                          <section className="rounded-xl border border-[#e4e9f6] p-4">
                            <h4 className="font-black text-[#1b274b]">Ketersediaan</h4>
                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                              {[
                                ["Menerima Bimbingan Baru", periodeSetup.preview?.ketersediaan?.menerima || 0],
                                ["Tidak Menerima", periodeSetup.preview?.ketersediaan?.tidak_menerima || 0],
                                ["Dikunci Admin", periodeSetup.preview?.ketersediaan?.locked || 0],
                                ["Perlu Ditinjau", periodeSetup.preview?.ketersediaan?.needs_review || 0],
                              ].map(([label, value]) => (
                                <div key={`preview-availability-${label}`}>
                                  <label className="mb-1 block text-xs font-bold text-[#526184]">{label}</label>
                                  <input
                                    type="text"
                                    value={`${value} dosen`}
                                    readOnly
                                    aria-label={label}
                                    className="w-full cursor-default rounded-lg border border-[#d3dbef] bg-[#f5f7fc] px-3 py-2 text-sm font-semibold text-[#344b7f] outline-none"
                                  />
                                </div>
                              ))}
                            </div>
                          </section>
                          <section className="rounded-xl border border-[#e4e9f6] p-4">
                            <h4 className="font-black text-[#1b274b]">Kapasitas</h4>
                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                              {[
                                ["Total Kuota", periodeSetup.preview?.ketersediaan?.total_kuota || 0],
                                ["Sudah Terpakai", periodeSetup.preview?.ketersediaan?.terpakai || 0],
                                ["Kapasitas Tersisa", periodeSetup.preview?.ketersediaan?.sisa || 0],
                              ].map(([label, value]) => (
                                <div key={`preview-capacity-${label}`}>
                                  <label className="mb-1 block text-xs font-bold text-[#526184]">{label}</label>
                                  <input
                                    type="text"
                                    value={value}
                                    readOnly
                                    aria-label={label}
                                    className="w-full cursor-default rounded-lg border border-[#d3dbef] bg-[#f5f7fc] px-3 py-2 text-sm font-semibold text-[#344b7f] outline-none"
                                  />
                                </div>
                              ))}
                            </div>
                          </section>
                        </div>
                        <div className="flex flex-wrap gap-2"><button type="button" onClick={() => setPeriodeSetup((previous) => ({ ...previous, step: "periode" }))} className="rounded-lg border border-[#d3dbef] px-4 py-2 text-sm font-bold text-[#27407b]">Kembali ke Tanggal</button><button type="button" onClick={() => setPeriodeSetup((previous) => ({ ...previous, step: "availability" }))} className="rounded-lg border border-[#d3dbef] px-4 py-2 text-sm font-bold text-[#27407b]">Kembali ke Ketersediaan</button><button type="button" disabled={savingPeriode} onClick={handleOpenPeriodeFromPreview} className="rounded-lg bg-[#117246] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{savingPeriode ? "Membuka..." : "Buka Pendaftaran"}</button></div>
                      </div>
                    ) : null}

                    {periodeSetup.step === "opened" ? <div className="mt-4 rounded-xl border border-[#bfe2ce] bg-[#f0fbf5] p-6 text-center"><h3 className="text-xl font-black text-[#127947]">Pendaftaran Berhasil Dibuka</h3><p className="mt-1 text-sm text-[#426c57]">Periode sudah aktif dan dapat digunakan.</p><button type="button" onClick={() => { setPeriodeMode("list"); setPeriodeSetup({ step: "periode", dosens: [], preview: null, previous_period: null }); setPeriodeForm({ ...PERIODE_FORM_INITIAL }); }} className="mt-4 rounded-lg bg-[#117246] px-4 py-2 text-sm font-bold text-white">Lihat Daftar Periode</button></div> : null}
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
                                        <p className="font-semibold text-[#1f3160]">{formatDosenFullName(row.ketua.ketua_dosen.nama, row.ketua.ketua_dosen.gelar)}</p>
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
                        Penanggung Jawab Periode
                      </p>
                      <p className="mt-1 text-sm text-[#5d6c91]">
                        Penanggung jawab ditetapkan sebelum periode dibuka dan tidak dapat diubah ketika periode sudah aktif atau selesai.
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
                              <p className="mt-1 text-sm font-semibold text-[#1f3160]">{formatDosenFullName(dosen?.nama, dosen?.gelar) || "-"}</p>
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
                            <p className="mt-1 text-sm font-semibold text-[#1f3160]">{formatDosenFullName(item.dosen?.nama, item.dosen?.gelar) || "-"}</p>
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
