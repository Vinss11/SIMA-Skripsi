import React, { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { Bell, CheckCheck, Eye, ListChecks, RefreshCcw, Trash2, X } from "lucide-react";

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(date);
}

export default function NotificationPage({ notificationState, onNavigate }) {
  const {
    notifications, unreadCount, loading, error, page, totalPages, total, filter,
    setFilter, setPage, loadNotifications, markAsRead, markAllAsRead,
    deleteSelectedRead,
  } = notificationState;
  const [selected, setSelected] = useState(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [deleting, setDeleting] = useState(false);
  const appointedSupervisors = Array.isArray(selected?.metadata?.appointed_supervisors)
    ? selected.metadata.appointed_supervisors
    : [];
  const readableIds = useMemo(
    () => notifications.filter((item) => item.read_at).map((item) => Number(item.id)),
    [notifications]
  );

  useEffect(() => {
    const allowed = new Set(readableIds);
    setSelectedIds((current) => new Set([...current].filter((id) => allowed.has(Number(id)))));
  }, [readableIds]);

  const toggleSelected = (notification) => {
    if (!notification.read_at) return;
    setSelectedIds((current) => {
      const next = new Set(current);
      const id = Number(notification.id);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0 || deleting) return;
    const confirmation = await Swal.fire({
      title: `Hapus ${selectedIds.size} pemberitahuan?`,
      text: "Pemberitahuan terpilih yang sudah dibaca akan dihapus permanen.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Ya, Hapus",
      cancelButtonText: "Batal",
      confirmButtonColor: "#b73a3a",
    });
    if (!confirmation.isConfirmed) return;
    setDeleting(true);
    try {
      const data = await deleteSelectedRead([...selectedIds]);
      setSelectedIds(new Set());
      if (selectedIds.has(Number(selected?.id))) setSelected(null);
      await Swal.fire({ title: "Berhasil", text: `${Number(data?.deleted || 0)} pemberitahuan dihapus.`, icon: "success" });
    } catch (deleteError) {
      await Swal.fire({ title: "Gagal", text: deleteError.message || "Pemberitahuan gagal dihapus.", icon: "error" });
    } finally {
      setDeleting(false);
    }
  };

  const allReadableSelected = readableIds.length > 0
    && readableIds.every((id) => selectedIds.has(Number(id)));

  const handleSelectAll = () => {
    if (deleting || readableIds.length === 0) return;
    setSelectedIds(allReadableSelected ? new Set() : new Set(readableIds));
  };

  const openDetail = async (notification) => {
    try {
      const updated = notification.read_at ? notification : await markAsRead(notification.id);
      setSelected(updated || notification);
    } catch (_error) {
      setSelected(notification);
    }
  };

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-[#dce4f7] bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-black text-[#1a2648]">Pemberitahuan</h3>
            <p className="mt-1 text-sm text-[#667393]">{total} pemberitahuan · {unreadCount} belum dibaca</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={loadNotifications} className="inline-flex items-center gap-2 rounded-lg border border-[#d3dbef] px-3 py-2 text-sm font-bold text-[#30477e] hover:bg-[#f3f6ff]">
              <RefreshCcw className="h-4 w-4" /> Refresh
            </button>
            <button type="button" onClick={markAllAsRead} disabled={unreadCount <= 0} className="inline-flex items-center gap-2 rounded-lg bg-[#2f63e3] px-3 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
              <CheckCheck className="h-4 w-4" /> Tandai Semua Dibaca
            </button>
            <button type="button" onClick={handleSelectAll} disabled={readableIds.length === 0 || deleting} className="inline-flex items-center gap-2 rounded-lg border border-[#cfd9f0] bg-white px-3 py-2 text-sm font-bold text-[#2f56a6] hover:bg-[#f3f6ff] disabled:cursor-not-allowed disabled:opacity-50">
              <ListChecks className="h-4 w-4" /> {allReadableSelected ? "Batalkan Pilihan" : "Pilih Semua Pesan"}
            </button>
            <button type="button" onClick={handleDeleteSelected} disabled={selectedIds.size === 0 || deleting} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">
              <Trash2 className="h-4 w-4" /> Hapus Terpilih ({selectedIds.size})
            </button>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          {[{ id: "all", label: "Semua" }, { id: "unread", label: "Belum Dibaca" }].map((item) => (
            <button key={item.id} type="button" onClick={() => setFilter(item.id)} className={`rounded-full border px-4 py-2 text-sm font-bold ${filter === item.id ? "border-[#2f63e3] bg-[#2f63e3] text-white" : "border-[#d4dcef] text-[#385084]"}`}>
              {item.label}
            </button>
          ))}
        </div>
      </section>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div> : null}
      <section className="overflow-hidden rounded-xl border border-[#dce4f7] bg-white shadow-sm">
        <div className="space-y-3 p-3">
          {loading ? <div className="p-6 text-sm font-semibold text-[#637093]">Memuat pemberitahuan...</div> : null}
          {!loading && notifications.length === 0 ? (
            <div className="p-10 text-center">
              <Bell className="mx-auto h-9 w-9 text-[#8290b2]" />
              <p className="mt-3 text-sm font-bold text-[#526184]">Belum ada pemberitahuan.</p>
            </div>
          ) : null}
          {notifications.map((notification) => {
            const unread = !notification.read_at;
            return (
              <article key={notification.id} className={`rounded-xl border p-4 ${unread ? "border-[#cfdcff] bg-[#f3f7ff]" : "border-[#e3e8f4] bg-white"}`}>
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(Number(notification.id))}
                    disabled={unread || deleting}
                    onChange={() => toggleSelected(notification)}
                    title={unread ? "Baca pemberitahuan terlebih dahulu sebelum menghapusnya." : "Pilih pemberitahuan untuk dihapus."}
                    aria-label={`Pilih pemberitahuan ${notification.title}`}
                    className="mt-1 h-4 w-4 shrink-0 accent-[#2f63e3] disabled:cursor-not-allowed disabled:opacity-40"
                  />
                  <div className="min-w-0 flex-1">
                    <h4 className="font-black text-[#1a2648]">{notification.title}</h4>
                    <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-[#596789]">{notification.message}</p>
                    <p className="mt-2 text-xs font-semibold text-[#7a87a7]">{formatDateTime(notification.createdAt)}</p>
                  </div>
                  <button type="button" onClick={() => openDetail(notification)} className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-[#cfd9f0] bg-white px-3 py-2 text-sm font-bold text-[#2f56a6] hover:bg-[#f3f6ff]">
                    <Eye className="h-4 w-4" /> Lihat Detail
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#dce4f7] bg-[#f8faff] p-3">
          <button type="button" onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} className="rounded-lg border border-[#d3dbef] px-3 py-2 text-sm font-bold text-[#30477e] disabled:opacity-50">Sebelumnya</button>
          <span className="text-sm font-bold text-[#526184]">Halaman {page} / {Math.max(1, totalPages)}</span>
          <button type="button" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages} className="rounded-lg border border-[#d3dbef] px-3 py-2 text-sm font-bold text-[#30477e] disabled:opacity-50">Berikutnya</button>
        </div>
      </section>

      {selected ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4" onMouseDown={() => setSelected(null)}>
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div><h3 className="text-xl font-black text-[#1a2648]">{selected.title}</h3><p className="mt-1 text-xs font-semibold text-[#7a87a7]">{formatDateTime(selected.createdAt)}</p></div>
              <button type="button" onClick={() => setSelected(null)} className="rounded-lg p-2 text-[#647294] hover:bg-[#f3f6ff]"><X className="h-5 w-5" /></button>
            </div>
            <p className="mt-5 whitespace-pre-wrap text-sm leading-relaxed text-[#36456d]">{selected.message}</p>
            {appointedSupervisors.length > 0 ? (
              <div className="mt-4 rounded-lg bg-[#f5f8ff] p-3 text-sm text-[#435681]">
                <b>Dosen yang ditetapkan oleh Sekprodi:</b>
                <div className="mt-2 space-y-1">
                  {appointedSupervisors.map((supervisor) => (
                    <p key={`${supervisor.dosen_id}-${supervisor.urutan}`}>
                      Pembimbing {supervisor.urutan}: {supervisor.nama}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setSelected(null)} className="rounded-lg border border-[#d3dbef] px-4 py-2 text-sm font-bold text-[#30477e]">Tutup</button>
              {selected.action_key ? <button type="button" onClick={() => { onNavigate?.(selected); setSelected(null); }} className="rounded-lg bg-[#2f63e3] px-4 py-2 text-sm font-bold text-white">Buka Halaman Terkait</button> : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
