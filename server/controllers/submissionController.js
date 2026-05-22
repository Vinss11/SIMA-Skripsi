const { Op } = require("sequelize");
const { Pengajuan, Mahasiswa, Dosen, Topik, RiwayatPersetujuan, PamitUlang, SekretarisProdi } = require("../models");

async function resolveSekretarisAsDosenId(req, sekretarisId) {
  const sekretaris = await SekretarisProdi.findByPk(sekretarisId, {
    attributes: ["nik", "email", "jabatan"],
  });

  if (!sekretaris) return null;

  const where = [];
  if (sekretaris.nik) {
    where.push({ nik: String(sekretaris.nik).trim() });
  }
  if (sekretaris.email) {
    where.push({ email: String(sekretaris.email).trim().toLowerCase() });
  }

  const tokenUsername = String(req.user?.username || "").trim();
  if (tokenUsername) {
    where.push({ nik: tokenUsername });
    where.push({ email: tokenUsername.toLowerCase() });
  }

  if (where.length === 0) return null;

  let dosen = await Dosen.findOne({
    where: { [Op.or]: where },
    attributes: ["id"],
  });

  if (!dosen && sekretaris.jabatan) {
    dosen = await Dosen.findOne({
      where: { jabatan_struktural: sekretaris.jabatan },
      attributes: ["id"],
    });
  }

  return dosen?.id ? Number(dosen.id) : null;
}

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

function getTopikDosenApprovalStage(submission) {
  if (!submission || submission.tipe_pengajuan !== "topik_dosen") {
    return "non_topik_dosen_or_final";
  }

  if (submission.status === "menunggu_set_ketua_cluster") {
    return "menunggu_set_ketua_cluster";
  }

  if (submission.status !== "pending") {
    return "non_topik_dosen_or_final";
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

// GET /api/submissions - Mahasiswa melihat pengajuan mereka
exports.getMySubmissions = async (req, res) => {
  try {
    const mahasiswa_id = req.user.id;
    const { status, tipe_pengajuan } = req.query; // ✅ Tambahkan tipe_pengajuan

    const where = { mahasiswa_id };

    if (status) {
      where.status = status;
    }

    // ✅ TAMBAHKAN FILTER TIPE PENGAJUAN
    if (tipe_pengajuan) {
      where.tipe_pengajuan = tipe_pengajuan;
    }

    const submissions = await Pengajuan.findAll({
      where,
      include: [
        {
          model: Dosen,
          as: "dosenCurrent",
          attributes: ["id", "nik", "nama"],
        },
        {
          model: Dosen,
          as: "prospectiveSupervisor",
          attributes: ["id", "nik", "nama"],
        },
        {
          model: RiwayatPersetujuan,
          as: "riwayat",
          attributes: ["status"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    const topikKodes = [
      ...new Set(
        submissions
          .flatMap((submission) => [submission.topik_1_kode, submission.topik_2_kode, submission.topik_3_kode])
          .filter(Boolean)
      ),
    ];

    const topikByKode = {};
    if (topikKodes.length > 0) {
      const topikRows = await Topik.findAll({
        where: { kode: { [Op.in]: topikKodes } },
        attributes: ["kode", "judul"],
      });
      topikRows.forEach((item) => {
        topikByKode[item.kode] = item.judul;
      });
    }

    const compactData = submissions.map((submission) => {
      const approvalStage = getTopikDosenApprovalStage(submission);
      const base = {
        id: submission.id,
        jenis_jalur: submission.jenis_jalur,
        tipe_pengajuan: submission.tipe_pengajuan,
        status: submission.status,
        tahap_approval: approvalStage,
        createdAt: submission.createdAt,
        updatedAt: submission.updatedAt,
      };

      if (submission.tipe_pengajuan === "topik_dosen") {
        const topikList = buildTopikList(submission).map((item) => ({
          ...item,
          judul: item.judul || topikByKode[item.kode] || null,
        }));
        const approvedTopik = getApprovedTopik(submission, topikList);

        base.topik_dipilih = topikList.map(({ kode }) => kode);
        base.topik_dipilih_detail = topikList.map(({ slot, kode, judul }) => ({
          slot,
          kode,
          judul,
        }));
        base.topik_disetujui = approvedTopik
          ? {
              slot: approvedTopik.slot,
              kode: approvedTopik.kode,
              judul: approvedTopik.judul,
            }
          : null;
        base.dosen_pembimbing = submission.dosenCurrent ? submission.dosenCurrent.nama : null;
      } else {
        base.judul_mandiri = {
          judul: submission.judul_mandiri,
          prospective_supervisor: submission.prospectiveSupervisor
            ? {
                id: submission.prospectiveSupervisor.id,
                nik: submission.prospectiveSupervisor.nik,
                nama: submission.prospectiveSupervisor.nama,
              }
            : null,
        };
      }

      return base;
    });

    res.json({
      success: true,
      data: compactData,
      total: compactData.length,
    });
  } catch (error) {
    console.error("Error di getMySubmissions:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

// GET /api/submissions/:id - Detail pengajuan
exports.getSubmissionById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = Number(req.user.id);
    const userRole = typeof req.user.role === "string" ? req.user.role.trim().toLowerCase() : "";
    let accessorDosenId = null;

    if (!Number.isInteger(Number(id)) || Number(id) <= 0) {
      return res.status(400).json({
        success: false,
        message: "ID pengajuan tidak valid",
      });
    }

    if (!Number.isInteger(userId) || !["mahasiswa", "dosen", "sekretaris_prodi"].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: "Anda tidak memiliki akses ke endpoint ini",
      });
    }

    if (userRole === "dosen") {
      accessorDosenId = userId;
    } else if (userRole === "sekretaris_prodi") {
      accessorDosenId = await resolveSekretarisAsDosenId(req, userId);
      if (!accessorDosenId) {
        return res.status(403).json({
          success: false,
          message: "Akun sekretaris prodi tidak terhubung ke data dosen",
        });
      }
    }

    const submission = await Pengajuan.findByPk(Number(id), {
      include: [
        {
          model: Mahasiswa,
          as: "mahasiswa",
          attributes: ["id", "nim", "nama", "email", "angkatan", "status_jalur_saat_ini"],
          include: [
            {
              model: Dosen,
              as: "dosenPembimbingAkademik",
              attributes: ["id", "nik", "nama"],
            },
          ],
        },
        {
          model: Dosen,
          as: "dosen1",
          attributes: ["id", "nik", "nama", "email"],
        },
        {
          model: Dosen,
          as: "dosen2",
          attributes: ["id", "nik", "nama", "email"],
        },
        {
          model: Dosen,
          as: "dosen3",
          attributes: ["id", "nik", "nama", "email"],
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
          model: Pengajuan,
          as: "pengajuanSebelumnya",
          attributes: ["id", "topik_1_judul", "judul_mandiri", "status", "createdAt"],
        },
        {
          model: PamitUlang,
          as: "pamitUlang",
          include: [
            {
              model: Pengajuan,
              as: "pengajuanSebelumnya",
              attributes: ["id", "topik_1_judul", "judul_mandiri"],
              include: [
                {
                  model: Dosen,
                  as: "dosenCurrent",
                  attributes: ["id", "nik", "nama"],
                },
              ],
            },
          ],
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
          order: [["createdAt", "ASC"]],
        },
      ],
    });

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Pengajuan tidak ditemukan",
      });
    }

    // Authorization check
    if (userRole === "mahasiswa" && Number(submission.mahasiswa_id) !== userId) {
      return res.status(403).json({
        success: false,
        message: "Anda tidak memiliki akses ke pengajuan ini",
      });
    }

    if (userRole === "dosen" || userRole === "sekretaris_prodi") {
      const dosenPilihan = [
        submission.dosen_saat_ini,
        submission.dosen_pilihan_1,
        submission.dosen_pilihan_2,
        submission.dosen_pilihan_3,
        submission.prospective_supervisor_id,
        submission.mahasiswa?.dosen_pembimbing_akademik_id,
      ]
        .filter(Boolean)
        .map((item) => Number(item));

      if (!dosenPilihan.includes(accessorDosenId)) {
        return res.status(403).json({
          success: false,
          message: "Anda tidak memiliki akses ke pengajuan ini",
        });
      }
    }

    const riwayatOrdered = (submission.riwayat || [])
      .slice()
      .sort((a, b) => new Date(a.tanggal_keputusan || a.createdAt) - new Date(b.tanggal_keputusan || b.createdAt));

    const dosenById = {};
    [submission.dosen1, submission.dosen2, submission.dosen3, submission.dosenCurrent, submission.prospectiveSupervisor]
      .filter(Boolean)
      .forEach((dosen) => {
        dosenById[Number(dosen.id)] = dosen;
      });

    const latestApprovedHistory = riwayatOrdered
      .slice()
      .reverse()
      .find((item) => item.status === "approved");
    const rejectionReasons = riwayatOrdered
      .filter((item) => item.status === "rejected")
      .map((item) => item.keterangan)
      .filter(Boolean);

    let detailPengajuan = {};
    let hasilPengajuan = {
      status_pengajuan: submission.status,
    };

    if (submission.status === "approved") {
      hasilPengajuan.alasan_persetujuan =
        submission.alasan_persetujuan || latestApprovedHistory?.keterangan || null;
    } else if (submission.status === "rejected") {
      hasilPengajuan.alasan_penolakan =
        rejectionReasons.length > 0
          ? rejectionReasons
          : submission.alasan_penolakan
          ? [submission.alasan_penolakan]
          : [];
    }

    if (submission.tipe_pengajuan === "topik_dosen") {
      const topikList = buildTopikList(submission);
      const approvedTopik = getApprovedTopik(submission, topikList);
      const dosenApproved = approvedTopik ? dosenById[Number(approvedTopik.dosen_id)] || null : null;

      detailPengajuan = {
        diajukan_pada: submission.createdAt,
        topik_dipilih: topikList.map(({ slot, kode, judul, dosen }) => ({ slot, kode, judul, dosen })),
      };

      hasilPengajuan.topik_disetujui = approvedTopik
        ? {
            slot: approvedTopik.slot,
            kode: approvedTopik.kode,
            judul: approvedTopik.judul,
          }
        : null;
      hasilPengajuan.dosen_pembimbing = dosenApproved
        ? {
            id: dosenApproved.id,
            nik: dosenApproved.nik,
            nama: dosenApproved.nama,
            email: dosenApproved.email,
          }
        : submission.dosenCurrent
        ? {
            id: submission.dosenCurrent.id,
            nik: submission.dosenCurrent.nik,
            nama: submission.dosenCurrent.nama,
            email: submission.dosenCurrent.email,
          }
        : null;
    } else {
      detailPengajuan = {
        diajukan_pada: submission.createdAt,
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

    const responseData = {
      id: submission.id,
      jenis_jalur: submission.jenis_jalur,
      tipe_pengajuan: submission.tipe_pengajuan,
      status: submission.status,
      tahap_approval: getTopikDosenApprovalStage(submission),
      diajukan_pada: submission.createdAt,
      diperbarui_pada: submission.updatedAt,
      mahasiswa: submission.mahasiswa
        ? {
            id: submission.mahasiswa.id,
            nim: submission.mahasiswa.nim,
            nama: submission.mahasiswa.nama,
            email: submission.mahasiswa.email,
            angkatan: submission.mahasiswa.angkatan,
            status_jalur_saat_ini: submission.mahasiswa.status_jalur_saat_ini,
            dosen_pembimbing_akademik: submission.mahasiswa.dosenPembimbingAkademik
              ? {
                  id: submission.mahasiswa.dosenPembimbingAkademik.id,
                  nik: submission.mahasiswa.dosenPembimbingAkademik.nik,
                  nama: submission.mahasiswa.dosenPembimbingAkademik.nama,
                }
              : null,
          }
        : null,
      detail_pengajuan: detailPengajuan,
      hasil_pengajuan: hasilPengajuan,
      riwayat_persetujuan: riwayatOrdered.map((item) => ({
        status: item.status,
        tipe_approval: item.tipe_approval || "calon_pembimbing",
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
      referensi: {},
    };

    if (submission.pengajuanSebelumnya) {
      responseData.referensi.pengajuan_sebelumnya = {
        id: submission.pengajuanSebelumnya.id,
        status: submission.pengajuanSebelumnya.status,
        topik_1_judul: submission.pengajuanSebelumnya.topik_1_judul,
        judul_mandiri: submission.pengajuanSebelumnya.judul_mandiri,
        createdAt: submission.pengajuanSebelumnya.createdAt,
      };
    }

    if (submission.pamitUlang) {
      responseData.referensi.pamit_ulang = {
        id: submission.pamitUlang.id,
        status_dospem: submission.pamitUlang.status_dospem || null,
        status_dpa: submission.pamitUlang.status_dpa || null,
        alasan_ulang: submission.pamitUlang.alasan_ulang || null,
      };
    }

    if (Object.keys(responseData.referensi).length === 0) {
      delete responseData.referensi;
    }

    res.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error("Error di getSubmissionById:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
      error: error.message,
    });
  }
};

