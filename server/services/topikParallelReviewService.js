"use strict";

const { Op } = require("sequelize");
const {
  Pengajuan,
  Mahasiswa,
  Topik,
  Dosen,
  Klaster,
  KlasterKetuaPeriode,
  PendaftaranPenjaluran,
  PeriodePenjaluran,
  RiwayatPersetujuan,
  sequelize,
} = require("../models");

const TOPIK_PARALLEL_REVIEW_HOURS = null;
const TOPIK_PARALLEL_REVIEW_MS = null;
const REVIEW_REMINDER_INTERVAL_HOURS = 24;
const REVIEW_REMINDER_INTERVAL_MS = REVIEW_REMINDER_INTERVAL_HOURS * 60 * 60 * 1000;
const RIWAYAT_TOPIK_PARALLEL_ATTRIBUTES = [
  "id",
  "dosen_id",
  "sekretaris_prodi_id",
  "tipe_approval",
  "topik_slot",
  "topik_kode",
  "status",
  "keterangan",
  "tanggal_keputusan",
  "reminder_count",
  "last_reminded_at",
  "createdAt",
  "updatedAt",
];

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeRiwayatStatus(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (["approved", "rejected", "pending", "expired", "cancelled"].includes(normalized)) {
    return normalized;
  }
  return "pending";
}

function normalizeApprovalType(value) {
  return String(value || "calon_pembimbing")
    .trim()
    .toLowerCase();
}

function normalizeJenisJalurPenelitian(value) {
  const raw = String(value || "")
    .trim()
    .toLowerCase();
  if (!raw) return "";
  if (raw === "pengabdian kepada masyarakat" || raw === "pengabdian masyarakat") return "pengabdian";
  if (raw === "perintisan bisnis") return "perintisan_bisnis";
  return raw.replace(/\s+/g, "_");
}

function normalizeTopikClusterCode(clusterValue) {
  const value = String(clusterValue || "")
    .trim()
    .toUpperCase();
  if (!value) return null;
  if (value === "SIRKEL") return "SIRKEL";
  if (value === "SIBER") return "SIBER";
  if (value === "ITSC") return "ITSC";
  if (value === "MVK") return "MVK";
  if (value.includes("SISTEM INFORMASI") || value.includes("REKAYASA PERANGKAT LUNAK")) return "SIRKEL";
  if (value.includes("SIBER")) return "SIBER";
  if (value.includes("INTELLIGENT") || value.includes("CERDAS") || value.includes("ITSC")) return "ITSC";
  if (value.includes("MULTIMEDIA") || value.includes("VISI KOMPUTER") || value.includes("MVK")) return "MVK";
  if (value.includes("MEDIS") || value.includes("SAINS DATA") || value.includes("SDATA")) return "ITSC";
  return value;
}

function toDecisionDate(value, fallback = null) {
  if (!value) return fallback;
  const dateValue = new Date(value);
  if (Number.isNaN(dateValue.getTime())) return fallback;
  return dateValue;
}

function normalizeTopikSlot(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function buildSubmissionLock(transaction) {
  return {
    level: transaction.LOCK.UPDATE,
    of: Pengajuan,
  };
}

function getSubmissionRiwayatRows(submission) {
  if (Array.isArray(submission?.riwayat)) return submission.riwayat;
  if (typeof submission?.getDataValue === "function") {
    const value = submission.getDataValue("riwayat");
    if (Array.isArray(value)) return value;
  }
  if (typeof submission?.get === "function") {
    const value = submission.get("riwayat");
    if (Array.isArray(value)) return value;
  }
  if (Array.isArray(submission?.dataValues?.riwayat)) return submission.dataValues.riwayat;
  return [];
}

async function loadSubmissionWithRiwayat(submissionId, options = {}) {
  const { transaction, lockSubmission = false } = options;
  if (!transaction) {
    throw new Error("Transaction wajib disediakan untuk loadSubmissionWithRiwayat.");
  }

  const submission = await Pengajuan.findByPk(submissionId, {
    transaction,
    ...(lockSubmission ? { lock: buildSubmissionLock(transaction) } : {}),
  });

  if (!submission) return null;

  const riwayat = await RiwayatPersetujuan.findAll({
    where: { pengajuan_id: submissionId },
    attributes: RIWAYAT_TOPIK_PARALLEL_ATTRIBUTES,
    transaction,
  });

  submission.setDataValue("riwayat", riwayat);
  submission.riwayat = riwayat;
  return submission;
}

function buildTopikListFromSubmission(submission) {
  if (!submission) return [];
  return [
    submission.topik_1_kode
      ? {
          slot: 1,
          kode: submission.topik_1_kode,
          judul: submission.topik_1_judul,
          dosen_id: toNumber(submission.dosen_pilihan_1),
          dosen_nama: submission.dosen_1_nama || null,
        }
      : null,
    submission.topik_2_kode
      ? {
          slot: 2,
          kode: submission.topik_2_kode,
          judul: submission.topik_2_judul,
          dosen_id: toNumber(submission.dosen_pilihan_2),
          dosen_nama: submission.dosen_2_nama || null,
        }
      : null,
    submission.topik_3_kode
      ? {
          slot: 3,
          kode: submission.topik_3_kode,
          judul: submission.topik_3_judul,
          dosen_id: toNumber(submission.dosen_pilihan_3),
          dosen_nama: submission.dosen_3_nama || null,
        }
      : null,
  ].filter(Boolean);
}

function getTopikParallelReviewDeadline(submission) {
  return null;
}

function isTopikParallelSubmission(submission) {
  return String(submission?.tipe_pengajuan || "").trim().toLowerCase() === "topik_dosen";
}

function isJudulMandiriSubmission(submission) {
  return String(submission?.tipe_pengajuan || "").trim().toLowerCase() === "judul_mandiri";
}

function isCalonPembimbingDecision(item) {
  return normalizeApprovalType(item?.tipe_approval) === "calon_pembimbing";
}

function hasCalonPembimbingFinalDecision(submission) {
  return getSubmissionRiwayatRows(submission).some(
    (item) => isCalonPembimbingDecision(item) && ["approved", "rejected"].includes(normalizeRiwayatStatus(item?.status))
  );
}

function evaluateJudulMandiriReviewState(submission, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const riwayat = getSubmissionRiwayatRows(submission);
  const supervisorDecision =
    riwayat
      .filter((item) => isCalonPembimbingDecision(item))
      .slice()
      .sort(
        (left, right) =>
          toDecisionDate(right.tanggal_keputusan || right.updatedAt || right.createdAt, new Date(0)).getTime() -
          toDecisionDate(left.tanggal_keputusan || left.updatedAt || left.createdAt, new Date(0)).getTime()
      )[0] || null;
  const rawStatus = normalizeRiwayatStatus(supervisorDecision?.status || "pending");

  return {
    now,
    deadline_at: null,
    deadline_passed: false,
    supervisor_status: rawStatus,
    supervisor_status_db: rawStatus,
    supervisor_decision: supervisorDecision,
    reminder_count: Number(supervisorDecision?.reminder_count || 0),
    last_reminded_at: supervisorDecision?.last_reminded_at || null,
    can_finalize: false,
  };
}

async function isSubmissionPenelitianTrack(submission, transaction) {
  if (!submission?.mahasiswa_id) {
    return isTopikParallelSubmission(submission);
  }

  const latestPendaftaran = await PendaftaranPenjaluran.findOne({
    where: {
      mahasiswa_id: submission.mahasiswa_id,
      status: { [Op.in]: ["approved", "processed", "submitted"] },
    },
    attributes: ["jalur", "jenis_jalur_diambil", "penjaluran_baru", "penjaluran_sebelumnya"],
    order: [["createdAt", "DESC"]],
    transaction,
  });

  if (!latestPendaftaran) {
    return isTopikParallelSubmission(submission);
  }

  const jalur = String(latestPendaftaran.jalur || "").toLowerCase();
  const jenisRaw =
    jalur === "alih"
      ? latestPendaftaran.penjaluran_baru
      : latestPendaftaran.jenis_jalur_diambil ||
        latestPendaftaran.penjaluran_baru ||
        latestPendaftaran.penjaluran_sebelumnya;
  const jenis = normalizeJenisJalurPenelitian(jenisRaw);

  if (!jenis) {
    return isTopikParallelSubmission(submission);
  }

  return jenis === "penelitian";
}

async function resolveKetuaKlasterByTopikKode(topikKode, transaction) {
  if (!topikKode) {
    return {
      ok: false,
      reason: "TOPIK_NOT_FOUND",
      message: "Topik yang disetujui tidak ditemukan.",
    };
  }

  const topik = await Topik.findOne({
    where: { kode: topikKode },
    attributes: ["kode", "cluster", "dosen_id"],
    transaction,
  });
  if (!topik) {
    return {
      ok: false,
      reason: "TOPIK_NOT_FOUND",
      message: `Topik ${topikKode} tidak ditemukan.`,
    };
  }

  const kodePrefix = String(topik.kode || "")
    .trim()
    .toUpperCase()
    .replace(/[0-9].*$/, "");
  const klasterKode = normalizeTopikClusterCode(topik.cluster) || normalizeTopikClusterCode(kodePrefix);
  if (!klasterKode) {
    return {
      ok: false,
      reason: "CLUSTER_NOT_FOUND",
      message: `Klaster topik ${topikKode} tidak valid atau belum diisi.`,
    };
  }

  const klaster = await Klaster.findOne({
    where: { kode: klasterKode },
    attributes: ["id", "kode", "nama"],
    transaction,
  });
  if (!klaster) {
    return {
      ok: false,
      reason: "CLUSTER_NOT_FOUND",
      message: `Master klaster ${klasterKode} belum tersedia.`,
    };
  }

  const periodeAktif = await PeriodePenjaluran.findOne({
    where: { is_active: true },
    attributes: ["id", "label_periode", "tahun_akademik", "semester"],
    order: [["updatedAt", "DESC"]],
    transaction,
  });
  if (!periodeAktif) {
    return {
      ok: false,
      reason: "NO_ACTIVE_PERIODE",
      message: "Belum ada periode penjaluran aktif. Sekretaris prodi harus membuka periode terlebih dahulu.",
    };
  }

  const ketuaKlaster = await KlasterKetuaPeriode.findOne({
    where: {
      klaster_id: klaster.id,
      periode_penjaluran_id: periodeAktif.id,
    },
    attributes: ["id", "dosen_id", "klaster_id", "periode_penjaluran_id"],
    include: [
      {
        model: Dosen,
        as: "ketuaDosen",
        attributes: ["id", "nik", "nama", "email"],
        required: true,
      },
    ],
    transaction,
  });

  if (!ketuaKlaster) {
    return {
      ok: false,
      reason: "KETUA_NOT_SET",
      message: `Ketua cluster untuk ${klaster.kode} pada periode ${periodeAktif.label_periode} belum ditetapkan.`,
      detail: {
        klaster: klaster.kode,
        periode: periodeAktif.label_periode,
      },
    };
  }

  return {
    ok: true,
    reason: "OK",
    topik,
    klaster,
    periode: periodeAktif,
    ketuaKlaster,
  };
}

function isKetuaClusterOwnTopicConflict(winner, ketuaResolution) {
  const winnerDosenId = toNumber(winner?.dosen_id);
  const topikOwnerId = toNumber(ketuaResolution?.topik?.dosen_id);
  const ketuaDosenId = toNumber(ketuaResolution?.ketuaKlaster?.dosen_id);
  return Boolean(
    winnerDosenId &&
      ketuaDosenId &&
      Number(winnerDosenId) === Number(ketuaDosenId) &&
      (!topikOwnerId || Number(topikOwnerId) === Number(winnerDosenId))
  );
}

function buildClusterSkipApprovalNote(winner, ketuaResolution) {
  const clusterLabel = ketuaResolution?.klaster?.kode || ketuaResolution?.klaster?.nama || "-";
  const topikKode = winner?.kode || "-";
  return `Validasi cluster di-skip otomatis. Alasan: ketua cluster ${clusterLabel} adalah pemilik topik ${topikKode} yang diajukan.`;
}

async function createClusterSkipApprovalHistory(submission, winner, ketuaResolution, transaction) {
  const existingKoordinatorDecision = await RiwayatPersetujuan.findOne({
    where: {
      pengajuan_id: submission.id,
      tipe_approval: "koordinator",
      topik_slot: normalizeTopikSlot(winner.slot),
      status: { [Op.in]: ["approved", "rejected"] },
    },
    attributes: ["id"],
    transaction,
  });

  if (existingKoordinatorDecision) {
    return existingKoordinatorDecision;
  }

  return RiwayatPersetujuan.create(
    {
      pengajuan_id: submission.id,
      dosen_id: ketuaResolution.ketuaKlaster.dosen_id,
      tipe_approval: "koordinator",
      topik_slot: normalizeTopikSlot(winner.slot),
      topik_kode: winner.kode || null,
      status: "approved",
      keterangan: buildClusterSkipApprovalNote(winner, ketuaResolution),
      tanggal_keputusan: new Date(),
    },
    { transaction }
  );
}

function getCalonPembimbingDecisionLookup(riwayat = []) {
  const bySlot = new Map();
  const byDosenFallback = new Map();

  for (const item of riwayat) {
    if (normalizeApprovalType(item?.tipe_approval) !== "calon_pembimbing") continue;
    const dosenId = toNumber(item?.dosen_id);
    if (!dosenId) continue;
    const topikSlot = normalizeTopikSlot(item?.topik_slot);

    const decidedAt = toDecisionDate(item?.tanggal_keputusan || item?.updatedAt || item?.createdAt, new Date(0));
    const nextValue = {
      id: item?.id || null,
      dosen_id: dosenId,
      topik_slot: topikSlot,
      topik_kode: item?.topik_kode || null,
      status_db: normalizeRiwayatStatus(item?.status),
      keterangan: item?.keterangan || null,
      decided_at: decidedAt,
      reminder_count: Number(item?.reminder_count || 0),
      last_reminded_at: item?.last_reminded_at || null,
    };

    if (topikSlot) {
      const currentBySlot = bySlot.get(topikSlot);
      if (!currentBySlot || decidedAt >= currentBySlot.decided_at) {
        bySlot.set(topikSlot, nextValue);
      }
    } else {
      const currentFallback = byDosenFallback.get(dosenId);
      if (!currentFallback || decidedAt >= currentFallback.decided_at) {
        byDosenFallback.set(dosenId, nextValue);
      }
    }
  }

  return {
    by_slot: bySlot,
    by_dosen_fallback: byDosenFallback,
  };
}

function evaluateTopikParallelState(submission, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const topikList = buildTopikListFromSubmission(submission);
  const riwayat = getSubmissionRiwayatRows(submission);
  const decisionLookup = getCalonPembimbingDecisionLookup(riwayat);

  const slotDecisions = topikList.map((topik) => {
    const reviewerDecision =
      decisionLookup.by_slot.get(Number(topik.slot)) ||
      (topik.dosen_id ? decisionLookup.by_dosen_fallback.get(Number(topik.dosen_id)) : null) ||
      null;
    const rawStatus = normalizeRiwayatStatus(reviewerDecision?.status_db || "pending");
    return {
      ...topik,
      reviewer_row_id: reviewerDecision?.id || null,
      reviewer_status: rawStatus,
      reviewer_status_db: rawStatus,
      reviewer_note: reviewerDecision?.keterangan || null,
      reviewer_decided_at: reviewerDecision?.decided_at || null,
      reminder_count: Number(reviewerDecision?.reminder_count || 0),
      last_reminded_at: reviewerDecision?.last_reminded_at || null,
    };
  });

  const approvedSlots = slotDecisions
    .filter((item) => item.reviewer_status === "approved")
    .sort((a, b) => a.slot - b.slot);
  const pendingSlots = slotDecisions.filter((item) => item.reviewer_status === "pending");
  const rejectedSlots = slotDecisions.filter((item) => item.reviewer_status === "rejected");
  const expiredSlots = slotDecisions.filter((item) => item.reviewer_status === "expired");

  const rejectionNotes = rejectedSlots
    .map((item) => String(item.reviewer_note || "").trim())
    .filter(Boolean);

  return {
    now,
    deadline_at: null,
    deadline_passed: false,
    slot_decisions: slotDecisions,
    approved_slots: approvedSlots,
    pending_slots: pendingSlots,
    rejected_slots: rejectedSlots,
    expired_slots: expiredSlots,
    approved_topik: approvedSlots[0] || null,
    pending_count: pendingSlots.length,
    can_finalize: topikList.length > 0 && pendingSlots.length === 0,
    rejection_notes: rejectionNotes,
  };
}

function evaluateTopikClusterReviewState(submission) {
  const parallelState = evaluateTopikParallelState(submission);
  const approvedSlots = parallelState.approved_slots || [];
  const approvedSlotSet = new Set(approvedSlots.map((item) => Number(item.slot)));
  const decisionsBySlot = new Map();
  const legacyDecisions = [];

  for (const item of getSubmissionRiwayatRows(submission)) {
    if (normalizeApprovalType(item?.tipe_approval) !== "koordinator") continue;
    const status = normalizeRiwayatStatus(item?.status);
    if (!["approved", "rejected"].includes(status)) continue;
    const slot = normalizeTopikSlot(item?.topik_slot);
    const decision = {
      row: item,
      status,
      topik_slot: slot,
      decided_at: toDecisionDate(item?.tanggal_keputusan || item?.updatedAt || item?.createdAt, new Date(0)),
    };
    if (!slot || !approvedSlotSet.has(slot)) {
      legacyDecisions.push(decision);
      continue;
    }
    const current = decisionsBySlot.get(slot);
    if (!current || decision.decided_at >= current.decided_at) {
      decisionsBySlot.set(slot, decision);
    }
  }

  // Riwayat lama belum menyimpan topik_slot karena sebelumnya hanya satu topik
  // yang diteruskan ke ketua cluster.
  if (legacyDecisions.length > 0 && approvedSlots.length > 0 && !decisionsBySlot.has(Number(approvedSlots[0].slot))) {
    const latestLegacy = legacyDecisions.sort((left, right) => right.decided_at - left.decided_at)[0];
    decisionsBySlot.set(Number(approvedSlots[0].slot), latestLegacy);
  }

  const pendingSlots = approvedSlots.filter((item) => !decisionsBySlot.has(Number(item.slot)));
  const clusterApprovedSlots = approvedSlots.filter(
    (item) => decisionsBySlot.get(Number(item.slot))?.status === "approved"
  );
  const clusterRejectedSlots = approvedSlots.filter(
    (item) => decisionsBySlot.get(Number(item.slot))?.status === "rejected"
  );

  return {
    ...parallelState,
    cluster_decisions_by_slot: decisionsBySlot,
    cluster_pending_slots: pendingSlots,
    cluster_approved_slots: clusterApprovedSlots,
    cluster_rejected_slots: clusterRejectedSlots,
    next_cluster_topik: pendingSlots[0] || null,
    final_winner: clusterApprovedSlots[0] || null,
    cluster_review_complete: approvedSlots.length > 0 && pendingSlots.length === 0,
  };
}

function evaluateTopikSekprodiReviewState(submission) {
  const clusterState = evaluateTopikClusterReviewState(submission);
  const clusterApprovedSlots = clusterState.cluster_approved_slots || [];
  const clusterApprovedSlotSet = new Set(clusterApprovedSlots.map((item) => Number(item.slot)));
  const decisionsBySlot = new Map();

  for (const item of getSubmissionRiwayatRows(submission)) {
    if (normalizeApprovalType(item?.tipe_approval) !== "sekprodi") continue;
    const slot = normalizeTopikSlot(item?.topik_slot);
    if (!slot || !clusterApprovedSlotSet.has(slot)) continue;
    const decision = {
      row: item,
      status: normalizeRiwayatStatus(item?.status),
      topik_slot: slot,
      decided_at: toDecisionDate(item?.tanggal_keputusan || item?.updatedAt || item?.createdAt, new Date(0)),
    };
    const current = decisionsBySlot.get(slot);
    if (!current || decision.decided_at >= current.decided_at) decisionsBySlot.set(slot, decision);
  }

  const pendingSlots = clusterApprovedSlots.filter(
    (item) => !decisionsBySlot.has(Number(item.slot)) || decisionsBySlot.get(Number(item.slot))?.status === "pending"
  );
  const approvedSlots = clusterApprovedSlots.filter(
    (item) => decisionsBySlot.get(Number(item.slot))?.status === "approved"
  );
  const rejectedSlots = clusterApprovedSlots.filter(
    (item) => decisionsBySlot.get(Number(item.slot))?.status === "rejected"
  );

  return {
    ...clusterState,
    sekprodi_decisions_by_slot: decisionsBySlot,
    sekprodi_pending_slots: pendingSlots,
    sekprodi_approved_slots: approvedSlots,
    sekprodi_rejected_slots: rejectedSlots,
    sekprodi_final_winner: approvedSlots[0] || null,
  };
}

async function ensureParallelReviewerRows(submission, transaction) {
  if (!submission || !isTopikParallelSubmission(submission)) {
    return { created: 0 };
  }

  const topikList = buildTopikListFromSubmission(submission);
  const topikSlots = topikList.map((item) => normalizeTopikSlot(item.slot)).filter(Boolean);
  if (topikSlots.length === 0) return { created: 0 };

  const existingRows = await RiwayatPersetujuan.findAll({
    where: {
      pengajuan_id: submission.id,
      tipe_approval: "calon_pembimbing",
      topik_slot: topikSlots,
    },
    attributes: ["id", "dosen_id", "topik_slot"],
    transaction,
  });

  const existingSlotSet = new Set(existingRows.map((row) => normalizeTopikSlot(row.topik_slot)).filter(Boolean));
  const now = new Date();
  let created = 0;

  for (const topik of topikList) {
    const dosenId = toNumber(topik.dosen_id);
    const topikSlot = normalizeTopikSlot(topik.slot);
    if (!dosenId || !topikSlot) continue;
    if (existingSlotSet.has(topikSlot)) continue;

    await RiwayatPersetujuan.create(
      {
        pengajuan_id: submission.id,
        dosen_id: dosenId,
        tipe_approval: "calon_pembimbing",
        topik_slot: topikSlot,
        topik_kode: topik.kode || null,
        status: "pending",
        keterangan: `Menunggu keputusan dosen untuk topik slot ${topikSlot}.`,
        tanggal_keputusan: submission.createdAt || now,
      },
      { transaction }
    );
    existingSlotSet.add(topikSlot);
    created += 1;
  }

  return { created };
}

async function syncPendingReviewReminders(submissionIds = [], options = {}) {
  const ids = [...new Set((submissionIds || []).map((id) => toNumber(id)).filter(Boolean))];
  if (ids.length === 0) return { reminded: 0 };

  const now = options.now instanceof Date ? options.now : new Date();
  const dueBefore = new Date(now.getTime() - REVIEW_REMINDER_INTERVAL_MS);
  const rows = await RiwayatPersetujuan.findAll({
    where: {
      pengajuan_id: { [Op.in]: ids },
      tipe_approval: "calon_pembimbing",
      status: "pending",
      createdAt: { [Op.lte]: dueBefore },
      [Op.or]: [
        { last_reminded_at: null },
        { last_reminded_at: { [Op.lte]: dueBefore } },
      ],
    },
    transaction: options.transaction,
  });

  for (const row of rows) {
    await row.update(
      {
        reminder_count: Number(row.reminder_count || 0) + 1,
        last_reminded_at: now,
      },
      { transaction: options.transaction }
    );
  }

  return { reminded: rows.length };
}

function buildFinalRejectReason(parallelState) {
  const notes = Array.isArray(parallelState?.rejection_notes) ? parallelState.rejection_notes : [];
  if (notes.length > 0) {
    return `Pengajuan tidak lolos review dosen. Catatan: ${notes.join(" | ")}`;
  }
  return "Pengajuan ditolak oleh seluruh dosen pilihan.";
}

function getMahasiswaFallbackStatusForRejectedSubmission(submission) {
  const jenisJalur = String(submission?.jenis_jalur || "").trim().toLowerCase();
  if (jenisJalur === "ulang") return "ulang";
  if (jenisJalur === "ekstensi") return "ekstensi";
  return "belum_mengajukan";
}

async function routeTopikWinnerToSekprodi(submission, winner, transaction, options = {}) {
  await submission.update(
    {
      status: "menunggu_approval_sekprodi",
      alasan_persetujuan:
        options.alasanPersetujuan ||
        `Disetujui ketua cluster untuk topik slot ${winner.slot}. Menunggu persetujuan final sekretaris prodi.`,
      alasan_penolakan: null,
      dosen_saat_ini: winner.dosen_id,
    },
    { transaction }
  );

  const releaseCodes = buildTopikListFromSubmission(submission)
    .map((item) => item.kode)
    .filter((kode) => kode && kode !== winner.kode);
  if (releaseCodes.length > 0) {
    await Topik.update(
      { status: "available" },
      {
        where: {
          kode: releaseCodes,
          status: "reserved",
        },
        transaction,
      }
    );
  }

  return {
    success: true,
    final_status: "menunggu_approval_sekprodi",
    winner,
  };
}

async function finalizeApprovedTopikSubmission(submission, parallelState, transaction) {
  const winner = parallelState.approved_topik;
  if (!winner?.kode || !winner?.dosen_id) {
    return { success: false, reason: "TOPIK_WINNER_NOT_FOUND" };
  }

  const requiresKetuaCluster = await isSubmissionPenelitianTrack(submission, transaction);
  if (requiresKetuaCluster) {
    const ketuaResolution = await resolveKetuaKlasterByTopikKode(winner.kode, transaction);
    if (!ketuaResolution.ok) {
      await submission.update(
        {
          status: "menunggu_set_ketua_cluster",
          alasan_persetujuan:
            submission.alasan_persetujuan ||
            `Disetujui dosen pembimbing untuk topik slot ${winner.slot}. Menunggu penetapan ketua cluster.`,
          alasan_penolakan: null,
          dosen_saat_ini: null,
        },
        { transaction }
      );

      return {
        success: true,
        final_status: "menunggu_set_ketua_cluster",
        winner,
        routed_to_ketua_cluster: false,
        waiting_ketua_cluster: true,
        ketua_resolution: ketuaResolution,
      };
    }

    if (isKetuaClusterOwnTopicConflict(winner, ketuaResolution)) {
      await createClusterSkipApprovalHistory(submission, winner, ketuaResolution, transaction);
      const refreshedSubmission = await loadSubmissionWithRiwayat(submission.id, { transaction });
      const clusterState = evaluateTopikClusterReviewState(refreshedSubmission);
      const nextTopik = clusterState.next_cluster_topik;

      if (nextTopik) {
        const nextResolution = await resolveKetuaKlasterByTopikKode(nextTopik.kode, transaction);
        if (nextResolution.ok) {
          await submission.update(
            {
              status: "pending",
              dosen_saat_ini: nextResolution.ketuaKlaster.dosen_id,
              alasan_persetujuan: `Validasi cluster ${ketuaResolution.klaster.kode} dilewati otomatis. Menunggu review ketua cluster ${nextResolution.klaster.kode} untuk topik slot ${nextTopik.slot}.`,
              alasan_penolakan: null,
            },
            { transaction }
          );
          return {
            success: true,
            final_status: "pending",
            winner: nextTopik,
            routed_to_ketua_cluster: true,
            waiting_ketua_cluster: false,
            cluster_validation_skipped: true,
            ketua_resolution: nextResolution,
          };
        }
      }

      const finalWinner = clusterState.final_winner || winner;
      const result = await routeTopikWinnerToSekprodi(submission, finalWinner, transaction, {
        alasanPersetujuan: `Disetujui dosen pembimbing dan validasi cluster ${ketuaResolution.klaster.kode} dilewati otomatis karena pemilik topik adalah ketua cluster. Menunggu persetujuan final sekretaris prodi.`,
      });

      return {
        ...result,
        routed_to_ketua_cluster: false,
        waiting_ketua_cluster: false,
        cluster_validation_skipped: true,
        ketua_resolution: ketuaResolution,
      };
    }

    await submission.update(
      {
        status: "pending",
        alasan_persetujuan:
          submission.alasan_persetujuan ||
          `Disetujui dosen pembimbing untuk topik slot ${winner.slot}. Menunggu review ketua cluster ${ketuaResolution.klaster.kode}.`,
        alasan_penolakan: null,
        dosen_saat_ini: ketuaResolution.ketuaKlaster.dosen_id,
      },
      { transaction }
    );

    return {
      success: true,
      final_status: "pending",
      winner,
      routed_to_ketua_cluster: true,
      waiting_ketua_cluster: false,
      ketua_resolution: ketuaResolution,
    };
  }

  return routeTopikWinnerToSekprodi(submission, winner, transaction, {
    alasanPersetujuan:
      submission.alasan_persetujuan ||
      `Disetujui berdasarkan prioritas pilihan mahasiswa (slot ${winner.slot}). Menunggu persetujuan final sekretaris prodi.`,
  });
}

async function finalizeRejectedTopikSubmission(submission, parallelState, transaction) {
  await submission.update(
    {
      status: "rejected",
      dosen_saat_ini: null,
      alasan_persetujuan: null,
      alasan_penolakan: buildFinalRejectReason(parallelState),
    },
    { transaction }
  );

  const reservedCodes = buildTopikListFromSubmission(submission)
    .map((item) => item.kode)
    .filter(Boolean);

  if (reservedCodes.length > 0) {
    await Topik.update(
      { status: "available" },
      {
        where: {
          kode: reservedCodes,
          status: "reserved",
        },
        transaction,
      }
    );
  }

  const mahasiswa = await Mahasiswa.findByPk(submission.mahasiswa_id, {
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  if (mahasiswa && Number(mahasiswa.pengajuan_aktif_id) === Number(submission.id)) {
    await mahasiswa.update(
      {
        pengajuan_aktif_id: null,
        status_jalur_saat_ini: getMahasiswaFallbackStatusForRejectedSubmission(submission),
      },
      { transaction }
    );
  }

  return {
    success: true,
    final_status: "rejected",
    winner: null,
  };
}

async function finalizeTopikParallelSubmission(submissionId, options = {}) {
  const externalTransaction = options.transaction || null;
  const transaction = externalTransaction || (await sequelize.transaction());

  try {
    let submission = await loadSubmissionWithRiwayat(submissionId, {
      transaction,
      lockSubmission: true,
    });

    if (!submission || !isTopikParallelSubmission(submission)) {
      if (!externalTransaction) await transaction.commit();
      return {
        success: true,
        changed: false,
        finalized: false,
        submission,
        parallel_state: submission ? evaluateTopikParallelState(submission) : null,
      };
    }

    const ensureResult = await ensureParallelReviewerRows(submission, transaction);
    if (ensureResult.created > 0) {
      submission = await loadSubmissionWithRiwayat(submissionId, {
        transaction,
        lockSubmission: true,
      });
    }

    const parallelState = evaluateTopikParallelState(submission);
    if (!["pending", "menunggu_set_ketua_cluster", "menunggu_approval_sekprodi"].includes(submission.status)) {
      if (!externalTransaction) await transaction.commit();
      return {
        success: true,
        changed: ensureResult.created > 0,
        finalized: false,
        submission,
        parallel_state: parallelState,
      };
    }

    if (parallelState.can_finalize && parallelState.approved_slots.length === 0) {
      const finalizationResult = await finalizeRejectedTopikSubmission(submission, parallelState, transaction);
      const refreshedSubmission = await loadSubmissionWithRiwayat(submissionId, { transaction });
      if (!externalTransaction) await transaction.commit();
      return {
        success: true,
        changed: true,
        finalized: true,
        final_status: finalizationResult.final_status,
        winner: null,
        submission: refreshedSubmission,
        parallel_state: evaluateTopikParallelState(refreshedSubmission),
      };
    }

    const progressiveResult = await syncProgressiveTopikReviewRows(submission, transaction);

    const refreshedSubmission = await loadSubmissionWithRiwayat(submissionId, {
      transaction,
    });

    if (!externalTransaction) await transaction.commit();

    return {
      success: true,
      changed: true,
      finalized: false,
      final_status: refreshedSubmission.status,
      winner: progressiveResult.routed_topik || null,
      routed_to_ketua_cluster: progressiveResult.created_cluster_rows > 0,
      waiting_ketua_cluster: Boolean(progressiveResult.missing_ketua_topik),
      cluster_validation_skipped: progressiveResult.skipped_cluster_rows > 0,
      ketua_resolution: progressiveResult.ketua_resolution || null,
      submission: refreshedSubmission,
      parallel_state: evaluateTopikParallelState(refreshedSubmission),
    };
  } catch (error) {
    if (!externalTransaction) await transaction.rollback();
    throw error;
  }
}

async function syncProgressiveTopikReviewRows(submission, transaction) {
  let currentSubmission = await loadSubmissionWithRiwayat(submission.id, { transaction, lockSubmission: true });
  let clusterState = evaluateTopikClusterReviewState(currentSubmission);
  let createdClusterRows = 0;
  let skippedClusterRows = 0;
  let createdSekprodiRows = 0;
  let missingKetuaTopik = null;
  let ketuaResolution = null;
  let routedTopik = null;

  for (const topik of clusterState.cluster_pending_slots) {
    const existingRow = getSubmissionRiwayatRows(currentSubmission).find(
      (item) => normalizeApprovalType(item?.tipe_approval) === "koordinator" && Number(item?.topik_slot) === Number(topik.slot)
    );
    if (existingRow) continue;

    const resolution = await resolveKetuaKlasterByTopikKode(topik.kode, transaction);
    if (!resolution.ok) {
      missingKetuaTopik = missingKetuaTopik || topik;
      continue;
    }
    ketuaResolution = ketuaResolution || resolution;
    routedTopik = routedTopik || topik;
    if (isKetuaClusterOwnTopicConflict(topik, resolution)) {
      await createClusterSkipApprovalHistory(currentSubmission, topik, resolution, transaction);
      skippedClusterRows += 1;
    } else {
      await RiwayatPersetujuan.create(
        {
          pengajuan_id: currentSubmission.id,
          dosen_id: resolution.ketuaKlaster.dosen_id,
          tipe_approval: "koordinator",
          topik_slot: topik.slot,
          topik_kode: topik.kode,
          status: "pending",
          keterangan: `Menunggu keputusan ketua cluster ${resolution.klaster.kode}.`,
          tanggal_keputusan: new Date(),
        },
        { transaction }
      );
      createdClusterRows += 1;
    }
    await Topik.update({ status: "reserved" }, { where: { kode: topik.kode, status: "available" }, transaction });
  }

  currentSubmission = await loadSubmissionWithRiwayat(currentSubmission.id, { transaction });
  clusterState = evaluateTopikClusterReviewState(currentSubmission);
  for (const topik of clusterState.cluster_approved_slots) {
    const existingRow = getSubmissionRiwayatRows(currentSubmission).find(
      (item) => normalizeApprovalType(item?.tipe_approval) === "sekprodi" && Number(item?.topik_slot) === Number(topik.slot)
    );
    if (existingRow) continue;
    await RiwayatPersetujuan.create(
      {
        pengajuan_id: currentSubmission.id,
        dosen_id: null,
        sekretaris_prodi_id: null,
        tipe_approval: "sekprodi",
        topik_slot: topik.slot,
        topik_kode: topik.kode,
        status: "pending",
        keterangan: `Menunggu keputusan final sekretaris prodi untuk topik slot ${topik.slot}.`,
        tanggal_keputusan: new Date(),
      },
      { transaction }
    );
    createdSekprodiRows += 1;
  }

  currentSubmission = await loadSubmissionWithRiwayat(currentSubmission.id, { transaction });
  const sekprodiState = evaluateTopikSekprodiReviewState(currentSubmission);
  const pendingSupervisorCount = sekprodiState.pending_slots.length;
  const pendingClusterRows = getSubmissionRiwayatRows(currentSubmission).filter(
    (item) => normalizeApprovalType(item?.tipe_approval) === "koordinator" && normalizeRiwayatStatus(item?.status) === "pending"
  );
  const pendingSekprodiCount = sekprodiState.sekprodi_pending_slots.length;
  const upstreamPending = pendingSupervisorCount > 0 || pendingClusterRows.length > 0 || Boolean(missingKetuaTopik);
  const noRemainingCandidate =
    sekprodiState.can_finalize &&
    !upstreamPending &&
    pendingSekprodiCount === 0 &&
    sekprodiState.sekprodi_approved_slots.length === 0;

  if (noRemainingCandidate) {
    const rejectionNotes = getSubmissionRiwayatRows(currentSubmission)
      .filter((item) =>
        ["calon_pembimbing", "koordinator", "sekprodi"].includes(normalizeApprovalType(item?.tipe_approval)) &&
        normalizeRiwayatStatus(item?.status) === "rejected"
      )
      .map((item) => String(item?.keterangan || "").trim())
      .filter(Boolean);
    await finalizeRejectedTopikSubmission(
      currentSubmission,
      { ...sekprodiState, rejection_notes: rejectionNotes },
      transaction
    );
    return {
      created_cluster_rows: createdClusterRows,
      skipped_cluster_rows: skippedClusterRows,
      created_sekprodi_rows: createdSekprodiRows,
      missing_ketua_topik: missingKetuaTopik,
      ketua_resolution: ketuaResolution,
      routed_topik: routedTopik,
      finalized_rejected: true,
    };
  }

  const nextStatus = pendingSekprodiCount > 0 && !upstreamPending ? "menunggu_approval_sekprodi" : "pending";
  const nextReviewer = pendingClusterRows[0]?.dosen_id || null;

  await currentSubmission.update(
    {
      status: nextStatus,
      dosen_saat_ini: nextReviewer,
      alasan_persetujuan:
        pendingSekprodiCount > 0
          ? `${pendingSekprodiCount} topik siap direview Sekprodi${upstreamPending ? ", sementara topik lainnya masih diproses" : ""}.`
          : missingKetuaTopik
          ? `Topik slot ${missingKetuaTopik.slot} menunggu penetapan ketua cluster.`
          : "Menunggu proses review topik berikutnya.",
    },
    { transaction }
  );

  return {
    created_cluster_rows: createdClusterRows,
    skipped_cluster_rows: skippedClusterRows,
    created_sekprodi_rows: createdSekprodiRows,
    missing_ketua_topik: missingKetuaTopik,
    ketua_resolution: ketuaResolution,
    routed_topik: routedTopik,
  };
}

async function finalizeTopikParallelSubmissionsByIds(submissionIds = []) {
  const uniqueIds = [...new Set((submissionIds || []).map((id) => toNumber(id)).filter(Boolean))];
  for (const id of uniqueIds) {
    await finalizeTopikParallelSubmission(id);
  }
}

async function reconcilePendingTopikClusterReviews() {
  const candidates = await Pengajuan.findAll({
    where: {
      tipe_pengajuan: "topik_dosen",
      status: { [Op.in]: ["pending", "menunggu_set_ketua_cluster", "menunggu_approval_sekprodi"] },
    },
    attributes: ["id"],
  });
  let rerouted = 0;

  for (const candidate of candidates) {
    const transaction = await sequelize.transaction();
    try {
      const submission = await loadSubmissionWithRiwayat(candidate.id, {
        transaction,
        lockSubmission: true,
      });
      await syncProgressiveTopikReviewRows(submission, transaction);

      await transaction.commit();
      rerouted += 1;
    } catch (error) {
      if (!transaction.finished) await transaction.rollback();
      throw error;
    }
  }

  return { rerouted };
}

async function finalizeJudulMandiriDeadlineSubmission(submissionId, options = {}) {
  const externalTransaction = options.transaction || null;
  const transaction = externalTransaction || (await sequelize.transaction());

  try {
    const submission = await loadSubmissionWithRiwayat(submissionId, {
      transaction,
      lockSubmission: true,
    });

    if (!submission || !isJudulMandiriSubmission(submission)) {
      if (!externalTransaction) await transaction.commit();
      return {
        success: true,
        changed: false,
        finalized: false,
        submission,
        review_state: submission ? evaluateJudulMandiriReviewState(submission) : null,
      };
    }

    if (!externalTransaction) await transaction.commit();

    return {
      success: true,
      changed: false,
      finalized: false,
      final_status: submission.status,
      submission,
      review_state: evaluateJudulMandiriReviewState(submission),
    };
  } catch (error) {
    if (!externalTransaction) await transaction.rollback();
    throw error;
  }
}

async function finalizeJudulMandiriDeadlineSubmissionsByIds(submissionIds = []) {
  const uniqueIds = [...new Set((submissionIds || []).map((id) => toNumber(id)).filter(Boolean))];
  for (const id of uniqueIds) {
    await finalizeJudulMandiriDeadlineSubmission(id);
  }
}

module.exports = {
  TOPIK_PARALLEL_REVIEW_HOURS,
  TOPIK_PARALLEL_REVIEW_MS,
  REVIEW_REMINDER_INTERVAL_HOURS,
  isTopikParallelSubmission,
  isJudulMandiriSubmission,
  buildTopikListFromSubmission,
  getTopikParallelReviewDeadline,
  evaluateTopikParallelState,
  evaluateTopikClusterReviewState,
  evaluateTopikSekprodiReviewState,
  evaluateJudulMandiriReviewState,
  ensureParallelReviewerRows,
  syncPendingReviewReminders,
  finalizeTopikParallelSubmission,
  finalizeTopikParallelSubmissionsByIds,
  reconcilePendingTopikClusterReviews,
  finalizeJudulMandiriDeadlineSubmission,
  finalizeJudulMandiriDeadlineSubmissionsByIds,
};
