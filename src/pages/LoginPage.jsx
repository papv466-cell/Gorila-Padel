import { useEffect, useState } from "react";
import { supabase } from "../services/supabaseClient";
import { useLocation, useNavigate, Link } from "react-router-dom";


export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const returnTo = location.state && location.state.from ? location.state.from : "/mapa";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // si ya hay sesión, fuera
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) navigate(returnTo, { replace: true });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLogin(e) {
    e.preventDefault();
    setError(null);

    const em = String(email).trim();
    const pw = String(password);

    if (!em || !pw) {
      setError("Completa email y contraseña.");
      return;
    }

    try {
      setBusy(true);
      const { error: err } = await supabase.auth.signInWithPassword({
        email: em,
        password: pw,
      });
      if (err) throw err;

      navigate(returnTo, { replace: true });
    } catch (e2) {
      setError(e2?.message ?? "No se pudo iniciar sesión");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="authWrapper">
      <div className="authCard">
      <img src="/logo.png" alt="Global Padel" className="authLogo" />


        <h1 className="authTitle">Entrar</h1>
        <p className="authSub">Accede para unirte a partidos, crear y chatear.</p>

        <form className="authForm" onSubmit={handleLogin}>
          <label className="authLabel">
            Email
            <input
              className="authInput"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              autoComplete="email"
            />
          </label>

          <label className="authLabel">
            Contraseña
            <input
              className="authInput"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </label>

          {error ? <div className="authError">{error}</div> : null}

          <button className="authBtn" type="submit" disabled={busy}>
            {busy ? "Entrando…" : "Entrar"}
          </button>
          <div style={{ marginTop: 10, textAlign: "center" }}>
  <Link className="authLink" to="/forgot-password">
    ¿Olvidaste tu contraseña?
  </Link>
</div>

        </form>

        <div className="authFooter">
          <span>¿No tienes cuenta?</span>{" "}
          <Link className="authLink" to="/register">
            Registrarse
          </Link>
        </div>
      </div>
    </div>
  );
  <div style={{ marginTop: 10, fontSize: 13 }}>
  <Link className="authLink" to="/forgot-password">¿Olvidaste tu contraseña?</Link>
</div>

}
