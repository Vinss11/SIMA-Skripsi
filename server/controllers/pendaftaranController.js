const { Op } = require("sequelize");
const {
  Mahasiswa,
  Dosen,
  Klaster,
  Pengajuan,
  PamitUlang,
  PendaftaranPenjaluran,
  PeriodePenjaluran,
  KelompokPerintisanBisnis,
  AnggotaKelompokPerintisan,
  sequelize,
} = require("../models");
const {
  evaluatePeriodeWindow,
  getPeriodeWindowErrorCode,
  getPeriodeWindowMessage,
} = require("../services/periodePenjaluranService");

const JENIS_JALUR_OPTIONS = ["penelitian", "pengabdian", "perintisan_bisnis", "magang"];
const PERAN_TIM_PERINTISAN = ["hustler", "hipster", "hacker"];
const EMAIL_DOMAIN_MAHASISWA = "students.uii.ac.id";

function normalizeText(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function normalizeJenisJalur(value) {
  const raw = normalizeText(value).toLowerCase();
  if (!raw) return "";

  if (raw === "pengabdian kepada masyarakat") return "pengabdian";
  if (raw === "pengabdian masyarakat") return "pengabdian";
  if (raw === "perintisan bisnis") return "perintisan_bisnis";

  return raw.replace(/\s+/g, "_");
}

function formatJalurLabel(jalur) {
  if (!jalur) return "-";
  return String(jalur)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function deriveAngkatanFromNim(nim) {
  if (!/^\d+$/.test(nim)) return null;

  if (nim.length >= 4) {
    const first4 = Number(nim.slice(0, 4));
    if (first4 >= 2000 && first4 <= 2100) {
      return String(first4);
    }
  }

  if (nim.length >= 2) {
    const first2 = Number(nim.slice(0, 2));
    if (!Number.isNaN(first2)) {
      return String(2000 + first2);
    }
  }

  return null;
}

function deriveSemesterMahasiswa(angkatan, periode) {
  if (!angkatan || !periode?.tahun_akademik || !periode?.semester) {
    return 1;
  }

  const tahunMulaiAkademik = Number(String(periode.tahun_akademik).slice(0, 4));
  const tahunAngkatan = Number(angkatan);

  if (Number.isNaN(tahunMulaiAkademik) || Number.isNaN(tahunAngkatan) || tahunMulaiAkademik < tahunAngkatan) {
    return 1;
  }

  const base = (tahunMulaiAkademik - tahunAngkatan) * 2;
  const semester = base + (periode.semester === "ganjil" ? 1 : 2);
  return Math.max(1, Math.min(14, semester));
}

function resolveSelectedJalurFromPendaftaranPayload({ pendaftaran, jenisJalurDiambil, jenisJalurUlang, penjaluranBaru }) {
  if (pendaftaran === "baru") return jenisJalurDiambil || null;
  if (pendaftaran === "ulang") return jenisJalurUlang || null;
  if (pendaftaran === "alih") return penjaluranBaru || null;
  return null;
}

function resolveTargetFormByJalur(jalur) {
  switch (jalur) {
    case "penelitian":
      return "pengajuan_penelitian";
    case "magang":
      return "surat_rekomendasi_magang";
    case "pengabdian":
      return "pengajuan_pengabdian";
    case "perintisan_bisnis":
      return "pengajuan_perintisan_bisnis";
    default:
      return "pengajuan_penelitian";
  }
}

function buildPendaftaranSummary({ pendaftaran, selectedJalur, targetForm, periode }) {
  return {
    pendaftaran_id: pendaftaran.id,
    periode: periode
      ? {
          id: periode.id,
          label_periode: periode.label_periode,
          tahun_akademik: periode.tahun_akademik,
          semester: periode.semester,
        }
      : null,
    pendaftaran: {
      jalur: pendaftaran.jalur,
      selected_jalur: selectedJalur,
      status: pendaftaran.status,
      form_lanjutan_status: pendaftaran.form_lanjutan_status,
      jenis_jalur_diambil: pendaftaran.jenis_jalur_diambil,
      penjaluran_sebelumnya: pendaftaran.penjaluran_sebelumnya,
      penjaluran_baru: pendaftaran.penjaluran_baru,
    },
    next_action: {
      selected_jalur: selectedJalur,
      target_form: targetForm,
      locked_other_menu_until_submitted: true,
    },
  };
}

async function validateDosenIdsExist(dosenIds, transaction) {
  const uniqueIds = [...new Set(dosenIds.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0))];
  if (uniqueIds.length === 0) return new Map();

  const rows = await Dosen.findAll({
    where: { id: uniqueIds },
    attributes: ["id", "nik", "nama", "email"],
    transaction,
  });
  return new Map(rows.map((item) => [Number(item.id), item]));
}

async function getActivePeriode(transaction) {
  const periodeAktif = await PeriodePenjaluran.findOne({
    where: { is_active: true },
    order: [["updatedAt", "DESC"]],
    transaction,
  });
  return periodeAktif;
}

function buildPeriodeWindowErrorPayload(windowCheck) {
  return {
    success: false,
    code: getPeriodeWindowErrorCode(windowCheck),
    message: getPeriodeWindowMessage(windowCheck),
    detail: {
      reason: windowCheck.reason,
      tanggal_mulai: windowCheck.start || null,
      tanggal_selesai: windowCheck.end || null,
      now: windowCheck.now || null,
    },
  };
}

async function validateExistingBusinessMemberEligibility(mahasiswa, periodeAktif, transaction) {
  if (!mahasiswa) {
    return { eligible: false, reason: "Data mahasiswa tidak ditemukan." };
  }
  if (!mahasiswa.dosen_pembimbing_akademik_id) {
    return { eligible: false, reason: "DPA mahasiswa belum tersedia pada master data." };
  }
  if (mahasiswa.pengajuan_aktif_id) {
    return { eligible: false, reason: "Mahasiswa masih memiliki pengajuan aktif." };
  }

  const existingPendaftaran = await PendaftaranPenjaluran.findOne({
    where: {
      mahasiswa_id: mahasiswa.id,
      periode_penjaluran_id: periodeAktif.id,
    },
    transaction,
  });
  if (existingPendaftaran) {
    return { eligible: false, reason: "Mahasiswa sudah terdaftar pada periode penjaluran aktif." };
  }

  const previousPendaftaran = await PendaftaranPenjaluran.findOne({
    where: { mahasiswa_id: mahasiswa.id },
    order: [["createdAt", "DESC"]],
    transaction,
  });
  const previousJalur =
    previousPendaftaran?.jalur === "alih"
      ? previousPendaftaran.penjaluran_baru
      : previousPendaftaran?.jenis_jalur_diambil || null;

  const latestApprovedSubmission = await Pengajuan.findOne({
    where: {
      mahasiswa_id: mahasiswa.id,
      status: { [Op.in]: ["approved", "completed"] },
    },
    order: [["createdAt", "DESC"]],
    transaction,
  });
  if (!latestApprovedSubmission) {
    return { eligible: false, reason: "Mahasiswa belum memiliki pengajuan sebelumnya yang disetujui." };
  }
  if (!mahasiswa.dosen_pembimbing_skripsi_id) {
    return { eligible: false, reason: "Dosen pembimbing sebelumnya belum tersedia." };
  }

  const approvedPamit = await PamitUlang.findOne({
    where: {
      mahasiswa_id: mahasiswa.id,
      pengajuan_sebelumnya_id: latestApprovedSubmission.id,
      pengajuan_baru_id: null,
      status_dospem: "approved",
    },
    order: [["createdAt", "DESC"]],
    transaction,
  });
  if (!approvedPamit) {
    return {
      eligible: false,
      reason: "Pamit kepada dosen pembimbing sebelumnya belum disetujui.",
    };
  }

  return {
    eligible: true,
    latestApprovedSubmission,
    approvedPamit,
    previousJalur,
  };
}

function formatBusinessMemberOption(mahasiswa, eligibility) {
  return {
    id: mahasiswa.id,
    nim: mahasiswa.nim,
    nama: mahasiswa.nama,
    email: mahasiswa.email,
    angkatan: mahasiswa.angkatan,
    eligible: Boolean(eligibility?.eligible),
    eligibility_reason: eligibility?.eligible ? "" : eligibility?.reason || "Belum memenuhi syarat.",
    dosen_pembimbing_akademik: mahasiswa.dosenPembimbingAkademik
      ? {
          id: mahasiswa.dosenPembimbingAkademik.id,
          nik: mahasiswa.dosenPembimbingAkademik.nik,
          nama: mahasiswa.dosenPembimbingAkademik.nama,
        }
      : null,
    dosen_pembimbing_sebelumnya: mahasiswa.dosenPembimbingSkripsi
      ? {
          id: mahasiswa.dosenPembimbingSkripsi.id,
          nik: mahasiswa.dosenPembimbingSkripsi.nik,
          nama: mahasiswa.dosenPembimbingSkripsi.nama,
        }
      : null,
  };
}

// GET /api/pendaftaran/periode-aktif
exports.getPeriodeAktif = async (req, res) => {
  try {
    const periodeAktif = await getActivePeriode();
    if (!periodeAktif) {
      return res.status(404).json({
        success: false,
        message: "Periode pendaftaran masih belum dibuka oleh sekretaris prodi.",
      });
    }

    const periodeWindow = evaluatePeriodeWindow(periodeAktif);
    if (!periodeWindow.is_open) {
      return res.status(403).json(buildPeriodeWindowErrorPayload(periodeWindow));
    }

    res.json({
      success: true,
      data: periodeAktif,
    });
  } catch (error) {
    console.error("Error di getPeriodeAktif:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// GET /api/pendaftaran/dosen
exports.getDosenDropdown = async (req, res) => {
  try {
    const dosens = await Dosen.findAll({
      attributes: ["id", "kode_dosen", "nik", "nama", "email", "jabatan_struktural", "kuota_bimbingan"],
      include: [
        {
          model: Klaster,
          as: "klasters",
          attributes: ["id", "kode", "nama"],
          through: { attributes: [] },
          required: true,
        },
      ],
      order: [["nama", "ASC"]],
    });

    const pembagianBimbingan = await Mahasiswa.findAll({
      attributes: ["dosen_pembimbing_skripsi_id", [sequelize.fn("COUNT", sequelize.col("id")), "jumlah_bimbingan"]],
      where: {
        dosen_pembimbing_skripsi_id: { [Op.ne]: null },
      },
      group: ["dosen_pembimbing_skripsi_id"],
      raw: true,
    });

    const jumlahByDosenId = new Map(
      pembagianBimbingan.map((item) => [Number(item.dosen_pembimbing_skripsi_id), Number(item.jumlah_bimbingan || 0)])
    );

    const mappedDosens = dosens
      .map((dosen) => {
        const kuotaBimbingan = Number(dosen.kuota_bimbingan || 0);
        const jumlahBimbingan = jumlahByDosenId.get(dosen.id) || 0;
        const sisaKuota = Math.max(kuotaBimbingan - jumlahBimbingan, 0);

        return {
          id: dosen.id,
          kode_dosen: dosen.kode_dosen,
          nik: dosen.nik,
          nama: dosen.nama,
          email: dosen.email,
          jabatan_struktural: dosen.jabatan_struktural,
          kuota_bimbingan: kuotaBimbingan,
          jumlah_bimbingan: jumlahBimbingan,
          sisa_kuota: sisaKuota,
          is_no_bimbingan: jumlahBimbingan === 0,
          is_kuota_penuh: kuotaBimbingan > 0 ? sisaKuota <= 0 : false,
          klasters: Array.isArray(dosen.klasters)
            ? dosen.klasters.map((item) => ({
                id: item.id,
                kode: item.kode,
                nama: item.nama,
              }))
            : [],
        };
      })
      .sort((a, b) => {
        // Prioritas: dosen tanpa mahasiswa bimbingan, lalu yang kuotanya masih tersedia
        if (a.is_no_bimbingan !== b.is_no_bimbingan) return a.is_no_bimbingan ? -1 : 1;
        if (a.is_kuota_penuh !== b.is_kuota_penuh) return a.is_kuota_penuh ? 1 : -1;
        return a.nama.localeCompare(b.nama, "id-ID");
      });

    res.json({
      success: true,
      data: mappedDosens,
      total: mappedDosens.length,
    });
  } catch (error) {
    console.error("Error di getDosenDropdown:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// GET /api/pendaftaran/mahasiswa-perintisan?q=...&jenis=ulang|alih
exports.getMahasiswaPerintisanOptions = async (req, res) => {
  try {
    const query = normalizeText(req.query?.q);
    const jenisPendaftaran = normalizeText(req.query?.jenis).toLowerCase();
    if (query.length < 2) {
      return res.json({ success: true, data: [], total: 0 });
    }
    if (!["ulang", "alih"].includes(jenisPendaftaran)) {
      return res.status(400).json({
        success: false,
        message: "Jenis pendaftaran anggota harus Ulang atau Alih.",
      });
    }

    const periodeAktif = await getActivePeriode();
    if (!periodeAktif) {
      return res.status(404).json({
        success: false,
        message: "Periode pendaftaran belum aktif.",
      });
    }

    const rows = await Mahasiswa.findAll({
      where: {
        [Op.or]: [
          { nim: { [Op.iLike]: `%${query}%` } },
          { nama: { [Op.iLike]: `%${query}%` } },
        ],
      },
      attributes: [
        "id",
        "nim",
        "nama",
        "email",
        "angkatan",
        "dosen_pembimbing_akademik_id",
        "dosen_pembimbing_skripsi_id",
        "pengajuan_aktif_id",
      ],
      include: [
        {
          model: Dosen,
          as: "dosenPembimbingAkademik",
          attributes: ["id", "nik", "nama"],
          required: false,
        },
        {
          model: Dosen,
          as: "dosenPembimbingSkripsi",
          attributes: ["id", "nik", "nama"],
          required: false,
        },
      ],
      order: [["nama", "ASC"]],
      limit: 10,
    });

    const data = [];
    for (const mahasiswa of rows) {
      let eligibility = await validateExistingBusinessMemberEligibility(mahasiswa, periodeAktif);
      if (
        jenisPendaftaran === "alih" &&
        eligibility.eligible &&
        !eligibility.previousJalur
      ) {
        eligibility = {
          eligible: false,
          reason: "Jalur sebelumnya belum tercatat pada master data.",
        };
      }
      data.push(formatBusinessMemberOption(mahasiswa, eligibility));
    }

    return res.json({
      success: true,
      data,
      total: data.length,
    });
  } catch (error) {
    console.error("Error di getMahasiswaPerintisanOptions:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

async function createKelompokPerintisanRegistration({
  body,
  leaderInput,
  periodeAktif,
  transaction,
}) {
  const ketuaPeranTim = normalizeText(body.ketua_peran_tim).toLowerCase();
  const memberInputs = Array.isArray(body.anggota_perintisan) ? body.anggota_perintisan : [];
  if (memberInputs.length !== 2) {
    return { error: "Perintisan Bisnis wajib memiliki tepat dua anggota." };
  }

  const normalizedMembers = memberInputs.map((item) => ({
    jenis_pendaftaran: normalizeText(item?.jenis_pendaftaran).toLowerCase(),
    peran_tim: normalizeText(item?.peran_tim).toLowerCase(),
    mahasiswa_id: Number(item?.mahasiswa_id) || 0,
    nim: normalizeText(item?.nim),
    nama: normalizeText(item?.nama),
    dosen_pembimbing_akademik_id: Number(item?.dosen_pembimbing_akademik_id) || 0,
  }));
  const roles = [ketuaPeranTim, ...normalizedMembers.map((item) => item.peran_tim)];
  if (
    roles.some((role) => !PERAN_TIM_PERINTISAN.includes(role)) ||
    new Set(roles).size !== PERAN_TIM_PERINTISAN.length
  ) {
    return { error: "Satu kelompok wajib memiliki tepat satu Hustler, satu Hipster, dan satu Hacker." };
  }
  if (normalizedMembers.some((item) => !["baru", "ulang", "alih"].includes(item.jenis_pendaftaran))) {
    return { error: "Jenis pendaftaran setiap anggota wajib dipilih." };
  }

  const participants = [
    {
      ...leaderInput,
      posisi: "ketua",
      peran_tim: ketuaPeranTim,
    },
    ...normalizedMembers.map((item) => ({
      ...item,
      posisi: "anggota",
    })),
  ];

  const existingIds = participants
    .filter((item) => item.jenis_pendaftaran !== "baru" && item.mahasiswa_id)
    .map((item) => item.mahasiswa_id);
  const existingNims = participants
    .filter((item) => item.jenis_pendaftaran !== "baru" && !item.mahasiswa_id && item.nim)
    .map((item) => item.nim);
  const existingConditions = [
    ...(existingIds.length > 0 ? [{ id: { [Op.in]: existingIds } }] : []),
    ...(existingNims.length > 0 ? [{ nim: { [Op.in]: existingNims } }] : []),
  ];
  const existingRows =
    existingConditions.length > 0
      ? await Mahasiswa.findAll({
          where: { [Op.or]: existingConditions },
          transaction,
          lock: transaction.LOCK.UPDATE,
        })
      : [];
  const existingById = new Map(existingRows.map((item) => [Number(item.id), item]));
  const existingByNim = new Map(existingRows.map((item) => [String(item.nim), item]));

  const newParticipantNims = participants
    .filter((item) => item.jenis_pendaftaran === "baru")
    .map((item) => item.nim);
  if (new Set(newParticipantNims).size !== newParticipantNims.length) {
    return { error: "NIM ketua dan anggota tidak boleh sama." };
  }
  const existingNewNims = newParticipantNims.length
    ? await Mahasiswa.findAll({
        where: { nim: { [Op.in]: newParticipantNims } },
        attributes: ["nim"],
        transaction,
      })
    : [];
  if (existingNewNims.length > 0) {
    return {
      error: `NIM ${existingNewNims.map((item) => item.nim).join(", ")} sudah ada di master mahasiswa. Pilih jenis Ulang atau Alih.`,
    };
  }

  const resolvedParticipants = [];
  for (const participant of participants) {
    if (participant.jenis_pendaftaran === "baru") {
      if (!/^\d{8}$/.test(participant.nim)) {
        return { error: "NIM mahasiswa jalur Baru wajib tepat 8 digit angka." };
      }
      if (
        participant.nama.length < 2 ||
        participant.nama.length > 100 ||
        !/^[a-zA-Z\s'.-]+$/.test(participant.nama)
      ) {
        return { error: `Nama mahasiswa dengan NIM ${participant.nim} tidak valid.` };
      }
      if (!participant.dosen_pembimbing_akademik_id) {
        return { error: `DPA mahasiswa dengan NIM ${participant.nim} wajib dipilih.` };
      }
      resolvedParticipants.push(participant);
      continue;
    }

    const mahasiswa =
      existingById.get(Number(participant.mahasiswa_id)) ||
      existingByNim.get(String(participant.nim || ""));
    if (!mahasiswa) {
      return { error: "Mahasiswa Ulang/Alih harus dipilih dari master mahasiswa." };
    }
    const eligibility = await validateExistingBusinessMemberEligibility(
      mahasiswa,
      periodeAktif,
      transaction
    );
    if (!eligibility.eligible) {
      return { error: `${mahasiswa.nim} - ${mahasiswa.nama}: ${eligibility.reason}` };
    }
    if (participant.jenis_pendaftaran === "alih" && !eligibility.previousJalur) {
      return {
        error: `${mahasiswa.nim} - ${mahasiswa.nama}: jalur sebelumnya belum tercatat pada master data.`,
      };
    }
    resolvedParticipants.push({
      ...participant,
      mahasiswa,
      mahasiswa_id: mahasiswa.id,
      nim: mahasiswa.nim,
      nama: mahasiswa.nama,
      dosen_pembimbing_akademik_id: mahasiswa.dosen_pembimbing_akademik_id,
      dosen_pembimbing_ta_sebelumnya_id: mahasiswa.dosen_pembimbing_skripsi_id,
      penjaluran_sebelumnya: eligibility.previousJalur,
    });
  }

  const finalNims = resolvedParticipants.map((item) => String(item.nim));
  if (new Set(finalNims).size !== 3) {
    return { error: "Ketua dan anggota kelompok harus merupakan tiga mahasiswa yang berbeda." };
  }

  const dpaIds = resolvedParticipants
    .map((item) => Number(item.dosen_pembimbing_akademik_id))
    .filter(Boolean);
  const dpaMap = await validateDosenIdsExist(dpaIds, transaction);
  if (dpaMap.size !== new Set(dpaIds).size) {
    return { error: "Salah satu Dosen Pembimbing Akademik tidak ditemukan." };
  }

  for (const participant of resolvedParticipants) {
    if (!participant.mahasiswa) {
      participant.mahasiswa = await Mahasiswa.create(
        {
          nim: participant.nim,
          nama: participant.nama,
          email: `${participant.nim}@${EMAIL_DOMAIN_MAHASISWA}`,
          password: participant.nim,
          is_default_password: true,
          angkatan: deriveAngkatanFromNim(participant.nim),
          dosen_pembimbing_akademik_id: participant.dosen_pembimbing_akademik_id,
          status_jalur_saat_ini: "belum_mengajukan",
        },
        { transaction }
      );
      participant.mahasiswa_id = participant.mahasiswa.id;
    }

    const semesterMahasiswa = deriveSemesterMahasiswa(
      participant.mahasiswa.angkatan || deriveAngkatanFromNim(participant.nim),
      periodeAktif
    );
    participant.pendaftaran = await PendaftaranPenjaluran.create(
      {
        mahasiswa_id: participant.mahasiswa.id,
        periode_penjaluran_id: periodeAktif.id,
        jalur: participant.jenis_pendaftaran,
        semester_mahasiswa: semesterMahasiswa,
        status: "submitted",
        form_lanjutan_status: "draft",
        dosen_pembimbing_akademik_id: participant.dosen_pembimbing_akademik_id,
        jenis_jalur_diambil:
          participant.jenis_pendaftaran === "alih" ? null : "perintisan_bisnis",
        penjaluran_sebelumnya:
          participant.jenis_pendaftaran === "alih"
            ? normalizeJenisJalur(participant.penjaluran_sebelumnya) || null
            : null,
        penjaluran_baru:
          participant.jenis_pendaftaran === "alih" ? "perintisan_bisnis" : null,
        dosen_pembimbing_ta_id: null,
        dosen_pembimbing_ta_sebelumnya_id:
          participant.jenis_pendaftaran === "baru"
            ? null
            : participant.dosen_pembimbing_ta_sebelumnya_id,
        dosen_pembimbing_ta_baru_id: null,
      },
      { transaction }
    );
  }

  const ketua = resolvedParticipants.find((item) => item.posisi === "ketua");
  const kelompok = await KelompokPerintisanBisnis.create(
    {
      periode_penjaluran_id: periodeAktif.id,
      ketua_mahasiswa_id: ketua.mahasiswa.id,
      status: "draft",
    },
    { transaction }
  );

  await AnggotaKelompokPerintisan.bulkCreate(
    resolvedParticipants.map((item) => ({
      kelompok_id: kelompok.id,
      mahasiswa_id: item.mahasiswa.id,
      pendaftaran_penjaluran_id: item.pendaftaran.id,
      posisi: item.posisi,
      peran_tim: item.peran_tim,
      jenis_pendaftaran: item.jenis_pendaftaran,
    })),
    { transaction }
  );
  await Mahasiswa.update(
    {
      status_jalur_saat_ini: "belum_mengajukan",
      pengajuan_aktif_id: null,
    },
    {
      where: {
        id: { [Op.in]: resolvedParticipants.map((item) => item.mahasiswa.id) },
      },
      transaction,
    }
  );

  return {
    kelompok,
    ketua,
    participants: resolvedParticipants,
  };
}

// POST /api/pendaftaran/jalur-baru
exports.submitPendaftaranJalurBaru = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const nim = normalizeText(req.body.nim);
    const nama = normalizeText(req.body.nama);
    const email = normalizeText(req.body.email).toLowerCase();
    const pendaftaran = normalizeText(req.body.pendaftaran).toLowerCase() || "baru";
    const dosenPembimbingAkademikId = Number(req.body.dosen_pembimbing_akademik_id) || 0;
    const jenisJalurDiambil = normalizeJenisJalur(req.body.jenis_jalur_diambil);
    const jenisJalurUlang = normalizeJenisJalur(req.body.jenis_jalur_ulang);
    const penjaluranSebelumnya = normalizeJenisJalur(req.body.penjaluran_sebelumnya);
    const penjaluranBaru = normalizeJenisJalur(req.body.penjaluran_baru);
    const dosenPembimbingTAId = Number(req.body.dosen_pembimbing_ta_id) || 0;
    const dosenTASebelumnyaId = Number(req.body.dosen_pembimbing_ta_sebelumnya_id) || 0;
    const dosenTABaruId = Number(req.body.dosen_pembimbing_ta_baru_id) || 0;
    const selectedJalur = resolveSelectedJalurFromPendaftaranPayload({
      pendaftaran,
      jenisJalurDiambil,
      jenisJalurUlang,
      penjaluranBaru,
    });

    if (!nim || !nama || !email || !dosenPembimbingAkademikId) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Field wajib: email, nim, nama, dan dosen_pembimbing_akademik_id",
      });
    }

    if (!/^\d{8}$/.test(nim)) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "NIM tidak valid. NIM wajib tepat 8 digit angka.",
      });
    }

    if (nama.length < 2 || nama.length > 100) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Nama tidak valid. Panjang nama wajib 2 sampai 100 karakter.",
      });
    }

    if (!/^[a-zA-Z\s'.-]+$/.test(nama)) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Nama tidak valid. Nama hanya boleh huruf, spasi, titik, apostrof, dan tanda hubung.",
      });
    }

    const expectedEmail = `${nim}@${EMAIL_DOMAIN_MAHASISWA}`;
    if (email !== expectedEmail) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: `Format email wajib ${expectedEmail}.`,
      });
    }

    if (!["baru", "ulang", "alih"].includes(pendaftaran)) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Pilihan pendaftaran tidak valid.",
      });
    }

    if (pendaftaran === "baru" && !JENIS_JALUR_OPTIONS.includes(jenisJalurDiambil)) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Field wajib jalur baru: jenis_jalur_diambil.",
      });
    }

    if (
      pendaftaran === "ulang" &&
      (!JENIS_JALUR_OPTIONS.includes(jenisJalurUlang) ||
        (selectedJalur !== "perintisan_bisnis" && (!dosenTASebelumnyaId || !dosenTABaruId)))
    ) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message:
          "Field wajib jalur ulang: jenis_jalur_ulang, dosen_pembimbing_ta_sebelumnya_id, dosen_pembimbing_ta_baru_id.",
      });
    }

    if (
      pendaftaran === "alih" &&
      (!JENIS_JALUR_OPTIONS.includes(penjaluranSebelumnya) ||
        !JENIS_JALUR_OPTIONS.includes(penjaluranBaru) ||
        (selectedJalur !== "perintisan_bisnis" && (!dosenTASebelumnyaId || !dosenTABaruId)))
    ) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message:
          "Field wajib jalur alih: penjaluran_sebelumnya, penjaluran_baru, dosen_pembimbing_ta_sebelumnya_id, dosen_pembimbing_ta_baru_id.",
      });
    }

    if (selectedJalur === "perintisan_bisnis") {
      const periodeAktif = await getActivePeriode(t);
      if (!periodeAktif) {
        await t.rollback();
        return res.status(403).json({
          success: false,
          message: "Periode pendaftaran masih belum dibuka oleh sekretaris prodi.",
        });
      }
      const periodeWindow = evaluatePeriodeWindow(periodeAktif);
      if (!periodeWindow.is_open) {
        await t.rollback();
        return res.status(403).json(buildPeriodeWindowErrorPayload(periodeWindow));
      }

      const groupResult = await createKelompokPerintisanRegistration({
        body: req.body,
        leaderInput: {
          jenis_pendaftaran: pendaftaran,
          mahasiswa_id: Number(req.body.mahasiswa_id) || 0,
          nim,
          nama,
          dosen_pembimbing_akademik_id: dosenPembimbingAkademikId,
          penjaluran_sebelumnya: penjaluranSebelumnya,
        },
        periodeAktif,
        transaction: t,
      });
      if (groupResult.error) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: groupResult.error,
        });
      }

      await t.commit();
      const ketuaBaru = groupResult.ketua.jenis_pendaftaran === "baru";
      return res.status(201).json({
        success: true,
        message: "Kelompok Perintisan Bisnis berhasil didaftarkan dan menunggu verifikasi sekretaris prodi.",
        data: {
          pendaftaran_id: groupResult.ketua.pendaftaran.id,
          kelompok_perintisan_id: groupResult.kelompok.id,
          periode: {
            id: periodeAktif.id,
            label_periode: periodeAktif.label_periode,
            tahun_akademik: periodeAktif.tahun_akademik,
            semester: periodeAktif.semester,
          },
          anggota_kelompok: groupResult.participants.map((item) => ({
            mahasiswa_id: item.mahasiswa.id,
            pendaftaran_id: item.pendaftaran.id,
            nim: item.mahasiswa.nim,
            nama: item.mahasiswa.nama,
            posisi: item.posisi,
            peran_tim: item.peran_tim,
            jenis_pendaftaran: item.jenis_pendaftaran,
          })),
          akun_login: {
            username: groupResult.ketua.mahasiswa.nim,
            default_password: ketuaBaru ? groupResult.ketua.mahasiswa.nim : null,
            prompt_change_password: ketuaBaru,
            can_login: true,
            keterangan: ketuaBaru
              ? "Gunakan NIM sebagai username dan password awal."
              : "Gunakan kredensial akun mahasiswa yang sudah ada.",
          },
          next_action: {
            selected_jalur: "perintisan_bisnis",
            target_form: "pengajuan_perintisan_bisnis",
            locked_other_menu_until_submitted: true,
          },
        },
      });
    }

    const existingMahasiswa = await Mahasiswa.findOne({
      where: {
        [Op.or]: [{ nim }, { email }],
      },
      transaction: t,
    });

    if (existingMahasiswa) {
      const conflictField = existingMahasiswa.nim === nim ? "NIM" : "email";
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: `${conflictField} sudah terdaftar. Gunakan data lain atau login jika sudah punya akun.`,
      });
    }

    const dosenIds = new Set([dosenPembimbingAkademikId]);
    if (dosenPembimbingTAId) dosenIds.add(dosenPembimbingTAId);
    if (dosenTASebelumnyaId) dosenIds.add(dosenTASebelumnyaId);
    if (dosenTABaruId) dosenIds.add(dosenTABaruId);

    const dosens = await Dosen.findAll({
      where: {
        id: Array.from(dosenIds),
      },
      transaction: t,
    });
    const dosenMap = new Map(dosens.map((item) => [item.id, item]));
    const dosenPembimbingAkademik = dosenMap.get(dosenPembimbingAkademikId);
    const dosenPembimbingTA = dosenMap.get(dosenPembimbingTAId);
    const dosenTASebelumnya = dosenMap.get(dosenTASebelumnyaId);
    const dosenTABaru = dosenMap.get(dosenTABaruId);

    if (!dosenPembimbingAkademik) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Dosen Pembimbing Akademik tidak ditemukan.",
      });
    }

    if (pendaftaran === "baru" && dosenPembimbingTAId && !dosenPembimbingTA) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Dosen Pembimbing TA tidak ditemukan.",
      });
    }

    if (pendaftaran !== "baru" && (!dosenTASebelumnya || !dosenTABaru)) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Dosen pembimbing TA sebelumnya/baru tidak ditemukan.",
      });
    }

    const periodeAktif = await getActivePeriode(t);
    if (!periodeAktif) {
      await t.rollback();
      return res.status(403).json({
        success: false,
        message: "Periode pendaftaran masih belum dibuka oleh sekretaris prodi.",
      });
    }

    const periodeWindow = evaluatePeriodeWindow(periodeAktif);
    if (!periodeWindow.is_open) {
      await t.rollback();
      return res.status(403).json(buildPeriodeWindowErrorPayload(periodeWindow));
    }

    const angkatan = deriveAngkatanFromNim(nim);
    const semesterMahasiswa = deriveSemesterMahasiswa(angkatan, periodeAktif);

    const mahasiswa = await Mahasiswa.create(
      {
        nim,
        nama,
        email,
        password: nim,
        is_default_password: true,
        angkatan: angkatan || null,
        dosen_pembimbing_akademik_id: dosenPembimbingAkademik.id,
        status_jalur_saat_ini: "belum_mengajukan",
      },
      { transaction: t }
    );

    const pendaftaranRecord = await PendaftaranPenjaluran.create(
      {
        mahasiswa_id: mahasiswa.id,
        periode_penjaluran_id: periodeAktif.id,
        jalur: pendaftaran,
        semester_mahasiswa: semesterMahasiswa,
        status: "approved",
        form_lanjutan_status: "draft",
        dosen_pembimbing_akademik_id: dosenPembimbingAkademik.id,
        jenis_jalur_diambil: pendaftaran === "baru" ? jenisJalurDiambil : pendaftaran === "ulang" ? jenisJalurUlang : null,
        dosen_pembimbing_ta_id: pendaftaran === "baru" && dosenPembimbingTA ? dosenPembimbingTA.id : null,
        penjaluran_sebelumnya: pendaftaran === "alih" ? penjaluranSebelumnya : null,
        penjaluran_baru: pendaftaran === "alih" ? penjaluranBaru : null,
        dosen_pembimbing_ta_sebelumnya_id: pendaftaran !== "baru" ? dosenTASebelumnya.id : null,
        dosen_pembimbing_ta_baru_id: pendaftaran !== "baru" ? dosenTABaru.id : null,
        nomor_whatsapp: null,
        catatan: null,
      },
      { transaction: t }
    );

    const targetForm = resolveTargetFormByJalur(selectedJalur);

    await t.commit();

    res.status(201).json({
      success: true,
      message: "Pendaftaran penjaluran berhasil. Akun mahasiswa siap digunakan login.",
      data: {
        pendaftaran_id: pendaftaranRecord.id,
        periode: {
          id: periodeAktif.id,
          label_periode: periodeAktif.label_periode,
          tahun_akademik: periodeAktif.tahun_akademik,
          semester: periodeAktif.semester,
        },
        ringkasan_form: {
          pendaftaran,
          jenis_jalur_diambil: pendaftaran === "baru" ? jenisJalurDiambil : pendaftaran === "ulang" ? jenisJalurUlang : null,
          penjaluran_sebelumnya: pendaftaran === "alih" ? penjaluranSebelumnya : null,
          penjaluran_baru: pendaftaran === "alih" ? penjaluranBaru : null,
          dosen_pembimbing_akademik: {
            id: dosenPembimbingAkademik.id,
            nama: dosenPembimbingAkademik.nama,
            nik: dosenPembimbingAkademik.nik,
          },
          dosen_pembimbing_ta:
            pendaftaran === "baru" && dosenPembimbingTA
              ? {
                  id: dosenPembimbingTA.id,
                  nama: dosenPembimbingTA.nama,
                  nik: dosenPembimbingTA.nik,
                }
              : null,
          dosen_pembimbing_ta_sebelumnya:
            pendaftaran !== "baru"
              ? {
                  id: dosenTASebelumnya.id,
                  nama: dosenTASebelumnya.nama,
                  nik: dosenTASebelumnya.nik,
                }
              : null,
          dosen_pembimbing_ta_baru:
            pendaftaran !== "baru"
              ? {
                  id: dosenTABaru.id,
                  nama: dosenTABaru.nama,
                  nik: dosenTABaru.nik,
                }
              : null,
        },
        akun_login: {
          username: mahasiswa.nim,
          default_password: mahasiswa.nim,
          prompt_change_password: true,
          can_login: true,
          keterangan: "Akun dapat langsung login. Gunakan NIM sebagai username dan password awal, lalu segera ganti password.",
        },
        next_action: {
          selected_jalur: selectedJalur,
          target_form: targetForm,
          locked_other_menu_until_submitted: true,
        },
      },
    });
  } catch (error) {
    if (!t.finished) await t.rollback();
    console.error("Error di submitPendaftaranJalurBaru:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// POST /api/pendaftaran/ulang-alih - Pendaftaran ulang/alih untuk mahasiswa yang sudah login
exports.submitPendaftaranUlangAlih = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const body = req.body || {};
    const mahasiswaId = Number(req.user?.id) || 0;
    const pendaftaran = normalizeText(body.pendaftaran).toLowerCase();
    const jenisJalurUlang = normalizeJenisJalur(body.jenis_jalur_ulang);
    const pamitId = Number(body.pamit_id) || 0;
    const alasanPengajuan = normalizeText(body.alasan_pengajuan);

    if (pendaftaran !== "ulang") {
      await t.rollback();
      return res.status(409).json({
        success: false,
        code: "ALIH_JALUR_NOT_AVAILABLE",
        message: "Alih jalur belum tersedia. Implementasi tahap ini hanya mendukung Ulang Jalur Penelitian.",
      });
    }

    if (jenisJalurUlang !== "penelitian") {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Implementasi tahap ini hanya mendukung Ulang Jalur Penelitian.",
      });
    }

    if (!pamitId) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Pamit kepada dosen pembimbing sebelumnya harus disetujui terlebih dahulu.",
      });
    }

    if (alasanPengajuan.length < 10) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Alasan pengajuan minimal 10 karakter.",
      });
    }

    const mahasiswa = await Mahasiswa.findByPk(mahasiswaId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!mahasiswa) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Data mahasiswa tidak ditemukan.",
      });
    }

    if (mahasiswa.pengajuan_aktif_id) {
      await t.rollback();
      return res.status(409).json({
        success: false,
        message: "Anda masih memiliki pengajuan aktif. Selesaikan proses tersebut sebelum daftar ulang/alih jalur.",
      });
    }

    const periodeAktif = await getActivePeriode(t);
    if (!periodeAktif) {
      await t.rollback();
      return res.status(403).json({
        success: false,
        message: "Periode pendaftaran masih belum dibuka oleh sekretaris prodi.",
      });
    }

    const periodeWindow = evaluatePeriodeWindow(periodeAktif);
    if (!periodeWindow.is_open) {
      await t.rollback();
      return res.status(403).json(buildPeriodeWindowErrorPayload(periodeWindow));
    }

    const samePeriodNewPendaftaran = await PendaftaranPenjaluran.findOne({
      where: {
        mahasiswa_id: mahasiswa.id,
        periode_penjaluran_id: periodeAktif.id,
        jalur: "baru",
      },
      order: [["createdAt", "DESC"]],
      transaction: t,
    });

    if (samePeriodNewPendaftaran) {
      await t.rollback();
      return res.status(409).json({
        success: false,
        code: "SAME_PERIOD_NEW_REGISTRATION",
        message:
          "Alih/ulang jalur tidak dapat dilakukan pada periode yang sama dengan pendaftaran jalur baru.",
      });
    }

    const existingPendaftaran = await PendaftaranPenjaluran.findOne({
      where: {
        mahasiswa_id: mahasiswa.id,
        periode_penjaluran_id: periodeAktif.id,
      },
      order: [["createdAt", "DESC"]],
      transaction: t,
    });

    if (existingPendaftaran) {
      await t.rollback();
      return res.status(409).json({
        success: false,
        message: "Anda sudah memiliki pendaftaran penjaluran pada periode aktif ini.",
      });
    }

    const latestApprovedSubmission = await Pengajuan.findOne({
      where: {
        mahasiswa_id: mahasiswa.id,
        status: { [Op.in]: ["approved", "completed"] },
      },
      order: [["createdAt", "DESC"]],
      transaction: t,
    });

    if (!latestApprovedSubmission) {
      await t.rollback();
      return res.status(409).json({
        success: false,
        message: "Ulang/alih jalur membutuhkan pengajuan sebelumnya yang sudah disetujui.",
      });
    }

    const pamitUlang = await PamitUlang.findByPk(pamitId, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!pamitUlang || Number(pamitUlang.mahasiswa_id) !== Number(mahasiswa.id)) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Data pamit tidak ditemukan atau bukan milik Anda.",
      });
    }

    if (pamitUlang.status_dospem !== "approved") {
      await t.rollback();
      return res.status(409).json({
        success: false,
        message: "Pamit masih menunggu persetujuan dosen pembimbing sebelumnya.",
      });
    }

    if (pamitUlang.pengajuan_baru_id) {
      await t.rollback();
      return res.status(409).json({
        success: false,
        message: "Pamit ini sudah digunakan untuk pengajuan ulang sebelumnya.",
      });
    }

    if (Number(pamitUlang.pengajuan_sebelumnya_id) !== Number(latestApprovedSubmission.id)) {
      await t.rollback();
      return res.status(409).json({
        success: false,
        message: "Pamit tidak sesuai dengan pengajuan Penelitian terakhir yang disetujui.",
      });
    }

    const dosenMap = await validateDosenIdsExist(
      [mahasiswa.dosen_pembimbing_akademik_id, mahasiswa.dosen_pembimbing_skripsi_id],
      t
    );
    const dosenPembimbingAkademik = dosenMap.get(Number(mahasiswa.dosen_pembimbing_akademik_id));
    const dosenTASebelumnya = dosenMap.get(Number(mahasiswa.dosen_pembimbing_skripsi_id));

    if (!dosenPembimbingAkademik) {
      await t.rollback();
      return res.status(409).json({
        success: false,
        message: "Dosen Pembimbing Akademik belum tersedia pada profil mahasiswa.",
      });
    }

    if (!dosenTASebelumnya) {
      await t.rollback();
      return res.status(409).json({
        success: false,
        message: "Dosen pembimbing Penelitian sebelumnya tidak ditemukan pada profil mahasiswa.",
      });
    }

    const angkatan = mahasiswa.angkatan || deriveAngkatanFromNim(mahasiswa.nim);
    const semesterMahasiswa = deriveSemesterMahasiswa(angkatan, periodeAktif);
    const selectedJalur = "penelitian";

    const pendaftaranRecord = await PendaftaranPenjaluran.create(
      {
        mahasiswa_id: mahasiswa.id,
        periode_penjaluran_id: periodeAktif.id,
        jalur: pendaftaran,
        semester_mahasiswa: semesterMahasiswa,
        status: "approved",
        form_lanjutan_status: "draft",
        dosen_pembimbing_akademik_id: dosenPembimbingAkademik.id,
        jenis_jalur_diambil: "penelitian",
        dosen_pembimbing_ta_id: null,
        penjaluran_sebelumnya: null,
        penjaluran_baru: null,
        dosen_pembimbing_ta_sebelumnya_id: dosenTASebelumnya.id,
        dosen_pembimbing_ta_baru_id: null,
        nomor_whatsapp: null,
        catatan: alasanPengajuan,
      },
      { transaction: t }
    );

    await mahasiswa.update(
      {
        status_jalur_saat_ini: "belum_mengajukan",
        pengajuan_aktif_id: null,
      },
      { transaction: t }
    );

    await t.commit();

    const targetForm = resolveTargetFormByJalur(selectedJalur);
    return res.status(201).json({
      success: true,
      message: `Pendaftaran ${pendaftaran} jalur berhasil. Lanjutkan pengisian form ${formatJalurLabel(selectedJalur)} di menu Pengajuan.`,
      data: {
        ...buildPendaftaranSummary({
          pendaftaran: pendaftaranRecord,
          selectedJalur,
          targetForm,
          periode: periodeAktif,
        }),
        pamit_ulang: pamitUlang
          ? {
              id: pamitUlang.id,
              status_dospem: pamitUlang.status_dospem,
              status_dpa: pamitUlang.status_dpa,
            }
          : null,
      },
    });
  } catch (error) {
    if (!t.finished) await t.rollback();
    console.error("Error di submitPendaftaranUlangAlih:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

