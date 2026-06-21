const {
  Mahasiswa,
  Dosen,
  Pengajuan,
  PendaftaranPenjaluran,
  PeriodePenjaluran,
} = require("../models");

function normalizeEnumLabel(value) {
  if (!value) return null;
  return String(value)
    .trim()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

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
  // Urutan linear per semester akademik:
  // 2025/2026 ganjil -> 2025/2026 genap -> 2026/2027 ganjil -> ...
  return yearStart * 2 + (semesterOrder - 1);
}

async function getReferencePeriode() {
  const activePeriode = await PeriodePenjaluran.findOne({
    where: { is_active: true },
    attributes: ["id", "tahun_akademik", "semester", "label_periode", "is_active"],
    order: [["updatedAt", "DESC"]],
  });

  if (activePeriode) return activePeriode;

  const allPeriodes = await PeriodePenjaluran.findAll({
    attributes: ["id", "tahun_akademik", "semester", "label_periode", "is_active"],
  });

  if (!Array.isArray(allPeriodes) || allPeriodes.length === 0) {
    return null;
  }

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

function resolveNamaPenjaluranFromPendaftaran(item) {
  if (!item) return null;

  if (item.jalur === "alih") {
    return normalizeEnumLabel(
      item.penjaluran_baru || item.jenis_jalur_diambil || item.penjaluran_sebelumnya
    );
  }

  return normalizeEnumLabel(
    item.jenis_jalur_diambil || item.penjaluran_baru || item.penjaluran_sebelumnya
  );
}

function resolvePembimbingTAFromPendaftaran(item) {
  if (!item) return null;

  if (item.jalur === "baru") {
    return item.dosenPembimbingTA || null;
  }

  return (
    item.dosenPembimbingTABaru ||
    item.dosenPembimbingTA ||
    item.dosenPembimbingTASebelumnya ||
    null
  );
}

function mapMahasiswaMasterRows(mahasiswas, activePeriode) {
  const activePeriodeRank = getPeriodeRank(
    activePeriode?.tahun_akademik,
    activePeriode?.semester
  );

  return mahasiswas.map((mahasiswa) => {
    const raw = mahasiswa.toJSON();
    const history = Array.isArray(raw.pendaftaranPenjalurans)
      ? raw.pendaftaranPenjalurans
      : [];

    const sortedHistory = [...history].sort((a, b) => {
      const startA = parseAcademicYearStart(a.periode?.tahun_akademik);
      const startB = parseAcademicYearStart(b.periode?.tahun_akademik);
      if (startA !== startB) return startA - startB;

      const semA = getSemesterOrder(a.periode?.semester) || 9;
      const semB = getSemesterOrder(b.periode?.semester) || 9;
      if (semA !== semB) return semA - semB;

      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    let semesterPenjaluranCounter = 0;
    let lastPeriodeKey = null;
    let firstPeriodeRank = null;

    const riwayatPenjaluran = sortedHistory.map((item) => {
      const periodeKey =
        item.periode?.label_periode ||
        `${parseAcademicYearStart(item.periode?.tahun_akademik)}-${String(
          item.periode?.semester || ""
        ).toLowerCase()}`;

      if (periodeKey !== lastPeriodeKey) {
        semesterPenjaluranCounter += 1;
        lastPeriodeKey = periodeKey;
      }

      const itemPeriodeRank = getPeriodeRank(
        item.periode?.tahun_akademik,
        item.periode?.semester
      );
      if (itemPeriodeRank !== null && firstPeriodeRank === null) {
        firstPeriodeRank = itemPeriodeRank;
      }

      const dosenPembimbingTA = resolvePembimbingTAFromPendaftaran(item);

      return {
        id: item.id,
        jalur: item.jalur,
        program_kuliah: item.program_kuliah,
        status: item.status,
        semester_mahasiswa: item.semester_mahasiswa,
        semester_penjaluran_ke: semesterPenjaluranCounter,
        nama_penjaluran: resolveNamaPenjaluranFromPendaftaran(item),
        periode_penjaluran: item.periode
          ? {
              id: item.periode.id,
              label_periode: item.periode.label_periode,
              tahun_akademik: item.periode.tahun_akademik,
              semester: item.periode.semester,
            }
          : null,
        pembimbing_ta: dosenPembimbingTA
          ? {
              id: dosenPembimbingTA.id,
              nik: dosenPembimbingTA.nik,
              nama: dosenPembimbingTA.nama,
            }
          : null,
        dosen_pembimbing_ta_sebelumnya: item.dosenPembimbingTASebelumnya
          ? {
              id: item.dosenPembimbingTASebelumnya.id,
              nik: item.dosenPembimbingTASebelumnya.nik,
              nama: item.dosenPembimbingTASebelumnya.nama,
            }
          : null,
        dosen_pembimbing_ta_baru: item.dosenPembimbingTABaru
          ? {
              id: item.dosenPembimbingTABaru.id,
              nik: item.dosenPembimbingTABaru.nik,
              nama: item.dosenPembimbingTABaru.nama,
            }
          : null,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      };
    });

    let semesterPenjaluranAktif = riwayatPenjaluran.length;
    if (riwayatPenjaluran.length > 0 && firstPeriodeRank !== null && activePeriodeRank !== null) {
      const diff = activePeriodeRank - firstPeriodeRank;
      semesterPenjaluranAktif = diff >= 0 ? diff + 1 : 1;
    }

    const riwayatPenjaluranWithActiveSemester = riwayatPenjaluran.map((item) => ({
      ...item,
      semester_penjaluran_aktif: semesterPenjaluranAktif,
    }));

    const latestProgramKuliah =
      riwayatPenjaluranWithActiveSemester[riwayatPenjaluranWithActiveSemester.length - 1]
        ?.program_kuliah || "reguler";

    return {
      ...raw,
      program_kuliah: latestProgramKuliah,
      semester_penjaluran_aktif: semesterPenjaluranAktif,
      riwayat_penjaluran: riwayatPenjaluranWithActiveSemester,
    };
  });
}

async function fetchMahasiswaMasterData({ status_jalur, angkatan, program_kuliah } = {}) {
  const where = {};

  if (status_jalur) {
    where.status_jalur_saat_ini = status_jalur;
  }
  if (angkatan) {
    where.angkatan = angkatan;
  }

  const mahasiswas = await Mahasiswa.findAll({
    where,
    attributes: { exclude: ["password"] },
    include: [
      {
        model: Dosen,
        as: "dosenPembimbingAkademik",
        attributes: ["id", "nik", "nama"],
      },
      {
        model: Dosen,
        as: "dosenPembimbingSkripsi",
        attributes: ["id", "nik", "nama"],
      },
      {
        model: Pengajuan,
        as: "pengajuanAktif",
        attributes: ["id", "jenis_jalur", "tipe_pengajuan", "status"],
      },
      {
        model: PendaftaranPenjaluran,
        as: "pendaftaranPenjalurans",
        attributes: [
          "id",
          "jalur",
          "program_kuliah",
          "status",
          "semester_mahasiswa",
          "jenis_jalur_diambil",
          "penjaluran_sebelumnya",
          "penjaluran_baru",
          "createdAt",
          "updatedAt",
        ],
        include: [
          {
            model: PeriodePenjaluran,
            as: "periode",
            attributes: ["id", "tahun_akademik", "semester", "label_periode"],
            required: false,
          },
          {
            model: Dosen,
            as: "dosenPembimbingTA",
            attributes: ["id", "nik", "nama"],
            required: false,
          },
          {
            model: Dosen,
            as: "dosenPembimbingTASebelumnya",
            attributes: ["id", "nik", "nama"],
            required: false,
          },
          {
            model: Dosen,
            as: "dosenPembimbingTABaru",
            attributes: ["id", "nik", "nama"],
            required: false,
          },
        ],
        separate: true,
        order: [["createdAt", "ASC"]],
      },
    ],
    order: [["nim", "ASC"]],
  });

  const referencePeriode = await getReferencePeriode();

  const rows = mapMahasiswaMasterRows(mahasiswas, referencePeriode);
  return program_kuliah
    ? rows.filter((item) => item.program_kuliah === program_kuliah)
    : rows;
}

module.exports = {
  fetchMahasiswaMasterData,
};
