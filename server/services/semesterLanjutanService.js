const { Dosen, IzinLanjutSkripsi, PendaftaranPenjaluran, PeriodePenjaluran, PeriodeAkademik } = require("../models");
const { getActiveSupervisorAssignment } = require("./penetapanPembimbingService");

const EXTENSION_WINDOW_DAYS = 30;

function parseAcademicYearStart(tahunAkademik) {
  const match = String(tahunAkademik || "").match(/(\d{4})/);
  return match ? Number(match[1]) : 0;
}

function getSemesterOrder(semester) {
  const normalized = String(semester || "").toLowerCase();
  if (normalized === "ganjil") return 1;
  if (normalized === "genap") return 2;
  return null;
}

function getPeriodeRank(tahunAkademik, semester) {
  const yearStart = parseAcademicYearStart(tahunAkademik);
  const semesterOrder = getSemesterOrder(semester);
  if (!yearStart || !semesterOrder) return null;
  return yearStart * 2 + (semesterOrder - 1);
}

async function getReferencePeriode(transaction = null) {
  const activePeriode = await PeriodePenjaluran.findOne({
    where: { is_active: true },
    attributes: ["id", "tahun_akademik", "semester", "label_periode", "is_active"],
    order: [["updatedAt", "DESC"]],
    transaction: transaction || undefined,
  });

  if (activePeriode) return activePeriode;

  const allPeriodes = await PeriodePenjaluran.findAll({
    attributes: ["id", "tahun_akademik", "semester", "label_periode", "is_active"],
    transaction: transaction || undefined,
  });

  let latestPeriode = null;
  let latestRank = null;

  for (const periode of allPeriodes) {
    const rank = getPeriodeRank(periode.tahun_akademik, periode.semester);
    if (rank === null) continue;
    if (latestRank === null || rank > latestRank) {
      latestRank = rank;
      latestPeriode = periode;
    }
  }

  return latestPeriode;
}

async function getExtensionWindowForAssignment(assignment, transaction = null) {
  const sourceRank = getPeriodeRank(assignment?.periodeMulai?.tahun_akademik, assignment?.periodeMulai?.semester);
  if (sourceRank === null) return { is_open: false, opens_at: null, target_period_id: null };
  const periods = await PeriodePenjaluran.findAll({
    attributes: ["id", "tahun_akademik", "semester", "label_periode", "periode_akademik_id"],
    include: [{
      model: PeriodeAkademik,
      as: "periodeAkademik",
      attributes: ["id", "kode", "tanggal_mulai", "tanggal_selesai", "status"],
      required: false,
    }],
    transaction: transaction || undefined,
  });
  const target = periods.find((item) => getPeriodeRank(item.tahun_akademik, item.semester) === sourceRank + 1) || null;
  const targetStart = target?.periodeAkademik?.tanggal_mulai ? new Date(target.periodeAkademik.tanggal_mulai) : null;
  if (!targetStart || Number.isNaN(targetStart.getTime())) {
    return {
      is_open: false, opens_at: null, target_period_id: target?.id || null,
      periode_akademik_id: target?.periode_akademik_id || null,
      reason: "academic_period_start_date_required",
    };
  }
  const opensAt = new Date(targetStart.getTime() - EXTENSION_WINDOW_DAYS * 86400000);
  return {
    is_open: new Date() >= opensAt,
    opens_at: opensAt,
    target_starts_at: targetStart,
    target_period_id: target.id,
    periode_akademik_id: target.periode_akademik_id,
    academic_period_code: target.periodeAkademik?.kode || null,
    target_period_label: target.label_periode,
    window_days: EXTENSION_WINDOW_DAYS,
  };
}

async function getSemesterPenjaluranAktif(mahasiswaId, transaction = null) {
  const active = await getActiveSupervisorAssignment(mahasiswaId, transaction);
  const assignment = active.penetapan;
  const referencePeriode = assignment?.periodeMulai || null;
  const firstAssignment = assignment?.pendaftaran_penjaluran_id
    ? await require("../models").PenetapanPembimbing.findOne({
        where: { pendaftaran_penjaluran_id: assignment.pendaftaran_penjaluran_id, semester_penjaluran_ke: 1 },
        include: [{ model: PeriodePenjaluran, as: "periodeMulai" }],
        order: [["createdAt", "ASC"]],
        transaction: transaction || undefined,
      })
    : null;
  const firstPeriode = firstAssignment?.periodeMulai || null;
  const semesterAktif = Number(assignment?.semester_penjaluran_ke || 0);

  return {
    semester_penjaluran_aktif: semesterAktif,
    reference_periode: referencePeriode
      ? {
          id: referencePeriode.id,
          label_periode: referencePeriode.label_periode,
          tahun_akademik: referencePeriode.tahun_akademik,
          semester: referencePeriode.semester,
          is_active: referencePeriode.is_active,
        }
      : null,
    first_periode: firstPeriode
      ? {
          id: firstPeriode.id,
          label_periode: firstPeriode.label_periode,
          tahun_akademik: firstPeriode.tahun_akademik,
          semester: firstPeriode.semester,
        }
      : null,
  };
}

function toIzinResponse(izin) {
  if (!izin) return null;

  return {
    id: izin.id,
    mahasiswa_id: izin.mahasiswa_id,
    dosen_pembimbing_skripsi_id: izin.dosen_pembimbing_skripsi_id,
    periode_penjaluran_id: izin.periode_penjaluran_id,
    semester_penjaluran_ke: izin.semester_penjaluran_ke,
    status: izin.status,
    alasan_pengajuan: izin.alasan_pengajuan,
    keterangan_dosen: izin.keterangan_dosen,
    tanggal_pengajuan: izin.tanggal_pengajuan || izin.createdAt,
    tanggal_keputusan: izin.tanggal_keputusan,
    dosen_pembimbing_skripsi: izin.dosenPembimbingSkripsi
      ? {
          id: izin.dosenPembimbingSkripsi.id,
          nik: izin.dosenPembimbingSkripsi.nik,
          nama: izin.dosenPembimbingSkripsi.nama,
          email: izin.dosenPembimbingSkripsi.email,
        }
      : null,
    periode: izin.periode
      ? {
          id: izin.periode.id,
          label_periode: izin.periode.label_periode,
          tahun_akademik: izin.periode.tahun_akademik,
          semester: izin.periode.semester,
        }
      : null,
    createdAt: izin.createdAt,
    updatedAt: izin.updatedAt,
    pendaftaran_penjaluran_id: izin.pendaftaran_penjaluran_id || null,
    penetapan_asal_id: izin.penetapan_asal_id || null,
    reviewer_p1_id: izin.reviewer_p1_id || null,
    penetapan_hasil_id: izin.penetapan_hasil_id || null,
  };
}

async function getLatestIzinByMahasiswa(mahasiswaId, transaction = null, pendaftaranId = null) {
  const izin = await IzinLanjutSkripsi.findOne({
    where: {
      mahasiswa_id: mahasiswaId,
      ...(pendaftaranId ? { pendaftaran_penjaluran_id: pendaftaranId } : {}),
    },
    include: [
      {
        model: Dosen,
        as: "dosenPembimbingSkripsi",
        attributes: ["id", "nik", "nama", "email"],
        required: false,
      },
      {
        model: PeriodePenjaluran,
        as: "periode",
        attributes: ["id", "label_periode", "tahun_akademik", "semester"],
        required: false,
      },
    ],
    order: [["createdAt", "DESC"]],
    transaction: transaction || undefined,
  });

  return izin;
}

async function buildSemesterLanjutanGate(mahasiswa, transaction = null) {
  const mahasiswaId = typeof mahasiswa === "object" ? mahasiswa?.id : mahasiswa;
  const [semesterData, activeAssignment] = await Promise.all([
    getSemesterPenjaluranAktif(mahasiswaId, transaction),
    getActiveSupervisorAssignment(mahasiswaId, transaction),
  ]);
  const latestIzin = await getLatestIzinByMahasiswa(
    mahasiswaId,
    transaction,
    activeAssignment.penetapan?.pendaftaran_penjaluran_id || null
  );
  const dospemId = Number(
    activeAssignment.pembimbing_1?.id
      || (typeof mahasiswa === "object" ? mahasiswa?.dosen_pembimbing_skripsi_id : null)
      || 0
  ) || null;

  const semesterAktif = Number(semesterData.semester_penjaluran_aktif || 0);
  const isSemesterTigaPlus = semesterAktif >= 3;
  const extensionWindow = semesterAktif >= 2
    ? await getExtensionWindowForAssignment(activeAssignment.penetapan, transaction)
    : { is_open: false, opens_at: null, target_period_id: null, window_days: EXTENSION_WINDOW_DAYS };

  if (semesterAktif === 2) {
    const pending = latestIzin?.status === "pending";
    const approved = latestIzin?.status === "approved";
    return {
      is_semester_tiga_plus: false,
      is_locked: false,
      must_ulang_jalur: false,
      can_submit_izin: Boolean(dospemId) && extensionWindow.is_open && !pending && !approved,
      semester_penjaluran_aktif: semesterAktif,
      reason: approved
        ? "izin_semester_tiga_disetujui"
        : pending
          ? "izin_semester_tiga_menunggu_persetujuan"
          : extensionWindow.is_open ? "semester_dua_dapat_mengajukan_izin" : "jendela_izin_belum_dibuka",
      message: approved
        ? "Bimbingan semester kedua tetap aktif dan izin semester ketiga sudah disetujui."
        : pending
          ? "Bimbingan semester kedua tetap aktif selama izin semester ketiga menunggu keputusan."
          : extensionWindow.is_open
            ? "Bimbingan semester kedua tetap aktif. Jendela izin semester ketiga sudah dibuka."
            : "Bimbingan semester kedua tetap aktif. Izin semester ketiga dibuka 30 hari sebelum periode berikutnya dimulai.",
      extension_window: extensionWindow,
      latest_izin: toIzinResponse(latestIzin),
      reference_periode: semesterData.reference_periode,
      first_periode: semesterData.first_periode,
    };
  }

  if (!isSemesterTigaPlus) {
    return {
      is_semester_tiga_plus: false,
      is_locked: false,
      must_ulang_jalur: false,
      can_submit_izin: false,
      semester_penjaluran_aktif: semesterAktif,
      reason: semesterAktif ? "semester_masih_aman" : "assignment_aktif_tidak_tersedia",
      message: semesterAktif ? "Belum memerlukan izin semester penjaluran ke-3." : "Assignment pembimbing aktif belum tersedia.",
      latest_izin: toIzinResponse(latestIzin),
      reference_periode: semesterData.reference_periode,
      first_periode: semesterData.first_periode,
    };
  }

  if (!dospemId) {
    return {
      is_semester_tiga_plus: true,
      is_locked: true,
      must_ulang_jalur: false,
      can_submit_izin: false,
      semester_penjaluran_aktif: semesterAktif,
      reason: "dospem_belum_ditetapkan",
      message:
        "Akses dikunci karena sudah semester penjaluran ke-3, namun dosen pembimbing skripsi belum ditetapkan.",
      latest_izin: toIzinResponse(latestIzin),
      reference_periode: semesterData.reference_periode,
      first_periode: semesterData.first_periode,
    };
  }

  if (!latestIzin) {
    return {
      is_semester_tiga_plus: true,
      is_locked: true,
      must_ulang_jalur: false,
      can_submit_izin: Boolean(dospemId) && extensionWindow.is_open,
      semester_penjaluran_aktif: semesterAktif,
      reason: "izin_belum_diajukan",
      message:
        "Anda sudah masuk semester penjaluran ke-3. Ajukan izin melanjutkan skripsi ke dosen pembimbing skripsi terlebih dahulu.",
      latest_izin: null,
      extension_window: extensionWindow,
      reference_periode: semesterData.reference_periode,
      first_periode: semesterData.first_periode,
    };
  }

  if (latestIzin.status === "approved") {
    return {
      is_semester_tiga_plus: true,
      is_locked: false,
      must_ulang_jalur: false,
      can_submit_izin: false,
      semester_penjaluran_aktif: semesterAktif,
      reason: "izin_disetujui",
      message: "Izin melanjutkan skripsi sudah disetujui dosen pembimbing skripsi.",
      latest_izin: toIzinResponse(latestIzin),
      reference_periode: semesterData.reference_periode,
      first_periode: semesterData.first_periode,
    };
  }

  if (latestIzin.status === "pending") {
    return {
      is_semester_tiga_plus: true,
      is_locked: true,
      must_ulang_jalur: false,
      can_submit_izin: false,
      semester_penjaluran_aktif: semesterAktif,
      reason: "izin_menunggu_persetujuan",
      message: "Permintaan izin melanjutkan skripsi sedang menunggu keputusan dosen pembimbing skripsi.",
      latest_izin: toIzinResponse(latestIzin),
      reference_periode: semesterData.reference_periode,
      first_periode: semesterData.first_periode,
    };
  }

  return {
    is_semester_tiga_plus: true,
    is_locked: true,
    must_ulang_jalur: true,
    can_submit_izin: false,
    semester_penjaluran_aktif: semesterAktif,
    reason: "izin_ditolak_wajib_ulang",
    message:
      "Permintaan izin melanjutkan skripsi ditolak dosen pembimbing skripsi. Mahasiswa wajib melakukan penjaluran ulang.",
    latest_izin: toIzinResponse(latestIzin),
    reference_periode: semesterData.reference_periode,
    first_periode: semesterData.first_periode,
  };
}

module.exports = {
  getPeriodeRank,
  getReferencePeriode,
  getSemesterPenjaluranAktif,
  getLatestIzinByMahasiswa,
  buildSemesterLanjutanGate,
  toIzinResponse,
};
