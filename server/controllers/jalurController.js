const { Pengajuan, Topik, Mahasiswa, Dosen, PamitUlang, sequelize } = require("../models");
const { Op } = require("sequelize");

// ========== HELPER FUNCTION - VALIDASI KUOTA DOSEN ==========

/**
 * Validasi kuota dosen sebelum mahasiswa submit pengajuan
 * @param {number} dosen_id - ID dosen yang akan dicek
 * @param {Object} transaction - Sequelize transaction object
 * @returns {Object} { isAvailable: boolean, kuotaInfo: object, message: string, dosen: object }
 */
async function validateDosenKuota(dosen_id, transaction) {
  const dosen = await Dosen.findByPk(dosen_id, { transaction });

  if (!dosen) {
    return {
      isAvailable: false,
      message: "Dosen tidak ditemukan",
    };
  }

  const kuotaInfo = await dosen.getKuotaInfo();

  if (kuotaInfo.is_penuh) {
    return {
      isAvailable: false,
      kuotaInfo,
      message: `Kuota dosen ${dosen.nama} sudah penuh (${kuotaInfo.terpakai}/${kuotaInfo.total}). Silakan pilih dosen lain.`,
    };
  }

  return {
    isAvailable: true,
    kuotaInfo,
    dosen,
  };
}

function normalizeText(value) {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function getTopikStatusMessage(status) {
  switch (status) {
    case "reserved":
      return "sedang direservasi oleh mahasiswa lain";
    case "taken":
      return "sudah diambil";
    case "unavailable":
      return "sedang tidak tersedia";
    default:
      return "tidak tersedia";
  }
}

function buildTopikValidationError({ slot, kode, inputJudul, inputDosen, topikDb }) {
  if (!topikDb) {
    return {
      isValid: false,
      message: `Topik pilihan ${slot} dengan kode ${kode} tidak ditemukan`,
      detail: {
        slot,
        field: "kode",
        kode,
      },
    };
  }

  if (!topikDb.dosen) {
    return {
      isValid: false,
      message: `Topik pilihan ${slot} (${kode}) tidak memiliki data dosen pembimbing`,
      detail: {
        slot,
        field: "dosen",
        kode,
      },
    };
  }

  if (topikDb.status !== "available") {
    return {
      isValid: false,
      message: `Topik pilihan ${slot} (${kode}) ${getTopikStatusMessage(topikDb.status)}`,
      detail: {
        slot,
        field: "status",
        kode,
        status: topikDb.status,
      },
    };
  }

  if (inputJudul && normalizeText(inputJudul) !== normalizeText(topikDb.judul)) {
    return {
      isValid: false,
      message: `Data topik pilihan ${slot} tidak sesuai dengan database`,
      detail: {
        slot,
        field: "judul",
        kode,
        input: inputJudul,
        expected: topikDb.judul,
      },
    };
  }

  if (inputDosen && normalizeText(inputDosen) !== normalizeText(topikDb.dosen.nama)) {
    return {
      isValid: false,
      message: `Data topik pilihan ${slot} tidak sesuai dengan database`,
      detail: {
        slot,
        field: "dosen",
        kode,
        input: inputDosen,
        expected: topikDb.dosen.nama,
      },
    };
  }

  return { isValid: true };
}

async function reserveTopikKodes(topikKodes, transaction) {
  if (!topikKodes || topikKodes.length === 0) {
    return { ok: true };
  }

  const [affected] = await Topik.update(
    { status: "reserved" },
    {
      where: {
        kode: { [Op.in]: topikKodes },
        status: "available",
      },
      transaction,
    }
  );

  if (affected !== topikKodes.length) {
    return { ok: false };
  }

  return { ok: true };
}

// ========== CEK STATUS & ELIGIBILITY ==========

// GET /api/jalur/status - Cek status jalur mahasiswa
exports.checkStatusJalur = async (req, res) => {
  try {
    const mahasiswa_id = req.user.id;

    // Ambil data mahasiswa lengkap
    const mahasiswa = await Mahasiswa.findByPk(mahasiswa_id, {
      attributes: ["id", "nim", "nama", "status_jalur_saat_ini", "dosen_pembimbing_akademik_id", "dosen_pembimbing_skripsi_id", "pengajuan_aktif_id"],
      include: [
        {
          model: Pengajuan,
          as: "pengajuanAktif",
          attributes: ["id", "jenis_jalur", "tipe_pengajuan", "status"],
        },
      ],
    });

    if (!mahasiswa) {
      return res.status(404).json({
        success: false,
        message: "Data mahasiswa tidak ditemukan",
      });
    }

    // Cek pengajuan terakhir
    const lastSubmission = await Pengajuan.findOne({
      where: { mahasiswa_id },
      order: [["createdAt", "DESC"]],
      include: [
        {
          model: Dosen,
          as: "dosenCurrent",
          attributes: ["id", "nama", "nip"],
        },
      ],
    });

    // Cek apakah ada pengajuan aktif
    const hasActiveSubmission = mahasiswa.pengajuan_aktif_id !== null;

    // Cek status pamit ulang (jika ada)
    const activePamit = await PamitUlang.findOne({
      where: {
        mahasiswa_id,
        status_dpa: { [Op.in]: ["pending", "approved"] },
      },
      order: [["createdAt", "DESC"]],
    });

    // Eligibility rules
    const availableOptions = {
      baru: !hasActiveSubmission && mahasiswa.status_jalur_saat_ini === "belum_mengajukan",

      ulang: !hasActiveSubmission && lastSubmission !== null && lastSubmission.status === "approved" && mahasiswa.dosen_pembimbing_akademik_id !== null,

      ekstensi: !hasActiveSubmission && lastSubmission !== null && lastSubmission.status === "approved" && mahasiswa.status_jalur_saat_ini === "ekstensi",
    };

    res.json({
      success: true,
      data: {
        current_status: mahasiswa.status_jalur_saat_ini,
        has_active_submission: hasActiveSubmission,
        has_dospem_akademik: mahasiswa.dosen_pembimbing_akademik_id !== null,
        has_dospem_skripsi: mahasiswa.dosen_pembimbing_skripsi_id !== null,
        active_pamit: activePamit
          ? {
              id: activePamit.id,
              status_dpa: activePamit.status_dpa,
              tanggal: activePamit.createdAt,
            }
          : null,
        last_submission: lastSubmission
          ? {
              id: lastSubmission.id,
              status: lastSubmission.status,
              jenis_jalur: lastSubmission.jenis_jalur,
              tipe_pengajuan: lastSubmission.tipe_pengajuan,
              tanggal: lastSubmission.createdAt,
              dosen_pembimbing: lastSubmission.dosenCurrent,
            }
          : null,
        available_options: availableOptions,
      },
    });
  } catch (error) {
    console.error("Error di checkStatusJalur:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// ========== JALUR BARU ==========

// POST /api/jalur/baru/topik-dosen
exports.submitBaruTopikDosen = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const mahasiswa_id = req.user.id;
    const { topik_1_kode, topik_1_judul, dosen_1_nama, topik_2_kode, topik_2_judul, dosen_2_nama, topik_3_kode, topik_3_judul, dosen_3_nama } = req.body;

    // Validasi: minimal kode topik 1 wajib
    if (!topik_1_kode) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Topik 1 (kode topik) harus diisi",
      });
    }

    const mahasiswa = await Mahasiswa.findByPk(mahasiswa_id, { transaction: t });

    // Validasi eligibility
    if (mahasiswa.status_jalur_saat_ini !== "belum_mengajukan") {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: `Anda tidak eligible untuk jalur baru. Status: ${mahasiswa.status_jalur_saat_ini}`,
      });
    }

    if (mahasiswa.pengajuan_aktif_id) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Anda sudah memiliki pengajuan yang aktif",
      });
    }

    // Validasi: kode topik tidak boleh duplikat antar pilihan
    const topikKodes = [topik_1_kode, topik_2_kode, topik_3_kode].filter(Boolean);
    if (new Set(topikKodes).size !== topikKodes.length) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Kode topik tidak boleh sama antar pilihan",
      });
    }

    // Validasi topik exist
    const topiks = await Topik.findAll({
      where: { kode: { [Op.in]: topikKodes } },
      include: [{ model: Dosen, as: "dosen", attributes: ["id", "nip", "nama"] }],
      transaction: t,
    });

    const topikMap = {};
    topiks.forEach((topik) => {
      topikMap[topik.kode] = topik;
    });

    // Validasi keberadaan topik
    if (!topikMap[topik_1_kode]) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: `Topik dengan kode ${topik_1_kode} tidak ditemukan`,
      });
    }

    if (topik_2_kode && !topikMap[topik_2_kode]) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: `Topik dengan kode ${topik_2_kode} tidak ditemukan`,
      });
    }

    if (topik_3_kode && !topikMap[topik_3_kode]) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: `Topik dengan kode ${topik_3_kode} tidak ditemukan`,
      });
    }

    // Validasi konsistensi data input (jika judul/nama dosen dikirim dari client)
    const pilihanTopik = [
      { slot: 1, kode: topik_1_kode, inputJudul: topik_1_judul, inputDosen: dosen_1_nama },
      { slot: 2, kode: topik_2_kode, inputJudul: topik_2_judul, inputDosen: dosen_2_nama },
      { slot: 3, kode: topik_3_kode, inputJudul: topik_3_judul, inputDosen: dosen_3_nama },
    ].filter((item) => item.kode);

    const validationErrors = [];
    for (const item of pilihanTopik) {
      const validation = buildTopikValidationError({
        slot: item.slot,
        kode: item.kode,
        inputJudul: item.inputJudul,
        inputDosen: item.inputDosen,
        topikDb: topikMap[item.kode],
      });

      if (!validation.isValid) {
        validationErrors.push({
          message: validation.message,
          ...(validation.detail ? { detail: validation.detail } : {}),
        });
      }
    }

    if (validationErrors.length > 0) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: validationErrors.length === 1 ? validationErrors[0].message : "Beberapa topik tidak dapat dipilih. Silakan cek detail.",
        detail: validationErrors,
      });
    }

    const reserveResult = await reserveTopikKodes(topikKodes, t);
    if (!reserveResult.ok) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Topik yang dipilih sudah tidak tersedia. Silakan pilih topik lain.",
      });
    }

    // Kunci data judul dan dosen dari database (client tidak boleh override)
    const topik_1_judul_final = topikMap[topik_1_kode].judul;
    const topik_2_judul_final = topik_2_kode ? topikMap[topik_2_kode].judul : null;
    const topik_3_judul_final = topik_3_kode ? topikMap[topik_3_kode].judul : null;
    const dosen_1_nama_final = topikMap[topik_1_kode].dosen.nama;
    const dosen_2_nama_final = topik_2_kode ? topikMap[topik_2_kode].dosen.nama : null;
    const dosen_3_nama_final = topik_3_kode ? topikMap[topik_3_kode].dosen.nama : null;

    // Ambil dosen ID
    const dosen_pilihan_1 = topikMap[topik_1_kode].dosen_id;
    const dosen_pilihan_2 = topik_2_kode ? topikMap[topik_2_kode].dosen_id : null;
    const dosen_pilihan_3 = topik_3_kode ? topikMap[topik_3_kode].dosen_id : null;

    // VALIDASI KUOTA DOSEN PILIHAN 1
    const kuotaValidation = await validateDosenKuota(dosen_pilihan_1, t);
    if (!kuotaValidation.isAvailable) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: kuotaValidation.message,
        kuota_info: kuotaValidation.kuotaInfo,
      });
    }

    // Buat pengajuan
    const pengajuan = await Pengajuan.create(
      {
        mahasiswa_id,
        jenis_jalur: "baru",
        tipe_pengajuan: "topik_dosen",
        topik_1_kode,
        topik_1_judul: topik_1_judul_final,
        topik_2_kode,
        topik_2_judul: topik_2_judul_final,
        topik_3_kode,
        topik_3_judul: topik_3_judul_final,
        dosen_pilihan_1,
        dosen_1_nama: dosen_1_nama_final,
        dosen_pilihan_2,
        dosen_2_nama: dosen_2_nama_final,
        dosen_pilihan_3,
        dosen_3_nama: dosen_3_nama_final,
        dosen_saat_ini: dosen_pilihan_1,
        status: "pending",
      },
      { transaction: t }
    );

    // Update mahasiswa
    await mahasiswa.update(
      {
        status_jalur_saat_ini: "sedang_mengajukan",
        pengajuan_aktif_id: pengajuan.id,
      },
      { transaction: t }
    );

    await t.commit();

    // Load data lengkap
    const pengajuanLengkap = await Pengajuan.findByPk(pengajuan.id, {
      include: [
        { model: Dosen, as: "dosen1", attributes: ["id", "nip", "nama"] },
        { model: Dosen, as: "dosen2", attributes: ["id", "nip", "nama"] },
        { model: Dosen, as: "dosen3", attributes: ["id", "nip", "nama"] },
        { model: Dosen, as: "dosenCurrent", attributes: ["id", "nip", "nama"] },
      ],
    });

    res.status(201).json({
      success: true,
      message: "Pengajuan jalur baru (topik dosen) berhasil dibuat",
      data: pengajuanLengkap,
    });
  } catch (error) {
    if (!t.finished) await t.rollback();
    console.error("Error di submitBaruTopikDosen:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// POST /api/jalur/ulang/judul-mandiri
exports.submitUlangJudulMandiri = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const mahasiswa_id = req.user.id;
    const { pamit_id, judul_mandiri, deskripsi_mandiri, keyword_mandiri, prospective_supervisor_id } = req.body;

    // Validasi
    if (!pamit_id) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "pamit_id harus diisi. Silakan submit pamit terlebih dahulu.",
      });
    }

    if (!judul_mandiri || !deskripsi_mandiri || !keyword_mandiri || !prospective_supervisor_id) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Semua field wajib diisi: judul, deskripsi, keyword, dan calon dosen pembimbing",
      });
    }

    const mahasiswa = await Mahasiswa.findByPk(mahasiswa_id, { transaction: t });

    if (mahasiswa.pengajuan_aktif_id) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Anda sudah memiliki pengajuan yang aktif",
      });
    }

    // Validasi pamit
    const pamit = await PamitUlang.findByPk(pamit_id, { transaction: t });
    if (!pamit || pamit.mahasiswa_id !== mahasiswa_id) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Data pamit tidak ditemukan atau bukan milik Anda",
      });
    }

    // Validasi: Pamit harus sudah approved
    if (pamit.status_dpa !== "approved") {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: `Pamit belum disetujui oleh DPA. Status: ${pamit.status_dpa}`,
      });
    }

    // Validasi: Pamit belum digunakan
    if (pamit.pengajuan_baru_id) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Pamit ini sudah digunakan untuk pengajuan lain",
      });
    }

    // Validasi dosen
    const dosen = await Dosen.findByPk(prospective_supervisor_id, { transaction: t });
    if (!dosen) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Dosen pembimbing tidak ditemukan",
      });
    }

    // ⭐ VALIDASI KUOTA DOSEN ⭐
    const kuotaValidation = await validateDosenKuota(prospective_supervisor_id, t);
    if (!kuotaValidation.isAvailable) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: kuotaValidation.message,
        kuota_info: kuotaValidation.kuotaInfo,
      });
    }

    // Update pengajuan sebelumnya jadi 'dibatalkan'
    const previousSubmission = await Pengajuan.findByPk(pamit.pengajuan_sebelumnya_id, { transaction: t });
    await previousSubmission.update(
      {
        status: "dibatalkan",
        alasan_penolakan: `Mahasiswa mengundurkan diri. Alasan: ${pamit.alasan_ulang}`,
      },
      { transaction: t }
    );

    // Buat pengajuan ulang
    const pengajuan = await Pengajuan.create(
      {
        mahasiswa_id,
        jenis_jalur: "ulang",
        tipe_pengajuan: "judul_mandiri",
        pamit_ulang_id: pamit_id,
        pengajuan_sebelumnya_id: pamit.pengajuan_sebelumnya_id,
        judul_mandiri,
        deskripsi_mandiri,
        keyword_mandiri,
        prospective_supervisor_id,
        is_approved_by_supervisor: false,
        dosen_saat_ini: prospective_supervisor_id,
        status: "pending",
      },
      { transaction: t }
    );

    // Update pamit dengan pengajuan_baru_id
    await pamit.update({ pengajuan_baru_id: pengajuan.id }, { transaction: t });

    // Update mahasiswa
    await mahasiswa.update(
      {
        status_jalur_saat_ini: "sedang_mengajukan",
        pengajuan_aktif_id: pengajuan.id,
      },
      { transaction: t }
    );

    await t.commit();

    // Load data lengkap
    const pengajuanLengkap = await Pengajuan.findByPk(pengajuan.id, {
      include: [
        { model: Dosen, as: "prospectiveSupervisor", attributes: ["id", "nip", "nama", "email"] },
        { model: Dosen, as: "dosenCurrent", attributes: ["id", "nip", "nama"] },
        { model: PamitUlang, as: "pamitUlang" },
      ],
    });

    res.status(201).json({
      success: true,
      message: "Pengajuan jalur ulang (judul mandiri) berhasil dibuat. Menunggu approval dari calon dosen pembimbing.",
      data: {
        pengajuan: pengajuanLengkap,
        pengajuan_sebelumnya: {
          id: previousSubmission.id,
          status_baru: "dibatalkan",
        },
      },
    });
  } catch (error) {
    if (!t.finished) await t.rollback();
    console.error("Error di submitUlangJudulMandiri:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// ========== JALUR EKSTENSI ==========

// POST /api/jalur/ekstensi
exports.pengajuanEkstensi = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const mahasiswa_id = req.user.id;

    const mahasiswa = await Mahasiswa.findByPk(mahasiswa_id, { transaction: t });

    // Cek pengajuan yang approved sebelumnya
    const previousSubmission = await Pengajuan.findOne({
      where: {
        mahasiswa_id,
        status: "approved",
      },
      order: [["createdAt", "DESC"]],
      include: [
        {
          model: Dosen,
          as: "dosenCurrent",
          attributes: ["id", "nama", "nip", "email"],
        },
      ],
      transaction: t,
    });

    if (!previousSubmission) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Tidak ada pengajuan yang disetujui sebelumnya untuk di-ekstensi",
      });
    }

    if (mahasiswa.pengajuan_aktif_id) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Anda sudah memiliki pengajuan yang aktif",
      });
    }

    // TODO: Tambahkan validasi syarat ekstensi (misal: sudah 1 semester, dll)
    // Untuk sekarang, kita asumsikan syarat terpenuhi

    // Buat record ekstensi (melanjutkan yang lama)
    const pengajuanEkstensi = await Pengajuan.create(
      {
        mahasiswa_id,
        jenis_jalur: "ekstensi",
        tipe_pengajuan: previousSubmission.tipe_pengajuan,

        // Copy data dari pengajuan sebelumnya
        topik_1_kode: previousSubmission.topik_1_kode,
        topik_1_judul: previousSubmission.topik_1_judul,
        topik_2_kode: previousSubmission.topik_2_kode,
        topik_2_judul: previousSubmission.topik_2_judul,
        topik_3_kode: previousSubmission.topik_3_kode,
        topik_3_judul: previousSubmission.topik_3_judul,
        judul_mandiri: previousSubmission.judul_mandiri,
        deskripsi_mandiri: previousSubmission.deskripsi_mandiri,
        keyword_mandiri: previousSubmission.keyword_mandiri,

        dosen_pilihan_1: previousSubmission.dosen_pilihan_1,
        dosen_1_nama: previousSubmission.dosen_1_nama,
        dosen_pilihan_2: previousSubmission.dosen_pilihan_2,
        dosen_2_nama: previousSubmission.dosen_2_nama,
        dosen_pilihan_3: previousSubmission.dosen_pilihan_3,
        dosen_3_nama: previousSubmission.dosen_3_nama,
        dosen_saat_ini: previousSubmission.dosen_saat_ini,
        prospective_supervisor_id: previousSubmission.prospective_supervisor_id,

        pengajuan_sebelumnya_id: previousSubmission.id,
        status: "approved", // Langsung approved karena melanjutkan yang lama
      },
      { transaction: t }
    );

    // Update mahasiswa
    await mahasiswa.update(
      {
        status_jalur_saat_ini: "ekstensi",
        pengajuan_aktif_id: pengajuanEkstensi.id,
      },
      { transaction: t }
    );

    await t.commit();

    // Load data lengkap
    const pengajuanLengkap = await Pengajuan.findByPk(pengajuanEkstensi.id, {
      include: [{ model: Dosen, as: "dosenCurrent", attributes: ["id", "nip", "nama", "email"] }],
    });

    res.status(201).json({
      success: true,
      message: "Pengajuan ekstensi berhasil. Anda melanjutkan penelitian semester sebelumnya",
      data: {
        pengajuan: pengajuanLengkap,
        topik: previousSubmission.tipe_pengajuan === "judul_mandiri" ? previousSubmission.judul_mandiri : previousSubmission.topik_1_judul,
      },
    });
  } catch (error) {
    if (!t.finished) await t.rollback();
    console.error("Error di pengajuanEkstensi:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// POST /api/jalur/baru/judul-mandiri
exports.submitBaruJudulMandiri = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const mahasiswa_id = req.user.id;
    const { judul_mandiri, deskripsi_mandiri, keyword_mandiri, prospective_supervisor_id } = req.body;

    // Validasi input
    if (!judul_mandiri || !deskripsi_mandiri || !keyword_mandiri || !prospective_supervisor_id) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Semua field wajib diisi: judul, deskripsi, keyword, dan calon dosen pembimbing",
      });
    }

    const mahasiswa = await Mahasiswa.findByPk(mahasiswa_id, { transaction: t });

    // Validasi eligibility
    if (mahasiswa.status_jalur_saat_ini !== "belum_mengajukan") {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Anda tidak eligible untuk jalur baru",
      });
    }

    if (mahasiswa.pengajuan_aktif_id) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Anda sudah memiliki pengajuan yang aktif",
      });
    }

    // Validasi dosen exist
    const dosen = await Dosen.findByPk(prospective_supervisor_id, { transaction: t });
    if (!dosen) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Dosen pembimbing yang dipilih tidak ditemukan",
      });
    }

    // ⭐ VALIDASI KUOTA DOSEN ⭐
    const kuotaValidation = await validateDosenKuota(prospective_supervisor_id, t);
    if (!kuotaValidation.isAvailable) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: kuotaValidation.message,
        kuota_info: kuotaValidation.kuotaInfo,
      });
    }

    // Buat pengajuan
    const pengajuan = await Pengajuan.create(
      {
        mahasiswa_id,
        jenis_jalur: "baru",
        tipe_pengajuan: "judul_mandiri",
        judul_mandiri,
        deskripsi_mandiri,
        keyword_mandiri,
        prospective_supervisor_id,
        is_approved_by_supervisor: false,
        dosen_saat_ini: prospective_supervisor_id,
        status: "pending",
      },
      { transaction: t }
    );

    // Update mahasiswa
    await mahasiswa.update(
      {
        status_jalur_saat_ini: "sedang_mengajukan",
        pengajuan_aktif_id: pengajuan.id,
      },
      { transaction: t }
    );

    await t.commit();

    // Load data lengkap
    const pengajuanLengkap = await Pengajuan.findByPk(pengajuan.id, {
      include: [
        { model: Dosen, as: "prospectiveSupervisor", attributes: ["id", "nip", "nama", "email"] },
        { model: Dosen, as: "dosenCurrent", attributes: ["id", "nip", "nama"] },
      ],
    });

    res.status(201).json({
      success: true,
      message: "Pengajuan jalur baru (judul mandiri) berhasil dibuat. Menunggu approval dari calon dosen pembimbing.",
      data: pengajuanLengkap,
    });
  } catch (error) {
    if (!t.finished) await t.rollback();
    console.error("Error di submitBaruJudulMandiri:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// ========== JALUR ULANG - DENGAN PAMIT ==========

// POST /api/jalur/ulang/pamit - Submit pamit (LANGKAH 1)
exports.submitPamit = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const mahasiswa_id = req.user.id;
    const { pesan_ke_dosen_pembimbing, alasan_ulang, catatan_tambahan } = req.body;

    // Validasi input - SEMUA WAJIB kecuali catatan_tambahan
    if (!pesan_ke_dosen_pembimbing || !alasan_ulang) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Pesan ke dosen pembimbing dan alasan ulang harus diisi",
      });
    }

    const mahasiswa = await Mahasiswa.findByPk(mahasiswa_id, { transaction: t });

    // Validasi: Mahasiswa harus punya DPA
    if (!mahasiswa.dosen_pembimbing_akademik_id) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Anda belum memiliki dosen pembimbing akademik. Hubungi koordinator.",
      });
    }

    // Validasi: Mahasiswa harus punya Dosen Pembimbing Skripsi
    if (!mahasiswa.dosen_pembimbing_skripsi_id) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Anda belum memiliki dosen pembimbing skripsi. Tidak bisa mengajukan pamit ulang.",
      });
    }

    // Cek pengajuan yang approved sebelumnya
    const previousSubmission = await Pengajuan.findOne({
      where: {
        mahasiswa_id,
        status: "approved",
      },
      order: [["createdAt", "DESC"]],
      transaction: t,
    });

    if (!previousSubmission) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Tidak ada pengajuan yang disetujui sebelumnya",
      });
    }

    // Cek apakah sudah pernah submit pamit yang masih pending
    const existingPamit = await PamitUlang.findOne({
      where: {
        mahasiswa_id,
        status_dpa: "pending",
      },
      transaction: t,
    });

    if (existingPamit) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Anda sudah memiliki pamit yang sedang menunggu approval DPA",
      });
    }

    // Buat pamit baru dengan pesan ke dosen pembimbing
    const pamit = await PamitUlang.create(
      {
        mahasiswa_id,
        pengajuan_sebelumnya_id: previousSubmission.id,
        pesan_ke_dosen_pembimbing,
        alasan_ulang,
        catatan_tambahan: catatan_tambahan || null,
        status_dpa: "pending",
      },
      { transaction: t }
    );

    await t.commit();

    // Load data lengkap
    const pamitWithDetails = await PamitUlang.findByPk(pamit.id, {
      include: [
        {
          model: Pengajuan,
          as: "pengajuanSebelumnya",
          attributes: ["id", "topik_1_judul", "judul_mandiri", "status", "tipe_pengajuan"],
          include: [
            {
              model: Dosen,
              as: "dosenCurrent",
              attributes: ["id", "nip", "nama"],
            },
          ],
        },
      ],
    });

    res.status(201).json({
      success: true,
      message: "Pamit ulang berhasil disubmit. Pesan telah dikirim ke dosen pembimbing dan menunggu approval dari DPA.",
      data: {
        pamit: pamitWithDetails,
        status: "pending",
        next_step: "Tunggu approval dari DPA, kemudian pilih: Topik Dosen atau Judul Mandiri",
      },
    });
  } catch (error) {
    if (!t.finished) await t.rollback();
    console.error("Error di submitPamit:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// GET /api/jalur/ulang/status-pamit - Cek status pamit
exports.getStatusPamit = async (req, res) => {
  try {
    const mahasiswa_id = req.user.id;

    const pamit = await PamitUlang.findOne({
      where: {
        mahasiswa_id,
      },
      include: [
        {
          model: Pengajuan,
          as: "pengajuanSebelumnya",
          attributes: ["id", "topik_1_judul", "judul_mandiri", "tipe_pengajuan"],
          include: [
            {
              model: Dosen,
              as: "dosenCurrent",
              attributes: ["id", "nip", "nama"],
            },
          ],
        },
        {
          model: Pengajuan,
          as: "pengajuanBaru",
          attributes: ["id", "jenis_jalur", "tipe_pengajuan", "status"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    if (!pamit) {
      return res.json({
        success: true,
        data: {
          has_pamit: false,
          can_continue: false,
          message: "Belum ada pamit yang disubmit",
        },
      });
    }

    const canContinue = pamit.status_dpa === "approved" && !pamit.pengajuan_baru_id;

    res.json({
      success: true,
      data: {
        has_pamit: true,
        pamit_id: pamit.id,
        status_dpa: pamit.status_dpa,
        can_continue: canContinue,
        pamit,
        message: canContinue
          ? "Pamit sudah disetujui. Silakan lanjutkan dengan memilih topik baru."
          : pamit.status_dpa === "pending"
          ? "Menunggu approval dari DPA"
          : pamit.status_dpa === "rejected"
          ? "Pamit ditolak oleh DPA"
          : "Pamit sudah digunakan untuk pengajuan",
      },
    });
  } catch (error) {
    console.error("Error di getStatusPamit:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// GET /api/jalur/ulang/history-pamit - History semua pamit mahasiswa
exports.getHistoryPamit = async (req, res) => {
  try {
    const mahasiswa_id = req.user.id;

    const pamits = await PamitUlang.findAll({
      where: { mahasiswa_id },
      include: [
        {
          model: Pengajuan,
          as: "pengajuanSebelumnya",
          attributes: ["id", "topik_1_judul", "judul_mandiri", "status", "tipe_pengajuan"],
        },
        {
          model: Pengajuan,
          as: "pengajuanBaru",
          attributes: ["id", "jenis_jalur", "tipe_pengajuan", "status"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    res.json({
      success: true,
      data: pamits,
      total: pamits.length,
    });
  } catch (error) {
    console.error("Error di getHistoryPamit:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// POST /api/jalur/ulang/topik-dosen - Submit pengajuan ulang (LANGKAH 2)
exports.submitUlangTopikDosen = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const mahasiswa_id = req.user.id;
    const { pamit_id, topik_1_kode, topik_1_judul, dosen_1_nama, topik_2_kode, topik_2_judul, dosen_2_nama, topik_3_kode, topik_3_judul, dosen_3_nama } = req.body;

    // Validasi: pamit_id wajib
    if (!pamit_id) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "pamit_id harus diisi. Silakan submit pamit terlebih dahulu.",
      });
    }

    // Validasi: minimal kode topik 1 wajib
    if (!topik_1_kode) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Topik 1 (kode topik) harus diisi",
      });
    }

    const mahasiswa = await Mahasiswa.findByPk(mahasiswa_id, { transaction: t });

    if (mahasiswa.pengajuan_aktif_id) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Anda sudah memiliki pengajuan yang aktif",
      });
    }

    // Validasi: Pamit harus exist dan milik mahasiswa ini
    const pamit = await PamitUlang.findByPk(pamit_id, { transaction: t });
    if (!pamit || pamit.mahasiswa_id !== mahasiswa_id) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Data pamit tidak ditemukan atau bukan milik Anda",
      });
    }

    // Validasi: Pamit harus sudah approved oleh DPA
    if (pamit.status_dpa !== "approved") {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: `Pamit belum disetujui oleh DPA. Status: ${pamit.status_dpa}`,
      });
    }

    // Validasi: Pamit belum digunakan untuk pengajuan lain
    if (pamit.pengajuan_baru_id) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Pamit ini sudah digunakan untuk pengajuan lain",
      });
    }

    // Validasi: kode topik tidak boleh duplikat antar pilihan
    const topikKodes = [topik_1_kode, topik_2_kode, topik_3_kode].filter(Boolean);
    if (new Set(topikKodes).size !== topikKodes.length) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Kode topik tidak boleh sama antar pilihan",
      });
    }

    // Validasi topik exist
    const topiks = await Topik.findAll({
      where: { kode: { [Op.in]: topikKodes } },
      include: [{ model: Dosen, as: "dosen", attributes: ["id", "nip", "nama"] }],
      transaction: t,
    });

    const topikMap = {};
    topiks.forEach((topik) => {
      topikMap[topik.kode] = topik;
    });

    if (!topikMap[topik_1_kode]) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: `Topik dengan kode ${topik_1_kode} tidak ditemukan`,
      });
    }

    if (topik_2_kode && !topikMap[topik_2_kode]) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: `Topik dengan kode ${topik_2_kode} tidak ditemukan`,
      });
    }

    if (topik_3_kode && !topikMap[topik_3_kode]) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: `Topik dengan kode ${topik_3_kode} tidak ditemukan`,
      });
    }

    // Validasi konsistensi data input (jika judul/nama dosen dikirim dari client)
    const pilihanTopik = [
      { slot: 1, kode: topik_1_kode, inputJudul: topik_1_judul, inputDosen: dosen_1_nama },
      { slot: 2, kode: topik_2_kode, inputJudul: topik_2_judul, inputDosen: dosen_2_nama },
      { slot: 3, kode: topik_3_kode, inputJudul: topik_3_judul, inputDosen: dosen_3_nama },
    ].filter((item) => item.kode);

    const validationErrors = [];
    for (const item of pilihanTopik) {
      const validation = buildTopikValidationError({
        slot: item.slot,
        kode: item.kode,
        inputJudul: item.inputJudul,
        inputDosen: item.inputDosen,
        topikDb: topikMap[item.kode],
      });

      if (!validation.isValid) {
        validationErrors.push({
          message: validation.message,
          ...(validation.detail ? { detail: validation.detail } : {}),
        });
      }
    }

    if (validationErrors.length > 0) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: validationErrors.length === 1 ? validationErrors[0].message : "Beberapa topik tidak dapat dipilih. Silakan cek detail.",
        detail: validationErrors,
      });
    }

    const reserveResult = await reserveTopikKodes(topikKodes, t);
    if (!reserveResult.ok) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Topik yang dipilih sudah tidak tersedia. Silakan pilih topik lain.",
      });
    }

    // Kunci data judul dan dosen dari database (client tidak boleh override)
    const topik_1_judul_final = topikMap[topik_1_kode].judul;
    const topik_2_judul_final = topik_2_kode ? topikMap[topik_2_kode].judul : null;
    const topik_3_judul_final = topik_3_kode ? topikMap[topik_3_kode].judul : null;
    const dosen_1_nama_final = topikMap[topik_1_kode].dosen.nama;
    const dosen_2_nama_final = topik_2_kode ? topikMap[topik_2_kode].dosen.nama : null;
    const dosen_3_nama_final = topik_3_kode ? topikMap[topik_3_kode].dosen.nama : null;

    // Ambil dosen ID
    const dosen_pilihan_1 = topikMap[topik_1_kode].dosen_id;
    const dosen_pilihan_2 = topik_2_kode ? topikMap[topik_2_kode].dosen_id : null;
    const dosen_pilihan_3 = topik_3_kode ? topikMap[topik_3_kode].dosen_id : null;

    // ⭐ VALIDASI KUOTA DOSEN PILIHAN 1 ⭐
    const kuotaValidation = await validateDosenKuota(dosen_pilihan_1, t);
    if (!kuotaValidation.isAvailable) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: kuotaValidation.message,
        kuota_info: kuotaValidation.kuotaInfo,
      });
    }

    // Update pengajuan sebelumnya jadi 'dibatalkan'
    const previousSubmission = await Pengajuan.findByPk(pamit.pengajuan_sebelumnya_id, { transaction: t });
    await previousSubmission.update(
      {
        status: "dibatalkan",
        alasan_penolakan: `Mahasiswa mengundurkan diri. Alasan: ${pamit.alasan_ulang}`,
      },
      { transaction: t }
    );

    // Buat pengajuan ulang
    const pengajuan = await Pengajuan.create(
      {
        mahasiswa_id,
        jenis_jalur: "ulang",
        tipe_pengajuan: "topik_dosen",
        pamit_ulang_id: pamit_id,
        pengajuan_sebelumnya_id: pamit.pengajuan_sebelumnya_id,
        topik_1_kode,
        topik_1_judul: topik_1_judul_final,
        topik_2_kode,
        topik_2_judul: topik_2_judul_final,
        topik_3_kode,
        topik_3_judul: topik_3_judul_final,
        dosen_pilihan_1,
        dosen_1_nama: dosen_1_nama_final,
        dosen_pilihan_2,
        dosen_2_nama: dosen_2_nama_final,
        dosen_pilihan_3,
        dosen_3_nama: dosen_3_nama_final,
        dosen_saat_ini: dosen_pilihan_1,
        status: "pending",
      },
      { transaction: t }
    );

    // Update pamit dengan pengajuan_baru_id
    await pamit.update({ pengajuan_baru_id: pengajuan.id }, { transaction: t });

    // Update mahasiswa
    await mahasiswa.update(
      {
        status_jalur_saat_ini: "sedang_mengajukan",
        pengajuan_aktif_id: pengajuan.id,
      },
      { transaction: t }
    );

    await t.commit();

    // Load data lengkap
    const pengajuanLengkap = await Pengajuan.findByPk(pengajuan.id, {
      include: [
        { model: Dosen, as: "dosen1", attributes: ["id", "nip", "nama"] },
        { model: Dosen, as: "dosen2", attributes: ["id", "nip", "nama"] },
        { model: Dosen, as: "dosen3", attributes: ["id", "nip", "nama"] },
        { model: Dosen, as: "dosenCurrent", attributes: ["id", "nip", "nama"] },
        { model: PamitUlang, as: "pamitUlang" },
      ],
    });

    res.status(201).json({
      success: true,
      message: "Pengajuan jalur ulang (topik dosen) berhasil dibuat",
      data: {
        pengajuan: pengajuanLengkap,
        pengajuan_sebelumnya: {
          id: previousSubmission.id,
          status_baru: "dibatalkan",
        },
      },
    });
  } catch (error) {
    if (!t.finished) await t.rollback();
    console.error("Error di submitUlangTopikDosen:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};
