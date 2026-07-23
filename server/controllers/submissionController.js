const fs = require("fs");
const path = require("path");
const { Op } = require("sequelize");
const {
  Pengajuan,
  Mahasiswa,
  Dosen,
  Topik,
  RiwayatPersetujuan,
  PamitUlang,
  PendaftaranPenjaluran,
  PeriodePenjaluran,
  SekretarisProdi,
} = require("../models");
const {
  isTopikParallelSubmission,
  isJudulMandiriSubmission,
  buildTopikListFromSubmission,
  getTopikParallelReviewDeadline,
  evaluateTopikParallelState,
  evaluateTopikClusterReviewState,
  evaluateJudulMandiriReviewState,
  finalizeTopikParallelSubmission,
  finalizeTopikParallelSubmissionsByIds,
  finalizeJudulMandiriDeadlineSubmission,
  finalizeJudulMandiriDeadlineSubmissionsByIds,
} = require("../services/topikParallelReviewService");
const { validateResearchSubmissionReviewer } = require("../services/dosenStatusService");
const { isActiveSupervisor } = require("../services/supervisorAccessService");
const { getSupervisorAssignmentHistory } = require("../services/penetapanPembimbingService");
const { formatDosenFullName } = require("../utils/dosenIdentity");

const NON_PENELITIAN_UPLOAD_ROOT = process.env.VERCEL
  ? path.join("/tmp", "sima-uploads", "non-penelitian")
  : path.resolve(__dirname, "..", "uploads", "non-penelitian");

const MAGANG_DOCUMENT_KEY_LABELS = {
  cv: "CV",
  portfolio: "Portfolio",
  transcript: "Transkrip",
  other_supporting_documents: "Dokumen Pendukung Lain",
  supporting_documents_note: "Catatan Dokumen Pendukung",
};

function resolveNonPenelitianUploadPath(fileMetadata) {
  if (!fileMetadata || typeof fileMetadata !== "object") return null;

  const storedName = String(fileMetadata.stored_name || "").trim();
  const relativePath = String(fileMetadata.relative_path || "").trim();
  const candidatePath = storedName
    ? path.resolve(NON_PENELITIAN_UPLOAD_ROOT, path.basename(storedName))
    : relativePath
    ? path.resolve(__dirname, "..", relativePath)
    : null;

  if (!candidatePath) return null;

  const relativeToRoot = path.relative(NON_PENELITIAN_UPLOAD_ROOT, candidatePath);
  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) return null;

  return candidatePath;
}

async function resolveSekretarisAsDosenId(req, sekretarisId) {
  const sekretaris = await SekretarisProdi.findByPk(sekretarisId, {
    attributes: ["nik", "email", "jabatan"],
  });

  if (!sekretaris) return null;

  const where = [];
  if (sekretaris.nik) {
    where.push({ nik: String(sekretaris.nik).trim() });
  }
  if (sekretaris.email) {
    where.push({ email: String(sekretaris.email).trim().toLowerCase() });
  }

  const tokenUsername = String(req.user?.username || "").trim();
  if (tokenUsername) {
    where.push({ nik: tokenUsername });
    where.push({ email: tokenUsername.toLowerCase() });
  }

  if (where.length === 0) return null;

  let dosen = await Dosen.findOne({
    where: { [Op.or]: where },
    attributes: ["id"],
  });

  if (!dosen && sekretaris.jabatan) {
    dosen = await Dosen.findOne({
      where: { jabatan_struktural: sekretaris.jabatan },
      attributes: ["id"],
    });
  }

  return dosen?.id ? Number(dosen.id) : null;
}

function buildTopikList(submission) {
  return buildTopikListFromSubmission(submission).map((item) => ({
    slot: item.slot,
    kode: item.kode,
    judul: item.judul,
    dosen: item.dosen_nama,
    dosen_id: item.dosen_id,
  }));
}

async function loadTopikMetaByKode(kodes) {
  const normalizedKodes = [
    ...new Set(
      (Array.isArray(kodes) ? kodes : [])
        .map((kode) =>
          String(kode || "")
            .trim()
            .toUpperCase()
        )
        .filter(Boolean)
    ),
  ];
  const topikByKode = {};
  if (normalizedKodes.length === 0) return topikByKode;

  const topikRows = await Topik.findAll({
    where: { kode: { [Op.in]: normalizedKodes } },
    attributes: ["kode", "judul", "keyword", "cluster"],
  });
  topikRows.forEach((item) => {
    const normalizedKode = String(item.kode || "")
      .trim()
      .toUpperCase();
    if (normalizedKode) {
      topikByKode[normalizedKode] = {
        judul: item.judul || null,
        keyword: item.keyword || null,
        cluster: item.cluster || null,
      };
    }
  });

  return topikByKode;
}

function getApprovedTopik(submission, topikList) {
  if (topikList.length === 0) {
    return null;
  }

  if (isTopikParallelSubmission(submission)) {
    const parallelState = evaluateTopikParallelState(submission);
    const clusterState = evaluateTopikClusterReviewState(submission);
    if (clusterState.final_winner?.slot && ["menunggu_approval_sekprodi", "approved"].includes(submission.status)) {
      return topikList.find((item) => item.slot === clusterState.final_winner.slot) || null;
    }
    if (parallelState.approved_topik?.slot && (submission.status !== "pending" || parallelState.can_finalize)) {
      return topikList.find((item) => item.slot === parallelState.approved_topik.slot) || null;
    }
  }

  if (submission.status !== "approved") {
    return null;
  }

  const rejectedCount = (submission.riwayat || []).filter((item) => item.status === "rejected").length;
  const approvedSlot = Math.min(rejectedCount + 1, topikList.length);
  return topikList.find((item) => item.slot === approvedSlot) || null;
}

function getTopikDosenApprovalStage(submission) {
  if (!submission || submission.tipe_pengajuan !== "topik_dosen") {
    return "non_topik_dosen_or_final";
  }

  if (submission.status === "menunggu_set_ketua_cluster") {
    return "menunggu_set_ketua_cluster";
  }
  if (submission.status === "menunggu_approval_sekprodi") {
    return "menunggu_approval_sekprodi";
  }

  if (submission.status !== "pending") {
    return "non_topik_dosen_or_final";
  }

  const parallelState = evaluateTopikParallelState(submission);
  const clusterState = evaluateTopikClusterReviewState(submission);
  if (clusterState.can_finalize && clusterState.next_cluster_topik) {
    return "pending_ketua_klaster";
  }

  if (parallelState.deadline_passed && parallelState.pending_count > 0) {
    return "deadline_terlewati";
  }

  return "pending_review_parallel";
}

function getApprovalType(item) {
  return String(item?.tipe_approval || "calon_pembimbing").toLowerCase();
}

function getPengajuanApprovalStage(submission) {
  if (!submission) return "unknown";

  if (submission.tipe_pengajuan === "topik_dosen") {
    return getTopikDosenApprovalStage(submission);
  }

  if (submission.status === "menunggu_set_ketua_cluster") {
    return "menunggu_set_ketua_cluster";
  }
  if (submission.status === "menunggu_approval_sekprodi") {
    return "menunggu_approval_sekprodi";
  }

  if (submission.status !== "pending") {
    return "non_pending_or_final";
  }

  if (submission.tipe_pengajuan === "judul_mandiri") {
    const riwayat = Array.isArray(submission.riwayat) ? submission.riwayat : [];
    const hasPembimbingApproved = riwayat.some(
      (item) => item.status === "approved" && getApprovalType(item) === "calon_pembimbing"
    );
    const hasKetuaClusterDecided = riwayat.some(
      (item) =>
        (item.status === "approved" || item.status === "rejected") &&
        getApprovalType(item) === "koordinator"
    );

    if (hasPembimbingApproved && !hasKetuaClusterDecided) {
      return "pending_ketua_klaster";
    }

    return "pending_dosen_pembimbing";
  }

  return "pending_review";
}

function getSubmissionDetailIncludes() {
  return [
    {
      model: Mahasiswa,
      as: "mahasiswa",
      attributes: ["id", "nim", "nama", "email", "angkatan", "status_jalur_saat_ini"],
      include: [
        {
          model: Dosen,
          as: "dosenPembimbingAkademik",
          attributes: ["id", "nik", "nama", "gelar"],
        },
      ],
    },
    {
      model: Dosen,
      as: "dosen1",
      attributes: ["id", "nik", "nama", "gelar", "email"],
    },
    {
      model: Dosen,
      as: "dosen2",
      attributes: ["id", "nik", "nama", "gelar", "email"],
    },
    {
      model: Dosen,
      as: "dosen3",
      attributes: ["id", "nik", "nama", "gelar", "email"],
    },
    {
      model: Dosen,
      as: "dosenCurrent",
      attributes: ["id", "nik", "nama", "gelar", "email"],
    },
    {
      model: Dosen,
      as: "prospectiveSupervisor",
      attributes: ["id", "nik", "nama", "gelar", "email"],
    },
    {
      model: Pengajuan,
      as: "pengajuanSebelumnya",
      attributes: ["id", "topik_1_judul", "judul_mandiri", "status", "createdAt"],
    },
    {
      model: PamitUlang,
      as: "pamitUlang",
      include: [
        {
          model: Pengajuan,
          as: "pengajuanSebelumnya",
          attributes: ["id", "topik_1_judul", "judul_mandiri"],
          include: [
            {
              model: Dosen,
              as: "dosenCurrent",
              attributes: ["id", "nik", "nama", "gelar"],
            },
          ],
        },
      ],
    },
    {
      model: RiwayatPersetujuan,
      as: "riwayat",
      include: [
        {
          model: Dosen,
          as: "dosen",
          attributes: ["id", "nik", "nama", "gelar"],
        },
        {
          model: SekretarisProdi,
          as: "sekretarisProdi",
          attributes: ["id", "nik", "nama"],
          required: false,
        },
      ],
      required: false,
    },
  ];
}

async function loadSubmissionDetailById(submissionId) {
  return Pengajuan.findByPk(Number(submissionId), {
    include: getSubmissionDetailIncludes(),
  });
}

function toObjectPayload(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value;
}

function formatAssignmentSupervisors(assignment) {
  return (Array.isArray(assignment?.pembimbings) ? assignment.pembimbings : [])
    .map((item) => formatDosenFullName(item?.dosen?.nama, item?.dosen?.gelar))
    .filter(Boolean)
    .join(" & ");
}

function getAssignmentPrimaryDosen(assignment) {
  return (Array.isArray(assignment?.pembimbings) ? assignment.pembimbings : [])
    .find((item) => Number(item?.urutan) === 1)?.dosen || null;
}

function buildSupervisorAssignmentContext(history = {}) {
  const active = history?.active || null;
  const activeDisplay = formatAssignmentSupervisors(active) || null;
  const isReplacement = String(active?.sumber_data || "").toLowerCase() === "pergantian";
  if (!isReplacement) return { active, activeDisplay, replacement: null };

  const previous = (Array.isArray(history?.history) ? history.history : []).find(
    (item) => item.status === "ended" && Number(item.id) !== Number(active?.id)
  ) || null;
  return {
    active,
    activeDisplay,
    replacement: {
      occurred: true,
      effective_at: active?.tanggal_mulai || active?.updatedAt || null,
      recorded_at: active?.updatedAt || active?.createdAt || null,
      note: active?.catatan_pergantian || null,
      previous_assignment: previous,
      active_assignment: active,
      previous_supervisors: formatAssignmentSupervisors(previous) || null,
      active_supervisors: activeDisplay,
    },
  };
}

function resolveSelectedJalurFromPendaftaran(row) {
  return String(row?.jenis_jalur_diambil || row?.penjaluran_baru || "").trim().toLowerCase();
}

function isNonPenelitianJalurForStatus(jalur) {
  return ["magang", "pengabdian", "perintisan_bisnis"].includes(String(jalur || "").trim().toLowerCase());
}

function formatWorkflowStatusLabel(status) {
  const normalized = String(status || "").trim().toLowerCase();
  if (!normalized) return "-";
  if (normalized === "review_dosen_magang") return "Menunggu Review Dosen Pengawas Magang";
  if (normalized === "review_sekprodi") return "Menunggu Keputusan Final Sekprodi";
  if (normalized === "submitted") return "Menunggu Review Dosen Pengampu";
  if (normalized === "approved") return "Selesai (Disetujui)";
  if (normalized === "rejected") return "Selesai (Ditolak)";
  if (normalized === "draft") return "Draft";
  if (normalized === "pending") return "Menunggu Form Lanjutan";
  return normalized.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function getNonPenelitianSummary(payload, jalur) {
  const normalizedJalur = String(jalur || "").toLowerCase();
  if (normalizedJalur === "magang") {
    return {
      title: payload.chosen_institution || payload.company_name || payload.mitra_snapshot?.nama || "Pengajuan Magang",
      detail: payload.proposed_position_other || payload.proposed_position || payload.company_sector || "-",
    };
  }
  if (normalizedJalur === "pengabdian") {
    return {
      title: payload.nama_program || "Pengajuan Pengabdian Masyarakat",
      detail: payload.nama_mitra || payload.lokasi_pengabdian || "-",
    };
  }
  if (normalizedJalur === "perintisan_bisnis") {
    return {
      title: payload.nama_usaha || payload.nama_bisnis || payload.nama_startup || payload.kelompok?.nama_kelompok || "Pengajuan Perintisan Bisnis",
      detail: payload.bidang_usaha || payload.model_bisnis || payload.kelompok?.current_peran_tim || "-",
    };
  }
  return {
    title: payload.ringkasan || "Pengajuan Non-Penelitian",
    detail: "-",
  };
}

function getNonPenelitianReviewer(row, payload, jalur) {
  const workflowStatus = String(payload.workflow_status || row.form_lanjutan_status || "").toLowerCase();
  if (workflowStatus === "review_sekprodi") return "Sekretaris Prodi";
  if (["submitted", "review_dosen_magang"].includes(workflowStatus)) {
    if (jalur === "magang") return "Dosen Pengawas Magang";
    if (jalur === "pengabdian") return "Dosen Pengampu Pengabdian";
    if (jalur === "perintisan_bisnis") return "Dosen Pengampu Perintisan Bisnis";
  }
  return "-";
}

function buildNonPenelitianStatusRow(row) {
  const payload = toObjectPayload(row.form_lanjutan_payload);
  const jalur = payload.jalur || resolveSelectedJalurFromPendaftaran(row);
  const workflowStatus = payload.workflow_status || row.form_lanjutan_status || "draft";
  const summary = getNonPenelitianSummary(payload, jalur);
  const dosenPembimbing =
    formatDosenFullName(payload.dosen_pembimbing?.nama, payload.dosen_pembimbing?.gelar) ||
    formatDosenFullName(row.dosenPembimbingTA?.nama, row.dosenPembimbingTA?.gelar) ||
    formatDosenFullName(row.dosenPembimbingTABaru?.nama, row.dosenPembimbingTABaru?.gelar) ||
    null;

  return {
    id: `nonpen-${row.id}`,
    record_type: "non_penelitian",
    pendaftaran_id: row.id,
    jenis_jalur: row.jalur,
    jalur_program: jalur,
    tipe_pengajuan: jalur,
    status: workflowStatus,
    tahap_approval: workflowStatus,
    tahap_label: formatWorkflowStatusLabel(workflowStatus),
    createdAt: row.form_lanjutan_submitted_at || row.createdAt,
    updatedAt: row.updatedAt,
    summary_title: summary.title,
    summary_detail: summary.detail,
    reviewer_saat_ini: getNonPenelitianReviewer(row, payload, jalur),
    dosen_pembimbing: dosenPembimbing,
    workflow_timeline: Array.isArray(payload.workflow_timeline) ? payload.workflow_timeline : [],
    pendaftaran: {
      id: row.id,
      jenis_pendaftaran: row.jalur,
      jalur_program: jalur,
      periode: row.periode || null,
    },
  };
}

async function loadNonPenelitianRegistrationById(id) {
  return PendaftaranPenjaluran.findByPk(Number(id), {
    include: [
      {
        model: Mahasiswa,
        as: "mahasiswa",
        attributes: ["id", "nim", "nama", "email", "angkatan", "status_jalur_saat_ini"],
      },
      {
        model: PeriodePenjaluran,
        as: "periode",
        attributes: ["id", "label_periode", "tahun_akademik", "semester", "status", "is_active"],
        required: false,
      },
      {
        model: Dosen,
        as: "dosenPembimbingTA",
        attributes: ["id", "nik", "nama", "gelar", "email"],
        required: false,
      },
      {
        model: Dosen,
        as: "dosenPembimbingTABaru",
        attributes: ["id", "nik", "nama", "gelar", "email"],
        required: false,
      },
    ],
  });
}

async function enrichWorkflowTimelineActors(workflowTimeline) {
  const timeline = Array.isArray(workflowTimeline) ? workflowTimeline : [];
  const dosenIds = [
    ...new Set(
      timeline
        .filter((item) => item?.actor_id && !["system", "mahasiswa", "sekretaris_prodi"].includes(String(item.actor || "").toLowerCase()))
        .map((item) => Number(item.actor_id))
        .filter((id) => Number.isInteger(id) && id > 0)
    ),
  ];
  const sekretarisIds = [
    ...new Set(
      timeline
        .filter((item) => String(item?.actor || "").toLowerCase() === "sekretaris_prodi")
        .map((item) => Number(item.actor_id))
        .filter((id) => Number.isInteger(id) && id > 0)
    ),
  ];

  const [dosenActors, sekretarisActors] = await Promise.all([
    dosenIds.length > 0
      ? Dosen.findAll({ where: { id: { [Op.in]: dosenIds } }, attributes: ["id", "nama", "gelar"] })
      : [],
    sekretarisIds.length > 0
      ? SekretarisProdi.findAll({ where: { id: { [Op.in]: sekretarisIds } }, attributes: ["id", "nama"] })
      : [],
  ]);
  const dosenNameById = new Map(dosenActors.map((item) => [Number(item.id), formatDosenFullName(item.nama, item.gelar)]));
  const sekretarisNameById = new Map(sekretarisActors.map((item) => [Number(item.id), item.nama]));

  return timeline.map((item) => {
    const actor = String(item?.actor || "").toLowerCase();
    const actorId = Number(item?.actor_id);
    const actorName =
      actor === "sekretaris_prodi"
        ? sekretarisNameById.get(actorId)
        : dosenNameById.get(actorId);
    return actorName ? { ...item, actor_name: actorName } : item;
  });
}

async function buildNonPenelitianDetail(row) {
  const listRow = buildNonPenelitianStatusRow(row);
  const payload = toObjectPayload(row.form_lanjutan_payload);
  const workflowTimeline = await enrichWorkflowTimelineActors(payload.workflow_timeline);
  const dosenPembimbing =
    payload.dosen_pembimbing ||
    (row.dosenPembimbingTA
      ? {
          id: row.dosenPembimbingTA.id,
          nik: row.dosenPembimbingTA.nik,
          nama: row.dosenPembimbingTA.nama,
          gelar: row.dosenPembimbingTA.gelar || null,
          email: row.dosenPembimbingTA.email,
        }
      : row.dosenPembimbingTABaru
      ? {
          id: row.dosenPembimbingTABaru.id,
          nik: row.dosenPembimbingTABaru.nik,
          nama: row.dosenPembimbingTABaru.nama,
          gelar: row.dosenPembimbingTABaru.gelar || null,
          email: row.dosenPembimbingTABaru.email,
        }
      : null);

  return {
    ...listRow,
    diajukan_pada: row.form_lanjutan_submitted_at || row.createdAt,
    diperbarui_pada: row.updatedAt,
    mahasiswa: row.mahasiswa
      ? {
          id: row.mahasiswa.id,
          nim: row.mahasiswa.nim,
          nama: row.mahasiswa.nama,
          email: row.mahasiswa.email,
          angkatan: row.mahasiswa.angkatan,
          status_jalur_saat_ini: row.mahasiswa.status_jalur_saat_ini,
        }
      : null,
    detail_pengajuan: {
      jalur: listRow.jalur_program,
      payload,
      ringkasan: listRow.summary_title,
      ringkasan_detail: listRow.summary_detail,
      periode: row.periode || null,
    },
    hasil_pengajuan: {
      status_pengajuan: listRow.status,
      dosen_pembimbing: dosenPembimbing,
      review_dosen_pengampu: payload.review_dosen_pengampu || null,
      review_result: payload.review_result || null,
    },
    workflow_timeline: workflowTimeline,
    riwayat_persetujuan: workflowTimeline
      .filter((item) => ["approved", "rejected", "review_sekprodi"].includes(String(item?.status || "").toLowerCase()))
      .map((item) => ({
        status: item.status,
        tipe_approval: item.actor || "system",
        keterangan: item.note || null,
        tanggal_keputusan: item.at || null,
        dosen: null,
      })),
  };
}

// GET /api/submissions - Mahasiswa melihat pengajuan mereka
exports.getMySubmissions = async (req, res) => {
  try {
    const mahasiswa_id = req.user.id;
    const { status, tipe_pengajuan } = req.query; // ✅ Tambahkan tipe_pengajuan

    const where = { mahasiswa_id };

    if (status) {
      where.status = status;
    }

    // ✅ TAMBAHKAN FILTER TIPE PENGAJUAN
    if (tipe_pengajuan) {
      where.tipe_pengajuan = tipe_pengajuan;
    }

    const baseQuery = {
      where,
      include: [
        {
          model: Dosen,
          as: "dosenCurrent",
          attributes: ["id", "nik", "nama"],
        },
        {
          model: Dosen,
          as: "prospectiveSupervisor",
          attributes: ["id", "nik", "nama"],
        },
        {
          model: RiwayatPersetujuan,
          as: "riwayat",
          attributes: [
            "id",
            "dosen_id",
            "status",
            "tipe_approval",
            "topik_slot",
            "topik_kode",
            "keterangan",
            "tanggal_keputusan",
            "createdAt",
            "updatedAt",
          ],
          required: false,
        },
        {
          model: PendaftaranPenjaluran,
          as: "pendaftaranPenjaluran",
          attributes: [
            "id",
            "jalur",
            "jenis_jalur_diambil",
            "penjaluran_sebelumnya",
            "penjaluran_baru",
            "form_lanjutan_status",
            "createdAt",
          ],
          required: false,
          include: [
            {
              model: PeriodePenjaluran,
              as: "periode",
              attributes: ["id", "label_periode", "tahun_akademik", "semester"],
              required: false,
            },
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
    };

    let submissions = await Pengajuan.findAll(baseQuery);
    const pendingTopikIds = submissions
      .filter((item) => isTopikParallelSubmission(item) && item.status === "pending")
      .map((item) => item.id);
    const pendingJudulMandiriIds = submissions
      .filter((item) => isJudulMandiriSubmission(item) && item.status === "pending")
      .map((item) => item.id);
    if (pendingTopikIds.length > 0) {
      await finalizeTopikParallelSubmissionsByIds(pendingTopikIds);
    }
    if (pendingJudulMandiriIds.length > 0) {
      await finalizeJudulMandiriDeadlineSubmissionsByIds(pendingJudulMandiriIds);
    }
    if (pendingTopikIds.length > 0 || pendingJudulMandiriIds.length > 0) {
      submissions = await Pengajuan.findAll(baseQuery);
    }

    const topikKodes = [
      ...new Set(
        submissions
          .flatMap((submission) => [submission.topik_1_kode, submission.topik_2_kode, submission.topik_3_kode])
          .filter(Boolean)
      ),
    ];

    const [topikByKode, supervisorHistory] = await Promise.all([
      loadTopikMetaByKode(topikKodes),
      getSupervisorAssignmentHistory(mahasiswa_id),
    ]);
    const supervisorContext = buildSupervisorAssignmentContext(supervisorHistory);

    const compactData = submissions.map((submission) => {
      const approvalStage = getPengajuanApprovalStage(submission);
      const base = {
        id: submission.id,
        record_type: "pengajuan",
        jenis_jalur: submission.jenis_jalur,
        tipe_pengajuan: submission.tipe_pengajuan,
        status: submission.status,
        tahap_approval: approvalStage,
        createdAt: submission.createdAt,
        updatedAt: submission.updatedAt,
        supervisor_updated_at: supervisorContext.replacement?.recorded_at || null,
        pergantian_pembimbing: supervisorContext.replacement,
        pendaftaran: submission.pendaftaranPenjaluran
          ? {
              id: submission.pendaftaranPenjaluran.id,
              jenis_pendaftaran: submission.pendaftaranPenjaluran.jalur,
              jalur_program:
                submission.pendaftaranPenjaluran.jenis_jalur_diambil ||
                submission.pendaftaranPenjaluran.penjaluran_baru ||
                null,
              periode: submission.pendaftaranPenjaluran.periode || null,
            }
          : null,
      };

      if (submission.tipe_pengajuan === "topik_dosen") {
        const topikList = buildTopikList(submission).map((item) => {
          const normalizedKode = String(item?.kode || "")
            .trim()
            .toUpperCase();
          return {
            ...item,
            kode: normalizedKode || item.kode,
            judul: item.judul || topikByKode[normalizedKode]?.judul || null,
            keyword: topikByKode[normalizedKode]?.keyword || null,
            cluster: topikByKode[normalizedKode]?.cluster || null,
          };
        });
        const approvedTopik = getApprovedTopik(submission, topikList);
        const parallelState = evaluateTopikParallelState(submission);
        const slotStateBySlot = new Map(parallelState.slot_decisions.map((item) => [Number(item.slot), item]));

        base.topik_dipilih = topikList.map(({ kode }) => kode);
        base.topik_dipilih_detail = topikList.map(({ slot, kode, judul, keyword, cluster, dosen, dosen_id: dosenId }) => {
          const slotState = slotStateBySlot.get(Number(slot));
          return {
            slot,
            kode,
            judul,
            keyword: keyword || null,
            cluster: cluster || null,
            dosen: dosen || null,
            dosen_id: dosenId || null,
            reviewer_status: slotState?.reviewer_status || null,
            reviewer_note: slotState?.reviewer_note || null,
            reviewer_decided_at: slotState?.reviewer_decided_at || null,
          };
        });
        base.topik_disetujui = approvedTopik
          ? {
              slot: approvedTopik.slot,
              kode: approvedTopik.kode,
              judul: approvedTopik.judul,
              keyword: approvedTopik.keyword || null,
              cluster: approvedTopik.cluster || null,
            }
          : null;
        base.dosen_pembimbing = supervisorContext.activeDisplay || (submission.dosenCurrent
          ? formatDosenFullName(submission.dosenCurrent.nama, submission.dosenCurrent.gelar)
          : null);
        base.review_deadline_at = getTopikParallelReviewDeadline(submission);
        base.deadline_terlewati = Boolean(parallelState.deadline_passed && parallelState.pending_count > 0);
      } else {
        const reviewState = evaluateJudulMandiriReviewState(submission);
        base.judul_mandiri = {
          judul: submission.judul_mandiri,
          keyword: submission.keyword_mandiri,
          cluster: submission.cluster_mandiri,
          prospective_supervisor: submission.prospectiveSupervisor
            ? {
                id: submission.prospectiveSupervisor.id,
                nik: submission.prospectiveSupervisor.nik,
                nama: submission.prospectiveSupervisor.nama,
                gelar: submission.prospectiveSupervisor.gelar || null,
              }
            : null,
        };
        base.review_deadline_at = getTopikParallelReviewDeadline(submission);
        base.deadline_terlewati = Boolean(reviewState.deadline_passed && reviewState.supervisor_status === "expired");
        base.reviewer_status = reviewState.supervisor_status;
      }

      return base;
    });

    const linkedPendaftaranIds = new Set(
      submissions
        .map((submission) => Number(submission.pendaftaran_penjaluran_id || 0))
        .filter(Boolean)
    );
    const pendaftaranRows = await PendaftaranPenjaluran.findAll({
      where: {
        mahasiswa_id,
        jalur: { [Op.in]: ["ulang", "alih"] },
      },
      include: [
        {
          model: PeriodePenjaluran,
          as: "periode",
          attributes: ["id", "label_periode", "tahun_akademik", "semester"],
          required: false,
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    const pendingRegistrationRows = pendaftaranRows
      .filter((row) => {
        if (linkedPendaftaranIds.has(Number(row.id))) return false;
        if (isNonPenelitianJalurForStatus(resolveSelectedJalurFromPendaftaran(row))) return false;

        const registrationCreatedAt = new Date(row.createdAt || 0).getTime();
        const hasLegacySubmissionMatch = submissions.some((submission) => {
          if (submission.pendaftaran_penjaluran_id) return false;
          if (String(submission.jenis_jalur || "") !== String(row.jalur || "")) return false;
          return new Date(submission.createdAt || 0).getTime() >= registrationCreatedAt;
        });
        return !hasLegacySubmissionMatch;
      })
      .map((row) => ({
        id: `pendaftaran-${row.id}`,
        record_type: "pendaftaran",
        pendaftaran_id: row.id,
        jenis_jalur: row.jalur,
        jalur_program: row.jenis_jalur_diambil || row.penjaluran_baru || null,
        tipe_pengajuan: null,
        status: "menunggu_pengajuan",
        tahap_approval: "menunggu_pengajuan_judul",
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        pendaftaran: {
          id: row.id,
          jenis_pendaftaran: row.jalur,
          jalur_program: row.jenis_jalur_diambil || row.penjaluran_baru || null,
          periode: row.periode || null,
        },
      }));

    const nonPenelitianRowsRaw = await PendaftaranPenjaluran.findAll({
      where: {
        mahasiswa_id,
        form_lanjutan_status: { [Op.notIn]: ["draft", "pending"] },
        [Op.or]: [
          { jenis_jalur_diambil: { [Op.in]: ["magang", "pengabdian", "perintisan_bisnis"] } },
          { penjaluran_baru: { [Op.in]: ["magang", "pengabdian", "perintisan_bisnis"] } },
        ],
      },
      include: [
        {
          model: PeriodePenjaluran,
          as: "periode",
          attributes: ["id", "label_periode", "tahun_akademik", "semester"],
          required: false,
        },
        {
          model: Dosen,
          as: "dosenPembimbingTA",
          attributes: ["id", "nik", "nama", "email"],
          required: false,
        },
        {
          model: Dosen,
          as: "dosenPembimbingTABaru",
          attributes: ["id", "nik", "nama", "email"],
          required: false,
        },
      ],
      order: [["updatedAt", "DESC"]],
    });

    const nonPenelitianRows = nonPenelitianRowsRaw
      .filter((row) => isNonPenelitianJalurForStatus(resolveSelectedJalurFromPendaftaran(row)))
      .map((row) => ({
        ...buildNonPenelitianStatusRow(row),
        ...(supervisorContext.activeDisplay ? { dosen_pembimbing: supervisorContext.activeDisplay } : {}),
        supervisor_updated_at: supervisorContext.replacement?.recorded_at || null,
        pergantian_pembimbing: supervisorContext.replacement,
      }));

    const statusRows = [...compactData, ...nonPenelitianRows, ...pendingRegistrationRows].sort(
      (left, right) =>
        new Date(right.updatedAt || right.createdAt || 0).getTime() -
        new Date(left.updatedAt || left.createdAt || 0).getTime()
    );

    res.json({
      success: true,
      data: statusRows,
      total: statusRows.length,
    });
  } catch (error) {
    console.error("Error di getMySubmissions:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// GET /api/submissions/:id - Detail pengajuan
exports.getSubmissionById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = Number(req.user.id);
    const userRole = typeof req.user.role === "string" ? req.user.role.trim().toLowerCase() : "";
    let accessorDosenId = null;

    const nonPenelitianMatch = String(id || "").match(/^nonpen-(\d+)$/);
    const numericSubmissionId = Number(id);

    if (!nonPenelitianMatch && (!Number.isInteger(numericSubmissionId) || numericSubmissionId <= 0)) {
      return res.status(400).json({
        success: false,
        message: "ID pengajuan tidak valid",
      });
    }

    if (!Number.isInteger(userId) || !["mahasiswa", "dosen", "sekretaris_prodi"].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: "Anda tidak memiliki akses ke endpoint ini",
      });
    }

    if (userRole === "dosen") {
      accessorDosenId = userId;
    } else if (userRole === "sekretaris_prodi") {
      accessorDosenId = await resolveSekretarisAsDosenId(req, userId);
      if (!accessorDosenId) {
        return res.status(403).json({
          success: false,
          message: "Akun sekretaris prodi tidak terhubung ke data dosen",
        });
      }
    }

    if (nonPenelitianMatch) {
      const registrationId = Number(nonPenelitianMatch[1]);
      const registration = await loadNonPenelitianRegistrationById(registrationId);

      if (
        !registration ||
        !isNonPenelitianJalurForStatus(resolveSelectedJalurFromPendaftaran(registration)) ||
        ["draft", "pending"].includes(String(registration.form_lanjutan_status || "").toLowerCase())
      ) {
        return res.status(404).json({
          success: false,
          message: "Pengajuan tidak ditemukan",
        });
      }

      if (userRole === "mahasiswa" && Number(registration.mahasiswa_id) !== userId) {
        return res.status(403).json({
          success: false,
          message: "Anda tidak memiliki akses ke pengajuan ini",
        });
      }

      if (userRole === "dosen" || userRole === "sekretaris_prodi") {
        return res.status(403).json({
          success: false,
          message: "Detail status non-penelitian hanya tersedia untuk mahasiswa pada endpoint ini",
        });
      }

      const detail = await buildNonPenelitianDetail(registration);
      const supervisorContext = buildSupervisorAssignmentContext(
        await getSupervisorAssignmentHistory(registration.mahasiswa_id)
      );
      const activePrimary = getAssignmentPrimaryDosen(supervisorContext.active);
      if (activePrimary) {
        if (supervisorContext.replacement) {
          detail.hasil_pengajuan.dosen_pembimbing_awal = detail.hasil_pengajuan.dosen_pembimbing || null;
        }
        detail.hasil_pengajuan.dosen_pembimbing = activePrimary;
      }
      detail.penetapan_pembimbing_aktif = supervisorContext.active;
      detail.pergantian_pembimbing = supervisorContext.replacement;
      detail.diperbarui_pada = supervisorContext.replacement?.recorded_at || detail.diperbarui_pada;

      return res.json({
        success: true,
        data: detail,
      });
    }

    let submission = await loadSubmissionDetailById(numericSubmissionId);

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Pengajuan tidak ditemukan",
      });
    }

    // Authorization check
    if (userRole === "mahasiswa" && Number(submission.mahasiswa_id) !== userId) {
      return res.status(403).json({
        success: false,
        message: "Anda tidak memiliki akses ke pengajuan ini",
      });
    }

    if (userRole === "dosen" || userRole === "sekretaris_prodi") {
      const dosenPilihan = [
        submission.dosen_saat_ini,
        submission.dosen_pilihan_1,
        submission.dosen_pilihan_2,
        submission.dosen_pilihan_3,
        submission.prospective_supervisor_id,
        submission.mahasiswa?.dosen_pembimbing_akademik_id,
      ]
        .filter(Boolean)
        .map((item) => Number(item));

      const hasPendingKetuaClusterAccess = (submission.riwayat || []).some(
        (item) =>
          Number(item.dosen_id) === Number(accessorDosenId) &&
          getApprovalType(item) === "koordinator" &&
          String(item.status || "").toLowerCase() === "pending"
      );
      const hasDirectSubmissionAccess = dosenPilihan.includes(accessorDosenId);
      const hasSupervisorAccess =
        !hasDirectSubmissionAccess && !hasPendingKetuaClusterAccess
          ? await isActiveSupervisor(accessorDosenId, submission.mahasiswa_id)
          : false;
      if (
        !hasDirectSubmissionAccess &&
        !hasPendingKetuaClusterAccess &&
        !hasSupervisorAccess
      ) {
        return res.status(403).json({
          success: false,
          message: "Anda tidak memiliki akses ke pengajuan ini",
        });
      }
    }

    if (isTopikParallelSubmission(submission) && submission.status === "pending") {
      const finalizationResult = await finalizeTopikParallelSubmission(submission.id);
      if (finalizationResult?.changed || finalizationResult?.finalized) {
        submission = await loadSubmissionDetailById(numericSubmissionId);
      }
    } else if (isJudulMandiriSubmission(submission) && submission.status === "pending") {
      const finalizationResult = await finalizeJudulMandiriDeadlineSubmission(submission.id);
      if (finalizationResult?.changed || finalizationResult?.finalized) {
        submission = await loadSubmissionDetailById(numericSubmissionId);
      }
    }

    const riwayatOrdered = (submission.riwayat || [])
      .slice()
      .sort((a, b) => new Date(a.tanggal_keputusan || a.createdAt) - new Date(b.tanggal_keputusan || b.createdAt));

    const dosenById = {};
    [submission.dosen1, submission.dosen2, submission.dosen3, submission.dosenCurrent, submission.prospectiveSupervisor]
      .filter(Boolean)
      .forEach((dosen) => {
        dosenById[Number(dosen.id)] = dosen;
      });

    const latestApprovedHistory = riwayatOrdered
      .slice()
      .reverse()
      .find((item) => item.status === "approved");
    const rejectionReasons = riwayatOrdered
      .filter((item) => item.status === "rejected")
      .map((item) => item.keterangan)
      .filter(Boolean);
    const topikParallelState = isTopikParallelSubmission(submission) ? evaluateTopikParallelState(submission) : null;
    const judulMandiriReviewState = isJudulMandiriSubmission(submission)
      ? evaluateJudulMandiriReviewState(submission)
      : null;
    const reviewerSlotDecisions =
      topikParallelState && accessorDosenId
        ? topikParallelState.slot_decisions
            .filter((item) => Number(item.dosen_id) === Number(accessorDosenId))
            .sort((a, b) => a.slot - b.slot)
        : [];
    const pendingKetuaClusterRows = (submission.riwayat || [])
      .filter(
        (item) =>
          Number(item.dosen_id) === Number(accessorDosenId) &&
          getApprovalType(item) === "koordinator" &&
          String(item.status || "").toLowerCase() === "pending"
      )
      .sort((left, right) => Number(left.topik_slot || 0) - Number(right.topik_slot || 0));
    const pendingReviewerDecision =
      Array.isArray(reviewerSlotDecisions) && reviewerSlotDecisions.length > 0
        ? reviewerSlotDecisions.find((item) => item.reviewer_status === "pending") || null
        : null;
    const currentReviewerDecision =
      pendingReviewerDecision ||
      (Array.isArray(reviewerSlotDecisions) && reviewerSlotDecisions.length > 0 ? reviewerSlotDecisions[0] : null);

    let detailPengajuan = {};
    let hasilPengajuan = {
      status_pengajuan: submission.status,
    };
    let approvedTopikForResponse = null;

    if (submission.status === "approved") {
      hasilPengajuan.alasan_persetujuan =
        submission.alasan_persetujuan || latestApprovedHistory?.keterangan || null;
    } else if (submission.status === "rejected") {
      hasilPengajuan.alasan_penolakan =
        rejectionReasons.length > 0
          ? rejectionReasons
          : submission.alasan_penolakan
          ? [submission.alasan_penolakan]
          : [];
    }

    if (submission.tipe_pengajuan === "topik_dosen") {
      const slotStateBySlot = new Map((topikParallelState?.slot_decisions || []).map((item) => [Number(item.slot), item]));
      const topikMetaByKode = await loadTopikMetaByKode([
        submission.topik_1_kode,
        submission.topik_2_kode,
        submission.topik_3_kode,
      ]);
      const topikList = buildTopikList(submission).map((item) => {
        const normalizedKode = String(item?.kode || "")
          .trim()
          .toUpperCase();
        const slotState = slotStateBySlot.get(Number(item.slot));
        const topikMeta = topikMetaByKode[normalizedKode] || {};
        return {
          ...item,
          kode: normalizedKode || item.kode,
          judul: item.judul || topikMeta.judul || null,
          keyword: topikMeta.keyword || null,
          cluster: topikMeta.cluster || null,
          reviewer_status: slotState?.reviewer_status || null,
          reviewer_note: slotState?.reviewer_note || null,
          reviewer_decided_at: slotState?.reviewer_decided_at || null,
          pembimbing_approval_note:
            slotState?.reviewer_status === "approved" ? slotState?.reviewer_note || null : null,
          pembimbing_approved_at:
            slotState?.reviewer_status === "approved" ? slotState?.reviewer_decided_at || null : null,
        };
      });
      const clusterReviewState = evaluateTopikClusterReviewState(submission);
      const pendingClusterSlot = pendingKetuaClusterRows[0]?.topik_slot || clusterReviewState.next_cluster_topik?.slot;
      const pendingClusterTopik = pendingClusterSlot
        ? topikList.find((item) => Number(item.slot) === Number(pendingClusterSlot)) || null
        : null;
      const approvedTopik = pendingClusterTopik || getApprovedTopik(submission, topikList);
      approvedTopikForResponse = approvedTopik;
      const dosenApproved = approvedTopik ? dosenById[Number(approvedTopik.dosen_id)] || null : null;

      detailPengajuan = {
        diajukan_pada: submission.createdAt,
        topik_dipilih: topikList.map(
          ({
            slot,
            kode,
            judul,
            keyword,
            cluster,
            dosen,
            dosen_id: dosenId,
            reviewer_status,
            reviewer_note,
            reviewer_decided_at,
            pembimbing_approval_note,
            pembimbing_approved_at,
          }) => ({
            slot,
            kode,
            judul,
            keyword: keyword || null,
            cluster: cluster || null,
            dosen,
            dosen_id: dosenId || null,
            reviewer_status: reviewer_status || null,
            reviewer_note: reviewer_note || null,
            reviewer_decided_at: reviewer_decided_at || null,
            pembimbing_approval_note: pembimbing_approval_note || null,
            pembimbing_approved_at: pembimbing_approved_at || null,
          })
        ),
        review_deadline_at: getTopikParallelReviewDeadline(submission),
        deadline_terlewati: Boolean(topikParallelState?.deadline_passed && topikParallelState?.pending_count > 0),
      };

      hasilPengajuan.topik_disetujui = approvedTopik
        ? {
              slot: approvedTopik.slot,
              kode: approvedTopik.kode,
              judul: approvedTopik.judul,
              keyword: approvedTopik.keyword || null,
              cluster: approvedTopik.cluster || null,
            }
        : null;
      hasilPengajuan.dosen_pembimbing = dosenApproved
        ? {
            id: dosenApproved.id,
            nik: dosenApproved.nik,
            nama: dosenApproved.nama,
            gelar: dosenApproved.gelar || null,
            email: dosenApproved.email,
          }
        : submission.dosenCurrent
        ? {
            id: submission.dosenCurrent.id,
            nik: submission.dosenCurrent.nik,
            nama: submission.dosenCurrent.nama,
            gelar: submission.dosenCurrent.gelar || null,
            email: submission.dosenCurrent.email,
          }
        : null;
    } else {
      detailPengajuan = {
        diajukan_pada: submission.createdAt,
        judul_mandiri: submission.judul_mandiri,
        deskripsi_mandiri: submission.deskripsi_mandiri,
        keyword_mandiri: submission.keyword_mandiri,
        cluster_mandiri: submission.cluster_mandiri,
        calon_dosen_pembimbing: submission.prospectiveSupervisor
          ? {
              id: submission.prospectiveSupervisor.id,
              nik: submission.prospectiveSupervisor.nik,
              nama: submission.prospectiveSupervisor.nama,
              gelar: submission.prospectiveSupervisor.gelar || null,
              email: submission.prospectiveSupervisor.email,
            }
          : null,
        review_deadline_at: getTopikParallelReviewDeadline(submission),
        deadline_terlewati: Boolean(
          judulMandiriReviewState?.deadline_passed && judulMandiriReviewState?.supervisor_status === "expired"
        ),
      };
    }

    const canReviewTopikParallel =
      submission.tipe_pengajuan === "topik_dosen" &&
      submission.status === "pending" &&
      Array.isArray(reviewerSlotDecisions) &&
      reviewerSlotDecisions.some((item) => item.reviewer_status === "pending");
    const topikApprovalStage = getPengajuanApprovalStage(submission);
    const canReviewKetuaClusterTopik =
      submission.tipe_pengajuan === "topik_dosen" &&
      submission.status === "pending" &&
      topikApprovalStage === "pending_ketua_klaster" &&
      pendingKetuaClusterRows.length > 0;
    const canReviewNonTopik =
      submission.tipe_pengajuan !== "topik_dosen" &&
      submission.status === "pending" &&
      (userRole === "dosen" || userRole === "sekretaris_prodi");
    const hasPendingReview = Boolean(canReviewTopikParallel || canReviewKetuaClusterTopik || canReviewNonTopik);
    const reviewerValidation = hasPendingReview && accessorDosenId
      ? await validateResearchSubmissionReviewer(
          submission,
          accessorDosenId,
          canReviewKetuaClusterTopik ? "ketua_cluster" : "calon_pembimbing"
        )
      : { allowed: true, message: null, legacy_period_unresolved: false };

    const supervisorContext = buildSupervisorAssignmentContext(
      await getSupervisorAssignmentHistory(submission.mahasiswa_id)
    );
    const activePrimary = getAssignmentPrimaryDosen(supervisorContext.active);
    if (activePrimary) {
      if (supervisorContext.replacement) {
        hasilPengajuan.dosen_pembimbing_awal = hasilPengajuan.dosen_pembimbing || null;
      }
      hasilPengajuan.dosen_pembimbing = activePrimary;
    }

    const responseData = {
      id: submission.id,
      jenis_jalur: submission.jenis_jalur,
      tipe_pengajuan: submission.tipe_pengajuan,
      status: submission.status,
      tahap_approval: topikApprovalStage,
      diajukan_pada: submission.createdAt,
      diperbarui_pada: supervisorContext.replacement?.recorded_at || submission.updatedAt,
      penetapan_pembimbing_aktif: supervisorContext.active,
      pergantian_pembimbing: supervisorContext.replacement,
      review_deadline_at:
        submission.tipe_pengajuan === "topik_dosen" || submission.tipe_pengajuan === "judul_mandiri"
          ? getTopikParallelReviewDeadline(submission)
          : null,
      reviewer_status: canReviewKetuaClusterTopik
        ? "pending"
        : submission.tipe_pengajuan === "judul_mandiri"
        ? judulMandiriReviewState?.supervisor_status || null
        : currentReviewerDecision?.reviewer_status || null,
      reviewer_note: canReviewKetuaClusterTopik
        ? "Menunggu keputusan ketua cluster."
        : submission.tipe_pengajuan === "judul_mandiri"
        ? judulMandiriReviewState?.supervisor_decision?.keterangan || null
        : currentReviewerDecision?.reviewer_note || null,
      review_context: canReviewKetuaClusterTopik ? "ketua_klaster" : "calon_pembimbing",
      has_pending_review: hasPendingReview,
      can_review: hasPendingReview && reviewerValidation.allowed,
      review_eligible: reviewerValidation.allowed,
      review_block_reason: reviewerValidation.allowed ? null : reviewerValidation.message,
      legacy_period_unresolved: reviewerValidation.legacy_period_unresolved === true,
      reviewer_slot_decisions:
        canReviewKetuaClusterTopik
          ? pendingKetuaClusterRows.map((ketuaRow) => {
              const topik = detailPengajuan.topik_dipilih.find(
                (item) => Number(item.slot) === Number(ketuaRow.topik_slot)
              );
              return {
                slot: ketuaRow.topik_slot,
                kode: ketuaRow.topik_kode || topik?.kode || null,
                reviewer_status: "pending",
                reviewer_note: ketuaRow.keterangan || "Menunggu keputusan ketua cluster.",
                reviewer_decided_at: null,
                pembimbing_approval_note: topik?.reviewer_note || null,
                pembimbing_approved_at: topik?.reviewer_decided_at || null,
                pembimbing_approved_by: topik?.dosen_id
                  ? (() => {
                      const dosen = dosenById[Number(topik.dosen_id)] || null;
                      return dosen
                        ? {
                            id: dosen.id,
                            nik: dosen.nik,
                            nama: dosen.nama,
                          }
                        : null;
                    })()
                  : null,
              };
            })
          : submission.tipe_pengajuan === "topik_dosen" && Array.isArray(reviewerSlotDecisions)
          ? reviewerSlotDecisions.map((item) => ({
              slot: item.slot,
              kode: item.kode,
              reviewer_status: item.reviewer_status,
              reviewer_note: item.reviewer_note,
              reviewer_decided_at: item.reviewer_decided_at || null,
            }))
          : [],
      topik_review_status:
        submission.tipe_pengajuan === "topik_dosen"
          ? (topikParallelState?.slot_decisions || []).map((item) => ({
              slot: item.slot,
              kode: item.kode,
              dosen_id: item.dosen_id,
              reviewer_status: item.reviewer_status,
              reviewer_note: item.reviewer_note,
              reviewer_decided_at: item.reviewer_decided_at || null,
            }))
          : [],
      mahasiswa: submission.mahasiswa
        ? {
            id: submission.mahasiswa.id,
            nim: submission.mahasiswa.nim,
            nama: submission.mahasiswa.nama,
            email: submission.mahasiswa.email,
            angkatan: submission.mahasiswa.angkatan,
            status_jalur_saat_ini: submission.mahasiswa.status_jalur_saat_ini,
            dosen_pembimbing_akademik: submission.mahasiswa.dosenPembimbingAkademik
              ? {
                  id: submission.mahasiswa.dosenPembimbingAkademik.id,
                  nik: submission.mahasiswa.dosenPembimbingAkademik.nik,
                  nama: submission.mahasiswa.dosenPembimbingAkademik.nama,
                  gelar: submission.mahasiswa.dosenPembimbingAkademik.gelar || null,
                }
              : null,
          }
        : null,
      detail_pengajuan: detailPengajuan,
      hasil_pengajuan: hasilPengajuan,
      riwayat_persetujuan: riwayatOrdered.map((item) => ({
        status: item.status,
        tipe_approval: item.tipe_approval || "calon_pembimbing",
        keterangan: item.keterangan,
        tanggal_keputusan: item.tanggal_keputusan || item.createdAt,
        dosen: item.dosen
          ? {
              id: item.dosen.id,
              nik: item.dosen.nik,
              nama: item.dosen.nama,
              gelar: item.dosen.gelar || null,
            }
          : null,
        sekretaris_prodi: item.sekretarisProdi
          ? {
              id: item.sekretarisProdi.id,
              nik: item.sekretarisProdi.nik,
              nama: item.sekretarisProdi.nama,
            }
          : null,
      })),
      referensi: {},
    };

    if (submission.pengajuanSebelumnya) {
      responseData.referensi.pengajuan_sebelumnya = {
        id: submission.pengajuanSebelumnya.id,
        status: submission.pengajuanSebelumnya.status,
        topik_1_judul: submission.pengajuanSebelumnya.topik_1_judul,
        judul_mandiri: submission.pengajuanSebelumnya.judul_mandiri,
        createdAt: submission.pengajuanSebelumnya.createdAt,
      };
    }

    if (submission.pamitUlang) {
      responseData.referensi.pamit_ulang = {
        id: submission.pamitUlang.id,
        status_dospem: submission.pamitUlang.status_dospem || null,
        status_dpa: submission.pamitUlang.status_dpa || null,
        alasan_ulang: submission.pamitUlang.alasan_ulang || null,
      };
    }

    if (Object.keys(responseData.referensi).length === 0) {
      delete responseData.referensi;
    }

    res.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error("Error di getSubmissionById:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// GET /api/submissions/:id/documents/:documentKey - Download dokumen magang milik mahasiswa
exports.downloadSubmissionDocumentById = async (req, res) => {
  try {
    const { id, documentKey } = req.params;
    const userId = Number(req.user.id);
    const userRole = typeof req.user.role === "string" ? req.user.role.trim().toLowerCase() : "";
    const nonPenelitianMatch = String(id || "").match(/^nonpen-(\d+)$/);

    if (!nonPenelitianMatch || !MAGANG_DOCUMENT_KEY_LABELS[documentKey]) {
      return res.status(400).json({
        success: false,
        message: "Parameter download dokumen tidak valid.",
      });
    }

    if (!Number.isInteger(userId) || userRole !== "mahasiswa") {
      return res.status(403).json({
        success: false,
        message: "Anda tidak memiliki akses ke dokumen ini.",
      });
    }

    const registration = await loadNonPenelitianRegistrationById(Number(nonPenelitianMatch[1]));
    if (!registration || Number(registration.mahasiswa_id) !== userId) {
      return res.status(404).json({
        success: false,
        message: "Pengajuan tidak ditemukan.",
      });
    }

    const payload = toObjectPayload(registration.form_lanjutan_payload);
    const selectedJalur = String(payload.jalur || resolveSelectedJalurFromPendaftaran(registration) || "").toLowerCase();
    if (selectedJalur !== "magang") {
      return res.status(409).json({
        success: false,
        message: "Dokumen ini hanya tersedia untuk pengajuan magang.",
      });
    }

    const documentMetadata = payload.uploaded_documents?.[documentKey] || null;
    const absolutePath = resolveNonPenelitianUploadPath(documentMetadata);

    if (!absolutePath || !fs.existsSync(absolutePath)) {
      return res.status(404).json({
        success: false,
        message: `${MAGANG_DOCUMENT_KEY_LABELS[documentKey]} tidak ditemukan.`,
      });
    }

    const fileName = documentMetadata.original_name || path.basename(absolutePath);
    return res.download(absolutePath, fileName);
  } catch (error) {
    console.error("Error di downloadSubmissionDocumentById:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

