// src/components/UI/Navbar.jsx
import { useMemo, useState } from "react";
import { NavLink, useNavigate, useLocation, Link } from "react-router-dom";
import { supabase } from "../../services/supabaseClient";
import { useCart } from "../../contexts/CartContext";
import { useSession } from "../../contexts/SessionContext";
import { useFeatures } from "../../contexts/FeaturesContext";
import { useSport, SPORTS } from "../../contexts/SportContext";
import "../../styles/Header.css";
import NotificationBell from "../NotificationBell";

export default function Navbar({ showBack = false, onBack }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { totalItems } = useCart();
  const { session } = useSession();
  const { isEnabled } = useFeatures();
  const { sport, setSport, sportInfo } = useSport();

  const allLinks = useMemo(() => [
    { to: "/mapa",       label: "Mapa",       icon: "🗺️", key: "mapa" },
    { to: "/juega",      label: "Juega",      icon: "🎾", key: "partidos" },
    { to: "/juntos",     label: "Juntos",     icon: "♿", key: "inclusivos" },
    { to: "/proyectos",  label: "Proyectos",  icon: "🏗️", key: "proyectos" },
    { to: "/perfil",     label: "Perfil",     icon: "👤", key: "perfil" },
  ], []);

  const links = useMemo(() => allLinks.filter(l => isEnabled(l.key)), [allLinks, isEnabled]);

  useMemo(() => { setOpen(false); }, [location.pathname]);

  async function onLogout() {
    try { await supabase.auth.signOut(); }
    catch (e) { console.error("Logout error:", e); }
    finally { setOpen(false); navigate("/login", { replace: true }); }
  }

  const showCarrito = isEnabled("tienda") || isEnabled("carrito");
  const showNotif   = isEnabled("notificaciones");

  return (
    <>
      <header className="siteHeader" style={{ borderBottom: `1px solid ${sportInfo?.colorBorder || "rgba(var(--sport-color-rgb, 46,204,113),0.2)"}` }}>
        <div className="headerInner">
          <NavLink to="/" className="headerLogo">
            <img className="headerLogoImg" src="/imglogog.png" alt="Gorila" />
            <div className="headerLogoText">GorilaGo<span>!</span></div>
          </NavLink>

          {/* Selector de deporte */}
          <div style={{ display: "flex", gap: 2, padding: "3px", background: "rgba(255,255,255,0.06)", borderRadius: 999, border: `1px solid ${sportInfo?.colorBorder || "rgba(255,255,255,0.10)"}` }}>
            {[
              { key: "padel",      emoji: "🎾", label: "Pádel",      color: "#2ECC71" },
              { key: "tenis",      emoji: "🎾", label: "Tenis",      color: "#F39C12" },
              { key: "pickleball", emoji: "🏓", label: "Pickle",     color: "#3498DB" },
            ].map(s => (
              <button key={s.key} onClick={() => setSport(s.key)}
                title={s.label}
                style={{
                  padding: "6px 10px", borderRadius: 999, border: "none", cursor: "pointer",
                  background: sport === s.key ? s.color : "transparent",
                  color: sport === s.key ? "#000" : "rgba(255,255,255,0.50)",
                  fontSize: 12, fontWeight: sport === s.key ? 900 : 500,
                  transition: "all 0.2s",
                  minHeight: 32,
                }}>
                {s.emoji} {s.label}
              </button>
            ))}
          </div>

          {showBack && (
            <button type="button" className="headerButton" onClick={onBack} style={{ marginLeft: "auto", marginRight: 8 }}>
              Atras
            </button>
          )}

          <nav className="headerNav">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} id={`nav-${l.to.replace("/","")}`} className={({ isActive }) => `headerNavLink ${isActive ? "isActive" : ""}`}>
                <span>{l.icon}</span>{l.label}
              </NavLink>
            ))}
          </nav>

          <div className="headerActions">
            {session && showNotif && <span id="btn-notif"><NotificationBell session={session} /></span>}
            {showCarrito && (
              <Link to="/tienda/carrito" style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, borderRadius: 999, background: totalItems > 0 ? "rgba(var(--sport-color-rgb, 46,204,113),0.15)" : "rgba(255,255,255,0.06)", border: totalItems > 0 ? "1px solid rgba(var(--sport-color-rgb, 46,204,113),0.3)" : "1px solid rgba(255,255,255,0.10)", fontSize: 18, textDecoration: "none", flexShrink: 0 }}>
                🛒
                {totalItems > 0 && <div style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: 999, background: "var(--sport-color)", color: "#111", fontSize: 11, fontWeight: 950, display: "grid", placeItems: "center", border: "2px solid #000" }}>{totalItems > 9 ? "9+" : totalItems}</div>}
              </Link>
            )}
            <button className="headerButton" onClick={onLogout}>Salir</button>
            <button className={`menuToggle ${open ? "isOpen" : ""}`} onClick={() => setOpen(!open)} aria-label="Menu">
              <span></span><span></span><span></span>
            </button>
          </div>
        </div>
      </header>

      <div className={`mobileMenuOverlay ${open ? "isOpen" : ""}`} onClick={() => setOpen(false)} />

      <nav className={`mobileMenu ${open ? "isOpen" : ""}`}>
        <ul className="mobileMenuList">
          {links.map((l) => (
            <li key={l.to} className="mobileMenuItem">
              <NavLink to={l.to} className={({ isActive }) => `mobileMenuLink ${isActive ? "isActive" : ""}`} onClick={() => setOpen(false)}>
                <span className="mobileMenuIcon">{l.icon}</span>{l.label}
              </NavLink>
            </li>
          ))}
          {showCarrito && (
            <li className="mobileMenuItem">
              <NavLink to="/tienda/carrito" className={({ isActive }) => `mobileMenuLink ${isActive ? "isActive" : ""}`} onClick={() => setOpen(false)}>
                <span className="mobileMenuIcon">🛒</span>Carrito
                {totalItems > 0 && <span style={{ marginLeft: "auto", padding: "3px 8px", borderRadius: 999, background: "var(--sport-color)", color: "#111", fontSize: 12, fontWeight: 950 }}>{totalItems}</span>}
              </NavLink>
            </li>
          )}
          <div className="mobileMenuDivider" />
          <li className="mobileMenuItem">
            <button type="button" className="mobileMenuLink" onClick={onLogout} style={{ width: "100%", textAlign: "left", border: "none", background: "transparent", cursor: "pointer" }}>
              <span className="mobileMenuIcon">🚪</span>Salir
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}
