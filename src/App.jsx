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

import Navbar from "./components/UI/Navbar";
import { supabase } from "./services/supabaseClient";
import PWAInstallPrompt from "./components/PWAInstallPrompt";

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();

  const [session, setSession] = useState(null);
  const [sessionReady, setSessionReady] = useState(false);

  // ✅ Splash SIEMPRE 4.5s al arrancar (pero si ya estamos dentro y llega push, NO recargamos gracias al SW message)
  const [splashDone, setSplashDone] = useState(false);
  useEffect(() => {
    setSplashDone(false);
    const t = setTimeout(() => setSplashDone(true), 4500);
    return () => clearTimeout(t);
  }, []);

  // ✅ Sesión
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

  // ✅ RECIBIR MENSAJES DEL SERVICE WORKER (click en notificación)
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const onMsg = (event) => {
      const data = event?.data;
      if (!data || data.type !== "NAVIGATE") return;

      const url = String(data.url || "");
      if (!url) return;

      // Navegación SPA sin reload => sin splash
      navigate(url, { replace: false });
    };

    navigator.serviceWorker.addEventListener("message", onMsg);
    return () => navigator.serviceWorker.removeEventListener("message", onMsg);
  }, [navigate]);

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

  // ✅ Si hay sesión y estás en auth → al mapa
  useEffect(() => {
    if (!sessionReady) return;
    if (!session) return;

    const p = location.pathname;
    const inAuth =
      p.startsWith("/login") ||
      p.startsWith("/register") ||
      p.startsWith("/registro") ||
      p.startsWith("/forgot-password") ||
      p.startsWith("/reset-password");

    if (inAuth) navigate("/mapa", { replace: true });
  }, [sessionReady, session, location.pathname, navigate]);

  // ✅ Mientras: SOLO splash (nada más)
  if (!splashDone || !sessionReady) return <SplashPage />;

  return (
    <div className="appShell">
      {!isAuthShell ? <Navbar /> : null}

      <main className="appMain">
        {!isAuthShell ? <PWAInstallPrompt /> : null}

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

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
