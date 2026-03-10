// src/App.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import ClubAdminPage from "./pages/ClubAdminPage";
import ClubRegisterPage from "./pages/ClubRegisterPage";
import SuperAdminPage from "./pages/SuperAdminPage";
import ChallengesPage from "./pages/ChallengesPage";
import PullsPage from "./pages/PullsPage";
import JuegazPlusPage from "./pages/JuegazPlusPage";
import TrainingsPage from "./pages/TrainingsPage";

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
import LeaderboardPage from "./pages/LeaderboardPage";
import FindPlayersPage from "./pages/FindPlayersPage";
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
import GorilaStack from "./pages/GorilaStack";

import Navbar from "./components/UI/Navbar";
import { supabase } from "./services/supabaseClient";
import { useSession } from "./contexts/SessionContext";
import PWAInstallPrompt from "./components/PWAInstallPrompt";
import { unlockGorilaAudio } from "./services/gorilaSound";

function RequireAuth({ session, sessionReady, children }) {
  const location = useLocation();
  if (!sessionReady) return null;
  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return children;
}

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
  const location = useLocation();
  const navigate = useNavigate();

  const { session, sessionReady } = useSession();

  const [minSplashDone, setMinSplashDone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMinSplashDone(true), 350);
    return () => clearTimeout(t);
  }, []);

  // Onboarding: detectar nuevo login
  useEffect(() => {
    if (!session?.user?.id) return;
    supabase.from("profiles")
      .select("onboarding_done").eq("id", session.user.id).maybeSingle()
      .then(({ data: profile }) => {
        if (profile && !profile.onboarding_done) {
          setOnboardingSession(session);
          setShowOnboarding(true);
        }
      }).catch(() => {});
  }, [session?.user?.id]);

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

  // Redirigir a / si ya tienes sesión y estás en pantalla de auth
  useEffect(() => {
    if (!sessionReady) return;
    if (!session) return;
    if (!isAuthShell) return;
    navigate("/", { replace: true });
  }, [sessionReady, session, isAuthShell, navigate]);

  // Detectar vuelta al foco
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        supabase.auth.getSession().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;
    import("./services/push").then(({ ensurePushSubscription }) => {
      ensurePushSubscription().catch(() => {});
    });
  }, [session?.user?.id]);

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

  useEffect(() => {
    const unlock = () => { unlockGorilaAudio().catch(() => {}); };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

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
      if (type === "PUSH_RECEIVED") {
        const title = data.title || "Gorila Pádel 🦍";
        const body = data.body || "";
        const url = data.url || "/partidos";
        toast(
          (t) => (
            <div onClick={() => { toast.dismiss(t.id); sonarGorila(); navigate(url); }} style={{ cursor: "pointer", width: "100%" }}>
              <div style={{ fontWeight: 700, marginBottom: 2 }}>{title}</div>
              {body && <div style={{ opacity: 0.8, fontSize: 13 }}>{body}</div>}
            </div>
          ),
          { duration: 6000, icon: "🦍", style: { background: '#1a1a1a', color: '#fff', border: '1px solid #74B800', borderRadius: '12px', padding: '14px 16px', fontSize: '14px', fontFamily: 'Outfit, sans-serif', cursor: 'pointer' } }
        );
        return;
      }
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

  // ✅ FIX: SIGNED_OUT — solo redirigir si sessionReady=true Y session lleva
  // al menos un render siendo null (evita redirect en carga inicial)
  const sessionWasReadyRef = useRef(false);
  useEffect(() => {
    if (!sessionReady) return;
    if (session !== null) {
      // Hay sesión — marcar que existió y resetear el flag
      sessionWasReadyRef.current = true;
      try { localStorage.setItem('sb-session-existed', '1'); } catch {}
      return;
    }
    // session === null Y sessionReady === true
    // Solo redirigir si ya habíamos tenido sesión antes en esta carga de página
    if (!sessionWasReadyRef.current) return;
    if (isAuthShell) return;
    try { localStorage.removeItem('sb-session-existed'); } catch {}
    navigate('/login', { replace: true });
  }, [session, sessionReady, isAuthShell, navigate]);

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
          <Route path="/" element={<HomePage session={session} />} />
          <Route path="/tienda" element={<StoreCatalog />} />
          <Route path="/tienda/producto/:slug" element={<ProductDetail />} />
          <Route path="/tienda/carrito" element={<CartPage />} />
          <Route path="/tienda/checkout" element={<CheckoutPage />} />
          <Route path="/tienda/pedido-confirmado" element={<OrderConfirmed />} />
          <Route path="/tienda/mis-pedidos" element={<MyOrders />} />
          <Route path="/vendedor/registro" element={<SellerRegister />} />
          <Route path="/vendedor/dashboard" element={<SellerDashboard />} />
          <Route path="/vendedor/productos" element={<SellerProducts />} />
          <Route path="/vendedor/productos/nuevo" element={<SellerProductForm />} />
          <Route path="/vendedor/productos/:id" element={<SellerProductForm />} />
          <Route path="/vendedor/pedidos" element={<SellerOrders />} />
          <Route path="/vendedor/perfil" element={<SellerSettings />} />
          <Route path="/gorilandia" element={<GorilandiaPage session={session} />} />          <Route path="/usuario/:userId" element={<PublicProfilePage />} />
          <Route path="/auth/confirm" element={<AuthConfirmPage />} />
          <Route path="/juega-plus" element={<RequireAuth session={session} sessionReady={sessionReady}><JuegazPlusPage session={session} /></RequireAuth>} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/entrenamientos" element={<RequireAuth session={session} sessionReady={sessionReady}><TrainingsPage session={session} /></RequireAuth>} />
          <Route path="/retos" element={<RequireAuth session={session} sessionReady={sessionReady}><ChallengesPage session={session} /></RequireAuth>} />
          <Route path="/pulls" element={<RequireAuth session={session} sessionReady={sessionReady}><PullsPage session={session} /></RequireAuth>} />
          <Route path="/registro" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/mapa" element={<RequireAuth session={session} sessionReady={sessionReady}><MapPage session={session} /></RequireAuth>} />
          <Route path="/partidos" element={<RequireAuth session={session} sessionReady={sessionReady}><MatchesPage session={session} /></RequireAuth>} />
          <Route path="/clases" element={<RequireAuth session={session} sessionReady={sessionReady}><ClassesPage session={session} /></RequireAuth>} />
          <Route path="/inclusivos" element={<RequireAuth session={session} sessionReady={sessionReady}><InclusiveMatchesPage session={session} /></RequireAuth>} />
          <Route path="/perfil" element={<RequireAuth session={session} sessionReady={sessionReady}><ProfilePage session={session} /></RequireAuth>} />
          <Route path="/club-admin" element={<RequireAuth session={session} sessionReady={sessionReady}><ClubAdminPage /></RequireAuth>} />
          <Route path="/registrar-club" element={<RequireAuth session={session} sessionReady={sessionReady}><ClubRegisterPage /></RequireAuth>} />
          <Route path="/super-admin" element={<RequireAuth session={session} sessionReady={sessionReady}><SuperAdminPage /></RequireAuth>} />
          <Route path="/profesores" element={<RequireAuth session={session} sessionReady={sessionReady}><TeachersPage /></RequireAuth>} />
          <Route path="/profesores/:id" element={<RequireAuth session={session} sessionReady={sessionReady}><TeacherProfilePage /></RequireAuth>} />
          <Route path="/juega" element={<RequireAuth session={session} sessionReady={sessionReady}><PlayHubPage /></RequireAuth>} />
          <Route path="/aprende" element={<RequireAuth session={session} sessionReady={sessionReady}><LearnHubPage /></RequireAuth>} />
          <Route path="/play" element={<Navigate to="/juega" replace />} />
          <Route path="/profile" element={<Navigate to="/perfil" replace />} />
          <Route path="/inclusivo" element={<Navigate to="/inclusivos" replace />} />
          <Route path="/store" element={<Navigate to="/tienda" replace />} />
          <Route path="/store/:any" element={<Navigate to="/tienda" replace />} />
          <Route path="/ranking" element={<RankingPage />} />
          <Route path="/ligas" element={<LeaguePage />} />
          <Route path="/leaderboard" element={<RequireAuth session={session} sessionReady={sessionReady}><LeaderboardPage session={session} /></RequireAuth>} />
          <Route path="/jugadores" element={<RequireAuth session={session} sessionReady={sessionReady}><FindPlayersPage session={session} /></RequireAuth>} />
          <Route path="/club/:clubId" element={<ClubPage session={session} />} />
          <Route path="/stack" element={<GorilaStack />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {!isAuthShell && <CartFloatingButton />}
      <Toaster
        position="top-center"
        toastOptions={{
          style: { background: '#1a1a1a', color: '#fff', border: '1px solid #252525', borderRadius: '12px', padding: '16px', fontSize: '14px', fontFamily: 'Outfit, sans-serif' },
          success: { iconTheme: { primary: '#74B800', secondary: '#000' } },
          error: { iconTheme: { primary: '#FF4444', secondary: '#fff' } },
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