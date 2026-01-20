import { NavLink, useNavigate } from "react-router-dom";
import { supabase } from "../../services/supabaseClient";

function LinkTab({ to, children }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `navLink ${isActive ? "active" : ""}`}
    >
      {children}
    </NavLink>
  );
}

export default function Navbar() {
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
    } finally {
      // aseguramos UI limpia aunque el SW/cache haga cosas raras
      navigate("/login", { replace: true });
      window.location.reload(); 
    }
  }


  return (
    <header className="navbar">
      <div className="navLeft">
        {/* ✅ LOGO DESDE /public */}
        <img
          src="/logo.png"
          alt="Global Padel"
          className="navLogo"
        />
        <div className="navBrand">Global Padel</div>
      </div>

      <nav className="navTabs">
        <LinkTab to="/mapa">Mapa</LinkTab>
        <LinkTab to="/partidos">Partidos</LinkTab>
      </nav>

      <div className="navRight">
        <button type="button" className="btn ghost" onClick={handleLogout}>
          Salir
        </button>
      </div>
    </header>
  );
}
