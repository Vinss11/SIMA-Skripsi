"use strict";

const {
  Mahasiswa,
  PendaftaranPenjaluran,
  PamitUlang,
} = require("../models");
const { createSystemNotification } = require("./notificationService");
const { NOTIFICATION_TYPES } = require("../constants/notificationTypes");

function getRejectedResearchFallbackStatus(submission) {
  const jenisJalur = String(submission?.jenis_jalur || "").trim().toLowerCase();
  if (jenisJalur === "ulang") return "ulang";
  if (jenisJalur === "ekstensi") return "ekstensi";
  return "belum_mengajukan";
}

async function recoverRejectedResearchSubmission({
  submission,
  transaction,
  reason,
  actorLabel = "Reviewer",
  notificationType = NOTIFICATION_TYPES.RESEARCH_SUBMISSION_REJECTED_STUDENT,
  notificationActionKey = "student_submission_status",
  notificationReferenceType = "pengajuan",
}) {
  if (!submission?.id || !submission?.mahasiswa_id) {
    throw new Error("Pengajuan penelitian tidak valid untuk dipulihkan setelah penolakan.");
  }

  const mahasiswa = await Mahasiswa.findByPk(submission.mahasiswa_id, {
    transaction,
    lock: transaction?.LOCK?.UPDATE,
  });

  if (mahasiswa && Number(mahasiswa.pengajuan_aktif_id) === Number(submission.id)) {
    await mahasiswa.update(
      {
        pengajuan_aktif_id: null,
        status_jalur_saat_ini: getRejectedResearchFallbackStatus(submission),
      },
      { transaction }
    );
  }

  if (submission.pendaftaran_penjaluran_id) {
    await PendaftaranPenjaluran.update(
      {
        form_lanjutan_status: "draft",
        form_lanjutan_submitted_at: null,
      },
      {
        where: { id: submission.pendaftaran_penjaluran_id },
        transaction,
      }
    );
  }

  if (submission.pamit_ulang_id) {
    await PamitUlang.update(
      { pengajuan_baru_id: null },
      {
        where: {
          id: submission.pamit_ulang_id,
          pengajuan_baru_id: submission.id,
        },
        transaction,
      }
    );
  }

  if (mahasiswa) {
    const rejectionReason = String(reason || submission.alasan_penolakan || "-").trim();
    await createSystemNotification({
      recipientType: "mahasiswa",
      recipientId: mahasiswa.id,
      type: notificationType,
      message: `${actorLabel} menolak pengajuan penelitian Anda. Alasan: ${rejectionReason}.`,
      referenceType: notificationReferenceType,
      referenceId: submission.id,
      actionKey: notificationActionKey,
      metadata: {
        tipe_pengajuan: submission.tipe_pengajuan,
        judul_penelitian: submission.judul_mandiri || submission.topik_1_judul || null,
        alasan_penolakan: rejectionReason,
        can_resubmit: true,
      },
      deduplicationKey: `research-submission-rejected:${submission.id}:student:${mahasiswa.id}`,
      transaction,
    });
  }

  return { mahasiswa };
}

module.exports = {
  getRejectedResearchFallbackStatus,
  recoverRejectedResearchSubmission,
};
