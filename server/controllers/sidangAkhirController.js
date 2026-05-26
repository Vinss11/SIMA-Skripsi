const { Op } = require("sequelize");
const {
  sequelize,
  Mahasiswa,
  Dosen,
  BimbinganSkripsi,
  DokumenSidang,
  PeriodeSidang,
  PeriodeSidangHari,
  PeriodeSidangRuangan,
  PendaftaranSidang,
  KetersediaanPengujiSidang,
  JadwalSidangPenguji,
} = require("../models");

const TARGET_MINIMUM_BIMBINGAN = 8;
const DOKUMEN_APPROVAL_FIELDS = [
  "transkrip_status",
  "cept_status",
  "draft_skripsi_status",
];

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
  if (day === 0 || day === 6) return [];
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
  const counted = await BimbinganSkripsi.count({
    where: {
      mahasiswa_id: mahasiswaId,
      status_resume: "approved",
      is_counted: true,
    },
    transaction: transaction || undefined,
  });
  return Number(counted || 0);
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
  };
  if (!doc) return summary;
  let approved = 0;
  DOKUMEN_APPROVAL_FIELDS.forEach((field) => {
    if (String(doc[field] || "").toLowerCase() === "approved") approved += 1;
  });
  summary.approved_count = approved;
  summary.all_approved = approved === DOKUMEN_APPROVAL_FIELDS.length;
  return summary;
}

async function getMahasiswaSidangEligibility(mahasiswaId, transaction = null) {
  const countedSessions = await getCountedBimbingan(mahasiswaId, transaction);
  const dokumen = await getDokumenSidangApprovalSummary(mahasiswaId, transaction);
  const bimbinganReady = countedSessions >= TARGET_MINIMUM_BIMBINGAN;
  const eligible = bimbinganReady && dokumen.all_approved;
  return {
    counted_sessions: countedSessions,
    target_minimum: TARGET_MINIMUM_BIMBINGAN,
    bimbingan_ready: bimbinganReady,
    dokumen_approved_count: dokumen.approved_count,
    dokumen_total_required: DOKUMEN_APPROVAL_FIELDS.length,
    dokumen_ready: dokumen.all_approved,
    eligible,
  };
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
  const strictCountA = (pairA.tipeA === "ketat" ? 1 : 0) + (pairA.tipeB === "ketat" ? 1 : 0);
  const strictCountB = (pairB.tipeA === "ketat" ? 1 : 0) + (pairB.tipeB === "ketat" ? 1 : 0);
  // Prefer 1 ketat + 1 santai, then santai+santai.
  const rankA = strictCountA === 1 ? 0 : strictCountA === 0 ? 1 : 99;
  const rankB = strictCountB === 1 ? 0 : strictCountB === 0 ? 1 : 99;
  if (rankA !== rankB) return rankA - rankB;
  if (pairA.loadScore !== pairB.loadScore) return pairA.loadScore - pairB.loadScore;
  return pairA.idScore - pairB.idScore;
}

function isOpenRegistrationWindow(periode, nowDateOnly) {
  if (!periode || String(periode.status).toLowerCase() !== "open") return false;
  return periode.tanggal_mulai_pendaftaran <= nowDateOnly && nowDateOnly <= periode.tanggal_selesai_pendaftaran;
}

function mapAvailabilityRows(rows) {
  const map = new Map();
  rows.forEach((row) => {
    const key = buildSidangSlotKey(row.tanggal_sidang, row.sesi_ke);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push({
      dosen_id: Number(row.dosen_id),
      tipe_penilaian: String(row.tipe_penilaian || "santai").toLowerCase(),
      kondisi_fisik: String(row.kondisi_fisik || "fit").toLowerCase(),
    });
  });
  return map;
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
        }
      : null,
    penguji2: item.penguji2
      ? {
          id: item.penguji2.id,
          nama: item.penguji2.nama,
          nik: item.penguji2.nik,
        }
      : null,
  };
}

exports.getMahasiswaSidangStatus = async (req, res) => {
  try {
    const mahasiswaId = Number(req.user.id);
    const nowJakarta = nowJakartaDateTime();
    const [mahasiswa, eligibility, openPeriode] = await Promise.all([
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
        dosen_pembimbing: mahasiswa.dosenPembimbingSkripsi
          ? {
              id: mahasiswa.dosenPembimbingSkripsi.id,
              nama: mahasiswa.dosenPembimbingSkripsi.nama,
              nik: mahasiswa.dosenPembimbingSkripsi.nik,
              email: mahasiswa.dosenPembimbingSkripsi.email,
            }
          : null,
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

    const eligibility = await getMahasiswaSidangEligibility(mahasiswaId, transaction);
    if (!eligibility.eligible) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: "Belum memenuhi syarat daftar sidang. Selesaikan 8 bimbingan valid dan pastikan 3 dokumen disetujui.",
        data: { eligibility },
      });
    }

    const openPeriode = await getOpenPeriodeSidang(transaction);
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
          dosen_pembimbing_id: mahasiswa.dosen_pembimbing_skripsi_id || null,
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
    const labelPeriode = String(req.body?.label_periode || "").trim();
    const tanggalMulai = normalizeDateOnly(req.body?.tanggal_mulai_pendaftaran);
    const tanggalSelesai = normalizeDateOnly(req.body?.tanggal_selesai_pendaftaran);
    const tanggalSidangList = sanitizeDateList(req.body?.tanggal_sidang_list);
    const ruanganList = sanitizeRoomList(req.body?.ruangan_list);

    if (!labelPeriode) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Label periode sidang wajib diisi.",
      });
    }
    if (!tanggalMulai || !tanggalSelesai || tanggalMulai > tanggalSelesai) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Tanggal pendaftaran sidang tidak valid.",
      });
    }
    if (tanggalSidangList.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Pilih minimal 1 hari sidang (Senin-Jumat).",
      });
    }
    if (ruanganList.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Pilih minimal 1 ruangan sidang.",
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
        message: "Label periode sidang sudah digunakan.",
      });
    }

    const periode = await PeriodeSidang.create(
      {
        label_periode: labelPeriode,
        tanggal_mulai_pendaftaran: tanggalMulai,
        tanggal_selesai_pendaftaran: tanggalSelesai,
        status: "draft",
        catatan: String(req.body?.catatan || "").trim() || null,
        created_by_sekretaris_id: req.user?.id || null,
      },
      { transaction }
    );

    await PeriodeSidangHari.bulkCreate(
      tanggalSidangList.map((tanggal) => ({
        periode_sidang_id: periode.id,
        tanggal_sidang: tanggal,
      })),
      { transaction }
    );

    await PeriodeSidangRuangan.bulkCreate(
      ruanganList.map((ruangan) => ({
        periode_sidang_id: periode.id,
        nama_ruangan: ruangan,
      })),
      { transaction }
    );

    await transaction.commit();

    return res.json({
      success: true,
      message: `Periode sidang ${labelPeriode} berhasil dibuat.`,
      data: {
        periode: {
          id: periode.id,
          label_periode: periode.label_periode,
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

    const tanggalMulai = normalizeDateOnly(req.body?.tanggal_mulai_pendaftaran || periode.tanggal_mulai_pendaftaran);
    const tanggalSelesai = normalizeDateOnly(req.body?.tanggal_selesai_pendaftaran || periode.tanggal_selesai_pendaftaran);
    if (!tanggalMulai || !tanggalSelesai || tanggalMulai > tanggalSelesai) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Rentang tanggal pendaftaran tidak valid.",
      });
    }

    const nextLabel = String(req.body?.label_periode || periode.label_periode).trim();
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
        message: "Label periode sidang sudah digunakan periode lain.",
      });
    }

    periode.label_periode = nextLabel;
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
          message: "Pilih minimal 1 hari sidang (Senin-Jumat).",
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

    const rows = await PendaftaranSidang.findAll({
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
          attributes: ["id", "nama", "nik"],
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
      order: [["registered_at", "ASC"]],
    });

    return res.json({
      success: true,
      data: {
        periode_sidang: {
          id: targetPeriode.id,
          label_periode: targetPeriode.label_periode,
          tanggal_mulai_pendaftaran: targetPeriode.tanggal_mulai_pendaftaran,
          tanggal_selesai_pendaftaran: targetPeriode.tanggal_selesai_pendaftaran,
          status: targetPeriode.status,
        },
        rows: rows.map((row) => ({
          id: row.id,
          status: row.status,
          registered_at: row.registered_at,
          assigned_at: row.assigned_at,
          catatan: row.catatan,
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
        })),
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

exports.autoAssignSidangPenguji = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
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
      lock: transaction.LOCK.UPDATE,
    });
    if (!periode) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Periode sidang tidak ditemukan.",
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
        message: "Tidak ada slot sidang valid. Pilih hari Senin-Jumat.",
      });
    }

    const pendingRegistrations = await PendaftaranSidang.findAll({
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
      lock: transaction.LOCK.UPDATE,
      order: [["registered_at", "ASC"], ["id", "ASC"]],
    });

    if (pendingRegistrations.length === 0) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: "Tidak ada pendaftar sidang yang menunggu penjadwalan.",
      });
    }

    const availabilityRows = await KetersediaanPengujiSidang.findAll({
      where: { periode_sidang_id: periode.id },
      transaction,
    });
    if (availabilityRows.length === 0) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: "Belum ada dosen yang mengisi ketersediaan penguji.",
      });
    }

    const availabilityBySlot = mapAvailabilityRows(availabilityRows);
    const assignedRows = await JadwalSidangPenguji.findAll({
      where: {
        periode_sidang_id: periode.id,
        assignment_status: { [Op.in]: ["assigned", "finalized"] },
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    const usedRoomSlots = new Set();
    const dosenBusyBySlot = new Map();
    const dosenDailyRoomConstraint = new Map();
    const dosenLoadCounter = new Map();

    assignedRows.forEach((row) => {
      usedRoomSlots.add(buildRoomSlotKey(row.tanggal_sidang, row.sesi_ke, row.ruangan));
      const slotKey = buildSidangSlotKey(row.tanggal_sidang, row.sesi_ke);
      if (!dosenBusyBySlot.has(slotKey)) dosenBusyBySlot.set(slotKey, new Set());
      dosenBusyBySlot.get(slotKey).add(Number(row.penguji1_dosen_id));
      dosenBusyBySlot.get(slotKey).add(Number(row.penguji2_dosen_id));
      dosenLoadCounter.set(Number(row.penguji1_dosen_id), (dosenLoadCounter.get(Number(row.penguji1_dosen_id)) || 0) + 1);
      dosenLoadCounter.set(Number(row.penguji2_dosen_id), (dosenLoadCounter.get(Number(row.penguji2_dosen_id)) || 0) + 1);
    });

    const autoAssigned = [];
    const unassigned = [];
    const assignedAtNow = new Date(nowJakartaDateTime().datetime);

    for (const reg of pendingRegistrations) {
      const pembimbingId = Number(
        reg.dosen_pembimbing_id || reg.mahasiswa?.dosen_pembimbing_skripsi_id || 0
      );
      let foundSchedule = null;

      for (const slot of slots) {
        const roomSlotKey = slot.slot_key;
        if (usedRoomSlots.has(roomSlotKey)) continue;

        const availabilitySlotKey = buildSidangSlotKey(slot.tanggal_sidang, slot.sesi_ke);
        const candidates = availabilityBySlot.get(availabilitySlotKey) || [];
        if (candidates.length < 2) continue;

        const busyInSlot = dosenBusyBySlot.get(availabilitySlotKey) || new Set();
        const validPairs = [];
        for (let i = 0; i < candidates.length; i += 1) {
          for (let j = i + 1; j < candidates.length; j += 1) {
            const first = candidates[i];
            const second = candidates[j];
            if (first.dosen_id === second.dosen_id) continue;
            if (first.dosen_id === pembimbingId || second.dosen_id === pembimbingId) continue;
            if (busyInSlot.has(first.dosen_id) || busyInSlot.has(second.dosen_id)) continue;

            const strictCount =
              (first.tipe_penilaian === "ketat" ? 1 : 0) + (second.tipe_penilaian === "ketat" ? 1 : 0);
            if (strictCount >= 2) continue;

            const firstDayKey = `${slot.tanggal_sidang}#${first.dosen_id}`;
            const secondDayKey = `${slot.tanggal_sidang}#${second.dosen_id}`;
            const firstRoomBound = dosenDailyRoomConstraint.get(firstDayKey);
            const secondRoomBound = dosenDailyRoomConstraint.get(secondDayKey);

            if (first.kondisi_fisik === "tidak_fit" && firstRoomBound && firstRoomBound !== slot.ruangan) continue;
            if (second.kondisi_fisik === "tidak_fit" && secondRoomBound && secondRoomBound !== slot.ruangan) continue;

            validPairs.push({
              dosenA: first.dosen_id,
              dosenB: second.dosen_id,
              tipeA: first.tipe_penilaian,
              tipeB: second.tipe_penilaian,
              kondisiA: first.kondisi_fisik,
              kondisiB: second.kondisi_fisik,
              loadScore:
                Number(dosenLoadCounter.get(first.dosen_id) || 0) + Number(dosenLoadCounter.get(second.dosen_id) || 0),
              idScore: first.dosen_id + second.dosen_id,
            });
          }
        }

        if (validPairs.length === 0) continue;
        validPairs.sort(pairPreferenceScore);
        const chosen = validPairs[0];

        foundSchedule = {
          ...slot,
          penguji1_dosen_id: chosen.dosenA,
          penguji2_dosen_id: chosen.dosenB,
          kondisiA: chosen.kondisiA,
          kondisiB: chosen.kondisiB,
        };
        break;
      }

      if (!foundSchedule) {
        unassigned.push({
          pendaftaran_sidang_id: reg.id,
          mahasiswa_id: reg.mahasiswa_id,
          mahasiswa_nim: reg.mahasiswa?.nim || "-",
          mahasiswa_nama: reg.mahasiswa?.nama || "-",
          reason: "Tidak menemukan kombinasi penguji yang memenuhi aturan pada slot tersedia.",
        });
        continue;
      }

      const scheduleRow = await JadwalSidangPenguji.create(
        {
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
        },
        { transaction }
      );

      reg.status = "scheduled";
      reg.assigned_at = assignedAtNow;
      await reg.save({ transaction });

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

      if (foundSchedule.kondisiA === "tidak_fit") {
        dosenDailyRoomConstraint.set(
          `${foundSchedule.tanggal_sidang}#${foundSchedule.penguji1_dosen_id}`,
          foundSchedule.ruangan
        );
      }
      if (foundSchedule.kondisiB === "tidak_fit") {
        dosenDailyRoomConstraint.set(
          `${foundSchedule.tanggal_sidang}#${foundSchedule.penguji2_dosen_id}`,
          foundSchedule.ruangan
        );
      }

      autoAssigned.push({
        jadwal_id: scheduleRow.id,
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
      });
    }

    await transaction.commit();

    return res.json({
      success: true,
      message: `Auto-assign selesai. ${autoAssigned.length} mahasiswa berhasil dijadwalkan.`,
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

    const periode =
      (await getOpenPeriodeSidang()) ||
      (await PeriodeSidang.findOne({
        where: { status: { [Op.in]: ["open", "draft"] } },
        order: [["updatedAt", "DESC"]],
      }));

    if (!periode) {
      return res.json({
        success: true,
        data: {
          periode_sidang: null,
          slots: [],
          ketersediaan: [],
          jadwal_anda: [],
        },
      });
    }

    const [hariRows, roomRows, availabilityRows, jadwalRows] = await Promise.all([
      PeriodeSidangHari.findAll({
        where: { periode_sidang_id: periode.id },
        order: [["tanggal_sidang", "ASC"]],
      }),
      PeriodeSidangRuangan.findAll({
        where: { periode_sidang_id: periode.id },
        order: [["nama_ruangan", "ASC"]],
      }),
      KetersediaanPengujiSidang.findAll({
        where: {
          periode_sidang_id: periode.id,
          dosen_id: dosenId,
        },
        order: [["tanggal_sidang", "ASC"], ["sesi_ke", "ASC"]],
      }),
      JadwalSidangPenguji.findAll({
        where: {
          periode_sidang_id: periode.id,
          [Op.or]: [{ penguji1_dosen_id: dosenId }, { penguji2_dosen_id: dosenId }],
          assignment_status: { [Op.in]: ["assigned", "finalized"] },
        },
        include: [
          {
            model: Mahasiswa,
            as: "mahasiswa",
            attributes: ["id", "nim", "nama"],
          },
        ],
        order: [["tanggal_sidang", "ASC"], ["sesi_ke", "ASC"]],
      }),
    ]);

    const slots = [];
    hariRows.forEach((hari) => {
      getSessionTemplateByDate(hari.tanggal_sidang).forEach((session) => {
        slots.push({
          tanggal_sidang: hari.tanggal_sidang,
          sesi_ke: session.sesi_ke,
          sesi_mulai: session.sesi_mulai,
          sesi_selesai: session.sesi_selesai,
        });
      });
    });

    return res.json({
      success: true,
      data: {
        periode_sidang: serializePeriode(periode, hariRows, roomRows),
        slots,
        ketersediaan: availabilityRows.map((row) => ({
          id: row.id,
          tanggal_sidang: row.tanggal_sidang,
          sesi_ke: row.sesi_ke,
          tipe_penilaian: row.tipe_penilaian,
          kondisi_fisik: row.kondisi_fisik,
        })),
        jadwal_anda: jadwalRows.map((row) => ({
          id: row.id,
          tanggal_sidang: row.tanggal_sidang,
          sesi_ke: row.sesi_ke,
          sesi_mulai: row.sesi_mulai,
          sesi_selesai: row.sesi_selesai,
          ruangan: row.ruangan,
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

    const availabilityInput = Array.isArray(req.body?.ketersediaan) ? req.body.ketersediaan : [];
    const hariRows = await PeriodeSidangHari.findAll({
      where: { periode_sidang_id: periode.id },
      transaction,
    });
    const allowedDates = new Set(hariRows.map((item) => item.tanggal_sidang));

    const normalizedRows = [];
    const uniqueKey = new Set();
    availabilityInput.forEach((item) => {
      const tanggal = normalizeDateOnly(item?.tanggal_sidang);
      const sesiKe = Number(item?.sesi_ke || 0);
      const tipe = String(item?.tipe_penilaian || "santai").toLowerCase();
      const kondisi = String(item?.kondisi_fisik || "fit").toLowerCase();
      const isAvailable = item?.is_available !== false;
      if (!isAvailable) return;
      if (!tanggal || !allowedDates.has(tanggal)) return;
      const sessions = getSessionTemplateByDate(tanggal);
      if (!sessions.some((session) => session.sesi_ke === sesiKe)) return;
      if (!["ketat", "santai"].includes(tipe)) return;
      if (!["fit", "tidak_fit"].includes(kondisi)) return;
      const dedupe = `${tanggal}#${sesiKe}`;
      if (uniqueKey.has(dedupe)) return;
      uniqueKey.add(dedupe);
      normalizedRows.push({
        periode_sidang_id: periode.id,
        dosen_id: dosenId,
        tanggal_sidang: tanggal,
        sesi_ke: sesiKe,
        tipe_penilaian: tipe,
        kondisi_fisik: kondisi,
      });
    });

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

    await transaction.commit();
    return res.json({
      success: true,
      message: "Ketersediaan penguji sidang berhasil disimpan.",
      data: {
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
