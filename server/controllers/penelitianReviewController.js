"use strict";

const { Op } = require("sequelize");
const {
  Pengajuan,
  Mahasiswa,
  Dosen,
  Topik,
  RiwayatPersetujuan,
  sequelize,
} = require("../models");
const {
  buildTopikListFromSubmission,
  ensureParallelReviewerRows,
  evaluateTopikParallelState,
  finalizeTopikParallelSubmission,
  syncPendingReviewReminders,
} = require("../services/topikParallelReviewService");

const REVIEW_ATTRIBUTES = [
  "id",
  "dosen_id",
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

function slotFields(slot) {
  return {
    kode: `topik_${slot}_kode`,
    judul: `topik_${slot}_judul`,
    dosenId: `dosen_pilihan_${slot}`,
    dosenNama: `dosen_${slot}_nama`,
  };
}

async function loadSubmission(id, transaction, lock = false) {
  return Pengajuan.findByPk(id, {
    include: [
      {
        model: Mahasiswa,
        as: "mahasiswa",
        attributes: ["id", "nim", "nama", "email", "angkatan"],
      },
      {
        model: RiwayatPersetujuan,
        as: "riwayat",
        attributes: REVIEW_ATTRIBUTES,
        include: [{ model: Dosen, as: "dosen", attributes: ["id", "nik", "nama", "email"] }],
        required: false,
      },
    ],
    transaction,
    ...(lock ? { lock: transaction.LOCK.UPDATE } : {}),
  });
}

function serializePendingSubmission(submission) {
  const state = evaluateTopikParallelState(submission);
  return {
    id: submission.id,
    mahasiswa: submission.mahasiswa,
    jenis_jalur: submission.jenis_jalur,
    status: submission.status,
    diajukan_pada: submission.createdAt,
    usia_hari: Math.max(0, Math.floor((Date.now() - new Date(submission.createdAt).getTime()) / 86400000)),
    slots: state.slot_decisions.map((item) => ({
      slot: item.slot,
      kode: item.kode,
      judul: item.judul,
      dosen_id: item.dosen_id,
      dosen_nama: item.dosen_nama,
      reviewer_status: item.reviewer_status,
      reviewer_note: item.reviewer_note,
      reviewer_decided_at: item.reviewer_decided_at,
      reminder_count: Number(item.reminder_count || 0),
      last_reminded_at: item.last_reminded_at || null,
    })),
    pending_count: state.pending_count,
    approved_count: state.approved_slots.length,
    rejected_count: state.rejected_slots.length,
  };
}

exports.getPendingResearchReviews = async (req, res) => {
  try {
    let submissions = await Pengajuan.findAll({
      where: { tipe_pengajuan: "topik_dosen", status: "pending" },
      include: [
        {
          model: Mahasiswa,
          as: "mahasiswa",
          attributes: ["id", "nim", "nama", "email", "angkatan"],
        },
        {
          model: RiwayatPersetujuan,
          as: "riwayat",
          attributes: REVIEW_ATTRIBUTES,
          required: false,
        },
      ],
      order: [["createdAt", "ASC"]],
    });

    for (const submission of submissions) {
      await ensureParallelReviewerRows(submission);
    }
    await syncPendingReviewReminders(submissions.map((item) => item.id));

    submissions = await Pengajuan.findAll({
      where: { tipe_pengajuan: "topik_dosen", status: "pending" },
      include: [
        {
          model: Mahasiswa,
          as: "mahasiswa",
          attributes: ["id", "nim", "nama", "email", "angkatan"],
        },
        {
          model: RiwayatPersetujuan,
          as: "riwayat",
          attributes: REVIEW_ATTRIBUTES,
          required: false,
        },
      ],
      order: [["createdAt", "ASC"]],
    });

    const data = submissions
      .map(serializePendingSubmission)
      .filter((item) => item.pending_count > 0);
    const activeCodes = new Set(
      submissions.flatMap((item) => buildTopikListFromSubmission(item).map((topik) => topik.kode))
    );
    const replacementTopics = await Topik.findAll({
      where: {
        status: "available",
        kode: { [Op.notIn]: [...activeCodes] },
      },
      attributes: ["id", "kode", "judul", "cluster", "dosen_id", "status"],
      include: [{ model: Dosen, as: "dosen", attributes: ["id", "nik", "nama"] }],
      order: [["kode", "ASC"]],
    });

    return res.json({
      success: true,
      data: {
        items: data,
        total: data.length,
        replacement_topics: replacementTopics,
      },
    });
  } catch (error) {
    console.error("Error di getPendingResearchReviews:", error);
    return res.status(500).json({ success: false, message: "Terjadi kesalahan pada server", error: error.message });
  }
};

exports.remindPendingResearchReviewer = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const submissionId = Number(req.params.id);
    const slot = Number(req.params.slot);
    const row = await RiwayatPersetujuan.findOne({
      where: {
        pengajuan_id: submissionId,
        topik_slot: slot,
        tipe_approval: "calon_pembimbing",
        status: "pending",
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!row) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: "Review pending tidak ditemukan." });
    }

    await row.update(
      {
        reminder_count: Number(row.reminder_count || 0) + 1,
        last_reminded_at: new Date(),
      },
      { transaction }
    );
    await transaction.commit();
    return res.json({ success: true, message: "Pengingat review berhasil dikirim.", data: row });
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    console.error("Error di remindPendingResearchReviewer:", error);
    return res.status(500).json({ success: false, message: "Terjadi kesalahan pada server", error: error.message });
  }
};

exports.replacePendingResearchReviewer = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const submissionId = Number(req.params.id);
    const slot = Number(req.params.slot);
    const replacementCode = String(req.body?.topik_kode || "").trim().toUpperCase();
    if (!submissionId || ![1, 2, 3].includes(slot) || !replacementCode) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: "Pengajuan, slot, dan topik pengganti wajib valid." });
    }

    const submission = await loadSubmission(submissionId, transaction, true);
    if (!submission || submission.status !== "pending" || submission.tipe_pengajuan !== "topik_dosen") {
      await transaction.rollback();
      return res.status(409).json({ success: false, message: "Pengajuan tidak berada pada tahap review topik." });
    }
    await ensureParallelReviewerRows(submission, transaction);

    const reviewerRow = await RiwayatPersetujuan.findOne({
      where: {
        pengajuan_id: submissionId,
        topik_slot: slot,
        tipe_approval: "calon_pembimbing",
        status: "pending",
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!reviewerRow) {
      await transaction.rollback();
      return res.status(409).json({ success: false, message: "Hanya reviewer yang masih pending yang dapat diganti." });
    }

    const replacement = await Topik.findOne({
      where: { kode: replacementCode, status: "available" },
      include: [{ model: Dosen, as: "dosen", attributes: ["id", "nama", "nik"] }],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!replacement?.dosen_id) {
      await transaction.rollback();
      return res.status(409).json({ success: false, message: "Topik pengganti tidak tersedia atau belum memiliki dosen." });
    }
    const otherCodes = buildTopikListFromSubmission(submission)
      .filter((item) => Number(item.slot) !== slot)
      .map((item) => String(item.kode).toUpperCase());
    if (otherCodes.includes(replacementCode)) {
      await transaction.rollback();
      return res.status(409).json({ success: false, message: "Topik pengganti sudah digunakan pada pilihan lain." });
    }

    const fields = slotFields(slot);
    const oldCode = submission[fields.kode];
    if (oldCode) {
      await Topik.update(
        { status: "available" },
        { where: { kode: oldCode, status: "reserved" }, transaction }
      );
    }
    await replacement.update({ status: "reserved" }, { transaction });
    await submission.update(
      {
        [fields.kode]: replacement.kode,
        [fields.judul]: replacement.judul,
        [fields.dosenId]: replacement.dosen_id,
        [fields.dosenNama]: replacement.dosen?.nama || null,
      },
      { transaction }
    );
    await reviewerRow.update(
      {
        dosen_id: replacement.dosen_id,
        topik_kode: replacement.kode,
        keterangan: `Reviewer diganti Sekprodi ke topik ${replacement.kode}. Menunggu keputusan dosen.`,
        reminder_count: 0,
        last_reminded_at: null,
        tanggal_keputusan: new Date(),
      },
      { transaction }
    );

    await transaction.commit();
    return res.json({ success: true, message: "Topik dan reviewer berhasil diganti." });
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    console.error("Error di replacePendingResearchReviewer:", error);
    return res.status(500).json({ success: false, message: "Terjadi kesalahan pada server", error: error.message });
  }
};

exports.cancelPendingResearchTopic = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const submissionId = Number(req.params.id);
    const slot = Number(req.params.slot);
    const submission = await loadSubmission(submissionId, transaction, true);
    if (!submission || submission.status !== "pending" || submission.tipe_pengajuan !== "topik_dosen") {
      await transaction.rollback();
      return res.status(409).json({ success: false, message: "Pengajuan tidak berada pada tahap review topik." });
    }
    await ensureParallelReviewerRows(submission, transaction);
    const reviewerRow = await RiwayatPersetujuan.findOne({
      where: {
        pengajuan_id: submissionId,
        topik_slot: slot,
        tipe_approval: "calon_pembimbing",
        status: "pending",
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!reviewerRow) {
      await transaction.rollback();
      return res.status(409).json({ success: false, message: "Hanya pilihan yang masih pending yang dapat dibatalkan." });
    }

    const currentTopics = buildTopikListFromSubmission(submission);
    const canceled = currentTopics.find((item) => Number(item.slot) === slot);
    const remaining = currentTopics.filter((item) => Number(item.slot) !== slot);
    if (canceled?.kode) {
      await Topik.update(
        { status: "available" },
        { where: { kode: canceled.kode, status: "reserved" }, transaction }
      );
    }
    await reviewerRow.destroy({ transaction });

    for (let index = 1; index <= 3; index += 1) {
      const fields = slotFields(index);
      const next = remaining[index - 1] || null;
      submission[fields.kode] = next?.kode || null;
      submission[fields.judul] = next?.judul || null;
      submission[fields.dosenId] = next?.dosen_id || null;
      submission[fields.dosenNama] = next?.dosen_nama || null;
    }
    await submission.save({ transaction });

    for (const item of remaining) {
      const newSlot = remaining.findIndex((candidate) => candidate.kode === item.kode) + 1;
      if (Number(item.slot) !== newSlot) {
        await RiwayatPersetujuan.update(
          { topik_slot: newSlot },
          {
            where: {
              pengajuan_id: submissionId,
              tipe_approval: "calon_pembimbing",
              topik_slot: item.slot,
            },
            transaction,
          }
        );
      }
    }

    if (remaining.length === 0) {
      await submission.update(
        {
          status: "rejected",
          dosen_saat_ini: null,
          alasan_penolakan: "Seluruh pilihan topik dibatalkan oleh Sekprodi.",
        },
        { transaction }
      );
      const mahasiswa = await Mahasiswa.findByPk(submission.mahasiswa_id, { transaction, lock: transaction.LOCK.UPDATE });
      if (mahasiswa && Number(mahasiswa.pengajuan_aktif_id) === submissionId) {
        await mahasiswa.update({ pengajuan_aktif_id: null, status_jalur_saat_ini: "belum_mengajukan" }, { transaction });
      }
    } else {
      await finalizeTopikParallelSubmission(submissionId, { transaction });
    }

    await transaction.commit();
    return res.json({ success: true, message: "Pilihan topik berhasil dibatalkan." });
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    console.error("Error di cancelPendingResearchTopic:", error);
    return res.status(500).json({ success: false, message: "Terjadi kesalahan pada server", error: error.message });
  }
};
