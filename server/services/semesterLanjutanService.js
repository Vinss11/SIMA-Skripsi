const { Dosen, IzinLanjutSkripsi, PendaftaranPenjaluran, PeriodePenjaluran } = require("../models");

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

async function getSemesterPenjaluranAktif(mahasiswaId, transaction = null) {
  const referencePeriode = await getReferencePeriode(transaction);
  const referenceRank = getPeriodeRank(referencePeriode?.tahun_akademik, referencePeriode?.semester);

  const riwayatPendaftaran = await PendaftaranPenjaluran.findAll({
    where: { mahasiswa_id: mahasiswaId },
    attributes: ["id", "createdAt"],
    include: [
      {
        model: PeriodePenjaluran,
        as: "periode",
        attributes: ["id", "tahun_akademik", "semester", "label_periode"],
        required: false,
      },
    ],
    order: [["createdAt", "ASC"]],
    transaction: transaction || undefined,
  });

  let firstRank = null;
  let firstPeriode = null;

  for (const item of riwayatPendaftaran) {
    const rank = getPeriodeRank(item.periode?.tahun_akademik, item.periode?.semester);
    if (rank === null) continue;
    if (firstRank === null || rank < firstRank) {
      firstRank = rank;
      firstPeriode = item.periode || null;
    }
  }

  let semesterAktif = 1;
  if (firstRank !== null && referenceRank !== null) {
    const diff = referenceRank - firstRank;
    semesterAktif = diff >= 0 ? diff + 1 : 1;
  }

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
  };
}

async function getLatestIzinByMahasiswa(mahasiswaId, transaction = null) {
  const izin = await IzinLanjutSkripsi.findOne({
    where: { mahasiswa_id: mahasiswaId },
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
  const dospemId =
    typeof mahasiswa === "object" ? mahasiswa?.dosen_pembimbing_skripsi_id : null;

  const semesterData = await getSemesterPenjaluranAktif(mahasiswaId, transaction);
  const latestIzin = await getLatestIzinByMahasiswa(mahasiswaId, transaction);

  const semesterAktif = semesterData.semester_penjaluran_aktif || 1;
  const isSemesterTigaPlus = semesterAktif >= 3;

  if (!isSemesterTigaPlus) {
    return {
      is_semester_tiga_plus: false,
      is_locked: false,
      must_ulang_jalur: false,
      can_submit_izin: false,
      semester_penjaluran_aktif: semesterAktif,
      reason: "semester_masih_aman",
      message: "Belum masuk semester penjaluran ke-3.",
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
      can_submit_izin: true,
      semester_penjaluran_aktif: semesterAktif,
      reason: "izin_belum_diajukan",
      message:
        "Anda sudah masuk semester penjaluran ke-3. Ajukan izin melanjutkan skripsi ke dosen pembimbing skripsi terlebih dahulu.",
      latest_izin: null,
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

