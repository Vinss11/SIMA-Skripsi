import React, { useState } from "react";
import { Bell, CheckCheck, Eye, RefreshCcw, X } from "lucide-react";

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
  } = notificationState;
  const [selected, setSelected] = useState(null);

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
                  <span className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${unread ? "bg-red-500" : "bg-[#cbd3e5]"}`} />
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
            {selected.metadata?.effective_date ? <p className="mt-4 rounded-lg bg-[#f5f8ff] p-3 text-sm text-[#435681]"><b>Tanggal efektif:</b> {formatDateTime(selected.metadata.effective_date)}</p> : null}
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
