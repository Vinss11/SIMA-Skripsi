import { formatDosenFullName } from "../utils/dosen";

function formatHistoryDate(value, fallback = "Tanggal tidak tercatat") {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

const STATUS_META = {
  active: ["Aktif", "bg-[#e8f8ef] text-[#127947]"],
  draft: ["Draft", "bg-[#eef3ff] text-[#34549b]"],
  ended: ["Berakhir", "bg-[#f1f3f8] text-[#596887]"],
  cancelled: ["Dibatalkan", "bg-[#fff1f1] text-[#a33f3f]"],
};

function AssignmentCard({ assignment }) {
  const statusMeta = STATUS_META[assignment?.status] || [assignment?.status || "-", "bg-[#f1f3f8] text-[#596887]"];
  const supervisors = Array.isArray(assignment?.pembimbings) ? assignment.pembimbings : [];
  return (
    <div className="relative border-l-2 border-[#cdd8f2] pb-5 pl-5 last:pb-0">
      <span className="absolute -left-[7px] top-1 h-3 w-3 rounded-full border-2 border-white bg-[#2f63e3]" />
      <div className="rounded-xl border border-[#e1e8f6] bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-black text-[#1f3160]">{assignment?.periode || "Periode belum tercatat"}</p>
          <span className={`rounded-full px-2 py-1 text-xs font-bold ${statusMeta[1]}`}>{statusMeta[0]}</span>
        </div>
        <div className="mt-3 grid gap-2 text-sm text-[#4f5e86] md:grid-cols-2">
          {supervisors.map((member) => (
            <p key={`${assignment.id}-${member.urutan}`}>
              <span className="font-bold text-[#29385f]">Pembimbing {member.urutan}:</span>{" "}
              {formatDosenFullName(member.dosen?.nama, member.dosen?.gelar) || "-"}
            </p>
          ))}
          <p><span className="font-bold text-[#29385f]">Mulai:</span> {formatHistoryDate(assignment?.tanggal_mulai, "Tanggal mulai tidak tercatat")}</p>
          <p><span className="font-bold text-[#29385f]">Berakhir:</span> {assignment?.tanggal_selesai ? formatHistoryDate(assignment.tanggal_selesai) : "-"}</p>
          <p><span className="font-bold text-[#29385f]">Semester penjaluran:</span> {assignment?.semester_penjaluran_ke || "-"}</p>
          <p><span className="font-bold text-[#29385f]">Dasar penetapan:</span> {assignment?.dasar_penetapan || "Keputusan Final Sekretaris Prodi"}</p>
          <p><span className="font-bold text-[#29385f]">Ditetapkan oleh:</span> {assignment?.ditetapkan_oleh?.nama || "Tidak tercatat"}</p>
          <p><span className="font-bold text-[#29385f]">Tanggal penetapan:</span> {formatHistoryDate(assignment?.tanggal_penetapan, "Tidak tercatat")}</p>
          <p><span className="font-bold text-[#29385f]">Sumber:</span> {String(assignment?.sumber_data || "-").replaceAll("_", " ")}</p>
          <p><span className="font-bold text-[#29385f]">Pendaftaran:</span> {assignment?.pendaftaran?.id ? `#${assignment.pendaftaran.id}` : "Tidak tercatat"}</p>
        </div>
        {assignment?.alasan_berakhir ? (
          <p className="mt-3 rounded-lg bg-[#f8faff] px-3 py-2 text-sm text-[#4f5e86]"><span className="font-bold">Alasan:</span> {assignment.alasan_berakhir}</p>
        ) : null}
      </div>
    </div>
  );
}

export default function SupervisorAssignmentTimeline({ data, loading = false, error = "", compact = false }) {
  if (loading) return <p className="py-5 text-center text-sm font-semibold text-[#6b7899]">Memuat histori pembimbing...</p>;
  if (error) return <p className="rounded-lg bg-[#fff2f2] px-3 py-2 text-sm font-semibold text-[#a33f3f]">{error}</p>;
  const assignments = [data?.active, ...(Array.isArray(data?.history) ? data.history : [])].filter(Boolean);
  if (assignments.length === 0) {
    return <p className="rounded-lg bg-[#f7f9fd] px-3 py-4 text-center text-sm font-semibold text-[#6b7899]">Belum ada histori penetapan pembimbing.</p>;
  }
  return <div className={compact ? "mt-3" : "mt-4"}>{assignments.map((assignment) => <AssignmentCard key={assignment.id} assignment={assignment} />)}</div>;
}
