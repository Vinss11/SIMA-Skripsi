import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowLeft,
  Eye,
  FileSearch,
  RefreshCcw,
} from "lucide-react";

const PAGE_SIZE = 20;

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

function formatLabel(value) {
  if (!value) return "-";
  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getStatusChip(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "approved") {
    return {
      label: "Approved",
      className: "bg-[#137748] text-white",
    };
  }
  if (normalized === "rejected") {
    return {
      label: "Rejected",
      className: "bg-[#b73a3a] text-white",
    };
  }
  if (normalized === "pending") {
    return {
      label: "Pending",
      className: "bg-[#fdf1d4] text-[#a06a00]",
    };
  }
  if (normalized === "menunggu_approval_sekprodi") {
    return {
      label: "Menunggu Sekprodi",
      className: "bg-[#e8efff] text-[#2f63e3]",
    };
  }
  if (normalized === "menunggu_pengajuan") {
    return {
      label: "Belum Mengajukan",
      className: "bg-[#eef3ff] text-[#2f63e3]",
    };
  }
  if (normalized === "review_dosen_magang" || normalized === "submitted") {
    return {
      label: "Menunggu Review Dosen",
      className: "bg-[#fdf1d4] text-[#a06a00]",
    };
  }
  if (normalized === "review_sekprodi") {
    return {
      label: "Menunggu Sekprodi",
      className: "bg-[#e8efff] text-[#2f63e3]",
    };
  }
  return {
    label: formatLabel(status),
    className: "bg-[#eef2fb] text-[#5c6d95]",
  };
}

function getTahapLabel(tahapApproval, tipePengajuan, status) {
  const tahap = String(tahapApproval || "");
  const normalizedStatus = String(status || "").toLowerCase();

  if (normalizedStatus === "approved") return "Selesai (Disetujui)";
  if (normalizedStatus === "rejected") return "Selesai (Ditolak)";
  if (tahap === "menunggu_pengajuan_judul") return "Menunggu Pengajuan";
  if (tahap === "submitted") return "Menunggu Review Dosen Pengampu";
  if (tahap === "review_dosen_magang") return "Menunggu Review Dosen Pengawas Magang";
  if (tahap === "review_sekprodi") return "Menunggu Keputusan Final Sekprodi";
  if (tahap === "pending_ketua_klaster") return "Menunggu Review Ketua Cluster";
  if (tahap === "menunggu_set_ketua_cluster") return "Menunggu Penetapan Ketua Cluster";
  if (tahap === "menunggu_approval_sekprodi") return "Menunggu Persetujuan Sekprodi";
  if (tahap === "pending_dosen_pembimbing") return "Menunggu Review Dosen Pembimbing";
  if (tahap === "pending_review_parallel") return "Menunggu Review Dosen";
  if (tahap === "deadline_terlewati") return "Menunggu Review Dosen";
  if (normalizedStatus === "pending") return "Sedang Direview";
  return formatLabel(tahap || status || "-");
}

function getJenisPendaftaranDisplay(row) {
  return formatLabel(row?.pendaftaran?.jenis_pendaftaran || row?.jenis_jalur);
}

function getProgramJalurDisplay(row) {
  return formatLabel(row?.pendaftaran?.jalur_program || row?.jalur_program || "penelitian");
}

function getUniversalTitleDisplay(row, detail = null) {
  if (!row) return "-";
  if (row.record_type === "non_penelitian") {
    return row.summary_title || detail?.detail_pengajuan?.ringkasan || "-";
  }
  return getJudulDisplay(row, detail);
}

function getUniversalSummaryDetail(row, detail = null) {
  if (!row) return "-";
  if (row.record_type === "non_penelitian") {
    return row.summary_detail || detail?.detail_pengajuan?.ringkasan_detail || "-";
  }
  const cluster = getClusterDisplay(row);
  const kode = getKodeTopikDisplay(row);
  return [cluster !== "-" ? cluster : null, kode !== "-" ? kode : null].filter(Boolean).join(" | ") || "-";
}

function getCurrentReviewerDisplay(row, detail = null) {
  if (!row) return "-";
  if (row.record_type === "non_penelitian") return row.reviewer_saat_ini || "-";
  if (shouldShowTopikReviewCountdown(row)) return "Dosen Pembimbing";
  const latestHistory = Array.isArray(detail?.riwayat_persetujuan)
    ? detail.riwayat_persetujuan[detail.riwayat_persetujuan.length - 1]
    : null;
  return latestHistory?.dosen?.nama || "-";
}

function getDosenPembimbingDisplay(row, detail = null) {
  if (!row) return "-";
  return (
    row.dosen_pembimbing ||
    detail?.hasil_pengajuan?.dosen_pembimbing?.nama ||
    detail?.detail_pengajuan?.calon_dosen_pembimbing?.nama ||
    "-"
  );
}

function Timeline({ items = [] }) {
  if (!Array.isArray(items) || items.length === 0) {
    return (
      <div className="rounded-lg border border-[#e8ecf6] bg-white p-4 text-sm text-[#5f6b89]">
        Belum ada timeline workflow.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => {
        const chip = getStatusChip(item.status);
        return (
          <div key={`timeline-${index}-${item.status || "item"}`} className="rounded-lg border border-[#e8ecf6] bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${chip.className}`}>{chip.label}</span>
              <span className="text-xs font-semibold text-[#68779e]">{formatDateTime(item.at)}</span>
            </div>
            <p className="mt-2 text-sm font-semibold text-[#26355f]">{item.note || "-"}</p>
            {item.actor ? <p className="mt-1 text-xs text-[#68779e]">Aktor: {formatLabel(item.actor)}</p> : null}
          </div>
        );
      })}
    </div>
  );
}

function getApprovalRoleLabel(value) {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "koordinator") return "Ketua Cluster";
  if (normalized === "ketua_klaster" || normalized === "ketua_cluster") return "Ketua Cluster";
  if (normalized === "calon_pembimbing") return "Dosen Pembimbing";
  return formatLabel(value);
}

function DetailField({ label, value }) {
  return (
    <div className="rounded-lg border border-[#e3ebf8] bg-[#fbfdff] p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-[#68779e]">{label}</p>
      <p className="mt-1 text-sm font-black text-[#1a2648]">{value || "-"}</p>
    </div>
  );
}

function TextBlock({ label, children }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-[#68779e]">{label}</p>
      <div className="mt-1 rounded-lg border border-[#e5ecf8] bg-white px-3 py-2 text-sm leading-relaxed text-[#26355f]">
        {children || "-"}
      </div>
    </div>
  );
}

function NonPenelitianDetail({ detail }) {
  const payload = detail?.detail_pengajuan?.payload || {};
  const jalur = String(detail?.detail_pengajuan?.jalur || detail?.jalur_program || "").toLowerCase();

  if (jalur === "magang") {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <DetailField label="Tipe Perusahaan" value={formatLabel(payload.company_type)} />
          <DetailField label="Institusi / Perusahaan" value={payload.chosen_institution || payload.company_name || "-"} />
          <DetailField label="Posisi Magang" value={payload.proposed_position_other || payload.proposed_position || "-"} />
          <DetailField label="Sektor Perusahaan" value={payload.company_sector_other || payload.company_sector || "-"} />
          <DetailField label="Nomor Telepon" value={payload.phone_number || "-"} />
          <DetailField label="Sudah Apply" value={payload.sudah_apply_ke_mitra === true ? "Sudah" : "Belum"} />
          <DetailField label="Tanggal Apply" value={payload.tanggal_apply || "-"} />
          <DetailField label="Metode Apply" value={payload.metode_apply || "-"} />
        </div>
        <TextBlock label="Alamat Institusi">{payload.complete_address_of_institution || "-"}</TextBlock>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <DetailField label="Website Perusahaan" value={payload.internship_company_website_url || "-"} />
          <DetailField label="URL Vacancy" value={payload.internship_vacancy_url || "-"} />
          <DetailField label="CV" value={payload.cv_file_name || "-"} />
          <DetailField label="Portfolio" value={payload.portfolio_file_name || "-"} />
          <DetailField label="Transkrip" value={payload.transcript_file_name || "-"} />
          <DetailField label="Dokumen Pendukung" value={payload.other_supporting_documents_file_name || "-"} />
          <DetailField label="Catatan Dokumen" value={payload.supporting_documents_note || "-"} />
          <DetailField label="Bukti Apply" value={payload.bukti_apply || "-"} />
        </div>
      </div>
    );
  }

  if (jalur === "pengabdian") {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <DetailField label="Nama Program" value={payload.nama_program || "-"} />
          <DetailField label="Nama Mitra" value={payload.nama_mitra || "-"} />
          <DetailField label="Jenis Mitra" value={payload.jenis_mitra || "-"} />
          <DetailField label="Lokasi" value={payload.lokasi_pengabdian || "-"} />
          <DetailField label="Kontak Mitra" value={payload.kontak_mitra || "-"} />
          <DetailField label="Periode Mulai" value={payload.periode_mulai || "-"} />
          <DetailField label="Periode Selesai" value={payload.periode_selesai || "-"} />
          <DetailField label="Target Luaran" value={payload.target_luaran || "-"} />
        </div>
        <TextBlock label="Permasalahan Mitra">{payload.permasalahan_mitra || "-"}</TextBlock>
        <TextBlock label="Solusi Ditawarkan">{payload.solusi_ditawarkan || "-"}</TextBlock>
        <TextBlock label="Deskripsi Kegiatan">{payload.deskripsi_kegiatan || "-"}</TextBlock>
        <TextBlock label="Penerima Manfaat">{payload.penerima_manfaat || "-"}</TextBlock>
        <TextBlock label="Rencana Pelaksanaan">{payload.rencana_pelaksanaan || "-"}</TextBlock>
        <TextBlock label="Indikator Keberhasilan">{payload.indikator_keberhasilan || "-"}</TextBlock>
      </div>
    );
  }

  if (jalur === "perintisan_bisnis") {
    const members = Array.isArray(payload.kelompok?.anggota) ? payload.kelompok.anggota : [];
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <DetailField label="Nama Bisnis" value={payload.nama_bisnis || "-"} />
          <DetailField label="Jenis Bisnis" value={payload.jenis_bisnis || "-"} />
          <DetailField label="Lokasi Bisnis" value={payload.lokasi_bisnis || "-"} />
          <DetailField label="Peran Anda" value={formatLabel(payload.kelompok?.current_peran_tim || "-")} />
          <DetailField label="Model Bisnis" value={payload.model_bisnis || "-"} />
          <DetailField label="Tahap Perkembangan" value={payload.tahap_perkembangan || "-"} />
          <DetailField label="Target Luaran" value={payload.target_luaran || "-"} />
          <DetailField label="Tautan Bisnis" value={payload.tautan_bisnis || "-"} />
        </div>
        <TextBlock label="Anggota Kelompok">
          <div className="space-y-1">
            {members.length > 0
              ? members.map((member) => (
                  <p key={`member-${member.mahasiswa_id || member.nim}`}>
                    {member.nama || "-"} ({member.nim || "-"}) - {formatLabel(member.peran_tim || member.posisi || "-")}
                  </p>
                ))
              : "-"}
          </div>
        </TextBlock>
        <TextBlock label="Deskripsi Bisnis">{payload.deskripsi_bisnis || "-"}</TextBlock>
        <TextBlock label="Masalah yang Diselesaikan">{payload.masalah_yang_diselesaikan || "-"}</TextBlock>
        <TextBlock label="Produk / Layanan">{payload.produk_layanan || "-"}</TextBlock>
        <TextBlock label="Target Konsumen">{payload.target_konsumen || "-"}</TextBlock>
        <TextBlock label="Rencana Kegiatan">{payload.rencana_kegiatan || "-"}</TextBlock>
      </div>
    );
  }

  return (
    <TextBlock label="Payload Pengajuan">
      {payload.ringkasan || detail?.detail_pengajuan?.ringkasan || "-"}
    </TextBlock>
  );
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

function normalizeClusterFromTopikCode(code) {
  const value = String(code || "").trim().toUpperCase();
  if (!value) return null;
  if (value.startsWith("SIRKER")) return "SIRKEL";
  if (value.startsWith("SIRKEL")) return "SIRKEL";
  if (value.startsWith("ITSC")) return "ITSC";
  if (value.startsWith("SIBER")) return "SIBER";
  if (value.startsWith("MVK")) return "MVK";
  if (value.startsWith("MEDIS") || value.startsWith("SDATA")) return "ITSC";
  return null;
}

function getTopikCodesFromRow(row) {
  if (!row || row.tipe_pengajuan !== "topik_dosen") return [];
  if (!Array.isArray(row.topik_dipilih)) return [];
  return row.topik_dipilih.filter(Boolean);
}

function getKodeTopikDisplay(row) {
  if (!row || row.tipe_pengajuan !== "topik_dosen") return "-";
  const approvedKode = typeof row.topik_disetujui === "object" ? row.topik_disetujui?.kode : null;
  if (approvedKode) return approvedKode;
  const codes = getTopikCodesFromRow(row);
  return codes.length > 0 ? codes.join(", ") : "-";
}

function getJudulDisplay(row, detail = null) {
  if (!row) return "-";
  if (row.record_type === "pendaftaran") return "Belum diajukan";
  if (row.tipe_pengajuan === "judul_mandiri") {
    return row.judul_mandiri?.judul || detail?.detail_pengajuan?.judul_mandiri || "-";
  }
  if (row.tipe_pengajuan !== "topik_dosen") return "-";
  if (typeof row.topik_disetujui === "object" && row.topik_disetujui?.judul) {
    return row.topik_disetujui.judul;
  }
  if (typeof row.topik_disetujui === "string" && row.topik_disetujui.trim()) {
    return row.topik_disetujui;
  }
  if (Array.isArray(row.topik_dipilih_detail) && row.topik_dipilih_detail.length > 0) {
    return row.topik_dipilih_detail
      .map((item) => item?.judul)
      .filter(Boolean)
      .join(" | ") || "-";
  }
  if (Array.isArray(detail?.detail_pengajuan?.topik_dipilih) && detail.detail_pengajuan.topik_dipilih.length > 0) {
    return detail.detail_pengajuan.topik_dipilih
      .map((item) => item?.judul)
      .filter(Boolean)
      .join(" | ") || "-";
  }
  return "-";
}

function getClusterDisplay(row) {
  if (!row) return "-";
  if (row.tipe_pengajuan === "judul_mandiri") {
    return row.judul_mandiri?.cluster || row.cluster_mandiri || "-";
  }
  if (row.tipe_pengajuan !== "topik_dosen") return "-";
  if (typeof row.topik_disetujui === "object" && row.topik_disetujui?.cluster) {
    return row.topik_disetujui.cluster;
  }
  if (Array.isArray(row.topik_dipilih_detail) && row.topik_dipilih_detail.some((item) => item?.cluster)) {
    const clusters = [...new Set(row.topik_dipilih_detail.map((item) => item?.cluster).filter(Boolean))];
    return clusters.length > 0 ? clusters.join(", ") : "-";
  }
  const codes = [];
  if (typeof row.topik_disetujui === "object" && row.topik_disetujui?.kode) {
    codes.push(row.topik_disetujui.kode);
  } else {
    codes.push(...getTopikCodesFromRow(row));
  }

  const clusters = [...new Set(codes.map(normalizeClusterFromTopikCode).filter(Boolean))];
  return clusters.length > 0 ? clusters.join(", ") : "-";
}

function getSidangStatusChip(sidangStatus) {
  const registration = sidangStatus?.pendaftaran_aktif;
  if (registration?.jadwal_sidang) {
    return {
      label: "Sudah Dijadwalkan",
      className: "bg-[#dff3ec] text-[#106d45]",
    };
  }
  if (String(registration?.status || "").toLowerCase() === "submitted") {
    return {
      label: "Menunggu Penjadwalan",
      className: "bg-[#fdf1d4] text-[#a06a00]",
    };
  }
  if (sidangStatus?.can_register) {
    return {
      label: "Siap Daftar Sidang",
      className: "bg-[#eef3ff] text-[#2f63e3]",
    };
  }
  return {
    label: "Belum Dijadwalkan",
    className: "bg-[#eef2fb] text-[#5c6d95]",
  };
}

function buildSidangScheduleLabel(schedule) {
  if (!schedule) return "Belum ada jadwal sidang.";
  return `${schedule.tanggal_sidang} | Sesi ${schedule.sesi_ke} (${schedule.sesi_mulai}-${schedule.sesi_selesai}) | ${schedule.ruangan}`;
}

function StatusPage({
  session,
  apiBaseUrl,
  onSessionExpired,
  initialSubmissions = [],
}) {
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [sidangStatusError, setSidangStatusError] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);
  const [sidangStatus, setSidangStatus] = useState(null);

  const [submissions, setSubmissions] = useState(
    Array.isArray(initialSubmissions) ? initialSubmissions : []
  );
  const [selectedSubmissionId, setSelectedSubmissionId] = useState(
    Array.isArray(initialSubmissions) && initialSubmissions[0] ? initialSubmissions[0].id : null
  );
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [viewMode, setViewMode] = useState("list");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => {
    let isMounted = true;

    const fetchWithAuth = async (path) => {
      const response = await fetch(`${apiBaseUrl}${path}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.token}`,
          "Content-Type": "application/json",
        },
      });

      const payload = await response.json().catch(() => null);
      const message = String(payload?.message || "").toLowerCase();
      const tokenError =
        message.includes("token tidak valid") ||
        message.includes("token tidak ditemukan") ||
        message.includes("kadaluarsa");

      if (response.status === 401 || (response.status === 403 && tokenError)) {
        onSessionExpired?.();
        throw new Error("__SESSION_EXPIRED__");
      }

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || `Gagal memuat data ${path}`);
      }

      return payload.data;
    };

    const loadSummary = async () => {
      setLoading(true);
      setError("");
      setSidangStatusError("");

      const [submissionsResult, sidangResult] = await Promise.allSettled([
        fetchWithAuth("/api/submissions"),
        fetchWithAuth("/api/mahasiswa/sidang/status"),
      ]);

      if (!isMounted) return;

      const issues = [];
      let nextSubmissions = [];

      if (submissionsResult.status === "fulfilled") {
        nextSubmissions = Array.isArray(submissionsResult.value) ? submissionsResult.value : [];
        setSubmissions(nextSubmissions);
      } else if (submissionsResult.reason?.message !== "__SESSION_EXPIRED__") {
        setSubmissions([]);
        issues.push(submissionsResult.reason?.message || "Gagal memuat data submissions.");
      }

      if (sidangResult.status === "fulfilled") {
        setSidangStatus(sidangResult.value || null);
      } else if (sidangResult.reason?.message !== "__SESSION_EXPIRED__") {
        setSidangStatus(null);
        setSidangStatusError(
          sidangResult.reason?.message || "Gagal memuat informasi jadwal sidang."
        );
      }

      if (nextSubmissions.length === 0) {
        setSelectedSubmissionId(null);
        setSelectedDetail(null);
        setViewMode("list");
      } else {
        const firstPengajuan = nextSubmissions.find((row) => row.record_type !== "pendaftaran");
        setSelectedSubmissionId((prev) =>
          nextSubmissions.some((row) => row.id === prev && row.record_type !== "pendaftaran")
            ? prev
            : firstPengajuan?.id || null
        );
      }

      setError(issues.join(" "));
      setLoading(false);
    };

    loadSummary();

    return () => {
      isMounted = false;
    };
  }, [apiBaseUrl, onSessionExpired, refreshTick, session.token]);

  useEffect(() => {
    let isMounted = true;
    if (!selectedSubmissionId) {
      setSelectedDetail(null);
      setDetailError("");
      return;
    }

    const fetchWithAuth = async (path) => {
      const response = await fetch(`${apiBaseUrl}${path}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.token}`,
          "Content-Type": "application/json",
        },
      });

      const payload = await response.json().catch(() => null);
      const message = String(payload?.message || "").toLowerCase();
      const tokenError =
        message.includes("token tidak valid") ||
        message.includes("token tidak ditemukan") ||
        message.includes("kadaluarsa");

      if (response.status === 401 || (response.status === 403 && tokenError)) {
        onSessionExpired?.();
        throw new Error("__SESSION_EXPIRED__");
      }

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || `Gagal memuat detail pengajuan ${selectedSubmissionId}`);
      }

      return payload.data;
    };

    const loadDetail = async () => {
      setLoadingDetail(true);
      setDetailError("");

      try {
        const detail = await fetchWithAuth(`/api/submissions/${selectedSubmissionId}`);
        if (!isMounted) return;
        setSelectedDetail(detail || null);
      } catch (detailLoadError) {
        if (!isMounted) return;
        if (detailLoadError.message !== "__SESSION_EXPIRED__") {
          setSelectedDetail(null);
          setDetailError(detailLoadError.message || "Gagal memuat detail pengajuan.");
        }
      } finally {
        if (isMounted) setLoadingDetail(false);
      }
    };

    loadDetail();

    return () => {
      isMounted = false;
    };
  }, [apiBaseUrl, onSessionExpired, refreshTick, selectedSubmissionId, session.token]);

  const filteredRows = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return submissions;

    return submissions.filter((row) => {
      const topikText = getUniversalTitleDisplay(row);
      const kodeTopik = getKodeTopikDisplay(row);
      const cluster = getClusterDisplay(row);

      const haystack = [
        row.id,
        row.jenis_jalur,
        row.jalur_program,
        row.pendaftaran?.jenis_pendaftaran,
        row.pendaftaran?.jalur_program,
        row.tipe_pengajuan,
        row.status,
        row.tahap_approval,
        row.tahap_label,
        row.summary_title,
        row.summary_detail,
        row.reviewer_saat_ini,
        topikText,
        kodeTopik,
        cluster,
        row.judul_mandiri?.keyword,
        row.judul_mandiri?.cluster,
        ...(Array.isArray(row.topik_dipilih_detail)
          ? row.topik_dipilih_detail.flatMap((item) => [item?.keyword, item?.cluster])
          : []),
        row.dosen_pembimbing,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(keyword);
    });
  }, [query, submissions]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE)),
    [filteredRows.length]
  );

  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, page]);

  const rowStart = filteredRows.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rowEnd = filteredRows.length === 0 ? 0 : Math.min(filteredRows.length, page * PAGE_SIZE);

  const selectedSubmissionRow = useMemo(
    () => submissions.find((row) => row.id === selectedSubmissionId) || null,
    [submissions, selectedSubmissionId]
  );
  const selectedTopikRows = useMemo(() => {
    if (!selectedDetail || selectedDetail.tipe_pengajuan !== "topik_dosen") return [];
    return Array.isArray(selectedDetail.detail_pengajuan?.topik_dipilih)
      ? selectedDetail.detail_pengajuan.topik_dipilih
      : [];
  }, [selectedDetail]);
  const alasanPenolakanList = useMemo(() => {
    const raw = selectedDetail?.hasil_pengajuan?.alasan_penolakan;
    if (Array.isArray(raw)) return raw.filter((item) => String(item || "").trim().length > 0);
    if (typeof raw === "string" && raw.trim().length > 0) return [raw.trim()];
    return [];
  }, [selectedDetail]);
  const selectedStatusChip = getStatusChip(selectedDetail?.status || selectedSubmissionRow?.status || "-");
  const selectedTahapLabel = getTahapLabel(
    selectedDetail?.tahap_approval || selectedSubmissionRow?.tahap_approval,
    selectedDetail?.tipe_pengajuan || selectedSubmissionRow?.tipe_pengajuan,
    selectedDetail?.status || selectedSubmissionRow?.status
  );
  const selectedHistory = Array.isArray(selectedDetail?.riwayat_persetujuan)
    ? selectedDetail.riwayat_persetujuan
    : [];
  const pembimbingDecision =
    selectedHistory.find((item) => String(item?.tipe_approval || "").toLowerCase() === "calon_pembimbing") || null;
  const ketuaClusterDecision =
    selectedHistory.find((item) => String(item?.tipe_approval || "").toLowerCase() === "koordinator") || null;
  const pembimbingDecisionChip = pembimbingDecision ? getStatusChip(pembimbingDecision.status) : null;
  const ketuaClusterDecisionChip = ketuaClusterDecision ? getStatusChip(ketuaClusterDecision.status) : null;
  const pembimbingName =
    pembimbingDecision?.dosen?.nama ||
    selectedDetail?.hasil_pengajuan?.dosen_pembimbing?.nama ||
    selectedDetail?.detail_pengajuan?.calon_dosen_pembimbing?.nama ||
    "-";
  const sidangChip = getSidangStatusChip(sidangStatus);
  const sidangSchedule =
    sidangStatus?.pendaftaran_aktif?.jadwal_sidang ||
    sidangStatus?.riwayat_terakhir?.jadwal_sidang ||
    null;
  const sidangPenguji1 = sidangSchedule?.penguji1?.nama || "-";
  const sidangPenguji2 = sidangSchedule?.penguji2?.nama || "-";
  const countedSessions = Number(sidangStatus?.eligibility?.counted_sessions || 0);
  const targetSessions = Number(sidangStatus?.eligibility?.target_minimum || 8);
  const approvedDocs = Number(sidangStatus?.eligibility?.dokumen_approved_count || 0);
  const totalDocs = Number(sidangStatus?.eligibility?.dokumen_total_required || 3);

  const handleOpenDetail = (submissionId) => {
    setSelectedSubmissionId(submissionId);
    setViewMode("detail");
  };

  const handleBackToList = () => {
    setViewMode("list");
  };

  const handleRefresh = () => {
    setRefreshTick((prev) => prev + 1);
  };

  return (
    <div className="w-full space-y-4 pb-8">
      {error ? (
        <div className="rounded-lg border border-[#f5d0d0] bg-[#fff2f2] px-4 py-3 text-sm font-semibold text-[#a03f3f]">
          {error}
        </div>
      ) : null}

      

      <section className="rounded-xl border border-[#dce4f7] bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleBackToList}
            disabled={viewMode === "list"}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#d3dbef] text-[#27407b] transition hover:bg-[#f3f6ff] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Kembali ke daftar riwayat pengajuan"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleRefresh}
            className="inline-flex items-center gap-2 rounded-lg border border-[#d3dbef] px-3 py-2 text-sm font-semibold text-[#27407b] transition hover:bg-[#f3f6ff]"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-[#e8ecf6] bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-black text-[#1a2648]">Status Sidang Akhir</h3>
          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${sidangChip.className}`}>
            {sidangChip.label}
          </span>
        </div>

        {sidangStatusError ? (
          <div className="mb-3 rounded-lg border border-[#f5d0d0] bg-[#fff2f2] px-3 py-2 text-sm font-semibold text-[#a03f3f]">
            {sidangStatusError}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-[#e8ecf6] bg-white p-3 text-sm text-[#26355f]">
            <p>
              <span className="font-semibold">Progress Bimbingan:</span> {countedSessions} / {targetSessions}
            </p>
            <p className="mt-1">
              <span className="font-semibold">Dokumen Approved:</span> {approvedDocs} / {totalDocs}
            </p>
            <p className="mt-1">
              <span className="font-semibold">Periode Sidang Aktif:</span>{" "}
              {sidangStatus?.periode_sidang_aktif?.label_periode || "-"}
            </p>
            <p className="mt-1">
              <span className="font-semibold">Status Pendaftaran:</span>{" "}
              {sidangStatus?.pendaftaran_aktif?.status
                ? formatLabel(sidangStatus.pendaftaran_aktif.status)
                : "Belum daftar / belum ada periode aktif"}
            </p>
          </div>

          <div className="rounded-lg border border-[#e8ecf6] bg-white p-3 text-sm text-[#26355f]">
            <p>
              <span className="font-semibold">Jadwal & Ruangan:</span> {buildSidangScheduleLabel(sidangSchedule)}
            </p>
            <p className="mt-1">
              <span className="font-semibold">Penguji 1:</span> {sidangPenguji1}
            </p>
            <p className="mt-1">
              <span className="font-semibold">Penguji 2:</span> {sidangPenguji2}
            </p>
            <p className="mt-1">
              <span className="font-semibold">Terdaftar Pada:</span>{" "}
              {formatDateTime(sidangStatus?.pendaftaran_aktif?.registered_at)}
            </p>
          </div>
        </div>

        {!sidangSchedule ? (
          <p className="mt-3 rounded-lg border border-[#f2dfb3] bg-[#fff9e9] px-3 py-2 text-sm font-semibold text-[#7a5a00]">
            Informasi penguji dan ruangan akan muncul otomatis setelah sekretaris prodi menyelesaikan penjadwalan sidang.
          </p>
        ) : null}
      </section>

      {viewMode === "list" ? (
      <section className="rounded-xl border border-[#e8ecf6] bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-black text-[#1a2648]">Riwayat Pengajuan</h3>
          <div className="relative">
            <Activity className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7282a8]" />
            <input
              type="text"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Cari ID, jalur, status, ringkasan, reviewer..."
              className="w-[320px] rounded-lg border border-[#d3dbef] py-2 pl-8 pr-3 text-sm outline-none focus:border-[#2f63e3]"
            />
          </div>
        </div>

        <div className="relative overflow-auto rounded-lg border border-[#e6ecf8] bg-white grid-unified-height-dynamic">
          <table className="w-full min-w-[1180px] text-left text-sm">
            <thead>
              <tr className="border-y border-[#e6ecf8] text-[#4d5e89]">
                <th className="bg-[#f8fbff] px-3 py-2 font-semibold">No</th>
                <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Pendaftaran</th>
                <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Jalur</th>
                <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Ringkasan</th>
                <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Detail</th>
                <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Status</th>
                <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Tahap</th>
                <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Reviewer Saat Ini</th>
                <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Dosen Pembimbing</th>
                <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Diperbarui</th>
                <th className="bg-[#f8fbff] px-3 py-2 font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((row, index) => {
                const chip = getStatusChip(row.status);
                const isSelected = row.id === selectedSubmissionId;
                const titleDisplay = getUniversalTitleDisplay(
                  row,
                  row.id === selectedSubmissionId ? selectedDetail : null
                );
                const detailDisplay = getUniversalSummaryDetail(
                  row,
                  row.id === selectedSubmissionId ? selectedDetail : null
                );
                return (
                  <tr key={`status-row-${row.id}`} className="border-b border-[#eff3fb]">
                    <td className="px-3 py-2 font-bold text-[#274181]">{rowStart + index}</td>
                    <td className="px-3 py-2">{getJenisPendaftaranDisplay(row)}</td>
                    <td className="px-3 py-2">{getProgramJalurDisplay(row)}</td>
                    <td className="px-3 py-2 max-w-[300px] truncate" title={titleDisplay}>
                      {titleDisplay}
                    </td>
                    <td className="px-3 py-2 max-w-[260px] truncate" title={detailDisplay}>{detailDisplay}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-1 text-xs font-bold ${chip.className}`}>
                        {chip.label}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-xs font-semibold text-[#4f5d85]">
                        {row.tahap_label || getTahapLabel(row.tahap_approval, row.tipe_pengajuan, row.status)}
                      </span>
                    </td>
                    <td className="px-3 py-2">{getCurrentReviewerDisplay(row)}</td>
                    <td className="px-3 py-2">{getDosenPembimbingDisplay(row)}</td>
                    <td className="px-3 py-2">{formatDateTime(row.updatedAt || row.createdAt)}</td>
                    <td className="px-3 py-2">
                      {row.record_type === "pendaftaran" ? (
                        <span className="text-xs font-semibold text-[#7180a5]">Menunggu form</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(row.id)}
                          className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-bold text-white transition ${
                            isSelected ? "bg-[#2354cf]" : "bg-[#2f63e3] hover:brightness-110"
                          }`}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Detail
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {!loading && filteredRows.length === 0 ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[41px] flex items-center justify-center px-4 text-center text-sm font-semibold text-[#7b88ab]">
              Belum ada riwayat pengajuan.
            </div>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[#e8edf8] pt-3">
          <p className="text-sm text-[#4f5e86]">
            Menampilkan {rowStart} - {rowEnd} dari {filteredRows.length} data pengajuan.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page === 1}
              className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] transition hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Sebelumnya
            </button>
            <span className="text-sm font-semibold text-[#314778]">
              Halaman {page} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page >= totalPages}
              className="rounded-md border border-[#d1daf0] px-3 py-1.5 text-sm font-semibold text-[#314778] transition hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Berikutnya
            </button>
          </div>
        </div>
      </section>
      ) : null}

      {viewMode === "detail" && selectedDetail ? (
        <div className="space-y-4">
          <section className="rounded-xl border border-[#e8ecf6] bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-xl font-black text-[#1a2648]">Detail Pengajuan</h3>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${selectedStatusChip.className}`}>
                {selectedStatusChip.label}
              </span>
            </div>

            {detailError ? (
              <div className="rounded-lg border border-[#f5d0d0] bg-[#fff2f2] px-3 py-2 text-sm font-semibold text-[#a03f3f]">
                {detailError}
              </div>
            ) : null}

            {loadingDetail ? (
              <div className="rounded-lg border border-[#e8edf8] bg-white p-4 text-sm font-semibold text-[#5f6b89]">
                Memuat detail pengajuan...
              </div>
            ) : null}

            {!loadingDetail && !selectedDetail ? (
              <div className="rounded-lg border border-[#e8edf8] bg-white p-6 text-center">
                <FileSearch className="mx-auto h-10 w-10 text-[#7b88ab]" />
                <p className="mt-3 text-sm font-semibold text-[#5f6b89]">
                  Pilih salah satu pengajuan untuk melihat detail.
                </p>
              </div>
            ) : null}

            {!loadingDetail && selectedDetail ? (
              <div className="space-y-4">
              <section className="rounded-lg border border-[#dfe8f7] bg-white p-4">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h4 className="text-base font-black text-[#1a2648]">Ringkasan Pengajuan</h4>
                    <p className="mt-1 text-sm text-[#5f6b89]">
                      Ringkasan jalur dan waktu pengajuan mahasiswa.
                    </p>
                  </div>
                  <span className="rounded-full bg-[#eef4ff] px-3 py-1 text-xs font-bold text-[#3158b7]">
                    {selectedTahapLabel}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <DetailField label="Jalur" value={formatLabel(selectedDetail.jenis_jalur)} />
                  <DetailField label="Tipe" value={formatLabel(selectedDetail.tipe_pengajuan)} />
                  <DetailField label="Diajukan Pada" value={formatDateTime(selectedDetail.diajukan_pada)} />
                  <DetailField label="Diperbarui Pada" value={formatDateTime(selectedDetail.diperbarui_pada)} />
                </div>
              </section>

              {shouldShowTopikReviewCountdown(selectedDetail) ? (
                <div className="rounded-lg border border-[#dbe4fa] bg-[#f8fbff] px-3 py-2 text-sm text-[#2f426f]">
                  <p className="font-bold">Menunggu seluruh dosen pilihan memberikan keputusan.</p>
                  <p className="mt-1 text-xs font-semibold">
                    Pengajuan tidak akan disetujui atau ditolak otomatis berdasarkan waktu.
                  </p>
                </div>
              ) : null}

              <section className="rounded-lg border border-[#dfe8f7] bg-white p-4">
                <div className="mb-3">
                  <h4 className="text-base font-black text-[#1a2648]">
                    {selectedDetail.record_type === "non_penelitian" ? "Detail Form Jalur" : "Detail Topik / Judul"}
                  </h4>
                  <p className="mt-1 text-sm text-[#5f6b89]">
                    Informasi substansi pengajuan yang sedang direview.
                  </p>
                </div>
                {selectedDetail.record_type === "non_penelitian" ? (
                  <NonPenelitianDetail detail={selectedDetail} />
                ) : selectedDetail.tipe_pengajuan === "judul_mandiri" ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
                      <DetailField label="Judul" value={selectedDetail.detail_pengajuan?.judul_mandiri || "-"} />
                      <DetailField label="Cluster" value={selectedDetail.detail_pengajuan?.cluster_mandiri || "-"} />
                    </div>
                    <TextBlock label="Deskripsi">
                      {selectedDetail.detail_pengajuan?.deskripsi_mandiri || "-"}
                    </TextBlock>
                    <TextBlock label="Keyword">
                      <div className="flex flex-wrap gap-2">
                        {String(selectedDetail.detail_pengajuan?.keyword_mandiri || "")
                          .split(",")
                          .map((item) => item.trim())
                          .filter(Boolean)
                          .map((item) => (
                            <span
                              key={`keyword-${selectedDetail.id}-${item}`}
                              className="rounded-full bg-[#eef4ff] px-2.5 py-1 text-xs font-bold text-[#3158b7]"
                            >
                              {item}
                            </span>
                          ))}
                        {!selectedDetail.detail_pengajuan?.keyword_mandiri ? "-" : null}
                      </div>
                    </TextBlock>
                  </div>
                ) : (
                  <div className="mt-3 space-y-3">
                    {selectedTopikRows.length > 0 ? (
                      selectedTopikRows.map((item) => (
                        <div
                          key={`status-detail-topik-${item.slot || item.kode}`}
                          className="rounded-lg border border-[#e8ecf6] bg-[#fbfdff] p-3"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="text-xs font-bold uppercase tracking-wide text-[#60719a]">
                                Pilihan {item.slot || "-"} {item.kode ? `- ${item.kode}` : ""}
                              </p>
                              <p className="mt-1 text-sm font-black text-[#1a2648]">{item.judul || "-"}</p>
                            </div>
                            {item.reviewer_status ? (
                              <span className={`rounded-full px-2 py-1 text-xs font-bold ${getStatusChip(item.reviewer_status).className}`}>
                                {getStatusChip(item.reviewer_status).label}
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-[#495a84] md:grid-cols-3">
                            <p><span className="font-semibold">Cluster:</span> {item.cluster || "-"}</p>
                            <p><span className="font-semibold">Keyword:</span> {item.keyword || "-"}</p>
                            <p><span className="font-semibold">Dosen:</span> {item.dosen || "-"}</p>
                          </div>
                          {item.reviewer_note ? (
                            <p className="mt-2 rounded-md bg-white px-3 py-2 text-sm text-[#26355f]">
                              {item.reviewer_note}
                            </p>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-[#5f6b89]">Detail topik belum tersedia.</p>
                    )}
                  </div>
                )}
              </section>

              {selectedDetail.record_type === "non_penelitian" ? (
                <section className="rounded-lg border border-[#dfe8f7] bg-white p-4">
                  <div className="mb-3">
                    <h4 className="text-base font-black text-[#1a2648]">Timeline Progress</h4>
                    <p className="mt-1 text-sm text-[#5f6b89]">
                      Urutan proses dari submit form sampai keputusan akhir.
                    </p>
                  </div>
                  <Timeline items={selectedDetail.workflow_timeline || []} />
                </section>
              ) : null}

              {selectedDetail.record_type === "non_penelitian" ? (
                <section className="rounded-lg border border-[#dfe8f7] bg-white p-4">
                  <div className="mb-3">
                    <h4 className="text-base font-black text-[#1a2648]">Hasil Review</h4>
                    <p className="mt-1 text-sm text-[#5f6b89]">
                      Keputusan dosen pengampu, keputusan final Sekprodi, dan dosen pembimbing jika sudah ditetapkan.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <DetailField
                      label="Review Dosen Pengampu"
                      value={formatLabel(selectedDetail.hasil_pengajuan?.review_dosen_pengampu?.status || "-")}
                    />
                    <DetailField
                      label="Catatan Dosen"
                      value={selectedDetail.hasil_pengajuan?.review_dosen_pengampu?.note || "-"}
                    />
                    <DetailField
                      label="Keputusan Final"
                      value={formatLabel(selectedDetail.hasil_pengajuan?.review_result?.status || "-")}
                    />
                    <DetailField
                      label="Dosen Pembimbing"
                      value={selectedDetail.hasil_pengajuan?.dosen_pembimbing?.nama || "-"}
                    />
                  </div>
                </section>
              ) : null}
              </div>
            ) : null}
          </section>

          {!loadingDetail && selectedDetail && selectedDetail.record_type !== "non_penelitian" ? (
            <>
              <section className="rounded-xl border border-[#e8ecf6] bg-white p-5 shadow-sm">
                <div className="mb-3">
                  <h3 className="text-xl font-black text-[#1a2648]">Hasil Keputusan Dosen</h3>
                  <p className="mt-1 text-sm text-[#5f6b89]">
                    Keputusan awal dari dosen pembimbing sebelum masuk ke ketua cluster.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                  <DetailField label="Dosen Pembimbing" value={pembimbingName} />
                  <div className="rounded-lg border border-[#e3ebf8] bg-[#fbfdff] p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-[#68779e]">Keputusan</p>
                    <div className="mt-2">
                      {pembimbingDecisionChip ? (
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${pembimbingDecisionChip.className}`}>
                          {pembimbingDecisionChip.label}
                        </span>
                      ) : (
                        <span className="text-sm font-black text-[#1a2648]">Belum ada keputusan</span>
                      )}
                    </div>
                  </div>
                  <DetailField
                    label="Tanggal Keputusan"
                    value={formatDateTime(pembimbingDecision?.tanggal_keputusan)}
                  />
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
                  <TextBlock label="Catatan Persetujuan">
                    {pembimbingDecision?.status === "approved"
                      ? pembimbingDecision?.keterangan || selectedDetail.hasil_pengajuan?.alasan_persetujuan || "-"
                      : selectedDetail.hasil_pengajuan?.alasan_persetujuan || "-"}
                  </TextBlock>
                  <TextBlock label="Catatan Penolakan">
                    {alasanPenolakanList.length > 0 ? alasanPenolakanList.join("; ") : "-"}
                  </TextBlock>
                </div>
                <div className="mt-3 rounded-lg border border-[#e8ecf6] bg-[#fbfdff] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-[#68779e]">Keputusan Ketua Cluster</p>
                      <p className="mt-1 text-sm font-semibold text-[#26355f]">
                        {ketuaClusterDecision?.dosen?.nama || "Belum ada keputusan ketua cluster."}
                      </p>
                    </div>
                    {ketuaClusterDecisionChip ? (
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${ketuaClusterDecisionChip.className}`}>
                        {ketuaClusterDecisionChip.label}
                      </span>
                    ) : (
                      <span className="rounded-full bg-[#eef4ff] px-2.5 py-1 text-xs font-bold text-[#3158b7]">
                        {selectedTahapLabel}
                      </span>
                    )}
                  </div>
                  {ketuaClusterDecision?.keterangan ? (
                    <p className="mt-2 text-sm text-[#26355f]">{ketuaClusterDecision.keterangan}</p>
                  ) : null}
                </div>
              </section>

              <section className="rounded-xl border border-[#e8ecf6] bg-white p-5 shadow-sm">
                <h3 className="text-xl font-black text-[#1a2648]">Detail Keputusan</h3>
                <div className="mt-3 space-y-3">
                  {(selectedDetail.riwayat_persetujuan || []).length > 0 ? (
                    selectedDetail.riwayat_persetujuan.map((item, index) => {
                      const chip = getStatusChip(item.status);
                      return (
                        <div
                          key={`riwayat-${selectedDetail.id}-${index}`}
                          className="rounded-lg border border-[#e8ecf6] bg-white p-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className={`rounded-full px-2 py-1 text-xs font-bold ${chip.className}`}>
                                {chip.label}
                              </span>
                              <span className="text-xs font-semibold text-[#5b688b]">
                                {getApprovalRoleLabel(item.tipe_approval)}
                              </span>
                            </div>
                            <span className="text-xs font-semibold text-[#5b688b]">
                              {item.dosen?.nama || "-"} | {formatDateTime(item.tanggal_keputusan)}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-[#26355f]">{item.keterangan || "-"}</p>
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-lg border border-[#e8ecf6] bg-white p-4 text-sm text-[#5f6b89]">
                      Belum ada keputusan reviewer untuk pengajuan ini.
                    </div>
                  )}
                </div>
              </section>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default StatusPage;


