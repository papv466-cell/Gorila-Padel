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

import TeachersPage from "./pages/TeachersPage";
import TeacherProfilePage from "./pages/TeacherProfilePage";

import InclusiveMatchesPage from "./pages/InclusiveMatchesPage";

import Navbar from "./components/UI/Navbar";
import { supabase } from "./services/supabaseClient";
import PWAInstallPrompt from "./components/PWAInstallPrompt";

// ✅ Guard para rutas privadas (vuelve a la ruta original tras login)
function RequireAuth({ session, children }) {
  const location = useLocation();
  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return children;
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

  // ✅ Si ya hay sesión y estás en auth -> mapa
  useEffect(() => {
    if (!sessionReady) return;
    if (!session) return;
    if (!isAuthShell) return;
    navigate("/mapa", { replace: true });
  }, [sessionReady, session, isAuthShell, navigate]);

  // ✅ Click en notificación => navegar sin reload
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const onMsg = (event) => {
      const data = event?.data;
      if (!data || data.type !== "NAVIGATE") return;

      const url = String(data.url || "");
      if (!url) return;

      navigate(url, { replace: false });
    };

    navigator.serviceWorker.addEventListener("message", onMsg);
    return () => navigator.serviceWorker.removeEventListener("message", onMsg);
  }, [navigate]);

  // ✅ Splash
  if (!sessionReady || !minSplashDone) return <SplashPage />;

  return (
    <div className="appShell">
      {!isAuthShell ? <Navbar /> : null}

      <main className="appMain">
        {!isAuthShell ? <PWAInstallPrompt /> : null}

        <Routes>
          <Route path="/" element={<Navigate to={session ? "/mapa" : "/login"} replace />} />

          {/* ✅ Rutas privadas */}
          <Route
            path="/mapa"
            element={
              <RequireAuth session={session}>
                <MapPage />
              </RequireAuth>
            }
          />

          {/* ✅ Inclusivos (PRIVADO) */}
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

          {/* ✅ Perfil (una ruta canónica) */}
          <Route
            path="/perfil"
            element={
              <RequireAuth session={session}>
                <ProfilePage />
              </RequireAuth>
            }
          />
          <Route path="/profile" element={<Navigate to="/perfil" replace />} />

          {/* ✅ Rutas públicas */}
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
