// @refresh reset
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

import Navbar from "./components/UI/Navbar";
import { supabase } from "./services/supabaseClient";
import PWAInstallPrompt from "./components/PWAInstallPrompt";

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();

  const [session, setSession] = useState(null);
  const [sessionReady, setSessionReady] = useState(false);

  // Splash mínimo 4.5s SIEMPRE al arrancar
  const [splashDone, setSplashDone] = useState(false);

  // 1) Timer splash
  useEffect(() => {
    setSplashDone(false);
    const t = setTimeout(() => setSplashDone(true), 4500);
    return () => clearTimeout(t);
  }, []);

  // 2) Sesión
  useEffect(() => {
    let alive = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session ?? null);
      setSessionReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession ?? null);
      setSessionReady(true);
    });

    return () => {
      alive = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  // Rutas "auth shell" (sin navbar)
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

  // Solo login/registro deben redirigir si ya hay sesión
  const isLoginOrRegister = useMemo(() => {
    const p = location.pathname;
    return p === "/login" || p === "/register" || p === "/registro";
  }, [location.pathname]);

  // ✅ Si estás logueada y estás en login/registro, te saco al mapa (pero NO en reset-password)
  useEffect(() => {
    if (!sessionReady) return;
    if (!session) return;
    if (!isLoginOrRegister) return;
    navigate("/mapa", { replace: true });
  }, [sessionReady, session, isLoginOrRegister, navigate]);

  if (!splashDone || !sessionReady) return <SplashPage />;

  return (
    <div className="appShell">
      {!isAuthShell ? <Navbar /> : null}

      <main className="appMain">
        <PWAInstallPrompt />

        <Routes>
          <Route path="/" element={<Navigate to={session ? "/mapa" : "/login"} replace />} />

          <Route path="/mapa" element={<MapPage />} />
          <Route path="/partidos" element={<MatchesPage />} />
          <Route path="/clases" element={<ClassesPage />} />

          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/registro" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          <Route path="/pwa" element={<PWAInstallPrompt />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
