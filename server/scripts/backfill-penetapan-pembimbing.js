"use strict";

require("dotenv").config();
const { Op } = require("sequelize");
const {
  sequelize,
  Mahasiswa,
  PendaftaranPenjaluran,
  PenetapanPembimbing,
} = require("../models");
const {
  createDraftSupervisorAssignment,
  activateSupervisorAssignment,
} = require("../services/penetapanPembimbingService");

const execute = process.argv.includes("--execute");
const dryRun = process.argv.includes("--dry-run") || !execute;

async function run() {
  const students = await Mahasiswa.findAll({
    where: { dosen_pembimbing_skripsi_id: { [Op.ne]: null } },
    attributes: ["id", "nim", "nama", "dosen_pembimbing_skripsi_id"],
    order: [["id", "ASC"]],
  });
  const result = { mode: dryRun ? "dry-run" : "execute", total: students.length, would_create: 0, created: 0, skipped: 0, failed: 0 };

  for (const mahasiswa of students) {
    try {
      const active = await PenetapanPembimbing.findOne({
        where: { mahasiswa_id: mahasiswa.id, status: "active" },
        attributes: ["id"],
      });
      if (active) {
        result.skipped += 1;
        continue;
      }
      const latestRegistration = await PendaftaranPenjaluran.findOne({
        where: { mahasiswa_id: mahasiswa.id, status: "approved" },
        attributes: ["id", "periode_penjaluran_id"],
        order: [["reviewed_at", "DESC NULLS LAST"], ["createdAt", "DESC"]],
      });
      result.would_create += 1;
      if (dryRun) continue;

      await sequelize.transaction(async (transaction) => {
        const draft = await createDraftSupervisorAssignment({
          mahasiswaId: mahasiswa.id,
          pendaftaranPenjaluranId: latestRegistration?.id || null,
          periodeMulaiId: latestRegistration?.periode_penjaluran_id || null,
          dosenPembimbingIds: [mahasiswa.dosen_pembimbing_skripsi_id],
          sumberData: "legacy_backfill",
          transaction,
          skipEligibilityValidation: true,
        });
        await activateSupervisorAssignment({
          penetapanId: draft.id,
          tanggalMulai: null,
          preserveNullStartDate: true,
          transaction,
        });
      });
      result.created += 1;
    } catch (error) {
      result.failed += 1;
      console.error(`[${mahasiswa.nim}] ${error.message}`);
    }
  }
  console.log(JSON.stringify(result, null, 2));
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
