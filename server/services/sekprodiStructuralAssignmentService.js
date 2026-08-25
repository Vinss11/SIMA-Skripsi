const {
  Mahasiswa,
  Pengajuan,
  PendaftaranPenjaluran,
  PeriodePenjaluran,
} = require("../models");
const {
  ALLOWED_SEKRETARIS_JABATAN,
  isAllowedSekretarisJabatan,
  resolveProgramKuliahFromJabatan,
} = require("../constants/sekretarisAkses");

const PROGRAM_LABELS = {
  reguler: "Reguler",
  internasional: "International Program",
};

function formatJalur(value) {
  const labels = {
    penelitian: "Penelitian",
    pengabdian: "Pengabdian Masyarakat",
    perintisan_bisnis: "Perintisan Bisnis",
    magang: "Magang",
  };
  return labels[String(value || "").toLowerCase()] || value || "Penjaluran";
}

function mapTask({ source, id, status, tipePengajuan, pendaftaran }) {
  const jalur = pendaftaran?.penjaluran_baru || pendaftaran?.jenis_jalur_diambil;
  return {
    source,
    id,
    status,
    jenis_proses:
      source === "pengajuan_penelitian"
        ? `Keputusan final ${tipePengajuan === "judul_mandiri" ? "judul mandiri" : "topik penelitian"}`
        : `Keputusan final form ${formatJalur(jalur)}`,
    jenis_pendaftaran: pendaftaran?.jalur || null,
    jalur: jalur || null,
    mahasiswa: pendaftaran?.mahasiswa
      ? {
          id: pendaftaran.mahasiswa.id,
          nim: pendaftaran.mahasiswa.nim,
          nama: pendaftaran.mahasiswa.nama,
        }
      : null,
    periode: pendaftaran?.periode
      ? {
          id: pendaftaran.periode.id,
          label_periode: pendaftaran.periode.label_periode,
        }
      : null,
  };
}

async function getPendingSekprodiTasks(programKuliah, transaction) {
  const buildPendaftaranInclude = () => [
    {
      model: Mahasiswa,
      as: "mahasiswa",
      attributes: ["id", "nim", "nama"],
      required: false,
    },
    {
      model: PeriodePenjaluran,
      as: "periode",
      attributes: ["id", "label_periode"],
      required: false,
    },
  ];

  const [formRows, researchRows] = await Promise.all([
    PendaftaranPenjaluran.findAll({
      where: {
        program_kuliah: programKuliah,
        form_lanjutan_status: "review_sekprodi",
      },
      attributes: [
        "id",
        "jalur",
        "jenis_jalur_diambil",
        "penjaluran_baru",
        "form_lanjutan_status",
      ],
      include: buildPendaftaranInclude(),
      order: [["updatedAt", "ASC"]],
      transaction,
    }),
    Pengajuan.findAll({
      where: { status: "menunggu_approval_sekprodi" },
      attributes: ["id", "status", "tipe_pengajuan"],
      include: [
        {
          model: PendaftaranPenjaluran,
          as: "pendaftaranPenjaluran",
          where: { program_kuliah: programKuliah },
          attributes: ["id", "jalur", "jenis_jalur_diambil", "penjaluran_baru"],
          required: true,
          include: buildPendaftaranInclude(),
        },
      ],
      order: [["updatedAt", "ASC"]],
      transaction,
    }),
  ]);

  return [
    ...formRows.map((row) =>
      mapTask({
        source: "form_penjaluran",
        id: row.id,
        status: row.form_lanjutan_status,
        pendaftaran: row,
      })
    ),
    ...researchRows.map((row) =>
      mapTask({
        source: "pengajuan_penelitian",
        id: row.id,
        status: row.status,
        tipePengajuan: row.tipe_pengajuan,
        pendaftaran: row.pendaftaranPenjaluran,
      })
    ),
  ];
}

async function getSekprodiStructuralAssignmentLock(jabatan, { transaction } = {}) {
  if (!isAllowedSekretarisJabatan(jabatan)) return null;

  const programKuliah = resolveProgramKuliahFromJabatan(jabatan);
  const tasks = await getPendingSekprodiTasks(programKuliah, transaction);
  const programLabel = PROGRAM_LABELS[programKuliah] || programKuliah;
  const pendingCount = tasks.length;

  return {
    jabatan,
    program_kuliah: programKuliah,
    program_label: programLabel,
    locked: pendingCount > 0,
    can_replace: pendingCount === 0,
    pending_count: pendingCount,
    message:
      pendingCount > 0
        ? `Sekprodi ${programLabel} belum dapat diganti karena masih memiliki ${pendingCount} proses penjaluran yang harus diselesaikan.`
        : `Sekprodi ${programLabel} dapat diganti karena tidak memiliki proses penjaluran yang tertunda.`,
    tasks,
  };
}

async function getSekprodiStructuralAssignmentLocks(options = {}) {
  const locks = await Promise.all(
    ALLOWED_SEKRETARIS_JABATAN.map((jabatan) =>
      getSekprodiStructuralAssignmentLock(jabatan, options)
    )
  );

  return locks.filter(Boolean);
}

module.exports = {
  getSekprodiStructuralAssignmentLock,
  getSekprodiStructuralAssignmentLocks,
};
