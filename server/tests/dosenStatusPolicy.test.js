"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeContinueExistingSupervision,
  getDosenStatusDecision,
  evaluateNewAssignmentEligibility,
  canReceiveNewAssignment,
  evaluateDosenStatusFollowUp,
} = require("../services/dosenStatusPolicy");

const statusMatrix = [
  { status: "active", requestedContinue: false, account: true, login: true, receive: true, continue: true, replace: false },
  { status: "active", requestedContinue: true, account: false, login: false, receive: true, continue: true, replace: false },
  { status: "inactive", requestedContinue: true, account: true, login: true, receive: false, continue: true, replace: false },
  { status: "inactive", requestedContinue: false, account: false, login: false, receive: false, continue: false, replace: true },
  { status: "study_leave", requestedContinue: true, account: true, login: true, receive: false, continue: true, replace: false },
  { status: "study_leave", requestedContinue: false, account: true, login: true, receive: false, continue: false, replace: true },
  { status: "retired", requestedContinue: true, account: true, login: false, receive: false, continue: false, replace: true },
];

for (const scenario of statusMatrix) {
  test(`matriks status dosen: ${scenario.status}, akun=${scenario.account}, lanjut=${scenario.requestedContinue}`, () => {
    const decision = getDosenStatusDecision({
      statusKeaktifan: scenario.status,
      accountIsActive: scenario.account,
      continueExistingSupervision: scenario.requestedContinue,
    });
    assert.equal(decision.can_login, scenario.login);
    assert.equal(decision.can_receive_new_assignment, scenario.receive);
    assert.equal(decision.can_continue_existing_supervision, scenario.continue);
    assert.equal(decision.requires_supervisor_replacement, scenario.replace);
  });
}

test("server menormalisasi izin bimbingan lama berdasarkan status master", () => {
  assert.equal(normalizeContinueExistingSupervision("active", false), true);
  assert.equal(normalizeContinueExistingSupervision("retired", true), false);
  assert.equal(normalizeContinueExistingSupervision("inactive", true), true);
  assert.equal(normalizeContinueExistingSupervision("study_leave", false), false);
});

test("kelayakan penugasan baru mencakup status, konfigurasi, toggle, dan kuota", () => {
  assert.equal(canReceiveNewAssignment({
    statusKeaktifan: "active",
    configurationStatus: "ready",
    menerimaBimbinganBaru: true,
    remainingQuota: 2,
    requiredSlots: 2,
  }), true);
  assert.equal(canReceiveNewAssignment({
    statusKeaktifan: "study_leave",
    configurationStatus: "ready",
    menerimaBimbinganBaru: true,
    remainingQuota: 5,
  }), false);
  assert.equal(canReceiveNewAssignment({
    statusKeaktifan: "active",
    configurationStatus: "needs_review",
    menerimaBimbinganBaru: true,
    remainingQuota: 5,
  }), false);
  assert.equal(canReceiveNewAssignment({
    statusKeaktifan: "active",
    configurationStatus: "ready",
    menerimaBimbinganBaru: true,
    remainingQuota: 1,
    requiredSlots: 2,
  }), false);
});

test("policy memberikan reason code tunggal untuk keputusan penugasan", () => {
  assert.equal(evaluateNewAssignmentEligibility({
    statusKeaktifan: "inactive",
    configurationStatus: "ready",
    menerimaBimbinganBaru: true,
    remainingQuota: 5,
  }).reason, "master_status");
  assert.equal(evaluateNewAssignmentEligibility({
    statusKeaktifan: "active",
    configurationStatus: "needs_review",
    menerimaBimbinganBaru: true,
    remainingQuota: 5,
  }).reason, "configuration_not_ready");
  assert.equal(evaluateNewAssignmentEligibility({
    statusKeaktifan: "active",
    configurationStatus: "ready",
    menerimaBimbinganBaru: false,
    remainingQuota: 5,
  }).reason, "not_accepting_new_supervision");
  assert.equal(evaluateNewAssignmentEligibility({
    statusKeaktifan: "active",
    configurationStatus: "ready",
    menerimaBimbinganBaru: true,
    remainingQuota: 0,
  }).reason, "insufficient_quota");
});

test("reaktivasi saja bukan alasan membuat tindak lanjut", () => {
  const evaluation = evaluateDosenStatusFollowUp({
    statusLama: "study_leave",
    statusBaru: "active",
    continueExisting: true,
    impact: {},
  });
  assert.equal(evaluation.reactivation_required, true);
  assert.equal(evaluation.required, false);
  assert.deepEqual(evaluation.reasons, []);
});

test("izin lanjut mencegah penggantian mahasiswa tetapi tidak menutupi dampak operasional lain", () => {
  const evaluation = evaluateDosenStatusFollowUp({
    statusLama: "active",
    statusBaru: "study_leave",
    continueExisting: true,
    impact: {
      mahasiswa_bimbingan_aktif: 3,
      review_pending: 2,
      tugas_periode_aktif: 1,
      jadwal_sidang_mendatang: 1,
    },
  });
  assert.equal(evaluation.replacement_required, false);
  assert.equal(evaluation.review_transfer_required, true);
  assert.equal(evaluation.role_adjustment_required, true);
  assert.equal(evaluation.defense_adjustment_required, true);
  assert.equal(evaluation.required, true);
});

test("dampak nol menghasilkan tindak lanjut yang dapat ditutup", () => {
  const evaluation = evaluateDosenStatusFollowUp({
    statusLama: "active",
    statusBaru: "inactive",
    continueExisting: false,
    impact: {},
  });
  assert.equal(evaluation.required, false);
});
