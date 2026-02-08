// src/components/UI/Navbar.jsx
import { useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../../services/supabaseClient";
import "../../styles/Header.css";

export default function Navbar({ showBack = false, onBack }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const links = useMemo(
    () => [
      { to: "/mapa", label: "Mapa", icon: "🗺️" },
      { to: "/partidos", label: "Partidos", icon: "🎾" },
      { to: "/clases", label: "Clases", icon: "📚" },
      { to: "/inclusivos", label: "Inclusivos", icon: "♿" },
      { to: "/perfil", label: "Perfil", icon: "👤" },
    ],
    []
  );

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  async function onLogout() {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error("Logout error:", e);
    } finally {
      setOpen(false);
      navigate("/login", { replace: true });
    }
  }

  return (
    <>
      <header className="siteHeader">
        <div className="headerInner">
          {/* Logo */}
          <NavLink to="/" className="headerLogo">
            <img className="headerLogoImg" src="/imglogog.png" alt="Gorila" />
            <div className="headerLogoText">
              Gorila <span>Pádel</span>
            </div>
          </NavLink>

          {/* Botón back (si aplica) */}
          {showBack && (
            <button
              type="button"
              className="headerButton"
              onClick={onBack}
              style={{ marginLeft: 'auto', marginRight: 8 }}
            >
              ← Atrás
            </button>
          )}

          {/* Nav desktop (oculto en móvil) */}
          <nav className="headerNav">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) =>
                  `headerNavLink ${isActive ? "isActive" : ""}`
                }
              >
                <span>{l.icon}</span>
                {l.label}
              </NavLink>
            ))}
          </nav>

          {/* Acciones */}
          <div className="headerActions">
            <button className="headerButton" onClick={onLogout}>
              Salir
            </button>

            {/* Menú hamburguesa (solo móvil) */}
            <button
              className={`menuToggle ${open ? "isOpen" : ""}`}
              onClick={() => setOpen(!open)}
              aria-label="Menú"
            >
              <span></span>
              <span></span>
              <span></span>
            </button>
          </div>
        </div>
      </header>

      {/* Overlay móvil */}
      <div
        className={`mobileMenuOverlay ${open ? "isOpen" : ""}`}
        onClick={() => setOpen(false)}
      />

      {/* Menú móvil (drawer lateral) */}
      <nav className={`mobileMenu ${open ? "isOpen" : ""}`}>
        <ul className="mobileMenuList">
          {links.map((l) => (
            <li key={l.to} className="mobileMenuItem">
              <NavLink
                to={l.to}
                className={({ isActive }) =>
                  `mobileMenuLink ${isActive ? "isActive" : ""}`
                }
                onClick={() => setOpen(false)}
              >
                <span className="mobileMenuIcon">{l.icon}</span>
                {l.label}
              </NavLink>
            </li>
          ))}

          <div className="mobileMenuDivider" />

          <li className="mobileMenuItem">
            <button
              type="button"
              className="mobileMenuLink"
              onClick={onLogout}
              style={{ width: '100%', textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer' }}
            >
              <span className="mobileMenuIcon">🚪</span>
              Salir
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}