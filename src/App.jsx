// src/App.jsx
import { useEffect, useMemo, useState } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import ClubAdminPage from "./pages/ClubAdminPage";

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
import RankingPage from "./pages/RankingPage";
import LeaguePage from "./pages/LeaguePage";
import CourtCheckoutPage from "./pages/CourtCheckoutPage";
import OnboardingModal from "./components/OnboardingModal";
import ClubPage from "./pages/ClubPage";
import toast, { Toaster } from 'react-hot-toast';

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
import { unlockGorilaAudio } from "./services/gorilaSound";

// ✅ Guard para rutas privadas
function RequireAuth({ session, children }) {
  const location = useLocation();
  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return children;
}

// ✅ Reproducir sonido gorila con gesto garantizado
async function sonarGorila() {
  try {
    const audio = new Audio(`${window.location.origin}/sounds/gorila.mp3`);
    audio.volume = 1.0;
    await audio.play();
  } catch {
    try {
      await unlockGorilaAudio();
      const audio2 = new Audio(`${window.location.origin}/sounds/gorila.mp3`);
      audio2.volume = 1.0;
      await audio2.play();
    } catch {}
  }
}

export default function App() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingSession, setOnboardingSession] = useState(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        try {
          const { data: profile } = await supabase.from("profiles")
            .select("onboarding_done").eq("id", session.user.id).maybeSingle();
          if (profile && !profile.onboarding_done) {
            setOnboardingSession(session);
            setShowOnboarding(true);
          }
        } catch(e) { console.warn("onboarding check failed:", e); }
      }
    });
    return () => subscription.unsubscribe();
  }, []);
  const location = useLocation();
  const navigate = useNavigate();

  const [session, setSession] = useState(null);
  const [sessionReady, setSessionReady] = useState(false);

  const [minSplashDone, setMinSplashDone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMinSplashDone(true), 350);
    return () => clearTimeout(t);
  }, []);

  // ✅ Refrescar sesión cuando la página vuelve a estar visible
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        try {
          const { data, error } = await supabase.auth.getSession();
          if (!error && data.session) {
            setSession(data.session);
          } else if (!data.session) {
            // Intentar refresh
            const { data: refreshed } = await supabase.auth.refreshSession();
            if (refreshed.session) {
              setSession(refreshed.session);
            }
          }
        } catch {}
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // ✅ Sesión Supabase
  useEffect(() => {
    let alive = true;

    // Timeout de seguridad: si en 5s no responde Supabase, salimos del splash
    const safetyTimer = setTimeout(() => {
      if (alive && !sessionReady) setSessionReady(true);
    }, 5000);

    supabase.auth.getSession().then(({ data, error }) => {
      if (!alive) return;
      clearTimeout(safetyTimer);
      if (!error) setSession(data.session ?? null);
      setSessionReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!alive) return;
      setSession(newSession ?? null);
      setSessionReady(true);
      // Si el token expira y no puede refrescarse, redirigir al login
      if (!newSession && _event === 'SIGNED_OUT') {
        navigate('/login', { replace: true });
      }
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

  // ✅ Registrar push subscription
  useEffect(() => {
    if (!session?.user?.id) return;
    import("./services/push").then(({ ensurePushSubscription }) => {
      ensurePushSubscription().catch(() => {});
    });
  }, [session?.user?.id]);

  // ✅ Guardar última ubicación del usuario
  useEffect(() => {
    if (!session?.user?.id) return;
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async pos => {
      try {
        const { supabase } = await import("./services/supabaseClient");
        await supabase.from("profiles").update({
          last_lat: pos.coords.latitude,
          last_lng: pos.coords.longitude,
        }).eq("id", session.user.id);
      } catch {}
    }, () => {}, { timeout: 10000 });
  }, [session?.user?.id]);

  // ✅ Unlock audio (móvil) — primer gesto
  useEffect(() => {
    const unlock = () => {
      unlockGorilaAudio().catch(() => {});
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  // ✅ Mensajes SW — toast clickable con sonido gorila
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const onMsg = (event) => {
      const data = event?.data || {};
      const type = String(data.type || "");

      // Navegación directa (desde click en notificación del sistema)
      if (type === "NAVIGATE") {
        const url = String(data.url || "");
        if (url) navigate(url, { replace: false });
        return;
      }

      // Push recibido con app abierta → toast clickable
      if (type === "PUSH_RECEIVED") {
        const title = data.title || "Gorila Pádel 🦍";
        const body = data.body || "";
        const url = data.url || "/partidos";

        toast(
          (t) => (
            <div
              onClick={() => {
                toast.dismiss(t.id);
                sonarGorila();
                navigate(url);
              }}
              style={{ cursor: "pointer", width: "100%" }}
            >
              <div style={{ fontWeight: 700, marginBottom: 2 }}>{title}</div>
              {body && <div style={{ opacity: 0.8, fontSize: 13 }}>{body}</div>}
            </div>
          ),
          {
            duration: 6000,
            icon: "🦍",
            style: {
              background: '#1a1a1a',
              color: '#fff',
              border: '1px solid #74B800',
              borderRadius: '12px',
              padding: '14px 16px',
              fontSize: '14px',
              fontFamily: 'Outfit, sans-serif',
              cursor: 'pointer',
            },
          }
        );
        return;
      }

      // PUSH_CLICKED → viene del click en notificación del sistema cuando app estaba abierta
      if (type === "PUSH_CLICKED") {
        sonarGorila();
        const url = data.url || "/partidos";
        if (url) navigate(url, { replace: false });
        return;
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
          <Route path="/club-admin" element={<RequireAuth session={session}><ClubAdminPage /></RequireAuth>} />
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
          <Route path="/ranking" element={<RankingPage />} />
            <Route path="/ligas" element={<LeaguePage />} />
            <Route path="/reserva/pago" element={<CourtCheckoutPage />} />
          <Route path="/club/:clubId" element={<ClubPage />} />
        </Routes>
      </main>

      {/* Botón flotante carrito */}
      {!isAuthShell && <CartFloatingButton />}

      {/* Toast */}
      <Toaster
        position="top-center"
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
      {showOnboarding && onboardingSession && (
        <OnboardingModal
          session={onboardingSession}
          onClose={() => { setShowOnboarding(false); setOnboardingSession(null); }}
        />
      )}
    </div>
  );
}