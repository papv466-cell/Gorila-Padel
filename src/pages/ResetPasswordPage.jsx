import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../services/supabaseClient";

export default function ResetPasswordPage() {
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [ok, setOk] = useState(null);

  // Si llega desde email, Supabase monta sesión temporal
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      // si no hay sesión, el link no se abrió bien
      if (!data?.session) {
        // no bloqueamos, solo avisamos
      }
    });
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setError(null);
    setOk(null);

    if (!password || password.length < 6) return setError("La contraseña debe tener al menos 6 caracteres.");
    if (password !== password2) return setError("Las contraseñas no coinciden.");

    try {
      setBusy(true);

      const { error: err } = await supabase.auth.updateUser({
        password,
      });

      if (err) throw err;

      setOk("Contraseña cambiada. Ya puedes entrar.");
      setTimeout(() => navigate("/login", { replace: true }), 700);
    } catch (e2) {
      setError(e2?.message ?? "No se pudo cambiar la contraseña");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="authWrapper">
      <div className="authCard">
        <img src="/logo.png" alt="Global Padel" className="authLogo" />
        <h1 className="authTitle">Nueva contraseña</h1>
        <p className="authSub">Escribe tu nueva contraseña.</p>

        <form className="authForm" onSubmit={handleSave}>
          <label className="authLabel">
            Nueva contraseña
            <input
              className="authInput"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="mínimo 6 caracteres"
              autoComplete="new-password"
            />
          </label>

          <label className="authLabel">
            Repite la contraseña
            <input
              className="authInput"
              type="password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              placeholder="repite la contraseña"
              autoComplete="new-password"
            />
          </label>

          {error ? <div className="authError">{error}</div> : null}
          {ok ? <div className="authOk">{ok}</div> : null}

          <button className="authBtn" type="submit" disabled={busy}>
            {busy ? "Guardando…" : "Guardar"}
          </button>
        </form>

        <div className="authFooter">
          <Link className="authLink" to="/login">Volver a entrar</Link>
        </div>
      </div>
    </div>
  );
}
