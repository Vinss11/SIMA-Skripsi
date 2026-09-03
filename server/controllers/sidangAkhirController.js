const { Op } = require("sequelize");
const {
  sequelize,
  Mahasiswa,
  Dosen,
  Pengajuan,
  PendaftaranPenjaluran,
  PeriodePenjaluran,
  BimbinganSkripsi,
  DokumenSidang,
  PeriodeSidang,
  PeriodeSidangHari,
  PeriodeSidangRuangan,
  PendaftaranSidang,
  KetersediaanPengujiSidang,
  PreferensiPengujiSidang,
  JadwalSidangPenguji,
  DosenBidangPenelitian,
  PengajuanBidangPenelitian,
  Topik,
} = require("../models");
const { canContinueExistingSupervision } = require("../services/dosenStatusService");
const {
  getMahasiswaSupervisionAccess,
  sendSupervisionAccessDenied,
} = require("../services/mahasiswaSupervisionAccessService");
const { getSidangRequirement: getPenjaluranGradeRequirement } = require("../services/penjaluranGradeService");
const {
  getCurrentProgressForMahasiswa,
  recalculateCurrentProgressForMahasiswa,
  resolvePolicy: resolveGuidanceProgressPolicy,
} = require("../services/guidanceProgressService");
const {
  buildResearchProfile,
  rankLecturersForStudent,
} = require("../services/examinerRecommendationService");
const {
  buildTopikListFromSubmission,
  evaluateTopikClusterReviewState,
  evaluateTopikParallelState,
  evaluateTopikSekprodiReviewState,
  isTopikParallelSubmission,
} = require("../services/topikParallelReviewService");

const DOKUMEN_APPROVAL_FIELDS = [
  "transkrip_status",
  "cept_status",
  "draft_skripsi_status",
  "paper_status",
];
const EXAMINER_PROFILE_HIGH_INTENSITY = "intensitas_tinggi";
const EXAMINER_PROFILE_SUPPORTIVE = "suportif";
const VALID_EXAMINER_PROFILES = new Set([
  EXAMINER_PROFILE_HIGH_INTENSITY,
  EXAMINER_PROFILE_SUPPORTIVE,
]);

function normalizePeriodeType(value) {
  const raw = String(value || "")
    .trim()
    .toLowerCase();
  if (raw === "uts" || raw === "uas") return raw;
  return null;
}

function normalizeAcademicSemester(value) {
  const raw = String(value || "")
    .trim()
    .toLowerCase();
  if (raw === "ganjil" || raw === "genap") return raw;
  return null;
}

function isValidAcademicYearRange(value) {
  const match = String(value || "").trim().match(/^(\d{4})\/(\d{4})$/);
  return Boolean(match) && Number(match[2]) === Number(match[1]) + 1;
}

function formatPeriodeLabel(periodeType, semester, tahunAkademik) {
  const tipe = String(periodeType || "").toUpperCase();
  const semesterLabel = String(semester || "").trim().toLowerCase() === "genap" ? "Genap" : "Ganjil";
  return `${tipe} ${semesterLabel} ${String(tahunAkademik || "").trim()}`.trim();
}

function resolveJudulSkripsiFromPengajuan(pengajuan) {
  if (!pengajuan) return "-";
  if (pengajuan.judul_mandiri) return pengajuan.judul_mandiri;
  return (
    pengajuan.topik_1_judul ||
    pengajuan.topik_2_judul ||
    pengajuan.topik_3_judul ||
    "-"
  );
}

function resolveFinalTopikFromPengajuan(pengajuan) {
  if (!pengajuan || pengajuan.tipe_pengajuan !== "topik_dosen") return null;
  const topikList = buildTopikListFromSubmission(pengajuan);
  if (topikList.length === 0) return null;
  if (isTopikParallelSubmission(pengajuan)) {
    const sekprodiState = evaluateTopikSekprodiReviewState(pengajuan);
    const clusterState = evaluateTopikClusterReviewState(pengajuan);
    const parallelState = evaluateTopikParallelState(pengajuan);
    const finalSlot = sekprodiState.sekprodi_final_winner?.slot
      || clusterState.final_winner?.slot
      || parallelState.approved_topik?.slot;
    if (finalSlot) return topikList.find((item) => Number(item.slot) === Number(finalSlot)) || null;
  }
  const approvedWithSlot = [...(pengajuan.riwayat || [])]
    .filter((item) => item.status === "approved" && Number(item.topik_slot || 0) > 0)
    .sort((left, right) => new Date(right.tanggal_keputusan || right.createdAt || 0) - new Date(left.tanggal_keputusan || left.createdAt || 0))[0];
  if (approvedWithSlot) {
    return topikList.find((item) => Number(item.slot) === Number(approvedWithSlot.topik_slot)) || null;
  }
  const rejectedCount = (pengajuan.riwayat || []).filter(
    (item) => item.status === "rejected" && String(item.tipe_approval || "calon_pembimbing") === "calon_pembimbing"
  ).length;
  return topikList.find((item) => Number(item.slot) === Math.min(rejectedCount + 1, topikList.length)) || topikList[0];
}

function nowJakartaDateTime() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = formatter.formatToParts(new Date()).reduce((acc, part) => {
    if (part.type !== "literal") acc[part.type] = part.value;
    return acc;
  }, {});
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    datetime: `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}+07:00`,
  };
}

function normalizeDateOnly(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const ymdMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (ymdMatch) return ymdMatch[1];
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function getDayOfWeekFromDateOnly(dateOnly) {
  const parts = String(dateOnly || "").split("-");
  if (parts.length !== 3) return null;
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!year || !month || !day) return null;
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(utcDate.getTime())) return null;
  return utcDate.getUTCDay(); // 0: Minggu ... 6: Sabtu
}

function getSessionTemplateByDate(dateOnly) {
  const day = getDayOfWeekFromDateOnly(dateOnly);
  if (day === null) return [];
  if (day === 5) {
    return [
      { sesi_ke: 1, sesi_mulai: "08:00", sesi_selesai: "09:30" },
      { sesi_ke: 2, sesi_mulai: "09:45", sesi_selesai: "11:15" },
      { sesi_ke: 3, sesi_mulai: "13:30", sesi_selesai: "15:00" },
      { sesi_ke: 4, sesi_mulai: "15:15", sesi_selesai: "16:45" },
    ];
  }
  return [
    { sesi_ke: 1, sesi_mulai: "08:00", sesi_selesai: "09:30" },
    { sesi_ke: 2, sesi_mulai: "09:45", sesi_selesai: "11:15" },
    { sesi_ke: 3, sesi_mulai: "13:00", sesi_selesai: "14:30" },
    { sesi_ke: 4, sesi_mulai: "14:45", sesi_selesai: "16:15" },
    { sesi_ke: 5, sesi_mulai: "16:30", sesi_selesai: "18:00" },
  ];
}

function sanitizeRoomList(roomList) {
  if (!Array.isArray(roomList)) return [];
  const map = new Map();
  roomList.forEach((room) => {
    const clean = String(room || "").trim();
    if (!clean) return;
    const key = clean.toLowerCase();
    if (!map.has(key)) map.set(key, clean.slice(0, 120));
  });
  return Array.from(map.values());
}

function sanitizeDateList(dateList) {
  if (!Array.isArray(dateList)) return [];
  const set = new Set();
  dateList.forEach((item) => {
    const normalized = normalizeDateOnly(item);
    if (!normalized) return;
    const sessions = getSessionTemplateByDate(normalized);
    if (sessions.length === 0) return;
    set.add(normalized);
  });
  return Array.from(set.values()).sort();
}

async function getCountedBimbingan(mahasiswaId, transaction = null) {
  try {
    return transaction
      ? await recalculateCurrentProgressForMahasiswa(mahasiswaId, transaction)
      : await getCurrentProgressForMahasiswa(mahasiswaId);
  } catch (error) {
    // Mahasiswa yang belum memiliki assignment pembimbing tetap berhak melihat
    // status sidang. Kondisi tersebut berarti progresnya belum dimulai, bukan
    // kegagalan server.
    if (error?.code !== "GUIDANCE_ASSIGNMENT_REQUIRED") throw error;

    const guidancePolicy = await resolveGuidanceProgressPolicy();
    return {
      policy: guidancePolicy,
      enforcement: {
        counted: 0,
        sufficient: false,
        is_stale: false,
      },
      unavailable_reason: {
        code: error.code,
        message: "Dosen pembimbing skripsi belum ditetapkan.",
      },
    };
  }
}

async function getDokumenSidangApprovalSummary(mahasiswaId, transaction = null) {
  const doc = await DokumenSidang.findOne({
    where: { mahasiswa_id: mahasiswaId },
    transaction: transaction || undefined,
  });
  const summary = {
    has_record: Boolean(doc),
    approved_count: 0,
    all_approved: false,
    documents: [
      { key: "transkrip", label: "Transkrip Nilai", status: "belum_upload", approved: false },
      { key: "cept", label: "Sertifikat CEPT", status: "belum_upload", approved: false },
      { key: "draft_skripsi", label: "Draft Skripsi", status: "belum_upload", approved: false },
      { key: "paper", label: "Paper", status: "belum_upload", approved: false },
    ],
  };
  if (!doc) return summary;
  summary.documents = [
    { key: "transkrip", label: "Transkrip Nilai", status: String(doc.transkrip_status || "belum_upload"), approved: String(doc.transkrip_status || "").toLowerCase() === "approved" },
    { key: "cept", label: "Sertifikat CEPT", status: String(doc.cept_status || "belum_upload"), approved: String(doc.cept_status || "").toLowerCase() === "approved" },
    { key: "draft_skripsi", label: "Draft Skripsi", status: String(doc.draft_skripsi_status || "belum_upload"), approved: String(doc.draft_skripsi_status || "").toLowerCase() === "approved" },
    { key: "paper", label: "Paper", status: String(doc.paper_status || "belum_upload"), approved: String(doc.paper_status || "").toLowerCase() === "approved" },
  ];
  let approved = 0;
  DOKUMEN_APPROVAL_FIELDS.forEach((field) => {
    if (String(doc[field] || "").toLowerCase() === "approved") approved += 1;
  });
  summary.approved_count = approved;
  summary.all_approved = approved === DOKUMEN_APPROVAL_FIELDS.length;
  return summary;
}

async function getMahasiswaSidangEligibility(mahasiswaId, transaction = null) {
  const [guidanceProgress, dokumen, penjaluranCourse] = await Promise.all([
    getCountedBimbingan(mahasiswaId, transaction),
    getDokumenSidangApprovalSummary(mahasiswaId, transaction),
    getPenjaluranGradeRequirement(mahasiswaId, transaction),
  ]);
  const countedSessions = Number(guidanceProgress.enforcement.counted || 0);
  const targetMinimum = Number(guidanceProgress.policy.minimum_validated_sessions);
  const bimbinganReady = guidanceProgress.enforcement.sufficient;
  const penjaluranCourseAllows = !penjaluranCourse.required || penjaluranCourse.fulfilled;
  const eligible = bimbinganReady && dokumen.all_approved && penjaluranCourseAllows;
  return {
    counted_sessions: countedSessions,
    target_minimum: targetMinimum,
    bimbingan_ready: bimbinganReady,
    bimbingan_unavailable_reason: guidanceProgress.unavailable_reason || null,
    dokumen_approved_count: dokumen.approved_count,
    dokumen_total_required: DOKUMEN_APPROVAL_FIELDS.length,
    dokumen_ready: dokumen.all_approved,
    dokumen: dokumen.documents,
    mata_kuliah_penjaluran: penjaluranCourse,
    checklist: [
      { code: "MINIMUM_GUIDANCE", status: bimbinganReady ? "valid" : "invalid", facts: { counted: countedSessions, required: targetMinimum, policy_id: guidanceProgress.policy.id, policy_version: guidanceProgress.policy.version } },
      { code: "TRANSCRIPT_DOCUMENT", status: dokumen.all_approved ? "valid" : "pending", facts: { approved: dokumen.approved_count, required: DOKUMEN_APPROVAL_FIELDS.length } },
      { code: "PENJALURAN_COURSE_PASSED", status: penjaluranCourseAllows ? "valid" : "invalid", facts: penjaluranCourse },
    ],
    eligible,
  };
}

function buildSidangRegistrationValidationErrors(eligibility) {
  const errors = [];
  if (!eligibility?.bimbingan_ready) {
    errors.push({
      code: "BIMBINGAN_BELUM_CUKUP",
      field: "bimbingan",
      message: `Bimbingan tervalidasi baru ${Number(eligibility?.counted_sessions || 0)} dari minimal ${Number(eligibility?.target_minimum || 0)} sesi.`,
    });
  }
  (eligibility?.dokumen || []).forEach((document) => {
    if (!document.approved) {
      errors.push({
        code: `DOKUMEN_${String(document.key || "").toUpperCase()}_BELUM_DISETUJUI`,
        field: document.key,
        message: `${document.label} belum disetujui dosen pembimbing.`,
      });
    }
  });
  if (eligibility?.academic?.effective_decision === "block") {
    errors.push({
      code: "DATA_AKADEMIK_BELUM_MEMENUHI",
      field: "data_akademik",
      message: "Data akademik belum memenuhi syarat otomatis pendaftaran sidang.",
    });
  }
  if (eligibility?.mata_kuliah_penjaluran?.required && !eligibility?.mata_kuliah_penjaluran?.fulfilled) {
    const course = eligibility.mata_kuliah_penjaluran;
    const gradeDescription = course.nilai
      ? `Nilai ${course.nilai} belum mencapai minimum ${course.minimum_passing_grade || "C"}`
      : "Nilai belum tersedia";
    errors.push({
      code: "MATA_KULIAH_PENJALURAN_BELUM_LULUS",
      field: "mata_kuliah_penjaluran",
      message: `${course.mata_kuliah || "Mata kuliah wajib penjaluran"}: ${gradeDescription}.`,
    });
  }
  return errors;
}

async function getOpenPeriodeSidang(transaction = null) {
  return PeriodeSidang.findOne({
    where: { status: "open" },
    order: [["activated_at", "DESC"], ["updatedAt", "DESC"]],
    transaction: transaction || undefined,
  });
}

function serializePeriode(periode, hariRows = [], roomRows = []) {
  if (!periode) return null;
  const item = periode?.toJSON ? periode.toJSON() : periode;
  return {
    id: item.id,
    label_periode: item.label_periode,
    periode: item.periode,
    tahun_akademik: item.tahun_akademik,
    semester: item.semester,
    tanggal_mulai_pendaftaran: item.tanggal_mulai_pendaftaran,
    tanggal_selesai_pendaftaran: item.tanggal_selesai_pendaftaran,
    status: item.status,
    catatan: item.catatan,
    activated_at: item.activated_at,
    closed_at: item.closed_at,
    hari_sidang: hariRows.map((row) => row.tanggal_sidang).sort(),
    ruangan_sidang: roomRows.map((row) => row.nama_ruangan).sort((a, b) => a.localeCompare(b)),
  };
}

function buildSidangSlotKey(tanggal, sesiKe) {
  return `${tanggal}#${sesiKe}`;
}

function buildRoomSlotKey(tanggal, sesiKe, room) {
  return `${tanggal}#${sesiKe}#${room}`;
}

function buildSessionSlots(hariRows, roomRows) {
  const slots = [];
  const orderedHari = [...hariRows].sort((a, b) => String(a.tanggal_sidang).localeCompare(String(b.tanggal_sidang)));
  const orderedRoom = [...roomRows].sort((a, b) => String(a.nama_ruangan).localeCompare(String(b.nama_ruangan)));
  orderedHari.forEach((hari) => {
    const sessions = getSessionTemplateByDate(hari.tanggal_sidang);
    sessions.forEach((session) => {
      orderedRoom.forEach((room) => {
        slots.push({
          tanggal_sidang: hari.tanggal_sidang,
          sesi_ke: session.sesi_ke,
          sesi_mulai: session.sesi_mulai,
          sesi_selesai: session.sesi_selesai,
          ruangan: room.nama_ruangan,
          slot_key: buildRoomSlotKey(hari.tanggal_sidang, session.sesi_ke, room.nama_ruangan),
        });
      });
    });
  });
  return slots;
}

function pairPreferenceScore(pairA, pairB) {
  const highIntensityCountA =
    (pairA.profileA === EXAMINER_PROFILE_HIGH_INTENSITY ? 1 : 0)
    + (pairA.profileB === EXAMINER_PROFILE_HIGH_INTENSITY ? 1 : 0);
  const highIntensityCountB =
    (pairB.profileA === EXAMINER_PROFILE_HIGH_INTENSITY ? 1 : 0)
    + (pairB.profileB === EXAMINER_PROFILE_HIGH_INTENSITY ? 1 : 0);
  // Utamakan satu penguji Intensitas Tinggi dan satu Suportif, lalu dua penguji Suportif.
  const rankA = highIntensityCountA === 1 ? 0 : highIntensityCountA === 0 ? 1 : 99;
  const rankB = highIntensityCountB === 1 ? 0 : highIntensityCountB === 0 ? 1 : 99;
  if (rankA !== rankB) return rankA - rankB;
  if (pairA.loadScore !== pairB.loadScore) return pairA.loadScore - pairB.loadScore;
  return pairA.idScore - pairB.idScore;
}

function isOpenRegistrationWindow(periode, nowDateOnly) {
  if (!periode || String(periode.status).toLowerCase() !== "open") return false;
  return periode.tanggal_mulai_pendaftaran <= nowDateOnly && nowDateOnly <= periode.tanggal_selesai_pendaftaran;
}

function mapAvailabilityRows(rows, profileByDosenId) {
  const map = new Map();
  rows.forEach((row) => {
    const key = buildSidangSlotKey(row.tanggal_sidang, row.sesi_ke);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push({
      dosen_id: Number(row.dosen_id),
      profil_penilaian_penguji: profileByDosenId.get(Number(row.dosen_id)) || null,
      kondisi_fisik: String(row.kondisi_fisik || "fit").toLowerCase(),
    });
  });
  return map;
}

async function getExaminerProfileReadiness(transaction) {
  const eligibleDosens = await Dosen.findAll({
    where: { status_keaktifan: "active" },
    attributes: ["id", "kode_dosen", "nik", "nama", "gelar", "profil_penilaian_penguji"],
    order: [["nama", "ASC"], ["id", "ASC"]],
    transaction,
  });
  const unconfigured = eligibleDosens.filter(
    (dosen) => !VALID_EXAMINER_PROFILES.has(String(dosen.profil_penilaian_penguji || ""))
  );
  const supportiveCount = eligibleDosens.filter(
    (dosen) => dosen.profil_penilaian_penguji === EXAMINER_PROFILE_SUPPORTIVE
  ).length;

  return {
    eligibleDosens,
    unconfigured,
    supportiveCount,
    isReady: eligibleDosens.length >= 2 && unconfigured.length === 0 && supportiveCount >= 1,
  };
}

function serializeJadwalRow(row) {
  if (!row) return null;
  const item = row?.toJSON ? row.toJSON() : row;
  return {
    id: item.id,
    tanggal_sidang: item.tanggal_sidang,
    sesi_ke: item.sesi_ke,
    sesi_mulai: item.sesi_mulai,
    sesi_selesai: item.sesi_selesai,
    ruangan: item.ruangan,
    assignment_status: item.assignment_status,
    generated_at: item.generated_at,
    penguji1: item.penguji1
      ? {
          id: item.penguji1.id,
          nama: item.penguji1.nama,
          nik: item.penguji1.nik,
          gelar: item.penguji1.gelar,
        }
      : null,
    penguji2: item.penguji2
      ? {
          id: item.penguji2.id,
          nama: item.penguji2.nama,
          nik: item.penguji2.nik,
          gelar: item.penguji2.gelar,
        }
      : null,
  };
}

exports.getMahasiswaSidangPeriods = async (req, res) => {
  try {
    const mahasiswaId = Number(req.user?.id || 0);
    const nowDate = nowJakartaDateTime().date;
    const periodes = await PeriodeSidang.findAll({
      where: { status: { [Op.in]: ["open", "closed"] } },
      order: [["activated_at", "DESC"], ["updatedAt", "DESC"]],
    });
    const periodeIds = periodes.map((item) => Number(item.id));
    const registrations = periodeIds.length
      ? await PendaftaranSidang.findAll({
          where: { mahasiswa_id: mahasiswaId, periode_sidang_id: { [Op.in]: periodeIds } },
          include: [{
            model: JadwalSidangPenguji,
            as: "jadwalSidang",
            include: [
              { model: Dosen, as: "penguji1", attributes: ["id", "nama", "nik", "gelar"] },
              { model: Dosen, as: "penguji2", attributes: ["id", "nama", "nik", "gelar"] },
            ],
          }],
          order: [["createdAt", "DESC"]],
        })
      : [];
    const registrationByPeriod = new Map();
    registrations.forEach((item) => {
      const periodId = Number(item.periode_sidang_id);
      if (!registrationByPeriod.has(periodId)) registrationByPeriod.set(periodId, item);
    });
    return res.json({
      success: true,
      data: {
        rows: periodes.map((periode) => {
          const registration = registrationByPeriod.get(Number(periode.id)) || null;
          return {
            ...serializePeriode(periode),
            registration_window_open: isOpenRegistrationWindow(periode, nowDate),
            pendaftaran: registration
              ? {
                  id: registration.id,
                  status: registration.status,
                  registered_at: registration.registered_at,
                  assigned_at: registration.assigned_at,
                  jadwal_sidang: serializeJadwalRow(registration.jadwalSidang),
                }
              : null,
          };
        }),
      },
    });
  } catch (error) {
    console.error("Error di getMahasiswaSidangPeriods:", error);
    return res.status(500).json({ success: false, message: "Terjadi kesalahan saat memuat periode pendaftaran sidang.", error: error.message });
  }
};

exports.getMahasiswaSidangPeriodDetail = async (req, res) => {
  try {
    const mahasiswaId = Number(req.user?.id || 0);
    const periodeId = Number(req.params?.id || 0);
    if (!periodeId) return res.status(400).json({ success: false, message: "ID periode sidang tidak valid." });
    const [periode, eligibility, supervisionAccess, registration] = await Promise.all([
      PeriodeSidang.findOne({ where: { id: periodeId, status: { [Op.in]: ["open", "closed"] } } }),
      getMahasiswaSidangEligibility(mahasiswaId),
      getMahasiswaSupervisionAccess(mahasiswaId),
      PendaftaranSidang.findOne({
        where: { mahasiswa_id: mahasiswaId, periode_sidang_id: periodeId },
        include: [{
          model: JadwalSidangPenguji,
          as: "jadwalSidang",
          include: [
            { model: Dosen, as: "penguji1", attributes: ["id", "nama", "nik"] },
            { model: Dosen, as: "penguji2", attributes: ["id", "nama", "nik"] },
          ],
        }],
      }),
    ]);
    if (!periode) return res.status(404).json({ success: false, message: "Periode sidang tidak ditemukan." });
    const validationErrors = buildSidangRegistrationValidationErrors(eligibility);
    if (supervisionAccess?.can_register_defense === false) {
      validationErrors.push({ code: "PEMBIMBING_TIDAK_AKTIF", field: "pembimbing", message: supervisionAccess.reason || "Pembimbing skripsi belum aktif." });
    }
    const registrationWindowOpen = isOpenRegistrationWindow(periode, nowJakartaDateTime().date);
    const hasActiveRegistration = Boolean(registration && String(registration.status || "").toLowerCase() !== "cancelled");
    return res.json({
      success: true,
      data: {
        periode_sidang: serializePeriode(periode),
        registration_window_open: registrationWindowOpen,
        eligibility,
        validation_errors: validationErrors,
        can_register: registrationWindowOpen && validationErrors.length === 0 && !hasActiveRegistration,
        pendaftaran: registration
          ? {
              id: registration.id,
              status: registration.status,
              registered_at: registration.registered_at,
              assigned_at: registration.assigned_at,
              catatan: registration.catatan,
              jadwal_sidang: serializeJadwalRow(registration.jadwalSidang),
            }
          : null,
      },
    });
  } catch (error) {
    console.error("Error di getMahasiswaSidangPeriodDetail:", error);
    return res.status(500).json({ success: false, message: "Terjadi kesalahan saat memuat detail pendaftaran sidang.", error: error.message });
  }
};

exports.getMahasiswaSidangStatus = async (req, res) => {
  try {
    const mahasiswaId = Number(req.user.id);
    const nowJakarta = nowJakartaDateTime();
    const [mahasiswa, eligibility, openPeriode, supervisionAccess] = await Promise.all([
      Mahasiswa.findByPk(mahasiswaId, {
        attributes: ["id", "nim", "nama", "angkatan", "email", "dosen_pembimbing_skripsi_id"],
        include: [
          {
            model: Dosen,
            as: "dosenPembimbingSkripsi",
            attributes: ["id", "nama", "nik", "email"],
          },
        ],
      }),
      getMahasiswaSidangEligibility(mahasiswaId),
      getOpenPeriodeSidang(),
      getMahasiswaSupervisionAccess(mahasiswaId),
    ]);

    if (!mahasiswa) {
      return res.status(404).json({
        success: false,
        message: "Mahasiswa tidak ditemukan.",
      });
    }

    let pendaftaranAktif = null;
    if (openPeriode) {
      pendaftaranAktif = await PendaftaranSidang.findOne({
        where: { mahasiswa_id: mahasiswaId, periode_sidang_id: openPeriode.id },
        include: [
          {
            model: JadwalSidangPenguji,
            as: "jadwalSidang",
            include: [
              { model: Dosen, as: "penguji1", attributes: ["id", "nama", "nik"] },
              { model: Dosen, as: "penguji2", attributes: ["id", "nama", "nik"] },
            ],
          },
        ],
      });
    }

    let riwayatTerakhir = null;
    if (!pendaftaranAktif) {
      riwayatTerakhir = await PendaftaranSidang.findOne({
        where: { mahasiswa_id: mahasiswaId },
        include: [
          {
            model: PeriodeSidang,
            as: "periodeSidang",
            attributes: ["id", "label_periode", "status"],
          },
          {
            model: JadwalSidangPenguji,
            as: "jadwalSidang",
            include: [
              { model: Dosen, as: "penguji1", attributes: ["id", "nama", "nik"] },
              { model: Dosen, as: "penguji2", attributes: ["id", "nama", "nik"] },
            ],
          },
        ],
        order: [["createdAt", "DESC"]],
      });
    }

    const canRegister =
      eligibility.eligible &&
      openPeriode &&
      isOpenRegistrationWindow(openPeriode, nowJakarta.date) &&
      !pendaftaranAktif;

    const activeSchedule = serializeJadwalRow(pendaftaranAktif?.jadwalSidang);
    const lastSchedule = serializeJadwalRow(riwayatTerakhir?.jadwalSidang);

    return res.json({
      success: true,
      data: {
        eligibility,
        mahasiswa: {
          id: mahasiswa.id,
          nim: mahasiswa.nim,
          nama: mahasiswa.nama,
          angkatan: mahasiswa.angkatan,
          email: mahasiswa.email,
        },
        dosen_pembimbing: supervisionAccess.current_supervisor || (mahasiswa.dosenPembimbingSkripsi
          ? {
              id: mahasiswa.dosenPembimbingSkripsi.id,
              nama: mahasiswa.dosenPembimbingSkripsi.nama,
              nik: mahasiswa.dosenPembimbingSkripsi.nik,
              email: mahasiswa.dosenPembimbingSkripsi.email,
            }
          : null),
        dosen_pembimbings: supervisionAccess.current_supervisors || [],
        periode_sidang_aktif: openPeriode
          ? {
              id: openPeriode.id,
              label_periode: openPeriode.label_periode,
              tanggal_mulai_pendaftaran: openPeriode.tanggal_mulai_pendaftaran,
              tanggal_selesai_pendaftaran: openPeriode.tanggal_selesai_pendaftaran,
              status: openPeriode.status,
            }
          : null,
        registration_window_open: openPeriode ? isOpenRegistrationWindow(openPeriode, nowJakarta.date) : false,
        can_register: Boolean(canRegister),
        pendaftaran_aktif: pendaftaranAktif
          ? {
              id: pendaftaranAktif.id,
              status: pendaftaranAktif.status,
              registered_at: pendaftaranAktif.registered_at,
              assigned_at: pendaftaranAktif.assigned_at,
              catatan: pendaftaranAktif.catatan,
              jadwal_sidang: activeSchedule,
            }
          : null,
        riwayat_terakhir: riwayatTerakhir
          ? {
              id: riwayatTerakhir.id,
              status: riwayatTerakhir.status,
              registered_at: riwayatTerakhir.registered_at,
              periode_sidang: riwayatTerakhir.periodeSidang
                ? {
                    id: riwayatTerakhir.periodeSidang.id,
                    label_periode: riwayatTerakhir.periodeSidang.label_periode,
                    status: riwayatTerakhir.periodeSidang.status,
                  }
                : null,
              jadwal_sidang: lastSchedule,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("Error di getMahasiswaSidangStatus:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server.",
      error: error.message,
    });
  }
};

exports.registerMahasiswaSidang = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const mahasiswaId = Number(req.user.id);
    const nowJakarta = nowJakartaDateTime();
    const mahasiswa = await Mahasiswa.findByPk(mahasiswaId, {
      attributes: ["id", "dosen_pembimbing_skripsi_id"],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!mahasiswa) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Mahasiswa tidak ditemukan.",
      });
    }

    const supervisionAccess = await getMahasiswaSupervisionAccess(mahasiswaId, transaction);
    if (!supervisionAccess.can_register_defense) {
      await transaction.rollback();
      return sendSupervisionAccessDenied(res, supervisionAccess, "register_defense");
    }
    const primarySupervisorId = Number(supervisionAccess.current_supervisor?.id || 0) || null;

    const eligibility = await getMahasiswaSidangEligibility(mahasiswaId, transaction);
    if (!eligibility.eligible) {
      const validationErrors = buildSidangRegistrationValidationErrors(eligibility);
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: "Pendaftaran belum dapat dikirim karena masih ada syarat yang belum terpenuhi.",
        data: { eligibility, validation_errors: validationErrors },
      });
    }

    const requestedPeriodeId = Number(req.body?.periode_sidang_id || 0);
    const openPeriode = requestedPeriodeId
      ? await PeriodeSidang.findOne({
          where: { id: requestedPeriodeId, status: "open" },
          transaction,
          lock: transaction.LOCK.UPDATE,
        })
      : await getOpenPeriodeSidang(transaction);
    if (!openPeriode) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: "Belum ada periode sidang yang dibuka oleh sekretaris prodi.",
      });
    }

    if (!isOpenRegistrationWindow(openPeriode, nowJakarta.date)) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: "Pendaftaran sidang di luar rentang periode aktif.",
      });
    }

    const existing = await PendaftaranSidang.findOne({
      where: { mahasiswa_id: mahasiswaId, periode_sidang_id: openPeriode.id },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (existing && existing.status !== "cancelled") {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: "Anda sudah terdaftar pada periode sidang aktif.",
      });
    }

    if (existing && existing.status === "cancelled") {
      existing.status = "submitted";
      existing.registered_at = new Date(nowJakarta.datetime);
      existing.assigned_at = null;
      existing.catatan = null;
      await existing.save({ transaction });
    } else {
      await PendaftaranSidang.create(
        {
          periode_sidang_id: openPeriode.id,
          mahasiswa_id: mahasiswaId,
          dosen_pembimbing_id: primarySupervisorId,
          status: "submitted",
          registered_at: new Date(nowJakarta.datetime),
        },
        { transaction }
      );
    }

    await transaction.commit();

    return res.json({
      success: true,
      message: "Pendaftaran sidang berhasil dikirim. Menunggu penjadwalan sekretaris prodi.",
    });
  } catch (error) {
    try {
      await transaction.rollback();
    } catch (rollbackError) {
      // no-op
    }
    console.error("Error di registerMahasiswaSidang:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat daftar sidang.",
      error: error.message,
    });
  }
};

exports.getSekretarisSidangOverview = async (req, res) => {
  try {
    const [periodes, hariRows, roomRows] = await Promise.all([
      PeriodeSidang.findAll({
        order: [["updatedAt", "DESC"]],
      }),
      PeriodeSidangHari.findAll({
        attributes: ["periode_sidang_id", "tanggal_sidang"],
      }),
      PeriodeSidangRuangan.findAll({
        attributes: ["periode_sidang_id", "nama_ruangan"],
      }),
    ]);

    const hariByPeriode = new Map();
    hariRows.forEach((item) => {
      const key = Number(item.periode_sidang_id);
      if (!hariByPeriode.has(key)) hariByPeriode.set(key, []);
      hariByPeriode.get(key).push(item);
    });

    const roomByPeriode = new Map();
    roomRows.forEach((item) => {
      const key = Number(item.periode_sidang_id);
      if (!roomByPeriode.has(key)) roomByPeriode.set(key, []);
      roomByPeriode.get(key).push(item);
    });

    const periodeIds = periodes.map((item) => Number(item.id));
    const [pendaftaranRows, jadwalRows] = await Promise.all([
      periodeIds.length
        ? PendaftaranSidang.findAll({
            where: { periode_sidang_id: { [Op.in]: periodeIds } },
            attributes: ["periode_sidang_id", "status"],
          })
        : [],
      periodeIds.length
        ? JadwalSidangPenguji.findAll({
            where: { periode_sidang_id: { [Op.in]: periodeIds } },
            attributes: ["periode_sidang_id", "id"],
          })
        : [],
    ]);

    const statsMap = new Map();
    periodes.forEach((period) => {
      statsMap.set(Number(period.id), {
        total_pendaftaran: 0,
        submitted: 0,
        scheduled: 0,
        cancelled: 0,
        total_jadwal: 0,
      });
    });

    pendaftaranRows.forEach((row) => {
      const key = Number(row.periode_sidang_id);
      const stats = statsMap.get(key);
      if (!stats) return;
      stats.total_pendaftaran += 1;
      const status = String(row.status || "").toLowerCase();
      if (status === "submitted") stats.submitted += 1;
      else if (status === "scheduled") stats.scheduled += 1;
      else if (status === "cancelled") stats.cancelled += 1;
    });

    jadwalRows.forEach((row) => {
      const key = Number(row.periode_sidang_id);
      const stats = statsMap.get(key);
      if (!stats) return;
      stats.total_jadwal += 1;
    });

    const result = periodes.map((periode) => {
      const key = Number(periode.id);
      return {
        ...serializePeriode(periode, hariByPeriode.get(key) || [], roomByPeriode.get(key) || []),
        stats: statsMap.get(key) || {
          total_pendaftaran: 0,
          submitted: 0,
          scheduled: 0,
          cancelled: 0,
          total_jadwal: 0,
        },
      };
    });

    return res.json({
      success: true,
      data: {
        active_periode: result.find((item) => item.status === "open") || null,
        periodes: result,
      },
    });
  } catch (error) {
    console.error("Error di getSekretarisSidangOverview:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat mengambil data sidang.",
      error: error.message,
    });
  }
};

exports.createSekretarisPeriodeSidang = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const periodeType = normalizePeriodeType(req.body?.periode || req.body?.tipe_periode);
    const tahunAkademik = String(req.body?.tahun_akademik || "").trim();
    const semesterAkademik = normalizeAcademicSemester(req.body?.semester);
    const rawLabelPeriode = String(req.body?.label_periode || "").trim();
    const labelPeriode =
      rawLabelPeriode || formatPeriodeLabel(periodeType, semesterAkademik, tahunAkademik);
    const tanggalMulai = normalizeDateOnly(req.body?.tanggal_mulai_pendaftaran);
    const tanggalSelesai = normalizeDateOnly(req.body?.tanggal_selesai_pendaftaran);
    const tanggalSidangList = sanitizeDateList(req.body?.tanggal_sidang_list);
    const ruanganList = sanitizeRoomList(req.body?.ruangan_list);

    if (!periodeType) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Field periode wajib diisi (uts/uas).",
      });
    }
    if (!tahunAkademik) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Field tahun akademik wajib diisi.",
      });
    }
    if (!isValidAcademicYearRange(tahunAkademik)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Format tahun akademik tidak valid. Gunakan YYYY/YYYY dengan tahun berurutan, contoh 2025/2026.",
        field_errors: {
          tahun_akademik: "Gunakan format YYYY/YYYY dengan tahun berurutan, contoh 2025/2026.",
        },
      });
    }
    if (!semesterAkademik) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Field semester wajib diisi (ganjil/genap).",
      });
    }
    if (!labelPeriode) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Label periode sidang tidak valid.",
      });
    }
    if (!tanggalMulai || !tanggalSelesai || tanggalMulai > tanggalSelesai) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Tanggal pendaftaran sidang tidak valid.",
      });
    }
    const already = await PeriodeSidang.findOne({
      where: { label_periode: labelPeriode },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (already) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: `Periode belum valid: Periode ${semesterAkademik === "ganjil" ? "Ganjil" : "Genap"} ${tahunAkademik} sudah ada.`,
      });
    }

    const periode = await PeriodeSidang.create(
      {
        label_periode: labelPeriode,
        periode: periodeType,
        tahun_akademik: tahunAkademik,
        semester: semesterAkademik,
        tanggal_mulai_pendaftaran: tanggalMulai,
        tanggal_selesai_pendaftaran: tanggalSelesai,
        status: "draft",
        catatan: String(req.body?.catatan || "").trim() || null,
        created_by_sekretaris_id: req.user?.sekretaris_prodi_id || null,
      },
      { transaction }
    );

    if (tanggalSidangList.length > 0) {
      await PeriodeSidangHari.bulkCreate(
        tanggalSidangList.map((tanggal) => ({
          periode_sidang_id: periode.id,
          tanggal_sidang: tanggal,
        })),
        { transaction }
      );
    }

    if (ruanganList.length > 0) {
      await PeriodeSidangRuangan.bulkCreate(
        ruanganList.map((ruangan) => ({
          periode_sidang_id: periode.id,
          nama_ruangan: ruangan,
        })),
        { transaction }
      );
    }

    await transaction.commit();

    return res.json({
      success: true,
      message: `Periode sidang ${labelPeriode} berhasil dibuat.`,
      data: {
        periode: {
          id: periode.id,
          label_periode: periode.label_periode,
          periode: periode.periode,
          tahun_akademik: periode.tahun_akademik,
          semester: periode.semester,
          tanggal_mulai_pendaftaran: periode.tanggal_mulai_pendaftaran,
          tanggal_selesai_pendaftaran: periode.tanggal_selesai_pendaftaran,
          status: periode.status,
          tanggal_sidang_list: tanggalSidangList,
          ruangan_list: ruanganList,
        },
      },
    });
  } catch (error) {
    try {
      await transaction.rollback();
    } catch (rollbackError) {
      // no-op
    }
    console.error("Error di createSekretarisPeriodeSidang:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat membuat periode sidang.",
      error: error.message,
    });
  }
};

exports.discardSekretarisPeriodeSidangDraft = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const periodeId = Number(req.params.id);
    if (!Number.isInteger(periodeId) || periodeId <= 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "ID periode sidang tidak valid.",
      });
    }

    const periode = await PeriodeSidang.findByPk(periodeId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!periode) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Draft periode sidang tidak ditemukan.",
      });
    }

    if (String(periode.status || "").toLowerCase() !== "draft") {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: "Periode sidang yang sudah dibuka atau ditutup tidak dapat dibatalkan sebagai draft.",
      });
    }

    const currentSekretarisId = Number(req.user?.sekretaris_prodi_id || 0);
    const creatorSekretarisId = Number(periode.created_by_sekretaris_id || 0);
    if (currentSekretarisId && creatorSekretarisId && currentSekretarisId !== creatorSekretarisId) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: "Draft periode sidang ini dibuat oleh Sekretaris Prodi lain.",
      });
    }

    const registrationCount = await PendaftaranSidang.count({
      where: { periode_sidang_id: periode.id },
      transaction,
    });
    if (registrationCount > 0) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: "Draft tidak dapat dibatalkan karena sudah memiliki data pendaftaran sidang.",
      });
    }

    await periode.destroy({ transaction });
    await transaction.commit();

    return res.json({
      success: true,
      message: "Draft periode sidang dibatalkan. Proses pembukaan dapat dimulai kembali dari awal.",
    });
  } catch (error) {
    try {
      await transaction.rollback();
    } catch (rollbackError) {
      // no-op
    }
    console.error("Error di discardSekretarisPeriodeSidangDraft:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat membatalkan draft periode sidang.",
      error: error.message,
    });
  }
};

exports.updateSekretarisPeriodeSidang = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const periodeId = Number(req.params.id);
    if (!periodeId) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "ID periode sidang tidak valid.",
      });
    }

    const periode = await PeriodeSidang.findByPk(periodeId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!periode) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Periode sidang tidak ditemukan.",
      });
    }

    if (String(periode.status || "").toLowerCase() === "closed") {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: "Periode sidang yang sudah closed tidak bisa diubah.",
      });
    }

    const periodeType = normalizePeriodeType(req.body?.periode || req.body?.tipe_periode || periode.periode);
    const tahunAkademik = String(req.body?.tahun_akademik || periode.tahun_akademik || "").trim();
    const semesterAkademik = normalizeAcademicSemester(req.body?.semester || periode.semester);
    const tanggalMulai = normalizeDateOnly(req.body?.tanggal_mulai_pendaftaran || periode.tanggal_mulai_pendaftaran);
    const tanggalSelesai = normalizeDateOnly(req.body?.tanggal_selesai_pendaftaran || periode.tanggal_selesai_pendaftaran);
    if (!tanggalMulai || !tanggalSelesai || tanggalMulai > tanggalSelesai) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Rentang tanggal pendaftaran tidak valid.",
      });
    }
    if (!periodeType) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Field periode wajib diisi (uts/uas).",
      });
    }
    if (!tahunAkademik) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Field tahun akademik wajib diisi.",
      });
    }
    if (!isValidAcademicYearRange(tahunAkademik)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Format tahun akademik tidak valid. Gunakan YYYY/YYYY dengan tahun berurutan, contoh 2025/2026.",
        field_errors: {
          tahun_akademik: "Gunakan format YYYY/YYYY dengan tahun berurutan, contoh 2025/2026.",
        },
      });
    }
    if (!semesterAkademik) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Field semester wajib diisi (ganjil/genap).",
      });
    }

    const nextLabel = String(
      req.body?.label_periode || formatPeriodeLabel(periodeType, semesterAkademik, tahunAkademik)
    ).trim();
    if (!nextLabel) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Label periode sidang wajib diisi.",
      });
    }

    const duplicate = await PeriodeSidang.findOne({
      where: {
        id: { [Op.ne]: periode.id },
        label_periode: nextLabel,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (duplicate) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: `Periode belum valid: Periode ${semesterAkademik === "ganjil" ? "Ganjil" : "Genap"} ${tahunAkademik} sudah ada.`,
      });
    }

    periode.label_periode = nextLabel;
    periode.periode = periodeType;
    periode.tahun_akademik = tahunAkademik;
    periode.semester = semesterAkademik;
    periode.tanggal_mulai_pendaftaran = tanggalMulai;
    periode.tanggal_selesai_pendaftaran = tanggalSelesai;
    periode.catatan = String(req.body?.catatan || periode.catatan || "").trim() || null;
    await periode.save({ transaction });

    if (Array.isArray(req.body?.tanggal_sidang_list)) {
      const nextDates = sanitizeDateList(req.body?.tanggal_sidang_list);
      if (nextDates.length === 0) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "Pilih minimal 1 tanggal sidang.",
        });
      }
      const schedulesOnRemovedDates = await JadwalSidangPenguji.findAll({
        where: {
          periode_sidang_id: periode.id,
          tanggal_sidang: { [Op.notIn]: nextDates },
        },
        attributes: ["tanggal_sidang"],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (schedulesOnRemovedDates.length > 0) {
        const protectedDates = Array.from(new Set(
          schedulesOnRemovedDates.map((item) => String(item.tanggal_sidang))
        )).sort();
        await transaction.rollback();
        return res.status(409).json({
          success: false,
          message: `Hari sidang ${protectedDates.join(", ")} tidak dapat dihapus karena sudah memiliki jadwal dan dosen penguji.`,
          field_errors: {
            tanggal_sidang_list: "Hari yang sudah memiliki jadwal sidang tidak dapat dihapus.",
          },
          protected_dates: protectedDates,
        });
      }
      await PeriodeSidangHari.destroy({
        where: { periode_sidang_id: periode.id },
        transaction,
      });
      await PeriodeSidangHari.bulkCreate(
        nextDates.map((tanggal) => ({
          periode_sidang_id: periode.id,
          tanggal_sidang: tanggal,
        })),
        { transaction }
      );
    }

    if (Array.isArray(req.body?.ruangan_list)) {
      const nextRooms = sanitizeRoomList(req.body?.ruangan_list);
      if (nextRooms.length === 0) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "Pilih minimal 1 ruangan sidang.",
        });
      }
      await PeriodeSidangRuangan.destroy({
        where: { periode_sidang_id: periode.id },
        transaction,
      });
      await PeriodeSidangRuangan.bulkCreate(
        nextRooms.map((namaRuangan) => ({
          periode_sidang_id: periode.id,
          nama_ruangan: namaRuangan,
        })),
        { transaction }
      );
    }

    await transaction.commit();
    return res.json({
      success: true,
      message: "Periode sidang berhasil diperbarui.",
    });
  } catch (error) {
    try {
      await transaction.rollback();
    } catch (rollbackError) {
      // no-op
    }
    console.error("Error di updateSekretarisPeriodeSidang:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat memperbarui periode sidang.",
      error: error.message,
    });
  }
};

exports.openSekretarisPeriodeSidang = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const periodeId = Number(req.params.id);
    if (!periodeId) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "ID periode sidang tidak valid.",
      });
    }

    const periode = await PeriodeSidang.findByPk(periodeId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!periode) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Periode sidang tidak ditemukan.",
      });
    }

    if (String(periode.status || "").toLowerCase() === "closed") {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: "Periode sidang yang sudah ditutup tidak dapat dibuka kembali.",
        detail: { code: "DEFENSE_PERIOD_ALREADY_CLOSED" },
      });
    }

    const openOther = await PeriodeSidang.findOne({
      where: {
        status: "open",
        id: { [Op.ne]: periode.id },
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (openOther) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: `Masih ada periode sidang open (${openOther.label_periode}). Tutup dulu sebelum membuka periode lain.`,
      });
    }

    const [hariCount, roomCount] = await Promise.all([
      PeriodeSidangHari.count({ where: { periode_sidang_id: periode.id }, transaction }),
      PeriodeSidangRuangan.count({ where: { periode_sidang_id: periode.id }, transaction }),
    ]);
    if (hariCount === 0 || roomCount === 0) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: "Periode sidang harus punya minimal 1 hari dan 1 ruangan sebelum dibuka.",
      });
    }

    const examinerReadiness = await getExaminerProfileReadiness(transaction);
    if (examinerReadiness.eligibleDosens.length < 2) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: "Periode belum dapat dibuka karena minimal diperlukan 2 dosen aktif sebagai calon penguji.",
        detail: { code: "INSUFFICIENT_ELIGIBLE_EXAMINERS" },
      });
    }
    if (examinerReadiness.unconfigured.length > 0) {
      const names = examinerReadiness.unconfigured.slice(0, 5).map((dosen) => dosen.nama).join(", ");
      const remainder = Math.max(examinerReadiness.unconfigured.length - 5, 0);
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: `Profil penilaian calon penguji belum lengkap: ${names}${remainder ? `, dan ${remainder} dosen lainnya` : ""}. Atur melalui Master Dosen > Profil Penguji.`,
        detail: {
          code: "EXAMINER_PROFILE_INCOMPLETE",
          unconfigured_dosens: examinerReadiness.unconfigured.map((dosen) => ({
            id: dosen.id,
            kode_dosen: dosen.kode_dosen,
            nik: dosen.nik,
            nama: dosen.nama,
            gelar: dosen.gelar,
          })),
        },
      });
    }
    if (examinerReadiness.supportiveCount < 1) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: "Periode belum dapat dibuka karena minimal satu dosen aktif harus memiliki profil Suportif.",
        detail: { code: "SUPPORTIVE_EXAMINER_REQUIRED" },
      });
    }

    periode.status = "open";
    periode.activated_at = new Date(nowJakartaDateTime().datetime);
    periode.closed_at = null;
    await periode.save({ transaction });

    await transaction.commit();
    return res.json({
      success: true,
      message: `Periode sidang ${periode.label_periode} berhasil dibuka.`,
    });
  } catch (error) {
    try {
      await transaction.rollback();
    } catch (rollbackError) {
      // no-op
    }
    console.error("Error di openSekretarisPeriodeSidang:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat membuka periode sidang.",
      error: error.message,
    });
  }
};

exports.closeSekretarisPeriodeSidang = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const periodeId = Number(req.params.id);
    if (!periodeId) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "ID periode sidang tidak valid.",
      });
    }
    const periode = await PeriodeSidang.findByPk(periodeId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!periode) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Periode sidang tidak ditemukan.",
      });
    }
    if (String(periode.status || "").toLowerCase() === "closed") {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: "Periode sidang ini sudah closed.",
      });
    }

    periode.status = "closed";
    periode.closed_at = new Date(nowJakartaDateTime().datetime);
    await periode.save({ transaction });

    await transaction.commit();
    return res.json({
      success: true,
      message: `Periode sidang ${periode.label_periode} berhasil ditutup.`,
    });
  } catch (error) {
    try {
      await transaction.rollback();
    } catch (rollbackError) {
      // no-op
    }
    console.error("Error di closeSekretarisPeriodeSidang:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat menutup periode sidang.",
      error: error.message,
    });
  }
};

exports.getSekretarisSidangQueue = async (req, res) => {
  try {
    const periodeSidangId = Number(req.query?.periode_sidang_id || 0);
    let targetPeriode = null;
    if (periodeSidangId > 0) {
      targetPeriode = await PeriodeSidang.findByPk(periodeSidangId);
    } else {
      targetPeriode =
        (await getOpenPeriodeSidang()) ||
        (await PeriodeSidang.findOne({
          order: [["updatedAt", "DESC"]],
        }));
    }

    if (!targetPeriode) {
      return res.json({
        success: true,
        data: {
          periode_sidang: null,
          rows: [],
        },
      });
    }

    const [rows, hariRows, availabilityRows, preferenceRows] = await Promise.all([
      PendaftaranSidang.findAll({
        where: { periode_sidang_id: targetPeriode.id },
        include: [
          {
            model: Mahasiswa,
            as: "mahasiswa",
            attributes: ["id", "nim", "nama", "angkatan", "email"],
          },
          {
            model: Dosen,
            as: "dosenPembimbing",
            attributes: ["id", "nama", "nik", "gelar"],
          },
          {
            model: JadwalSidangPenguji,
            as: "jadwalSidang",
            include: [
              { model: Dosen, as: "penguji1", attributes: ["id", "nama", "nik", "gelar"] },
              { model: Dosen, as: "penguji2", attributes: ["id", "nama", "nik", "gelar"] },
            ],
          },
        ],
        order: [["registered_at", "ASC"]],
      }),
      PeriodeSidangHari.findAll({
        where: { periode_sidang_id: targetPeriode.id },
        order: [["tanggal_sidang", "ASC"]],
      }),
      KetersediaanPengujiSidang.findAll({
        where: { periode_sidang_id: targetPeriode.id },
        include: [{
          model: Dosen,
          as: "dosen",
          attributes: ["id", "nama", "nik", "kode_dosen", "gelar", "email", "profil_penilaian_penguji"],
        }],
        order: [["dosen_id", "ASC"], ["tanggal_sidang", "ASC"], ["sesi_ke", "ASC"]],
      }),
      PreferensiPengujiSidang.findAll({
        where: { periode_sidang_id: targetPeriode.id },
      }),
    ]);

    const preferenceByDosenId = new Map(
      preferenceRows.map((item) => [Number(item.dosen_id), item])
    );
    const availableDosenMap = new Map();
    availabilityRows.forEach((item) => {
      const dosenId = Number(item.dosen_id);
      if (!availableDosenMap.has(dosenId)) {
        const preference = preferenceByDosenId.get(dosenId) || null;
        availableDosenMap.set(dosenId, {
          id: dosenId,
          nama: item.dosen?.nama || "-",
          gelar: item.dosen?.gelar || null,
          nik: item.dosen?.nik || null,
          kode_dosen: item.dosen?.kode_dosen || null,
          email: item.dosen?.email || null,
          profil_penilaian_penguji: item.dosen?.profil_penilaian_penguji || null,
          jumlah_slot_tersedia: 0,
          tanggal_tersedia: [],
          slot_tersedia: [],
          preferensi: preference
            ? {
                mobilitas_ruangan: preference.mobilitas_ruangan,
                maksimal_sesi_per_hari: preference.maksimal_sesi_per_hari,
                membutuhkan_jeda: preference.membutuhkan_jeda,
                submitted_at: preference.submitted_at,
              }
            : null,
        });
      }
      const target = availableDosenMap.get(dosenId);
      target.jumlah_slot_tersedia += 1;
      if (!target.tanggal_tersedia.includes(String(item.tanggal_sidang))) {
        target.tanggal_tersedia.push(String(item.tanggal_sidang));
      }
      target.slot_tersedia.push({
        tanggal_sidang: item.tanggal_sidang,
        sesi_ke: item.sesi_ke,
        kondisi_fisik: item.kondisi_fisik,
      });
    });

    const enrichedRows = await Promise.all(
      rows.map(async (row) => {
        const mahasiswaId = Number(row.mahasiswa_id || row.mahasiswa?.id || 0);
        const [latestPengajuan, latestPendaftaranPenjaluran] = await Promise.all([
          Pengajuan.findOne({
            where: { mahasiswa_id: mahasiswaId },
            attributes: [
              "id",
              "status",
              "jenis_jalur",
              "tipe_pengajuan",
              "judul_mandiri",
              "topik_1_judul",
              "topik_2_judul",
              "topik_3_judul",
              "updatedAt",
            ],
            order: [["updatedAt", "DESC"]],
          }),
          PendaftaranPenjaluran.findOne({
            where: { mahasiswa_id: mahasiswaId },
            attributes: ["id", "program_kuliah", "semester_mahasiswa", "jalur", "jenis_jalur_diambil", "penjaluran_baru", "createdAt"],
            include: [
              {
                model: PeriodePenjaluran,
                as: "periode",
                attributes: ["id", "label_periode", "tahun_akademik", "semester"],
              },
            ],
            order: [["createdAt", "DESC"]],
          }),
        ]);

        return {
          id: row.id,
          status: row.status,
          registered_at: row.registered_at,
          assigned_at: row.assigned_at,
          catatan: row.catatan,
          judul_skripsi: resolveJudulSkripsiFromPengajuan(latestPengajuan),
          semester_penjaluran: latestPendaftaranPenjaluran?.semester_mahasiswa || null,
          program_kuliah: latestPendaftaranPenjaluran?.program_kuliah || "reguler",
          mahasiswa: row.mahasiswa
            ? {
                id: row.mahasiswa.id,
                nim: row.mahasiswa.nim,
                nama: row.mahasiswa.nama,
                angkatan: row.mahasiswa.angkatan,
                email: row.mahasiswa.email,
              }
            : null,
          dosen_pembimbing: row.dosenPembimbing
            ? {
                id: row.dosenPembimbing.id,
                nama: row.dosenPembimbing.nama,
                nik: row.dosenPembimbing.nik,
              }
            : null,
          jadwal_sidang: serializeJadwalRow(row.jadwalSidang),
        };
      })
    );

    return res.json({
      success: true,
      data: {
        periode_sidang: {
          id: targetPeriode.id,
          label_periode: targetPeriode.label_periode,
          periode: targetPeriode.periode,
          tahun_akademik: targetPeriode.tahun_akademik,
          semester: targetPeriode.semester,
          tanggal_mulai_pendaftaran: targetPeriode.tanggal_mulai_pendaftaran,
          tanggal_selesai_pendaftaran: targetPeriode.tanggal_selesai_pendaftaran,
          status: targetPeriode.status,
        },
        hari_sidang: hariRows.map((item) => ({
          tanggal_sidang: item.tanggal_sidang,
          sesi: getSessionTemplateByDate(item.tanggal_sidang),
        })),
        dosen_tersedia: Array.from(availableDosenMap.values()),
        rows: enrichedRows.filter(
          (row) => row.program_kuliah === req.user?.program_kuliah
        ),
      },
    });
  } catch (error) {
    console.error("Error di getSekretarisSidangQueue:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat memuat antrian sidang.",
      error: error.message,
    });
  }
};

exports.getSekretarisSidangRegistrantDetail = async (req, res) => {
  try {
    const registrationId = Number(req.params.id || 0);
    if (!registrationId) {
      return res.status(400).json({
        success: false,
        message: "ID pendaftaran sidang tidak valid.",
      });
    }

    const registration = await PendaftaranSidang.findByPk(registrationId, {
      include: [
        {
          model: Mahasiswa,
          as: "mahasiswa",
          attributes: [
            "id",
            "nim",
            "nama",
            "email",
            "angkatan",
            "status_jalur_saat_ini",
            "dosen_pembimbing_skripsi_id",
          ],
          include: [
            {
              model: Dosen,
              as: "dosenPembimbingSkripsi",
              attributes: ["id", "nama", "nik", "email"],
            },
          ],
        },
        {
          model: Dosen,
          as: "dosenPembimbing",
          attributes: ["id", "nama", "nik", "email"],
        },
        {
          model: PeriodeSidang,
          as: "periodeSidang",
          attributes: [
            "id",
            "label_periode",
            "periode",
            "tahun_akademik",
            "semester",
            "tanggal_mulai_pendaftaran",
            "tanggal_selesai_pendaftaran",
            "status",
          ],
        },
        {
          model: JadwalSidangPenguji,
          as: "jadwalSidang",
          include: [
            { model: Dosen, as: "penguji1", attributes: ["id", "nama", "nik"] },
            { model: Dosen, as: "penguji2", attributes: ["id", "nama", "nik"] },
          ],
        },
      ],
    });

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: "Data pendaftaran sidang tidak ditemukan.",
      });
    }

    const mahasiswaId = Number(registration.mahasiswa_id || 0);
    const [latestPengajuan, latestPendaftaranPenjaluran, eligibility] = await Promise.all([
      Pengajuan.findOne({
        where: { mahasiswa_id: mahasiswaId },
        attributes: [
          "id",
          "status",
          "jenis_jalur",
          "tipe_pengajuan",
          "judul_mandiri",
          "topik_1_kode",
          "topik_1_judul",
          "topik_2_kode",
          "topik_2_judul",
          "topik_3_kode",
          "topik_3_judul",
          "updatedAt",
        ],
        order: [["updatedAt", "DESC"]],
      }),
      PendaftaranPenjaluran.findOne({
        where: { mahasiswa_id: mahasiswaId },
        attributes: [
          "id",
          "program_kuliah",
          "jalur",
          "semester_mahasiswa",
          "jenis_jalur_diambil",
          "penjaluran_sebelumnya",
          "penjaluran_baru",
          "createdAt",
        ],
        include: [
          {
            model: PeriodePenjaluran,
            as: "periode",
            attributes: ["id", "label_periode", "tahun_akademik", "semester"],
          },
        ],
        order: [["createdAt", "DESC"]],
      }),
      getMahasiswaSidangEligibility(mahasiswaId),
    ]);

    if (
      (latestPendaftaranPenjaluran?.program_kuliah || "reguler") !==
      req.user?.program_kuliah
    ) {
      return res.status(404).json({
        success: false,
        message: "Data pendaftaran sidang tidak ditemukan.",
      });
    }

    return res.json({
      success: true,
      data: {
        pendaftaran_sidang: {
          id: registration.id,
          status: registration.status,
          registered_at: registration.registered_at,
          assigned_at: registration.assigned_at,
          catatan: registration.catatan,
        },
        periode_sidang: registration.periodeSidang
          ? {
              id: registration.periodeSidang.id,
              label_periode: registration.periodeSidang.label_periode,
              periode: registration.periodeSidang.periode,
              tahun_akademik: registration.periodeSidang.tahun_akademik,
              semester: registration.periodeSidang.semester,
              tanggal_mulai_pendaftaran: registration.periodeSidang.tanggal_mulai_pendaftaran,
              tanggal_selesai_pendaftaran: registration.periodeSidang.tanggal_selesai_pendaftaran,
              status: registration.periodeSidang.status,
            }
          : null,
        mahasiswa: registration.mahasiswa
          ? {
              id: registration.mahasiswa.id,
              nim: registration.mahasiswa.nim,
              nama: registration.mahasiswa.nama,
              email: registration.mahasiswa.email,
              angkatan: registration.mahasiswa.angkatan,
              status_jalur_saat_ini: registration.mahasiswa.status_jalur_saat_ini,
            }
          : null,
        dosen_pembimbing: registration.dosenPembimbing
          ? {
              id: registration.dosenPembimbing.id,
              nama: registration.dosenPembimbing.nama,
              nik: registration.dosenPembimbing.nik,
              email: registration.dosenPembimbing.email,
            }
          : registration.mahasiswa?.dosenPembimbingSkripsi
          ? {
              id: registration.mahasiswa.dosenPembimbingSkripsi.id,
              nama: registration.mahasiswa.dosenPembimbingSkripsi.nama,
              nik: registration.mahasiswa.dosenPembimbingSkripsi.nik,
              email: registration.mahasiswa.dosenPembimbingSkripsi.email,
            }
          : null,
        pengajuan_skripsi: latestPengajuan
          ? {
              id: latestPengajuan.id,
              status: latestPengajuan.status,
              jenis_jalur: latestPengajuan.jenis_jalur,
              tipe_pengajuan: latestPengajuan.tipe_pengajuan,
              judul_skripsi: resolveJudulSkripsiFromPengajuan(latestPengajuan),
              updated_at: latestPengajuan.updatedAt,
            }
          : null,
        penjaluran_terakhir: latestPendaftaranPenjaluran
          ? {
              id: latestPendaftaranPenjaluran.id,
              program_kuliah: latestPendaftaranPenjaluran.program_kuliah,
              jalur: latestPendaftaranPenjaluran.jalur,
              semester_mahasiswa: latestPendaftaranPenjaluran.semester_mahasiswa,
              jenis_jalur_diambil: latestPendaftaranPenjaluran.jenis_jalur_diambil,
              penjaluran_baru: latestPendaftaranPenjaluran.penjaluran_baru,
              penjaluran_sebelumnya: latestPendaftaranPenjaluran.penjaluran_sebelumnya,
              periode: latestPendaftaranPenjaluran.periode
                ? {
                    id: latestPendaftaranPenjaluran.periode.id,
                    label_periode: latestPendaftaranPenjaluran.periode.label_periode,
                    tahun_akademik: latestPendaftaranPenjaluran.periode.tahun_akademik,
                    semester: latestPendaftaranPenjaluran.periode.semester,
                  }
                : null,
            }
          : null,
        bimbingan_progress: eligibility,
        jadwal_sidang: serializeJadwalRow(registration.jadwalSidang),
      },
    });
  } catch (error) {
    console.error("Error di getSekretarisSidangRegistrantDetail:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat memuat detail pendaftar sidang.",
      error: error.message,
    });
  }
};

exports.autoAssignSidangPenguji = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const shouldCommit = req.body?.commit === true;
    const periodeSidangId = Number(req.body?.periode_sidang_id || req.query?.periode_sidang_id || 0);
    if (!periodeSidangId) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "periode_sidang_id wajib diisi.",
      });
    }

    const periode = await PeriodeSidang.findByPk(periodeSidangId, {
      transaction,
      ...(shouldCommit ? { lock: transaction.LOCK.UPDATE } : {}),
    });
    if (!periode) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Periode sidang tidak ditemukan.",
      });
    }

    if (String(periode.status || "").toLowerCase() !== "open") {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: "Assign dosen penguji hanya dapat dilakukan pada periode sidang aktif.",
      });
    }

    const [hariRows, roomRows] = await Promise.all([
      PeriodeSidangHari.findAll({
        where: { periode_sidang_id: periode.id },
        transaction,
      }),
      PeriodeSidangRuangan.findAll({
        where: { periode_sidang_id: periode.id },
        transaction,
      }),
    ]);

    if (hariRows.length === 0 || roomRows.length === 0) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: "Belum ada konfigurasi hari atau ruangan sidang pada periode ini.",
      });
    }

    const slots = buildSessionSlots(hariRows, roomRows);
    if (slots.length === 0) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: "Tidak ada slot sidang valid pada tanggal yang dipilih.",
      });
    }

    const rawPendingRegistrations = await PendaftaranSidang.findAll({
      where: {
        periode_sidang_id: periode.id,
        status: "submitted",
      },
      include: [
        {
          model: Mahasiswa,
          as: "mahasiswa",
          attributes: ["id", "nim", "nama", "dosen_pembimbing_skripsi_id"],
        },
      ],
      transaction,
      ...(shouldCommit
        ? { lock: { level: transaction.LOCK.UPDATE, of: PendaftaranSidang } }
        : {}),
      order: [["registered_at", "ASC"], ["id", "ASC"]],
    });

    const rawStudentIds = [...new Set(rawPendingRegistrations.map((item) => Number(item.mahasiswa_id)).filter(Boolean))];
    const penjaluranRows = rawStudentIds.length
      ? await PendaftaranPenjaluran.findAll({
          where: { mahasiswa_id: { [Op.in]: rawStudentIds } },
          attributes: ["id", "mahasiswa_id", "program_kuliah", "jenis_jalur_diambil", "penjaluran_baru", "catatan", "form_lanjutan_payload", "createdAt"],
          order: [["createdAt", "DESC"], ["id", "DESC"]],
          transaction,
        })
      : [];
    const latestPenjaluranByStudent = new Map();
    penjaluranRows.forEach((item) => {
      const mahasiswaId = Number(item.mahasiswa_id);
      if (!latestPenjaluranByStudent.has(mahasiswaId)) latestPenjaluranByStudent.set(mahasiswaId, item);
    });
    let pendingRegistrations = rawPendingRegistrations.filter((item) =>
      String(latestPenjaluranByStudent.get(Number(item.mahasiswa_id))?.program_kuliah || "reguler")
        === String(req.user?.program_kuliah || "reguler")
    );

    if (Array.isArray(req.body?.pendaftaran_sidang_ids)) {
      const requestedRegistrationIds = [...new Set(
        req.body.pendaftaran_sidang_ids.map(Number).filter((id) => Number.isInteger(id) && id > 0)
      )];
      if (requestedRegistrationIds.length === 0) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "Pilih minimal satu mahasiswa yang akan diproses.",
        });
      }
      const availableRegistrationIds = new Set(pendingRegistrations.map((item) => Number(item.id)));
      const hasUnavailableRegistration = requestedRegistrationIds.some((id) => !availableRegistrationIds.has(id));
      if (hasUnavailableRegistration) {
        await transaction.rollback();
        return res.status(409).json({
          success: false,
          message: "Salah satu mahasiswa yang dipilih sudah tidak tersedia untuk penjadwalan. Muat ulang data lalu pilih kembali.",
        });
      }
      const requestedIdSet = new Set(requestedRegistrationIds);
      pendingRegistrations = pendingRegistrations.filter((item) => requestedIdSet.has(Number(item.id)));
    }

    if (pendingRegistrations.length === 0) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: "Tidak ada pendaftar sidang yang menunggu penjadwalan.",
      });
    }

    let requestedAssignmentByRegistrationId = null;
    if (shouldCommit && Array.isArray(req.body?.assignments)) {
      requestedAssignmentByRegistrationId = new Map();
      for (const item of req.body.assignments) {
        const registrationId = Number(item?.pendaftaran_sidang_id || 0);
        if (!registrationId || requestedAssignmentByRegistrationId.has(registrationId)) {
          await transaction.rollback();
          return res.status(400).json({
            success: false,
            message: "Data hasil penugasan mengandung pendaftaran yang tidak valid atau duplikat.",
            detail: { code: "INVALID_ASSIGNMENT_DRAFT" },
          });
        }
        requestedAssignmentByRegistrationId.set(registrationId, {
          tanggal_sidang: normalizeDateOnly(item?.tanggal_sidang),
          sesi_ke: Number(item?.sesi_ke || 0),
          ruangan: String(item?.ruangan || "").trim(),
          penguji1_dosen_id: Number(item?.penguji1_dosen_id || 0),
          penguji2_dosen_id: Number(item?.penguji2_dosen_id || 0),
        });
      }
      const pendingRegistrationIds = new Set(pendingRegistrations.map((item) => Number(item.id)));
      const hasUnknownRegistration = [...requestedAssignmentByRegistrationId.keys()]
        .some((id) => !pendingRegistrationIds.has(id));
      if (hasUnknownRegistration || requestedAssignmentByRegistrationId.size !== pendingRegistrationIds.size) {
        await transaction.rollback();
        return res.status(409).json({
          success: false,
          message: "Draft penugasan sudah tidak sesuai dengan daftar pendaftar terbaru. Jalankan Assign Dosen Penguji kembali.",
          detail: { code: "STALE_ASSIGNMENT_DRAFT" },
        });
      }
    }

    const availabilityRows = await KetersediaanPengujiSidang.findAll({ where: { periode_sidang_id: periode.id }, transaction });
    const eligibleDosens = await Dosen.findAll({
      where: { status_keaktifan: "active" },
      attributes: ["id", "nama", "nik", "gelar", "profil_penilaian_penguji"],
      transaction,
    });
    const eligibleIds = new Set(eligibleDosens.map((item) => Number(item.id)));
    const filteredAvailabilityRows = availabilityRows.filter((item) => eligibleIds.has(Number(item.dosen_id)));
    const availableDosenIds = [...new Set(filteredAvailabilityRows.map((item) => Number(item.dosen_id)).filter(Boolean))];
    if (availableDosenIds.length === 0) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: "Belum ada dosen yang mengisi ketersediaan sidang pada periode ini.",
        detail: { code: "NO_EXAMINER_AVAILABILITY", available_examiner_count: 0, required_examiner_count: 2 },
      });
    }
    if (availableDosenIds.length < 2) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: `Dosen yang mengisi ketersediaan baru ${availableDosenIds.length}. Minimal diperlukan 2 dosen penguji.`,
        detail: { code: "INSUFFICIENT_EXAMINERS", available_examiner_count: availableDosenIds.length, required_examiner_count: 2 },
      });
    }

    const availableIdSet = new Set(availableDosenIds);
    const availableDosens = eligibleDosens.filter((item) => availableIdSet.has(Number(item.id)));
    const unconfiguredExaminers = availableDosens.filter(
      (item) => !VALID_EXAMINER_PROFILES.has(String(item.profil_penilaian_penguji || ""))
    );
    if (unconfiguredExaminers.length > 0) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: "Auto Assign tidak dapat dijalankan karena masih ada profil penilaian calon penguji yang belum diatur.",
        detail: {
          code: "EXAMINER_PROFILE_INCOMPLETE",
          unconfigured_dosens: unconfiguredExaminers.map((item) => ({ id: item.id, nama: item.nama })),
        },
      });
    }
    const profileByDosenId = new Map(
      availableDosens.map((item) => [Number(item.id), item.profil_penilaian_penguji])
    );
    const supervisorIds = [...new Set(pendingRegistrations.map((item) => Number(
      item.dosen_pembimbing_id || item.mahasiswa?.dosen_pembimbing_skripsi_id || 0
    )).filter(Boolean))];
    const supervisorRows = supervisorIds.length > 0
      ? await Dosen.findAll({
          where: { id: { [Op.in]: supervisorIds } },
          attributes: ["id", "nama", "status_keaktifan", "continue_existing_supervision"],
          transaction,
        })
      : [];
    const supervisorCanAttend = new Map(
      supervisorRows.map((item) => [Number(item.id), canContinueExistingSupervision(item)])
    );
    const availabilityBySlot = mapAvailabilityRows(filteredAvailabilityRows, profileByDosenId);
    const studentIds = pendingRegistrations.map((item) => Number(item.mahasiswa_id));
    const [assignedRows, preferenceRows, dosenFieldRows, pengajuanRows] = await Promise.all([
      JadwalSidangPenguji.findAll({
      where: {
        periode_sidang_id: periode.id,
        assignment_status: { [Op.in]: ["assigned", "finalized"] },
      },
      transaction,
        ...(shouldCommit ? { lock: transaction.LOCK.UPDATE } : {}),
      }),
      PreferensiPengujiSidang.findAll({ where: { periode_sidang_id: periode.id, dosen_id: { [Op.in]: availableDosenIds } }, transaction }),
      DosenBidangPenelitian.findAll({
        where: { dosen_id: { [Op.in]: availableDosenIds } },
        include: [{ association: "bidangPenelitian", attributes: ["id", "nama", "deskripsi"] }],
        transaction,
      }),
      Pengajuan.findAll({
        where: {
          mahasiswa_id: { [Op.in]: studentIds },
          status: { [Op.in]: ["approved", "completed"] },
        },
        attributes: ["id", "mahasiswa_id", "tipe_pengajuan", "status", "judul_mandiri", "deskripsi_mandiri", "topik_1_kode", "topik_1_judul", "topik_2_kode", "topik_2_judul", "topik_3_kode", "topik_3_judul", "updatedAt"],
        include: [{ association: "riwayat", attributes: ["id", "status", "tipe_approval", "topik_slot", "topik_kode", "keterangan", "tanggal_keputusan", "createdAt"], required: false }],
        order: [["updatedAt", "DESC"], ["id", "DESC"]],
        transaction,
      }),
    ]);

    const latestPengajuanByStudent = new Map();
    pengajuanRows.forEach((item) => {
      const mahasiswaId = Number(item.mahasiswa_id);
      if (!latestPengajuanByStudent.has(mahasiswaId)) latestPengajuanByStudent.set(mahasiswaId, item);
    });
    const pengajuanIds = [...latestPengajuanByStudent.values()].map((item) => Number(item.id));
    const finalTopikCodes = [...new Set([...latestPengajuanByStudent.values()]
      .map((item) => resolveFinalTopikFromPengajuan(item)?.kode)
      .map((item) => String(item || "").trim().toUpperCase())
      .filter(Boolean))];
    const [pengajuanFieldRows, finalTopikRows] = await Promise.all([
      pengajuanIds.length ? PengajuanBidangPenelitian.findAll({
          where: { pengajuan_id: { [Op.in]: pengajuanIds } },
          include: [{ association: "bidangPenelitian", attributes: ["id", "nama", "deskripsi"] }],
          transaction,
        }) : [],
      finalTopikCodes.length ? Topik.findAll({
        where: { kode: { [Op.in]: finalTopikCodes } },
        attributes: ["kode", "judul", "deskripsi"],
        include: [{ association: "bidangPenelitians", attributes: ["id", "nama", "deskripsi"], through: { attributes: [] }, required: false }],
        transaction,
      }) : [],
    ]);
    const finalTopikByCode = new Map(finalTopikRows.map((item) => [String(item.kode || "").trim().toUpperCase(), item]));

    const preferenceByDosenId = new Map(preferenceRows.map((item) => [Number(item.dosen_id), item]));
    const lecturerFields = new Map();
    dosenFieldRows.forEach((item) => {
      const dosenId = Number(item.dosen_id);
      if (!lecturerFields.has(dosenId)) lecturerFields.set(dosenId, []);
      if (item.bidangPenelitian) lecturerFields.get(dosenId).push(item.bidangPenelitian);
    });
    const fieldsByPengajuanId = new Map();
    pengajuanFieldRows.forEach((item) => {
      const pengajuanId = Number(item.pengajuan_id);
      if (!fieldsByPengajuanId.has(pengajuanId)) fieldsByPengajuanId.set(pengajuanId, []);
      if (item.bidangPenelitian) fieldsByPengajuanId.get(pengajuanId).push(item.bidangPenelitian);
    });
    const lecturerProfiles = availableDosens.map((item) => {
      const fields = lecturerFields.get(Number(item.id)) || [];
      return {
        id: Number(item.id),
        nama: item.nama,
        nik: item.nik,
        gelar: item.gelar,
        profil_penilaian_penguji: item.profil_penilaian_penguji,
        researchProfile: buildResearchProfile({
          fieldIds: fields.map((field) => field.id),
          fieldTexts: fields.map((field) => field.nama),
          text: fields.map((field) => field.deskripsi).join(" "),
        }),
      };
    });

    const usedRoomSlots = new Set();
    const dosenBusyBySlot = new Map();
    const dosenDailyRoomConstraint = new Map();
    const dosenDailySessions = new Map();
    const dosenLoadCounter = new Map();

    assignedRows.forEach((row) => {
      usedRoomSlots.add(buildRoomSlotKey(row.tanggal_sidang, row.sesi_ke, row.ruangan));
      const slotKey = buildSidangSlotKey(row.tanggal_sidang, row.sesi_ke);
      if (!dosenBusyBySlot.has(slotKey)) dosenBusyBySlot.set(slotKey, new Set());
      dosenBusyBySlot.get(slotKey).add(Number(row.penguji1_dosen_id));
      dosenBusyBySlot.get(slotKey).add(Number(row.penguji2_dosen_id));
      dosenLoadCounter.set(Number(row.penguji1_dosen_id), (dosenLoadCounter.get(Number(row.penguji1_dosen_id)) || 0) + 1);
      dosenLoadCounter.set(Number(row.penguji2_dosen_id), (dosenLoadCounter.get(Number(row.penguji2_dosen_id)) || 0) + 1);
      [Number(row.penguji1_dosen_id), Number(row.penguji2_dosen_id)].forEach((dosenId) => {
        const dayKey = `${row.tanggal_sidang}#${dosenId}`;
        if (!dosenDailySessions.has(dayKey)) dosenDailySessions.set(dayKey, new Set());
        dosenDailySessions.get(dayKey).add(Number(row.sesi_ke));
        if (preferenceByDosenId.get(dosenId)?.mobilitas_ruangan === "satu_ruangan") {
          dosenDailyRoomConstraint.set(dayKey, row.ruangan);
        }
      });
    });

    const autoAssigned = [];
    const unassigned = [];
    const assignedAtNow = new Date(nowJakartaDateTime().datetime);

    for (const reg of pendingRegistrations) {
      const pembimbingId = Number(
        reg.dosen_pembimbing_id || reg.mahasiswa?.dosen_pembimbing_skripsi_id || 0
      );
      if (pembimbingId && supervisorCanAttend.get(pembimbingId) === false) {
        unassigned.push({
          pendaftaran_sidang_id: reg.id,
          mahasiswa_id: reg.mahasiswa_id,
          reason: "Dosen pembimbing tidak tersedia mendampingi sidang pada periode ini.",
        });
        continue;
      }
      let foundSchedule = null;
      const pengajuan = latestPengajuanByStudent.get(Number(reg.mahasiswa_id));
      const penjaluran = latestPenjaluranByStudent.get(Number(reg.mahasiswa_id));
      const finalTopikRef = resolveFinalTopikFromPengajuan(pengajuan);
      const finalTopik = finalTopikByCode.get(String(finalTopikRef?.kode || "").trim().toUpperCase());
      const fields = finalTopik
        ? (finalTopik.bidangPenelitians || [])
        : (fieldsByPengajuanId.get(Number(pengajuan?.id)) || []);
      const studentProfile = buildResearchProfile({
        fieldIds: fields.map((field) => field.id),
        fieldTexts: fields.map((field) => field.nama),
        text: [
          finalTopik?.judul || finalTopikRef?.judul || resolveJudulSkripsiFromPengajuan(pengajuan),
          finalTopik?.deskripsi,
          pengajuan?.deskripsi_mandiri,
          penjaluran?.catatan,
          penjaluran?.form_lanjutan_payload ? JSON.stringify(penjaluran.form_lanjutan_payload) : "",
        ].filter(Boolean).join(" "),
      });
      const rankedLecturers = rankLecturersForStudent(studentProfile, lecturerProfiles, dosenLoadCounter);
      const rankByDosenId = new Map(rankedLecturers.map((item, index) => [Number(item.id), { ...item, rank: index }]));
      const requestedAssignment = requestedAssignmentByRegistrationId?.get(Number(reg.id)) || null;
      if (requestedAssignment && (
        !requestedAssignment.tanggal_sidang
        || !requestedAssignment.sesi_ke
        || !requestedAssignment.ruangan
        || !requestedAssignment.penguji1_dosen_id
        || !requestedAssignment.penguji2_dosen_id
        || requestedAssignment.penguji1_dosen_id === requestedAssignment.penguji2_dosen_id
      )) {
        unassigned.push({
          pendaftaran_sidang_id: reg.id,
          mahasiswa_id: reg.mahasiswa_id,
          mahasiswa_nim: reg.mahasiswa?.nim || "-",
          mahasiswa_nama: reg.mahasiswa?.nama || "-",
          reason: "Data hari, sesi, ruangan, atau dosen penguji pada draft belum lengkap.",
        });
        continue;
      }

      const candidateSlots = requestedAssignment
        ? slots.filter((slot) =>
            String(slot.tanggal_sidang) === String(requestedAssignment.tanggal_sidang)
            && Number(slot.sesi_ke) === Number(requestedAssignment.sesi_ke)
            && String(slot.ruangan) === String(requestedAssignment.ruangan)
          )
        : slots;

      for (const slot of candidateSlots) {
        const roomSlotKey = slot.slot_key;
        if (usedRoomSlots.has(roomSlotKey)) continue;

        const availabilitySlotKey = buildSidangSlotKey(slot.tanggal_sidang, slot.sesi_ke);
        const busyInSlot = dosenBusyBySlot.get(availabilitySlotKey) || new Set();
        const rankedSlotCandidates = (availabilityBySlot.get(availabilitySlotKey) || [])
          .map((candidate) => ({ ...candidate, ...(rankByDosenId.get(Number(candidate.dosen_id)) || {}) }))
          .sort((left, right) => Number(left.rank ?? 99999) - Number(right.rank ?? 99999))
          .filter((candidate) => {
            if (candidate.dosen_id === pembimbingId || busyInSlot.has(candidate.dosen_id)) return false;
            const dayKey = `${slot.tanggal_sidang}#${candidate.dosen_id}`;
            const sessions = dosenDailySessions.get(dayKey) || new Set();
            const preference = preferenceByDosenId.get(candidate.dosen_id);
            const roomBound = dosenDailyRoomConstraint.get(dayKey);
            if (sessions.size >= Number(preference?.maksimal_sesi_per_hari || 5)) return false;
            if (preference?.membutuhkan_jeda && (sessions.has(slot.sesi_ke - 1) || sessions.has(slot.sesi_ke + 1))) return false;
            if ((candidate.kondisi_fisik === "tidak_fit" || preference?.mobilitas_ruangan === "satu_ruangan") && roomBound && roomBound !== slot.ruangan) return false;
            return true;
          });
        // Batasi pencarian pasangan tanpa menghilangkan variasi profil penilaian.
        // Kompleksitas per slot tetap konstan walau jumlah dosen bertambah besar.
        const candidatePoolById = new Map();
        [EXAMINER_PROFILE_HIGH_INTENSITY, EXAMINER_PROFILE_SUPPORTIVE].forEach((profile) => {
          rankedSlotCandidates
            .filter((candidate) => candidate.profil_penilaian_penguji === profile)
            .slice(0, 20)
            .forEach((candidate) => candidatePoolById.set(candidate.dosen_id, candidate));
        });
        if (requestedAssignment) {
          rankedSlotCandidates
            .filter((candidate) => [
              requestedAssignment.penguji1_dosen_id,
              requestedAssignment.penguji2_dosen_id,
            ].includes(Number(candidate.dosen_id)))
            .forEach((candidate) => candidatePoolById.set(candidate.dosen_id, candidate));
        }
        const candidates = [...candidatePoolById.values()]
          .sort((left, right) => Number(left.rank ?? 99999) - Number(right.rank ?? 99999));
        if (candidates.length < 2) continue;

        const validPairs = [];
        for (let i = 0; i < candidates.length; i += 1) {
          for (let j = i + 1; j < candidates.length; j += 1) {
            const first = candidates[i];
            const second = candidates[j];
            if (first.dosen_id === second.dosen_id) continue;
            if (first.dosen_id === pembimbingId || second.dosen_id === pembimbingId) continue;
            if (busyInSlot.has(first.dosen_id) || busyInSlot.has(second.dosen_id)) continue;

            const highIntensityCount =
              (first.profil_penilaian_penguji === EXAMINER_PROFILE_HIGH_INTENSITY ? 1 : 0)
              + (second.profil_penilaian_penguji === EXAMINER_PROFILE_HIGH_INTENSITY ? 1 : 0);
            if (highIntensityCount >= 2) continue;

            const firstDayKey = `${slot.tanggal_sidang}#${first.dosen_id}`;
            const secondDayKey = `${slot.tanggal_sidang}#${second.dosen_id}`;
            const firstSessions = dosenDailySessions.get(firstDayKey) || new Set();
            const secondSessions = dosenDailySessions.get(secondDayKey) || new Set();
            const firstPreference = preferenceByDosenId.get(first.dosen_id);
            const secondPreference = preferenceByDosenId.get(second.dosen_id);
            if (firstSessions.size >= Number(firstPreference?.maksimal_sesi_per_hari || 5)) continue;
            if (secondSessions.size >= Number(secondPreference?.maksimal_sesi_per_hari || 5)) continue;
            if (firstPreference?.membutuhkan_jeda && (firstSessions.has(slot.sesi_ke - 1) || firstSessions.has(slot.sesi_ke + 1))) continue;
            if (secondPreference?.membutuhkan_jeda && (secondSessions.has(slot.sesi_ke - 1) || secondSessions.has(slot.sesi_ke + 1))) continue;
            const firstRoomBound = dosenDailyRoomConstraint.get(firstDayKey);
            const secondRoomBound = dosenDailyRoomConstraint.get(secondDayKey);

            if ((first.kondisi_fisik === "tidak_fit" || firstPreference?.mobilitas_ruangan === "satu_ruangan") && firstRoomBound && firstRoomBound !== slot.ruangan) continue;
            if ((second.kondisi_fisik === "tidak_fit" || secondPreference?.mobilitas_ruangan === "satu_ruangan") && secondRoomBound && secondRoomBound !== slot.ruangan) continue;

            validPairs.push({
              dosenA: first.dosen_id,
              dosenB: second.dosen_id,
              profileA: first.profil_penilaian_penguji,
              profileB: second.profil_penilaian_penguji,
              kondisiA: first.kondisi_fisik,
              kondisiB: second.kondisi_fisik,
              loadScore:
                Number(dosenLoadCounter.get(first.dosen_id) || 0) + Number(dosenLoadCounter.get(second.dosen_id) || 0),
              idScore: first.dosen_id + second.dosen_id,
              expertiseScore: Number(first.expertise?.score || 0) + Number(second.expertise?.score || 0),
              firstExpertise: first.expertise,
              secondExpertise: second.expertise,
            });
          }
        }

        if (validPairs.length === 0) continue;
        validPairs.sort((left, right) => {
          const profileOrder = pairPreferenceScore(left, right);
          const leftProfileCount = (left.profileA === EXAMINER_PROFILE_HIGH_INTENSITY ? 1 : 0) + (left.profileB === EXAMINER_PROFILE_HIGH_INTENSITY ? 1 : 0);
          const rightProfileCount = (right.profileA === EXAMINER_PROFILE_HIGH_INTENSITY ? 1 : 0) + (right.profileB === EXAMINER_PROFILE_HIGH_INTENSITY ? 1 : 0);
          if ((leftProfileCount === 1) !== (rightProfileCount === 1)) return profileOrder;
          if (right.expertiseScore !== left.expertiseScore) return right.expertiseScore - left.expertiseScore;
          return profileOrder;
        });
        let chosen = validPairs[0];
        if (requestedAssignment) {
          const requestedPair = validPairs.find((pair) => {
            const pairIds = new Set([Number(pair.dosenA), Number(pair.dosenB)]);
            return pairIds.has(requestedAssignment.penguji1_dosen_id)
              && pairIds.has(requestedAssignment.penguji2_dosen_id);
          });
          if (!requestedPair) continue;
          const firstRequested = rankByDosenId.get(requestedAssignment.penguji1_dosen_id);
          const secondRequested = rankByDosenId.get(requestedAssignment.penguji2_dosen_id);
          chosen = {
            ...requestedPair,
            dosenA: requestedAssignment.penguji1_dosen_id,
            dosenB: requestedAssignment.penguji2_dosen_id,
            kondisiA: candidates.find((item) => Number(item.dosen_id) === requestedAssignment.penguji1_dosen_id)?.kondisi_fisik,
            kondisiB: candidates.find((item) => Number(item.dosen_id) === requestedAssignment.penguji2_dosen_id)?.kondisi_fisik,
            firstExpertise: firstRequested?.expertise,
            secondExpertise: secondRequested?.expertise,
          };
        }

        foundSchedule = {
          ...slot,
          penguji1_dosen_id: chosen.dosenA,
          penguji2_dosen_id: chosen.dosenB,
          kondisiA: chosen.kondisiA,
          kondisiB: chosen.kondisiB,
          expertiseA: chosen.firstExpertise,
          expertiseB: chosen.secondExpertise,
        };
        break;
      }

      if (!foundSchedule) {
        unassigned.push({
          pendaftaran_sidang_id: reg.id,
          mahasiswa_id: reg.mahasiswa_id,
          mahasiswa_nim: reg.mahasiswa?.nim || "-",
          mahasiswa_nama: reg.mahasiswa?.nama || "-",
          reason: requestedAssignment
            ? "Hasil edit tidak memenuhi ketersediaan atau aturan penjadwalan dosen penguji."
            : "Tidak menemukan kombinasi penguji yang memenuhi aturan pada slot tersedia.",
        });
        continue;
      }

      let scheduleRow = null;
      if (shouldCommit) {
        scheduleRow = await JadwalSidangPenguji.create({
          periode_sidang_id: periode.id,
          pendaftaran_sidang_id: reg.id,
          mahasiswa_id: reg.mahasiswa_id,
          dosen_pembimbing_id: pembimbingId || null,
          tanggal_sidang: foundSchedule.tanggal_sidang,
          sesi_ke: foundSchedule.sesi_ke,
          sesi_mulai: foundSchedule.sesi_mulai,
          sesi_selesai: foundSchedule.sesi_selesai,
          ruangan: foundSchedule.ruangan,
          penguji1_dosen_id: foundSchedule.penguji1_dosen_id,
          penguji2_dosen_id: foundSchedule.penguji2_dosen_id,
          assignment_status: "assigned",
          generated_at: assignedAtNow,
        }, { transaction });

        reg.status = "scheduled";
        reg.assigned_at = assignedAtNow;
        await reg.save({ transaction });
      }

      const roomSlotKey = buildRoomSlotKey(foundSchedule.tanggal_sidang, foundSchedule.sesi_ke, foundSchedule.ruangan);
      const sidangSlotKey = buildSidangSlotKey(foundSchedule.tanggal_sidang, foundSchedule.sesi_ke);
      usedRoomSlots.add(roomSlotKey);
      if (!dosenBusyBySlot.has(sidangSlotKey)) dosenBusyBySlot.set(sidangSlotKey, new Set());
      dosenBusyBySlot.get(sidangSlotKey).add(foundSchedule.penguji1_dosen_id);
      dosenBusyBySlot.get(sidangSlotKey).add(foundSchedule.penguji2_dosen_id);
      dosenLoadCounter.set(
        foundSchedule.penguji1_dosen_id,
        Number(dosenLoadCounter.get(foundSchedule.penguji1_dosen_id) || 0) + 1
      );
      dosenLoadCounter.set(
        foundSchedule.penguji2_dosen_id,
        Number(dosenLoadCounter.get(foundSchedule.penguji2_dosen_id) || 0) + 1
      );
      [foundSchedule.penguji1_dosen_id, foundSchedule.penguji2_dosen_id].forEach((dosenId) => {
        const dayKey = `${foundSchedule.tanggal_sidang}#${dosenId}`;
        if (!dosenDailySessions.has(dayKey)) dosenDailySessions.set(dayKey, new Set());
        dosenDailySessions.get(dayKey).add(Number(foundSchedule.sesi_ke));
      });

      if (foundSchedule.kondisiA === "tidak_fit" || preferenceByDosenId.get(foundSchedule.penguji1_dosen_id)?.mobilitas_ruangan === "satu_ruangan") {
        dosenDailyRoomConstraint.set(
          `${foundSchedule.tanggal_sidang}#${foundSchedule.penguji1_dosen_id}`,
          foundSchedule.ruangan
        );
      }
      if (foundSchedule.kondisiB === "tidak_fit" || preferenceByDosenId.get(foundSchedule.penguji2_dosen_id)?.mobilitas_ruangan === "satu_ruangan") {
        dosenDailyRoomConstraint.set(
          `${foundSchedule.tanggal_sidang}#${foundSchedule.penguji2_dosen_id}`,
          foundSchedule.ruangan
        );
      }

      autoAssigned.push({
        jadwal_id: scheduleRow?.id || null,
        pendaftaran_sidang_id: reg.id,
        mahasiswa_id: reg.mahasiswa_id,
        mahasiswa_nim: reg.mahasiswa?.nim || "-",
        mahasiswa_nama: reg.mahasiswa?.nama || "-",
        tanggal_sidang: foundSchedule.tanggal_sidang,
        sesi_ke: foundSchedule.sesi_ke,
        sesi_mulai: foundSchedule.sesi_mulai,
        sesi_selesai: foundSchedule.sesi_selesai,
        ruangan: foundSchedule.ruangan,
        penguji1_dosen_id: foundSchedule.penguji1_dosen_id,
        penguji2_dosen_id: foundSchedule.penguji2_dosen_id,
        penguji1: (() => {
          const item = rankByDosenId.get(Number(foundSchedule.penguji1_dosen_id));
          return item ? { id: item.id, nama: item.nama, nik: item.nik, gelar: item.gelar, match_score: item.expertise?.score || 0 } : null;
        })(),
        penguji2: (() => {
          const item = rankByDosenId.get(Number(foundSchedule.penguji2_dosen_id));
          return item ? { id: item.id, nama: item.nama, nik: item.nik, gelar: item.gelar, match_score: item.expertise?.score || 0 } : null;
        })(),
        match_score: Math.round(((Number(foundSchedule.expertiseA?.score || 0) + Number(foundSchedule.expertiseB?.score || 0)) / 2) * 10) / 10,
        matched_fields: [...new Set([...(foundSchedule.expertiseA?.matchedFields || []), ...(foundSchedule.expertiseB?.matchedFields || [])])],
      });
    }

    if (unassigned.length > 0) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: `${unassigned.length} mahasiswa belum dapat dijadwalkan karena kombinasi dosen, sesi, atau ruangan belum mencukupi.`,
        detail: { code: "INSUFFICIENT_ASSIGNMENT_CAPACITY", unassigned },
      });
    }

    if (shouldCommit) await transaction.commit();
    else await transaction.rollback();

    return res.json({
      success: true,
      message: shouldCommit
        ? `${autoAssigned.length} penugasan dosen penguji berhasil disimpan.`
        : `Rekomendasi AI selesai untuk ${autoAssigned.length} mahasiswa. Periksa hasil sebelum disimpan.`,
      data: {
        periode_sidang: {
          id: periode.id,
          label_periode: periode.label_periode,
          status: periode.status,
        },
        assigned_count: autoAssigned.length,
        unassigned_count: unassigned.length,
        assigned: autoAssigned,
        unassigned,
        committed: shouldCommit,
      },
    });
  } catch (error) {
    try {
      await transaction.rollback();
    } catch (rollbackError) {
      // no-op
    }
    console.error("Error di autoAssignSidangPenguji:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat auto-assign penguji sidang.",
      error: error.message,
    });
  }
};

exports.getDosenKetersediaanSidang = async (req, res) => {
  try {
    const dosenId = Number(req.user?.id || 0);
    if (!dosenId || req.user?.role !== "dosen") {
      return res.status(403).json({
        success: false,
        message: "Akses ditolak. Hanya dosen yang dapat mengisi ketersediaan sidang.",
      });
    }

    const requestedPeriodeId = Number(req.query?.periode_sidang_id || 0);
    const periodes = await PeriodeSidang.findAll({
      where: { status: { [Op.in]: ["open", "closed"] } },
      order: [["activated_at", "DESC"], ["updatedAt", "DESC"]],
    });
    const periodeIds = periodes.map((item) => Number(item.id));

    if (periodeIds.length === 0) {
      return res.json({
        success: true,
        data: {
          periodes: [],
          periode_sidang: null,
          tanggal_sidang: [],
          ketersediaan: [],
          preferensi: null,
          jadwal_anda: [],
        },
      });
    }

    const [allHariRows, allRoomRows, allAvailabilityRows, preferenceRows, allScheduleRows] = await Promise.all([
      PeriodeSidangHari.findAll({
        where: { periode_sidang_id: { [Op.in]: periodeIds } },
        order: [["periode_sidang_id", "ASC"], ["tanggal_sidang", "ASC"]],
      }),
      PeriodeSidangRuangan.findAll({
        where: { periode_sidang_id: { [Op.in]: periodeIds } },
        order: [["periode_sidang_id", "ASC"], ["nama_ruangan", "ASC"]],
      }),
      KetersediaanPengujiSidang.findAll({
        where: {
          periode_sidang_id: { [Op.in]: periodeIds },
          dosen_id: dosenId,
        },
        order: [["periode_sidang_id", "ASC"], ["tanggal_sidang", "ASC"], ["sesi_ke", "ASC"]],
      }),
      PreferensiPengujiSidang.findAll({
        where: {
          periode_sidang_id: { [Op.in]: periodeIds },
          dosen_id: dosenId,
        },
        order: [["updatedAt", "DESC"]],
      }),
      JadwalSidangPenguji.findAll({
        where: {
          periode_sidang_id: { [Op.in]: periodeIds },
          [Op.or]: [{ penguji1_dosen_id: dosenId }, { penguji2_dosen_id: dosenId }],
          assignment_status: { [Op.in]: ["assigned", "finalized"] },
        },
        include: [{ model: Mahasiswa, as: "mahasiswa", attributes: ["id", "nim", "nama"] }],
        order: [["periode_sidang_id", "ASC"], ["tanggal_sidang", "ASC"], ["sesi_ke", "ASC"]],
      }),
    ]);

    const groupByPeriode = (rows) => rows.reduce((result, row) => {
      const key = Number(row.periode_sidang_id);
      if (!result.has(key)) result.set(key, []);
      result.get(key).push(row);
      return result;
    }, new Map());
    const hariByPeriode = groupByPeriode(allHariRows);
    const roomByPeriode = groupByPeriode(allRoomRows);
    const availabilityByPeriode = groupByPeriode(allAvailabilityRows);
    const scheduleByPeriode = groupByPeriode(allScheduleRows);
    const preferenceByPeriode = new Map(preferenceRows.map((item) => [Number(item.periode_sidang_id), item]));

    const serializedPeriodes = periodes.map((item) => {
      const id = Number(item.id);
      const availability = availabilityByPeriode.get(id) || [];
      const selectedDates = new Set(availability.map((row) => String(row.tanggal_sidang)));
      const preference = preferenceByPeriode.get(id) || null;
      const schedules = scheduleByPeriode.get(id) || [];
      const scheduledDates = new Set(schedules.map((row) => String(row.tanggal_sidang)));
      return {
        ...serializePeriode(item, hariByPeriode.get(id) || [], roomByPeriode.get(id) || []),
        jumlah_hari_sidang: (hariByPeriode.get(id) || []).length,
        ketersediaan_diisi: Boolean(preference),
        jumlah_tanggal_tersedia: selectedDates.size,
        ketersediaan_diperbarui_at: preference?.updatedAt || null,
        jumlah_jadwal_penguji: schedules.length,
        jumlah_hari_menguji: scheduledDates.size,
      };
    });

    const selectedPeriode = requestedPeriodeId
      ? periodes.find((item) => Number(item.id) === requestedPeriodeId)
      : null;
    if (requestedPeriodeId && !selectedPeriode) {
      return res.status(404).json({ success: false, message: "Periode sidang tidak ditemukan." });
    }

    let tanggalSidang = [];
    let selectedAvailability = [];
    let selectedPreference = null;
    let jadwalRows = [];
    if (selectedPeriode) {
      const selectedId = Number(selectedPeriode.id);
      tanggalSidang = (hariByPeriode.get(selectedId) || []).map((hari) => ({
        tanggal_sidang: hari.tanggal_sidang,
        jumlah_sesi: getSessionTemplateByDate(hari.tanggal_sidang).length,
        sesi: getSessionTemplateByDate(hari.tanggal_sidang),
      }));
      selectedAvailability = availabilityByPeriode.get(selectedId) || [];
      selectedPreference = preferenceByPeriode.get(selectedId) || null;
      jadwalRows = scheduleByPeriode.get(selectedId) || [];
    }

    return res.json({
      success: true,
      data: {
        periodes: serializedPeriodes,
        periode_sidang: selectedPeriode
          ? serializePeriode(
              selectedPeriode,
              hariByPeriode.get(Number(selectedPeriode.id)) || [],
              roomByPeriode.get(Number(selectedPeriode.id)) || []
            )
          : null,
        tanggal_sidang: tanggalSidang,
        ketersediaan: selectedAvailability.map((row) => ({
          id: row.id,
          tanggal_sidang: row.tanggal_sidang,
          sesi_ke: row.sesi_ke,
        })),
        preferensi: selectedPreference
          ? {
              mobilitas_ruangan: selectedPreference.mobilitas_ruangan,
              maksimal_sesi_per_hari: selectedPreference.maksimal_sesi_per_hari,
              membutuhkan_jeda: selectedPreference.membutuhkan_jeda,
              submitted_at: selectedPreference.submitted_at,
              updated_at: selectedPreference.updatedAt,
            }
          : null,
        jadwal_anda: jadwalRows.map((row) => ({
          id: row.id,
          tanggal_sidang: row.tanggal_sidang,
          sesi_ke: row.sesi_ke,
          sesi_mulai: row.sesi_mulai,
          sesi_selesai: row.sesi_selesai,
          ruangan: row.ruangan,
          peran_penguji: Number(row.penguji1_dosen_id) === dosenId ? "Penguji 1" : "Penguji 2",
          mahasiswa: row.mahasiswa
            ? {
                id: row.mahasiswa.id,
                nim: row.mahasiswa.nim,
                nama: row.mahasiswa.nama,
              }
            : null,
        })),
      },
    });
  } catch (error) {
    console.error("Error di getDosenKetersediaanSidang:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat mengambil data ketersediaan sidang.",
      error: error.message,
    });
  }
};

exports.saveDosenKetersediaanSidang = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const dosenId = Number(req.user?.id || 0);
    if (!dosenId || req.user?.role !== "dosen") {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: "Akses ditolak. Hanya dosen yang dapat mengisi ketersediaan sidang.",
      });
    }

    const requestedPeriodeId = Number(req.body?.periode_sidang_id || 0);
    const periode = requestedPeriodeId
      ? await PeriodeSidang.findByPk(requestedPeriodeId, { transaction, lock: transaction.LOCK.UPDATE })
      : await getOpenPeriodeSidang(transaction);

    if (!periode) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: "Periode sidang tidak ditemukan.",
      });
    }
    if (String(periode.status || "").toLowerCase() !== "open") {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: "Ketersediaan dosen hanya bisa diisi pada periode sidang open.",
      });
    }

    const tanggalInput = Array.isArray(req.body?.tanggal_sidang_list) ? req.body.tanggal_sidang_list : [];
    const mobilitasRuangan = String(req.body?.mobilitas_ruangan || "").trim().toLowerCase();
    const maksimalSesiPerHari = Number(req.body?.maksimal_sesi_per_hari);
    const membutuhkanJeda = req.body?.membutuhkan_jeda;
    if (!["dapat_berpindah", "satu_ruangan"].includes(mobilitasRuangan)) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: "Konfirmasi mobilitas ruangan wajib dipilih." });
    }
    if (!Number.isInteger(maksimalSesiPerHari) || maksimalSesiPerHari < 1 || maksimalSesiPerHari > 5) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: "Maksimal sesi per hari harus bernilai 1 sampai 5." });
    }
    if (typeof membutuhkanJeda !== "boolean") {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: "Kebutuhan jeda wajib dipilih." });
    }
    const hariRows = await PeriodeSidangHari.findAll({
      where: { periode_sidang_id: periode.id },
      transaction,
    });
    const allowedDates = new Set(hariRows.map((item) => item.tanggal_sidang));
    const selectedDates = [...new Set(tanggalInput.map(normalizeDateOnly).filter(Boolean))];
    if (selectedDates.length === 0) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: "Pilih minimal satu tanggal ketersediaan." });
    }
    if (selectedDates.some((tanggal) => !allowedDates.has(tanggal))) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: "Terdapat tanggal yang tidak termasuk konfigurasi Sekretaris Prodi." });
    }

    const normalizedRows = selectedDates.flatMap((tanggal) =>
      getSessionTemplateByDate(tanggal).map((session) => ({
        periode_sidang_id: periode.id,
        dosen_id: dosenId,
        tanggal_sidang: tanggal,
        sesi_ke: session.sesi_ke,
        kondisi_fisik: "fit",
      }))
    );

    await KetersediaanPengujiSidang.destroy({
      where: {
        periode_sidang_id: periode.id,
        dosen_id: dosenId,
      },
      transaction,
    });

    if (normalizedRows.length > 0) {
      await KetersediaanPengujiSidang.bulkCreate(normalizedRows, { transaction });
    }
    const preferencePayload = {
      mobilitas_ruangan: mobilitasRuangan,
      maksimal_sesi_per_hari: maksimalSesiPerHari,
      membutuhkan_jeda: membutuhkanJeda,
      submitted_at: new Date(),
    };
    const existingPreference = await PreferensiPengujiSidang.findOne({
      where: { periode_sidang_id: periode.id, dosen_id: dosenId },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (existingPreference) {
      await existingPreference.update(preferencePayload, { transaction });
    } else {
      await PreferensiPengujiSidang.create(
        { periode_sidang_id: periode.id, dosen_id: dosenId, ...preferencePayload },
        { transaction }
      );
    }

    await transaction.commit();
    return res.json({
      success: true,
      message: "Ketersediaan penguji sidang berhasil disimpan.",
      data: {
        total_tanggal_tersimpan: selectedDates.length,
        total_slot_tersimpan: normalizedRows.length,
      },
    });
  } catch (error) {
    try {
      await transaction.rollback();
    } catch (rollbackError) {
      // no-op
    }
    console.error("Error di saveDosenKetersediaanSidang:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat menyimpan ketersediaan sidang.",
      error: error.message,
    });
  }
};
