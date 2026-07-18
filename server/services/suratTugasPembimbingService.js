"use strict";

const { Op } = require("sequelize");
const { sequelize, SuratTugasPembimbing, PenetapanPembimbing, PeriodePenjaluran } = require("../models");
const { activateSupervisorAssignment, SupervisorAssignmentError } = require("./penetapanPembimbingService");

function normalizeIds(values) {
  return [...new Set((Array.isArray(values) ? values : []).map(Number).filter((id) => Number.isInteger(id) && id > 0))];
}

function validateDateRange(start, end) {
  if (start && end && new Date(end) < new Date(start)) {
    throw new SupervisorAssignmentError("Tanggal selesai masa berlaku tidak boleh sebelum tanggal mulai.", 400);
  }
}

async function createSuratTugasDraft({
  periodePenjaluranId = null,
  nomorSurat = null,
  tanggalSurat = null,
  tanggalBerlakuMulai = null,
  tanggalBerlakuSelesai = null,
  filePath = null,
  catatan = null,
  penetapanIds = [],
  transaction = null,
}) {
  const work = async (t) => {
    validateDateRange(tanggalBerlakuMulai, tanggalBerlakuSelesai);
    if (periodePenjaluranId && !(await PeriodePenjaluran.findByPk(periodePenjaluranId, { transaction: t }))) {
      throw new SupervisorAssignmentError("Periode penjaluran tidak ditemukan.", 404);
    }
    const ids = normalizeIds(penetapanIds);
    if (ids.length > 0) {
      const assignments = await PenetapanPembimbing.findAll({
        where: { id: { [Op.in]: ids } },
        attributes: ["id", "surat_tugas_id"],
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (assignments.length !== ids.length) throw new SupervisorAssignmentError("Sebagian penetapan pembimbing tidak ditemukan.", 404);
      if (assignments.some((item) => item.surat_tugas_id)) {
        throw new SupervisorAssignmentError("Salah satu penetapan sudah terhubung ke surat tugas lain.", 409);
      }
    }
    const surat = await SuratTugasPembimbing.create({
      periode_penjaluran_id: periodePenjaluranId || null,
      nomor_surat: String(nomorSurat || "").trim() || null,
      tanggal_surat: tanggalSurat || null,
      tanggal_berlaku_mulai: tanggalBerlakuMulai || null,
      tanggal_berlaku_selesai: tanggalBerlakuSelesai || null,
      file_path: String(filePath || "").trim() || null,
      status: "draft",
      catatan: String(catatan || "").trim() || null,
    }, { transaction: t });
    if (ids.length > 0) {
      await PenetapanPembimbing.update({ surat_tugas_id: surat.id }, { where: { id: { [Op.in]: ids } }, transaction: t });
    }
    return surat;
  };
  return transaction ? work(transaction) : sequelize.transaction(work);
}

async function issueSuratTugas({ suratTugasId, issuedBySekretarisId, transaction = null }) {
  const work = async (t) => {
    const surat = await SuratTugasPembimbing.findByPk(suratTugasId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!surat) throw new SupervisorAssignmentError("Surat tugas pembimbing tidak ditemukan.", 404);
    if (surat.status === "issued") return surat;
    if (surat.status !== "draft") throw new SupervisorAssignmentError("Hanya surat tugas draft yang dapat diterbitkan.", 409);
    if (!String(surat.nomor_surat || "").trim() || !surat.tanggal_surat) {
      throw new SupervisorAssignmentError("Nomor dan tanggal surat wajib diisi sebelum diterbitkan.", 400);
    }
    const assignments = await PenetapanPembimbing.findAll({ where: { surat_tugas_id: surat.id }, transaction: t });
    if (assignments.length === 0) throw new SupervisorAssignmentError("Surat tugas belum memiliki penetapan pembimbing.", 409);
    for (const assignment of assignments) {
      if (assignment.status === "draft") {
        await activateSupervisorAssignment({
          penetapanId: assignment.id,
          tanggalMulai: surat.tanggal_berlaku_mulai || surat.tanggal_surat,
          suratTugasId: surat.id,
          transaction: t,
        });
      }
    }
    await surat.update({ status: "issued", issued_by_sekretaris_id: issuedBySekretarisId || null }, { transaction: t });
    return surat;
  };
  return transaction ? work(transaction) : sequelize.transaction(work);
}

async function cancelSuratTugas({ suratTugasId, catatan = null, transaction = null }) {
  const work = async (t) => {
    const surat = await SuratTugasPembimbing.findByPk(suratTugasId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!surat) throw new SupervisorAssignmentError("Surat tugas pembimbing tidak ditemukan.", 404);
    if (surat.status === "cancelled") return surat;
    await surat.update({ status: "cancelled", catatan: String(catatan || surat.catatan || "").trim() || null }, { transaction: t });
    return surat;
  };
  return transaction ? work(transaction) : sequelize.transaction(work);
}

module.exports = { createSuratTugasDraft, issueSuratTugas, cancelSuratTugas };
