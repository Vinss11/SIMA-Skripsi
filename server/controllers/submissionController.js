const { Op } = require("sequelize");
const { Pengajuan, Mahasiswa, Dosen, Topik, RiwayatPersetujuan, PamitUlang, SekretarisProdi } = require("../models");
const {
  isTopikParallelSubmission,
  buildTopikListFromSubmission,
  getTopikParallelReviewDeadline,
  evaluateTopikParallelState,
  finalizeTopikParallelSubmission,
  finalizeTopikParallelSubmissionsByIds,
} = require("../services/topikParallelReviewService");

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
  return buildTopikListFromSubmission(submission).map((item) => ({
    slot: item.slot,
    kode: item.kode,
    judul: item.judul,
    dosen: item.dosen_nama,
    dosen_id: item.dosen_id,
  }));
}

function getApprovedTopik(submission, topikList) {
  if (topikList.length === 0) {
    return null;
  }

  if (isTopikParallelSubmission(submission)) {
    const parallelState = evaluateTopikParallelState(submission);
    if (parallelState.approved_topik?.slot && (submission.status !== "pending" || parallelState.can_finalize)) {
      return topikList.find((item) => item.slot === parallelState.approved_topik.slot) || null;
    }
  }

  if (submission.status !== "approved") {
    return null;
  }

  const rejectedCount = (submission.riwayat || []).filter((item) => item.status === "rejected").length;
  const approvedSlot = Math.min(rejectedCount + 1, topikList.length);
  return topikList.find((item) => item.slot === approvedSlot) || null;
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

  const parallelState = evaluateTopikParallelState(submission);
  const hasKetuaKlasterDecided = (submission.riwayat || []).some(
    (item) =>
      (item.status === "approved" || item.status === "rejected") &&
      String(item?.tipe_approval || "calon_pembimbing").toLowerCase() === "koordinator"
  );
  if (parallelState.can_finalize && parallelState.approved_topik && !hasKetuaKlasterDecided) {
    return "pending_ketua_klaster";
  }

  if (parallelState.deadline_passed && parallelState.pending_count > 0) {
    return "deadline_terlewati";
  }

  return "pending_review_parallel";
}

function getSubmissionDetailIncludes() {
  return [
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
      required: false,
    },
  ];
}

async function loadSubmissionDetailById(submissionId) {
  return Pengajuan.findByPk(Number(submissionId), {
    include: getSubmissionDetailIncludes(),
  });
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

    const baseQuery = {
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
          attributes: [
            "id",
            "dosen_id",
            "status",
            "tipe_approval",
            "topik_slot",
            "topik_kode",
            "keterangan",
            "tanggal_keputusan",
            "createdAt",
            "updatedAt",
          ],
          required: false,
        },
      ],
      order: [["createdAt", "DESC"]],
    };

    let submissions = await Pengajuan.findAll(baseQuery);
    const pendingTopikIds = submissions
      .filter((item) => isTopikParallelSubmission(item) && item.status === "pending")
      .map((item) => item.id);
    if (pendingTopikIds.length > 0) {
      await finalizeTopikParallelSubmissionsByIds(pendingTopikIds);
      submissions = await Pengajuan.findAll(baseQuery);
    }

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
        const normalizedKode = String(item.kode || "")
          .trim()
          .toUpperCase();
        if (normalizedKode) {
          topikByKode[normalizedKode] = item.judul;
        }
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
        const topikList = buildTopikList(submission).map((item) => {
          const normalizedKode = String(item?.kode || "")
            .trim()
            .toUpperCase();
          return {
            ...item,
            kode: normalizedKode || item.kode,
            judul: item.judul || topikByKode[normalizedKode] || null,
          };
        });
        const approvedTopik = getApprovedTopik(submission, topikList);
        const parallelState = evaluateTopikParallelState(submission);
        const slotStateBySlot = new Map(parallelState.slot_decisions.map((item) => [Number(item.slot), item]));

        base.topik_dipilih = topikList.map(({ kode }) => kode);
        base.topik_dipilih_detail = topikList.map(({ slot, kode, judul, dosen, dosen_id: dosenId }) => {
          const slotState = slotStateBySlot.get(Number(slot));
          return {
            slot,
            kode,
            judul,
            dosen: dosen || null,
            dosen_id: dosenId || null,
            reviewer_status: slotState?.reviewer_status || null,
            reviewer_note: slotState?.reviewer_note || null,
            reviewer_decided_at: slotState?.reviewer_decided_at || null,
          };
        });
        base.topik_disetujui = approvedTopik
          ? {
              slot: approvedTopik.slot,
              kode: approvedTopik.kode,
              judul: approvedTopik.judul,
            }
          : null;
        base.dosen_pembimbing = submission.dosenCurrent ? submission.dosenCurrent.nama : null;
        base.review_deadline_at = getTopikParallelReviewDeadline(submission);
        base.deadline_terlewati = Boolean(parallelState.deadline_passed && parallelState.pending_count > 0);
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

    let submission = await loadSubmissionDetailById(Number(id));

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

    if (isTopikParallelSubmission(submission) && submission.status === "pending") {
      const finalizationResult = await finalizeTopikParallelSubmission(submission.id);
      if (finalizationResult?.changed || finalizationResult?.finalized) {
        submission = await loadSubmissionDetailById(Number(id));
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
    const topikParallelState = isTopikParallelSubmission(submission) ? evaluateTopikParallelState(submission) : null;
    const reviewerSlotDecisions =
      topikParallelState && accessorDosenId
        ? topikParallelState.slot_decisions
            .filter((item) => Number(item.dosen_id) === Number(accessorDosenId))
            .sort((a, b) => a.slot - b.slot)
        : [];
    const pendingReviewerDecision =
      Array.isArray(reviewerSlotDecisions) && reviewerSlotDecisions.length > 0
        ? reviewerSlotDecisions.find((item) => item.reviewer_status === "pending") || null
        : null;
    const currentReviewerDecision =
      pendingReviewerDecision ||
      (Array.isArray(reviewerSlotDecisions) && reviewerSlotDecisions.length > 0 ? reviewerSlotDecisions[0] : null);

    let detailPengajuan = {};
    let hasilPengajuan = {
      status_pengajuan: submission.status,
    };
    let approvedTopikForResponse = null;

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
      const slotStateBySlot = new Map((topikParallelState?.slot_decisions || []).map((item) => [Number(item.slot), item]));
      const topikList = buildTopikList(submission).map((item) => {
        const normalizedKode = String(item?.kode || "")
          .trim()
          .toUpperCase();
        const slotState = slotStateBySlot.get(Number(item.slot));
        return {
          ...item,
          kode: normalizedKode || item.kode,
          reviewer_status: slotState?.reviewer_status || null,
          reviewer_note: slotState?.reviewer_note || null,
          reviewer_decided_at: slotState?.reviewer_decided_at || null,
        };
      });
      const approvedTopik = getApprovedTopik(submission, topikList);
      approvedTopikForResponse = approvedTopik;
      const dosenApproved = approvedTopik ? dosenById[Number(approvedTopik.dosen_id)] || null : null;

      detailPengajuan = {
        diajukan_pada: submission.createdAt,
        topik_dipilih: topikList.map(
          ({ slot, kode, judul, dosen, dosen_id: dosenId, reviewer_status, reviewer_note, reviewer_decided_at }) => ({
            slot,
            kode,
            judul,
            dosen,
            dosen_id: dosenId || null,
            reviewer_status: reviewer_status || null,
            reviewer_note: reviewer_note || null,
            reviewer_decided_at: reviewer_decided_at || null,
          })
        ),
        review_deadline_at: getTopikParallelReviewDeadline(submission),
        deadline_terlewati: Boolean(topikParallelState?.deadline_passed && topikParallelState?.pending_count > 0),
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

    const canReviewTopikParallel =
      submission.tipe_pengajuan === "topik_dosen" &&
      submission.status === "pending" &&
      Array.isArray(reviewerSlotDecisions) &&
      reviewerSlotDecisions.some((item) => item.reviewer_status === "pending");
    const topikApprovalStage =
      submission.tipe_pengajuan === "topik_dosen" ? getTopikDosenApprovalStage(submission) : null;
    const canReviewKetuaClusterTopik =
      submission.tipe_pengajuan === "topik_dosen" &&
      submission.status === "pending" &&
      topikApprovalStage === "pending_ketua_klaster" &&
      accessorDosenId &&
      Number(submission.dosen_saat_ini) === Number(accessorDosenId);
    const canReviewNonTopik =
      submission.tipe_pengajuan !== "topik_dosen" &&
      submission.status === "pending" &&
      (userRole === "dosen" || userRole === "sekretaris_prodi");

    const responseData = {
      id: submission.id,
      jenis_jalur: submission.jenis_jalur,
      tipe_pengajuan: submission.tipe_pengajuan,
      status: submission.status,
      tahap_approval: topikApprovalStage || getTopikDosenApprovalStage(submission),
      diajukan_pada: submission.createdAt,
      diperbarui_pada: submission.updatedAt,
      review_deadline_at:
        submission.tipe_pengajuan === "topik_dosen" ? getTopikParallelReviewDeadline(submission) : null,
      reviewer_status: canReviewKetuaClusterTopik ? "pending" : currentReviewerDecision?.reviewer_status || null,
      reviewer_note: canReviewKetuaClusterTopik
        ? "Menunggu keputusan ketua cluster."
        : currentReviewerDecision?.reviewer_note || null,
      review_context: canReviewKetuaClusterTopik ? "ketua_klaster" : "calon_pembimbing",
      can_review: Boolean(canReviewTopikParallel || canReviewKetuaClusterTopik || canReviewNonTopik),
      reviewer_slot_decisions:
        canReviewKetuaClusterTopik && approvedTopikForResponse
          ? [
              {
                slot: approvedTopikForResponse.slot,
                kode: approvedTopikForResponse.kode,
                reviewer_status: "pending",
                reviewer_note: "Menunggu keputusan ketua cluster.",
                reviewer_decided_at: null,
              },
            ]
          : submission.tipe_pengajuan === "topik_dosen" && Array.isArray(reviewerSlotDecisions)
          ? reviewerSlotDecisions.map((item) => ({
              slot: item.slot,
              kode: item.kode,
              reviewer_status: item.reviewer_status,
              reviewer_note: item.reviewer_note,
              reviewer_decided_at: item.reviewer_decided_at || null,
            }))
          : [],
      topik_review_status:
        submission.tipe_pengajuan === "topik_dosen"
          ? (topikParallelState?.slot_decisions || []).map((item) => ({
              slot: item.slot,
              kode: item.kode,
              dosen_id: item.dosen_id,
              reviewer_status: item.reviewer_status,
              reviewer_note: item.reviewer_note,
              reviewer_decided_at: item.reviewer_decided_at || null,
            }))
          : [],
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

