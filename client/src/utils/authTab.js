const AUTH_TAB_STORAGE_KEY = "sima_auth_tab_id";

function createAuthTabId() {
  if (typeof window.crypto?.randomUUID === "function") return window.crypto.randomUUID();
  return `tab_${Date.now()}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
}

function resolveAuthTabId() {
  try {
    const existing = window.sessionStorage.getItem(AUTH_TAB_STORAGE_KEY);
    if (existing) return existing;
    const created = createAuthTabId();
    window.sessionStorage.setItem(AUTH_TAB_STORAGE_KEY, created);
    return created;
  } catch (_) {
    return createAuthTabId();
  }
}

export const AUTH_TAB_ID = resolveAuthTabId();

export function withAuthTabHeader(headers = {}) {
  return { ...headers, "X-SIMA-Auth-Tab": AUTH_TAB_ID };
}
