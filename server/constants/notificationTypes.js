"use strict";

const NOTIFICATION_TYPES = Object.freeze({
  SUPERVISOR_ASSIGNED_STUDENT: "supervisor_assigned_student",
  SUPERVISOR_EXTENDED_STUDENT: "supervisor_extended_student",
  SUPERVISOR_REPLACED_STUDENT: "supervisor_replaced_student",
  SUPERVISION_ASSIGNED_LECTURER: "supervision_assigned_lecturer",
  SUPERVISION_UPDATED_LECTURER: "supervision_updated_lecturer",
  SUPERVISION_ENDED_LECTURER: "supervision_ended_lecturer",
});

const NOTIFICATION_TITLES = Object.freeze({
  [NOTIFICATION_TYPES.SUPERVISOR_ASSIGNED_STUDENT]: "Pembimbing Skripsi Ditetapkan",
  [NOTIFICATION_TYPES.SUPERVISOR_EXTENDED_STUDENT]: "Penetapan Pembimbing Diperpanjang",
  [NOTIFICATION_TYPES.SUPERVISOR_REPLACED_STUDENT]: "Pembimbing Skripsi Diperbarui",
  [NOTIFICATION_TYPES.SUPERVISION_ASSIGNED_LECTURER]: "Mahasiswa Bimbingan Baru",
  [NOTIFICATION_TYPES.SUPERVISION_UPDATED_LECTURER]: "Penugasan Pembimbing Diperbarui",
  [NOTIFICATION_TYPES.SUPERVISION_ENDED_LECTURER]: "Penugasan Pembimbing Berakhir",
});

module.exports = { NOTIFICATION_TYPES, NOTIFICATION_TITLES };
