"use strict";

module.exports = {
  async up(queryInterface) {
    if (queryInterface.sequelize.getDialect() === "postgres") {
      for (const value of ["penelitian", "magang", "perintisan_bisnis"]) {
        await queryInterface.sequelize.query(
          `ALTER TYPE "enum_Mahasiswas_status_jalur_saat_ini" ADD VALUE IF NOT EXISTS '${value}'`
        );
      }
    }
    const [duplicates] = await queryInterface.sequelize.query(`
      SELECT mahasiswa_id, periode_penjaluran_id, COUNT(*) AS total
      FROM "PendaftaranPenjalurans"
      GROUP BY mahasiswa_id, periode_penjaluran_id
      HAVING COUNT(*) > 1
    `);
    if (duplicates.length > 0) {
      throw new Error(
        `Tidak dapat menambah invariant mahasiswa-periode: ditemukan ${duplicates.length} kelompok duplikat. Jalankan reconcile:stage2-registrations:dry-run.`
      );
    }
    await queryInterface.addConstraint("PendaftaranPenjalurans", {
      fields: ["mahasiswa_id", "periode_penjaluran_id"],
      type: "unique",
      name: "pendaftaran_penjalurans_mahasiswa_periode_unique",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint(
      "PendaftaranPenjalurans",
      "pendaftaran_penjalurans_mahasiswa_periode_unique"
    );
  },
};
