const { Op } = require("sequelize");
const {
  BimbinganSkripsi,
  Mahasiswa,
  Dosen,
  Pengajuan,
  SekretarisProdi,
  PendaftaranPenjaluran,
  PeriodePenjaluran,
  PenetapanPembimbingDosen,
  sequelize,
} = require("../models");
const {
  getExistingSupervisionPermission,
  canContinueExistingSupervision,
} = require("../services/dosenStatusService");
const {
  getSupervisedMahasiswaIdsWithLegacyFallback,
} = require("../services/supervisorAccessService");
const {
  getMahasiswaSupervisionAccess,
  sendSupervisionAccessDenied,
} = require("../services/mahasiswaSupervisionAccessService");
const { getActiveSupervisorAssignment } = require("../services/penetapanPembimbingService");

async function ensureExistingSupervisionAccess(dosenId, transaction = null) {
  return getExistingSupervisionPermission(dosenId, transaction);
}

const TARGET_SESI_MINIMAL = 8;
const NON_PENELITIAN_JALUR_SET = new Set(["magang", "pengabdian", "perintisan_bisnis"]);
const JAKARTA_TIME_ZONE = "Asia/Jakarta";

function isValidJam(value) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(String(value || "").trim());
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

function nowJakartaDateTimeParts() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: JAKARTA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = formatter.formatToParts(new Date()).reduce((accumulator, part) => {
    if (part.type !== "literal") {
      accumulator[part.type] = part.value;
    }
    return accumulator;
  }, {});
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

function todayDateOnly() {
  return nowJakartaDateTimeParts().date;
}

function isScheduleAlreadyPassed(tanggal, jam) {
  const normalizedTanggal = normalizeDateOnly(tanggal);
  if (!normalizedTanggal) return false;

  const now = nowJakartaDateTimeParts();
  if (normalizedTanggal < now.date) return true;
  if (normalizedTanggal > now.date) return false;

  if (!isValidJam(jam)) return false;
  return String(jam).trim() <= now.time;
}

function normalizeResumeStatusLabel(status) {
  const map = {
    belum_diisi: "Belum Diisi",
    submitted: "Menunggu Review",
    approved: "Disetujui",
    revisi: "Perlu Revisi",
    rejected: "Ditolak",
  };
  return map[String(status || "").toLowerCase()] || String(status || "-");
}

function normalizePermohonanStatusLabel(status) {
  const map = {
    pending: "Menunggu Review",
    approved: "Disetujui",
    rescheduled: "Di-reschedule & Disetujui",
    rejected: "Ditolak",
    expired: "Expired (Ditarik Mahasiswa)",
    cancelled_supervisor_change: "Dibatalkan karena Pergantian Pembimbing",
  };
  return map[String(status || "").toLowerCase()] || String(status || "-");
}

function serializeRow(row) {
  const item = row?.toJSON ? row.toJSON() : row;
  if (!item) return null;
  return {
    id: item.id,
    mahasiswa_id: item.mahasiswa_id,
    dosen_id: item.dosen_id,
    reviewer_dosen_id: item.reviewer_dosen_id,
    pengajuan_id: item.pengajuan_id,
    pendaftaran_penjaluran_id: item.pendaftaran_penjaluran_id,
    permintaan_pesan: item.permintaan_pesan,
    permintaan_tanggal: item.permintaan_tanggal,
    permintaan_jam: item.permintaan_jam,
    status_permohonan: item.status_permohonan,
    status_permohonan_label: normalizePermohonanStatusLabel(item.status_permohonan),
    catatan_dosen: item.catatan_dosen,
    lokasi_bimbingan: item.lokasi_bimbingan,
    tanggal_keputusan: item.tanggal_keputusan,
    status_resume: item.status_resume,
    status_resume_label: normalizeResumeStatusLabel(item.status_resume),
    resume_mahasiswa: item.resume_mahasiswa,
    catatan_review_resume: item.catatan_review_resume,
    tanggal_review_resume: item.tanggal_review_resume,
    reviewer_dosen_id: item.reviewer_dosen_id,
    reassigned_reviewer_at: item.reassigned_reviewer_at,
    is_counted: Boolean(item.is_counted),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    mahasiswa: item.mahasiswa
      ? {
          id: item.mahasiswa.id,
          nim: item.mahasiswa.nim,
          nama: item.mahasiswa.nama,
          email: item.mahasiswa.email,
          angkatan: item.mahasiswa.angkatan,
        }
      : null,
    dosen: item.dosen
      ? {
          id: item.dosen.id,
          nik: item.dosen.nik,
          nama: item.dosen.nama,
          email: item.dosen.email,
        }
      : null,
    pengajuan: item.pengajuan
      ? {
          id: item.pengajuan.id,
          jenis_jalur: item.pengajuan.jenis_jalur,
          tipe_pengajuan: item.pengajuan.tipe_pengajuan,
          status: item.pengajuan.status,
        }
      : null,
  };
}

function buildStatFromRows(rows) {
  const total = rows.length;
  const pending_permohonan = rows.filter((item) => item.status_permohonan === "pending").length;
  const approved_permohonan = rows.filter((item) => item.status_permohonan === "approved").length;
  const rescheduled_permohonan = rows.filter((item) => item.status_permohonan === "rescheduled").length;
  const rejected_permohonan = rows.filter((item) => item.status_permohonan === "rejected").length;
  const expired_permohonan = rows.filter((item) => item.status_permohonan === "expired").length;
  const submitted_resume = rows.filter((item) => item.status_resume === "submitted").length;
  const approved_resume = rows.filter((item) => item.status_resume === "approved").length;
  const counted_sessions = rows.filter((item) => item.status_resume === "approved" && item.is_counted).length;
  const progress_percent = Math.min(100, Math.round((counted_sessions / TARGET_SESI_MINIMAL) * 100));

  return {
    target_minimum: TARGET_SESI_MINIMAL,
    total_sesi: total,
    pending_permohonan,
    approved_permohonan,
    rescheduled_permohonan,
    accepted_permohonan: approved_permohonan + rescheduled_permohonan,
    rejected_permohonan,
    expired_permohonan,
    submitted_resume,
    approved_resume,
    counted_sessions,
    progress_percent,
  };
}

async function resolveAuthenticatedDosenId(req, transaction = null) {
  if (req.user?.role === "dosen") {
    return req.user.id;
  }

  if (req.user?.role !== "sekretaris_prodi") {
    return null;
  }

  const sekretaris = await SekretarisProdi.findByPk(req.user.id, {
    attributes: ["nik", "email", "jabatan"],
    transaction: transaction || undefined,
  });

  if (!sekretaris) return null;

  const orWhere = [];
  if (sekretaris.nik) orWhere.push({ nik: String(sekretaris.nik).trim() });
  if (sekretaris.email) orWhere.push({ email: String(sekretaris.email).trim().toLowerCase() });

  const username = String(req.user?.username || "").trim();
  if (username) {
    orWhere.push({ nik: username });
    orWhere.push({ email: username.toLowerCase() });
  }

  if (orWhere.length === 0) return null;

  let dosen = await Dosen.findOne({
    where: { [Op.or]: orWhere },
    attributes: ["id"],
    transaction: transaction || undefined,
  });

  if (!dosen && sekretaris.jabatan) {
    dosen = await Dosen.findOne({
      where: { jabatan_struktural: sekretaris.jabatan },
      attributes: ["id"],
      transaction: transaction || undefined,
    });
  }

  return dosen?.id || null;
}

function resolveSelectedJalurFromPendaftaran(pendaftaran) {
  if (!pendaftaran) return null;

  if (pendaftaran.jalur === "baru") {
    return pendaftaran.jenis_jalur_diambil || null;
  }
  if (pendaftaran.jalur === "ulang") {
    return pendaftaran.jenis_jalur_diambil || pendaftaran.jenis_jalur_ulang || null;
  }
  if (pendaftaran.jalur === "alih") {
    return pendaftaran.penjaluran_baru || null;
  }

  return null;
}

async function getLatestPendaftaranForBimbingan(mahasiswaId, transaction) {
  const periodeAktif = await PeriodePenjaluran.findOne({
    where: { is_active: true },
    attributes: ["id"],
    order: [["updatedAt", "DESC"]],
    transaction,
  });

  if (periodeAktif) {
    const inActivePeriode = await PendaftaranPenjaluran.findOne({
      where: {
        mahasiswa_id: mahasiswaId,
        periode_penjaluran_id: periodeAktif.id,
      },
      order: [["createdAt", "DESC"]],
      transaction,
    });

    if (inActivePeriode) {
      return inActivePeriode;
    }
  }

  return PendaftaranPenjaluran.findOne({
    where: { mahasiswa_id: mahasiswaId },
    order: [["createdAt", "DESC"]],
    transaction,
  });
}

// ========== MAHASISWA ==========

exports.getMahasiswaBimbingan = async (req, res) => {
  try {
    const mahasiswa_id = req.user.id;
    const summaryOnly = String(req.query.summary_only || "").toLowerCase() === "1";

    const mahasiswa = await Mahasiswa.findByPk(mahasiswa_id, {
      attributes: ["id", "nim", "nama", "email", "angkatan", "dosen_pembimbing_skripsi_id"],
      include: [
        {
          model: Dosen,
          as: "dosenPembimbingSkripsi",
          attributes: ["id", "nik", "nama", "email"],
        },
      ],
    });

    if (!mahasiswa) {
      return res.status(404).json({
        success: false,
        message: "Data mahasiswa tidak ditemukan",
      });
    }

    const rows = await BimbinganSkripsi.findAll({
      where: { mahasiswa_id },
      include: [
        {
          model: Dosen,
          as: "dosen",
          attributes: ["id", "nik", "nama", "email"],
        },
        {
          model: Pengajuan,
          as: "pengajuan",
          attributes: ["id", "jenis_jalur", "tipe_pengajuan", "status"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    const serializedRows = rows.map(serializeRow).filter(Boolean);
    const stats = buildStatFromRows(serializedRows);
    const supervisionAccess = await getMahasiswaSupervisionAccess(mahasiswa_id);

    return res.json({
      success: true,
      data: {
        mahasiswa: {
          id: mahasiswa.id,
          nim: mahasiswa.nim,
          nama: mahasiswa.nama,
          email: mahasiswa.email,
          angkatan: mahasiswa.angkatan,
        },
        dosen_pembimbing: supervisionAccess.current_supervisor || (mahasiswa.dosenPembimbingSkripsi
          ? {
              id: mahasiswa.dosenPembimbingSkripsi.id,
              nik: mahasiswa.dosenPembimbingSkripsi.nik,
              nama: mahasiswa.dosenPembimbingSkripsi.nama,
              email: mahasiswa.dosenPembimbingSkripsi.email,
            }
          : null),
        supervision_access: supervisionAccess,
        stats,
        rows: summaryOnly ? [] : serializedRows,
      },
    });
  } catch (error) {
    console.error("Error di getMahasiswaBimbingan:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

exports.createMahasiswaBimbingan = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const mahasiswa_id = req.user.id;
    const pesan = String(req.body?.pesan || "").trim();
    const tanggal = normalizeDateOnly(req.body?.tanggal);
    const jam = String(req.body?.jam || "").trim();
    const targetSupervisorId = Number(req.body?.dosen_pembimbing_id || 0);

    if (!pesan || pesan.length < 10) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Pesan bimbingan minimal 10 karakter",
        detail: { field: "pesan" },
      });
    }

    if (!tanggal) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Tanggal bimbingan wajib diisi",
        detail: { field: "tanggal" },
      });
    }

    if (!isValidJam(jam)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Format jam harus HH:mm (contoh 09:30)",
        detail: { field: "jam" },
      });
    }

    if (tanggal < todayDateOnly()) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Tanggal bimbingan tidak boleh di masa lalu",
        detail: { field: "tanggal" },
      });
    }

    const mahasiswa = await Mahasiswa.findByPk(mahasiswa_id, {
      attributes: ["id", "dosen_pembimbing_skripsi_id", "status_jalur_saat_ini"],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!mahasiswa) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Data mahasiswa tidak ditemukan",
      });
    }

    const supervisionAccess = await getMahasiswaSupervisionAccess(mahasiswa_id, transaction);
    if (!supervisionAccess.can_create_guidance) {
      await transaction.rollback();
      return sendSupervisionAccessDenied(res, supervisionAccess, "create_guidance");
    }
    const activeSupervisorIds = new Set(
      (supervisionAccess.current_supervisors || []).map((item) => Number(item.id)).filter(Boolean)
    );
    if (!targetSupervisorId || !activeSupervisorIds.has(targetSupervisorId)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Pilih salah satu dosen pembimbing aktif sebagai tujuan bimbingan.",
        detail: { field: "dosen_pembimbing_id" },
      });
    }
    const targetSupervisor = (supervisionAccess.current_supervisors || [])
      .find((item) => Number(item.id) === targetSupervisorId);
    if (!canContinueExistingSupervision(targetSupervisor)) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: "Dosen tujuan sedang tidak dapat melanjutkan bimbingan.",
        detail: { field: "dosen_pembimbing_id" },
      });
    }

    const activeAssignment = await getActiveSupervisorAssignment(mahasiswa_id, transaction);
    if (!activeAssignment.penetapan || !activeAssignment.penetapan.pendaftaran_penjaluran_id) {
      await transaction.rollback();
      return res.status(409).json({ success: false, message: "Assignment pembimbing aktif belum terikat ke siklus penjaluran.", code: "ACTIVE_ASSIGNMENT_REQUIRED" });
    }
    const assignmentMember = await PenetapanPembimbingDosen.findOne({
      where: { penetapan_pembimbing_id: activeAssignment.penetapan.id, dosen_id: targetSupervisorId, status: "active" },
      transaction,
    });
    if (!assignmentMember) {
      await transaction.rollback();
      return res.status(409).json({ success: false, message: "Dosen tujuan bukan anggota assignment aktif.", code: "SUPERVISOR_ASSIGNMENT_MISMATCH" });
    }
    const pendaftaranAktif = await PendaftaranPenjaluran.findByPk(activeAssignment.penetapan.pendaftaran_penjaluran_id, { transaction });
    const selectedJalur = resolveSelectedJalurFromPendaftaran(pendaftaranAktif);

    const selectedJalurIsNonPenelitian =
      selectedJalur && NON_PENELITIAN_JALUR_SET.has(String(selectedJalur).toLowerCase());
    const nonPenelitianStatus = String(pendaftaranAktif?.form_lanjutan_status || "").toLowerCase();
    if (selectedJalurIsNonPenelitian && nonPenelitianStatus !== "approved") {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: `Menu bimbingan belum aktif untuk jalur ${String(selectedJalur)
          .replace(/_/g, " ")
          .replace(/\b\w/g, (char) => char.toUpperCase())}.`,
        detail: {
          field: "jalur",
          selected_jalur: selectedJalur,
          reason: "Bimbingan akan aktif setelah keputusan final sekretaris prodi disetujui.",
        },
      });
    }

    const duplicateSlot = await BimbinganSkripsi.findOne({
      where: {
        mahasiswa_id,
        permintaan_tanggal: tanggal,
        permintaan_jam: jam,
        status_permohonan: { [Op.in]: ["pending", "approved", "rescheduled"] },
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (duplicateSlot) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: "Anda sudah memiliki permohonan bimbingan pada tanggal dan jam tersebut",
      });
    }

    let pengajuanApproved = null;
    if (!selectedJalurIsNonPenelitian) {
      pengajuanApproved = await Pengajuan.findOne({
        where: {
          mahasiswa_id,
          pendaftaran_penjaluran_id: pendaftaranAktif.id,
          status: "approved",
          tipe_pengajuan: { [Op.in]: ["topik_dosen", "judul_mandiri"] },
        },
        attributes: ["id"],
        order: [["updatedAt", "DESC"]],
        transaction,
      });

      if (!pengajuanApproved) {
        await transaction.rollback();
        return res.status(409).json({
          success: false,
          message: "Bimbingan hanya bisa diajukan setelah pengajuan penelitian berstatus disetujui.",
          detail: {
            field: "status_pengajuan",
            selected_jalur: selectedJalur || null,
          },
        });
      }
    }

    const newRow = await BimbinganSkripsi.create(
      {
        mahasiswa_id,
        dosen_id: targetSupervisorId,
        pengajuan_id: pengajuanApproved?.id || null,
        pendaftaran_penjaluran_id: pendaftaranAktif?.id || null,
        penetapan_pembimbing_id: activeAssignment.penetapan.id,
        permintaan_pesan: pesan,
        permintaan_tanggal: tanggal,
        permintaan_jam: jam,
        status_permohonan: "pending",
        status_resume: "belum_diisi",
      },
      { transaction }
    );

    await transaction.commit();

    return res.status(201).json({
      success: true,
      message: "Permohonan bimbingan berhasil dikirim ke dosen pembimbing",
      data: serializeRow(newRow),
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error di createMahasiswaBimbingan:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

exports.submitResumeMahasiswaBimbingan = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const mahasiswa_id = req.user.id;
    const id = req.params.id;
    const resume = String(req.body?.resume || "").trim();

    if (!resume || resume.length < 20) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Resume bimbingan minimal 20 karakter",
        detail: { field: "resume" },
      });
    }

    const row = await BimbinganSkripsi.findOne({
      where: { id, mahasiswa_id },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!row) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Data bimbingan tidak ditemukan",
      });
    }

    const supervisionAccess = await getMahasiswaSupervisionAccess(mahasiswa_id, transaction);
    if (!supervisionAccess.can_submit_resume) {
      await transaction.rollback();
      return sendSupervisionAccessDenied(res, supervisionAccess, "submit_resume");
    }

    if (!["approved", "rescheduled"].includes(row.status_permohonan)) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: "Resume hanya bisa diisi jika permohonan bimbingan sudah disetujui dosen",
      });
    }

    if (!["belum_diisi", "revisi"].includes(row.status_resume)) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: "Resume untuk sesi ini tidak dapat diubah lagi",
      });
    }

    const jadwalSudahDimulai = isScheduleAlreadyPassed(row.permintaan_tanggal, row.permintaan_jam);
    if (!jadwalSudahDimulai) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: "Resume belum bisa diisi. Menunggu sesi bimbingan dimulai sesuai jadwal.",
        detail: {
          code: "WAITING_SESSION_START",
          tanggal_bimbingan: normalizeDateOnly(row.permintaan_tanggal),
          jam_bimbingan: String(row.permintaan_jam || "").trim() || null,
          timezone: "WIB",
        },
      });
    }

    row.resume_mahasiswa = resume;
    row.status_resume = "submitted";
    row.is_counted = false;
    row.catatan_review_resume = null;
    row.tanggal_review_resume = null;
    await row.save({ transaction });

    await transaction.commit();

    return res.json({
      success: true,
      message: "Resume bimbingan berhasil dikirim untuk direview dosen",
      data: serializeRow(row),
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error di submitResumeMahasiswaBimbingan:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// ========== DOSEN ==========

exports.getDosenBimbingan = async (req, res) => {
  try {
    const dosen_id = await resolveAuthenticatedDosenId(req);
    if (!dosen_id) {
      return res.status(403).json({
        success: false,
        message: "Akses dosen tidak valid",
      });
    }
    const permission = await ensureExistingSupervisionAccess(dosen_id);
    if (!permission.allowed) return res.status(403).json({ success: false, message: permission.message });

    const view = String(req.query?.view || "").trim().toLowerCase();
    const supervisedMahasiswaIds = await getSupervisedMahasiswaIdsWithLegacyFallback(dosen_id);
    const supervisedMahasiswaIdSet = new Set(supervisedMahasiswaIds.map(Number));
    const where = {
      [Op.or]: [
        { dosen_id },
        { reviewer_dosen_id: dosen_id },
        { mahasiswa_id: { [Op.in]: supervisedMahasiswaIds } },
      ],
    };

    if (view === "permohonan_sesi") {
      where.status_permohonan = { [Op.in]: ["pending", "expired"] };
    } else if (view === "resume_bimbingan") {
      where.status_permohonan = { [Op.in]: ["approved", "rescheduled"] };
      where.status_resume = "submitted";
    }

    const rows = await BimbinganSkripsi.findAll({
      where,
      include: [
        {
          model: Mahasiswa,
          as: "mahasiswa",
          attributes: ["id", "nim", "nama", "email", "angkatan"],
        },
        {
          model: Pengajuan,
          as: "pengajuan",
          attributes: ["id", "jenis_jalur", "tipe_pengajuan", "status"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    const serializedRows = rows.map(serializeRow).filter(Boolean);
    const stats = buildStatFromRows(serializedRows);

    return res.json({
      success: true,
      data: {
        view: view || "all",
        stats,
        rows: serializedRows.map((item) => {
          const directReviewer = Number(item.reviewer_dosen_id) === Number(dosen_id);
          const originalReviewer = Number(item.dosen_id) === Number(dosen_id);
          const activeSupervisor = supervisedMahasiswaIdSet.has(Number(item.mahasiswa_id));
          return {
            ...item,
            can_review: directReviewer || originalReviewer,
            can_view: directReviewer || originalReviewer || activeSupervisor,
            access_mode: directReviewer
              ? "reassigned_reviewer"
              : originalReviewer ? "target_supervisor" : "active_co_supervisor",
          };
        }),
      },
    });
  } catch (error) {
    console.error("Error di getDosenBimbingan:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

exports.getDosenBimbinganDetail = async (req, res) => {
  try {
    const dosen_id = await resolveAuthenticatedDosenId(req);
    if (!dosen_id) {
      return res.status(403).json({
        success: false,
        message: "Akses dosen tidak valid",
      });
    }
    const permission = await ensureExistingSupervisionAccess(dosen_id);
    if (!permission.allowed) return res.status(403).json({ success: false, message: permission.message });

    const supervisedMahasiswaIds = await getSupervisedMahasiswaIdsWithLegacyFallback(dosen_id);
    const row = await BimbinganSkripsi.findOne({
      where: {
        id: req.params.id,
        [Op.or]: [
          { dosen_id },
          { reviewer_dosen_id: dosen_id },
          { mahasiswa_id: { [Op.in]: supervisedMahasiswaIds } },
        ],
      },
      include: [
        {
          model: Mahasiswa,
          as: "mahasiswa",
          attributes: ["id", "nim", "nama", "email", "angkatan"],
        },
        {
          model: Pengajuan,
          as: "pengajuan",
          attributes: ["id", "jenis_jalur", "tipe_pengajuan", "status"],
        },
      ],
    });

    if (!row) {
      return res.status(404).json({
        success: false,
        message: "Data bimbingan tidak ditemukan",
      });
    }

    return res.json({
      success: true,
      data: {
        ...serializeRow(row),
        can_review: Number(row.dosen_id) === Number(dosen_id)
          || Number(row.reviewer_dosen_id) === Number(dosen_id),
        can_view: true,
        access_mode: Number(row.reviewer_dosen_id) === Number(dosen_id)
          ? "reassigned_reviewer"
          : Number(row.dosen_id) === Number(dosen_id) ? "target_supervisor" : "active_co_supervisor",
      },
    });
  } catch (error) {
    console.error("Error di getDosenBimbinganDetail:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

exports.approveDosenBimbingan = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const dosen_id = await resolveAuthenticatedDosenId(req, transaction);
    if (!dosen_id) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: "Akses dosen tidak valid",
      });
    }
    const permission = await ensureExistingSupervisionAccess(dosen_id, transaction);
    if (!permission.allowed) {
      await transaction.rollback();
      return res.status(403).json({ success: false, message: permission.message });
    }

    const catatan = String(req.body?.catatan_dosen || "").trim();
    const lokasi = String(req.body?.lokasi_bimbingan || "").trim();
    const tanggalBimbingan = normalizeDateOnly(req.body?.tanggal_bimbingan || req.body?.permintaan_tanggal);
    const jamBimbingan = String(req.body?.jam_bimbingan || req.body?.permintaan_jam || "").trim();

    if (!catatan || catatan.length < 5) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Alasan/pesan persetujuan minimal 5 karakter",
        detail: { field: "catatan_dosen" },
      });
    }

    if (!tanggalBimbingan) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Tanggal bimbingan wajib diisi",
        detail: { field: "tanggal_bimbingan" },
      });
    }

    if (!isValidJam(jamBimbingan)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Format waktu bimbingan harus HH:mm",
        detail: { field: "jam_bimbingan" },
      });
    }

    if (tanggalBimbingan < todayDateOnly()) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Tanggal bimbingan tidak boleh di masa lalu",
        detail: { field: "tanggal_bimbingan" },
      });
    }

    if (!lokasi || lokasi.length < 3) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Lokasi bimbingan wajib diisi (minimal 3 karakter)",
        detail: { field: "lokasi_bimbingan" },
      });
    }

    const row = await BimbinganSkripsi.findOne({
      where: { id: req.params.id },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!row) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Data bimbingan tidak ditemukan",
      });
    }
    if (!(Number(row.dosen_id) === Number(dosen_id)
      || Number(row.reviewer_dosen_id) === Number(dosen_id))) {
      await transaction.rollback();
      return res.status(403).json({ success: false, message: "Permohonan ini ditujukan kepada pembimbing lain." });
    }

    if (row.status_permohonan !== "pending") {
      await transaction.rollback();
      if (row.status_permohonan === "expired") {
        return res.status(409).json({
          success: false,
          message: "Permohonan sudah ditarik mahasiswa (expired) dan tidak bisa diproses.",
        });
      }
      return res.status(409).json({
        success: false,
        message: "Permohonan ini sudah diproses sebelumnya",
      });
    }

    const tanggalSebelumnya = normalizeDateOnly(row.permintaan_tanggal);
    const jamSebelumnya = String(row.permintaan_jam || "").trim();
    const isRescheduled = tanggalSebelumnya !== tanggalBimbingan || jamSebelumnya !== jamBimbingan;

    row.status_permohonan = isRescheduled ? "rescheduled" : "approved";
    row.catatan_dosen = catatan;
    row.permintaan_tanggal = tanggalBimbingan;
    row.permintaan_jam = jamBimbingan;
    row.lokasi_bimbingan = lokasi;
    row.tanggal_keputusan = new Date();
    await row.save({ transaction });

    await transaction.commit();

    return res.json({
      success: true,
      message: isRescheduled
        ? "Permohonan bimbingan berhasil di-reschedule dan disetujui"
        : "Permohonan bimbingan berhasil disetujui",
      data: serializeRow(row),
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error di approveDosenBimbingan:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

exports.rejectDosenBimbingan = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const dosen_id = await resolveAuthenticatedDosenId(req, transaction);
    if (!dosen_id) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: "Akses dosen tidak valid",
      });
    }
    const permission = await ensureExistingSupervisionAccess(dosen_id, transaction);
    if (!permission.allowed) {
      await transaction.rollback();
      return res.status(403).json({ success: false, message: permission.message });
    }

    const catatan = String(req.body?.catatan_dosen || "").trim();
    if (!catatan || catatan.length < 5) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Alasan penolakan minimal 5 karakter",
        detail: { field: "catatan_dosen" },
      });
    }

    const row = await BimbinganSkripsi.findOne({
      where: { id: req.params.id },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!row) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Data bimbingan tidak ditemukan",
      });
    }
    if (!(Number(row.dosen_id) === Number(dosen_id)
      || Number(row.reviewer_dosen_id) === Number(dosen_id))) {
      await transaction.rollback();
      return res.status(403).json({ success: false, message: "Permohonan ini ditujukan kepada pembimbing lain." });
    }

    if (row.status_permohonan !== "pending") {
      await transaction.rollback();
      if (row.status_permohonan === "expired") {
        return res.status(409).json({
          success: false,
          message: "Permohonan sudah ditarik mahasiswa (expired) dan tidak bisa diproses.",
        });
      }
      return res.status(409).json({
        success: false,
        message: "Permohonan ini sudah diproses sebelumnya",
      });
    }

    row.status_permohonan = "rejected";
    row.catatan_dosen = catatan;
    row.lokasi_bimbingan = null;
    row.tanggal_keputusan = new Date();
    await row.save({ transaction });

    await transaction.commit();

    return res.json({
      success: true,
      message: "Permohonan bimbingan berhasil ditolak",
      data: serializeRow(row),
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error di rejectDosenBimbingan:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

exports.reviewResumeDosenBimbingan = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const dosen_id = await resolveAuthenticatedDosenId(req, transaction);
    if (!dosen_id) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: "Akses dosen tidak valid",
      });
    }
    const permission = await ensureExistingSupervisionAccess(dosen_id, transaction);
    if (!permission.allowed) {
      await transaction.rollback();
      return res.status(403).json({ success: false, message: permission.message });
    }

    const action = String(req.body?.action || "").trim().toLowerCase();
    const catatan = String(req.body?.catatan_review || "").trim();

    if (!["approve", "revisi", "reject"].includes(action)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Action review resume tidak valid (approve/revisi/reject)",
        detail: { field: "action" },
      });
    }

    if ((action === "revisi" || action === "reject") && (!catatan || catatan.length < 5)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Catatan review minimal 5 karakter untuk revisi/penolakan",
        detail: { field: "catatan_review" },
      });
    }

    const row = await BimbinganSkripsi.findOne({
      where: { id: req.params.id },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!row) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Data bimbingan tidak ditemukan",
      });
    }
    if (!(Number(row.dosen_id) === Number(dosen_id)
      || Number(row.reviewer_dosen_id) === Number(dosen_id))) {
      await transaction.rollback();
      return res.status(403).json({ success: false, message: "Resume ini ditujukan kepada pembimbing lain." });
    }

    if (!["approved", "rescheduled"].includes(row.status_permohonan)) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: "Resume hanya bisa direview untuk permohonan yang sudah disetujui",
      });
    }

    if (row.status_resume !== "submitted") {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: "Resume belum dikirim mahasiswa atau sudah pernah direview",
      });
    }

    if (action === "approve") {
      row.status_resume = "approved";
      row.is_counted = true;
    } else {
      // Sesuai flow terbaru: penolakan review resume mengembalikan ke status revisi.
      row.status_resume = "revisi";
      row.is_counted = false;
    }

    row.catatan_review_resume = catatan || null;
    row.tanggal_review_resume = new Date();
    await row.save({ transaction });

    await transaction.commit();

    return res.json({
      success: true,
      message: "Review resume berhasil disimpan",
      data: serializeRow(row),
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error di reviewResumeDosenBimbingan:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

exports.expireMahasiswaBimbingan = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const mahasiswa_id = req.user.id;
    const id = req.params.id;
    const catatanMahasiswa = String(req.body?.catatan_mahasiswa || "").trim();

    const row = await BimbinganSkripsi.findOne({
      where: { id, mahasiswa_id },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!row) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Data bimbingan tidak ditemukan",
      });
    }

    if (row.status_permohonan !== "pending") {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: "Permohonan ini tidak bisa ditarik karena sudah diproses.",
      });
    }

    if (!isScheduleAlreadyPassed(row.permintaan_tanggal, row.permintaan_jam)) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: "Permohonan hanya bisa ditarik setelah jadwal yang diajukan terlewati.",
      });
    }

    row.status_permohonan = "expired";
    row.catatan_dosen = catatanMahasiswa || row.catatan_dosen || "Permohonan ditarik oleh mahasiswa.";
    row.lokasi_bimbingan = null;
    row.status_resume = "belum_diisi";
    row.resume_mahasiswa = null;
    row.catatan_review_resume = null;
    row.tanggal_review_resume = null;
    row.is_counted = false;
    row.tanggal_keputusan = new Date();
    await row.save({ transaction });

    await transaction.commit();

    return res.json({
      success: true,
      message: "Permohonan berhasil ditarik dan diubah menjadi expired.",
      data: serializeRow(row),
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error di expireMahasiswaBimbingan:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};
