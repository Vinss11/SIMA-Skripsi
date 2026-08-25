import { useCallback, useEffect, useState } from "react";

export default function useNotifications({ apiBaseUrl, token, onSessionExpired }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [readCount, setReadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filter, setFilterState] = useState("all");

  const request = useCallback(async (path, options = {}) => {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(options.headers || {}) },
    });
    const payload = await response.json().catch(() => null);
    if (response.status === 401 || response.status === 403) {
      const message = String(payload?.message || "").toLowerCase();
      if (response.status === 401 || message.includes("token") || message.includes("kadaluarsa")) onSessionExpired?.();
    }
    if (!response.ok || !payload?.success) throw new Error(payload?.message || "Permintaan pemberitahuan gagal.");
    return payload.data;
  }, [apiBaseUrl, onSessionExpired, token]);

  const loadUnreadCount = useCallback(async () => {
    if (!token) return;
    try {
      const data = await request("/api/notifications/unread-count");
      setUnreadCount(Number(data?.unread_count || 0));
      setReadCount(Number(data?.read_count || 0));
    } catch (loadError) {
      if (loadError.message !== "__SESSION_EXPIRED__") setError(loadError.message);
    }
  }, [request, token]);

  const loadNotifications = useCallback(async (options = {}) => {
    if (!token) return;
    const silent = Boolean(options?.silent);
    if (!silent) setLoading(true);
    try {
      const statusQuery = filter === "unread" ? "&status=unread" : "";
      const data = await request(`/api/notifications?page=${page}&limit=20${statusQuery}`);
      setNotifications(Array.isArray(data?.notifications) ? data.notifications : []);
      setUnreadCount(Number(data?.unread_count || 0));
      setReadCount(Number(data?.read_count || 0));
      setTotal(Number(data?.total || 0));
      setTotalPages(Math.max(1, Number(data?.total_pages || 1)));
      setError("");
    } catch (loadError) {
      if (!silent) setError(loadError.message || "Gagal memuat pemberitahuan.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [filter, page, request, token]);

  const setFilter = useCallback((value) => {
    setFilterState(value);
    setPage(1);
  }, []);

  const markAsRead = useCallback(async (id) => {
    const data = await request(`/api/notifications/${id}/read`, { method: "PATCH" });
    setNotifications((rows) => rows.map((item) => Number(item.id) === Number(id) ? data : item));
    setUnreadCount((count) => Math.max(0, count - (data?.read_at ? 1 : 0)));
    setReadCount((count) => count + (data?.read_at ? 1 : 0));
    await loadUnreadCount();
    return data;
  }, [loadUnreadCount, request]);

  const markAllAsRead = useCallback(async () => {
    await request("/api/notifications/read-all", { method: "PATCH" });
    setNotifications((rows) => rows.map((item) => ({ ...item, read_at: item.read_at || new Date().toISOString() })));
    setUnreadCount(0);
    await loadNotifications();
  }, [loadNotifications, request]);

  const refreshAfterDelete = useCallback(async () => {
    if (page > 1) setPage(1);
    else await loadNotifications();
    await loadUnreadCount();
  }, [loadNotifications, loadUnreadCount, page]);

  const deleteAllRead = useCallback(async () => {
    const data = await request("/api/notifications/read", { method: "DELETE" });
    await refreshAfterDelete();
    return data;
  }, [refreshAfterDelete, request]);

  const deleteSelectedRead = useCallback(async (ids) => {
    const data = await request("/api/notifications/selected", {
      method: "DELETE",
      body: JSON.stringify({ ids }),
    });
    await refreshAfterDelete();
    return data;
  }, [refreshAfterDelete, request]);

  useEffect(() => { loadNotifications(); }, [loadNotifications]);
  useEffect(() => {
    const syncNotifications = () => {
      if (document.visibilityState === "visible") loadNotifications({ silent: true });
    };
    const intervalId = window.setInterval(syncNotifications, 10000);
    const handleFocus = () => syncNotifications();
    const handleVisibilityChange = () => syncNotifications();
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadNotifications]);

  return {
    notifications, unreadCount, readCount, loading, error, page, totalPages, total, filter,
    setFilter, setPage, loadNotifications, loadUnreadCount, markAsRead, markAllAsRead,
    deleteAllRead, deleteSelectedRead,
  };
}
