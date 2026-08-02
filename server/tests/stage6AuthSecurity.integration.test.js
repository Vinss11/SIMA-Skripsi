"use strict";

process.env.NODE_ENV = "test";
require("dotenv").config();
process.env.AUTH_RECOVERY_ENABLED = "true";
process.env.AUTH_DELIVERY_KEY = "9e20f0942d7ee7e47c194a0705470e2f3edec22c126da7d481543e030ec1b6ba";
process.env.AUTH_FRONTEND_ORIGIN = "http://localhost:3001";

const test = require("node:test"); const assert = require("node:assert/strict"); const bcrypt = require("bcrypt"); const { Op } = require("sequelize");
const fs = require("fs"); const os = require("os"); const path = require("path"); const XLSX = require("xlsx");
const db = require("../models"); const authController = require("../controllers/authController"); const adminController = require("../controllers/adminController"); const uploadController = require("../controllers/uploadController"); const middleware = require("../middlewares/authMiddleware");
const recovery = require("../services/passwordRecoveryService"); const passwordPolicy = require("../services/passwordPolicy");
const accountSecurityRepository = require("../services/accountSecurityRepository");
const authOutboxWorker = require("../scripts/process-auth-outbox");
const stage6Reconciliation = require("../scripts/reconcile-stage6-auth-security");
const { ALLOWED_SEKRETARIS_JABATAN } = require("../constants/sekretarisAkses");

function request(body = {}, token = null) { return { body, params: {}, ip: "127.0.0.99", socket: {}, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), "user-agent": "stage6-test" } }; }
async function invoke(handler, req) { const result = { statusCode: 200, payload: null }; const res = { status(code) { result.statusCode = code; return this; }, json(payload) { result.payload = payload; return payload; } }; await handler(req, res); return result; }
async function authenticate(handler, token) { const req = request({}, token); const result = { statusCode: 200, payload: null, next: false };
  const res = { status(code) { result.statusCode = code; return this; }, json(payload) { result.payload = payload; return payload; } };
  await handler(req, res, () => { result.next = true; }); return { ...result, req }; }

test("Tahap 6: kebijakan password mempertahankan spasi dan batas bcrypt", () => {
  assert.equal(passwordPolicy.validateNewPassword(" panjang aman ").valid, true);
  assert.equal(passwordPolicy.validateNewPassword("short").reasons.includes("PASSWORD_TOO_SHORT"), true);
  assert.equal(passwordPolicy.validateNewPassword("x".repeat(73)).reasons.includes("PASSWORD_TOO_LONG"), true);
  assert.equal(passwordPolicy.validateNewPassword("Mahasiswa123!", { identifiers: ["mahasiswa"] }).reasons.includes("PASSWORD_CONTAINS_IDENTIFIER"), true);
});

test("Tahap 6: akun dosen baru memperoleh aktivasi dan dapat login setelah mengonsumsinya", async (t) => {
  const suffix = String(Date.now()).slice(-7);
  const actor = await db.Admin.create({
    nip: `A${suffix}`,
    nama: "Admin Provisioning 6",
    email: `admin-provision-${suffix}@test.local`,
    password: await bcrypt.hash("Admin provision secure! 83", 10),
    role: "staff",
    is_default_password: false,
    credential_state: "active",
    credential_version: 1,
    password_origin: "test",
  }, { hooks: false });
  const klaster = await db.Klaster.create({ kode: `K6${suffix}`, nama: `Klaster Provisioning ${suffix}` });
  let dosenId = null;
  let mahasiswaId = null;
  let sekretarisAliasId = null;
  const uploadPath = path.join(os.tmpdir(), `stage6-mahasiswa-${suffix}.xlsx`);

  t.after(async () => {
    if (fs.existsSync(uploadPath)) fs.unlinkSync(uploadPath);
    if (mahasiswaId) {
      const resetRecords = await db.PasswordResetToken.findAll({ where: { account_type: "mahasiswa", account_id: mahasiswaId }, attributes: ["id"] });
      const resetIds = resetRecords.map((item) => item.id);
      if (resetIds.length) await db.AuthOutbox.destroy({ where: { reset_token_id: { [Op.in]: resetIds } }, force: true });
      await db.PasswordResetToken.destroy({ where: { id: { [Op.in]: resetIds } }, force: true });
      await db.AuthSession.destroy({ where: { account_type: "mahasiswa", account_id: mahasiswaId }, force: true });
      await db.AuthSecurityEvent.destroy({ where: { [Op.or]: [{ target_type: "mahasiswa", target_id: mahasiswaId }, { actor_type: "mahasiswa", actor_id: mahasiswaId }] }, force: true });
      await db.Mahasiswa.destroy({ where: { id: mahasiswaId }, force: true });
    }
    if (sekretarisAliasId) await db.SekretarisProdi.destroy({ where: { id: sekretarisAliasId }, force: true });
    if (dosenId) {
      const resetRecords = await db.PasswordResetToken.findAll({ where: { account_type: "dosen", account_id: dosenId }, attributes: ["id"] });
      const resetIds = resetRecords.map((item) => item.id);
      if (resetIds.length) await db.AuthOutbox.destroy({ where: { reset_token_id: { [Op.in]: resetIds } }, force: true });
      await db.PasswordResetToken.destroy({ where: { id: { [Op.in]: resetIds } }, force: true });
      await db.AuthSession.destroy({ where: { account_type: "dosen", account_id: dosenId }, force: true });
      await db.AuthSecurityEvent.destroy({ where: { [Op.or]: [{ target_type: "dosen", target_id: dosenId }, { actor_type: "dosen", actor_id: dosenId }] }, force: true });
      await db.RiwayatKetersediaanMembimbing.destroy({ where: { dosen_id: dosenId }, force: true });
      await db.DosenKetersediaanPeriode.destroy({ where: { dosen_id: dosenId }, force: true });
      await db.Dosen.destroy({ where: { id: dosenId }, force: true });
    }
    await db.AuthSecurityEvent.destroy({ where: { actor_id: actor.id, actor_type: "admin" }, force: true });
    await db.Admin.destroy({ where: { id: actor.id }, force: true });
    await db.Klaster.destroy({ where: { id: klaster.id }, force: true });
  });

  const created = await invoke(adminController.createDosen, {
    ...request({
      nik: suffix.slice(0, 9),
      nama: "Dosen Provisioning Tahap Enam",
      gelar: "M.Kom.",
      email: `dosen-provision-${suffix}@test.local`,
      jabatan_struktural: null,
      kuota_bimbingan: 5,
      status_keaktifan: "active",
      klaster_ids: [klaster.id],
    }),
    user: { id: actor.id, role: "admin" },
  });
  assert.equal(created.statusCode, 201);
  dosenId = created.payload.data.id;
  assert.equal(created.payload.data.credential_state, "default");
  assert.equal(created.payload.data.recovery_email_verified_at, null);

  const activation = await db.PasswordResetToken.findOne({ where: { account_type: "dosen", account_id: dosenId, purpose: "admin_activation" } });
  assert.ok(activation);
  const outbox = await db.AuthOutbox.findOne({ where: { reset_token_id: activation.id, status: "pending" } });
  assert.ok(outbox);
  assert.equal((await invoke(authController.login, request({ username: created.payload.data.kode_dosen, password: "password-tidak-dikenal" }))).statusCode, 401);

  await outbox.update({ status: "processing", available_at: new Date("2000-01-01T00:00:00.000Z"),
    claimed_at: new Date(Date.now() - 10 * 60 * 1000), attempt_count: 1 });
  const reclaimed = await authOutboxWorker.claimOne();
  assert.equal(reclaimed.id, outbox.id);
  assert.equal(reclaimed.attempt_count, 2);

  const activationPassword = "Activated account secure! 94";
  await recovery.confirmReset(recovery.decrypt(outbox), activationPassword);
  const activated = await db.Dosen.findByPk(dosenId);
  assert.equal(activated.credential_state, "active");
  assert.equal(activated.is_default_password, false);
  assert.ok(activated.recovery_email_verified_at instanceof Date);
  assert.equal(activated.recovery_email_verification_source, "activation_link_consumed");
  const login = await invoke(authController.login, request({ username: activated.kode_dosen, password: activationPassword }));
  assert.equal(login.statusCode, 200);
  assert.equal(login.payload.data.next_action, null);

  const aliasJabatan = ALLOWED_SEKRETARIS_JABATAN[0].replace("International", "Internasional");
  await activated.update({ jabatan_struktural: aliasJabatan }, { hooks: false });
  const sekretarisAlias = await db.SekretarisProdi.create({ nik: activated.nik, nama: activated.nama, email: activated.email,
    password: activated.password, is_default_password: false, credential_state: "active", credential_version: activated.credential_version,
    password_origin: "identity_alias_test", jabatan: aliasJabatan }, { hooks: false });
  sekretarisAliasId = sekretarisAlias.id;
  const aliasLogin = await invoke(authController.login, request({ username: activated.email, password: activationPassword }));
  assert.equal(aliasLogin.statusCode, 200);
  assert.equal(aliasLogin.payload.data.user.role, "dosen");
  assert.deepEqual(aliasLogin.payload.data.user.capabilities, ["sekretaris_prodi"]);
  assert.equal(aliasLogin.payload.data.user.sekretaris_prodi_id, sekretarisAlias.id);
  const aliasAuth = await authenticate(middleware.authenticateToken, aliasLogin.payload.data.token);
  assert.equal(aliasAuth.next, true);
  assert.equal(aliasAuth.req.user.sekretaris_prodi_id, sekretarisAlias.id);
  assert.ok(await db.AuthSecurityEvent.findOne({ where: { event_type: "auth.identity_resolution", reason_code: "IDENTITY_ALIAS_RESOLVED",
    target_type: "dosen", target_id: activated.id } }));
  const aliasFindings = await stage6Reconciliation.findLoginIdentifierCollisions();
  assert.ok(aliasFindings.some((finding) => finding.classification === "valid_identity_alias"
    && finding.account_types.join(",") === "dosen,sekretaris_prodi" && finding.count >= 1));

  await sekretarisAlias.update({ jabatan: ALLOWED_SEKRETARIS_JABATAN[1] }, { hooks: false });
  const mismatchedProgram = await accountSecurityRepository.resolveAccountByLoginIdentifier(activated.email).catch((error) => error);
  assert.equal(mismatchedProgram.code, "IDENTIFIER_AMBIGUOUS");
  await sekretarisAlias.update({ jabatan: aliasJabatan }, { hooks: false });

  const forcedPassword = "Alias temporary secure! 62";
  await activated.update({ password: await bcrypt.hash(forcedPassword, 10), credential_state: "default", is_default_password: true,
    credential_version: Number(activated.credential_version) + 1, force_change_reason: "alias_test" }, { hooks: false });
  const forcedAliasLogin = await invoke(authController.login, request({ username: activated.email, password: forcedPassword }));
  assert.equal(forcedAliasLogin.statusCode, 200);
  assert.equal(forcedAliasLogin.payload.data.next_action, "change_password");
  const forcedAliasAuth = await authenticate(middleware.authenticateRestrictedAllowed, forcedAliasLogin.payload.data.token);
  assert.equal(forcedAliasAuth.next, true);
  assert.equal(forcedAliasAuth.req.user.sekretaris_prodi_id, sekretarisAlias.id);
  const aliasPasswordChanged = await invoke(authController.changePassword, { ...forcedAliasAuth.req,
    body: { current_password: forcedPassword, new_password: "Alias changed secure! 73" } });
  assert.equal(aliasPasswordChanged.statusCode, 200);
  const changedAliasAuth = await authenticate(middleware.authenticateToken, aliasPasswordChanged.payload.data.token);
  assert.equal(changedAliasAuth.next, true);
  assert.equal(changedAliasAuth.req.user.sekretaris_prodi_id, sekretarisAlias.id);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{
    NIM: `26${suffix.slice(-6)}`,
    Nama: "Mahasiswa Provisioning Tahap Enam",
    Email: `mahasiswa-provision-${suffix}@test.local`,
    Angkatan: "2026",
    "NIK DPA": activated.nik,
  }]), "Mahasiswa");
  XLSX.writeFile(workbook, uploadPath);
  const imported = await invoke(uploadController.uploadMahasiswa, {
    ...request(),
    file: { path: uploadPath },
    user: { id: actor.id, role: "admin" },
  });
  assert.equal(imported.statusCode, 201);
  mahasiswaId = imported.payload.data.detail_berhasil[0].mahasiswa_id;
  const studentActivation = await db.PasswordResetToken.findOne({ where: { account_type: "mahasiswa", account_id: mahasiswaId, purpose: "admin_activation" } });
  const studentOutbox = await db.AuthOutbox.findOne({ where: { reset_token_id: studentActivation.id, status: "pending" } });
  assert.ok(studentOutbox);
  await recovery.confirmReset(recovery.decrypt(studentOutbox), "Imported account secure! 95");
  const importedLogin = await invoke(authController.login, request({ username: imported.payload.data.detail_berhasil[0].nim, password: "Imported account secure! 95" }));
  assert.equal(importedLogin.statusCode, 200);

  const sourceFindings = stage6Reconciliation.scanRuntimeSources();
  assert.equal(sourceFindings.some((finding) => finding.type === "literal_known_default"), false);
});

test("Tahap 6: forced gate, live session, revocation, dan reset link atomik", async (t) => {
  const suffix = String(Date.now()).slice(-7); const password = "Initial Secure! 45"; const hash = await bcrypt.hash(password, 10); const ids = {};
  const common = { password: hash, is_default_password: false, credential_state: "active", credential_version: 1, password_origin: "migration",
    recovery_email_verified_at: new Date(), recovery_email_verification_source: "official_academic_system" };
  const student = await db.Mahasiswa.create({ nim: `A6${suffix}`, nama: "Mahasiswa Auth 6", email: `s6-${suffix}@test.local`, ...common,
    is_default_password: true, credential_state: "default", force_change_reason: "legacy_default" }, { hooks: false }); ids.mahasiswa = student.id;
  const dosen = await db.Dosen.create({ kode_dosen: `D6${suffix}`, nik: suffix.slice(0, 9), nama: "Dosen Auth 6", email: `d6-${suffix}@test.local`, ...common,
    status_keaktifan: "active", account_is_active: true, continue_existing_supervision: true }, { hooks: false }); ids.dosen = dosen.id;
  const admin = await db.Admin.create({ nip: `P6${suffix}`, nama: "Admin Auth 6", email: `a6-${suffix}@test.local`, role: "staff", ...common }, { hooks: false }); ids.admin = admin.id;
  const sekretaris = await db.SekretarisProdi.create({ nik: `6${suffix}`.slice(0, 9), nama: "Sekretaris Auth 6", email: `k6-${suffix}@test.local`,
    jabatan: ALLOWED_SEKRETARIS_JABATAN[0], ...common }, { hooks: false }); ids.sekretaris_prodi = sekretaris.id;

  t.after(async () => {
    const resetRecords = await db.PasswordResetToken.findAll({ where: { [Op.or]: Object.entries(ids).map(([account_type, account_id]) => ({ account_type, account_id })) }, attributes: ["id"] });
    const resetIds = resetRecords.map(item => item.id);
    if (resetIds.length) await db.AuthOutbox.destroy({ where: { reset_token_id: { [Op.in]: resetIds } }, force: true });
    await db.PasswordResetToken.destroy({ where: { id: { [Op.in]: resetIds } }, force: true });
    await db.AuthSession.destroy({ where: { [Op.or]: Object.entries(ids).map(([account_type, account_id]) => ({ account_type, account_id })) }, force: true });
    await db.AuthSecurityEvent.destroy({ where: { [Op.or]: Object.entries(ids).flatMap(([type, id]) => [{ actor_type: type, actor_id: id }, { target_type: type, target_id: id }]) }, force: true });
    await db.AuthRateLimitBucket.destroy({ where: { scope: { [Op.in]: ["login_ip", "login_identifier", "forgot_ip", "forgot_identifier", "reset_ip", "reset_validate_ip", "change_password_account", "admin_reset_actor"] } }, force: true });
    await db.Mahasiswa.destroy({ where: { id: ids.mahasiswa }, force: true }); await db.Dosen.destroy({ where: { id: ids.dosen }, force: true });
    await db.Admin.destroy({ where: { id: ids.admin }, force: true }); await db.SekretarisProdi.destroy({ where: { id: ids.sekretaris_prodi }, force: true }); await db.sequelize.close();
  });

  for (const username of [student.nim, dosen.kode_dosen, admin.nip, sekretaris.nik]) {
    const login = await invoke(authController.login, request({ username, password })); assert.equal(login.statusCode, 200); assert.ok(login.payload.data.token); assert.ok(login.payload.data.session.id);
  }
  const originalDosenEmail = dosen.email;
  await dosen.update({ email: student.email }, { hooks: false });
  const ambiguousLogin = await invoke(authController.login, request({ username: student.email, password }));
  assert.equal(ambiguousLogin.statusCode, 401);
  assert.equal(ambiguousLogin.payload.code, "INVALID_CREDENTIALS");
  assert.equal(ambiguousLogin.payload.detail, undefined);
  assert.equal(ambiguousLogin.payload.role, undefined);
  assert.equal(ambiguousLogin.payload.id, undefined);
  assert.equal(JSON.stringify(ambiguousLogin.payload).includes("mahasiswa"), false);
  assert.equal(JSON.stringify(ambiguousLogin.payload).includes("dosen"), false);
  await dosen.update({ email: originalDosenEmail }, { hooks: false });
  assert.ok(await db.AuthSecurityEvent.findOne({ where: { event_type: "auth.login", reason_code: "IDENTIFIER_AMBIGUOUS" } }));
  const login = await invoke(authController.login, request({ username: student.nim, password })); const oldToken = login.payload.data.token;
  assert.equal(login.payload.data.next_action, "change_password");
  const blocked = await authenticate(middleware.authenticateToken, oldToken); assert.equal(blocked.statusCode, 403); assert.equal(blocked.payload.code, "PASSWORD_CHANGE_REQUIRED");
  const allowed = await authenticate(middleware.authenticateRestrictedAllowed, oldToken); assert.equal(allowed.next, true);

  const changed = await invoke(authController.changePassword, { ...allowed.req, body: { current_password: password, new_password: "A genuinely new secret! 67" } });
  assert.equal(changed.statusCode, 200); assert.equal(changed.payload.data.credential_state, "active"); const newToken = changed.payload.data.token;
  const stale = await authenticate(middleware.authenticateRestrictedAllowed, oldToken); assert.equal(stale.statusCode, 401); assert.equal(stale.payload.code, "SESSION_REVOKED");
  assert.equal((await authenticate(middleware.authenticateToken, newToken)).next, true);

  const secondLogin = await invoke(authController.login, request({ username: student.nim, password: "A genuinely new secret! 67" }));
  const secondAuth = await authenticate(middleware.authenticateToken, secondLogin.payload.data.token);
  assert.equal((await invoke(authController.logout, secondAuth.req)).statusCode, 200);
  assert.equal((await authenticate(middleware.authenticateToken, secondLogin.payload.data.token)).statusCode, 401);
  assert.equal((await authenticate(middleware.authenticateToken, newToken)).next, true);
  const primaryAuth = await authenticate(middleware.authenticateToken, newToken);
  assert.equal((await invoke(authController.logoutAll, primaryAuth.req)).statusCode, 200);
  assert.equal((await authenticate(middleware.authenticateToken, newToken)).statusCode, 401);

  const privilegedReset = await recovery.issueAdminReset({ targetType: "admin", targetId: admin.id, actor: { id: admin.id, role: "admin" }, reason: "test" }).catch(error => error);
  assert.equal(privilegedReset.code, "PRIVILEGED_ACCOUNT_RESET_UNAVAILABLE");

  const recoveryLogin = await invoke(authController.login, request({ username: student.nim, password: "A genuinely new secret! 67" }));
  const recoverySessionToken = recoveryLogin.payload.data.token;
  await Promise.all([recovery.requestForgot(student.email), recovery.requestForgot(student.email)]);
  assert.equal(await db.AuthOutbox.count({ where: { recipient_reference: student.email } }), 1);
  const outbox = await db.AuthOutbox.findOne({ where: { recipient_reference: student.email } });
  assert.ok(outbox?.ciphertext); const rawToken = recovery.decrypt(outbox); assert.equal(outbox.toJSON().token, undefined); assert.equal(outbox.ciphertext.includes(rawToken), false);
  const results = await Promise.allSettled([recovery.confirmReset(rawToken, "Reset password secure! 89"), recovery.confirmReset(rawToken, "Reset password secure! 89")]);
  assert.equal(results.filter(item => item.status === "fulfilled").length, 1); const rejected = results.find(item => item.status === "rejected"); assert.ok(["RESET_TOKEN_USED", "RESET_TOKEN_INVALID"].includes(rejected.reason.code));
  assert.equal((await db.PasswordResetToken.findByPk(outbox.reset_token_id)).used_at instanceof Date, true);

  const resetInvalidatesSession = await authenticate(middleware.authenticateToken, recoverySessionToken); assert.equal(resetInvalidatesSession.statusCode, 401);
  await recovery.requestForgot(student.email); let deliveredUrl = "";
  await authOutboxWorker.processOne(async ({ resetUrl }) => { deliveredUrl = resetUrl; return { providerReference: "test-message" }; }); // cancels consumed job
  await authOutboxWorker.processOne(async ({ resetUrl }) => { deliveredUrl = resetUrl; return { providerReference: "test-message" }; });
  const delivered = await db.AuthOutbox.findOne({ where: { recipient_reference: student.email, status: "sent" } });
  assert.ok(delivered); assert.equal(delivered.ciphertext, null); assert.match(deliveredUrl, /\/#reset-password&token=/); assert.equal(deliveredUrl.includes("?token="), false);

  await dosen.update({ recovery_email_verified_at: null, recovery_email_verification_source: null }, { hooks: false });
  const verification = await recovery.verifyRecoveryChannel({ targetType: "dosen", targetId: dosen.id, actor: { id: admin.id, role: "admin" },
    source: "institutional_directory", reason: "Dicocokkan dengan direktori institusi resmi" });
  assert.equal(verification.source, "institutional_directory");
  const adminReset = await recovery.issueAdminReset({ targetType: "dosen", targetId: dosen.id, actor: { id: admin.id, role: "admin" }, reason: "Permintaan pemilik akun terverifikasi" });
  assert.equal(adminReset.replayed, false); await dosen.reload(); assert.equal(await dosen.comparePassword(password), false);
  assert.ok(await db.AuthOutbox.findOne({ where: { reset_token_id: adminReset.tokenRecord.id, status: "pending" } }));
});
