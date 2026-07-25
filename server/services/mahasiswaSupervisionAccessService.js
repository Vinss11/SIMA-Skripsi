"use strict";

const {
  Mahasiswa,
  Dosen,
} = require("../models");
const { canContinueExistingSupervision } = require("./dosenStatusService");
const { getActiveSupervisorAssignment } = require("./penetapanPembimbingService");

const REPLACEMENT_PENDING_CODE = "SUPERVISOR_REPLACEMENT_PENDING";
const REPLACEMENT_PENDING_MESSAGE =
  "Pembimbing Anda sedang tidak dapat melanjutkan bimbingan. Penggantian pembimbing sedang diproses oleh Sekretaris Prodi.";

function serializeSupervisor(dosen) {
  if (!dosen) return null;
  return {
    id: dosen.id,
    kode_dosen: dosen.kode_dosen || null,
    nik: dosen.nik || null,
    nama: dosen.nama,
    gelar: dosen.gelar || null,
    email: dosen.email || null,
    status_keaktifan: dosen.status_keaktifan || null,
    continue_existing_supervision: dosen.continue_existing_supervision === true,
    can_continue_existing_supervision: canContinueExistingSupervision(dosen),
  };
}

async function getMahasiswaSupervisionAccess(mahasiswaId, transaction = null) {
  const [mahasiswa, activeAssignment] = await Promise.all([
    Mahasiswa.findByPk(mahasiswaId, {
    attributes: ["id", "status_jalur_saat_ini", "dosen_pembimbing_skripsi_id"],
    include: [{
      model: Dosen,
      as: "dosenPembimbingSkripsi",
      attributes: [
        "id", "kode_dosen", "nik", "nama", "gelar", "email",
        "status_keaktifan", "continue_existing_supervision",
      ],
    }],
    transaction,
    }),
    getActiveSupervisorAssignment(mahasiswaId, transaction),
  ]);

  if (!mahasiswa) {
    return {
      status: "not_assigned",
      can_create_guidance: false,
      can_submit_resume: false,
      can_upload_document: false,
      can_register_defense: false,
      current_supervisor: null,
      replacement: null,
      reason: "Data mahasiswa tidak ditemukan.",
    };
  }

  const currentSupervisor = activeAssignment.pembimbing_1 || mahasiswa.dosenPembimbingSkripsi || null;
  const currentSupervisors = [
    activeAssignment.pembimbing_1
      ? { ...serializeSupervisor(activeAssignment.pembimbing_1), urutan: 1, peran: "utama" }
      : null,
    activeAssignment.pembimbing_2
      ? { ...serializeSupervisor(activeAssignment.pembimbing_2), urutan: 2, peran: "pendamping" }
      : null,
  ].filter(Boolean);
  if (currentSupervisors.length === 0 && currentSupervisor) {
    currentSupervisors.push({ ...serializeSupervisor(currentSupervisor), urutan: 1, peran: "utama" });
  }
  if (String(mahasiswa.status_jalur_saat_ini || "").toLowerCase() === "selesai") {
    return {
      status: "completed",
      can_create_guidance: false,
      can_submit_resume: false,
      can_upload_document: false,
      can_register_defense: false,
      current_supervisor: serializeSupervisor(currentSupervisor),
      current_supervisors: currentSupervisors,
      replacement: null,
      reason: "Proses skripsi telah selesai.",
    };
  }

  if (!currentSupervisor) {
    return {
      status: "not_assigned",
      can_create_guidance: false,
      can_submit_resume: false,
      can_upload_document: false,
      can_register_defense: false,
      current_supervisor: null,
      current_supervisors: [],
      replacement: null,
      reason: "Dosen pembimbing skripsi belum ditetapkan.",
    };
  }

  if (canContinueExistingSupervision(currentSupervisor)) {
    return {
      status: "active",
      can_create_guidance: true,
      can_submit_resume: true,
      can_upload_document: true,
      can_register_defense: true,
      current_supervisor: serializeSupervisor(currentSupervisor),
      current_supervisors: currentSupervisors,
      replacement: null,
      reason: null,
    };
  }

  return {
    status: "replacement_pending",
    code: REPLACEMENT_PENDING_CODE,
    can_create_guidance: false,
    can_submit_resume: false,
    can_upload_document: false,
    can_register_defense: false,
    current_supervisor: serializeSupervisor(currentSupervisor),
    current_supervisors: currentSupervisors,
    replacement: { status: "awaiting_selection" },
    reason: REPLACEMENT_PENDING_MESSAGE,
  };
}

function sendSupervisionAccessDenied(res, access, capability) {
  const isReplacementPending = access?.status === "replacement_pending";
  return res.status(409).json({
    success: false,
    code: isReplacementPending ? REPLACEMENT_PENDING_CODE : "SUPERVISION_NOT_AVAILABLE",
    message: access?.reason || "Proses ini belum dapat dilanjutkan karena pembimbing belum tersedia.",
    detail: { capability, supervision_access: access },
  });
}

module.exports = {
  REPLACEMENT_PENDING_CODE,
  REPLACEMENT_PENDING_MESSAGE,
  getMahasiswaSupervisionAccess,
  sendSupervisionAccessDenied,
};
