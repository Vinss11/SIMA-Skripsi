import React, { useCallback, useEffect, useMemo, useState } from "react";
import LoginPage from "./pages/LoginPage";
import PendaftaranJalurPage from "./pages/PendaftaranJalurPage";
import PendaftaranSuccessPage from "./pages/PendaftaranSuccessPage";
import RoleDummyPage from "./pages/RoleDummyPage";
import DashboardPage from "./pages/DashboardPage";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import SekretarisDashboardPage from "./pages/SekretarisDashboardPage";
import DosenDashboardPage from "./pages/DosenDashboardPage";
import ProfilePage from "./pages/ProfilePage";
import ForcedPasswordChangePage from "./pages/ForcedPasswordChangePage";
import PasswordRecoveryPage from "./pages/PasswordRecoveryPage";

const PRODUCTION_API_BASE_URL = "https://sima-skripsi-rz1j.vercel.app";
const IS_LOCAL_FRONTEND = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || (IS_LOCAL_FRONTEND ? "http://localhost:3000" : PRODUCTION_API_BASE_URL);

function initialResetToken() {
  if (!window.location.hash.startsWith("#reset-password")) return "";
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const token = params.get("token") || "";
  // Remove the secret before any other component, telemetry, or navigation can observe it.
  window.history.replaceState({}, document.title, "/");
  return token;
}

function App() {
  // Access tokens intentionally live only in memory. Reloading the tab requires
  // login again until the HttpOnly refresh-cookie phase is introduced.
  const [auth, setAuth] = useState(null);
  const [authScreen, setAuthScreen] = useState("login");
  const [registrationData, setRegistrationData] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [resetToken, setResetToken] = useState(initialResetToken);

  const session = useMemo(() => ({ token: auth?.token || "", user: auth?.user || null,
    credential_state: auth?.credential_state || null, next_action: auth?.next_action || null,
    prompt_change_password: Boolean(auth?.prompt_change_password) }), [auth]);
  const restricted = Boolean(session.user) && (session.prompt_change_password || session.next_action === "change_password" || ["default", "temporary"].includes(session.credential_state));

  const clearSession = useCallback(() => { setShowProfile(false); setAuth(null); setAuthScreen("login"); }, []);
  const handleLoginSuccess = useCallback((payload) => { setAuth(payload); setAuthScreen("login"); setShowProfile(false); }, []);
  const handleLogout = useCallback(async () => {
    const token = auth?.token;
    clearSession();
    try { if (token) await fetch(`${API_BASE_URL}/api/auth/logout`, { method: "POST", headers: { Authorization: `Bearer ${token}` } }); } catch (_) { /* local logout remains safe */ }
    try { new BroadcastChannel("sima-auth").postMessage({ type: "logout" }); } catch (_) { /* unsupported browser */ }
  }, [auth?.token, clearSession]);
  const handleSessionExpired = useCallback(() => clearSession(), [clearSession]);
  const handlePasswordChanged = useCallback((nextAuth) => { if (nextAuth?.token && nextAuth?.user) setAuth(nextAuth); }, []);

  useEffect(() => {
    let channel;
    try { channel = new BroadcastChannel("sima-auth"); channel.onmessage = (event) => { if (event.data?.type === "logout") clearSession(); }; } catch (_) { return undefined; }
    return () => channel?.close();
  }, [clearSession]);

  useEffect(() => {
    if (!auth?.token || restricted) return undefined;
    let cancelled = false;
    const refreshProfile = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/profile`, { headers: { Authorization: `Bearer ${auth.token}` } });
        const payload = await response.json().catch(() => null);
        if ([401, 403].includes(response.status)) { if (payload?.code === "PASSWORD_CHANGE_REQUIRED") return; handleSessionExpired(); return; }
        if (!response.ok || !payload?.data?.user || cancelled) return;
        setAuth((previous) => previous?.token === auth.token ? { ...previous, user: { ...previous.user, ...payload.data.user } } : previous);
      } catch (_) { /* keep memory session during transient network errors */ }
    };
    refreshProfile(); window.addEventListener("focus", refreshProfile);
    return () => { cancelled = true; window.removeEventListener("focus", refreshProfile); };
  }, [auth?.token, restricted, handleSessionExpired]);

  if (resetToken) {
    return <PasswordRecoveryPage apiBaseUrl={API_BASE_URL} mode="reset" resetToken={resetToken} onComplete={() => { setResetToken(""); window.history.replaceState({}, document.title, "/"); setAuthScreen("login"); }} />;
  }

  if (!session.user) {
    if (authScreen === "forgot") return <PasswordRecoveryPage apiBaseUrl={API_BASE_URL} mode="forgot" onBack={() => setAuthScreen("login")} />;
    if (authScreen === "register") return <PendaftaranJalurPage apiBaseUrl={API_BASE_URL} onBack={() => setAuthScreen("login")}
      onRegisterSuccess={(result) => { setRegistrationData(result || null); setAuthScreen("register-success"); }} />;
    if (authScreen === "register-success") return <PendaftaranSuccessPage registrationData={registrationData} onOpenMahasiswaBaruLogin={() => setAuthScreen("login")} />;
    return <LoginPage apiBaseUrl={API_BASE_URL} onLoginSuccess={handleLoginSuccess} onOpenRegistration={() => setAuthScreen("register")} onForgotPassword={() => setAuthScreen("forgot")} />;
  }

  if (restricted) return <ForcedPasswordChangePage session={session} apiBaseUrl={API_BASE_URL} onPasswordChanged={handlePasswordChanged} onLogout={handleLogout} />;

  let rolePage = <RoleDummyPage session={session} onLogout={handleLogout} />;
  const common = { session, apiBaseUrl: API_BASE_URL, onLogout: handleLogout, onSessionExpired: handleSessionExpired, onOpenProfile: () => setShowProfile(true) };
  if (session.user.role === "mahasiswa") rolePage = <DashboardPage {...common} onPasswordChanged={handlePasswordChanged} />;
  if (session.user.role === "admin") rolePage = <AdminDashboardPage {...common} />;
  if (session.user.role === "dosen") rolePage = <DosenDashboardPage {...common} isSekretaris={(session.user.capabilities || []).includes("sekretaris_prodi")} />;
  if (session.user.role === "sekretaris_prodi") rolePage = <SekretarisDashboardPage {...common} />;
  if (showProfile) return <ProfilePage session={session} apiBaseUrl={API_BASE_URL} onBack={() => setShowProfile(false)} onLogout={handleLogout}
    onSessionExpired={handleSessionExpired} onPasswordChanged={handlePasswordChanged} />;
  return rolePage;
}

export default App;
