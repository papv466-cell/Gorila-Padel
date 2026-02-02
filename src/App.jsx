// src/App.jsx
import { useEffect, useMemo, useState } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";

import MapPage from "./pages/MapPage";
import MatchesPage from "./pages/MatchesPage";
import ClassesPage from "./pages/ClassesPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import SplashPage from "./pages/SplashPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import ProfilePage from "./pages/ProfilePage";

import HomePage from "./pages/HomePage";
import PlayHubPage from "./pages/PlayHubPage";
import LearnHubPage from "./pages/LearnHubPage";
import InclusivePage from "./pages/InclusivePage";

import TeachersPage from "./pages/TeachersPage";
import TeacherProfilePage from "./pages/TeacherProfilePage";
import InclusiveMatchesPage from "./pages/InclusiveMatchesPage";

import Navbar from "./components/UI/Navbar";
import { supabase } from "./services/supabaseClient";
import PWAInstallPrompt from "./components/PWAInstallPrompt";

// 🦍🔊 sonido
import { playGorila, unlockGorilaAudio } from "./services/gorilaSound";

// ✅ Guard para rutas privadas
function RequireAuth({ session, children }) {
  const location = useLocation();
  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return children;
}

// ✅ Botón global "Atrás"
function GlobalBackButton({ hidden }) {
  const navigate = useNavigate();
  if (hidden) return null;

  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) navigate(-1);
        else navigate("/");
      }}
      title="Atrás"
      style={{
        position: "fixed",
        left: 14,
        top: 14,
        zIndex: 99999,
        width: 46,
        height: 46,
        borderRadius: 16,
        border: "2px solid #111",
        background: "#fff",
        color: "#111",
        boxShadow: "0 18px 40px rgba(0,0,0,0.25)",
        fontWeight: 950,
        cursor: "pointer",
        display: "grid",
        placeItems: "center",
        userSelect: "none",
      }}
    >
      ←
    </button>
  );
}

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();

  const [session, setSession] = useState(null);
  const [sessionReady, setSessionReady] = useState(false);

  // ✅ Splash mínimo (evita parpadeo)
  const [minSplashDone, setMinSplashDone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMinSplashDone(true), 350);
    return () => clearTimeout(t);
  }, []);

  // ✅ Sesión Supabase
  useEffect(() => {
    let alive = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!alive) return;
      if (!error) setSession(data.session ?? null);
      setSessionReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!alive) return;
      setSession(newSession ?? null);
      setSessionReady(true);
    });

    return () => {
      alive = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  // ✅ Detectar “pantallas de auth” (sin navbar)
  const isAuthShell = useMemo(() => {
    const p = location.pathname;
    return (
      p.startsWith("/login") ||
      p.startsWith("/register") ||
      p.startsWith("/registro") ||
      p.startsWith("/forgot-password") ||
      p.startsWith("/reset-password")
    );
  }, [location.pathname]);

  // ✅ Si ya hay sesión y estás en auth -> HOME
  useEffect(() => {
    if (!sessionReady) return;
    if (!session) return;
    if (!isAuthShell) return;
    navigate("/", { replace: true });
  }, [sessionReady, session, isAuthShell, navigate]);

  // ✅ Unlock de audio con el primer toque/click (necesario en móviles)
  useEffect(() => {
    const unlock = () => {
      unlockGorilaAudio().catch(() => {});
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };

    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });

    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  // ✅ Mensajes desde Service Worker:
  // - NAVIGATE: navegar sin reload
  // - PUSH_RECEIVED / PUSH_CLICKED: sonar gorila + mostrar toast en app abierta
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const onMsg = (event) => {
      const data = event?.data || {};
      const type = String(data.type || "");

      if (type === "NAVIGATE") {
        const url = String(data.url || "");
        if (url) navigate(url, { replace: false });
        return;
      }

      // 🔊 + 🔔 (toast dentro de la app abierta)
      if (type === "PUSH_RECEIVED" || type === "PUSH_CLICKED") {
        // 1) sonido gorila (una vez por notificación)
        playGorila(1);

        // 2) toast dentro de la app (MatchesPage escucha "gp:push")
        const detail = {
          title: data.title || "Gorila Pádel",
          body: data.body || "",
          url: data.url || (type === "PUSH_CLICKED" ? "/partidos" : "/partidos"),
        };

        try {
          window.dispatchEvent(new CustomEvent("gp:push", { detail }));
        } catch {}

        return;
      }
    };

    navigator.serviceWorker.addEventListener("message", onMsg);
    return () => navigator.serviceWorker.removeEventListener("message", onMsg);
  }, [navigate]);

  // ✅ Splash
  if (!sessionReady || !minSplashDone) return <SplashPage />;

  // ✅ Ocultamos el botón en Home y en auth
  const hideBackButton = isAuthShell || location.pathname === "/";

  return (
    <div className="appShell">
      {!isAuthShell ? <Navbar /> : null}

      <GlobalBackButton hidden={hideBackButton} />

      <main className="appMain">
        {!isAuthShell ? <PWAInstallPrompt /> : null}

        <Routes>
          {/* ✅ Portada */}
          <Route path="/" element={<HomePage />} />

          {/* ✅ Hubs (PRIVADOS) */}
          <Route
            path="/juega"
            element={
              <RequireAuth session={session}>
                <PlayHubPage />
              </RequireAuth>
            }
          />
          <Route
            path="/aprende"
            element={
              <RequireAuth session={session}>
                <LearnHubPage />
              </RequireAuth>
            }
          />
          <Route
            path="/inclusivo"
            element={
              <RequireAuth session={session}>
                <InclusivePage />
              </RequireAuth>
            }
          />

          {/* ✅ Privadas */}
          <Route
            path="/mapa"
            element={
              <RequireAuth session={session}>
                <MapPage />
              </RequireAuth>
            }
          />

          <Route
            path="/inclusivos"
            element={
              <RequireAuth session={session}>
                <InclusiveMatchesPage />
              </RequireAuth>
            }
          />

          <Route
            path="/partidos"
            element={
              <RequireAuth session={session}>
                <MatchesPage />
              </RequireAuth>
            }
          />

          <Route
            path="/clases"
            element={
              <RequireAuth session={session}>
                <ClassesPage />
              </RequireAuth>
            }
          />

          {/* ✅ Profesores */}
          <Route
            path="/profesores"
            element={
              <RequireAuth session={session}>
                <TeachersPage />
              </RequireAuth>
            }
          />
          <Route
            path="/profesores/:id"
            element={
              <RequireAuth session={session}>
                <TeacherProfilePage />
              </RequireAuth>
            }
          />

          {/* ✅ Perfil */}
          <Route
            path="/perfil"
            element={
              <RequireAuth session={session}>
                <ProfilePage />
              </RequireAuth>
            }
          />
          <Route path="/profile" element={<Navigate to="/perfil" replace />} />

          {/* ✅ Públicas */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/registro" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
