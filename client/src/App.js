import React, { useEffect, useMemo, useRef, useState } from "react";
import LoginPage from "./pages/LoginPage";
import PendaftaranJalurPage from "./pages/PendaftaranJalurPage";
import PendaftaranSuccessPage from "./pages/PendaftaranSuccessPage";
import MahasiswaRegistrasiLoginPage from "./pages/MahasiswaRegistrasiLoginPage";
import RoleDummyPage from "./pages/RoleDummyPage";
import DashboardPage from "./pages/DashboardPage";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import SekretarisDashboardPage from "./pages/SekretarisDashboardPage";
import DosenDashboardPage from "./pages/DosenDashboardPage";
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";

const AUTH_STORAGE_KEY = "sima_auth_v1";
const PRODUCTION_API_BASE_URL = "https://sima-skripsi-rz1j.vercel.app";
const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL ||
  (window.location.hostname === "localhost" ? "http://localhost:3000" : PRODUCTION_API_BASE_URL);

function decodeJwtPayload(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;

  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    return JSON.parse(window.atob(padded));
  } catch (error) {
    return null;
  }
}

function isTokenExpired(token) {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return false;
  const nowInSeconds = Math.floor(Date.now() / 1000);
  return payload.exp <= nowInSeconds;
}

function parseAuth(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.token || !parsed?.user?.role) return null;
    if (isTokenExpired(parsed.token)) return null;
    return parsed;
  } catch (error) {
    return null;
  }
}

function loadAuth() {
  return parseAuth(sessionStorage.getItem(AUTH_STORAGE_KEY)) || parseAuth(localStorage.getItem(AUTH_STORAGE_KEY));
}

function clearAuthStorage() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  sessionStorage.removeItem(AUTH_STORAGE_KEY);
}

function updateStoredAuthPromptFlag(token, promptFlag) {
  const updateStorage = (storage) => {
    const raw = storage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return false;

    try {
      const parsed = JSON.parse(raw);
      if (!parsed?.token || parsed.token !== token) return false;
      const next = { ...parsed, prompt_change_password: promptFlag };
      storage.setItem(AUTH_STORAGE_KEY, JSON.stringify(next));
      return true;
    } catch (error) {
      return false;
    }
  };

  const localUpdated = updateStorage(localStorage);
  const sessionUpdated = updateStorage(sessionStorage);
  return localUpdated || sessionUpdated;
}

function updateStoredAuthUser(token, user) {
  const updateStorage = (storage) => {
    const raw = storage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return false;

    try {
      const parsed = JSON.parse(raw);
      if (!parsed?.token || parsed.token !== token) return false;
      const next = { ...parsed, user };
      storage.setItem(AUTH_STORAGE_KEY, JSON.stringify(next));
      return true;
    } catch (error) {
      return false;
    }
  };

  const localUpdated = updateStorage(localStorage);
  const sessionUpdated = updateStorage(sessionStorage);
  return localUpdated || sessionUpdated;
}

function shallowEqualObjects(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => Object.is(a[key], b[key]));
}

function saveAuth(authPayload, rememberMe) {
  const value = JSON.stringify(authPayload);
  sessionStorage.setItem(AUTH_STORAGE_KEY, value);
  if (rememberMe) {
    localStorage.setItem(AUTH_STORAGE_KEY, value);
    return;
  }
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

function App() {
  const [auth, setAuth] = useState(() => loadAuth());
  const [showDefaultPasswordToast, setShowDefaultPasswordToast] = useState(false);
  const [authScreen, setAuthScreen] = useState("login");
  const [registrasiLoginNimPrefill, setRegistrasiLoginNimPrefill] = useState("");
  const [registrationData, setRegistrationData] = useState(null);
  const defaultPasswordToastTokenRef = useRef("");

  const session = useMemo(
    () => ({
      token: auth?.token || "",
      user: auth?.user || null,
      prompt_change_password: auth?.prompt_change_password || false,
    }),
    [auth]
  );

  const handleLoginSuccess = ({ token, user, prompt_change_password }, rememberMe) => {
    const payload = { token, user, prompt_change_password };
    saveAuth(payload, rememberMe);
    setAuth(payload);
    setAuthScreen("login");
  };

  const handleLogout = () => {
    clearAuthStorage();
    defaultPasswordToastTokenRef.current = "";
    setShowDefaultPasswordToast(false);
    setAuth(null);
  };

  const handleSessionExpired = () => {
    clearAuthStorage();
    defaultPasswordToastTokenRef.current = "";
    setShowDefaultPasswordToast(false);
    setAuth(null);
    setAuthScreen("login");
  };

  const handlePasswordChanged = () => {
    setAuth((prev) => {
      if (!prev?.token) return prev;
      const next = { ...prev, prompt_change_password: false };
      defaultPasswordToastTokenRef.current = prev.token;
      updateStoredAuthPromptFlag(prev.token, false);
      return next;
    });
  };

  useEffect(() => {
    if (session.user && session.prompt_change_password && defaultPasswordToastTokenRef.current !== session.token) {
      defaultPasswordToastTokenRef.current = session.token;
      setShowDefaultPasswordToast(true);
      return;
    }

    if (!session.user) {
      defaultPasswordToastTokenRef.current = "";
      setShowDefaultPasswordToast(false);
    }
  }, [session.user, session.prompt_change_password, session.token]);

  useEffect(() => {
    if (!showDefaultPasswordToast) return;

    Swal.fire({
      toast: true,
      position: "top-end",
      icon: "warning",
      title: "Password Masih Default",
      text: "Demi keamanan akun, segera ganti password default Anda di menu ubah password.",
      showConfirmButton: false,
      showCloseButton: true,
      timer: 7000,
      timerProgressBar: true,
      didOpen: (toast) => {
        toast.addEventListener("mouseenter", Swal.stopTimer);
        toast.addEventListener("mouseleave", Swal.resumeTimer);
      },
    }).finally(() => {
      setShowDefaultPasswordToast(false);
    });
  }, [showDefaultPasswordToast]);

  useEffect(() => {
    if (!auth?.token) return undefined;

    let cancelled = false;
    const refreshProfile = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/profile`, {
          headers: {
            Authorization: `Bearer ${auth.token}`,
            "Content-Type": "application/json",
          },
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success || !payload?.data?.user) {
          if (response.status === 401 || response.status === 403) {
            handleSessionExpired();
          }
          return;
        }

        if (cancelled) return;
        setAuth((prev) => {
          if (!prev?.token || prev.token !== auth.token) return prev;
          const nextUser = {
            ...prev.user,
            ...payload.data.user,
          };
          if (shallowEqualObjects(prev.user, nextUser)) return prev;
          const next = { ...prev, user: nextUser };
          updateStoredAuthUser(prev.token, nextUser);
          return next;
        });
      } catch (profileError) {
        // Profile refresh is a sync helper; keep the current session if the network hiccups.
      }
    };

    refreshProfile();
    window.addEventListener("focus", refreshProfile);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", refreshProfile);
    };
  }, [auth?.token]);

  if (!session.user) {
    if (authScreen === "register") {
      return (
        <PendaftaranJalurPage
          apiBaseUrl={API_BASE_URL}
          onBack={() => setAuthScreen("login")}
          onRegisterSuccess={(result) => {
            setRegistrationData(result || null);
            setRegistrasiLoginNimPrefill(result?.akun_login?.username || result?.registered_nim || "");
            setAuthScreen("register-success");
          }}
        />
      );
    }

    if (authScreen === "register-success") {
      return (
        <PendaftaranSuccessPage
          registrationData={registrationData}
          onOpenMahasiswaBaruLogin={(nimValue) => {
            setRegistrasiLoginNimPrefill(nimValue || "");
            setAuthScreen("registrasi-login");
          }}
        />
      );
    }

    if (authScreen === "registrasi-login") {
      return (
        <MahasiswaRegistrasiLoginPage
          apiBaseUrl={API_BASE_URL}
          initialNim={registrasiLoginNimPrefill}
          onBack={() => setAuthScreen("login")}
          onLoginSuccess={handleLoginSuccess}
        />
      );
    }

    return (
      <LoginPage
        apiBaseUrl={API_BASE_URL}
        onLoginSuccess={handleLoginSuccess}
        onOpenRegistration={() => setAuthScreen("register")}
      />
    );
  }

  let rolePage = <RoleDummyPage session={session} onLogout={handleLogout} />;

  if (session.user.role === "mahasiswa") {
    rolePage = (
      <DashboardPage
        session={session}
        apiBaseUrl={API_BASE_URL}
        onLogout={handleLogout}
        onSessionExpired={handleSessionExpired}
        onPasswordChanged={handlePasswordChanged}
      />
    );
  }
  if (session.user.role === "admin") {
    rolePage = (
      <AdminDashboardPage
        session={session}
        apiBaseUrl={API_BASE_URL}
        onLogout={handleLogout}
        onSessionExpired={handleSessionExpired}
      />
    );
  }
  if (session.user.role === "dosen") {
    const capabilities = Array.isArray(session.user.capabilities) ? session.user.capabilities : [];
    rolePage = (
      <DosenDashboardPage
        session={session}
        apiBaseUrl={API_BASE_URL}
        onLogout={handleLogout}
        onSessionExpired={handleSessionExpired}
        isSekretaris={capabilities.includes("sekretaris_prodi")}
      />
    );
  }
  if (session.user.role === "sekretaris_prodi") {
    rolePage = (
      <SekretarisDashboardPage
        session={session}
        apiBaseUrl={API_BASE_URL}
        onLogout={handleLogout}
        onSessionExpired={handleSessionExpired}
      />
    );
  }

  return (
    <>
      {rolePage}
    </>
  );
}

export default App;
