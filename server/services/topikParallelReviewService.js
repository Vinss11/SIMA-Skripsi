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

const TOPIK_PARALLEL_REVIEW_HOURS = 72;
const TOPIK_PARALLEL_REVIEW_MS = TOPIK_PARALLEL_REVIEW_HOURS * 60 * 60 * 1000;
const RIWAYAT_TOPIK_PARALLEL_ATTRIBUTES = [
  "id",
  "dosen_id",
  "tipe_approval",
  "topik_slot",
  "topik_kode",
  "status",
  "keterangan",
  "tanggal_keputusan",
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
  if (["approved", "rejected", "pending", "expired"].includes(normalized)) {
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
  const createdAt = toDecisionDate(submission?.createdAt, new Date());
  return new Date(createdAt.getTime() + TOPIK_PARALLEL_REVIEW_MS);
}

function isTopikParallelSubmission(submission) {
  return String(submission?.tipe_pengajuan || "").trim().toLowerCase() === "topik_dosen";
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
    attributes: ["kode", "cluster"],
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

function hasKoordinatorDecision(submission) {
  const riwayat = getSubmissionRiwayatRows(submission);
  return riwayat.some(
    (item) =>
      normalizeApprovalType(item?.tipe_approval) === "koordinator" &&
      ["approved", "rejected"].includes(normalizeRiwayatStatus(item?.status))
  );
}

function evaluateTopikParallelState(submission, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const topikList = buildTopikListFromSubmission(submission);
  const deadlineAt = getTopikParallelReviewDeadline(submission);
  const deadlinePassed = now.getTime() >= deadlineAt.getTime();
  const riwayat = getSubmissionRiwayatRows(submission);
  const decisionLookup = getCalonPembimbingDecisionLookup(riwayat);

  const slotDecisions = topikList.map((topik) => {
    const reviewerDecision =
      decisionLookup.by_slot.get(Number(topik.slot)) ||
      (topik.dosen_id ? decisionLookup.by_dosen_fallback.get(Number(topik.dosen_id)) : null) ||
      null;
    const rawStatus = normalizeRiwayatStatus(reviewerDecision?.status_db || "pending");
    const effectiveStatus = rawStatus === "pending" && deadlinePassed ? "expired" : rawStatus;
    return {
      ...topik,
      reviewer_row_id: reviewerDecision?.id || null,
      reviewer_status: effectiveStatus,
      reviewer_status_db: rawStatus,
      reviewer_note: reviewerDecision?.keterangan || null,
      reviewer_decided_at: reviewerDecision?.decided_at || null,
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
    deadline_at: deadlineAt,
    deadline_passed: deadlinePassed,
    slot_decisions: slotDecisions,
    approved_slots: approvedSlots,
    pending_slots: pendingSlots,
    rejected_slots: rejectedSlots,
    expired_slots: expiredSlots,
    approved_topik: approvedSlots[0] || null,
    pending_count: pendingSlots.length,
    can_finalize: pendingSlots.length === 0 || deadlinePassed,
    rejection_notes: rejectionNotes,
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

function buildFinalRejectReason(parallelState) {
  const notes = Array.isArray(parallelState?.rejection_notes) ? parallelState.rejection_notes : [];
  if (notes.length > 0) {
    return `Pengajuan tidak lolos review dosen. Catatan: ${notes.join(" | ")}`;
  }
  if (parallelState?.expired_slots?.length > 0) {
    return "Pengajuan tidak mendapatkan persetujuan dosen hingga tenggat 3x24 jam berakhir.";
  }
  return "Pengajuan ditolak oleh seluruh dosen pilihan.";
}

function getMahasiswaFallbackStatusForRejectedSubmission(submission) {
  const jenisJalur = String(submission?.jenis_jalur || "").trim().toLowerCase();
  if (jenisJalur === "ulang") return "ulang";
  if (jenisJalur === "ekstensi") return "ekstensi";
  return "belum_mengajukan";
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
      final_status: "pending",
      winner,
      routed_to_ketua_cluster: true,
      waiting_ketua_cluster: false,
      ketua_resolution: ketuaResolution,
    };
  }

  await submission.update(
    {
      status: "approved",
      alasan_persetujuan:
        submission.alasan_persetujuan ||
        `Disetujui berdasarkan prioritas pilihan mahasiswa (slot ${winner.slot}).`,
      alasan_penolakan: null,
      dosen_saat_ini: winner.dosen_id,
    },
    { transaction }
  );

  await Topik.update(
    { status: "taken" },
    {
      where: { kode: winner.kode },
      transaction,
    }
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

  const mahasiswa = await Mahasiswa.findByPk(submission.mahasiswa_id, {
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  if (mahasiswa) {
    await mahasiswa.update(
      {
        dosen_pembimbing_skripsi_id: winner.dosen_id,
        status_jalur_saat_ini: submission.jenis_jalur,
        pengajuan_aktif_id: null,
      },
      { transaction }
    );
  }

  const dosenPembimbing = await Dosen.findByPk(winner.dosen_id, { transaction });
  if (dosenPembimbing && typeof dosenPembimbing.getKuotaInfo === "function") {
    const kuotaInfo = await dosenPembimbing.getKuotaInfo();
    if (kuotaInfo?.is_penuh) {
      await Topik.update(
        { status: "unavailable" },
        {
          where: {
            dosen_id: winner.dosen_id,
            status: "available",
          },
          transaction,
        }
      );
    }
  }

  return {
    success: true,
    final_status: "approved",
    winner,
  };
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

    const alreadyWaitingKetuaCluster =
      submission.status === "pending" &&
      parallelState.can_finalize &&
      parallelState.approved_topik &&
      submission.dosen_saat_ini &&
      !hasKoordinatorDecision(submission);
    if (alreadyWaitingKetuaCluster) {
      if (!externalTransaction) await transaction.commit();
      return {
        success: true,
        changed: ensureResult.created > 0,
        finalized: false,
        final_status: submission.status,
        winner: parallelState.approved_topik,
        routed_to_ketua_cluster: true,
        waiting_ketua_cluster: false,
        submission,
        parallel_state: parallelState,
      };
    }

    if (submission.status !== "pending" || !parallelState.can_finalize) {
      if (!externalTransaction) await transaction.commit();
      return {
        success: true,
        changed: ensureResult.created > 0,
        finalized: false,
        submission,
        parallel_state: parallelState,
      };
    }

    const finalizationResult = parallelState.approved_topik
      ? await finalizeApprovedTopikSubmission(submission, parallelState, transaction)
      : await finalizeRejectedTopikSubmission(submission, parallelState, transaction);

    const refreshedSubmission = await loadSubmissionWithRiwayat(submissionId, {
      transaction,
    });

    if (!externalTransaction) await transaction.commit();

    return {
      success: true,
      changed: true,
      finalized: true,
      final_status: finalizationResult.final_status,
      winner: finalizationResult.winner || null,
      routed_to_ketua_cluster: Boolean(finalizationResult.routed_to_ketua_cluster),
      waiting_ketua_cluster: Boolean(finalizationResult.waiting_ketua_cluster),
      ketua_resolution: finalizationResult.ketua_resolution || null,
      submission: refreshedSubmission,
      parallel_state: evaluateTopikParallelState(refreshedSubmission),
    };
  } catch (error) {
    if (!externalTransaction) await transaction.rollback();
    throw error;
  }
}

async function finalizeTopikParallelSubmissionsByIds(submissionIds = []) {
  const uniqueIds = [...new Set((submissionIds || []).map((id) => toNumber(id)).filter(Boolean))];
  for (const id of uniqueIds) {
    await finalizeTopikParallelSubmission(id);
  }
}

module.exports = {
  TOPIK_PARALLEL_REVIEW_HOURS,
  TOPIK_PARALLEL_REVIEW_MS,
  isTopikParallelSubmission,
  buildTopikListFromSubmission,
  getTopikParallelReviewDeadline,
  evaluateTopikParallelState,
  ensureParallelReviewerRows,
  finalizeTopikParallelSubmission,
  finalizeTopikParallelSubmissionsByIds,
};
