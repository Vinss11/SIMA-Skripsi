"use strict";

const { Notifikasi } = require("../models");
const { NOTIFICATION_TYPES, NOTIFICATION_TITLES } = require("../constants/notificationTypes");

function memberDosenId(member) {
  return Number(member?.dosen_id || member?.dosen?.id || 0);
}

function memberOrder(member) {
  return Number(member?.urutan || 0);
}

async function createSystemNotification({
  recipientType,
  recipientId,
  type,
  message,
  referenceType = null,
  referenceId = null,
  actionKey = null,
  metadata = {},
  deduplicationKey,
  transaction,
}) {
  const title = NOTIFICATION_TITLES[type];
  if (!title) throw new Error(`Tipe notifikasi tidak dikenal: ${type}`);
  if (!recipientType || !Number.isInteger(Number(recipientId)) || Number(recipientId) <= 0) {
    throw new Error("Penerima notifikasi tidak valid.");
  }
  if (!deduplicationKey) throw new Error("Kunci deduplikasi notifikasi wajib tersedia.");

  const [notification] = await Notifikasi.findOrCreate({
    where: { deduplication_key: deduplicationKey },
    defaults: {
      recipient_type: recipientType,
      recipient_id: Number(recipientId),
      type,
      title,
      message,
      reference_type: referenceType,
      reference_id: referenceId,
      action_key: actionKey,
      metadata,
      read_at: null,
    },
    transaction,
  });
  return notification;
}

async function createSupervisorReplacementNotifications({
  assignmentId,
  mahasiswa,
  previousMembers = [],
  newMembers = [],
  effectiveDate,
  transaction,
}) {
  const previousById = new Map(previousMembers.map((item) => [memberDosenId(item), item]).filter(([id]) => id > 0));
  const newById = new Map(newMembers.map((item) => [memberDosenId(item), item]).filter(([id]) => id > 0));
  const oldIds = new Set(previousById.keys());
  const newIds = new Set(newById.keys());
  const addedIds = [...newIds].filter((id) => !oldIds.has(id));
  const removedIds = [...oldIds].filter((id) => !newIds.has(id));
  const reorderedIds = [...newIds].filter(
    (id) => oldIds.has(id) && memberOrder(previousById.get(id)) !== memberOrder(newById.get(id))
  );
  const effectiveLabel = String(effectiveDate || "").trim();
  const commonMetadata = {
    mahasiswa_id: mahasiswa.id,
    mahasiswa_nama: mahasiswa.nama,
    mahasiswa_nim: mahasiswa.nim,
    penetapan_pembimbing_id: assignmentId,
    effective_date: effectiveLabel,
  };

  const created = [];
  created.push(await createSystemNotification({
    recipientType: "mahasiswa",
    recipientId: mahasiswa.id,
    type: NOTIFICATION_TYPES.SUPERVISOR_REPLACED_STUDENT,
    message: `Pembimbing skripsi Anda telah diperbarui mulai ${effectiveLabel}. Progres bimbingan sebelumnya tetap tersimpan.`,
    referenceType: "penetapan_pembimbing",
    referenceId: assignmentId,
    actionKey: "student_supervisor_history",
    metadata: {
      ...commonMetadata,
      previous_supervisor_ids: [...oldIds],
      new_supervisor_ids: [...newIds],
    },
    deduplicationKey: `supervisor-replacement:${assignmentId}:mahasiswa:${mahasiswa.id}`,
    transaction,
  }));

  for (const dosenId of addedIds) {
    const order = memberOrder(newById.get(dosenId));
    created.push(await createSystemNotification({
      recipientType: "dosen",
      recipientId: dosenId,
      type: NOTIFICATION_TYPES.SUPERVISION_ASSIGNED_LECTURER,
      message: `Anda ditetapkan sebagai Pembimbing ${order} untuk ${mahasiswa.nama} (${mahasiswa.nim}) mulai ${effectiveLabel}.`,
      referenceType: "penetapan_pembimbing",
      referenceId: assignmentId,
      actionKey: "lecturer_supervised_student",
      metadata: { ...commonMetadata, supervisor_order: order },
      deduplicationKey: `supervisor-replacement:${assignmentId}:dosen:${dosenId}:assigned:${order}`,
      transaction,
    }));
  }

  for (const dosenId of removedIds) {
    created.push(await createSystemNotification({
      recipientType: "dosen",
      recipientId: dosenId,
      type: NOTIFICATION_TYPES.SUPERVISION_ENDED_LECTURER,
      message: `Penugasan Anda sebagai pembimbing ${mahasiswa.nama} (${mahasiswa.nim}) berakhir pada ${effectiveLabel}.`,
      referenceType: "penetapan_pembimbing",
      referenceId: assignmentId,
      actionKey: "lecturer_supervision_history",
      metadata: commonMetadata,
      deduplicationKey: `supervisor-replacement:${assignmentId}:dosen:${dosenId}:ended`,
      transaction,
    }));
  }

  for (const dosenId of reorderedIds) {
    const order = memberOrder(newById.get(dosenId));
    created.push(await createSystemNotification({
      recipientType: "dosen",
      recipientId: dosenId,
      type: NOTIFICATION_TYPES.SUPERVISION_UPDATED_LECTURER,
      message: `Urutan penugasan Anda untuk ${mahasiswa.nama} (${mahasiswa.nim}) diperbarui menjadi Pembimbing ${order} mulai ${effectiveLabel}.`,
      referenceType: "penetapan_pembimbing",
      referenceId: assignmentId,
      actionKey: "lecturer_supervised_student",
      metadata: { ...commonMetadata, supervisor_order: order },
      deduplicationKey: `supervisor-replacement:${assignmentId}:dosen:${dosenId}:updated:${order}`,
      transaction,
    }));
  }

  return {
    notifications: created,
    student: 1,
    assigned: addedIds.length,
    ended: removedIds.length,
    updated: reorderedIds.length,
  };
}

module.exports = { createSystemNotification, createSupervisorReplacementNotifications };
