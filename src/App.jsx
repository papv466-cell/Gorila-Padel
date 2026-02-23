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
import AuthConfirmPage from './pages/AuthConfirmPage';
import GorilandiaPage from './pages/GorilandiaPage';
import SellerRegister from './pages/SellerRegister';
import SellerDashboard from './pages/SellerDashboard';
import SellerProducts from './pages/SellerProducts';
import SellerProductForm from './pages/SellerProductForm';
import CheckoutPage from './pages/CheckoutPage';
import OrderConfirmed from './pages/OrderConfirmed';
import MyOrders from './pages/MyOrders';
import StoreCatalog from './pages/StoreCatalog';
import ProductDetail from './pages/ProductDetail';
import CartPage from './pages/CartPage';
import CartFloatingButton from './components/UI/CartFloatingButton';
import SellerOrders from './pages/SellerOrders';
import SellerSettings from './pages/SellerSettings';
import PublicProfilePage from './pages/PublicProfilePage';

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
import { Toaster } from 'react-hot-toast';
import { playGorila, unlockGorilaAudio } from "./services/gorilaSound";

// ✅ Guard para rutas privadas
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

  // ✅ Detectar pantallas de auth (sin navbar)
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

  // ✅ Unlock audio (móvil)
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

  // ✅ Mensajes SW
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

      if (type === "PUSH_RECEIVED" || type === "PUSH_CLICKED") {
        playGorila(1);
        const detail = {
          title: data.title || "Gorila Pádel",
          body: data.body || "",
          url: data.url || "/partidos",
        };
        try {
          window.dispatchEvent(new CustomEvent("gp:push", { detail }));
        } catch {}
      }
    };

    navigator.serviceWorker.addEventListener("message", onMsg);
    return () => navigator.serviceWorker.removeEventListener("message", onMsg);
  }, [navigate]);

  if (!sessionReady || !minSplashDone) return <SplashPage />;

  const showBack = !isAuthShell && location.pathname !== "/";
  const onBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/");
  };

  return (
    <div className="appShell">
      {!isAuthShell ? <Navbar showBack={showBack} onBack={onBack} /> : null}

      <main className="appMain">
        {!isAuthShell ? <PWAInstallPrompt /> : null}

        <Routes>
          <Route path="/" element={<HomePage />} />

          {/* TIENDA */}
          <Route path="/tienda" element={<StoreCatalog />} />
          <Route path="/tienda/producto/:slug" element={<ProductDetail />} />
          <Route path="/tienda/carrito" element={<CartPage />} />
          <Route path="/tienda/checkout" element={<CheckoutPage />} />
          <Route path="/tienda/pedido-confirmado" element={<OrderConfirmed />} />
          <Route path="/tienda/mis-pedidos" element={<MyOrders />} />

          {/* VENDEDOR */}
          <Route path="/vendedor/registro" element={<SellerRegister />} />
          <Route path="/vendedor/dashboard" element={<SellerDashboard />} />
          <Route path="/vendedor/productos" element={<SellerProducts />} />
          <Route path="/vendedor/productos/nuevo" element={<SellerProductForm />} />
          <Route path="/vendedor/productos/:id" element={<SellerProductForm />} />
          <Route path="/vendedor/pedidos" element={<SellerOrders />} />
          <Route path="/vendedor/perfil" element={<SellerSettings />} />
          {/* GORILANDIA */}
          <Route path="/gorilandia" element={<GorilandiaPage />} />
          <Route path="/usuario/:userId" element={<PublicProfilePage />} />

          {/* AUTH */}
          <Route path="/auth/confirm" element={<AuthConfirmPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/registro" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* PRIVADAS */}
          <Route path="/mapa" element={<RequireAuth session={session}><MapPage /></RequireAuth>} />
          <Route path="/partidos" element={<RequireAuth session={session}><MatchesPage /></RequireAuth>} />
          <Route path="/clases" element={<RequireAuth session={session}><ClassesPage /></RequireAuth>} />
          <Route path="/inclusivos" element={<RequireAuth session={session}><InclusiveMatchesPage /></RequireAuth>} />
          <Route path="/perfil" element={<RequireAuth session={session}><ProfilePage /></RequireAuth>} />
          <Route path="/profesores" element={<RequireAuth session={session}><TeachersPage /></RequireAuth>} />
          <Route path="/profesores/:id" element={<RequireAuth session={session}><TeacherProfilePage /></RequireAuth>} />
          <Route path="/juega" element={<RequireAuth session={session}><PlayHubPage /></RequireAuth>} />
          <Route path="/aprende" element={<RequireAuth session={session}><LearnHubPage /></RequireAuth>} />

          {/* REDIRECTS */}
          <Route path="/play" element={<Navigate to="/juega" replace />} />
          <Route path="/profile" element={<Navigate to="/perfil" replace />} />
          <Route path="/inclusivo" element={<Navigate to="/inclusivos" replace />} />
          <Route path="/store" element={<Navigate to="/tienda" replace />} />
          <Route path="/store/:any" element={<Navigate to="/tienda" replace />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* Botón flotante carrito */}
      {!isAuthShell && <CartFloatingButton />}

      {/* Toast */}
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#1a1a1a',
            color: '#fff',
            border: '1px solid #252525',
            borderRadius: '12px',
            padding: '16px',
            fontSize: '14px',
            fontFamily: 'Outfit, sans-serif',
          },
          success: {
            iconTheme: { primary: '#74B800', secondary: '#000' },
          },
          error: {
            iconTheme: { primary: '#FF4444', secondary: '#fff' },
          },
        }}
      />
    </div>
  );
}