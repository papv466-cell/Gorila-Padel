// src/components/UI/Navbar.jsx
import { useMemo, useState } from "react";
import { NavLink, useNavigate, useLocation, Link } from "react-router-dom";
import { supabase } from "../../services/supabaseClient";
import { useCart } from "../../contexts/CartContext";
import { useSession } from "../../contexts/SessionContext";
import "../../styles/Header.css";
import NotificationBell from "../NotificationBell";

export default function Navbar({ showBack = false, onBack }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { totalItems } = useCart();

  // ✅ FIX: usar SessionContext en vez de listener propio
  const { session } = useSession();

  const links = useMemo(() => [
    { to: "/mapa",        label: "Mapa",       icon: "🗺️" },
    { to: "/partidos",    label: "Partidos",    icon: "🎾" },
    { to: "/leaderboard", label: "Ranking",     icon: "🏆" },
    { to: "/ligas",       label: "Ligas",       icon: "🥇" },
    { to: "/gorilandia",  label: "Gorilandia",  icon: "🦍" },
    { to: "/clases",      label: "Clases",      icon: "📚" },
    { to: "/inclusivos",  label: "Inclusivos",  icon: "♿" },
    { to: "/retos",       label: "Retos",       icon: "⚔️" },
    { to: "/perfil",      label: "Perfil",      icon: "👤" },
    { to: "/tienda",      label: "Tienda",      icon: "🛍️" },
  ], []);

  useMemo(() => { setOpen(false); }, [location.pathname]);

  async function onLogout() {
    try { await supabase.auth.signOut(); }
    catch (e) { console.error("Logout error:", e); }
    finally { setOpen(false); navigate("/login", { replace: true }); }
  }

  return (
    <>
      <header className="siteHeader">
        <div className="headerInner">
          <NavLink to="/" className="headerLogo">
            <img className="headerLogoImg" src="/imglogog.png" alt="Gorila" />
            <div className="headerLogoText">Gorila <span>Padel</span></div>
          </NavLink>

          {showBack && (
            <button type="button" className="headerButton" onClick={onBack} style={{ marginLeft: "auto", marginRight: 8 }}>
              Atras
            </button>
          )}

          <nav className="headerNav">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} className={({ isActive }) => `headerNavLink ${isActive ? "isActive" : ""}`}>
                <span>{l.icon}</span>{l.label}
              </NavLink>
            ))}
          </nav>

          <div className="headerActions">
            {session && <NotificationBell />}
            <Link to="/tienda/carrito" style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, borderRadius: 999, background: totalItems > 0 ? "rgba(116,184,0,0.15)" : "rgba(255,255,255,0.06)", border: totalItems > 0 ? "1px solid rgba(116,184,0,0.3)" : "1px solid rgba(255,255,255,0.10)", fontSize: 18, textDecoration: "none", flexShrink: 0 }}>
              🛒
              {totalItems > 0 && <div style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: 999, background: "#74B800", color: "#111", fontSize: 11, fontWeight: 950, display: "grid", placeItems: "center", border: "2px solid #000" }}>{totalItems > 9 ? "9+" : totalItems}</div>}
            </Link>
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
          <li className="mobileMenuItem">
            <NavLink to="/tienda/carrito" className={({ isActive }) => `mobileMenuLink ${isActive ? "isActive" : ""}`} onClick={() => setOpen(false)}>
              <span className="mobileMenuIcon">🛒</span>Carrito
              {totalItems > 0 && <span style={{ marginLeft: "auto", padding: "3px 8px", borderRadius: 999, background: "#74B800", color: "#111", fontSize: 12, fontWeight: 950 }}>{totalItems}</span>}
            </NavLink>
          </li>
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