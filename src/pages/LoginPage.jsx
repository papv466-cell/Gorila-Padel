import { useEffect, useMemo, useState } from "react";
import { supabase } from "../services/supabaseClient";
import { useLocation, useNavigate, Link } from "react-router-dom";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();

  // Ruta de retorno
  const returnTo = useMemo(() => {
    return location.state && location.state.from ? location.state.from : "/mapa";
  }, [location.state]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Si ya hay sesión, fuera
    let alive = true;
    supabase.auth.getSession().then(({ data, error: sessErr }) => {
      if (!alive) return;
      if (sessErr) console.warn("[login] getSession error:", sessErr);
      if (data?.session) navigate(returnTo, { replace: true });
    });
    return () => {
      alive = false;
    };
  }, [navigate, returnTo]);

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

      const { data, error: err } = await supabase.auth.signInWithPassword({
        email: em,
        password: pw,
      });

      if (err) {
        console.error("[login] signInWithPassword error:", err);
        throw err;
      }

      // Seguridad extra: si por lo que sea no hay sesión, avisar
      if (!data?.session) {
        console.warn("[login] No session returned after signIn (raro).");
      }

      navigate(returnTo, { replace: true });
    } catch (e2) {
      // Mensaje más útil
      const msg =
        e2?.message ||
        e2?.error_description ||
        "No se pudo iniciar sesión. Revisa email/contraseña.";
      setError(msg);
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
}
