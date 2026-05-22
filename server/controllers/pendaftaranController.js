const { Op } = require("sequelize");
const { Mahasiswa, Dosen, Klaster, PendaftaranPenjaluran, PeriodePenjaluran, sequelize } = require("../models");
const {
  evaluatePeriodeWindow,
  getPeriodeWindowErrorCode,
  getPeriodeWindowMessage,
} = require("../services/periodePenjaluranService");

const JENIS_JALUR_OPTIONS = ["penelitian", "pengabdian", "perintisan_bisnis", "magang"];
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
      (!JENIS_JALUR_OPTIONS.includes(jenisJalurUlang) || !dosenTASebelumnyaId || !dosenTABaruId)
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
        !dosenTASebelumnyaId ||
        !dosenTABaruId)
    ) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message:
          "Field wajib jalur alih: penjaluran_sebelumnya, penjaluran_baru, dosen_pembimbing_ta_sebelumnya_id, dosen_pembimbing_ta_baru_id.",
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

    const selectedJalur = resolveSelectedJalurFromPendaftaranPayload({
      pendaftaran,
      jenisJalurDiambil,
      jenisJalurUlang,
      penjaluranBaru,
    });
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

