// src/components/UI/Navbar.jsx
import { useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../../services/supabaseClient";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const links = useMemo(
    () => [
      { to: "/mapa", label: "Mapa" },
      { to: "/clases", label: "Clases" },
      { to: "/partidos", label: "Partidos" },
      { to: "/inclusivos", label: "Inclusivos" },
      { to: "/perfil", label: "Perfil" },
    ],
    []
  );

  // ✅ Si cambias de ruta, cerramos el panel móvil (sin hacks raros)
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
    <header className="navbar">
      <div className="navLeft">
        <img className="navLogo" src="/imglogog.png" alt="Gorila Pádel" />
        <div className="navBrand">Gorila Pádel</div>
      </div>

      {/* Desktop tabs */}
      <nav className="navTabs navTabsDesktop" aria-label="Navegación principal">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            className={({ isActive }) => `navLink ${isActive ? "active" : ""}`}
            end={l.to === "/mapa"}
          >
            {l.label}
          </NavLink>
        ))}
      </nav>

      {/* Derecha: Salir + burger en móvil */}
      <div className="navRight">
        {/* ✅ Salir con look idéntico a navLink */}
        <button type="button" className="navLink navLinkBtn" onClick={onLogout}>
          Salir
        </button>

        <div className="navMobileOnly">
          <button
            type="button"
            className="navBurger"
            aria-label="Abrir menú"
            aria-expanded={open ? "true" : "false"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {/* Mobile panel */}
      {open ? (
        <div className="navMobilePanel" role="dialog" aria-label="Menú" onClick={() => setOpen(false)}>
          <div className="navMobilePanelInner" onClick={(e) => e.stopPropagation()}>
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) => `navMobileLink ${isActive ? "active" : ""}`}
                onClick={() => setOpen(false)}
                end={l.to === "/mapa"}
              >
                {l.label}
              </NavLink>
            ))}

            {/* ✅ Salir en móvil con el mismo estilo que los links del panel */}
            <button type="button" className="navMobileLink navLinkBtn" onClick={onLogout}>
              Salir
            </button>
          </div>
        </div>
      ) : null}
    </header>
  );
}
