const fs = require("fs");
const path = require("path");
const { Op } = require("sequelize");
const { DokumenSidang, Mahasiswa, Dosen, BimbinganSkripsi, sequelize } = require("../models");

const TARGET_SESI_MINIMAL = 8;
const SERVER_ROOT_DIR = path.resolve(__dirname, "..");
const SIDANG_UPLOAD_ROOT = path.resolve(SERVER_ROOT_DIR, "uploads", "sidang-dokumen");

const STATUS_LABEL_MAP = {
  belum_upload: "Belum Upload",
  submitted: "Menunggu Review",
  revisi: "Perlu Revisi",
  approved: "Disetujui",
};

const DOKUMEN_FIELD_MAP = {
  transkrip: {
    key: "transkrip",
    label: "Transkrip Nilai",
    pathField: "transkrip_file_path",
    nameField: "transkrip_file_name",
    statusField: "transkrip_status",
    uploadedAtField: "transkrip_uploaded_at",
    reviewNoteField: "transkrip_review_note",
    reviewedAtField: "transkrip_reviewed_at",
  },
  cept: {
    key: "cept",
    label: "Sertifikat CEPT",
    pathField: "cept_file_path",
    nameField: "cept_file_name",
    statusField: "cept_status",
    uploadedAtField: "cept_uploaded_at",
    reviewNoteField: "cept_review_note",
    reviewedAtField: "cept_reviewed_at",
  },
  draft_skripsi: {
    key: "draft_skripsi",
    label: "Draft Skripsi",
    pathField: "draft_skripsi_file_path",
    nameField: "draft_skripsi_file_name",
    statusField: "draft_skripsi_status",
    uploadedAtField: "draft_skripsi_uploaded_at",
    reviewNoteField: "draft_skripsi_review_note",
    reviewedAtField: "draft_skripsi_reviewed_at",
  },
};

const DOKUMEN_KEYS = Object.keys(DOKUMEN_FIELD_MAP);

function resolveDokumenKey(rawKey) {
  const normalized = String(rawKey || "")
    .trim()
    .toLowerCase();
  if (normalized === "transkrip_nilai" || normalized === "transkrip") return "transkrip";
  if (normalized === "sertifikat_cept" || normalized === "cept") return "cept";
  if (normalized === "draft" || normalized === "draft_skripsi") return "draft_skripsi";
  return null;
}

function formatDokumenStatusLabel(status) {
  return STATUS_LABEL_MAP[String(status || "").toLowerCase()] || "Belum Upload";
}

function safeRelativePathFromAbsolute(absPath) {
  const relative = path.relative(SERVER_ROOT_DIR, absPath || "");
  return relative.split(path.sep).join("/");
}

function resolveAbsoluteFilePath(storedPath) {
  if (!storedPath) return null;
  const absolutePath = path.resolve(SERVER_ROOT_DIR, storedPath);
  if (!absolutePath.startsWith(SIDANG_UPLOAD_ROOT)) return null;
  return absolutePath;
}

function cleanupFileIfExists(storedPath) {
  try {
    const absolutePath = resolveAbsoluteFilePath(storedPath);
    if (absolutePath && fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }
  } catch (error) {
    // no-op cleanup best effort
  }
}

function cleanupUploadedFileFromRequest(req) {
  const uploadedPath = req?.file?.path;
  if (!uploadedPath) return;
  try {
    if (fs.existsSync(uploadedPath)) {
      fs.unlinkSync(uploadedPath);
    }
  } catch (error) {
    // no-op cleanup best effort
  }
}

async function countValidBimbinganSessions(mahasiswaId, transaction = null) {
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

async function countValidBimbinganSessionsMap(mahasiswaIds) {
  if (!Array.isArray(mahasiswaIds) || mahasiswaIds.length === 0) {
    return new Map();
  }

  const rows = await BimbinganSkripsi.findAll({
    where: {
      mahasiswa_id: { [Op.in]: mahasiswaIds },
      status_resume: "approved",
      is_counted: true,
    },
    attributes: [
      "mahasiswa_id",
      [sequelize.fn("COUNT", sequelize.col("id")), "counted_sessions"],
    ],
    group: ["mahasiswa_id"],
    raw: true,
  });

  const result = new Map();
  rows.forEach((row) => {
    const mahasiswaId = Number(row.mahasiswa_id);
    const counted = Number(row.counted_sessions || 0);
    result.set(mahasiswaId, counted);
  });

  return result;
}

async function findOrCreateDokumenSidang(mahasiswaId, transaction = null) {
  let dokumen = await DokumenSidang.findOne({
    where: { mahasiswa_id: mahasiswaId },
    transaction: transaction || undefined,
    lock: transaction ? transaction.LOCK.UPDATE : undefined,
  });

  if (!dokumen) {
    dokumen = await DokumenSidang.create(
      {
        mahasiswa_id: mahasiswaId,
      },
      { transaction: transaction || undefined }
    );
  }

  return dokumen;
}

function serializeDokumenPayload(dokumenRow) {
  const result = {};
  const row = dokumenRow?.toJSON ? dokumenRow.toJSON() : dokumenRow || {};

  DOKUMEN_KEYS.forEach((docKey) => {
    const cfg = DOKUMEN_FIELD_MAP[docKey];
    const status = String(row[cfg.statusField] || "belum_upload").toLowerCase();
    result[docKey] = {
      key: docKey,
      label: cfg.label,
      status,
      status_label: formatDokumenStatusLabel(status),
      file_name: row[cfg.nameField] || null,
      uploaded_at: row[cfg.uploadedAtField] || null,
      review_note: row[cfg.reviewNoteField] || null,
      reviewed_at: row[cfg.reviewedAtField] || null,
      has_file: Boolean(row[cfg.pathField] && row[cfg.nameField]),
    };
  });

  return result;
}

function summarizeDokumenStatus(serializedDokumen) {
  const values = Object.values(serializedDokumen || {});
  const total = values.length;
  const approved = values.filter((item) => item.status === "approved").length;
  const submitted = values.filter((item) => item.status === "submitted").length;
  const revisi = values.filter((item) => item.status === "revisi").length;
  const belumUpload = values.filter((item) => item.status === "belum_upload").length;
  return {
    total_dokumen: total,
    approved_dokumen: approved,
    submitted_dokumen: submitted,
    revisi_dokumen: revisi,
    belum_upload_dokumen: belumUpload,
    semua_disetujui: total > 0 && approved === total,
  };
}

function buildGate(countedSessions) {
  const counted = Number(countedSessions || 0);
  return {
    target_minimum: TARGET_SESI_MINIMAL,
    counted_sessions: counted,
    unlocked: counted >= TARGET_SESI_MINIMAL,
    remaining_sessions: Math.max(TARGET_SESI_MINIMAL - counted, 0),
  };
}

function buildStatusPendaftaranSidang(gate, summary) {
  if (!gate.unlocked) return "menunggu_minimal_bimbingan";
  if (summary.semua_disetujui) return "lolos_pendaftaran_sidang";
  if (summary.revisi_dokumen > 0) return "perlu_revisi_dokumen";
  if (summary.submitted_dokumen > 0) return "menunggu_review_dosen";
  return "siap_upload_dokumen";
}

async function resolveAuthorizedDosenId(req) {
  if (req.user?.role === "dosen") {
    return Number(req.user.id);
  }
  return null;
}

exports.getMahasiswaDokumenSidang = async (req, res) => {
  try {
    const mahasiswaId = Number(req.user.id);
    const countedSessions = await countValidBimbinganSessions(mahasiswaId);
    const gate = buildGate(countedSessions);

    const mahasiswa = await Mahasiswa.findByPk(mahasiswaId, {
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

    const dokumenRow = await findOrCreateDokumenSidang(mahasiswaId);
    const dokumen = serializeDokumenPayload(dokumenRow);
    const summary = summarizeDokumenStatus(dokumen);

    return res.json({
      success: true,
      data: {
        gate,
        status_pendaftaran_sidang: buildStatusPendaftaranSidang(gate, summary),
        summary,
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
        dokumen,
      },
    });
  } catch (error) {
    console.error("Error di getMahasiswaDokumenSidang:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

exports.uploadMahasiswaDokumenSidang = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const mahasiswaId = Number(req.user.id);
    const dokumenKey = resolveDokumenKey(req.params.jenis);
    if (!dokumenKey) {
      cleanupUploadedFileFromRequest(req);
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Jenis dokumen tidak valid",
      });
    }

    if (!req.file) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "File dokumen wajib diunggah",
      });
    }

    const countedSessions = await countValidBimbinganSessions(mahasiswaId, transaction);
    const gate = buildGate(countedSessions);
    if (!gate.unlocked) {
      cleanupUploadedFileFromRequest(req);
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: `Upload dokumen dibuka setelah minimal ${TARGET_SESI_MINIMAL} bimbingan tervalidasi.`,
        data: { gate },
      });
    }

    const dokumenRow = await findOrCreateDokumenSidang(mahasiswaId, transaction);
    const cfg = DOKUMEN_FIELD_MAP[dokumenKey];
    const oldStoredPath = dokumenRow[cfg.pathField];

    dokumenRow[cfg.pathField] = safeRelativePathFromAbsolute(req.file.path);
    dokumenRow[cfg.nameField] = String(req.file.originalname || req.file.filename || "").slice(0, 255);
    dokumenRow[cfg.statusField] = "submitted";
    dokumenRow[cfg.uploadedAtField] = new Date();
    dokumenRow[cfg.reviewNoteField] = null;
    dokumenRow[cfg.reviewedAtField] = null;
    await dokumenRow.save({ transaction });

    await transaction.commit();
    cleanupFileIfExists(oldStoredPath);

    const serializedDokumen = serializeDokumenPayload(dokumenRow);
    const summary = summarizeDokumenStatus(serializedDokumen);

    return res.json({
      success: true,
      message: `${cfg.label} berhasil diunggah dan menunggu review dosen.`,
      data: {
        gate,
        status_pendaftaran_sidang: buildStatusPendaftaranSidang(gate, summary),
        summary,
        dokumen: serializedDokumen,
      },
    });
  } catch (error) {
    cleanupUploadedFileFromRequest(req);
    try {
      await transaction.rollback();
    } catch (rollbackError) {
      // no-op
    }
    console.error("Error di uploadMahasiswaDokumenSidang:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat mengunggah dokumen",
      error: error.message,
    });
  }
};

exports.downloadMahasiswaDokumenSidang = async (req, res) => {
  try {
    const mahasiswaId = Number(req.user.id);
    const dokumenKey = resolveDokumenKey(req.params.jenis);
    if (!dokumenKey) {
      return res.status(400).json({
        success: false,
        message: "Jenis dokumen tidak valid",
      });
    }

    const dokumenRow = await DokumenSidang.findOne({
      where: { mahasiswa_id: mahasiswaId },
    });

    if (!dokumenRow) {
      return res.status(404).json({
        success: false,
        message: "Dokumen sidang belum tersedia",
      });
    }

    const cfg = DOKUMEN_FIELD_MAP[dokumenKey];
    const storedPath = dokumenRow[cfg.pathField];
    const fileName = dokumenRow[cfg.nameField];
    const absolutePath = resolveAbsoluteFilePath(storedPath);

    if (!absolutePath || !fs.existsSync(absolutePath)) {
      return res.status(404).json({
        success: false,
        message: "File dokumen tidak ditemukan",
      });
    }

    return res.download(absolutePath, fileName || path.basename(absolutePath));
  } catch (error) {
    console.error("Error di downloadMahasiswaDokumenSidang:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

exports.getDosenDokumenSidangList = async (req, res) => {
  try {
    const dosenId = await resolveAuthorizedDosenId(req);
    if (!dosenId) {
      return res.status(403).json({
        success: false,
        message: "Akses ditolak. Hanya dosen yang diizinkan.",
      });
    }

    const mahasiswaRows = await Mahasiswa.findAll({
      where: { dosen_pembimbing_skripsi_id: dosenId },
      attributes: ["id", "nim", "nama", "angkatan"],
      include: [
        {
          model: DokumenSidang,
          as: "dokumenSidang",
          required: false,
        },
      ],
      order: [["nama", "ASC"]],
    });

    const mahasiswaIds = mahasiswaRows.map((item) => Number(item.id));
    const countedMap = await countValidBimbinganSessionsMap(mahasiswaIds);

    const items = await Promise.all(
      mahasiswaRows.map(async (mahasiswa) => {
        const mahasiswaJson = mahasiswa.toJSON();
        const countedSessions = countedMap.get(Number(mahasiswa.id)) || 0;
        const gate = buildGate(countedSessions);
        const dokumenRow =
          mahasiswaJson.dokumenSidang || (await findOrCreateDokumenSidang(Number(mahasiswa.id)));
        const dokumen = serializeDokumenPayload(dokumenRow);
        const summary = summarizeDokumenStatus(dokumen);
        return {
          mahasiswa: {
            id: mahasiswa.id,
            nim: mahasiswa.nim,
            nama: mahasiswa.nama,
            angkatan: mahasiswa.angkatan,
          },
          gate,
          status_pendaftaran_sidang: buildStatusPendaftaranSidang(gate, summary),
          summary,
          dokumen,
        };
      })
    );

    const onlyEligible = items.filter((item) => item.gate.unlocked);

    return res.json({
      success: true,
      data: {
        rows: onlyEligible,
      },
    });
  } catch (error) {
    console.error("Error di getDosenDokumenSidangList:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

exports.getDosenDokumenSidangDetail = async (req, res) => {
  try {
    const dosenId = await resolveAuthorizedDosenId(req);
    if (!dosenId) {
      return res.status(403).json({
        success: false,
        message: "Akses ditolak. Hanya dosen yang diizinkan.",
      });
    }

    const mahasiswaId = Number(req.params.mahasiswaId);
    if (!mahasiswaId) {
      return res.status(400).json({
        success: false,
        message: "ID mahasiswa tidak valid",
      });
    }

    const mahasiswa = await Mahasiswa.findOne({
      where: {
        id: mahasiswaId,
        dosen_pembimbing_skripsi_id: dosenId,
      },
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
        message: "Mahasiswa bimbingan tidak ditemukan",
      });
    }

    const countedSessions = await countValidBimbinganSessions(mahasiswaId);
    const gate = buildGate(countedSessions);
    const dokumenRow = await findOrCreateDokumenSidang(mahasiswaId);
    const dokumen = serializeDokumenPayload(dokumenRow);
    const summary = summarizeDokumenStatus(dokumen);

    return res.json({
      success: true,
      data: {
        gate,
        status_pendaftaran_sidang: buildStatusPendaftaranSidang(gate, summary),
        summary,
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
        dokumen,
      },
    });
  } catch (error) {
    console.error("Error di getDosenDokumenSidangDetail:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

exports.reviewDosenDokumenSidang = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const dosenId = await resolveAuthorizedDosenId(req);
    if (!dosenId) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: "Akses ditolak. Hanya dosen yang diizinkan.",
      });
    }

    const mahasiswaId = Number(req.params.mahasiswaId);
    if (!mahasiswaId) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "ID mahasiswa tidak valid",
      });
    }

    const mahasiswa = await Mahasiswa.findOne({
      where: {
        id: mahasiswaId,
        dosen_pembimbing_skripsi_id: dosenId,
      },
      attributes: ["id"],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!mahasiswa) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Mahasiswa bimbingan tidak ditemukan",
      });
    }

    const countedSessions = await countValidBimbinganSessions(mahasiswaId, transaction);
    const gate = buildGate(countedSessions);
    if (!gate.unlocked) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: "Review dokumen dibuka setelah mahasiswa menyelesaikan minimal 8 bimbingan tervalidasi.",
        data: { gate },
      });
    }

    const dokumenKey = resolveDokumenKey(req.body?.document_key);
    const decision = String(req.body?.decision || "").trim().toLowerCase();
    const note = String(req.body?.note || "").trim();
    if (!dokumenKey) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Dokumen yang direview tidak valid",
      });
    }

    if (!["approve", "revisi"].includes(decision)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Keputusan review tidak valid. Gunakan approve atau revisi.",
      });
    }

    if (decision === "revisi" && note.length < 5) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Catatan revisi minimal 5 karakter.",
      });
    }

    const dokumenRow = await findOrCreateDokumenSidang(mahasiswaId, transaction);
    const cfg = DOKUMEN_FIELD_MAP[dokumenKey];
    const currentStatus = String(dokumenRow[cfg.statusField] || "belum_upload").toLowerCase();
    const hasFile = Boolean(dokumenRow[cfg.pathField] && dokumenRow[cfg.nameField]);

    if (!hasFile || currentStatus === "belum_upload") {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: `${cfg.label} belum diunggah oleh mahasiswa.`,
      });
    }

    dokumenRow[cfg.statusField] = decision === "approve" ? "approved" : "revisi";
    dokumenRow[cfg.reviewNoteField] = note || null;
    dokumenRow[cfg.reviewedAtField] = new Date();
    await dokumenRow.save({ transaction });

    await transaction.commit();

    const serializedDokumen = serializeDokumenPayload(dokumenRow);
    const summary = summarizeDokumenStatus(serializedDokumen);

    return res.json({
      success: true,
      message:
        decision === "approve"
          ? `${cfg.label} disetujui.`
          : `${cfg.label} dikembalikan untuk revisi.`,
      data: {
        gate,
        status_pendaftaran_sidang: buildStatusPendaftaranSidang(gate, summary),
        summary,
        dokumen: serializedDokumen,
      },
    });
  } catch (error) {
    try {
      await transaction.rollback();
    } catch (rollbackError) {
      // no-op
    }
    console.error("Error di reviewDosenDokumenSidang:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat memproses review dokumen",
      error: error.message,
    });
  }
};

exports.downloadDosenDokumenSidang = async (req, res) => {
  try {
    const dosenId = await resolveAuthorizedDosenId(req);
    if (!dosenId) {
      return res.status(403).json({
        success: false,
        message: "Akses ditolak. Hanya dosen yang diizinkan.",
      });
    }

    const mahasiswaId = Number(req.params.mahasiswaId);
    const dokumenKey = resolveDokumenKey(req.params.jenis);
    if (!mahasiswaId || !dokumenKey) {
      return res.status(400).json({
        success: false,
        message: "Parameter download dokumen tidak valid",
      });
    }

    const mahasiswa = await Mahasiswa.findOne({
      where: {
        id: mahasiswaId,
        dosen_pembimbing_skripsi_id: dosenId,
      },
      attributes: ["id"],
    });

    if (!mahasiswa) {
      return res.status(404).json({
        success: false,
        message: "Mahasiswa bimbingan tidak ditemukan",
      });
    }

    const dokumenRow = await DokumenSidang.findOne({
      where: { mahasiswa_id: mahasiswaId },
    });

    if (!dokumenRow) {
      return res.status(404).json({
        success: false,
        message: "Dokumen sidang mahasiswa belum tersedia",
      });
    }

    const cfg = DOKUMEN_FIELD_MAP[dokumenKey];
    const storedPath = dokumenRow[cfg.pathField];
    const fileName = dokumenRow[cfg.nameField];
    const absolutePath = resolveAbsoluteFilePath(storedPath);

    if (!absolutePath || !fs.existsSync(absolutePath)) {
      return res.status(404).json({
        success: false,
        message: "File dokumen tidak ditemukan",
      });
    }

    return res.download(absolutePath, fileName || path.basename(absolutePath));
  } catch (error) {
    console.error("Error di downloadDosenDokumenSidang:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

