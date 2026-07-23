export default function NotificationMenuBadge({ count = 0, active = false }) {
  if (count <= 0) return null;
  return (
    <span className="relative ml-auto" aria-label={`${count} pemberitahuan belum dibaca`}>
      <span className={`absolute inset-0 rounded-full bg-red-400 opacity-60 motion-reduce:animate-none ${active ? "" : "animate-ping"}`} />
      <span className="relative inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[11px] font-black text-white">
        {count > 99 ? "99+" : count}
      </span>
    </span>
  );
}
