const RESUBMISSION_NOTIFICATION_TYPES = new Set([
  "research_submission_rejected_student",
  "penjaluran_final_rejected_student",
]);

export function isPenjaluranResubmissionNotification(notification) {
  if (!notification) return false;
  if (notification.metadata?.can_resubmit === true) return true;
  if (RESUBMISSION_NOTIFICATION_TYPES.has(notification.type)) return true;
  return notification.type === "penjaluran_path_decided_student"
    && notification.metadata?.decision === "rejected";
}

export function getNotificationActionLabel(notification) {
  if (isPenjaluranResubmissionNotification(notification)) return "Ajukan Ulang";
  if (["student_submission_status", "student_path_status"].includes(notification?.action_key)) {
    return "Lihat Detail Pengajuan";
  }
  return "Buka Halaman Terkait";
}
