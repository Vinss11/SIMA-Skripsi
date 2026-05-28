const { Op } = require("sequelize");
const {
  Pengajuan,
  Mahasiswa,
  Topik,
  Dosen,
  DosenKlaster,
  Klaster,
  KlasterKetuaPeriode,
  PendaftaranPenjaluran,
  RiwayatPersetujuan,
  PamitUlang,
  SekretarisProdi,
  IzinLanjutSkripsi,
  PeriodePenjaluran,
  sequelize,
} = require("../models");
const { fetchMahasiswaMasterData } = require("../services/mahasiswaMasterService");

async function resolveAuthenticatedDosenId(req, transaction = null) {
  if (req.user?.role === "dosen") {
    return req.user.id;
  }

  if (req.user?.role === "sekretaris_prodi") {
    const sekretaris = await SekretarisProdi.findByPk(req.user.id, {
      attributes: ["nik", "email", "jabatan"],
      transaction: transaction || undefined,
    });

    if (!sekretaris) return null;

    const where = [];
    if (sekretaris.nik) {
      where.push({ nik: String(sekretaris.nik).trim() });
    }
    if (sekretaris.email) {
      where.push({ email: String(sekretaris.email).trim().toLowerCase() });
    }

    const username = String(req.user?.username || "").trim();
    if (username) {
      where.push({ nik: username });
      where.push({ email: username.toLowerCase() });
    }

    if (where.length === 0) return null;

    let dosen = await Dosen.findOne({
      where: { [Op.or]: where },
      attributes: ["id"],
      transaction: transaction || undefined,
    });

    // Fallback: jika NIK/email berubah, map ke dosen berdasarkan jabatan struktural sekretaris
    if (!dosen && sekretaris.jabatan) {
      dosen = await Dosen.findOne({
        where: { jabatan_struktural: sekretaris.jabatan },
        attributes: ["id"],
        transaction: transaction || undefined,
      });
    }

    return dosen?.id || null;
  }

  return null;
}

// ========== PENGAJUAN SUBMISSIONS ==========

function buildTopikList(submission) {
  return [
    submission.topik_1_kode
      ? {
          slot: 1,
          kode: submission.topik_1_kode,
          judul: submission.topik_1_judul,
          dosen: submission.dosen_1_nama,
          dosen_id: submission.dosen_pilihan_1,
        }
      : null,
    submission.topik_2_kode
      ? {
          slot: 2,
          kode: submission.topik_2_kode,
          judul: submission.topik_2_judul,
          dosen: submission.dosen_2_nama,
          dosen_id: submission.dosen_pilihan_2,
        }
      : null,
    submission.topik_3_kode
      ? {
          slot: 3,
          kode: submission.topik_3_kode,
          judul: submission.topik_3_judul,
          dosen: submission.dosen_3_nama,
          dosen_id: submission.dosen_pilihan_3,
        }
      : null,
  ].filter(Boolean);
}

function getApprovedTopik(submission, topikList) {
  if (submission.status !== "approved" || topikList.length === 0) {
    return null;
  }

  const rejectedCount = (submission.riwayat || []).filter((item) => item.status === "rejected").length;
  const approvedSlot = Math.min(rejectedCount + 1, topikList.length);
  return topikList.find((item) => item.slot === approvedSlot) || null;
}

function getRiwayatApprovalType(item) {
  return String(item?.tipe_approval || "calon_pembimbing").toLowerCase();
}

function normalizeJenisJalurPenelitian(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  if (raw === "pengabdian kepada masyarakat" || raw === "pengabdian masyarakat") return "pengabdian";
  if (raw === "perintisan bisnis") return "perintisan_bisnis";
  return raw.replace(/\s+/g, "_");
}

async function isSubmissionPenelitianTrack(submission, transaction) {
  if (!submission?.mahasiswa_id) {
    return submission?.tipe_pengajuan === "topik_dosen" || submission?.tipe_pengajuan === "judul_mandiri";
  }

  const latestPendaftaran = await PendaftaranPenjaluran.findOne({
    where: {
      mahasiswa_id: submission.mahasiswa_id,
      status: { [Op.in]: ["approved", "processed", "submitted"] },
    },
    attributes: ["jalur", "jenis_jalur_diambil", "penjaluran_baru", "penjaluran_sebelumnya"],
    order: [["createdAt", "DESC"]],
    transaction,
  });

  if (!latestPendaftaran) {
    return submission.tipe_pengajuan === "topik_dosen" || submission.tipe_pengajuan === "judul_mandiri";
  }

  const jalur = String(latestPendaftaran.jalur || "").toLowerCase();
  const jenisRaw =
    jalur === "alih"
      ? latestPendaftaran.penjaluran_baru
      : latestPendaftaran.jenis_jalur_diambil || latestPendaftaran.penjaluran_baru || latestPendaftaran.penjaluran_sebelumnya;
  const jenis = normalizeJenisJalurPenelitian(jenisRaw);

  if (!jenis) {
    return submission.tipe_pengajuan === "topik_dosen" || submission.tipe_pengajuan === "judul_mandiri";
  }

  return jenis === "penelitian";
}

function getClusterApprovalStage(submission) {
  if (!submission || submission.status !== "pending") {
    return "non_pending_or_final";
  }

  const riwayat = Array.isArray(submission.riwayat) ? submission.riwayat : [];
  const hasCalonPembimbingApproved = riwayat.some(
    (item) => item.status === "approved" && getRiwayatApprovalType(item) === "calon_pembimbing"
  );
  const hasKetuaKlasterDecided = riwayat.some(
    (item) =>
      (item.status === "approved" || item.status === "rejected") &&
      getRiwayatApprovalType(item) === "koordinator"
  );

  if (hasCalonPembimbingApproved && !hasKetuaKlasterDecided) {
    return "pending_ketua_klaster";
  }

  return "pending_dosen_pembimbing";
}

function getTopikDosenApprovalStage(submission) {
  if (!submission || submission.tipe_pengajuan !== "topik_dosen") {
    return "non_topik_dosen_or_final";
  }

  if (submission.status === "menunggu_set_ketua_cluster") {
    return "menunggu_set_ketua_cluster";
  }

  const stage = getClusterApprovalStage(submission);
  return stage === "non_pending_or_final" ? "non_topik_dosen_or_final" : stage;
}

function getTopikByReviewerDosen(submission, dosenId) {
  const currentDosenId = Number(dosenId);
  if (Number(submission.dosen_pilihan_1) === currentDosenId && submission.topik_1_kode) {
    return {
      slot: 1,
      kode: submission.topik_1_kode,
      judul: submission.topik_1_judul,
      dosen_id: submission.dosen_pilihan_1,
      dosen_nama: submission.dosen_1_nama,
    };
  }
  if (Number(submission.dosen_pilihan_2) === currentDosenId && submission.topik_2_kode) {
    return {
      slot: 2,
      kode: submission.topik_2_kode,
      judul: submission.topik_2_judul,
      dosen_id: submission.dosen_pilihan_2,
      dosen_nama: submission.dosen_2_nama,
    };
  }
  if (Number(submission.dosen_pilihan_3) === currentDosenId && submission.topik_3_kode) {
    return {
      slot: 3,
      kode: submission.topik_3_kode,
      judul: submission.topik_3_judul,
      dosen_id: submission.dosen_pilihan_3,
      dosen_nama: submission.dosen_3_nama,
    };
  }
  return null;
}

function getTopikWaitingKetuaKlaster(submission) {
  const topikList = buildTopikList(submission);
  if (topikList.length === 0) return null;

  const rejectedCalonCount = (submission.riwayat || []).filter(
    (item) => item.status === "rejected" && getRiwayatApprovalType(item) === "calon_pembimbing"
  ).length;
  const approvedSlot = Math.min(rejectedCalonCount + 1, topikList.length);
  return topikList.find((item) => item.slot === approvedSlot) || null;
}

function normalizeTopikClusterCode(clusterValue) {
  const value = String(clusterValue || "").trim().toUpperCase();
  if (!value) return null;
  if (value === "SIRKEL") return "SIRKEL";
  if (value === "SIBER") return "SIBER";
  if (value === "ITSC") return "ITSC";
  if (value === "MVK") return "MVK";
  if (value.includes("SISTEM INFORMASI") || value.includes("REKAYASA PERANGKAT LUNAK")) return "SIRKEL";
  if (value.includes("SIBER")) return "SIBER";
  if (value.includes("INTELLIGENT") || value.includes("CERDAS") || value.includes("ITSC")) return "ITSC";
  if (value.includes("MULTIMEDIA") || value.includes("VISI KOMPUTER") || value.includes("MVK")) return "MVK";
  return value;
}

async function resolveKetuaKlasterByTopikKode(topikKode, transaction) {
  if (!topikKode) {
    return {
      ok: false,
      reason: "TOPIK_NOT_FOUND",
      message: "Topik yang disetujui tidak ditemukan.",
    };
  }

  const topik = await Topik.findOne({
    where: { kode: topikKode },
    attributes: ["kode", "cluster"],
    transaction,
  });
  if (!topik) {
    return {
      ok: false,
      reason: "TOPIK_NOT_FOUND",
      message: `Topik ${topikKode} tidak ditemukan.`,
    };
  }

  const klasterFromField = normalizeTopikClusterCode(topik.cluster);
  const kodePrefix = String(topik.kode || "")
    .trim()
    .toUpperCase()
    .replace(/[0-9].*$/, "");
  const klasterFromKode = normalizeTopikClusterCode(kodePrefix);
  const klasterKode = klasterFromField || klasterFromKode;
  if (!klasterKode) {
    return {
      ok: false,
      reason: "CLUSTER_NOT_FOUND",
      message: `Klaster topik ${topikKode} tidak valid atau belum diisi.`,
    };
  }

  const klaster = await Klaster.findOne({
    where: { kode: klasterKode },
    attributes: ["id", "kode", "nama"],
    transaction,
  });
  if (!klaster) {
    return {
      ok: false,
      reason: "CLUSTER_NOT_FOUND",
      message: `Master klaster ${klasterKode} belum tersedia.`,
    };
  }

  const periodeAktif = await PeriodePenjaluran.findOne({
    where: { is_active: true },
    attributes: ["id", "label_periode", "tahun_akademik", "semester"],
    order: [["updatedAt", "DESC"]],
    transaction,
  });
  if (!periodeAktif) {
    return {
      ok: false,
      reason: "NO_ACTIVE_PERIODE",
      message: "Belum ada periode penjaluran aktif. Sekretaris prodi harus membuka periode terlebih dahulu.",
    };
  }

  const ketuaKlaster = await KlasterKetuaPeriode.findOne({
    where: {
      klaster_id: klaster.id,
      periode_penjaluran_id: periodeAktif.id,
    },
    attributes: ["id", "dosen_id", "klaster_id", "periode_penjaluran_id"],
    include: [
      {
        model: Dosen,
        as: "ketuaDosen",
        attributes: ["id", "nik", "nama", "email"],
        required: true,
      },
    ],
    transaction,
  });

  if (!ketuaKlaster) {
    return {
      ok: false,
      reason: "KETUA_NOT_SET",
      message: `Ketua cluster untuk ${klaster.kode} pada periode ${periodeAktif.label_periode} belum ditetapkan.`,
      detail: {
        klaster: klaster.kode,
        periode: periodeAktif.label_periode,
      },
    };
  }

  return {
    ok: true,
    reason: "OK",
    topik,
    klaster,
    periode: periodeAktif,
    ketuaKlaster,
  };
}

async function resolveKetuaKlasterByDosenId(dosenId, transaction) {
  if (!dosenId) {
    return {
      ok: false,
      reason: "DOSEN_NOT_FOUND",
      message: "Dosen pembimbing untuk pemetaan klaster tidak ditemukan.",
    };
  }

  const dosenKlasterRows = await DosenKlaster.findAll({
    where: { dosen_id: dosenId },
    attributes: ["dosen_id", "klaster_id"],
    include: [
      {
        model: Klaster,
        as: "klaster",
        attributes: ["id", "kode", "nama"],
        required: true,
      },
    ],
    order: [[{ model: Klaster, as: "klaster" }, "kode", "ASC"]],
    transaction,
  });

  if (!dosenKlasterRows.length) {
    return {
      ok: false,
      reason: "DOSEN_CLUSTER_NOT_SET",
      message: "Dosen pembimbing belum terdaftar pada klaster manapun.",
    };
  }

  const klaster = dosenKlasterRows[0].klaster;

  const periodeAktif = await PeriodePenjaluran.findOne({
    where: { is_active: true },
    attributes: ["id", "label_periode", "tahun_akademik", "semester"],
    order: [["updatedAt", "DESC"]],
    transaction,
  });
  if (!periodeAktif) {
    return {
      ok: false,
      reason: "NO_ACTIVE_PERIODE",
      message: "Belum ada periode penjaluran aktif. Sekretaris prodi harus membuka periode terlebih dahulu.",
    };
  }

  const ketuaKlaster = await KlasterKetuaPeriode.findOne({
    where: {
      klaster_id: klaster.id,
      periode_penjaluran_id: periodeAktif.id,
    },
    attributes: ["id", "dosen_id", "klaster_id", "periode_penjaluran_id"],
    include: [
      {
        model: Dosen,
        as: "ketuaDosen",
        attributes: ["id", "nik", "nama", "email"],
        required: true,
      },
    ],
    transaction,
  });

  if (!ketuaKlaster) {
    return {
      ok: false,
      reason: "KETUA_NOT_SET",
      message: `Ketua cluster untuk ${klaster.kode} pada periode ${periodeAktif.label_periode} belum ditetapkan.`,
      detail: {
        klaster: klaster.kode,
        periode: periodeAktif.label_periode,
      },
    };
  }

  return {
    ok: true,
    reason: "OK",
    klaster,
    periode: periodeAktif,
    ketuaKlaster,
  };
}

async function resolveEffectiveApprovalStage({
  submission,
  dosenId,
  isTopikDosen,
  isJudulMandiri,
  requiresKetuaCluster,
  approvalStage,
  transaction,
}) {
  if (!requiresKetuaCluster || approvalStage !== "pending_dosen_pembimbing") {
    return approvalStage;
  }

  const currentDosenId = Number(dosenId);

  if (isTopikDosen) {
    const reviewerTopik = getTopikByReviewerDosen(submission, currentDosenId);
    if (reviewerTopik) {
      return approvalStage;
    }

    const topikWaiting = getTopikWaitingKetuaKlaster(submission);
    if (!topikWaiting?.kode) {
      return approvalStage;
    }

    const ketuaResolution = await resolveKetuaKlasterByTopikKode(topikWaiting.kode, transaction);
    if (ketuaResolution.ok && Number(ketuaResolution.ketuaKlaster.dosen_id) === currentDosenId) {
      return "pending_ketua_klaster";
    }
    return approvalStage;
  }

  if (isJudulMandiri) {
    const prospectiveId = Number(submission.prospective_supervisor_id || 0);
    if (!prospectiveId || prospectiveId === currentDosenId) {
      return approvalStage;
    }

    const ketuaResolution = await resolveKetuaKlasterByDosenId(prospectiveId, transaction);
    if (ketuaResolution.ok && Number(ketuaResolution.ketuaKlaster.dosen_id) === currentDosenId) {
      return "pending_ketua_klaster";
    }
  }

  return approvalStage;
}

function formatSubmissionDecisionResponse(submission) {
  const riwayatOrdered = (submission.riwayat || [])
    .slice()
    .sort((a, b) => new Date(a.tanggal_keputusan || a.createdAt) - new Date(b.tanggal_keputusan || b.createdAt));

  const latestApproved = riwayatOrdered
    .slice()
    .reverse()
    .find((item) => item.status === "approved");

  const topikList = buildTopikList(submission);
  const approvedTopik = submission.tipe_pengajuan === "topik_dosen" ? getApprovedTopik(submission, topikList) : null;

  const responseData = {
    id: submission.id,
    jenis_jalur: submission.jenis_jalur,
    tipe_pengajuan: submission.tipe_pengajuan,
    status: submission.status,
    diajukan_pada: submission.createdAt,
    diproses_pada: submission.updatedAt,
    mahasiswa: submission.mahasiswa
      ? {
          id: submission.mahasiswa.id,
          nim: submission.mahasiswa.nim,
          nama: submission.mahasiswa.nama,
          email: submission.mahasiswa.email,
        }
      : null,
    detail_pengajuan: null,
    hasil_approval: {
      status_pengajuan: submission.status,
      keterangan: submission.alasan_persetujuan || latestApproved?.keterangan || null,
      tanggal_keputusan: latestApproved ? latestApproved.tanggal_keputusan || latestApproved.createdAt : submission.updatedAt,
      dosen: latestApproved?.dosen
        ? {
            id: latestApproved.dosen.id,
            nik: latestApproved.dosen.nik,
            nama: latestApproved.dosen.nama,
          }
        : submission.dosenCurrent
        ? {
            id: submission.dosenCurrent.id,
            nik: submission.dosenCurrent.nik,
            nama: submission.dosenCurrent.nama,
          }
        : null,
    },
    riwayat_persetujuan: riwayatOrdered.map((item) => ({
      status: item.status,
      keterangan: item.keterangan,
      tanggal_keputusan: item.tanggal_keputusan || item.createdAt,
      dosen: item.dosen
        ? {
            id: item.dosen.id,
            nik: item.dosen.nik,
            nama: item.dosen.nama,
          }
        : null,
    })),
  };

  if (submission.tipe_pengajuan === "topik_dosen") {
    responseData.detail_pengajuan = {
      topik_dipilih: topikList.map(({ slot, kode, judul, dosen }) => ({ slot, kode, judul, dosen })),
      topik_disetujui: approvedTopik
        ? {
            slot: approvedTopik.slot,
            kode: approvedTopik.kode,
            judul: approvedTopik.judul,
          }
        : null,
      dosen_pembimbing: approvedTopik
        ? {
            id: approvedTopik.dosen_id,
            nama: approvedTopik.dosen,
          }
        : submission.dosenCurrent
        ? {
            id: submission.dosenCurrent.id,
            nama: submission.dosenCurrent.nama,
          }
        : null,
    };
  } else {
    responseData.detail_pengajuan = {
      judul_mandiri: submission.judul_mandiri,
      deskripsi_mandiri: submission.deskripsi_mandiri,
      keyword_mandiri: submission.keyword_mandiri,
      calon_dosen_pembimbing: submission.prospectiveSupervisor
        ? {
            id: submission.prospectiveSupervisor.id,
            nik: submission.prospectiveSupervisor.nik,
            nama: submission.prospectiveSupervisor.nama,
            email: submission.prospectiveSupervisor.email,
          }
        : null,
    };
  }

  return responseData;
}

function formatIzinLanjutItem(item) {
  return {
    id: item.id,
    mahasiswa_id: item.mahasiswa_id,
    dosen_pembimbing_skripsi_id: item.dosen_pembimbing_skripsi_id,
    periode_penjaluran_id: item.periode_penjaluran_id,
    semester_penjaluran_ke: item.semester_penjaluran_ke,
    status: item.status,
    alasan_pengajuan: item.alasan_pengajuan,
    keterangan_dosen: item.keterangan_dosen,
    tanggal_pengajuan: item.tanggal_pengajuan || item.createdAt,
    tanggal_keputusan: item.tanggal_keputusan,
    mahasiswa: item.mahasiswa
      ? {
          id: item.mahasiswa.id,
          nim: item.mahasiswa.nim,
          nama: item.mahasiswa.nama,
          email: item.mahasiswa.email,
          angkatan: item.mahasiswa.angkatan,
          status_jalur_saat_ini: item.mahasiswa.status_jalur_saat_ini,
        }
      : null,
    dosen_pembimbing_skripsi: item.dosenPembimbingSkripsi
      ? {
          id: item.dosenPembimbingSkripsi.id,
          nik: item.dosenPembimbingSkripsi.nik,
          nama: item.dosenPembimbingSkripsi.nama,
          email: item.dosenPembimbingSkripsi.email,
        }
      : null,
    periode: item.periode
      ? {
          id: item.periode.id,
          label_periode: item.periode.label_periode,
          tahun_akademik: item.periode.tahun_akademik,
          semester: item.periode.semester,
          is_active: item.periode.is_active,
        }
      : null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

// GET /api/dosen/submissions - Dosen melihat pengajuan yang ditujukan kepadanya
exports.getDosenSubmissions = async (req, res) => {
  try {
    const dosen_id = await resolveAuthenticatedDosenId(req);
    if (!dosen_id) {
      return res.status(403).json({
        success: false,
        message: "Akun ini tidak terhubung ke data dosen.",
      });
    }
    const { tipe_pengajuan } = req.query;
    const isSekretarisRole = req.user?.role === "sekretaris_prodi";

    const where = isSekretarisRole
      ? {
          [Op.or]: [{ dosen_saat_ini: dosen_id }, { status: "menunggu_set_ketua_cluster" }],
        }
      : {
          dosen_saat_ini: dosen_id,
        };

    if (tipe_pengajuan) {
      const allowedTipe = ["topik_dosen", "judul_mandiri"];
      if (!allowedTipe.includes(tipe_pengajuan)) {
        return res.status(400).json({
          success: false,
          message: "Parameter tipe_pengajuan tidak valid. Gunakan: topik_dosen atau judul_mandiri",
        });
      }
      where.tipe_pengajuan = tipe_pengajuan;
    }

    const submissions = await Pengajuan.findAll({
      where,
      include: [
        {
          model: Mahasiswa,
          as: "mahasiswa",
          attributes: ["id", "nim", "nama", "angkatan"],
        },
        {
          model: RiwayatPersetujuan,
          as: "riwayat",
          attributes: ["status", "tipe_approval"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    const compactData = submissions.map((submission) => {
      const approvalStage = getTopikDosenApprovalStage(submission);
      const base = {
        id: submission.id,
        mahasiswa: submission.mahasiswa
          ? {
              id: submission.mahasiswa.id,
              nim: submission.mahasiswa.nim,
              nama: submission.mahasiswa.nama,
              angkatan: submission.mahasiswa.angkatan,
            }
          : null,
        jenis_jalur: submission.jenis_jalur,
        tipe_pengajuan: submission.tipe_pengajuan,
        status: submission.status,
        tahap_approval: approvalStage,
        diajukan_pada: submission.createdAt,
        diperbarui_pada: submission.updatedAt,
      };

      if (submission.tipe_pengajuan === "topik_dosen") {
        const topikList = buildTopikList(submission);
        const approvedTopik = getApprovedTopik(submission, topikList);
        let focusedTopik = null;

        if (submission.status === "approved") {
          focusedTopik = approvedTopik;
        } else if (approvalStage === "pending_dosen_pembimbing") {
          focusedTopik = getTopikByReviewerDosen(submission, dosen_id) || topikList[0] || null;
        } else if (
          approvalStage === "pending_ketua_klaster" ||
          approvalStage === "menunggu_set_ketua_cluster"
        ) {
          focusedTopik = getTopikWaitingKetuaKlaster(submission) || topikList[0] || null;
        } else {
          focusedTopik = topikList[0] || null;
        }

        base.topik_dipilih = topikList.map(({ kode }) => kode);
        base.topik_dipilih_detail = topikList.map(({ slot, kode, judul, dosen, dosen_id: topikDosenId }) => ({
          slot,
          kode,
          judul: judul || null,
          dosen: dosen || null,
          dosen_id: topikDosenId || null,
        }));
        base.topik_fokus = focusedTopik
          ? {
              slot: focusedTopik.slot,
              kode: focusedTopik.kode,
              judul: focusedTopik.judul || null,
              dosen: focusedTopik.dosen || focusedTopik.dosen_nama || null,
              dosen_id: focusedTopik.dosen_id || null,
            }
          : null;
        base.topik_disetujui = approvedTopik
          ? {
              kode: approvedTopik.kode,
              judul: approvedTopik.judul,
            }
          : null;
      } else {
        base.judul_mandiri = submission.judul_mandiri;
      }

      return base;
    });

    res.json({
      success: true,
      data: compactData,
      total: compactData.length,
    });
  } catch (error) {
    console.error("Error di getDosenSubmissions:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// POST /api/dosen/submissions/:id/approve - Dosen menyetujui pengajuan
exports.approveSubmission = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { id } = req.params;
    const dosen_id = await resolveAuthenticatedDosenId(req, t);
    if (!dosen_id) {
      await t.rollback();
      return res.status(403).json({
        success: false,
        message: "Akun ini tidak terhubung ke data dosen.",
      });
    }

    const approvalNote = String(req.body?.keterangan || "").trim();

    const submission = await Pengajuan.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!submission) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Pengajuan tidak ditemukan",
      });
    }

    if (Number(submission.dosen_saat_ini) !== Number(dosen_id)) {
      await t.rollback();
      return res.status(403).json({
        success: false,
        message: "Anda tidak memiliki akses untuk menyetujui pengajuan ini",
      });
    }

    if (submission.status !== "pending") {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Pengajuan ini sudah diproses sebelumnya",
      });
    }

    const [mahasiswaInfo, riwayat] = await Promise.all([
      Mahasiswa.findByPk(submission.mahasiswa_id, {
        attributes: ["id", "nim", "nama", "email"],
        transaction: t,
      }),
      RiwayatPersetujuan.findAll({
        where: { pengajuan_id: submission.id },
        attributes: ["id", "status", "tipe_approval", "tanggal_keputusan", "createdAt"],
        transaction: t,
      }),
    ]);
    submission.setDataValue("mahasiswa", mahasiswaInfo);
    submission.setDataValue("riwayat", riwayat);

    const isTopikDosen = submission.tipe_pengajuan === "topik_dosen";
    const isJudulMandiri = submission.tipe_pengajuan === "judul_mandiri";
    const isPenelitianTrack = await isSubmissionPenelitianTrack(submission, t);
    const requiresKetuaCluster = isPenelitianTrack && (isTopikDosen || isJudulMandiri);
    const approvalStage = isTopikDosen ? getTopikDosenApprovalStage(submission) : getClusterApprovalStage(submission);
    const effectiveApprovalStage = await resolveEffectiveApprovalStage({
      submission,
      dosenId: dosen_id,
      isTopikDosen,
      isJudulMandiri,
      requiresKetuaCluster,
      approvalStage,
      transaction: t,
    });

    if (requiresKetuaCluster && effectiveApprovalStage === "pending_dosen_pembimbing") {
      const approvedTopikByDosen = isTopikDosen ? getTopikByReviewerDosen(submission, dosen_id) : null;
      if (isTopikDosen && !approvedTopikByDosen) {
        await t.rollback();
        return res.status(409).json({
          success: false,
          message:
            "Pengajuan ini belum berada pada tahap review Anda. Pastikan dosen pembimbing sudah approve dan mapping ketua cluster aktif sudah sesuai.",
        });
      }

      const ketuaResolution = isTopikDosen
        ? await resolveKetuaKlasterByTopikKode(approvedTopikByDosen.kode, t)
        : await resolveKetuaKlasterByDosenId(submission.prospective_supervisor_id || dosen_id, t);

      await RiwayatPersetujuan.create(
        {
          pengajuan_id: id,
          dosen_id,
          tipe_approval: "calon_pembimbing",
          status: "approved",
          keterangan:
            approvalNote ||
            (ketuaResolution.ok
              ? "Disetujui dosen pembimbing. Menunggu review ketua klaster."
              : "Disetujui dosen pembimbing. Menunggu penetapan ketua klaster oleh sekretaris prodi."),
          tanggal_keputusan: new Date(),
        },
        { transaction: t }
      );

      if (!ketuaResolution.ok) {
        if (ketuaResolution.reason !== "KETUA_NOT_SET") {
          await t.rollback();
          return res.status(409).json({
            success: false,
            message: ketuaResolution.message,
            ...(ketuaResolution.detail ? { detail: ketuaResolution.detail } : {}),
          });
        }

        await submission.update(
          {
            dosen_saat_ini: null,
            status: "menunggu_set_ketua_cluster",
            alasan_penolakan: null,
          },
          { transaction: t }
        );

        await t.commit();

        const updatedSubmission = await Pengajuan.findByPk(id, {
          include: [
            {
              model: Mahasiswa,
              as: "mahasiswa",
              attributes: ["id", "nim", "nama", "email"],
            },
            {
              model: Dosen,
              as: "dosenCurrent",
              attributes: ["id", "nik", "nama", "email"],
            },
            {
              model: Dosen,
              as: "prospectiveSupervisor",
              attributes: ["id", "nik", "nama", "email"],
            },
            {
              model: RiwayatPersetujuan,
              as: "riwayat",
              include: [
                {
                  model: Dosen,
                  as: "dosen",
                  attributes: ["id", "nik", "nama"],
                },
              ],
            },
          ],
        });

        return res.json({
          success: true,
          message:
            "Disetujui dosen pembimbing. Pengajuan menunggu penetapan ketua cluster oleh sekretaris prodi.",
          data: formatSubmissionDecisionResponse(updatedSubmission),
          notifikasi_sekprodi: {
            perlu_set_ketua_cluster: true,
            ...(ketuaResolution.detail ? ketuaResolution.detail : {}),
          },
        });
      }

      await submission.update(
        {
          dosen_saat_ini: ketuaResolution.ketuaKlaster.dosen_id,
          status: "pending",
          alasan_penolakan: null,
        },
        { transaction: t }
      );

      await t.commit();

      const updatedSubmission = await Pengajuan.findByPk(id, {
        include: [
          {
            model: Mahasiswa,
            as: "mahasiswa",
            attributes: ["id", "nim", "nama", "email"],
          },
          {
            model: Dosen,
            as: "dosenCurrent",
            attributes: ["id", "nik", "nama", "email"],
          },
          {
            model: Dosen,
            as: "prospectiveSupervisor",
            attributes: ["id", "nik", "nama", "email"],
          },
          {
            model: RiwayatPersetujuan,
            as: "riwayat",
            include: [
              {
                model: Dosen,
                as: "dosen",
                attributes: ["id", "nik", "nama"],
              },
            ],
          },
        ],
      });

      return res.json({
        success: true,
        message: `Disetujui dosen pembimbing. Pengajuan diteruskan ke ketua cluster ${ketuaResolution.klaster.kode}.`,
        data: formatSubmissionDecisionResponse(updatedSubmission),
      });
    }

    let finalTopik = null;
    let dosenPembimbingFinalId = Number(dosen_id);
    let approvalType = "calon_pembimbing";

    if (requiresKetuaCluster && effectiveApprovalStage === "pending_ketua_klaster" && isTopikDosen) {
      finalTopik = getTopikWaitingKetuaKlaster(submission);
      if (!finalTopik) {
        await t.rollback();
        return res.status(409).json({
          success: false,
          message: "Topik final yang menunggu persetujuan ketua cluster tidak ditemukan.",
        });
      }

      const ketuaResolution = await resolveKetuaKlasterByTopikKode(finalTopik.kode, t);
      if (!ketuaResolution.ok) {
        await t.rollback();
        return res.status(409).json({
          success: false,
          message: ketuaResolution.message,
          ...(ketuaResolution.detail ? { detail: ketuaResolution.detail } : {}),
        });
      }

      if (Number(ketuaResolution.ketuaKlaster.dosen_id) !== Number(dosen_id)) {
        await t.rollback();
        return res.status(403).json({
          success: false,
          message: "Anda bukan ketua cluster aktif untuk topik ini.",
        });
      }

      approvalType = "koordinator";
      dosenPembimbingFinalId = Number(finalTopik.dosen_id);
    } else if (requiresKetuaCluster && effectiveApprovalStage === "pending_ketua_klaster" && isJudulMandiri) {
      const ketuaResolution = await resolveKetuaKlasterByDosenId(submission.prospective_supervisor_id || dosen_id, t);
      if (!ketuaResolution.ok) {
        await t.rollback();
        return res.status(409).json({
          success: false,
          message: ketuaResolution.message,
          ...(ketuaResolution.detail ? { detail: ketuaResolution.detail } : {}),
        });
      }

      if (Number(ketuaResolution.ketuaKlaster.dosen_id) !== Number(dosen_id)) {
        await t.rollback();
        return res.status(403).json({
          success: false,
          message: "Anda bukan ketua cluster aktif untuk pengajuan penelitian ini.",
        });
      }

      approvalType = "koordinator";
      dosenPembimbingFinalId = Number(submission.prospective_supervisor_id || dosen_id);
    } else if (isTopikDosen) {
      finalTopik = getTopikByReviewerDosen(submission, dosen_id) || getTopikWaitingKetuaKlaster(submission);
      if (finalTopik?.dosen_id) {
        dosenPembimbingFinalId = Number(finalTopik.dosen_id);
      }
    } else if (isJudulMandiri && submission.prospective_supervisor_id) {
      dosenPembimbingFinalId = Number(submission.prospective_supervisor_id);
    }

    await submission.update(
      {
        status: "approved",
        alasan_persetujuan: approvalNote || "Pengajuan disetujui",
        alasan_penolakan: null,
        dosen_saat_ini: dosenPembimbingFinalId,
      },
      { transaction: t }
    );

    if (isTopikDosen && finalTopik?.kode) {
      await Topik.update(
        { status: "taken" },
        {
          where: { kode: finalTopik.kode },
          transaction: t,
        }
      );

      const reservedReleaseKodes = [submission.topik_1_kode, submission.topik_2_kode, submission.topik_3_kode]
        .filter(Boolean)
        .filter((kode) => kode !== finalTopik.kode);
      if (reservedReleaseKodes.length > 0) {
        await Topik.update(
          { status: "available" },
          {
            where: {
              kode: reservedReleaseKodes,
              status: "reserved",
            },
            transaction: t,
          }
        );
      }
    }

    const mahasiswa = await Mahasiswa.findByPk(submission.mahasiswa_id, { transaction: t });
    await mahasiswa.update(
      {
        dosen_pembimbing_skripsi_id: dosenPembimbingFinalId,
        status_jalur_saat_ini: submission.jenis_jalur,
        pengajuan_aktif_id: null,
      },
      { transaction: t }
    );

    const dosenPembimbingFinal = await Dosen.findByPk(dosenPembimbingFinalId, { transaction: t });
    const kuotaInfo = dosenPembimbingFinal ? await dosenPembimbingFinal.getKuotaInfo() : null;

    if (kuotaInfo?.is_penuh) {
      await Topik.update(
        { status: "unavailable" },
        {
          where: {
            dosen_id: dosenPembimbingFinalId,
            status: "available",
          },
          transaction: t,
        }
      );
    }

    await RiwayatPersetujuan.create(
      {
        pengajuan_id: id,
        dosen_id,
        tipe_approval: approvalType,
        status: "approved",
        keterangan: approvalNote || "Pengajuan disetujui",
        tanggal_keputusan: new Date(),
      },
      { transaction: t }
    );

    await t.commit();

    const updatedSubmission = await Pengajuan.findByPk(id, {
      include: [
        {
          model: Mahasiswa,
          as: "mahasiswa",
          attributes: ["id", "nim", "nama", "email"],
        },
        {
          model: Dosen,
          as: "dosenCurrent",
          attributes: ["id", "nik", "nama", "email"],
        },
        {
          model: Dosen,
          as: "prospectiveSupervisor",
          attributes: ["id", "nik", "nama", "email"],
        },
        {
          model: RiwayatPersetujuan,
          as: "riwayat",
          include: [
            {
              model: Dosen,
              as: "dosen",
              attributes: ["id", "nik", "nama"],
            },
          ],
        },
      ],
    });

    const responseData = formatSubmissionDecisionResponse(updatedSubmission);

    return res.json({
      success: true,
      message:
        isTopikDosen && effectiveApprovalStage === "pending_ketua_klaster"
          ? "Pengajuan berhasil disetujui ketua cluster."
          : "Pengajuan berhasil disetujui",
      data: responseData,
    });
  } catch (error) {
    if (!t.finished) {
      await t.rollback();
    }
    console.error("Error di approveSubmission:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// POST /api/dosen/submissions/:id/reject - Dosen menolak pengajuan
exports.rejectSubmission = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { id } = req.params;
    const dosen_id = await resolveAuthenticatedDosenId(req, t);
    if (!dosen_id) {
      await t.rollback();
      return res.status(403).json({
        success: false,
        message: "Akun ini tidak terhubung ke data dosen.",
      });
    }

    if (!req.body || Object.keys(req.body).length === 0) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Request body tidak boleh kosong. Pastikan Content-Type: application/json",
      });
    }

    const { keterangan } = req.body;

    if (!keterangan) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Keterangan penolakan harus diisi",
      });
    }

    const submission = await Pengajuan.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!submission) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Pengajuan tidak ditemukan",
      });
    }

    if (Number(submission.dosen_saat_ini) !== Number(dosen_id)) {
      await t.rollback();
      return res.status(403).json({
        success: false,
        message: "Anda tidak memiliki akses untuk menolak pengajuan ini",
      });
    }

    if (submission.status !== "pending") {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Pengajuan ini sudah diproses sebelumnya",
      });
    }

    const [mahasiswa, riwayat] = await Promise.all([
      Mahasiswa.findByPk(submission.mahasiswa_id, {
        attributes: ["id", "nim", "nama", "email"],
        transaction: t,
      }),
      RiwayatPersetujuan.findAll({
        where: { pengajuan_id: submission.id },
        attributes: ["id", "status", "tipe_approval", "tanggal_keputusan", "createdAt"],
        transaction: t,
      }),
    ]);
    submission.setDataValue("mahasiswa", mahasiswa);
    submission.setDataValue("riwayat", riwayat);

    const isTopikDosen = submission.tipe_pengajuan === "topik_dosen";
    const isJudulMandiri = submission.tipe_pengajuan === "judul_mandiri";
    const isPenelitianTrack = await isSubmissionPenelitianTrack(submission, t);
    const requiresKetuaCluster = isPenelitianTrack && (isTopikDosen || isJudulMandiri);
    const approvalStage = isTopikDosen ? getTopikDosenApprovalStage(submission) : getClusterApprovalStage(submission);
    const effectiveApprovalStage = await resolveEffectiveApprovalStage({
      submission,
      dosenId: dosen_id,
      isTopikDosen,
      isJudulMandiri,
      requiresKetuaCluster,
      approvalStage,
      transaction: t,
    });

    let nextDosen = null;
    let finalStatus = "rejected";
    let releasedKode = null;
    let rejectionApprovalType = "calon_pembimbing";

    if (requiresKetuaCluster && effectiveApprovalStage === "pending_ketua_klaster" && isTopikDosen) {
      const topikWaitingCluster = getTopikWaitingKetuaKlaster(submission);
      if (!topikWaitingCluster) {
        await t.rollback();
        return res.status(409).json({
          success: false,
          message: "Topik yang menunggu keputusan ketua cluster tidak ditemukan.",
        });
      }

      const ketuaResolution = await resolveKetuaKlasterByTopikKode(topikWaitingCluster.kode, t);
      if (!ketuaResolution.ok) {
        await t.rollback();
        return res.status(409).json({
          success: false,
          message: ketuaResolution.message,
          ...(ketuaResolution.detail ? { detail: ketuaResolution.detail } : {}),
        });
      }

      if (Number(ketuaResolution.ketuaKlaster.dosen_id) !== Number(dosen_id)) {
        await t.rollback();
        return res.status(403).json({
          success: false,
          message: "Anda bukan ketua cluster aktif untuk topik ini.",
        });
      }

      rejectionApprovalType = "koordinator";
    } else if (requiresKetuaCluster && effectiveApprovalStage === "pending_ketua_klaster" && isJudulMandiri) {
      const ketuaResolution = await resolveKetuaKlasterByDosenId(submission.prospective_supervisor_id || dosen_id, t);
      if (!ketuaResolution.ok) {
        await t.rollback();
        return res.status(409).json({
          success: false,
          message: ketuaResolution.message,
          ...(ketuaResolution.detail ? { detail: ketuaResolution.detail } : {}),
        });
      }

      if (Number(ketuaResolution.ketuaKlaster.dosen_id) !== Number(dosen_id)) {
        await t.rollback();
        return res.status(403).json({
          success: false,
          message: "Anda bukan ketua cluster aktif untuk pengajuan penelitian ini.",
        });
      }

      rejectionApprovalType = "koordinator";
    } else if (isTopikDosen) {
      // Tahap dosen pembimbing: jika ditolak, otomatis lanjut ke dosen pilihan berikutnya
      const currentTopikByDosen = getTopikByReviewerDosen(submission, dosen_id);
      if (!currentTopikByDosen) {
        await t.rollback();
        return res.status(409).json({
          success: false,
          message:
            "Pengajuan ini belum berada pada tahap review Anda. Pastikan dosen pembimbing masih sesuai urutan review aktif.",
        });
      }

      if (currentTopikByDosen.slot === 1 && submission.dosen_pilihan_2) {
        nextDosen = submission.dosen_pilihan_2;
        finalStatus = "pending";
      } else if (currentTopikByDosen.slot === 2 && submission.dosen_pilihan_3) {
        nextDosen = submission.dosen_pilihan_3;
        finalStatus = "pending";
      }

      if (finalStatus === "pending") {
        releasedKode = currentTopikByDosen.kode;
      }
    }

    await RiwayatPersetujuan.create(
      {
        pengajuan_id: id,
        dosen_id,
        tipe_approval: rejectionApprovalType,
        status: "rejected",
        keterangan,
        tanggal_keputusan: new Date(),
      },
      { transaction: t }
    );

    await submission.update(
      {
        dosen_saat_ini: finalStatus === "pending" ? nextDosen : null,
        status: finalStatus,
        alasan_penolakan: keterangan,
        alasan_persetujuan: null,
      },
      { transaction: t }
    );

    if (isTopikDosen && finalStatus === "pending" && releasedKode) {
      await Topik.update(
        { status: "available" },
        {
          where: {
            kode: releasedKode,
            status: "reserved",
          },
          transaction: t,
        }
      );
    }

    // Final reject: seluruh topik reservasi pengajuan ini dibuka kembali
    if (isTopikDosen && finalStatus === "rejected") {
      const reservedReleaseKodes = [submission.topik_1_kode, submission.topik_2_kode, submission.topik_3_kode].filter(Boolean);
      if (reservedReleaseKodes.length > 0) {
        await Topik.update(
          { status: "available" },
          {
            where: {
              kode: reservedReleaseKodes,
              status: "reserved",
            },
            transaction: t,
          }
        );
      }
    }

    await t.commit();

    const updatedSubmission = await Pengajuan.findByPk(id, {
      include: [
        {
          model: Mahasiswa,
          as: "mahasiswa",
          attributes: ["id", "nim", "nama", "email"],
        },
        {
          model: RiwayatPersetujuan,
          as: "riwayat",
          include: [
            {
              model: Dosen,
              as: "dosen",
              attributes: ["id", "nik", "nama"],
            },
          ],
          order: [["tanggal_keputusan", "DESC"]],
        },
      ],
    });

    let responseMessage = "Pengajuan ditolak";
    if (requiresKetuaCluster && effectiveApprovalStage === "pending_ketua_klaster") {
      responseMessage = "Pengajuan ditolak oleh ketua cluster";
    } else if (nextDosen) {
      responseMessage = "Pengajuan ditolak dan diteruskan ke dosen pilihan berikutnya";
    } else if (isTopikDosen) {
      responseMessage = "Pengajuan ditolak dan tidak ada dosen pilihan lagi";
    }

    res.json({
      success: true,
      message: responseMessage,
      data: formatSubmissionDecisionResponse(updatedSubmission),
    });
  } catch (error) {
    if (!t.finished) {
      await t.rollback();
    }
    console.error("Error di rejectSubmission:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// ========== IZIN LANJUT SEMESTER KE-3 ==========

// GET /api/dosen/izin-lanjut
exports.getIzinLanjutSubmissions = async (req, res) => {
  try {
    const dosen_id = await resolveAuthenticatedDosenId(req);
    if (!dosen_id) {
      return res.status(403).json({
        success: false,
        message: "Akun ini tidak terhubung ke data dosen.",
      });
    }

    const status = String(req.query?.status || "").trim().toLowerCase();
    const where = { dosen_pembimbing_skripsi_id: dosen_id };
    if (status && ["pending", "approved", "rejected"].includes(status)) {
      where.status = status;
    }

    const rows = await IzinLanjutSkripsi.findAll({
      where,
      include: [
        {
          model: Mahasiswa,
          as: "mahasiswa",
          attributes: ["id", "nim", "nama", "email", "angkatan", "status_jalur_saat_ini"],
          required: false,
        },
        {
          model: Dosen,
          as: "dosenPembimbingSkripsi",
          attributes: ["id", "nik", "nama", "email"],
          required: false,
        },
        {
          model: PeriodePenjaluran,
          as: "periode",
          attributes: ["id", "label_periode", "tahun_akademik", "semester", "is_active"],
          required: false,
        },
      ],
      order: [
        ["status", "ASC"],
        ["createdAt", "DESC"],
      ],
    });

    return res.json({
      success: true,
      data: rows.map((item) => formatIzinLanjutItem(item)),
      total: rows.length,
    });
  } catch (error) {
    console.error("Error di getIzinLanjutSubmissions:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// GET /api/dosen/izin-lanjut/:id
exports.getIzinLanjutDetail = async (req, res) => {
  try {
    const dosen_id = await resolveAuthenticatedDosenId(req);
    if (!dosen_id) {
      return res.status(403).json({
        success: false,
        message: "Akun ini tidak terhubung ke data dosen.",
      });
    }

    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "ID izin lanjut tidak valid.",
      });
    }

    const item = await IzinLanjutSkripsi.findByPk(id, {
      include: [
        {
          model: Mahasiswa,
          as: "mahasiswa",
          attributes: ["id", "nim", "nama", "email", "angkatan", "status_jalur_saat_ini"],
          required: false,
        },
        {
          model: Dosen,
          as: "dosenPembimbingSkripsi",
          attributes: ["id", "nik", "nama", "email"],
          required: false,
        },
        {
          model: PeriodePenjaluran,
          as: "periode",
          attributes: ["id", "label_periode", "tahun_akademik", "semester", "is_active"],
          required: false,
        },
      ],
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Data izin lanjut tidak ditemukan.",
      });
    }

    if (item.dosen_pembimbing_skripsi_id !== dosen_id) {
      return res.status(403).json({
        success: false,
        message: "Anda tidak memiliki akses ke data izin lanjut ini.",
      });
    }

    return res.json({
      success: true,
      data: formatIzinLanjutItem(item),
    });
  } catch (error) {
    console.error("Error di getIzinLanjutDetail:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// POST /api/dosen/izin-lanjut/:id/approve
exports.approveIzinLanjut = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const dosen_id = await resolveAuthenticatedDosenId(req, t);
    if (!dosen_id) {
      await t.rollback();
      return res.status(403).json({
        success: false,
        message: "Akun ini tidak terhubung ke data dosen.",
      });
    }

    const id = Number(req.params.id);
    if (!id) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "ID izin lanjut tidak valid.",
      });
    }

    const keterangan_dosen = String(req.body?.keterangan_dosen || "").trim();

    const item = await IzinLanjutSkripsi.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!item) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Data izin lanjut tidak ditemukan.",
      });
    }

    if (item.dosen_pembimbing_skripsi_id !== dosen_id) {
      await t.rollback();
      return res.status(403).json({
        success: false,
        message: "Anda tidak memiliki akses untuk menyetujui izin lanjut ini.",
      });
    }

    if (item.status !== "pending") {
      await t.rollback();
      return res.status(409).json({
        success: false,
        message: `Izin lanjut ini sudah diproses dengan status: ${item.status}.`,
      });
    }

    const mahasiswa = await Mahasiswa.findByPk(item.mahasiswa_id, {
      attributes: ["id", "status_jalur_saat_ini"],
      transaction: t,
    });
    item.setDataValue("mahasiswa", mahasiswa);

    await item.update(
      {
        status: "approved",
        keterangan_dosen: keterangan_dosen || "Disetujui dosen pembimbing skripsi.",
        tanggal_keputusan: new Date(),
      },
      { transaction: t }
    );

    if (item.mahasiswa && item.mahasiswa.status_jalur_saat_ini === "ulang") {
      await item.mahasiswa.update(
        {
          status_jalur_saat_ini: "ekstensi",
        },
        { transaction: t }
      );
    }

    await t.commit();

    const updated = await IzinLanjutSkripsi.findByPk(id, {
      include: [
        {
          model: Mahasiswa,
          as: "mahasiswa",
          attributes: ["id", "nim", "nama", "email", "angkatan", "status_jalur_saat_ini"],
          required: false,
        },
        {
          model: Dosen,
          as: "dosenPembimbingSkripsi",
          attributes: ["id", "nik", "nama", "email"],
          required: false,
        },
        {
          model: PeriodePenjaluran,
          as: "periode",
          attributes: ["id", "label_periode", "tahun_akademik", "semester", "is_active"],
          required: false,
        },
      ],
    });

    return res.json({
      success: true,
      message: "Izin melanjutkan skripsi berhasil disetujui.",
      data: formatIzinLanjutItem(updated),
    });
  } catch (error) {
    if (!t.finished) await t.rollback();
    console.error("Error di approveIzinLanjut:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// POST /api/dosen/izin-lanjut/:id/reject
exports.rejectIzinLanjut = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const dosen_id = await resolveAuthenticatedDosenId(req, t);
    if (!dosen_id) {
      await t.rollback();
      return res.status(403).json({
        success: false,
        message: "Akun ini tidak terhubung ke data dosen.",
      });
    }

    const id = Number(req.params.id);
    if (!id) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "ID izin lanjut tidak valid.",
      });
    }

    const keterangan_dosen = String(req.body?.keterangan_dosen || "").trim();
    if (!keterangan_dosen) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Alasan penolakan wajib diisi.",
      });
    }

    const item = await IzinLanjutSkripsi.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!item) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Data izin lanjut tidak ditemukan.",
      });
    }

    if (item.dosen_pembimbing_skripsi_id !== dosen_id) {
      await t.rollback();
      return res.status(403).json({
        success: false,
        message: "Anda tidak memiliki akses untuk menolak izin lanjut ini.",
      });
    }

    if (item.status !== "pending") {
      await t.rollback();
      return res.status(409).json({
        success: false,
        message: `Izin lanjut ini sudah diproses dengan status: ${item.status}.`,
      });
    }

    const mahasiswa = await Mahasiswa.findByPk(item.mahasiswa_id, {
      attributes: ["id", "status_jalur_saat_ini", "pengajuan_aktif_id"],
      transaction: t,
    });
    item.setDataValue("mahasiswa", mahasiswa);

    await item.update(
      {
        status: "rejected",
        keterangan_dosen,
        tanggal_keputusan: new Date(),
      },
      { transaction: t }
    );

    if (item.mahasiswa) {
      await item.mahasiswa.update(
        {
          status_jalur_saat_ini: "ulang",
          pengajuan_aktif_id: null,
        },
        { transaction: t }
      );
    }

    await t.commit();

    const updated = await IzinLanjutSkripsi.findByPk(id, {
      include: [
        {
          model: Mahasiswa,
          as: "mahasiswa",
          attributes: ["id", "nim", "nama", "email", "angkatan", "status_jalur_saat_ini"],
          required: false,
        },
        {
          model: Dosen,
          as: "dosenPembimbingSkripsi",
          attributes: ["id", "nik", "nama", "email"],
          required: false,
        },
        {
          model: PeriodePenjaluran,
          as: "periode",
          attributes: ["id", "label_periode", "tahun_akademik", "semester", "is_active"],
          required: false,
        },
      ],
    });

    return res.json({
      success: true,
      message: "Izin melanjutkan skripsi ditolak. Mahasiswa wajib melakukan penjaluran ulang.",
      data: formatIzinLanjutItem(updated),
    });
  } catch (error) {
    if (!t.finished) await t.rollback();
    console.error("Error di rejectIzinLanjut:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// ========== PAMIT MAHASISWA (DOSEN PEMBIMBING SKRIPSI - TAHAP 1) ==========

// GET /api/dosen/pamit-mahasiswa - Dosen pembimbing melihat pamit mahasiswa yang dibimbingnya (READ ONLY)
exports.getPamitMahasiswa = async (req, res) => {
  try {
    const dosen_id = await resolveAuthenticatedDosenId(req);
    if (!dosen_id) {
      return res.status(403).json({
        success: false,
        message: "Akun ini tidak terhubung ke data dosen.",
      });
    }
    const { status } = req.query;

    // Cari mahasiswa yang dosen pembimbing skripsinya adalah dosen ini
    const mahasiswas = await Mahasiswa.findAll({
      where: {
        dosen_pembimbing_skripsi_id: dosen_id,
      },
      attributes: ["id"],
    });

    const mahasiswaIds = mahasiswas.map((m) => m.id);

    if (mahasiswaIds.length === 0) {
      return res.json({
        success: true,
        data: [],
        total: 0,
        message: "Anda belum memiliki mahasiswa bimbingan skripsi",
      });
    }

    const where = {
      mahasiswa_id: mahasiswaIds,
    };

    if (status) {
      where.status_dospem = status;
    }

    const pamits = await PamitUlang.findAll({
      where,
      include: [
        {
          model: Mahasiswa,
          as: "mahasiswa",
          attributes: ["id", "nim", "nama", "email", "angkatan"],
          include: [
            {
              model: Dosen,
              as: "dosenPembimbingAkademik",
              attributes: ["id", "nik", "nama"],
            },
          ],
        },
        {
          model: Pengajuan,
          as: "pengajuanSebelumnya",
          attributes: ["id", "topik_1_judul", "judul_mandiri", "tipe_pengajuan", "status"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    res.json({
      success: true,
      data: pamits,
      total: pamits.length,
      message: "Ini adalah daftar pamit mahasiswa bimbingan Anda untuk review dosen pembimbing skripsi.",
    });
  } catch (error) {
    console.error("Error di getPamitMahasiswa:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// GET /api/dosen/pamit-mahasiswa/:id - Dosen pembimbing melihat detail pamit (READ ONLY)
exports.getPamitMahasiswaDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const dosen_id = await resolveAuthenticatedDosenId(req);
    if (!dosen_id) {
      return res.status(403).json({
        success: false,
        message: "Akun ini tidak terhubung ke data dosen.",
      });
    }

    const pamit = await PamitUlang.findByPk(id, {
      include: [
        {
          model: Mahasiswa,
          as: "mahasiswa",
          attributes: ["id", "nim", "nama", "email", "angkatan", "dosen_pembimbing_skripsi_id", "dosen_pembimbing_akademik_id"],
          include: [
            {
              model: Dosen,
              as: "dosenPembimbingAkademik",
              attributes: ["id", "nik", "nama", "email"],
            },
          ],
        },
        {
          model: Pengajuan,
          as: "pengajuanSebelumnya",
          attributes: ["id", "topik_1_judul", "judul_mandiri", "tipe_pengajuan", "status", "createdAt"],
        },
      ],
    });

    if (!pamit) {
      return res.status(404).json({
        success: false,
        message: "Data pamit tidak ditemukan",
      });
    }

    // Validasi: Pastikan dosen ini adalah dosen pembimbing skripsi mahasiswa tersebut
    if (pamit.mahasiswa.dosen_pembimbing_skripsi_id !== dosen_id) {
      return res.status(403).json({
        success: false,
        message: "Anda tidak memiliki akses untuk melihat pamit ini",
      });
    }

    res.json({
      success: true,
      data: pamit,
      message: "Detail pamit mahasiswa untuk review dosen pembimbing skripsi.",
    });
  } catch (error) {
    console.error("Error di getPamitMahasiswaDetail:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// POST /api/dosen/pamit-mahasiswa/:id/approve - Dosen pembimbing skripsi menyetujui pamit (tahap 1)
exports.approvePamitMahasiswa = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { id } = req.params;
    const dosen_id = await resolveAuthenticatedDosenId(req, t);
    if (!dosen_id) {
      await t.rollback();
      return res.status(403).json({
        success: false,
        message: "Akun ini tidak terhubung ke data dosen.",
      });
    }
    const { keterangan_dospem } = req.body || {};

    const pamit = await PamitUlang.findByPk(id, {
      include: [
        {
          model: Mahasiswa,
          as: "mahasiswa",
          attributes: ["id", "nim", "nama", "dosen_pembimbing_skripsi_id"],
        },
      ],
      transaction: t,
    });

    if (!pamit) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Data pamit tidak ditemukan",
      });
    }

    if (pamit.mahasiswa.dosen_pembimbing_skripsi_id !== dosen_id) {
      await t.rollback();
      return res.status(403).json({
        success: false,
        message: "Anda tidak memiliki akses untuk menyetujui pamit ini",
      });
    }

    if (pamit.status_dospem !== "pending") {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: `Pamit ini sudah diproses oleh dosen pembimbing skripsi dengan status: ${pamit.status_dospem}`,
      });
    }

    await pamit.update(
      {
        status_dospem: "approved",
        keterangan_dospem: keterangan_dospem || "Disetujui oleh dosen pembimbing skripsi",
        tanggal_approval_dospem: new Date(),
        // Backward compatibility: status DPA mengikuti hasil final dospem.
        status_dpa: "approved",
        keterangan_dpa: "Tidak diperlukan (otomatis mengikuti approval dosen pembimbing skripsi)",
        tanggal_approval_dpa: new Date(),
      },
      { transaction: t }
    );

    // Release topik sebelumnya jika jalur lama adalah topik dosen.
    const previousSubmission = await Pengajuan.findByPk(pamit.pengajuan_sebelumnya_id, {
      include: [
        {
          model: RiwayatPersetujuan,
          as: "riwayat",
          attributes: ["status"],
        },
      ],
      transaction: t,
    });

    if (previousSubmission && previousSubmission.tipe_pengajuan === "topik_dosen") {
      const topikList = buildTopikList(previousSubmission);
      const approvedTopik = getApprovedTopik(previousSubmission, topikList);

      if (approvedTopik?.kode) {
        await Topik.update(
          { status: "available" },
          {
            where: { kode: approvedTopik.kode },
            transaction: t,
          }
        );
      }
    }

    // Saat dospem menyetujui pamit, mahasiswa resmi melepas dospem skripsi saat ini.
    const mahasiswa = await Mahasiswa.findByPk(pamit.mahasiswa_id, { transaction: t });
    const previous_dosen_id = mahasiswa.dosen_pembimbing_skripsi_id;

    await mahasiswa.update(
      {
        dosen_pembimbing_skripsi_id: null,
        status_jalur_saat_ini: "sedang_mengajukan",
        pengajuan_aktif_id: null,
      },
      { transaction: t }
    );

    // Jika kuota dosen tidak penuh lagi, aktifkan kembali topik yang sebelumnya unavailable.
    if (previous_dosen_id) {
      const previousDosen = await Dosen.findByPk(previous_dosen_id, { transaction: t });

      if (previousDosen) {
        const kuotaInfo = await previousDosen.getKuotaInfo();
        if (!kuotaInfo.is_penuh) {
          await Topik.update(
            { status: "available" },
            {
              where: {
                dosen_id: previous_dosen_id,
                status: "unavailable",
              },
              transaction: t,
            }
          );
        }
      }
    }

    await t.commit();

    const updatedPamit = await PamitUlang.findByPk(id, {
      include: [
        {
          model: Mahasiswa,
          as: "mahasiswa",
          attributes: ["id", "nim", "nama", "email"],
        },
        {
          model: Pengajuan,
          as: "pengajuanSebelumnya",
          attributes: ["id", "topik_1_judul", "judul_mandiri"],
        },
      ],
    });

    res.json({
      success: true,
      message: "Pamit disetujui dosen pembimbing skripsi. Mahasiswa dapat melanjutkan pengajuan ulang.",
      data: updatedPamit,
    });
  } catch (error) {
    if (!t.finished) await t.rollback();
    console.error("Error di approvePamitMahasiswa:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// POST /api/dosen/pamit-mahasiswa/:id/reject - Dosen pembimbing skripsi menolak pamit (tahap 1)
exports.rejectPamitMahasiswa = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { id } = req.params;
    const dosen_id = await resolveAuthenticatedDosenId(req, t);
    if (!dosen_id) {
      await t.rollback();
      return res.status(403).json({
        success: false,
        message: "Akun ini tidak terhubung ke data dosen.",
      });
    }
    const { keterangan_dospem } = req.body || {};

    if (!keterangan_dospem) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Keterangan penolakan harus diisi",
      });
    }

    const pamit = await PamitUlang.findByPk(id, {
      include: [
        {
          model: Mahasiswa,
          as: "mahasiswa",
          attributes: ["id", "nim", "nama", "dosen_pembimbing_skripsi_id"],
        },
      ],
      transaction: t,
    });

    if (!pamit) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Data pamit tidak ditemukan",
      });
    }

    if (pamit.mahasiswa.dosen_pembimbing_skripsi_id !== dosen_id) {
      await t.rollback();
      return res.status(403).json({
        success: false,
        message: "Anda tidak memiliki akses untuk menolak pamit ini",
      });
    }

    if (pamit.status_dospem !== "pending") {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: `Pamit ini sudah diproses oleh dosen pembimbing skripsi dengan status: ${pamit.status_dospem}`,
      });
    }

    await pamit.update(
      {
        status_dospem: "rejected",
        keterangan_dospem,
        tanggal_approval_dospem: new Date(),
        // Backward compatibility: status DPA mengikuti hasil final dospem.
        status_dpa: "rejected",
        keterangan_dpa: keterangan_dospem,
        tanggal_approval_dpa: new Date(),
      },
      { transaction: t }
    );

    await t.commit();

    const updatedPamit = await PamitUlang.findByPk(id, {
      include: [
        {
          model: Mahasiswa,
          as: "mahasiswa",
          attributes: ["id", "nim", "nama", "email"],
        },
        {
          model: Pengajuan,
          as: "pengajuanSebelumnya",
          attributes: ["id", "topik_1_judul", "judul_mandiri"],
        },
      ],
    });

    res.json({
      success: true,
      message: "Pamit ditolak oleh dosen pembimbing skripsi.",
      data: updatedPamit,
    });
  } catch (error) {
    if (!t.finished) await t.rollback();
    console.error("Error di rejectPamitMahasiswa:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// ========== PAMIT ULANG (DPA - CAN APPROVE/REJECT) ==========

// GET /api/dosen/pamit-dpa - Dosen (sebagai DPA) melihat pamit mahasiswa bimbingan akademiknya
exports.getPamitDPA = async (req, res) => {
  try {
    const dosen_id = await resolveAuthenticatedDosenId(req);
    if (!dosen_id) {
      return res.status(403).json({
        success: false,
        message: "Akun ini tidak terhubung ke data dosen.",
      });
    }
    const { status } = req.query;

    // Cari mahasiswa yang DPA-nya adalah dosen ini
    const mahasiswas = await Mahasiswa.findAll({
      where: {
        dosen_pembimbing_akademik_id: dosen_id,
      },
      attributes: ["id"],
    });

    const mahasiswaIds = mahasiswas.map((m) => m.id);

    if (mahasiswaIds.length === 0) {
      return res.json({
        success: true,
        data: [],
        total: 0,
        message: "Anda belum memiliki mahasiswa bimbingan akademik",
      });
    }

    const where = {
      mahasiswa_id: mahasiswaIds,
      status_dospem: "approved",
    };

    if (status) {
      where.status_dpa = status;
    }

    const pamits = await PamitUlang.findAll({
      where,
      include: [
        {
          model: Mahasiswa,
          as: "mahasiswa",
          attributes: ["id", "nim", "nama", "email", "angkatan"],
          include: [
            {
              model: Dosen,
              as: "dosenPembimbingSkripsi",
              attributes: ["id", "nik", "nama"],
            },
          ],
        },
        {
          model: Pengajuan,
          as: "pengajuanSebelumnya",
          attributes: ["id", "topik_1_judul", "judul_mandiri", "tipe_pengajuan", "status"],
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
    console.error("Error di getPamitDPA:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// GET /api/dosen/pamit-dpa/:id - Dosen (sebagai DPA) melihat detail pamit
exports.getPamitDPADetail = async (req, res) => {
  try {
    const { id } = req.params;
    const dosen_id = await resolveAuthenticatedDosenId(req);
    if (!dosen_id) {
      return res.status(403).json({
        success: false,
        message: "Akun ini tidak terhubung ke data dosen.",
      });
    }

    const pamit = await PamitUlang.findByPk(id, {
      include: [
        {
          model: Mahasiswa,
          as: "mahasiswa",
          attributes: ["id", "nim", "nama", "email", "angkatan", "dosen_pembimbing_skripsi_id", "dosen_pembimbing_akademik_id"],
          include: [
            {
              model: Dosen,
              as: "dosenPembimbingSkripsi",
              attributes: ["id", "nik", "nama", "email"],
            },
          ],
        },
        {
          model: Pengajuan,
          as: "pengajuanSebelumnya",
          attributes: ["id", "topik_1_judul", "judul_mandiri", "tipe_pengajuan", "status", "createdAt"],
        },
      ],
    });

    if (!pamit) {
      return res.status(404).json({
        success: false,
        message: "Data pamit tidak ditemukan",
      });
    }

    // Validasi: Pastikan dosen ini adalah DPA mahasiswa tersebut
    if (pamit.mahasiswa.dosen_pembimbing_akademik_id !== dosen_id) {
      return res.status(403).json({
        success: false,
        message: "Anda tidak memiliki akses untuk melihat pamit ini",
      });
    }

    res.json({
      success: true,
      data: pamit,
    });
  } catch (error) {
    console.error("Error di getPamitDPADetail:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// POST /api/dosen/pamit-dpa/:id/approve - Dosen (sebagai DPA) menyetujui pamit
exports.approvePamitDPA = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { id } = req.params;
    const dosen_id = await resolveAuthenticatedDosenId(req, t);
    if (!dosen_id) {
      await t.rollback();
      return res.status(403).json({
        success: false,
        message: "Akun ini tidak terhubung ke data dosen.",
      });
    }
    const { keterangan_dpa } = req.body;

    const pamit = await PamitUlang.findByPk(id, {
      include: [
        {
          model: Mahasiswa,
          as: "mahasiswa",
          attributes: ["id", "nim", "nama", "dosen_pembimbing_akademik_id"],
        },
      ],
      transaction: t,
    });

    if (!pamit) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Data pamit tidak ditemukan",
      });
    }

    // Validasi: Pastikan dosen ini adalah DPA mahasiswa tersebut
    if (pamit.mahasiswa.dosen_pembimbing_akademik_id !== dosen_id) {
      await t.rollback();
      return res.status(403).json({
        success: false,
        message: "Anda tidak memiliki akses untuk menyetujui pamit ini",
      });
    }

    // Validasi: Pamit harus dalam status pending
    if (pamit.status_dospem !== "approved") {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: `Pamit belum disetujui dosen pembimbing skripsi. Status saat ini: ${pamit.status_dospem}`,
      });
    }

    // Validasi: Pamit harus dalam status pending
    if (pamit.status_dpa !== "pending") {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: `Pamit ini sudah diproses dengan status: ${pamit.status_dpa}`,
      });
    }

    // Update pamit
    await pamit.update(
      {
        status_dpa: "approved",
        keterangan_dpa: keterangan_dpa || "Disetujui oleh DPA",
        tanggal_approval_dpa: new Date(),
      },
      { transaction: t }
    );

    // ⭐ UPDATE MAHASISWA - CLEAR DOSEN PEMBIMBING SKRIPSI ⭐
    const mahasiswa = await Mahasiswa.findByPk(pamit.mahasiswa_id, { transaction: t });

    // Simpan dosen_id sebelum di-clear untuk re-enable topiknya
    const previous_dosen_id = mahasiswa.dosen_pembimbing_skripsi_id;

    await mahasiswa.update(
      {
        dosen_pembimbing_skripsi_id: null, // Clear dosen pembimbing skripsi
        status_jalur_saat_ini: "sedang_mengajukan", // Siap mengajukan topik baru
        pengajuan_aktif_id: null, // Clear pengajuan aktif
      },
      { transaction: t }
    );

    // ⭐ RE-ENABLE TOPIK DOSEN (KUOTA BERKURANG) ⭐
    if (previous_dosen_id) {
      const previousDosen = await Dosen.findByPk(previous_dosen_id, { transaction: t });

      if (previousDosen) {
        const kuotaInfo = await previousDosen.getKuotaInfo();

        // Jika kuota tidak lagi penuh, re-enable topik yang unavailable
        if (!kuotaInfo.is_penuh) {
          await Topik.update(
            { status: "available" },
            {
              where: {
                dosen_id: previous_dosen_id,
                status: "unavailable", // Hanya update yang di-disable karena kuota
              },
              transaction: t,
            }
          );

          console.log(`✅ Kuota dosen ${previousDosen.nama} tersedia lagi (${kuotaInfo.terpakai}/${kuotaInfo.total}). Topik di-enable.`);
        }
      }
    }

    await t.commit();

    // Load data lengkap
    const updatedPamit = await PamitUlang.findByPk(id, {
      include: [
        {
          model: Mahasiswa,
          as: "mahasiswa",
          attributes: ["id", "nim", "nama", "email"],
        },
        {
          model: Pengajuan,
          as: "pengajuanSebelumnya",
          attributes: ["id", "topik_1_judul", "judul_mandiri"],
        },
      ],
    });

    res.json({
      success: true,
      message: "Pamit berhasil disetujui. Mahasiswa dapat melanjutkan dengan memilih topik baru.",
      data: updatedPamit,
    });
  } catch (error) {
    if (!t.finished) await t.rollback();
    console.error("Error di approvePamitDPA:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// POST /api/dosen/pamit-dpa/:id/reject - Dosen (sebagai DPA) menolak pamit
exports.rejectPamitDPA = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { id } = req.params;
    const dosen_id = await resolveAuthenticatedDosenId(req, t);
    if (!dosen_id) {
      await t.rollback();
      return res.status(403).json({
        success: false,
        message: "Akun ini tidak terhubung ke data dosen.",
      });
    }
    const { keterangan_dpa } = req.body;

    if (!keterangan_dpa) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Keterangan penolakan harus diisi",
      });
    }

    const pamit = await PamitUlang.findByPk(id, {
      include: [
        {
          model: Mahasiswa,
          as: "mahasiswa",
          attributes: ["id", "nim", "nama", "dosen_pembimbing_akademik_id"],
        },
      ],
      transaction: t,
    });

    if (!pamit) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Data pamit tidak ditemukan",
      });
    }

    // Validasi: Pastikan dosen ini adalah DPA mahasiswa tersebut
    if (pamit.mahasiswa.dosen_pembimbing_akademik_id !== dosen_id) {
      await t.rollback();
      return res.status(403).json({
        success: false,
        message: "Anda tidak memiliki akses untuk menolak pamit ini",
      });
    }

    // Validasi: Pamit harus disetujui dosen pembimbing skripsi terlebih dahulu
    if (pamit.status_dospem !== "approved") {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: `Pamit belum disetujui dosen pembimbing skripsi. Status saat ini: ${pamit.status_dospem}`,
      });
    }

    // Validasi: Pamit harus dalam status pending
    if (pamit.status_dpa !== "pending") {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: `Pamit ini sudah diproses dengan status: ${pamit.status_dpa}`,
      });
    }

    // Update pamit
    await pamit.update(
      {
        status_dpa: "rejected",
        keterangan_dpa,
        tanggal_approval_dpa: new Date(),
      },
      { transaction: t }
    );

    await t.commit();

    // Load data lengkap
    const updatedPamit = await PamitUlang.findByPk(id, {
      include: [
        {
          model: Mahasiswa,
          as: "mahasiswa",
          attributes: ["id", "nim", "nama", "email"],
        },
        {
          model: Pengajuan,
          as: "pengajuanSebelumnya",
          attributes: ["id", "topik_1_judul", "judul_mandiri"],
        },
      ],
    });

    res.json({
      success: true,
      message: "Pamit ditolak",
      data: updatedPamit,
    });
  } catch (error) {
    if (!t.finished) await t.rollback();
    console.error("Error di rejectPamitDPA:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// ========== KUOTA MANAGEMENT ENDPOINTS ==========

// GET /api/dosen/kuota - Dosen cek kuota sendiri
exports.getKuotaSendiri = async (req, res) => {
  try {
    const dosen_id = await resolveAuthenticatedDosenId(req);
    if (!dosen_id) {
      return res.status(403).json({
        success: false,
        message: "Akun ini tidak terhubung ke data dosen.",
      });
    }

    const dosen = await Dosen.findByPk(dosen_id, {
      attributes: ["id", "nik", "nama", "email", "kuota_bimbingan"],
      include: [
        {
          model: Klaster,
          as: "klasters",
          attributes: ["id", "kode", "nama"],
          through: { attributes: [] },
          required: false,
        },
      ],
    });

    if (!dosen) {
      return res.status(404).json({
        success: false,
        message: "Data dosen tidak ditemukan",
      });
    }

    const kuotaInfo = await dosen.getKuotaInfo();

    // Dapatkan list mahasiswa bimbingan
    const mahasiswas = await Mahasiswa.findAll({
      where: { dosen_pembimbing_skripsi_id: dosen_id },
      attributes: ["id", "nim", "nama", "email", "angkatan", "status_jalur_saat_ini"],
      order: [["nim", "ASC"]],
    });

    res.json({
      success: true,
      data: {
        dosen: {
          id: dosen.id,
          nama: dosen.nama,
          nik: dosen.nik,
          klasters: Array.isArray(dosen.klasters)
            ? dosen.klasters.map((item) => ({
                id: item.id,
                kode: item.kode,
                nama: item.nama,
              }))
            : [],
        },
        kuota: kuotaInfo,
        mahasiswa_bimbingan: mahasiswas,
      },
    });
  } catch (error) {
    console.error("Error di getKuotaSendiri:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// GET /api/dosen/mahasiswa-master - Read-only master data mahasiswa untuk dosen
exports.getMahasiswaMasterReadOnly = async (req, res) => {
  try {
    const data = await fetchMahasiswaMasterData({
      status_jalur: req.query.status_jalur,
      angkatan: req.query.angkatan,
    });

    return res.json({
      success: true,
      data,
      total: data.length,
      role_owner: "sekretaris_prodi",
      can_edit: false,
    });
  } catch (error) {
    console.error("Error di getMahasiswaMasterReadOnly (dosen):", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};


