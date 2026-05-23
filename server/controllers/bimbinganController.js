const { Op } = require("sequelize");
const {
  BimbinganSkripsi,
  Mahasiswa,
  Dosen,
  Pengajuan,
  SekretarisProdi,
  PendaftaranPenjaluran,
  PeriodePenjaluran,
  sequelize,
} = require("../models");

const TARGET_SESI_MINIMAL = 8;
const NON_PENELITIAN_JALUR_SET = new Set(["magang", "pengabdian", "perintisan_bisnis"]);

function isValidJam(value) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(String(value || "").trim());
}

function normalizeDateOnly(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function todayDateOnly() {
  return new Date().toISOString().slice(0, 10);
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
    rejected: "Ditolak",
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
    pengajuan_id: item.pengajuan_id,
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
  const rejected_permohonan = rows.filter((item) => item.status_permohonan === "rejected").length;
  const submitted_resume = rows.filter((item) => item.status_resume === "submitted").length;
  const approved_resume = rows.filter((item) => item.status_resume === "approved").length;
  const counted_sessions = rows.filter((item) => item.status_resume === "approved" && item.is_counted).length;
  const progress_percent = Math.min(100, Math.round((counted_sessions / TARGET_SESI_MINIMAL) * 100));

  return {
    target_minimum: TARGET_SESI_MINIMAL,
    total_sesi: total,
    pending_permohonan,
    approved_permohonan,
    rejected_permohonan,
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
    return pendaftaran.jenis_jalur_ulang || null;
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
        dosen_pembimbing: mahasiswa.dosenPembimbingSkripsi
          ? {
              id: mahasiswa.dosenPembimbingSkripsi.id,
              nik: mahasiswa.dosenPembimbingSkripsi.nik,
              nama: mahasiswa.dosenPembimbingSkripsi.nama,
              email: mahasiswa.dosenPembimbingSkripsi.email,
            }
          : null,
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

    if (!mahasiswa.dosen_pembimbing_skripsi_id) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: "Anda belum memiliki dosen pembimbing skripsi aktif",
      });
    }

    const pendaftaranAktif = await getLatestPendaftaranForBimbingan(mahasiswa_id, transaction);
    const selectedJalur = resolveSelectedJalurFromPendaftaran(pendaftaranAktif);

    if (selectedJalur && NON_PENELITIAN_JALUR_SET.has(String(selectedJalur).toLowerCase())) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: `Menu bimbingan belum aktif untuk jalur ${String(selectedJalur)
          .replace(/_/g, " ")
          .replace(/\b\w/g, (char) => char.toUpperCase())}.`,
        detail: {
          field: "jalur",
          selected_jalur: selectedJalur,
          reason: "Bimbingan saat ini baru tersedia untuk jalur penelitian.",
        },
      });
    }

    const duplicateSlot = await BimbinganSkripsi.findOne({
      where: {
        mahasiswa_id,
        permintaan_tanggal: tanggal,
        permintaan_jam: jam,
        status_permohonan: { [Op.in]: ["pending", "approved"] },
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

    const pengajuanApproved = await Pengajuan.findOne({
      where: {
        mahasiswa_id,
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

    const newRow = await BimbinganSkripsi.create(
      {
        mahasiswa_id,
        dosen_id: mahasiswa.dosen_pembimbing_skripsi_id,
        pengajuan_id: pengajuanApproved?.id || null,
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

    if (row.status_permohonan !== "approved") {
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

    const view = String(req.query?.view || "").trim().toLowerCase();
    const where = { dosen_id };

    if (view === "permohonan_sesi") {
      where.status_permohonan = "pending";
    } else if (view === "resume_bimbingan") {
      where.status_permohonan = "approved";
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
        rows: serializedRows,
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

    const row = await BimbinganSkripsi.findOne({
      where: { id: req.params.id, dosen_id },
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
      data: serializeRow(row),
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
      where: { id: req.params.id, dosen_id },
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
        message: "Permohonan ini sudah diproses sebelumnya",
      });
    }

    row.status_permohonan = "approved";
    row.catatan_dosen = catatan;
    row.permintaan_tanggal = tanggalBimbingan;
    row.permintaan_jam = jamBimbingan;
    row.lokasi_bimbingan = lokasi;
    row.tanggal_keputusan = new Date();
    await row.save({ transaction });

    await transaction.commit();

    return res.json({
      success: true,
      message: "Permohonan bimbingan berhasil disetujui",
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
      where: { id: req.params.id, dosen_id },
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
      where: { id: req.params.id, dosen_id },
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

    if (row.status_permohonan !== "approved") {
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
    } else if (action === "revisi") {
      row.status_resume = "revisi";
      row.is_counted = false;
    } else {
      row.status_resume = "rejected";
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
